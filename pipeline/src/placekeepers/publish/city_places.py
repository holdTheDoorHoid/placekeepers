"""Public places from the City in tiles/places.pmtiles (M3.5, docs/CONTRACTS.md section 4).

* `libraries`: the Free Library's branches (`library_locations`).
* `recreation`: Parks and Recreation's program sites (`ppr_program_sites`): recreation centers,
  older adult centers and environmental education centers. The two pools among the program sites
  are left out: the pools are their own layer.
* `pools`: pools (`ppr_swimming_pools`), spraygrounds and sprinklers (`ppr_spraygrounds`), with
  whether each is in service this year as the City records it.
* `park_water`: drinking fountains and bottle filling stations at parks and recreation centers
  (`ppr_hydration_stations`).

Every feature is a point with `id` (the City's object id, with a prefix naming the layer, so ids
never collide between layers) and `nm` (a name to show). Everything here is the City's, under its
open data terms; OpenStreetMap's amenities are a separate file (tiles/amenities.pmtiles) because
its license asks that data built from it stay under the Open Database License.

Added 2026-10-09 by M4.7 (issue #43):

* `cooling`: the Office of Emergency Management's warming and cooling sites
  (`warming_cooling_sites`), with their status, hours and services as the City lists them. One
  place, one marker: a site that is one of our libraries or recreation centers (the same kind of
  place, at the same point, or within SAME_PLACE_M with a word of its name in common) carries that
  place's id and name (`pl`, `pn`), the library or recreation center carries the site's id (`cc`),
  and the map draws only the site's marker while both layers are on. A site listed twice is kept
  once. The City states no license for this list and the owner decided to show it with no credit
  line (registry license `unstated_uncredited`).
* `playgrounds`: Parks and Recreation's playgrounds (`ppr_playgrounds`), with the ages each is
  meant for and the year it was installed.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.geo import GeoJSONWriter
from placekeepers.publish.layers import PHILLY_LAT, PHILLY_LNG, BuildResult, LayerBuilder

log = logging.getLogger(__name__)

PLACES_FILE = "tiles/places.pmtiles"

#: `k` in `recreation`: the kind of program site.
RECREATION_KINDS = {"PPR_REC": 1, "OLDER_ADULT_CENTER": 2, "ENVIRONMENTAL_EDUCATION_CENTER": 3}
#: `k` in `pools`.
POOL, SPRAYGROUND, SPRINKLER = 1, 2, 3
#: `st` in `pools`: whether the City lists it as in service (absent when it does not know).
STATUS = {"ACTIVE": 1, "INACTIVE": 0}
#: `k` in `park_water`.
FOUNTAIN, BOTTLE_FILLER = 1, 2
#: The Free Library's own pages, the only links published from the libraries layer.
LIBRARY_LINK = re.compile(r"^https://(libwww|www)\.freelibrary\.org/\S*$")


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text or None


def _yes(value: Any) -> int | None:
    text = (_text(value) or "").upper()
    return 1 if text == "Y" else 0 if text == "N" else None


def _point(wkb: bytes | None) -> dict | None:
    if wkb is None:
        return None
    geometry = shapely.from_wkb(bytes(wkb))
    if geometry.is_empty:
        return None
    point = geometry if geometry.geom_type == "Point" else geometry.representative_point()
    lng, lat = round(point.x, 7), round(point.y, 7)
    if not (PHILLY_LAT[0] <= lat <= PHILLY_LAT[1] and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]):
        return None
    return {"type": "Point", "coordinates": [lng, lat]}


def _rows(path: Path) -> list[dict[str, Any]]:
    return pq.read_table(path).to_pylist()


def _write(out: Path, features: list[tuple[dict, dict]]) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        for properties, point in features:
            writer.write({k: v for k, v in properties.items() if v is not None}, point)
    return BuildResult(writer.count, [])


def _unplaced(label: str, count: int) -> list[str]:
    return [f"{label}: {count:,} without a point in the city left out"] if count else []


def cooling_sites_of(paths: dict[str, Path]) -> dict[str, str]:
    """The warming or cooling site each of our libraries and recreation centers also is, by the
    place's id (M4.7), or nothing without the City's list of sites."""
    return match_sites(paths).site_of if "warming_cooling_sites" in paths else {}


def build_libraries(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    missing = 0
    sites = cooling_sites_of(paths)
    for row in _rows(paths["library_locations"]):
        point = _point(row.get("geometry"))
        name = _text(row.get("building"))
        if point is None or name is None:
            missing += 1
            continue
        link = _text(row.get("library_url"))
        zip_code = (_text(row.get("zip_code")) or "")[:5] or None
        place_id = f"lib{row['objectid']}"
        properties = {
            "id": place_id,
            "cc": sites.get(place_id),
            "nm": name,
            "ad": _text(row.get("address")),
            "zip": zip_code,
            "ph": _text(row.get("phone_number")),
            "url": link if link and LIBRARY_LINK.match(link) else None,
        }
        features.append((properties, point))
    result = _write(out, features)
    result.notes = [
        f"libraries: {result.features:,} Free Library locations",
        *_unplaced("libraries", missing),
    ]
    return result


def build_recreation(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    kinds: Counter = Counter()
    missing = 0
    sites = cooling_sites_of(paths)
    for row in _rows(paths["ppr_program_sites"]):
        kind = RECREATION_KINDS.get((_text(row.get("program_type")) or "").upper())
        if kind is None:
            continue  # the pools among the program sites: the pools layer has them
        point = _point(row.get("geometry"))
        name = _text(row.get("park_name"))
        if point is None or name is None:
            missing += 1
            continue
        place_id = f"rec{row['objectid']}"
        properties = {
            "id": place_id,
            "cc": sites.get(place_id),
            "nm": name,
            "k": kind,
            "bd": _yes(row.get("building")),
            "gym": _yes(row.get("gym")),
        }
        kinds[kind] += 1
        features.append((properties, point))
    result = _write(out, features)
    result.notes = [
        f"recreation: {kinds[1]:,} recreation centers, {kinds[2]:,} older adult centers and "
        f"{kinds[3]:,} environmental education centers (Parks and Recreation)",
        *_unplaced("recreation", missing),
    ]
    return result


def _day(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return None


def build_pools(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    counts: Counter = Counter()
    missing = 0
    if "ppr_swimming_pools" in paths:
        for row in _rows(paths["ppr_swimming_pools"]):
            point = _point(row.get("geometry"))
            name = _text(row.get("pool_name")) or _text(row.get("park_name"))
            if point is None or name is None:
                missing += 1
                continue
            status = STATUS.get((_text(row.get("pool_status")) or "").upper())
            indoor = (_text(row.get("pool_type")) or "").upper()
            properties = {
                "id": f"pool{row['objectid']}",
                "nm": name,
                "k": POOL,
                "st": status,
                "in": 1 if indoor == "INDOOR" else 0 if indoor == "OUTDOOR" else None,
                "ada": _yes(row.get("ada_access")),
                "ad": _text(row.get("address_911")),
                "op": _day(row.get("pool_open_date")) if status == 1 else None,
            }
            counts[(POOL, status)] += 1
            features.append((properties, point))
    if "ppr_spraygrounds" in paths:
        for row in _rows(paths["ppr_spraygrounds"]):
            point = _point(row.get("geometry"))
            name = _text(row.get("park_name"))
            if point is None or name is None:
                missing += 1
                continue
            kind = (
                SPRINKLER
                if (_text(row.get("spray_type")) or "").upper() == "SPRINKLER"
                else (SPRAYGROUND)
            )
            status = STATUS.get((_text(row.get("spray_status")) or "").upper())
            properties = {"id": f"spray{row['objectid']}", "nm": name, "k": kind, "st": status}
            counts[(kind, status)] += 1
            features.append((properties, point))
    result = _write(out, features)
    in_service = {k: counts[(k, 1)] for k in (POOL, SPRAYGROUND, SPRINKLER)}
    total = {k: sum(n for (kind, _), n in counts.items() if kind == k) for k in in_service}
    result.notes = [
        f"pools: {total[POOL]:,} pools ({in_service[POOL]:,} in service), "
        f"{total[SPRAYGROUND]:,} spraygrounds ({in_service[SPRAYGROUND]:,} in service) and "
        f"{total[SPRINKLER]:,} sprinklers ({in_service[SPRINKLER]:,} in service), as Parks and "
        "Recreation lists them",
        *_unplaced("pools", missing),
    ]
    return result


def build_park_water(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    kinds: Counter = Counter()
    missing = 0
    for row in _rows(paths["ppr_hydration_stations"]):
        point = _point(row.get("geometry"))
        park = _text(row.get("park_name"))
        name = _text(row.get("amenity_name")) or park
        if point is None or name is None:
            missing += 1
            continue
        kind = (
            BOTTLE_FILLER
            if (_text(row.get("station_type")) or "").upper() == "HYDRATION"
            else (FOUNTAIN)
        )
        location = (_text(row.get("location")) or "").upper()
        properties = {
            "id": f"water{row['objectid']}",
            "nm": name,
            "pk": park if park and park != name else None,
            "k": kind,
            "in": 1 if location == "INDOOR" else 0 if location == "OUTDOOR" else None,
        }
        kinds[kind] += 1
        features.append((properties, point))
    result = _write(out, features)
    result.notes = [
        f"park_water: {kinds[FOUNTAIN]:,} drinking fountains and {kinds[BOTTLE_FILLER]:,} bottle "
        "filling stations at parks and recreation centers",
        *_unplaced("park_water", missing),
    ]
    return result


# Warming and cooling sites, and playgrounds (M4.7) ----------------------------------------------

#: `k` in `cooling`: the kind of place the City lists, from its `site_type`.
COOLING_KINDS = {"library": 1, "ppr": 2, "community partner": 3, "pha": 4}
LIBRARY_SITE, PPR_SITE = 1, 2
#: A site is the same place as one of our libraries or recreation centers of its kind when it
#: stands within EXACT_M of it (the City copied the point), or within SAME_PLACE_M with a word of
#: its name in common (Parks and Recreation's sites stand up to about 105 meters from the program
#: site of the same center, on 2026-10-09).
EXACT_M = 5.0
SAME_PLACE_M = 150.0
#: A site listed twice: two sites within this many meters with a word of their name in common.
TWICE_M = 25.0
#: Words that say what kind of place it is, not which one, left out when names are compared.
GENERIC_WORDS = frozenset(
    {
        "library",
        "branch",
        "free",
        "recreation",
        "rec",
        "center",
        "centre",
        "playground",
        "park",
        "community",
        "older",
        "adult",
        "senior",
        "the",
        "of",
        "and",
        "at",
        "jr",
        "sr",
        "dr",
        "st",
        "memorial",
        "family",
        "regional",
    }
)
#: "please call" with a phone number at the end of a site's services: the City's list cuts some
#: numbers short, so the services are shown without them (each center's own page has its number).
CALL_NUMBER = re.compile(r"[,;]?\s*please call\b[\s\d().-]*$", re.IGNORECASE)
#: `ag` in `playgrounds`: the ages a playground is meant for, as Parks and Recreation lists them.
PLAYGROUND_AGES = {"2_5_YEARS": 1, "5_12_YEARS": 2, "2_12_YEARS": 3}


def name_words(name: str | None) -> set[str]:
    """The words of a place's name that say which place it is."""
    words = re.findall(r"[a-z0-9]+", (name or "").lower())
    return {w for w in words if w not in GENERIC_WORDS and len(w) > 1}


