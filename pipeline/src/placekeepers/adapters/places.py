"""Land, care and boundary layers: building footprints, land use, City owned property, PHS
LandCare, gardens, Parks and Recreation properties, zoning, council districts, registered community
organizations and neighborhoods.

Footprints and land use are half a million polygons each, so they come from ArcGIS Hub's cached
bulk GeoJSON (one request) instead of about 275 pages from the feature service; the file's
Last-Modified date is kept as `source_date`. Layers that hold personal contact details (the
community organizations' contact people and the registered gardens' email addresses) are fetched
with an explicit field list, so those details are never downloaded. Field names verified against
the live services on 2026-10-04.
"""

from __future__ import annotations

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.url import UrlAdapter


class BuildingFootprints(UrlAdapter):
    """L&I building footprints. `parcel_id_num` links a footprint to its Water Department parcel;
    `bin` is the building id."""

    keep_fields = [
        "objectid",
        "bin",
        "fcode",
        "address",
        "building_name",
        "base_elevation",
        "approx_hgt",
        "max_hgt",
        "parcel_id_num",
        "parcel_id_source",
        "square_ft",
    ]
    add_source_date = True
    required_columns = ("objectid", "bin", "parcel_id_num", "geometry", "source_date")


class LandUse(UrlAdapter):
    """The Planning Commission's land use map: a use code per parcel sized polygon at three levels
    of detail (`c_dig1` to `c_dig3`), the survey year, and a vacant building note."""

    keep_fields = [
        "objectid",
        "c_dig1",
        "c_dig1desc",
        "c_dig2",
        "c_dig2desc",
        "c_dig3",
        "c_dig3desc",
        "year",
        "vacbldg",
    ]
    add_source_date = True
    required_columns = ("c_dig1", "c_dig2", "c_dig3", "year", "geometry", "source_date")


class CityOwnedProperty(ArcgisAdapter):
    """City, Land Bank (PLB), Redevelopment Authority (PRA) and PHDC property, with availability
    and side yard eligibility (LAMAAssets)."""

    required_columns = ("opabrt", "agency", "status_1", "sideyardeligible", "geometry")


class PhsLandcare(ArcgisAdapter):
    """Lots PHS cleans, greens and maintains, with the program and the year each one joined."""

    required_columns = ("brt_id", "program", "year", "geometry")


class GardensPhsNgt(ArcgisAdapter):
    """Gardens and farms supported by PHS, the Neighborhood Gardens Trust, or both (PHS's own
    ArcGIS organization, named by the registry endpoint's url)."""

    out_fields = ("OBJECTID", "Site_Name", "Supported", "Website")
    required_columns = ("objectid", "site_name", "supported", "geometry")


class GardensRegistered(ArcgisAdapter):
    """Community gardens registered with Parks and Recreation. Contact email addresses, opening
    hours and free text comments are not downloaded."""

    out_fields = (
        "objectid",
        "garden_name",
        "park_name",
        "address",
        "zip_code",
        "contact_website",
        "garden_status",
        "ppr_land",
        "council_district",
    )
    required_columns = ("garden_name", "garden_status", "geometry")


class PprProperties(ArcgisAdapter):
    """Parks and Recreation properties: parks, recreation centers and other park land."""

    required_columns = ("official_name", "ppr_use", "geometry")


class ZoningBaseDistricts(ArcgisAdapter):
    """Current zoning base districts (`long_code`, such as RSA-5), with pending changes.

    Pages of 2,000 of these detailed shapes made the service answer with errors on 2026-10-04;
    pages of 1,000 come back in about half a second. ArcGIS Hub's bulk copy was three weeks old,
    and zoning changes often, so the live service is used."""

    page_size = 1000
    required_columns = ("long_code", "zoninggroup", "geometry")


class CouncilDistricts(ArcgisAdapter):
    """The ten City Council districts as drawn in 2024."""

    required_columns = ("district", "geometry")


class CommunityOrganizations(ArcgisAdapter):
    """Registered Community Organizations (Zoning_RCO). Only the organization's name, type,
    website and registration dates are downloaded: the contact people's names, addresses, emails
    and phone numbers are not."""

    out_fields = (
        "objectid",
        "lni_id",
        "organization_name",
        "org_type",
        "websites",
        "expirationyear",
        "effective_date",
    )
    required_columns = ("lni_id", "organization_name", "geometry")


class Neighborhoods(UrlAdapter):
    """Philadelphia neighborhood names and boundaries (Abaca Labs via OpenDataPhilly, CC BY 4.0)."""

    keep_fields = ["NAME", "LISTNAME", "MAPNAME"]
    required_columns = ("name", "listname", "geometry")
