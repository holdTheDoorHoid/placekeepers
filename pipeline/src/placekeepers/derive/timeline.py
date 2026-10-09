"""The lot timeline's records (issue #38, docs/CONTRACTS.md section 6, the history shards).

A lot page tells the story of a parcel in one timeline: deeds, violations, permits, demolitions,
clean and seal work, unsafe and imminently dangerous notices, and the dated vacancy records we
hold. The deeds are already in the dossier shard; this module prepares the rest for the history
shards, which the lot page fetches only when its History part opens.

The L&I records come from `li_history` (adapters/li.py, LiHistory), read with the same SQL the
web app sends to the City when live data is on. Both sides then do exactly what `li_groups` does
here, so the weekly copy and a live lot page give the same timeline:

* text is trimmed and runs of white space become one space (JavaScript's white space, so the
  browser's `/\\s+/` and this agree), and empty text is no text;
* records that read the same (kind, day, title, status and detail) are one event with a count:
  L&I often writes the same violation twice on one day. A record with neither a date nor a title
  is left out;
* events are listed newest first, those with no date last, then by title, status and detail in
  code point order.

`pipeline/tests/timeline_cases.py` writes the cases both test suites check
(`pipeline/tests/fixtures/timeline_parity.json`).
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Iterable
from datetime import date, datetime
from typing import Any

#: The kinds of L&I record in the timeline, in the order the history shard lists them.
LI_KINDS = ("violation", "permit", "demolition", "unsafe", "imminently_dangerous", "clean_seal")

#: The vacancy lists a parcel can be dated on: the City's lists today (vacant land, vacant
#: buildings) and Clean & Green Philly's copies of June 2024 (L&I's vacant land list, and the
#: project's own vacant buildings list), with the source each comes from.
LISTS = {
    "city_land": "vacant_indicators_land",
    "city_building": "vacant_indicators_bldg",
    "june_2024_land": "cagp_vacant_land_2024",
    "june_2024_building": "cagp_vacant_buildings_2024",
}

#: JavaScript's white space (`\s`), so a title collapses here exactly as in the browser.
SPACE = re.compile("[\t\n\v\f\r    -     　﻿]+")

Event = tuple[str, str | None, str | None, str | None, str | None]


def clean_text(value: Any) -> str | None:
    """Text as the lot page shows it: white space runs as one space, trimmed; None when empty."""
    if value is None:
        return None
    text = SPACE.sub(" ", str(value)).strip(" ")
    return text or None


def day_text(value: Any) -> str | None:
    """A calendar day as YYYY-MM-DD, or None."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value).strip()
    return text[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", text) else None


def encode(
    day: str | None, title: str | None, status: str | None, detail: str | None, n: int
) -> list:
    """One event as the history shard writes it: [day, title, status, detail, count], the count
    only when above 1, then without trailing empty values."""
    row: list[Any] = [day, title, status, detail, n if n > 1 else None]
    while row and row[-1] is None:
        row.pop()
    return row


def li_groups(records: Iterable[tuple[Any, Any, Any, Any, Any]]) -> dict[str, list[list]]:
    """A parcel's L&I records (kind, day, title, status, detail) as the history shard's `li`
    block: by kind, in LI_KINDS order, each a list of encoded events, newest first. Kinds with no
    records are left out; records of an unknown kind are ignored."""
    counts: Counter[Event] = Counter()
    for kind, day, title, status, detail in records:
        event = (kind, day_text(day), clean_text(title), clean_text(status), clean_text(detail))
        # A record of an unknown kind, or with neither a date nor a title, says nothing.
        if kind in LI_KINDS and (event[1] is not None or event[2] is not None):
            counts[event] += 1
    out: dict[str, list[list]] = {}
    for kind in LI_KINDS:
        events = [event for event in counts if event[0] == kind]
        if not events:
            continue
        # Title, status and detail first; then newest first (a stable sort keeps ties in order),
        # with undated events last.
        events.sort(key=lambda e: (e[2] or "", e[3] or "", e[4] or ""))
        events.sort(key=lambda e: e[1] or "", reverse=True)
        out[kind] = [encode(e[1], e[2], e[3], e[4], counts[e]) for e in events]
    return out


def list_records(found: Iterable[tuple[str, Any]]) -> list[list[str]]:
    """A parcel's vacancy list records (list id, day) as the history shard's `lists`: each list
    once with its latest day, newest first, then by list id."""
    latest: dict[str, str] = {}
    for list_id, day in found:
        text = day_text(day)
        if list_id not in LISTS or text is None:
            continue
        if text > latest.get(list_id, ""):
            latest[list_id] = text
    ordered = sorted(latest.items(), key=lambda item: item[0])
    ordered.sort(key=lambda item: item[1], reverse=True)
    return [[day, list_id] for list_id, day in ordered]
