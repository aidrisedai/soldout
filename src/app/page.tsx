import Link from "next/link";
import Nav from "@/components/Nav";
import ProofDemo from "./ProofDemo";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 flex-none text-forest" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="10" cy="10" r="8.2" />
      <path d="M6.5 10.2l2.3 2.3 4.7-4.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <Nav links={[{ href: "#proof", label: "Watch it work" }, { href: "#how", label: "How it works" }, { href: "#promises", label: "Promises" }, { href: "/dashboard", label: "Dashboard" }]} />

      {/* HERO: headline + the live A-Z demo right away */}
      <section id="proof" className="mx-auto max-w-6xl px-5 pb-20 pt-12 lg:pt-14">
        <div className="grid items-end gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-block -rotate-2 rounded-md border-2 border-clay px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-clay">For in-person youth programs</span>
            <h1 className="font-display mt-6 text-[2.7rem] leading-[1.05] sm:text-6xl">
              Every seat filled by the people families <em className="text-clay">already trust.</em>
            </h1>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-ink/75">
              Set the goal. SoldOut researches the communities your families belong to, reaches the connectors in each one, and talks every
              parent through to the enrollment link, answering only from your own content.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/intake" className="rounded-full bg-clay px-6 py-3.5 font-semibold text-white shadow-sm hover:bg-clay-dark">Start a campaign →</Link>
              <Link href="/simulate" className="rounded-full border-2 border-ink/15 px-6 py-3 font-semibold hover:bg-sand">Simulate a parent</Link>
            </div>
          </div>
        </div>
        <div className="mt-12">
          <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-clay">
            <span className="h-2 w-2 animate-pulse rounded-full bg-clay" /> Watch it work · A to Z, from a real campaign
          </p>
          <ProofDemo />
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="bg-sand/70 py-20">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="font-display text-4xl sm:text-5xl">From goal to paid seats.</h2>
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              ["01", "Set your goal", "Seats, deadline, price and the program content you already have. SoldOut drafts a strategy: what’s in the way, what to try, how to test it."],
              ["02", "Approve the plan", "It researches each community, finds the connectors and drafts a personal message for each. Nothing goes out until you approve."],
              ["03", "Watch seats fill", "Connectors share their JOIN code; parents get answers, videos and a PDF on WhatsApp. Refunds and installments come to you."],
            ].map(([n, t, b]) => (
              <div key={n} className="border-t-2 border-ink/15 pt-6">
                <p className="font-display text-5xl text-clay">{n}</p>
                <h3 className="mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink/70">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONVERSATION + PROMISES */}
      <section id="promises" className="bg-paper/60 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2">
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-line bg-sand/70 p-4">
            <div className="flex items-center gap-3 border-b border-line pb-3">
              <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-clay text-white">E</span>
              <div><p className="text-sm font-bold">EdAI Founder Program</p><p className="text-[11px] text-muted">via SoldOut · answers from EdAI’s content only</p></div>
            </div>
            <div className="space-y-2.5 pt-3 text-[13px]">
              <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-paper px-3 py-2">JOIN FOUNDER</p>
              <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-mint px-3 py-2">Assalamu alaikum! How many teens are you thinking of signing up, and what grade is each one in?</p>
              <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-paper px-3 py-2">One, 10th grade. Can we pay in two parts?</p>
              <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-mint px-3 py-2">
                I’ve passed that to the organizer; they’ll reply here. Meanwhile, here’s the brief to keep.
                <span className="mt-2 flex items-center gap-2 rounded-lg bg-paper px-2.5 py-2 text-xs font-semibold"><span className="rounded bg-clay px-1.5 py-0.5 text-[10px] text-white">PDF</span>Founder Program brief</span>
              </div>
            </div>
          </div>
          <div>
            <h2 className="font-display text-4xl leading-tight sm:text-[2.7rem]">A conversation parents asked for. Rules SoldOut never breaks.</h2>
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {[
                "Messages parents only after they text JOIN",
                "Researches public, professional info only, never anyone’s children",
                "Answers only from your own content",
                "Never invents facts, stats or testimonials",
                "Refunds and installments always go to you",
                "You approve every person and message, and can take over any time",
              ].map((r) => (
                <li key={r} className="flex items-center gap-3 py-3.5 text-[15px]"><Check />{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-night text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-16">
          <h2 className="font-display max-w-xl text-4xl leading-tight sm:text-5xl">How many seats do you need to fill?</h2>
          <Link href="/intake" className="rounded-full bg-mustard px-7 py-4 font-bold text-night hover:brightness-95">Start a campaign →</Link>
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-3 border-t border-white/10 px-5 py-6 text-sm text-white/70">
          <span>First customer: EdAI’s Founder Program</span>
          <span>Built with Claude via Naive, Mobilerun, Monid and AgentMail · <Link href="/simulate" className="underline">Simulate a parent</Link></span>
        </div>
      </section>
    </main>
  );
}
