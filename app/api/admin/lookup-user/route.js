import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";
import { getRevenueSummary } from "../../../../lib/revenue";

export async function GET(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const profile = await kv.get(`user:${email}:profile`);
  if (!profile) return NextResponse.json({ found: false });

  const groups = profile.groups?.length ? profile.groups : profile.group ? [{ code: profile.group, nickname: profile.group }] : [];
  const familyMemberships = await Promise.all(
    groups.map(async (g) => {
      const members = (await kv.get(`group:${g.code}:members`)) || [];
      const me = members.find((m) => m.email === email);
      return { code: g.code, nickname: g.nickname, role: me?.role || null, maxRating: me?.maxRating ?? null, isLocalProfile: !!me?.isLocalProfile };
    })
  );

  const votes = await kv.get(`user:${email}:votes`);
  const ratings = await kv.get(`user:${email}:ratings`);
  const dwellTimes = await kv.get(`user:${email}:dwellTimes`);

  // find any consent record tied to this email, in case of a stuck approval
  const consentToken = await kv.get(`consent-by-child:${email}`);
  const consentRecord = consentToken ? await kv.get(`consent:${consentToken}`) : null;

  const revenue = await getRevenueSummary(email);

  return NextResponse.json({
    found: true,
    profile,
    familyMemberships,
    managedLocalProfiles: profile.managedLocalProfiles || [],
    voteCount: votes ? Object.keys(votes).length : 0,
    ratingCount: ratings ? Object.keys(ratings).length : 0,
    dwellTimeCount: dwellTimes ? Object.keys(dwellTimes).length : 0,
    consentRecord,
    revenue,
  });
}
