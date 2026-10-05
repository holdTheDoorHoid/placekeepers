"""Walkability and people (M3.3): the four sources, the walking measures and their map layers.

No network: the ArcGIS layers are fake services, the redistricting file is a tiny zip, and every
snapshot holds a few rows around the parcels of tests/test_lenses.py (the first sits at the
origin; the others run east every 300 meters, one lies far to the north east and one to the
north).
"""

from __future__ import annotations

import json
import shutil
from datetime import date

import h3
import httpx
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from pydantic import ValidationError
from shapely.geometry import LineString, Point, mapping

from placekeepers.adapters.walk import GEO_HEADER_FIELDS, geo_header_name
from placekeepers.derive import walk
from placekeepers.derive.street_safety import to_meters
from placekeepers.publish import publish
from placekeepers.publish.tiles import TILE_OPTIONS, pmtiles_layer_names
from placekeepers.publish.walk import build_block_groups, build_stress, city_cell_ids, epa_class
from placekeepers.registry import ArcgisEndpoint
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, install_snapshot
from .pmtiles_read import features as tile_features
from .pmtiles_read import tiles as tile_list
from .test_lenses import AS_OF, NOW, WHEN, at, install_lens_inputs, rect, wkb
from .walk_fixtures import BLOCKS, geo_header, geo_line, redistricting_zip


def relaxed(source):
    return source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})


def run_source(ctx, source_id: str):
    source = relaxed(ctx.registry.sources[source_id])
    fetched = fetch_source(ctx, source)
    assert fetched.outcome == "downloaded", fetched.detail
    return validate_source(ctx, source)


def point_at(east: float, north: float) -> Point:
    lat, lng = at(east, north)
    return Point(lng, lat)


# ---------------------------------------------------------------------------------------------
# The sources


def test_the_redistricting_file_gives_philadelphias_blocks_and_their_people(
    context_factory,
) -> None:
    body = redistricting_zip()
    ctx = context_factory(handler=lambda request: httpx.Response(200, content=body), now=NOW)
    checked = run_source(ctx, "census_blocks_2020")
    assert checked.outcome == "ok", checked.detail
    store = SnapshotStore(ctx.cache, "census_blocks_2020")
    meta = store.current()
    rows = pq.read_table(store.path_for(meta)).to_pylist()
    # The other county's block, the state and the county lines are left out.
    assert [r["geoid"] for r in rows] == ["421010001001000", "421010001001001", "421019803001000"]
    first = rows[0]
    assert (first["tract"], first["block_group"]) == ("000100", "421010001001")
    assert (first["population"], first["housing_units"]) == (900_000, 400_000)
    assert (first["land_m2"], first["water_m2"]) == (9_700, 0)
    assert first["lat"] == pytest.approx(39.951892) and first["lng"] == pytest.approx(-75.155053)
    assert shapely.from_wkb(first["geometry"]).equals(Point(-75.155053, 39.951892))
    assert meta.format == "geoparquet"
    assert "3 census blocks in Philadelphia, 1,603,797 people in 2020" in meta.notes
    assert any(c["rule"] == "population_total" and c["ok"] for c in meta.checks)


def test_a_changed_layout_or_a_count_that_does_not_add_up_is_refused(context_factory) -> None:
    short = "|".join(geo_line(SUMLEV="750").split("|")[:-1]) + "\r\n"
    for body, outcome, words in (
        (redistricting_zip(header=short), "error", "fields, not 97"),
        (redistricting_zip(blocks=BLOCKS[2:]), "rejected", "The blocks hold 0 people"),
    ):
        ctx = context_factory(handler=lambda request, b=body: httpx.Response(200, content=b))
        checked = run_source(ctx, "census_blocks_2020")
        assert checked.outcome == outcome
        assert words in checked.detail
        shutil.rmtree(ctx.cache.root)


