import { sendSms } from "./mobilerun";

// Every outbound message goes through here. Adding a channel = one adapter.
export const CHANNELS = ["simulate", "sms", "telegram", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

export type SendResult = { ok: boolean; status: string; externalId?: string; error?: string };

export async function sendOn(channel: string, to: string, body: string, idempotencyKey: string): Promise<SendResult> {
  switch (channel) {
    case "simulate":
      return { ok: true, status: "ok" };
    case "sms": {
      const r = await sendSms(to, body, idempotencyKey);
      return r.ok ? { ok: true, status: r.status, externalId: r.externalId } : { ok: false, status: r.status, error: r.error };
    }
    case "telegram":
      return sendTelegram(to, body);
    case "whatsapp":
      return sendWhatsApp(to, body);
  }
  return { ok: false, status: "not_sendable", error: `unknown channel ${channel}` };
}

// Contacts on Telegram are stored as "tg:<chat_id>".
async function sendTelegram(to: string, body: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, status: "not_sendable", error: "TELEGRAM_BOT_TOKEN not set" };
  const chatId = to.replace(/^tg:/, "");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: false }),
  });
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { message_id?: number }; description?: string };
  return j.ok ? { ok: true, status: "sent", externalId: `tg-out:${chatId}:${j.result?.message_id}` } : { ok: false, status: "failed", error: j.description ?? `HTTP ${res.status}` };
}

// WhatsApp Cloud API (Meta). Contacts are stored as "wa:<E.164 digits>".
async function sendWhatsApp(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, status: "not_sendable", error: "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set" };
  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^wa:\+?/, ""), type: "text", text: { body, preview_url: true } }),
  });
  const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  return j.messages?.[0]?.id ? { ok: true, status: "sent", externalId: j.messages[0].id } : { ok: false, status: "failed", error: j.error?.message ?? `HTTP ${res.status}` };
}
