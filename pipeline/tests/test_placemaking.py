"""The placemaking lens (M3.4): its own factors (far from a park, no public art nearby, on or near a
commercial corridor), its suggestions, the reports to Philly311 from the blocks a lot faces, and
how the lots layer and the lot pages carry them (placekeepers.derive.placemaking).

No network: snapshots are tiny Parquet files around the parcels of tests/test_lenses.py (squares
of 10 meters; the first sits at the origin, the others run east every 300 meters, one lies far to
the north east and one 1,500 meters to the north).
"""

from __future__ import annotations

import json
from datetime import date, timedelta

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import LineString, Point

from placekeepers.derive import lenses, placemaking
from placekeepers.derive.placemaking import (
    ART_REQUEST,
    COMMUNITY_GARDEN,
    REPORT_DARK_LIGHT,
    REPORT_DUMPING,
    REPORT_GRAFFITI,
    SEATING_AND_SHADE,
    coarse,
    facing_blocks,
    is_park,
    lot_condition_bits,
    near_any,
    nearest_distances,
    open_condition_bits,
    suggestions_for,
    with_more,
)
from placekeepers.derive.street_safety import StreetNetwork, to_meters
from placekeepers.publish import publish

from .conftest import install_snapshot
from .test_art import city_row, city_table, wikidata_row, wikidata_table
from .test_lenses import AS_OF, NOW, WHEN, at, install_lens_inputs, rect, wkb


def point_at(east: float, north: float) -> Point:
    lat, lng = at(east, north)
    return Point(lng, lat)


def line_at(*points: tuple[float, float]) -> LineString:
    return LineString([(at(e, n)[1], at(e, n)[0]) for e, n in points])


def meters(*shapes) -> np.ndarray:
    return to_meters(np.array(shapes, dtype=object))


# ---------------------------------------------------------------------------------------------
# Small pieces


def test_parks_are_park_land_people_can_use() -> None:
    assert is_park({"property_classification": "PARK", "ppr_use": "NEIGHBORHOOD_PARK"})
    assert is_park({"property_classification": "PARK", "ppr_use": "RECREATION_SITE"})
    assert is_park({"property_classification": "PATHWAY", "ppr_use": "GREENWAY"})
    assert is_park({"property_classification": "URBAN_AGRICULTURE", "ppr_use": "GARDEN_FARM"})
    # A named park on a traffic island counts; a planted median with no park use does not.
    assert is_park({"property_classification": "TRAFFIC_ISLAND_MEDIAN", "ppr_use": "SQUARE_PLAZA"})
    assert not is_park({"property_classification": "TRAFFIC_ISLAND_MEDIAN", "ppr_use": "OTHER"})
    assert not is_park({"property_classification": "TRAFFIC_ISLAND_MEDIAN", "ppr_use": None})
    # Work yards and golf courses are not parks people can use.
    assert not is_park({"property_classification": "OPERATIONAL_INTERNAL", "ppr_use": "OPERATIONS"})
    assert not is_park({"property_classification": "MANAGED_SITE", "ppr_use": "OPERATIONS"})
    assert not is_park({"property_classification": "MANAGED_SITE", "ppr_use": "GOLF"})


def test_ranks_are_rounded_to_fives() -> None:
    assert coarse([0, 2, 3, 47, 48, 97, 98, 100, None]) == [0, 0, 5, 45, 50, 95, 100, 100, None]
    assert coarse([]) == []


def test_lots_get_seating_a_garden_and_art_by_their_neighbors_and_parks() -> None:
    many = {"f_neighbors": 50, "f_park": 50}
    assert suggestions_for(True, many, 401.0, 0, 1000) == [
        SEATING_AND_SHADE,
        COMMUNITY_GARDEN,
        ART_REQUEST,
    ]
    # Art only where none of the two lists stands within a 5 minute walk.
    assert suggestions_for(True, many, 400.0, 0, 1000) == [SEATING_AND_SHADE, COMMUNITY_GARDEN]
    # Fewer neighbors than at half the places: no seating and no art, but a garden where parks
    # are far and at least 1,000 people live within a 5 minute walk.
    few = {"f_neighbors": 49, "f_park": 80}
    assert suggestions_for(True, few, 5000.0, 0, 1000) == [COMMUNITY_GARDEN]
    # Unknown factors suggest nothing; without the art lists, no art card.
    assert suggestions_for(True, {}, None, 0, 5000) == []
    assert suggestions_for(True, {"f_neighbors": 90}, None, 0) == [SEATING_AND_SHADE]
    # Buildings get none of them, not even the reports.
    assert suggestions_for(False, many, 900.0, 7, 5000) == []


