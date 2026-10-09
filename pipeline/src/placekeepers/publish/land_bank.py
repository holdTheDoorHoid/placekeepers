"""`tables/land_bank.json` (docs/CONTRACTS.md section 9): the numbers of the page "The Land Bank in
numbers" (M4.4, issue #40). Aggregates only: counts, shares and medians by year, agency, buyer
type, program and council district, the City's own counts by program, and the weekly count of lots
listed as available. No names, no addresses and no parcel numbers (docs/ETHICS.md).

The rules live in placekeepers.derive.land_bank; this module reads the snapshots and writes the
file.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq
import shapely
from shapely.strtree import STRtree

from placekeepers.cache import atomic_write_bytes
from placekeepers.config import local_date, parse_iso_z
from placekeepers.context import Context
from placekeepers.derive import land_bank
from placekeepers.health import SourceStatus
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

LAND_BANK_TABLE = "tables/land_bank.json"
#: The day the City last edited its Land Management dashboard table (`land_conveyed_by_fy`), read
#: from the service on 2026-10-09 (`editingInfo.dataLastEditDate`). The source is frozen.
DASHBOARD_EDITED = "2023-04-11"
DEED_COLUMNS = [
    "document_id",
    "display_date",
    "kind",
    "agency",
    "to_agency",
    "buyer_type",
    "next_door",
    "follow_up",
    "property_count",
    "total_consideration",
    "adjusted_total_consideration",
    "geometry",
]


@dataclass
class LandBankResult:
    conveyances: int = 0
    bytes: int = 0
    notes: list[str] = field(default_factory=list)


def fiscal_year(day: date) -> int:
    """The City's fiscal year: July 1 to June 30, named for the year it ends."""
    return day.year + 1 if day.month >= 7 else day.year


def district_finder(ctx: Context, statuses: dict[str, SourceStatus]):
    """A function from a WKB point to its council district number (today's lines), or None."""
    status = statuses.get("council_districts")
    if status is None or status.snapshot is None:
        return None
    path = SnapshotStore(ctx.cache, "council_districts").path_for(status.snapshot)
    table = pq.read_table(path, columns=["district_num", "geometry"])
    numbers = [int(n) for n in table.column("district_num").to_pylist()]
    shapes = list(shapely.from_wkb(table.column("geometry").to_pylist()))
    tree = STRtree(shapes)

    def find(wkb: bytes | None) -> int | None:
        if wkb is None:
            return None
        point = shapely.from_wkb(wkb)
        if point is None or point.is_empty:
            return None
        for index in tree.query(point, predicate="intersects"):
            return numbers[int(index)]
        return None

    return find


def read_deeds(
    path: Path, find_district
) -> tuple[list[land_bank.Conveyed], list[tuple[int, str, str]], dict[str, Any]]:
    """The counted conveyances, the moves between agencies (year, from, to) and what was left
    out."""
    table = pq.read_table(path, columns=DEED_COLUMNS)
    data = {name: table.column(name).to_pylist() for name in DEED_COLUMNS}
    rows: list[land_bank.Conveyed] = []
    moves: list[tuple[int, str, str]] = []
    left = Counter()
    days = [d for d in data["display_date"] if d is not None]
    for i, kind in enumerate(data["kind"]):
        day = data["display_date"][i]
        if day is None:
            left["undated"] += 1
            continue
        if kind == "between":
            moves.append((day.year, data["agency"][i], data["to_agency"][i]))
            continue
        if kind != "conveyance":
            left[kind] += 1
            continue
        if data["follow_up"][i]:
            left["follow_up"] += 1
            continue
        rows.append(
            land_bank.Conveyed(
                year=day.year,
                agency=data["agency"][i],
                buyer=land_bank.buyer_group(data["buyer_type"][i] or "unknown"),
                program=land_bank.program_of(
                    data["buyer_type"][i], data["property_count"][i], data["next_door"][i]
                ),
                price=land_bank.deed_price(
                    data["adjusted_total_consideration"][i], data["total_consideration"][i]
                ),
                district=find_district(data["geometry"][i]) if find_district else None,
                document_id=int(data["document_id"][i] or 0),
                fy=fiscal_year(day),
            )
        )
    span = {
        "first": min(days).isoformat() if days else None,
        "last": max(days).isoformat() if days else None,
        "counted": len(rows),
        "follow_ups": left["follow_up"],
        "moved": len(moves),
        "agreements": left["agreement"],
        "other": left["other"],
    }
    return rows, moves, span


