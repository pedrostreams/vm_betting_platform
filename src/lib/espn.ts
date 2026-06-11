// Backup results source: ESPN's public (undocumented) scoreboard for the men's
// World Cup. Free, no auth, English team names. Used ONLY to fill in results that
// football-data is too flaky to serve (see lib/ingest/tournament.ts). Never
// canonical — ESPN events are matched back to our football-data fixtures by
// kickoff time + team name, and football-data keeps owning ids/schedule/squads.

const SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";

export interface EspnResult {
  kickoff: string; // ISO
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  completed: boolean;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  shootout: boolean; // decided on penalties
}

interface EspnCompetitor {
  homeAway?: "home" | "away";
  score?: string;
  winner?: boolean;
  shootoutScore?: number | string;
  team?: { displayName?: string };
}

interface EspnEvent {
  date?: string;
  competitions?: {
    competitors?: EspnCompetitor[];
    status?: { type?: { completed?: boolean } };
  }[];
}

function toScore(s?: string): number | null {
  if (s == null || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function parseEvent(e: EspnEvent): EspnResult | null {
  const c = e.competitions?.[0];
  const home = c?.competitors?.find((x) => x.homeAway === "home");
  const away = c?.competitors?.find((x) => x.homeAway === "away");
  if (!home || !away || !e.date) return null;

  const homeScore = toScore(home.score);
  const awayScore = toScore(away.score);
  const completed = c?.status?.type?.completed === true;
  const winner: EspnResult["winner"] = home.winner
    ? "HOME_TEAM"
    : away.winner
      ? "AWAY_TEAM"
      : completed && homeScore != null && homeScore === awayScore
        ? "DRAW"
        : null;

  return {
    kickoff: e.date,
    home: home.team?.displayName ?? "",
    away: away.team?.displayName ?? "",
    homeScore,
    awayScore,
    completed,
    winner,
    shootout: home.shootoutScore != null || away.shootoutScore != null,
  };
}

/**
 * Fetch results for the given UTC dates (YYYYMMDD). Backup source — any failure
 * (network, shape change, bad date) is swallowed so it can never break a sync.
 */
export async function espnResults(datesYmd: string[]): Promise<EspnResult[]> {
  const out: EspnResult[] = [];
  for (const d of [...new Set(datesYmd)]) {
    try {
      const res = await fetch(`${SCOREBOARD}?dates=${d}`, { cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as { events?: EspnEvent[] };
      for (const e of json.events ?? []) {
        const r = parseEvent(e);
        if (r) out.push(r);
      }
    } catch {
      // never fatal — this is the fallback
    }
  }
  return out;
}
