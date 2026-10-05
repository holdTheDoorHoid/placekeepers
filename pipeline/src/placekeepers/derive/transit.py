"""Transit: service measures for every SEPTA stop from its schedules (GTFS), stable stop keys that
survive SEPTA renumbering stops, and stop ridership matched to today's stops.

The method is explained in plain words in docs/TRANSIT_METHOD.md. In short:

* **Typical days.** For each kind of day (a weekday, a Saturday, a Sunday) we look at every date of
  that kind in the four weeks from the download date, inside the dates the feed says it is good
  for, and pick the first date with the most common set of running services. Holidays and one off
  events run different services, so they are never the most common set.
* **Departures.** A trip departs a stop when it stops there, the stop is not the end of the trip,
  and boarding is allowed (`pickup_type` is not 1). Times are minutes after midnight of the
  service day, so 25:30 (1:30 at night) is 1530.
* **Measures per stop and day**: trips (departures), the first and last departure, departures in
  the busiest clock hour, in the morning peak (7 to 9), at midday (10 to 2), in the evening (from
  8 at night, until service ends), and how many of the clock hours from 1 to 4 at night have a
  departure (all three means service through the night). The map turns the peak and
  midday counts into a typical wait between departures: 120 or 240 minutes divided by the count.
* **Stable keys.** Each stop gets a Placekeepers key, `sp` and its SEPTA stop id when first seen
  (`sr` for Regional Rail). When a stop id disappears and a new one appears within
  LINK_METERS with a similar name, the new id takes over the old key, and the old id goes into
  the stop's history, so counts and notes keep following the place, not the number.
"""

from __future__ import annotations

import csv
import difflib
import re
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import shapely

#: Kinds of day, in order, with the suffix their columns carry in the snapshot.
DAYS = (("weekday", "wk"), ("saturday", "sa"), ("sunday", "su"))
WEEKDAY_NAMES = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
#: How far ahead of the download date typical days are looked for.
WINDOW_DAYS = 28

# Time windows, minutes after midnight of the service day.
PEAK = (7 * 60, 9 * 60)
MIDDAY = (10 * 60, 14 * 60)
EVENING_FROM = 20 * 60
#: Night, on the clock: the hours from 1 to 4 in the morning (a departure at 25:30 counts, as
#: 1:30). `night` counts how many of these three hours have a departure, so one late bus at 1:28
#: is 1, and service through the night is 3. Most routes start between 4 and 5.
NIGHT = (1 * 60, 4 * 60)
NIGHT_HOURS = (NIGHT[1] - NIGHT[0]) // 60
PEAK_MINUTES = PEAK[1] - PEAK[0]
MIDDAY_MINUTES = MIDDAY[1] - MIDDAY[0]

# Modes, as bits (docs/CONTRACTS.md, `stops.md`).
MODE_BUS, MODE_TROLLEY, MODE_METRO, MODE_RAIL = 1, 2, 4, 8
#: GTFS route_type to mode. 11 is a trolleybus: SEPTA's "trackless trolleys" (routes 59, 66 and 75)
#: stop at the curb like buses. Route type 1 is SEPTA Metro's subway and El (L1, B1 to B3, M1).
ROUTE_TYPE_MODES = {0: MODE_TROLLEY, 1: MODE_METRO, 2: MODE_RAIL, 3: MODE_BUS, 11: MODE_BUS}

#: A stop id that disappears is linked to a new one within this distance with a similar name.
LINK_METERS = 30.0
#: How similar two stop names must be (0 to 1, see name_similarity).
LINK_SIMILARITY = 0.75
#: Retired stops are remembered this long, so a stop that comes back keeps its key and a stop
#: that replaces it a little later can still be linked.
RETIRED_DAYS = 365


class GtfsError(RuntimeError):
    """The feed is missing something every GTFS feed must have."""


# ---------------------------------------------------------------------------------------------
# Reading a feed


def read_table(folder: Path, name: str, *, required: bool = True) -> list[dict[str, str]]:
    """Rows of a small GTFS file as dicts of text (blank values become empty strings)."""
    path = folder / f"{name}.txt"
    if not path.is_file():
        if required:
            raise GtfsError(f"The feed has no {name}.txt")
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return [
            {key.strip(): (value or "").strip() for key, value in row.items() if key}
            for row in csv.DictReader(handle)
        ]


