"""Streets and stops (M4.5, issue #41): the City's bus shelters, street poles, traffic calming
devices and school crossing guard posts on the map (docs/CONTRACTS.md section 4).

* `shelters` in tiles/transit.pmtiles: every shelter on the City's list, with the SEPTA stop it
  stands at when it matches one (placekeepers.derive.streets_stops.match_shelters). SEPTA's
  stops carry the count as `cs` (publish/transit.py), and the transit comfort lens counts it.
* `poles` in tiles/poles.pmtiles: every pole the Streets Department lists, close in only (the file
  holds zoom 15), with its number, the kind of lamp the City lists and its owner. The street
  blocks (`segments`) and the 311 street light blocks (`lights`) carry the counts per block.
* `calming` in tiles/streets.pmtiles: every traffic calming device, with the day it went in and
  the street it is on. The blocks carry how many and since when.
* `guards` in tiles/streets.pmtiles: every corner where the City posts a school crossing guard,
  with the nearest school within 400 meters. A safety service, never enforcement.

Counts per block are worked out once per publish and shared by the layers that carry them.
"""

from __future__ import annotations

import functools
import logging
from collections import Counter
from datetime import date
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.derive.memorials import CALMING_CLASSES
from placekeepers.derive.street_safety import (
    SCHOOL_METERS,
    StreetNetwork,
    in_philadelphia,
    plural,
    points_in_meters,
    to_meters,
)
from placekeepers.derive.streets_stops import (
    LAMP_LED,
    NO_LAMP,
    POLE_BLOCK_METERS,
    BlockCalming,
    BlockPoles,
    CityShelter,
    ShelterMatch,
    calming_on_blocks,
    install_day,
    lamp_kind,
    load_city_shelters,
    match_shelters,
    owner_code,
    poles_on_blocks,
    shelter_place,
    summarize_shelters,
    title_street,
)
from placekeepers.geo import GeoJSONWriter
from placekeepers.publish.layers import BuildResult, LayerBuilder
from placekeepers.publish.streets import STREETS_FILE, street_network

log = logging.getLogger(__name__)

POLES_FILE = "tiles/poles.pmtiles"
SHELTERS = "bus_shelters"
POLES = "street_poles"
CALMING = "traffic_calming"
GUARDS = "crossing_guards"
#: Poles with a lamp the City lists this close to a SEPTA stop count for the stop (`lp`, `le`).
STOP_LAMP_METERS = 30.0
#: The suggestion a High Injury Network block where people were hurt gets when no traffic calming
#: is recorded there and the street may qualify (registry/suggestions.yaml).
TRAFFIC_CALMING = "traffic_calming_petition"


def _point(lng: float, lat: float) -> dict:
    return {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}


def _points(path: Path, columns: list[str]) -> list[dict]:
    """The rows of a point snapshot inside a box around the city, with `lng` and `lat`."""
    table = pq.read_table(path, columns=[*columns, "geometry"])
    rows = []
    for row in table.to_pylist():
        wkb = row.pop("geometry")
        point = shapely.from_wkb(wkb) if wkb else None
        if point is None or point.is_empty or not in_philadelphia(point.y, point.x):
            continue
        row["lng"], row["lat"] = point.x, point.y
        rows.append(row)
    return rows


# ---------------------------------------------------------------------------------------------
# Counts per block, once per publish


@functools.lru_cache(maxsize=2)
def _pole_table(path: str, mtime: float) -> tuple[np.ndarray, np.ndarray, list[int], list]:
    table = pq.read_table(path, columns=["pole_num", "nlumin", "owner", "bulb_type", "geometry"])
    points = shapely.from_wkb(table.column("geometry").to_numpy(zero_copy_only=False))
    lngs, lats = shapely.get_x(points), shapely.get_y(points)
    kinds = [
        lamp_kind(bulb, lamps)
        for bulb, lamps in zip(
            table.column("bulb_type").to_pylist(), table.column("nlumin").to_pylist(), strict=True
        )
    ]
    rest = list(
        zip(table.column("pole_num").to_pylist(), table.column("owner").to_pylist(), strict=True)
    )
    return lngs, lats, kinds, rest


