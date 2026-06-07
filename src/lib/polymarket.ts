// Live (server-cached) Polymarket Gamma API client for special-bet candidates.
// Each WC special-bet market is an event of ~60-110 binary sub-markets (one per
// candidate); the "Yes" price is the implied probability. We use this purely as
// a ranked candidate list + odds — picks are still stored as our own player/team
// ids so admin grading matches.

const GAMMA = "https://gamma-api.polymarket.com/events";

// our special_bet_types.id -> Polymarket event slug. Every special bet is now
// sourced entirely from Polymarket; picks store the candidate name.
export const POLYMARKET_SLUG: Record<string, string> = {
  winner: "world-cup-winner",
  top_scorer: "world-cup-golden-boot-winner",
  top_assist: "world-cup-most-assists",
  clean_sheet: "world-cup-most-clean-sheets-gk",
  top_scorer_nation: "world-cup-top-scorer-nation",
  // candidate-list bets added in migration 0008
  continent: "which-continent-will-win-the-world-cup",
  goal_contributions: "world-cup-most-goal-contributions",
  finalist: "world-cup-nation-to-reach-final",
  // binary YES/NO props (single-market events; the "Yes" price is the prob).
  // NOTE: some slugs carry a creation-timestamp suffix — re-verify before launch.
  p_keeper_scores: "world-cup-goalkeeper-to-score-20260607161409835",
  p_nation_never_won:
    "will-a-nation-that-has-never-won-the-world-cup-win-in-2026-20260605003149811",
  p_scoreless_team: "world-cup-scoreless-team-20260607162032311",
  p_messi_free_kick: "world-cup-messi-to-score-a-free-kick-20260605004937388",
  p_ronaldo_cry: "will-ronaldo-cry-at-the-world-cup-20260604013616610",
  // more binary props (migration 0009)
  p_trump_opener: "president-trump-to-attend-usa-opening-match-20260607163739001",
  p_mexico_relocated: "will-a-world-cup-game-in-mexico-be-relocated-abroad",
  // player duels (migration 0009) — "Yes" price = the FIRST-named player wins
  d_messi_ronaldo: "world-cup-goals-h2h-messi-vspt-ronaldo-20260604005506837",
  d_yamal_mbappe: "world-cup-goals-h2h-yamal-vspt-mbappe-20260604014012402",
  d_haaland_alvarez: "world-cup-goals-h2h-haaland-vspt-alvarez-20260604011418095",
  d_salah_mane: "world-cup-goals-h2h-salah-vspt-mane-20260604011009086",
  d_dembele_olise: "world-cup-goals-h2h-dembele-vspt-olise-20260604014137377",
  d_valverde_fernandes:
    "world-cup-goal-contributions-h2h-valverde-vspt-fernandes-20260604014429764",
  d_vitinha_pedri: "world-cup-goal-contributions-h2h-vitinha-vspt-pedri-20260604014250677",
};

export interface Candidate {
  name: string;
  prob: number; // 0–1 implied probability
}

interface GammaMarket {
  groupItemTitle?: string;
  question?: string;
  outcomePrices?: string;
  active?: boolean;
  closed?: boolean;
}
interface GammaEvent {
  title?: string;
  markets?: GammaMarket[];
}

/** Fetch a special-bet market's candidates, ranked by implied probability.
 *  Server-cached for 1h (revalidate). Returns [] on any failure (non-critical). */
export async function fetchCandidates(slug: string): Promise<Candidate[]> {
  try {
    const res = await fetch(`${GAMMA}?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GammaEvent[] | GammaEvent;
    const ev = Array.isArray(data) ? data[0] : data;
    if (!ev?.markets) return [];

    const out: Candidate[] = [];
    for (const m of ev.markets) {
      if (m.closed) continue;
      const name = m.groupItemTitle ?? m.question;
      if (!name || !m.outcomePrices) continue;
      let prices: string[];
      try {
        prices = JSON.parse(m.outcomePrices);
      } catch {
        continue;
      }
      const yes = parseFloat(prices[0]);
      if (!Number.isFinite(yes)) continue;
      out.push({ name, prob: yes });
    }
    return out.sort((a, b) => b.prob - a.prob);
  } catch {
    return [];
  }
}

/** Implied "Yes" probability (0–1) for a binary prop market, or null on failure.
 *  A binary event has a single market whose first outcome price is "Yes". */
export async function fetchYesProb(slug: string): Promise<number | null> {
  const [first] = await fetchCandidates(slug);
  return first?.prob ?? null;
}

/** A head-to-head player duel: returns the two players as [first, second] with
 *  implied probabilities, parsed from the "... H2H: A vs. B" event title. The
 *  "Yes" price is taken to mean the first-named player wins. Null on failure. */
export async function fetchDuel(
  slug: string,
): Promise<[Candidate, Candidate] | null> {
  try {
    const res = await fetch(`${GAMMA}?slug=${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GammaEvent[] | GammaEvent;
    const ev = Array.isArray(data) ? data[0] : data;
    const m = ev?.markets?.find((x) => !x.closed) ?? ev?.markets?.[0];
    if (!m?.outcomePrices) return null;

    const tail = (ev?.title ?? m.question ?? "").split(/H2H:\s*/i).pop() ?? "";
    const names = tail
      .split(/\s+vs\.?\s+/i)
      .map((s) => s.trim().replace(/\?$/, ""))
      .filter(Boolean);
    if (names.length < 2) return null;

    let yes: number;
    try {
      yes = parseFloat(JSON.parse(m.outcomePrices)[0]);
    } catch {
      return null;
    }
    if (!Number.isFinite(yes)) return null;

    return [
      { name: names[0], prob: yes },
      { name: names[1], prob: 1 - yes },
    ];
  } catch {
    return null;
  }
}
