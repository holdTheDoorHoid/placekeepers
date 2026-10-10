"""Streets and stops (M4.5, issue #41): the City's bus shelters, street poles, traffic calming
devices and school crossing guard posts, from the adapters to the published layers, and the City's
shelters in the transit comfort lens. Everything runs on small made up data; nothing touches the
network except through the fake servers."""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely

from placekeepers.adapters.streets_stops import (
    BusShelters,
    CrossingGuards,
    StreetPoles,
    TrafficCalming,
)
from placekeepers.cache import RawFetch
from placekeepers.derive.bus_stops import SeptaPoint
from placekeepers.derive.street_safety import StreetNetwork, points_in_meters
from placekeepers.derive.streets_stops import (
    BY_NUMBER,
    BY_PLACE,
    LAMP_LED,
    LAMP_OTHER,
    LAMP_UNKNOWN,
    NO_LAMP,
    CityShelter,
    calming_on_blocks,
    install_day,
    lamp_kind,
    match_shelters,
    owner_code,
    poles_on_blocks,
    shelter_number,
    shelter_place,
    title_street,
)
from placekeepers.derive.transit_comfort import (
    NOT_SURVEYED,
    SeptaStop,
    comfort_for_stops,
    join_published,
    stop_suggestions,
)
from placekeepers.publish.conditions import condition_builder
from placekeepers.publish.streets import build_memorial_layer, build_segments
from placekeepers.publish.streets_stops import (
    build_calming,
    build_city_shelters,
    build_guards,
    build_poles,
    lamps_near,
    shelter_name,
)
from placekeepers.publish.tiles import TILE_OPTIONS

from . import streets_fixtures as fx
from .conftest import FakeArcgis, arcgis_feature, install_snapshot
from .test_transit_comfort import comfort_paths, moved, publish_stops  # noqa: F401

AS_OF = date(2026, 10, 9)
FETCHED = "2026-10-09T14:00:00Z"


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text())["features"]


def props(path: Path) -> list[dict]:
    return [f["properties"] for f in features(path)]


# The adapters -------------------------------------------------------------------------------


def field(name: str, kind: str) -> dict[str, str]:
    return {"name": name, "type": f"esriFieldType{kind}"}


def run(adapter, tmp_path: Path) -> tuple[dict, Path]:
    dest = tmp_path / "raw"
    dest.mkdir(parents=True)
    info = adapter.fetch(dest)
    raw = RawFetch(
        source=adapter.id,
        fetch_id="x",
        fetched_at="2026-10-09T15:00:00Z",
        files=sorted(p.name for p in dest.iterdir()),
        info=info,
        dir=dest,
    )
    out = tmp_path / "snapshot.parquet"
    adapter.normalize(raw, out)
    return info, out


def shelter_server() -> FakeArcgis:
    fields = [
        field("objectid", "OID"),
        field("site", "String"),
        field("siteid", "String"),
        field("stopid", "String"),
        field("lat", "Double"),
        field("long", "Double"),
        field("productgroup", "String"),
    ]
    rows = [
        ("Chestnut St & 60th St -", "pa-002294", "419", "Static"),
        ("Roosevelt Blvd & Cottman Av - Shelter BLVD2078", "pa-1", "8-a", "Digital"),
        ("Market St & 10th St NW", "pa-2", "NJT4", "Static"),
    ]
    feats = [
        arcgis_feature(
            {
                "objectid": i + 1,
                "site": site,
                "siteid": siteid,
                "stopid": stopid,
                "lat": 39.96,
                "long": -75.15,
                "productgroup": kind,
            },
            fx.point(i * 50, 0),
        )
        for i, (site, siteid, stopid, kind) in enumerate(rows)
    ]
    return FakeArcgis(fields=fields, features=feats, geometry_type="esriGeometryPoint")


