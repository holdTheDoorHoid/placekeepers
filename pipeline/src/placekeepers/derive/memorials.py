"""Memorials: one quiet marker for each person the Police record as killed in a traffic crash.

Markers come from the Police Department's fatal crash records (one row per person killed, since
2019). Names come only from data/curated/memorials.yaml, edited by hand from public memorial lists,
and never from anywhere else (docs/ETHICS.md). Anything listed in data/curated/suppressed.yaml never
appears: a removed name is not shown, and a removed marker is not drawn.

Every marker carries (docs/CONTRACTS.md, `memorials`):

    id    a stable id built from the date and the place, such as fc20260822_3f9a
    d     the date, YYYY-MM-DD
    m     mode bits: 1 walking, 2 cycling, 4 motorcycle, 8 scooter, 0 in a car or other vehicle
    pl    the place in words, such as "S 26th St and Penrose Ave" (house numbers become blocks)
    sg    suggestion ids for the crash site, comma separated
    nm    the name, only from the curated file and only when not suppressed
    src   the public memorial page, only with a curated entry

All markers are published; the map shows people walking, cycling or riding a scooter by default and
everyone else when the memorials layer's "every fatal crash" setting is on.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date

from placekeepers.curated import CuratedMemorials, MemorialEntry, Suppression, in_philadelphia
from placekeepers.derive.street_safety import (
    StreetNetwork,
    plural,
    points_in_meters,
    police_modes,
)

#: A curated entry and a marker match when they are this close (meters) and their dates are at
#: most MATCH_DAYS apart.
MATCH_METERS = 250.0
MATCH_DAYS = 1
#: A suppression with a date and place hides markers this close (meters) on that date.
SUPPRESS_METERS = 150.0
#: A crash site this close (meters) to an intersection gets the corner suggestions.
CORNER_SUGGESTION_METERS = 20.0
#: The street the crash happened on, for the traffic calming suggestion.
STREET_METERS = 30.0
#: Street classes the City's traffic calming program may serve: collectors and local streets
#: (arterials and state highways do not qualify).
CALMING_CLASSES = frozenset({4, 5})

MEMORIAL = "memorial_or_ghost_bike"
TRAFFIC_CALMING = "traffic_calming_petition"
DAYLIGHTING = "daylighting_check"
ASPHALT_ART = "asphalt_art_check"
#: Suggestion order on a crash site: the memorial (always with the family's blessing) first.
SUGGESTION_ORDER = (MEMORIAL, TRAFFIC_CALMING, DAYLIGHTING, ASPHALT_ART)


@dataclass(frozen=True)
class FatalRecord:
    """One person killed, from the Police records, with only the fields we keep."""

    date: date
    modes: int
    lat: float
    lng: float
    place: str | None = None
    #: the Police table's row number, used only to keep a stable order
    order: int = 0


@dataclass
class Memorial:
    id: str
    date: date
    modes: int
    lat: float
    lng: float
    place: str | None = None
    name: str | None = None
    source: str | None = None
    entry_id: str | None = None
    suggestions: list[str] = field(default_factory=list)

    def properties(self) -> dict:
        props: dict = {"id": self.id, "d": self.date.isoformat(), "m": self.modes}
        if self.place:
            props["pl"] = self.place
        if self.suggestions:
            props["sg"] = ",".join(self.suggestions)
        if self.name:
            props["nm"] = self.name
        if self.source:
            props["src"] = self.source
        return props


# ---------------------------------------------------------------------------------------------
# Reading the Police records

_HOUSE_NUMBER = re.compile(r"^(\d{1,6})(?:\s*-\s*\d+)?\s+(?!(?:st|nd|rd|th)\b)(.+)$", re.IGNORECASE)
_BLOCK = re.compile(r"^(\d{1,6})\s*block\b(?:\s+of\b)?\s*(.*)$", re.IGNORECASE)
_NEAR = re.compile(r"^near\s+(.+)$", re.IGNORECASE)
_DIRECTIONS = {
    "n": "N",
    "north": "N",
    "s": "S",
    "south": "S",
    "e": "E",
    "east": "E",
    "w": "W",
    "west": "W",
}


_PARENTHESES = re.compile(r"^\((.+)\)$")


def _street(text: str | None) -> str | None:
    if not text:
        return None
    cleaned = " ".join(text.replace(".", " ").replace('"', " ").split()).strip(" ,;")
    # Tidy parentheses: "( Sergeant St )" becomes "(Sergeant St)" (finding F15).
    cleaned = re.sub(r"\(\s+", "(", re.sub(r"\s+\)", ")", cleaned))
    return cleaned or None


def _block(number: str) -> str:
    hundred = int(number) // 100 * 100
    return "unit block" if hundred == 0 else f"{hundred} block"


def place_text(primary: str | None, secondary: str | None) -> str | None:
    """The place in words, from the Police record's street and cross street.

    The Police often write the block as the cross street ("Packer Ave" and "600 Block", or
    "Broad St" and "2200 Block N"); that becomes "600 block of Packer Ave" or "2200 block of N
    Broad St". An exact house number becomes its block ("7244 Elmwood Ave" becomes "7200 block of
    Elmwood Ave"), like the City's own block level points."""
    first = _street(primary)
    second = _street(secondary)
    if second:
        block = _BLOCK.match(second)
        if block and first:
            direction = _DIRECTIONS.get(block.group(2).strip().lower())
            if direction or not block.group(2).strip():
                prefix = f"{direction} " if direction else ""
                return f"{_block(block.group(1))} of {prefix}{first}"
            # "2500 Block (Sergeant St)": the block of the first street, at the street named.
            named = _PARENTHESES.match(block.group(2).strip())
            if named:
                return f"{_block(block.group(1))} of {first} near {named.group(1)}"
    if first:
        block = _BLOCK.match(first)
        house = _HOUSE_NUMBER.match(first)
        if block and block.group(2).strip():
            first = f"{_block(block.group(1))} of {block.group(2).strip()}"
        elif house:
            first = f"{_block(house.group(1))} of {house.group(2)}"
        if " block of " in f" {first}" and second:
            near = _NEAR.match(second)
            return f"{first} near {near.group(1) if near else second}"
    if first and second:
        near = _NEAR.match(second)
        if near:
            return f"{first} near {near.group(1)}"
        if second.lower() != first.lower():
            return f"{first} and {second}"
    return first or second


