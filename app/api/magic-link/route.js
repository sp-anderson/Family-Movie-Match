import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";
import { sendEmail } from "../../../lib/email";
import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

// POST /api/magic-link  body: { email }
export async function POST(request) {
  const body = await request.json();
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await kv.set(`magiclink:${token}`, { email, expiresAt: Date.now() + TOKEN_TTL_MS });

  const origin = request.headers.get("origin") || "";
  const link = `${origin}/auth/verify?token=${token}`;

  const result = await sendEmail({
    to: email,
    subject: "Sign in to Family Movie Match",
    html: `
      <p>Click below to sign in — this link works for 15 minutes and can only be used once.</p>
      <p><a href="${link}">Sign in to Family Movie Match</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't send the sign-in email. Try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ sent: true });
}
