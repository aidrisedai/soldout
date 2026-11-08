"use client";

import Link from "next/link";
import { Logo } from "@/components/Nav";
import { useCallback, useEffect, useState } from "react";
import MediaPanel from "./MediaPanel";
import TargetsPanel from "./TargetsPanel";
import PeoplePanel from "./PeoplePanel";
import ActivityPanel from "./ActivityPanel";
import Working from "@/components/Working";

type Strategy = {
  id: string;
  status: "draft" | "approved";
  approvedAt: string | null;
  body: {
    diagnosis: string;
    policies: { policy: string; why: string; test: string }[];
    whoNext: { group: string; messenger: string; channel: string; why: string; message: string }[];
  };
};
type EventRow = {
  id: string;
  name: string;
  keyword: string;
  organization: string;
  organizerName: string;
  goalSeats: number | null;
  deadline: string | null;
  price: string | null;
  dateText: string | null;
  autopilot: boolean;
  score: { optIns: number; answered: number; linksSent: number; paid: number; flagsTotal: number; steppedIn: number };
  pipeline: { targetsTotal: number; targetsGo: number; targetsPending: number; prospects: number; contacted: number; referredParents: number; mediaCount: number };
  openFlags: { id: string; question: string; reason: string; createdAt: string; contact: { phone: string; channel: string } }[];
  awaitingPayment: { id: string; phone: string; channel: string; program: string | null }[];
  strategy: Strategy | null;
};

const TABS = [
  { key: "strategy", label: "Strategy", n: 1 },
  { key: "communities", label: "Communities", n: 2 },
  { key: "people", label: "People", n: 3 },
  { key: "parents", label: "Parents", n: 4 },
  { key: "media", label: "Videos & PDFs", n: 5 },
] as const;
type Tab = (typeof TABS)[number]["key"];

function nextStep(e: EventRow): { text: string; tab: Tab } {
  if (e.autopilot) {
    if (!e.strategy) return { text: "Autopilot: drafting the strategy…", tab: "strategy" };
    if (e.strategy.status === "draft") return { text: "Autopilot: approving the strategy and starting research…", tab: "strategy" };
    if (!e.pipeline.targetsTotal || e.pipeline.targetsPending) return { text: "Autopilot: researching the communities your policies point to…", tab: "communities" };
    if (!e.pipeline.targetsGo) return { text: "Autopilot: no community passed GO yet. Redraft the strategy or set one to GO.", tab: "communities" };
    if (!e.pipeline.prospects) return { text: "Autopilot: finding the connectors in your GO communities…", tab: "people" };
    if (e.openFlags.length) return { text: `Running on its own. ${e.openFlags.length} parent question${e.openFlags.length > 1 ? "s" : ""} only you can answer (refunds, installments).`, tab: "parents" };
    return { text: "Running on its own: reaching connectors and talking to parents. Stop it any time.", tab: "people" };
  }
  if (!e.strategy) return { text: "SoldOut is drafting your strategy (about 30 seconds).", tab: "strategy" };
  if (e.strategy.status === "draft") return { text: "Review the strategy and approve it. Nothing is sent before you do.", tab: "strategy" };
  if (e.openFlags.length) return { text: `${e.openFlags.length} question${e.openFlags.length > 1 ? "s" : ""} from parents need${e.openFlags.length > 1 ? "" : "s"} your answer.`, tab: "parents" };
  if (!e.pipeline.targetsTotal || e.pipeline.targetsPending) return { text: "Researching the communities your policies point to…", tab: "communities" };
  if (!e.pipeline.targetsGo) return { text: "Pick which communities are a GO.", tab: "communities" };
  if (!e.pipeline.prospects) return { text: "Find people in your GO communities.", tab: "people" };
  if (!e.pipeline.contacted) return { text: "Approve the first openers to start conversations.", tab: "people" };
  if (e.awaitingPayment.length) return { text: `${e.awaitingPayment.length} famil${e.awaitingPayment.length > 1 ? "ies have" : "y has"} the enrollment link. Mark paid when they enroll.`, tab: "parents" };
  return { text: "Conversations are running. SoldOut will flag anything that needs you.", tab: "people" };
}

const STRATEGY_STEPS = ["Reading your program content…", "Finding what’s really in the way…", "Writing 2–3 guiding policies…", "Designing a cheap test for each…", "Choosing who to reach first…"];

