"""Dossier shards and the owners table (docs/CONTRACTS.md sections 2 and 6).

For every candidate parcel (placekeepers.candidates: on either City vacancy list, owned by the
City, the Land Bank, the Redevelopment Authority or PHDC, in PHS LandCare, vacant land or a vacant
exterior to the assessor, cleaned and sealed or demolished since 2016, or on the unsafe or
imminently dangerous lists) and every parcel the map shows, the pipeline writes what the lot
dossier shows: the address, the vacancy call, the owner (names and mailing address as the City
publishes them, the owner type and the flags of docs/ETHICS.md), every deed newest first, the
assessments by year, an L&I summary, the legal routes, the suggestions, and a few nearby counts.

Written under the data root:

    dossiers/<first four digits of the OPA account>.json    the parcels, one file per prefix
    dossiers/common.json  the parts of each flag that are the same for every parcel (its careful
                          note, next step, routes, links and sources) and the notices, fetched once
    tables/owners.json    every organization holding many vacant parcels, with each parcel's
                          account, address, kind and confidence, so "this owner's list" needs no
                          other file. An owner who may be a person is never listed there: each of
                          their parcels carries their other parcels in its own many_parcels flag
                          (docs/VERIFICATION.md D3)

The vacancy call is the vacancy model's (placekeepers.derive.vacancy), read from the same file
the lots layer reads, so the dossier and the map always agree; without the model, both show the
City's lists alone.

Nothing that docs/ETHICS.md rules out is ever written: no acquisition price estimate, no score or
order of how easy a parcel would be to take, no letters (tests/test_dossiers.py checks every key).
Case numbers, contractor and applicant names never reach the dossiers either.
"""

from __future__ import annotations

import json
import logging
import math
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import h3
import numpy as np
import pyarrow as pa
import pyarrow.dataset as ds
import pyarrow.parquet as pq
import shapely
from shapely import STRtree

from placekeepers.candidates import candidate_accounts
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive import city_list
from placekeepers.derive import owners as ow
from placekeepers.derive import transfers as tr
from placekeepers.derive.flags import (
    FLAG_NOTES,
    HELP_ROUTES,
    MANY_PARCELS_MIN,
    NOTICES,
    LiSummary,
    OwnerFacts,
    TaxDebt,
    owner_flags,
    person_like,
    shows_deed_fraud_notice,
)
from placekeepers.derive.heat import load_heat, with_heat
from placekeepers.derive.heat import output_path as heat_output
from placekeepers.derive.placemaking import load_placemaking, with_more
from placekeepers.derive.placemaking import output_path as placemaking_output
from placekeepers.derive.routes import first_route_code, routes_for, suggestions_for
from placekeepers.derive.vacancy import REASONS
from placekeepers.derive.vacancy import output_path as vacancy_output
from placekeepers.health import SourceStatus
from placekeepers.publish.layers import (
    H3_RESOLUTION,
    PARCEL_SOURCES,
    SHOWN_KINDS,
    aggregate_shootings,
    opa_account,
    parcel_kind,
)
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

SCHEMA = 1
DOSSIER_DIR = "dossiers"
COMMON_FILE = "dossiers/common.json"
OWNERS_TABLE = "tables/owners.json"
#: shards are named by this many leading digits of the OPA account: about 920 files, the largest
#: about 700 parcels, small enough to open one lot on a phone
SHARD_DIGITS = 4
#: the sources a dossier draws on; opa_properties is required, the rest are used when present
REQUIRED = ("opa_properties",)
OPTIONAL = (
    "city_owned_property",
    "real_estate_transfers",
    "assessment_history",
    "li_violations",
    "li_unsafe",
    "li_imminently_dangerous",
    "li_clean_and_seal",
    "li_demolitions",
    "cagp_tax_2025",
    "phs_landcare",
    "gardens_phs_ngt",
    "gardens_registered",
    "land_use",
    "pwd_parcels",
    "shootings",
    "vacant_indicators_land",
    "vacant_indicators_bldg",
)
#: The parts of a dossier whose records are downloaded only for the candidate parcels
#: (placekeepers.candidates), with the source each comes from. A dossier lists in `partial` the
#: parts it was not built from, so the lot page never says "No deeds on record." or shows zero
#: violations for a parcel whose records were never downloaded (docs/VERIFICATION.md D9).
CANDIDATE_PARTS = (
    ("transfers", "real_estate_transfers", "deeds"),
    ("assessments", "assessment_history", "assessments"),
    ("li", "li_violations", "violations"),
)
#: The map style of the lots layer, whose features carry each parcel's lens factors (`f_*`) and
#: floodplain mark (`fp`), docs/CONTRACTS.md section 4.
LOTS_STYLE = "vacant_parcels"
#: 500 feet in meters, for the nearby counts
NEARBY_M = 152.4
#: how close a garden point must be to a parcel's shape to call the parcel gardened
GARDEN_M = 5.0
#: the Planning Commission's land use code for community gardens and farms
COMMUNITY_AGRICULTURE = 712
LANDCARE_PROGRAMS = {
    "PLC": "landcare",
    "CLC": "community_landcare",
    "LANDBANK": "land_bank",
    "PHDC": "phdc",
}

#: The reason bit the vacancy model sets for a parcel PHS LandCare keeps up, by account or by its
#: shape (the map's `lc`). The routes count it too, so a lot the map marks as LandCare lists
#: Community LandCare first, in its dossier and in the map's `rt` alike.
LANDCARE_BIT = next(1 << reason.bit for reason in REASONS if reason.id == "landcare")


def in_landcare(account: str, by_account: set[str] | dict, call: dict[str, Any] | None) -> bool:
    """A LandCare lot: PHS's record names the account, or the vacancy model marks it."""
    return account in by_account or bool(call and call.get("rs", 0) & LANDCARE_BIT)


