-- Add full_name (collected at registration). display_name now holds the
-- "lagnavn" (team name) shown as the leaderboard row title; full_name is the
-- subtitle.

alter table profiles add column if not exists full_name text;
