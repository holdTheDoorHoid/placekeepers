"""Map tiles: run tippecanoe to turn layer GeoJSON into PMTiles, and read PMTiles metadata back.

tippecanoe 2.17 or newer writes PMTiles directly. When it is missing (installing it is an owner
action), publish keeps the GeoJSON beside where each tile file would go and says so in the manifest.
PK_TIPPECANOE may point at a specific tippecanoe binary.

The lots tiles are light when zoomed out (issue #26): from zoom 13 every parcel is its shape with
every property, exactly as the GeoJSON has it; below zoom 13 each parcel is a point on its shape
carrying only what the map's styles, filters and lists use (marked `lo`), and tippecanoe thins
those points at its usual rate, keeping 40 percent at zoom 12, 16 at 11 and 6 at 10. The whole
city on a phone went from about 515 kB of lots to about 72 kB (2026-10-05), and the map still
shows where lots cluster, in their lens colors.
"""

from __future__ import annotations

import gzip
import html
import json
import logging
import os
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import shapely
from shapely.geometry import shape

log = logging.getLogger(__name__)

TILES_SKIPPED_NOTE = "tiles skipped: tippecanoe not installed"

LOTS_FILE = "tiles/lots.pmtiles"
#: From this zoom up, every parcel is its shape with every property; below it, a light point.
LOTS_DETAIL_ZOOM = 13
#: Marks the light points, so the feature filter can tell them from the shapes.
LOW_ZOOM_MARK = "lo"
#: Properties the light points leave out: only the lot page uses them, and it reads them from the
#: lot's dossier (docs/CONTRACTS.md section 4).
LOW_ZOOM_LEFT_OUT = ("rs", "n", "dy", "sy", "ny")

# Zoom ranges and options per tile file. Parcels may be thinned at low zooms, but at the highest
# zoom every parcel is kept, even slivers of a few square feet, so each one can be clicked. Context
# hexagons and street lines are few, so no feature is ever dropped.
TILE_OPTIONS: dict[str, list[str]] = {
    LOTS_FILE: [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        # Every point is kept from zoom 13 (the parcels with no shape, issue #22); the light
        # points below it are thinned at tippecanoe's usual drop rate of 2.5 per zoom.
        f"--base-zoom={LOTS_DETAIL_ZOOM}",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--no-tiny-polygon-reduction-at-maximum-zoom",
        # The light points below zoom 13, the shapes from zoom 13 (see the module docstring).
        "--feature-filter",
        json.dumps(
            {
                "parcels": [
                    "any",
                    ["all", ["<", "$zoom", LOTS_DETAIL_ZOOM], ["has", LOW_ZOOM_MARK]],
                    ["all", [">=", "$zoom", LOTS_DETAIL_ZOOM], ["!has", LOW_ZOOM_MARK]],
                ]
            },
            separators=(",", ":"),
        ),
    ],
    "tiles/streets.pmtiles": [
        "--minimum-zoom=8",
        "--maximum-zoom=16",
        # Keep every point at every zoom. tippecanoe would otherwise thin points below its base
        # zoom, and a memorial must never disappear.
        "--base-zoom=8",
        "--no-feature-limit",
        "--no-tile-size-limit",
        # Low zoom tiles cover the whole city, so they carry what matters most there: deaths and
        # serious injuries, and blocks with recorded harm or on the High Injury Network. Other
        # crashes and blocks near a school appear from zoom 12, and every block from zoom 14.
        "--feature-filter",
        json.dumps(
            {
                "crashes": ["any", [">=", "sev", 2], [">=", "$zoom", 12]],
                "segments": [
                    "any",
                    ["==", "hin", 1],
                    [">", "ksi", 0],
                    [">", "k2", 0],
                    ["all", [">=", "$zoom", 12], ["==", "sch", 1]],
                    [">=", "$zoom", 14],
                ],
            },
            separators=(",", ":"),
        ),
    ],
    "tiles/context.pmtiles": [
        "--minimum-zoom=8",
        "--maximum-zoom=14",
        "--no-feature-limit",
        "--no-tile-size-limit",
    ],
    "tiles/care.pmtiles": [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        # Every garden point at every zoom: without a base zoom tippecanoe keeps only a few of
        # them below zoom 16 (7 of 239 at zoom 10 on 2026-10-04).
        "--base-zoom=10",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--no-tiny-polygon-reduction-at-maximum-zoom",
    ],
    # SEPTA stops and routes (M2.1). Every stop is kept at every zoom it appears in, from zoom 12
    # (a few neighborhoods across): at zoom 11 the Center City tile would hold 650 kB of stops.
    # Routes are context lines from zoom 10.
    "tiles/transit.pmtiles": [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        "--base-zoom=10",
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--feature-filter",
        json.dumps({"stops": [">=", "$zoom", 12]}, separators=(",", ":")),
    ],
    # Amenities from OpenStreetMap (M2.2: shelters and benches at stops; M3.5 adds more): every
    # point at every zoom, so none disappears when zoomed out.
    "tiles/amenities.pmtiles": [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        "--base-zoom=10",
        "--no-feature-limit",
        "--no-tile-size-limit",
    ],
    # Heat vulnerability by census tract and the floodplain (M3.1): a few hundred polygons each,
    # simplified at low zooms like the boundaries and detailed enough at zoom 14 for the map to
    # stretch.
    "tiles/environment.pmtiles": [
        "--minimum-zoom=8",
        "--maximum-zoom=14",
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--detect-shared-borders",
    ],
    # The City's trees (M3.1): about 150,000 points, shown only close in, so the file holds them
    # from zoom 14 (a few blocks across) and the map stretches zoom 14 further in. Every tree is
    # kept.
    "tiles/trees.pmtiles": [
        "--minimum-zoom=14",
        "--maximum-zoom=14",
        "--base-zoom=14",
        "--no-feature-limit",
        "--no-tile-size-limit",
    ],
    # Public art (M3.2): several hundred points, every one kept at every zoom, so no work
    # disappears when the map is zoomed out.
    "tiles/art.pmtiles": [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        "--base-zoom=10",
        "--no-feature-limit",
        "--no-tile-size-limit",
    ],
    # Boundaries are few, large shapes: simplified at low zooms, borders kept shared, and
    # detailed enough at zoom 14 to be stretched further by the map.
    "tiles/boundaries.pmtiles": [
        "--minimum-zoom=8",
        "--maximum-zoom=14",
        "--no-feature-limit",
        "--no-tile-size-limit",
        "--detect-shared-borders",
    ],
}
DEFAULT_OPTIONS = ["--minimum-zoom=8", "--maximum-zoom=16", "--drop-densest-as-needed"]