def test_the_geographic_header_is_found_by_its_name() -> None:
    assert geo_header_name(["pa000012020.pl", "pageo2020.pl"]) == "pageo2020.pl"
    with pytest.raises(Exception, match="one geographic header"):
        geo_header_name(["pa000012020.pl"])
    assert len(GEO_HEADER_FIELDS) == 97
    assert GEO_HEADER_FIELDS.index("POP100") == 90
    assert len(geo_header().split("\r\n")[0].split("|")) == 97


def fake_epa(indexes=(15.0, 8.5, 19.6)) -> FakeArcgis:
    names = ("OBJECTID", "GEOID10", "STATEFP", "COUNTYFP", "TotPop", "Ac_Land", "D3B", "D4A",
             "D2B_E8MIXA", "D2A_EPHHM", "D2A_Ranked", "D2B_Ranked", "D3B_Ranked", "D4A_Ranked",
             "NatWalkInd", "CBSA_Name")  # fmt: skip
    kinds = {"OBJECTID": "OID", "GEOID10": "String", "STATEFP": "String", "COUNTYFP": "String",
             "TotPop": "Integer", "CBSA_Name": "String"}  # fmt: skip
    fields = [{"name": n, "type": f"esriFieldType{kinds.get(n, 'Double')}"} for n in names]
    features = []
    for n, index in enumerate(indexes, start=1):
        properties = {name: 1.0 for name in names}
        properties.update(
            OBJECTID=n,
            GEOID10=f"42101000{n}001",
            STATEFP="42",
            COUNTYFP="101",
            TotPop=1000 * n,
            NatWalkInd=index,
            CBSA_Name="Philadelphia",
        )
        geometry = rect(n * 500, 0, 500, 500)
        features.append(
            {"type": "Feature", "properties": properties, "geometry": mapping(geometry)}
        )
    return FakeArcgis(fields=fields, features=features, geometry_type="esriGeometryPolygon")


def test_the_walkability_index_comes_for_philadelphia_only(context_factory) -> None:
    fake = fake_epa()
    ctx = context_factory(handler=fake, now=NOW)
    checked = run_source(ctx, "epa_walkability")
    assert checked.outcome == "ok", checked.detail
    queries = [r.url for r in fake.requests if r.url.path.endswith("/query")]
    assert queries and all(
        q.params["where"] == "STATEFP = '42' AND COUNTYFP = '101'" for q in queries
    )
    assert all(
        str(r.url).startswith(
            "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/"
            "Smart_Location_Database_/FeatureServer/0"
        )
        for r in fake.requests
    )
    pages = [q for q in queries if "outFields" in q.params]
    assert "CBSA_Name" not in pages[0].params["outFields"]
    store = SnapshotStore(ctx.cache, "epa_walkability")
    table = pq.read_table(store.path_for(store.current()))
    assert "cbsa_name" not in table.column_names
    # The fake layer was last edited on 2026-09-27 at 11:33 in Philadelphia.
    assert set(table.column("source_date").to_pylist()) == {date(2026, 9, 27)}


def test_an_index_outside_1_to_20_means_the_layer_changed(context_factory) -> None:
    ctx = context_factory(handler=fake_epa(indexes=(15.0, 25.0, 3.0)), now=NOW)
    checked = run_source(ctx, "epa_walkability")
    assert checked.outcome == "rejected"
    assert "1 outside it" in checked.detail


def test_dvrpc_streets_come_from_a_folder_of_their_server(context_factory) -> None:
    names = ("objectid", "no", "fromnodeno", "tonodeno", "typeno", "bike_facility",
             "totnumlanes", "vehiclespeed", "lts", "county_code", "slope")  # fmt: skip
    kinds = {"objectid": "OID", "typeno": "String", "bike_facility": "String"}
    fields = [{"name": n, "type": f"esriFieldType{kinds.get(n, 'Double')}"} for n in names]
    features = [
        {
            "type": "Feature",
            "properties": {
                **{n: 1.0 for n in names},
                "objectid": n,
                "typeno": "42",
                "lts": float(n),
                "bike_facility": "Bike Lane",
                "county_code": 42101.0,
            },
            "geometry": mapping(LineString([at(0, n * 100)[::-1], at(100, n * 100)[::-1]])),
        }
        for n in (1, 2, 3)
    ]
    fake = FakeArcgis(fields=fields, features=features, geometry_type="esriGeometryPolyline")
    ctx = context_factory(handler=fake, now=NOW)
    checked = run_source(ctx, "dvrpc_lts")
    assert checked.outcome == "ok", checked.detail
    assert {r.url.host for r in fake.requests} == {"arcgis.dvrpc.org"}
    assert all(
        r.url.path.startswith("/portal/rest/services/transportation/lts_network/FeatureServer/0")
        for r in fake.requests
    )
    queries = [r for r in fake.requests if r.url.path.endswith("/query")]
    assert all(r.url.params["where"] == "county_code = 42101" for r in queries)


