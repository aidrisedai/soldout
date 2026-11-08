import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const events = await db.event.findMany({ orderBy: { createdAt: "desc" } });
  const data = await Promise.all(
    events.map(async (e) => {
      const count = (type: string) => db.outcome.count({ where: { eventId: e.id, type } });
      const [optIns, answered, linksSent, paid, flagsTotal, steppedIn, flags, ready, strategy] = await Promise.all([
        count("opted_in"),
        count("answered"),
        count("link_sent"),
        count("paid"),
        db.organizerFlag.count({ where: { eventId: e.id } }),
        db.organizerFlag.count({ where: { eventId: e.id, status: "answered" } }),
        db.organizerFlag.findMany({ where: { eventId: e.id, status: "open" }, orderBy: { createdAt: "asc" }, include: { contact: { select: { phone: true, channel: true } } } }),
        db.contact.findMany({ where: { eventId: e.id, stage: "link_sent" }, select: { id: true, phone: true, channel: true, program: true, updatedAt: true } }),
        db.strategy.findFirst({ where: { eventId: e.id }, orderBy: { createdAt: "desc" } }),
      ]);
      return {
        id: e.id,
        name: e.name,
        keyword: e.keyword,
        organization: e.organization,
        organizerName: e.organizerName,
        goalSeats: e.goalSeats,
        deadline: e.deadline,
        price: e.price,
        score: { optIns, answered, linksSent, paid, flagsTotal, steppedIn },
        openFlags: flags,
        awaitingPayment: ready,
        strategy: strategy ? { id: strategy.id, status: strategy.status, body: JSON.parse(strategy.body), createdAt: strategy.createdAt, approvedAt: strategy.approvedAt } : null,
      };
    }),
  );
  return NextResponse.json(data);
}
