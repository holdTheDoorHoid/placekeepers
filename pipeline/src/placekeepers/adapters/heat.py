"""Heat vulnerability by census tract (City ArcGIS `heat_vulnerability_ct`, OpenDataPhilly "Heat
Vulnerability by Census Tract"), from the Department of Public Health and the Office of
Sustainability.

One polygon per 2010 census tract (384) with three scores: heat exposure (`hei_score`: how hot the
tract runs, from satellite land surface temperature and how much of it is paved, built or green),
heat sensitivity (`hsi_score`: who lives there, by age, health and income) and their combination,
heat vulnerability (`hvi_score`). The scores are relative: higher means hotter, more sensitive or
more vulnerable than other tracts; they have no units. The transit comfort lens uses the heat
exposure score at each stop (docs/TRANSIT_METHOD.md). The heat and shade lens (M3.1) uses the heat
vulnerability score of each lot's tract, and the map shades every tract by the three scores
(placekeepers.derive.heat, placekeepers.publish.environment).

Verified against the live service on 2026-10-05 (384 tracts, data of 2017 to 2019 per the layer's
summary, last edited 2025-04-03).
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter


class HeatVulnerability(ArcgisAdapter):
    out_fields = (
        "objectid",
        "geoid10",
        "name10",
        "year",
        "hei_score",
        "hsi_score",
        "hvi_score",
        "n_veryhigh",
    )
    required_columns = ("geoid10", "hei_score", "hvi_score", "geometry")