def gtfs_date(text: str) -> date:
    return date(int(text[0:4]), int(text[4:6]), int(text[6:8]))


def gtfs_minutes(text: str | None) -> int | None:
    """'25:30:00' as 1530 minutes after midnight of the service day, or None when blank."""
    if not text:
        return None
    parts = text.strip().split(":")
    if len(parts) < 2 or not parts[0].isdigit() or not parts[1].isdigit():
        return None
    return int(parts[0]) * 60 + int(parts[1])


# ---------------------------------------------------------------------------------------------
# Calendar and typical days


@dataclass(frozen=True)
class Calendar:
    """When each service runs: calendar.txt weeks plus calendar_dates.txt exceptions."""

    weekly: tuple[tuple[str, frozenset[int], date, date], ...]
    added: dict[date, frozenset[str]]
    removed: dict[date, frozenset[str]]

    @classmethod
    def from_rows(
        cls, calendar: Iterable[dict[str, str]], calendar_dates: Iterable[dict[str, str]]
    ) -> Calendar:
        weekly = []
        for row in calendar:
            days = frozenset(i for i, name in enumerate(WEEKDAY_NAMES) if row.get(name) == "1")
            weekly.append(
                (row["service_id"], days, gtfs_date(row["start_date"]), gtfs_date(row["end_date"]))
            )
        added: dict[date, set[str]] = {}
        removed: dict[date, set[str]] = {}
        for row in calendar_dates:
            day = gtfs_date(row["date"])
            target = added if row.get("exception_type") == "1" else removed
            target.setdefault(day, set()).add(row["service_id"])
        return cls(
            tuple(weekly),
            {day: frozenset(ids) for day, ids in added.items()},
            {day: frozenset(ids) for day, ids in removed.items()},
        )

    def services_on(self, day: date) -> frozenset[str]:
        running = {
            service
            for service, days, start, end in self.weekly
            if day.weekday() in days and start <= day <= end
        }
        running |= self.added.get(day, frozenset())
        running -= self.removed.get(day, frozenset())
        return frozenset(running)

    def span(self) -> tuple[date, date] | None:
        days = [d for _, _, start, end in self.weekly for d in (start, end)]
        days += list(self.added) + list(self.removed)
        return (min(days), max(days)) if days else None


def day_kind(day: date) -> str:
    return "saturday" if day.weekday() == 5 else "sunday" if day.weekday() == 6 else "weekday"


@dataclass(frozen=True)
class TypicalDays:
    """The date chosen for each kind of day, and the services running on it."""

    dates: dict[str, date]
    services: dict[str, frozenset[str]]
    window: tuple[date, date]
    notes: tuple[str, ...] = ()


def typical_days(
    calendar: Calendar,
    start: date,
    feed_dates: tuple[date, date] | None,
    trips_per_service: dict[str, int] | None = None,
) -> TypicalDays:
    """For each kind of day, the first date in the WINDOW_DAYS from `start` (within the dates
    the feed is good for) whose set of running services is the most common for that kind of day.
    A set with no trips is never chosen while another has some."""
    notes: list[str] = []
    span = feed_dates or calendar.span()
    if span is None:
        raise GtfsError("The feed has no calendar")
    first, last = span
    window_start = max(start, first)
    window_end = min(start + timedelta(days=WINDOW_DAYS - 1), last)
    if window_start > window_end:
        # The feed's dates are over (or have not begun): use its last four weeks.
        window_end = last
        window_start = max(first, last - timedelta(days=WINDOW_DAYS - 1))
        notes.append(
            f"The schedule's dates ({first.isoformat()} to {last.isoformat()}) do not include "
            f"{start.isoformat()}, so its last four weeks were used"
        )

    def candidates(lo: date, hi: date) -> dict[str, list[date]]:
        found: dict[str, list[date]] = {kind: [] for kind, _ in DAYS}
        day = lo
        while day <= hi:
            found[day_kind(day)].append(day)
            day += timedelta(days=1)
        return found

    by_kind = candidates(window_start, window_end)
    dates: dict[str, date] = {}
    services: dict[str, frozenset[str]] = {}
    for kind, _ in DAYS:
        days = by_kind[kind] or candidates(first, last)[kind]
        if not days:
            notes.append(f"The schedule has no {kind}")
            continue
        sets = [calendar.services_on(day) for day in days]
        counts = Counter(sets)

        def trips(running: frozenset[str]) -> int:
            if trips_per_service is None:
                return len(running)
            return sum(trips_per_service.get(service, 0) for service in running)

        best = max(counts, key=lambda s: (trips(s) > 0, counts[s], -sets.index(s)))
        chosen = days[sets.index(best)]
        dates[kind] = chosen
        services[kind] = best
    return TypicalDays(dates, services, (window_start, window_end), tuple(notes))


