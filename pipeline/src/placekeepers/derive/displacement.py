"""The displacement watch (milestone M4.1; docs/DESIGN.md section 5.3, docs/ETHICS.md,
"Displacement"): areas with signs that prices are rising, so greening there can be paired with
protections for the neighbors who live there now. It is a caution, never a priority lens: it
changes no score and no order, and it ranks no neighborhood.

The areas are the City's 2020 census tracts (`census_tracts_2020`, 408): the renter share is only
published by tract, a tract holds enough home sales for a middle price to mean something (most
have well over 100 in three years), and its boundary follows the City's standard one that the
parcels follow. Five signs are measured for each tract:

1. **Sale prices** (`real_estate_sales`): the middle (median) price of the homes sold in the last
   three years up to the newest recorded sale, against the three years that ended five years
   before. A sale counts when it is a deed for more than a token price that is not a sheriff,
   condemnation or adverse possession deed (the lot pages' rule, placekeepers.derive.transfers),
   not a Land Bank deed (a public sale at a set price), for one property (a price shared over
   several is an allocation), of a home: a single family or small multi family house as OPA lists
   it today, built in or before the year of the sale (an earlier sale was of the land or the
   house before). The price is the adjusted total, this property's share, as the lot pages show
   it. The sign holds when the tract's middle price rose at least `PRICE_POINTS` percentage points
   more than the city's, with at least `MIN_SALES` sales in each period.
2. **Company buyers** (the same sales in the last three years): the share whose buyers' names
   are a company's (placekeepers.derive.owners). The sign holds at least `COMPANY_POINTS` points
   above the city's share, with at least `MIN_SALES` sales.
3. **Assessed values** (`assessment_values`): the middle change in the City's market value of the
   tract's homes from the earlier tax year to the newest (five years apart, the span the City's
   Longtime Owner Occupants Program looks at), each home against itself: homes standing at least
   two years before the earlier year, valued at $10,000 or more then. The sign holds at least
   `ASSESSMENT_POINTS` points above the city's middle change, with at least `MIN_ASSESSED` homes.
4. **Renters** (`acs_tenure`): the share of occupied homes that are rented (American Community
   Survey five year estimates). The sign holds at `RENTER_PCT` percent or more, with at least
   `MIN_OCCUPIED` occupied homes. Renters feel rising prices first, through the rent.
5. **The City's Market Value Analysis** (`market_value_analysis`, Reinvestment Fund for the City):
   at least one of the tract's block groups is one where Reinvestment Fund found rising
   displacement pressure: home prices climbing out of reach of what longtime residents earn
   (placekeepers.adapters.displacement.mva_pressure).
6. **Rent burden** (`acs_rent_burden`; added by the owner on 2026-10-09): the share of renter
   households paying half their income or more on rent and utilities, among those whose share
   could be computed (American Community Survey five year estimates,
   placekeepers.derive.tract_context.rent_burden). The sign holds at least `RENT_BURDEN_POINTS`
   points above the city's share, with at least `MIN_RENTERS` such households. Like renters and
   company buyers it says who is exposed to rising prices, not that prices are rising.

**The rule**: a tract is a displacement watch area when at least two signs hold and at least one
of them is about prices rising (sale prices, assessed values, or the Market Value Analysis).
Company buyers, renters and rent burden say who is exposed, not that prices are rising, so
together they are not enough. Thresholds are measured against the whole city, so the watch
follows the city's own market rather than a fixed price.

Where a measure has too few sales, homes or households, it is left out (null) and its sign cannot
hold; the other signs still count.
"""

from __future__ import annotations

import logging
import statistics
import time
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.cache import atomic_output, atomic_write_json
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.lenses import current_snapshot, load_tracts, tracts_of
from placekeepers.derive.tract_context import rent_burden
from placekeepers.derive.transfers import NOMINAL_MAX, NOT_SALES, SHERIFF_TYPES, is_deed

log = logging.getLogger(__name__)

