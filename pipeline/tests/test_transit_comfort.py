"""The transit comfort lens and the stop suggestions (M2.3): finding SEPTA's stops in
OpenStreetMap, carrying over what riders find there, the lens factors (with "not yet surveyed"
counting halfway, never as missing), and the suggestions each stop gets. Everything runs on small
made up data; nothing touches the network."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import h3
import pyarrow as pa
import pytest
import shapely
from pyproj import Transformer
from shapely.geometry import LineString, box

from placekeepers.adapters.osm import Element, elements_table
from placekeepers.derive.bus_stops import SeptaPoint, Stop, answer, match_septa
from placekeepers.derive.transit_comfort import (
    BY_NUMBER,
    BY_PLACE,
    NOT_SURVEYED,
    SeptaStop,
    comfort_for_stops,
    match_osm,
    stop_suggestions,
    yes_no_need,
)
from placekeepers.publish.transit import build_transit_stops
from placekeepers.snapshots import SnapshotStore

from .conftest import install_snapshot
from .test_transit import publish_paths, run_gtfs
from .transit_fixtures import septa_zip

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
_TO_M = Transformer.from_crs("EPSG:4326", "EPSG:32618", always_xy=True)
_TO_DEG = Transformer.from_crs("EPSG:32618", "EPSG:4326", always_xy=True)


def moved(lat: float, lng: float, east: float = 0.0, north: float = 0.0) -> tuple[float, float]:
    """A point `east` and `north` meters away, as (lat, lng)."""
    x, y = _TO_M.transform(lng, lat)
    lng2, lat2 = _TO_DEG.transform(x + east, y + north)
    return lat2, lng2


def osm_stop(osm_id: int, lat: float, lng: float, in_city: bool = True, **tags: str) -> Stop:
    tags = {"highway": "bus_stop", **tags}
    keys = ("shelter", "bench", "bin", "lit", "tactile_paving", "wheelchair", "departures_board")
    return Stop(
        id=f"n{osm_id}",
        lat=lat,
        lng=lng,
        in_city=in_city,
        tags=tags,
        answers={key: answer(tags, key) for key in (*keys, "covered")},
    )


SEPTA = [
    SeptaStop("100", (), 39.96, -75.15),
    SeptaStop("200", (), *moved(39.96, -75.15, east=20)),
    SeptaStop("300", ("299",), 39.96, -75.16),
    SeptaStop("400", (), 39.96, -75.17),
    SeptaStop("401", (), *moved(39.96, -75.17, east=9)),
]


# Finding SEPTA's stops in OpenStreetMap


def found(matches) -> dict[str, tuple[int, str]]:
    return {SEPTA[i].sid: (m.how, m.stop.id) for i, m in matches.items()}


def test_the_map_pairs_stops_as_the_route_survey_sheets_do() -> None:
    stops = [
        osm_stop(1, 39.96, -75.15, ref="200"),
        osm_stop(2, *moved(39.96, -75.16, north=12), ref="299"),
        osm_stop(3, *moved(39.96, -75.17, east=4, north=3)),
        osm_stop(4, *moved(39.96, -75.16, north=45)),
    ]
    matches, _ = match_osm(SEPTA, stops)
    sheets = match_septa(stops, [SeptaPoint(s.sid, s.former, s.lat, s.lng) for s in SEPTA])
    assert {i: m.stop.id for i, m in matches.items()} == {s: stops[o].id for s, o in sheets.items()}


def test_a_number_counts_only_for_a_stop_within_15_meters() -> None:
    # The OpenStreetMap stop stands right on SEPTA's stop 100 but names 200, 20 meters away across
    # the corner, as a run of stops on Frankford Avenue does: the place wins, the number is noted.
    matches, summary = match_osm(SEPTA, [osm_stop(1, 39.96, -75.15, ref="200")])
    assert found(matches) == {"100": (BY_PLACE, "n1")}
    assert summary.by_number == 0 and summary.by_place == 1 and summary.numbers_elsewhere == 1


def test_a_number_today_or_from_the_stops_history_says_the_numbers_agree() -> None:
    near = osm_stop(1, *moved(39.96, -75.16, north=12), ref="299")  # 299 is in 300's history
    matches, summary = match_osm(SEPTA, [near])
    assert found(matches) == {"300": (BY_NUMBER, "n1")}
    assert matches[2].meters == pytest.approx(12, abs=0.2)
    assert summary.by_number == 1 and summary.numbers_elsewhere == 0


def test_by_place_within_15_meters_closest_first_each_stop_once() -> None:
    first = osm_stop(1, *moved(39.96, -75.16, north=3))
    second = osm_stop(2, *moved(39.96, -75.16, north=-12))
    lost = osm_stop(3, *moved(39.96, -75.15, north=18))  # 18 meters from 100: too far
    matches, summary = match_osm(SEPTA, [second, first, lost])
    assert found(matches) == {"300": (BY_PLACE, "n1")}
    assert summary.osm_stops == 3 and summary.matched == 1


def test_a_stop_just_outside_the_city_can_match_but_is_not_counted_as_in_it() -> None:
    outside = osm_stop(1, *moved(39.96, -75.17, north=-2), in_city=False)
    matches, summary = match_osm(SEPTA, [outside])
    assert found(matches) == {"400": (BY_PLACE, "n1")}
    assert summary.osm_stops == 0


# Factors and suggestions


def test_unknown_counts_halfway_never_as_missing() -> None:
    assert yes_no_need(0) == 100
    assert yes_no_need(1) == 0
    assert yes_no_need(None) == NOT_SURVEYED == 50
    assert yes_no_need(0, covered=1) == 0  # the whole stop is under a roof


@pytest.mark.parametrize(
    ("props", "expected"),
    [
        ({}, ["stop_survey"]),
        ({"sh": 1, "bn": 1, "li": 1}, []),
        ({"sh": 0, "bn": 0}, ["stop_shelter_request", "stop_bench_request"]),
        ({"sh": 0}, ["stop_survey", "stop_shelter_request"]),
        ({"cv": 1, "bn": 1}, []),
        ({"sh": 1, "bn": 1, "li": 0}, ["stop_streetlight_report"]),
        ({"sh": 1, "bn": 1, "f_shade": 75}, ["stop_shade_trees"]),
        ({"f_shade": 74}, ["stop_survey"]),
    ],
)
def test_suggestions_follow_what_is_known(props, expected) -> None:
    assert stop_suggestions(props) == expected


def test_suggestions_the_registry_lacks_are_left_out() -> None:
    assert stop_suggestions({"sh": 0, "bn": 0}, {"stop_bench_request"}) == ["stop_bench_request"]


# Everything for the stops on the map, from snapshots


CITY = box(-75.20, 39.94, -75.13, 40.00)


def osm_snapshot(path: Path) -> None:
    lat, lng = moved(39.96, -75.15, north=3)
    elements = [
        # SEPTA's stop 100, by its number: a bench, no shelter, not lit.
        Element(
            "node",
            1,
            {"highway": "bus_stop", "ref": "100", "shelter": "no", "bench": "yes", "lit": "no"},
            shapely.Point(lng, lat),
        ),
        # SEPTA's stop 101, by place: a shelter, the bench not answered.
        Element(
            "node",
            2,
            {"highway": "bus_stop", "shelter": "yes"},
            shapely.Point(*reversed(moved(39.965, -75.15, east=5))),
        ),
        # Far from every SEPTA stop.
        Element(
            "node",
            3,
            {"highway": "bus_stop", "shelter": "no", "bench": "no"},
            shapely.Point(-75.14, 39.99),
        ),
    ]
    table, _ = elements_table((elements, 0), CITY, date(2026, 10, 3))
    import pyarrow.parquet as pq

    pq.write_table(table, path)


def canopy_table(cells_pct: dict[str, float]) -> pa.Table:
    cell_m2 = h3.average_hexagon_area(9, unit="m^2")
    return pa.table(
        {
            "h3": list(cells_pct),
            "canopy_2018_m2": [pct / 100 * cell_m2 for pct in cells_pct.values()],
        }
    )


@pytest.fixture
def comfort_paths(context_factory, tmp_path):
    ctx, _, _ = run_gtfs(context_factory, septa_zip(), NOW)
    paths = publish_paths(ctx)
    osm_file = tmp_path / "osm.parquet"
    osm_snapshot(osm_file)
    paths["osm_philadelphia"] = osm_file
    cells = {
        h3.latlng_to_cell(lat, lng, 9): pct
        for (lat, lng), pct in (
            ((39.96, -75.15), 2.0),
            ((39.965, -75.15), 30.0),
            ((39.96, -75.16), 50.0),
        )
    }
    install_snapshot(
        ctx,
        "tree_canopy_2018",
        canopy_table(cells),
        geometry=False,
        fetched_at="2026-10-04T14:00:00Z",
    )
    heat = pa.table(
        {
            "hei_score": [2.5, -1.0],
            "geometry": [
                shapely.to_wkb(box(-75.155, 39.95, -75.145, 39.97)),
                shapely.to_wkb(box(-75.165, 39.95, -75.155, 39.97)),
            ],
        }
    )
    install_snapshot(
        ctx, "heat_vulnerability", heat, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )
    hin = pa.table(
        {"geometry": [shapely.to_wkb(LineString([(-75.1502, 39.955), (-75.1502, 39.97)]))]}
    )
    install_snapshot(
        ctx,
        "high_injury_network",
        hin,
        geometry=True,
        fetched_at="2026-10-04T14:00:00Z",
        geometry_types=["LineString"],
    )
    for source in ("tree_canopy_2018", "heat_vulnerability", "high_injury_network"):
        store = SnapshotStore(ctx.cache, source)
        paths[source] = store.path_for(store.current())
    return ctx, paths


def published(ctx, paths, tmp_path) -> tuple[dict[str, dict], list[str]]:
    out = tmp_path / "transit.stops.geojson"
    result = build_transit_stops(ctx, paths, out, date(2026, 10, 4))
    features = json.loads(out.read_text())["features"]
    return {f["properties"]["sid"]: f["properties"] for f in features}, result.notes


def test_stops_carry_what_riders_find_the_factors_and_suggestions(comfort_paths, tmp_path) -> None:
    ctx, paths = comfort_paths
    stops, notes = published(ctx, paths, tmp_path)
    s100, s101, s108 = stops["100"], stops["101"], stops["108"]
    # What riders find, from OpenStreetMap, by number and by place; 108 is not in it.
    assert (s100["o"], s100["om"], s100["a"], s100["sh"], s100["bn"], s100["li"]) == (
        "n1",
        1,
        2,
        0,
        1,
        0,
    )
    assert (s101["o"], s101["om"], s101["a"], s101["sh"]) == ("n2", 2, 3, 1)
    assert "bn" not in s101 and "o" not in s108 and "a" not in s108
    # Riders: 55, 30 and 7 boardings, ranked among the three stops.
    assert (s100["f_riders"], s101["f_riders"], s108["f_riders"]) == (67, 33, 0)
    # Known answers are 0 or 100; unknown ones count halfway.
    assert (s100["f_noshelter"], s100["f_nobench"]) == (100, 0)
    assert (s101["f_noshelter"], s101["f_nobench"]) == (0, NOT_SURVEYED)
    assert (s108["f_noshelter"], s108["f_nobench"]) == (NOT_SURVEYED, NOT_SURVEYED)
    # Shade: 100's cell has the least canopy; heat from its tract; the High Injury Network
    # passes 100 and 101 but not 108.
    assert s100["f_shade"] == 67 and s100["cp"] == 2 and s108["f_shade"] == 0
    # 100 and 101 share the hotter tract: one stop of three is cooler, so both rank 33.
    assert (s100["f_heat"], s101["f_heat"], s108["f_heat"]) == (33, 33, 0)
    assert (s100["f_hin"], s101["f_hin"], s108["f_hin"]) == (100, 100, 0)
    assert s100["hin"] == 1 and "hin" not in s108
    # Midday waits of 80 and 120 minutes; 108 has no midday service, so no wait factor.
    assert (s100["f_wait"], s101["f_wait"]) == (0, 50) and "f_wait" not in s108
    # Suggestions, in the registry's order for stops.
    assert s100["sg"] == "stop_shelter_request,stop_streetlight_report"
    assert s101["sg"] == "stop_survey"
    assert s108["sg"] == "stop_survey"
    # Stations get none of this.
    assert not any(key.startswith("f_") or key in ("sg", "a") for key in stops["102"])
    note = next(n for n in notes if "match an OpenStreetMap stop" in n)
    assert "2 of 3 SEPTA bus and trolley stops match an OpenStreetMap stop within 15 meters" in note
    assert "(1 where the stop numbers agree, 1 by place), of the 3 OpenStreetMap has in" in note


def test_without_openstreetmap_every_stop_is_not_yet_surveyed(comfort_paths, tmp_path) -> None:
    ctx, paths = comfort_paths
    del paths["osm_philadelphia"]
    stops, notes = published(ctx, paths, tmp_path)
    assert all(
        stops[sid]["f_noshelter"] == NOT_SURVEYED and stops[sid]["sg"].startswith("stop_survey")
        for sid in ("100", "101", "108")
    )
    assert any("OpenStreetMap is missing" in note for note in notes)


def test_comfort_for_no_stops_is_empty() -> None:
    result = comfort_for_stops([], [], [], {})
    assert result.properties == [] and result.notes == []
