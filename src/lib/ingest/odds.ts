// Pull HUB odds from Norsk Tipping (Oddsen) and attach them to our matches.
//
// Norsk Tipping uses Norwegian nation names ("Sør-Afrika") while football-data
// uses English ("South Africa"), so we match primarily on KICKOFF TIME and use
// a NO->EN alias map to disambiguate simultaneous kickoffs. Unmatched events are
// logged but never fatal — odds are decision-support ("snacks"), not scoring.

import type { SupabaseClient } from "@supabase/supabase-js";

const NT_BASE = "https://api.norsk-tipping.no/OddsenGameInfo/v1/api/events/FBL";
const WC_TOURNAMENT_ID = "45613";
const KICKOFF_TOLERANCE_MS = 10 * 60_000;

// Norwegian nation name -> English (football-data). Only names that differ need
// an entry; identical names (Mexico, Canada, Qatar, …) fall through normalize().
const NO_TO_EN: Record<string, string> = {
  "sor-afrika": "south africa",
  "sor-korea": "south korea",
  "saudi-arabia": "saudi arabia",
  brasil: "brazil",
  marokko: "morocco",
  sveits: "switzerland",
  tyskland: "germany",
  spania: "spain",
  frankrike: "france",
  italia: "italy",
  belgia: "belgium",
  kroatia: "croatia",
  nederland: "netherlands",
  danmark: "denmark",
  sverige: "sweden",
  norge: "norway",
  polen: "poland",
  usa: "united states",
  tsjekkia: "czechia",
  elfenbenskysten: "ivory coast",
  kamerun: "cameroon",
  algerie: "algeria",
  "kapp verde": "cape verde",
  osterrike: "austria",
  skottland: "scotland",
  tyrkia: "turkiye",
  hellas: "greece",
  usbekistan: "uzbekistan",
  egypt: "egypt",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonical(ntName: string): string {
  const n = normalize(ntName);
  const mapped = NO_TO_EN[n] ?? NO_TO_EN[n.replace(/ /g, "-")];
  return normalize(mapped ?? n);
}

interface NtEvent {
  startTime: string;
  homeParticipant: string;
  awayParticipant: string;
  tournament?: { id: string };
  mainMarket?: {
    marketName?: string;
    selections?: { selectionValue: string; selectionOdds: string }[];
  };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function syncOdds(sb: SupabaseClient): Promise<{ matched: number; unmatched: number }> {
  // Window: today → +45 days (covers everything Norsk Tipping has posted).
  const from = new Date();
  const to = new Date(from.getTime() + 45 * 86_400_000);
  const url = `${NT_BASE}/${ymd(from)}0000/${ymd(to)}2359`;

  const res = await fetch(url, {
    headers: { Accept: "application/json;charset=utf-8" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`norsk-tipping events -> HTTP ${res.status}`);
  const data = (await res.json()) as { eventList?: NtEvent[] };
  const events = (data.eventList ?? []).filter(
    (e) => e.tournament?.id === WC_TOURNAMENT_ID && e.mainMarket?.marketName === "HUB",
  );

  // Load our matches with team names for matching.
  const { data: matches } = await sb
    .from("matches")
    .select("id, utc_date, home_team_id, away_team_id");
  const { data: teams } = await sb.from("teams").select("id, name");
  const teamName = new Map((teams ?? []).map((t) => [t.id, normalize(t.name)]));

  const rows: {
    match_id: number;
    home_odds: number | null;
    draw_odds: number | null;
    away_odds: number | null;
    source: string;
    fetched_at: string;
  }[] = [];
  let unmatched = 0;

  for (const ev of events) {
    const kickoff = new Date(ev.startTime).getTime();
    const candidates = (matches ?? []).filter(
      (m) => Math.abs(new Date(m.utc_date).getTime() - kickoff) <= KICKOFF_TOLERANCE_MS,
    );

    const ntHome = canonical(ev.homeParticipant);
    const ntAway = canonical(ev.awayParticipant);
    const match =
      candidates.find((m) => {
        const h = m.home_team_id != null ? teamName.get(m.home_team_id) : undefined;
        const a = m.away_team_id != null ? teamName.get(m.away_team_id) : undefined;
        return h === ntHome && a === ntAway;
      }) ?? (candidates.length === 1 ? candidates[0] : undefined);

    if (!match) {
      unmatched++;
      continue;
    }

    const sel = Object.fromEntries(
      (ev.mainMarket?.selections ?? []).map((s) => [s.selectionValue, parseFloat(s.selectionOdds)]),
    );
    rows.push({
      match_id: match.id,
      home_odds: sel["H"] ?? null,
      draw_odds: sel["D"] ?? null,
      away_odds: sel["A"] ?? null,
      source: "norsk-tipping",
      fetched_at: new Date().toISOString(),
    });
  }

  if (rows.length) {
    const { error } = await sb.from("match_odds").upsert(rows, { onConflict: "match_id" });
    if (error) throw new Error(`upsert match_odds: ${error.message}`);
  }
  if (unmatched) console.warn(`[odds] ${unmatched} Norsk Tipping events did not match a fixture`);

  return { matched: rows.length, unmatched };
}
