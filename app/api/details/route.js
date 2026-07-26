import { NextResponse } from "next/server";

// GET /api/details?movieId=123
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}?api_key=${encodeURIComponent(key)}&append_to_response=credits`
  );
  const data = await res.json();

  return NextResponse.json({
    runtime: data.runtime || null,
    cast: (data.credits?.cast || []).slice(0, 4).map((c) => c.name),
  });
}