# ---------------------------------------------------------------------------------------------
# Stop names and linking


_SIDE_OF_STREET = re.compile(r"^(\d+\s*)?(FS|NS|MBFS|MBNS|MB)$")
_WORDS = {
    "AVENUE": "AV",
    "AVE": "AV",
    "STREET": "ST",
    "STR": "ST",
    "BOULEVARD": "BLVD",
    "BL": "BLVD",
    "ROAD": "RD",
    "DRIVE": "DR",
    "LANE": "LN",
    "PLACE": "PL",
    "PARKWAY": "PKWY",
    "PIKE": "PK",
    "TERRACE": "TER",
    "NORTH": "N",
    "SOUTH": "S",
    "EAST": "E",
    "WEST": "W",
    "CENTER": "CTR",
    "TRANSPORTATION": "TRANSIT",
    "STATION": "STA",
    "SAINT": "ST",
}


def split_side(name: str) -> tuple[str, str | None]:
    """'Broad St & Erie Av - FS' as ('Broad St & Erie Av', 'FS'). SEPTA marks which side of the
    corner a stop is on: FS far side, NS near side, MBFS and MBNS midblock."""
    text = (name or "").strip()
    if " - " in text:
        main, tail = text.rsplit(" - ", 1)
        if _SIDE_OF_STREET.match(tail.strip().upper()):
            return main.strip(), tail.strip().upper()
    return text, None


def name_key(name: str) -> str:
    """A stop name evened out for comparison: capitals, no punctuation, common words shortened,
    side of the street and platform notes dropped, and the cross streets in a fixed order, so
    'Erie Av & Broad St - FS' and 'Broad St & Erie Ave' agree."""
    main = (name or "").split(" - ")[0].upper()
    main = main.replace(" AND ", " & ").replace("/", " & ").replace("+", " & ")
    parts = []
    for part in main.split("&"):
        words = re.sub(r"[^A-Z0-9 ]", " ", part.replace(".", "")).split()
        words = [_WORDS.get(word, word) for word in words]
        if words:
            parts.append(" ".join(words))
    return " & ".join(sorted(parts))


def name_similarity(a: str, b: str) -> float:
    """How alike two stop names are, from 0 to 1: the better of the character match and the
    shared share of words, after evening out both (name_key)."""
    ka, kb = name_key(a), name_key(b)
    if not ka or not kb:
        return 0.0
    if ka == kb:
        return 1.0
    ratio = difflib.SequenceMatcher(None, ka, kb).ratio()
    wa, wb = set(ka.replace("&", " ").split()), set(kb.replace("&", " ").split())
    jaccard = len(wa & wb) / len(wa | wb) if wa | wb else 0.0
    return max(ratio, jaccard)


@dataclass(frozen=True)
class Place:
    """A stop for linking: its id, name and point."""

    id: str
    name: str
    lat: float
    lng: float


@dataclass(frozen=True)
class Link:
    old: int
    new: int
    meters: float
    similarity: float


def _meters(places: Sequence[Place]) -> np.ndarray:
    from placekeepers.derive.street_safety import points_in_meters

    return points_in_meters([p.lat for p in places], [p.lng for p in places])


def link_places(
    old: Sequence[Place],
    new: Sequence[Place],
    *,
    max_meters: float = LINK_METERS,
    min_similarity: float = LINK_SIMILARITY,
) -> list[Link]:
    """Pair places that vanished with places that appeared: within `max_meters` and with similar
    names, closest pairs first, each place used at most once."""
    if not old or not new:
        return []
    old_m, new_m = _meters(old), _meters(new)
    tree = shapely.STRtree(new_m)
    olds, news = tree.query(old_m, predicate="dwithin", distance=max_meters)
    pairs = []
    for i, j in zip(olds.tolist(), news.tolist(), strict=True):
        meters = float(shapely.distance(old_m[i], new_m[j]))
        similarity = name_similarity(old[i].name, new[j].name)
        if similarity >= min_similarity:
            pairs.append(Link(i, j, round(meters, 1), round(similarity, 3)))
    pairs.sort(key=lambda link: (link.meters, -link.similarity, old[link.old].id, new[link.new].id))
    used_old: set[int] = set()
    used_new: set[int] = set()
    links = []
    for link in pairs:
        if link.old in used_old or link.new in used_new:
            continue
        used_old.add(link.old)
        used_new.add(link.new)
        links.append(link)
    return links


