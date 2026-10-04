"""Small made up street safety data for the tests: a street grid, crashes, Police fatal crash
records and schools. Every record is invented; none describes a real crash or person.

The grid sits in Philadelphia near Broad and Spring Garden, laid out in meters east (x) and north
(y) of an origin:

        y=100  OAK ST   seg 3 (x 0 to 120)    seg 4 (x 120 to 240)
                 |                  |                    |
               1ST ST seg 5      2ND ST seg 6         3RD ST seg 7
                 |                  |                    |
        y=0    MAIN ST  seg 1 (x 0 to 120)    seg 2 (x 120 to 240)   (state road, High Injury
                                                                       Network)
    plus a walkway (seg 8) that carries no traffic and is left out.
"""

from __future__ import annotations

import math
from datetime import date

import pyarrow as pa
import shapely
from shapely.geometry import LineString, MultiLineString, Point

ORIGIN_LNG = -75.16
ORIGIN_LAT = 39.96
METERS_PER_DEGREE_LAT = 111_000.0
METERS_PER_DEGREE_LNG = 111_000.0 * math.cos(math.radians(ORIGIN_LAT))


def lnglat(x: float, y: float) -> tuple[float, float]:
    return (ORIGIN_LNG + x / METERS_PER_DEGREE_LNG, ORIGIN_LAT + y / METERS_PER_DEGREE_LAT)


def line(*points: tuple[float, float]) -> LineString:
    return LineString([lnglat(x, y) for x, y in points])


def point(x: float, y: float) -> Point:
    return Point(*lnglat(x, y))


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


# seg_id, name, class, responsible, line
SEGMENTS = [
    (1, "MAIN ST", 2, "STATE", line((0, 0), (120, 0))),
    (2, "MAIN ST", 2, "STATE", line((120, 0), (240, 0))),
    (3, "OAK ST", 5, "CITY", line((0, 100), (120, 100))),
    (4, "OAK ST", 5, "CITY", line((120, 100), (240, 100))),
    (5, "1ST ST", 5, "CITY", line((0, 0), (0, 100))),
    (6, "2ND ST", 4, "CITY", line((120, 0), (120, 100))),
    (7, "3RD ST", 5, "CITY", line((240, 0), (240, 100))),
    (8, "PARK WALK", 15, "FAIRMOUNT PARK", line((60, 30), (60, 70))),
]


def centerlines() -> pa.Table:
    return pa.table(
        {
            "seg_id": [s[0] for s in SEGMENTS],
            "stname": [s[1] for s in SEGMENTS],
            "class": [s[2] for s in SEGMENTS],
            "responsibl": [s[3] for s in SEGMENTS],
            "geometry": [wkb(s[4]) for s in SEGMENTS],
        }
    )


def high_injury_network() -> pa.Table:
    return pa.table(
        {
            "objectid": [1],
            "stname": ["MAIN ST"],
            "length_ft": [1148.0],
            "geometry": [wkb(MultiLineString([line((-50, 1), (300, 1))]))],
        }
    )


def schools() -> pa.Table:
    """One school 360 meters east of MAIN ST's east end: near seg 2, 4 and 7 only."""
    return pa.table(
        {
            "objectid": [1],
            "school_name": ["EXAMPLE ELEMENTARY"],
            "type_specific": ["DISTRICT"],
            "geometry": [wkb(point(600, 0))],
        }
    )


def crash_row(
    crn: int,
    year: int,
    x: float,
    y: float,
    *,
    level: int = 0,
    ped: int = 0,
    ped_killed: int = 0,
    ped_serious: int = 0,
    bike: int = 0,
    bike_killed: int = 0,
    bike_serious: int = 0,
    motorcycle: int = 0,
) -> dict:
    return {
        "crn": crn,
        "crash_year": year,
        "crash_month": 6,
        "max_severity_level": level,
        "fatal_count": ped_killed + bike_killed if level == 1 else 0,
        "serious_injury_count": ped_serious + bike_serious,
        "injury_count": 1 if level in (2, 3, 4, 8) else 0,
        "ped_count": ped,
        "ped_death_count": ped_killed,
        "ped_serious_injury_count": ped_serious,
        "bicycle_count": bike,
        "bicycle_death_count": bike_killed,
        "bicycle_serious_injury_count": bike_serious,
        "motorcycle_count": motorcycle,
        "motorcycle_death_count": 0,
        "motorcycle_serious_injury_count": 0,
        "crash_date": date(year, 6, 1),
        "geometry": wkb(point(x, y)),
    }


