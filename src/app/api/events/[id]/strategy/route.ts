import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftStrategy } from "@/lib/strategy";

export const maxDuration = 120;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });
  try {
    const body = await draftStrategy(event);
    const s = await db.strategy.create({ data: { eventId: id, body: JSON.stringify(body) } });
    return NextResponse.json({ id: s.id, status: s.status, body });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
