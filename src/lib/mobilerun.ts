import Mobilerun from "@mobilerun/sdk";

// Mobilerun Cloud SMS (https://docs.mobilerun.ai/api-reference/messages/send-an-sms-from-a-number).
// Key comes from MOBILERUN_API_KEY, server-side only.
let client: Mobilerun | null = null;
export function mobilerun(): Mobilerun | null {
  if (!process.env.MOBILERUN_API_KEY) return null;
  client ??= new Mobilerun({ apiKey: process.env.MOBILERUN_API_KEY });
  return client;
}

let cachedNumberId: string | null = null;
export async function numberId(): Promise<string | null> {
  if (process.env.MOBILERUN_NUMBER_ID) return process.env.MOBILERUN_NUMBER_ID;
  if (cachedNumberId) return cachedNumberId;
  const mr = mobilerun();
  if (!mr) return null;
  const res = await mr.numbers.list();
  const active = res.items.find((n) => n.state === "active");
  cachedNumberId = active?.id ?? null;
  return cachedNumberId;
}

export async function numberStatus() {
  const mr = mobilerun();
  const id = await numberId();
  if (!mr || !id) return null;
  const n = (await mr.numbers.retrieve(id)).data;
  return {
    id: n.id,
    phoneNumber: n.phoneNumber,
    canReceive: n.lineCapabilities.sms.inbound,
    canSend: n.actions.send,
  };
}

export async function sendSms(to: string, body: string, idempotencyKey: string) {
  const mr = mobilerun();
  const id = await numberId();
  if (!mr || !id) return { ok: false as const, status: "not_sendable", error: "Mobilerun not configured" };
  try {
    const res = await mr.numbers.messages.send(id, { to, body }, { headers: { "Idempotency-Key": idempotencyKey } });
    return { ok: true as const, status: res.data.status, externalId: res.data.id };
  } catch (e) {
    const err = e as { status?: number; error?: { code?: string } ; message?: string };
    const code = err.error?.code ?? err.message ?? "send_failed";
    return { ok: false as const, status: "not_sendable", error: `${err.status ?? ""} ${code}`.trim() };
  }
}
