"""The wording parity fixture (tests/fixtures/wording_parity.json) matches what the pipeline says
today. The web app's tests check the same file (web/tests/dossier_parity.test.ts), so the lot page
gives the same sentences whether its flags come from the weekly snapshot or from live records."""

from __future__ import annotations

import json

from .wording_cases import FIXTURE, build


def test_the_parity_fixture_matches_the_pipeline() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert written == build(), "the wording changed: run python pipeline/tests/wording_cases.py"


def test_the_fixture_covers_the_cases_that_once_drifted() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    sentences = [
        case["text"]
        for key in ("sheriff_text", "no_sale_text", "violations_text")
        for case in written[key]
    ]
    assert "Not sold on the open market since at least 2000." in sentences
    assert "Sold at sheriff sale on March 14, 2019, for $1,600." in sentences
    assert "L&I lists 1 open violation, for new use, from April 9, 2025." in sentences
    assert "L&I lists 1 open violation, for dumping, private lot, from May 1, 2020." in sentences
    types = {" / ".join(case["names"]): case["type"] for case in written["owner_type"]}
    assert types["ILADELPHIA CHARTER SCHOOL"] == "nonprofit"
    assert types["SCHOOL DISTRICT OF PHILA"] == "other_public"
