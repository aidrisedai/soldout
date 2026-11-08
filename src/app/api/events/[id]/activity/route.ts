import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Item = { at: string; kind: string; text: string };

// A plain-English timeline of what SoldOut has done for this campaign.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [strategies, targets, prospects, outcomes, media] = await Promise.all([
    db.strategy.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.target.findMany({ where: { eventId: id }, orderBy: { updatedAt: "desc" }, take: 12 }),
    db.prospect.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 12 }),
    db.outcome.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.mediaItem.findMany({ where: { eventId: id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const touches = await db.touch.findMany({ where: { prospectId: { in: prospects.map((p) => p.id) } }, orderBy: { createdAt: "desc" }, take: 12 });
  const name = new Map(prospects.map((p) => [p.id, p.name]));
  const items: Item[] = [];
  for (const s of strategies) {
    items.push({ at: s.createdAt.toISOString(), kind: "strategy", text: "Drafted the strategy: diagnosis, guiding policies and tests" });
    if (s.approvedAt) items.push({ at: s.approvedAt.toISOString(), kind: "strategy", text: "Approved the strategy and started community research" });
  }
  for (const t of targets) {
    if (t.fitScore !== null) items.push({ at: t.updatedAt.toISOString(), kind: t.decision === "go" ? "go" : "nogo", text: `Researched ${t.name}: fit ${t.fitScore}, ${t.decision === "go" ? "GO" : "NO-GO"}` });
    else if (t.reason) items.push({ at: t.updatedAt.toISOString(), kind: "warn", text: `Research on ${t.name} didn’t finish; retrying` });
    else items.push({ at: t.createdAt.toISOString(), kind: "research", text: `Queued ${t.name} for research` });
  }
  for (const p of prospects) items.push({ at: p.createdAt.toISOString(), kind: "person", text: `Found ${p.name}${p.role ? `, ${p.role}` : ""}` });
  for (const t of touches) {
    const who = name.get(t.prospectId) ?? "a connector";
    if (t.direction === "in") items.push({ at: t.createdAt.toISOString(), kind: "reply", text: `${who} replied by ${t.channel}` });
    else if (t.status === "sent") items.push({ at: t.createdAt.toISOString(), kind: "sent", text: `${t.author === "organizer" ? "You wrote to" : "Sent a message to"} ${who} by ${t.channel}` });
    else items.push({ at: t.createdAt.toISOString(), kind: "ready", text: `Prepared a ${t.channel === "intro" ? "warm-intro" : t.channel} message for ${who}` });
  }
  const label: Record<string, string> = {
    opted_in: "A parent texted JOIN", answered: "Answered a parent’s question from your content", clip_sent: "Sent a parent a video or PDF",
    link_sent: "Sent a parent the enrollment link", paid: "A seat was paid", needs_organizer: "Flagged a parent question for you",
    routed_builder: "Pointed a family to the better-fit program", opted_out: "A parent opted out",
  };
  for (const o of outcomes) items.push({ at: o.createdAt.toISOString(), kind: o.type, text: label[o.type] ?? o.type });
  for (const m of media) items.push({ at: m.createdAt.toISOString(), kind: "media", text: `Found “${m.title}” in your Drive` });
  items.sort((a, b) => b.at.localeCompare(a.at));
  return NextResponse.json({ items: items.slice(0, 20) });
}