# Meters per degree near Philadelphia (latitude 40), for short distances.
M_PER_DEG_LAT = 111_000.0
M_PER_DEG_LNG = 111_000.0 * math.cos(math.radians(40.0))


def account_sql(column: str) -> str:
    """SQL for a column's OPA account as 9 digits (the first run of 8 or 9 digits, padded)."""
    digits = f"regexp_extract(CAST({column} AS VARCHAR), '[0-9]{{8,9}}')"
    return f"CASE WHEN {digits} <> '' THEN lpad({digits}, 9, '0') END"


@dataclass
class DossierResult:
    parcels: int = 0
    shards: int = 0
    bytes: int = 0
    #: the largest shard, dossiers/common.json and tables/owners.json, in bytes
    largest: int = 0
    common_bytes: int = 0
    owners_bytes: int = 0
    #: organizations in tables/owners.json, and owners who may be people listed on their own
    #: parcels' pages instead
    owners_listed: int = 0
    people_listed: int = 0
    notes: list[str] = field(default_factory=list)
    #: the account prefixes that have a shard, sorted
    prefixes: list[str] = field(default_factory=list)
    #: counts for the report: owner types, flags, routes
    owner_types: Counter = field(default_factory=Counter)
    flags: Counter = field(default_factory=Counter)
    routes: Counter = field(default_factory=Counter)
    #: dossiers built without some records (their `partial`), by part, and in all
    partial: Counter = field(default_factory=Counter)

    def manifest_block(self) -> dict[str, Any] | None:
        """The manifest's `dossiers` summary (docs/CONTRACTS.md section 3), or None when no
        dossiers were written."""
        if not self.shards:
            return None
        return {
            "prefix_digits": SHARD_DIGITS,
            "prefixes": self.prefixes,
            "files": self.shards,
            "bytes": self.bytes,
        }


def snapshot_paths(
    ctx: Context, statuses: dict[str, SourceStatus], source_ids: Iterable[str]
) -> dict[str, Path]:
    paths = {}
    for source_id in source_ids:
        status = statuses.get(source_id)
        if status is not None and status.snapshot is not None:
            paths[source_id] = SnapshotStore(ctx.cache, source_id).path_for(status.snapshot)
    return paths


# Reading the sources
def _rows(con: Any, sql: str) -> list[tuple]:
    return con.execute(sql).fetchall()


def _source(path: Path, wanted: Iterable[str]) -> str:
    """SQL for a snapshot with exactly the `wanted` columns; a column the snapshot lacks reads as
    NULL, so a source that drops an optional column cannot break the dossiers."""
    names = set(pq.read_schema(path).names)
    select = ", ".join(name if name in names else f"NULL AS {name}" for name in wanted)
    return f"(SELECT {select} FROM read_parquet({quote_literal(str(path))}))"


def read_columns(path: Path, wanted: list[str], where: tuple[str, Any] | None = None) -> pa.Table:
    """A snapshot's `wanted` columns, a missing one as nulls. `where` is a column and a pyarrow
    filter on it; when the snapshot lacks that column, no rows are kept."""
    names = set(pq.read_schema(path).names)
    if where is not None and where[0] not in names:
        return pa.table({name: pa.nulls(0) for name in wanted})
    present = [name for name in wanted if name in names]
    table = ds.dataset(path).to_table(
        columns=present, filter=where[1] if where is not None else None
    )
    for name in wanted:
        if name not in names:
            table = table.append_column(name, pa.nulls(table.num_rows))
    return table.select(wanted)


#: confidence levels at which we call a parcel vacant for the owner's count of vacant parcels and
#: for conservatorship; a low confidence parcel may be someone's home
CONFIDENT = frozenset({"high", "medium"})
CITY_LIST_BITS = {1: 1, 2: 2}  # reason bits 0 (city_land) and 1 (city_building)


def vacancy_calls(ctx: Context, paths: dict[str, Path]) -> dict[str, dict[str, Any]]:
    """The vacancy block of every parcel the map shows, from the vacancy model's output (the file
    the lots layer reads), so the dossier and the map always agree: kind, confidence, the reason
    bits `rs`, the agreeing signals `n`, and the years `dy`, `sy` and `ny` when present. A parcel
    the model leaves out (parks, gardens, parking and the like) has none.

    When the model has not run, the map shows the City's lists alone, and so do the dossiers:
    medium confidence, the list bits in `rs`, `n` 0."""
    model = vacancy_output(ctx)
    calls: dict[str, dict[str, Any]] = {}
    if model.is_file():
        names = ["opa", "kind", "k", "confidence", "rs", "n", "dy", "sy", "ny"]
        table = read_columns(model, names)
        for opa, kind, k, confidence, rs, n, dy, sy, ny in zip(
            *(table.column(name).to_pylist() for name in names), strict=True
        ):
            if kind not in SHOWN_KINDS or confidence is None or opa is None:
                continue
            block: dict[str, Any] = {
                "kind": "lot" if k == 1 else "building",
                "confidence": confidence,
                "rs": int(rs or 0),
                "n": int(n or 0),
            }
            for key, year in (("dy", dy), ("sy", sy), ("ny", ny)):
                if year is not None:
                    block[key] = int(year)
            calls[opa] = block
        return calls
    kinds: dict[str, set[int]] = defaultdict(set)
    descriptions: dict[str, str] = {}
    for source_id, kind in PARCEL_SOURCES:
        if source_id not in paths:
            continue
        table = read_columns(paths[source_id], ["opa_id", "bldg_desc"])
        for opa_id, description in zip(
            table.column("opa_id").to_pylist(), table.column("bldg_desc").to_pylist(), strict=True
        ):
            account = opa_account(opa_id)
            if account is None:
                continue
            kinds[account].add(kind)
            if description:
                descriptions.setdefault(account, description)
    for account, found in kinds.items():
        kind = "lot" if parcel_kind(found, descriptions.get(account)) == 1 else "building"
        rs = sum(CITY_LIST_BITS[k] for k in found)
        calls[account] = {"kind": kind, "confidence": "medium", "rs": rs, "n": 0}
    return calls


