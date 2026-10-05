"""Walkability and people (milestone M3.3): what lies within a short walk of a place.

Four measures, for any point: each parcel on the map (its point on its shape, as for the other
lenses) and the middle of each area cell (H3 resolution 9, about two blocks across; the cells
layer, placekeepers.publish.walk). Distances are straight lines, measured in meters in UTM zone
18 north, never along the streets: about 80 meters a minute, a 5 minute walk is counted as 400
meters and a 10 minute walk as 800. A straight line reaches a little farther than a walk along a
grid of streets (on a grid the walk is about a quarter longer), and it crosses rail lines,
expressways and rivers that people on foot cannot. Routing along the streets was left out: the
City's centerlines miss most paths through parks, and a citywide route for every parcel would
cost far more than these few straight line counts.

* **People within a 5 minute walk** (`people`): the 2020 census population of the blocks whose
  internal point (a point inside the block, `census_blocks_2020`) lies within 400 meters.
  Philadelphia's blocks are small (half of them under a hectare, about 100 by 100 meters), so
  counting each block by one point moves few people across the line.
* **Everyday places within a 10 minute walk** (`kinds`, `kind_bits`, `places`): which of seven
  kinds of everyday places lie within 800 meters (PLACE_KINDS): a Free Library location, a
  recreation center (Parks and Recreation's recreation, older adult and environmental education
  centers), a pool or sprayground in service this year, a drinking fountain or bottle filler in a
  park, a school (the City's list: public, charter and private), a grocery store or market that
  takes SNAP (USDA; supermarkets, super stores, grocery stores, specialty food stores and farmers
  markets, not convenience stores), and a SEPTA bus, trolley, subway or train stop with service.
  `places` counts the places of each kind, up to KIND_CAP of a kind, so a street with five bus
  stops does not outweigh a library.
* **Street corners within a 5 minute walk** (`corners`): intersections within 400 meters, from
  the City's street centerlines: points where three or more segments of streets people can walk
  on meet (arterials, collectors, local streets and walking connectors; not expressways, ramps or
  driveways). More corners means shorter blocks and more ways to get somewhere on foot.
* **Walkability** (`walk_index`): the EPA's National Walkability Index (1 to 20) of the census
  block group the point lies in (`epa_walkability`).

The factor fields for the placemaking lens (M3.4; docs/CONTRACTS.md section 4), each an integer
from 0 to 100 ranked among the parcels on the map (or among the cells, for the cells layer), as
the share of places with a strictly lower value, so more ranks higher:

* `f_walk`: the walkability index of the block group;
* `f_neighbors`: people within a 5 minute walk;
* `f_dest`: kinds of everyday places within a 10 minute walk, ties broken by `places`;
* `f_corners`: street corners within a 5 minute walk.

A factor whose source is missing is left out of every place, as for every lens. A kind of place
whose source is missing is not counted, and the build notes say so.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely import STRtree

from placekeepers.cache import atomic_output, atomic_write_json
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.lenses import current_snapshot, rank_or_none, spread, tracts_of
from placekeepers.derive.street_safety import to_meters

log = logging.getLogger(__name__)

#: A 5 minute and a 10 minute walk, in meters in a straight line (about 80 meters a minute).
WALK_5_MIN_M = 400.0
WALK_10_MIN_M = 800.0
#: At most this many places of one kind count toward `places`.
KIND_CAP = 5

#: Each kind of everyday place, its bit in `kind_bits` (and `dk` on the map), and the sources
#: that list it, in the order the map lists them (docs/CONTRACTS.md section 4).
PLACE_KINDS: tuple[tuple[str, int, tuple[str, ...]], ...] = (
    ("library", 1, ("library_locations",)),
    ("recreation", 2, ("ppr_program_sites",)),
    ("pool", 4, ("ppr_swimming_pools", "ppr_spraygrounds")),
    ("water", 8, ("ppr_hydration_stations",)),
    ("school", 16, ("schools",)),
    ("food", 32, ("snap_retailers",)),
    ("transit", 64, ("septa_gtfs",)),
)
KIND_BITS = {kind: bit for kind, bit, _ in PLACE_KINDS}

#: Parks and Recreation's program sites that are recreation centers (the pools among them are
#: counted with the pools; publish.city_places keeps the same three).
RECREATION_TYPES = frozenset({"PPR_REC", "OLDER_ADULT_CENTER", "ENVIRONMENTAL_EDUCATION_CENTER"})
#: A pool or sprayground the City lists as not in service this year is not counted.
NOT_IN_SERVICE = "INACTIVE"
#: The USDA's kinds of SNAP store that are grocery stores or markets. Convenience stores and
#: "Other" (pharmacies, dollar stores and the like) are left out.
FOOD_STORE_TYPES = frozenset(
    {"Supermarket", "Super Store", "Grocery Store", "Specialty Store", "Farmers and Markets"}
)
#: The City's street classes people can walk along: major and minor arterials, collectors, local
#: streets and walking connectors (not expressways 1, driveways 6, ramps 9 and 10, or segments
#: that cannot be traveled, 12, 13, 14 and 18).
WALK_CLASSES = frozenset({2, 3, 4, 5, 15})
#: A corner is where at least this many such segments meet.
CORNER_LEGS = 3

#: The sources each measure reads. Without one, its measure is left out.
FEEDS = {
    "census_blocks_2020": "f_neighbors",
    "street_centerlines": "f_corners",
    "epa_walkability": "f_walk",
}
PLACE_SOURCES = tuple(dict.fromkeys(s for _, _, sources in PLACE_KINDS for s in sources))
#: Every source this step reads (credited on the lots tiles and the cells layer).
SOURCES = (*FEEDS, *PLACE_SOURCES)
FACTORS = ("f_walk", "f_neighbors", "f_dest", "f_corners")
#: The factors the lots tiles carry. Street corners are part of the EPA's index already, so on
#: the lots they would mostly repeat `f_walk` while making the tiles heavier (each factor adds
#: about 4 percent to tiles/lots.pmtiles); they stay in walk_factors.parquet and on the cells.
PARCEL_FACTORS = ("f_walk", "f_neighbors", "f_dest")


@dataclass
class WalkResult:
    path: Path
    as_of: str
    parcels: int
    spread: dict[str, Any]
    kinds_found: dict[str, int]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "walk_factors.parquet"


# ---------------------------------------------------------------------------------------------
# Small pieces, each tested on its own


def count_within(
    points_m: np.ndarray,
    targets_m: np.ndarray,
    radius: float,
    weights: Sequence[float] | None = None,
    chunk: int = 20_000,
) -> np.ndarray:
    """For each point (in meters), how many targets lie within `radius` (or the sum of their
    weights), in chunks so the pairs never fill the memory."""
    totals = np.zeros(len(points_m))
    if len(points_m) == 0 or len(targets_m) == 0:
        return totals
    tree = STRtree(targets_m)
    w = None if weights is None else np.asarray(weights, dtype=float)
    for start in range(0, len(points_m), chunk):
        part = points_m[start : start + chunk]
        near, target = tree.query(part, predicate="dwithin", distance=radius)
        counted = np.bincount(near, weights=None if w is None else w[target], minlength=len(part))
        totals[start : start + len(part)] += counted
    return totals


def destination_value(kinds: int, places: int) -> int:
    """What `f_dest` ranks: the kinds of everyday places first, then how many (up to KIND_CAP of
    a kind, so at most 35, which never reaches the next kind)."""
    return kinds * 100 + places


def corner_points(table: pa.Table) -> np.ndarray:
    """The street corners in longitude and latitude (module docstring): the ends of the walkable
    segments where CORNER_LEGS or more of them meet, by the City's node ids."""
    legs: dict[int, set[int]] = {}
    where: dict[int, tuple[float, float]] = {}
    columns = (table.column(name).to_pylist() for name in ("seg_id", "class", "fnode_", "tnode_"))
    shapes = table.column("geometry").to_pylist()
    for (seg_id, klass, start, end), wkb in zip(zip(*columns, strict=True), shapes, strict=True):
        if klass not in WALK_CLASSES or wkb is None or start is None or end is None:
            continue
        line = shapely.from_wkb(wkb)
        if line.is_empty:
            continue
        parts = list(line.geoms) if line.geom_type == "MultiLineString" else [line]
        first, last = parts[0].coords[0], parts[-1].coords[-1]
        for node, point in ((start, first), (end, last)):
            legs.setdefault(node, set()).add(seg_id)
            where.setdefault(node, (point[0], point[1]))
    corners = [where[node] for node, segments in legs.items() if len(segments) >= CORNER_LEGS]
    if not corners:
        return np.array([], dtype=object)
    return shapely.points([c[0] for c in corners], [c[1] for c in corners])


