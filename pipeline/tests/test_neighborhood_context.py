"""Neighborhood context on the displacement watch (M4.7, issue #43): rent burden, the middle rent
and income, and empty homes by census tract, each with its margin of error, published only on
watch areas (docs/ETHICS.md: only watch areas carry numbers on the map)."""

from __future__ import annotations

import json
import math
from pathlib import Path

import pyarrow as pa
import pytest

from placekeepers.derive import displacement as dw
from placekeepers.derive import tract_context as tc
from placekeepers.publish.displacement import context_properties, manifest_block
from placekeepers.publish.layers import builder_for
from placekeepers.snapshots import SnapshotStore

from .conftest import install_snapshot
from .test_displacement import AS_OF, TRACTS, WHEN, install_city


def test_a_sums_margin_is_the_root_of_the_squares() -> None:
    assert tc.sum_moe(30, 40) == pytest.approx(50.0)
    assert tc.sum_moe(30, None) is None


def test_a_shares_margin_follows_the_census_formula() -> None:
    # 300 of 950 households, margins 60 and sqrt(90**2 + 20**2): the Census Bureau's formula for
    # a proportion, worked by hand.
    whole_moe = math.sqrt(90**2 + 20**2)
    p = 300 / 950
    expected = math.sqrt(60**2 - p**2 * whole_moe**2) / 950
    assert tc.share_moe(300, 60, 950, whole_moe) == pytest.approx(expected)
    # When the root would be of a negative, the ratio formula (plus) is used instead.
    assert tc.share_moe(10, 1, 20, 100) == pytest.approx(math.sqrt(1 + 0.25 * 100**2) / 20)
    assert tc.share_moe(10, None, 20, 5) is None
    assert tc.share_moe(10, 1, 0, 5) is None


BURDEN = {
    "renter_households": 1000,
    "renter_households_moe": 90,
    "not_computed": 50,
    "not_computed_moe": 20,
    "rent_50_plus": 300,
    "rent_50_plus_moe": 60,
}
VACANCY = {
    "for_rent": 50,
    "for_rent_moe": 30,
    "rented_not_occupied": 10,
    "rented_not_occupied_moe": 12,
    "for_sale": 20,
    "for_sale_moe": 15,
    "sold_not_occupied": 5,
    "sold_not_occupied_moe": 8,
    "seasonal": 15,
    "seasonal_moe": 12,
    "migrant_workers": 0,
    "migrant_workers_moe": 12,
    "other_vacant": 100,
    "other_vacant_moe": 45,
}


def test_one_tracts_context_from_its_rows() -> None:
    c = tc.context_of(
        "42101000101",
        BURDEN,
        {"median_rent": 1180, "median_rent_moe": 95},
        {"median_income": 41250, "median_income_moe": 6900},
        {"homes": 1200, "homes_moe": 100, "vacant": 200, "vacant_moe": 60},
        VACANCY,
    )
    assert (c.renter_households, c.renters_counted) == (1000, 950)
    assert c.rent_burden_50_pct == 31.6  # 300 of the 950 whose share could be computed
    assert c.rent_burden_50_pct_moe == pytest.approx(
        round(100 * tc.share_moe(300, 60, 950, math.sqrt(90**2 + 20**2)), 1)
    )
    assert (c.median_rent, c.median_rent_moe) == (1180, 95)
    assert (c.median_income, c.median_income_moe) == (41250, 6900)
    assert (c.vacant, c.vacant_pct) == (200, 16.7)
    assert (c.for_rent, c.for_sale, c.other_vacant) == (50, 20, 100)
    assert c.not_yet_moved_in == 15 and c.not_yet_moved_in_moe == pytest.approx(math.sqrt(208))
    assert c.seasonal == 15 and c.seasonal_moe == pytest.approx(math.sqrt(288))


def test_a_median_the_census_could_not_compute_stays_missing() -> None:
    c = tc.context_of(
        "42101000102",
        {**BURDEN, "rent_50_plus": None, "rent_50_plus_moe": None},
        {"median_rent": None, "median_rent_moe": None},
        None,
        None,
        None,
    )
    assert c.rent_burden_50_pct is None and c.median_rent is None
    assert c.median_income is None and c.vacant is None


def test_the_city_comes_from_the_census_row_for_the_county() -> None:
    tables = {
        "acs_income": {
            "42101": {"median_income": 61953, "median_income_moe": 919},
            "42101000101": {"median_income": 41250, "median_income_moe": 6900},
        }
    }
    tracts, city = tc.measure(tables)
    assert [t.tract for t in tracts] == ["42101000101"]
    assert (city.tract, city.median_income) == ("city", 61953)


def test_the_card_shows_only_numbers_with_enough_behind_them() -> None:
    row = {
        "renters_counted": 99,
        "rent_burden_50_pct": 40.0,
        "rent_burden_50_pct_moe": 12.3,
        "median_rent": 1180,
        "median_rent_moe": 0.2,
        "median_income": None,
        "homes": 1200,
        "vacant": 200,
        "vacant_moe": 60.0,
        "vacant_pct": 16.7,
        "vacant_pct_moe": 4.6,
        "for_rent": 50,
        "for_rent_moe": 30.0,
        "for_sale": 0,
        "for_sale_moe": 12.0,
        "not_yet_moved_in": None,
        "seasonal": 15,
        "seasonal_moe": 16.97,
        "other_vacant": 100,
        "other_vacant_moe": 45.0,
    }
    assert context_properties(row) == {
        # Too few renter households (99) for a share: no rent burden at all.
        "gr": 1180,
        "grm": 1,  # a margin is never shown as 0
        "hu": 1200,
        "vh": 200,
        "vhm": 60,
        "vp": 17,
        "vpm": 5,
        "vr": 50,
        "vrm": 30,
        "vs": 0,
        "vsm": 12,
        "vz": 15,
        "vzm": 17,
        "vo": 100,
        "vom": 45,
    }
    assert context_properties({**row, "renters_counted": 100})["rb"] == 40
    assert "vh" not in context_properties({**row, "homes": 99})
    assert context_properties(None) == {}


