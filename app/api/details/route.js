import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/details?movieId=123
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });

  // this data (cast, crew, keywords, certification, runtime) is the same
  // for every user and every family — cache it once, shared, so repeated
  // lookups across the whole app don't hit TMDB again for a movie someone's
  // already fetched credits for. TMDB's API terms prohibit caching their
  // data for longer than 6 months, so this expires slightly under that
  // (175 days, not the full 182) as a safety margin — a stale/expired
  // entry looks identical to a cache miss to the code below, so it just
  // gets refetched naturally the next time anyone requests it. This also
  // means the app's data quietly stays more accurate over time, not just
  // compliant, since TMDB's own data does get corrected/updated.
  const CACHE_TTL_SECONDS = 175 * 24 * 60 * 60;
  // bump this whenever the shape of what we fetch/cache changes, so old
  // entries written before a field existed (e.g. keywords) get refreshed
  // instead of silently staying incomplete forever
  const CACHE_SCHEMA_VERSION = 2;

  const cacheKey = `movie:${movieId}:credits`;
  const cached = await kv.get(cacheKey);
  if (cached && cached._v === CACHE_SCHEMA_VERSION) {
    console.log(`[details] cache HIT for movie ${movieId}`);
    return NextResponse.json(cached);
  }
  console.log(`[details] cache MISS for movie ${movieId} — fetching from TMDB`);

  if (!key) return NextResponse.json({ error: "TMDB_API_KEY is not set" }, { status: 500 });

  const res = await fetch(
    `https://api.themoviedb.org/3/movie/${encodeURIComponent(movieId)}?api_key=${encodeURIComponent(key)}&append_to_response=credits,release_dates,keywords`
  );
  const data = await res.json();

  const usReleases = data.release_dates?.results?.find((r) => r.iso_3166_1 === "US");
  const certification = (usReleases?.release_dates || []).map((r) => r.certification).find((c) => c) || null;

  const castList = (data.credits?.cast || []).slice(0, 4);
  const crew = data.credits?.crew || [];
  const directors = crew.filter((c) => c.job === "Director");
  const writers = crew.filter((c) => ["Writer", "Screenplay", "Story"].includes(c.job));
  const keywords = data.keywords?.keywords || []; // TMDB nests it as { keywords: { keywords: [...] } } for movies

  const result = {
    _v: CACHE_SCHEMA_VERSION,
    runtime: data.runtime || null,
    cast: castList.map((c) => c.name),
    castIds: castList.map((c) => c.id),
    directorIds: directors.map((c) => c.id),
    directorNames: directors.map((c) => c.name),
    writerIds: writers.map((c) => c.id),
    writerNames: writers.map((c) => c.name),
    keywordIds: keywords.map((k) => k.id),
    keywordNames: keywords.map((k) => k.name),
    certification,
  };

  // don't cache a failed/empty TMDB lookup — let the next request retry.
  // Also: don't permanently cache a MISSING certification for a recent
  // release — the MPA rating may just not be finalized yet, and unlike
  // cast/director/writer/keywords (genuinely fixed facts), certification
  // is the safety-critical field that enforces kids' rating caps. Better
  // to keep re-checking a handful of very new releases than to lock in
  // "unrated" forever for something that'll get a real rating soon.
  const releaseDate = data.release_date ? new Date(data.release_date) : null;
  const isRecentRelease = releaseDate && Date.now() - releaseDate.getTime() < 1000 * 60 * 60 * 24 * 180;
  const safeToCache = data.id && !(isRecentRelease && !certification);
  if (safeToCache) await kv.set(cacheKey, result, { ex: CACHE_TTL_SECONDS });

  return NextResponse.json(result);
}
