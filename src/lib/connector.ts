import { readFile } from "node:fs/promises";
import type Anthropic from "@anthropic-ai/sdk";
import type { Event, Prospect } from "@prisma/client";
import { db } from "./db";
import { llm } from "./llm";
import { createBrief } from "./brief";
import { emailConfigured, markHandled, replyEmail, sendEmail, unrepliedEmails, type MailAttachment } from "./email";

// Step 4 of docs/FLOW.md: a real conversation with a connector, not a broadcast.
// open → listen → share progressively → ask (seat / referral / group) → hand-off with their JOIN code.

export async function approveAndSend(prospectId: string) {
  const p = await db.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const channels = JSON.parse(p.channels) as { email?: string; linkedin?: string };
  const subject = (JSON.parse(p.research ?? "{}") as { subject?: string }).subject ?? "Hello from EdAI";
  if (channels.email && emailConfigured()) {
    const r = await sendEmail(channels.email, subject, p.opener ?? "", ["soldout-outreach"]);
    await db.touch.create({ data: { prospectId: p.id, channel: "email", direction: "out", body: p.opener ?? "", status: "sent", threadId: r.threadId, externalId: r.messageId } });
    await db.prospect.update({ where: { id: p.id }, data: { status: "contacted" } });
    return { sent: "email" };
  }
  // LinkedIn is the first rung when there is no work email: the organizer sends the connect note.
  await db.touch.create({ data: { prospectId: p.id, channel: channels.linkedin ? "linkedin" : "intro", direction: "out", body: p.opener ?? "", status: "approved" } });
  await db.prospect.update({ where: { id: p.id }, data: { status: "approved" } });
  return { sent: channels.linkedin ? "linkedin_ready" : "intro_ready" };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "share_brief",
    description: "Attach the one-page program brief (PDF) to your reply. Only once the connector has shown real interest or asked for details.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "record_outcome",
    description: "Record where this connector landed once it's clear.",
    input_schema: {
      type: "object",
      properties: {
        outcome: { type: "string", enum: ["engaged", "bought", "referred", "shared_to_group", "not_now"] },
        note: { type: "string" },
      },
      required: ["outcome", "note"],
    },
  },
  {
    name: "flag_for_organizer",
    description: "Anything odd, sensitive, negative, about money terms (refunds, installments, discounts), or that you're unsure how to answer. The organizer will take over.",
    input_schema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"] },
  },
];

function system(e: Event, p: Prospect): string {
  return `You are writing as ${e.organizerName} (${e.organization}) in a personal email conversation with ${p.name}, ${p.role ?? "a community leader"} at their community. You reached out to them; they did not sign up for anything.

GOAL OF THIS CONVERSATION (in order of preference)
1. They enroll a teen of their own (send them the apply link only when they ask how), or
2. They introduce you to specific families who'd love this, or
3. They point you to a group, newsletter or event where you can share it, and share it themselves.

HOW TO TALK
- Like a real person: short, warm, specific to what they said. Plain text, no markdown, under 120 words.
- Share progressively. Early: one line on what the program is. If they're curious: a bit more (who it's for, schedule). If they want details: call share_brief to attach the PDF. Never dump everything at once.
- When they're open to helping, give them something easy to forward and their personal code: families can text "JOIN ${p.joinCode}" to learn more${e.applyLink ? ` or apply at ${e.applyLink}` : ""}.
- If they say not now / not interested, thank them warmly, record not_now, and don't push.
- Facts only from the CONTENT below. Never invent numbers, testimonials or outcomes. Never discuss refunds, installments or discounts: flag_for_organizer instead.
- Never mention AI, tools or assistants.

CONTENT
<content>
${e.content.slice(0, 30000)}
</content>`;
}

