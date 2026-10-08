"""The placemaking lens (registry/lenses.yaml, `placemaking`; milestone M3.4): where a vacant lot
would most likely become a public place people use every day, such as a garden, a pocket park,
seating and shade, or a spot for art (docs/DESIGN.md section 5.3, docs/CONTRACTS.md section 4).

It is about use and welcome, never about crime: no study links art or walkability to less
violence (docs/EVIDENCE.md, "Placemaking").

Three of its factors are the walking measures of M3.3 (placekeepers.derive.walk: `f_neighbors`,
`f_dest`, `f_walk`, where more ranks higher). This step adds three more, each an integer from 0 to
100 for every parcel on the map, measured in a straight line from the parcel's point on its shape
(UTM zone 18 north), as the walking measures are:

* `f_park`: far from a park. The distance to the edge of the nearest park land of Parks and
  Recreation (`ppr_properties`: parks, playgrounds, recreation centers, squares, greenways,
  nature areas and gardens; not its work yards, golf courses or planted traffic medians, PARK_*
  below), 0 for a point inside one. Ranked as the share of parcels closer to one, so farther
  ranks higher.
* `f_art`: no public art nearby. The distance to the nearest work of public art on the City's
  Percent for Art list (`percent_for_art`, the works on view the art layer shows, less those the
  City says are inside a building) or in Wikidata (`wikidata_art`, the works inside the city that
  are not gone), as placekeepers.derive.art reads them. Ranked the same way. OpenStreetMap's
  artworks are never read here: they are under the Open Database License, and nothing worked out
  from them may be stored in the lots tiles (decision D1 of docs/VERIFICATION_V0_2.md).
* `f_corr`: on or near a commercial corridor. 100 when the parcel's point lies on one of the
  City's commercial corridors (`commercial_corridors`) or within CORRIDOR_NEAR_M of one, else 0.

`f_park` and `f_art` are rounded to the nearest 5 (RANK_STEP). A straight line distance says
nothing finer, and 21 values instead of 101 keep tiles/lots.pmtiles smaller: on 2026-10-08 the two
exact ranks added 10 percent to the file, the rounded ones about 5 percent.

A factor whose sources have no snapshot is left out of every parcel, as for every lens.

**Suggestions** for vacant lots only, decided here so the map and the lot page agree (the rule is
suggestions_for):

* `seating_and_shade` where more people live within a 5 minute walk than around half the places
  on the map (`f_neighbors` at least 50);
* `community_garden` where the lot is farther from a park than half the places on the map
  (`f_park` at least 50) and at least GARDEN_MIN_PEOPLE people live within a 5 minute walk
  (`people_5min` of the walking measures), so a garden has neighbors to tend it and use it: far
  from a park alone also finds new developments by the river, the Navy Yard and industrial land
  where almost no one lives;
* `art_request` where no work of the two art lists stands within a 5 minute walk (400 meters) and
  many people live around the lot (`f_neighbors` at least 50), so art would be seen;
* `report_dumping`, `report_dark_light` and `report_graffiti` where a street block the lot faces
  (one of the street safety layer's blocks within FACING_M of the lot's shape) has a request to
  Philly311 about that condition still open, counted exactly as the conditions layer counts them
  (placekeepers.publish.conditions). These only point to the City's own services for physical
  conditions, never to the police (docs/ETHICS.md). The 311 counts are never a factor: a count
  says that people asked, not how often a condition occurs (docs/CONTRACTS.md section 4).
"""

from __future__ import annotations

import logging
import math
import time
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
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
from placekeepers.derive.lenses import current_snapshot, rank_or_none, spread
from placekeepers.derive.street_safety import StreetNetwork, plural, to_meters

log = logging.getLogger(__name__)

#: The factors this step computes. The lens also lists f_neighbors, f_dest and f_walk (M3.3).
FACTORS = ("f_park", "f_art", "f_corr")
#: The factor each source feeds. Without every source of a factor, that factor is left out.
FEEDS = {
    "ppr_properties": "f_park",
    "percent_for_art": "f_art",
    "wikidata_art": "f_art",
    "commercial_corridors": "f_corr",
}
#: Read for the reports to Philly311, never a factor.
OPTIONAL = ("philly311_conditions", "street_centerlines")
#: Sources this step reads (credited on the lots tiles).
SOURCES = (*FEEDS, *OPTIONAL)

