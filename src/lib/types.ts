export type Pick = "H" | "U" | "B";

export interface Team {
  id: number;
  name: string;
  tla: string | null;
  crest_url: string | null;
  group_code?: string | null;
}

export interface Odds {
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
}

export interface MatchView {
  id: number;
  stage: string;
  group_code: string | null;
  matchday: number | null;
  utc_date: string;
  lock_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  home: Team | null;
  away: Team | null;
  odds: Odds | null;
}
