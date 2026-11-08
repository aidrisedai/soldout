import type Anthropic from "@anthropic-ai/sdk";
import type { Contact, Event } from "@prisma/client";
import { db } from "./db";
import { llm } from "./llm";
import { parseClips, parseFitQuestions, type Clip, type FitQuestion } from "./event";

// Topics the agent must never answer on its own: they always go to the organizer.
const ORGANIZER_ONLY = /\b(refund|refunds|installment|installments|payment plan|monthly payment|pay monthly|split (the )?payment|pay in (parts|instal)|discount|scholarship|financial aid|withdraw|cancel(lation)?)\b/i;

export type AgentResult = { reply: string; actions: string[] };

type Ctx = {
  event: Event;
  contact: Contact;
  fit: FitQuestion[];
  clips: Clip[];
  attachments: string[]; // links appended after the model's text
  actions: string[];
  flagged: boolean;
  answered: boolean;
  inboundText: string;
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "record_fit_answer",
    description: "Save the parent's answer to one of the event's fit questions. Call it as soon as the parent answers, before asking the next question.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "The fit question key" },
        answer: { type: "string", description: "The parent's answer, in their own words, briefly" },
      },
      required: ["key", "answer"],
    },
  },
  {
    name: "set_program",
    description: "Place the teen(s) in a program. Use 'builder' when the teen has not built anything yet (an idea alone belongs in Builder), 'founder' when they already have a first version of a product.",
    input_schema: {
      type: "object",
      properties: {
        program: { type: "string", enum: ["founder", "builder"] },
        reason: { type: "string" },
      },
      required: ["program", "reason"],
    },
  },
  {
    name: "mark_answered",
    description: "Log that you answered a parent's question using the event content. Call once per question you answer.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
    },
  },
  {
    name: "flag_for_organizer",
    description: "Hand a question to the organizer. Use when the answer is not in the content, is marked 'check', or is about refunds, installments, discounts, scholarships, eligibility exceptions, or anything you are unsure of.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The parent's question" },
        reason: { type: "string", description: "Why you could not answer it" },
      },
      required: ["question", "reason"],
    },
  },
  {
    name: "send_clip",
    description: "Send the link to one of the event's clips when the parent's question matches what the clip answers.",
    input_schema: {
      type: "object",
      properties: { clip_id: { type: "string" } },
      required: ["clip_id"],
    },
  },
  {
    name: "send_enroll_link",
    description: "Send the enrollment link. Only when the parent is a fit (fit questions answered, program chosen) AND says they are ready to sign up or pay.",
    input_schema: {
      type: "object",
      properties: {
        teens: { type: "string", description: "Who is being enrolled, e.g. '2 teens: grade 8 (Founder), grade 6 (Builder)'" },
      },
      required: ["teens"],
    },
  },
];

function systemPrompt(c: Ctx, answers: { key: string; answer: string }[], openFlags: number): string {
  const e = c.event;
  const answered = new Map(answers.map((a) => [a.key, a.answer]));
  const fitLines = c.fit
    .map((q) => `- [${q.key}] ${q.question}${answered.has(q.key) ? `  → ANSWERED: ${answered.get(q.key)}` : "  → not yet asked/answered"}`)
    .join("\n");
  const clipLines = c.clips.length
    ? c.clips.map((k) => `- [${k.id}] ${k.title} — answers: ${k.answers}`).join("\n")
    : "(no clips available — never invent or promise a video)";

  return `You are SoldOut, texting on behalf of ${e.organizerName} (${e.organization}) about "${e.name}". You talk with a parent who texted JOIN. This is SMS: keep every reply under 450 characters, warm, direct and practical. Plain text only, no markdown.

NON-NEGOTIABLE RULES
1. Answer ONLY from the EVENT CONTENT below. Never use outside knowledge about the organization, people or programs.
2. If the answer is not in the content, or the content marks it "check", say you'll need to confirm with ${e.organization} and that the organizer will reply, and call flag_for_organizer. Do not guess.
3. Never invent facts, numbers, stats, quotes, testimonials, outcomes, deadlines, scarcity or discounts.
4. Never promise or describe installment terms, refunds, discounts, scholarships or exceptions. Those always go to the organizer via flag_for_organizer, even if the content mentions them.
5. Personalize only from what this parent told you in this conversation. Never mention research about them or their child.
6. Keep historical results (past cohorts, summits) separate from this program and never turn an intended outcome into a guarantee.
7. Use Islamic expressions only if natural, never in every message.

CONVERSATION FLOW
- Ask the FIT QUESTIONS one at a time, in order, skipping answered ones. Save each answer with record_fit_answer right away.
- If the parent asks a question, answer it first (call mark_answered), then continue with the next fit question.
- If a teen has not built anything yet, call set_program with "builder" and explain kindly that Builder is the right starting point (an idea alone belongs in Builder). If they already have a first version of a product, set_program "founder". Mention the matching session time from the content.
- If a grade is outside the eligible range, flag_for_organizer instead of deciding.
- When a question matches a clip below, call send_clip (the link is added automatically; don't paste URLs yourself).
- When all fit questions are answered and the parent says they're ready to sign up or pay, call send_enroll_link (the link is added automatically after your text). Tell them to complete one application per teen. Payment happens on that page.
- Never paste URLs yourself.

FIT QUESTIONS
${fitLines}

CLIPS
${clipLines}

CURRENT STATE
- Program chosen: ${c.contact.program ?? "not yet"}
- Stage: ${c.contact.stage}
- Open questions waiting on the organizer: ${openFlags}

EVENT CONTENT (the only source of truth)
<content>
${e.content}
</content>`;
}

