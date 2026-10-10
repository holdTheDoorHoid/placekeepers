"""Every source has a fixture test: its adapter runs end to end (download, snapshot, health
checks with its own registry rules) against a fake server shaped like the real one.

Only `min_rows` is lowered, so a handful of fixture rows can stand in for the real tables.
"""

from __future__ import annotations

import io
import json
import re
from datetime import UTC, date, datetime

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from shapely.geometry import LineString, MultiLineString, Point, box, mapping

from placekeepers.adapters import ADAPTERS, ArcgisAdapter, CartoAccountsAdapter, UrlAdapter
from placekeepers.adapters.carto import CartoAdapter, Column
from placekeepers.adapters.displacement import AssessmentValues
from placekeepers.adapters.lens_context import TreeCanopy2018
from placekeepers.adapters.li import HISTORY_PARTS, LiHistory
from placekeepers.candidates import Candidates
from placekeepers.registry import Source
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, FakeCarto, hex_wkb, load_fixture
from .transit_fixtures import septa_zip
from .walk_fixtures import redistricting_zip

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
RECENT = "2026-10-01"
SEPT_27_MS = 1790467200000
ACCOUNT_COLUMNS = {"opa_account_num", "parcel_number", "opa_id", "opabrt", "brt_id"}


def relaxed(source: Source) -> Source:
    """The registry source with min_rows lowered, so a few fixture rows can pass."""
    return source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})


def ids_of(kind: type, *, exclude: type | tuple[type, ...] | None = None) -> list[str]:
    return [
        source_id
        for source_id, cls in ADAPTERS.items()
        if issubclass(cls, kind) and not (exclude and issubclass(cls, exclude))
    ]


def run(ctx, source: Source) -> SnapshotStore:
    fetched = fetch_source(ctx, source)
    assert fetched.outcome == "downloaded", fetched.detail
    checked = validate_source(ctx, source)
    assert checked.outcome == "ok", checked.detail
    return SnapshotStore(ctx.cache, source.id)


# Carto
def carto_value(column: Column, n: int) -> object:
    if column.type in ("DATE", "LOCAL_DATE"):
        return RECENT
    if column.type in ("BIGINT", "INTEGER", "SMALLINT"):
        return str(n)
    if column.type == "DOUBLE":
        return {"lat": "39.95", "lng": "-75.16"}.get(column.name, "1.5")
    if column.type == "WKB":
        return hex_wkb(box(-75.2 + n / 100, 39.9, -75.19 + n / 100, 39.91))
    if column.name in ACCOUNT_COLUMNS:
        return f"37000000{n}"
    if column.name == "category_code":
        return "6"
    return f"{column.name} {n}"


def carto_rows(adapter: type[CartoAdapter], count: int = 5) -> list[dict]:
    return [
        {"cartodb_id": n, **{c.name: carto_value(c, n) for c in adapter.columns}}
        for n in range(1, count + 1)
    ]


# The assessed values choose their tax years first; tests/test_displacement_sources.py covers them.
@pytest.mark.parametrize(
    "source_id", ids_of(CartoAdapter, exclude=(CartoAccountsAdapter, AssessmentValues))
)
def test_carto_sources_from_fixtures(source_id: str, context_factory) -> None:
    adapter = ADAPTERS[source_id]
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources[source_id])
    fake = FakeCarto(tables={source.endpoint.table: carto_rows(adapter)})
    ctx = context_factory(handler=fake, now=NOW)
    store = run(ctx, source)
    meta = store.current()
    assert meta.rows == 5
    assert set(adapter.required_columns) <= set(meta.columns)
    if source.endpoint.where:
        # A source may also read the history of the properties it found, by their accounts
        # (land_conveyances, M4.4); those queries name the accounts instead.
        found = [q for q in fake.queries if "AS chosen(chosen_account)" not in q]
        assert found and all(f"({source.endpoint.where})" in query for query in found)


