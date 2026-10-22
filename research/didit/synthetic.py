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
from method import PRE, Places, estimate_sets, match, naive_before_after

N_HALVES = 22
SIDE = 60  # places per side
SPACING = 250.0  # meters between places
CLUSTER = 2500.0  # bootstrap areas, meters across


def simulate(
    seed: int,
    effect: float,
    *,
    base: float = 1.2,
    need: float = 0.8,
    hidden: float = 0.0,
    spike: float = 0.0,
    trend: float = 0.0,
    care_share: float = 0.25,
) -> tuple[Places, np.ndarray, dict]:
    """A synthetic city. `effect` is the true proportional change after care (-0.2 is 20 percent
    fewer). Returns the places, their counts (places, halves) and the truth.

    How care is chosen: `need` weighs what the method can see (the events of the two years before
    and the poverty rate), `hidden` weighs what it cannot (the part of a place's lasting rate that
    its past counts and poverty do not reveal), and `spike` weighs a bad last half year on its own.
    `trend` gives each place its own steady drift up or down (the spread of the yearly change in its
    log rate, per half year), which care may then follow: places rising fastest get chosen.
    With `hidden` and `spike` at zero the method's assumption holds: care depends only on what is
    matched on."""
    rng = np.random.default_rng(seed)
    gx, gy = np.meshgrid(np.arange(SIDE), np.arange(SIDE))
    x = gx.ravel() * SPACING
    y = gy.ravel() * SPACING
    n = len(x)
    # A smooth field: parts of the city with more events and more poverty.
    centers = rng.uniform(0, SIDE * SPACING, size=(6, 2))
    field = np.zeros(n)
    for cx, cy in centers:
        field += np.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * 2500.0**2))
    field = (field - field.mean()) / field.std()
    log_rate = np.log(base) + 0.8 * field + rng.normal(0, 0.5, n)
    poverty = np.clip(25 + 12 * field + rng.normal(0, 5, n), 0, 80)
    # A citywide rise and fall, and slow drifts by area.
    city = 1 + 0.6 * np.exp(-((np.arange(N_HALVES) - 11) ** 2) / (2 * 3.0**2))
    drift = rng.normal(0, trend, n)[:, None] * np.arange(N_HALVES)[None, :]
    rate = np.exp(log_rate)[:, None] * city[None, :] * np.exp(drift)
    # Half year shocks that fade: they make spikes, and spikes regress to the mean.
    shock = rng.gamma(4.0, 0.25, size=(n, N_HALVES))
    lam0 = rate * shock
    counts0 = rng.poisson(lam0)
    # Selection: more likely where rates are high and right after a bad half year.
    care = np.zeros((n, N_HALVES), dtype=bool)
    expected = rate.mean(axis=1, keepdims=True)
    for t in range(PRE + 1, N_HALVES - 1):
        seen = np.log1p(counts0[:, t - PRE : t].sum(axis=1)) + (poverty - 25) / 12
        burst = np.log1p(counts0[:, t - 1] / (expected[:, 0] + 0.5))
        score = need * seen + hidden * (log_rate - np.log(base)) + spike * burst
        p = care_share / (N_HALVES - PRE - 2) * np.exp(score - score.mean())
        p = np.clip(p, 0, 0.5)
        newly = (rng.uniform(size=n) < p) & ~care.any(axis=1)
        care[newly, t] = True
    when = np.where(care.any(axis=1), care.argmax(axis=1), N_HALVES)
    after = np.arange(N_HALVES)[None, :] > when[:, None]
    lam = lam0 * np.where(after, 1 + effect, 1.0)
    # The same random draws where nothing changed, so the effect is the only difference.
    counts = np.where(after, rng.poisson(lam), counts0)
    cluster = (np.floor(x / CLUSTER) * 100 + np.floor(y / CLUSTER)).astype(np.int64)
    places = Places(
        x=x,
        y=y,
        poverty=poverty,
        cluster=cluster,
        care=care,
        undated=np.zeros(n, dtype=bool),
        pool=np.ones(n, dtype=bool),
    )
    # The wider area: every other place within 750 meters (the ring the real study counts in).
    grid = counts.reshape(SIDE, SIDE, N_HALVES)
    area = np.zeros_like(grid)
    reach = int(750 // SPACING)
    for dx in range(-reach, reach + 1):
        for dy in range(-reach, reach + 1):
            if (dx or dy) and (dx * dx + dy * dy) * SPACING**2 <= 750.0**2:
                shifted = np.roll(np.roll(grid, dx, axis=0), dy, axis=1)
                # no wrapping around the edges of the city
                if dx > 0:
                    shifted[:dx] = 0
                elif dx < 0:
                    shifted[dx:] = 0
                if dy > 0:
                    shifted[:, :dy] = 0
                elif dy < 0:
                    shifted[:, dy:] = 0
                area += shifted
    truth = {"effect": effect, "lam": lam, "lam0": lam0, "area": area.reshape(n, N_HALVES)}
    return places, counts.astype(np.int64), truth


def run(seed: int, effect: float, draws: int = 1000) -> dict:
    places, counts, _truth = simulate(seed, effect)
    sets = match(places, counts, 0, N_HALVES - 1)
    est = estimate_sets(sets, draws=draws, seed=seed)
    placebo = estimate_sets(
        match(places, counts, 0, N_HALVES - 1, shift=PRE + 1), draws=draws, seed=seed
    )
    return {
        "seed": seed,
        "effect": 100 * effect,
        "sets": est.sets,
        "percent": est.percent,
        "low": est.low,
        "high": est.high,
        "covers": est.low <= 100 * effect <= est.high,
        "naive": naive_before_after(sets),
        "placebo": placebo.percent,
        "placebo_low": placebo.low,
        "placebo_high": placebo.high,
        "placebo_covers_zero": placebo.low <= 0 <= placebo.high,
    }


def main(replicates: int) -> None:
    rows = []
    for effect in (0.0, -0.1, -0.2, 0.15):
        for r in range(replicates):
            rows.append(run(1000 + r, effect))
    with open(RESULTS / "synthetic.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        for row in rows:
            w.writerow({k: round(v, 2) if isinstance(v, float) else v for k, v in row.items()})
    print(
        "| True change | Cities | Average estimate | Intervals holding the truth | "
        "Average simple before and after | Placebo intervals holding zero |"
    )
    print("|---|---|---|---|---|---|")
    for effect in (0.0, -10.0, -20.0, 15.0):
        sub = [r for r in rows if r["effect"] == effect]
        print(
            f"| {effect:+.0f}% | {len(sub)} | {np.mean([r['percent'] for r in sub]):+.1f}% | "
            f"{sum(r['covers'] for r in sub)} of {len(sub)} | "
            f"{np.mean([r['naive'] for r in sub]):+.1f}% | "
            f"{sum(r['placebo_covers_zero'] for r in sub)} of {len(sub)} |"
        )
    print(f"\nAverage cared for places per city: {np.mean([r['sets'] for r in rows]):.0f}")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 40)
