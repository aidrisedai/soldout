import { mkdirSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { Event } from "@prisma/client";
import PDFDocument from "pdfkit";
import { db } from "./db";
import { complete, llm } from "./llm";

export type BriefBody = {
  title: string;
  tagline: string;
  sections: { heading: string; bullets: string[] }[];
  howToApply: string[];
};

const TOOL: Anthropic.Tool = {
  name: "submit_brief",
  description: "Submit the one-page program brief",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string" },
      tagline: { type: "string", description: "One sentence, taken from the content (e.g. the mission)" },
      sections: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          properties: { heading: { type: "string" }, bullets: { type: "array", maxItems: 4, items: { type: "string" } } },
          required: ["heading", "bullets"],
        },
      },
      howToApply: { type: "array", items: { type: "string" }, description: "Enrollment steps exactly as the content states them" },
    },
    required: ["title", "tagline", "sections", "howToApply"],
  },
};

export async function draftBrief(event: Event): Promise<BriefBody> {
  const system = `You write a one-page program brief that a parent receives as a PDF. Strict rules:
- Use ONLY facts stated in the content. Never invent numbers, quotes, testimonials, outcomes or partners.
- Leave out anything the content marks "check" or unconfirmed.
- Never mention installments, payment plans, refunds, discounts or scholarships.
- Keep historical results (past cohorts, summits) clearly labeled as past events, never as promises.
- Plain, warm, concrete language. Bullets under 20 words.
Suggested sections: who it's for, what students do, schedule and format, who teaches, what students work toward, tuition.`;
  const user = `Program: ${event.name} by ${event.organization}
Price: ${event.price ?? "see content"} · When: ${event.dateText ?? "see content"} · Where: ${event.place ?? "see content"} · Audience: ${event.audience ?? "see content"} · Apply: ${event.applyLink ?? "see content"}

<content>
${event.content}
</content>`;
  const { client, model } = llm();
  const res = await complete({ model, max_tokens: 3000, system, tools: [TOOL], messages: [{ role: "user", content: user }] });
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!use) throw new Error("Brief writer returned nothing");
  return use.input as BriefBody;
}

export function renderBriefPdf(event: Event, b: BriefBody, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 44, info: { Title: b.title, Author: event.organization } });
    const out = createWriteStream(path);
    doc.pipe(out);
    const ink = "#111827", muted = "#4b5563", accent = "#047857";

    doc.fillColor(accent).font("Helvetica-Bold").fontSize(11).text(event.organization.toUpperCase(), { characterSpacing: 1.5 });
    doc.moveDown(0.3).fillColor(ink).fontSize(20).text(b.title);
    doc.moveDown(0.3).fillColor(muted).font("Helvetica-Oblique").fontSize(11.5).text(b.tagline);
    doc.moveDown(0.6);

    for (const s of b.sections) {
      doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text(s.heading);
      doc.moveDown(0.15).fillColor(ink).font("Helvetica").fontSize(10);
      for (const line of s.bullets) doc.text(`•  ${line}`, { indent: 6, paragraphGap: 1.5 });
      doc.moveDown(0.45);
    }

    doc.fillColor(accent).font("Helvetica-Bold").fontSize(12).text("How to apply");
    doc.moveDown(0.15).fillColor(ink).font("Helvetica").fontSize(10);
    b.howToApply.forEach((step, i) => doc.text(`${i + 1}.  ${step}`, { indent: 6, paragraphGap: 1.5 }));

    doc.moveDown(0.6).fillColor(muted).font("Helvetica").fontSize(8.5)
      .text(`Prepared from ${event.organization}'s own program information. Questions? Reply in your chat and ${event.organizerName} will answer.`);
    doc.end();
    out.on("finish", () => resolve());
    out.on("error", reject);
  });
}

export async function createBrief(event: Event) {
  const body = await draftBrief(event);
  const dir = join(process.cwd(), "data", "briefs");
  mkdirSync(dir, { recursive: true });
  const slug = event.organization.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Program";
  const path = join(dir, `${slug}-Program-Brief-${event.keyword}-${Date.now()}.pdf`);
  await renderBriefPdf(event, body, path);
  return db.brief.create({ data: { eventId: event.id, body: JSON.stringify(body), pdfPath: path } });
}

export async function approvedBrief(eventId: string) {
  return db.brief.findFirst({ where: { eventId, status: "approved" }, orderBy: { approvedAt: "desc" } });
}
