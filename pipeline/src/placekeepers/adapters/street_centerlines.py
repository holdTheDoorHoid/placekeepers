"""Street centerlines (City ArcGIS Street_Centerline, the OpenDataPhilly "Street Centerlines").

One line per street segment, usually a block between two intersections, kept by the Streets
Department. We keep what the street safety lens needs:

    seg_id          the City's unique segment id (stable; used as the segment id on the map)
    stname          the street name, such as "N BROAD ST"
    class           the street class: 1 expressway, 2 major arterial, 3 minor arterial,
                    4 collector, 5 local, 6 driveway, 9 low speed ramp, 10 high speed ramp,
                    12 not travelable, 14 City boundary, 15 walking connector
    responsibl      who maintains it, such as CITY or STATE
    oneway, length  travel direction code and length in feet
    fnode_, tnode_  the nodes at each end

Verified against the live service on 2026-10-04 (41,252 segments).
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class StreetCenterlines(ArcgisAdapter):
    query_fields = (
        "objectid",
        "seg_id",
        "stname",
        "class",
        "responsibl",
        "oneway",
        "length",
        "fnode_",
        "tnode_",
    )
    required_columns = ("seg_id", "stname", "class", "geometry")
