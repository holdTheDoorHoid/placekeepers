"""Bus and trolley stops from OpenStreetMap, and what riders find there (M2.2).

The rules behind the `stops` layer (docs/CONTRACTS.md section 4), applied to the `osm_philadelphia`
snapshot (placekeepers.adapters.osm):

**Which elements are stops.** The place where riders wait: an element tagged `highway=bus_stop`
(unless it marks where the bus halts in the road, `public_transport=stop_position`), or a
`public_transport=platform` for buses, trolleybuses or trolleys (`bus`, `trolleybus` or `tram`
`=yes`, or the old `highway=platform`). Platforms of trains, subways and light rail are stations,
not street stops, and are left out, as are platforms underground or indoors (`location`
underground or indoor, `indoor=yes`, `tunnel=yes`, a layer or level below the street) and stops
closed to the public (`access` no or private). These are the stops StreetComplete asks its stop
questions about (its quests AddBusStopShelter and AddBenchStatusOnBusStop), less the station
platforms, so a stop shown as not yet surveyed is one the app can ask about.

**Each answer, from the stop's own tags,** as yes, no or unknown (a tag that is missing, or holds a
value we do not recognize). The `YES_NO` table below lists the values; `wheelchair` keeps a third
answer, limited.

**A shelter or bench mapped on its own.** Many mappers draw the shelter or the bench as its own
point or outline instead of tagging the stop. Such a shelter (`amenity=shelter` for public
transport, or with no `shelter_type`; a picnic shelter or a gazebo is not a bus shelter) or bench
(`amenity=bench`) counts for the nearest stop, if that stop lies within 10 meters, and only when
the stop does not answer the question itself: a stop's own answer always wins, even when a
shelter is drawn beside it. Why 10 meters: on 2026-10-04 every stop shelter drawn near a mapped
stop lay within 4 meters of it (the next was 42 meters away), while the nearest other stop,
usually across the street, was 15 meters or more away for 95 percent of stops
(`docs/DATA_SOURCES.md`). Counting only the nearest stop keeps a shelter from being credited to
the stop across a narrow street too.
A mapped shelter tagged `bench=yes` also gives its stop a bench.

**What the map shows** (`c`), from those answers:

* 3, a shelter or a roof: the stop has a shelter, or the whole stop is covered (`covered=yes`,
  which StreetComplete records when a stop stands under a roof or a building);
* 2, a bench but no shelter mapped;
* 1, no shelter and no bench: both answers are no;
* 0, not yet surveyed: OpenStreetMap does not say yet, or says only one of the two. Unknown is
  never shown as missing.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from typing import Any

import numpy as np
import pyarrow as pa
import shapely

from placekeepers.derive.street_safety import to_meters

log = logging.getLogger(__name__)

#: A shelter or bench mapped on its own counts for the nearest stop within this distance.
NEARBY_METERS = 10.0

# What the map shows, `c` in the tiles (codes never change meaning once published).
UNKNOWN, NEITHER, BENCH, SHELTER = 0, 1, 2, 3
COMFORT_WORDS = {
    SHELTER: "a shelter or roof",
    BENCH: "a bench but no shelter mapped",
    NEITHER: "no shelter and no bench",
    UNKNOWN: "not yet surveyed",
}

# `md` bits: how the stop is served.
BUS, TROLLEY = 1, 2

# `nb` bits: an answer that comes from a shelter or bench mapped on its own nearby.
SHELTER_NEARBY, BENCH_NEARBY = 1, 2

#: Values read as yes and as no, per tag; anything else is unknown. `separate` is the value
#: mappers use for "there is one, drawn on its own".
YES_NO: dict[str, tuple[frozenset[str], frozenset[str]]] = {
    "shelter": (frozenset({"yes", "separate"}), frozenset({"no"})),
    "bench": (frozenset({"yes", "separate"}), frozenset({"no"})),
    "bin": (frozenset({"yes", "separate"}), frozenset({"no"})),
    "lit": (
        frozenset({"yes", "automatic", "24/7", "sunset-sunrise", "interval", "limited"}),
        frozenset({"no", "disused"}),
    ),
    "tactile_paving": (
        frozenset({"yes", "partial", "incorrect", "contrasted", "primitive"}),
        frozenset({"no"}),
    ),
    "departures_board": (
        frozenset({"yes", "realtime", "timetable", "delay"}),
        frozenset({"no", "none"}),
    ),
    "covered": (
        frozenset({"yes", "roof", "booth", "arcade", "colonnade", "partial"}),
        frozenset({"no"}),
    ),
}
#: wheelchair: 1 yes, 0 no, 2 limited.
WHEELCHAIR = {"yes": 1, "designated": 1, "no": 0, "limited": 2}

#: Tile property for each answer.
ANSWER_PROPERTIES = {
    "shelter": "sh",
    "bench": "bn",
    "bin": "bi",
    "lit": "lt",
    "tactile_paving": "tp",
    "wheelchair": "wc",
    "departures_board": "db",
    "covered": "cv",
}

#: Station platforms, not street stops.
STATION_MODES = ("train", "subway", "light_rail", "monorail", "funicular")
#: shelter_type values that are a stop's shelter (None: no shelter_type at all).
STOP_SHELTER_TYPES = frozenset({"public_transport", None})


# ---------------------------------------------------------------------------------------------
# Which elements are stops


def _below_street(value: str | None) -> bool:
    """A layer or level such as -1 or -2;-1: underground."""
    if not value:
        return False
    for part in value.replace(",", ";").split(";"):
        try:
            if float(part.strip()) < 0:
                return True
        except ValueError:
            continue
    return False


def is_stop(tags: Mapping[str, str]) -> bool:
    """True for a place where riders wait for a bus or a trolley (see the module docstring)."""
    if tags.get("public_transport") == "stop_position":
        return False
    if tags.get("access") in ("no", "private") or tags.get("disused") == "yes":
        return False
    if tags.get("highway") == "bus_stop":
        return True
    if tags.get("public_transport") != "platform":
        return False
    if any(tags.get(mode) == "yes" for mode in STATION_MODES):
        return False
    if tags.get("location") in ("underground", "indoor") or "yes" in (
        tags.get("indoor"),
        tags.get("tunnel"),
    ):
        return False
    if _below_street(tags.get("layer")) or _below_street(tags.get("level")):
        return False
    return (
        any(tags.get(mode) == "yes" for mode in ("bus", "trolleybus", "tram"))
        or tags.get("highway") == "platform"
    )


def stop_modes(tags: Mapping[str, str]) -> int:
    """`md`: 1 bus, 2 trolley, 3 both."""
    bits = 0
    if (
        tags.get("highway") in ("bus_stop", "platform")
        or tags.get("bus") == "yes"
        or tags.get("trolleybus") == "yes"
    ):
        bits |= BUS
    if tags.get("tram") == "yes":
        bits |= TROLLEY
    return bits


def is_stop_shelter(tags: Mapping[str, str]) -> bool:
    """A shelter mapped on its own that may serve a stop: not a picnic shelter, gazebo, tent..."""
    return tags.get("amenity") == "shelter" and tags.get("shelter_type") in STOP_SHELTER_TYPES


def is_bench(tags: Mapping[str, str]) -> bool:
    return tags.get("amenity") == "bench"


# ---------------------------------------------------------------------------------------------
# Answers


def answer(tags: Mapping[str, str], key: str) -> int | None:
    """1 yes, 0 no, None unknown (wheelchair also 2, limited)."""
    value = tags.get(key)
    if value is None:
        return None
    value = value.strip().lower()
    if key == "wheelchair":
        return WHEELCHAIR.get(value)
    yes, no = YES_NO[key]
    if value in yes:
        return 1
    if value in no:
        return 0
    return None


def unrecognized(tags: Mapping[str, str]) -> list[str]:
    """The answer tags this stop has with a value we do not recognize (shown as unknown)."""
    return [key for key in ANSWER_PROPERTIES if key in tags and answer(tags, key) is None]


def comfort(shelter: int | None, bench: int | None, covered: int | None) -> int:
    """`c`: what the map shows. Unknown is never shown as missing."""
    if shelter == 1 or covered == 1:
        return SHELTER
    if bench == 1:
        return BENCH
    if shelter == 0 and bench == 0:
        return NEITHER
    return UNKNOWN


@dataclass
class Stop:
    #: the element in OpenStreetMap: n<id> for a node, w<id> for a way
    id: str
    lat: float
    lng: float
    in_city: bool
    tags: dict[str, str]
    answers: dict[str, int | None] = field(default_factory=dict)
    #: SHELTER_NEARBY and BENCH_NEARBY bits
    nearby: int = 0

    @property
    def c(self) -> int:
        return comfort(
            self.answers.get("shelter"), self.answers.get("bench"), self.answers.get("covered")
        )

    def properties(self) -> dict[str, Any]:
        """The tile properties of docs/CONTRACTS.md section 4 (`stops`). An unknown answer is
        left out; text tags appear only when the stop has them."""
        props: dict[str, Any] = {"id": self.id, "c": self.c, "md": stop_modes(self.tags)}
        for key, short in ANSWER_PROPERTIES.items():
            value = self.answers.get(key)
            if value is not None:
                props[short] = value
        if self.nearby:
            props["nb"] = self.nearby
        for key, short in (("name", "nm"), ("ref", "ref"), ("gtfs:stop_id", "gs")):
            text = (self.tags.get(key) or "").strip()
            if text:
                props[short] = text
        return props


def element_id(osm_type: str, osm_id: int) -> str:
    return f"{osm_type[0]}{osm_id}"


def find_stops(table: pa.Table) -> tuple[list[Stop], list[str]]:
    """Every stop in a snapshot of `osm_philadelphia` with its answers, in and around the city,
    sorted by id. Returns the stops and plain notes about the data."""
    columns = {name: table.column(name).to_pylist() for name in table.column_names}
    count = table.num_rows
    tags = [json.loads(text) if text else {} for text in columns["tags"]]
    geometries = np.array(
        [shapely.from_wkb(g) if g is not None else None for g in columns["geometry"]], dtype=object
    )
    stops_idx = [i for i in range(count) if is_stop(tags[i]) and geometries[i] is not None]
    stops = [
        Stop(
            id=element_id(columns["osm_type"][i], columns["osm_id"][i]),
            lat=float(columns["lat"][i]),
            lng=float(columns["lng"][i]),
            in_city=bool(columns["in_city"][i]),
            tags=tags[i],
            answers={key: answer(tags[i], key) for key in ANSWER_PROPERTIES},
        )
        for i in stops_idx
    ]
    notes: list[str] = []
    if not stops:
        return stops, notes

    stop_shapes = to_meters(geometries[stops_idx])
    tree = shapely.STRtree(stop_shapes)
    for kind, matches, bit in (
        ("shelter", is_stop_shelter, SHELTER_NEARBY),
        ("bench", is_bench, BENCH_NEARBY),
    ):
        found = [i for i in range(count) if matches(tags[i]) and geometries[i] is not None]
        if not found:
            continue
        shapes = to_meters(geometries[found])
        which, nearest = tree.query_nearest(
            shapes, max_distance=NEARBY_METERS, return_distance=False, all_matches=True
        )
        for item, stop_index in zip(which.tolist(), nearest.tolist(), strict=True):
            stop = stops[stop_index]
            if stop.answers.get(kind) is None:
                stop.answers[kind] = 1
                stop.nearby |= bit
            # A shelter that says it has a bench gives its stop a bench too.
            item_tags = tags[found[item]]
            gives_bench = kind == "shelter" and answer(item_tags, "bench") == 1
            if gives_bench and stop.answers.get("bench") is None:
                stop.answers["bench"] = 1
                stop.nearby |= BENCH_NEARBY

    odd = Counter(key for stop in stops if stop.in_city for key in unrecognized(stop.tags))
    if odd:
        parts = ", ".join(f"{n} {key}" for key, n in sorted(odd.items()))
        notes.append(f"Stop answers with values we do not recognize, shown as unknown: {parts}")
    stops.sort(key=lambda stop: stop.id)
    return stops, notes


def comfort_counts(stops: Sequence[Stop]) -> dict[int, int]:
    """Stops inside the city by what the map shows."""
    counts = dict.fromkeys((SHELTER, BENCH, NEITHER, UNKNOWN), 0)
    for stop in stops:
        if stop.in_city:
            counts[stop.c] += 1
    return counts


def summary_note(counts: Mapping[int, int], as_of: date | None) -> str:
    """One plain sentence for the build notes, such as "Bus and trolley stops in OpenStreetMap
    (data of 2026-10-03): 829 in the city; 95 with a shelter or roof, ..."."""
    total = sum(counts.values())
    when = f" (data of {as_of.isoformat()})" if as_of else ""
    return (
        f"Bus and trolley stops in OpenStreetMap{when}: {total:,} in the city; "
        f"{counts[SHELTER]:,} with a shelter or roof, {counts[BENCH]:,} with a bench but no "
        f"shelter mapped, {counts[NEITHER]:,} with neither, {counts[UNKNOWN]:,} not yet surveyed"
    )