# ---------------------------------------------------------------------------------------------
# Stable keys and history


@dataclass
class KeyedStop:
    """A stop's identity across feeds: its key, its SEPTA id now, and the ids it had before."""

    key: str
    stop_id: str
    name: str
    lat: float
    lng: float
    feed: str
    since: date
    #: earlier SEPTA ids of this stop, newest first: dicts of stop_id, stop_name, until, meters
    history: list[dict] = field(default_factory=list)
    retired_on: date | None = None

    @property
    def former_ids(self) -> list[str]:
        return [entry["stop_id"] for entry in self.history]

    def place(self) -> Place:
        return Place(self.stop_id, self.name, self.lat, self.lng)


KEY_PREFIX = {"bus_metro": "sp", "rail": "sr"}


def new_key(feed: str, stop_id: str, taken: set[str]) -> str:
    base = f"{KEY_PREFIX.get(feed, 'sp')}{stop_id}"
    if base not in taken:
        return base
    n = 2
    while f"{base}_{n}" in taken:
        n += 1
    return f"{base}_{n}"


@dataclass
class KeyResult:
    current: list[KeyedStop]
    retired: list[KeyedStop]
    links: list[tuple[KeyedStop, str, Link]]


def assign_keys(
    previous: Sequence[KeyedStop],
    current: Sequence[Place],
    *,
    feed: str,
    today: date,
    retired_days: int = RETIRED_DAYS,
) -> KeyResult:
    """Keys for today's stops of one feed, carried over from the previous snapshot's stops.

    * a stop id seen before keeps its key (a retired id that comes back too);
    * a new id within LINK_METERS of a stop id that disappeared, with a similar name, takes over
      that stop's key, and the old id goes to the front of its history;
    * any other new id gets `sp<id>` (`sr<id>` for Regional Rail), with `_2` and so on when a
      linked stop already uses that key;
    * an id that disappeared without a successor is kept as retired for `retired_days`.
    """
    previous = [stop for stop in previous if stop.feed == feed]
    by_id = {stop.stop_id: stop for stop in previous}
    result: dict[str, KeyedStop] = {}
    for place in current:
        before = by_id.get(place.id)
        if before is not None:
            result[place.id] = KeyedStop(
                before.key,
                place.id,
                place.name,
                place.lat,
                place.lng,
                feed,
                before.since,
                list(before.history),
            )
    current_ids = {place.id for place in current}
    vanished = [
        stop
        for stop in previous
        if stop.stop_id not in current_ids
        and (stop.retired_on is None or (today - stop.retired_on).days <= retired_days)
    ]
    appeared = [place for place in current if place.id not in result]
    links = link_places([stop.place() for stop in vanished], appeared)
    taken = {stop.key for stop in result.values()}
    linked: list[tuple[KeyedStop, str, Link]] = []
    consumed: set[int] = set()
    for link in links:
        old, place = vanished[link.old], appeared[link.new]
        if old.key in taken:
            continue
        entry = {
            "stop_id": old.stop_id,
            "stop_name": old.name,
            "until": today,
            "meters": link.meters,
        }
        stop = KeyedStop(
            old.key,
            place.id,
            place.name,
            place.lat,
            place.lng,
            feed,
            old.since,
            [entry, *old.history],
        )
        result[place.id] = stop
        taken.add(old.key)
        consumed.add(link.old)
        linked.append((stop, old.stop_id, link))
    for place in appeared:
        if place.id in result:
            continue
        key = new_key(feed, place.id, taken | {stop.key for stop in vanished})
        taken.add(key)
        result[place.id] = KeyedStop(key, place.id, place.name, place.lat, place.lng, feed, today)
    retired = []
    for index, stop in enumerate(vanished):
        if index in consumed or stop.key in taken:
            continue
        retired.append(
            KeyedStop(
                stop.key,
                stop.stop_id,
                stop.name,
                stop.lat,
                stop.lng,
                feed,
                stop.since,
                list(stop.history),
                stop.retired_on or today,
            )
        )
    ordered = [result[place.id] for place in current]
    return KeyResult(ordered, retired, linked)


