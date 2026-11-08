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
