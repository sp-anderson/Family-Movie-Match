import { NextResponse } from "next/server";

// GET /api/movie?movieId=123
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(`https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}?api_key=${encodeURIComponent(key)}`);
  if (!res.ok) return NextResponse.json({ error: "not found" }, { status: res.status });
  const data = await res.json();

  return NextResponse.json({
    id: data.id,
    title: data.title,
    overview: data.overview,
    poster_path: data.poster_path,
    release_date: data.release_date,
    vote_average: data.vote_average,
    genre_ids: (data.genres || []).map((g) => g.id),
  });
}
