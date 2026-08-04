import { NextResponse } from "next/server";
import { sendEmail } from "../../../lib/email";

// POST /api/invite  body: { toEmail, familyCode, familyNickname, inviterName }
export async function POST(request) {
  const body = await request.json();
  const { toEmail, familyCode, familyNickname, inviterName } = body;
  if (!toEmail || !familyCode) {
    return NextResponse.json({ error: "toEmail and familyCode required" }, { status: 400 });
  }

  const origin = request.headers.get("origin") || "";
  const link = `${origin}/?joinCode=${encodeURIComponent(familyCode)}`;
  const label = familyNickname || "their family";

  const result = await sendEmail({
    to: toEmail,
    subject: `${inviterName || "Someone"} invited you to ${label} on Family Movie Match`,
    html: `
      <p><strong>${inviterName || "Someone"}</strong> invited you to join <strong>${label}</strong> on Family Movie Match — swipe together and find something everyone actually wants to watch.</p>
      <p><a href="${link}">Join here</a></p>
      <p>Or sign in and enter this code yourself: <strong>${familyCode}</strong></p>
    `,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't send the invite email. Try again in a moment." }, { status: 500 });
  }
  return NextResponse.json({ sent: true });
}
