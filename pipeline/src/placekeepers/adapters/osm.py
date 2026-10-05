"""OpenStreetMap from a weekly Geofabrik extract (registry endpoint kind `osm_extract`, M2.2).

Bulk OpenStreetMap data comes from a Geofabrik extract, never from the public Overpass server
(CLAUDE.md). Once a week the pipeline downloads Geofabrik's Pennsylvania extract (about 350 MB on
2026-10-04, an .osm.pbf file), keeps the elements that carry one of the tags the registry lists
(`endpoint.tags`) inside the City of Philadelphia and a 200 meter margin around it, and deletes
the extract. The snapshot holds those elements only (a few thousand rows).

Geofabrik remakes its extracts every day. Its `-latest` link redirects to the dated file (such as
`pennsylvania-261003.osm.pbf`), which the client follows. Geofabrik asks automated downloaders not
to fetch the same file over and over, so a good copy younger than six days is never downloaded
again unless someone forces it (`pk fetch --force`); the weekly refresh runs every seven days.
One exception: the snapshot remembers a hash of the tag list it was made with (its sidecar's
`recipe`), and a copy made with other tags, or with no hash at all, is downloaded again on the next
run, so a tag added to the registry always reaches the next weekly refresh (M3.5).

The snapshot (GeoParquet), one row per element:

* `osm_type` (`node` or `way`) and `osm_id`: the element in OpenStreetMap, so anyone can open it at
  https://www.openstreetmap.org/node/<osm_id>;
* `tags`: every tag of the element, as a JSON object with sorted keys;
* `geometry`: a node's point, or a way's line (a closed way: its polygon), in longitude and
  latitude; `lat` and `lng`: a point on it (the node itself, or a point on the way);
* `in_city`: whether that point lies inside the city limits (the margin catches a shelter or a
  bench just across a boundary street from a stop);
* `extract_date`: the day the extract's data is from (the replication timestamp in the file's
  header, else the server's Last-Modified date), the source's newest record date.

Relations (for example a platform drawn as a multipolygon) are not read: on 2026-10-04 only three
in all of Pennsylvania carried these tags, a train platform and two picnic shelters. The city
limits are the union of the 2020 census tracts, which the City adjusted to its standard boundary
(`census_tracts_2020`).

Data from OpenStreetMap is © OpenStreetMap contributors, under the Open Database License (ODbL),
and anything published from it is ODbL too (registry license `odbl`).
"""

from __future__ import annotations

import hashlib
import json
import logging
import zlib
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar

import duckdb
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely.geometry.base import BaseGeometry

from placekeepers.adapters.base import Adapter, FetchError, quote_literal
from placekeepers.adapters.url import http_date
from placekeepers.cache import RawFetch
from placekeepers.config import local_date
from placekeepers.derive.bus_stops import is_stop
from placekeepers.derive.street_safety import to_meters
from placekeepers.geo import write_geoparquet
from placekeepers.health import Check
from placekeepers.httpclient import RetryableError
from placekeepers.registry import OsmExtractEndpoint
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

EXTRACT_FILE = "extract.osm.pbf"
#: Elements this far outside the city limits are kept too (and marked `in_city` false), so a
#: shelter or bench just across a boundary street can still count for a stop inside the city.
MARGIN_METERS = 200.0
#: The source whose shapes, joined, are the city limits.
CITY_LIMITS_SOURCE = "census_tracts_2020"
#: At least this share of the stops kept must lie inside the city limits; less means the city
#: limits or the extract are not what they should be.
MIN_STOPS_IN_CITY = 0.9

# ---------------------------------------------------------------------------------------------
# The file header. An .osm.pbf file is a series of blobs, each after a small header; the first
# blob is the OSMHeader, which says what the file needs to be read and how old its data is. It is
# read here with a few lines of protobuf decoding, so a download that is not an extract (an error
# page sent with HTTP 200, a cut off file) is caught before anything else reads it.
# https://wiki.openstreetmap.org/wiki/PBF_Format


