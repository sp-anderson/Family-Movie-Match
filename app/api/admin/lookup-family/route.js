import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

export async function GET(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const [members, blocked, pool, roomMeta] = await Promise.all([
    kv.get(`group:${code}:members`),
    kv.get(`group:${code}:blocked`),
    kv.get(`group:${code}:pool`),
    kv.get(`room:${code}:meta`),
  ]);

  if (!members && !roomMeta) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    members: members || [],
    blocked: blocked || [],
    roomMeta: roomMeta || null,
    poolSummary: pool ? { movieCount: pool.movies?.length || 0, fetchedAt: pool.fetchedAt, region: pool.region } : null,
  });
}
