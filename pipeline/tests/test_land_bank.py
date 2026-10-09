"""The Land Bank in numbers (M4.4, issue #40): which deeds from the City's land agencies count as
conveyances, who the buyers are, the side yard inference, follow ups, the weekly count of listed
lots, and the published numbers, reproduced end to end from a small block of invented parcels.
Every name and address here is made up."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from shapely.geometry import Point, box

from placekeepers.adapters import ADAPTERS
from placekeepers.derive import land_bank
from placekeepers.derive.land_bank import (
    ConveyanceRow,
    agency_of,
    classify,
    follow_ups,
    owner_keys,
    owns_next_door,
)
from placekeepers.publish.land_bank import LAND_BANK_TABLE, build_land_bank, fiscal_year
from placekeepers.runner import all_statuses
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeCarto, hex_wkb, install_snapshot
from .test_sources import relaxed as relaxed_rows
from .test_sources import run

NOW = datetime(2026, 10, 9, 15, 0, tzinfo=UTC)


def relaxed(source):
    """A few fixture rows pass, and the invented deeds, the newest from 2025, are never too old."""
    source = relaxed_rows(source)
    return source.model_copy(
        update={"health": source.health.model_copy(update={"max_age_days": 100_000})}
    )


# The kinds of deed ------------------------------------------------------------------------------


def test_agencies_are_recognized_by_name_and_departments_are_not() -> None:
    assert agency_of("PHILADELPHIA LAND BANK") == "PLB"
    assert agency_of("REDEVELOPMENT AUTHORITY OF THE CITY OF PHILADELPHIA") == "PRA"
    assert agency_of("PHILADELPHIA REDEVELOPMENT AUTHORIT") == "PRA"
    assert agency_of("PHILADELPHIA HOUSING DEVELOPMENT CORPORATION") == "PHDC"
    assert agency_of("CITY OF PHILADELPHIA") == "PUB"
    assert agency_of("DEPARTMENT OF PUBLIC PROPERTY") == "PUB"
    # A department granting an easement, the City as a trustee and other housing bodies are not.
    assert agency_of("WATER DEPARTMENT") is None
    assert agency_of("CITY OF PHILADELPHIA TR") is None
    assert agency_of("BOARD OF DIRECTORS OF CITY TRUSTS TR") is None
    assert agency_of("1260 HOUSING DEVELOPMENT CORPORATION") is None
    assert agency_of("PHILADELPHIA HOUSING AUTHORITY") is None


@pytest.mark.parametrize(
    ("kind", "sellers", "buyers", "expected"),
    [
        # A conveyance, with the buyers' type.
        (
            "DEED LAND BANK",
            "PHILADELPHIA LAND BANK",
            "CORTEZ PABLO A",
            ("conveyance", "PLB", "individual"),
        ),
        ("DEED", "PHILADELPHIA LAND BANK", "BLUE OAK HOMES LLC", ("conveyance", "PLB", "company")),
        (
            "MISCELLANEOUS DEED",
            "REDEVELOPMENT AUTHORITY OF THE CITY OF PHILADELPHIA",
            "GREEN SHOOTS COMMUNITY LAND TRUST",
            ("conveyance", "PRA", "nonprofit"),
        ),
        (
            "DEED MISCELLANEOUS",
            "CITY OF PHILADELPHIA; DEPARTMENT OF PUBLIC PROPERTY",
            "PHILADELPHIA HOUSING AUTHORITY",
            ("conveyance", "PUB", "housing_authority"),
        ),
        # Between agencies: nobody outside the public system received anything.
        (
            "DEED LAND BANK",
            "CITY OF PHILADELPHIA",
            "PHILADELPHIA LAND BANK",
            ("between", "PUB", None),
        ),
        # Agreements: the same parties on both sides, or an agency on both sides.
        (
            "MISCELLANEOUS DEED",
            "PHILADELPHIA LAND BANK;CORTEZ PABLO A",
            "CORTEZ PABLO A;PHILADELPHIA LAND BANK",
            ("agreement", None, None),
        ),
        (
            "DEED LAND BANK",
            "PHILADELPHIA LAND BANK",
            "PHILADELPHIA LAND BANK",
            ("agreement", None, None),
        ),
        # Other: a private party or a department among the sellers, or not a plain deed.
        (
            "DEED",
            "PHILADELPHIA LAND BANK;SUSQUEHANNA SQUARE LP",
            "SUSQUEHANNA HOUSING LLP",
            ("other", None, None),
        ),
        (
            "MISCELLANEOUS DEED",
            "CITY OF PHILADELPHIA;WATER DEPARTMENT",
            "ACME TOOL LLC",
            ("other", None, None),
        ),
        ("DEED SHERIFF", "CITY OF PHILADELPHIA", "STONE ROBIN", ("other", None, None)),
        (
            "DEED OF CONDEMNATION",
            "PHILADELPHIA REDEVELOPMENT AUTHORITY",
            "ROE RICHARD",
            ("other", None, None),
        ),
        ("DEED", "PHILADELPHIA LAND BANK", None, ("other", None, None)),
    ],
)
def test_deeds_are_sorted_into_kinds(kind, sellers, buyers, expected) -> None:
    deed = classify(kind, sellers, buyers)
    assert (deed.kind, deed.agency, deed.buyer_type) == expected


def test_a_move_between_agencies_names_both() -> None:
    deed = classify(
        "DEED LAND BANK", "PHILADELPHIA REDEVELOPMENT AUTHORITY", "PHILADELPHIA LAND BANK"
    )
    assert (deed.agency, deed.to_agency) == ("PRA", "PLB")


def test_buyer_groups_put_public_bodies_together() -> None:
    assert land_bank.buyer_group("housing_authority") == "public"
    assert land_bank.buyer_group("other_public") == "public"
    assert land_bank.buyer_group("individual") == "individual"
    assert land_bank.buyer_group("whatever") == "unknown"


# Next door and follow ups -----------------------------------------------------------------------


def test_owner_records_name_couples_the_way_opa_writes_them() -> None:
    assert owner_keys("TILLER JAMES R", "GLADYS") == {("TILLER", "JAMES"), ("TILLER", "GLADYS")}
    assert owner_keys("CORTEZ PABLO A", None) == {("CORTEZ", "PABLO")}


def test_a_buyer_owns_next_door_by_last_and_first_name() -> None:
    assert owns_next_door(["CORTEZ PABLO"], [("CORTEZ PABLO A", None)])
    assert owns_next_door(["TILLER GLADYS M"], [("TILLER JAMES R", "GLADYS")])
    assert owns_next_door(["HOPE CHAPEL CHURCH"], [("HOPE CHAPEL CHURCH", None)])
    # The same last name alone is not enough.
    assert not owns_next_door(["CORTEZ MARIA"], [("CORTEZ PABLO A", None)])
    assert not owns_next_door(["STONE ROBIN"], [])


def test_follow_ups_are_not_counted_again() -> None:
    day = date(2024, 5, 1)
    rows = [
        ConveyanceRow("opa:1", day, 10, ("BLUE OAK HOMES LLC",)),
        # A corrected spelling a few weeks later.
        ConveyanceRow("opa:1", date(2024, 6, 9), 11, ("BLUE OKA HOMES LLC",)),
        # The release of the restrictions three years later, to the same buyer.
        ConveyanceRow("opa:1", date(2027, 6, 1), 12, ("BLUE OAK HOMES LLC",)),
        # Someone else, years later: a new conveyance.
        ConveyanceRow("opa:1", date(2029, 1, 1), 13, ("STONE ROBIN",)),
        # Another property, same buyer: not a follow up.
        ConveyanceRow("opa:2", day, 10, ("BLUE OAK HOMES LLC",)),
        # The same person written with a middle initial, years later.
        ConveyanceRow("opa:3", date(2020, 1, 1), 20, ("OLIVER DAVID",)),
        ConveyanceRow("opa:3", date(2023, 1, 1), 21, ("OLIVER DAVID V",)),
    ]
    assert follow_ups(rows) == [False, True, True, False, False, False, True]


def test_the_program_is_only_inferred_for_one_lot_to_a_person_next_door() -> None:
    assert land_bank.program_of("individual", 1, True) == "side_yard"
    assert land_bank.program_of("individual", 1, False) == "other"
    assert land_bank.program_of("individual", 1, None) == "other"
    assert land_bank.program_of("individual", 2, True) == "other"
    assert land_bank.program_of("company", 1, True) == "other"


def test_the_price_is_this_property_share() -> None:
    assert land_bank.deed_price(5000.0, 15000.0) == 5000.0
    assert land_bank.deed_price(None, 15000.0) == 15000.0
    assert land_bank.deed_price(None, None) is None


def test_fiscal_years_end_in_june() -> None:
    assert fiscal_year(date(2022, 6, 30)) == 2022
    assert fiscal_year(date(2022, 7, 1)) == 2023


# The listed lots, week by week ------------------------------------------------------------------


def city_list(statuses: list[tuple[str, str, str, str]]) -> pa.Table:
    return pa.table(
        {
            "opabrt": [row[0] for row in statuses],
            "agency": [row[1] for row in statuses],
            "status_1": [row[2] for row in statuses],
            "sideyardeligible": [row[3] for row in statuses],
            "geometry": [shapely_point(i) for i in range(len(statuses))],
        }
    )


def shapely_point(i: int) -> bytes:
    import shapely

    return shapely.to_wkb(Point(-75.15 + i / 1000, 39.99), flavor="iso")


WEEK_1 = [
    ("100000002", "PLB", "Owned - Available", "Yes"),
    ("100000009", "PUB", "Owned - Available (not for SY)", "Yes"),
    ("100000009", "PUB", "Owned - Available (not for SY)", "Yes"),
    ("100000010", "PRA", "Owned - On Hold for AHD", "No"),
]
WEEK_2 = [
    ("100000009", "PUB", "Owned - Available (not for SY)", "Yes"),
    ("100000010", "PRA", "Owned - Sale Pending", "No"),
    ("100000011", "PLB", "Owned - Available", "No"),
]


def test_each_snapshot_of_the_city_list_adds_one_line_once(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_snapshot(
        ctx,
        "city_owned_property",
        city_list(WEEK_1),
        geometry=True,
        fetched_at="2026-10-04T17:25:42Z",
        geometry_types=["Point"],
    )
    folder = ctx.cache.snapshot_dir("city_owned_property")
    first = land_bank.record_list_counts(folder)
    assert [entry["date"] for entry in first] == ["2026-10-04"]
    assert first[0]["listed"] == 3 and first[0]["parcels"] == 2
    # "Not for SY" lots are not side yard lots.
    assert first[0]["side_yard"] == 1
    assert first[0]["by_agency"] == {"PLB": 1, "PUB": 2}
    assert first[0]["by_status"]["Owned - On Hold for AHD"] == 1
    # Counting again changes nothing.
    assert land_bank.record_list_counts(folder) == first
    install_snapshot(
        ctx,
        "city_owned_property",
        city_list(WEEK_2),
        geometry=True,
        fetched_at="2026-10-12T10:05:00Z",
        geometry_types=["Point"],
    )
    both = land_bank.record_list_counts(folder)
    series = land_bank.weekly_series(both)
    assert [(w["date"], w["listed"], w["parcels"]) for w in series] == [
        ("2026-10-04", 3, 2),
        ("2026-10-12", 2, 2),
    ]
    saved = json.loads((folder / "history.json").read_text(encoding="utf-8"))
    assert saved["schema"] == 1 and len(saved["snapshots"]) == 2


def test_a_new_good_snapshot_of_the_city_list_is_counted_when_it_becomes_current(
    context_factory,
) -> None:
    from .conftest import FakeArcgis, arcgis_feature

    fields = [
        {"name": "objectid", "type": "esriFieldTypeOID"},
        {"name": "opabrt", "type": "esriFieldTypeString"},
        {"name": "agency", "type": "esriFieldTypeString"},
        {"name": "status_1", "type": "esriFieldTypeString"},
        {"name": "sideyardeligible", "type": "esriFieldTypeString"},
    ]
    features = [
        arcgis_feature(
            {"objectid": i + 1, "opabrt": a, "agency": g, "status_1": s, "sideyardeligible": y},
            Point(-75.15 + i / 1000, 39.99),
        )
        for i, (a, g, s, y) in enumerate(WEEK_1)
    ]
    fake = FakeArcgis(fields=fields, features=features, geometry_type="esriGeometryPoint")
    ctx = context_factory(handler=fake, now=NOW)
    source = relaxed(ctx.registry.sources["city_owned_property"])
    store = run(ctx, source)
    history = land_bank.read_history(store.dir)
    assert [(e["date"], e["listed"]) for e in history] == [("2026-10-09", 3)]


# The whole page, from a small invented block ----------------------------------------------------

LOT_W = 0.00006  # about five meters


def parcel(n: int) -> box:
    """Parcel n of the block, side by side along one street."""
    x = -75.15 + n * LOT_W
    return box(x, 39.99, x + LOT_W, 39.9902)


def centre(n: int) -> Point:
    return parcel(n).centroid


OWNERS = {
    "100000001": ("CORTEZ PABLO A", None),  # the house beside lot 2
    "100000003": ("TILLER JAMES R", "GLADYS"),  # the house beside lot 4
    "100000005": ("CITY OF PHILADELPHIA", None),
    "100000007": ("ROE RICHARD", None),
}


def deed(n, doc, kind, day, sellers, buyers, price, count=1, opa=None, where=None) -> dict:
    return {
        "cartodb_id": n,
        "document_id": str(doc),
        "document_type": kind,
        "display_date": day,
        "opa_account_num": opa,
        "grantors": sellers,
        "grantees": buyers,
        "total_consideration": None if price is None else str(price * count),
        "adjusted_total_consideration": None if price is None else str(price),
        "property_count": str(count),
        "geometry": hex_wkb(where) if where is not None else None,
    }


PLB = "PHILADELPHIA LAND BANK"
PRA = "PHILADELPHIA REDEVELOPMENT AUTHORITY"
CITY = "CITY OF PHILADELPHIA; DEPARTMENT OF PUBLIC PROPERTY"
DEEDS = [
    # Lot 2: the City moves it to the Land Bank, which conveys it to the neighbor (a side yard),
    # with the agreement recorded beside it.
    deed(1, 501, "DEED LAND BANK", "2024-02-01", CITY, PLB, 1, opa="100000002", where=centre(2)),
    deed(
        2,
        502,
        "DEED LAND BANK",
        "2025-03-03",
        PLB,
        "CORTEZ PABLO A",
        20000,
        opa="100000002",
        where=centre(2),
    ),
    deed(
        3,
        503,
        "MISCELLANEOUS DEED",
        "2025-03-20",
        f"{PLB};CORTEZ PABLO A",
        f"{PLB};CORTEZ PABLO A",
        0,
        opa="100000002",
        where=centre(2),
    ),
    # Lot 4: to the wife of the owner next door, who OPA writes as "GLADYS".
    deed(4, 504, "DEED", "2025-08-14", PLB, "TILLER GLADYS", 1, opa="100000004", where=centre(4)),
    # Lot 6: one lot to a person who does not live next door.
    deed(5, 505, "DEED", "2024-11-02", PRA, "STONE ROBIN", 45000, opa="100000006", where=centre(6)),
    # Lots 8 to 10: three lots in one deed to a builder, and a corrected deed for lot 8.
    deed(
        6,
        506,
        "DEED",
        "2024-05-10",
        PLB,
        "BLUE OAK HOMES LLC",
        100,
        count=3,
        opa="100000008",
        where=centre(8),
    ),
    deed(
        7,
        506,
        "DEED",
        "2024-05-10",
        PLB,
        "BLUE OAK HOMES LLC",
        100,
        count=3,
        opa="100000009",
        where=centre(9),
    ),
    deed(
        8,
        506,
        "DEED",
        "2024-05-10",
        PLB,
        "BLUE OAK HOMES LLC",
        100,
        count=3,
        opa="100000010",
        where=centre(10),
    ),
    deed(
        9,
        507,
        "MISCELLANEOUS DEED",
        "2024-07-01",
        PLB,
        "BLUE OAK HOMES LIMITED LIABILITY COMPANY",
        0,
        opa="100000008",
        where=centre(8),
    ),
    # A garden trust (a nonprofit), with no parcel number, in 2014; and the City to the housing
    # authority, with no price and no location.
    deed(
        10,
        508,
        "MISCELLANEOUS DEED",
        "2014-06-30",
        PRA,
        "GREEN SHOOTS COMMUNITY LAND TRUST",
        1,
        where=Point(-75.2, 39.95),
    ),
    deed(11, 509, "DEED MISCELLANEOUS", "2015-07-01", CITY, "PHILADELPHIA HOUSING AUTHORITY", None),
    # Not conveyances: an easement with the Water Department, a sheriff deed.
    deed(
        12,
        510,
        "MISCELLANEOUS DEED",
        "2020-01-01",
        "CITY OF PHILADELPHIA;WATER DEPARTMENT",
        "ACME TOOL LLC",
        0,
    ),
    deed(
        13,
        511,
        "DEED SHERIFF",
        "2020-02-01",
        "CITY OF PHILADELPHIA",
        "ROE RICHARD",
        9000,
        opa="100000007",
    ),
]


def block_snapshots(ctx) -> None:
    accounts = [f"10000000{n}" if n < 10 else f"1000000{n}" for n in range(1, 11)]
    install_snapshot(
        ctx,
        "pwd_parcels",
        pa.table(
            {
                "brt_id": accounts,
                "geometry": [parcel(n).wkb for n in range(1, 11)],
            }
        ),
        geometry=True,
        fetched_at="2026-10-04T12:00:00Z",
    )
    install_snapshot(
        ctx,
        "opa_properties",
        pa.table(
            {
                "parcel_number": list(OWNERS),
                "owner_1": [o[0] for o in OWNERS.values()],
                "owner_2": [o[1] for o in OWNERS.values()],
            }
        ),
        geometry=False,
        fetched_at="2026-10-04T12:00:00Z",
    )


def test_the_deeds_snapshot_holds_answers_and_never_names(context_factory) -> None:
    ctx = context_factory(now=NOW)
    block_snapshots(ctx)
    source = relaxed(ctx.registry.sources["land_conveyances"])
    fake = FakeCarto(tables={"rtt_summary": DEEDS})
    ctx = context_factory(handler=fake, now=NOW)
    store = run(ctx, source)
    path = store.path_for(store.current())
    table = pq.read_table(path)
    assert "grantors" not in table.column_names and "grantees" not in table.column_names
    raw = path.read_bytes()
    for name in (b"CORTEZ", b"TILLER", b"STONE", b"BLUE OAK", b"GREEN SHOOTS", b"ROE"):
        assert name not in raw
    for query in fake.queries:
        for never in ADAPTERS["land_conveyances"].never_fetch:
            assert never not in query
    rows = {
        r["document_id"]: r
        for r in table.to_pylist()
        if r["opa_account_num"] in (None, "100000002", "100000004", "100000006", "100000008")
    }
    assert rows[502]["kind"] == "conveyance" and rows[502]["next_door"] is True
    assert rows[504]["next_door"] is True
    assert rows[505]["next_door"] is False
    assert rows[501]["kind"] == "between" and rows[501]["to_agency"] == "PLB"
    assert rows[503]["kind"] == "agreement"
    assert rows[507]["follow_up"] is True and rows[506]["follow_up"] is False
    # The many lot deed is not checked for a neighbor at all.
    assert rows[506]["next_door"] is None
    # The download with the names is gone once checked.
    assert not list((ctx.cache.root / "raw" / "land_conveyances").glob("*/chunk-*.csv"))


def test_the_numbers_are_reproduced_from_the_fixtures(context_factory, tmp_path) -> None:
    ctx = context_factory(now=NOW)
    block_snapshots(ctx)
    source = relaxed(ctx.registry.sources["land_conveyances"])
    ctx = context_factory(handler=FakeCarto(tables={"rtt_summary": DEEDS}), now=NOW)
    run(ctx, source)
    # Council districts: 5 west of -75.1495, 7 east of it (today's lines).
    import shapely

    install_snapshot(
        ctx,
        "council_districts",
        pa.table(
            {
                "district_num": [5, 7],
                "geometry": [
                    shapely.to_wkb(box(-75.16, 39.98, -75.1495, 40.0), flavor="iso"),
                    shapely.to_wkb(box(-75.1495, 39.98, -75.14, 40.0), flavor="iso"),
                ],
            }
        ),
        geometry=True,
        fetched_at="2026-10-04T12:00:00Z",
    )
    install_snapshot(
        ctx,
        "land_conveyed_by_fy",
        pa.table(
            {
                "fiscal_year": [2024.0, 2025.0],
                "business_expansion": [0.0, 1.0],
                "garden_or_open_space": [2.0, 0.0],
                "housing_units_below_30_pct_ami": [5.0, 0.0],
                "housing_units_60_80_pct_ami": [0.0, 3.0],
                "housing_units_80_120_pct_ami": [1.0, 0.0],
                "housing_units_market_rate": [0.0, 0.0],
                "sideyards": [1.0, 2.0],
                "geometry": [None, None],
            }
        ),
        geometry=True,
        fetched_at="2026-10-09T12:00:00Z",
    )
    install_snapshot(
        ctx,
        "city_owned_property",
        city_list(WEEK_1),
        geometry=True,
        fetched_at="2026-10-04T17:25:42Z",
        geometry_types=["Point"],
    )

    statuses = {status.id: status for status in all_statuses(ctx)}
    out = tmp_path / "data"
    result = build_land_bank(ctx, statuses, out, date(2026, 10, 9))
    assert result.notes == []
    text = (out / LAND_BANK_TABLE).read_text(encoding="utf-8")
    for name in ("CORTEZ", "TILLER", "STONE", "BLUE OAK", "GREEN SHOOTS", "ROE", "100000002"):
        assert name not in text
    data = json.loads(text)
    assert data["schema"] == 1
    deeds = data["deeds"]
    assert (deeds["first"], deeds["last"], deeds["partial_year"]) == (
        "2014-06-30",
        "2025-08-14",
        2025,
    )
    assert deeds["years"] == list(range(2014, 2026))
    # Counted: lots 2 and 4 (side yards), 6, 8, 9 and 10, the garden trust and the housing
    # authority. Left out: the follow up, the move, the agreement and the two other documents.
    assert (
        deeds["counted"],
        deeds["follow_ups"],
        deeds["moved"],
        deeds["agreements"],
        deeds["other"],
    ) == (8, 1, 1, 1, 2)

    every = data["agencies"]["all"]
    assert every["total"]["n"] == 8
    assert every["total"]["deeds"] == 6
    assert every["total"]["buyers"] == {
        "individual": 3,
        "company": 3,
        "nonprofit": 1,
        "public": 1,
        "unknown": 0,
    }
    assert every["total"]["programs"] == {"side_yard": 2, "other": 6}
    # Prices per property: 20,000, 1, 45,000, 100, 100, 100, 1, and none for the City's deed.
    assert every["total"]["price"] == {"median": 100, "priced": 7, "nominal": 5, "none": 1}
    by_year = {y["year"]: y for y in every["years"]}
    assert (
        by_year[2024]["n"] == 4
        and by_year[2024]["moved_out"] == 1
        and by_year[2024]["moved_in"] == 1
    )
    assert by_year[2025]["programs"] == {"side_yard": 2, "other": 0}
    assert by_year[2016]["n"] == 0 and by_year[2016]["price"]["median"] is None

    plb = data["agencies"]["PLB"]["total"]
    assert (plb["n"], plb["moved_out"], plb["moved_in"]) == (5, 0, 1)
    assert data["agencies"]["PUB"]["total"]["moved_out"] == 1
    assert data["agencies"]["PRA"]["total"]["n"] == 2

    districts = {d["district"]: d["n"] for d in every["districts"]}
    # Lots 2 to 6 lie west of the line, 8 to 10 east; the garden trust and the City's deed have
    # no district.
    assert districts[5] == 3 and districts[7] == 3 and districts[None] == 2

    fy = {row["fy"]: row for row in data["programs_fy"]["rows"]}
    assert data["programs_fy"]["edited"] == "2023-04-11"
    # Our inferred side yards in the City's fiscal years: lot 2 in fiscal 2025 (March 2025); lot 4,
    # in August 2025, belongs to fiscal 2026, which the City's table does not have.
    assert (fy[2025]["side_yards"], fy[2025]["inferred_plb"], fy[2025]["inferred_all"]) == (2, 1, 1)
    assert fy[2024]["homes_below_30"] == 5

    weeks = data["listed"]["weeks"]
    assert [(w["date"], w["listed"], w["side_yard"]) for w in weeks] == [("2026-10-04", 3, 1)]


def test_without_deeds_the_page_has_no_table_and_says_so(context_factory, tmp_path) -> None:
    ctx = context_factory(now=NOW)
    statuses = {status.id: status for status in all_statuses(ctx)}
    result = build_land_bank(ctx, statuses, tmp_path, date(2026, 10, 9))
    assert not (tmp_path / LAND_BANK_TABLE).exists()
    assert result.notes and "deed records are missing" in result.notes[0]


def test_the_snapshot_store_keeps_the_history_beside_the_snapshots(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_snapshot(
        ctx,
        "city_owned_property",
        city_list(WEEK_1),
        geometry=True,
        fetched_at="2026-10-04T17:25:42Z",
        geometry_types=["Point"],
    )
    store = SnapshotStore(ctx.cache, "city_owned_property")
    land_bank.record_list_counts(store.dir)
    # The history is not a snapshot sidecar: the store still sees one snapshot.
    assert [meta.snapshot_id for meta in store.all()] == ["20261004T172542Z"]
