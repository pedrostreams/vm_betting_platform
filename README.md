# VM 2026 — Tippebongen 🏆

Tippekonkurranse-app for fotball-VM 2026, laget for en vennegjeng. Tipp gruppespill og
sluttspill, velg special bets, lag private ligaer og kjemp om toppen hele sommeren.

VM 2026: **11. juni – 19. juli 2026** · 48 lag · 104 kamper.

---

## Hva appen gjør

- **Gruppespill** — tipp H/U/B på alle 72 kampene. Hver kamp låses 15 min før avspark.
- **Sluttspill** — tipp hvem som går videre (H/B, ingen uavgjort), runde for runde. Lagene
  fylles inn automatisk når gruppene er ferdigspilt.
- **Special bets** — 5 turneringsveddemål med kandidater og odds fra Polymarket.
- **Ligaer** — opprett private ligaer, del invitasjonslenke, egen ligatabell.
- **Hjem** — live dashboard: gjøremål før deadline, din posisjon, dagens kamper, nyhetsfeed.
- **Data Hub** — sorterbare/filtrerbare tabeller med all lag- og spillerstatistikk.
- **Admin** — bekreft special-bet-vinnere og kjør poengberegning.

---

## Teknologi

| Lag | Valg |
|---|---|
| Rammeverk | **Next.js 16** (App Router) + **React 19** + TypeScript |
| Styling | **Tailwind v4** + **shadcn/ui** (base-nova-stil = **Base UI**, ikke Radix) |
| Tema | `next-themes` (lys/mørk) + egendefinert nordisk **oklch**-palett |
| Tabeller | **TanStack Table** (Data Hub) |
| Database/Auth | **Supabase** (Postgres + Auth + Row Level Security) |
| Hosting | **Vercel** (frontend) · **cron-job.org** (daglig datasync) |

> **Base UI-merknad:** komponentene bruker `render`-prop, **ikke** `asChild`.
> F.eks. `<Button render={<Link href="/x" />}>…</Button>`.

---

## Datakilder

Prinsipp: **egen data fremfor live API-kall** for alt som driver scoring. Live (cachede)
kall brukes kun til "snacks" (Polymarket, RSS) som ikke er kritiske.

| Kilde | Bruk | Hvordan |
|---|---|---|
| **football-data.org** | Terminliste (104), lag (48), tropper (26/lag), resultater, toppscorer, standings | Daglig cron → Supabase. Header `X-Auth-Token`, competition `WC`, sesong `2398` |
| **Norsk Tipping (Oddsen)** | HUB-odds per kamp | Daglig cron. Tournament `45613`, matchet på avsparkstidspunkt + NO→EN-aliasnavn |
| **Polymarket (Gamma API)** | Special-bet-kandidater + implisitt odds | Live, cachet 1t. Lagrer valget som kandidat-**navn** (ingen DB-FK) |
| **Independent RSS** | Nyhetsfeed | Live, cachet 30 min (ingen DB-tabell) |
| **Sofascore** | Detaljert landslagsstatistikk + toppspillere | **Engangs**-script (Python + `curl_cffi`, ikke i Vercel) → `team_stats` |

Special-bet-markeder (Polymarket-slugs): `world-cup-winner`, `world-cup-golden-boot-winner`,
`world-cup-most-assists`, `world-cup-most-clean-sheets-gk`, `world-cup-top-scorer-nation`.

---

## Poengsystem

**Gruppespill** (H/U/B, avgjøres på 90-min-resultat): **2 poeng** per rett.

**Sluttspill** (hvem går videre, inkl. ekstraomganger/straffer):

| Runde | Poeng |
|---|---|
| 16-delsfinale | 3 |
| 8-delsfinale | 4 |
| Kvartfinale | 6 |
| Semifinale | 8 |
| Bronsefinale | 8 |
| Finale | 12 |

**Special bets** (admin-bekreftet ved slutt): VM-vinner 10 · Toppscorer 8 · Assistkonge 6 ·
Land med toppscorer 5 · Rent bur (keeper) 4.

**Rangering ved poenglikhet:** total → flest rette i sluttspill → flest rette special bets.
**Maks mulig:** 317 poeng (144 gruppe + 140 sluttspill + 33 special).

---

## Brukere og ligaer

- **Innlogging:** e-post + passord. *(«Confirm email» må være AV i Supabase → ingen
  bekreftelses-e-post, ingen rate limit.)*
- **To navn:** `full_name` (samles ved registrering) + `display_name` = **lagnavn** (samles
  i onboarding, sammen med samtykke til 200 kr buy-in). Ligatabellen viser lagnavn som
  tittel og fullt navn som undertittel.
- **Invitasjonslenker:** `/invite/<KODE>` — del i gruppechatten. Uinnloggede sendes til
  registrering (koden følger med), og får en «Bli med i {liga}?»-bekreftelse etterpå.
- **Felles fasit** for alle; ligaene er bare private grupperinger. Buy-in håndteres utenfor
  appen (kun en avkrysning ved registrering).

---

## Prosjektstruktur