# ---------------------------------------------------------------------------------------------
# Service measures


#: The measures kept for each stop and kind of day, as snapshot columns `<measure>_<wk|sa|su>`.
MEASURES = ("trips", "first", "last", "busiest", "peak", "midday", "evening", "night")


@dataclass
class StopService:
    """One boarding place of a feed (GTFS location_type 0) with its service on typical days."""

    stop_id: str
    name: str
    lat: float
    lng: float
    feed: str
    wheelchair: int | None = None
    parent_station: str | None = None
    modes: int = 0
    #: route short names, in SEPTA's own order
    routes: list[str] = field(default_factory=list)
    #: {kind suffix: {measure: value}}, such as {"wk": {"trips": 120, "first": 305, ...}}
    days: dict[str, dict[str, int | None]] = field(default_factory=dict)

    def place(self) -> Place:
        return Place(self.stop_id, self.name, self.lat, self.lng)


@dataclass
class RouteService:
    route_id: str
    short_name: str
    long_name: str
    feed: str
    modes: int
    sort: int
    #: {kind suffix: {"trips": n, "peak": n, "midday": n}}: trips that day, and departures in the
    #: peak and midday windows at the route's busiest stop in its busiest direction
    days: dict[str, dict[str, int]] = field(default_factory=dict)
    #: the lines the route's trips follow on typical days, merged and simplified (longitude and
    #: latitude), or None when the feed has no shapes for it
    geometry: object | None = None


@dataclass
class FeedSummary:
    feed: str
    version: str | None
    dates: TypicalDays
    stops: list[StopService]
    routes: list[RouteService]
    notes: list[str] = field(default_factory=list)


def _int(text: str | None) -> int | None:
    try:
        return int(text) if text not in (None, "") else None
    except ValueError:
        return None


def _float(text: str | None) -> float | None:
    try:
        return float(text) if text not in (None, "") else None
    except ValueError:
        return None


def route_sort_key(route: dict[str, str]) -> tuple:
    """SEPTA's own route order when it gives one, else numbers before letters."""
    order = _int(route.get("route_sort_order"))
    name = route.get("route_short_name") or route.get("route_id", "")
    digits = re.match(r"\d+", name)
    return (
        order if order is not None else 10**9,
        0 if digits else 1,
        int(digits.group()) if digits else 0,
        name,
    )


def _columns(con, path: Path) -> set[str]:
    from placekeepers.sql import quote_literal

    rows = con.execute(
        f"DESCRIBE SELECT * FROM read_csv({quote_literal(str(path))}, header = true, "
        "all_varchar = true)"
    ).fetchall()
    return {row[0].strip().lstrip("﻿") for row in rows}


def _col(name: str, present: set[str], fallback: str = "NULL") -> str:
    from placekeepers.sql import quote_ident

    return quote_ident(name) if name in present else fallback


