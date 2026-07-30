"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Heart, X, Users, Settings, Play, Sparkles, Film, LogOut, RefreshCw, Star, Ticket, Eye, Clock, Compass, Bookmark } from "lucide-react";

const SERVICES = [
  { id: 8, name: "Netflix" },
  { id: 9, name: "Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 350, name: "Apple TV+" },
  { id: 230, name: "Crave" },
  { id: 283, name: "Crunchyroll" },
  { id: 531, name: "Paramount+" },
  { id: 1899, name: "HBO Max" },
  { id: 15, name: "Hulu" },
  { id: 386, name: "Peacock" },
];

// TMDB's provider names come from JustWatch and can lag behind real-world
// rebrands — override known-stale ones rather than showing outdated names.
const PROVIDER_NAME_OVERRIDES = {
  1899: "HBO Max", // TMDB still serves "Max"; WBD reverted to "HBO Max" in July 2025
};
function providerDisplayName(id, fallbackName) {
  return PROVIDER_NAME_OVERRIDES[id] || fallbackName;
}

const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];
function ratingRank(cert) {
  const i = RATINGS.indexOf(cert);
  return i === -1 ? 99 : i; // unknown/unrated certifications rank as most restrictive
}

const GENRES = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 18, name: "Drama" },
  { id: 14, name: "Fantasy" },
  { id: 27, name: "Horror" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 10751, name: "Family" },
];

const AVATAR_COLORS = ["bg-cinema-gold", "bg-cinema-orange", "bg-cinema-green", "bg-sky-400", "bg-violet-400", "bg-orange-400"];
function avatarColor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function genreNames(ids) {
  return (ids || []).map((id) => GENRES.find((g) => g.id === id)?.name).filter(Boolean).slice(0, 3);
}

function isNewRelease(dateStr) {
  if (!dateStr) return false;
  const days = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= 90;
}

function NewBadge() {
  return (
    <span className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cinema-gold text-cinema-ink shadow">
      NEW
    </span>
  );
}

function TheaterBadge() {
  return (
    <span className="absolute top-2 right-2 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cinema-orange text-cinema-ink shadow">
      IN THEATERS
    </span>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-colors " +
        (active
          ? "bg-cinema-gold border-cinema-gold text-cinema-ink"
          : "bg-transparent border-cinema-border text-cinema-mutedLight hover:border-cinema-gold/60")
      }
    >
      {children}
    </button>
  );
}

function ProviderRow({ movieId, region, inTheaters }) {
  const [providers, setProviders] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/providers?movieId=${movieId}&region=${region || "CA"}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setProviders(d.providers || []))
      .catch(() => !cancelled && setProviders([]));
    return () => (cancelled = true);
  }, [movieId, region]);

  if (providers === null) return <div className="text-[11px] text-cinema-mutedDark mt-1">Checking where to watch…</div>;
  if (providers.length === 0) {
    if (inTheaters) return <div className="text-[11px] text-cinema-orange font-bold mt-1">🎬 Now playing in theaters</div>;
    return <div className="text-[11px] text-cinema-mutedDark mt-1">Not currently on any of your services.</div>;
  }
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {inTheaters && <span className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-orange/20 text-cinema-orange font-bold">🎬 In theaters</span>}
      {providers.map((p) => (
        <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-green/20 text-cinema-green font-bold">
          {p.name}
        </span>
      ))}
    </div>
  );
}

