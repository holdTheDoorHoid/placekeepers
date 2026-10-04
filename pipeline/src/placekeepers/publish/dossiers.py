"""Dossier shards and the owners table (docs/CONTRACTS.md sections 2 and 6).

For every candidate parcel (placekeepers.candidates: on either City vacancy list, owned by the
City, the Land Bank, the Redevelopment Authority or PHDC, in PHS LandCare, vacant land or a vacant
exterior to the assessor, cleaned and sealed or demolished since 2016, or on the unsafe or
imminently dangerous lists), the pipeline writes what the lot dossier shows: the address, the
vacancy call, the owner (names and mailing address as the City publishes them, the owner type and
the flags of docs/ETHICS.md), every deed newest first, the assessments by year, an L&I summary,
the legal routes, the suggestions, and a few nearby counts.

Written under the data root:

    dossiers/<first three digits of the OPA account>.json    one file per prefix
    tables/owners.json    every private owner holding many vacant parcels, with the parcels, so a
                          flag can link to "this owner's list"

Nothing that docs/ETHICS.md rules out is ever written: no acquisition price estimate, no score or
order of how easy a parcel would be to take, no letters (tests/test_dossiers.py checks every key).
Case numbers, contractor and applicant names never reach the dossiers either.

Until the vacancy model (milestone M1.2) is merged, the vacancy call is the one the map shows: a
parcel on the City's land list is a lot, on its building list a building (both lists: the City's
own description decides), with medium confidence. `vacancy_calls` is the one place to replace.
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
import pyarrow.dataset as ds
import pyarrow.parquet as pq
import shapely
from shapely import STRtree

from placekeepers.candidates import candidate_accounts
from placekeepers.config import iso_z
from placekeepers.context import Context
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
    shows_deed_fraud_notice,
)
from placekeepers.derive.routes import routes_for, suggestions_for
from placekeepers.health import SourceStatus
from placekeepers.publish.layers import (
    H3_RESOLUTION,
    PARCEL_SOURCES,
    aggregate_shootings,
    opa_account,
    parcel_kind,
)
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

SCHEMA = 1
DOSSIER_DIR = "dossiers"
OWNERS_TABLE = "tables/owners.json"
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
    owners_listed: int = 0
    notes: list[str] = field(default_factory=list)
    #: counts for the report: owner types, flags, routes
    owner_types: Counter = field(default_factory=Counter)
    flags: Counter = field(default_factory=Counter)
    routes: Counter = field(default_factory=Counter)


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


def _source(path: Path) -> str:
    return f"read_parquet({quote_literal(str(path))})"


def vacancy_calls(paths: dict[str, Path]) -> dict[str, dict[str, Any]]:
    """The vacancy call for each parcel the map shows today: kind, confidence and reasons. The
    City's lists are the only signal until the vacancy model is merged (milestone M1.2)."""
    kinds: dict[str, set[int]] = defaultdict(set)
    descriptions: dict[str, str] = {}
    for source_id, kind in PARCEL_SOURCES:
        if source_id not in paths:
            continue
        table = pq.read_table(paths[source_id], columns=["opa_id", "bldg_desc"])
        for opa_id, description in zip(
            table.column("opa_id").to_pylist(), table.column("bldg_desc").to_pylist(), strict=True
        ):
            account = opa_account(opa_id)
            if account is None:
                continue
            kinds[account].add(kind)
            if description:
                descriptions.setdefault(account, description)
    calls = {}
    for account, found in kinds.items():
        reasons = []
        if 1 in found:
            reasons.append("City lists it as vacant land")
        if 2 in found:
            reasons.append("City lists it as a vacant building")
        kind = "lot" if parcel_kind(found, descriptions.get(account)) == 1 else "building"
        calls[account] = {"kind": kind, "confidence": "medium", "reasons": reasons}
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


def read_opa(con: Any, path: Path) -> dict[str, Opa]:
    rows = _rows(
        con,
        f"""SELECT parcel_number, location, owner_1, owner_2, mailing_care_of, mailing_address_1,
                   mailing_address_2, mailing_street, mailing_city_state, mailing_zip, sale_date,
                   sale_price, lat, lng
            FROM {_source(path)} WHERE parcel_number IN (SELECT a FROM acc)""",
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
        )
    return out


