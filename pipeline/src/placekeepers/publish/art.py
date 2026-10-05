"""The public art layer, `art` in tiles/art.pmtiles (docs/CONTRACTS.md section 4), added by M3.2.

Works of public art from the City's Percent for Art list, OpenStreetMap's artworks and Wikidata.
The same work in two or three sources is one work on the map, but its records stay apart in the
file, one per source, each holding only what its own source says (decision D1 of
docs/VERIFICATION_V0_2.md: OpenStreetMap's data is never stored in the same record as data under
another license). The records of one work share its id (`g`); the map draws one of them (`pr`) and
the browser joins the others when the work is opened (web/src/art/join.ts, checked against
placekeepers.derive.art.join_published). Memorial artworks are published without any words that
could name the person they remember (docs/ETHICS.md).

OpenStreetMap's records are under the Open Database License and credited "© OpenStreetMap
contributors"; the City's and Wikidata's keep their own terms.
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
            for properties, (lng, lat) in work.features():
                point = {"type": "Point", "coordinates": [round(lng, 7), round(lat, 7)]}
                writer.write(properties, point)
    log.info("art: %s", result.notes[0])
    return BuildResult(writer.count, result.notes)


ART_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(ART_FILE, "art", (CITY, OSM, WIKIDATA), build_art),
)
