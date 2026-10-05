"""The transit layers of tiles/transit.pmtiles (docs/CONTRACTS.md section 4): SEPTA's stops with
how often service comes and how many people board, and its routes as context.

* `stops`: every SEPTA boarding place in Philadelphia with service on a typical weekday,
  Saturday or Sunday (bus, trolley, subway and El platforms, Regional Rail stations), from the
  `septa_gtfs` snapshot, with SEPTA's average weekday boardings where a count matches the stop
  (placekeepers.derive.transit.match_counts). A stop with no matching count gets no boardings,
  never an estimate. Bus and trolley stops also get what riders find there from OpenStreetMap,
  the transit comfort lens factors and their suggestions (placekeepers.derive.transit_comfort,
  M2.3).
* `routes`: every route that stops in Philadelphia, as the lines its trips follow, cut to a
  generous box around the city.

"In Philadelphia" means inside the City Council districts, widened by CITY_MARGIN_METERS so the
stops on boundary streets (City Avenue, Cheltenham Avenue) are kept; without that snapshot, a box
around the city is used and the build notes say so.
"""

from __future__ import annotations

import logging
from datetime import date
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.derive.street_safety import PHILLY_LAT, PHILLY_LNG, plural, to_meters
from placekeepers.derive.transit import (
    MIDDAY_MINUTES,
    MODE_BUS,
    MODE_TROLLEY,
    PEAK_MINUTES,
    Place,
    match_counts,
    split_side,
    sum_counts,
)
from placekeepers.derive.transit_comfort import SOURCES as COMFORT_SOURCES
from placekeepers.derive.transit_comfort import SeptaStop, comfort_for_stops
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder, plain_name

log = logging.getLogger(__name__)

TRANSIT_FILE = "tiles/transit.pmtiles"
GTFS = "septa_gtfs"
RIDERSHIP = ("septa_ridership_bus", "septa_ridership_trolley")
#: The snapshot that gives the city's shape.
CITY_SOURCES = ("council_districts",)
CITY_MARGIN_METERS = 100.0

#: SEPTA's codes for where a stop stands at a corner, in words.
SIDES = {
    "FS": "far side",
    "NS": "near side",
    "MBFS": "midblock, far side",
    "MBNS": "midblock, near side",
    "MB": "midblock",
}

STOP_COLUMNS = [
    "kind",
    "feed",
    "key",
    "stop_id",
    "stop_name",
    "lat",
    "lng",
    "wheelchair",
    "modes",
    "routes",
    "trips_wk",
    "trips_sa",
    "trips_su",
    "first_wk",
    "last_wk",
    "busiest_wk",
    "peak_wk",
    "midday_wk",
    "midday_sa",
    "midday_su",
    "evening_wk",
    "night_wk",
    "former_ids",
    "weekday_date",
    "saturday_date",
    "sunday_date",
    "feed_version",
]
ROUTE_COLUMNS = [
    "kind",
    "route_id",
    "route_name",
    "route_long_name",
    "modes",
    "trips_wk",
    "peak_wk",
    "midday_wk",
    "geometry",
]
RIDERSHIP_COLUMNS = ["stop_code", "stop", "lat", "lon", "wk_ons", "sat_ons", "sun_ons", "sign_up"]


def display_name(name: str | None) -> str:
    """A stop name for people: 'Broad St & Erie Av - FS' as 'Broad St & Erie Av (far side)',
    and any other dash used as punctuation as a comma ('15th St/City Hall, B1')."""
    main, side = split_side(name or "")
    text = str(plain_name(main))
    if side:
        words = SIDES.get(side.split()[-1])
        if words:
            text = f"{text} ({words})"
    return text


def headway(departures: int | None, minutes: int) -> int | None:
    """The typical wait between departures in a window, in whole minutes, or None when nothing
    departs in it."""
    if not departures:
        return None
    return max(1, round(minutes / departures))


def city_shape(paths: dict[str, Path]) -> tuple[object | None, str | None]:
    """Philadelphia in meters, widened by CITY_MARGIN_METERS, and the source it came from."""
    for source in CITY_SOURCES:
        if source not in paths:
            continue
        table = pq.read_table(paths[source], columns=["geometry"])
        shapes = [shapely.from_wkb(w) for w in table.column("geometry").to_pylist() if w]
        if not shapes:
            continue
        union = shapely.union_all(to_meters(np.array(shapes, dtype=object)))
        return shapely.buffer(union, CITY_MARGIN_METERS), source
    return None, None


