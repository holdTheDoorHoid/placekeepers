"""Streets and stops (M4.5, issue #41): the City's bus shelters at SEPTA's stops, its street poles
and traffic calming devices by street block, and its school crossing guard posts.

**City shelters at SEPTA's stops.** The City lists each shelter with SEPTA's stop number as it
recorded it (`stopid`). A shelter belongs to a SEPTA bus or trolley stop on the map:

* by number, when its number names the stop (today, or a number the stop had before) and the
  stop stands within SHELTER_NUMBER_METERS of the shelter, and no other stop stands more than
  NUMBER_SLACK_METERS closer (the rule OpenStreetMap's stops follow, M2.3: at Girard Avenue and
  11th Street a shelter numbered for the stop around the corner stands 3 meters from another stop,
  and the point decides);
* otherwise by place, when the nearest stop stands within SHELTER_PLACE_METERS.

A shelter stands a few steps from the stop's pole (a median 4 meters on 2026-10-09 where the
numbers agree, nine in ten within 15), so the reach by number is wider than OpenStreetMap's. Several
shelters may serve one stop (Roosevelt Boulevard's stops have pairs, numbered "8-a" and "8-b").
SEPTA's number is read from the City's text: "419", "22513-a", "SEPTA357"; other agencies' numbers
("NJT4", New Jersey Transit's) and blanks are matched by place only.

**Street poles by block.** Each pole the City lists counts for the nearest street block within
POLE_BLOCK_METERS (poles stand on the sidewalk beside their street). A pole has a lamp the City
lists when it names the kind of lamp (LED, or HPS: high pressure sodium, the older orange lamps)
or a number of lamps above zero. The map says "poles" and "lamps the City lists", never that a
street is lit or how bright it is: the list says what is installed, not what works tonight.

**Traffic calming by block.** A device counts for the block the City names (`seg_id`); one without
a block, or naming a block the street network does not have, counts for the nearest block within
CALMING_BLOCK_METERS. A block's date is the earliest device's day.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.derive.bus_stops import NUMBER_SLACK_METERS, SeptaPoint
from placekeepers.derive.street_safety import StreetNetwork, in_philadelphia, points_in_meters

#: A shelter's number is believed when the stop it names stands this close (meters).
SHELTER_NUMBER_METERS = 30.0
#: Without a number that holds, a shelter belongs to the nearest stop this close (meters).
SHELTER_PLACE_METERS = 15.0
#: How a shelter was matched (`m` on the shelter).
BY_NUMBER, BY_PLACE = 1, 2

#: A pole counts for the nearest street block this close (meters): 97 percent of the poles the
#: City lists stand this close to a street that carries traffic (2026-10-09), the rest along
#: paths, in parks and in parking lots.
POLE_BLOCK_METERS = 30.0
#: The kind of lamp on a pole (`k` on the pole).
NO_LAMP, LAMP_LED, LAMP_OTHER, LAMP_UNKNOWN = 0, 1, 2, 3
#: Who owns a pole (`o` on the pole); absent when the City leaves it blank.
OWNER_CODES = {"STREETS": 1, "PECO": 2, "PENNDOT": 3}
OWNER_OTHER = 4

#: A traffic calming device without a block of its own counts for the nearest within this.
CALMING_BLOCK_METERS = 30.0

_SHELTER_NUMBER = re.compile(r"\s*(?:SEPTA\s*)?(\d{1,6})(?:\s*-\s*[A-Za-z])?\s*", re.IGNORECASE)


# ---------------------------------------------------------------------------------------------
# City shelters


@dataclass(frozen=True)
class CityShelter:
    """One shelter on the City's list."""

    id: str
    number: str | None
    lat: float
    lng: float
    #: the stop number exactly as the City lists it, and the site's name
    listed: str | None = None
    site: str = ""
    #: the advertising panel is a digital screen (else a printed poster)
    digital: bool = False


