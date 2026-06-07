-- VM 2026 tippekonkurranse — initial schema.
-- Idempotent where practical. Reference/tournament tables are written only by
-- the service role (cron + seed); RLS protects user-owned rows.

-- ============================================================================
-- TOURNAMENT DATA (written by service role: seed + daily cron)
-- ============================================================================

create table if not exists teams (
  id          integer primary key,              -- football-data team id
  name        text not null,
  tla         text,                             -- 3-letter code, e.g. NOR
  crest_url   text,
  group_code  text                              -- e.g. GROUP_A
);

create table if not exists players (
  id            integer primary key,            -- football-data player id
  team_id       integer references teams(id) on delete cascade,
  name          text not null,
  position      text,
  date_of_birth date,
  is_goalkeeper boolean not null default false
);
create index if not exists players_team_idx on players(team_id);
create index if not exists players_gk_idx on players(is_goalkeeper) where is_goalkeeper;

create table if not exists matches (
  id           integer primary key,             -- football-data match id
  stage        text not null,                   -- GROUP_STAGE, LAST_32, ... FINAL
  group_code   text,
  matchday     integer,
  utc_date     timestamptz not null,
  -- Tips lock 15 minutes before kickoff. Set at ingest (timestamptz - interval
  -- is only STABLE, so it can't be a generated column).
  lock_at      timestamptz not null,
  home_team_id integer references teams(id),    -- null for TBD knockout slots
  away_team_id integer references teams(id),
  status       text not null default 'TIMED',   -- TIMED, IN_PLAY, FINISHED, ...
  home_score   integer,                         -- 90-min (fullTime) score
  away_score   integer,
  winner       text,                            -- HOME_TEAM, AWAY_TEAM, DRAW (incl. ET/pens)
  duration     text                             -- REGULAR, EXTRA_TIME, PENALTY_SHOOTOUT
);
create index if not exists matches_stage_idx on matches(stage);
create index if not exists matches_utc_idx on matches(utc_date);

create table if not exists match_odds (
  match_id   integer primary key references matches(id) on delete cascade,
  home_odds  numeric(6,2),
  draw_odds  numeric(6,2),
  away_odds  numeric(6,2),
  source     text not null default 'norsk-tipping',
  fetched_at timestamptz not null default now()
);

create table if not exists news (
  id           bigint generated always as identity primary key,
  title        text not null,
  link         text not null unique,
  published_at timestamptz,
  source       text not null,
  fetched_at   timestamptz not null default now()
);
create index if not exists news_published_idx on news(published_at desc);

-- ============================================================================
-- SCORING CONFIG (seeded; read-only to clients)
-- ============================================================================

create table if not exists stage_points (
  stage  text primary key,
  points integer not null
);

create table if not exists special_bet_types (
  id         text primary key,                  -- slug: winner, top_scorer, ...
  name       text not null,
  points     integer not null,
  kind       text not null check (kind in ('team','player','keeper')),
  sort_order integer not null default 0
);

-- ============================================================================
-- USERS & LEAGUES
-- ============================================================================

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text,
  agreed_terms_at timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists app_admins (
  user_id uuid primary key references profiles(id) on delete cascade
);

create table if not exists pools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references profiles(id) on delete cascade,
  invite_code text not null unique,
  buy_in_nok  integer not null default 200,
  created_at  timestamptz not null default now()
);

