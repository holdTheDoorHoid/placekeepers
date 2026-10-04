"""Tables on the City's Carto SQL API (https://phl.carto.com/api/v2/sql).

Large tables come down as CSV in chunks of 100,000 rows (the size the original Clean & Green Philly
pipeline used), ordered by `cartodb_id`. Each chunk asks for rows after the last id of the previous
one ("keyset" paging), which stays correct even if rows are added while we read, and is lighter on
the City's database than OFFSET. At the end the row total is compared with the table's own count.

Every adapter lists its columns explicitly, so each field we keep is a deliberate choice. Geometry
travels as hex encoded WKB (`encode(ST_AsBinary(the_geom), 'hex')`) and becomes a GeoParquet
geometry column without any geometry library in between.
"""

from __future__ import annotations

import csv
import json
import logging
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar

from placekeepers.adapters.base import Adapter, FetchError, quote_ident, quote_literal
from placekeepers.cache import RawFetch
from placekeepers.candidates import CANDIDATE_SOURCES, candidate_accounts
from placekeepers.geo import GEOMETRY_COLUMN, geo_metadata, wkb_type_name
from placekeepers.httpclient import HttpError
from placekeepers.registry import CartoEndpoint

log = logging.getLogger(__name__)

CARTO_SQL_API = "https://phl.carto.com/api/v2/sql"
KEY_ALIAS = "_key"
# The longest CSV line DuckDB will read. The largest Water Department parcel is about 118 KB of hex
# WKB (3,665 points, measured 2026-10-04), so 4 MB leaves ample room. DuckDB reads with a buffer of
# 16 lines this size, so a much larger limit costs real memory.
MAX_LINE_BYTES = 4 * 1024 * 1024

csv.field_size_limit(min(sys.maxsize, 64 * MAX_LINE_BYTES))


@dataclass(frozen=True)
class Column:
    """One output column: its name, the SQL that produces it on Carto, and its stored type.

    Types: VARCHAR, BIGINT, INTEGER, SMALLINT, DOUBLE, DATE, or WKB (hex WKB stored as binary).
    """

    name: str
    sql: str
    type: str = "VARCHAR"


def _cast(column: Column) -> str:
    ref = quote_ident(column.name)
    kind = column.type
    if kind == "VARCHAR":
        return ref
    if kind in ("BIGINT", "INTEGER", "SMALLINT"):
        return f"TRY_CAST(round(TRY_CAST({ref} AS DOUBLE)) AS {kind})"
    if kind == "DOUBLE":
        return f"TRY_CAST({ref} AS DOUBLE)"
    if kind == "DATE":
        # Carto writes timestamps like 2026-07-15 04:00:00+00 and dates like 2026-07-15.
        return f"CAST(TRY_CAST({ref} AS TIMESTAMPTZ) AS DATE)"
    if kind == "WKB":
        return f"from_hex({ref})"
    raise ValueError(f"unknown column type {kind} for {column.name}")


def scan_csv(path: Path, key: str | None) -> tuple[int, int | None]:
    """Count the data rows of a CSV file and return the last value of its `key` column."""
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header is None:
            return 0, None
        index = header.index(key) if key else None
        rows = 0
        last = None
        for row in reader:
            rows += 1
            if index is not None:
                last = row[index]
    return rows, (int(float(last)) if last else None)


def _check_carto_json(data: Any) -> None:
    if isinstance(data, dict) and data.get("error"):
        raise HttpError(f"Carto refused the query: {data['error']}")


def _check_carto_csv(path: Path) -> None:
    with path.open("rb") as handle:
        start = handle.read(512).lstrip()
    if start.startswith(b"{"):
        raise HttpError(
            f"Carto sent an error instead of CSV: {start[:300].decode(errors='replace')}"
        )


