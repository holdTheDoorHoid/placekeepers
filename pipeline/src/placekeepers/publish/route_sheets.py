"""Route survey sheets (M2.4): `tables/routes/<route>.json` and `tables/routes/index.json`
(docs/CONTRACTS.md section 7).

For every SEPTA bus and trolley route that stops in Philadelphia, each direction's stops in
Philadelphia in SEPTA's own order (`stop_order` of the `septa_gtfs` snapshot, from
placekeepers.derive.route_stops), each with the id of the OpenStreetMap stop that is the same pole
(`osm`, placekeepers.derive.bus_stops.match_septa). What OpenStreetMap says there is not stored in
these files: the web page `survey/` joins it from tables/stop_amenities.json by that id, so
OpenStreetMap's answers are never published in the same records as SEPTA's data (decision D1 of
docs/VERIFICATION_V0_2.md). The page turns a route's file into a printable survey sheet.

"In Philadelphia" is SEPTA's own rule for its stops layer: inside the City Council districts
widened by 100 meters (placekeepers.publish.transit.city_shape).
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from placekeepers.cache import atomic_write_bytes
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.bus_stops import (
    BENCH,
    NEITHER,
    SHELTER,
    UNKNOWN,
    SeptaPoint,
    find_stops,
    match_septa,
)
from placekeepers.derive.street_safety import points_in_meters
from placekeepers.derive.transit import MODE_BUS, MODE_TROLLEY
from placekeepers.health import SourceStatus
from placekeepers.publish.amenities import STOP_COLUMNS as OSM_COLUMNS
from placekeepers.publish.layers import plain_name
from placekeepers.publish.transit import CITY_SOURCES, GTFS, city_shape, display_name, in_city
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

ROUTES_DIR = "tables/routes"
INDEX = f"{ROUTES_DIR}/index.json"
SCHEMA = 1
OSM = "osm_philadelphia"
#: The credit and license lines of every route file and the index (finding F7): the files hold
#: SEPTA's stops and their order, and OpenStreetMap ids that link to tables/stop_amenities.json.
CREDIT = "Stops and their order: SEPTA. Each osm id links to tables/stop_amenities.json."
LICENSE_SOURCE = "septa_gtfs"
SAFE_NAME = re.compile(r"^[A-Za-z0-9_-]{1,40}$")

STOP_COLUMNS = [
    "kind",
    "feed",
    "key",
    "stop_id",
    "stop_name",
    "lat",
    "lng",
    "modes",
    "former_ids",
    "feed_version",
]
ROUTE_COLUMNS = [
    "kind",
    "feed",
    "route_id",
    "route_name",
    "route_long_name",
    "modes",
    "stop_order",
]
#: The feed with SEPTA's buses, trolleys and Metro (placekeepers.adapters.septa); only it lists
#: each route's stops in order.
BUS_FEED = "bus_metro"


@dataclass
class RouteSheetsResult:
    routes: int = 0
    files: int = 0
    bytes: int = 0
    notes: list[str] = field(default_factory=list)


def write_compact(path: Path, value: Any) -> None:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    atomic_write_bytes(path, text.encode("utf-8"))


def route_file(route_id: str) -> str | None:
    """The route's file under the data root, or None for an id that cannot be a file name."""
    return f"{ROUTES_DIR}/{route_id}.json" if SAFE_NAME.match(route_id) else None


def _current(ctx: Context, statuses: dict[str, SourceStatus], source: str) -> Path | None:
    status = statuses.get(source)
    if status is None or status.snapshot is None:
        return None
    return SnapshotStore(ctx.cache, source).path_for(status.snapshot)


def _columns(path: Path, wanted: list[str]) -> list[str]:
    present = set(pq.read_schema(path).names)
    return [c for c in wanted if c in present]


def meters_along(points: list[tuple[float, float]]) -> int:
    """Straight lines from each stop to the next, added up, in whole meters."""
    if len(points) < 2:
        return 0
    projected = points_in_meters([lat for lat, _ in points], [lng for _, lng in points])
    return round(sum(float(a.distance(b)) for a, b in zip(projected, projected[1:], strict=False)))


def _license_line(ctx: Context) -> str:
    """SEPTA's license, from the registry: its name and address."""
    source = ctx.registry.sources[LICENSE_SOURCE]
    license_ = ctx.registry.licenses[source.license]
    return f"{license_.label}, {license_.url}"


def _index_direction(direction: dict[str, Any]) -> dict[str, Any]:
    entry = {
        "d": direction["d"],
        "dir": direction.get("dir"),
        "to": direction.get("to"),
        "n": len(direction["stops"]),
    }
    return {k: v for k, v in entry.items() if v is not None}


