"""Bulk files read their own way: the Census Bureau's tables (poverty, tenure, and from M4.7 rent
burden, occupancy, vacancy, income and rent) and Clean & Green Philly's last snapshot of tax debt.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import ClassVar

from placekeepers.adapters.base import FetchError, quote_literal
from placekeepers.adapters.url import UrlAdapter
from placekeepers.cache import RawFetch


def _estimate(column: str) -> str:
    """A Census estimate as a whole number; the Census marks missing values with negative codes."""
    return f"CASE WHEN TRY_CAST({column} AS BIGINT) >= 0 THEN TRY_CAST({column} AS BIGINT) END"


class AcsPoverty(UrlAdapter):
    """Poverty status by census tract from the American Community Survey five year estimates
    (table B17001), from the Census Bureau's table based summary file: one file for the whole
    country, pipe delimited, no key needed. The Census API now refuses requests without a key, so
    the bulk file is used instead; a free key is an owner action if the API is ever wanted.

    `poverty_pct` is the share of people whose income was below the poverty line, the measure the
    Philadelphia greening trial used. Only Philadelphia's tracts are kept.
    """

    tract_prefix = "1400000US42101"
    required_columns = ("geoid", "tract", "population_for_poverty", "below_poverty", "poverty_pct")

    def survey_end_year(self) -> int:
        found = re.search(r"acsdt5y(\d{4})", self.endpoint.url)
        if not found:
            raise FetchError("The link does not name the survey year (acsdt5yYYYY)")
        return int(found.group(1))

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        end = self.survey_end_year()
        con = self.ctx.duckdb()
        try:
            con.execute(
                f"""COPY (
                    SELECT substr(GEO_ID, 10) AS geoid,
                           right(GEO_ID, 6) AS tract,
                           {_estimate("B17001_E001")} AS population_for_poverty,
                           {_estimate("B17001_M001")} AS population_for_poverty_moe,
                           {_estimate("B17001_E002")} AS below_poverty,
                           {_estimate("B17001_M002")} AS below_poverty_moe,
                           round(100.0 * {_estimate("B17001_E002")}
                                 / nullif({_estimate("B17001_E001")}, 0), 1) AS poverty_pct,
                           {end - 4} AS survey_start_year,
                           {end} AS survey_end_year
                    FROM read_csv({quote_literal(str(path))}, delim = '|', header = true,
                                  all_varchar = true)
                    WHERE GEO_ID LIKE '{self.tract_prefix}%'
                    ORDER BY geoid
                ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"""
            )
        finally:
            con.close()


class AcsTenure(AcsPoverty):
    """Who owns and who rents, by census tract, from the American Community Survey five year
    estimates (table B25003, "Tenure"): occupied homes, those lived in by their owners and those
    rented. From the same table based summary file as the poverty table, one file for the whole
    country, no key needed (added 2026-10-05 for the displacement watch, M4.1).

    `renter_pct` is the share of occupied homes that are rented. Only Philadelphia's tracts are
    kept."""

    required_columns = (
        "geoid",
        "tract",
        "occupied",
        "owner_occupied",
        "renter_occupied",
        "renter_pct",
    )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        end = self.survey_end_year()
        con = self.ctx.duckdb()
        try:
            con.execute(
                f"""COPY (
                    SELECT substr(GEO_ID, 10) AS geoid,
                           right(GEO_ID, 6) AS tract,
                           {_estimate("B25003_E001")} AS occupied,
                           {_estimate("B25003_M001")} AS occupied_moe,
                           {_estimate("B25003_E002")} AS owner_occupied,
                           {_estimate("B25003_M002")} AS owner_occupied_moe,
                           {_estimate("B25003_E003")} AS renter_occupied,
                           {_estimate("B25003_M003")} AS renter_occupied_moe,
                           round(100.0 * {_estimate("B25003_E003")}
                                 / nullif({_estimate("B25003_E001")}, 0), 1) AS renter_pct,
                           {end - 4} AS survey_start_year,
                           {end} AS survey_end_year
                    FROM read_csv({quote_literal(str(path))}, delim = '|', header = true,
                                  all_varchar = true)
                    WHERE GEO_ID LIKE '{self.tract_prefix}%'
                    ORDER BY geoid
                ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"""
            )
        finally:
            con.close()


class AcsTable(AcsPoverty):
    """One table of the same table based summary file, by census tract, keeping the named
    estimates and their margins of error (added 2026-10-09 for the neighborhood context on the
    displacement watch, M4.7). Each `fields` entry names an output column and the Census line it
    comes from: `<name>` holds the estimate (`_E`) and `<name>_moe` its margin of error (`_M`), at
    the Census Bureau's 90 percent confidence. A negative code (the Census's mark for "could not
    be computed", for example a median of too few homes) becomes null, so a missing number is never
    shown as a number. Philadelphia's tracts are kept, as for the poverty table, and one row for
    the whole city (the county, `geoid` "42101" with no `tract`): a city's median cannot be added
    up from its tracts, so the card compares each tract with the Census's own figure for the
    city."""

    #: the county row of the summary file: Philadelphia County, the same as the city
    county = "0500000US42101"

    #: the Census table, as it is named in the file's columns (such as "B25070")
    table: ClassVar[str] = ""
    #: output name -> line number of the table, such as {"renter_households": "001"}
    fields: ClassVar[dict[str, str]] = {}

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        end = self.survey_end_year()
        selects = []
        for name, line in self.fields.items():
            selects.append(f"{_estimate(f'{self.table}_E{line}')} AS {name}")
            selects.append(f"{_estimate(f'{self.table}_M{line}')} AS {name}_moe")
        con = self.ctx.duckdb()
        try:
            header = con.execute(
                f"SELECT * FROM read_csv({quote_literal(str(path))}, delim = '|', header = true, "
                "all_varchar = true) LIMIT 0"
            ).description
            known = {column[0] for column in header}
            wanted = {f"{self.table}_{k}{line}" for line in self.fields.values() for k in "EM"}
            missing = sorted(wanted - known)
            if missing:
                raise FetchError(f"The table has no {', '.join(missing)} column")
            con.execute(
                f"""COPY (
                    SELECT substr(GEO_ID, 10) AS geoid,
                           CASE WHEN GEO_ID LIKE '{self.tract_prefix}%'
                                THEN right(GEO_ID, 6) END AS tract,
                           {", ".join(selects)},
                           {end - 4} AS survey_start_year,
                           {end} AS survey_end_year
                    FROM read_csv({quote_literal(str(path))}, delim = '|', header = true,
                                  all_varchar = true)
                    WHERE GEO_ID LIKE '{self.tract_prefix}%' OR GEO_ID = '{self.county}'
                    ORDER BY geoid
                ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"""
            )
        finally:
            con.close()


class AcsRentBurden(AcsTable):
    """Gross rent as a share of household income (table B25070): renter households, those whose
    share could not be computed (no cash rent or no income), and those paying 30 to 35, 35 to 40,
    40 to 50 and 50 percent or more of their income on rent and utilities."""

    table = "B25070"
    fields = {
        "renter_households": "001",
        "rent_30_35": "007",
        "rent_35_40": "008",
        "rent_40_50": "009",
        "rent_50_plus": "010",
        "not_computed": "011",
    }
    required_columns = (
        "geoid",
        "tract",
        "renter_households",
        "renter_households_moe",
        "rent_50_plus",
        "rent_50_plus_moe",
        "not_computed",
        "not_computed_moe",
    )


class AcsOccupancy(AcsTable):
    """Homes lived in and homes empty (table B25002, occupancy status)."""

    table = "B25002"
    fields = {"homes": "001", "occupied": "002", "vacant": "003"}
    required_columns = ("geoid", "tract", "homes", "occupied", "vacant", "vacant_moe")


class AcsVacancy(AcsTable):
    """Why homes are empty (table B25004, vacancy status): for rent, rented and not yet moved
    into, for sale, sold and not yet moved into, for seasonal or occasional use, for migrant
    workers, and the Census's "other vacant" (homes held off the market: waiting for repairs, in
    a family's legal limbo, abandoned, and so on)."""

    table = "B25004"
    fields = {
        "vacant": "001",
        "for_rent": "002",
        "rented_not_occupied": "003",
        "for_sale": "004",
        "sold_not_occupied": "005",
        "seasonal": "006",
        "migrant_workers": "007",
        "other_vacant": "008",
    }
    required_columns = ("geoid", "tract", "vacant", "for_rent", "for_sale", "other_vacant")


class AcsIncome(AcsTable):
    """Median household income in the last 12 months, in dollars of the survey's last year
    (table B19013)."""

    table = "B19013"
    fields = {"median_income": "001"}
    required_columns = ("geoid", "tract", "median_income", "median_income_moe")


class AcsRent(AcsTable):
    """Median gross rent, contract rent plus utilities the renter pays, in dollars a month
    (table B25064)."""

    table = "B25064"
    fields = {"median_rent": "001"}
    required_columns = ("geoid", "tract", "median_rent", "median_rent_moe")


class CagpTax2025(UrlAdapter):
    """Tax debt as of 2025-07-09, from Clean & Green Philly's final snapshot (MIT license).

    The City no longer publishes tax debt per parcel, so this frozen copy is the only parcel level
    record; every use must show its date. From the 98 MB file we keep only the OPA account and the
    tax fields; the full download is deleted once the snapshot is made.
    """

    snapshot_date = date(2025, 7, 9)
    tax_columns = (
        "total_due",
        "num_years_owed",
        "most_recent_year_owed",
        "payment_agreement",
        "is_actionable",
        "sheriff_sale",
        "total_assessment",
    )
    required_columns = ("opa_id", *tax_columns, "snapshot_date")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        con = self.ctx.duckdb()
        try:
            source = f"read_parquet({quote_literal(str(path))})"
            columns = {row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()}
            missing = [name for name in ("opa_id", *self.tax_columns) if name not in columns]
            if missing:
                raise FetchError(f"The snapshot has no {', '.join(missing)} column")
            con.execute(
                f"""COPY (
                    SELECT lpad(trim(CAST(opa_id AS VARCHAR)), 9, '0') AS opa_id,
                           {", ".join(self.tax_columns)},
                           DATE '{self.snapshot_date.isoformat()}' AS snapshot_date
                    FROM {source}
                    WHERE opa_id IS NOT NULL
                    ORDER BY opa_id
                ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"""
            )
        finally:
            con.close()


class CagpVacancyList2024(UrlAdapter):
    """One of Clean & Green Philly's frozen June 2024 vacancy lists (issue #38): the vacant land
    list L&I sent the project on 2024-06-24, the last fairly complete one before the City's own
    list broke, or the project's own list of vacant buildings from the same day, which its README
    says misses about a thousand or more buildings.

    The lot timeline needs only which parcels were on the list and the list's date, so the
    snapshot keeps the OPA account (nine digits) and that date: never the owner names, the address
    or the shape the files also hold."""

    list_date = date(2024, 6, 24)
    required_columns = ("opa_id", "list_date")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        con = self.ctx.duckdb()
        try:
            source = f"read_parquet({quote_literal(str(path))})"
            columns = {row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()}
            if "opa_id" not in columns:
                raise FetchError("The list has no opa_id column")
            digits = "regexp_extract(trim(CAST(opa_id AS VARCHAR)), '^[0-9]{8,9}$')"
            con.execute(
                f"""COPY (
                    SELECT DISTINCT lpad({digits}, 9, '0') AS opa_id,
                           DATE '{self.list_date.isoformat()}' AS list_date
                    FROM {source}
                    WHERE {digits} <> ''
                    ORDER BY opa_id
                ) TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"""
            )
        finally:
            con.close()