def summarize_feed(
    con, folder: Path, *, feed: str, start: date, simplify_degrees: float = 0.00005
) -> FeedSummary:
    """Stops, routes and their service on typical days for one GTFS feed in `folder`.

    `con` is a DuckDB connection; the large stop_times.txt and shapes.txt are read by DuckDB, the
    small files with the csv module."""
    import pyarrow as pa

    from placekeepers.sql import quote_literal

    notes: list[str] = []
    info = read_table(folder, "feed_info", required=False)
    version = info[0].get("feed_version") if info else None
    feed_dates = None
    if info and info[0].get("feed_start_date") and info[0].get("feed_end_date"):
        feed_dates = (gtfs_date(info[0]["feed_start_date"]), gtfs_date(info[0]["feed_end_date"]))
    calendar = Calendar.from_rows(
        read_table(folder, "calendar", required=False),
        read_table(folder, "calendar_dates", required=False),
    )
    trips = read_table(folder, "trips")
    per_service = Counter(trip["service_id"] for trip in trips)
    dates = typical_days(calendar, start, feed_dates, dict(per_service))
    notes.extend(dates.notes)

    routes = {row["route_id"]: row for row in read_table(folder, "routes")}
    route_modes = {
        route_id: ROUTE_TYPE_MODES.get(_int(row.get("route_type")) or 0, 0)
        for route_id, row in routes.items()
    }
    day_rows: dict[str, list] = {"kind": [], "trip_id": [], "route_id": [], "direction_id": []}
    for kind, suffix in DAYS:
        running = dates.services.get(kind, frozenset())
        for trip in trips:
            if trip["service_id"] in running:
                day_rows["kind"].append(suffix)
                day_rows["trip_id"].append(trip["trip_id"])
                day_rows["route_id"].append(trip["route_id"])
                day_rows["direction_id"].append(trip.get("direction_id") or "")
    day_trips = pa.table(day_rows, schema=pa.schema([(name, pa.string()) for name in day_rows]))
    con.register("day_trips", day_trips)

    stop_times = folder / "stop_times.txt"
    if not stop_times.is_file():
        raise GtfsError("The feed has no stop_times.txt")
    present = _columns(con, stop_times)
    for needed in ("trip_id", "stop_id", "stop_sequence"):
        if needed not in present:
            raise GtfsError(f"stop_times.txt has no {needed} column")
    departure = _col("departure_time", present, "''")
    arrival = _col("arrival_time", present, "''")
    pickup = _col("pickup_type", present, "'0'")
    con.execute(
        f"""CREATE OR REPLACE TEMP TABLE st AS
        SELECT trip_id, stop_id, TRY_CAST(stop_sequence AS INTEGER) AS seq,
               coalesce(nullif({departure}, ''), nullif({arrival}, '')) AS t,
               coalesce(nullif({pickup}, ''), '0') AS pickup
        FROM read_csv({quote_literal(str(stop_times))}, header = true, all_varchar = true)
        WHERE trip_id IN (SELECT trip_id FROM day_trips)"""
    )
    con.execute(
        """CREATE OR REPLACE TEMP TABLE dep AS
        SELECT d.kind, s.stop_id, d.route_id, d.direction_id, d.trip_id,
               TRY_CAST(split_part(s.t, ':', 1) AS INTEGER) * 60
                 + TRY_CAST(split_part(s.t, ':', 2) AS INTEGER) AS m
        FROM st s
        JOIN day_trips d ON d.trip_id = s.trip_id
        JOIN (SELECT trip_id, max(seq) AS last FROM st GROUP BY trip_id) l
          ON l.trip_id = s.trip_id
        WHERE s.seq < l.last AND s.pickup <> '1'"""
    )
    untimed = con.execute("SELECT count(*) FROM dep WHERE m IS NULL").fetchone()[0]
    if untimed:
        notes.append(f"{untimed:,} departures have no time and count only toward trips")

    measures: dict[str, dict[str, dict[str, int | None]]] = {}
    rows = con.execute(
        f"""SELECT kind, stop_id, count(*) AS trips, min(m) AS first, max(m) AS last,
               count(*) FILTER (WHERE m >= {PEAK[0]} AND m < {PEAK[1]}) AS peak,
               count(*) FILTER (WHERE m >= {MIDDAY[0]} AND m < {MIDDAY[1]}) AS midday,
               count(*) FILTER (WHERE m >= {EVENING_FROM}) AS evening,
               count(DISTINCT (m % 1440) // 60)
                 FILTER (WHERE m % 1440 >= {NIGHT[0]} AND m % 1440 < {NIGHT[1]}) AS night
        FROM dep GROUP BY kind, stop_id"""
    ).fetchall()
    for kind, stop_id, n, first, last, peak, midday, evening, night in rows:
        measures.setdefault(stop_id, {})[kind] = {
            "trips": n,
            "first": first,
            "last": last,
            "peak": peak,
            "midday": midday,
            "evening": evening,
            "night": night,
            "busiest": 0,
        }
    for kind, stop_id, busiest in con.execute(
        """SELECT kind, stop_id, max(n) FROM (
             SELECT kind, stop_id, m // 60 AS h, count(*) AS n FROM dep WHERE m IS NOT NULL
             GROUP BY kind, stop_id, h)
           GROUP BY kind, stop_id"""
    ).fetchall():
        measures[stop_id][kind]["busiest"] = busiest
    served: dict[str, set[str]] = {}
    for stop_id, route_id in con.execute("SELECT DISTINCT stop_id, route_id FROM dep").fetchall():
        served.setdefault(stop_id, set()).add(route_id)

    stops: list[StopService] = []
    skipped = 0
    for row in read_table(folder, "stops"):
        if (row.get("location_type") or "0") != "0":
            continue
        lat, lng = _float(row.get("stop_lat")), _float(row.get("stop_lon"))
        if lat is None or lng is None or not row.get("stop_id"):
            skipped += 1
            continue
        stop_id = row["stop_id"]
        route_ids = sorted(served.get(stop_id, ()), key=lambda r: route_sort_key(routes.get(r, {})))
        modes = 0
        for route_id in route_ids:
            modes |= route_modes.get(route_id, 0)
        found = measures.get(stop_id, {})
        stops.append(
            StopService(
                stop_id=stop_id,
                name=row.get("stop_name") or "",
                lat=lat,
                lng=lng,
                feed=feed,
                wheelchair=_int(row.get("wheelchair_boarding")),
                parent_station=row.get("parent_station") or None,
                modes=modes,
                routes=[routes.get(r, {}).get("route_short_name") or r for r in route_ids],
                days={suffix: found.get(suffix, {"trips": 0, "busiest": 0}) for _, suffix in DAYS},
            )
        )
    if skipped:
        notes.append(f"{skipped} stops have no usable location and are left out")

    route_rows = _route_measures(con)
    shapes = _route_shapes(con, folder, trips, dates, simplify_degrees, notes)
    route_list = []
    for route_id, row in sorted(routes.items(), key=lambda item: route_sort_key(item[1])):
        days = route_rows.get(route_id, {})
        if not any(day.get("trips") for day in days.values()):
            continue
        route_list.append(
            RouteService(
                route_id=route_id,
                short_name=row.get("route_short_name") or route_id,
                long_name=row.get("route_long_name") or "",
                feed=feed,
                modes=route_modes.get(route_id, 0),
                sort=route_sort_key(row)[0],
                days={suffix: days.get(suffix, {"trips": 0}) for _, suffix in DAYS},
                geometry=shapes.get(route_id),
            )
        )
    con.unregister("day_trips")
    return FeedSummary(feed, version, dates, stops, route_list, notes)