def build_route_sheets(
    ctx: Context, statuses: dict[str, SourceStatus], out_dir: Path, as_of: date
) -> RouteSheetsResult:
    result = RouteSheetsResult()
    gtfs = _current(ctx, statuses, GTFS)
    if gtfs is None:
        result.notes.append("Route survey sheets: SEPTA's schedules are missing")
        return result
    routes = []
    if "stop_order" in pq.read_schema(gtfs).names:
        routes = [
            row
            for row in pq.read_table(gtfs, columns=_columns(gtfs, ROUTE_COLUMNS)).to_pylist()
            if row["kind"] == "route"
            and row.get("feed") == BUS_FEED
            and (row.get("modes") or 0) & (MODE_BUS | MODE_TROLLEY)
            and row.get("stop_order")
        ]
    if not routes:
        result.notes.append(
            "Route survey sheets: SEPTA's schedules have no stop order (route_stops.txt), so "
            "there are none"
        )
        return result
    rows = pq.read_table(gtfs, columns=_columns(gtfs, STOP_COLUMNS)).to_pylist()
    # Every stop of the feed, the ends of the line too: a stop where trips only end has no
    # departures, but riders still wait or get off there.
    septa = {
        row["stop_id"]: row for row in rows if row["kind"] == "stop" and row.get("feed") == BUS_FEED
    }
    city_paths = {s: p for s in CITY_SOURCES if (p := _current(ctx, statuses, s)) is not None}
    shape, _ = city_shape(city_paths)
    ids = list(septa)
    inside = dict(
        zip(
            ids,
            in_city([septa[i]["lat"] for i in ids], [septa[i]["lng"] for i in ids], shape),
            strict=True,
        )
    )
    if shape is None:
        result.notes.append(
            "Route survey sheets: the City Council districts are missing, so a box around the "
            "city was used"
        )

    # The OpenStreetMap stop at each SEPTA stop on a sheet, and what the map shows there.
    known: dict[str, dict[str, Any]] = {}
    kinds: dict[str, int] = {}
    osm_day: str | None = None
    osm_path = _current(ctx, statuses, OSM)
    on_sheets = {
        stop_id
        for route in routes
        for direction in route["stop_order"]
        for stop_id in direction.get("stop_ids") or []
        if stop_id in septa
    }
    if osm_path is None:
        result.notes.append(
            "Route survey sheets: OpenStreetMap's stops are missing, so no stop has an answer"
        )
    else:
        table = pq.read_table(osm_path, columns=OSM_COLUMNS)
        days = [d for d in table.column("extract_date").to_pylist() if d is not None]
        osm_day = max(days).isoformat() if days else None
        osm_stops, _ = find_stops(table)
        wanted = sorted(on_sheets)
        points = [
            SeptaPoint(
                stop_id=i,
                former_ids=tuple(str(x) for x in (septa[i].get("former_ids") or [])),
                lat=septa[i]["lat"],
                lng=septa[i]["lng"],
            )
            for i in wanted
        ]
        for s, o in match_septa(osm_stops, points).items():
            # Only the link is stored; the kind is kept for the build note's counts.
            known[wanted[s]] = {"osm": osm_stops[o].id}
            kinds[wanted[s]] = osm_stops[o].c

    version = next((row["feed_version"] for row in septa.values() if row.get("feed_version")), None)
    as_of_block = {"schedules": version, "osm": osm_day}
    license_line = _license_line(ctx)
    generated = iso_z(ctx.now())
    index: list[dict[str, Any]] = []
    totals: Counter = Counter()
    for route in routes:
        name = route_file(route["route_id"])
        if name is None:
            result.notes.append(
                f"Route survey sheets: route id {route['route_id']!r} cannot be a file name"
            )
            continue
        directions = []
        summary: Counter = Counter()
        for direction in sorted(route["stop_order"], key=lambda d: d.get("direction_id") or 0):
            listed = [i for i in direction.get("stop_ids") or [] if i in septa]
            here = [i for i in listed if inside.get(i)]
            if not here:
                continue
            stops = []
            for stop_id in here:
                row = septa[stop_id]
                stop = {
                    "k": row["key"],
                    "sid": stop_id,
                    "nm": display_name(row["stop_name"]),
                    "lat": round(row["lat"], 6),
                    "lng": round(row["lng"], 6),
                }
                stop.update(known.get(stop_id, {}))
                summary[kinds.get(stop_id, "none")] += 1
                stops.append(stop)
            destination = direction.get("destination")
            entry = {
                "d": int(direction.get("direction_id") or 0),
                "dir": direction.get("direction"),
                "to": plain_name(destination) if destination else None,
                "m": meters_along([(s["lat"], s["lng"]) for s in stops]),
                "out": len(listed) - len(here),
                "stops": stops,
            }
            directions.append({k: v for k, v in entry.items() if v is not None})
        if not directions:
            continue
        sheet = {
            "schema": SCHEMA,
            "generated_at": generated,
            "as_of": as_of_block,
            "credit": CREDIT,
            "license": license_line,
            "id": route["route_id"],
            "r": route["route_name"],
            "nm": str(plain_name(route.get("route_long_name") or "")),
            "md": int(route.get("modes") or 0),
            "directions": directions,
        }
        path = out_dir / name
        write_compact(path, sheet)
        result.files += 1
        result.bytes += path.stat().st_size
        totals.update(summary)
        index.append(
            {
                "id": route["route_id"],
                "r": route["route_name"],
                "nm": sheet["nm"],
                "md": sheet["md"],
                "file": name,
                "dirs": [_index_direction(d) for d in directions],
            }
        )
    result.routes = len(index)
    if not index:
        result.notes.append("Route survey sheets: no bus or trolley route stops in Philadelphia")
        return result
    write_compact(
        out_dir / INDEX,
        {
            "schema": SCHEMA,
            "generated_at": generated,
            "as_of": as_of_block,
            "credit": CREDIT,
            "license": license_line,
            "routes": index,
        },
    )
    stops = sum(totals.values())
    in_osm = stops - totals.get("none", 0)
    result.notes.append(
        f"Route survey sheets: {result.routes} SEPTA bus and trolley routes with {stops:,} stops "
        f"in Philadelphia, counting a stop once for each route and direction; {in_osm:,} of them "
        f"match a stop in OpenStreetMap ({totals.get(SHELTER, 0):,} with a shelter or roof, "
        f"{totals.get(BENCH, 0):,} with a bench but no shelter, {totals.get(NEITHER, 0):,} with "
        f"neither, {totals.get(UNKNOWN, 0):,} not yet surveyed)"
    )
    log.info("publish: %s", result.notes[-1])
    return result


def sheet_text(path: Path) -> dict[str, Any]:
    """A route file, read back (for tests and checks)."""
    return json.loads(path.read_text(encoding="utf-8"))
