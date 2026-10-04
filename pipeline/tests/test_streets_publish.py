"""The street safety sources and layers end to end: what the adapters ask for and keep, and what
publish writes into the streets layers. Nothing about a person beyond the date, the mode and the
place may ever reach a snapshot or a tile: no age, sex, case number, arrest or driver details."""

from __future__ import annotations

import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pyarrow.parquet as pq
import pytest
import yaml

from placekeepers.adapters.crashes import (
    COLUMNS,
    Crashes20072017,
    Crashes20162020,
    Crashes20202024,
)
from placekeepers.adapters.curated import MemorialNames
from placekeepers.adapters.fatal_crashes import FatalCrashes
from placekeepers.adapters.street_centerlines import StreetCenterlines
from placekeepers.cache import RawFetch
from placekeepers.publish import publish
from placekeepers.publish.tiles import TILE_OPTIONS, pmtiles_layer_names

from . import streets_fixtures as fx
from .conftest import FakeArcgis, FakeCarto, arcgis_feature, install_snapshot, load_fixture

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
FORBIDDEN = (*FatalCrashes.never_fetch, "age", "sex", "arrest", "hit")
PLACEHOLDERS = ("PLACEHOLDER", '"age"', '"sex"', "dc_number", "arrest", "investigat")


def run(adapter, tmp_path: Path) -> tuple[dict, Path]:
    dest = tmp_path / "raw"
    dest.mkdir()
    info = adapter.fetch(dest)
    raw = RawFetch(
        source=adapter.id,
        fetch_id="x",
        fetched_at="2026-10-04T15:00:00Z",
        files=sorted(p.name for p in dest.iterdir()),
        info=info,
        dir=dest,
    )
    out = tmp_path / "snapshot.parquet"
    adapter.normalize(raw, out)
    return info, out


# The Police fatal crash records ---------------------------------------------------------------
def test_fatal_crashes_never_asks_for_or_keeps_personal_details(context_factory, tmp_path) -> None:
    server = FakeCarto(tables={"fatal_crashes": fx.fatal_rows()})
    ctx = context_factory(handler=server)
    adapter = FatalCrashes(ctx.registry.sources["fatal_crashes"], ctx)
    info, out = run(adapter, tmp_path)
    assert info["rows"] == 6
    for query in server.queries:
        select = query.split(" FROM ")[0].lower()
        for name in FORBIDDEN:
            assert name not in select, query
    table = pq.read_table(out)
    assert table.column_names == [
        "objectid",
        "date_",
        "veh1",
        "veh2",
        "primary_st",
        "secondary_",
        "lat",
        "lng",
    ]
    assert "PLACEHOLDER" not in json.dumps(table.to_pylist(), default=str)
    assert table.column("veh2").to_pylist()[1:3] == ["Bicycle", "Bicyclist"]


# The PennDOT crash slices ---------------------------------------------------------------------
def live_fields(source_id: str) -> list[dict]:
    """The layer's fields as the live service described them (tests/fixtures/arcgis_layers.json)."""
    spec = load_fixture("arcgis_layers.json")[source_id]
    return [{"name": name, "type": f"esriFieldType{kind}"} for name, kind in spec["fields"]]


def slice_server(source_id: str, features: list[dict]) -> FakeArcgis:
    return FakeArcgis(fields=live_fields(source_id), features=features, max_records=2)


def slice_features(adapter_class, rows: list[dict]) -> list[dict]:
    """Rows in our column names, as the slice's own fields would send them, with every other
    field the slice has (such as drivers' age bands) filled in to prove it is not kept."""
    features = []
    for n, row in enumerate(rows, start=1):
        properties = {adapter_class.object_id_field: n, "driver_count_16yr": 1, "DRIVER_COU": 1}
        for column, field in adapter_class.field_map.items():
            properties[field] = row[column]
        features.append(arcgis_feature(properties, fx.point(*row["xy"])))
    return features


def slice_rows() -> list[dict]:
    base = {column: 0 for column in COLUMNS}
    return [
        {**base, "crn": 2024000001, "crash_year": 2024, "crash_month": 7, "xy": (60, 102)},
        {**base, "crn": 2023000002, "crash_year": 2023, "crash_month": 1, "xy": (120, 3)},
    ]


