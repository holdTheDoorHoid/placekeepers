"""The base map is a registry layer so it has a switch on the map, but the site makes its file
(web/scripts/make-basemap.sh), so publishing leaves it alone (docs/CONTRACTS.md section 2)."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from placekeepers.publish import BASEMAP_DIR, publish


def test_the_base_map_layer_is_left_to_the_site(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=datetime(2026, 10, 4, 15, 0, tzinfo=UTC))
    base = [
        layer
        for layer in ctx.registry.layers.values()
        if layer.file and layer.file.startswith(BASEMAP_DIR)
    ]
    assert [layer.id for layer in base] == ["basemap"]
    result = publish(ctx, tmp_path / "data")
    # Listed with the other layers, but never built here and never called "not built yet".
    assert result.manifest["layers"]["basemap"]["file"] == "basemap/philly.pmtiles"
    assert not any(note.startswith("basemap ") for note in result.manifest["notes"])
    assert not any(name.startswith(BASEMAP_DIR) for name in result.manifest["files"])
