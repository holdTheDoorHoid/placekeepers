"""The OpenStreetMap extract source (M2.2): the download, the file header, the filter to the city
and the registry's tags, and the source's health rules. The extract is the hand made
tests/fixtures/osm_sample.osm written as a PBF file (tests/osm_pbf.py); no network."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime
from pathlib import Path

import duckdb
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
import yaml
from shapely.geometry import box

from placekeepers.adapters import adapter_for
from placekeepers.adapters.osm import (
    EXTRACT_FILE,
    NotAnExtract,
    check_extract,
    read_pbf_header,
    tag_condition,
)
from placekeepers.cache import RawFetch, RawStore
from placekeepers.config import USER_AGENT
from placekeepers.httpclient import RetryableError
from placekeepers.runner import fetch_source, refetch_due, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FIXTURES, install_snapshot
from .osm_pbf import osm_xml_to_pbf

SOURCE = "osm_philadelphia"
STAMP = datetime(2026, 10, 3, 20, 20, 50, tzinfo=UTC)
NOW = datetime(2026, 10, 5, 2, 54, 19, tzinfo=UTC)
LATEST = "https://download.geofabrik.de/north-america/us/pennsylvania-latest.osm.pbf"
DATED = "https://download.geofabrik.de/north-america/us/pennsylvania-261003.osm.pbf"
#: The test city: two census tracts side by side.
WEST_TRACT = box(-75.170, 39.950, -75.160, 39.966)
EAST_TRACT = box(-75.160, 39.950, -75.150, 39.966)


def _spatial_available() -> bool:
    con = duckdb.connect()
    try:
        con.execute("SET autoinstall_known_extensions = false")
        con.execute("LOAD spatial")
    except duckdb.Error:
        return False
    finally:
        con.close()
    return True


needs_spatial = pytest.mark.skipif(
    not _spatial_available(), reason="DuckDB's spatial extension is not installed"
)


def sample_pbf(folder: Path, *, timestamp: datetime | None = STAMP) -> Path:
    folder.mkdir(parents=True, exist_ok=True)
    return osm_xml_to_pbf(FIXTURES / "osm_sample.osm", folder / EXTRACT_FILE, timestamp=timestamp)


def install_city(ctx) -> None:
    tracts = pa.table(
        {
            "geoid": ["42101000100", "42101000200"],
            "geometry": [shapely.to_wkb(WEST_TRACT), shapely.to_wkb(EAST_TRACT)],
        }
    )
    install_snapshot(
        ctx, "census_tracts_2020", tracts, geometry=True, fetched_at="2026-10-04T14:00:00Z"
    )


def stage_download(ctx, *, timestamp: datetime | None = STAMP, source_date="2026-10-04") -> None:
    """Put the sample extract in the cache as a finished download waiting to be checked."""
    raws = RawStore(ctx.cache, SOURCE)
    partial = raws.begin("20261005T025419Z")
    sample_pbf(partial, timestamp=timestamp)
    info = {"file": EXTRACT_FILE, "source_date": source_date, "rows": None}
    raws.commit(
        partial,
        RawFetch(SOURCE, "20261005T025419Z", "2026-10-05T02:54:19Z", [EXTRACT_FILE], info),
    )


def small_health(repo_copy: Path) -> Path:
    """The real registry, with a row floor that the small sample can meet."""
    path = repo_copy / "registry" / "sources.yaml"
    sources = yaml.safe_load(path.read_text())
    for source in sources:
        if source["id"] == SOURCE:
            source["health"]["min_rows"] = 10
    path.write_text(yaml.safe_dump(sources, sort_keys=False, allow_unicode=True))
    return repo_copy


# The file header ------------------------------------------------------------------------------


def test_the_header_says_what_the_file_needs_and_how_old_its_data_is(tmp_path: Path) -> None:
    header = read_pbf_header(sample_pbf(tmp_path))
    assert header.required_features == ("OsmSchema-V0.6", "DenseNodes")
    assert header.writing_program == "placekeepers-tests"
    assert header.replication_timestamp == STAMP
    assert (
        read_pbf_header(sample_pbf(tmp_path / "plain", timestamp=None)).replication_timestamp
        is None
    )


def test_a_download_that_is_not_an_extract_is_refused(tmp_path: Path) -> None:
    page = tmp_path / "error.html"
    page.write_text("<html><body>Too many requests, try later</body></html>")
    with pytest.raises(NotAnExtract):
        read_pbf_header(page)
    with pytest.raises(RetryableError, match="not an OpenStreetMap extract"):
        check_extract(page)
    cut = tmp_path / "cut.osm.pbf"
    cut.write_bytes(sample_pbf(tmp_path / "whole").read_bytes()[:30])
    with pytest.raises(NotAnExtract):
        read_pbf_header(cut)


# The download -----------------------------------------------------------------------------------


def geofabrik(pbf: bytes, seen: list[httpx.Request]):
    """Geofabrik's server: the latest link redirects to the dated file."""

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if str(request.url) == LATEST:
            return httpx.Response(307, headers={"Location": DATED})
        if str(request.url) == DATED:
            headers = {"Last-Modified": "Sun, 04 Oct 2026 06:19:21 GMT"}
            return httpx.Response(200, content=pbf, headers=headers)
        return httpx.Response(404)

    return handler


