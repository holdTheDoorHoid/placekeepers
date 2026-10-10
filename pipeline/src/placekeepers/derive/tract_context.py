"""Neighborhood context for the displacement watch (milestone M4.7, issue #43; docs/DESIGN.md
section 5.3): for every 2020 census tract, how many renters pay half their income or more on rent,
the middle rent and household income, and how many homes are empty and why, each with its margin
of error, from five tables of the American Community Survey's 2020 to 2024 five year estimates:

* `acs_rent_burden` (B25070): renter households, those whose share of income could not be
  computed (no cash rent or no income), and those paying 50 percent or more;
* `acs_rent` (B25064): the median gross rent, rent plus the utilities the renter pays;
* `acs_income` (B19013): the median household income;
* `acs_occupancy` (B25002): homes, homes lived in and homes empty;
* `acs_vacancy` (B25004): why the empty homes are empty.

These are context, never a sign: they change no watch area and no score. The map shows them only
on the card of a watch area (docs/ETHICS.md: only watch areas carry numbers on the map); the
other tracts' numbers stay in this derived file, which proposals to the owner read.

**Margins of error.** The Census Bureau publishes each estimate with a margin of error at 90
percent confidence. Shares and sums follow the Bureau's own approximations (the ACS handbook,
"Understanding and Using American Community Survey Data", 2020, chapter 8): a sum's margin is the
square root of the sum of its parts' squared margins, and a share's margin is
sqrt(MOE_part**2 - p**2 * MOE_whole**2) / whole, with the plus sign instead when the value under
the root would be negative. Small tracts are noisy, so a share is published only with at least
`MIN_RENTERS` renter households or `MIN_HOMES` homes behind it, and every number carries its margin.

The city's own figures come from the summary file's row for Philadelphia County (the same as the
city), because a median cannot be added up from tracts.
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.cache import atomic_output, atomic_write_json
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.derive.lenses import current_snapshot

log = logging.getLogger(__name__)

#: The tables read, and what each gives (a table without a snapshot leaves its numbers out).
SOURCES = {
    "acs_rent_burden": "rent as a share of income",
    "acs_rent": "the middle rent",
    "acs_income": "the middle household income",
    "acs_occupancy": "homes lived in and empty",
    "acs_vacancy": "why homes are empty",
}
#: The row of the whole city (Philadelphia County) in each table.
CITY = "42101"
#: A share of renters is shown only with at least this many renter households whose share of
#: income on rent could be computed; a share of empty homes with at least this many homes. The
#: same floor as the watch's renters sign (fewer than 100 occupied homes is too few to tell).
MIN_RENTERS = 100
MIN_HOMES = 100


def sum_moe(*margins: float | None) -> float | None:
    """The margin of a sum or difference of estimates: the root of the sum of squares."""
    if any(m is None for m in margins):
        return None
    return math.sqrt(sum(float(m) ** 2 for m in margins))  # type: ignore[arg-type]


def share_moe(
    part: float, part_moe: float | None, whole: float, whole_moe: float | None
) -> float | None:
    """The margin of error of part / whole, as a fraction (the Census Bureau's formula for a
    proportion, falling back to the one for a ratio when the root would be of a negative)."""
    if part_moe is None or whole_moe is None or whole <= 0:
        return None
    p = part / whole
    inside = part_moe**2 - p**2 * whole_moe**2
    if inside < 0:
        inside = part_moe**2 + p**2 * whole_moe**2
    return math.sqrt(inside) / whole


def pct(value: float | None) -> float | None:
    return None if value is None else round(100.0 * value, 1)


@dataclass
class TractContext:
    """One tract's context (or the city's, with `tract` "city"). Counts are households or homes;
    shares and their margins are in percent and percentage points; money is in dollars."""

    tract: str
    renter_households: int | None = None
    renters_counted: int | None = None
    renters_counted_moe: float | None = None
    rent_burden_50: int | None = None
    rent_burden_50_moe: float | None = None
    rent_burden_50_pct: float | None = None
    rent_burden_50_pct_moe: float | None = None
    median_rent: int | None = None
    median_rent_moe: int | None = None
    median_income: int | None = None
    median_income_moe: int | None = None
    homes: int | None = None
    homes_moe: int | None = None
    vacant: int | None = None
    vacant_moe: int | None = None
    vacant_pct: float | None = None
    vacant_pct_moe: float | None = None
    for_rent: int | None = None
    for_rent_moe: float | None = None
    for_sale: int | None = None
    for_sale_moe: float | None = None
    #: rented or sold, and not yet moved into
    not_yet_moved_in: int | None = None
    not_yet_moved_in_moe: float | None = None
    #: for seasonal, recreational or occasional use, or for migrant workers
    seasonal: int | None = None
    seasonal_moe: float | None = None
    #: the Census's "other vacant": held off the market for repairs, legal limbo and the like
    other_vacant: int | None = None
    other_vacant_moe: float | None = None


def _rows(path: Path | None) -> dict[str, dict[str, Any]]:
    """A table's rows by geoid: the tracts' 11 digits and the city's "42101"."""
    if path is None:
        return {}
    return {row["geoid"]: row for row in pq.read_table(path).to_pylist()}