function rightNow(e: EventRow): { title: string; steps: string[] } | null {
  if (!e.autopilot) return null;
  if (!e.strategy) return { title: "Drafting your strategy", steps: STRATEGY_STEPS };
  if (e.strategy.status === "draft") return { title: "Approving the strategy", steps: ["Checking the plan against your goal…", "Approving it and starting research…"] };
  if (!e.pipeline.targetsTotal || e.pipeline.targetsPending)
    return { title: `Researching communities${e.pipeline.targetsTotal ? ` (${e.pipeline.targetsTotal - e.pipeline.targetsPending}/${e.pipeline.targetsTotal} done)` : ""}`, steps: ["Turning each policy into real communities…", "Searching the web for each one…", "Reading their pages, programs and contacts…", "Scoring fit and deciding GO or NO-GO…"] };
  if (e.pipeline.targetsGo && e.pipeline.prospects === 0) return { title: "Finding connectors", steps: ["Searching LinkedIn inside each GO community…", "Looking up public work emails…", "Writing a personal opener for each person…"] };
  if (e.pipeline.prospects > e.pipeline.contacted) return { title: "Reaching out", steps: ["Emailing openers to connectors (up to 10 a day)…", "Preparing LinkedIn notes and warm intros…", "Watching for replies…"] };
  return null;
}

