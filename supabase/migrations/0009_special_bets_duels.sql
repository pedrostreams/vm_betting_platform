-- Player duels (head-to-head "who scores/contributes more") + two more binary
-- props (Trump at the USA opener, a Mexico game being relocated). Duels are a
-- two-choice bet like binary props, but the two options are player names parsed
-- from the Polymarket H2H market title; the chosen candidate is stored as the
-- player's name.

-- Widen the kind constraint to also allow 'duel'.
alter table special_bet_types drop constraint if exists special_bet_types_kind_check;
alter table special_bet_types
  add constraint special_bet_types_kind_check
  check (kind in ('team', 'player', 'keeper', 'continent', 'binary', 'duel'));

insert into special_bet_types (id, name, points, kind, sort_order) values
  -- extra binary YES/NO props
  ('p_trump_opener',     'Møter Trump opp på USAs åpningskamp?', 2, 'binary', 25),
  ('p_mexico_relocated', 'Blir en VM-kamp i Mexico flyttet?',     2, 'binary', 26),
  -- player duels: most goals
  ('d_messi_ronaldo',      'Flest mål: Messi vs. Ronaldo',        3, 'duel', 30),
  ('d_yamal_mbappe',       'Flest mål: Yamal vs. Mbappé',         3, 'duel', 31),
  ('d_haaland_alvarez',    'Flest mål: Haaland vs. Álvarez',      3, 'duel', 32),
  ('d_salah_mane',         'Flest mål: Salah vs. Mané',           3, 'duel', 33),
  ('d_dembele_olise',      'Flest mål: Dembélé vs. Olise',        3, 'duel', 34),
  -- player duels: most goal contributions
  ('d_valverde_fernandes', 'Flest målpoeng: Valverde vs. Fernandes', 3, 'duel', 35),
  ('d_vitinha_pedri',      'Flest målpoeng: Vitinha vs. Pedri',      3, 'duel', 36)
on conflict (id) do update set
  name       = excluded.name,
  points     = excluded.points,
  kind       = excluded.kind,
  sort_order = excluded.sort_order;
