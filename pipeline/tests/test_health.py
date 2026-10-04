"""Health rules and fallback: a bad download never replaces the last good snapshot.

These run the real fetch and validate steps for the shootings adapter against a fake Carto server,
moving the clock forward between runs like weekly refreshes.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from placekeepers.health import evaluate, source_status
from placekeepers.registry import Health, Source
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FakeCarto

FIRST_RUN = datetime(2026, 10, 1, 15, 0, tzinfo=UTC)
SECOND_RUN = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)


def rows(count: int, newest: date) -> list[dict]:
    return [
        {
            "cartodb_id": n,
            "objectid": n,
            "date_": (newest - timedelta(days=n)).isoformat(),
            "fatal": "0",
            "lat": 39.95,
            "lng": -75.16,
        }
        for n in range(count)
    ]


@pytest.fixture
def setup(context_factory):
    fake = FakeCarto(tables={"shootings": rows(20, date(2026, 9, 30))})
    ctx = context_factory(handler=fake, now=FIRST_RUN)
    base = ctx.registry.sources["shootings"]
    source: Source = base.model_copy(
        update={
            "health": Health(min_rows=10, max_drop_pct=5, newest_field="date_", max_age_days=14)
        }
    )
    return ctx, fake, source


def refresh(ctx, source, when: datetime):
    ctx.settings.fixed_now = when
    fetched = fetch_source(ctx, source)
    validated = validate_source(ctx, source)
    return fetched, validated


def status_of(ctx, source):
    return source_status(source.id, SnapshotStore(ctx.cache, source.id), has_adapter=True)


def test_a_good_download_becomes_the_current_snapshot(setup) -> None:
    ctx, _, source = setup
    fetched, validated = refresh(ctx, source, FIRST_RUN)
    assert (fetched.outcome, validated.outcome) == ("downloaded", "ok")
    status = status_of(ctx, source)
    assert status.to_manifest() == {
        "status": "ok",
        "last_attempt": "2026-10-01T15:00:00Z",
        "last_success": "2026-10-01T15:00:00Z",
        "stale_since": None,
        "rows": 20,
        "newest_record": "2026-09-30",
        "message": None,
    }
    store = SnapshotStore(ctx.cache, source.id)
    assert (store.dir / "current.parquet").resolve() == store.path_for(store.current())
    assert not any((ctx.cache.raw_dir(source.id)).iterdir())  # the raw CSV was cleaned up


def test_a_row_count_collapse_falls_back_to_the_last_good_snapshot(setup) -> None:
    ctx, fake, source = setup
    refresh(ctx, source, FIRST_RUN)
    good = SnapshotStore(ctx.cache, source.id).current()

    fake.tables["shootings"] = rows(12, date(2026, 10, 3))  # 40% fewer rows
    _, validated = refresh(ctx, source, SECOND_RUN)

    assert validated.outcome == "rejected"
    assert validated.detail == (
        "Rows fell from 20 to 12 (40% fewer), more than the 5% allowed. "
        "Keeping the copy from 2026-10-01"
    )
    store = SnapshotStore(ctx.cache, source.id)
    assert store.current().snapshot_id == good.snapshot_id
    assert [meta.status for meta in store.all()] == ["good", "rejected"]
    status = status_of(ctx, source)
    assert status.status == "stale"
    assert status.stale_since == "2026-10-01"
    assert status.rows == 20 and status.newest_record == "2026-09-30"
    assert status.last_attempt == "2026-10-04T15:00:00Z"
    assert status.last_success == "2026-10-01T15:00:00Z"
    assert status.message == "Rows fell from 20 to 12 (40% fewer), more than the 5% allowed"


def test_a_stale_newest_date_falls_back_to_the_last_good_snapshot(setup) -> None:
    ctx, fake, source = setup
    refresh(ctx, source, FIRST_RUN)
    good = SnapshotStore(ctx.cache, source.id).current()

    fake.tables["shootings"] = rows(20, date(2026, 8, 1))  # same size, but nothing new since August
    _, validated = refresh(ctx, source, SECOND_RUN)

    assert validated.outcome == "rejected"
    status = status_of(ctx, source)
    assert status.status == "stale"
    assert status.stale_since == "2026-10-01"
    assert status.message == (
        "The newest record is from 2026-08-01, 64 days ago (the limit is 14 days)"
    )
    assert SnapshotStore(ctx.cache, source.id).current().snapshot_id == good.snapshot_id


def test_with_no_good_snapshot_a_failure_is_failing(setup) -> None:
    ctx, fake, source = setup
    fake.tables["shootings"] = rows(3, date(2026, 9, 30))
    _, validated = refresh(ctx, source, FIRST_RUN)
    assert validated.detail.endswith("There is no earlier good copy")
    status = status_of(ctx, source)
    assert status.to_manifest() == {
        "status": "failing",
        "last_attempt": "2026-10-01T15:00:00Z",
        "last_success": None,
        "stale_since": None,
        "rows": None,
        "newest_record": None,
        "message": "Only 3 rows, fewer than the 10 expected",
    }


def test_a_failed_download_keeps_the_last_good_snapshot_and_counts_failures(setup) -> None:
    ctx, fake, source = setup
    refresh(ctx, source, FIRST_RUN)
    fake.fail_status = 503
    for day in (SECOND_RUN, SECOND_RUN + timedelta(days=7)):
        fetched, validated = refresh(ctx, source, day)
        assert fetched.outcome == "failed"
        assert validated.outcome == "nothing_new"
    status = status_of(ctx, source)
    assert status.status == "stale"
    assert status.consecutive_failures == 2
    assert status.message.startswith(
        "Download failed: phl.carto.com/api/v2/sql: gave up after 3 attempts: HTTP 503"
    )
    assert status.rows == 20

    fake.fail_status = None
    fake.tables["shootings"] = rows(21, date(2026, 10, 10))
    refresh(ctx, source, SECOND_RUN + timedelta(days=8))
    status = status_of(ctx, source)
    assert (status.status, status.consecutive_failures, status.rows) == ("ok", 0, 21)


def test_only_the_newest_snapshots_are_kept(setup) -> None:
    ctx, fake, source = setup
    for week in range(5):
        fake.tables["shootings"] = rows(20 + week, date(2026, 9, 30) + timedelta(days=7 * week))
        refresh(ctx, source, FIRST_RUN + timedelta(days=7 * week))
    store = SnapshotStore(ctx.cache, source.id)
    assert [meta.rows for meta in store.all()] == [22, 23, 24]
    assert len(list(store.dir.glob("*.parquet"))) == 4  # three snapshots plus current.parquet


def test_validate_without_a_new_download_changes_nothing(setup) -> None:
    ctx, _, source = setup
    refresh(ctx, source, FIRST_RUN)
    assert validate_source(ctx, source).outcome == "nothing_new"
    assert status_of(ctx, source).status == "ok"


def test_never_fetched_is_missing(context_factory) -> None:
    ctx = context_factory()
    status = source_status("shootings", SnapshotStore(ctx.cache, "shootings"), has_adapter=True)
    assert status.to_manifest()["status"] == "missing"


def test_future_dates_do_not_hide_a_source_that_stopped(setup) -> None:
    ctx, fake, source = setup
    old = rows(20, date(2026, 8, 1))
    old.append({**old[0], "cartodb_id": 99, "objectid": 99, "date_": "2031-01-01"})  # a typo
    fake.tables["shootings"] = old
    _, validated = refresh(ctx, source, SECOND_RUN)
    assert validated.outcome == "rejected"
    assert "The newest record is from 2026-08-01, 64 days ago" in validated.detail


def test_evaluate_reports_every_rule() -> None:
    checks = evaluate(
        Health(min_rows=5, max_drop_pct=10, newest_field="d", max_age_days=3),
        rows=4,
        columns=["a"],
        newest=None,
        required=["a", "b"],
        last_good=None,
        today=date(2026, 10, 4),
    )
    assert [(check.rule, check.ok) for check in checks] == [
        ("required_columns", False),
        ("min_rows", False),
        ("newest_record", False),
    ]
    assert checks[0].detail == "Missing columns: b"
