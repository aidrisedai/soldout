"use client";

import Link from "next/link";
import { useState } from "react";

type Field = { name: string; label: string; placeholder?: string; type?: string; required?: boolean; full?: boolean };

const SECTIONS: { title: string; hint: string; fields: Field[] }[] = [
  {
    title: "1 · The goal",
    hint: "What does “sold out” mean for this program?",
    fields: [
      { name: "name", label: "Program name", placeholder: "Founder: 12 weeks from Nov 15", required: true, full: true },
      { name: "goalSeats", label: "Seats to fill", type: "number", placeholder: "20" },
      { name: "deadline", label: "By when", type: "date" },
      { name: "price", label: "Price", placeholder: "$1,200 per student" },
      { name: "dateText", label: "Schedule", placeholder: "Sundays 8:30–10 AM PT from Nov 15" },
      { name: "place", label: "Where", placeholder: "Online / MAPS Redmond" },
      { name: "audience", label: "Who it’s for", placeholder: "Parents of grades 6–12" },
    ],
  },
  {
    title: "2 · You",
    hint: "Outreach goes out mostly in your voice. Tell SoldOut who you are and where you can be reached.",
    fields: [
      { name: "organizerName", label: "Your name", placeholder: "Dr. Azeez Idris", required: true },
      { name: "organization", label: "Organization", placeholder: "EdAI", required: true },
      { name: "acctLinkedin", label: "Your LinkedIn", placeholder: "https://linkedin.com/in/…" },
      { name: "acctInstagram", label: "Your Instagram", placeholder: "@edai" },
      { name: "acctEmail", label: "Email outreach sends from", placeholder: "edai-admin@agentmail.to" },
      { name: "keyword", label: "JOIN keyword (optional)", placeholder: "FOUNDER" },
    ],
  },
  {
    title: "3 · Enrollment",
    hint: "Where families go when they’re ready.",
    fields: [
      { name: "applyLink", label: "Apply / enroll link", placeholder: "https://…" },
      { name: "paymentLink", label: "Stripe payment link (test mode)", placeholder: "https://buy.stripe.com/test_…" },
    ],
  },
];

export default function Intake() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ id?: string; keyword?: string; error?: string; skipped?: string[] } | null>(null);

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
    const j = await r.json();
    setResult(j);
    setBusy(false);
    if (j.id) setTimeout(() => (window.location.href = "/dashboard"), 1800);
  }

  return (
    <main className="min-h-screen bg-zinc-100">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-black tracking-tight">Sold<span className="text-emerald-400">Out</span></Link>
          <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Start a campaign</h1>
            <p className="mt-1 text-zinc-600">About five minutes. SoldOut drafts the strategy the moment you submit.</p>
          </div>
          <button type="button" onClick={fillExample} className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50">
            Fill with EdAI example
          </button>
        </div>

        <form id="intake-form" onSubmit={submit} className="mt-6 space-y-5">
          {SECTIONS.map((sec) => (
            <section key={sec.title} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black">{sec.title}</h2>
              <p className="mb-4 text-sm text-zinc-500">{sec.hint}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {sec.fields.map((f) => (
                  <label key={f.name} className={`block text-sm ${f.full ? "md:col-span-2" : ""}`}>
                    <span className="font-semibold">{f.label}{f.required && <span className="text-rose-500"> *</span>}</span>
                    <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  </label>
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">4 · Your content</h2>
            <p className="mb-4 text-sm text-zinc-500">SoldOut answers only from this. Mark anything unconfirmed with “check” and it comes to you instead.</p>
            <textarea name="content" rows={9} className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 font-mono text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" placeholder="Paste your FAQ, program details, policies…" />
            <label className="mt-3 block text-sm">
              <span className="font-semibold">…or upload files</span> <span className="text-zinc-500">(.md, .txt, .csv, .html)</span>
              <input name="files" type="file" multiple accept=".md,.markdown,.txt,.csv,.json,.html,.htm" className="mt-1 block text-sm" />
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold">Fit questions</span> <span className="text-zinc-500">(one per line, or leave empty to draft from your content)</span>
                <textarea name="fitQuestions" rows={4} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Videos to use</span> <span className="text-zinc-500">(optional; SoldOut also finds them in your Drive)</span>
                <textarea name="clips" rows={4} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Title | https://link | what it answers" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black">5 · Your network</h2>
            <p className="mb-4 text-sm text-zinc-500">People who already know you, for warm introductions when a direct message isn’t the right move. One per line.</p>
            <textarea name="network" rows={4} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Name | how you know them | community | email or profile" />
          </section>

          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-4 text-white shadow-xl">
            <p className="text-sm text-zinc-300">Nothing is sent to anyone until you approve.</p>
            <button disabled={busy} className="rounded-xl bg-emerald-500 px-6 py-3 font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60">
              {busy ? "Creating…" : "Create campaign →"}
            </button>
          </div>
        </form>

        {result && (
          <div className={`mt-6 rounded-2xl p-5 text-sm ${result.error ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-900"}`}>
            {result.error ? result.error : (
              <>
                <p className="text-base font-bold">Campaign created. Families will text <code className="rounded bg-white px-1.5">JOIN {result.keyword}</code></p>
                <p className="mt-1">SoldOut is drafting your strategy and looking for videos in your Drive. Taking you to the dashboard…</p>
                {!!result.skipped?.length && <p className="mt-2">Skipped (paste as text instead): {result.skipped.join(", ")}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
