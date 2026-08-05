import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

const DELETE_DELAY_DAYS = 30;

// POST /api/admin/deletion  body: { email, action: "cancel" | "schedule" }
export async function POST(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const profile = (await kv.get(`user:${email}:profile`)) || {};

  if (body.action === "cancel") {
    delete profile.deletionRequestedAt;
    delete profile.deletionScheduledFor;
    await kv.set(`user:${email}:profile`, profile);
    await kv.srem("pending-deletion-emails", email);
    return NextResponse.json({ cancelled: true });
  }

  if (body.action === "schedule") {
    const scheduledFor = Date.now() + DELETE_DELAY_DAYS * 24 * 60 * 60 * 1000;
    profile.deletionRequestedAt = Date.now();
    profile.deletionScheduledFor = scheduledFor;
    await kv.set(`user:${email}:profile`, profile);
    await kv.sadd("pending-deletion-emails", email);
    return NextResponse.json({ scheduledFor });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