def in_city(lats: list[float], lngs: list[float], shape: object | None) -> list[bool]:
    if shape is None:
        return [
            PHILLY_LAT[0] <= lat <= PHILLY_LAT[1] and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]
            for lat, lng in zip(lats, lngs, strict=True)
        ]
    from placekeepers.derive.street_safety import points_in_meters

    points = points_in_meters(lats, lngs)
    shapely.prepare(shape)
    return [bool(flag) for flag in shapely.contains(shape, points)]


def _stops(paths: dict[str, Path]) -> list[dict]:
    table = pq.read_table(paths[GTFS])
    present = [c for c in STOP_COLUMNS if c in table.column_names]
    rows = table.select(present).to_pylist()
    return [
        row
        for row in rows
        if row["kind"] == "stop"
        and ((row.get("trips_wk") or 0) + (row.get("trips_sa") or 0) + (row.get("trips_su") or 0))
    ]


def stop_properties(row: dict, count=None, match=None) -> dict:
    """The tile properties of one stop (docs/CONTRACTS.md section 4, `stops`)."""
    properties: dict = {
        "id": row["key"],
        "sid": row["stop_id"],
        "nm": display_name(row["stop_name"]),
        "md": int(row.get("modes") or 0),
        "r": row.get("routes") or "",
        "tw": int(row.get("trips_wk") or 0),
        "ts": int(row.get("trips_sa") or 0),
        "tu": int(row.get("trips_su") or 0),
    }
    optional = {
        "bh": row.get("busiest_wk") or None,
        "hp": headway(row.get("peak_wk"), PEAK_MINUTES),
        "hm": headway(row.get("midday_wk"), MIDDAY_MINUTES),
        "hs": headway(row.get("midday_sa"), MIDDAY_MINUTES),
        "hu": headway(row.get("midday_su"), MIDDAY_MINUTES),
        "ft": row.get("first_wk") if row.get("trips_wk") else None,
        "lt": row.get("last_wk") if row.get("trips_wk") else None,
        "ev": row.get("evening_wk") if row.get("trips_wk") else None,
        "nt": row.get("night_wk") or None,
        "wc": row.get("wheelchair") if row.get("wheelchair") in (1, 2) else None,
    }
    properties.update({key: int(value) for key, value in optional.items() if value is not None})
    former = [str(i) for i in (row.get("former_ids") or [])]
    if former:
        properties["fid"] = ",".join(former)
    if count is not None:
        properties["b"] = int(count.weekday)
        properties["bp"] = " and ".join(sorted(count.periods)) if count.periods else ""
        if match is not None and match.code != row["stop_id"]:
            properties["bx"] = match.code
    return properties


