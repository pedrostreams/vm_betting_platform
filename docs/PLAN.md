# VM 2026 Tippekonkurranse — Implementasjonsplan

> Status: Design ferdig (grill-me gjennomført 2026-06-07). Klar for implementasjon.
> VM 2026 starter **11. juni 2026** (4 dager unna ved planlegging) — sluttdato 19. juli 2026.

---

## 1. Oversikt og mål

En tippekonkurranse-app for en vennegjeng, delt i tre faser:

1. **Gruppespill** — gjett HUB (hjemme/uavgjort/borte) på alle 72 gruppekamper.
2. **Sluttspill** — gjett hvem som går videre, per kamp, per runde (R32 → finale).
3. **Special bets** — 5 turneringsomfattende veddemål.

Felles fasit for alle. Deltakere grupperes i private **ligaer** (med invitasjonslenke). Buy-in (200 kr) håndteres utenfor appen; kun en samtykke-avkrysning ved registrering.

---

## 2. Tech stack

| Lag | Valg | Begrunnelse |
|---|---|---|
| Frontend/Backend | **Next.js 15 (App Router) + TypeScript** | Én codebase, server actions, route handlers for cron |
| Styling/UI | **Tailwind CSS + shadcn/ui** | Ferdige panel/tabell-komponenter for editor-UI |
| Database + Auth | **Supabase (Postgres)** | Egen, ny DB. RLS for tilgangskontroll |
| Auth-metoder | **Magic link + Google OAuth** | Lav friksjon for vennegjeng |
| Hosting (app) | **Vercel** | Best for Next.js, gratis hobby-tier |
| Cron-trigger | **cron-job.org** (eksisterende bruker) | Daglig kall til beskyttede `/api/cron/*`-ruter |
| Ingestion | **Ren TypeScript** | Begge kilder er JSON — ingen Python/scraping nødvendig |

---

## 3. Datakilder

### football-data.org (ryggraden) — gratis token
Header: `X-Auth-Token`. Competition-kode `WC`, sesong-id `2398` (2026-06-11 → 2026-07-19).
Verifisert dekning:

| Endepunkt | Gir |
|---|---|
| `/v4/competitions/WC/matches` | Alle **104 kamper** (72 gruppe, 16 R32, 8 R16, 4 KF, 2 SF, bronse, finale) — utcDate, stage, group, matchday, lag, score, winner, duration |
| `/v4/competitions/WC/teams` | **48 lag + komplette 26-manns tropper** (navn, posisjon inkl. `Goalkeeper`, fødselsdato) |
| `/v4/competitions/WC/scorers` | Toppscorer (auto-forslag for special bet) |
| `/v4/competitions/WC/standings` | Gruppetabeller (+ goalsFor for "flest mål"-bet) |

Sluttspill-kamper har `null`-lag til gruppene er ferdige → fylles ut av cron underveis.

### Norsk Tipping (Oddsen) — odds-laget, ingen auth
- Events: `GET https://api.norsk-tipping.no/OddsenGameInfo/v1/api/events/FBL/{from}/{to}` → filtrer `tournament.id == "45613"`.
- `mainMarket.marketName == "HUB"` med 3 selections (H/D/A) + `selectionOdds`, `betStop`, eksakt `startTime`.
- Matches mot football-data-kamper på **lagnavn + dato**.
- Ruller ut kamper gradvis (kun åpne markeder). Brukes kun til odds-berikelse — football-data eier strukturen.
- Live/resultat-endepunkt: `/livedata/{eventId}` (204 før kampstart). Vi bruker football-data til resultater, ikke dette.
- Outright-markeder (toppscorer/vinner-odds): sjekkes ved implementasjon; brukes til odds-rangert kandidatliste hvis tilgjengelig.

### Eksisterende Supabase-klubbstats (snacks)
Migreres til ny DB. Topp-5-liga spillerstats 25/26 (`stat_catalog`, player season stats). Vises i høyre statistikk-panel som beslutningsstøtte. Ikke alle VM-spillere er dekket (kun topp-5-liga) — det er greit, det er snacks.

### Independent RSS (nyheter) — verifisert
`https://www.independent.co.uk/sport/football/world-cup/rss` — 10 VM-saker, allerede VM-filtrert. Parses daglig, lagres i DB.

