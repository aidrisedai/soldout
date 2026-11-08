import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approveAndSend, organizerReply } from "@/lib/connector";

// Actions on a person: approve (send opener), edit opener, take over / hand back, reply personally, skip.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; opener?: string; text?: string };
  try {
    switch (body.action) {
      case "approve":
        return NextResponse.json(await approveAndSend(id));
      case "edit":
        await db.prospect.update({ where: { id }, data: { opener: body.opener ?? "" } });
        return NextResponse.json({ ok: true });
      case "takeover":
        await db.prospect.update({ where: { id }, data: { aiPaused: true } });
        return NextResponse.json({ ok: true });
      case "handback":
        await db.prospect.update({ where: { id }, data: { aiPaused: false } });
        return NextResponse.json({ ok: true });
      case "reply":
        if (!body.text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
        await organizerReply(id, body.text.trim());
        return NextResponse.json({ ok: true });
      case "linkedin_sent":
        await db.touch.updateMany({ where: { prospectId: id, channel: { in: ["linkedin", "intro"] }, status: "approved" }, data: { status: "sent" } });
        await db.prospect.update({ where: { id }, data: { status: "contacted" } });
        return NextResponse.json({ ok: true });
      case "skip":
        await db.prospect.update({ where: { id }, data: { status: "done" } });
        return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
