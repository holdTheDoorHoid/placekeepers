"""The heat and shade lens (registry/lenses.yaml, `heat`): where planting trees or greening a
vacant lot would cool people most (docs/DESIGN.md section 5.3, docs/CONTRACTS.md section 4).

Each factor is an integer from 0 to 100, ranked among the parcels on the map like the violence
lens (placekeepers.derive.lenses), so 100 means the most need:

* `f_heatvul`: the heat vulnerability of the census tract the parcel lies in, from the City's
  Heat Vulnerability Index (`heat_vulnerability`, 2010 tracts): heat exposure (how hot the tract
  gets in summer, from satellite surface temperatures) and heat sensitivity (twelve measures of
  age, health, income and more) combined. The share of parcels in tracts with a lower score. A
  parcel in one of the few tracts the index does not report (parks, the airport) has none.
* `f_canopy`: few trees nearby, the violence lens's measure of 2018 tree canopy within about a
  quarter mile (derive.lenses). It is listed in this lens too and computed only once.
* `f_strees`: few City trees on the block: the trees in Parks and Recreation's tree inventory
  (`street_trees`; the trees the City keeps on its streets and in its parks) within 100 meters of
  the parcel, ranked as the share of parcels with more, so fewer trees rank higher.
* `f_people`: people living nearby: the residents per square kilometer of land in the parcel's
  2020 census tract (the American Community Survey's population for poverty status, the measure
  `acs_poverty` already holds, over the tract's land area). The share of parcels in tracts with
  fewer. More people would feel the cooling. Like population everywhere on this map, it only
  says how many people an improvement would reach.

The floodplain (`fema_floodplain`) is never a factor. Flood risk is a reason for care (wet ground,
building rules, a place where water runs to) and a chance for greening that soaks up rain, so it
appears beside the score instead of raising it: `fp` is 1 when at least a tenth of the parcel lies
in FEMA's 1 percent annual chance floodplain (zones A and AE, the "100 year" flood), and 2 when at
least a tenth lies in that or the 0.2 percent annual chance area together; a parcel with no shape
counts by its point. DESIGN section 5.3 explains the choice.

Suggestions (registry/suggestions.yaml) for vacant lots, decided here so the map and the lot
page agree: `plant_shade_trees` where little shade covers the area (`f_canopy` at least 50: more
canopy around at least half the places on the map; where the canopy is unknown, `f_strees` at
least 50 instead), and `cool_green_lot` where heat hits people hardest (`f_heatvul` at least 50).
The canopy decides the trees card, not the City's tree count: on a leafy block in Chestnut Hill
the shade comes from yards the inventory leaves out. Vacant buildings get neither.

A factor without data for a parcel is left out of its properties, as for every lens.
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
from placekeepers.derive.lenses import (
    SHOWN_KINDS,
    current_snapshot,
    load_factors,
    load_tracts,
    rank_or_none,
    spread,
    tracts_of,
)
from placekeepers.derive.street_safety import plural, to_meters

log = logging.getLogger(__name__)

#: The factors this step computes. The lens also lists f_canopy, which derive.lenses computes.
FACTORS = ("f_heatvul", "f_strees", "f_people")
#: The factor each source feeds. Without the source, that factor is left out.
FEEDS = {
    "heat_vulnerability": "f_heatvul",
    "street_trees": "f_strees",
    "acs_poverty": "f_people",
    "census_tracts_2020": "f_people",
}
#: Used when present, never a factor: the floodplain note beside the score.
OPTIONAL = ("fema_floodplain",)
#: Sources this step reads (credited on the lots tiles).
SOURCES = (*FEEDS, *OPTIONAL)

#: City trees count within this distance of the parcel, in meters (about a block).
TREE_RADIUS_M = 100.0
#: The share of a parcel a flood zone must cover before the parcel is called in it.
FLOOD_SHARE = 0.10
#: `fp` codes (docs/CONTRACTS.md section 4).
FLOOD_1_PERCENT = 1
FLOOD_0_2_PERCENT = 2

#: A factor at or above this means more need than at half the places on the map.
SUGGEST_FROM = 50
PLANT_SHADE_TREES = "plant_shade_trees"
COOL_GREEN_LOT = "cool_green_lot"
#: In the order a lot lists them.
HEAT_SUGGESTIONS = (PLANT_SHADE_TREES, COOL_GREEN_LOT)


@dataclass
class HeatResult:
    path: Path
    as_of: str
    parcels: int
    spread: dict[str, Any]
    floodplain: dict[str, int]
    suggestions: dict[str, int]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "heat_factors.parquet"


# Small pieces, each tested on its own


def suggestions_for(is_lot: bool, factors: dict[str, int]) -> list[str]:
    """The heat suggestion ids for one parcel (module docstring), in order."""
    if not is_lot:
        return []
    found = []
    shade = factors.get("f_canopy", factors.get("f_strees", -1))
    if shade >= SUGGEST_FROM:
        found.append(PLANT_SHADE_TREES)
    if factors.get("f_heatvul", -1) >= SUGGEST_FROM:
        found.append(COOL_GREEN_LOT)
    return found


def with_heat(base: Sequence[str], heat: Sequence[str], known: set[str] | None) -> list[str]:
    """A parcel's suggestions: its first ones, then its heat suggestions that the registry has."""
    out = list(base)
    for item in heat:
        if item not in out and (known is None or item in known):
            out.append(item)
    return out


