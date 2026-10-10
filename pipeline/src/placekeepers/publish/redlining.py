"""The 1937 redlining map in tiles/redlining.pmtiles, layer "holc" (owner, 2026-10-09;
docs/CONTRACTS.md sections 2 to 4).

From the `mapping_inequality_1937` snapshot (placekeepers.adapters.redlining): each area of the
Home Owners' Loan Corporation's 1937 map of Philadelphia as Mapping Inequality traced it, under
CC BY-NC 2.5, a non commercial license.

**Kept apart.** This file holds the redlining data and nothing else, and nothing from it goes into
any other published file: no parcel, dossier, table or download carries a grade. The manifest
lists the file with its license (`license` in `files`), so anyone reusing the published data can
tell it is not under our own terms.

Properties: `l`, the area's label on the 1937 map (such as "C12"), and `g`, its grade from A to D,
absent for the one area the map left ungraded. The 1937 area descriptions are never copied: the
map links to them at Mapping Inequality, by the label.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

from placekeepers.adapters.redlining import GRADES
from placekeepers.context import Context
from placekeepers.geo import GEOMETRY_COLUMN, GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder

log = logging.getLogger(__name__)

REDLINING_FILE = "tiles/redlining.pmtiles"
SOURCE_LAYER = "holc"
SOURCE = "mapping_inequality_1937"


def build_redlining(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths[SOURCE], columns=["label", "grade", GEOMETRY_COLUMN]).to_pylist()
    grades: Counter[str] = Counter()
    with GeoJSONWriter(out) as writer:
        for row in sorted(table, key=lambda r: (str(r["grade"] or "Z"), str(r["label"] or ""))):
            properties: dict[str, str] = {}
            label = (row["label"] or "").strip()
            if label:
                properties["l"] = label
            if row["grade"] in GRADES:
                properties["g"] = row["grade"]
            grades[row["grade"] or "ungraded"] += 1
            # Five decimals, about a meter: the 1937 map was traced by hand from a paper map.
            writer.write(properties, geometry_json(row[GEOMETRY_COLUMN], digits=5))
        count = writer.count
    summary = ", ".join(
        f"{grade} {grades[grade]}" for grade in (*GRADES, "ungraded") if grades[grade]
    )
    line = f"1937 redlining map (Mapping Inequality, non commercial): {count} areas ({summary})"
    log.info("publish: %s", line)
    return BuildResult(count, [line])


REDLINING_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(REDLINING_FILE, SOURCE_LAYER, (SOURCE,), build_redlining),
)
