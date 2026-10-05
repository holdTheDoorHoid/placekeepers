"""Conditions reported to Philly311 (M3.5): illegal dumping, street and alley lights out, and
graffiti, from the City's 311 table on Carto (`public_cases_fc`).

311 requests are used for physical conditions only, never for people (docs/ETHICS.md). The
registry's `where` limits the download to four kinds of request, by the City's service code, made
in the last 120 days; the map shows the last 90 of them (placekeepers.publish.conditions), so a
snapshot a few days old still covers the whole window:

    SR-ST02  Illegal Dumping
    SR-ST04  Street Light Outage
    SR-ST06  Alley Light Outage
    SR-CL01  Graffiti Removal

Only what the map needs is downloaded: the code, whether the request is open or closed, the day it
was made and the day it was closed (in Philadelphia), and the point where it was reported. The
table also holds the request number, the address, a subject and free text notes, a photo link and
which agency handles it; none of those are downloaded (`never_fetch`, checked by the tests), so
nothing about who reported, and no text anyone wrote, can reach the cache or the map. Requests
about people (for example "Homeless Encampment Request") are never asked for.

Verified against the live table on 2026-10-05 (5,957,830 requests since 2014; the newest was made
the day before): 6,496 requests of these four kinds in the last 120 days, 6 of them without a
point; the only statuses are Open and Closed.
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAdapter, Column

#: The City's service codes we keep, and what each is (docs/CONTRACTS.md section 4).
SERVICE_CODES = {
    "SR-ST02": "Illegal Dumping",
    "SR-ST04": "Street Light Outage",
    "SR-ST06": "Alley Light Outage",
    "SR-CL01": "Graffiti Removal",
}


class Philly311Conditions(CartoAdapter):
    columns = (
        Column("service_code", "service_code", "VARCHAR"),
        Column("status", "status", "VARCHAR"),
        Column("requested", "requested_datetime", "LOCAL_DATE"),
        Column("closed", "closed_datetime", "LOCAL_DATE"),
        Column("lat", "ST_Y(the_geom)", "DOUBLE"),
        Column("lng", "ST_X(the_geom)", "DOUBLE"),
    )
    required_columns = ("service_code", "status", "requested", "closed", "lat", "lng")

    #: Fields this adapter must never download (checked by the tests).
    never_fetch = (
        "service_request_id",
        "objectid",
        "address",
        "subject",
        "status_notes",
        "service_notice",
        "media_url",
        "agency_responsible",
        "zipcode",
    )