```
src/
  app/
    (app)/                 # innlogget app-skall (proxy-beskyttet)
      page.tsx             # Hjem / dashboard
      gruppespill/         # gruppespill-editor
      sluttspill/          # sluttspill-editor
      special-bets/        # Polymarket-velgere
      liga/                # ligaer, [id] = ligatabell, actions.ts
      statistikk/          # Data Hub (TanStack)
      admin/               # special-bet-grading, actions.ts
    login/                 # e-post+passord (split-hero web, full-bleed mobil)
    onboarding/            # lagnavn + samtykke
    invite/[code]/         # offentlig invitasjonsside
    auth/callback/         # OAuth/magic-link callback (ubrukt nå)
    api/cron/[job]/        # cron-ruter (CRON_SECRET-beskyttet)
    opengraph-image.tsx    # delebilde (OG/Twitter)
    layout.tsx, globals.css
  components/              # app-shell, editorer, paneler, ui/ (shadcn)
  lib/
    supabase/              # client / server / admin / middleware (proxy)
    football-data.ts, polymarket.ts, news.ts, insights.ts
    queries.ts, scoring.ts, format.ts, types.ts, admin.ts
    ingest/                # tournament.ts, odds.ts
  proxy.ts                 # auth-gate (Next 16 «proxy», tidl. middleware)
supabase/migrations/       # 0001–0007 (SQL, kjøres via scripts/db-migrate.mjs)
scripts/                   # db-migrate.mjs, seed-tournament.ts, enrich-team-stats.py
docs/                      # PLAN.md (opprinnelig plan) m.m.
```

---

## Oppsett

1. **Installer:** `npm install`
2. **Miljøvariabler** (`.env.local`):

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   SUPABASE_DB_PASSORD=...            # NB: feilstavet med vilje (db-migrate matcher løst)
   FOOTBALL_DATA_TOKEN=...            # gratis fra football-data.org
   CRON_SECRET=...                    # langt, tilfeldig
   ADMIN_EMAILS=din@epost.no          # komma-separert; gir admin uten DB-rad
   # NEXT_PUBLIC_SITE_URL=https://...  # valgfritt; for OG/delelenker (auto på Vercel)
   ```

3. **Supabase dashboard:** Authentication → Providers → Email → skru **AV** «Confirm email».
4. **Kjør migrasjoner** (bruk session-pooler-URL fra Supabase → Connect → Session pooler):

   ```bash
   node scripts/db-migrate.mjs --db-url "postgresql://postgres.<ref>:<pw>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"
   ```

5. **Seed turneringsdata:** `npx tsx --env-file=.env.local scripts/seed-tournament.ts`
6. **Berik lagstatistikk** (valgfritt, krever Python + `curl_cffi`):
   `python scripts/enrich-team-stats.py`
7. **Kjør appen:** `npm run dev` → http://localhost:3000

---

## Cron / datasync

Trigges daglig av **cron-job.org** mot beskyttede ruter:

```
GET /api/cron/sync-tournament?secret=$CRON_SECRET   # lag, tropper, kamper, resultater
GET /api/cron/odds?secret=$CRON_SECRET              # Norsk Tipping HUB-odds
GET /api/cron/grade?secret=$CRON_SECRET             # rekalkuler poeng
GET /api/cron/all?secret=$CRON_SECRET               # alt over, i rekkefølge
```

Nyheter (RSS) og special-bet-kandidater (Polymarket) hentes live ved render (cachet) og er
**ikke** del av cron.

---

## Deploy (gjenstår)

1. Push til GitHub, koble repoet i Vercel.
2. Legg inn env-variablene i Vercel (samme som `.env.local`, sett ekte `CRON_SECRET`).
3. Authentication → URL Configuration: legg til Vercel-domenet i Redirect URLs.
4. Sett opp cron-job.org mot `https://<domene>/api/cron/all?secret=<CRON_SECRET>` (daglig).
5. Etter deling på sosiale medier: kjør URL-en gjennom Facebooks Sharing Debugger → «Scrape Again».

---

## Future work

**Klart for produksjon:**
- [ ] Deploy til Vercel + sett opp cron-job.org (se over).
- [ ] Bytt `CRON_SECRET` til en ekte hemmelighet før deploy.

**Spillmoduser / engasjement** (idéer, ikke bygget):
- [ ] **Survivor / Last man standing** — ett lag per runde, kan ikke gjenbrukes, bom = ute.
- [ ] **Underdog-bonus** — flere poeng jo høyere odds laget hadde (bruker odds vi har).
- [ ] **Banker / Joker** — doble poeng på én valgt kamp per runde.
- [ ] **Streak-bonus** — multiplikator for X rette på rad (×1,5 ved 3, ×2 ved 5+).
- [ ] **Confidence-poeng** — fordel et poengbudsjett etter hvor sikker du er.
- [ ] **Bracket challenge** — tegn hele sluttspillstigen på forhånd.
- [ ] **Over/under 2,5 mål** per kamp · daglig VM-quiz · bonus-spørsmål (admin-gradert).

**UX / design:**
- [ ] Design-pass på editorene (roligere paneler, frosted header, større crester).
- [ ] Mer innbydende tomtilstander (ikon + tekst + CTA).
- [ ] Native delemeny (Web Share API) på mobil for invitasjonslenker.
- [ ] Vis «X med fra før» på invitasjonssiden.

**Data / drift:**
- [ ] E-postvarsler før deadline (kamper som snart låses).
- [ ] Per-kamp spillerdata (målscorere) for rikere special-bet-/live-visning.
- [ ] Automatisk special-bet-gradering fra data (i dag admin-bekreftet).
- [ ] Rydd opp ubrukt `news`-tabell (nyheter hentes nå live).
- [ ] Planlegg `enrich-team-stats.py` til å kjøre periodisk (egen worker), ikke bare engangs.
- [ ] Verifiser `score.winner`/`duration` (straffer) ved første sluttspillkamp.
```
