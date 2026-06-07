// Per-team "snack" insights built entirely from data we already have:
//   • title odds  — Polymarket winner market (implied probability)
//   • squad       — size + average age (from players.date_of_birth)
//   • WC form     — W/D/L + goals from finished tournament matches
// No new dependencies; Polymarket is fetched live (cached).

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCandidates, POLYMARKET_SLUG } from "@/lib/polymarket";

export interface TeamDetail {
  source: string;
  matches: number;
  goalsPerMatch: number | null;
  concededPerMatch: number | null;
  possession: number | null;
  shotsPerMatch: number | null;
  passPct: number | null;
  rating: number | null;
  cleanSheets: number | null;
}

export interface TeamInsight {
  titleProb: number | null;
  squadSize: number;
  avgAge: number | null;
  form: { w: number; d: number; l: number; gf: number; ga: number; recent: ("W" | "D" | "L")[] };
  detail: TeamDetail | null;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.\-_']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Polymarket label -> our team name, where they differ.
const TEAM_ALIAS: Record<string, string> = {
  usa: "united states",
  "south korea": "korea republic",
};

export async function loadTeamInsights(sb: SupabaseClient): Promise<Record<number, TeamInsight>> {
  const [{ data: teams }, { data: players }, { data: matches }, { data: teamStats }, winnerCands] =
    await Promise.all([
      sb.from("teams").select("id, name"),
      sb.from("players").select("team_id, date_of_birth"),
      sb
        .from("matches")
        .select("home_team_id, away_team_id, home_score, away_score, status, utc_date")
        .eq("status", "FINISHED"),
      sb.from("team_stats").select("team_id, source_tournament, matches, stats"),
      fetchCandidates(POLYMARKET_SLUG.winner),
    ]);

  const out: Record<number, TeamInsight> = {};
  for (const t of teams ?? []) {
    out[t.id] = {
      titleProb: null,
      squadSize: 0,
      avgAge: null,
      form: { w: 0, d: 0, l: 0, gf: 0, ga: 0, recent: [] },
      detail: null,
    };
  }

  // Sofascore-enriched detail (per-match where useful).
  for (const ts of teamStats ?? []) {
    if (!out[ts.team_id]) continue;
    const s = (ts.stats ?? {}) as Record<string, number>;
    const m = ts.matches ?? s.matches ?? 0;
    const per = (v: number | undefined) => (m && v != null ? v / m : null);
    out[ts.team_id].detail = {
      source: ts.source_tournament ?? "",
      matches: m,
      goalsPerMatch: per(s.goalsScored),
      concededPerMatch: per(s.goalsConceded),
      possession: s.averageBallPossession ?? null,
      shotsPerMatch: per(s.shots),
      passPct: s.accuratePassesPercentage ?? null,
      rating: s.avgRating ?? null,
      cleanSheets: s.cleanSheets ?? null,
    };
  }

  // Title odds: match Polymarket candidate name -> team id.
  const teamIdByName = new Map<string, number>();
  for (const t of teams ?? []) teamIdByName.set(normalize(t.name), t.id);
  for (const c of winnerCands) {
    const key = normalize(c.name);
    const id = teamIdByName.get(key) ?? teamIdByName.get(TEAM_ALIAS[key] ?? "");
    if (id != null && out[id] && out[id].titleProb == null) out[id].titleProb = c.prob;
  }

  // Squad size + average age.
  const now = Date.now();
  const ageAcc = new Map<number, { sum: number; n: number }>();
  for (const p of players ?? []) {
    if (p.team_id == null || !out[p.team_id]) continue;
    out[p.team_id].squadSize += 1;
    if (p.date_of_birth) {
      const age = (now - new Date(p.date_of_birth).getTime()) / (365.25 * 86_400_000);
      const a = ageAcc.get(p.team_id) ?? { sum: 0, n: 0 };
      a.sum += age;
      a.n += 1;
      ageAcc.set(p.team_id, a);
    }
  }
  for (const [id, a] of ageAcc) if (out[id]) out[id].avgAge = a.sum / a.n;

  // WC form (chronological).
  const sorted = (matches ?? [])
    .filter((m) => m.home_score != null && m.away_score != null)
    .sort((a, b) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime());
  for (const m of sorted) {
    const apply = (teamId: number | null, gf: number, ga: number) => {
      if (teamId == null || !out[teamId]) return;
      const f = out[teamId].form;
      f.gf += gf;
      f.ga += ga;
      const r = gf > ga ? "W" : gf < ga ? "L" : "D";
      f[r === "W" ? "w" : r === "L" ? "l" : "d"] += 1;
      f.recent.push(r);
    };
    apply(m.home_team_id, m.home_score!, m.away_score!);
    apply(m.away_team_id, m.away_score!, m.home_score!);
  }
  for (const id in out) out[id].form.recent = out[id].form.recent.slice(-5);

  return out;
}
