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


def wkb_types(array: pa.Array | pa.ChunkedArray) -> set[str]:
    """The geometry type names present in a column of WKB values, read from their headers."""
    import pyarrow.compute as pc

    headers = pc.unique(pc.binary_slice(array.cast(pa.binary()), 0, 5)).to_pylist()
    return {name for header in headers if header for name in [wkb_type_name(header)] if name}


def geojson_to_geoparquet(
    src: Path,
    out: Path,
    *,
    keep: list[str] | None = None,
    constants: dict[str, pa.Scalar] | None = None,
    batch_size: int = 50_000,
) -> int:
    """Stream a GeoJSON file into GeoParquet, a batch at a time, so a file of hundreds of
    megabytes never sits in memory whole. Field names become lower case; `keep` limits the fields
    (names as in the file); `constants` adds columns with one value for every row. Returns the
    number of rows written."""
    from pyogrio.raw import open_arrow

    rows = 0
    kinds: set[str] = set()
    writer: pq.ParquetWriter | None = None
    try:
        with open_arrow(src, columns=keep, batch_size=batch_size, use_pyarrow=True) as (
            meta,
            reader,
        ):
            geometry_name = meta.get("geometry_name") or "wkb_geometry"
            for batch in reader:
                table = pa.Table.from_batches([batch])
                columns = []
                fields = []
                for name, column in zip(table.column_names, table.columns, strict=True):
                    if name == geometry_name:
                        # Drop the geoarrow field label; the geo metadata says it is WKB.
                        fields.append(pa.field(GEOMETRY_COLUMN, pa.binary()))
                        columns.append(column.cast(pa.binary()))
                        kinds |= wkb_types(column)
                    else:
                        fields.append(pa.field(name.lower(), column.type))
                        columns.append(column)
                for name, value in (constants or {}).items():
                    fields.append(pa.field(name, value.type))
                    columns.append(pa.array([value.as_py()] * table.num_rows, type=value.type))
                table = pa.Table.from_arrays(columns, schema=pa.schema(fields))
                if writer is None:
                    writer = pq.ParquetWriter(out, table.schema, compression="zstd")
                writer.write_table(table)
                rows += table.num_rows
        if writer is None:
            raise ValueError(f"{src.name} has no features")
        writer.add_key_value_metadata({"geo": json.dumps(geo_metadata(sorted(kinds)))})
    finally:
        if writer is not None:
            writer.close()
    return rows
