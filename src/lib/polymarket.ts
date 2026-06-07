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
