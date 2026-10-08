"""Walking, cycling and people (M3.3): tiles/walk.pmtiles and tiles/cycling.pmtiles
(docs/CONTRACTS.md section 4).

* `block_groups` (walk.pmtiles): the EPA's National Walkability Index for each census block group
  in the city (`epa_walkability`): the index, the EPA's own class of it, its four parts as the
  EPA ranks them nationally, and the fifth of Philadelphia's block groups each falls in.
* `cells` (walk.pmtiles): one hexagon per area cell (H3 resolution 9, about two blocks across)
  whose middle lies in the city and not on water, with what lies within a short walk of its
  middle (placekeepers.derive.walk): the people within a 5 minute walk, the kinds of everyday
  places within a 10 minute walk and which ones, the street corners within a 5 minute walk, and
  the four factor fields ranked among the cells.
* `stress` (cycling.pmtiles): DVRPC's traffic stress for cycling, one line per street segment of
  its network, the more stressful direction where a street's two directions differ.

The block groups and cells share a light file, a few thousand polygons; the street lines, about
39,000 in the city, are a file of their own, so turning on one never downloads the other.
"""

from __future__ import annotations

import logging
import statistics
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

import h3
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.lens_context import philadelphia_cells
from placekeepers.adapters.walk import BIKE_FACILITIES
from placekeepers.context import Context
from placekeepers.derive import walk
from placekeepers.derive.lenses import load_tracts, water_shapes
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.environment import fifths
from placekeepers.publish.layers import BuildResult, LayerBuilder, cell_polygon

log = logging.getLogger(__name__)

WALK_FILE = "tiles/walk.pmtiles"
CYCLING_FILE = "tiles/cycling.pmtiles"
#: The EPA's own classes of the index (its user guide): least walkable up to 5.75, below average
#: up to 10.5, above average up to 15.25, and most walkable above that.
EPA_CLASSES = ((5.75, 1), (10.5, 2), (15.25, 3))
#: The EPA writes this when no transit stop lies within three quarters of a mile.
NO_TRANSIT = -99999.0


def epa_class(index: float | None) -> int | None:
    """The EPA's class of a walkability index: 1 least walkable to 4 most walkable."""
    if index is None:
        return None
    for top, cls in EPA_CLASSES:
        if index <= top:
            return cls
    return 4


def _rank(value: object) -> int | None:
    """An EPA rank, a whole number from 1 to 20, or None."""
    if not isinstance(value, int | float):
        return None
    whole = int(round(value))
    return whole if 1 <= whole <= 20 else None


def _mix(row: dict) -> float | None:
    """The average of the two mix measures (jobs of different kinds; jobs and homes), 0 to 1."""
    values = [row.get("d2b_e8mixa"), row.get("d2a_ephhm")]
    present = [v for v in values if isinstance(v, int | float) and v >= 0]
    return sum(present) / len(present) if present else None


def _closeness(d4a: object) -> float | None:
    """How close transit is, for ranking: the distance turned around, so nearer is higher. No
    stop within three quarters of a mile ranks lowest."""
    if not isinstance(d4a, int | float):
        return None
    return -1e9 if d4a < 0 else -float(d4a)


def land_of(paths: dict[str, Path]):
    """The city's land, in longitude and latitude: the census tracts joined, less the land use
    map's water; None when the tracts are missing."""
    if "census_tracts_2020" not in paths:
        return None
    _, tracts = load_tracts(paths["census_tracts_2020"])
    land = shapely.union_all(shapely.make_valid(tracts))
    water = water_shapes(paths.get("land_use"))
    if len(water):
        land = shapely.difference(land, shapely.union_all(shapely.make_valid(water)))
    return land


