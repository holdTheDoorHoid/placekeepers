"""Vacancy model v1: which parcels are probably vacant, as a lot or a building, how sure we are,
and why.

The rules are the ones the vacancy method study chose (milestone M0.5, docs/VACANCY_METHOD.md)
and DESIGN section 6 adopted. This module ports research/vacancy/spatial.py, build_signals.py and
rules.py to the pipeline's own snapshots, keeping their definitions and thresholds, so the study's
validation still describes what the map shows.

In short:

* The kind comes from the building footprint, not from which City list a parcel is on: no
  footprint, or a demolition with nothing built since, makes a lot; a standing footprint makes a
  building.
* Independent lot signals: the assessor's vacant land category, no footprint, a demolition with
  nothing built since, a vacant lot violation or complaint in two years, PHS LandCare.
* Independent building signals: a City clean and seal in five years, the unsafe or imminently
  dangerous list (each with no permit since), a vacant property violation or complaint in two
  years, the assessor's vacant or sealed exterior note.
* The City's indicator is a strong vote that is never enough alone for high. Its last good copy is
  used for twelve months after its own date, then dropped.
* Contradictions: Planning's land use map shows a use (a lot drops one level), a new construction
  permit (October 2021 to March 2025 makes a lot low; since April 2025 caps it at medium), any
  permit in two years (a building drops one level).
* Parks, gardens, parking, rail, transportation, utilities, cemeteries, water and streets never
  show as vacant. LandCare lots stay in, marked maintained.

Windows count back from the build date. On the study date (2026-10-04) they equal the study's fixed
dates: two years (2024-10-04), five years (2021-10-04), eighteen months (2025-04-04), and recent
demolitions from January 1 three years back (2023-01-01).

The study read PPR's urban agriculture points too (10 gardens); the pipeline does not fetch them, so
a handful of parcels next to those sites may differ.
"""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import duckdb

from placekeepers.cache import atomic_output, atomic_write_json
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.dates import months_before
from placekeepers.geo import geo_metadata
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

# Thresholds from the study (build_signals.py and spatial.py).
FP_LINKED_MIN_M2 = 10.0
LAND_USE_MAX_POINTS = 5000
GARDEN_DISTANCE_M = 5
MIN_PARCEL_M2 = 20
CITY_LIST_MAX_AGE_DAYS = 365

UTM = "'EPSG:4326', 'EPSG:26918', always_xy := true"

# Owners that are public bodies: a lot they own next to a house they own is not a side yard.
PUBLIC_OWNERS = (
    "CITY OF PHILA|LAND BANK|REDEVELOPMENT|HOUSING AUTH|PHILA HOUSING|PHDC|"
    "PHILADELPHIA HOUSING DEV|COMMONWEALTH|SCHOOL DIST"
)

LOT_SIGNALS = ["opa_vacant_land", "no_footprint", "demo_no_newcon", "lot_li_2y", "in_landcare"]
BLDG_SIGNALS = [
    "cs_recent_no_permit",
    "unsafe_no_permit",
    "idang_no_permit",
    "bldg_li_2y",
    "opa_ext_vacant",
]


@dataclass(frozen=True)
class Reason:
    bit: int
    flag: str
    id: str
    against: bool = False


#: The reasons a parcel carries, as bits of the tile property `rs` (docs/CONTRACTS.md section 4).
#: The web app turns each bit into a sentence. Never renumber: published tiles and links use them.
REASONS: tuple[Reason, ...] = (
    Reason(0, "city_land", "city_land"),
    Reason(1, "city_bldg", "city_building"),
    Reason(2, "opa_vacant_land", "assessor_vacant_land"),
    Reason(3, "no_footprint", "no_building"),
    Reason(4, "demo_no_newcon", "demolished"),
    Reason(5, "lot_li_2y", "vacant_lot_record"),
    Reason(6, "in_landcare", "landcare"),
    Reason(7, "cs_recent_no_permit", "sealed"),
    Reason(8, "unsafe_no_permit", "unsafe"),
    Reason(9, "idang_no_permit", "imminently_dangerous"),
    Reason(10, "bldg_li_2y", "vacant_building_record"),
    Reason(11, "opa_ext_vacant", "assessor_exterior"),
    Reason(12, "newcon_probably_built", "built_since", against=True),
    Reason(13, "newcon_planned", "construction_starting", against=True),
    Reason(14, "side_yard_likely", "side_yard", against=True),
    Reason(15, "lu_developed", "land_use_shows_use", against=True),
    Reason(16, "recent_permit", "recent_permit", against=True),
    Reason(17, "footprint_conflict", "building_stands", against=True),
)


@dataclass(frozen=True)
class Windows:
    """Dates the rules count from, all derived from the build date."""

    as_of: date

    @property
    def two_years_ago(self) -> date:
        return months_before(self.as_of, 24)

    @property
    def five_years_ago(self) -> date:
        return months_before(self.as_of, 60)

    @property
    def newcon_planned_since(self) -> date:
        return months_before(self.as_of, 18)

    @property
    def demo_trust_since(self) -> date:
        return date(self.as_of.year - 3, 1, 1)


