"""The transit comfort lens and the suggestions for bus and trolley stops (M2.3).

For every SEPTA bus and trolley stop on the map (`stops` in tiles/transit.pmtiles), this module
finds the stop in OpenStreetMap, carries over what riders find there, computes the lens factors
(registry/lenses.yaml, `transit_comfort`) and decides which suggestions the stop gets. The method
in plain words is in docs/TRANSIT_METHOD.md; the evidence behind each factor in docs/EVIDENCE.md.

**Finding a SEPTA stop in OpenStreetMap** (M2.2's stops, placekeepers.derive.bus_stops):

1. *By SEPTA's stop number.* An OpenStreetMap stop's `ref` and `gtfs:stop_id` tags often hold the
   number on the stop's sign. A number names a SEPTA stop (its stop id today, or one in its history)
   when the two stand within REF_METERS of each other, or within REF_SIMILAR_METERS when both have
   names that agree. A number farther away is a mapping mistake and is ignored. When two
   OpenStreetMap stops carry one number, the nearer one wins.
2. *By place,* for the stops left: the nearest SEPTA stop within PLACE_METERS, closest pairs
   first, each stop used once. A stop whose two nearest SEPTA stops are about as close (within
   AMBIGUOUS_GAP meters and AMBIGUOUS_RATIO times) is left unmatched rather than guessed: those are
   usually the two sides of one corner.

On 2026-10-04 the numbers checked out: of the 230 OpenStreetMap stops whose number names a SEPTA
stop within 60 meters, matching by place alone would have picked another stop for 33 (mostly the
other side of the street), so a number always comes first.

**What riders find** comes from the matched OpenStreetMap stop: `a` (its `c`: 3 a shelter or roof,
2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed) and the shelter, bench and light
answers (`sh`, `bn`, `li`, 1 yes and 0 no, absent when unknown). A SEPTA stop that OpenStreetMap
does not have yet gets none of these: not yet surveyed, never "missing".

**Factors**, each 0 to 100 among the bus and trolley stops on the map (docs/CONTRACTS.md section 1,
lenses). A factor with no data for a stop is left out of its average, as in every lens, with one
exception: a shelter or bench no one has surveyed yet counts as NOT_SURVEYED (50), halfway between
having one (0) and not (100). Leaving them out would let a stop known only for its heat and its
street top the ranking, and counting them as missing would score the stop as if it had nothing;
halfway does neither, and the stop gets the suggestion to survey it.

* `f_riders`: weekday boardings, SEPTA's count; the share of stops with fewer. Left out where
  SEPTA has no count yet.
* `f_noshelter`: 100 when a survey found no shelter, 0 when there is one (or the whole stop is
  under a roof), 50 when not yet surveyed.
* `f_nobench`: 100 when a survey found no bench, 0 when there is one, 50 when not yet surveyed.
* `f_shade`: how little tree canopy covers the land of the stop's H3 cell (resolution 9, about two
  blocks across; canopy of 2018, water left out); the share of stops with more canopy.
* `f_heat`: the heat exposure score of the stop's census tract (the City's heat vulnerability
  data); the share of stops in cooler tracts.
* `f_hin`: 100 when the stop stands within HIN_METERS of the High Injury Network, else 0.
* `f_wait`: the typical wait between departures from 10 to 2 on weekdays; the share of stops with
  shorter waits. Left out for a stop with no midday service.

**Suggestions** (registry/suggestions.yaml), in this order: survey the stop first when its shelter
or bench is not known yet; ask for a shelter where a survey found none; ask for a bench where a
survey found none; report a dark streetlight where OpenStreetMap says the stop is not lit; plant
shade trees where the stop is among the quarter with the least canopy (`f_shade` of SHADE_FROM or
more).
"""

from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path

import h3
import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.derive.bus_stops import UNKNOWN, Stop, find_stops
from placekeepers.derive.street_safety import plural, points_in_meters, to_meters
from placekeepers.derive.transit import name_similarity