def crash_table(rows: list[dict]) -> pa.Table:
    columns = {name: [row[name] for row in rows] for name in rows[0]}
    table = {}
    for name, values in columns.items():
        if name == "crash_date":
            table[name] = pa.array(values, pa.date32())
        elif name == "geometry":
            table[name] = pa.array(values, pa.binary())
        else:
            table[name] = pa.array(values, pa.int64())
    return pa.table(table)


def newest_slice() -> pa.Table:
    """crashes_2020_2024: a walking death in the middle of OAK ST, a cycling serious injury at
    the corner of MAIN ST and 2ND ST, an injury with no one walking, and one far from any street."""
    return crash_table(
        [
            crash_row(2024000001, 2024, 60, 102, level=1, ped=1, ped_killed=1),
            crash_row(2023000002, 2023, 120, 3, level=2, bike=1, bike_serious=1),
            crash_row(2021000003, 2021, 200, -2, level=3, motorcycle=1),
            crash_row(2020000004, 2020, 60, 900, level=2, ped=1, ped_serious=1),
            crash_row(2020000005, 2020, 180, 101, level=0),
        ]
    )


def older_slice() -> pa.Table:
    """crashes_2016_2020: 2019 is only here; its 2020 rows (one repeating a crash record number of
    the newest slice) must give way to the newest slice."""
    return crash_table(
        [
            crash_row(2019000006, 2019, 240, 50, level=2, ped=1, ped_serious=1),
            crash_row(2020000005, 2020, 180, 101, level=4),
            crash_row(2020000099, 2020, 30, 0, level=3),
        ]
    )


def oldest_slice() -> pa.Table:
    """crashes_2007_2017, downloaded for 2015 only. 2015 called a serious injury "major"."""
    return crash_table([crash_row(2015000007, 2015, 10, 100, level=2, bike=1, bike_serious=1)])


def fatal_rows() -> list[dict]:
    """Police fatal crash rows as the fake Carto server holds them, including the columns we must
    never download (filled with obvious placeholders)."""

    def row(n: int, day: str, veh1: str, veh2: str, x: float, y: float, primary: str, cross):
        lng, lat = lnglat(x, y)
        return {
            "cartodb_id": n,
            "objectid": n,
            "date_": day,
            "veh1": veh1,
            "veh2": veh2,
            "primary_st": primary,
            "secondary_": cross,
            "lat": lat,
            "lng": lng,
            # Never to be fetched:
            "age": 99,
            "sex": "X",
            "dc_number": "PLACEHOLDER-CASE",
            "dc_key": "PLACEHOLDER-KEY",
            "arrest_yes": "PLACEHOLDER-ARREST",
            "investigat": "PLACEHOLDER-CHARGES",
            "crash_type": "PLACEHOLDER-NARRATIVE",
            "hit_____ru": "PLACEHOLDER",
        }

    return [
        row(1, "2026-08-20", "Auto", "Pedestrian", 60, 99, "Oak St.", "100 Block"),
        row(2, "2022-03-02", "Auto", "Bicycle", 120, 2, "Main St.", "2nd St."),
        row(3, "2023-05-05", "Auto", "Bicyclist", 240, 60, "3rd St.", None),
        row(4, "2025-11-11", "M/C", "Auto", 30, -1, "45 Main St.", None),
        row(5, "2026-01-15", "Auto", "E-Scooter", 180, 100, "Oak St.", "Near 3rd St."),
        row(6, "2026-01-15", "Auto", "E-Scooter", 180, 100, "Oak St.", "Near 3rd St."),
    ]


def fatal_table() -> pa.Table:
    """The fatal crash snapshot, as the adapter writes it."""
    rows = fatal_rows()
    return pa.table(
        {
            "objectid": pa.array([r["objectid"] for r in rows], pa.int64()),
            "date_": pa.array([date.fromisoformat(r["date_"]) for r in rows], pa.date32()),
            "veh1": [r["veh1"] for r in rows],
            "veh2": [r["veh2"] for r in rows],
            "primary_st": [r["primary_st"] for r in rows],
            "secondary_": [r["secondary_"] for r in rows],
            "lat": [r["lat"] for r in rows],
            "lng": [r["lng"] for r in rows],
        }
    )
