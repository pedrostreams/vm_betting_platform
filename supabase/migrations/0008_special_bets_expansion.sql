-- Expand special bets: three new candidate-list bets (continent, goal
-- contributions, finalist) and a batch of fun binary YES/NO props. Binary props
-- store the chosen candidate as 'JA' / 'NEI'; the Polymarket slug + implied odds
-- are resolved in code (see POLYMARKET_SLUG / fetchYesProb).

-- Widen the kind constraint to allow 'continent' and 'binary'.
alter table special_bet_types drop constraint if exists special_bet_types_kind_check;
alter table special_bet_types
  add constraint special_bet_types_kind_check
  check (kind in ('team', 'player', 'keeper', 'continent', 'binary'));

insert into special_bet_types (id, name, points, kind, sort_order) values
  -- candidate-list bets
  ('continent',          'Hvilket kontinent vinner VM?',     5, 'continent', 6),
  ('goal_contributions', 'Flest målpoeng (mål + assist)',    8, 'player',    7),
  ('finalist',           'Land i finalen',                    5, 'team',      8),
  -- fun binary YES/NO props
  ('p_keeper_scores',    'Scorer en keeper i VM?',            3, 'binary',   20),
  ('p_nation_never_won', 'Vinner en nasjon som aldri har vunnet VM før?', 4, 'binary', 21),
  ('p_scoreless_team',   'Går et lag målløst ut av VM?',      2, 'binary',   22),
  ('p_messi_free_kick',  'Scorer Messi på frispark i VM?',    3, 'binary',   23),
  ('p_ronaldo_cry',      'Gråter Ronaldo på TV under VM?',    2, 'binary',   24)
on conflict (id) do update set
  name       = excluded.name,
  points     = excluded.points,
  kind       = excluded.kind,
  sort_order = excluded.sort_order;