---

## 4. Datamodell (Supabase)

### Kjerne — turneringsdata (fylles av cron)
- **teams** — `id` (football-data), `name`, `tla`, `crest_url`, `group_code`
- **players** — `id`, `team_id`, `name`, `position`, `date_of_birth`, `is_goalkeeper`
- **matches** — `id` (football-data), `stage`, `group_code`, `matchday`, `utc_date`, `lock_at` (= utc_date − 15 min), `home_team_id`, `away_team_id`, `status`, `home_score`, `away_score`, `winner` (HOME/AWAY/DRAW), `duration` (REGULAR/EXTRA_TIME/PENALTY_SHOOTOUT)
- **match_odds** — `match_id`, `home_odds`, `draw_odds`, `away_odds`, `source`, `fetched_at`
- **news** — `id`, `title`, `link`, `published_at`, `source`

### Brukere og ligaer
- **profiles** — `id` (= auth.users), `display_name`, `agreed_terms_at`
- **pools** (ligaer) — `id`, `name`, `owner_id`, `invite_code`, `buy_in_nok` (visning)
- **pool_members** — `pool_id`, `user_id`, `role` (owner/member), `joined_at`

### Tips
- **predictions** — `user_id`, `match_id`, `pick` (`H`/`U`/`B`; sluttspill bruker kun `H`/`B`), `created_at`, `updated_at`. Unik på (user_id, match_id). Skriving blokkeres av RLS når `now() >= lock_at`.
- **special_bet_types** — `id`, `name`, `points`, `kind` (`team`/`player`/`keeper`)
- **special_bet_picks** — `user_id`, `bet_type_id`, `team_id` ELLER `player_id`. Låses ved turneringens første avspark.
- **special_bet_results** — `bet_type_id`, `winning_team_id`/`winning_player_id` (settes av admin ved slutt)

### Scoring
- **match_points_config** — poeng per stage (se §6)
- **user_scores** (materialisert/oppdatert av grading-cron) — `user_id`, `total_points`, `group_points`, `knockout_points`, `special_points`, `exact_knockout_count` (tie-break), `correct_special_count` (tie-break)

### Snacks (migreres)
- `stat_catalog`, klubb-spillerstats, leagues/seasons (eksisterende). Read-only, kobles til VM-spillere på navn for høyre-panel.

---

## 5. Ingestion (daglig cron via cron-job.org)

Én beskyttet rute kjedet med `CRON_SECRET`, eller fire separate:

1. **`/api/cron/sync-tournament`** — football-data `/matches` + `/teams` → upsert teams, players, matches (inkl. nye sluttspill-lag, oppdaterte resultater). Setter `lock_at = utc_date − 15min`.
2. **`/api/cron/sync-odds`** — Norsk Tipping events → match på lagnavn+dato → upsert `match_odds`.
3. **`/api/cron/sync-news`** — Independent RSS → upsert `news` (siste ~30).
4. **`/api/cron/grade`** — beregn poeng for ferdigspilte kamper → oppdater `user_scores`.

Rekkefølge: sync-tournament → grade. Odds og news uavhengig.

---

## 6. Poengsystem og grading

### Gruppespill (HUB, alle 3 utfall)
- **2 poeng** for rett utfall. Gradert på `score.fullTime` (90 min): likt = U.

### Sluttspill (kun H/B — hvem gikk videre)
Gradert på `winner` (inkl. ekstraomganger/straffer), aldri uavgjort.

| Runde | Poeng |
|---|---|
| Round of 32 | 3 |
| Round of 16 | 4 |
| Kvartfinale | 6 |
| Semifinale | 8 |
| Finale | 12 |

### Special bets (admin-bekreftet ved slutt)
| Bet | Velg fra | Poeng |
|---|---|---|
| Hvem vinner VM? | 48 lag | 10 |
| Toppscorer | spillere | 8 |
| Assistkonge | spillere | 6 |
| Flest mål (lag) | 48 lag | 5 |
| Rent bur (keeper m/ flest clean sheets) | keepere | 4 |

Maks poengsum er fast og synlig for alle.

### Tie-break i ligatabell
1. Total poengsum → 2. flest rette sluttspill-HUB → 3. flest rette special bets → 4. delt plassering.

