export type FitQuestion = { key: string; question: string };
export type Clip = { id: string; title: string; url: string; answers: string };

export function parseFitQuestions(json: string): FitQuestion[] {
  try { return JSON.parse(json) as FitQuestion[]; } catch { return []; }
}
export function parseClips(json: string): Clip[] {
  try { return JSON.parse(json) as Clip[]; } catch { return []; }
}

// "JOIN", "join founder", "Join FOUNDER!" -> { join: true, keyword: "FOUNDER" | null }
export function parseJoin(text: string): { join: boolean; keyword: string | null } {
  const m = text.trim().match(/^join\b\s*([a-z0-9_-]+)?/i);
  if (!m) return { join: false, keyword: null };
  return { join: true, keyword: m[1] ? m[1].toUpperCase() : null };
}

export function isStop(text: string): boolean {
  return /^(stop|unsubscribe|cancel|end|quit|stopall)\b/i.test(text.trim());
}

export function normalizePhone(p: string): string {
  const t = p.trim();
  if (/^(sim[-:]|tg:)/i.test(t)) return t.toLowerCase();
  if (/^wa:/i.test(t)) return `wa:+${t.replace(/[^\d]/g, "")}`;
  const digits = t.replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}
