import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Organizer approval gate: nothing in who-next may be sent before this.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await db.strategy.update({ where: { id }, data: { status: "approved", approvedAt: new Date() } });
  return NextResponse.json({ id: s.id, status: s.status, approvedAt: s.approvedAt });
}
