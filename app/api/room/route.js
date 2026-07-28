import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// GET /api/room?code=ABCDE -> { meta: {...} | null }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const meta = await kv.get(`room:${code}:meta`);
  return NextResponse.json({ meta: meta || null });
}

// POST /api/room  body: { code, action: "create" | "convert", email }
export async function POST(request) {
  const body = await request.json();
  const code = (body.code || "").toUpperCase();
  if (!code || !body.action) return NextResponse.json({ error: "code and action required" }, { status: 400 });

  if (body.action === "create") {
    const existing = await kv.get(`room:${code}:meta`);
    if (existing) return NextResponse.json({ meta: existing });
    const meta = {
      type: "movie-night",
      createdBy: body.email || null,
      createdAt: Date.now(),
      expiresAt: Date.now() + WEEK_MS,
    };
    await kv.set(`room:${code}:meta`, meta);
    return NextResponse.json({ meta });
  }

  if (body.action === "convert") {
    const meta = (await kv.get(`room:${code}:meta`)) || { createdAt: Date.now(), createdBy: body.email || null };
    meta.type = "family";
    meta.expiresAt = null;
    await kv.set(`room:${code}:meta`, meta);
    return NextResponse.json({ meta });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
