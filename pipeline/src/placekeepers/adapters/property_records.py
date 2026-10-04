"""Property records fetched for the vacancy candidate parcels: real estate transfers and the
assessment history (Carto tables rtt_summary and assessments).

Both are too large to download whole every week (5.2 and 7.5 million rows), so they come down for
the candidate parcels only (see placekeepers.candidates). The lot dossier can look up any other
parcel live from the City's Carto API. Field names verified against the live tables on 2026-10-04.
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAccountsAdapter, Column


class RealEstateTransfers(CartoAccountsAdapter):
    """Every recorded deed, sheriff deed, mortgage and other document for the candidate parcels:
    who granted it to whom, when, and for how much. `property_count` above 1 means one price
    covered several properties.

    `display_date` (the date on the deed, or the recording date when the deed has none, as a day
    in Philadelphia) and `adjusted_total_consideration` (this property's share of the price) are
    what the City's property page shows; the lot dossier shows them too."""

    account_column = "opa_account_num"
    columns = (
        Column("document_id", "document_id", "BIGINT"),
        Column("document_type", "document_type"),
        Column("recording_date", "recording_date", "DATE"),
        Column("document_date", "document_date", "DATE"),
        Column("display_date", "display_date", "LOCAL_DATE"),
        Column("opa_account_num", "opa_account_num"),
        Column("street_address", "street_address"),
        Column("grantors", "grantors"),
        Column("grantees", "grantees"),
        Column("cash_consideration", "cash_consideration", "DOUBLE"),
        Column("total_consideration", "total_consideration", "DOUBLE"),
        Column("adjusted_total_consideration", "adjusted_total_consideration", "DOUBLE"),
        Column("property_count", "property_count", "INTEGER"),
    )
    required_columns = (
        "document_id",
        "document_type",
        "recording_date",
        "opa_account_num",
        "grantors",
        "grantees",
        "total_consideration",
    )


class AssessmentHistory(CartoAccountsAdapter):
    """The City's assessed value of each candidate parcel for every year since 2015."""

    account_column = "parcel_number"
    columns = (
        Column("parcel_number", "parcel_number"),
        Column("year", "year", "INTEGER"),
        Column("market_value", "market_value", "BIGINT"),
        Column("taxable_land", "taxable_land", "BIGINT"),
        Column("taxable_building", "taxable_building", "BIGINT"),
        Column("exempt_land", "exempt_land", "BIGINT"),
        Column("exempt_building", "exempt_building", "BIGINT"),
    )
    required_columns = ("parcel_number", "year", "market_value")
