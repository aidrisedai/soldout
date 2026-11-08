import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expandTargets } from "@/lib/research";

// Organizer approval gate: nothing in who-next may be sent before this.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.strategy.update({ where: { id }, data: { status: "approved", approvedAt: new Date() } });
  // Approval kicks off step 2: research the communities each policy points to.
  const event = await db.event.findUnique({ where: { id: s.eventId } });
  if (event && process.env.MONID_API_KEY) {
    const key = `researching:${event.id}`;
    await db.kV.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
    void expandTargets(event, s)
      .catch((e) => console.error("[targets]", (e as Error).message))
      .finally(() => db.kV.update({ where: { key }, data: { value: "0" } }));
  }
  return NextResponse.json({ id: s.id, status: s.status, approvedAt: s.approvedAt });
}