def _int(value: Any) -> int | None:
    return None if value is None else int(value)


def context_of(
    key: str,
    burden: dict[str, Any] | None,
    rent: dict[str, Any] | None,
    income: dict[str, Any] | None,
    occupancy: dict[str, Any] | None,
    vacancy: dict[str, Any] | None,
) -> TractContext:
    """The context of one place from its row in each table (any of them may be missing)."""
    c = TractContext(tract=key)
    if burden is not None and burden.get("renter_households") is not None:
        c.renter_households = int(burden["renter_households"])
        counted = c.renter_households - int(burden.get("not_computed") or 0)
        c.renters_counted = counted
        c.renters_counted_moe = sum_moe(
            burden.get("renter_households_moe"), burden.get("not_computed_moe")
        )
        c.rent_burden_50 = _int(burden.get("rent_50_plus"))
        c.rent_burden_50_moe = _int(burden.get("rent_50_plus_moe"))
        if c.rent_burden_50 is not None and counted > 0:
            c.rent_burden_50_pct = pct(c.rent_burden_50 / counted)
            c.rent_burden_50_pct_moe = pct(
                share_moe(c.rent_burden_50, c.rent_burden_50_moe, counted, c.renters_counted_moe)
            )
    if rent is not None:
        c.median_rent = _int(rent.get("median_rent"))
        c.median_rent_moe = _int(rent.get("median_rent_moe")) if c.median_rent else None
    if income is not None:
        c.median_income = _int(income.get("median_income"))
        c.median_income_moe = _int(income.get("median_income_moe")) if c.median_income else None
    if occupancy is not None:
        c.homes = _int(occupancy.get("homes"))
        c.homes_moe = _int(occupancy.get("homes_moe"))
        c.vacant = _int(occupancy.get("vacant"))
        c.vacant_moe = _int(occupancy.get("vacant_moe"))
        if c.homes and c.vacant is not None:
            c.vacant_pct = pct(c.vacant / c.homes)
            c.vacant_pct_moe = pct(share_moe(c.vacant, c.vacant_moe, c.homes, c.homes_moe))
    if vacancy is not None:

        def part(*names: str) -> tuple[int | None, float | None]:
            values = [vacancy.get(n) for n in names]
            if any(v is None for v in values):
                return None, None
            margins = [vacancy.get(f"{n}_moe") for n in names]
            margin = margins[0] if len(names) == 1 else sum_moe(*margins)
            return sum(int(v) for v in values), None if margin is None else float(margin)

        c.for_rent, c.for_rent_moe = part("for_rent")
        c.for_sale, c.for_sale_moe = part("for_sale")
        c.not_yet_moved_in, c.not_yet_moved_in_moe = part(
            "rented_not_occupied", "sold_not_occupied"
        )
        c.seasonal, c.seasonal_moe = part("seasonal", "migrant_workers")
        c.other_vacant, c.other_vacant_moe = part("other_vacant")
    return c


def measure(
    tables: dict[str, dict[str, dict[str, Any]]],
) -> tuple[list[TractContext], TractContext]:
    """Every tract's context and the city's, from each table's rows by geoid."""
    keys = sorted({g for rows in tables.values() for g in rows if len(g) == 11})

    def of(key: str) -> TractContext:
        return context_of(
            key,
            tables.get("acs_rent_burden", {}).get(key),
            tables.get("acs_rent", {}).get(key),
            tables.get("acs_income", {}).get(key),
            tables.get("acs_occupancy", {}).get(key),
            tables.get("acs_vacancy", {}).get(key),
        )

    city = of(CITY)
    city.tract = "city"
    return [of(key) for key in keys], city


def rent_burden(
    path: Path,
) -> tuple[dict[str, tuple[int, float | None, float | None]], float | None]:
    """For the displacement watch's rent burden sign (owner, 2026-10-09): each tract's renter
    households whose share of income on rent could be computed, the share of them paying half
    their income or more (percent) and its margin (points), by the tract's 11 digit id, and the
    city's share from the Census's row for the whole city."""
    tracts: dict[str, tuple[int, float | None, float | None]] = {}
    city: float | None = None
    for geoid, row in _rows(path).items():
        c = context_of(geoid, row, None, None, None, None)
        if geoid == CITY:
            city = c.rent_burden_50_pct
        elif len(geoid) == 11:
            tracts[geoid] = (c.renters_counted or 0, c.rent_burden_50_pct, c.rent_burden_50_pct_moe)
    return tracts, city


