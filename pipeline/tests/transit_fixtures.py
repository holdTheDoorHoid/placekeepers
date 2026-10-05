"""A tiny made up GTFS feed shaped like SEPTA's: an outer zip holding google_bus.zip (buses, a
trolley, the El and a trackless trolley) and google_rail.zip (one Regional Rail line).

The schedule, around Broad St and Erie Av (all invented):

* route 10 (bus) runs 100 > 101 > 103 on weekdays at 06:50, 07:10, 07:30, 07:50, 08:10, 10:00,
  11:00, 20:30 and 25:30 (at stop 100; 5 minutes later at 101, 10 at 103). On the 07:10 trip
  nobody may board at 101 (pickup_type 1). Saturdays at 09:00 and 12:00, Sundays at 12:30.
* route T1 (trolley) runs 100 > 105 on weekdays at 12:00, so stop 100 is a bus and trolley stop.
* route L1 (El) runs 102 > 107 on weekdays at 10:00, 10:15, 10:30 and 10:45.
* route 59 (trackless trolley, GTFS route type 11) runs 108 > 109 on weekdays at 09:00.
* service EVT adds a route 10 trip at 13:00 on Tuesday 2026-10-13 only, and on Monday 2026-10-12
  (a holiday) the weekday service is replaced by HOL, with one trip at 14:00. Neither is typical.
* stop 104 has no service; 900 is a station (location_type 1), not a boarding place.
* Regional Rail: route AIR from 90004 to 90401 on weekdays at 10:00 and 11:00, weekends at 12:00.

`renumbered=True` gives the next release: stop 101 becomes 201 (12 meters away, its cross
streets written the other way round, far side), stop 108 is gone, and a new stop 300 appears.
"""

from __future__ import annotations

import io
import zipfile

BUS_START, BUS_END = "20261004", "20261231"
RAIL_START, RAIL_END = "20261004", "20261017"

#: Stop points (lat, lng). 201 stands about 12 meters north of 101.
STOPS = {
    "100": ("Broad St & Erie Av - FS", 39.960000, -75.150000, "0", "", "1"),
    "101": ("Broad St & Venango St", 39.965000, -75.150000, "0", "", "1"),
    "102": ("Erie", 39.960100, -75.150100, "0", "", "2"),
    "103": ("Broad St & Tioga St", 39.970000, -75.150000, "0", "", "1"),
    "104": ("Unused Stop", 39.961000, -75.152000, "0", "", "1"),
    "105": ("Trolley Loop", 39.960000, -75.140000, "0", "", "1"),
    "107": ("Allegheny", 39.955000, -75.150000, "0", "", "2"),
    "108": ("Erie Av & 5th St", 39.960000, -75.160000, "0", "", "1"),
    "109": ("Erie Av & 2nd St", 39.960000, -75.170000, "0", "", "1"),
    "900": ("Erie Transit Hall", 39.960050, -75.150050, "1", "", ""),
}
RENUMBERED = {"201": ("Venango St & Broad St - FS", 39.965108, -75.150000, "0", "", "1")}
NEW_STOP = {"300": ("Hunting Park Av & Broad St", 39.980000, -75.150000, "0", "", "1")}

ROUTES = [
    # route_id, short name, long name, type, sort order
    ("10", "10", "Broad-Erie to Tioga", "3", "100"),
    ("T1", "T1", "13th St to Trolley Loop", "0", "20"),
    ("L1", "L1", "Market-Frankford Line", "1", "10"),
    ("59", "59", "Erie Av Trackless", "11", "590"),
]


def _csv(header: str, rows: list[tuple]) -> str:
    lines = [header] + [",".join(str(value) for value in row) for row in rows]
    return "\n".join(lines) + "\n"


def _time(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}:00"


def _hm(text: str) -> int:
    hours, minutes = text.split(":")
    return int(hours) * 60 + int(minutes)


