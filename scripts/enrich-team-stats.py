"""One-time enrichment: pull detailed national-team statistics from Sofascore
and upsert them into Supabase `team_stats` (decision-support "snacks").

Sofascore gates on TLS fingerprint, so we use curl_cffi impersonating Chrome.
This runs locally / ad-hoc — NOT in Vercel. For each of our teams it:
  1. resolves the Sofascore national-team id via search,
  2. picks the most relevant stat season (World Cup Qualifying 2026 preferred),
  3. fetches the overall statistics and stores a curated subset.

Usage:
    python scripts/enrich-team-stats.py
"""

from __future__ import annotations
import json, sys, time
from pathlib import Path
from urllib.parse import quote
from curl_cffi import requests as cr

ROOT = Path(__file__).resolve().parent.parent
SOFA = "https://api.sofascore.com/api/v1"

# Curated subset of the ~115 Sofascore fields we surface in the panel.
KEEP = [
    "matches", "goalsScored", "goalsConceded", "cleanSheets",
    "averageBallPossession", "shots", "shotsOnTarget", "bigChances",
    "accuratePassesPercentage", "avgRating", "duelsWonPercentage",
    "yellowCards", "redCards",
]


def load_env() -> dict:
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def sofa_get(url: str, tries: int = 3):
    for i in range(tries):
        try:
            r = cr.get(url, impersonate="chrome120", timeout=30)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 404:
                return None
        except Exception:
            pass
        time.sleep(0.8 * (i + 1))
    return None


# Our team name -> better Sofascore search term, where they differ.
SEARCH_ALIAS = {
    "United States": "USA",
    "Turkey": "Türkiye",
    "Cape Verde Islands": "Cape Verde",
    "Ivory Coast": "Côte d'Ivoire",
}


def find_team(name: str):
    query = SEARCH_ALIAS.get(name, name)
    data = sofa_get(f"{SOFA}/search/all?q={quote(query)}")
    if not data:
        return None
    teams = []
    for it in data.get("results", []):
        if it.get("type") != "team":
            continue
        e = it.get("entity", {})
        if (e.get("sport") or {}).get("slug") == "football":
            teams.append(e)
    for e in teams:
        if e.get("national"):
            return e
    return teams[0] if teams else None


def pick_season(team_id: int):
    data = sofa_get(f"{SOFA}/team/{team_id}/team-statistics/seasons")
    if not data:
        return None
    flat = []
    for ut in data.get("uniqueTournamentSeasons", []):
        t = ut.get("uniqueTournament", {})
        for s in ut.get("seasons", []):
            flat.append((t.get("name", ""), t.get("id"), s.get("id"), str(s.get("year", ""))))
    if not flat:
        return None
    for name, utid, sid, year in flat:
        if "World Cup Qual" in name and "2026" in year:
            return name, utid, sid, year
    for name, utid, sid, year in flat:
        if "World Cup Qual" in name:
            return name, utid, sid, year
    return max(flat, key=lambda x: x[2] or 0)


def main() -> int:
    env = load_env()
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    hdr = {"apikey": key, "authorization": f"Bearer {key}", "content-type": "application/json"}

    teams = cr.get(f"{url}/rest/v1/teams?select=id,name", headers=hdr, timeout=30).json()
    print(f"[enrich] {len(teams)} teams")

    rows, misses = [], []
    for i, t in enumerate(teams, 1):
        ent = find_team(t["name"])
        time.sleep(0.4)
        if not ent:
            misses.append(t["name"]); continue
        sid = ent["id"]
        season = pick_season(sid)
        time.sleep(0.4)
        if not season:
            misses.append(f"{t['name']} (no season)"); continue
        sname, utid, season_id, year = season
        stat = sofa_get(f"{SOFA}/team/{sid}/unique-tournament/{utid}/season/{season_id}/statistics/overall")
        time.sleep(0.4)
        s = (stat or {}).get("statistics", {})
        if not s:
            misses.append(f"{t['name']} (no stats)"); continue
        rows.append({
            "team_id": t["id"],
            "sofascore_id": sid,
            "source_tournament": f"{sname} {year}".strip(),
            "matches": s.get("matches"),
            "stats": {k: s[k] for k in KEEP if k in s},
        })
        print(f"[{i}/{len(teams)}] {t['name']:<22} <- {sname} {year} ({s.get('matches')} kamper)")

    # Upsert in one batch.
    if rows:
        resp = cr.post(
            f"{url}/rest/v1/team_stats?on_conflict=team_id",
            headers={**hdr, "prefer": "resolution=merge-duplicates,return=minimal"},
            data=json.dumps(rows), timeout=60,
        )
        print(f"[enrich] upsert status {resp.status_code} ({len(rows)} rows)")
        if resp.status_code >= 300:
            print(resp.text[:500])
    if misses:
        print(f"[enrich] {len(misses)} unmatched: {', '.join(misses)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
