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
    }


def main() -> None:
    FIXTURE.write_text(json.dumps(build(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE}")


if __name__ == "__main__":
    main()
