"""The rules for each lot (M4.6, issue #42; docs/CONTRACTS.md section 6, the dossier's `rules`).

For every lot with a dossier, which of these apply, joined by the lot's shape:

* **historic districts** (`historic_districts`): a district covers the lot's point on its shape,
  or at least a tenth of its shape;
* **the Philadelphia Register of Historic Places** (`historic_sites`): one of the Register's
  parcel shapes covers the lot's point on its shape. The Register has no parcel numbers, and its
  shapes are copies of the Water Department's parcels, so the lot's point falls inside its own;
* **zoning overlays** (`zoning_overlays`) and **the base zoning district**
  (`zoning_base_districts`): by the same rule as the historic districts (the base district by
  the lot's point only, one district per lot);
* **brownfield properties** (`epa_brownfields`): the EPA's point for the site lies within 100
  meters of the lot's shape (or its point, for a lot without one). EPA's points are addresses,
  most placed to within 30 to 50 meters, and a site often covers several lots, so the lot page
  says "at or near this address".

Dates the Commission writes as text ("6/24/1958") are read as days; a placeholder such as
1/1/3000, or any day after the build, is no date. Nothing here says whether a lot can be built
on: the page names the rules and who to ask.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections import defaultdict
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import numpy as np
import shapely
from shapely import STRtree

from placekeepers.derive.timeline import clean_text

PHILADELPHIA = ZoneInfo("America/New_York")

#: A lot is "at or near" a brownfield property when the EPA's point lies this close to its shape.
BROWNFIELD_M = 100.0
#: The nearest brownfield properties a lot page lists; the rest are counted (`brownfields_more`):
#: a few lots have dozens within 100 meters, where the EPA placed many sites at one address.
BROWNFIELDS_LISTED = 3
#: A district or an overlay applies when it covers the lot's point on its shape, or at least this
#: share of the shape (a lot split by a district's edge).
SHARE = 0.10
#: The Historical Commission was created in 1955; the Register's oldest designations are 1956.
EARLIEST_DESIGNATION = 1900

# Meters per degree near Philadelphia (latitude 40), for short distances.
M_PER_DEG_LAT = 111_000.0
M_PER_DEG_LNG = 111_000.0 * math.cos(math.radians(40.0))

#: The overlay types of the Planning Commission's layer, as the map's codes (`t`).
OVERLAY_TYPES = {
    "OVERLAY DISTRICT": 1,
    "SUPPLEMENTAL CONTROL": 2,
    "WISSAHICKON WATERSHED IMPERVIOUS COVERAGE RESTRICTION": 3,
}

_CITY_DAY = re.compile(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$")


def city_day(text: Any, today: date) -> str | None:
    """A day the Commission writes as M/D/YYYY, as YYYY-MM-DD; None when it is not a real day
    from 1900 to `today` (1/1/3000 marks a district whose date the layer does not hold)."""
    if text is None:
        return None
    found = _CITY_DAY.match(str(text))
    if not found:
        return None
    month, day, year = (int(part) for part in found.groups())
    try:
        value = date(year, month, day)
    except ValueError:
        return None
    if year < EARLIEST_DESIGNATION or value > today:
        return None
    return value.isoformat()


def stamp_day(value: Any, today: date) -> str | None:
    """A date the layer stores as a time (midnight in Philadelphia, written in UTC) as its day in
    Philadelphia, under the same limits as city_day."""
    if value is None:
        return None
    if isinstance(value, datetime):
        moment = value if value.tzinfo else value.replace(tzinfo=UTC)
        day = moment.astimezone(PHILADELPHIA).date()
    elif isinstance(value, date):
        day = value
    else:
        return None
    if day.year < EARLIEST_DESIGNATION or day > today:
        return None
    return day.isoformat()


def district_day(text: Any, stamp: Any, today: date) -> str | None:
    """A historic district's designation day: the Commission's text first (it holds the right day
    where the stored date is the placeholder 3000-01-01), else the stored date."""
    return city_day(text, today) or stamp_day(stamp, today)


def plain_symbol(symbol: Any) -> str | None:
    """An overlay's symbol (/CTR), or None where the layer writes [N/A]."""
    text = clean_text(symbol)
    if text is None or text.upper() in ("[N/A]", "N/A"):
        return None
    return text


