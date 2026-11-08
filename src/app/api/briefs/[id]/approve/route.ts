import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.brief.update({ where: { id }, data: { status: "approved", approvedAt: new Date() } });
  return NextResponse.json({ id: b.id, status: b.status });
}