function daysLeft(deadline: string | null) {
  if (!deadline) return null;
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

export default function Dashboard() {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("strategy");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard");
    const list: EventRow[] = await r.json();
    setEvents(list);
    setSelected((s) => s ?? list[0]?.id ?? null);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(key: string, url: string, body?: unknown) {
    setBusy(key);
    setError("");
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Something went wrong");
    await load();
    setBusy(null);
  }

  const e = events?.find((x) => x.id === selected) ?? null;

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <Logo />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {events && events.length > 1 && (
              <select className="rounded-lg border border-line bg-paper px-2 py-1.5" value={selected ?? ""} onChange={(x) => setSelected(x.target.value)}>
                {events.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <Link href="/simulate" className="rounded-lg px-3 py-1.5 text-ink/75 hover:text-ink">Simulate a parent</Link>
            <Link href="/intake" className="rounded-full bg-clay px-4 py-2 font-semibold text-white hover:bg-clay-dark">+ New campaign</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {events === null && <p className="text-muted">Loading…</p>}
        {events?.length === 0 && (
          <div className="rounded-2xl bg-paper p-12 text-center shadow-sm">
            <p className="font-display text-2xl">No campaigns yet</p>
            <p className="mt-2 text-ink/70">Set a goal and SoldOut takes it from there.</p>
            <Link href="/intake" className="mt-6 inline-block rounded-xl bg-ink px-6 py-3 font-bold text-white">Start a campaign →</Link>
          </div>
        )}

        {e && (() => {
          const s = e.score;
          const left = daysLeft(e.deadline);
          const pct = e.goalSeats ? Math.min(100, Math.round((s.paid / e.goalSeats) * 100)) : 0;
          const perDay = e.goalSeats && left && left > 0 ? Math.max(0, (e.goalSeats - s.paid) / left) : null;
          const next = nextStep(e);
          return (
            <>
              <section className="rounded-2xl bg-paper p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-forest">{e.organization} · campaign</p>
                    <h1 className="mt-1 font-display text-3xl">{e.name}</h1>
                    <p className="mt-1 text-sm text-ink/70">
                      {e.price ?? "Price n/a"}{e.dateText ? ` · ${e.dateText}` : ""} · parents text <code className="rounded bg-cream px-1.5 py-0.5 font-semibold">JOIN {e.keyword}</code>
                    </p>
                  </div>
                  <div className="min-w-[220px] text-right">
                    <button
                      disabled={busy === "ap"}
                      onClick={() => act("ap", `/api/events/${e.id}/autopilot`, { on: !e.autopilot })}
                      className={`mb-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold ${e.autopilot ? "bg-forest text-white" : "bg-clay text-white"}`}
                      title={e.autopilot ? "Stop: SoldOut sends nothing until you turn it back on" : "Turn autopilot back on"}
                    >
                      <span className={`h-2 w-2 rounded-full ${e.autopilot ? "animate-pulse bg-mustard" : "bg-white"}`} />
                      {e.autopilot ? "Autopilot on · Stop" : "Stopped · Resume autopilot"}
                    </button>
                    <p className="text-3xl font-black tabular-nums">{s.paid}<span className="text-lg text-muted">/{e.goalSeats ?? "—"}</span></p>
                    <p className="text-xs text-muted">seats paid{left !== null ? ` · ${left} days left` : ""}</p>
                    <div className="mt-2 h-2 rounded-full bg-cream"><div className="h-2 rounded-full bg-gradient-to-r from-forest to-forest transition-all" style={{ width: `${pct}%` }} /></div>
                    {perDay !== null && <p className="mt-1 text-[11px] text-muted">need {perDay.toFixed(1)} seats/day to hit the goal</p>}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {([
                    ["Communities GO", `${e.pipeline.targetsGo}/${e.pipeline.targetsTotal}`],
                    ["People reached", `${e.pipeline.contacted}/${e.pipeline.prospects}`],
                    ["Parents opted in", s.optIns],
                    ["Questions answered", s.answered],
                    ["Links sent", s.linksSent],
                    ["You stepped in", s.steppedIn],
                  ] as [string, string | number][]).map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-sand/50 px-3 py-2.5">
                      <p className="font-display text-xl tabular-nums">{v}</p>
                      <p className="text-[11px] text-muted">{l}</p>
                    </div>
                  ))}
                </div>
                <ActivityPanel eventId={e.id} now={rightNow(e)} />
                <button onClick={() => setTab(next.tab)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-forest/30 bg-mint/50 px-4 py-3 text-left text-sm hover:bg-mint">
                  <span><b className="text-forest">Next:</b> {next.text}</span>
                  <span className="text-forest">→</span>
                </button>
              </section>

              <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-paper p-1 shadow-sm">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)} className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === t.key ? "bg-ink text-cream" : "text-ink/70 hover:bg-cream"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${tab === t.key ? "bg-mustard text-night" : "bg-sand"}`}>{t.n}</span>
                    {t.label}
                    {t.key === "parents" && e.openFlags.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{e.openFlags.length}</span>}
                  </button>
                ))}
              </nav>

              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

              <section className="mt-4 rounded-2xl bg-paper p-6 shadow-sm">
                {tab === "strategy" && (
                  !e.strategy ? (
                    <div className="mx-auto max-w-lg py-6">
                      <Working title="Drafting your strategy (about 30 seconds)" steps={STRATEGY_STEPS} interval={6000} />
                      <div className="mt-6 space-y-3">
                        {[0, 1, 2].map((k) => <div key={k} className="h-16 animate-pulse rounded-xl bg-sand/70" style={{ animationDelay: `${k * 0.2}s` }} />)}
                      </div>
                      <button disabled={busy === "s"} onClick={() => act("s", `/api/events/${e.id}/strategy`)} className="mt-4 text-xs text-muted underline">Taking long? Draft again</button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-display text-xl">The strategy</h2>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.strategy.status === "approved" ? "bg-mint text-forest" : "bg-amber-100 text-amber-800"}`}>
                            {e.strategy.status === "approved" ? "Approved" : "Draft, waiting for you"}
                          </span>
                          <button disabled={busy === "s"} onClick={() => act("s", `/api/events/${e.id}/strategy`)} className="rounded-lg border px-2.5 py-1 text-xs hover:bg-sand/50 disabled:opacity-50">{busy === "s" ? "Redrafting (about 30s)…" : "Redraft"}</button>
                        </div>
                      </div>
                      <div className="rounded-xl bg-night p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-wider text-mustard">Diagnosis</p>
                        <p className="mt-2 leading-relaxed text-cream">{e.strategy.body.diagnosis}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted">Guiding policies</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          {e.strategy.body.policies.map((p, i) => (
                            <div key={i} className="rounded-xl border p-4">
                              <p className="font-mono text-xs font-bold text-forest">0{i + 1}</p>
                              <p className="mt-1 font-semibold leading-snug">{p.policy}</p>
                              <p className="mt-2 text-sm text-ink/70">{p.why}</p>
                              <p className="mt-3 rounded-lg bg-sand/50 p-2 text-xs text-ink/70"><b>Test:</b> {p.test}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted">Who to reach first</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {e.strategy.body.whoNext.map((w, i) => (
                            <div key={i} className="rounded-xl bg-sand/50 p-4 text-sm">
                              <p><b>{w.group}</b> · {w.messenger} <span className="ml-1 rounded bg-paper px-1.5 py-0.5 text-[11px] text-ink/70">{w.channel}</span></p>
                              <p className="mt-1 text-xs text-muted">{w.why}</p>
                              <p className="mt-2 whitespace-pre-wrap border-l-2 border-forest/40 pl-3 text-ink/80">{w.message}</p>
                              {e.strategy!.status === "approved" && (
                                <button onClick={() => { navigator.clipboard.writeText(w.message); setCopied(i); setTimeout(() => setCopied(null), 1500); }} className="mt-2 text-xs font-semibold text-forest">
                                  {copied === i ? "Copied ✓" : "Copy message"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {e.strategy.status === "draft" && !e.autopilot && (
                        <button disabled={busy === "a"} onClick={() => act("a", `/api/strategies/${e.strategy!.id}/approve`)} className="w-full rounded-xl bg-forest py-3.5 text-lg font-bold text-white hover:bg-clay disabled:opacity-50">
                          {busy === "a" ? "Approving…" : "Approve strategy and start research →"}
                        </button>
                      )}
                    </div>
                  )
                )}

                {tab === "communities" && (
                  e.strategy?.status === "approved"
                    ? <TargetsPanel eventId={e.id} approved />
                    : <Empty text="Approve the strategy first. SoldOut then researches the communities each policy points to." onClick={() => setTab("strategy")} cta="Go to strategy" />
                )}

                {tab === "people" && (
                  e.pipeline.targetsGo
                    ? <PeoplePanel eventId={e.id} />
                    : <Empty text="Mark at least one community as GO, then find the people to reach there." onClick={() => setTab("communities")} cta="Go to communities" />
                )}

                {tab === "parents" && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h2 className="font-display text-xl">Needs you <span className="text-muted">({e.openFlags.length})</span></h2>
                      <p className="mb-3 text-xs text-muted">Questions SoldOut won’t answer itself: refunds, installments, anything not in your content.</p>
                      {!e.openFlags.length && <p className="rounded-xl bg-sand/50 p-4 text-sm text-muted">Nothing waiting.</p>}
                      <ul className="space-y-3">
                        {e.openFlags.map((f) => (
                          <li key={f.id} className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm">
                            <p className="font-semibold">“{f.question}”</p>
                            <p className="mt-1 text-xs text-rose-700">{f.reason} · {f.contact.channel} {f.contact.phone.replace(/^(wa|email):/, "")}</p>
                            <div className="mt-3 flex gap-2">
                              <input className="flex-1 rounded-lg border bg-paper px-3 py-2" placeholder="Your answer. It goes straight to them." value={replies[f.id] ?? ""} onChange={(x) => setReplies({ ...replies, [f.id]: x.target.value })} />
                              <button disabled={busy === f.id || !replies[f.id]?.trim()} onClick={() => act(f.id, `/api/flags/${f.id}/reply`, { reply: replies[f.id] })} className="rounded-lg bg-rose-600 px-4 font-semibold text-white disabled:opacity-50">Reply</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h2 className="font-display text-xl">Enrollment link sent <span className="text-muted">({e.awaitingPayment.length})</span></h2>
                      <p className="mb-3 text-xs text-muted">Families who were a fit and got the link. Mark them paid when they enroll.</p>
                      {!e.awaitingPayment.length && <p className="rounded-xl bg-sand/50 p-4 text-sm text-muted">No one yet. Parents text <b>JOIN {e.keyword}</b> to start.</p>}
                      <ul className="space-y-2">
                        {e.awaitingPayment.map((c) => (
                          <li key={c.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                            <span>{c.phone.replace(/^wa:/, "")} <span className="text-muted">· {c.channel} · {c.program ?? "program n/a"}</span></span>
                            <button disabled={busy === c.id} onClick={() => act(c.id, `/api/contacts/${c.id}/paid`)} className="rounded-lg bg-forest px-3 py-1 text-xs font-semibold text-white">Mark paid</button>
                          </li>
                        ))}
                      </ul>
                      {e.pipeline.referredParents > 0 && <p className="mt-4 text-sm text-forest">{e.pipeline.referredParents} parent{e.pipeline.referredParents > 1 ? "s" : ""} came in through a connector’s code.</p>}
                    </div>
                  </div>
                )}

                {tab === "media" && <MediaPanel eventId={e.id} />}
              </section>
            </>
          );
        })()}
      </div>
    </main>
  );
}

function Empty({ text, onClick, cta }: { text: string; onClick: () => void; cta: string }) {
  return (
    <div className="py-10 text-center">
      <p className="mx-auto max-w-md text-ink/70">{text}</p>
      <button onClick={onClick} className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-sand/50">{cta}</button>
    </div>
  );
}
