"""Synthetic cities where the true effect of care is known: the proof of the method of "Did it
work?" (M5.4, docs/DIDIT_METHOD.md), used by pipeline/tests/test_didit.py and by the fuller study
in research/didit/synthetic.py.

Each synthetic city has places on a grid 15 km across, each with its own rate of events that
depends on its part of the city (neighbors are alike), a citywide rise and fall over the years
(like the shootings of 2020 to 2022), and noise that makes spikes, which fade (regression to the
mean). How care is chosen is a setting, from at random to the ways real programs choose that can
fool a comparison. Care then changes the rate by a known amount from the half year after it.
"""

from __future__ import annotations

import numpy as np

from placekeepers.didit.method import Places

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
    for t in range(5, N_HALVES - 1):
        seen = np.log1p(counts0[:, t - 4 : t].sum(axis=1)) + (poverty - 25) / 12
        burst = np.log1p(counts0[:, t - 1] / (expected[:, 0] + 0.5))
        score = need * seen + hidden * (log_rate - np.log(base)) + spike * burst
        p = care_share / (N_HALVES - 6) * np.exp(score - score.mean())
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
    truth = {"effect": effect, "lam": lam, "lam0": lam0}
    return places, counts.astype(np.int64), truth
