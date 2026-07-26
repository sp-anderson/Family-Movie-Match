import { NextResponse } from "next/server";

// GET /api/search?query=inception
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const key = process.env.TMDB_API_KEY;

  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });
  if (!query) return NextResponse.json({ results: [] });

  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}`
  );
  const data = await res.json();

  return NextResponse.json({
    results: (data.results || []).slice(0, 6).map((m) => ({
      id: m.id,
      title: m.title,
      year: (m.release_date || "").slice(0, 4),
      poster_path: m.poster_path,
    })),
  });
}
