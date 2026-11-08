import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleInbound } from "@/lib/inbound";

// WhatsApp Cloud API webhook (Meta). Docs:
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started
// https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks

// Verification: Meta sends GET ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && u.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  if (!ok) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

type WaPayload = {
  object?: string;
  entry?: { changes?: { field?: string; value?: { messages?: { from?: string; id: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }[] } }[] }[];
};

function validSignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true; // allowed for local testing only; set it for anything public
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new NextResponse("bad signature", { status: 401 });
  let body: WaPayload;
  try { body = JSON.parse(raw); } catch { return new NextResponse("bad json", { status: 400 }); }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title;
        if (!m.from || !text) continue;
        // Answer Meta fast; the agent runs in the background. Retries are deduped by message id.
        void handleInbound({ from: `wa:+${m.from}`, text, channel: "whatsapp", externalId: m.id }).catch((e) => console.error("[whatsapp]", (e as Error).message));
      }
    }
  }
  return NextResponse.json({ ok: true });
}
