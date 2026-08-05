import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";
import { sendEmail } from "../../../lib/email";
import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;

// POST /api/merge  body: { localProfileId, localProfileName, toEmail }
// toEmail must be an EXISTING account — this is the opposite check from
// graduation, which required a brand-new one.
export async function POST(request) {
  const body = await request.json();
  const localProfileId = body.localProfileId;
  const localProfileName = body.localProfileName || "this profile";
  const toEmail = (body.toEmail || "").trim().toLowerCase();

  if (!localProfileId || !toEmail || !toEmail.includes("@")) {
    return NextResponse.json({ error: "localProfileId and a valid toEmail are required" }, { status: 400 });
  }

  const existing = await kv.get(`user:${toEmail}:profile`);
  if (!existing) {
    return NextResponse.json({ error: "That email doesn't have an account yet — use \"Graduate\" instead if it's brand new." }, { status: 400 });
  }
  if (existing.isLocalProfile) {
    return NextResponse.json({ error: "That's a local profile itself, not a real account — can't merge into it." }, { status: 400 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  await kv.set(`magiclink:${token}`, { email: toEmail, expiresAt: Date.now() + TOKEN_TTL_MS });

  const origin = request.headers.get("origin") || "";
  const link = `${origin}/auth/verify?token=${token}&mergeFrom=${encodeURIComponent(localProfileId)}`;

  const result = await sendEmail({
    to: toEmail,
    subject: `Someone wants to merge ${localProfileName}'s profile into your Family Movie Match account`,
    html: `
      <p>A family member is asking to merge <strong>${localProfileName}</strong>'s local profile (votes, ratings, and family memberships) into <strong>your</strong> Family Movie Match account.</p>
      <p><a href="${link}">Review this request</a></p>
      <p>This link works for 15 minutes. Clicking it just signs you in and shows you exactly what would change — nothing merges automatically until you confirm it yourself. If you don't recognize this request, just ignore this email.</p>
    `,
  });

  if (!result.ok) {
    return NextResponse.json({ error: `Couldn't send the email: ${result.error || "unknown error"}` }, { status: 500 });
  }
  return NextResponse.json({ sent: true });
}