def install_context(ctx) -> None:
    """The five tables for the small city's three tracts and its county row."""
    geoids = ["42101", *TRACTS]

    def install(source_id: str, columns: dict[str, list]) -> None:
        table = pa.table(
            {
                "geoid": geoids,
                "tract": [None, *(g[-6:] for g in TRACTS)],
                **columns,
                "survey_start_year": [2020] * 4,
                "survey_end_year": [2024] * 4,
            }
        )
        install_snapshot(ctx, source_id, table, geometry=False, fetched_at=WHEN)

    install(
        "acs_rent_burden",
        {
            "renter_households": [327523, 400, 350, 240],
            "renter_households_moe": [4547, 60, 50, 40],
            "not_computed": [22281, 20, 10, 40],
            "not_computed_moe": [1775, 10, 8, 20],
            "rent_50_plus": [90159, 190, 100, 80],
            "rent_50_plus_moe": [3348, 45, 30, 30],
        },
    )
    install(
        "acs_rent", {"median_rent": [1397, 1100, 1250, None], "median_rent_moe": [14, 80, 90, None]}
    )
    install(
        "acs_income",
        {
            "median_income": [61953, 38000, 52000, 30000],
            "median_income_moe": [919, 5000, 6000, 9000],
        },
    )
    install(
        "acs_occupancy",
        {
            "homes": [748270, 1100, 560, 330],
            "homes_moe": [241, 80, 60, 40],
            "occupied": [679428, 1000, 500, 300],
            "occupied_moe": [2660, 80, 60, 40],
            "vacant": [68842, 100, 60, 30],
            "vacant_moe": [2623, 40, 30, 20],
        },
    )
    install(
        "acs_vacancy",
        {
            name: values
            for name, values in {
                "vacant": [68842, 100, 60, 30],
                "for_rent": [18918, 20, 10, 5],
                "rented_not_occupied": [7159, 5, 5, 0],
                "for_sale": [3774, 10, 5, 0],
                "sold_not_occupied": [3658, 5, 0, 0],
                "seasonal": [2630, 0, 5, 0],
                "migrant_workers": [37, 0, 0, 0],
                "other_vacant": [32666, 60, 35, 25],
            }.items()
            for name, values in ((name, values), (f"{name}_moe", [max(1, v // 3) for v in values]))
        },
    )


def test_the_context_run_writes_every_tract_and_the_city(context_factory) -> None:
    ctx = context_factory()
    install_context(ctx)
    result = tc.run(ctx, AS_OF)
    assert result.survey_years == [2020, 2024]
    assert result.city["rent_burden_50_pct"] == 29.5
    assert result.city["median_rent"] == 1397
    assert result.counts == {
        "tracts": 3,
        "rent_burden": 3,
        "median_rent": 2,
        "median_income": 3,
        "vacant": 3,
    }
    rows = tc.load_context(tc.output_path(ctx))
    assert set(rows) == set(TRACTS)
    assert rows["42101000100"]["rent_burden_50_pct"] == 50.0  # 190 of 380


def test_a_missing_table_leaves_its_numbers_out_and_says_so(context_factory) -> None:
    ctx = context_factory()
    install_context(ctx)
    store = SnapshotStore(ctx.cache, "acs_rent")
    store.path_for(store.current()).unlink()
    (ctx.cache.root / "snapshots" / "acs_rent" / "current.parquet").unlink()
    result = tc.run(ctx, AS_OF)
    assert result.missing_sources == ["acs_rent"]
    assert any("without acs_rent" in note for note in result.notes)
    assert all(row["median_rent"] is None for row in tc.load_context(tc.output_path(ctx)).values())


def test_only_watch_areas_carry_the_context_and_the_city_is_in_the_manifest(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory()
    install_city(ctx)
    install_context(ctx)
    dw.run(ctx, AS_OF)
    tc.run(ctx, AS_OF)
    builder = builder_for("tiles/displacement.pmtiles", "watch")
    assert builder is not None
    assert set(tc.SOURCES) <= set(builder.extras)
    store = SnapshotStore(ctx.cache, "census_tracts_2020")
    out = tmp_path / "watch.geojson"
    builder.build(ctx, {"census_tracts_2020": store.path_for(store.current())}, out, AS_OF)
    watch = {
        f["properties"]["id"]: f["properties"] for f in json.loads(out.read_text())["features"]
    }
    # Tract 2 is not a watch area, so its numbers are published nowhere.
    assert sorted(watch) == ["42101000100", "42101000300"]
    first = watch["42101000100"]
    assert (first["rh"], first["rb"], first["gr"], first["hi"]) == (380, 50, 1100, 38000)
    assert (first["hu"], first["vh"], first["vp"], first["vo"]) == (1100, 100, 9, 60)
    third = watch["42101000300"]
    assert "gr" not in third  # the Census computed no middle rent there
    assert third["rh"] == 200 and third["rb"] == 40
    block = manifest_block(ctx)
    assert block is not None
    assert {k: block["city"][k] for k in ("rb", "gr", "hi", "vp")} == {
        "rb": 30,
        "gr": 1397,
        "hi": 61953,
        "vp": 9,
    }
    assert block["context"] == {"survey_years": [2020, 2024], "min_renters": 100, "min_homes": 100}


def test_the_watch_layer_lists_the_census_tables(context_factory) -> None:
    layer = context_factory().registry.layers["displacement_watch"]
    assert set(tc.SOURCES) <= set(layer.sources)
