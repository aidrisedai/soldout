"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import MediaPanel from "./MediaPanel";
import TargetsPanel from "./TargetsPanel";

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
  score: { optIns: number; answered: number; linksSent: number; paid: number; flagsTotal: number; steppedIn: number };
  openFlags: { id: string; question: string; reason: string; createdAt: string; contact: { phone: string; channel: string } }[];
  awaitingPayment: { id: string; phone: string; channel: string; program: string | null }[];
  strategy: Strategy | null;
};

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 p-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-zinc-600">{label}</div>
      {sub && <div className="text-[11px] text-zinc-400">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetch("/api/dashboard");
    setEvents(await r.json());
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
    if (!r.ok) setError(j.error ?? "Request failed");
    await load();
    setBusy(null);
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <nav className="text-sm text-zinc-500"><Link href="/" className="underline">SoldOut</Link> / dashboard</nav>
            <h1 className="text-2xl font-bold">Events</h1>
          </div>
          <div className="flex gap-2 text-sm">
            <Link href="/intake" className="rounded bg-zinc-900 px-3 py-1.5 font-semibold text-white">+ New event</Link>
            <Link href="/simulate" className="rounded border bg-white px-3 py-1.5">Simulate</Link>
          </div>
        </header>
        {error && <div className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

        <div className="space-y-8">
          {events.length === 0 && (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-semibold">No campaigns yet.</p>
              <p className="mt-1 text-sm text-zinc-600">Set a goal and SoldOut takes it from there.</p>
              <Link href="/intake" className="mt-4 inline-block rounded bg-zinc-900 px-4 py-2 font-semibold text-white">Start a campaign →</Link>
            </div>
          )}
          {events.map((e) => {
            const s = e.score;
            const seatsPct = e.goalSeats ? Math.min(100, Math.round((s.paid / e.goalSeats) * 100)) : null;
            return (
              <section key={e.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{e.name}</h2>
                    <p className="text-sm text-zinc-600">
                      {e.organization} · {e.organizerName} · {e.price ?? "price n/a"} · keyword <code className="rounded bg-zinc-100 px-1">JOIN {e.keyword}</code>
                    </p>
                  </div>
                  <div className="text-right text-sm text-zinc-600">
                    Goal: {e.goalSeats ?? "—"} seats{e.deadline ? ` by ${e.deadline}` : ""}
                    {seatsPct !== null && (
                      <div className="mt-1 h-2 w-40 rounded bg-zinc-100"><div className="h-2 rounded bg-emerald-500" style={{ width: `${seatsPct}%` }} /></div>
                    )}
                  </div>
                </div>

                {/* Scoreboard */}
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                  <Stat label="Opt-ins" value={s.optIns} />
                  <Stat label="Questions answered" value={s.answered} />
                  <Stat label="Links sent" value={s.linksSent} />
                  <Stat label="Paid" value={s.paid} />
                  <Stat label="Organizer stepped in" value={s.steppedIn} sub={`${s.flagsTotal - s.steppedIn} waiting`} />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {/* Organizer inbox */}
                  <div>
                    <h3 className="mb-2 font-semibold">Needs you ({e.openFlags.length})</h3>
                    {e.openFlags.length === 0 && <p className="text-sm text-zinc-500">Nothing waiting.</p>}
                    <ul className="space-y-3">
                      {e.openFlags.map((f) => (
                        <li key={f.id} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm">
                          <div className="font-medium">“{f.question}”</div>
                          <div className="text-xs text-rose-700">{f.reason} · {f.contact.channel} {f.contact.phone}</div>
                          <div className="mt-2 flex gap-2">
                            <input className="flex-1 rounded border bg-white px-2 py-1" placeholder="Your answer to the parent" value={replies[f.id] ?? ""} onChange={(ev) => setReplies({ ...replies, [f.id]: ev.target.value })} />
                            <button disabled={busy === f.id || !replies[f.id]?.trim()} onClick={() => act(f.id, `/api/flags/${f.id}/reply`, { reply: replies[f.id] })} className="rounded bg-rose-600 px-3 text-white disabled:opacity-50">Reply</button>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <h3 className="mb-2 mt-6 font-semibold">Link sent, awaiting payment ({e.awaitingPayment.length})</h3>
                    {e.awaitingPayment.length === 0 && <p className="text-sm text-zinc-500">No one yet.</p>}
                    <ul className="space-y-2">
                      {e.awaitingPayment.map((c) => (
                        <li key={c.id} className="flex items-center justify-between rounded border p-2 text-sm">
                          <span>{c.channel} {c.phone} · {c.program ?? "program n/a"}</span>
                          <button disabled={busy === c.id} onClick={() => act(c.id, `/api/contacts/${c.id}/paid`)} className="rounded border px-2 py-0.5 hover:bg-zinc-50">Mark paid</button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Strategy panel */}
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-semibold">Strategy</h3>
                      <div className="flex items-center gap-2">
                        {e.strategy && (
                          <span className={`rounded-full px-2 py-0.5 text-xs ${e.strategy.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                            {e.strategy.status === "approved" ? "Approved" : "Draft, not approved"}
                          </span>
                        )}
                        <button disabled={busy === `s-${e.id}`} onClick={() => act(`s-${e.id}`, `/api/events/${e.id}/strategy`)} className="rounded border px-2 py-0.5 text-sm hover:bg-zinc-50 disabled:opacity-50">
                          {busy === `s-${e.id}` ? "Drafting…" : e.strategy ? "Redraft" : "Draft strategy"}
                        </button>
                      </div>
                    </div>
                    {!e.strategy && <p className="text-sm text-zinc-500">The agent drafts a diagnosis, 2–3 guiding policies with tests, and a who-next list. Nothing is sent until you approve.</p>}
                    {e.strategy && (
                      <div className="space-y-4 text-sm">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Diagnosis</div>
                          <p>{e.strategy.body.diagnosis}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Guiding policies</div>
                          <ol className="list-decimal space-y-2 pl-5">
                            {e.strategy.body.policies.map((p, i) => (
                              <li key={i}><b>{p.policy}</b> <span className="text-zinc-600">{p.why}</span><div className="text-xs text-zinc-500">Test: {p.test}</div></li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Who next</div>
                          <ul className="space-y-2">
                            {e.strategy.body.whoNext.map((w, i) => (
                              <li key={i} className="rounded bg-zinc-50 p-2">
                                <div><b>{w.group}</b> · {w.messenger} · <span className="text-zinc-500">{w.channel}</span></div>
                                <div className="text-xs text-zinc-500">{w.why}</div>
                                <blockquote className="mt-1 whitespace-pre-wrap border-l-2 pl-2 text-zinc-700">{w.message}</blockquote>
                                {e.strategy!.status === "approved" ? (
                                  <button onClick={() => navigator.clipboard.writeText(w.message)} className="mt-1 text-xs underline">Copy message</button>
                                ) : (
                                  <div className="mt-1 text-xs text-amber-700">Locked until approved</div>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                        {e.strategy.status === "draft" && (
                          <button disabled={busy === `a-${e.id}`} onClick={() => act(`a-${e.id}`, `/api/strategies/${e.strategy!.id}/approve`)} className="w-full rounded bg-emerald-600 py-2 font-semibold text-white disabled:opacity-50">Approve strategy</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <TargetsPanel eventId={e.id} approved={e.strategy?.status === "approved"} />
                <MediaPanel eventId={e.id} />
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
