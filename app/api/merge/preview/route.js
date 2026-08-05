import { NextResponse } from "next/server";
import { redis as kv } from "../../../../lib/redis";

// GET /api/merge/preview?fromLocalProfileId=X&toEmail=Y
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fromId = searchParams.get("fromLocalProfileId");
  const toEmail = (searchParams.get("toEmail") || "").trim().toLowerCase();
  if (!fromId || !toEmail) return NextResponse.json({ error: "fromLocalProfileId and toEmail required" }, { status: 400 });

  const [localProfile, localVotes, localRatings, targetVotes, targetRatings] = await Promise.all([
    kv.get(`user:${fromId}:profile`),
    kv.get(`user:${fromId}:votes`),
    kv.get(`user:${fromId}:ratings`),
    kv.get(`user:${toEmail}:votes`),
    kv.get(`user:${toEmail}:ratings`),
  ]);

  if (!localProfile) return NextResponse.json({ error: "That local profile no longer exists." }, { status: 404 });

  const lv = localVotes || {};
  const tv = targetVotes || {};
  let newVotes = 0, conflictVotes = 0;
  Object.entries(lv).forEach(([movieId, choice]) => {
    if (!tv[movieId]) newVotes++;
    else if (tv[movieId] !== choice) conflictVotes++;
  });

  const lr = localRatings || {};
  const tr = targetRatings || {};
  let newRatings = 0, conflictRatings = 0;
  Object.entries(lr).forEach(([movieId, r]) => {
    if (!tr[movieId]) newRatings++;
    else if (tr[movieId].rating !== r.rating) conflictRatings++;
  });

  const groups = localProfile.groups?.length ? localProfile.groups : localProfile.group ? [{ code: localProfile.group, nickname: localProfile.group }] : [];

  return NextResponse.json({
    found: true,
    localProfileName: localProfile.name || "this profile",
    families: groups.map((g) => g.nickname || g.code),
    newVotes,
    conflictVotes,
    newRatings,
    conflictRatings,
  });
}