export async function connectorReply(prospectId: string): Promise<{ text: string; attachBrief: boolean; flagged?: string }> {
  const p = await db.prospect.findUniqueOrThrow({ where: { id: prospectId } });
  const e = await db.event.findUniqueOrThrow({ where: { id: p.eventId } });
  const touches = await db.touch.findMany({ where: { prospectId }, orderBy: { createdAt: "asc" } });

  const messages: Anthropic.MessageParam[] = [];
  for (const t of touches) {
    const role = t.direction === "in" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${t.body}`;
    else messages.push({ role, content: t.body });
  }
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: "(You sent the first message below.)" });

  let attachBrief = false;
  let flagged: string | undefined;
  let text = "";
  const { client, model } = llm();
  for (let i = 0; i < 4; i++) {
    const res = await client.messages.stream({ model, max_tokens: 900, system: system(e, p), tools: TOOLS, messages }).finalMessage();
    const t = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    if (t) text = t;
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) break;
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const input = (u.input ?? {}) as Record<string, string>;
      let out = "ok";
      if (u.name === "share_brief") { attachBrief = true; out = "The PDF will be attached to your reply."; }
      if (u.name === "record_outcome") {
        const map: Record<string, string> = { engaged: "engaged", bought: "bought", referred: "referred", shared_to_group: "referred", not_now: "not_now" };
        await db.prospect.update({ where: { id: p.id }, data: { status: map[input.outcome] ?? "engaged" } });
      }
      if (u.name === "flag_for_organizer") { flagged = input.reason; out = "Flagged. Write a short, kind holding reply; the organizer will follow up personally."; }
      results.push({ type: "tool_result", tool_use_id: u.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return { text, attachBrief, flagged };
}

// Called by the worker: pick up connector replies and answer them (unless the organizer took over).
export async function processConnectorReplies() {
  if (!emailConfigured()) return 0;
  const outs = await db.touch.findMany({ where: { channel: "email", direction: "out", threadId: { not: null } }, select: { threadId: true, prospectId: true } });
  if (!outs.length) return 0;
  const byThread = new Map(outs.map((o) => [o.threadId!, o.prospectId]));
  const replies = await unrepliedEmails(20, new Set(byThread.keys()));
  let handled = 0;
  for (const r of replies) {
    const prospectId = byThread.get(r.threadId)!;
    const seen = await db.touch.findFirst({ where: { externalId: r.messageId } });
    if (seen) { await markHandled(r.messageId); continue; }
    await db.touch.create({ data: { prospectId, channel: "email", direction: "in", body: r.text, status: "received", threadId: r.threadId, externalId: r.messageId, author: "contact" } });
    const p = await db.prospect.update({ where: { id: prospectId }, data: { status: "replied" } });
    await markHandled(r.messageId);
    if (p.aiPaused) { handled++; continue; } // the organizer is handling this one

    const out = await connectorReply(prospectId);
    if (out.flagged) {
      await db.prospect.update({ where: { id: prospectId }, data: { aiPaused: true } });
      await db.organizerFlag.create({
        data: { eventId: p.eventId, contactId: await connectorContactId(p), question: r.text.slice(0, 500), reason: `Connector ${p.name}: ${out.flagged}` },
      }).catch(() => {});
    }
    if (!out.text) continue;
    const attachments: MailAttachment[] = [];
    if (out.attachBrief) {
      const e = await db.event.findUniqueOrThrow({ where: { id: p.eventId } });
      const b = (await db.brief.findFirst({ where: { eventId: e.id }, orderBy: { createdAt: "desc" } })) ?? (await createBrief(e));
      attachments.push({ filename: `${e.organization.replace(/\W+/g, "-")}-Program-Brief.pdf`, contentType: "application/pdf", content: (await readFile(b.pdfPath)).toString("base64") });
    }
    const sent = await replyEmail(r.messageId, out.text, attachments.length ? attachments : undefined);
    await db.touch.create({ data: { prospectId, channel: "email", direction: "out", body: out.text + (attachments.length ? "\n\n[PDF brief attached]" : ""), status: "sent", threadId: sent.threadId, externalId: sent.messageId } });
    handled++;
  }
  return handled;
}

// Organizer flags need a contact row; connectors get one keyed by their email.
async function connectorContactId(p: Prospect): Promise<string> {
  const phone = `email:${(JSON.parse(p.channels) as { email?: string }).email ?? p.id}`;
  const c = (await db.contact.findUnique({ where: { eventId_phone: { eventId: p.eventId, phone } } }))
    ?? (await db.contact.create({ data: { eventId: p.eventId, phone, channel: "email", stage: "connector" } }));
  return c.id;
}

// Organizer writes personally (take-over mode). Replies in the same email thread.
export async function organizerReply(prospectId: string, text: string) {
  const last = await db.touch.findFirst({ where: { prospectId, channel: "email", externalId: { not: null } }, orderBy: { createdAt: "desc" } });
  if (!last?.externalId) throw new Error("No email thread with this person yet");
  const sent = await replyEmail(last.externalId, text);
  await db.touch.create({ data: { prospectId, channel: "email", direction: "out", body: text, status: "sent", threadId: sent.threadId, externalId: sent.messageId, author: "organizer" } });
}
