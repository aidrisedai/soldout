import { NextResponse } from "next/server";
import { approveStrategy } from "@/lib/autopilot";

// Manual approval (autopilot does this on its own).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await approveStrategy(id);
  return NextResponse.json({ id: s.id, status: s.status, approvedAt: s.approvedAt });
}
