import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveAttachment } from "@/lib/files";

// Preview a message's file in /simulate and the dashboard.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("messageId");
  const m = id ? await db.message.findUnique({ where: { id } }) : null;
  if (!m?.attachment) return NextResponse.json({ error: "no attachment" }, { status: 404 });
  if (m.attachment.startsWith("drive:")) {
    return NextResponse.redirect(`https://drive.google.com/file/d/${m.attachment.slice(6).split("|")[0]}/view`);
  }
  const f = await resolveAttachment(db, m.attachment);
  return new NextResponse(new Uint8Array(await readFile(f.path)), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${f.fileName}"` },
  });
}