# The lot timeline's L&I records read six tables; tests/test_sources.py covers them below.
@pytest.mark.parametrize("source_id", ids_of(CartoAccountsAdapter, exclude=LiHistory))
def test_account_sources_from_fixtures(source_id: str, context_factory, monkeypatch) -> None:
    adapter = ADAPTERS[source_id]
    chosen = ["370000001", "370000003", "370000004"]
    monkeypatch.setattr(
        "placekeepers.adapters.carto.candidate_accounts", lambda ctx: Candidates(accounts=chosen)
    )
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources[source_id])
    fake = FakeCarto(tables={source.endpoint.table: carto_rows(adapter)})
    ctx = context_factory(handler=fake, now=NOW)
    meta = run(ctx, source).current()
    assert meta.rows == 3
    assert set(adapter.required_columns) <= set(meta.columns)
    chunk_methods = {m for m, q in zip(fake.methods, fake.queries, strict=True) if "VALUES" in q}
    assert chunk_methods == {"POST"}


def test_account_sources_go_in_chunks_and_check_each(context_factory, monkeypatch) -> None:
    chosen = [f"37000000{n}" for n in range(1, 6)]
    monkeypatch.setattr(
        "placekeepers.adapters.carto.candidate_accounts", lambda ctx: Candidates(accounts=chosen)
    )

    class SmallChunks(ADAPTERS["li_violations"]):
        accounts_per_chunk = 2

    ctx = context_factory(now=NOW)
    source = ctx.registry.sources["li_violations"]
    fake = FakeCarto(tables={"violations": carto_rows(SmallChunks, 6)})
    ctx = context_factory(handler=fake, now=NOW)
    dest = ctx.cache.root / "raw-test"
    dest.mkdir(parents=True)
    info = SmallChunks(source, ctx).fetch(dest)
    assert (info["rows"], info["chunks"], info["accounts"]) == (5, 3, 5)
    selects = [q for q in fake.queries if not q.startswith("SELECT count")]
    assert "JOIN (VALUES ('370000001'), ('370000002')) AS chosen(chosen_account)" in selects[0]
    assert selects[0].endswith("WHERE (violationdate >= '2016-01-01')")

    fake.count_offset = 1
    other = ctx.cache.root / "raw-test-2"
    other.mkdir()
    with pytest.raises(Exception, match="Chunk 1 has 2 rows but the table reports 3"):
        SmallChunks(source, ctx).fetch(other)


def history_rows(table: str, kind: str, count: int) -> list[dict]:
    """Rows of one L&I table as the timeline query names its columns."""
    return [
        {
            "cartodb_id": n,
            "opa_account_num": f"37000000{n}",
            "kind": kind,
            "date": f"2019-0{n}-02 23:30:00+00",
            "title": f"{kind.upper()} TITLE {n}",
            "status": "OPEN",
            "detail": "YES" if kind == "demolition" else None,
            "casenumber": f"CASE{n}",
        }
        for n in range(1, count + 1)
    ]


def test_the_timeline_reads_six_tables_in_chunks_without_case_numbers(
    context_factory, monkeypatch
) -> None:
    """The lot timeline's L&I records (issue #38): every table in the same chunks of candidate
    parcels, each chunk counted, days in Philadelphia, and never a case number."""
    chosen = [f"37000000{n}" for n in range(1, 5)]
    monkeypatch.setattr(
        "placekeepers.adapters.carto.candidate_accounts", lambda ctx: Candidates(accounts=chosen)
    )

    monkeypatch.setattr(LiHistory, "accounts_per_chunk", 3)
    tables = {part.table: history_rows(part.table, part.kind, 4) for part in HISTORY_PARTS}
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["li_history"])
    assert source.endpoint.table == "violations"
    fake = FakeCarto(tables=tables)
    ctx = context_factory(handler=fake, now=NOW)
    # The fixture's records are old: leave the age rule out here.
    timeless = source.health.model_copy(update={"max_age_days": None, "newest_field": None})
    store = run(ctx, source.model_copy(update={"health": timeless}))
    meta = store.current()
    # Two chunks of accounts, six tables each, every one counted.
    selects = [q for q in fake.queries if not q.startswith("SELECT count")]
    counts = [q for q in fake.queries if q.startswith("SELECT count")]
    assert len(selects) == len(counts) == 12
    assert {re.search(r"FROM (\w+)", q).group(1) for q in selects} == set(tables)
    assert meta.rows == 4 * 6
    table = pq.read_table(store.path_for(meta))
    assert table.column_names == ["opa_account_num", "kind", "date", "title", "status", "detail"]
    # 23:30 in UTC on January 2 is still January 2 in Philadelphia (6:30 PM).
    assert set(table.column("date").to_pylist()) == {date(2019, n, 2) for n in range(1, 5)}
    for query in selects:
        assert "casenumber" not in query and "permitnumber" not in query
        assert "applicant" not in query and "contractor" not in query and "inspector" not in query