log = logging.getLogger(__name__)

#: An OpenStreetMap stop's number names a SEPTA stop within this distance,
REF_METERS = 60.0
#: or within this one when both names agree.
REF_SIMILAR_METERS = 200.0
NAME_SIMILARITY = 0.75
#: A stop without a usable number matches the nearest SEPTA stop within this distance,
PLACE_METERS = 20.0
#: unless the second nearest is about as close: within this many meters and this ratio.
AMBIGUOUS_GAP = 5.0
AMBIGUOUS_RATIO = 1.5
#: A stop this close to a High Injury Network street is on it (riders cross it).
HIN_METERS = 30.0
#: Shade trees are suggested for the quarter of stops with the least canopy nearby.
SHADE_FROM = 75
#: A shelter or bench no one has surveyed yet: halfway between having one (0) and not (100).
NOT_SURVEYED = 50
H3_RESOLUTION = 9

#: The lens factors, in registry order.
FACTORS = ("f_riders", "f_noshelter", "f_nobench", "f_shade", "f_heat", "f_hin", "f_wait")
#: The suggestions this module gives, in the order a stop lists them.
SUGGESTIONS = (
    "stop_survey",
    "stop_shelter_request",
    "stop_bench_request",
    "stop_streetlight_report",
    "stop_shade_trees",
)
#: How a stop was found in OpenStreetMap (`om`).
BY_NUMBER, BY_PLACE = 1, 2

#: Sources the factors read, each optional: without one, its factor is left out.
SOURCES = (
    "osm_philadelphia",
    "tree_canopy_2018",
    "census_tracts_2020",
    "land_use",
    "heat_vulnerability",
    "high_injury_network",
)


@dataclass(frozen=True)
class SeptaStop:
    """A SEPTA bus or trolley stop on the map, as the matching needs it."""

    sid: str
    former: tuple[str, ...]
    name: str
    lat: float
    lng: float


@dataclass(frozen=True)
class OsmMatch:
    stop: Stop
    how: int
    meters: float


@dataclass
class MatchSummary:
    osm_stops: int = 0
    by_number: int = 0
    by_place: int = 0
    #: numbers that name a SEPTA stop too far away to be this stop
    numbers_too_far: int = 0
    #: stops left unmatched because two SEPTA stops were about as close
    ambiguous: int = 0

    @property
    def matched(self) -> int:
        return self.by_number + self.by_place


def stop_numbers(tags: Mapping[str, str]) -> list[str]:
    """The SEPTA stop numbers an OpenStreetMap stop names in `ref` and `gtfs:stop_id`."""
    found: list[str] = []
    for key in ("ref", "gtfs:stop_id"):
        for part in re.split(r"[;,\s]+", tags.get(key) or ""):
            part = part.strip()
            if part.isdigit() and part not in found:
                found.append(part)
    return found