# ---------------------------------------------------------------------------------------------
# Matching OpenStreetMap's stops to SEPTA's (M2.4, for the route survey sheets)

#: An OpenStreetMap stop and a SEPTA stop are taken for the same pole within this distance. On
#: 2026-10-05 the two points of the same stop (matched by stop number) were a median 5 meters
#: apart, while a stop's nearest other SEPTA stop, usually across the street, was 15 meters or
#: more away for three stops in four.
SAME_STOP_METERS = 15.0


@dataclass(frozen=True)
class SeptaPoint:
    """A SEPTA stop to match: its stop number today, the numbers it had before, its point."""

    stop_id: str
    former_ids: tuple[str, ...]
    lat: float
    lng: float


def stop_numbers(stop: Stop) -> list[str]:
    """The SEPTA stop numbers an OpenStreetMap stop gives (`ref`, then `gtfs:stop_id`)."""
    numbers = []
    for key in ("ref", "gtfs:stop_id"):
        for part in (stop.tags.get(key) or "").replace(",", ";").split(";"):
            part = part.strip()
            if part and part not in numbers:
                numbers.append(part)
    return numbers


def match_septa(osm: Sequence[Stop], septa: Sequence[SeptaPoint]) -> dict[int, int]:
    """{index in `septa`: index in `osm`}: which OpenStreetMap stop is which SEPTA stop.

    First by number: an OpenStreetMap stop whose `ref` (or `gtfs:stop_id`) is a SEPTA stop's
    number today or one it had before, when that SEPTA stop stands within SAME_STOP_METERS. A
    number pointing farther away is ignored: on Frankford Avenue a run of `ref`s names the stop
    across the street while each point stands on another SEPTA stop. Then by distance: the
    remaining stops pair up nearest first within SAME_STOP_METERS. Each stop matches once."""
    if not osm or not septa:
        return {}
    from placekeepers.derive.street_safety import points_in_meters

    osm_points = points_in_meters([s.lat for s in osm], [s.lng for s in osm])
    septa_points = points_in_meters([s.lat for s in septa], [s.lng for s in septa])
    by_number: dict[str, int] = {}
    for index, stop in enumerate(septa):
        by_number.setdefault(stop.stop_id, index)
    for index, stop in enumerate(septa):
        for former in stop.former_ids:
            by_number.setdefault(former, index)

    pairs: list[tuple[float, int, int]] = []
    for o, stop in enumerate(osm):
        for number in stop_numbers(stop):
            s = by_number.get(number)
            if s is not None:
                meters = float(osm_points[o].distance(septa_points[s]))
                if meters <= SAME_STOP_METERS:
                    pairs.append((meters, s, o))
    matched = _pair_up(pairs, {}, set())

    tree = shapely.STRtree(septa_points)
    near: list[tuple[float, int, int]] = []
    taken = set(matched.values())
    for o in range(len(osm)):
        if o in taken:
            continue
        for s in tree.query(osm_points[o], predicate="dwithin", distance=SAME_STOP_METERS):
            if int(s) not in matched:
                near.append((float(osm_points[o].distance(septa_points[s])), int(s), o))
    return _pair_up(near, matched, taken)


def _pair_up(
    pairs: list[tuple[float, int, int]], matched: dict[int, int], taken: set[int]
) -> dict[int, int]:
    """Closest pairs first, each SEPTA stop and each OpenStreetMap stop at most once."""
    result = dict(matched)
    used = set(taken) | set(matched.values())
    for _, s, o in sorted(pairs):
        if s in result or o in used:
            continue
        result[s] = o
        used.add(o)
    return result
