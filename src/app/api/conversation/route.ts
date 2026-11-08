import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/event";

// Conversation view for /simulate: messages, fit answers, outcomes, flags for one contact.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const from = url.searchParams.get("from");
  if (!eventId || !from) return NextResponse.json({ error: "eventId and from required" }, { status: 400 });
  const contact = await db.contact.findUnique({
    where: { eventId_phone: { eventId, phone: normalizePhone(from) } },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      fitAnswers: { orderBy: { createdAt: "asc" } },
      outcomes: { orderBy: { createdAt: "asc" } },
      flags: { orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json({ contact });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const eventId = url.searchParams.get("eventId");
  const from = url.searchParams.get("from");
  if (!eventId || !from) return NextResponse.json({ error: "eventId and from required" }, { status: 400 });
  await db.contact.deleteMany({ where: { eventId, phone: normalizePhone(from), channel: "simulate" } });
  return NextResponse.json({ ok: true });
}