# Each source the model reads, as a DuckDB view. A source without a usable snapshot becomes an
# empty view with these columns, so the model still runs (with less to go on) and says so.
VIEWS: dict[str, tuple[str, dict[str, str]]] = {
    "src_opa": (
        "opa_properties",
        {
            "parcel_number": "VARCHAR",
            "location": "VARCHAR",
            "unit": "VARCHAR",
            "category_code": "VARCHAR",
            "building_code_description": "VARCHAR",
            "owner_1": "VARCHAR",
            "total_livable_area": "DOUBLE",
            "year_built": "VARCHAR",
            "exterior_condition": "VARCHAR",
            "lat": "DOUBLE",
            "lng": "DOUBLE",
        },
    ),
    "src_pwd": (
        "pwd_parcels",
        {"parcelid": "BIGINT", "brt_id": "VARCHAR", "num_brt": "INTEGER", "geometry": "GEOMETRY"},
    ),
    "src_footprints": (
        "building_footprints",
        {"objectid": "BIGINT", "parcel_id_num": "VARCHAR", "geometry": "GEOMETRY"},
    ),
    "src_land_use": (
        "land_use",
        {
            "c_dig1": "INTEGER",
            "c_dig2": "INTEGER",
            "c_dig3": "INTEGER",
            "year": "INTEGER",
            "vacbldg": "VARCHAR",
            "geometry": "GEOMETRY",
        },
    ),
    "src_ppr": ("ppr_properties", {"official_name": "VARCHAR", "geometry": "GEOMETRY"}),
    "src_gardens_phs": ("gardens_phs_ngt", {"site_name": "VARCHAR", "geometry": "GEOMETRY"}),
    "src_gardens_ppr": ("gardens_registered", {"garden_name": "VARCHAR", "geometry": "GEOMETRY"}),
    "src_landcare": (
        "phs_landcare",
        {"program": "VARCHAR", "year": "VARCHAR", "brt_id": "VARCHAR", "geometry": "GEOMETRY"},
    ),
    "src_city_land": (
        "vacant_indicators_land",
        {
            "opa_id": "VARCHAR",
            "land_rank": "DOUBLE",
            "date_update": "TIMESTAMP",
            "geometry": "GEOMETRY",
        },
    ),
    "src_city_bldg": (
        "vacant_indicators_bldg",
        {
            "opa_id": "VARCHAR",
            "build_rank": "DOUBLE",
            "date_update": "TIMESTAMP",
            "geometry": "GEOMETRY",
        },
    ),
    "src_clean_seal": (
        "li_clean_and_seal",
        {
            "opa_account_num": "VARCHAR",
            "workorderstatus": "VARCHAR",
            "workordercompleteddate": "DATE",
        },
    ),
    "src_demolitions": (
        "li_demolitions",
        {
            "opa_account_num": "VARCHAR",
            "status": "VARCHAR",
            "typeofwork": "VARCHAR",
            "city_demo": "VARCHAR",
            "start_date": "DATE",
            "completed_date": "DATE",
        },
    ),
    "src_unsafe": ("li_unsafe", {"opa_account_num": "VARCHAR", "violationdate": "DATE"}),
    "src_imm_dang": (
        "li_imminently_dangerous",
        {"opa_account_num": "VARCHAR", "violationdate": "DATE"},
    ),
    "src_permits": (
        "li_permits",
        {
            "opa_account_num": "VARCHAR",
            "permitissuedate": "DATE",
            "permittype": "VARCHAR",
            "typeofwork": "VARCHAR",
        },
    ),
    "src_violations": (
        "li_violations",
        {
            "opa_account_num": "VARCHAR",
            "violationdate": "DATE",
            "violationcode": "VARCHAR",
            "violationcodetitle": "VARCHAR",
        },
    ),
    "src_complaints": (
        "li_complaints",
        {"opa_account_num": "VARCHAR", "complaintdate": "DATE", "complaintcode": "VARCHAR"},
    ),
}
REQUIRED_SOURCES = ("opa_properties",)
SOURCES = tuple(source_id for source_id, _ in VIEWS.values())


def opa9(expr: str) -> str:
    """SQL that normalizes an OPA account to 9 digits (as the study did)."""
    return f"lpad(regexp_replace(trim(CAST({expr} AS VARCHAR)), '[^0-9]', '', 'g'), 9, '0')"


def valid_opa(expr: str) -> str:
    digits = f"regexp_replace(trim(CAST({expr} AS VARCHAR)), '[^0-9]', '', 'g')"
    return f"({expr} IS NOT NULL AND length({digits}) BETWEEN 8 AND 9)"


def connect(ctx: Context) -> duckdb.DuckDBPyConnection:
    """DuckDB with the spatial extension. The model's joins need more memory than a download
    (PK_DERIVE_MEMORY, default 2GB; the full run peaks well under that)."""
    con = ctx.duckdb()
    con.execute(f"SET memory_limit = {quote_literal(os.environ.get('PK_DERIVE_MEMORY', '2GB'))}")
    try:
        con.execute("LOAD spatial")
    except duckdb.Error:
        con.execute("INSTALL spatial")
        con.execute("LOAD spatial")
    return con


def snapshot_paths(ctx: Context) -> dict[str, Path]:
    paths = {}
    for source_id in SOURCES:
        store = SnapshotStore(ctx.cache, source_id)
        meta = store.current()
        if meta is not None:
            paths[source_id] = store.path_for(meta)
    return paths


def create_views(con: duckdb.DuckDBPyConnection, paths: dict[str, Path]) -> list[str]:
    """One view per source. Returns the sources that had no snapshot (empty views)."""
    missing = []
    for view, (source_id, columns) in VIEWS.items():
        path = paths.get(source_id)
        if path is None:
            missing.append(source_id)
            select = ", ".join(f"NULL::{kind} AS {name}" for name, kind in columns.items())
            con.execute(f"CREATE VIEW {view} AS SELECT {select} WHERE false")
            continue
        source = f"read_parquet({quote_literal(str(path))})"
        kinds = {
            row[0]: row[1] for row in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()
        }
        parts = []
        for name, kind in columns.items():
            if name not in kinds:
                parts.append(f"NULL::{kind} AS {name}")
            elif kind == "GEOMETRY" and not kinds[name].upper().startswith("GEOMETRY"):
                parts.append(f"ST_GeomFromWKB({name}) AS {name}")
            elif kind == "GEOMETRY":
                parts.append(f"{name}::GEOMETRY AS {name}")
            else:
                parts.append(f"TRY_CAST({name} AS {kind}) AS {name}")
        con.execute(f"CREATE VIEW {view} AS SELECT {', '.join(parts)} FROM {source}")
    return missing


