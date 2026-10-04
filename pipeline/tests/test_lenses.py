"""The violence reduction lens factors (placekeepers.derive.lenses) and the tree canopy adapter.

No spatial extension and no network: shapes are made with shapely, snapshots are tiny Parquet
files, and the canopy layer is a fake ArcGIS service.
"""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

import h3
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box

from placekeepers.adapters.lens_context import CANOPY_CLASSES, CellAreas, cell_polygon
from placekeepers.derive import lenses
from placekeepers.derive.street_safety import to_meters
from placekeepers.publish import publish
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, arcgis_feature, install_snapshot

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
AS_OF = date(2026, 10, 4)
WHEN = "2026-10-04T14:00:00Z"
LAT0, LNG0 = 39.98, -75.15
M_PER_LAT, M_PER_LNG = 111_035.0, 85_290.0


def at(east_m: float, north_m: float) -> tuple[float, float]:
    """Latitude and longitude a number of meters east and north of the origin."""
    return LAT0 + north_m / M_PER_LAT, LNG0 + east_m / M_PER_LNG


def square(east_m: float, north_m: float, side_m: float = 10.0):
    lat, lng = at(east_m, north_m)
    return box(lng, lat, lng + side_m / M_PER_LNG, lat + side_m / M_PER_LAT)


def rect(east_m: float, north_m: float, width_m: float, height_m: float):
    lat, lng = at(east_m, north_m)
    return box(lng, lat, lng + width_m / M_PER_LNG, lat + height_m / M_PER_LAT)


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


# Percentiles, rings and treatment


def test_ties_share_a_rank_and_missing_values_stay_missing() -> None:
    # Sorted present values: 3, 5, 5, 10. Each rank is the share strictly lower.
    assert lenses.rank_or_none([5, 5, 3, None, 10]) == [25, 25, 0, None, 75]
    assert lenses.rank_or_none([0, 0, 0]) == [0, 0, 0]
    assert lenses.rank_or_none([None, None]) == [None, None]
    assert lenses.rank_or_none([]) == []


def test_the_ring_is_the_cell_and_its_six_neighbors() -> None:
    cell = h3.latlng_to_cell(LAT0, LNG0, 9)
    ring = lenses.ring_cells(cell)
    assert len(ring) == 7 and cell in ring
    neighbor = next(iter(h3.grid_ring(cell, 1)))
    two_away = next(iter(h3.grid_ring(cell, 2)))
    counts = {cell: 2, neighbor: 3, two_away: 100}
    assert lenses.ring_sum(cell, counts) == 5


def test_landcare_lots_and_buildings_with_fixed_doors_and_windows_are_treated() -> None:
    assert lenses.treatment("lot", landcare=True, doors_fixed=False) == "landcare"
    assert lenses.treatment("lot_conflict", landcare=True, doors_fixed=False) == "landcare"
    assert lenses.treatment("lot", landcare=False, doors_fixed=True) is None
    assert lenses.treatment("building", landcare=False, doors_fixed=True) == "doors_and_windows"
    # LandCare looks after lots, not buildings.
    assert lenses.treatment("building", landcare=True, doors_fixed=False) is None


DW, OWNER = "PM15-304.19V", "COMPLIED - OWNER REPAIR"


def violations_table(rows: list[tuple]) -> pa.Table:
    names = ["opa_account_num", "violationcode", "violationresolutioncode", "violationdate",
             "violationresolutiondate"]  # fmt: skip
    return pa.table({name: [row[i] for row in rows] for i, name in enumerate(names)})


def test_doors_and_windows_count_as_fixed_until_the_building_is_cited_again(tmp_path) -> None:
    path = tmp_path / "violations.parquet"
    enforced = "COMPLIED - BY ENFORCEMENT ACTION"
    rows = [
        ("500000003", DW, OWNER, date(2024, 2, 1), date(2024, 5, 1)),
        ("500000004", DW, OWNER, date(2023, 2, 1), date(2023, 5, 1)),
        ("500000004", "PM15-108.2", None, date(2025, 6, 1), None),  # open again
        ("500000005", DW, enforced, date(2024, 2, 1), date(2024, 5, 1)),
        ("50000009", DW, OWNER, date(2024, 2, 1), date(2024, 5, 1)),
    ]
    pq.write_table(violations_table(rows), path)
    # The City's seal (by enforcement action) is boards, not the trial's working doors and windows.
    assert lenses.doors_fixed(path) == {"500000003", "050000009"}
    assert lenses.doors_fixed(None) == set()