def test_vacancy_violations_come_for_the_whole_city_without_repeats(
    context_factory, monkeypatch
) -> None:
    """A vacant lot or vacant building violation can be the only sign a parcel is vacant, so those
    two kinds come for every parcel; a violation found both ways is kept once."""
    monkeypatch.setattr(
        "placekeepers.adapters.carto.candidate_accounts",
        lambda ctx: Candidates(accounts=["370000001"]),
    )
    adapter = ADAPTERS["li_violations"]
    rows = carto_rows(adapter, 4)
    rows[0].update(violationcode="9-3904")  # a candidate parcel: found twice, kept once
    rows[1].update(violationcodetitle="VACANT STRUCTURE LICENSE")  # elsewhere in the city
    rows[2].update(violationcode="9-3904", violationdate="2020-01-01")  # too old for citywide
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["li_violations"])
    fake = FakeCarto(tables={"violations": rows})
    ctx = context_factory(handler=fake, now=NOW)
    store = run(ctx, source)
    accounts = sorted(
        pq.read_table(store.path_for(store.current())).column("opa_account_num").to_pylist()
    )
    assert accounts == ["370000001", "370000002"]
    citywide = [q for q in fake.queries if "ILIKE '%VACAN%'" in q]
    assert citywide and all("violationdate >= '2024-08-04'" in q for q in citywide)


# ArcGIS
def arcgis_value(name: str, kind: str, n: int) -> object:
    lower = name.lower()
    if lower == "crash_year":
        return 2024
    if lower in ("crash_month", "crash_mont"):
        return 12
    if kind in ("OID", "Integer", "SmallInteger"):
        return n
    if kind == "Double":
        return 1.5
    if kind == "Date":
        return SEPT_27_MS
    if lower in ACCOUNT_COLUMNS:
        return f"37000000{n}"
    return {"program": "PLC", "supported": "PHS", "year": "2022", "district": str(n)}.get(
        lower, f"{name} {n}"
    )


def arcgis_geometry(kind: str, n: int):
    if kind == "esriGeometryPoint":
        return Point(-75.15 + n / 1000, 39.99)
    if kind == "esriGeometryPolyline":
        return MultiLineString([LineString([(-75.15, 39.99 + n / 1000), (-75.14, 39.99)])])
    return box(-75.15 + n / 1000, 39.99, -75.149 + n / 1000, 39.991)


def fake_layer(source_id: str, count: int = 3) -> FakeArcgis:
    spec = load_fixture("arcgis_layers.json")[source_id]
    fields = [{"name": name, "type": f"esriFieldType{kind}"} for name, kind in spec["fields"]]
    features = [
        {
            "type": "Feature",
            "properties": {name: arcgis_value(name, kind, n) for name, kind in spec["fields"]},
            # A table (the Land Management dashboard's, M4.4) has no geometry at all.
            "geometry": mapping(arcgis_geometry(spec["geometry"], n)) if spec["geometry"] else None,
        }
        for n in range(1, count + 1)
    ]
    return FakeArcgis(fields=fields, features=features, geometry_type=spec["geometry"])


# The canopy keeps square meters per cell, not shapes; tests/test_lenses.py covers it.
@pytest.mark.parametrize("source_id", ids_of(ArcgisAdapter, exclude=TreeCanopy2018))
def test_arcgis_sources_from_fixtures(source_id: str, context_factory) -> None:
    adapter = ADAPTERS[source_id]
    fake = fake_layer(source_id)
    ctx = context_factory(handler=fake, now=NOW)
    source = relaxed(ctx.registry.sources[source_id])
    meta = run(ctx, source).current()
    assert meta.rows == 3
    assert meta.format == "geoparquet"
    assert set(adapter.required_columns) <= set(meta.columns)
    assert "shape__area" not in meta.columns
    root = source.endpoint.url or "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS"
    assert str(fake.requests[0].url).startswith(root.split("/rest/services")[0])