def build_spatial(con: duckdb.DuckDBPyConnection) -> None:
    """Footprints, land use, parks, gardens and LandCare per Water Department parcel, then per OPA
    account (research/vacancy/spatial.py). Areas are in square meters (UTM zone 18N)."""
    con.execute(f"""
        CREATE TABLE parcels AS
        SELECT parcelid,
               CASE WHEN brt_id IS NULL OR trim(brt_id) = '' THEN NULL
                    ELSE {opa9("brt_id")} END AS opa,
               num_brt,
               ST_Transform(geometry, {UTM}) AS g
        FROM src_pwd WHERE geometry IS NOT NULL
    """)
    con.execute("ALTER TABLE parcels ADD COLUMN area_m2 DOUBLE")
    con.execute("UPDATE parcels SET area_m2 = ST_Area(g)")
    con.execute("ALTER TABLE parcels ADD COLUMN pt GEOMETRY")
    con.execute("UPDATE parcels SET pt = ST_PointOnSurface(g)")

    con.execute(f"""
        CREATE TABLE fp AS
        SELECT objectid AS fid, TRY_CAST(parcel_id_num AS BIGINT) AS link_parcelid,
               ST_Transform(geometry, {UTM}) AS g
        FROM src_footprints WHERE geometry IS NOT NULL
    """)
    con.execute("ALTER TABLE fp ADD COLUMN area_m2 DOUBLE")
    con.execute("UPDATE fp SET area_m2 = ST_Area(g)")
    # Every parcel and footprint pair that touches, with the area they share.
    con.execute("""
        CREATE TABLE pairs AS
        SELECT p.parcelid, f.fid, f.area_m2 AS fp_area,
               ST_Area(ST_Intersection(p.g, f.g)) AS overlap
        FROM parcels p JOIN fp f ON ST_Intersects(p.g, f.g)
    """)
    con.execute("""
        CREATE TABLE fp_by_parcel AS
        SELECT parcelid,
               sum(overlap) AS fp_overlap_m2,
               max(overlap) AS fp_max_piece_m2,
               count(*) FILTER (WHERE overlap >= 0.5 * fp_area) AS fp_mostly_inside
        FROM pairs GROUP BY parcelid
    """)
    con.execute("""
        CREATE TABLE fp_link AS
        SELECT link_parcelid AS parcelid, count(*) AS fp_linked
        FROM fp WHERE link_parcelid IS NOT NULL GROUP BY 1
    """)
    con.execute("DROP TABLE pairs")
    con.execute("DROP TABLE fp")

    # Land use under the parcel's interior point. About 20 street right of way polygons have tens
    # of thousands of vertices and span the city; parcels do not sit in streets, so they are left
    # out.
    con.execute(f"""
        CREATE TABLE lu AS
        SELECT c_dig1 AS c1, c_dig2 AS c2, c_dig3 AS c3, year AS lu_year, vacbldg,
               ST_Transform(geometry, {UTM}) AS g
        FROM src_land_use
        WHERE geometry IS NOT NULL AND ST_NPoints(geometry) <= {LAND_USE_MAX_POINTS}
    """)
    con.execute("""
        CREATE TABLE lu_by_parcel AS
        SELECT p.parcelid, any_value(l.c1) AS lu_c1, any_value(l.c2) AS lu_c2,
               any_value(l.c3) AS lu_c3, any_value(l.lu_year) AS lu_year,
               any_value(l.vacbldg) AS lu_vacbldg
        FROM parcels p JOIN lu l ON ST_Within(p.pt, l.g) GROUP BY p.parcelid
    """)
    con.execute("DROP TABLE lu")

    con.execute(f"""
        CREATE TABLE ppr AS
        SELECT any_value(official_name) AS name, ST_Transform(geometry, {UTM}) AS g
        FROM src_ppr WHERE geometry IS NOT NULL GROUP BY geometry
    """)
    con.execute("""
        CREATE TABLE ppr_by_parcel AS
        SELECT p.parcelid, any_value(r.name) AS ppr_name
        FROM parcels p JOIN ppr r ON ST_Within(p.pt, r.g) GROUP BY p.parcelid
    """)
    con.execute(f"""
        CREATE TABLE gardens AS
        SELECT 'PHS or NGT' AS src, site_name AS name, ST_Transform(geometry, {UTM}) AS g
        FROM src_gardens_phs WHERE geometry IS NOT NULL
        UNION ALL
        SELECT 'Registered (PPR)', garden_name, ST_Transform(geometry, {UTM})
        FROM src_gardens_ppr WHERE geometry IS NOT NULL
    """)
    con.execute(f"""
        CREATE TABLE garden_by_parcel AS
        SELECT p.parcelid, string_agg(DISTINCT gd.src, '; ') AS garden_src,
               any_value(gd.name) AS garden_name
        FROM parcels p JOIN gardens gd ON ST_DWithin(p.g, gd.g, {GARDEN_DISTANCE_M})
        GROUP BY p.parcelid
    """)
    con.execute(f"""
        CREATE TABLE lc AS
        SELECT program, year, ST_Transform(geometry, {UTM}) AS g
        FROM src_landcare WHERE geometry IS NOT NULL
    """)
    con.execute("""
        CREATE TABLE lc_by_parcel AS
        SELECT p.parcelid, string_agg(DISTINCT l.program, '; ') AS lc_program,
               max(l.year) AS lc_year
        FROM parcels p JOIN lc l ON ST_Within(p.pt, l.g) GROUP BY p.parcelid
    """)

    # One row per OPA account: an account can sit on more than one Water Department parcel.
    con.execute("""
        CREATE TABLE sp AS
        SELECT p.opa, count(*) AS pwd_parcels, sum(p.area_m2) AS area_m2,
               sum(coalesce(f.fp_overlap_m2, 0)) AS fp_overlap_m2,
               max(coalesce(f.fp_max_piece_m2, 0)) AS fp_max_piece_m2,
               sum(coalesce(f.fp_mostly_inside, 0)) AS fp_mostly_inside,
               sum(coalesce(k.fp_linked, 0)) AS fp_linked,
               any_value(u.lu_c1) AS lu_c1, any_value(u.lu_c2) AS lu_c2,
               any_value(u.lu_c3) AS lu_c3,
               any_value(u.lu_year) AS lu_year, any_value(u.lu_vacbldg) AS lu_vacbldg,
               any_value(r.ppr_name) AS ppr_name, any_value(gd.garden_src) AS garden_src,
               any_value(gd.garden_name) AS garden_name, any_value(l.lc_program) AS lc_program,
               any_value(l.lc_year) AS lc_year
        FROM parcels p
        LEFT JOIN fp_by_parcel f USING (parcelid)
        LEFT JOIN fp_link k USING (parcelid)
        LEFT JOIN lu_by_parcel u USING (parcelid)
        LEFT JOIN ppr_by_parcel r USING (parcelid)
        LEFT JOIN garden_by_parcel gd USING (parcelid)
        LEFT JOIN lc_by_parcel l USING (parcelid)
        WHERE p.opa IS NOT NULL
        GROUP BY p.opa
    """)
    con.execute("ALTER TABLE sp ADD COLUMN has_footprint BOOLEAN")
    con.execute(
        "UPDATE sp SET has_footprint = fp_mostly_inside > 0 "
        f"OR (fp_linked > 0 AND fp_max_piece_m2 >= {FP_LINKED_MIN_M2})"
    )


