import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markFailed, researchTarget } from "@/lib/research";

export const maxDuration = 120;

// Retry research for one community.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.target.update({ where: { id }, data: { reason: null } });
  const event = await db.event.findUniqueOrThrow({ where: { id: t.eventId } });
  try {
    await researchTarget(event, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    await markFailed(id, e);
    return NextResponse.json({ error: "Research failed again. Try once more in a minute." }, { status: 502 });
  }
}
