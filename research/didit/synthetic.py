"""Synthetic cities where the true effect of care is known, to prove the method.

    ../../pipeline/.venv/bin/python synthetic.py [replicates]

Each synthetic city has places on a grid 15 km across, each with its own rate of events that
depends on its part of the city (neighbors are alike), a citywide rise and fall over the years (like
the shootings of 2020 to 2022), and noise. Care is NOT given at random: places with more events, and
especially places that just had a bad half year, are more likely to get care, which is how real
programs choose and why a simple before and after comparison misleads (regression to the mean).
Care then changes the rate by a known amount from the half year after it.

The method must recover the effect when there is one and find none when there is none, and its 90
percent intervals should hold the truth about 90 times in 100. Writes results/synthetic.csv and
prints a Markdown table for docs/DIDIT_METHOD.md.
"""

from __future__ import annotations

import csv
import sys

import numpy as np
from common import RESULTS
from placekeepers.didit.method import (
    PLACEBO_SHIFT,
    estimate_sets,
    match,
    naive_before_after,
)
from placekeepers.didit.synthetic import N_HALVES, simulate

SCENARIOS = {
    # name: (how care is chosen, the true changes tried)
    "random": ({"need": 0.0}, (0.0, -0.1, -0.2, 0.15)),
    "targeted": ({}, (0.0, -0.1, -0.2, 0.15)),
    "after a spike": ({"spike": 1.0}, (0.0, -0.2)),
    "places on their own trend": ({"trend": 0.02}, (0.0, -0.2)),
    "hidden differences": ({"hidden": 1.0}, (0.0, -0.2)),
}


def run(seed: int, effect: float, draws: int = 1000, **how) -> dict:
    places, counts, _truth = simulate(seed, effect, **how)
    sets = match(places, counts, 0, N_HALVES - 1)
    est = estimate_sets(sets, draws=draws, seed=seed)
    placebo = estimate_sets(
        match(places, counts, 0, N_HALVES - 1, shift=PLACEBO_SHIFT),
        draws=draws,
        seed=seed,
    )
    return {
        "seed": seed,
        "effect": 100 * effect,
        "sets": est.places,
        "percent": est.percent,
        "low": est.low,
        "high": est.high,
        "covers": est.low <= 100 * effect <= est.high,
        "naive": naive_before_after(sets),
        "placebo": placebo.percent,
        "placebo_low": placebo.low,
        "placebo_high": placebo.high,
        "placebo_sets": placebo.places,
        "placebo_covers_zero": placebo.low <= 0 <= placebo.high,
    }


def main(replicates: int) -> None:
    rows = []
    for scenario, (how, effects) in SCENARIOS.items():
        for effect in effects:
            for r in range(replicates):
                rows.append({"scenario": scenario, **run(1000 + r, effect, **how)})
    with open(RESULTS / "synthetic.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        for row in rows:
            w.writerow({k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()})
    print(
        "| How care was chosen | True change | Cities | Average estimate | "
        "Intervals holding the truth | Simple before and after | Placebo check passed |"
    )
    print("|---|---|---|---|---|---|---|")
    for scenario, (_, effects) in SCENARIOS.items():
        for effect in effects:
            sub = [r for r in rows if r["scenario"] == scenario and r["effect"] == 100 * effect]
            print(
                f"| {scenario} | {100 * effect:+.0f}% | {len(sub)} | "
                f"{np.mean([r['percent'] for r in sub]):+.1f}% | "
                f"{sum(r['covers'] for r in sub)} of {len(sub)} | "
                f"{np.mean([r['naive'] for r in sub]):+.1f}% | "
                f"{sum(r['placebo_covers_zero'] for r in sub)} of {len(sub)} |"
            )
    print(f"\nAverage cared for places per city: {np.mean([r['sets'] for r in rows]):.0f}")
    print(f"Average in the placebo: {np.mean([r['placebo_sets'] for r in rows]):.0f}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 40)
