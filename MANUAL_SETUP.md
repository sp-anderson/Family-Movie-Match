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

## 10. Set up Apple Sign-In (optional but built-in)

This requires an active **Apple Developer Program membership ($99/year)**.
If you don't have one, skip this — Google and Email sign-in still work fine
without it, the Apple button just won't.

1. developer.apple.com → Certificates, IDs & Profiles → Identifiers →
   create an **App ID** if you don't already have one for this project.
2. Same section → Identifiers → **+ → Services IDs** → create one
   (e.g. `com.yourname.familymoviematch.web`) — this becomes `APPLE_CLIENT_ID`.
3. Click into that Services ID → enable "Sign in with Apple" → configure it:
   - Primary App ID: the App ID from step 1
   - Domains: `family-movie-match.vercel.app`
   - Return URLs: `https://family-movie-match.vercel.app/api/auth/callback/apple`
     (and `http://localhost:3000/api/auth/callback/apple` for local dev)
4. Certificates, IDs & Profiles → Keys → **+** → enable "Sign in with Apple",
   associate it with your App ID → download the `.p8` key file (you can only
   download it once, keep it safe) and note the **Key ID**.
5. Apple's client secret isn't a static string — it's a JWT you sign yourself
   using that `.p8` key, and it expires every 6 months max, so it needs
   regenerating periodically. The quickest way to generate one: search
   "next-auth apple client secret generator" for an up-to-date script, or use
   the `apple-signin-auth` npm package's `getClientSecret` helper with:
   - your **Team ID** (top-right of the Apple Developer dashboard)
   - your **Services ID** (from step 2) as the client ID
   - your **Key ID** (from step 4)
   - the contents of the `.p8` file
   Put the resulting JWT string in `APPLE_CLIENT_SECRET`.

## 11. Set up Resend (for magic-link and parental consent emails)

1. resend.com → sign up (free tier covers this comfortably)
2. Settings → API Keys → create one → put it in `RESEND_API_KEY`
3. For `RESEND_FROM_EMAIL`, the default `onboarding@resend.dev` works
   immediately with no setup, but only delivers to your own verified email
   during testing. To send to anyone, add and verify your own domain under
   Resend → Domains, then use an address at that domain instead.
4. Add both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to Vercel's Environment
   Variables too.

## 12. Account deletion (30-day delayed purge)

Settings → "Delete my account" schedules deletion 30 days out (cancellable
any time before then from the banner that appears). The actual permanent
deletion runs via a **Vercel Cron job** (`vercel.json`, hits
`/api/cron/purge-accounts` daily) — this requires no extra setup beyond
adding `CRON_SECRET` to your env vars (both locally and on Vercel). Vercel
automatically sends that secret as a Bearer token on scheduled calls, so the
route only runs when Vercel itself triggers it, not for anyone else. Cron
jobs are enabled by default once `vercel.json` is present in the repo —
nothing to toggle on in the dashboard.

## If something breaks

Vercel dashboard → Deployments → click the latest one → view the build logs,
they'll usually point straight at a missing env var or a typo.

## A note on the parental consent flow

The under-13 sign-up flow implements the FTC's "email plus" verifiable
parental consent method (initial consent request + confirmatory follow-up
email), which is a real, recognized method — but it's intended for cases
where children's data isn't disclosed to third parties and the risk profile
is low. **This is not a substitute for legal review.** Before this handles
real children's personal data in production, have an actual lawyer confirm
it satisfies COPPA (and any other applicable law, e.g. GDPR-K if you have UK
users) for your specific situation.

