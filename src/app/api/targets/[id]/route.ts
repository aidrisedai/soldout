import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Organizer sets GO / NO-GO.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { decision } = (await req.json().catch(() => ({}))) as { decision?: string };
  if (decision !== "go" && decision !== "no_go") return NextResponse.json({ error: "decision must be go or no_go" }, { status: 400 });
  const t = await db.target.update({ where: { id }, data: { decision, reason: "set by organizer" } });
  return NextResponse.json({ id: t.id, decision: t.decision });
}