def test_snap_stores_keep_their_kind_and_point_and_nothing_else(context_factory) -> None:
    names = ("ObjectId", "Store_Name", "Store_Street_Address", "Store_Type", "State", "County")
    fields = [
        {"name": n, "type": "esriFieldTypeOID" if n == "ObjectId" else "esriFieldTypeString"}
        for n in names
    ]
    features = [
        {
            "type": "Feature",
            "properties": {
                "ObjectId": n,
                "Store_Name": "Corner Grocery",
                "Store_Street_Address": "1 Main St",
                "Store_Type": "Grocery Store",
                "State": "PA",
                "County": "PHILADELPHIA",
            },
            "geometry": mapping(point_at(n * 10, 0)),
        }
        for n in (1, 2)
    ]
    fake = FakeArcgis(fields=fields, features=features, geometry_type="esriGeometryPoint")
    ctx = context_factory(handler=fake, now=NOW)
    checked = run_source(ctx, "snap_retailers")
    assert checked.outcome == "ok", checked.detail
    pages = [r for r in fake.requests if "outFields" in r.url.params]
    assert {r.url.params["outFields"] for r in pages} == {"ObjectId,Store_Type"}
    assert all(r.url.params["where"] == "State = 'PA' AND County = 'PHILADELPHIA'" for r in pages)
    store = SnapshotStore(ctx.cache, "snap_retailers")
    columns = pq.read_schema(store.path_for(store.current())).names
    assert sorted(columns) == ["geometry", "objectid", "source_date", "store_type"]


def test_a_service_kept_in_a_folder_is_a_valid_registry_name() -> None:
    ok = ArcgisEndpoint(kind="arcgis", service="transportation/lts_network", layer=0)
    assert ok.service == "transportation/lts_network"
    for bad in ("/lts_network", "transportation/", "a//b", "a/b?c=1", "a/ b"):
        with pytest.raises(ValidationError):
            ArcgisEndpoint(kind="arcgis", service=bad, layer=0)


# ---------------------------------------------------------------------------------------------
# Small pieces of the measures


def meters(*points: Point) -> np.ndarray:
    return to_meters(np.array(points, dtype=object))


def test_places_within_a_radius_are_counted_and_weighed() -> None:
    here = meters(point_at(0, 0), point_at(1000, 0))
    targets = meters(point_at(100, 0), point_at(390, 0), point_at(410, 0), point_at(1000, 50))
    assert walk.count_within(here, targets, 400).tolist() == [2, 1]
    weighed = walk.count_within(here, targets, 400, weights=[10, 5, 1, 7])
    assert weighed.tolist() == [15, 7]
    # In chunks, the same answer.
    assert walk.count_within(here, targets, 400, chunk=1).tolist() == [2, 1]
    assert walk.count_within(here, np.array([], dtype=object), 400).tolist() == [0, 0]


def test_kinds_of_places_come_first_then_how_many() -> None:
    assert walk.destination_value(7, 0) > walk.destination_value(6, 35)
    assert walk.destination_value(3, 9) > walk.destination_value(3, 8)
    assert walk.destination_value(0, 0) == 0


def centerlines(segments) -> pa.Table:
    """Street segments as the City publishes them: (seg_id, class, from node, to node, start,
    end), the ends in meters east and north of the origin."""
    return pa.table(
        {
            "seg_id": [s[0] for s in segments],
            "class": [s[1] for s in segments],
            "fnode_": [s[2] for s in segments],
            "tnode_": [s[3] for s in segments],
            "geometry": [wkb(LineString([at(*s[4])[::-1], at(*s[5])[::-1]])) for s in segments],
        }
    )