def test_shelters_keep_the_site_its_stop_number_and_its_panel_only(
    context_factory, tmp_path
) -> None:
    fake = shelter_server()
    ctx = context_factory(handler=fake)
    adapter = BusShelters(ctx.registry.sources["bus_shelters"], ctx)
    info, out = run(adapter, tmp_path)
    assert info["rows"] == 3
    asked = {r.url.params.get("outFields") for r in fake.requests if "resultOffset" in r.url.params}
    assert asked == {"objectid,site,siteid,stopid,productgroup"}
    assert fake.requests[0].url.path.endswith("/bus_transit_shelters/FeatureServer/0")
    table = pq.read_table(out)
    assert set(table.column_names) == {
        "objectid",
        "site",
        "siteid",
        "stopid",
        "productgroup",
        "geometry",
    }
    checks = {c.rule: c for c in adapter.extra_checks(out, None)}
    # "419" is a stop number; "8-a" and "NJT4" are not plain numbers.
    assert not checks["stop_numbers"].ok and "1 of 3 shelters" in checks["stop_numbers"].detail


def test_poles_ask_for_their_lamps_with_shorter_coordinates(context_factory, tmp_path) -> None:
    fields = [
        field("objectid", "OID"),
        field("pole_num", "Integer"),
        field("type", "String"),
        field("nlumin", "Integer"),
        field("owner", "String"),
        field("bulb_type", "String"),
        field("light_date", "Date"),
        field("psip_status", "String"),
        field("block", "String"),
        field("plate", "String"),
    ]
    rows = [(101, "WP", 1, "Streets", "LED"), (102, "SNP", None, "Streets", "UNKNOWN")]
    feats = [
        arcgis_feature(
            {
                "objectid": i + 1,
                "pole_num": number,
                "type": kind,
                "nlumin": lamps,
                "owner": owner,
                "bulb_type": bulb,
                "light_date": 1727740800000,
                "psip_status": "COMPLETED",
                "block": "100 BLOCK",
                "plate": "x",
            },
            fx.point(i * 30, 5),
        )
        for i, (number, kind, lamps, owner, bulb) in enumerate(rows)
    ]
    fake = FakeArcgis(fields=fields, features=feats, geometry_type="esriGeometryPoint")
    ctx = context_factory(handler=fake)
    adapter = StreetPoles(ctx.registry.sources["street_poles"], ctx)
    _, out = run(adapter, tmp_path)
    pages = [r.url.params for r in fake.requests if "resultOffset" in r.url.params]
    assert {p["geometryPrecision"] for p in pages} == {"6"}
    assert "block" not in pq.read_table(out).column_names
    checks = {c.rule: c for c in adapter.extra_checks(out, None)}
    assert checks["pole_numbers"].ok
    assert checks["lamps"].ok and "1 of 2 poles list their kind of lamp" in checks["lamps"].detail


def test_traffic_calming_and_crossing_guards_keep_only_what_the_map_shows(
    context_factory, tmp_path
) -> None:
    calming = FakeArcgis(
        fields=[
            field("objectid", "OID"),
            field("id", "String"),
            field("seg_id", "Integer"),
            field("install_dt", "Date"),
        ],
        features=[
            arcgis_feature(
                {"objectid": 1, "id": "SC-1", "seg_id": 3, "install_dt": 1690862400000},
                fx.point(60, 100),
            ),
            arcgis_feature(
                {"objectid": 2, "id": "SC-1", "seg_id": None, "install_dt": 1690862400000},
                fx.point(70, 100),
            ),
        ],
        geometry_type="esriGeometryPoint",
    )
    ctx = context_factory(handler=calming)
    adapter = TrafficCalming(ctx.registry.sources["traffic_calming"], ctx)
    _, out = run(adapter, tmp_path / "calming")
    checks = {c.rule: c for c in adapter.extra_checks(out, None)}
    # One of two devices names its block: fewer than the 80 percent expected.
    assert not checks["street_blocks"].ok
    guards = FakeArcgis(
        fields=[field("objectid", "OID"), field("address", "String"), field("node_id", "Integer")],
        features=[
            arcgis_feature(
                {"objectid": 1, "address": "BYBERRY & PROCTOR", "node_id": 204}, fx.point(0, 0)
            )
        ],
        geometry_type="esriGeometryPoint",
    )
    ctx = context_factory(handler=guards)
    adapter = CrossingGuards(ctx.registry.sources["crossing_guards"], ctx)
    _, out = run(adapter, tmp_path / "guards")
    assert set(pq.read_table(out).column_names) == {"objectid", "address", "node_id", "geometry"}