#: Sources the watch needs, and the ones it measures with (each sign is left out without its own).
NEEDS = ("census_tracts_2020",)
FEEDS = {
    "real_estate_sales": "sale prices and company buyers",
    "assessment_values": "assessed values",
    "acs_tenure": "renters",
    "market_value_analysis": "the Market Value Analysis",
    "acs_rent_burden": "rent burden",
}
#: Where homes are: OPA's category and year built, and its point for the tract.
HOMES = "opa_properties"
#: Names the tract's place in words, when present.
OPTIONAL = ("neighborhoods",)
SOURCES = (*NEEDS, HOMES, *FEEDS, *OPTIONAL)

#: OPA categories that are homes: single family (row houses, twins, condominium units) and multi
#: family houses of two to four homes. Apartment buildings, stores and land are not.
HOME_CATEGORIES = frozenset({"1", "2"})
#: Deeds that are not sales on the market: sheriff, condemnation and adverse possession deeds (the
#: lot pages' rule), and the Land Bank's own sales at set prices.
NOT_MARKET = frozenset({*SHERIFF_TYPES, *NOT_SALES, "DEED LAND BANK"})

RECENT_YEARS = 3
GAP_YEARS = 5
MIN_SALES = 50
MIN_ASSESSED = 50
MIN_OCCUPIED = 100
#: A home's value in the earlier tax year below this is a lot's or a shell's, not a home's.
MIN_BASE_VALUE = 10_000
#: Homes count for the assessed values when built at least this many years before the earlier
#: tax year, so a value that grew because a house went up is not counted as a rise.
BUILT_BEFORE = 2

PRICE_POINTS = 25
COMPANY_POINTS = 15
ASSESSMENT_POINTS = 30
RENTER_PCT = 60
#: Rent burden (owner, 2026-10-09): at least this many points above the city's share of renter
#: households paying half their income or more on rent, with at least MIN_RENTERS households
#: whose share could be computed (the floor of the card's context, tract_context.MIN_RENTERS).
RENT_BURDEN_POINTS = 10
MIN_RENTERS = 100

#: Signs, as bits (docs/CONTRACTS.md section 4, `w` and `dw`). Bits never change meaning.
SIGNS = {
    "prices": 1,
    "companies": 2,
    "assessments": 4,
    "renters": 8,
    "mva": 16,
    "rent_burden": 32,
}
#: The signs that say prices are rising; a watch area needs at least one of them.
PRICE_SIGNS = SIGNS["prices"] | SIGNS["assessments"] | SIGNS["mva"]
MIN_SIGNS = 2


def years_before(day: date, years: int) -> date:
    """The same calendar day `years` earlier (February 29 becomes February 28)."""
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(year=day.year - years, day=28)


@dataclass(frozen=True)
class Periods:
    """The two windows of sales, each from its first day to its last, both counted."""

    earlier_from: date
    earlier_to: date
    recent_from: date
    recent_to: date

    def of(self, day: date) -> str | None:
        if self.recent_from <= day <= self.recent_to:
            return "recent"
        if self.earlier_from <= day <= self.earlier_to:
            return "earlier"
        return None

    def to_json(self) -> dict[str, str]:
        return {k: v.isoformat() for k, v in asdict(self).items()}


def periods_ending(end: date) -> Periods:
    """The last `RECENT_YEARS` up to `end`, and the same span ending `GAP_YEARS` before it."""
    earlier_to = years_before(end, GAP_YEARS)
    return Periods(
        earlier_from=years_before(earlier_to, RECENT_YEARS) + timedelta(days=1),
        earlier_to=earlier_to,
        recent_from=years_before(end, RECENT_YEARS) + timedelta(days=1),
        recent_to=end,
    )


def year_of(text: object) -> int | None:
    """OPA's year built as a number, or None when it is not a plausible year."""
    try:
        year = int(str(text).strip())
    except (TypeError, ValueError):
        return None
    return year if 1700 <= year <= 2100 else None


