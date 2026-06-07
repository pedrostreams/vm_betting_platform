// Reads tmp/sofascore.json (produced by scripts/fetch-sofascore.py),
// matches each Sofascore row to a Sportmonks player via the shared matcher,
// and upserts the resulting stats into player_season_stats.
//
// Mirror of scripts/ingest-understat.ts. Differences:
//   - Sofascore has its own `minutesPlayed` field; we use it as the denominator
//     for per-90 derivations but DON'T upsert it (Sportmonks owns minutes).
//   - Source label is 'sofascore'; unmatched rows go to tmp/sofascore-unmatched.json.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/ingest-sofascore.ts          # commit
//   npx tsx --env-file=.env.local scripts/ingest-sofascore.ts --dry    # match only

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { adminClient } from "../lib/supabase/admin";
import {
  matchPlayers,
  type SourceRow,
  type SportmonksPlayer,
  type SportmonksTeam,
} from "../lib/matching/players";

interface SofascoreRow extends SourceRow {
  season: string;
  sofascore_id: string | null;
  /** Source-provided minutes — used for per-90 derivation only, never written. */
  minutes: number | null;
  stats: Record<string, number>;
}

// Sofascore league code -> Sportmonks league_id (matches supabase/seed/leagues_seasons.sql).
const LEAGUE_BY_CODE = new Map<string, number>([
  ["ENG-Premier League", 8],
  ["ESP-La Liga", 564],
  ["ITA-Serie A", 384],
  ["GER-Bundesliga", 82],
  ["FRA-Ligue 1", 301],
]);

// Counter stats whose per-90 derivation we want to write. Keys are stat ids
// from migration 0008; values are the corresponding per_90 catalog ids.
const PER_90_OUTPUT_ID: Record<string, string> = {
  ball_recoveries:              "ball_recoveries_per_90",
  possession_won_att_third:     "possession_won_att_third_per_90",
  accurate_final_third_passes:  "accurate_final_third_passes_per_90",
  accurate_long_balls:          "accurate_long_balls_per_90",
  accurate_opp_half_passes:     "accurate_opp_half_passes_per_90",
  pass_to_assist:               "pass_to_assist_per_90",
  big_chances_created:          "big_chances_created_per_90",
};

// Same 270-min floor used by ingest-understat.ts. Below this, per-90 figures
// are noise (3-match minimum is the FBref/Wyscout convention).
const PER_90_MIN_MINUTES = 270;

const BATCH_SIZE = 200;

interface SofascorePayload {
  season: string;
  rows: SofascoreRow[];
}

