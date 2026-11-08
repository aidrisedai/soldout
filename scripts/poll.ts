// Pulls inbound messages from channels that don't need a public webhook URL
// and forwards them to /api/inbound. Run next to `npm run dev`:  npm run poll
//   - Telegram: getUpdates long polling (needs TELEGRAM_BOT_TOKEN)
//   - Mobilerun SMS inbox (needs MOBILERUN_API_KEY)
import Mobilerun from "@mobilerun/sdk";

const APP = process.env.APP_URL ?? "http://localhost:3000";

async function forward(from: string, text: string, channel: string, externalId: string) {
  const res = await fetch(`${APP}/api/inbound`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, text, channel, externalId }),
  });
  const j = (await res.json().catch(() => ({}))) as { actions?: string[]; delivery?: string; error?: string };
  console.log(`[${channel}] ${from}: ${text.slice(0, 60)} → ${j.error ?? (j.actions ?? []).join(",")} ${j.delivery ?? ""}`);
}

async function telegramLoop(token: string) {
  let offset = 0;
  console.log("[telegram] polling");
  for (;;) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}&allowed_updates=["message"]`);
      const j = (await res.json()) as { ok: boolean; result: { update_id: number; message?: { message_id: number; text?: string; chat: { id: number } } }[]; description?: string };
      if (!j.ok) { console.error("[telegram]", j.description); await sleep(5000); continue; }
      for (const u of j.result) {
        offset = u.update_id + 1;
        const m = u.message;
        if (!m?.text) continue;
        // Telegram's /start button sends "/start"; treat it as JOIN.
        const text = /^\/start\b/i.test(m.text) ? `JOIN ${m.text.split(/\s+/)[1] ?? ""}`.trim() : m.text;
        await forward(`tg:${m.chat.id}`, text, "telegram", `tg-in:${m.chat.id}:${m.message_id}`);
      }
    } catch (e) {
      console.error("[telegram]", (e as Error).message);
      await sleep(5000);
    }
  }
}

async function mobilerunLoop(apiKey: string) {
  const mr = new Mobilerun({ apiKey });
  const numbers = await mr.numbers.list();
  const n = numbers.items.find((x) => x.state === "active");
  if (!n) return console.log("[sms] no active Mobilerun number");
  console.log(`[sms] polling ${n.phoneNumber} (can send: ${n.actions.send})`);
  let since = new Date(Date.now() - 60_000).toISOString();
  for (;;) {
    try {
      const res = await mr.numbers.messages.list(n.id, { direction: "inbound", since, pageSize: 50 });
      for (const m of [...res.items].reverse()) {
        if (m.occurredAt > since) since = m.occurredAt;
        if (m.body && m.peerNumber) await forward(m.peerNumber, m.body, "sms", m.id);
      }
    } catch (e) {
      console.error("[sms]", (e as Error).message);
    }
    await sleep(4000);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const loops: Promise<unknown>[] = [];
if (process.env.TELEGRAM_BOT_TOKEN) loops.push(telegramLoop(process.env.TELEGRAM_BOT_TOKEN));
if (process.env.MOBILERUN_API_KEY) loops.push(mobilerunLoop(process.env.MOBILERUN_API_KEY));
if (!loops.length) console.log("Nothing to poll: set TELEGRAM_BOT_TOKEN and/or MOBILERUN_API_KEY in .env");
Promise.all(loops).catch((e) => { console.error(e); process.exit(1); });
