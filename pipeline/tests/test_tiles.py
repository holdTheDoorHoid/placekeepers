"""Picture services the browser loads from the City (M4.3): the registry form for an outside tile
service and its raster layers, the weekly check that each service still answers, and how a
broken service reaches the Data status page."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pyarrow.parquet as pq
import pytest

from placekeepers.adapters.tiles import ArcgisTilesAdapter, describe_tiling, tile_at
from placekeepers.health import source_status
from placekeepers.publish import publish
from placekeepers.registry import ArcgisTilesEndpoint, load_registry
from placekeepers.runner import fetch_source, refetch_due, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import REPO_ROOT
from .test_registry import by_id, edit, problems

ROOT = "/tiles/fLeGjb7u4uXqeF9q/arcgis/rest/services/"


def service_info(*, wkid: int = 102100, rows: int = 256, deepest: int = 22) -> dict[str, Any]:
    return {
        "singleFusedMapCache": True,
        "tileInfo": {
            "rows": rows,
            "cols": rows,
            "format": "JPEG",
            "spatialReference": {"wkid": wkid, "latestWkid": 3857},
            "lods": [{"level": level} for level in range(deepest + 1)],
        },
    }


class FakeTiles:
    """The City's tile server: each service answers its description and its tiles, unless told
    to send an error, the wrong projection or no picture."""

    def __init__(self, broken: dict[str, str] | None = None):
        self.broken = broken or {}
        self.requests: list[httpx.Request] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.url.host == "tiles.arcgis.com"
        assert request.headers["user-agent"].startswith("Placekeepers/")
        path = request.url.path
        assert path.startswith(ROOT)
        service, _, rest = path[len(ROOT) :].partition("/MapServer")
        trouble = self.broken.get(service)
        if rest == "":
            if trouble == "gone":
                return httpx.Response(
                    200,
                    json={"error": {"code": 404, "message": "Requested Service not available."}},
                )
            if trouble == "login":
                return httpx.Response(
                    200, json={"error": {"code": 499, "message": "Token Required"}}
                )
            if trouble == "projection":
                info = service_info()
                info["tileInfo"]["spatialReference"] = {"wkid": 2272, "latestWkid": 2272}
                return httpx.Response(200, json=info)
            return httpx.Response(200, json=service_info())
        assert rest.startswith("/tile/15/")
        if trouble == "no_picture":
            return httpx.Response(
                200, text="<html>busy</html>", headers={"content-type": "text/html"}
            )
        return httpx.Response(200, content=b"\xff\xd8jpeg", headers={"content-type": "image/jpeg"})


def run_check(ctx, source_id: str) -> tuple[str, str]:
    fetched = fetch_source(ctx, ctx.registry.sources[source_id])
    validated = validate_source(ctx, ctx.registry.sources[source_id])
    return fetched.outcome, validated.outcome


# The registry ---------------------------------------------------------------------------------


def test_the_real_registry_has_the_city_picture_services() -> None:
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    photos = registry.sources["city_aerial_photos"].endpoint
    assert isinstance(photos, ArcgisTilesEndpoint)
    years = [service.key for service in photos.services]
    assert years[0] == "1996" and years[-1] == "2025" and len(years) == 20
    assert years == sorted(years)
    layer = registry.layers["aerial_photos"]
    assert layer.external and layer.file is None and layer.source_layer is None
    year = next(setting for setting in layer.settings if setting.id == "year")
    assert year.control == "slider" and year.default == "2025"
    atlas = registry.layers["atlas_1860"]
    assert atlas.external and registry.sources["city_atlas_1860"].endpoint.services[0].key == "1860"
    # Off by default in both views: nothing is asked of the City's picture servers until someone
    # turns a layer on.
    for layer_id in ("aerial_photos", "atlas_1860"):
        assert registry.layers[layer_id].default.field is False
        assert registry.layers[layer_id].default.analysis is False


def test_a_raster_layer_has_no_file(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "aerial_photos").update(
            file="tiles/photos.pmtiles", source_layer="photos"
        ),
    )
    [problem] = problems(repo_copy)
    assert "aerial_photos" in problem and "a raster layer has no file or source_layer" in problem


def test_a_vector_layer_needs_a_file_and_never_draws_a_tile_service(repo_copy: Path) -> None:
    def change(layers: list[dict[str, Any]]) -> None:
        by_id(layers, "hin_2025").pop("file")
        by_id(layers, "shootings_hex").update(sources=["shootings", "city_atlas_1860"])

    edit(repo_copy, "layers", change)
    found = problems(repo_copy)
    assert any(
        "hin_2025" in p and "a line layer needs a file and a source_layer" in p for p in found
    )
    assert any(
        "shootings_hex" in p
        and "'city_atlas_1860' is a tile service, which only a raster layer" in p
        for p in found
    )


def test_the_year_setting_names_the_services_in_order(repo_copy: Path) -> None:
    def swap(layers: list[dict[str, Any]]) -> None:
        options = next(s for s in by_id(layers, "aerial_photos")["settings"] if s["id"] == "year")[
            "options"
        ]
        options[0], options[1] = options[1], options[0]

    edit(repo_copy, "layers", swap)
    [problem] = problems(repo_copy)
    assert "the 'year' options" in problem and "service keys in the same order" in problem

    def drop(layers: list[dict[str, Any]]) -> None:
        layer = by_id(layers, "aerial_photos")
        layer["settings"] = [s for s in layer["settings"] if s["id"] != "year"]

    edit(repo_copy, "layers", drop)
    [problem] = problems(repo_copy)
    assert "needs a choice setting 'year'" in problem


def test_a_raster_layer_draws_exactly_one_tile_service(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "atlas_1860").update(sources=["city_atlas_1860", "shootings"]),
    )
    [problem] = problems(repo_copy)
    assert "atlas_1860" in problem and "exactly one source of kind arcgis_tiles" in problem


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda e: e.update(bounds=[-75.0, 39.9, -75.2, 40.0]), "west below east"),
        (lambda e: e.update(bounds=[-75.0, 39.9]), "at least 4 items"),
        (lambda e: e["services"].append(dict(e["services"][0])), "service keys repeat"),
        (lambda e: e.update(url="http://example.org/rest/services"), "does not match"),
        (lambda e: e["services"][0].update(key="19 96"), "does not match"),
    ],
)
def test_tile_endpoint_mistakes_fail(repo_copy: Path, change, message: str) -> None:
    edit(
        repo_copy, "sources", lambda sources: change(by_id(sources, "city_atlas_1860")["endpoint"])
    )
    found = problems(repo_copy)
    assert any("city_atlas_1860" in p and message in p for p in found), found


def test_a_slider_is_only_for_a_choice(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "atlas_1860")["settings"][0].update(control="slider"),
    )
    [problem] = problems(repo_copy)
    assert "a range setting cannot have control" in problem


# The weekly check ---------------------------------------------------------------------------


def test_tiles_are_found_by_web_mercator_column_and_row() -> None:
    # 2647 N 6th St at zoom 15: the City's server answered tile 15/12406/9544 (row, then column)
    # with its photo of that block on 2026-10-09.
    assert tile_at(-75.142037, 39.991917, 15) == (15, 9544, 12406)
    assert describe_tiling(service_info())[1] is None
    state_plane = service_info()
    state_plane["tileInfo"]["spatialReference"] = {"wkid": 2272, "latestWkid": 2272}
    assert (
        describe_tiling(state_plane)[1]
        == "Its tiles are not in Web Mercator (spatial reference 2272)"
    )
    assert describe_tiling(service_info(rows=512))[1] == "Its tiles are 512 by 512 pixels, not 256"
    assert describe_tiling(service_info(deepest=18))[1].startswith(
        "It serves zoom levels only to 18"
    )
    assert describe_tiling({})[1] == "It does not serve cached tiles"


def test_every_service_that_answers_makes_a_good_snapshot(context_factory) -> None:
    server = FakeTiles()
    ctx = context_factory(handler=server)
    assert run_check(ctx, "city_aerial_photos") == ("downloaded", "ok")
    store = SnapshotStore(ctx.cache, "city_aerial_photos")
    rows = pq.read_table(store.path_for(store.current())).to_pylist()
    assert [row["key"] for row in rows][:3] == ["1996", "2000", "2004"]
    assert all(row["ok"] and row["deepest_zoom"] == 22 for row in rows)
    # Two small requests per service: its description and one tile in the middle of the city.
    assert len(server.requests) == 2 * len(rows)
    tiles = [r.url.path for r in server.requests if "/tile/" in r.url.path]
    z, x, y = tile_at(-75.12, 40.0, 15)
    assert tiles[0] == f"{ROOT}CityImagery_1996_6in/MapServer/tile/{z}/{y}/{x}"
    # Nothing but descriptions and one tile each: no picture is ever kept.
    kept = [p for p in ctx.cache.root.rglob("*") if p.is_file()]
    assert kept and not any(p.read_bytes().startswith(b"\xff\xd8") for p in kept)


@pytest.mark.parametrize(
    ("trouble", "detail"),
    [
        ("gone", "It did not answer: ArcGIS error 404: Requested Service not available."),
        ("login", "ArcGIS asks for a login (error 499: Token Required)"),
        ("projection", "Its tiles are not in Web Mercator (spatial reference 2272)"),
        ("no_picture", "came back as text/html, not a picture"),
    ],
)
def test_a_service_that_stops_answering_makes_the_source_stale(
    context_factory, trouble: str, detail: str
) -> None:
    good = context_factory(handler=FakeTiles(), now=datetime(2026, 10, 5, 10, 0, tzinfo=UTC))
    assert run_check(good, "city_aerial_photos") == ("downloaded", "ok")

    later = context_factory(
        handler=FakeTiles({"CityImagery_2023": trouble}),
        now=datetime(2026, 10, 12, 10, 0, tzinfo=UTC),
    )
    assert run_check(later, "city_aerial_photos") == ("downloaded", "rejected")
    status = source_status(
        "city_aerial_photos",
        SnapshotStore(later.cache, "city_aerial_photos"),
        has_adapter=True,
    )
    # The Data status page says so, and the weekly refresh opens an issue after two in a row.
    assert status.status == "stale" and status.stale_since == "2026-10-05"
    assert status.consecutive_failures == 1
    assert "Not every picture service answered: 2023 (CityImagery_2023)" in status.message
    assert detail in status.message


def test_picture_services_are_checked_every_run_even_when_frozen(context_factory) -> None:
    ctx = context_factory(handler=FakeTiles())
    atlas = ctx.registry.sources["city_atlas_1860"]
    assert atlas.cadence == "frozen"
    assert run_check(ctx, "city_atlas_1860") == ("downloaded", "ok")
    assert refetch_due(ctx, atlas) is None
    shootings = ctx.registry.sources["shootings"]
    assert refetch_due(ctx, shootings) is None  # daily sources too, as before


def test_the_atlas_check_asks_for_a_tile_inside_the_atlas(context_factory) -> None:
    server = FakeTiles()
    ctx = context_factory(handler=server)
    adapter = ArcgisTilesAdapter(ctx.registry.sources["city_atlas_1860"], ctx)
    z, x, y = adapter.probe_tile()
    west, south, east, north = ctx.registry.sources["city_atlas_1860"].endpoint.bounds
    assert tile_at(west, north, z)[1:] <= (x, y) <= tile_at(east, south, z)[1:]


# Publishing --------------------------------------------------------------------------------


def test_publish_lists_the_picture_layers_without_files(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=datetime(2026, 10, 4, 15, 0, tzinfo=UTC))
    result = publish(ctx, tmp_path / "data")
    for layer_id, source_id in (
        ("aerial_photos", "city_aerial_photos"),
        ("atlas_1860", "city_atlas_1860"),
    ):
        assert result.manifest["layers"][layer_id] == {
            "file": None,
            "source_layer": None,
            "sources": [source_id],
        }
        assert source_id in result.manifest["sources"]
        # Never "not built yet" or "no usable data": there is nothing to build.
        assert not any(note.startswith(f"{layer_id} ") for note in result.manifest["notes"])
