import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/profile?email=you@gmail.com
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const profile = await kv.get(`user:${email}:profile`);
  return NextResponse.json({ profile: profile || null }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

// POST /api/profile  body: { email, profile: { group, services, genres, favorites } }
export async function POST(request) {
  const body = await request.json();
  if (!body.email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await kv.set(`user:${body.email}:profile`, body.profile);
  return NextResponse.json({ ok: true });
}