def _route_measures(con) -> dict[str, dict[str, dict[str, int]]]:
    found: dict[str, dict[str, dict[str, int]]] = {}
    for kind, route_id, trips in con.execute(
        "SELECT kind, route_id, count(DISTINCT trip_id) FROM day_trips GROUP BY kind, route_id"
    ).fetchall():
        found.setdefault(route_id, {})[kind] = {"trips": trips, "peak": 0, "midday": 0}
    for kind, route_id, peak, midday in con.execute(
        f"""SELECT kind, route_id, max(peak), max(midday) FROM (
              SELECT kind, route_id, direction_id, stop_id,
                     count(*) FILTER (WHERE m >= {PEAK[0]} AND m < {PEAK[1]}) AS peak,
                     count(*) FILTER (WHERE m >= {MIDDAY[0]} AND m < {MIDDAY[1]}) AS midday
              FROM dep GROUP BY kind, route_id, direction_id, stop_id)
            GROUP BY kind, route_id"""
    ).fetchall():
        found[route_id][kind].update(peak=peak, midday=midday)
    return found


def _route_shapes(
    con,
    folder: Path,
    trips: list[dict[str, str]],
    dates: TypicalDays,
    tolerance: float,
    notes: list[str],
) -> dict[str, object]:
    """Each route's lines on typical days: the shapes its trips follow, merged where they
    overlap and simplified by `tolerance` degrees (5 meters by default)."""
    from shapely.geometry import LineString, MultiLineString

    from placekeepers.sql import quote_literal

    path = folder / "shapes.txt"
    if not path.is_file():
        notes.append("The feed has no shapes, so routes have no lines")
        return {}
    running = set().union(*dates.services.values()) if dates.services else set()
    wanted: dict[str, set[str]] = {}
    for trip in trips:
        if trip["service_id"] in running and trip.get("shape_id"):
            wanted.setdefault(trip["route_id"], set()).add(trip["shape_id"])
    shape_ids = sorted(set().union(*wanted.values())) if wanted else []
    if not shape_ids:
        return {}
    import pyarrow as pa

    con.register("wanted_shapes", pa.table({"shape_id": pa.array(shape_ids, pa.string())}))
    rows = con.execute(
        f"""SELECT shape_id, TRY_CAST(shape_pt_lon AS DOUBLE), TRY_CAST(shape_pt_lat AS DOUBLE)
        FROM read_csv({quote_literal(str(path))}, header = true, all_varchar = true)
        WHERE shape_id IN (SELECT shape_id FROM wanted_shapes)
        ORDER BY shape_id, TRY_CAST(shape_pt_sequence AS INTEGER)"""
    ).fetchall()
    con.unregister("wanted_shapes")
    points: dict[str, list[tuple[float, float]]] = {}
    for shape_id, lng, lat in rows:
        if lng is not None and lat is not None:
            points.setdefault(shape_id, []).append((lng, lat))
    lines = {
        shape_id: LineString(coords) for shape_id, coords in points.items() if len(coords) >= 2
    }
    found = {}
    for route_id, ids in wanted.items():
        parts = [lines[i] for i in sorted(ids) if i in lines]
        if not parts:
            continue
        merged = shapely.line_merge(shapely.unary_union(parts))
        simple = shapely.simplify(merged, tolerance, preserve_topology=False)
        geoms = [g for g in getattr(simple, "geoms", [simple]) if not g.is_empty]
        if geoms:
            found[route_id] = MultiLineString(
                [list(g.coords) for g in geoms if g.geom_type == "LineString"]
            )
    return found


