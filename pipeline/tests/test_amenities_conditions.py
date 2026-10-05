"""Amenities and conditions (M3.5): benches, picnic tables, drinking water, toilets and public
bookcases from OpenStreetMap; libraries, recreation centers, pools, spraygrounds and park drinking
fountains from the City; and conditions reported to 311, counted by block. Every snapshot is made
up here; nothing touches the network except through the fake servers."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import box

from placekeepers.adapters.osm import Element, elements_table
from placekeepers.adapters.philly311 import SERVICE_CODES, Philly311Conditions
from placekeepers.derive.amenities import (
    ANYONE,
    CUSTOMERS,
    KINDS,
    amenity_properties,
    find_amenities,
    summary_note,
)
from placekeepers.publish import publish
from placekeepers.publish.city_places import (
    build_libraries,
    build_park_water,
    build_pools,
    build_recreation,
)
from placekeepers.publish.conditions import BLOCK_METERS, WINDOW_DAYS, condition_builder, window

from . import streets_fixtures as fx
from .conftest import FakeCarto, install_snapshot

NOW = datetime(2026, 10, 5, 15, 0, tzinfo=UTC)
CITY = box(-75.2, 39.9, -75.1, 40.0)
DAY = date(2026, 10, 3)


def osm_table(elements: list[Element]) -> pa.Table:
    table, _ = elements_table((elements, 0), CITY, DAY)
    return table


def node(osm_id: int, lng: float, lat: float, **tags: str) -> Element:
    return Element("node", osm_id, dict(tags), shapely.Point(lng, lat))


# OpenStreetMap amenities ----------------------------------------------------------------------


def sample_elements() -> list[Element]:
    return [
        node(1, -75.16, 39.95, amenity="bench", backrest="yes", covered="yes"),
        node(2, -75.161, 39.95, amenity="bench", backrest="maybe"),
        node(3, -75.162, 39.95, amenity="bench", access="private"),
        node(4, -75.163, 39.95, leisure="picnic_table", covered="no"),
        node(
            5,
            -75.164,
            39.95,
            amenity="drinking_water",
            bottle="yes",
            seasonal="summer",
            indoor="yes",
        ),
        node(
            6,
            -75.165,
            39.95,
            amenity="toilets",
            access="customers",
            fee="no",
            wheelchair="limited",
            changing_table="yes",
            opening_hours="Mo-Fr 08:00-17:00",
            name="Station toilets",
        ),
        node(7, -75.166, 39.95, amenity="toilets", access="yes", fee="yes", wheelchair="no"),
        node(8, -75.167, 39.95, amenity="toilets"),
        node(9, -75.168, 39.95, amenity="public_bookcase", name="Little Free Library"),
        # Just outside the city box: in the snapshot's margin, never on the map.
        node(10, -75.0995, 39.95, amenity="drinking_water"),
        node(11, -75.169, 39.95, amenity="toilets", disused="yes"),
        node(12, -75.17, 39.95, highway="bus_stop", bench="yes"),
    ]


def by_id(kind: str, elements=None) -> dict[str, dict]:
    found, _ = find_amenities(osm_table(elements or sample_elements()), kind)
    return {item.id: item.properties for item in found}


def test_each_kind_is_its_own_tag() -> None:
    assert set(KINDS) == {"benches", "picnic_tables", "water", "toilets", "bookcases"}
    assert set(by_id("benches")) == {"n1", "n2"}  # the private bench is left out
    assert set(by_id("picnic_tables")) == {"n4"}
    assert set(by_id("water")) == {"n5", "n10"}
    assert set(by_id("toilets")) == {"n6", "n7", "n8"}  # the disused one is left out
    assert set(by_id("bookcases")) == {"n9"}


def test_answers_are_yes_no_or_left_out() -> None:
    benches = by_id("benches")
    assert benches["n1"] == {"id": "n1", "br": 1, "cv": 1}
    assert benches["n2"] == {"id": "n2"}  # "maybe" is not an answer: unknown, never no
    assert by_id("picnic_tables")["n4"] == {"id": "n4", "cv": 0}
    assert by_id("water")["n5"] == {"id": "n5", "bt": 1, "sn": 1, "in": 1}
    toilets = by_id("toilets")
    assert toilets["n6"] == {
        "id": "n6",
        "ac": CUSTOMERS,
        "fee": 0,
        "wc": 2,
        "ct": 1,
        "oh": "Mo-Fr 08:00-17:00",
        "nm": "Station toilets",
    }
    assert toilets["n7"] == {"id": "n7", "ac": ANYONE, "fee": 1, "wc": 0}
    assert toilets["n8"] == {"id": "n8"}
    assert by_id("bookcases")["n9"] == {"id": "n9", "nm": "Little Free Library"}


def test_unknown_access_is_not_called_public() -> None:
    assert "ac" not in amenity_properties("toilets", "n1", {"amenity": "toilets"})
    assert amenity_properties("toilets", "n1", {"access": "permissive"})["ac"] == ANYONE


def test_notes_count_inside_the_city_and_what_was_left_out() -> None:
    found, notes = find_amenities(osm_table(sample_elements()), "toilets")
    assert notes == ["Public toilets: 1 not open to the public left out"]
    line = summary_note("toilets", found, "2026-10-03")
    assert line == (
        "Public toilets in OpenStreetMap (data of 2026-10-03): 3 in the city (as mapped: 1 open "
        "to anyone)"
    )
    water, _ = find_amenities(osm_table(sample_elements()), "water")
    assert summary_note("water", water, None) == (
        "Drinking water in OpenStreetMap: 1 in the city (as mapped: 1 where a bottle can be filled)"
    )


@pytest.fixture
def osm_ctx(context_factory):
    ctx = context_factory(now=NOW)
    install_snapshot(
        ctx,
        "osm_philadelphia",
        osm_table(sample_elements()),
        geometry=True,
        fetched_at="2026-10-05T02:54:19Z",
        geometry_types=["Point"],
    )
    return ctx


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def test_publish_writes_one_layer_per_amenity_inside_the_city(osm_ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    result = publish(osm_ctx, out)
    water = features(out / "tiles" / "amenities.water.geojson")
    assert [f["properties"]["id"] for f in water] == ["n5"]  # n10 lies outside the city
    assert water[0]["geometry"] == {"type": "Point", "coordinates": [-75.164, 39.95]}
    for kind in KINDS:
        assert f"tiles/amenities.{kind}.geojson" in result.manifest["files"]
    assert result.manifest["layers"]["drinking_water"] == {
        "file": "tiles/amenities.pmtiles",
        "source_layer": "water",
        "sources": ["osm_philadelphia"],
    }
    assert any(n.startswith("Benches in OpenStreetMap") for n in result.manifest["notes"])


# Public places from the City -------------------------------------------------------------------


def points_table(rows: list[dict], lnglats: list[tuple[float, float] | None]) -> pa.Table:
    columns: dict[str, list] = {key: [row.get(key) for row in rows] for key in rows[0]}
    columns["geometry"] = [
        shapely.to_wkb(shapely.Point(*ll), flavor="iso") if ll else None for ll in lnglats
    ]
    return pa.table(columns)


def write_snapshot(tmp_path: Path, name: str, table: pa.Table) -> Path:
    path = tmp_path / f"{name}.parquet"
    pq.write_table(table, path)
    return path


def test_libraries_keep_name_address_phone_and_only_free_library_links(tmp_path: Path) -> None:
    table = points_table(
        [
            {
                "objectid": 1,
                "building": "Andorra Library",
                "address": "705 East Cathedral Road",
                "zip_code": "19128-2106",
                "phone_number": "215-685-2552 ",
                "library_url": "https://libwww.freelibrary.org/locations/andorra-library",
            },
            {
                "objectid": 2,
                "building": "Elsewhere Library",
                "address": "1 Main St",
                "zip_code": None,
                "phone_number": None,
                "library_url": "https://example.com/not-the-library",
            },
            {
                "objectid": 3,
                "building": "Lost Library",
                "address": None,
                "zip_code": None,
                "phone_number": None,
                "library_url": None,
            },
        ],
        [(-75.21, 40.06), (-75.16, 39.95), (0.0, 0.0)],
    )
    out = tmp_path / "libraries.geojson"
    result = build_libraries(
        None, {"library_locations": write_snapshot(tmp_path, "l", table)}, out, date(2026, 10, 5)
    )
    found = [f["properties"] for f in features(out)]
    assert found == [
        {
            "id": "lib1",
            "nm": "Andorra Library",
            "ad": "705 East Cathedral Road",
            "zip": "19128",
            "ph": "215-685-2552",
            "url": "https://libwww.freelibrary.org/locations/andorra-library",
        },
        {"id": "lib2", "nm": "Elsewhere Library", "ad": "1 Main St"},
    ]
    assert result.notes == [
        "libraries: 2 Free Library locations",
        "libraries: 1 without a point in the city left out",
    ]


def test_recreation_keeps_centers_and_leaves_pools_to_the_pools_layer(tmp_path: Path) -> None:
    rows = [
        {
            "objectid": 1,
            "park_name": "Awbury Park and Recreation Center",
            "program_type": "PPR_REC",
            "site_class": "A",
            "building": "Y",
            "gym": "N",
        },
        {
            "objectid": 2,
            "park_name": "Lawncrest Recreation Center",
            "program_type": "PPR_REC",
            "site_class": "A",
            "building": "Y",
            "gym": "Y",
        },
        {
            "objectid": 3,
            "park_name": "Sample Older Adult Center",
            "program_type": "OLDER_ADULT_CENTER",
            "site_class": "S",
            "building": "Y",
            "gym": "N",
        },
        {
            "objectid": 4,
            "park_name": "Sample Pool",
            "program_type": "POOL",
            "site_class": "S",
            "building": "N",
            "gym": "N",
        },
    ]
    table = points_table(rows, [(-75.16, 39.95)] * 4)
    out = tmp_path / "recreation.geojson"
    result = build_recreation(
        None, {"ppr_program_sites": write_snapshot(tmp_path, "r", table)}, out, date(2026, 10, 5)
    )
    found = {f["properties"]["id"]: f["properties"] for f in features(out)}
    assert set(found) == {"rec1", "rec2", "rec3"}
    assert found["rec2"] == {
        "id": "rec2",
        "nm": "Lawncrest Recreation Center",
        "k": 1,
        "bd": 1,
        "gym": 1,
    }
    assert found["rec3"]["k"] == 2
    assert result.notes[0].startswith("recreation: 2 recreation centers, 1 older adult centers")


def test_pools_and_spraygrounds_say_whether_they_are_in_service(tmp_path: Path) -> None:
    pools = points_table(
        [
            {
                "objectid": 1,
                "pool_name": "Fox Chase Pool",
                "park_name": "Fox Chase",
                "address_911": "7901 RIDGEWAY ST",
                "zip_code": "19111",
                "pool_type": "OUTDOOR",
                "pool_status": "ACTIVE",
                "pool_open_date": datetime(2026, 6, 24),
                "ada_access": "Y",
                "ada_lift": "Y",
            },
            {
                "objectid": 2,
                "pool_name": "Closed Pool",
                "park_name": "Somewhere",
                "address_911": None,
                "zip_code": None,
                "pool_type": "INDOOR",
                "pool_status": "INACTIVE",
                "pool_open_date": datetime(2026, 6, 24),
                "ada_access": "N",
                "ada_lift": None,
            },
        ],
        [(-75.08, 40.07), (-75.16, 39.95)],
    )
    sprays = points_table(
        [
            {
                "objectid": 1386,
                "park_name": "Finnegan Playground",
                "spray_type": "SPRINKLER",
                "spray_status": "ACTIVE",
            },
            {
                "objectid": 1400,
                "park_name": "Sample Playground",
                "spray_type": "SPRAYGROUND",
                "spray_status": "UNKNOWN",
            },
        ],
        [(-75.2, 39.93), (-75.17, 39.98)],
    )
    out = tmp_path / "pools.geojson"
    paths = {
        "ppr_swimming_pools": write_snapshot(tmp_path, "p", pools),
        "ppr_spraygrounds": write_snapshot(tmp_path, "s", sprays),
    }
    result = build_pools(None, paths, out, date(2026, 10, 5))
    found = {f["properties"]["id"]: f["properties"] for f in features(out)}
    assert found["pool1"] == {
        "id": "pool1",
        "nm": "Fox Chase Pool",
        "k": 1,
        "st": 1,
        "in": 0,
        "ada": 1,
        "ad": "7901 RIDGEWAY ST",
        "op": "2026-06-24",
    }
    assert found["pool2"] == {
        "id": "pool2",
        "nm": "Closed Pool",
        "k": 1,
        "st": 0,
        "in": 1,
        "ada": 0,
    }
    assert found["spray1386"] == {"id": "spray1386", "nm": "Finnegan Playground", "k": 3, "st": 1}
    assert found["spray1400"] == {"id": "spray1400", "nm": "Sample Playground", "k": 2}
    assert result.notes == [
        "pools: 2 pools (1 in service), 1 spraygrounds (0 in service) and 1 sprinklers (1 in "
        "service), as Parks and Recreation lists them"
    ]


def test_park_water_names_the_fountain_and_its_park(tmp_path: Path) -> None:
    table = points_table(
        [
            {
                "objectid": 1,
                "amenity_name": "Verree Road Picnic Area Restrooms",
                "park_name": "Pennypack Park",
                "station_type": "FOUNTAIN",
                "location": "OUTDOOR",
            },
            {
                "objectid": 2,
                "amenity_name": "Lawncrest Recreation Center",
                "park_name": "Lawncrest Recreation Center",
                "station_type": "HYDRATION",
                "location": "INDOOR",
            },
        ],
        [(-75.04, 40.06), (-75.09, 40.04)],
    )
    out = tmp_path / "water.geojson"
    build_park_water(
        None,
        {"ppr_hydration_stations": write_snapshot(tmp_path, "w", table)},
        out,
        date(2026, 10, 5),
    )
    found = [f["properties"] for f in features(out)]
    assert found == [
        {
            "id": "water1",
            "nm": "Verree Road Picnic Area Restrooms",
            "pk": "Pennypack Park",
            "k": 1,
            "in": 0,
        },
        {"id": "water2", "nm": "Lawncrest Recreation Center", "k": 2, "in": 1},
    ]


# Conditions reported to 311 -------------------------------------------------------------------

NEWEST = date(2026, 10, 2)


def request(code: str, status: str, day: date, xy: tuple[float, float] | None) -> dict:
    lng, lat = fx.lnglat(*xy) if xy else (None, None)
    closed = day + timedelta(days=3) if status == "Closed" else None
    return {
        "service_code": code,
        "status": status,
        "requested": day,
        "closed": closed,
        "lat": lat,
        "lng": lng,
    }


def requests_table() -> pa.Table:
    rows = [
        # Main St, block 1: two dumping requests, one still open.
        request("SR-ST02", "Open", NEWEST, (40, 8)),
        request("SR-ST02", "Closed", NEWEST - timedelta(days=20), (50, -10)),
        # Oak St, block 3: one, closed.
        request("SR-ST02", "Closed", NEWEST - timedelta(days=60), (60, 108)),
        # Too old for the 90 day window.
        request("SR-ST02", "Closed", NEWEST - timedelta(days=WINDOW_DAYS), (40, 5)),
        # Too far from any street, and one without a point.
        request("SR-ST02", "Open", NEWEST, (60, 100 + 2 * BLOCK_METERS)),
        request("SR-ST02", "Open", NEWEST, None),
        # Lights on 2nd St, block 6: a street light and an alley light.
        request("SR-ST04", "Open", NEWEST - timedelta(days=5), (128, 40)),
        request("SR-ST06", "Open", NEWEST - timedelta(days=1), (112, 60)),
        # Graffiti on Main St, block 2.
        request("SR-CL01", "Closed", NEWEST - timedelta(days=10), (200, -12)),
    ]
    return pa.table({key: [row[key] for row in rows] for key in rows[0]})


@pytest.fixture
def conditions_paths(tmp_path: Path) -> dict[str, Path]:
    centerlines = tmp_path / "centerlines.parquet"
    pq.write_table(fx.centerlines(), centerlines)
    requests = tmp_path / "requests.parquet"
    pq.write_table(requests_table(), requests)
    return {"philly311_conditions": requests, "street_centerlines": centerlines}


def condition_features(kind: str, paths: dict[str, Path], tmp_path: Path):
    out = tmp_path / f"{kind}.geojson"
    result = condition_builder(kind)(None, paths, out, date(2026, 10, 5))
    return {f["properties"]["id"]: f for f in features(out)}, result


def test_requests_count_on_their_block_in_the_last_90_days(conditions_paths, tmp_path) -> None:
    found, result = condition_features("dumping", conditions_paths, tmp_path)
    assert set(found) == {1, 3}
    assert found[1]["properties"] == {"id": 1, "name": "MAIN ST", "n": 2, "o": 1, "d": "2026-10-02"}
    assert found[3]["properties"] == {"id": 3, "name": "OAK ST", "n": 1, "o": 0, "d": "2026-08-03"}
    # The point is the middle of the block, never the reported spot.
    lng, lat = found[1]["geometry"]["coordinates"]
    middle = fx.lnglat(60, 0)
    assert abs(lng - middle[0]) < 1e-6 and abs(lat - middle[1]) < 1e-6
    assert result.notes == [
        "dumping: 3 requests to 311 about illegal dumping from 2026-07-05 to 2026-10-02, on 2 "
        "blocks; 1 still open; 2 without a point or more than 50 meters from a street left out"
    ]


def test_lights_count_street_and_alley_lights_together(conditions_paths, tmp_path) -> None:
    found, _ = condition_features("lights", conditions_paths, tmp_path)
    assert found[6]["properties"] == {
        "id": 6,
        "name": "2ND ST",
        "n": 2,
        "o": 2,
        "d": "2026-10-01",
        "a": 1,
    }
    graffiti, _ = condition_features("graffiti", conditions_paths, tmp_path)
    assert graffiti[2]["properties"]["n"] == 1 and "a" not in graffiti[2]["properties"]


def test_the_window_ends_with_the_newest_request() -> None:
    assert window(NEWEST) == (date(2026, 7, 5), NEWEST)
    assert (window(NEWEST)[1] - window(NEWEST)[0]).days == WINDOW_DAYS - 1


def test_without_centerlines_there_are_no_blocks(conditions_paths, tmp_path) -> None:
    paths = {"philly311_conditions": conditions_paths["philly311_conditions"]}
    found, result = condition_features("graffiti", paths, tmp_path)
    assert found == {} and result.notes == [
        "graffiti: the street centerlines are missing, so no blocks"
    ]


def test_311_asks_only_for_conditions_and_never_for_who_or_what_was_written(
    context_factory, tmp_path
) -> None:
    assert set(SERVICE_CODES) == {"SR-ST02", "SR-ST04", "SR-ST06", "SR-CL01"}
    rows = [
        {
            "cartodb_id": n,
            "service_code": "SR-ST02",
            "status": "Open",
            "requested": "2026-10-02 12:00:00+00",
            "closed": "",
            "lat": "39.95",
            "lng": "-75.16",
        }
        for n in range(1, 4)
    ]
    server = FakeCarto(tables={"public_cases_fc": rows})
    ctx = context_factory(handler=server, now=NOW)
    source = ctx.registry.sources["philly311_conditions"]
    adapter = Philly311Conditions(source, ctx)
    dest = tmp_path / "raw"
    dest.mkdir()
    adapter.fetch(dest)
    for query in server.queries:
        select = query.split(" FROM ")[0].lower()
        for name in adapter.never_fetch:
            assert name not in select, query
        assert "service_code IN ('SR-ST02', 'SR-ST04', 'SR-ST06', 'SR-CL01')" in query
    assert "encampment" not in source.endpoint.where.lower()
    assert [c.name for c in adapter.columns] == [
        "service_code",
        "status",
        "requested",
        "closed",
        "lat",
        "lng",
    ]


def test_the_registry_layers_say_what_they_are(context_factory) -> None:
    layers = context_factory(now=NOW).registry.layers
    osm = ("benches", "picnic_tables", "drinking_water", "toilets", "bookcases")
    for layer_id in osm:
        assert layers[layer_id].label.endswith(", as mapped in OpenStreetMap")
        assert layers[layer_id].guide == "streetcomplete"
    on_foot = {"drinking_water", "toilets", "park_water"}
    for layer_id in (
        *osm,
        "park_water",
        "libraries",
        "recreation_centers",
        "pools",
        "dumping",
        "dark_lights",
        "graffiti",
    ):
        assert layers[layer_id].default.field == (layer_id in on_foot), layer_id
        assert layers[layer_id].default.analysis is False
    for layer_id in ("dumping", "dark_lights", "graffiti"):
        assert "never by address" in layers[layer_id].description
        assert layers[layer_id].group == "conditions"
