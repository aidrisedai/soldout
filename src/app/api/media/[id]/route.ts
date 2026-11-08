import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncApprovedClips } from "@/lib/dot";

// Organizer approves or rejects a video before the agent may send it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== "approved" && status !== "rejected") return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 });
  const m = await db.mediaItem.update({ where: { id }, data: { status } });
  await syncApprovedClips(m.eventId);
  return NextResponse.json({ ok: true });
}