class TileError(RuntimeError):
    pass


def find_tippecanoe() -> str | None:
    override = os.environ.get("PK_TIPPECANOE")
    if override is not None:
        if not override:
            return None
        found = shutil.which(override)
        return found
    return shutil.which("tippecanoe")


def tileset_name(file: str) -> str:
    return "Placekeepers " + Path(file).stem


def tippecanoe_command(
    exe: str, out: Path, file: str, layers: list[tuple[str, Path]], attribution: str
) -> list[str]:
    command = [
        exe,
        "--output",
        str(out),
        "--force",
        "--quiet",
        "--name",
        tileset_name(file),
        "--attribution",
        html.escape(attribution),
        *TILE_OPTIONS.get(file, DEFAULT_OPTIONS),
    ]
    for name, path in layers:
        command += ["--named-layer", f"{name}:{path}"]
    return command


def low_zoom_points(source: Path, out: Path) -> int:
    """Write the light zoomed out form of the parcels (see the module docstring): one point on
    each parcel's shape, with its properties except LOW_ZOOM_LEFT_OUT, and LOW_ZOOM_MARK. Reads
    the GeoJSON one feature per line, as GeoJSONWriter writes it; writes one feature per line.
    Returns the number of points."""
    count = 0
    with source.open(encoding="utf-8") as lines, out.open("w", encoding="utf-8") as handle:
        for line in lines:
            text = line.strip().rstrip(",")
            if not text.startswith("{"):
                continue
            try:
                feature = json.loads(text)
            except json.JSONDecodeError:
                continue  # the collection's opening line
            if feature.get("type") != "Feature":
                continue
            geometry = feature.get("geometry")
            if not geometry:
                continue
            found = shape(geometry)
            if found.is_empty:
                continue
            if found.geom_type != "Point":
                if not found.is_valid:
                    found = shapely.make_valid(found)
                found = shapely.point_on_surface(found)
            properties = {
                key: value
                for key, value in (feature.get("properties") or {}).items()
                if key not in LOW_ZOOM_LEFT_OUT
            }
            properties[LOW_ZOOM_MARK] = 1
            point = {"type": "Point", "coordinates": [round(found.x, 7), round(found.y, 7)]}
            light = {"type": "Feature", "properties": properties, "geometry": point}
            handle.write(json.dumps(light, separators=(",", ":"), ensure_ascii=False) + "\n")
            count += 1
    return count


def run_tippecanoe(
    exe: str, out: Path, file: str, layers: list[tuple[str, Path]], attribution: str
) -> None:
    with tempfile.TemporaryDirectory(prefix="pk-tiles-") as work:
        if file == LOTS_FILE:
            # The lots below zoom 13: light points on the same layer (see the module docstring).
            light = []
            for name, path in layers:
                if name == "parcels":
                    target = Path(work) / f"{path.stem}.lowzoom.geojson"
                    low_zoom_points(path, target)
                    light.append((name, target))
            layers = [*layers, *light]
        command = tippecanoe_command(exe, out, file, layers, attribution)
        log.info("tiles: building %s from %s", file, ", ".join(name for name, _ in layers))
        completed = subprocess.run(command, capture_output=True, text=True, check=False)
    if completed.returncode != 0 or not out.is_file():
        detail = " ".join((completed.stderr or completed.stdout or "").split())[:300]
        raise TileError(f"tippecanoe failed for {file} (exit {completed.returncode}): {detail}")


def read_pmtiles_metadata(path: Path) -> dict[str, Any]:
    """Read the header and JSON metadata of a PMTiles version 3 file."""
    with path.open("rb") as handle:
        header = handle.read(127)
        if len(header) < 127 or header[:7] != b"PMTiles":
            raise TileError(f"{path.name} is not a PMTiles file")
        version = header[7]
        if version != 3:
            raise TileError(f"{path.name} is PMTiles version {version}; expected 3")
        metadata_offset, metadata_length = struct.unpack_from("<QQ", header, 24)
        compression = header[97]
        min_zoom, max_zoom = header[100], header[101]
        handle.seek(metadata_offset)
        raw = handle.read(metadata_length)
    if compression == 2:
        raw = gzip.decompress(raw)
    elif compression not in (0, 1):
        raise TileError(f"{path.name}: unsupported metadata compression {compression}")
    metadata = json.loads(raw.decode("utf-8")) if raw else {}
    return {"min_zoom": min_zoom, "max_zoom": max_zoom, "metadata": metadata}


def pmtiles_layer_names(path: Path) -> list[str]:
    metadata = read_pmtiles_metadata(path)["metadata"]
    layers = metadata.get("vector_layers")
    if isinstance(layers, str):  # some writers store it as a JSON string
        layers = json.loads(layers)
    return [layer["id"] for layer in layers or []]
