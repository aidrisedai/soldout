import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

// Resolve a message attachment ref to a local file the phone worker can upload.
//   brief:<briefId>          SoldOut's PDF brief
//   drive:<fileId>|<title>   a Drive file Dot picked (must be link-shareable to download)
export async function resolveAttachment(db: PrismaClient, ref: string): Promise<{ path: string; fileName: string }> {
  const safe = (s: string) => s.replace(/[^A-Za-z0-9 ._-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "file";
  if (ref.startsWith("brief:")) {
    const b = await db.brief.findUnique({ where: { id: ref.slice(6) } });
    if (!b) throw new Error("brief not found");
    const ev = await db.event.findUnique({ where: { id: b.eventId } });
    return { path: b.pdfPath, fileName: `${safe(ev?.organization ?? "Program")}-Program-Brief.pdf` };
  }
  if (ref.startsWith("drive:")) {
    const [fileId, title = "video"] = ref.slice(6).split("|");
    const dir = join(process.cwd(), "data", "media");
    mkdirSync(dir, { recursive: true });
    for (const ext of [".mp4", ".mov", ".pdf"]) {
      const p = join(dir, `${fileId}${ext}`);
      if (existsSync(p)) return { path: p, fileName: `${safe(title)}${ext}` };
    }
    const res = await fetch(`https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || type.includes("text/html")) {
      throw new Error("Drive file isn't link-shareable, so it can't be downloaded (set DOT_MAY_SHARE=1 so Dot shares what it picks)");
    }
    const ext = type.includes("pdf") ? ".pdf" : type.includes("quicktime") ? ".mov" : ".mp4";
    const p = join(dir, `${fileId}${ext}`);
    await writeFile(p, new Uint8Array(await res.arrayBuffer()));
    return { path: p, fileName: `${safe(title)}${ext}` };
  }
  throw new Error(`unknown attachment ${ref}`);
}
