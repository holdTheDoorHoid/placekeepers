"""The amenity layers of tiles/amenities.pmtiles (docs/CONTRACTS.md section 4), added by M2.2.

Amenities that OpenStreetMap knows about, from the weekly extract (`osm_philadelphia`). M2.2 adds
the first layer; later milestones (M3.5: drinking water, toilets and more) add theirs to the same
file.

* `stops`: every bus and trolley stop OpenStreetMap knows inside the city, with what riders find
  there (shelter, bench, waste basket, light, tactile paving, wheelchair access, departures board,
  roof) and `c`, what the map shows: a shelter or roof, a bench but no shelter mapped, neither,
  or not yet surveyed. The rules are in placekeepers.derive.bus_stops. SEPTA's own stops are a
  separate layer (`stops` in tiles/transit.pmtiles, M2.1); M2.3 joins the two.

Everything here comes from OpenStreetMap, so the published layers are under the Open Database
License, credited "© OpenStreetMap contributors".
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

AMENITIES_FILE = "tiles/amenities.pmtiles"
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


AMENITY_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(AMENITIES_FILE, "stops", ("osm_philadelphia",), build_stops),
)