def sale_price(adjusted: float | None, total: float | None) -> float | None:
    """This property's share of the price (the adjusted total), else the total, as the lot pages
    show it (placekeepers.derive.transfers)."""
    return adjusted if adjusted is not None else total


def is_market_home_sale(
    document_type: str | None,
    price: float | None,
    properties: int | None,
    category: str | None,
    year_built: int | None,
    day: date,
) -> bool:
    """A sale of a home on the market (see the module docstring)."""
    kind = (document_type or "").strip().upper()
    if not is_deed(kind) or kind in NOT_MARKET:
        return False
    if price is None or price <= NOMINAL_MAX:
        return False
    if properties is not None and properties > 1:
        return False
    if category not in HOME_CATEGORIES:
        return False
    return year_built is None or year_built <= day.year


def counts_for_assessment(
    category: str | None, year_built: int | None, base_value: int | None, base_year: int
) -> bool:
    """A home whose change in value can be read as a change in price (see the module
    docstring)."""
    if category not in HOME_CATEGORIES or base_value is None or base_value < MIN_BASE_VALUE:
        return False
    return year_built is None or year_built <= base_year - BUILT_BEFORE


def change_pct(new: float | None, old: float | None) -> float | None:
    if new is None or old is None or old <= 0:
        return None
    return round(100.0 * (new / old - 1), 1)


def median_or_none(values: list[float]) -> float | None:
    return float(statistics.median(values)) if values else None


@dataclass
class TractMeasures:
    tract: str
    place: str | None = None
    sales_earlier: int = 0
    sales_recent: int = 0
    median_earlier: float | None = None
    median_recent: float | None = None
    price_change_pct: float | None = None
    company_pct: float | None = None
    homes_assessed: int = 0
    assessment_change_pct: float | None = None
    occupied: int | None = None
    renter_pct: float | None = None
    mva_block_groups: int = 0
    mva_rising: int = 0
    renters_counted: int = 0
    rent_burden_pct: float | None = None
    rent_burden_moe: float | None = None
    signs: int = 0
    watch: bool = False


@dataclass
class CityMeasures:
    sales_earlier: int = 0
    sales_recent: int = 0
    median_earlier: float | None = None
    median_recent: float | None = None
    price_change_pct: float | None = None
    company_pct: float | None = None
    homes_assessed: int = 0
    assessment_change_pct: float | None = None
    renter_pct: float | None = None
    rent_burden_pct: float | None = None


def signs_of(m: TractMeasures, city: CityMeasures) -> int:
    """The tract's signs, as bits of `SIGNS`."""
    bits = 0
    if (
        m.price_change_pct is not None
        and city.price_change_pct is not None
        and min(m.sales_earlier, m.sales_recent) >= MIN_SALES
        and m.price_change_pct >= city.price_change_pct + PRICE_POINTS
    ):
        bits |= SIGNS["prices"]
    if (
        m.company_pct is not None
        and city.company_pct is not None
        and m.sales_recent >= MIN_SALES
        and m.company_pct >= city.company_pct + COMPANY_POINTS
    ):
        bits |= SIGNS["companies"]
    if (
        m.assessment_change_pct is not None
        and city.assessment_change_pct is not None
        and m.homes_assessed >= MIN_ASSESSED
        and m.assessment_change_pct >= city.assessment_change_pct + ASSESSMENT_POINTS
    ):
        bits |= SIGNS["assessments"]
    if (
        m.renter_pct is not None
        and (m.occupied or 0) >= MIN_OCCUPIED
        and m.renter_pct >= RENTER_PCT
    ):
        bits |= SIGNS["renters"]
    if m.mva_rising > 0:
        bits |= SIGNS["mva"]
    if (
        m.rent_burden_pct is not None
        and city.rent_burden_pct is not None
        and m.renters_counted >= MIN_RENTERS
        and m.rent_burden_pct >= city.rent_burden_pct + RENT_BURDEN_POINTS
    ):
        bits |= SIGNS["rent_burden"]
    return bits


