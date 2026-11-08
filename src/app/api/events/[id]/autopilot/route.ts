import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { advance } from "@/lib/autopilot";

// The one switch: { on: false } stops everything SoldOut sends for this campaign.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { on } = (await req.json().catch(() => ({}))) as { on?: boolean };
  const e = await db.event.update({ where: { id }, data: { autopilot: !!on } });
  if (e.autopilot) void advance(id);
  return NextResponse.json({ autopilot: e.autopilot });
}