def meters_between(a: tuple[float, float], b: tuple[float, float]) -> float:
    """The straight line distance in meters between two longitude and latitude points."""
    lat = math.radians((a[1] + b[1]) / 2)
    dx = (a[0] - b[0]) * 111_320.0 * math.cos(lat)
    dy = (a[1] - b[1]) * 110_540.0
    return math.hypot(dx, dy)


def _lnglat(point: dict | None) -> tuple[float, float] | None:
    return None if point is None else (point["coordinates"][0], point["coordinates"][1])


@dataclass
class Site:
    """One warming or cooling site as the City lists it."""

    oid: int
    kind: int | None
    name: str
    point: dict
    row: dict[str, Any]

    @property
    def id(self) -> str:
        return f"cool{self.oid}"

    def filled(self) -> int:
        """How much the City says about it: a site listed twice keeps the fuller record."""
        return sum(1 for v in self.row.values() if v not in (None, "", " "))


@dataclass
class Place:
    """A library or recreation center of ours that a site may be."""

    id: str
    kind: int
    name: str
    point: tuple[float, float]


def read_sites(path: Path) -> tuple[list[Site], int]:
    """The sites with a name and a point in the city, and how many were left out."""
    sites, missing = [], 0
    for row in _rows(path):
        point = _point(row.get("geometry"))
        name = _text(row.get("site_name"))
        if point is None or name is None or row.get("objectid") is None:
            missing += 1
            continue
        kind = COOLING_KINDS.get((_text(row.get("site_type")) or "").lower())
        sites.append(Site(int(row["objectid"]), kind, name, point, row))
    return sorted(sites, key=lambda s: s.oid), missing


