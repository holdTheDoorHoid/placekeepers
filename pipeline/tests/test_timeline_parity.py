"""The timeline parity fixture (tests/fixtures/timeline_parity.json) matches what the pipeline does
today. The web app's tests check the same file (web/tests/dossier_timeline_parity.test.ts), so a lot
page shows the same timeline whether its L&I records come from the weekly copy or from the City
live (issue #38)."""

from __future__ import annotations

import json

from .timeline_cases import FIXTURE, build


def test_the_parity_fixture_matches_the_pipeline() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert written == build(), (
        "the timeline rules changed: run python pipeline/tests/timeline_cases.py"
    )


def test_the_fixture_covers_the_cases_that_matter() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    cases = {case["name"]: case["li"] for case in written["cases"]}
    # An evening record keeps its day in Philadelphia, even across a new year.
    evening = cases["an evening record falls on its day in Philadelphia, not in UTC"]
    assert evening["violation"][0][0] == "2025-11-24"
    assert evening["permit"][0][0] == "2020-12-31"
    # Repeats on a day are one event with a count.
    repeated = cases["repeated violations on one day become one event with a count"]
    assert ["2019-05-02", "EXTERIOR AREA WEEDS", "COMPLIED", None, 2] in repeated["violation"]
    # Every kind, in the shard's order.
    every = cases["every kind, newest first within each kind"]
    assert list(every) == [
        "violation",
        "permit",
        "demolition",
        "unsafe",
        "imminently_dangerous",
        "clean_seal",
    ]
    # The queries read only what a lot page shows: never a number that names a case or a permit.
    for part in written["parts"]:
        for key in ("date", "title", "status", "detail"):
            assert "number" not in part[key] and "name" not in part[key]
