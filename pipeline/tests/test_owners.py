"""Owner types, possible estates, absentee owners and the owner matching key.

Every person's name here is invented; the company and agency names follow the forms OPA uses
(owner_1 and owner_2, cut at 25 characters in older records)."""

from __future__ import annotations

import pytest

from placekeepers.derive import owners as ow


def kind(*names: str | None, agency: str | None = None) -> str:
    return ow.owner_type([n for n in names if n], agency).type


@pytest.mark.parametrize(
    ("names", "expected"),
    [
        # People, as OPA writes them: last name first, sometimes first name first, with suffixes.
        (["MORALES ROSA"], "individual"),
        (["DELACRUZ-WHITFIELD ANNETTE M"], "individual"),
        (["O'BRIEN PATRICK J JR"], "individual"),
        (["TRAN HUNG", "NGUYEN LAN T"], "individual"),
        (["VIOLETTA STEWART"], "individual"),
        (["HOLLIS CHARLES H 3RD"], "individual"),
        (["SMALLWOOD JAMES E 03RD"], "individual"),
        (["KRAMER EDITH 1/2 INT", "KRAMER LOUIS 1/2 INT"], "individual"),
        # Companies: legal forms, including names OPA cut short.
        (["2455 N 30TH ST LLC"], "company"),
        (["NORTHERN LIBERTIES L.L.C."], "company"),
        (["RIVERWARD LOTUS 02A LL"], "company"),
        (["4903 FRANKFORD AVENUE GP"], "company"),
        (["ALLEGHENY 2 HOUSING LTD", "A PA LTD PARTNERSHIP"], "company"),
        (["RESOURCES FOR HUMAN", "DEV INC"], "company"),
        (["RTAYLORD CO"], "company"),
        (["SIR COTTON ESTATE PROPERT"], "company"),
        (["Z ESTATE GROUP LLC"], "company"),
        (["JSA PHILADELPHIA REAL EST"], "company"),
        (["WYNNEFIELD ESTATES"], "company"),
        (["CAMAPLAN ADMINISTRATOR FB"], "company"),
        (["EQUITY TRUST CO CUSTODIAN FBO RUTH ADAMS IRA"], "company"),
        (["HERNANDEZ RITA TR"], "company"),
        (["ALIA RIVERA FAMILY TRUST"], "company"),
        (["HARTMAN ELEANOR M T/U/W"], "company"),
        (["CITIBANK N A"], "company"),
        (["CONRAIL"], "company"),
        (["UNIVERSITY CITY HOUSING A"], "company"),
        # Nonprofits only when the name says so; a church LLC is still a company.
        (["GRACE MISSION BAPTIST", "CHURCH"], "nonprofit"),
        (["ROCK MINISTRIES OF PHILADELPHIA INC"], "nonprofit"),
        (["ESPERANZA COMMUNITY LAND TRUST"], "nonprofit"),
        (["NEIGHBORHOOD GARDENS TRUST"], "nonprofit"),
        (["NORRIS SQUARE COMMUNITY DEVELOPMENT CORP"], "nonprofit"),
        (["TEMPLE UNIVERSITY"], "nonprofit"),
        (["CHURCH STREET PARTNERS LLC"], "company"),
        # Public bodies, by name.
        (["PHILADELPHIA LAND BANK"], "land_bank"),
        (["REDEVELOPMENT AUTHORITY", "OF PHILADELPHIA"], "redevelopment_authority"),
        (["PHILADELPHIA REDEVELOPMEN"], "redevelopment_authority"),
        (["PHILA REDEVELOPMENT", "AUTHORITY"], "redevelopment_authority"),
        (["PHILADELPHIA HOUSING AUTH"], "housing_authority"),
        (["PHILA HOUSING AUTHORITY"], "housing_authority"),
        (["PHILADELPHIA HOUSING", "DEVELOPMENT CORPORATION"], "other_public"),
        (["PHILADELPHIA HOUSING"], "other_public"),
        (["CITY OF PHILA", "DEPT OF PUBLIC PROP"], "city"),
        (["FAIRMOUNT PARK COMM"], "city"),
        (["SCHOOL DISTRICT OF PHILA"], "other_public"),
        (["PHILADELPHIA SCHOOL DISTRICT"], "other_public"),
        (["COMMUNITY COLLEGE OF PHIL"], "other_public"),
        # Schools are organizations (decided 2026-10-04), including names OPA cut short; a school
        # company is still a company, and an address that names a school house is not a school.
        (["ILADELPHIA CHARTER SCHOOL"], "nonprofit"),
        (["FRANKLIN TOWNE CHARTER HI"], "nonprofit"),
        (["KIPP PHILADELPHIA CHARTER"], "nonprofit"),
        (["GERMANTOWN FRIENDS SCHOOL"], "nonprofit"),
        (["CORNERSTONE CHRISTIAN ACADEMY"], "nonprofit"),
        (["LA SALLE COLLEGE"], "nonprofit"),
        (["ST JOSEPH'S PREPARATORY", "SCHOOL"], "nonprofit"),
        (["WOODS CHARTER SCHOOL DEVELOPMENT LLC"], "company"),
        (["CHARTER ADVERTISING", "GROUP INC"], "company"),
        (["ACADEMIC PROPERTIES INC"], "company"),
        (["420 W SCHOOL HOUSE LANE"], "unknown"),
        (["SEPTA"], "other_public"),
        (["COMMONWEALTH OF PENNSYLVA", "DEPARTMENT OF TRANSPORTAT"], "other_public"),
        (["SECRETARY OF HOUSING AND"], "other_public"),
        (["ADMINISTRATOR VET AFFA"], "other_public"),
        (["P.A.I.D."], "other_public"),
        (["DEL RIVER PORT AUTH"], "other_public"),
        # Not enough to tell.
        (["HACE"], "unknown"),
        (["LSF9 MASTER PARTICIPATON"], "unknown"),
        ([], "unknown"),
    ],
)
def test_owner_type_from_names(names: list[str], expected: str) -> None:
    assert kind(*names) == expected