def read_city_owned(con: Any, path: Path) -> dict[str, dict[str, Any]]:
    account = account_sql("opabrt")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, min(agency), min(status_1),
                   bool_or(upper(trim(sideyardeligible)) = 'YES'), min(location)
            FROM {_source(path)} WHERE {account} IS NOT NULL GROUP BY 1""",
    )
    return {
        a: {"agency": agency, "status": status, "side_yard": bool(side), "location": location}
        for a, agency, status, side, location in rows
    }


def read_transfers(con: Any, path: Path) -> dict[str, list[tr.Transfer]]:
    account = account_sql("opa_account_num")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, document_id, document_type, recording_date, grantors, grantees,
                   total_consideration, property_count
            FROM {_source(path)}
            WHERE recording_date IS NOT NULL
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
            FROM {_source(path)}
            WHERE year IS NOT NULL AND {account} IN (SELECT a FROM acc)
            GROUP BY 1, 2 ORDER BY 1, 2 DESC""",
    )
    out: dict[str, list[list[int | None]]] = defaultdict(list)
    for a, year, value in rows:
        out[a].append([int(year), None if value is None else int(value)])
    return out


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
            FROM {_source(path)} WHERE {account} IN (SELECT a FROM acc) GROUP BY 1""",
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


def read_first_dates(con: Any, path: Path, column: str, where: str = "true") -> dict[str, date]:
    """The earliest date in `column` per account (for the unsafe and imminently dangerous lists,
    whose rows are the open cases)."""
    account = account_sql("opa_account_num")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, min({column}) FROM {_source(path)}
            WHERE {where} AND {account} IN (SELECT a FROM acc) GROUP BY 1""",
    )
    return {a: day for a, day in rows}


def read_last_dates(con: Any, path: Path, column: str, where: str) -> dict[str, date]:
    account = account_sql("opa_account_num")
    rows = _rows(
        con,
        f"""SELECT {account} AS a, max({column}) FROM {_source(path)}
            WHERE {where} AND {column} IS NOT NULL AND {account} IN (SELECT a FROM acc)
            GROUP BY 1""",
    )
    return {a: day for a, day in rows}


