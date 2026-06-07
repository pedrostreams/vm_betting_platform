import { createClient } from "@/lib/supabase/server";
import { fetchCandidates, fetchYesProb, fetchDuel, POLYMARKET_SLUG } from "@/lib/polymarket";
import { SpecialBetsEditor, type BetVM } from "@/components/special-bets-editor";

export default async function SpecialBetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [typesRes, picksRes, firstMatchRes] = await Promise.all([
    supabase.from("special_bet_types").select("id, name, points, kind").order("sort_order"),
    supabase.from("special_bet_picks").select("bet_type_id, candidate").eq("user_id", user!.id),
    supabase.from("matches").select("utc_date").order("utc_date").limit(1).single(),
  ]);

  const types = typesRes.data ?? [];
  const pickByBet = new Map((picksRes.data ?? []).map((p) => [p.bet_type_id, p.candidate as string]));
  const locked = firstMatchRes.data
    ? new Date(firstMatchRes.data.utc_date).getTime() <= Date.now()
    : false;

  // Options come straight from Polymarket (live, cached). Binary props resolve to
  // a YES/NO pair from the implied "Yes" probability; everything else is a list.
  const optionLists = await Promise.all(
    types.map(async (t) => {
      const slug = POLYMARKET_SLUG[t.id] ?? "";
      if (t.kind === "binary") {
        const yes = await fetchYesProb(slug);
        return [
          { name: "JA", prob: yes },
          { name: "NEI", prob: yes == null ? null : 1 - yes },
        ];
      }
      if (t.kind === "duel") {
        const duel = await fetchDuel(slug);
        return duel ?? [];
      }
      const cands = await fetchCandidates(slug);
      return cands.map((c) => ({ name: c.name, prob: c.prob }));
    }),
  );

  const bets: BetVM[] = types.map((t, i) => ({
    id: t.id,
    name: t.name,
    points: t.points,
    kind: t.kind as BetVM["kind"],
    options: optionLists[i],
    picked: pickByBet.get(t.id) ?? null,
  }));

  return <SpecialBetsEditor bets={bets} userId={user!.id} locked={locked} />;
}
