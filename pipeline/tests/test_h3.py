"""Shooting victims counted per H3 cell for the 12 and 36 months up to the build date."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import h3
import pyarrow as pa
import pyarrow.parquet as pq
from shapely.geometry import Point, shape

from placekeepers.publish.layers import (
    H3_RESOLUTION,
    aggregate_shootings,
    build_h3,
    months_before,
)

AS_OF = date(2026, 10, 4)
CITY_HALL = (39.95262, -75.16365)
FAIRMOUNT = (39.96707, -75.17254)


def test_months_before_handles_short_months_and_leap_days() -> None:
    assert months_before(AS_OF, 12) == date(2025, 10, 4)
    assert months_before(AS_OF, 36) == date(2023, 10, 4)
    assert months_before(date(2026, 3, 31), 1) == date(2026, 2, 28)
    assert months_before(date(2024, 2, 29), 12) == date(2023, 2, 28)
    assert months_before(date(2026, 1, 15), 13) == date(2024, 12, 15)


def test_counts_respect_both_windows_exactly() -> None:
    lat, lng = CITY_HALL
    rows = [
        (lat, lng, date(2026, 10, 4)),  # the build date itself: both windows
        (lat, lng, date(2025, 10, 5)),  # first day of the 12 month window: both
        (lat, lng, date(2025, 10, 4)),  # exactly 12 months back: 36 months only
        (lat, lng, date(2023, 10, 5)),  # first day of the 36 month window
        (lat, lng, date(2023, 10, 4)),  # exactly 36 months back: neither
        (lat, lng, date(2026, 10, 5)),  # after the build date: neither
        (lat, lng, None),  # no date: neither
    ]
    counts, unplaced = aggregate_shootings(rows, AS_OF)
    cell = h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
    assert counts == {cell: [2, 4]}
    assert unplaced == 0


def test_cells_are_separate_and_empty_cells_are_omitted() -> None:
    rows = [
        (*CITY_HALL, date(2026, 9, 1)),
        (*CITY_HALL, date(2024, 1, 1)),
        (*FAIRMOUNT, date(2024, 6, 1)),
        (*FAIRMOUNT, date(2020, 6, 1)),  # too old for either window
        (0.0, 0.0, date(2026, 9, 1)),  # a data error, not in Philadelphia
        (None, None, date(2026, 9, 1)),  # no location
    ]
    counts, unplaced = aggregate_shootings(rows, AS_OF)
    assert counts == {
        h3.latlng_to_cell(*CITY_HALL, H3_RESOLUTION): [1, 2],
        h3.latlng_to_cell(*FAIRMOUNT, H3_RESOLUTION): [0, 1],
    }
    assert all(s36 > 0 for _, s36 in counts.values())
    assert unplaced == 2


def test_the_layer_has_only_cell_ids_and_counts(context_factory, tmp_path: Path) -> None:
    table = pa.table(
        {
            "objectid": [1, 2, 3],
            "date_": pa.array([date(2026, 9, 1), date(2025, 1, 1), date(2019, 1, 1)], pa.date32()),
            "fatal": pa.array([1, 0, 0], pa.int16()),
            "lat": [CITY_HALL[0], CITY_HALL[0], FAIRMOUNT[0]],
            "lng": [CITY_HALL[1], CITY_HALL[1], FAIRMOUNT[1]],
        }
    )
    snapshot = tmp_path / "shootings.parquet"
    pq.write_table(table, snapshot)
    out = tmp_path / "context.h3.geojson"
    result = build_h3(context_factory(), {"shootings": snapshot}, out, AS_OF)

    collection = json.loads(out.read_text())
    assert result.features == 1
    [feature] = collection["features"]
    cell = h3.latlng_to_cell(*CITY_HALL, H3_RESOLUTION)
    assert feature["properties"] == {"h": cell, "s12": 1, "s36": 2}
    polygon = shape(feature["geometry"])
    ring = feature["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1] and len(ring) == 7
    assert -75.2 < ring[0][0] < -75.1 and 39.9 < ring[0][1] < 40.0  # longitude first
    assert polygon.exterior.is_ccw
    assert polygon.contains(Point(CITY_HALL[1], CITY_HALL[0]))