class NotAnExtract(ValueError):
    """The file is not an OpenStreetMap PBF extract (or not one we can read)."""


@dataclass(frozen=True)
class PbfHeader:
    required_features: tuple[str, ...]
    writing_program: str | None
    #: when the data was last brought up to date (Geofabrik sets it), in UTC
    replication_timestamp: datetime | None
    #: west, south, east, north in degrees, when the file says
    bbox: tuple[float, float, float, float] | None


#: What we can read: every Geofabrik extract needs exactly these two.
READABLE_FEATURES = frozenset({"OsmSchema-V0.6", "DenseNodes"})
MAX_BLOB_HEADER = 64 * 1024
MAX_BLOB = 32 * 1024 * 1024


def _varint(data: bytes, pos: int) -> tuple[int, int]:
    result = shift = 0
    while True:
        if pos >= len(data):
            raise NotAnExtract("a number in the file header is cut off")
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, pos
        shift += 7
        if shift > 63:
            raise NotAnExtract("a number in the file header is too long")


def protobuf_fields(data: bytes) -> Iterator[tuple[int, int | bytes]]:
    """(field number, value) for each field of a protobuf message: an int for numbers, bytes for
    strings and nested messages."""
    pos = 0
    while pos < len(data):
        key, pos = _varint(data, pos)
        number, wire = key >> 3, key & 7
        value: int | bytes
        if wire == 0:
            value, pos = _varint(data, pos)
        elif wire == 1:
            value, pos = int.from_bytes(data[pos : pos + 8], "little"), pos + 8
        elif wire == 2:
            length, pos = _varint(data, pos)
            value, pos = data[pos : pos + length], pos + length
        elif wire == 5:
            value, pos = int.from_bytes(data[pos : pos + 4], "little"), pos + 4
        else:
            raise NotAnExtract(f"unexpected protobuf wire type {wire}")
        if pos > len(data):
            raise NotAnExtract("the file header is cut off")
        yield number, value


def _zigzag(value: int) -> int:
    return (value >> 1) ^ -(value & 1)


def read_pbf_header(path: Path) -> PbfHeader:
    """Read the OSMHeader block at the start of an .osm.pbf file. Raises NotAnExtract."""
    with path.open("rb") as handle:
        size = int.from_bytes(handle.read(4), "big")
        if not 0 < size <= MAX_BLOB_HEADER:
            raise NotAnExtract("the file does not start like an OpenStreetMap PBF file")
        blob_header = dict(protobuf_fields(handle.read(size)))
        if blob_header.get(1) != b"OSMHeader":
            raise NotAnExtract("the file does not start with an OpenStreetMap header block")
        datasize = blob_header.get(3)
        if not isinstance(datasize, int) or not 0 < datasize <= MAX_BLOB:
            raise NotAnExtract("the header block has no usable size")
        blob = handle.read(datasize)
    if len(blob) != datasize:
        raise NotAnExtract("the file is cut off inside its header block")
    parts = dict(protobuf_fields(blob))
    if isinstance(parts.get(1), bytes):
        data = parts[1]
    elif isinstance(parts.get(3), bytes):
        try:
            data = zlib.decompress(parts[3])
        except zlib.error as exc:
            raise NotAnExtract(f"the header block does not unpack: {exc}") from exc
    else:
        raise NotAnExtract("the header block uses a compression we do not read")
    assert isinstance(data, bytes)
    required: list[str] = []
    program = None
    timestamp = None
    bbox = None
    for number, value in protobuf_fields(data):
        if number == 1 and isinstance(value, bytes):
            box = {n: _zigzag(v) for n, v in protobuf_fields(value) if isinstance(v, int)}
            if len(box) == 4:
                left, right, top, bottom = (box[n] / 1e9 for n in (1, 2, 3, 4))
                bbox = (left, bottom, right, top)
        elif number == 4 and isinstance(value, bytes):
            required.append(value.decode("utf-8", "replace"))
        elif number == 16 and isinstance(value, bytes):
            program = value.decode("utf-8", "replace")
        elif number == 32 and isinstance(value, int) and value > 0:
            timestamp = datetime.fromtimestamp(value, UTC)
    return PbfHeader(tuple(required), program, timestamp, bbox)


