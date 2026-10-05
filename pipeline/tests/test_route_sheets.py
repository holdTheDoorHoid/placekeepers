"""The route survey sheets (M2.4): SEPTA's stop order for each route and direction, the join of
SEPTA's stops to OpenStreetMap's, and the published tables/routes files. Built on the made up feed
in tests/transit_fixtures.py, with SEPTA's two extra files (route_stops.txt, directions.txt) added
here; nothing touches the network."""

from __future__ import annotations

import io
import json
import math
import re
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import box

from placekeepers.adapters.osm import Element, elements_table
from placekeepers.derive.bus_stops import (
    BENCH,
    SHELTER,
    SeptaPoint,
    Stop,
    match_septa,
    stop_numbers,
)
from placekeepers.derive.route_stops import Direction, read_route_order
from placekeepers.publish import publish
from placekeepers.publish.manifest import ROUTE_SHEET, file_index
from placekeepers.publish.route_sheets import (
    CREDIT,
    INDEX,
    build_route_sheets,
    meters_along,
    route_file,
)
from placekeepers.publish.stop_table import STOP_TABLE, build_stop_table
from placekeepers.runner import all_statuses, fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import install_snapshot
from .transit_fixtures import STOPS, bus_files, rail_files, write_feed

NOW = datetime(2026, 10, 5, 15, 0, tzinfo=UTC)
CITY = box(-75.2, 39.9, -75.1, 40.0)

#: SEPTA's list, deliberately out of order: route 10 northbound lists 100, 101 and 103 (and 104,
#: which no trip serves); its southbound list has no trips at all; T1 lists only 100, although
#: its trips also serve 105.
ROUTE_STOPS = [
    ("10", "0", "103", "3"),
    ("10", "0", "100", "1"),
    ("10", "0", "104", "4"),
    ("10", "0", "101", "2"),
    ("10", "1", "103", "1"),
    ("10", "1", "100", "2"),
    ("T1", "0", "100", "1"),
]
DIRECTIONS = [
    ("10", "0", "Northbound", "Broad-Tioga"),
    ("10", "1", "Southbound", "Broad-Erie"),
    ("T1", "0", "Eastbound", "Trolley Loop"),
]


def csv_text(header: str, rows: list[tuple]) -> str:
    return "\n".join([header, *(",".join(row) for row in rows)]) + "\n"


def ordered_bus_files() -> dict[str, str]:
    files = bus_files()
    files["route_stops.txt"] = csv_text(
        "route_id,direction_id,stop_id,route_stop_sort_order", ROUTE_STOPS
    )
    files["directions.txt"] = csv_text(
        "route_id,direction_id,direction,direction_destination", DIRECTIONS
    )
    return files


def inner_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in files.items():
            archive.writestr(name, text)
    return buffer.getvalue()


def septa_download(bus: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        archive.writestr("google_bus.zip", inner_zip(bus))
        archive.writestr("google_rail.zip", inner_zip(rail_files()))
    return buffer.getvalue()


def run_septa(ctx_factory, bus: dict[str, str]):
    """Fetch and check the made up download, as the weekly run would."""
    body = septa_download(bus)
    headers = {"Last-Modified": "Fri, 25 Sep 2026 17:14:15 GMT"}
    ctx = ctx_factory(
        handler=lambda request: httpx.Response(200, content=body, headers=headers), now=NOW
    )
    source = ctx.registry.sources["septa_gtfs"]
    source = source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})
    assert fetch_source(ctx, source).outcome == "downloaded"
    checked = validate_source(ctx, source)
    assert checked.outcome == "ok", checked.detail
    store = SnapshotStore(ctx.cache, "septa_gtfs")
    meta = store.current()
    return ctx, meta.notes, pq.read_table(store.path_for(meta)).to_pylist()


