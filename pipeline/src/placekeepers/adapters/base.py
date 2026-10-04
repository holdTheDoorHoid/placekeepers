"""The adapter base class.

An adapter knows how to get one source. It has three steps:

* `fetch(dest)` downloads into a folder (network only; nothing is interpreted yet);
* `normalize(raw, out)` turns that download into one Parquet or GeoParquet file;
* `validate(path, last_good)` measures the file and applies the source's health rules.

The generic adapters for each registry endpoint kind (`carto`, `arcgis`, `url`) live beside this
module. A source specific adapter subclasses one of them and says which columns it needs.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any, ClassVar

import duckdb

from placekeepers.cache import RawFetch
from placekeepers.context import Context
from placekeepers.health import Check, evaluate
from placekeepers.registry import Source
from placekeepers.snapshots import SnapshotMeta
from placekeepers.sql import quote_ident, quote_literal

log = logging.getLogger(__name__)

__all__ = [
    "Adapter",
    "AdapterMismatch",
    "FetchError",
    "Validation",
    "measure",
    "quote_ident",
    "quote_literal",
]


class FetchError(RuntimeError):
    """A download finished but does not add up (for example, rows are missing)."""


class AdapterMismatch(RuntimeError):
    """The registry endpoint kind does not match the adapter written for the source."""


@dataclass
class Validation:
    rows: int
    columns: list[str]
    newest: date | None
    checks: list[Check]

    @property
    def ok(self) -> bool:
        return all(check.ok for check in self.checks)


def measure(
    con: duckdb.DuckDBPyConnection, path: Path, newest_field: str | None, today: date
) -> tuple[int, list[str], date | None]:
    """Row count, column names, and the newest date in `newest_field` (ignoring future dates,
    which are data entry errors and would hide a source that stopped updating)."""
    source = f"read_parquet({quote_literal(str(path))})"
    rows = con.execute(f"SELECT count(*) FROM {source}").fetchone()[0]
    columns = [row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {source}").fetchall()]
    newest = None
    if newest_field and newest_field in columns:
        limit = (today + timedelta(days=1)).isoformat()
        newest = con.execute(
            f"SELECT max(d) FROM (SELECT TRY_CAST({quote_ident(newest_field)} AS DATE) AS d "
            f"FROM {source}) WHERE d <= DATE {quote_literal(limit)}"
        ).fetchone()[0]
    return int(rows), columns, newest


class Adapter(ABC):
    #: the registry endpoint kind this adapter reads
    kind: ClassVar[str]
    #: columns the snapshot must have before the map may use it
    required_columns: ClassVar[tuple[str, ...]] = ()
    #: sources whose current snapshots this one's download needs (they are refreshed first)
    depends_on: ClassVar[tuple[str, ...]] = ()

    def __init__(self, source: Source, ctx: Context):
        if source.endpoint.kind != self.kind:
            raise AdapterMismatch(
                f"{source.id}: the registry says endpoint kind '{source.endpoint.kind}' but its "
                f"adapter {type(self).__name__} reads '{self.kind}'"
            )
        self.source = source
        self.ctx = ctx
        #: data quality remarks gathered while normalizing, stored in the snapshot sidecar
        self.notes: list[str] = []

    @property
    def id(self) -> str:
        return self.source.id

    @abstractmethod
    def fetch(self, dest: Path) -> dict[str, Any]:
        """Download into `dest` and return facts about the download for fetch.json."""

    @abstractmethod
    def normalize(self, raw: RawFetch, out: Path) -> None:
        """Write the download in `raw` as one Parquet or GeoParquet file at `out`."""

    def validate(self, path: Path, last_good: SnapshotMeta | None) -> Validation:
        con = self.ctx.duckdb()
        try:
            rows, columns, newest = measure(
                con, path, self.source.health.newest_field, self.ctx.today()
            )
        finally:
            con.close()
        checks = evaluate(
            self.source.health,
            rows=rows,
            columns=columns,
            newest=newest,
            required=self.required_columns,
            last_good=last_good,
            today=self.ctx.today(),
        )
        checks += self.extra_checks(path, newest)
        return Validation(rows=rows, columns=columns, newest=newest, checks=checks)

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        """Rules a source needs beyond its registry health rules. None by default."""
        return []
