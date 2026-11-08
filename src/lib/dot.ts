import Mobilerun from "@mobilerun/sdk";
import type { Contact, Event } from "@prisma/client";
import { db } from "./db";
import { phoneCtx } from "./waPhone";
import { deliver } from "./inbound";

// "Dot" is the organizer's ChatGPT app on the Mobilerun cloud phone, already connected
// to their Google Drive. SoldOut gives Dot instructions through a Mobilerun Agent task
// (https://docs.mobilerun.ai/api-reference/tasks/run-task) and reads the answer back
// as structured output. The WhatsApp worker pauses while Dot has the phone.

export const DEVICE_LOCK_KEY = "device_lock_until";

export async function lockDevice(ms: number) {
  const until = String(Date.now() + ms);
  await db.kV.upsert({ where: { key: DEVICE_LOCK_KEY }, create: { key: DEVICE_LOCK_KEY, value: until }, update: { value: until } });
}
export async function unlockDevice() {
  await db.kV.deleteMany({ where: { key: DEVICE_LOCK_KEY } });
}
export async function deviceLocked(): Promise<boolean> {
  const kv = await db.kV.findUnique({ where: { key: DEVICE_LOCK_KEY } });
  return !!kv && Number(kv.value) > Date.now();
}

export type DotJobKind = "find_videos" | "make_pdf" | "make_video" | "ask" | "find_for_parent";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", description: "The Google Drive link Dot returned" },
          answers: { type: "string", description: "Which parent question it answers / what it covers" },
        },
        required: ["title", "url", "answers"],
      },
    },
    dotReply: { type: "string", description: "Dot's full reply text, verbatim" },
  },
  required: ["items", "dotReply"],
};

// Facts Dot must stay within. Dot also has the organizer's Drive and brand files.
function factSheet(e: Event): string {
  return [
    `Program: ${e.name} by ${e.organization}, taught by ${e.organizerName}.`,
    e.dateText && `When: ${e.dateText}.`,
    e.place && `Format: ${e.place}.`,
    e.audience && `For: ${e.audience}.`,
    e.price && `Tuition: ${e.price}.`,
    e.applyLink && `Apply: ${e.applyLink}.`,
  ].filter(Boolean).join(" ");
}

const RULES =
  "Rules: use only facts from the fact sheet and our own program documents; leave out anything unconfirmed; " +
  "never mention installments, payment plans, refunds, discounts or scholarships; no invented quotes, stats, testimonials or outcomes; " +
  "don't feature a student's face or name unless our files say we may share it.";

// Read-only by default. Set DOT_MAY_SHARE=1 only after the organizer explicitly allows Dot to change Drive sharing.
function sharing(): string {
  return process.env.DOT_MAY_SHARE === "1"
    ? `Set sharing on the result to "Anyone with the link can view".`
    : `Do NOT change any sharing settings.`;
}

function dotPrompt(event: Event, kind: DotJobKind, ask?: string): string {
  const reply = "Reply with one line per item in this exact format: Title | full https://drive.google.com/... URL written out as plain text (not a clickable label) | the parent question it answers";
  switch (kind) {
    case "ask":
      return `${ask} (Answer briefly, under 120 words. Write any links as full URLs in plain text. ${sharing()})`;
    case "find_for_parent":
      return [
        `From my ${event.organization} Google Drive, find the ONE best finished, edited video (not raw footage) showing: ${ask}.`,
        `It is for a parent considering "${event.name}". Only pick a video we can share publicly.`,
        sharing(), reply,
      ].join(" ");
    case "find_videos":
      return [
        `From my ${event.organization} Google Drive, find up to 5 finished, edited videos (not raw camera footage) that would help ${event.audience ?? "parents"} decide about "${event.name}".`,
        `Useful topics: what ${event.organization} is, what students build, who the mentors are, what a session or demo day looks like.`,
        sharing(), reply,
      ].join(" ");
    case "make_pdf":
      return [
        `Using our NEW ${event.organization} brand files in Drive (logo, colors, fonts), create a polished one-page parent brief as a PDF for "${event.name}".`,
        `Cover: who it is for, what students do, schedule and format, who teaches, tuition, how to apply.`,
        `Fact sheet: ${factSheet(event)}`, RULES,
        `Save the PDF in a Google Drive folder named "SoldOut".`, sharing(), reply,
      ].join(" ");
    case "make_video":
      return [
        `Using our NEW ${event.organization} brand files and our finished videos in Drive, create one 30 to 60 second vertical (9:16) video for parents about "${event.name}": a hook, what students do, schedule, and how to apply.`,
        `Fact sheet: ${factSheet(event)}`, RULES,
        `Save the MP4 in a Google Drive folder named "SoldOut". If you cannot produce a video file, say exactly why.`, sharing(), reply,
      ].join(" ");
  }
}