def match_osm(
    septa: Sequence[SeptaStop], osm: Sequence[Stop]
) -> tuple[dict[int, OsmMatch], MatchSummary]:
    """Which OpenStreetMap stop is which SEPTA stop (module docstring). Returns the matches by
    the index of the SEPTA stop, and counts for the build notes."""
    summary = MatchSummary(osm_stops=len(osm))
    if not septa or not osm:
        return {}, summary
    septa_m = points_in_meters([s.lat for s in septa], [s.lng for s in septa])
    osm_m = points_in_meters([s.lat for s in osm], [s.lng for s in osm])
    by_number: dict[str, int] = {}
    for index, stop in enumerate(septa):
        for number in (stop.sid, *stop.former):
            by_number.setdefault(number, index)

    # 1. By SEPTA's stop number.
    claims: dict[int, tuple[float, int]] = {}
    for o, stop in enumerate(osm):
        best: tuple[float, int] | None = None
        for number in stop_numbers(stop.tags):
            s = by_number.get(number)
            if s is None:
                continue
            meters = float(shapely.distance(osm_m[o], septa_m[s]))
            name = (stop.tags.get("name") or "").strip()
            alike = bool(name) and name_similarity(name, septa[s].name) >= NAME_SIMILARITY
            if meters <= REF_METERS or (meters <= REF_SIMILAR_METERS and alike):
                if best is None or meters < best[0]:
                    best = (meters, s)
            else:
                summary.numbers_too_far += 1
        if best is not None:
            meters, s = best
            if s not in claims or meters < claims[s][0]:
                claims[s] = (meters, o)
    matches: dict[int, OsmMatch] = {
        s: OsmMatch(osm[o], BY_NUMBER, round(meters, 1)) for s, (meters, o) in claims.items()
    }
    used_osm = {o for _, o in claims.values()}
    summary.by_number = len(matches)

    # 2. By place, for the stops left: each OpenStreetMap stop's nearest SEPTA stop not taken by
    # a number, unless the next one is about as close.
    tree = shapely.STRtree(septa_m)
    pairs: list[tuple[float, int, int]] = []
    for o in range(len(osm)):
        if o in used_osm:
            continue
        near = tree.query(osm_m[o], predicate="dwithin", distance=PLACE_METERS * AMBIGUOUS_RATIO)
        ranked = sorted(
            (float(shapely.distance(osm_m[o], septa_m[s])), s)
            for s in near.tolist()
            if s not in matches
        )
        if not ranked or ranked[0][0] > PLACE_METERS:
            continue
        if len(ranked) > 1:
            first, second = ranked[0][0], ranked[1][0]
            if second - first < AMBIGUOUS_GAP and second < AMBIGUOUS_RATIO * max(first, 1.0):
                summary.ambiguous += 1
                continue
        pairs.append((ranked[0][0], o, ranked[0][1]))
    # Closest pairs first; an OpenStreetMap stop whose SEPTA stop went to a closer one stays
    # unmatched rather than taking its second choice.
    pairs.sort(key=lambda p: (p[0], osm[p[1]].id, septa[p[2]].sid))
    for meters, o, s in pairs:
        if o in used_osm or s in matches:
            continue
        matches[s] = OsmMatch(osm[o], BY_PLACE, round(meters, 1))
        used_osm.add(o)
        summary.by_place += 1
    return matches, summary


# ---------------------------------------------------------------------------------------------
# Factors


def rank(values: Sequence[float | None]) -> list[int | None]:
    """The share of the present values that are strictly lower, 0 to 100; None stays None."""
    from placekeepers.derive.lenses import rank_or_none

    return rank_or_none(values)


def yes_no_need(answer: int | None, covered: int | None = None) -> int:
    """100 when a survey found it missing, 0 when it is there, NOT_SURVEYED when unknown."""
    if covered == 1 or answer == 1:
        return 0
    if answer == 0:
        return 100
    return NOT_SURVEYED


def canopy_near(
    lats: Sequence[float], lngs: Sequence[float], paths: Mapping[str, Path]
) -> list[float | None]:
    """Percent of the land in each stop's H3 cell covered by tree canopy in 2018, or None
    without canopy data. Land is inside the city's census tracts and not water, as for the
    violence lens (placekeepers.derive.lenses)."""
    from placekeepers.derive.lenses import (
        canopy_by_cell,
        land_by_cell,
        load_tracts,
        water_shapes,
    )

    if "tree_canopy_2018" not in paths:
        return [None] * len(lats)
    canopy = canopy_by_cell(paths["tree_canopy_2018"])
    cells = [
        h3.latlng_to_cell(lat, lng, H3_RESOLUTION) for lat, lng in zip(lats, lngs, strict=True)
    ]
    city = None
    if "census_tracts_2020" in paths:
        _, city = load_tracts(paths["census_tracts_2020"])
    land = land_by_cell(sorted(set(cells)), city, water_shapes(paths.get("land_use")))
    out: list[float | None] = []
    for cell in cells:
        area = land.get(cell, 0.0)
        out.append(round(min(100.0, 100.0 * canopy.get(cell, 0.0) / area), 1) if area > 0 else None)
    return out