def test_every_source_is_a_city_layer_under_the_citys_terms(context_factory) -> None:
    ctx = context_factory()
    for source_id, service in (
        ("bus_shelters", "bus_transit_shelters"),
        ("street_poles", "Street_Poles"),
        ("traffic_calming", "traffic_calming_devices"),
        ("crossing_guards", "School_Crossing_Guards"),
    ):
        source = ctx.registry.sources[source_id]
        assert source.endpoint.kind == "arcgis" and source.endpoint.service == service
        assert source.endpoint.url is None  # the City's own organization
        assert source.license == "city_terms"
        assert source.homepage.startswith("https://opendataphilly.org/datasets/")
        assert "Build Philly Now" not in source.attribution


# City shelters at SEPTA's stops ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("text", "number"),
    [
        ("419", "419"),
        (" 21529 ", "21529"),
        ("22513-a", "22513"),
        ("8-b", "8"),
        ("SEPTA357", "357"),
        ("NJT4", None),
        ("", None),
        (None, None),
        ("21319 21320", None),
    ],
)
def test_septas_stop_number_is_read_from_the_citys_text(text, number) -> None:
    assert shelter_number(text) == number


STOP_LAT, STOP_LNG = 39.96, -75.15
STOPS = [
    SeptaPoint("100", (), STOP_LAT, STOP_LNG),
    # Across the street, 14 meters north.
    SeptaPoint("101", (), *moved(STOP_LAT, STOP_LNG, north=14)),
    # Renumbered: it was 299.
    SeptaPoint("300", ("299",), *moved(STOP_LAT, STOP_LNG, east=200)),
    SeptaPoint("400", (), *moved(STOP_LAT, STOP_LNG, east=400)),
]


def shelter(number: str | None, east: float = 0.0, north: float = 0.0, sid="pa-1") -> CityShelter:
    lat, lng = moved(STOP_LAT, STOP_LNG, east=east, north=north)
    return CityShelter(sid, number, lat, lng)


def test_a_shelter_matches_its_numbered_stop_within_30_meters() -> None:
    found = match_shelters([shelter("100", east=25)], STOPS)
    assert (found[0].stop, found[0].how) == (0, BY_NUMBER) and found[0].meters == pytest.approx(25)


def test_a_number_the_stop_had_before_counts() -> None:
    found = match_shelters([shelter("299", east=205)], STOPS)
    assert (found[0].stop, found[0].how) == (2, BY_NUMBER)


def test_another_stop_clearly_closer_beats_the_number() -> None:
    # Numbered for stop 101 (14 meters north) but standing 2 meters from stop 100: the point
    # decides, as at Girard Avenue and 11th Street.
    found = match_shelters([shelter("101", north=-2)], STOPS)
    assert (found[0].stop, found[0].how) == (0, BY_PLACE)


def test_without_a_number_that_holds_the_nearest_stop_within_15_meters() -> None:
    near = shelter(None, east=12)
    far_numbered = shelter("400", east=435)  # 35 meters past stop 400, beyond the number's reach
    other_agency = shelter(None, east=200, north=20)
    found = match_shelters([near, far_numbered, other_agency], STOPS)
    assert (found[0].stop, found[0].how) == (0, BY_PLACE)
    assert 1 not in found and 2 not in found


def test_two_shelters_can_serve_one_stop() -> None:
    found = match_shelters([shelter("100", east=3), shelter("100", east=-3, sid="pa-2")], STOPS)
    assert {m.stop for m in found.values()} == {0} and len(found) == 2


@pytest.mark.parametrize(
    ("site", "expected"),
    [
        ("Chestnut St & 60th St -", ("Chestnut St & 60th St", None)),
        ("Chestnut St & Broad St - Shelter CH14", ("Chestnut St & Broad St", None)),
        ("Oregon & Broad-PBS1", ("Oregon & Broad", None)),
        ("19th & JFK-PN52", ("19th & JFK", None)),
        ("Market East Headhouse - 01", ("Market East Headhouse", None)),
        ("Roosevelt Blvd & Broad St - FS SE", ("Roosevelt Blvd & Broad St - FS", "southeast")),
        (
            "Olney Av & 20th St - FS SE (Remove Onley & 18th MBNS)",
            ("Olney Av & 20th St - FS", "southeast"),
        ),  # noqa: E501
    ],
)
def test_the_site_name_loses_its_internal_codes(site, expected) -> None:
    assert shelter_place(site) == expected


