"""Hand curated files (registry endpoint kind `curated`).

`fetch` copies the file from the repository (no network), and `normalize` checks every entry and
writes a snapshot, so the Data status page shows the file like any other source.

The memorial names snapshot deliberately leaves the names out: snapshots are kept in the shared
cache and attached to releases, and a name that a family asks us to remove must not live on there.
The map layer is always built from the repository's current files at publish time
(placekeepers.publish.streets), so a removal takes effect at the next publish even offline.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.base import Adapter, FetchError
from placekeepers.cache import RawFetch
from placekeepers.curated import CuratedError, read_memorials_file
from placekeepers.registry import CuratedEndpoint


class CuratedAdapter(Adapter):
    kind = "curated"

    @property
    def endpoint(self) -> CuratedEndpoint:
        assert isinstance(self.source.endpoint, CuratedEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        source = self.ctx.settings.repo_root / self.endpoint.path
        if not source.is_file():
            raise FetchError(f"{self.endpoint.path} is missing from the repository")
        name = Path(self.endpoint.path).name
        shutil.copyfile(source, dest / name)
        return {"file": name, "bytes": source.stat().st_size}


class MemorialNames(CuratedAdapter):
    """data/curated/memorials.yaml, checked entry by entry; the snapshot holds no names."""

    required_columns = ("id", "date", "mode", "source")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        try:
            curated = read_memorials_file(raw.dir / raw.info["file"])
        except CuratedError as exc:
            raise FetchError(str(exc)) from exc
        self.notes.extend(curated.problems)
        entries = curated.entries
        table = pa.table(
            {
                "id": pa.array([e.id for e in entries], pa.string()),
                "date": pa.array([e.date for e in entries], pa.date32()),
                "mode": pa.array([e.mode for e in entries], pa.string()),
                "crash": pa.array([e.crash for e in entries], pa.string()),
                "lat": pa.array([e.lat for e in entries], pa.float64()),
                "lng": pa.array([e.lng for e in entries], pa.float64()),
                "source": pa.array([e.source for e in entries], pa.string()),
            }
        )
        pq.write_table(table, out, compression="zstd")
