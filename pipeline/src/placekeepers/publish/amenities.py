"""The amenity layers of tiles/amenities.pmtiles (docs/CONTRACTS.md section 4), added by M2.2.

Amenities that OpenStreetMap knows about, from the weekly extract (`osm_philadelphia`). M2.2 adds
the first layer, the shelters and benches at stops; M3.5 adds benches, picnic tables, drinking
water, public toilets and public bookcases (placekeepers.derive.amenities), one layer each.

* `stops`: every bus and trolley stop OpenStreetMap knows inside the city, with what riders find
  there (shelter, bench, waste basket, light, tactile paving, wheelchair access, departures board,
  roof) and `c`, what the map shows: a shelter or roof, a bench but no shelter mapped, neither,
  or not yet surveyed. The rules are in placekeepers.derive.bus_stops. SEPTA's own stops are a
  separate layer (`stops` in tiles/transit.pmtiles, M2.1); M2.3 joins the two.

The same answers are also published as a table keyed by OpenStreetMap id, for the browser to join
to SEPTA's stops (placekeepers.publish.stop_table).

Everything here comes from OpenStreetMap, so the published layers are under the Open Database
License, credited "© OpenStreetMap contributors".
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

from placekeepers.context import Context
from placekeepers.derive import amenities
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


def amenity_builder(kind: str):
    """The builder of one amenity layer (M3.5): every element of that kind inside the city."""

    def build(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
        table = pq.read_table(paths["osm_philadelphia"], columns=STOP_COLUMNS)
        found, notes = amenities.find_amenities(table, kind)
        dates = [d for d in table.column("extract_date").to_pylist() if d is not None]
        with GeoJSONWriter(out) as writer:
            for item in found:
                if not item.in_city:
                    continue
                point = {"type": "Point", "coordinates": [round(item.lng, 7), round(item.lat, 7)]}
                writer.write(item.properties, point)
        day = max(dates).isoformat() if dates else None
        notes.insert(0, amenities.summary_note(kind, found, day))
        log.info("%s: %s", kind, notes[0])
        return BuildResult(writer.count, notes)

    build.__name__ = f"build_{kind}"
    return build


AMENITY_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(AMENITIES_FILE, "stops", ("osm_philadelphia",), build_stops),
    *(
        LayerBuilder(AMENITIES_FILE, kind, ("osm_philadelphia",), amenity_builder(kind))
        for kind in amenities.KINDS
    ),
)
