import { NextResponse } from "next/server";
import { redis as kv } from "../../../../lib/redis";

// POST /api/merge/complete  body: { fromLocalProfileId, toEmail }
// Only ever called after the target account's real owner has explicitly
// confirmed in-app — the email link alone just proves they own the inbox,
// not that they've agreed to the merge itself.
export async function POST(request) {
  const body = await request.json();
  const fromId = body.fromLocalProfileId;
  const toEmail = (body.toEmail || "").trim().toLowerCase();
  if (!fromId || !toEmail) return NextResponse.json({ error: "fromLocalProfileId and toEmail required" }, { status: 400 });

  const localProfile = await kv.get(`user:${fromId}:profile`);
  if (!localProfile) {
    // already merged/cleaned up — treat as done rather than error, in case
    // this got triggered twice
    return NextResponse.json({ merged: true, alreadyDone: true });
  }

  const [localVotes, localRatings, localDwell, targetVotes, targetRatings, targetDwell] = await Promise.all([
    kv.get(`user:${fromId}:votes`),
    kv.get(`user:${fromId}:ratings`),
    kv.get(`user:${fromId}:dwellTimes`),
    kv.get(`user:${toEmail}:votes`),
    kv.get(`user:${toEmail}:ratings`),
    kv.get(`user:${toEmail}:dwellTimes`),
  ]);

  // votes: add anything new; on conflict, the existing real account's vote wins
  const mergedVotes = { ...(targetVotes || {}) };
  Object.entries(localVotes || {}).forEach(([movieId, choice]) => {
    if (!mergedVotes[movieId]) mergedVotes[movieId] = choice;
    // conflict — target's existing vote is left as-is, local profile's is dropped
  });
  await kv.set(`user:${toEmail}:votes`, mergedVotes);

  // ratings: add anything new; on conflict, whichever side is more recent wins
  const mergedRatings = { ...(targetRatings || {}) };
  Object.entries(localRatings || {}).forEach(([movieId, localRating]) => {
    const existingRating = mergedRatings[movieId];
    if (!existingRating || (localRating.ratedAt || 0) > (existingRating.ratedAt || 0)) {
      mergedRatings[movieId] = localRating;
    }
  });
  await kv.set(`user:${toEmail}:ratings`, mergedRatings);

  // dwell times: no meaningful conflict semantics — just fill in what's missing
  const mergedDwell = { ...(targetDwell || {}) };
  Object.entries(localDwell || {}).forEach(([movieId, ms]) => {
    if (mergedDwell[movieId] === undefined) mergedDwell[movieId] = ms;
  });
  if (Object.keys(mergedDwell).length) await kv.set(`user:${toEmail}:dwellTimes`, mergedDwell);

  // family membership: add the real account to any family the local profile
  // was in that it isn't already part of. Where the real account is ALREADY
  // a member somewhere, their own existing role/cap is left untouched —
  // this merges watch history, not identity or settings.
  const groups = localProfile.groups?.length ? localProfile.groups : localProfile.group ? [{ code: localProfile.group }] : [];
  const targetProfile = await kv.get(`user:${toEmail}:profile`);
  const targetGroups = targetProfile?.groups?.length ? targetProfile.groups : targetProfile?.group ? [{ code: targetProfile.group, nickname: targetProfile.group }] : [];
  const targetGroupCodes = new Set(targetGroups.map((g) => g.code));
  let newTargetGroups = targetGroups;

  for (const g of groups) {
    const members = (await kv.get(`group:${g.code}:members`)) || [];
    const localIdx = members.findIndex((m) => m.email === fromId);
    const alreadyMember = members.some((m) => m.email === toEmail);

    if (!alreadyMember && localIdx >= 0) {
      // carry over the local profile's role/cap as a starting point
      members.push({ ...members[localIdx], email: toEmail });
      if (!targetGroupCodes.has(g.code)) {
        newTargetGroups = [...newTargetGroups, { code: g.code, nickname: g.code }];
        targetGroupCodes.add(g.code);
      }
    }
    // remove the old local profile entry either way — it's being merged away
    if (localIdx >= 0) members.splice(localIdx, 1);
    await kv.set(`group:${g.code}:members`, members);
  }

  if (targetProfile && newTargetGroups.length !== targetGroups.length) {
    targetProfile.groups = newTargetGroups;
    await kv.set(`user:${toEmail}:profile`, targetProfile);
  }

  // remove from the creating parent's managedLocalProfiles list
  if (localProfile.createdBy) {
    const parentProfile = await kv.get(`user:${localProfile.createdBy}:profile`);
    if (parentProfile?.managedLocalProfiles) {
      parentProfile.managedLocalProfiles = parentProfile.managedLocalProfiles.filter((p) => p.id !== fromId);
      await kv.set(`user:${localProfile.createdBy}:profile`, parentProfile);
    }
  }

  // clean up — everything's been merged over
  await kv.del(`user:${fromId}:profile`);
  await kv.del(`user:${fromId}:votes`);
  await kv.del(`user:${fromId}:ratings`);
  await kv.del(`user:${fromId}:dwellTimes`);

  return NextResponse.json({ merged: true, alreadyDone: false });
}
