"""Write a tiny OpenStreetMap PBF file for tests, from a hand made .osm (XML) file.

The adapter reads .osm.pbf files with DuckDB's ST_ReadOSM, which reads only the PBF format, while
a readable fixture is an XML file (tests/fixtures/osm_sample.osm). This writes the same data as a
PBF file, following https://wiki.openstreetmap.org/wiki/PBF_Format: a header block (with the
replication timestamp Geofabrik sets), then one block of dense nodes, one of ways and one of
relations, each compressed with zlib. Standard library only.
"""

from __future__ import annotations

import struct
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


def _varint(value: int) -> bytes:
    value &= 0xFFFFFFFFFFFFFFFF
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _zigzag(value: int) -> int:
    return (value << 1) ^ (value >> 63)


def _key(number: int, wire: int) -> bytes:
    return _varint((number << 3) | wire)


def _bytes(number: int, data: bytes) -> bytes:
    return _key(number, 2) + _varint(len(data)) + data


def _int(number: int, value: int) -> bytes:
    return _key(number, 0) + _varint(value)


def _sint(number: int, value: int) -> bytes:
    return _key(number, 0) + _varint(_zigzag(value))


def _packed(number: int, values: list[int], *, signed: bool = False) -> bytes:
    data = b"".join(_varint(_zigzag(v) if signed else v) for v in values)
    return _bytes(number, data)


def _deltas(values: list[int]) -> list[int]:
    previous = 0
    out = []
    for value in values:
        out.append(value - previous)
        previous = value
    return out


@dataclass
class Node:
    id: int
    lat: float
    lon: float
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class Way:
    id: int
    refs: list[int]
    tags: dict[str, str] = field(default_factory=dict)


@dataclass
class Relation:
    id: int
    members: list[tuple[str, int, str]]
    tags: dict[str, str] = field(default_factory=dict)


class _Strings:
    def __init__(self) -> None:
        self.table: list[bytes] = [b""]
        self.index: dict[str, int] = {}

    def __call__(self, text: str) -> int:
        if text not in self.index:
            self.index[text] = len(self.table)
            self.table.append(text.encode("utf-8"))
        return self.index[text]

    def message(self) -> bytes:
        return b"".join(_bytes(1, s) for s in self.table)


def _block(group: bytes, strings: _Strings) -> bytes:
    return _bytes(1, strings.message()) + _bytes(2, group)


def _dense(nodes: list[Node], strings: _Strings) -> bytes:
    ids = [n.id for n in nodes]
    lats = [round(n.lat * 1e7) for n in nodes]
    lons = [round(n.lon * 1e7) for n in nodes]
    keys_vals: list[int] = []
    for node in nodes:
        for key, value in node.tags.items():
            keys_vals += [strings(key), strings(value)]
        keys_vals.append(0)
    dense = (
        _packed(1, _deltas(ids), signed=True)
        + _packed(8, _deltas(lats), signed=True)
        + _packed(9, _deltas(lons), signed=True)
        + _packed(10, keys_vals)
    )
    return _bytes(2, dense)


def _ways(ways: list[Way], strings: _Strings) -> bytes:
    group = b""
    for way in ways:
        message = (
            _int(1, way.id)
            + _packed(2, [strings(k) for k in way.tags])
            + _packed(3, [strings(v) for v in way.tags.values()])
            + _packed(8, _deltas(way.refs), signed=True)
        )
        group += _bytes(3, message)
    return group


MEMBER_TYPES = {"node": 0, "way": 1, "relation": 2}


def _relations(relations: list[Relation], strings: _Strings) -> bytes:
    group = b""
    for relation in relations:
        message = (
            _int(1, relation.id)
            + _packed(2, [strings(k) for k in relation.tags])
            + _packed(3, [strings(v) for v in relation.tags.values()])
            + _packed(8, [strings(role) for _, _, role in relation.members])
            + _packed(9, _deltas([ref for _, ref, _ in relation.members]), signed=True)
            + _packed(10, [MEMBER_TYPES[kind] for kind, _, _ in relation.members])
        )
        group += _bytes(4, message)
    return group


def _blob(kind: str, data: bytes) -> bytes:
    blob = _int(2, len(data)) + _bytes(3, zlib.compress(data))
    header = _bytes(1, kind.encode()) + _int(3, len(blob))
    return struct.pack(">I", len(header)) + header + blob


def header_block(
    timestamp: datetime | None,
    features: tuple[str, ...] = ("OsmSchema-V0.6", "DenseNodes"),
    bbox: tuple[float, float, float, float] | None = None,
) -> bytes:
    data = b""
    if bbox is not None:
        west, south, east, north = (round(v * 1e9) for v in bbox)
        data += _bytes(1, _sint(1, west) + _sint(2, east) + _sint(3, north) + _sint(4, south))
    for feature in features:
        data += _bytes(4, feature.encode())
    data += _bytes(16, b"placekeepers-tests")
    if timestamp is not None:
        data += _int(32, int(timestamp.timestamp()))
    return _blob("OSMHeader", data)


def write_pbf(
    path: Path,
    nodes: list[Node],
    ways: list[Way] = (),
    relations: list[Relation] = (),
    *,
    timestamp: datetime | None = None,
) -> Path:
    """Write the elements as an .osm.pbf file (sorted by id within each kind, as osmium does)."""
    parts = [header_block(timestamp)]
    if nodes:
        strings = _Strings()
        group = _dense(sorted(nodes, key=lambda n: n.id), strings)
        parts.append(_blob("OSMData", _block(group, strings)))
    if ways:
        strings = _Strings()
        group = _ways(sorted(ways, key=lambda w: w.id), strings)
        parts.append(_blob("OSMData", _block(group, strings)))
    if relations:
        strings = _Strings()
        group = _relations(sorted(relations, key=lambda r: r.id), strings)
        parts.append(_blob("OSMData", _block(group, strings)))
    path.write_bytes(b"".join(parts))
    return path


def read_osm_xml(path: Path) -> tuple[list[Node], list[Way], list[Relation]]:
    """Nodes, ways and relations of an .osm (XML) file."""
    root = ET.parse(path).getroot()

    def tags(element: ET.Element) -> dict[str, str]:
        return {tag.get("k", ""): tag.get("v", "") for tag in element.findall("tag")}

    nodes = [
        Node(int(e.get("id", "0")), float(e.get("lat", "0")), float(e.get("lon", "0")), tags(e))
        for e in root.findall("node")
    ]
    ways = [
        Way(int(e.get("id", "0")), [int(nd.get("ref", "0")) for nd in e.findall("nd")], tags(e))
        for e in root.findall("way")
    ]
    relations = [
        Relation(
            int(e.get("id", "0")),
            [
                (m.get("type", "node"), int(m.get("ref", "0")), m.get("role", ""))
                for m in e.findall("member")
            ],
            tags(e),
        )
        for e in root.findall("relation")
    ]
    return nodes, ways, relations


def osm_xml_to_pbf(source: Path, out: Path, *, timestamp: datetime | None = None) -> Path:
    nodes, ways, relations = read_osm_xml(source)
    return write_pbf(out, nodes, ways, relations, timestamp=timestamp)
