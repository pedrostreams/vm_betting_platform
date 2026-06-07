-- Seed Europe's top 5 leagues and their current 2025/26 seasons.
-- Sportmonks IDs verified via /football/leagues and /football/seasons.

insert into leagues (id, name, country, sportmonks_id) values
  (8,   'Premier League', 'England', 8),
  (564, 'La Liga',        'Spain',   564),
  (384, 'Serie A',        'Italy',   384),
  (82,  'Bundesliga',     'Germany', 82),
  (301, 'Ligue 1',        'France',  301)
on conflict (id) do update set
  name    = excluded.name,
  country = excluded.country;

-- Mark prior is_current rows non-current to satisfy
-- uq_seasons_one_current_per_league before inserting the new ones.
update seasons set is_current = false where is_current = true;

insert into seasons (id, league_id, name, is_current) values
  (25583, 8,   '2025/26', true),
  (25659, 564, '2025/26', true),
  (25533, 384, '2025/26', true),
  (25646, 82,  '2025/26', true),
  (25651, 301, '2025/26', true)
on conflict (id) do update set
  name       = excluded.name,
  is_current = excluded.is_current;
