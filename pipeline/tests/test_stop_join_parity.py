"""The stop join parity fixture (tests/fixtures/stop_join_parity.json) matches what the pipeline's
reference join gives today. The web app's tests check the same file
(web/tests/stop_join_parity.test.ts), so a stop's page and the map show what the pipeline would,
though OpenStreetMap's answers are joined in the browser (decision D1)."""

from __future__ import annotations

import json

from .stop_join_cases import FIXTURE, build


def test_the_parity_fixture_matches_the_pipeline() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert written == build(), "the join changed: run python pipeline/tests/stop_join_cases.py"


def test_the_fixture_covers_every_answer_and_every_suggestion() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    suggested = {
        s for case in written["cases"] for s in str(case["joined"].get("sg") or "").split(",") if s
    }
    assert suggested == {
        "stop_survey",
        "stop_shelter_request",
        "stop_bench_request",
        "stop_streetlight_report",
        "stop_shade_trees",
    }
    halfway = [c for c in written["cases"] if c["joined"].get("f_noshelter") == 50]
    assert halfway, "a case where the shelter counts halfway"
    assert {c["joined"].get("om") for c in written["cases"]} >= {1, 2}
