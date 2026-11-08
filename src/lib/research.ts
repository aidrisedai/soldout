import type Anthropic from "@anthropic-ai/sdk";
import type { Event, Strategy } from "@prisma/client";
import { db } from "./db";
import { llm } from "./llm";
import { webSearch, type WebResult } from "./monid";
import type { StrategyBody } from "./strategy";

// Step 2 of docs/FLOW.md: guiding policies → target communities/orgs → research → GO / NO-GO.

async function toolCall<T>(system: string, user: string, tool: Anthropic.Tool, maxTokens = 3000): Promise<T> {
  const { client, model } = llm();
  const res = await client.messages
    .stream({ model, max_tokens: maxTokens, system, tools: [tool], messages: [{ role: "user", content: user }] })
    .finalMessage();
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!use) throw new Error(`${tool.name}: no result`);
  return use.input as T;
}

const TARGETS_TOOL: Anthropic.Tool = {
  name: "submit_targets",
  description: "Submit target communities/organizations",
  input_schema: {
    type: "object",
    properties: {
      targets: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Specific community or organization name" },
            kind: { type: "string", enum: ["community", "organization"] },
            policy: { type: "string", description: "The guiding policy it serves (short)" },
            location: { type: "string" },
            searchQueries: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3, description: "3-6 word web queries to research it" },
          },
          required: ["name", "kind", "policy", "searchQueries"],
        },
      },
    },
    required: ["targets"],
  },
};

const VERDICT_TOOL: Anthropic.Tool = {
  name: "submit_research",
  description: "Submit community research and a go/no-go recommendation",
  input_schema: {
    type: "object",
    properties: {
      summary: { type: "string", description: "2-3 sentences: who they are, size/reach if stated in sources" },
      needs: { type: "array", items: { type: "string" }, maxItems: 4, description: "What this community needs or cares about, from the sources" },
      fit: { type: "string", description: "Why the program fits (or doesn't) these needs" },
      howIn: { type: "string", description: "Best way in: which program, team or role to approach" },
      fitScore: { type: "integer", minimum: 0, maximum: 100 },
      decision: { type: "string", enum: ["go", "no_go"] },
      reason: { type: "string", description: "One sentence" },
      sources: { type: "array", items: { type: "string" }, description: "URLs actually used" },
    },
    required: ["summary", "needs", "fit", "howIn", "fitScore", "decision", "reason", "sources"],
  },
};

export async function expandTargets(event: Event, strategy: Strategy) {
  const s = JSON.parse(strategy.body) as StrategyBody;
  const proposed = await toolCall<{ targets: { name: string; kind: string; policy: string; location?: string; searchQueries: string[] }[] }>(
    `You turn a campaign strategy into specific target communities and organizations to research. Prefer ones named in the content or strategy; you may add closely related, real, well-known communities in the same area. Never invent organizations.`,
    `PROGRAM: ${event.name} by ${event.organization} · audience: ${event.audience ?? "?"} · where: ${event.place ?? "?"}
DIAGNOSIS: ${s.diagnosis}
POLICIES:\n${s.policies.map((p, i) => `${i + 1}. ${p.policy} (test: ${p.test})`).join("\n")}
WHO NEXT (draft):\n${s.whoNext.map((w) => `- ${w.group} (${w.messenger})`).join("\n")}

Propose 4-6 targets to research.`,
    TARGETS_TOOL,
  );

  const created = [];
  for (const t of proposed.targets) {
    created.push(
      await db.target.create({
        data: { eventId: event.id, strategyId: strategy.id, policy: t.policy, name: t.name, kind: t.kind, research: JSON.stringify({ queries: t.searchQueries, location: t.location }) },
      }),
    );
  }
  // Research each target (sequential keeps Monid spend and rate predictable).
  for (const t of created) await researchTarget(event, t.id).catch((e) => console.error("[research]", t.name, (e as Error).message));
  return created.length;
}

export async function researchTarget(event: Event, targetId: string) {
  const t = await db.target.findUniqueOrThrow({ where: { id: targetId } });
  const meta = JSON.parse(t.research ?? "{}") as { queries?: string[]; location?: string };
  const results: WebResult[] = await webSearch(
    `What ${t.name}${meta.location ? ` (${meta.location})` : ""} is, who it serves, its programs for teens or families, and how to contact its leaders`,
    meta.queries?.length ? meta.queries : [t.name],
  );
  const sources = results.map((r) => `URL: ${r.url}\nTITLE: ${r.title}\n${(r.excerpts ?? []).join("\n").slice(0, 1500)}`).join("\n\n---\n\n");

  const v = await toolCall<{ summary: string; needs: string[]; fit: string; howIn: string; fitScore: number; decision: "go" | "no_go"; reason: string; sources: string[] }>(
    `You research a community for an organizer and recommend GO or NO-GO. Use only the web sources and the program facts given. If sources are thin, say so and lower the score. Never invent numbers.`,
    `PROGRAM: ${event.name} by ${event.organization}. Audience: ${event.audience ?? "?"}. Price: ${event.price ?? "?"}. When: ${event.dateText ?? "?"}. Where: ${event.place ?? "?"}.
TARGET: ${t.name} (${t.kind}) · serves policy: ${t.policy}

WEB SOURCES:
${sources || "(no results)"}`,
    VERDICT_TOOL,
    2000,
  );
  await db.target.update({
    where: { id: t.id },
    data: { research: JSON.stringify({ ...meta, ...v }), fitScore: v.fitScore, decision: v.decision, reason: v.reason },
  });
}