def test_a_garden_needs_a_thousand_people_within_a_five_minute_walk() -> None:
    far = {"f_neighbors": 49, "f_park": 100}
    assert placemaking.GARDEN_MIN_PEOPLE == 1000
    assert suggestions_for(True, far, None, 0, 1000) == [COMMUNITY_GARDEN]
    # Far from a park, but almost no one lives around: no garden.
    assert suggestions_for(True, far, None, 0, 999) == []
    assert suggestions_for(True, far, None, 0, 0) == []
    # When the walking measures do not know how many people live around, no garden either.
    assert suggestions_for(True, far, None, 0, None) == []
    assert suggestions_for(True, far, None, 0) == []
    # Many people, but a park close by: no garden.
    assert suggestions_for(True, {"f_park": 45}, None, 0, 9000) == []


def test_reports_follow_the_open_requests_in_the_order_of_the_layers() -> None:
    assert suggestions_for(True, {}, None, 1) == [REPORT_DUMPING]
    assert suggestions_for(True, {}, None, 6) == [REPORT_DARK_LIGHT, REPORT_GRAFFITI]
    assert suggestions_for(True, {"f_park": 99}, None, 7, 2000) == [
        COMMUNITY_GARDEN,
        REPORT_DUMPING,
        REPORT_DARK_LIGHT,
        REPORT_GRAFFITI,
    ]


def test_placemaking_suggestions_follow_the_first_ones_and_only_those_the_registry_has() -> None:
    first = ["clean_and_green", "plant_shade_trees"]
    assert with_more(first, [SEATING_AND_SHADE, "clean_and_green"], None) == [
        *first,
        SEATING_AND_SHADE,
    ]
    assert with_more(first, [SEATING_AND_SHADE, ART_REQUEST], {ART_REQUEST}) == [
        *first,
        ART_REQUEST,
    ]


def test_distances_run_to_the_edge_of_an_area_and_are_zero_inside() -> None:
    park = shapely.box(*at(0, 0)[::-1], *at(100, 100)[::-1])
    points = meters(point_at(50, 50), point_at(150, 50), point_at(50, 300))
    found = nearest_distances(points, meters(park))
    assert found[0] == 0
    assert found[1] == pytest.approx(50, abs=1)
    assert found[2] == pytest.approx(200, abs=1)
    # No areas at all: every distance is unknown, never zero.
    assert nearest_distances(points, np.array([], dtype=object)) == [None, None, None]
    assert nearest_distances(np.array([], dtype=object), meters(park)) == []


def test_a_lot_is_near_a_corridor_within_fifty_meters() -> None:
    corridor = meters(rect(0, 0, 100, 20))
    points = meters(point_at(50, 10), point_at(50, 65), point_at(50, 75))
    assert near_any(points, corridor, 50.0) == [100, 100, 0]
    assert near_any(points, np.array([], dtype=object), 50.0) == [0, 0, 0]


# Blocks a lot faces, and the open requests on them

#: seg_id, name, class, line: a street south of the first parcel, one south of the second, a
#: driveway (not a street block) beside the third, and a street far from every parcel.
STREETS = [
    (11, "SAMPLE ST", 5, line_at((-60, -10), (60, -10))),
    (12, "SAMPLE ST", 5, line_at((240, -10), (360, -10))),
    (13, "SAMPLE DRIVEWAY", 6, line_at((540, -10), (660, -10))),
    (14, "FAR ST", 5, line_at((-60, 200), (60, 200))),
]


def street_table() -> pa.Table:
    return pa.table(
        {
            "seg_id": [s[0] for s in STREETS],
            "stname": [s[1] for s in STREETS],
            "class": [s[2] for s in STREETS],
            "responsibl": ["CITY"] * len(STREETS),
            "geometry": [wkb(s[3]) for s in STREETS],
        }
    )


NEWEST = date(2026, 10, 2)