#: Parks and Recreation land that is not a park people can use: work yards and offices, golf
#: courses (they charge to play), and traffic islands and medians with no park use.
PARK_LEFT_OUT_CLASSES = frozenset({"OPERATIONAL_INTERNAL"})
PARK_LEFT_OUT_USES = frozenset({"OPERATIONS", "GOLF"})
MEDIAN_CLASS = "TRAFFIC_ISLAND_MEDIAN"
MEDIAN_LEFT_OUT_USE = "OTHER"

#: "Near" a commercial corridor: within this many meters of it (about half a block).
CORRIDOR_NEAR_M = 50.0
#: A 5 minute walk in a straight line (placekeepers.derive.walk), for "no art nearby".
ART_NEAR_M = 400.0
#: The street blocks a lot faces: those within this many meters of its shape, which reaches the
#: middle of the street in front of nearly every lot (and of the side street of a corner lot).
FACING_M = 20.0

#: `f_park` and `f_art` are rounded to a multiple of this (module docstring).
RANK_STEP = 5
#: A factor at or above this means more than at half the places on the map.
SUGGEST_FROM = 50
#: A community garden needs at least this many people within a 5 minute walk (`people_5min`).
GARDEN_MIN_PEOPLE = 1000
SEATING_AND_SHADE = "seating_and_shade"
COMMUNITY_GARDEN = "community_garden"
ART_REQUEST = "art_request"
REPORT_DUMPING = "report_dumping"
REPORT_DARK_LIGHT = "report_dark_light"
REPORT_GRAFFITI = "report_graffiti"
#: The bit of each kind of condition in `open_311`, and the report it calls for, in the order
#: of the conditions layers.
CONDITION_REPORTS: tuple[tuple[str, int, str], ...] = (
    ("dumping", 1, REPORT_DUMPING),
    ("lights", 2, REPORT_DARK_LIGHT),
    ("graffiti", 4, REPORT_GRAFFITI),
)
#: In the order a lot lists them.
PLACEMAKING_SUGGESTIONS = (
    SEATING_AND_SHADE,
    COMMUNITY_GARDEN,
    ART_REQUEST,
    *(report for _, _, report in CONDITION_REPORTS),
)


@dataclass
class PlacemakingResult:
    path: Path
    as_of: str
    parcels: int
    spread: dict[str, Any]
    inputs: dict[str, int]
    suggestions: dict[str, int]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "placemaking_factors.parquet"


# ---------------------------------------------------------------------------------------------
# Small pieces, each tested on its own


def coarse(ranks: Sequence[int | None], step: int = RANK_STEP) -> list[int | None]:
    """Ranks rounded to the nearest multiple of `step` (halves up); None stays None."""
    return [None if r is None else int(math.floor(r / step + 0.5)) * step for r in ranks]


def is_park(row: Mapping[str, Any]) -> bool:
    """Whether a Parks and Recreation property counts as a park for `f_park` (module docstring)."""
    klass = str(row.get("property_classification") or "").strip().upper()
    use = str(row.get("ppr_use") or "").strip().upper()
    if klass in PARK_LEFT_OUT_CLASSES or use in PARK_LEFT_OUT_USES:
        return False
    return not (klass == MEDIAN_CLASS and use in {MEDIAN_LEFT_OUT_USE, ""})


def suggestions_for(
    is_lot: bool,
    factors: Mapping[str, int],
    art_m: float | None,
    open_bits: int,
    people: int | None = None,
) -> list[str]:
    """The placemaking suggestion ids for one parcel (module docstring), in order. `art_m` is the
    distance to the nearest work of the two art lists (None when neither list has a snapshot);
    `open_bits`, the kinds of condition with an open request on a block the lot faces; `people`,
    the people within a 5 minute walk (None when the walking measures do not know, and then no
    garden is suggested)."""
    if not is_lot:
        return []
    found: list[str] = []
    neighbors = factors.get("f_neighbors", -1)
    if neighbors >= SUGGEST_FROM:
        found.append(SEATING_AND_SHADE)
    if (
        factors.get("f_park", -1) >= SUGGEST_FROM
        and people is not None
        and people >= GARDEN_MIN_PEOPLE
    ):
        found.append(COMMUNITY_GARDEN)
    if art_m is not None and art_m > ART_NEAR_M and neighbors >= SUGGEST_FROM:
        found.append(ART_REQUEST)
    found.extend(report for _, bit, report in CONDITION_REPORTS if open_bits & bit)
    return found


