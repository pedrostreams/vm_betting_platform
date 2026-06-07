"""Probe Sofascore via ScraperFC to verify v2 stat coverage.

After FBref's data provider revoked their advanced-stat feed, Sofascore is the
remaining free path to xA, balls recovered, big chances created, possession
won in attacking third, errors leading to shot/goal, and a few other v2
metrics. This probe validates which columns ScraperFC's
``Sofascore.scrape_player_league_stats`` actually returns and whether the
values are populated.

Writes:
  tmp/sofascore-probe.md         — column inventory + spot-check rows
  tmp/sofascore-probe.csv        — raw output for ad-hoc inspection

Usage:
    python scripts/probe-sofascore.py                   # PL, current season
    python scripts/probe-sofascore.py 24/25 EPL         # specific year + league
"""

from __future__ import annotations

import sys
from pathlib import Path

import ScraperFC as sfc

# Sofascore's API is JSON, but it gates on TLS fingerprint — both vanilla
# `requests` and `cloudscraper` get a 403. `curl_cffi` impersonates a real
# Chrome TLS handshake and breezes through.
#
# ScraperFC routes every Sofascore call through a headless Chrome instance via
# botasaurus, which (a) requires Google Chrome installed and (b) is overkill
# for a JSON API. We monkey-patch the module-level getter to use curl_cffi
# directly, sidestepping both the Chrome dep and botasaurus.
from curl_cffi import requests as _curl_requests
import ScraperFC.sofascore as _sofa_mod


def _sofa_get_json(url: str, *args, **kwargs) -> dict:
    """Drop-in replacement for ScraperFC's botasaurus_browser_get_json."""
    response = _curl_requests.get(url, impersonate="chrome120", timeout=30)
    response.raise_for_status()
    return response.json()


_sofa_mod.botasaurus_browser_get_json = _sofa_get_json

# soccerdata uses "ENG-Premier League"; ScraperFC's Sofascore module uses its
# own short codes. The default is the Premier League.
DEFAULT_YEAR = "25/26"
DEFAULT_LEAGUE = "EPL"

SPOT_CHECK_NAMES = [
    "Mohamed Salah",
    "Bukayo Saka",
    "Bruno Fernandes",
    "Rodri",
    "William Saliba",
]


def main() -> int:
    year = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_YEAR
    league = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_LEAGUE

    out_dir = Path(__file__).resolve().parent.parent / "tmp"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[probe-sofascore] year={year} league={league}", file=sys.stderr)
    sofa = sfc.Sofascore()

    # Some leagues require listing valid seasons first; surface them on failure.
    try:
        df = sofa.scrape_player_league_stats(year=year, league=league)
    except Exception as e:  # noqa: BLE001
        print(f"[probe-sofascore] FAILED: {e!r}", file=sys.stderr)
        try:
            print(f"[probe-sofascore] valid seasons for {league}:", sofa.get_valid_seasons(league), file=sys.stderr)
        except Exception:  # noqa: BLE001
            pass
        return 2

    csv_path = out_dir / "sofascore-probe.csv"
    df.to_csv(csv_path, index=False)
    print(f"[probe-sofascore] wrote {csv_path}: shape={df.shape}", file=sys.stderr)

    # Build a markdown report.
    lines: list[str] = [
        "# Sofascore probe (ScraperFC)",
        "",
        f"- year: `{year}`",
        f"- league: `{league}`",
        f"- ScraperFC: `{getattr(sfc, '__version__', 'unknown')}`",
        f"- Rows: **{len(df)}** · Columns: **{df.shape[1]}**",
        "",
        "## Columns",
        "",
        "| # | Column | Non-null | dtype | Sample value |",
        "|---|---|---|---|---|",
    ]
    for i, col in enumerate(df.columns, start=1):
        non_null = df[col].notna().sum()
        dtype = df[col].dtype
        sample = df[col].dropna().head(1)
        sample_v = repr(sample.iloc[0]) if len(sample) else "—"
        if len(sample_v) > 60:
            sample_v = sample_v[:57] + "..."
        lines.append(f"| {i} | `{col}` | {non_null} | {dtype} | {sample_v} |")
    lines.append("")

    # Spot-check rows for a handful of recognisable players.
    name_col_candidates = [c for c in df.columns if c.lower() in ("name", "player", "player_name", "playername")]
    if name_col_candidates:
        name_col = name_col_candidates[0]
        lines += ["## Spot-check rows", ""]
        for name in SPOT_CHECK_NAMES:
            mask = df[name_col].astype(str).str.contains(name, case=False, na=False)
            matches = df[mask]
            if len(matches) == 0:
                lines.append(f"### {name} — not found")
                lines.append("")
                continue
            row = matches.iloc[0]
            lines.append(f"### {name}")
            lines.append("")
            lines.append("| Stat | Value |")
            lines.append("|---|---|")
            for col in df.columns:
                v = row[col]
                lines.append(f"| `{col}` | {v} |")
            lines.append("")
    else:
        lines.append("_(no name-like column found for spot-check)_")

    out_path = out_dir / "sofascore-probe.md"
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[probe-sofascore] wrote {out_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