def offset(lat: float, lng: float, north: float = 0.0, east: float = 0.0) -> tuple[float, float]:
    """A point some meters north and east of another (close enough for tens of meters)."""
    return lat + north / 111_320, lng + east / (111_320 * math.cos(math.radians(lat)))


def osm_stop(osm_id: int, lat: float, lng: float, **tags: str) -> Stop:
    return Stop(f"n{osm_id}", lat, lng, True, {"highway": "bus_stop", **tags})


def septa_point(stop_id: str, lat: float, lng: float, *former: str) -> SeptaPoint:
    return SeptaPoint(stop_id=stop_id, former_ids=tuple(former), lat=lat, lng=lng)


# SEPTA's stop order ----------------------------------------------------------------------------


def test_the_order_is_septas_less_the_stops_no_trip_serves(tmp_path: Path) -> None:
    write_feed(tmp_path, ordered_bus_files())
    orders, notes = read_route_order(duckdb.connect(), tmp_path)
    assert orders == {
        "10": [Direction(0, "Northbound", "Broad-Tioga", ["100", "101", "103"])],
        "T1": [Direction(0, "Eastbound", "Trolley Loop", ["100"])],
    }
    # 104 northbound and both southbound stops have no trip; 105 on T1 and every stop of L1 and
    # 59 are served but not listed.
    assert notes == [
        "3 stops on SEPTA's route lists have no trip there and are left out",
        "5 stops trips serve are missing from SEPTA's route lists",
    ]


def test_without_septas_list_no_route_has_an_order(tmp_path: Path) -> None:
    write_feed(tmp_path, bus_files())
    assert read_route_order(duckdb.connect(), tmp_path) == (
        {},
        ["The feed has no route_stops.txt, so routes have no stop order"],
    )


def test_a_direction_without_a_name_still_has_its_stops(tmp_path: Path) -> None:
    files = ordered_bus_files()
    files["directions.txt"] = csv_text("route_id,direction_id,direction,direction_destination", [])
    write_feed(tmp_path, files)
    orders, _ = read_route_order(duckdb.connect(), tmp_path)
    assert orders["10"] == [Direction(0, None, None, ["100", "101", "103"])]


def test_the_snapshot_keeps_each_routes_stop_order(context_factory) -> None:
    _, notes, rows = run_septa(context_factory, ordered_bus_files())
    routes = {row["route_id"]: row for row in rows if row["kind"] == "route"}
    assert routes["10"]["stop_order"] == [
        {
            "direction_id": 0,
            "direction": "Northbound",
            "destination": "Broad-Tioga",
            "stop_ids": ["100", "101", "103"],
        }
    ]
    assert routes["T1"]["stop_order"][0]["stop_ids"] == ["100"]
    assert routes["L1"]["stop_order"] is None and routes["AIR"]["stop_order"] is None
    assert all(row["stop_order"] is None for row in rows if row["kind"] == "stop")
    assert "bus_metro: 3 stops on SEPTA's route lists have no trip there and are left out" in (
        notes
    )


def test_a_feed_without_septas_list_gives_no_order_and_says_so(context_factory) -> None:
    _, notes, rows = run_septa(context_factory, bus_files())
    assert all(row["stop_order"] is None for row in rows)
    assert "bus_metro: The feed has no route_stops.txt, so routes have no stop order" in (notes)


# Which OpenStreetMap stop is which SEPTA stop ---------------------------------------------------


def test_stop_numbers_come_from_ref_then_the_gtfs_id() -> None:
    stop = osm_stop(1, 39.96, -75.15, ref="101;102", **{"gtfs:stop_id": "7"})
    assert stop_numbers(stop) == ["101", "102", "7"]
    assert stop_numbers(osm_stop(2, 39.96, -75.15)) == []


def test_a_stop_number_within_15_meters_wins_over_a_closer_stop() -> None:
    lat, lng = 39.96, -75.15
    septa = [septa_point("100", *offset(lat, lng, north=3)), septa_point("101", lat, lng)]
    osm = [osm_stop(1, *offset(lat, lng, east=12), ref="101")]
    assert match_septa(osm, septa) == {1: 0}


