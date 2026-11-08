import type Anthropic from "@anthropic-ai/sdk";
import { complete, llm } from "./llm";

// Onboarding "program brief": read everything the organizer gives us (files + links),
// write the answer pack SoldOut will use, list what's still missing as gap questions,
// and pull out key facts (seats, price, dates…) so we don't ask for them again.

export type Source = { name: string; text: string };

export async function extractFile(name: string, bytes: Uint8Array): Promise<string> {
  const lower = name.toLowerCase();
  try {
    if (lower.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      return String(text);
    }
    if (lower.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return r.value;
    }
    if (/\.(md|markdown|txt|csv|json)$/.test(lower)) return new TextDecoder().decode(bytes);
    if (/\.html?$/.test(lower)) return htmlToText(new TextDecoder().decode(bytes));
  } catch (e) {
    return `(could not read ${name}: ${(e as Error).message})`;
  }
  return `(unsupported file type: ${name})`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

export async function fetchLink(url: string): Promise<string> {
  let target = url.trim();
  // Public Google Docs export as plain text.
  const doc = target.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
  if (doc) target = `https://docs.google.com/document/d/${doc[1]}/export?format=txt`;
  try {
    const res = await fetch(target, { headers: { "user-agent": "SoldOutBot/1.0 (program brief reader)" }, signal: AbortSignal.timeout(12000) });
    if (!res.ok) return `(couldn't open ${url}: HTTP ${res.status})`;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("pdf")) return extractFile("link.pdf", new Uint8Array(await res.arrayBuffer()));
    const body = await res.text();
    return type.includes("html") ? htmlToText(body) : body;
  } catch (e) {
    return `(couldn't open ${url}: ${(e as Error).message})`;
  }
}

export type BriefResult = {
  brief: string;
  gaps: { key: string; question: string }[];
  facts: Record<string, string>;
};

const TOOL: Anthropic.Tool = {
  name: "submit_brief",
  description: "Submit the program brief, gap questions and key facts",
  input_schema: {
    type: "object",
    properties: {
      brief: {
        type: "string",
        description:
          "Markdown answer pack: Overview; Who it's for; What participants do; Schedule & format; Who teaches; Price & how to enroll; FAQ (8-12 Q&As parents ask). Only facts from the sources; write 'check' where unsure.",
      },
      gaps: {
        type: "array",
        maxItems: 4,
        description: "The most important facts a parent would need that the sources don't give. Plain, friendly questions to the organizer. Skip anything already known.",
        items: { type: "object", properties: { key: { type: "string" }, question: { type: "string" } }, required: ["key", "question"] },
      },
      facts: {
        type: "object",
        description: "Key facts clearly stated in the sources (omit unknown).",
        properties: {
          name: { type: "string" }, organization: { type: "string" }, goalSeats: { type: "string" }, deadline: { type: "string", description: "YYYY-MM-DD" },
          price: { type: "string" }, audience: { type: "string" }, dateText: { type: "string" }, place: { type: "string" }, applyLink: { type: "string" },
        },
      },
    },
    required: ["brief", "gaps", "facts"],
  },
};

export async function buildBrief(sources: Source[], known: Record<string, string>): Promise<BriefResult> {
  const { model } = llm();
  const material = sources.map((s) => `### SOURCE: ${s.name}\n${s.text.slice(0, 20000)}`).join("\n\n").slice(0, 90000);
  const res = await complete({
    model,
    max_tokens: 6000,
    tools: [TOOL],
    system: "You turn an organizer's materials into the program brief an assistant uses to answer parents. Never invent facts, numbers, testimonials or outcomes. Be concise and concrete.",
    messages: [{
      role: "user",
      content: `What the organizer already told us: ${JSON.stringify(known)}\n\nTheir materials:\n${material || "(none provided)"}\n\nBuild the brief, list the gap questions (max 4, most important first), and extract key facts.`,
    }],
  });
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const out = (use?.input ?? {}) as Partial<BriefResult>;
  return { brief: out.brief ?? "", gaps: (out.gaps ?? []).slice(0, 4), facts: out.facts ?? {} };
}
