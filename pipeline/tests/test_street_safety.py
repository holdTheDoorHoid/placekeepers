"""The street safety lens: crash severity and mode coding, combining the crash slices, assigning
crashes to blocks, the High Injury Network, schools, and the 0 to 100 factor fields."""

from __future__ import annotations

from datetime import date

import numpy as np
import pytest

from placekeepers.derive import street_safety as ss

from . import streets_fixtures as fx


# Severity -------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("level", "counts", "expected"),
    [
        (1, (0, 0, 0), 3),  # killed
        (2, (0, 0, 0), 2),  # suspected serious injury (before 2016: major injury)
        (3, (0, 0, 0), 1),  # suspected minor injury
        (4, (0, 0, 0), 1),  # possible injury
        (8, (0, 0, 0), 1),  # injury of unknown severity
        (0, (0, 0, 0), 0),  # no injury
        (9, (0, 0, 0), 0),  # unknown
        (None, (0, 0, 0), 0),
        (None, (1, 0, 0), 3),  # the counts back up a missing code
        (0, (0, 2, 0), 2),
        (9, (0, 0, 1), 1),
    ],
)
def test_crash_severity_follows_the_contract(level, counts, expected) -> None:
    assert ss.crash_severity(level, *counts) == expected


def test_crash_modes_are_bit_flags() -> None:
    assert ss.crash_modes(1, 0, 0) == 1
    assert ss.crash_modes(0, 2, 0) == 2
    assert ss.crash_modes(0, 0, 1) == 4
    assert ss.crash_modes(2, 1, 1) == 7
    assert ss.crash_modes(0, None, 0) == 0


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Pedestrian", 1),
        ("Pedestrians", 1),
        ("Ped on skateboard", 1),
        ("Bicycle", 2),  # the Police label until 2022
        ("Bicyclist", 2),  # the Police label from 2023
        ("Bike", 2),
        ("E-Bicycle", 2),
        ("E-Scooter", 8),
        ("Scooter", 8),
        ("Pedestrian on scooter", 9),
        ("M/C", 4),
        ("Motorcycle", 4),
        ("Dirt-bike", 4),
        ("Dirtbike", 4),
        ("Mini-bike", 4),
        ("Moped", 4),
        ("Motor Scooter", 4),
        ("Motor-Scooter", 4),
        ("M/C and PED", 5),
        ("Auto", 0),
        ("Auto ", 0),
        ("Fixed Object", 0),
        ("Parked veh.", 0),
        (None, 0),
        ("", 0),
    ],
)
def test_police_unit_text_becomes_mode_bits(text, expected) -> None:
    assert ss.police_mode(text) == expected


def test_the_bicycle_label_change_does_not_change_the_mode() -> None:
    before = ss.police_modes("Auto", "Bicycle")
    after = ss.police_modes("Auto", "Bicyclist")
    assert before == after == ss.MODE_BIKE
    assert ss.police_modes("Bicyclist", "Pedestrian") == ss.MODE_BIKE | ss.MODE_WALK


# Percentiles ----------------------------------------------------------------------------------
def test_count_percentiles_are_the_share_of_places_with_less() -> None:
    assert ss.percentile_rank([0, 0, 0, 1, 2]) == [0, 0, 0, 60, 80]
    assert ss.percentile_rank([5, 0, 5, 1]) == [50, 0, 50, 25]
    assert ss.percentile_rank([0, 0]) == [0, 0]
    assert ss.percentile_rank([]) == []
    values = list(range(1000))
    ranks = ss.percentile_rank(values)
    assert ranks[0] == 0 and ranks[-1] == 100
    assert all(0 <= r <= 100 for r in ranks)


def test_yes_no_factors_are_0_or_100() -> None:
    assert (ss.yes_no(True), ss.yes_no(False)) == (100, 0)


# Combining the slices -------------------------------------------------------------------------
def slices():
    return [
        ("crashes_2016_2020", fx.older_slice()),
        ("crashes_2020_2024", fx.newest_slice()),
        ("crashes_2007_2017", fx.oldest_slice()),
    ]


def test_each_year_comes_from_the_newest_slice_and_crashes_count_once() -> None:
    combined = ss.combine_slices(slices())
    assert combined.owners == {
        2015: "crashes_2007_2017",
        2019: "crashes_2016_2020",
        2020: "crashes_2020_2024",
        2021: "crashes_2020_2024",
        2023: "crashes_2020_2024",
        2024: "crashes_2020_2024",
    }
    crns = [c.crn for c in combined.crashes]
    assert len(crns) == len(set(crns))
    # 2020 comes from the newest slice only: its revised severity wins, and a 2020 crash that only
    # the older slice lists is not mixed in.
    by_crn = {c.crn: c for c in combined.crashes}
    assert by_crn[2020000005].sev == 0
    assert 2020000099 not in by_crn
    assert by_crn[2019000006].sev == 2
    assert by_crn[2015000007].sev == 2 and by_crn[2015000007].modes == ss.MODE_BIKE
    assert combined.years[0] == 2015 and combined.newest_year == 2024


def test_people_walking_or_cycling_killed_or_seriously_injured_are_counted() -> None:
    combined = ss.combine_slices(slices())
    by_crn = {c.crn: c for c in combined.crashes}
    assert by_crn[2024000001].vru_ksi == 1
    assert by_crn[2023000002].vru_ksi == 1
    assert by_crn[2021000003].vru_ksi == 0
    assert by_crn[2021000003].modes == ss.MODE_MOTORCYCLE


