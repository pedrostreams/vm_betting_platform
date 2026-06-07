"""Fetch Sofascore player-season stats and write tmp/sofascore.json.

Companion to scripts/ingest-sofascore.ts — same shape as the Understat path:
this script does the network fetch, the TS ingest does name matching and DB
upserts.

Why this exists in addition to fetch-understat.py:
  Sofascore exposes ~110 player season stats per league, including v2 P0
  metrics (ball recoveries, possession won in att third, accurate passes
  into final third, big chances created, etc.) that neither Sportmonks nor
  Understat surface. After FBref's data provider revoked their advanced-stat
  feed, Sofascore is the remaining free path.

Implementation notes:
  - We use ScraperFC.Sofascore for its column-mapping work, but bypass the
    botasaurus/Chrome dependency by monkey-patching the module-level JSON
    getter to call curl_cffi directly. Sofascore's API gates on TLS
    fingerprint; vanilla `requests` and cloudscraper get 403, curl_cffi
    impersonating chrome120 returns 200.
  - We filter the 110 columns to only what migration 0008 added to the
    catalog. Skipping ~75 columns that duplicate Sportmonks/Understat.

Usage:
    python scripts/fetch-sofascore.py                   # PL, current season
    python scripts/fetch-sofascore.py 25/26 EPL         # explicit
    python scripts/fetch-sofascore.py 25/26 ALL         # all top-5 leagues
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import ScraperFC as sfc

# ---- curl_cffi monkey-patch (see header comment) -----------------------------
from curl_cffi import requests as _curl_requests
import ScraperFC.sofascore as _sofa_mod


def _sofa_get_json(url: str, *args, **kwargs) -> dict:
    response = _curl_requests.get(url, impersonate="chrome120", timeout=30)
    response.raise_for_status()
    return response.json()


_sofa_mod.botasaurus_browser_get_json = _sofa_get_json
# ------------------------------------------------------------------------------

# Sofascore league-name -> our canonical code (matches what ingest-sofascore.ts
# expects in LEAGUE_BY_CODE, mirrors fetch-understat.py's "ENG-Premier League"
# format so both ingests share conventions).
LEAGUE_NAME_TO_CODE = {
    "England Premier League": "ENG-Premier League",
    "Spain La Liga":           "ESP-La Liga",
    "Italy Serie A":           "ITA-Serie A",
    "Germany Bundesliga":      "GER-Bundesliga",
    "France Ligue 1":          "FRA-Ligue 1",
}

# Short-code shortcuts on the CLI.
CLI_ALIASES = {
    "EPL": "England Premier League",
    "ALL": list(LEAGUE_NAME_TO_CODE.keys()),
}

# Sofascore camelCase column -> our snake_case stat_catalog id.
# Only stats that migration 0008 added — anything not in this map is dropped.
STAT_COLS: dict[str, str] = {
    # Aggregate
    "rating":                       "sofa_rating",
    "totwAppearances":              "totw_appearances",
    # Shooting
    "goalConversionPercentage":     "goal_conversion_pct",
    "hitWoodwork":                  "hit_woodwork",
    # Passing
    "accurateFinalThirdPasses":     "accurate_final_third_passes",
    "accurateLongBalls":            "accurate_long_balls",
    "totalLongBalls":               "total_long_balls",
    "accurateLongBallsPercentage":  "accurate_long_balls_pct",
    "accurateOppositionHalfPasses": "accurate_opp_half_passes",
    "totalOppositionHalfPasses":    "total_opp_half_passes",
    "accurateOwnHalfPasses":        "accurate_own_half_passes",
    "totalOwnHalfPasses":           "total_own_half_passes",
    "accurateChippedPasses":        "accurate_chipped_passes",
    "totalChippedPasses":           "total_chipped_passes",
    "passToAssist":                 "pass_to_assist",
    "bigChancesCreated":            "big_chances_created",
    # Defending
    "ballRecovery":                 "ball_recoveries",
    "possessionWonAttThird":        "possession_won_att_third",
    "dribbledPast":                 "dribbled_past",
    "errorLeadToShot":              "error_led_to_shot",
    "errorLeadToGoal":              "error_led_to_goal",
    "groundDuelsWon":               "ground_duels_won",
    "groundDuelsWonPercentage":     "ground_duels_won_pct",
    # Goalkeeping
    "goalsPrevented":               "goals_prevented",
    "runsOut":                      "runs_out",
    "successfulRunsOut":            "successful_runs_out",
    "crossesNotClaimed":            "crosses_not_claimed",
    "highClaims":                   "high_claims",
    "punches":                      "punches",
}


def _coerce_number(v):
    if v is None:
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    if n != n:  # NaN
        return None
    return n


def fetch_league(sofa: sfc.Sofascore, year: str, league: str) -> list[dict]:
    print(f"[sofascore] {league} {year}", file=sys.stderr)
    df = sofa.scrape_player_league_stats(year=year, league=league)
    code = LEAGUE_NAME_TO_CODE[league]

    rows: list[dict] = []
    for _, r in df.iterrows():
        stats: dict[str, float] = {}
        for src, dst in STAT_COLS.items():
            n = _coerce_number(r.get(src))
            if n is not None:
                stats[dst] = n

        # Sofascore's `minutesPlayed` is captured separately — used by the TS
        # ingest only as the denominator for per-90 derivations, never written
        # as a stat row (Sportmonks owns the canonical `minutes`).
        minutes = _coerce_number(r.get("minutesPlayed"))

        rows.append({
            "league": code,
            "season": year,
            "sofascore_id": str(int(r["player id"])) if "player id" in r and r["player id"] is not None else None,
            "name": str(r.get("player", "")).strip(),
            "team": str(r.get("team", "")).strip(),
            "minutes": minutes,
            "stats": stats,
        })
    return rows


def main() -> int:
    year = sys.argv[1] if len(sys.argv) > 1 else "25/26"
    league_arg = sys.argv[2] if len(sys.argv) > 2 else "EPL"

    if league_arg in CLI_ALIASES:
        target = CLI_ALIASES[league_arg]
        leagues = target if isinstance(target, list) else [target]
    else:
        leagues = [league_arg]

    sofa = sfc.Sofascore()

    all_rows: list[dict] = []
    for league in leagues:
        try:
            all_rows.extend(fetch_league(sofa, year, league))
        except Exception as e:  # noqa: BLE001
            print(f"[sofascore] {league} FAILED: {e!r}", file=sys.stderr)

    out_path = Path(__file__).resolve().parent.parent / "tmp" / "sofascore.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps({"season": year, "rows": all_rows}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"[sofascore] wrote {len(all_rows)} rows -> {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
