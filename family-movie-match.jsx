import { useState, useEffect, useCallback, useMemo } from "react";
import { Heart, X, Users, Settings, Play, Sparkles, Film, LogOut, RefreshCw, Star, Ticket } from "lucide-react";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Karla:wght@400;500;700;800&display=swap');`;

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
  { id: 16, name: "Kids" },
];

const AVATAR_COLORS = ["bg-amber-400", "bg-rose-400", "bg-emerald-400", "bg-sky-400", "bg-violet-400", "bg-orange-400"];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
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

export default function FamilyMovieMatch() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // {name, group, tmdbKey, region, services, genres, favorites}
  const [members, setMembers] = useState([]);
  const [pool, setPool] = useState(null); // {region, providerIds, genreIds, movies, fetchedAt}
  const [votes, setVotes] = useState({});
  const [screen, setScreen] = useState("join");
  const [error, setError] = useState("");
  const [fetchingPool, setFetchingPool] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [trailers, setTrailers] = useState({});
  const [swipeDir, setSwipeDir] = useState(null);

  // form state for join/setup
  const [nameInput, setNameInput] = useState("");
  const [groupInput, setGroupInput] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [regionInput, setRegionInput] = useState("CA");
  const [servicesInput, setServicesInput] = useState([]);
  const [genresInput, setGenresInput] = useState([]);
  const [favInput, setFavInput] = useState("");
  const [favorites, setFavorites] = useState([]);

  // ---- initial load ----
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get("profile", false);
        if (r && r.value) {
          const p = JSON.parse(r.value);
          setProfile(p);
          setKeyInput(p.tmdbKey || "");
          setRegionInput(p.region || "CA");
          setServicesInput(p.services || []);
          setGenresInput(p.genres || []);
          setFavorites(p.favorites || []);
          await loadGroup(p.group);
          setScreen(p.services?.length && p.genres?.length && p.tmdbKey ? "swipe" : "setup");
        } else {
          setScreen("join");
        }
      } catch {
        setScreen("join");
      }
      setLoading(false);
    })();
  }, []);

  const loadGroup = useCallback(async (code) => {
    try {
      const m = await window.storage.get(`group:${code}:members`, true);
      setMembers(m && m.value ? JSON.parse(m.value) : []);
    } catch {
      setMembers([]);
    }
    try {
      const p = await window.storage.get(`group:${code}:pool`, true);
      setPool(p && p.value ? JSON.parse(p.value) : null);
    } catch {
      setPool(null);
    }
    try {
      const v = await window.storage.get(`group:${code}:votes`, true);
      setVotes(v && v.value ? JSON.parse(v.value) : {});
    } catch {
      setVotes({});
    }
  }, []);

  async function saveProfile(next) {
    const merged = { ...profile, ...next };
    setProfile(merged);
    try {
      await window.storage.set("profile", JSON.stringify(merged), false);
    } catch {}
    return merged;
  }

  async function saveMember(group, memberObj) {
    let list = [];
    try {
      const m = await window.storage.get(`group:${group}:members`, true);
      list = m && m.value ? JSON.parse(m.value) : [];
    } catch {
      list = [];
    }
    const idx = list.findIndex((x) => x.name === memberObj.name);
    if (idx >= 0) list[idx] = memberObj;
    else list.push(memberObj);
    await window.storage.set(`group:${group}:members`, JSON.stringify(list), true);
    setMembers(list);
    return list;
  }

  // ---- join / create group ----
  async function handleJoin() {
    setError("");
    const name = nameInput.trim();
    const group = groupInput.trim().toUpperCase();
    if (!name || !group) {
      setError("Enter your name and a family group code.");
      return;
    }
    const p = await saveProfile({ name, group });
    await loadGroup(group);
    setScreen("setup");
  }

  function randomCode() {
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    setGroupInput(code);
  }

  // ---- setup / preferences ----
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
    if (!keyInput.trim()) {
      setError("A TMDB API key is needed to pull real movie data.");
      return;
    }
    if (!servicesInput.length) {
      setError("Pick at least one streaming service.");
      return;
    }
    if (!genresInput.length) {
      setError("Pick at least one genre you're into.");
      return;
    }
    const next = {
      tmdbKey: keyInput.trim(),
      region: regionInput,
      services: servicesInput,
      genres: genresInput,
      favorites,
    };
    const merged = await saveProfile(next);
    await saveMember(merged.group, {
      name: merged.name,
      services: servicesInput,
      genres: genresInput,
      favorites,
    });
    setScreen("swipe");
  }

  // ---- TMDB pool fetch ----
  async function fetchPool() {
    if (!profile) return;
    setFetchingPool(true);
    setError("");
    try {
      const allServiceIds = Array.from(new Set(members.flatMap((m) => m.services || []).concat(profile.services || [])));
      const allGenreIds = Array.from(new Set(members.flatMap((m) => m.genres || []).concat(profile.genres || [])));
      const providerParam = allServiceIds.join("|");
      const genreParam = allGenreIds.join("|");
      const region = profile.region || "CA";
      let movies = [];
      for (let page = 1; page <= 2; page++) {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${encodeURIComponent(
          profile.tmdbKey
        )}&language=en-US&sort_by=popularity.desc&watch_region=${region}&with_watch_providers=${providerParam}&with_watch_monetization_types=flatrate&with_genres=${genreParam}&vote_count.gte=30&page=${page}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("TMDB request failed — check your API key.");
        const data = await res.json();
        movies = movies.concat(data.results || []);
      }
      // dedupe + shuffle
      const seen = new Set();
      movies = movies.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      for (let i = movies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [movies[i], movies[j]] = [movies[j], movies[i]];
      }
      const newPool = {
        region,
        providerIds: allServiceIds,
        genreIds: allGenreIds,
        movies: movies.slice(0, 40),
        fetchedAt: Date.now(),
      };
      await window.storage.set(`group:${profile.group}:pool`, JSON.stringify(newPool), true);
      setPool(newPool);
      setCardIndex(0);
    } catch (e) {
      setError(e.message || "Couldn't fetch movies. Double check your TMDB API key.");
    }
    setFetchingPool(false);
  }

  // ---- voting ----
  const myVotedIds = useMemo(() => {
    const ids = new Set();
    Object.entries(votes).forEach(([mid, byName]) => {
      if (profile && byName[profile.name]) ids.add(Number(mid));
    });
    return ids;
  }, [votes, profile]);

  const deck = useMemo(() => {
    if (!pool) return [];
    return pool.movies.filter((m) => !myVotedIds.has(m.id));
  }, [pool, myVotedIds]);

  const currentMovie = deck[0];

  async function castVote(movieId, choice) {
    if (!profile) return;
    setSwipeDir(choice);
    setTimeout(() => setSwipeDir(null), 250);
    let current = {};
    try {
      const v = await window.storage.get(`group:${profile.group}:votes`, true);
      current = v && v.value ? JSON.parse(v.value) : {};
    } catch {
      current = {};
    }
    if (!current[movieId]) current[movieId] = {};
    current[movieId][profile.name] = choice;
    await window.storage.set(`group:${profile.group}:votes`, JSON.stringify(current), true);
    setVotes(current);
  }

  async function fetchTrailer(movieId) {
    if (trailers[movieId] || !profile) return;
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${encodeURIComponent(profile.tmdbKey)}`
      );
      const data = await res.json();
      const t = (data.results || []).find((v) => v.site === "YouTube" && v.type === "Trailer") || (data.results || [])[0];
      setTrailers((s) => ({ ...s, [movieId]: t ? t.key : null }));
    } catch {
      setTrailers((s) => ({ ...s, [movieId]: null }));
    }
  }

  useEffect(() => {
    if (currentMovie) fetchTrailer(currentMovie.id);
    // eslint-disable-next-line
  }, [currentMovie?.id]);

  // ---- matches ----
  const matches = useMemo(() => {
    if (!pool || !members.length) return [];
    return pool.movies.filter((m) => {
      const byName = votes[m.id] || {};
      return members.every((mem) => byName[mem.name] === "yes");
    });
  }, [pool, votes, members]);

  function leaveGroup() {
    setProfile(null);
    setScreen("join");
    setNameInput("");
    setGroupInput("");
  }

  const bodyFont = { fontFamily: "'Karla', sans-serif" };
  const displayFont = { fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" };

  if (loading) {
    return (
      <div className="min-h-[600px] flex items-center justify-center bg-indigo-950">
        <style>{FONT_IMPORT}</style>
        <div className="text-amber-400 text-lg" style={bodyFont}>
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[600px] bg-indigo-950 text-stone-50 rounded-xl overflow-hidden" style={bodyFont}>
      <style>{FONT_IMPORT}</style>

      {/* header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-indigo-800/60">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-amber-400" />
          <span className="text-2xl text-amber-400" style={displayFont}>
            Family Movie Match
          </span>
        </div>
        {profile && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-indigo-300 font-bold hidden sm:inline">
              Group {profile.group}
            </span>
            <button onClick={leaveGroup} className="text-indigo-300 hover:text-amber-400" title="Leave group">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* nav */}
      {profile && screen !== "setup" && screen !== "join" && (
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
              className={
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-bold " +
                (screen === t.id ? "bg-indigo-900 text-amber-400" : "text-indigo-300 hover:text-stone-50")
              }
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="p-5">
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-rose-950 border border-rose-700 text-rose-200 text-sm">
            {error}
          </div>
        )}

        {/* JOIN SCREEN */}
        {screen === "join" && (
          <div className="max-w-sm mx-auto py-8">
            <p className="text-indigo-300 mb-6 text-sm">
              Create a family group, or join one someone already started, with a shared code.
            </p>
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Your name</label>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Sam"
              className="w-full mt-1 mb-4 px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400"
            />
            <label className="text-xs font-bold text-indigo-300 uppercase tracking-wide">Family group code</label>
            <div className="flex gap-2 mt-1 mb-2">
              <input
                value={groupInput}
                onChange={(e) => setGroupInput(e.target.value.toUpperCase())}
                placeholder="e.g. THOMPSONS"
                className="flex-1 px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400"
              />
              <button
                onClick={randomCode}
                className="px-3 py-2 rounded-lg bg-indigo-800 text-indigo-200 text-xs font-bold hover:bg-indigo-700"
              >
                New
              </button>
            </div>
            <p className="text-xs text-indigo-400 mb-5">
              Share this exact code with whoever you want to match with.
            </p>
            <button
              onClick={handleJoin}
              className="w-full py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300"
            >
              Join family group
            </button>
          </div>
        )}

        {/* SETUP SCREEN */}
        {screen === "setup" && profile && (
          <div className="max-w-lg mx-auto pb-6">
            <h2 className="text-xl text-amber-400 mb-4" style={displayFont}>
              Your streaming setup
            </h2>

            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Region</div>
              <div className="flex gap-2">
                <Chip active={regionInput === "CA"} onClick={() => setRegionInput("CA")}>
                  Canada
                </Chip>
                <Chip active={regionInput === "US"} onClick={() => setRegionInput("US")}>
                  United States
                </Chip>
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">
                Services you're subscribed to
              </div>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map((s) => (
                  <Chip key={s.id} active={servicesInput.includes(s.id)} onClick={() => toggleService(s.id)}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">Genres you like</div>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <Chip key={g.name} active={genresInput.includes(g.id)} onClick={() => toggleGenre(g.id)}>
                    {g.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">
                All-time favorite movies (optional)
              </div>
              <div className="flex gap-2 mb-2">
                <input
                  value={favInput}
                  onChange={(e) => setFavInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFavorite()}
                  placeholder="Add a title…"
                  className="flex-1 px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400"
                />
                <button onClick={addFavorite} className="px-3 py-2 rounded-lg bg-indigo-800 text-indigo-200 text-xs font-bold">
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {favorites.map((f, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-indigo-800 text-xs text-stone-100 flex items-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" /> {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-2">TMDB API key</div>
              <input
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste your free TMDB v3 API key"
                className="w-full px-3 py-2 rounded-lg bg-indigo-900 border border-indigo-700 text-stone-50 outline-none focus:border-amber-400"
              />
              <p className="text-xs text-indigo-400 mt-1">
                Free at themoviedb.org → Settings → API. Only stored on your own device.
              </p>
            </div>

            <button
              onClick={handleSaveSetup}
              className="w-full py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300"
            >
              Save & start swiping
            </button>
          </div>
        )}

        {/* SWIPE SCREEN */}
        {screen === "swipe" && profile && (
          <div className="max-w-sm mx-auto">
            {!pool && (
              <div className="text-center py-10">
                <p className="text-indigo-300 mb-4 text-sm">
                  No movie list yet for this group. Pull one in based on everyone's services and genres.
                </p>
                <button
                  onClick={fetchPool}
                  disabled={fetchingPool}
                  className="px-5 py-2.5 rounded-lg bg-amber-400 text-indigo-950 font-extrabold hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} />
                  {fetchingPool ? "Fetching…" : "Find movies for us"}
                </button>
              </div>
            )}

            {pool && currentMovie && (
              <div>
                <div className="text-center text-xs text-indigo-400 mb-2 font-bold">
                  {deck.length} left in your stack
                </div>
                <div
                  className={
                    "rounded-2xl bg-stone-50 text-indigo-950 overflow-hidden shadow-xl transition-all duration-200 " +
                    (swipeDir === "yes" ? "translate-x-8 rotate-3 opacity-60" : swipeDir === "no" ? "-translate-x-8 -rotate-3 opacity-60" : "")
                  }
                >
                  {currentMovie.poster_path ? (
                    <img
                      src={`https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`}
                      alt={currentMovie.title}
                      className="w-full h-72 object-cover"
                    />
                  ) : (
                    <div className="w-full h-72 bg-indigo-200 flex items-center justify-center text-indigo-500">
                      No poster
                    </div>
                  )}
                  <div className="p-4">
                    <div className="font-extrabold text-lg leading-snug">{currentMovie.title}</div>
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {genreNames(currentMovie.genre_ids).map((g) => (
                        <span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                          {g}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-indigo-800 leading-snug line-clamp-4">{currentMovie.overview}</p>
                    {trailers[currentMovie.id] && (
                      <a
                        href={`https://www.youtube.com/watch?v=${trailers[currentMovie.id]}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-rose-600 hover:text-rose-700"
                      >
                        <Play className="w-4 h-4" /> Watch trailer
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex justify-center gap-6 mt-5">
                  <button
                    onClick={() => castVote(currentMovie.id, "no")}
                    className="w-14 h-14 rounded-full bg-indigo-900 border-2 border-rose-500 text-rose-500 flex items-center justify-center hover:bg-rose-950"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => castVote(currentMovie.id, "yes")}
                    className="w-14 h-14 rounded-full bg-indigo-900 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center hover:bg-emerald-950"
                  >
                    <Heart className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {pool && !currentMovie && (
              <div className="text-center py-10">
                <p className="text-indigo-300 mb-4 text-sm">
                  You've swiped through the whole stack. Check Matches, or pull a fresh batch.
                </p>
                <button
                  onClick={fetchPool}
                  disabled={fetchingPool}
                  className="px-5 py-2.5 rounded-lg bg-indigo-800 text-stone-50 font-bold hover:bg-indigo-700 inline-flex items-center gap-2"
                >
                  <RefreshCw className={"w-4 h-4 " + (fetchingPool ? "animate-spin" : "")} />
                  Get a new batch
                </button>
              </div>
            )}
          </div>
        )}

        {/* MATCHES SCREEN — the marquee */}
        {screen === "matches" && (
          <div className="max-w-lg mx-auto">
            <div className="rounded-xl border-2 border-amber-400 bg-indigo-900 p-4 mb-5 relative">
              <div className="flex justify-center gap-2 mb-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ))}
              </div>
              <div className="text-center text-2xl text-amber-400" style={displayFont}>
                Match Marquee
              </div>
              <div className="flex justify-center gap-2 mt-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ))}
              </div>
            </div>

            {matches.length === 0 && (
              <p className="text-indigo-300 text-sm text-center py-6">
                No unanimous picks yet — keep swiping. A movie lights up here once everyone in the group says yes.
              </p>
            )}

            <div className="space-y-3">
              {matches.map((m) => (
                <div key={m.id} className="flex gap-3 bg-indigo-900 rounded-xl p-3 border border-indigo-700">
                  {m.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w200${m.poster_path}`}
                      className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                      alt={m.title}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="font-extrabold flex items-center gap-1">
                      <Ticket className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      {m.title}
                    </div>
                    <div className="flex flex-wrap gap-1 my-1">
                      {genreNames(m.genre_ids).map((g) => (
                        <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 font-bold">
                          {g}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-indigo-300 line-clamp-2">{m.overview}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GROUP SCREEN */}
        {screen === "group" && (
          <div className="max-w-lg mx-auto space-y-3">
            <p className="text-xs text-indigo-400 mb-2">
              Share code <span className="text-amber-400 font-bold">{profile?.group}</span> with anyone else who should join.
            </p>
            {members.map((m) => (
              <div key={m.name} className="bg-indigo-900 rounded-xl p-3 border border-indigo-700">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full ${avatarColor(m.name)} flex items-center justify-center text-indigo-950 font-extrabold text-sm`}>
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-extrabold">{m.name}</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {(m.services || []).map((sid) => (
                    <span key={sid} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-700 text-indigo-100 font-bold">
                      {SERVICES.find((s) => s.id === sid)?.name}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {(m.genres || []).map((gid) => (
                    <span key={gid} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold">
                      {GENRES.find((g) => g.id === gid)?.name}
                    </span>
                  ))}
                </div>
                {m.favorites?.length > 0 && (
                  <div className="text-xs text-indigo-300 mt-1">
                    Favorites: {m.favorites.join(", ")}
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