@dataclass
class Opa:
    location: str | None
    names: list[str]
    mailing: str | None
    mailing_street: str | None
    mailing_city_state: str | None
    mailing_zip: str | None
    sale_date: date | None
    sale_price: float | None
    lat: float | None
    lng: float | None
    #: an owner occupied homestead exemption: the City's record that someone lives there (or did)
    homestead: bool = False


OPA_COLUMNS = (
    "parcel_number",
    "location",
    "owner_1",
    "owner_2",
    "mailing_care_of",
    "mailing_address_1",
    "mailing_address_2",
    "mailing_street",
    "mailing_city_state",
    "mailing_zip",
    "sale_date",
    "sale_price",
    "lat",
    "lng",
    "homestead_exemption",
)


def read_opa(con: Any, path: Path) -> dict[str, Opa]:
    rows = _rows(
        con,
        f"""SELECT {", ".join(OPA_COLUMNS)}
            FROM {_source(path, OPA_COLUMNS)} WHERE parcel_number IN (SELECT a FROM acc)""",
    )
    out = {}
    for (
        account,
        location,
        owner_1,
        owner_2,
        care_of,
        line_1,
        line_2,
        street,
        city_state,
        zip_code,
        sale_date,
        sale_price,
        lat,
        lng,
        homestead,
    ) in rows:
        last_line = " ".join(part for part in (city_state, zip_code) if part) or None
        out[account] = Opa(
            location=" ".join(location.split()) if location else None,
            names=[" ".join(name.split()) for name in (owner_1, owner_2) if name and name.strip()],
            mailing=ow.mailing_text([care_of, line_1, line_2, street, last_line]),
            mailing_street=street,
            mailing_city_state=city_state,
            mailing_zip=zip_code,
            sale_date=sale_date,
            sale_price=sale_price,
            lat=lat,
            lng=lng,
            homestead=bool(homestead and homestead > 0),
        )
    return out


def read_city_owned(con: Any, path: Path) -> dict[str, dict[str, Any]]:
    """Each parcel on the City's list of public property: its agency, its status (an available
    one when any of its records has one), whether it may go to the neighbor as a side yard, whether
    the land agencies list it as available, and its address (derive.city_list)."""
    account = account_sql("opabrt")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, agency, status_1, sideyardeligible, location
            FROM {_source(path, ["opabrt", "agency", "status_1", "sideyardeligible", "location"])}
            WHERE {account} IS NOT NULL""",
    )
    return {
        a: {
            "agency": found.agency,
            "status": found.status,
            "side_yard": found.side_yard,
            "available": found.available,
            "location": found.location,
        }
        for a, found in city_list.by_account(rows).items()
    }


TRANSFER_COLUMNS = (
    "opa_account_num",
    "document_id",
    "document_type",
    "display_date",
    "document_date",
    "recording_date",
    "grantors",
    "grantees",
    "adjusted_total_consideration",
    "total_consideration",
    "property_count",
)


def read_transfers(con: Any, path: Path) -> dict[str, list[tr.Transfer]]:
    """Deeds with the date and price the City's property page shows: the date on the deed (its
    `display_date`, else the document date, else the recording date) and the adjusted total (this
    property's share when one deed covered several), else the total consideration. A snapshot made
    before those columns were fetched reads as the older ones."""
    account = account_sql("opa_account_num")
    day = "COALESCE(display_date, document_date, recording_date)"
    rows = _rows(
        con,
        f"""SELECT {account} AS a, document_id, document_type, {day} AS day, grantors, grantees,
                   COALESCE(adjusted_total_consideration, total_consideration) AS price,
                   property_count
            FROM {_source(path, TRANSFER_COLUMNS)}
            WHERE {day} IS NOT NULL
              AND (document_type LIKE '%DEED%' OR document_type = 'CERTIFICATE OF STOCK TRANSFER')
              AND {account} IN (SELECT a FROM acc)""",
    )
    grouped: dict[str, list[tr.Transfer]] = defaultdict(list)
    for a, doc_id, doc_type, day, grantors, grantees, price, count in rows:
        grouped[a].append(
            tr.Transfer(
                document_id=doc_id,
                date=day,
                type=" ".join((doc_type or "").split()),
                price=price,
                grantors=tuple(tr.split_names(grantors)),
                grantees=tuple(tr.split_names(grantees)),
                properties=int(count or 1),
            )
        )
    return {a: tr.deeds(rows) for a, rows in grouped.items()}


def read_assessments(con: Any, path: Path) -> dict[str, list[list[int | None]]]:
    """[year, market value] pairs, newest year first."""
    account = account_sql("parcel_number")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, year, max(market_value)
            FROM {_source(path, ["parcel_number", "year", "market_value"])}
            WHERE year IS NOT NULL AND {account} IN (SELECT a FROM acc)
            GROUP BY 1, 2 ORDER BY 1, 2 DESC""",
    )
    out: dict[str, list[list[int | None]]] = defaultdict(list)
    for a, year, value in rows:
        out[a].append([int(year), None if value is None else int(value)])
    return out


VIOLATION_COLUMNS = (
    "opa_account_num",
    "violationnumber",
    "violationstatus",
    "violationdate",
    "violationcodetitle",
)


