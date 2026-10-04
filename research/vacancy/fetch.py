"""Download every source the vacancy study needs, politely, into ~/.cache/placekeepers/research/.

Usage: .venv/bin/python fetch.py [name ...]   (no names: fetch everything not yet cached)

Each source becomes one parquet file named after it. Requests are sequential with a pause, carry the
project User-Agent, and select only the columns and date ranges the study uses.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from common import ARCGIS, RAW, carto, connect, get, raw, stream_to_file

TMP = RAW / "tmp"
CSV_OPTS = "header=true, all_varchar=true, delim=',', quote='\"', escape='\"', strict_mode=true"
TMP.mkdir(parents=True, exist_ok=True)

# Violation codes worth keeping. Anything whose title mentions vacancy is kept as well (see the SQL).
VIOLATION_CODES = [
    # property maintenance conditions typical of neglected lots and buildings
    "PM15-302.4", "PM15-308.1", "PM15-302.1", "PM15-302.5", "PM15-302.9", "PM15-308.2",
    "PM15-308.2.2", "10-710", "10-710(1)(A)", "10-710(1)(B)", "10-715",
    # structural danger (these also feed the unsafe and imminently dangerous tables)
    "PM15-108.1", "PM15-110.1", "PM15-109.1", "PM15-305.1",
]

COMPLAINT_CODES = ["VL", "VA", "VO", "BDNO", "PMHW", "PME", "DEMO", "CGI"]

DEED_TYPES = [
    "DEED", "MISCELLANEOUS DEED", "SHERIFF'S DEED", "DEED SHERIFF", "DEED LAND BANK",
    "MISCELLANEOUS DEED TAXABLE", "DEED - DECEASED ", "DEED RTT - OTHER", "DEED OF CONDEMNATION",
    "DEED MISCELLANEOUS",
]


def sql_list(values: list[str]) -> str:
    return ", ".join("'" + v.replace("'", "''") + "'" for v in values)


CARTO_SOURCES: dict[str, dict] = {
    "opa": {
        "table": "opa_properties_public",
        "select": (
            "cartodb_id, parcel_number, location, unit, category_code, category_code_description, "
            "building_code, building_code_description, building_code_new, building_code_description_new, "
            "zoning, owner_1, owner_2, sale_date, sale_price, market_value, total_area, total_livable_area, "
            "year_built, number_stories, exterior_condition, interior_condition, date_exterior_condition, "
            "exempt_land, exempt_building, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng"
        ),
        "where": "TRUE",
    },
    "pwd_parcels": {
        "table": "pwd_parcels",
        "select": "cartodb_id, parcelid, brt_id, num_brt, num_accounts, gross_area, bldg_code, bldg_desc, address, the_geom",
        "where": "TRUE",
        "geom": True,
    },
    "violations": {
        "table": "violations",
        "select": (
            "cartodb_id, opa_account_num, address, casenumber, casetype, caseresponsibility, casecreateddate, "
            "violationnumber, violationdate, violationcode, violationcodetitle, violationstatus, "
            "violationresolutiondate, violationresolutioncode"
        ),
        "where": (
            "violationdate >= '2022-01-01' AND (violationcodetitle ILIKE '%VACAN%' OR violationcode IN ("
            + sql_list(VIOLATION_CODES) + "))"
        ),
    },
    "complaints": {
        "table": "complaints",
        "select": (
            "cartodb_id, opa_account_num, address, complaintnumber, complaintdate, complaintcode, "
            "complaintcodename, complaintstatus, complaintresolution_date"
        ),
        "where": "complaintdate >= '2022-01-01' AND complaintcode IN (" + sql_list(COMPLAINT_CODES) + ")",
    },
    "permits": {
        "table": "permits",
        "select": (
            "cartodb_id, opa_account_num, address, permitnumber, permittype, permitdescription, typeofwork, "
            "left(approvedscopeofwork, 120) AS scope, permitissuedate, permitcompleteddate, status, "
            "commercialorresidential, numberofunits"
        ),
        "where": "permitissuedate >= '2016-01-01'",
    },
    "clean_seal": {
        "table": "clean_seal",
        "select": (
            "cartodb_id, opa_account_num, address, casenumber, casecreateddate, casecompleteddate, "
            "caseresponsibility, workordertype, workorderstatus, workordercompleteddate, systemofrecord"
        ),
        "where": "TRUE",
    },
    "demolitions": {
        "table": "demolitions",
        "select": (
            "cartodb_id, opa_account_num, address, caseorpermitnumber, record_type, typeofwork, city_demo, "
            "status, start_date, completed_date, applicanttype"
        ),
        "where": "TRUE",
    },
    "unsafe": {
        "table": "unsafe",
        "select": (
            "cartodb_id, opa_account_num, address, casenumber, casecreateddate, casecompleteddate, "
            "violationdate, violationcode, violationcodetitle, violationresolutiondate, violationresolutioncode"
        ),
        "where": "TRUE",
    },
    "imm_dang": {
        "table": "imm_dang",
        "select": (
            "cartodb_id, opa_account_num, address, casenumber, casecreateddate, casecompleteddate, "
            "violationdate, violationcode, violationcodetitle, violationresolutiondate, violationresolutioncode"
        ),
        "where": "TRUE",
    },
    "deeds": {
        "table": "rtt_summary",
        "select": (
            "cartodb_id, opa_account_num, document_type, recording_date, document_date, "
            "total_consideration, cash_consideration"
        ),
        "where": "recording_date >= '2024-01-01' AND document_type IN (" + sql_list(DEED_TYPES) + ")",
    },
}

ARCGIS_SOURCES: dict[str, dict] = {
    "vpi_land_2026": {"url": f"{ARCGIS}/Vacant_Indicators_Land/FeatureServer/0"},
    "vpi_bldg_2026": {"url": f"{ARCGIS}/Vacant_Indicators_Bldg/FeatureServer/0"},
    "phs_landcare": {"url": f"{ARCGIS}/phs_landcare/FeatureServer/0"},
    "ppr_properties": {"url": f"{ARCGIS}/PPR_Properties/FeatureServer/0"},
    "gardens_phs_ngt": {
        "url": "https://services2.arcgis.com/qjOOiLCYeUtwT7x7/arcgis/rest/services/PHS_NGT_Supported_Current_view/FeatureServer/0"
    },
    "gardens_registered": {"url": f"{ARCGIS}/Registered_Community_Gardens/FeatureServer/0"},
    "gardens_ppr_urban_ag": {"url": f"{ARCGIS}/PPR_Urban_Agriculture_Projects/FeatureServer/0"},
    "clip_hex_2026": {"url": f"{ARCGIS}/clip_vacant_lot_abatements/FeatureServer/0"},
}

# Large polygon layers come from the ArcGIS Hub cached export: one request instead of hundreds.
HUB_SOURCES: dict[str, str] = {
    "footprints": "ab9e89e1273f445bb265846c90b38a96",  # LI_BUILDING_FOOTPRINTS
    "land_use": "e433504739bd41049de5d8f4a22d34ba",  # Land_Use (Planning, 2023 with 2025 updates)
}


def fetch_carto(name: str, spec: dict, page: int = 100_000) -> None:
    con = connect()
    last = 0
    parts: list[Path] = []
    i = 0
    while True:
        sql = (
            f"SELECT {spec['select']} FROM {spec['table']} "
            f"WHERE cartodb_id > {last} AND ({spec['where']}) ORDER BY cartodb_id LIMIT {page}"
        )
        r = carto(sql, fmt="csv")
        csv_path = TMP / f"{name}_{i}.csv"
        csv_path.write_bytes(r.content)
        n, mx = con.execute(
            f"SELECT count(*), max(CAST(cartodb_id AS BIGINT)) FROM read_csv('{csv_path}', " + CSV_OPTS + ")"
        ).fetchone()
        print(f"  {name} page {i}: {n} rows, {len(r.content) / 1e6:.1f} MB")
        if n == 0:
            csv_path.unlink()
            break
        part = TMP / f"{name}_{i}.parquet"
        geom = ", ST_GeomFromHEXEWKB(the_geom) AS geometry" if spec.get("geom") else ""
        excl = " EXCLUDE (the_geom)" if spec.get("geom") else ""
        con.execute(
            f"COPY (SELECT *{excl}{geom} FROM read_csv('{csv_path}', " + CSV_OPTS + ")) "
            f"TO '{part}' (FORMAT parquet)"
        )
        csv_path.unlink()
        parts.append(part)
        last = mx
        i += 1
        if n < page:
            break
    files = ", ".join(f"'{p}'" for p in parts)
    con.execute(f"COPY (SELECT * FROM read_parquet([{files}])) TO '{raw(name)}' (FORMAT parquet)")
    total = con.execute(f"SELECT count(*) FROM read_parquet('{raw(name)}')").fetchone()[0]
    for p in parts:
        p.unlink()
    print(f"{name}: {total} rows -> {raw(name)}")


def fetch_arcgis(name: str, spec: dict, page: int = 2000) -> None:
    url = spec["url"]
    meta = get(url, params={"f": "json"}).json()
    oid = meta.get("objectIdField") or next(f["name"] for f in meta["fields"] if f["type"] == "esriFieldTypeOID")
    count = get(f"{url}/query", params={"where": "1=1", "returnCountOnly": "true", "f": "json"}).json()["count"]
    con = connect()
    parts = []
    for i, offset in enumerate(range(0, count, page)):
        r = get(
            f"{url}/query",
            params={
                "where": "1=1",
                "outFields": "*",
                "outSR": "4326",
                "orderByFields": oid,
                "resultOffset": offset,
                "resultRecordCount": page,
                "f": "geojson",
            },
        )
        path = TMP / f"{name}_{i}.geojson"
        path.write_bytes(r.content)
        n = len(json.loads(r.content).get("features", []))
        print(f"  {name} page {i}: {n} features")
        parts.append(path)
    selects = " UNION ALL BY NAME ".join(f"SELECT * FROM ST_Read('{p}')" for p in parts)
    con.execute(f"COPY ({selects}) TO '{raw(name)}' (FORMAT parquet)")
    total = con.execute(f"SELECT count(*) FROM read_parquet('{raw(name)}')").fetchone()[0]
    for p in parts:
        p.unlink()
    print(f"{name}: {total} rows (service says {count}) -> {raw(name)}")


def fetch_hub(name: str, item: str) -> None:
    free = shutil.disk_usage(RAW).free / 1e9
    if free < 11:
        raise SystemExit(f"only {free:.1f} GB free; refusing a large download (keep 10 GB free)")
    dest = TMP / f"{name}.geojson"
    url = f"https://hub.arcgis.com/api/v3/datasets/{item}_0/downloads/data"
    stream_to_file(url, dest, params={"format": "geojson", "spatialRefId": "4326", "where": "1=1"})
    print(f"  {name}: downloaded {dest.stat().st_size / 1e6:.0f} MB")
    con = connect(memory="2500MB")
    con.execute(f"COPY (SELECT * FROM ST_Read('{dest}')) TO '{raw(name)}' (FORMAT parquet)")
    total = con.execute(f"SELECT count(*) FROM read_parquet('{raw(name)}')").fetchone()[0]
    dest.unlink()
    print(f"{name}: {total} rows -> {raw(name)}")


def main(names: list[str]) -> None:
    every = list(CARTO_SOURCES) + list(ARCGIS_SOURCES) + list(HUB_SOURCES)
    todo = names or [n for n in every if not Path(raw(n)).exists()]
    for name in todo:
        print(f"== {name}", flush=True)
        if name in CARTO_SOURCES:
            fetch_carto(name, CARTO_SOURCES[name])
        elif name in ARCGIS_SOURCES:
            fetch_arcgis(name, ARCGIS_SOURCES[name])
        elif name in HUB_SOURCES:
            fetch_hub(name, HUB_SOURCES[name])
        else:
            raise SystemExit(f"unknown source {name}; choose from {every}")
        sys.stdout.flush()


if __name__ == "__main__":
    main(sys.argv[1:])
