import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Every parent conversation for a campaign: messages, fit answers, outcomes.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contacts = await db.contact.findMany({
    where: { eventId: id, stage: { notIn: ["organizer", "connector"] }, NOT: { phone: { startsWith: "email:" } } },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, direction: true, body: true, attachment: true, createdAt: true, status: true } },
      fitAnswers: { select: { key: true, question: true, answer: true } },
      outcomes: { orderBy: { createdAt: "asc" }, select: { type: true, createdAt: true } },
    },
    take: 100,
  });
  return NextResponse.json({ parents: contacts });
}