def test_a_point_outside_every_tract_has_none() -> None:
    tracts = np.array([square(0, 0, 500), square(500, 0, 500)], dtype=object)
    lat_in, lng_in = at(100, 100)
    lat_edge, lng_edge = at(500, 100)  # on the border: the first tract wins
    lat_out, lng_out = at(2000, 2000)
    points = shapely.points([lng_in, lng_edge, lng_out], [lat_in, lat_edge, lat_out])
    assert lenses.tracts_of(points, ["A", "B"], tracts) == ["A", "A", None]


def test_land_leaves_out_water_and_everything_outside_the_city() -> None:
    cell = h3.latlng_to_cell(LAT0, LNG0, 9)
    hexagon = cell_polygon(cell)
    west, south, east, north = hexagon.bounds
    middle = (west + east) / 2
    city = np.array([box(west - 0.01, south - 0.01, middle, north + 0.01)], dtype=object)
    water = np.array([box(middle - 0.0005, LAT0 - 0.0002, middle, LAT0 + 0.0002)], dtype=object)
    land = lenses.land_by_cell([cell], city, water)[cell]
    hexagon_m, city_m, water_m = (
        to_meters(np.array([g], dtype=object))[0] for g in (hexagon, city[0], water[0])
    )
    expected = hexagon_m.intersection(city_m).area - hexagon_m.intersection(water_m).area
    assert land == pytest.approx(expected, rel=1e-9)
    assert 0.4 * hexagon_m.area < land < 0.5 * hexagon_m.area
    # Without tracts the whole cell counts, less the water.
    assert lenses.land_by_cell([cell], None, water)[cell] == pytest.approx(
        hexagon_m.area - hexagon_m.intersection(water_m).area
    )


# The tree canopy adapter


def canopy_layer(features: list) -> FakeArcgis:
    fields = [
        {"name": "OBJECTID", "type": "esriFieldTypeOID"},
        {"name": "CLASS_NAME", "type": "esriFieldTypeString"},
        {"name": "Shape__Area", "type": "esriFieldTypeDouble"},
    ]
    return FakeArcgis(fields=fields, features=features)


def test_canopy_is_split_exactly_along_the_cell_edges(context_factory) -> None:
    big = square(-1500, -1500, 700)  # crosses several cells, away from the small ones
    small = square(10, 10, 20)
    features = [
        arcgis_feature({"OBJECTID": 1, "CLASS_NAME": "Gain", "Shape__Area": 1.0}, big),
        arcgis_feature({"OBJECTID": 2, "CLASS_NAME": "No Change", "Shape__Area": 1.0}, small),
        arcgis_feature(
            {"OBJECTID": 3, "CLASS_NAME": "Loss", "Shape__Area": 1.0}, square(40, 40, 10)
        ),
    ]
    fake = canopy_layer(features)
    ctx = context_factory(handler=fake, now=NOW)
    source = ctx.registry.sources["tree_canopy_2018"]
    source = source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, "tree_canopy_2018")
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    pages = [
        r for r in fake.requests if r.url.path.endswith("/query") and "resultOffset" in r.url.params
    ]
    assert pages and all(r.url.params["maxAllowableOffset"] == "0.000003" for r in pages)

    big_m, small_m, loss_m = (
        to_meters(np.array([g], dtype=object))[0] for g in (big, small, square(40, 40, 10))
    )
    assert len(rows) > 1
    assert sum(r["gain_m2"] for r in rows) == pytest.approx(big_m.area, rel=1e-6)
    assert sum(r["no_change_m2"] for r in rows) == pytest.approx(small_m.area, abs=0.2)
    for row in rows:
        assert row["canopy_2018_m2"] == pytest.approx(row["no_change_m2"] + row["gain_m2"])
        assert row["canopy_2008_m2"] == pytest.approx(row["no_change_m2"] + row["loss_m2"])
        assert row["canopy_2018_m2"] <= row["cell_m2"] + 0.1
    home = h3.latlng_to_cell(*at(20, 20), 9)
    assert next(r for r in rows if r["h3"] == home)["loss_m2"] == pytest.approx(
        loss_m.area, abs=0.2
    )


def test_an_unknown_canopy_class_stops_the_snapshot(context_factory) -> None:
    fake = canopy_layer([arcgis_feature({"OBJECTID": 1, "CLASS_NAME": "Shrub"}, square(0, 0))])
    ctx = context_factory(handler=fake, now=NOW)
    source = ctx.registry.sources["tree_canopy_2018"]
    assert fetch_source(ctx, source).outcome == "downloaded"
    checked = validate_source(ctx, source)
    assert checked.outcome != "ok"
    assert "Shrub" in checked.detail


