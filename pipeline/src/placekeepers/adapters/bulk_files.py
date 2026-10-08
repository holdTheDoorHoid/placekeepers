"""Bulk files read their own way: the Census Bureau's poverty and tenure tables and Clean & Green
Philly's last snapshot of tax debt.
"""

from __future__ import annotations

import re
from datetime import date
from pathlib import Path

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
