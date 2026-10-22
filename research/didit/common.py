"""Shared helpers for the "Did it work?" study (milestone M5.4, issue #48).

Research code, not pipeline code. It reads the pipeline's snapshots in the shared cache
(~/.cache/placekeepers/snapshots), plus two outcome histories the weekly pipeline does not keep
(fetch.py puts them in ~/.cache/placekeepers/research/didit/). Derived files go to
research/didit/out/ (git ignored); small result tables to research/didit/results/.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import duckdb
import httpx

USER_AGENT = "Placekeepers/0.5 (+https://github.com/holdTheDoorHoid/placekeepers)"
CACHE = Path(os.environ.get("PK_CACHE", Path.home() / ".cache" / "placekeepers"))
SNAPSHOTS = CACHE / "snapshots"
DERIVED = CACHE / "derived"
RAW = CACHE / "research" / "didit"
HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
RESULTS = HERE / "results"

CARTO = "https://phl.carto.com/api/v2/sql"
PAUSE_SECONDS = 1.0

for _p in (RAW, OUT, RESULTS):
    _p.mkdir(parents=True, exist_ok=True)


def snapshot(source: str) -> str:
    """The current snapshot of a pipeline source, as a path string for SQL."""
    path = SNAPSHOTS / source / "current.parquet"
    if not path.exists():
        raise FileNotFoundError(f"no snapshot of {source} in {SNAPSHOTS}")
    return str(path.resolve())


def connect(memory: str = "3GB", threads: int = 4) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute(f"SET memory_limit='{memory}'; SET threads={threads};")
    tmp = RAW / "duckdb_tmp"
    tmp.mkdir(parents=True, exist_ok=True)
    con.execute(f"SET temp_directory='{tmp}';")
    return con


_client: httpx.Client | None = None
_last = 0.0


def get(url: str, params: dict | None = None, retries: int = 4) -> httpx.Response:
    """A polite GET: one request at a time, a pause between, never around a 401 or 403."""
    global _client, _last
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(300.0, connect=30.0),
            follow_redirects=True,
        )
    for attempt in range(retries):
        gap = time.monotonic() - _last
        if gap < PAUSE_SECONDS:
            time.sleep(PAUSE_SECONDS - gap)
        _last = time.monotonic()
        try:
            r = _client.get(url, params=params)
            if r.status_code == 200:
                return r
            if r.status_code in (401, 403):
                raise RuntimeError(f"HTTP {r.status_code} from {url}; not retrying")
            print(f"  HTTP {r.status_code} on attempt {attempt + 1}: {r.text[:200]}")
        except httpx.HTTPError as e:
            print(f"  {type(e).__name__} on attempt {attempt + 1}: {e}")
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"giving up on {url}")
