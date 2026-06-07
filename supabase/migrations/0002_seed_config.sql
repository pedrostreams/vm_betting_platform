-- Scoring configuration seed. Re-runnable.

-- Points per stage. Group stage = HUB (3 outcomes); knockout = who advances.
-- THIRD_PLACE (bronze final) is a knockout-advance bet, scored like a semifinal.
insert into stage_points (stage, points) values
  ('GROUP_STAGE',     2),
  ('LAST_32',         3),
  ('LAST_16',         4),
  ('QUARTER_FINALS',  6),
  ('SEMI_FINALS',     8),
  ('THIRD_PLACE',     8),
  ('FINAL',          12)
on conflict (stage) do update set points = excluded.points;

-- The five special bets (all sourced from Polymarket).
insert into special_bet_types (id, name, points, kind, sort_order) values
  ('winner',            'Hvem vinner VM?',     10, 'team',   1),
  ('top_scorer',        'Toppscorer',           8, 'player', 2),
  ('top_assist',        'Assistkonge',          6, 'player', 3),
  ('top_scorer_nation', 'Land med toppscorer',  5, 'team',   4),
  ('clean_sheet',       'Rent bur (keeper)',    4, 'keeper', 5)
on conflict (id) do update set
  name       = excluded.name,
  points     = excluded.points,
  kind       = excluded.kind,
  sort_order = excluded.sort_order;
