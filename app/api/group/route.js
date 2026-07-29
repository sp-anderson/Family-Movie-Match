import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/group?code=THOMPSONS  -> { members: [], pool: null, spotlight: [], certifications: {}, skipped: {}, nudgeDismissed: {} }
// Note: votes are NOT stored per-room anymore — they belong to the user
// (see /api/uservotes). The client assembles a room's votes by fetching
// each member's own vote history and cross-referencing.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [members, pool, spotlight, certifications, skipped, nudgeDismissed] = await Promise.all([
    kv.get(`group:${code}:members`),
    kv.get(`group:${code}:pool`),
    kv.get(`group:${code}:spotlight`),
    kv.get(`group:${code}:certifications`),
    kv.get(`group:${code}:skipped`),
    kv.get(`group:${code}:nudgeDismissed`),
  ]);

  return NextResponse.json({
    members: members || [],
    pool: pool || null,
    spotlight: spotlight || [],
    certifications: certifications || {},
    skipped: skipped || {},
    nudgeDismissed: nudgeDismissed || {},
  });
}

// POST /api/group  body: { code, type: "member"|"pool"|"spotlight"|"certification"|"skip", payload }
export async function POST(request) {
  const body = await request.json();
  const code = (body.code || "").toUpperCase();
  if (!code || !body.type) {
    return NextResponse.json({ error: "code and type required" }, { status: 400 });
  }

  if (body.type === "member") {
    // payload: { name, email, role, services, genres, favorites, maxRating }
    const members = (await kv.get(`group:${code}:members`)) || [];
    const idx = members.findIndex((m) => (m.email && body.payload.email ? m.email === body.payload.email : m.name === body.payload.name));
    if (idx >= 0) members[idx] = { ...members[idx], ...body.payload };
    else members.push(body.payload);
    await kv.set(`group:${code}:members`, members);
    return NextResponse.json({ members });
  }

  if (body.type === "pool") {
    // payload: full pool object { region, providerIds, genreIds, movies, fetchedAt }
    await kv.set(`group:${code}:pool`, body.payload);
    return NextResponse.json({ pool: body.payload });
  }

  if (body.type === "spotlight") {
    // payload: { movieId, byEmail, byName, action: "add" | "remove" }
    let spotlight = (await kv.get(`group:${code}:spotlight`)) || [];
    if (body.payload.action === "remove") {
      spotlight = spotlight.filter((s) => !(s.movieId === body.payload.movieId && s.byEmail === body.payload.byEmail));
    } else {
      const exists = spotlight.some((s) => s.movieId === body.payload.movieId && s.byEmail === body.payload.byEmail);
      if (!exists) spotlight.push({ movieId: body.payload.movieId, byEmail: body.payload.byEmail, byName: body.payload.byName, at: Date.now() });
    }
    await kv.set(`group:${code}:spotlight`, spotlight);
    return NextResponse.json({ spotlight });
  }

  if (body.type === "certification") {
    // payload: { movieId, certification }  — cached once per movie, shared by the whole family
    const certifications = (await kv.get(`group:${code}:certifications`)) || {};
    certifications[body.payload.movieId] = body.payload.certification;
    await kv.set(`group:${code}:certifications`, certifications);
    return NextResponse.json({ certifications });
  }

  if (body.type === "skip") {
    // payload: { email, movieId, action: "add" | "remove" }
    const skipped = (await kv.get(`group:${code}:skipped`)) || {};
    const list = skipped[body.payload.email] || [];
    if (body.payload.action === "remove") {
      skipped[body.payload.email] = list.filter((id) => id !== body.payload.movieId);
    } else if (!list.includes(body.payload.movieId)) {
      skipped[body.payload.email] = [...list, body.payload.movieId];
    }
    await kv.set(`group:${code}:skipped`, skipped);
    return NextResponse.json({ skipped });
  }

  if (body.type === "nudgeDismiss") {
    // payload: { email, movieId }  — marks that this person has already
    // re-decided on this recommendation, so it stops reappearing for them
    const nudgeDismissed = (await kv.get(`group:${code}:nudgeDismissed`)) || {};
    const list = nudgeDismissed[body.payload.email] || [];
    if (!list.includes(body.payload.movieId)) {
      nudgeDismissed[body.payload.email] = [...list, body.payload.movieId];
    }
    await kv.set(`group:${code}:nudgeDismissed`, nudgeDismissed);
    return NextResponse.json({ nudgeDismissed });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
