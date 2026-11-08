"use client";

import { useCallback, useEffect, useState } from "react";

type Item = { id: string; title: string; url: string; answers: string; source: string; status: string };
type Task = { status: string; message: string | null; createdAt: string } | null;

// Videos found by Dot on the organizer's Drive. Only approved ones reach parents.
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

  async function askDot() {
    setError("");
    const r = await fetch(`/api/events/${eventId}/media`, { method: "POST" });
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
    <div className="mt-6 rounded-lg border p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">Videos for parents</h3>
        <button onClick={askDot} disabled={running} className="rounded border px-2 py-0.5 text-sm hover:bg-zinc-50 disabled:opacity-50">
          {running ? "Dot is searching Drive…" : "Ask Dot for videos"}
        </button>
      </div>
      <p className="mb-2 text-xs text-zinc-500">Dot (ChatGPT on the Mobilerun phone) picks and shares videos from your Drive. The agent only sends the ones you approve.</p>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      {task?.status === "failed" && <p className="text-sm text-rose-700">Dot couldn’t finish: {task.message}</p>}
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-zinc-50 p-2 text-sm">
            <div className="min-w-0">
              <a href={m.url} target="_blank" rel="noreferrer" className="font-medium underline">{m.title}</a>
              <div className="text-xs text-zinc-500">Answers: {m.answers} · from {m.source}</div>
            </div>
            {m.status === "proposed" ? (
              <div className="flex gap-1">
                <button onClick={() => decide(m.id, "approved")} className="rounded bg-emerald-600 px-2 py-0.5 text-white">Approve</button>
                <button onClick={() => decide(m.id, "rejected")} className="rounded border px-2 py-0.5">Reject</button>
              </div>
            ) : (
              <span className={`rounded-full px-2 py-0.5 text-xs ${m.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200"}`}>{m.status}</span>
            )}
          </li>
        ))}
        {!items.length && !running && <li className="text-sm text-zinc-500">No videos yet.</li>}
      </ul>
    </div>
  );
}
