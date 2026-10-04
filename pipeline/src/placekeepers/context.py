"""The run context handed to adapters and publish steps."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime

import duckdb

from placekeepers.cache import Cache
from placekeepers.config import Settings, local_date
from placekeepers.httpclient import PoliteClient
from placekeepers.registry import Registry


class OfflineError(RuntimeError):
    """A step tried to use the network during an offline run."""


class Context:
    def __init__(
        self,
        settings: Settings,
        registry: Registry,
        *,
        http_factory: Callable[[], PoliteClient] | None = None,
    ):
        self.settings = settings
        self.registry = registry
        self.cache = Cache(settings.cache_root)
        self._http_factory = http_factory or PoliteClient
        self._http: PoliteClient | None = None

    @property
    def http(self) -> PoliteClient:
        if self.settings.offline:
            raise OfflineError("This is an offline run, so nothing is downloaded")
        if self._http is None:
            self._http = self._http_factory()
        return self._http

    def duckdb(self) -> duckdb.DuckDBPyConnection:
        """A fresh in memory DuckDB with modest limits; it spills to the cache, not the repo."""
        spill = self.cache.tmp_dir() / "duckdb"
        spill.mkdir(parents=True, exist_ok=True)
        con = duckdb.connect(
            config={
                "memory_limit": self.settings.duckdb_memory_limit,
                "threads": self.settings.duckdb_threads,
                "temp_directory": str(spill),
            }
        )
        # Dates in the City's data are calendar days; read every timestamp in UTC so a midnight
        # record never slides to the previous day.
        con.execute("SET TimeZone = 'UTC'")
        return con

    def now(self) -> datetime:
        return self.settings.now()

    def today(self) -> date:
        return local_date(self.now())

    def close(self) -> None:
        if self._http is not None:
            self._http.close()
            self._http = None
