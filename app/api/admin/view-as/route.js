import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

const RATING_WEIGHTS = { 1: -0.5, 2: 0.1, 3: 0.6, 4: 1.0 };
// same relative weighting as the real algorithm — see computeTasteProfile in app/page.js
const CAST_WEIGHT_MULT = 1;
const KEYWORD_WEIGHT_MULT = 1.5;
const WRITER_WEIGHT_MULT = 2;
const DIRECTOR_WEIGHT_MULT = 3;

function topAndBottom(affinity, n = 5) {
  const entries = Object.entries(affinity).map(([id, score]) => ({ id, score: Math.round(score * 100) / 100 }));
  return {
    top: [...entries].sort((a, b) => b.score - a.score).slice(0, n),
    bottom: [...entries].sort((a, b) => a.score - b.score).slice(0, n),
  };
}

export async function GET(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const [profile, votes, ratings] = await Promise.all([
    kv.get(`user:${email}:profile`),
    kv.get(`user:${email}:votes`),
    kv.get(`user:${email}:ratings`),
  ]);
  if (!profile) return NextResponse.json({ found: false });

  const voteEntries = Object.entries(votes || {});
  const voteBreakdown = { yes: 0, no: 0, seen: 0 };
  voteEntries.forEach(([, choice]) => {
    if (choice && voteBreakdown[choice] !== undefined) voteBreakdown[choice]++;
  });

  const ratingEntries = Object.entries(ratings || {});
  const recentRatings = ratingEntries
    .sort((a, b) => (b[1].ratedAt || 0) - (a[1].ratedAt || 0))
    .slice(0, 10)
    .map(([movieId, r]) => ({ movieId, ...r }));

  // build affinity for every signal the real algorithm actually uses, same
  // weighting — genre, cast, director, writer, keyword. Weighted scores
  // (post-multiplier) so this reflects actual contribution, not raw signal.
  const genreAffinity = {}, castAffinity = {}, directorAffinity = {}, writerAffinity = {}, keywordAffinity = {};
  const sourceMovieFor = {}; // "cast:123" -> a movieId where that id appeared, for name resolution below
  ratingEntries.forEach(([movieId, r]) => {
    if (!RATING_WEIGHTS[r.rating]) return;
    const w = RATING_WEIGHTS[r.rating];
    (r.genreIds || []).forEach((id) => { genreAffinity[id] = (genreAffinity[id] || 0) + w; });
    (r.castIds || []).forEach((id) => { castAffinity[id] = (castAffinity[id] || 0) + w * CAST_WEIGHT_MULT; sourceMovieFor[`cast:${id}`] = movieId; });
    (r.directorIds || []).forEach((id) => { directorAffinity[id] = (directorAffinity[id] || 0) + w * DIRECTOR_WEIGHT_MULT; sourceMovieFor[`director:${id}`] = movieId; });
    (r.writerIds || []).forEach((id) => { writerAffinity[id] = (writerAffinity[id] || 0) + w * WRITER_WEIGHT_MULT; sourceMovieFor[`writer:${id}`] = movieId; });
    (r.keywordIds || []).forEach((id) => { keywordAffinity[id] = (keywordAffinity[id] || 0) + w * KEYWORD_WEIGHT_MULT; sourceMovieFor[`keyword:${id}`] = movieId; });
  });

  const genreResult = topAndBottom(genreAffinity);
  const castResult = topAndBottom(castAffinity);
  const directorResult = topAndBottom(directorAffinity);
  const writerResult = topAndBottom(writerAffinity);
  const keywordResult = topAndBottom(keywordAffinity);

  // resolve real names for whatever made the top/bottom cut, by looking up
  // each id's source movie in the shared credits cache (movie:{id}:credits)
  // — ratings only ever store IDs, never names, so this is the only way to
  // show something a person can actually read instead of a raw TMDB number
  const idsNeedingNames = [
    ...castResult.top.map((e) => ["cast", e.id]),
    ...castResult.bottom.map((e) => ["cast", e.id]),
    ...directorResult.top.map((e) => ["director", e.id]),
    ...directorResult.bottom.map((e) => ["director", e.id]),
    ...writerResult.top.map((e) => ["writer", e.id]),
    ...writerResult.bottom.map((e) => ["writer", e.id]),
    ...keywordResult.top.map((e) => ["keyword", e.id]),
    ...keywordResult.bottom.map((e) => ["keyword", e.id]),
  ];
  const movieIdsToFetch = [...new Set(idsNeedingNames.map(([kind, id]) => sourceMovieFor[`${kind}:${id}`]).filter(Boolean))];
  const creditsByMovie = {};
  await Promise.all(
    movieIdsToFetch.map(async (movieId) => {
      creditsByMovie[movieId] = await kv.get(`movie:${movieId}:credits`);
    })
  );

  function resolveName(kind, id) {
    const movieId = sourceMovieFor[`${kind}:${id}`];
    const credits = movieId && creditsByMovie[movieId];
    if (!credits) return `${kind} ${id}`;
    if (kind === "cast") {
      const idx = (credits.castIds || []).indexOf(Number(id));
      return idx >= 0 ? credits.cast[idx] : `cast ${id}`;
    }
    if (kind === "director") {
      const idx = (credits.directorIds || []).indexOf(Number(id));
      return idx >= 0 ? credits.directorNames[idx] : `director ${id}`;
    }
    if (kind === "writer") {
      const idx = (credits.writerIds || []).indexOf(Number(id));
      return idx >= 0 ? credits.writerNames[idx] : `writer ${id}`;
    }
    if (kind === "keyword") {
      const idx = (credits.keywordIds || []).indexOf(Number(id));
      return idx >= 0 ? credits.keywordNames[idx] : `keyword ${id}`;
    }
    return `${kind} ${id}`;
  }

  const withNames = (result, kind) => ({
    top: result.top.map((e) => ({ name: resolveName(kind, e.id), score: e.score })),
    bottom: result.bottom.map((e) => ({ name: resolveName(kind, e.id), score: e.score })),
  });

  return NextResponse.json({
    found: true,
    settings: {
      dob: profile.dob,
      isMinor: profile.isMinor,
      consentStatus: profile.consentStatus,
      approvedRating: profile.approvedRating,
      services: profile.services || [],
      genres: profile.genres || [],
      excludedGenres: profile.excludedGenres || [],
      excludedKeywords: profile.excludedKeywords || [],
      region: profile.region,
      wantsTheaters: profile.wantsTheaters || false,
      isLocalProfile: !!profile.isLocalProfile,
    },
    voteBreakdown,
    totalRatings: ratingEntries.length,
    recentRatings,
    topGenreAffinities: genreResult.top.map((e) => ({ genreId: Number(e.id), score: e.score })),
    bottomGenreAffinities: genreResult.bottom.map((e) => ({ genreId: Number(e.id), score: e.score })),
    castAffinities: withNames(castResult, "cast"),
    directorAffinities: withNames(directorResult, "director"),
    writerAffinities: withNames(writerResult, "writer"),
    keywordAffinities: withNames(keywordResult, "keyword"),
    personalizationActive: ratingEntries.length >= 5,
  });
}
