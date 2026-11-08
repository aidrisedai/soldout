"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Working from "@/components/Working";
import { Logo } from "@/components/Nav";

type Field = { key: string; label: string; type: "text" | "number" | "date" | "longtext" | "url"; optional?: boolean; question: string; placeholder?: string };
type Step = { answers: Record<string, string>; ack: string; done: boolean; field?: Field; step?: number; total?: number };

const input =
  "w-full rounded-2xl border-2 border-line bg-paper px-5 py-4 text-lg text-ink placeholder:text-muted/70 outline-none transition focus:border-clay focus:ring-4 focus:ring-clay/10";

// The prompt an organizer can paste into ChatGPT or Claude to write their program details.
function aiPrompt(a: Record<string, string>) {
  const facts = [
    a.name && `Program: ${a.name}`,
    a.organization && `Organization: ${a.organization}`,
    a.audience && `For: ${a.audience}`,
    a.price && `Price: ${a.price}`,
    a.goalSeats && `Seats: ${a.goalSeats}`,
    a.deadline && `Enrollment deadline: ${a.deadline}`,
    a.intent && `In my words: ${a.intent}`,
  ].filter(Boolean).join("\n");
  return `I run a paid in-person program and need a clear "answer pack" that an assistant will use to answer parents' questions. Using ONLY the facts below (and asking me for anything missing), write:

1. A short overview: who it's for, what students do, what they leave with
2. Schedule and format (dates, times, place or online)
3. Who teaches
4. Price and how to enroll (step by step)
5. The 12 questions parents ask most, each with a short answer

Rules: don't invent numbers, testimonials or results. Where you're not sure, write "check" so I can confirm it.

My facts:
${facts}`;
}

