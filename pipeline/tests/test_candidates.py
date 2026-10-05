"""The vacancy candidate parcels, gathered from every source with a sign of vacancy."""

from __future__ import annotations

from datetime import UTC, date, datetime

import pyarrow as pa

from placekeepers.candidates import CANDIDATE_SOURCES, candidate_accounts

from .conftest import install_snapshot

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)


def put(ctx, source_id: str, columns: dict) -> None:
    install_snapshot(
        ctx, source_id, pa.table(columns), geometry=False, fetched_at="2026-10-04T14:00:00Z"
    )


def test_candidates_join_every_signal_and_clean_the_accounts(context_factory) -> None:
    ctx = context_factory(now=NOW)
    put(ctx, "vacant_indicators_land", {"opa_id": ["370000001", None, " 370000002 "]})
    put(ctx, "city_owned_property", {"opabrt": ["121099030/9130", "472058210\n", "unknown"]})
    put(
        ctx,
        "opa_properties",
        {
            "parcel_number": ["100000001", "100000002", "100000003", "100000004"],
            "category_code": ["6", "1", "13", "1"],
            "exterior_condition": [None, "7", None, "4"],
        },
    )
    put(
        ctx,
        "li_clean_and_seal",
        {
            "opa_account_num": ["200000001", "200000002"],
            "casecreateddate": pa.array([date(2015, 6, 1), date(2020, 1, 1)], pa.date32()),
        },
    )
    put(
        ctx,
        "li_demolitions",
        {
            "opa_account_num": ["300000001", "300000002", "300000003"],
            "start_date": pa.array([date(2010, 1, 1), None, None], pa.date32()),
            "completed_date": pa.array([None, date(2019, 5, 1), None], pa.date32()),
        },
    )
    put(ctx, "li_unsafe", {"opa_account_num": ["37000001"]})
    # Vacancy complaints count (a vacant lot, a vacant or open building); others do not.
    put(
        ctx,
        "li_complaints",
        {
            "opa_account_num": ["400000001", "400000002", "400000003", "400000004", "400000005"],
            "complaintcode": ["VL", "VA", "VO", "BDNO", "PMHW"],
        },
    )

    found = candidate_accounts(ctx)
    assert found.accounts == [
        "037000001",  # 8 digits get their leading zero back
        "100000001",  # OPA vacant land
        "100000002",  # OPA says the exterior is sealed or open
        "100000003",
        "121099030",  # the first of two accounts in one field
        "200000002",  # cleaned and sealed since 2016 (the 2015 one is left out)
        "300000002",  # demolished since 2016 (the 2010 one and the undated one are left out)
        "370000001",
        "370000002",
        "400000001",  # vacancy complaints: VL, VA, VO and BDNO (high weeds is not one)
        "400000002",
        "400000003",
        "400000004",
        "472058210",
    ]
    assert found.by_source == {
        "vacant_indicators_land": 2,
        "city_owned_property": 2,
        "opa_properties": 3,
        "li_clean_and_seal": 1,
        "li_demolitions": 1,
        "li_unsafe": 1,
        "li_complaints": 4,
    }
    assert found.missing == ["vacant_indicators_bldg", "phs_landcare", "li_imminently_dangerous"]
    assert set(found.by_source) | set(found.missing) == set(CANDIDATE_SOURCES)


def test_an_older_opa_snapshot_without_condition_notes_still_works(context_factory) -> None:
    ctx = context_factory(now=NOW)
    put(
        ctx,
        "opa_properties",
        {"parcel_number": ["100000001", "100000002"], "category_code": ["6", "1"]},
    )
    assert candidate_accounts(ctx).accounts == ["100000001"]


def test_no_snapshots_means_no_candidates(context_factory) -> None:
    found = candidate_accounts(context_factory(now=NOW))
    assert found.accounts == []
    assert found.missing == list(CANDIDATE_SOURCES)
