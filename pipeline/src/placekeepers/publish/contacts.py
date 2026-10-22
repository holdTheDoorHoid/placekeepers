"""Who represents each lot (M5.1, issue #45): `tables/contacts.json` and each dossier's
`represent` (docs/CONTRACTS.md sections 2 and 6).

`tables/contacts.json` holds, once, the people and organizations the lot pages and packets name:
the City Council member of each district and the members at large, the state House and Senate
members and the member of Congress for every district a lot on our list lies in, and every
Registered Community Organization covering one, each with its official contact details, the
source and the day that source was last checked. A dossier's `represent` names the districts and
organizations by number, so a seat that changes hands changes in this one file
(placekeepers.derive.represent).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from placekeepers.config import iso_z, local_date, parse_iso_z
from placekeepers.context import Context
from placekeepers.derive.represent import (
    DISTRICT_SOURCES,
    RCO_SOURCE,
    Shapes,
    assembly_seats,
    congress_seats,
    council_seats,
    parcel_represent,
    rco_contacts,
    read_shapes,
    vacant_seats,
)
from placekeepers.health import SourceStatus
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

SCHEMA = 1
CONTACTS_TABLE = "tables/contacts.json"
#: Every source the contacts and the `represent` of each dossier draw on.
SOURCES = (
    *(source for source, _ in DISTRICT_SOURCES.values()),
    RCO_SOURCE,
    "city_elected_officials",
    "pa_legislators",
    "us_legislators",
    "us_legislator_offices",
)


@dataclass
class ContactsResult:
    written: bool = False
    bytes: int = 0
    counts: dict[str, int] = field(default_factory=dict)
    vacant: dict[str, list[str]] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)


def _paths(ctx: Context, statuses: dict[str, SourceStatus]) -> dict[str, Path]:
    paths = {}
    for source_id in SOURCES:
        status = statuses.get(source_id)
        if status is not None and status.snapshot is not None:
            paths[source_id] = SnapshotStore(ctx.cache, source_id).path_for(status.snapshot)
    return paths


def checked_day(status: SourceStatus | None) -> str | None:
    """The day, in Philadelphia, a source's copy in use was fetched: when it was last checked."""
    if status is None or status.snapshot is None:
        return None
    return local_date(parse_iso_z(status.snapshot.fetched_at)).isoformat()


def represent_for(
    ctx: Context, statuses: dict[str, SourceStatus], points: dict[str, tuple[float, float]]
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    """Each parcel's `represent`, and the district kinds whose shapes this build lacks (a lot page
    then says it could not check them)."""
    paths = _paths(ctx, statuses)
    shapes: dict[str, Shapes] = {}
    missing = []
    for kind, (source_id, column) in DISTRICT_SOURCES.items():
        found = read_shapes(paths[source_id], column) if source_id in paths else None
        if found is None:
            missing.append(kind)
        else:
            shapes[kind] = found
    rcos = read_shapes(paths[RCO_SOURCE], "lni_id") if RCO_SOURCE in paths else None
    if rcos is None:
        missing.append("rcos")
    if not shapes and rcos is None:
        return {}, missing
    return parcel_represent(points, shapes, rcos), missing


def used_districts(represent: dict[str, dict[str, Any]]) -> dict[str, set[str]]:
    """The districts and organizations some parcel lies in, by kind."""
    used: dict[str, set[str]] = {
        kind: set() for kind in ("council", "house", "senate", "congress", "rcos")
    }
    for entry in represent.values():
        for kind in ("council", "house", "senate", "congress"):
            if kind in entry:
                used[kind].add(entry[kind])
        for rco in entry.get("rcos", []):
            used["rcos"].add(str(rco))
    return used


def _rows(path: Path) -> list[dict[str, Any]]:
    return (
        pq.read_table(path)
        .drop_columns([name for name in ("geometry",) if name in pq.read_schema(path).names])
        .to_pylist()
    )


def build_contacts(
    ctx: Context,
    statuses: dict[str, SourceStatus],
    out_root: Path,
    used: dict[str, set[str]] | None,
    as_of: date,
) -> ContactsResult:
    """Write tables/contacts.json under `out_root`. `used` limits the seats and organizations to
    those some lot lies in; None keeps every one the sources hold."""
    result = ContactsResult()
    paths = _paths(ctx, statuses)
    body: dict[str, Any] = {"schema": SCHEMA, "generated_at": iso_z(ctx.now())}
    seats: dict[str, dict[str, Any]] = {}
    if "city_elected_officials" in paths:
        council, at_large = council_seats(
            _rows(paths["city_elected_officials"]),
            checked_day(statuses["city_elected_officials"]) or as_of.isoformat(),
        )
        seats["council"] = council
        body["council"] = council
        body["council_at_large"] = at_large
    if "pa_legislators" in paths:
        found = assembly_seats(
            _rows(paths["pa_legislators"]),
            checked_day(statuses["pa_legislators"]) or as_of.isoformat(),
        )
        seats |= found
        body["house"] = found["house"]
        body["senate"] = found["senate"]
    if "us_legislators" in paths:
        offices = _rows(paths["us_legislator_offices"]) if "us_legislator_offices" in paths else []
        found_congress = congress_seats(
            _rows(paths["us_legislators"]),
            offices,
            checked_day(statuses["us_legislators"]) or as_of.isoformat(),
        )
        seats["congress"] = found_congress
        body["congress"] = found_congress
    if RCO_SOURCE in paths:
        body["rcos"] = rco_contacts(
            _rows(paths[RCO_SOURCE]), checked_day(statuses[RCO_SOURCE]) or as_of.isoformat()
        )
    if len(body) == 2:
        result.notes.append(
            "who represents each lot has no officeholder or organization sources yet"
        )
        return result
    if used is not None:
        for kind in ("council", "house", "senate", "congress"):
            if kind in body:
                body[kind] = {d: seat for d, seat in body[kind].items() if d in used[kind]}
        if "rcos" in body:
            body["rcos"] = {
                key: entry for key, entry in body["rcos"].items() if key in used["rcos"]
            }
        result.vacant = vacant_seats(
            {k: v for k, v in used.items() if k != "rcos" and k in seats}, seats
        )
        if result.vacant:
            body["vacant"] = result.vacant
    for kind in ("council", "council_at_large", "house", "senate", "congress", "rcos"):
        if kind in body:
            result.counts[kind] = len(body[kind])
    target = out_root / CONTACTS_TABLE
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(body, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n"
    target.write_text(text, encoding="utf-8")
    result.written = True
    result.bytes = len(text.encode())
    counts = ", ".join(f"{kind} {n:,}" for kind, n in result.counts.items())
    result.notes.append(f"Who represents each lot: {counts} in {CONTACTS_TABLE}")
    for kind, districts in result.vacant.items():
        result.notes.append(f"no member is listed for {kind} district {', '.join(districts)}")
    log.info("contacts: %s (%.1f kB)", counts, result.bytes / 1e3)
    return result
