import { NextResponse } from "next/server";
import { z } from "zod";
import { handleInbound } from "@/lib/inbound";
import { CHANNELS } from "@/lib/channels";

const Body = z.object({
  from: z.string().min(1),
  text: z.string().min(1).max(2000),
  eventId: z.string().optional(),
  channel: z.enum(CHANNELS).optional(),
  externalId: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Expected {from, text, eventId?}" }, { status: 400 });
  const result = await handleInbound(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
