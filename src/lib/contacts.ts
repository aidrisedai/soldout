import type Anthropic from "@anthropic-ai/sdk";
import type { Event } from "@prisma/client";
import { db } from "./db";
import { complete, llm } from "./llm";

// The organizer's own contacts (consented): onboarded with whatever is known about them,
// grouped under a "Your contacts" target, given a personal opener once the campaign starts,
// and reached on their best channel (WhatsApp → email → LinkedIn). They skip JOIN.

export type OrganizerContact = { name: string; phone?: string; email?: string; linkedin?: string; notes?: string };

// "Name | phone | email | LinkedIn | notes" per line, or CSV with those columns (header optional).
export function parseContacts(text: string): OrganizerContact[] {
  const out: OrganizerContact[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^name\s*[|,]/i.test(line)) continue;
    const parts = (line.includes("|") ? line.split("|") : line.split(",")).map((x) => x.trim());
    const c: OrganizerContact = { name: "" };
    const rest: string[] = [];
    for (const p of parts) {
      if (!p) continue;
      if (/linkedin\.com/i.test(p)) c.linkedin = p;
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) c.email = p;
      else if (/^\+?[\d\s().-]{7,}$/.test(p)) c.phone = p;
      else if (!c.name) c.name = p;
      else rest.push(p);
    }
    if (rest.length) c.notes = rest.join(", ");
    if (c.name || c.phone || c.email) out.push({ ...c, name: c.name || c.phone || c.email || "Contact" });
  }
  return out.slice(0, 200);
}

export function normalizeWa(phone: string): string {
  const d = phone.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(d)) return `+1${d}`;
  return d.startsWith("+") ? d : `+${d}`;
}

export async function saveOrganizerContacts(eventId: string, keyword: string, contacts: OrganizerContact[]) {
  if (!contacts.length) return 0;
  const target = await db.target.create({
    data: {
      eventId, policy: "Your own network", name: "Your contacts", kind: "network", fitScore: 100, decision: "go",
      reason: "People you know who agreed to hear from you",
      research: JSON.stringify({ summary: `${contacts.length} people you added during onboarding. They agreed to hear from you, so SoldOut reaches out directly.` }),
    },
  });
  let n = 0;
  for (const c of contacts) {
    const channels: Record<string, string> = {};
    if (c.phone) channels.whatsapp = normalizeWa(c.phone);
    if (c.email) channels.email = c.email;
    if (c.linkedin) channels.linkedin = c.linkedin;
    const base = `${keyword}-${(c.name.split(/\s+/)[0] || "FRIEND").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
    let code = base;
    for (let i = 2; await db.prospect.findUnique({ where: { joinCode: code } }); i++) code = `${base}${i}`;
    await db.prospect.create({
      data: {
        eventId, targetId: target.id, name: c.name, role: c.notes ? c.notes.slice(0, 120) : "Your contact", reach: "connector",
        whyThem: c.notes ? `You know them: ${c.notes}` : "Someone you know who agreed to hear from you.",
        channels: JSON.stringify(channels),
        research: JSON.stringify({ source: "organizer", consent: true, notes: c.notes ?? "" }),
        joinCode: code,
      },
    });
    n++;
  }
  return n;
}

const TOOL: Anthropic.Tool = {
  name: "submit_openers",
  description: "Personal first messages",
  input_schema: {
    type: "object",
    properties: {
      openers: {
        type: "array",
        items: { type: "object", properties: { id: { type: "string" }, opener: { type: "string" }, subject: { type: "string" } }, required: ["id", "opener", "subject"] },
      },
    },
    required: ["openers"],
  },
};

// Write openers for organizer contacts that don't have one yet (after the strategy is approved).
export async function draftContactOpeners(event: Event) {
  const pending = await db.prospect.findMany({ where: { eventId: event.id, opener: null, status: "found" } });
  const mine = pending.filter((p) => (JSON.parse(p.research ?? "{}") as { source?: string }).source === "organizer");
  if (!mine.length) return 0;
  const { model } = llm();
  for (let i = 0; i < mine.length; i += 10) {
    const batch = mine.slice(i, i + 10);
    const res = await complete({
      model,
      max_tokens: 3000,
      tools: [TOOL],
      system: `You write as ${event.organizerName} (${event.organization}) to people they personally know, who agreed to hear from them. Warm, short (under 70 words), first person, natural for WhatsApp or email. Mention the program "${event.name}" in one plain line, use what the organizer knows about the person (and only that), and end with a light question. No links, no price, no invented facts. Islamic greetings are fine where natural.`,
      messages: [{
        role: "user",
        content: `Program facts: ${event.dateText ?? ""} ${event.place ?? ""} ${event.audience ?? ""}\n\nPeople:\n${batch.map((p) => `- id ${p.id}: ${p.name}. What the organizer knows: ${(JSON.parse(p.research ?? "{}") as { notes?: string }).notes || "nothing else"}`).join("\n")}`,
      }],
    });
    const use = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const openers = ((use?.input as { openers?: { id: string; opener: string; subject: string }[] })?.openers ?? []);
    for (const o of openers) {
      const p = batch.find((x) => x.id === o.id);
      if (!p) continue;
      const r = JSON.parse(p.research ?? "{}");
      await db.prospect.update({ where: { id: p.id }, data: { opener: o.opener, research: JSON.stringify({ ...r, subject: o.subject }) } });
    }
  }
  return mine.length;
}
