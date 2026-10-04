"""Real estate transfers: the deed history, sales, sheriff sales, the last sale and fast resales.

From the City's transfer records (Carto `rtt_summary`, source `real_estate_transfers`):

* A **deed** is any document whose type names a deed ("DEED", "DEED SHERIFF", "MISCELLANEOUS
  DEED", "DEED LAND BANK" and the rest) or a CERTIFICATE OF STOCK TRANSFER. Mortgages,
  satisfactions and other filings are not transfers of ownership and are left out.
* A **sheriff sale** is a deed of type "DEED SHERIFF" or "SHERIFF'S DEED".
* A **sale** is a deed for more than a token price (`NOMINAL_MAX`, $100: deeds for $0, $1 or $10
  are gifts, family transfers and corrections). Sheriff deeds, deeds of condemnation and adverse
  possession deeds are not sales in the "last sold" sense, but every one of them stays in the full
  history.
* **Fast resales** are two or more deeds for a price (sheriff sales included) within 24 months of
  each other. Deeds dated the same day count as one sale.

Each deed's date and price are the ones the City's property page shows (decided 2026-10-04 by the
orchestrator): the date on the deed (the City's `display_date`, a day in Philadelphia; the City
uses the recording date when the deed has no date, or a date after it was recorded) and the
adjusted total (this property's share when one deed covered several properties; the total
consideration when there is no adjusted total). Prices keep their cents here; the City's page and
the flag sentences round them to the dollar.

The records are complete only from 2000 on: the candidate parcels have about 4,000 deeds a year
from 2000 and a few dozen a year before 1999 (checked 2026-10-04). OPA's own last sale date and
price (the latest deed of any kind, with its document date) fill in the years before 2000.
"""

from __future__ import annotations

import calendar
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date

SHERIFF_TYPES = frozenset({"DEED SHERIFF", "SHERIFF'S DEED"})
NOT_SALES = frozenset({"DEED OF CONDEMNATION", "DEED - ADVERSE POSSESSION"})
OTHER_TRANSFERS = frozenset({"CERTIFICATE OF STOCK TRANSFER"})
NOMINAL_MAX = 100
FULL_RECORDS_FROM = date(2000, 1, 1)
RESALE_MONTHS = 24
#: names listed per side of a transfer in a dossier; the rest are counted
MAX_NAMES = 10


def dollars(amount: float) -> int | float:
    """A price for the dossier: whole dollars as a whole number, else to the cent (an adjusted
    total can be a share such as $17,500.25)."""
    cents = round(amount * 100)
    return cents // 100 if cents % 100 == 0 else cents / 100


