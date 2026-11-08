import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Stripe webhook (test mode): checkout.session.completed → the parent whose id rode along as
// client_reference_id on the Payment Link is marked paid. Live-mode events are ignored on purpose.
// Signature: header "stripe-signature: t=<ts>,v1=<hex>", HMAC-SHA256 of "<ts>.<raw body>" with the endpoint secret.

function verify(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((p) => p.length === 2));
  const t = parts.t;
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay protection
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  const raw = await req.text();
  if (!verify(raw, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "bad signature" }, { status: 400 });

  const event = JSON.parse(raw) as { type: string; livemode: boolean; data: { object: { client_reference_id?: string | null; amount_total?: number; currency?: string; payment_status?: string } } };
  if (event.livemode) return NextResponse.json({ ignored: "live mode (test mode only until the organizer switches)" });
  if (event.type !== "checkout.session.completed") return NextResponse.json({ ignored: event.type });

  const s = event.data.object;
  const contactId = s.client_reference_id;
  if (!contactId) return NextResponse.json({ ignored: "no client_reference_id" });
  const contact = await db.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ ignored: "unknown contact" });
  if (contact.stage !== "paid") {
    await db.contact.update({ where: { id: contact.id }, data: { stage: "paid" } });
    const amount = s.amount_total != null ? `${(s.amount_total / 100).toFixed(2)} ${(s.currency ?? "").toUpperCase()}` : "";
    await db.outcome.create({ data: { eventId: contact.eventId, contactId: contact.id, type: "paid", detail: `Stripe test payment ${amount}`.trim() } });
  }
  return NextResponse.json({ ok: true });
}
