"""Shared helpers for the vacancy method study (milestone M0.5).

Everything here is research code, not pipeline code. Raw downloads go to
~/.cache/placekeepers/research/ and derived files to research/vacancy/out/ (git ignored).
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import duckdb
import httpx

USER_AGENT = "Placekeepers/0.1 (+https://github.com/holdTheDoorHoid/placekeepers)"
CACHE = Path(os.environ.get("PK_CACHE", Path.home() / ".cache" / "placekeepers"))
RAW = CACHE / "research"
HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
RESULTS = HERE / "results"

CARTO = "https://phl.carto.com/api/v2/sql"
ARCGIS = "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services"

# The study date. Windows such as "the last two years" are measured from here.
TODAY = "2026-10-04"
TWO_YEARS_AGO = "2024-10-04"
# The June 2024 lists the original project kept were dated 2024-06-24.
LIST_2024_DATE = "2024-06-24"

PAUSE_SECONDS = 1.0

for _p in (RAW, OUT, RESULTS):
    _p.mkdir(parents=True, exist_ok=True)

_client: httpx.Client | None = None
_last_request = 0.0


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(
            headers={"User-Agent": USER_AGENT},
            timeout=httpx.Timeout(300.0, connect=30.0),
            follow_redirects=True,
        )
    return _client


def _wait() -> None:
    """Keep requests sequential with a small pause between them."""
    global _last_request
    gap = time.monotonic() - _last_request
    if gap < PAUSE_SECONDS:
        time.sleep(PAUSE_SECONDS - gap)
    _last_request = time.monotonic()


def get(url: str, params: dict | None = None, retries: int = 4) -> httpx.Response:
    for attempt in range(retries):
        _wait()
        try:
            r = client().get(url, params=params)
            if r.status_code == 200:
                return r
            if r.status_code in (403, 401):
                raise RuntimeError(f"HTTP {r.status_code} from {url}; not retrying (never get around a block)")
            print(f"  HTTP {r.status_code} on attempt {attempt + 1}: {r.text[:200]}")
        except httpx.HTTPError as e:
            print(f"  {type(e).__name__} on attempt {attempt + 1}: {e}")
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"giving up on {url}")


def stream_to_file(url: str, dest: Path, params: dict | None = None) -> Path:
    _wait()
    tmp = dest.with_suffix(dest.suffix + ".part")
    with client().stream("GET", url, params=params) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.rename(dest)
    return dest


def carto(sql: str, fmt: str = "json") -> httpx.Response:
    return get(CARTO, params={"q": sql, "format": fmt})


def connect(memory: str = "2GB", threads: int = 4) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute(f"SET memory_limit='{memory}'; SET threads={threads};")
    con.execute(f"SET temp_directory='{RAW / 'duckdb_tmp'}';")
    return con


def raw(name: str) -> str:
    """Path to a raw parquet file in the research cache, as a string for SQL."""
    return str(RAW / f"{name}.parquet")


def opa9(expr: str) -> str:
    """SQL expression that normalizes an OPA account to a 9 digit string."""
    return f"lpad(regexp_replace(trim(CAST({expr} AS VARCHAR)), '[^0-9]', '', 'g'), 9, '0')"
