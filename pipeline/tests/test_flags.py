"""Every owner flag from realistic, invented facts: what it says, when it shows, and for whom."""

from __future__ import annotations

from datetime import date

import pytest

from placekeepers.derive import owners as ow
from placekeepers.derive import transfers as tr
from placekeepers.derive.flags import (
    ABOUT_THE_OWNER,
    FLAG_IDS,
    FLAG_NOTES,
    MANY_PARCELS_MIN,
    NOTICES,
    LiSummary,
    OwnerFacts,
    TaxDebt,
    full_flag,
    owner_flags,
    shows_deed_fraud_notice,
)

AS_OF = date(2026, 10, 4)


def person(*names: str, agency: str | None = None, called_vacant: bool = True) -> OwnerFacts:
    """An owner's facts on a parcel we call vacant (unless `called_vacant` is False)."""
    names = names or ("MORALES ROSA",)
    return OwnerFacts(
        owner_type=ow.owner_type(list(names), agency),
        has_names=True,
        possible_estate=ow.possible_estate(list(names)),
        called_vacant=called_vacant,
    )


def deed(day: str, kind: str = "DEED", price: float | None = 40000) -> tr.Transfer:
    return tr.Transfer(None, date.fromisoformat(day), kind, price, ("A",), ("B",))


def by_id(flags: list[dict]) -> dict[str, dict]:
    return {flag["id"]: flag for flag in flags}


def test_absentee_names_the_place_and_the_scope() -> None:
    facts = person()
    facts.absentee = ow.absentee("237 SIGEL ST", "41 ORCHARD RD", "CHERRY HILL NJ", "08002")
    [flag] = owner_flags(facts, AS_OF)
    assert flag == {
        "id": "absentee",
        "text": "The owner gets mail somewhere else: Cherry Hill, NJ (out of state).",
        "data": {"scope": "out_of_state", "place": "Cherry Hill, NJ"},
    }
    full = full_flag(flag)
    assert full["routes"] == ["ask_the_owner"]
    assert full["sources"] == ["opa_properties"]
    assert {"careful", "next_step"} <= set(full)


def test_possible_estate_reads_only_the_ethics_text() -> None:
    facts = person("BOWMAN LEROY", "BOWMAN EVELYN ESTATE OF")
    facts.possible_estate = ow.possible_estate(["BOWMAN LEROY", "BOWMAN EVELYN ESTATE OF"])
    [flag] = owner_flags(facts, AS_OF)
    full = full_flag(flag)
    assert " ".join([full["text"], full["careful"], full["next_step"]]) == (
        "The owner of record may have died. Family members may still have a right to this "
        "property and may not know it. If you know the family, the Tangled Title Fund (up to "
        "$6,500 in legal help) and Philadelphia VIP can help them keep it. Families can also sign "
        "up for the City's free Fraud Guard alerts."
    )
    assert full["routes"] == ["tangled_title_help", "fraud_guard"]
    assert "data" not in flag


def test_tax_debt_always_carries_its_date_and_the_tax_center() -> None:
    facts = person()
    facts.tax = TaxDebt(total_due=35197.72, years=42)
    [flag] = owner_flags(facts, AS_OF)
    assert flag["text"] == (
        "As of July 2025, City records showed $35,198 in unpaid real estate taxes from 42 tax "
        "years."
    )
    assert flag["data"] == {"as_of": "2025-07-09", "total_due": 35198, "years": 42}
    full = full_flag(flag)
    assert "July 9, 2025" in full["careful"]
    assert "Tax Center" in full["next_step"]
    assert {
        "label": "City of Philadelphia Tax Center",
        "url": "https://tax-services.phila.gov/",
    } in (full["links"])
    one = person()
    one.tax = TaxDebt(total_due=109.4, years=1)
    assert owner_flags(one, AS_OF)[0]["text"].endswith(
        "$109 in unpaid real estate taxes from 1 tax year."
    )
    paid = person()
    paid.tax = TaxDebt(total_due=0, years=None)
    assert owner_flags(paid, AS_OF) == []


