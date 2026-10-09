"""Cases for the timeline parity check between the pipeline and the web app (issue #38).

The weekly copy's history shards hold each parcel's L&I records grouped as
placekeepers.derive.timeline does it, from `li_history`, which the pipeline reads with the same SQL
the web app sends to the City when live data is on. With live data on, the web app groups the
City's answer itself (web/src/dossier/timeline.ts), so a lot page must show the same timeline
either way. This file feeds records shaped as the City's servers send them to the pipeline's own
date reading and grouping, and writes the answers to tests/fixtures/timeline_parity.json:

* tests/test_timeline_parity.py checks that the file matches what the pipeline gives today;
* web/tests/dossier_timeline_parity.test.ts checks that the web app gives the same answers, and
  that its live query reads the same columns of the same tables (`parts`).

Since M4.6 (issue #42) it also holds appeals: rows as the City sends them, the columns both sides
read (`appeal_columns`), and the appeals a lot page lists from them (`appeal_cases`), with the
hearings still to come on `appeal_today`.

After changing the grouping, the date rule or the queries, write the file again with:

    python pipeline/tests/timeline_cases.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import duckdb

from placekeepers.adapters.carto import Column, _cast
from placekeepers.adapters.li import HISTORY_PARTS
from placekeepers.adapters.rules import APPEAL_COLUMNS
from placekeepers.derive.appeals import appeal_records, is_upcoming
from placekeepers.derive.timeline import li_groups

FIXTURE = Path(__file__).parent / "fixtures" / "timeline_parity.json"

# Records as the City's Carto API sends them as JSON: timestamps in UTC with a Z, sometimes a bare
# day, sometimes nothing. Each case is one parcel's answer to the timeline query.
CASES: list[dict[str, Any]] = [
    {
        "name": "repeated violations on one day become one event with a count",
        "rows": [
            ["violation", "2019-05-02T04:00:00Z", "EXTERIOR AREA WEEDS", "COMPLIED", None],
            ["violation", "2019-05-02T04:00:00Z", "EXTERIOR AREA  WEEDS ", "COMPLIED", None],
            ["violation", "2019-05-02T04:00:00Z", "RUBBISH & GARBAGE", "COMPLIED", None],
            ["violation", "2025-08-01T04:00:00Z", "VACANT STRUCTURE AND LAND", "OPEN", None],
        ],
    },
    {
        "name": "an evening record falls on its day in Philadelphia, not in UTC",
        "rows": [
            ["violation", "2025-11-25T01:15:43Z", "VACANT STRUCTURE & LAND", "OPEN", None],
            [
                "permit",
                "2021-01-01T03:00:00Z",
                "New Construction",
                "Completed",
                "Residential Building Permit",
            ],
            [
                "permit",
                "2020-07-14T16:19:04Z",
                "Addition and/or Alteration",
                "Issued",
                "Electrical Permit",
            ],
            ["clean_seal", "2016-03-02T23:59:00Z", "CLEAN&SEAL", "Approved", None],
        ],
    },
    {
        "name": "every kind, newest first within each kind",
        "rows": [
            ["demolition", "2011-06-14T04:00:00Z", "CASE", "COMPLETED", "YES"],
            ["demolition", "2009-02-03T05:00:00Z", "MINOR DEMOLITION", "COMPLETED", "NO"],
            ["unsafe", "2009-01-12T05:00:00Z", "UNSAFE STRUCTURE", "RESOLVED", None],
            ["imminently_dangerous", "2010-11-30T05:00:00Z", "ID STRUCTURE", "RESOLVED", None],
            ["clean_seal", "2008-05-20T04:00:00Z", "CLIP C&S", "Approved", None],
            ["permit", "2012-08-01T04:00:00Z", "NEWCON", "COMPLETED", "ZONING/USE PERMIT"],
            ["permit", "2014-03-10T04:00:00Z", "MAJOR", "EXPIRED", "ALTERATION PERMIT"],
            ["violation", "2008-01-07T05:00:00Z", "VACANT AND OPEN", "COMPLIED", None],
        ],
    },
    {
        "name": "odd text: spaces of every kind, empty text, a bare day, no date, an unknown kind",
        "rows": [
            ["violation", "2018-09-09", " LITTER ON\tVACANT LOTS ", "CLOSED", ""],
            ["violation", None, "HIGH WEEDS-CUT", "COMPLIED", None],
            ["violation", "", "   ", None, None],
            [
                "permit",
                "2018-09-09T04:00:00Z",
                "EZ Roof Covering Replacement",
                "Completed",
                "General Permit Minor",
            ],
            ["complaint", "2018-09-09T04:00:00Z", "SOMETHING ELSE", "OPEN", None],
        ],
    },
    {
        "name": "ties on a day order by title, status and detail",
        "rows": [
            ["permit", "2023-04-03T04:00:00Z", "New Construction", "Completed", "Plumbing Permit"],
            [
                "permit",
                "2023-04-03T04:00:00Z",
                "New Construction",
                "Completed",
                "Electrical Permit",
            ],
            ["permit", "2023-04-03T04:00:00Z", "Alterations", "Completed", "Plumbing Permit"],
            [
                "permit",
                "2023-04-03T04:00:00Z",
                "New Construction",
                "Completed",
                "Electrical Permit",
            ],
            ["violation", "2023-04-03T04:00:00Z", "VACANT PROPERTIES", "OPEN", None],
            ["violation", "2023-04-03T04:00:00Z", "VACANT PROPERTIES", "COMPLIED", None],
        ],
    },
    {"name": "no records at all", "rows": []},
]


#: Appeals as the City's Carto API sends them as JSON (M4.6, issue #42), each case one parcel's
#: answer. The names are invented. `today` is the day the "hearing still to come" rule is
#: checked against.
APPEAL_TODAY = "2026-10-09"


def appeal(number: str | None, **fields: Any) -> dict[str, Any]:
    row: dict[str, Any] = {name: None for name in APPEAL_COLUMNS}
    row["appealnumber"] = number
    row.update(fields)
    return row


APPEAL_CASES: list[dict[str, Any]] = [
    {
        "name": "a zoning appeal set for a hearing, in the afternoon in winter",
        "rows": [
            appeal(
                "ZP-2026-008500",
                applicationtype="Zoning Board of Adjustment",
                appealtype="ZBA Permit Denial - Variance",
                appealstatus="Prepare Meeting",
                createddate="2026-10-06T19:31:35Z",
                scheduleddate="2027-02-24T20:30:00Z",
                coordinatingrco="Example Neighbors Association",
                primaryappellant="ROSA EXAMPLE; EXAMPLE ROSA",
                opa_owner="EXAMPLE ROSA",
            )
        ],
    },
    {
        "name": "the older system's codes, a decision, and a filing in the evening",
        "rows": [
            appeal(
                "57281",
                applicationtype="RB_ZBA",
                appealstatus="CLOSED",
                decision="GRANTED/PROV",
                createddate="2015-03-03T01:39:00Z",
                scheduleddate="2015-04-15T13:30:00Z",
                decisiondate="2015-04-15T04:00:00Z",
                primaryappellant="  SAMPLE   BUILDERS  LLC ",
                opa_owner="SAMPLE BUILDERS LLC",
            ),
            appeal(
                "40125",
                applicationtype="RB_LIRB",
                appealstatus="CLOSED",
                decision="AFFIRMED",
                createddate="2012-07-09T15:12:00Z",
                scheduleddate="2012-08-21T04:00:00Z",
                primaryappellant="JORDAN SAMPLE",
            ),
            appeal(
                "12001",
                applicationtype="RB_BBS",
                appealstatus="CLOSED",
                decision="",
                createddate="2009-01-05",
            ),
        ],
    },
    {
        "name": "the same appeal twice, a continued hearing, a withdrawn one and other boards",
        "rows": [
            appeal(
                "LIRB-2026-000123",
                applicationtype="L&I Review Board Codes",
                appealtype="LIRB Violation Appeal",
                appealstatus="In Process",
                decision="Continued",
                createddate="2026-06-01T14:00:00Z",
                scheduleddate="2026-10-09T16:30:00Z",
                primaryappellant="CASEY SAMPLE",
            ),
            appeal(
                "LIRB-2026-000123",
                applicationtype="L&I Review Board Codes",
                appealstatus="In Process",
                createddate="2026-06-01T14:00:00Z",
            ),
            appeal(
                "LIRB-2026-000124",
                applicationtype="L&I Review Board Codes",
                appealstatus="Closed",
                decision="Withdrawn",
                createddate="2026-06-01T14:00:00Z",
                scheduleddate="2026-11-12T17:00:00Z",
            ),
            appeal(
                "TRB-2025-000009",
                applicationtype="Tax Review Board",
                appealtype="TRB - Case Review ",
                appealstatus="Completed",
                createddate="2025-07-22T20:02:46Z",
            ),
            appeal(
                "BBS-2026-000077",
                applicationtype="Board of Building Standards",
                appealtype="BBS Permit Denial",
                appealstatus="In Process",
                createddate="2026-03-08T07:30:00Z",
                scheduleddate="2026-10-08T17:00:00Z",
            ),
        ],
    },
    {
        "name": "a hearing at midnight says only its day, and a row with no number says nothing",
        "rows": [
            appeal(
                "ZP-2025-001000",
                applicationtype="Zoning Board of Adjustment",
                appealstatus="Scheduled",
                createddate="2025-11-02T05:30:00Z",
                scheduleddate="2026-11-04T05:00:00Z",
            ),
            appeal(None, applicationtype="Zoning Board of Adjustment", createddate="2025-01-01"),
            appeal("   ", applicationtype="Zoning Board of Adjustment"),
        ],
    },
    {"name": "no appeals at all", "rows": []},
]


def appeal_answer(case: dict[str, Any]) -> dict[str, Any]:
    records = appeal_records(case["rows"])
    return {
        "name": case["name"],
        "rows": case["rows"],
        "appeals": records,
        # The positions of the hearings still to come in the list.
        "upcoming": [i for i, r in enumerate(records) if is_upcoming(r, APPEAL_TODAY)],
    }


def local_days(raw: list[str | None]) -> list[str | None]:
    """The pipeline's own reading of each raw date (adapters/carto.py, LOCAL_DATE): a bare day as
    written, a timestamp as its day in Philadelphia. Carto's CSV writes "2019-05-02 04:00:00+00"
    where its JSON writes "2019-05-02T04:00:00Z"; both read the same."""
    con = duckdb.connect()
    try:
        con.execute("SET TimeZone = 'UTC'")
        cast = _cast(Column("date", "date", "LOCAL_DATE"))
        out = []
        for value in raw:
            text = None if value in (None, "") else value
            found = con.execute(
                f"SELECT {cast} FROM (SELECT $1::VARCHAR AS date)", [text]
            ).fetchone()
            out.append(found[0].isoformat() if found[0] else None)
        return out
    finally:
        con.close()


def case_answer(case: dict[str, Any]) -> dict[str, Any]:
    days = local_days([row[1] for row in case["rows"]])
    records = [
        (row[0], day, row[2], row[3], row[4]) for row, day in zip(case["rows"], days, strict=True)
    ]
    return {"name": case["name"], "rows": case["rows"], "li": li_groups(records)}


def build() -> dict[str, Any]:
    return {
        "parts": [
            {
                "kind": part.kind,
                "table": part.table,
                "date": part.date,
                "title": part.title,
                "status": part.status,
                "detail": part.detail,
            }
            for part in HISTORY_PARTS
        ],
        "cases": [case_answer(case) for case in CASES],
        # Appeals (M4.6): the columns both sides read, and how each side turns rows into a lot
        # page's appeals.
        "appeal_columns": list(APPEAL_COLUMNS),
        "appeal_today": APPEAL_TODAY,
        "appeal_cases": [appeal_answer(case) for case in APPEAL_CASES],
    }


def main() -> None:
    FIXTURE.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE}")


if __name__ == "__main__":
    main()
