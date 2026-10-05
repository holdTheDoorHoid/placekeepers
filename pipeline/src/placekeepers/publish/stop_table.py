"""`tables/stop_amenities.json` (docs/CONTRACTS.md section 8): what OpenStreetMap says at every bus
and trolley stop it knows in and around the city, keyed by the stop's OpenStreetMap id.

SEPTA's stops on the map (`o` in tiles/transit.pmtiles) and on the route survey sheets (`osm` in
tables/routes) link to it by that id, and the web app joins the two in the visitor's browser, so
OpenStreetMap's answers are never stored in the same published records as SEPTA's data (decision
D1 of docs/VERIFICATION_V0_2.md: the combination would be a derivative database the Open Database
License asks to be shared under it, which SEPTA's license does not let us grant). The file is
OpenStreetMap's data alone, under the Open Database License, credited "© OpenStreetMap
contributors", like tiles/amenities.pmtiles.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from placekeepers.cache import atomic_write_bytes
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.bus_stops import Stop, find_stops, stop_numbers
from placekeepers.health import SourceStatus
from placekeepers.publish.amenities import STOP_COLUMNS
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

STOP_TABLE = "tables/stop_amenities.json"
STOP_TABLE_SCHEMA = 1
#: The answers each stop of the table carries, as in the shelters and benches layer: shelter,
#: bench, waste basket, lit and covered. The transit comfort lens reads the shelter, bench, light
#: and roof; the route survey sheets show the shelter, bench, waste basket and light.
TABLE_ANSWERS = ("sh", "bn", "bi", "lt", "cv")
ODBL_CREDIT = "© OpenStreetMap contributors"
ODBL_LICENSE = "Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/"


@dataclass
class StopTableResult:
    stops: int = 0
    bytes: int = 0
    notes: list[str] = field(default_factory=list)


def stop_table_entry(stop: Stop) -> dict[str, Any]:
    """One stop of the table: what the map shows (`c`), its known answers, and the stop numbers
    it names in `ref` or `gtfs:stop_id` (`n`), so the browser can say whether they agree with
    SEPTA's."""
    props = stop.properties()
    entry: dict[str, Any] = {"c": props["c"]}
    entry.update({key: props[key] for key in TABLE_ANSWERS if key in props})
    numbers = stop_numbers(stop)
    if numbers:
        entry["n"] = numbers
    return entry


def build_stop_table(
    ctx: Context, statuses: dict[str, SourceStatus], out_dir: Path
) -> StopTableResult:
    """Writes tables/stop_amenities.json from the `osm_philadelphia` snapshot: every bus and
    trolley stop OpenStreetMap knows in and around the city (a SEPTA stop on the city line can
    stand on one just outside it), keyed by its OpenStreetMap id."""
    result = StopTableResult()
    status = statuses.get("osm_philadelphia")
    if status is None or status.snapshot is None:
        result.notes.append(
            "Stop answers table: OpenStreetMap's stops are missing, so there is none and every "
            "stop shows as not yet surveyed"
        )
        return result
    path = SnapshotStore(ctx.cache, "osm_philadelphia").path_for(status.snapshot)
    table = pq.read_table(path, columns=STOP_COLUMNS)
    stops, _ = find_stops(table)
    days = [d for d in table.column("extract_date").to_pylist() if d is not None]
    document = {
        "schema": STOP_TABLE_SCHEMA,
        "generated_at": iso_z(ctx.now()),
        "as_of": {"osm": max(days).isoformat() if days else None},
        "credit": ODBL_CREDIT,
        "license": ODBL_LICENSE,
        "stops": {stop.id: stop_table_entry(stop) for stop in stops},
    }
    target = out_dir / STOP_TABLE
    target.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(document, ensure_ascii=False, separators=(",", ":")) + "\n"
    atomic_write_bytes(target, text.encode("utf-8"))
    result.stops = len(stops)
    result.bytes = target.stat().st_size
    result.notes.append(
        f"Stop answers table: {result.stops:,} OpenStreetMap stops in and around the city, "
        f"{result.bytes / 1000:,.0f} kB, under the Open Database License"
    )
    log.info("publish: %s", result.notes[-1])
    return result