@dataclass
class CityLists:
    land_date: date | None
    building_date: date | None
    use_land: bool
    use_building: bool


def city_lists(con: duckdb.DuckDBPyConnection, as_of: date) -> CityLists:
    """The City's lists and their dates. A list older than twelve months is no longer used."""
    land = con.execute("SELECT max(CAST(date_update AS DATE)) FROM src_city_land").fetchone()[0]
    bldg = con.execute("SELECT max(CAST(date_update AS DATE)) FROM src_city_bldg").fetchone()[0]

    def usable(day: date | None) -> bool:
        return day is not None and (as_of - day).days <= CITY_LIST_MAX_AGE_DAYS

    return CityLists(land, bldg, usable(land), usable(bldg))


def build_records(con: duckdb.DuckDBPyConnection, w: Windows, lists: CityLists) -> None:
    """Per account records from OPA, the City's lists and L&I (build_signals.py in the study)."""
    today = w.as_of.isoformat()
    con.execute(f"""
        CREATE TABLE opa AS
        SELECT {opa9("parcel_number")} AS opa, location AS address, unit,
               category_code AS cat, building_code_description AS bdesc, owner_1,
               lat AS opa_lat, lng AS opa_lon, exterior_condition AS ext_cond,
               total_livable_area AS livable_sqft, TRY_CAST(year_built AS INT) AS year_built
        FROM src_opa WHERE {valid_opa("parcel_number")}
    """)
    land_where = "true" if lists.use_land else "false"
    bldg_where = "true" if lists.use_building else "false"
    con.execute(f"""
        CREATE TABLE city_land AS
        SELECT {opa9("opa_id")} AS opa, max(land_rank) AS land_rank
        FROM src_city_land WHERE {valid_opa("opa_id")} AND {land_where} GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE city_bldg AS
        SELECT {opa9("opa_id")} AS opa, max(build_rank) AS build_rank
        FROM src_city_bldg WHERE {valid_opa("opa_id")} AND {bldg_where} GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE lc_attr AS
        SELECT {opa9("brt_id")} AS opa, string_agg(DISTINCT program, '; ') AS lc_program_attr
        FROM src_landcare WHERE {valid_opa("brt_id")} GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE cs AS
        SELECT {opa9("opa_account_num")} AS opa, max(workordercompleteddate) AS cs_last
        FROM src_clean_seal
        WHERE {valid_opa("opa_account_num")}
          AND workorderstatus IN ('Approved', 'CLOSED', 'Conditional Approval')
          AND workordercompleteddate IS NOT NULL
        GROUP BY 1
    """)
    # Completed demolitions of a whole building (tank removals excluded).
    con.execute(f"""
        CREATE TABLE demo AS
        SELECT {opa9("opa_account_num")} AS opa,
               max(coalesce(completed_date, start_date)) AS demo_last,
               bool_or(city_demo = 'YES') AS demo_city
        FROM src_demolitions
        WHERE {valid_opa("opa_account_num")} AND status = 'COMPLETED' AND typeofwork <> 'TANKRI'
          AND coalesce(completed_date, start_date) <= DATE '{today}'
        GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE unsafe_now AS
        SELECT {opa9("opa_account_num")} AS opa, min(violationdate) AS unsafe_since
        FROM src_unsafe WHERE {valid_opa("opa_account_num")} GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE idang_now AS
        SELECT {opa9("opa_account_num")} AS opa, min(violationdate) AS idang_since
        FROM src_imm_dang WHERE {valid_opa("opa_account_num")} GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE pm AS
        SELECT {opa9("opa_account_num")} AS opa, permitissuedate AS issued,
          CASE
            WHEN typeofwork ILIKE '%interior%demo%' OR typeofwork = 'INTERI' THEN 'reuse'
            WHEN permittype IN ('Demolition', 'BP_DEMO') OR typeofwork ILIKE '%demolition%'
                 OR typeofwork ILIKE '%make safe%'
                 OR typeofwork IN ('TANKRI', 'Tank Install/Removal', 'COMDEM')
                 THEN 'demo_or_make_safe'
            WHEN (permittype IN ('Residential Building', 'Building', 'Master Plan')
                  AND typeofwork ILIKE 'New Construction%')
                 OR permittype = 'BP_NEWCNST' THEN 'newcon_building'
            WHEN typeofwork ILIKE 'New Construction%' OR typeofwork = 'Foundation'
                 THEN 'newcon_trade'
            WHEN permittype ILIKE 'Zoning%' OR permittype LIKE 'ZP_%' THEN
                 CASE WHEN typeofwork ILIKE 'New construction%'
                           OR typeofwork IN ('NEWCON',
                                             'Combined Lot Line Relocation and New Development')
                      THEN 'newcon_zoning' ELSE 'zoning_other' END
            WHEN permittype IN ('Operations', 'OPS PERMIT', 'General', 'Site / Utility Permit')
                 THEN 'other'
            ELSE 'reuse'
          END AS kind
        FROM src_permits
        WHERE {valid_opa("opa_account_num")} AND permitissuedate IS NOT NULL
    """)
    con.execute("""
        CREATE TABLE pm_by AS
        SELECT opa,
               max(issued) FILTER (
                 WHERE kind IN ('newcon_building', 'newcon_trade', 'newcon_zoning'))
                 AS newcon_last,
               max(issued) FILTER (WHERE kind IN ('reuse', 'newcon_building', 'newcon_trade',
                                                  'newcon_zoning', 'zoning_other')) AS activity_last
        FROM pm GROUP BY opa
    """)
    con.execute(f"""
        CREATE TABLE v AS
        SELECT {opa9("opa_account_num")} AS opa,
          CASE
            WHEN violationcode IN ('10-715') OR violationcode LIKE '10-710%' THEN 'dumping_litter'
            WHEN violationcode = '9-3904' THEN 'vac_lot_license'
            WHEN violationcode = 'PM15-301' THEN 'vac_struct_land'
            WHEN violationcodetitle ILIKE '%VACAN%' THEN 'vac_bldg'
            ELSE 'other'
          END AS vk
        FROM src_violations
        WHERE {valid_opa("opa_account_num")}
          AND violationdate BETWEEN DATE '{w.two_years_ago}' AND DATE '{today}'
    """)
    con.execute("""
        CREATE TABLE v_by AS
        SELECT opa,
               count(*) FILTER (WHERE vk = 'vac_lot_license') AS v_vac_lot,
               count(*) FILTER (WHERE vk = 'vac_bldg') AS v_vac_bldg
        FROM v GROUP BY opa
    """)
    con.execute(f"""
        CREATE TABLE c_by AS
        SELECT {opa9("opa_account_num")} AS opa,
               count(*) FILTER (WHERE complaintcode = 'VL') AS c_vac_lot,
               count(*) FILTER (WHERE complaintcode IN ('VA', 'VO', 'BDNO')) AS c_vac_bldg
        FROM src_complaints
        WHERE {valid_opa("opa_account_num")}
          AND complaintdate BETWEEN DATE '{w.two_years_ago}' AND DATE '{today}'
        GROUP BY 1
    """)
    # Likely side yards: a private owner who also owns the lived in building next door.
    # Philadelphia numbers each side of a street by twos, so the neighbors of 1234 are 1232 and
    # 1236; ranges such as 1837-39 cover every number in between.
    con.execute("""
        CREATE TABLE addr AS
        WITH parsed AS (
          SELECT opa, upper(trim(owner_1)) AS own, coalesce(livable_sqft, 0) > 0 AS lived_in,
                 regexp_extract(address, '^([0-9]+)(-[0-9]+)?[A-Z]? +(.+)$', 3) AS street,
                 TRY_CAST(regexp_extract(address, '^([0-9]+)', 1) AS INT) AS lo,
                 regexp_extract(address, '^[0-9]+-([0-9]+)', 1) AS hi_tail
          FROM opa WHERE address IS NOT NULL AND unit IS NULL
        )
        SELECT opa, own, lived_in, street, lo,
               CASE WHEN hi_tail = '' OR hi_tail IS NULL THEN lo
                    ELSE TRY_CAST(left(CAST(lo AS VARCHAR), length(CAST(lo AS VARCHAR))
                                       - length(hi_tail)) || hi_tail AS INT)
               END AS hi
        FROM parsed WHERE street <> '' AND lo IS NOT NULL
    """)
    con.execute("""
        CREATE TABLE addr_n AS
        SELECT opa, own, lived_in, street,
               unnest(generate_series(lo, greatest(lo, coalesce(hi, lo)), 2)) AS n
        FROM addr WHERE coalesce(hi, lo) - lo BETWEEN 0 AND 40
    """)
    con.execute(f"""
        CREATE TABLE side_yard AS
        SELECT a.opa, true AS side_yard_likely
        FROM addr a JOIN addr_n b
          ON b.street = a.street AND (b.n = a.lo - 2 OR b.n = coalesce(a.hi, a.lo) + 2)
         AND b.opa <> a.opa AND b.own = a.own AND b.lived_in
        WHERE a.own IS NOT NULL
          AND NOT regexp_matches(a.own, '{PUBLIC_OWNERS}')
        GROUP BY a.opa
    """)