def with_more(base: Sequence[str], more: Iterable[str], known: set[str] | None) -> list[str]:
    """A parcel's suggestions: `base`, then those of `more` it does not have yet that the
    registry has (as placekeepers.derive.heat.with_heat does for the heat suggestions)."""
    out = list(base)
    for item in more:
        if item not in out and (known is None or item in known):
            out.append(item)
    return out


def nearest_distances(points_m: np.ndarray, targets_m: np.ndarray) -> list[int | None]:
    """For each point (in meters), the distance in whole meters to the nearest target (0 inside
    an area), or None for every point when there are no targets."""
    count = len(points_m)
    if len(targets_m) == 0:
        return [None] * count
    if count == 0:
        return []
    found, distances = STRtree(targets_m).query_nearest(
        points_m, return_distance=True, all_matches=False
    )
    out: list[int | None] = [None] * count
    for point, distance in zip(found[0].tolist(), distances.tolist(), strict=True):
        out[point] = int(round(distance))
    return out


def near_any(points_m: np.ndarray, areas_m: np.ndarray, within: float) -> list[int]:
    """For each point (in meters), 100 when it lies in or within `within` meters of an area,
    else 0 (the `f_corr` values)."""
    flags = np.zeros(len(points_m), dtype=int)
    if len(points_m) and len(areas_m):
        pairs = STRtree(areas_m).query(points_m, predicate="dwithin", distance=within)
        flags[np.unique(pairs[0])] = 100
    return flags.tolist()


def facing_blocks(shapes_m: np.ndarray, network: StreetNetwork, within: float = FACING_M):
    """For each parcel shape (in meters), the indexes of the network's blocks within `within`
    meters of it: the blocks it faces."""
    out: list[list[int]] = [[] for _ in range(len(shapes_m))]
    if len(shapes_m) == 0 or len(network) == 0:
        return out
    parcel, block = network.tree.query(shapes_m, predicate="dwithin", distance=within)
    for p, b in zip(parcel.tolist(), block.tolist(), strict=True):
        out[p].append(int(b))
    return out


def open_condition_bits(rows: list[dict[str, Any]], network: StreetNetwork) -> dict[int, int]:
    """For each block (the network's index) with a request still open in the conditions window,
    the kinds of condition, as the bits of CONDITION_REPORTS. The requests are counted exactly as
    the conditions layers count them."""
    from placekeepers.publish.conditions import KINDS, requests_by_block, window_of

    span = window_of(rows)
    bits: dict[int, int] = {}
    if span is None:
        return bits
    for kind, bit, _ in CONDITION_REPORTS:
        counts = requests_by_block(rows, KINDS[kind], network, span)
        for block, entry in counts.per_block.items():
            if entry["o"]:
                bits[block] = bits.get(block, 0) | bit
    return bits


def lot_condition_bits(blocks: Sequence[Sequence[int]], open_bits: Mapping[int, int]) -> list[int]:
    """For each lot, the kinds of condition with an open request on any block it faces."""
    out = []
    for faced in blocks:
        value = 0
        for block in faced:
            value |= open_bits.get(block, 0)
        out.append(value)
    return out


# ---------------------------------------------------------------------------------------------
# Inputs


def _shapes(wkbs: Sequence[bytes]) -> np.ndarray:
    shapes = shapely.from_wkb(list(wkbs))
    invalid = ~shapely.is_valid(shapes)
    if invalid.any():
        shapes[invalid] = shapely.make_valid(shapes[invalid])
    return shapes


def load_parks(path: Path) -> tuple[np.ndarray, int]:
    """The park land of `ppr_properties` in meters (is_park), and how many properties were left
    out."""
    rows = pq.read_table(
        path, columns=["property_classification", "ppr_use", "geometry"]
    ).to_pylist()
    kept = [r["geometry"] for r in rows if r["geometry"] is not None and is_park(r)]
    if not kept:
        return np.array([], dtype=object), len(rows)
    return to_meters(_shapes(kept)), len(rows) - len(kept)