def test_past_sheriff_sales_list_each_date_and_price() -> None:
    facts = person()
    facts.history = tr.deeds(
        [
            deed("2026-05-20", "SHERIFF'S DEED", 6600),
            deed("2006-09-21", "DEED SHERIFF", 4100),
            deed("2015-12-17", "DEED SHERIFF", 1600),
        ]
    )
    flags = by_id(owner_flags(facts, AS_OF))
    assert flags["sheriff_sales"]["text"] == (
        "Sold at sheriff sale 3 times: September 21, 2006, for $4,100; December 17, 2015, for "
        "$1,600; and May 20, 2026, for $6,600."
    )
    assert flags["sheriff_sales"]["data"]["sales"] == [
        {"date": "2006-09-21", "price": 4100},
        {"date": "2015-12-17", "price": 1600},
        {"date": "2026-05-20", "price": 6600},
    ]
    single = person()
    single.history = tr.deeds([deed("2017-03-08", "DEED SHERIFF", 2200)])
    assert by_id(owner_flags(single, AS_OF))["sheriff_sales"]["text"] == (
        "Sold at sheriff sale on March 8, 2017, for $2,200."
    )


def test_years_since_the_last_sale() -> None:
    facts = person()
    facts.last_sale = tr.last_sale([], date(1987, 6, 12), 15000, AS_OF)
    [flag] = owner_flags(facts, AS_OF)
    assert flag["text"] == "Last sold in 1987."
    assert flag["data"] == {
        "year": 1987,
        "date": "1987-06-12",
        "price": 15000,
        "source": "opa_properties",
    }
    never = person()
    never.last_sale = tr.last_sale([], date(1985, 3, 1), 1, AS_OF)
    assert (
        owner_flags(never, AS_OF)[0]["text"] == "Not sold on the open market since at least 1985."
    )


def test_many_vacant_parcels_from_five() -> None:
    facts = person("KENSINGTON LOTS LLC")
    facts.holdings = 41
    facts.holdings_list = "abc123def456"
    [flag] = owner_flags(facts, AS_OF)
    assert flag["text"] == "This owner holds 41 vacant parcels in the city."
    assert flag["data"] == {"count": 41, "list": "abc123def456"}
    few = person("KENSINGTON LOTS LLC")
    few.holdings = MANY_PARCELS_MIN - 1
    assert owner_flags(few, AS_OF) == []


def test_fast_resales() -> None:
    facts = person("KENSINGTON LOTS LLC")
    facts.resales = tr.fast_resales(
        tr.deeds([deed("2024-02-01"), deed("2025-01-15", price=61000), deed("2026-03-03")]),
        AS_OF,
    )
    [flag] = owner_flags(facts, AS_OF)
    assert flag["text"] == "Sold 3 times since 2024."
    assert flag["data"] == {"count": 3, "dates": ["2024-02-01", "2025-01-15", "2026-03-03"]}


def test_open_violations_unsafe_and_imminently_dangerous() -> None:
    facts = person()
    facts.li = LiSummary(
        open_violations=3,
        last_violation=date(2025, 8, 1),
        last_open=date(2025, 8, 1),
        last_open_title="EXTERIOR AREA WEEDS",
        violations=7,
        unsafe_since=date(2024, 3, 3),
        dangerous_since=date(2026, 9, 30),
    )
    flags = by_id(owner_flags(facts, AS_OF))
    assert flags["open_violations"]["text"] == (
        "L&I lists 3 open violations. The most recent, from August 1, 2025, is for exterior area "
        "weeds."
    )
    assert flags["open_violations"]["data"] == {
        "count": 3,
        "last": "2025-08-01",
        "title": "EXTERIOR AREA WEEDS",
    }
    assert flags["unsafe"]["text"] == "L&I lists this building as unsafe, since March 3, 2024."
    assert flags["imminently_dangerous"]["text"] == (
        "L&I lists this building as imminently dangerous, since September 30, 2026."
    )
    one = person()
    one.li = LiSummary(open_violations=1, last_open=date(2022, 5, 13), last_open_title="RUBBISH")
    assert owner_flags(one, AS_OF)[0]["text"] == (
        "L&I lists 1 open violation, for rubbish, from May 13, 2022."
    )


def all_facts(*names: str, agency: str | None = None, called_vacant: bool = True) -> OwnerFacts:
    facts = person(*names, agency=agency, called_vacant=called_vacant)
    facts.absentee = ow.Absentee("out_of_state", "CHERRY HILL", "NJ")
    facts.possible_estate = True
    facts.tax = TaxDebt(1200, 2)
    facts.history = tr.deeds([deed("2016-08-09", "SHERIFF'S DEED", 12300)])
    facts.last_sale = tr.LastSale(2004, True, date(2004, 5, 17), 48000, "transfers")
    facts.holdings = 6
    facts.resales = tr.Resales(2, date(2025, 1, 1), date(2025, 6, 1), True, [])
    facts.li = LiSummary(open_violations=1, unsafe_since=date(2024, 1, 1))
    return facts


