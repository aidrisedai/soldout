// npx tsx --env-file=.env scripts/lock.ts <minutes>   pause the WhatsApp worker (0 = unlock)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const min = Number(process.argv[2] ?? 10);
(async () => {
  if (min <= 0) await db.kV.deleteMany({ where: { key: "device_lock_until" } });
  else await db.kV.upsert({ where: { key: "device_lock_until" }, create: { key: "device_lock_until", value: String(Date.now() + min * 60000) }, update: { value: String(Date.now() + min * 60000) } });
  console.log(min > 0 ? `locked ${min} min` : "unlocked");
  await db.$disconnect();
})();
