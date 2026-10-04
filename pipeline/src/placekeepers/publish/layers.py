"""Build each map layer as GeoJSON from the current snapshots, with the short property names of
docs/CONTRACTS.md section 4.

* `hin` (streets): `id`, `name`, `len` (feet).
* `h3` (context): `h` (cell id), `s12` and `s36`, shooting victims in the 12 and 36 months up to the
  build date, per H3 cell at resolution 9 (about two blocks across). Only cells with at least one
  victim in the 36 month window are written. Counts only: no dates, no points, nothing about any
  person.
* `parcels` (lots): `id` (OPA account), `k` (1 vacant lot, 2 vacant building), `vc` (confidence;
  2, medium, while the City's indicator is the only signal), `ot` (owner type; 0, unknown, until
  owner types arrive), `lc` (1 when PHS LandCare maintains the parcel).
* `landcare` (care): `id` (OPA account, or empty), `p` (program: 1 LandCare, 2 Community LandCare,
  3 Land Bank lot, 4 PHDC lot, 0 other), `y` (year the lot joined, 0 when unknown).
* `gardens` (care): `nm` (name), `src` (1 PHS, 2 Neighborhood Gardens Trust, 3 both, 4 registered
  with Parks and Recreation), `w` (website, when there is one).
* `council_districts`, `rcos` and `neighborhoods` (boundaries): `nm` (a name to label it with),
  plus `d` (district number), `id` and `t` (the City's id and type for community organizations,
  `w` their website) and `id` (the neighborhood's code name).
"""

from __future__ import annotations

import calendar
import logging
import re
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
    #: at least one of these must have a usable snapshot
    sources: tuple[str, ...]
    build: Callable[[Context, dict[str, Path], Path, date], BuildResult]
    #: used when available, never required
    extras: tuple[str, ...] = ()


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
    """The 9 digit OPA account number, or None when the value holds none. Spaces and a second
    account ("121099030/9130") are ignored; an 8 digit account gets its leading zero back."""
    if value is None:
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    found = re.search(r"\d+", text)
    if not found or not 8 <= len(found.group()) <= 9:
        return None
    return found.group().zfill(9)


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
    landcare = landcare_accounts(paths.get("phs_landcare"))
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
            lc = 1 if account in landcare else 0
            properties = {"id": account, "k": kind, "vc": 2, "ot": 0, "lc": lc}
            writer.write(properties, geometry_json(shapes[account]))
    return BuildResult(writer.count, notes)


def landcare_accounts(path: Path | None) -> set[str]:
    if path is None:
        return set()
    table = pq.read_table(path, columns=["brt_id"])
    return {
        account for value in table.column("brt_id").to_pylist() if (account := opa_account(value))
    }


# Care already happening: PHS LandCare and gardens ----------------------------------------------

LANDCARE_PROGRAMS = {"PLC": 1, "CLC": 2, "LANDBANK": 3, "PHDC": 4}


def _year(value: object, as_of: date) -> int:
    text = str(value or "").strip()
    return int(text) if text.isdigit() and 1950 <= int(text) <= as_of.year + 1 else 0


def build_landcare(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["phs_landcare"], columns=["brt_id", "program", "year", "geometry"])
    with GeoJSONWriter(out) as writer:
        for brt_id, program, year, wkb in zip(
            *(table.column(name).to_pylist() for name in table.column_names), strict=True
        ):
            properties = {
                "id": opa_account(brt_id) or "",
                "p": LANDCARE_PROGRAMS.get(str(program or "").strip().upper(), 0),
                "y": _year(year, as_of),
            }
            writer.write(properties, geometry_json(wkb))
    return BuildResult(writer.count, [])


GARDEN_SUPPORT = {"PHS": 1, "NGT": 2, "PHS AND NGT": 3}


def _with_website(properties: dict, website: object) -> dict:
    text = str(website or "").strip()
    if text:
        properties["w"] = text
    return properties


def build_gardens(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        if "gardens_phs_ngt" in paths:
            table = pq.read_table(
                paths["gardens_phs_ngt"], columns=["site_name", "supported", "website", "geometry"]
            )
            for name, supported, website, wkb in zip(
                *(table.column(c).to_pylist() for c in table.column_names), strict=True
            ):
                src = GARDEN_SUPPORT.get(str(supported or "").strip().upper(), 1)
                writer.write(_with_website({"nm": name, "src": src}, website), geometry_json(wkb))
        if "gardens_registered" in paths:
            table = pq.read_table(
                paths["gardens_registered"], columns=["garden_name", "contact_website", "geometry"]
            )
            for name, website, wkb in zip(
                *(table.column(c).to_pylist() for c in table.column_names), strict=True
            ):
                writer.write(_with_website({"nm": name, "src": 4}, website), geometry_json(wkb))
    return BuildResult(writer.count, [])


# Boundaries --------------------------------------------------------------------------------------


def build_council_districts(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    table = pq.read_table(paths["council_districts"], columns=["district", "geometry"])
    with GeoJSONWriter(out) as writer:
        for district, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            number = int(str(district).strip())
            writer.write({"d": number, "nm": f"District {number}"}, geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


def build_rcos(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["community_organizations"],
        columns=["lni_id", "organization_name", "org_type", "websites", "geometry"],
    )
    with GeoJSONWriter(out) as writer:
        for lni_id, name, kind, website, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            properties = {"id": int(lni_id) if lni_id is not None else 0, "nm": name}
            if kind:
                properties["t"] = kind
            writer.write(_with_website(properties, website), geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


def build_neighborhoods(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    table = pq.read_table(paths["neighborhoods"], columns=["name", "listname", "geometry"])
    with GeoJSONWriter(out) as writer:
        for name, listname, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            writer.write({"id": name, "nm": listname or name}, geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        "tiles/lots.pmtiles",
        "parcels",
        ("vacant_indicators_land", "vacant_indicators_bldg"),
        build_parcels,
        extras=("phs_landcare",),
    ),
    LayerBuilder("tiles/streets.pmtiles", "hin", ("high_injury_network",), build_hin),
    LayerBuilder("tiles/context.pmtiles", "h3", ("shootings",), build_h3),
    LayerBuilder("tiles/care.pmtiles", "landcare", ("phs_landcare",), build_landcare),
    LayerBuilder(
        "tiles/care.pmtiles", "gardens", ("gardens_phs_ngt", "gardens_registered"), build_gardens
    ),
    LayerBuilder(
        "tiles/boundaries.pmtiles",
        "council_districts",
        ("council_districts",),
        build_council_districts,
    ),
    LayerBuilder("tiles/boundaries.pmtiles", "rcos", ("community_organizations",), build_rcos),
    LayerBuilder(
        "tiles/boundaries.pmtiles", "neighborhoods", ("neighborhoods",), build_neighborhoods
    ),
)


def builder_for(file: str, source_layer: str) -> LayerBuilder | None:
    for builder in BUILDERS:
        if builder.file == file and builder.source_layer == source_layer:
            return builder
    return None