GRID = [
    # A four way corner at node 1 (0, 100) and a three way corner at node 2 (100, 100)
    (1, 5, 1, 2, (0, 100), (100, 100)),
    (2, 5, 3, 1, (-100, 100), (0, 100)),
    (3, 4, 1, 4, (0, 100), (0, 200)),
    (4, 5, 5, 1, (0, 0), (0, 100)),
    (5, 2, 2, 6, (100, 100), (200, 100)),
    (6, 3, 2, 7, (100, 100), (100, 0)),
    # A bend at node 6: two segments only
    (7, 5, 6, 8, (200, 100), (200, 200)),
    # An expressway and a ramp meeting a local street at node 9: one walkable leg
    (8, 1, 9, 10, (1200, 100), (1300, 100)),
    (9, 9, 11, 9, (1200, 0), (1200, 100)),
    (10, 5, 9, 12, (1200, 100), (1200, 200)),
    # Driveways and a segment that cannot be traveled never make a corner
    (11, 6, 13, 14, (600, 0), (600, 50)),
    (12, 12, 13, 15, (600, 0), (650, 0)),
    (13, 6, 13, 16, (600, 0), (550, 0)),
]


def test_corners_are_where_three_streets_people_can_walk_on_meet() -> None:
    corners = walk.corner_points(centerlines(GRID))
    found = sorted((round(p.x, 6), round(p.y, 6)) for p in corners)
    expected = sorted((round(lng, 6), round(lat, 6)) for lat, lng in (at(0, 100), at(100, 100)))
    assert found == expected


def install_places(ctx) -> None:
    """Everyday places around the parcels, of every kind, with the ones that must not count."""

    def points(rows):
        return [wkb(point_at(*r)) for r in rows]

    def table(columns: dict, places: list[tuple[float, float]]) -> pa.Table:
        ids = list(range(1, len(places) + 1))
        return pa.table({"objectid": ids, **columns, "geometry": points(places)})

    tables = {
        "library_locations": table({"building": ["Branch"]}, [(50, 50)]),
        "ppr_program_sites": table(
            {"park_name": ["Rec", "Pool"], "program_type": ["PPR_REC", "POOL"]},
            [(700, 0), (20, 0)],
        ),
        "ppr_swimming_pools": table(
            {"pool_name": ["Open", "Closed"], "pool_status": ["ACTIVE", "INACTIVE"]},
            [(0, 900), (10, 10)],
        ),
        "ppr_spraygrounds": table(
            {"park_name": ["Spray"], "spray_status": ["UNKNOWN"]}, [(5000, 5100)]
        ),
        "ppr_hydration_stations": table(
            {"park_name": ["Park"], "station_type": ["FOUNTAIN"]}, [(100, 0)]
        ),
        "schools": table({"school_name": ["School"]}, [(-700, 0)]),
        "snap_retailers": table(
            {"store_type": ["Supermarket", "Convenience Store", "Other"]},
            [(200, 0), (5, 5), (5000, 5000)],
        ),
    }
    for source_id, table in tables.items():
        install_snapshot(ctx, source_id, table, geometry=True, fetched_at=WHEN,
                         geometry_types=["Point"])  # fmt: skip


def install_stops(ctx) -> None:
    """SEPTA's stops, as far as the measures read them: a stop with service by the first parcel,
    one with none far away, and a route row. (Too thin for the transit layers, so tests that
    publish leave it out.)"""
    stops = [(at(0, 50), 10, 0, 0), (at(5000, 5000), 0, 0, 0), (at(0, 0), None, None, None)]
    gtfs = pa.table(
        {
            "kind": ["stop", "stop", "route"],
            "lat": [s[0][0] for s in stops],
            "lng": [s[0][1] for s in stops],
            "trips_wk": [s[1] for s in stops],
            "trips_sa": [s[2] for s in stops],
            "trips_su": [s[3] for s in stops],
        }
    )
    install_snapshot(ctx, "septa_gtfs", gtfs, geometry=False, fetched_at=WHEN)


