"""Every sentence the owner flags, the deed fraud notice and the owner type reasons show to people.

All reader facing wording of milestone M1.3 lives here, so it can be reviewed in one place and
checked against docs/ETHICS.md by the tests (tests/test_wording.py). The rules:

* Every flag has three parts: what it means (`text`), why to be careful (`careful`), and a
  protective next step (`next_step`).
* Where ETHICS.md gives wording, it is used word for word: the whole possible estate text, "The
  owner gets mail somewhere else" with the place, "Last sold in 1987", "This owner holds 41 vacant
  parcels in the city" and "Sold 3 times since 2024". The conservatorship warning lives with its
  route in registry/routes.yaml.
* Never "owner deceased" or "no heirs", nothing about police, and no dashes as punctuation.
* Tax debt always carries its date, July 2025, and a link to the City's Tax Center.
"""

from __future__ import annotations

import calendar
from datetime import date

# Links named by several flags. Each was checked on 2026-10-04 (docs/research/05).
TAX_CENTER = {"label": "City of Philadelphia Tax Center", "url": "https://tax-services.phila.gov/"}
SHERIFF_SALE_GUIDE = {
    "label": "Grounded in Philly: sheriff sales",
    "url": "https://groundedinphilly.org/sheriff-sale/",
}
GJLI = {
    "label": "Garden Justice Legal Initiative",
    "url": "https://www.pubintlaw.org/cases-and-advocacy/garden-justice-legal-initiative/",
}
DEED_FRAUD_CHECK = {
    "label": "City of Philadelphia: the automated check that stops deed fraud",
    "url": "https://www.phila.gov/2025-11-10-philadelphia-launches-new-tool-to-stop-deed-fraud/",
}


# Formatting
def money(amount: float) -> str:
    """$35,198: whole dollars with thousands separators."""
    return f"${round(amount):,}"


def long_date(day: date) -> str:
    """May 14, 2019."""
    return f"{calendar.month_name[day.month]} {day.day}, {day.year}"


