-- Per-player squad stats (from Sofascore "Players" tab) for the same season as
-- team_stats. Stored as a JSONB array on team_stats. Filled by enrich-team-stats.py.

alter table team_stats add column if not exists top_players jsonb not null default '[]';
