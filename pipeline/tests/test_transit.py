"""SEPTA transit data (M2.1): typical days, service measures per stop and route, stable stop keys
across renumbering, the ridership adapters and the transit tile layers. Every test runs on the
tiny made up feed in tests/transit_fixtures.py; nothing touches the network."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box, mapping

from placekeepers.adapters.septa import layer_rank, newest_layer, unpack_feeds
from placekeepers.derive.transit import (
    Calendar,
    KeyedStop,
    Place,
    StopCount,
    assign_keys,
    link_places,
    match_counts,
    name_key,
    name_similarity,
    split_side,
    sum_counts,
    summarize_feed,
    typical_days,
)
from placekeepers.publish.transit import (
    build_transit_routes,
    build_transit_stops,
    display_name,
    headway,
)
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeArcgis, install_snapshot
from .transit_fixtures import RIDERSHIP_FIELDS, bus_files, rail_files, septa_zip, write_feed

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
WEEK_LATER = datetime(2026, 10, 11, 15, 0, tzinfo=UTC)
MODIFIED = {"Last-Modified": "Fri, 25 Sep 2026 17:14:15 GMT"}


def relaxed(source):
    return source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})


def zip_server(body: bytes):
    return lambda request: httpx.Response(200, content=body, headers=MODIFIED)


def run_gtfs(context_factory, body: bytes, now: datetime, cache: Path | None = None):
    ctx = context_factory(handler=zip_server(body), now=now)
    source = relaxed(ctx.registry.sources["septa_gtfs"])
    fetched = fetch_source(ctx, source)
    assert fetched.outcome == "downloaded", fetched.detail
    checked = validate_source(ctx, source)
    assert checked.outcome == "ok", checked.detail
    store = SnapshotStore(ctx.cache, "septa_gtfs")
    return ctx, store, pq.read_table(store.path_for(store.current())).to_pylist()


def by_stop(rows: list[dict]) -> dict[str, dict]:
    return {row["stop_id"]: row for row in rows if row["kind"] == "stop"}


# Typical days


def test_the_typical_weekday_skips_holidays_and_one_off_events() -> None:
    files = bus_files()
    rows = lambda name: list(  # noqa: E731
        __import__("csv").DictReader(files[name].splitlines())
    )
    calendar = Calendar.from_rows(rows("calendar.txt"), rows("calendar_dates.txt"))
    assert calendar.services_on(date(2026, 10, 12)) == {"HOL"}
    assert calendar.services_on(date(2026, 10, 13)) == {"WK", "EVT"}
    days = typical_days(calendar, date(2026, 10, 4), (date(2026, 10, 4), date(2026, 12, 31)))
    assert days.dates == {
        "weekday": date(2026, 10, 5),
        "saturday": date(2026, 10, 10),
        "sunday": date(2026, 10, 4),
    }
    assert days.services["weekday"] == {"WK"}
    # A week later the window starts on the holiday weekend; the typical weekday is still WK.
    later = typical_days(calendar, date(2026, 10, 11), (date(2026, 10, 4), date(2026, 12, 31)))
    assert later.dates["weekday"] == date(2026, 10, 14)


def test_an_expired_schedule_uses_its_last_four_weeks_and_says_so() -> None:
    calendar = Calendar.from_rows(
        [
            {
                "service_id": "WK",
                **dict.fromkeys(("monday", "tuesday", "wednesday", "thursday", "friday"), "1"),
                "saturday": "0",
                "sunday": "0",
                "start_date": "20260601",
                "end_date": "20260630",
            }
        ],
        [],
    )
    days = typical_days(calendar, date(2026, 10, 4), (date(2026, 6, 1), date(2026, 6, 30)))
    assert days.dates["weekday"].month == 6
    assert days.services["saturday"] == frozenset()  # looked at, and nothing runs
    assert any("do not include 2026-10-04" in note for note in days.notes)


# Service measures


@pytest.fixture
def summaries(tmp_path: Path):
    write_feed(tmp_path / "bus", bus_files())
    write_feed(tmp_path / "rail", rail_files())
    con = duckdb.connect()
    bus = summarize_feed(con, tmp_path / "bus", feed="bus_metro", start=date(2026, 10, 4))
    rail = summarize_feed(con, tmp_path / "rail", feed="rail", start=date(2026, 10, 4))
    con.close()
    return bus, rail


def test_departures_leave_out_trip_ends_and_stops_where_nobody_may_board(summaries) -> None:
    bus, _ = summaries
    stops = {stop.stop_id: stop for stop in bus.stops}
    assert "900" not in stops  # a station, not a boarding place
    assert stops["100"].days["wk"] == {
        "trips": 10,
        "first": 410,
        "last": 1530,
        "peak": 4,
        "midday": 3,
        "evening": 2,
        "night": 1,
        "busiest": 3,
    }
    # The 07:10 trip may not pick up at 101, so it is one departure short there.
    assert stops["101"].days["wk"]["trips"] == 8
    assert stops["101"].days["wk"]["peak"] == 3
    assert stops["101"].days["wk"]["busiest"] == 2
    # Trips end at 103, so nobody departs from it; 104 has no service at all.
    assert stops["103"].days["wk"]["trips"] == 0
    assert stops["104"].days == {s: {"trips": 0, "busiest": 0} for s in ("wk", "sa", "su")}
    # Saturdays and Sundays have their own service.
    assert stops["100"].days["sa"]["trips"] == 2 and stops["100"].days["sa"]["midday"] == 1
    assert stops["100"].days["su"]["trips"] == 1


def test_night_service_counts_hours_not_buses(tmp_path: Path) -> None:
    """One late bus at 1:30 is one night hour; buses at 1:30, 2:10 and 3:05 are all three,
    which is what the map calls service through the night."""
    files = bus_files()
    files["trips.txt"] += "10,WK,owl2,To 103,0,S10\n10,WK,owl3,To 103,0,S10\n"
    files["stop_times.txt"] += (
        "owl2,26:10:00,26:10:00,100,1,0,0\nowl2,26:20:00,26:20:00,103,2,0,0\n"
        "owl3,27:05:00,27:05:00,100,1,0,0\nowl3,27:15:00,27:15:00,103,2,0,0\n"
    )
    write_feed(tmp_path / "bus", files)
    con = duckdb.connect()
    bus = summarize_feed(con, tmp_path / "bus", feed="bus_metro", start=date(2026, 10, 4))
    con.close()
    stops = {stop.stop_id: stop for stop in bus.stops}
    assert stops["100"].days["wk"]["night"] == 3
    assert stops["101"].days["wk"]["night"] == 1  # the owl trips skip 101


def test_stops_know_their_routes_in_septas_order_and_their_modes(summaries) -> None:
    bus, rail = summaries
    stops = {stop.stop_id: stop for stop in [*bus.stops, *rail.stops]}
    assert stops["100"].routes == ["T1", "10"]
    assert stops["100"].modes == 1 | 2  # bus and trolley
    assert stops["102"].modes == 4  # the El
    assert stops["108"].modes == 1  # a trackless trolley stops at the curb like a bus
    assert stops["90004"].modes == 8 and stops["90004"].days["wk"]["trips"] == 2
    assert stops["90004"].feed == "rail"


def test_routes_have_trips_frequencies_and_lines(summaries) -> None:
    bus, rail = summaries
    routes = {route.route_id: route for route in [*bus.routes, *rail.routes]}
    assert [r.route_id for r in bus.routes] == ["L1", "T1", "10", "59"]
    assert routes["10"].days["wk"] == {"trips": 9, "peak": 4, "midday": 2}
    assert routes["L1"].days["wk"]["midday"] == 4
    assert routes["10"].geometry.geom_type == "MultiLineString"
    assert routes["L1"].geometry is None  # no shapes for it in the feed
    assert routes["AIR"].modes == 8


def test_the_zip_holds_two_feeds(tmp_path: Path) -> None:
    path = tmp_path / "data.zip"
    path.write_bytes(septa_zip())
    feeds = unpack_feeds(path, tmp_path / "out")
    assert [name for name, _ in feeds] == ["bus_metro", "rail"]
    assert (tmp_path / "out" / "bus_metro" / "stop_times.txt").is_file()
    assert not (tmp_path / "out" / "bus_metro" / "agency.txt").exists()  # never needed


# Names and links


@pytest.mark.parametrize(
    ("a", "b", "alike"),
    [
        ("Cecil B Moore Av & 13th St", "Cecil B. Moore Ave & 13th St - FS", True),
        ("Broad St & Erie Av", "Erie Av & Broad St - MBNS", True),
        ("Rhawn St & Rowland St", "Rhawn St & Rowland Av", True),
        ("Broad St & Erie Av", "Broad St & Venango St", False),
        ("Broad St & Olney Av", "Olney Transit Center", False),
    ],
)
def test_stop_names_compare_after_evening_out(a: str, b: str, alike: bool) -> None:
    assert (name_similarity(a, b) >= 0.75) is alike


def test_name_keys_and_sides() -> None:
    assert name_key("Erie Av & Broad St - FS") == name_key("Broad Street & Erie Avenue")
    assert split_side("Roosevelt Blvd & Broad St - FS") == ("Roosevelt Blvd & Broad St", "FS")
    assert split_side("15th St/City Hall - B1") == ("15th St/City Hall - B1", None)
    assert display_name("Broad St & Erie Av - MBFS") == "Broad St & Erie Av (midblock, far side)"
    assert display_name("15th St/City Hall - B1") == "15th St/City Hall, B1"


def test_links_need_nearness_and_a_similar_name_and_take_the_closest() -> None:
    old = [Place("1", "Broad St & Erie Av", 39.96, -75.15)]
    near = Place("2", "Erie Av & Broad St - FS", 39.96018, -75.15)  # about 20 m
    nearer = Place("3", "Broad St & Erie Av", 39.96009, -75.15)  # about 10 m
    far = Place("4", "Broad St & Erie Av", 39.9604, -75.15)  # about 45 m
    other = Place("5", "Broad St & Venango St", 39.96005, -75.15)
    assert [link.new for link in link_places(old, [near, nearer])] == [1]
    assert link_places(old, [far]) == []
    assert link_places(old, [other]) == []


# Stable keys


def keyed(stop_id: str, name: str, lat: float, lng: float, key: str | None = None, **extra):
    return KeyedStop(
        key or f"sp{stop_id}", stop_id, name, lat, lng, "bus_metro", date(2026, 9, 1), **extra
    )


def test_keys_start_from_the_septa_id_and_stay() -> None:
    today = date(2026, 10, 4)
    first = assign_keys(
        [], [Place("100", "A St & B St", 39.96, -75.15)], feed="bus_metro", today=today
    )
    assert first.current[0].key == "sp100" and first.current[0].since == today
    again = assign_keys(
        first.current,
        [Place("100", "A St & B St", 39.96, -75.15)],
        feed="bus_metro",
        today=date(2026, 10, 11),
    )
    assert again.current[0].key == "sp100" and again.current[0].since == today
    rail = assign_keys(
        [], [Place("90004", "Gray 30th St Station", 39.95, -75.18)], feed="rail", today=today
    )
    assert rail.current[0].key == "sr90004"


def test_a_renumbered_stop_keeps_its_key_and_remembers_its_old_id() -> None:
    today = date(2026, 10, 11)
    previous = [keyed("101", "Broad St & Venango St", 39.965, -75.15)]
    result = assign_keys(
        previous,
        [Place("201", "Venango St & Broad St - FS", 39.965108, -75.15)],
        feed="bus_metro",
        today=today,
    )
    stop = result.current[0]
    assert stop.key == "sp101" and stop.stop_id == "201"
    assert stop.former_ids == ["101"]
    assert stop.history[0]["until"] == today and 10 < stop.history[0]["meters"] < 14
    assert result.retired == [] and len(result.links) == 1


def test_a_stop_gone_without_successor_is_retired_and_its_key_is_kept_for_it() -> None:
    previous = [keyed("108", "Erie Av & 5th St", 39.96, -75.16)]
    gone = assign_keys(previous, [], feed="bus_metro", today=date(2026, 10, 11))
    assert [(s.key, s.retired_on) for s in gone.retired] == [("sp108", date(2026, 10, 11))]
    back = assign_keys(
        gone.retired,
        [Place("108", "Erie Av & 5th St", 39.96, -75.16)],
        feed="bus_metro",
        today=date(2026, 11, 1),
    )
    assert back.current[0].key == "sp108" and back.retired == []
    forgotten = assign_keys(gone.retired, [], feed="bus_metro", today=date(2027, 10, 12))
    assert forgotten.retired == []


def test_a_key_is_never_given_twice() -> None:
    # 201 took over 101's key; when 101 comes back it needs a key of its own.
    previous = [keyed("201", "Broad St & Venango St", 39.965, -75.15, key="sp101")]
    result = assign_keys(
        previous,
        [
            Place("201", "Broad St & Venango St", 39.965, -75.15),
            Place("101", "Somewhere Else", 39.99, -75.1),
        ],
        feed="bus_metro",
        today=date(2026, 12, 1),
    )
    assert [s.key for s in result.current] == ["sp101", "sp101_2"]


# The GTFS adapter, end to end


def test_the_gtfs_snapshot_keeps_stops_routes_and_typical_days(context_factory) -> None:
    _, store, rows = run_gtfs(context_factory, septa_zip(), NOW)
    meta = store.current()
    assert meta.newest_record == "2026-09-25"  # the file's Last-Modified day
    stops = by_stop(rows)
    assert set(stops) == {
        "100",
        "101",
        "102",
        "103",
        "104",
        "105",
        "107",
        "108",
        "109",
        "90004",
        "90401",
    }
    assert stops["100"]["key"] == "sp100" and stops["90004"]["key"] == "sr90004"
    assert stops["100"]["routes"] == "T1,10"
    assert (stops["100"]["trips_wk"], stops["100"]["midday_wk"], stops["100"]["night_wk"]) == (
        10,
        3,
        1,
    )
    assert stops["100"]["weekday_date"] == date(2026, 10, 5)
    assert stops["90004"]["weekday_date"] == date(2026, 10, 5)
    routes = [row for row in rows if row["kind"] == "route"]
    assert sorted(row["route_id"] for row in routes) == ["10", "59", "AIR", "L1", "T1"]
    assert all(row["feed_version"] == "vtest1" for row in rows)
    assert meta.format == "geoparquet"


def test_keys_carry_over_from_the_last_snapshot(context_factory, tmp_path) -> None:
    ctx, _, _ = run_gtfs(context_factory, septa_zip(), NOW)
    ctx = context_factory(handler=zip_server(septa_zip(renumbered=True)), now=WEEK_LATER)
    source = relaxed(ctx.registry.sources["septa_gtfs"])
    assert fetch_source(ctx, source, force=True).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, "septa_gtfs")
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    stops = by_stop(rows)
    assert stops["201"]["key"] == "sp101" and stops["201"]["former_ids"] == ["101"]
    assert stops["201"]["key_since"] == date(2026, 10, 4)
    assert stops["300"]["key"] == "sp300"
    retired = [row for row in rows if row["kind"] == "retired"]
    assert [(r["stop_id"], r["key"], r["retired_on"]) for r in retired] == [
        ("108", "sp108", date(2026, 10, 11))
    ]
    assert stops["100"]["weekday_date"] == date(2026, 10, 14)


def test_a_broken_zip_is_rejected_and_the_last_good_copy_stays(context_factory) -> None:
    run_gtfs(context_factory, septa_zip(), NOW)
    ctx = context_factory(handler=zip_server(b"not a zip"), now=WEEK_LATER)
    source = relaxed(ctx.registry.sources["septa_gtfs"])
    assert fetch_source(ctx, source, force=True).outcome == "downloaded"
    result = validate_source(ctx, source)
    assert result.outcome == "error" and "not a zip" in result.detail
    assert SnapshotStore(ctx.cache, "septa_gtfs").current().snapshot_id.startswith("20261004")


# Ridership


def test_the_newest_spring_or_fall_count_is_chosen() -> None:
    names = [
        "Fall_2025_Stop_Summary_(Bus)",
        "Spring_2026_Stop_Summary_Bus",
        "Summer_2026_Stop_Summary_(Bus)",
        "Spring_2026_Stop_Summary_Trolley",
        "Fall_2022_Stop_Summary_(Bus)_v2",
        "Bus_Ridership_by_County",
    ]
    assert layer_rank("Summer_2026_Stop_Summary_(Bus)", "Bus") is None
    assert layer_rank("Fall_2022_Stop_Summary_(Bus)_v2", "Bus") == (2022, 3, 2)
    assert (
        newest_layer(names, "Bus", "Fall_2025_Stop_Summary_(Bus)") == "Spring_2026_Stop_Summary_Bus"
    )
    assert (
        newest_layer(names, "Trolley", "Fall_2025_Stop_Summary_(Trolley)")
        == "Spring_2026_Stop_Summary_Trolley"
    )
    later = [*names, "Fall_2026_Stop_Summary_(Bus)"]
    assert (
        newest_layer(later, "Bus", "Spring_2026_Stop_Summary_Bus") == "Fall_2026_Stop_Summary_(Bus)"
    )
    # Never older than the registry's layer, even when the folder lists only older ones.
    assert (
        newest_layer(["Fall_2025_Stop_Summary_(Bus)"], "Bus", "Spring_2026_Stop_Summary_Bus")
        == "Spring_2026_Stop_Summary_Bus"
    )


RIDERSHIP_ROWS = [
    # stop code, route, stop name, lat, lon, weekday, saturday, sunday ons
    (100, "10", "Broad St & Erie Av - FS", 39.96, -75.15, 50, 20, 10),
    (100, "T1", "Broad St & Erie Av - FS", 39.96, -75.15, 5, 1, 0),
    (101, "10", "Broad St & Venango St", 39.965, -75.15, 30, 12, 6),
    (108, "59", "Erie Av & 5th St", 39.96, -75.16, 7, 0, 0),
    (555, "59", "Erie Av & 5th St", 39.96005, -75.16, 9, 0, 0),
    (777, "59", "Hunting Park Av & Broad St - NS", 39.98018, -75.15, 41, 3, 2),
]


class FakeSeptaFolder(FakeArcgis):
    """SEPTA's ArcGIS folder: a list of layers at the root, and one stop summary layer."""

    def __init__(self, names: list[str], **kwargs):
        super().__init__(**kwargs)
        self.names = names

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/rest/services"):
            self.requests.append(request)
            return httpx.Response(
                200, json={"services": [{"name": n, "type": "FeatureServer"} for n in self.names]}
            )
        return super().__call__(request)