def flood_code(share_1: float, share_0_2: float) -> int | None:
    """`fp` from the shares of the parcel in the 1 percent and the 0.2 percent annual chance
    areas (a parcel with no area, a point, has a share of 1.0 in the area it lies in)."""
    if share_1 >= FLOOD_SHARE:
        return FLOOD_1_PERCENT
    if share_1 + share_0_2 >= FLOOD_SHARE:
        return FLOOD_0_2_PERCENT
    return None


def flood_class(sfha: object, subtype: object) -> int | None:
    """1 for FEMA's special flood hazard area (1 percent annual chance or more), 2 for the
    0.2 percent annual chance area, None for anything else."""
    if str(sfha or "").strip().upper() == "T":
        return FLOOD_1_PERCENT
    if str(subtype or "").strip().upper().startswith("0.2 PCT"):
        return FLOOD_0_2_PERCENT
    return None


# Inputs


@dataclass
class Parcels:
    opa: list[str]
    is_lot: list[bool]
    shapes: np.ndarray  # shapely shapes, longitude and latitude
    points: np.ndarray  # a point on each shape

    def __len__(self) -> int:
        return len(self.opa)


def load_parcels(model: Path) -> Parcels:
    """The parcels the map shows, exactly as derive.lenses.load_parcels picks them."""
    table = pq.read_table(model, columns=["opa", "kind", "confidence", "geometry"])
    rows = [
        row
        for row in table.to_pylist()
        if row["kind"] in SHOWN_KINDS and row["geometry"] is not None and row["confidence"]
    ]
    shapes = shapely.from_wkb([row["geometry"] for row in rows])
    return Parcels(
        opa=[row["opa"] for row in rows],
        is_lot=[row["kind"] != "building" for row in rows],
        shapes=shapes,
        points=shapely.point_on_surface(shapes),
    )


@dataclass
class HeatTracts:
    geoids: list[str]
    shapes: np.ndarray
    hvi: dict[str, float | None]
    hei: dict[str, float | None]
    hsi: dict[str, float | None]


def load_heat_tracts(path: Path) -> HeatTracts:
    table = pq.read_table(
        path, columns=["geoid10", "hvi_score", "hei_score", "hsi_score", "geometry"]
    )
    rows = [r for r in table.to_pylist() if r["geoid10"] and r["geometry"] is not None]
    geoids = [str(r["geoid10"]) for r in rows]
    return HeatTracts(
        geoids=geoids,
        shapes=shapely.from_wkb([r["geometry"] for r in rows]),
        hvi={g: r["hvi_score"] for g, r in zip(geoids, rows, strict=True)},
        hei={g: r["hei_score"] for g, r in zip(geoids, rows, strict=True)},
        hsi={g: r["hsi_score"] for g, r in zip(geoids, rows, strict=True)},
    )


def _valid(shapes: np.ndarray) -> np.ndarray:
    shapes = shapes.copy()
    invalid = ~shapely.is_valid(shapes)
    if invalid.any():
        shapes[invalid] = shapely.make_valid(shapes[invalid])
    return shapes


def trees_near(
    shapes_m: np.ndarray, trees_m: np.ndarray, radius: float = TREE_RADIUS_M
) -> list[int]:
    """For each shape (in meters), how many tree points lie within `radius` of it."""
    if len(shapes_m) == 0:
        return []
    if len(trees_m) == 0:
        return [0] * len(shapes_m)
    shape_index, _ = STRtree(trees_m).query(shapes_m, predicate="dwithin", distance=radius)
    return np.bincount(shape_index, minlength=len(shapes_m)).astype(int).tolist()


def load_tree_points(path: Path) -> np.ndarray:
    table = pq.read_table(path, columns=["geometry"])
    wkb = [w for w in table.column("geometry").to_pylist() if w is not None]
    return shapely.from_wkb(wkb) if wkb else np.array([], dtype=object)


