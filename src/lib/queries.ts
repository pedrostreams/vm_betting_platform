import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchView, Team, Pick } from "@/lib/types";

/** Load matches for a stage (or all) as fully-joined view models. */
export async function loadMatches(
  sb: SupabaseClient,
  opts: { stage?: string } = {},
): Promise<MatchView[]> {
  let q = sb
    .from("matches")
    .select(
      "id, stage, group_code, matchday, utc_date, lock_at, status, home_score, away_score, winner, home_team_id, away_team_id",
    )
    .order("utc_date");
  if (opts.stage) q = q.eq("stage", opts.stage);

  const [{ data: matches, error }, { data: teams }, { data: odds }] = await Promise.all([
    q,
    sb.from("teams").select("id, name, tla, crest_url, group_code"),
    sb.from("match_odds").select("match_id, home_odds, draw_odds, away_odds"),
  ]);
  if (error) throw new Error(error.message);

  const teamById = new Map<number, Team>((teams ?? []).map((t) => [t.id, t as Team]));
  const oddsByMatch = new Map(
    (odds ?? []).map((o) => [
      o.match_id,
      { home_odds: o.home_odds, draw_odds: o.draw_odds, away_odds: o.away_odds },
    ]),
  );

  return (matches ?? []).map((m) => ({
    id: m.id,
    stage: m.stage,
    group_code: m.group_code,
    matchday: m.matchday,
    utc_date: m.utc_date,
    lock_at: m.lock_at,
    status: m.status,
    home_score: m.home_score,
    away_score: m.away_score,
    winner: m.winner,
    home: m.home_team_id != null ? teamById.get(m.home_team_id) ?? null : null,
    away: m.away_team_id != null ? teamById.get(m.away_team_id) ?? null : null,
    odds: oddsByMatch.get(m.id) ?? null,
  }));
}

export interface StandingRow {
  userId: string;
  name: string;
  total: number;
}
export interface PoolStandings {
  poolId: string;
  poolName: string;
  rows: StandingRow[];
}

/** Standings for the user's first pool (no pool selector — just the first one). */
export async function loadFirstPoolStandings(
  sb: SupabaseClient,
  userId: string,
): Promise<PoolStandings | null> {
  const { data: memberships } = await sb
    .from("pool_members")
    .select("pool_id, pools(id, name)")
    .eq("user_id", userId)
    .limit(1);

  const first = memberships?.[0];
  if (!first) return null;
  const pool = (Array.isArray(first.pools) ? first.pools[0] : first.pools) as
    | { id: string; name: string }
    | null;
  if (!pool) return null;

  const { data: members } = await sb.from("pool_members").select("user_id").eq("pool_id", pool.id);
  const ids = (members ?? []).map((m) => m.user_id);

  const [{ data: profiles }, { data: scores }] = await Promise.all([
    sb.from("profiles").select("id, display_name").in("id", ids),
    sb.from("user_scores").select("user_id, total_points, exact_knockout_count, correct_special_count").in("user_id", ids),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name as string]));
  const scoreById = new Map((scores ?? []).map((s) => [s.user_id, s]));

  const rows: StandingRow[] = ids
    .map((uid) => ({
      userId: uid,
      name: nameById.get(uid) ?? "—",
      total: scoreById.get(uid)?.total_points ?? 0,
      tb1: scoreById.get(uid)?.exact_knockout_count ?? 0,
      tb2: scoreById.get(uid)?.correct_special_count ?? 0,
    }))
    .sort((a, b) => b.total - a.total || b.tb1 - a.tb1 || b.tb2 - a.tb2 || a.name.localeCompare(b.name))
    .map(({ userId, name, total }) => ({ userId, name, total }));

  return { poolId: pool.id, poolName: pool.name, rows };
}

/** Load the current user's picks as a match_id -> pick map. */
export async function loadUserPicks(
  sb: SupabaseClient,
  userId: string,
): Promise<Record<number, Pick>> {
  const { data } = await sb.from("predictions").select("match_id, pick").eq("user_id", userId);
  const out: Record<number, Pick> = {};
  for (const p of data ?? []) out[p.match_id] = p.pick as Pick;
  return out;
}
