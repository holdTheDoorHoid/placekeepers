"""Did it work? (M5.4, issue #48): build the places, run every comparison, decide each plain
verdict, and write `data/didit/results.json` and `data/didit/totals.csv` (docs/CONTRACTS.md section
12). docs/DIDIT_METHOD.md explains the study; placekeepers.didit.method holds the arithmetic.

`pk didit` runs this yearly or on demand, never in the weekly refresh: its numbers change only
when someone runs it, and the two files it writes are committed, so every change to what the site
says about care is reviewed before it is published. The weekly publish copies the results into
`tables/didit.json` (placekeepers.publish.didit).

A place is a square of the city 100 meters across, so that two lots greened the same season on one
block count once, and so that a square can be a cared for place in one comparison and a comparison
place in another, measured the same way.

Kinds of care: PHS LandCare (the year and season each lot was cleaned and greened, where the
layer gives them), the City's clean and seal work orders, demolitions the City carried out, and
projects neighbors finished (from `tables/projects.json`). Outcomes: shootings within 200 meters,
Philly311 illegal dumping requests within 200 meters, and L&I complaints about vacant lots and
buildings within 200 meters. For dumping and complaints the place's own square is left out: a
report about the very lot that got care says little about the area around it, and such reports
are often what brought the care.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import h3
import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import shapely
from pyproj import Transformer
from shapely.strtree import STRtree

from placekeepers.didit import method as m

log = logging.getLogger(__name__)

FIRST_YEAR = 2015  # the City's shootings start in January 2015
CELL = 100.0  # meters across a place
RADIUS = 200.0  # the counting circle
RING = 400.0  # the ring around it, for crime moving elsewhere
CLUSTER_RES = 7  # H3 resolution of the bootstrap areas, about 5 square kilometers each
METRIC_CRS = "EPSG:32618"  # UTM zone 18 north, meters
#: Verdict rules, fixed with the method on 2026-10-21 before any real comparison was run.
MIN_PLACES = 100  # fewer cared for places compared than this: too few to tell
MIN_AREAS = 20  # or fewer areas than this
MIN_PLACEBO = 100  # the placebo check needs at least this many places to count

RESULTS_FILE = Path("data/didit/results.json")
TOTALS_FILE = Path("data/didit/totals.csv")

KINDS = ("landcare", "clean_seal", "demolition", "projects")
OUTCOMES = ("shootings", "dumping", "complaints")
#: Outcomes counted without the place's own square.
OWN_SQUARE_LEFT_OUT = {"shootings": False, "dumping": True, "complaints": True}
#: Places of the right kind that may be compared though no record shows them getting the care:
#: vacant parcels today (high or medium confidence, not in LandCare), by kind.
POOLS = {
    "landcare": ("lot",),
    "clean_seal": ("lot", "building"),
    "demolition": ("building",),
    "projects": ("lot",),
}
#: The sources each part reads (registry ids), for the build notes and pk didit's checks.
SOURCES = {
    "landcare": "phs_landcare",
    "clean_seal": "li_clean_and_seal",
    "demolition": "li_demolitions",
    "shootings": "shootings",
    "dumping": "philly311_dumping_history",
    "complaints": "li_complaints_history",
    "tracts": "census_tracts_2020",
    "poverty": "acs_poverty",
}
#: Clean and seal work orders that were done (the other statuses are cancelled, waived, denied or
#: still open).
DONE = ("APPROVED", "CLOSED", "WORK COMPLETE")

_TO_M = Transformer.from_crs("EPSG:4326", METRIC_CRS, always_xy=True)
_TO_LL = Transformer.from_crs(METRIC_CRS, "EPSG:4326", always_xy=True)


def complaint_counts(kind: str | None) -> bool:
    """Complaints about vacant lots and vacant buildings, under the names used before and after
    the City's new system of 2020; an inspection program's name is left out."""
    if not kind:
        return False
    name = kind.upper()
    return "VACANT" in name and name != "VACANT STRATEGY INSPECTIONS"


def half_of(days: np.ndarray) -> np.ndarray:
    """Half years since January of FIRST_YEAR (0 is its first half) for datetime64 days."""
    days = np.asarray(days, dtype="datetime64[D]")
    years = days.astype("datetime64[Y]").astype(int) + 1970
    months = days.astype("datetime64[M]").astype(int) % 12 + 1
    return (years - FIRST_YEAR) * 2 + (months > 6)


def half_label(half: int) -> str:
    """'2017-1' for the first half of 2017, '2017-2' for the second."""
    return f"{FIRST_YEAR + half // 2}-{half % 2 + 1}"


def half_start(half: int) -> date:
    return date(FIRST_YEAR + half // 2, 1 if half % 2 == 0 else 7, 1)


def first_full_half(first_day: date | None, n_halves: int) -> int:
    """The first half year an outcome covers in full: the half of its first record when that
    record falls in the half's first week (the City's complaints start on January 2, 2015, after
    the holiday), else the next half (its dumping requests start on January 10, 2016)."""
    if first_day is None:
        return n_halves
    half = int(half_of(np.asarray([first_day], dtype="datetime64[D]"))[0])
    return half if (first_day - half_start(half)).days < 7 else half + 1


def half_end(half: int) -> date:
    year = FIRST_YEAR + half // 2
    return date(year, 6, 30) if half % 2 == 0 else date(year, 12, 31)


def to_meters(lng, lat) -> tuple[np.ndarray, np.ndarray]:
    x, y = _TO_M.transform(np.asarray(lng, dtype=float), np.asarray(lat, dtype=float))
    return np.asarray(x), np.asarray(y)


# Reading the inputs


@dataclass
class Care:
    """Records of one kind of care: where (meters) and when (half year, -9 when undated)."""

    x: np.ndarray
    y: np.ndarray
    half: np.ndarray
    dated: np.ndarray
    summary: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def empty(cls, **summary: Any) -> Care:
        z = np.zeros(0)
        return cls(z, z, z.astype(int), z.astype(bool), dict(summary))


@dataclass
class Events:
    x: np.ndarray
    y: np.ndarray
    half: np.ndarray
    first_day: date | None
    last_day: date | None


def _days(column) -> np.ndarray:
    return np.asarray(column.to_numpy(zero_copy_only=False), dtype="datetime64[D]")


def _centroids(wkb: list) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    geoms = shapely.from_wkb(np.asarray(wkb, dtype=object))
    ok = ~shapely.is_missing(geoms) & ~shapely.is_empty(geoms)
    pts = shapely.centroid(geoms[ok])
    return shapely.get_x(pts), shapely.get_y(pts), ok


def read_landcare(path: Path) -> Care:
    """PHS LandCare: the year and season each lot was cleaned and greened ("stabilized"), where the
    layer gives both. Lots stabilized in spring count in the first half of the year, in fall in the
    second; any other season, or a year alone, counts as undated."""
    t = pq.read_table(path, columns=["year", "season", "program", "geometry"])
    lng, lat, ok = _centroids(t.column("geometry").to_pylist())
    years = [str(v).strip() if v is not None else "" for v in t.column("year").to_pylist()]
    seasons = [
        str(v).strip().strip("'").lower() if v is not None else ""
        for v in t.column("season").to_pylist()
    ]
    programs = [v or "" for v in t.column("program").to_pylist()]
    year = np.asarray([int(v) if v.isdigit() else -1 for v in years])[ok]
    season = np.asarray(seasons, dtype=object)[ok]
    program = np.asarray(programs, dtype=object)[ok]
    spring, fall = season == "spring", season == "fall"
    dated = (year >= 1990) & (spring | fall)
    half = np.full(len(year), -9, dtype=int)
    half[dated] = (year[dated] - FIRST_YEAR) * 2 + fall[dated].astype(int)
    x, y = to_meters(lng, lat)
    summary = {
        "records": int(len(year)),
        "dated": int(dated.sum()),
        "undated": int((~dated).sum()),
        "by_program": {
            p: {"records": int((program == p).sum()), "dated": int(((program == p) & dated).sum())}
            for p in sorted(set(program.tolist()))
        },
    }
    return Care(x, y, half, dated, summary)


def read_clean_seal(path: Path) -> Care:
    """The City's clean and seal work orders that were done, by the day the work order (or else
    the case) was completed."""
    t = pq.read_table(
        path,
        columns=["workorderstatus", "workordercompleteddate", "casecompleteddate", "lat", "lng"],
    )
    status = pc.utf8_upper(pc.fill_null(t.column("workorderstatus"), ""))
    day = pc.coalesce(t.column("workordercompleteddate"), t.column("casecompleteddate"))
    keep = pc.and_(
        pc.and_(pc.is_in(status, value_set=pa.array(DONE)), pc.is_valid(day)),
        pc.is_valid(t.column("lat")),
    )
    t = t.filter(keep)
    day = pc.coalesce(t.column("workordercompleteddate"), t.column("casecompleteddate"))
    return _dated_points(t.column("lng"), t.column("lat"), _days(day))


def read_demolitions(path: Path) -> Care:
    """Demolitions the City carried out (city_demo YES), completed, by the day completed. Tank
    removals are left out, as in the vacancy model."""
    t = pq.read_table(
        path, columns=["city_demo", "status", "typeofwork", "completed_date", "lat", "lng"]
    )
    rows = t.to_pylist()
    keep = [
        r
        for r in rows
        if r["city_demo"] == "YES"
        and (r["status"] or "").upper() == "COMPLETED"
        and r["typeofwork"] != "TANKRI"
        and r["lat"] is not None
        and r["completed_date"] is not None
        and r["completed_date"].year <= 2100
    ]
    return _dated_points(
        [r["lng"] for r in keep],
        [r["lat"] for r in keep],
        np.asarray([r["completed_date"] for r in keep], dtype="datetime64[D]"),
    )


def read_projects(path: Path | None) -> Care:
    """Projects neighbors finished (tables/projects.json, docs/CONTRACTS.md section 11), by the
    month each was finished."""
    if path is None or not Path(path).is_file():
        return Care.empty(read=False, records=0, dated=0, undated=0)
    rows = json.loads(Path(path).read_text(encoding="utf-8")).get("projects", [])
    keep = [r for r in rows if r.get("finished") and r.get("lat") is not None]
    days = np.asarray([f"{r['finished']}-01" for r in keep], dtype="datetime64[D]")
    care = _dated_points([r["lng"] for r in keep], [r["lat"] for r in keep], days)
    care.summary.update(read=True, records=len(rows))
    return care


def _dated_points(lng, lat, days: np.ndarray) -> Care:
    lng = np.asarray(lng.to_numpy() if hasattr(lng, "to_numpy") else lng, dtype=float)
    lat = np.asarray(lat.to_numpy() if hasattr(lat, "to_numpy") else lat, dtype=float)
    x, y = to_meters(lng, lat)
    years = days.astype("datetime64[Y]").astype(int) + 1970 if len(days) else np.zeros(0, int)
    summary = {
        "records": int(len(days)),
        "dated": int(len(days)),
        "undated": 0,
        "by_year": {int(v): int((years == v).sum()) for v in sorted(set(years.tolist()))},
    }
    return Care(x, y, half_of(days), np.ones(len(days), dtype=bool), summary)


def read_events(path: Path, day_column: str, kind_column: str | None = None) -> Events:
    columns = [day_column, "lat", "lng"] + ([kind_column] if kind_column else [])
    t = pq.read_table(path, columns=columns)
    keep = pc.and_(pc.is_valid(t.column(day_column)), pc.is_valid(t.column("lat")))
    t = t.filter(keep)
    if kind_column:
        wanted = [complaint_counts(v) for v in t.column(kind_column).to_pylist()]
        t = t.filter(pa.array(wanted, type=pa.bool_()))
    days = _days(t.column(day_column))
    x, y = to_meters(t.column("lng").to_numpy(), t.column("lat").to_numpy())
    first = days.min().astype(date) if len(days) else None
    last = days.max().astype(date) if len(days) else None
    return Events(x, y, half_of(days), first, last)


def read_pool(vacancy: Path, kinds: tuple[str, ...]) -> tuple[np.ndarray, np.ndarray]:
    """Vacant parcels today of the given kinds (high or medium confidence), not in LandCare."""
    t = pq.read_table(vacancy, columns=["kind", "confidence", "in_landcare", "geometry"])
    rows = t.select(["kind", "confidence", "in_landcare"]).to_pylist()
    wanted = [
        r["kind"] in kinds and r["confidence"] in ("high", "medium") and not r["in_landcare"]
        for r in rows
    ]
    geoms = np.asarray(t.column("geometry").to_pylist(), dtype=object)[np.asarray(wanted, bool)]
    lng, lat, _ = _centroids(list(geoms))
    return to_meters(lng, lat)


def tract_poverty(
    tracts: Path, poverty: Path, lng: np.ndarray, lat: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """The poverty rate of the census tract around each point (NaN when unknown), and whether the
    point lies in a tract of the city at all."""
    tt = pq.read_table(tracts, columns=["geoid", "geometry"])
    shapes = shapely.from_wkb(np.asarray(tt.column("geometry").to_pylist(), dtype=object))
    geoids = tt.column("geoid").to_pylist()
    pt = pq.read_table(poverty, columns=["geoid", "poverty_pct"]).to_pylist()
    rate = {r["geoid"]: r["poverty_pct"] for r in pt}
    points = shapely.points(lng, lat)
    tree = STRtree(shapes)
    hits = tree.query(points, predicate="within")
    out = np.full(len(lng), np.nan)
    inside = np.zeros(len(lng), dtype=bool)
    for p, s in zip(hits[0].tolist(), hits[1].tolist(), strict=True):
        inside[p] = True
        value = rate.get(geoids[s])
        if value is not None:
            out[p] = float(value)
    return out, inside


# The study


@dataclass
class Inputs:
    """Where everything comes from: snapshot paths by part (SOURCES), the vacancy model's output,
    and the projects table (or None)."""

    paths: dict[str, Path]
    vacancy: Path
    projects: Path | None = None


@dataclass
class Study:
    places: dict[str, m.Places]  # by kind
    outcomes: dict[str, dict[str, np.ndarray]]  # by kind, then "<outcome>" and "<outcome>_ring"
    first_half: dict[str, int]  # the first complete half of each outcome
    last_half: int  # the last half every outcome covers in full
    care: dict[str, dict[str, Any]]  # summaries by kind
    events: dict[str, dict[str, Any]]  # summaries by outcome
    n_places: int = 0


def cell_of(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return np.floor(x / CELL).astype(np.int64) * 1_000_000 + np.floor(y / CELL).astype(np.int64)


def build(inputs: Inputs) -> Study:
    p = inputs.paths
    care = {
        "landcare": read_landcare(p["landcare"]),
        "clean_seal": read_clean_seal(p["clean_seal"]),
        "demolition": read_demolitions(p["demolition"]),
        "projects": read_projects(inputs.projects),
    }
    events = {
        "shootings": read_events(p["shootings"], "date_"),
        "dumping": read_events(p["dumping"], "requested"),
        "complaints": read_events(p["complaints"], "complaintdate", "complaintcodename"),
    }
    pool_xy = {kinds: read_pool(inputs.vacancy, kinds) for kinds in set(POOLS.values())}
    pools = {kind: cell_of(*pool_xy[kinds]) for kind, kinds in POOLS.items()}
    cells = np.unique(
        np.concatenate([cell_of(c.x, c.y) for c in care.values()] + list(pools.values()))
    )
    n = len(cells)
    cx = (cells // 1_000_000 + 0.5) * CELL
    cy = (cells % 1_000_000 + 0.5) * CELL
    lng, lat = _TO_LL.transform(cx, cy)
    lng, lat = np.asarray(lng), np.asarray(lat)
    poverty, in_city = tract_poverty(p["tracts"], p["poverty"], lng, lat)
    labels = np.asarray(
        [h3.latlng_to_cell(a, b, CLUSTER_RES) for a, b in zip(lat, lng, strict=True)]
    )
    _, cluster = np.unique(labels, return_inverse=True)

    # Half years from 2015 through the newest record of anything read.
    last_days = [e.last_day for e in events.values() if e.last_day is not None]
    newest = max([*last_days, date(FIRST_YEAR, 1, 1)])
    n_halves = int(half_of(np.asarray([newest], dtype="datetime64[D]"))[0]) + 1
    # The last half every outcome covers in full, and each outcome's first full half.
    oldest_last = min(last_days) if last_days else date(FIRST_YEAR, 1, 1)
    last_half = int(half_of(np.asarray([oldest_last + timedelta(days=1)], "datetime64[D]"))[0]) - 1
    first_half = {name: first_full_half(e.first_day, n_halves) for name, e in events.items()}

    counts = {}
    for name, e in events.items():
        c = m.count_near(cx, cy, e.x, e.y, e.half, n_halves, (RADIUS, RING))
        near = c[:, :, 0].astype(np.int64)
        if OWN_SQUARE_LEFT_OUT[name]:
            own = np.zeros((n, n_halves), dtype=np.int64)
            ecell = cell_of(e.x, e.y)
            hit = np.isin(ecell, cells) & (e.half >= 0) & (e.half < n_halves)
            np.add.at(own, (np.searchsorted(cells, ecell[hit]), e.half[hit]), 1)
            near = near - own
        counts[name] = near
        counts[f"{name}_ring"] = c[:, :, 1].astype(np.int64)

    places: dict[str, m.Places] = {}
    outcomes: dict[str, dict[str, np.ndarray]] = {}
    summaries: dict[str, dict[str, Any]] = {}
    for kind, c in care.items():
        rows = np.searchsorted(cells, cell_of(c.x, c.y))
        dated = c.dated & (c.half >= 0) & (c.half < n_halves)
        on = np.zeros((n, n_halves), dtype=bool)
        on[rows[dated], c.half[dated]] = True
        undated = np.zeros(n, dtype=bool)
        undated[rows[~c.dated]] = True
        pool = np.zeros(n, dtype=bool)
        pool[np.searchsorted(cells, pools[kind])] = True
        relevant = on.any(axis=1) | undated | pool
        relevant[rows] = True  # care before 2015 too: such places may still be compared
        keep = np.flatnonzero(relevant & in_city)
        places[kind] = m.Places(
            x=cx[keep],
            y=cy[keep],
            poverty=poverty[keep],
            cluster=cluster[keep].astype(np.int64),
            care=on[keep],
            undated=undated[keep],
            pool=pool[keep],
        )
        outcomes[kind] = {name: values[keep] for name, values in counts.items()}
        summaries[kind] = {
            **c.summary,
            "places_with_care": int(on[keep].any(axis=1).sum()),
            "places_with_undated_care": int(undated[keep].sum()),
        }
    return Study(
        places=places,
        outcomes=outcomes,
        first_half=first_half,
        last_half=last_half,
        care=summaries,
        events={
            name: {
                "records": int(len(e.x)),
                "first": e.first_day.isoformat() if e.first_day else None,
                "last": e.last_day.isoformat() if e.last_day else None,
            }
            for name, e in events.items()
        },
        n_places=n,
    )


def _rounded(est: m.Estimate) -> dict[str, Any]:
    def r(v, digits):
        return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(v, digits)

    return {
        "places": est.places,
        "areas": est.areas,
        "before": est.t_pre,
        "after": est.t_post,
        "expected": r(est.expected, 1),
        "percent": r(est.percent, 1),
        "low": r(est.low, 1),
        "high": r(est.high, 1),
        "per_place_year": r(est.per_place_year, 3),
        "per_low": r(est.per_low, 3),
        "per_high": r(est.per_high, 3),
        "balance": r(est.balance, 3),
    }


def direction(est: dict[str, Any]) -> str:
    """'fewer' or 'more' when the 90 percent interval lies wholly on one side of zero, else
    'no_clear_change' (also when there is no interval)."""
    low, high = est.get("low"), est.get("high")
    if low is None or high is None:
        return "no_clear_change"
    if high < 0:
        return "fewer"
    if low > 0:
        return "more"
    return "no_clear_change"


def verdict(main: dict[str, Any], placebo: dict[str, Any]) -> tuple[str, str]:
    """The plain verdict and the state of the placebo check (rules fixed on 2026-10-21 before the
    real comparisons were run; docs/DIDIT_METHOD.md):

    * too_few: fewer than MIN_PLACES cared for places compared, or fewer than MIN_AREAS areas;
    * check_failed: the placebo compared at least MIN_PLACEBO places and its interval does not
      hold zero, so the places were already changing differently before care;
    * fewer, more or no_clear_change: by where the main interval lies.

    The check is "passed", "failed" or "too_few" (too few places to run it).
    """
    if placebo["places"] < MIN_PLACEBO or placebo["low"] is None:
        check = "too_few"
    else:
        check = "failed" if direction(placebo) != "no_clear_change" else "passed"
    if main["places"] < MIN_PLACES or main["areas"] < MIN_AREAS or main["percent"] is None:
        return "too_few", check
    if check == "failed":
        return "check_failed", check
    return direction(main), check


@dataclass
class Output:
    results: dict[str, Any]
    totals: list[dict[str, Any]]
    #: research only: the event study of each comparison (not published)
    event_study: dict[str, dict[int, float]] = field(default_factory=dict)


def _anonymous_rows(kind: str, outcome: str, comparison: str, tot: m.Totals) -> list[dict]:
    # Areas are numbered 0, 1, 2 ... in the order of their labels, which is the order the
    # estimate uses, so the published rows reproduce every number without naming any area.
    return [
        {
            "kind": kind,
            "outcome": outcome,
            "comparison": comparison,
            "area": i,
            "places": int(tot.places[i]),
            "t_pre": int(tot.t_pre[i]),
            "t_post": int(tot.t_post[i]),
            "c_pre": int(tot.c_pre[i]),
            "c_post": int(tot.c_post[i]),
        }
        for i in range(len(tot))
    ]


def compare(study: Study, kind: str, outcome: str, *, draws: int, seed: int):
    places = study.places[kind]
    near = study.outcomes[kind][outcome]
    ring = study.outcomes[kind][f"{outcome}_ring"]
    first, last = study.first_half[outcome], study.last_half
    sets = m.match(places, near, first, last)
    later = m.match(places, near, first, last, controls_from="later")
    placebo = m.match(places, near, first, last, shift=m.PLACEBO_SHIFT)
    tots = {
        "main": m.totals(sets),
        "around": m.totals(m.remeasure(sets, ring)),
        "later": m.totals(later),
        "placebo": m.totals(placebo),
    }
    est = {name: _rounded(m.estimate(t, draws=draws, seed=seed)) for name, t in tots.items()}
    found, check = verdict(est["main"], est["placebo"])
    naive = m.naive_before_after(sets)
    halves = sorted(set(sets.half.tolist()))
    entry = {
        "outcome": outcome,
        "verdict": found,
        "check": check,
        "around_verdict": direction(est["around"]) if est["around"]["places"] else None,
        "cohorts": [half_label(halves[0]), half_label(halves[-1])] if halves else None,
        "eligible": int(sets.eligible),
        "dropped": int(sets.dropped),
        "controls": int(len(np.unique(sets.controls[sets.controls >= 0]))),
        **est,
        "naive": None if naive is None else round(naive, 1),
    }
    rows = [r for name, t in tots.items() for r in _anonymous_rows(kind, outcome, name, t)]
    return entry, rows, m.event_study(sets, near)


def run(study: Study, *, generated: date, draws: int = m.DRAWS, seed: int = m.SEED) -> Output:
    kinds, rows, events = [], [], {}
    for kind in KINDS:
        results = []
        for outcome in OUTCOMES:
            entry, found, ev = compare(study, kind, outcome, draws=draws, seed=seed)
            results.append(entry)
            rows.extend(found)
            events[f"{kind}/{outcome}"] = ev
            log.info(
                "didit: %s and %s: %s (%s places, %s%% from %s to %s; check %s)",
                kind,
                outcome,
                entry["verdict"],
                entry["main"]["places"],
                entry["main"]["percent"],
                entry["main"]["low"],
                entry["main"]["high"],
                entry["check"],
            )
        kinds.append({"id": kind, **study.care[kind], "results": results})
    results = {
        "schema": 1,
        "generated": generated.isoformat(),
        "data_through": half_end(study.last_half).isoformat(),
        "method": {
            "years_before": m.PRE // 2,
            "years_after": m.POST // 2,
            "radius_m": int(RADIUS),
            "ring_m": int(RING),
            "place_m": int(CELL),
            "max_distance_m": int(m.MAX_DISTANCE),
            "min_distance_m": int(m.MIN_DISTANCE),
            "comparison_places": m.K,
            "count_caliper": m.COUNT_CALIPER,
            "poverty_caliper": m.POVERTY_CALIPER,
            "level": m.LEVEL,
            "draws": draws,
            "seed": seed,
            "scale": m.SCALE,
            "placebo_shift_halves": m.PLACEBO_SHIFT,
        },
        "rules": {"min_places": MIN_PLACES, "min_areas": MIN_AREAS, "min_placebo": MIN_PLACEBO},
        "outcomes": {
            name: {
                **study.events[name],
                "first_half": half_label(study.first_half[name]),
                "own_square_left_out": OWN_SQUARE_LEFT_OUT[name],
            }
            for name in OUTCOMES
        },
        "kinds": kinds,
    }
    return Output(results=results, totals=rows, event_study=events)


TOTALS_COLUMNS = (
    "kind",
    "outcome",
    "comparison",
    "area",
    "places",
    "t_pre",
    "t_post",
    "c_pre",
    "c_post",
)


def totals_csv(rows: list[dict[str, Any]]) -> str:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(TOTALS_COLUMNS), lineterminator="\n")
    w.writeheader()
    for row in rows:
        w.writerow(row)
    return buf.getvalue()


def read_totals(text: str) -> dict[tuple[str, str, str], m.Totals]:
    """The per area totals of every comparison, as `totals_csv` wrote them."""
    grouped: dict[tuple[str, str, str], list[dict[str, str]]] = {}
    for row in csv.DictReader(io.StringIO(text)):
        grouped.setdefault((row["kind"], row["outcome"], row["comparison"]), []).append(row)
    out = {}
    for key, rows in grouped.items():
        rows.sort(key=lambda r: int(r["area"]))

        def col(name: str, rows=rows) -> np.ndarray:
            return np.asarray([int(r[name]) for r in rows], dtype=np.int64)

        out[key] = m.Totals(
            cluster=col("area"),
            places=col("places"),
            t_pre=col("t_pre"),
            t_post=col("t_post"),
            c_pre=col("c_pre"),
            c_post=col("c_post"),
        )
    return out


def reproduce(results: dict[str, Any], totals_text: str) -> list[str]:
    """Recompute every published estimate from the per area totals; return the differences
    (none when the published numbers are exactly what the totals give)."""
    tot = read_totals(totals_text)
    method = results["method"]
    problems = []
    for kind in results["kinds"]:
        for entry in kind["results"]:
            for comparison in ("main", "around", "later", "placebo"):
                key = (kind["id"], entry["outcome"], comparison)
                t = tot.get(key) or m.Totals(*(np.zeros(0, dtype=np.int64) for _ in range(6)))
                again = _rounded(m.estimate(t, draws=method["draws"], seed=method["seed"]))
                if again != entry[comparison]:
                    problems.append(
                        f"{'/'.join(key)}: published {entry[comparison]}, again {again}"
                    )
            found, check = verdict(entry["main"], entry["placebo"])
            if (found, check) != (entry["verdict"], entry["check"]):
                problems.append(f"{kind['id']}/{entry['outcome']}: verdict {found}, {check}")
    return problems


def write(out: Output, repo_root: Path) -> tuple[Path, Path]:
    from placekeepers.cache import atomic_write_bytes, atomic_write_json

    results_path = repo_root / RESULTS_FILE
    totals_path = repo_root / TOTALS_FILE
    atomic_write_json(results_path, out.results)
    atomic_write_bytes(totals_path, totals_csv(out.totals).encode("utf-8"))
    return results_path, totals_path
