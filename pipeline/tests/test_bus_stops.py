"""Bus and trolley stops from OpenStreetMap (M2.2): which elements are stops, how each answer is
read, the 10 meter rule for shelters and benches mapped on their own, what the map shows, and the
published `stops` layer. The snapshot is built from the hand made tests/fixtures/osm_sample.osm
without DuckDB, by the adapter's own functions."""

from __future__ import annotations

import json
import shutil
from datetime import UTC, date, datetime
from pathlib import Path

import pyarrow as pa
import pytest
import shapely
from pyproj import Transformer
from shapely.geometry import box

from placekeepers.adapters.osm import Element, elements_table, way_geometry
from placekeepers.derive.bus_stops import (
    BENCH,
    NEARBY_METERS,
    NEITHER,
    SHELTER,
    UNKNOWN,
    answer,
    comfort,
    comfort_counts,
    find_stops,
    is_stop,
    stop_modes,
    summary_note,
)
from placekeepers.publish import publish
from placekeepers.publish.tiles import pmtiles_layer_names

from .conftest import FIXTURES, install_snapshot
from .osm_pbf import read_osm_xml

CITY = shapely.union_all(
    [box(-75.170, 39.950, -75.160, 39.966), box(-75.160, 39.950, -75.150, 39.966)]
)
DAY = date(2026, 10, 3)
TAGS = ("highway=bus_stop", "public_transport=platform", "amenity=shelter", "amenity=bench")
GEOMETRY_TYPES = ["LineString", "Point", "Polygon"]


def listed(tags: dict[str, str]) -> bool:
    return any(tags.get(key) == value for key, value in (t.split("=") for t in TAGS))


def sample_table() -> pa.Table:
    """The fixture as the adapter would keep it, with the same functions."""
    nodes, ways, _ = read_osm_xml(FIXTURES / "osm_sample.osm")
    points = {node.id: (node.lon, node.lat) for node in nodes}
    elements = [
        Element("node", node.id, node.tags, shapely.Point(node.lon, node.lat))
        for node in nodes
        if listed(node.tags)
    ]
    elements += [
        Element("way", way.id, way.tags, way_geometry(way.refs, [points[r] for r in way.refs]))
        for way in ways
        if listed(way.tags)
    ]
    table, _ = elements_table((elements, 0), CITY, DAY)
    return table


def stops_by_id() -> dict[str, dict]:
    stops, _ = find_stops(sample_table())
    return {stop.id: stop.properties() for stop in stops if stop.in_city}


# Which elements are stops ----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("tags", "expected"),
    [
        ({"highway": "bus_stop"}, True),
        ({"highway": "bus_stop", "public_transport": "platform", "bus": "yes"}, True),
        ({"highway": "bus_stop", "public_transport": "stop_position"}, False),
        ({"public_transport": "stop_position", "bus": "yes"}, False),
        ({"railway": "platform", "public_transport": "platform", "tram": "yes"}, True),
        ({"public_transport": "platform", "trolleybus": "yes"}, True),
        ({"public_transport": "platform", "highway": "platform"}, True),
        ({"public_transport": "platform"}, False),
        ({"railway": "platform", "public_transport": "platform", "train": "yes"}, False),
        ({"public_transport": "platform", "tram": "yes", "subway": "yes"}, False),
        ({"public_transport": "platform", "tram": "yes", "tunnel": "yes"}, False),
        ({"public_transport": "platform", "tram": "yes", "location": "underground"}, False),
        ({"public_transport": "platform", "tram": "yes", "layer": "-2"}, False),
        ({"public_transport": "platform", "tram": "yes", "level": "-1;0"}, False),
        ({"public_transport": "platform", "tram": "yes", "level": "0"}, True),
        ({"highway": "bus_stop", "access": "private"}, False),
        ({"amenity": "shelter", "shelter_type": "public_transport"}, False),
    ],
)
def test_which_elements_are_stops(tags: dict[str, str], expected: bool) -> None:
    assert is_stop(tags) is expected


def test_how_a_stop_is_served() -> None:
    assert stop_modes({"highway": "bus_stop"}) == 1
    assert stop_modes({"public_transport": "platform", "tram": "yes"}) == 2
    assert stop_modes({"highway": "bus_stop", "tram": "yes"}) == 3


