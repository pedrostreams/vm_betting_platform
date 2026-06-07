// Sync teams, squads and the full 104-match schedule from football-data.org
// into Supabase. Idempotent: safe to run daily. Knockout matches arrive with
// null teams until the groups resolve, then fill in on later runs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { footballData } from "@/lib/football-data";

export interface SyncResult {
  teams: number;
  players: number;
  matches: number;
}

export async function syncTournament(sb: SupabaseClient): Promise<SyncResult> {
  const [{ teams }, { matches }] = await Promise.all([
    footballData.teams(),
    footballData.matches(),
  ]);

  // Derive each team's group from the group-stage fixtures (the /teams endpoint
  // doesn't carry it).
  const groupByTeam = new Map<number, string>();
  for (const m of matches) {
    if (m.stage === "GROUP_STAGE" && m.group) {
      if (m.homeTeam.id) groupByTeam.set(m.homeTeam.id, m.group);
      if (m.awayTeam.id) groupByTeam.set(m.awayTeam.id, m.group);
    }
  }

  const teamRows = teams.map((t) => ({
    id: t.id,
    name: t.name,
    tla: t.tla,
    crest_url: t.crest,
    group_code: groupByTeam.get(t.id) ?? null,
  }));

  const playerRows = teams.flatMap((t) =>
    (t.squad ?? []).map((p) => ({
      id: p.id,
      team_id: t.id,
      name: p.name,
      position: p.position,
      date_of_birth: p.dateOfBirth,
      is_goalkeeper: p.position === "Goalkeeper",
    })),
  );

  const matchRows = matches.map((m) => ({
    id: m.id,
    stage: m.stage,
    group_code: m.group,
    matchday: m.matchday,
    utc_date: m.utcDate,
    lock_at: new Date(new Date(m.utcDate).getTime() - 15 * 60_000).toISOString(),
    home_team_id: m.homeTeam.id,
    away_team_id: m.awayTeam.id,
    status: m.status,
    home_score: m.score.fullTime.home,
    away_score: m.score.fullTime.away,
    winner: m.score.winner,
    duration: m.score.duration,
  }));

  // teams -> players -> matches (respects FK order).
  const e1 = (await sb.from("teams").upsert(teamRows, { onConflict: "id" })).error;
  if (e1) throw new Error(`upsert teams: ${e1.message}`);

  for (let i = 0; i < playerRows.length; i += 500) {
    const e = (await sb.from("players").upsert(playerRows.slice(i, i + 500), { onConflict: "id" })).error;
    if (e) throw new Error(`upsert players: ${e.message}`);
  }

  const e3 = (await sb.from("matches").upsert(matchRows, { onConflict: "id" })).error;
  if (e3) throw new Error(`upsert matches: ${e3.message}`);

  return { teams: teamRows.length, players: playerRows.length, matches: matchRows.length };
}
