import { NextResponse } from "next/server";
import { redis as kv } from "../../../../lib/redis";

export const dynamic = "force-dynamic";

const DELETE_DELAY_DAYS = 30;

// POST /api/account/delete
//   action "request": { email } -> schedules deletion 30 days out; account
//                       keeps working normally until then, and can be cancelled
//   action "cancel":  { email } -> cancels a pending deletion
export async function POST(request) {
  const body = await request.json();
  const { email, action } = body;
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const profile = (await kv.get(`user:${email}:profile`)) || {};

  if (action === "request") {
    const scheduledFor = Date.now() + DELETE_DELAY_DAYS * 24 * 60 * 60 * 1000;
    profile.deletionRequestedAt = Date.now();
    profile.deletionScheduledFor = scheduledFor;
    await kv.set(`user:${email}:profile`, profile);
    await kv.sadd("pending-deletion-emails", email);
    return NextResponse.json({ scheduledFor });
  }

  if (action === "cancel") {
    delete profile.deletionRequestedAt;
    delete profile.deletionScheduledFor;
    await kv.set(`user:${email}:profile`, profile);
    await kv.srem("pending-deletion-emails", email);
    return NextResponse.json({ cancelled: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