def load_city_shelters(path: Path) -> list[CityShelter]:
    """The shelters of a `bus_shelters` snapshot with a usable point, in the City's order."""
    table = pq.read_table(
        path, columns=["objectid", "site", "siteid", "stopid", "productgroup", "geometry"]
    )
    shelters = []
    for row in sorted(table.to_pylist(), key=lambda r: r["objectid"] or 0):
        point = shapely.from_wkb(row["geometry"]) if row["geometry"] else None
        if point is None or point.is_empty or not in_philadelphia(point.y, point.x):
            continue
        listed = str(row["stopid"]).strip() if row["stopid"] else None
        shelters.append(
            CityShelter(
                id=str(row["siteid"] or row["objectid"]).strip(),
                number=shelter_number(listed),
                lat=point.y,
                lng=point.x,
                listed=listed or None,
                site=str(row["site"] or ""),
                digital=str(row["productgroup"] or "").strip().lower() == "digital",
            )
        )
    return shelters


@dataclass(frozen=True)
class ShelterMatch:
    #: the index of the SEPTA stop
    stop: int
    how: int
    meters: float


def shelter_number(text: object) -> str | None:
    """SEPTA's stop number in the City's `stopid`, or None (blank, or another agency's)."""
    if not isinstance(text, str):
        return None
    found = _SHELTER_NUMBER.fullmatch(text)
    return found.group(1) if found else None


def match_shelters(
    shelters: Sequence[CityShelter], stops: Sequence[SeptaPoint]
) -> dict[int, ShelterMatch]:
    """{index in `shelters`: its stop}, by number then by place (module docstring)."""
    if not shelters or not stops:
        return {}
    shelter_m = points_in_meters([s.lat for s in shelters], [s.lng for s in shelters])
    stop_m = points_in_meters([s.lat for s in stops], [s.lng for s in stops])
    tree = shapely.STRtree(stop_m)
    by_number: dict[str, int] = {}
    for index, stop in enumerate(stops):
        by_number.setdefault(stop.stop_id, index)
    for index, stop in enumerate(stops):
        for former in stop.former_ids:
            by_number.setdefault(former, index)

    found: dict[int, ShelterMatch] = {}
    for index, shelter in enumerate(shelters):
        nearest = int(tree.nearest(shelter_m[index]))
        nearest_m = float(shapely.distance(shelter_m[index], stop_m[nearest]))
        named = by_number.get(shelter.number) if shelter.number else None
        if named is not None:
            meters = float(shapely.distance(shelter_m[index], stop_m[named]))
            if meters <= SHELTER_NUMBER_METERS and meters <= nearest_m + NUMBER_SLACK_METERS:
                found[index] = ShelterMatch(named, BY_NUMBER, round(meters, 1))
                continue
        if nearest_m <= SHELTER_PLACE_METERS:
            found[index] = ShelterMatch(nearest, BY_PLACE, round(nearest_m, 1))
    return found


@dataclass
class ShelterSummary:
    shelters: int = 0
    numbered: int = 0
    by_number: int = 0
    by_place: int = 0
    stops: int = 0

    @property
    def matched(self) -> int:
        return self.by_number + self.by_place


def summarize_shelters(
    shelters: Sequence[CityShelter], matches: dict[int, ShelterMatch]
) -> ShelterSummary:
    return ShelterSummary(
        shelters=len(shelters),
        numbered=sum(1 for s in shelters if s.number),
        by_number=sum(1 for m in matches.values() if m.how == BY_NUMBER),
        by_place=sum(1 for m in matches.values() if m.how == BY_PLACE),
        stops=len({m.stop for m in matches.values()}),
    )


# ---------------------------------------------------------------------------------------------
# Street poles


def lamp_kind(bulb_type: object, lamps: object) -> int:
    """NO_LAMP, LAMP_LED, LAMP_OTHER (high pressure sodium) or LAMP_UNKNOWN (a lamp the City
    counts but whose kind it does not name)."""
    bulb = str(bulb_type or "").strip().upper()
    if bulb == "LED":
        return LAMP_LED
    if bulb == "HPS":
        return LAMP_OTHER
    if isinstance(lamps, int | float) and lamps > 0:
        return LAMP_UNKNOWN
    return NO_LAMP


def owner_code(owner: object) -> int | None:
    text = str(owner or "").strip().upper()
    if not text:
        return None
    return OWNER_CODES.get(text, OWNER_OTHER)


@dataclass
class BlockPoles:
    """Poles per street block, in network order."""

    poles: list[int]
    lamps: list[int]
    led: list[int]
    unmatched: int = 0