def test_the_shelter_name_says_the_side_of_the_street_in_words() -> None:
    assert shelter_name("Roosevelt Blvd & Broad St - FS SE") == (
        "Roosevelt Blvd & Broad St (far side), southeast corner"
    )
    assert shelter_name("Chestnut St & 60th St -") == "Chestnut St & 60th St"


# The City's shelters in the transit comfort lens ------------------------------------------------


@pytest.mark.parametrize(
    ("answers", "expected"),
    [
        # City shelter, OpenStreetMap not surveyed: the shelter is known, the bench is not.
        ({"cs": 1}, ["stop_survey"]),
        # City shelter, OpenStreetMap agreeing and the bench answered: nothing to suggest.
        ({"cs": 1, "sh": 1, "bn": 1}, []),
        # City shelter, OpenStreetMap saying there is none: they disagree, so a survey settles it
        # and the City is not asked for a shelter it lists.
        ({"cs": 1, "sh": 0, "bn": 1}, ["stop_survey"]),
        # No City shelter and none in OpenStreetMap: ask for one.
        ({"sh": 0, "bn": 1}, ["stop_shelter_request"]),
    ],
)
def test_a_city_shelter_counts_as_a_shelter(answers, expected) -> None:
    assert stop_suggestions(answers) == expected
    joined = join_published({"tc": 1, "sid": "100", **answers}, None)
    assert joined["f_noshelter"] == (0 if "cs" in answers else 100)


def write_shelters(path: Path, shelters: list[tuple[str, str | None, float, float]]) -> Path:
    rows = [
        {
            "objectid": i + 1,
            "site": f"Sample {i + 1}",
            "siteid": f"pa-{i + 1}",
            "stopid": number,
            "productgroup": "Static",
            "geometry": shapely.to_wkb(shapely.Point(lng, lat)),
        }
        for i, (_, number, lat, lng) in enumerate(shelters)
    ]
    pq.write_table(pa.Table.from_pylist(rows), path)
    return path


def test_the_lens_counts_the_citys_shelters_and_says_where_they_disagree(
    comfort_paths,  # noqa: F811 (the fixture of test_transit_comfort)
    tmp_path,
) -> None:
    _, paths = comfort_paths
    stops = [
        SeptaStop("100", (), 39.96, -75.15),
        SeptaStop("101", (), 39.965, -75.15),
        SeptaStop("108", (), 39.96, -75.16),
    ]
    # A shelter numbered 100 at stop 100 (OpenStreetMap says no shelter there: they disagree), one
    # by place at stop 108 (not in OpenStreetMap), and one far from every stop.
    paths["bus_shelters"] = write_shelters(
        tmp_path / "shelters.parquet",
        [
            ("a", "100", *moved(39.96, -75.15, east=6)),
            ("b", None, *moved(39.96, -75.16, north=4)),
            ("c", "NJT4", 39.99, -75.14),
        ],
    )
    result = comfort_for_stops(stops, [55, 30, 7], [80, 120, None], paths)
    j100, j101, j108 = result.joined
    assert (j100["cs"], j108["cs"]) == (1, 1) and "cs" not in j101
    assert j100["f_noshelter"] == 0 and j108["f_noshelter"] == 0
    assert j100["sg"] == "stop_survey,stop_streetlight_report"
    assert j108["sg"] == "stop_survey" and j108["f_nobench"] == NOT_SURVEYED
    # `cs` is the City's data, so it is published on the stop.
    assert result.properties[0]["cs"] == 1 and "f_noshelter" not in result.properties[0]
    note = next(n for n in result.notes if "bus shelters stand at" in n)
    assert "2 of the City's 3 bus shelters stand at 2 of these stops" in note
    assert "(1 by SEPTA's stop number, 1 by place" in note
    assert "says there is none at 1" in note


