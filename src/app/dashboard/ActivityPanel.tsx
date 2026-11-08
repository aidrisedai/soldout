"use client";

import { useCallback, useEffect, useState } from "react";
import Working from "@/components/Working";

type Item = { at: string; kind: string; text: string };

const DOT: Record<string, string> = { go: "bg-forest", paid: "bg-forest", link_sent: "bg-mustard", sent: "bg-clay", reply: "bg-clay", needs_organizer: "bg-clay", nogo: "bg-muted", warn: "bg-mustard" };

function ago(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// What autopilot is doing right now, and everything it has done, live.
export default function ActivityPanel({ eventId, now }: { eventId: string; now: { title: string; steps: string[] } | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${eventId}/activity`);
    if (r.ok) setItems((await r.json()).items);
  }, [eventId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <div className="rounded-2xl border border-line bg-sand/40 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-clay">Right now</p>
        {now ? <Working key={now.title} title={now.title} steps={now.steps} compact /> : <p className="mt-2 text-sm text-muted">Waiting for the next reply or message. Nothing needs you.</p>}
      </div>
      <div className="rounded-2xl border border-line bg-sand/40 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Activity</p>
        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-sm">
          {items.map((it) => (
            <li key={it.at + it.text} className="flex animate-[fadein_.4s_ease] items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${DOT[it.kind] ?? "bg-ink/40"}`} />
              <span className="flex-1">{it.text}</span>
              <span className="whitespace-nowrap text-xs text-muted">{ago(it.at)}</span>
            </li>
          ))}
          {!items.length && <li className="text-muted">Starting up…</li>}
        </ul>
      </div>
    </div>
  );
}