def read_places(paths: dict[str, Path]) -> list[Place]:
    """Our libraries and recreation centers, with the ids and names their layers publish."""
    places: list[Place] = []
    if "library_locations" in paths:
        for row in _rows(paths["library_locations"]):
            point, name = _lnglat(_point(row.get("geometry"))), _text(row.get("building"))
            if point and name:
                places.append(Place(f"lib{row['objectid']}", LIBRARY_SITE, name, point))
    if "ppr_program_sites" in paths:
        for row in _rows(paths["ppr_program_sites"]):
            kind = RECREATION_KINDS.get((_text(row.get("program_type")) or "").upper())
            point, name = _lnglat(_point(row.get("geometry"))), _text(row.get("park_name"))
            if kind is not None and point and name:
                places.append(Place(f"rec{row['objectid']}", PPR_SITE, name, point))
    return places


def same_place(site: Site, places: Iterable[Place]) -> Place | None:
    """The library or recreation center a site is, if any (the rule above): of its kind, then
    the most words of the name in common, then the nearest."""
    here = _lnglat(site.point)
    assert here is not None
    words = name_words(site.name)
    best: tuple[int, float, Place] | None = None
    for place in places:
        if place.kind != site.kind:
            continue
        distance = meters_between(here, place.point)
        shared = len(words & name_words(place.name))
        if distance > SAME_PLACE_M or (distance > EXACT_M and shared == 0):
            continue
        key = (-shared, distance)
        if best is None or key < best[:2]:
            best = (*key, place)
    return None if best is None else best[2]


