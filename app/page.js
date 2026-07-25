"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Heart, X, Users, Settings, Play, Sparkles, Film, LogOut, RefreshCw, Star, Ticket } from "lucide-react";

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

const AVATAR_COLORS = ["bg-amber-400", "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400", "bg-orange-400"];
function avatarColor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function genreNames(ids) {
  return (ids || []).map((id) => GENRES.find((g) => g.id === id)?.name).filter(Boolean).slice(0, 3);
}

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-full text-sm font-bold border-2 transition-colors " +
        (active
          ? "bg-amber-400 border-amber-400 text-indigo-950"
          : "bg-transparent border-indigo-700 text-indigo-200 hover:border-amber-400/60")
      }
    >
      {children}
    </button>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const bodyFont = { fontFamily: "'Karla', sans-serif" };
  const displayFont = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };

  const [profile, setProfile] = useState(null); // {group, services, genres, favorites}
  const [members, setMembers] = useState([]);
  const [pool, setPool] = useState(null);
  const [votes, setVotes] = useState({});
  const [screen, setScreen] = useState("join");
  const [error, setError] = useState("");
  const [fetchingPool, setFetchingPool] = useState(false);
  const [trailers, setTrailers] = useState({});
  const [swipeDir, setSwipeDir] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [groupInput, setGroupInput] = useState("");
  const [regionInput, setRegionInput] = useState("CA");
  const [servicesInput, setServicesInput] = useState([]);
  const [genresInput, setGenresInput] = useState([]);
  const [favInput, setFavInput] = useState("");
  const [favorites, setFavorites] = useState([]);

  const email = session?.user?.email;
  const displayName = session?.user?.name || email;

  // load this user's saved profile once signed in
  useEffect(() => {
    if (status !== "authenticated" || !email) return;
    (async () => {
      setLoadingProfile(true);
      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
        setRegionInput(data.profile.region || "CA");
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
    if (!group) {
      setError("Enter a family group code.");
      return;
    }
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
    const merged = await saveProfile({ region: regionInput, services: servicesInput, genres: genresInput, favorites });
    await saveMember(merged.group, { name: displayName, email, services: servicesInput, genres: genresInput, favorites });
    setScreen("swipe");
  }

  async function fetchPool() {
    if (!profile) return;
    setFetchingPool(true);
    setError("");
    try {
      const allServiceIds = Array.from(new Set(members.flatMap((m) => m.services || []).concat(profile.services || [])));
      const allGenreIds = Array.from(new Set(members.flatMap((m) => m.genres || []).concat(profile.genres || [])));
      let movies = [];
      for (let page = 1; page <= 2; page++) {
        const url = `/api/movies?region=${profile.region || "CA"}&providers=${allServiceIds.join("|")}&genres=${allGenreIds.join("|")}&page=${page}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "TMDB request failed");
        movies = movies.concat(data.results || []);
      }
      const seen = new Set();
      movies = movies.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
      for (let i = movies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [movies[i], movies[j]] = [movies[j], movies[i]];
      }
      const newPool = { region: profile.region, providerIds: allServiceIds, genreIds: allGenreIds, movies: movies.slice(0, 40), fetchedAt: Date.now() };
      await fetch("/api/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: profile.group, type: "pool", payload: newPool }),
      });
      setPool(newPool);
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
    setSwipeDir(choice);
    setTimeout(() => setSwipeDir(null), 250);
    const res = await fetch("/api/group", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: profile.group, type: "vote", payload: { movieId, name: email, choice } }),
    });
    const data = await res.json();
    setVotes(data.votes || {});
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

  const matches = useMemo(() => {
    if (!pool || !members.length) return [];
    return pool.movies.filter((m) => members.every((mem) => (votes[m.id] || {})[mem.email] === "yes"));
  }, [pool, votes, members]);

  // ---- render ----
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-950 text-amber-400" style={bodyFont}>
        Loading…
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-950 text-stone-50" style={bodyFont}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Film className="w-8 h-8 text-amber-400" />
            <span className="text-3xl text-amber-400" style={displayFont}>Family Movie Match</span>
          </div>
          <p className="text-indigo-300 mb-6 max-w-xs mx-auto text-sm">
            Sign in with Google to link up with your family and start swiping.
          </p>
          <button
            onClick={() => signIn("google")}
            className="px-6 py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-950 text-amber-400" style={bodyFont}>
        Loading your profile…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-950 text-stone-50" style={bodyFont}>
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-indigo-800/60">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-amber-400" />
          <span className="text-2xl text-amber-400" style={displayFont}>Family Movie Match</span>
        </div>
        <div className="flex items-center gap-3">
          {profile?.group && <span className="text-xs text-indigo-300 font-bold hidden sm:inline">Group {profile.group}</span>}
          <button onClick={() => signOut()} className="text-indigo-300 hover:text-amber-400" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {profile?.group && screen !== "setup" && screen !== "join" && (
        <div className="flex gap-1 px-5 pt-3">
          {[
            { id: "swipe", label: "Swipe", icon: Heart },
            { id: "matches", label: `Matches (${matches.length})`, icon: Sparkles },
            { id: "group", label: "Group", icon: Users },
            { id: "setup", label: "Settings", icon: Settings },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setScreen(t.id)}
              className={"flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-bold " + (screen === t.id ? "bg-indigo-900 text-amber-400" : "text-indigo-300 hover:text-stone-50")}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-5 max-w-2xl mx-auto">
        {error && <div className="mb-4 px-4 py-2 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 text-sm">{error}</div>}

        {screen === "join" && (
          <div className="max-w-sm mx-auto py-8">
            <p className="text-indigo-300 mb-6 text-sm">Signed in as {displayName}. Create a family group, or join one with a shared code.</p>
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Family group code</label>
            <div className="flex gap-2 mt-1 mb-2">
              <input value={groupInput} onChange={(e) => setGroupInput(e.target.value.toUpperCase())} placeholder="e.g. THOMPSONS" className="flex-1 px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400" />
              <button onClick={randomCode} className="px-3 py-2 rounded-lg bg-indigo-800 text-indigo-200 text-xs font-bold hover:bg-indigo-700">New</button>
            </div>
            <p className="text-xs text-indigo-400 mb-5">Share this exact code with whoever you want to match with.</p>
            <button onClick={handleJoin} className="w-full py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300">Join family group</button>
          </div>
        )}

        {screen === "setup" && profile?.group && (
          <div className="max-w-lg mx-auto pb-6">
            <h2 className="text-xl text-amber-400 mb-4" style={displayFont}>Your streaming setup</h2>
            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Region</div>
              <div className="flex gap-2">
                <Chip active={regionInput === "CA"} onClick={() => setRegionInput("CA")}>Canada</Chip>
                <Chip active={regionInput === "US"} onClick={() => setRegionInput("US")}>United States</Chip>
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Services you're subscribed to</div>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((s) => <Chip key={s.id} active={servicesInput.includes(s.id)} onClick={() => toggleService(s.id)}>{s.name}</Chip>)}
              </div>
            </div>
            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Genres you like</div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => <Chip key={g.id} active={genresInput.includes(g.id)} onClick={() => toggleGenre(g.id)}>{g.name}</Chip>)}
              </div>
            </div>
            <div className="mb-6">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">All-time favorite movies (optional)</div>
              <div className="flex gap-2 mb-2">
                <input value={favInput} onChange={(e) => setFavInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addFavorite()} placeholder="Add a title…" className="flex-1 px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400" />
                <button onClick={addFavorite} className="px-3 py-2 rounded-lg bg-indigo-800 text-indigo-200 text-xs font-bold">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {favorites.map((f, i) => <span key={i} className="px-3 py-1 rounded-full bg-indigo-800 text-xs text-stone-100 flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> {f}</span>)}
              </div>
            </div>
            <button onClick={handleSaveSetup} className="w-full py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300">Save & start swiping</button>
          </div>
        )}

        {screen === "swipe" && profile?.group && (
          <div className="max-w-sm mx-auto">
            {!pool && (
              <div className="text-center py-10">
                <p className="text-indigo-300 mb-4 text-sm">No movie list yet for this group. Pull one in based on everyone's services and genres.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> {fetchingPool ? "Fetching…" : "Find movies for us"}
                </button>
              </div>
            )}
            {pool && currentMovie && (
              <div>
                <div className="text-center text-xs text-indigo-400 mb-2 font-bold">{deck.length} left in your stack</div>
                <div className={"rounded-2xl bg-stone-50 text-indigo-950 overflow-hidden shadow-xl transition-all duration-200 " + (swipeDir === "yes" ? "translate-x-8 rotate-3 opacity-60" : swipeDir === "no" ? "-translate-x-8 -rotate-3 opacity-60" : "")}>
                  {currentMovie.poster_path ? (
                    <img src={`https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`} alt={currentMovie.title} className="w-full h-72 object-cover" />
                  ) : (
                    <div className="w-full h-72 bg-indigo-200 flex items-center justify-center text-indigo-500">No poster</div>
                  )}
                  <div className="p-4">
                    <div className="font-extrabold text-lg leading-snug">{currentMovie.title}</div>
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {genreNames(currentMovie.genre_ids).map((g) => <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">{g}</span>)}
                    </div>
                    <p className="text-sm text-indigo-800 leading-snug line-clamp-4">{currentMovie.overview}</p>
                    {trailers[currentMovie.id] && (
                      <a href={`https://www.youtube.com/watch?v=${trailers[currentMovie.id]}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-rose-600 hover:text-rose-700">
                        <Play className="w-4 h-4" /> Watch trailer
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex justify-center gap-6 mt-5">
                  <button onClick={() => castVote(currentMovie.id, "no")} className="w-14 h-14 rounded-full bg-indigo-900 border-2 border-rose-500 text-rose-500 flex items-center justify-center hover:bg-rose-950"><X className="w-6 h-6" /></button>
                  <button onClick={() => castVote(currentMovie.id, "yes")} className="w-14 h-14 rounded-full bg-indigo-900 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center hover:bg-emerald-950"><Heart className="w-6 h-6" /></button>
                </div>
              </div>
            )}
            {pool && !currentMovie && (
              <div className="text-center py-10">
                <p className="text-indigo-300 mb-4 text-sm">You've swiped through the whole stack. Check Matches, or pull a fresh batch.</p>
                <button onClick={fetchPool} disabled={fetchingPool} className="px-5 py-2.5 rounded-lg bg-indigo-800 text-stone-50 font-bold hover:bg-indigo-700 inline-flex items-center gap-2">
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} /> Get a new batch
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "matches" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border-2 border-amber-400 bg-indigo-900 p-4 mb-5">
              <div className="flex justify-center gap-2 mb-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />)}</div>
              <div className="text-center text-2xl text-amber-400" style={displayFont}>Match Marquee</div>
              <div className="flex justify-center gap-2 mt-2">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />)}</div>
            </div>
            {matches.length === 0 && <p className="text-indigo-300 text-sm text-center py-6">No unanimous picks yet — keep swiping.</p>}
            <div className="space-y-3">
              {matches.map((m) => (
                <div key={m.id} className="flex gap-3 bg-indigo-900 rounded-xl p-3 border border-indigo-700">
                  {m.poster_path && <img src={`https://image.tmdb.org/t/p/w200${m.poster_path}`} className="w-16 h-24 object-cover rounded-lg flex-shrink-0" alt={m.title} />}
                  <div className="min-w-0">
                    <div className="font-extrabold flex items-center gap-1"><Ticket className="w-4 h-4 text-amber-400 flex-shrink-0" /> {m.title}</div>
                    <div className="flex flex-wrap gap-1 my-1">{genreNames(m.genre_ids).map((g) => <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 font-bold">{g}</span>)}</div>
                    <p className="text-xs text-indigo-300 line-clamp-2">{m.overview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "group" && (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-xs text-indigo-400 mb-2">Share code <span className="text-amber-400 font-bold">{profile?.group}</span> with anyone else who should join.</p>
            {members.map((m) => (
              <div key={m.email} className="bg-indigo-900 rounded-xl p-3 border border-indigo-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full ${avatarColor(m.email)} flex items-center justify-center text-indigo-950 font-extrabold text-sm`}>{m.name?.[0]?.toUpperCase()}</div>
                  <span className="font-extrabold">{m.name}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">{(m.services || []).map((sid) => <span key={sid} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 font-bold">{SERVICES.find((s) => s.id === sid)?.name}</span>)}</div>
                <div className="flex flex-wrap gap-1 mb-1">{(m.genres || []).map((gid) => <span key={gid} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">{GENRES.find((g) => g.id === gid)?.name}</span>)}</div>
                {m.favorites?.length > 0 && <div className="text-xs text-indigo-300 mt-1">Favorites: {m.favorites.join(", ")}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