def test_crashes_outside_philadelphia_are_left_out_with_a_note() -> None:
    table = fx.crash_table([fx.crash_row(2024000010, 2024, 0, 0, level=0)])
    rows = table.to_pylist()
    rows[0]["geometry"] = fx.wkb(fx.Point(0, 0))
    bad = fx.crash_table(rows)
    combined = ss.combine_slices([("crashes_2020_2024", bad)])
    assert combined.crashes == []
    assert combined.notes == ["1 crash has no usable location"]


def test_the_ksi_window_is_the_five_newest_years() -> None:
    assert ss.ksi_window(2024, range(2015, 2025)) == [2020, 2021, 2022, 2023, 2024]
    assert ss.ksi_window(2024, [2015, 2023, 2024]) == [2023, 2024]
    assert ss.ksi_window(None, []) == []


def test_the_fatal_window_is_two_years_back_from_the_build_date() -> None:
    assert ss.fatal_window_start(date(2026, 10, 4)) == date(2024, 10, 4)
    assert ss.fatal_window_start(date(2026, 2, 28)) == date(2024, 2, 28)
    assert ss.fatal_window_start(date(2028, 2, 29)) == date(2026, 2, 28)


# The street network ---------------------------------------------------------------------------
@pytest.fixture(scope="module")
def network() -> ss.StreetNetwork:
    return ss.StreetNetwork.from_table(fx.centerlines())


def projected(*xys: tuple[float, float]) -> np.ndarray:
    """Points given in the fixture's meters east and north, projected like real crashes."""
    lat_lng = [fx.lnglat(x, y)[::-1] for x, y in xys]
    return ss.points_in_meters([p[0] for p in lat_lng], [p[1] for p in lat_lng])


def index_of(network: ss.StreetNetwork, seg_id: int) -> int:
    return network.ids.index(seg_id)


def ids(network: ss.StreetNetwork, indexes) -> list[int]:
    return sorted(network.ids[i] for i in indexes)


def test_only_streets_that_carry_traffic_are_kept(network) -> None:
    assert sorted(network.ids) == [1, 2, 3, 4, 5, 6, 7]
    assert network.names[index_of(network, 3)] == "OAK ST"


def test_corners_are_where_different_streets_meet(network) -> None:
    corner_sets = sorted(sorted(network.ids[i] for i in m) for m in network.corner_segments)
    assert corner_sets == [[1, 2, 6], [1, 5], [2, 7], [3, 4, 6], [3, 5], [4, 7]]


def test_a_crash_at_a_corner_counts_for_every_block_meeting_there(network) -> None:
    [blocks] = network.blocks_for(projected((120, 3)))
    assert ids(network, blocks) == [1, 2, 6]


def test_other_crashes_count_for_the_nearest_block_within_reach(network) -> None:
    points = projected((60, 102), (60, 900), (60, 45))
    middle, far, park = network.blocks_for(points)
    assert ids(network, middle) == [3]
    assert far == []
    # 45 meters from the nearest street: too far for PennDOT, close enough for the Police.
    assert park == []
    [park_police] = network.blocks_for(points[2:], ss.POLICE_NEAREST_METERS)
    assert ids(network, park_police) == [1]


def test_counts_add_up_per_block(network) -> None:
    points = projected((60, 102), (120, 3), (60, 900))
    totals, unmatched = ss.count_on_blocks(network, points, [2, 1, 5])
    by_id = dict(zip(network.ids, totals, strict=True))
    assert by_id == {1: 1, 2: 1, 3: 2, 4: 0, 5: 0, 6: 1, 7: 0}
    assert unmatched == 1


def test_high_injury_network_blocks_lie_along_it_and_cross_streets_do_not(network) -> None:
    lines = [fx.MultiLineString([fx.line((-50, 1), (300, 1))])]
    flags = dict(zip(network.ids, ss.hin_membership(network, lines), strict=True))
    assert flags == {1: True, 2: True, 3: False, 4: False, 5: False, 6: False, 7: False}
    assert ss.hin_membership(network, []) == [False] * 7


def test_schools_within_400_meters(network) -> None:
    school = ss.to_meters(np.array([fx.point(600, 0)], dtype=object))
    flags = dict(zip(network.ids, ss.schools_near(network, school), strict=True))
    assert flags == {1: False, 2: True, 3: False, 4: True, 5: False, 6: False, 7: True}


def test_segment_properties_carry_factors_and_counts(network) -> None:
    n = len(network)
    factors = ss.SegmentFactors(
        hin=[i == 0 for i in range(n)],
        ksi=[3, 0, 1, 0, 0, 0, 0],
        killed2=[0, 0, 1, 0, 0, 0, 0],
        school=[False, True, False, False, False, False, False],
    )
    first = factors.properties(network, 0)
    assert first == {
        "id": network.ids[0],
        "name": network.names[0],
        "cls": network.classes[0],
        "hin": 1,
        "f_hin": 100,
        "ksi": 3,
        "f_ksi_vru": 86,
        "k2": 0,
        "f_fatal2": 0,
        "sch": 0,
        "f_school": 0,
    }
    assert factors.properties(network, 2)["f_fatal2"] == 100
    assert factors.properties(network, 3)["f_ksi_vru"] == 0


def test_a_missing_factor_is_left_out_instead_of_counted_as_zero(network) -> None:
    factors = ss.SegmentFactors(hin=None, ksi=[0] * len(network), killed2=None, school=None)
    props = factors.properties(network, 0)
    assert "f_hin" not in props and "f_fatal2" not in props and "f_school" not in props
    assert props["f_ksi_vru"] == 0
