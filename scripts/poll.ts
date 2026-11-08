// Pulls inbound messages from channels that don't need a public webhook URL
// and forwards them to /api/inbound. Run next to `npm run dev`:  npm run poll
//   - Telegram: getUpdates long polling (needs TELEGRAM_BOT_TOKEN)
//   - Mobilerun SMS inbox (needs MOBILERUN_API_KEY)
//   - WhatsApp on the Mobilerun cloud phone: sends queued replies, reads unread chats
import Mobilerun from "@mobilerun/sdk";
import { PrismaClient } from "@prisma/client";
import { phoneCtx, readUnread, sendFileViaPhone, sendViaPhone } from "../src/lib/waPhone";
import { resolveAttachment } from "../src/lib/files";
import { deviceLocked } from "../src/lib/dot";
import { processConnectorReplies } from "../src/lib/connector";
import { advanceAll } from "../src/lib/autopilot";

const APP = process.env.APP_URL ?? "http://localhost:3000";

async function forward(from: string, text: string, channel: string, externalId: string) {
  const res = await fetch(`${APP}/api/inbound`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.DASHBOARD_PASSWORD ? { authorization: `Basic ${Buffer.from(`worker:${process.env.DASHBOARD_PASSWORD}`).toString("base64")}` } : {}),
    },
    body: JSON.stringify({ from, text, channel, externalId }),
  });
  const j = (await res.json().catch(() => ({}))) as { actions?: string[]; delivery?: string; error?: string };
  console.log(`[${channel}] ${from}: ${text.slice(0, 60)} → ${j.error ?? (j.actions ?? []).join(",")} ${j.delivery ?? ""}`);
}

async function telegramLoop(token: string) {
  let offset = 0;
  console.log("[telegram] polling");
  for (;;) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=["message"]`);
      const j = (await res.json()) as { ok: boolean; result: { update_id: number; message?: { message_id: number; text?: string; chat: { id: number } } }[]; description?: string };
      if (!j.ok) { console.error("[telegram]", j.description); await sleep(5000); continue; }
      for (const u of j.result) {
        offset = u.update_id + 1;
        const m = u.message;
        if (!m?.text) continue;
        // Telegram's /start button sends "/start"; treat it as JOIN.
        const text = /^\/start\b/i.test(m.text) ? `JOIN ${m.text.split(/\s+/)[1] ?? ""}`.trim() : m.text;
        await forward(`tg:${m.chat.id}`, text, "telegram", `tg-in:${m.chat.id}:${m.message_id}`);
      }
    } catch (e) {
      console.error("[telegram]", (e as Error).message);
      await sleep(5000);
    }
  }
}

async function mobilerunLoop(apiKey: string) {
  const mr = new Mobilerun({ apiKey });
  const numbers = await mr.numbers.list();
  const n = numbers.items.find((x) => x.state === "active");
  if (!n) return console.log("[sms] no active Mobilerun number");
  console.log(`[sms] polling ${n.phoneNumber} (can send: ${n.actions.send})`);
  let since = new Date(Date.now() - 60_000).toISOString();
  for (;;) {
    try {
      const res = await mr.numbers.messages.list(n.id, { direction: "inbound", since, pageSize: 50 });
      for (const m of [...res.items].reverse()) {
        if (m.occurredAt > since) since = m.occurredAt;
        if (m.body && m.peerNumber) await forward(m.peerNumber, m.body, "sms", m.id);
      }
    } catch (e) {
      console.error("[sms]", (e as Error).message);
    }
    await sleep(4000);
  }
}

// WhatsApp on the Mobilerun cloud phone: one loop owns the device, so sends and reads never collide.
async function whatsappPhoneLoop() {
  const ctx = await phoneCtx();
  if (!ctx) return console.log("[whatsapp] no ready Mobilerun phone");
  const db = new PrismaClient();
  console.log(`[whatsapp] driving WhatsApp on device ${ctx.deviceId}`);
  const seen = new Set<string>();
  let paused = false;
  for (;;) {
    if (await deviceLocked()) {
      if (!paused) console.log("[whatsapp] paused: a media task is using the phone");
      paused = true;
      await sleep(5000);
      continue;
    }
    if (paused) console.log("[whatsapp] resumed");
    paused = false;
    try {
      const queued = await db.message.findMany({
        where: { channel: "whatsapp", direction: "out", status: "queued" },
        orderBy: { createdAt: "asc" },
        take: 5,
        include: { contact: { select: { phone: true } } },
      });
      for (const m of queued) {
        let r: { ok: boolean; error?: string };
        if (m.attachment) {
          try {
            const f = await resolveAttachment(db, m.attachment);
            r = await sendFileViaPhone(ctx, m.contact.phone, f.path, f.fileName, m.body);
          } catch (e) {
            r = { ok: false, error: (e as Error).message };
          }
        } else {
          r = await sendViaPhone(ctx, m.contact.phone, m.body);
        }
        await db.message.update({ where: { id: m.id }, data: r.ok ? { status: "sent" } : { status: "failed", error: r.error } });
        console.log(`[whatsapp] → ${m.contact.phone}: ${r.ok ? "sent" : r.error}`);
      }
      if (process.env.WHATSAPP_READ !== "0") {
        for (const chat of await readUnread(ctx)) {
          if (seen.has(chat.key)) continue;
          seen.add(chat.key);
          await forward(`wa:${chat.phone}`, chat.texts.join("\n"), "whatsapp", `wa-phone:${chat.key}`);
        }
      }
    } catch (e) {
      console.error("[whatsapp]", (e as Error).message);
    }
    await sleep(3000);
  }
}

// Connector email conversations (AgentMail): read replies and answer them.
async function connectorLoop() {
  console.log("[connectors] watching email replies");
  for (;;) {
    try {
      const n = await processConnectorReplies();
      if (n) console.log(`[connectors] handled ${n} repl${n === 1 ? "y" : "ies"}`);
    } catch (e) {
      console.error("[connectors]", (e as Error).message);
    }
    await sleep(20000);
  }
}

// Autopilot: moves every running campaign forward on its own.
async function autopilotLoop() {
  console.log("[autopilot] running");
  for (;;) {
    try { await advanceAll(); } catch (e) { console.error("[autopilot]", (e as Error).message); }
    await sleep(60000);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const loops: Promise<unknown>[] = [];
if (process.env.TELEGRAM_BOT_TOKEN) loops.push(telegramLoop(process.env.TELEGRAM_BOT_TOKEN));
if (process.env.MOBILERUN_API_KEY) loops.push(mobilerunLoop(process.env.MOBILERUN_API_KEY));
if (process.env.MOBILERUN_API_KEY && process.env.WHATSAPP_VIA !== "cloud") loops.push(whatsappPhoneLoop());
if (process.env.AGENTMAIL_API_KEY) loops.push(connectorLoop());
if (process.env.AUTOPILOT !== "0") loops.push(autopilotLoop());
if (!loops.length) console.log("Nothing to poll: set TELEGRAM_BOT_TOKEN and/or MOBILERUN_API_KEY in .env");
Promise.all(loops).catch((e) => { console.error(e); process.exit(1); });