def fatal_records(
    dates: Sequence[date | None],
    veh1: Sequence[str | None],
    veh2: Sequence[str | None],
    primary: Sequence[str | None],
    secondary: Sequence[str | None],
    lats: Sequence[float | None],
    lngs: Sequence[float | None],
    orders: Sequence[int | None] | None = None,
) -> tuple[list[FatalRecord], list[str]]:
    records: list[FatalRecord] = []
    undated = unplaced = 0
    for i, day in enumerate(dates):
        if day is None:
            undated += 1
            continue
        lat, lng = lats[i], lngs[i]
        if not in_philadelphia(lat, lng):
            unplaced += 1
            continue
        records.append(
            FatalRecord(
                date=day,
                modes=police_modes(veh1[i], veh2[i]),
                lat=float(lat),
                lng=float(lng),
                place=place_text(primary[i], secondary[i]),
                order=int(orders[i]) if orders is not None and orders[i] is not None else i,
            )
        )
    notes = []
    if unplaced:
        notes.append(
            f"{plural(unplaced, 'person', 'people')} killed in traffic crashes "
            f"{'has' if unplaced == 1 else 'have'} no usable location"
        )
    if undated:
        notes.append(
            f"{plural(undated, 'fatal crash record has', 'fatal crash records have')} no date"
        )
    return records, notes


def memorial_ids(records: Sequence[FatalRecord]) -> list[str]:
    """A stable id per record from its date and place. Records with the same date and place (two
    people killed in one crash) are told apart by a suffix, in a stable order."""
    bases = []
    for record in records:
        digest = hashlib.sha1(f"{record.lat:.4f},{record.lng:.4f}".encode()).hexdigest()[:4]
        bases.append(f"fc{record.date:%Y%m%d}_{digest}")
    order = sorted(
        range(len(records)), key=lambda i: (bases[i], records[i].modes, records[i].order)
    )
    ids = [""] * len(records)
    seen: dict[str, int] = {}
    for i in order:
        n = seen.get(bases[i], 0) + 1
        seen[bases[i]] = n
        ids[i] = bases[i] if n == 1 else f"{bases[i]}_{n}"
    return ids


# ---------------------------------------------------------------------------------------------
# Distances


