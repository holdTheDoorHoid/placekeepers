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


def test_the_fixture_covers_the_appeals_that_matter() -> None:
    """Appeals (M4.6): the board from both of the City's systems, a day and a time in
    Philadelphia, an appeal listed once, and only hearings still to come counted as upcoming."""
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    cases = {case["name"]: case for case in written["appeal_cases"]}
    winter = cases["a zoning appeal set for a hearing, in the afternoon in winter"]
    assert winter["appeals"][0]["hearing"] == "2027-02-24"
    assert winter["appeals"][0]["hearing_time"] == "15:30"
    assert winter["upcoming"] == [0]
    older = cases["the older system's codes, a decision, and a filing in the evening"]
    assert [a["board"] for a in older["appeals"]] == ["zoning", "li_review", "building"]
    # An evening filing is the day before in Philadelphia.
    assert older["appeals"][0]["filed"] == "2015-03-02"
    mixed = cases["the same appeal twice, a continued hearing, a withdrawn one and other boards"]
    assert len(mixed["appeals"]) == 4
    assert mixed["appeals"][mixed["upcoming"][0]].get("decision") == "Continued"
    assert len(mixed["upcoming"]) == 1
    midnight = cases[
        "a hearing at midnight says only its day, and a row with no number says nothing"
    ]
    assert "hearing_time" not in midnight["appeals"][0]
    assert len(midnight["appeals"]) == 1
    # The appeal number (a zoning permit's number, for a zoning appeal) is never published.
    assert all("id" not in a for case in written["appeal_cases"] for a in case["appeals"])
    # The live lookup and the weekly copy read the same columns, and never the grounds.
    assert "appealgrounds" not in written["appeal_columns"]
    assert "proviso" not in written["appeal_columns"]


def test_a_time_as_carto_writes_it_in_csv_reads_as_it_does_in_json() -> None:
    """The weekly copy comes from Carto's CSV ("2027-02-24 20:30:00+00") and a live lot page from
    its JSON ("2027-02-24T20:30:00Z"): both give the same day and time in Philadelphia."""
    from placekeepers.derive.appeals import local_moment

    assert local_moment("2027-02-24 20:30:00+00") == local_moment("2027-02-24T20:30:00Z")
    assert local_moment("2027-02-24 20:30:00+00") == ("2027-02-24", "15:30")
    assert local_moment("2026-07-01 13:30:00+00") == ("2026-07-01", "09:30")
    assert local_moment("2026-07-01 13:30:00-04:00") == ("2026-07-01", "13:30")
    assert local_moment("2026-07-01") == ("2026-07-01", None)
    assert local_moment("not a date") == (None, None)
    assert local_moment(None) == (None, None)
