import { AgentMailClient } from "agentmail";

// Outreach email through AgentMail (https://docs.agentmail.to): sends from the organizer's
// AgentMail inbox and reads replies by the "unreplied" label (no public webhook needed).
let client: AgentMailClient | null = null;
function am(): AgentMailClient {
  if (!process.env.AGENTMAIL_API_KEY) throw new Error("AGENTMAIL_API_KEY not set");
  client ??= new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
  return client;
}
function inbox(): string {
  const id = process.env.AGENTMAIL_INBOX_ID;
  if (!id) throw new Error("AGENTMAIL_INBOX_ID not set (the inbox address, e.g. azeez@agentmail.to)");
  return id;
}

export function emailConfigured() {
  return !!process.env.AGENTMAIL_API_KEY && !!process.env.AGENTMAIL_INBOX_ID;
}

export async function sendEmail(to: string, subject: string, text: string, labels: string[] = ["soldout-outreach"]) {
  const r = await am().inboxes.messages.send(inbox(), { to: [to], subject, text, labels });
  return { messageId: r.messageId, threadId: r.threadId };
}

export async function replyEmail(messageId: string, text: string) {
  const r = await am().inboxes.messages.reply(inbox(), messageId, { text });
  await am().inboxes.messages.update(inbox(), messageId, { addLabels: ["replied"], removeLabels: ["unreplied"] }).catch(() => {});
  return { messageId: r.messageId, threadId: r.threadId };
}

// New inbound replies: newest message text only (quoted history stripped by AgentMail).
export async function unrepliedEmails(limit = 10) {
  const list = await am().inboxes.messages.list(inbox(), { labels: ["unreplied"], limit });
  const out: { messageId: string; threadId: string; from: string; subject?: string; text: string }[] = [];
  for (const m of list.messages ?? []) {
    const full = await am().inboxes.messages.get(inbox(), m.messageId);
    out.push({ messageId: m.messageId, threadId: m.threadId, from: String(m.from), subject: m.subject, text: (full.extractedText ?? full.text ?? m.preview ?? "").trim() });
  }
  return out;
}

export async function markHandled(messageId: string) {
  await am().inboxes.messages.update(inbox(), messageId, { addLabels: ["soldout-seen"], removeLabels: ["unreplied"] }).catch(() => {});
}
