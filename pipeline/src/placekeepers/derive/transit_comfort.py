"""The transit comfort lens and the suggestions for bus and trolley stops (M2.3).

For every SEPTA bus and trolley stop on the map (`stops` in tiles/transit.pmtiles), this module
finds the stop in OpenStreetMap, carries over what riders find there, computes the lens factors
(registry/lenses.yaml, `transit_comfort`) and decides which suggestions the stop gets. The method
in plain words is in docs/TRANSIT_METHOD.md; the evidence behind each factor in docs/EVIDENCE.md.

**Finding a SEPTA stop in OpenStreetMap** uses `match_septa` (placekeepers.derive.bus_stops), the
same pairing the route survey sheets use (M2.4), so a stop's sheet and its details on the map
always describe the same OpenStreetMap stop: first by SEPTA's stop number (an OpenStreetMap stop's
`ref` or `gtfs:stop_id` naming the SEPTA stop's number today or one it had before), then by
distance, both only within SAME_STOP_METERS (15 meters), closest pairs first, each stop once. A
number naming a stop farther away, or one with another SEPTA stop clearly closer, is ignored: on
Frankford Avenue a run of OpenStreetMap stops carries the numbers of the stops across the street
while each stands on another SEPTA stop. By distance an OpenStreetMap stop pairs only with its
nearest SEPTA stop, never a farther one across the street. `om`
records whether the stop numbers agree (BY_NUMBER) or the two only stand at the same place
(BY_PLACE).

**What riders find** comes from the matched OpenStreetMap stop: `a` (its `c`: 3 a shelter or roof,
2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed) and the shelter, bench and light
answers (`sh`, `bn`, `li`, 1 yes and 0 no, absent when unknown). A SEPTA stop that OpenStreetMap
does not have yet gets none of these: not yet surveyed, never "missing".

**The City's shelters** (M4.5, issue #41): `cs` counts the shelters on the City's own list at the
stop (placekeepers.derive.streets_stops.match_shelters: by SEPTA's stop number, then by place).
It is the City's data, so it is published on the stop. The lens counts a City shelter as a
shelter (`f_noshelter` 0) whatever OpenStreetMap says. Where the City lists a shelter and
OpenStreetMap says there is none, the two disagree: neither wins silently, the stop's page says
so, and the stop gets the suggestion to survey it (a survey settles it) instead of asking the City
for a shelter it already lists.

**Never stored with SEPTA's data** (decision D1 of docs/VERIFICATION_V0_2.md). OpenStreetMap's
answers, and everything worked out only from them (OSM_FIELDS, OSM_SUGGESTIONS), are never
published on SEPTA's stop records: the combination would be a derivative database the Open
Database License asks to be shared under it, which SEPTA's license does not let us grant. The
published stop carries only the matched OpenStreetMap id (`o`) as a link and IN_LENS (`tc`) for a
stop the lens scores; the web app joins the answers from tables/stop_amenities.json in the
visitor's browser and applies the same rules (pipeline/tests/fixtures/stop_join_parity.json keeps
the two in step). This module still works out the whole picture, for the build notes and tests
(`ComfortResult.joined`).

**Factors**, each 0 to 100 among the bus and trolley stops on the map (docs/CONTRACTS.md section 1,
lenses). A factor with no data for a stop is left out of its average, as in every lens, with one
exception: a shelter or bench no one has surveyed yet counts as NOT_SURVEYED (50), halfway between
having one (0) and not (100). Leaving them out would let a stop known only for its heat and its
street top the ranking, and counting them as missing would score the stop as if it had nothing;
halfway does neither, and the stop gets the suggestion to survey it.

* `f_riders`: weekday boardings, SEPTA's count; the share of stops with fewer. Left out where
  SEPTA has no count yet.
* `f_noshelter`: 100 when a survey found no shelter, 0 when there is one (or the whole stop is
  under a roof, or the City lists a shelter there), 50 when not yet surveyed.
* `f_nobench`: 100 when a survey found no bench, 0 when there is one, 50 when not yet surveyed.
* `f_shade`: how little tree canopy covers the land of the stop's H3 cell (resolution 9, about two
  blocks across; canopy of 2018, water left out); the share of stops with more canopy.
* `f_heat`: the heat exposure score of the stop's census tract (the City's heat vulnerability
  data); the share of stops in cooler tracts.
* `f_hin`: 100 when the stop stands within HIN_METERS of the High Injury Network, else 0.
* `f_wait`: the typical wait between departures from 10 to 2 on weekdays; the share of stops with
  shorter waits. Left out for a stop with no midday service.

**Suggestions** (registry/suggestions.yaml), in this order: survey the stop first when its shelter
or bench is not known yet, or when the City lists a shelter OpenStreetMap says is not there; ask
for a shelter where a survey found none and the City lists none; ask for a bench where a
survey found none; report a dark streetlight where OpenStreetMap says the stop is not lit; plant
shade trees where the stop is among the quarter with the least canopy (`f_shade` of SHADE_FROM or
more). Only the last is published in `sg`; the browser works out the other four.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path

import h3
import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.derive.bus_stops import (
    SAME_STOP_METERS,
    UNKNOWN,
    SeptaPoint,
    Stop,
    find_stops,
    match_septa,
    stop_numbers,
)
from placekeepers.derive.street_safety import plural, points_in_meters, to_meters
from placekeepers.derive.streets_stops import (
    ShelterSummary,
    load_city_shelters,
    match_shelters,
    summarize_shelters,
)

log = logging.getLogger(__name__)

#: A stop this close to a High Injury Network street is on it (riders cross it).
HIN_METERS = 30.0
#: Shade trees are suggested for the quarter of stops with the least canopy nearby.
SHADE_FROM = 75
#: A shelter or bench no one has surveyed yet: halfway between having one (0) and not (100).
NOT_SURVEYED = 50
#: The trolley tunnel stations under Center City and University City, from 13th Street to 37th
#: Street, where routes T1 to T5 stop underground, by SEPTA stop number (as in SEPTA's schedules
#: v202609270). A shelter, a bench, shade trees or a survey with StreetComplete make no sense on
#: a platform underground, and the route survey sheets already tell people to leave these
#: stations out, so the lens leaves them out too, like the subway, El and Regional Rail stations
#: (found by the v0.2 review, docs/VERIFICATION_V0_2.md). A stop renumbered in place keeps its
#: old number in its history, which counts too.
TUNNEL_STATIONS = frozenset(
    {
        "283",  # 13th St
        "20659",  # 15th St/City Hall
        "31140",
        "20646",  # 19th St
        "20660",
        "20645",  # 22nd St
        "20661",
        "20643",  # Drexel Station at 30th St
        "20662",
        "20642",  # 33rd St
        "20658",
        "20732",  # 36th St and Sansom St
        "20733",
        "20731",  # 37th St and Spruce St
        "20734",
    }
)
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

#: Worked out only from what OpenStreetMap says at the stop: never published on SEPTA's stops
#: (decision D1, module docstring). The browser joins them from tables/stop_amenities.json.
OSM_FIELDS = frozenset({"a", "om", "sh", "bn", "li", "cv", "f_noshelter", "f_nobench"})
OSM_SUGGESTIONS = frozenset(
    {"stop_survey", "stop_shelter_request", "stop_bench_request", "stop_streetlight_report"}
)
#: The published property counting the shelters on the City's own list at the stop (M4.5).
CITY_SHELTER = "cs"
#: The published property that marks a stop the lens scores (bus and trolley stops on the street;
#: not the stations, nor the trolley tunnel stations): the browser gives it the halfway answers.
IN_LENS = "tc"

#: Sources the factors read, each optional: without one, its factor is left out. Without the
#: City's shelters, only OpenStreetMap's answers say whether a stop has a shelter.
SOURCES = (
    "bus_shelters",
    "tree_canopy_2018",
    "census_tracts_2020",
    "land_use",
    "heat_vulnerability",
    "high_injury_network",
)
#: Read only to link each stop to OpenStreetMap's by id (`o`); its data is published elsewhere.
LINKS = ("osm_philadelphia",)


@dataclass(frozen=True)
class SeptaStop:
    """A SEPTA bus or trolley stop on the map, as the matching needs it."""

    sid: str
    former: tuple[str, ...]
    lat: float
    lng: float


@dataclass(frozen=True)
class OsmMatch:
    stop: Stop
    how: int
    meters: float


@dataclass
class MatchSummary:
    #: OpenStreetMap stops inside the city
    osm_stops: int = 0
    #: SEPTA stops matched where the stop numbers agree, and by place alone
    by_number: int = 0
    by_place: int = 0
    #: OpenStreetMap stops in the city whose number names a SEPTA stop they were not matched to
    #: (farther than SAME_STOP_METERS, as on Frankford Avenue)
    numbers_elsewhere: int = 0

    @property
    def matched(self) -> int:
        return self.by_number + self.by_place


def match_osm(
    septa: Sequence[SeptaStop], osm: Sequence[Stop]
) -> tuple[dict[int, OsmMatch], MatchSummary]:
    """Which OpenStreetMap stop is which SEPTA stop: `match_septa`, as for the route survey sheets
    (module docstring). Returns the matches by the index of the SEPTA stop, and counts for the
    build notes."""
    summary = MatchSummary(osm_stops=sum(1 for stop in osm if stop.in_city))
    if not septa or not osm:
        return {}, summary
    pairs = match_septa(osm, [SeptaPoint(s.sid, s.former, s.lat, s.lng) for s in septa])
    septa_m = points_in_meters([s.lat for s in septa], [s.lng for s in septa])
    osm_m = points_in_meters([s.lat for s in osm], [s.lng for s in osm])
    matches: dict[int, OsmMatch] = {}
    for s, o in pairs.items():
        agree = bool(set(stop_numbers(osm[o])) & {septa[s].sid, *septa[s].former})
        meters = round(float(shapely.distance(osm_m[o], septa_m[s])), 1)
        matches[s] = OsmMatch(osm[o], BY_NUMBER if agree else BY_PLACE, meters)
    summary.by_number = sum(1 for m in matches.values() if m.how == BY_NUMBER)
    summary.by_place = len(matches) - summary.by_number

    by_number: dict[str, int] = {}
    for index, stop in enumerate(septa):
        for number in (stop.sid, *stop.former):
            by_number.setdefault(number, index)
    paired = {o: s for s, o in pairs.items()}
    for o, stop in enumerate(osm):
        named = {by_number[n] for n in stop_numbers(stop) if n in by_number}
        if stop.in_city and named and paired.get(o) not in named:
            summary.numbers_elsewhere += 1
    return matches, summary


# ---------------------------------------------------------------------------------------------
# Factors


def rank(values: Sequence[float | None]) -> list[int | None]:
    """The share of the present values that are strictly lower, 0 to 100; None stays None."""
    from placekeepers.derive.lenses import rank_or_none

    return rank_or_none(values)


def yes_no_need(answer: int | None, covered: int | None = None, city: object = None) -> int:
    """100 when a survey found it missing, 0 when it is there (or, for a shelter, the City lists
    one: `city`, the stop's `cs`), NOT_SURVEYED when unknown."""
    if covered == 1 or answer == 1 or (isinstance(city, int) and city > 0):
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


def city_shelters(props: Mapping[str, object]) -> int:
    """How many shelters the City lists at the stop (`cs`), 0 when none."""
    value = props.get(CITY_SHELTER)
    return value if isinstance(value, int) and value > 0 else 0


def disagree(props: Mapping[str, object]) -> bool:
    """The City lists a shelter at the stop, and OpenStreetMap says there is none (and that the
    stop is not under a roof)."""
    return city_shelters(props) > 0 and props.get("sh") == 0 and props.get("cv") != 1


def stop_suggestions(props: Mapping[str, object], known: set[str] | None = None) -> list[str]:
    """The suggestion ids for a stop with these tile properties (module docstring), limited to
    the suggestions the registry has."""
    shelter, bench, lit, covered = (props.get(k) for k in ("sh", "bn", "li", "cv"))
    city = city_shelters(props)
    shelter_known = shelter is not None or covered == 1 or city > 0
    found: list[str] = []
    if not shelter_known or bench is None or disagree(props):
        found.append("stop_survey")
    if shelter == 0 and covered != 1 and city == 0:
        found.append("stop_shelter_request")
    if bench == 0:
        found.append("stop_bench_request")
    if lit == 0:
        found.append("stop_streetlight_report")
    shade = props.get("f_shade")
    if isinstance(shade, int) and shade >= SHADE_FROM:
        found.append("stop_shade_trees")
    return [s for s in found if known is None or s in known]


def join_published(
    props: Mapping[str, object],
    entry: Mapping[str, object] | None,
    known: set[str] | None = None,
) -> dict:
    """What the visitor's browser shows for a published stop (`props`, from tiles/transit.pmtiles)
    joined with its OpenStreetMap stop's entry in tables/stop_amenities.json (None when the stop
    has no `o`, or the table has no such id): the reference the web app follows
    (web/src/transit/answers.ts, checked against tests/fixtures/stop_join_parity.json). A stop the
    lens does not score (a station) is left as it is."""
    joined = dict(props)
    if props.get(IN_LENS) != 1:
        return joined
    if entry is not None and props.get("o"):
        joined["a"] = entry["c"]
        own = {str(props.get("sid") or ""), *str(props.get("fid") or "").split(",")} - {""}
        numbers = {str(n) for n in entry.get("n") or ()}
        joined["om"] = BY_NUMBER if numbers & own else BY_PLACE
        for key, short in (("sh", "sh"), ("bn", "bn"), ("lt", "li"), ("cv", "cv")):
            if entry.get(key) is not None:
                joined[short] = entry[key]
    joined["f_noshelter"] = yes_no_need(
        joined.get("sh"), joined.get("cv"), joined.get(CITY_SHELTER)
    )
    joined["f_nobench"] = yes_no_need(joined.get("bn"))
    # The suggestions OpenStreetMap's answers decide, then the published ones, in the order a
    # stop lists them.
    found = {s for s in stop_suggestions(joined, known) if s in OSM_SUGGESTIONS}
    found |= {s for s in str(props.get("sg") or "").split(",") if s}
    ordered = [s for s in SUGGESTIONS if s in found] + sorted(found - set(SUGGESTIONS))
    joined.pop("sg", None)
    if ordered:
        joined["sg"] = ",".join(ordered)
    return joined


# ---------------------------------------------------------------------------------------------
# Everything for the stops on the map


@dataclass
class ComfortResult:
    #: the tile properties to add to each stop, in the order the stops were given: SEPTA's and
    #: the City's measures, the OpenStreetMap id as a link, never OpenStreetMap's answers
    properties: list[dict] = field(default_factory=list)
    #: the same with OpenStreetMap's answers joined, as the browser shows each stop (for the
    #: build notes and tests; never published)
    joined: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    summary: MatchSummary = field(default_factory=MatchSummary)
    #: the City's shelters matched to these stops (None without the `bus_shelters` snapshot)
    shelters: ShelterSummary | None = None


def published(joined: Mapping[str, object]) -> dict:
    """A stop's properties without OpenStreetMap's answers and what follows only from them
    (decision D1), marked as a stop the lens scores."""
    props = {k: v for k, v in joined.items() if k not in OSM_FIELDS and k != "sg"}
    props[IN_LENS] = 1
    kept = [s for s in str(joined.get("sg") or "").split(",") if s and s not in OSM_SUGGESTIONS]
    if kept:
        props["sg"] = ",".join(kept)
    return props


def comfort_for_stops(
    stops: Sequence[SeptaStop],
    boardings: Sequence[int | None],
    midday_waits: Sequence[int | None],
    paths: Mapping[str, Path],
    known_suggestions: set[str] | None = None,
) -> ComfortResult:
    """The amenity answers, lens factors and suggestions for SEPTA's bus and trolley stops on the
    map (module docstring). Ranks are among these stops. `properties` is what is published;
    `joined` adds OpenStreetMap's answers, as the browser shows them."""
    result = ComfortResult(joined=[{} for _ in stops])
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
        # Every stop, as for the route survey sheets: a SEPTA stop on the city line can stand on
        # an OpenStreetMap stop just outside it.
        matches, result.summary = match_osm(stops, osm_stops)
    else:
        result.notes.append("transit comfort: OpenStreetMap is missing, so no stop is surveyed")
    # The City's own shelters (M4.5): its data, published on the stop as `cs`.
    if "bus_shelters" in paths:
        shelters = load_city_shelters(paths["bus_shelters"])
        found = match_shelters(shelters, [SeptaPoint(s.sid, s.former, s.lat, s.lng) for s in stops])
        for match in found.values():
            props = result.joined[match.stop]
            props[CITY_SHELTER] = int(props.get(CITY_SHELTER, 0)) + 1
        result.shelters = summarize_shelters(shelters, found)
    for index, match in matches.items():
        answers = match.stop.answers
        props = result.joined[index]
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
        "f_noshelter": [
            yes_no_need(p.get("sh"), p.get("cv"), p.get(CITY_SHELTER)) for p in result.joined
        ],
        "f_nobench": [yes_no_need(p.get("bn")) for p in result.joined],
        # Less canopy ranks higher: the share of stops with strictly more canopy.
        "f_shade": rank([None if c is None else -c for c in shade]),
        "f_heat": rank(heat),
        "f_hin": [None] * len(stops) if hin is None else [100 if h else 0 for h in hin],
        "f_wait": rank([float(w) if w else None for w in midday_waits]),
    }
    for index, props in enumerate(result.joined):
        for name in FACTORS:
            value = columns[name][index]
            if value is not None:
                props[name] = int(value)
        if shade[index] is not None:
            props["cp"] = int(round(shade[index]))
        if hin is not None and hin[index]:
            props["hin"] = 1
    for props in result.joined:
        found = stop_suggestions(props, known_suggestions)
        if found:
            props["sg"] = ",".join(found)
    result.properties = [published(props) for props in result.joined]

    result.notes.extend(_notes(result, len(stops), paths))
    return result


