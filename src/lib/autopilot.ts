import { db } from "./db";
import { expandTargets } from "./research";
import { findPeople } from "./prospects";
import { approveAndSend } from "./connector";
import { emailConfigured } from "./email";
import { draftStrategy } from "./strategy";

// Autopilot: the whole flow runs without a human. One switch (Event.autopilot = false) stops it.
// strategy → approve → research communities → use GO/NO-GO → find people → email openers.
// Conversations (connectors, parents) already run on their own and also respect the switch.

const DAILY_EMAIL_CAP = Number(process.env.AUTOPILOT_DAILY_EMAILS ?? 10);
const running = new Set<string>();

export async function approveStrategy(strategyId: string) {
  const s = await db.strategy.update({ where: { id: strategyId }, data: { status: "approved", approvedAt: new Date() } });
  const event = await db.event.findUnique({ where: { id: s.eventId } });
  if (event && process.env.MONID_API_KEY) {
    const key = `researching:${event.id}`;
    const busy = await db.kV.findUnique({ where: { key } });
    if (busy?.value !== "1" && !(await db.target.count({ where: { eventId: event.id } }))) {
      await db.kV.upsert({ where: { key }, create: { key, value: "1" }, update: { value: "1" } });
      void expandTargets(event, s)
        .catch((e) => console.error("[targets]", (e as Error).message))
        .finally(() => db.kV.update({ where: { key }, data: { value: "0" } }));
    }
  }
  return s;
}

async function emailsSentToday(eventId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  return db.touch.count({ where: { channel: "email", direction: "out", author: "ai", createdAt: { gte: since }, prospectId: { in: (await db.prospect.findMany({ where: { eventId }, select: { id: true } })).map((p) => p.id) } } });
}

// One step forward for one campaign. Safe to call repeatedly (the worker calls it every minute).
export async function advance(eventId: string) {
  if (running.has(eventId)) return;
  running.add(eventId);
  try {
    const event = await db.event.findUnique({ where: { id: eventId } });
    if (!event?.autopilot) return;

    const strategy = await db.strategy.findFirst({ where: { eventId }, orderBy: { createdAt: "desc" } });
    if (!strategy) {
      // The intake draft may have failed (model outage): redraft after 2 minutes, then keep trying.
      const key = `drafting:${eventId}`;
      const drafting = await db.kV.findUnique({ where: { key } });
      const startedAt = drafting ? Number(drafting.value) : event.createdAt.getTime();
      if (Date.now() - startedAt < 2 * 60_000) return;
      await db.kV.upsert({ where: { key }, create: { key, value: String(Date.now()) }, update: { value: String(Date.now()) } });
      const body = await draftStrategy(event);
      await db.strategy.create({ data: { eventId, body: JSON.stringify(body) } });
      console.log(`[autopilot] ${event.keyword}: strategy drafted (retry)`);
      return;
    }
    if (strategy.status === "draft") {
      if (event.mode !== "auto") return; // approve mode: the organizer approves the strategy
      await approveStrategy(strategy.id);
      console.log(`[autopilot] ${event.keyword}: strategy approved`);
      return;
    }

    if ((await db.kV.findUnique({ where: { key: `researching:${eventId}` } }))?.value === "1") return;
    const targets = await db.target.findMany({ where: { eventId } });
    if (!targets.length) {
      await approveStrategy(strategy.id); // kicks research off if it never started
      return;
    }

    // Find people in GO communities, best fit first, one community per tick.
    const goTargets = targets.filter((t) => t.decision === "go").sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));
    for (const t of goTargets) {
      const has = await db.prospect.count({ where: { targetId: t.id } });
      const state = (await db.kV.findUnique({ where: { key: `people:${t.id}` } }))?.value;
      if (has || state === "1" || state === "done") continue; // searched already (even if nobody was found)
      await db.kV.upsert({ where: { key: `people:${t.id}` }, create: { key: `people:${t.id}`, value: "1" }, update: { value: "1" } });
      try {
        const n = await findPeople(event, t.id);
        console.log(`[autopilot] ${event.keyword}: found ${n} people in ${t.name}`);
        await db.kV.update({ where: { key: `people:${t.id}` }, data: { value: "done" } });
      } catch (e) {
        await db.kV.update({ where: { key: `people:${t.id}` }, data: { value: "0" } }); // retry next tick
        throw e;
      }
      return;
    }

    // Email openers to connectors with a work email, under the daily cap.
    if (event.mode !== "auto") return; // approve mode: each first message waits for the organizer
    if (!emailConfigured()) return;
    let budget = DAILY_EMAIL_CAP - (await emailsSentToday(eventId));
    if (budget <= 0) return;
    const ready = await db.prospect.findMany({ where: { eventId, status: "found" }, orderBy: [{ reach: "asc" }, { createdAt: "asc" }] });
    for (const p of ready) {
      if (budget <= 0) break;
      const ch = JSON.parse(p.channels) as { email?: string };
      if (!ch.email) continue;
      const fresh = await db.event.findUnique({ where: { id: eventId }, select: { autopilot: true } });
      if (!fresh?.autopilot) return; // stopped mid-run
      await approveAndSend(p.id);
      budget--;
      console.log(`[autopilot] ${event.keyword}: emailed ${p.name}`);
    }
  } catch (e) {
    console.error(`[autopilot] ${eventId}:`, (e as Error).message);
  } finally {
    running.delete(eventId);
  }
}

export async function advanceAll() {
  const events = await db.event.findMany({ where: { autopilot: true }, select: { id: true } });
  for (const e of events) await advance(e.id);
}
