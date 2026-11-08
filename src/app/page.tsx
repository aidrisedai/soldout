import Link from "next/link";

const CHANNELS = ["WhatsApp", "Email", "LinkedIn", "Instagram", "SMS", "Newsletters", "In person"];

const STEPS = [
  {
    n: "01",
    title: "Tell it the goal",
    body: "Seats, deadline, price, and the program content you already have. FAQ, brochure, videos in your Drive.",
  },
  {
    n: "02",
    title: "It does the research",
    body: "SoldOut maps the communities your families already trust (schools, masjids, youth groups, newsletters) and the messenger in each one.",
  },
  {
    n: "03",
    title: "It picks the best channel",
    body: "For every messenger it chooses how to reach them: email, WhatsApp, LinkedIn, Instagram or a visit. It drafts the exact message.",
  },
  {
    n: "04",
    title: "You approve",
    body: "Nothing goes out until you say so. Messengers share your JOIN code; families opt in on their own.",
  },
  {
    n: "05",
    title: "It runs every conversation",
    body: "Fit questions, answers from your content only, and the right format each time: a quick reply, your video, or a PDF they can keep.",
  },
  {
    n: "06",
    title: "Seats fill, it learns",
    body: "Links sent, seats paid, which community converts. Questions only you can answer come to you; the strategy updates from what works.",
  },
];

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 flex-none text-emerald-500" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      {/* HERO */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <span className="text-lg font-black tracking-tight">
            Sold<span className="text-emerald-400">Out</span>
          </span>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-zinc-300 hover:text-white">Dashboard</Link>
            <Link href="/intake" className="rounded-lg bg-white px-4 py-2 font-semibold text-zinc-900 hover:bg-zinc-200">Start a campaign</Link>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-28 pt-8 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> AI campaign engine for in-person programs
            </p>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Set the goal.
              <br />
              <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">We fill the seats.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
              SoldOut finds the communities your families already trust, works out the best way to reach each messenger,
              and turns every interested parent into a paid seat, answering only from your own content.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/intake" className="rounded-xl bg-emerald-500 px-6 py-3.5 font-bold text-zinc-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400">
                Start a campaign →
              </Link>
              <a href="#how" className="rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-white hover:bg-white/5">
                See how it works
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {CHANNELS.map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">{c}</span>
              ))}
            </div>
          </div>

          {/* Campaign preview (illustration) */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Campaign</p>
                  <p className="font-semibold">Founder program · 20 seats · Nov 15</p>
                </div>
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">Live</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-zinc-800"><div className="h-2 w-[35%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-300" /></div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                {[["Messengers", "Approved"], ["Families", "Opted in"], ["Seats", "Paid"]].map(([a, b]) => (
                  <div key={a} className="rounded-lg bg-zinc-800/70 p-3">
                    <p className="text-sm font-semibold">{a}</p>
                    <p className="text-[11px] text-zinc-500">{b}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2 text-sm">
                <p className="text-xs uppercase tracking-wider text-zinc-500">Who next</p>
                {[
                  ["Masjid youth director", "Email", "Ready"],
                  ["Islamic school newsletter", "Email", "Ready"],
                  ["Youth group admin", "WhatsApp", "Sent"],
                ].map(([who, ch, st]) => (
                  <div key={who} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                    <span>{who}</span>
                    <span className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">{ch}</span>
                      <span className={st === "Sent" ? "text-emerald-300" : "text-amber-300"}>{st}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-16 -left-6 hidden w-64 rounded-2xl border border-white/10 bg-white p-3 text-sm text-zinc-900 shadow-2xl sm:block">
              <p className="rounded-xl rounded-br-sm bg-emerald-100 px-3 py-2">Can I see what students actually do?</p>
              <p className="mt-2 rounded-xl rounded-bl-sm bg-zinc-100 px-3 py-2">Here&apos;s a 1-minute video from the program 🎬</p>
            </div>
            <p className="mt-24 text-center text-[11px] text-zinc-600 sm:text-right">Illustration</p>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-10 lg:grid-cols-2">
          <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            Families don&apos;t buy from ads.
            <br />
            They buy when someone they trust says <span className="text-emerald-600">&ldquo;this is good.&rdquo;</span>
          </h2>
          <div className="space-y-4 text-lg text-zinc-600">
            <p>
              Organizers know this, so they spend their nights on WhatsApp groups, emails to schools, and the same parent
              questions over and over. Seats still sit empty a week before launch.
            </p>
            <p className="font-semibold text-zinc-900">
              SoldOut does that work: the research, the outreach plan, every conversation, and the follow-up. You stay in charge.
            </p>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="bg-zinc-50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">How it works</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">From goal to paid seats</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="group rounded-2xl border border-zinc-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
                <p className="font-mono text-sm font-bold text-emerald-600">{s.n}</p>
                <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STRATEGY EXAMPLE */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-600">Real strategy, not a template</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">It tells you what&apos;s actually in the way</h2>
            <p className="mt-4 text-lg text-zinc-600">
              Every campaign starts with a diagnosis, a few guiding policies, and a cheap test for each one, so you know what to
              try first and how you&apos;ll know it worked.
            </p>
            <ul className="mt-6 space-y-3 text-zinc-700">
              <li className="flex gap-3"><Check /> A who-next list of communities and messengers, with the channel and message for each</li>
              <li className="flex gap-3"><Check /> Answers grounded only in your content; unknowns come to you</li>
              <li className="flex gap-3"><Check /> The right format per question: text, your videos, or a PDF brief</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Diagnosis · EdAI Founder campaign</p>
            <p className="mt-2 text-zinc-800">
              Founder only works for students who already have a first version of a product, a much smaller group than
              &ldquo;parents of Muslim students in grades 6–12.&rdquo; A general campaign will mostly reach families who belong
              in Builder.
            </p>
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Guiding policy</p>
            <p className="mt-2 font-semibold">Go where products have already been built: past cohorts and summit communities.</p>
            <p className="mt-1 text-sm text-zinc-500">Test: partners share the JOIN code; success = opt-ins who already have a product.</p>
            <p className="mt-5 text-xs font-bold uppercase tracking-wider text-zinc-500">Who next</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {["MAPS Redmond · youth coordinator · Email", "Seattle youth partner · director · WhatsApp", "School newsletter · editor · Email"].map((w) => (
                <span key={w} className="rounded-lg bg-zinc-100 px-2.5 py-1">{w}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="bg-zinc-950 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Trust is the whole point, so we protect it</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Opt-in only", "Families are contacted only after they message your JOIN code. No scraped numbers, no school lists."],
              ["Your words, no inventions", "Answers come only from your content. No made-up stats, quotes or testimonials, ever."],
              ["You approve first", "The strategy and every outreach message wait for your approval before anything is sent."],
              ["Sensitive topics go to you", "Refunds, installments and anything unconfirmed are flagged for you to answer."],
              ["Messengers, not strangers", "Research covers communities and the people who speak for them, never private individuals."],
              ["Payments stay safe", "Payment links run in test mode until you switch them on."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-bold text-emerald-300">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <h2 className="text-3xl font-black tracking-tight sm:text-5xl">Your next cohort, sold out.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-600">Five minutes to set the goal. SoldOut takes it from there.</p>
        <Link href="/intake" className="mt-8 inline-block rounded-xl bg-zinc-900 px-8 py-4 font-bold text-white hover:bg-zinc-800">
          Start a campaign →
        </Link>
        <p className="mt-12 text-sm text-zinc-400">First campaign: EdAI Founder program · Powered by Claude on Naive, Mobilerun and Monid</p>
      </section>
    </main>
  );
}
