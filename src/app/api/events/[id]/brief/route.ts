import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createBrief } from "@/lib/brief";

export const maxDuration = 120;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const brief = await db.brief.findFirst({ where: { eventId: id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ brief: brief ? { ...brief, body: JSON.parse(brief.body) } : null });
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });
  try {
    const b = await createBrief(event);
    return NextResponse.json({ id: b.id, status: b.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
