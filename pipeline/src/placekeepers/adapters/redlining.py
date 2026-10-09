"""Mapping Inequality's 1937 map of Philadelphia (owner, 2026-10-09).

The Home Owners' Loan Corporation graded the city's neighborhoods from A to D in 1937. Mapping
Inequality (University of Richmond, Digital Scholarship Lab) traced the map's areas and publishes
them under CC BY-NC 2.5, a non commercial license. The city's own GeoJSON file holds 83 areas with
their label (such as "C12"), grade and shape, and no area description text, which is a separate
download we never take.

Only the label, the grade and the shape are kept. The data stays apart from everything published
under our own terms: one file of its own, never in a download (publish/redlining.py and
docs/CONTRACTS.md). The file is frozen, so it is downloaded once.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import ClassVar

import pyarrow.parquet as pq

from placekeepers.adapters.url import UrlAdapter
from placekeepers.health import Check

#: The grades of the 1937 map, best to worst, as its own letters.
GRADES = ("A", "B", "C", "D")


class MappingInequality1937(UrlAdapter):
    keep_fields: ClassVar[list[str] | None] = ["area_id", "label", "grade"]
    required_columns: ClassVar[tuple[str, ...]] = ("area_id", "label", "grade")

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        grades = pq.read_table(path, columns=["grade"]).column("grade").to_pylist()
        odd = sorted({g for g in grades if g is not None and g not in GRADES})
        if odd:
            return [Check("grades", False, f"Grades other than A to D: {odd}")]
        return [Check("grades", True, f"{sum(g is not None for g in grades)} areas graded A to D")]