def build_signals(con: duckdb.DuckDBPyConnection, w: Windows) -> None:
    """The signal flags per account (research/vacancy/build_signals.py)."""
    con.execute("""
        CREATE TABLE s AS
        SELECT o.*, sp.* EXCLUDE (opa),
               cl.land_rank, cb.build_rank,
               cl.opa IS NOT NULL AS city_land, cb.opa IS NOT NULL AS city_bldg,
               la.lc_program_attr, cs.cs_last, demo.demo_last, demo.demo_city,
               un.unsafe_since, idg.idang_since, pm_by.* EXCLUDE (opa), v_by.* EXCLUDE (opa),
               c_by.* EXCLUDE (opa), coalesce(sy.side_yard_likely, false) AS side_yard_likely
        FROM opa o
        LEFT JOIN sp USING (opa)
        LEFT JOIN city_land cl USING (opa)
        LEFT JOIN city_bldg cb USING (opa)
        LEFT JOIN lc_attr la USING (opa)
        LEFT JOIN cs USING (opa)
        LEFT JOIN demo USING (opa)
        LEFT JOIN unsafe_now un USING (opa)
        LEFT JOIN idang_now idg USING (opa)
        LEFT JOIN pm_by USING (opa)
        LEFT JOIN v_by USING (opa)
        LEFT JOIN c_by USING (opa)
        LEFT JOIN side_yard sy USING (opa)
    """)
    con.execute("""
        CREATE TABLE sig AS
        SELECT *,
          -- The assessor's category code, not the description, which lags new construction.
          cat IN ('6', '12', '13') AND coalesce(livable_sqft, 0) = 0
            AND NOT (bdesc ILIKE '%PKG%' OR bdesc ILIKE '%PARKING%' OR bdesc ILIKE '%PARK'
                     OR bdesc ILIKE '%CAR LOT%') AS opa_vacant_land,
          cat NOT IN ('6', '12', '13') AND coalesce(livable_sqft, 0) > 0 AS opa_says_building,
          -- Land use codes: c2 51 transportation, 52 greened right of way, 71 park or open space
          -- (c3 712 community agriculture), 72 cemetery, 81 water, 91 vacant.
          (bdesc ILIKE '%PKG%' OR bdesc ILIKE '%PARKING%' OR bdesc ILIKE '%CAR LOT%'
            OR lu_c3 = 514) AS is_parking,
          (ppr_name IS NOT NULL OR bdesc ILIKE '%PARK'
            OR (lu_c2 = 71 AND coalesce(lu_c3, 0) <> 712)) AS is_park,
          (garden_src IS NOT NULL OR lu_c3 = 712) AS is_garden,
          (bdesc ILIKE '%RAILROAD%' OR bdesc ILIKE '%RAIL %' OR lu_c3 = 512) AS is_rail,
          (lu_c2 = 51 AND coalesce(lu_c3, 0) NOT IN (512, 514)) AS is_transport,
          (bdesc ILIKE '%UTIL%' OR lu_c3 = 314) AS is_utility,
          (bdesc ILIKE '%CEMETER%' OR lu_c2 = 72) AS is_cemetery,
          (lu_c2 IN (52, 81) OR lu_c3 = 511) AS is_water_or_row,
          ext_cond IN ('6', '7') AS opa_ext_vacant,
          coalesce(lc_program, lc_program_attr) AS landcare
        FROM s
    """)
    con.execute("ALTER TABLE sig ADD COLUMN excluded_use VARCHAR")
    con.execute("""
        UPDATE sig SET excluded_use = CASE
            WHEN is_park THEN 'park' WHEN is_garden THEN 'garden' WHEN is_parking THEN 'parking'
            WHEN is_rail THEN 'rail' WHEN is_transport THEN 'transportation'
            WHEN is_utility THEN 'utility' WHEN is_cemetery THEN 'cemetery'
            WHEN is_water_or_row THEN 'water or street' END
    """)
    con.execute(f"""
        CREATE TABLE signals AS
        SELECT *,
          (has_footprint = false AND excluded_use IS NULL AND area_m2 >= {MIN_PARCEL_M2}
             AND NOT opa_says_building) AS no_footprint,
          -- A demolition counts only if nothing was built since. OPA is slow to recode demolished
          -- houses, so a recent demolition counts even where OPA still describes a building.
          (demo_last IS NOT NULL AND (newcon_last IS NULL OR newcon_last < demo_last)
             AND NOT coalesce(year_built >= year(demo_last), false)
             AND (demo_last >= DATE '{w.demo_trust_since}' OR NOT opa_says_building))
            AS demo_no_newcon,
          -- A new construction permit from five years to eighteen months ago probably has a
          -- building by now; a more recent one means construction is planned or starting.
          (newcon_last >= DATE '{w.five_years_ago}'
             AND newcon_last < DATE '{w.newcon_planned_since}'
             AND (demo_last IS NULL OR newcon_last >= demo_last)) AS newcon_probably_built,
          (newcon_last >= DATE '{w.newcon_planned_since}'
             AND (demo_last IS NULL OR newcon_last >= demo_last)) AS newcon_planned,
          (lu_c2 IS NOT NULL AND lu_c2 NOT IN (91, 92)) AS lu_developed,
          (activity_last >= DATE '{w.two_years_ago}') AS recent_permit,
          (coalesce(v_vac_lot, 0) + coalesce(c_vac_lot, 0)) > 0 AS lot_li_2y,
          landcare IS NOT NULL AS in_landcare,
          (cs_last IS NOT NULL AND (activity_last IS NULL OR activity_last <= cs_last))
            AS cs_no_permit,
          (unsafe_since IS NOT NULL AND (activity_last IS NULL OR activity_last <= unsafe_since))
            AS unsafe_no_permit,
          (idang_since IS NOT NULL AND (activity_last IS NULL OR activity_last <= idang_since))
            AS idang_no_permit,
          (coalesce(v_vac_bldg, 0) + coalesce(c_vac_bldg, 0)) > 0 AS bldg_li_2y
        FROM sig
    """)
    # A seal counts only when recent (five years), with no permit since, and the building stands.
    con.execute("ALTER TABLE signals ADD COLUMN cs_recent_no_permit BOOLEAN")
    con.execute(f"""
        UPDATE signals SET cs_recent_no_permit = coalesce(
            cs_no_permit AND cs_last >= DATE '{w.five_years_ago}' AND has_footprint, false)
    """)
    lots = " + ".join(f"coalesce({c}, false)::INT" for c in LOT_SIGNALS)
    bldgs = " + ".join(f"coalesce({c}, false)::INT" for c in BLDG_SIGNALS)
    con.execute("ALTER TABLE signals ADD COLUMN n_lot_signals INT")
    con.execute(f"UPDATE signals SET n_lot_signals = {lots}")
    con.execute("ALTER TABLE signals ADD COLUMN n_bldg_signals INT")
    con.execute(f"UPDATE signals SET n_bldg_signals = {bldgs}")