def read_violations(con: Any, path: Path) -> dict[str, LiSummary]:
    account = account_sql("opa_account_num")
    rows = _rows(
        con,
        f"""SELECT {account} AS a,
                   count(DISTINCT violationnumber),
                   count(DISTINCT violationnumber) FILTER (WHERE violationstatus = 'OPEN'),
                   max(violationdate),
                   max(violationdate) FILTER (WHERE violationstatus = 'OPEN'),
                   arg_max(violationcodetitle, violationdate)
                       FILTER (WHERE violationstatus = 'OPEN')
            FROM {_source(path, VIOLATION_COLUMNS)}
            WHERE {account} IN (SELECT a FROM acc) GROUP BY 1""",
    )
    return {
        a: LiSummary(
            open_violations=int(n_open or 0),
            last_violation=last_any,
            last_open=last_open,
            last_open_title=" ".join(title.split()) if title else None,
            violations=int(n or 0),
        )
        for a, n, n_open, last_any, last_open, title in rows
    }


def read_first_dates(
    con: Any, path: Path, column: str, where: str = "true", extra: tuple[str, ...] = ()
) -> dict[str, date]:
    """The earliest date in `column` per account (for the unsafe and imminently dangerous lists,
    whose rows are the open cases). `extra` names the other columns `where` uses."""
    account = account_sql("opa_account_num")
    source = _source(path, ["opa_account_num", column, *extra])
    rows = _rows(
        con,
        f"""SELECT {account} AS a, min({column}) FROM {source}
            WHERE {where} AND {account} IN (SELECT a FROM acc) GROUP BY 1""",
    )
    return {a: day for a, day in rows}


def read_last_dates(
    con: Any, path: Path, column: str, where: str, extra: tuple[str, ...] = ()
) -> dict[str, date]:
    """The latest date in `column` per account, among rows meeting `where` (which may use the
    columns named in `extra`)."""
    account = account_sql("opa_account_num")
    source = _source(path, ["opa_account_num", column, *extra])
    rows = _rows(
        con,
        f"""SELECT {account} AS a, max({column}) FROM {source}
            WHERE {where} AND {column} IS NOT NULL AND {account} IN (SELECT a FROM acc)
            GROUP BY 1""",
    )
    return {a: day for a, day in rows}


def read_tax(con: Any, path: Path) -> dict[str, TaxDebt]:
    rows = _rows(
        con,
        f"""SELECT opa_id, total_due, num_years_owed
            FROM {_source(path, ["opa_id", "total_due", "num_years_owed"])}
            WHERE total_due > 0 AND opa_id IN (SELECT a FROM acc)""",
    )
    return {a: TaxDebt(float(total), int(years) if years else None) for a, total, years in rows}


# Places: LandCare, gardens, shootings
def to_xy(lng: Any, lat: Any) -> tuple[Any, Any]:
    """Longitude and latitude to meters on a local flat grid (fine within a city)."""
    return lng * M_PER_DEG_LNG, lat * M_PER_DEG_LAT


def wkb_column(table: Any, name: str = "geometry") -> Any:
    return shapely.from_wkb(table.column(name).to_numpy(zero_copy_only=False))


def read_landcare(path: Path) -> tuple[dict[str, dict[str, Any]], Any]:
    """LandCare lots by account (program and year joined), and the centroid of every lot."""
    table = read_columns(path, ["brt_id", "program", "year", "geometry"])
    shapes = wkb_column(table)
    lots = {}
    for brt_id, program, year in zip(
        table.column("brt_id").to_pylist(),
        table.column("program").to_pylist(),
        table.column("year").to_pylist(),
        strict=True,
    ):
        account = opa_account(brt_id)
        if account is None:
            continue
        entry: dict[str, Any] = {
            "program": LANDCARE_PROGRAMS.get(str(program or "").strip().upper(), "other")
        }
        text = str(year or "").strip()
        if text.isdigit() and 1950 <= int(text) <= 2100:
            entry["year"] = int(text)
        lots.setdefault(account, entry)
    valid = shapes[~shapely.is_missing(shapes) & ~shapely.is_empty(shapes)]
    return lots, shapely.centroid(valid)


def read_garden_points(paths: dict[str, Path]) -> Any:
    """Every garden PHS or the Neighborhood Gardens Trust supports, and every garden registered
    with Parks and Recreation, as points."""
    points: list[Any] = []
    for source_id in ("gardens_phs_ngt", "gardens_registered"):
        if source_id in paths:
            shapes = wkb_column(read_columns(paths[source_id], ["geometry"]))
            points.extend(shapes[~shapely.is_missing(shapes) & ~shapely.is_empty(shapes)])
    return shapely.centroid(np.asarray(points, dtype=object))


def read_community_agriculture(path: Path) -> list[Any]:
    """The Planning Commission's community garden and farm areas (land use code 712)."""
    table = read_columns(
        path, ["geometry"], ("c_dig3", ds.field("c_dig3") == COMMUNITY_AGRICULTURE)
    )
    shapes = wkb_column(table)
    return list(shapes[~shapely.is_missing(shapes) & ~shapely.is_empty(shapes)])


def read_parcel_shapes(path: Path, accounts: set[str]) -> dict[str, Any]:
    table = read_columns(
        path, ["brt_id", "geometry"], ("brt_id", ds.field("brt_id").isin(sorted(accounts)))
    )
    out = {}
    for brt_id, shape in zip(table.column("brt_id").to_pylist(), wkb_column(table), strict=True):
        if shape is not None and not shapely.is_empty(shape):
            out[brt_id] = shape
    return out


def gardened_accounts(
    shapes: dict[str, Any],
    points: dict[str, tuple[float, float]],
    garden_points: Any,
    garden_areas: list[Any],
) -> set[str]:
    """Parcels already used as gardens: a garden point within 5 meters of the parcel's shape, or
    the parcel's point inside a community agriculture area of the land use map."""
    found: set[str] = set()
    if shapes and len(garden_points):
        accounts = list(shapes)
        tree = STRtree([shapes[a] for a in accounts])
        pad = GARDEN_M / M_PER_DEG_LNG
        for point in garden_points:
            for index in tree.query(point.buffer(pad)):
                if shapes[accounts[index]].distance(point) <= pad:
                    found.add(accounts[index])
    if points and garden_areas:
        tree = STRtree(garden_areas)
        for account, (lng, lat) in points.items():
            point = shapely.Point(lng, lat)
            if len(tree.query(point, predicate="within")):
                found.add(account)
    return found


