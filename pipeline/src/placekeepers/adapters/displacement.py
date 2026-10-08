"""Sources of the displacement watch (milestone M4.1): home sales and assessed values for the whole
city, and the City's Market Value Analysis. The Census Bureau's renter share comes with the other
bulk Census table (`acs_tenure`, in placekeepers.adapters.bulk_files).

* `real_estate_sales` (Carto `rtt_summary`): every deed with a price over $100 recorded in the
  last nine years, for the whole city. The candidate parcels' transfers (`real_estate_transfers`)
  are mostly vacant lots and sheriff sales, so they say nothing about what homes sell for; this is
  the citywide view. **No names are kept**: the buyers' names on each deed are read only to tell a
  company from a person (placekeepers.derive.owners.type_from_name, the rule the lot pages use for
  owners), and the snapshot holds that type, never the names. The download itself is deleted once
  checked.
* `assessment_values` (Carto `assessments`): the City's market value of every parcel in two tax
  years: the newest year the City has published for nearly every parcel, and the year five before
  it, the span the City's Longtime Owner Occupants Program looks at. The years are found when the
  download starts, so the source needs no yearly edit.
* `market_value_analysis` (City ArcGIS): Reinvestment Fund's Market Value Analysis for the City,
  one row per census block group, keeping its market type and its reading of displacement
  pressure. The 2023 and 2026 editions name their fields differently; both are read (see
  `MarketValueAnalysis`).

Verified against the live tables on 2026-10-05: 339,793 deeds with a price over $100 since
2016 (486,202 plain deeds of any price since 2014); the assessments table holds 2015 to 2027 with
about 575,000 parcels a year (and a few dozen stray rows for 2013 and 2014); the 2026 Market Value
Analysis has 1,338 block groups and the 2023 one 1,342.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, ClassVar

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.adapters.carto import CartoAdapter, Column, _check_carto_json
from placekeepers.cache import RawFetch
from placekeepers.derive.owners import type_from_name
from placekeepers.derive.transfers import split_names
from placekeepers.geo import wkb_types, write_geoparquet

log = logging.getLogger(__name__)


def buyer_type(grantees: str | None) -> str:
    """The owner type of a deed's buyers, from their names together (`individual`, `company`,
    `nonprofit`, a public body's type, or `unknown`), as the lot pages type owners."""
    return type_from_name(split_names(grantees)).type


class RealEstateSales(CartoAdapter):
    """Priced deeds for the whole city, with the buyers typed and their names dropped."""

    columns = (
        Column("document_id", "document_id", "BIGINT"),
        Column("document_type", "document_type"),
        Column("display_date", "display_date", "LOCAL_DATE"),
        Column("opa_account_num", "opa_account_num"),
        Column("grantees", "grantees"),
        Column("total_consideration", "total_consideration", "DOUBLE"),
        Column("adjusted_total_consideration", "adjusted_total_consideration", "DOUBLE"),
        Column("property_count", "property_count", "INTEGER"),
    )
    #: Read to type the buyers, then dropped: the snapshot never holds them (tests check it).
    dropped: ClassVar[tuple[str, ...]] = ("grantees",)
    #: Never downloaded at all: the sellers' names, and the rest of the record we do not need.
    never_fetch: ClassVar[tuple[str, ...]] = ("grantors", "street_address", "legal_remarks")
    required_columns = (
        "document_id",
        "document_type",
        "display_date",
        "opa_account_num",
        "buyer_type",
        "total_consideration",
        "adjusted_total_consideration",
        "property_count",
    )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        named = out.with_name(f"{out.name}.names")
        try:
            super().normalize(raw, named)
            table = pq.read_table(named)
        finally:
            named.unlink(missing_ok=True)
        types: dict[str | None, str] = {}
        buyers = []
        for names in table.column("grantees").to_pylist():
            if names not in types:
                types[names] = buyer_type(names)
            buyers.append(types[names])
        table = table.drop_columns(list(self.dropped))
        table = table.append_column("buyer_type", pa.array(buyers, pa.string()))
        counts = pc.value_counts(table.column("buyer_type")).to_pylist()
        log.info(
            "%s: buyers typed: %s",
            self.id,
            ", ".join(f"{c['values']} {c['counts']:,}" for c in sorted(counts, key=str)),
        )
        pq.write_table(table, out, compression="zstd", row_group_size=100_000)


