-- Special bets are now sourced entirely from Polymarket. Picks and results store
-- the candidate NAME (Polymarket's label), not a player/team FK — no cross-source
-- name matching needed. Safe: no real picks exist yet.

alter table special_bet_picks drop column if exists team_id;
alter table special_bet_picks drop column if exists player_id;
alter table special_bet_picks add column if not exists candidate text;

alter table special_bet_results drop column if exists winning_team_id;
alter table special_bet_results drop column if exists winning_player_id;
alter table special_bet_results add column if not exists winning_candidate text;

-- 'most_goals' (no Polymarket market) replaced by 'top_scorer_nation' in 0002;
-- remove any leftover row from earlier runs.
delete from special_bet_types where id = 'most_goals';
