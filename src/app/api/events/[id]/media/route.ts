import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { askDotForVideos } from "@/lib/dot";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [items, task] = await Promise.all([
    db.mediaItem.findMany({ where: { eventId: id }, orderBy: { createdAt: "asc" } }),
    db.dotTask.findFirst({ where: { eventId: id }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ items, task });
}

// Ask Dot (ChatGPT on the Mobilerun phone) to find and share videos from Drive.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "event not found" }, { status: 404 });
  const running = await db.dotTask.findFirst({ where: { status: "running" } });
  if (running) return NextResponse.json({ error: "Dot is already working on a request" }, { status: 409 });
  try {
    const jobId = await askDotForVideos(event);
    return NextResponse.json({ ok: true, jobId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
