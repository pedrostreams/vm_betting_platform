// Sync teams, squads and the full 104-match schedule from football-data.org
// into Supabase. Idempotent: safe to run daily. Knockout matches arrive with
// null teams until the groups resolve, then fill in on later runs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { footballData } from "@/lib/football-data";
import type { Log } from "@/lib/ingest/log";

export interface SyncResult {
  teams: number;
  players: number;
  matches: number;
}

export async function syncTournament(sb: SupabaseClient, log?: Log): Promise<SyncResult> {
  const [{ teams }, { matches }] = await Promise.all([
    footballData.teams(),
    footballData.matches(),
  ]);

  const apiFinished = matches.filter((m) => m.status === "FINISHED").length;
  const apiWithScore = matches.filter(
    (m) => m.score.fullTime.home != null || m.score.fullTime.away != null,
  ).length;
  log?.("info", `football-data: ${teams.length} lag, ${matches.length} kamper hentet`);
  log?.("info", `API-status: ${apiFinished} ferdigspilt, ${apiWithScore} med resultat`);

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

  // football-data (free tier) flips a match to FINISHED around kickoff and then
  // intermittently drops the score back to null while it settles. A blind upsert
  // would clobber a result we already stored, so fetch what we know and never let
  // a result-less response regress a match that already has a score/winner.
  // A genuine correction (non-null -> different non-null) still flows through.
  const { data: prevRows } = await sb
    .from("matches")
    .select("id, status, home_score, away_score, winner, duration");
  const prev = new Map((prevRows ?? []).map((r) => [r.id, r]));

  // Short label for log lines, e.g. "MEX–RSA"; falls back to full name / "?".
  const nameById = new Map(teams.map((t) => [t.id, t.tla ?? t.name]));
  const label = (m: (typeof matches)[number]) =>
    `${nameById.get(m.homeTeam.id ?? -1) ?? m.homeTeam.name ?? "?"}–${nameById.get(m.awayTeam.id ?? -1) ?? m.awayTeam.name ?? "?"}`;
  const score = (h: number | null, a: number | null) => `${h ?? "–"}-${a ?? "–"}`;

  let newCount = 0;
  let resultChanges = 0;
  let preserved = 0;

  const matchRows = matches.map((m) => {
    const before = prev.get(m.id);
    const incomingHasResult =
      m.score.fullTime.home != null || m.score.fullTime.away != null || m.score.winner != null;
    const hadResult =
      before != null &&
      (before.home_score != null || before.away_score != null || before.winner != null);
    const keepStored = hadResult && !incomingHasResult;

    const row = {
      id: m.id,
      stage: m.stage,
      group_code: m.group,
      matchday: m.matchday,
      utc_date: m.utcDate,
      lock_at: new Date(new Date(m.utcDate).getTime() - 15 * 60_000).toISOString(),
      home_team_id: m.homeTeam.id,
      away_team_id: m.awayTeam.id,
      status: keepStored ? before!.status : m.status,
      home_score: keepStored ? before!.home_score : m.score.fullTime.home,
      away_score: keepStored ? before!.away_score : m.score.fullTime.away,
      winner: keepStored ? before!.winner : m.score.winner,
      duration: keepStored ? before!.duration : m.score.duration,
    };

    if (!before) {
      newCount++;
    } else if (keepStored) {
      preserved++;
      log?.(
        "warn",
        `${label(m)}: API ga null — beholdt lagret ${score(before.home_score, before.away_score)}`,
      );
    } else {
      const parts: string[] = [];
      if (before.status !== row.status) parts.push(`status ${before.status}→${row.status}`);
      if (
        before.home_score !== row.home_score ||
        before.away_score !== row.away_score ||
        before.winner !== row.winner
      ) {
        parts.push(
          `resultat ${score(before.home_score, before.away_score)}→${score(row.home_score, row.away_score)}`,
        );
      }
      if (parts.length) {
        resultChanges++;
        log?.("ok", `${label(m)}: ${parts.join(", ")}`);
      }
    }

    return row;
  });

  // teams -> players -> matches (respects FK order).
  const e1 = (await sb.from("teams").upsert(teamRows, { onConflict: "id" })).error;
  if (e1) throw new Error(`upsert teams: ${e1.message}`);

  for (let i = 0; i < playerRows.length; i += 500) {
    const e = (await sb.from("players").upsert(playerRows.slice(i, i + 500), { onConflict: "id" })).error;
    if (e) throw new Error(`upsert players: ${e.message}`);
  }

  const e3 = (await sb.from("matches").upsert(matchRows, { onConflict: "id" })).error;
  if (e3) throw new Error(`upsert matches: ${e3.message}`);

  if (newCount) log?.("info", `${newCount} nye kamper lagt inn`);
  log?.(
    preserved ? "warn" : "ok",
    `Skrev ${teamRows.length} lag, ${playerRows.length} spillere, ${matchRows.length} kamper · ${resultChanges} resultatendringer, ${preserved} bevart mot null-flap`,
  );

  return { teams: teamRows.length, players: playerRows.length, matches: matchRows.length };
}
