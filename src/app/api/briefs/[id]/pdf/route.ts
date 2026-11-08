import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.brief.findUnique({ where: { id } });
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const pdf = await readFile(b.pdfPath);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${basename(b.pdfPath)}"` },
  });
}