def test_without_the_citys_list_only_openstreetmap_says(comfort_paths) -> None:  # noqa: F811
    _, paths = comfort_paths
    result = comfort_for_stops([SeptaStop("108", (), 39.96, -75.16)], [7], [None], paths)
    assert "cs" not in result.joined[0] and result.joined[0]["f_noshelter"] == NOT_SURVEYED
    assert any("bus shelters are missing" in n for n in result.notes)


def test_published_stops_carry_the_city_shelters_and_the_lamps_nearby(
    comfort_paths,  # noqa: F811
    tmp_path,
) -> None:
    ctx, paths = comfort_paths
    paths["bus_shelters"] = write_shelters(
        tmp_path / "shelters.parquet", [("a", "100", *moved(39.96, -75.15, east=6))]
    )
    lat, lng = moved(39.96, -75.15, north=10)
    paths["street_poles"] = write_poles(
        tmp_path / "poles.parquet",
        [
            (1, "LED", 1, "Streets", lat, lng),
            (2, "HPS", 1, "Streets", *moved(39.96, -75.15, east=-20)),
            (3, "UNKNOWN", None, "PECO", *moved(39.96, -75.15, east=-5)),
            (4, "LED", 1, "Streets", *moved(39.96, -75.15, east=60)),
        ],
    )
    stops, _ = publish_stops(ctx, paths, tmp_path)
    assert stops["100"]["cs"] == 1 and "cs" not in stops["101"]
    # Two poles with a lamp within 30 meters of stop 100, one of them LED; the PECO pole lists no
    # lamp, and the fourth is 60 meters away.
    assert (stops["100"]["lp"], stops["100"]["le"]) == (2, 1)
    assert stops["108"]["lp"] == 0 and "lp" not in stops["102"]  # a station gets none

    out = tmp_path / "transit.shelters.geojson"
    built = build_city_shelters(ctx, paths, out, AS_OF)
    (shelter_props,) = props(out)
    assert shelter_props == {"id": "pa-1", "nm": "Sample 1", "sid": "100", "st": "sp100", "m": 1}
    assert "1 at 1 SEPTA stops (1 by stop number, 0 by place); 0 match no stop" in built.notes[0]


def test_lamps_near_counts_poles_with_a_lamp_within_30_meters(tmp_path) -> None:
    paths = {
        "street_poles": write_poles(
            tmp_path / "poles.parquet",
            [
                (1, "LED", 1, "Streets", *moved(39.96, -75.15, east=29)),
                (2, "LED", 1, "Streets", *moved(39.96, -75.15, east=31)),
            ],
        )
    }
    assert lamps_near(paths, [39.96], [-75.15]) == [{"lp": 1, "le": 1}]
    assert lamps_near({}, [39.96], [-75.15]) == [{}]


# Street poles ------------------------------------------------------------------------------------


def write_poles(path: Path, poles: list[tuple]) -> Path:
    rows = [
        {
            "objectid": i + 1,
            "pole_num": number,
            "type": "WP",
            "nlumin": lamps,
            "owner": owner,
            "bulb_type": bulb,
            "light_date": datetime(2024, 5, 1),
            "psip_status": "COMPLETED",
            "geometry": shapely.to_wkb(shapely.Point(lng, lat)),
        }
        for i, (number, bulb, lamps, owner, lat, lng) in enumerate(poles)
    ]
    pq.write_table(pa.Table.from_pylist(rows), path)
    return path


@pytest.mark.parametrize(
    ("bulb", "lamps", "kind"),
    [
        ("LED", 1, LAMP_LED),
        ("led", None, LAMP_LED),
        ("HPS", 1, LAMP_OTHER),
        ("UNKNOWN", 2, LAMP_UNKNOWN),
        ("UNKNOWN", None, NO_LAMP),
        ("UNKNOWN", 0, NO_LAMP),
        (None, None, NO_LAMP),
    ],
)
def test_the_kind_of_lamp_is_what_the_city_lists(bulb, lamps, kind) -> None:
    assert lamp_kind(bulb, lamps) == kind


def test_owners_are_coded_and_blank_is_left_out() -> None:
    assert [owner_code(o) for o in ("Streets", "PECO", "PennDOT", "U of Penn", " ", None)] == [
        1,
        2,
        3,
        4,
        None,
        None,
    ]