class PointGrid:
    """Counts points within a radius of a place, on a square grid of cells as wide as the radius."""

    def __init__(self, xs: Iterable[float], ys: Iterable[float], radius: float):
        self.radius = radius
        self.cells: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
        for x, y in zip(xs, ys, strict=True):
            self.cells[(int(x // radius), int(y // radius))].append((x, y))

    def count(self, x: float, y: float) -> int:
        cx, cy = int(x // self.radius), int(y // self.radius)
        total = 0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for px, py in self.cells.get((cx + dx, cy + dy), ()):
                    if (px - x) ** 2 + (py - y) ** 2 <= self.radius**2:
                        total += 1
        return total


def point_grid(points: Any) -> PointGrid | None:
    if points is None or not len(points):
        return None
    xs, ys = to_xy(shapely.get_x(points), shapely.get_y(points))
    return PointGrid(xs.tolist(), ys.tolist(), NEARBY_M)


def shooting_cells(path: Path, as_of: date) -> dict[str, list[int]]:
    table = read_columns(path, ["lat", "lng", "date_"])
    rows = zip(
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("date_").to_pylist(),
        strict=True,
    )
    counts, _ = aggregate_shootings(rows, as_of)
    return counts


# Owner type and route codes for the map tiles
def owner_facts(paths: dict[str, Path], accounts: set[str]) -> dict[str, tuple[ow.OwnerType, bool]]:
    """The owner type and whether OPA names an owner, for each account OPA or the City owned
    property layer knows: the same inputs build_dossiers uses."""
    agencies: dict[str, str] = {}
    if "city_owned_property" in paths:
        table = read_columns(paths["city_owned_property"], ["opabrt", "agency"])
        for opabrt, agency in zip(
            table.column("opabrt").to_pylist(), table.column("agency").to_pylist(), strict=True
        ):
            account = opa_account(opabrt)
            if account in accounts and agency:
                agencies[account] = min(agencies.get(account, agency), agency)
    names: dict[str, list[str]] = {}
    if "opa_properties" in paths:
        table = read_columns(
            paths["opa_properties"],
            ["parcel_number", "owner_1", "owner_2"],
            ("parcel_number", ds.field("parcel_number").isin(sorted(accounts))),
        )
        for account, owner_1, owner_2 in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            names[account] = [n for n in (owner_1, owner_2) if n and n.strip()]
    return {
        account: (
            ow.owner_type(names.get(account, []), agencies.get(account)),
            bool(names.get(account)),
        )
        for account in names.keys() | agencies.keys()
    }


def listed_available_accounts(paths: dict[str, Path], accounts: set[str]) -> set[str]:
    """The accounts the City's land agencies list as available (the lots layer's `la`, issue #36),
    by the rule the dossiers use (derive.city_list)."""
    if "city_owned_property" not in paths:
        return set()
    table = read_columns(paths["city_owned_property"], ["opabrt", "status_1"])
    return {
        account
        for opabrt, status in zip(
            table.column("opabrt").to_pylist(), table.column("status_1").to_pylist(), strict=True
        )
        if (account := opa_account(opabrt)) in accounts and city_list.listed_available(status)
    }


def owner_type_codes(paths: dict[str, Path], accounts: set[str]) -> dict[str, int]:
    """The `ot` code (docs/CONTRACTS.md section 4) for each account, from OPA's owner names and
    the City owned property layer; accounts with neither are left out (0, unknown)."""
    return {account: found.code for account, (found, _) in owner_facts(paths, accounts).items()}


def route_codes(
    paths: dict[str, Path],
    accounts: set[str],
    known_routes: set[str] | None = None,
    calls: dict[str, dict[str, Any]] | None = None,
) -> dict[str, int]:
    """The `rt` code (docs/CONTRACTS.md section 4) for each account: the first route its dossier
    lists, from the same owner type, owner names and LandCare record (routes.first_route_code,
    which passes over the side yard route, so the City list's status need not be read here).
    `calls` are the parcels' vacancy blocks (at least `rs`), as vacancy_calls gives them."""
    facts = owner_facts(paths, accounts)
    landcare = set(read_landcare(paths["phs_landcare"])[0]) if "phs_landcare" in paths else set()
    calls = calls or {}
    nobody = (ow.owner_type([], None), False)
    codes = {}
    for account in accounts:
        found, has_names = facts.get(account, nobody)
        cared_for = in_landcare(account, landcare, calls.get(account))
        routes = [
            route
            for route in routes_for(found, has_names=has_names, in_landcare=cared_for)
            if known_routes is None or route in known_routes
        ]
        codes[account] = first_route_code(routes, found.type)
    return codes


# Building the dossiers
def read_records(con: Any, paths: dict[str, Path]) -> dict[str, dict[str, Any]]:
    """Every per parcel record the dossiers use, read for the accounts in the table `acc`."""
    has = paths.__contains__
    return {
        "opa": read_opa(con, paths["opa_properties"]),
        "city": read_city_owned(con, paths["city_owned_property"])
        if has("city_owned_property")
        else {},
        "deeds": read_transfers(con, paths["real_estate_transfers"])
        if has("real_estate_transfers")
        else {},
        "assessments": read_assessments(con, paths["assessment_history"])
        if has("assessment_history")
        else {},
        "violations": read_violations(con, paths["li_violations"]) if has("li_violations") else {},
        "unsafe": read_first_dates(
            con,
            paths["li_unsafe"],
            "violationdate",
            "violationresolutiondate IS NULL",
            ("violationresolutiondate",),
        )
        if has("li_unsafe")
        else {},
        "dangerous": read_first_dates(
            con,
            paths["li_imminently_dangerous"],
            "violationdate",
            "violationresolutiondate IS NULL",
            ("violationresolutiondate",),
        )
        if has("li_imminently_dangerous")
        else {},
        "sealed": read_last_dates(
            con,
            paths["li_clean_and_seal"],
            "workordercompleteddate",
            "workorderstatus IN ('Approved', 'CLOSED', 'Conditional Approval')",
            ("workorderstatus",),
        )
        if has("li_clean_and_seal")
        else {},
        "demolished": read_last_dates(
            con, paths["li_demolitions"], "completed_date", "status = 'COMPLETED'", ("status",)
        )
        if has("li_demolitions")
        else {},
        "tax": read_tax(con, paths["cagp_tax_2025"]) if has("cagp_tax_2025") else {},
    }


def build_dossiers(
    ctx: Context, statuses: dict[str, SourceStatus], out_root: Path, as_of: date
) -> DossierResult:
    """Write every dossier shard and the owners table under `out_root`."""
    result = DossierResult()
    paths = snapshot_paths(ctx, statuses, (*REQUIRED, *OPTIONAL))
    missing = [source_id for source_id in REQUIRED if source_id not in paths]
    if missing:
        result.notes.append("lot dossiers have no usable data yet (no OPA properties)")
        log.warning("dossiers: no snapshot of %s", ", ".join(missing))
        return result
    # Every candidate parcel, and every parcel the map shows (the vacancy model reads records,
    # such as citywide complaints, that can reach beyond the candidates).
    vacancy = vacancy_calls(ctx, paths)
    candidates = candidate_accounts(ctx)
    accounts = sorted(set(candidates.accounts) | set(vacancy))
    if not accounts:
        result.notes.append("lot dossiers have no candidate parcels yet")
        return result
    log.info("dossiers: %s candidate parcels", f"{len(accounts):,}")

    con = ctx.duckdb()
    try:
        con.execute("CREATE TABLE acc AS SELECT unnest($1::VARCHAR[]) AS a", [accounts])
        records = read_records(con, paths)
    finally:
        con.close()
    opa: dict[str, Opa] = records["opa"]
    city: dict[str, dict[str, Any]] = records["city"]

    # An account neither OPA nor the City's property list knows is retired (merged or split
    # parcels in older L&I records): it has no address or owner to show.
    retired = [a for a in accounts if a not in opa and a not in city]
    if retired:
        accounts = [a for a in accounts if a in opa or a in city]
        result.notes.append(
            f"{len(retired):,} candidate accounts are no longer in OPA's records and get no "
            "lot dossier"
        )
    landcare, landcare_points = (
        read_landcare(paths["phs_landcare"]) if "phs_landcare" in paths else ({}, None)
    )
    garden_points = read_garden_points(paths)
    shootings = shooting_cells(paths["shootings"], as_of) if "shootings" in paths else None

    # Owner types first: the private owners decide which parcels need shapes and holdings.
    types: dict[str, ow.OwnerType] = {}
    for account in accounts:
        record = opa.get(account)
        agency = (city.get(account) or {}).get("agency")
        types[account] = ow.owner_type(record.names if record else [], agency)

    def is_private(account: str) -> bool:
        record = opa.get(account)
        kind = types[account].type
        return not types[account].public and (kind != "unknown" or bool(record and record.names))

    def confident(account: str) -> bool:
        call = vacancy.get(account)
        return call is not None and call["confidence"] in CONFIDENT

    private = {a for a in accounts if is_private(a)}
    points = {
        a: (record.lng, record.lat)
        for a, record in opa.items()
        if record.lat is not None and record.lng is not None
    }
    shapes = read_parcel_shapes(paths["pwd_parcels"], private) if "pwd_parcels" in paths else {}
    areas = read_community_agriculture(paths["land_use"]) if "land_use" in paths else []
    gardened = gardened_accounts(
        shapes, {a: points[a] for a in private if a in points}, garden_points, areas
    )
    landcare_grid = point_grid(landcare_points)
    garden_grid = point_grid(garden_points)

    # Owners with many vacant parcels: counted over the parcels we call vacant with high or
    # medium confidence.
    holdings: dict[str, list[str]] = defaultdict(list)
    keys: dict[str, str] = {}
    for account in accounts:
        record = opa.get(account)
        if account in private and record and record.names:
            key = ow.owner_key(record.names)
            if key:
                keys[account] = key
                if confident(account):
                    holdings[key].append(account)
    listed = {key: found for key, found in holdings.items() if len(found) >= MANY_PARCELS_MIN}
    # Owners who may be people are never in the citywide owners table: each of their parcels lists
    # their other parcels itself (docs/VERIFICATION.md D3).
    people = {
        key
        for key, found in listed.items()
        if person_like(types[found[0]], True, ow.possible_estate(opa[found[0]].names))
    }

    known_suggestions = set(ctx.registry.suggestions)
    # The heat and shade lens's suggestions (M3.1), as the lots layer lists them.
    heat = load_heat(heat_output(ctx))
    # And the placemaking lens's (M3.4), after them, as the lots layer lists them.
    placemaking = load_placemaking(placemaking_output(ctx))
    known_routes = set(ctx.registry.routes)
    downloaded_for = set(candidates.accounts)
    # The lens values each parcel's map tile carries, so a lot page opened from a link, a search or
    # a saved list shows the same score breakdown and flood note as one opened from the map
    # (issue #31).
    lot_lens = read_lot_lens(lots_layer_geojson(ctx, out_root))
    # The displacement watch area a lot on the map lies in, as its `dw` in the lots layer (M4.1).
    # Imported here: placekeepers.publish.displacement is loaded with the map layers.
    from placekeepers.publish.displacement import parcel_watch

    watch = parcel_watch(ctx.cache.root / "derived")

    def partial_parts(account: str) -> list[str]:
        """The parts whose records were not downloaded for this parcel: its source has no
        snapshot, or the parcel was not a candidate (and the snapshot holds nothing for it)."""
        return [
            part
            for part, source_id, kind in CANDIDATE_PARTS
            if source_id not in paths
            or (account not in downloaded_for and account not in records[kind])
        ]

    shards: dict[str, dict[str, Any]] = defaultdict(dict)
    for account in accounts:
        record = opa.get(account)
        owned = city.get(account)
        owner_type = types[account]
        partial = partial_parts(account)
        history = records["deeds"].get(account, [])
        facts = OwnerFacts(
            owner_type=owner_type,
            has_names=bool(record and record.names),
            history=history,
            tax=records["tax"].get(account),
            li=records["violations"].get(account, LiSummary()),
            called_vacant=confident(account),
            homestead=bool(record and record.homestead),
        )
        facts.li.unsafe_since = records["unsafe"].get(account)
        facts.li.dangerous_since = records["dangerous"].get(account)
        if record is not None:
            facts.absentee = ow.absentee(
                record.location,
                record.mailing_street,
                record.mailing_city_state,
                record.mailing_zip,
            )
            facts.possible_estate = ow.possible_estate(record.names)
            facts.last_sale = tr.last_sale(history, record.sale_date, record.sale_price, as_of)
        elif history:
            facts.last_sale = tr.last_sale(history, None, None, as_of)
        if "transfers" in partial and facts.last_sale is not None and not facts.last_sale.known:
            # "Not sold since" would rest on deeds that were never downloaded.
            facts.last_sale = None
        facts.resales = tr.fast_resales(history, as_of)
        key = keys.get(account)
        if key in listed:
            facts.holdings = len(listed[key])
            if key in people:
                facts.holdings_parcels = [
                    owner_list_entry(other, opa, vacancy)
                    for other in sorted(listed[key])
                    if other != account
                ]
            else:
                facts.holdings_list = ow.owner_list_id(key)
        flags = owner_flags(facts, as_of)

        owner: dict[str, Any] = {
            "names": record.names if record else [],
            "mailing": record.mailing if record else None,
            "type": owner_type.type,
            "type_reason": owner_type.reason,
        }
        if owned:
            owner["city_owned"] = {
                "agency": owned["agency"],
                "status": owned["status"],
                "side_yard_eligible": owned["side_yard"],
            }
            if owned["available"]:
                owner["city_owned"]["available"] = True
        owner["flags"] = flags
        if shows_deed_fraud_notice(facts):
            owner["notice"] = "deed_fraud"
        if flags and facts.private:
            owner["help"] = list(HELP_ROUTES)

        call = vacancy.get(account)
        routes = [
            route
            for route in routes_for(
                owner_type,
                has_names=facts.has_names,
                vacant=confident(account),
                side_yard_eligible=bool(owned and owned["side_yard"]),
                in_landcare=in_landcare(account, landcare, call),
                gardened=account in gardened,
                homestead=bool(record and record.homestead),
                listed_available=bool(owned and owned["available"]),
            )
            if route in known_routes
        ]
        dossier: dict[str, Any] = {
            "address": (record.location if record else None) or (owned or {}).get("location"),
            "vacancy": call,
            "owner": owner,
            "transfers": None if "transfers" in partial else [t.to_json() for t in history],
            "assessments": None
            if "assessments" in partial
            else records["assessments"].get(account, []),
            "li": li_summary(
                facts.li,
                records["sealed"].get(account),
                records["demolished"].get(account),
                violations_known="li" not in partial,
            ),
        }
        if partial:
            dossier["partial"] = partial
        dossier |= {
            "routes": routes,
            "suggestions": with_more(
                with_heat(
                    suggestions_for(call["kind"] if call else None, known_suggestions),
                    heat[account].suggestions if account in heat and call else [],
                    known_suggestions,
                ),
                placemaking[account].suggestions if account in placemaking and call else [],
                known_suggestions,
            ),
        }
        if account in landcare:
            dossier["landcare"] = landcare[account]
        if account in gardened:
            dossier["garden"] = True
        dossier["nearby"] = nearby_counts(
            points.get(account), shootings, landcare_grid, garden_grid
        )
        if account in lot_lens:
            dossier["lens"] = lot_lens[account]
        if account in watch:
            tract, signs = watch[account]
            dossier["displacement"] = {"tract": tract, "signs": signs}
        shards[account[:SHARD_DIGITS]][account] = dossier

        result.owner_types[owner_type.type] += 1
        for part in partial:
            result.partial[part] += 1
        result.partial["dossiers"] += bool(partial)
        for flag in flags:
            result.flags[flag["id"]] += 1
        if "notice" in owner:
            result.flags["deed_fraud_notice"] += 1
        for route in routes:
            result.routes[route] += 1

    generated_at = iso_z(ctx.now())
    write_shards(result, out_root, shards, generated_at)
    write_common(result, out_root, generated_at)
    organizations = {key: found for key, found in listed.items() if key not in people}
    write_owners_table(result, out_root, organizations, opa, vacancy, generated_at)
    result.people_listed = len(people)
    if candidates.missing:
        result.notes.append(
            "lot dossiers were built without " + ", ".join(sorted(candidates.missing))
        )
    if result.partial["dossiers"]:
        result.notes.append(
            f"{result.partial['dossiers']:,} lot dossiers lack records downloaded only for "
            f"candidate parcels (deeds {result.partial['transfers']:,}, assessments "
            f"{result.partial['assessments']:,}, violations {result.partial['li']:,}); their "
            "lot pages say so and offer live City data"
        )
    log.info(
        "dossiers: %s parcels in %s files (%.1f MB); many vacant parcels: %s organizations in "
        "the owners table, %s other owners listed on their own lot pages",
        f"{result.parcels:,}",
        result.shards,
        result.bytes / 1e6,
        result.owners_listed,
        result.people_listed,
    )
    return result


def lots_layer_geojson(ctx: Context, out_root: Path) -> Path | None:
    """Where publish has just written the lots layer as GeoJSON (it builds the map layers before
    the dossiers), or None when the registry has no lots layer."""
    for layer in ctx.registry.layers.values():
        if layer.style == LOTS_STYLE:
            file = Path(layer.file)
            return out_root / file.with_name(f"{file.stem}.{layer.source_layer}.geojson")
    return None


def read_lot_lens(path: Path | None) -> dict[str, dict[str, int]]:
    """Each parcel's lens factors (`f_*`) and floodplain mark (`fp`) exactly as its map tile
    carries them, by OPA account, read from the lots layer's GeoJSON (one feature per line). Every
    lens factor the layer gains is carried along without a change here."""
    found: dict[str, dict[str, int]] = {}
    if path is None or not path.is_file():
        return found
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip().rstrip(",")
            if not line.startswith('{"type":"Feature"'):
                continue
            properties = json.loads(line).get("properties") or {}
            values = {
                key: int(value)
                for key, value in properties.items()
                if (key.startswith("f_") or key == "fp") and isinstance(value, int | float)
            }
            if values and isinstance(properties.get("id"), str):
                found[properties["id"]] = values
    return found


def li_summary(
    li: LiSummary, sealed: date | None, demolished: date | None, *, violations_known: bool = True
) -> dict[str, Any]:
    """The L&I summary. Without the parcel's violation records (`violations_known` False, the
    dossier's `partial` names "li"), the violation counts and date are null, never 0; the unsafe,
    imminently dangerous, clean and seal and demolition lists are citywide and always known."""
    out: dict[str, Any] = {
        "open_violations": li.open_violations if violations_known else None,
        "last_violation": li.last_violation.isoformat()
        if violations_known and li.last_violation
        else None,
        "unsafe": li.unsafe_since is not None,
        "imminently_dangerous": li.dangerous_since is not None,
        "violations": li.violations if violations_known else None,
    }
    if li.unsafe_since:
        out["unsafe_since"] = li.unsafe_since.isoformat()
    if li.dangerous_since:
        out["imminently_dangerous_since"] = li.dangerous_since.isoformat()
    if sealed:
        out["sealed"] = sealed.isoformat()
    if demolished:
        out["demolished"] = demolished.isoformat()
    return out


def nearby_counts(
    point: tuple[float, float] | None,
    shootings: dict[str, list[int]] | None,
    landcare_grid: PointGrid | None,
    garden_grid: PointGrid | None,
) -> dict[str, int]:
    """Shooting victims in the parcel's hexagon (12 and 36 months), and LandCare lots and gardens
    within 500 feet. Empty when the parcel has no point."""
    if point is None:
        return {}
    lng, lat = point
    out: dict[str, int] = {}
    if shootings is not None:
        s12, s36 = shootings.get(h3.latlng_to_cell(lat, lng, H3_RESOLUTION), [0, 0])
        out["s12"], out["s36"] = s12, s36
    x, y = to_xy(lng, lat)
    if landcare_grid is not None:
        out["landcare_within_500ft"] = landcare_grid.count(x, y)
    if garden_grid is not None:
        out["gardens_within_500ft"] = garden_grid.count(x, y)
    return out


def write_shards(
    result: DossierResult, out_root: Path, shards: dict[str, dict[str, Any]], generated_at: str
) -> None:
    folder = out_root / DOSSIER_DIR
    folder.mkdir(parents=True, exist_ok=True)
    for prefix in sorted(shards):
        target = folder / f"{prefix}.json"
        body = {"schema": SCHEMA, "generated_at": generated_at, "parcels": shards[prefix]}
        target.write_text(dump(body), encoding="utf-8")
        size = target.stat().st_size
        result.bytes += size
        result.largest = max(result.largest, size)
        result.parcels += len(shards[prefix])
    result.shards = len(shards)
    result.prefixes = sorted(shards)


def write_common(result: DossierResult, out_root: Path, generated_at: str) -> None:
    """dossiers/common.json: each flag's careful note, next step, routes, links and sources, and
    the notices, which are the same for every parcel."""
    target = out_root / COMMON_FILE
    target.parent.mkdir(parents=True, exist_ok=True)
    body = {
        "schema": SCHEMA,
        "generated_at": generated_at,
        "flags": FLAG_NOTES,
        "notices": NOTICES,
    }
    target.write_text(dump(body), encoding="utf-8")
    result.common_bytes = target.stat().st_size


def owner_list_entry(
    account: str, opa: dict[str, Opa], vacancy: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    """One parcel of an owner's list: its account, address, and vacancy kind and confidence."""
    call = vacancy.get(account) or {}
    return {
        "id": account,
        "address": opa[account].location,
        "kind": call.get("kind"),
        "confidence": call.get("confidence"),
    }


def write_owners_table(
    result: DossierResult,
    out_root: Path,
    listed: dict[str, list[str]],
    opa: dict[str, Opa],
    vacancy: dict[str, dict[str, Any]],
    generated_at: str,
) -> None:
    """tables/owners.json: each listed organization's parcels with what "this owner's list"
    shows."""
    table = out_root / OWNERS_TABLE
    table.parent.mkdir(parents=True, exist_ok=True)
    owners = {
        ow.owner_list_id(key): {
            "names": opa[found[0]].names,
            "parcels": [owner_list_entry(account, opa, vacancy) for account in sorted(found)],
        }
        for key, found in listed.items()
    }
    body = {
        "schema": SCHEMA,
        "generated_at": generated_at,
        "min_parcels": MANY_PARCELS_MIN,
        "owners": dict(sorted(owners.items())),
    }
    table.write_text(dump(body), encoding="utf-8")
    result.owners_listed = len(listed)
    result.owners_bytes = table.stat().st_size


def dump(body: Any) -> str:
    return json.dumps(body, ensure_ascii=False, separators=(",", ":"))