@pytest.mark.parametrize(
    ("source_id", "never"),
    [
        (
            "community_organizations",
            {
                "primary_name",
                "primary_email",
                "primary_phone",
                "alternate_name",
                "alternate_email",
                "alternate_phone",
                "primary_address",
                "organization_address",
            },
        ),
        ("gardens_registered", {"contact_email", "comments", "hours_monday"}),
    ],
)
def test_contact_details_are_never_downloaded(source_id, never, context_factory) -> None:
    fake = fake_layer(source_id)
    ctx = context_factory(handler=fake, now=NOW)
    meta = run(ctx, relaxed(ctx.registry.sources[source_id])).current()
    asked = {r.url.params.get("outFields") for r in fake.requests if "outFields" in r.url.params}
    assert asked and not any(name in field for field in asked for name in never)
    assert not never & set(meta.columns)


def test_partner_layers_use_their_own_root(context_factory) -> None:
    fake = fake_layer("gardens_phs_ngt")
    ctx = context_factory(handler=fake, now=NOW)
    run(ctx, relaxed(ctx.registry.sources["gardens_phs_ngt"]))
    assert {r.url.host for r in fake.requests} == {"services2.arcgis.com"}
    assert fake.requests[0].url.path.startswith("/qjOOiLCYeUtwT7x7/arcgis/rest/services/")


# Files at a link
def geojson(features: list[tuple[dict, object]]) -> bytes:
    collection = {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": props, "geometry": mapping(geom)}
            for props, geom in features
        ],
    }
    return json.dumps(collection).encode()


def footprint_file(source_id: str) -> bytes:
    keep = ADAPTERS[source_id].keep_fields
    return geojson(
        [
            (
                {
                    **{
                        name: (
                            n
                            if name in ("objectid", "c_dig1", "c_dig2", "c_dig3", "year")
                            else f"{name} {n}"
                        )
                        for name in keep
                    },
                    "Shape__Area": 12.5,
                },
                box(-75.15 + n / 1000, 39.99, -75.149 + n / 1000, 39.991),
            )
            for n in range(1, 4)
        ]
    )


ACS_ROWS = (
    "GEO_ID|B17001_E001|B17001_M001|B17001_E002|B17001_M002|B17001_E003|B17001_M003\n"
    "0100000US|327079188|15021|40735661|275861|1|1\n"
    "1400000US42101000101|2000|150|500|90|1|1\n"
    "1400000US42101000102|1000|120|-666666666|-222222222|1|1\n"
    "1400000US42101000200|0|11|0|11|0|11\n"
    "1400000US42045400100|3000|200|300|50|1|1\n"
    "1500000US421010001011|900|100|300|80|1|1\n"
)


TENURE_ROWS = (
    "GEO_ID|B25003_E001|B25003_M001|B25003_E002|B25003_M002|B25003_E003|B25003_M003\n"
    "0100000US|127482865|231044|83140209|300106|44342656|141018\n"
    "1400000US42101000101|1000|90|400|60|600|70\n"
    "1400000US42101000102|0|11|0|11|0|11\n"
    "1400000US42101000200|800|80|-666666666|-222222222|300|50\n"
    "1400000US42045400100|3000|200|2000|150|1000|100\n"
)


def acs_table(table: str, lines: int, rows: dict[str, list[int]]) -> str:
    """A Census summary file table: GEO_ID, then each line's estimate and margin of error, with
    `rows` giving each place's numbers in that order (estimate, margin, estimate, margin, ...)."""
    header = ["GEO_ID"]
    for n in range(1, lines + 1):
        header += [f"{table}_E{n:03d}", f"{table}_M{n:03d}"]
    body = ["|".join(header)]
    for geo, values in rows.items():
        assert len(values) == 2 * lines
        body.append("|".join([geo, *(str(v) for v in values)]))
    return "\n".join(body) + "\n"


