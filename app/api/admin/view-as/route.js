import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

const RATING_WEIGHTS = { 1: -0.5, 2: 0.1, 3: 0.6, 4: 1.0 };

export async function GET(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const [profile, votes, ratings] = await Promise.all([
    kv.get(`user:${email}:profile`),
    kv.get(`user:${email}:votes`),
    kv.get(`user:${email}:ratings`),
  ]);
  if (!profile) return NextResponse.json({ found: false });

  const voteEntries = Object.entries(votes || {});
  const voteBreakdown = { yes: 0, no: 0, seen: 0 };
  voteEntries.forEach(([, choice]) => {
    if (choice && voteBreakdown[choice] !== undefined) voteBreakdown[choice]++;
  });

  const ratingEntries = Object.entries(ratings || {});
  const recentRatings = ratingEntries
    .sort((a, b) => (b[1].ratedAt || 0) - (a[1].ratedAt || 0))
    .slice(0, 10)
    .map(([movieId, r]) => ({ movieId, ...r }));

  // rough genre affinity, same weighting as the client — gives a quick
  // read on what's actually driving this person's personalization
  const genreAffinity = {};
  ratingEntries.forEach(([, r]) => {
    if (!RATING_WEIGHTS[r.rating]) return;
    (r.genreIds || []).forEach((g) => {
      genreAffinity[g] = (genreAffinity[g] || 0) + RATING_WEIGHTS[r.rating];
    });
  });
  const topGenreAffinities = Object.entries(genreAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genreId, score]) => ({ genreId: Number(genreId), score: Math.round(score * 100) / 100 }));
  const bottomGenreAffinities = Object.entries(genreAffinity)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([genreId, score]) => ({ genreId: Number(genreId), score: Math.round(score * 100) / 100 }));

  return NextResponse.json({
    found: true,
    settings: {
      dob: profile.dob,
      isMinor: profile.isMinor,
      consentStatus: profile.consentStatus,
      approvedRating: profile.approvedRating,
      services: profile.services || [],
      genres: profile.genres || [],
      excludedGenres: profile.excludedGenres || [],
      excludedKeywords: profile.excludedKeywords || [],
      region: profile.region,
      wantsTheaters: profile.wantsTheaters || false,
      isLocalProfile: !!profile.isLocalProfile,
    },
    voteBreakdown,
    totalRatings: ratingEntries.length,
    recentRatings,
    topGenreAffinities,
    bottomGenreAffinities,
    personalizationActive: ratingEntries.length >= 5,
  });
}