def request(code: str, status: str, day: date, east: float, north: float) -> dict:
    lat, lng = at(east, north)
    return {
        "service_code": code,
        "status": status,
        "requested": day,
        "closed": None if status == "Open" else day + timedelta(days=2),
        "lat": lat,
        "lng": lng,
    }


def requests_table() -> pa.Table:
    rows = [
        # Dumping still open in front of the first parcel.
        request("SR-ST02", "Open", NEWEST, 10, -14),
        # An alley light still open, and graffiti already removed, in front of the second.
        request("SR-ST06", "Open", NEWEST - timedelta(days=3), 300, -8),
        request("SR-CL01", "Closed", NEWEST - timedelta(days=5), 310, -12),
        # Graffiti still open, but too old for the 90 day window.
        request("SR-CL01", "Open", NEWEST - timedelta(days=120), 0, -12),
        # Graffiti still open on a block no parcel faces.
        request("SR-CL01", "Open", NEWEST, 0, 205),
    ]
    return pa.table({key: [row[key] for row in rows] for key in rows[0]})


def test_a_lot_faces_the_blocks_within_twenty_meters_of_it() -> None:
    network = StreetNetwork.from_table(street_table())
    assert network.ids == [11, 12, 14]  # a driveway is not a street block
    shapes = meters(rect(0, 0, 10, 10), rect(300, 0, 10, 10), rect(0, 40, 10, 10))
    faced = facing_blocks(shapes, network)
    assert [[network.ids[b] for b in f] for f in faced] == [[11], [12], []]


def test_only_open_requests_in_the_window_count_for_a_lot() -> None:
    network = StreetNetwork.from_table(street_table())
    bits = open_condition_bits(requests_table().to_pylist(), network)
    by_id = {network.ids[block]: value for block, value in bits.items()}
    assert by_id == {11: 1, 12: 2, 14: 4}
    faced = [[network.ids.index(11)], [network.ids.index(12)], [], [0, 1]]
    assert lot_condition_bits(faced, bits) == [1, 2, 0, 3]
    assert open_condition_bits([], network) == {}


# ---------------------------------------------------------------------------------------------
# A whole run on tiny snapshots


def install_placemaking_inputs(ctx, skip: tuple[str, ...] = ()) -> None:
    """Every input of the placemaking lens except `skip`, around the parcels of
    tests/test_lenses.py, and the walking measures' people within a 5 minute walk."""
    derived = ctx.cache.root / "derived"
    # People within a 5 minute walk, as derive.walk would rank them (`f_neighbors`) and count them
    # (`people_5min`). The last lot has one person too few for a community garden.
    ranks = {"500000001": 80, "500000002": 20, "500000003": 40, "500000004": 60}
    ranks |= {"500000005": 0, "500000006": 90, "500000008": 60}
    people = {"500000001": 4200, "500000002": 600, "500000003": 2100, "500000004": 3000}
    people |= {"500000005": 0, "500000006": 5100, "500000008": 999}
    walk = {
        "opa": list(ranks),
        "f_walk": pa.array([50] * len(ranks), pa.int16()),
        "f_neighbors": pa.array(list(ranks.values()), pa.int16()),
        "f_dest": pa.array([50] * len(ranks), pa.int16()),
        "people_5min": pa.array([people[opa] for opa in ranks], pa.int32()),
    }
    pq.write_table(pa.table(walk), derived / "walk_factors.parquet")
    # A park just west of the first parcel; a golf course over the far parcel, which is no park.
    parks = pa.table(
        {
            "official_name": ["Sample Park", "Sample Golf Club"],
            "property_classification": ["PARK", "MANAGED_SITE"],
            "ppr_use": ["NEIGHBORHOOD_PARK", "GOLF"],
            "geometry": [wkb(rect(-60, 0, 40, 40)), wkb(rect(4900, 4900, 300, 300))],
        }
    )

    # The City's work on the second parcel, one inside a building by the fourth (left out) and
    # one no longer on view by the fifth (left out); Wikidata's by the third. (The art tests' own
    # places are elsewhere, so each shape is given here.)
    def city(number: int, east: float, **kw) -> dict:
        return city_row(number, 0, 0, geometry=wkb(rect(east - 5, -5, 20, 20)), **kw)

    city_works = city_table(
        [
            city(1, 300, title="Sample Sculpture"),
            city(2, 900, title="Sample Lobby Work", location_name="Sample Hall, lobby"),
            city(3, 1200, title="Sample Old Work", status="Inaccessible"),
        ]
    )
    lat, lng = at(605, 5)
    statue = wikidata_row(
        "Q9900001", 0, 0, label="Sample Statue", lat=lat, lng=lng, geometry=wkb(Point(lng, lat))
    )
    wikidata = wikidata_table([statue])
    corridors = pa.table(
        {
            "objectid": [1],
            "name": ["Sample Avenue"],
            "survey_year": [2016],
            "corridor_type": [2],
            "geometry": [wkb(rect(250, -30, 100, 60))],
        }
    )
    for source_id, table, geometry, kinds in (
        ("ppr_properties", parks, True, ["Polygon"]),
        ("percent_for_art", city_works, True, ["Polygon"]),
        ("wikidata_art", wikidata, True, ["Point"]),
        ("commercial_corridors", corridors, True, ["Polygon"]),
        ("street_centerlines", street_table(), True, ["LineString"]),
        ("philly311_conditions", requests_table(), False, None),
    ):
        if source_id not in skip:
            install_snapshot(
                ctx, source_id, table, geometry=geometry, fetched_at=WHEN, geometry_types=kinds
            )


