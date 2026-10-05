"""Cases for the wording parity check between the pipeline and the web app.

When "Fetch live City data" is on, the web app refreshes a lot page from the City's live records
and works out the owner flags again in the browser (web/src/dossier/flags.ts, owners.ts and
transfers.ts), so it must give exactly the sentences this pipeline gives. This file feeds cases to
the pipeline's own functions and writes their answers to tests/fixtures/wording_parity.json:

* tests/test_wording_parity.py checks that the file matches what the pipeline gives today;
* web/tests/dossier_parity.test.ts checks that the web app gives the same answers.

After changing the wording, the owner rules or the deed rules, write the file again with:

    python pipeline/tests/wording_cases.py

The web app never builds the tax debt or many parcels sentences (they come only from the weekly
snapshot), so they are not here; but it holds them back by the same rule as the pipeline, so
`owner_flag_rule` says which flags about the owner may show (docs/VERIFICATION.md D5 and D6).
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from placekeepers.derive import owners as ow
from placekeepers.derive import transfers as tr
from placekeepers.derive import wording
from placekeepers.derive.flags import (
    ABOUT_THE_OWNER,
    FLAG_NOTES,
    NOTICES,
    LiSummary,
    OwnerFacts,
    owner_flag_allowed,
    owner_flags,
    shows_deed_fraud_notice,
)

FIXTURE = Path(__file__).parent / "fixtures" / "wording_parity.json"

AS_OF = "2026-10-04"


def day(text: str | None) -> date | None:
    return date.fromisoformat(text) if text else None


ABSENTEE_TEXT = [
    ("out_of_state", "CHERRY HILL", "NJ"),
    ("out_of_state", "LONDON", None),
    ("out_of_state", None, "NY"),
    ("out_of_state", None, None),
    ("outside_city", "BLUE BELL", "PA"),
    ("outside_city", "KING OF PRUSSIA", "PA"),
    ("outside_city", "WILKES - BARRE", "PA"),
    ("outside_city", None, None),
    ("po_box_in_city", "PHILADELPHIA", "PA"),
    ("elsewhere_in_city", "PHILADELPHIA", "PA"),
]

SHERIFF_TEXT = [
    [("2019-03-14", 1600)],
    [("2019-03-14", None)],
    [("2003-05-05", 800), ("2019-03-14", 1600)],
    [("2006-09-21", 4100), ("2015-12-17", 1599.5), ("2026-05-20", 6600)],
    [("2010-10-25", 1234567.49)],
]

RESALE_TEXT = [
    (3, "2024-03-15", "2025-06-10", True),
    (2, "2011-01-05", "2011-08-01", False),
    (2, "2010-12-05", "2011-08-01", False),
]

VIOLATIONS_TEXT = [
    (1, "2025-04-09", "NEW USE"),
    (1, None, "EXTERIOR AREA WEEDS"),
    (1, "2025-04-09", None),
    (1, None, None),
    (1, "2020-05-01", "DUMPING - PRIVATE LOT"),
    (2, "2025-08-01", "VACANT STRUCTURE AND LAND"),
    (11, "2026-06-15", None),
    (3, None, "ROOF"),
]

OWNER_NAMES = [
    ["SMITH JOHN"],
    ["SMITH JOHN", "SMITH MARY"],
    ["JONES ROBERT JR", "JONES LISA 2ND"],
    ["SAMPLE HOLDINGS LLC"],
    ["SAMPLE L.L.C."],
    ["ACME INC"],
    ["SAMPLE REALTY TRUST"],
    ["SAMPLE TR"],
    ["SAMPLE BANK N A"],
    ["MT ZION BAPTIST CHURCH"],
    ["UNIVERSITY CITY HOMES LLC"],
    ["CITY OF PHILA"],
    ["PHILADELPHIA LAND BANK"],
    ["PHILADELPHIA REDEVELOPMEN"],
    ["REDEVELOPMENT AUTHORITY", "OF PHILADELPHIA"],
    ["PHILADELPHIA HOUSING AUTH"],
    ["PHILADELPHIA HOUSING"],
    ["SEPTA"],
    [],
    ["UNKNOWN"],
    ["1234 SAMPLE"],
    ["MADONNA"],
    # Schools (decided 2026-10-04 by the orchestrator).
    ["ILADELPHIA CHARTER SCHOOL"],
    ["KIPP PHILADELPHIA CHARTER"],
    ["FRANKLIN TOWNE CHARTER HI"],
    ["MASTERY CHARTER SCHOOLS F"],
    ["PHILADELPHIA YOUTH FOR CHANGE CHARTER SC"],
    ["GERMANTOWN FRIENDS SCHOOL"],
    ["GESU SCHOOL INC"],
    ["ST JOSEPH'S PREPARATORY", "SCHOOL"],
    ["CORNERSTONE CHRISTIAN ACADEMY"],
    ["LA SALLE COLLEGE"],
    ["SCHOOL DISTRICT OF PHILA"],
    ["SCHOOL DISTRICT", "OF PHILA"],
    ["PHILADELPHIA SCHOOL DISTRICT"],
    ["COMMUNITY COLLEGE OF PHIL"],
    ["COMM COLLEGE OF PHILA"],
    ["WOODS CHARTER SCHOOL DEVELOPMENT LLC"],
    ["CHARTER ADVERTISING", "GROUP INC"],
    ["420 W SCHOOL HOUSE LANE"],
    ["SCHOOLHOUSE PROPERTY INVESTMENTS LLC"],
    ["ACADEMIC PROPERTIES INC"],
    # Public bodies OPA spells many ways or cuts short (found by the M1.10 review, c6663a8), and
    # private names that look a little like them.
    ["PHILA AUTH IND DEV"],
    ["PHILA AUTH & IND DEV", "SOMERTON IND PARK"],
    ["PHILADELPHIA AUTHORITY FO"],
    ["PHILADELPHIA AUTHORITY", "FOR INDUSTRAIL DEV"],
    ["PHILADELPHIA REGIONAL POR"],
    ["PHILADELPHIA REGINAL PORT"],
    ["PENNDOT"],
    ["PA DEPT OF TRANSPORTATION"],
    ["COMM OF PENNA", "DEPT OF PUBLC PROP"],
    ["COMMONWEALTH PA"],
    ["PENNSYLVANIA HOUSING FINANCE AGENCY"],
    ["OFFICE OF THE DISTRICT AT"],
    ["PHILA MUNICIPAL AUTH"],
    ["STATE PUBLIC SCHOOL", "BLDG AUTH"],
    ["U S A"],
    ["REDEVEL AUTH OF PHILA"],
    ["REDEVLOPMENT AUTHORITY", "OF PHILADELPHIA"],
    ["CITY OF PHLADELPHIA", "DEPARTMENT OF COMMERCE"],
    ["COMMONWEALTH IMPROVEMENT"],
    ["KENSINGTON REDEVELOPMENT"],
    ["PORT PETER SOPHAL"],
    # A share of ownership is part of a person's name.
    ["SMITH JOHN 1/2 INT", "SMITH MARY 1/2 INT"],
]

ESTATE_NAMES = [
    ["SMITH JOHN EST OF"],
    ["SMITH JOHN ESTATE OF"],
    ["HEIRS OF SMITH ROSE"],
    ["SMITH JOHN", "SMITH MARY EXECUTRIX"],
    ["SMITH JOHN DEC'D"],
    ["SAMPLE REAL ESTATE LLC"],
    ["Z ESTATE GROUP LLC"],
    ["SMITH MARY LIFE ESTATE"],
    ["SMITH MARY LF TENANT"],
    ["THE TRUSTEES OF THE", "ESTATE OF STEPHEN GIRARD"],
    ["SAMPLE CHARTER SCHOOL EST"],
    ["CITY OF PHILA"],
    ["SMITH JOHN"],
    # A person's estate written name first is a whole name, even when a bank or a trust follows
    # it (found by the M1.10 review, 353e9b7).
    ["ESPINAL MARISOL ESTATE OF", "BNY MELLON N A"],
    ["ACKERLY GREGORY K ESTATE OF", "LINDA A ACKERLY TRUST"],
    ["THE ESTATE OF", "JOHN WHITTAKER"],
    ["RIVERSIDE BANK AND TRUST CO", "MCLAREN NIKKI ESTATE OF"],
]

ABSENTEE = [
    ("1305 N EXAMPLE AVE", "455 EXAMPLE AVE", "CHERRY HILL NJ", "08002"),
    ("1305 N EXAMPLE AVE", "9 OAK LN", "BLUE BELL PA", "19422"),
    ("1305 N EXAMPLE AVE", "PO BOX 5183", "PHILADELPHIA PA", "19141"),
    ("1305 N EXAMPLE AVE", "22 S BROAD ST", "PHILADELPHIA PA", "19107"),
    ("1305 N EXAMPLE AVE", "22 S BROAD ST", "ROXBOROUGH", "19128"),
    ("1305 N EXAMPLE AVE", "1 RUE DE RIVOLI", "PARIS FRANCE", None),
    ("3134 N 8TH ST", "3132 N 08TH ST", "PHILADELPHIA PA", "19133"),
    ("3134 N 8TH ST", "3134 N EIGHTH ST", "PHILADELPHIA PA", "19133"),
    ("1304-08 E PASSYUNK AVE", "1306 E PASSYUNK AVE UNIT 2", "PHILADELPHIA PA", "19147"),
    ("3134 N 8TH ST", None, None, None),
    # "MC KEAN" and "MCKEAN" are one street: an owner at the parcel is not absentee (1,464 real
    # addresses were read wrongly by the web app before 2026-10-04).
    ("2215 MCKEAN ST", "2215 MC KEAN ST", "PHILADELPHIA PA", "19145-2715"),
    ("9011 AYRDALE CRESCENT", "9011 AYRDALECRESCENT ST", "PHILADELPHIA PA", "19128"),
]

#: Whole lot pages' worth of facts: the flags the web app works out from live records. `vacant`
#: (called vacant with high or medium confidence) is True and `homestead` False unless a case says
#: otherwise.
PARCELS: list[dict[str, Any]] = [
    {
        "names": ["SAMPLE ROSE M EST OF"],
        "location": "1305 N EXAMPLE AVE",
        "mailing": ["455 EXAMPLE AVE", "CHERRY HILL NJ", "08002"],
        "opa_sale": ["1987-06-12", 15000],
        "deeds": [],
        "li": {"open_violations": 1, "last_open": "2025-04-09", "last_open_title": "NEW USE"},
    },
    {
        "names": ["EXAMPLE DARNELL", "EXAMPLE TINA"],
        "location": "1201 N SAMPLE ST",
        "mailing": ["1201 N SAMPLE ST", "PHILADELPHIA PA", "19122"],
        "opa_sale": ["2025-06-10", 95000],
        "deeds": [
            ["2025-06-10", "DEED", 95000],
            ["2024-11-02", "DEED", 41000],
            ["2024-03-15", "DEED", 18000],
            ["2019-03-14", "DEED SHERIFF", 1600],
            ["2004-05-17", "DEED - DECEASED", 1500],
        ],
        "li": {
            "open_violations": 2,
            "last_open": "2025-08-01",
            "last_open_title": "VACANT STRUCTURE AND LAND",
            "unsafe_since": "2023-05-02",
        },
    },
    {
        "names": ["EXAMPLE HOLDINGS LLC"],
        "location": "1301 N EXAMPLE AVE",
        "mailing": ["PO BOX 5183", "PHILADELPHIA PA", "19141"],
        "opa_sale": ["2021-09-30", 30000],
        "deeds": [["2021-09-30", "DEED", 15000.5], ["2010-10-25", "SHERIFF'S DEED", 4000]],
        "li": {"imminently_dangerous_since": "2025-12-03"},
    },
    {
        "names": ["CITY OF PHILA"],
        "location": "1203 N SAMPLE ST",
        "mailing": ["1515 ARCH ST", "PHILADELPHIA PA", "19102"],
        "opa_sale": ["2006-02-01", 900],
        "deeds": [["2006-02-01", "SHERIFF'S DEED", 900], ["2005-01-01", "DEED", 1]],
        "li": {},
    },
    {
        "names": ["SAMPLE COMMUNITY CHURCH"],
        "location": "1507 N EXAMPLE AVE",
        "mailing": ["1509 N EXAMPLE AVE", "PHILADELPHIA PA", "19121"],
        "opa_sale": ["1998-11-12", 2500],
        "deeds": [["2015-01-01", "DEED", 10]],
        "li": {"open_violations": 11, "last_open": "2026-06-15"},
    },
    {
        "names": ["ILADELPHIA CHARTER SCHOOL"],
        "location": "1523-49 W CUMBERLAND ST",
        "mailing": ["5900 BALTIMORE AVE", "PHILADELPHIA PA", "19143"],
        "opa_sale": ["2016-05-02", 2000000],
        "deeds": [
            ["2016-05-02", "DEED", 2000000],
            ["2014-08-01", "DEED", 1500000],
            ["2014-01-15", "DEED", 1200000],
        ],
        "li": {
            "open_violations": 1,
            "last_open": "2020-05-01",
            "last_open_title": "DUMPING - PRIVATE LOT",
        },
    },
    {
        "names": [],
        "location": "1401 N SAMPLE ST",
        "mailing": [None, None, None],
        "opa_sale": None,
        "deeds": [],
        "li": {},
    },
    # Parcels that may be someone's home (docs/VERIFICATION.md D5 and D6, decided 2026-10-04).
    {
        "names": ["SAMPLE ROSE M EST OF"],
        "location": "1305 N EXAMPLE AVE",
        "mailing": ["455 EXAMPLE AVE", "CHERRY HILL NJ", "08002"],
        "opa_sale": ["1987-06-12", 15000],
        "deeds": [],
        "li": {"open_violations": 1, "last_open": "2025-04-09", "last_open_title": "NEW USE"},
        "vacant": False,
    },
    {
        "names": ["SAMPLE ROSE M EST OF"],
        "location": "1305 N EXAMPLE AVE",
        "mailing": ["455 EXAMPLE AVE", "CHERRY HILL NJ", "08002"],
        "opa_sale": ["1987-06-12", 15000],
        "deeds": [],
        "li": {},
        "homestead": True,
    },
    {
        "names": ["EXAMPLE HOLDINGS LLC"],
        "location": "1301 N EXAMPLE AVE",
        "mailing": ["PO BOX 5183", "PHILADELPHIA PA", "19141"],
        "opa_sale": ["2021-09-30", 30000],
        "deeds": [["2021-09-30", "DEED", 15000.5]],
        "li": {},
        "vacant": False,
    },
    {
        "names": ["HACE"],
        "location": "1310 N EXAMPLE AVE",
        "mailing": ["22 S BROAD ST", "PHILADELPHIA PA", "19107"],
        "opa_sale": ["2001-03-01", 20000],
        "deeds": [],
        "li": {},
        "vacant": False,
    },
    {
        "names": ["RIVERSIDE BANK AND TRUST CO", "MCLAREN NIKKI ESTATE OF"],
        "location": "1312 N EXAMPLE AVE",
        "mailing": ["9 OAK LN", "BLUE BELL PA", "19422"],
        "opa_sale": ["2011-05-05", 1],
        "deeds": [],
        "li": {"open_violations": 2, "last_open": "2024-02-02"},
        "vacant": False,
    },
    {
        "names": ["SMITH JOHN"],
        "location": "1314 N EXAMPLE AVE",
        "mailing": ["1314 N EXAMPLE AVE", "PHILADELPHIA PA", "19121"],
        "opa_sale": ["2019-07-07", 85000],
        "deeds": [["2019-07-07", "DEED", 85000]],
        "li": {},
        "vacant": False,
        "homestead": True,
    },
]

#: Owners and parcels for the rule alone: which flags about the owner may show.
OWNER_FLAG_RULE = [
    (names, vacant, homestead)
    for names in (
        ["SMITH JOHN"],
        ["SMITH JOHN ESTATE OF"],
        ["HACE"],
        [],
        ["KENSINGTON LOTS LLC"],
        ["GRACE BAPTIST CHURCH"],
        ["RIVERSIDE BANK AND TRUST CO", "MCLAREN NIKKI ESTATE OF"],
        ["CITY OF PHILA"],
    )
    for vacant in (True, False)
    for homestead in (False, True)
]


def parcel_flags(case: dict[str, Any]) -> dict[str, Any]:
    names = case["names"]
    owner_type = ow.type_from_name(names)
    history = tr.deeds(
        tr.Transfer(index + 1, day(when), kind, price, ("A",), ("B",))
        for index, (when, kind, price) in enumerate(case["deeds"])
    )
    as_of = day(AS_OF)
    opa_sale = case["opa_sale"] or [None, None]
    li = case["li"]
    vacant = case.get("vacant", True)
    homestead = case.get("homestead", False)
    facts = OwnerFacts(
        owner_type=owner_type,
        has_names=bool(names),
        absentee=ow.absentee(case["location"], *case["mailing"]),
        possible_estate=ow.possible_estate(names),
        history=history,
        last_sale=tr.last_sale(history, day(opa_sale[0]), opa_sale[1], as_of),
        resales=tr.fast_resales(history, as_of),
        li=LiSummary(
            open_violations=li.get("open_violations", 0),
            last_open=day(li.get("last_open")),
            last_open_title=li.get("last_open_title"),
            unsafe_since=day(li.get("unsafe_since")),
            dangerous_since=day(li.get("imminently_dangerous_since")),
        ),
        called_vacant=vacant,
        homestead=homestead,
    )
    flags = owner_flags(facts, as_of)
    return {
        **case,
        "vacant": vacant,
        "homestead": homestead,
        "type": owner_type.type,
        "flags": [{"id": f["id"], "text": f["text"]} for f in flags],
        "notice": shows_deed_fraud_notice(facts),
    }


def owner_rule(names: list[str], vacant: bool, homestead: bool) -> dict[str, Any]:
    owner_type = ow.type_from_name(names)
    facts = OwnerFacts(
        owner_type=owner_type,
        has_names=bool(names),
        possible_estate=ow.possible_estate(names),
        called_vacant=vacant,
        homestead=homestead,
    )
    return {
        "names": names,
        "vacant": vacant,
        "homestead": homestead,
        "type": owner_type.type,
        "person": facts.person_like,
        "shown": [flag_id for flag_id in ABOUT_THE_OWNER if owner_flag_allowed(flag_id, facts)],
        "notice": shows_deed_fraud_notice(facts),
    }


def build() -> dict[str, Any]:
    """Every case with the pipeline's answer."""
    return {
        "as_of": AS_OF,
        "notes": {
            flag_id: {"careful": note["careful"], "next_step": note["next_step"]}
            for flag_id, note in FLAG_NOTES.items()
        },
        "possible_estate_text": wording.ESTATE_TEXT,
        "deed_fraud_notice": NOTICES["deed_fraud"]["text"],
        "absentee_text": [
            {
                "scope": scope,
                "city": city,
                "state": state,
                "text": wording.absentee_text(scope, city, state),
            }
            for scope, city, state in ABSENTEE_TEXT
        ],
        "sheriff_text": [
            {
                "sales": [[when, price] for when, price in sales],
                "text": wording.sheriff_text([(day(when), price) for when, price in sales]),
            }
            for sales in SHERIFF_TEXT
        ],
        "last_sale_text": [
            {"year": year, "text": wording.last_sale_text(year)} for year in (1987, 2025)
        ],
        "no_sale_text": [
            {"year": year, "text": wording.no_sale_text(year)} for year in (2000, 1995)
        ],
        "resale_text": [
            {
                "count": count,
                "first": first,
                "last": last,
                "recent": recent,
                "text": wording.resale_text(count, day(first), day(last), recent),
            }
            for count, first, last, recent in RESALE_TEXT
        ],
        "violations_text": [
            {
                "count": count,
                "last": last,
                "title": title,
                "text": wording.violations_text(count, day(last), title),
            }
            for count, last, title in VIOLATIONS_TEXT
        ],
        "unsafe_text": [
            {"since": since, "text": wording.unsafe_text(day(since))}
            for since in ("2023-05-02", None)
        ],
        "dangerous_text": [
            {"since": since, "text": wording.dangerous_text(day(since))}
            for since in ("2025-12-03", None)
        ],
        "owner_type": [
            {"names": names, "type": found.type, "reason": found.reason}
            for names in OWNER_NAMES
            for found in [ow.type_from_name(names)]
        ],
        "possible_estate": [
            {"names": names, "estate": ow.possible_estate(names)} for names in ESTATE_NAMES
        ],
        "absentee": [
            {
                "location": location,
                "mailing_street": street,
                "mailing_city_state": city_state,
                "mailing_zip": zip_code,
                "scope": found.scope if found else None,
                "text": found.text if found else None,
            }
            for location, street, city_state, zip_code in ABSENTEE
            for found in [ow.absentee(location, street, city_state, zip_code)]
        ],
        "parcels": [parcel_flags(case) for case in PARCELS],
        "owner_flag_rule": [owner_rule(*case) for case in OWNER_FLAG_RULE],
    }


def main() -> None:
    FIXTURE.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE}")


if __name__ == "__main__":
    main()