@pytest.mark.parametrize(
    ("adapter_class", "source_id"),
    [
        (Crashes20202024, "crashes_2020_2024"),
        (Crashes20162020, "crashes_2016_2020"),
        (Crashes20072017, "crashes_2007_2017"),
    ],
)
def test_each_slice_is_read_into_the_same_columns(
    adapter_class, source_id, context_factory, tmp_path
) -> None:
    fake = slice_server(source_id, slice_features(adapter_class, slice_rows()))
    ctx = context_factory(handler=fake)
    adapter = adapter_class(ctx.registry.sources[source_id], ctx)
    info, out = run(adapter, tmp_path)
    assert info["rows"] == 2
    table = pq.read_table(out)
    assert table.column_names == [*COLUMNS, "crash_date", "geometry"]
    assert table.column("crn").to_pylist() == [2024000001, 2023000002]
    assert [d.isoformat() for d in table.column("crash_date").to_pylist()] == [
        "2024-07-01",
        "2023-01-01",
    ]
    # Every field the adapter asks for exists in the live layer (saved in the fixture).
    live = {f["name"] for f in live_fields(source_id)}
    assert set(adapter.out_fields) <= live
    pages = [r.url.params for r in fake.requests if "resultOffset" in r.url.params]
    assert pages and all(p["outFields"] == ",".join(adapter.out_fields) for p in pages)
    counts = [r.url.params for r in fake.requests if r.url.params.get("returnCountOnly")]
    assert all(p["where"] == adapter.query_where for p in pages + counts)
    if adapter_class is Crashes20072017:
        assert adapter.query_where == "crash_year = 2015"


def test_street_centerlines_ask_only_for_what_the_lens_needs(context_factory, tmp_path) -> None:
    rows = fx.centerlines().to_pylist()
    features = [
        arcgis_feature(
            {"objectid": n, "seg_id": r["seg_id"], "stname": r["stname"], "class": r["class"]},
            fx.SEGMENTS[n - 1][4],
        )
        for n, r in enumerate(rows, start=1)
    ]
    fields = live_fields("street_centerlines")
    ctx = context_factory(handler=FakeArcgis(fields=fields, features=features, max_records=5))
    adapter = StreetCenterlines(ctx.registry.sources["street_centerlines"], ctx)
    _, out = run(adapter, tmp_path)
    table = pq.read_table(out)
    assert {"seg_id", "stname", "class", "geometry"} <= set(table.column_names)
    assert "zip_left" not in table.column_names
    assert len(table) == 8


# The curated names ----------------------------------------------------------------------------
INVENTED = {
    "id": "m2026_0001",
    "name": "Alex Example",
    "date": "2026-08-20",
    "mode": "walking",
    "lat": fx.lnglat(60, 99)[1],
    "lng": fx.lnglat(60, 99)[0],
    "source": "https://example.org/memorials/alex-example",
}
REMOVED = {
    "id": "m2023_0001",
    "name": "Robin Placeholder",
    "date": "2023-05-05",
    "mode": "cycling",
    "lat": fx.lnglat(240, 60)[1],
    "lng": fx.lnglat(240, 60)[0],
    "source": "https://example.org/memorials/robin-placeholder",
}


def write_curated(repo: Path, memorials: list[dict], suppressed: list) -> None:
    folder = repo / "data" / "curated"
    (folder / "memorials.yaml").write_text(yaml.safe_dump(memorials), encoding="utf-8")
    (folder / "suppressed.yaml").write_text(yaml.safe_dump(suppressed), encoding="utf-8")


def test_the_memorial_names_snapshot_holds_no_names(context_factory, repo_copy, tmp_path) -> None:
    write_curated(repo_copy, [INVENTED, REMOVED], [])
    ctx = context_factory(repo_root=repo_copy)
    adapter = MemorialNames(ctx.registry.sources["memorial_names"], ctx)
    _, out = run(adapter, tmp_path)
    table = pq.read_table(out)
    assert "name" not in table.column_names
    assert table.column("id").to_pylist() == ["m2026_0001", "m2023_0001"]
    text = json.dumps(table.to_pylist(), default=str)
    assert "Alex Example" not in text and "Robin Placeholder" not in text


