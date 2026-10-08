"""Shared test helpers: a fake Carto SQL API, a fake ArcGIS feature service, and run contexts.

Unit tests never touch the network: every request goes to an httpx MockTransport.
"""

from __future__ import annotations

import csv
import io
import json
import re
import shutil
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import mapping

from placekeepers.config import Settings, find_repo_root
from placekeepers.context import Context
from placekeepers.geo import write_geoparquet
from placekeepers.httpclient import PoliteClient
from placekeepers.registry import load_registry
from placekeepers.snapshots import SnapshotMeta, SnapshotStore

FIXTURES = Path(__file__).parent / "fixtures"
REPO_ROOT = find_repo_root(Path(__file__).parent)


@pytest.fixture(autouse=True)
def _no_real_tippecanoe(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests that want tippecanoe ask for it; by default publish runs without it."""
    monkeypatch.setenv("PK_TIPPECANOE", "")


@pytest.fixture
def repo_copy(tmp_path: Path) -> Path:
    """A throwaway copy of the registry, curated data and content pages, safe to edit."""
    root = tmp_path / "repo"
    shutil.copytree(REPO_ROOT / "registry", root / "registry")
    shutil.copytree(REPO_ROOT / "data" / "curated", root / "data" / "curated")
    # A layer's guide names a content page, which the registry check looks for.
    shutil.copytree(REPO_ROOT / "content", root / "content")
    return root


# Fake servers
@dataclass
class FakeCarto:
    """Answers count queries, keyset page queries and account (VALUES join) queries for in memory
    tables of rows, sent by GET or POST.

    Each row is a dict keyed by the adapter's output column names, plus `cartodb_id`.
    """

    tables: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    queries: list[str] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)
    fail_status: int | None = None
    #: extra rows the count query reports for account chunks (to simulate a short download)
    count_offset: int = 0
    #: row filters for SQL fragments the fake understands (keyed by the fragment)
    where_filters: dict[str, Callable[[dict[str, Any]], bool]] = field(
        default_factory=lambda: {
            "violationcodetitle ILIKE '%VACAN%'": lambda row: (
                row.get("violationcode") == "9-3904"
                or "VACAN" in str(row.get("violationcodetitle") or "").upper()
            ),
        }
    )

    @staticmethod
    def query_of(request: httpx.Request) -> str:
        if request.method == "POST":
            return parse_qs(request.content.decode())["q"][0]
        return request.url.params["q"]

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if self.fail_status:
            return httpx.Response(self.fail_status, text="busy")
        query = self.query_of(request)
        self.queries.append(query)
        self.methods.append(request.method)
        table_name = re.search(r"FROM (\w+)", query).group(1)
        rows = sorted(self.tables[table_name], key=lambda row: row["cartodb_id"])
        join = re.search(
            r"JOIN \(VALUES (.*?)\) AS chosen\(chosen_account\) ON \w+\.(\w+) =", query
        )
        if join:
            accounts = set(re.findall(r"'(\d+)'", join.group(1)))
            rows = [row for row in rows if row.get(join.group(2)) in accounts]
        for fragment, keep in self.where_filters.items():
            if fragment in query:
                rows = [row for row in rows if keep(row)]
        # Date floors such as violationdate >= '2016-01-01' (ISO dates compare as text).
        for column, floor in re.findall(r"(\w+) >= '(\d{4}-\d{2}-\d{2})'", query):
            rows = [row for row in rows if column not in row or str(row[column] or "") >= floor]
        # Rows counted by one column, such as the tax years of the assessments table
        # (placekeepers.adapters.displacement.AssessmentValues), answered as JSON.
        grouped = re.match(r"SELECT (\w+)::int AS \w+, count\(\*\) AS n FROM \w+ GROUP BY 1", query)
        if grouped:
            counts: dict[int, int] = {}
            for row in rows:
                key = int(row[grouped.group(1)])
                counts[key] = counts.get(key, 0) + 1
            found = [{grouped.group(1): k, "n": v} for k, v in sorted(counts.items())]
            return httpx.Response(200, json={"rows": found})
        if query.startswith("SELECT count(*)"):
            extra = self.count_offset if join else 0
            return httpx.Response(200, json={"rows": [{"n": len(rows) + extra}]})
        if not join:
            after = re.search(r"cartodb_id > (\d+)", query)
            limit = int(re.search(r"LIMIT (\d+)", query).group(1))
            if after:
                rows = [row for row in rows if row["cartodb_id"] > int(after.group(1))]
            rows = rows[:limit]
        select = query[len("SELECT ") : query.index(" FROM ")]
        names = re.findall(r" AS (\w+)", select)
        buffer = io.StringIO()
        writer = csv.writer(buffer, lineterminator="\n")
        writer.writerow(names)
        for row in rows:
            values = []
            for name in names:
                value = row["cartodb_id"] if name == "_key" else row.get(name)
                values.append("" if value is None else value)
            writer.writerow(values)
        return httpx.Response(200, text=buffer.getvalue(), headers={"content-type": "text/csv"})


def hex_wkb(geometry: Any) -> str:
    return shapely.to_wkb(geometry, flavor="iso", hex=True)


@dataclass
class FakeArcgis:
    """One ArcGIS feature layer: layer description, count, and offset paging as GeoJSON."""

    fields: list[dict[str, str]]
    features: list[dict[str, Any]]
    max_records: int = 2
    errors_before_success: int = 0
    error_code: int = 400
    geometry_type: str = "esriGeometryPolygon"
    requests: list[httpx.Request] = field(default_factory=list)

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.errors_before_success > 0:
            self.errors_before_success -= 1
            return httpx.Response(
                200, json={"error": {"code": self.error_code, "message": "Invalid URL"}}
            )
        params = request.url.params
        if not request.url.path.endswith("/query"):
            return httpx.Response(
                200,
                json={
                    "objectIdField": next(
                        (f["name"] for f in self.fields if f["type"] == "esriFieldTypeOID"),
                        "objectid",
                    ),
                    "maxRecordCount": self.max_records,
                    "geometryType": self.geometry_type,
                    "fields": self.fields,
                    "editingInfo": {"dataLastEditDate": 1790523183650},
                },
            )
        if params.get("returnCountOnly") == "true":
            return httpx.Response(200, json={"count": len(self.features)})
        offset = int(params["resultOffset"])
        count = int(params["resultRecordCount"])
        page = self.features[offset : offset + count]
        if params.get("outFields", "*") != "*":
            wanted = params["outFields"].split(",")
            page = [
                {**f, "properties": {k: v for k, v in f["properties"].items() if k in wanted}}
                for f in page
            ]
        more = offset + count < len(self.features)
        body = {
            "type": "FeatureCollection",
            "features": page,
            "properties": {"exceededTransferLimit": True} if more else {},
        }
        return httpx.Response(200, json=body)


def arcgis_feature(properties: dict[str, Any], geometry: Any) -> dict[str, Any]:
    return {
        "type": "Feature",
        "id": properties.get("objectid"),
        "properties": properties,
        "geometry": mapping(geometry) if geometry is not None else None,
    }


class Router:
    """Send each request to the fake server registered for its host."""

    def __init__(self, **hosts: Callable[[httpx.Request], httpx.Response]):
        self.hosts = hosts

    def __call__(self, request: httpx.Request) -> httpx.Response:
        handler = self.hosts.get(request.url.host.replace(".", "_"))
        if handler is None:
            raise AssertionError(f"unexpected request to {request.url}")
        return handler(request)


# Contexts
def make_context(
    repo_root: Path,
    cache_root: Path,
    *,
    handler: Callable[[httpx.Request], httpx.Response] | None = None,
    now: datetime | None = None,
    offline: bool = False,
) -> Context:
    settings = Settings(
        repo_root=repo_root,
        cache_root=cache_root,
        offline=offline,
        keep_snapshots=3,
        duckdb_memory_limit="512MB",
        duckdb_threads=2,
        fixed_now=now or datetime(2026, 10, 4, 15, 0, 0, tzinfo=UTC),
    )
    registry = load_registry(settings.registry_dir, repo_root=repo_root)

    def factory() -> PoliteClient:
        transport = httpx.MockTransport(handler or (lambda request: httpx.Response(599)))
        return PoliteClient(
            transport=transport, sleep=lambda seconds: None, min_interval=0, max_attempts=3
        )

    return Context(settings, registry, http_factory=factory)


@pytest.fixture
def context_factory(tmp_path: Path) -> Callable[..., Context]:
    def build(**kwargs: Any) -> Context:
        return make_context(kwargs.pop("repo_root", REPO_ROOT), tmp_path / "cache", **kwargs)

    return build


def install_snapshot(
    ctx,
    source_id: str,
    table: pa.Table,
    *,
    geometry: bool,
    fetched_at: str,
    result: str = "ok",
    message: str | None = None,
    geometry_types: list[str] | None = None,
    recipe: str | None = None,
) -> None:
    """Put a good snapshot in the cache, as a successful run would have."""
    store = SnapshotStore(ctx.cache, source_id)
    snapshot_id = fetched_at.replace("-", "").replace(":", "")
    path = store.snapshot_path(snapshot_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    if geometry:
        write_geoparquet(table, path, geometry_types or ["Polygon"])
    else:
        pq.write_table(table, path)
    meta = SnapshotMeta(
        source=source_id,
        snapshot_id=snapshot_id,
        file=path.name,
        format="geoparquet" if geometry else "parquet",
        fetched_at=fetched_at,
        rows=table.num_rows,
        sha256="x",
        bytes=path.stat().st_size,
        newest_record="2026-09-27",
        status="good",
        recipe=recipe,
    )
    store.record(meta)
    store.promote(meta)
    state = store.state()
    state.current = snapshot_id
    state.last_attempt = "2026-10-04T14:00:00Z"
    state.last_result = result
    state.message = message
    store.save_state(state)


def load_fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))
