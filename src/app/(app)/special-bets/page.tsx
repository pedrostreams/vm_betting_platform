import { createClient } from "@/lib/supabase/server";
import { fetchCandidates, POLYMARKET_SLUG } from "@/lib/polymarket";
import { SpecialBetsEditor, type BetVM } from "@/components/special-bets-editor";

export default async function SpecialBetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [typesRes, picksRes, firstMatchRes] = await Promise.all([
    supabase.from("special_bet_types").select("id, name, points").order("sort_order"),
    supabase.from("special_bet_picks").select("bet_type_id, candidate").eq("user_id", user!.id),
    supabase.from("matches").select("utc_date").order("utc_date").limit(1).single(),
  ]);

  const types = typesRes.data ?? [];
  const pickByBet = new Map((picksRes.data ?? []).map((p) => [p.bet_type_id, p.candidate as string]));
  const locked = firstMatchRes.data
    ? new Date(firstMatchRes.data.utc_date).getTime() <= Date.now()
    : false;

  // Candidate lists come straight from Polymarket (live, cached).
  const candidateLists = await Promise.all(
    types.map((t) => fetchCandidates(POLYMARKET_SLUG[t.id] ?? "")),
  );

  const bets: BetVM[] = types.map((t, i) => ({
    id: t.id,
    name: t.name,
    points: t.points,
    options: candidateLists[i].map((c) => ({ name: c.name, prob: c.prob })),
    picked: pickByBet.get(t.id) ?? null,
  }));

  return <SpecialBetsEditor bets={bets} userId={user!.id} locked={locked} />;
}
