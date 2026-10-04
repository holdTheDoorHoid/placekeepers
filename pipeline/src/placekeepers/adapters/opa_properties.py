"""OPA properties: one row per property in the city (Carto table opa_properties_public).

We keep a chosen set of 35 columns rather than all 80. They feed the lot dossier (address, owner,
mailing address, last sale, value, codes, zoning, exemptions, size, age) and the vacancy model
(category and building codes, with the newer building code pair the City added in 2025):

    parcel_number                      the 9 digit OPA account number, the key for every parcel
    location                           street address
    owner_1, owner_2                   owner names as the City publishes them
    mailing_address_1, mailing_address_2, mailing_care_of, mailing_street, mailing_city_state,
    mailing_zip                        where the owner gets tax bills
    sale_date, sale_price              the most recent recorded sale
    market_value                       the current assessment
    category_code, category_code_description
    building_code, building_code_description
    building_code_new, building_code_description_new
    zoning
    exempt_building, exempt_land, homestead_exemption   exemption amounts in dollars
    total_area                         lot area in square feet
    year_built                         as published (text; a few hundred are not plain years)
    census_tract, zip_code
    lat, lng                           the City's point for the parcel
    exterior_condition, interior_condition, date_exterior_condition
                                       the assessor's condition notes (6 vacant, 7 sealed or open
                                       to the weather), a vacancy signal
    total_livable_area, number_stories, unit
                                       whether a building with living space stands on the parcel

Verified against the live table on 2026-10-04 (583,783 rows, every parcel_number 9 digits).
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAdapter, Column


def _text(name: str) -> Column:
    return Column(name, name, "VARCHAR")


class OpaProperties(CartoAdapter):
    columns = (
        _text("parcel_number"),
        _text("location"),
        _text("owner_1"),
        _text("owner_2"),
        _text("mailing_address_1"),
        _text("mailing_address_2"),
        _text("mailing_care_of"),
        _text("mailing_street"),
        _text("mailing_city_state"),
        _text("mailing_zip"),
        Column("sale_date", "sale_date", "DATE"),
        Column("sale_price", "sale_price", "BIGINT"),
        Column("market_value", "market_value", "BIGINT"),
        _text("category_code"),
        _text("category_code_description"),
        _text("building_code"),
        _text("building_code_description"),
        _text("building_code_new"),
        _text("building_code_description_new"),
        _text("zoning"),
        Column("exempt_building", "exempt_building", "BIGINT"),
        Column("exempt_land", "exempt_land", "BIGINT"),
        Column("homestead_exemption", "homestead_exemption", "BIGINT"),
        Column("total_area", "total_area", "DOUBLE"),
        _text("year_built"),
        _text("census_tract"),
        _text("zip_code"),
        Column("lat", "ST_Y(the_geom)", "DOUBLE"),
        Column("lng", "ST_X(the_geom)", "DOUBLE"),
        _text("exterior_condition"),
        _text("interior_condition"),
        Column("date_exterior_condition", "date_exterior_condition", "DATE"),
        Column("total_livable_area", "total_livable_area", "DOUBLE"),
        Column("number_stories", "number_stories", "DOUBLE"),
        _text("unit"),
    )
    required_columns = (
        "parcel_number",
        "location",
        "owner_1",
        "mailing_street",
        "sale_date",
        "market_value",
        "category_code",
        "building_code",
        "lat",
        "lng",
    )
