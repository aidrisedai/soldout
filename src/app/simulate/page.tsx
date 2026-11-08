"use client";

import Link from "next/link";
import { Logo } from "@/components/Nav";
import { useCallback, useEffect, useRef, useState } from "react";

type Ev = { id: string; name: string; keyword: string; organization: string };
type Msg = { id: string; direction: "in" | "out"; body: string; status: string; createdAt: string; attachment?: string | null };
type Contact = {
  id: string;
  stage: string;
  program: string | null;
  status: string;
  messages: Msg[];
  fitAnswers: { key: string; question: string; answer: string }[];
  outcomes: { id: string; type: string; detail: string | null; createdAt: string }[];
  flags: { id: string; question: string; reason: string; status: string }[];
};

const OUTCOME_STYLE: Record<string, string> = {
  opted_in: "bg-sky-100 text-sky-800",
  answered: "bg-mint text-forest",
  clip_sent: "bg-violet-100 text-violet-800",
  link_sent: "bg-amber-100 text-amber-800",
  paid: "bg-green-200 text-green-900",
  needs_organizer: "bg-rose-100 text-rose-800",
  routed_builder: "bg-indigo-100 text-indigo-800",
  opted_out: "bg-sand text-ink/80",
};

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="underline break-all">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default function Simulate() {
  const [events, setEvents] = useState<Ev[]>([]);
  const [eventId, setEventId] = useState("");
  const [from, setFrom] = useState("sim-parent-1");
  const [text, setText] = useState("");
  const [contact, setContact] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/events").then((r) => r.json()).then((evs: Ev[]) => {
      setEvents(evs);
      if (evs[0]) setEventId(evs[0].id);
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!eventId || !from) return;
    const r = await fetch(`/api/conversation?eventId=${eventId}&from=${encodeURIComponent(from)}`);
    const j = await r.json();
    setContact(j.contact);
  }, [eventId, from]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [contact?.messages.length, busy]);

  const ev = events.find((e) => e.id === eventId);

  async function send(body: string) {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError("");
    setText("");
    // Optimistic bubble
    setContact((c) => c ? { ...c, messages: [...c.messages, { id: "tmp", direction: "in", body, status: "ok", createdAt: "" }] } : c);
    try {
      const r = await fetch("/api/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, text: body, eventId, channel: "simulate" }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error ?? "Something went wrong");
      if (!j.contactId && j.replies?.length) setError(`(not stored, no conversation yet) ${j.replies[0]}`);
    } catch {
      setError("Network error");
    }
    await refresh();
    setBusy(false);
  }

  async function reset() {
    await fetch(`/api/conversation?eventId=${eventId}&from=${encodeURIComponent(from)}`, { method: "DELETE" });
    setContact(null);
    setError("");
  }

  const quick = ev ? [`JOIN ${ev.keyword}`, "What time are the sessions?", "Can you send me something I can share with my husband?", "Can I see what students actually do?", "Do you offer refunds?", "We're ready to sign up", "STOP"] : [];

  return (
    <main className="min-h-screen bg-cream">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <Link href="/dashboard" className="text-sm text-ink/75 hover:text-ink">Dashboard</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Simulate a parent</h1>
            <p className="text-sm text-ink/70">Texts go to <code>/api/inbound</code> exactly like a real message would.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <select className="rounded border bg-paper px-2 py-1" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>{e.name} (JOIN {e.keyword})</option>
              ))}
            </select>
            <input className="w-40 rounded border bg-paper px-2 py-1" value={from} onChange={(e) => setFrom(e.target.value)} title="Simulated phone" />
            <button onClick={reset} className="rounded border bg-paper px-3 py-1 hover:bg-sand/50">Reset</button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[380px_1fr]">
          {/* Phone */}
          <div className="mx-auto w-full max-w-[380px] rounded-[2.5rem] border-8 border-ink bg-paper shadow-xl">
            <div className="rounded-t-[2rem] bg-sand/50 px-4 py-3 text-center text-sm font-semibold">{ev?.organization ?? "SoldOut"}</div>
            <div className="h-[520px] space-y-2 overflow-y-auto px-3 py-3">
              {(contact?.messages ?? []).map((m) => (
                <div key={m.id} className={`flex ${m.direction === "in" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.direction === "in" ? "bg-blue-500 text-white" : "bg-sand text-ink"}`}>
                    {m.attachment && (
                      <a href={`/api/attachment?messageId=${m.id}`} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg bg-paper/70 px-2 py-1.5 text-xs font-semibold text-ink">
                        <span>{m.attachment.startsWith("brief:") ? "📄" : "🎬"}</span>
                        <span>{m.attachment.startsWith("brief:") ? "Program-Brief.pdf" : m.attachment.split("|")[1] ?? "Video"}</span>
                      </a>
                    )}
                    <Linkified text={m.body} />
                  </div>
                </div>
              ))}
              {busy && <div className="text-xs text-muted">typing…</div>}
              {!contact && !busy && <p className="pt-24 text-center text-sm text-muted">Text “JOIN {ev?.keyword}” to start.</p>}
              <div ref={bottom} />
            </div>
            <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
              <input className="flex-1 rounded-full border px-3 py-2 text-sm" placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} />
              <button disabled={busy} className="rounded-full bg-blue-500 px-4 text-sm font-semibold text-white disabled:opacity-50">Send</button>
            </form>
          </div>

          {/* State */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={busy} className="rounded-full border bg-paper px-3 py-1 text-sm hover:bg-sand/50 disabled:opacity-50">{q}</button>
              ))}
            </div>
            {error && <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}

            <section className="rounded-lg bg-paper p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Contact</h2>
              {contact ? (
                <p className="text-sm">Stage <b>{contact.stage}</b> · Program <b>{contact.program ?? "—"}</b> · Status <b>{contact.status}</b></p>
              ) : <p className="text-sm text-muted">Not opted in yet.</p>}
            </section>

            <section className="rounded-lg bg-paper p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Fit answers</h2>
              {contact?.fitAnswers.length ? (
                <ul className="space-y-1 text-sm">
                  {contact.fitAnswers.map((a) => (
                    <li key={a.key}><span className="font-mono text-xs text-muted">{a.key}</span> {a.answer}</li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">None yet.</p>}
            </section>

            <section className="rounded-lg bg-paper p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Outcomes</h2>
              <div className="flex flex-wrap gap-2">
                {(contact?.outcomes ?? []).map((o) => (
                  <span key={o.id} title={o.detail ?? ""} className={`rounded-full px-2 py-0.5 text-xs ${OUTCOME_STYLE[o.type] ?? "bg-cream"}`}>{o.type.replace("_", " ")}</span>
                ))}
                {!contact?.outcomes.length && <p className="text-sm text-muted">None yet.</p>}
              </div>
            </section>

            <section className="rounded-lg bg-paper p-4 shadow-sm">
              <h2 className="mb-2 font-semibold">Needs organizer</h2>
              {contact?.flags.length ? (
                <ul className="space-y-2 text-sm">
                  {contact.flags.map((f) => (
                    <li key={f.id} className="rounded border border-rose-100 bg-rose-50 p-2">
                      <div>“{f.question}”</div>
                      <div className="text-xs text-rose-700">{f.reason} · {f.status}</div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">Nothing flagged.</p>}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