def _notes(result: ComfortResult, total: int, paths: Mapping[str, Path]) -> list[str]:
    s = result.summary
    notes = []
    if "osm_philadelphia" in paths:
        statuses = [p.get("a") for p in result.joined]
        surveyed = sum(1 for p in result.joined if p.get("a") not in (None, UNKNOWN))
        notes.append(
            f"transit comfort: {s.matched:,} of {total:,} SEPTA bus and trolley stops match an "
            f"OpenStreetMap stop within {SAME_STOP_METERS:g} meters ({s.by_number:,} where the "
            f"stop numbers agree, {s.by_place:,} by place), of the {s.osm_stops:,} OpenStreetMap "
            f"has in the city; {plural(s.numbers_elsewhere, 'stop carries', 'stops carry')} the "
            "number of a SEPTA stop it is not paired with (farther away, or with another stop "
            "clearly closer), which is ignored"
        )
        notes.append(
            f"transit comfort: {surveyed:,} SEPTA stops have their shelter or bench surveyed "
            f"({statuses.count(3):,} with a shelter or roof, {statuses.count(2):,} with a bench "
            f"but no shelter mapped, {statuses.count(1):,} with neither); the other "
            f"{total - surveyed:,} are not yet surveyed (an answer no one has given yet counts "
            "halfway)"
        )
    if result.shelters is not None:
        c = result.shelters
        at = [p for p in result.joined if city_shelters(p) > 0]
        osm_yes = sum(1 for p in at if p.get("sh") == 1 or p.get("cv") == 1)
        osm_no = sum(1 for p in at if disagree(p))
        unknown = len(at) - osm_yes - osm_no
        notes.append(
            f"transit comfort: {c.matched:,} of the City's {c.shelters:,} bus shelters stand at "
            f"{c.stops:,} of these stops ({c.by_number:,} by SEPTA's stop number, {c.by_place:,} "
            f"by place; {c.numbered:,} name a SEPTA stop number); OpenStreetMap agrees there is a "
            f"shelter at {osm_yes:,} of those stops, says there is none at {osm_no:,} (the two "
            f"disagree, and the stop gets a survey), and has no answer at {unknown:,}"
        )
    else:
        notes.append(
            "transit comfort: the City's bus shelters are missing, so only OpenStreetMap says "
            "whether a stop has a shelter"
        )
    missing = [
        source
        for source in ("tree_canopy_2018", "heat_vulnerability", "high_injury_network")
        if source not in paths
    ]
    if missing:
        notes.append(f"transit comfort: without {', '.join(missing)}, their factors are left out")
    suggested = {name: 0 for name in SUGGESTIONS}
    for props in result.joined:
        for name in str(props.get("sg") or "").split(","):
            if name in suggested:
                suggested[name] += 1
    notes.append(
        "transit comfort suggestions: "
        + ", ".join(f"{name} {count:,}" for name, count in suggested.items())
    )
    return notes