def is_watch(bits: int) -> bool:
    """At least `MIN_SIGNS` signs, and at least one of them about prices rising."""
    return bin(bits).count("1") >= MIN_SIGNS and bool(bits & PRICE_SIGNS)


# Reading the snapshots


@dataclass
class Homes:
    """OPA's parcels: category, year built and the 2020 tract of each parcel's point."""

    category: dict[str, str | None]
    built: dict[str, int | None]
    tract: dict[str, str | None]


def load_homes(opa: Path, tracts_path: Path) -> Homes:
    table = pq.read_table(
        opa, columns=["parcel_number", "category_code", "year_built", "lat", "lng"]
    )
    accounts = table.column("parcel_number").to_pylist()
    lat = np.array([np.nan if v is None else v for v in table.column("lat").to_pylist()])
    lng = np.array([np.nan if v is None else v for v in table.column("lng").to_pylist()])
    geoids, shapes = load_tracts(tracts_path)
    found = tracts_of(shapely.points(lng, lat), geoids, shapes)
    categories = [
        None if c is None else str(c).strip() for c in table.column("category_code").to_pylist()
    ]
    built = [year_of(y) for y in table.column("year_built").to_pylist()]
    return Homes(
        category=dict(zip(accounts, categories, strict=True)),
        built=dict(zip(accounts, built, strict=True)),
        tract=dict(zip(accounts, found, strict=True)),
    )


@dataclass
class Sale:
    tract: str
    period: str
    price: float
    company: bool


def market_home_sales(
    path: Path, homes: Homes, as_of: date
) -> tuple[list[Sale], Periods | None, dict[str, int]]:
    """The home sales of both periods, each in its tract, with the periods and counts of what
    was left out."""
    columns = [
        "document_type",
        "display_date",
        "opa_account_num",
        "total_consideration",
        "adjusted_total_consideration",
        "property_count",
        "buyer_type",
    ]
    table = pq.read_table(path, columns=columns)
    rows = list(zip(*(table.column(c).to_pylist() for c in columns), strict=True))
    days = [day for _, day, *_ in rows if day is not None and day <= as_of]
    if not days:
        return [], None, {}
    periods = periods_ending(max(days))
    left_out = {"not_a_home_sale": 0, "not_in_opa": 0, "outside_tracts": 0}
    sales: list[Sale] = []
    for kind, day, account, total, adjusted, count, buyer in rows:
        if day is None or day > as_of:
            continue
        period = periods.of(day)
        if period is None:
            continue
        if account not in homes.category:
            left_out["not_in_opa"] += 1
            continue
        price = sale_price(adjusted, total)
        if not is_market_home_sale(
            kind, price, count, homes.category[account], homes.built[account], day
        ):
            left_out["not_a_home_sale"] += 1
            continue
        tract = homes.tract[account]
        if tract is None:
            left_out["outside_tracts"] += 1
            continue
        assert price is not None
        sales.append(Sale(tract, period, float(price), buyer == "company"))
    return sales, periods, left_out


def assessed_changes(
    path: Path, homes: Homes
) -> tuple[dict[str, list[float]], tuple[int, int] | None]:
    """Each home's value in the newest tax year over the earlier one, by tract."""
    table = pq.read_table(path, columns=["parcel_number", "year", "market_value"])
    years = sorted({y for y in table.column("year").to_pylist() if y is not None})
    if len(years) < 2:
        return {}, None
    base_year, new_year = years[0], years[-1]
    base: dict[str, int] = {}
    new: dict[str, int] = {}
    for account, year, value in zip(
        *(table.column(c).to_pylist() for c in ("parcel_number", "year", "market_value")),
        strict=True,
    ):
        if value is None:
            continue
        if year == base_year:
            base[account] = value
        elif year == new_year:
            new[account] = value
    ratios: dict[str, list[float]] = {}
    for account, old in base.items():
        later = new.get(account)
        tract = homes.tract.get(account)
        if later is None or later <= 0 or tract is None:
            continue
        if not counts_for_assessment(
            homes.category.get(account), homes.built.get(account), old, base_year
        ):
            continue
        ratios.setdefault(tract, []).append(later / old)
    return ratios, (base_year, new_year)