def _points(path: Path, keep=None) -> np.ndarray:
    """The points of a snapshot (a point on each shape), optionally only the rows `keep` likes."""
    table = pq.read_table(path)
    rows = table.to_pylist()
    shapes = []
    for row in rows:
        if keep is not None and not keep(row):
            continue
        wkb = row.get("geometry")
        if wkb is None:
            continue
        shape = shapely.from_wkb(wkb)
        if shape.is_empty:
            continue
        shapes.append(shape if shape.geom_type == "Point" else shape.representative_point())
    return np.array(shapes, dtype=object)


def place_points(kind: str, paths: dict[str, Path]) -> np.ndarray | None:
    """The places of one kind in longitude and latitude, or None when no source of it has a
    snapshot (module docstring)."""
    sources = next(s for k, _, s in PLACE_KINDS if k == kind)
    present = [s for s in sources if paths.get(s) is not None]
    if not present:
        return None
    found: list[np.ndarray] = []
    for source in present:
        path = paths[source]
        if source == "ppr_program_sites":
            found.append(
                _points(path, lambda r: (r.get("program_type") or "").upper() in RECREATION_TYPES)
            )
        elif source == "ppr_swimming_pools":
            found.append(_points(path, lambda r: (r.get("pool_status") or "") != NOT_IN_SERVICE))
        elif source == "ppr_spraygrounds":
            found.append(_points(path, lambda r: (r.get("spray_status") or "") != NOT_IN_SERVICE))
        elif source == "snap_retailers":
            found.append(_points(path, lambda r: (r.get("store_type") or "") in FOOD_STORE_TYPES))
        elif source == "septa_gtfs":
            found.append(transit_stop_points(path))
        else:
            found.append(_points(path))
    joined = [a for a in found if len(a)]
    return np.concatenate(joined) if joined else np.array([], dtype=object)


