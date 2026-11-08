import { NextResponse } from "next/server";
import { buildBrief, extractFile, fetchLink, type Source } from "@/lib/briefBuilder";

export const maxDuration = 180;

// Onboarding step: files + links in → program brief, gap questions and key facts out.
export async function POST(req: Request) {
  const form = await req.formData();
  const known = JSON.parse(String(form.get("known") ?? "{}")) as Record<string, string>;
  const sources: Source[] = [];

  for (const f of form.getAll("files")) {
    if (typeof f === "string" || !f.size) continue;
    if (f.size > 15 * 1024 * 1024) { sources.push({ name: f.name, text: "(file too large, over 15 MB)" }); continue; }
    sources.push({ name: f.name, text: await extractFile(f.name, new Uint8Array(await f.arrayBuffer())) });
  }
  const links = String(form.get("links") ?? "").split(/\s+/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)).slice(0, 8);
  const fetched = await Promise.all(links.map(async (l) => ({ name: l, text: await fetchLink(l) })));
  sources.push(...fetched);
  const notes = String(form.get("notes") ?? "").trim();
  if (notes) sources.push({ name: "Organizer's notes", text: notes });

  if (!sources.length && !known.intent) return NextResponse.json({ error: "Add at least one file, link or a few lines about the program." }, { status: 400 });
  try {
    const r = await buildBrief(sources, known);
    return NextResponse.json({ ...r, read: sources.map((s) => ({ name: s.name, chars: s.text.length, ok: !s.text.startsWith("(") })) });
  } catch (e) {
    return NextResponse.json({ error: `Couldn’t build the brief right now: ${(e as Error).message}. Try again.` }, { status: 502 });
  }
}