def tenure(path: Path) -> dict[str, tuple[int | None, int | None, float | None]]:
    table = pq.read_table(path, columns=["geoid", "occupied", "renter_occupied", "renter_pct"])
    return {
        g: (o, r, p)
        for g, o, r, p in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        )
    }


def mva_by_tract(path: Path) -> dict[str, tuple[int, int]]:
    """Block groups of each tract in the Market Value Analysis, and how many have rising
    pressure."""
    table = pq.read_table(path, columns=["geoid", "pressure"])
    out: dict[str, list[int]] = {}
    for geoid, pressure in zip(
        table.column("geoid").to_pylist(), table.column("pressure").to_pylist(), strict=True
    ):
        if not geoid or len(geoid) < 12:
            continue
        entry = out.setdefault(geoid[:11], [0, 0])
        entry[0] += 1
        if pressure == "rising":
            entry[1] += 1
    return {t: (n, r) for t, (n, r) in out.items()}


def places_of(tracts_path: Path, neighborhoods: Path | None) -> dict[str, str]:
    """The neighborhood at each tract's center (a point inside it), in words."""
    if neighborhoods is None:
        return {}
    geoids, shapes = load_tracts(tracts_path)
    table = pq.read_table(neighborhoods, columns=["listname", "name", "geometry"])
    names = [
        listname or name
        for listname, name in zip(
            table.column("listname").to_pylist(), table.column("name").to_pylist(), strict=True
        )
    ]
    found = tracts_of(
        shapely.point_on_surface(shapes),
        [str(n) for n in names],
        shapely.from_wkb(table.column("geometry").to_pylist()),
    )
    from placekeepers.publish.layers import plain_name

    return {g: str(plain_name(n)) for g, n in zip(geoids, found, strict=True) if n}


def pct(part: int, whole: int) -> float | None:
    return round(100.0 * part / whole, 1) if whole else None


def measure(
    tract_ids: Iterable[str],
    sales: list[Sale],
    ratios: dict[str, list[float]],
    renters: dict[str, tuple[int | None, int | None, float | None]],
    mva: dict[str, tuple[int, int]],
    places: dict[str, str],
    burden: dict[str, tuple[int, float | None, float | None]] | None = None,
    city_burden: float | None = None,
) -> tuple[list[TractMeasures], CityMeasures]:
    """Every tract's measures, signs and watch call, and the city's measures. `burden` and
    `city_burden` are the rent burden of each tract and of the city (tract_context.rent_burden)."""
    by_tract: dict[str, dict[str, list[Sale]]] = {}
    for sale in sales:
        by_tract.setdefault(sale.tract, {"earlier": [], "recent": []})[sale.period].append(sale)
    city = CityMeasures()
    earlier = [s.price for s in sales if s.period == "earlier"]
    recent = [s for s in sales if s.period == "recent"]
    city.sales_earlier, city.sales_recent = len(earlier), len(recent)
    city.median_earlier = median_or_none(earlier)
    city.median_recent = median_or_none([s.price for s in recent])
    city.price_change_pct = change_pct(city.median_recent, city.median_earlier)
    city.company_pct = pct(sum(s.company for s in recent), len(recent))
    every_ratio = [r for values in ratios.values() for r in values]
    city.homes_assessed = len(every_ratio)
    middle = median_or_none(every_ratio)
    city.assessment_change_pct = None if middle is None else round(100.0 * (middle - 1), 1)
    occupied = sum(o for o, r, _ in renters.values() if o is not None and r is not None)
    rented = sum(r for o, r, _ in renters.values() if o is not None and r is not None)
    city.renter_pct = pct(rented, occupied)
    city.rent_burden_pct = city_burden
    burden = burden or {}

    measures = []
    for tract in sorted(set(tract_ids)):
        m = TractMeasures(tract=tract, place=places.get(tract))
        found = by_tract.get(tract, {"earlier": [], "recent": []})
        m.sales_earlier, m.sales_recent = len(found["earlier"]), len(found["recent"])
        m.median_earlier = median_or_none([s.price for s in found["earlier"]])
        m.median_recent = median_or_none([s.price for s in found["recent"]])
        m.price_change_pct = change_pct(m.median_recent, m.median_earlier)
        m.company_pct = pct(sum(s.company for s in found["recent"]), len(found["recent"]))
        values = ratios.get(tract, [])
        m.homes_assessed = len(values)
        middle = median_or_none(values)
        m.assessment_change_pct = None if middle is None else round(100.0 * (middle - 1), 1)
        if tract in renters:
            m.occupied, _, m.renter_pct = renters[tract]
        m.mva_block_groups, m.mva_rising = mva.get(tract, (0, 0))
        m.renters_counted, m.rent_burden_pct, m.rent_burden_moe = burden.get(tract, (0, None, None))
        m.signs = signs_of(m, city)
        m.watch = is_watch(m.signs)
        measures.append(m)
    return measures, city