def test_places_that_are_closed_or_not_groceries_or_without_service_do_not_count(
    context_factory,
) -> None:
    ctx = context_factory(now=NOW)
    install_places(ctx)
    install_stops(ctx)
    paths = {s: walk.current_snapshot(ctx, s) for s in walk.PLACE_SOURCES}
    assert len(walk.place_points("recreation", paths)) == 1  # the pool among the sites is not
    assert len(walk.place_points("pool", paths)) == 2  # the closed pool is not
    assert len(walk.place_points("food", paths)) == 1  # only the supermarket
    assert len(walk.place_points("transit", paths)) == 1  # only the stop with service
    assert walk.place_points("library", {}) is None


# ---------------------------------------------------------------------------------------------
# A whole run


BLOCK_ROWS = [
    # (east, north, people): two blocks by the first parcel, one far west, one far north east
    (-150, 0, 1000),
    (350, 0, 500),
    (-500, 0, 2000),
    (5000, 5000, 7),
]


def install_walk_inputs(ctx, skip: tuple[str, ...] = ()) -> None:
    """Every input of the walking measures except `skip`, around the parcels of
    tests/test_lenses.py."""
    blocks = pa.table(
        {
            "geoid": [f"42101000100{n:04d}" for n in range(len(BLOCK_ROWS))],
            "population": pa.array([b[2] for b in BLOCK_ROWS], pa.int32()),
            "lat": [at(b[0], b[1])[0] for b in BLOCK_ROWS],
            "lng": [at(b[0], b[1])[1] for b in BLOCK_ROWS],
            "geometry": [wkb(point_at(b[0], b[1])) for b in BLOCK_ROWS],
        }
    )
    # Two block groups: the first two parcels in a walkable one, the next three in a less
    # walkable one; the parcels to the north and far to the north east lie in neither.
    groups = pa.table(
        {
            "geoid10": ["421010001001", "421010002001"],
            "natwalkind": [18.5, 9.0],
            "d3b": [200.0, 40.0],
            "d4a": [120.0, -99999.0],
            "d2b_e8mixa": [0.6, 0.2],
            "d2a_ephhm": [0.5, 0.1],
            "d2a_ranked": [12.0, 3.0],
            "d2b_ranked": [14.0, 4.0],
            "d3b_ranked": [19.0, 6.0],
            "d4a_ranked": [20.0, 1.0],
            "geometry": [wkb(rect(-1000, -1000, 1450, 2000)), wkb(rect(450, -1000, 1550, 2000))],
        }
    )
    tables = {
        "census_blocks_2020": (blocks, ["Point"]),
        "epa_walkability": (groups, ["Polygon"]),
        "street_centerlines": (centerlines(GRID), ["LineString"]),
    }
    for source_id, (table, kinds) in tables.items():
        if source_id not in skip:
            install_snapshot(ctx, source_id, table, geometry=True, fetched_at=WHEN,
                             geometry_types=kinds)  # fmt: skip
    install_places(ctx)


@pytest.fixture
def walk_ctx(context_factory):
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_walk_inputs(ctx)
    return ctx