def heat_exposure(
    lats: Sequence[float], lngs: Sequence[float], path: Path | None
) -> list[float | None]:
    """The heat exposure score of the census tract each stop stands in, or None."""
    if path is None:
        return [None] * len(lats)
    table = pq.read_table(path, columns=["hei_score", "geometry"])
    scores = table.column("hei_score").to_pylist()
    shapes = np.array(
        [
            shapely.from_wkb(w) if w else shapely.Point()
            for w in table.column("geometry").to_pylist()
        ],
        dtype=object,
    )
    points = shapely.points(np.column_stack([lngs, lats])) if len(lats) else np.array([])
    out: list[float | None] = [None] * len(lats)
    if not len(lats):
        return out
    point_index, shape_index = shapely.STRtree(shapes).query(points, predicate="within")
    for p, s in zip(point_index.tolist(), shape_index.tolist(), strict=True):
        if out[p] is None and scores[s] is not None:
            out[p] = float(scores[s])
    return out


def near_hin(lats: Sequence[float], lngs: Sequence[float], path: Path | None) -> list[bool] | None:
    """Whether each stop stands within HIN_METERS of the High Injury Network; None without it."""
    if path is None:
        return None
    lines = [
        shapely.from_wkb(w)
        for w in pq.read_table(path, columns=["geometry"]).column(0).to_pylist()
        if w
    ]
    if not lines or not len(lats):
        return [False] * len(lats)
    lines_m = to_meters(np.array(lines, dtype=object))
    points = points_in_meters(list(lats), list(lngs))
    hits, _ = shapely.STRtree(lines_m).query(points, predicate="dwithin", distance=HIN_METERS)
    flags = [False] * len(lats)
    for index in hits.tolist():
        flags[index] = True
    return flags


# ---------------------------------------------------------------------------------------------
# Suggestions


def stop_suggestions(props: Mapping[str, object], known: set[str] | None = None) -> list[str]:
    """The suggestion ids for a stop with these tile properties (module docstring), limited to
    the suggestions the registry has."""
    shelter, bench, lit, covered = (props.get(k) for k in ("sh", "bn", "li", "cv"))
    shelter_known = shelter is not None or covered == 1
    found: list[str] = []
    if not shelter_known or bench is None:
        found.append("stop_survey")
    if shelter == 0 and covered != 1:
        found.append("stop_shelter_request")
    if bench == 0:
        found.append("stop_bench_request")
    if lit == 0:
        found.append("stop_streetlight_report")
    shade = props.get("f_shade")
    if isinstance(shade, int) and shade >= SHADE_FROM:
        found.append("stop_shade_trees")
    return [s for s in found if known is None or s in known]


# ---------------------------------------------------------------------------------------------
# Everything for the stops on the map


@dataclass
class ComfortResult:
    #: the tile properties to add to each stop, in the order the stops were given
    properties: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    summary: MatchSummary = field(default_factory=MatchSummary)


