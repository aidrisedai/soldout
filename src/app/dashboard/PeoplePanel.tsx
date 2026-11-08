"use client";

import { useCallback, useEffect, useState } from "react";
import Working from "@/components/Working";

type Touch = { id: string; channel: string; direction: string; body: string; status: string; author: string; createdAt: string; phoneError?: string | null };
type Prospect = {
  id: string;
  targetId: string;
  name: string;
  role: string | null;
  whyThem: string | null;
  reach: string | null;
  channels: { email?: string; linkedin?: string; instagram?: string; whatsapp?: string };
  opener: string | null;
  joinCode: string | null;
  status: string;
  aiPaused: boolean;
  touches: Touch[];
  broughtIn: number;
};
type Target = { id: string; name: string; decision: string };

const STATUS: Record<string, string> = {
  found: "bg-cream text-ink/80",
  approved: "bg-sky-100 text-sky-800",
  contacted: "bg-sky-100 text-sky-800",
  replied: "bg-amber-100 text-amber-800",
  engaged: "bg-amber-100 text-amber-800",
  referred: "bg-mint text-forest",
  bought: "bg-green-200 text-green-900",
  not_now: "bg-sand text-ink/70",
  done: "bg-sand text-ink/70",
};

// Steps 3–4: people in GO communities, person cards, approval, conversations, take-over.
export default function PeoplePanel({ eventId }: { eventId: string }) {
  const [targets, setTargets] = useState<Target[]>([]);
  const [people, setPeople] = useState<Prospect[]>([]);
  const [searching, setSearching] = useState<string[]>([]);
  const [phone, setPhone] = useState(false);
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
    setPhone(!!p.phone);
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
    <div>
      <h3 className="font-display text-xl">People to reach</h3>
      <p className="mb-3 text-xs text-muted">Connectors first. On autopilot SoldOut emails openers itself (up to 10 a day) and runs each conversation: share step by step, then ask for a seat or an introduction. LinkedIn notes and warm intros are ready for you to send. Take over any conversation any time.</p>
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
                  <button disabled={busy} onClick={() => findPeople(t.id)} className="rounded border px-2 py-0.5 text-xs hover:bg-sand/50 disabled:opacity-50">
                    {busy ? "Researching people…" : "Find people"}
                  </button>
                )}
              </div>
              {busy && !list.length && (
                <Working compact steps={[`Searching LinkedIn for people at ${t.name}…`, "Ranking who has the biggest reach…", "Looking up public work emails…", "Writing a personal opener for each person…"]} interval={7000} />
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => {
                  const isOpen = open === p.id;
                  const ladder = [
                    p.channels.whatsapp && "WhatsApp (your contact)",
                    p.channels.email && "email (sent automatically)",
                    p.channels.linkedin && `LinkedIn note (${phone ? "sent from the phone" : "you send"})`,
                    p.channels.instagram && `Instagram DM (${phone ? "sent from the phone" : "you send"})`,
                  ].filter(Boolean).join(" + ") || "Warm intro (through your network)";
                  const sending = p.touches.filter((x) => x.status === "queued" || x.status === "sending");
                  const ready = p.touches.filter((x) => x.status === "approved" && ["linkedin", "instagram", "intro"].includes(x.channel));
                  return (
                    <div key={p.id} className="rounded-lg border bg-paper p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{p.name} {p.reach === "connector" && <span className="ml-1 rounded bg-mustard/40 px-1.5 text-[10px] font-bold uppercase text-night">connector</span>}</div>
                          <div className="text-xs text-muted">{p.role}</div>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[p.status] ?? "bg-cream"}`}>{p.status.replace("_", " ")}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink/70">{p.whyThem}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
                        {p.channels.whatsapp && <span>💬 {p.channels.whatsapp}</span>}
                        {p.channels.email && <span>✉ {p.channels.email}</span>}
                        {p.channels.linkedin && <a className="underline" href={p.channels.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>}
                        {p.channels.instagram && <a className="underline" href={p.channels.instagram} target="_blank" rel="noreferrer">Instagram</a>}
                        {p.joinCode && <span>code <b>JOIN {p.joinCode}</b>{p.broughtIn ? ` · brought ${p.broughtIn}` : ""}</span>}
                      </div>

                      {p.status === "found" && !p.opener && <p className="mt-2 text-xs text-muted">Writing a personal opener…</p>}
                      {p.status === "found" && p.opener && (
                        <div className="mt-2">
                          <textarea className="w-full rounded border p-2 text-xs" rows={4} value={drafts[p.id] ?? p.opener ?? ""} onChange={(e) => setDrafts({ ...drafts, [p.id]: e.target.value })} />
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[11px] text-muted">Reaching out on: {ladder}</span>
                            <div className="flex gap-1">
                              <button onClick={() => act(p.id, { action: "skip" })} className="rounded border px-2 py-0.5 text-xs">Skip</button>
                              <button
                                onClick={async () => {
                                  if (drafts[p.id] !== undefined) await act(p.id, { action: "edit", opener: drafts[p.id] });
                                  await act(p.id, { action: "approve" });
                                }}
                                className="rounded bg-forest px-2 py-0.5 text-xs font-semibold text-white"
                              >
                                {p.channels.email || p.channels.whatsapp ? "Approve & send" : "Approve"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {sending.map((x) => (
                        <p key={x.id} className="mt-2 flex items-center gap-2 rounded bg-sky-50 p-2 text-xs">
                          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-600" />
                          {x.status === "sending" ? "The phone is sending" : "Queued on the phone:"} {x.channel === "linkedin" ? "LinkedIn connection note" : "Instagram DM"}…
                        </p>
                      ))}
                      {ready.map((x) => {
                        const intro = x.channel === "intro";
                        const text = intro ? `Could you introduce me to ${p.name} (${p.role ?? "community leader"})? Here's a short note you can pass along:\n\n${x.body}` : x.body;
                        const link = x.channel === "linkedin" ? p.channels.linkedin : x.channel === "instagram" ? p.channels.instagram : undefined;
                        return (
                          <div key={x.id} className={`mt-2 rounded p-2 text-xs ${intro ? "bg-mustard/15" : "bg-sky-50"}`}>
                            <p className="font-semibold">
                              {intro ? `Warm intro: no public channel found for ${p.name.split(" ")[0]}. Forward this to someone who knows them:` : x.channel === "linkedin" ? "Send this LinkedIn connection note:" : "Send this Instagram DM:"}
                            </p>
                            {x.phoneError && <p className="mt-1 text-rose-700">The phone couldn&apos;t send it: {x.phoneError}</p>}
                            <p className="mt-1 whitespace-pre-wrap rounded bg-paper p-2">{text}</p>
                            <div className="mt-1 flex gap-2">
                              <button onClick={() => navigator.clipboard.writeText(text)} className="underline">Copy</button>
                              {link && <a href={link} target="_blank" rel="noreferrer" className="underline">Open profile</a>}
                              {phone && !intro && <button onClick={() => act(p.id, { action: "phone_send", channel: x.channel })} className="underline">{x.phoneError ? "Retry from phone" : "Send from phone"}</button>}
                              <button onClick={() => act(p.id, { action: "linkedin_sent", channel: x.channel })} className="underline">{intro ? "Mark intro asked" : "Mark sent"}</button>
                            </div>
                          </div>
                        );
                      })}

                      {!!p.touches.length && (
                        <button onClick={() => setOpen(isOpen ? null : p.id)} className="mt-2 text-xs underline">
                          {isOpen ? "Hide conversation" : `Conversation (${p.touches.length})`}
                        </button>
                      )}
                      {isOpen && (
                        <div className="mt-2 space-y-1.5">
                          {p.touches.map((x) => (
                            <div key={x.id} className={`rounded p-2 text-xs ${x.direction === "in" ? "bg-cream" : "bg-mint/50"}`}>
                              <div className="mb-0.5 text-[10px] uppercase text-muted">{x.direction === "in" ? p.name : x.author === "organizer" ? "You (personally)" : "You (SoldOut)"} · {x.channel}</div>
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
                              <button onClick={() => { act(p.id, { action: "reply", text: reply[p.id] ?? "" }); setReply({ ...reply, [p.id]: "" }); }} className="rounded bg-ink px-2 text-xs text-white">Send</button>
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
