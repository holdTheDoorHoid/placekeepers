"""The heat and shade lens (M3.1): the street tree and floodplain adapters, the lens factors and
the floodplain note (placekeepers.derive.heat), and the heat, tree and floodplain map layers
(placekeepers.publish.environment).

No network: the City's services are fakes, snapshots are tiny Parquet files, and places are
squares a few meters east and north of a point in North Philadelphia (tests/test_lenses.py).
"""

from __future__ import annotations

import json
from datetime import date

import httpx
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point

from placekeepers.adapters.environment import (
    FLOODPLAIN_WHERE,
    newest_tree_layer,
    tree_layer_year,
)
from placekeepers.derive import heat, lenses
from placekeepers.derive.street_safety import to_meters
from placekeepers.publish import publish
from placekeepers.publish.environment import common_name, diameter, fifths
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, arcgis_feature, install_snapshot
from .test_lenses import AS_OF, NOW, WHEN, at, install_lens_inputs, rect, square, wkb


def relaxed(source):
    return source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})


# The street tree inventory: one layer per year


def test_the_newest_yearly_tree_layer_wins_but_never_an_older_one() -> None:
    assert tree_layer_year("ppr_tree_inventory_2025") == 2025
    assert tree_layer_year("PPR_Tree_Inventory_2021") == 2021
    assert tree_layer_year("PPR_Tree_Canopy_Points_2015") is None
    assert tree_layer_year("ppr_tree_inventory_2025_test") is None
    names = ["PPR_Tree_Inventory_2021", "ppr_tree_inventory_2026", "TreeCanopyChange_2008_2018"]
    assert newest_tree_layer(names, "ppr_tree_inventory_2025") == "ppr_tree_inventory_2026"
    assert newest_tree_layer(["PPR_Tree_Inventory_2022"], "ppr_tree_inventory_2025") == (
        "ppr_tree_inventory_2025"
    )
    assert newest_tree_layer([], "ppr_tree_inventory_2025") == "ppr_tree_inventory_2025"


TREE_FIELDS = [
    {"name": "objectid", "type": "esriFieldTypeOID"},
    {"name": "tree_name", "type": "esriFieldTypeString"},
    {"name": "tree_dbh", "type": "esriFieldTypeDouble"},
    {"name": "year", "type": "esriFieldTypeString"},
    {"name": "loc_y", "type": "esriFieldTypeDouble"},
    {"name": "loc_x", "type": "esriFieldTypeDouble"},
]


def tree_features() -> list[dict]:
    names = ["ACER RUBRUM - RED MAPLE", "UNKNOWN UNKNOWN - UNKNOWN", None]
    return [
        arcgis_feature(
            {
                "objectid": n,
                "tree_name": names[n - 1],
                "tree_dbh": 10.0 * n,
                "year": "2026",
                "loc_y": 39.99,
                "loc_x": -75.15 + n / 1000,
            },
            Point(-75.15 + n / 1000, 39.99),
        )
        for n in (1, 2, 3)
    ]


class CityServices:
    """The City's ArcGIS root, listing its services, with one tree layer behind it."""

    def __init__(self, names: list[str], layer: FakeArcgis, listing_status: int = 200):
        self.names = names
        self.layer = layer
        self.listing_status = listing_status
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if request.url.path.endswith("/rest/services"):
            if self.listing_status != 200:
                return httpx.Response(self.listing_status, text="refused")
            services = [{"name": name, "type": "FeatureServer"} for name in self.names]
            return httpx.Response(200, json={"services": services})
        return self.layer(request)


