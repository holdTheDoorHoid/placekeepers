"""Cases for the public art join parity check between the pipeline and the web app (decision D1 of
docs/VERIFICATION_V0_2.md, applied to public art by M3.2).

A work of public art in two or three sources is published as one record per source, each holding
only what its own source says (tiles/art.pmtiles, docs/CONTRACTS.md section 4). The web app joins
a work's records in the visitor's browser (web/src/art/join.ts) and must show exactly what the
pipeline's reference join gives (placekeepers.derive.art.join_published, the same as
ArtWork.joined). This file builds works from invented records and writes their published records
and the joined answer to tests/fixtures/art_join_parity.json:

* tests/test_art_join_parity.py checks that the file matches what the pipeline gives today;
* web/tests/art_join_parity.test.ts checks that the web app gives the same answers.

After changing the join or the published records, write the file again with:

    python pipeline/tests/art_join_cases.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from placekeepers.derive.art import (
    CITY,
    OSM,
    SOURCES,
    TY_MOSAIC,
    TY_MURAL,
    TY_OTHER,
    TY_SCULPTURE,
    TY_STATUE,
    WIKIDATA,
    ArtRecord,
    ArtWork,
)

FIXTURE = Path(__file__).parent / "fixtures" / "art_join_parity.json"

LNG, LAT = -75.1636, 39.9524


def rec(source: str, key: str, step: int = 0, **kw: Any) -> ArtRecord:
    """A record a few meters east of City Hall; the City's carry their number."""
    if source == CITY:
        kw.setdefault("city_id", int(key[2:]))
    return ArtRecord(source=source, key=key, lng=LNG + step * 0.0001, lat=LAT, **kw)


#: (name, the work's records)
CASES: list[tuple[str, list[ArtRecord]]] = [
    (
        "a statue in all three sources: the City's title, Wikidata's artist and Wikipedia article, "
        "OpenStreetMap's point and website",
        [
            rec(
                CITY,
                "pa224",
                title="Sample Pin",
                artist="Example, Avery",
                year=1976,
                ty=TY_SCULPTURE,
                medium="Metal, steel",
                location="Sample Square",
                doc="https://example.org/224.pdf",
            ),
            rec(
                OSM,
                "n101",
                1,
                title="Sample Pin Statue",
                artist="Avery Example",
                ty=TY_STATUE,
                website="https://example.org/pin",
            ),
            rec(
                WIKIDATA,
                "Q201",
                2,
                title="Sample Pin",
                artist="Avery Q. Example",
                year=1977,
                ty=TY_SCULPTURE,
                wikipedia="https://en.wikipedia.org/wiki/Sample_Pin",
                website="https://example.org/wd",
            ),
        ],
    ),
    (
        "the City's title is unknown, so OpenStreetMap's name is the title",
        [
            rec(
                CITY,
                "pa9",
                title="Title unknown (three reliefs)",
                weak_title=True,
                artist="Lee Felt",
                ty=TY_OTHER,
            ),
            rec(OSM, "n102", 1, title="Three Reliefs", ty=TY_OTHER),
        ],
    ),
    (
        "the City gives no title and Wikidata does; the kind comes from Wikidata",
        [
            rec(
                CITY,
                "pa26",
                artist=None,
                year=1968,
                ty=TY_OTHER,
                inside=True,
                location="Sample Chapel (interior)",
            ),
            rec(WIKIDATA, "Q202", 1, title="Sample Window", artist="Robin Glass", ty=TY_MOSAIC),
        ],
    ),
    ("an untitled mural OpenStreetMap alone has", [rec(OSM, "w103", ty=TY_MURAL)]),
    (
        "a mosaic Wikidata alone has, with its article and website",
        [
            rec(
                WIKIDATA,
                "Q203",
                title="Sample Gardens",
                ty=TY_MOSAIC,
                wikipedia="https://en.wikipedia.org/wiki/Sample_Gardens",
                website="https://example.org/gardens",
            ),
        ],
    ),
    (
        "a memorial by Wikidata's commemorates: no name from either source",
        [
            rec(OSM, "n104", title="Sam Sample", artist="Quill", ty=TY_STATUE),
            rec(
                WIKIDATA,
                "Q204",
                1,
                title="Statue of Sam Sample",
                ty=TY_STATUE,
                memorial=True,
                wikipedia="https://en.wikipedia.org/wiki/Sam_Sample",
            ),
        ],
    ),
    (
        "a memorial the City alone lists: only its number and document",
        [
            rec(
                CITY,
                "pa66",
                title="In Memory of Chris Example",
                artist="Avery Quill",
                year=1983,
                ty=TY_OTHER,
                memorial=True,
                doc="https://example.org/66.pdf",
                inside=True,
            ),
        ],
    ),
    (
        "OpenStreetMap does not say the kind, the City does",
        [
            rec(
                CITY,
                "pa51",
                title="Open Air Sample",
                artist="Magda Example",
                ty=TY_SCULPTURE,
                medium="Brushed stainless steel",
            ),
            rec(OSM, "n105", 1, title="Open-Air Sample", ty=TY_OTHER, medium="Steel"),
        ],
    ),
]


def build() -> dict[str, Any]:
    cases = []
    for name, records in CASES:
        work = ArtWork(sorted(records, key=lambda r: SOURCES.index(r.source)))
        cases.append(
            {
                "name": name,
                "records": [props for props, _ in work.features()],
                "joined": work.joined(),
            }
        )
    return {
        "about": (
            "Written by pipeline/tests/art_join_cases.py. Each case is one work of public art: its "
            "records as tiles/art.pmtiles publishes them, one per source, and what the map shows "
            "when the browser joins them."
        ),
        "cases": cases,
    }


if __name__ == "__main__":
    FIXTURE.write_text(json.dumps(build(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {FIXTURE}")