def test_flags_come_in_one_order() -> None:
    ids = [flag["id"] for flag in owner_flags(all_facts(), AS_OF)]
    assert ids == [i for i in FLAG_IDS if i != "imminently_dangerous"]


def test_public_owners_get_only_the_flags_about_the_property() -> None:
    facts = all_facts("PHILADELPHIA LAND BANK", agency="PLB")
    ids = [flag["id"] for flag in owner_flags(facts, AS_OF)]
    assert ids == ["tax_debt_2025", "sheriff_sales", "fast_resales", "open_violations", "unsafe"]
    assert not shows_deed_fraud_notice(facts)


def test_the_deed_fraud_notice_goes_with_every_owner_who_may_be_a_person() -> None:
    # Decided 2026-10-04 by the orchestrator: whenever the owner may be a person, flags or not.
    facts = person()
    facts.tax = TaxDebt(500, 1)
    assert shows_deed_fraud_notice(facts)
    assert shows_deed_fraud_notice(person())  # no flag at all
    assert shows_deed_fraud_notice(person("HACE"))  # a name we could not type
    company = person("KENSINGTON LOTS LLC")
    company.tax = TaxDebt(500, 1)
    assert not shows_deed_fraud_notice(company)
    trust_estate = person("HARTMAN ELEANOR M T/U/W", "MC GINLEY SOPHIE L DEC'D")
    trust_estate.possible_estate = True
    assert shows_deed_fraud_notice(trust_estate)
    notice = NOTICES["deed_fraud"]
    assert "Fraud Guard" in notice["text"] and "November 2025" in notice["text"]
    assert notice["routes"] == ["fraud_guard"]


PARCEL_FACTS = ["sheriff_sales", "years_since_sale", "fast_resales", "open_violations", "unsafe"]


@pytest.mark.parametrize(
    "names",
    [
        ("MORALES ROSA",),  # a person
        ("HACE",),  # a name we could not type
        ("RIVERSIDE BANK AND TRUST CO", "MCLAREN NIKKI ESTATE OF"),  # a bank and an estate
    ],
)
def test_flags_about_an_owner_who_may_be_a_person_wait_for_a_vacancy_call(names) -> None:
    # docs/VERIFICATION.md D5 and D6: a parcel we do not call vacant with high or medium
    # confidence may be someone's home, so the flags about the owner are held back; the facts
    # about the parcel stay, and so does the deed fraud notice when the owner is a person.
    home = all_facts(*names, called_vacant=False)
    assert home.person_like
    shown = owner_flags(home, AS_OF)
    assert [flag["id"] for flag in shown] == PARCEL_FACTS
    assert not set(ABOUT_THE_OWNER) & {flag["id"] for flag in shown}
    assert shows_deed_fraud_notice(home)
    vacant = all_facts(*names)
    assert set(ABOUT_THE_OWNER) <= {flag["id"] for flag in owner_flags(vacant, AS_OF)}


def test_organizations_keep_every_flag_on_any_parcel() -> None:
    for names in (("KENSINGTON LOTS LLC",), ("GRACE BAPTIST CHURCH",)):
        facts = all_facts(*names, called_vacant=False)
        facts.possible_estate = False
        assert not facts.person_like
        ids = [flag["id"] for flag in owner_flags(facts, AS_OF)]
        assert ids == [
            "absentee",
            "tax_debt_2025",
            "sheriff_sales",
            "years_since_sale",
            "many_parcels",
            "fast_resales",
            "open_violations",
            "unsafe",
        ]


def test_possible_estate_never_with_a_homestead_exemption() -> None:
    facts = all_facts()
    facts.homestead = True
    ids = [flag["id"] for flag in owner_flags(facts, AS_OF)]
    assert "possible_estate" not in ids
    # The other flags about the owner of a parcel we call vacant stay.
    assert {"absentee", "tax_debt_2025", "many_parcels"} <= set(ids)
    assert shows_deed_fraud_notice(facts)


def test_the_deed_fraud_notice_stays_where_the_flags_are_held_back() -> None:
    # A parcel that may be someone's home keeps the notice: it protects the family living there
    # and says nothing about the owner.
    home = person(called_vacant=False)
    home.tax = TaxDebt(500, 1)
    assert owner_flags(home, AS_OF) == []
    assert shows_deed_fraud_notice(home)


@pytest.mark.parametrize("flag_id", FLAG_IDS)
def test_every_flag_has_three_parts_and_its_sources(flag_id: str) -> None:
    notes = FLAG_NOTES[flag_id]
    assert notes["careful"].strip() and notes["next_step"].strip()
    assert notes["sources"]
    assert set(notes) <= {"careful", "next_step", "routes", "links", "sources"}
