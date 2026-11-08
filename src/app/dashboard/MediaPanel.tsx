"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; title: string; url: string; answers: string; source: string; kind: string; status: string };
type Task = { status: string; kind: string; message: string | null; createdAt: string } | null;

// Videos and PDFs from the organizer's Drive.
export default function MediaPanel({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [task, setTask] = useState<Task>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${eventId}/media`);
    const j = await r.json();
    setItems(j.items);
    setTask(j.task);
  }, [eventId]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function askDot(kind: string) {
    setError("");
    const r = await fetch(`/api/events/${eventId}/media`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind }) });
    const j = await r.json();
    if (!r.ok) setError(j.error);
    load();
  }
  async function decide(id: string, status: "approved" | "rejected") {
    await fetch(`/api/media/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  const running = task?.status === "running";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-xl">Videos & PDFs for parents</h3>
        <div className="flex flex-wrap gap-1">
          {[["find_videos", "Find videos"], ["make_pdf", "Make branded PDF"], ["make_video", "Make parent video"]].map(([k, label]) => (
            <button key={k} onClick={() => askDot(k)} disabled={running} className="rounded border px-2 py-0.5 text-sm hover:bg-sand/50 disabled:opacity-50">{label}</button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-muted">SoldOut finds the right videos in your Drive and sends them to parents when they help. Reject anything you don’t want used.</p>
      {running && <p className="mb-2 text-sm text-amber-700">Searching your Drive… WhatsApp replies pause for a minute or two.</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {task?.status === "failed" && <p className="text-sm text-rose-700">The last media request didn’t finish. Try again.</p>}
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-sand/50 p-2 text-sm">
            <div className="min-w-0">
              <a href={m.url} target="_blank" rel="noreferrer" className="font-medium underline">{m.title}</a>
              <div className="text-xs text-muted">{m.kind === "pdf" ? "PDF" : "Video"} · {m.answers} · from your Drive</div>
            </div>
            {m.status === "proposed" ? (
              <div className="flex gap-1">
                <button onClick={() => decide(m.id, "approved")} className="rounded bg-forest px-2 py-0.5 text-white">Approve</button>
                <button onClick={() => decide(m.id, "rejected")} className="rounded border px-2 py-0.5">Reject</button>
              </div>
            ) : m.status === "approved" ? (
              <div className="flex items-center gap-1">
                <span className="rounded-full bg-mint px-2 py-0.5 text-xs text-forest">in use</span>
                <button onClick={() => decide(m.id, "rejected")} className="rounded border px-2 py-0.5 text-xs">Don’t use</button>
              </div>
            ) : (
              <span className="rounded-full bg-sand px-2 py-0.5 text-xs">not used</span>
            )}
          </li>
        ))}
        {!items.length && !running && <li className="text-sm text-muted">No videos yet.</li>}
      </ul>
    </div>
  );
}