def test_a_stop_number_across_the_street_is_not_believed() -> None:
    # Like Frankford Avenue: the number belongs to the stop across the street, 25 meters away,
    # and the stop stands 4 meters from another SEPTA stop.
    lat, lng = 39.96, -75.15
    septa = [septa_point("101", *offset(lat, lng, north=25)), septa_point("100", lat, lng)]
    osm = [osm_stop(1, *offset(lat, lng, east=4), ref="101")]
    assert match_septa(osm, septa) == {1: 0}


def test_a_number_naming_the_stop_across_a_narrow_street_is_not_believed() -> None:
    # Frankford Avenue at Huntingdon Street, as found by the v0.2 review: the stop's number names
    # the southbound stop 12 meters away, across the street, but the point stands 4 meters from
    # another SEPTA stop on its own side. Its answers must not go across the street.
    lat, lng = 39.9876, -75.1271
    septa = [
        septa_point("24149", *offset(lat, lng, east=12)),  # across the street
        septa_point("16350", *offset(lat, lng, north=4)),  # on the point's own corner
    ]
    osm = [osm_stop(1, lat, lng, ref="24149")]
    assert match_septa(osm, septa) == {1: 0}


def test_a_number_still_decides_between_two_stops_almost_as_close() -> None:
    # Main Street at Hermit Street: the numbered stop is 12 meters away and the other 11.3.
    lat, lng = 40.0262, -75.2262
    septa = [
        septa_point("16205", *offset(lat, lng, north=11.3)),
        septa_point("30907", *offset(lat, lng, east=12)),
    ]
    osm = [osm_stop(1, lat, lng, ref="30907")]
    assert match_septa(osm, septa) == {1: 0}


def test_a_stop_whose_nearest_septa_stop_is_taken_does_not_move_farther() -> None:
    # 30th Street: a street stop 6.5 meters from SEPTA's Market Street stop (already paired by its
    # number with another OpenStreetMap stop) used to fall to the next SEPTA stop within 15
    # meters, the trolley platform underground. It now stays unpaired.
    lat, lng = 39.9548, -75.1835
    septa = [
        septa_point("18996", lat, lng),
        septa_point("20643", *offset(lat, lng, north=10.7, east=6.5)),
    ]
    osm = [
        osm_stop(1, *offset(lat, lng, north=1), ref="18996"),
        osm_stop(2, *offset(lat, lng, east=6.5)),  # 6.5 meters from 18996, 10.7 from 20643
    ]
    assert match_septa(osm, septa) == {0: 0}


def test_a_former_stop_number_also_counts() -> None:
    lat, lng = 39.96, -75.15
    septa = [septa_point("300", *offset(lat, lng, north=2)), septa_point("201", lat, lng, "55")]
    osm = [osm_stop(1, *offset(lat, lng, east=8), ref="55")]
    assert match_septa(osm, septa) == {1: 0}


def test_each_stop_pairs_once_closest_first() -> None:
    lat, lng = 39.96, -75.15
    septa = [septa_point("100", lat, lng)]
    osm = [osm_stop(1, *offset(lat, lng, east=6)), osm_stop(2, *offset(lat, lng, north=2))]
    assert match_septa(osm, septa) == {0: 1}


def test_nothing_pairs_beyond_15_meters() -> None:
    lat, lng = 39.96, -75.15
    septa = [septa_point("100", lat, lng)]
    assert match_septa([osm_stop(1, *offset(lat, lng, north=20))], septa) == {}
    assert match_septa([osm_stop(1, *offset(lat, lng, north=20), ref="100")], septa) == {}
    assert match_septa([], septa) == {} and match_septa([osm_stop(1, lat, lng)], []) == {}


# The published files ---------------------------------------------------------------------------


