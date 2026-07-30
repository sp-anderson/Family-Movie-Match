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

// POST /api/ratings  body: { email, movieId, rating, genreIds }  — rating is 1-4
export async function POST(request) {
  const body = await request.json();
  const { email, movieId, rating, genreIds } = body;
  if (!email || !movieId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: "email, movieId, and rating (1-4) required" }, { status: 400 });
  }
  const ratings = (await kv.get(`user:${email}:ratings`)) || {};
  ratings[movieId] = { rating, ratedAt: Date.now(), genreIds: genreIds || ratings[movieId]?.genreIds || [] };
  await kv.set(`user:${email}:ratings`, ratings);
  return NextResponse.json({ ratings });
}
