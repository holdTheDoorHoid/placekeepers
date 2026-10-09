"""The 1937 redlining map (owner, 2026-10-09): Mapping Inequality's areas and grades, under a non
commercial license, kept in a file of its own. Nothing else the site publishes may carry its data,
the manifest says which license that file is under, and the registry keeps such a layer alone."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely.geometry import MultiPolygon, box

from placekeepers.publish import publish
from placekeepers.publish.manifest import non_commercial_files
from placekeepers.registry import load_registry
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import REPO_ROOT, install_snapshot
from .test_dossiers import install_everything
from .test_registry import by_id, edit, problems

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
#: A label and a corner no other fixture uses, to find the redlining data wherever it might leak.
MARK_LABEL = "Q77"
MARK_LNG, MARK_LAT = -75.123987, 39.987321


def holc_file() -> dict[str, Any]:
    """Philadelphia's file as Mapping Inequality serves it, with the extra fields it carries and a
    long text field standing in for anything we must never keep."""

    def area(area_id: int, label: str, grade: str | None, lng: float) -> dict[str, Any]:
        shape = MultiPolygon([box(lng, MARK_LAT, lng + 0.004, MARK_LAT + 0.003)])
        return {
            "type": "Feature",
            "properties": {
                "area_id": area_id,
                "city_id": 138,
                "grade": grade,
                "fill": "#76a865",
                "label": label,
                "name": " ",
                "bounds": "[[40.0956, -75.13626], [40.12549, -75.09314]]",
                "residential": True,
                "area_description_data": "A 1937 description that must never be kept",
            },
            "geometry": shapely.geometry.mapping(shape),
        }

    return {
        "type": "FeatureCollection",
        "features": [
            area(1, MARK_LABEL, "D", MARK_LNG),
            area(2, "A1", "A", -75.2),
            area(3, "Industrial and Commercial", None, -75.18),
        ],
    }


def holc_table() -> pa.Table:
    shapes = [
        box(MARK_LNG, MARK_LAT, MARK_LNG + 0.004, MARK_LAT + 0.003),
        box(-75.2, 39.98, -75.196, 39.983),
    ]
    return pa.table(
        {
            "area_id": pa.array([1, 2], pa.int32()),
            "grade": ["D", "A"],
            "label": [MARK_LABEL, "A1"],
            "geometry": [shapely.to_wkb(MultiPolygon([s]), flavor="iso") for s in shapes],
        }
    )


def test_the_registry_holds_the_map_under_its_own_terms() -> None:
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    source = registry.sources["mapping_inequality_1937"]
    license_ = registry.licenses[source.license]
    assert license_.non_commercial and license_.url.endswith("/by-nc/2.5/")
    assert "Mapping Inequality" in source.attribution and "CC BY-NC 2.5" in source.attribution
    layer = registry.layers["redlining_1937"]
    assert (layer.file, layer.source_layer, layer.group) == (
        "tiles/redlining.pmtiles",
        "holc",
        "then_and_now",
    )
    assert layer.default.field is False and layer.default.analysis is False
    # Every other source is under terms that allow commercial reuse.
    assert [
        s.id for s in registry.sources.values() if registry.licenses[s.license].non_commercial
    ] == ["mapping_inequality_1937"]
    assert non_commercial_files(registry) == {
        "tiles/redlining.pmtiles": "cc_by_nc_2_5",
        "tiles/redlining.holc.geojson": "cc_by_nc_2_5",
    }


def test_a_non_commercial_layer_stays_alone(repo_copy: Path) -> None:
    def change(layers: list[dict[str, Any]]) -> None:
        by_id(layers, "redlining_1937")["sources"].append("census_tracts_2020")
        by_id(layers, "hin_2025").update(file="tiles/redlining.pmtiles")

    edit(repo_copy, "layers", change)
    found = problems(repo_copy)
    assert any("redlining_1937" in p and "it can draw no other kind" in p for p in found)
    assert any("redlining_1937" in p and "no other layer may share its file" in p for p in found)


def test_only_the_label_grade_and_shape_are_kept(context_factory) -> None:
    def server(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "dsl.richmond.edu"
        assert request.headers["user-agent"].startswith("Placekeepers/")
        return httpx.Response(200, json=holc_file())

    ctx = context_factory(handler=server, now=NOW)
    source = ctx.registry.sources["mapping_inequality_1937"]
    source = source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    store = SnapshotStore(ctx.cache, source.id)
    table = pq.read_table(store.path_for(store.current()))
    assert sorted(table.column_names) == ["area_id", "geometry", "grade", "label"]
    assert table.column("grade").to_pylist() == ["D", "A", None]
    kept = b"".join(p.read_bytes() for p in ctx.cache.root.rglob("*") if p.is_file())
    assert b"must never be kept" not in kept


def test_nothing_else_published_carries_its_data(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    install_snapshot(
        ctx,
        "mapping_inequality_1937",
        holc_table(),
        geometry=True,
        fetched_at="2026-10-04T14:00:00Z",
        geometry_types=["MultiPolygon"],
    )
    out = tmp_path / "data"
    result = publish(ctx, out)

    own = "tiles/redlining.holc.geojson"
    features = json.loads((out / own).read_text())["features"]
    assert [f["properties"] for f in features] == [
        {"l": "A1", "g": "A"},
        {"l": MARK_LABEL, "g": "D"},
    ]
    # The manifest says which license the file is under; every other file carries none.
    files = result.manifest["files"]
    assert files[own]["license"] == "cc_by_nc_2_5"
    assert [name for name, entry in files.items() if "license" in entry] == [own]
    # No other published file (dossiers, tables, other layers, the manifest's own notes aside)
    # holds its labels or shapes.
    marks = [MARK_LABEL, f"{MARK_LNG:.5f}", f"{MARK_LAT:.5f}", f"{MARK_LNG + 0.004:.5f}"]
    others = [p for p in out.rglob("*") if p.is_file() and p.relative_to(out).as_posix() != own]
    assert len(others) > 10
    for path in others:
        text = path.read_bytes().decode("utf-8", errors="ignore")
        name = path.relative_to(out).as_posix()
        if name == "manifest.json":
            text = json.dumps({k: v for k, v in json.loads(text).items() if k != "notes"})
        for mark in marks:
            assert mark not in text, f"{name} holds redlining data ({mark})"