# Publishing the streets layers ----------------------------------------------------------------
@pytest.fixture
def streets_ctx(context_factory, repo_copy):
    write_curated(repo_copy, [INVENTED, REMOVED], ["m2023_0001"])
    ctx = context_factory(repo_root=repo_copy, now=NOW)
    at = "2026-10-04T14:00:00Z"
    lines, points = ["LineString"], ["Point"]
    install_snapshot(
        ctx,
        "street_centerlines",
        fx.centerlines(),
        geometry=True,
        fetched_at=at,
        geometry_types=lines,
    )
    install_snapshot(
        ctx,
        "high_injury_network",
        fx.high_injury_network(),
        geometry=True,
        fetched_at=at,
        geometry_types=["MultiLineString"],
    )
    for source, table in (
        ("crashes_2020_2024", fx.newest_slice()),
        ("crashes_2016_2020", fx.older_slice()),
        ("crashes_2007_2017", fx.oldest_slice()),
    ):
        install_snapshot(ctx, source, table, geometry=True, fetched_at=at, geometry_types=points)
    install_snapshot(ctx, "fatal_crashes", fx.fatal_table(), geometry=False, fetched_at=at)
    install_snapshot(
        ctx, "schools", fx.schools(), geometry=True, fetched_at=at, geometry_types=points
    )
    return ctx


def features(path: Path) -> list[dict]:
    return json.loads(path.read_text())["features"]


def by_id(items: list[dict]) -> dict:
    return {f["properties"]["id"]: f["properties"] for f in items}


def test_streets_layers_follow_the_contract(streets_ctx, tmp_path) -> None:
    out = tmp_path / "data"
    result = publish(streets_ctx, out)
    tiles = out / "tiles"
    assert {
        "tiles/streets.hin.geojson",
        "tiles/streets.segments.geojson",
        "tiles/streets.crashes.geojson",
        "tiles/streets.memorials.geojson",
    } <= set(result.manifest["files"])

    segments = by_id(features(tiles / "streets.segments.geojson"))
    assert sorted(segments) == [1, 2, 3, 4, 5, 6, 7]
    allowed = {"id", "name", "cls", "hin", "ksi", "k2", "sch", "f_hin", "f_ksi_vru", "f_fatal2"}
    assert all(set(p) <= allowed | {"f_school"} for p in segments.values())
    # MAIN ST is on the High Injury Network; its cross streets are not.
    assert [segments[i]["f_hin"] for i in (1, 2, 5, 6)] == [100, 100, 0, 0]
    # People walking or cycling killed or seriously injured, 2020 to 2024: the walking death in
    # the middle of OAK ST (seg 3), and the cycling injury at the corner of MAIN ST and 2ND ST,
    # which counts for each block meeting there (1, 2, 6). Older years do not count.
    assert {i: p["ksi"] for i, p in segments.items()} == {1: 1, 2: 1, 3: 1, 4: 0, 5: 0, 6: 1, 7: 0}
    assert segments[3]["f_ksi_vru"] == 43 and segments[4]["f_ksi_vru"] == 0
    # Deaths in the two years before the build (Police): OAK ST mid block (seg 3), MAIN ST near
    # 1ST ST (seg 1), and two people on scooters on OAK ST (seg 4).
    assert {i: p["k2"] for i, p in segments.items()} == {1: 1, 2: 0, 3: 1, 4: 2, 5: 0, 6: 0, 7: 0}
    assert [segments[i]["f_fatal2"] for i in (1, 2, 3, 4)] == [100, 0, 100, 100]
    assert [segments[i]["f_school"] for i in (1, 2, 4, 7)] == [0, 100, 100, 100]

    crashes = features(tiles / "streets.crashes.geojson")
    assert all(set(f["properties"]) == {"id", "y", "ya", "sev", "m"} for f in crashes)
    crash = by_id(crashes)
    assert crash[2024000001] == {"id": 2024000001, "y": 2024, "ya": 0, "sev": 3, "m": 1}
    assert crash[2015000007] == {"id": 2015000007, "y": 2015, "ya": 9, "sev": 2, "m": 2}
    assert 2020000099 not in crash  # 2020 belongs to the newest slice
    assert len(crashes) == 7  # the crash far from any street is still a crash

    memorials = features(tiles / "streets.memorials.geojson")
    assert len(memorials) == 6
    for item in memorials:
        assert set(item["properties"]) <= {"id", "d", "m", "pl", "sg", "nm", "src"}
        assert item["properties"]["sg"].split(",")[0] == "memorial_or_ghost_bike"
    named = [f["properties"] for f in memorials if "nm" in f["properties"]]
    assert named == [
        {
            "id": named[0]["id"],
            "d": "2026-08-20",
            "m": 1,
            "pl": "100 block of Oak St",
            "sg": "memorial_or_ghost_bike,traffic_calming_petition",
            "nm": "Alex Example",
            "src": "https://example.org/memorials/alex-example",
        }
    ]
    # The cyclist's name was removed on request: the marker stays, unnamed.
    cyclist = [f["properties"] for f in memorials if f["properties"]["d"] == "2023-05-05"]
    assert cyclist and "nm" not in cyclist[0] and "src" not in cyclist[0]

    published = "".join(path.read_text() for path in tiles.iterdir())
    published += (out / "manifest.json").read_text()
    for text in (*PLACEHOLDERS, "Robin Placeholder", "PLACEHOLDER-CASE"):
        assert text not in published


