"""The Vision Zero High Injury Network, 2025 version (ArcGIS high_injury_network_2025).

162 street lines, each with a street name (`stname`) and a length in feet (`length_ft`). The City
last edited it on 2025-12-10. Verified against the live service on 2026-10-04.
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class HighInjuryNetwork(ArcgisAdapter):
    required_columns = ("objectid", "stname", "length_ft", "geometry")
