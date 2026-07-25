import { NextResponse } from "next/server";

// GET /api/recommendations?titles=Title+One|Title+Two&region=CA
// For each favorite title: find its TMDB match, then pull TMDB's
// "recommendations" for it. Aggregates + dedupes across all seeds.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const titlesParam = searchParams.get("titles") || "";
  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const titles = titlesParam.split("|").map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const results = [];

  for (const title of titles) {
    try {
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(title)}`
      );
      const searchData = await searchRes.json();
      const match = (searchData.results || [])[0];
      if (!match) continue;

      const recRes = await fetch(
        `https://api.themoviedb.org/3/movie/${match.id}/recommendations?api_key=${encodeURIComponent(key)}`
      );
      const recData = await recRes.json();
      for (const m of (recData.results || []).slice(0, 8)) {
        results.push({ ...m, _because: match.title });
      }
    } catch {
      // skip a bad title match, don't fail the whole batch
    }
  }

  // dedupe, keep first seed credit
  const byId = new Map();
  for (const m of results) if (!byId.has(m.id)) byId.set(m.id, m);

  return NextResponse.json({ results: Array.from(byId.values()) });
}
