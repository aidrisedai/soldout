"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MediaPanel from "./MediaPanel";
import TargetsPanel from "./TargetsPanel";
import PeoplePanel from "./PeoplePanel";

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
    <main className="min-h-screen bg-zinc-100">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <Link href="/" className="text-lg font-black tracking-tight">Sold<span className="text-emerald-400">Out</span></Link>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {events && events.length > 1 && (
              <select className="rounded-lg border border-white/15 bg-zinc-900 px-2 py-1.5" value={selected ?? ""} onChange={(x) => setSelected(x.target.value)}>
                {events.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            )}
            <Link href="/simulate" className="rounded-lg px-3 py-1.5 text-zinc-300 hover:text-white">Simulate a parent</Link>
            <Link href="/intake" className="rounded-lg bg-emerald-500 px-3 py-1.5 font-semibold text-zinc-950 hover:bg-emerald-400">+ New campaign</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {events === null && <p className="text-zinc-500">Loading…</p>}
        {events?.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <p className="text-2xl font-black">No campaigns yet</p>
            <p className="mt-2 text-zinc-600">Set a goal and SoldOut takes it from there.</p>
            <Link href="/intake" className="mt-6 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-bold text-white">Start a campaign →</Link>
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
              <section className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">{e.organization} · campaign</p>
                    <h1 className="mt-1 text-2xl font-black tracking-tight">{e.name}</h1>
                    <p className="mt-1 text-sm text-zinc-600">
                      {e.price ?? "Price n/a"}{e.dateText ? ` · ${e.dateText}` : ""} · parents text <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold">JOIN {e.keyword}</code>
                    </p>
                  </div>
                  <div className="min-w-[220px] text-right">
                    <p className="text-3xl font-black tabular-nums">{s.paid}<span className="text-lg text-zinc-400">/{e.goalSeats ?? "—"}</span></p>
                    <p className="text-xs text-zinc-500">seats paid{left !== null ? ` · ${left} days left` : ""}</p>
                    <div className="mt-2 h-2 rounded-full bg-zinc-100"><div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} /></div>
                    {perDay !== null && <p className="mt-1 text-[11px] text-zinc-500">need {perDay.toFixed(1)} seats/day to hit the goal</p>}
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
                    <div key={l} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                      <p className="text-lg font-black tabular-nums">{v}</p>
                      <p className="text-[11px] text-zinc-500">{l}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setTab(next.tab)} className="mt-4 flex w-full items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm hover:bg-emerald-100">
                  <span><b className="text-emerald-800">Next:</b> {next.text}</span>
                  <span className="text-emerald-700">→</span>
                </button>
              </section>

              <nav className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => setTab(t.key)} className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === t.key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${tab === t.key ? "bg-emerald-400 text-zinc-950" : "bg-zinc-200"}`}>{t.n}</span>
                    {t.label}
                    {t.key === "parents" && e.openFlags.length > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{e.openFlags.length}</span>}
                  </button>
                ))}
              </nav>

              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

              <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
                {tab === "strategy" && (
                  !e.strategy ? (
                    <div className="py-10 text-center">
                      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                      <p className="mt-3 font-semibold">Drafting your strategy…</p>
                      <p className="text-sm text-zinc-500">Diagnosis, guiding policies with tests, and who to reach first.</p>
                      <button disabled={busy === "s"} onClick={() => act("s", `/api/events/${e.id}/strategy`)} className="mt-4 text-xs underline">Taking long? Draft again</button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-black">The strategy</h2>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${e.strategy.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {e.strategy.status === "approved" ? "Approved" : "Draft, waiting for you"}
                          </span>
                          <button disabled={busy === "s"} onClick={() => act("s", `/api/events/${e.id}/strategy`)} className="rounded-lg border px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-50">{busy === "s" ? "Redrafting…" : "Redraft"}</button>
                        </div>
                      </div>
                      <div className="rounded-xl bg-zinc-950 p-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Diagnosis</p>
                        <p className="mt-2 leading-relaxed text-zinc-100">{e.strategy.body.diagnosis}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Guiding policies</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          {e.strategy.body.policies.map((p, i) => (
                            <div key={i} className="rounded-xl border p-4">
                              <p className="font-mono text-xs font-bold text-emerald-600">0{i + 1}</p>
                              <p className="mt-1 font-semibold leading-snug">{p.policy}</p>
                              <p className="mt-2 text-sm text-zinc-600">{p.why}</p>
                              <p className="mt-3 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600"><b>Test:</b> {p.test}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Who to reach first</p>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          {e.strategy.body.whoNext.map((w, i) => (
                            <div key={i} className="rounded-xl bg-zinc-50 p-4 text-sm">
                              <p><b>{w.group}</b> · {w.messenger} <span className="ml-1 rounded bg-white px-1.5 py-0.5 text-[11px] text-zinc-600">{w.channel}</span></p>
                              <p className="mt-1 text-xs text-zinc-500">{w.why}</p>
                              <p className="mt-2 whitespace-pre-wrap border-l-2 border-emerald-300 pl-3 text-zinc-700">{w.message}</p>
                              {e.strategy!.status === "approved" && (
                                <button onClick={() => { navigator.clipboard.writeText(w.message); setCopied(i); setTimeout(() => setCopied(null), 1500); }} className="mt-2 text-xs font-semibold text-emerald-700">
                                  {copied === i ? "Copied ✓" : "Copy message"}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      {e.strategy.status === "draft" && (
                        <button disabled={busy === "a"} onClick={() => act("a", `/api/strategies/${e.strategy!.id}/approve`)} className="w-full rounded-xl bg-emerald-600 py-3.5 text-lg font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
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
                      <h2 className="text-lg font-black">Needs you <span className="text-zinc-400">({e.openFlags.length})</span></h2>
                      <p className="mb-3 text-xs text-zinc-500">Questions SoldOut won’t answer itself: refunds, installments, anything not in your content.</p>
                      {!e.openFlags.length && <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">Nothing waiting.</p>}
                      <ul className="space-y-3">
                        {e.openFlags.map((f) => (
                          <li key={f.id} className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm">
                            <p className="font-semibold">“{f.question}”</p>
                            <p className="mt-1 text-xs text-rose-700">{f.reason} · {f.contact.channel} {f.contact.phone.replace(/^(wa|email):/, "")}</p>
                            <div className="mt-3 flex gap-2">
                              <input className="flex-1 rounded-lg border bg-white px-3 py-2" placeholder="Your answer. It goes straight to them." value={replies[f.id] ?? ""} onChange={(x) => setReplies({ ...replies, [f.id]: x.target.value })} />
                              <button disabled={busy === f.id || !replies[f.id]?.trim()} onClick={() => act(f.id, `/api/flags/${f.id}/reply`, { reply: replies[f.id] })} className="rounded-lg bg-rose-600 px-4 font-semibold text-white disabled:opacity-50">Reply</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h2 className="text-lg font-black">Enrollment link sent <span className="text-zinc-400">({e.awaitingPayment.length})</span></h2>
                      <p className="mb-3 text-xs text-zinc-500">Families who were a fit and got the link. Mark them paid when they enroll.</p>
                      {!e.awaitingPayment.length && <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">No one yet. Parents text <b>JOIN {e.keyword}</b> to start.</p>}
                      <ul className="space-y-2">
                        {e.awaitingPayment.map((c) => (
                          <li key={c.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                            <span>{c.phone.replace(/^wa:/, "")} <span className="text-zinc-400">· {c.channel} · {c.program ?? "program n/a"}</span></span>
                            <button disabled={busy === c.id} onClick={() => act(c.id, `/api/contacts/${c.id}/paid`)} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Mark paid</button>
                          </li>
                        ))}
                      </ul>
                      {e.pipeline.referredParents > 0 && <p className="mt-4 text-sm text-emerald-700">{e.pipeline.referredParents} parent{e.pipeline.referredParents > 1 ? "s" : ""} came in through a connector’s code.</p>}
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
      <p className="mx-auto max-w-md text-zinc-600">{text}</p>
      <button onClick={onClick} className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-zinc-50">{cta}</button>
    </div>
  );
}