def test_a_run_measures_what_lies_within_a_short_walk_of_every_parcel(walk_ctx) -> None:
    install_stops(walk_ctx)
    result = walk.run(walk_ctx, AS_OF)
    rows = {r["opa"]: r for r in pq.read_table(result.path).to_pylist()}
    assert len(rows) == 7 and "500000007" not in rows  # the excluded parcel is not on the map

    # People within 400 meters: the two blocks by the first parcel, one of them by the next two.
    people = {opa: r["people_5min"] for opa, r in rows.items()}
    assert people == {
        "500000001": 1500, "500000002": 500, "500000003": 500, "500000004": 0,
        "500000005": 0, "500000006": 7, "500000008": 0,
    }  # fmt: skip
    first = rows["500000001"]
    assert first["f_neighbors"] == max(r["f_neighbors"] for r in rows.values())

    # Street corners: the four way and the three way corner, by the first two parcels only.
    assert first["corners_5min"] == 2 and rows["500000002"]["corners_5min"] == 2
    assert rows["500000003"]["corners_5min"] == 0

    # Everyday places within 800 meters of the first parcel: every kind but a pool (the open one
    # is 900 meters north, the closed one beside it does not count).
    assert first["kinds_10min"] == 6
    assert first["kind_bits"] == 1 + 2 + 8 + 16 + 32 + 64
    assert first["f_dest"] == max(r["f_dest"] for r in rows.values())
    # Far to the north east only a sprayground (the stop there has no service, the store is not
    # a grocery); to the north the open pool.
    assert (rows["500000006"]["kinds_10min"], rows["500000006"]["kind_bits"]) == (1, 4)
    assert rows["500000008"]["kind_bits"] & walk.KIND_BITS["pool"]

    # Walkability: the block group each parcel lies in.
    assert first["walk_index"] == 18.5 and first["block_group"] == "421010001001"
    assert rows["500000003"]["walk_index"] == 9.0
    assert rows["500000006"]["f_walk"] is None and rows["500000008"]["f_walk"] is None
    assert first["f_walk"] > rows["500000003"]["f_walk"]

    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["parcels"] == 7
    assert summary["kinds_found"] == {"library": 1, "recreation": 1, "pool": 2, "water": 1,
                                      "school": 1, "food": 1, "transit": 1}  # fmt: skip
    assert "2 parcels on the map lie in no block group" in " ".join(summary["notes"])


