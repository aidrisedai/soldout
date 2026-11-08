import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// First customer: EdAI's November 15 cohort. All facts come from content/edai-answer-pack.md.
async function main() {
  const content = readFileSync(join(process.cwd(), "content/edai-answer-pack.md"), "utf8");
  const fitQuestions = [
    { key: "teens", question: "How many teens are you thinking of signing up, and what grade is each one in?" },
    { key: "built", question: "Has your teen already built something, like an app, website or tool, even a rough first version?" },
    { key: "what_built", question: "If yes: what did they build, and who is it for? (If they haven't built anything yet, record 'n/a - not built yet' without asking.)" },
    { key: "schedule", question: "Sessions are live online on Sundays for 12 weeks starting Nov 15 (Founder 8:30-10:00 AM Pacific, Builder 10:30 AM-12:00 PM Pacific). Does that time work for your family?" },
  ];
  const data = {
    name: "EdAI Founder (12 weeks from Nov 15)",
    organizerName: "Dr. Azeez Idris",
    organization: "EdAI",
    goalSeats: null,
    deadline: "2026-11-15",
    price: "$1,200 per student",
    dateText: "Sundays for 12 weeks from Nov 15, 2026 (Founder 8:30-10:00 AM PT)",
    place: "Online, live sessions",
    audience: "Muslim students in grades 6-12 and their parents",
    applyLink: "https://edai.fun/apply",
    paymentLink: process.env.STRIPE_PAYMENT_LINK ?? null,
    content,
    fitQuestions: JSON.stringify(fitQuestions),
    clips: "[]",
  };
  const ev = await db.event.upsert({ where: { keyword: "EDAI" }, create: { keyword: "EDAI", ...data }, update: data });
  console.log(`Seeded event ${ev.name} (keyword JOIN ${ev.keyword}, id ${ev.id})`);
}

main().finally(() => db.$disconnect());