STRONG_BLDG = (
    "(coalesce(cs_recent_no_permit, false) OR coalesce(unsafe_no_permit, false) "
    "OR coalesce(idang_no_permit, false))"
)
PHYSICAL_LOT = "(coalesce(no_footprint, false) OR coalesce(demo_no_newcon, false))"


def classify_sql(city_land: str = "city_land", city_bldg: str = "city_bldg") -> str:
    """The rule set (research/vacancy/rules.py): a select list giving `kind` (lot, lot_conflict,
    building or excluded) and `confidence` (high, medium, low). The City columns can be replaced,
    for example by false to see the map without the City's indicator."""
    lot_kind = """(has_footprint = false
                    OR (has_footprint AND coalesce(demo_no_newcon, false))
                    OR (has_footprint IS NULL AND coalesce(opa_vacant_land, false)))"""
    lot_any = f"(coalesce({city_land}, false) OR n_lot_signals >= 1)"
    bldg_any = f"(coalesce({city_bldg}, false) OR n_bldg_signals >= 1)"
    city_land = f"coalesce({city_land}, false)"
    city_bldg = f"coalesce({city_bldg}, false)"
    return f"""
      CASE
        WHEN excluded_use IS NOT NULL AND ({lot_any} OR {bldg_any}) THEN 'excluded'
        WHEN {lot_kind} AND {lot_any} THEN 'lot'
        WHEN has_footprint AND {bldg_any} THEN 'building'
        WHEN has_footprint AND {lot_any} THEN 'lot_conflict'
        WHEN has_footprint IS NULL AND {bldg_any} THEN 'building'
        WHEN {lot_any} THEN 'lot'
      END AS kind,
      CASE
        WHEN excluded_use IS NOT NULL THEN NULL
        WHEN {lot_kind} AND {lot_any} THEN CASE
          WHEN coalesce(newcon_probably_built, false) THEN 'low'
          WHEN {city_land} AND n_lot_signals >= 2 AND NOT coalesce(lu_developed, false)
               AND NOT coalesce(newcon_planned, false) THEN 'high'
          WHEN {city_land} AND n_lot_signals >= 2 THEN 'medium'
          WHEN NOT {city_land} AND n_lot_signals >= 2 AND {PHYSICAL_LOT}
               AND NOT coalesce(lu_developed, false) THEN 'medium'
          ELSE 'low' END
        WHEN has_footprint IS NOT false AND {bldg_any} THEN
          CASE WHEN coalesce(recent_permit, false) THEN
            CASE WHEN ({city_bldg} AND n_bldg_signals >= 1)
                      OR (n_bldg_signals >= 2 AND {STRONG_BLDG}) THEN 'medium'
                 ELSE 'low' END
          ELSE
            CASE WHEN ({city_bldg} AND n_bldg_signals >= 1)
                      OR (n_bldg_signals >= 2 AND {STRONG_BLDG}) THEN 'high'
                 WHEN {city_bldg} OR {STRONG_BLDG} THEN 'medium'
                 ELSE 'low' END
          END
        WHEN {lot_any} THEN 'low'
      END AS confidence
    """


