import { NextResponse } from "next/server";

// GET /api/nowplaying?region=CA&page=1
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region") || "CA";
  const page = searchParams.get("page") || "1";
  const key = process.env.TMDB_API_KEY;

  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${encodeURIComponent(key)}&language=en-US&region=${encodeURIComponent(region)}&page=${encodeURIComponent(page)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: "TMDB request failed", detail: body }, { status: res.status });
  }
  const data = await res.json();
  return NextResponse.json(data);
}
