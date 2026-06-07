@AGENTS.md

# VM 2026 «Tippebongen» — agent guide

World Cup 2026 prediction/tipping web app for a Norwegian friend group. See `README.md` for
the full feature/data overview. This file captures the conventions and gotchas that aren't
obvious from the code.

## Stack & conventions

- **Next.js 16 (App Router) + React 19 + TS**, Tailwind v4, shadcn/ui **base-nova = Base UI
  (NOT Radix)**.
  - Compose via the **`render` prop**, never `asChild`: `<Button render={<Link href="/x" />}>`,
    `<DropdownMenuTrigger render={<Button/>}>`. Using `asChild` is a type error.
- **Auth gate lives in `src/proxy.ts`** (Next 16 renamed `middleware` → `proxy`). It refreshes
  the Supabase session and redirects unauthenticated users to `/login`. Public paths:
  `/login`, `/auth`, `/invite`, `/api/cron`, and metadata routes (`/opengraph-image`, …). Add
  new public/crawler routes to the `isPublic` list there.
- **Design language:** buttons are pills (`rounded-full`), global `--radius` = `0.85rem`,
  Nordic oklch palette in `globals.css` with `--win/--draw/--loss` status tokens. Inputs are
  `h-10` with a subtle `bg-muted/40` fill that brightens on focus. Tabular numbers everywhere.
- **Theme:** `next-themes`, class strategy, light default + full dark mode.

## Commands

```bash
npm run dev            # dev (falls back to :3001 if :3000 is taken)
npm run build          # production build (also runs tsc) — use to verify
npx tsc --noEmit       # typecheck only

# DB migrations — ALWAYS via the session pooler (direct db.<ref>.supabase.co does NOT resolve)
node scripts/db-migrate.mjs --db-url "postgresql://postgres.<ref>:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

npx tsx --env-file=.env.local scripts/seed-tournament.ts   # seed teams/players/matches
python scripts/enrich-team-stats.py                        # one-time Sofascore team+player stats
```

Migrations are idempotent and re-run from scratch each call. Region is **eu-central-1**.

## Architecture map

- **Data ingestion** (`src/lib/ingest/*`, `src/lib/scoring.ts`) runs server-side via
  `src/app/api/cron/[job]/route.ts`, guarded by `CRON_SECRET` (query `?secret=` or Bearer).
  Jobs: `sync-tournament`, `odds`, `grade`, `all`. Triggered daily by cron-job.org.
- **Reads** go through `src/lib/queries.ts` (matches, picks, standings) and
  `src/lib/insights.ts` (per-team snacks: title odds, squad age, WC form, Sofascore detail +
  key players). Editors are client components fed by server pages.
- **Supabase clients:** `lib/supabase/{client,server,admin}.ts`. `admin` = service role,
  server-only (cron + seed + reading `pools` on the public invite page).
- **Live/cached sources** (no DB): `lib/polymarket.ts` (special-bet candidates, `revalidate:
  3600`), `lib/news.ts` (Independent RSS, `revalidate: 1800`).

## Data model (Supabase, migrations `0001`–`0007`)

`teams`, `players`, `matches`, `match_odds`, `stage_points`, `special_bet_types`, `profiles`
(`display_name`=lagnavn, `full_name`, `agreed_terms_at`), `app_admins`, `pools`,
`pool_members`, `predictions` (pick H/U/B), `special_bet_picks` (`candidate` text),
`special_bet_results` (`winning_candidate` text), `user_scores`, `team_stats`
(`stats` jsonb + `top_players` jsonb). A `news` table exists but is unused (news is live).

Key DB facts:
- **`matches.lock_at` is a plain column** (set at ingest = `utc_date − 15min`). NOT generated:
  `timestamptz - interval` is only STABLE, which breaks generated columns.
- **RLS everywhere.** `pool_members` SELECT uses the `is_pool_member(uuid)` **SECURITY DEFINER**
  helper to avoid infinite recursion. `tournament_started()` gates special-bet writes.
  `handle_new_user` trigger creates a bare profile on signup. Reference tables are public-read;
  writes happen via the service role (which bypasses RLS).
- Special bets are **Polymarket-name based** end-to-end (pick + result store the candidate
  name) — no player/team FK matching.

## Scoring (`src/lib/scoring.ts`, idempotent)

Group = HUB 2p on 90-min `fullTime`. Knockout = who advanced (`score.winner`, incl. ET/pens),
H/B only, points escalate R32→Final (3/4/6/8/8/12). Special bets = admin-confirmed candidate
match. Tie-break: total → correct knockout → correct special. `gradeAll` recomputes all
`user_scores` from scratch on every run.

## Important setup gotchas

- **Supabase «Confirm email» must be OFF** — otherwise signup doesn't return a session.
- **`.env.local` has a misspelled key `SUPABASE_DB_PASSORD`** (trailing space) — `db-migrate.mjs`
  matches it loosely via regex. Leave it or fix both sides together.
- **Admin** = email in `ADMIN_EMAILS` OR a row in `app_admins` (`src/lib/admin.ts`).
- Login hero images: web `public/login-hero-web.webp`, mobile `public/bg.png` — gradient
  fallback if missing.

## When changing things

- New table/policy → add a numbered migration in `supabase/migrations/`, then run db-migrate.
- New ingest field → update `lib/ingest/*` (or the Python enrich script for Sofascore) and the
  read path; remember `gradeAll` is the single source of points.
- Verify with `npm run build` (typechecks + compiles). Don't trust a stale `npm run dev` worker
  — restart it after adding routes/proxy changes.