def network() -> StreetNetwork:
    return StreetNetwork.from_table(fx.centerlines())


def test_each_pole_counts_for_its_nearest_block_within_30_meters() -> None:
    net = network()
    # Two poles along OAK ST's first block (seg 3), one 10 meters off MAIN ST (seg 1), and one in
    # the middle of nowhere.
    points = [fx.point(30, 108), fx.point(80, 92), fx.point(60, -10), fx.point(60, 400)]
    found = poles_on_blocks(
        net,
        points_in_meters([p.y for p in points], [p.x for p in points]),
        [LAMP_LED, LAMP_OTHER, NO_LAMP, LAMP_LED],
    )
    index = {seg: i for i, seg in enumerate(net.ids)}
    assert found.poles[index[3]] == 2 and found.lamps[index[3]] == 2 and found.led[index[3]] == 1
    assert found.poles[index[1]] == 1 and found.lamps[index[1]] == 0
    assert found.unmatched == 1


def test_the_poles_layer_keeps_the_number_the_lamp_and_the_owner(context_factory, tmp_path) -> None:
    ctx = context_factory()
    paths = {
        "street_poles": write_poles(
            tmp_path / "poles.parquet",
            [
                (2002, "LED", 1, "Streets", 39.96, -75.15),
                (2001, "UNKNOWN", None, "PECO", 39.961, -75.15),
                (None, "HPS", 1, " ", 39.962, -75.15),
                (2003, "LED", 1, "Streets", 0.0, 0.0),
            ],
        )
    }
    out = tmp_path / "poles.poles.geojson"
    built = build_poles(ctx, paths, out, AS_OF)
    assert props(out) == [{"k": 0, "id": 2001, "o": 2}, {"k": 1, "id": 2002, "o": 1}, {"k": 2}]
    assert (
        "3 street poles the City lists; 2 with a lamp the City lists, 1 of them LED"
        in (built.notes[0])
    )
    assert "1 without a usable point left out" in built.notes[0]


def test_the_poles_tiles_hold_zoom_15_only() -> None:
    options = TILE_OPTIONS["tiles/poles.pmtiles"]
    assert "--minimum-zoom=15" in options and "--maximum-zoom=15" in options


# Traffic calming ---------------------------------------------------------------------------------


def test_install_days_are_the_citys_calendar_day() -> None:
    assert install_day(datetime(2023, 8, 1, 4, 0)) == date(2023, 8, 1)
    assert install_day(datetime(2023, 8, 1, 0, 0)) == date(2023, 8, 1)
    assert install_day(None) is None


def test_a_device_counts_for_its_own_block_else_the_nearest() -> None:
    net = network()
    points = [fx.point(60, 100), fx.point(180, 100), fx.point(180, 104), fx.point(900, 900)]
    found = calming_on_blocks(
        net,
        [3, None, 999, None],
        points_in_meters([p.y for p in points], [p.x for p in points]),
        [date(2024, 6, 1), date(2023, 8, 1), date(2025, 1, 1), None],
    )
    index = {seg: i for i, seg in enumerate(net.ids)}
    assert found.devices[index[3]] == 1 and found.devices[index[4]] == 2
    assert found.first[index[4]] == date(2023, 8, 1)
    assert (found.by_id, found.by_place, found.unmatched) == (1, 2, 1)


