"""Build each map layer as GeoJSON from the current snapshots, with the short property names of
docs/CONTRACTS.md section 4.

* `hin` (streets): `id`, `name`, `len` (feet).
* `h3` (context): `h` (cell id), `s12` and `s36`, shooting victims in the 12 and 36 months up to the
  build date, per H3 cell at resolution 9 (about two blocks across). Only cells with at least one
  victim in the 36 month window are written. Counts only: no dates, no points, nothing about any
  person.
* `parcels` (lots): `id` (OPA account), `k` (1 vacant lot, 2 vacant building), `vc` (confidence;
  2, medium, while the City's indicator is the only signal), `ot` (owner type; 0, unknown, until
  owner types arrive), `lc` (LandCare; 0 until that source arrives).
"""

from __future__ import annotations

import calendar
import logging
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import h3
import pyarrow.parquet as pq
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

from placekeepers.context import Context
from placekeepers.geo import GeoJSONWriter, geometry_json

log = logging.getLogger(__name__)

H3_RESOLUTION = 9

# Generous box around Philadelphia. Points outside it are data errors (for example 0, 0).
PHILLY_LAT = (39.80, 40.20)
PHILLY_LNG = (-75.35, -74.90)


def months_before(day: date, months: int) -> date:
    """The same calendar day `months` earlier, clamped to the end of shorter months."""
    index = day.year * 12 + (day.month - 1) - months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


@dataclass
class BuildResult:
    features: int
    notes: list[str]


@dataclass(frozen=True)
class LayerBuilder:
    file: str
    source_layer: str
    sources: tuple[str, ...]
    build: Callable[[Context, dict[str, Path], Path, date], BuildResult]


# High Injury Network
def build_hin(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["high_injury_network"], columns=["objectid", "stname", "length_ft", "geometry"]
    )
    rows = sorted(table.to_pylist(), key=lambda row: row["objectid"])
    with GeoJSONWriter(out) as writer:
        for row in rows:
            length = row["length_ft"]
            properties = {
                "id": int(row["objectid"]),
                "name": row["stname"],
                "len": None if length is None else round(length),
            }
            writer.write(properties, geometry_json(row["geometry"]))
    return BuildResult(writer.count, [])


# Shooting victims per H3 cell
def aggregate_shootings(
    rows: Iterable[tuple[float | None, float | None, date | None]],
    as_of: date,
    resolution: int = H3_RESOLUTION,
) -> tuple[dict[str, list[int]], int]:
    """Count victims per H3 cell: [s12, s36]. A victim counts in a window when its date is after
    the window start and on or before `as_of`. Returns the counts and how many dated rows inside
    the 36 month window had no usable point."""
    start12 = months_before(as_of, 12)
    start36 = months_before(as_of, 36)
    counts: dict[str, list[int]] = {}
    unplaced = 0
    for lat, lng, day in rows:
        if day is None or not (start36 < day <= as_of):
            continue
        if (
            lat is None
            or lng is None
            or not (PHILLY_LAT[0] <= lat <= PHILLY_LAT[1])
            or not (PHILLY_LNG[0] <= lng <= PHILLY_LNG[1])
        ):
            unplaced += 1
            continue
        cell = h3.latlng_to_cell(lat, lng, resolution)
        entry = counts.setdefault(cell, [0, 0])
        entry[1] += 1
        if day > start12:
            entry[0] += 1
    return counts, unplaced


def cell_polygon(cell: str) -> Polygon:
    ring = [(lng, lat) for lat, lng in h3.cell_to_boundary(cell)]
    return orient(Polygon(ring), sign=1.0)


def build_h3(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["shootings"], columns=["lat", "lng", "date_"])
    rows = zip(
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("date_").to_pylist(),
        strict=True,
    )
    counts, unplaced = aggregate_shootings(rows, as_of)
    notes = []
    if unplaced:
        notes.append(f"{unplaced} shooting victims in the last 36 months have no usable location")
        log.warning("h3: %s", notes[-1])
    with GeoJSONWriter(out) as writer:
        for cell in sorted(counts):
            s12, s36 = counts[cell]
            writer.write({"h": cell, "s12": s12, "s36": s36}, geometry_json(cell_polygon(cell)))
    return BuildResult(writer.count, notes)


# Vacant parcels
def opa_account(value: object) -> str | None:
    """The 9 digit OPA account number, or None when the value is not one."""
    if value is None:
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    if not text.isdigit() or len(text) > 9:
        return None
    return text.zfill(9)


PARCEL_SOURCES = (("vacant_indicators_land", 1), ("vacant_indicators_bldg", 2))


def parcel_kind(kinds: set[int], description: str | None) -> int:
    """1 for a vacant lot, 2 for a vacant building.

    About a thousand parcels are on both City lists with the same shape. Nearly all of them
    (947 of 966 on 2026-10-04) carry the City's own description "VAC LAND ...", so for a parcel
    on both lists that description decides: vacant land is a lot, anything else a building.
    """
    if len(kinds) == 1:
        return next(iter(kinds))
    if description and description.strip().upper().startswith("VAC LAND"):
        return 1
    return 2


def build_parcels(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    kinds: dict[str, set[int]] = {}
    shapes: dict[str, bytes] = {}
    descriptions: dict[str, str | None] = {}
    no_account = 0
    for source_id, kind in PARCEL_SOURCES:
        if source_id not in paths:
            continue
        table = pq.read_table(paths[source_id], columns=["opa_id", "bldg_desc", "geometry"])
        for opa_id, description, wkb in zip(
            table.column("opa_id").to_pylist(),
            table.column("bldg_desc").to_pylist(),
            table.column("geometry").to_pylist(),
            strict=True,
        ):
            if wkb is None:
                continue
            account = opa_account(opa_id)
            if account is None:
                no_account += 1
                continue
            kinds.setdefault(account, set()).add(kind)
            shapes.setdefault(account, wkb)
            if description:
                descriptions.setdefault(account, description)
    notes = []
    if no_account:
        notes.append(
            f"{no_account} vacancy indicator features have no OPA account number and are not shown"
        )
    both = [account for account, found in kinds.items() if len(found) > 1]
    if both:
        as_lots = sum(
            1 for account in both if parcel_kind(kinds[account], descriptions.get(account)) == 1
        )
        notes.append(
            f"{len(both)} parcels are on both City vacancy lists: {as_lots} shown as lots because "
            f"the City describes them as vacant land, {len(both) - as_lots} as buildings"
        )
    for note in notes:
        log.warning("parcels: %s", note)
    with GeoJSONWriter(out) as writer:
        for account in sorted(kinds):
            kind = parcel_kind(kinds[account], descriptions.get(account))
            properties = {"id": account, "k": kind, "vc": 2, "ot": 0, "lc": 0}
            writer.write(properties, geometry_json(shapes[account]))
    return BuildResult(writer.count, notes)


BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        "tiles/lots.pmtiles",
        "parcels",
        ("vacant_indicators_land", "vacant_indicators_bldg"),
        build_parcels,
    ),
    LayerBuilder("tiles/streets.pmtiles", "hin", ("high_injury_network",), build_hin),
    LayerBuilder("tiles/context.pmtiles", "h3", ("shootings",), build_h3),
)


def builder_for(file: str, source_layer: str) -> LayerBuilder | None:
    for builder in BUILDERS:
        if builder.file == file and builder.source_layer == source_layer:
            return builder
    return None
