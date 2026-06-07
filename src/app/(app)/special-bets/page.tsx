import { createClient } from "@/lib/supabase/server";
import { fetchCandidates, fetchYesProb, fetchDuel, POLYMARKET_SLUG } from "@/lib/polymarket";
import { SpecialBetsEditor, type BetVM } from "@/components/special-bets-editor";

// --- name normalization for matching Polymarket candidate names to our DB ---
const stripDia = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
const norm = (s: string) => stripDia(s).toLowerCase().replace(/[^a-z0-9]/g, "");
// stripDia removes Unicode combining diacritical marks (U+0300–U+036F).
const tokenKey = (s: string) =>
  stripDia(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).sort().join(" ");
// Polymarket spellings that differ from our team names.
const COUNTRY_ALIAS: Record<string, string> = {
  capeverde: "capeverdeislands",
  turkiye: "turkey",
  usa: "unitedstates",
};

export default async function SpecialBetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [typesRes, picksRes, firstMatchRes, teamsRes, playersRes] = await Promise.all([
    supabase.from("special_bet_types").select("id, name, points, kind").order("sort_order"),
    supabase.from("special_bet_picks").select("bet_type_id, candidate").eq("user_id", user!.id),
    supabase.from("matches").select("utc_date").order("utc_date").limit(1).single(),
    supabase.from("teams").select("name, crest_url"),
    supabase.from("players").select("name, teams(crest_url)"),
  ]);

  const types = typesRes.data ?? [];
  const pickByBet = new Map((picksRes.data ?? []).map((p) => [p.bet_type_id, p.candidate as string]));
  // The lock deadline (first kickoff); the editor derives locked/countdown live.
  const lockAt = firstMatchRes.data?.utc_date ?? null;

  // Country flag by (normalized) team name, with a few Polymarket aliases.
  const flagByCountry = new Map<string, string>();
  for (const t of teamsRes.data ?? []) {
    if (t.crest_url) flagByCountry.set(norm(t.name), t.crest_url);
  }
  const countryFlag = (name: string): string | null =>
    flagByCountry.get(norm(name)) ?? flagByCountry.get(COUNTRY_ALIAS[norm(name)] ?? "") ?? null;

  // Player → nation crest, matched on full name then sorted-token (catches name
  // order swaps); token matches with conflicting flags are dropped to be safe.
  const playerByNorm = new Map<string, string>();
  const playerByToken = new Map<string, string>();
  const tokenClash = new Set<string>();
  for (const p of playersRes.data ?? []) {
    const team = Array.isArray(p.teams) ? p.teams[0] : p.teams;
    const crest = team?.crest_url;
    if (!crest || !p.name) continue;
    playerByNorm.set(norm(p.name), crest);
    const tk = tokenKey(p.name);
    const existing = playerByToken.get(tk);
    if (existing && existing !== crest) tokenClash.add(tk);
    else playerByToken.set(tk, crest);
  }
  const playerFlag = (name: string): string | null => {
    const n = norm(name);
    if (playerByNorm.has(n)) return playerByNorm.get(n)!;
    const tk = tokenKey(name);
    if (!tokenClash.has(tk) && playerByToken.has(tk)) return playerByToken.get(tk)!;
    return null;
  };

  const flagFor = (kind: string, name: string): string | null =>
    kind === "team"
      ? countryFlag(name)
      : kind === "player" || kind === "keeper"
        ? playerFlag(name)
        : null;

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
      return cands.map((c) => ({ name: c.name, prob: c.prob, flag: flagFor(t.kind, c.name) }));
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

  return <SpecialBetsEditor bets={bets} userId={user!.id} lockAt={lockAt} />;
}