def pole_table(path: Path) -> tuple[np.ndarray, np.ndarray, list[int], list]:
    """Every pole's longitude, latitude, kind of lamp, and number and owner, read once."""
    return _pole_table(str(path), path.stat().st_mtime)


@functools.lru_cache(maxsize=2)
def _block_poles(centerlines: str, c_time: float, poles: str, p_time: float) -> BlockPoles:
    network = street_network(Path(centerlines))
    lngs, lats, kinds, _ = pole_table(Path(poles))
    return poles_on_blocks(network, points_in_meters(lats, lngs), kinds)


def block_poles(paths: dict[str, Path]) -> BlockPoles | None:
    """Poles per street block, or None without the poles or the centerlines."""
    if POLES not in paths or "street_centerlines" not in paths:
        return None
    c, p = paths["street_centerlines"], paths[POLES]
    return _block_poles(str(c), c.stat().st_mtime, str(p), p.stat().st_mtime)


@functools.lru_cache(maxsize=2)
def _calming_table(path: str, mtime: float) -> list[dict]:
    rows = _points(Path(path), ["objectid", "id", "seg_id", "install_dt"])
    return sorted(rows, key=lambda r: r["objectid"] or 0)


def calming_rows(path: Path) -> list[dict]:
    return _calming_table(str(path), path.stat().st_mtime)


@functools.lru_cache(maxsize=2)
def _block_calming(centerlines: str, c_time: float, calming: str, k_time: float) -> BlockCalming:
    network = street_network(Path(centerlines))
    rows = calming_rows(Path(calming))
    return calming_on_blocks(
        network,
        [r["seg_id"] for r in rows],
        points_in_meters([r["lat"] for r in rows], [r["lng"] for r in rows]),
        [install_day(r["install_dt"]) for r in rows],
    )


def block_calming(paths: dict[str, Path]) -> BlockCalming | None:
    """Traffic calming devices per street block, or None without them or the centerlines."""
    if CALMING not in paths or "street_centerlines" not in paths:
        return None
    c, k = paths["street_centerlines"], paths[CALMING]
    return _block_calming(str(c), c.stat().st_mtime, str(k), k.stat().st_mtime)


def pole_properties(poles: BlockPoles | None, index: int) -> dict:
    """`pl`, `lp` and `le` of one block (docs/CONTRACTS.md section 4, `segments`)."""
    if poles is None:
        return {}
    props = {"pl": poles.poles[index]}
    if poles.lamps[index]:
        props["lp"] = poles.lamps[index]
        props["le"] = poles.led[index]
    return props


def calming_properties(calming: BlockCalming | None, index: int, hurt_on_hin: bool) -> dict:
    """`tc` and `ty` of one block: the devices the City lists and the year of the first, or `tc`
    0 on a High Injury Network block where people were hurt and none is recorded."""
    if calming is None:
        return {}
    devices = calming.devices[index]
    if devices:
        first = calming.first[index]
        return {"tc": devices, **({"ty": first.year} if first else {})}
    return {"tc": 0} if hurt_on_hin else {}


def may_ask_for_calming(network: StreetNetwork, index: int) -> bool:
    """The street may qualify for the City's traffic calming program: a collector or a local
    street that is not a state road (the crash sites' rule, placekeepers.derive.memorials)."""
    return network.classes[index] in CALMING_CLASSES and network.responsible[index] != "STATE"