def build_block_groups(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    """The EPA's block groups, trimmed to the city's land: the Census Bureau's block groups run to
    the middle of the rivers, which would shade the water as if it were a walkable place."""
    table = pq.read_table(paths["epa_walkability"])
    rows = [r for r in table.to_pylist() if r.get("geometry") is not None]
    rows.sort(key=lambda r: str(r.get("geoid10") or ""))
    land = land_of(paths)
    shapes = shapely.make_valid(shapely.from_wkb([r["geometry"] for r in rows]))
    if land is not None and len(shapes):
        shapely.prepare(land)
        shapes = shapely.intersection(shapes, land)
    city = {
        "qw": fifths([r.get("natwalkind") for r in rows]),
        "qc": fifths([r.get("d3b") for r in rows]),
        "qt": fifths([_closeness(r.get("d4a")) for r in rows]),
        "qm": fifths([_mix(r) for r in rows]),
    }
    classes: Counter = Counter()
    with GeoJSONWriter(out) as writer:
        for i, row in enumerate(rows):
            index = row.get("natwalkind")
            properties: dict[str, object] = {"id": str(row.get("geoid10") or "")}
            if isinstance(index, int | float):
                properties["w"] = round(float(index), 1)
                properties["nw"] = epa_class(float(index))
                classes[properties["nw"]] += 1
            for key, column in (
                ("rc", "d3b_ranked"),
                ("rt", "d4a_ranked"),
                ("rj", "d2b_ranked"),
                ("rh", "d2a_ranked"),
            ):
                rank = _rank(row.get(column))
                if rank is not None:
                    properties[key] = rank
            for key, values in city.items():
                if values[i] is not None:
                    properties[key] = values[i]
            shape = shapes[i]
            if shape.is_empty:
                continue
            if shape.geom_type == "GeometryCollection":
                shape = shapely.union_all(
                    [g for g in shape.geoms if g.geom_type.endswith("Polygon")]
                )
            writer.write(properties, geometry_json(shape, 6))
    words = ("least walkable", "below average", "above average", "most walkable")
    line = f"walkability: {writer.count:,} block groups; by the EPA's classes " + ", ".join(
        f"{classes[i + 1]:,} {w}" for i, w in enumerate(words)
    )
    if land is None:
        line += "; the census tracts are missing, so the shapes are not trimmed to the city's land"
    elif writer.count < len(rows):
        line += f"; {len(rows) - writer.count:,} lying wholly on water left out"
    return BuildResult(writer.count, [line])


# The cells


def city_cell_ids(paths: dict[str, Path]) -> list[str]:
    """The area cells whose middle lies inside the city limits (the 2020 census tracts joined)
    and not on water (the land use map's water), sorted."""
    _, tracts = load_tracts(paths["census_tracts_2020"])
    valid = shapely.make_valid(tracts)
    city = shapely.union_all(valid)
    cells = philadelphia_cells()
    centers = shapely.points([h3.cell_to_latlng(c)[::-1] for c in cells])
    shapely.prepare(city)
    inside = shapely.contains(city, centers)
    keep = [c for c, flag in zip(cells, inside.tolist(), strict=True) if flag]
    water = water_shapes(paths.get("land_use"))
    if len(water):
        points = shapely.points([h3.cell_to_latlng(c)[::-1] for c in keep])
        wet, _ = shapely.STRtree(shapely.make_valid(water)).query(points, predicate="intersects")
        drop = set(wet.tolist())
        keep = [c for i, c in enumerate(keep) if i not in drop]
    return sorted(keep)


def build_cells(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    notes: list[str] = []
    if "census_tracts_2020" not in paths:
        with GeoJSONWriter(out):
            pass
        return BuildResult(
            0, ["cells: the census tracts are missing, so no hexagons are published"]
        )
    cells = city_cell_ids(paths)
    inputs = walk.WalkInputs.load({source: paths.get(source) for source in walk.SOURCES})
    notes.extend(inputs.notes)
    centers = shapely.points([h3.cell_to_latlng(c)[::-1] for c in cells])
    found = walk.measure(centers, inputs)
    factors = found.factors()
    with GeoJSONWriter(out) as writer:
        for i, cell in enumerate(cells):
            properties: dict[str, object] = {"h": cell}
            for key, values in (
                ("p", found.people),
                ("d", found.kinds),
                ("dk", found.kind_bits),
                ("k", found.corners),
            ):
                if values[i] is not None:
                    properties[key] = values[i]
            for name, values in factors.items():
                if values[i] is not None:
                    properties[name] = values[i]
            writer.write(properties, geometry_json(cell_polygon(cell)))
    people = [p for p in found.people if p is not None]
    kinds = Counter(k for k in found.kinds if k is not None)
    line = f"cells: {writer.count:,} hexagons whose middle lies in the city and not on water"
    if people:
        line += (
            f"; people within a 5 minute walk of their middle from {min(people):,} to "
            f"{max(people):,} (median {int(statistics.median(people)):,})"
        )
    if kinds:
        line += "; kinds of everyday places within a 10 minute walk: " + ", ".join(
            f"{n:,} with {k}" for k, n in sorted(kinds.items())
        )
    notes.insert(0, line)
    log.info("publish: %s", line)
    return BuildResult(writer.count, notes)


# Traffic stress for cycling


def _link_order(key: object) -> tuple:
    """DVRPC's link numbers in order, then any row without one."""
    if isinstance(key, int | float):
        return (0, float(key), "")
    return (1, 0.0, str(key))


def build_stress(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    """One line per street segment (DVRPC's link number), the more stressful direction where its
    two directions differ (docs/CONTRACTS.md section 4)."""
    table = pq.read_table(paths["dvrpc_lts"])
    links: dict[object, list[dict]] = defaultdict(list)
    for row in table.to_pylist():
        if row.get("geometry") is None or row.get("lts") is None:
            continue
        links[row.get("no") if row.get("no") is not None else ("row", row.get("objectid"))].append(
            row
        )
    levels: Counter = Counter()
    split = 0
    with GeoJSONWriter(out) as writer:
        for key in sorted(links, key=_link_order):
            rows = links[key]
            stress = [int(round(r["lts"])) for r in rows]
            worst = max(stress)
            if not 1 <= worst <= 4:
                continue
            first = max(rows, key=lambda r: int(round(r["lts"])))
            properties: dict[str, object] = {}
            if isinstance(key, int | float):
                properties["id"] = int(key)
            properties["l"] = worst
            calmer = min(stress)
            if calmer < worst:
                properties["l2"] = calmer
                split += 1
            facility = max(BIKE_FACILITIES.get(str(r.get("bike_facility") or ""), 0) for r in rows)
            if facility:
                properties["bf"] = facility
            speed = max((r.get("vehiclespeed") or 0) for r in rows)
            if speed and speed > 0:
                properties["sp"] = int(round(speed))
            lanes = first.get("totnumlanes")
            if isinstance(lanes, int | float) and lanes > 0:
                properties["ln"] = int(round(lanes))
            writer.write(properties, geometry_json(first["geometry"], 6))
            levels[worst] += 1
    line = (
        f"stress: {writer.count:,} street segments rated by DVRPC: "
        + ", ".join(f"{levels[n]:,} at level {n}" for n in (1, 2, 3, 4))
        + f"; {split:,} whose two directions differ show the more stressful one"
    )
    log.info("publish: %s", line)
    return BuildResult(writer.count, [line])


WALK_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        WALK_FILE,
        "block_groups",
        ("epa_walkability",),
        build_block_groups,
        extras=("census_tracts_2020", "land_use"),
    ),
    LayerBuilder(
        WALK_FILE,
        "cells",
        ("census_blocks_2020",),
        build_cells,
        extras=tuple(
            s
            for s in dict.fromkeys((*walk.SOURCES, "census_tracts_2020", "land_use"))
            if s != "census_blocks_2020"
        ),
    ),
    LayerBuilder(CYCLING_FILE, "stress", ("dvrpc_lts",), build_stress),
)

__all__ = ["WALK_BUILDERS", "build_block_groups", "build_cells", "build_stress", "epa_class"]
