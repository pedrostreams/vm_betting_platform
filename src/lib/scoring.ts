// Grading: recompute every user's points from finished matches + confirmed
// special-bet results. Idempotent — safe to run on every cron tick.
//
// Group stage: HUB graded on 90-min full-time score (draw possible).
// Knockout:    graded on who ADVANCED (score.winner, incl. ET/penalties); H/B only.
// Special bets: admin-confirmed winners, points per bet type.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Log } from "@/lib/ingest/log";

type WinnerField = "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;

function groupOutcome(home: number | null, away: number | null): "H" | "U" | "B" | null {
  if (home == null || away == null) return null;
  if (home > away) return "H";
  if (home < away) return "B";
  return "U";
}

function advanced(winner: WinnerField): "H" | "B" | null {
  if (winner === "HOME_TEAM") return "H";
  if (winner === "AWAY_TEAM") return "B";
  return null; // a knockout can't end drawn once decided
}

interface ScoreAcc {
  group_points: number;
  knockout_points: number;
  special_points: number;
  exact_knockout_count: number;
  correct_special_count: number;
}

export async function gradeAll(sb: SupabaseClient, log?: Log): Promise<{ users: number }> {
  const [stagePts, matches, preds, profiles, sbResults, sbPicks, sbTypes] = await Promise.all([
    sb.from("stage_points").select("stage, points"),
    sb.from("matches").select("id, stage, status, home_score, away_score, winner"),
    sb.from("predictions").select("user_id, match_id, pick"),
    sb.from("profiles").select("id"),
    sb.from("special_bet_results").select("bet_type_id, winning_candidate"),
    sb.from("special_bet_picks").select("user_id, bet_type_id, candidate"),
    sb.from("special_bet_types").select("id, points"),
  ]);

  const pointsByStage = new Map((stagePts.data ?? []).map((s) => [s.stage, s.points]));
  const matchById = new Map((matches.data ?? []).map((m) => [m.id, m]));
  const sbPointsById = new Map((sbTypes.data ?? []).map((t) => [t.id, t.points]));
  const resultById = new Map((sbResults.data ?? []).map((r) => [r.bet_type_id, r]));

  const finished = (matches.data ?? []).filter((m) => m.status === "FINISHED").length;
  log?.(
    "info",
    `${finished} ferdige kamper, ${preds.data?.length ?? 0} tips, ${sbResults.data?.length ?? 0} special-resultater`,
  );

  const acc = new Map<string, ScoreAcc>();
  const ensure = (uid: string) => {
    let a = acc.get(uid);
    if (!a) {
      a = { group_points: 0, knockout_points: 0, special_points: 0, exact_knockout_count: 0, correct_special_count: 0 };
      acc.set(uid, a);
    }
    return a;
  };
  for (const p of profiles.data ?? []) ensure(p.id);

  // Match predictions
  for (const pred of preds.data ?? []) {
    const m = matchById.get(pred.match_id);
    if (!m || m.status !== "FINISHED") continue;
    const a = ensure(pred.user_id);
    const pts = pointsByStage.get(m.stage) ?? 0;

    if (m.stage === "GROUP_STAGE") {
      if (pred.pick === groupOutcome(m.home_score, m.away_score)) a.group_points += pts;
    } else {
      const adv = advanced(m.winner as WinnerField);
      if (adv && pred.pick === adv) {
        a.knockout_points += pts;
        a.exact_knockout_count += 1;
      }
    }
  }

  // Special bets — pick and result both store the Polymarket candidate name.
  for (const pick of sbPicks.data ?? []) {
    const result = resultById.get(pick.bet_type_id);
    if (!result?.winning_candidate || !pick.candidate) continue;
    if (pick.candidate === result.winning_candidate) {
      const a = ensure(pick.user_id);
      a.special_points += sbPointsById.get(pick.bet_type_id) ?? 0;
      a.correct_special_count += 1;
    }
  }

  const rows = [...acc.entries()].map(([user_id, a]) => ({
    user_id,
    group_points: a.group_points,
    knockout_points: a.knockout_points,
    special_points: a.special_points,
    total_points: a.group_points + a.knockout_points + a.special_points,
    exact_knockout_count: a.exact_knockout_count,
    correct_special_count: a.correct_special_count,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("user_scores").upsert(rows.slice(i, i + 200), { onConflict: "user_id" });
    if (error) throw new Error(`upsert user_scores: ${error.message}`);
  }

  const totalPoints = rows.reduce((sum, r) => sum + r.total_points, 0);
  log?.("ok", `Poeng beregnet for ${rows.length} deltakere (${totalPoints} p totalt utdelt)`);

  return { users: rows.length };
}