def check_extract(path: Path) -> None:
    """For PoliteClient.download: a file that is not an extract is a failed attempt (retried)."""
    try:
        header = read_pbf_header(path)
    except NotAnExtract as exc:
        raise RetryableError(f"the download is not an OpenStreetMap extract: {exc}") from exc
    unknown = sorted(set(header.required_features) - READABLE_FEATURES)
    if unknown:
        raise FetchError(f"The extract needs features we cannot read: {', '.join(unknown)}")


# ---------------------------------------------------------------------------------------------
# The adapter


class OsmExtract(Adapter):
    """Downloads an OpenStreetMap extract and keeps the registry's tags inside the city."""

    kind = "osm_extract"
    required_columns = (
        "osm_type",
        "osm_id",
        "tags",
        "lat",
        "lng",
        "in_city",
        "extract_date",
        "geometry",
    )
    depends_on = ("census_tracts_2020",)
    #: Never download a good copy younger than this again unless forced (Geofabrik's request).
    min_refetch: ClassVar[timedelta | None] = timedelta(days=6)

    @property
    def endpoint(self) -> OsmExtractEndpoint:
        assert isinstance(self.source.endpoint, OsmExtractEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        if self.endpoint.url is None:
            raise FetchError("This extract has no url; the site makes it, not the pipeline")
        result = self.ctx.http.download(
            self.endpoint.url, dest / EXTRACT_FILE, check_file=check_extract
        )
        header = read_pbf_header(dest / EXTRACT_FILE)
        stamp = header.replication_timestamp
        return {
            "file": EXTRACT_FILE,
            "bytes": result.bytes,
            "sha256": result.sha256,
            "source_date": http_date(result.last_modified),
            "replication_timestamp": stamp.strftime("%Y-%m-%dT%H:%M:%SZ") if stamp else None,
            "writing_program": header.writing_program,
            "rows": None,
        }

    def recipe(self) -> str | None:
        """The registry's tag list, as a hash: the tags decide which elements the snapshot keeps."""
        return tags_recipe(self.endpoint.tags)

    def extract_date(self, raw: RawFetch, header: PbfHeader) -> date:
        """The day the extract's data is from, in Philadelphia."""
        if header.replication_timestamp is not None:
            return local_date(header.replication_timestamp)
        text = raw.info.get("source_date")
        if text:
            return date.fromisoformat(text)
        raise FetchError("The extract does not say how old its data is")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        path = raw.dir / raw.info["file"]
        try:
            header = read_pbf_header(path)
        except NotAnExtract as exc:
            raise FetchError(f"The download is not an OpenStreetMap extract: {exc}") from exc
        unknown = sorted(set(header.required_features) - READABLE_FEATURES)
        if unknown:
            raise FetchError(f"The extract needs features we cannot read: {', '.join(unknown)}")
        day = self.extract_date(raw, header)
        city = city_limits(self.ctx.cache)
        con = self.ctx.duckdb()
        try:
            load_spatial(con)
            elements = read_elements(con, path, self.endpoint.tags, padded_bounds(city))
        finally:
            con.close()
        table, notes = elements_table(elements, city, day)
        self.notes.extend(notes)
        log.info("%s: kept %s elements in and around the city", self.id, f"{table.num_rows:,}")
        write_geoparquet(table, out, sorted(geometry_types(table)))

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        """Most of the stops kept must lie inside the city limits (the rest are in the margin)."""
        table = pq.read_table(path, columns=["tags", "in_city"])
        inside = [
            bool(in_city)
            for text, in_city in zip(
                table.column("tags").to_pylist(), table.column("in_city").to_pylist(), strict=True
            )
            if is_stop(json.loads(text or "{}"))
        ]
        if not inside:
            return [Check("stops_in_city", False, "There are no bus or trolley stops in the city")]
        share = sum(inside) / len(inside)
        detail = (
            f"{share:.0%} of the {len(inside):,} stops kept lie inside the city limits "
            f"(at least {MIN_STOPS_IN_CITY:.0%} expected)"
        )
        return [Check("stops_in_city", share >= MIN_STOPS_IN_CITY, detail)]


# ---------------------------------------------------------------------------------------------
# Reading the extract


def load_spatial(con: duckdb.DuckDBPyConnection) -> None:
    """DuckDB's spatial extension reads .osm.pbf files (ST_ReadOSM)."""
    try:
        con.execute("LOAD spatial")
    except duckdb.Error:
        con.execute("INSTALL spatial")
        con.execute("LOAD spatial")


def city_limits(cache) -> BaseGeometry:
    """The City of Philadelphia, in longitude and latitude: the 2020 census tracts joined (the
    City's copy, adjusted to its standard boundary)."""
    store = SnapshotStore(cache, CITY_LIMITS_SOURCE)
    meta = store.current()
    if meta is None:
        raise FetchError(
            f"The city limits are missing: {CITY_LIMITS_SOURCE} has no good snapshot yet"
        )
    table = pq.read_table(store.path_for(meta), columns=["geometry"])
    shapes = [shapely.from_wkb(g) for g in table.column("geometry").to_pylist() if g is not None]
    city = shapely.union_all(shapely.make_valid(np.array(shapes, dtype=object)))
    if city.is_empty:
        raise FetchError("The city limits are empty")
    return city


def padded_bounds(city: BaseGeometry, pad: float = 0.01) -> tuple[float, float, float, float]:
    """A box around the city, about a kilometer wider on every side than the margin needs, to
    pass over most of Pennsylvania quickly before the exact test."""
    west, south, east, north = city.bounds
    return west - pad, south - pad, east + pad, north + pad


def tags_recipe(tags: list[str]) -> str:
    """A hash of a tag list, the same whatever the order or repeats: "tags:" and 16 hex digits."""
    text = "\n".join(sorted(set(tags)))
    return "tags:" + hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def tag_condition(tags: list[str]) -> str:
    """SQL that is true for an element carrying any of the tags ("key=value", or "key" for any
    value). Keys and values are checked by the registry, and quoted here all the same."""
    parts = []
    for tag in tags:
        key, _, value = tag.partition("=")
        found = f"map_extract(tags, {quote_literal(key)})"
        if value:
            parts.append(f"list_contains({found}, {quote_literal(value)})")
        else:
            parts.append(f"len({found}) > 0")
    return "(" + " OR ".join(parts) + ")"


@dataclass
class Element:
    osm_type: str
    osm_id: int
    tags: dict[str, str]
    geometry: BaseGeometry


def read_elements(
    con: duckdb.DuckDBPyConnection,
    path: Path,
    tags: list[str],
    box: tuple[float, float, float, float],
) -> tuple[list[Element], int]:
    """Every node inside `box` and every way that carries one of `tags`, with its geometry: a
    node's point, a way's line, or a closed way's polygon. Returns the elements and how many ways
    were left out because the extract lacks some of their nodes. Two passes over the file: the
    elements, then the points of their ways."""
    source = f"ST_ReadOSM({quote_literal(str(path))})"
    west, south, east, north = box
    rows = con.execute(
        f"""SELECT kind::VARCHAR AS kind, id, tags, refs, lat, lon
            FROM {source}
            WHERE kind IN ('node', 'way') AND {tag_condition(tags)}
              AND (kind = 'way' OR (lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?))
            ORDER BY kind, id""",
        [south, north, west, east],
    ).fetchall()
    refs = sorted({ref for kind, _, _, way_refs, _, _ in rows if kind == "way" for ref in way_refs})
    points: dict[int, tuple[float, float]] = {}
    if refs:
        con.execute("CREATE TEMP TABLE way_nodes AS SELECT unnest(?::BIGINT[]) AS id", [refs])
        points = {
            node: (lon, lat)
            for node, lat, lon in con.execute(
                f"SELECT n.id, n.lat, n.lon FROM {source} n SEMI JOIN way_nodes w ON n.id = w.id "
                "WHERE n.kind = 'node'"
            ).fetchall()
        }
    elements: list[Element] = []
    broken = 0
    for kind, osm_id, element_tags, way_refs, lat, lon in rows:
        clean = {str(k): str(v) for k, v in (element_tags or {}).items()}
        if kind == "node":
            elements.append(Element("node", int(osm_id), clean, shapely.Point(lon, lat)))
            continue
        coords = [points.get(ref) for ref in way_refs or []]
        if len(coords) < 2 or any(c is None for c in coords):
            broken += 1
            continue
        elements.append(Element("way", int(osm_id), clean, way_geometry(way_refs, coords)))
    return elements, broken


def way_geometry(refs: list[int], coords: list) -> BaseGeometry:
    """A closed way of four or more points is an area (a shelter's outline, a platform); any
    other way is a line."""
    if len(refs) >= 4 and refs[0] == refs[-1]:
        polygon = shapely.Polygon(coords)
        if polygon.is_valid and not polygon.is_empty:
            return polygon
    return shapely.LineString(coords)


def representative_point(geometry: BaseGeometry) -> shapely.Point:
    """A point on the element: the node itself, the middle of a line, a point inside an area."""
    if geometry.geom_type == "Point":
        return geometry
    if geometry.geom_type == "LineString":
        return geometry.interpolate(0.5, normalized=True)
    return geometry.point_on_surface()


def elements_table(
    read: tuple[list[Element], int], city: BaseGeometry, day: date
) -> tuple[pa.Table, list[str]]:
    """The snapshot: the elements within the margin around the city, sorted by type and id."""
    elements, broken = read
    notes: list[str] = []
    if broken:
        notes.append(
            f"{broken:,} ways with these tags lack points in the extract and were left out"
        )
    if not elements:
        raise FetchError("The extract has no elements with these tags around the city")
    city_m = to_meters(np.array([city], dtype=object))[0]
    margin = city_m.buffer(MARGIN_METERS)
    shapely.prepare(margin)
    shapely.prepare(city)
    shapes_m = to_meters(np.array([e.geometry for e in elements], dtype=object))
    near = shapely.intersects(margin, shapes_m)
    kept = [e for e, keep in zip(elements, near.tolist(), strict=True) if keep]
    if not kept:
        raise FetchError("None of the elements with these tags lie in or around the city")
    points = [representative_point(e.geometry) for e in kept]
    inside = shapely.contains(city, np.array(points, dtype=object)).tolist()
    table = pa.table(
        {
            "osm_type": pa.array([e.osm_type for e in kept], pa.string()),
            "osm_id": pa.array([e.osm_id for e in kept], pa.int64()),
            "tags": pa.array([tags_json(e.tags) for e in kept], pa.string()),
            "lat": pa.array([round(p.y, 7) for p in points], pa.float64()),
            "lng": pa.array([round(p.x, 7) for p in points], pa.float64()),
            "in_city": pa.array(inside, pa.bool_()),
            "extract_date": pa.array([day] * len(kept), pa.date32()),
            "geometry": pa.array([shapely.to_wkb(e.geometry) for e in kept], pa.binary()),
        }
    )
    in_city = Counter(f"{e.osm_type}s" for e, flag in zip(kept, inside, strict=True) if flag)
    notes.append(
        f"Kept {len(kept):,} elements: {sum(inside):,} inside the city "
        f"({in_city.get('nodes', 0):,} points, {in_city.get('ways', 0):,} lines and areas) and "
        f"{len(kept) - sum(inside):,} within {MARGIN_METERS:g} meters of it"
    )
    return table, notes


def geometry_types(table: pa.Table) -> set[str]:
    return {
        shapely.from_wkb(g).geom_type for g in table.column("geometry").to_pylist() if g is not None
    }


def tags_json(tags: dict[str, str]) -> str:
    """Tags as a JSON object with sorted keys, so equal tags always give equal text."""
    return json.dumps(dict(sorted(tags.items())), ensure_ascii=False, separators=(",", ":"))
