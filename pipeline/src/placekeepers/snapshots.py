"""Snapshots: every normalized download is kept as Parquet (or GeoParquet) with a JSON sidecar.

A snapshot that passes its health rules becomes the source's current snapshot. One that fails is
kept as "rejected" for inspection, and the map keeps using the last good one. Only the newest few
snapshots of each source are kept on this machine.

Sidecar fields: source, snapshot_id, file, format, fetched_at, rows, sha256, bytes, newest_record,
status ("good" or "rejected"), checks, message, columns, notes (data quality remarks), and
raw_fetch_id.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from placekeepers.cache import Cache, atomic_symlink, atomic_write_json

log = logging.getLogger(__name__)

CURRENT_LINK = "current.parquet"
STATE_FILE = "state.json"


@dataclass
class SnapshotMeta:
    source: str
    snapshot_id: str
    file: str
    format: str
    fetched_at: str
    rows: int
    sha256: str
    bytes: int
    newest_record: str | None
    status: str
    checks: list[dict[str, Any]] = field(default_factory=list)
    message: str | None = None
    columns: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)
    raw_fetch_id: str | None = None

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> SnapshotMeta:
        known = {name for name in cls.__dataclass_fields__}
        return cls(**{key: value for key, value in data.items() if key in known})


@dataclass
class SourceState:
    """What happened the last time the pipeline tried this source."""

    source: str
    last_attempt: str | None = None
    # ok, fetch_failed, rejected, or error (the download could not be read)
    last_result: str | None = None
    message: str | None = None
    # snapshot id of the last good snapshot
    current: str | None = None
    consecutive_failures: int = 0
    # a finished download that has not been validated yet
    pending_fetch: str | None = None

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    def fail(self, result: str, message: str) -> None:
        self.last_result = result
        self.message = message
        self.consecutive_failures += 1


class SnapshotStore:
    def __init__(self, cache: Cache, source_id: str):
        self.source_id = source_id
        self.dir = cache.snapshot_dir(source_id)

    # State
    def state(self) -> SourceState:
        path = self.dir / STATE_FILE
        if not path.is_file():
            return SourceState(source=self.source_id)
        data = json.loads(path.read_text(encoding="utf-8"))
        known = {name for name in SourceState.__dataclass_fields__}
        return SourceState(**{key: value for key, value in data.items() if key in known})

    def save_state(self, state: SourceState) -> None:
        atomic_write_json(self.dir / STATE_FILE, state.to_json())

    # Snapshots
    def path_for(self, meta: SnapshotMeta) -> Path:
        return self.dir / meta.file

    def snapshot_path(self, snapshot_id: str) -> Path:
        return self.dir / f"{snapshot_id}.parquet"

    def all(self) -> list[SnapshotMeta]:
        if not self.dir.is_dir():
            return []
        metas = []
        for path in sorted(self.dir.glob("*.json")):
            if path.name == STATE_FILE or path.name.startswith("."):
                continue
            try:
                metas.append(SnapshotMeta.from_json(json.loads(path.read_text(encoding="utf-8"))))
            except (ValueError, TypeError) as exc:
                log.warning(
                    "%s: ignoring unreadable sidecar %s (%s)", self.source_id, path.name, exc
                )
        return sorted(metas, key=lambda meta: meta.snapshot_id)

    def get(self, snapshot_id: str) -> SnapshotMeta | None:
        path = self.dir / f"{snapshot_id}.json"
        if not path.is_file():
            return None
        return SnapshotMeta.from_json(json.loads(path.read_text(encoding="utf-8")))

    def _usable(self, meta: SnapshotMeta | None) -> bool:
        return meta is not None and meta.status == "good" and self.path_for(meta).is_file()

    def current(self) -> SnapshotMeta | None:
        """The last good snapshot, or None when there is no usable one."""
        state = self.state()
        if state.current:
            meta = self.get(state.current)
            if self._usable(meta):
                return meta
        goods = [meta for meta in self.all() if self._usable(meta)]
        return goods[-1] if goods else None

    def record(self, meta: SnapshotMeta) -> None:
        atomic_write_json(self.dir / f"{meta.snapshot_id}.json", meta.to_json())

    def promote(self, meta: SnapshotMeta) -> None:
        """Make a good snapshot current: point current.parquet at it."""
        atomic_symlink(meta.file, self.dir / CURRENT_LINK)

    def prune(self, keep_good: int, keep_rejected: int = 1) -> list[str]:
        """Delete all but the newest `keep_good` good and `keep_rejected` rejected snapshots.
        The current snapshot is always kept. Returns the ids removed."""
        keep_good = max(1, keep_good)
        current = self.current()
        metas = self.all()
        goods = [meta for meta in metas if meta.status == "good"]
        rejected = [meta for meta in metas if meta.status != "good"]
        doomed = goods[:-keep_good] + (rejected[:-keep_rejected] if keep_rejected else rejected)
        removed = []
        for meta in doomed:
            if current is not None and meta.snapshot_id == current.snapshot_id:
                continue
            self.path_for(meta).unlink(missing_ok=True)
            (self.dir / f"{meta.snapshot_id}.json").unlink(missing_ok=True)
            removed.append(meta.snapshot_id)
        # Clear temporary files left by crashed runs.
        for leftover in self.dir.glob(".*.tmp"):
            leftover.unlink(missing_ok=True)
        if removed:
            log.info("%s: removed old snapshots %s", self.source_id, ", ".join(removed))
        return removed
