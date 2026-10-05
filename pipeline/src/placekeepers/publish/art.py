"""The public art layer, `art` in tiles/art.pmtiles (docs/CONTRACTS.md section 4), added by M3.2.

One point per work from the City's Percent for Art list, OpenStreetMap's artworks and Wikidata,
the same work in two or three sources merged into one point that links to each of them. The rules
are in placekeepers.derive.art; memorial artworks are published without any words that could name
the person they remember (docs/ETHICS.md).

OpenStreetMap's artworks are under the Open Database License, so the whole layer is too,
credited "© OpenStreetMap contributors" with the City and Wikidata.
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

from placekeepers.context import Context
from placekeepers.derive.art import CITY, OSM, WIKIDATA, load_and_match
from placekeepers.geo import GeoJSONWriter
from placekeepers.publish.layers import BuildResult, LayerBuilder

log = logging.getLogger(__name__)

ART_FILE = "tiles/art.pmtiles"


def build_art(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    result = load_and_match(paths, as_of)
    with GeoJSONWriter(out) as writer:
        for work in result.works:
            lng, lat = work.point
            point = {"type": "Point", "coordinates": [round(lng, 7), round(lat, 7)]}
            writer.write(work.properties(), point)
    log.info("art: %s", result.notes[0])
    return BuildResult(writer.count, result.notes)


ART_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(ART_FILE, "art", (CITY, OSM, WIKIDATA), build_art),
)
