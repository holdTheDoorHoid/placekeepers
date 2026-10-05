"""The violence reduction lens (registry/lenses.yaml, `violence`): four factors for every parcel on
the map, each an integer from 0 to 100 (docs/CONTRACTS.md section 4).

* `f_vacant`: 100 for an untreated vacant lot or open abandoned building, 0 for a treated one.
  The two Philadelphia trials tested greening lots and giving abandoned houses working doors and
  windows (docs/EVIDENCE.md). A lot counts as treated when PHS LandCare keeps it up. A building
  counts as treated when L&I closed a doors and windows citation for a vacant building
  (PM15-304.19V) as "complied, owner repair", and the building has not been cited as open, or for
  its doors and windows, since. The City's clean and seal boards a building up, which is not the
  trial's treatment, so it does not count. How sure we are that a place is vacant stays out of
  this factor: the confidence filter handles that.
* `f_shoot`: people shot in the last 36 months in the parcel's H3 resolution 9 cell and the six
  around it, counted as on the map's hexagons (publish.layers.aggregate_shootings). The cells
  are about two blocks across, so the seven reach about a quarter mile, the distance DESIGN
  section 5.3 asks for (docs/EVIDENCE.md gives no radius for the trials). Ranked as the share of
  parcels on the map with a strictly lower count.
* `f_poverty`: the share of people below the poverty line in the parcel's census tract (2020
  tracts; American Community Survey 2020 to 2024), ranked the same way among parcels that have
  one. A parcel outside every tract, or in a tract with no survey estimate, has none.
* `f_canopy`: how little tree canopy there is around the parcel: canopy in 2018 over the land of
  the same seven cells (water and the land outside the city left out), ranked as the share of
  parcels with strictly more canopy, so fewer trees rank higher.

A factor without data for a parcel is left out of its properties, so the map leaves it out of
that parcel's average instead of counting it as zero (CONTRACTS.md).
"""

from __future__ import annotations

import logging
import statistics
import time
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import duckdb
import h3
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely import STRtree

from placekeepers.cache import atomic_output, atomic_write_json
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.street_safety import percentile_rank, plural, to_meters
from placekeepers.derive.vacancy import opa9
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

FACTORS = ("f_vacant", "f_shoot", "f_poverty", "f_canopy")
#: The factor each source feeds. Without the source, that factor is left out.
FEEDS = {
    "shootings": "f_shoot",
    "acs_poverty": "f_poverty",
    "census_tracts_2020": "f_poverty",
    "tree_canopy_2018": "f_canopy",
}
#: Used when present: Planning's water polygons, so water does not count as land for f_canopy.
OPTIONAL = ("land_use",)
#: Sources the factors read besides the vacancy model (credited on the lots tiles).
SOURCES = (*FEEDS, *OPTIONAL)
#: The vacancy model's kinds that appear on the map (publish.layers.SHOWN_KINDS).
SHOWN_KINDS = ("lot", "lot_conflict", "building")

H3_RESOLUTION = 9
#: The ring around a parcel's cell: 1 is the cell and its six neighbors.
RING = 1

#: The doors and windows citation for vacant buildings, the resolution that means the owner fixed
#: them, and the citations that mean the building is open again.
DOORS_AND_WINDOWS = "PM15-304.19V"
OWNER_REPAIR = "COMPLIED - OWNER REPAIR"
OPEN_AGAIN = ("PM15-108.2", "PM15-901.1", "PM15-304.19V")
#: Planning's land use code for water (c_dig2).
WATER = 81


@dataclass
class LensResult:
    path: Path
    as_of: str
    parcels: int
    spread: dict[str, Any]
    treated: dict[str, int]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "lens_factors.parquet"


def model_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "vacancy.parquet"


def current_snapshot(ctx: Context, source_id: str) -> Path | None:
    store = SnapshotStore(ctx.cache, source_id)
    meta = store.current()
    return None if meta is None else store.path_for(meta)


# Small pieces, each tested on its own


def ring_cells(cell: str, k: int = RING) -> list[str]:
    """The cell and every cell within k steps of it."""
    return sorted(h3.grid_disk(cell, k))


def ring_sum(cell: str, values: dict[str, float], k: int = RING) -> float:
    return sum(values.get(c, 0) for c in ring_cells(cell, k))


def rank_or_none(values: Sequence[float | None]) -> list[int | None]:
    """percentile_rank over the values that are present; None stays None."""
    present = [v for v in values if v is not None]
    ranks = iter(percentile_rank(present))
    return [None if v is None else next(ranks) for v in values]


