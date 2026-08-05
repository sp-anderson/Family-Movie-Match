import { NextResponse } from "next/server";
import { redis as kv } from "../../../../lib/redis";

// POST /api/graduate/complete  body: { fromLocalProfileId, toEmail }
// Called once someone has actually signed in via a graduation link, so
// toEmail is a real, verified address at this point.
export async function POST(request) {
  const body = await request.json();
  const fromId = body.fromLocalProfileId;
  const toEmail = (body.toEmail || "").trim().toLowerCase();
  if (!fromId || !toEmail) return NextResponse.json({ error: "fromLocalProfileId and toEmail required" }, { status: 400 });

  const localProfile = await kv.get(`user:${fromId}:profile`);
  if (!localProfile) return NextResponse.json({ error: "That local profile no longer exists." }, { status: 404 });

  const alreadyGraduated = await kv.get(`user:${toEmail}:profile`);
  if (alreadyGraduated) {
    // idempotent: if this already ran (e.g. the link got clicked twice),
    // don't error out — just confirm it's done
    return NextResponse.json({ graduated: true, alreadyDone: true });
  }

  const [votes, ratings, dwellTimes] = await Promise.all([
    kv.get(`user:${fromId}:votes`),
    kv.get(`user:${fromId}:ratings`),
    kv.get(`user:${fromId}:dwellTimes`),
  ]);

  // move the profile over, dropping local-profile-only fields
  const newProfile = { ...localProfile, email: toEmail };
  delete newProfile.isLocalProfile;
  delete newProfile.createdBy;
  delete newProfile.name; // real accounts get their name from the OAuth/session provider, not stored on the profile
  await kv.set(`user:${toEmail}:profile`, newProfile);
  if (votes) await kv.set(`user:${toEmail}:votes`, votes);
  if (ratings) await kv.set(`user:${toEmail}:ratings`, ratings);
  if (dwellTimes) await kv.set(`user:${toEmail}:dwellTimes`, dwellTimes);

  // update every family this profile belonged to
  const groups = localProfile.groups?.length ? localProfile.groups : localProfile.group ? [{ code: localProfile.group }] : [];
  for (const g of groups) {
    const members = (await kv.get(`group:${g.code}:members`)) || [];
    const idx = members.findIndex((m) => m.email === fromId);
    if (idx >= 0) {
      members[idx] = { ...members[idx], email: toEmail };
      delete members[idx].isLocalProfile;
      await kv.set(`group:${g.code}:members`, members);
    }
  }

  // remove from the creating parent's managedLocalProfiles list
  if (localProfile.createdBy) {
    const parentProfile = await kv.get(`user:${localProfile.createdBy}:profile`);
    if (parentProfile?.managedLocalProfiles) {
      parentProfile.managedLocalProfiles = parentProfile.managedLocalProfiles.filter((p) => p.id !== fromId);
      await kv.set(`user:${localProfile.createdBy}:profile`, parentProfile);
    }
  }

  // clean up the old local profile's data — everything's been moved
  await kv.del(`user:${fromId}:profile`);
  await kv.del(`user:${fromId}:votes`);
  await kv.del(`user:${fromId}:ratings`);
  await kv.del(`user:${fromId}:dwellTimes`);

  return NextResponse.json({ graduated: true, alreadyDone: false });
}
