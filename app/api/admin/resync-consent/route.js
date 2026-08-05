import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

// POST /api/admin/resync-consent  body: { email }
// Re-applies the approved rating to the child's profile and family member
// record, in case they ever drifted out of sync (the exact bug we found
// earlier where a consent record said "approved" but the profile and/or
// family record never got updated to match).
export async function POST(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const profile = await kv.get(`user:${email}:profile`);
  if (!profile) return NextResponse.json({ error: "no profile found for that email" }, { status: 404 });

  // find the source of truth for the approved rating: prefer the consent
  // record if one exists, otherwise fall back to whatever's on the profile
  const consentToken = await kv.get(`consent-by-child:${email}`);
  const consentRecord = consentToken ? await kv.get(`consent:${consentToken}`) : null;
  const approvedRating = consentRecord?.approvedRating || profile.approvedRating;

  if (!approvedRating) {
    return NextResponse.json({ error: "no approved rating found anywhere for this profile — nothing to sync" }, { status: 400 });
  }

  profile.consentStatus = "approved";
  profile.approvedRating = approvedRating;
  await kv.set(`user:${email}:profile`, profile);

  const results = [];
  const groups = profile.groups?.length ? profile.groups : profile.group ? [{ code: profile.group }] : [];
  for (const g of groups) {
    const members = (await kv.get(`group:${g.code}:members`)) || [];
    const idx = members.findIndex((m) => m.email === email);
    if (idx >= 0) {
      members[idx] = { ...members[idx], role: "child", maxRating: approvedRating };
      await kv.set(`group:${g.code}:members`, members);
      results.push(g.code);
    }
  }

  return NextResponse.json({ synced: true, approvedRating, familiesUpdated: results });
}