class CartoAdapter(Adapter):
    kind = "carto"
    api_url: ClassVar[str] = CARTO_SQL_API
    columns: ClassVar[tuple[Column, ...]] = ()
    key: ClassVar[str] = "cartodb_id"
    chunk_rows: ClassVar[int] = 100_000

    @property
    def endpoint(self) -> CartoEndpoint:
        assert isinstance(self.source.endpoint, CartoEndpoint)
        return self.source.endpoint

    # Queries
    def _filters(self, after: int | None = None) -> str:
        parts = []
        if self.endpoint.where:
            parts.append(f"({self.endpoint.where})")
        if after is not None:
            parts.append(f"{self.key} > {int(after)}")
        return f" WHERE {' AND '.join(parts)}" if parts else ""

    def count_query(self) -> str:
        return f"SELECT count(*) AS n FROM {self.endpoint.table}{self._filters()}"

    def page_query(self, after: int | None) -> str:
        select = ", ".join(f"{column.sql} AS {column.name}" for column in self.columns)
        return (
            f"SELECT {select}, {self.key} AS {KEY_ALIAS} FROM {self.endpoint.table}"
            f"{self._filters(after)} ORDER BY {self.key} LIMIT {self.chunk_rows}"
        )

    def count(self) -> int:
        data = self.ctx.http.get_json(
            self.api_url, {"q": self.count_query()}, check=_check_carto_json
        )
        return int(data["rows"][0]["n"])

    # Fetch
    def fetch(self, dest: Path) -> dict[str, Any]:
        expected = self.count()
        log.info(
            "%s: %s rows to download from Carto table %s",
            self.id,
            f"{expected:,}",
            self.endpoint.table,
        )
        after: int | None = None
        total = 0
        chunk = 0
        while True:
            chunk += 1
            path = dest / f"chunk-{chunk:05d}.csv"
            result = self.ctx.http.download(
                self.api_url,
                path,
                {"q": self.page_query(after), "format": "csv"},
                check_file=_check_carto_csv,
            )
            rows, last_key = scan_csv(path, KEY_ALIAS)
            if rows == 0:
                path.unlink()
                chunk -= 1
                break
            total += rows
            log.info(
                "%s: chunk %d, %s rows (%s of %s so far), %.1f MB",
                self.id,
                chunk,
                f"{rows:,}",
                f"{total:,}",
                f"{expected:,}",
                result.bytes / 1e6,
            )
            if rows < self.chunk_rows or last_key is None:
                break
            after = last_key
        if total != expected:
            recount = self.count()
            if total != recount:
                raise FetchError(
                    f"Downloaded {total:,} rows but the table reports {recount:,}; trying again "
                    "next run"
                )
            expected = recount
        return {
            "rows": total,
            "chunks": chunk,
            "table": self.endpoint.table,
            "expected_rows": expected,
        }

    # Normalize
    #: drop rows repeated across the downloaded files (set when two downloads can overlap)
    dedupe: ClassVar[bool] = False

    def csv_names(self) -> list[str]:
        """The columns of each downloaded CSV chunk, in order."""
        return [column.name for column in self.columns] + [KEY_ALIAS]

    def csv_groups(self, raw: RawFetch) -> list[tuple[list[Path], list[str]]]:
        """The downloaded files, in groups that share their columns."""
        assert raw.dir is not None
        files = sorted(raw.dir.glob("chunk-*.csv"))
        return [(files, self.csv_names())] if files else []

    def csv_source(self, raw: RawFetch) -> str:
        """SQL reading every downloaded file as text columns (one select per group)."""
        groups = [(files, names) for files, names in self.csv_groups(raw) if files]
        if not groups:
            raise FetchError("The download has no data files")
        wanted = ", ".join(quote_ident(column.name) for column in self.columns)
        selects = []
        for files, names in groups:
            types = ", ".join(f"{quote_literal(name)}: 'VARCHAR'" for name in names)
            file_list = "[" + ", ".join(quote_literal(str(path)) for path in files) + "]"
            selects.append(
                f"SELECT {wanted} FROM read_csv({file_list}, header = true, columns = {{{types}}}, "
                f"max_line_size = {MAX_LINE_BYTES}, quote = '\"', escape = '\"')"
            )
        if len(selects) == 1 and not self.dedupe:
            return f"({selects[0]})"
        joiner = " UNION " if self.dedupe else " UNION ALL "
        return "(" + joiner.join(selects) + ")"

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        source = self.csv_source(raw)
        con = self.ctx.duckdb()
        try:
            self._note_cast_losses(con, source)
            kv = ""
            geometry = [c for c in self.columns if c.type == "WKB"]
            if geometry:
                if len(geometry) != 1 or geometry[0].name != GEOMETRY_COLUMN:
                    raise ValueError("a Carto adapter may have one WKB column, named geometry")
                kinds = self._geometry_types(con, source)
                kv = f", KV_METADATA {{geo: {quote_literal(json.dumps(geo_metadata(kinds)))}}}"
            select = ", ".join(
                f"{_cast(column)} AS {quote_ident(column.name)}" for column in self.columns
            )
            # The chunks were downloaded in key order and DuckDB keeps file and row order, so the
            # snapshot is in key order without a costly sort.
            con.execute(
                f"COPY (SELECT {select} FROM {source}) TO {quote_literal(str(out))} "
                f"(FORMAT parquet, COMPRESSION zstd, ROW_GROUP_SIZE 100000{kv})"
            )
        finally:
            con.close()

    def _note_cast_losses(self, con: Any, source: str) -> None:
        """Record values that did not fit their column type (they are stored as empty)."""
        typed = [c for c in self.columns if c.type not in ("VARCHAR", "WKB")]
        if not typed:
            return
        counts = ", ".join(
            f"count(*) FILTER (WHERE {quote_ident(c.name)} IS NOT NULL AND {_cast(c)} IS NULL)"
            for c in typed
        )
        lost = con.execute(f"SELECT {counts} FROM {source}").fetchone()
        for column, number in zip(typed, lost, strict=True):
            if number:
                note = f"{number:,} values in {column.name} were not a valid {column.type}"
                log.warning("%s: %s", self.id, note)
                self.notes.append(note)

    def _geometry_types(self, con: Any, source: str) -> list[str]:
        headers = con.execute(
            f"SELECT DISTINCT left(lower({quote_ident(GEOMETRY_COLUMN)}), 10) FROM {source} "
            f"WHERE {quote_ident(GEOMETRY_COLUMN)} IS NOT NULL"
        ).fetchall()
        names = set()
        for (header,) in headers:
            try:
                name = wkb_type_name(bytes.fromhex(header))
            except ValueError:
                name = None
            if name:
                names.add(name)
        return sorted(names)


