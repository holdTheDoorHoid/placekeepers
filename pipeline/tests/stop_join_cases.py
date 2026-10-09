"""Cases for the stop join parity check between the pipeline and the web app (decision D1 of
docs/VERIFICATION_V0_2.md).

SEPTA's stops are published without what OpenStreetMap says there; the web app joins it in the
visitor's browser from tables/stop_amenities.json (web/src/transit/answers.ts) and must give
exactly what the pipeline would: what riders find, whether the stop numbers agree, the halfway
answers and the suggestions. This file feeds cases to the pipeline's reference join
(placekeepers.derive.transit_comfort.join_published) and writes its answers to
tests/fixtures/stop_join_parity.json:

* tests/test_stop_join_parity.py checks that the file matches what the pipeline gives today;
* web/tests/stop_join_parity.test.ts checks that the web app gives the same answers.

After changing the join or the stop suggestion rules, write the file again with:

    python pipeline/tests/stop_join_cases.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from placekeepers.derive.transit_comfort import NOT_SURVEYED, join_published

FIXTURE = Path(__file__).parent / "fixtures" / "stop_join_parity.json"

#: A bus stop as tiles/transit.pmtiles publishes it: SEPTA's and the City's measures, the link to
#: OpenStreetMap (`o`) and the mark of a stop the lens scores (`tc`).
STOP: dict[str, Any] = {
    "id": "sp100",
    "sid": "100",
    "md": 1,
    "f_riders": 60,
    "f_shade": 40,
    "tc": 1,
}

#: (name, the published stop, its entry in tables/stop_amenities.json or None)
CASES: list[tuple[str, dict[str, Any], dict[str, Any] | None]] = [
    (
        "a shelter, a bench and a light, the stop numbers agreeing",
        {**STOP, "o": "n1"},
        {"c": 3, "sh": 1, "bn": 1, "lt": 1, "n": ["100"]},
    ),
    (
        "neither a shelter nor a bench, not lit, and little shade nearby",
        {**STOP, "o": "n2", "f_shade": 90, "sg": "stop_shade_trees"},
        {"c": 1, "sh": 0, "bn": 0, "lt": 0},
    ),
    ("a bench but no shelter, matched by place", {**STOP, "o": "n3"}, {"c": 2, "sh": 0, "bn": 1}),
    ("in OpenStreetMap, but no one has answered yet", {**STOP, "o": "n4"}, {"c": 0}),
    ("only the shelter answered: none", {**STOP, "o": "n5"}, {"c": 0, "sh": 0}),
    ("the whole stop under a roof, the bench not answered", {**STOP, "o": "n6"}, {"c": 3, "cv": 1}),
    ("lit, nothing else answered", {**STOP, "o": "n7"}, {"c": 0, "lt": 1}),
    ("a waste basket only: no answer the lens reads", {**STOP, "o": "n8"}, {"c": 0, "bi": 1}),
    (
        "the stop numbers agreeing through a number the stop had before",
        {**STOP, "o": "n9", "fid": "99,98"},
        {"c": 1, "sh": 0, "bn": 0, "n": ["98"]},
    ),
    (
        "another stop's number: the place decides",
        {**STOP, "o": "n10"},
        {"c": 1, "sh": 0, "bn": 0, "n": ["200"]},
    ),
    ("no OpenStreetMap stop at all", dict(STOP), None),
    ("an id the table does not have", {**STOP, "o": "n404"}, None),
    (
        "no OpenStreetMap stop, with a published suggestion",
        {**STOP, "f_shade": 80, "sg": "stop_shade_trees"},
        None,
    ),
    # The City's own shelters (M4.5, `cs`): a City shelter counts as a shelter whatever
    # OpenStreetMap says, and where OpenStreetMap says there is none the two disagree, so the stop
    # gets a survey and no request for a shelter.
    ("a City shelter, OpenStreetMap not surveyed", {**STOP, "o": "n11", "cs": 1}, {"c": 0}),
    ("a City shelter, no OpenStreetMap stop", {**STOP, "cs": 1}, None),
    (
        "a City shelter, OpenStreetMap agreeing, the bench answered",
        {**STOP, "o": "n12", "cs": 1},
        {"c": 3, "sh": 1, "bn": 1, "n": ["100"]},
    ),
    (
        "two City shelters, OpenStreetMap saying there is none: they disagree",
        {**STOP, "o": "n13", "cs": 2},
        {"c": 1, "sh": 0, "bn": 0, "lt": 1},
    ),
    (
        "a City shelter, OpenStreetMap saying the stop is under a roof",
        {**STOP, "o": "n14", "cs": 1},
        {"c": 3, "sh": 0, "cv": 1, "bn": 1},
    ),
    ("a subway station: left as it is", {"id": "sp102", "sid": "102", "md": 4}, {"c": 1, "sh": 0}),
    (
        "a trolley tunnel station: no mark, left as it is",
        {"id": "sp283", "sid": "283", "md": 2, "b": 12},
        None,
    ),
]


def build() -> dict[str, Any]:
    return {
        "not_surveyed": NOT_SURVEYED,
        "cases": [
            {"name": name, "tile": tile, "osm": osm, "joined": join_published(tile, osm)}
            for name, tile, osm in CASES
        ],
    }


if __name__ == "__main__":
    FIXTURE.write_text(json.dumps(build(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE}")
