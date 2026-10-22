"""The method of "Did it work?" (M5.4, issue #48): matched difference in differences on counts of
events near places. docs/DIDIT_METHOD.md explains it in plain words; this is the arithmetic.

Each place that got care in some half year is compared with up to five places that did not get
that care in the two years before or after, from the same part of the city (3 km or closer, but at
least 400 m away so the two do not share the same surroundings), with a similar count of the
outcome in each of the two years before, and a similar share of neighbors in poverty. The change at
the cared for place (the two years after against the two years before, the half year of care
skipped) is compared with the average change at its comparison places. Pooling every place gives
the estimate; resampling whole areas of the city (about 5 square kilometers each) gives a 90
percent interval.

Plain numpy, deterministic: the bootstrap draws come from the raw PCG64 stream, which numpy keeps
stable across versions, so a test can reproduce every published number from the per area totals
(docs/CONTRACTS.md section 12). Proved on synthetic cities in pipeline/tests/test_didit.py and
research/didit/synthetic.py.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

#: Halves (six months each) before and after the half year of care that are compared.
PRE = 4
POST = 4
#: Comparison places per cared for place, at most (a place may serve several cared for places).
K = 5
#: Comparison places lie within this distance of the cared for place (meters) ...
MAX_DISTANCE = 3000.0
#: ... and at least this far, so the two do not share the same counting circle.
MIN_DISTANCE = 400.0
#: The largest allowed difference in the square root of the count in each prior year.
COUNT_CALIPER = 0.5
#: The largest allowed difference in the tract poverty rate, in percentage points.
POVERTY_CALIPER = 5.0
#: Bootstrap draws for the intervals, the interval's coverage, and the seed.
DRAWS = 2000
LEVEL = 0.90
SEED = 20261021
#: The comparison places' average is stored times this number (the least common multiple of 1 to
#: K), which makes every stored total a whole number.
SCALE = 60
#: The placebo pretends care happened this many halves earlier: its two years after end right
#: before the two years the real comparison starts from.
PLACEBO_SHIFT = PRE + POST + 1


@dataclass
class Places:
    """Every place that may be cared for or compared, with what the matching needs.

    `care` is True where the place got this kind of care in that half year (dated records).
    `undated` marks places with a record of this care whose date is unknown: they are never
    compared and never counted as cared for. `pool` marks places of the right kind that may be
    compared even if the records never show them getting this care (a vacant lot today).
    """

    x: np.ndarray  # meters, in a projected coordinate system
    y: np.ndarray
    poverty: np.ndarray  # tract poverty rate in percent, NaN when unknown
    cluster: np.ndarray  # int: the area each place lies in, for the bootstrap
    care: np.ndarray  # bool (n places, n halves)
    undated: np.ndarray  # bool (n places,)
    pool: np.ndarray  # bool (n places,)

    def __post_init__(self) -> None:
        n = len(self.x)
        if self.care.shape[0] != n:
            raise ValueError("care must have one row per place")
        for name in ("y", "poverty", "cluster", "undated", "pool"):
            if len(getattr(self, name)) != n:
                raise ValueError(f"{name} must have one value per place")


@dataclass
class Sets:
    """Matched sets: each cared for place with its comparison places and their counts.

    Counts are whole numbers: the cared for place's total before and after, and the sum over its
    comparison places of theirs (divide by `n_controls` for their average).
    """

    unit: np.ndarray  # index of the cared for place
    half: np.ndarray  # its half year of care
    cluster: np.ndarray
    n_controls: np.ndarray
    controls: np.ndarray  # (n sets, K), -1 where fewer than K
    t_pre: np.ndarray
    t_post: np.ndarray
    c_pre: np.ndarray
    c_post: np.ndarray
    shift: int = 0
    dropped: int = 0  # cared for places with no comparison place close in every way
    eligible: int = 0  # cared for places with a full window, before matching

    def __len__(self) -> int:
        return len(self.unit)


def count_near(
    px: np.ndarray,
    py: np.ndarray,
    ex: np.ndarray,
    ey: np.ndarray,
    eh: np.ndarray,
    n_halves: int,
    radii: tuple[float, ...],
) -> np.ndarray:
    """Count events near each place by half year and by ring.

    Returns an int32 array (n places, n halves, len(radii)): ring 0 counts events within radii[0]
    meters, ring 1 those farther than radii[0] and within radii[1], and so on. Events outside
    0 <= half < n_halves are ignored. Distances are straight lines.
    """
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    eh = np.asarray(eh)
    keep = (eh >= 0) & (eh < n_halves)
    ex, ey, eh = np.asarray(ex, float)[keep], np.asarray(ey, float)[keep], eh[keep]
    out = np.zeros((len(px), n_halves, len(radii)), dtype=np.int32)
    if len(px) == 0 or len(ex) == 0:
        return out
    size = float(max(radii))
    r2 = np.asarray(radii, dtype=float) ** 2
    ecx = np.floor(ex / size).astype(np.int64)
    ecy = np.floor(ey / size).astype(np.int64)
    order = np.lexsort((ecy, ecx))
    ecx, ecy, ex, ey, eh = ecx[order], ecy[order], ex[order], ey[order], eh[order]
    keys = ecx * 1_000_003 + ecy
    uniq, first, counts = np.unique(keys, return_index=True, return_counts=True)
    spans = {
        k: (f, f + c)
        for k, f, c in zip(uniq.tolist(), first.tolist(), counts.tolist(), strict=True)
    }
    pcx = np.floor(px / size).astype(np.int64)
    pcy = np.floor(py / size).astype(np.int64)
    pkeys = pcx * 1_000_003 + pcy
    for key in np.unique(pkeys).tolist():
        members = np.flatnonzero(pkeys == key)
        cx, cy = pcx[members[0]], pcy[members[0]]
        near = [
            spans[k]
            for k in ((cx + dx) * 1_000_003 + (cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            if k in spans
        ]
        if not near:
            continue
        idx = np.concatenate([np.arange(a, b) for a, b in near])
        d2 = (px[members, None] - ex[None, idx]) ** 2 + (py[members, None] - ey[None, idx]) ** 2
        ring = np.searchsorted(r2, d2, side="left")  # 0 within radii[0] ... len(radii) outside
        rows, cols = np.nonzero(ring < len(radii))
        np.add.at(out, (members[rows], eh[idx[cols]], ring[rows, cols]), 1)
    return out


def _free(cum: np.ndarray, a: int, b: int) -> np.ndarray:
    """True where a place has no care from half `a` to half `b`, inclusive (cum: cumulative care
    counts with a leading column of zeros)."""
    return (cum[:, b + 1] - cum[:, a]) == 0


def match(
    places: Places,
    counts: np.ndarray,
    first_half: int,
    last_half: int,
    *,
    shift: int = 0,
    controls_from: str = "all",
    k: int = K,
) -> Sets:
    """Build matched sets for one outcome.

    `counts` (n places, n halves) is the outcome near each place; only halves `first_half` to
    `last_half` (inclusive) have complete data. A place is cared for at half t when it got care at
    t and none in the PRE halves before. With `shift` > 0 the comparison is a placebo that
    pretends care happened `shift` halves earlier, all of it before the real care: it should find
    no change. `controls_from` is "all" (places without this care in the window: those that got it
    later, and those of the right kind that never got it) or "later" (only those that got it
    later, after the window).
    """
    if controls_from not in ("all", "later"):
        raise ValueError("controls_from is 'all' or 'later'")
    n_places, n_halves = places.care.shape
    care = places.care.astype(np.int32)
    cum = np.concatenate([np.zeros((n_places, 1), np.int32), np.cumsum(care, axis=1)], axis=1)
    names = ("unit", "half", "cluster", "n", "t_pre", "t_post", "c_pre", "c_post")
    rows: dict[str, list[int]] = {name: [] for name in names}
    chosen_rows: list[np.ndarray] = []
    dropped = eligible = 0
    for t in range(n_halves):
        f = t - shift  # the half treated as the half of care
        lo, hi = f - PRE, f + POST
        if lo < first_half or hi > last_half:
            continue
        # No care in the halves before t that the comparison uses (for a placebo, the whole
        # pretend window lies before the real care).
        treated = places.care[:, t] & _free(cum, lo, t - 1) & ~places.undated
        tidx = np.flatnonzero(treated)
        if len(tidx) == 0:
            continue
        end = max(hi, t)
        free = _free(cum, lo, end) & ~places.undated
        later = (cum[:, n_halves] - cum[:, end + 1]) > 0
        cand = free & later if controls_from == "later" else free & (later | places.pool)
        cidx = np.flatnonzero(cand)
        eligible += len(tidx)
        if len(cidx) == 0:
            dropped += len(tidx)
            continue
        # Square roots of the two yearly totals before: the measure of level and trend.
        year_a = np.sqrt(counts[:, lo : lo + PRE // 2].sum(axis=1).astype(float))
        year_b = np.sqrt(counts[:, lo + PRE // 2 : f].sum(axis=1).astype(float))
        pre_sl, post_sl = slice(lo, f), slice(f + 1, hi + 1)
        for i in tidx.tolist():
            dist = np.hypot(places.x[cidx] - places.x[i], places.y[cidx] - places.y[i])
            da = year_a[cidx] - year_a[i]
            db = year_b[cidx] - year_b[i]
            dp = places.poverty[cidx] - places.poverty[i]
            ok = (
                (dist >= MIN_DISTANCE)
                & (dist <= MAX_DISTANCE)
                & (np.abs(da) <= COUNT_CALIPER)
                & (np.abs(db) <= COUNT_CALIPER)
                & ~(np.abs(dp) > POVERTY_CALIPER)  # an unknown poverty rate never blocks a match
            )
            if not ok.any():
                dropped += 1
                continue
            score = (
                da**2
                + db**2
                + np.nan_to_num(dp / POVERTY_CALIPER) ** 2
                + 0.25 * (dist / MAX_DISTANCE) ** 2
            )
            good = np.flatnonzero(ok)
            chosen = cidx[good[np.argsort(score[good], kind="stable")[:k]]]
            row = np.full(k, -1, dtype=np.int64)
            row[: len(chosen)] = chosen
            chosen_rows.append(row)
            for name, value in (
                ("unit", i),
                ("half", t),
                ("cluster", int(places.cluster[i])),
                ("n", len(chosen)),
                ("t_pre", int(counts[i, pre_sl].sum())),
                ("t_post", int(counts[i, post_sl].sum())),
                ("c_pre", int(counts[chosen, pre_sl].sum())),
                ("c_post", int(counts[chosen, post_sl].sum())),
            ):
                rows[name].append(value)
    arr = {name: np.asarray(values, dtype=np.int64) for name, values in rows.items()}
    return Sets(
        unit=arr["unit"],
        half=arr["half"],
        cluster=arr["cluster"],
        n_controls=arr["n"],
        controls=np.vstack(chosen_rows) if chosen_rows else np.zeros((0, k), dtype=np.int64),
        t_pre=arr["t_pre"],
        t_post=arr["t_post"],
        c_pre=arr["c_pre"],
        c_post=arr["c_post"],
        shift=shift,
        dropped=dropped,
        eligible=eligible,
    )


def remeasure(sets: Sets, counts: np.ndarray) -> Sets:
    """The same matched sets measured on another count (the ring around the counting circle)."""
    t_pre, t_post, c_pre, c_post = (np.zeros(len(sets), dtype=np.int64) for _ in range(4))
    for j in range(len(sets)):
        f = int(sets.half[j]) - sets.shift
        pre_sl, post_sl = slice(f - PRE, f), slice(f + 1, f + POST + 1)
        i = int(sets.unit[j])
        chosen = sets.controls[j][sets.controls[j] >= 0]
        t_pre[j] = counts[i, pre_sl].sum()
        t_post[j] = counts[i, post_sl].sum()
        c_pre[j] = counts[chosen, pre_sl].sum()
        c_post[j] = counts[chosen, post_sl].sum()
    return Sets(
        unit=sets.unit,
        half=sets.half,
        cluster=sets.cluster,
        n_controls=sets.n_controls,
        controls=sets.controls,
        t_pre=t_pre,
        t_post=t_post,
        c_pre=c_pre,
        c_post=c_post,
        shift=sets.shift,
        dropped=sets.dropped,
        eligible=sets.eligible,
    )


@dataclass
class Totals:
    """One comparison summed by area: what the estimate and its interval are computed from, and
    what docs/CONTRACTS.md section 12 publishes so a test can reproduce every number."""

    cluster: np.ndarray  # area labels (anonymous numbers when published)
    places: np.ndarray  # cared for places in the area
    t_pre: np.ndarray  # their events before ...
    t_post: np.ndarray  # ... and after
    c_pre: np.ndarray  # SCALE times the sum of their comparison places' averages, before ...
    c_post: np.ndarray  # ... and after

    def __len__(self) -> int:
        return len(self.cluster)


def totals(sets: Sets) -> Totals:
    labels, inverse = np.unique(np.asarray(sets.cluster), return_inverse=True)
    g = len(labels)
    per = SCALE // np.maximum(sets.n_controls, 1)

    def by_area(values: np.ndarray) -> np.ndarray:
        return np.bincount(inverse, weights=values, minlength=g).round().astype(np.int64)

    return Totals(
        cluster=labels.astype(np.int64),
        places=np.bincount(inverse, minlength=g).astype(np.int64),
        t_pre=by_area(sets.t_pre),
        t_post=by_area(sets.t_post),
        c_pre=by_area(sets.c_pre * per),
        c_post=by_area(sets.c_post * per),
    )


@dataclass
class Estimate:
    """What one comparison found."""

    places: int  # cared for places compared
    areas: int  # areas they lie in
    t_pre: int  # events near the cared for places in the two years before
    t_post: int  # ... and in the two years after
    expected: float  # events expected after, had they changed like their comparison places
    percent: float | None  # (t_post - expected) as a percent of expected
    low: float | None  # its 90 percent interval
    high: float | None
    per_place_year: float  # the change per cared for place per year, in events
    per_low: float | None
    per_high: float | None
    balance: float | None  # comparison places' count before, as a share of the cared for places'

    def as_dict(self) -> dict:
        return {name: getattr(self, name) for name in self.__dataclass_fields__}


def draws_index(n_areas: int, draws: int, seed: int) -> np.ndarray:
    """Area indices for each bootstrap draw (draws, n_areas), from the raw PCG64 stream."""
    raw = np.random.PCG64(seed).random_raw(draws * n_areas)
    return (raw % np.uint64(n_areas)).astype(np.int64).reshape(draws, n_areas)


def estimate(
    tot: Totals, *, draws: int = DRAWS, seed: int = SEED, level: float = LEVEL
) -> Estimate:
    """Pool the matched sets of one comparison into one estimate with a 90 percent interval.

    The expected count after, for each cared for place, is its count before plus its comparison
    places' average change (an additive difference in differences); the change is what happened
    minus that. The interval resamples whole areas with replacement.
    """
    years = POST / 2
    m = int(tot.places.sum())
    if m == 0:
        return Estimate(0, 0, 0, 0, 0.0, None, None, None, 0.0, None, None, None)
    c_change = (tot.c_post - tot.c_pre) / SCALE
    expected_a = tot.t_pre + c_change
    change_a = tot.t_post - expected_a
    expected, change = float(expected_a.sum()), float(change_a.sum())
    percent = 100.0 * change / expected if expected > 0 else None
    balance = float(tot.c_pre.sum() / SCALE / tot.t_pre.sum()) if tot.t_pre.sum() > 0 else None
    g = len(tot)
    low = high = per_low = per_high = None
    if g >= 2 and draws > 0:
        idx = draws_index(g, draws, seed)
        weights = np.zeros((draws, g))
        np.add.at(weights, (np.repeat(np.arange(draws), g), idx.ravel()), 1.0)
        b_change = weights @ change_a
        b_expected = weights @ expected_a
        b_places = weights @ tot.places.astype(float)
        alpha = (1 - level) / 2
        with np.errstate(divide="ignore", invalid="ignore"):
            b_pct = np.where(b_expected > 0, 100.0 * b_change / b_expected, np.nan)
        if percent is not None and np.isfinite(b_pct).all():
            low, high = (float(v) for v in np.quantile(b_pct, [alpha, 1 - alpha]))
        b_per = b_change / b_places / years
        per_low, per_high = (float(v) for v in np.quantile(b_per, [alpha, 1 - alpha]))
    return Estimate(
        places=m,
        areas=g,
        t_pre=int(tot.t_pre.sum()),
        t_post=int(tot.t_post.sum()),
        expected=expected,
        percent=percent,
        low=low,
        high=high,
        per_place_year=change / m / years,
        per_low=per_low,
        per_high=per_high,
        balance=balance,
    )


def estimate_sets(sets: Sets, **kwargs) -> Estimate:
    return estimate(totals(sets), **kwargs)


def event_study(sets: Sets, counts: np.ndarray) -> dict[int, float]:
    """The average difference at each half year from PRE before to POST after, measured from each
    place's own average before, as a percent of the cared for places' average per half before.
    The halves before are near zero by construction (they were matched on); the halves after show
    how a change, if any, unfolds."""
    out: dict[int, float] = {}
    base = sets.t_pre.sum() / PRE
    if len(sets) == 0 or base <= 0:
        return out
    for e in [*range(-PRE, 0), *range(1, POST + 1)]:
        total = 0.0
        for j in range(len(sets)):
            i, t = int(sets.unit[j]), int(sets.half[j]) - sets.shift
            chosen = sets.controls[j][sets.controls[j] >= 0]
            total += counts[i, t + e] - sets.t_pre[j] / PRE
            total -= counts[chosen, t + e].mean() - sets.c_pre[j] / sets.n_controls[j] / PRE
        out[e] = float(100.0 * total / base)
    return out


def naive_before_after(sets: Sets) -> float | None:
    """The change at the cared for places alone, in percent: what a before and after comparison
    without comparison places would say. Shown only to explain why comparison places matter."""
    before = int(sets.t_pre.sum())
    return None if before == 0 else 100.0 * (int(sets.t_post.sum()) - before) / before