export async function askDot(event: Event, kind: DotJobKind, opts: { ask?: string; replyTo?: Contact } = {}): Promise<string> {
  const ctx = await phoneCtx();
  if (!ctx) throw new Error("No ready Mobilerun phone");
  const job = await db.dotTask.create({ data: { eventId: event.id, kind } });
  void runDot(ctx.mr, ctx.deviceId, event, kind, job.id, opts).catch(async (e) => {
    if (opts.replyTo) await deliver(event, opts.replyTo, `Dot couldn't finish that: ${(e as Error).message}`).catch(() => {});
    await db.dotTask.update({ where: { id: job.id }, data: { status: "failed", message: (e as Error).message } });
    await unlockDevice();
  });
  return job.id;
}

async function runDot(mr: Mobilerun, deviceId: string, event: Event, kind: DotJobKind, jobId: string, opts: { ask?: string; replyTo?: Contact } = {}) {
  const long = kind === "make_pdf" || kind === "make_video";
  if (opts.replyTo) await new Promise((r) => setTimeout(r, 10_000)); // let the worker send the "asking Dot" ack first
  await lockDevice((long ? 45 : 20) * 60_000);
  await new Promise((r) => setTimeout(r, 4000)); // let the WhatsApp worker finish its current step

  const task = [
    `Open the ChatGPT app (package com.openai.chatgpt). Start a NEW chat.`,
    `Type this message exactly and send it:`,
    `"""${dotPrompt(event, kind, opts.ask)}"""`,
    `Wait until ChatGPT has completely finished replying (it may use Google Drive and take several minutes; if it asks to confirm a Drive action that does not change sharing, confirm it).`,
    `Then read the whole reply, scrolling if needed, and return it. Do not open any links and do not do anything else.`,
  ].join("\n");

  const created = (await mr.post("/tasks", {
    body: { task, deviceId, outputSchema: OUTPUT_SCHEMA, maxSteps: long ? 90 : 60, executionTimeout: long ? 2400 : 900 },
  })) as { id: string };
  await db.dotTask.update({ where: { id: jobId }, data: { taskId: created.id } });

  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const st = (await mr.get(`/tasks/${created.id}/status`)) as {
      status: string;
      succeeded: boolean | null;
      message: string | null;
      output: { items?: { title: string; url: string; answers: string }[]; dotReply?: string } | null;
    };
    if (!["completed", "failed", "cancelled"].includes(st.status)) continue;

    const items = (st.output?.items ?? []).filter((v) => /^https?:\/\//.test(v.url));
    for (const v of kind === "ask" || kind === "find_for_parent" ? [] : items) {
      await db.mediaItem.create({
        // The organizer chose fully automatic media: found items are usable right away (they can still reject).
        data: { eventId: event.id, title: v.title, url: v.url, answers: v.answers, source: "dot", kind: kind === "make_pdf" ? "pdf" : "video", status: "approved" },
      });
    }
    const reply = st.output?.dotReply ?? st.message ?? st.status;
    const ok = kind === "ask" ? !!st.succeeded && !!st.output?.dotReply : !!st.succeeded && items.length > 0;
    // (find_for_parent results are saved below, already approved: the organizer chose fully automatic media.)
    await db.dotTask.update({ where: { id: jobId }, data: { status: ok ? "done" : "failed", message: reply } });
    await unlockDevice();
    if (opts.replyTo && kind === "find_for_parent") {
      const v = items[0];
      const fileId = v?.url.match(/\/d\/([\w-]{10,})/)?.[1];
      if (v && fileId) {
        await db.mediaItem.create({ data: { eventId: event.id, title: v.title, url: v.url, answers: v.answers, source: "dot", kind: "video", status: "approved" } });
        await deliver(event, opts.replyTo, `Here's the video I mentioned: ${v.title}`, `drive:${fileId}|${v.title}`);
      } else {
        await deliver(event, opts.replyTo, `Sorry, I couldn't find a good video for that yet. ${event.organizerName} can share one with you.`);
      }
    } else if (opts.replyTo) {
      await deliver(event, opts.replyTo, ok ? `Dot: ${reply}`.slice(0, 1500) : `Dot couldn't finish that (${st.status}).`);
    }
    break;
  }
  await unlockDevice();
}

// (kept for compatibility) Approved media becomes the event's clip list, which the agent can send.
export async function syncApprovedClips(eventId: string) {
  const items = await db.mediaItem.findMany({ where: { eventId, status: "approved" }, orderBy: { createdAt: "asc" } });
  const clips = items.map((m, i) => ({ id: `clip${i + 1}`, title: m.title, url: m.url, answers: m.answers }));
  await db.event.update({ where: { id: eventId }, data: { clips: JSON.stringify(clips) } });
}