# The run


@dataclass
class DisplacementResult:
    path: Path
    as_of: str
    periods: dict[str, str] | None
    assessment_years: list[int] | None
    survey_years: list[int] | None
    mva_edition: str | None
    city: dict[str, Any]
    thresholds: dict[str, Any]
    counts: dict[str, Any]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


THRESHOLDS = {
    "price_points": PRICE_POINTS,
    "company_points": COMPANY_POINTS,
    "assessment_points": ASSESSMENT_POINTS,
    "renter_pct": RENTER_PCT,
    "rent_burden_points": RENT_BURDEN_POINTS,
    "min_renters": MIN_RENTERS,
    "min_sales": MIN_SALES,
    "min_assessed": MIN_ASSESSED,
    "min_occupied": MIN_OCCUPIED,
    "min_signs": MIN_SIGNS,
    "recent_years": RECENT_YEARS,
    "gap_years": GAP_YEARS,
}


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "displacement.parquet"


def survey_years(path: Path) -> list[int] | None:
    table = pq.read_table(path, columns=["survey_start_year", "survey_end_year"])
    if table.num_rows == 0:
        return None
    return [int(table.column(0)[0].as_py()), int(table.column(1)[0].as_py())]


def mva_edition(ctx: Context) -> str | None:
    source = ctx.registry.sources.get("market_value_analysis")
    return None if source is None else source.name


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> DisplacementResult:
    """Measure every tract and write $PK_CACHE/derived/displacement.parquet (or `out`) with a
    JSON summary beside it."""
    started = time.monotonic()
    as_of = as_of or ctx.today()
    paths = {source_id: current_snapshot(ctx, source_id) for source_id in SOURCES}
    if paths["census_tracts_2020"] is None:
        raise RuntimeError("The displacement watch needs the census tracts (census_tracts_2020)")
    if paths[HOMES] is None:
        raise RuntimeError("The displacement watch needs OPA's properties (opa_properties)")
    missing = [s for s in FEEDS if paths[s] is None]
    notes: list[str] = []
    tracts_path = paths["census_tracts_2020"]
    assert tracts_path is not None

    homes = load_homes(paths[HOMES], tracts_path)
    sales: list[Sale] = []
    periods: Periods | None = None
    left_out: dict[str, int] = {}
    if paths["real_estate_sales"] is not None:
        sales, periods, left_out = market_home_sales(paths["real_estate_sales"], homes, as_of)
    ratios: dict[str, list[float]] = {}
    years: tuple[int, int] | None = None
    if paths["assessment_values"] is not None:
        ratios, years = assessed_changes(paths["assessment_values"], homes)
    renters = tenure(paths["acs_tenure"]) if paths["acs_tenure"] is not None else {}
    mva = mva_by_tract(paths["market_value_analysis"]) if paths["market_value_analysis"] else {}
    burden: dict[str, tuple[int, float | None, float | None]] = {}
    city_burden: float | None = None
    if paths["acs_rent_burden"] is not None:
        burden, city_burden = rent_burden(paths["acs_rent_burden"])
    places = places_of(tracts_path, paths["neighborhoods"])

    geoids, _ = load_tracts(tracts_path)
    measures, city = measure(geoids, sales, ratios, renters, mva, places, burden, city_burden)

    rows = [asdict(m) for m in measures]
    table = pa.Table.from_pylist(
        rows,
        schema=pa.schema(
            [
                ("tract", pa.string()),
                ("place", pa.string()),
                ("sales_earlier", pa.int32()),
                ("sales_recent", pa.int32()),
                ("median_earlier", pa.float64()),
                ("median_recent", pa.float64()),
                ("price_change_pct", pa.float64()),
                ("company_pct", pa.float64()),
                ("homes_assessed", pa.int32()),
                ("assessment_change_pct", pa.float64()),
                ("occupied", pa.int64()),
                ("renter_pct", pa.float64()),
                ("mva_block_groups", pa.int16()),
                ("mva_rising", pa.int16()),
                ("renters_counted", pa.int32()),
                ("rent_burden_pct", pa.float64()),
                ("rent_burden_moe", pa.float64()),
                ("signs", pa.int16()),
                ("watch", pa.bool_()),
            ]
        ),
    )
    out = out or output_path(ctx)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    for source_id in missing:
        notes.append(
            f"The displacement watch ran without {source_id}, so its sign about "
            f"{FEEDS[source_id]} is left out"
        )
    watch = [m for m in measures if m.watch]
    counts = {
        "tracts": len(measures),
        "watch": len(watch),
        "homes_in_watch": sum(m.occupied or 0 for m in watch),
        "homes": sum(m.occupied or 0 for m in measures),
        "signs": {name: sum(1 for m in measures if m.signs & bit) for name, bit in SIGNS.items()},
        "measured": {
            "prices": sum(1 for m in measures if min(m.sales_earlier, m.sales_recent) >= MIN_SALES),
            "companies": sum(1 for m in measures if m.sales_recent >= MIN_SALES),
            "assessments": sum(1 for m in measures if m.homes_assessed >= MIN_ASSESSED),
            "renters": sum(1 for m in measures if (m.occupied or 0) >= MIN_OCCUPIED),
            "rent_burden": sum(1 for m in measures if m.renters_counted >= MIN_RENTERS),
        },
        "sales_left_out": left_out,
    }
    notes.append(
        f"Displacement watch: {len(watch)} of {len(measures)} census tracts, holding "
        f"{counts['homes_in_watch']:,} of {counts['homes']:,} occupied homes, show at least two "
        "signs that prices are rising"
    )
    result = DisplacementResult(
        path=out,
        as_of=as_of.isoformat(),
        periods=None if periods is None else periods.to_json(),
        assessment_years=None if years is None else list(years),
        survey_years=survey_years(paths["acs_tenure"]) if paths["acs_tenure"] else None,
        mva_edition=mva_edition(ctx) if paths["market_value_analysis"] else None,
        city={k: v for k, v in asdict(city).items()},
        thresholds=dict(THRESHOLDS),
        counts=counts,
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info(
        "derive: displacement watch, %d of %d tracts in %.0f s",
        len(watch),
        len(measures),
        result.seconds,
    )
    return result


# Reading the result, for publish


def load_watch(path: Path) -> dict[str, int]:
    """The watch areas: each tract's signs, by tract id, for the tracts in the watch only."""
    if not path.is_file():
        return {}
    table = pq.read_table(path, columns=["tract", "signs", "watch"])
    return {
        t: int(s)
        for t, s, w in zip(*(table.column(c).to_pylist() for c in table.column_names), strict=True)
        if w
    }


def load_summary(path: Path) -> dict[str, Any] | None:
    """The summary beside the result (derived/displacement.json), or None."""
    import json

    summary = path.with_suffix(".json")
    if not summary.is_file():
        return None
    return json.loads(summary.read_text(encoding="utf-8"))