# Answers ---------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("key", "value", "expected"),
    [
        ("shelter", "yes", 1),
        ("shelter", "no", 0),
        ("shelter", "separate", 1),
        ("shelter", "maybe", None),
        ("bench", " Yes ", 1),
        ("lit", "automatic", 1),
        ("lit", "disused", 0),
        ("tactile_paving", "incorrect", 1),
        ("departures_board", "realtime", 1),
        ("departures_board", "none", 0),
        ("covered", "yes", 1),
        ("wheelchair", "limited", 2),
        ("wheelchair", "designated", 1),
        ("wheelchair", "no", 0),
    ],
)
def test_answers_are_yes_no_or_unknown(key: str, value: str, expected: int | None) -> None:
    assert answer({key: value}, key) == expected
    assert answer({}, key) is None


@pytest.mark.parametrize(
    ("shelter", "bench", "covered", "expected"),
    [
        (1, None, None, SHELTER),
        (1, 0, None, SHELTER),
        (0, 1, None, BENCH),
        (None, 1, None, BENCH),
        (0, 0, None, NEITHER),
        (0, 0, 1, SHELTER),  # the whole stop is under a roof
        (0, None, None, UNKNOWN),  # only one answer: not yet fully surveyed
        (None, 0, None, UNKNOWN),
        (None, None, None, UNKNOWN),
        (None, None, 0, UNKNOWN),
    ],
)
def test_what_the_map_shows(shelter, bench, covered, expected) -> None:
    assert comfort(shelter, bench, covered) == expected


# Shelters and benches mapped on their own -------------------------------------------------------

_TO_M = Transformer.from_crs("EPSG:4326", "EPSG:32618", always_xy=True)
_TO_DEG = Transformer.from_crs("EPSG:32618", "EPSG:4326", always_xy=True)


def moved(lng: float, lat: float, east: float = 0.0, north: float = 0.0) -> shapely.Point:
    x, y = _TO_M.transform(lng, lat)
    return shapely.Point(*_TO_DEG.transform(x + east, y + north))


def table_of(elements: list[Element]) -> pa.Table:
    table, _ = elements_table((elements, 0), CITY, DAY)
    return table


def stop(osm_id: int, point: shapely.Point, **tags: str) -> Element:
    return Element("node", osm_id, {"highway": "bus_stop", **tags}, point)


def shelter(osm_id: int, point: shapely.Point, **tags: str) -> Element:
    return Element("node", osm_id, {"amenity": "shelter", **tags}, point)


def found(elements: list[Element]) -> dict[str, dict]:
    stops, _ = find_stops(table_of(elements))
    return {s.id: s.properties() for s in stops}


def test_a_shelter_counts_within_ten_meters_and_not_beyond() -> None:
    origin = shapely.Point(-75.160, 39.955)
    near = moved(origin.x, origin.y, east=NEARBY_METERS - 0.1)
    far = moved(origin.x, origin.y, north=-200, east=NEARBY_METERS + 0.1)
    result = found(
        [
            stop(1, origin),
            shelter(2, near, shelter_type="public_transport"),
            stop(3, moved(origin.x, origin.y, north=-200)),
            shelter(4, far, shelter_type="public_transport"),
        ]
    )
    assert result["n1"]["c"] == SHELTER and result["n1"]["nb"] == 1
    assert result["n3"]["c"] == UNKNOWN and "sh" not in result["n3"]


def test_a_shelter_counts_only_for_the_nearest_stop() -> None:
    a = shapely.Point(-75.160, 39.955)
    b = moved(a.x, a.y, north=8)  # two stops 8 meters apart
    result = found(
        [
            stop(1, a),
            stop(2, b),
            shelter(3, moved(a.x, a.y, north=3), shelter_type="public_transport"),
        ]
    )
    assert result["n1"]["sh"] == 1
    assert "sh" not in result["n2"]


def test_a_stops_own_answer_wins_and_only_stop_shelters_count() -> None:
    a = shapely.Point(-75.160, 39.955)
    b = moved(a.x, a.y, north=100)
    c = moved(a.x, a.y, north=200)
    result = found(
        [
            stop(1, a, shelter="no"),
            shelter(2, moved(a.x, a.y, east=2), shelter_type="public_transport"),
            stop(3, b),
            shelter(4, moved(b.x, b.y, east=2), shelter_type="picnic_shelter"),
            stop(5, c),
            shelter(6, moved(c.x, c.y, east=2), bench="yes"),  # no shelter_type at all
        ]
    )
    assert result["n1"]["sh"] == 0 and "nb" not in result["n1"]
    assert "sh" not in result["n3"]
    assert (result["n5"]["sh"], result["n5"]["bn"], result["n5"]["nb"]) == (1, 1, 3)


# The fixture, end to end -------------------------------------------------------------------------


