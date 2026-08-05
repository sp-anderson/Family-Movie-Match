import { NextResponse } from "next/server";

// GET /api/keyword-search?query=superhero
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const key = process.env.TMDB_API_KEY;

  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });
  if (!query) return NextResponse.json({ results: [] });

  const res = await fetch(
    `https://api.themoviedb.org/3/search/keyword?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(query)}`
  );
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data.status_message || "TMDB keyword search failed" }, { status: res.status });
  }

  return NextResponse.json({
    results: (data.results || []).slice(0, 8).map((k) => ({ id: k.id, name: k.name })),
  });
}
