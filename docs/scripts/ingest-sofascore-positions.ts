// Reads tmp/sofascore-positions.json (produced by fetch-sofascore-positions.py),
// matches each row to a Sportmonks player via the shared cascade, and updates
// players.position_sofa with a comma-joined position list (e.g. "DM,MC").
//
// Mirror of scripts/ingest-understat.ts's position_detailed handling.
// We use grouped UPDATE-by-value rather than upsert because some matched
// player_ids may not exist in `players` (drift mid-run); upsert would try to
// INSERT those, hitting the NOT NULL constraint on `name`.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/ingest-sofascore-positions.ts          # commit
//   npx tsx --env-file=.env.local scripts/ingest-sofascore-positions.ts --dry    # match only

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { adminClient } from "../lib/supabase/admin";
import {
  matchPlayers,
  type SourceRow,
  type SportmonksPlayer,
  type SportmonksTeam,
} from "../lib/matching/players";

interface SofaPositionRow extends SourceRow {
  sofascore_id: string | null;
  positions: string[];
}

interface Payload {
  season: string;
  rows: SofaPositionRow[];
}

const LEAGUE_BY_CODE = new Map<string, number>([
  ["ENG-Premier League", 8],
  ["ESP-La Liga", 564],
  ["ITA-Serie A", 384],
  ["GER-Bundesliga", 82],
  ["FRA-Ligue 1", 301],
]);

const BATCH_SIZE = 200;

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
  for (const t of teams) teamLeagueMap.set(t.id, t.league_id);
  const enriched: SportmonksPlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    current_team_id: p.current_team_id,
    team_league_id: p.current_team_id != null ? teamLeagueMap.get(p.current_team_id) ?? null : null,
  }));
  return { teams, players: enriched };
}

async function main() {
  const dryRun = process.argv.includes("--dry");
  const jsonPath = resolve(__dirname, "..", "tmp", "sofascore-positions.json");

  let payload: Payload;
  try {
    payload = JSON.parse(readFileSync(jsonPath, "utf-8"));
  } catch (e) {
    throw new Error(
      `failed to read ${jsonPath} - run scripts/fetch-sofascore-positions.py first: ${(e as Error).message}`,
    );
  }
  console.log(`[positions] loaded ${payload.rows.length} rows for season ${payload.season}`);

  const { teams, players } = await loadSportmonks();
  console.log(`[positions] loaded ${players.length} players, ${teams.length} teams from Sportmonks`);

  const { hits, misses } = matchPlayers(payload.rows, players, teams, LEAGUE_BY_CODE);

  const byConf = new Map<string, number>();
  for (const h of hits) byConf.set(h.confidence, (byConf.get(h.confidence) ?? 0) + 1);
  console.log(`[positions] matched ${hits.length}/${payload.rows.length}:`);
  for (const [c, n] of byConf) console.log(`             ${n.toString().padStart(5)} ${c}`);
  console.log(`[positions] unmatched: ${misses.length}`);

  const unmatchedPath = resolve(__dirname, "..", "tmp", "sofascore-positions-unmatched.json");
  mkdirSync(dirname(unmatchedPath), { recursive: true });
  writeFileSync(unmatchedPath, JSON.stringify(misses, null, 2), "utf-8");

  if (dryRun) {
    console.log("[positions] --dry: skipping update");
    return;
  }

  // Group player_ids by their joined-positions key (e.g. "DM,MC") so we can
  // issue one UPDATE per unique combination. Sofascore returns a small set of
  // distinct lists across a league (RW, DM/MC, ST, DC, etc.) so this stays
  // cheap. Same pattern as ingest-understat.ts's position_detailed update.
  // We use UPDATE rather than upsert because some matched player_ids may not
  // exist in `players` (drift mid-run); upsert would try to INSERT those,
  // hitting the NOT NULL constraint on `name`.
  const idsByKey = new Map<string, { positions: string[]; ids: number[] }>();
  for (const h of hits) {
    if (!h.row.positions || h.row.positions.length === 0) continue;
    const key = h.row.positions.join(",");
    const entry = idsByKey.get(key) ?? { positions: h.row.positions, ids: [] };
    entry.ids.push(h.player_id);
    idsByKey.set(key, entry);
  }

  const total = [...idsByKey.values()].reduce((s, a) => s + a.ids.length, 0);
  console.log(
    `[positions] updating ${total} position_sofa values across ${idsByKey.size} unique positions`,
  );

  const sb = adminClient();
  for (const [, { positions, ids }] of idsByKey) {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const { error } = await sb
        .from("players")
        .update({ position_sofa: positions })
        .in("id", chunk);
      if (error) throw new Error(`update players.position_sofa: ${error.message}`);
    }
  }

  console.log("[positions] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