def osm_snapshot(ctx) -> None:
    """Two OpenStreetMap stops: one beside SEPTA's 100 with a shelter, one carrying 101's number
    with a bench and no shelter. 103 is not in OpenStreetMap."""
    lat100, lng100 = STOPS["100"][1:3]
    lat101, lng101 = STOPS["101"][1:3]
    elements = [
        Element(
            "node",
            1,
            {"highway": "bus_stop", "shelter": "yes"},
            shapely.Point(*reversed(offset(lat100, lng100, north=3))),
        ),
        Element(
            "node",
            2,
            {"highway": "bus_stop", "ref": "101", "bench": "yes", "shelter": "no"},
            shapely.Point(*reversed(offset(lat101, lng101, east=8))),
        ),
        Element("node", 3, {"highway": "bus_stop", "shelter": "yes"}, shapely.Point(-75.12, 39.93)),
    ]
    table, _ = elements_table((elements, 0), CITY, date(2026, 10, 3))
    install_snapshot(
        ctx,
        "osm_philadelphia",
        table,
        geometry=True,
        fetched_at="2026-10-05T02:54:19Z",
        geometry_types=["LineString", "Point", "Polygon"],
    )


def districts_snapshot(ctx, shape=CITY) -> None:
    table = pa.table({"district": ["5"], "geometry": [shapely.to_wkb(shape)]})
    install_snapshot(
        ctx, "council_districts", table, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )


@pytest.fixture
def sheets_ctx(context_factory):
    ctx, _, _ = run_septa(context_factory, ordered_bus_files())
    osm_snapshot(ctx)
    districts_snapshot(ctx)
    return ctx


def build(ctx, out: Path):
    statuses = {status.id: status for status in all_statuses(ctx)}
    return build_route_sheets(ctx, statuses, out, date(2026, 10, 5))


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def test_each_route_gets_its_stops_in_order_with_the_openstreetmap_stop_at_each(
    sheets_ctx, tmp_path: Path
) -> None:
    result = build(sheets_ctx, tmp_path)
    assert (result.routes, result.files) == (2, 2)
    sheet = read(tmp_path / "tables/routes/10.json")
    assert {k: sheet[k] for k in ("schema", "id", "r", "nm", "md")} == {
        "schema": 1,
        "id": "10",
        "r": "10",
        "nm": "Broad-Erie to Tioga",
        "md": 1,
    }
    assert sheet["as_of"] == {"schedules": "vtest1", "osm": "2026-10-03"}
    assert sheet["generated_at"] == "2026-10-05T15:00:00Z"
    # SEPTA's data, credited, with the OpenStreetMap ids as links (finding F7, decision D1).
    assert sheet["credit"] == CREDIT
    assert sheet["license"].startswith("SEPTA open data license agreement")
    assert sheet["license"].endswith("https://wwww.septa.org/license-agreement/")
    [north] = sheet["directions"]  # southbound has no trips, so no sheet
    assert {k: north[k] for k in ("d", "dir", "to", "out")} == {
        "d": 0,
        "dir": "Northbound",
        "to": "Broad-Tioga",
        "out": 0,
    }
    assert 1100 <= north["m"] <= 1125  # two gaps of about 556 meters
    first, second, third = north["stops"]
    # Only the link to the OpenStreetMap stop: what it says there is joined on the page from
    # tables/stop_amenities.json (decision D1).
    assert first == {
        "k": "sp100",
        "sid": "100",
        "nm": "Broad St & Erie Av (far side)",
        "lat": 39.96,
        "lng": -75.15,
        "osm": "n1",
    }
    assert {k: second[k] for k in ("sid", "osm")} == {"sid": "101", "osm": "n2"}
    assert set(second) == {"k", "sid", "nm", "lat", "lng", "osm"}
    assert third == {
        "k": "sp103",
        "sid": "103",
        "nm": "Broad St & Tioga St",
        "lat": 39.97,
        "lng": -75.15,
    }
    trolley = read(tmp_path / "tables/routes/T1.json")
    assert trolley["md"] == 2 and [s["sid"] for s in trolley["directions"][0]["stops"]] == ["100"]
    assert not (tmp_path / "tables/routes/L1.json").exists()  # Metro has no survey sheet
    assert not (tmp_path / "tables/routes/AIR.json").exists()
    assert any(
        note.startswith("Route survey sheets: 2 SEPTA bus and trolley routes with 4 stops")
        and "(2 with a shelter or roof, 1 with a bench but no shelter" in note
        for note in result.notes
    )


