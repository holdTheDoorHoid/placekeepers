"""Warming and cooling sites and playgrounds in tiles/places.pmtiles (M4.7, issue #43): one marker
per place where a site is one of our libraries or recreation centers, the City's words as listed,
and no credit line for the sites (owner, 2026-10-09)."""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.publish import credited
from placekeepers.publish.city_places import (
    build_cooling,
    build_libraries,
    build_playgrounds,
    build_recreation,
    name_words,
)

AS_OF = date(2026, 10, 9)
#: About 0.0001 degrees of latitude is 11 meters.
LIB = (-75.1500, 39.9900)
REC = (-75.1600, 39.9800)


def snapshot(
    tmp_path: Path, name: str, rows: list[dict], points: list[tuple[float, float]]
) -> Path:
    columns = {key: [row.get(key) for row in rows] for key in rows[0]}
    columns["geometry"] = [shapely.to_wkb(shapely.Point(*p), flavor="iso") for p in points]
    path = tmp_path / f"{name}.parquet"
    pq.write_table(pa.table(columns), path)
    return path


def site(oid: int, name: str, kind: str, **more) -> dict:
    return {
        "objectid": oid,
        "site_name": name,
        "site_type": kind,
        "site_address": more.get("address", "1 Sample St."),
        "site_hours": more.get("hours", "9a-7p"),
        "warming_site": more.get("warming"),
        "cooling_site": more.get("cooling"),
        "site_status": more.get("status"),
        "capacity": more.get("capacity"),
        "services_offered": more.get("services"),
        "handicap_accessible": more.get("access"),
        "water_station": more.get("water"),
        "facilities_include": more.get("facilities"),
    }


def paths_for(tmp_path: Path) -> dict[str, Path]:
    sites = [
        # The library, 3 meters from ours: the same place, whatever the name.
        (site(1, "Sample", "Library", warming="yes", cooling="yes", status="open"), LIB),
        # Listed twice: the fuller record stays.
        (site(2, "Sample Library", "Library "), (LIB[0], LIB[1] + 0.00003)),
        # A recreation center 90 meters from ours with a word of its name in common.
        (
            site(
                3,
                "Lee Rec Center",
                "PPR",
                cooling="yes",
                warming="no",
                status="closed",
                services="Activities for  older adults 55+,  please call 215-685-271",
                capacity=0,
            ),
            (REC[0], REC[1] + 0.0008),
        ),
        # A hub 60 meters from the same center, with no word in common: a place of its own.
        (site(4, "Hospitality Hub", "PPR", status="open"), (REC[0], REC[1] - 0.00055)),
        # A community partner beside the library: never one of our places.
        (
            site(
                5,
                "Sample Library Partner",
                "Community Partner",
                cooling="yes",
                status="open",
                access="yes",
                water="yes",
                facilities="Public Restrooms",
                capacity=20,
            ),
            (LIB[0] + 0.0001, LIB[1]),
        ),
    ]
    return {
        "warming_cooling_sites": snapshot(
            tmp_path, "sites", [s for s, _ in sites], [p for _, p in sites]
        ),
        "library_locations": snapshot(
            tmp_path,
            "libraries",
            [
                {
                    "objectid": 7,
                    "building": "Sample Library",
                    "address": "1 Sample St",
                    "zip_code": "19133",
                    "phone_number": None,
                    "library_url": None,
                }
            ],
            [LIB],
        ),
        "ppr_program_sites": snapshot(
            tmp_path,
            "rec",
            [
                {
                    "objectid": 8,
                    "park_name": "Robert E Lee Playground",
                    "program_type": "PPR_REC",
                    "site_class": "A",
                    "building": "Y",
                    "gym": "Y",
                },
                {
                    "objectid": 9,
                    "park_name": "Other Pool",
                    "program_type": "POOL",
                    "site_class": "A",
                    "building": "N",
                    "gym": "N",
                },
            ],
            [REC, REC],
        ),
    }


def read(path: Path) -> dict[str, dict]:
    features = json.loads(path.read_text(encoding="utf-8"))["features"]
    return {f["properties"]["id"]: f["properties"] for f in features}


def test_names_are_compared_by_the_words_that_say_which_place() -> None:
    assert name_words("Lucien E. Blackwell West Philadelphia Regional Library") >= {"blackwell"}
    assert name_words("Coleman NW Regional") & name_words("Joseph E. Coleman Northwest Library")
    assert not name_words("Lloyd Hall Hospitality Hub") & name_words("East Fairmount Park")
    assert name_words("Free Library Branch") == set()


