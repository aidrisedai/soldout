import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deliver } from "@/lib/inbound";

// The organizer answers a flagged question; the reply goes to the parent on their channel.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reply } = (await req.json().catch(() => ({}))) as { reply?: string };
  if (!reply?.trim()) return NextResponse.json({ error: "reply required" }, { status: 400 });
  const flag = await db.organizerFlag.findUnique({ where: { id }, include: { contact: true, event: true } });
  if (!flag) return NextResponse.json({ error: "flag not found" }, { status: 404 });
  if (flag.contact.status === "opted_out") return NextResponse.json({ error: "contact opted out" }, { status: 409 });
  const r = await deliver(flag.event, flag.contact, `From ${flag.event.organizerName}: ${reply.trim()}`);
  await db.organizerFlag.update({ where: { id }, data: { status: "answered", reply: reply.trim(), resolvedAt: new Date() } });
  return NextResponse.json({ ok: true, delivery: r.status });
}