def treatment(kind: str, landcare: bool, doors_fixed: bool) -> str | None:
    """How the place was treated the way the trials treated places, or None (f_vacant is 0 for
    a treated place and 100 for any other)."""
    if kind == "building":
        return "doors_and_windows" if doors_fixed else None
    return "landcare" if landcare else None


def spread(values: Sequence[int | None]) -> dict[str, Any]:
    """Quartiles of a factor, and how many parcels have none."""
    present = sorted(v for v in values if v is not None)
    if not present:
        return {"missing": len(values)}
    q1, median, q3 = (
        statistics.quantiles(present, n=4, method="inclusive")
        if len(present) > 1
        else [present[0]] * 3
    )
    return {
        "min": present[0],
        "q1": round(q1, 1),
        "median": round(median, 1),
        "q3": round(q3, 1),
        "max": present[-1],
        "at_0": sum(1 for v in present if v == 0),
        "at_100": sum(1 for v in present if v == 100),
        "missing": len(values) - len(present),
    }


# Inputs


@dataclass
class Parcels:
    opa: list[str]
    kind: list[str]
    landcare: list[bool]
    points: np.ndarray  # shapely points, longitude and latitude
    cells: list[str]

    def __len__(self) -> int:
        return len(self.opa)


def load_parcels(model: Path) -> Parcels:
    """The parcels the map shows (the same ones publish.layers puts in the tiles)."""
    table = pq.read_table(model, columns=["opa", "kind", "confidence", "lc", "geometry"])
    rows = [
        row
        for row in table.to_pylist()
        if row["kind"] in SHOWN_KINDS and row["geometry"] is not None and row["confidence"]
    ]
    shapes = shapely.from_wkb([row["geometry"] for row in rows])
    points = shapely.point_on_surface(shapes)
    xs, ys = shapely.get_x(points), shapely.get_y(points)
    cells = [h3.latlng_to_cell(y, x, H3_RESOLUTION) for x, y in zip(xs, ys, strict=True)]
    return Parcels(
        opa=[row["opa"] for row in rows],
        kind=[row["kind"] for row in rows],
        landcare=[row["lc"] == 1 for row in rows],
        points=points,
        cells=cells,
    )


def doors_fixed(violations: Path | None) -> set[str]:
    """Accounts whose owner fixed the doors and windows of the vacant building (see the module
    docstring), with no citation for an open building or its doors and windows since."""
    if violations is None:
        return set()
    con = duckdb.connect()
    try:
        rows = con.execute(f"""
            WITH v AS (
              SELECT {opa9("opa_account_num")} AS opa, violationcode AS code,
                     violationresolutioncode AS resolution, violationdate AS cited,
                     coalesce(violationresolutiondate, violationdate) AS resolved
              FROM read_parquet({quote_literal(str(violations))})
              WHERE opa_account_num IS NOT NULL),
            fixed AS (
              SELECT opa, max(resolved) AS fixed_on FROM v
              WHERE code = {quote_literal(DOORS_AND_WINDOWS)}
                AND resolution = {quote_literal(OWNER_REPAIR)}
              GROUP BY opa),
            again AS (
              SELECT opa, max(cited) AS last_cited FROM v
              WHERE code IN ({", ".join(quote_literal(c) for c in OPEN_AGAIN)})
              GROUP BY opa)
            SELECT opa FROM fixed LEFT JOIN again USING (opa)
            WHERE last_cited IS NULL OR last_cited <= fixed_on
        """).fetchall()
    finally:
        con.close()
    return {row[0] for row in rows}


def shootings_by_cell(path: Path, as_of: date) -> tuple[dict[str, int], dict[str, int], int]:
    """People shot per cell in the last 36 and 12 months, and how many have no usable point."""
    # The map's hexagons count the same way; reuse their counting so the two always agree.
    from placekeepers.publish.layers import aggregate_shootings

    table = pq.read_table(path, columns=["lat", "lng", "date_"])
    rows = zip(
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("date_").to_pylist(),
        strict=True,
    )
    counts, unplaced = aggregate_shootings(rows, as_of, H3_RESOLUTION)
    s36 = {cell: c[1] for cell, c in counts.items()}
    s12 = {cell: c[0] for cell, c in counts.items()}
    return s36, s12, unplaced


def load_tracts(path: Path) -> tuple[list[str], np.ndarray]:
    table = pq.read_table(path, columns=["geoid", "geometry"])
    keep = [
        (g, w)
        for g, w in zip(
            table.column("geoid").to_pylist(), table.column("geometry").to_pylist(), strict=True
        )
        if g and w
    ]
    return [g for g, _ in keep], shapely.from_wkb([w for _, w in keep])


