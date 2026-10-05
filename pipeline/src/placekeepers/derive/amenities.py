"""Amenities from OpenStreetMap (M3.5): benches, picnic tables, drinking water, public toilets and
public bookcases (little free libraries), from the weekly extract (`osm_philadelphia`).

The rules behind the amenity layers of `tiles/amenities.pmtiles` (docs/CONTRACTS.md section 4):

**Which elements.** Each layer is one tag: `amenity=bench`, `leisure=picnic_table`,
`amenity=drinking_water`, `amenity=toilets` or `amenity=public_bookcase`, drawn as a point or an
outline (a way gets a point on it). Elements closed to the public (`access` no or private) and
ones marked disused are left out. Benches at a bus stop are benches too: the shelters and benches
at stops layer counts them for their stop, and this layer shows them all.

**What each layer says,** from the element's own tags, as yes, no or unknown, with the same
reading of yes and no as the stops (`answer` in placekeepers.derive.bus_stops). An answer
OpenStreetMap does not have is left out: unknown is never shown as no.

* benches: `br` a backrest, `cv` under a roof;
* picnic tables: `cv` under a roof;
* drinking water: `bt` a bottle can be filled, `sn` 1 only part of the year (0 all year), `in` 1
  indoors;
* toilets: `ac` who may use them (1 anyone, 2 customers only), `fee`, `wc` wheelchair access (1
  yes, 0 no, 2 limited), `ct` a changing table, `in` 1 indoors, and `oh`, the opening hours as
  mapped, in OpenStreetMap's own notation;
* bookcases: nothing more than the name.

Every element also has `id` (the element, `n` and the node id or `w` and the way id) and `nm`, its
name, when it has one and is not a memorial (a bench that remembers someone, by the public art
layer's memorial rule in placekeepers.derive.art: its name is never published).
"""

from __future__ import annotations

import json
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import pyarrow as pa

from placekeepers.derive.art import osm_is_memorial
from placekeepers.derive.bus_stops import WHEELCHAIR, answer, element_id

#: Source layer -> the tag that makes an element one (docs/CONTRACTS.md section 4).
KINDS: dict[str, tuple[str, str]] = {
    "benches": ("amenity", "bench"),
    "picnic_tables": ("leisure", "picnic_table"),
    "water": ("amenity", "drinking_water"),
    "toilets": ("amenity", "toilets"),
    "bookcases": ("amenity", "public_bookcase"),
}
#: Plain words for the build notes.
TITLES = {
    "benches": "Benches",
    "picnic_tables": "Picnic tables",
    "water": "Drinking water",
    "toilets": "Public toilets",
    "bookcases": "Public bookcases",
}

CLOSED = frozenset({"no", "private"})
#: `ac` for toilets: who may use them.
ANYONE, CUSTOMERS = 1, 2
ACCESS = {
    "yes": ANYONE,
    "public": ANYONE,
    "permissive": ANYONE,
    "designated": ANYONE,
    "customers": CUSTOMERS,
}
YES_WORDS = frozenset({"yes"})
NO_WORDS = frozenset({"no"})


def _yes_no(tags: Mapping[str, str], key: str) -> int | None:
    """1 yes, 0 no, None for anything else (a missing tag or a value we do not read)."""
    value = (tags.get(key) or "").strip().lower()
    if value in YES_WORDS:
        return 1
    if value in NO_WORDS:
        return 0
    return None


def _seasonal(tags: Mapping[str, str]) -> int | None:
    """1 only part of the year (`seasonal=yes` or a season such as summer), 0 all year."""
    value = (tags.get("seasonal") or "").strip().lower()
    if not value:
        return None
    return 0 if value == "no" else 1


def _indoors(tags: Mapping[str, str]) -> int | None:
    if tags.get("indoor") == "yes" or tags.get("location") == "indoor":
        return 1
    if tags.get("indoor") == "no" or tags.get("location") == "outdoor":
        return 0
    return None


def is_kind(tags: Mapping[str, str], kind: str) -> bool:
    key, value = KINDS[kind]
    return tags.get(key) == value


def is_open_to_public(tags: Mapping[str, str]) -> bool:
    return tags.get("access") not in CLOSED and tags.get("disused") != "yes"