def test_the_city_owned_layer_decides_first() -> None:
    assert kind("CITY OF PHILA", agency="PLB") == "land_bank"
    assert kind("PHILADELPHIA HOUSING", "DEVELOPMENT CORPORATION", agency="PHDC") == "other_public"
    assert kind("REDEVELOPMENT AUTHORITY", agency="PRA") == "redevelopment_authority"
    assert kind(agency="PUB") == "city"
    # An agency code the layer does not use falls back to the names.
    assert kind("MORALES ROSA", agency="XYZ") == "individual"


def test_a_private_name_on_a_city_owned_parcel_says_to_ask_which_is_current() -> None:
    found = ow.owner_type(["CIVETTA PROPERTY GROUP LLC"], "PLB")
    assert found.type == "land_bank"
    assert found.body == "PLB"
    assert "ask the Land Bank which is current" in found.reason
    plain = ow.owner_type(["PHILADELPHIA LAND BANK"], "PLB")
    assert "different owner" not in plain.reason
    assert "ask PHDC" in ow.owner_type(["MORALES ROSA"], "PRA").reason


def test_owner_type_codes_match_the_contract() -> None:
    assert {name: ow.OWNER_TYPE_CODES[name] for name in ow.OWNER_TYPE_CODES} == {
        "unknown": 0,
        "individual": 1,
        "company": 2,
        "city": 3,
        "land_bank": 4,
        "redevelopment_authority": 5,
        "housing_authority": 6,
        "nonprofit": 7,
        "other_public": 8,
    }
    assert ow.owner_type(["SEPTA"], None).code == 8
    assert ow.owner_type(["PHDC"], None).body == "phdc"


def test_reasons_say_why_in_plain_words() -> None:
    assert ow.owner_type(["2455 N 30TH ST LLC"], None).reason == 'The owner name includes "LLC".'
    assert "short for trustee" in ow.owner_type(["HERNANDEZ RITA TR"], None).reason
    assert (
        ow.owner_type(["MORALES ROSA"], None).reason == "The owner name looks like a person's name."
    )
    assert ow.owner_type([], None).reason == "City records give no owner name."