def test_every_stop_in_the_sample() -> None:
    stops = stops_by_id()
    # Not stops: the private stop, the train platform and the underground trolley platform. Not
    # on the map: the stop outside the city.
    assert sorted(stops) == sorted(
        ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n9", "n10", "n11", "n12", "n18", "w3"]
    )
    assert stops["n1"] == {
        "id": "n1",
        "c": SHELTER,
        "md": 1,
        "sh": 1,
        "bn": 0,
        "bi": 1,
        "lt": 1,
        "tp": 0,
        "wc": 2,
        "db": 1,
        "nm": "Broad St & Arch St",
        "ref": "10264",
        "gs": "10264",
    }
    shown = {key: value["c"] for key, value in stops.items()}
    assert shown == {
        "n1": SHELTER,
        "n2": SHELTER,  # a shelter 6 m away
        "n3": NEITHER,
        "n4": BENCH,
        "n5": UNKNOWN,  # the bench is 25 m away
        "n6": UNKNOWN,  # no shelter, bench not surveyed; a shelter 3 m away does not overrule
        "n7": SHELTER,  # under a roof
        "n9": SHELTER,  # a shelter with no type, 2 m away
        "n10": UNKNOWN,  # across the street, 14 m from that shelter
        "n11": BENCH,  # a picnic shelter is not a bus shelter
        "n12": UNKNOWN,  # "maybe" is not an answer
        "n18": SHELTER,  # a shelter just outside the city, 8 m away
        "w3": SHELTER,  # a shelter with a bench at the end of the platform
    }
    assert {key: value.get("nb") for key, value in stops.items() if value.get("nb")} == {
        "n2": 1,
        "n9": 1,
        "n18": 1,
        "w3": 3,
    }
    assert stops["n7"]["md"] == 2 and stops["n7"]["cv"] == 1
    assert stops["n6"]["sh"] == 0 and "bn" not in stops["n6"]


def test_values_we_do_not_recognize_are_noted() -> None:
    _, notes = find_stops(sample_table())
    assert notes == ["Stop answers with values we do not recognize, shown as unknown: 1 shelter"]


def test_the_summary_counts_stops_inside_the_city() -> None:
    stops, _ = find_stops(sample_table())
    counts = comfort_counts(stops)
    assert counts == {SHELTER: 6, BENCH: 2, NEITHER: 1, UNKNOWN: 4}
    assert summary_note(counts, DAY) == (
        "Bus and trolley stops in OpenStreetMap (data of 2026-10-03): 13 in the city; 6 with a "
        "shelter or roof, 2 with a bench but no shelter mapped, 1 with neither, 4 not yet surveyed"
    )


# Publishing ------------------------------------------------------------------------------------


@pytest.fixture
def stops_ctx(context_factory):
    ctx = context_factory(now=datetime(2026, 10, 5, 3, 0, tzinfo=UTC))
    install_snapshot(
        ctx,
        "osm_philadelphia",
        sample_table(),
        geometry=True,
        fetched_at="2026-10-05T02:54:19Z",
        geometry_types=GEOMETRY_TYPES,
    )
    return ctx


def test_the_stops_layer_carries_the_contract_properties(stops_ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    result = publish(stops_ctx, out)
    data = json.loads((out / "tiles" / "transit.stops.geojson").read_text())
    features = data["features"]
    assert len(features) == 13
    assert all(f["geometry"]["type"] == "Point" for f in features)
    allowed = {
        "id",
        "c",
        "md",
        "sh",
        "bn",
        "bi",
        "lt",
        "tp",
        "wc",
        "db",
        "cv",
        "nb",
        "nm",
        "ref",
        "gs",
    }
    assert all(set(f["properties"]) <= allowed for f in features)
    first = next(f for f in features if f["properties"]["id"] == "n1")
    assert first["geometry"]["coordinates"] == [-75.158, 39.954]
    assert "tiles/transit.stops.geojson" in result.manifest["files"]
    assert result.manifest["layers"]["bus_stops"] == {
        "file": "tiles/transit.pmtiles",
        "source_layer": "stops",
        "sources": ["osm_philadelphia"],
    }
    assert any(
        note.startswith("Bus and trolley stops in OpenStreetMap")
        for note in result.manifest["notes"]
    )


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe is not installed")
def test_with_tippecanoe_the_stops_become_transit_tiles(stops_ctx, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("PK_TIPPECANOE", "tippecanoe")
    out = tmp_path / "data"
    result = publish(stops_ctx, out)
    assert "tiles/transit.pmtiles" in result.tiles_built
    assert pmtiles_layer_names(out / "tiles" / "transit.pmtiles") == ["stops"]