#: What OpenStreetMap says at a stop, as the shelters and benches layer and the stop table name it:
#: never in a route file (decision D1 of docs/VERIFICATION_V0_2.md).
OSM_ANSWERS = {"c", "sh", "bn", "bi", "lt", "tp", "wc", "db", "cv", "nb", "a", "li", "n"}


def test_the_route_files_carry_no_openstreetmap_answers(sheets_ctx, tmp_path: Path) -> None:
    build(sheets_ctx, tmp_path)
    index = read(tmp_path / INDEX)
    assert all("s" not in route for route in index["routes"])
    for route in index["routes"]:
        sheet = read(tmp_path / route["file"])
        for direction in sheet["directions"]:
            for stop in direction["stops"]:
                assert not OSM_ANSWERS & set(stop), (route["id"], stop)


def test_the_index_lists_every_route_file_with_its_directions(sheets_ctx, tmp_path: Path) -> None:
    build(sheets_ctx, tmp_path)
    index = read(tmp_path / INDEX)
    assert index["schema"] == 1 and index["as_of"]["schedules"] == "vtest1"
    by_id = {route["id"]: route for route in index["routes"]}
    assert by_id["10"] == {
        "id": "10",
        "r": "10",
        "nm": "Broad-Erie to Tioga",
        "md": 1,
        "file": "tables/routes/10.json",
        "dirs": [{"d": 0, "dir": "Northbound", "to": "Broad-Tioga", "n": 3}],
    }
    assert index["credit"] == CREDIT and "SEPTA" in index["license"]
    # SEPTA's own order of routes: T1 sorts before 10.
    assert [route["id"] for route in index["routes"]] == ["T1", "10"]
    for route in index["routes"]:
        assert (tmp_path / route["file"]).is_file()


def test_stops_outside_the_city_are_left_out_and_counted(context_factory, tmp_path) -> None:
    ctx, _, _ = run_septa(context_factory, ordered_bus_files())
    # Only Erie Avenue (39.960) lies inside this city: 101 and 103 are outside.
    districts_snapshot(ctx, box(-75.2, 39.955, -75.1, 39.962))
    build(ctx, tmp_path)
    [north] = read(tmp_path / "tables/routes/10.json")["directions"]
    assert [s["sid"] for s in north["stops"]] == ["100"]
    assert north["out"] == 2 and north["m"] == 0
    assert "osm" not in north["stops"][0]  # no OpenStreetMap snapshot in this cache


def test_the_stop_table_holds_what_openstreetmap_says_keyed_by_its_id(
    sheets_ctx, tmp_path: Path
) -> None:
    # The one place the route pages (and the map) read OpenStreetMap's answers from, joined in
    # the browser by the id the route files carry (decision D1).
    statuses = {status.id: status for status in all_statuses(sheets_ctx)}
    result = build_stop_table(sheets_ctx, statuses, tmp_path)
    table = read(tmp_path / STOP_TABLE)
    assert table["schema"] == 1 and table["as_of"] == {"osm": "2026-10-03"}
    assert table["credit"] == "© OpenStreetMap contributors"
    assert table["license"].startswith("Open Database License 1.0")
    assert table["stops"]["n1"] == {"c": SHELTER, "sh": 1}
    assert table["stops"]["n2"] == {"c": BENCH, "sh": 0, "bn": 1, "n": ["101"]}
    assert result.stops == len(table["stops"]) >= 2
    assert result.notes[0].startswith(f"Stop answers table: {result.stops} OpenStreetMap stops")


