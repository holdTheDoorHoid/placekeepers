"""Adapters, one per source. A source without an adapter reports the status `missing`."""

from __future__ import annotations

from placekeepers.adapters import li, places
from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import Adapter, AdapterMismatch, FetchError, Validation
from placekeepers.adapters.bulk_files import AcsPoverty, CagpTax2025
from placekeepers.adapters.carto import CartoAccountsAdapter, CartoAdapter, Column
from placekeepers.adapters.city_places import (
    LibraryLocations,
    PprHydrationStations,
    PprProgramSites,
    PprSpraygrounds,
    PprSwimmingPools,
)
from placekeepers.adapters.crashes import Crashes20072017, Crashes20162020, Crashes20202024
from placekeepers.adapters.curated import MemorialNames
from placekeepers.adapters.environment import FemaFloodplain, StreetTrees
from placekeepers.adapters.fatal_crashes import FatalCrashes
from placekeepers.adapters.heat import HeatVulnerability
from placekeepers.adapters.high_injury_network import HighInjuryNetwork
from placekeepers.adapters.lens_context import CensusTracts2020, TreeCanopy2018
from placekeepers.adapters.opa_properties import OpaProperties
from placekeepers.adapters.osm import OsmExtract
from placekeepers.adapters.philly311 import Philly311Conditions
from placekeepers.adapters.property_records import AssessmentHistory, RealEstateTransfers
from placekeepers.adapters.pwd_parcels import PwdParcels
from placekeepers.adapters.schools import Schools
from placekeepers.adapters.septa import SeptaGtfs, SeptaRidershipBus, SeptaRidershipTrolley
from placekeepers.adapters.shootings import Shootings
from placekeepers.adapters.street_centerlines import StreetCenterlines
from placekeepers.adapters.url import UrlAdapter
from placekeepers.adapters.vacant_indicators import VacantIndicatorsBldg, VacantIndicatorsLand
from placekeepers.adapters.walk import (
    CensusBlocks2020,
    DvrpcLts,
    EpaWalkability,
    SnapRetailers,
)
from placekeepers.context import Context
from placekeepers.registry import Source

ADAPTERS: dict[str, type[Adapter]] = {
    # M0.2
    "opa_properties": OpaProperties,
    "pwd_parcels": PwdParcels,
    "vacant_indicators_land": VacantIndicatorsLand,
    "vacant_indicators_bldg": VacantIndicatorsBldg,
    "shootings": Shootings,
    "high_injury_network": HighInjuryNetwork,
    # M1.1 property records, for the vacancy candidate parcels
    "real_estate_transfers": RealEstateTransfers,
    "assessment_history": AssessmentHistory,
    # M1.1 Licenses and Inspections
    "li_violations": li.LiViolations,
    "li_complaints": li.LiComplaints,
    "li_permits": li.LiPermits,
    "li_unsafe": li.LiUnsafe,
    "li_imminently_dangerous": li.LiImminentlyDangerous,
    "li_clean_and_seal": li.LiCleanAndSeal,
    "li_demolitions": li.LiDemolitions,
    # M1.1 land, care and boundaries
    "building_footprints": places.BuildingFootprints,
    "land_use": places.LandUse,
    "city_owned_property": places.CityOwnedProperty,
    "phs_landcare": places.PhsLandcare,
    "gardens_phs_ngt": places.GardensPhsNgt,
    "gardens_registered": places.GardensRegistered,
    "ppr_properties": places.PprProperties,
    "zoning_base_districts": places.ZoningBaseDistricts,
    "council_districts": places.CouncilDistricts,
    "community_organizations": places.CommunityOrganizations,
    "neighborhoods": places.Neighborhoods,
    # M1.1 context
    "acs_poverty": AcsPoverty,
    "cagp_tax_2025": CagpTax2025,
    # Street safety and memorials (M1.5)
    "crashes_2020_2024": Crashes20202024,
    "crashes_2016_2020": Crashes20162020,
    "crashes_2007_2017": Crashes20072017,
    "fatal_crashes": FatalCrashes,
    "schools": Schools,
    "street_centerlines": StreetCenterlines,
    "memorial_names": MemorialNames,
    # The violence reduction lens (M1.4)
    "census_tracts_2020": CensusTracts2020,
    "tree_canopy_2018": TreeCanopy2018,
    # The heat and shade lens (M3.1); heat_vulnerability, below, is shared with M2.3
    "street_trees": StreetTrees,
    "fema_floodplain": FemaFloodplain,
    # SEPTA schedules and ridership (M2.1)
    "septa_gtfs": SeptaGtfs,
    "septa_ridership_bus": SeptaRidershipBus,
    "septa_ridership_trolley": SeptaRidershipTrolley,
    # Shelters and benches from OpenStreetMap (M2.2)
    "osm_philadelphia": OsmExtract,
    # Heat at bus stops, for the transit comfort lens (M2.3)
    "heat_vulnerability": HeatVulnerability,
    # Public places from the City and conditions reported to 311 (M3.5)
    "library_locations": LibraryLocations,
    "ppr_program_sites": PprProgramSites,
    "ppr_swimming_pools": PprSwimmingPools,
    "ppr_spraygrounds": PprSpraygrounds,
    "ppr_hydration_stations": PprHydrationStations,
    "philly311_conditions": Philly311Conditions,
    # Walkability and people (M3.3)
    "epa_walkability": EpaWalkability,
    "census_blocks_2020": CensusBlocks2020,
    "dvrpc_lts": DvrpcLts,
    "snap_retailers": SnapRetailers,
}


def adapter_for(source: Source, ctx: Context) -> Adapter | None:
    cls = ADAPTERS.get(source.id)
    return cls(source, ctx) if cls else None


__all__ = [
    "ADAPTERS",
    "Adapter",
    "AdapterMismatch",
    "ArcgisAdapter",
    "CartoAccountsAdapter",
    "CartoAdapter",
    "Column",
    "FetchError",
    "UrlAdapter",
    "Validation",
    "adapter_for",
]
