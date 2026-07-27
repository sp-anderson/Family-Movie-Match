import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/group?code=THOMPSONS  -> { members: [], votes: {}, pool: null, spotlight: [], certifications: {} }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [members, votes, pool, spotlight, certifications] = await Promise.all([
    kv.get(`group:${code}:members`),
    kv.get(`group:${code}:votes`),
    kv.get(`group:${code}:pool`),
    kv.get(`group:${code}:spotlight`),
    kv.get(`group:${code}:certifications`),
  ]);

  return NextResponse.json({
    members: members || [],
    votes: votes || {},
    pool: pool || null,
    spotlight: spotlight || [],
    certifications: certifications || {},
  });
}

// POST /api/group  body: { code, type: "member"|"vote"|"pool"|"spotlight"|"certification", payload }
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

  if (body.type === "vote") {
    // payload: { movieId, name, choice }
    const votes = (await kv.get(`group:${code}:votes`)) || {};
    if (!votes[body.payload.movieId]) votes[body.payload.movieId] = {};
    votes[body.payload.movieId][body.payload.name] = body.payload.choice;
    await kv.set(`group:${code}:votes`, votes);
    return NextResponse.json({ votes });
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

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
