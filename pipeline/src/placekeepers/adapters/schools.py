"""Schools (City ArcGIS Schools, the OpenDataPhilly "Schools" dataset).

One point per school: School District, charter, archdiocesan and private schools, geocoded by the
City Planning Commission from each school's address. We keep the name, the address, the grade
levels, the type and the point. The street safety lens asks whether a school is within 400 meters
of a block.

Verified against the live service on 2026-10-04 (490 schools).
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class Schools(ArcgisAdapter):
    query_fields = (
        "objectid",
        "school_name",
        "school_name_label",
        "street_address",
        "zip_code",
        "grade_level",
        "grade_org",
        "type",
        "type_specific",
    )
    required_columns = ("objectid", "school_name", "type_specific", "geometry")
