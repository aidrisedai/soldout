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
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState("");
  const [building, setBuilding] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [gaps, setGaps] = useState<{ key: string; question: string }[]>([]);
  const [gapIdx, setGapIdx] = useState(0);
  const [read, setRead] = useState<{ name: string; ok: boolean }[]>([]);
  const [consent, setConsent] = useState(false);
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

  async function buildBrief() {
    if (!step) return;
    setBriefError("");
    setBuilding(true);
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("links", links);
    fd.append("notes", value);
    fd.append("known", JSON.stringify(step.answers));
    const r = await fetch("/api/onboarding/brief", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({ error: "Something went wrong" }));
    setBuilding(false);
    if (!r.ok) { setBriefError(j.error ?? "Couldn’t build the brief"); return; }
    const facts = (j.facts ?? {}) as Record<string, string>;
    const answers: Record<string, string> = { ...step.answers, content: j.brief as string };
    for (const [k, v] of Object.entries(facts)) if (v && !answers[k]) answers[k] = String(v);
    setRead(j.read ?? []);
    setHistory((h) => [...h, { answers: step.answers, step }]);
    setStep({ ...step, answers });
    setGaps(j.gaps ?? []);
    setGapIdx(0);
    setValue("");
    if (!(j.gaps ?? []).length) await advance(answers, undefined);
  }

  async function answerGap(skip = false) {
    if (!step) return;
    const g = gaps[gapIdx];
    const v = value.trim();
    const answers = { ...step.answers };
    if (!skip && v) answers.content = `${answers.content ?? ""}\n\n## From the organizer\n**${g.question}**\n${v}`;
    setStep({ ...step, answers });
    setValue("");
    if (gapIdx + 1 < gaps.length) setGapIdx(gapIdx + 1);
    else { setGaps([]); await advance(answers, undefined); }
  }

  async function savePeople(skip: boolean) {
    if (!step) return;
    setHistory((h) => [...h, { answers: step.answers, step }]);
    const answers = skip ? { ...step.answers, people__skipped: "1" } : { ...step.answers, people: value.trim(), peopleConsent: consent ? "yes" : "no" };
    setValue("");
    await advance(answers, undefined);
  }

  async function chooseMode(mode: "approve" | "auto") {
    if (!step) return;
    setHistory((h) => [...h, { answers: step.answers, step }]);
    await advance({ ...step.answers, mode }, undefined);
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
    const answers = { organizerName: ex.organizerName, intent: "Fill our EdAI Founder cohort", organization: ex.organization, name: ex.name, goalSeats: ex.goalSeats, deadline: ex.deadline, price: ex.price, audience: ex.audience, content: ex.content, applyLink: ex.applyLink, mode: "approve" };
    setHistory([]);
    setStep({ answers, ack: "Loaded the EdAI example. Review it and create the campaign.", done: true });
  }

  async function create() {
    if (!step) return;
    setCreating(true);
    const a = step.answers;
    const fd = new FormData();
    for (const k of ["organizerName", "organization", "name", "goalSeats", "deadline", "price", "audience", "applyLink", "dateText", "place", "mode", "people", "peopleConsent"]) if (a[k]) fd.append(k, a[k]);
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
              {step.answers.people && step.answers.peopleConsent === "yes" && (
                <div className="flex justify-between gap-4 px-5 py-3 text-sm"><dt className="text-muted">Your contacts</dt><dd className="font-semibold">{step.answers.people.split(/\n/).filter((l) => l.trim() && !/^name\s*[|,]/i.test(l.trim())).length} people, reached directly</dd></div>
              )}
              <div className="flex justify-between gap-4 px-5 py-3 text-sm"><dt className="text-muted">Runs</dt><dd className="font-semibold">{step.answers.mode === "auto" ? "Fully autonomous" : "You approve each step"}</dd></div>
            </dl>
            <details className="mt-4 rounded-2xl border border-line bg-paper p-4">
              <summary className="cursor-pointer text-sm font-semibold">Your program brief <span className="font-normal text-muted">({(step.answers.content ?? "").length.toLocaleString()} characters · tap to read or edit)</span></summary>
              <textarea value={step.answers.content ?? ""} onChange={(e) => setStep({ ...step, answers: { ...step.answers, content: e.target.value } })} rows={14} className="mt-3 w-full rounded-xl border border-line bg-paper p-3 font-mono text-xs" />
            </details>
            {result?.error && <p className="mt-4 rounded-xl bg-clay/10 p-3 text-sm text-clay-dark">{result.error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} disabled={!history.length} className="text-sm text-muted underline disabled:opacity-0">← Back</button>
              <button onClick={create} className="rounded-full bg-clay px-8 py-4 text-lg font-bold text-white hover:bg-clay-dark">Create campaign →</button>
            </div>
          </div>
        ) : building ? (
          <div className="mx-auto w-full max-w-md">
            <h1 className="font-display text-3xl">Building your program brief…</h1>
            <Working
              steps={[
                files.length ? `Reading ${files.length} file${files.length > 1 ? "s" : ""}…` : "Reading what you told me…",
                links.trim() ? "Opening your links…" : "Collecting the facts…",
                "Writing the brief: who it’s for, schedule, price, how to enroll…",
                "Drafting the questions parents usually ask…",
                "Checking what’s still missing…",
              ]}
              interval={5000}
            />
          </div>
        ) : gaps.length && step.answers.content ? (
          <form key={`gap-${gapIdx}`} onSubmit={(e) => { e.preventDefault(); answerGap(); }} className="animate-[fadeonly_.35s_ease]">
            <p className="font-display text-lg italic text-clay">
              {gapIdx === 0 ? `I’ve built your brief${read.length ? ` from ${read.filter((r) => r.ok).length} source${read.filter((r) => r.ok).length === 1 ? "" : "s"}` : ""}. ${gaps.length === 1 ? "One thing" : `${gaps.length} things`} I couldn’t find:` : `Thanks. ${gaps.length - gapIdx} more:`}
            </p>
            <h1 className="font-display mt-3 text-[2rem] leading-tight sm:text-4xl">{gaps[gapIdx].question}</h1>
            <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} rows={3} className={`${input} mt-8`}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); answerGap(); } }} />
            <div className="mt-8 flex items-center justify-between">
              <span className="text-xs text-muted">Question {gapIdx + 1} of {gaps.length}</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => answerGap(true)} className="rounded-full px-4 py-3 text-sm font-semibold text-muted hover:bg-sand">I’ll add it later</button>
                <button disabled={!value.trim()} className="rounded-full bg-clay px-7 py-3.5 font-bold text-white hover:bg-clay-dark disabled:opacity-40">Continue →</button>
              </div>
            </div>
          </form>
        ) : f?.key === "content" ? (
          <div key="brief" className="animate-[fadeonly_.35s_ease]">
            {step.ack && <p className="font-display text-lg italic text-clay">{step.ack}</p>}
            <h1 className="font-display mt-3 text-[2rem] leading-tight sm:text-4xl">Give me everything you have about the program.</h1>
            <p className="mt-3 text-muted">Brochures, FAQs, flyers, your program page, the apply form. I’ll read it all and build the brief, then ask only what’s missing.</p>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line bg-paper px-6 py-8 text-center transition hover:border-clay">
              <span className="text-3xl">📄</span>
              <span className="mt-2 font-semibold">Upload files</span>
              <span className="text-xs text-muted">PDF, Word (.docx), text, markdown, HTML · up to 15 MB each</span>
              <input type="file" multiple accept=".pdf,.docx,.md,.markdown,.txt,.csv,.html,.htm,.json" className="hidden"
                onChange={(e) => setFiles((cur) => [...cur, ...Array.from(e.target.files ?? [])])} />
            </label>
            {!!files.length && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {files.map((fl, k) => (
                  <li key={k} className="flex items-center gap-2 rounded-full bg-sand px-3 py-1 text-xs">
                    {fl.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, i) => i !== k))} className="text-muted hover:text-ink">×</button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-semibold">Links</span> <span className="text-xs text-muted">(program page, apply page, public Google Docs; one per line)</span>
              <textarea value={links} onChange={(e) => setLinks(e.target.value)} rows={2} placeholder="https://…" className={`${input} mt-1.5 text-base`} />
            </label>

            <button type="button" disabled className="mt-4 flex w-full items-center justify-between rounded-2xl border border-line bg-sand/40 px-5 py-4 text-left">
              <span className="flex items-center gap-3"><span className="text-xl">🗂️</span><span><span className="block font-semibold text-ink/70">Connect Google Drive</span><span className="block text-xs text-muted">Pull in docs, videos and brand files automatically</span></span></span>
              <span className="rounded-full bg-mustard/40 px-2.5 py-1 text-[11px] font-bold uppercase text-night">Coming soon</span>
            </button>

            <details className="mt-4 rounded-2xl border border-line bg-paper p-4">
              <summary className="cursor-pointer text-sm font-semibold">No documents yet? Type a few lines, or use a prompt</summary>
              <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder="Who it’s for, schedule, what participants do, price, how to enroll…" className={`${input} mt-3 text-base`} />
              <p className="mt-3 text-xs text-muted">Or paste this into ChatGPT or Claude and drop the answer above:</p>
              <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap rounded-xl bg-sand/60 p-3 text-xs text-ink/80">{aiPrompt(step.answers)}</pre>
              <button type="button" onClick={() => { navigator.clipboard.writeText(aiPrompt(step.answers)); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="mt-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-cream">{copied ? "Copied ✓" : "Copy prompt"}</button>
            </details>

            {briefError && <p className="mt-4 rounded-xl bg-clay/10 p-3 text-sm text-clay-dark">{briefError}</p>}
            <div className="mt-8 flex items-center justify-between">
              <button type="button" onClick={back} disabled={!history.length} className="text-sm text-muted underline disabled:opacity-0">← Back</button>
              <button type="button" onClick={buildBrief} disabled={!files.length && !links.trim() && !value.trim()} className="rounded-full bg-clay px-7 py-3.5 font-bold text-white hover:bg-clay-dark disabled:opacity-40">Build my brief →</button>
            </div>
          </div>
        ) : f?.key === "people" ? (
          <div key="people" className="animate-[fadeonly_.35s_ease]">
            {step.ack && <p className="font-display text-lg italic text-clay">{step.ack}</p>}
            <h1 className="font-display mt-3 text-[2rem] leading-tight sm:text-4xl">Anyone you already know that SoldOut should reach out to?</h1>
            <p className="mt-3 text-muted">Parents, community leaders, past families. Add whatever you know: SoldOut writes each a personal message in your voice once the campaign starts, on WhatsApp if you have their number.</p>
            <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} rows={6} className={`${input} mt-6 text-base`}
              placeholder={"One person per line: Name | phone | email | LinkedIn | what you know\nOmar Ali | +1 425 555 0101 | | | parent at MAPS, son in 9th grade, came to the Seattle summit\nSarah Khan | | sarah@school.org | linkedin.com/in/sarahk | runs the Pace Academy newsletter"} />
            <label className="mt-2 inline-block cursor-pointer text-sm font-semibold text-clay underline underline-offset-2">
              or upload a CSV
              <input type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const t = await file.text(); setValue((v) => `${v ? v + "\n" : ""}${t}`); } }} />
            </label>
            {value.trim() && (
              <label className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-paper p-4 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#b8401f]" />
                <span><b>These people know me and agreed to hear from me.</b> <span className="text-muted">SoldOut will contact them directly, without waiting for them to text JOIN.</span></span>
              </label>
            )}
            <div className="mt-8 flex items-center justify-between">
              <button type="button" onClick={back} disabled={!history.length} className="text-sm text-muted underline disabled:opacity-0">← Back</button>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => savePeople(true)} className="rounded-full px-4 py-3 text-sm font-semibold text-muted hover:bg-sand">Skip for now</button>
                <button type="button" onClick={() => savePeople(false)} disabled={!value.trim() || !consent} className="rounded-full bg-clay px-7 py-3.5 font-bold text-white hover:bg-clay-dark disabled:opacity-40">
                  Add {value.trim() ? value.trim().split(/\n/).filter((l) => l.trim()).length : ""} contact{value.trim().split(/\n/).filter((l) => l.trim()).length === 1 ? "" : "s"} →
                </button>
              </div>
            </div>
          </div>
        ) : f?.key === "mode" ? (
          <div key="mode" className="animate-[fadeonly_.35s_ease]">
            {step.ack && <p className="font-display text-lg italic text-clay">{step.ack}</p>}
            <h1 className="font-display mt-3 text-[2rem] leading-tight sm:text-4xl">How should SoldOut run your campaign?</h1>
            <div className="mt-8 grid gap-4">
              <button onClick={() => chooseMode("approve")} className="rounded-2xl border-2 border-clay bg-paper p-5 text-left transition hover:shadow-md">
                <span className="flex items-center justify-between"><span className="font-display text-2xl">I’ll approve each step</span><span className="rounded-full bg-clay px-2.5 py-1 text-[11px] font-bold uppercase text-white">Recommended for now</span></span>
                <span className="mt-2 block text-sm text-muted">SoldOut plans, researches and finds people on its own. You approve the strategy and every first message before anything goes out.</span>
              </button>
              <button onClick={() => chooseMode("auto")} className="rounded-2xl border-2 border-line bg-paper p-5 text-left transition hover:border-forest hover:shadow-md">
                <span className="font-display text-2xl">Fully autonomous</span>
                <span className="mt-2 block text-sm text-muted">SoldOut runs everything end to end: approves its own plan, reaches out (up to 10 emails a day) and talks to every family. One switch stops it any time.</span>
              </button>
            </div>
            <p className="mt-4 text-xs text-muted">You can switch between these any time from the dashboard.</p>
            <button type="button" onClick={back} disabled={!history.length} className="mt-6 text-sm text-muted underline disabled:opacity-0">← Back</button>
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
