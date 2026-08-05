import { redis as kv } from "./redis";

// Call this from wherever a real revenue-generating event actually happens
// once any monetization feature goes live — an affiliate conversion
// webhook, a subscription payment webhook, an ad network's revenue report,
// etc. Nothing currently calls this; it's infrastructure for when
// something does, so the admin panel doesn't need rework later.
//
// type: a short label for what kind of event this was, e.g.
//   "affiliate-rent-buy", "affiliate-ticket", "subscription-payment", "ad-revenue-share"
// amountCents: the amount in cents (avoids floating-point money bugs)
// source: optional freeform detail, e.g. the retailer or provider name
export async function logRevenueEvent(email, { type, amountCents, source, metadata }) {
  if (!email || !type || typeof amountCents !== "number") return null;
  const events = (await kv.get(`user:${email}:revenueEvents`)) || [];
  events.push({ type, amountCents, source: source || null, metadata: metadata || null, at: Date.now() });
  await kv.set(`user:${email}:revenueEvents`, events);
  return events;
}

export async function getRevenueSummary(email) {
  const events = (await kv.get(`user:${email}:revenueEvents`)) || [];
  const totalCents = events.reduce((sum, e) => sum + (e.amountCents || 0), 0);
  return { totalCents, events };
}
