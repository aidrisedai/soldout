// Monid (https://monid.ai): one API for web search, LinkedIn, Instagram, email lookup.
// REST shape mirrors the official CLI: POST /v1/run {provider, endpoint, input}, poll GET /v1/runs/{id}.
const BASE = "https://api.monid.ai";

type RunResult = { runId?: string; status?: string; output?: unknown; error?: { message?: string } };

async function call(method: string, path: string, body?: unknown): Promise<RunResult> {
  const key = process.env.MONID_API_KEY;
  if (!key) throw new Error("MONID_API_KEY not set");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-monid-client": "soldout" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => ({}))) as RunResult & { data?: RunResult };
  if (!res.ok) throw new Error(`Monid ${res.status}: ${j.error?.message ?? JSON.stringify(j).slice(0, 200)}`);
  return j.data ?? j;
}

export async function monidRun<T = unknown>(provider: string, endpoint: string, input: { body?: unknown; queryParams?: Record<string, unknown> }): Promise<T> {
  let r = await call("POST", "/v1/run", { provider, endpoint, input });
  for (let i = 0; i < 40 && r.status && !["COMPLETED", "FAILED", "STOPPED"].includes(r.status); i++) {
    await new Promise((res) => setTimeout(res, 3000));
    r = await call("GET", `/v1/runs/${r.runId}`);
  }
  if (r.status !== "COMPLETED") throw new Error(`Monid run ${provider}${endpoint} ${r.status ?? "failed"}`);
  return r.output as T;
}

export type WebResult = { url: string; title: string; excerpts?: string[] };

export async function webSearch(objective: string, queries: string[]): Promise<WebResult[]> {
  const out = await monidRun<{ results?: WebResult[] }>("parallel", "/search", { body: { objective, search_queries: queries.slice(0, 3) } });
  return (out.results ?? []).slice(0, 6).map((r) => ({ url: r.url, title: r.title, excerpts: (r.excerpts ?? []).map((e) => e.slice(0, 1200)) }));
}
