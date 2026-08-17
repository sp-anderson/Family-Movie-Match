"use client";
import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";

// TMDB's full movie genre list — deliberately NOT the same restricted
// subset the main app's UI uses. A user's rated movies can carry genre
// tags outside what the app's own genre picker offers (History, on movie
// 36, is a real example), and this is a diagnostic tool — it should be
// able to name anything TMDB itself would name, not just what's in the
// app's curated list.
const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
];
function genreName(id) {
  return GENRES.find((g) => g.id === id)?.name || `Genre ${id}`;
}
const LANGUAGES = { en: "English", es: "Spanish", fr: "French", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean", zh: "Chinese", hi: "Hindi", ru: "Russian", ar: "Arabic", tr: "Turkish", sv: "Swedish", da: "Danish", no: "Norwegian", pl: "Polish", nl: "Dutch", th: "Thai", vi: "Vietnamese", id: "Indonesian", he: "Hebrew", el: "Greek" };
function languageName(code) {
  return LANGUAGES[code] || code;
}

function Section({ title, children }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4">
      <h2 className="text-sm font-bold text-amber-500 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  );
}

function ActionButton({ onClick, children, busy, danger }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={
        "text-xs font-bold px-3 py-1.5 rounded-lg border disabled:opacity-50 " +
        (danger ? "border-orange-700 text-orange-400 hover:bg-orange-950" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800")
      }
    >
      {busy ? "…" : children}
    </button>
  );
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [authorized, setAuthorized] = useState(null); // null = checking
  const [userQuery, setUserQuery] = useState("");
  const [familyQuery, setFamilyQuery] = useState("");
  const [userResult, setUserResult] = useState(null);
  const [familyResult, setFamilyResult] = useState(null);
  const [backfillResults, setBackfillResults] = useState(null);
  const [viewAsResult, setViewAsResult] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/check")
      .then((r) => r.json())
      .then((d) => setAuthorized(!!d.authorized))
      .catch(() => setAuthorized(false));
  }, [status]);

  async function lookupUser() {
    setMessage("");
    setViewAsResult(null);
    const res = await fetch(`/api/admin/lookup-user?email=${encodeURIComponent(userQuery.trim())}`);
    const data = await res.json();
    setUserResult(data.found ? data : { found: false });
  }

  async function lookupFamily() {
    setMessage("");
    setBackfillResults(null);
    const res = await fetch(`/api/admin/lookup-family?code=${encodeURIComponent(familyQuery.trim())}`);
    const data = await res.json();
    setFamilyResult(data.found ? data : { found: false });
  }

  async function loadViewAs(email) {
    setBusyAction("view-as");
    const res = await fetch(`/api/admin/view-as?email=${encodeURIComponent(email)}`);
    const data = await res.json();
    setViewAsResult(data.found ? data : { found: false });
    setBusyAction(null);
  }

  async function runAction(key, url, body, onDone) {
    setBusyAction(key);
    setMessage("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error || "something went wrong"}`);
      } else {
        setMessage("Done.");
        if (onDone) onDone(data);
      }
    } catch {
      setMessage("Error: request failed.");
    }
    setBusyAction(null);
  }

  if (status === "loading" || authorized === null) {
    return <div className="min-h-screen bg-black text-neutral-400 flex items-center justify-center text-sm">Loading…</div>;
  }
  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-black text-neutral-200 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-neutral-400">Sign in to continue.</p>
        <button onClick={() => signIn()} className="text-xs font-bold px-4 py-2 rounded-lg bg-amber-500 text-black">Sign in</button>
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-neutral-200 flex items-center justify-center">
        <p className="text-sm text-neutral-400">Signed in as {session.user.email} — not authorized for admin access.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-neutral-200 p-6 max-w-3xl mx-auto">
      <h1 className="text-lg font-bold text-amber-500 mb-1">Family Movie Match — Admin</h1>
      <p className="text-xs text-neutral-500 mb-6">Signed in as {session.user.email}</p>

      {message && <div className="text-xs font-bold text-amber-400 mb-4">{message}</div>}

      <Section title="Look up a user">
        <div className="flex gap-2 mb-3">
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupUser()}
            placeholder="user@email.com"
            className="flex-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm outline-none focus:border-amber-500"
          />
          <ActionButton onClick={lookupUser}>Search</ActionButton>
        </div>

        {userResult && !userResult.found && <p className="text-xs text-neutral-500">No profile found for that email.</p>}

        {userResult?.found && (
          <div className="space-y-3">
            <div className="text-xs text-neutral-400">
              <div>DOB: {userResult.profile.dob || "—"} {userResult.profile.isMinor && "(minor)"}</div>
              <div>Consent status: {userResult.profile.consentStatus || "—"} {userResult.profile.approvedRating && `(${userResult.profile.approvedRating})`}</div>
              <div>Local profile: {userResult.profile.isLocalProfile ? "yes" : "no"}</div>
              <div>Votes: {userResult.voteCount} · Ratings: {userResult.ratingCount}</div>
              <div>Revenue tracked: ${(userResult.revenue.totalCents / 100).toFixed(2)} {userResult.revenue.events.length === 0 && "(no revenue-generating features live yet)"}</div>
              {userResult.profile.deletionScheduledFor && (
                <div className="text-orange-400">Deletion scheduled for {new Date(userResult.profile.deletionScheduledFor).toLocaleDateString()}</div>
              )}
            </div>

            {userResult.revenue.events.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Revenue events</div>
                {userResult.revenue.events
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((e, i) => (
                    <div key={i} className="text-xs text-neutral-300 mb-1">
                      ${(e.amountCents / 100).toFixed(2)} — {e.type} {e.source && `(${e.source})`} — {new Date(e.at).toLocaleDateString()}
                    </div>
                  ))}
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Families</div>
              {userResult.familyMemberships.map((f) => (
                <div key={f.code} className="text-xs text-neutral-300 mb-1">
                  {f.nickname || f.code} ({f.code}) — {f.role || "no role"}, cap: {f.maxRating || "none"} {f.isLocalProfile && "· local profile"}
                </div>
              ))}
            </div>

            {userResult.managedLocalProfiles.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Manages these local profiles</div>
                {userResult.managedLocalProfiles.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-xs text-neutral-300 mb-1">
                    <span>{p.name} ({p.id})</span>
                    <ActionButton
                      busy={busyAction === `orphan-${p.id}`}
                      onClick={() =>
                        runAction(`orphan-${p.id}`, "/api/admin/family-member", { action: "cleanup-orphan", parentEmail: userQuery.trim(), profileId: p.id }, () => lookupUser())
                      }
                    >
                      Remove from this list
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}

            {userResult.consentRecord && (
              <div className="text-xs text-neutral-400">
                Consent record: {userResult.consentRecord.status}, approved rating: {userResult.consentRecord.approvedRating || "—"}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
              <ActionButton busy={busyAction === "resync"} onClick={() => runAction("resync", "/api/admin/resync-consent", { email: userQuery.trim() }, () => lookupUser())}>
                Re-sync consent
              </ActionButton>
              {userResult.profile.deletionScheduledFor ? (
                <ActionButton busy={busyAction === "cancel-del"} onClick={() => runAction("cancel-del", "/api/admin/deletion", { email: userQuery.trim(), action: "cancel" }, () => lookupUser())}>
                  Cancel scheduled deletion
                </ActionButton>
              ) : (
                <ActionButton danger busy={busyAction === "sched-del"} onClick={() => runAction("sched-del", "/api/admin/deletion", { email: userQuery.trim(), action: "schedule" }, () => lookupUser())}>
                  Schedule deletion (30 days)
                </ActionButton>
              )}
              <ActionButton busy={busyAction === "view-as"} onClick={() => loadViewAs(userQuery.trim())}>
                View diagnostic data
              </ActionButton>
            </div>

            {viewAsResult?.found && (
              <div className="pt-3 border-t border-neutral-800 text-xs text-neutral-300 space-y-1">
                <div className="font-bold text-neutral-400 uppercase text-[11px] mb-1">Diagnostic snapshot</div>
                <div>Personalization active: {viewAsResult.personalizationActive ? "yes" : `no (needs 5+ ratings, has ${viewAsResult.totalRatings})`}</div>
                <div>Votes — yes: {viewAsResult.voteBreakdown.yes}, no: {viewAsResult.voteBreakdown.no}, seen: {viewAsResult.voteBreakdown.seen}</div>
                <div>Genres they respond to best: {viewAsResult.topGenreAffinities.map((g) => `${genreName(g.genreId)} (${g.score})`).join(", ") || "none yet"}</div>
                <div>Genres they respond to worst: {viewAsResult.bottomGenreAffinities.map((g) => `${genreName(g.genreId)} (${g.score})`).join(", ") || "none yet"}</div>
                <div>Languages they respond to best: {viewAsResult.topLanguageAffinities.map((l) => `${languageName(l.code)} (${l.score})`).join(", ") || "none yet"}</div>
                <div>Languages they respond to worst: {viewAsResult.bottomLanguageAffinities.map((l) => `${languageName(l.code)} (${l.score})`).join(", ") || "none yet"}</div>
                <div className="mt-2 pt-2 border-t border-neutral-800">
                  <div className="font-bold text-neutral-500 uppercase text-[10px] mb-1">Cast, director, writer, keyword (weighted)</div>
                  <div>Directors: {viewAsResult.directorAffinities.top.map((d) => `${d.name} (${d.score})`).join(", ") || "none yet"}</div>
                  <div>Writers: {viewAsResult.writerAffinities.top.map((w) => `${w.name} (${w.score})`).join(", ") || "none yet"}</div>
                  <div>Cast: {viewAsResult.castAffinities.top.map((c) => `${c.name} (${c.score})`).join(", ") || "none yet"}</div>
                  <div>Keywords they like: {viewAsResult.keywordAffinities.top.map((k) => `${k.name} (${k.score})`).join(", ") || "none yet"}</div>
                  <div>Keywords they avoid: {viewAsResult.keywordAffinities.bottom.map((k) => `${k.name} (${k.score})`).join(", ") || "none yet"}</div>
                </div>
                <div>Excludes — genres: {viewAsResult.settings.excludedGenres.join(", ") || "none"}; keywords: {viewAsResult.settings.excludedKeywords.map((k) => k.name).join(", ") || "none"}</div>
                <div>Allowed languages: {viewAsResult.settings.allowedLanguages.map(languageName).join(", ") || "no restriction"}</div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Look up a family or Movie Night">
        <div className="flex gap-2 mb-3">
          <input
            value={familyQuery}
            onChange={(e) => setFamilyQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupFamily()}
            placeholder="CODE"
            className="flex-1 px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-sm outline-none focus:border-amber-500"
          />
          <ActionButton onClick={lookupFamily}>Search</ActionButton>
        </div>

        {familyResult && !familyResult.found && <p className="text-xs text-neutral-500">No family or Movie Night found with that code.</p>}

        {familyResult?.found && (
          <div className="space-y-3">
            {familyResult.roomMeta?.type === "movie-night" && (
              <div className="text-xs text-neutral-400">
                Movie Night — expires {new Date(familyResult.roomMeta.expiresAt).toLocaleString()}
                <div className="flex gap-2 mt-2">
                  <ActionButton busy={busyAction === "extend"} onClick={() => runAction("extend", "/api/admin/movie-night", { code: familyQuery.trim(), action: "extend" }, () => lookupFamily())}>
                    Extend 7 days
                  </ActionButton>
                  <ActionButton danger busy={busyAction === "expire"} onClick={() => runAction("expire", "/api/admin/movie-night", { code: familyQuery.trim(), action: "expire" }, () => lookupFamily())}>
                    Expire now
                  </ActionButton>
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Members ({familyResult.members.length})</div>
              {familyResult.members.map((m) => (
                <div key={m.email} className="flex items-center gap-2 text-xs text-neutral-300 mb-1 flex-wrap">
                  <span>{m.name} ({m.email}) — {m.role}, cap: {m.maxRating || "none"} {m.isLocalProfile && "· local profile"}</span>
                  <ActionButton
                    busy={busyAction === `remove-${m.email}`}
                    onClick={() => runAction(`remove-${m.email}`, "/api/admin/family-member", { action: "remove", code: familyQuery.trim(), email: m.email }, () => lookupFamily())}
                  >
                    Remove
                  </ActionButton>
                </div>
              ))}
            </div>

            {familyResult.blocked.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-neutral-500 uppercase mb-1">Blocked</div>
                {familyResult.blocked.map((e) => (
                  <div key={e} className="flex items-center gap-2 text-xs text-neutral-300 mb-1">
                    <span>{e}</span>
                    <ActionButton
                      busy={busyAction === `unblock-${e}`}
                      onClick={() => runAction(`unblock-${e}`, "/api/admin/family-member", { action: "unblock", code: familyQuery.trim(), email: e }, () => lookupFamily())}
                    >
                      Unblock
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}

            {familyResult.poolSummary && (
              <div className="text-xs text-neutral-500 mb-2">
                Pool: {familyResult.poolSummary.movieCount} movies, last fetched {new Date(familyResult.poolSummary.fetchedAt).toLocaleString()}
              </div>
            )}

            <ActionButton
              busy={busyAction === "backfill"}
              onClick={() =>
                runAction("backfill", "/api/admin/backfill-movie-cache", { code: familyQuery.trim() }, (data) => setBackfillResults(data.results))
              }
            >
              One-time: backfill movie cache for this family's members
            </ActionButton>
            {backfillResults && (
              <div className="mt-2 text-xs text-neutral-400 space-y-1">
                {Object.entries(backfillResults).map(([email, r]) => (
                  <div key={email}>
                    {email}: {r.error ? `error — ${r.error}` : `${r.added} added, ${r.unresolvable} couldn't be resolved (of ${r.totalVotedOrRated} voted/rated)`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
