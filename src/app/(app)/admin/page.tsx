import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { AdminGrading, type AdminBet } from "@/components/admin-grading";

export default async function AdminPage() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/");

  // Candidate list is sourced from what participants actually picked — NOT from
  // Polymarket, whose markets close once the tournament ends (leaving the old
  // combobox empty). Grading matches on exact strings, so these picked strings
  // are precisely the values that can award points; free text (in the UI) covers
  // a winner nobody guessed. Service role: reads every user's picks.
  const admin = adminClient();
  const [typesRes, resultsRes, picksRes] = await Promise.all([
    supabase.from("special_bet_types").select("id, name, points").order("sort_order"),
    supabase.from("special_bet_results").select("bet_type_id, winning_candidate"),
    admin.from("special_bet_picks").select("bet_type_id, candidate"),
  ]);

  const types = typesRes.data ?? [];
  const winnerByBet = new Map(
    (resultsRes.data ?? []).map((r) => [r.bet_type_id, r.winning_candidate as string | null]),
  );

  // bet_type_id -> (candidate string -> how many participants picked it)
  const countsByBet = new Map<string, Map<string, number>>();
  for (const p of picksRes.data ?? []) {
    const candidate = (p.candidate as string | null)?.trim();
    if (!candidate) continue;
    let counts = countsByBet.get(p.bet_type_id);
    if (!counts) {
      counts = new Map();
      countsByBet.set(p.bet_type_id, counts);
    }
    counts.set(candidate, (counts.get(candidate) ?? 0) + 1);
  }

  const bets: AdminBet[] = types.map((t) => {
    const counts = countsByBet.get(t.id) ?? new Map<string, number>();
    const winner = winnerByBet.get(t.id) ?? null;
    // Always list the current winner, even if nobody picked it (count 0).
    if (winner && !counts.has(winner)) counts.set(winner, 0);
    const options = [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "nb"));
    return { id: t.id, name: t.name, points: t.points, options, winner };
  });

  return <AdminGrading bets={bets} />;
}
