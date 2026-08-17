import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

function toCacheEntry(movie) {
  return {
    id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    genre_ids: movie.genre_ids || (movie.genres || []).map((g) => g.id) || [],
    original_language: movie.original_language || null,
  };
}

// POST /api/admin/backfill-movie-cache  body: { code }
export async function POST(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const body = await request.json();
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [members, pool] = await Promise.all([kv.get(`group:${code}:members`), kv.get(`group:${code}:pool`)]);
  if (!members?.length) return NextResponse.json({ error: "no family found with that code" }, { status: 404 });

  const poolById = new Map((pool?.movies || []).map((m) => [m.id, m]));
  const results = {};

  for (const member of members) {
    const email = member.email;
    try {
      const [votes, ratings, existingCache] = await Promise.all([
        kv.get(`user:${email}:votes`),
        kv.get(`user:${email}:ratings`),
        kv.get(`user:${email}:movieCache`),
      ]);
      const cache = existingCache || {};
      const votedIds = Object.keys(votes || {}).map(Number);
      const ratedIds = Object.keys(ratings || {}).map(Number);
      const allIds = [...new Set([...votedIds, ...ratedIds])];
      const missingIds = allIds.filter((id) => !cache[id]);

      let added = 0;
      const stillMissing = [];
      for (const id of missingIds) {
        if (poolById.has(id)) {
          cache[id] = toCacheEntry(poolById.get(id));
          added++;
        } else {
          stillMissing.push(id);
        }
      }

      // anything not found in this family's pool needs a real TMDB fetch —
      // batched gently rather than firing everything at once
      const batchSize = 5;
      for (let i = 0; i < stillMissing.length; i += batchSize) {
        const batch = stillMissing.slice(i, i + batchSize);
        const fetched = await Promise.all(
          batch.map((id) =>
            fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${encodeURIComponent(process.env.TMDB_API_KEY)}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        );
        fetched.filter((m) => m?.id).forEach((m) => {
          cache[m.id] = toCacheEntry(m);
          added++;
        });
      }

      if (added > 0) await kv.set(`user:${email}:movieCache`, cache);
      results[email] = { totalVotedOrRated: allIds.length, added, unresolvable: missingIds.length - added };
    } catch (e) {
      results[email] = { error: e.message || "failed" };
    }
  }

  return NextResponse.json({ results });
}