async function runTool(c: Ctx, name: string, input: Record<string, string>): Promise<string> {
  const { event, contact } = c;
  switch (name) {
    case "record_fit_answer": {
      const q = c.fit.find((f) => f.key === input.key);
      if (!q) return `Unknown fit question key. Valid keys: ${c.fit.map((f) => f.key).join(", ")}`;
      await db.fitAnswer.upsert({
        where: { contactId_key: { contactId: contact.id, key: q.key } },
        create: { eventId: event.id, contactId: contact.id, key: q.key, question: q.question, answer: input.answer },
        update: { answer: input.answer },
      });
      c.actions.push(`fit:${q.key}`);
      return "saved";
    }
    case "set_program": {
      const program = input.program === "builder" ? "builder" : "founder";
      await db.contact.update({ where: { id: contact.id }, data: { program, stage: program === "builder" ? "builder" : contact.stage } });
      contact.program = program;
      if (program === "builder") {
        await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "routed_builder", detail: input.reason } });
      }
      c.actions.push(`program:${program}`);
      return "saved";
    }
    case "mark_answered": {
      if (!c.answered) {
        await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "answered", detail: input.question } });
        c.answered = true;
        c.actions.push("answered");
      }
      return "logged";
    }
    case "flag_for_organizer": {
      await flag(c, input.question, input.reason);
      return "flagged; tell the parent the organizer will reply";
    }
    case "send_clip": {
      const clip = c.clips.find((k) => k.id === input.clip_id);
      if (!clip) return "No clip with that id. Do not mention a video.";
      c.attachments.push(`${clip.title}: ${clip.url}`);
      await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "clip_sent", detail: clip.title } });
      c.actions.push(`clip:${clip.id}`);
      return "clip link will be appended";
    }
    case "send_enroll_link": {
      const answers = await db.fitAnswer.findMany({ where: { contactId: contact.id } });
      const missing = c.fit.filter((f) => !answers.some((a) => a.key === f.key));
      if (missing.length) return `Not yet: ask these fit questions first: ${missing.map((m) => m.key).join(", ")}`;
      const link = event.applyLink || event.paymentLink;
      if (!link) {
        await flag(c, "Parent is ready to enroll", "Event has no enrollment link configured");
        return "No link configured; organizer flagged. Tell the parent the organizer will send the link.";
      }
      c.attachments.push(`Apply and enroll here: ${link}`);
      await db.contact.update({ where: { id: contact.id }, data: { stage: "link_sent" } });
      await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "link_sent", detail: `${input.teens} → ${link}` } });
      c.actions.push("link_sent");
      return "link will be appended";
    }
  }
  return "unknown tool";
}

async function flag(c: Ctx, question: string, reason: string) {
  if (c.flagged) return;
  c.flagged = true;
  await db.organizerFlag.create({ data: { eventId: c.event.id, contactId: c.contact.id, question, reason } });
  await db.outcome.create({ data: { eventId: c.event.id, contactId: c.contact.id, type: "needs_organizer", detail: question } });
  c.actions.push("needs_organizer");
}

export async function runAgent(event: Event, contact: Contact, inboundText: string): Promise<AgentResult> {
  const c: Ctx = {
    event,
    contact,
    fit: parseFitQuestions(event.fitQuestions),
    clips: parseClips(event.clips),
    attachments: [],
    actions: [],
    flagged: false,
    answered: false,
    inboundText,
  };

  // Deterministic guardrail: organizer-only topics are flagged no matter what the model does.
  if (ORGANIZER_ONLY.test(inboundText)) {
    await flag(c, inboundText, "Refunds, installments, discounts and exceptions are answered only by the organizer");
  }

  const [history, answers, openFlags] = await Promise.all([
    db.message.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" }, take: 40 }),
    db.fitAnswer.findMany({ where: { contactId: contact.id } }),
    db.organizerFlag.count({ where: { contactId: contact.id, status: "open" } }),
  ]);

  // History already includes the inbound message just stored.
  const messages: Anthropic.MessageParam[] = [];
  for (const m of history) {
    const role = m.direction === "in" ? "user" : "assistant";
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n${m.body}`;
    else messages.push({ role, content: m.body });
  }
  if (messages[0]?.role !== "user") messages.unshift({ role: "user", content: "JOIN" });

  const { client, model } = llm();
  const system = systemPrompt(c, answers, openFlags) + (c.flagged ? "\n\nNOTE: this message touches an organizer-only topic and has ALREADY been flagged. Tell the parent the organizer will reply on that point; do not answer it yourself." : "");

  let text = "";
  for (let i = 0; i < 6; i++) {
    const res = await client.messages.create({ model, max_tokens: 1024, system, tools: TOOLS, messages });
    const textParts = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text);
    if (textParts.length) text = textParts.join("\n").trim();
    const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || uses.length === 0) break;
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const u of uses) {
      const out = await runTool(c, u.name, (u.input ?? {}) as Record<string, string>);
      results.push({ type: "tool_result", tool_use_id: u.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }

  if (!text) text = c.flagged ? `Thanks! I'll check with ${event.organization} and they'll get back to you.` : "Thanks! One moment.";
  const reply = [text, ...c.attachments].join("\n\n");
  return { reply, actions: c.actions };
}