@dataclass
class CoolingMatch:
    """The sites to draw, each site's place (by site id) and each place's site (by place id)."""

    sites: list[Site]
    place_of: dict[str, Place]
    site_of: dict[str, str]
    twice: int


def match_sites(paths: dict[str, Path]) -> CoolingMatch:
    """The sites, each listed once, matched to our libraries and recreation centers."""
    sites, _ = read_sites(paths["warming_cooling_sites"])
    places = read_places(paths)
    place_of: dict[str, Place] = {}
    for site in sites:
        found = same_place(site, places)
        if found is not None:
            place_of[site.id] = found

    # A site listed twice: two sites of the same kind that are the same place of ours, or that
    # stand close together, share a word of their name and are not two different places of ours.
    # The fuller record stays.
    def twins(a: Site, b: Site) -> bool:
        if a.kind != b.kind:
            return False
        place_a, place_b = place_of.get(a.id), place_of.get(b.id)
        if place_a is not None and place_b is not None:
            return place_a is place_b
        here, there = _lnglat(a.point), _lnglat(b.point)
        assert here is not None and there is not None
        return meters_between(here, there) <= TWICE_M and bool(
            name_words(a.name) & name_words(b.name)
        )

    kept: list[Site] = []
    for site in sorted(sites, key=lambda s: (-s.filled(), s.oid)):
        if not any(twins(site, other) for other in kept):
            kept.append(site)
    kept.sort(key=lambda s: s.oid)
    ids = {s.id for s in kept}
    place_of = {k: v for k, v in place_of.items() if k in ids}
    site_of = {place.id: site_id for site_id, place in place_of.items()}
    return CoolingMatch(kept, place_of, site_of, len(sites) - len(kept))


