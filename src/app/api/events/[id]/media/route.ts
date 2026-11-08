import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { askDot, type DotJobKind } from "@/lib/dot";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [items, task] = await Promise.all([
    db.mediaItem.findMany({ where: { eventId: id }, orderBy: { createdAt: "asc" } }),
    db.dotTask.findFirst({ where: { eventId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ items, task });
}

// Find (or make) media from the organizer's Drive.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });
  const running = await db.dotTask.findFirst({ where: { status: "running" } });
  if (running) return NextResponse.json({ error: "Already working on a media request" }, { status: 409 });
  try {
    const { kind } = (await req.json().catch(() => ({}))) as { kind?: DotJobKind };
    const k: DotJobKind = kind === "make_pdf" || kind === "make_video" ? kind : "find_videos";
    const jobId = await askDot(event, k);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
