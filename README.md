# Wedding Fitness Tracker

A private 16-week wedding-prep tracker (the build to Sat 21 Nov 2026). Next.js + Supabase, deployed on Vercel. Every tap — check-offs, weigh-ins, run times, steps, notes — is saved to Supabase and loads on any device..

**Testing mode:** wide open, no login. Anyone with the URL and the app can read/write the single shared dataset. We'll add magic-link auth before real use..

---

## What's here

```
app/
  layout.js            root layout
  page.js              renders the dashboard
  globals.css          minimal reset
  api/
    log/route.js       GET all logs · POST one day · DELETE all (reset)
    profile/route.js   GET · POST the baselines
components/
  Dashboard.js         the whole UI (ported from the v1 tracker, wired to the API)
lib/
  supabase.js          Supabase clients (anon for reads, service role for writes)
  workouts.js          the 16-week beach-muscles workout bank
supabase-setup.sql     run once to create the tables
BEACH_MUSCLES_WORKOUTS.md  human-readable workout reference
```

---

## One-time setup (≈15 min)

### 1. Supabase
1. In your existing Supabase project, open the **SQL editor**.
2. Paste all of `supabase-setup.sql` and run it. That creates `fitness_log` and `fitness_profile` and seeds the placeholder baselines.
3. From **Project settings → API**, copy: Project URL, `anon` public key, and `service_role` key.

### 2. Point the repo at the fitness app
This replaces the World Cup app in the **same** GitHub repo / Vercel project.
1. In the repo, delete the old WC files: `components/Dashboard.js` (old), `scripts/update-stats.mjs`, `app/api/team-stats/`, `lib/data.js` (old), `.github/workflows/daily-update.yml`, `supabase-setup.sql` (old).
2. Copy in everything from this folder.
3. Commit and push.

### 3. Vercel environment variables
In the Vercel project (**Settings → Environment Variables**), set:
- `NEXT_PUBLIC_SUPABASE_URL` — your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key
- `SUPABASE_SERVICE_ROLE_KEY` — the service role key
- `NEXT_PUBLIC_SITE_URL` — https://wc2026-sweepstakes-one.vercel.app

Remove the old WC-only vars (`FOOTBALL_DATA_API_KEY`, `VERCEL_DEPLOY_HOOK`, etc.). You can also delete the old GitHub Actions secrets — the fitness app has no cron.

Push to GitHub → Vercel auto-deploys → open the URL. Done.

---

## Run locally (optional)
```
npm install
cp .env.example .env.local   # fill in your keys
npm run dev                  # http://localhost:3000
```

---

## Before real use — locking it down
When you're ready, we'll: drop the `open_*` RLS policies in the SQL, add Supabase magic-link auth, add a `user_id` column, and restrict rows to you. Then it's private across all your devices.