def _yes_no(value: Any) -> int | None:
    text = (_text(value) or "").lower()
    return 1 if text == "yes" else 0 if text == "no" else None


def cooling_properties(site: Site, place: Place | None) -> dict[str, Any]:
    """A site's tile properties (docs/CONTRACTS.md section 4, `cooling`)."""
    row = site.row
    status = (_text(row.get("site_status")) or "").lower()
    services = _text(row.get("services_offered"))
    if services:
        services = _text(CALL_NUMBER.sub("", services))
    facilities = (_text(row.get("facilities_include")) or "").lower()
    capacity = row.get("capacity")
    return {
        "id": site.id,
        "nm": site.name,
        "k": site.kind,
        "ad": _text(row.get("site_address")),
        "hr": _text(row.get("site_hours")),
        "c": _yes_no(row.get("cooling_site")),
        "w": _yes_no(row.get("warming_site")),
        "st": 1 if status == "open" else 0 if status == "closed" else None,
        "cap": int(capacity) if isinstance(capacity, int | float) and capacity > 0 else None,
        "sv": services,
        "ada": _yes_no(row.get("handicap_accessible")),
        "ws": 1 if _yes_no(row.get("water_station")) == 1 else None,
        "rr": 1 if "restroom" in facilities else None,
        "pl": place.id if place else None,
        "pn": place.name if place else None,
    }


def build_cooling(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    match = match_sites(paths)
    _, missing = read_sites(paths["warming_cooling_sites"])
    features = [(cooling_properties(s, match.place_of.get(s.id)), s.point) for s in match.sites]
    result = _write(out, features)
    status = Counter(p.get("st") for p, _ in features)
    kinds = Counter(p.get("pl", "")[:3] for p, _ in features if p.get("pl"))
    result.notes = [
        f"cooling: {result.features:,} warming and cooling sites ({status[1]:,} listed as open, "
        f"{status[0]:,} as closed); {kinds['lib']:,} are Free Library branches and "
        f"{kinds['rec']:,} recreation centers already on the map, drawn once"
        + (f"; {match.twice:,} listed twice kept once" if match.twice else ""),
        *_unplaced("cooling", missing),
    ]
    return result


def build_playgrounds(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    missing = 0
    for row in _rows(paths["ppr_playgrounds"]):
        point = _point(row.get("geometry"))
        name = _text(row.get("park_name"))
        if point is None or name is None:
            missing += 1
            continue
        installed = row.get("date_installed")
        year = installed.year if isinstance(installed, datetime | date) else None
        properties = {
            "id": f"pg{row['objectid']}",
            "nm": name,
            "ag": PLAYGROUND_AGES.get((_text(row.get("age_range")) or "").upper()),
            "yr": year if year and 1950 <= year <= as_of.year else None,
        }
        features.append((properties, point))
    result = _write(out, features)
    result.notes = [
        f"playgrounds: {result.features:,} playgrounds (Parks and Recreation)",
        *_unplaced("playgrounds", missing),
    ]
    return result


PLACE_BUILDERS: tuple[LayerBuilder, ...] = (
    # The libraries and recreation centers read the warming and cooling sites only to mark the
    # ones that are also a site (`cc`), so the map draws one marker per place (M4.7).
    LayerBuilder(
        PLACES_FILE,
        "libraries",
        ("library_locations",),
        build_libraries,
        extras=("warming_cooling_sites",),
    ),
    LayerBuilder(
        PLACES_FILE,
        "recreation",
        ("ppr_program_sites",),
        build_recreation,
        extras=("warming_cooling_sites",),
    ),
    LayerBuilder(PLACES_FILE, "pools", ("ppr_swimming_pools", "ppr_spraygrounds"), build_pools),
    LayerBuilder(PLACES_FILE, "park_water", ("ppr_hydration_stations",), build_park_water),
    LayerBuilder(
        PLACES_FILE,
        "cooling",
        ("warming_cooling_sites",),
        build_cooling,
        extras=("library_locations", "ppr_program_sites"),
    ),
    LayerBuilder(PLACES_FILE, "playgrounds", ("ppr_playgrounds",), build_playgrounds),
)
