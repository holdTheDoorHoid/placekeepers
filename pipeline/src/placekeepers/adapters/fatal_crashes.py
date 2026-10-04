"""Fatal crashes from the Police Department (Carto table fatal_crashes), refreshed nightly.

Each row is one person killed in a traffic crash since 2019 (a crash that killed two people has two
rows). We download only what the memorials and the street safety lens need:

    objectid                 the table's row number (not a case number)
    date_                    the day of the crash
    veh1, veh2               free text naming the two units involved, such as "Auto", "Pedestrian",
                             "Bicycle" (until 2022) or "Bicyclist" (from 2023), "E-Scooter", "M/C"
    primary_st, secondary_   the street (sometimes with a house number) and the cross street
    lat, lng                 the Police Department's point

The table also holds case numbers, each victim's age and sex, a narrative, a hit and run flag and
arrest and charge details. Placekeepers never publishes those (docs/ETHICS.md), so it never
downloads them either: nothing can leak from a cache or a snapshot that never held them.

The City notes that this table records where the Police first reported a crash, while PennDOT's
crash records hold investigated locations, and that the two should not be compared. We use this
table only for recent deaths (memorials and "a death in the last two years"), never mixed into
PennDOT's counts.

Verified against the live table on 2026-10-04 (935 rows, 2019-01-02 to 2026-08-22).
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAdapter, Column


class FatalCrashes(CartoAdapter):
    columns = (
        Column("objectid", "objectid", "BIGINT"),
        Column("date_", "date_", "DATE"),
        Column("veh1", "veh1", "VARCHAR"),
        Column("veh2", "veh2", "VARCHAR"),
        Column("primary_st", "primary_st", "VARCHAR"),
        Column("secondary_", "secondary_", "VARCHAR"),
        Column("lat", "COALESCE(ST_Y(the_geom), point_y)", "DOUBLE"),
        Column("lng", "COALESCE(ST_X(the_geom), point_x)", "DOUBLE"),
    )
    required_columns = ("objectid", "date_", "veh1", "veh2", "lat", "lng")

    #: Fields this adapter must never download (checked by the tests).
    never_fetch = (
        "age",
        "sex",
        "dc_number",
        "dc_key",
        "arrest_yes",
        "investigat",
        "crash_type",
        "hit_____ru",
    )