def programs_by_fy(
    ctx: Context, statuses: dict[str, SourceStatus], rows: list[land_bank.Conveyed]
) -> dict[str, Any] | None:
    """The City's own counts by program and fiscal year beside our inferred side yards in the same
    fiscal years, from the Land Bank alone and from all four agencies."""
    status = statuses.get("land_conveyed_by_fy")
    if status is None or status.snapshot is None:
        return None
    path = SnapshotStore(ctx.cache, "land_conveyed_by_fy").path_for(status.snapshot)
    city = land_bank.fy_program_rows(pq.read_table(path).to_pylist())
    inferred = Counter((row.fy, row.agency) for row in rows if row.program == "side_yard")
    for entry in city:
        entry["inferred_plb"] = inferred.get((entry["fy"], "PLB"), 0)
        entry["inferred_all"] = sum(n for (fy, _), n in inferred.items() if fy == entry["fy"])
    return {"edited": DASHBOARD_EDITED, "rows": city}


def listed_weeks(ctx: Context) -> list[dict[str, Any]]:
    """The weekly count of listed lots, after adding any snapshot of the City's list on this
    machine that the history does not hold yet."""
    folder = ctx.cache.snapshot_dir("city_owned_property")
    if not folder.is_dir():
        return []
    with ctx.cache.lock("city_owned_property"):
        history = land_bank.record_list_counts(folder)
    return land_bank.weekly_series(history)


def build_land_bank(
    ctx: Context, statuses: dict[str, SourceStatus], out_dir: Path, as_of: date
) -> LandBankResult:
    """Writes tables/land_bank.json from the `land_conveyances` snapshot (with the council
    districts, the City's dashboard table and the history of the City's list)."""
    result = LandBankResult()
    status = statuses.get("land_conveyances")
    if status is None or status.snapshot is None:
        result.notes.append(
            "The Land Bank in numbers: the deed records are missing, so there is no table yet"
        )
        return result
    path = SnapshotStore(ctx.cache, "land_conveyances").path_for(status.snapshot)
    find = district_finder(ctx, statuses)
    if find is None:
        result.notes.append(
            "The Land Bank in numbers: the council districts are missing, so no conveyance has "
            "a district"
        )
    rows, moves, span = read_deeds(path, find)
    last = date.fromisoformat(span["last"]) if span["last"] else as_of
    fetched = local_date(parse_iso_z(status.snapshot.fetched_at)).isoformat()
    weeks = listed_weeks(ctx)
    table = {
        "schema": land_bank.SCHEMA,
        "generated": as_of.isoformat(),
        "deeds": {
            **span,
            "fetched": fetched,
            "years": list(range(land_bank.FIRST_YEAR, last.year + 1)),
            "partial_year": last.year if (last.month, last.day) != (12, 31) else None,
            "nominal_max": land_bank.NOMINAL_MAX,
        },
        "agencies": land_bank.build_stats(rows, moves, last_year=last.year),
        "programs_fy": programs_by_fy(ctx, statuses, rows),
        "listed": {"weeks": weeks} if weeks else None,
    }
    target = out_dir / LAND_BANK_TABLE
    target.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(table, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    atomic_write_bytes(target, data)
    result.conveyances = len(rows)
    result.bytes = len(data)
    log.info(
        "publish: %s, %s conveyances counted from %s to %s (%.0f kB)",
        LAND_BANK_TABLE,
        f"{len(rows):,}",
        span["first"],
        span["last"],
        len(data) / 1e3,
    )
    if not weeks:
        result.notes.append(
            "The Land Bank in numbers: no snapshot of the City's list yet, so no weekly count"
        )
    return result
