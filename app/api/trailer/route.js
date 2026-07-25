import { NextResponse } from "next/server";

// GET /api/trailer?movieId=123
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}/videos?api_key=${encodeURIComponent(key)}`
  );
  const data = await res.json();
  const trailer =
    (data.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    (data.results || [])[0];

  return NextResponse.json({ key: trailer ? trailer.key : null });
}