def test_cell_areas_count_each_class_in_its_own_column() -> None:
    cells = sorted(h3.grid_disk(h3.latlng_to_cell(LAT0, LNG0, 9), 2))
    areas = CellAreas(cells)
    outside = areas.add([square(0, 0, 5), square(0, 0, 5)], [CANOPY_CLASSES.index("Gain"), 0])
    assert outside == pytest.approx(0, abs=1e-6)
    table = areas.table().to_pylist()
    assert len(table) == 1
    assert table[0]["gain_m2"] == pytest.approx(table[0]["no_change_m2"])


# A whole run on tiny snapshots, and the map layer


PARCELS = {
    # opa: (kind, confidence, lc, east, north)
    "500000001": ("lot", "high", 0, 0, 0),
    "500000002": ("lot", "medium", 1, 300, 0),
    "500000003": ("building", "high", 0, 600, 0),
    "500000004": ("building", "low", 0, 900, 0),
    "500000005": ("building", "medium", 0, 1200, 0),
    "500000006": ("lot", "high", 0, 5000, 5000),  # outside every tract
    "500000007": ("excluded", None, 0, 1500, 0),
    "500000008": ("lot_conflict", "low", 0, 0, 1500),
}


def westmost(cells) -> str:
    return min(cells, key=lambda c: h3.cell_to_latlng(c)[1])


def install_lens_inputs(ctx, skip: tuple[str, ...] = ()) -> None:
    """The vacancy model's output for PARCELS, and every input of the lens except `skip`."""
    derived = ctx.cache.root / "derived"
    derived.mkdir(parents=True, exist_ok=True)
    values = list(PARCELS.values())
    nothing = pa.array([None] * len(values), pa.int64())
    model = {
        "opa": list(PARCELS),
        "kind": [p[0] for p in values],
        "confidence": [p[1] for p in values],
        "k": [2 if p[0] == "building" else 1 for p in values],
        "vc": [{"high": 3, "medium": 2, "low": 1}.get(p[1]) for p in values],
        "lc": [p[2] for p in values],
        "rs": [8] * len(values),
        "n": [1] * len(values),
        "dy": nothing,
        "sy": nothing,
        "ny": nothing,
        "geometry": [wkb(square(p[3], p[4])) for p in values],
    }
    pq.write_table(pa.table(model), derived / "vacancy.parquet")
    counts = {"lot": {"high": 2, "medium": 1, "low": 1}, "excluded": 1}
    counts["building"] = {"high": 1, "medium": 1, "low": 1}
    summary = {"as_of": "2026-10-04", "notes": [], "counts": counts}
    (derived / "vacancy.json").write_text(json.dumps(summary))

    # The publish step builds the lots layer once any of its sources has a snapshot.
    opa = pa.table({"parcel_number": list(PARCELS)})
    install_snapshot(ctx, "opa_properties", opa, geometry=False, fetched_at=WHEN)

    # Shootings by the first parcel, west of every other parcel: two in its own cell (one too
    # old), one next door, one two cells away, and one with no location.
    home = h3.latlng_to_cell(*at(5, 5), 9)
    cells = (home, home, westmost(h3.grid_ring(home, 1)), westmost(h3.grid_ring(home, 2)))
    shots = [h3.cell_to_latlng(c) for c in cells]
    shootings = pa.table(
        {
            "lat": [s[0] for s in shots] + [None],
            "lng": [s[1] for s in shots] + [None],
            "date_": [
                date(2026, 9, 1),
                date(2022, 1, 1),
                date(2025, 1, 1),
                date(2026, 1, 1),
                date(2026, 2, 1),
            ],
        }
    )
    # Two tracts, one above the other: the 30 percent one holds the first five parcels, the 10
    # percent one the last; the sixth is outside both.
    tracts = pa.table(
        {
            "geoid": ["42101000100", "42101000200"],
            "geometry": [wkb(rect(-1000, -1000, 3000, 2000)), wkb(rect(-1000, 1000, 3000, 1000))],
        }
    )
    poverty = pa.table({"geoid": ["42101000100", "42101000200"], "poverty_pct": [30.0, 10.0]})
    canopy = pa.table(
        {
            "h3": [home],
            "canopy_2008_m2": [40_000.0],
            "canopy_2018_m2": [50_000.0],
            "cell_m2": [105_000.0],
        }
    )
    violations = violations_table(
        [
            ("500000003", DW, OWNER, date(2024, 2, 1), date(2024, 5, 1)),
            ("500000004", DW, OWNER, date(2023, 2, 1), date(2023, 5, 1)),
            ("500000004", "PM15-108.2", None, date(2025, 6, 1), None),
        ]
    )
    for source_id, table, geometry in (
        ("shootings", shootings, False),
        ("census_tracts_2020", tracts, True),
        ("acs_poverty", poverty, False),
        ("tree_canopy_2018", canopy, False),
        ("li_violations", violations, False),
    ):
        if source_id not in skip:
            install_snapshot(ctx, source_id, table, geometry=geometry, fetched_at=WHEN)


