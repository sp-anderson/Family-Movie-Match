import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/movie-cache?email=you@gmail.com -> { cache: { movieId: {title, poster_path, ...} } }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const cache = await kv.get(`user:${email}:movieCache`);
  return NextResponse.json({ cache: cache || {} });
}

// POST /api/movie-cache  body: { email, movie }
// upserts one movie's display metadata — called whenever a vote or rating
// is cast, so "my movies" is never dependent on any family pool to render
export async function POST(request) {
  const body = await request.json();
  const email = body.email;
  const movie = body.movie;
  if (!email || !movie?.id) return NextResponse.json({ error: "email and movie (with id) required" }, { status: 400 });

  const cache = (await kv.get(`user:${email}:movieCache`)) || {};
  cache[movie.id] = {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    genre_ids: movie.genre_ids || [],
    original_language: movie.original_language || null,
  };
  await kv.set(`user:${email}:movieCache`, cache);
  return NextResponse.json({ ok: true });
}
