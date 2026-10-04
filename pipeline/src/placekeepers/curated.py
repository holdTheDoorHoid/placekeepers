"""Hand curated files in data/curated/: memorial names and the list of removed memorials.

`data/curated/memorials.yaml` holds the names of people killed on our streets, copied by hand from
public memorial lists (docs/ETHICS.md). Nothing ever writes names into it automatically. Each entry:

    id:      a stable id of our own, such as m2024_0001; never reused, never changed
    name:    the name as the public source gives it
    date:    the day of the crash (YYYY-MM-DD)
    mode:    walking, cycling, scooter, motorcycle, driving or passenger
    crash:   (optional) the id of the memorial marker on the map this name belongs to
    lat, lng (optional with crash, otherwise required) the approximate place
    place:   (optional) the place in words, such as "Broad St and Erie Ave"
    source:  the link to the public memorial page (https)
    note:    (optional) for curators only; never published

An entry is linked to a fatal crash marker by `crash`, or else by its date and place (a marker on
the same day within 250 meters; the nearest one wins). An entry that matches no marker becomes its
own marker at its place, so a name from before 2019 (when the Police data begins) can still be
remembered.

`data/curated/suppressed.yaml` lists what must never appear again, by id only, never by name:

    - m2024_0001                      a curated entry: its name never shows again
    - fc20240517_3f9a                 a marker: it never shows again
    - {id: fc20240517_3f9a, date: 2024-05-17, lat: 39.988, lng: -75.154}
                                      a marker, with its date and place, so it stays hidden even
                                      if the Police correct the record and its id changes

Problems in these files never publish a name: a broken entry is skipped and reported.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

import yaml

MEMORIALS_FILE = "data/curated/memorials.yaml"
SUPPRESSED_FILE = "data/curated/suppressed.yaml"

#: Modes a curated entry may give, and the mode bits they set (docs/CONTRACTS.md: 1 walking,
#: 2 cycling, 4 motorcycle, 8 scooter; 0 a person in a car or other vehicle).
MODE_BITS: dict[str, int] = {
    "walking": 1,
    "cycling": 2,
    "motorcycle": 4,
    "scooter": 8,
    "driving": 0,
    "passenger": 0,
}

ENTRY_KEYS = {"id", "name", "date", "mode", "crash", "lat", "lng", "place", "source", "note"}
REQUIRED_KEYS = {"id", "name", "date", "mode", "source"}
ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,40}$")
MARKER_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
URL_PATTERN = re.compile(r"^https://\S+$")
SUPPRESSED_KEYS = {"id", "date", "lat", "lng", "note"}

# A generous box around Philadelphia, as for every other point layer.
PHILLY_LAT = (39.80, 40.20)
PHILLY_LNG = (-75.35, -74.90)


class CuratedError(ValueError):
    """A curated file cannot be read at all (not YAML, or not a list)."""


@dataclass(frozen=True)
class MemorialEntry:
    id: str
    name: str
    date: date
    mode: str
    source: str
    crash: str | None = None
    lat: float | None = None
    lng: float | None = None
    place: str | None = None

    @property
    def mode_bits(self) -> int:
        return MODE_BITS[self.mode]

    @property
    def located(self) -> bool:
        return self.lat is not None and self.lng is not None


@dataclass(frozen=True)
class Suppression:
    id: str
    date: date | None = None
    lat: float | None = None
    lng: float | None = None


@dataclass
class CuratedMemorials:
    entries: list[MemorialEntry]
    problems: list[str]


def _load_list(path: Path, label: str) -> list[Any]:
    if not path.is_file():
        return []
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise CuratedError(f"{label} is not valid YAML: {exc}".replace("\n", " ")) from exc
    if data is None:
        return []
    if not isinstance(data, list):
        raise CuratedError(f"{label} must be a list of entries")
    return data


def _date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value.strip())
        except ValueError:
            return None
    return None


def _coordinate(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, int | float):
        return None
    number = float(value)
    return None if math.isnan(number) else number


def in_philadelphia(lat: float | None, lng: float | None) -> bool:
    return (
        lat is not None
        and lng is not None
        and PHILLY_LAT[0] <= lat <= PHILLY_LAT[1]
        and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]
    )


def parse_memorial(raw: Any, index: int) -> tuple[MemorialEntry | None, list[str]]:
    """One entry of memorials.yaml, or None with the reasons it cannot be used."""
    where = f"memorials.yaml entry {index + 1}"
    if not isinstance(raw, dict):
        return None, [f"{where} must be a mapping of keys to values"]
    if isinstance(raw.get("id"), str):
        where = f"memorials.yaml entry {index + 1} ({raw['id']})"
    problems = []
    unknown = sorted(set(raw) - ENTRY_KEYS)
    if unknown:
        problems.append(f"{where} has unknown keys: {', '.join(map(str, unknown))}")
    missing = sorted(key for key in REQUIRED_KEYS if raw.get(key) in (None, ""))
    if missing:
        problems.append(f"{where} is missing: {', '.join(missing)}")
    entry_id = raw.get("id")
    if entry_id is not None and not (isinstance(entry_id, str) and ID_PATTERN.match(entry_id)):
        problems.append(f"{where} has an id that is not lowercase letters, digits and underscores")
    name = raw.get("name")
    if name is not None and not (isinstance(name, str) and name.strip()):
        problems.append(f"{where} has an empty name")
    day = _date(raw.get("date"))
    if raw.get("date") is not None and day is None:
        problems.append(f"{where} has a date that is not YYYY-MM-DD")
    mode = raw.get("mode")
    if mode is not None and mode not in MODE_BITS:
        problems.append(f"{where} has mode {mode!r}; expected one of {', '.join(MODE_BITS)}")
    source = raw.get("source")
    if source is not None and not (isinstance(source, str) and URL_PATTERN.match(source)):
        problems.append(f"{where} needs a source link starting with https://")
    crash = raw.get("crash")
    if crash is not None and not (isinstance(crash, str) and MARKER_ID_PATTERN.match(crash)):
        problems.append(f"{where} has a crash link that is not a marker id")
    lat, lng = _coordinate(raw.get("lat")), _coordinate(raw.get("lng"))
    has_place = raw.get("lat") is not None or raw.get("lng") is not None
    if has_place and not in_philadelphia(lat, lng):
        problems.append(f"{where} has lat and lng outside Philadelphia")
    if crash is None and not has_place:
        problems.append(f"{where} needs either a crash link or lat and lng")
    place = raw.get("place")
    if place is not None and not isinstance(place, str):
        problems.append(f"{where} has a place that is not text")
    if problems:
        return None, problems
    return (
        MemorialEntry(
            id=entry_id,
            name=" ".join(name.split()),
            date=day,
            mode=mode,
            source=source,
            crash=crash,
            lat=lat if has_place else None,
            lng=lng if has_place else None,
            place=" ".join(place.split()) if isinstance(place, str) and place.strip() else None,
        ),
        [],
    )


def read_memorials(repo_root: Path) -> CuratedMemorials:
    """Every usable entry of the repository's memorials.yaml."""
    return read_memorials_file(repo_root / MEMORIALS_FILE)


