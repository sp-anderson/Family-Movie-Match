import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";

// Verifies the actual signed-in session (not anything the client claims)
// against an admin allowlist. Every admin route must call this first —
// unlike the rest of the app, which trusts a client-provided email param,
// this surface can modify or delete any account, so it needs real
// server-side identity verification, not just a client-side gate.
export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !admins.includes(email.toLowerCase())) {
    return { authorized: false, adminEmail: null };
  }
  return { authorized: true, adminEmail: email };
}
