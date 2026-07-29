import { NextResponse } from "next/server";

// GET /api/providers-list?region=CA
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = (searchParams.get("region") || "CA").toUpperCase();
  const key = process.env.TMDB_API_KEY;
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/watch/providers/movie?api_key=${encodeURIComponent(key)}&watch_region=${encodeURIComponent(region)}&language=en-US`
  );
  if (!res.ok) return NextResponse.json({ error: "TMDB request failed" }, { status: res.status });
  const data = await res.json();

  const results = (data.results || [])
    // display_priorities is keyed per-region; fall back to the flat display_priority if present
    .map((p) => ({
      id: p.provider_id,
      name: p.provider_name,
      logo_path: p.logo_path,
      priority: (p.display_priorities && p.display_priorities[region]) ?? p.display_priority ?? 999,
    }))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 40); // keep the selector to the ~40 most relevant providers for this region

  return NextResponse.json({ results });
}