async function chunkedUpsert<T extends object>(
  table: string,
  rows: T[],
  onConflict: string,
): Promise<void> {
  if (rows.length === 0) return;
  const sb = adminClient();
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

async function loadAllPaged<T>(table: string, columns: string): Promise<T[]> {
  const sb = adminClient();
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`load ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...(data as T[]));
    if (data.length < PAGE) break;
  }
  return out;
}

async function loadSportmonks() {
  const teams = await loadAllPaged<SportmonksTeam>("teams", "id, name, league_id");
  const players = await loadAllPaged<{ id: number; name: string; current_team_id: number | null }>(
    "players",
    "id, name, current_team_id",
  );

  const teamLeagueMap = new Map<number, number | null>();
  for (const t of (teams ?? []) as SportmonksTeam[]) teamLeagueMap.set(t.id, t.league_id);

  const enrichedPlayers: SportmonksPlayer[] = (players ?? []).map((p: { id: number; name: string; current_team_id: number | null }) => ({
    id: p.id,
    name: p.name,
    current_team_id: p.current_team_id,
    team_league_id: p.current_team_id != null ? teamLeagueMap.get(p.current_team_id) ?? null : null,
  }));

  return {
    teams: (teams ?? []) as SportmonksTeam[],
    players: enrichedPlayers,
  };
}

async function loadCurrentSeasonByLeague(): Promise<Map<number, number>> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("seasons")
    .select("id, league_id")
    .eq("is_current", true);
  if (error) throw new Error(`load seasons: ${error.message}`);
  const out = new Map<number, number>();
  for (const s of data ?? []) out.set(s.league_id, s.id);
  return out;
}

function per90(value: number, minutes: number): number | null {
  if (!minutes || minutes < PER_90_MIN_MINUTES) return null;
  return Math.round((value * 90) / minutes * 100) / 100;
}

async function main() {
  const dryRun = process.argv.includes("--dry");

  const jsonPath = resolve(__dirname, "..", "tmp", "sofascore.json");
  let payload: SofascorePayload;
  try {
    payload = JSON.parse(readFileSync(jsonPath, "utf-8"));
  } catch (e) {
    throw new Error(`failed to read ${jsonPath} - run scripts/fetch-sofascore.py first: ${(e as Error).message}`);
  }
  console.log(`[sofascore] loaded ${payload.rows.length} rows for season ${payload.season}`);

  const [{ teams, players }, seasonByLeague] = await Promise.all([
    loadSportmonks(),
    loadCurrentSeasonByLeague(),
  ]);
  console.log(`[sofascore] loaded ${players.length} players, ${teams.length} teams from Sportmonks`);

  const { hits, misses } = matchPlayers(payload.rows, players, teams, LEAGUE_BY_CODE);

  // Confidence breakdown
  const byConf = new Map<string, number>();
  for (const h of hits) byConf.set(h.confidence, (byConf.get(h.confidence) ?? 0) + 1);
  console.log(`[sofascore] matched ${hits.length}/${payload.rows.length}:`);
  for (const [c, n] of byConf) console.log(`             ${n.toString().padStart(5)} ${c}`);
  console.log(`[sofascore] unmatched: ${misses.length}`);

  // Always dump unmatched for review
  const unmatchedPath = resolve(__dirname, "..", "tmp", "sofascore-unmatched.json");
  mkdirSync(dirname(unmatchedPath), { recursive: true });
  writeFileSync(unmatchedPath, JSON.stringify(misses, null, 2), "utf-8");
  console.log(`[sofascore] wrote ${unmatchedPath}`);

  if (dryRun) {
    console.log("[sofascore] --dry: skipping upsert");
    return;
  }

  // Aggregate by (player_id, season_id, stat_id). Mid-season transfers produce
  // two rows per source player; sum counter stats. For percentage/ratio stats
  // (the only sofascore non-counters in our catalog are *_pct and rating),
  // last-write-wins is the simplest correct policy — averaging across teams
  // would need games-played weights we don't have here.
  type StatRow = { player_id: number; season_id: number; stat_id: string; value: number | null };
  const summed = new Map<string, StatRow>();
  // Track minutes per (player_id, season_id) for per-90 denominators.
  const minutesByKey = new Map<string, number>();

  // Stats that are percentages/ratios — last-write-wins instead of summed.
  const NON_SUMMABLE = new Set([
    "accurate_long_balls_pct",
    "ground_duels_won_pct",
    "goal_conversion_pct",
    "sofa_rating",
  ]);

  let skippedNoSeason = 0;
  let mergedDuplicates = 0;

  for (const h of hits) {
    const leagueId = LEAGUE_BY_CODE.get(h.row.league);
    const seasonId = leagueId != null ? seasonByLeague.get(leagueId) : undefined;
    if (seasonId == null) {
      skippedNoSeason++;
      continue;
    }

    const psKey = `${h.player_id}|${seasonId}`;
    if (h.row.minutes != null && Number.isFinite(h.row.minutes)) {
      minutesByKey.set(psKey, (minutesByKey.get(psKey) ?? 0) + h.row.minutes);
    }

    for (const [statId, value] of Object.entries(h.row.stats)) {
      if (value == null || !Number.isFinite(value)) continue;
      const key = `${h.player_id}|${seasonId}|${statId}`;
      const existing = summed.get(key);
      if (existing) {
        if (NON_SUMMABLE.has(statId)) {
          existing.value = value; // last-write-wins for ratios
        } else {
          existing.value = (existing.value ?? 0) + value;
        }
        mergedDuplicates++;
      } else {
        summed.set(key, { player_id: h.player_id, season_id: seasonId, stat_id: statId, value });
      }
    }
  }

  // Derive per-90s from the summed totals using the source-side minutes.
  for (const [counterId, outId] of Object.entries(PER_90_OUTPUT_ID)) {
    for (const [, row] of summed) {
      if (row.stat_id !== counterId || row.value == null) continue;
      const minutes = minutesByKey.get(`${row.player_id}|${row.season_id}`) ?? 0;
      const v = per90(row.value, minutes);
      summed.set(`${row.player_id}|${row.season_id}|${outId}`, {
        player_id: row.player_id,
        season_id: row.season_id,
        stat_id: outId,
        value: v,
      });
    }
  }

  if (skippedNoSeason > 0) {
    console.warn(`[sofascore] skipped ${skippedNoSeason} hits with no current season for the league`);
  }
  if (mergedDuplicates > 0) {
    console.log(`[sofascore] merged ${mergedDuplicates} duplicate stat values from mid-season transfers`);
  }

  const statRows = [...summed.values()];
  console.log(`[sofascore] upserting ${statRows.length} stat rows`);
  await chunkedUpsert("player_season_stats", statRows, "player_id,season_id,stat_id");
  console.log("[sofascore] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
