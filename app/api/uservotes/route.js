import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";

// GET /api/uservotes?email=you@gmail.com -> { votes: { movieId: "yes"|"no"|"seen" } }
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  const votes = await kv.get(`user:${email}:votes`);
  return NextResponse.json({ votes: votes || {} });
}
