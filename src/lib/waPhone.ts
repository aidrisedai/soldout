import Mobilerun from "@mobilerun/sdk";

// Drives the real WhatsApp app on a Mobilerun cloud phone with deterministic
// Phone actions (deep link, UI tree, tap). Docs: https://docs.mobilerun.ai/api-reference
// Sending: open https://wa.me/<number>?text=<msg> in WhatsApp, then tap Send.
// Reading: scan the chat list for unread rows, open each, read incoming bubbles.

const PKG = "com.whatsapp";
const id = (s: string) => `${PKG}:id/${s}`;

type Node = {
  resourceId: string;
  text: string;
  contentDescription: string;
  isClickable: boolean;
  boundsInScreen: { left: number; top: number; right: number; bottom: number };
  children: Node[] | null;
};

export type PhoneCtx = { mr: Mobilerun; deviceId: string };
export type IncomingChat = { phone: string; texts: string[]; key: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function phoneCtx(): Promise<PhoneCtx | null> {
  if (!process.env.MOBILERUN_API_KEY) return null;
  const mr = new Mobilerun({ apiKey: process.env.MOBILERUN_API_KEY });
  let deviceId = process.env.MOBILERUN_DEVICE_ID;
  if (!deviceId) {
    const res = (await mr.get("/devices", { query: { state: "ready" } })) as { items?: { id: string; type: string }[] };
    deviceId = res.items?.find((d) => d.type.includes("phone"))?.id;
  }
  return deviceId ? { mr, deviceId } : null;
}

function flatten(n: Node, out: Node[] = []): Node[] {
  out.push(n);
  for (const c of n.children ?? []) flatten(c, out);
  return out;
}

async function nodes(ctx: PhoneCtx): Promise<Node[]> {
  const ui = await ctx.mr.devices.state.ui(ctx.deviceId, { filter: false });
  return flatten(ui.a11y_tree as unknown as Node);
}

async function tapNode(ctx: PhoneCtx, n: Node) {
  const b = n.boundsInScreen;
  await ctx.mr.devices.actions.tap(ctx.deviceId, { x: Math.round((b.left + b.right) / 2), y: Math.round((b.top + b.bottom) / 2) });
}

async function dismissDialogs(ctx: PhoneCtx, all: Node[]): Promise<boolean> {
  const ok = all.find((n) => n.resourceId === id("ephemeral_nux_ok") || (n.isClickable && /^(OK|Got it|Continue)$/i.test(n.text)));
  if (!ok) return false;
  await tapNode(ctx, ok);
  await sleep(800);
  return true;
}

export const digits = (phone: string) => phone.replace(/[^\d]/g, "");

export async function sendViaPhone(ctx: PhoneCtx, phone: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const to = digits(phone);
  await ctx.mr.devices.deepLink.executeDeepLink(ctx.deviceId, { deepLink: `https://wa.me/${to}?text=${encodeURIComponent(text)}`, packageName: PKG });
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(1200);
    let all = await nodes(ctx);
    if (await dismissDialogs(ctx, all)) all = await nodes(ctx);
    const entry = all.find((n) => n.resourceId === id("entry"));
    const send = all.find((n) => n.resourceId === id("send"));
    if (entry && send && entry.text.trim()) {
      await tapNode(ctx, send);
      await sleep(1500);
      const after = await nodes(ctx);
      const left = after.find((n) => n.resourceId === id("entry"))?.text ?? "";
      if (!left.trim() || left === "Message") return { ok: true };
      return { ok: false, error: "message still in composer after tapping Send" };
    }
    if (all.some((n) => /isn't on WhatsApp|not on WhatsApp/i.test(n.text))) return { ok: false, error: "number is not on WhatsApp" };
  }
  return { ok: false, error: "WhatsApp composer not found" };
}

// Returns unread chats with their newest incoming messages. Leaves WhatsApp on the chat list.
export async function readUnread(ctx: PhoneCtx, maxChats = 3): Promise<IncomingChat[]> {
  await ctx.mr.devices.apps.start(PKG, { deviceId: ctx.deviceId });
  await sleep(1500);
  let all = await nodes(ctx);
  await dismissDialogs(ctx, all);
  // Make sure we're on the Chats tab, not inside a conversation.
  for (let i = 0; i < 3 && all.some((n) => n.resourceId === id("entry")); i++) {
    await ctx.mr.devices.actions.global(ctx.deviceId, { action: 1 }); // GLOBAL_ACTION_BACK
    await sleep(800);
    all = await nodes(ctx);
  }

  const rows = all.filter((n) => n.resourceId === id("contact_row_container"));
  const unread = rows.filter((row) => {
    const inside = flatten(row);
    return inside.some((n) => /unread message/i.test(n.contentDescription) || /message_count|unread/i.test(n.resourceId));
  });

  const out: IncomingChat[] = [];
  for (const row of unread.slice(0, maxChats)) {
    const inside = flatten(row);
    const name = inside.find((n) => n.resourceId === id("conversations_row_contact_name"))?.text ?? "";
    if (!/\d{7,}/.test(digits(name))) continue; // saved-contact names: skip (we only answer numbers that opted in)
    await tapNode(ctx, row);
    await sleep(1500);
    const chat = await nodes(ctx);
    await dismissDialogs(ctx, chat);
    const texts = incomingSinceLastOutgoing(chat);
    const last = chat.filter((n) => n.resourceId === id("date")).pop()?.text ?? "";
    if (texts.length) out.push({ phone: `+${digits(name)}`, texts, key: `${digits(name)}|${last}|${texts.join("|").slice(0, 120)}` });
    await ctx.mr.devices.actions.global(ctx.deviceId, { action: 1 });
    await sleep(800);
  }
  return out;
}

// In the conversation view, outgoing bubbles carry a delivery "status" icon; incoming ones don't.
function incomingSinceLastOutgoing(all: Node[]): string[] {
  const bubbles: { text: string; outgoing: boolean }[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].resourceId !== id("message_text")) continue;
    let outgoing = false;
    for (let j = i + 1; j < all.length && all[j].resourceId !== id("message_text"); j++) {
      if (all[j].resourceId === id("status")) { outgoing = true; break; }
    }
    bubbles.push({ text: all[i].text, outgoing });
  }
  const lastOut = bubbles.map((b) => b.outgoing).lastIndexOf(true);
  return bubbles.slice(lastOut + 1).map((b) => b.text).filter(Boolean);
}
