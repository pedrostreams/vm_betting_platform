// Thin typed client for football-data.org v4 — the World Cup data backbone.
// Free tier: ~10 req/min. Token via X-Auth-Token header.

const BASE = "https://api.football-data.org/v4";
const WC = "competitions/WC";

function token(): string {
  const t = process.env.FOOTBALL_DATA_TOKEN;
  if (!t) throw new Error("FOOTBALL_DATA_TOKEN is not set");
  return t;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/${path}`, {
    headers: { "X-Auth-Token": token() },
    // Always fetch fresh in cron/seed; callers can wrap with their own cache.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`football-data ${path} -> HTTP ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---- Response shapes (only the fields we use) -------------------------------

export interface FdTeamRef {
  id: number | null;
  name: string | null;
  tla: string | null;
  crest: string | null;
}

export interface FdScore {
  winner: string | null; // HOME_TEAM | AWAY_TEAM | DRAW
  duration: string | null; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
  fullTime: { home: number | null; away: number | null };
}

export interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: FdTeamRef;
  awayTeam: FdTeamRef;
  score: FdScore;
}

export interface FdSquadPlayer {
  id: number;
  name: string;
  position: string | null;
  dateOfBirth: string | null;
}

export interface FdTeam {
  id: number;
  name: string;
  tla: string | null;
  crest: string | null;
  squad: FdSquadPlayer[];
}

export interface FdScorer {
  player: { id: number; name: string };
  team: { id: number; name: string };
  goals: number | null;
  assists: number | null;
}

export const footballData = {
  matches: () => get<{ matches: FdMatch[] }>(`${WC}/matches`),
  teams: () => get<{ teams: FdTeam[] }>(`${WC}/teams`),
  scorers: (limit = 30) => get<{ scorers: FdScorer[] }>(`${WC}/scorers?limit=${limit}`),
  standings: () => get<unknown>(`${WC}/standings`),
};
