import { NextResponse } from "next/server";
import { redis as kv } from "../../../../lib/redis";

export const dynamic = "force-dynamic";

// Vercel Cron calls this on the schedule set in vercel.json (daily).
// Protect it with CRON_SECRET so it can't be triggered by anyone else —
// Vercel automatically sends this as a Bearer token on scheduled calls.
export async function GET(request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const emails = (await kv.smembers("pending-deletion-emails")) || [];
  const purged = [];
  const stillWaiting = [];

  for (const email of emails) {
    const profile = await kv.get(`user:${email}:profile`);
    if (!profile || !profile.deletionScheduledFor) {
      // deletion was cancelled or the profile is already gone — just clean the index
      await kv.srem("pending-deletion-emails", email);
      continue;
    }
    if (profile.deletionScheduledFor > Date.now()) {
      stillWaiting.push(email);
      continue;
    }

    // remove them from their family's shared member list and any per-user
    // entries inside it, so nothing in the app still references them
    if (profile.group) {
      const members = (await kv.get(`group:${profile.group}:members`)) || [];
      const next = members.filter((m) => m.email !== email);
      if (next.length !== members.length) {
        await kv.set(`group:${profile.group}:members`, next);
      }
      const skippedByEmail = (await kv.get(`group:${profile.group}:skipped`)) || {};
      if (skippedByEmail[email]) {
        delete skippedByEmail[email];
        await kv.set(`group:${profile.group}:skipped`, skippedByEmail);
      }
      const nudgesByEmail = (await kv.get(`group:${profile.group}:nudgeDismissed`)) || {};
      if (nudgesByEmail[email]) {
        delete nudgesByEmail[email];
        await kv.set(`group:${profile.group}:nudgeDismissed`, nudgesByEmail);
      }
    }

    // any parental-consent record tied to this email
    const token = await kv.get(`consent-by-child:${email}`);
    if (token) {
      await kv.del(`consent:${token}`);
      await kv.del(`consent-by-child:${email}`);
    }

    await kv.del(`user:${email}:profile`);
    await kv.del(`user:${email}:votes`);
    await kv.del(`user:${email}:ratings`);
    await kv.srem("pending-deletion-emails", email);
    purged.push(email);
  }

  return NextResponse.json({ purged, stillWaiting });
}
