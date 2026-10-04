"""Carto tables: keyset paging in fixed chunks, row count checks, and typed Parquet output."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import geopandas
import pyarrow.parquet as pq
import pytest
from shapely.geometry import MultiPolygon, box

from placekeepers.adapters import FetchError
from placekeepers.adapters.carto import CartoAdapter, Column
from placekeepers.adapters.pwd_parcels import PwdParcels
from placekeepers.adapters.shootings import Shootings
from placekeepers.cache import RawFetch
from placekeepers.geo import is_geoparquet

from .conftest import FakeCarto, hex_wkb


class SmallChunks(Shootings):
    chunk_rows = 3


def shooting_rows(count: int) -> list[dict]:
    return [
        {
            "cartodb_id": n * 10,
            "objectid": n,
            "date_": f"2026-09-{n:02d}",
            "fatal": "1" if n % 2 else "0",
            "lat": 39.95 + n / 1000,
            "lng": -75.16,
        }
        for n in range(1, count + 1)
    ]


def fetch_and_normalize(adapter: CartoAdapter, tmp_path: Path) -> tuple[dict, Path]:
    dest = tmp_path / "raw"
    dest.mkdir()
    info = adapter.fetch(dest)
    out = tmp_path / "snapshot.parquet"
    raw = RawFetch(
        source=adapter.id,
        fetch_id="x",
        fetched_at="2026-10-04T15:00:00Z",
        files=sorted(p.name for p in dest.iterdir()),
        info=info,
        dir=dest,
    )
    adapter.normalize(raw, out)
    return info, out


def test_large_tables_are_paged_by_key_in_fixed_chunks(context_factory, tmp_path: Path) -> None:
    server = FakeCarto(tables={"shootings": shooting_rows(8)})
    ctx = context_factory(handler=server)
    adapter = SmallChunks(ctx.registry.sources["shootings"], ctx)
    info, out = fetch_and_normalize(adapter, tmp_path)

    assert info["rows"] == 8 and info["chunks"] == 3
    pages = [query for query in server.queries if not query.startswith("SELECT count")]
    assert len(pages) == 3
    assert all(query.endswith("ORDER BY cartodb_id LIMIT 3") for query in pages)
    assert "WHERE" not in pages[0]
    assert "WHERE cartodb_id > 30 " in pages[1]
    assert "WHERE cartodb_id > 60 " in pages[2]

    table = pq.read_table(out)
    assert table.num_rows == 8
    assert table.column_names == ["objectid", "date_", "fatal", "lat", "lng"]
    assert table.column("date_").to_pylist()[0] == date(2026, 9, 1)
    assert table.column("fatal").to_pylist()[:2] == [1, 0]
    assert str(table.schema.field("objectid").type) == "int64"
    assert not is_geoparquet(out)


def test_an_exact_multiple_of_the_chunk_size_ends_cleanly(context_factory, tmp_path: Path) -> None:
    server = FakeCarto(tables={"shootings": shooting_rows(6)})
    ctx = context_factory(handler=server)
    info, out = fetch_and_normalize(SmallChunks(ctx.registry.sources["shootings"], ctx), tmp_path)
    assert info["rows"] == 6 and info["chunks"] == 2
    assert sorted(p.name for p in (tmp_path / "raw").iterdir()) == [
        "chunk-00001.csv",
        "chunk-00002.csv",
    ]
    assert pq.read_table(out).num_rows == 6


def test_missing_rows_fail_the_download(context_factory, tmp_path: Path) -> None:
    class ShortServer(FakeCarto):
        def __call__(self, request):
            response = super().__call__(request)
            if request.url.params["q"].startswith("SELECT count"):
                return type(response)(200, json={"rows": [{"n": 99}]})
            return response

    ctx = context_factory(handler=ShortServer(tables={"shootings": shooting_rows(4)}))
    dest = tmp_path / "raw"
    dest.mkdir()
    with pytest.raises(FetchError, match="Downloaded 4 rows but the table reports 99"):
        SmallChunks(ctx.registry.sources["shootings"], ctx).fetch(dest)


def test_values_that_do_not_fit_their_type_are_noted(context_factory, tmp_path: Path) -> None:
    rows = shooting_rows(3)
    rows[1]["fatal"] = "maybe"
    ctx = context_factory(handler=FakeCarto(tables={"shootings": rows}))
    adapter = SmallChunks(ctx.registry.sources["shootings"], ctx)
    _, out = fetch_and_normalize(adapter, tmp_path)
    assert pq.read_table(out).column("fatal").to_pylist() == [1, None, 1]
    assert adapter.notes == ["1 values in fatal were not a valid SMALLINT"]


def test_polygons_become_geoparquet(context_factory, tmp_path: Path) -> None:
    shapes = [MultiPolygon([box(-75.2 + n / 100, 39.9, -75.19 + n / 100, 39.91)]) for n in range(4)]
    rows = [
        {
            "cartodb_id": n + 1,
            "parcelid": n + 1,
            "brt_id": f"88{n:07d}",
            "pin": 1000 + n,
            "address": f"{n} MAIN ST",
            "num_brt": 1,
            "num_accounts": 1,
            "gross_area": 1200.5,
            "geometry": hex_wkb(shape),
        }
        for n, shape in enumerate(shapes)
    ]
    ctx = context_factory(handler=FakeCarto(tables={"pwd_parcels": rows}))
    _, out = fetch_and_normalize(PwdParcels(ctx.registry.sources["pwd_parcels"], ctx), tmp_path)
    assert is_geoparquet(out)
    frame = geopandas.read_parquet(out)
    assert frame.crs.to_string() == "OGC:CRS84"  # longitude and latitude, the GeoParquet default
    assert list(frame["brt_id"]) == [f"88{n:07d}" for n in range(4)]
    assert frame.geometry.iloc[2].equals(shapes[2])
    assert frame.geometry.geom_type.unique().tolist() == ["MultiPolygon"]


def test_a_registry_where_filter_is_applied(context_factory, tmp_path: Path) -> None:
    from placekeepers.registry import CartoEndpoint

    ctx = context_factory()
    source = ctx.registry.sources["shootings"].model_copy(
        update={"endpoint": CartoEndpoint(kind="carto", table="shootings", where="fatal = '1'")}
    )
    adapter = SmallChunks(source, ctx)
    assert adapter.count_query() == "SELECT count(*) AS n FROM shootings WHERE (fatal = '1')"
    assert "WHERE (fatal = '1') AND cartodb_id > 9 ORDER BY" in adapter.page_query(9)


def test_shootings_never_download_personal_details(context_factory) -> None:
    ctx = context_factory()
    query = Shootings(ctx.registry.sources["shootings"], ctx).page_query(None).lower()
    for field in (
        "race",
        "sex",
        "age",
        "latino",
        "wound",
        "dc_key",
        "location",
        "officer",
        "offender",
        "*",
    ):
        assert field not in query
    assert [column.name for column in Shootings.columns] == [
        "objectid",
        "date_",
        "fatal",
        "lat",
        "lng",
    ]


def test_column_types_are_known() -> None:
    from placekeepers.adapters import ADAPTERS

    for adapter in ADAPTERS.values():
        for column in getattr(adapter, "columns", ()):
            assert isinstance(column, Column)
            assert column.type in {
                "VARCHAR",
                "BIGINT",
                "INTEGER",
                "SMALLINT",
                "DOUBLE",
                "DATE",
                "WKB",
            }


def test_a_url_source_becomes_a_snapshot(context_factory, tmp_path: Path) -> None:
    import httpx

    from placekeepers.adapters import UrlAdapter
    from placekeepers.registry import UrlEndpoint

    body = "id,name,opened\n1,Fairmount,2020-05-01\n2,Clark,2021-06-02\n"
    ctx = context_factory(handler=lambda request: httpx.Response(200, text=body))
    source = ctx.registry.sources["shootings"].model_copy(
        update={
            "endpoint": UrlEndpoint(kind="url", url="https://example.org/parks.csv", format="csv")
        }
    )
    adapter = UrlAdapter(source, ctx)
    dest = tmp_path / "raw"
    dest.mkdir()
    info = adapter.fetch(dest)
    raw = RawFetch(
        source=source.id,
        fetch_id="x",
        fetched_at="2026-10-04T15:00:00Z",
        files=["data.csv"],
        info=info,
        dir=dest,
    )
    out = tmp_path / "parks.parquet"
    adapter.normalize(raw, out)
    assert pq.read_table(out).column("name").to_pylist() == ["Fairmount", "Clark"]