def plural(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def join_and(items: list[str]) -> str:
    """'a', 'a and b', 'a, b and c'."""
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


SMALL_WORDS = {"OF", "THE", "AND", "ON", "IN", "AT", "BY", "DE", "LA", "DEL"}


def place_name(city: str) -> str:
    """BLUE BELL becomes Blue Bell; KING OF PRUSSIA becomes King of Prussia."""
    words = city.split()
    out = []
    for index, word in enumerate(words):
        if index and word in SMALL_WORDS:
            out.append(word.lower())
        else:
            out.append(word[:1] + word[1:].lower())
    return " ".join(out)


# Absentee owner
ABSENTEE_TEXT = "The owner gets mail somewhere else"
ABSENTEE_CAREFUL = (
    "This is the address where the City sends tax bills. It can be out of date, or belong to a "
    "relative, a lawyer or a manager, and an owner who lives elsewhere may not know how the "
    "property looks today."
)
ABSENTEE_NEXT_STEP = (
    "Write to the owner at this address to ask before you do anything on the property, and ask "
    "the Garden Justice Legal Initiative to review any agreement before you sign it."
)


def absentee_text(scope: str, city: str | None, state: str | None) -> str:
    """ "The owner gets mail somewhere else" with the place, as ETHICS.md asks."""
    if scope == "out_of_state":
        where = ", ".join(part for part in (city and place_name(city), state) if part)
        return (
            f"{ABSENTEE_TEXT}: {where} (out of state)."
            if where
            else (f"{ABSENTEE_TEXT}: outside Pennsylvania.")
        )
    if scope == "outside_city":
        if city:
            return f"{ABSENTEE_TEXT}: {place_name(city)}, PA (outside Philadelphia)."
        return f"{ABSENTEE_TEXT}: outside Philadelphia."
    if scope == "po_box_in_city":
        return f"{ABSENTEE_TEXT}: a post office box in Philadelphia."
    return f"{ABSENTEE_TEXT}: another address in Philadelphia."


# Possible estate: docs/ETHICS.md, word for word, in three parts.
ESTATE_TEXT = "The owner of record may have died."
ESTATE_CAREFUL = "Family members may still have a right to this property and may not know it."
ESTATE_NEXT_STEP = (
    "If you know the family, the Tangled Title Fund (up to $6,500 in legal help) and Philadelphia "
    "VIP can help them keep it. Families can also sign up for the City's free Fraud Guard alerts."
)


# Tax debt as of July 2025
TAX_SNAPSHOT_DATE = date(2025, 7, 9)
TAX_CAREFUL = (
    "This is the last public record, from July 9, 2025, not today's balance: the owner may have "
    "paid since, or owe more. About three or more years of unpaid taxes can lead to a sheriff "
    "sale, where a lot neighbors care for can be sold to an outside buyer."
)
TAX_NEXT_STEP = (
    "Check today's balance on the City's Tax Center before you rely on this. If your block cares "
    "for this lot, Grounded in Philly's guide to sheriff sales explains the risk and what you "
    "can do."
)


def tax_text(total_due: float, years: int | None) -> str:
    text = f"As of July 2025, City records showed {money(total_due)} in unpaid real estate taxes"
    if years:
        text += f" from {plural(years, 'tax year', 'tax years')}"
    return text + "."


# Past sheriff sales
SHERIFF_CAREFUL = (
    "At a sheriff sale the winning bid clears old debts on the property, so a lot neighbors have "
    "cared for can pass to an outside buyer. A past sale does not mean the property is for sale "
    "now."
)
SHERIFF_NEXT_STEP = (
    "If your block cares for this lot, read Grounded in Philly's guide to sheriff sales and ask "
    "the Garden Justice Legal Initiative for free legal help."
)


def sheriff_text(sales: list[tuple[date, float | None]]) -> str:
    def one(day: date, price: float | None) -> str:
        return long_date(day) + (f" for {money(price)}" if price else "")

    if len(sales) == 1:
        return f"Sold at sheriff sale on {one(*sales[0])}."
    listed = join_and([one(day, price) for day, price in sales])
    return f"Sold at sheriff sale {len(sales)} times: {listed}."


# Years since the last sale
SALE_CAREFUL = (
    "Sales for a token price and sheriff sales are left out here; the full history is below. "
    "Many homes pass down in families without a new sale, so a long time since a sale does not "
    "mean the owner has given the property up."
)
SALE_NEXT_STEP = (
    "If a family has inherited the property without a new deed, the Tangled Title Fund and "
    "Philadelphia VIP can help them clear the title and keep it."
)


def last_sale_text(year: int) -> str:
    return f"Last sold in {year}."


def no_sale_text(since_year: int) -> str:
    return f"Not sold for a price since at least {since_year}."


# Owner holds many vacant parcels
MANY_CAREFUL = (
    "We match owners by their exact name in City records, so one owner can appear under several "
    "spellings and two owners can share a name. Holding vacant land is not wrongdoing by itself."
)
MANY_NEXT_STEP = (
    "Use the list to see this owner's other parcels, then ask permission the lawful way: write to "
    "the owner, and have the Garden Justice Legal Initiative review any agreement."
)


def many_parcels_text(count: int) -> str:
    return f"This owner holds {count} vacant parcels in the city."


# Fast resales
RESALE_CAREFUL = (
    "Quick resales can mean investors trading the property, and sometimes a forged deed. They can "
    "also be ordinary, such as an estate sale followed by a renovation sale."
)
RESALE_NEXT_STEP = (
    "Look at who sold and who bought in the history below. Owners and families can sign up for "
    "the City's free Fraud Guard alerts to learn when a document names them."
)


def resale_text(count: int, first: date, last: date, recent: bool) -> str:
    if recent:
        return f"Sold {count} times since {first.year}."
    if first.year == last.year:
        return f"Sold {count} times in {first.year}."
    return f"Sold {count} times from {first.year} to {last.year}."


# Open L&I violations, unsafe and imminently dangerous buildings
VIOLATIONS_CAREFUL = (
    "A violation is a notice to the owner, who may not have the means to fix it, and the "
    "condition may have changed since the inspection."
)
VIOLATIONS_NEXT_STEP = (
    "Report physical problems, such as dumping or an open building, to Philly311. If you know the "
    "owner, let them know: they may not have seen the notice."
)


def violations_text(count: int, last: date | None, title: str | None) -> str:
    what = f" for {title.lower()}" if title else ""
    if count == 1:
        when = f", from {long_date(last)}" if last else ""
        return f"L&I lists 1 open violation{when}{what}."
    text = f"L&I lists {count} open violations."
    if last and title:
        text += f" The most recent, from {long_date(last)}, is{what}."
    elif last:
        text += f" The most recent is from {long_date(last)}."
    return text


UNSAFE_CAREFUL = (
    "Keep out and keep children away: L&I found the structure unsafe. Do not enter it or try to "
    "secure it yourself."
)
UNSAFE_NEXT_STEP = "If it is open to entry, report it to Philly311 so the City can seal it."
DANGEROUS_CAREFUL = (
    "L&I found the structure could fail at any time. Keep away from it, and keep others away."
)
DANGEROUS_NEXT_STEP = "Report any change, such as falling bricks or an open door, to Philly311."


def unsafe_text(since: date | None) -> str:
    return "L&I lists this building as unsafe" + (f", since {long_date(since)}." if since else ".")


def dangerous_text(since: date | None) -> str:
    return "L&I lists this building as imminently dangerous" + (
        f", since {long_date(since)}." if since else "."
    )


# The deed fraud notice (ETHICS.md: shown on any dossier with an individual owner flag)
DEED_FRAUD_NOTICE = (
    "Deed theft happens when someone files a fake deed to take a property, often one whose owner "
    "has died or lives elsewhere. Owners and families can sign up for the City's free Fraud Guard "
    "alerts, which send an email when a document naming them is recorded. Since November 2025 the "
    "City also automatically blocks deeds whose seller had already died when they supposedly "
    "signed."
)


# Why we gave the owner type
AGENCY_NAMES = {
    "PUB": "the City of Philadelphia",
    "PLB": "the Philadelphia Land Bank",
    "PRA": "the Philadelphia Redevelopment Authority",
    "PHDC": "the Philadelphia Housing Development Corporation (PHDC)",
}
AGENCY_CONTACT = {"PUB": "the Land Bank", "PLB": "the Land Bank", "PRA": "PHDC", "PHDC": "PHDC"}

# Abbreviations explained when an owner name is typed by one of them.
MARKER_NOTES = {
    "TR": "TR, short for trustee",
    "TRS": "TRS, short for trustees",
    "TRST": "TRST, short for trust",
    "T U W": "T/U/W, a trust set up by a will",
    "FBO": "FBO, for the benefit of",
    "CO": "CO, short for company",
    "LP": "LP, a limited partnership",
    "LLP": "LLP, a limited liability partnership",
    "LTD": "LTD, short for limited",
    "LL": "LL, a shortened LLC",
    "GP": "GP, a general partner",
    "N A": "N A, a national bank",
    "FB": "FB, a shortened FBO",
    "CDC": "CDC, a community development corporation",
}


def agency_reason(agency: str, conflict: bool) -> str:
    text = f"The City's list of public property names {AGENCY_NAMES[agency]} as the owner."
    if conflict:
        text += (
            " City property records name a different owner, so ask "
            f"{AGENCY_CONTACT[agency]} which is current."
        )
    return text


def public_name_reason(label: str) -> str:
    return f"City records name {label} as the owner."


def marker_reason(marker: str) -> str:
    return f'The owner name includes "{MARKER_NOTES.get(marker, marker)}".'


INDIVIDUAL_REASON = "The owner name looks like a person's name."
NO_NAME_REASON = "City records give no owner name."
UNCLEAR_REASON = "We could not tell what kind of owner this is from the name."
