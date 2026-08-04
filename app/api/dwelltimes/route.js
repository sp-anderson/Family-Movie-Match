import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/dwelltimes?email=you@gmail.com -> { dwellTimes: { movieId: ms } }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const dwellTimes = await kv.get(`user:${email}:dwellTimes`);
  return NextResponse.json({ dwellTimes: dwellTimes || {} });
}

// POST /api/dwelltimes  body: { email, movieId, dwellMs }
export async function POST(request) {
  const body = await request.json();
  const { email, movieId, dwellMs } = body;
  if (!email || !movieId || typeof dwellMs !== "number") {
    return NextResponse.json({ error: "email, movieId, and dwellMs required" }, { status: 400 });
  }
  const dwellTimes = (await kv.get(`user:${email}:dwellTimes`)) || {};
  dwellTimes[movieId] = dwellMs;
  await kv.set(`user:${email}:dwellTimes`, dwellTimes);
  return NextResponse.json({ dwellTimes });
}
