"""Picture services on an ArcGIS server, such as the City's aerial photographs (M4.3).

The visitor's browser loads these pictures straight from the City's servers, only once someone
turns their layer on: Placekeepers never copies or hosts them. So the pipeline downloads no
pictures. Each run it checks, politely, that every service the registry lists still answers:

* its description (`<url>/<service>/MapServer?f=json`) says it serves cached tiles in Web
  Mercator, 256 pixels square, at the zoom levels the map uses;
* one tile in the middle of the source's `bounds`, at zoom 15, comes back as a picture.

The snapshot holds one row per service: its key (the year), its name, whether it answered, the
deepest zoom level it serves and, when it did not answer, why. A service that stops answering
fails the snapshot's checks, so the source turns stale on the Data status page and, after two
weeks in a row, the weekly refresh opens the usual issue (docs/CONTRACTS.md section 1,
`arcgis_tiles`). A reply asking for a login is recorded as a refusal and never worked around.
"""

from __future__ import annotations

import json
import logging
import math
from datetime import date
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import quote

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.base import Adapter, FetchError
from placekeepers.cache import RawFetch
from placekeepers.health import Check
from placekeepers.httpclient import AccessRefused, HttpError, RetryableError
from placekeepers.registry import ArcgisTilesEndpoint, TileService

log = logging.getLogger(__name__)

RESULTS_FILE = "services.json"
#: the zoom level of the one tile asked of each service
PROBE_ZOOM = 15
#: the zoom levels the map draws (web/src/map/controller.ts: minZoom 9, maxZoom 19); a service must
#: serve tiles at least this deep
DEEPEST_ZOOM_NEEDED = 19
#: Web Mercator, as ArcGIS names it (the newer and the older code)
WEB_MERCATOR = {3857, 102100}


def tile_at(lng: float, lat: float, zoom: int) -> tuple[int, int, int]:
    """The Web Mercator tile (zoom, column, row) holding a point."""
    n = 2**zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return zoom, min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def check_service_reply(data: Any) -> None:
    """Raise for an error message sent inside a normal ArcGIS reply. A missing service (404) or a
    bad request will not mend itself within the run, so they are not retried; a login is a
    refusal."""
    if isinstance(data, dict) and "error" in data:
        error = data.get("error") or {}
        code = error.get("code")
        message = error.get("message", "unknown error")
        if code in (401, 403, 498, 499):
            raise AccessRefused(
                f"ArcGIS asks for a login (error {code}: {message}). Placekeepers never works "
                "around a login."
            )
        if code in (400, 404):
            raise FetchError(f"ArcGIS error {code}: {message}")
        raise RetryableError(f"ArcGIS error {code}: {message}")


def describe_tiling(info: dict[str, Any]) -> tuple[int | None, str | None]:
    """The deepest zoom level a service's description offers, and what is wrong with its tiling
    for the map (None when nothing is)."""
    tiling = info.get("tileInfo") or {}
    reference = tiling.get("spatialReference") or {}
    wkid = reference.get("latestWkid") or reference.get("wkid")
    levels = [lod.get("level") for lod in tiling.get("lods") or [] if isinstance(lod, dict)]
    levels = [level for level in levels if isinstance(level, int)]
    deepest = max(levels) if levels else None
    if not info.get("singleFusedMapCache", True) or not tiling:
        return deepest, "It does not serve cached tiles"
    if wkid not in WEB_MERCATOR:
        return deepest, f"Its tiles are not in Web Mercator (spatial reference {wkid})"
    if tiling.get("rows") != 256 or tiling.get("cols") != 256:
        return (
            deepest,
            f"Its tiles are {tiling.get('cols')} by {tiling.get('rows')} pixels, not 256",
        )
    if deepest is None or deepest < DEEPEST_ZOOM_NEEDED or PROBE_ZOOM not in levels:
        return deepest, f"It serves zoom levels only to {deepest}, short of {DEEPEST_ZOOM_NEEDED}"
    return deepest, None


