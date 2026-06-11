// Sync teams, squads and the full 104-match schedule from football-data.org
// into Supabase. Idempotent: safe to run daily. Knockout matches arrive with
// null teams until the groups resolve, then fill in on later runs.

import type { SupabaseClient } from "@supabase/supabase-js";
import { footballData, type FdMatch } from "@/lib/football-data";
import { espnResults } from "@/lib/espn";
import type { Log } from "@/lib/ingest/log";

export interface SyncResult {
  teams: number;
  players: number;
  matches: number;
}

export async function syncTournament(sb: SupabaseClient, log?: Log): Promise<SyncResult> {
  const [teamsRes, matchesRes] = await Promise.all([
    footballData.teams(),
    footballData.matches(),
  ]);
  const { teams } = teamsRes;
  let matches = matchesRes.matches;

  // Load what we already have FIRST so we can (a) skip re-fetching for results we
  // already captured, and (b) refuse to let a stale read wipe a stored result.
  const { data: prevRows } = await sb
    .from("matches")
    .select("id, status, home_score, away_score, winner, duration");
  const prev = new Map((prevRows ?? []).map((r) => [r.id, r]));

  // Short label for log lines, e.g. "MEX–RSA"; falls back to full name / "?".
  const nameById = new Map(teams.map((t) => [t.id, t.tla ?? t.name]));
  const label = (m: FdMatch) =>
    `${nameById.get(m.homeTeam.id ?? -1) ?? m.homeTeam.name ?? "?"}–${nameById.get(m.awayTeam.id ?? -1) ?? m.awayTeam.name ?? "?"}`;
  const score = (h: number | null, a: number | null) => `${h ?? "–"}-${a ?? "–"}`;

  // football-data's free tier sits behind an inconsistent CDN cache: the SAME
  // request can return a match as TIMED+null, FINISHED+null, OR FINISHED+score
  // depending on which node answers — all with identical `lastUpdated`, so the
  // record isn't changing, the read is just stale. `status` is therefore NOT
  // trustworthy. Heuristic: if a match kicked off over a match-length ago and we
  // have no result (incoming or stored), re-fetch and merge in any populated read
  // until we capture it. The upsert below then refuses to let a later null wipe it.
  const RESULT_GRACE_MS = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const hasResult = (m: FdMatch) =>
    m.score.fullTime.home != null || m.score.fullTime.away != null || m.score.winner != null;
  const storedResult = (id: number) => {
    const p = prev.get(id);
    return p != null && (p.home_score != null || p.away_score != null || p.winner != null);
  };
  const needsResult = (m: FdMatch) =>
    !hasResult(m) &&
    !storedResult(m.id) &&
    now - new Date(m.utcDate).getTime() > RESULT_GRACE_MS;

  for (let attempt = 1; attempt <= 3 && matches.some(needsResult); attempt++) {
    const missing = matches.filter(needsResult).length;
    log?.("warn", `${missing} avsluttede kamper mangler resultat — re-henter (${attempt}/3)`);
    await new Promise((r) => setTimeout(r, 1200));
    const retry = await footballData.matches();
    const merged = new Map(matches.map((m) => [m.id, m]));
    for (const m of retry.matches) if (hasResult(m)) merged.set(m.id, m); // populated read wins
    matches = [...merged.values()];
  }

  log?.("info", `football-data: ${teams.length} lag, ${matches.length} kamper hentet`);
  log?.(
    "info",
    `API-status: ${matches.filter((m) => m.status === "FINISHED").length} ferdigspilt, ${matches.filter(hasResult).length} med resultat`,
  );

  // Backup: anything still missing a result after football-data is filled from
  // ESPN, matched by kickoff time + (normalized) team name. Fallback only — never
  // fatal, and football-data keeps owning ids/schedule/squads.
  const missingNow = matches.filter(needsResult);
  if (missingNow.length) {
    log?.("warn", `${missingNow.length} avsluttede kamper mangler resultat — prøver ESPN (backup)`);
    try {
      const ymd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
      const espn = await espnResults(missingNow.map((m) => ymd(m.utcDate)));

      const norm = (s: string | null | undefined) =>
        (s ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const ALIAS: Record<string, string> = {
        usa: "united states",
        "cote d ivoire": "ivory coast",
        turkey: "turkiye",
        "ir iran": "iran",
        "korea republic": "south korea",
        "cabo verde": "cape verde",
      };
      const canon = (s: string | null | undefined) => {
        const n = norm(s);
        return ALIAS[n] ?? n;
      };
      const TOL = 15 * 60_000;

      let filled = 0;
      for (const m of missingNow) {
        const kickoff = new Date(m.utcDate).getTime();
        const near = espn.filter((e) => Math.abs(new Date(e.kickoff).getTime() - kickoff) <= TOL);
        const hit =
          near.find((e) => canon(e.home) === canon(m.homeTeam.name) && canon(e.away) === canon(m.awayTeam.name)) ??
          (near.length === 1 ? near[0] : undefined);
        if (!hit || !hit.completed) continue;

        m.status = "FINISHED";
        m.score.fullTime.home = hit.homeScore;
        m.score.fullTime.away = hit.awayScore;
        m.score.winner = hit.winner;
        m.score.duration = hit.shootout ? "PENALTY_SHOOTOUT" : m.score.duration ?? "REGULAR";
        filled++;
        log?.("ok", `${label(m)}: ${score(hit.homeScore, hit.awayScore)} hentet fra ESPN (backup)`);
      }
      log?.(
        filled ? "ok" : "info",
        `ESPN backup: fylte inn ${filled} av ${missingNow.length} (${espn.length} hendelser sjekket)`,
      );
    } catch (e) {
      log?.("warn", `ESPN backup feilet (ikke kritisk): ${(e as Error).message}`);
    }
  }

  const stillMissing = matches.filter(needsResult).length;
  if (stillMissing) log?.("warn", `${stillMissing} avsluttede kamper mangler fortsatt resultat`);

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

  // The upsert below never lets a result-less response regress a match that
  // already has a score/winner (stored in `prev`); a genuine correction
  // (non-null -> different non-null) still flows through.
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
