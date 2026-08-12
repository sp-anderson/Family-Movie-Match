// Shared recommendation-scoring logic. Pure functions only — no client
// state, no server-only APIs — so this file can be imported from both
// app/page.js (client) and API routes (server) without duplication.

export const RATING_WEIGHTS = { 1: -0.5, 2: 0.1, 3: 0.6, 4: 1.0 }; // Dislike / OK (near-neutral) / Liked / Loved it
export const NO_VOTE_WEIGHT = -0.3; // mild negative — a pass isn't as strong a signal as an actual dislike rating
export const AFFINITY_HALF_LIFE_DAYS = 304; // ~10 months — older ratings gradually count for less

// director/writer overlap is a much more specific, predictive signal than
// genre overlap (there are only ~20 genres total, so genre matches are
// common and noisy; sharing a specific director with something you rated
// highly is rare and means a lot more) — weighted accordingly
export const CAST_WEIGHT_MULT = 1;
export const KEYWORD_WEIGHT_MULT = 1.5; // more specific than genre (captures "superhero," "time travel," etc — things genre can't express) but a movie can carry many keywords, diluting any one contribution
export const WRITER_WEIGHT_MULT = 2;
export const DIRECTOR_WEIGHT_MULT = 3;

export const KEYWORD_STRONG_DISLIKE_THRESHOLD = -1.0; // roughly 2-3 "not for me" ratings sharing a keyword
export const KEYWORD_DAMPEN_FACTOR = 0.3; // once that threshold is hit, the whole score gets cut way down — not just the keyword term

export function computeTasteProfileFor({ ratings, votingEmail, poolMovies, votesByMovie, creditsByMovie, dwellTimesForVotingEmail }) {
  const genre = {}, cast = {}, director = {}, writer = {}, keyword = {}, language = {};
  const now = Date.now();
  Object.values(ratings || {}).forEach(({ rating, ratedAt, genreIds, originalLanguage, castIds, directorIds, writerIds, keywordIds, rewatchCount }) => {
    if (!RATING_WEIGHTS[rating]) return;
    const daysAgo = (now - (ratedAt || now)) / (1000 * 60 * 60 * 24);
    const decay = Math.pow(0.5, daysAgo / AFFINITY_HALF_LIFE_DAYS);
    // a genuine rewatch (not a same-day correction) is a strong implicit
    // signal on top of the rating itself — someone who watched something
    // again clearly meant it, so weight it up, capped so it can't run away
    const rewatchMult = 1 + Math.min((rewatchCount || 0) * 0.25, 1);
    const weight = RATING_WEIGHTS[rating] * decay * rewatchMult;
    (genreIds || []).forEach((g) => { genre[g] = (genre[g] || 0) + weight; });
    if (originalLanguage) language[originalLanguage] = (language[originalLanguage] || 0) + weight;
    (castIds || []).forEach((c) => { cast[c] = (cast[c] || 0) + weight; });
    (directorIds || []).forEach((d) => { director[d] = (director[d] || 0) + weight; });
    (writerIds || []).forEach((w) => { writer[w] = (writer[w] || 0) + weight; });
    (keywordIds || []).forEach((k) => { keyword[k] = (keyword[k] || 0) + weight; });
  });
  (poolMovies || []).forEach((m) => {
    if ((votesByMovie?.[m.id] || {})[votingEmail] === "no") {
      // dwell time as a confidence signal: a near-instant swipe is more
      // reflexive (poster/title alone), a longer look before deciding
      // reflects genuine engagement with the content — so it counts for
      // more either way. Baseline ~3s glance, clamped so an outlier
      // (phone left open, etc.) can't distort things too far. Only ever
      // available for the person actively browsing — falls back to the
      // same default assumption whenever it's unknown.
      const dwellMs = dwellTimesForVotingEmail?.[m.id];
      const dwellSeconds = (dwellMs || 3000) / 1000;
      const dwellMult = Math.max(0.5, Math.min(1.5, dwellSeconds / 3));
      const weight = NO_VOTE_WEIGHT * dwellMult;
      (m.genre_ids || []).forEach((g) => { genre[g] = (genre[g] || 0) + weight; });
      if (m.original_language) language[m.original_language] = (language[m.original_language] || 0) + weight;
      const credits = creditsByMovie?.[m.id];
      if (credits) {
        (credits.castIds || []).forEach((c) => { cast[c] = (cast[c] || 0) + weight; });
        (credits.directorIds || []).forEach((d) => { director[d] = (director[d] || 0) + weight; });
        (credits.writerIds || []).forEach((w) => { writer[w] = (writer[w] || 0) + weight; });
        (credits.keywordIds || []).forEach((k) => { keyword[k] = (keyword[k] || 0) + weight; });
      }
    }
  });
  return { genre, cast, director, writer, keyword, language };
}

export function scoreMovieByProfile(movie, profile, creditsByMovie) {
  let score = (movie.genre_ids || []).reduce((sum, g) => sum + (profile.genre[g] || 0), 0);
  if (movie.original_language) score += profile.language[movie.original_language] || 0;
  // cast/crew/keyword scoring only kicks in for movies we already have
  // credits cached for — degrades gracefully to genre-only otherwise,
  // rather than requiring credits for the whole pool up front
  const credits = creditsByMovie?.[movie.id];
  if (credits) {
    score += (credits.castIds || []).reduce((sum, c) => sum + (profile.cast[c] || 0), 0) * CAST_WEIGHT_MULT;
    score += (credits.directorIds || []).reduce((sum, d) => sum + (profile.director[d] || 0), 0) * DIRECTOR_WEIGHT_MULT;
    score += (credits.writerIds || []).reduce((sum, w) => sum + (profile.writer[w] || 0), 0) * WRITER_WEIGHT_MULT;
    const keywordRaw = (credits.keywordIds || []).reduce((sum, k) => sum + (profile.keyword[k] || 0), 0);
    score += keywordRaw * KEYWORD_WEIGHT_MULT;
    // this is the "I like action generally, but not superhero
    // specifically" case: a purely additive score lets a broad genre
    // preference swamp a narrower, strongly-held dislike. Once someone's
    // shown a clear repeated pattern against a specific keyword, let it
    // suppress the whole ranking instead of just being outvoted by genre.
    if (keywordRaw < KEYWORD_STRONG_DISLIKE_THRESHOLD) {
      score *= KEYWORD_DAMPEN_FACTOR;
    }
  }
  return score;
}

// percentile rank of every movie in a pool against one person's own taste
// profile — expresses "would they like this" relative to their own range,
// since a raw score means something different depending on how much
// they've rated
export function computePercentileMap(poolMovies, profile, creditsByMovie) {
  const scored = poolMovies.map((m) => ({ id: m.id, score: scoreMovieByProfile(m, profile, creditsByMovie) }));
  scored.sort((a, b) => a.score - b.score);
  const map = new Map();
  scored.forEach((item, idx) => {
    map.set(item.id, scored.length > 1 ? Math.round((idx / (scored.length - 1)) * 100) : 100);
  });
  return map;
}
