"use client";

import { useCallback, useEffect, useState } from "react";

type Msg = { id: string; direction: string; body: string; attachment: string | null; createdAt: string; status: string };
type Parent = {
  id: string;
  phone: string;
  channel: string;
  stage: string;
  program: string | null;
  status: string;
  referredBy: string | null;
  updatedAt: string;
  messages: Msg[];
  fitAnswers: { key: string; question: string; answer: string }[];
  outcomes: { type: string; createdAt: string }[];
};

const STAGE: Record<string, [string, string]> = {
  fit: ["Answering fit questions", "bg-sand text-ink"],
  qa: ["Asking questions", "bg-sand text-ink"],
  builder: ["Pointed to the better-fit program", "bg-mustard/30 text-night"],
  link_sent: ["Has the enrollment link", "bg-mustard/40 text-night"],
  paid: ["Paid", "bg-forest text-white"],
};

// Last 4 digits only: enough to recognize a family on screen during a demo.
const mask = (p: string) => (p.startsWith("sim") ? p : `•••• ${p.replace(/\D/g, "").slice(-4)}`);

// Step H: every parent conversation, in full, with where each family stands.
export default function ParentsPanel({ eventId, onPaid }: { eventId: string; onPaid: (id: string) => void }) {
  const [parents, setParents] = useState<Parent[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${eventId}/parents`);
    if (r.ok) setParents((await r.json()).parents);
  }, [eventId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const sel = parents.find((p) => p.id === open) ?? parents[0];

  if (!parents.length)
    return <p className="rounded-xl bg-sand/50 p-5 text-sm text-muted">No parents yet. Families arrive when they text the JOIN code a connector shared, and every conversation appears here as it happens.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <ul className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
        {parents.map((p) => {
          const [label, cls] = STAGE[p.stage] ?? [p.stage, "bg-sand"];
          const last = p.messages[p.messages.length - 1];
          return (
            <li key={p.id}>
              <button onClick={() => setOpen(p.id)} className={`w-full rounded-xl border p-3 text-left text-sm transition ${sel?.id === p.id ? "border-clay bg-paper shadow-sm" : "border-line hover:bg-sand/50"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{mask(p.phone)} <span className="font-normal text-muted">· {p.channel}</span></span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
                </div>
                {last && <p className="mt-1 line-clamp-1 text-xs text-muted">{last.direction === "in" ? "" : "SoldOut: "}{last.body}</p>}
                {p.referredBy && <p className="mt-1 text-[11px] text-forest">via JOIN {p.referredBy}</p>}
              </button>
            </li>
          );
        })}
      </ul>

      {sel && (
        <div className="rounded-2xl border border-line bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <p className="font-semibold">{mask(sel.phone)} <span className="font-normal text-muted">· {sel.channel}{sel.program ? ` · ${sel.program}` : ""}</span></p>
              <p className="text-xs text-muted">{sel.outcomes.map((o) => o.type.replace(/_/g, " ")).join(" → ") || "just started"}</p>
            </div>
            {sel.stage === "link_sent" && (
              <button onClick={() => { onPaid(sel.id); setTimeout(load, 800); }} className="rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white">Mark paid</button>
            )}
          </div>
          {!!sel.fitAnswers.length && (
            <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
              {sel.fitAnswers.map((a) => (
                <span key={a.key} title={a.question} className="rounded-full bg-sand px-2.5 py-1 text-[11px]">{a.answer}</span>
              ))}
            </div>
          )}
          <div className="max-h-[420px] space-y-2 overflow-y-auto p-4">
            {sel.messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${m.direction === "in" ? "rounded-bl-sm bg-sand" : "rounded-br-sm bg-mint"}`}>
                  {m.attachment && (
                    <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
                      <span className="rounded bg-clay px-1.5 py-0.5 text-[10px] text-white">{m.attachment.startsWith("brief:") ? "PDF" : "VIDEO"}</span>
                      {m.attachment.startsWith("brief:") ? "Program brief" : m.attachment.split("|")[1] ?? "Video"}
                    </span>
                  )}
                  {m.body}
                  <span className="mt-1 block text-right text-[10px] text-muted">{new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