def load_art_points(
    paths: Mapping[str, Path | None], as_of: date
) -> tuple[np.ndarray, dict[str, int]]:
    """The works of the City's list (outdoors) and of Wikidata, as points in meters, with how many
    came from each (placekeepers.derive.art reads both lists exactly as the art layer does)."""
    from placekeepers.derive.art import city_records, wikidata_records

    lngs: list[float] = []
    lats: list[float] = []
    counts: dict[str, int] = {}
    if paths.get("percent_for_art") is not None:
        records, _ = city_records(pq.read_table(paths["percent_for_art"]).to_pylist(), as_of)
        outdoors = [r for r in records if not r.inside]
        counts["percent_for_art"] = len(outdoors)
        counts["percent_for_art_inside"] = len(records) - len(outdoors)
        lngs += [r.lng for r in outdoors]
        lats += [r.lat for r in outdoors]
    if paths.get("wikidata_art") is not None:
        records, _ = wikidata_records(pq.read_table(paths["wikidata_art"]).to_pylist(), as_of)
        counts["wikidata_art"] = len(records)
        lngs += [r.lng for r in records]
        lats += [r.lat for r in records]
    if not lngs:
        return np.array([], dtype=object), counts
    return to_meters(shapely.points(lngs, lats)), counts


def load_corridors(path: Path) -> tuple[np.ndarray, list[str]]:
    """The commercial corridors in meters, with their names."""
    rows = [
        r
        for r in pq.read_table(path, columns=["name", "geometry"]).to_pylist()
        if r["geometry"] is not None
    ]
    if not rows:
        return np.array([], dtype=object), []
    return to_meters(_shapes([r["geometry"] for r in rows])), [r["name"] or "" for r in rows]


