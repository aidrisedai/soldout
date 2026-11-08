"use client";

import { useCallback, useEffect, useState } from "react";

type Touch = { id: string; channel: string; direction: string; body: string; status: string; author: string; createdAt: string };
type Prospect = {
  id: string;
  targetId: string;
  name: string;
  role: string | null;
  whyThem: string | null;
  reach: string | null;
  channels: { email?: string; linkedin?: string; instagram?: string };
  opener: string | null;
  joinCode: string | null;
  status: string;
  aiPaused: boolean;
  touches: Touch[];
  broughtIn: number;
};
type Target = { id: string; name: string; decision: string };

const STATUS: Record<string, string> = {
  found: "bg-zinc-100 text-zinc-700",
  approved: "bg-sky-100 text-sky-800",
  contacted: "bg-sky-100 text-sky-800",
  replied: "bg-amber-100 text-amber-800",
  engaged: "bg-amber-100 text-amber-800",
  referred: "bg-emerald-100 text-emerald-800",
  bought: "bg-green-200 text-green-900",
  not_now: "bg-zinc-200 text-zinc-600",
  done: "bg-zinc-200 text-zinc-600",
};

// Steps 3–4: people in GO communities, person cards, approval, conversations, take-over.
export default function PeoplePanel({ eventId }: { eventId: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [people, setPeople] = useState<Prospect[]>([]);
  const [searching, setSearching] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reply, setReply] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      fetch(`/api/events/${eventId}/targets`).then((r) => r.json()),
      fetch(`/api/events/${eventId}/prospects`).then((r) => r.json()),
    ]);
    setTargets(t.targets.filter((x: Target) => x.decision === "go"));
    setPeople(p.prospects);
    setSearching(p.searching);
  }, [eventId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  async function act(id: string, body: Record<string, string>) {
    setError("");
    const r = await fetch(`/api/prospects/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setError(j.error ?? "Failed");
    load();
  }
  async function findPeople(targetId: string) {
    await fetch(`/api/targets/${targetId}/people`, { method: "POST" });
    load();
  }

  if (!targets.length) return null;
  return (
    <div className="mt-6 rounded-lg border p-4">
      <h3 className="font-semibold">People to reach</h3>
      <p className="mb-3 text-xs text-zinc-500">Connectors first. You approve each opener; SoldOut runs the conversation (share step by step, then ask for a seat or an introduction). Take over any time.</p>
      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}
      <div className="space-y-5">
        {targets.map((t) => {
          const list = people.filter((p) => p.targetId === t.id);
          const busy = searching.includes(t.id);
          return (
            <div key={t.id}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{t.name}</p>
                {!list.length && (
                  <button disabled={busy} onClick={() => findPeople(t.id)} className="rounded border px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-50">
                    {busy ? "Researching people…" : "Find people"}
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => {
                  const isOpen = open === p.id;
                  const ladder = p.channels.email ? "Email" : p.channels.linkedin ? "LinkedIn" : "Warm intro";
                  return (
                    <div key={p.id} className="rounded-lg border bg-white p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{p.name} {p.reach === "connector" && <span className="ml-1 rounded bg-violet-100 px-1.5 text-[10px] font-bold uppercase text-violet-800">connector</span>}</div>
                          <div className="text-xs text-zinc-500">{p.role}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[p.status] ?? "bg-zinc-100"}`}>{p.status.replace("_", " ")}</span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">{p.whyThem}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                        {p.channels.email && <span>✉ {p.channels.email}</span>}
                        {p.channels.linkedin && <a className="underline" href={p.channels.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                        {p.joinCode && <span>code <b>JOIN {p.joinCode}</b>{p.broughtIn ? ` · brought ${p.broughtIn}` : ""}</span>}
                      </div>

                      {p.status === "found" && (
                        <div className="mt-2">
                          <textarea className="w-full rounded border p-2 text-xs" rows={4} value={drafts[p.id] ?? p.opener ?? ""} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })} />
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-zinc-500">First touch: {ladder}</span>
                            <div className="flex gap-1">
                              <button onClick={() => act(p.id, { action: "skip" })} className="rounded border px-2 py-0.5 text-xs">Skip</button>
                              <button
                                onClick={async () => {
                                  if (drafts[p.id] !== undefined) await act(p.id, { action: "edit", opener: drafts[p.id] });
                                  await act(p.id, { action: "approve" });
                                }}
                                className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white"
                              >
                                Approve & send
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {p.status === "approved" && p.touches.some((x) => x.channel === "linkedin" && x.status === "approved") && (
                        <div className="mt-2 rounded bg-sky-50 p-2 text-xs">
                          <p className="font-semibold">Send this LinkedIn connection note:</p>
                          <p className="mt-1 whitespace-pre-wrap">{p.opener}</p>
                          <div className="mt-1 flex gap-2">
                            <button onClick={() => navigator.clipboard.writeText(p.opener ?? "")} className="underline">Copy</button>
                            {p.channels.linkedin && <a href={p.channels.linkedin} target="_blank" rel="noreferrer" className="underline">Open profile</a>}
                            <button onClick={() => act(p.id, { action: "linkedin_sent" })} className="underline">Mark sent</button>
                          </div>
                        </div>
                      )}

                      {!!p.touches.length && (
                        <button onClick={() => setOpen(isOpen ? null : p.id)} className="mt-2 text-xs underline">
                          {isOpen ? "Hide conversation" : `Conversation (${p.touches.length})`}
                        </button>
                      )}
                      {isOpen && (
                        <div className="mt-2 space-y-1.5">
                          {p.touches.map((x) => (
                            <div key={x.id} className={`rounded p-2 text-xs ${x.direction === "in" ? "bg-zinc-100" : "bg-emerald-50"}`}>
                              <div className="mb-0.5 text-[10px] uppercase text-zinc-500">{x.direction === "in" ? p.name : x.author === "organizer" ? "You (personally)" : "You (SoldOut)"} · {x.channel}</div>
                              <div className="whitespace-pre-wrap">{x.body}</div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between pt-1">
                            {p.aiPaused ? (
                              <button onClick={() => act(p.id, { action: "handback" })} className="rounded border px-2 py-0.5 text-xs">Hand back to SoldOut</button>
                            ) : (
                              <button onClick={() => act(p.id, { action: "takeover" })} className="rounded border border-rose-300 px-2 py-0.5 text-xs text-rose-700">Take over</button>
                            )}
                            {p.aiPaused && <span className="text-[11px] text-rose-700">You’re handling this one</span>}
                          </div>
                          {p.aiPaused && (
                            <div className="flex gap-1">
                              <input className="flex-1 rounded border px-2 py-1 text-xs" placeholder={`Reply to ${p.name} personally`} value={reply[p.id] ?? ""} onChange={(e) => setReply({ ...reply, [p.id]: e.target.value })} />
                              <button onClick={() => { act(p.id, { action: "reply", text: reply[p.id] ?? "" }); setReply({ ...reply, [p.id]: "" }); }} className="rounded bg-zinc-900 px-2 text-xs text-white">Send</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