def lamps_near(paths: dict[str, Path], lats: list[float], lngs: list[float]) -> list[dict]:
    """For each point (a SEPTA stop), the poles with a lamp the City lists within
    STOP_LAMP_METERS (`lp`) and how many of those are LED (`le`); empty without the poles."""
    if POLES not in paths or not lats:
        return [{} for _ in lats]
    p_lngs, p_lats, kinds, _ = pole_table(paths[POLES])
    lit = np.array([k != NO_LAMP for k in kinds])
    led = np.array([k == LAMP_LED for k in kinds])
    lamp_m = points_in_meters(p_lats[lit], p_lngs[lit])
    led_of_lamp = led[lit]
    stops_m = points_in_meters(lats, lngs)
    stop_index, lamp_index = shapely.STRtree(lamp_m).query(
        stops_m, predicate="dwithin", distance=STOP_LAMP_METERS
    )
    lamps = np.bincount(stop_index, minlength=len(lats))
    leds = np.bincount(stop_index, weights=led_of_lamp[lamp_index], minlength=len(lats))
    return [{"lp": int(n), "le": int(e)} for n, e in zip(lamps, leds, strict=True)]


# ---------------------------------------------------------------------------------------------
# City shelters


def shelters_at_stops(
    paths: dict[str, Path], stops
) -> tuple[list[CityShelter], dict[int, ShelterMatch]]:
    """The City's shelters and which of `stops` (SeptaPoint) each stands at."""
    shelters = load_city_shelters(paths[SHELTERS])
    return shelters, match_shelters(shelters, stops)


def shelter_name(site: str) -> str:
    """The site's name for people (derive.streets_stops.shelter_place), with SEPTA's side of the
    street in words, as the stops say it."""
    from placekeepers.publish.transit import display_name

    text, corner = shelter_place(site)
    name = display_name(text)
    return f"{name}, {corner} corner" if corner else name