def test_without_a_source_its_factor_is_left_out(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_walk_inputs(ctx, skip=("census_blocks_2020", "epa_walkability"))
    result = walk.run(ctx, AS_OF)
    assert result.missing_sources == ["census_blocks_2020", "epa_walkability"]
    found = walk.load_walk(result.path)
    assert all("f_neighbors" not in f and "f_walk" not in f for f in found.values())
    assert all("f_dest" in f and "f_corners" in f for f in found.values())
    assert (
        "The walking measures ran without census_blocks_2020, so f_neighbors is left out"
        in result.notes
    )


def test_a_missing_kind_of_place_is_not_counted_and_the_notes_say_so(walk_ctx) -> None:
    store = SnapshotStore(walk_ctx.cache, "library_locations")
    shutil.rmtree(store.dir)
    result = walk.run(walk_ctx, AS_OF)
    assert "library" not in result.kinds_found
    assert any("Free Library location" in note for note in result.notes)


def test_the_walking_measures_need_the_vacancy_model(context_factory) -> None:
    with pytest.raises(RuntimeError, match="vacancy model"):
        walk.run(context_factory(now=NOW), AS_OF)


def test_the_lots_carry_the_walking_factors(walk_ctx, tmp_path) -> None:
    walk.run(walk_ctx, AS_OF)
    published = publish(walk_ctx, tmp_path / "data")
    lots = json.loads((tmp_path / "data" / "tiles" / "lots.parcels.geojson").read_text())
    properties = {f["properties"]["id"]: f["properties"] for f in lots["features"]}
    first = properties["500000001"]
    assert {"f_walk", "f_neighbors", "f_dest", "f_corners"} <= set(first)
    assert "f_walk" not in properties["500000006"]
    # Seven parcels: the most people ranks above the other six, 6 of 7, 86.
    assert first["f_neighbors"] == 86
    sources = published.manifest["layers"]["vacant_parcels"]["sources"]
    assert {"census_blocks_2020", "epa_walkability", "snap_retailers"} <= set(sources)


# ---------------------------------------------------------------------------------------------
# The map layers


def test_the_epa_classes_follow_its_user_guide() -> None:
    assert [epa_class(v) for v in (1.0, 5.75, 5.76, 10.5, 10.51, 15.25, 15.26, 20.0)] == [
        1, 1, 2, 2, 3, 3, 4, 4,
    ]  # fmt: skip
    assert epa_class(None) is None


def test_block_groups_carry_the_index_its_parts_and_their_fifths(walk_ctx, tmp_path) -> None:
    store = SnapshotStore(walk_ctx.cache, "epa_walkability")
    out = tmp_path / "walk.block_groups.geojson"
    result = build_block_groups(walk_ctx, {"epa_walkability": store.path_for(store.current())},
                                out, AS_OF)  # fmt: skip
    assert result.features == 2
    found = [f["properties"] for f in json.loads(out.read_text())["features"]]
    assert found[0] == {
        "id": "421010001001", "w": 18.5, "nw": 4, "rc": 19, "rt": 20, "rj": 14, "rh": 12,
        "qw": 3, "qc": 3, "qt": 3, "qm": 3,
    }  # fmt: skip
    # No transit stop within three quarters of a mile ranks lowest for transit.
    assert found[1] == {
        "id": "421010002001", "w": 9.0, "nw": 2, "rc": 6, "rt": 1, "rj": 4, "rh": 3,
        "qw": 1, "qc": 1, "qt": 1, "qm": 1,
    }  # fmt: skip
    assert result.notes == [
        "walkability: 2 block groups; by the EPA's classes 0 least walkable, 1 below average, "
        "0 above average, 1 most walkable"
    ]


def install_water(ctx, west: float, south: float, width: float, height: float) -> None:
    land = pa.table(
        {"c_dig2": [81, 11], "geometry": [wkb(rect(west, south, width, height)),
                                          wkb(rect(-900, -900, 50, 50))]}
    )  # fmt: skip
    install_snapshot(ctx, "land_use", land, geometry=True, fetched_at=WHEN)


def test_cells_cover_the_city_but_not_its_water(walk_ctx) -> None:
    paths = {s: walk.current_snapshot(walk_ctx, s) for s in ("census_tracts_2020", "land_use")}
    dry = city_cell_ids({k: v for k, v in paths.items() if v is not None})
    install_water(walk_ctx, 1000, 500, 1000, 1500)
    paths["land_use"] = walk.current_snapshot(walk_ctx, "land_use")
    wet = city_cell_ids(paths)
    assert set(wet) < set(dry)
    city = shapely.union_all(
        [shapely.from_wkb(g) for g in pq.read_table(paths["census_tracts_2020"]).column(
            "geometry").to_pylist()]
    )  # fmt: skip
    water = rect(1000, 500, 1000, 1500)
    for cell in dry:
        center = Point(h3.cell_to_latlng(cell)[::-1])
        assert city.contains(center)
        assert (cell in wet) is not water.intersects(center)


def test_the_cells_layer_says_who_and_what_is_within_walking_distance(walk_ctx, tmp_path) -> None:
    publish(walk_ctx, tmp_path / "data")
    cells = json.loads((tmp_path / "data" / "tiles" / "walk.cells.geojson").read_text())
    found = {f["properties"]["h"]: f["properties"] for f in cells["features"]}
    home = h3.latlng_to_cell(*at(0, 0), 9)
    assert home in found
    here = found[home]
    assert set(here) == {"h", "p", "d", "dk", "k", "f_walk", "f_neighbors", "f_dest", "f_corners"}
    center_m = to_meters(np.array([Point(h3.cell_to_latlng(home)[::-1])], dtype=object))
    blocks_m = to_meters(np.array([point_at(b[0], b[1]) for b in BLOCK_ROWS], dtype=object))
    near = shapely.distance(center_m[0], blocks_m) <= walk.WALK_5_MIN_M
    assert here["p"] == sum(b[2] for b, n in zip(BLOCK_ROWS, near, strict=True) if n)
    assert 0 < here["d"] <= 7 and here["dk"] & walk.KIND_BITS["library"]
    assert not here["dk"] & walk.KIND_BITS["transit"]  # SEPTA's stops are not installed here
    # Every cell's ranks are among the cells.
    assert max(c["f_neighbors"] for c in found.values()) > 90
    assert all(f["geometry"]["type"] == "Polygon" for f in cells["features"])


def install_stress(ctx) -> None:
    rows = [
        # (objectid, link, level, facility, speed, lanes, east): link 7 runs both ways and its
        # directions differ; link 8 is a trail; link 9 has no level; link 10 is a calm street.
        (1, 7.0, 2.0, "No Facility", 25.0, 2.0, 0),
        (2, 7.0, 3.0, "Bike Lane", 30.0, 2.0, 0),
        (3, 8.0, 1.0, "Multi-use Trail / Off-Road", 0.0, 2.0, 300),
        (4, 9.0, None, "No Facility", 25.0, 2.0, 600),
        (5, 10.0, 1.0, "No Facility", 25.0, 1.0, 900),
    ]
    table = pa.table(
        {
            "objectid": [r[0] for r in rows],
            "no": [r[1] for r in rows],
            "lts": [r[2] for r in rows],
            "bike_facility": [r[3] for r in rows],
            "vehiclespeed": [r[4] for r in rows],
            "totnumlanes": [r[5] for r in rows],
            "geometry": [
                wkb(LineString([at(r[6], 0)[::-1], at(r[6] + 100, 0)[::-1]])) for r in rows
            ],
        }
    )
    install_snapshot(ctx, "dvrpc_lts", table, geometry=True, fetched_at=WHEN,
                     geometry_types=["LineString"])  # fmt: skip


def test_traffic_stress_shows_each_street_once_with_its_more_stressful_direction(
    context_factory, tmp_path
) -> None:
    ctx = context_factory(now=NOW)
    install_stress(ctx)
    store = SnapshotStore(ctx.cache, "dvrpc_lts")
    out = tmp_path / "cycling.stress.geojson"
    result = build_stress(ctx, {"dvrpc_lts": store.path_for(store.current())}, out, AS_OF)
    found = [f["properties"] for f in json.loads(out.read_text())["features"]]
    assert found == [
        {"l": 3, "l2": 2, "bf": 3, "sp": 30, "ln": 2},
        {"l": 1, "bf": 6, "ln": 2},
        {"l": 1, "sp": 25, "ln": 1},
    ]
    assert result.notes == [
        "stress: 3 street segments rated by DVRPC: 2 at level 1, 0 at level 2, 1 at level 3, "
        "0 at level 4; 1 whose two directions differ show the more stressful one"
    ]


def test_zoomed_out_cycling_tiles_keep_stressful_streets_and_bike_lanes() -> None:
    options = TILE_OPTIONS["tiles/cycling.pmtiles"]
    rule = json.loads(options[options.index("--feature-filter") + 1])["stress"]
    assert rule == ["any", [">=", "l", 3], [">=", "bf", 3], [">=", "$zoom", 12]]
    assert TILE_OPTIONS["tiles/walk.pmtiles"][:2] == ["--minimum-zoom=8", "--maximum-zoom=14"]


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe is not installed")
def test_with_tippecanoe_the_walking_files_have_their_layers(
    walk_ctx, tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("PK_TIPPECANOE", "tippecanoe")
    install_stress(walk_ctx)
    result = publish(walk_ctx, tmp_path / "data")
    assert {"tiles/walk.pmtiles", "tiles/cycling.pmtiles"} <= set(result.tiles_built)
    assert sorted(pmtiles_layer_names(tmp_path / "data" / "tiles" / "walk.pmtiles")) == [
        "block_groups",
        "cells",
    ]
    cycling = tmp_path / "data" / "tiles" / "cycling.pmtiles"
    assert pmtiles_layer_names(cycling) == ["stress"]
    # Zoomed out, the calm street with no bike lane is left out; from zoom 12 it is there.
    by_zoom: dict[int, list[dict]] = {}
    for zoom, data in tile_list(cycling):
        by_zoom.setdefault(zoom, []).extend(p for _, p in tile_features(data, "stress"))
    assert by_zoom[10] and all(p["l"] >= 3 or p.get("bf", 0) >= 3 for p in by_zoom[10])
    calm = [p for p in by_zoom[14] if p["l"] == 1 and "bf" not in p]
    assert calm and {p["l"] for p in by_zoom[14]} == {1, 3}
