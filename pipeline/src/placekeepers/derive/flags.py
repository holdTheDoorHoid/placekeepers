"""The owner flags of one parcel (docs/ETHICS.md, "Owner information").

Each flag is a dict with the three parts ETHICS.md asks for and the facts behind it:

    {"id": "absentee",
     "text": "The owner gets mail somewhere else: Cherry Hill, NJ (out of state).",
     "careful": "...", "next_step": "...",
     "routes": ["ask_the_owner"],                 registry/routes.yaml ids, when a route helps
     "links": [{"label": "...", "url": "..."}],   other links, when the flag names one
     "sources": ["opa_properties"],               registry/sources.yaml ids behind the flag
     "data": {"scope": "out_of_state", "place": "Cherry Hill, NJ"}}

Which owners get which flags:

* every owner: tax debt as of July 2025, past sheriff sales, fast resales, open violations,
  unsafe, imminently dangerous;
* private owners only (a person, a company, a nonprofit, or a name we could not type): absentee,
  possible estate, years since the last sale, many vacant parcels. Public bodies get mail at their
  offices, do not die, and are not bought and sold like homes, and their holdings are listed by the
  City itself.

A dossier whose private owner has any flag also carries `help` (the Tangled Title Fund and Fraud
Guard routes, ETHICS.md "Fraud Guard and Tangled Title links on every flagged dossier"), and one
whose owner is a person, or may be an estate, carries the deed fraud notice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from placekeepers.derive import wording
from placekeepers.derive.owners import Absentee, OwnerType
from placekeepers.derive.transfers import LastSale, Resales, Transfer

FLAG_IDS = (
    "absentee",
    "possible_estate",
    "tax_debt_2025",
    "sheriff_sales",
    "years_since_sale",
    "many_parcels",
    "fast_resales",
    "open_violations",
    "unsafe",
    "imminently_dangerous",
)
#: "many" vacant parcels: an owner with at least this many gets the flag
MANY_PARCELS_MIN = 5
HELP_ROUTES = ["tangled_title_help", "fraud_guard"]


@dataclass
class TaxDebt:
    total_due: float
    years: int | None


@dataclass
class LiSummary:
    open_violations: int = 0
    last_violation: date | None = None
    last_open: date | None = None
    last_open_title: str | None = None
    violations: int = 0
    unsafe_since: date | None = None
    dangerous_since: date | None = None


@dataclass
class OwnerFacts:
    owner_type: OwnerType
    has_names: bool
    absentee: Absentee | None = None
    possible_estate: bool = False
    tax: TaxDebt | None = None
    history: list[Transfer] = field(default_factory=list)
    last_sale: LastSale | None = None
    resales: Resales | None = None
    #: how many vacant parcels this owner holds, and the id of the list of them
    holdings: int = 0
    holdings_list: str | None = None
    li: LiSummary = field(default_factory=LiSummary)

    @property
    def private(self) -> bool:
        return not self.owner_type.public and (self.owner_type.type != "unknown" or self.has_names)


def make_flag(
    flag_id: str,
    text: str,
    careful: str,
    next_step: str,
    *,
    sources: list[str],
    routes: list[str] | None = None,
    links: list[dict[str, str]] | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    flag: dict[str, Any] = {"id": flag_id, "text": text, "careful": careful, "next_step": next_step}
    if routes:
        flag["routes"] = routes
    if links:
        flag["links"] = links
    flag["sources"] = sources
    if data:
        flag["data"] = data
    return flag


def absentee_flag(found: Absentee) -> dict[str, Any]:
    place = None
    if found.scope in {"out_of_state", "outside_city"} and (found.city or found.state):
        parts = [wording.place_name(found.city) if found.city else None, found.state]
        place = ", ".join(part for part in parts if part)
    data = {"scope": found.scope}
    if place:
        data["place"] = place
    return make_flag(
        "absentee",
        found.text,
        wording.ABSENTEE_CAREFUL,
        wording.ABSENTEE_NEXT_STEP,
        sources=["opa_properties"],
        routes=["ask_the_owner"],
        data=data,
    )


def estate_flag() -> dict[str, Any]:
    return make_flag(
        "possible_estate",
        wording.ESTATE_TEXT,
        wording.ESTATE_CAREFUL,
        wording.ESTATE_NEXT_STEP,
        sources=["opa_properties"],
        routes=["tangled_title_help", "fraud_guard"],
    )


def tax_flag(tax: TaxDebt) -> dict[str, Any]:
    data: dict[str, Any] = {
        "as_of": wording.TAX_SNAPSHOT_DATE.isoformat(),
        "total_due": round(tax.total_due),
    }
    if tax.years:
        data["years"] = tax.years
    return make_flag(
        "tax_debt_2025",
        wording.tax_text(tax.total_due, tax.years),
        wording.TAX_CAREFUL,
        wording.TAX_NEXT_STEP,
        sources=["cagp_tax_2025"],
        links=[wording.TAX_CENTER, wording.SHERIFF_SALE_GUIDE],
        data=data,
    )


def sheriff_flag(sales: list[Transfer]) -> dict[str, Any]:
    return make_flag(
        "sheriff_sales",
        wording.sheriff_text([(t.date, t.price) for t in sales]),
        wording.SHERIFF_CAREFUL,
        wording.SHERIFF_NEXT_STEP,
        sources=["real_estate_transfers"],
        links=[wording.SHERIFF_SALE_GUIDE, wording.GJLI],
        data={
            "sales": [
                {"date": t.date.isoformat(), "price": None if t.price is None else round(t.price)}
                for t in sales
            ]
        },
    )


def sale_flag(found: LastSale, as_of: date) -> dict[str, Any]:
    data: dict[str, Any] = {"year": found.year, "years": as_of.year - found.year}
    if found.known:
        text = wording.last_sale_text(found.year)
        if found.date:
            data["date"] = found.date.isoformat()
        if found.price is not None:
            data["price"] = round(found.price)
        sources = ["real_estate_transfers"] if found.source == "transfers" else ["opa_properties"]
    else:
        text = wording.no_sale_text(found.year)
        data["sold"] = False
        sources = ["real_estate_transfers", "opa_properties"]
    return make_flag(
        "years_since_sale",
        text,
        wording.SALE_CAREFUL,
        wording.SALE_NEXT_STEP,
        sources=sources,
        routes=["tangled_title_help"],
        data=data,
    )


def many_parcels_flag(count: int, list_id: str | None) -> dict[str, Any]:
    data: dict[str, Any] = {"count": count}
    if list_id:
        data["list"] = list_id
    return make_flag(
        "many_parcels",
        wording.many_parcels_text(count),
        wording.MANY_CAREFUL,
        wording.MANY_NEXT_STEP,
        sources=["opa_properties"],
        routes=["ask_the_owner"],
        data=data,
    )


def resale_flag(found: Resales) -> dict[str, Any]:
    return make_flag(
        "fast_resales",
        wording.resale_text(found.count, found.first, found.last, found.recent),
        wording.RESALE_CAREFUL,
        wording.RESALE_NEXT_STEP,
        sources=["real_estate_transfers"],
        routes=["fraud_guard"],
        data={"count": found.count, "dates": [day.isoformat() for day in found.dates]},
    )


def violations_flag(li: LiSummary) -> dict[str, Any]:
    data: dict[str, Any] = {"count": li.open_violations}
    if li.last_open:
        data["last"] = li.last_open.isoformat()
    if li.last_open_title:
        data["title"] = li.last_open_title
    return make_flag(
        "open_violations",
        wording.violations_text(li.open_violations, li.last_open, li.last_open_title),
        wording.VIOLATIONS_CAREFUL,
        wording.VIOLATIONS_NEXT_STEP,
        sources=["li_violations"],
        routes=["report_to_311"],
        data=data,
    )


def unsafe_flag(since: date | None) -> dict[str, Any]:
    return make_flag(
        "unsafe",
        wording.unsafe_text(since),
        wording.UNSAFE_CAREFUL,
        wording.UNSAFE_NEXT_STEP,
        sources=["li_unsafe"],
        routes=["report_to_311"],
        data={"since": since.isoformat()} if since else None,
    )


def dangerous_flag(since: date | None) -> dict[str, Any]:
    return make_flag(
        "imminently_dangerous",
        wording.dangerous_text(since),
        wording.DANGEROUS_CAREFUL,
        wording.DANGEROUS_NEXT_STEP,
        sources=["li_imminently_dangerous"],
        routes=["report_to_311"],
        data={"since": since.isoformat()} if since else None,
    )


def owner_flags(facts: OwnerFacts, as_of: date) -> list[dict[str, Any]]:
    """Every flag that applies, in the order of FLAG_IDS."""
    flags: list[dict[str, Any]] = []
    private = facts.private
    if private and facts.absentee is not None:
        flags.append(absentee_flag(facts.absentee))
    if private and facts.possible_estate:
        flags.append(estate_flag())
    if facts.tax is not None and facts.tax.total_due > 0:
        flags.append(tax_flag(facts.tax))
    sheriff = [t for t in facts.history if t.sheriff and t.date <= as_of]
    if sheriff:
        flags.append(sheriff_flag(sorted(sheriff, key=lambda t: t.date)))
    if private and facts.last_sale is not None:
        flags.append(sale_flag(facts.last_sale, as_of))
    if private and facts.holdings >= MANY_PARCELS_MIN:
        flags.append(many_parcels_flag(facts.holdings, facts.holdings_list))
    if facts.resales is not None:
        flags.append(resale_flag(facts.resales))
    if facts.li.open_violations > 0:
        flags.append(violations_flag(facts.li))
    if facts.li.unsafe_since is not None:
        flags.append(unsafe_flag(facts.li.unsafe_since))
    if facts.li.dangerous_since is not None:
        flags.append(dangerous_flag(facts.li.dangerous_since))
    return flags


def deed_fraud_notice() -> dict[str, Any]:
    return {
        "id": "deed_fraud",
        "text": wording.DEED_FRAUD_NOTICE,
        "routes": ["fraud_guard"],
        "links": [wording.DEED_FRAUD_CHECK],
    }


def shows_deed_fraud_notice(facts: OwnerFacts, flags: list[dict[str, Any]]) -> bool:
    """ETHICS.md: any dossier showing an individual owner flag also shows the deed fraud notice.
    Here: the owner is a person, or a name may be an estate, and the owner has a flag."""
    person = facts.owner_type.type == "individual" or (facts.private and facts.possible_estate)
    return person and bool(flags)