class AssessmentValues(CartoAdapter):
    """The City's market value of every parcel in two tax years: the newest one and the one five
    years before it (`YEARS_APART`). A year counts as published once it holds at least
    `MIN_PARCELS` parcels, so a few stray rows of a year (2013 and 2014 have a few dozen) never
    decide it."""

    YEARS_APART: ClassVar[int] = 5
    MIN_PARCELS: ClassVar[int] = 400_000

    columns = (
        Column("parcel_number", "parcel_number"),
        Column("year", "year", "INTEGER"),
        Column("market_value", "market_value", "BIGINT"),
    )
    required_columns = ("parcel_number", "year", "market_value")
    years: tuple[int, int] | None = None

    def years_query(self) -> str:
        return (
            f"SELECT year::int AS year, count(*) AS n FROM {self.endpoint.table} "
            "GROUP BY 1 ORDER BY 1"
        )

    def choose_years(self, counts: dict[int, int]) -> tuple[int, int]:
        published = [year for year, n in counts.items() if n >= self.MIN_PARCELS]
        if not published:
            raise FetchError("The assessments table has no year with values for most parcels")
        newest = max(published)
        base = newest - self.YEARS_APART
        if base not in published:
            raise FetchError(
                f"The assessments table has {newest} but not {base}, five years before it"
            )
        return base, newest

    def _filters(self, after: int | None = None) -> str:
        if self.years is None:
            data = self.ctx.http.get_json(
                self.api_url, {"q": self.years_query()}, check=_check_carto_json
            )
            counts = {int(row["year"]): int(row["n"]) for row in data["rows"]}
            self.years = self.choose_years(counts)
            log.info("%s: tax years %d and %d", self.id, *self.years)
        base, newest = self.years
        chosen = f"year::text IN ('{base}', '{newest}')"
        where = f" AND ({self.endpoint.where})" if self.endpoint.where else ""
        keyset = f" AND {self.key} > {int(after)}" if after is not None else ""
        return f" WHERE {chosen}{where}{keyset}"

    def fetch(self, dest: Path) -> dict[str, Any]:
        info = super().fetch(dest)
        assert self.years is not None
        info["years"] = list(self.years)
        return info


#: How each edition of the Market Value Analysis names what we keep. The 2026 edition calls its
#: market type `mva_clusterletter` and sorts block groups by displacement pressure in
#: `mvaxdrr_priority_areas`; the 2023 edition calls them `clusterletter` and `mvadrr` (its market
#: strength and the change in its displacement risk ratio, such as "Middle-High").
MVA_FIELDS = {
    "cluster": ("mva_clusterletter", "clusterletter"),
    "pressure_label": ("mvaxdrr_priority_areas", "mvadrr"),
    "households": ("chh",),
}


def mva_pressure(label: str | None) -> str | None:
    """The Market Value Analysis's reading of displacement pressure in a block group: `rising`,
    `steady`, `falling`, `strong` (a strong market, where the 2026 edition does not sort
    pressure), or None when it gives none.

    2026: "Rising Pressure Middle & Vulnerable Markets", "Steady Pressure ...", "Falling Pressure
    ...", "Strong Markets". 2023: a market strength and a change in the displacement risk ratio
    from 2018 and 2019 to 2021 and 2022, "Strong-High", "Middle-Stable", "Weak-Lagging" and so on:
    High is rising pressure, Stable steady, Lagging falling."""
    text = " ".join((label or "").split()).upper()
    if not text:
        return None
    if text.startswith("RISING PRESSURE") or text.endswith("-HIGH"):
        return "rising"
    if text.startswith("STEADY PRESSURE") or text.endswith("-STABLE"):
        return "steady"
    if text.startswith("FALLING PRESSURE") or text.endswith("-LAGGING"):
        return "falling"
    if text.startswith("STRONG MARKET"):
        return "strong"
    return None


class MarketValueAnalysis(ArcgisAdapter):
    """Reinvestment Fund's Market Value Analysis for the City of Philadelphia, by census block
    group (`geoid`, 12 digits, whose first 11 are its census tract). The snapshot keeps the
    block group, its market type (A+ or A, the strongest markets, to I), Reinvestment Fund's
    reading of displacement pressure as published (`pressure_label`) and in one word
    (`pressure`, see `mva_pressure`), its households where the edition gives them, and the
    shape. The layer holds no personal data; only these fields are kept."""

    query_params: ClassVar[dict[str, str]] = {"geometryPrecision": "6"}
    required_columns = ("geoid", "cluster", "pressure_label", "pressure", "geometry")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        wide = out.with_name(f"{out.name}.wide")
        try:
            super().normalize(raw, wide)
            table = pq.read_table(wide)
        finally:
            wide.unlink(missing_ok=True)
        names = set(table.column_names)
        if "geoid" not in names:
            raise FetchError("The Market Value Analysis has no geoid field")
        columns: dict[str, pa.Array] = {
            "geoid": pc.utf8_trim_whitespace(table.column("geoid").cast(pa.string()))
        }
        for name, choices in MVA_FIELDS.items():
            found = next((choice for choice in choices if choice in names), None)
            if found is None and name != "households":
                raise FetchError(
                    f"The Market Value Analysis has none of the fields {', '.join(choices)}"
                )
            if found is None:
                columns[name] = pa.nulls(table.num_rows, pa.int64())
            elif name == "households":
                columns[name] = table.column(found).cast(pa.int64())
            else:
                values = [
                    " ".join(str(v).split()) or None if v is not None else None
                    for v in table.column(found).to_pylist()
                ]
                columns[name] = pa.array(values, pa.string())
        columns["pressure"] = pa.array(
            [mva_pressure(label) for label in columns["pressure_label"].to_pylist()], pa.string()
        )
        columns["geometry"] = table.column("geometry")
        kept = pa.table(columns)
        unread = [
            label
            for label, word in zip(
                columns["pressure_label"].to_pylist(), columns["pressure"].to_pylist(), strict=True
            )
            if label and word is None
        ]
        if unread:
            note = (
                f"{len(unread)} block groups have a pressure label we do not read: "
                f"{', '.join(sorted(set(unread))[:5])}"
            )
            log.warning("%s: %s", self.id, note)
            self.notes.append(note)
        write_geoparquet(kept, out, sorted(wkb_types(kept.column("geometry"))))