@pytest.fixture
def lens_ctx(context_factory):
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    return ctx


def test_a_run_gives_every_parcel_on_the_map_its_factors(lens_ctx) -> None:
    result = lenses.run(lens_ctx, AS_OF)
    rows = {r["opa"]: r for r in pq.read_table(result.path).to_pylist()}
    assert sorted(rows) == ["500000001", "500000002", "500000003", "500000004", "500000005",
                            "500000006", "500000008"]  # fmt: skip
    assert {opa: r["f_vacant"] for opa, r in rows.items()} == {
        "500000001": 100, "500000002": 0, "500000003": 0, "500000004": 100, "500000005": 100,
        "500000006": 100, "500000008": 100,
    }  # fmt: skip
    assert rows["500000002"]["treated"] == "landcare"
    assert rows["500000003"]["treated"] == "doors_and_windows"

    # The parcel by the shootings: two in its own cell within 36 months (one is too old) and one
    # next door; the one two cells away does not count.
    assert rows["500000001"]["shot_36m_near"] == 2
    assert rows["500000001"]["shot_12m_near"] == 1
    assert rows["500000001"]["f_shoot"] == max(r["f_shoot"] for r in rows.values())
    assert rows["500000006"]["shot_36m_near"] == 0 and rows["500000006"]["f_shoot"] == 0

    # Poverty: five parcels in the 30 percent tract, one in the 10 percent tract, one outside.
    assert rows["500000006"]["tract"] is None and rows["500000006"]["f_poverty"] is None
    assert rows["500000008"]["poverty_pct"] == 10.0 and rows["500000008"]["f_poverty"] == 0
    assert rows["500000001"]["f_poverty"] == round(100 * 1 / 6)

    # Canopy: only the first parcel's cell has trees, so it ranks lowest for "few trees". The
    # parcel outside the city has no land around it to measure.
    assert rows["500000001"]["canopy_2018_pct_near"] > 0
    assert rows["500000001"]["f_canopy"] == 0
    assert rows["500000005"]["canopy_2018_pct_near"] == 0
    assert rows["500000005"]["f_canopy"] > 0
    assert rows["500000006"]["f_canopy"] is None

    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["parcels"] == 7
    assert summary["spread"]["f_vacant"]["at_0"] == 2
    assert summary["spread"]["f_vacant"]["at_100"] == 5
    assert summary["spread"]["f_poverty"]["missing"] == 1
    assert summary["treated"] == {"landcare": 1, "doors_and_windows": 1}
    assert (
        "1 parcels on the map are outside every census tract, so they have no poverty rate"
        in (summary["notes"])
    )


def test_without_a_source_its_factor_is_left_out(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx, skip=("tree_canopy_2018",))
    result = lenses.run(ctx, AS_OF)
    assert result.missing_sources == ["tree_canopy_2018"]
    factors = lenses.load_factors(result.path)
    assert all("f_canopy" not in f for f in factors.values())
    assert all("f_vacant" in f and "f_shoot" in f for f in factors.values())
    assert "The violence lens ran without tree_canopy_2018, so f_canopy is left out" in result.notes


def test_the_lens_needs_the_vacancy_model(context_factory) -> None:
    with pytest.raises(RuntimeError, match="vacancy model"):
        lenses.run(context_factory(now=NOW), AS_OF)


def test_the_map_carries_the_factors_and_leaves_out_missing_ones(lens_ctx, tmp_path) -> None:
    lenses.run(lens_ctx, AS_OF)
    published = publish(lens_ctx, tmp_path / "data")
    features = json.loads((tmp_path / "data" / "tiles" / "lots.parcels.geojson").read_text())
    properties = {f["properties"]["id"]: f["properties"] for f in features["features"]}
    assert set(properties["500000001"]) >= {"f_vacant", "f_shoot", "f_poverty", "f_canopy"}
    assert "f_poverty" not in properties["500000006"]
    assert all(
        isinstance(v, int) for p in properties.values() for k, v in p.items() if k[:2] == "f_"
    )
    assert properties["500000002"]["f_vacant"] == 0
    notes = published.manifest["notes"]
    assert (
        "1 parcels on the map are outside every census tract, so they have no poverty rate" in notes
    )


def test_a_parcel_point_falls_inside_its_own_shape() -> None:
    # An L shaped parcel whose center lies outside it: the point used is on the parcel.
    lshape = shapely.union(square(0, 0, 30), square(0, 30, 10)).union(square(20, 30, 10))
    point = shapely.point_on_surface(lshape)
    assert lshape.contains(point)
    assert isinstance(point, Point)