class CartoAccountsAdapter(CartoAdapter):
    """A Carto table fetched only for the vacancy candidate parcels (see placekeepers.candidates),
    in chunks of OPA account numbers.

    Each chunk's accounts travel in the body of a POST as a VALUES list joined to the table, which
    Carto answers from its index in under a second for thousands of accounts. (An IN list of the
    same accounts took over a minute on the assessments table.) Every chunk is checked against a
    count of the same join.
    """

    account_column: ClassVar[str] = "opa_account_num"
    accounts_per_chunk: ClassVar[int] = 5000
    depends_on = CANDIDATE_SOURCES

    def accounts(self) -> list[str]:
        found = candidate_accounts(self.ctx)
        self.candidate_info = {"by_source": found.by_source, "missing": found.missing}
        return found.accounts

    def _join(self, accounts: list[str]) -> str:
        for account in accounts:
            if not (len(account) == 9 and account.isdigit()):
                raise FetchError(f"{account!r} is not a 9 digit OPA account")
        values = ", ".join(f"('{account}')" for account in accounts)
        table = self.endpoint.table
        where = f" WHERE ({self.endpoint.where})" if self.endpoint.where else ""
        return (
            f"FROM {table} JOIN (VALUES {values}) AS chosen(chosen_account) "
            f"ON {table}.{self.account_column} = chosen.chosen_account{where}"
        )

    def chunk_query(self, accounts: list[str]) -> str:
        select = ", ".join(f"{column.sql} AS {column.name}" for column in self.columns)
        return f"SELECT {select} {self._join(accounts)}"

    def chunk_count_query(self, accounts: list[str]) -> str:
        return f"SELECT count(*) AS n {self._join(accounts)}"

    def csv_names(self) -> list[str]:
        return [column.name for column in self.columns]

    def fetch(self, dest: Path) -> dict[str, Any]:
        chosen = self.accounts()
        if not chosen:
            raise FetchError(
                "There are no candidate parcels yet; fetch the vacancy indicators and OPA first"
            )
        size = self.accounts_per_chunk
        chunks = [chosen[start : start + size] for start in range(0, len(chosen), size)]
        log.info(
            "%s: %s rows from Carto table %s for %s candidate parcels, in %d chunks",
            self.id,
            "fetching",
            self.endpoint.table,
            f"{len(chosen):,}",
            len(chunks),
        )
        total = 0
        for number, accounts in enumerate(chunks, 1):
            path = dest / f"chunk-{number:05d}.csv"
            result = self.ctx.http.download(
                self.api_url,
                path,
                data={"q": self.chunk_query(accounts), "format": "csv"},
                check_file=_check_carto_csv,
            )
            rows, _ = scan_csv(path, None)
            reply = self.ctx.http.get_json(
                self.api_url, data={"q": self.chunk_count_query(accounts)}, check=_check_carto_json
            )
            expected = int(reply["rows"][0]["n"])
            if rows != expected:
                raise FetchError(
                    f"Chunk {number} has {rows:,} rows but the table reports {expected:,}; "
                    "trying again next run"
                )
            total += rows
            log.info(
                "%s: chunk %d of %d, %s rows (%s so far), %.1f MB",
                self.id,
                number,
                len(chunks),
                f"{rows:,}",
                f"{total:,}",
                result.bytes / 1e6,
            )
        return {
            "rows": total,
            "chunks": len(chunks),
            "table": self.endpoint.table,
            "accounts": len(chosen),
            "candidates": getattr(self, "candidate_info", {}),
        }