def reasons_sql() -> str:
    """The reason bits (`rs`) and the signal count (`n`) from a classified row."""
    terms = []
    for reason in REASONS:
        flag = "kind = 'lot_conflict'" if reason.flag == "footprint_conflict" else reason.flag
        terms.append(f"CASE WHEN coalesce({flag}, false) THEN {1 << reason.bit} ELSE 0 END")
    return " + ".join(terms)


def classify(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"CREATE TABLE classified AS SELECT *, {classify_sql()} FROM signals")
    con.execute(f"""
        CREATE TABLE vacancy AS
        SELECT *,
          CASE WHEN kind IN ('lot', 'lot_conflict') THEN 1 WHEN kind = 'building' THEN 2 END AS k,
          CASE confidence WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 END AS vc,
          CASE WHEN coalesce(in_landcare, false) THEN 1 ELSE 0 END AS lc,
          ({reasons_sql()}) AS rs,
          CASE WHEN kind = 'building' THEN n_bldg_signals ELSE n_lot_signals END AS n,
          CASE WHEN coalesce(demo_no_newcon, false) THEN year(demo_last) END AS dy,
          CASE WHEN coalesce(cs_recent_no_permit, false) THEN year(cs_last) END AS sy,
          CASE WHEN coalesce(newcon_probably_built, false) OR coalesce(newcon_planned, false)
               THEN year(newcon_last) END AS ny
        FROM classified WHERE kind IS NOT NULL
    """)


