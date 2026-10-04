"""The shared download cache, and safe ways to write into it.

Layout under $PK_CACHE (default ~/.cache/placekeepers):

    raw/<source_id>/<fetch_id>/            one complete download: pages or chunks, plus fetch.json
    snapshots/<source_id>/<id>.parquet     validated (or rejected) snapshots
    snapshots/<source_id>/<id>.json        the metadata sidecar of each snapshot
    snapshots/<source_id>/current.parquet  a link to the last good snapshot
    snapshots/<source_id>/state.json       the result of the latest attempt
    tmp/                                   scratch space for DuckDB
    research/                              reserved for the vacancy study; never written here

Other agents and worktrees read this cache while the pipeline writes it, so every file and folder
appears atomically: it is written under a hidden temporary name in the same folder, then renamed.
"""

from __future__ import annotations

import contextlib
import fcntl
import hashlib
import json
import logging
import os
import shutil
import uuid
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

FETCH_RECORD = "fetch.json"


class CacheError(RuntimeError):
    pass


def new_fetch_id(moment: datetime) -> str:
    """A sortable id for one download, such as 20261004T153012Z."""
    return moment.strftime("%Y%m%dT%H%M%SZ")


def _temp_sibling(path: Path) -> Path:
    return path.with_name(f".{path.name}.{uuid.uuid4().hex[:8]}.tmp")


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = _temp_sibling(path)
    try:
        with tmp.open("wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def atomic_write_json(path: Path, value: Any) -> None:
    text = json.dumps(value, indent=2, sort_keys=False, ensure_ascii=False) + "\n"
    atomic_write_bytes(path, text.encode("utf-8"))


def atomic_symlink(target: str, link: Path) -> None:
    """Point `link` at `target` (a name relative to the link's folder) without a gap."""
    tmp = _temp_sibling(link)
    os.symlink(target, tmp)
    try:
        os.replace(tmp, link)
    finally:
        if tmp.is_symlink():
            tmp.unlink()


@contextlib.contextmanager
def atomic_output(path: Path) -> Iterator[Path]:
    """Yield a temporary path beside `path`; rename it into place if the block succeeds."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = _temp_sibling(path)
    try:
        yield tmp
        if not tmp.exists():
            raise CacheError(f"nothing was written for {path.name}")
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


class Cache:
    def __init__(self, root: Path):
        self.root = root.expanduser()

    @property
    def research_dir(self) -> Path:
        return self.root / "research"

    def _guard(self, path: Path) -> Path:
        research = self.research_dir.resolve()
        resolved = path.resolve()
        if resolved == research or research in resolved.parents:
            raise CacheError(f"{path} is inside the reserved research folder")
        return path

    def raw_dir(self, source_id: str) -> Path:
        return self._guard(self.root / "raw" / source_id)

    def snapshot_dir(self, source_id: str) -> Path:
        return self._guard(self.root / "snapshots" / source_id)

    def tmp_dir(self) -> Path:
        path = self._guard(self.root / "tmp")
        path.mkdir(parents=True, exist_ok=True)
        return path

    @contextlib.contextmanager
    def lock(self, source_id: str) -> Iterator[None]:
        """Hold the per source lock so two runs never update one source at the same time."""
        folder = self.snapshot_dir(source_id)
        folder.mkdir(parents=True, exist_ok=True)
        with (folder / ".lock").open("w") as handle:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                log.info("%s: waiting for another pk run to finish with this source", source_id)
                fcntl.flock(handle, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(handle, fcntl.LOCK_UN)


@dataclass
class RawFetch:
    """One complete download of a source, waiting to be normalized."""

    source: str
    fetch_id: str
    fetched_at: str
    files: list[str]
    info: dict[str, Any] = field(default_factory=dict)
    dir: Path | None = None

    def to_json(self) -> dict[str, Any]:
        data = asdict(self)
        data.pop("dir")
        return data


class RawStore:
    """Downloads for one source. A download is visible only once its folder is complete."""

    def __init__(self, cache: Cache, source_id: str):
        self.source_id = source_id
        self.dir = cache.raw_dir(source_id)

    def begin(self, fetch_id: str) -> Path:
        """Make a hidden folder for a download in progress, clearing leftovers of crashed runs.
        The caller holds the source lock, so no other run is writing here."""
        self.dir.mkdir(parents=True, exist_ok=True)
        for leftover in self.dir.glob(".*.partial"):
            shutil.rmtree(leftover, ignore_errors=True)
        partial = self.dir / f".{fetch_id}.partial"
        partial.mkdir()
        return partial

    def commit(self, partial: Path, raw: RawFetch) -> RawFetch:
        record = partial / FETCH_RECORD
        record.write_text(json.dumps(raw.to_json(), indent=2) + "\n", encoding="utf-8")
        final = self.dir / raw.fetch_id
        if final.exists():
            shutil.rmtree(final)
        os.replace(partial, final)
        raw.dir = final
        return raw

    def abort(self, partial: Path) -> None:
        shutil.rmtree(partial, ignore_errors=True)

    def get(self, fetch_id: str) -> RawFetch | None:
        folder = self.dir / fetch_id
        record = folder / FETCH_RECORD
        if not record.is_file():
            return None
        data = json.loads(record.read_text(encoding="utf-8"))
        return RawFetch(dir=folder, **data)

    def latest(self) -> RawFetch | None:
        if not self.dir.is_dir():
            return None
        ids = sorted(
            p.name for p in self.dir.iterdir() if p.is_dir() and not p.name.startswith(".")
        )
        for fetch_id in reversed(ids):
            raw = self.get(fetch_id)
            if raw is not None:
                return raw
        return None

    def remove(self, fetch_id: str) -> None:
        shutil.rmtree(self.dir / fetch_id, ignore_errors=True)

    def prune(self, keep: str | None) -> None:
        """Delete every finished download except `keep`."""
        if not self.dir.is_dir():
            return
        for path in self.dir.iterdir():
            if path.is_dir() and not path.name.startswith(".") and path.name != keep:
                shutil.rmtree(path, ignore_errors=True)
