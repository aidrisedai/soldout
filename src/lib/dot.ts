import Mobilerun from "@mobilerun/sdk";
import type { Event } from "@prisma/client";
import { db } from "./db";
import { phoneCtx } from "./waPhone";

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

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    videos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          url: { type: "string", description: "The shareable Google Drive link Dot returned" },
          answers: { type: "string", description: "Which parent question this video answers" },
        },
        required: ["title", "url", "answers"],
      },
    },
    dotReply: { type: "string", description: "Dot's full reply text, verbatim" },
  },
  required: ["videos", "dotReply"],
};

function dotPrompt(event: Event): string {
  return [
    `From my ${event.organization} Google Drive, pick up to 5 finished, edited videos (not raw camera footage) that would help ${event.audience ?? "parents"} decide about "${event.name}".`,
    `Useful topics: what ${event.organization} is, what students build, who the mentors are, what a session or demo day looks like.`,
    `Skip any video where it isn't clear we can share it publicly.`,
    `For each one, set sharing to "Anyone with the link can view" and reply with one line per video in this exact format:`,
    `Title | share link | the parent question it answers`,
  ].join(" ");
}

export async function askDotForVideos(event: Event): Promise<string> {
  const ctx = await phoneCtx();
  if (!ctx) throw new Error("No ready Mobilerun phone");
  const job = await db.dotTask.create({ data: { eventId: event.id } });
  void runDot(ctx.mr, ctx.deviceId, event, job.id).catch(async (e) => {
    await db.dotTask.update({ where: { id: job.id }, data: { status: "failed", message: (e as Error).message } });
    await unlockDevice();
  });
  return job.id;
}

async function runDot(mr: Mobilerun, deviceId: string, event: Event, jobId: string) {
  await lockDevice(20 * 60_000);
  await new Promise((r) => setTimeout(r, 4000)); // let the WhatsApp worker finish its current step

  const task = [
    `Open the ChatGPT app (package com.openai.chatgpt). Start a NEW chat.`,
    `Type this message exactly and send it:`,
    `"""${dotPrompt(event)}"""`,
    `Wait until ChatGPT has completely finished replying (it may use Google Drive and take a few minutes; if it asks to confirm a Drive action, confirm it).`,
    `Then read the whole reply, scrolling if needed, and return it. Do not open any links and do not do anything else.`,
  ].join("\n");

  const created = (await mr.post("/tasks", {
    body: { task, deviceId, outputSchema: OUTPUT_SCHEMA, maxSteps: 60, executionTimeout: 900 },
  })) as { id: string };
  await db.dotTask.update({ where: { id: jobId }, data: { taskId: created.id } });

  for (;;) {
    await new Promise((r) => setTimeout(r, 10_000));
    const st = (await mr.get(`/tasks/${created.id}/status`)) as {
      status: string;
      succeeded: boolean | null;
      message: string | null;
      output: { videos?: { title: string; url: string; answers: string }[]; dotReply?: string } | null;
    };
    if (!["completed", "failed", "cancelled"].includes(st.status)) continue;

    const videos = (st.output?.videos ?? []).filter((v) => /^https?:\/\//.test(v.url));
    for (const v of videos) {
      await db.mediaItem.create({ data: { eventId: event.id, title: v.title, url: v.url, answers: v.answers, source: "dot" } });
    }
    await db.dotTask.update({
      where: { id: jobId },
      data: { status: st.succeeded ? "done" : "failed", message: st.output?.dotReply ?? st.message ?? st.status },
    });
    break;
  }
  await unlockDevice();
}

// Approved media becomes the event's clip list, which the agent can send.
export async function syncApprovedClips(eventId: string) {
  const items = await db.mediaItem.findMany({ where: { eventId, status: "approved" }, orderBy: { createdAt: "asc" } });
  const clips = items.map((m, i) => ({ id: `clip${i + 1}`, title: m.title, url: m.url, answers: m.answers }));
  await db.event.update({ where: { id: eventId }, data: { clips: JSON.stringify(clips) } });
}