def test_without_openstreetmap_there_is_no_stop_table(context_factory, tmp_path) -> None:
    result = build_stop_table(context_factory(now=NOW), {}, tmp_path)
    assert not (tmp_path / STOP_TABLE).exists()
    assert result.notes == [
        "Stop answers table: OpenStreetMap's stops are missing, so there is none and every stop "
        "shows as not yet surveyed"
    ]


def test_without_a_stop_order_there_are_no_sheets(context_factory, tmp_path) -> None:
    ctx, _, _ = run_septa(context_factory, bus_files())
    result = build(ctx, tmp_path)
    assert result.routes == 0 and not (tmp_path / "tables").exists()
    assert result.notes == [
        "Route survey sheets: SEPTA's schedules have no stop order (route_stops.txt), so there "
        "are none"
    ]


def test_without_septa_there_are_no_sheets(context_factory, tmp_path) -> None:
    result = build(context_factory(now=NOW), tmp_path)
    assert result.routes == 0 and result.notes == [
        "Route survey sheets: SEPTA's schedules are missing"
    ]


def test_route_ids_that_cannot_be_file_names_are_refused() -> None:
    assert route_file("47") == "tables/routes/47.json"
    assert route_file("T1") == "tables/routes/T1.json"
    assert route_file("../47") is None and route_file("a/b") is None and route_file("") is None


def test_distance_along_adds_up_straight_lines() -> None:
    assert meters_along([]) == 0 and meters_along([(39.96, -75.15)]) == 0
    there = offset(39.96, -75.15, north=300)
    back = offset(*there, east=400)
    assert 695 <= meters_along([(39.96, -75.15), there, back]) <= 705


def test_the_transit_tiles_credit_septa_and_link_to_openstreetmap_without_crediting_it(
    sheets_ctx, tmp_path: Path, monkeypatch
) -> None:
    # SEPTA's stops read OpenStreetMap only to link each stop to its OpenStreetMap stop by id, so
    # the transit file's credit line names SEPTA and not OpenStreetMap, whose answers are in the
    # shelters and benches tiles and the stop table (decision D1).
    import placekeepers.publish as publishing

    credits: dict[str, str] = {}

    def fake_tippecanoe(exe, target, file, layers, attribution) -> None:
        credits[file] = attribution
        target.write_bytes(b"pmtiles")

    monkeypatch.setattr(publishing, "find_tippecanoe", lambda: "tippecanoe")
    monkeypatch.setattr(publishing, "run_tippecanoe", fake_tippecanoe)
    monkeypatch.setattr(
        publishing, "pmtiles_layer_names", lambda path: ["stops", "routes", "parcels", "h3"]
    )
    publish(sheets_ctx, tmp_path / "data")
    assert "SEPTA" in credits["tiles/transit.pmtiles"]
    assert "OpenStreetMap" not in credits["tiles/transit.pmtiles"]
    assert "OpenStreetMap" in credits["tiles/amenities.pmtiles"]


def test_the_manifest_lists_the_index_but_not_each_route(sheets_ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    result = publish(sheets_ctx, out)
    assert result.route_sheets is not None and result.route_sheets.routes == 2
    files = result.manifest["files"]
    assert INDEX in files and STOP_TABLE in files
    assert not any(re.match(r"^tables/routes/(?!index)", name) for name in files)
    assert (out / "tables/routes/10.json").is_file() and (out / "tables/routes/T1.json").is_file()
    assert ROUTE_SHEET.match("tables/routes/47.json") and not ROUTE_SHEET.match(INDEX)
    assert set(file_index(out)) == set(files)
