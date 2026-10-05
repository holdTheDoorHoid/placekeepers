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
"""

from __future__ import annotations

import logging
import re
from collections import Counter
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


def build_libraries(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    features = []
    missing = 0
    for row in _rows(paths["library_locations"]):
        point = _point(row.get("geometry"))
        name = _text(row.get("building"))
        if point is None or name is None:
            missing += 1
            continue
        link = _text(row.get("library_url"))
        zip_code = (_text(row.get("zip_code")) or "")[:5] or None
        properties = {
            "id": f"lib{row['objectid']}",
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
    for row in _rows(paths["ppr_program_sites"]):
        kind = RECREATION_KINDS.get((_text(row.get("program_type")) or "").upper())
        if kind is None:
            continue  # the pools among the program sites: the pools layer has them
        point = _point(row.get("geometry"))
        name = _text(row.get("park_name"))
        if point is None or name is None:
            missing += 1
            continue
        properties = {
            "id": f"rec{row['objectid']}",
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


PLACE_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(PLACES_FILE, "libraries", ("library_locations",), build_libraries),
    LayerBuilder(PLACES_FILE, "recreation", ("ppr_program_sites",), build_recreation),
    LayerBuilder(PLACES_FILE, "pools", ("ppr_swimming_pools", "ppr_spraygrounds"), build_pools),
    LayerBuilder(PLACES_FILE, "park_water", ("ppr_hydration_stations",), build_park_water),
)
