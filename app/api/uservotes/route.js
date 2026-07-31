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

// POST /api/uservotes  body: { email, movieId, choice }
// choice: null explicitly removes the vote (used by undo, to revert a movie
// back to "never voted on" rather than just switching to a different value)
// This is now the ONLY place a vote gets written — a vote belongs to the
// person, not to whatever room they happened to be in when they cast it.
export async function POST(request) {
  const body = await request.json();
  if (!body.email || !body.movieId || !("choice" in body)) {
    return NextResponse.json({ error: "email, movieId, and choice required" }, { status: 400 });
  }
  const votes = (await kv.get(`user:${body.email}:votes`)) || {};
  if (body.choice === null) {
    delete votes[body.movieId];
  } else {
    votes[body.movieId] = body.choice;
  }
  await kv.set(`user:${body.email}:votes`, votes);
  return NextResponse.json({ votes });
}
