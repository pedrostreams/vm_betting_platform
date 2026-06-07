-- Stat catalog seed.
-- source_field is the Sportmonks slug or 'derived' for computed stats.
-- Re-runnable: insert ... on conflict (id) do update.

-- Remove stats that were trimmed when we reconciled against Sportmonks
-- /core/types (FBref-style metrics that Sportmonks doesn't expose, plus the
-- separate sub on/off split). Cascades to player_season_stats.
delete from stat_catalog where id in (
  'subbed_on', 'subbed_off',
  'shot_creating_actions', 'goal_creating_actions',
  'shot_creating_actions_per_90',
  'progressive_passes', 'progressive_passes_per_90',
  'xa', 'xa_per_90',
  'touches_att_third', 'touches_pen_area',
  'carries', 'progressive_carries', 'progressive_carries_per_90',
  'miscontrols',
  'ball_recoveries', 'ball_recoveries_per_90',
  'errors_to_shot',
  'save_pct', 'shots_faced', 'penalties_faced', 'sweeper_actions'
);

insert into stat_catalog (id, display_name, category, unit, description, source_field, sort_order) values

-- ============================================================================
-- AGGREGATE
-- ============================================================================
('minutes',           'Minutes',            'aggregate', 'count',    'Minutes played in the season',          'minutes_played',  10),
('appearances',       'Appearances',        'aggregate', 'count',    'Total appearances',                     'appearances',     11),
('starts',            'Starts',             'aggregate', 'count',    'Starting appearances',                  'lineups',         12),
('substitutions',     'Substitutions',      'aggregate', 'count',    'Total substitutions (on or off)',       'substitutions',   13),
('age',               'Age',                'aggregate', 'years',    'Player age in years',                   'derived',         15),
('market_value_eur',  'Market Value (€)',   'aggregate', 'currency', 'Estimated market value',                'market_value',    16),
('position',          'Position',           'aggregate', 'enum',     'Primary position',                      'position',        17),

-- ============================================================================
-- SHOOTING
-- ============================================================================
('goals',                  'Goals',                  'shooting', 'count',   'Goals scored',                           'goals',                 100),
('shots',                  'Shots',                  'shooting', 'count',   'Total shots',                            'shots_total',           101),
('shots_on_target',        'Shots on Target',        'shooting', 'count',   'Shots on target',                        'shots_on_target',       102),
('shot_accuracy',          'Shot Accuracy',          'shooting', 'percent', 'SoT / Shots',                            'derived',               103),
('xg',                     'xG',                     'shooting', 'count',   'Expected goals',                         'expected_goals',        104),
('npxg',                   'npxG',                   'shooting', 'count',   'Non-penalty expected goals',             'non_penalty_xg',        105),
('npxg_per_shot',          'npxG / Shot',            'shooting', 'ratio',   'npxG divided by shots',                  'derived',               106),
('goals_minus_xg',         'Goals - xG',             'shooting', 'count',   'Overperformance vs expected goals',      'derived',               107),
('penalty_goals',          'Penalty Goals',          'shooting', 'count',   'Goals from penalties',                   'penalty_goals',         108),
('big_chances_missed',     'Big Chances Missed',     'shooting', 'count',   'Big chances missed',                     'big_chances_missed',    111),

-- ============================================================================
-- PASSING
-- ============================================================================
('passes_attempted',         'Passes Attempted',        'passing', 'count',   'All passes attempted',           'passes_total',          200),
('passes_completed',         'Passes Completed',        'passing', 'count',   'All passes completed',           'accurate_passes',       201),
('pass_completion_pct',      'Pass Completion %',       'passing', 'percent', 'Completed / Attempted',          'derived',               202),
('key_passes',               'Key Passes',              'passing', 'count',   'Passes leading to a shot',       'key_passes',            204),
('assists',                  'Assists',                 'passing', 'count',   'Assists',                        'assists',               205),
('through_balls',            'Through Balls',           'passing', 'count',   'Through balls',                  'through_balls',         207),
('long_passes_attempted',    'Long Passes Attempted',   'passing', 'count',   'Long passes attempted',          'long_passes',           208),
('crosses_attempted',        'Crosses Attempted',       'passing', 'count',   'Crosses attempted',              'crosses_total',         210),
('crosses_completed',        'Crosses Completed',       'passing', 'count',   'Crosses completed',              'accurate_crosses',      211),
('cross_completion_pct',     'Cross Completion %',      'passing', 'percent', 'Crosses completed / attempted',  'derived',               212),
('chances_created',          'Chances Created',         'passing', 'count',   'Total chances created',          'chances_created',       213),

-- ============================================================================
-- POSSESSION
-- ============================================================================
('touches',               'Touches',               'possession', 'count',   'Total touches',                          'touches',                300),
('take_ons_attempted',     'Take-Ons Attempted',    'possession', 'count',   'Take-ons attempted',                     'dribbles_attempts',      303),
('take_ons_completed',     'Take-Ons Completed',    'possession', 'count',   'Take-ons completed',                     'successful_dribbles',    304),
('take_on_success_pct',    'Take-On Success %',     'possession', 'percent', 'Take-ons successful / attempted',        'derived',                305),
('dispossessed',           'Dispossessed',          'possession', 'count',   'Times dispossessed',                     'dispossessed',           308),

