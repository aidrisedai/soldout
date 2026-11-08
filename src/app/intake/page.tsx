"use client";

import Link from "next/link";
import { useState } from "react";

const input =
  "mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-[15px] text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

function Field({ label, name, placeholder, type = "text", required, hint }: { label: string; name: string; placeholder?: string; type?: string; required?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-800">
        {label} {required ? <span className="text-rose-500">*</span> : <span className="font-normal text-zinc-400">(optional)</span>}
      </span>
      <input name={name} type={type} required={required} placeholder={placeholder} className={input} />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

function Area({ label, name, placeholder, rows = 3, hint }: { label: string; name: string; placeholder?: string; rows?: number; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-zinc-800">{label} <span className="font-normal text-zinc-400">(optional)</span></span>
      <textarea name={name} rows={rows} placeholder={placeholder} className={input} />
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export default function Intake() {
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [result, setResult] = useState<{ id?: string; keyword?: string; error?: string; skipped?: string[] } | null>(null);

  async function fillExample() {
    const ex = (await (await fetch("/api/example")).json()) as Record<string, string>;
    setMore(true);
    setTimeout(() => {
      const form = document.getElementById("intake-form") as HTMLFormElement;
      for (const [k, v] of Object.entries(ex)) {
        const el = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el) el.value = v;
      }
    }, 0);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const r = await fetch("/api/events", { method: "POST", body: new FormData(e.currentTarget) });
    const j = await r.json();
    setResult(j);
    setBusy(false);
    if (j.id) setTimeout(() => (window.location.href = "/dashboard"), 1500);
  }

  return (
    <main className="min-h-screen bg-zinc-100">
      <header className="bg-zinc-950 text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-black tracking-tight">Sold<span className="text-emerald-400">Out</span></Link>
          <Link href="/dashboard" className="text-sm text-zinc-300 hover:text-white">Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-3xl font-black tracking-tight">Start a campaign</h1>
        <p className="mt-2 text-zinc-600">
          Just the basics. SoldOut drafts your strategy the moment you submit.{" "}
          <button type="button" onClick={fillExample} className="font-semibold text-emerald-700 underline underline-offset-2">Try the EdAI example</button>
        </p>

        <form id="intake-form" onSubmit={submit} className="mt-6 space-y-5 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
          <Field label="What are you filling?" name="name" placeholder="e.g. Founder program, 12 weeks" required />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Seats" name="goalSeats" type="number" placeholder="e.g. 20" required />
            <Field label="By when" name="deadline" type="date" required />
          </div>

          <Field label="Price" name="price" placeholder="e.g. $1,200 per student" />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" name="organizerName" placeholder="e.g. Azeez Idris" required />
            <Field label="Organization" name="organization" placeholder="e.g. EdAI" required />
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-zinc-800">About the program <span className="text-rose-500">*</span></span>
            <span className="mt-0.5 block text-xs text-zinc-500">Paste your FAQ or program details. SoldOut only answers from this; anything marked “check” comes to you.</span>
            <textarea name="content" rows={6} placeholder="Who it's for, schedule, what students do, price, how to apply…" className={input} />
            <span className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <label className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-1.5 font-semibold text-zinc-700 hover:bg-zinc-50">
                Upload a file instead
                <input
                  name="files"
                  type="file"
                  multiple
                  accept=".md,.markdown,.txt,.csv,.json,.html,.htm"
                  className="hidden"
                  onChange={(e) => setFileNames(Array.from(e.target.files ?? []).map((f) => f.name))}
                />
              </label>
              <span className="text-xs text-zinc-500">{fileNames.length ? fileNames.join(", ") : ".md, .txt, .csv or .html"}</span>
            </span>
          </label>

          <button type="button" onClick={() => setMore(!more)} className="flex w-full items-center justify-between rounded-xl border border-dashed border-zinc-300 px-4 py-3 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
            <span>{more ? "− Hide extra details" : "+ Add more details"} <span className="font-normal text-zinc-500">(optional: schedule, links, your accounts, network…)</span></span>
          </button>

          {more && (
            <div className="space-y-5 rounded-2xl bg-zinc-50 p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Program</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Schedule" name="dateText" placeholder="e.g. Sundays 8:30–10 AM PT" />
                <Field label="Where" name="place" placeholder="e.g. Online" />
              </div>
              <Field label="Who it's for" name="audience" placeholder="e.g. Parents of grades 6–12" />

              <p className="pt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Enrollment</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Apply / enroll link" name="applyLink" placeholder="https://…" />
                <Field label="Stripe link (test mode)" name="paymentLink" placeholder="https://buy.stripe.com/test_…" />
              </div>
              <Field label="JOIN keyword" name="keyword" placeholder="e.g. FOUNDER" hint="Families text JOIN + this word. Leave empty and SoldOut picks one." />

              <p className="pt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">You (outreach goes out in your voice)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your LinkedIn" name="acctLinkedin" placeholder="https://linkedin.com/in/…" />
                <Field label="Your Instagram" name="acctInstagram" placeholder="@handle" />
              </div>
              <Field label="Email outreach sends from" name="acctEmail" placeholder="e.g. you@agentmail.to" />

              <p className="pt-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Conversation</p>
              <Area label="Fit questions" name="fitQuestions" placeholder={"One per line. Leave empty and SoldOut drafts them from your content."} />
              <Area label="Videos to use" name="clips" placeholder="Title | https://link | what it answers" hint="SoldOut also finds videos in your Drive on its own." />
              <Area label="Your network" name="network" placeholder="Name | how you know them | community | email or profile" hint="People who already know you, for warm introductions." />
            </div>
          )}

          {result?.error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{result.error}</div>}
          {result?.id && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold">Campaign created. Families will text <code className="rounded bg-white px-1.5">JOIN {result.keyword}</code></p>
              <p className="mt-1">Drafting your strategy now. Taking you to the dashboard…</p>
            </div>
          )}

          <button disabled={busy || !!result?.id} className="w-full rounded-xl bg-zinc-950 py-4 text-base font-bold text-white transition hover:bg-zinc-800 disabled:opacity-60">
            {busy ? "Creating your campaign…" : "Create campaign →"}
          </button>
          <p className="-mt-2 text-center text-xs text-zinc-500">Nothing is sent to anyone until you approve.</p>
        </form>
      </div>
    </main>
  );
}
