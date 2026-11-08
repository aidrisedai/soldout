// Production entry (Railway): sync the DB schema, then run the web app and the WhatsApp worker together.
import { spawn, spawnSync } from "node:child_process";

const port = process.env.PORT ?? "3000";
const env = { ...process.env, APP_URL: process.env.APP_URL ?? `http://127.0.0.1:${port}` };

const push = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], { stdio: "inherit", env });
if (push.status !== 0) process.exit(push.status ?? 1);

const web = spawn("npx", ["next", "start", "-p", port, "-H", "0.0.0.0"], { stdio: "inherit", env });
web.on("exit", (code) => process.exit(code ?? 1));

function startWorker() {
  if (process.env.RUN_WORKER === "0") return;
  const w = spawn("npx", ["tsx", "scripts/poll.ts"], { stdio: "inherit", env });
  w.on("exit", (code) => {
    console.error(`[start] worker exited (${code}); restarting in 5s`);
    setTimeout(startWorker, 5000);
  });
}
setTimeout(startWorker, 8000); // give the web server time to come up
