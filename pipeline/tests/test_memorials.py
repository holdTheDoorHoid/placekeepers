"""Memorials: places in words, stable ids, the curated names file and its checks, the removal
list, and the suggestions for each crash site. Every name here is invented."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest
import yaml

from placekeepers.curated import (
    CuratedError,
    CuratedMemorials,
    Suppression,
    parse_memorial,
    read_memorials,
    read_suppressed,
)
from placekeepers.derive import memorials as mem
from placekeepers.derive.street_safety import StreetNetwork

from . import streets_fixtures as fx
from .conftest import REPO_ROOT


# Places ---------------------------------------------------------------------------------------
@pytest.mark.parametrize(
    ("primary", "secondary", "expected"),
    [
        ("9th St.", "Samson St.", "9th St and Samson St"),
        ("Packer Ave.", "600 Block", "600 block of Packer Ave"),
        ("Hunting Park Ave.", '200 Block "E"', "200 block of E Hunting Park Ave"),
        ("Columbus Blvd.", "1400 Block South", "1400 block of S Columbus Blvd"),
        ("Bustleton Ave.", "10661 Block", "10600 block of Bustleton Ave"),
        ("5941 Market St.", None, "5900 block of Market St"),
        ("22 Pattison Ave", None, "unit block of Pattison Ave"),
        ("6700 Oxford Ave.", "Montour Street", "6700 block of Oxford Ave near Montour Street"),
        ("26th St. ", "Near Penrose Ave.", "26th St near Penrose Ave"),
        ("70th St.", "Lindbergh Blvd", "70th St and Lindbergh Blvd"),
        ("Erie Ave.", '"I" St.', "Erie Ave and I St"),
        (None, None, None),
    ],
)
def test_places_read_plainly_and_house_numbers_become_blocks(primary, secondary, expected) -> None:
    assert mem.place_text(primary, secondary) == expected


# Ids ------------------------------------------------------------------------------------------
def record(day: str, x: float, y: float, modes: int = 1, order: int = 0) -> mem.FatalRecord:
    lng, lat = fx.lnglat(x, y)
    return mem.FatalRecord(date.fromisoformat(day), modes, lat, lng, None, order)


def test_ids_come_from_the_date_and_place_and_stay_stable() -> None:
    a = record("2026-08-20", 60, 99, order=1)
    b = record("2026-01-15", 180, 100, order=2)
    c = record("2026-01-15", 180, 100, order=3)
    first = mem.memorial_ids([a, b, c])
    again = mem.memorial_ids([c, a, b])
    assert first[0].startswith("fc20260820_") and len(first[0]) == len("fc20260820_abcd")
    # The same people get the same ids whatever order the Police table lists them in.
    assert (first[0], first[1], first[2]) == (again[1], again[2], again[0])
    # Two people killed in one crash share the date and place, told apart by a suffix.
    assert first[2] == f"{first[1]}_2"


# The curated file -----------------------------------------------------------------------------
GOOD = {
    "id": "m2026_0001",
    "name": "Alex Example",
    "date": date(2026, 8, 20),
    "mode": "walking",
    "lat": fx.lnglat(60, 99)[1],
    "lng": fx.lnglat(60, 99)[0],
    "source": "https://example.org/memorials/alex-example",
}


def test_a_complete_entry_is_accepted() -> None:
    entry, problems = parse_memorial(dict(GOOD), 0)
    assert problems == []
    assert entry is not None and entry.name == "Alex Example" and entry.mode_bits == 1


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"source": None}, "is missing: source"),
        ({"source": "http://example.org/x"}, "needs a source link starting with https://"),
        ({"mode": "flying"}, "has mode 'flying'"),
        ({"date": "August 20"}, "has a date that is not YYYY-MM-DD"),
        ({"lat": 40.7, "lng": -74.0}, "outside Philadelphia"),
        ({"lat": None, "lng": None}, "needs either a crash link or lat and lng"),
        ({"id": "M-1"}, "has an id that is not lowercase"),
        ({"name": "  "}, "has an empty name"),
        ({"age": 30}, "has unknown keys: age"),
    ],
)
def test_a_broken_entry_is_skipped_with_a_reason(change, message) -> None:
    raw = {**GOOD, **change}
    raw = {k: v for k, v in raw.items() if v is not None}
    entry, problems = parse_memorial(raw, 0)
    assert entry is None
    assert any(message in problem for problem in problems), problems


def write_curated(root: Path, memorials, suppressed) -> None:
    folder = root / "data" / "curated"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "memorials.yaml").write_text(yaml.safe_dump(memorials), encoding="utf-8")
    (folder / "suppressed.yaml").write_text(yaml.safe_dump(suppressed), encoding="utf-8")


def test_reading_the_files_reports_problems_by_id_never_by_name(tmp_path: Path) -> None:
    broken = {**GOOD, "id": "m2026_0002", "name": "Sam Placeholder", "source": "ftp://x"}
    write_curated(tmp_path, [GOOD, broken, dict(GOOD)], ["m2026_0009"])
    curated = read_memorials(tmp_path)
    assert [e.id for e in curated.entries] == ["m2026_0001"]
    assert any("m2026_0002" in p for p in curated.problems)
    assert any("more than once" in p for p in curated.problems)
    assert not any("Sam Placeholder" in p or "Alex Example" in p for p in curated.problems)


def test_the_suppressed_list_accepts_ids_and_ids_with_a_date_and_place(tmp_path: Path) -> None:
    write_curated(
        tmp_path,
        [],
        [
            "m2026_0001",
            {"id": "fc20260820_abcd", "date": "2026-08-20", "lat": 39.96, "lng": -75.16},
            {"id": "fc20250101_ffff", "lat": 41.0, "lng": -75.16},
            {"note": "no id"},
        ],
    )
    found, problems = read_suppressed(tmp_path)
    assert [s.id for s in found] == ["m2026_0001", "fc20260820_abcd", "fc20250101_ffff"]
    assert found[1].date == date(2026, 8, 20) and found[1].lat == 39.96
    # A broken place still suppresses the id: removal always wins.
    assert found[2].lat is None
    assert len(problems) == 2


def test_an_unreadable_file_is_an_error(tmp_path: Path) -> None:
    folder = tmp_path / "data" / "curated"
    folder.mkdir(parents=True)
    (folder / "suppressed.yaml").write_text("{not: [a list", encoding="utf-8")
    with pytest.raises(CuratedError):
        read_suppressed(tmp_path)
    (folder / "suppressed.yaml").write_text("just: a mapping\n", encoding="utf-8")
    with pytest.raises(CuratedError):
        read_suppressed(tmp_path)


def test_the_repository_files_are_valid() -> None:
    # Names arrive only after the owner hears from the Bicycle Coalition (milestone M1.9); until
    # then both files are empty lists, and every entry added later must pass these checks.
    curated = read_memorials(REPO_ROOT)
    _, problems = read_suppressed(REPO_ROOT)
    assert curated.problems == [] and problems == []


# Building the markers -------------------------------------------------------------------------
@pytest.fixture(scope="module")
def network() -> StreetNetwork:
    return StreetNetwork.from_table(fx.centerlines())


def police_records() -> list[mem.FatalRecord]:
    table = fx.fatal_table()
    records, notes = mem.fatal_records(
        table.column("date_").to_pylist(),
        table.column("veh1").to_pylist(),
        table.column("veh2").to_pylist(),
        table.column("primary_st").to_pylist(),
        table.column("secondary_").to_pylist(),
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("objectid").to_pylist(),
    )
    assert notes == []
    return records


def entry(**changes):
    item, problems = parse_memorial({**GOOD, **changes}, 0)
    assert problems == []
    return item


def build(entries=(), suppressions=(), network=None):
    return mem.build_memorials(
        police_records(),
        CuratedMemorials(list(entries), []),
        list(suppressions),
        network=network,
    )


def test_every_person_gets_a_marker_with_date_mode_and_place() -> None:
    memorials, notes = build()
    assert len(memorials) == 6
    by_date = {m.date.isoformat(): m for m in memorials}
    walking = by_date["2026-08-20"]
    assert walking.modes == 1 and walking.place == "100 block of Oak St"
    assert walking.name is None and walking.source is None
    assert by_date["2022-03-02"].modes == 2  # "Bicycle"
    assert by_date["2023-05-05"].modes == 2  # "Bicyclist"
    assert (
        by_date["2025-11-11"].modes == 4 and by_date["2025-11-11"].place == "unit block of Main St"
    )
    scooters = [m for m in memorials if m.date == date(2026, 1, 15)]
    assert [m.modes for m in scooters] == [8, 8] and scooters[0].id != scooters[1].id
    assert all(set(m.properties()) <= {"id", "d", "m", "pl", "sg", "nm", "src"} for m in memorials)
    assert notes == []


def test_a_name_joins_its_marker_by_date_and_place() -> None:
    memorials, notes = build([entry()])
    named = [m for m in memorials if m.name]
    assert len(named) == 1 and named[0].date == date(2026, 8, 20)
    props = named[0].properties()
    assert props["nm"] == "Alex Example"
    assert props["src"] == "https://example.org/memorials/alex-example"
    assert len(memorials) == 6
    assert "memorials: 1 name from memorials.yaml" in notes


def test_a_name_joins_its_marker_by_crash_link() -> None:
    plain, _ = build()
    target = next(m for m in plain if m.date == date(2023, 5, 5))
    linked = entry(
        id="m2023_0001", date=date(2023, 5, 5), mode="cycling", lat=None, lng=None, crash=target.id
    )
    memorials, _ = build([linked])
    named = next(m for m in memorials if m.name)
    assert named.id == target.id and named.modes == 2


def test_a_name_with_no_marker_gets_its_own_marker() -> None:
    lng, lat = fx.lnglat(200, 50)
    old = entry(id="m2016_0001", date=date(2016, 5, 1), lat=lat, lng=lng, place="Main St")
    memorials, notes = build([old])
    own = next(m for m in memorials if m.id == "m2016_0001")
    assert own.name == "Alex Example" and own.place == "Main St" and own.modes == 1
    assert len(memorials) == 7
    assert "memorials: 1 name from memorials.yaml, 1 of them at their own place" in notes


def test_a_curated_mode_wins_over_the_police_units() -> None:
    memorials, _ = build([entry(mode="driving")])
    named = next(m for m in memorials if m.name)
    assert named.modes == 0


def test_a_suppressed_name_never_shows_and_its_marker_stays_unnamed() -> None:
    memorials, _ = build([entry()], [Suppression("m2026_0001")])
    assert not any(m.name for m in memorials)
    assert any(m.date == date(2026, 8, 20) for m in memorials)
    assert all("Alex Example" not in str(m.properties()) for m in memorials)


def test_a_suppressed_marker_never_shows_even_with_a_name() -> None:
    plain, _ = build()
    target = next(m for m in plain if m.date == date(2026, 8, 20))
    memorials, notes = build([entry()], [Suppression(target.id)])
    assert target.id not in {m.id for m in memorials}
    assert not any(m.name for m in memorials)
    assert "memorials: 1 marker is removed on request" in notes


def test_a_suppression_with_date_and_place_survives_a_changed_id() -> None:
    lng, lat = fx.lnglat(62, 98)
    removal = Suppression("fc20260820_0000", date(2026, 8, 20), lat, lng)
    memorials, _ = build([], [removal])
    assert not any(m.date == date(2026, 8, 20) for m in memorials)
    elsewhere = Suppression("fc20260820_0000", date(2026, 8, 21), lat, lng)
    memorials, _ = build([], [elsewhere])
    assert any(m.date == date(2026, 8, 20) for m in memorials)


def test_crash_sites_get_suggestions_from_the_street_and_the_corner(network) -> None:
    memorials, _ = build(network=network)
    by_date = {m.date.isoformat(): m for m in memorials}
    # Mid block on OAK ST, a local City street: memorial and traffic calming.
    assert by_date["2026-08-20"].suggestions == [mem.MEMORIAL, mem.TRAFFIC_CALMING]
    # At the corner of MAIN ST (a state road) and 2ND ST: the corner suggestions; the nearest
    # block decides traffic calming.
    corner = by_date["2022-03-02"].suggestions
    assert corner[0] == mem.MEMORIAL
    assert mem.DAYLIGHTING in corner and mem.ASPHALT_ART in corner
    # On MAIN ST mid block: a state road, so no traffic calming, and no corner.
    assert by_date["2025-11-11"].suggestions == [mem.MEMORIAL]
    # The memorial suggestion always comes first.
    assert all(m.suggestions[0] == mem.MEMORIAL for m in memorials)


def test_suggestions_switched_off_in_the_registry_are_left_out(network) -> None:
    memorials, _ = mem.build_memorials(
        police_records(),
        CuratedMemorials([], []),
        [],
        network=network,
        suggestion_ids=[mem.MEMORIAL],
    )
    assert all(m.suggestions == [mem.MEMORIAL] for m in memorials)


def test_counts_by_year_and_mode() -> None:
    memorials, _ = build()
    table = mem.count_by_year_and_mode(memorials)
    assert table[2026] == {"all": 3, "walking": 1, "cycling": 0, "scooter": 2, "motorcycle": 0}
    assert table[2022]["cycling"] == 1 and table[2023]["cycling"] == 1
