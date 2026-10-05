"""The transit layer of tiles/transit.pmtiles (docs/CONTRACTS.md section 4), added by M2.2.

* `stops`: every bus and trolley stop OpenStreetMap knows inside the city, with what riders find
  there (shelter, bench, waste basket, light, tactile paving, wheelchair access, departures board,
  roof) and `c`, what the map shows: a shelter or roof, a bench but no shelter mapped, neither,
  or not yet surveyed. The rules are in placekeepers.derive.bus_stops.

Everything here comes from OpenStreetMap, so the published layer is under the Open Database
License, credited "© OpenStreetMap contributors" (registry source `osm_philadelphia`).
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

from placekeepers.context import Context
from placekeepers.derive.bus_stops import comfort_counts, find_stops, summary_note
from placekeepers.geo import GeoJSONWriter
from placekeepers.publish.layers import BuildResult, LayerBuilder

log = logging.getLogger(__name__)

TRANSIT_FILE = "tiles/transit.pmtiles"
STOP_COLUMNS = ["osm_type", "osm_id", "tags", "lat", "lng", "in_city", "extract_date", "geometry"]


def build_stops(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["osm_philadelphia"], columns=STOP_COLUMNS)
    stops, notes = find_stops(table)
    dates = [d for d in table.column("extract_date").to_pylist() if d is not None]
    with GeoJSONWriter(out) as writer:
        for stop in stops:
            if not stop.in_city:
                continue
            point = {"type": "Point", "coordinates": [round(stop.lng, 7), round(stop.lat, 7)]}
            writer.write(stop.properties(), point)
    counts = comfort_counts(stops)
    notes.insert(0, summary_note(counts, max(dates) if dates else None))
    log.info("stops: %s", notes[0])
    return BuildResult(writer.count, notes)


TRANSIT_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(TRANSIT_FILE, "stops", ("osm_philadelphia",), build_stops),
)