def street_paths(ctx, tmp_path: Path, *, calming: bool = True, poles: bool = True) -> dict:
    for source, table, kind in (
        ("street_centerlines", fx.centerlines(), ["LineString"]),
        ("high_injury_network", fx.high_injury_network(), ["MultiLineString"]),
        ("crashes_2020_2024", fx.newest_slice(), ["Point"]),
        ("fatal_crashes", fx.fatal_table(), ["Point"]),
        ("schools", fx.schools(), ["Point"]),
    ):
        install_snapshot(ctx, source, table, geometry=True, fetched_at=FETCHED, geometry_types=kind)
    from placekeepers.snapshots import SnapshotStore

    paths = {}
    for source in (
        "street_centerlines",
        "high_injury_network",
        "crashes_2020_2024",
        "fatal_crashes",
        "schools",
    ):
        store = SnapshotStore(ctx.cache, source)
        paths[source] = store.path_for(store.current())
    if calming:
        rows = [
            # Two on OAK ST's first block (seg 3), the first in 2023.
            {"objectid": 1, "id": "SC-1", "seg_id": 3, "install_dt": datetime(2024, 6, 1, 4)},
            {"objectid": 2, "id": "SC-1", "seg_id": 3, "install_dt": datetime(2023, 8, 1, 4)},
        ]
        points = [fx.point(40, 100), fx.point(80, 100)]
        for row, point in zip(rows, points, strict=True):
            row["geometry"] = shapely.to_wkb(point)
        paths["traffic_calming"] = tmp_path / "calming.parquet"
        pq.write_table(pa.Table.from_pylist(rows), paths["traffic_calming"])
    if poles:
        paths["street_poles"] = write_poles(
            tmp_path / "poles.parquet",
            [
                (1, "LED", 1, "Streets", *reversed(fx.lnglat(30, 8))),
                (2, "HPS", 1, "Streets", *reversed(fx.lnglat(90, 8))),
                (3, "UNKNOWN", None, "PECO", *reversed(fx.lnglat(60, -8))),
            ],
        )
    return paths


def test_blocks_carry_their_poles_and_traffic_calming(context_factory, tmp_path) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path)
    out = tmp_path / "streets.segments.geojson"
    built = build_segments(ctx, paths, out, AS_OF)
    by_id = {p["id"]: p for p in props(out)}
    main = by_id[1]
    assert (main["pl"], main["lp"], main["le"]) == (3, 2, 1)
    assert by_id[3]["tc"] == 2 and by_id[3]["ty"] == 2023
    assert "pl" in by_id[7] and by_id[7]["pl"] == 0 and "lp" not in by_id[7]
    for block in by_id.values():
        # "No traffic calming recorded here yet" only on a High Injury Network block where people
        # were hurt; the request only where the street may qualify (MAIN ST is a state arterial).
        if block.get("tc") == 0:
            assert block["hin"] == 1 and block["ksi"] > 0
        assert block.get("sg") in (None, "traffic_calming_petition")
    assert not any(b.get("sg") for b in by_id.values() if b["cls"] not in (4, 5))
    assert any("blocks have traffic calming the City lists" in n for n in built.notes)


def test_a_hurt_high_injury_block_without_calming_asks_for_it_where_the_street_qualifies(
    context_factory, tmp_path
) -> None:
    from placekeepers.derive.streets_stops import BlockCalming
    from placekeepers.publish.streets_stops import calming_properties, may_ask_for_calming

    net = network()
    calming = BlockCalming([0] * len(net), [None] * len(net))
    index = {seg: i for i, seg in enumerate(net.ids)}
    assert calming_properties(calming, index[3], hurt_on_hin=True) == {"tc": 0}
    assert calming_properties(calming, index[3], hurt_on_hin=False) == {}
    assert calming_properties(None, index[3], hurt_on_hin=True) == {}
    # OAK ST (a local street) may qualify; MAIN ST (a state arterial) may not.
    assert may_ask_for_calming(net, index[3]) and not may_ask_for_calming(net, index[1])


def test_without_the_new_sources_blocks_are_as_before(context_factory, tmp_path) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path, calming=False, poles=False)
    out = tmp_path / "streets.segments.geojson"
    build_segments(ctx, paths, out, AS_OF)
    assert not any({"pl", "lp", "le", "tc", "ty", "sg"} & set(p) for p in props(out))


def test_the_calming_layer_dates_each_device_and_names_its_street(
    context_factory, tmp_path
) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path)
    out = tmp_path / "streets.calming.geojson"
    built = build_calming(ctx, paths, out, AS_OF)
    assert props(out) == [
        {"id": 1, "d": "2024-06-01", "p": "SC-1", "s": 3, "name": "OAK ST"},
        {"id": 2, "d": "2023-08-01", "p": "SC-1", "s": 3, "name": "OAK ST"},
    ]
    assert "2 traffic calming devices on 1 street blocks" in built.notes[0]


