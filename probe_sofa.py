from curl_cffi import requests as r
import json

def get(url):
    resp = r.get(url, impersonate="chrome120", timeout=30)
    return resp.status_code, (resp.json() if resp.status_code==200 else None)

# 1) which tournament/season stat sets exist for Norway (team 4475)
sc, seasons = get("https://api.sofascore.com/api/v1/team/4475/team-statistics/seasons")
print("seasons endpoint:", sc)
if seasons:
    uts = seasons.get("uniqueTournamentSeasons", [])
    print("unique-tournaments available:", len(uts))
    for ut in uts[:6]:
        t = ut.get("uniqueTournament", {})
        ss = ut.get("seasons", [])
        print(f"  - {t.get('name')} (utId={t.get('id')}) seasons: {[s.get('year') for s in ss[:3]]} firstSeasonId={ss[0].get('id') if ss else None}")
