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

Added 2026-10-09 by M4.7 (issue #43), checked against the live services that day:

* `Warming_Cooling_Sites_PUBLICVIEW`: the Office of Emergency Management's warming and cooling
  sites, 87 points last edited 2026-10-07: 32 Parks and Recreation sites, 28 libraries, 16
  community partners and 11 Philadelphia Housing Authority community centers, each with its name,
  address, hours, whether it is a warming site, a cooling site or both, whether it is open, and
  sometimes its capacity, services, access for people with disabilities, water and restrooms. The
  item is a public "view" copy the City made on 2026-07-01 and states no license; the owner
  decided on 2026-10-09 to show it with no credit line on the map and without asking the Office of
  Emergency Management (docs/DATA_SOURCES.md). The layer's last edit day is kept as
  `source_date`, so a list no one has edited for over a year turns the source stale.
* `PPR_Playgrounds`: Parks and Recreation's 462 playgrounds, last edited 2026-08-21, with the park
  name, the ages each is meant for and the day it was installed. The older
  `PPR_Playground_Equipment` (2016) is not used.
"""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.cache import RawFetch
from placekeepers.config import local_date


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


class WarmingCoolingSites(ArcgisAdapter):
    """The Office of Emergency Management's warming and cooling sites (module docstring), with
    the day the City last edited the list as `source_date`."""

    out_fields = (
        "OBJECTID",
        "site_name",
        "site_type",
        "site_address",
        "site_hours",
        "warming_site",
        "cooling_site",
        "site_status",
        "capacity",
        "services_offered",
        "handicap_accessible",
        "water_station",
        "facilities_include",
    )
    required_columns = (
        "objectid",
        "site_name",
        "site_type",
        "site_status",
        "warming_site",
        "cooling_site",
        "source_date",
        "geometry",
    )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        edited = raw.info.get("data_last_edit")
        if edited is None:
            raise FetchError("The layer does not say when its data was last edited")
        day = local_date(datetime.fromtimestamp(edited / 1000, UTC))
        table = pq.read_table(out)
        metadata = (pq.read_schema(out).metadata or {}).get(b"geo")
        table = table.append_column(
            "source_date", pa.array([day] * table.num_rows, pa.date32())
        ).replace_schema_metadata({b"geo": metadata} if metadata else None)
        pq.write_table(table, out, compression="zstd")


class PprPlaygrounds(ArcgisAdapter):
    """Parks and Recreation's playgrounds: the park, the ages it is meant for and the day it was
    installed. Not the free text comments or the data source note."""

    out_fields = ("objectid", "park_name", "age_range", "date_installed")
    required_columns = ("objectid", "park_name", "geometry")
