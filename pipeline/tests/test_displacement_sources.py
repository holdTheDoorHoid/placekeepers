"""The displacement watch's sources (M4.1): citywide sales without names, assessed values in two
tax years, renters by tract, and both editions of the Market Value Analysis."""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
import pyarrow.parquet as pq
import pytest
from shapely.geometry import box, mapping

from placekeepers.adapters import ADAPTERS
from placekeepers.adapters.base import FetchError
from placekeepers.adapters.displacement import (
    AssessmentValues,
    MarketValueAnalysis,
    buyer_type,
    mva_pressure,
)
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, FakeCarto
from .test_sources import (
    ACS_CONTEXT_ROWS,
    RENT_BURDEN_ROWS,
    TENURE_ROWS,
    carto_rows,
    relaxed,
    run,
)

NOW = datetime(2026, 10, 5, 15, 0, tzinfo=UTC)


def test_buyers_are_typed_from_their_names() -> None:
    assert buyer_type("KENSINGTON HOMES LLC") == "company"
    assert buyer_type("SMITH JOHN; SMITH MARY") == "individual"
    assert buyer_type("SMITH JOHN; 2400 N 5TH ST LLC") == "company"
    assert buyer_type("PHILADELPHIA LAND BANK") == "land_bank"
    assert buyer_type(None) == "unknown"


def test_sales_snapshot_keeps_buyer_types_and_never_names(context_factory) -> None:
    adapter = ADAPTERS["real_estate_sales"]
    rows = carto_rows(adapter, 4)
    rows[0]["grantees"] = "MORALES ROSA"
    rows[1]["grantees"] = "BLUE OAK HOLDINGS LLC"
    rows[2]["grantees"] = "MORALES ROSA; MORALES JUAN"
    rows[3]["grantees"] = None
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["real_estate_sales"])
    fake = FakeCarto(tables={"rtt_summary": rows})
    ctx = context_factory(handler=fake, now=NOW)
    store = run(ctx, source)
    table = pq.read_table(store.path_for(store.current()))
    assert "grantees" not in table.column_names
    assert table.column("buyer_type").to_pylist() == [
        "individual",
        "company",
        "individual",
        "unknown",
    ]
    # No name reaches the snapshot, and the sellers' names are never even asked for.
    text = store.path_for(store.current()).read_bytes()
    assert b"MORALES" not in text and b"BLUE OAK" not in text
    for query in fake.queries:
        for field in adapter.never_fetch:
            assert field not in query
    assert all(f"({source.endpoint.where})" in q for q in fake.queries)
    # The download with the names is gone once checked.
    assert not list((ctx.cache.root / "raw" / "real_estate_sales").glob("*/chunk-*.csv"))


class FewParcels(AssessmentValues):
    """The fixture's years have a handful of parcels, not hundreds of thousands."""

    MIN_PARCELS = 2


def assessment_rows() -> list[dict]:
    rows = []
    n = 0
    for year, parcels in ((2013, 1), (2021, 2), (2022, 3), (2026, 3), (2027, 3)):
        for p in range(parcels):
            n += 1
            rows.append(
                {
                    "cartodb_id": n,
                    "parcel_number": f"37000000{p + 1}",
                    "year": str(year),
                    "market_value": str(100_000 + year),
                }
            )
    return rows


def test_assessed_values_choose_the_newest_year_and_five_before(context_factory) -> None:
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["assessment_values"])
    fake = FakeCarto(tables={"assessments": assessment_rows()})
    ctx = context_factory(handler=fake, now=NOW)
    adapter = FewParcels(source, ctx)
    dest = ctx.cache.root / "raw-test"
    dest.mkdir(parents=True)
    info = adapter.fetch(dest)
    assert info["years"] == [2022, 2027]
    pages = [q for q in fake.queries if "_key" in q]
    assert pages and all("year::text IN ('2022', '2027')" in q for q in pages)
    assert fake.queries[0].startswith("SELECT year::int AS year, count(*) AS n")


def test_assessed_values_need_a_year_five_before() -> None:
    adapter = AssessmentValues.__new__(AssessmentValues)
    assert adapter.choose_years({2013: 11, 2022: 575_000, 2027: 583_000}) == (2022, 2027)
    # A few stray rows of a later year never decide it.
    assert adapter.choose_years({2022: 575_000, 2027: 583_000, 2028: 40}) == (2022, 2027)
    with pytest.raises(FetchError, match="2022"):
        adapter.choose_years({2026: 575_000, 2027: 583_000})
    with pytest.raises(FetchError):
        adapter.choose_years({2014: 25})


def test_assessed_values_run_end_to_end(context_factory, monkeypatch) -> None:
    monkeypatch.setitem(ADAPTERS, "assessment_values", FewParcels)
    ctx = context_factory(now=NOW)
    source = relaxed(ctx.registry.sources["assessment_values"])
    ctx = context_factory(handler=FakeCarto(tables={"assessments": assessment_rows()}), now=NOW)
    fetched = fetch_source(ctx, source)
    assert fetched.outcome == "downloaded", fetched.detail
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, "assessment_values")
    assert store.current().rows > 0


def test_tenure_keeps_philadelphia_tracts_and_the_renter_share(context_factory) -> None:
    ctx = context_factory(handler=lambda request: httpx.Response(200, text=TENURE_ROWS), now=NOW)
    store = run(ctx, relaxed(ctx.registry.sources["acs_tenure"]))
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    assert [(r["geoid"], r["renter_pct"]) for r in rows] == [
        ("42101000101", 60.0),
        ("42101000102", None),
        ("42101000200", 37.5),
    ]
    assert rows[2]["owner_occupied"] is None
    assert (rows[0]["survey_start_year"], rows[0]["survey_end_year"]) == (2020, 2024)


