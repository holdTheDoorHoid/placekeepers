"""The displacement watch (M4.1): its rules for sales, assessed values and signs, the measures on a
small made up city, and what publish writes from them (the watch areas, `dw` on the lots, the
lot dossiers and the manifest)."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import box

from placekeepers.derive import displacement as dw
from placekeepers.derive.displacement import (
    SIGNS,
    CityMeasures,
    TractMeasures,
    counts_for_assessment,
    is_market_home_sale,
    is_watch,
    measure,
    periods_ending,
    signs_of,
)
from placekeepers.publish import publish
from placekeepers.publish.displacement import manifest_block, parcel_watch, watch_properties

from .conftest import install_snapshot

WHEN = "2026-10-05T10:00:00Z"
AS_OF = date(2026, 10, 5)
P, C, A, R, M = (SIGNS[k] for k in ("prices", "companies", "assessments", "renters", "mva"))
#: Rent burden (owner, 2026-10-09).
B = SIGNS["rent_burden"]


def test_periods_are_three_years_each_five_years_apart() -> None:
    periods = periods_ending(date(2026, 9, 2))
    assert periods.to_json() == {
        "earlier_from": "2018-09-03",
        "earlier_to": "2021-09-02",
        "recent_from": "2023-09-03",
        "recent_to": "2026-09-02",
    }
    assert periods.of(date(2026, 9, 2)) == "recent"
    assert periods.of(date(2023, 9, 2)) is None
    assert periods.of(date(2018, 9, 3)) == "earlier"
    assert periods.of(date(2022, 6, 1)) is None
    # A leap day ends on the last day of February in other years.
    assert periods_ending(date(2028, 2, 29)).earlier_to == date(2023, 2, 28)


@pytest.mark.parametrize(
    ("kind", "price", "count", "category", "built", "expected"),
    [
        ("DEED", 150_000, 1, "1", 1925, True),
        ("MISCELLANEOUS DEED", 150_000, 1, "2", 1925, True),
        ("DEED", 150_000, None, "1", None, True),
        # The lot pages' rule: token prices, sheriff, condemnation and adverse possession deeds
        # are not sales.
        ("DEED", 100, 1, "1", 1925, False),
        ("DEED SHERIFF", 40_000, 1, "1", 1925, False),
        ("SHERIFF'S DEED", 40_000, 1, "1", 1925, False),
        ("DEED OF CONDEMNATION", 40_000, 1, "1", 1925, False),
        ("DEED - ADVERSE POSSESSION", 40_000, 1, "1", 1925, False),
        # The Land Bank's own sales at set prices, prices shared over several properties, and
        # filings that are not deeds.
        ("DEED LAND BANK", 15_000, 1, "1", 1925, False),
        ("DEED", 900_000, 3, "1", 1925, False),
        ("MORTGAGE", 150_000, 1, "1", 1925, False),
        # Only homes: not vacant land, stores or apartment buildings.
        ("DEED", 40_000, 1, "6", None, False),
        ("DEED", 2_000_000, 1, "14", 1960, False),
        # A house built after the sale: that sale was of the land or the house before.
        ("DEED", 60_000, 1, "1", 2025, False),
        ("DEED", 450_000, 1, "1", 2024, True),
    ],
)
def test_which_sales_count(kind, price, count, category, built, expected) -> None:
    assert is_market_home_sale(kind, price, count, category, built, date(2024, 6, 1)) is expected


def test_which_homes_count_for_assessed_values() -> None:
    assert counts_for_assessment("1", 1925, 90_000, 2022)
    assert counts_for_assessment("2", None, 90_000, 2022)
    assert counts_for_assessment("1", 2020, 90_000, 2022)
    assert not counts_for_assessment("1", 2021, 90_000, 2022)  # built since
    assert not counts_for_assessment("1", 1925, 9_000, 2022)  # a shell or a lot's value
    assert not counts_for_assessment("6", None, 90_000, 2022)
    assert not counts_for_assessment("1", 1925, None, 2022)


CITY = CityMeasures(
    price_change_pct=28.0, company_pct=27.0, assessment_change_pct=69.0, rent_burden_pct=29.5
)


def tract(**kwargs) -> TractMeasures:
    base = {"tract": "42101000100", "sales_earlier": 80, "sales_recent": 60, "homes_assessed": 300}
    return TractMeasures(**{**base, "occupied": 900, **kwargs})


@pytest.mark.parametrize(
    ("measures", "signs"),
    [
        ({"price_change_pct": 53.0}, P),
        ({"price_change_pct": 52.9}, 0),
        ({"price_change_pct": 90.0, "sales_recent": 49}, 0),  # too few sales to tell
        ({"company_pct": 42.0}, C),
        ({"company_pct": 41.9}, 0),
        ({"assessment_change_pct": 99.0}, A),
        ({"assessment_change_pct": 120.0, "homes_assessed": 49}, 0),
        ({"renter_pct": 60.0}, R),
        ({"renter_pct": 95.0, "occupied": 99}, 0),
        ({"mva_rising": 1, "mva_block_groups": 3}, M),
        # Rent burden: 10 points above the city's 29.5%, with at least 100 renter households.
        ({"rent_burden_pct": 39.5, "renters_counted": 100}, B),
        ({"rent_burden_pct": 39.4, "renters_counted": 500}, 0),
        ({"rent_burden_pct": 80.0, "renters_counted": 99}, 0),  # too few renters to tell
        ({"rent_burden_pct": None, "renters_counted": 500}, 0),
        (
            {"price_change_pct": 60.0, "company_pct": 50.0, "assessment_change_pct": 100.0},
            P | C | A,
        ),
    ],
)
def test_signs_against_the_city(measures, signs) -> None:
    assert signs_of(tract(**measures), CITY) == signs


def test_without_the_citys_rent_burden_the_sign_cannot_hold() -> None:
    no_city = CityMeasures(price_change_pct=28.0)
    assert signs_of(tract(rent_burden_pct=90.0, renters_counted=900), no_city) == 0


def test_rent_burden_alone_never_makes_a_watch_area() -> None:
    """A tract with many renters paying half their income on rent is in the watch only with a
    sign about prices: here the first has the Market Value Analysis's rising pressure, the second
    only renters, the third nothing else."""
    burden = {"t1": (500, 55.0, 9.0), "t2": (500, 55.0, 9.0), "t3": (500, 55.0, 9.0)}
    renters = {"t2": (900, 700, 77.8)}
    measures, city = measure(["t1", "t2", "t3"], [], {}, renters, {"t1": (2, 1)}, {}, burden, 29.5)
    one, two, three = measures
    assert city.rent_burden_pct == 29.5
    assert (one.signs, one.watch) == (M | B, True)
    assert (two.signs, two.watch) == (R | B, False)
    assert (three.signs, three.watch) == (B, False)
    assert (one.renters_counted, one.rent_burden_pct, one.rent_burden_moe) == (500, 55.0, 9.0)


@pytest.mark.parametrize(
    ("signs", "watch"),
    [
        (0, False),
        (P, False),
        (A, False),
        (P | A, True),
        (P | R, True),
        (A | C, True),
        (M | R, True),
        # Company buyers, renters and rent burden say who is exposed, not that prices are rising.
        (C | R, False),
        (B, False),
        (R | B, False),
        (C | R | B, False),
        (M | B, True),
        (P | B, True),
        (A | B, True),
        (P | C | A | R | M | B, True),
    ],
)
def test_the_watch_needs_two_signs_one_about_prices(signs, watch) -> None:
    assert is_watch(signs) is watch


# A made up city of three tracts side by side
TRACTS = {
    "42101000100": box(-75.20, 39.95, -75.19, 39.96),
    "42101000200": box(-75.19, 39.95, -75.18, 39.96),
    "42101000300": box(-75.18, 39.95, -75.17, 39.96),
}


def accounts(tract_index: int, n: int) -> list[str]:
    return [f"{tract_index}{i:08d}" for i in range(n)]


def install_city(ctx) -> None:
    """Tract 1: prices doubled, many company buyers, values doubled. Tract 2: prices up 10%,
    most homes rented. Tract 3: too few sales to tell, most homes rented, and a Market Value
    Analysis block group with rising pressure."""
    install = lambda source, table, geometry=False: install_snapshot(  # noqa: E731
        ctx, source, table, geometry=geometry, fetched_at=WHEN
    )
    install(
        "census_tracts_2020",
        pa.table(
            {
                "geoid": list(TRACTS),
                "geometry": [shapely.to_wkb(s, flavor="iso") for s in TRACTS.values()],
            }
        ),
        geometry=True,
    )
    parcels = {1: accounts(1, 70), 2: accounts(2, 70), 3: accounts(3, 15)}
    rows = []
    for index, found in parcels.items():
        west = -75.20 + (index - 1) * 0.01
        for i, account in enumerate(found):
            rows.append((account, "1", "1925", 39.955, west + 0.001 + i * 0.0001))
    rows.append(("400000000", "4", "1960", 39.955, -75.195))  # a store in tract 1
    rows.append(("500000000", "1", "2025", 39.955, -75.195))  # built in 2025, in tract 1
    install(
        "opa_properties",
        pa.table(
            {
                name: [r[i] for r in rows]
                for i, name in enumerate(
                    ["parcel_number", "category_code", "year_built", "lat", "lng"]
                )
            }
        ),
    )
    sales = []

    def sale(account: str, day: str, price: float, buyer: str = "individual", **kw) -> None:
        sales.append(
            {
                "document_type": kw.get("kind", "DEED"),
                "display_date": date.fromisoformat(day),
                "opa_account_num": account,
                "total_consideration": price,
                "adjusted_total_consideration": price,
                "property_count": kw.get("count", 1),
                "buyer_type": buyer,
            }
        )

    for i in range(60):
        sale(parcels[1][i], "2019-06-01", 100_000)
        sale(parcels[1][i], "2025-06-01", 200_000, "company" if i < 40 else "individual")
        sale(parcels[2][i], "2019-06-01", 200_000)
        sale(parcels[2][i], "2025-06-01", 220_000, "company" if i < 6 else "individual")
    for i in range(10):
        sale(parcels[3][i], "2019-06-01", 150_000)
        sale(parcels[3][i], "2025-06-01", 300_000)
    # None of these count: a sheriff sale, a Land Bank sale, a shared price, a token price, a
    # store, a house built after its sale, a sale between the periods, an unknown parcel.
    sale(parcels[1][0], "2025-07-01", 5_000, kind="SHERIFF'S DEED")
    sale(parcels[1][1], "2025-07-01", 9_000, kind="DEED LAND BANK")
    sale(parcels[1][2], "2025-07-01", 5_000_000, count=12)
    sale(parcels[1][3], "2025-07-01", 1)
    sale("400000000", "2025-07-01", 1_000_000, "company")
    sale("500000000", "2019-07-01", 30_000, "company")
    sale(parcels[1][4], "2022-07-01", 999_999)
    sale("999999999", "2025-07-01", 999_999)
    # The newest recorded sale sets the periods' end.
    sale(parcels[2][69], "2026-09-02", 220_000)
    install("real_estate_sales", pa.Table.from_pylist(sales))

    values = []
    for index, ratio in ((1, 2.0), (2, 1.2), (3, 1.3)):
        for account in parcels[index][:60]:
            values.append({"parcel_number": account, "year": 2022, "market_value": 100_000})
            values.append(
                {"parcel_number": account, "year": 2027, "market_value": int(100_000 * ratio)}
            )
    install("assessment_values", pa.Table.from_pylist(values))
    install(
        "acs_tenure",
        pa.table(
            {
                "geoid": list(TRACTS),
                "occupied": [1000, 500, 300],
                "renter_occupied": [400, 350, 240],
                "renter_pct": [40.0, 70.0, 80.0],
                "survey_start_year": [2020] * 3,
                "survey_end_year": [2024] * 3,
            }
        ),
    )
    # Rent burden (owner, 2026-10-09): the city's 29.5%; tract 1 with too few renter households
    # to tell, tract 2 with half its renters paying half their income or more, tract 3 with 20%.
    install(
        "acs_rent_burden",
        pa.table(
            {
                "geoid": ["42101", *TRACTS],
                "tract": [None, *(g[-6:] for g in TRACTS)],
                "renter_households": [327523, 90, 400, 300],
                "renter_households_moe": [4547, 30, 60, 50],
                "not_computed": [22281, 5, 20, 0],
                "not_computed_moe": [1775, 5, 10, 11],
                "rent_50_plus": [90159, 60, 190, 60],
                "rent_50_plus_moe": [3348, 20, 45, 30],
                "survey_start_year": [2020] * 4,
                "survey_end_year": [2024] * 4,
            }
        ),
    )
    install(
        "market_value_analysis",
        pa.table(
            {
                "geoid": ["421010003001", "421010003002", "421010001001"],
                "cluster": ["G", "H", "C"],
                "pressure_label": ["Rising Pressure Middle & Vulnerable Markets", "x", "y"],
                "households": [100, 120, 400],
                "pressure": ["rising", "steady", "steady"],
                "geometry": [shapely.to_wkb(TRACTS["42101000300"], flavor="iso")] * 3,
            }
        ),
        geometry=True,
    )


def test_the_measures_of_a_small_city(context_factory) -> None:
    ctx = context_factory()
    install_city(ctx)
    result = dw.run(ctx, AS_OF)
    assert result.periods["recent_to"] == "2026-09-02"
    assert result.assessment_years == [2022, 2027]
    assert result.survey_years == [2020, 2024]
    city = result.city
    assert (city["median_earlier"], city["median_recent"]) == (150_000, 220_000)
    assert city["price_change_pct"] == 46.7
    assert city["company_pct"] == pytest.approx(100 * 46 / 131, abs=0.1)
    assert city["assessment_change_pct"] == 30.0
    assert city["renter_pct"] == 55.0
    rows = {r["tract"]: r for r in pq.read_table(result.path).to_pylist()}
    one, two, three = (rows[t] for t in TRACTS)
    assert (one["sales_earlier"], one["sales_recent"]) == (60, 60)
    assert one["price_change_pct"] == 100.0
    assert one["company_pct"] == pytest.approx(66.7)
    assert one["assessment_change_pct"] == 100.0
    assert one["signs"] == P | C | A and one["watch"]
    assert two["signs"] == R | B and not two["watch"]
    # Too few sales and homes to tell; renters and the Market Value Analysis make the watch.
    assert three["sales_recent"] == 10 and three["mva_rising"] == 1
    assert three["signs"] == R | M and three["watch"]
    # Many renters pay half their income on rent in tract 2, but without a sign about prices it
    # stays out of the watch; tract 1 has too few renter households to tell (owner, 2026-10-09).
    assert two["rent_burden_pct"] == 50.0 and two["renters_counted"] == 380
    assert one["renters_counted"] == 85
    assert result.city["rent_burden_pct"] == 29.5
    assert result.counts["watch"] == 2
    assert result.counts["signs"] == {
        "prices": 1,
        "companies": 1,
        "assessments": 1,
        "renters": 2,
        "mva": 1,
        "rent_burden": 1,
    }
    assert result.counts["measured"]["rent_burden"] == 2
    assert result.counts["sales_left_out"]["not_in_opa"] == 1
    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["thresholds"]["price_points"] == 25
    assert summary["thresholds"]["rent_burden_points"] == 10
    assert summary["thresholds"]["min_renters"] == 100


def test_a_missing_sign_is_left_out_and_said(context_factory) -> None:
    ctx = context_factory()
    install_city(ctx)
    from placekeepers.snapshots import SnapshotStore

    store = SnapshotStore(ctx.cache, "market_value_analysis")
    store.path_for(store.current()).unlink()
    (ctx.cache.root / "snapshots" / "market_value_analysis" / "current.parquet").unlink()
    result = dw.run(ctx, AS_OF)
    assert result.missing_sources == ["market_value_analysis"]
    assert any("Market Value Analysis is left out" in note for note in result.notes)
    assert result.counts["watch"] == 1


def test_published_areas_hold_only_measures_that_mean_something() -> None:
    row = {
        "tract": "42101000300",
        "place": "Hunting Park",
        "signs": R | M,
        "sales_earlier": 10,
        "sales_recent": 12,
        "median_earlier": 150_000.0,
        "median_recent": 300_000.0,
        "price_change_pct": 100.0,
        "company_pct": 50.0,
        "homes_assessed": 30,
        "assessment_change_pct": 80.4,
        "occupied": 300,
        "renter_pct": 80.0,
        "mva_block_groups": 2,
        "mva_rising": 1,
    }
    assert watch_properties(row) == {
        "id": "42101000300",
        "w": R | M,
        "nm": "Hunting Park",
        "n0": 10,
        "n1": 12,
        "oc": 300,
        "rp": 80,
        "mb": 2,
        "mr": 1,
    }


def test_a_watch_area_carries_its_rent_burden_with_its_margin() -> None:
    row = {
        "tract": "42101000300",
        "place": None,
        "signs": M | B,
        "sales_earlier": 0,
        "sales_recent": 0,
        "median_earlier": None,
        "median_recent": None,
        "price_change_pct": None,
        "company_pct": None,
        "homes_assessed": 0,
        "assessment_change_pct": None,
        "occupied": 300,
        "renter_pct": 40.0,
        "mva_block_groups": 1,
        "mva_rising": 1,
        "renters_counted": 380,
        "rent_burden_pct": 50.0,
        "rent_burden_moe": 8.5,
    }
    properties = watch_properties(row)
    assert (properties["w"], properties["rh"], properties["rb"], properties["rbm"]) == (
        M | B,
        380,
        50,
        9,
    )
    assert "rb" not in watch_properties({**row, "renters_counted": 99})


def lens_factors(ctx, tracts: dict[str, str]) -> None:
    path = ctx.cache.root / "derived" / "lens_factors.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    nothing = pa.nulls(len(tracts), pa.int16())
    factors = {name: nothing for name in ("f_vacant", "f_shoot", "f_poverty", "f_canopy")}
    table = pa.table({"opa": list(tracts), **factors, "tract": list(tracts.values())})
    pq.write_table(table, path)


def test_publish_marks_lots_dossiers_and_the_manifest(context_factory, tmp_path: Path) -> None:
    from .test_dossiers import NOW, install_everything, parcel, write_model

    ctx = context_factory(now=NOW)
    # The watch is measured on the small city, then the lot pages' own parcels replace its OPA
    # records, as publish reads them.
    install_city(ctx)
    dw.run(ctx, AS_OF)
    install_everything(ctx)
    write_model(
        ctx,
        [
            ("371000001", "lot", 1, "high", 3, 0, 1 | 4 | 8, 2, None, None, None),
            ("372000001", "lot", 1, "high", 3, 0, 1 | 8, 1, None, None, None),
            ("372000002", "lot", 1, "high", 3, 0, 1 | 8, 1, None, None, None),
        ],
    )
    lens_factors(
        ctx, {"371000001": "42101000100", "372000001": "42101000200", "372000002": "42101000300"}
    )
    out = tmp_path / "data"
    manifest = publish(ctx, out, as_of=AS_OF).manifest

    lots = {
        f["properties"]["id"]: f["properties"]
        for f in json.loads((out / "tiles" / "lots.parcels.geojson").read_text())["features"]
    }
    assert lots["371000001"]["dw"] == P | C | A
    assert "dw" not in lots["372000001"]
    assert lots["372000002"]["dw"] == R | M
    assert parcel(out, "371000001")["displacement"] == {
        "tract": "42101000100",
        "signs": P | C | A,
    }
    assert "displacement" not in parcel(out, "372000001")

    watch = json.loads((out / "tiles" / "displacement.watch.geojson").read_text())["features"]
    assert sorted(f["properties"]["id"] for f in watch) == ["42101000100", "42101000300"]
    first = next(f["properties"] for f in watch if f["properties"]["id"] == "42101000100")
    assert (first["p0"], first["p1"], first["pc"], first["cb"]) == (100_000, 200_000, 100, 67)
    assert manifest["layers"]["displacement_watch"]["file"] == "tiles/displacement.pmtiles"

    block = manifest["displacement"]
    assert block["city"] == {
        "p0": 150_000,
        "p1": 220_000,
        "pc": 47,
        "cb": 35,
        "ac": 30,
        "rp": 55,
        # No neighborhood context was measured here (M4.7, tests/test_neighborhood_context.py),
        # but the rent burden sign's own baseline is the city's rent burden (owner, 2026-10-09).
        "rb": 30,
        "gr": None,
        "hi": None,
        "vp": None,
    }
    assert block["context"] is None
    assert block["areas"] == {"tracts": 3, "watch": 2}
    assert block["periods"]["recent_to"] == "2026-09-02"
    assert any(note.startswith("Displacement watch: 2 of 3") for note in manifest["notes"])
    assert manifest_block(ctx) == block


def test_without_the_watch_nothing_is_marked(context_factory, tmp_path: Path) -> None:
    ctx = context_factory()
    assert parcel_watch(ctx.cache.root / "derived") == {}
    assert manifest_block(ctx) is None


def test_the_web_app_reads_the_same_signs_and_rule() -> None:
    """web/tests/displacement.test.ts checks src/displacement/watch.ts against the same file."""
    parity = json.loads(
        (Path(__file__).parent / "fixtures" / "watch_parity.json").read_text(encoding="utf-8")
    )
    assert parity["signs"] == SIGNS
    assert parity["price_signs"] == dw.PRICE_SIGNS
    assert len(parity["cases"]) == 64
    for case in parity["cases"]:
        assert is_watch(case["signs"]) is case["watch"], case


def test_stops_take_the_signs_of_the_area_they_stand_in(context_factory) -> None:
    from placekeepers.publish.displacement import point_watch

    ctx = context_factory()
    install_city(ctx)
    dw.run(ctx, AS_OF)
    from placekeepers.derive.lenses import current_snapshot

    tracts = current_snapshot(ctx, "census_tracts_2020")
    found = point_watch(ctx, tracts, [-75.195, -75.185, -75.175, -75.0], [39.955] * 4)
    assert found == [P | C | A, None, R | M, None]
    assert point_watch(ctx, None, [-75.195], [39.955]) == [None]