# The run


@dataclass
class ContextResult:
    path: Path
    as_of: str
    survey_years: list[int] | None
    city: dict[str, Any]
    thresholds: dict[str, int]
    counts: dict[str, int]
    missing_sources: list[str]
    seconds: float
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data["path"] = str(self.path)
        return data


def output_path(ctx: Context) -> Path:
    return ctx.cache.root / "derived" / "tract_context.parquet"


#: The file's columns: the tract's id, then counts and money as whole numbers, and shares and
#: margins of error as decimals.
SCHEMA = pa.schema(
    [
        ("tract", pa.string()),
        *(
            (name, pa.float64() if "pct" in name or name.endswith("_moe") else pa.int64())
            for name in TractContext.__dataclass_fields__
            if name != "tract"
        ),
    ]
)


def _survey_years(paths: dict[str, Path | None]) -> tuple[list[int] | None, list[str]]:
    """The survey's years, and a note for each table from a different survey than the others."""
    found: dict[str, tuple[int, int]] = {}
    for source_id, path in paths.items():
        if path is None:
            continue
        table = pq.read_table(path, columns=["survey_start_year", "survey_end_year"])
        if table.num_rows:
            found[source_id] = (int(table.column(0)[0].as_py()), int(table.column(1)[0].as_py()))
    if not found:
        return None, []
    years = max(set(found.values()), key=list(found.values()).count)
    notes = [
        f"{source_id} is from the {a} to {b} survey, not {years[0]} to {years[1]}"
        for source_id, (a, b) in found.items()
        if (a, b) != years
    ]
    return list(years), notes


def run(ctx: Context, as_of: date | None = None, out: Path | None = None) -> ContextResult:
    """Measure every tract and write $PK_CACHE/derived/tract_context.parquet (or `out`) with a
    JSON summary beside it."""
    started = time.monotonic()
    as_of = as_of or ctx.today()
    paths = {source_id: current_snapshot(ctx, source_id) for source_id in SOURCES}
    missing = [s for s, p in paths.items() if p is None]
    if len(missing) == len(SOURCES):
        raise RuntimeError("The neighborhood context needs at least one of " + ", ".join(SOURCES))
    tables = {source_id: _rows(path) for source_id, path in paths.items()}
    tracts, city = measure(tables)
    years, notes = _survey_years(paths)

    out = out or output_path(ctx)
    table = pa.Table.from_pylist([asdict(t) for t in tracts], schema=SCHEMA)
    with atomic_output(out) as tmp:
        pq.write_table(table, tmp, compression="zstd")

    for source_id in missing:
        notes.append(f"The neighborhood context ran without {source_id}: {SOURCES[source_id]}")
    counts = {
        "tracts": len(tracts),
        "rent_burden": sum(
            1
            for t in tracts
            if t.rent_burden_50_pct is not None and (t.renters_counted or 0) >= MIN_RENTERS
        ),
        "median_rent": sum(1 for t in tracts if t.median_rent),
        "median_income": sum(1 for t in tracts if t.median_income),
        "vacant": sum(
            1 for t in tracts if t.vacant_pct is not None and (t.homes or 0) >= MIN_HOMES
        ),
    }
    notes.append(
        f"Neighborhood context: {counts['tracts']} census tracts; rent burden for "
        f"{counts['rent_burden']}, middle rent for {counts['median_rent']}, middle income for "
        f"{counts['median_income']} and empty homes for {counts['vacant']} (the city: "
        f"{city.rent_burden_50_pct}% of renters pay half their income or more on rent)"
    )
    result = ContextResult(
        path=out,
        as_of=as_of.isoformat(),
        survey_years=years,
        city=asdict(city),
        thresholds={"min_renters": MIN_RENTERS, "min_homes": MIN_HOMES},
        counts=counts,
        missing_sources=missing,
        seconds=round(time.monotonic() - started, 1),
        notes=notes,
    )
    summary = result.to_json()
    summary["generated_at"] = iso_z(ctx.now())
    atomic_write_json(out.with_suffix(".json"), summary)
    log.info("derive: neighborhood context for %d tracts", len(tracts))
    return result


# Reading the result, for publish


def load_context(path: Path) -> dict[str, dict[str, Any]]:
    """Each tract's context by its 11 digit id, or nothing when it has not been measured."""
    if not path.is_file():
        return {}
    return {row["tract"]: row for row in pq.read_table(path).to_pylist()}


def load_summary(path: Path) -> dict[str, Any] | None:
    import json

    summary = path.with_suffix(".json")
    if not summary.is_file():
        return None
    return json.loads(summary.read_text(encoding="utf-8"))
