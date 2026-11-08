"use client";

import { useCallback, useEffect, useState } from "react";

type Research = { summary?: string; needs?: string[]; fit?: string; howIn?: string; sources?: string[]; location?: string };
type Target = { id: string; name: string; kind: string; policy: string; fitScore: number | null; decision: string; reason: string | null; research: Research | null };

// Step 2: communities each guiding policy points to, researched, with GO / NO-GO.
export default function TargetsPanel({ eventId, approved }: { eventId: string; approved: boolean }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [researching, setResearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await (await fetch(`/api/events/${eventId}/targets`)).json();
    setTargets(j.targets);
    setResearching(j.researching);
  }, [eventId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function start() {
    await fetch(`/api/events/${eventId}/targets`, { method: "POST" });
    load();
  }
  async function decide(id: string, decision: "go" | "no_go") {
    await fetch(`/api/targets/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) });
    load();
  }

  if (!approved) return null;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-black">Communities to target</h3>
        {!researching && !targets.length && (
          <button onClick={start} className="rounded border px-2 py-0.5 text-sm hover:bg-zinc-50">Research communities</button>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">From your guiding policies. SoldOut researches each community’s needs and recommends GO or NO-GO; you decide.</p>
      {researching && <p className="mb-3 text-sm text-amber-700">Researching communities… (about a minute each)</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {targets.map((t) => {
          const r = t.research ?? {};
          const done = t.fitScore !== null;
          return (
            <div key={t.id} className={`rounded-lg border p-3 text-sm ${t.decision === "go" ? "border-emerald-300 bg-emerald-50/40" : t.decision === "no_go" ? "border-zinc-200 bg-zinc-50 opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="text-xs text-zinc-500">{t.kind} · {t.policy}</div>
                </div>
                {!done && t.reason ? (
                  <button onClick={async () => { await fetch(`/api/targets/${t.id}/research`, { method: "POST" }); load(); }} className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Research failed · Retry</button>
                ) : done ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.fitScore! >= 70 ? "bg-emerald-100 text-emerald-800" : t.fitScore! >= 45 ? "bg-amber-100 text-amber-800" : "bg-zinc-200 text-zinc-700"}`}>fit {t.fitScore}</span>
                ) : (
                  <span className="text-xs text-zinc-400">researching…</span>
                )}
              </div>
              {done && (
                <>
                  <p className="mt-2 text-zinc-700">{r.summary}</p>
                  {open === t.id && (
                    <div className="mt-2 space-y-1 text-xs text-zinc-600">
                      {!!r.needs?.length && <p><b>Needs:</b> {r.needs.join(" · ")}</p>}
                      <p><b>Fit:</b> {r.fit}</p>
                      <p><b>Way in:</b> {r.howIn}</p>
                      {!!r.sources?.length && (
                        <p><b>Sources:</b> {r.sources.map((s, i) => <a key={i} href={s} target="_blank" rel="noreferrer" className="mr-2 underline">[{i + 1}]</a>)}</p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <button onClick={() => setOpen(open === t.id ? null : t.id)} className="text-xs underline">{open === t.id ? "Less" : "Research details"}</button>
                    <div className="flex gap-1">
                      <button onClick={() => decide(t.id, "go")} className={`rounded px-2 py-0.5 text-xs font-semibold ${t.decision === "go" ? "bg-emerald-600 text-white" : "border"}`}>GO</button>
                      <button onClick={() => decide(t.id, "no_go")} className={`rounded px-2 py-0.5 text-xs font-semibold ${t.decision === "no_go" ? "bg-zinc-700 text-white" : "border"}`}>NO-GO</button>
                    </div>
                  </div>
                  {t.reason && <p className="mt-1 text-[11px] text-zinc-500">{t.reason}</p>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