def test_rent_burden_keeps_estimates_and_margins_and_drops_missing_codes(context_factory) -> None:
    ctx = context_factory(
        handler=lambda request: httpx.Response(200, text=RENT_BURDEN_ROWS), now=NOW
    )
    store = run(ctx, relaxed(ctx.registry.sources["acs_rent_burden"]))
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    assert [(r["geoid"], r["tract"]) for r in rows] == [
        ("42101", None),
        ("42101000101", "000101"),
        ("42101000102", "000102"),
    ]
    city, first, second = rows
    assert (city["rent_50_plus"], city["not_computed"]) == (90159, 22281)
    assert (first["renter_households"], first["renter_households_moe"]) == (1000, 90)
    assert (first["rent_50_plus"], first["rent_50_plus_moe"]) == (300, 60)
    assert (first["not_computed"], first["rent_40_50"]) == (50, 100)
    # The Census's codes for "could not be computed" never become numbers.
    assert second["renter_households"] == 0 and second["rent_50_plus"] is None
    assert second["rent_50_plus_moe"] is None
    assert (first["survey_start_year"], first["survey_end_year"]) == (2020, 2024)


@pytest.mark.parametrize("source_id", sorted(ACS_CONTEXT_ROWS))
def test_context_tables_keep_philadelphia_and_its_county_row(
    source_id: str, context_factory
) -> None:
    body = ACS_CONTEXT_ROWS[source_id]
    ctx = context_factory(handler=lambda request: httpx.Response(200, text=body), now=NOW)
    store = run(ctx, relaxed(ctx.registry.sources[source_id]))
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    assert rows[0]["geoid"] == "42101" and rows[0]["tract"] is None
    tracts = rows[1:]
    assert tracts and all(r["geoid"].startswith("42101") for r in tracts)
    assert all(len(r["geoid"]) == 11 and r["tract"] == r["geoid"][-6:] for r in tracts)


def test_context_table_with_a_missing_line_is_refused(context_factory) -> None:
    """A table whose file no longer has a line the adapter reads fails its download, so the last
    good copy stays (a renamed line must never become a silent null)."""
    body = "GEO_ID|B19013_E001\n1400000US42101000101|41250\n"
    ctx = context_factory(handler=lambda request: httpx.Response(200, text=body), now=NOW)
    source = relaxed(ctx.registry.sources["acs_income"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    checked = validate_source(ctx, source)
    assert checked.outcome != "ok"
    assert "B19013_M001" in checked.detail


@pytest.mark.parametrize(
    ("label", "word"),
    [
        ("Rising Pressure Middle & Vulnerable Markets", "rising"),
        ("Steady Pressure Middle & Vulnerable Markets", "steady"),
        ("Falling Pressure Middle & Vulnerable Markets", "falling"),
        ("Strong Markets", "strong"),
        ("Middle-High", "rising"),
        ("Weak-High", "rising"),
        ("Strong-Stable", "steady"),
        ("Middle-Lagging", "falling"),
        (" ", None),
        (None, None),
        ("Something new", None),
    ],
)
def test_market_value_analysis_pressure_in_one_word(label, word) -> None:
    assert mva_pressure(label) == word


def mva_layer(fields: list[tuple[str, str]], values: list[dict]) -> FakeArcgis:
    features = [
        {
            "type": "Feature",
            "properties": {"objectid": n + 1, **row},
            "geometry": mapping(box(-75.15 + n / 100, 39.99, -75.14 + n / 100, 40.0)),
        }
        for n, row in enumerate(values)
    ]
    return FakeArcgis(
        fields=[{"name": "objectid", "type": "esriFieldTypeOID"}]
        + [{"name": name, "type": f"esriFieldType{kind}"} for name, kind in fields],
        features=features,
    )


@pytest.mark.parametrize(
    ("fields", "values", "expected"),
    [
        (
            [
                ("geoid", "String"),
                ("mva_clusterletter", "String"),
                ("chh", "Integer"),
                ("mvaxdrr_priority_areas", "String"),
            ],
            [
                {
                    "geoid": "421010101001",
                    "mva_clusterletter": "G",
                    "chh": 500,
                    "mvaxdrr_priority_areas": "Rising Pressure Middle & Vulnerable Markets",
                },
                {
                    "geoid": "421010101002",
                    "mva_clusterletter": "A+",
                    "chh": 300,
                    "mvaxdrr_priority_areas": "Strong Markets",
                },
            ],
            [("421010101001", "G", "rising", 500), ("421010101002", "A+", "strong", 300)],
        ),
        (
            [("geoid", "String"), ("clusterletter", "String"), ("mvadrr", "String")],
            [
                {"geoid": "421010101001", "clusterletter": "F", "mvadrr": "Middle-High"},
                {"geoid": "421010101002", "clusterletter": " ", "mvadrr": " "},
            ],
            [("421010101001", "F", "rising", None), ("421010101002", None, None, None)],
        ),
    ],
    ids=["2026", "2023"],
)
def test_market_value_analysis_reads_both_editions(
    fields, values, expected, context_factory, monkeypatch
) -> None:
    ctx = context_factory(handler=mva_layer(fields, values), now=NOW)
    store = run(ctx, relaxed(ctx.registry.sources["market_value_analysis"]))
    table = pq.read_table(store.path_for(store.current()))
    assert table.column_names == [
        "geoid",
        "cluster",
        "pressure_label",
        "households",
        "pressure",
        "geometry",
    ]
    rows = table.to_pylist()
    assert [(r["geoid"], r["cluster"], r["pressure"], r["households"]) for r in rows] == expected
    assert store.current().format == "geoparquet"
    assert isinstance(
        ADAPTERS["market_value_analysis"](ctx.registry.sources["market_value_analysis"], ctx),
        MarketValueAnalysis,
    )
