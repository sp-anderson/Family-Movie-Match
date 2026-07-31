import { NextResponse } from "next/server";
import { redis as kv } from "../../../lib/redis";
import { sendEmail } from "../../../lib/email";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/consent?token=X  -> status info for the approval page
// GET /api/consent?childEmail=X -> look up a pending/approved record without a token (for the Family tab)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const childEmail = searchParams.get("childEmail");
  let actualToken = token;
  if (!actualToken && childEmail) {
    actualToken = await kv.get(`consent-by-child:${childEmail}`);
  }
  if (!actualToken) return NextResponse.json({ error: "token or childEmail required" }, { status: 400 });
  const record = await kv.get(`consent:${actualToken}`);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ record, token: actualToken });
}

// POST /api/consent
//   action "request": { childEmail, childName, childGroup, parentEmail }
//   action "approve": { token, maxRating }
export async function POST(request) {
  const body = await request.json();

  if (body.action === "request") {
    const { childEmail, childName, childGroup, parentEmail } = body;
    if (!childEmail || !parentEmail) {
      return NextResponse.json({ error: "childEmail and parentEmail required" }, { status: 400 });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const record = {
      childEmail,
      childName: childName || "Your child",
      childGroup: childGroup || null,
      parentEmail,
      status: "pending",
      createdAt: Date.now(),
    };
    await kv.set(`consent:${token}`, record);
    // also index by child email so the app can look up status without
    // needing to hold onto the token client-side
    await kv.set(`consent-by-child:${childEmail}`, token);

    const origin = request.headers.get("origin") || "";
    const link = `${origin}/consent/approve?token=${token}`;
    const result = await sendEmail({
      to: parentEmail,
      subject: `${record.childName} wants to join Family Movie Match`,
      html: `
        <p><strong>${record.childName}</strong> (${childEmail}) has started signing up for Family Movie Match and listed you as their parent/guardian.</p>
        <p>Until you approve, their account is limited to G-rated titles only — they can't be shown anything more mature, and no additional personal information is collected from them beyond what you see here.</p>
        <p><a href="${link}">Review and approve their account</a></p>
        <p>You'll be able to set exactly which content rating (G, PG, PG-13, R, or NC-17) they're allowed to see.</p>
        <p>If you don't recognize this request, you can simply ignore this email — nothing further happens without your approval.</p>
      `,
    });
    if (!result.ok) {
      return NextResponse.json({ error: "Couldn't send the consent email. Try again in a moment." }, { status: 500 });
    }
    return NextResponse.json({ sent: true, token });
  }

  if (body.action === "approve") {
    const { token, maxRating } = body;
    if (!token || !maxRating) return NextResponse.json({ error: "token and maxRating required" }, { status: 400 });
    const record = await kv.get(`consent:${token}`);
    if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
    const alreadyApproved = record.status === "approved";

    record.status = "approved";
    record.approvedAt = record.approvedAt || Date.now();
    record.approvedRating = maxRating;
    await kv.set(`consent:${token}`, record);

    // update the child's own profile — this is what the app checks to
    // determine whether they're still in the G-rated pending state.
    // Always do this, even if the record was already marked approved —
    // that catches records approved before this sync step existed.
    const childProfile = (await kv.get(`user:${record.childEmail}:profile`)) || {};
    childProfile.consentStatus = "approved";
    childProfile.approvedRating = maxRating;
    await kv.set(`user:${record.childEmail}:profile`, childProfile);

    // sync the child's family member record too, reusing the existing
    // parent/child rating-restriction system already in the app.
    // Use the child's CURRENT group, not the one captured back when the
    // request was first sent — that's almost always null, since a kid
    // usually hasn't joined a family yet at that point in the signup flow.
    const currentGroup = childProfile.group || record.childGroup;
    if (currentGroup) {
      const members = (await kv.get(`group:${currentGroup}:members`)) || [];
      const idx = members.findIndex((m) => m.email === record.childEmail);
      if (idx >= 0) {
        members[idx] = { ...members[idx], role: "child", maxRating };
        await kv.set(`group:${currentGroup}:members`, members);
      }
    }

    // confirmatory follow-up email to the parent — this is the "plus" in
    // the FTC's "email plus" verifiable-consent method. Only send it once.
    if (!alreadyApproved) {
      await sendEmail({
        to: record.parentEmail,
        subject: `Confirmed: you approved ${record.childName}'s account`,
        html: `
          <p>This confirms you approved <strong>${record.childName}</strong>'s (${record.childEmail}) account on Family Movie Match, with content limited to <strong>${maxRating}</strong> and under.</p>
          <p>You can change this limit any time from the Family tab in the app if you also sign in as a parent on the same family.</p>
          <p>If you did not do this, please contact us.</p>
        `,
      });
    }

    return NextResponse.json({ record });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
