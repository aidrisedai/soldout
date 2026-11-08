import Link from "next/link";

const STEPS = [
  { n: "1", title: "Set the goal", body: "Seats, deadline, price and your own program content. That's all SoldOut needs." },
  { n: "2", title: "Get a strategy", body: "A diagnosis, 2–3 guiding policies with tests, and who to reach next, with ready messages." },
  { n: "3", title: "Approve", body: "Nothing goes out until you say so. Communities share your JOIN code with families." },
  { n: "4", title: "Parents opt in", body: "They message JOIN on WhatsApp. SoldOut asks fit questions and answers only from your content." },
  { n: "5", title: "Right format, every time", body: "Text for facts, your videos to show what it's like, a PDF brief to keep and share." },
  { n: "6", title: "You step in only when needed", body: "Refunds, installments, anything unconfirmed comes to you. Paid seats tick up on the scoreboard." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-16 md:pt-24">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">SoldOut</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Fill every seat of your program through the communities families already trust.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-zinc-600">
          Tell SoldOut your goal. It plans the campaign, gets messengers to share your JOIN code, talks to every parent on
          WhatsApp using only your content, and hands them the enrollment link when they&apos;re ready.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/intake" className="rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white hover:bg-zinc-800">
            Start a campaign →
          </Link>
          <Link href="/dashboard" className="rounded-lg border px-5 py-3 font-semibold hover:bg-zinc-50">
            Dashboard
          </Link>
        </div>
      </section>

      <section className="border-t bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-bold">From goal to paid seats</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">{s.n}</div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-bold">Rules SoldOut never breaks</h2>
        <ul className="mt-4 grid gap-2 text-zinc-700 sm:grid-cols-2">
          <li>✓ Only contacts people who opted in by messaging JOIN</li>
          <li>✓ Never scrapes numbers or uses school lists</li>
          <li>✓ Answers only from the organizer&apos;s own content</li>
          <li>✓ Never invents facts, stats, quotes or testimonials</li>
          <li>✓ Refunds and installments always go to the organizer</li>
          <li>✓ Organizer approves the strategy before anyone is contacted</li>
        </ul>
        <p className="mt-10 text-sm text-zinc-500">
          First customer: EdAI&apos;s Founder program · Built with Claude via Naive, Mobilerun and Monid ·{" "}
          <Link href="/simulate" className="underline">Simulate a parent</Link>
        </p>
      </section>
    </main>
  );
}
