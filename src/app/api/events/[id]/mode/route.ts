import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advance } from "@/lib/autopilot";

// approve = organizer approves the strategy and every first message; auto = fully autonomous.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { mode } = (await req.json().catch(() => ({}))) as { mode?: string };
  const e = await db.event.update({ where: { id }, data: { mode: mode === "auto" ? "auto" : "approve" } });
  if (e.autopilot) void advance(id);
  return NextResponse.json({ mode: e.mode });
}