def build_transit_stops(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    notes: list[str] = []
    if GTFS not in paths:
        with GeoJSONWriter(out):
            pass
        return BuildResult(0, ["stops: SEPTA's schedules are missing"])
    rows = _stops(paths)
    shape, used = city_shape(paths)
    if shape is None:
        notes.append(
            "stops: the City Council districts are missing, so a box around the city was used"
        )
    inside = in_city([r["lat"] for r in rows], [r["lng"] for r in rows], shape)
    rows = [row for row, keep in zip(rows, inside, strict=True) if keep]

    counts = {}
    for source in RIDERSHIP:
        if source in paths:
            table = pq.read_table(paths[source])
            present = [c for c in RIDERSHIP_COLUMNS if c in table.column_names]
            for code, count in sum_counts(table.select(present).to_pylist()).items():
                if code in counts:  # a stop shared by buses and trolleys: add both counts
                    counts[code].weekday += count.weekday
                    counts[code].saturday += count.saturday
                    counts[code].sunday += count.sunday
                    counts[code].periods |= count.periods
                else:
                    counts[code] = count
    if not counts:
        notes.append("stops: SEPTA's ridership counts are missing, so stops have no boardings")
    surface = [
        i for i, row in enumerate(rows) if (row.get("modes") or 0) & (MODE_BUS | MODE_TROLLEY)
    ]
    candidates = [
        (
            rows[i]["stop_id"],
            [str(x) for x in (rows[i].get("former_ids") or [])],
            Place(rows[i]["stop_id"], rows[i]["stop_name"] or "", rows[i]["lat"], rows[i]["lng"]),
        )
        for i in surface
    ]
    # Every stop id in today's schedules, in the city or not: a count under one of them belongs
    # to that stop, never to a neighbor. Retired ids are not among them.
    today = pq.read_table(paths[GTFS], columns=["kind", "stop_id"]).to_pylist()
    known = {row["stop_id"] for row in today if row["kind"] == "stop" and row["stop_id"]}
    matches = match_counts(candidates, counts, known)
    by_row = {surface[index]: match for index, match in matches.items()}

    # The transit comfort lens and the suggestions, for bus and trolley stops (M2.3).
    comfort = comfort_for_stops(
        [SeptaStop(sid, tuple(former), place.lat, place.lng) for sid, former, place in candidates],
        [counts[by_row[i].code].weekday if i in by_row else None for i in surface],
        [headway(rows[i].get("midday_wk"), MIDDAY_MINUTES) for i in surface],
        paths,
        set(ctx.registry.suggestions),
    )
    extra = {surface[index]: props for index, props in enumerate(comfort.properties)}

    with GeoJSONWriter(out) as writer:
        order = sorted(range(len(rows)), key=lambda i: rows[i]["key"])
        for index in order:
            row = rows[index]
            match = by_row.get(index)
            count = counts.get(match.code) if match else None
            point = {"type": "Point", "coordinates": [round(row["lng"], 6), round(row["lat"], 6)]}
            writer.write({**stop_properties(row, count, match), **extra.get(index, {})}, point)

    if rows:
        # The typical days of the bus and Metro schedules (Regional Rail's may differ).
        sample = next((row for row in rows if row.get("feed") == "bus_metro"), rows[0])
        days = ", ".join(
            f"{label} {sample[f'{kind}_date'].isoformat()}"
            for kind, label in (
                ("weekday", "weekday"),
                ("saturday", "Saturday"),
                ("sunday", "Sunday"),
            )
            if sample.get(f"{kind}_date")
        )
        notes.append(
            f"stops: {writer.count:,} SEPTA stops and stations in Philadelphia with service "
            f"(schedules {sample.get('feed_version') or ''}; the typical days of the bus and "
            f"Metro schedules: {days})"
        )
    if surface and counts:
        how = {
            kind: sum(1 for m in matches.values() if m.how == kind)
            for kind in ("id", "former", "nearby")
        }
        share = 100 * len(matches) / len(surface)
        periods = sorted({p for c in counts.values() for p in c.periods})
        notes.append(
            f"stops: {len(matches):,} of {len(surface):,} bus and trolley stops ({share:.1f}%) "
            f"have a SEPTA boarding count ({', '.join(periods)}): {how['id']:,} under their own "
            f"stop number, {how['former']:,} under a number they had before, "
            f"{plural(how['nearby'], 'from a retired stop', 'from retired stops')} within 30 "
            "meters with a similar name; the rest have none"
        )
    notes.extend(comfort.notes)
    if used:
        log.info("transit: Philadelphia from %s", used)
    return BuildResult(writer.count, notes)


def build_transit_routes(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    table = pq.read_table(paths[GTFS])
    present = [c for c in ROUTE_COLUMNS if c in table.column_names]
    routes = [row for row in table.select(present).to_pylist() if row["kind"] == "route"]
    stops = _stops(paths)
    shape, _ = city_shape(paths)
    inside = in_city([r["lat"] for r in stops], [r["lng"] for r in stops], shape)
    served = {
        name
        for row, keep in zip(stops, inside, strict=True)
        if keep
        for name in (row.get("routes") or "").split(",")
        if name
    }
    box = (PHILLY_LNG[0], PHILLY_LAT[0], PHILLY_LNG[1], PHILLY_LAT[1])
    with GeoJSONWriter(out) as writer:
        for row in routes:
            if row["route_name"] not in served or not row.get("geometry"):
                continue
            lines = shapely.clip_by_rect(shapely.from_wkb(row["geometry"]), *box)
            if lines.is_empty:
                continue
            properties = {
                "id": row["route_id"],
                "r": row["route_name"],
                "nm": str(plain_name(row.get("route_long_name") or "")),
                "md": int(row.get("modes") or 0),
                "tw": int(row.get("trips_wk") or 0),
            }
            for key, value in (
                ("hp", headway(row.get("peak_wk"), PEAK_MINUTES)),
                ("hm", headway(row.get("midday_wk"), MIDDAY_MINUTES)),
            ):
                if value is not None:
                    properties[key] = value
            writer.write(properties, geometry_json(lines, 6))
    return BuildResult(writer.count, [f"routes: {writer.count} SEPTA routes stop in Philadelphia"])


TRANSIT_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        TRANSIT_FILE,
        "stops",
        (GTFS,),
        build_transit_stops,
        # Ridership, the city's shape, and what the transit comfort lens reads (M2.3).
        extras=tuple(dict.fromkeys((*RIDERSHIP, *CITY_SOURCES, *COMFORT_SOURCES))),
    ),
    LayerBuilder(TRANSIT_FILE, "routes", (GTFS,), build_transit_routes, extras=CITY_SOURCES),
)
