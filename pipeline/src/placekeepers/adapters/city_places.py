"""Public places from the City (M3.5): Free Library branches, Parks and Recreation centers, pools,
spraygrounds and park drinking fountains, from the City's ArcGIS Online services.

Each is a small point layer the City keeps current, fetched with an explicit field list so only
what the map shows is downloaded (no free text comments, no staff or police districts). Field
names and counts verified against the live services on 2026-10-05:

* `library_locations`: "Active Free Library of Philadelphia Locations", 54 points, last edited
  2026-07-22. Not listed on OpenDataPhilly; the City publishes it in its ArcGIS Online
  organization and its metadata catalog (metadata.phila.gov). The Free Library's own website
  refuses automated requests, so it is never read; the map only links to each branch's page.
* `PPR_Program_Sites`: where Parks and Recreation runs programs, 168 points, last edited
  2026-06-05: 157 recreation centers and playgrounds with programs, 6 older adult centers, 3
  environmental education centers and 2 pools (OpenDataPhilly "Parks & Recreation Program Sites").
* `PPR_Swimming_Pools`: 72 pools, 64 in service (`pool_status` ACTIVE), last edited 2026-08-07.
* `PPR_Spraygrounds`: 114 spraygrounds and sprinklers, 104 in service, last edited 2026-08-04.
* `PPR_Hydration_Stations`: 147 drinking fountains and bottle filling stations at parks and
  recreation centers, last edited 2026-09-29.

All are under the City's open data terms (registry license `city_terms`).
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class LibraryLocations(ArcgisAdapter):
    """The Free Library's branches and Parkway Central: name, address, phone and web page."""

    out_fields = ("objectid", "building", "address", "zip_code", "phone_number", "library_url")
    required_columns = ("objectid", "building", "address", "geometry")


class PprProgramSites(ArcgisAdapter):
    """Recreation centers, older adult centers and environmental education centers."""

    out_fields = ("objectid", "park_name", "program_type", "site_class", "building", "gym")
    required_columns = ("objectid", "park_name", "program_type", "geometry")


class PprSwimmingPools(ArcgisAdapter):
    """Pools: name, address, indoor or outdoor, whether in service, this season's opening day and
    access for people with disabilities."""

    out_fields = (
        "objectid",
        "pool_name",
        "park_name",
        "address_911",
        "zip_code",
        "pool_type",
        "pool_status",
        "pool_open_date",
        "ada_access",
        "ada_lift",
    )
    required_columns = ("objectid", "pool_name", "pool_status", "geometry")


class PprSpraygrounds(ArcgisAdapter):
    """Spraygrounds and sprinklers, and whether each is in service."""

    out_fields = ("objectid", "park_name", "spray_type", "spray_status")
    required_columns = ("objectid", "park_name", "spray_status", "geometry")


class PprHydrationStations(ArcgisAdapter):
    """Drinking fountains and bottle filling stations at parks and recreation centers."""

    out_fields = ("objectid", "amenity_name", "park_name", "station_type", "location")
    required_columns = ("objectid", "park_name", "station_type", "geometry")
