"""The owner flags of one parcel (docs/ETHICS.md, "Owner information").

Every flag has the three parts ETHICS.md asks for: what it means (`text`), why to be careful
(`careful`) and a protective next step (`next_step`). The careful note and the next step are the
same for every parcel with that flag, so they live once in `FLAG_NOTES` (published once, in
dossiers/common.json, docs/CONTRACTS.md section 6), together with the routes, links and sources
behind the flag.
What differs from parcel to parcel travels with the parcel:

    {"id": "absentee",
     "text": "The owner gets mail somewhere else: Cherry Hill, NJ (out of state).",
     "data": {"scope": "out_of_state", "place": "Cherry Hill, NJ"}}

`full_flag` puts the two halves back together.

Which owners get which flags:

* every owner: tax debt as of July 2025, past sheriff sales, fast resales, open violations,
  unsafe, imminently dangerous;
* private owners only (a person, a company, a nonprofit, or a name we could not type): absentee,
  possible estate, years since the last sale, many vacant parcels. Public bodies get mail at their
  offices, do not die, and are not bought and sold like homes, and their holdings are listed by the
  City itself.

A dossier whose private owner has any flag also carries `help` (the Tangled Title Fund and Fraud
Guard routes: ETHICS.md puts "Fraud Guard and Tangled Title links on every flagged dossier"), and
one whose owner is a person, or may be an estate, carries the deed fraud notice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from placekeepers.derive import wording
from placekeepers.derive.owners import Absentee, OwnerType
from placekeepers.derive.transfers import LastSale, Resales, Transfer

#: "many" vacant parcels: an owner with at least this many gets the flag
MANY_PARCELS_MIN = 5
HELP_ROUTES = ["tangled_title_help", "fraud_guard"]


def _notes(
    careful: str,
    next_step: str,
    sources: list[str],
    routes: list[str] | None = None,
    links: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    notes: dict[str, Any] = {"careful": careful, "next_step": next_step}
    if routes:
        notes["routes"] = routes
    if links:
        notes["links"] = links
    notes["sources"] = sources
    return notes


#: The parts of each flag that are the same for every parcel, in the order flags are listed.
FLAG_NOTES: dict[str, dict[str, Any]] = {
    "absentee": _notes(
        wording.ABSENTEE_CAREFUL,
        wording.ABSENTEE_NEXT_STEP,
        ["opa_properties"],
        routes=["ask_the_owner"],
    ),
    "possible_estate": _notes(
        wording.ESTATE_CAREFUL,
        wording.ESTATE_NEXT_STEP,
        ["opa_properties"],
        routes=["tangled_title_help", "fraud_guard"],
    ),
    "tax_debt_2025": _notes(
        wording.TAX_CAREFUL,
        wording.TAX_NEXT_STEP,
        ["cagp_tax_2025"],
        links=[wording.TAX_CENTER, wording.SHERIFF_SALE_GUIDE],
    ),
    "sheriff_sales": _notes(
        wording.SHERIFF_CAREFUL,
        wording.SHERIFF_NEXT_STEP,
        ["real_estate_transfers"],
        links=[wording.SHERIFF_SALE_GUIDE, wording.GJLI],
    ),
    "years_since_sale": _notes(
        wording.SALE_CAREFUL,
        wording.SALE_NEXT_STEP,
        ["real_estate_transfers", "opa_properties"],
        routes=["tangled_title_help"],
    ),
    "many_parcels": _notes(
        wording.MANY_CAREFUL,
        wording.MANY_NEXT_STEP,
        ["opa_properties"],
        routes=["ask_the_owner"],
    ),
    "fast_resales": _notes(
        wording.RESALE_CAREFUL,
        wording.RESALE_NEXT_STEP,
        ["real_estate_transfers"],
        routes=["fraud_guard"],
    ),
    "open_violations": _notes(
        wording.VIOLATIONS_CAREFUL,
        wording.VIOLATIONS_NEXT_STEP,
        ["li_violations"],
        routes=["report_to_311"],
    ),
    "unsafe": _notes(
        wording.UNSAFE_CAREFUL,
        wording.UNSAFE_NEXT_STEP,
        ["li_unsafe"],
        routes=["report_to_311"],
    ),
    "imminently_dangerous": _notes(
        wording.DANGEROUS_CAREFUL,
        wording.DANGEROUS_NEXT_STEP,
        ["li_imminently_dangerous"],
        routes=["report_to_311"],
    ),
}
FLAG_IDS = tuple(FLAG_NOTES)

#: Notices shown beside the flags, by id.
NOTICES: dict[str, dict[str, Any]] = {
    "deed_fraud": {
        "text": wording.DEED_FRAUD_NOTICE,
        "routes": ["fraud_guard"],
        "links": [wording.DEED_FRAUD_CHECK],
    },
}


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


def make_flag(flag_id: str, text: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    """The part of a flag that belongs to one parcel."""
    if flag_id not in FLAG_NOTES:
        raise ValueError(f"unknown flag {flag_id!r}")
    flag: dict[str, Any] = {"id": flag_id, "text": text}
    if data:
        flag["data"] = data
    return flag


def full_flag(flag: dict[str, Any]) -> dict[str, Any]:
    """A parcel's flag with its shared notes: id, text, careful, next_step, routes, links,
    sources and data."""
    notes = FLAG_NOTES[flag["id"]]
    out = {"id": flag["id"], "text": flag["text"], **notes}
    if "data" in flag:
        out["data"] = flag["data"]
    return out


def absentee_flag(found: Absentee) -> dict[str, Any]:
    data: dict[str, Any] = {"scope": found.scope}
    if found.scope in {"out_of_state", "outside_city"} and (found.city or found.state):
        parts = [wording.place_name(found.city) if found.city else None, found.state]
        data["place"] = ", ".join(part for part in parts if part)
    return make_flag("absentee", found.text, data)


def estate_flag() -> dict[str, Any]:
    return make_flag("possible_estate", wording.ESTATE_TEXT)


def tax_flag(tax: TaxDebt) -> dict[str, Any]:
    data: dict[str, Any] = {
        "as_of": wording.TAX_SNAPSHOT_DATE.isoformat(),
        "total_due": round(tax.total_due),
    }
    if tax.years:
        data["years"] = tax.years
    return make_flag("tax_debt_2025", wording.tax_text(tax.total_due, tax.years), data)


def sheriff_flag(sales: list[Transfer]) -> dict[str, Any]:
    return make_flag(
        "sheriff_sales",
        wording.sheriff_text([(t.date, t.price) for t in sales]),
        {
            "sales": [
                {"date": t.date.isoformat(), "price": None if t.price is None else round(t.price)}
                for t in sales
            ]
        },
    )


def sale_flag(found: LastSale) -> dict[str, Any]:
    if found.known:
        data: dict[str, Any] = {"year": found.year}
        if found.date:
            data["date"] = found.date.isoformat()
        if found.price is not None:
            data["price"] = round(found.price)
        if found.source == "opa":
            # From the assessor's record rather than the City's deed records.
            data["source"] = "opa_properties"
        return make_flag("years_since_sale", wording.last_sale_text(found.year), data)
    return make_flag(
        "years_since_sale", wording.no_sale_text(found.year), {"year": found.year, "sold": False}
    )


def many_parcels_flag(count: int, list_id: str | None) -> dict[str, Any]:
    data: dict[str, Any] = {"count": count}
    if list_id:
        data["list"] = list_id
    return make_flag("many_parcels", wording.many_parcels_text(count), data)


def resale_flag(found: Resales) -> dict[str, Any]:
    return make_flag(
        "fast_resales",
        wording.resale_text(found.count, found.first, found.last, found.recent),
        {"count": found.count, "dates": [day.isoformat() for day in found.dates]},
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
        data,
    )


def unsafe_flag(since: date | None) -> dict[str, Any]:
    data = {"since": since.isoformat()} if since else None
    return make_flag("unsafe", wording.unsafe_text(since), data)


def dangerous_flag(since: date | None) -> dict[str, Any]:
    data = {"since": since.isoformat()} if since else None
    return make_flag("imminently_dangerous", wording.dangerous_text(since), data)


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
        flags.append(sale_flag(facts.last_sale))
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


def shows_deed_fraud_notice(facts: OwnerFacts, flags: list[dict[str, Any]]) -> bool:
    """ETHICS.md: any dossier showing an individual owner flag also shows the deed fraud notice.
    Here: the owner is a person, or a name may be an estate, and the owner has a flag."""
    person = facts.owner_type.type == "individual" or (facts.private and facts.possible_estate)
    return person and bool(flags)