#: Rent as a share of income (B25070): 1,000 renter households in the first tract, 50 whose share
#: was not computed, 300 paying half their income or more; a second with no answer at all.
RENT_BURDEN_ROWS = acs_table(
    "B25070",
    11,
    {
        "0100000US": [44000000, 100000] * 11,
        "1400000US42101000101": [
            1000,
            90,
            50,
            20,
            60,
            25,
            80,
            30,
            90,
            35,
            100,
            40,
            110,
            40,
            60,
            30,
            100,
            35,
            300,
            60,
            50,
            20,
        ],
        "1400000US42101000102": [0, 11] + [-666666666, -222222222] * 10,
        "1400000US42045400100": [3000, 200] * 11,
    },
)
OCCUPANCY_ROWS = acs_table(
    "B25002",
    3,
    {
        "1400000US42101000101": [1200, 100, 1000, 90, 200, 60],
        "1400000US42101000102": [10, 8, 10, 8, 0, 11],
        "1400000US42045400100": [5000, 200, 4800, 200, 200, 50],
    },
)
VACANCY_ROWS = acs_table(
    "B25004",
    8,
    {
        "1400000US42101000101": [200, 60, 50, 30, 10, 12, 20, 15, 5, 8, 15, 12, 0, 12, 100, 45],
        "1400000US42045400100": [200, 50] * 8,
    },
)
INCOME_ROWS = acs_table(
    "B19013",
    1,
    {
        "1400000US42101000101": [41250, 6900],
        "1400000US42101000102": [-666666666, -222222222],
        "1400000US42045400100": [90000, 5000],
    },
)
RENT_ROWS = acs_table(
    "B25064",
    1,
    {
        "1400000US42101000101": [1180, 95],
        "1400000US42101000102": [-666666666, -222222222],
        "1400000US42045400100": [1600, 100],
    },
)
ACS_CONTEXT_ROWS = {
    "acs_rent_burden": RENT_BURDEN_ROWS,
    "acs_occupancy": OCCUPANCY_ROWS,
    "acs_vacancy": VACANCY_ROWS,
    "acs_income": INCOME_ROWS,
    "acs_rent": RENT_ROWS,
}


def tax_file() -> bytes:
    table = pa.table(
        {
            "opa_id": ["11000017", "371188801", None],
            "owner_1": ["SOMEONE", "ANOTHER", "NOBODY"],
            "total_due": [1200.5, 0.0, 3.0],
            "num_years_owed": [3, 0, 1],
            "most_recent_year_owed": ["2025", None, "2024"],
            "payment_agreement": [False, False, True],
            "is_actionable": [True, False, False],
            "sheriff_sale": [False, False, False],
            "total_assessment": [80000.0, 120000.0, 1.0],
            "vacant": [True, False, True],
        }
    )
    buffer = io.BytesIO()
    pq.write_table(table, buffer)
    return buffer.getvalue()


def vacancy_list_file() -> bytes:
    """A June 2024 vacancy list as Clean & Green Philly saved it: owner names, an address and a
    shape beside the account, which is sometimes a number that lost its leading zero."""
    table = pa.table(
        {
            "address": ["2931 N LAWRENCE ST", "100 SAMPLE ST", "NOWHERE", "2931 N LAWRENCE ST"],
            "owner_1": ["MORALES ROSA", "SOMEONE", "NOBODY", "MORALES ROSA"],
            "opa_id": ["371000001", "11000017", "not a number", "371000001"],
        }
    )
    buffer = io.BytesIO()
    pq.write_table(table, buffer)
    return buffer.getvalue()