def poles_on_blocks(
    network: StreetNetwork, points_m: np.ndarray, kinds: Sequence[int]
) -> BlockPoles:
    """Each pole counts for its nearest block within POLE_BLOCK_METERS."""
    result = BlockPoles([0] * len(network), [0] * len(network), [0] * len(network))
    for segment, kind in zip(
        network.nearest_segment(points_m, POLE_BLOCK_METERS), kinds, strict=True
    ):
        if segment is None:
            result.unmatched += 1
            continue
        result.poles[segment] += 1
        if kind != NO_LAMP:
            result.lamps[segment] += 1
        if kind == LAMP_LED:
            result.led[segment] += 1
    return result


# ---------------------------------------------------------------------------------------------
# Traffic calming


def install_day(value: object) -> date | None:
    """The day a device went in. The City stores midnight in Philadelphia as 04:00 or 05:00 UTC
    and some days as 00:00 UTC, so the UTC calendar day is the day in both cases."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


@dataclass
class BlockCalming:
    """Traffic calming devices per street block, in network order."""

    devices: list[int]
    first: list[date | None]
    #: the block each device counts for (network index), or None
    blocks: list[int | None] = field(default_factory=list)
    by_id: int = 0
    by_place: int = 0
    unmatched: int = 0


def calming_on_blocks(
    network: StreetNetwork,
    seg_ids: Sequence[int | None],
    points_m: np.ndarray,
    days: Sequence[date | None],
) -> BlockCalming:
    """Each device counts for its own block (`seg_id`), else the nearest within
    CALMING_BLOCK_METERS."""
    result = BlockCalming([0] * len(network), [None] * len(network))
    index_of = {seg: i for i, seg in enumerate(network.ids)}
    nearest = network.nearest_segment(points_m, CALMING_BLOCK_METERS)
    for k, (seg_id, day) in enumerate(zip(seg_ids, days, strict=True)):
        block = index_of.get(int(seg_id)) if seg_id is not None else None
        if block is not None:
            result.by_id += 1
        else:
            block = nearest[k]
            if block is None:
                result.unmatched += 1
                result.blocks.append(None)
                continue
            result.by_place += 1
        result.blocks.append(block)
        result.devices[block] += 1
        if day is not None and (result.first[block] is None or day < result.first[block]):
            result.first[block] = day
    return result


# ---------------------------------------------------------------------------------------------
# Words


_CORNERS = {"NE": "northeast", "NW": "northwest", "SE": "southeast", "SW": "southwest"}


def title_street(text: str) -> str:
    """'BYBERRY & PROCTOR' as 'Byberry & Proctor', '13TH & OAK LANE' as '13th & Oak Lane',
    'G & TIOGA' as 'G & Tioga'."""
    words = []
    for word in " ".join(text.split()).split(" "):
        if re.fullmatch(r"[A-Za-z]", word) or word == "&":
            words.append(word.upper())
        elif re.match(r"\d", word):
            words.append(word.lower())
        else:
            words.append(word[:1].upper() + word[1:].lower())
    return " ".join(words)


def shelter_place(site: object) -> tuple[str, str | None]:
    """The City's site name without its internal codes, and the corner it names in words:
    'Chestnut St & Broad St - Shelter CH14' as ('Chestnut St & Broad St', None), 'Oregon &
    Broad-PBS1' as ('Oregon & Broad', None), 'Roosevelt Blvd & Broad St - FS SE' as ('Roosevelt
    Blvd & Broad St - FS', 'southeast'). The side of the street (FS, NS) is left for the caller to
    put in words."""
    text = " ".join(str(site or "").split())
    text = re.sub(r"\s*\(.*?\)\s*$", "", text)
    text = re.sub(r"\s*-?\s*Shelter\s+\S+$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*-\s*(?:PBS|PN)\d+$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+-\s+\d+$", "", text)
    text = re.sub(r"\s*-\s*$", "", text).strip()
    corner = re.search(r"\s+(NE|NW|SE|SW)$", text)
    if corner:
        return re.sub(r"\s*-\s*$", "", text[: corner.start()]).strip(), _CORNERS[corner.group(1)]
    return text, None
