import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";
import { sendEmail } from "../../../lib/email";
import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes, same as regular magic-link sign-in

// POST /api/graduate  body: { localProfileId, localProfileName, toEmail }
export async function POST(request) {
  const body = await request.json();
  const localProfileId = body.localProfileId;
  const localProfileName = body.localProfileName || "this profile";
  const toEmail = (body.toEmail || "").trim().toLowerCase();

  if (!localProfileId || !toEmail || !toEmail.includes("@")) {
    return NextResponse.json({ error: "localProfileId and a valid toEmail are required" }, { status: 400 });
  }

  const existing = await kv.get(`user:${toEmail}:profile`);
  if (existing) {
    return NextResponse.json({ error: "That email already has an account — graduation needs a brand-new email address." }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await kv.set(`magiclink:${token}`, { email: toEmail, expiresAt: Date.now() + TOKEN_TTL_MS });

  const origin = request.headers.get("origin") || "";
  const link = `${origin}/auth/verify?token=${token}&graduateFrom=${encodeURIComponent(localProfileId)}`;

  const result = await sendEmail({
    to: toEmail,
    subject: `Set up ${localProfileName}'s own account on Family Movie Match`,
    html: `
      <p>Click below to finish setting up <strong>${localProfileName}</strong>'s own account on Family Movie Match — this link works for 15 minutes and can only be used once.</p>
      <p><a href="${link}">Set up the account</a></p>
      <p>Everything already saved — votes, ratings, family membership — moves over automatically. If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Couldn't send the email: ${result.error || "unknown error"}` }, { status: 500 });
  }
  return NextResponse.json({ sent: true });
}