@pytest.mark.parametrize(
    "names",
    [
        ["GRANT DELORES ESTATE OF"],
        ["ESTATE OF RAYMOND PIERCE KELLAM"],
        ["BOWMAN LEROY", "BOWMAN EVELYN ESTATE OF"],
        ["JOHN WHITTAKER EST"],
        ["LOVELL BERNICE O ESTATE O"],
        ["HIDALGO-RUIZ ANA EST", "DE HIDALGO JUANA"],
        ["SPENCER ALMA HEIRS"],
        ["JAMESON EARL SOLE SURV", "HEIR TO JEAN TAYLOR"],
        ["FOSTER DORIS EXECUTRIX", "ETC"],
        ["ETTA R DEMPSEY", "ADMINISTRATOR"],
        ["DUNCAN FREDERICK", " EXECUTOR OF THE ESTATE OF LUZ CLASS"],
        ["HARTMAN ELEANOR M T/U/W", "MC GINLEY SOPHIE L DEC'D"],
        ["RIVERSIDE BANK AND TRUST CO", "MCLAREN NIKKI ESTATE OF"],
    ],
)
def test_possible_estate_names(names: list[str]) -> None:
    assert ow.possible_estate(names)


@pytest.mark.parametrize(
    "names",
    [
        ["MORALES ROSA"],
        ["Z ESTATE GROUP LLC"],
        ["JSA PHILADELPHIA REAL EST"],
        ["ETHAN1 REAL ESTÀTE LLC"],
        ["WYNNEFIELD ESTATES"],
        ["CAMAPLAN ADMINISTRATOR FBO STANLEY BAILEY"],
        ["LSC ADMINISTRATIVE SERVICES LLC"],
        ["ADMIN OF VET AFFAIRS"],
        ["DENT LOUIS A LIFE ESTATE", "DENT LYDIA LYNDA LIFE EST"],
        ["JOHNSON MARIE LF/EST", "DENT JOSEPHINE SISTER"],
        ["YOUNG CATHERINE LIFE TENANT", "TUCKER LLOYD JR"],
        ["CECELIA FERGUSON", "MARION  OR SURVIVOR"],
        ["THE TRUSTEES OF THE", "EST OF STEPHEN GIRARD"],
        ["TRS EST STEPHEN GIRARD"],
        ["CITY OF PHILA", "REAL EST DIV"],
        ["ESTEBAN ROSARIO"],
    ],
)
def test_names_that_are_not_estates(names: list[str]) -> None:
    assert not ow.possible_estate(names)


@pytest.mark.parametrize(
    ("location", "mailing", "expected"),
    [
        ("1866 BRUNNER ST", "1866 BRUNNER ST", "same"),
        ("6136R TABOR AVE", "6136 TABOR AVE", "same"),
        ("1304-08 E PASSYUNK AVE", "1306 E PASSYUNK AVENUE", "same"),
        ("142 MELVALE ST", "142 E MELVALE ST", "same"),
        ("529 MCCLELLAN ST", "529 MC CLELLAN ST", "same"),
        ("2348 N 3RD ST", "2348 N THIRD STREET", "same"),
        ("2328 EMERALD ST", "2327 EMERALD ST", "same_block"),
        ("3905 N DELHI ST", "3913 DELHI ST UNIT 2", "same_block"),
        ("2919 W LEHIGH AVE", "1227 W LEHIGH AVE", "different"),
        ("2124 N 31ST ST", "1234 MARKET ST 17TH FL", "different"),
        ("259 W ELKHART ST", "PO BOX 4471", "po_box"),
        ("259 W ELKHART ST", None, "unknown"),
        ("7121 SAYBROOK AVE", "18TH & RACE ST", "unknown"),
    ],
)
def test_comparing_the_parcel_and_mailing_addresses(location, mailing, expected) -> None:
    assert ow.compare_addresses(location, mailing) == expected


