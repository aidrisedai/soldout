import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { llm } from "@/lib/llm";
import { FIELDS, type Field } from "@/lib/onboarding";

// Conversational onboarding: one question at a time. After each answer, a fast model
// (1) writes a short personal acknowledgement, (2) extracts any other fields the answer
// already covers (so we skip them), and (3) phrases the next question. Field ORDER is fixed
// here so the flow never stalls; if the model is slow, default wording is used.

const TOOL: Anthropic.Tool = {
  name: "next",
  description: "Acknowledge the answer, extract fields, phrase the next question",
  input_schema: {
    type: "object",
    properties: {
      ack: { type: "string", description: "One warm, specific sentence reacting to the latest answer (use their name/title naturally when known). No questions here." },
      extracted: {
        type: "object",
        description: "Field values clearly stated in the latest answer (only keys from the list; dates as YYYY-MM-DD; seats as a number).",
        properties: Object.fromEntries(FIELDS.filter((f) => !["intent", "content", "applyLink", "mode"].includes(f.key)).map((f) => [f.key, { type: "string" }])),
      },
      questionFor: { type: "string", description: "The key of the field your question asks for (must be the first field still missing after your extraction)." },
      question: { type: "string", description: "The next question, phrased conversationally, building on what they said. One question only." },
    },
    required: ["ack", "extracted", "questionFor", "question"],
  },
};

function nextField(answers: Record<string, string>): Field | null {
  return FIELDS.find((f) => !answers[f.key]?.trim() && !answers[`${f.key}__skipped`]) ?? null;
}

export async function POST(req: Request) {
  const { answers = {}, lastKey } = (await req.json().catch(() => ({}))) as { answers?: Record<string, string>; lastKey?: string };
  const merged: Record<string, string> = { ...answers };
  let ack = "";
  let question = "";
  let questionFor = "";

  if (lastKey && answers[lastKey]) {
    const remaining = FIELDS.filter((f) => !merged[f.key]?.trim()).map((f) => `${f.key} (${f.label})`).join(", ");
    try {
      const { client } = llm();
      const res = (await Promise.race([
        client.messages.create({
          model: process.env.ONBOARDING_MODEL ?? (process.env.NAIVE_API_KEY ? "anthropic/claude-haiku-4.5" : "claude-haiku-4-5"),
          max_tokens: 400,
          tools: [TOOL],
          system: "You onboard an organizer of a paid in-person program to SoldOut, a service that fills seats. Be warm, brief and specific. Today is " + new Date().toISOString().slice(0, 10) + ".",
          messages: [{
            role: "user",
            content: `Known so far: ${JSON.stringify(Object.fromEntries(Object.entries(merged).filter(([k]) => !k.endsWith("__skipped"))))}
Latest question key: ${lastKey}. Their answer: """${answers[lastKey]}"""
Fields still missing: ${remaining || "none"}
Call the tool. The next question should ask for the FIRST still-missing field after accounting for anything you extract.`,
          }],
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("slow")), 12000)),
      ])) as Anthropic.Message;
      const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const out = (use?.input ?? {}) as { ack?: string; extracted?: Record<string, string>; questionFor?: string; question?: string };
      for (const [k, v] of Object.entries(out.extracted ?? {})) {
        if (v && !merged[k]?.trim() && !["content", "applyLink", "intent", "mode"].includes(k) && FIELDS.some((f) => f.key === k)) merged[k] = String(v);
      }
      ack = out.ack ?? "";
      question = out.question ?? "";
      questionFor = out.questionFor ?? "";
    } catch {
      // fall through to default wording
    }
  }

  const field = nextField(merged);
  if (!field) return NextResponse.json({ answers: merged, ack, done: true });
  // Only use the model's wording when it asks for the field we actually collect next.
  const q = question && questionFor === field.key ? question : field.fallback;
  return NextResponse.json({ answers: merged, ack, done: false, field: { ...field, question: q }, step: FIELDS.indexOf(field) + 1, total: FIELDS.length });
}
