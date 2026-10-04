"""A single file at a fixed https link (registry endpoint kind `url`).

GeoJSON is streamed into GeoParquet a batch at a time (bulk files run to hundreds of megabytes),
CSV becomes Parquet through DuckDB, and Parquet is kept as it is. A source specific adapter may
choose the fields to keep or read the file its own way. A zip archive needs a source specific
adapter that knows what is inside.

The server's Last-Modified date is kept with the download. Adapters with `add_source_date` store it
in a `source_date` column, so a bulk file with no dates of its own can still show how old it is.
"""

from __future__ import annotations

import shutil
from datetime import date
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, ClassVar

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.base import Adapter, FetchError, quote_literal
from placekeepers.cache import RawFetch
from placekeepers.geo import geojson_to_geoparquet
from placekeepers.registry import UrlEndpoint


def http_date(value: str | None) -> str | None:
    """The calendar day of an HTTP date such as 'Mon, 05 Jan 2026 17:38:03 GMT'."""
    if not value:
        return None
    try:
        return parsedate_to_datetime(value).date().isoformat()
    except (TypeError, ValueError):
        return None


class UrlAdapter(Adapter):
    kind = "url"
    #: GeoJSON fields to keep, as named in the file (None keeps every field)
    keep_fields: ClassVar[list[str] | None] = None
    #: store the server's Last-Modified day in a `source_date` column
    add_source_date: ClassVar[bool] = False

    @property
    def endpoint(self) -> UrlEndpoint:
        assert isinstance(self.source.endpoint, UrlEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        name = f"data.{self.endpoint.format}"
        result = self.ctx.http.download(self.endpoint.url, dest / name)
        return {
            "file": name,
            "format": self.endpoint.format,
            "bytes": result.bytes,
            "sha256": result.sha256,
            "source_date": http_date(result.last_modified),
            "rows": None,
        }

    def data_file(self, raw: RawFetch) -> Path:
        assert raw.dir is not None
        return raw.dir / raw.info["file"]

    def source_date(self, raw: RawFetch) -> date:
        text = raw.info.get("source_date")
        if not text:
            raise FetchError("The server did not say when the file was last changed")
        return date.fromisoformat(text)

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        kind = raw.info["format"]
        if kind == "geojson":
            constants = {}
            if self.add_source_date:
                constants["source_date"] = pa.scalar(self.source_date(raw), pa.date32())
            geojson_to_geoparquet(path, out, keep=self.keep_fields, constants=constants)
            if self.keep_fields:
                written = set(pq.read_schema(out).names)
                gone = [name for name in self.keep_fields if name.lower() not in written]
                if gone:
                    self.notes.append(f"The file no longer has the fields {', '.join(gone)}")
        elif kind == "csv":
            con = self.ctx.duckdb()
            try:
                con.execute(
                    f"COPY (SELECT * FROM read_csv({quote_literal(str(path))}, header = true)) "
                    f"TO {quote_literal(str(out))} (FORMAT parquet, COMPRESSION zstd)"
                )
            finally:
                con.close()
        elif kind == "parquet":
            shutil.copyfile(path, out)
        else:
            raise FetchError(f"{kind} downloads need a source specific adapter")
