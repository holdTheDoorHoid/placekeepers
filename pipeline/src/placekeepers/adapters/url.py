"""A single file at a fixed https link (registry endpoint kind `url`).

CSV becomes Parquet through DuckDB, GeoJSON becomes GeoParquet through GeoPandas, and Parquet is
kept as it is. A zip archive needs a source specific adapter that knows what is inside.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Any

from placekeepers.adapters.base import Adapter, FetchError, quote_literal
from placekeepers.cache import RawFetch
from placekeepers.registry import UrlEndpoint


class UrlAdapter(Adapter):
    kind = "url"

    @property
    def endpoint(self) -> UrlEndpoint:
        assert isinstance(self.source.endpoint, UrlEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        name = f"data.{self.endpoint.format}"
        result = self.ctx.http.download(self.endpoint.url, dest / name)
        return {"file": name, "format": self.endpoint.format, "bytes": result.bytes,
                "sha256": result.sha256}

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        path = raw.dir / raw.info["file"]
        kind = raw.info["format"]
        if kind == "csv":
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
        elif kind == "geojson":
            import geopandas

            frame = geopandas.read_file(path)
            frame = frame.rename_geometry("geometry") if frame.geometry.name != "geometry" else frame
            frame.to_crs(4326).to_parquet(out, compression="zstd")
        else:
            raise FetchError(f"{kind} downloads need a source specific adapter")