def read_tax(con: Any, path: Path) -> dict[str, TaxDebt]:
    rows = _rows(
        con,
        f"""SELECT opa_id, total_due, num_years_owed FROM {_source(path)}
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
    table = pq.read_table(path, columns=["brt_id", "program", "year", "geometry"])
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
            shapes = wkb_column(pq.read_table(paths[source_id], columns=["geometry"]))
            points.extend(shapes[~shapely.is_missing(shapes) & ~shapely.is_empty(shapes)])
    return shapely.centroid(np.asarray(points, dtype=object))


def read_community_agriculture(path: Path) -> list[Any]:
    """The Planning Commission's community garden and farm areas (land use code 712)."""
    dataset = ds.dataset(path)
    table = dataset.to_table(
        columns=["geometry"], filter=ds.field("c_dig3") == COMMUNITY_AGRICULTURE
    )
    shapes = wkb_column(table)
    return list(shapes[~shapely.is_missing(shapes) & ~shapely.is_empty(shapes)])


def read_parcel_shapes(path: Path, accounts: set[str]) -> dict[str, Any]:
    dataset = ds.dataset(path)
    table = dataset.to_table(
        columns=["brt_id", "geometry"], filter=ds.field("brt_id").isin(sorted(accounts))
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
    table = pq.read_table(path, columns=["lat", "lng", "date_"])
    rows = zip(
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("date_").to_pylist(),
        strict=True,
    )
    counts, _ = aggregate_shootings(rows, as_of)
    return counts


# Owner type codes for the map tiles
def owner_type_codes(paths: dict[str, Path], accounts: set[str]) -> dict[str, int]:
    """The `ot` code (docs/CONTRACTS.md section 4) for each account, from OPA's owner names and
    the City owned property layer; accounts with neither are left out (0, unknown)."""
    agencies: dict[str, str] = {}
    if "city_owned_property" in paths:
        table = pq.read_table(paths["city_owned_property"], columns=["opabrt", "agency"])
        for opabrt, agency in zip(
            table.column("opabrt").to_pylist(), table.column("agency").to_pylist(), strict=True
        ):
            account = opa_account(opabrt)
            if account in accounts and agency:
                agencies[account] = min(agencies.get(account, agency), agency)
    names: dict[str, list[str]] = {}
    if "opa_properties" in paths:
        dataset = ds.dataset(paths["opa_properties"])
        table = dataset.to_table(
            columns=["parcel_number", "owner_1", "owner_2"],
            filter=ds.field("parcel_number").isin(sorted(accounts)),
        )
        for account, owner_1, owner_2 in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            names[account] = [n for n in (owner_1, owner_2) if n and n.strip()]
    return {
        account: ow.owner_type(names.get(account, []), agencies.get(account)).code
        for account in names.keys() | agencies.keys()
    }


# Building the dossiers
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
    candidates = candidate_accounts(ctx)
    accounts = sorted(candidates.accounts)
    if not accounts:
        result.notes.append("lot dossiers have no candidate parcels yet")
        return result
    log.info("dossiers: %s candidate parcels", f"{len(accounts):,}")

    con = ctx.duckdb()
    try:
        con.execute("CREATE TABLE acc AS SELECT unnest($1::VARCHAR[]) AS a", [accounts])
        opa = read_opa(con, paths["opa_properties"])
        city = (
            read_city_owned(con, paths["city_owned_property"])
            if "city_owned_property" in paths
            else {}
        )
        deeds = (
            read_transfers(con, paths["real_estate_transfers"])
            if "real_estate_transfers" in paths
            else {}
        )
        assessments = (
            read_assessments(con, paths["assessment_history"])
            if "assessment_history" in paths
            else {}
        )
        violations = (
            read_violations(con, paths["li_violations"]) if "li_violations" in paths else {}
        )
        unsafe = (
            read_first_dates(
                con, paths["li_unsafe"], "violationdate", "violationresolutiondate IS NULL"
            )
            if "li_unsafe" in paths
            else {}
        )
        dangerous = (
            read_first_dates(
                con,
                paths["li_imminently_dangerous"],
                "violationdate",
                "violationresolutiondate IS NULL",
            )
            if "li_imminently_dangerous" in paths
            else {}
        )
        sealed = (
            read_last_dates(
                con,
                paths["li_clean_and_seal"],
                "workordercompleteddate",
                "workorderstatus IN ('Approved', 'CLOSED', 'Conditional Approval')",
            )
            if "li_clean_and_seal" in paths
            else {}
        )
        demolished = (
            read_last_dates(con, paths["li_demolitions"], "completed_date", "status = 'COMPLETED'")
            if "li_demolitions" in paths
            else {}
        )
        tax = read_tax(con, paths["cagp_tax_2025"]) if "cagp_tax_2025" in paths else {}
    finally:
        con.close()

    # An account neither OPA nor the City's property list knows is retired (merged or split
    # parcels in older L&I records): it has no address or owner to show.
    retired = [a for a in accounts if a not in opa and a not in city]
    if retired:
        accounts = [a for a in accounts if a in opa or a in city]
        result.notes.append(
            f"{len(retired):,} candidate accounts are no longer in OPA's records and get no "
            "lot dossier"
        )
    vacancy = vacancy_calls(paths)
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

    # Owners with many vacant parcels: counted over the parcels we call vacant.
    holdings: dict[str, list[str]] = defaultdict(list)
    keys: dict[str, str] = {}
    for account in accounts:
        record = opa.get(account)
        if account in private and record and record.names:
            key = ow.owner_key(record.names)
            if key:
                keys[account] = key
                if account in vacancy:
                    holdings[key].append(account)
    listed = {key: found for key, found in holdings.items() if len(found) >= MANY_PARCELS_MIN}

    known_suggestions = set(ctx.registry.suggestions)
    known_routes = set(ctx.registry.routes)
    shards: dict[str, dict[str, Any]] = defaultdict(dict)
    for account in accounts:
        record = opa.get(account)
        owned = city.get(account)
        owner_type = types[account]
        history = deeds.get(account, [])
        facts = OwnerFacts(
            owner_type=owner_type,
            has_names=bool(record and record.names),
            history=history,
            tax=tax.get(account),
            li=violations.get(account, LiSummary()),
        )
        facts.li.unsafe_since = unsafe.get(account)
        facts.li.dangerous_since = dangerous.get(account)
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
        facts.resales = tr.fast_resales(history, as_of)
        key = keys.get(account)
        if key in listed:
            facts.holdings = len(listed[key])
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
        owner["flags"] = flags
        if shows_deed_fraud_notice(facts, flags):
            owner["notice"] = "deed_fraud"
        if flags and facts.private:
            owner["help"] = list(HELP_ROUTES)

        call = vacancy.get(account)
        routes = [
            route
            for route in routes_for(
                owner_type,
                has_names=facts.has_names,
                vacant=call is not None,
                side_yard_eligible=bool(owned and owned["side_yard"]),
                in_landcare=account in landcare,
                gardened=account in gardened,
            )
            if route in known_routes
        ]
        li = facts.li
        li_out: dict[str, Any] = {
            "open_violations": li.open_violations,
            "last_violation": li.last_violation.isoformat() if li.last_violation else None,
            "unsafe": li.unsafe_since is not None,
            "imminently_dangerous": li.dangerous_since is not None,
            "violations": li.violations,
        }
        if li.unsafe_since:
            li_out["unsafe_since"] = li.unsafe_since.isoformat()
        if li.dangerous_since:
            li_out["imminently_dangerous_since"] = li.dangerous_since.isoformat()
        if account in sealed:
            li_out["sealed"] = sealed[account].isoformat()
        if account in demolished:
            li_out["demolished"] = demolished[account].isoformat()

        dossier: dict[str, Any] = {
            "address": (record.location if record else None) or (owned or {}).get("location"),
            "vacancy": call,
            "owner": owner,
            "transfers": [t.to_json() for t in history],
            "assessments": assessments.get(account, []),
            "li": li_out,
            "routes": routes,
            "suggestions": suggestions_for(call["kind"] if call else None, known_suggestions),
        }
        if account in landcare:
            dossier["landcare"] = landcare[account]
        if account in gardened:
            dossier["garden"] = True
        nearby: dict[str, int] = {}
        if account in points:
            lng, lat = points[account]
            if shootings is not None:
                cell = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
                s12, s36 = shootings.get(cell, [0, 0])
                nearby["s12"], nearby["s36"] = s12, s36
            x, y = to_xy(lng, lat)
            if landcare_grid is not None:
                nearby["landcare_within_500ft"] = landcare_grid.count(x, y)
            if garden_grid is not None:
                nearby["gardens_within_500ft"] = garden_grid.count(x, y)
        dossier["nearby"] = nearby
        shards[account[:3]][account] = dossier

        result.owner_types[owner_type.type] += 1
        for flag in flags:
            result.flags[flag["id"]] += 1
        if "notice" in owner:
            result.flags["deed_fraud_notice"] += 1
        for route in routes:
            result.routes[route] += 1

    generated_at = iso_z(ctx.now())
    folder = out_root / DOSSIER_DIR
    folder.mkdir(parents=True, exist_ok=True)
    for prefix in sorted(shards):
        target = folder / f"{prefix}.json"
        body = {
            "schema": SCHEMA,
            "generated_at": generated_at,
            "flags": FLAG_NOTES,
            "notices": NOTICES,
            "parcels": shards[prefix],
        }
        target.write_text(dump(body), encoding="utf-8")
        result.bytes += target.stat().st_size
    result.parcels = len(accounts)
    result.shards = len(shards)

    table = out_root / OWNERS_TABLE
    table.parent.mkdir(parents=True, exist_ok=True)
    owners_body = {
        "schema": SCHEMA,
        "generated_at": generated_at,
        "min_parcels": MANY_PARCELS_MIN,
        "owners": {
            ow.owner_list_id(key): {
                "names": opa[found[0]].names,
                "parcels": sorted(found),
            }
            for key, found in sorted(listed.items(), key=lambda item: ow.owner_list_id(item[0]))
        },
    }
    table.write_text(dump(owners_body), encoding="utf-8")
    result.owners_listed = len(listed)

    if candidates.missing:
        result.notes.append(
            "lot dossiers were built without " + ", ".join(sorted(candidates.missing))
        )
    log.info(
        "dossiers: %s parcels in %s files (%.1f MB), %s owners with many vacant parcels",
        f"{result.parcels:,}",
        result.shards,
        result.bytes / 1e6,
        result.owners_listed,
    )
    return result


def dump(body: Any) -> str:
    return json.dumps(body, ensure_ascii=False, separators=(",", ":"))
