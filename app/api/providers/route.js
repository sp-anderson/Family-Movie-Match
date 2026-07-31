import { NextResponse } from "next/server";

// GET /api/providers?movieId=123&region=CA
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const region = searchParams.get("region") || "CA";
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });
  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}/watch/providers?api_key=${encodeURIComponent(key)}`
  );
  const data = await res.json();
  const regionData = data.results ? data.results[region] : null;
  const flatrate = (regionData && regionData.flatrate) || [];
  const rent = (regionData && regionData.rent) || [];
  const buy = (regionData && regionData.buy) || [];

  return NextResponse.json({
    providers: flatrate.map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path })),
    // TMDB doesn't give a per-retailer deep link (no direct "here's the Amazon
    // URL for this movie") — only this one shared JustWatch page showing all
    // rent/buy options together. Using it as a real, working destination for
    // now; once real affiliate deep links exist (direct retailer programs or
    // a JustWatch partner API), swap those in per-provider instead.
    rent: rent.map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path })),
    buy: buy.map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path })),
    link: (regionData && regionData.link) || null,
  });
}
