import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expandTargets } from "@/lib/research";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const targets = await db.target.findMany({ where: { eventId: id }, orderBy: [{ fitScore: "desc" }, { createdAt: "asc" }] });
  const researching = (await db.kV.findUnique({ where: { key: `researching:${id}` } }))?.value === "1";
  return NextResponse.json({ researching, targets: targets.map((t) => ({ ...t, research: t.research ? JSON.parse(t.research) : null })) });
}

// Turn the approved strategy's policies into researched target communities.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  const strategy = await db.strategy.findFirst({ where: { eventId: id, status: "approved" }, orderBy: { approvedAt: "desc" } });
  if (!event || !strategy) return NextResponse.json({ error: "Approve the strategy first" }, { status: 400 });
  const key = `researching:${id}`;
  await db.kV.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
  void expandTargets(event, strategy)
    .catch((e) => console.error("[targets]", (e as Error).message))
    .finally(() => db.kV.update({ where: { key }, data: { value: "0" } }));
  return NextResponse.json({ ok: true });
}