def not_applicable(value: Any) -> str | None:
    text = clean_text(value)
    return None if text is None or text.upper() in ("N/A", "[N/A]", "NONE") else text


def overlay_key(name: str, symbol: str | None, kind: int, section: str | None) -> str:
    """A short id for one overlay, the same every week while the Commission keeps its name, symbol,
    type and code section: `o` and 8 hexadecimal digits."""
    digest = hashlib.sha1(
        "|".join([name, symbol or "", str(kind), section or ""]).encode("utf-8")
    ).hexdigest()
    return f"o{digest[:8]}"


def overlay_record(row: Mapping[str, Any], today: date) -> dict[str, Any] | None:
    """One overlay as the lot page and `dossiers/common.json` show it, or None without a name."""
    name = clean_text(row.get("overlay_name"))
    if name is None:
        return None
    kind = OVERLAY_TYPES.get((clean_text(row.get("type")) or "").upper(), 0)
    symbol = plain_symbol(row.get("overlay_symbol"))
    section = not_applicable(row.get("code_section"))
    record: dict[str, Any] = {
        "id": overlay_key(name, symbol, kind, section),
        "name": name,
        "symbol": symbol,
        "type": kind,
        "section": section,
        "link": not_applicable(row.get("code_section_link")),
    }
    sunset = row.get("sunset_date")
    if sunset is not None:
        moment = sunset if isinstance(sunset, datetime) else None
        if moment is not None:
            moment = moment if moment.tzinfo else moment.replace(tzinfo=UTC)
            record["sunset"] = moment.astimezone(PHILADELPHIA).date().isoformat()
    if (clean_text(row.get("pending")) or "").upper() == "YES":
        record["pending_bill"] = not_applicable(row.get("pendingbill"))
        record["pending_url"] = not_applicable(row.get("pendingbillurl"))
    return {key: value for key, value in record.items() if value is not None}


@dataclass
class RuleSets:
    """The shapes the rules are joined against, each list with its records in the same order."""

    districts: list[Any] = field(default_factory=list)
    district_records: list[dict[str, Any]] = field(default_factory=list)
    sites: list[Any] = field(default_factory=list)
    site_records: list[dict[str, Any]] = field(default_factory=list)
    overlays: list[Any] = field(default_factory=list)
    overlay_ids: list[str] = field(default_factory=list)
    zoning: list[Any] = field(default_factory=list)
    zoning_records: list[dict[str, Any]] = field(default_factory=list)
    #: brownfield points in meters (x east, y north), with their records
    brownfields: list[Any] = field(default_factory=list)
    brownfield_records: list[dict[str, Any]] = field(default_factory=list)


def to_meters(geometry: Any) -> Any:
    """A shape in longitude and latitude, in meters on a plane near Philadelphia."""
    return shapely.transform(geometry, lambda xy: xy * np.array([M_PER_DEG_LNG, M_PER_DEG_LAT]))


def valid(shape: Any) -> Any:
    """A shape that shapely's predicates can trust (a few City shapes cross themselves)."""
    if shape is not None and not shapely.is_valid(shape):
        return shapely.make_valid(shape)
    return shape


def _prepared(polygons: list[Any]) -> np.ndarray:
    array = np.asarray(polygons, dtype=object)
    shapely.prepare(array)
    return array


def _covering(
    polygons: list[Any], lots: list[Any], points: list[Any], areas: np.ndarray
) -> dict[int, list[int]]:
    """For each lot (by index), the polygons (by index) covering its point or at least SHARE of
    its shape. The lots go in the tree and each polygon, prepared once, asks it: a few hundred
    large shapes against tens of thousands of small ones."""
    found: dict[int, list[int]] = defaultdict(list)
    if not polygons:
        return found
    shapes = _prepared(polygons)
    tree = STRtree(lots)
    poly_index, lot_index = tree.query(shapes, predicate="intersects")
    if not len(lot_index):
        return found
    covers = shapely.covers(shapes[poly_index], np.asarray(points, dtype=object)[lot_index])
    for i, (poly, lot) in enumerate(zip(poly_index.tolist(), lot_index.tolist(), strict=True)):
        if covers[i]:
            found[lot].append(poly)
            continue
        area = areas[lot]
        if area > 0:
            shared = shapely.area(shapely.intersection(lots[lot], polygons[poly]))
            if shared >= SHARE * area:
                found[lot].append(poly)
    for lot in found:
        found[lot] = sorted(set(found[lot]))
    return found