def test_the_download_follows_the_latest_link_politely(context_factory, tmp_path: Path) -> None:
    seen: list[httpx.Request] = []
    pbf = sample_pbf(tmp_path / "server").read_bytes()
    ctx = context_factory(now=NOW, handler=geofabrik(pbf, seen))
    result = fetch_source(ctx, ctx.registry.sources[SOURCE])
    assert result.outcome == "downloaded", result.detail
    assert [str(r.url) for r in seen] == [LATEST, DATED]
    assert all(r.headers["User-Agent"] == USER_AGENT for r in seen)
    raw = RawStore(ctx.cache, SOURCE).latest()
    assert raw is not None
    assert raw.files == [EXTRACT_FILE]
    assert raw.info["bytes"] == len(pbf)
    assert raw.info["source_date"] == "2026-10-04"
    assert raw.info["replication_timestamp"] == "2026-10-03T20:20:50Z"


def test_an_error_page_sent_as_a_file_is_retried_then_fails(context_factory) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="<html>Service unavailable</html>")

    ctx = context_factory(now=NOW, handler=handler)
    result = fetch_source(ctx, ctx.registry.sources[SOURCE])
    assert result.outcome == "failed"
    assert "not an OpenStreetMap extract" in result.detail
    assert RawStore(ctx.cache, SOURCE).latest() is None


def test_a_good_copy_younger_than_six_days_is_not_downloaded_again(
    context_factory, tmp_path: Path
) -> None:
    seen: list[httpx.Request] = []
    pbf = sample_pbf(tmp_path / "server").read_bytes()
    ctx = context_factory(now=NOW, handler=geofabrik(pbf, seen))
    source = ctx.registry.sources[SOURCE]
    install_snapshot(
        ctx, SOURCE, pa.table({"osm_id": [1]}), geometry=False, fetched_at="2026-10-01T10:00:00Z"
    )
    reason = refetch_due(ctx, source)
    assert reason is not None and "less than 6 days old" in reason
    assert fetch_source(ctx, source).outcome == "skipped"
    assert seen == []
    # The next weekly refresh, seven days on, downloads it again.
    later = context_factory(now=datetime(2026, 10, 8, 10, 0, tzinfo=UTC))
    assert refetch_due(later, source) is None
    # So does someone who forces it.
    assert fetch_source(ctx, source, force=True).outcome == "downloaded"
    assert [str(r.url) for r in seen] == [LATEST, DATED]


# The filter to the city and the tags ------------------------------------------------------------


def kept(path: Path) -> dict[str, dict]:
    table = pq.read_table(path)
    rows = table.to_pylist()
    return {f"{row['osm_type'][0]}{row['osm_id']}": row for row in rows}


