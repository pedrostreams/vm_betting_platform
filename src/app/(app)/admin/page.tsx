import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { fetchCandidates, POLYMARKET_SLUG } from "@/lib/polymarket";
import { AdminGrading, type AdminBet } from "@/components/admin-grading";

export default async function AdminPage() {
  const supabase = await createClient();
  if (!(await isAdmin(supabase))) redirect("/");

  const [typesRes, resultsRes] = await Promise.all([
    supabase.from("special_bet_types").select("id, name, points").order("sort_order"),
    supabase.from("special_bet_results").select("bet_type_id, winning_candidate"),
  ]);

  const types = typesRes.data ?? [];
  const winnerByBet = new Map(
    (resultsRes.data ?? []).map((r) => [r.bet_type_id, r.winning_candidate as string | null]),
  );

  const candidateLists = await Promise.all(
    types.map((t) => fetchCandidates(POLYMARKET_SLUG[t.id] ?? "")),
  );

  const bets: AdminBet[] = types.map((t, i) => ({
    id: t.id,
    name: t.name,
    points: t.points,
    options: candidateLists[i].map((c) => c.name),
    winner: winnerByBet.get(t.id) ?? null,
  }));

  return <AdminGrading bets={bets} />;
}
