"""Publishing: manifest.json matches docs/CONTRACTS.md, layers carry the contract's properties,
and tiles are built with tippecanoe when it is installed, or left as GeoJSON when it is not."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import stat
from datetime import UTC, date, datetime
from pathlib import Path

import pyarrow as pa
import pytest
import shapely
from shapely.geometry import MultiLineString, Point, box

from placekeepers.cli import main
from placekeepers.publish import PublishError, publish
from placekeepers.publish.tiles import pmtiles_layer_names, tippecanoe_command

from .conftest import REPO_ROOT, install_snapshot

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
SOURCE_KEYS = {
    "status",
    "last_attempt",
    "last_success",
    "stale_since",
    "rows",
    "newest_record",
    "message",
}


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


@pytest.fixture
def ctx(context_factory):
    ctx = context_factory(now=NOW)
    land = pa.table(
        {
            "opa_id": ["370000001", "370000002", None],
            "bldg_desc": ["VAC LAND RES < ACRE", "VAC LAND RES < ACRE", "VAC LAND RES < ACRE"],
            "geometry": [
                wkb(box(-75.15, 39.99, -75.149, 39.991)),
                wkb(box(-75.16, 39.99, -75.159, 39.991)),
                wkb(box(-75.17, 39.99, -75.169, 39.991)),
            ],
        }
    )
    bldg = pa.table(
        {
            "opa_id": ["370000002", "380000003"],
            "bldg_desc": ["VAC LAND RES < ACRE", "ROW 2 STY MASONRY"],
            "geometry": [
                wkb(box(-75.16, 39.99, -75.159, 39.991)),
                wkb(box(-75.18, 39.99, -75.179, 39.991)),
            ],
        }
    )
    hin = pa.table(
        {
            "objectid": [2, 1],
            "stname": ["12TH", "10TH"],
            "length_ft": [8041.6, 3219.86],
            "geometry": [
                wkb(MultiLineString([[(-75.157, 39.963), (-75.157, 39.964)]])),
                wkb(MultiLineString([[(-75.155, 39.955), (-75.155, 39.956)]])),
            ],
        }
    )
    shootings = pa.table(
        {
            "objectid": [1, 2],
            "date_": pa.array([date(2026, 9, 1), date(2024, 1, 1)], pa.date32()),
            "fatal": pa.array([0, 1], pa.int16()),
            "lat": [39.9526, 39.9526],
            "lng": [-75.1636, -75.1636],
        }
    )
    install_snapshot(
        ctx, "vacant_indicators_land", land, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )
    install_snapshot(
        ctx, "vacant_indicators_bldg", bldg, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )
    install_snapshot(
        ctx, "high_injury_network", hin, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )
    install_snapshot(
        ctx,
        "shootings",
        shootings,
        geometry=False,
        fetched_at="2026-09-27T14:00:00Z",
        result="rejected",
        message="Rows fell from 17,973 to 900 (95% fewer), more than the 5% allowed",
    )
    return ctx


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text())["features"]


def test_the_manifest_matches_the_contract(ctx, tmp_path: Path) -> None:
    out = tmp_path / "build" / "data"
    result = publish(ctx, out)
    manifest = json.loads((out / "manifest.json").read_text())
    assert manifest == result.manifest

    assert set(manifest) == {
        "schema",
        "build_id",
        "generated_at",
        "sources",
        "layers",
        "files",
        "dossiers",
        "notes",
    }
    # No OPA snapshot here, so no lot dossiers (docs/CONTRACTS.md section 3).
    assert manifest["dossiers"] is None
    assert manifest["schema"] == 1
    assert re.fullmatch(r"2026-10-04T15-00-00Z-\w+", manifest["build_id"])
    assert manifest["generated_at"] == "2026-10-04T15:00:00Z"

    assert list(manifest["sources"]) == list(ctx.registry.sources)
    for entry in manifest["sources"].values():
        assert set(entry) == SOURCE_KEYS
        assert entry["status"] in {"ok", "stale", "failing", "missing"}
    assert manifest["sources"]["vacant_indicators_land"]["status"] == "ok"
    assert manifest["sources"]["shootings"] == {
        "status": "stale",
        "last_attempt": "2026-10-04T14:00:00Z",
        "last_success": "2026-09-27T14:00:00Z",
        "stale_since": "2026-09-27",
        "rows": 2,
        "newest_record": "2026-09-27",
        "message": "Rows fell from 17,973 to 900 (95% fewer), more than the 5% allowed",
    }
    assert manifest["sources"]["opa_properties"] == {
        "status": "missing",
        "last_attempt": None,
        "last_success": None,
        "stale_since": None,
        "rows": None,
        "newest_record": None,
        "message": "Not fetched yet",
    }

    assert manifest["layers"] == {
        layer.id: {
            "file": layer.file,
            "source_layer": layer.source_layer,
            "sources": list(layer.sources),
        }
        for layer in ctx.registry.layers.values()
    }

    on_disk = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    assert sorted([*manifest["files"], "manifest.json"]) == on_disk
    for name, entry in manifest["files"].items():
        data = (out / name).read_bytes()
        assert entry == {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def test_without_tippecanoe_the_layers_stay_geojson(ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    result = publish(ctx, out)
    assert "tiles skipped: tippecanoe not installed" in result.manifest["notes"]
    assert sorted(result.manifest["files"]) == [
        "tiles/context.h3.geojson",
        "tiles/lots.parcels.geojson",
        "tiles/streets.hin.geojson",
    ]
    assert result.tiles_built == []


def test_parcels_carry_the_contract_properties(ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    result = publish(ctx, out)
    parcels = features(out / "tiles" / "lots.parcels.geojson")
    assert [list(f["properties"]) for f in parcels] == [["id", "k", "vc", "ot", "lc"]] * 3
    assert [f["properties"] for f in parcels] == [
        {"id": "370000001", "k": 1, "vc": 2, "ot": 0, "lc": 0},
        {"id": "370000002", "k": 1, "vc": 2, "ot": 0, "lc": 0},  # on both lists, vacant land
        {"id": "380000003", "k": 2, "vc": 2, "ot": 0, "lc": 0},
    ]
    assert (
        "1 vacancy indicator features have no OPA account number and are not shown"
        in (result.manifest["notes"])
    )
    assert (
        "1 parcels are on both City vacancy lists: 1 shown as lots because the City describes "
        "them as vacant land, 0 as buildings"
    ) in result.manifest["notes"]


def test_streets_and_context_carry_the_contract_properties(ctx, tmp_path: Path) -> None:
    out = tmp_path / "data"
    publish(ctx, out)
    hin = features(out / "tiles" / "streets.hin.geojson")
    assert [f["properties"] for f in hin] == [
        {"id": 1, "name": "10TH", "len": 3220},
        {"id": 2, "name": "12TH", "len": 8042},
    ]
    assert hin[0]["geometry"]["type"] == "MultiLineString"
    [cell] = features(out / "tiles" / "context.h3.geojson")
    assert set(cell["properties"]) == {"h", "s12", "s36"}
    assert (cell["properties"]["s12"], cell["properties"]["s36"]) == (1, 2)


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe is not installed")
def test_with_tippecanoe_each_tile_file_has_its_contract_layer(ctx, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("PK_TIPPECANOE", "tippecanoe")
    out = tmp_path / "data"
    result = publish(ctx, out)
    assert sorted(result.tiles_built) == [
        "tiles/context.pmtiles",
        "tiles/lots.pmtiles",
        "tiles/streets.pmtiles",
    ]
    assert sorted(result.manifest["files"]) == sorted(result.tiles_built)
    assert pmtiles_layer_names(out / "tiles" / "lots.pmtiles") == ["parcels"]
    assert pmtiles_layer_names(out / "tiles" / "streets.pmtiles") == ["hin"]
    assert pmtiles_layer_names(out / "tiles" / "context.pmtiles") == ["h3"]
    assert not any(note.startswith("tiles") for note in result.manifest["notes"])


def test_a_failing_tippecanoe_keeps_the_geojson(ctx, tmp_path, monkeypatch) -> None:
    fake = tmp_path / "bin" / "tippecanoe"
    fake.parent.mkdir()
    fake.write_text("#!/bin/sh\necho 'cannot open input' >&2\nexit 1\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)
    monkeypatch.setenv("PK_TIPPECANOE", str(fake))
    result = publish(ctx, tmp_path / "data")
    assert result.tiles_built == []
    assert any(
        note.startswith("tiles failed for tiles/lots.pmtiles, GeoJSON kept: tippecanoe failed")
        for note in result.manifest["notes"]
    )
    assert "tiles/lots.parcels.geojson" in result.manifest["files"]


def test_the_tippecanoe_command_names_each_layer() -> None:
    command = tippecanoe_command(
        "tippecanoe",
        Path("out/lots.pmtiles"),
        "tiles/lots.pmtiles",
        [("parcels", Path("lots.parcels.geojson"))],
        "City & PHS",
    )
    assert command[:3] == ["tippecanoe", "--output", "out/lots.pmtiles"]
    assert command[-2:] == ["--named-layer", "parcels:lots.parcels.geojson"]
    assert "City &amp; PHS" in command


def test_publish_replaces_an_earlier_build_but_never_a_foreign_folder(ctx, tmp_path) -> None:
    out = tmp_path / "data"
    publish(ctx, out)
    (out / "tiles" / "old.geojson").write_text("{}")
    publish(ctx, out)
    assert not (out / "tiles" / "old.geojson").exists()

    foreign = tmp_path / "Desktop"
    foreign.mkdir()
    (foreign / "notes.txt").write_text("mine")
    with pytest.raises(PublishError, match="Refusing to replace"):
        publish(ctx, foreign)
    assert (foreign / "notes.txt").read_text() == "mine"
    assert sorted(p.name for p in tmp_path.iterdir() if p.name.startswith(".")) == []


def test_pk_all_offline_publishes_from_the_cache(ctx, tmp_path, capsys) -> None:
    out = tmp_path / "out"
    code = main(
        [
            "all",
            "--offline",
            "--cache",
            str(ctx.settings.cache_root),
            "--out",
            str(out),
            "--as-of",
            "2026-10-04",
        ]
    )
    assert code == 0
    printed = capsys.readouterr().out
    assert "Offline: using only what is already in the cache." in printed
    assert "shootings" in printed and "stale" in printed
    manifest = json.loads((out / "manifest.json").read_text())
    assert manifest["sources"]["high_injury_network"]["status"] == "ok"

    assert main(["health", "--json", "--cache", str(ctx.settings.cache_root)]) == 0
    health = json.loads(capsys.readouterr().out)
    assert health["shootings"]["status"] == "stale"
    assert health["shootings"]["consecutive_failures"] == 0
    assert main(["health", "--strict", "--cache", str(ctx.settings.cache_root)]) == 1
    assert REPO_ROOT.is_dir()


@pytest.fixture
def care_ctx(ctx):
    """The lots fixture plus care and boundary sources."""
    shapes = [box(-75.15 + n / 100, 39.99, -75.149 + n / 100, 39.991) for n in range(3)]
    points = [Point(-75.15 + n / 100, 39.99) for n in range(3)]
    when = "2026-10-04T14:00:00Z"
    install_snapshot(
        ctx,
        "phs_landcare",
        pa.table(
            {
                "brt_id": ["370000001", None, "12"],
                "program": ["PLC", "CLC", "LandBank"],
                "year": ["2022", " ", None],
                "geometry": [wkb(s) for s in shapes],
            }
        ),
        geometry=True,
        fetched_at=when,
    )
    install_snapshot(
        ctx,
        "gardens_phs_ngt",
        pa.table(
            {
                "site_name": ["Farm on Florence", "Penn Park Farm"],
                "supported": ["PHS and NGT", "NGT"],
                "website": [None, "https://example.org/farm"],
                "geometry": [wkb(p) for p in points[:2]],
            }
        ),
        geometry=True,
        fetched_at=when,
        geometry_types=["Point"],
    )
    install_snapshot(
        ctx,
        "gardens_registered",
        pa.table(
            {
                "garden_name": ["Tiny Garden"],
                "contact_website": [""],
                "geometry": [wkb(points[2])],
            }
        ),
        geometry=True,
        fetched_at=when,
        geometry_types=["Point"],
    )
    install_snapshot(
        ctx,
        "council_districts",
        pa.table({"district": ["5", "1"], "geometry": [wkb(s) for s in shapes[:2]]}),
        geometry=True,
        fetched_at=when,
    )
    install_snapshot(
        ctx,
        "community_organizations",
        pa.table(
            {
                "lni_id": [77, 78],
                "organization_name": ["Girard Estate Neighbors", "Ward 5"],
                "org_type": ["Other", None],
                "websites": ["https://example.org/ge", None],
                "geometry": [wkb(s) for s in shapes[:2]],
            }
        ),
        geometry=True,
        fetched_at=when,
    )
    install_snapshot(
        ctx,
        "neighborhoods",
        pa.table(
            {
                "name": ["BRIDESBURG"],
                "listname": ["Bridesburg"],
                "geometry": [wkb(shapes[0])],
            }
        ),
        geometry=True,
        fetched_at=when,
    )
    return ctx


def test_care_and_boundary_layers_carry_the_contract_properties(care_ctx, tmp_path) -> None:
    out = tmp_path / "data"
    result = publish(care_ctx, out)
    tiles = out / "tiles"
    assert [f["properties"] for f in features(tiles / "care.landcare.geojson")] == [
        {"id": "370000001", "p": 1, "y": 2022},
        {"id": "", "p": 2, "y": 0},
        {"id": "", "p": 3, "y": 0},
    ]
    assert [f["properties"] for f in features(tiles / "care.gardens.geojson")] == [
        {"nm": "Farm on Florence", "src": 3},
        {"nm": "Penn Park Farm", "src": 2, "w": "https://example.org/farm"},
        {"nm": "Tiny Garden", "src": 4},
    ]
    assert [f["properties"] for f in features(tiles / "boundaries.council_districts.geojson")] == [
        {"d": 5, "nm": "District 5"},
        {"d": 1, "nm": "District 1"},
    ]
    assert [f["properties"] for f in features(tiles / "boundaries.rcos.geojson")] == [
        {"id": 77, "nm": "Girard Estate Neighbors", "t": "Other", "w": "https://example.org/ge"},
        {"id": 78, "nm": "Ward 5"},
    ]
    assert [f["properties"] for f in features(tiles / "boundaries.neighborhoods.geojson")] == [
        {"id": "BRIDESBURG", "nm": "Bridesburg"}
    ]
    parcels = {
        f["properties"]["id"]: f["properties"]["lc"]
        for f in features(tiles / "lots.parcels.geojson")
    }
    assert parcels == {"370000001": 1, "370000002": 0, "380000003": 0}
    assert result.features["tiles/care.pmtiles gardens"] == 3


@pytest.mark.skipif(shutil.which("tippecanoe") is None, reason="tippecanoe is not installed")
def test_care_and_boundary_tiles_have_their_layers(care_ctx, tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("PK_TIPPECANOE", "tippecanoe")
    out = tmp_path / "data"
    result = publish(care_ctx, out)
    assert sorted(result.tiles_built) == [
        "tiles/boundaries.pmtiles",
        "tiles/care.pmtiles",
        "tiles/context.pmtiles",
        "tiles/lots.pmtiles",
        "tiles/streets.pmtiles",
    ]
    assert pmtiles_layer_names(out / "tiles" / "care.pmtiles") == ["gardens", "landcare"]
    assert pmtiles_layer_names(out / "tiles" / "boundaries.pmtiles") == [
        "council_districts",
        "neighborhoods",
        "rcos",
    ]
