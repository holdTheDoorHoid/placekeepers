"""Conditions reported to 311, by block, in tiles/conditions.pmtiles (M3.5, docs/CONTRACTS.md
section 4).

Three layers, one per kind of condition, from the `philly311_conditions` snapshot
(placekeepers.adapters.philly311):

* `dumping`: illegal dumping (the City's service code SR-ST02);
* `lights`: street lights (SR-ST04) and alley lights (SR-ST06) reported out;
* `graffiti`: graffiti removal requests (SR-CL01).

**By block, not by request.** Each request is counted on the nearest street block (a segment of
the City's street centerlines, the same blocks as the street safety layer) within 50 meters of
where it was reported, and each block with at least one request in the window is one point, at the
middle of the block. So the map shows where conditions were reported, not which door reported
them: a request is often made from the reporter's own home. On 2026-10-05 the median request lay 9
meters from its block and 99 percent within 50 meters (the rest, in parks and large lots, are
counted in the build notes).

**The window** is the 90 days up to the newest request in the snapshot (the City's table lags a day
or two), so a late snapshot still shows a full 90 days, dated by the manifest's `newest_record`.

Each point: `id` (the block's `seg_id`, which M3.4 can join to the `segments` layer), `name` (the
street, as the City writes it), `n` (requests in the window), `o` (how many are still open in the
City's table), `d` (the day of the newest request) and, for lights, `a` (how many of the `n` were
alley lights). Nothing about who reported, no request numbers, addresses or text: the snapshot
never held them.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from placekeepers.context import Context
from placekeepers.derive.street_safety import points_in_meters
from placekeepers.geo import GeoJSONWriter
from placekeepers.publish.layers import BuildResult, LayerBuilder
from placekeepers.publish.streets import street_network

log = logging.getLogger(__name__)

CONDITIONS_FILE = "tiles/conditions.pmtiles"
SOURCE = "philly311_conditions"
WINDOW_DAYS = 90
#: A request counts on the nearest block within this distance (address points stand back from the
#: street's center line).
BLOCK_METERS = 50.0
ALLEY_LIGHT = "SR-ST06"
#: Source layer -> the City's service codes it counts.
KINDS: dict[str, tuple[str, ...]] = {
    "dumping": ("SR-ST02",),
    "lights": ("SR-ST04", ALLEY_LIGHT),
    "graffiti": ("SR-CL01",),
}
WORDS = {
    "dumping": "illegal dumping",
    "lights": "street or alley lights out",
    "graffiti": "graffiti",
}


def window(newest: date) -> tuple[date, date]:
    """The first and last day of the 90 day window ending on the newest request's day."""
    return newest - timedelta(days=WINDOW_DAYS - 1), newest


def condition_builder(kind: str):
    """The builder of one condition layer (see the module docstring)."""
    codes = KINDS[kind]

    def build(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
        rows = pq.read_table(paths[SOURCE]).to_pylist()
        days = [r["requested"] for r in rows if r.get("requested") is not None]
        if not days:
            with GeoJSONWriter(out):
                pass
            return BuildResult(0, [f"{kind}: the 311 snapshot has no requests"])
        first, last = window(max(days))
        wanted = [
            r
            for r in rows
            if r.get("service_code") in codes
            and r.get("requested") is not None
            and first <= r["requested"] <= last
        ]
        placed = [r for r in wanted if r.get("lat") is not None and r.get("lng") is not None]
        if "street_centerlines" not in paths:
            with GeoJSONWriter(out):
                pass
            return BuildResult(0, [f"{kind}: the street centerlines are missing, so no blocks"])
        network = street_network(paths["street_centerlines"])
        points = points_in_meters([r["lat"] for r in placed], [r["lng"] for r in placed])
        blocks = network.nearest_segment(points, BLOCK_METERS)
        per_block: dict[int, dict[str, Any]] = defaultdict(
            lambda: {"n": 0, "o": 0, "a": 0, "d": None}
        )
        off_street = 0
        for row, block in zip(placed, blocks, strict=True):
            if block is None:
                off_street += 1
                continue
            entry = per_block[block]
            entry["n"] += 1
            entry["o"] += (row.get("status") or "").strip().lower() == "open"
            entry["a"] += row.get("service_code") == ALLEY_LIGHT
            if entry["d"] is None or row["requested"] > entry["d"]:
                entry["d"] = row["requested"]
        with GeoJSONWriter(out) as writer:
            for block in sorted(per_block, key=lambda b: network.ids[b]):
                entry = per_block[block]
                middle = network.lines[block].interpolate(0.5, normalized=True)
                properties: dict[str, Any] = {
                    "id": network.ids[block],
                    "name": network.names[block],
                    "n": entry["n"],
                    "o": entry["o"],
                    "d": entry["d"].isoformat(),
                }
                if kind == "lights" and entry["a"]:
                    properties["a"] = entry["a"]
                point = {
                    "type": "Point",
                    "coordinates": [round(middle.x, 7), round(middle.y, 7)],
                }
                writer.write(properties, point)
        counted = sum(e["n"] for e in per_block.values())
        still_open = sum(e["o"] for e in per_block.values())
        line = (
            f"{kind}: {counted:,} requests to 311 about {WORDS[kind]} from {first.isoformat()} "
            f"to {last.isoformat()}, on {writer.count:,} blocks; {still_open:,} still open"
        )
        left = (len(wanted) - len(placed)) + off_street
        if left:
            line += f"; {left:,} without a point or more than 50 meters from a street left out"
        log.info("publish: %s", line)
        return BuildResult(writer.count, [line])

    build.__name__ = f"build_{kind}"
    return build


CONDITION_BUILDERS: tuple[LayerBuilder, ...] = tuple(
    LayerBuilder(
        CONDITIONS_FILE,
        kind,
        (SOURCE,),
        condition_builder(kind),
        extras=("street_centerlines",),
    )
    for kind in KINDS
)