def transit_stop_points(path: Path) -> np.ndarray:
    """Every SEPTA stop with a departure on a typical weekday, Saturday or Sunday."""
    names = ["kind", "lat", "lng", "trips_wk", "trips_sa", "trips_su"]
    table = pq.read_table(path, columns=names)
    lats, lngs = [], []
    for kind, lat, lng, wk, sa, su in zip(
        *(table.column(n).to_pylist() for n in names), strict=True
    ):
        if (
            kind == "stop"
            and lat is not None
            and lng is not None
            and (wk or 0) + (sa or 0) + (su or 0)
        ):
            lats.append(lat)
            lngs.append(lng)
    return shapely.points(lngs, lats) if lats else np.array([], dtype=object)


# ---------------------------------------------------------------------------------------------
# Inputs


@dataclass
class BlockGroups:
    """The EPA's block groups: their ids, shapes (longitude and latitude) and walkability."""

    geoids: list[str]
    shapes: np.ndarray
    index: dict[str, float | None]


def load_block_groups(path: Path) -> BlockGroups:
    table = pq.read_table(path, columns=["geoid10", "natwalkind", "geometry"])
    rows = [r for r in table.to_pylist() if r["geoid10"] and r["geometry"] is not None]
    geoids = [str(r["geoid10"]) for r in rows]
    shapes = shapely.from_wkb([r["geometry"] for r in rows])
    invalid = ~shapely.is_valid(shapes)
    if invalid.any():
        shapes[invalid] = shapely.make_valid(shapes[invalid])
    return BlockGroups(
        geoids=geoids,
        shapes=shapes,
        index={g: r["natwalkind"] for g, r in zip(geoids, rows, strict=True)},
    )


