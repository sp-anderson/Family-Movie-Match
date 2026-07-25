# Family Movie Match — manual setup (no Claude Code)

You'll need: a terminal, Node.js installed (nodejs.org, get the LTS version),
and your GitHub repo cloned locally.

## 1. Get the code into your repo

- Unzip `family-movie-match-full.zip`
- Copy every file/folder inside it into your local clone of
  `sp-anderson/Family-Movie-Match` (the whole `app/` folder, `package.json`,
  `next.config.js`, `tailwind.config.js`, `postcss.config.js`, `.gitignore`,
  `.env.local.example`)

## 2. Install dependencies

In a terminal, inside the repo folder:

```
npm install
```

## 3. Get a TMDB API key (if you don't already have one)

themoviedb.org → create account → Settings → API → request a key
(Type of use: Personal). Copy the "API Key (v3 auth)" string.

## 4. Set up Google Sign-In

1. Go to console.cloud.google.com
2. Create a new project (any name)
3. Left menu → APIs & Services → OAuth consent screen → set it up for
   "External" users, fill in the required fields (app name, your email) — for
   personal/family use you can leave it in "Testing" mode and just add your
   family's Google emails as test users
4. Left menu → APIs & Services → Credentials → Create Credentials →
   OAuth client ID → Application type: **Web application**
5. Under "Authorized redirect URIs" add both:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://family-movie-match.vercel.app/api/auth/callback/google`
6. Save — copy the **Client ID** and **Client Secret** it gives you

## 5. Set up the database (Upstash Redis via Vercel Marketplace)

Vercel retired its native "KV" product — it's now the Upstash integration:

1. Go to your project on vercel.com → Storage tab → Browse Storage
2. Under Marketplace Database Providers, choose **Upstash** ("Serverless DB —
   Redis, Vector, Queue, Search")
3. Create a Redis database and connect it to this project. Vercel will offer
   to auto-add the env vars for you — let it (they'll show up as
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`).

## 6. Environment variables

Copy `.env.local.example` to a new file named `.env.local` and fill it in:

```
TMDB_API_KEY=your_tmdb_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=   (run: openssl rand -base64 32   and paste the output)
NEXTAUTH_URL=http://localhost:3000
```

(Leave the `UPSTASH_REDIS_REST_*` vars — Vercel already added those for you
in step 5, and you'll pull them into your local `.env.local` in step 7.)

## 7. Pull Vercel's env vars locally (optional but easiest)

If you have the Vercel CLI (`npm i -g vercel`), run `vercel login`, then
`vercel link` (choose your existing project), then `vercel env pull .env.local`
— this fills in the Upstash Redis variables automatically. Otherwise, copy
them manually from Vercel dashboard → Project → Settings → Environment
Variables.

## 8. Test locally

```
npm run dev
```

Open `http://localhost:3000` — you should be able to sign in with Google,
create/join a group, set your services and genres, and pull real movies.

## 9. Set the same env vars on Vercel

Vercel dashboard → your project → Settings → Environment Variables → add
`TMDB_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`,
and `NEXTAUTH_URL` (set this one to `https://family-movie-match.vercel.app`
for production, not localhost).

## 10. Push

```
git add .
git commit -m "Add Google login, TMDB proxy, and family group matching"
git push
```

Vercel will auto-deploy from the push. Once it finishes, your live app is at
`https://family-movie-match.vercel.app`.

## If something breaks

Vercel dashboard → Deployments → click the latest one → view the build logs,
they'll usually point straight at a missing env var or a typo.
