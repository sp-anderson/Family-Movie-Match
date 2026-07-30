// Minimal Resend wrapper — no SDK needed, it's a plain REST call.
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL env vars.
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Family Movie Match <onboarding@resend.dev>";
  if (!key) {
    console.error("RESEND_API_KEY is not set — email not sent:", { to, subject });
    return { ok: false, error: "RESEND_API_KEY not set" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend send failed:", detail);
    return { ok: false, error: detail };
  }
  return { ok: true };
}