def tracts_of(points: np.ndarray, geoids: list[str], shapes: np.ndarray) -> list[str | None]:
    """The tract each point falls in (the first, for a point exactly on a border)."""
    found: list[str | None] = [None] * len(points)
    if len(shapes) == 0:
        return found
    point_index, tract_index = STRtree(shapes).query(points, predicate="intersects")
    for p, t in sorted(zip(point_index.tolist(), tract_index.tolist(), strict=True)):
        if found[p] is None:
            found[p] = geoids[t]
    return found


def poverty_by_tract(path: Path) -> dict[str, float]:
    table = pq.read_table(path, columns=["geoid", "poverty_pct"])
    return {
        g: float(p)
        for g, p in zip(
            table.column("geoid").to_pylist(), table.column("poverty_pct").to_pylist(), strict=True
        )
        if g and p is not None
    }


def canopy_by_cell(path: Path) -> dict[str, float]:
    table = pq.read_table(path, columns=["h3", "canopy_2018_m2"])
    return dict(
        zip(table.column("h3").to_pylist(), table.column("canopy_2018_m2").to_pylist(), strict=True)
    )


def land_by_cell(
    cells: Sequence[str], city: np.ndarray | None, water: np.ndarray
) -> dict[str, float]:
    """Square meters of land in each cell: inside the city (the union of the tracts) and not
    water. Without tracts, the whole cell counts as city."""
    from placekeepers.adapters.lens_context import cell_polygon

    cells = list(cells)
    polygons = to_meters(np.array([cell_polygon(c) for c in cells], dtype=object))
    if city is None or len(city) == 0:
        inside = shapely.area(polygons)
    else:
        inside = _overlap(polygons, to_meters(city))
    wet = _overlap(polygons, to_meters(water)) if len(water) else np.zeros(len(cells))
    return {c: max(float(i - w), 0.0) for c, i, w in zip(cells, inside, wet, strict=True)}


def _overlap(cells: np.ndarray, shapes: np.ndarray) -> np.ndarray:
    """For each cell, the area it shares with the shapes (which must not overlap each other)."""
    out = np.zeros(len(cells))
    shapes = shapes.copy()
    invalid = ~shapely.is_valid(shapes)
    if invalid.any():
        shapes[invalid] = shapely.make_valid(shapes[invalid])
    cell_index, shape_index = STRtree(shapes).query(cells, predicate="intersects")
    areas = shapely.area(shapely.intersection(cells[cell_index], shapes[shape_index]))
    np.add.at(out, cell_index, areas)
    return out


def water_shapes(path: Path | None) -> np.ndarray:
    """Planning's water polygons (land use code 81)."""
    if path is None:
        return np.array([], dtype=object)
    table = pq.read_table(path, columns=["c_dig2", "geometry"], filters=[("c_dig2", "=", WATER)])
    shapes = [w for w in table.column("geometry").to_pylist() if w is not None]
    return shapely.from_wkb(shapes) if shapes else np.array([], dtype=object)


def poverty_note(
    tracts: Sequence[str | None],
    rates: Sequence[float | None],
    have_tracts: bool,
    have_rates: bool,
) -> str | None:
    """A note counting every parcel with no poverty rate, and why (finding F11): outside every
    census tract, or in a tract the survey gives no estimate for (people in no household, such
    as a park or the airport). None when every parcel has one, or when a whole source is
    missing (the missing source note covers that)."""
    if not (have_tracts and have_rates):
        return None
    outside = sum(1 for t in tracts if t is None)
    no_estimate = sum(1 for t, r in zip(tracts, rates, strict=True) if t is not None and r is None)
    if not outside and not no_estimate:
        return None
    parts = []
    if outside:
        parts.append(f"{outside:,} outside every census tract")
    if no_estimate:
        parts.append(f"{plural(no_estimate, 'in a tract', 'in tracts')} with no survey estimate")
    total = plural(outside + no_estimate, "parcel on the map has", "parcels on the map have")
    return f"{total} no poverty rate: " + " and ".join(parts)


