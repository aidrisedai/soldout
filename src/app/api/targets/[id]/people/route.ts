import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findPeople } from "@/lib/prospects";

export const maxDuration = 300;

// Find people to reach in a GO community.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.target.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  const event = await db.event.findUniqueOrThrow({ where: { id: t.eventId } });
  const key = `people:${id}`;
  await db.kV.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
  void findPeople(event, id)
    .catch((e) => console.error("[people]", (e as Error).message))
    .finally(() => db.kV.update({ where: { key }, data: { value: "0" } }));
  return NextResponse.json({ ok: true });
}