@pytest.mark.parametrize(
    ("location", "street", "city_state", "zip_code", "scope", "text"),
    [
        (
            "237 SIGEL ST",
            "1806 JEFFERSON DAVIS HWY",
            "RICHMOND VA",
            "23224-7212",
            "out_of_state",
            "The owner gets mail somewhere else: Richmond, VA (out of state).",
        ),
        (
            "1015 S 3RD ST",
            "109 BAY HILL DR",
            "BLUE BELL PA",
            "19422",
            "outside_city",
            "The owner gets mail somewhere else: Blue Bell, PA (outside Philadelphia).",
        ),
        (
            "5718 LUDLOW ST",
            "701 W VALLEY RD",
            "KING OF PRUSSIA PA",
            "19406",
            "outside_city",
            "The owner gets mail somewhere else: King of Prussia, PA (outside Philadelphia).",
        ),
        (
            "2919 W LEHIGH AVE",
            "1227 W LEHIGH AVE",
            "PHILADELPHIA PA",
            "19133",
            "elsewhere_in_city",
            "The owner gets mail somewhere else: another address in Philadelphia.",
        ),
        (
            "2919 W LEHIGH AVE",
            "8400 GERMANTOWN AVE",
            "CHESTNUT HILL PA",
            "19118",
            "elsewhere_in_city",
            "The owner gets mail somewhere else: another address in Philadelphia.",
        ),
        (
            "259 W ELKHART ST",
            "PO BOX 4471",
            "PHILADELPHIA PA",
            "19144",
            "po_box_in_city",
            "The owner gets mail somewhere else: a post office box in Philadelphia.",
        ),
        (
            "88 W QUEEN LN",
            "12 RUE DU BAC",
            "PARIS FRANCE",
            None,
            "out_of_state",
            "The owner gets mail somewhere else: Paris France (out of state).",
        ),
    ],
)
def test_absentee_owners_say_where_they_get_mail(
    location, street, city_state, zip_code, scope, text
) -> None:
    found = ow.absentee(location, street, city_state, zip_code)
    assert found is not None
    assert found.scope == scope
    assert found.text == text
    assert found.text.startswith("The owner gets mail somewhere else")


@pytest.mark.parametrize(
    ("location", "street", "city_state", "zip_code"),
    [
        ("1866 BRUNNER ST", "1866 BRUNNER ST", "PHILADELPHIA PA", "19140"),
        ("2328 EMERALD ST", "2327 EMERALD ST", "PHILADELPHIA PA", "19125"),  # across the street
        ("529 MCCLELLAN ST", "529 MC CLELLAN ST", "PHILADELPHIA PA", "19148-1818"),
        ("259 W ELKHART ST", None, "PHILADELPHIA PA", "19133"),  # cannot compare: no flag
        ("259 W ELKHART ST", None, None, None),
    ],
)
def test_owners_at_the_parcel_or_on_its_block_are_not_absentee(
    location, street, city_state, zip_code
) -> None:
    assert ow.absentee(location, street, city_state, zip_code) is None


def test_the_owner_key_is_conservative() -> None:
    key = ow.owner_key
    assert key(["Northern Liberties L.L.C."]) == key(["NORTHERN LIBERTIES LLC"])
    assert key(["SMITH & JONES PROPERTIES"]) == key(["SMITH AND JONES PROPERTIES"])
    assert key(["O'NEILL ROSE"]) == key(["ONEILL ROSE"])
    # Different owners never merge: a co owner, another legal form, another word.
    assert key(["MORALES ROSA"]) != key(["MORALES ROSA", "MORALES LUIS"])
    assert key(["KENSINGTON LOTS LLC"]) != key(["KENSINGTON LOTS INC"])
    assert key(["KENSINGTON LOTS LLC"]) != key(["KENSINGTON LOTS 2 LLC"])
    assert key([]) is None
    assert len(ow.owner_list_id(key(["MORALES ROSA"]))) == 12
    assert ow.owner_list_id("A") == ow.owner_list_id("A")


def test_the_mailing_address_reads_as_the_city_publishes_it() -> None:
    assert (
        ow.mailing_text(["C/O ANNA BELL", "SUITE B149", None, "2608 N MAIN ST", "BELTON TX 76513"])
        == "C/O ANNA BELL, SUITE B149, 2608 N MAIN ST, BELTON TX 76513"
    )
    assert ow.mailing_text(["EVANS JODY", "EVANS JODY", "803 CLIFFORD AVE"]) == (
        "EVANS JODY, 803 CLIFFORD AVE"
    )
    assert ow.mailing_text([None, " ", None]) is None
