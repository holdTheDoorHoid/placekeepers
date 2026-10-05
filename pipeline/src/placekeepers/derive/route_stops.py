"""The stops of each SEPTA route in order, for the route survey sheets (M2.4).

SEPTA's schedules come with two files that are not standard GTFS:

* `route_stops.txt`: every stop of a route in order, for each direction (`route_id`,
  `direction_id`, `stop_id`, `route_stop_sort_order`);
* `directions.txt`: each direction's name and destination (`route_id`, `direction_id`,
  `direction` such as "Southbound", `direction_destination` such as "Whitman Plaza").

The order is kept as SEPTA publishes it, less the stops that no trip of that route and direction
serves in the feed (on 2026-10-05, 126 of SEPTA's 21,050 entries, mostly stops service no longer
reaches). Stops a trip serves that SEPTA's list leaves out (33 that day) are left out too: the list
gives them no place in the order. The notes count both. Without `route_stops.txt` no route has an
order and the survey sheets keep last week's copy of the schedules.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path

import pyarrow as pa

from placekeepers.derive.transit import read_table

#: The snapshot column (on `route` rows of `septa_gtfs`) holding each direction's stops in order.
STOP_ORDER_TYPE = pa.list_(
    pa.struct(
        [
            ("direction_id", pa.int8()),
            ("direction", pa.string()),
            ("destination", pa.string()),
            ("stop_ids", pa.list_(pa.string())),
        ]
    )
)


@dataclass
class Direction:
    direction_id: int
    #: SEPTA's name for the direction, such as "Southbound", when it gives one
    direction: str | None
    #: where the direction goes, such as "Whitman Plaza", when SEPTA says
    destination: str | None
    stop_ids: list[str] = field(default_factory=list)

    def row(self) -> dict:
        return asdict(self)


def _number(text: str | None) -> int | None:
    try:
        return int(str(text).strip())
    except (TypeError, ValueError):
        return None


def served_stops(con, folder: Path) -> set[tuple[str, int, str]]:
    """(route_id, direction_id, stop_id) for every stop a trip of the feed serves."""
    from placekeepers.sql import quote_literal

    trips = read_table(folder, "trips")
    table = pa.table(
        {
            "trip_id": pa.array([t["trip_id"] for t in trips], pa.string()),
            "route_id": pa.array([t["route_id"] for t in trips], pa.string()),
            "direction_id": pa.array([t.get("direction_id") or "" for t in trips], pa.string()),
        }
    )
    con.register("route_order_trips", table)
    try:
        rows = con.execute(
            f"""SELECT DISTINCT t.route_id, t.direction_id, s.stop_id
            FROM read_csv({quote_literal(str(folder / "stop_times.txt"))}, header = true,
                          all_varchar = true) s
            JOIN route_order_trips t ON t.trip_id = s.trip_id"""
        ).fetchall()
    finally:
        con.unregister("route_order_trips")
    found = set()
    for route_id, direction, stop_id in rows:
        number = _number(direction)
        if number is not None and stop_id:
            found.add((route_id, number, stop_id))
    return found


def read_route_order(con, folder: Path) -> tuple[dict[str, list[Direction]], list[str]]:
    """{route_id: its directions, each with its stops in SEPTA's order}, and plain notes.

    `con` is a DuckDB connection (stop_times.txt is read by DuckDB, the small files with the csv
    module)."""
    listed = read_table(folder, "route_stops", required=False)
    if not listed:
        return {}, ["The feed has no route_stops.txt, so routes have no stop order"]
    names = {
        (row.get("route_id"), _number(row.get("direction_id"))): row
        for row in read_table(folder, "directions", required=False)
    }
    served = served_stops(con, folder)
    entries: dict[tuple[str, int], list[tuple[int, str]]] = defaultdict(list)
    unserved = 0
    for row in listed:
        route_id, direction = row.get("route_id") or "", _number(row.get("direction_id"))
        order, stop_id = _number(row.get("route_stop_sort_order")), row.get("stop_id") or ""
        if not route_id or direction is None or order is None or not stop_id:
            continue
        if (route_id, direction, stop_id) not in served:
            unserved += 1
            continue
        entries[(route_id, direction)].append((order, stop_id))
    listed_keys = {
        (row.get("route_id") or "", _number(row.get("direction_id")), row.get("stop_id") or "")
        for row in listed
    }
    unlisted = sum(1 for key in served if key not in listed_keys)
    orders: dict[str, list[Direction]] = {}
    for (route_id, direction), items in sorted(entries.items()):
        info = names.get((route_id, direction), {})
        stop_ids: list[str] = []
        for _, stop_id in sorted(items):
            if stop_id not in stop_ids:
                stop_ids.append(stop_id)
        orders.setdefault(route_id, []).append(
            Direction(
                direction_id=direction,
                direction=(info.get("direction") or "").strip() or None,
                destination=(info.get("direction_destination") or "").strip() or None,
                stop_ids=stop_ids,
            )
        )
    notes = []
    if unserved:
        notes.append(
            f"{unserved:,} stops on SEPTA's route lists have no trip there and are left out"
        )
    if unlisted:
        notes.append(f"{unlisted:,} stops trips serve are missing from SEPTA's route lists")
    return orders, notes