def file_for(source_id: str) -> tuple[bytes, dict[str, str]]:
    modified = {"Last-Modified": "Sat, 03 Oct 2026 05:23:42 GMT"}
    if source_id in ("building_footprints", "land_use"):
        return footprint_file(source_id), modified
    if source_id == "neighborhoods":
        return geojson(
            [
                (
                    {
                        "NAME": "BRIDESBURG",
                        "LISTNAME": "Bridesburg",
                        "MAPNAME": "Bridesburg",
                        "Shape_Leng": 1.0,
                    },
                    box(-75.08, 39.99, -75.06, 40.01),
                )
            ]
        ), {}
    if source_id == "acs_poverty":
        return ACS_ROWS.encode(), modified
    if source_id == "acs_tenure":
        return TENURE_ROWS.encode(), modified
    if source_id in ACS_CONTEXT_ROWS:
        return ACS_CONTEXT_ROWS[source_id].encode(), modified
    if source_id == "cagp_tax_2025":
        return tax_file(), {}
    if source_id == "septa_gtfs":
        return septa_zip(), modified
    if source_id == "census_blocks_2020":
        return redistricting_zip(), modified
    if source_id in ("cagp_vacant_land_2024", "cagp_vacant_buildings_2024"):
        return vacancy_list_file(), {}
    if source_id == "mapping_inequality_1937":
        # Mapping Inequality's areas of Philadelphia, as tests/test_redlining.py builds them.
        from .test_redlining import holc_file

        return json.dumps(holc_file()).encode(), {}
    if source_id == "pba_laser":
        # Philly Bike Action's map: the same pin for every day and every kind asked for.
        return json.dumps({"pins": [[39.9526, -75.1652, 1]], "unique_users_count": 1}).encode(), {}
    raise AssertionError(f"no fixture file for {source_id}")


@pytest.mark.parametrize("source_id", ids_of(UrlAdapter))
def test_url_sources_from_fixtures(source_id: str, context_factory) -> None:
    body, headers = file_for(source_id)
    ctx = context_factory(
        handler=lambda request: httpx.Response(200, content=body, headers=headers), now=NOW
    )
    source = relaxed(ctx.registry.sources[source_id])
    meta = run(ctx, source).current()
    assert meta.rows > 0
    assert set(ADAPTERS[source_id].required_columns) <= set(meta.columns)


def test_bulk_files_keep_their_fields_and_the_file_date(context_factory) -> None:
    body, headers = file_for("building_footprints")
    ctx = context_factory(
        handler=lambda request: httpx.Response(200, content=body, headers=headers), now=NOW
    )
    store = run(ctx, relaxed(ctx.registry.sources["building_footprints"]))
    meta = store.current()
    table = pq.read_table(store.path_for(meta))
    assert "shape__area" not in table.column_names
    assert set(table.column("source_date").to_pylist()) == {date(2026, 10, 3)}
    assert meta.newest_record == "2026-10-03"


def test_poverty_keeps_philadelphia_tracts_and_drops_missing_codes(context_factory) -> None:
    ctx = context_factory(handler=lambda request: httpx.Response(200, text=ACS_ROWS), now=NOW)
    store = run(ctx, relaxed(ctx.registry.sources["acs_poverty"]))
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    assert [(r["geoid"], r["tract"], r["poverty_pct"]) for r in rows] == [
        ("42101000101", "000101", 25.0),
        ("42101000102", "000102", None),
        ("42101000200", "000200", None),
    ]
    assert rows[1]["below_poverty"] is None and rows[1]["population_for_poverty"] == 1000
    assert (rows[0]["survey_start_year"], rows[0]["survey_end_year"]) == (2020, 2024)


def test_june_2024_lists_keep_only_the_accounts_and_the_lists_date(context_factory) -> None:
    ctx = context_factory(
        handler=lambda request: httpx.Response(200, content=vacancy_list_file()), now=NOW
    )
    store = run(ctx, relaxed(ctx.registry.sources["cagp_vacant_land_2024"]))
    table = pq.read_table(store.path_for(store.current()))
    assert table.column_names == ["opa_id", "list_date"]
    assert table.to_pylist() == [
        {"opa_id": "011000017", "list_date": date(2024, 6, 24)},
        {"opa_id": "371000001", "list_date": date(2024, 6, 24)},
    ]


def test_tax_snapshot_keeps_only_the_tax_fields_with_its_date(context_factory) -> None:
    ctx = context_factory(handler=lambda request: httpx.Response(200, content=tax_file()), now=NOW)
    store = run(ctx, relaxed(ctx.registry.sources["cagp_tax_2025"]))
    meta = store.current()
    table = pq.read_table(store.path_for(meta))
    assert table.column_names == [
        "opa_id",
        "total_due",
        "num_years_owed",
        "most_recent_year_owed",
        "payment_agreement",
        "is_actionable",
        "sheriff_sale",
        "total_assessment",
        "snapshot_date",
    ]
    assert table.column("opa_id").to_pylist() == ["011000017", "371188801"]
    assert meta.newest_record == "2025-07-09"