def _holding(polygons: list[Any], points: list[Any]) -> dict[int, list[int]]:
    """For each point (by index), the polygons (by index) that hold it, in the polygons' order."""
    found: dict[int, list[int]] = defaultdict(list)
    if not polygons:
        return found
    tree = STRtree(points)
    poly_index, point_index = tree.query(_prepared(polygons), predicate="covers")
    for poly, point in sorted(zip(poly_index.tolist(), point_index.tolist(), strict=True)):
        found[point].append(poly)
    return found


def lot_rules(
    accounts: list[str],
    shapes: Mapping[str, Any],
    points: Mapping[str, tuple[float, float]],
    sets: RuleSets,
) -> dict[str, dict[str, Any]]:
    """The `rules` block of each lot that any rule applies to (docs/CONTRACTS.md section 6). A lot
    is its Water Department shape, else its OPA point; a lot with neither is left out. The shapes
    in `sets` must be valid (placekeepers.publish.rules.load_rules makes them so)."""
    keys: list[str] = []
    lots: list[Any] = []
    reps: list[Any] = []
    for account in accounts:
        shape = shapes.get(account)
        if shape is not None and not shapely.is_empty(shape):
            shape = valid(shape)
            keys.append(account)
            lots.append(shape)
            reps.append(shapely.point_on_surface(shape))
        elif account in points:
            lng, lat = points[account]
            point = shapely.Point(lng, lat)
            keys.append(account)
            lots.append(point)
            reps.append(point)
    if not keys:
        return {}
    areas = shapely.area(np.asarray(lots, dtype=object))
    out: dict[str, dict[str, Any]] = defaultdict(dict)

    # Historic districts, and the Register's own parcels.
    for lot, found in _covering(sets.districts, lots, reps, areas).items():
        districts = [sets.district_records[i] for i in found]
        districts.sort(key=lambda d: d["name"])
        out[keys[lot]].setdefault("historic", {})["districts"] = districts
    for lot, found in _holding(sets.sites, reps).items():
        # A lot on two of the Register's shapes (an older and a newer copy): the one listed on its
        # own wins, then the earlier in the layer.
        site = next((i for i in found if "date" in sets.site_records[i]), found[0])
        out[keys[lot]].setdefault("historic", {})["register"] = dict(sets.site_records[site])

    # Zoning: the base district at the lot's point (the first, if shapes overlap), and every
    # overlay.
    for lot, found in _holding(sets.zoning, reps).items():
        out[keys[lot]]["zoning"] = dict(sets.zoning_records[found[0]])
    for lot, found in _covering(sets.overlays, lots, reps, areas).items():
        out[keys[lot]]["overlays"] = sorted({sets.overlay_ids[i] for i in found})

    # Brownfield properties within 100 meters.
    if sets.brownfields:
        tree = STRtree(sets.brownfields)
        lots_m = to_meters(np.asarray(lots, dtype=object))
        lot_index, site_index = tree.query(lots_m, predicate="dwithin", distance=BROWNFIELD_M)
        near: dict[int, list[tuple[int, int]]] = defaultdict(list)
        for lot, site in zip(lot_index.tolist(), site_index.tolist(), strict=True):
            meters = round(float(shapely.distance(lots_m[lot], sets.brownfields[site])))
            near[lot].append((meters, site))
        for lot, found in near.items():
            found.sort()
            out[keys[lot]]["brownfields"] = [
                {**sets.brownfield_records[site], "m": meters}
                for meters, site in found[:BROWNFIELDS_LISTED]
            ]
            if len(found) > BROWNFIELDS_LISTED:
                out[keys[lot]]["brownfields_more"] = len(found) - BROWNFIELDS_LISTED
    return {account: ordered(rules) for account, rules in out.items()}


def ordered(rules: dict[str, Any]) -> dict[str, Any]:
    """A lot's rules with its keys in the contract's order."""
    if "historic" in rules:
        historic = rules["historic"]
        rules["historic"] = {k: historic[k] for k in ("districts", "register") if k in historic}
    return {
        key: rules[key]
        for key in ("historic", "zoning", "overlays", "brownfields", "brownfields_more")
        if key in rules and rules[key]
    }