@dataclass
class WalkInputs:
    """Everything the measures read, in meters, loaded once."""

    blocks_m: np.ndarray | None = None
    population: np.ndarray | None = None
    corners_m: np.ndarray | None = None
    places_m: dict[str, np.ndarray] = field(default_factory=dict)
    block_groups: BlockGroups | None = None
    missing_sources: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @classmethod
    def load(cls, paths: dict[str, Path | None]) -> WalkInputs:
        """Read every input that has a snapshot. One that cannot be read (a column gone, a broken
        file) leaves its measure out with a note, never the rest: the map must still publish."""
        found = cls()
        found.missing_sources = [s for s in SOURCES if paths.get(s) is None]
        present = {s: p for s, p in paths.items() if p is not None}

        def attempt(what: str, read) -> None:
            try:
                read()
            except Exception as exc:  # one unreadable input never stops the others
                reason = " ".join(str(exc).split())[:200] or type(exc).__name__
                found.notes.append(
                    f"Walking distance: {what} could not be read ({reason}), so it is left out"
                )
                log.warning("walk: %s could not be read", what, exc_info=True)

        def blocks() -> None:
            table = pq.read_table(present["census_blocks_2020"], columns=["population", "geometry"])
            people = np.array([v or 0 for v in table.column("population").to_pylist()], dtype=float)
            found.blocks_m = to_meters(shapely.from_wkb(table.column("geometry").to_pylist()))
            found.population = people

        def corners() -> None:
            table = pq.read_table(
                present["street_centerlines"],
                columns=["seg_id", "class", "fnode_", "tnode_", "geometry"],
            )
            points = corner_points(table)
            found.corners_m = to_meters(points) if len(points) else points

        def places(kind: str) -> None:
            points = place_points(kind, present)
            if points is None:
                found.notes.append(
                    f"Walking distance: no snapshot lists any {PLACE_WORDS[kind]}, so that kind of "
                    "place is not counted"
                )
                return
            found.places_m[kind] = to_meters(points) if len(points) else points

        def groups() -> None:
            found.block_groups = load_block_groups(present["epa_walkability"])

        if "census_blocks_2020" in present:
            attempt("the census blocks", blocks)
        if "street_centerlines" in present:
            attempt("the street centerlines", corners)
        for kind, _, _ in PLACE_KINDS:
            attempt(f"the list of {PLACE_PLURALS[kind]}", lambda kind=kind: places(kind))
        if "epa_walkability" in present:
            attempt("the walkability index", groups)
        return found

    def place_counts(self) -> dict[str, int]:
        return {kind: len(points) for kind, points in self.places_m.items()}


#: Plain words for the places of each kind, for the build notes.
PLACE_PLURALS = {
    "library": "Free Library locations",
    "recreation": "recreation centers",
    "pool": "pools and spraygrounds",
    "water": "drinking fountains in parks",
    "school": "schools",
    "food": "grocery stores and markets",
    "transit": "transit stops",
}
#: Plain words for each kind, for the build notes.
PLACE_WORDS = {
    "library": "Free Library location",
    "recreation": "recreation center",
    "pool": "pool or sprayground",
    "water": "drinking fountain in a park",
    "school": "school",
    "food": "grocery store or market",
    "transit": "transit stop",
}


# ---------------------------------------------------------------------------------------------
# The measures


@dataclass
class Measures:
    """The measures of module docstring for a list of points, in their order. None where the
    source of a measure is missing."""

    people: list[int | None]
    corners: list[int | None]
    kinds: list[int | None]
    kind_bits: list[int | None]
    places: list[int | None]
    block_group: list[str | None]
    walk_index: list[float | None]

    def factors(self) -> dict[str, list[int | None]]:
        """The four factor fields, ranked among these points."""
        dest = [
            None if k is None else destination_value(k, p or 0)
            for k, p in zip(self.kinds, self.places, strict=True)
        ]
        return {
            "f_walk": rank_or_none(self.walk_index),
            "f_neighbors": rank_or_none(self.people),
            "f_dest": rank_or_none(dest),
            "f_corners": rank_or_none(self.corners),
        }