def amenity_properties(kind: str, element: str, tags: Mapping[str, str]) -> dict[str, Any]:
    """The tile properties of one element (see the module docstring)."""
    props: dict[str, Any] = {"id": element}
    found: dict[str, int | None] = {}
    if kind == "benches":
        found = {"br": _yes_no(tags, "backrest"), "cv": answer(tags, "covered")}
    elif kind == "picnic_tables":
        found = {"cv": answer(tags, "covered")}
    elif kind == "water":
        found = {"bt": _yes_no(tags, "bottle"), "sn": _seasonal(tags), "in": _indoors(tags)}
    elif kind == "toilets":
        wheelchair = (tags.get("wheelchair") or "").strip().lower()
        found = {
            "ac": ACCESS.get((tags.get("access") or "").strip().lower()),
            "fee": _yes_no(tags, "fee"),
            "wc": WHEELCHAIR.get(wheelchair),
            "ct": _yes_no(tags, "changing_table"),
            "in": _indoors(tags),
        }
        hours = (tags.get("opening_hours") or "").strip()
        if hours:
            props["oh"] = hours[:120]
    props.update({key: value for key, value in found.items() if value is not None})
    name = (tags.get("name") or "").strip()
    # A memorial bench or bookcase names someone who died, and names of people who died come only
    # from the hand curated memorials file (docs/ETHICS.md): its name is left out, by the public art
    # layer's memorial rule (derive/art.py, M3.2).
    if name and not osm_is_memorial(tags):
        props["nm"] = name
    return props


@dataclass
class Amenity:
    id: str
    lat: float
    lng: float
    in_city: bool
    properties: dict[str, Any]


def find_amenities(table: pa.Table, kind: str) -> tuple[list[Amenity], list[str]]:
    """Every element of one kind in a snapshot of `osm_philadelphia`, in and around the city,
    sorted by id, and plain notes about the data."""
    columns = {
        name: table.column(name).to_pylist()
        for name in ("osm_type", "osm_id", "tags", "lat", "lng", "in_city")
    }
    found: list[Amenity] = []
    closed = 0
    for i, text in enumerate(columns["tags"]):
        tags = json.loads(text) if text else {}
        if not is_kind(tags, kind) or columns["lat"][i] is None or columns["lng"][i] is None:
            continue
        if not is_open_to_public(tags):
            closed += bool(columns["in_city"][i])
            continue
        element = element_id(columns["osm_type"][i], columns["osm_id"][i])
        found.append(
            Amenity(
                id=element,
                lat=float(columns["lat"][i]),
                lng=float(columns["lng"][i]),
                in_city=bool(columns["in_city"][i]),
                properties=amenity_properties(kind, element, tags),
            )
        )
    found.sort(key=lambda item: item.id)
    notes = []
    if closed:
        notes.append(f"{TITLES[kind]}: {closed:,} not open to the public left out")
    return found, notes


def summary_note(kind: str, amenities: list[Amenity], as_of: str | None) -> str:
    """One plain sentence for the build notes, such as "Public toilets in OpenStreetMap (data of
    2026-10-03): 73 in the city (as mapped: 22 open to anyone, 20 wheelchair accessible)"."""
    inside = [a for a in amenities if a.in_city]
    line = f"{TITLES[kind]} in OpenStreetMap"
    if as_of:
        line += f" (data of {as_of})"
    line += f": {len(inside):,} in the city"
    counts: Counter = Counter()
    for item in inside:
        props = item.properties
        for key in ("br", "cv", "bt"):
            counts[key] += props.get(key) == 1
        counts["wc"] += props.get("wc") == 1
        counts["anyone"] += props.get("ac") == ANYONE
    details = {
        "benches": [("br", "with a backrest"), ("cv", "under a roof")],
        "picnic_tables": [("cv", "under a roof")],
        "water": [("bt", "where a bottle can be filled")],
        "toilets": [("anyone", "open to anyone"), ("wc", "wheelchair accessible")],
        "bookcases": [],
    }[kind]
    parts = [f"{counts[key]:,} {words}" for key, words in details if counts[key]]
    if parts:
        line += " (as mapped: " + ", ".join(parts) + ")"
    return line
