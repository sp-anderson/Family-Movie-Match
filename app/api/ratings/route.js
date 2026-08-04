import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/ratings?email=you@gmail.com -> { ratings: { movieId: { rating, ratedAt } } }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const ratings = await kv.get(`user:${email}:ratings`);
  return NextResponse.json({ ratings: ratings || {} });
}

// POST /api/ratings  body: { email, movieId, rating, genreIds, castIds, directorIds, writerIds, keywordIds }
const REWATCH_MIN_GAP_MS = 24 * 60 * 60 * 1000; // re-rating within a day = correction, not a rewatch

export async function POST(request) {
  const body = await request.json();
  const { email, movieId, rating, genreIds, castIds, directorIds, writerIds, keywordIds } = body;
  if (!email || !movieId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: "email, movieId, and rating (1-4) required" }, { status: 400 });
  }
  const ratings = (await kv.get(`user:${email}:ratings`)) || {};
  const existing = ratings[movieId] || {};
  const now = Date.now();
  const isGenuineRewatch = existing.ratedAt && now - existing.ratedAt > REWATCH_MIN_GAP_MS;
  ratings[movieId] = {
    rating,
    ratedAt: now,
    genreIds: genreIds || existing.genreIds || [],
    castIds: castIds || existing.castIds || [],
    directorIds: directorIds || existing.directorIds || [],
    writerIds: writerIds || existing.writerIds || [],
    keywordIds: keywordIds || existing.keywordIds || [],
    rewatchCount: isGenuineRewatch ? (existing.rewatchCount || 0) + 1 : existing.rewatchCount || 0,
  };
  await kv.set(`user:${email}:ratings`, ratings);
  return NextResponse.json({ ratings });
}
