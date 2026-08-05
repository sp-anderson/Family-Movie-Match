import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/adminAuth";
import { redis as kv } from "../../../../lib/redis";

// POST /api/admin/movie-night  body: { code, action: "extend" | "expire" }
export async function POST(request) {
  const { authorized } = await requireAdmin();
  if (!authorized) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  const body = await request.json();
  const code = (body.code || "").trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const meta = await kv.get(`room:${code}:meta`);
  if (!meta) return NextResponse.json({ error: "no Movie Night found with that code" }, { status: 404 });

  if (body.action === "extend") {
    meta.expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await kv.set(`room:${code}:meta`, meta);
    return NextResponse.json({ meta });
  }

  if (body.action === "expire") {
    meta.expiresAt = Date.now() - 1;
    await kv.set(`room:${code}:meta`, meta);
    return NextResponse.json({ meta });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
