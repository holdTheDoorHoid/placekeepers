"""Appeals and hearings (M4.6, issue #42; docs/CONTRACTS.md section 6, the dossier's `appeals`).

The City's `appeals` table holds every appeal to the Zoning Board of Adjustment, the L&I Review
Board, the Board of Building Standards and a few other boards, 2007 on. A lot page lists a
parcel's appeals, newest first, with an upcoming hearing on top, and its timeline shows each one
on the day it was filed.

The weekly copy and a live lot page read an appeal the same way: the pipeline reads the columns
of `placekeepers.adapters.rules.APPEAL_COLUMNS` and turns each row into a record with
`appeal_record`, and the browser does exactly the same with the City's live answer
(web/src/dossier/appeals.ts). Both test suites check the cases in
pipeline/tests/fixtures/timeline_parity.json (written by pipeline/tests/timeline_cases.py):

* text is cleaned as the timeline cleans it (runs of white space as one space, trimmed, empty
  as none);
* a time the City writes in UTC becomes its day and its time of day in Philadelphia (a hearing at
  3:30 in the afternoon is written 20:30 UTC in winter); a time of midnight in Philadelphia says
  only the day, and a bare day stays as written;
* the board comes from the City's application type (both the older system's codes, such as
  `RB_ZBA`, and the newer one's words);
* a parcel's appeals are listed once each (by appeal number), newest filing first, then by
  hearing day and number.

Who filed an appeal (`primaryappellant`) and the owner the City names (`opa_owner`) are kept as
the City writes them: the owner decided on 2026-10-09 to show them on the lot's own page, and
only there (docs/ETHICS.md, "Appeals and hearings"). They never reach the map, a citywide table
or a download. The free text grounds are never read: the page links to the City for them.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from datetime import UTC, date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from placekeepers.derive.timeline import clean_text

PHILADELPHIA = ZoneInfo("America/New_York")

#: The boards, by the City's application type, in both its older system's codes and the newer
#: one's words. Anything else is "other": the page shows the City's own words for it.
BOARDS: dict[str, str] = {
    "RB_ZBA": "zoning",
    "ZONING BOARD OF ADJUSTMENT": "zoning",
    "RB_LIRB": "li_review",
    "L&I REVIEW BOARD CODES": "li_review",
    "L&I REVIEW BOARD OTHER": "li_review",
    "RB_BBS": "building",
    "BOARD OF BUILDING STANDARDS": "building",
    "BBS ID/U TIME EXTENSION REQUEST": "building",
}
BOARD_IDS = ("zoning", "li_review", "building", "other")
#: The map's code for each board (`b` in the hearings layer, docs/CONTRACTS.md section 4).
BOARD_CODES = {"zoning": 1, "li_review": 2, "building": 3, "other": 0}

#: Statuses that mean an appeal is over, whatever its hearing day says.
CLOSED_STATUSES = frozenset(
    {"CLOSED", "COMPLETED", "DISMISSED / WITHDRAWN", "CANCELLED", "WITHDRAWN", "DISMISSED"}
)
#: Decisions after which a hearing is still to come.
STILL_TO_COME = frozenset({"CONTINUED", "HELD", "HELD/INFO"})

_STAMP = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})"
    r"(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?"
    r"\s*(Z|[+-]\d{2}(?::?\d{2})?)?$"
)


def local_moment(value: Any) -> tuple[str | None, str | None]:
    """A time the City writes (2027-02-24T20:30:00Z as JSON, 2027-02-24 20:30:00+00 as CSV, or a
    bare day) as its day and time of day in Philadelphia: ("2027-02-24", "15:30"). A bare day
    has no time; midnight in Philadelphia, the City's way of writing a day alone, has none
    either."""
    if value is None:
        return None, None
    text = str(value).strip()
    found = _STAMP.match(text)
    if not found:
        return None, None
    year, month, day, hour, minute, second, zone = found.groups()
    if hour is None:
        return f"{year}-{month}-{day}", None
    try:
        moment = datetime(int(year), int(month), int(day), int(hour), int(minute), int(second or 0))
    except ValueError:
        return None, None
    if zone in (None, "Z"):
        moment = moment.replace(tzinfo=UTC)
    else:
        sign = 1 if zone[0] == "+" else -1
        digits = zone[1:].replace(":", "")
        hours, minutes = int(digits[:2]), int(digits[2:4] or 0)
        offset = sign * (hours * 3600 + minutes * 60)
        moment = datetime.fromtimestamp(moment.replace(tzinfo=UTC).timestamp() - offset, UTC)
    local = moment.astimezone(PHILADELPHIA)
    clock = local.strftime("%H:%M")
    return local.date().isoformat(), (None if clock == "00:00" else clock)


def board_of(application: str | None) -> str:
    """The board an appeal goes to, from the City's application type."""
    return BOARDS.get((application or "").upper().strip(), "other")


def appeal_number(row: Mapping[str, Any]) -> str | None:
    """The City's number for an appeal, used only to list each appeal once and in a fixed order.
    It is never published: for a zoning appeal it is the zoning permit's number, and permit
    numbers are never shown (docs/ETHICS.md)."""
    return clean_text(row.get("appealnumber"))


def appeal_record(row: Mapping[str, Any]) -> dict[str, Any] | None:
    """One appeal as a lot page shows it, from the City's columns (APPEAL_COLUMNS), or None for a
    row with no appeal number. Keys whose value is empty are left out."""
    if appeal_number(row) is None:
        return None
    application = clean_text(row.get("applicationtype"))
    filed, _ = local_moment(row.get("createddate"))
    hearing, hearing_time = local_moment(row.get("scheduleddate"))
    decided, _ = local_moment(row.get("decisiondate"))
    record: dict[str, Any] = {
        "board": board_of(application),
        "application": application,
        "type": clean_text(row.get("appealtype")),
        "status": clean_text(row.get("appealstatus")),
        "decision": clean_text(row.get("decision")),
        "filed": filed,
        "hearing": hearing,
        "hearing_time": hearing_time if hearing else None,
        "decided": decided,
        "rco": clean_text(row.get("coordinatingrco")),
        "appellant": clean_text(row.get("primaryappellant")),
        "owner": clean_text(row.get("opa_owner")),
    }
    return {key: value for key, value in record.items() if value is not None}


def appeal_records(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """A parcel's appeals: each appeal number once (the first row read), newest filing first,
    then the later hearing first, then by appeal number in code point order (the number itself is
    not kept)."""
    seen: dict[str, dict[str, Any]] = {}
    for row in rows:
        number = appeal_number(row)
        record = appeal_record(row)
        if number is not None and record is not None and number not in seen:
            seen[number] = record
    numbers = sorted(seen)
    numbers.sort(key=lambda n: seen[n].get("hearing") or "", reverse=True)
    numbers.sort(key=lambda n: seen[n].get("filed") or "", reverse=True)
    return [seen[n] for n in numbers]


def is_upcoming(record: Mapping[str, Any], today: date | str) -> bool:
    """A hearing still to come: its day is today or later, the appeal is not closed, withdrawn or
    dismissed, and no decision has ended it (a continued hearing is still to come)."""
    day = record.get("hearing")
    if not day:
        return False
    if day < (today if isinstance(today, str) else today.isoformat()):
        return False
    if (record.get("status") or "").upper() in CLOSED_STATUSES:
        return False
    decision = (record.get("decision") or "").upper()
    return decision == "" or decision in STILL_TO_COME