function FilterSortBar({ sort, setSort, genreFilter, setGenreFilter, castQuery, setCastQuery, sortOptions, availabilityFilter, setAvailabilityFilter }) {
  function toggleGenre(id) {
    setGenreFilter(genreFilter.includes(id) ? genreFilter.filter((g) => g !== id) : [...genreFilter, id]);
  }
  function toggleAvailability(key) {
    setAvailabilityFilter(availabilityFilter.includes(key) ? availabilityFilter.filter((k) => k !== key) : [...availabilityFilter, key]);
  }
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-[11px] font-bold text-cinema-muted uppercase tracking-wide">Sort:</span>
        <select
          value={sort.key}
          onChange={(e) => setSort({ ...sort, key: e.target.value })}
          className="text-xs font-bold px-2 py-1 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50"
        >
          <option value="">Default</option>
          {sortOptions.includes("year") && <option value="year">Release year</option>}
          {sortOptions.includes("score") && <option value="score">User score</option>}
          {sortOptions.includes("title") && <option value="title">Title A-Z</option>}
        </select>
        {sort.key && (
          <button
            onClick={() => setSort({ ...sort, dir: sort.dir === "asc" ? "desc" : "asc" })}
            className="text-xs font-bold px-2 py-1 rounded-lg bg-cinema-panel border border-cinema-border text-cinema-mutedLight"
          >
            {sort.dir === "asc" ? "↑ Low to high" : "↓ High to low"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => toggleAvailability("theaters")}
          className={
            "text-[10px] font-bold px-2 py-1 rounded-full border " +
            (availabilityFilter.includes("theaters") ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "border-cinema-border text-cinema-muted hover:border-cinema-gold")
          }
        >
          In Theaters
        </button>
        <button
          onClick={() => toggleAvailability("streaming")}
          className={
            "text-[10px] font-bold px-2 py-1 rounded-full border " +
            (availabilityFilter.includes("streaming") ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "border-cinema-border text-cinema-muted hover:border-cinema-gold")
          }
        >
          Streaming
        </button>
      </div>
      <input
        value={castQuery}
        onChange={(e) => setCastQuery(e.target.value)}
        placeholder="Filter by cast member…"
        className="w-full px-3 py-1.5 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 text-sm outline-none focus:border-cinema-gold"
      />
      <div className="flex flex-wrap gap-1.5">
        {GENRES.map((g) => (
          <button
            key={g.id}
            onClick={() => toggleGenre(g.id)}
            className={
              "text-[10px] font-bold px-2 py-1 rounded-full border " +
              (genreFilter.includes(g.id) ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "border-cinema-border text-cinema-muted hover:border-cinema-gold")
            }
          >
            {g.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function VoteSwitcher({ current, onSet }) {
  const options = [
    { key: "yes", label: "Change to yes", hoverClass: "hover:border-cinema-green hover:text-cinema-green" },
    { key: "no", label: "Change to no", hoverClass: "hover:border-cinema-orange hover:text-cinema-orange" },
    { key: "seen", label: "Mark as seen", hoverClass: "hover:border-cinema-gold hover:text-cinema-gold" },
  ].filter((o) => o.key !== current);
  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onSet(o.key)}
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border border-cinema-border text-cinema-muted ${o.hoverClass}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full bg-cinema-gold text-cinema-ink font-extrabold text-sm shadow-xl hover:bg-cinema-goldLight"
      aria-label="Back to top"
    >
      ↑ Top
    </button>
  );
}

function SpotlightControl({ movieId, spotlight, myEmail, onToggle, hideLabel }) {
  const recommenders = spotlight.filter((s) => s.movieId === movieId);
  const mine = recommenders.some((s) => s.byEmail === myEmail);
  return (
    <div className="mt-1">
      {!hideLabel && recommenders.length > 0 && (
        <div className="text-[11px] text-cinema-gold font-bold mb-1">
          📢 Recommended by {recommenders.map((r) => r.byName).join(", ")}
        </div>
      )}
      <button
        onClick={() => onToggle(movieId)}
        className={
          "text-[11px] font-bold px-2 py-0.5 rounded-full border " +
          (mine ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "bg-transparent text-cinema-muted border-cinema-border hover:border-cinema-gold")
        }
      >
        {mine ? "✓ Recommended to family" : "Recommend to family"}
      </button>
    </div>
  );
}

function DetailsRow({ movie, certifications, setCertifications }) {
  const [details, setDetails] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/details?movieId=${movie.id}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setDetails(d))
      .catch(() => !cancelled && setDetails({}));
    return () => (cancelled = true);
  }, [movie.id]);

  useEffect(() => {
    if (!setCertifications || certifications[movie.id] !== undefined) return;
    let cancelled = false;
    fetch(`/api/certification?movieId=${movie.id}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setCertifications((prev) => ({ ...prev, [movie.id]: d.certification || "" })))
      .catch(() => !cancelled && setCertifications((prev) => ({ ...prev, [movie.id]: "" })));
    return () => (cancelled = true);
    // eslint-disable-next-line
  }, [movie.id]);

  const rating = typeof movie.vote_average === "number" && movie.vote_average > 0 ? movie.vote_average.toFixed(1) : null;
  const year = movie.release_date ? movie.release_date.slice(0, 4) : null;
  const cert = certifications ? certifications[movie.id] : undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-bold text-cinema-mutedDark mt-1">
      {year && <span>{year}</span>}
      {cert ? (
        <span className="px-1.5 py-0.5 rounded border border-cinema-mutedDark text-cinema-mutedDark">{cert}</span>
      ) : null}
      {rating && (
        <span className="inline-flex items-center gap-1">
          <Star className="w-3 h-3 text-cinema-gold" fill="currentColor" /> {rating}/10
        </span>
      )}
      {details?.runtime ? <span>{details.runtime} min</span> : null}
      {details?.cast?.length ? <span>Starring {details.cast.join(", ")}</span> : null}
    </div>
  );
}

function TrailerButton({ movieId }) {
  const [key, setKey] = useState(undefined); // undefined = not fetched, null = none found
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trailer?movieId=${movieId}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setKey(d.key || null))
      .catch(() => !cancelled && setKey(null));
    return () => (cancelled = true);
  }, [movieId]);

  if (key === undefined) return null;
  if (key === null) return null;
  return (
    <a
      href={`https://www.youtube.com/watch?v=${key}`}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-cinema-orange hover:text-cinema-orangeLight"
    >
      <Play className="w-3.5 h-3.5" /> Watch trailer
    </a>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const bodyFont = { fontFamily: "'Karla', sans-serif" };
  const displayFont = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };

  const [profile, setProfile] = useState(null);
  const [members, setMembers] = useState([]);
  const [pool, setPool] = useState(null);
  const [votes, setVotes] = useState({});
  const [spotlight, setSpotlight] = useState([]);
  const [certifications, setCertifications] = useState({}); // movieId -> "PG-13" | "" (checked, none found)

  const [activeRoomCode, setActiveRoomCode] = useState(null); // which group/room the app is currently operating on
  const [roomMeta, setRoomMeta] = useState(null); // { type: "family"|"movie-night", createdAt, expiresAt, createdBy }
  const [familyMembers, setFamilyMembers] = useState([]); // the PERMANENT family's members — used for rating-restriction safety regardless of active room
  const [showNightPanel, setShowNightPanel] = useState(false);
  const [nightJoinInput, setNightJoinInput] = useState("");
  const [nightError, setNightError] = useState("");
  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState("");
  const [magicLinkBusy, setMagicLinkBusy] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  async function sendMagicLink() {
    setMagicLinkError("");
    const addr = magicLinkEmail.trim().toLowerCase();
    if (!addr.includes("@")) return setMagicLinkError("Enter a valid email address.");
    setMagicLinkBusy(true);
    try {
      const res = await fetch("/api/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMagicLinkError(data.error || "Couldn't send the link. Try again.");
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setMagicLinkError("Couldn't send the link. Try again.");
    }
    setMagicLinkBusy(false);
  }

  const [dobInput, setDobInput] = useState("");
  const [dobError, setDobError] = useState("");
  const [parentEmailInput, setParentEmailInput] = useState("");
  const [parentConsentError, setParentConsentError] = useState("");
  const [parentConsentSent, setParentConsentSent] = useState(false);
  const [parentConsentBusy, setParentConsentBusy] = useState(false);

  function calculateAge(dobString) {
    const dob = new Date(dobString + "T00:00:00");
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
  }

  async function submitDob() {
    setDobError("");
    if (!dobInput) return setDobError("Enter a date of birth.");
    const dob = new Date(dobInput + "T00:00:00");
    if (isNaN(dob.getTime()) || dob > new Date()) return setDobError("Enter a valid date of birth.");
    const age = calculateAge(dobInput);
    const isMinor = age < 13;
    const merged = await saveProfile({ dob: dobInput, isMinor, consentStatus: isMinor ? "pending" : null });
    setProfile(merged);
    setScreen(isMinor ? "parent-consent" : "join");
  }

  async function submitParentConsent() {
    setParentConsentError("");
    const addr = parentEmailInput.trim().toLowerCase();
    if (!addr.includes("@")) return setParentConsentError("Enter a valid parent/guardian email.");
    setParentConsentBusy(true);
    try {
      const merged = await saveProfile({ parentEmail: addr });
      setProfile(merged);
      const res = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          childEmail: email,
          childName: displayName,
          childGroup: profile?.group || null,
          parentEmail: addr,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setParentConsentError(data.error || "Couldn't send the request. Try again.");
      } else {
        setParentConsentSent(true);
      }
    } catch {
      setParentConsentError("Couldn't send the request. Try again.");
    }
    setParentConsentBusy(false);
  }

  const [nightBusy, setNightBusy] = useState(false);
  const [nightCopied, setNightCopied] = useState(null); // "code" | "message" | null
  const [instantMatches, setInstantMatches] = useState([]); // movies both people in a movie-night already said yes to, historically
  const [detailsCache, setDetailsCache] = useState({}); // movieId -> { runtime, cast }

  const [matchesSort, setMatchesSort] = useState({ key: "", dir: "desc" });
  const [matchesGenreFilter, setMatchesGenreFilter] = useState([]);
  const [matchesCastQuery, setMatchesCastQuery] = useState("");
  const [matchesAvailabilityFilter, setMatchesAvailabilityFilter] = useState([]);

  const [historySort, setHistorySort] = useState({ key: "", dir: "desc" });
  const [historyGenreFilter, setHistoryGenreFilter] = useState([]);
  const [historyCastQuery, setHistoryCastQuery] = useState("");
  const [historyAvailabilityFilter, setHistoryAvailabilityFilter] = useState([]);

  const [soloSort, setSoloSort] = useState({ key: "", dir: "desc" });
  const [soloGenreFilter, setSoloGenreFilter] = useState([]);
  const [soloCastQuery, setSoloCastQuery] = useState("");
  const [soloAvailabilityFilter, setSoloAvailabilityFilter] = useState([]);
  const [soloSearch, setSoloSearch] = useState("");

  const [screen, setScreen] = useState("join");
  const [error, setError] = useState("");
  const [fetchingPool, setFetchingPool] = useState(false);
  const [trailers, setTrailers] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [groupInput, setGroupInput] = useState("");
  const [regionInput, setRegionInput] = useState("CA");
  const [availableProviders, setAvailableProviders] = useState(SERVICES); // live list from TMDB, falls back to the static set while loading
  const [providerNameMap, setProviderNameMap] = useState(() => Object.fromEntries(SERVICES.map((s) => [s.id, s.name])));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/providers-list?region=${regionInput}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.results?.length) return;
        const corrected = d.results.map((p) => ({ ...p, name: providerDisplayName(p.id, p.name) }));
        setAvailableProviders(corrected);
        setProviderNameMap((prev) => ({ ...prev, ...Object.fromEntries(corrected.map((p) => [p.id, p.name])) }));
      })
      .catch(() => {
        // keep whatever list we already have (static fallback or a previous successful fetch)
      });
    return () => (cancelled = true);
  }, [regionInput]);

  const [wantsTheatersInput, setWantsTheatersInput] = useState(false);
  const [roleInput, setRoleInput] = useState("child");
  const [matchWith, setMatchWith] = useState(null); // null = everyone in the family
  const [celebration, setCelebration] = useState(null); // the movie that just became a full match

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 3200);
    return () => clearTimeout(t);
  }, [celebration]);
  const [servicesInput, setServicesInput] = useState([]);
  const [genresInput, setGenresInput] = useState([]);
  const [favInput, setFavInput] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [favSuggestions, setFavSuggestions] = useState([]);
  const [favSearching, setFavSearching] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all"); // all | yes | no | seen | review-later

  const cardRef = useRef(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const axisLockRef = useRef(null);
  const [dragX, setDragX] = useState(0);
  const [animating, setAnimating] = useState(false);

  const email = session?.user?.email;
  const displayName = session?.user?.name || email;

  useEffect(() => {
    if (status !== "authenticated" || !email) return;
    (async () => {
      setLoadingProfile(true);
      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!data.profile || !data.profile.dob) {
        // brand new sign-up, or an existing account from before this feature — DOB first
        setProfile(data.profile || null);
        setScreen("dob");
        setLoadingProfile(false);
        return;
      }

      setProfile(data.profile);

      if (data.profile.isMinor && !data.profile.parentEmail) {
        setScreen("parent-consent");
        setLoadingProfile(false);
        return;
      }

      setRegionInput(data.profile.region || "CA");
      setWantsTheatersInput(data.profile.wantsTheaters || false);
      setRoleInput(data.profile.role || "child");
      setServicesInput(data.profile.services || []);
      setGenresInput(data.profile.genres || []);
      setFavorites(data.profile.favorites || []);

      const familyData = await loadGroup(data.profile.group);
      setFamilyMembers((familyData && familyData.members) || []);

      if (data.profile.isMinor && data.profile.consentStatus === "approved" && familyData?.members) {
        const myRec = familyData.members.find((m) => m.email === email);
        if (myRec && myRec.maxRating !== data.profile.approvedRating) {
          await saveMember(data.profile.group, { ...myRec, role: "child", maxRating: data.profile.approvedRating });
        }
      }

      const roomCode = data.profile.currentRoom || data.profile.group;
      if (roomCode === data.profile.group) {
        setActiveRoomCode(data.profile.group);
        setRoomMeta({ type: "family" });
      } else {
        const roomRes = await fetch(`/api/room?code=${encodeURIComponent(roomCode)}`);
        const roomData = await roomRes.json();
        if (roomData.meta && (!roomData.meta.expiresAt || roomData.meta.expiresAt > Date.now())) {
          setActiveRoomCode(roomCode);
          setRoomMeta(roomData.meta);
          await loadGroup(roomCode);
        } else {
          // room expired or vanished — fall back to the permanent family
          setActiveRoomCode(data.profile.group);
          setRoomMeta({ type: "family" });
        }
      }

      setScreen(data.profile.services?.length && data.profile.genres?.length ? "swipe" : "setup");
      setLoadingProfile(false);
    })();
  }, [status, email]);

  async function assembleVotes(membersList) {
    if (!membersList.length) return {};
    const results = await Promise.all(
      membersList.map((m) =>
        fetch(`/api/uservotes?email=${encodeURIComponent(m.email)}`)
          .then((r) => r.json())
          .catch(() => ({ votes: {} }))
      )
    );
    const merged = {};
    membersList.forEach((m, i) => {
      const theirVotes = (results[i] && results[i].votes) || {};
      Object.entries(theirVotes).forEach(([movieId, choice]) => {
        if (!merged[movieId]) merged[movieId] = {};
        merged[movieId][m.email] = choice;
      });
    });
    return merged;
  }

  const loadGroup = useCallback(async (code) => {
    if (!code) return null;
    const res = await fetch(`/api/group?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    setMembers(data.members || []);
    setPool(data.pool || null);
    setSpotlight(data.spotlight || []);
    setSkippedMap(data.skipped || {});
    setNudgeDismissedMap(data.nudgeDismissed || {});
    const assembledVotes = await assembleVotes(data.members || []);
    setVotes(assembledVotes);
    return { ...data, votes: assembledVotes };
  }, []);

  async function saveProfile(next) {
    const merged = { ...profile, ...next };
    setProfile(merged);
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, profile: merged }),
    });
    return merged;
  }

  async function checkInstantMatches(code) {
    const data = await loadGroup(code);
    const roomMembers = (data && data.members) || [];
    if (roomMembers.length < 2) {
      setInstantMatches([]);
      return;
    }
    try {
      const votesByEmail = await Promise.all(
        roomMembers.map((m) => fetch(`/api/uservotes?email=${encodeURIComponent(m.email)}`).then((r) => r.json()))
      );
      const [first, ...rest] = votesByEmail.map((v) => v.votes || {});
      const sharedIds = Object.keys(first).filter((mid) => first[mid] === "yes" && rest.every((v) => v[mid] === "yes"));
      if (!sharedIds.length) {
        setInstantMatches([]);
        return;
      }
      const movies = await Promise.all(
        sharedIds.map((mid) => fetch(`/api/movie?movieId=${mid}`).then((r) => r.json()).catch(() => null))
      );
      setInstantMatches(movies.filter(Boolean));
    } catch {
      setInstantMatches([]);
    }
  }

  async function startMovieNight() {
    setNightError("");
    setNightBusy(true);
    try {
      const code = "MN-" + Math.random().toString(36).slice(2, 7).toUpperCase();
      const res = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action: "create", email }),
      });
      const data = await res.json();
      await saveProfile({ currentRoom: code });
      setActiveRoomCode(code);
      setRoomMeta(data.meta);
      await checkInstantMatches(code);
      setScreen("setup");
      setServicesInput(profile?.services || []);
      setGenresInput(profile?.genres || []);
      setFavorites(profile?.favorites || []);
    } catch {
      setNightError("Couldn't start a Movie Night — try again.");
    }
    setNightBusy(false);
  }

  async function joinMovieNight() {
    setNightError("");
    const code = nightJoinInput.trim().toUpperCase();
    if (!code) return setNightError("Enter a Movie Night code.");
    setNightBusy(true);
    try {
      const res = await fetch(`/api/room?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!data.meta) {
        setNightError("No Movie Night found with that code.");
        setNightBusy(false);
        return;
      }
      if (data.meta.expiresAt && data.meta.expiresAt < Date.now()) {
        setNightError("That Movie Night has expired.");
        setNightBusy(false);
        return;
      }
      await saveProfile({ currentRoom: code });
      setActiveRoomCode(code);
      setRoomMeta(data.meta);
      await checkInstantMatches(code);
      setShowNightPanel(false);
      setServicesInput(profile?.services || []);
      setGenresInput(profile?.genres || []);
      setFavorites(profile?.favorites || []);
      setScreen("setup");
    } catch {
      setNightError("Couldn't join that Movie Night — try again.");
    }
    setNightBusy(false);
  }

  async function exitMovieNight() {
    await saveProfile({ currentRoom: null });
    setActiveRoomCode(profile.group);
    setRoomMeta({ type: "family" });
    setInstantMatches([]);
    await loadGroup(profile.group);
    setRegionInput(profile.region || "CA");
    setRoleInput(profile.role || "child");
    setServicesInput(profile.services || []);
    setGenresInput(profile.genres || []);
    setFavorites(profile.favorites || []);
    setShowNightPanel(false);
    setScreen("swipe");
  }

  function buildNightShareMessage() {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    return `Join my Movie Night on Family Movie Match! Use code ${activeRoomCode}${url ? " at " + url : ""}`;
  }
  async function shareNight() {
    const text = buildNightShareMessage();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my Movie Night", text });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        setNightCopied("message");
        setTimeout(() => setNightCopied(null), 2000);
      } catch {
        // clipboard unavailable — nothing more we can do here
      }
    }
  }
  async function copyNightCode() {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(activeRoomCode || "");
      setNightCopied("code");
      setTimeout(() => setNightCopied(null), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  async function convertRoomToPermanent() {
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: activeRoomCode, action: "convert", email }),
    });
    const data = await res.json();
    setRoomMeta(data.meta);
  }

  async function setChildMaxRating(member, rating) {
    await saveMember(profile.group, { ...member, maxRating: rating || null });
  }

  async function setMemberRole(member, role) {
    await saveMember(profile.group, { ...member, role });
  }

  async function saveMember(group, memberObj) {
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: group, type: "member", payload: memberObj }),
    });
    const data = await res.json();
    setMembers(data.members || []);
  }

  async function handleJoin() {
    setError("");
    const group = groupInput.trim().toUpperCase();
    if (!group) return setError("Enter a family group code.");
    const merged = await saveProfile({ group });
    const data = await loadGroup(group);
    setFamilyMembers((data && data.members) || []);
    setActiveRoomCode(group);
    setRoomMeta({ type: "family" });
    if (data && (data.members || []).length === 0) {
      setRoleInput("parent"); // first person in a brand-new family — needs to be able to set up parental controls
    }
    setScreen("setup");
  }

  function randomCode() {
    setGroupInput(Math.random().toString(36).slice(2, 7).toUpperCase());
  }
  function toggleService(id) {
    setServicesInput((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function toggleGenre(id) {
    setGenresInput((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  useEffect(() => {
    const q = favInput.trim();
    if (q.length < 2) {
      setFavSuggestions([]);
      return;
    }
    setFavSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setFavSuggestions(d.results || []))
        .catch(() => setFavSuggestions([]))
        .finally(() => setFavSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [favInput]);

  function addFavoriteTitle(title) {
    const v = title.trim();
    if (!v) return;
    setFavorites((f) => (f.some((x) => x.toLowerCase() === v.toLowerCase()) ? f : [...f, v]));
    setFavInput("");
    setFavSuggestions([]);
  }
  function addFavorite() {
    addFavoriteTitle(favInput);
  }
  function removeFavorite(title) {
    setFavorites((f) => f.filter((x) => x !== title));
  }

  async function handleSaveSetup() {
    setError("");
    if (!servicesInput.length) return setError("Pick at least one streaming service.");
    if (!genresInput.length) return setError("Pick at least one genre you're into.");

    const inOwnFamily = activeRoomCode === profile.group;

    if (inOwnFamily) {
      const existingSelf = members.find((m) => m.email === email);
      const otherParentsExist = members.some((m) => m.role === "parent" && m.email !== email);
      const iAmAlreadyParent = existingSelf?.role === "parent";
      const roleLocked = otherParentsExist && !iAmAlreadyParent;
      let finalRole = roleLocked ? "child" : roleInput;
      let finalMaxRating = existingSelf?.maxRating;
      if (profile?.isMinor) {
        finalRole = "child"; // minors are always "child" — never self-promotable regardless of family parent state
        finalMaxRating = profile.consentStatus === "approved" ? profile.approvedRating : "G";
      }
      if (roleLocked && roleInput === "parent" && !profile?.isMinor) {
        setError("This family already has a parent — ask them to promote you from the Family tab.");
        return;
      }
      await saveProfile({ region: regionInput, role: finalRole, services: servicesInput, genres: genresInput, favorites, wantsTheaters: wantsTheatersInput });
      await saveMember(activeRoomCode, { name: displayName, email, role: finalRole, maxRating: finalMaxRating, services: servicesInput, genres: genresInput, favorites, wantsTheaters: wantsTheatersInput });
      setFamilyMembers((prev) => {
        const rec = { name: displayName, email, role: finalRole, maxRating: finalMaxRating, services: servicesInput, genres: genresInput, favorites, wantsTheaters: wantsTheatersInput };
        const idx = prev.findIndex((m) => m.email === email);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = rec;
          return copy;
        }
        return [...prev, rec];
      });
    } else {
      // temporary Movie Night room — just this room's member record, permanent profile untouched
      await saveMember(activeRoomCode, { name: displayName, email, services: servicesInput, genres: genresInput, favorites, wantsTheaters: wantsTheatersInput });
      await checkInstantMatches(activeRoomCode);
      await fetchPool();
    }
    setScreen("swipe");
  }

  async function fetchPool() {
    if (!profile) return;
    setFetchingPool(true);
    setError("");
    try {
      // re-fetch the latest shared pool first, so we merge onto whatever
      // teammates have already added rather than clobbering it
      const latest = await fetch(`/api/group?code=${encodeURIComponent(activeRoomCode)}`).then((r) => r.json());
      const existingMovies = (latest.pool && latest.pool.movies) || [];
      const allServiceIds = Array.from(new Set(members.flatMap((m) => m.services || []).concat(profile.services || [])));
      const allGenreIds = Array.from(new Set(members.flatMap((m) => m.genres || []).concat(profile.genres || [])));
      const sameFilters =
        latest.pool &&
        JSON.stringify([...(latest.pool.providerIds || [])].sort()) === JSON.stringify([...allServiceIds].sort()) &&
        JSON.stringify([...(latest.pool.genreIds || [])].sort()) === JSON.stringify([...allGenreIds].sort());
      const startPage = sameFilters ? latest.pool.pagesFetched || 0 : 0;
      let fetched = [];
      let totalResults = null;
      let lastPageTried = startPage;
      for (let page = startPage + 1; page <= startPage + 5; page++) {
        const url = `/api/movies?region=${profile.region || "CA"}&providers=${allServiceIds.join("|")}&genres=${allGenreIds.join("|")}&page=${page}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "TMDB request failed");
        totalResults = data.total_results ?? totalResults;
        lastPageTried = page;
        if (!data.results || data.results.length === 0) break;
        fetched = fetched.concat(data.results);
        if (page >= (data.total_pages || page)) break;
      }

      // seed additional picks from each family member's own favorites,
      // tagged with whose favorite it actually came from — but only keep
      // ones that actually match a genre the family selected, since TMDB's
      // "recommended for this movie" endpoint ignores genre entirely
      for (const mem of members) {
        const favs = mem.favorites || [];
        if (!favs.length) continue;
        try {
          const recRes = await fetch(`/api/recommendations?titles=${encodeURIComponent(favs.join("|"))}&region=${profile.region || "CA"}`);
          const recData = await recRes.json();
          const tagged = (recData.results || [])
            .filter((m) => (m.genre_ids || []).some((g) => allGenreIds.includes(g)))
            .map((m) => ({ ...m, _becauseName: mem.email === email ? "you" : mem.name }));
          fetched = fetched.concat(tagged);
        } catch {
          // recommendations are a bonus — don't block the whole fetch if one member's batch fails
        }
      }

      // pull in what's currently playing in theaters, if anyone wants that included
      const anyoneWantsTheaters = members.some((m) => m.wantsTheaters) || profile.wantsTheaters;
      if (anyoneWantsTheaters) {
        try {
          for (let page = 1; page <= 2; page++) {
            const npRes = await fetch(`/api/nowplaying?region=${profile.region || "CA"}&page=${page}`);
            const npData = await npRes.json();
            if (!npRes.ok || !npData.results?.length) break;
            const tagged = npData.results
              .filter((m) => !allGenreIds.length || (m.genre_ids || []).some((g) => allGenreIds.includes(g)))
              .map((m) => ({ ...m, _inTheaters: true }));
            fetched = fetched.concat(tagged);
          }
        } catch {
          // theaters listing is a bonus — don't block the whole fetch if it fails
        }
      }

      // merge: keep every movie anyone has ever seen in this group's pool
      // (so votes/matches on them stay valid) and add anything new
      const byId = new Map(existingMovies.map((m) => [m.id, m]));
      for (const m of fetched) if (!byId.has(m.id)) byId.set(m.id, m);

      // make sure everyone's existing votes are actually represented here —
      // don't leave it to chance whether TMDB's discover results happened to
      // include something someone already voted on elsewhere
      const allVotedIds = new Set();
      for (const mem of members) {
        try {
          const vRes = await fetch(`/api/uservotes?email=${encodeURIComponent(mem.email)}`);
          const vData = await vRes.json();
          Object.keys(vData.votes || {}).forEach((id) => allVotedIds.add(id));
        } catch {
          // one member's history failing shouldn't block the pool
        }
      }
      const missingIds = Array.from(allVotedIds).filter((id) => !byId.has(Number(id)));
      if (missingIds.length) {
        const fetchedMissing = [];
        const batchSize = 5;
        for (let i = 0; i < missingIds.length; i += batchSize) {
          const batch = missingIds.slice(i, i + batchSize);
          const results = await Promise.all(
            batch.map((id) =>
              fetch(`/api/movie?movieId=${id}`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
            )
          );
          fetchedMissing.push(...results);
        }
        fetchedMissing
          .filter((m) => m && m.id) // drop anything that failed or came back malformed, instead of silently corrupting the pool
          .forEach((m) => {
            if (!byId.has(m.id)) byId.set(m.id, m);
          });
      }

      const merged = Array.from(byId.values());

      const newPool = {
        region: profile.region,
        providerIds: allServiceIds,
        genreIds: allGenreIds,
        movies: merged,
        pagesFetched: lastPageTried,
        totalResults,
        fetchedAt: Date.now(),
      };
      await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeRoomCode, type: "pool", payload: newPool }),
      });
      setPool(newPool);
      if (fetched.length === 0 && existingMovies.length === 0) {
        setError("TMDB didn't return any titles for this combination of services and genres — try adding more of either in Settings.");
      } else if (fetched.length === 0) {
        setError(`That's every title TMDB has for your current services and genres (${totalResults ?? existingMovies.length} total) — try adding a service or genre in Settings for more.`);
      }
    } catch (e) {
      setError(e.message || "Couldn't fetch movies.");
    }
    setFetchingPool(false);
  }

  const myMember = members.find((m) => m.email === email); // active room's record (for room-scoped role UI)
  const myFamilyMember = familyMembers.find((m) => m.email === email); // permanent family record — source of truth for safety
  const isPendingMinor = profile?.isMinor && profile?.consentStatus !== "approved";
  const myMaxRating = isPendingMinor
    ? "G"
    : myFamilyMember && myFamilyMember.role === "child"
    ? myFamilyMember.maxRating
    : null;
  const roleLockedForMe = members.some((m) => m.role === "parent" && m.email !== email) && myMember?.role !== "parent";

  useEffect(() => {
    if (!myMaxRating || !pool) return;
    const pending = pool.movies.filter((m) => certifications[m.id] === undefined).slice(0, 30);
    if (!pending.length) return;
    let cancelled = false;
    (async () => {
      for (const m of pending) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/certification?movieId=${m.id}`);
          const data = await res.json();
          if (!cancelled) setCertifications((prev) => ({ ...prev, [m.id]: data.certification || "" }));
        } catch {
          if (!cancelled) setCertifications((prev) => ({ ...prev, [m.id]: "" }));
        }
      }
    })();
    return () => (cancelled = true);
    // eslint-disable-next-line
  }, [pool, myMaxRating, certifications]);

  const [nudgeDismissedMap, setNudgeDismissedMap] = useState({}); // { email: [movieId, ...] } — persisted, so a resolved nudge stays resolved
  const reconsidered = new Set(nudgeDismissedMap[email] || []);
  const [skippedMap, setSkippedMap] = useState({}); // { email: [movieId, ...] } — persisted server-side so it survives reloads
  const skippedOrder = skippedMap[email] || [];

  function nudgeRecommenders(movieId) {
    return spotlight.filter((s) => s.movieId === movieId && s.byEmail !== email);
  }

  const myVotedIds = useMemo(() => {
    const ids = new Set();
    Object.entries(votes).forEach(([mid, byEmail]) => {
      if (email && byEmail[email]) ids.add(Number(mid));
    });
    return ids;
  }, [votes, email]);

  const deck = useMemo(() => {
    if (!pool) return [];
    let movies = pool.movies.filter((m) => {
      const alreadyVoted = myVotedIds.has(m.id);
      if (!alreadyVoted) return true;
      // let a movie reappear if someone else in the family wants to watch it
      // and you'd previously said no / already seen it
      const myVote = (votes[m.id] || {})[email];
      const nudged = (myVote === "no" || myVote === "seen") && nudgeRecommenders(m.id).length > 0 && !reconsidered.has(m.id);
      return nudged;
    });
    if (myMaxRating) {
      const maxRank = ratingRank(myMaxRating);
      movies = movies.filter((m) => {
        const cert = certifications[m.id];
        if (cert === undefined) return false; // still checking — don't show until we know
        return cert !== "" && ratingRank(cert) <= maxRank;
      });
    }
    if (skippedOrder.length) {
      const skippedSet = new Set(skippedOrder);
      const rest = movies.filter((m) => !skippedSet.has(m.id));
      const pushedToEnd = skippedOrder.map((id) => movies.find((m) => m.id === id)).filter(Boolean);
      movies = [...rest, ...pushedToEnd];
    }
    return movies;
    // eslint-disable-next-line
  }, [pool, myVotedIds, myMaxRating, certifications, votes, email, spotlight, reconsidered, skippedOrder]);
  const currentMovie = deck[0];
  const currentMovieNudges = currentMovie ? nudgeRecommenders(currentMovie.id) : [];

  const ratingCheckPending = myMaxRating && pool ? pool.movies.some((m) => certifications[m.id] === undefined) : false;

  function passesRatingFilter(movie) {
    if (!myMaxRating) return true;
    const cert = certifications[movie.id];
    if (cert === undefined) return false; // not yet checked — keep hidden until we know
    return cert !== "" && ratingRank(cert) <= ratingRank(myMaxRating);
  }

  function passesGenreFilter(movie, genreIds) {
    if (!genreIds.length) return true;
    return (movie.genre_ids || []).some((g) => genreIds.includes(g));
  }

  function passesAvailabilityFilter(movie, availability) {
    if (!availability.length) return true;
    const inTheaters = !!movie._inTheaters;
    return (availability.includes("theaters") && inTheaters) || (availability.includes("streaming") && !inTheaters);
  }

  function splitByGenreMatch(movies, genreFilter) {
    if (!genreFilter.length) return { all: movies, some: [] };
    const all = [];
    const some = [];
    for (const m of movies) {
      const ids = m.genre_ids || [];
      const matched = genreFilter.filter((g) => ids.includes(g)).length;
      if (matched === genreFilter.length) all.push(m);
      else if (matched > 0) some.push(m);
    }
    return { all, some };
  }

  function passesCastFilter(movie, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const cast = detailsCache[movie.id]?.cast;
    if (!cast) return false; // still loading — hide until we know, avoids false negatives
    return cast.some((name) => name.toLowerCase().includes(q));
  }

  function sortMovies(list, sort) {
    if (!sort.key) return list;
    const arr = [...list];
    arr.sort((a, b) => {
      let av, bv;
      if (sort.key === "year") {
        av = a.release_date ? new Date(a.release_date).getTime() : 0;
        bv = b.release_date ? new Date(b.release_date).getTime() : 0;
      } else if (sort.key === "score") {
        av = a.vote_average || 0;
        bv = b.vote_average || 0;
      } else if (sort.key === "title") {
        av = a.title.toLowerCase();
        bv = b.title.toLowerCase();
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }

  // fetch runtime/cast for a set of movies — used both for the cast filter
  // and to feed DetailsRow without refetching per card
  function useCastFetch(movies, query) {
    useEffect(() => {
      if (!query.trim()) return;
      const pending = movies.filter((m) => detailsCache[m.id] === undefined).slice(0, 30);
      if (!pending.length) return;
      let cancelled = false;
      (async () => {
        for (const m of pending) {
          if (cancelled) return;
          try {
            const res = await fetch(`/api/details?movieId=${m.id}`);
            const data = await res.json();
            if (!cancelled) setDetailsCache((prev) => ({ ...prev, [m.id]: data }));
          } catch {
            if (!cancelled) setDetailsCache((prev) => ({ ...prev, [m.id]: { runtime: null, cast: [] } }));
          }
        }
      })();
      return () => (cancelled = true);
      // eslint-disable-next-line
    }, [movies.length, query, detailsCache]);
  }

  useEffect(() => {
    deck.slice(1, 4).forEach((m) => {
      if (!m.poster_path) return;
      const img = new window.Image();
      img.src = `https://image.tmdb.org/t/p/w500${m.poster_path}`;
    });
    // eslint-disable-next-line
  }, [deck.length ? deck[0]?.id : null]);

  async function castVote(movieId, choice) {
    // optimistic: update locally right away so the next card appears
    // instantly, instead of waiting on the network round-trip
    setVotes((prev) => ({ ...prev, [movieId]: { ...(prev[movieId] || {}), [email]: choice } }));
    try {
      await fetch("/api/uservotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, movieId, choice }),
      });
    } catch {
      // the optimistic update already stuck locally; a later refresh will reconcile
    }
  }

  function isSpotlightedByMe(movieId) {
    return spotlight.some((s) => s.movieId === movieId && s.byEmail === email);
  }

  async function toggleSpotlight(movieId) {
    const action = isSpotlightedByMe(movieId) ? "remove" : "add";
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: activeRoomCode, type: "spotlight", payload: { movieId, byEmail: email, byName: displayName, action } }),
    });
    const data = await res.json();
    setSpotlight(data.spotlight || []);
  }

  async function dismissNudge(movieId) {
    setNudgeDismissedMap((prev) => {
      const list = prev[email] || [];
      if (list.includes(movieId)) return prev;
      return { ...prev, [email]: [...list, movieId] };
    });
    try {
      await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeRoomCode, type: "nudgeDismiss", payload: { email, movieId } }),
      });
    } catch {
      // local state already updated optimistically — a later refresh will reconcile
    }
  }

  function commitSwipe(choice) {
    if (!currentMovie || animating) return;
    const movie = currentMovie;
    if (nudgeRecommenders(movie.id).length > 0) {
      dismissNudge(movie.id);
    }
    if (choice === "yes" && members.length > 1) {
      const updatedVotesForMovie = { ...(votes[movie.id] || {}), [email]: "yes" };
      const isFullMatch = members.every((m) => updatedVotesForMovie[m.email] === "yes");
      if (isFullMatch) setCelebration(movie);
    }
    setAnimating(true);
    setDragX(choice === "yes" ? 500 : -500);
    setTimeout(() => {
      castVote(movie.id, choice);
      setDragX(0);
      setAnimating(false);
    }, 200);
  }

  function markSeen() {
    if (!currentMovie || animating) return;
    if (nudgeRecommenders(currentMovie.id).length > 0) {
      dismissNudge(currentMovie.id);
    }
    castVote(currentMovie.id, "seen");
  }

  async function skipCurrent() {
    if (!currentMovie || animating) return;
    const movieId = currentMovie.id;
    setSkippedMap((prev) => {
      const list = prev[email] || [];
      if (list.includes(movieId)) return prev;
      return { ...prev, [email]: [...list, movieId] };
    });
    try {
      await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeRoomCode, type: "skip", payload: { email, movieId, action: "add" } }),
      });
    } catch {
      // local state already updated optimistically — a later refresh will reconcile
    }
  }

  async function unskipMovie(movieId) {
    setSkippedMap((prev) => ({ ...prev, [email]: (prev[email] || []).filter((id) => id !== movieId) }));
    try {
      await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeRoomCode, type: "skip", payload: { email, movieId, action: "remove" } }),
      });
    } catch {
      // local state already updated optimistically
    }
  }

  function onPointerDown(e) {
    if (animating) return;
    draggingRef.current = true; // gesture in progress, axis not yet decided
    axisLockRef.current = null;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    // deliberately NOT capturing the pointer yet — if this turns out to be
    // a vertical scroll, the browser needs to keep handling it natively
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;

    if (axisLockRef.current === null) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      if (distance < 12) return; // dead zone — too early to tell intent
      // bias slightly toward vertical so a mostly-up-down finger never
      // accidentally starts a swipe
      axisLockRef.current = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
      if (axisLockRef.current === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        // it's a scroll — stop tracking this gesture entirely and let the
        // browser's native pan-y scrolling take over from here
        draggingRef.current = false;
        return;
      }
    }

    if (axisLockRef.current === "x") {
      e.preventDefault();
      setDragX(dx);
    }
  }
  function onPointerEnd(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (axisLockRef.current === "x") {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setDragX((x) => {
        if (x > 100) commitSwipe("yes");
        else if (x < -100) commitSwipe("no");
        else return 0;
        return x;
      });
    }
    axisLockRef.current = null;
  }

  async function fetchTrailer(movieId) {
    if (trailers[movieId]) return;
    const res = await fetch(`/api/trailer?movieId=${movieId}`);
    const data = await res.json();
    setTrailers((s) => ({ ...s, [movieId]: data.key || null }));
  }
  useEffect(() => {
    if (currentMovie) fetchTrailer(currentMovie.id);
    // eslint-disable-next-line
  }, [currentMovie?.id]);

  const otherMembers = members.filter((m) => m.email !== email);
  const consideredEmails = matchWith === null ? otherMembers.map((m) => m.email) : matchWith;
  const consideredMembers = [{ email }, ...otherMembers.filter((m) => consideredEmails.includes(m.email))];

  function toggleMatchWith(otherEmail) {
    const base = matchWith === null ? otherMembers.map((m) => m.email) : matchWith;
    setMatchWith(base.includes(otherEmail) ? base.filter((e) => e !== otherEmail) : [...base, otherEmail]);
  }

  const votesFor = (m) => consideredMembers.map((mem) => (votes[m.id] || {})[mem.email]);

  const readyToWatch = useMemo(() => {
    if (!pool || !consideredMembers.length || consideredEmails.length === 0) return [];
    return pool.movies.filter((m) => votesFor(m).every((v) => v === "yes") && passesRatingFilter(m));
    // eslint-disable-next-line
  }, [pool, votes, members, matchWith, email, myMaxRating, certifications]);

  const myWatched = useMemo(() => {
    if (!pool || !email) return [];
    return pool.movies.filter((m) => (votes[m.id] || {})[email] === "seen");
  }, [pool, votes, email]);

  const myYes = useMemo(() => {
    if (!pool || !email) return [];
    return pool.movies.filter((m) => (votes[m.id] || {})[email] === "yes");
  }, [pool, votes, email]);

  const myNo = useMemo(() => {
    if (!pool || !email) return [];
    return pool.movies.filter((m) => (votes[m.id] || {})[email] === "no");
  }, [pool, votes, email]);

  const familyYesByMember = useMemo(() => {
    if (!pool) return [];
    return otherMembers.map((m) => ({
      member: m,
      movies: pool.movies.filter((mv) => (votes[mv.id] || {})[m.email] === "yes" && passesRatingFilter(mv)),
    }));
    // eslint-disable-next-line
  }, [pool, votes, members, myMaxRating, certifications]);

  // for splitting "My Votes" yes list: is this a movie the WHOLE family said
  // yes to, or one where at least one other member said no ("solo watch")?
  const fullFamilyMatchIds = useMemo(() => {
    const ids = new Set();
    if (!pool || members.length < 2) return ids;
    pool.movies.forEach((m) => {
      if (members.every((mem) => (votes[m.id] || {})[mem.email] === "yes")) ids.add(m.id);
    });
    return ids;
  }, [pool, votes, members]);

  const mySoloSearched = myYes.filter((m) => !fullFamilyMatchIds.has(m.id) && m.title.toLowerCase().includes(soloSearch.trim().toLowerCase()));

  useCastFetch(readyToWatch, matchesCastQuery);
  useCastFetch(myYes, soloCastQuery);

  const visibleMatches = sortMovies(
    readyToWatch.filter((m) => passesGenreFilter(m, matchesGenreFilter) && passesCastFilter(m, matchesCastQuery) && passesAvailabilityFilter(m, matchesAvailabilityFilter)),
    matchesSort
  );
  const { all: visibleMatchesAll, some: visibleMatchesSome } = splitByGenreMatch(visibleMatches, matchesGenreFilter);

  const visibleSoloWatch = sortMovies(
    mySoloSearched.filter((m) => passesGenreFilter(m, soloGenreFilter) && passesCastFilter(m, soloCastQuery) && passesAvailabilityFilter(m, soloAvailabilityFilter)),
    soloSort
  );
  const { all: visibleSoloAll, some: visibleSoloSome } = splitByGenreMatch(visibleSoloWatch, soloGenreFilter);

  const mySeenSearched = myWatched.filter((m) => m.title.toLowerCase().includes(historySearch.trim().toLowerCase()));
  const visibleSeen = sortMovies(
    mySeenSearched.filter((m) => passesGenreFilter(m, historyGenreFilter) && passesCastFilter(m, historyCastQuery) && passesAvailabilityFilter(m, historyAvailabilityFilter)),
    historySort
  );

  const myYesInVotesSearched = myYes.filter((m) => m.title.toLowerCase().includes(historySearch.trim().toLowerCase()));
  const visibleYesInVotes = sortMovies(
    myYesInVotesSearched.filter((m) => passesGenreFilter(m, historyGenreFilter) && passesCastFilter(m, historyCastQuery) && passesAvailabilityFilter(m, historyAvailabilityFilter)),
    historySort
  );

  const myNoInVotesSearched = myNo.filter((m) => m.title.toLowerCase().includes(historySearch.trim().toLowerCase()));
  const visibleNoInVotes = sortMovies(
    myNoInVotesSearched.filter((m) => passesGenreFilter(m, historyGenreFilter) && passesCastFilter(m, historyCastQuery) && passesAvailabilityFilter(m, historyAvailabilityFilter)),
    historySort
  );

  const reviewLaterMovies = pool
    ? skippedOrder.map((id) => pool.movies.find((m) => m.id === id)).filter(Boolean).filter((m) => !(votes[m.id] || {})[email])
    : [];
  const reviewLaterSearched = reviewLaterMovies.filter((m) => m.title.toLowerCase().includes(historySearch.trim().toLowerCase()));
  const visibleReviewLater = sortMovies(
    reviewLaterSearched.filter((m) => passesGenreFilter(m, historyGenreFilter) && passesCastFilter(m, historyCastQuery) && passesAvailabilityFilter(m, historyAvailabilityFilter)),
    historySort
  );

  useCastFetch(myWatched.concat(myYes).concat(myNo).concat(reviewLaterMovies), historyCastQuery);

  function matchesFor(emailList) {
    if (!pool) return [];
    return pool.movies.filter((m) => emailList.every((e) => (votes[m.id] || {})[e] === "yes") && passesRatingFilter(m));
  }

  const isTopSelectionEveryone = matchWith === null;
  const isTopSelectionExactlyOneMember = matchWith !== null && matchWith.length === 1;

  const everyoneMatches = !isTopSelectionEveryone ? matchesFor([email, ...otherMembers.map((m) => m.email)]) : [];
  const perMemberMatches = otherMembers
    .filter((m) => !(isTopSelectionExactlyOneMember && matchWith[0] === m.email))
    .map((m) => ({ member: m, movies: matchesFor([email, m.email]) }));

  function renderMatchCard(m) {
    return (
      <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
        {m.poster_path && (
          <div className="relative flex-shrink-0">
            {isNewRelease(m.release_date) && <NewBadge />}
            {m._inTheaters && <TheaterBadge />}
            <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg" alt={m.title} />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-extrabold flex items-center gap-1"><Ticket className="w-4 h-4 text-cinema-gold flex-shrink-0" /> {m.title}</div>
          {m._because && <div className="text-[11px] text-cinema-orange font-bold">Because {m._becauseName || "your family"} liked {m._because}</div>}
          <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
          <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
          <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
          <ProviderRow movieId={m.id} region={profile?.region} />
          <TrailerButton movieId={m.id} />
        </div>
      </div>
    );
  }

  function renderSoloCard(m) {
    return (
      <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
        {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{m.title}</div>
          <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
          <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
          <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
          <ProviderRow movieId={m.id} region={profile?.region} />
          <TrailerButton movieId={m.id} />
          <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
          <VoteSwitcher current="yes" onSet={(choice) => castVote(m.id, choice)} />
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (roomMeta?.type === "movie-night" && activeRoomCode) {
      checkInstantMatches(activeRoomCode);
    }
    // eslint-disable-next-line
  }, [members.length, roomMeta?.type, activeRoomCode]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-cinema-bg text-cinema-gold" style={bodyFont}>Loading…</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cinema-bg text-stone-50" style={bodyFont}>
        <div className="text-center max-w-xs w-full px-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Film className="w-8 h-8 text-cinema-gold" />
            <h1 className="text-3xl text-cinema-gold" style={displayFont}>Family Movie Match</h1>
          </div>
          <p className="text-cinema-muted mb-6 text-sm">Sign in to link up with your family and start swiping.</p>

          {!showEmailForm && (
            <div className="space-y-2">
              <button onClick={() => signIn("google")} className="w-full px-6 py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">
                Continue with Google
              </button>
              <button onClick={() => setShowEmailForm(true)} className="w-full px-6 py-2.5 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 font-extrabold hover:border-cinema-gold">
                Continue with Email
              </button>
              <p className="text-[11px] text-cinema-mutedDark pt-2">No passwords here — email sign-in sends a one-time link instead.</p>
            </div>
          )}

          {showEmailForm && !magicLinkSent && (
            <div className="space-y-2">
              <input
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()}
                placeholder="you@example.com"
                type="email"
                className="w-full px-3 py-2.5 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold text-center"
              />
              {magicLinkError && <p className="text-cinema-orangeLight text-xs">{magicLinkError}</p>}
              <button
                onClick={sendMagicLink}
                disabled={magicLinkBusy}
                className="w-full px-6 py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight disabled:opacity-50"
              >
                {magicLinkBusy ? "Sending…" : "Send me a sign-in link"}
              </button>
              <button onClick={() => setShowEmailForm(false)} className="text-xs text-cinema-mutedDark font-bold">
                ← Back
              </button>
            </div>
          )}

          {showEmailForm && magicLinkSent && (
            <div className="px-4 py-6 rounded-lg bg-cinema-panel border border-cinema-border">
              <p className="text-sm font-bold text-cinema-gold mb-1">Check your email</p>
              <p className="text-xs text-cinema-muted">We sent a sign-in link to {magicLinkEmail}. It's good for 15 minutes.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return <div className="min-h-screen flex items-center justify-center bg-cinema-bg text-cinema-gold" style={bodyFont}>Loading your profile…</div>;
  }

  const rotation = Math.max(-15, Math.min(15, dragX / 12));

  return (
    <div className="min-h-screen bg-cinema-bg text-stone-50" style={bodyFont}>
      {celebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
          onClick={() => setCelebration(null)}
        >
          <div className="text-center animate-[pulse_1.2s_ease-in-out_infinite]">
            <Sparkles className="w-16 h-16 text-cinema-gold mx-auto mb-2" />
            <h2 className="text-5xl text-cinema-gold mb-3" style={displayFont}>IT'S A MATCH!</h2>
            {celebration.poster_path && (
              <img
                src={`https://image.tmdb.org/t/p/w300${celebration.poster_path}`}
                alt={celebration.title}
                className="w-40 mx-auto rounded-xl shadow-2xl mb-3 border-4 border-cinema-gold"
              />
            )}
            <div className="text-xl font-extrabold text-stone-50">{celebration.title}</div>
            <div className="text-sm text-cinema-muted mt-1">Everyone in the family said yes 🎉</div>
          </div>
        </div>
      )}
      {isPendingMinor && profile?.group && (
        <div className="px-5 py-2 bg-cinema-gold/15 border-b border-cinema-gold text-center text-xs font-bold text-cinema-gold">
          Waiting on parent approval — showing G-rated titles only for now
        </div>
      )}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-cinema-border/60">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-cinema-gold" />
          <h1 className="text-2xl text-cinema-gold" style={displayFont}>Family Movie Match</h1>
        </div>
        <div className="flex items-center gap-3">
          {profile?.group && roomMeta && (
            <span className="text-xs text-cinema-muted font-bold hidden sm:inline">
              {roomMeta.type === "movie-night" ? `🎬 Movie Night ${activeRoomCode}` : `Family ${profile.group}`}
            </span>
          )}
          {profile?.group && (
            <button
              onClick={() => setShowNightPanel((s) => !s)}
              className="text-xs font-bold px-2 py-1 rounded-lg bg-cinema-panel border border-cinema-border text-cinema-mutedLight hover:border-cinema-gold"
            >
              🎬 Movie Night
            </button>
          )}
          <button onClick={() => signOut()} className="text-cinema-muted hover:text-cinema-gold" title="Sign out"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      {showNightPanel && (
        <div className="px-5 py-4 bg-cinema-panel border-b border-cinema-border">
          {nightError && <div className="mb-3 px-3 py-2 rounded-lg bg-cinema-orange/15 border border-cinema-orange text-cinema-orangeLight text-sm">{nightError}</div>}

          {roomMeta?.type === "movie-night" ? (
            <div>
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-1">🎬 Movie Night code</div>
              <div className="mb-3 px-4 py-3 rounded-xl bg-cinema-bg border-2 border-cinema-gold flex items-center justify-between gap-3">
                <div className="text-3xl font-extrabold text-cinema-gold tracking-[0.15em] flex-1 text-center" style={{ fontFamily: "monospace" }}>
                  {activeRoomCode}
                </div>
                <button
                  onClick={copyNightCode}
                  className="flex-shrink-0 text-xs font-bold px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-cinema-mutedLight hover:border-cinema-gold"
                >
                  {nightCopied === "code" ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <div className="text-xs text-cinema-muted mb-3">
                {roomMeta.expiresAt
                  ? `Expires ${new Date(roomMeta.expiresAt).toLocaleDateString()}`
                  : "Made permanent — this is now a real family."}
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <button onClick={shareNight} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cinema-bg border border-cinema-border text-cinema-mutedLight hover:border-cinema-gold">
                  {nightCopied === "message" ? "✓ Copied to clipboard" : "📤 Share"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={exitMovieNight} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cinema-bg border border-cinema-border text-cinema-mutedLight hover:border-cinema-gold">
                  ← Back to my family
                </button>
                {roomMeta.expiresAt && (
                  <button onClick={convertRoomToPermanent} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cinema-gold text-cinema-ink hover:bg-cinema-goldLight">
                    Make this permanent
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-sm">
              <p className="text-xs text-cinema-muted mb-3">
                Swipe with a friend outside your family, without touching your real family's data. Lasts up to a week unless you make it permanent.
              </p>
              <button
                onClick={startMovieNight}
                disabled={nightBusy}
                className="w-full mb-3 py-2 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight disabled:opacity-50"
              >
                Start a Movie Night
              </button>
              <div className="flex gap-2">
                <input
                  value={nightJoinInput}
                  onChange={(e) => setNightJoinInput(e.target.value.toUpperCase())}
                  placeholder="Have a code? Join one"
                  className="flex-1 px-3 py-2 rounded-lg bg-cinema-bg border border-cinema-border text-stone-50 text-sm outline-none focus:border-cinema-gold"
                />
                <button onClick={joinMovieNight} disabled={nightBusy} className="px-3 py-2 rounded-lg bg-cinema-border text-cinema-mutedLight text-xs font-bold disabled:opacity-50">
                  Join
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {profile?.group && screen !== "join" && (
        <div className="flex gap-1 px-5 pt-3 overflow-x-auto">
          {[
            { id: "swipe", label: "Swipe", icon: Heart },
            { id: "matches", label: `Matches (${readyToWatch.length})`, icon: Sparkles },
            { id: "solo-watch", label: `Solo Watch (${myYes.filter((m) => !fullFamilyMatchIds.has(m.id)).length})`, icon: Bookmark },
            { id: "history", label: "My Votes", icon: Clock },
            { id: "family-picks", label: "Family Picks", icon: Compass },
            { id: "group", label: "Family", icon: Users },
            { id: "setup", label: "Settings", icon: Settings },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setScreen(t.id)}
              className={"flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-bold whitespace-nowrap " + (screen === t.id ? "bg-cinema-panel text-cinema-gold" : "text-cinema-muted hover:text-cinema-mutedLight")}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-5 max-w-2xl mx-auto">
        {error && <div className="mb-4 px-4 py-2 rounded-lg bg-cinema-orange/15 border border-cinema-orange text-cinema-orangeLight text-sm">{error}</div>}

        {screen === "dob" && (
          <div className="max-w-sm mx-auto py-8">
            <h2 className="text-xl text-cinema-gold mb-2" style={displayFont}>One quick thing first</h2>
            <p className="text-cinema-muted mb-5 text-sm">We ask everyone's date of birth so we can keep content age-appropriate.</p>
            <label className="text-xs font-bold text-cinema-muted uppercase tracking-wide">Date of birth</label>
            <input
              type="date"
              value={dobInput}
              onChange={(e) => setDobInput(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full mt-1 mb-2 px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold"
            />
            {dobError && <p className="text-cinema-orangeLight text-xs mb-3">{dobError}</p>}
            <button onClick={submitDob} className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">
              Continue
            </button>
          </div>
        )}

        {screen === "parent-consent" && (
          <div className="max-w-sm mx-auto py-8">
            {!parentConsentSent ? (
              <>
                <h2 className="text-xl text-cinema-gold mb-2" style={displayFont}>Almost there</h2>
                <p className="text-cinema-muted mb-5 text-sm">
                  Since you're under 13, we need a parent or guardian to approve your account. You can start using the app
                  right away with G-rated titles only — full access unlocks once they approve.
                </p>
                <label className="text-xs font-bold text-cinema-muted uppercase tracking-wide">Parent/guardian email</label>
                <input
                  type="email"
                  value={parentEmailInput}
                  onChange={(e) => setParentEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitParentConsent()}
                  placeholder="parent@example.com"
                  className="w-full mt-1 mb-2 px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold"
                />
                {parentConsentError && <p className="text-cinema-orangeLight text-xs mb-3">{parentConsentError}</p>}
                <button
                  onClick={submitParentConsent}
                  disabled={parentConsentBusy}
                  className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight disabled:opacity-50"
                >
                  {parentConsentBusy ? "Sending…" : "Send request & continue"}
                </button>
                <p className="text-[11px] text-cinema-mutedDark mt-3">
                  We won't collect anything beyond this email until they approve.
                </p>
              </>
            ) : (
              <div className="text-center">
                <h2 className="text-xl text-cinema-gold mb-2" style={displayFont}>Request sent!</h2>
                <p className="text-cinema-muted mb-5 text-sm">
                  We emailed {parentEmailInput} for approval. You can keep going now — everything's limited to G-rated
                  titles until they approve.
                </p>
                <button onClick={() => setScreen("join")} className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">
                  Continue
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "join" && (
          <div className="max-w-sm mx-auto py-8">
            <p className="text-cinema-muted mb-6 text-sm">Signed in as {displayName}. Create a family group, or join one with a shared code.</p>
            <label className="text-xs font-bold text-cinema-muted uppercase tracking-wide">Family group code</label>
            <div className="flex gap-2 mt-1 mb-2">
              <input value={groupInput} onChange={(e) => setGroupInput(e.target.value.toUpperCase())} placeholder="e.g. THOMPSONS" className="flex-1 px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold" />
              <button onClick={randomCode} className="px-3 py-2 rounded-lg bg-cinema-panel text-cinema-mutedLight text-xs font-bold hover:bg-cinema-border">New</button>
            </div>
            <p className="text-xs text-cinema-mutedDark mb-5">Share this exact code with whoever you want to match with.</p>
            <button onClick={handleJoin} className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">Join family group</button>
          </div>
        )}

        {screen === "setup" && profile?.group && (
          <div className="max-w-lg mx-auto pb-6">
            <h2 className="text-xl text-cinema-gold mb-4" style={displayFont}>
              {roomMeta?.type === "movie-night" ? "Set up for this Movie Night" : "Your streaming setup"}
            </h2>
            {roomMeta?.type !== "movie-night" && !profile?.isMinor && (
              <div className="mb-5">
                <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Your role in this family</div>
                <div className="flex gap-2">
                  <Chip
                    active={roleInput === "parent"}
                    onClick={() => !roleLockedForMe && setRoleInput("parent")}
                  >
                    Parent{roleLockedForMe ? " 🔒" : ""}
                  </Chip>
                  <Chip active={roleInput === "child"} onClick={() => setRoleInput("child")}>Child</Chip>
                </div>
                {roleLockedForMe && (
                  <p className="text-[11px] text-cinema-mutedDark mt-1">
                    This family already has a parent — ask them to promote you from the Family tab.
                  </p>
                )}
              </div>
            )}
            {isPendingMinor && (
              <div className="mb-5 px-3 py-2 rounded-lg bg-cinema-gold/15 border border-cinema-gold text-xs text-cinema-gold">
                Your account is waiting on parent approval — you'll see G-rated titles only until then.
              </div>
            )}
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Region</div>
              <div className="flex gap-2">
                <Chip active={regionInput === "CA"} onClick={() => setRegionInput("CA")}>Canada</Chip>
                <Chip active={regionInput === "US"} onClick={() => setRegionInput("US")}>United States</Chip>
                <Chip active={regionInput === "GB"} onClick={() => setRegionInput("GB")}>United Kingdom</Chip>
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Services you're subscribed to</div>
              <div className="flex flex-wrap gap-2">{availableProviders.map((s) => <Chip key={s.id} active={servicesInput.includes(s.id)} onClick={() => toggleService(s.id)}>{s.name}</Chip>)}</div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Going out to the movies?</div>
              <Chip active={wantsTheatersInput} onClick={() => setWantsTheatersInput((v) => !v)}>
                🎬 Include what's currently in theaters
              </Chip>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Genres you like</div>
              <div className="flex flex-wrap gap-2">{GENRES.map((g) => <Chip key={g.id} active={genresInput.includes(g.id)} onClick={() => toggleGenre(g.id)}>{g.name}</Chip>)}</div>
            </div>
            {roomMeta?.type !== "movie-night" && !isPendingMinor && (
            <div className="mb-6">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">All-time favorite movies (optional)</div>
              <div className="relative mb-2">
                <div className="flex gap-2">
                  <input
                    value={favInput}
                    onChange={(e) => setFavInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFavorite()}
                    placeholder="Search a title…"
                    className="flex-1 px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold"
                  />
                  <button onClick={addFavorite} className="px-3 py-2 rounded-lg bg-cinema-panel text-cinema-mutedLight text-xs font-bold">Add as typed</button>
                </div>
                {favInput.trim().length >= 2 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-cinema-panel border border-cinema-border rounded-lg overflow-hidden shadow-xl">
                    {favSearching && <div className="px-3 py-2 text-xs text-cinema-muted">Searching…</div>}
                    {!favSearching && favSuggestions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-cinema-muted">No matches — "Add as typed" will use it exactly as written.</div>
                    )}
                    {!favSearching &&
                      favSuggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => addFavoriteTitle(s.title)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-cinema-border"
                        >
                          {s.poster_path ? (
                            <img src={`https://image.tmdb.org/t/p/w92${s.poster_path}`} className="w-8 h-11 object-cover rounded flex-shrink-0" alt={s.title} />
                          ) : (
                            <div className="w-8 h-11 bg-cinema-border rounded flex-shrink-0" />
                          )}
                          <span className="text-sm text-stone-50 font-bold">
                            {s.title} {s.year && <span className="text-cinema-muted font-normal">({s.year})</span>}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {favorites.map((f, i) => (
                  <span key={i} className="pl-3 pr-1 py-1 rounded-full bg-cinema-panel text-xs text-cinema-mutedLight flex items-center gap-1">
                    <Star className="w-3 h-3 text-cinema-gold" /> {f}
                    <button onClick={() => removeFavorite(f)} className="ml-1 w-4 h-4 rounded-full hover:bg-cinema-orange/30 flex items-center justify-center" aria-label={`Remove ${f}`}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
            )}
            <button onClick={handleSaveSetup} className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">Save settings</button>
          </div>
        )}

        {screen === "swipe" && profile?.group && (
          <div className="max-w-sm mx-auto">
            {myMaxRating && (
              <div className="text-center text-[11px] font-bold text-cinema-gold mb-2">
                Showing movies rated {myMaxRating} and under
              </div>
            )}
            {!pool && (
              <div className="text-center py-10">
                <p className="text-cinema-muted mb-4 text-sm">No movie list yet for this group. Pull one in based on everyone's services and genres.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight disabled:opacity-50 inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> {fetchingPool ? "Fetching…" : "Find movies for us"}
                </button>
              </div>
            )}
            {pool && !currentMovie && ratingCheckPending && (
              <div className="text-center py-10">
                <p className="text-cinema-muted text-sm">Checking ratings on a few more titles…</p>
              </div>
            )}
            {pool && currentMovie && (
              <div>
                <div className="text-center text-xs text-cinema-mutedDark mb-2 font-bold">{deck.length} left in your stack</div>
                <div
                  ref={cardRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerEnd}
                  onPointerCancel={onPointerEnd}
                  style={{
                    transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
                    transition: draggingRef.current ? "none" : "transform 0.2s ease",
                    touchAction: "pan-y",
                  }}
                  className="rounded-2xl bg-cinema-card text-cinema-ink overflow-hidden shadow-xl cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="relative w-full aspect-[2/3] bg-stone-200">
                    {isNewRelease(currentMovie.release_date) && <NewBadge />}
                    {currentMovie._inTheaters && <TheaterBadge />}
                    {currentMovie.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`} alt={currentMovie.title} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-cinema-mutedDark">No poster</div>
                    )}
                    {dragX < 0 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ opacity: Math.min(1, Math.abs(dragX) / 100) }}
                      >
                        <X className="w-40 h-40 text-cinema-orange -rotate-12" strokeWidth={4} style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
                      </div>
                    )}
                    {dragX > 0 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ opacity: Math.min(1, Math.abs(dragX) / 100) }}
                      >
                        <Heart className="w-40 h-40 text-cinema-green rotate-12" fill="currentColor" style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }} />
                      </div>
                    )}
                    <button
                      onClick={() => commitSwipe("no")}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-cinema-orange/80 text-white flex items-center justify-center backdrop-blur-sm"
                      aria-label="No"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => commitSwipe("yes")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-cinema-green/80 text-white flex items-center justify-center backdrop-blur-sm"
                      aria-label="Yes"
                    >
                      <Heart className="w-5 h-5" />
                    </button>
                    <button
                      onClick={markSeen}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white text-xs font-bold backdrop-blur-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Already seen it
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="font-extrabold text-lg leading-snug">{currentMovie.title}</div>
                    {currentMovieNudges.length > 0 && (
                      <div className="text-xs text-cinema-gold font-bold mb-1">
                        {currentMovieNudges.map((n) => n.byName).join(", ")} want{currentMovieNudges.length === 1 ? "s" : ""} to watch this
                      </div>
                    )}
                    {currentMovie._because && (
                      <div className="text-xs text-cinema-orange font-bold mb-1">Because {currentMovie._becauseName || "your family"} liked {currentMovie._because}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">{genreNames(currentMovie.genre_ids).map((g) => <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-cinema-ink/10 text-cinema-ink font-bold">{g}</span>)}</div>
                    <DetailsRow movie={currentMovie} certifications={certifications} setCertifications={setCertifications} />
                    <p className="text-sm text-cinema-ink leading-snug">{currentMovie.overview}</p>
                    {trailers[currentMovie.id] && (
                      <a href={`https://www.youtube.com/watch?v=${trailers[currentMovie.id]}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-cinema-orange hover:text-cinema-orangeLight">
                        <Play className="w-4 h-4" /> Watch trailer
                      </a>
                    )}
                    <SpotlightControl movieId={currentMovie.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} hideLabel={currentMovieNudges.length > 0} />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-cinema-mutedDark">
                  <span>← swipe or tap for no</span>
                  <span>swipe or tap for yes →</span>
                </div>
                <div className="flex justify-center mt-2">
                  <button
                    onClick={skipCurrent}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-cinema-panel border border-cinema-border text-cinema-mutedLight hover:border-cinema-gold"
                  >
                    ⏭ Skip for now — review later
                  </button>
                </div>
              </div>
            )}
            {pool && !currentMovie && !ratingCheckPending && (
              <div className="text-center py-10">
                <p className="text-cinema-muted mb-4 text-sm">You've swiped through the whole stack. Check Matches, or pull a fresh batch.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-cinema-panel text-stone-50 font-bold hover:bg-cinema-border inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> Get a new batch
                </button>
              </div>
            )}
          </div>
        )}

        {["matches", "history", "solo-watch"].includes(screen) && <BackToTopButton />}

        {screen === "matches" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border-2 border-cinema-gold bg-cinema-panel p-4 mb-5">
              <div className="flex justify-center gap-2 mb-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cinema-gold" />)}</div>
              <h2 className="text-center text-2xl text-cinema-gold" style={displayFont}>Match Marquee</h2>
              <div className="flex justify-center gap-2 mt-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cinema-gold" />)}</div>
            </div>

            {roomMeta?.type === "movie-night" && instantMatches.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">
                  Already agree — no swiping needed
                </h2>
                <p className="text-[11px] text-cinema-mutedDark mb-2">
                  You've both already said yes to these before, in any family or Movie Night.
                </p>
                <div className="space-y-3">
                  {instantMatches.filter(passesRatingFilter).map(renderMatchCard)}
                </div>
              </div>
            )}

            {otherMembers.length > 0 && (
              <div className="mb-5">
                <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Matching with</div>
                <div className="flex flex-wrap gap-2">
                  {otherMembers.map((m) => (
                    <Chip key={m.email} active={consideredEmails.includes(m.email)} onClick={() => toggleMatchWith(m.email)}>
                      {m.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {readyToWatch.length > 0 && (
              <FilterSortBar
                sort={matchesSort}
                setSort={setMatchesSort}
                genreFilter={matchesGenreFilter}
                setGenreFilter={setMatchesGenreFilter}
                castQuery={matchesCastQuery}
                setCastQuery={setMatchesCastQuery}
                availabilityFilter={matchesAvailabilityFilter}
                setAvailabilityFilter={setMatchesAvailabilityFilter}
                sortOptions={["year", "score", "title"]}
              />
            )}

            {consideredEmails.length === 0 && otherMembers.length > 0 && (
              <p className="text-cinema-muted text-sm text-center py-6">Select at least one family member above to see matches. Looking for your own personal list? Check My Votes.</p>
            )}

            {consideredEmails.length > 0 && readyToWatch.length === 0 && (
              <p className="text-cinema-muted text-sm text-center py-6">No shared picks yet with this group — keep swiping.</p>
            )}

            {readyToWatch.length > 0 && visibleMatches.length === 0 && (
              <p className="text-cinema-muted text-sm text-center py-6">Nothing matches those filters.</p>
            )}

            {visibleMatchesAll.length > 0 && (
              <div className="space-y-3">
                {visibleMatchesAll.map(renderMatchCard)}
              </div>
            )}

            {visibleMatchesSome.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-cinema-gold uppercase tracking-wide mb-2">
                  Partial genre matches
                </h3>
                <p className="text-[11px] text-cinema-mutedDark mb-2">Match some, but not all, of your selected genres.</p>
                <div className="space-y-3">
                  {visibleMatchesSome.map(renderMatchCard)}
                </div>
              </div>
            )}

            {(everyoneMatches.length > 0 || perMemberMatches.some((p) => p.movies.length > 0)) && (
              <div className="mt-8 pt-6 border-t-2 border-cinema-border">
                <h2 className="text-lg font-medium text-cinema-gold mb-4" style={displayFont}>
                  OTHER MATCHES IN YOUR FAMILY
                </h2>

                {everyoneMatches.length > 0 && (
                  <div className="mb-6 pb-6 border-b border-cinema-border last:border-b-0 last:pb-0 last:mb-0">
                    <h3 className="text-base font-semibold text-cinema-gold uppercase tracking-wide mb-2">Everyone</h3>
                    <div className="space-y-3">{everyoneMatches.map(renderMatchCard)}</div>
                  </div>
                )}

                {perMemberMatches
                  .filter((p) => p.movies.length > 0)
                  .map((p) => (
                    <div key={p.member.email} className="mb-6 pb-6 border-b border-cinema-border last:border-b-0 last:pb-0 last:mb-0">
                      <h3 className="text-base font-semibold text-cinema-gold uppercase tracking-wide mb-2">You & {p.member.name}</h3>
                      <div className="space-y-3">{p.movies.map(renderMatchCard)}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {screen === "history" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-cinema-mutedDark mb-3">Everything you've swiped on. Change your mind any time.</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {[
                { key: "all", label: "All" },
                { key: "yes", label: `Yes (${myYes.length})` },
                { key: "no", label: `No (${myNo.length})` },
                { key: "seen", label: `Seen (${myWatched.length})` },
                { key: "review-later", label: `Review Later (${reviewLaterMovies.length})` },
              ].map((s) => (
                <Chip key={s.key} active={historyStatusFilter === s.key} onClick={() => setHistoryStatusFilter(s.key)}>
                  {s.label}
                </Chip>
              ))}
            </div>

            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search your votes…"
              className="w-full px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold mb-4"
            />

            <FilterSortBar
              sort={historySort}
              setSort={setHistorySort}
              genreFilter={historyGenreFilter}
              setGenreFilter={setHistoryGenreFilter}
              castQuery={historyCastQuery}
              setCastQuery={setHistoryCastQuery}
              availabilityFilter={historyAvailabilityFilter}
              setAvailabilityFilter={setHistoryAvailabilityFilter}
              sortOptions={["year", "score", "title"]}
            />

            {(historyStatusFilter === "all" || historyStatusFilter === "yes") && (
              <>
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">
                  Yes ({visibleYesInVotes.length})
                </h2>
                <div className="space-y-3 mb-6">
                  {visibleYesInVotes.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing here yet.</p>}
                  {visibleYesInVotes.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{m.title}</div>
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                        <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                        <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                        <VoteSwitcher current="yes" onSet={(choice) => castVote(m.id, choice)} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(historyStatusFilter === "all" || historyStatusFilter === "seen") && (
              <>
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">
                  Seen ({visibleSeen.length})
                </h2>
                <p className="text-[11px] text-cinema-mutedDark mb-2">Movies you've marked as already seen.</p>
                <div className="space-y-3 mb-6">
                  {visibleSeen.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing here yet.</p>}
                  {visibleSeen.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{m.title}</div>
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                        <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                        <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                        <VoteSwitcher current="seen" onSet={(choice) => castVote(m.id, choice)} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(historyStatusFilter === "all" || historyStatusFilter === "no") && (
              <>
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">
                  No ({visibleNoInVotes.length})
                </h2>
                <div className="space-y-3 mb-6">
                  {visibleNoInVotes.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing here yet.</p>}
                  {visibleNoInVotes.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel/60 rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{m.title}</div>
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                        <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                        <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                        <VoteSwitcher current="no" onSet={(choice) => castVote(m.id, choice)} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {(historyStatusFilter === "all" || historyStatusFilter === "review-later") && (
              <>
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">
                  Review Later ({visibleReviewLater.length})
                </h2>
                <p className="text-[11px] text-cinema-mutedDark mb-2">Movies you skipped to decide on later — still no vote cast.</p>
                <div className="space-y-3">
                  {visibleReviewLater.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing here yet.</p>}
                  {visibleReviewLater.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold">{m.title}</div>
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                        <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                        <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                        <VoteSwitcher onSet={(choice) => castVote(m.id, choice)} />
                        <button
                          onClick={() => unskipMovie(m.id)}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-cinema-border text-cinema-muted hover:border-cinema-mutedLight mt-1"
                        >
                          Remove from review list
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {screen === "solo-watch" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-cinema-mutedDark mb-3">You said yes, but at least one other family member hasn't — these are ones to watch on your own.</p>

            <input
              value={soloSearch}
              onChange={(e) => setSoloSearch(e.target.value)}
              placeholder="Search your solo watch list…"
              className="w-full px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold mb-4"
            />

            {visibleSoloWatch.length > 0 && (
              <FilterSortBar
                sort={soloSort}
                setSort={setSoloSort}
                genreFilter={soloGenreFilter}
                setGenreFilter={setSoloGenreFilter}
                castQuery={soloCastQuery}
                setCastQuery={setSoloCastQuery}
                availabilityFilter={soloAvailabilityFilter}
                setAvailabilityFilter={setSoloAvailabilityFilter}
                sortOptions={["year", "score", "title"]}
              />
            )}

            <div className="space-y-3">
              {visibleSoloWatch.length === 0 && <p className="text-cinema-muted text-sm text-center py-6">Nothing here yet.</p>}
              {visibleSoloAll.map(renderSoloCard)}
            </div>

            {visibleSoloSome.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-semibold text-cinema-gold uppercase tracking-wide mb-2">
                  Partial genre matches
                </h3>
                <p className="text-[11px] text-cinema-mutedDark mb-2">Match some, but not all, of your selected genres.</p>
                <div className="space-y-3">
                  {visibleSoloSome.map(renderSoloCard)}
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "family-picks" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-cinema-mutedDark mb-4">What everyone else in the family has said yes to.</p>
            {spotlight.length > 0 && (
              <>
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">Recommended to the family</h2>
                <div className="space-y-3 mb-6">
                  {Array.from(new Set(spotlight.map((s) => s.movieId)))
                    .map((mid) => (pool ? pool.movies.find((m) => m.id === mid) : null))
                    .filter(Boolean)
                    .filter(passesRatingFilter)
                    .filter((m) => !(votes[m.id] || {})[email]) // resolved for you once you've cast any vote — still shows for others who haven't decided
                    .map((m) => {
                      const myVote = (votes[m.id] || {})[email];
                      return (
                        <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-gold/40">
                          {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold">{m.title}</div>
                            <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                            <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                            <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                            <ProviderRow movieId={m.id} region={profile?.region} />
                            <TrailerButton movieId={m.id} />
                            <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                            <div className="text-[11px] text-cinema-muted mt-1">
                              Your vote: {myVote ? myVote : "haven't swiped yet"}
                            </div>
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => castVote(m.id, "yes")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "yes" ? "bg-cinema-green text-cinema-ink border-cinema-green" : "border-cinema-border text-cinema-muted hover:border-cinema-green hover:text-cinema-green")}>Yes</button>
                              <button onClick={() => castVote(m.id, "no")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "no" ? "bg-cinema-orange text-cinema-ink border-cinema-orange" : "border-cinema-border text-cinema-muted hover:border-cinema-orange hover:text-cinema-orange")}>No</button>
                              <button onClick={() => castVote(m.id, "seen")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "seen" ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "border-cinema-border text-cinema-muted hover:border-cinema-gold hover:text-cinema-gold")}>Seen</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {familyYesByMember.map(({ member, movies }) => (
              <div key={member.email} className="mb-6">
                <h2 className="text-lg font-medium text-cinema-gold uppercase tracking-wide mb-2">{member.name} said yes to ({movies.length})</h2>
                {movies.length === 0 && <p className="text-cinema-mutedDark text-sm mb-2">Nothing yet.</p>}
                <div className="space-y-3">
                  {movies.map((m) => {
                    const myVote = (votes[m.id] || {})[email];
                    return (
                      <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                        {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold">{m.title}</div>
                          <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                          <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                          <DetailsRow movie={m} certifications={certifications} setCertifications={setCertifications} />
                          <ProviderRow movieId={m.id} region={profile?.region} />
                          <TrailerButton movieId={m.id} />
                          <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                          <div className="text-[11px] text-cinema-muted mt-1">
                            Your vote: {myVote ? myVote : "haven't swiped yet"}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => castVote(m.id, "yes")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "yes" ? "bg-cinema-green text-cinema-ink border-cinema-green" : "border-cinema-border text-cinema-muted hover:border-cinema-green hover:text-cinema-green")}>Yes</button>
                            <button onClick={() => castVote(m.id, "no")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "no" ? "bg-cinema-orange text-cinema-ink border-cinema-orange" : "border-cinema-border text-cinema-muted hover:border-cinema-orange hover:text-cinema-orange")}>No</button>
                            <button onClick={() => castVote(m.id, "seen")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "seen" ? "bg-cinema-gold text-cinema-ink border-cinema-gold" : "border-cinema-border text-cinema-muted hover:border-cinema-gold hover:text-cinema-gold")}>Seen</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === "group" && (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-xs text-cinema-mutedDark mb-2">Share code <span className="text-cinema-gold font-bold">{activeRoomCode}</span> with anyone else who should join.</p>
            {members.map((m) => (
              <div key={m.email} className="bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full ${avatarColor(m.email)} flex items-center justify-center text-cinema-ink font-extrabold text-sm`}>{m.name?.[0]?.toUpperCase()}</div>
                  <span className="font-extrabold">{m.name}</span>
                  {m.role && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold uppercase">
                      {m.role}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mb-1">{(m.services || []).map((sid) => <span key={sid} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{providerNameMap[sid] || "Unknown"}</span>)}</div>
                <div className="flex flex-wrap gap-1 mb-1">{(m.genres || []).map((gid) => <span key={gid} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-gold/20 text-cinema-gold font-bold">{GENRES.find((g) => g.id === gid)?.name}</span>)}</div>
                {m.favorites?.length > 0 && <div className="text-xs text-cinema-muted mt-1">Favorites: {m.favorites.join(", ")}</div>}
                {myMember?.role === "parent" && m.email !== email && (
                  <div className="mt-2 pt-2 border-t border-cinema-border flex items-center gap-2">
                    <span className="text-xs font-bold text-cinema-muted">Role:</span>
                    <select
                      value={m.role || "child"}
                      onChange={(e) => setMemberRole(m, e.target.value)}
                      className="text-xs font-bold px-2 py-1 rounded-lg bg-cinema-bg border border-cinema-border text-stone-50"
                    >
                      <option value="child">Child</option>
                      <option value="parent">Parent</option>
                    </select>
                  </div>
                )}
                {m.role === "child" && (
                  <div className="mt-2 pt-2 border-t border-cinema-border">
                    {myMember?.role === "parent" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cinema-muted">Max rating:</span>
                        <select
                          value={m.maxRating || ""}
                          onChange={(e) => setChildMaxRating(m, e.target.value)}
                          className="text-xs font-bold px-2 py-1 rounded-lg bg-cinema-bg border border-cinema-border text-stone-50"
                        >
                          <option value="">No limit</option>
                          {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-cinema-muted">
                        Max rating: {m.maxRating || "No limit"}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
