import type Anthropic from "@anthropic-ai/sdk";
import type { Event } from "@prisma/client";
import { db } from "./db";
import { complete, llm } from "./llm";

// Good Strategy / Bad Strategy kernel: diagnosis → guiding policies → coherent actions.
export type StrategyBody = {
  diagnosis: string;
  policies: { policy: string; why: string; test: string }[];
  whoNext: { group: string; messenger: string; channel: string; why: string; message: string }[];
};

const TOOL: Anthropic.Tool = {
  name: "submit_strategy",
  description: "Submit the strategy draft.",
  input_schema: {
    type: "object",
    properties: {
      diagnosis: { type: "string", description: "2-4 sentences: the crux of why seats are not yet filled, grounded only in the content and the scoreboard." },
      policies: {
        type: "array",
        minItems: 2,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            policy: { type: "string" },
            why: { type: "string", description: "How it addresses the diagnosis" },
            test: { type: "string", description: "A cheap test with a measurable signal and a time box, e.g. '3 messengers share JOIN; success = 10 opt-ins in 48h'" },
          },
          required: ["policy", "why", "test"],
        },
      },
      whoNext: {
        type: "array",
        minItems: 3,
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            group: { type: "string", description: "A community or organization named in the content" },
            messenger: { type: "string", description: "A ROLE at that organization (e.g. 'youth director', 'newsletter editor', 'WhatsApp group admin'). Never a private individual's name." },
            channel: { type: "string", description: "email | WhatsApp | LinkedIn (org page or public contact) | in person | newsletter" },
            why: { type: "string" },
            message: { type: "string", description: "Ready-to-send message to the messenger, under 600 characters, asking them to share the JOIN keyword with their community. Facts only from the content." },
          },
          required: ["group", "messenger", "channel", "why", "message"],
        },
      },
    },
    required: ["diagnosis", "policies", "whoNext"],
  },
};

export async function draftStrategy(event: Event): Promise<StrategyBody> {
  const [optIns, answered, links, paid, flags, openFlags, topFlags] = await Promise.all([
    db.outcome.count({ where: { eventId: event.id, type: "opted_in" } }),
    db.outcome.count({ where: { eventId: event.id, type: "answered" } }),
    db.outcome.count({ where: { eventId: event.id, type: "link_sent" } }),
    db.outcome.count({ where: { eventId: event.id, type: "paid" } }),
    db.organizerFlag.count({ where: { eventId: event.id } }),
    db.organizerFlag.count({ where: { eventId: event.id, status: "open" } }),
    db.organizerFlag.findMany({ where: { eventId: event.id }, take: 10, orderBy: { createdAt: "desc" }, select: { question: true } }),
  ]);

  const system = `You are SoldOut's strategist, using Richard Rumelt's Good Strategy / Bad Strategy kernel: a diagnosis that names the crux, 2-3 guiding policies that address it, and coherent actions. Avoid fluff, goals dressed as strategy, and wish lists.

RULES
- Use ONLY facts in the event content and scoreboard. Never invent stats, partners, endorsements, testimonials or results.
- Who-next lists groups and messenger ROLES that already appear in the content (communities, partners, outreach targets). Never name or research private individuals. If the content says a relationship is unconfirmed, say "outreach target", not "partner".
- Each message invites the messenger to share "Text JOIN ${event.keyword}" with their community. People are only ever contacted after they opt in themselves.
- Respect the content's own claim limits (e.g. venue is not sponsorship; past summit results are not this program's results).
- Messages never mention installments, payment plans, refunds, discounts or scholarships; those are for the organizer to discuss directly.
- Nothing is sent until the organizer approves.`;

  const user = `EVENT: ${event.name} by ${event.organization}
Goal: ${event.goalSeats ?? "not stated"} seats by ${event.deadline ?? "not stated"} · Price: ${event.price ?? "?"} · When: ${event.dateText ?? "?"} · Where: ${event.place ?? "?"} · Audience: ${event.audience ?? "?"}

SCOREBOARD: opt-ins ${optIns}, questions answered ${answered}, links sent ${links}, paid ${paid}, organizer flags ${flags} (${openFlags} open)
Recent questions the content could not answer: ${topFlags.map((f) => f.question).join(" | ") || "none yet"}

CONTENT
<content>
${event.content}
</content>

Draft the strategy and submit it with submit_strategy.`;

  const { client, model } = llm();
  // Stream so long drafts don't hit the proxy's upstream timeout.
  const res = await complete({ model, max_tokens: 4096, system, tools: [TOOL], messages: [{ role: "user", content: user }] });
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_strategy");
  if (!use) throw new Error("Strategist did not return a strategy");
  return use.input as StrategyBody;
}