def plain(exc: BaseException) -> str:
    text = " ".join(str(exc).split()) or type(exc).__name__
    return text if len(text) <= 200 else text[:197] + "..."


class ArcgisTilesAdapter(Adapter):
    """Checks the picture services of one `arcgis_tiles` source (see the module notes)."""

    kind = "arcgis_tiles"
    required_columns: ClassVar[tuple[str, ...]] = ("key", "service", "ok", "deepest_zoom", "detail")

    @property
    def endpoint(self) -> ArcgisTilesEndpoint:
        assert isinstance(self.source.endpoint, ArcgisTilesEndpoint)
        return self.source.endpoint

    def probe_tile(self) -> tuple[int, int, int]:
        west, south, east, north = self.endpoint.bounds
        return tile_at((west + east) / 2, (south + north) / 2, PROBE_ZOOM)

    def check(self, service: TileService) -> dict[str, Any]:
        base = f"{self.endpoint.url}/{quote(service.service)}/MapServer"
        row: dict[str, Any] = {
            "key": service.key,
            "service": service.service,
            "ok": False,
            "deepest_zoom": None,
            "detail": None,
        }
        try:
            info = self.ctx.http.get_json(base, {"f": "json"}, check=check_service_reply)
            row["deepest_zoom"], problem = describe_tiling(info if isinstance(info, dict) else {})
            if problem:
                row["detail"] = problem
                return row
            z, x, y = self.probe_tile()
            response = self.ctx.http.get(f"{base}/tile/{z}/{y}/{x}")
            kind = response.headers.get("content-type", "")
            if not kind.startswith("image/") or not response.content:
                row["detail"] = (
                    f"Its tile {z}/{y}/{x} came back as {kind or 'nothing'}, not a picture"
                )
                return row
        except AccessRefused as exc:
            row["detail"] = plain(exc)
            return row
        except (HttpError, FetchError) as exc:
            row["detail"] = f"It did not answer: {plain(exc)}"
            return row
        row["ok"] = True
        return row

    def fetch(self, dest: Path) -> dict[str, Any]:
        rows = []
        for service in self.endpoint.services:
            row = self.check(service)
            if not row["ok"]:
                log.warning("%s: %s (%s): %s", self.id, service.key, service.service, row["detail"])
            rows.append(row)
        (dest / RESULTS_FILE).write_text(json.dumps(rows, indent=1), encoding="utf-8")
        answered = sum(1 for row in rows if row["ok"])
        log.info("%s: %d of %d services answered", self.id, answered, len(rows))
        return {"rows": len(rows), "answered": answered}

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        rows = json.loads((raw.dir / RESULTS_FILE).read_text(encoding="utf-8"))
        table = pa.table(
            {
                "key": pa.array([str(row["key"]) for row in rows], type=pa.string()),
                "service": pa.array([str(row["service"]) for row in rows], type=pa.string()),
                "ok": pa.array([bool(row["ok"]) for row in rows], type=pa.bool_()),
                "deepest_zoom": pa.array(
                    [row.get("deepest_zoom") for row in rows], type=pa.int64()
                ),
                "detail": pa.array([row.get("detail") for row in rows], type=pa.string()),
            }
        )
        pq.write_table(table, out)

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        table = pq.read_table(path, columns=["key", "service", "ok", "detail"]).to_pylist()
        listed = [service.key for service in self.endpoint.services]
        checked = [row["key"] for row in table]
        checks = []
        if checked != listed:
            checks.append(
                Check(
                    "services_listed",
                    False,
                    f"The check covers {checked}, not the services the registry lists, {listed}",
                )
            )
        broken = [row for row in table if not row["ok"]]
        if broken:
            detail = "; ".join(
                f"{row['key']} ({row['service']}): {row['detail'] or 'no answer'}" for row in broken
            )
            checks.append(
                Check("services_answer", False, f"Not every picture service answered: {detail}")
            )
        else:
            checks.append(
                Check("services_answer", True, f"All {len(table)} picture services answered")
            )
        return checks
