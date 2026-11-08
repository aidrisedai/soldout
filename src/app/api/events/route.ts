import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const events = await db.event.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, keyword: true, organization: true } });
  return NextResponse.json(events);
}