# ---------------------------------------------------------------------------------------------
# Ridership matched to today's stops


@dataclass
class StopCount:
    """SEPTA's average boardings at one stop code, summed over its routes and directions."""

    code: str
    name: str
    lat: float | None
    lng: float | None
    weekday: int = 0
    saturday: int = 0
    sunday: int = 0
    periods: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class CountMatch:
    code: str
    #: "id" (the stop's own SEPTA id), "former" (an id the stop had before) or "nearby" (a
    #: retired stop within LINK_METERS with a similar name)
    how: str


def sum_counts(rows: Iterable[dict]) -> dict[str, StopCount]:
    """Stop summary rows (stop_code, stop, lat, lon, wk_ons, sat_ons, sun_ons, sign_up) summed
    per stop code."""
    counts: dict[str, StopCount] = {}
    for row in rows:
        code = row.get("stop_code")
        if not code:
            continue
        found = counts.get(code)
        if found is None:
            found = counts[code] = StopCount(
                code, row.get("stop") or "", row.get("lat"), row.get("lon")
            )
        found.weekday += int(row.get("wk_ons") or 0)
        found.saturday += int(row.get("sat_ons") or 0)
        found.sunday += int(row.get("sun_ons") or 0)
        if row.get("sign_up"):
            found.periods.add(str(row["sign_up"]))
        if found.lat is None and row.get("lat") is not None:
            found.lat, found.lng = row.get("lat"), row.get("lon")
    return counts


def match_counts(
    stops: Sequence[tuple[str, Sequence[str], Place]],
    counts: dict[str, StopCount],
    known_ids: set[str],
) -> dict[int, CountMatch]:
    """Which count belongs to which stop. `stops` are (stop id, former ids, place) of the stops
    that may have a count; `known_ids` every stop id in today's schedules.

    A stop takes the count under its own id first, then under an id it had before (its history),
    then the count of a stop id that no longer exists within LINK_METERS with a similar name
    (the same rule as for linking renumbered stops). Each count goes to one stop at most; a stop
    with no count gets none, never an estimate."""
    found: dict[int, CountMatch] = {}
    used: set[str] = set()
    for index, (stop_id, _, _) in enumerate(stops):
        if stop_id in counts:
            found[index] = CountMatch(stop_id, "id")
            used.add(stop_id)
    for index, (_, former, _) in enumerate(stops):
        if index in found:
            continue
        for old in former:
            if old in counts and old not in used and old not in known_ids:
                found[index] = CountMatch(old, "former")
                used.add(old)
                break
    retired = [
        count
        for code, count in sorted(counts.items())
        if code not in used and code not in known_ids and count.lat is not None
    ]
    waiting = [index for index in range(len(stops)) if index not in found]
    links = link_places(
        [Place(c.code, c.name, c.lat, c.lng) for c in retired],
        [stops[index][2] for index in waiting],
    )
    for link in links:
        found[waiting[link.new]] = CountMatch(retired[link.old].code, "nearby")
    return found
