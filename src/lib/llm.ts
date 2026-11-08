import Anthropic from "@anthropic-ai/sdk";

// The agent calls Claude through Naive's Anthropic-compatible model proxy
// (https://usenaive.ai/docs/api/proxy). If only ANTHROPIC_API_KEY is set,
// it falls back to the Anthropic API directly. Keys are never logged.
const NAIVE_BASE = process.env.NAIVE_BASE_URL ?? "https://api.vetta.sh/v1/proxy/anthropic";

export function llm(): { client: Anthropic; model: string; provider: "naive" | "anthropic" } {
  if (process.env.NAIVE_API_KEY) {
    return {
      client: new Anthropic({ apiKey: null, authToken: process.env.NAIVE_API_KEY, baseURL: NAIVE_BASE }),
      model: process.env.AGENT_MODEL ?? "anthropic/claude-opus-5.5",
      provider: "naive",
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      client: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
      model: process.env.AGENT_MODEL ?? "claude-opus-5-5",
      provider: "anthropic",
    };
  }
  throw new Error("No model key configured: set NAIVE_API_KEY (preferred) or ANTHROPIC_API_KEY in .env");
}

// Every model call goes through here: stream (avoids proxy timeouts on long outputs),
// retry once, fall back to a plain request, then to a backup Claude model if the primary is down.
export async function complete(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  const { client, provider } = llm();
  const backup = process.env.AGENT_BACKUP_MODEL ?? (provider === "naive" ? "anthropic/claude-sonnet-5.5" : "claude-sonnet-5-5");
  const models = [params.model, ...(backup && backup !== params.model ? [backup] : [])];
  let lastErr: unknown;
  for (const model of models) {
    const p = { ...params, model };
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await client.messages.stream(p).finalMessage();
      } catch (e) {
        lastErr = e;
        console.error(`[llm] ${model} stream attempt ${attempt + 1} failed: ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    try {
      return await client.messages.create(p);
    } catch (e) {
      lastErr = e;
      console.error(`[llm] ${model} plain request failed: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}