create table if not exists pool_members (
  pool_id   uuid references pools(id) on delete cascade,
  user_id   uuid references profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

-- ============================================================================
-- PREDICTIONS
-- ============================================================================

create table if not exists predictions (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  match_id   integer not null references matches(id) on delete cascade,
  pick       text not null check (pick in ('H','U','B')),  -- knockout uses only H/B
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index if not exists predictions_match_idx on predictions(match_id);

create table if not exists special_bet_picks (
  user_id     uuid not null references profiles(id) on delete cascade,
  bet_type_id text not null references special_bet_types(id) on delete cascade,
  team_id     integer references teams(id),
  player_id   integer references players(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, bet_type_id)
);

create table if not exists special_bet_results (
  bet_type_id       text primary key references special_bet_types(id) on delete cascade,
  winning_team_id   integer references teams(id),
  winning_player_id integer references players(id),
  decided_at        timestamptz not null default now()
);

-- ============================================================================
-- SCORES (recomputed by grading cron; read-only to clients)
-- ============================================================================

create table if not exists user_scores (
  user_id              uuid primary key references profiles(id) on delete cascade,
  total_points         integer not null default 0,
  group_points         integer not null default 0,
  knockout_points      integer not null default 0,
  special_points       integer not null default 0,
  exact_knockout_count integer not null default 0,   -- tie-break 1
  correct_special_count integer not null default 0,  -- tie-break 2
  updated_at           timestamptz not null default now()
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- True once the tournament's first kickoff has passed (special bets lock).
create or replace function tournament_started()
returns boolean
language sql stable
as $$
  select coalesce((select min(utc_date) from matches) <= now(), false);
$$;

-- Auto-create a profile row when a new auth user signs up.
create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table teams              enable row level security;
alter table players            enable row level security;
alter table matches            enable row level security;
alter table match_odds         enable row level security;
alter table news               enable row level security;
alter table stage_points       enable row level security;
alter table special_bet_types  enable row level security;
alter table profiles           enable row level security;
alter table app_admins         enable row level security;
alter table pools              enable row level security;
alter table pool_members       enable row level security;
alter table predictions        enable row level security;
alter table special_bet_picks  enable row level security;
alter table special_bet_results enable row level security;
alter table user_scores        enable row level security;

-- Public read-only reference data (service role bypasses RLS for writes).
do $$
declare t text;
begin
  foreach t in array array['teams','players','matches','match_odds','news',
                           'stage_points','special_bet_types','special_bet_results',
                           'user_scores']
  loop
    execute format('drop policy if exists %I_read on %I', t, t);
    execute format('create policy %I_read on %I for select using (true)', t, t);
  end loop;
end $$;

-- profiles: everyone can read display names (leaderboards); manage only your own.
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);
drop policy if exists profiles_upsert on profiles;
create policy profiles_upsert on profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- app_admins: readable so the UI can show admin controls; not writable by clients.
drop policy if exists app_admins_read on app_admins;
create policy app_admins_read on app_admins for select using (true);

-- pools: any authenticated user can read (needed to join by invite code) and create.
drop policy if exists pools_read on pools;
create policy pools_read on pools for select to authenticated using (true);
drop policy if exists pools_insert on pools;
create policy pools_insert on pools for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists pools_update on pools;
create policy pools_update on pools for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- pool_members: read membership of pools you belong to; join/leave yourself.
drop policy if exists pool_members_read on pool_members;
create policy pool_members_read on pool_members for select to authenticated
  using (exists (select 1 from pool_members m where m.pool_id = pool_members.pool_id and m.user_id = auth.uid()));
drop policy if exists pool_members_insert on pool_members;
create policy pool_members_insert on pool_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists pool_members_delete on pool_members;
create policy pool_members_delete on pool_members for delete to authenticated using (user_id = auth.uid());

-- predictions: see your own always; others only after that match locks.
-- Write only your own, and only before the match locks.
drop policy if exists predictions_select on predictions;
create policy predictions_select on predictions for select to authenticated
  using (user_id = auth.uid()
         or now() >= (select lock_at from matches where id = predictions.match_id));
drop policy if exists predictions_insert on predictions;
create policy predictions_insert on predictions for insert to authenticated
  with check (user_id = auth.uid()
              and now() < (select lock_at from matches where id = predictions.match_id));
drop policy if exists predictions_update on predictions;
create policy predictions_update on predictions for update to authenticated
  using (user_id = auth.uid()
         and now() < (select lock_at from matches where id = predictions.match_id))
  with check (user_id = auth.uid()
              and now() < (select lock_at from matches where id = predictions.match_id));

-- special_bet_picks: see your own always; others after first kickoff.
-- Write only your own, and only before first kickoff.
drop policy if exists sbp_select on special_bet_picks;
create policy sbp_select on special_bet_picks for select to authenticated
  using (user_id = auth.uid() or tournament_started());
drop policy if exists sbp_insert on special_bet_picks;
create policy sbp_insert on special_bet_picks for insert to authenticated
  with check (user_id = auth.uid() and not tournament_started());
drop policy if exists sbp_update on special_bet_picks;
create policy sbp_update on special_bet_picks for update to authenticated
  using (user_id = auth.uid() and not tournament_started())
  with check (user_id = auth.uid() and not tournament_started());