@pytest.fixture
def place_ctx(context_factory):
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_placemaking_inputs(ctx)
    return ctx


def test_a_run_gives_every_parcel_on_the_map_its_placemaking_factors(place_ctx) -> None:
    result = placemaking.run(place_ctx, AS_OF)
    rows = {r["opa"]: r for r in pq.read_table(result.path).to_pylist()}
    assert len(rows) == 7 and "500000007" not in rows  # the excluded parcel is not on the map

    # Far from a park: the first parcel is 25 meters from the park's edge (its point is in its
    # middle); the golf course over the far parcel does not count.
    assert rows["500000001"]["park_m"] == pytest.approx(25, abs=1)
    assert rows["500000001"]["f_park"] == 0
    assert rows["500000006"]["park_m"] > 6000
    assert rows["500000006"]["f_park"] == 85  # 86, rounded to fives
    order = sorted(rows, key=lambda opa: rows[opa]["park_m"])
    assert [rows[o]["f_park"] for o in order] == sorted(rows[o]["f_park"] for o in order)

    # No public art nearby: the City's work stands on the second parcel and Wikidata's by the
    # third; the work inside a building and the one no longer on view are left out.
    assert rows["500000002"]["art_m"] <= 5
    assert rows["500000003"]["art_m"] <= 5
    assert rows["500000004"]["art_m"] == pytest.approx(295, abs=5)  # to Wikidata's, not the lobby
    assert rows["500000005"]["art_m"] == pytest.approx(600, abs=5)
    assert rows["500000002"]["f_art"] == 0
    assert rows["500000006"]["f_art"] == 85

    # On or near a commercial corridor: only the second parcel.
    assert {opa: r["f_corr"] for opa, r in rows.items()} == {
        "500000001": 0,
        "500000002": 100,
        "500000003": 0,
        "500000004": 0,
        "500000005": 0,
        "500000006": 0,
        "500000008": 0,
    }
    assert rows["500000002"]["corridor"] == "Sample Avenue"

    # Suggestions, lots only: the first has many neighbors and open dumping in front; the second,
    # a LandCare lot, an alley light out; the far ones many neighbors and no park or art near, but
    # the last only 999 people within a 5 minute walk, one too few for a community garden.
    assert rows["500000001"]["sg"] == "seating_and_shade,report_dumping"
    assert rows["500000001"]["open_311"] == 1
    assert rows["500000002"]["sg"] == "report_dark_light"
    assert rows["500000003"]["sg"] == ""  # a building
    assert rows["500000003"]["open_311"] == 0
    assert rows["500000006"]["sg"] == "seating_and_shade,community_garden,art_request"
    assert rows["500000008"]["sg"] == "seating_and_shade,art_request"

    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["parcels"] == 7
    assert summary["inputs"]["parks"] == 1 and summary["inputs"]["park_properties_left_out"] == 1
    assert summary["inputs"]["art_percent_for_art"] == 1
    assert summary["inputs"]["art_percent_for_art_inside"] == 1
    assert summary["inputs"]["art_wikidata_art"] == 1
    assert summary["suggestions"]["seating_and_shade"] == 3
    assert summary["suggestions"]["community_garden"] == 1
    assert summary["suggestions"]["report_graffiti"] == 0
    assert summary["missing_sources"] == []


