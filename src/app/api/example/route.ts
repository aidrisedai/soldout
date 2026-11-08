import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";

// Prefill for the intake demo: EdAI's real answer pack and offer details.
export async function GET() {
  const content = readFileSync(join(process.cwd(), "content/edai-answer-pack.md"), "utf8");
  return NextResponse.json({
    organizerName: "Dr. Azeez Idris",
    organization: "EdAI",
    name: "EdAI Founder (12 weeks from Nov 15)",
    goalSeats: "20",
    deadline: "2026-11-15",
    price: "$1,200 per student",
    dateText: "Sundays 8:30-10:00 AM PT, 12 weeks from Nov 15",
    place: "Online, live sessions",
    audience: "Parents of Muslim students in grades 6-12",
    applyLink: "https://edai.fun/apply",
    paymentLink: process.env.STRIPE_PAYMENT_LINK ?? "",
    keyword: "FOUNDER",
    acctEmail: process.env.AGENTMAIL_INBOX_ID ?? "",
    content,
    fitQuestions: [
      "How many teens are you thinking of signing up, and what grade is each one in?",
      "Has your teen already built something, like an app, website or tool, even a rough first version?",
      "If yes: what did they build, and who is it for? (If nothing built yet, record 'n/a - not built yet' without asking.)",
      "Sessions are live online on Sundays for 12 weeks starting Nov 15 (Founder 8:30-10:00 AM PT, Builder 10:30 AM-12:00 PM PT). Does that time work for your family?",
    ].join("\n"),
  });
}