def counts(con: duckdb.DuckDBPyConnection, table: str = "vacancy") -> dict[str, Any]:
    out: dict[str, Any] = {"lot": {}, "building": {}, "excluded": 0}
    rows = con.execute(f"""
        SELECT CASE WHEN kind = 'lot_conflict' THEN 'lot' ELSE kind END, confidence, count(*)
        FROM {table} GROUP BY ALL
    """).fetchall()
    for kind, confidence, n in rows:
        if kind == "excluded":
            out["excluded"] += n
        else:
            out[kind][confidence] = out[kind].get(confidence, 0) + n
    for kind in ("lot", "building"):
        out[kind] = {level: out[kind].get(level, 0) for level in ("high", "medium", "low")}
    return out


@dataclass
class VacancyResult:
    path: Path
    as_of: str
    counts: dict[str, Any]
    without_city: dict[str, Any]
    city_lists: dict[str, Any]
    missing_sources: list[str]
    no_shape: int
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "vacancy.parquet"


def write_output(con: duckdb.DuckDBPyConnection, out: Path) -> int:
    """The shown parcels (kind lot, lot_conflict or building), with their parcel shape: the
    Water Department parcels of the account joined into one, or the City's polygon when the
    account has none. Returns how many shown parcels have no shape at all."""
    con.execute(f"""
        CREATE TABLE shapes AS
        SELECT {opa9("brt_id")} AS opa, ST_Union_Agg(geometry) AS geometry
        FROM src_pwd
        WHERE geometry IS NOT NULL AND brt_id IS NOT NULL AND trim(brt_id) <> ''
          AND {opa9("brt_id")} IN (SELECT opa FROM vacancy WHERE kind <> 'excluded')
        GROUP BY 1
    """)
    con.execute(f"""
        CREATE TABLE city_shapes AS
        SELECT {opa9("opa_id")} AS opa, ST_Union_Agg(geometry) AS geometry
        FROM (SELECT opa_id, geometry FROM src_city_land UNION ALL
              SELECT opa_id, geometry FROM src_city_bldg)
        WHERE geometry IS NOT NULL AND {valid_opa("opa_id")}
        GROUP BY 1
    """)
    base = [
        "opa",
        "address",
        "kind",
        "confidence",
        "k",
        "vc",
        "lc",
        "rs",
        "n",
        "dy",
        "sy",
        "ny",
        "has_footprint",
        "n_lot_signals",
        "n_bldg_signals",
        "excluded_use",
    ]
    flags = [r.flag for r in REASONS if r.flag != "footprint_conflict"]
    columns = ", ".join(f"v.{name}" for name in dict.fromkeys(base + flags))
    kv = quote_literal(json.dumps(geo_metadata([])))
    con.execute(f"""
        COPY (
          SELECT {columns},
                 ST_AsWKB(coalesce(s.geometry, c.geometry))::BLOB AS geometry
          FROM vacancy v
          LEFT JOIN shapes s USING (opa)
          LEFT JOIN city_shapes c USING (opa)
          ORDER BY opa
        ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd, KV_METADATA {{geo: {kv}}})
    """)
    return con.execute(f"""
        SELECT count(*) FROM read_parquet({quote_literal(str(out))})
        WHERE kind <> 'excluded' AND geometry IS NULL
    """).fetchone()[0]


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> VacancyResult:
    """Run the model on the current snapshots and write $PK_CACHE/derived/vacancy.parquet (or
    `out`) with a JSON summary beside it."""
    started = time.monotonic()
    as_of = as_of or ctx.today()
    w = Windows(as_of)
    paths = snapshot_paths(ctx)
    missing_required = [s for s in REQUIRED_SOURCES if s not in paths]
    if missing_required:
        raise RuntimeError(f"The vacancy model needs {', '.join(missing_required)} first")
    con = connect(ctx)
    try:
        missing = create_views(con, paths)
        lists = city_lists(con, as_of)
        log.info("derive: spatial facts for every parcel")
        build_spatial(con)
        log.info("derive: records and signals")
        build_records(con, w, lists)
        build_signals(con, w)
        classify(con)
        found = counts(con)
        con.execute(f"""
            CREATE TABLE without_city AS
            SELECT {classify_sql("false", "false")} FROM signals
        """)
        alone = counts(con, "(SELECT * FROM without_city WHERE kind IS NOT NULL)")
        out = out or output_path(ctx)
        with atomic_output(out) as tmp:
            no_shape = write_output(con, tmp)
    finally:
        con.close()

    notes = []
    for label, day, used in (
        ("land", lists.land_date, lists.use_land),
        ("building", lists.building_date, lists.use_building),
    ):
        if day is None:
            notes.append(
                f"The City's vacant {label} list is not available, so the model ran without it"
            )
        elif not used:
            notes.append(
                f"The City's vacant {label} list of {day.isoformat()} is more than a year old, "
                "so it is no longer used"
            )
    if missing:
        notes.append(f"The vacancy model ran without {', '.join(missing)}")
    if no_shape:
        notes.append(f"{no_shape:,} vacant parcels have no parcel shape and are not on the map")
    result = VacancyResult(
        path=out,
        as_of=as_of.isoformat(),
        counts=found,
        without_city=alone,
        city_lists={
            "land": {
                "date": lists.land_date and lists.land_date.isoformat(),
                "used": lists.use_land,
            },
            "building": {
                "date": lists.building_date and lists.building_date.isoformat(),
                "used": lists.use_building,
            },
        },
        missing_sources=missing,
        no_shape=no_shape,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info("derive: vacancy model done in %.0f s: %s", result.seconds, json.dumps(found))
    return result
