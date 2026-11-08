import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [prospects, busy] = await Promise.all([
    db.prospect.findMany({ where: { eventId: id }, orderBy: [{ reach: "asc" }, { createdAt: "asc" }] }),
    db.kV.findMany({ where: { key: { startsWith: "people:" }, value: "1" } }),
  ]);
  const touches = await db.touch.findMany({ where: { prospectId: { in: prospects.map((p) => p.id) } }, orderBy: { createdAt: "asc" } });
  const referred = await db.contact.groupBy({ by: ["referredBy"], where: { eventId: id, referredBy: { not: null } }, _count: true });
  const refCount = new Map(referred.map((r) => [r.referredBy, r._count]));
  return NextResponse.json({
    searching: busy.map((b) => b.key.slice(7)),
    prospects: prospects.map((p) => ({
      ...p,
      channels: JSON.parse(p.channels),
      research: p.research ? JSON.parse(p.research) : null,
      touches: touches.filter((t) => t.prospectId === p.id),
      broughtIn: refCount.get(p.joinCode) ?? 0,
    })),
  });
}
