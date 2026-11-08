import type { Contact, Event } from "@prisma/client";
import { db } from "./db";
import { runAgent } from "./agent";
import { isStop, normalizePhone, parseJoin } from "./event";
import { sendOn, type Channel } from "./channels";

export type InboundInput = {
  from: string;
  text: string;
  eventId?: string;
  channel?: Channel;
  externalId?: string; // Mobilerun message id, for dedupe
};

export type InboundResult = {
  ok: boolean;
  eventId?: string;
  contactId?: string;
  replies: string[];
  actions: string[];
  delivery?: string;
  error?: string;
};

// Every inbound text goes through here, from /simulate, the API or Mobilerun.
// Rule: we only ever talk to someone who texted JOIN for that event.
export async function handleInbound(input: InboundInput): Promise<InboundResult> {
  const phone = normalizePhone(input.from);
  const text = input.text.trim();
  const channel = input.channel ?? "simulate";
  if (!text) return { ok: false, replies: [], actions: [], error: "empty text" };

  if (input.externalId) {
    const seen = await db.message.findUnique({ where: { externalId: input.externalId } });
    if (seen) return { ok: true, replies: [], actions: ["duplicate"] };
  }

  const join = parseJoin(text);
  let event: Event | null = null;
  let contact: Contact | null = null;

  if (join.join) {
    event = await resolveEvent(input.eventId, join.keyword);
    if (!event) {
      const events = await db.event.findMany({ select: { keyword: true, name: true } });
      const msg = events.length
        ? `Which program? Reply ${events.map((e) => `"JOIN ${e.keyword}" for ${e.name}`).join(", or ")}.`
        : "Sorry, there is no program open right now.";
      // No contact exists yet, so this one-off answer to their own text is not stored against an event.
      return deliverUnscoped(phone, msg, channel);
    }
    contact = await db.contact.findUnique({ where: { eventId_phone: { eventId: event.id, phone } } });
    if (!contact) {
      const ref = join.keyword && join.keyword !== event.keyword ? join.keyword : null;
      contact = await db.contact.create({ data: { eventId: event.id, phone, channel, referredBy: ref } });
      if (ref) await db.prospect.updateMany({ where: { joinCode: ref, status: { in: ["contacted", "replied", "engaged"] } }, data: { status: "referred" } });
      await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "opted_in" } });
    } else if (contact.status === "opted_out") {
      contact = await db.contact.update({ where: { id: contact.id }, data: { status: "active", optedInAt: new Date() } });
      await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "opted_in", detail: "rejoined" } });
    }
  } else {
    // Not a JOIN: continue an existing opted-in conversation, or stay silent-ish.
    contact = await findContact(phone, input.eventId);
    if (!contact) {
      return deliverUnscoped(phone, "Hi! To get info about a program, reply JOIN.", channel);
    }
    event = await db.event.findUniqueOrThrow({ where: { id: contact.eventId } });
  }

  await db.message.create({
    data: { eventId: event.id, contactId: contact.id, direction: "in", body: text, channel, externalId: input.externalId },
  });

  if (contact.status === "opted_out") return { ok: true, eventId: event.id, contactId: contact.id, replies: [], actions: ["ignored_opted_out"] };

  if (isStop(text)) {
    await db.contact.update({ where: { id: contact.id }, data: { status: "opted_out" } });
    await db.outcome.create({ data: { eventId: event.id, contactId: contact.id, type: "opted_out" } });
    const r = await deliver(event, contact, "You're unsubscribed and won't get more messages. Reply JOIN anytime to start again.");
    return { ok: true, eventId: event.id, contactId: contact.id, replies: [r.body], actions: ["opted_out"], delivery: r.status };
  }

  try {
    const result = await runAgent(event, contact, text);
    const r = await deliver(event, contact, result.reply);
    for (const a of result.attachments) await deliver(event, contact, a.caption, a.ref);
    return { ok: true, eventId: event.id, contactId: contact.id, replies: [r.body], actions: result.actions, delivery: r.status };
  } catch (e) {
    const message = e instanceof Error ? e.message : "agent error";
    console.error("[agent] failed:", message);
    return { ok: false, eventId: event.id, contactId: contact.id, replies: [], actions: [], error: message };
  }
}

async function resolveEvent(eventId: string | undefined, keyword: string | null): Promise<Event | null> {
  if (keyword) {
    const byKeyword = await db.event.findUnique({ where: { keyword } });
    if (byKeyword) return byKeyword;
    // A connector's personal code, e.g. JOIN FOUNDER-SARAH
    const p = await db.prospect.findUnique({ where: { joinCode: keyword } });
    if (p) return db.event.findUnique({ where: { id: p.eventId } });
  }
  if (eventId) return db.event.findUnique({ where: { id: eventId } });
  const all = await db.event.findMany({ take: 2 });
  return all.length === 1 ? all[0] : null;
}

async function findContact(phone: string, eventId?: string): Promise<Contact | null> {
  if (eventId) return db.contact.findUnique({ where: { eventId_phone: { eventId, phone } } });
  // Most recently active conversation for this phone.
  return db.contact.findFirst({ where: { phone }, orderBy: { updatedAt: "desc" } });
}

export async function deliver(event: Event, contact: Contact, body: string, attachment?: string) {
  const msg = await db.message.create({
    data: { eventId: event.id, contactId: contact.id, direction: "out", body, channel: contact.channel, attachment, status: contact.channel === "simulate" ? "ok" : "queued" },
  });
  await db.contact.update({ where: { id: contact.id }, data: { updatedAt: new Date() } });
  if (contact.channel === "simulate") return { body, status: "ok" };
  if (attachment) return { body, status: "queued" }; // files go out through the phone worker
  const sent = await sendOn(contact.channel, contact.phone, body, msg.id);
  await db.message.update({
    where: { id: msg.id },
    data: sent.ok ? { status: sent.status, externalId: sent.externalId } : { status: sent.status, error: sent.error },
  });
  return { body, status: sent.ok ? sent.status : `not_sent: ${sent.error}` };
}

async function deliverUnscoped(phone: string, body: string, channel: Channel): Promise<InboundResult> {
  // The WhatsApp phone may hold unrelated chats: never message anyone who hasn't texted JOIN.
  if (channel === "whatsapp") return { ok: true, replies: [], actions: ["ignored_not_opted_in"] };
  if (channel !== "simulate") {
    const sent = await sendOn(channel, phone, body, `unscoped-${phone}-${Date.now()}`);
    return { ok: true, replies: [body], actions: ["no_event"], delivery: sent.ok ? sent.status : `not_sent: ${sent.error}` };
  }
  return { ok: true, replies: [body], actions: ["no_event"] };
}