def add_months(day: date, months: int) -> date:
    """The same calendar day `months` later (or earlier, when negative), clamped to the end of
    shorter months."""
    index = day.year * 12 + (day.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def is_deed(document_type: str | None) -> bool:
    kind = (document_type or "").upper()
    return "DEED" in kind or kind in OTHER_TRANSFERS


def split_names(text: str | None) -> list[str]:
    """Grantors or grantees: the City separates names with semicolons."""
    return [" ".join(name.split()) for name in (text or "").split(";") if name.strip()]


@dataclass(frozen=True)
class Transfer:
    document_id: int | None
    date: date
    type: str
    price: float | None
    grantors: tuple[str, ...] = ()
    grantees: tuple[str, ...] = ()
    properties: int = 1

    @property
    def sheriff(self) -> bool:
        return self.type in SHERIFF_TYPES

    @property
    def priced(self) -> bool:
        return self.price is not None and self.price > NOMINAL_MAX

    @property
    def sale(self) -> bool:
        """A sale in the "last sold" sense: priced, and not a sheriff, condemnation or adverse
        possession deed."""
        return self.priced and not self.sheriff and self.type not in NOT_SALES

    def to_json(self) -> dict:
        """The dossier's form (docs/CONTRACTS.md section 6)."""
        out: dict = {
            "date": self.date.isoformat(),
            "type": self.type,
            "price": None if self.price is None else dollars(self.price),
            "from": list(self.grantors[:MAX_NAMES]),
            "to": list(self.grantees[:MAX_NAMES]),
        }
        if len(self.grantors) > MAX_NAMES:
            out["from_more"] = len(self.grantors) - MAX_NAMES
        if len(self.grantees) > MAX_NAMES:
            out["to_more"] = len(self.grantees) - MAX_NAMES
        if self.properties > 1:
            out["properties"] = self.properties
        return out


def deeds(rows: Iterable[Transfer]) -> list[Transfer]:
    """The deeds among a parcel's transfer records, newest first, each document once."""
    seen: set = set()
    out = []
    for row in rows:
        if not is_deed(row.type):
            continue
        key = row.document_id if row.document_id is not None else (row.date, row.type, row.price)
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return sorted(out, key=lambda t: (t.date, t.document_id or 0), reverse=True)


def sheriff_sales(history: list[Transfer]) -> list[Transfer]:
    """Sheriff deeds, oldest first."""
    return sorted((t for t in history if t.sheriff), key=lambda t: t.date)


@dataclass(frozen=True)
class LastSale:
    #: the year of the last sale, or the year since which there has been none
    year: int
    #: True when the year is the last sale; False when it is "not sold since at least"
    known: bool
    date: date | None = None
    price: float | None = None
    #: "transfers" (the City's deed records) or "opa" (the assessor's last sale)
    source: str | None = None


def last_sale(
    history: list[Transfer],
    opa_sale_date: date | None,
    opa_sale_price: float | None,
    as_of: date,
) -> LastSale:
    """The last sale for a price, from the deed records or the assessor's last sale.

    The assessor's last sale is the latest deed of any kind. It counts as a sale when its price is
    above a token price and no deed in the City's records falls within 60 days of it (when one
    does, that deed is the same transfer, already judged here: a sheriff or token deed is not a
    sale). When there is no sale at all, the result is the year since which none is known: the
    assessor's last transfer when it is older than 2000, otherwise 2000, where the full records
    begin."""
    found: list[tuple[date, float | None, str]] = [
        (t.date, t.price, "transfers") for t in history if t.sale and t.date <= as_of
    ]
    opa_ok = opa_sale_date is not None and date(1800, 1, 1) <= opa_sale_date <= as_of
    if (
        opa_ok
        and opa_sale_price is not None
        and opa_sale_price > NOMINAL_MAX
        and not any(abs((t.date - opa_sale_date).days) <= 60 for t in history)
    ):
        found.append((opa_sale_date, float(opa_sale_price), "opa"))
    if found:
        day, price, source = max(found, key=lambda item: item[0])
        return LastSale(day.year, True, day, price, source)
    if opa_ok and opa_sale_date < FULL_RECORDS_FROM:
        return LastSale(opa_sale_date.year, False)
    return LastSale(FULL_RECORDS_FROM.year, False)


@dataclass(frozen=True)
class Resales:
    count: int
    first: date
    last: date
    #: True when the latest of them is within 24 months of the build date
    recent: bool
    dates: list[date] = field(default_factory=list)


def fast_resales(history: list[Transfer], as_of: date) -> Resales | None:
    """The latest run of two or more deeds for a price, each within 24 months of the one
    before, or None. Deeds recorded on the same day count as one sale."""
    days = sorted(
        {t.date for t in history if t.priced and t.type not in NOT_SALES and t.date <= as_of}
    )
    if len(days) < 2:
        return None
    runs: list[list[date]] = [[days[0]]]
    for day in days[1:]:
        if day <= add_months(runs[-1][-1], RESALE_MONTHS):
            runs[-1].append(day)
        else:
            runs.append([day])
    latest = next((run for run in reversed(runs) if len(run) >= 2), None)
    if latest is None:
        return None
    recent = latest[-1] >= add_months(as_of, -RESALE_MONTHS)
    return Resales(len(latest), latest[0], latest[-1], recent, latest)
