"""Geometry helpers: GeoParquet metadata, WKB headers, and a streaming GeoJSON writer.

Snapshots store geometry as WKB in a column named `geometry`, in longitude and latitude (OGC:CRS84,
the GeoParquet default), with GeoParquet 1.1 metadata so GeoPandas, DuckDB and GDAL read them
directly.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, TextIO

import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely.geometry import mapping

GEOMETRY_COLUMN = "geometry"

_WKB_NAMES = {
    1: "Point",
    2: "LineString",
    3: "Polygon",
    4: "MultiPoint",
    5: "MultiLineString",
    6: "MultiPolygon",
    7: "GeometryCollection",
}


def geo_metadata(geometry_types: list[str], column: str = GEOMETRY_COLUMN) -> dict[str, Any]:
    return {
        "version": "1.1.0",
        "primary_column": column,
        "columns": {column: {"encoding": "WKB", "geometry_types": sorted(set(geometry_types))}},
    }


def wkb_type_name(header: bytes) -> str | None:
    """Name the geometry type in the first five bytes of a WKB value."""
    if len(header) < 5:
        return None
    order = "little" if header[0] == 1 else "big"
    code = int.from_bytes(header[1:5], order) & 0x0FFFFFFF  # drop EWKB flags
    return _WKB_NAMES.get(code % 1000)


def is_geoparquet(path: Path) -> bool:
    metadata = pq.read_schema(path).metadata or {}
    return b"geo" in metadata


def write_geoparquet(table: pa.Table, path: Path, geometry_types: list[str]) -> None:
    metadata = dict(table.schema.metadata or {})
    metadata[b"geo"] = json.dumps(geo_metadata(geometry_types)).encode()
    pq.write_table(table.replace_schema_metadata(metadata), path, compression="zstd")


def _round(value: Any, digits: int) -> Any:
    if isinstance(value, float):
        return round(value, digits)
    if isinstance(value, list | tuple):
        return [_round(item, digits) for item in value]
    return value


def geometry_json(geometry: Any, digits: int = 7) -> dict[str, Any] | None:
    """A GeoJSON geometry dict from a shapely geometry or WKB bytes, with rounded coordinates.
    Seven decimals is about one centimeter."""
    if geometry is None:
        return None
    if isinstance(geometry, bytes | bytearray | memoryview):
        geometry = shapely.from_wkb(bytes(geometry))
    if geometry.is_empty:
        return None
    data = mapping(geometry)
    return {"type": data["type"], "coordinates": _round(data["coordinates"], digits)}


class GeoJSONWriter:
    """Write a FeatureCollection one feature per line, without holding it all in memory."""

    def __init__(self, path: Path):
        self.path = path
        self.count = 0
        self._handle: TextIO | None = None

    def __enter__(self) -> GeoJSONWriter:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._handle = self.path.open("w", encoding="utf-8")
        self._handle.write('{"type":"FeatureCollection","features":[\n')
        return self

    def write(self, properties: dict[str, Any], geometry: dict[str, Any] | None) -> None:
        assert self._handle is not None
        if geometry is None:
            return
        feature = {"type": "Feature", "properties": properties, "geometry": geometry}
        if self.count:
            self._handle.write(",\n")
        self._handle.write(json.dumps(feature, separators=(",", ":"), ensure_ascii=False))
        self.count += 1

    def __exit__(self, *exc: object) -> None:
        assert self._handle is not None
        self._handle.write("\n]}\n")
        self._handle.close()
