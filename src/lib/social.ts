import { db } from "./db";
import { phoneCtx } from "./waPhone";
import { deviceLocked, lockDevice, unlockDevice } from "./dot";

// LinkedIn connection notes and Instagram DMs, sent by the Mobilerun cloud phone from the
// organizer's own accounts (logged in on the phone). Deterministic deep link to the profile,
// then a Mobilerun Agent task (https://docs.mobilerun.ai/api-reference/tasks/run-task) does the taps.
// Off unless SOCIAL_VIA_PHONE=1. Daily caps keep the accounts safe from platform limits.

const APPS = {
  linkedin: { pkg: "com.linkedin.android", cap: Number(process.env.LINKEDIN_DAILY ?? 15) },
  instagram: { pkg: "com.instagram.android", cap: Number(process.env.INSTAGRAM_DAILY ?? 10) },
} as const;
type Social = keyof typeof APPS;

export const socialViaPhone = () => process.env.SOCIAL_VIA_PHONE === "1" && !!process.env.MOBILERUN_API_KEY;

const OUTPUT = {
  type: "object",
  properties: {
    sent: { type: "boolean", description: "true only if the message/invitation was actually sent" },
    reason: { type: "string", description: "What happened, in one sentence" },
  },
  required: ["sent", "reason"],
};

function taskFor(ch: Social, name: string, text: string): string {
  if (ch === "linkedin")
    return [
      `The LinkedIn app is open on ${name}'s profile. Send them a connection request WITH a note:`,
      `Tap "Connect" (if it's hidden, tap "More" or "..." then "Connect"). When asked, choose "Add a note".`,
      `Type this note exactly, then tap Send:`,
      `"""${text}"""`,
      `If you are already connected, tap "Message" instead and send the same text as a message.`,
      `If the profile is not ${name}, if LinkedIn asks for an email address, a premium upgrade or a CAPTCHA, or the account is logged out, STOP and do not send anything.`,
      `Do nothing else: no likes, no follows, no other profiles.`,
    ].join("\n");
  return [
    `The Instagram app is open on ${name}'s profile. Tap "Message" and send this text exactly:`,
    `"""${text}"""`,
    `If there is no Message button, tap "..." then "Send message".`,
    `If the profile is not ${name}, the account is private and messaging is blocked, Instagram shows a warning or CAPTCHA, or the account is logged out, STOP and do not send anything.`,
    `Do nothing else: no follows, no likes, no other profiles.`,
  ].join("\n");
}

async function sentToday(ch: Social): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600_000);
  return db.touch.count({ where: { channel: ch, direction: "out", status: "sent", author: "ai", createdAt: { gte: since } } });
}

// Called by the worker: send the next queued note, one at a time. Returns true if it did something.
export async function sendNextSocial(): Promise<boolean> {
  if (!socialViaPhone() || (await deviceLocked())) return false;
  for (const ch of Object.keys(APPS) as Social[]) {
    if ((await sentToday(ch)) >= APPS[ch].cap) continue;
    const touch = await db.touch.findFirst({ where: { channel: ch, status: "queued" }, orderBy: { createdAt: "asc" } });
    if (!touch) continue;
    const p = await db.prospect.findUniqueOrThrow({ where: { id: touch.prospectId } });
    const ev = await db.event.findUnique({ where: { id: p.eventId }, select: { autopilot: true } });
    if (!ev?.autopilot || p.status === "done" || p.aiPaused) {
      await db.touch.update({ where: { id: touch.id }, data: { status: "approved" } }); // back to manual
      return true;
    }
    const url = (JSON.parse(p.channels) as Record<string, string>)[ch];
    const ctx = await phoneCtx();
    if (!url || !ctx) return false;

    await db.touch.update({ where: { id: touch.id }, data: { status: "sending" } });
    await lockDevice(10 * 60_000);
    let ok = false;
    let reason = "";
    try {
      await new Promise((r) => setTimeout(r, 3000)); // let the WhatsApp loop finish its step
      await ctx.mr.devices.deepLink.executeDeepLink(ctx.deviceId, { deepLink: url, packageName: APPS[ch].pkg });
      await new Promise((r) => setTimeout(r, 5000));
      const created = (await ctx.mr.post("/tasks", {
        body: { task: taskFor(ch, p.name, touch.body), deviceId: ctx.deviceId, outputSchema: OUTPUT, maxSteps: 25, executionTimeout: 420 },
      })) as { id: string };
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        const st = (await ctx.mr.get(`/tasks/${created.id}/status`)) as { status: string; output: { sent?: boolean; reason?: string } | null; message: string | null };
        if (!["completed", "failed", "cancelled"].includes(st.status)) continue;
        ok = st.status === "completed" && st.output?.sent === true;
        reason = st.output?.reason ?? st.message ?? st.status;
        break;
      }
    } catch (e) {
      reason = (e as Error).message;
    } finally {
      await unlockDevice();
    }
    // On failure, fall back to the copy-and-send card so nothing is lost.
    await db.touch.update({ where: { id: touch.id }, data: { status: ok ? "sent" : "approved" } });
    if (ok) await db.prospect.updateMany({ where: { id: p.id, status: { in: ["found", "approved"] } }, data: { status: "contacted" } });
    console.log(`[social] ${ch} → ${p.name}: ${ok ? "sent" : "not sent"} (${reason})`);
    if (!ok) await db.kV.upsert({ where: { key: `social_fail:${touch.id}` }, create: { key: `social_fail:${touch.id}`, value: reason.slice(0, 300) }, update: { value: reason.slice(0, 300) } });
    return true;
  }
  return false;
}
