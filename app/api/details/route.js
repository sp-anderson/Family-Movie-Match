import { NextResponse } from "next/server";

// GET /api/details?movieId=123
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const movieId = searchParams.get("movieId");
  const key = process.env.TMDB_API_KEY;

  if (!movieId) return NextResponse.json({ error: "movieId required" }, { status: 400 });
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

  return NextResponse.json({
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
  });
}
