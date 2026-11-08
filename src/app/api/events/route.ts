import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { draftFitQuestions, parseClipLines, parseFitLines, uniqueKeyword } from "@/lib/intake";
import { draftStrategy } from "@/lib/strategy";
import { askDot } from "@/lib/dot";
import { advance } from "@/lib/autopilot";
import { parseContacts, saveOrganizerContacts } from "@/lib/contacts";

export const maxDuration = 120;

export async function GET() {
  const events = await db.event.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, keyword: true, organization: true } });
  return NextResponse.json(events);
}

const TEXT_EXT = /\.(md|markdown|txt|csv|json|html?)$/i;

// /intake submits multipart form data. Each submission becomes its own event.
export async function POST(req: Request) {
  const form = await req.formData();
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const required = ["organizerName", "organization", "name"];
  const missing = required.filter((k) => !s(k));

  let content = s("content");
  const skipped: string[] = [];
  for (const f of form.getAll("files")) {
    if (typeof f === "string" || !f.size) continue;
    if (!TEXT_EXT.test(f.name)) { skipped.push(f.name); continue; }
    content += `\n\n# File: ${f.name}\n\n${await f.text()}`;
  }
  content = content.trim();
  if (!content) missing.push("content");
  // Payments stay in Stripe test mode until the organizer says otherwise.
  const pay = s("paymentLink");
  if (pay && /stripe\.com/i.test(pay) && !/\/test_/i.test(pay) && process.env.STRIPE_LIVE_OK !== "1") {
    return NextResponse.json({ error: "Payment link must be a Stripe TEST link (buy.stripe.com/test_...) for now." }, { status: 400 });
  }
  if (missing.length) return NextResponse.json({ error: `Missing: ${missing.join(", ")}`, skipped }, { status: 400 });

  const fit = s("fitQuestions") ? parseFitLines(s("fitQuestions")) : await draftFitQuestions(content, s("audience"));
  const seats = parseInt(s("goalSeats"), 10);
  const event = await db.event.create({
    data: {
      keyword: await uniqueKeyword(s("keyword") || s("organization")),
      name: s("name"),
      organizerName: s("organizerName"),
      organization: s("organization"),
      goalSeats: Number.isFinite(seats) ? seats : null,
      deadline: s("deadline") || null,
      price: s("price") || null,
      dateText: s("dateText") || null,
      place: s("place") || null,
      audience: s("audience") || null,
      applyLink: s("applyLink") || null,
      paymentLink: s("paymentLink") || null,
      content,
      fitQuestions: JSON.stringify(fit),
      clips: JSON.stringify(parseClipLines(s("clips"))),
      mode: s("mode") === "auto" ? "auto" : "approve",
      accounts: JSON.stringify({ linkedin: s("acctLinkedin") || undefined, instagram: s("acctInstagram") || undefined, email: s("acctEmail") || undefined }),
    },
  });
  // The organizer's own (consented) contacts: reached directly once the campaign starts.
  if (s("peopleConsent") === "yes" && s("people")) await saveOrganizerContacts(event.id, event.keyword, parseContacts(s("people")));
  // Organizer's network for warm intros: "Name | how you know them | community | contact" per line.
  for (const line of s("network").split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [name, relationship, community, contact] = line.split("|").map((x) => x?.trim() || undefined);
    if (name) await db.networkContact.create({ data: { eventId: event.id, name, relationship, community, contact } });
  }
  // SoldOut takes over from the goal: start drafting the strategy right away.
  void draftStrategy(event)
    .then((body) => db.strategy.create({ data: { eventId: event.id, body: JSON.stringify(body) } }))
    .then(() => advance(event.id)) // autopilot: approve and move on without waiting for a human
    .catch((e) => console.error("[strategy] auto-draft failed:", (e as Error).message));
  // ...and build the video library from the organizer's Drive in the background.
  if (process.env.MOBILERUN_API_KEY && process.env.AUTO_MEDIA !== "0") {
    void askDot(event, "find_videos").catch((e) => console.error("[media] auto-find failed:", (e as Error).message));
  }
  return NextResponse.json({ id: event.id, keyword: event.keyword, fitQuestions: fit, skipped });
}