# The run


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> LensResult:
    """Compute the factors for every parcel of the vacancy model's output and write
    $PK_CACHE/derived/lens_factors.parquet (or `out`) with a JSON summary beside it."""
    started = time.monotonic()
    as_of = as_of or ctx.today()
    model = model_path(ctx)
    if not model.is_file():
        raise RuntimeError("The lens needs the vacancy model first (pk derive)")
    parcels = load_parcels(model)
    paths = {
        source_id: current_snapshot(ctx, source_id) for source_id in (*SOURCES, "li_violations")
    }
    missing = [s for s in FEEDS if paths[s] is None]
    notes: list[str] = []

    # Untreated vacancy
    fixed = doors_fixed(paths["li_violations"])
    treated_by = [
        treatment(kind, lc, opa in fixed)
        for opa, kind, lc in zip(parcels.opa, parcels.kind, parcels.landcare, strict=True)
    ]
    f_vacant = [0 if t else 100 for t in treated_by]

    # Shootings nearby
    s36_near: list[int | None] = [None] * len(parcels)
    s12_near: list[int | None] = [None] * len(parcels)
    if paths["shootings"] is not None:
        s36, s12, _ = shootings_by_cell(paths["shootings"], as_of)
        s36_near = [int(ring_sum(c, s36)) for c in parcels.cells]
        s12_near = [int(ring_sum(c, s12)) for c in parcels.cells]

    # Poverty in the tract
    tracts: list[str | None] = [None] * len(parcels)
    city: np.ndarray | None = None
    if paths["census_tracts_2020"] is not None:
        geoids, city = load_tracts(paths["census_tracts_2020"])
        tracts = tracts_of(parcels.points, geoids, city)
    poverty_pct: list[float | None] = [None] * len(parcels)
    if paths["acs_poverty"] is not None:
        rates = poverty_by_tract(paths["acs_poverty"])
        poverty_pct = [None if t is None else rates.get(t) for t in tracts]
    note = poverty_note(tracts, poverty_pct, city is not None, paths["acs_poverty"] is not None)
    if note:
        notes.append(note)

    # Tree canopy nearby
    canopy_pct: list[float | None] = [None] * len(parcels)
    if paths["tree_canopy_2018"] is not None:
        canopy = canopy_by_cell(paths["tree_canopy_2018"])
        needed = sorted({c for cell in set(parcels.cells) for c in ring_cells(cell)})
        land = land_by_cell(needed, city, water_shapes(paths["land_use"]))
        for i, cell in enumerate(parcels.cells):
            area = ring_sum(cell, land)
            if area > 0:
                canopy_pct[i] = round(min(100.0, 100.0 * ring_sum(cell, canopy) / area), 2)

    columns = {
        "opa": parcels.opa,
        "f_vacant": f_vacant,
        "f_shoot": rank_or_none(s36_near),
        "f_poverty": rank_or_none(poverty_pct),
        # Less canopy ranks higher: the share of parcels with strictly more canopy.
        "f_canopy": rank_or_none([None if c is None else -c for c in canopy_pct]),
        "treated": treated_by,
        "h3": parcels.cells,
        "shot_36m_near": s36_near,
        "shot_12m_near": s12_near,
        "tract": tracts,
        "poverty_pct": poverty_pct,
        "canopy_2018_pct_near": canopy_pct,
    }
    types = {
        "opa": pa.string(),
        "f_vacant": pa.int16(),
        "f_shoot": pa.int16(),
        "f_poverty": pa.int16(),
        "f_canopy": pa.int16(),
        "treated": pa.string(),
        "h3": pa.string(),
        "shot_36m_near": pa.int32(),
        "shot_12m_near": pa.int32(),
        "tract": pa.string(),
        "poverty_pct": pa.float64(),
        "canopy_2018_pct_near": pa.float64(),
    }
    table = pa.table({name: pa.array(values, types[name]) for name, values in columns.items()})
    out = out or output_path(ctx)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    for source_id in missing:
        notes.append(
            f"The violence lens ran without {source_id}, so {FEEDS[source_id]} is left out"
        )
    if paths["land_use"] is None and paths["tree_canopy_2018"] is not None:
        notes.append("The violence lens ran without land_use, so water counts as land for f_canopy")
    result = LensResult(
        path=out,
        as_of=as_of.isoformat(),
        parcels=len(parcels),
        spread={name: spread(columns[name]) for name in FACTORS},
        treated={
            "landcare": treated_by.count("landcare"),
            "doors_and_windows": treated_by.count("doors_and_windows"),
        },
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info("derive: lens factors for %s parcels in %.0f s", f"{len(parcels):,}", result.seconds)
    return result


def load_factors(path: Path) -> dict[str, dict[str, int]]:
    """The factors per OPA account, without the ones a parcel has no data for."""
    if not path.is_file():
        return {}
    table = pq.read_table(path, columns=["opa", *FACTORS])
    columns = {name: table.column(name).to_pylist() for name in ("opa", *FACTORS)}
    return {
        opa: {name: int(columns[name][i]) for name in FACTORS if columns[name][i] is not None}
        for i, opa in enumerate(columns["opa"])
    }