---

## 7. Auth, ligaer og deadlines

- **Auth:** Supabase magic link + Google OAuth. Registrering = visningsnavn + samtykke-avkrysning (200 kr buy-in, utenfor app).
- **Ligaer:** oppretter lager liga → invitasjonskode/lenke. Bruker kan være i flere. Felles fasit, kun grupperingen er separat.
- **Låsing:** per kamp, 15 min før avspark (`lock_at`). Alle kamper synlige/redigerbare fra start → kan fylles "i én go". Special bets låses ved turneringens første avspark.
- **RLS:** tips kun skrivbare av eier og kun før `lock_at`; andres tips skjult til kampen er låst.

---

## 8. UI / Sider (Husk å bruke ui-pro-max plugin/skill.)

### Design er skandinavisk/nordisk. Foksu på kvalitet.

### Hjem (live dashboard)
- **Actions før deadline:** "X kamper låses i dag du ikke har tippet", "R32 er klar — 16 nye kamper".
- **Din posisjon** i hver liga + bevegelse.
- **Dagens kamper** med resultat/odds.
- **Nyhetsfeed** (Independent RSS).
- **Dine Ligaer**  viser ligaer du deltar i.

### Gruppespill / Sluttspill / Special bets (egne menypunkt, 3-panel editor)
```
┌────────────┬──────────────────────────────┬─────────────────┐
│ VENSTRE    │  CANVAS (senter)             │ HØYRE           │
│ nav-liste  │  Tab: Tipping  [+ Tabell*]   │ statistikk for  │
│ gruppe→    │  HUB-valg + odds + nedtelling │ valgt kamp/lag  │
│ kamp,      │  "Neste utippet →"           │ form, rank,     │
│ status ●/○ │                              │ klubbstats,     │
│            │                              │ siste møter     │
└────────────┴──────────────────────────────┴─────────────────┘
```
- **V1:** venstre nav + canvas-tipping + høyre statistikk.
- **V1.1 (rett etter):** FM-tabell-tab i canvas — bred, sorterbar, filtrerbar, med kolonnevelger/egne views.
- Special bets: canvas viser de 5 veddemålene med søkbar velger (odds-rangert kortliste + fritekstsøk).

### Konto
Simpel kontoadministrasjon + mulighet til å lage ligaer. Hvis du lager en liga så kan du også sende invite lenke.

### Invitasjon landingsside.

### Liga administrasjon

---

## 9. Deployment & sikkerhet

- **Vercel** for Next.js. Env: `FOOTBALL_DATA_TOKEN`, `CRON_SECRET`, Supabase-nøkler.
- **cron-job.org** kaller `/api/cron/*` daglig med `CRON_SECRET`.
- **RLS** på alle bruker-tabeller. Service-role kun i cron-ruter (server-side).
- football-data-token i env, aldri i klient.

---

## 10. Bygge-rekkefølge (milepæler)

**M1 — Fundament (dag 1):** Next.js + Supabase + Auth + schema-migrasjoner + seed teams/players/matches fra football-data. Migrer klubbstats.

**M2 — Tipping funker (dag 1–2):** Gruppespill 3-panel editor, predictions med RLS-låsing, ligaer + invitasjon.

**M3 — Fasit & poeng (dag 2):** Cron-ruter (sync-tournament, grade), poengberegning, ligatabell.

**M4 — Odds & nyheter (dag 2–3):** sync-odds (Norsk Tipping), sync-news (Independent), hjem-dashboard.

**M5 — Sluttspill & special bets (dag 3):** Sluttspill-editor (H/B), special bets-velger + admin-grading.

**M6 — Polish (dag 3–4):** FM-tabell-tab, høyre statistikk-panel, custom views.

---

## 11. Åpne punkter (avklares ved implementasjon)
- Norsk Tipping outright-markeder for special-bet-odds — finnes de? Ellers ren tropp-velger.
- Eksakt verifisering av `score.winner`/`duration` ved første sluttspillkamp (straffer).
- Navne-matching klubbstats ↔ VM-spillere (delvis dekning forventet).
- Admin-rolle: hvem kan sette `special_bet_results` (sannsynligvis pool-owner eller global admin).
