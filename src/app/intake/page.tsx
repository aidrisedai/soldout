"use client";

import Link from "next/link";
import { useState } from "react";

const FIELDS: { name: string; label: string; placeholder?: string; type?: string; required?: boolean; half?: boolean }[] = [
  { name: "organizerName", label: "Organizer name", placeholder: "Dr. Azeez Idris", required: true, half: true },
  { name: "organization", label: "Organization", placeholder: "EdAI", required: true, half: true },
  { name: "name", label: "Program / event name", placeholder: "Founder, 12 weeks from Nov 15", required: true },
  { name: "goalSeats", label: "Goal: seats", type: "number", placeholder: "20", half: true },
  { name: "deadline", label: "Goal: deadline", type: "date", half: true },
  { name: "price", label: "Price", placeholder: "$1,200 per student", half: true },
  { name: "dateText", label: "Date & time", placeholder: "Sundays 8:30–10 AM PT from Nov 15", half: true },
  { name: "place", label: "Place", placeholder: "Online / MAPS Redmond", half: true },
  { name: "audience", label: "Audience", placeholder: "Parents of grades 6–12", half: true },
  { name: "applyLink", label: "Enrollment / apply link", placeholder: "https://…", half: true },
  { name: "paymentLink", label: "Stripe payment link (test mode)", placeholder: "https://buy.stripe.com/test_…", half: true },
  { name: "keyword", label: "JOIN keyword (optional)", placeholder: "EDAI", half: true },
];

export default function Intake() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id?: string; keyword?: string; error?: string; skipped?: string[]; fitQuestions?: { question: string }[] } | null>(null);

  async function fillExample() {
    const ex = (await (await fetch("/api/example")).json()) as Record<string, string>;
    const form = document.getElementById("intake-form") as HTMLFormElement;
    for (const [k, v] of Object.entries(ex)) {
      const el = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) el.value = v;
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const r = await fetch("/api/events", { method: "POST", body: new FormData(e.currentTarget) });
    setResult(await r.json());
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-zinc-50 p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-4 text-sm text-zinc-500"><Link href="/" className="underline">SoldOut</Link> / intake</nav>
        <h1 className="text-2xl font-bold">New event</h1>
        <p className="mb-6 text-sm text-zinc-600">Each submission is its own event with its own JOIN keyword. The agent answers only from the content you give here.</p>

        <button type="button" onClick={fillExample} className="mb-3 rounded border bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">Fill with EdAI example</button>
        <form id="intake-form" onSubmit={submit} className="space-y-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.name} className={`block text-sm ${f.half ? "" : "md:col-span-2"}`}>
                <span className="font-medium">{f.label}{f.required && " *"}</span>
                <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} className="mt-1 w-full rounded border px-3 py-2" />
              </label>
            ))}
          </div>

          <label className="block text-sm">
            <span className="font-medium">Content *</span>
            <span className="block text-xs text-zinc-500">FAQ, program details, policies. Mark anything unconfirmed with “check” and the agent will route it to you.</span>
            <textarea name="content" rows={10} className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs" placeholder="Paste your answer pack here…" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">…or upload files</span>
            <span className="block text-xs text-zinc-500">.md, .txt, .csv, .html. For PDFs or Docs, paste the text above.</span>
            <input name="files" type="file" multiple accept=".md,.markdown,.txt,.csv,.json,.html,.htm" className="mt-1 block text-sm" />
          </label>

          <label className="block text-sm">
            <span className="font-medium">Fit questions (one per line)</span>
            <span className="block text-xs text-zinc-500">Leave empty and SoldOut drafts 2–4 from your content.</span>
            <textarea name="fitQuestions" rows={4} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </label>

          <label className="block text-sm">
            <span className="font-medium">Clips (one per line)</span>
            <span className="block text-xs text-zinc-500">Title | https://link | what question it answers</span>
            <textarea name="clips" rows={3} className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Intro to EdAI | https://… | what is EdAI?" />
          </label>

          <button disabled={busy} className="rounded bg-zinc-900 px-5 py-2 font-semibold text-white disabled:opacity-50">
            {busy ? "Creating…" : "Create event"}
          </button>
        </form>

        {result && (
          <div className={`mt-6 rounded-xl p-4 text-sm ${result.error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>
            {result.error ? result.error : (
              <>
                <p className="font-semibold">Created. Parents text <code className="rounded bg-white px-1">JOIN {result.keyword}</code></p>
                {result.fitQuestions && (
                  <ol className="mt-2 list-decimal pl-5">{result.fitQuestions.map((q, i) => <li key={i}>{q.question}</li>)}</ol>
                )}
                {!!result.skipped?.length && <p className="mt-2">Skipped (paste as text): {result.skipped.join(", ")}</p>}
                <p className="mt-2">SoldOut is drafting your strategy now (about 30 seconds).</p>
                <p className="mt-3"><Link className="rounded bg-emerald-700 px-3 py-1.5 font-semibold text-white" href="/dashboard">Open dashboard →</Link></p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