def test_the_tree_adapter_takes_the_newest_year_and_keeps_only_what_it_needs(
    context_factory,
) -> None:
    layer = FakeArcgis(
        fields=TREE_FIELDS, features=tree_features(), geometry_type="esriGeometryPoint"
    )
    city = CityServices(["ppr_tree_inventory_2025", "ppr_tree_inventory_2026"], layer)
    ctx = context_factory(handler=city, now=NOW)
    source = relaxed(ctx.registry.sources["street_trees"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    paths = {r.url.path for r in city.requests}
    assert any("/ppr_tree_inventory_2026/FeatureServer/0" in p for p in paths)
    assert not any("/ppr_tree_inventory_2025/" in p for p in paths)
    asked = {r.url.params.get("outFields") for r in city.requests if "outFields" in r.url.params}
    assert asked == {"objectid,tree_name,tree_dbh,year"}

    store = SnapshotStore(ctx.cache, "street_trees")
    meta = store.current()
    rows = pq.read_table(store.path_for(meta)).to_pylist()
    assert len(rows) == 3
    assert {r["layer"] for r in rows} == {"ppr_tree_inventory_2026"}
    assert {r["inventory_year"] for r in rows} == {2026}
    # The layer's last edit day (the fake says 2026-09-27) is the source's newest record.
    assert meta.newest_record == "2026-09-27"
    assert "loc_x" not in meta.columns and "loc_y" not in meta.columns


def test_a_refused_list_of_layers_stops_the_tree_download(context_factory) -> None:
    layer = FakeArcgis(
        fields=TREE_FIELDS, features=tree_features(), geometry_type="esriGeometryPoint"
    )
    city = CityServices([], layer, listing_status=403)
    ctx = context_factory(handler=city, now=NOW)
    fetched = fetch_source(ctx, relaxed(ctx.registry.sources["street_trees"]))
    assert fetched.outcome == "failed"
    assert not any(r.url.path.endswith("/query") for r in city.requests)


def test_the_floodplain_download_asks_only_for_the_two_flood_areas(context_factory) -> None:
    fields = [
        {"name": name, "type": f"esriFieldType{kind}"}
        for name, kind in (
            ("objectid", "OID"), ("fld_zone", "String"), ("zone_subty", "String"),
            ("sfha_tf", "String"), ("dfirm_id", "String"), ("version_id", "String"),
            ("static_bfe", "Double"),
        )
    ]  # fmt: skip
    features = [
        arcgis_feature(
            {
                "objectid": 1,
                "fld_zone": "AE",
                "zone_subty": " ",
                "sfha_tf": "T",
                "dfirm_id": "42101C",
                "version_id": "2.3.3.2",
                "static_bfe": -9999,
            },
            square(0, 0, 100),
        )
    ]
    fake = FakeArcgis(fields=fields, features=features)
    ctx = context_factory(handler=fake, now=NOW)
    source = relaxed(ctx.registry.sources["fema_floodplain"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    queries = [r for r in fake.requests if r.url.path.endswith("/query")]
    assert queries and all(r.url.params["where"] == FLOODPLAIN_WHERE for r in queries)
    store = SnapshotStore(ctx.cache, "fema_floodplain")
    columns = store.current().columns
    assert "source_date" in columns and "static_bfe" not in columns


# Small pieces of the lens


def test_lots_get_the_tree_card_where_shade_is_scarce_and_the_greening_card_where_heat_hits() -> (
    None
):
    plant, cool = heat.PLANT_SHADE_TREES, heat.COOL_GREEN_LOT
    assert heat.suggestions_for(True, {"f_canopy": 50, "f_heatvul": 50}) == [plant, cool]
    assert heat.suggestions_for(True, {"f_canopy": 49, "f_heatvul": 49, "f_strees": 99}) == []
    # Without the canopy, few City trees decide the tree card.
    assert heat.suggestions_for(True, {"f_strees": 80}) == [plant]
    assert heat.suggestions_for(True, {}) == []
    # Vacant buildings are for sealing, not planting.
    assert heat.suggestions_for(False, {"f_canopy": 90, "f_heatvul": 90}) == []


def test_heat_suggestions_follow_the_first_ones_and_only_those_the_registry_has() -> None:
    assert heat.with_heat(["clean_and_green"], ["plant_shade_trees", "cool_green_lot"], None) == [
        "clean_and_green",
        "plant_shade_trees",
        "cool_green_lot",
    ]
    known = {"clean_and_green", "cool_green_lot"}
    assert heat.with_heat(["clean_and_green"], ["plant_shade_trees", "cool_green_lot"], known) == [
        "clean_and_green",
        "cool_green_lot",
    ]
    assert heat.with_heat([], ["cool_green_lot", "cool_green_lot"], None) == ["cool_green_lot"]


def test_flood_areas_are_read_as_fema_writes_them() -> None:
    assert heat.flood_class("T", " ") == 1  # zones A and AE
    assert heat.flood_class("T", "FLOODWAY") == 1
    assert heat.flood_class("F", "0.2 PCT ANNUAL CHANCE FLOOD HAZARD") == 2
    assert heat.flood_class("F", "AREA OF MINIMAL FLOOD HAZARD") is None
    assert heat.flood_class(None, None) is None


def test_a_lot_is_in_the_floodplain_once_a_tenth_of_it_is() -> None:
    assert heat.flood_code(0.10, 0.0) == 1
    assert heat.flood_code(0.09, 0.0) is None
    assert heat.flood_code(0.05, 0.05) == 2
    assert heat.flood_code(0.0, 0.5) == 2
    assert heat.flood_code(0.0, 0.0) is None


def meters(*shapes) -> np.ndarray:
    return to_meters(np.array(shapes, dtype=object))


def test_flood_codes_measure_the_share_of_each_lot() -> None:
    one = rect(0, 0, 100, 100)  # 1 percent annual chance
    two = rect(100, 0, 100, 100)  # 0.2 percent beside it
    zones = meters(one, two)
    classes = np.array([1, 2])
    lots = meters(
        rect(40, 40, 20, 20),  # all in the 1 percent area
        rect(95, 40, 20, 20),  # a quarter in the 1 percent area
        rect(99, 40, 20, 20),  # a twentieth in the 1 percent area, the rest at 0.2 percent
        rect(198, 40, 20, 20),  # a tenth at 0.2 percent
        rect(500, 500, 20, 20),  # far away
        Point(*reversed(at(150, 50))),  # a point at 0.2 percent
    )
    codes, share_1, share_0_2 = heat.flood_codes(lots, zones, classes)
    assert codes == [1, 1, 2, 2, None, 2]
    assert share_1[0] == pytest.approx(1.0) and share_1[1] == pytest.approx(0.25, abs=0.01)
    assert share_0_2[3] == pytest.approx(0.10, abs=0.01)
    assert heat.flood_codes(lots, np.array([], dtype=object), np.array([]))[0] == [None] * 6


def test_trees_count_within_a_hundred_meters_of_any_part_of_the_lot() -> None:
    lots = meters(rect(0, 0, 10, 50), Point(*reversed(at(1000, 1000))))
    trees = meters(*(Point(*reversed(at(east, 25))) for east in (5, 60, 109, 115, -95)))
    # From the lot's edge: 5 (inside), 60, 109 (99 meters from the east edge) and -95 count.
    assert heat.trees_near(lots, trees) == [4, 0]
    assert heat.trees_near(lots, np.array([], dtype=object)) == [0, 0]


def test_people_per_square_kilometer_of_land(tmp_path) -> None:
    tracts = tmp_path / "tracts.parquet"
    people = tmp_path / "people.parquet"
    pq.write_table(
        pa.table({"geoid": ["A", "B", "C", "D"], "aland": [2_000_000.0, 500_000.0, 0.0, 1e6]}),
        tracts,
    )
    pq.write_table(
        pa.table({"geoid": ["A", "B", "C"], "population_for_poverty": [4000, 0, 100]}), people
    )
    assert heat.people_per_km2(tracts, people) == {"A": 2000.0, "B": 0.0}


# A whole run, the map layers and the lot pages

HEAT_TRACTS = {
    # geoid10: (hvi, hei, hsi, very high, west, south, width, height) in meters
    "42101000100": (6.5, 1.2, 9.0, 1, -1000, -1000, 1100, 2000),
    "42101000200": (-5.0, -2.0, -6.0, 0, 100, -1000, 2000, 2000),
    "42101000300": (None, None, None, 0, -1000, 1000, 3000, 1000),  # not reported
}


def install_heat_inputs(ctx, skip: tuple[str, ...] = ()) -> None:
    """Every input of the heat lens except `skip`, around the parcels of tests/test_lenses.py
    (the first sits at the origin; the others run east every 300 meters)."""
    tracts = pa.table(
        {
            "geoid10": list(HEAT_TRACTS),
            "name10": ["1", "2", "3"],
            "n_veryhigh": [t[3] for t in HEAT_TRACTS.values()],
            "year": [2023] * 3,
            "hsi_score": [t[2] for t in HEAT_TRACTS.values()],
            "hei_score": [t[1] for t in HEAT_TRACTS.values()],
            "hvi_score": [t[0] for t in HEAT_TRACTS.values()],
            "objectid": [1, 2, 3],
            "geometry": [wkb(rect(*t[4:])) for t in HEAT_TRACTS.values()],
        }
    )
    # Many trees by the first parcel, one by the fourth, none elsewhere.
    places = [at(20, 5 + i) for i in range(30)] + [at(905, 5)]
    trees = pa.table(
        {
            "objectid": list(range(1, len(places) + 1)),
            "tree_name": ["ACER RUBRUM - RED MAPLE"] * len(places),
            "tree_dbh": [8.0] * len(places),
            "year": ["2025"] * len(places),
            "geometry": [wkb(Point(lng, lat)) for lat, lng in places],
            "inventory_year": pa.array([2025] * len(places), pa.int16()),
            "layer": ["ppr_tree_inventory_2025"] * len(places),
            "source_date": [date(2025, 11, 20)] * len(places),
        }
    )
    # The 1 percent floodplain under the second parcel, the 0.2 percent area under the third.
    flood = pa.table(
        {
            "dfirm_id": ["42101C"] * 3,
            "version_id": ["2.3.3.2"] * 3,
            "fld_zone": ["AE", "X", "X"],
            "zone_subty": [
                " ",
                "0.2 PCT ANNUAL CHANCE FLOOD HAZARD",
                "AREA OF MINIMAL FLOOD HAZARD",
            ],
            "sfha_tf": ["T", "F", "F"],
            "objectid": [1, 2, 3],
            "geometry": [wkb(rect(290, -10, 30, 30)), wkb(rect(590, -10, 30, 30)),
                         wkb(rect(890, -10, 30, 30))],
            "source_date": [date(2025, 4, 15)] * 3,
        }
    )  # fmt: skip
    population = pa.table(
        {"geoid": ["42101000100", "42101000200"], "population_for_poverty": [6000, 1000]}
    )
    for source_id, table, geometry, kinds in (
        ("heat_vulnerability", tracts, True, ["Polygon"]),
        ("street_trees", trees, True, ["Point"]),
        ("fema_floodplain", flood, True, ["Polygon"]),
    ):
        if source_id not in skip:
            install_snapshot(
                ctx, source_id, table, geometry=geometry, fetched_at=WHEN, geometry_types=kinds
            )
    # The census tracts of tests/test_lenses.py (3 and 1 square kilometers of land, here).
    if "acs_poverty" not in skip:
        store = SnapshotStore(ctx.cache, "acs_poverty")
        current = pq.read_table(store.path_for(store.current()))
        joined = current.append_column(
            "population_for_poverty", population.column("population_for_poverty")
        )
        install_snapshot(ctx, "acs_poverty", joined, geometry=False, fetched_at=WHEN)
    store = SnapshotStore(ctx.cache, "census_tracts_2020")
    current = pq.read_table(store.path_for(store.current()))
    with_land = current.append_column("aland", pa.array([3_000_000.0, 1_000_000.0]))
    install_snapshot(ctx, "census_tracts_2020", with_land, geometry=True, fetched_at=WHEN)


@pytest.fixture
def heat_ctx(context_factory):
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_heat_inputs(ctx)
    lenses.run(ctx, AS_OF)
    return ctx


def test_a_run_gives_every_parcel_on_the_map_its_heat_factors(heat_ctx) -> None:
    result = heat.run(heat_ctx, AS_OF)
    rows = {r["opa"]: r for r in pq.read_table(result.path).to_pylist()}
    assert len(rows) == 7 and "500000007" not in rows  # the excluded parcel is not on the map

    # Heat vulnerability: the first parcel's tract is the most vulnerable; the parcel far to the
    # north east lies outside every tract of the index; the lot to the north lies in a tract the
    # index does not report.
    assert rows["500000001"]["hvi_score"] == 6.5
    assert rows["500000003"]["hvi_score"] == -5.0
    assert rows["500000001"]["f_heatvul"] > rows["500000003"]["f_heatvul"]
    assert rows["500000006"]["f_heatvul"] is None
    assert rows["500000008"]["hvi_tract"] == "42101000300"
    assert rows["500000008"]["f_heatvul"] is None

    # City trees: 30 by the first parcel, 1 by the fourth, none by the rest, so the first ranks
    # lowest for "few trees".
    assert rows["500000001"]["trees_near"] == 30 and rows["500000001"]["f_strees"] == 0
    assert rows["500000004"]["trees_near"] == 1
    assert rows["500000005"]["trees_near"] == 0
    assert rows["500000005"]["f_strees"] > rows["500000004"]["f_strees"] > 0

    # People: 6000 people on 3 square kilometers and 1000 on 1.
    assert rows["500000001"]["people_per_km2"] == 2000.0
    assert rows["500000008"]["people_per_km2"] == 1000.0
    assert rows["500000006"]["people_per_km2"] is None

    # The floodplain sits beside the score, never in it.
    assert rows["500000002"]["fp"] == 1
    assert rows["500000003"]["fp"] == 2
    assert rows["500000004"]["fp"] is None  # minimal flood hazard is not a flood area
    assert rows["500000001"]["fp"] is None

    # Suggestions: lots only; the first lot has the most canopy and many trees nearby, so no tree
    # card, but its tract is the hottest. The tree card follows the violence lens's canopy rank.
    assert rows["500000001"]["sg"] == "cool_green_lot"
    assert rows["500000003"]["sg"] == ""  # a building
    canopy = lenses.load_factors(result.path.with_name("lens_factors.parquet"))
    for opa in ("500000002", "500000006", "500000008"):
        shaded = canopy[opa].get("f_canopy", -1) < heat.SUGGEST_FROM
        assert ("plant_shade_trees" in rows[opa]["sg"]) is not shaded
        assert "cool_green_lot" not in rows[opa]["sg"]

    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["parcels"] == 7
    assert summary["floodplain"] == {"one_percent": 1, "zero_point_two_percent": 1}
    assert summary["spread"]["f_heatvul"]["missing"] == 2
    assert any("no heat vulnerability score" in note for note in summary["notes"])


def test_without_a_source_its_heat_factor_is_left_out(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_heat_inputs(ctx, skip=("street_trees", "fema_floodplain"))
    result = heat.run(ctx, AS_OF)
    assert result.missing_sources == ["street_trees"]
    found = heat.load_heat(result.path)
    assert all("f_strees" not in f.properties for f in found.values())
    assert all("fp" not in f.properties for f in found.values())
    assert any("f_heatvul" in f.properties for f in found.values())
    assert "The heat lens ran without street_trees, so f_strees is left out" in result.notes
    assert any("without fema_floodplain" in note for note in result.notes)


def test_the_heat_lens_needs_the_vacancy_model(context_factory) -> None:
    with pytest.raises(RuntimeError, match="vacancy model"):
        heat.run(context_factory(now=NOW), AS_OF)


def test_the_lots_layer_and_the_lot_pages_carry_the_heat_lens(heat_ctx, tmp_path) -> None:
    heat.run(heat_ctx, AS_OF)
    published = publish(heat_ctx, tmp_path / "data")
    features = json.loads((tmp_path / "data" / "tiles" / "lots.parcels.geojson").read_text())
    properties = {f["properties"]["id"]: f["properties"] for f in features["features"]}
    first = properties["500000001"]
    assert {"f_heatvul", "f_strees", "f_people", "f_canopy"} <= set(first)
    assert first["sg"] == "clean_and_green,cool_green_lot"
    assert properties["500000002"]["fp"] == 1
    assert "fp" not in first
    assert "f_heatvul" not in properties["500000006"]
    assert properties["500000003"]["sg"] == "seal_abandoned_building"
    # The lot pages list the same suggestions as the map.
    shards = sorted((tmp_path / "data" / "dossiers").glob("[0-9]*.json"))
    dossiers = {
        opa: d for shard in shards for opa, d in json.loads(shard.read_text())["parcels"].items()
    }
    assert "500000001" in dossiers
    for opa, dossier in dossiers.items():
        if opa in properties:
            assert ",".join(dossier["suggestions"]) == properties[opa]["sg"]
    assert any("no heat vulnerability score" in note for note in published.manifest["notes"])


# The map layers


def test_tracts_are_shaded_by_fifths() -> None:
    assert fifths([1.0, 2.0, 3.0, 4.0, 5.0, None]) == [1, 2, 3, 4, 5, None]
    assert fifths([7.0, 7.0, 7.0]) == [1, 1, 1]
    assert fifths([]) == []


def test_tree_names_and_sizes_read_plainly() -> None:
    assert common_name("ACER RUBRUM - RED MAPLE") == "Red Maple"
    assert common_name("ALNUS SPECIES – OTHER ALDER") == "Alder"
    assert common_name("PRUNUS SPECIES - OTHER CHERRY") == "Cherry"
    assert common_name("CRATAEGUS PHAENOPYRUM - WASHINGTON HAWTHORN") == "Washington Hawthorn"
    assert common_name("UNKNOWN UNKNOWN - UNKNOWN") is None
    assert common_name("") is None
    assert common_name(None) is None
    assert diameter(12.6) == 13
    assert diameter(-3) is None
    assert diameter(0.4) is None
    assert diameter(1118) is None
    assert diameter(None) is None


def test_the_heat_tree_and_floodplain_layers(heat_ctx, tmp_path) -> None:
    publish(heat_ctx, tmp_path / "data")
    tiles = tmp_path / "data" / "tiles"
    tracts = json.loads((tiles / "environment.heat_tracts.geojson").read_text())["features"]
    by_id = {f["properties"]["id"]: f["properties"] for f in tracts}
    assert by_id["42101000100"] == {"id": "42101000100", "hv": 3, "he": 3, "hs": 3, "vh": 1}
    assert by_id["42101000200"] == {"id": "42101000200", "hv": 1, "he": 1, "hs": 1}
    assert by_id["42101000300"] == {"id": "42101000300"}

    flood = json.loads((tiles / "environment.floodplain.geojson").read_text())["features"]
    assert [f["properties"] for f in flood] == [{"z": 1}, {"z": 2}]

    trees = json.loads((tiles / "trees.trees.geojson").read_text())["features"]
    assert len(trees) == 31
    assert trees[0]["properties"] == {"sp": "Red Maple", "d": 8}
    assert trees[0]["geometry"]["type"] == "Point"


def test_the_trees_need_no_personal_data() -> None:
    # The inventory holds a species, a trunk size, a year and a point; nothing else is kept.
    from placekeepers.adapters.environment import StreetTrees

    assert set(StreetTrees.out_fields) == {"objectid", "tree_name", "tree_dbh", "year"}


def test_points_are_counted_in_their_own_place() -> None:
    # A parcel with no shape is a point: the floodplain counts it where it lies.
    lot = meters(Point(*reversed(at(10, 10))))
    zone = meters(rect(0, 0, 50, 50))
    assert heat.flood_codes(lot, zone, np.array([1]))[0] == [1]
    assert shapely.area(lot[0]) == 0
