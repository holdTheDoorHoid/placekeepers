"""Map tiles: run tippecanoe to turn layer GeoJSON into PMTiles, and read PMTiles metadata back.

tippecanoe 2.17 or newer writes PMTiles directly. When it is missing (installing it is an owner
action), publish keeps the GeoJSON beside where each tile file would go and says so in the manifest.
PK_TIPPECANOE may point at a specific tippecanoe binary.
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
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

TILES_SKIPPED_NOTE = "tiles skipped: tippecanoe not installed"

# Zoom ranges and options per tile file. Parcels may be thinned at low zooms, but at the highest
# zoom every parcel is kept, even slivers of a few square feet, so each one can be clicked. Context
# hexagons and street lines are few, so no feature is ever dropped.
TILE_OPTIONS: dict[str, list[str]] = {
    "tiles/lots.pmtiles": [
        "--minimum-zoom=10",
        "--maximum-zoom=16",
        # Parcels with no shape are points (issue #22); keep every one at every zoom, as the
        # polygons are, instead of thinning points below the maximum zoom.
        "--base-zoom=10",
        "--drop-densest-as-needed",
        "--extend-zooms-if-still-dropping",
        "--no-tiny-polygon-reduction-at-maximum-zoom",
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
    # Bus and trolley stops (M2.2): every stop at every zoom, so none disappears when zoomed out.
    "tiles/transit.pmtiles": [
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


def run_tippecanoe(
    exe: str, out: Path, file: str, layers: list[tuple[str, Path]], attribution: str
) -> None:
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
