import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

// POST /api/admin/family-member  body: { code, email, action: "unblock" | "remove" | "cleanup-orphan" }
//   unblock: removes them from that family's blocklist
//   remove: removes them from that family's member list (account/profile untouched)
//   cleanup-orphan: removes a local profile ID from a parent's own managedLocalProfiles list
//     (parentEmail required for this one instead of code)
export async function POST(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const body = await request.json();

  if (body.action === "unblock") {
    const code = (body.code || "").trim().toUpperCase();
    const email = (body.email || "").trim().toLowerCase();
    if (!code || !email) return NextResponse.json({ error: "code and email required" }, { status: 400 });
    const blocked = (await kv.get(`group:${code}:blocked`)) || [];
    const next = blocked.filter((e) => e !== email);
    await kv.set(`group:${code}:blocked`, next);
    return NextResponse.json({ blocked: next });
  }

  if (body.action === "remove") {
    const code = (body.code || "").trim().toUpperCase();
    const email = (body.email || "").trim().toLowerCase();
    if (!code || !email) return NextResponse.json({ error: "code and email required" }, { status: 400 });
    const members = (await kv.get(`group:${code}:members`)) || [];
    const next = members.filter((m) => m.email !== email);
    await kv.set(`group:${code}:members`, next);
    return NextResponse.json({ members: next });
  }

  if (body.action === "cleanup-orphan") {
    const parentEmail = (body.parentEmail || "").trim().toLowerCase();
    const profileId = body.profileId;
    if (!parentEmail || !profileId) return NextResponse.json({ error: "parentEmail and profileId required" }, { status: 400 });
    const parentProfile = await kv.get(`user:${parentEmail}:profile`);
    if (!parentProfile) return NextResponse.json({ error: "no profile found for that parent email" }, { status: 404 });
    const next = (parentProfile.managedLocalProfiles || []).filter((p) => p.id !== profileId);
    parentProfile.managedLocalProfiles = next;
    await kv.set(`user:${parentEmail}:profile`, parentProfile);
    return NextResponse.json({ managedLocalProfiles: next });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