@needs_spatial
def test_the_snapshot_keeps_the_tags_inside_the_city_and_a_margin(
    context_factory, repo_copy: Path
) -> None:
    ctx = context_factory(now=NOW, repo_root=small_health(repo_copy))
    install_city(ctx)
    stage_download(ctx)
    result = validate_source(ctx, ctx.registry.sources[SOURCE])
    assert result.outcome == "ok", result.detail
    store = SnapshotStore(ctx.cache, SOURCE)
    meta = store.current()
    assert meta is not None and meta.newest_record == "2026-10-03"
    assert meta.format == "geoparquet"
    rows = kept(store.path_for(meta))
    # Not kept: the stop position (no listed tag), the cafe, the stop 1 km outside the city, and
    # the relation (relations are not read).
    assert sorted(rows) == sorted(
        [f"n{i}" for i in (1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 16, 17, 18)]
        + [f"n{i}" for i in (20, 21, 22, 23, 24)]
        + ["w1", "w2", "w3", "w4"]
    )
    outside = {key for key, row in rows.items() if not row["in_city"]}
    assert outside == {"n13", "n17"}
    assert {row["extract_date"] for row in rows.values()} == {date(2026, 10, 3)}
    assert json.loads(rows["n1"]["tags"])["name"] == "Broad St & Arch St"
    assert list(json.loads(rows["n1"]["tags"])) == sorted(json.loads(rows["n1"]["tags"]))
    kinds = {key: shapely.from_wkb(row["geometry"]).geom_type for key, row in rows.items()}
    assert (kinds["n1"], kinds["w1"], kinds["w3"], kinds["w4"]) == (
        "Point",
        "Polygon",
        "LineString",
        "Polygon",
    )
    # A way's point lies on it: the middle of the platform line.
    middle = shapely.from_wkb(rows["w3"]["geometry"]).interpolate(0.5, normalized=True)
    assert (rows["w3"]["lng"], rows["w3"]["lat"]) == pytest.approx((middle.x, middle.y), abs=1e-7)
    checks = {check["rule"]: check for check in meta.checks}
    assert checks["stops_in_city"]["ok"] is True
    assert any("inside the city" in note for note in meta.notes)
    # The download is deleted once the snapshot is made.
    assert RawStore(ctx.cache, SOURCE).latest() is None


@needs_spatial
def test_without_a_header_date_the_server_date_is_the_extract_date(
    context_factory, repo_copy: Path
) -> None:
    ctx = context_factory(now=NOW, repo_root=small_health(repo_copy))
    install_city(ctx)
    stage_download(ctx, timestamp=None, source_date="2026-10-04")
    assert validate_source(ctx, ctx.registry.sources[SOURCE]).outcome == "ok"
    assert SnapshotStore(ctx.cache, SOURCE).current().newest_record == "2026-10-04"


@needs_spatial
def test_without_the_city_limits_the_last_good_copy_stays(context_factory, repo_copy: Path) -> None:
    ctx = context_factory(now=NOW, repo_root=small_health(repo_copy))
    stage_download(ctx)
    result = validate_source(ctx, ctx.registry.sources[SOURCE])
    assert result.outcome == "error"
    assert "census_tracts_2020" in result.detail
    assert SnapshotStore(ctx.cache, SOURCE).current() is None


@needs_spatial
def test_the_real_row_floor_rejects_a_tiny_extract(context_factory) -> None:
    ctx = context_factory(now=NOW)
    install_city(ctx)
    stage_download(ctx)
    result = validate_source(ctx, ctx.registry.sources[SOURCE])
    assert result.outcome == "rejected"
    assert "fewer than the 2,500 expected" in result.detail


def test_most_stops_must_lie_inside_the_city(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=NOW)
    adapter = adapter_for(ctx.registry.sources[SOURCE], ctx)
    stop = json.dumps({"highway": "bus_stop"})
    bench = json.dumps({"amenity": "bench"})

    def check(stops_inside: int, stops_outside: int) -> dict:
        path = tmp_path / f"{stops_inside}-{stops_outside}.parquet"
        tags = [stop] * (stops_inside + stops_outside) + [bench] * 5
        inside = [True] * stops_inside + [False] * stops_outside + [False] * 5
        pq.write_table(pa.table({"tags": tags, "in_city": inside}), path)
        [found] = adapter.extra_checks(path, None)
        return found.to_json()

    assert check(95, 5)["ok"] is True
    failed = check(80, 20)
    assert failed["ok"] is False
    assert failed["detail"].startswith("80% of the 100 stops kept lie inside the city limits")
    assert check(0, 0)["ok"] is False


@needs_spatial
def test_the_tag_filter_reads_key_and_value_or_key_alone(tmp_path: Path) -> None:
    path = sample_pbf(tmp_path)
    con = duckdb.connect()
    con.execute("LOAD spatial")

    def ids(tags: list[str]) -> list[int]:
        rows = con.execute(
            f"SELECT id FROM ST_ReadOSM('{path}') WHERE kind = 'node' AND {tag_condition(tags)} "
            "ORDER BY id"
        ).fetchall()
        return [row[0] for row in rows]

    assert ids(["amenity=cafe"]) == [15]
    assert ids(["shelter"]) == [1, 3, 6, 12, 13]
    assert ids(["amenity=bench", "amenity=cafe"]) == [15, 21]
