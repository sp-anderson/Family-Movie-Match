import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import AppleProvider from "next-auth/providers/apple";
import CredentialsProvider from "next-auth/providers/credentials";
import { redis as kv } from "../../../../lib/redis";

const providers = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  // Passwordless magic-link sign-in. This isn't NextAuth's built-in Email
  // provider (that requires a database Adapter) — instead /api/magic-link
  // emails a one-time token, and this Credentials provider just checks
  // that token against Redis. No password, ever.
  CredentialsProvider({
    id: "email-link",
    name: "Email link",
    credentials: { token: { label: "Token", type: "text" } },
    async authorize(credentials) {
      const token = credentials?.token;
      if (!token) return null;
      const record = await kv.get(`magiclink:${token}`);
      if (!record || !record.email || record.expiresAt < Date.now()) return null;
      await kv.del(`magiclink:${token}`); // one-time use
      return { id: record.email, email: record.email };
    },
  }),
];

// Apple Sign-In is optional and only registered once real credentials are
// set — see MANUAL_SETUP.md for how to generate APPLE_CLIENT_ID/SECRET.
if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
  providers.push(
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    })
  );
}

const handler = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/", // our own sign-in screen handles all three methods
  },
  callbacks: {
    // keep the session light — just what the UI needs
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
