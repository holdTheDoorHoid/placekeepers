"""The public art join parity fixture (tests/fixtures/art_join_parity.json) matches what the
pipeline gives today. The web app's tests check the same file (web/tests/art_join_parity.test.ts),
so the map shows what the pipeline would, though a work's records are joined in the browser
(decision D1 of docs/VERIFICATION_V0_2.md, applied to public art by M3.2)."""

from __future__ import annotations

import json

from placekeepers.derive.art import join_published

from .art_join_cases import FIXTURE, build


def test_the_parity_fixture_matches_the_pipeline() -> None:
    written = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert written == build(), "the join changed: run python pipeline/tests/art_join_cases.py"


def test_the_published_records_join_to_the_reference() -> None:
    for case in build()["cases"]:
        assert join_published(case["records"]) == case["joined"], case["name"]


def test_each_record_says_only_what_its_own_source_says() -> None:
    # Words and links of one source never sit in another source's record (decision D1).
    own = {
        1: {"nm", "ar", "y", "ty", "md", "lc", "wt", "pa", "doc"},
        2: {"nm", "ar", "y", "ty", "md", "w", "wp"},
        4: {"nm", "ar", "y", "ty", "w", "wp"},
    }
    codes = {"id", "g", "k", "src", "s", "pr", "mem", "in"}
    for case in build()["cases"]:
        for record in case["records"]:
            assert set(record) - codes <= own[record["s"]], (case["name"], record)
            assert sum(1 for r in case["records"] if r.get("pr") == 1) == 1


def test_the_cases_cover_memorials_titles_and_kinds() -> None:
    joined = [case["joined"] for case in build()["cases"]]
    assert sum(1 for j in joined if j.get("mem") == 1) == 2
    assert all("nm" not in j and "ar" not in j for j in joined if j.get("mem") == 1)
    assert {j["src"] for j in joined} >= {1, 2, 4, 3, 5, 6, 7}