def test_memorials_asking_for_traffic_calming_say_what_the_block_has(
    context_factory, tmp_path
) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path)
    out = tmp_path / "streets.memorials.geojson"
    build_memorial_layer(ctx, paths, out, AS_OF)
    memorials = props(out)
    asking = [m for m in memorials if "traffic_calming_petition" in m.get("sg", "")]
    assert asking, "the sample has a crash site on a residential street"
    for memorial in memorials:
        assert ("tc" in memorial) == (memorial in asking)
    # On OAK ST's first block the City lists two devices, the first from 2023; elsewhere none.
    by_place = {m.get("pl"): m for m in asking}
    oak = by_place["100 block of Oak St"]
    assert (oak["tc"], oak["ty"]) == (2, 2023)
    assert all(m["tc"] == 0 and "ty" not in m for m in asking if m is not oak)


# 311 street lights and crossing guards ------------------------------------------------------------


def test_street_lights_reported_out_carry_the_poles_of_their_block(
    context_factory, tmp_path
) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path)
    lat, lng = fx.point(60, 3).y, fx.point(60, 3).x
    rows = [
        {
            "service_code": "SR-ST04",
            "status": "Open",
            "requested": date(2026, 10, 1),
            "closed": None,
            "lat": lat,
            "lng": lng,
        }
    ]
    paths["philly311_conditions"] = tmp_path / "311.parquet"
    pq.write_table(pa.Table.from_pylist(rows), paths["philly311_conditions"])
    out = tmp_path / "conditions.lights.geojson"
    condition_builder("lights")(ctx, paths, out, AS_OF)
    (block,) = props(out)
    assert block["id"] == 1 and (block["pl"], block["lp"], block["le"]) == (3, 2, 1)
    dumping = tmp_path / "conditions.dumping.geojson"
    condition_builder("dumping")(ctx, paths, dumping, AS_OF)
    assert props(dumping) == []


def test_crossing_guard_posts_name_their_corner_and_the_nearest_school(
    context_factory, tmp_path
) -> None:
    ctx = context_factory()
    paths = street_paths(ctx, tmp_path)
    rows = [
        {"objectid": 2, "address": "13TH & OAK LANE", "geometry": shapely.to_wkb(fx.point(400, 0))},
        {"objectid": 1, "address": "G & TIOGA", "geometry": shapely.to_wkb(fx.point(-2000, 0))},
    ]
    paths["crossing_guards"] = tmp_path / "guards.parquet"
    pq.write_table(pa.Table.from_pylist(rows), paths["crossing_guards"])
    out = tmp_path / "streets.guards.geojson"
    built = build_guards(ctx, paths, out, AS_OF)
    assert props(out) == [
        {"id": 1, "pl": "G & Tioga"},
        {"id": 2, "pl": "13th & Oak Lane", "sn": "Example Elementary"},
    ]
    assert "2 school crossing guard posts; 1 within 400 meters of a school" in built.notes[0]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("BYBERRY & PROCTOR", "Byberry & Proctor"),
        ("13TH & OAK LANE", "13th & Oak Lane"),
        ("G & TIOGA", "G & Tioga"),
        ("  ST  VINCENT & HAWTHORNE ", "St Vincent & Hawthorne"),
    ],
)
def test_corners_are_written_for_people(text, expected) -> None:
    assert title_street(text) == expected


# The registry ------------------------------------------------------------------------------------


def test_every_new_layer_has_a_toggle_a_description_and_its_source(context_factory) -> None:
    ctx = context_factory()
    layers = {layer.id: layer for layer in ctx.registry.layers.values()}
    expected = {
        "city_shelters": ("tiles/transit.pmtiles", "shelters", "bus_shelters"),
        "street_poles": ("tiles/poles.pmtiles", "poles", "street_poles"),
        "traffic_calming": ("tiles/streets.pmtiles", "calming", "traffic_calming"),
        "crossing_guards": ("tiles/streets.pmtiles", "guards", "crossing_guards"),
    }
    for layer_id, (file, source_layer, source) in expected.items():
        layer = layers[layer_id]
        assert (layer.file, layer.source_layer) == (file, source_layer)
        assert source in layer.sources and len(layer.description) > 60
    words = " ".join(layers[i].description.lower() for i in expected)
    for banned in ("police", "enforce", "ticket", "brightness", " lit "):
        assert banned not in words, banned
