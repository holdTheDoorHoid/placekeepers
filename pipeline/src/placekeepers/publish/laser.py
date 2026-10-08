"""Parking problems reported with Laser Vision, counted per block sized cell, in
tiles/parking.pmtiles (issue #37, docs/CONTRACTS.md section 4).

From the `pba_laser` snapshot (placekeepers.adapters.pba_laser): every report Philly Bike Action's
Laser Vision app received in the 12 months up to the newest day with reports, already kept as its
H3 cell at resolution 10 and its kind.

**Counts only, never points.** The layer `parking` holds one H3 cell per area with at least
MIN_REPORTS reports in the 12 months, so a single report never shows. Within a shown cell, the count
of one kind is published only when it is at least MIN_REPORTS too; a smaller count of a kind is left
out (the map says "fewer than 5"). Nothing about a vehicle, a plate, a photo, a time of day or who
reported is published, or even downloaded.

**Why resolution 10.** An H3 cell at resolution 10 is about 115 meters across (15,000 square
meters), about one Philadelphia block: small enough to point at the corner or the stretch of curb
that needs a curb extension, bollards or a loading zone, and, with the 12 month window and the
threshold, far coarser than the 15 meters Philly Bike Action already shifts each pin. Resolution 9
(about 300 meters, the site's other area cells) blurs a corner into its neighborhood; resolution 11
(about 45 meters) is close to the shift itself and would leave most areas below the threshold (on
2026-10-08, 67 percent of reports would show instead of 89).

**Two shapes per cell.** Each shown cell is written twice in the same layer: as a point at its
center, which the map draws as a heat map zoomed out, and as its hexagon (with `id`, the cell id),
which the map draws and opens on a tap close in. The tiles keep the points below zoom 14 and the
hexagons from zoom 13 (publish/tiles.py).

Properties (small integers): `n` (every report in the cell) and `sw` (blocking a sidewalk), `bl`
(in a bike lane), `cw` (on a crosswalk), `co` (on a corner, the City's corner clearance) and `rp`
(blocking a curb ramp), each absent when fewer than MIN_REPORTS. The window's last day is the
source's `newest_record` in the manifest; it starts 12 months earlier, the day after the same date.
"""

from __future__ import annotations

import logging
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

import h3
import pyarrow.parquet as pq

from placekeepers.adapters.pba_laser import KINDS
from placekeepers.context import Context
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder, cell_polygon

log = logging.getLogger(__name__)

PARKING_FILE = "tiles/parking.pmtiles"
SOURCE_LAYER = "parking"
SOURCE = "pba_laser"
#: A cell, and a kind within it, shows only with at least this many reports in the 12 months.
MIN_REPORTS = 5
#: The tile property of each kind of report.
FIELDS: dict[str, str] = {
    "sidewalk": "sw",
    "bike_lane": "bl",
    "crosswalk": "cw",
    "corner": "co",
    "ramp": "rp",
}
assert set(FIELDS) == {kind for kind, _ in KINDS}


def count_cells(
    rows: list[tuple[str, str]], minimum: int = MIN_REPORTS
) -> tuple[dict[str, dict[str, int]], int, int]:
    """Counts per cell, from (cell, kind) rows: {cell: {"n": total, field: count, ...}} for the
    cells with at least `minimum` reports, each kind's field present only when it has at least
    `minimum`. Also returns how many cells and reports were left out below the threshold."""
    totals: Counter[str] = Counter()
    by_kind: dict[str, Counter[str]] = defaultdict(Counter)
    for cell, kind in rows:
        if kind not in FIELDS:
            continue
        totals[cell] += 1
        by_kind[cell][kind] += 1
    shown: dict[str, dict[str, int]] = {}
    dropped_cells = dropped_reports = 0
    for cell, total in totals.items():
        if total < minimum:
            dropped_cells += 1
            dropped_reports += total
            continue
        properties = {"n": total}
        for kind, field in FIELDS.items():
            count = by_kind[cell][kind]
            if count >= minimum:
                properties[field] = count
        shown[cell] = properties
    return shown, dropped_cells, dropped_reports


def _areas(count: int) -> str:
    return f"{count:,} area" if count == 1 else f"{count:,} areas"


def build_parking(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths[SOURCE], columns=["h", "kind", "window_start", "window_end"])
    cells = table.column("h").to_pylist()
    kinds = table.column("kind").to_pylist()
    starts = table.column("window_start").to_pylist()
    ends = table.column("window_end").to_pylist()
    shown, dropped_cells, dropped_reports = count_cells(list(zip(cells, kinds, strict=True)))
    with GeoJSONWriter(out) as writer:
        for cell in sorted(shown):
            properties: dict[str, Any] = shown[cell]
            lat, lng = h3.cell_to_latlng(cell)
            center = {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}
            writer.write(dict(properties), center)
            writer.write({"id": cell, **properties}, geometry_json(cell_polygon(cell)))
    reports = sum(entry["n"] for entry in shown.values())
    window = (
        f" from {min(starts).isoformat()} to {max(ends).isoformat()}"
        if starts and ends and starts[0] and ends[0]
        else ""
    )
    line = (
        f"Parking problems reported with Laser Vision: {reports:,} of {len(cells):,} reports"
        f"{window} shown in {_areas(len(shown))} about a block across (at least {MIN_REPORTS} "
        f"reports each); {_areas(dropped_cells)} with fewer, holding {dropped_reports:,} "
        "reports, left out"
    )
    log.info("publish: %s", line)
    return BuildResult(len(shown), [line])


PARKING_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(PARKING_FILE, SOURCE_LAYER, (SOURCE,), build_parking),
)
