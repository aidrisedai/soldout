import type Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { complete, llm } from "./llm";
import type { Clip, FitQuestion } from "./event";

export async function uniqueKeyword(wanted: string): Promise<string> {
  const base = (wanted.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "EVENT");
  let k = base;
  for (let i = 2; await db.event.findUnique({ where: { keyword: k } }); i++) k = `${base}${i}`;
  return k;
}

// "Title | https://link | what question it answers" per line
export function parseClipLines(text: string): Clip[] {
  return text
    .split("\n")
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter((p) => p.length >= 2 && /^https?:\/\//.test(p[1]))
    .map((p, i) => ({ id: `clip${i + 1}`, title: p[0], url: p[1], answers: p[2] ?? p[0] }));
}

export function parseFitLines(text: string): FitQuestion[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean)
    .map((q, i) => ({ key: `q${i + 1}`, question: q }));
}

// When the organizer gives no fit questions, draft 3-4 from their own content.
export async function draftFitQuestions(content: string, audience: string): Promise<FitQuestion[]> {
  const tool: Anthropic.Tool = {
    name: "submit",
    description: "Submit fit questions",
    input_schema: {
      type: "object",
      properties: { questions: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } } },
      required: ["questions"],
    },
  };
  const { client, model } = llm();
  const res = await complete({
    model,
    max_tokens: 800,
    tools: [tool],
    messages: [{
      role: "user",
      content: `Write 2-4 short SMS fit questions, asked one at a time, that tell whether a person in this audience (${audience || "unknown"}) fits this program. Use only what the content says about eligibility, prerequisites, schedule and format. No questions about money or personal data beyond what the content needs.\n\n<content>\n${content.slice(0, 40000)}\n</content>`,
    }],
  });
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const qs = ((use?.input as { questions?: string[] })?.questions ?? []).slice(0, 4);
  return qs.map((q, i) => ({ key: `q${i + 1}`, question: q }));
}
