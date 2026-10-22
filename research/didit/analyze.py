"""Run the "Did it work?" study on the real data, as `pk didit` does, and keep the research tables.

    ../../pipeline/.venv/bin/python analyze.py

Needs the pipeline's snapshots in the shared cache (`pk fetch` and `pk validate` of the sources in
placekeepers.didit.study.SOURCES, including the two histories added for this study) and the
vacancy model (`pk derive`). Writes, in results/: estimates.csv (every comparison, in full),
event_study.csv (the change half year by half year, research only), care_dates.json (what the
records say about when care happened), and prints a Markdown table for docs/DIDIT_METHOD.md.

The choices were fixed before any outcome was looked at (commit aed4f1e, 2026-10-21): two years
before and after, the half year of care skipped, up to five comparison places within 3 km but at
least 400 m away, matched on the two yearly counts before and the tract poverty rate, a counting
circle of 200 m with a ring to 400 m, and a 90 percent interval from 2,000 draws of whole areas.
The placebo was moved to the two years ending right before the matched years after the synthetic
tests showed why (docs/DIDIT_METHOD.md, "Proving the method"), still before any real comparison.
"""

from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path

from common import CACHE, DERIVED, RESULTS
from placekeepers.didit import study


def snapshot(source_id: str) -> Path:
    path = CACHE / "snapshots" / source_id / "current.parquet"
    if not path.exists():
        raise SystemExit(f"no snapshot of {source_id}: run pk fetch {source_id} && pk validate")
    return path.resolve()


def pct(e: dict) -> str:
    if e["percent"] is None:
        return ""
    return f"{e['percent']:+.1f}% ({e['low']:+.1f} to {e['high']:+.1f})"


def main() -> None:
    inputs = study.Inputs(
        paths={part: snapshot(source) for part, source in study.SOURCES.items()},
        vacancy=DERIVED / "vacancy.parquet",
    )
    built = study.build(inputs)
    out = study.run(built, generated=date.today())
    rows = []
    for kind in out.results["kinds"]:
        for entry in kind["results"]:
            for comparison in ("main", "around", "later", "placebo"):
                rows.append(
                    {
                        "kind": kind["id"],
                        "outcome": entry["outcome"],
                        "comparison": comparison,
                        "verdict": entry["verdict"] if comparison == "main" else "",
                        **entry[comparison],
                        "naive": entry["naive"] if comparison == "main" else "",
                        "cohorts": " to ".join(entry["cohorts"] or []),
                    }
                )
    with open(RESULTS / "estimates.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    with open(RESULTS / "event_study.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "outcome", "half", "percent"])
        for key, values in out.event_study.items():
            kind, outcome = key.split("/")
            for half, value in values.items():
                w.writerow([kind, outcome, half, round(value, 1)])
    (RESULTS / "care_dates.json").write_text(
        json.dumps({"care": built.care, "outcomes": built.events}, indent=2) + "\n"
    )
    print(
        "| Care | Outcome | Places | Areas | Change | Verdict | Placebo | Around (200 to 400 m) "
        "| Later care only | Simple before and after |"
    )
    print("|---|---|---|---|---|---|---|---|---|---|")
    for kind in out.results["kinds"]:
        for e in kind["results"]:
            if e["main"]["places"] == 0:
                continue
            print(
                f"| {kind['id']} | {e['outcome']} | {e['main']['places']:,} | {e['main']['areas']} "
                f"| {pct(e['main'])} | {e['verdict']} | {pct(e['placebo'])} | {pct(e['around'])} "
                f"| {pct(e['later'])} | {e['naive']:+.1f}% |"
            )


if __name__ == "__main__":
    main()
