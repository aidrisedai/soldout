import type Anthropic from "@anthropic-ai/sdk";
import type { Event } from "@prisma/client";
import { db } from "./db";
import { complete, llm } from "./llm";
import { monidRun } from "./monid";

// Step 3 of docs/FLOW.md: people in a GO community, connectors first, each with a person card.
// Public, professional information only (LinkedIn search results, the org's own public pages).

type LinkedInPerson = { fullName: string; headline?: string; profileUrl?: string; location?: string; publicIdentifier?: string };

const CARD_TOOL: Anthropic.Tool = {
  name: "submit_people",
  description: "Submit up to 5 people to reach, connectors first",
  input_schema: {
    type: "object",
    properties: {
      people: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            role: { type: "string", description: "Their public role at the community/org" },
            linkedinUrl: { type: "string" },
            linkedinHandle: { type: "string" },
            reach: { type: "string", enum: ["connector", "member"], description: "connector = leads/runs programs, newsletters, schools, groups" },
            whyThem: { type: "string", description: "One sentence: why this person, based only on their public role" },
            opener: {
              type: "string",
              description:
                "First message in the ORGANIZER's voice (first person). Warm, personal, about them and their community; no pitch, no links, no price; ends with a light question. Under 600 characters.",
            },
            subject: { type: "string", description: "Short email subject, personal, not salesy" },
          },
          required: ["name", "role", "reach", "whyThem", "opener", "subject"],
        },
      },
    },
    required: ["people"],
  },
};

function orgName(targetName: string): string {
  const paren = targetName.match(/\(([^)]+)\)/)?.[1];
  return (paren && paren.length > 6 ? paren : targetName.replace(/\(.*?\)/g, "")).trim();
}

export async function findPeople(event: Event, targetId: string) {
  const t = await db.target.findUniqueOrThrow({ where: { id: targetId } });
  const research = JSON.parse(t.research ?? "{}") as { summary?: string; howIn?: string; needs?: string[]; sources?: string[] };

  let people: LinkedInPerson[] = [];
  try {
    const out = await monidRun<{ data?: { items?: LinkedInPerson[] } }>("ploid", "/linkedin/search", { body: { filters: { currentCompany: orgName(t.name) }, limit: 10 } });
    people = out.data?.items ?? [];
  } catch (e) {
    console.error("[people] linkedin search failed:", (e as Error).message);
  }

  const { client, model } = llm();
  const res = await complete({
      model,
      max_tokens: 4000,
      tools: [CARD_TOOL],
      system: `You pick the right people to reach in a community for an organizer's program, connectors first (people who run programs, schools, newsletters, youth groups, or lead the org). Use only the public information given. Skip people who look unrelated or far away. Never infer or mention religion, ethnicity, health, family or other sensitive traits about a person; refer only to their public role. Openers are written as the organizer, personal and short, with no pitch.`,
      messages: [
        {
          role: "user",
          content: `ORGANIZER: ${event.organizerName} (${event.organization}) · PROGRAM: ${event.name} · AUDIENCE: ${event.audience ?? "?"}
COMMUNITY: ${t.name}
RESEARCH: ${research.summary ?? ""}
NEEDS: ${(research.needs ?? []).join("; ")}
WAY IN (from public sources): ${research.howIn ?? ""}

LINKEDIN RESULTS (public):
${people.map((p) => `- ${p.fullName} | ${p.headline ?? ""} | ${p.location ?? ""} | ${p.profileUrl ?? ""} | handle: ${p.publicIdentifier ?? ""}`).join("\n") || "(none)"}

Pick up to 5 people (include people named in WAY IN if they fit), connectors first.`,
        },
      ],
    });
  const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const picked = ((use?.input as { people?: Record<string, string>[] })?.people ?? []).slice(0, 5);

  const domain = (research.sources ?? []).map((s) => { try { return new URL(s).hostname.replace(/^www\./, ""); } catch { return ""; } })
    .find((h) => h && !/linkedin|facebook|instagram|google|youtube|wikipedia|eventbrite/.test(h));

  let n = 0;
  for (const p of picked) {
    const channels: Record<string, string> = {};
    if (p.linkedinUrl) channels.linkedin = p.linkedinUrl;
    // Work email for connectors only (public professional address on the org's domain).
    if (p.reach === "connector" && domain && n < 3) {
      try {
        const q: Record<string, unknown> = { domain, full_name: p.name };
        if (p.linkedinHandle) q.linkedin_handle = p.linkedinHandle;
        const r = await monidRun<{ data?: { email?: string; score?: number } }>("hunterio", "/email-finder", { queryParams: q });
        if (r.data?.email && (r.data.score ?? 0) >= 50) channels.email = r.data.email;
      } catch (e) {
        if (!/404/.test((e as Error).message)) console.error("[people] email lookup failed:", (e as Error).message);
      }
    }
    const code = await joinCode(event.keyword, p.name);
    await db.prospect.create({
      data: {
        eventId: event.id,
        targetId: t.id,
        name: p.name,
        role: p.role,
        whyThem: p.whyThem,
        reach: p.reach,
        channels: JSON.stringify(channels),
        research: JSON.stringify({ subject: p.subject, source: p.linkedinUrl ?? "community research" }),
        opener: p.opener,
        joinCode: code,
      },
    });
    n++;
  }
  return n;
}

async function joinCode(keyword: string, name: string): Promise<string> {
  const first = name.split(/\s+/).find((w) => !/^(sheikh|shaykh|imam|dr|br|sr|sister|brother|mr|mrs|ms|prof|ustadh|ustadha)\.?$/i.test(w)) ?? name;
  const base = `${keyword}-${first.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "FRIEND"}`;
  let code = base;
  for (let i = 2; await db.prospect.findUnique({ where: { joinCode: code } }); i++) code = `${base}${i}`;
  return code;
}
