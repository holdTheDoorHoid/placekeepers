"""The lot timeline's records (placekeepers.derive.timeline, issue #38)."""

from __future__ import annotations

from datetime import date, datetime

from placekeepers.derive.timeline import clean_text, day_text, encode, li_groups, list_records


def test_text_is_trimmed_with_javascripts_white_space() -> None:
    assert clean_text("  EXTERIOR\tAREA  WEEDS﻿") == "EXTERIOR AREA WEEDS"
    assert clean_text("   ") is None
    assert clean_text("") is None
    assert clean_text(None) is None


def test_days_are_written_as_iso_days() -> None:
    assert day_text(date(2019, 5, 2)) == "2019-05-02"
    assert day_text(datetime(2019, 5, 2, 23, 30)) == "2019-05-02"
    assert day_text("2019-05-02") == "2019-05-02"
    assert day_text("no date") is None
    assert day_text(None) is None


def test_an_event_drops_its_trailing_empty_parts_and_a_count_of_one() -> None:
    assert encode("2019-05-02", "WEEDS", "COMPLIED", None, 1) == ["2019-05-02", "WEEDS", "COMPLIED"]
    assert encode("2019-05-02", "WEEDS", None, None, 3) == ["2019-05-02", "WEEDS", None, None, 3]
    assert encode(None, "WEEDS", None, None, 1) == [None, "WEEDS"]


def test_groups_count_repeats_and_list_kinds_in_order() -> None:
    day = date(2020, 1, 2)
    groups = li_groups(
        [
            ("clean_seal", day, "CLEAN&SEAL", "Approved", None),
            ("violation", day, "WEEDS", "OPEN", None),
            ("violation", day, " WEEDS", "OPEN", None),
            ("violation", date(2021, 1, 1), "RUBBISH", "COMPLIED", None),
            ("violation", None, None, "OPEN", None),
            ("complaint", day, "NOISE", "OPEN", None),
        ]
    )
    assert groups == {
        "violation": [
            ["2021-01-01", "RUBBISH", "COMPLIED"],
            ["2020-01-02", "WEEDS", "OPEN", None, 2],
        ],
        "clean_seal": [["2020-01-02", "CLEAN&SEAL", "Approved"]],
    }
    assert li_groups([]) == {}


def test_lists_keep_each_list_once_with_its_latest_day() -> None:
    assert list_records(
        [
            ("june_2024_land", date(2024, 6, 24)),
            ("city_land", datetime(2025, 1, 1)),
            ("city_land", date(2026, 10, 4)),
            ("city_building", None),
            ("unknown_list", date(2026, 1, 1)),
        ]
    ) == [["2026-10-04", "city_land"], ["2024-06-24", "june_2024_land"]]