def meters_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance on the ground, close enough for matching places within a city."""
    radius = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = phi2 - phi1
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------------------------
# Building the markers


def _suppressed(memorial: Memorial, suppressions: Sequence[Suppression]) -> bool:
    for item in suppressions:
        if item.id == memorial.id:
            return True
        if (
            item.date is not None
            and item.lat is not None
            and item.lng is not None
            and item.date == memorial.date
            and meters_between(item.lat, item.lng, memorial.lat, memorial.lng) <= SUPPRESS_METERS
        ):
            return True
    return False


def _match(entry: MemorialEntry, memorials: list[Memorial], by_id: dict[str, Memorial]):
    if entry.crash and entry.crash in by_id and by_id[entry.crash].entry_id is None:
        return by_id[entry.crash]
    if not entry.located:
        return None
    best = None
    best_key = None
    for memorial in memorials:
        if memorial.entry_id is not None:
            continue
        days = abs((memorial.date - entry.date).days)
        if days > MATCH_DAYS:
            continue
        distance = meters_between(entry.lat, entry.lng, memorial.lat, memorial.lng)
        if distance > MATCH_METERS:
            continue
        same_mode = bool(memorial.modes & entry.mode_bits) or memorial.modes == entry.mode_bits
        key = (days, not same_mode, distance)
        if best_key is None or key < best_key:
            best, best_key = memorial, key
    return best


def build_memorials(
    records: Sequence[FatalRecord],
    curated: CuratedMemorials,
    suppressions: Sequence[Suppression],
    *,
    network: StreetNetwork | None = None,
    suggestion_ids: Sequence[str] = SUGGESTION_ORDER,
) -> tuple[list[Memorial], list[str]]:
    """Markers for the memorials layer, with curated names and suggestions, minus everything
    suppressed. Returns the markers, sorted by date then id, and plain notes about the build."""
    notes = list(curated.problems)
    ids = memorial_ids(records)
    memorials = [
        Memorial(
            id=memorial_id,
            date=record.date,
            modes=record.modes,
            lat=record.lat,
            lng=record.lng,
            place=record.place,
        )
        for memorial_id, record in zip(ids, records, strict=True)
    ]
    removed_ids = {item.id for item in suppressions}
    by_id = {memorial.id: memorial for memorial in memorials}

    named = standalone = skipped = 0
    for entry in curated.entries:
        if entry.id in removed_ids:
            continue
        memorial = _match(entry, memorials, by_id)
        if memorial is None:
            if not entry.located:
                skipped += 1
                notes.append(
                    f"memorials.yaml entry {entry.id} links to marker {entry.crash}, which is not "
                    "on the map; add its lat and lng"
                )
                continue
            memorial = Memorial(
                id=entry.id,
                date=entry.date,
                modes=entry.mode_bits,
                lat=entry.lat,
                lng=entry.lng,
                place=entry.place,
            )
            memorials.append(memorial)
            by_id[memorial.id] = memorial
            standalone += 1
        memorial.entry_id = entry.id
        memorial.name = entry.name
        memorial.source = entry.source
        memorial.modes = entry.mode_bits
        if not memorial.place and entry.place:
            memorial.place = entry.place
        named += 1

    kept = [m for m in memorials if not _suppressed(m, suppressions)]
    hidden = len(memorials) - len(kept)
    _add_suggestions(kept, network, set(suggestion_ids))
    kept.sort(key=lambda m: (m.date, m.id))
    if named or curated.entries:
        notes.append(
            f"memorials: {plural(named, 'name', 'names')} from memorials.yaml"
            + (f", {standalone} of them at their own place" if standalone else "")
        )
    if skipped:
        notes.append(f"memorials: {plural(skipped, 'entry', 'entries')} could not be placed")
    if hidden:
        notes.append(f"memorials: {plural(hidden, 'marker is', 'markers are')} removed on request")
    return kept, notes


def _add_suggestions(
    memorials: list[Memorial], network: StreetNetwork | None, allowed: set[str]
) -> None:
    corner = [False] * len(memorials)
    calming = [False] * len(memorials)
    if network is not None and len(network) and memorials:
        points = points_in_meters([m.lat for m in memorials], [m.lng for m in memorials])
        corner = network.near_corner(points, CORNER_SUGGESTION_METERS)
        for i, index in enumerate(network.nearest_segment(points, STREET_METERS)):
            if index is None:
                continue
            klass = network.classes[index]
            state = network.responsible[index] == "STATE"
            calming[i] = klass in CALMING_CLASSES and not state
    for i, memorial in enumerate(memorials):
        chosen = [MEMORIAL]
        if calming[i]:
            chosen.append(TRAFFIC_CALMING)
        if corner[i]:
            chosen += [DAYLIGHTING, ASPHALT_ART]
        memorial.suggestions = [s for s in SUGGESTION_ORDER if s in chosen and s in allowed]


def count_by_year_and_mode(memorials: Sequence[Memorial]) -> dict[int, dict[str, int]]:
    """People killed per year by mode, for the build notes and the report."""
    table: dict[int, dict[str, int]] = {}
    for memorial in memorials:
        row = table.setdefault(
            memorial.date.year,
            {"all": 0, "walking": 0, "cycling": 0, "scooter": 0, "motorcycle": 0},
        )
        row["all"] += 1
        if memorial.modes & 1:
            row["walking"] += 1
        if memorial.modes & 2:
            row["cycling"] += 1
        if memorial.modes & 8:
            row["scooter"] += 1
        if memorial.modes & 4:
            row["motorcycle"] += 1
    return dict(sorted(table.items()))