def ridership_layer(names: list[str]) -> FakeSeptaFolder:
    features = [
        {
            "type": "Feature",
            "properties": {
                "FID": n,
                "Mode": "Bus",
                "Route": route,
                "Direction": "Northbound",
                "Stop_Code": code,
                "Stop": name,
                "Lat": lat,
                "Lon": lon,
                "Sign_Up": "Spring 2026",
                "WK_Ons": wk,
                "WK_Offs": 1,
                "Sat_Ons": sat,
                "Sat_Offs": 1,
                "Sun_Ons": sun,
                "Sun_Offs": 1,
            },
            "geometry": mapping(Point(lon, lat)),
        }
        for n, (code, route, name, lat, lon, wk, sat, sun) in enumerate(RIDERSHIP_ROWS, start=1)
    ]
    fields = [{"name": name, "type": f"esriFieldType{kind}"} for name, kind in RIDERSHIP_FIELDS]
    return FakeSeptaFolder(
        names, fields=fields, features=features, max_records=4, geometry_type="esriGeometryPoint"
    )


def test_the_ridership_adapter_follows_septas_newest_count(context_factory) -> None:
    fake = ridership_layer(
        [
            "Spring_2026_Stop_Summary_Bus",
            "Fall_2026_Stop_Summary_(Bus)",
            "Summer_2027_Stop_Summary_(Bus)",
        ]
    )
    ctx = context_factory(handler=fake, now=NOW)
    source = relaxed(ctx.registry.sources["septa_ridership_bus"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, "septa_ridership_bus")
    table = pq.read_table(store.path_for(store.current()))
    assert set(table.column("layer").to_pylist()) == {"Fall_2026_Stop_Summary_(Bus)"}
    assert table.column("stop_code").to_pylist()[:2] == ["100", "100"]
    assert set(table.column("source_date").to_pylist()) == {date(2026, 9, 27)}
    pages = [r.url.path for r in fake.requests if r.url.path.endswith("/query")]
    assert all("/Fall_2026_Stop_Summary_(Bus)/FeatureServer/0/" in p for p in pages)


def test_without_the_folder_list_the_registry_layer_is_used(context_factory) -> None:
    fake = ridership_layer([])
    plain = FakeArcgis(
        fields=fake.fields, features=fake.features, max_records=4, geometry_type="esriGeometryPoint"
    )
    ctx = context_factory(handler=plain, now=NOW)
    source = relaxed(ctx.registry.sources["septa_ridership_trolley"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, "septa_ridership_trolley")
    layers = pq.read_table(store.path_for(store.current())).column("layer").to_pylist()
    assert set(layers) == {"Spring_2026_Stop_Summary_Trolley"}


def test_counts_go_to_their_own_stop_then_a_former_id_then_a_nearby_retired_stop() -> None:
    counts = sum_counts(
        [
            {
                "stop_code": str(code),
                "stop": name,
                "lat": lat,
                "lon": lon,
                "wk_ons": wk,
                "sat_ons": sat,
                "sun_ons": sun,
                "sign_up": "Spring 2026",
            }
            for code, _, name, lat, lon, wk, sat, sun in RIDERSHIP_ROWS
        ]
    )
    assert counts["100"].weekday == 55 and counts["100"].saturday == 21
    stops = [
        ("100", [], Place("100", "Broad St & Erie Av - FS", 39.96, -75.15)),
        ("201", ["101"], Place("201", "Venango St & Broad St - FS", 39.965108, -75.15)),
        ("300", [], Place("300", "Hunting Park Av & Broad St", 39.98, -75.15)),
        ("400", [], Place("400", "Nowhere Near", 39.99, -75.1)),
    ]
    found = match_counts(stops, counts, known_ids={"100", "201", "300", "400", "108"})
    assert {i: (m.code, m.how) for i, m in found.items()} == {
        0: ("100", "id"),
        1: ("101", "former"),
        2: ("777", "nearby"),
    }


def test_a_count_is_never_split_between_two_stops() -> None:
    counts = {"9": StopCount("9", "A St & B St", 39.96, -75.15, weekday=10)}
    stops = [
        ("1", [], Place("1", "A St & B St", 39.96005, -75.15)),
        ("2", [], Place("2", "B St & A St", 39.96010, -75.15)),
    ]
    assert {i: m.code for i, m in match_counts(stops, counts, {"1", "2"}).items()} == {0: "9"}


# The transit tile layers


def ridership_table() -> pa.Table:
    rows = [
        {
            "stop_code": str(code),
            "route": route,
            "stop": name,
            "lat": lat,
            "lon": lon,
            "wk_ons": wk,
            "sat_ons": sat,
            "sun_ons": sun,
            "sign_up": "Spring 2026",
            "layer": "Spring_2026_Stop_Summary_Bus",
            "source_date": date(2026, 8, 20),
            "geometry": shapely.to_wkb(Point(lon, lat)),
        }
        for code, route, name, lat, lon, wk, sat, sun in RIDERSHIP_ROWS
    ]
    return pa.Table.from_pylist(rows)


def publish_paths(ctx) -> dict[str, Path]:
    install_snapshot(
        ctx,
        "septa_ridership_bus",
        ridership_table(),
        geometry=True,
        fetched_at="2026-10-04T14:00:00Z",
        geometry_types=["Point"],
    )
    district = pa.table(
        {"district": ["5"], "geometry": [shapely.to_wkb(box(-75.2, 39.9, -75.1, 40.0))]}
    )
    install_snapshot(
        ctx, "council_districts", district, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )
    paths = {}
    for source in ("septa_gtfs", "septa_ridership_bus", "council_districts"):
        store = SnapshotStore(ctx.cache, source)
        paths[source] = store.path_for(store.current())
    return paths


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text())["features"]


def test_stops_carry_the_contract_properties(context_factory, tmp_path) -> None:
    ctx, _, _ = run_gtfs(context_factory, septa_zip(), NOW)
    out = tmp_path / "transit.stops.geojson"
    result = build_transit_stops(ctx, publish_paths(ctx), out, date(2026, 10, 4))
    stops = {f["properties"]["sid"]: f["properties"] for f in features(out)}
    # Only places people can board: trip ends (103, 105, 107, 109, 90401) and unused stops go.
    assert set(stops) == {"100", "101", "102", "108", "90004"}
    assert stops["90004"]["md"] == 8 and stops["90004"]["id"] == "sr90004"
    assert stops["100"] == {
        "id": "sp100",
        "sid": "100",
        "nm": "Broad St & Erie Av (far side)",
        "md": 3,
        "r": "T1,10",
        "tw": 10,
        "ts": 2,
        "tu": 1,
        "bh": 3,
        "hp": 30,
        "hm": 80,
        "hs": 240,
        "hu": 240,
        "ft": 410,
        "lt": 1530,
        "ev": 2,
        "nt": 1,
        "wc": 1,
        "b": 55,
        "bp": "Spring 2026",
        # The transit comfort lens (M2.3, tests/test_transit_comfort.py): SEPTA's and the City's
        # factors, and the mark of a stop the lens scores. The shelter and bench, and the
        # suggestions they decide, are joined in the browser (decision D1), never stored here.
        "f_riders": 67,
        "f_wait": 0,
        "tc": 1,
    }
    assert (
        "b" not in stops["102"] and stops["102"]["wc"] == 2
    )  # no subway counts; no step free way in
    assert "hp" not in stops["108"] and stops["108"]["b"] == 7
    assert any("3 of 3 bus and trolley stops (100.0%)" in note for note in result.notes)


def test_a_renumbered_stop_keeps_its_count_and_shows_its_old_id(context_factory, tmp_path) -> None:
    run_gtfs(context_factory, septa_zip(), NOW)
    ctx = context_factory(handler=zip_server(septa_zip(renumbered=True)), now=WEEK_LATER)
    source = relaxed(ctx.registry.sources["septa_gtfs"])
    fetch_source(ctx, source, force=True)
    validate_source(ctx, source)
    out = tmp_path / "transit.stops.geojson"
    result = build_transit_stops(ctx, publish_paths(ctx), out, date(2026, 10, 11))
    stops = {f["properties"]["sid"]: f["properties"] for f in features(out)}
    assert stops["201"]["id"] == "sp101" and stops["201"]["fid"] == "101"
    assert (stops["201"]["b"], stops["201"]["bx"]) == (30, "101")
    assert (stops["300"]["b"], stops["300"]["bx"]) == (41, "777")
    note = next(n for n in result.notes if "boarding count" in n)
    assert "1 under a number they had before, 1 from a retired stop" in note


def test_routes_are_lines_with_their_frequency(context_factory, tmp_path) -> None:
    ctx, _, _ = run_gtfs(context_factory, septa_zip(), NOW)
    out = tmp_path / "transit.routes.geojson"
    result = build_transit_routes(ctx, publish_paths(ctx), out, date(2026, 10, 4))
    routes = {f["properties"]["r"]: f for f in features(out)}
    # Only routes with lines in the feed that stop in the city.
    assert set(routes) == {"10", "T1"}
    assert routes["10"]["properties"] == {
        "id": "10",
        "r": "10",
        "nm": "Broad-Erie to Tioga",
        "md": 1,
        "tw": 9,
        "hp": 30,
        "hm": 120,
    }
    assert routes["10"]["geometry"]["type"] in ("LineString", "MultiLineString")
    assert result.features == 2


def test_headways_round_to_whole_minutes() -> None:
    assert headway(None, 240) is None and headway(0, 240) is None
    assert headway(3, 240) == 80 and headway(500, 120) == 1
