// Fresh start for a demo run: removes all events, contacts, messages, strategies, media.
//   npx tsx --env-file=.env scripts/reset.ts
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
(async () => {
  await db.$transaction([
    db.outcome.deleteMany(), db.fitAnswer.deleteMany(), db.organizerFlag.deleteMany(), db.message.deleteMany(),
    db.contact.deleteMany(), db.strategy.deleteMany(), db.mediaItem.deleteMany(), db.dotTask.deleteMany(),
    db.brief.deleteMany(), db.event.deleteMany(), db.kV.deleteMany(),
  ]);
  console.log("SoldOut reset: no events. Start at /intake.");
  await db.$disconnect();
})();