def people_per_km2(tracts_path: Path, population_path: Path) -> dict[str, float]:
    """Residents per square kilometer of land, per 2020 tract. A tract without a population
    estimate or without land has none."""
    land = pq.read_table(tracts_path, columns=["geoid", "aland"]).to_pylist()
    people = {
        row["geoid"]: row["population_for_poverty"]
        for row in pq.read_table(
            population_path, columns=["geoid", "population_for_poverty"]
        ).to_pylist()
        if row["geoid"]
    }
    out: dict[str, float] = {}
    for row in land:
        geoid, area = row["geoid"], row["aland"]
        count = people.get(geoid)
        if geoid and count is not None and area and area > 0:
            out[geoid] = round(count / (area / 1e6), 1)
    return out


def load_floodplain(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """FEMA's flood areas in meters, and the class of each (flood_class)."""
    table = pq.read_table(path, columns=["sfha_tf", "zone_subty", "geometry"])
    shapes, classes = [], []
    for sfha, subtype, wkb in zip(
        *(table.column(name).to_pylist() for name in ("sfha_tf", "zone_subty", "geometry")),
        strict=True,
    ):
        found = flood_class(sfha, subtype)
        if found is None or wkb is None:
            continue
        shapes.append(wkb)
        classes.append(found)
    if not shapes:
        return np.array([], dtype=object), np.array([], dtype=int)
    return _valid(to_meters(shapely.from_wkb(shapes))), np.array(classes)


def flood_codes(
    shapes_m: np.ndarray, zones_m: np.ndarray, classes: np.ndarray
) -> tuple[list[int | None], list[float], list[float]]:
    """`fp` for each parcel shape (in meters), with the share of it in each kind of area."""
    count = len(shapes_m)
    share_1 = np.zeros(count)
    share_0_2 = np.zeros(count)
    if count and len(zones_m):
        areas = shapely.area(shapes_m)
        parcel, zone = STRtree(zones_m).query(shapes_m, predicate="intersects")
        if len(parcel):
            pieces = shapely.area(shapely.intersection(shapes_m[parcel], zones_m[zone]))
            with np.errstate(divide="ignore", invalid="ignore"):
                share = np.where(areas[parcel] > 0, pieces / areas[parcel], 1.0)
            for which, target in ((FLOOD_1_PERCENT, share_1), (FLOOD_0_2_PERCENT, share_0_2)):
                mask = classes[zone] == which
                np.add.at(target, parcel[mask], share[mask])
        np.clip(share_1, 0, 1, out=share_1)
        np.clip(share_0_2, 0, 1, out=share_0_2)
        codes = [flood_code(float(a), float(b)) for a, b in zip(share_1, share_0_2, strict=True)]
    else:
        codes = [None] * count
    return codes, share_1.round(3).tolist(), share_0_2.round(3).tolist()


# The run


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> HeatResult:
    """Compute the heat factors for every parcel on the map and write
    $PK_CACHE/derived/heat_factors.parquet (or `out`) with a JSON summary beside it."""
    started = time.monotonic()
    as_of = as_of or ctx.today()
    model = ctx.cache.root / "derived" / "vacancy.parquet"
    if not model.is_file():
        raise RuntimeError("The heat lens needs the vacancy model first (pk derive)")
    parcels = load_parcels(model)
    paths = {source_id: current_snapshot(ctx, source_id) for source_id in SOURCES}
    missing = [s for s in FEEDS if paths[s] is None]
    notes: list[str] = []
    shapes_m = _valid(to_meters(parcels.shapes))

    # Heat vulnerability of the tract
    hvi_tract: list[str | None] = [None] * len(parcels)
    hvi: list[float | None] = [None] * len(parcels)
    hei: list[float | None] = [None] * len(parcels)
    hsi: list[float | None] = [None] * len(parcels)
    if paths["heat_vulnerability"] is not None:
        heat = load_heat_tracts(paths["heat_vulnerability"])
        hvi_tract = tracts_of(parcels.points, heat.geoids, heat.shapes)
        hvi = [None if t is None else heat.hvi.get(t) for t in hvi_tract]
        hei = [None if t is None else heat.hei.get(t) for t in hvi_tract]
        hsi = [None if t is None else heat.hsi.get(t) for t in hvi_tract]
        unscored = sum(1 for t, v in zip(hvi_tract, hvi, strict=True) if t and v is None)
        outside = sum(1 for t in hvi_tract if t is None)
        if unscored or outside:
            notes.append(
                f"{plural(unscored + outside, 'parcel on the map has', 'parcels on the map have')}"
                f" no heat vulnerability score: {outside:,} outside every tract of the index, "
                f"{unscored:,} in tracts it does not report"
            )

    # City trees within 100 meters
    trees: list[int | None] = [None] * len(parcels)
    if paths["street_trees"] is not None:
        tree_points = to_meters(load_tree_points(paths["street_trees"]))
        trees = list(trees_near(shapes_m, tree_points))

    # People per square kilometer in the 2020 tract
    tract: list[str | None] = [None] * len(parcels)
    density: list[float | None] = [None] * len(parcels)
    if paths["census_tracts_2020"] is not None and paths["acs_poverty"] is not None:
        geoids, tract_shapes = load_tracts(paths["census_tracts_2020"])
        tract = tracts_of(parcels.points, geoids, tract_shapes)
        per_km2 = people_per_km2(paths["census_tracts_2020"], paths["acs_poverty"])
        density = [None if t is None else per_km2.get(t) for t in tract]

    # The floodplain, beside the score
    flood: list[int | None] = [None] * len(parcels)
    share_1: list[float | None] = [None] * len(parcels)
    share_0_2: list[float | None] = [None] * len(parcels)
    if paths["fema_floodplain"] is not None:
        zones_m, classes = load_floodplain(paths["fema_floodplain"])
        flood, share_1, share_0_2 = flood_codes(shapes_m, zones_m, classes)
    else:
        notes.append("The heat lens ran without fema_floodplain, so no lot shows a flood note")

    f_heatvul = rank_or_none(hvi)
    # Fewer trees rank higher: the share of parcels with strictly more trees nearby.
    f_strees = rank_or_none([None if t is None else -t for t in trees])
    f_people = rank_or_none(density)

    # Suggestions, with the violence lens's f_canopy for "few trees nearby".
    canopy = load_factors(model.with_name("lens_factors.parquet"))
    suggested = []
    for i, opa in enumerate(parcels.opa):
        factors = {
            name: value
            for name, value in (
                ("f_heatvul", f_heatvul[i]),
                ("f_strees", f_strees[i]),
                ("f_canopy", canopy.get(opa, {}).get("f_canopy")),
            )
            if value is not None
        }
        suggested.append(",".join(suggestions_for(parcels.is_lot[i], factors)))

    columns = {
        "opa": (parcels.opa, pa.string()),
        "f_heatvul": (f_heatvul, pa.int16()),
        "f_strees": (f_strees, pa.int16()),
        "f_people": (f_people, pa.int16()),
        "fp": (flood, pa.int8()),
        "sg": (suggested, pa.string()),
        "hvi_tract": (hvi_tract, pa.string()),
        "hvi_score": (hvi, pa.float64()),
        "hei_score": (hei, pa.float64()),
        "hsi_score": (hsi, pa.float64()),
        "trees_near": (trees, pa.int32()),
        "tract": (tract, pa.string()),
        "people_per_km2": (density, pa.float64()),
        "flood_1pct_share": (share_1, pa.float64()),
        "flood_0_2pct_share": (share_0_2, pa.float64()),
    }
    table = pa.table({name: pa.array(values, kind) for name, (values, kind) in columns.items()})
    out = out or output_path(ctx)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    for source_id in missing:
        notes.append(f"The heat lens ran without {source_id}, so {FEEDS[source_id]} is left out")
    result = HeatResult(
        path=out,
        as_of=as_of.isoformat(),
        parcels=len(parcels),
        spread={
            "f_heatvul": spread(f_heatvul),
            "f_strees": spread(f_strees),
            "f_people": spread(f_people),
            "trees_near": spread(trees),
        },
        floodplain={
            "one_percent": sum(1 for f in flood if f == FLOOD_1_PERCENT),
            "zero_point_two_percent": sum(1 for f in flood if f == FLOOD_0_2_PERCENT),
        },
        suggestions={
            name: sum(1 for s in suggested if name in s.split(",")) for name in HEAT_SUGGESTIONS
        },
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info("derive: heat factors for %s parcels in %.0f s", f"{len(parcels):,}", result.seconds)
    return result


@dataclass
class HeatFactors:
    """What publishing reads per parcel: the factors and `fp` for the tile, and the heat
    suggestion ids."""

    properties: dict[str, int]
    suggestions: list[str]


def load_heat(path: Path) -> dict[str, HeatFactors]:
    """The heat factors per OPA account, without the ones a parcel has no data for."""
    if not path.is_file():
        return {}
    names = ("opa", *FACTORS, "fp", "sg")
    table = pq.read_table(path, columns=list(names))
    columns = {name: table.column(name).to_pylist() for name in names}
    found: dict[str, HeatFactors] = {}
    for i, opa in enumerate(columns["opa"]):
        properties = {
            name: int(columns[name][i]) for name in (*FACTORS, "fp") if columns[name][i] is not None
        }
        suggestions = [s for s in (columns["sg"][i] or "").split(",") if s]
        found[opa] = HeatFactors(properties, suggestions)
    return found
