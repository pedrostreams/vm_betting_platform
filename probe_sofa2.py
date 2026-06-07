from curl_cffi import requests as r
sc = r.get("https://api.sofascore.com/api/v1/team/4475/unique-tournament/11/season/69427/statistics/overall", impersonate="chrome120", timeout=30)
print("status:", sc.status_code)
if sc.status_code==200:
    s = sc.json().get("statistics", {})
    keys = list(s.keys())
    print("num fields:", len(keys))
    # print a curated set
    interesting = ['matches','goalsScored','goalsConceded','assists','cleanSheets','averageBallPossession',
                   'shots','shotsOnTarget','bigChances','bigChancesMissed','accuratePassesPercentage',
                   'goalsScoredPerMatch','goalsConcededPerMatch','yellowCards','redCards','penaltyGoals',
                   'shotsPerMatch','cornerKicks','tackles','interceptions']
    for k in interesting:
        if k in s: print(f"  {k} = {s[k]}")
    print("--- ALL keys ---")
    print(", ".join(keys))
