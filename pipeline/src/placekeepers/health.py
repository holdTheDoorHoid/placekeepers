"""Health rules for sources, and the status each source reports.

A new snapshot must pass every rule in its registry entry before the map uses it:

* the columns the adapter needs are present;
* there are at least `min_rows` rows;
* the row count has not dropped more than `max_drop_pct` percent below the last good snapshot;
* the newest record (in `newest_field`) is at most `max_age_days` old.

Statuses follow docs/CONTRACTS.md: ok, stale (using the last good snapshot), failing (no usable
snapshot), missing (never fetched).
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import asdict, dataclass
from datetime import date
from typing import Any

from placekeepers.config import local_date, parse_iso_z
from placekeepers.registry import Health
from placekeepers.snapshots import SnapshotMeta, SnapshotStore


@dataclass(frozen=True)
class Check:
    rule: str
    ok: bool
    detail: str

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


def _n(value: int) -> str:
    return f"{value:,}"


def evaluate(
    health: Health,
    *,
    rows: int,
    columns: Iterable[str],
    newest: date | None,
    required: Iterable[str],
    last_good: SnapshotMeta | None,
    today: date,
) -> list[Check]:
    checks: list[Check] = []
    present = set(columns)

    missing = [name for name in required if name not in present]
    if missing:
        checks.append(Check("required_columns", False, f"Missing columns: {', '.join(missing)}"))
    else:
        checks.append(Check("required_columns", True, "All required columns are present"))

    if rows < health.min_rows:
        checks.append(
            Check(
                "min_rows",
                False,
                f"Only {_n(rows)} rows, fewer than the {_n(health.min_rows)} expected",
            )
        )
    else:
        checks.append(Check("min_rows", True, f"{_n(rows)} rows (at least {_n(health.min_rows)})"))

    if last_good is not None and last_good.rows > 0:
        drop = (last_good.rows - rows) / last_good.rows * 100
        if drop > health.max_drop_pct:
            checks.append(
                Check(
                    "max_drop_pct",
                    False,
                    f"Rows fell from {_n(last_good.rows)} to {_n(rows)} ({drop:.0f}% fewer), "
                    f"more than the {health.max_drop_pct:g}% allowed",
                )
            )
        else:
            checks.append(
                Check("max_drop_pct", True, f"Rows went from {_n(last_good.rows)} to {_n(rows)}")
            )

    if health.newest_field:
        field = health.newest_field
        if field not in present:
            checks.append(Check("newest_record", False, f"The date field {field} is missing"))
        elif newest is None:
            checks.append(Check("newest_record", False, f"No usable dates in {field}"))
        elif health.max_age_days is not None and (today - newest).days > health.max_age_days:
            age = (today - newest).days
            checks.append(
                Check(
                    "newest_record",
                    False,
                    f"The newest record is from {newest.isoformat()}, {age} days ago (the limit is "
                    f"{health.max_age_days} days)",
                )
            )
        else:
            checks.append(Check("newest_record", True, f"The newest record is from {newest}"))
    return checks


def failed_summary(checks: Iterable[Check]) -> str | None:
    failed = [check.detail for check in checks if not check.ok]
    return "; ".join(failed) if failed else None


@dataclass
class SourceStatus:
    """One row of the health report and one entry of manifest.json `sources`."""

    id: str
    status: str
    last_attempt: str | None
    last_success: str | None
    stale_since: str | None
    rows: int | None
    newest_record: str | None
    message: str | None
    consecutive_failures: int = 0
    snapshot: SnapshotMeta | None = None

    def to_manifest(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "last_attempt": self.last_attempt,
            "last_success": self.last_success,
            "stale_since": self.stale_since,
            "rows": self.rows,
            "newest_record": self.newest_record,
            "message": self.message,
        }


def source_status(source_id: str, store: SnapshotStore, *, has_adapter: bool) -> SourceStatus:
    state = store.state()
    current = store.current()
    rows = current.rows if current else None
    newest = current.newest_record if current else None
    last_success = current.fetched_at if current else None

    if current is None and state.last_result is None:
        message = "Not fetched yet" if has_adapter else "Not collected yet"
        return SourceStatus(source_id, "missing", None, None, None, None, None, message)

    if current is not None and state.last_result in (None, "ok"):
        status, stale_since, message = "ok", None, None
    elif current is not None:
        status = "stale"
        stale_since = local_date(parse_iso_z(current.fetched_at)).isoformat()
        message = state.message
    else:
        status, stale_since = "failing", None
        message = state.message or "The last good copy is missing from the cache"

    return SourceStatus(
        id=source_id,
        status=status,
        last_attempt=state.last_attempt or last_success,
        last_success=last_success,
        stale_since=stale_since,
        rows=rows,
        newest_record=newest,
        message=message,
        consecutive_failures=state.consecutive_failures,
        snapshot=current,
    )