def test_a_marker_removed_on_request_never_returns(streets_ctx, repo_copy, tmp_path) -> None:
    first = publish(streets_ctx, tmp_path / "a")
    marker = next(
        f["properties"]["id"]
        for f in features(tmp_path / "a" / "tiles" / "streets.memorials.geojson")
        if f["properties"]["d"] == "2026-08-20"
    )
    write_curated(repo_copy, [INVENTED, REMOVED], ["m2023_0001", marker])
    publish(streets_ctx, tmp_path / "b")
    after = features(tmp_path / "b" / "tiles" / "streets.memorials.geojson")
    assert marker not in {f["properties"]["id"] for f in after}
    assert "Alex Example" not in json.dumps(after)
    assert len(after) == 5
    assert (
        "memorials: 1 marker is removed on request"
        in (json.loads((tmp_path / "b" / "manifest.json").read_text())["notes"])
    )
    assert first.features["tiles/streets.pmtiles memorials"] == 6


def test_a_broken_removal_list_publishes_no_memorials(streets_ctx, repo_copy, tmp_path) -> None:
    (repo_copy / "data" / "curated" / "suppressed.yaml").write_text("{broken", encoding="utf-8")
    result = publish(streets_ctx, tmp_path / "data")
    assert "tiles/streets.memorials.geojson" not in result.manifest["files"]
    assert any(n.startswith("memorials are not published") for n in result.manifest["notes"])


def test_the_streets_tiles_keep_every_point(streets_ctx, tmp_path, monkeypatch) -> None:
    options = TILE_OPTIONS["tiles/streets.pmtiles"]
    assert "--base-zoom=8" in options
    feature_filter = json.loads(options[options.index("--feature-filter") + 1])
    assert set(feature_filter) == {"crashes", "segments"}
    if shutil.which("tippecanoe") is None or shutil.which("tippecanoe-decode") is None:
        pytest.skip("tippecanoe is not installed")
    monkeypatch.setenv("PK_TIPPECANOE", "tippecanoe")
    out = tmp_path / "data"
    publish(streets_ctx, out)
    path = out / "tiles" / "streets.pmtiles"
    assert sorted(pmtiles_layer_names(path)) == ["crashes", "hin", "memorials", "segments"]
    decoded = subprocess.run(
        ["tippecanoe-decode", "-c", "-f", "-z", "8", "-Z", "8", str(path)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    at_zoom_8 = [
        json.loads(line.strip().rstrip(","))
        for line in decoded.splitlines()
        if line.strip().startswith('{ "type": "Feature",')
    ]
    memorial_ids = {
        f["properties"]["id"]
        for f in at_zoom_8
        if f.get("tippecanoe", {}).get("layer") == "memorials"
    }
    # Even zoomed all the way out, every memorial is there.
    assert len(memorial_ids) == 6


def test_point_layers_are_never_thinned() -> None:
    """tippecanoe thins points below its base zoom unless told otherwise, which would make
    memorials, crashes and gardens vanish when the map is zoomed out."""
    from placekeepers.registry import load_registry

    from .conftest import REPO_ROOT

    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    files = {layer.file for layer in registry.layers.values() if layer.geometry == "point"}
    assert "tiles/streets.pmtiles" in files
    for file in files:
        options = TILE_OPTIONS[file]
        assert any(option.startswith("--base-zoom=") for option in options), file
