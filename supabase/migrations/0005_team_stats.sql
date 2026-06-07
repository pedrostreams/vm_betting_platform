-- Detailed national-team stats (decision-support "snacks"), enriched one-time
-- from Sofascore via scripts/enrich-team-stats.py. Read-only to clients.

create table if not exists team_stats (
  team_id           integer primary key references teams(id) on delete cascade,
  sofascore_id      integer,
  source_tournament text,          -- e.g. "World Cup Qual. UEFA 2026"
  matches           integer,
  stats             jsonb not null default '{}',  -- curated key stats
  fetched_at        timestamptz not null default now()
);

alter table team_stats enable row level security;
drop policy if exists team_stats_read on team_stats;
create policy team_stats_read on team_stats for select using (true);
