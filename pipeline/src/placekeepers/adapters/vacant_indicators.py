"""The City's Vacant Property Indicators, for land and for buildings (ArcGIS).

Each feature is a parcel polygon with its OPA account number (`opa_id`), the City's rank
(`land_rank` or `build_rank`, 0 to 1), the date the City recalculated it (`date_update`), and the
address, owner names, building description, council district, zoning and ZIP code.

The City recalculated both layers on 2026-09-27 (28,771 lots and 9,519 buildings). Verified against
the live services on 2026-10-04.
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class VacantIndicatorsLand(ArcgisAdapter):
    required_columns = ("objectid", "opa_id", "land_rank", "date_update", "geometry")


class VacantIndicatorsBldg(ArcgisAdapter):
    required_columns = ("objectid", "opa_id", "build_rank", "date_update", "geometry")
