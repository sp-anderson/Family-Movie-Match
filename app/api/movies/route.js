import { NextResponse } from "next/server";

// GET /api/movies?region=CA&providers=8|9&genres=28|35&page=1&includeRentBuy=true
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "CA";
  const providers = searchParams.get("providers") || "";
  const genres = searchParams.get("genres") || "";
  const page = searchParams.get("page") || "1";
  const includeRentBuy = searchParams.get("includeRentBuy") === "true";

  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const monetizationTypes = includeRentBuy ? "flatrate,rent,buy" : "flatrate";

  const url =
    `https://api.themoviedb.org/3/discover/movie` +
    `?api_key=${encodeURIComponent(key)}` +
    `&language=en-US&sort_by=popularity.desc` +
    `&watch_region=${encodeURIComponent(region)}` +
    `&with_watch_providers=${encodeURIComponent(providers)}` +
    `&with_watch_monetization_types=${monetizationTypes}` +
    `&with_genres=${encodeURIComponent(genres)}` +
    `&vote_count.gte=30&vote_average.gte=6&page=${encodeURIComponent(page)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: "TMDB request failed", detail: body }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