def comfort_for_stops(
    stops: Sequence[SeptaStop],
    boardings: Sequence[int | None],
    midday_waits: Sequence[int | None],
    paths: Mapping[str, Path],
    known_suggestions: set[str] | None = None,
) -> ComfortResult:
    """The amenity answers, lens factors and suggestions for SEPTA's bus and trolley stops on the
    map (module docstring). Ranks are among these stops."""
    result = ComfortResult(properties=[{} for _ in stops])
    if not stops:
        return result
    lats = [s.lat for s in stops]
    lngs = [s.lng for s in stops]

    # What riders find, from OpenStreetMap.
    matches: dict[int, OsmMatch] = {}
    if "osm_philadelphia" in paths:
        columns = [
            "osm_type",
            "osm_id",
            "tags",
            "lat",
            "lng",
            "in_city",
            "extract_date",
            "geometry",
        ]
        osm_stops, _ = find_stops(pq.read_table(paths["osm_philadelphia"], columns=columns))
        matches, result.summary = match_osm(stops, [s for s in osm_stops if s.in_city])
    else:
        result.notes.append("transit comfort: OpenStreetMap is missing, so no stop is surveyed")
    for index, match in matches.items():
        answers = match.stop.answers
        props = result.properties[index]
        props["o"] = match.stop.id
        props["om"] = match.how
        props["a"] = match.stop.c
        for key, short in (("shelter", "sh"), ("bench", "bn"), ("lit", "li"), ("covered", "cv")):
            if answers.get(key) is not None:
                props[short] = int(answers[key])

    # The factors.
    shade = canopy_near(lats, lngs, paths)
    heat = heat_exposure(lats, lngs, paths.get("heat_vulnerability"))
    hin = near_hin(lats, lngs, paths.get("high_injury_network"))
    columns = {
        "f_riders": rank(list(boardings)),
        "f_noshelter": [yes_no_need(p.get("sh"), p.get("cv")) for p in result.properties],
        "f_nobench": [yes_no_need(p.get("bn")) for p in result.properties],
        # Less canopy ranks higher: the share of stops with strictly more canopy.
        "f_shade": rank([None if c is None else -c for c in shade]),
        "f_heat": rank(heat),
        "f_hin": [None] * len(stops) if hin is None else [100 if h else 0 for h in hin],
        "f_wait": rank([float(w) if w else None for w in midday_waits]),
    }
    for index, props in enumerate(result.properties):
        for name in FACTORS:
            value = columns[name][index]
            if value is not None:
                props[name] = int(value)
        if shade[index] is not None:
            props["cp"] = int(round(shade[index]))
        if hin is not None and hin[index]:
            props["hin"] = 1
    for props in result.properties:
        found = stop_suggestions(props, known_suggestions)
        if found:
            props["sg"] = ",".join(found)

    result.notes.extend(_notes(result, len(stops), paths))
    return result


def _notes(result: ComfortResult, total: int, paths: Mapping[str, Path]) -> list[str]:
    s = result.summary
    notes = []
    if "osm_philadelphia" in paths:
        statuses = [p.get("a") for p in result.properties]
        surveyed = sum(1 for p in result.properties if p.get("a") not in (None, UNKNOWN))
        notes.append(
            f"transit comfort: {s.matched:,} of the {s.osm_stops:,} OpenStreetMap stops in the "
            f"city match one of {total:,} SEPTA bus and trolley stops ({s.by_number:,} by SEPTA's "
            f"stop number, {s.by_place:,} by place within {PLACE_METERS:g} meters); "
            f"{plural(s.ambiguous, 'stop was', 'stops were')} left unmatched between two SEPTA "
            f"stops about as close, and {plural(s.numbers_too_far, 'number names', 'numbers name')}"
            " a SEPTA stop too far away to be the same stop"
        )
        notes.append(
            f"transit comfort: {surveyed:,} SEPTA stops have their shelter or bench surveyed "
            f"({statuses.count(3):,} with a shelter or roof, {statuses.count(2):,} with a bench "
            f"but no shelter mapped, {statuses.count(1):,} with neither); the other "
            f"{total - surveyed:,} are not yet surveyed (an answer no one has given yet counts "
            "halfway)"
        )
    missing = [
        source
        for source in ("tree_canopy_2018", "heat_vulnerability", "high_injury_network")
        if source not in paths
    ]
    if missing:
        notes.append(f"transit comfort: without {', '.join(missing)}, their factors are left out")
    suggested = {name: 0 for name in SUGGESTIONS}
    for props in result.properties:
        for name in str(props.get("sg") or "").split(","):
            if name in suggested:
                suggested[name] += 1
    notes.append(
        "transit comfort suggestions: "
        + ", ".join(f"{name} {count:,}" for name, count in suggested.items())
    )
    return notes
