import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";
import { computeTasteProfileFor, computePercentileMap } from "../../../lib/scoring";

const CACHE_TTL_SECONDS = 180; // 3 minutes — long enough to absorb repeat views/re-renders, short enough that taste data feels current

async function getPersonPercentiles(email, poolMovies, creditsByMovie) {
  const cacheKey = `matchscore-profile:${email}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached;

  const [ratings, votes] = await Promise.all([
    kv.get(`user:${email}:ratings`),
    kv.get(`user:${email}:votes`),
  ]);
  // the shared scoring function expects votesByMovie shaped
  // { movieId: { email: choice } } — reshape this person's own flat
  // { movieId: choice } votes into that
  const votesByMovie = {};
  Object.entries(votes || {}).forEach(([movieId, choice]) => {
    votesByMovie[movieId] = { [email]: choice };
  });

  const profile = computeTasteProfileFor({
    ratings: ratings || {},
    votingEmail: email,
    poolMovies,
    votesByMovie,
    creditsByMovie,
    dwellTimesForVotingEmail: {}, // not available server-side — falls back to the same default assumption already used for anyone but yourself
  });
  const percentileMap = computePercentileMap(poolMovies, profile, creditsByMovie);
  const percentiles = Object.fromEntries(percentileMap);

  await kv.set(cacheKey, percentiles, { ex: CACHE_TTL_SECONDS });
  return percentiles;
}

// POST /api/match-scores  body: { code, emails: [...], movieIds?: [...] }
// movieIds omitted = return scores for the whole pool
export async function POST(request) {
  const body = await request.json();
  const code = (body.code || "").trim().toUpperCase();
  const emails = (body.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!code || emails.length === 0) {
    return NextResponse.json({ error: "code and at least one email required" }, { status: 400 });
  }

  const pool = await kv.get(`group:${code}:pool`);
  if (!pool || !pool.movies?.length) return NextResponse.json({ scores: {} });

  // one round trip for every movie's cached credits, instead of one per
  // movie — this is the actual cost lever for a pool that can run into the
  // hundreds
  const creditKeys = pool.movies.map((m) => `movie:${m.id}:credits`);
  const creditsArray = creditKeys.length ? await kv.mget(...creditKeys) : [];
  const creditsByMovie = {};
  pool.movies.forEach((m, i) => {
    if (creditsArray[i]) creditsByMovie[m.id] = creditsArray[i];
  });

  const perPersonPercentiles = {};
  await Promise.all(
    emails.map(async (email) => {
      perPersonPercentiles[email] = await getPersonPercentiles(email, pool.movies, creditsByMovie);
    })
  );

  const movieIds = body.movieIds?.length ? body.movieIds : pool.movies.map((m) => m.id);
  const scores = {};
  movieIds.forEach((movieId) => {
    const values = emails.map((email) => perPersonPercentiles[email]?.[movieId]);
    if (values.some((v) => v === undefined)) return; // incomplete data for this movie — omit rather than guess
    // minimum, not average — a "we'd both like this" pick is limited by
    // whoever likes it least, not softened by whoever likes it most
    scores[movieId] = Math.min(...values);
  });

  return NextResponse.json({ scores });
}
