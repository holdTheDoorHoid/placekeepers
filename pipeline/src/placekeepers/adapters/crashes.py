"""Crashes from PennDOT's crash records, as the City publishes them (City ArcGIS).

The City publishes PennDOT's reportable crashes in Philadelphia as five year slices, one feature
service each. Each slice names its fields differently (the older ones were shapefiles, so their
names are cut to ten characters), and later slices revise earlier years. Each slice is its own
source, and its adapter writes the same columns:

    crn                              PennDOT's crash record number
    crash_year, crash_month          PennDOT publishes the month, never the day
    crash_date                       the first day of that month, for the health check
    max_severity_level               PennDOT's code for the worst injury in the crash:
                                     0 no injury, 1 killed, 2 suspected serious injury (called
                                     "major injury" before 2016), 3 suspected minor (moderate),
                                     4 possible (minor), 8 injury of unknown severity, 9 unknown
    fatal_count                      people killed
    serious_injury_count             people with a suspected serious (before 2016: major) injury
    injury_count                     people injured, any severity
    ped_count, ped_death_count, ped_serious_injury_count                people walking
    bicycle_count, bicycle_death_count, bicycle_serious_injury_count    people cycling
    motorcycle_count, motorcycle_death_count, motorcycle_serious_injury_count
    geometry                         the crash point (longitude and latitude)

Only these fields are downloaded. The slices also count drivers by age band and carry many crash
flags; none of that is needed, so none of it is fetched. PennDOT's public crash data has no field
for scooters.

Slices used (verified against the live services on 2026-10-04):

    collision_crash_2020_2024   36,303 crashes, 2020 to 2024
    COLLISION_CRASH_2016_2020   45,308 crashes, 2016 to 2020 (used for 2016 to 2019)
    COLLISION_CRASH_2007_2017   77,462 crashes, 2007 to 2017 (only 2015 is downloaded)

Which slice counts for which year is decided when the layers are built
(placekeepers.derive.street_safety.combine_slices): every year comes from the newest slice that
covers it, and a crash record number is never counted twice.
"""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from typing import Any, ClassVar

import numpy as np
import pyarrow as pa
import shapely
from shapely.geometry import Point, shape

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.cache import RawFetch
from placekeepers.geo import GEOMETRY_COLUMN, write_geoparquet

# Our column, then the kind of value it holds.
COLUMNS: dict[str, str] = {
    "crn": "int",
    "crash_year": "int",
    "crash_month": "int",
    "max_severity_level": "int",
    "fatal_count": "int",
    "serious_injury_count": "int",
    "injury_count": "int",
    "ped_count": "int",
    "ped_death_count": "int",
    "ped_serious_injury_count": "int",
    "bicycle_count": "int",
    "bicycle_death_count": "int",
    "bicycle_serious_injury_count": "int",
    "motorcycle_count": "int",
    "motorcycle_death_count": "int",
    "motorcycle_serious_injury_count": "int",
}


def _int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number):
        return None
    return int(round(number))


def _float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(number) else number


def month_start(year: int | None, month: int | None) -> date | None:
    if year is None or not 1900 <= year <= 2100:
        return None
    if month is None or not 1 <= month <= 12:
        month = 1
    return date(year, month, 1)


