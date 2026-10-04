"""ArcGIS layers: offset paging, retried error replies, refused logins, and GeoParquet output."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import geopandas
import pyarrow.parquet as pq
import pytest
from shapely.geometry import Polygon, box

from placekeepers.adapters.arcgis import exceeded_transfer_limit
from placekeepers.adapters.vacant_indicators import VacantIndicatorsLand
from placekeepers.cache import RawFetch
from placekeepers.httpclient import AccessRefused

from .conftest import FakeArcgis, arcgis_feature, load_fixture

SEPT_27 = 1790467200000  # 2026-09-27 00:00 UTC in milliseconds


def land_features(count: int) -> list[dict]:
    features = []
    for n in range(1, count + 1):
        properties = {
            "objectid": n,
            "address": f"{n} N 11TH ST",
            "owner1": "SOMEONE",
            "owner2": None,
            "bldg_desc": "VAC LAND RES < ACRE",
            "opa_id": f"37{n:07d}",
            "lniaddresskey": str(n),
            "councildistrict": "5",
            "zoningbasedistrict": "RM-1",
            "zipcode": "19133",
            "land_rank": n / 10,
            "date_update": SEPT_27,
            "Shape__Area": 100.0,
            "Shape__Length": 40.0,
        }
        features.append(
            arcgis_feature(properties, box(-75.15, 39.99 + n / 1000, -75.149, 39.991 + n / 1000))
        )
    return features


def server(count: int, **kwargs) -> FakeArcgis:
    return FakeArcgis(
        fields=load_fixture("arcgis_vacant_land_fields.json"),
        features=land_features(count),
        **kwargs,
    )


def run(adapter: VacantIndicatorsLand, tmp_path: Path) -> tuple[dict, Path]:
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


def test_features_are_paged_by_offset_in_object_id_order(context_factory, tmp_path: Path) -> None:
    fake = server(5, max_records=2)
    ctx = context_factory(handler=fake)
    info, out = run(
        VacantIndicatorsLand(ctx.registry.sources["vacant_indicators_land"], ctx), tmp_path
    )
    assert info["rows"] == 5 and info["pages"] == 3
    pages = [r.url.params for r in fake.requests if "resultOffset" in r.url.params]
    assert [p["resultOffset"] for p in pages] == ["0", "2", "4"]
    assert {p["resultRecordCount"] for p in pages} == {"2"}
    assert {(p["f"], p["outSR"], p["orderByFields"]) for p in pages} == {
        ("geojson", "4326", "objectid ASC")
    }
    assert fake.requests[0].url.path.endswith("/Vacant_Indicators_Land/FeatureServer/0")

    table = pq.read_table(out)
    assert table.num_rows == 5
    assert "shape__area" not in table.column_names and "geometry" in table.column_names
    assert table.column("date_update").to_pylist()[0] == datetime(2026, 9, 27)
    assert table.column("opa_id").to_pylist()[:2] == ["370000001", "370000002"]
    frame = geopandas.read_parquet(out)
    assert isinstance(frame.geometry.iloc[0], Polygon)
    assert frame.geometry.iloc[0].bounds[0] == pytest.approx(-75.15)


def test_an_error_inside_a_normal_reply_is_retried(context_factory, tmp_path: Path) -> None:
    fake = server(3, max_records=2000, errors_before_success=2)
    ctx = context_factory(handler=fake)
    info, _ = run(
        VacantIndicatorsLand(ctx.registry.sources["vacant_indicators_land"], ctx), tmp_path
    )
    assert info["rows"] == 3 and info["pages"] == 1


def test_a_login_request_is_a_refusal(context_factory, tmp_path: Path) -> None:
    fake = server(3, errors_before_success=10, error_code=499)
    ctx = context_factory(handler=fake)
    adapter = VacantIndicatorsLand(ctx.registry.sources["vacant_indicators_land"], ctx)
    (tmp_path / "raw").mkdir()
    with pytest.raises(AccessRefused, match="never works around a login"):
        adapter.fetch(tmp_path / "raw")
    assert len(fake.requests) == 1


def test_the_transfer_limit_flag_is_read_where_arcgis_puts_it() -> None:
    assert exceeded_transfer_limit({"properties": {"exceededTransferLimit": True}}) is True
    assert exceeded_transfer_limit({"exceededTransferLimit": False}) is False
    assert exceeded_transfer_limit({"features": []}) is None