def read_memorials_file(path: Path) -> CuratedMemorials:
    """Every usable entry of a memorials file, plus a plain sentence for each one skipped."""
    raw = _load_list(path, "memorials.yaml")
    entries: list[MemorialEntry] = []
    problems: list[str] = []
    seen: set[str] = set()
    for index, item in enumerate(raw):
        entry, found = parse_memorial(item, index)
        problems.extend(found)
        if entry is None:
            continue
        if entry.id in seen:
            problems.append(f"memorials.yaml uses the id {entry.id} more than once; skipped")
            continue
        seen.add(entry.id)
        entries.append(entry)
    return CuratedMemorials(entries, problems)


def read_suppressed(repo_root: Path) -> tuple[list[Suppression], list[str]]:
    """Every suppression in suppressed.yaml. A broken line is reported, and when it still names an
    id, that id is suppressed anyway: removal always wins."""
    raw = _load_list(repo_root / SUPPRESSED_FILE, "suppressed.yaml")
    found: list[Suppression] = []
    problems: list[str] = []
    for index, item in enumerate(raw):
        where = f"suppressed.yaml entry {index + 1}"
        if isinstance(item, str | int) and not isinstance(item, bool):
            found.append(Suppression(str(item).strip()))
            continue
        if not isinstance(item, dict) or item.get("id") in (None, ""):
            problems.append(f"{where} must be an id, or a mapping with an id")
            continue
        unknown = sorted(set(item) - SUPPRESSED_KEYS)
        if unknown:
            problems.append(f"{where} has unknown keys: {', '.join(map(str, unknown))}")
        day = _date(item.get("date"))
        lat, lng = _coordinate(item.get("lat")), _coordinate(item.get("lng"))
        if item.get("date") is not None and day is None:
            problems.append(f"{where} has a date that is not YYYY-MM-DD")
        if (lat is None) != (lng is None) or (lat is not None and not in_philadelphia(lat, lng)):
            problems.append(f"{where} needs both lat and lng inside Philadelphia")
            lat = lng = None
        found.append(Suppression(str(item["id"]).strip(), day, lat, lng))
    return found, problems