def test_one_marker_per_place_and_the_citys_words_as_listed(tmp_path: Path) -> None:
    paths = paths_for(tmp_path)
    out = tmp_path / "cooling.geojson"
    result = build_cooling(None, paths, out, AS_OF)
    found = read(out)
    assert sorted(found) == ["cool1", "cool3", "cool4", "cool5"]  # cool2 was listed twice
    assert found["cool1"] == {
        "id": "cool1",
        "nm": "Sample",
        "k": 1,
        "ad": "1 Sample St.",
        "hr": "9a-7p",
        "c": 1,
        "w": 1,
        "st": 1,
        "pl": "lib7",
        "pn": "Sample Library",
    }
    lee = found["cool3"]
    assert (lee["pl"], lee["pn"], lee["st"], lee["c"], lee["w"]) == (
        "rec8",
        "Robert E Lee Playground",
        0,
        1,
        0,
    )
    # A phone number the list cuts short is left out of the services; a capacity of 0 is no
    # capacity.
    assert lee["sv"] == "Activities for older adults 55+"
    assert "cap" not in lee
    assert "pl" not in found["cool4"] and found["cool4"]["k"] == 2
    partner = found["cool5"]
    assert "pl" not in partner
    assert (partner["k"], partner["ada"], partner["ws"], partner["rr"], partner["cap"]) == (
        3,
        1,
        1,
        1,
        20,
    )
    assert result.notes[0] == (
        "cooling: 4 warming and cooling sites (3 listed as open, 1 as closed); 1 are Free Library "
        "branches and 1 recreation centers already on the map, drawn once; 1 listed twice kept once"
    )


def test_libraries_and_recreation_centers_know_the_site_they_also_are(tmp_path: Path) -> None:
    paths = paths_for(tmp_path)
    libraries = tmp_path / "libraries.geojson"
    build_libraries(None, paths, libraries, AS_OF)
    assert read(libraries)["lib7"]["cc"] == "cool1"
    recreation = tmp_path / "recreation.geojson"
    build_recreation(None, paths, recreation, AS_OF)
    assert read(recreation)["rec8"]["cc"] == "cool3"
    # Without the City's list of sites, nothing is marked.
    del paths["warming_cooling_sites"]
    build_libraries(None, paths, libraries, AS_OF)
    assert "cc" not in read(libraries)["lib7"]


def test_playgrounds_keep_the_ages_and_the_year_installed(tmp_path: Path) -> None:
    rows = [
        {"objectid": 1, "park_name": "Vogt  Playground", "age_range": "5_12_YEARS"},
        {"objectid": 2, "park_name": "Vogt Playground", "age_range": "UNKNOWN"},
        {"objectid": 3, "park_name": "Future Playground", "age_range": " "},
    ]
    installed = [datetime(2008, 5, 1), None, datetime(2031, 1, 1)]
    path = snapshot(tmp_path, "pg", rows, [(-75.15, 39.99), (-75.151, 39.99), (-75.152, 39.99)])
    table = pq.read_table(path).append_column(
        "date_installed", pa.array(installed, pa.timestamp("ms"))
    )
    pq.write_table(table, path)
    out = tmp_path / "playgrounds.geojson"
    result = build_playgrounds(None, {"ppr_playgrounds": path}, out, AS_OF)
    assert list(read(out).values()) == [
        {"id": "pg1", "nm": "Vogt Playground", "ag": 2, "yr": 2008},
        {"id": "pg2", "nm": "Vogt Playground"},
        # A day in the future is a typing error: no year.
        {"id": "pg3", "nm": "Future Playground"},
    ]
    assert result.notes == ["playgrounds: 3 playgrounds (Parks and Recreation)"]


def test_the_sites_are_never_credited_on_a_tile_file(context_factory) -> None:
    registry = context_factory().registry
    assert registry.sources["warming_cooling_sites"].license == "unstated_uncredited"
    assert registry.licenses["unstated_uncredited"].credit is False
    assert not credited(registry, "warming_cooling_sites")
    assert credited(registry, "library_locations") and credited(registry, "ppr_playgrounds")


def test_the_registry_layers(context_factory) -> None:
    layers = context_factory().registry.layers
    cooling, playgrounds = layers["cooling_centers"], layers["playgrounds"]
    assert (cooling.group, cooling.source_layer, cooling.file) == (
        "public_places",
        "cooling",
        "tiles/places.pmtiles",
    )
    assert "Not live" in cooling.description
    assert (playgrounds.group, playgrounds.source_layer) == ("placemaking", "playgrounds")
    for layer in (cooling, playgrounds):
        assert layer.default.field is False and layer.default.analysis is False
        assert layer.release == "v0.4"