def test_openstreetmap_art_is_never_read() -> None:
    assert "osm_philadelphia" not in placemaking.SOURCES


def test_without_a_source_its_placemaking_factor_is_left_out(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_placemaking_inputs(
        ctx, skip=("commercial_corridors", "wikidata_art", "philly311_conditions")
    )
    result = placemaking.run(ctx, AS_OF)
    assert result.missing_sources == ["wikidata_art", "commercial_corridors"]
    found = placemaking.load_placemaking(result.path)
    assert all("f_corr" not in f.properties for f in found.values())
    # The art factor is measured from the City's list alone, and says so.
    assert all("f_art" in f.properties for f in found.values())
    assert any("percent_for_art alone" in note for note in result.notes)
    assert (
        "The placemaking lens ran without commercial_corridors, so f_corr is left out"
        in result.notes
    )
    assert any("no lot gets a report to Philly311" in note for note in result.notes)
    assert not any(s.startswith("report_") for f in found.values() for s in f.suggestions)


def test_without_either_art_list_there_is_no_art_factor_and_no_art_card(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_lens_inputs(ctx)
    install_placemaking_inputs(ctx, skip=("percent_for_art", "wikidata_art"))
    found = placemaking.load_placemaking(placemaking.run(ctx, AS_OF).path)
    assert all("f_art" not in f.properties for f in found.values())
    assert not any(ART_REQUEST in f.suggestions for f in found.values())


def test_the_placemaking_lens_needs_the_vacancy_model(context_factory) -> None:
    with pytest.raises(RuntimeError, match="vacancy model"):
        placemaking.run(context_factory(now=NOW), AS_OF)


def test_the_lots_layer_and_the_lot_pages_carry_the_placemaking_lens(place_ctx, tmp_path) -> None:
    lenses.run(place_ctx, AS_OF)
    placemaking.run(place_ctx, AS_OF)
    publish(place_ctx, tmp_path / "data")
    features = json.loads((tmp_path / "data" / "tiles" / "lots.parcels.geojson").read_text())
    properties = {f["properties"]["id"]: f["properties"] for f in features["features"]}
    first = properties["500000001"]
    assert {"f_park", "f_art", "f_corr", "f_vacant"} <= set(first)
    assert first["sg"] == "clean_and_green,seating_and_shade,report_dumping"
    assert properties["500000002"]["f_corr"] == 100
    assert properties["500000003"]["sg"] == "seal_abandoned_building"
    # The lot pages list the same suggestions and carry the same lens values as the map.
    shards = sorted((tmp_path / "data" / "dossiers").glob("[0-9]*.json"))
    dossiers = {
        opa: d for shard in shards for opa, d in json.loads(shard.read_text())["parcels"].items()
    }
    assert "500000001" in dossiers
    for opa, dossier in dossiers.items():
        if opa in properties:
            assert ",".join(dossier["suggestions"]) == properties[opa]["sg"]
            tile = properties[opa]
            assert dossier.get("lens", {}) == {
                k: v for k, v in tile.items() if k.startswith("f_") or k == "fp"
            }


def test_the_registry_lens_lists_its_factors_with_their_evidence(place_ctx) -> None:
    lens = place_ctx.registry.lenses["placemaking"]
    assert lens.applies_to == "parcel"
    assert {f.field: f.evidence for f in lens.factors} == {
        "f_neighbors": "context",
        "f_dest": "mixed",
        "f_walk": "mixed",
        "f_park": "context",
        "f_art": "context",
        "f_corr": "mixed",
    }
    assert [p.label for p in lens.presets] == [
        "Balanced",
        "Most neighbors",
        "Where people already walk",
        "Far from a park",
    ]
    suggestions = place_ctx.registry.suggestions
    for report in (REPORT_DUMPING, REPORT_DARK_LIGHT, REPORT_GRAFFITI):
        assert suggestions[report].routes == ["report_to_311"]
    for item in placemaking.PLACEMAKING_SUGGESTIONS:
        text = f"{suggestions[item].label} {suggestions[item].summary}".lower()
        assert "police" not in text and "enforce" not in text
