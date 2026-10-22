"""Run every comparison of the "Did it work?" study on the real data and write the results.

    ../../pipeline/.venv/bin/python analyze.py

Reads out/study.npz (build.py). Writes results/estimates.csv (one row per kind of care, outcome and
comparison) and results/event_study.csv, and prints Markdown tables for docs/DIDIT_METHOD.md.

The choices below were fixed before any outcome was looked at (2026-10-21): two years before and
after, the half year of care skipped, up to five comparison places within 3 km but at least 400 m
away, matched on the two yearly counts before and the tract poverty rate, a counting circle of 200 m
with a ring to 400 m for crime moving elsewhere, a 90 percent interval from 2,000 draws of whole
areas, and three checks: the placebo two years before care, the ring, and a comparison with places
that got the same care later only.
"""

from __future__ import annotations

import csv
import json

import numpy as np
from common import OUT, RESULTS
from method import (
    POST,
    PRE,
    Places,
    estimate,
    estimate_sets,
    event_study,
    match,
    naive_before_after,
    outcome_sums,
)

LAST_COMPLETE = 22
OUTCOMES = {
    # name: (first complete half, leave out the place's own square)
    "shootings": (0, False),
    "dumping": (2, True),
    "complaints": (0, True),
}
TREATMENTS = ("landcare", "clean_seal", "demolition")
PLACEBO_SHIFT = PRE + POST + 1  # the pretend window ends right before the real one begins


def load() -> dict:
    with np.load(OUT / "study.npz") as z:
        return {k: z[k] for k in z.files}


def places_for(data: dict, treatment: str) -> tuple[Places, np.ndarray]:
    keep = data[f"{treatment}_relevant"] & data["in_city"]
    idx = np.flatnonzero(keep)
    return (
        Places(
            x=data["x"][idx],
            y=data["y"][idx],
            poverty=data["poverty"][idx],
            cluster=data["cluster"][idx],
            care=data[f"{treatment}_care"][idx],
            undated=data[f"{treatment}_undated"][idx],
            pool=data[f"{treatment}_pool"][idx],
        ),
        idx,
    )


def outcome(data: dict, name: str, idx: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    near = data[f"{name}_near"][idx].astype(np.int64)
    if OUTCOMES[name][1]:
        near = near - data[f"{name}_own"][idx]
    return near, data[f"{name}_ring"][idx].astype(np.int64)


def fmt(v, digits=1):
    return "" if v is None else f"{v:+.{digits}f}"


def main() -> None:
    data = load()
    rows, events = [], []
    for treatment in TREATMENTS:
        places, idx = places_for(data, treatment)
        for name, (first, _) in OUTCOMES.items():
            near, ring = outcome(data, name, idx)
            sets = match(places, near, first, LAST_COMPLETE)
            main_est = estimate_sets(sets)
            r_tp, r_tq, r_cp, r_cq = outcome_sums(sets, ring)
            ring_est = estimate(
                r_tp, r_tq, r_cp, r_cq, sets.n_controls, sets.cluster, controls=sets.controls
            )
            later = estimate_sets(match(places, near, first, LAST_COMPLETE, controls_from="later"))
            placebo_sets = match(places, near, first, LAST_COMPLETE, shift=PLACEBO_SHIFT)
            placebo = estimate_sets(placebo_sets)
            naive = naive_before_after(sets)
            cohorts = sorted(set(sets.half.tolist()))
            for label, est in (
                ("main", main_est),
                ("ring", ring_est),
                ("later", later),
                ("placebo", placebo),
            ):
                rows.append(
                    {
                        "treatment": treatment,
                        "outcome": name,
                        "comparison": label,
                        **est.as_dict(),
                        "first_half": cohorts[0] if cohorts else None,
                        "last_half": cohorts[-1] if cohorts else None,
                        "eligible": sets.eligible if label == "main" else None,
                        "naive": naive if label == "main" else None,
                    }
                )
            for e, v in event_study(sets, near).items():
                events.append({"treatment": treatment, "outcome": name, "half": e, "percent": v})
            print(
                f"{treatment:11s} {name:10s} sets={main_est.sets:5d} (of {sets.eligible}) "
                f"clusters={main_est.clusters:3d} pre={main_est.t_pre:6d} "
                f"main={fmt(main_est.percent)}% [{fmt(main_est.low)}, {fmt(main_est.high)}] "
                f"ring={fmt(ring_est.percent)}% [{fmt(ring_est.low)}, {fmt(ring_est.high)}] "
                f"later={fmt(later.percent)}% [{fmt(later.low)}, {fmt(later.high)}] n={later.sets} "
                f"placebo={fmt(placebo.percent)}% [{fmt(placebo.low)}, {fmt(placebo.high)}] "
                f"n={placebo.sets} naive={fmt(naive)}% balance={main_est.balance:.3f}"
            )
    with open(RESULTS / "estimates.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        for row in rows:
            w.writerow({k: round(v, 3) if isinstance(v, float) else v for k, v in row.items()})
    with open(RESULTS / "event_study.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(events[0]))
        w.writeheader()
        for row in events:
            w.writerow({k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()})
    print(json.dumps({"rows": len(rows)}))


if __name__ == "__main__":
    main()