def bus_files(renumbered: bool = False) -> dict[str, str]:
    stops = dict(STOPS)
    second = "101"
    if renumbered:
        del stops["101"], stops["108"]
        stops.update(RENUMBERED)
        stops.update(NEW_STOP)
        second = "201"
    trips: list[tuple] = []
    stop_times: list[tuple] = []

    def trip(trip_id, route, service, start, path, shape="", gaps=(0, 5, 10), no_pickup=()):
        trips.append((route, service, trip_id, f"To {path[-1]}", "0", shape))
        for seq, (stop, gap) in enumerate(zip(path, gaps, strict=True), start=1):
            when = _time(_hm(start) + gap)
            pickup = "1" if stop in no_pickup else "0"
            stop_times.append((trip_id, when, when, stop, seq, pickup, "0"))

    weekday = ["06:50", "07:10", "07:30", "07:50", "08:10", "10:00", "11:00", "20:30", "25:30"]
    for n, start in enumerate(weekday, start=1):
        no_pickup = (second,) if start == "07:10" else ()
        trip(f"10wk{n}", "10", "WK", start, ["100", second, "103"], "S10", no_pickup=no_pickup)
    for n, start in enumerate(["09:00", "12:00"], start=1):
        trip(f"10sa{n}", "10", "SA", start, ["100", second, "103"], "S10")
    trip("10su1", "10", "SU", "12:30", ["100", second, "103"], "S10")
    trip("10evt", "10", "EVT", "13:00", ["100", second, "103"], "S10")
    trip("10hol", "10", "HOL", "14:00", ["100", second, "103"], "S10")
    trip("T1wk1", "T1", "WK", "12:00", ["100", "105"], "ST1", gaps=(0, 10))
    for n, start in enumerate(["10:00", "10:15", "10:30", "10:45"], start=1):
        trip(f"L1wk{n}", "L1", "WK", start, ["102", "107"], gaps=(0, 4))
    if not renumbered:
        trip("59wk1", "59", "WK", "09:00", ["108", "109"], gaps=(0, 6))
    else:
        trip("59wk1", "59", "WK", "09:00", ["300", "109"], gaps=(0, 6))

    shapes = [
        ("S10", 39.960000, -75.150000, 1),
        ("S10", 39.965000, -75.150000, 2),
        ("S10", 39.970000, -75.150000, 3),
        ("ST1", 39.960000, -75.150000, 1),
        ("ST1", 39.960000, -75.140000, 2),
    ]
    return {
        "agency.txt": _csv(
            "agency_id,agency_name,agency_url,agency_timezone",
            [(1, "SEPTA", "https://septa.org/", "America/New_York")],
        ),
        "feed_info.txt": _csv(
            "feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version",
            [
                (
                    "SEPTA",
                    "https://septa.org/",
                    "en",
                    BUS_START,
                    BUS_END,
                    "vtest2" if renumbered else "vtest1",
                )
            ],
        ),
        "calendar.txt": _csv(
            "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
            [
                ("WK", 1, 1, 1, 1, 1, 0, 0, BUS_START, BUS_END),
                ("SA", 0, 0, 0, 0, 0, 1, 0, BUS_START, BUS_END),
                ("SU", 0, 0, 0, 0, 0, 0, 1, BUS_START, BUS_END),
                ("EVT", 0, 0, 0, 0, 0, 0, 0, BUS_START, BUS_END),
                ("HOL", 0, 0, 0, 0, 0, 0, 0, BUS_START, BUS_END),
            ],
        ),
        "calendar_dates.txt": _csv(
            "service_id,date,exception_type",
            [("EVT", "20261013", 1), ("WK", "20261012", 2), ("HOL", "20261012", 1)],
        ),
        "routes.txt": _csv(
            "route_id,agency_id,route_short_name,route_long_name,route_type,route_sort_order",
            [(rid, 1, short, long, kind, order) for rid, short, long, kind, order in ROUTES],
        ),
        "trips.txt": _csv("route_id,service_id,trip_id,trip_headsign,direction_id,shape_id", trips),
        "stop_times.txt": _csv(
            "trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type",
            stop_times,
        ),
        "stops.txt": _csv(
            "stop_id,stop_code,stop_name,stop_lat,stop_lon,location_type,parent_station,"
            "wheelchair_boarding",
            [
                (sid, sid, name, lat, lng, loc, parent, wc)
                for sid, (name, lat, lng, loc, parent, wc) in stops.items()
            ],
        ),
        "shapes.txt": _csv("shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence", shapes),
    }


def rail_files() -> dict[str, str]:
    return {
        "feed_info.txt": _csv(
            "feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version",
            [("SEPTA", "https://septa.org/", "en", RAIL_START, RAIL_END, "vtest1")],
        ),
        "calendar.txt": _csv(
            "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date",
            [
                ("RWK", 1, 1, 1, 1, 1, 0, 0, RAIL_START, RAIL_END),
                ("RWE", 0, 0, 0, 0, 0, 1, 1, RAIL_START, RAIL_END),
            ],
        ),
        "routes.txt": _csv(
            "route_id,agency_id,route_short_name,route_long_name,route_type",
            [("AIR", 1, "AIR", "Airport Line", 2)],
        ),
        "trips.txt": _csv(
            "route_id,service_id,trip_id,trip_headsign,direction_id,shape_id",
            [
                ("AIR", "RWK", "AIR1", "Airport", 1, ""),
                ("AIR", "RWK", "AIR2", "Airport", 1, ""),
                ("AIR", "RWE", "AIR3", "Airport", 1, ""),
            ],
        ),
        "stop_times.txt": _csv(
            "trip_id,arrival_time,departure_time,stop_id,stop_sequence",
            [
                ("AIR1", "10:00:00", "10:00:00", "90004", 1),
                ("AIR1", "10:20:00", "10:20:00", "90401", 2),
                ("AIR2", "11:00:00", "11:00:00", "90004", 1),
                ("AIR2", "11:20:00", "11:20:00", "90401", 2),
                ("AIR3", "12:00:00", "12:00:00", "90004", 1),
                ("AIR3", "12:20:00", "12:20:00", "90401", 2),
            ],
        ),
        "stops.txt": _csv(
            "stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding",
            [
                ("90004", "Gray 30th St Station", 39.95667, -75.18166, 1),
                ("90401", "Airport Terminal A", 39.87710, -75.24410, 1),
            ],
        ),
    }


def _zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, text in files.items():
            archive.writestr(name, text)
    return buffer.getvalue()


def septa_zip(renumbered: bool = False) -> bytes:
    """SEPTA's download: an outer zip with google_bus.zip and google_rail.zip inside."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as archive:
        archive.writestr("google_bus.zip", _zip(bus_files(renumbered)))
        archive.writestr("google_rail.zip", _zip(rail_files()))
    return buffer.getvalue()


def write_feed(folder, files: dict[str, str]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (folder / name).write_text(text, encoding="utf-8")


#: A stop summary like SEPTA's (one row per route, direction and stop).
RIDERSHIP_FIELDS = [
    ["FID", "OID"],
    ["Mode", "String"],
    ["Route", "String"],
    ["Direction", "String"],
    ["Stop_Code", "Integer"],
    ["Stop", "String"],
    ["Lat", "Double"],
    ["Lon", "Double"],
    ["Sign_Up", "String"],
    ["WK_Ons", "Integer"],
    ["WK_Offs", "Integer"],
    ["Sat_Ons", "Integer"],
    ["Sat_Offs", "Integer"],
    ["Sun_Ons", "Integer"],
    ["Sun_Offs", "Integer"],
]
