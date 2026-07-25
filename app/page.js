"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Heart, X, Users, Settings, Play, Sparkles, Film, LogOut, RefreshCw, Star, Ticket, Eye, Clock, Compass } from "lucide-react";

const SERVICES = [
  { id: 8, name: "Netflix" },
  { id: 9, name: "Prime Video" },
  { id: 337, name: "Disney+" },
  { id: 350, name: "Apple TV+" },
  { id: 230, name: "Crave" },
  { id: 283, name: "Crunchyroll" },
  { id: 531, name: "Paramount+" },
  { id: 1899, name: "Max" },
];

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

function ProviderRow({ movieId, region }) {
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
  if (providers.length === 0) return <div className="text-[11px] text-cinema-mutedDark mt-1">Not currently on any of your services.</div>;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {providers.map((p) => (
        <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-green/20 text-cinema-green font-bold">
          {p.name}
        </span>
      ))}
    </div>
  );
}

function SpotlightControl({ movieId, spotlight, myEmail, onToggle }) {
  const recommenders = spotlight.filter((s) => s.movieId === movieId);
  const mine = recommenders.some((s) => s.byEmail === myEmail);
  return (
    <div className="mt-1">
      {recommenders.length > 0 && (
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
  const [screen, setScreen] = useState("join");
  const [error, setError] = useState("");
  const [fetchingPool, setFetchingPool] = useState(false);
  const [trailers, setTrailers] = useState({});
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [groupInput, setGroupInput] = useState("");
  const [regionInput, setRegionInput] = useState("CA");
  const [roleInput, setRoleInput] = useState("parent");
  const [matchWith, setMatchWith] = useState(null); // null = everyone in the family
  const [servicesInput, setServicesInput] = useState([]);
  const [genresInput, setGenresInput] = useState([]);
  const [favInput, setFavInput] = useState("");
  const [favorites, setFavorites] = useState([]);

  const cardRef = useRef(null);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
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
      if (data.profile) {
        setProfile(data.profile);
        setRegionInput(data.profile.region || "CA");
        setRoleInput(data.profile.role || "parent");
        setServicesInput(data.profile.services || []);
        setGenresInput(data.profile.genres || []);
        setFavorites(data.profile.favorites || []);
        await loadGroup(data.profile.group);
        setScreen(data.profile.services?.length && data.profile.genres?.length ? "swipe" : "setup");
      } else {
        setScreen("join");
      }
      setLoadingProfile(false);
    })();
  }, [status, email]);

  const loadGroup = useCallback(async (code) => {
    if (!code) return;
    const res = await fetch(`/api/group?code=${encodeURIComponent(code)}`);
    const data = await res.json();
    setMembers(data.members || []);
    setPool(data.pool || null);
    setVotes(data.votes || {});
    setSpotlight(data.spotlight || []);
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
    await loadGroup(group);
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
  function addFavorite() {
    const v = favInput.trim();
    if (!v) return;
    setFavorites((f) => [...f, v]);
    setFavInput("");
  }

  async function handleSaveSetup() {
    setError("");
    if (!servicesInput.length) return setError("Pick at least one streaming service.");
    if (!genresInput.length) return setError("Pick at least one genre you're into.");
    const merged = await saveProfile({ region: regionInput, role: roleInput, services: servicesInput, genres: genresInput, favorites });
    await saveMember(merged.group, { name: displayName, email, role: roleInput, services: servicesInput, genres: genresInput, favorites });
    setScreen("swipe");
  }

  async function fetchPool() {
    if (!profile) return;
    setFetchingPool(true);
    setError("");
    try {
      // re-fetch the latest shared pool first, so we merge onto whatever
      // teammates have already added rather than clobbering it
      const latest = await fetch(`/api/group?code=${encodeURIComponent(profile.group)}`).then((r) => r.json());
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

      // seed additional picks from everyone's favorite movies
      const allFavorites = Array.from(new Set(members.flatMap((m) => m.favorites || []).concat(profile.favorites || [])));
      if (allFavorites.length) {
        try {
          const recRes = await fetch(`/api/recommendations?titles=${encodeURIComponent(allFavorites.join("|"))}&region=${profile.region || "CA"}`);
          const recData = await recRes.json();
          fetched = fetched.concat(recData.results || []);
        } catch {
          // recommendations are a bonus — don't block the whole fetch if this fails
        }
      }

      // merge: keep every movie anyone has ever seen in this group's pool
      // (so votes/matches on them stay valid) and add anything new
      const byId = new Map(existingMovies.map((m) => [m.id, m]));
      for (const m of fetched) if (!byId.has(m.id)) byId.set(m.id, m);
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
        body: JSON.stringify({ code: profile.group, type: "pool", payload: newPool }),
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

  const myVotedIds = useMemo(() => {
    const ids = new Set();
    Object.entries(votes).forEach(([mid, byEmail]) => {
      if (email && byEmail[email]) ids.add(Number(mid));
    });
    return ids;
  }, [votes, email]);

  const deck = useMemo(() => (pool ? pool.movies.filter((m) => !myVotedIds.has(m.id)) : []), [pool, myVotedIds]);
  const currentMovie = deck[0];

  async function castVote(movieId, choice) {
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: profile.group, type: "vote", payload: { movieId, name: email, choice } }),
    });
    const data = await res.json();
    setVotes(data.votes || {});
  }

  function isSpotlightedByMe(movieId) {
    return spotlight.some((s) => s.movieId === movieId && s.byEmail === email);
  }

  async function toggleSpotlight(movieId) {
    const action = isSpotlightedByMe(movieId) ? "remove" : "add";
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: profile.group, type: "spotlight", payload: { movieId, byEmail: email, byName: displayName, action } }),
    });
    const data = await res.json();
    setSpotlight(data.spotlight || []);
  }

  function commitSwipe(choice) {
    if (!currentMovie || animating) return;
    setAnimating(true);
    setDragX(choice === "yes" ? 500 : -500);
    setTimeout(() => {
      castVote(currentMovie.id, choice);
      setDragX(0);
      setAnimating(false);
    }, 200);
  }

  function markSeen() {
    if (!currentMovie || animating) return;
    castVote(currentMovie.id, "seen");
  }

  function onPointerDown(e) {
    if (animating) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!draggingRef.current) return;
    e.preventDefault();
    setDragX(e.clientX - startXRef.current);
  }
  function onPointerEnd(e) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
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
    if (!pool || !consideredMembers.length) return [];
    return pool.movies.filter((m) => votesFor(m).every((v) => v === "yes"));
    // eslint-disable-next-line
  }, [pool, votes, members, matchWith, email]);

  const alreadySeen = useMemo(() => {
    if (!pool || !consideredMembers.length) return [];
    return pool.movies.filter((m) => {
      const vs = votesFor(m);
      return vs.every((v) => v === "yes" || v === "seen") && vs.some((v) => v === "seen");
    });
    // eslint-disable-next-line
  }, [pool, votes, members, matchWith, email]);

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
      movies: pool.movies.filter((mv) => (votes[mv.id] || {})[m.email] === "yes"),
    }));
    // eslint-disable-next-line
  }, [pool, votes, members]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-cinema-bg text-cinema-gold" style={bodyFont}>Loading…</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cinema-bg text-stone-50" style={bodyFont}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Film className="w-8 h-8 text-cinema-gold" />
            <span className="text-3xl text-cinema-gold" style={displayFont}>Family Movie Match</span>
          </div>
          <p className="text-cinema-muted mb-6 max-w-xs mx-auto text-sm">Sign in with Google to link up with your family and start swiping.</p>
          <button onClick={() => signIn("google")} className="px-6 py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">Sign in with Google</button>
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
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-cinema-border/60">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-cinema-gold" />
          <span className="text-2xl text-cinema-gold" style={displayFont}>Family Movie Match</span>
        </div>
        <div className="flex items-center gap-3">
          {profile?.group && <span className="text-xs text-cinema-muted font-bold hidden sm:inline">Family {profile.group}</span>}
          <button onClick={() => signOut()} className="text-cinema-muted hover:text-cinema-gold" title="Sign out"><LogOut className="w-4 h-4" /></button>
        </div>
      </div>

      {profile?.group && screen !== "join" && (
        <div className="flex gap-1 px-5 pt-3 overflow-x-auto">
          {[
            { id: "swipe", label: "Swipe", icon: Heart },
            { id: "matches", label: `Matches (${readyToWatch.length + alreadySeen.length})`, icon: Sparkles },
            { id: "seen", label: `Seen (${myWatched.length})`, icon: Eye },
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
            <h2 className="text-xl text-cinema-gold mb-4" style={displayFont}>Your streaming setup</h2>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Your role in this family</div>
              <div className="flex gap-2">
                <Chip active={roleInput === "parent"} onClick={() => setRoleInput("parent")}>Parent</Chip>
                <Chip active={roleInput === "child"} onClick={() => setRoleInput("child")}>Child</Chip>
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Region</div>
              <div className="flex gap-2">
                <Chip active={regionInput === "CA"} onClick={() => setRegionInput("CA")}>Canada</Chip>
                <Chip active={regionInput === "US"} onClick={() => setRegionInput("US")}>United States</Chip>
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Services you're subscribed to</div>
              <div className="flex flex-wrap gap-2">{SERVICES.map((s) => <Chip key={s.id} active={servicesInput.includes(s.id)} onClick={() => toggleService(s.id)}>{s.name}</Chip>)}</div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">Genres you like</div>
              <div className="flex flex-wrap gap-2">{GENRES.map((g) => <Chip key={g.id} active={genresInput.includes(g.id)} onClick={() => toggleGenre(g.id)}>{g.name}</Chip>)}</div>
            </div>
            <div className="mb-6">
              <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">All-time favorite movies (optional)</div>
              <div className="flex gap-2 mb-2">
                <input value={favInput} onChange={(e) => setFavInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFavorite()} placeholder="Add a title…" className="flex-1 px-3 py-2 rounded-lg bg-cinema-panel border border-cinema-border text-stone-50 outline-none focus:border-cinema-gold" />
                <button onClick={addFavorite} className="px-3 py-2 rounded-lg bg-cinema-panel text-cinema-mutedLight text-xs font-bold">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">{favorites.map((f, i) => <span key={i} className="px-3 py-1 rounded-full bg-cinema-panel text-xs text-cinema-mutedLight flex items-center gap-1"><Star className="w-3 h-3 text-cinema-gold" /> {f}</span>)}</div>
            </div>
            <button onClick={handleSaveSetup} className="w-full py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight">Save settings</button>
          </div>
        )}

        {screen === "swipe" && profile?.group && (
          <div className="max-w-sm mx-auto">
            {!pool && (
              <div className="text-center py-10">
                <p className="text-cinema-muted mb-4 text-sm">No movie list yet for this group. Pull one in based on everyone's services and genres.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-cinema-gold text-cinema-ink font-extrabold hover:bg-cinema-goldLight disabled:opacity-50 inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> {fetchingPool ? "Fetching…" : "Find movies for us"}
                </button>
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
                    touchAction: "none",
                  }}
                  className="rounded-2xl bg-cinema-card text-cinema-ink overflow-hidden shadow-xl cursor-grab active:cursor-grabbing select-none"
                >
                  <div className="relative w-full aspect-[2/3] bg-stone-200">
                    {isNewRelease(currentMovie.release_date) && <NewBadge />}
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
                        <div className="w-24 h-24 rounded-full bg-cinema-orange/90 flex items-center justify-center shadow-lg -rotate-12">
                          <X className="w-14 h-14 text-white" strokeWidth={3} />
                        </div>
                      </div>
                    )}
                    {dragX > 0 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{ opacity: Math.min(1, Math.abs(dragX) / 100) }}
                      >
                        <div className="w-24 h-24 rounded-full bg-cinema-green/90 flex items-center justify-center shadow-lg rotate-12">
                          <Heart className="w-14 h-14 text-white" fill="white" />
                        </div>
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
                    {currentMovie._because && (
                      <div className="text-xs text-cinema-orange font-bold mb-1">Because you liked {currentMovie._because}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">{genreNames(currentMovie.genre_ids).map((g) => <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-cinema-ink/10 text-cinema-ink font-bold">{g}</span>)}</div>
                    <p className="text-sm text-cinema-ink leading-snug">{currentMovie.overview}</p>
                    {trailers[currentMovie.id] && (
                      <a href={`https://www.youtube.com/watch?v=${trailers[currentMovie.id]}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-cinema-orange hover:text-cinema-orangeLight">
                        <Play className="w-4 h-4" /> Watch trailer
                      </a>
                    )}
                    <SpotlightControl movieId={currentMovie.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                  </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-cinema-mutedDark">
                  <span>← swipe or tap for no</span>
                  <span>swipe or tap for yes →</span>
                </div>
              </div>
            )}
            {pool && !currentMovie && (
              <div className="text-center py-10">
                <p className="text-cinema-muted mb-4 text-sm">You've swiped through the whole stack. Check Matches, or pull a fresh batch.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-cinema-panel text-stone-50 font-bold hover:bg-cinema-border inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> Get a new batch
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "matches" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border-2 border-cinema-gold bg-cinema-panel p-4 mb-5">
              <div className="flex justify-center gap-2 mb-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cinema-gold" />)}</div>
              <div className="text-center text-2xl text-cinema-gold" style={displayFont}>Match Marquee</div>
              <div className="flex justify-center gap-2 mt-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-cinema-gold" />)}</div>
            </div>

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

            {readyToWatch.length === 0 && alreadySeen.length === 0 && (
              <p className="text-cinema-muted text-sm text-center py-6">No shared picks yet with this group — keep swiping.</p>
            )}

            {readyToWatch.length > 0 && (
              <>
                <div className="text-xs font-bold text-cinema-gold uppercase tracking-wide mb-2">New to watch together</div>
                <div className="space-y-3 mb-6">
                  {readyToWatch.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && (
                        <div className="relative flex-shrink-0">
                          {isNewRelease(m.release_date) && <NewBadge />}
                          <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg" alt={m.title} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-extrabold flex items-center gap-1"><Ticket className="w-4 h-4 text-cinema-gold flex-shrink-0" /> {m.title}</div>
                        {m._because && <div className="text-[11px] text-cinema-orange font-bold">Because you liked {m._because}</div>}
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-muted line-clamp-2">{m.overview}</p>
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {alreadySeen.length > 0 && (
              <>
                <div className="text-xs font-bold text-cinema-mutedDark uppercase tracking-wide mb-2">Already seen by someone</div>
                <div className="space-y-3 opacity-80">
                  {alreadySeen.map((m) => (
                    <div key={m.id} className="flex gap-3 bg-cinema-panel/60 rounded-xl p-3 border border-cinema-border">
                      {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                      <div className="min-w-0">
                        <div className="font-extrabold flex items-center gap-1"><Ticket className="w-4 h-4 text-cinema-mutedDark flex-shrink-0" /> {m.title}</div>
                        <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                        <p className="text-xs text-cinema-mutedDark line-clamp-2">{m.overview}</p>
                        <ProviderRow movieId={m.id} region={profile?.region} />
                        <TrailerButton movieId={m.id} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {screen === "seen" && (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-xs text-cinema-mutedDark mb-2">Movies you've marked as already seen.</p>
            {myWatched.length === 0 && <p className="text-cinema-muted text-sm text-center py-6">Nothing here yet.</p>}
            {myWatched.map((m) => (
              <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                <div className="min-w-0">
                  <div className="font-extrabold">{m.title}</div>
                  <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {screen === "history" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-cinema-mutedDark mb-4">Everything you've swiped on. Change your mind any time.</p>

            <div className="text-xs font-bold text-cinema-gold uppercase tracking-wide mb-2">You said yes ({myYes.length})</div>
            <div className="space-y-3 mb-6">
              {myYes.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing yet.</p>}
              {myYes.map((m) => (
                <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-border">
                  {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">{m.title}</div>
                    <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                    <TrailerButton movieId={m.id} />
                    <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => castVote(m.id, "no")} className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-cinema-border text-cinema-muted hover:border-cinema-orange hover:text-cinema-orange">Change to no</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-xs font-bold text-cinema-mutedDark uppercase tracking-wide mb-2">You said no ({myNo.length})</div>
            <div className="space-y-3">
              {myNo.length === 0 && <p className="text-cinema-muted text-sm py-2">Nothing yet.</p>}
              {myNo.map((m) => (
                <div key={m.id} className="flex gap-3 bg-cinema-panel/60 rounded-xl p-3 border border-cinema-border">
                  {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold">{m.title}</div>
                    <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{g}</span>)}</div>
                    <TrailerButton movieId={m.id} />
                    <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => castVote(m.id, "yes")} className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-cinema-border text-cinema-muted hover:border-cinema-green hover:text-cinema-green">Change to yes</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "family-picks" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-cinema-mutedDark mb-4">What everyone else in the family has said yes to.</p>
            {spotlight.length > 0 && (
              <>
                <div className="text-xs font-bold text-cinema-gold uppercase tracking-wide mb-2">Recommended to the family</div>
                <div className="space-y-3 mb-6">
                  {Array.from(new Set(spotlight.map((s) => s.movieId)))
                    .map((mid) => (pool ? pool.movies.find((m) => m.id === mid) : null))
                    .filter(Boolean)
                    .map((m) => {
                      const myVote = (votes[m.id] || {})[email];
                      return (
                        <div key={m.id} className="flex gap-3 bg-cinema-panel rounded-xl p-3 border border-cinema-gold/40">
                          {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold">{m.title}</div>
                            <TrailerButton movieId={m.id} />
                            <SpotlightControl movieId={m.id} spotlight={spotlight} myEmail={email} onToggle={toggleSpotlight} />
                            <div className="text-[11px] text-cinema-muted mt-1">
                              Your vote: {myVote ? myVote : "haven't swiped yet"}
                            </div>
                            <div className="flex gap-1 mt-1">
                              <button onClick={() => castVote(m.id, "yes")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "yes" ? "bg-cinema-green text-cinema-ink border-cinema-green" : "border-cinema-border text-cinema-muted hover:border-cinema-green hover:text-cinema-green")}>Yes</button>
                              <button onClick={() => castVote(m.id, "no")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "no" ? "bg-cinema-orange text-cinema-ink border-cinema-orange" : "border-cinema-border text-cinema-muted hover:border-cinema-orange hover:text-cinema-orange")}>No</button>
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
                <div className="text-xs font-bold text-cinema-muted uppercase tracking-wide mb-2">{member.name} said yes to ({movies.length})</div>
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
                          <TrailerButton movieId={m.id} />
                          <div className="text-[11px] text-cinema-muted mt-1">
                            Your vote: {myVote ? myVote : "haven't swiped yet"}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => castVote(m.id, "yes")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "yes" ? "bg-cinema-green text-cinema-ink border-cinema-green" : "border-cinema-border text-cinema-muted hover:border-cinema-green hover:text-cinema-green")}>Yes</button>
                            <button onClick={() => castVote(m.id, "no")} className={"text-[11px] font-bold px-2 py-0.5 rounded-full border " + (myVote === "no" ? "bg-cinema-orange text-cinema-ink border-cinema-orange" : "border-cinema-border text-cinema-muted hover:border-cinema-orange hover:text-cinema-orange")}>No</button>
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
            <p className="text-xs text-cinema-mutedDark mb-2">Share code <span className="text-cinema-gold font-bold">{profile?.group}</span> with anyone else who should join.</p>
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
                <div className="flex flex-wrap gap-1 mb-1">{(m.services || []).map((sid) => <span key={sid} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-border text-cinema-mutedLight font-bold">{SERVICES.find((s) => s.id === sid)?.name}</span>)}</div>
                <div className="flex flex-wrap gap-1 mb-1">{(m.genres || []).map((gid) => <span key={gid} className="text-[10px] px-2 py-0.5 rounded-full bg-cinema-gold/20 text-cinema-gold font-bold">{GENRES.find((g) => g.id === gid)?.name}</span>)}</div>
                {m.favorites?.length > 0 && <div className="text-xs text-cinema-muted mt-1">Favorites: {m.favorites.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
