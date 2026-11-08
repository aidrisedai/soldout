import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Manual "mark paid" until payment webhooks are wired.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.contact.update({ where: { id }, data: { stage: "paid" } });
  await db.outcome.create({ data: { eventId: c.eventId, contactId: c.id, type: "paid", detail: "marked by organizer" } });
  return NextResponse.json({ ok: true });
}