class CrashSlice(ArcgisAdapter):
    """One slice of the City's crash services. Subclasses name the slice's own field for each of
    our columns, plus its decimal latitude and longitude (used when a feature has no geometry)."""

    #: our column -> the slice's field name, exactly as the layer spells it
    field_map: ClassVar[dict[str, str]] = {}
    #: the slice's decimal latitude and longitude fields
    lat_field: ClassVar[str] = ""
    lng_field: ClassVar[str] = ""
    object_id_field: ClassVar[str] = "objectid"

    required_columns = (*COLUMNS, "crash_date", GEOMETRY_COLUMN)

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if cls.field_map:
            missing = set(COLUMNS) - set(cls.field_map)
            if missing:
                raise TypeError(f"{cls.__name__} does not map {sorted(missing)}")
            cls.query_fields = (
                cls.object_id_field,
                *cls.field_map.values(),
                cls.lat_field,
                cls.lng_field,
            )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        values: dict[str, list[Any]] = {name: [] for name in COLUMNS}
        geometries: list[Any] = []
        from_coordinates = 0
        for page in sorted(raw.dir.glob("page-*.geojson")):
            data = json.loads(page.read_text(encoding="utf-8"))
            for feature in data.get("features") or []:
                properties = feature.get("properties") or {}
                for column, field in self.field_map.items():
                    values[column].append(_int(properties.get(field)))
                geometry = feature.get("geometry")
                point = shape(geometry) if geometry else None
                if point is None or point.is_empty:
                    lat = _float(properties.get(self.lat_field))
                    lng = _float(properties.get(self.lng_field))
                    point = Point(lng, lat) if lat and lng else None
                    if point is not None:
                        from_coordinates += 1
                geometries.append(point)
        if not geometries:
            raise FetchError("The download has no crashes")
        columns: dict[str, pa.Array] = {
            name: pa.array(values[name], type=pa.int64()) for name in COLUMNS
        }
        columns["crash_date"] = pa.array(
            [
                month_start(year, month)
                for year, month in zip(values["crash_year"], values["crash_month"], strict=True)
            ],
            type=pa.date32(),
        )
        wkb = shapely.to_wkb(np.array(geometries, dtype=object), flavor="iso")
        columns[GEOMETRY_COLUMN] = pa.array(list(wkb), type=pa.binary())
        missing = sum(1 for g in geometries if g is None)
        if from_coordinates:
            self.notes.append(f"{from_coordinates:,} crashes placed from their latitude field")
        if missing:
            self.notes.append(f"{missing:,} crashes have no location")
        write_geoparquet(pa.table(columns), out, ["Point"])


class Crashes20202024(CrashSlice):
    field_map: ClassVar[dict[str, str]] = {
        "crn": "crn",
        "crash_year": "crash_year",
        "crash_month": "crash_month",
        "max_severity_level": "max_severity_level",
        "fatal_count": "fatal_count",
        "serious_injury_count": "susp_serious_inj_count",
        "injury_count": "injury_count",
        "ped_count": "ped_count",
        "ped_death_count": "ped_death_count",
        "ped_serious_injury_count": "ped_susp_serious_inj_count",
        "bicycle_count": "bicycle_count",
        "bicycle_death_count": "bicycle_death_count",
        "bicycle_serious_injury_count": "bicycle_susp_serious_inj_count",
        "motorcycle_count": "motorcycle_count",
        "motorcycle_death_count": "mcycle_death_count",
        "motorcycle_serious_injury_count": "mcycle_susp_serious_inj_count",
    }
    lat_field = "dec_latitude"
    lng_field = "dec_longitude"


class Crashes20162020(CrashSlice):
    """A shapefile era slice: upper case names cut to ten characters."""

    field_map: ClassVar[dict[str, str]] = {
        "crn": "CRN",
        "crash_year": "CRASH_YEAR",
        "crash_month": "CRASH_MONT",
        "max_severity_level": "MAX_SEVERI",
        "fatal_count": "FATAL_COUN",
        "serious_injury_count": "SUSP_SERIO",
        "injury_count": "INJURY_COU",
        "ped_count": "PED_COUNT",
        "ped_death_count": "PED_DEATH_",
        "ped_serious_injury_count": "PED_SUSP_S",
        "bicycle_count": "BICYCLE_CO",
        "bicycle_death_count": "BICYCLE_DE",
        "bicycle_serious_injury_count": "BICYCLE_SU",
        "motorcycle_count": "MOTORCYCLE",
        "motorcycle_death_count": "MCYCLE_DEA",
        "motorcycle_serious_injury_count": "MCYCLE_SUS",
    }
    lat_field = "DEC_LAT"
    lng_field = "DEC_LONG"
    object_id_field = "OBJECTID"


class Crashes20072017(CrashSlice):
    """Before 2016 PennDOT called a serious injury a "major injury"; it is the same level."""

    query_where = "crash_year = 2015"
    field_map: ClassVar[dict[str, str]] = {
        "crn": "crn",
        "crash_year": "crash_year",
        "crash_month": "crash_month",
        "max_severity_level": "max_severity_level",
        "fatal_count": "fatal_count",
        "serious_injury_count": "maj_inj_count",
        "injury_count": "injury_count",
        "ped_count": "ped_count",
        "ped_death_count": "ped_death_count",
        "ped_serious_injury_count": "ped_maj_inj_count",
        "bicycle_count": "bicycle_count",
        "bicycle_death_count": "bicycle_death_count",
        "bicycle_serious_injury_count": "bicycle_maj_inj_count",
        "motorcycle_count": "motorcycle_count",
        "motorcycle_death_count": "mcycle_death_count",
        "motorcycle_serious_injury_count": "mcycle_maj_inj_count",
    }
    lat_field = "dec_lat"
    lng_field = "dec_long"