-- ============================================================================
-- DEFENDING
-- ============================================================================
('tackles',              'Tackles',               'defending', 'count',   'Tackles attempted',              'tackles',              400),
('tackles_won',          'Tackles Won',           'defending', 'count',   'Tackles won',                    'tackles_won',          401),
('tackle_success_pct',   'Tackle Success %',      'defending', 'percent', 'Tackles won / attempted',        'derived',              402),
('interceptions',        'Interceptions',         'defending', 'count',   'Interceptions',                  'interceptions',        403),
('blocks',               'Blocks',                'defending', 'count',   'Blocks',                         'blocks',               404),
('clearances',           'Clearances',            'defending', 'count',   'Clearances',                     'clearances',           405),
('aerials_won',          'Aerials Won',           'defending', 'count',   'Aerial duels won',               'aerial_duels_won',     406),
('aerials_lost',         'Aerials Lost',          'defending', 'count',   'Aerial duels lost',              'aerial_duels_lost',    407),
('aerial_win_pct',       'Aerial Win %',          'defending', 'percent', 'Aerials won / total aerials',    'derived',              408),
('duels_won',            'Duels Won',             'defending', 'count',   'Total duels won',                'duels_won',            410),

-- ============================================================================
-- DISCIPLINE
-- ============================================================================
('yellow_cards',         'Yellow Cards',          'discipline', 'count', 'Yellow cards',                  'yellowcards',          500),
('red_cards',            'Red Cards',             'discipline', 'count', 'Red cards',                     'redcards',             501),
('fouls_committed',      'Fouls Committed',       'discipline', 'count', 'Fouls committed',               'fouls_committed',      502),
('fouls_drawn',          'Fouls Drawn',           'discipline', 'count', 'Fouls drawn',                   'fouls_drawn',          503),
('offsides',             'Offsides',              'discipline', 'count', 'Times caught offside',          'offsides',             504),

-- ============================================================================
-- GOALKEEPING
-- ============================================================================
('saves',                'Saves',                 'goalkeeping', 'count',   'Saves',                                 'saves',                  600),
('goals_against',        'Goals Against',         'goalkeeping', 'count',   'Goals conceded',                        'goals_conceded',         603),
('clean_sheets',         'Clean Sheets',          'goalkeeping', 'count',   'Clean sheets',                          'cleansheets',            604),
('post_shot_xg',         'PSxG',                  'goalkeeping', 'count',   'Post-shot expected goals faced',        'post_shot_xg',           605),
('psxg_minus_ga',        'PSxG +/-',              'goalkeeping', 'count',   'PSxG minus goals against (saves added)','derived',                606),
('penalties_saved',      'Penalties Saved',       'goalkeeping', 'count',   'Penalties saved',                       'penalties_saved',        608)

on conflict (id) do update set
  display_name = excluded.display_name,
  category     = excluded.category,
  unit         = excluded.unit,
  description  = excluded.description,
  source_field = excluded.source_field,
  sort_order   = excluded.sort_order;

-- ============================================================================
-- Per-90 derived stats
-- These are computed at ingest time; source_field = 'derived'.
-- ============================================================================

insert into stat_catalog (id, display_name, category, unit, description, source_field, sort_order) values
('minutes_per_app',                   'Minutes / Appearance',         'aggregate',   'ratio',  'Average minutes per appearance',  'derived', 18),
('xg_per_90',                         'xG / 90',                      'shooting',    'per_90', 'Expected goals per 90',           'derived', 120),
('npxg_per_90',                       'npxG / 90',                    'shooting',    'per_90', 'Non-penalty xG per 90',           'derived', 121),
('shots_per_90',                      'Shots / 90',                   'shooting',    'per_90', 'Shots per 90',                    'derived', 122),
('key_passes_per_90',                 'Key Passes / 90',              'passing',     'per_90', 'Key passes per 90',               'derived', 222),
('crosses_per_90',                    'Crosses / 90',                 'passing',     'per_90', 'Crosses attempted per 90',        'derived', 223),
('take_ons_per_90',                   'Take-Ons / 90',                'possession',  'per_90', 'Take-ons attempted per 90',       'derived', 321),
('tackles_per_90',                    'Tackles / 90',                 'defending',   'per_90', 'Tackles per 90',                  'derived', 420),
('interceptions_per_90',              'Interceptions / 90',           'defending',   'per_90', 'Interceptions per 90',            'derived', 421),
('blocks_per_90',                     'Blocks / 90',                  'defending',   'per_90', 'Blocks per 90',                   'derived', 422),
('clearances_per_90',                 'Clearances / 90',              'defending',   'per_90', 'Clearances per 90',               'derived', 423)
on conflict (id) do update set
  display_name = excluded.display_name,
  source_field = excluded.source_field,
  sort_order   = excluded.sort_order;
