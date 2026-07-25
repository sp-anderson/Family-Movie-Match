import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

// GET /api/group?code=THOMPSONS  -> { members: [], votes: {}, pool: null }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [members, votes, pool] = await Promise.all([
    kv.get(`group:${code}:members`),
    kv.get(`group:${code}:votes`),
    kv.get(`group:${code}:pool`),
  ]);

  return NextResponse.json({
    members: members || [],
    votes: votes || {},
    pool: pool || null,
  });
}

// POST /api/group  body: { code, type: "member"|"vote"|"pool", payload }
export async function POST(request) {
  const body = await request.json();
  const code = (body.code || "").toUpperCase();
  if (!code || !body.type) {
    return NextResponse.json({ error: "code and type required" }, { status: 400 });
  }

  if (body.type === "member") {
    // payload: { name, services, genres, favorites }
    const members = (await kv.get(`group:${code}:members`)) || [];
    const idx = members.findIndex((m) => m.name === body.payload.name);
    if (idx >= 0) members[idx] = body.payload;
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

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