def measure(points: np.ndarray, inputs: WalkInputs) -> Measures:
    """The four measures for points in longitude and latitude."""
    count = len(points)
    nothing: list = [None] * count
    points_m = to_meters(points) if count else points

    people: list[int | None] = list(nothing)
    if inputs.blocks_m is not None and inputs.population is not None:
        totals = count_within(points_m, inputs.blocks_m, WALK_5_MIN_M, inputs.population)
        people = [int(round(v)) for v in totals]

    corners: list[int | None] = list(nothing)
    if inputs.corners_m is not None:
        corners = [int(v) for v in count_within(points_m, inputs.corners_m, WALK_5_MIN_M)]

    kinds: list[int | None] = list(nothing)
    bits: list[int | None] = list(nothing)
    places: list[int | None] = list(nothing)
    if inputs.places_m:
        kinds_arr = np.zeros(count, dtype=int)
        bits_arr = np.zeros(count, dtype=int)
        places_arr = np.zeros(count, dtype=int)
        for kind, points_of_kind in inputs.places_m.items():
            near = count_within(points_m, points_of_kind, WALK_10_MIN_M).astype(int)
            present = near > 0
            kinds_arr += present
            bits_arr |= np.where(present, KIND_BITS[kind], 0)
            places_arr += np.minimum(near, KIND_CAP)
        kinds, bits, places = kinds_arr.tolist(), bits_arr.tolist(), places_arr.tolist()

    block_group: list[str | None] = list(nothing)
    walk_index: list[float | None] = list(nothing)
    if inputs.block_groups is not None:
        groups = inputs.block_groups
        block_group = tracts_of(points, groups.geoids, groups.shapes)
        walk_index = [None if g is None else groups.index.get(g) for g in block_group]

    return Measures(people, corners, kinds, bits, places, block_group, walk_index)


# ---------------------------------------------------------------------------------------------
# The run


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> WalkResult:
    """Measure every parcel on the map and write $PK_CACHE/derived/walk_factors.parquet (or
    `out`) with a JSON summary beside it."""
    from placekeepers.derive.heat import load_parcels

    started = time.monotonic()
    as_of = as_of or ctx.today()
    model = ctx.cache.root / "derived" / "vacancy.parquet"
    if not model.is_file():
        raise RuntimeError("The walking measures need the vacancy model first (pk derive)")
    parcels = load_parcels(model)
    paths = {source_id: current_snapshot(ctx, source_id) for source_id in SOURCES}
    inputs = WalkInputs.load(paths)
    found = measure(parcels.points, inputs)
    factors = found.factors()

    notes = list(inputs.notes)
    outside = sum(1 for g in found.block_group if g is None)
    if inputs.block_groups is not None and outside:
        notes.append(
            f"{outside:,} parcels on the map lie in no block group of the EPA's walkability index"
        )
    columns = {
        "opa": (parcels.opa, pa.string()),
        **{name: (values, pa.int16()) for name, values in factors.items()},
        "people_5min": (found.people, pa.int32()),
        "corners_5min": (found.corners, pa.int16()),
        "kinds_10min": (found.kinds, pa.int8()),
        "kind_bits": (found.kind_bits, pa.int16()),
        "places_10min": (found.places, pa.int16()),
        "block_group": (found.block_group, pa.string()),
        "walk_index": (found.walk_index, pa.float64()),
    }
    table = pa.table({name: pa.array(values, kind) for name, (values, kind) in columns.items()})
    out = out or output_path(ctx)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    missing = [s for s in FEEDS if paths[s] is None]
    for source_id in missing:
        notes.append(
            f"The walking measures ran without {source_id}, so {FEEDS[source_id]} is left out"
        )
    result = WalkResult(
        path=out,
        as_of=as_of.isoformat(),
        parcels=len(parcels),
        spread={
            **{name: spread(values) for name, values in factors.items()},
            "people_5min": spread(found.people),
            "corners_5min": spread(found.corners),
            "kinds_10min": spread(found.kinds),
        },
        kinds_found=inputs.place_counts(),
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info(
        "derive: walking measures for %s parcels in %.0f s", f"{len(parcels):,}", result.seconds
    )
    return result


def load_walk(path: Path, fields: Sequence[str] = PARCEL_FACTORS) -> dict[str, dict[str, int]]:
    """The factor fields per OPA account (by default those the lots tiles carry), without the
    ones a parcel has no data for."""
    if not path.is_file():
        return {}
    table = pq.read_table(path, columns=["opa", *fields])
    columns = {name: table.column(name).to_pylist() for name in ("opa", *fields)}
    return {
        opa: {name: int(columns[name][i]) for name in fields if columns[name][i] is not None}
        for i, opa in enumerate(columns["opa"])
    }