def build_city_shelters(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    from placekeepers.publish.transit import street_stops

    stops = street_stops(paths) if "septa_gtfs" in paths else []
    shelters, matches = shelters_at_stops(paths, [point for _, point in stops])
    with GeoJSONWriter(out) as writer:
        for index, shelter in enumerate(shelters):
            props: dict = {"id": shelter.id, "nm": shelter_name(shelter.site)}
            if shelter.listed:
                props["sid"] = shelter.listed
            if shelter.digital:
                props["dg"] = 1
            match = matches.get(index)
            if match is not None:
                props["st"] = stops[match.stop][0]
                props["m"] = match.how
            writer.write(props, _point(shelter.lng, shelter.lat))
    summary = summarize_shelters(shelters, matches)
    notes = [
        f"shelters: {writer.count:,} bus shelters on the City's list, {summary.matched:,} at "
        f"{summary.stops:,} SEPTA stops ({summary.by_number:,} by stop number, "
        f"{summary.by_place:,} by place); {writer.count - summary.matched:,} match no stop"
    ]
    if not stops:
        notes.append("shelters: SEPTA's schedules are missing, so no shelter is matched to a stop")
    return BuildResult(writer.count, notes)


# ---------------------------------------------------------------------------------------------
# Street poles


def build_poles(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    lngs, lats, kinds, rest = pole_table(paths[POLES])
    order = sorted(range(len(kinds)), key=lambda i: (rest[i][0] is None, rest[i][0] or 0, i))
    left_out = 0
    counts: Counter[int] = Counter()
    with GeoJSONWriter(out) as writer:
        for i in order:
            lng, lat = float(lngs[i]), float(lats[i])
            if not np.isfinite(lng) or not in_philadelphia(lat, lng):
                left_out += 1
                continue
            counts[kinds[i]] += 1
            number, owner = rest[i]
            props: dict = {"k": kinds[i]}
            if number is not None:
                props["id"] = int(number)
            code = owner_code(owner)
            if code is not None:
                props["o"] = code
            writer.write(props, _point(lng, lat))
    lamps = writer.count - counts[NO_LAMP]
    notes = [
        f"poles: {writer.count:,} street poles the City lists; {lamps:,} with a lamp the City "
        f"lists, {counts[LAMP_LED]:,} of them LED"
        + (f"; {left_out:,} without a usable point left out" if left_out else "")
    ]
    poles = block_poles(paths)
    if poles is not None:
        notes.append(
            f"poles: {len(kinds) - poles.unmatched:,} counted on the nearest street block within "
            f"{POLE_BLOCK_METERS:g} meters; "
            f"{plural(poles.unmatched, 'pole stands', 'poles stand')} farther from any street "
            "that carries traffic"
        )
    return BuildResult(writer.count, notes)


# ---------------------------------------------------------------------------------------------
# Traffic calming and crossing guards


def build_calming(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    rows = calming_rows(paths[CALMING])
    calming = block_calming(paths)
    network = street_network(paths["street_centerlines"]) if calming is not None else None
    with GeoJSONWriter(out) as writer:
        for k, row in enumerate(rows):
            props: dict = {"id": int(row["objectid"])}
            day = install_day(row["install_dt"])
            if day is not None:
                props["d"] = day.isoformat()
            project = str(row["id"] or "").strip().upper()
            if project:
                props["p"] = project
            if calming is not None and network is not None:
                block = calming.blocks[k]
                if block is not None:
                    props["s"] = network.ids[block]
                    props["name"] = network.names[block]
            writer.write(props, _point(row["lng"], row["lat"]))
    notes = []
    if calming is not None:
        blocks = sum(1 for n in calming.devices if n)
        notes.append(
            f"calming: {writer.count:,} traffic calming devices on {blocks:,} street blocks "
            f"({calming.by_id:,} by the City's block id, {calming.by_place:,} on the nearest "
            f"block); {plural(calming.unmatched, 'device is', 'devices are')} on no block"
        )
    else:
        notes.append(f"calming: {writer.count:,} traffic calming devices; no street blocks")
    return BuildResult(writer.count, notes)


def build_guards(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    rows = _points(paths[GUARDS], ["objectid", "address"])
    rows.sort(key=lambda r: r["objectid"] or 0)
    schools: list[tuple[str, object]] = []
    if "schools" in paths:
        table = pq.read_table(paths["schools"], columns=["school_name", "geometry"])
        for name, wkb in zip(
            table.column("school_name").to_pylist(),
            table.column("geometry").to_pylist(),
            strict=True,
        ):
            point = shapely.from_wkb(wkb) if wkb else None
            if name and point is not None and not point.is_empty:
                schools.append((title_street(str(name)), point))
    nearest_school: list[str | None] = [None] * len(rows)
    if schools and rows:
        school_m = to_meters(np.array([p for _, p in schools], dtype=object))
        guard_m = points_in_meters([r["lat"] for r in rows], [r["lng"] for r in rows])
        hit, school = shapely.STRtree(school_m).query_nearest(
            guard_m, max_distance=SCHOOL_METERS, all_matches=False
        )
        for g, s in zip(hit.tolist(), school.tolist(), strict=True):
            nearest_school[g] = schools[s][0]
    with GeoJSONWriter(out) as writer:
        for row, school_name in zip(rows, nearest_school, strict=True):
            props: dict = {"id": int(row["objectid"])}
            place = title_street(str(row["address"] or ""))
            if place:
                props["pl"] = place
            if school_name:
                props["sn"] = school_name
            writer.write(props, _point(row["lng"], row["lat"]))
    near = sum(1 for name in nearest_school if name)
    notes = [
        f"guards: {writer.count:,} school crossing guard posts; {near:,} within "
        f"{SCHOOL_METERS:g} meters of a school on the City's list"
    ]
    return BuildResult(writer.count, notes)


STREETS_STOPS_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        "tiles/transit.pmtiles",
        "shelters",
        (SHELTERS,),
        build_city_shelters,
        # SEPTA's stops and the city's shape, to match each shelter to its stop.
        extras=("septa_gtfs", "council_districts"),
    ),
    LayerBuilder(POLES_FILE, "poles", (POLES,), build_poles, extras=("street_centerlines",)),
    LayerBuilder(
        STREETS_FILE, "calming", (CALMING,), build_calming, extras=("street_centerlines",)
    ),
    LayerBuilder(STREETS_FILE, "guards", (GUARDS,), build_guards, extras=("schools",)),
)
