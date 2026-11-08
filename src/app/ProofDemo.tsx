"use client";

import { useEffect, useState } from "react";

// Real output from SoldOut's first campaign (EdAI Founder). Individuals shown by role only.
const STEPS: { tag: string; title: string; body: React.ReactNode }[] = [
  {
    tag: "Goal",
    title: "The organizer sets the goal",
    body: (
      <div className="grid grid-cols-2 gap-2 text-sm">
        {[["Program", "EdAI Founder"], ["Seats", "20"], ["Starts", "Sunday, Nov 15"], ["Tuition", "$1,200"]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-sand/60 p-3"><p className="text-[11px] uppercase text-muted">{k}</p><p className="font-semibold">{v}</p></div>
        ))}
        <div className="col-span-2 rounded-xl bg-sand/60 p-3 text-ink/75">+ the organizer’s own answer pack, videos in Drive, brand files</div>
      </div>
    ),
  },
  {
    tag: "Diagnosis",
    title: "It finds what’s actually in the way",
    body: (
      <p className="leading-relaxed text-ink/85">
        “Founder only works for students who already have a first version of a product, a much smaller group than ‘parents of Muslim students
        in grades 6–12.’ A general campaign will mostly reach families who belong in Builder.”
      </p>
    ),
  },
  {
    tag: "Policy + test",
    title: "Guiding policies with tests, approved on its own",
    body: (
      <div className="space-y-2 text-sm">
        <div className="rounded-xl bg-sand/60 p-3"><p className="font-semibold">Go where products have already been built</p><p className="text-muted">Past cohorts and summit communities, through partners who were already there.</p></div>
        <div className="rounded-lg border border-forest/30 bg-mint/60 p-3 text-forest">Test: partners share the JOIN code. Success = opt-ins who already have a product.</div>
      </div>
    ),
  },
  {
    tag: "Communities",
    title: "It researches each community, then GO / NO-GO",
    body: (
      <div className="space-y-2 text-sm">
        {[["MAPS Redmond", 66, "Large youth program (ages 13–18) across Greater Seattle; Director of Education named for teen programs."], ["Five Before College", 70, "Admissions coaching for Muslim teens; founder reachable for a newsletter feature."], ["PACE Academy WA", 52, "Islamic K–10 school in Redmond; principal reachable by email."]].map(([n, s, d]) => (
          <div key={n as string} className="flex items-start justify-between gap-3 rounded-xl bg-sand/60 p-3">
            <div><p className="font-semibold">{n}</p><p className="text-xs text-muted">{d}</p></div>
            <span className="whitespace-nowrap rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-forest">fit {s} · GO</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "People",
    title: "It finds the connectors in each GO community",
    body: (
      <div className="space-y-2 text-sm">
        {[["Director of Education", "Warm intro", "Leads teen education programs"], ["Community Organizer", "LinkedIn", "Knows which families and programs are active"], ["Educator & developer", "LinkedIn", "Links youth programs with tech careers"]].map(([r, c, w]) => (
          <div key={r} className="flex items-center justify-between rounded-xl bg-sand/60 p-3">
            <div><p className="font-semibold">{r} <span className="ml-1 rounded bg-mustard/40 px-1.5 text-[10px] font-bold uppercase text-night">connector</span></p><p className="text-xs text-muted">{w}</p></div>
            <span className="rounded bg-sand px-2 py-0.5 text-xs">{c}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: "Opener",
    title: "A personal first message, sent on its own",
    body: (
      <div className="rounded-2xl border border-line bg-paper p-4 text-sm text-ink">
        <p className="text-[11px] font-semibold text-muted">To: Community Organizer · sent by SoldOut on autopilot</p>
        <p className="mt-2">“Hi, I’m Azeez. I’ve admired how MAPS brings families in from across the Puget Sound region. When a youth event draws a crowd, someone is doing serious organizing behind it. I’d love to hear what’s working well for you this season. What do families respond to most when it comes to the teen events?”</p>
      </div>
    ),
  },
  {
    tag: "Conversation",
    title: "A real conversation: share more only as interest grows",
    body: (
      <div className="space-y-2 text-sm">
        <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-sand px-3 py-2">“Nothing too crazy at this point.”</p>
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-mint px-3 py-2 text-ink">“Honestly, a quiet season is pretty normal. Something that’s been working for us is giving teens a real problem to work on… Do you have any teens who like tech?”</p>
        <p className="text-xs text-muted">Next: PDF when they want details → “who do you know who’d love this?” → their own JOIN code to forward.</p>
      </div>
    ),
  },
  {
    tag: "Parents",
    title: "Families opt in and get the right format",
    body: (
      <div className="space-y-2 text-sm">
        <p className="ml-auto max-w-[70%] rounded-2xl rounded-br-sm bg-paper px-3 py-2 text-right border border-line">JOIN FOUNDER</p>
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-mint px-3 py-2 text-ink">Fit questions, one at a time → “10th grader, built a study planner about 20 classmates use” → <b>Founder</b></p>
        <p className="ml-auto max-w-[70%] rounded-2xl rounded-br-sm bg-paper px-3 py-2 text-right border border-line">Can I see what students do?</p>
        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-mint px-3 py-2 text-ink">🎬 <b>Video</b> from the organizer’s Drive · later 📄 <b>PDF brief</b> to share at home</p>
      </div>
    ),
  },
  {
    tag: "Organizer",
    title: "Only refunds and installments go to the organizer",
    body: (
      <div className="space-y-2 text-sm">
        <div className="rounded-lg border border-clay/30 bg-clay/10 p-3 text-clay-dark">Flagged: “Do you offer refunds if it doesn’t work out?”</div>
        <div className="rounded-xl bg-sand/60 p-3 text-ink/85">Everything else runs on its own. One switch stops the whole campaign at any time.</div>
      </div>
    ),
  },
  {
    tag: "Paid",
    title: "Enrollment link, paid seat, scoreboard",
    body: (
      <div className="text-sm">
        <div className="flex items-end justify-between"><p className="font-display text-5xl">1<span className="text-xl text-muted">/20</span></p><p className="text-muted">seats paid · need 1.3/day</p></div>
        <div className="mt-3 h-2 rounded-full bg-sand"><div className="h-2 w-[5%] rounded-full bg-forest" /></div>
        <p className="mt-3 text-ink/75">Results by community, connector and channel decide what to try next. Then back to the strategy.</p>
      </div>
    ),
  },
];

export default function ProofDemo() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [i, paused]);
  const s = STEPS[i];
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
        {STEPS.map((x, k) => (
          <li key={x.tag}>
            <button onClick={() => setI(k)} className={`flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${k === i ? "bg-sand font-semibold text-ink" : "text-muted hover:text-ink/85"}`}>
              <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${k < i ? "bg-forest text-white" : k === i ? "bg-clay text-white" : "bg-sand"}`}>{k < i ? "✓" : String.fromCharCode(65 + k)}</span>
              {x.tag}
            </button>
          </li>
        ))}
      </ol>
      <div className="relative min-h-[340px] overflow-hidden rounded-3xl border border-line bg-paper p-6 shadow-[0_20px_60px_-30px_rgba(30,42,36,0.35)]">
        <div className="absolute left-0 top-0 h-1 bg-clay transition-all duration-300" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-clay">STEP {String.fromCharCode(65 + i)} · {s.tag.toUpperCase()}</p>
        <h3 className="font-display mt-2 text-3xl">{s.title}</h3>
        <div key={i} className="mt-5 animate-[fadein_.4s_ease]">{s.body}</div>
        <div className="mt-6 flex items-center justify-between text-xs text-muted">
          <span>Real output from SoldOut’s first campaign. People shown by role only.</span>
          <span>{paused ? "Paused" : "Auto-playing"}</span>
        </div>
      </div>
    </div>
  );
}