export default function Onboarding() {
  const [step, setStep] = useState<Step | null>(null);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<{ answers: Record<string, string>; step: Step }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ id?: string; keyword?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  async function advance(answers: Record<string, string>, lastKey?: string) {
    setThinking(true);
    const r = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers, lastKey }) });
    const s: Step = await r.json();
    setStep(s);
    setValue(s.field ? s.answers[s.field.key] ?? "" : "");
    setThinking(false);
  }

  useEffect(() => { advance({}); }, []);
  useEffect(() => { ref.current?.focus(); }, [step?.field?.key, thinking]);

  async function submit(skip = false) {
    if (!step?.field) return;
    const v = value.trim();
    if (!v && !(skip && step.field.optional)) return;
    setHistory((h) => [...h, { answers: step.answers, step }]);
    const answers = { ...step.answers, ...(skip ? { [`${step.field.key}__skipped`]: "1" } : { [step.field.key]: v }) };
    await advance(answers, skip ? undefined : step.field.key);
  }

  function back() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setStep(prev.step);
    setValue(prev.step.field ? prev.answers[prev.step.field.key] ?? "" : "");
  }

  async function exampleFill() {
    const ex = (await (await fetch("/api/example")).json()) as Record<string, string>;
    const answers = { organizerName: ex.organizerName, intent: "Fill our EdAI Founder cohort", organization: ex.organization, name: ex.name, goalSeats: ex.goalSeats, deadline: ex.deadline, price: ex.price, audience: ex.audience, content: ex.content, applyLink: ex.applyLink };
    setHistory([]);
    setStep({ answers, ack: "Loaded the EdAI example. Review it and create the campaign.", done: true });
  }

  async function create() {
    if (!step) return;
    setCreating(true);
    const a = step.answers;
    const fd = new FormData();
    for (const k of ["organizerName", "organization", "name", "goalSeats", "deadline", "price", "audience", "applyLink"]) if (a[k]) fd.append(k, a[k]);
    fd.append("content", a.intent && a.content && !a.content.includes(a.intent) ? `${a.content}\n\nOrganizer's note: ${a.intent}` : a.content ?? a.intent ?? "");
    const r = await fetch("/api/events", { method: "POST", body: fd });
    const j = await r.json();
    setResult(j);
    if (j.id) setTimeout(() => (window.location.href = "/dashboard"), 6500);
    else setCreating(false);
  }

  const f = step?.field;
  const pct = step?.done ? 100 : step?.step && step.total ? Math.round(((step.step - 1) / step.total) * 100) : 0;

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          <button onClick={exampleFill} className="text-muted underline underline-offset-2 hover:text-ink">Use the EdAI example</button>
          <Link href="/dashboard" className="text-muted hover:text-ink">Dashboard</Link>
        </div>
      </header>
      <div className="mx-auto h-1 w-full max-w-3xl px-5">
        <div className="h-1 overflow-hidden rounded-full bg-sand"><div className="h-1 rounded-full bg-clay transition-all duration-500" style={{ width: `${pct}%` }} /></div>
      </div>

      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
        {!step || thinking ? (
          <div className="mx-auto w-full max-w-md">
            <Working compact steps={step ? ["Reading your answer…", "Filling in what you already told me…", "Thinking about the next question…"] : ["Getting ready…"]} interval={1200} />
          </div>
        ) : step.done ? (
          <div key="review" className="animate-[fadeonly_.35s_ease]">
            {step.ack && <p className="font-display text-lg italic text-clay">{step.ack}</p>}
            <h1 className="font-display mt-3 text-4xl leading-tight">Here’s your campaign.</h1>
            <p className="mt-2 text-muted">SoldOut takes it from here: strategy, research, outreach and every conversation, on its own.</p>
            <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
              {[["Your name", "organizerName"], ["Organization", "organization"], ["Program", "name"], ["Seats", "goalSeats"], ["By", "deadline"], ["Price", "price"], ["For", "audience"], ["Enroll link", "applyLink"]].map(([l, k]) =>
                step.answers[k] ? (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3 text-sm"><dt className="text-muted">{l}</dt><dd className="text-right font-semibold">{step.answers[k]}</dd></div>
                ) : null,
              )}
              <div className="flex justify-between gap-4 px-5 py-3 text-sm"><dt className="text-muted">Program details</dt><dd className="font-semibold">{(step.answers.content ?? "").length.toLocaleString()} characters</dd></div>
            </dl>
            {result?.error && <p className="mt-4 rounded-xl bg-clay/10 p-3 text-sm text-clay-dark">{result.error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} disabled={!history.length} className="text-sm text-muted underline disabled:opacity-0">← Back</button>
              <button onClick={create} className="rounded-full bg-clay px-8 py-4 text-lg font-bold text-white hover:bg-clay-dark">Create campaign →</button>
            </div>
          </div>
        ) : f ? (
          <form key={f.key} onSubmit={(e) => { e.preventDefault(); submit(); }} className="animate-[fadeonly_.35s_ease]">
            {step.ack && <p className="font-display text-lg italic text-clay">{step.ack}</p>}
            <h1 className="font-display mt-3 text-[2rem] leading-tight sm:text-4xl">{f.question}</h1>

            <div className="mt-8">
              {f.type === "longtext" ? (
                <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} rows={f.key === "content" ? 8 : 3} placeholder={f.placeholder}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); if (e.key === "Enter" && !e.shiftKey && f.key !== "content") { e.preventDefault(); submit(); } }}
                  className={`${input} ${f.key === "content" ? "font-mono text-sm" : ""}`} />
              ) : (
                <input ref={ref} value={value} onChange={(e) => setValue(e.target.value)} type={f.type === "url" ? "url" : f.type} placeholder={f.placeholder} className={input} />
              )}
            </div>

            {f.key === "content" && (
              <div className="mt-4 rounded-2xl border border-dashed border-clay/40 bg-paper p-4">
                <p className="text-sm font-semibold">Don’t have this written down?</p>
                <p className="mt-1 text-sm text-muted">Copy this prompt into ChatGPT or Claude. It already includes what you told me. Paste the answer back here.</p>
                <pre className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl bg-sand/60 p-3 text-xs text-ink/80">{aiPrompt(step.answers)}</pre>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(aiPrompt(step.answers)); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream">
                    {copied ? "Copied ✓" : "Copy prompt"}
                  </button>
                  <label className="cursor-pointer text-sm font-semibold text-clay underline underline-offset-2">
                    or upload a file
                    <input type="file" accept=".md,.markdown,.txt,.csv,.html,.htm,.json" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setValue(await file.text()); }} />
                  </label>
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button type="button" onClick={back} disabled={!history.length} className="text-sm text-muted underline disabled:opacity-0">← Back</button>
              <div className="flex items-center gap-3">
                {f.optional && <button type="button" onClick={() => submit(true)} className="rounded-full px-4 py-3 text-sm font-semibold text-muted hover:bg-sand">Skip</button>}
                <button disabled={!value.trim()} className="rounded-full bg-clay px-7 py-3.5 font-bold text-white transition hover:bg-clay-dark disabled:opacity-40">Continue →</button>
              </div>
            </div>
            <p className="mt-4 text-right text-xs text-muted">{f.type === "longtext" && f.key === "content" ? "⌘/Ctrl + Enter to continue" : "Press Enter to continue"}</p>
          </form>
        ) : null}
      </section>

      {(creating || result?.id) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-cream/95 p-6 backdrop-blur">
          <div className="w-full max-w-md rounded-3xl border border-line bg-paper p-8 shadow-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-clay">Autopilot</p>
            <h2 className="font-display mt-2 text-3xl">SoldOut is taking over.</h2>
            {result?.keyword && <p className="mt-2 text-sm text-muted">Families will text <b className="text-ink">JOIN {result.keyword}</b></p>}
            <Working steps={["Saving your goal and content…", "Reading your program content…", "Drafting fit questions for parents…", "Starting the strategy: what’s in the way, what to try…", "Opening your campaign dashboard…"]} interval={1300} />
          </div>
        </div>
      )}
    </main>
  );
}
