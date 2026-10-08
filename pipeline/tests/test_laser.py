"""Parking problems reported with Laser Vision (issue #37): the polite download from Philly Bike
Action's public map, the snapshot that keeps each report as a block sized cell, and the layer that
publishes counts only, never a single report."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import h3
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from placekeepers.adapters import pba_laser
from placekeepers.adapters.pba_laser import KINDS, PAUSE_SECONDS, PbaLaser, window
from placekeepers.httpclient import PoliteClient
from placekeepers.publish import publish
from placekeepers.publish.laser import FIELDS, MIN_REPORTS, PARKING_FILE, count_cells
from placekeepers.publish.tiles import TILE_OPTIONS
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import install_snapshot

# Fixed clock: 2026-10-08 in Philadelphia, so yesterday is 2026-10-07.
NOW = datetime(2026, 10, 8, 14, 0, 0, tzinfo=UTC)
CENTER = (39.9526, -75.1652)
#: An H3 resolution 10 cell's neighbor is about 115 meters away; these offsets stay in one cell.
NEAR = [(0.0, 0.0), (0.00005, 0.00004), (-0.00004, 0.00003), (0.00002, -0.00005)]


def pins(count: int, lat: float = CENTER[0], lng: float = CENTER[1]) -> list[list[float]]:
    return [
        [lat + NEAR[i % 4][0], lng + NEAR[i % 4][1], 1]
        for i in range(count)  # three numbers, as the server sends them
    ]


class FakeLaser:
    """Philly Bike Action's map_data endpoint: answers `date=` with that day's pins and
    `violation=` with the pins of that kind, recording every request."""

    def __init__(self, days: dict[str, int], kinds: dict[str, list[list[float]]]):
        self.days = days
        self.kinds = kinds
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.url.host == "bikeaction.org"
        assert request.url.path == "/tools/laser/map_data/"
        params = request.url.params
        if "date" in params:
            return httpx.Response(200, json={"pins": pins(self.days.get(params["date"], 0))})
        value = params["violation"]
        return httpx.Response(
            200, json={"pins": self.kinds.get(value, []), "unique_users_count": 3}
        )


def laser_context(context_factory, server, sleeps: list[float]):
    ctx = context_factory(handler=server, now=NOW)

    def factory() -> PoliteClient:
        return PoliteClient(
            transport=httpx.MockTransport(server),
            sleep=sleeps.append,
            min_interval=0,
            max_attempts=3,
        )

    ctx._http_factory = factory
    return ctx


def low_bar(ctx):
    source = ctx.registry.sources["pba_laser"]
    health = source.health.model_copy(update={"min_rows": 1})
    return source.model_copy(update={"health": health})


def test_the_window_is_the_twelve_months_up_to_the_newest_day() -> None:
    assert window(date(2026, 10, 7)) == (date(2025, 10, 8), date(2026, 10, 7))
    assert window(date(2028, 2, 29)) == (date(2027, 3, 1), date(2028, 2, 29))


def test_the_download_asks_for_one_kind_at_a_time_politely(context_factory) -> None:
    other_place = pins(2, 39.99, -75.15)
    server = FakeLaser(
        # Yesterday had no reports, the day before had some.
        days={"2026-10-06": 80},
        kinds={
            "Sidewalk": pins(6) + other_place,
            "Bike Lane": pins(3),
            "Crosswalk": [[0.0, 0.0, 1], ["x", None, 1]],
            "Corner Clearance": [],
            "Handicap Ramp": pins(1),
        },
    )
    sleeps: list[float] = []
    ctx = laser_context(context_factory, server, sleeps)
    source = low_bar(ctx)
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"

    # Two small requests to find the newest day, then one per kind, never one for every report.
    asked = [dict(r.url.params) for r in server.requests]
    assert asked[:2] == [{"date": "2026-10-07"}, {"date": "2026-10-06"}]
    assert [a.get("violation") for a in asked[2:]] == [value for _, value in KINDS]
    for params in asked[2:]:
        # The server reads date_lte as midnight at the start of that day.
        assert params["date_gte"] == "2025-10-07" and params["date_lte"] == "2026-10-07"
    assert len(asked) == 7
    assert all("violation" in a or "date" in a for a in asked)
    for request in server.requests:
        assert request.headers["user-agent"].startswith("Placekeepers/")
    # A pause of a few seconds before every request after the first.
    assert sleeps.count(PAUSE_SECONDS) == 6

    store = SnapshotStore(ctx.cache, "pba_laser")
    meta = store.current()
    assert meta.newest_record == "2026-10-06"
    assert meta.recipe == PbaLaser(source, ctx).recipe()
    table = pq.read_table(store.path_for(meta))
    # Each report is its cell and its kind, never a point.
    assert set(table.column_names) == {"h", "kind", "window_start", "window_end", "newest_report"}
    rows = table.to_pylist()
    # 8 sidewalk, 3 bike lane, 1 ramp; the crosswalk pins at 0, 0 and without numbers are left out.
    assert len(rows) == 12
    cell = h3.latlng_to_cell(*CENTER, 10)
    assert sum(1 for r in rows if r["h"] == cell and r["kind"] == "sidewalk") == 6
    assert {r["kind"] for r in rows} == {"sidewalk", "bike_lane", "ramp"}
    assert {r["window_start"] for r in rows} == {date(2025, 10, 7)}
    assert {r["window_end"] for r in rows} == {date(2026, 10, 6)}
    assert any("outside the box" in note for note in meta.notes)
    assert any("without a usable point" in note for note in meta.notes)

    # The download kept only the points while it existed, and is gone once the snapshot is made.
    assert not any((ctx.cache.root / "raw" / "pba_laser").glob("*/*.json"))


def test_the_download_keeps_only_points(context_factory, tmp_path: Path) -> None:
    server = FakeLaser(days={"2026-10-07": 85}, kinds={"Sidewalk": pins(2)})
    sleeps: list[float] = []
    ctx = laser_context(context_factory, server, sleeps)
    adapter = PbaLaser(low_bar(ctx), ctx)
    info = adapter.fetch(tmp_path)
    assert info["window_end"] == "2026-10-07" and info["newest_report"] == "2026-10-07"
    assert info["reports"]["sidewalk"] == 2 and info["rows"] == 2
    saved = json.loads((tmp_path / "sidewalk.json").read_text(encoding="utf-8"))
    assert saved == {"points": [p[:2] for p in pins(2)]}
    # One probe (yesterday had reports) and five kinds.
    assert len(server.requests) == 6


def test_a_week_without_reports_fails_and_asks_nothing_more(context_factory) -> None:
    server = FakeLaser(days={}, kinds={})
    sleeps: list[float] = []
    ctx = laser_context(context_factory, server, sleeps)
    result = fetch_source(ctx, low_bar(ctx))
    assert result.outcome == "failed" and "no reports" in result.detail
    assert len(server.requests) == pba_laser.NEWEST_LOOKBACK_DAYS
    assert all("violation" not in r.url.params for r in server.requests)


def test_an_error_page_is_tried_again_then_given_up(context_factory) -> None:
    calls: list[httpx.Request] = []

    def broken(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"error": "busy"})

    sleeps: list[float] = []
    ctx = laser_context(context_factory, broken, sleeps)
    result = fetch_source(ctx, low_bar(ctx))
    assert result.outcome == "failed"
    assert len(calls) == 3  # max_attempts of the test client


def test_a_refusal_is_never_worked_around(context_factory) -> None:
    calls: list[httpx.Request] = []

    def refuse(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(403, text="no")

    sleeps: list[float] = []
    ctx = laser_context(context_factory, refuse, sleeps)
    result = fetch_source(ctx, low_bar(ctx))
    assert result.outcome == "failed" and "refused" in result.detail
    assert len(calls) == 1


# ---------------------------------------------------------------------------------------------
# Counting and publishing


def test_a_cell_shows_only_with_enough_reports_and_a_kind_only_with_enough_of_its_own() -> None:
    rows = (
        [("a", "sidewalk")] * 6
        + [("a", "bike_lane")] * 2
        + [("b", "corner")] * 4
        + [("c", "ramp")] * MIN_REPORTS
        + [("d", "unknown")] * 9
    )
    shown, dropped_cells, dropped_reports = count_cells(rows)
    assert shown == {"a": {"n": 8, "sw": 6}, "c": {"n": MIN_REPORTS, "rp": MIN_REPORTS}}
    assert (dropped_cells, dropped_reports) == (1, 4)


def install_laser(ctx, cells: dict[str, dict[str, int]]) -> None:
    rows = [
        (cell, kind) for cell, kinds in cells.items() for kind, n in kinds.items() for _ in range(n)
    ]
    count = len(rows)
    install_snapshot(
        ctx,
        "pba_laser",
        pa.table(
            {
                "h": [cell for cell, _ in rows],
                "kind": [kind for _, kind in rows],
                "window_start": pa.array([date(2025, 10, 8)] * count, pa.date32()),
                "window_end": pa.array([date(2026, 10, 7)] * count, pa.date32()),
                "newest_report": pa.array([date(2026, 10, 7)] * count, pa.date32()),
            }
        ),
        geometry=False,
        fetched_at="2026-10-08T14:00:00Z",
    )


def test_the_layer_publishes_counts_per_cell_as_a_center_and_a_hexagon(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory(now=NOW)
    busy = h3.latlng_to_cell(*CENTER, 10)
    quiet = h3.latlng_to_cell(39.99, -75.15, 10)
    install_laser(
        ctx,
        {
            busy: {"sidewalk": 9, "bike_lane": 5, "crosswalk": 1, "corner": 0, "ramp": 3},
            quiet: {"sidewalk": 4},
        },
    )
    result = publish(ctx, tmp_path / "data")
    layer = tmp_path / "data" / "tiles" / "parking.parking.geojson"
    features = json.loads(layer.read_text(encoding="utf-8"))["features"]
    assert result.features[f"{PARKING_FILE} parking"] == 1
    points = [f for f in features if f["geometry"]["type"] == "Point"]
    hexagons = [f for f in features if f["geometry"]["type"] == "Polygon"]
    assert len(points) == len(hexagons) == 1
    counts = {"n": 18, "sw": 9, "bl": 5}
    assert points[0]["properties"] == counts
    assert hexagons[0]["properties"] == {"id": busy, **counts}
    lng, lat = points[0]["geometry"]["coordinates"]
    assert h3.latlng_to_cell(lat, lng, 10) == busy
    assert result.manifest["layers"]["parking_reports"]["file"] == PARKING_FILE
    note = next(n for n in result.manifest["notes"] if "Laser Vision" in n)
    assert "18 of 22 reports from 2025-10-08 to 2026-10-07 shown in 1 area about" in note
    assert "1 area with fewer, holding 4 reports, left out" in note


def test_every_property_is_a_small_count_or_the_cell_id() -> None:
    assert set(FIELDS) == {kind for kind, _ in KINDS}
    assert set(FIELDS.values()) == {"sw", "bl", "cw", "co", "rp"}
    assert MIN_REPORTS >= 3


def test_the_tiles_keep_centers_zoomed_out_and_hexagons_close_in() -> None:
    options = TILE_OPTIONS[PARKING_FILE]
    rule = json.loads(options[options.index("--feature-filter") + 1])["parking"]
    assert ["==", "$type", "Point"] in rule[1] and ["<", "$zoom", 14] in rule[1]
    assert ["==", "$type", "Polygon"] in rule[2] and [">=", "$zoom", 13] in rule[2]
    assert "--no-feature-limit" in options


@pytest.mark.parametrize("kind,value", KINDS)
def test_each_kind_is_asked_for_by_philly_bike_actions_own_words(kind: str, value: str) -> None:
    # lazer/integrations/submit_form.py: the server matches the start of these words.
    full = {
        "Sidewalk": "Sidewalk",
        "Bike Lane": "Bike Lane (vehicle parked in bike lane)",
        "Crosswalk": "Crosswalk (vehicle on crosswalk)",
        "Corner Clearance": "Corner Clearance (vehicle parked on corner)",
        "Handicap Ramp": "Handicap Ramp (vehicle blocking handicap ramp)",
    }
    assert full[value].startswith(value)
    assert kind in FIELDS
