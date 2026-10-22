"""The method of the "Did it work?" study: matched difference in differences on counts near places.

In plain words. Each place that got care in some half year is compared with up to five places that
did not get that care in the two years before or after, chosen from the same part of the city
(3 km or closer, but not so close that the two share the same surroundings), with a similar count
of the outcome in each of the two years before, and a similar share of neighbors in poverty. The
change at the cared for place (two years after against two years before) is compared with the
average change at its comparison places. Pooling every place gives the estimate; resampling whole
areas of the city (about 5 square kilometers each) gives a 90 percent interval.

Everything here is plain numpy, deterministic for a given seed, and tested on synthetic data where
the true effect is known (research/didit/synthetic.py, pipeline/tests/test_didit.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

#: Halves (six months each) before and after the half year of care that are compared. The half year
#: of care itself is skipped: the work happened some time in it.
PRE = 4
POST = 4
#: Comparison places per cared for place, at most (drawn with replacement across places).
K = 5
#: Comparison places lie within this distance of the cared for place (meters) ...
MAX_DISTANCE = 3000.0
#: ... and at least this far, so the two do not share the same counting circle.
MIN_DISTANCE = 400.0
#: The largest allowed difference in the square root of the count in each prior year.
COUNT_CALIPER = 0.5
#: The largest allowed difference in the tract poverty rate, in percentage points.
POVERTY_CALIPER = 5.0
#: The largest allowed difference in the log of the count in the wider area (a ring around the
#: counting circle) over the two years before: 0.2 is about 22 percent.
AREA_CALIPER = 0.2
#: Bootstrap draws for the intervals, and the interval's coverage.
DRAWS = 2000
LEVEL = 0.90


@dataclass
class Places:
    """Every place that may be cared for or compared, with what the matching needs.

    `care` is True where the place got this kind of care in that half year (dated records).
    `undated` marks places with a record of care whose date is unknown: they are never compared
    and never counted as cared for. `pool` marks places of the right kind that may be compared
    even if they never got care in the records (for example a vacant lot today).
    """

    x: np.ndarray  # meters, a projected coordinate system
    y: np.ndarray
    poverty: np.ndarray  # tract poverty rate in percent, NaN when unknown
    cluster: np.ndarray  # int: the area each place belongs to, for the bootstrap
    care: np.ndarray  # bool (n places, n halves)
    undated: np.ndarray  # bool (n places,)
    pool: np.ndarray  # bool (n places,)

    def __post_init__(self) -> None:
        n = len(self.x)
        assert self.care.shape[0] == n
        for name in ("y", "poverty", "cluster", "undated", "pool"):
            assert len(getattr(self, name)) == n, name


@dataclass
class Sets:
    """Matched sets: each cared for place with its comparison places, and its own counts.

    Counts are stored as integers: the cared for place's total before and after, and the sum
    over its comparison places of theirs (divide by `n_controls` for their average).
    """

    unit: np.ndarray  # index of the cared for place
    half: np.ndarray  # the half year of care
    cluster: np.ndarray
    n_controls: np.ndarray
    controls: np.ndarray  # (n sets, K), -1 where fewer than K
    t_pre: np.ndarray
    t_post: np.ndarray
    c_pre: np.ndarray  # sums over the comparison places
    c_post: np.ndarray
    dropped: int = 0  # cared for places with no comparison place close enough in every way
    eligible: int = 0  # cared for places with a full window before matching
    extra: dict = field(default_factory=dict)

    def __len__(self) -> int:
        return len(self.unit)


def half_index(year: np.ndarray, month: np.ndarray, first_year: int) -> np.ndarray:
    """Half years counted from January of `first_year`: 0 for its first half, 1 for its second."""
    return (np.asarray(year) - first_year) * 2 + (np.asarray(month) > 6)


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

    Returns an int32 array (n places, n halves, len(radii)): ring 0 counts events within radii[0],
    ring 1 those farther than radii[0] and within radii[1], and so on. Events outside 0 <= half <
    n_halves are ignored. Distances are straight lines in meters.
    """
    px = np.asarray(px, dtype=float)
    py = np.asarray(py, dtype=float)
    keep = (eh >= 0) & (eh < n_halves)
    ex, ey, eh = np.asarray(ex, float)[keep], np.asarray(ey, float)[keep], np.asarray(eh)[keep]
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
    starts: dict[int, tuple[int, int]] = {}
    uniq, first, counts = np.unique(keys, return_index=True, return_counts=True)
    for k, f, c in zip(uniq.tolist(), first.tolist(), counts.tolist(), strict=True):
        starts[k] = (f, f + c)
    pcx = np.floor(px / size).astype(np.int64)
    pcy = np.floor(py / size).astype(np.int64)
    pkeys = pcx * 1_000_003 + pcy
    for key in np.unique(pkeys).tolist():
        members = np.flatnonzero(pkeys == key)
        cx, cy = pcx[members[0]], pcy[members[0]]
        spans = [
            starts[k]
            for k in ((cx + dx) * 1_000_003 + (cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            if k in starts
        ]
        if not spans:
            continue
        idx = np.concatenate([np.arange(a, b) for a, b in spans])
        d2 = (px[members, None] - ex[None, idx]) ** 2 + (py[members, None] - ey[None, idx]) ** 2
        ring = np.searchsorted(r2, d2, side="left")  # 0 within radii[0], ... len(radii) outside
        rows, cols = np.nonzero(ring < len(radii))
        np.add.at(out, (members[rows], eh[idx[cols]], ring[rows, cols]), 1)
    return out


def _window_free(cum: np.ndarray, a: int, b: int) -> np.ndarray:
    """True where a place has no care from half `a` to half `b` inclusive (cum: cumulative care
    counts with a leading zero column)."""
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
    features: tuple[tuple[int, int], ...] = ((-4, -2), (-2, 0)),
    gap: int = 0,
    area: np.ndarray | None = None,
) -> Sets:
    """Build matched sets for one outcome.

    `counts` is (n places, n halves): the outcome near each place. Only halves `first_half` to
    `last_half` (inclusive) have complete outcome data. A place is cared for at half t when it got
    care at t and none in the PRE halves before. With `shift` > 0 the comparison is a placebo: it
    pretends care happened `shift` halves earlier than it did (the windows move back; the real
    care half and everything after stay out of it), which should find no effect.

    `controls_from`: "all" (places that did not get this care in the window: those that got it
    later, and those of the right kind that never did) or "later" (only places that got this care
    later, after the window).

    `features`: the spans of halves, counted back from the start of the gap before care, whose
    totals are matched on (by default the two years before, as two yearly totals). `gap`: halves
    right before care left out of the comparison altogether. `area`, when given, is the outcome in
    a wider area around each place (n places, n halves): its total over the two years before is
    matched too, which tells the place's lasting level better than its own few events.
    """
    n_places, n_halves = places.care.shape
    care = places.care.astype(np.int32)
    cum = np.concatenate([np.zeros((n_places, 1), np.int32), np.cumsum(care, axis=1)], axis=1)
    rows: dict[str, list] = {
        k_: []
        for k_ in ("unit", "half", "cluster", "n", "controls", "t_pre", "t_post", "c_pre", "c_post")
    }
    dropped = eligible = 0
    for t in range(n_halves):
        f = t - shift  # the half treated as the half of care
        lo, hi = f - gap - PRE, f + POST
        if lo < first_half or hi > last_half:
            continue
        # No care in the halves before t that the comparison uses (for a placebo, the whole
        # pretend window lies before the real care).
        treated = places.care[:, t] & _window_free(cum, lo, t - 1) & ~places.undated
        tidx = np.flatnonzero(treated)
        if len(tidx) == 0:
            continue
        free = _window_free(cum, lo, max(hi, t)) & ~places.undated
        later = (cum[:, n_halves] - cum[:, max(hi, t) + 1]) > 0
        if controls_from == "later":
            cand = free & later
        else:
            cand = free & (later | places.pool)
        cidx = np.flatnonzero(cand)
        eligible += len(tidx)
        if len(cidx) == 0:
            dropped += len(tidx)
            continue
        # Square roots of the totals before (by default the two yearly totals): the matching's
        # measure of level and trend.
        end = f - gap
        feats = np.stack(
            [np.sqrt(counts[:, end + a : end + b].sum(axis=1).astype(float)) for a, b in features],
            axis=1,
        )
        wide = None if area is None else np.log1p(area[:, lo : f - gap].sum(axis=1).astype(float))
        for i in tidx.tolist():
            dx = places.x[cidx] - places.x[i]
            dy = places.y[cidx] - places.y[i]
            dist = np.hypot(dx, dy)
            dfeat = feats[cidx] - feats[i]
            dp = places.poverty[cidx] - places.poverty[i]
            ok = (
                (dist >= MIN_DISTANCE)
                & (dist <= MAX_DISTANCE)
                & (np.abs(dfeat) <= COUNT_CALIPER).all(axis=1)
                & ~(np.abs(dp) > POVERTY_CALIPER)  # unknown poverty never blocks a match
            )
            if wide is not None:
                dw = wide[cidx] - wide[i]
                ok &= np.abs(dw) <= AREA_CALIPER
            if not ok.any():
                dropped += 1
                continue
            score = (
                (dfeat**2).sum(axis=1)
                + np.nan_to_num(dp / POVERTY_CALIPER) ** 2
                + (dist / MAX_DISTANCE) ** 2 * 0.25
            )
            if wide is not None:
                score = score + (dw / AREA_CALIPER) ** 2
            good = np.flatnonzero(ok)
            take = good[np.argsort(score[good], kind="stable")[:k]]
            chosen = cidx[take]
            row = np.full(k, -1, dtype=np.int64)
            row[: len(chosen)] = chosen
            pre_sl, post_sl = slice(lo, f - gap), slice(f + 1, hi + 1)
            rows["unit"].append(i)
            rows["half"].append(t)
            rows["cluster"].append(int(places.cluster[i]))
            rows["n"].append(len(chosen))
            rows["controls"].append(row)
            rows["t_pre"].append(int(counts[i, pre_sl].sum()))
            rows["t_post"].append(int(counts[i, post_sl].sum()))
            rows["c_pre"].append(int(counts[chosen, pre_sl].sum()))
            rows["c_post"].append(int(counts[chosen, post_sl].sum()))
    as_int = {k_: np.asarray(v, dtype=np.int64) for k_, v in rows.items() if k_ != "controls"}
    controls = np.vstack(rows["controls"]) if rows["controls"] else np.zeros((0, k), dtype=np.int64)
    return Sets(
        unit=as_int["unit"],
        half=as_int["half"],
        cluster=as_int["cluster"],
        n_controls=as_int["n"],
        controls=controls,
        t_pre=as_int["t_pre"],
        t_post=as_int["t_post"],
        c_pre=as_int["c_pre"],
        c_post=as_int["c_post"],
        dropped=dropped,
        eligible=eligible,
    )


def outcome_sums(sets: Sets, counts: np.ndarray, *, shift: int = 0) -> tuple[np.ndarray, ...]:
    """The same matched sets measured on another outcome (for example the ring around the
    counting circle): (t_pre, t_post, c_pre, c_post) as integer arrays."""
    t_pre, t_post, c_pre, c_post = (np.zeros(len(sets), dtype=np.int64) for _ in range(4))
    for j in range(len(sets)):
        f = int(sets.half[j]) - shift
        pre_sl, post_sl = slice(f - PRE, f), slice(f + 1, f + POST + 1)
        i = int(sets.unit[j])
        chosen = sets.controls[j][sets.controls[j] >= 0]
        t_pre[j] = counts[i, pre_sl].sum()
        t_post[j] = counts[i, post_sl].sum()
        c_pre[j] = counts[chosen, pre_sl].sum()
        c_post[j] = counts[chosen, post_sl].sum()
    return t_pre, t_post, c_pre, c_post


@dataclass
class Estimate:
    """What one comparison found."""

    sets: int  # cared for places compared
    controls: int  # distinct comparison places
    clusters: int  # areas they lie in
    dropped: int  # cared for places left out for want of a close comparison
    t_pre: int  # events near the cared for places in the two years before
    t_post: int  # ... and in the two years after
    expected: float  # events expected after, had they changed like their comparison places
    change: float  # t_post minus expected
    percent: float | None  # change as a percent of expected
    low: float | None  # the 90 percent interval of percent
    high: float | None
    per_place_year: float  # change per cared for place per year
    per_low: float | None
    per_high: float | None
    balance: float  # comparison places' average count before, as a share of the cared for places'

    def as_dict(self) -> dict:
        return {k: getattr(self, k) for k in self.__dataclass_fields__}


def _sums(t_pre, t_post, c_pre, c_post, n):
    """Totals over sets of the change and of the expected count after (additive counterfactual:
    each cared for place's count before plus its comparison places' average change)."""
    c_change = (c_post - c_pre) / n
    expected = t_pre + c_change
    change = t_post - expected
    return change, expected


def draws_index(n_clusters: int, draws: int, seed: int) -> np.ndarray:
    """Cluster indices for each bootstrap draw (draws, n_clusters), from the raw PCG64 stream,
    which numpy keeps stable across versions, so the intervals reproduce exactly."""
    raw = np.random.PCG64(seed).random_raw(draws * n_clusters)
    return (raw % np.uint64(n_clusters)).astype(np.int64).reshape(draws, n_clusters)


def estimate(
    t_pre: np.ndarray,
    t_post: np.ndarray,
    c_pre: np.ndarray,
    c_post: np.ndarray,
    n_controls: np.ndarray,
    cluster: np.ndarray,
    *,
    controls: np.ndarray | None = None,
    dropped: int = 0,
    draws: int = DRAWS,
    seed: int = 20261021,
    level: float = LEVEL,
) -> Estimate:
    """Pool matched sets into one estimate with a cluster bootstrap interval."""
    t_pre = np.asarray(t_pre, dtype=float)
    t_post = np.asarray(t_post, dtype=float)
    c_pre = np.asarray(c_pre, dtype=float)
    c_post = np.asarray(c_post, dtype=float)
    n = np.asarray(n_controls, dtype=float)
    years = POST / 2
    m = len(t_pre)
    distinct = len(np.unique(controls[controls >= 0])) if controls is not None else 0
    if m == 0:
        return Estimate(
            0, distinct, 0, dropped, 0, 0, 0.0, 0.0, None, None, None, 0.0, None, None, float("nan")
        )
    change, expected = _sums(t_pre, t_post, c_pre, c_post, n)
    total_change, total_expected = change.sum(), expected.sum()
    percent = 100.0 * total_change / total_expected if total_expected > 0 else None
    per = total_change / m / years
    balance = float((c_pre / n).sum() / t_pre.sum()) if t_pre.sum() > 0 else float("nan")
    labels, inverse = np.unique(np.asarray(cluster), return_inverse=True)
    g = len(labels)
    # Per cluster totals, so each draw is a weighted sum.
    ch_c = np.bincount(inverse, weights=change, minlength=g)
    ex_c = np.bincount(inverse, weights=expected, minlength=g)
    m_c = np.bincount(inverse, minlength=g).astype(float)
    low = high = per_low = per_high = None
    if g >= 2 and draws > 0:
        idx = draws_index(g, draws, seed)
        weights = np.zeros((draws, g))
        np.add.at(weights, (np.repeat(np.arange(draws), g), idx.ravel()), 1.0)
        b_change = weights @ ch_c
        b_expected = weights @ ex_c
        b_m = weights @ m_c
        alpha = (1 - level) / 2
        with np.errstate(divide="ignore", invalid="ignore"):
            b_pct = np.where(b_expected > 0, 100.0 * b_change / b_expected, np.nan)
        b_per = b_change / b_m / years
        if percent is not None and np.isfinite(b_pct).all():
            low, high = (float(v) for v in np.quantile(b_pct, [alpha, 1 - alpha]))
        per_low, per_high = (float(v) for v in np.quantile(b_per, [alpha, 1 - alpha]))
    return Estimate(
        sets=m,
        controls=distinct,
        clusters=g,
        dropped=dropped,
        t_pre=int(t_pre.sum()),
        t_post=int(t_post.sum()),
        expected=float(total_expected),
        change=float(total_change),
        percent=None if percent is None else float(percent),
        low=low,
        high=high,
        per_place_year=float(per),
        per_low=per_low,
        per_high=per_high,
        balance=balance,
    )


def estimate_sets(sets: Sets, **kwargs) -> Estimate:
    return estimate(
        sets.t_pre,
        sets.t_post,
        sets.c_pre,
        sets.c_post,
        sets.n_controls,
        sets.cluster,
        controls=sets.controls,
        dropped=sets.dropped,
        **kwargs,
    )


def event_study(sets: Sets, counts: np.ndarray) -> dict[int, float]:
    """The average difference at each half year from PRE before to POST after, measured from each
    place's own average before, as a percent of the cared for places' average per half before.
    The halves before are close to zero by construction (they were matched on); the halves after
    show how a change, if any, unfolds."""
    out: dict[int, float] = {}
    if len(sets) == 0:
        return out
    base = sets.t_pre.sum() / PRE
    for e in [*range(-PRE, 0), *range(1, POST + 1)]:
        diffs = []
        for j in range(len(sets)):
            i, t = int(sets.unit[j]), int(sets.half[j])
            chosen = sets.controls[j][sets.controls[j] >= 0]
            ti = counts[i, t + e] - sets.t_pre[j] / PRE
            ci = counts[chosen, t + e].mean() - sets.c_pre[j] / sets.n_controls[j] / PRE
            diffs.append(ti - ci)
        out[e] = float(100.0 * np.sum(diffs) / base) if base > 0 else float("nan")
    return out


def naive_before_after(sets: Sets) -> float | None:
    """The change at the cared for places alone, in percent: what a before and after comparison
    without comparison places would say. Shown only to explain why comparison places matter."""
    before = sets.t_pre.sum()
    return None if before == 0 else float(100.0 * (sets.t_post.sum() - before) / before)
