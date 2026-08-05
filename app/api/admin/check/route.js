import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET() {
  const { authorized } = await requireAdmin();
  return NextResponse.json({ authorized });
}
