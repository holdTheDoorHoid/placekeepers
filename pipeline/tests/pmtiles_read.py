"""Read PMTiles version 3 files and their vector tiles in tests, with the standard library only:
every tile with its zoom, and each feature's geometry type and properties."""

from __future__ import annotations

import gzip
import struct
from collections.abc import Iterator
from pathlib import Path
from typing import Any

GEOMETRY_TYPES = {1: "Point", 2: "LineString", 3: "Polygon"}


def _varint(data: bytes, pos: int) -> tuple[int, int]:
    shift = result = 0
    while True:
        byte = data[pos]
        pos += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, pos
        shift += 7


def _entries(data: bytes) -> list[tuple[int, int, int, int]]:
    """A PMTiles directory: (tile id, run length, length, offset) per entry."""
    pos = 0
    count, pos = _varint(data, pos)
    ids, last = [], 0
    for _ in range(count):
        delta, pos = _varint(data, pos)
        last += delta
        ids.append(last)
    runs, lengths, offsets = [], [], []
    for _ in range(count):
        value, pos = _varint(data, pos)
        runs.append(value)
    for _ in range(count):
        value, pos = _varint(data, pos)
        lengths.append(value)
    for i in range(count):
        value, pos = _varint(data, pos)
        offsets.append(offsets[i - 1] + lengths[i - 1] if value == 0 and i > 0 else value - 1)
    return list(zip(ids, runs, lengths, offsets, strict=True))


def zoom_of(tile_id: int) -> int:
    zoom, first = 0, 0
    while tile_id >= first + 4**zoom:
        first += 4**zoom
        zoom += 1
    return zoom


def tiles(path: Path) -> Iterator[tuple[int, bytes]]:
    """Every tile in the file as (zoom, uncompressed vector tile bytes)."""
    raw = path.read_bytes()
    root_offset, root_length, _, _, leaf_offset, _, data_offset = struct.unpack_from("<7Q", raw, 8)
    tile_compression = raw[98]

    def walk(offset: int, length: int) -> Iterator[tuple[int, bytes]]:
        for tile_id, run, size, start in _entries(gzip.decompress(raw[offset : offset + length])):
            if run == 0:
                yield from walk(leaf_offset + start, size)
                continue
            blob = raw[data_offset + start : data_offset + start + size]
            data = gzip.decompress(blob) if tile_compression == 2 else blob
            for step in range(run):
                yield zoom_of(tile_id + step), data

    yield from walk(root_offset, root_length)


def _fields(data: bytes) -> Iterator[tuple[int, int, Any]]:
    pos = 0
    while pos < len(data):
        key, pos = _varint(data, pos)
        number, wire = key >> 3, key & 7
        if wire == 0:
            value, pos = _varint(data, pos)
            yield number, wire, value
        elif wire == 2:
            length, pos = _varint(data, pos)
            yield number, wire, data[pos : pos + length]
            pos += length
        elif wire == 1:
            yield number, wire, data[pos : pos + 8]
            pos += 8
        elif wire == 5:
            yield number, wire, data[pos : pos + 4]
            pos += 4


def _value(data: bytes) -> Any:
    for number, _, value in _fields(data):
        if number == 1:
            return value.decode("utf-8")
        if number == 2:
            return struct.unpack("<f", value)[0]
        if number == 3:
            return struct.unpack("<d", value)[0]
        if number in (4, 5):
            return value
        if number == 6:
            return (value >> 1) ^ -(value & 1)
        if number == 7:
            return bool(value)
    return None


def features(tile: bytes, layer_name: str) -> list[tuple[str, dict[str, Any]]]:
    """The features of one layer of a vector tile: (geometry type, properties)."""
    found = []
    for number, _, layer in _fields(tile):
        if number != 3:
            continue
        name, keys, values, raw_features = None, [], [], []
        for field, _, value in _fields(layer):
            if field == 1:
                name = value.decode("utf-8")
            elif field == 2:
                raw_features.append(value)
            elif field == 3:
                keys.append(value.decode("utf-8"))
            elif field == 4:
                values.append(_value(value))
        if name != layer_name:
            continue
        for raw in raw_features:
            kind, properties = None, {}
            for field, _, value in _fields(raw):
                if field == 3:
                    kind = GEOMETRY_TYPES.get(value)
                elif field == 2:
                    tags, pos = [], 0
                    while pos < len(value):
                        tag, pos = _varint(value, pos)
                        tags.append(tag)
                    for i in range(0, len(tags), 2):
                        properties[keys[tags[i]]] = values[tags[i + 1]]
            found.append((kind, properties))
    return found
