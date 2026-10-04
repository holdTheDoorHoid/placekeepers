"""Layers of the City's ArcGIS Online feature services.

https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/<service>/FeatureServer/<layer>

We read the layer's description first (field names and types, the object id field, the largest page
the server allows), count the features, then page through them with resultOffset and
resultRecordCount, ordered by the object id, in WGS84 longitude and latitude (outSR=4326) as
GeoJSON. Each page is kept as a file until the download is normalized.

ArcGIS sometimes answers a valid request with an error message inside a normal reply (we have seen
"Invalid URL" for a layer that works a moment later), so error replies are retried. A reply asking
for a login token is a refusal and is never worked around.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import quote

import numpy as np
import pyarrow as pa
import shapely
from shapely.geometry import shape

from placekeepers.adapters.base import Adapter, FetchError
from placekeepers.cache import RawFetch
from placekeepers.geo import GEOMETRY_COLUMN, write_geoparquet
from placekeepers.httpclient import AccessRefused, RetryableError
from placekeepers.registry import ArcgisEndpoint

log = logging.getLogger(__name__)

ARCGIS_ROOT = "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services"

_INTEGER_TYPES = {
    "esriFieldTypeOID",
    "esriFieldTypeSmallInteger",
    "esriFieldTypeInteger",
    "esriFieldTypeBigInteger",
}
_FLOAT_TYPES = {"esriFieldTypeSingle", "esriFieldTypeDouble"}


def check_arcgis(data: Any) -> None:
    """Raise for an error message sent inside a normal ArcGIS reply."""
    if isinstance(data, dict) and "error" in data:
        error = data.get("error") or {}
        code = error.get("code")
        message = error.get("message", "unknown error")
        if code in (401, 403, 498, 499):
            raise AccessRefused(
                f"ArcGIS asks for a login (error {code}: {message}). Placekeepers never works "
                "around a login."
            )
        raise RetryableError(f"ArcGIS error {code}: {message}")


def exceeded_transfer_limit(data: dict[str, Any]) -> bool | None:
    """True when the server says more features remain, False when it says none do."""
    for holder in (data.get("properties") or {}, data):
        if "exceededTransferLimit" in holder:
            return bool(holder["exceededTransferLimit"])
    return None


def arrow_column(values: list[Any], esri_type: str) -> pa.Array:
    if esri_type in _INTEGER_TYPES:
        return pa.array([None if v is None else int(v) for v in values], type=pa.int64())
    if esri_type in _FLOAT_TYPES:
        return pa.array([None if v is None else float(v) for v in values], type=pa.float64())
    if esri_type == "esriFieldTypeDate":
        # Milliseconds since 1970 in UTC. Stored as a UTC timestamp without a time zone.
        millis = pa.array([None if v is None else int(v) for v in values], type=pa.int64())
        return millis.cast(pa.timestamp("ms"))
    return pa.array([None if v is None else str(v) for v in values], type=pa.string())


class ArcgisAdapter(Adapter):
    kind = "arcgis"
    root: ClassVar[str] = ARCGIS_ROOT
    page_size: ClassVar[int] = 2000
    #: ArcGIS bookkeeping fields we do not keep (lower case)
    skip_fields: ClassVar[frozenset[str]] = frozenset({"shape__area", "shape__length"})

    @property
    def endpoint(self) -> ArcgisEndpoint:
        assert isinstance(self.source.endpoint, ArcgisEndpoint)
        return self.source.endpoint

    @property
    def layer_url(self) -> str:
        return f"{self.root}/{quote(self.endpoint.service)}/FeatureServer/{self.endpoint.layer}"

    def count(self) -> int:
        data = self.ctx.http.get_json(
            f"{self.layer_url}/query",
            {"where": "1=1", "returnCountOnly": "true", "f": "json"},
            check=check_arcgis,
        )
        return int(data["count"])

    def fetch(self, dest: Path) -> dict[str, Any]:
        http = self.ctx.http
        layer = http.get_json(self.layer_url, {"f": "json"}, check=check_arcgis)
        fields = [{"name": f["name"], "type": f["type"]} for f in layer.get("fields") or []]
        object_id = layer.get("objectIdField") or next(
            (f["name"] for f in fields if f["type"] == "esriFieldTypeOID"), None
        )
        if object_id is None:
            raise FetchError("The layer has no object id field to page by")
        page_size = min(self.page_size, int(layer.get("maxRecordCount") or self.page_size))
        expected = self.count()
        log.info(
            "%s: %s features to download from %s", self.id, f"{expected:,}", self.endpoint.service
        )

        total = 0
        page = 0
        while True:
            data = http.get_json(
                f"{self.layer_url}/query",
                {
                    "where": "1=1",
                    "outFields": "*",
                    "returnGeometry": "true",
                    "outSR": "4326",
                    "f": "geojson",
                    "orderByFields": f"{object_id} ASC",
                    "resultOffset": str(total),
                    "resultRecordCount": str(page_size),
                },
                check=check_arcgis,
            )
            features = data.get("features") or []
            if not features:
                break
            page += 1
            (dest / f"page-{page:05d}.geojson").write_text(json.dumps(data), encoding="utf-8")
            total += len(features)
            more = exceeded_transfer_limit(data)
            log.debug("%s: page %d, %d features, more=%s", self.id, page, len(features), more)
            if more is False or (more is None and len(features) < page_size):
                break
        log.info("%s: %s features in %d pages", self.id, f"{total:,}", page)

        if total != expected:
            recount = self.count()
            if total != recount:
                raise FetchError(
                    f"Downloaded {total:,} features but the layer reports {recount:,}; trying "
                    "again next run"
                )
            expected = recount
        editing = layer.get("editingInfo") or {}
        return {
            "rows": total,
            "pages": page,
            "expected_rows": expected,
            "fields": fields,
            "object_id_field": object_id,
            "geometry_type": layer.get("geometryType"),
            "data_last_edit": editing.get("dataLastEditDate"),
        }

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        fields = [
            f
            for f in raw.info["fields"]
            if f["type"] != "esriFieldTypeGeometry" and f["name"].lower() not in self.skip_fields
        ]
        names = [f["name"].lower() for f in fields]
        if len(set(names)) != len(names) or GEOMETRY_COLUMN in names:
            raise FetchError(f"Field names collide when lower cased: {names}")
        values: dict[str, list[Any]] = {f["name"]: [] for f in fields}
        geometries: list[Any] = []
        for page in sorted(raw.dir.glob("page-*.geojson")):
            data = json.loads(page.read_text(encoding="utf-8"))
            for feature in data.get("features") or []:
                properties = feature.get("properties") or {}
                for f in fields:
                    values[f["name"]].append(properties.get(f["name"]))
                geometry = feature.get("geometry")
                geometries.append(shape(geometry) if geometry else None)

        columns = {f["name"].lower(): arrow_column(values[f["name"]], f["type"]) for f in fields}
        wkb = shapely.to_wkb(np.array(geometries, dtype=object), flavor="iso")
        columns[GEOMETRY_COLUMN] = pa.array(list(wkb), type=pa.binary())
        missing = sum(1 for g in geometries if g is None or g.is_empty)
        if missing:
            note = f"{missing:,} features have no geometry"
            log.warning("%s: %s", self.id, note)
            self.notes.append(note)
        kinds = sorted({g.geom_type for g in geometries if g is not None and not g.is_empty})
        write_geoparquet(pa.table(columns), out, kinds)
