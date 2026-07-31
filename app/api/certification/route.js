import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/certification?movieId=123
// Returns the US MPA certification (G, PG, PG-13, R, NC-17) if TMDB has one.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });

  // if /api/details already fetched full credits for this movie (shared
  // across every user/family), reuse its certification instead of another
  // TMDB round-trip — this route runs at much higher volume (every deck
  // card, not just rated ones), so this cache hit matters a lot here
  const cached = await kv.get(`movie:${movieId}:credits`);
  if (cached && cached.certification !== undefined) {
    console.log(`[certification] cache HIT for movie ${movieId}`);
    return NextResponse.json({ certification: cached.certification });
  }
  console.log(`[certification] cache MISS for movie ${movieId} — fetching from TMDB`);

  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}/release_dates?api_key=${encodeURIComponent(key)}`
  );
  const data = await res.json();

  const usEntry = (data.results || []).find((r) => r.iso_3166_1 === "US");
  let certification = null;
  if (usEntry) {
    // prefer a theatrical release certification, fall back to any non-empty one
    const theatrical = usEntry.release_dates.find((rd) => rd.type === 3 && rd.certification);
    const any = usEntry.release_dates.find((rd) => rd.certification);
    certification = (theatrical || any || {}).certification || null;
  }

  return NextResponse.json({ certification: certification || null });
}