# ---------------------------------------------------------------------------------------------
# The run


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> PlacemakingResult:
    """Compute the placemaking factors and suggestions for every parcel on the map and write
    $PK_CACHE/derived/placemaking_factors.parquet (or `out`) with a JSON summary beside it. Runs
    after the walking measures, whose `f_neighbors` the suggestions read."""
    from placekeepers.derive.heat import _valid, load_parcels
    from placekeepers.derive.walk import load_walk
    from placekeepers.derive.walk import output_path as walk_output

    started = time.monotonic()
    as_of = as_of or ctx.today()
    model = ctx.cache.root / "derived" / "vacancy.parquet"
    if not model.is_file():
        raise RuntimeError("The placemaking lens needs the vacancy model first (pk derive)")
    parcels = load_parcels(model)
    paths = {source_id: current_snapshot(ctx, source_id) for source_id in SOURCES}
    notes: list[str] = []
    inputs: dict[str, int] = {}
    count = len(parcels)
    points_m = to_meters(parcels.points) if count else parcels.points

    # Far from a park
    park_m: list[int | None] = [None] * count
    if paths["ppr_properties"] is not None:
        parks, left_out = load_parks(paths["ppr_properties"])
        inputs["parks"] = len(parks)
        inputs["park_properties_left_out"] = left_out
        park_m = nearest_distances(points_m, parks)

    # No public art nearby, from the City's list and Wikidata only (never OpenStreetMap's)
    art_m: list[int | None] = [None] * count
    art_sources = [s for s in ("percent_for_art", "wikidata_art") if paths[s] is not None]
    if art_sources:
        art, counts = load_art_points(paths, as_of)
        inputs |= {f"art_{name}": n for name, n in counts.items()}
        art_m = nearest_distances(points_m, art)
        if len(art_sources) == 1:
            notes.append(
                f"No public art nearby was measured from {art_sources[0]} alone: the other list "
                "has no snapshot"
            )

    # On or near a commercial corridor
    corridor: list[int | None] = [None] * count
    corridor_name: list[str | None] = [None] * count
    if paths["commercial_corridors"] is not None:
        areas, names = load_corridors(paths["commercial_corridors"])
        inputs["corridors"] = len(areas)
        corridor = list(near_any(points_m, areas, CORRIDOR_NEAR_M))
        if len(areas) and count:
            pairs = STRtree(areas).query_nearest(
                points_m, max_distance=CORRIDOR_NEAR_M, all_matches=False
            )
            for point, area in zip(pairs[0].tolist(), pairs[1].tolist(), strict=True):
                corridor_name[point] = names[area]

    # Open requests to Philly311 on the blocks each lot faces
    open_311: list[int | None] = [None] * count
    blocks_faced: list[int | None] = [None] * count
    if paths["philly311_conditions"] is not None and paths["street_centerlines"] is not None:
        network = StreetNetwork.from_table(pq.read_table(paths["street_centerlines"]))
        shapes_m = _valid(to_meters(parcels.shapes)) if count else parcels.shapes
        faced = facing_blocks(shapes_m, network)
        rows = pq.read_table(paths["philly311_conditions"]).to_pylist()
        bits = open_condition_bits(rows, network)
        inputs["blocks_with_open_requests"] = len(bits)
        open_311 = list(lot_condition_bits(faced, bits))
        blocks_faced = [len(f) for f in faced]
        alone = sum(1 for f in faced if not f)
        if alone:
            notes.append(
                f"{plural(alone, 'parcel on the map faces', 'parcels on the map face')} no street "
                f"block within {FACING_M:.0f} meters, so no report to Philly311 is suggested there"
            )
    else:
        notes.append(
            "The placemaking lens ran without the 311 requests or the street centerlines, so no "
            "lot gets a report to Philly311"
        )

    f_park = coarse(rank_or_none(park_m))
    f_art = coarse(rank_or_none(art_m))
    f_corr = corridor

    # Suggestions, with the walking measures' f_neighbors and people within a 5 minute walk.
    walking = load_walk(walk_output(ctx), ("f_neighbors", "people_5min"))
    if not walking:
        notes.append(
            "The walking measures have not been computed, so no lot gets seating and shade, a "
            "community garden or a mural for its neighbors"
        )
    suggested = []
    for i, opa in enumerate(parcels.opa):
        walk = walking.get(opa, {})
        factors = {
            name: value
            for name, value in (("f_park", f_park[i]), ("f_neighbors", walk.get("f_neighbors")))
            if value is not None
        }
        found = suggestions_for(
            parcels.is_lot[i], factors, art_m[i], open_311[i] or 0, walk.get("people_5min")
        )
        suggested.append(",".join(found))

    columns = {
        "opa": (parcels.opa, pa.string()),
        "f_park": (f_park, pa.int16()),
        "f_art": (f_art, pa.int16()),
        "f_corr": (f_corr, pa.int16()),
        "sg": (suggested, pa.string()),
        "park_m": (park_m, pa.int32()),
        "art_m": (art_m, pa.int32()),
        "corridor": (corridor_name, pa.string()),
        "open_311": (open_311, pa.int8()),
        "blocks_faced": (blocks_faced, pa.int16()),
    }
    table = pa.table({name: pa.array(values, kind) for name, (values, kind) in columns.items()})
    out = out or output_path(ctx)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    missing = [s for s in FEEDS if paths[s] is None]
    for factor in FACTORS:
        feeding = [s for s, f in FEEDS.items() if f == factor]
        if all(s in missing for s in feeding):
            notes.append(
                f"The placemaking lens ran without {' and '.join(feeding)}, so {factor} is left out"
            )
    tally = Counter(s for row in suggested for s in row.split(",") if s)
    result = PlacemakingResult(
        path=out,
        as_of=as_of.isoformat(),
        parcels=count,
        spread={
            "f_park": spread(f_park),
            "f_art": spread(f_art),
            "f_corr": spread(f_corr),
            "park_m": spread(park_m),
            "art_m": spread(art_m),
        },
        inputs=inputs,
        suggestions={name: tally.get(name, 0) for name in PLACEMAKING_SUGGESTIONS},
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info("derive: placemaking factors for %s parcels in %.0f s", f"{count:,}", result.seconds)
    return result


@dataclass
class PlacemakingFactors:
    """What publishing reads per parcel: the factors for the tile, and the placemaking
    suggestion ids."""

    properties: dict[str, int]
    suggestions: list[str]


def load_placemaking(path: Path) -> dict[str, PlacemakingFactors]:
    """The placemaking factors per OPA account, without the ones a parcel has no data for."""
    if not path.is_file():
        return {}
    names = ("opa", *FACTORS, "sg")
    table = pq.read_table(path, columns=list(names))
    columns = {name: table.column(name).to_pylist() for name in names}
    found: dict[str, PlacemakingFactors] = {}
    for i, opa in enumerate(columns["opa"]):
        properties = {
            name: int(columns[name][i]) for name in FACTORS if columns[name][i] is not None
        }
        suggestions = [s for s in (columns["sg"][i] or "").split(",") if s]
        found[opa] = PlacemakingFactors(properties, suggestions)
    return found
