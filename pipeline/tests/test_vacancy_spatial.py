"""The vacancy model's spatial joins and a whole run on tiny snapshots: footprints, land use,
parks, gardens and LandCare per parcel, the output file and its summary, the City's twelve month
rule, publishing the model on the map, and the City list freshness check.

Most need DuckDB's spatial extension, which CI installs before the tests. Without it those are
skipped (they never download it).
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box

from placekeepers.adapters import adapter_for
from placekeepers.derive import vacancy
from placekeepers.geo import write_geoparquet
from placekeepers.publish import publish

from .conftest import install_snapshot


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

AS_OF = date(2026, 10, 4)
WHEN = "2026-10-04T14:00:00Z"

# Shapes are laid out in meters east and north of a point in North Philadelphia.
LON0, LAT0 = -75.15, 39.98
M_PER_LON, M_PER_LAT = 85_290.0, 111_035.0


def rect(x: float, y: float, w: float, h: float):
    """A w by h meter rectangle whose southwest corner is x, y meters from the origin."""
    return box(
        LON0 + x / M_PER_LON,
        LAT0 + y / M_PER_LAT,
        LON0 + (x + w) / M_PER_LON,
        LAT0 + (y + h) / M_PER_LAT,
    )


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


def geo_table(columns: dict[str, list], shapes: list) -> pa.Table:
    return pa.table({**columns, "geometry": [wkb(s) for s in shapes]})


# The spatial facts per parcel

SPATIAL_PARCELS = {
    # opa: (parcel id, x of its 10 by 20 meter shape)
    "300000001": (1, 0),  # a footprint inside
    "300000002": (2, 30),  # a sliver of the neighbor's footprint, not linked
    "300000003": (3, 40),  # the neighbor that footprint belongs to
    "300000004": (4, 60),  # a footprint linked to it, 30 square meters on it
    "300000005": (5, 70),  # the neighbor most of that footprint stands on
    "300000006": (6, 90),  # a footprint linked to it, only 4 square meters on it
    "300000007": (7, 100),  # the neighbor that footprint stands on
    "300000008": (8, 120),  # land use shows a use
    "300000009": (9, 150),  # inside a land use polygon with too many vertices to read
    "300000010": (10, 180),  # in a park
    "300000011": (11, 210),  # a garden 3 meters away
    "300000012": (12, 240),  # a garden 8 meters away
    "300000013": (13, 270),  # LandCare
    "300000014": (14, 300),  # two Water Department parcels for one account
}


@pytest.fixture
def spatial(tmp_path: Path) -> dict[str, dict]:
    """build_spatial's per account facts for the parcels above."""
    parcel_ids, accounts, shapes = [], [], []
    for opa, (parcel_id, x) in SPATIAL_PARCELS.items():
        parcel_ids.append(parcel_id)
        accounts.append(opa)
        shapes.append(rect(x, 0, 10, 20))
    parcel_ids += [15, 16]
    accounts += ["300000014", " "]  # the second parcel of 300000014, and one with no account
    shapes += [rect(310, 0, 10, 20), rect(400, 0, 10, 20)]
    footprints = [
        (1, None, rect(1, 1, 8, 18)),
        (2, None, rect(39.7, 0, 9.8, 20)),  # 6 square meters on 300000002
        (3, "4", rect(68.5, 0, 11.5, 20)),  # 30 square meters on 300000004
        (4, "6", rect(99.8, 0, 10.2, 20)),  # 4 square meters on 300000006
    ]
    many_vertices = Point(LON0 + 155 / M_PER_LON, LAT0 + 10 / M_PER_LAT).buffer(
        40 / M_PER_LAT, quad_segs=1300
    )
    assert shapely.get_num_coordinates(many_vertices) > vacancy.LAND_USE_MAX_POINTS
    paths = {}

    def put(source_id: str, columns: dict[str, list], geometries: list) -> None:
        path = tmp_path / f"{source_id}.parquet"
        write_geoparquet(geo_table(columns, geometries), path, ["Polygon"])
        paths[source_id] = path

    put(
        "pwd_parcels",
        {"parcelid": parcel_ids, "brt_id": accounts, "num_brt": [1] * len(accounts)},
        shapes,
    )
    put(
        "building_footprints",
        {"objectid": [f[0] for f in footprints], "parcel_id_num": [f[1] for f in footprints]},
        [f[2] for f in footprints],
    )
    put(
        "land_use",
        {
            "c_dig1": [1, 5],
            "c_dig2": [11, 51],
            "c_dig3": [111, 513],
            "year": [2023, 2023],
            "vacbldg": [None, None],
        },
        [rect(115, -5, 20, 30), many_vertices],
    )
    put("ppr_properties", {"official_name": ["Sample Park"]}, [rect(175, -5, 20, 30)])
    put("gardens_phs_ngt", {"site_name": ["Near Garden"]}, [rect(223, 0, 7, 20)])
    put("gardens_registered", {"garden_name": ["Far Garden"]}, [rect(258, 0, 7, 20)])
    put(
        "phs_landcare",
        {"program": ["PLC"], "year": ["2019"], "brt_id": [None]},
        [rect(265, -5, 20, 30)],
    )
    con = duckdb.connect()
    con.execute("LOAD spatial")
    vacancy.create_views(con, paths)
    vacancy.build_spatial(con)
    rows = con.execute("SELECT * FROM sp").to_arrow_table().to_pylist()
    con.close()
    return {row["opa"]: row for row in rows}


@needs_spatial
def test_a_footprint_mostly_inside_the_parcel_means_a_building(spatial) -> None:
    assert spatial["300000001"]["has_footprint"] is True
    assert spatial["300000001"]["fp_mostly_inside"] == 1


@needs_spatial
def test_a_sliver_of_the_neighbors_footprint_is_not_a_building(spatial) -> None:
    sliver = spatial["300000002"]
    assert sliver["has_footprint"] is False
    assert 5 < sliver["fp_max_piece_m2"] < 7
    assert spatial["300000003"]["has_footprint"] is True


@needs_spatial
def test_a_linked_footprint_counts_from_ten_square_meters(spatial) -> None:
    assert spatial["300000004"]["fp_linked"] == 1
    assert spatial["300000004"]["fp_max_piece_m2"] > vacancy.FP_LINKED_MIN_M2
    assert spatial["300000004"]["has_footprint"] is True
    assert spatial["300000006"]["fp_linked"] == 1
    assert spatial["300000006"]["fp_max_piece_m2"] < vacancy.FP_LINKED_MIN_M2
    assert spatial["300000006"]["has_footprint"] is False


@needs_spatial
def test_land_use_comes_from_the_polygon_under_the_parcel(spatial) -> None:
    assert (spatial["300000008"]["lu_c1"], spatial["300000008"]["lu_c2"]) == (1, 11)
    assert spatial["300000008"]["lu_c3"] == 111
    assert spatial["300000008"]["lu_year"] == 2023
    assert spatial["300000001"]["lu_c2"] is None


@needs_spatial
def test_land_use_polygons_with_too_many_vertices_are_left_out(spatial) -> None:
    assert spatial["300000009"]["lu_c2"] is None


@needs_spatial
def test_parks_gardens_and_landcare_are_found_by_shape(spatial) -> None:
    assert spatial["300000010"]["ppr_name"] == "Sample Park"
    assert spatial["300000011"]["garden_src"] == "PHS or NGT"
    assert spatial["300000011"]["garden_name"] == "Near Garden"
    assert spatial["300000012"]["garden_src"] is None  # 8 meters is too far
    assert spatial["300000013"]["lc_program"] == "PLC"
    assert spatial["300000013"]["lc_year"] == "2019"


@needs_spatial
def test_an_account_on_two_parcels_adds_their_areas(spatial) -> None:
    both = spatial["300000014"]
    assert both["pwd_parcels"] == 2
    assert 395 < both["area_m2"] < 405
    assert 195 < spatial["300000001"]["area_m2"] < 205
    assert len(spatial) == len(SPATIAL_PARCELS)  # the parcel with no account is left out


# A whole run on tiny snapshots

RUN_ACCOUNTS = {
    "400000001": "vacant land on the City's list, no footprint",
    "400000002": "a building on the City's list, sealed in 2025",
    "400000003": "a house demolished in 2024, a vacant lot violation since",
    "400000004": "the City and the assessor say vacant land, but a footprint stands",
    "400000005": "vacant land in a park",
    "400000006": "vacant land with no parcel shape anywhere",
    "400000007": "a LandCare lot",
    "400000008": "on the City's land list, with only the City's polygon",
    "400000009": "vacant land that is a unit inside a larger parcel, with no shape",
    "400000010": "vacant land with no shape and no point",
}


def install_run_snapshots(ctx, *, city_land_date: datetime) -> None:
    ids = list(RUN_ACCOUNTS)
    houses = {"400000002", "400000003"}
    install_snapshot(
        ctx,
        "opa_properties",
        pa.table(
            {
                "parcel_number": ids,
                "location": [f"{2000 + 10 * n} N SAMPLE ST" for n in range(len(ids))],
                "unit": ["P9" if i == "400000009" else None for i in ids],
                "category_code": ["1" if i in houses else "6" for i in ids],
                "building_code_description": [
                    "ROW 2 STY MASONRY" if i in houses else "VAC LAND RES < ACRE" for i in ids
                ],
                "owner_1": [f"OWNER {i}" for i in ids],
                "total_livable_area": [1200.0 if i in houses else 0.0 for i in ids],
                "year_built": ["1920"] * len(ids),
                "exterior_condition": ["4"] * len(ids),
                "lat": [None if i == "400000010" else 39.98 for i in ids],
                "lng": [None if i == "400000010" else -75.15 for i in ids],
            }
        ),
        geometry=False,
        fetched_at=WHEN,
    )
    shaped = ["400000001", "400000002", "400000003", "400000004", "400000005", "400000007"]
    x = {opa: 30 * n for n, opa in enumerate(shaped)}
    install_snapshot(
        ctx,
        "pwd_parcels",
        geo_table(
            {"parcelid": list(range(1, len(shaped) + 1)), "brt_id": shaped, "num_brt": [1] * 6},
            [rect(x[opa], 0, 10, 20) for opa in shaped],
        ),
        geometry=True,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "building_footprints",
        geo_table(
            {"objectid": [1, 2], "parcel_id_num": ["2", "4"]},
            [rect(x["400000002"] + 1, 1, 8, 18), rect(x["400000004"] + 1, 1, 8, 18)],
        ),
        geometry=True,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "ppr_properties",
        geo_table({"official_name": ["Sample Park"]}, [rect(x["400000005"] - 5, -5, 20, 30)]),
        geometry=True,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "phs_landcare",
        geo_table(
            {"program": ["PLC"], "year": ["2019"], "brt_id": [None]},
            [rect(x["400000007"] - 5, -5, 20, 30)],
        ),
        geometry=True,
        fetched_at=WHEN,
    )
    land = ["400000001", "400000004", "400000005", "400000008"]
    install_snapshot(
        ctx,
        "vacant_indicators_land",
        geo_table(
            {
                "opa_id": land,
                "bldg_desc": ["VAC LAND RES < ACRE"] * len(land),
                "land_rank": [90.0] * len(land),
                "date_update": [city_land_date] * len(land),
            },
            [rect(x.get(opa, 500), 0, 10, 20) for opa in land],
        ),
        geometry=True,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "vacant_indicators_bldg",
        geo_table(
            {
                "opa_id": ["400000002"],
                "bldg_desc": ["ROW 2 STY MASONRY"],
                "build_rank": [80.0],
                "date_update": [datetime(2026, 9, 1)],
            },
            [rect(x["400000002"], 0, 10, 20)],
        ),
        geometry=True,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "li_clean_and_seal",
        pa.table(
            {
                "opa_account_num": ["400000002"],
                "workorderstatus": ["CLOSED"],
                "workordercompleteddate": [date(2025, 3, 1)],
            }
        ),
        geometry=False,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "li_demolitions",
        pa.table(
            {
                "opa_account_num": ["400000003"],
                "status": ["COMPLETED"],
                "typeofwork": ["FULL"],
                "city_demo": ["NO"],
                "start_date": [date(2024, 5, 1)],
                "completed_date": [date(2024, 6, 1)],
            }
        ),
        geometry=False,
        fetched_at=WHEN,
    )
    install_snapshot(
        ctx,
        "li_violations",
        pa.table(
            {
                "opa_account_num": ["400000003"],
                "violationdate": [date(2025, 5, 1)],
                "violationcode": ["9-3904"],
                "violationcodetitle": ["VACANT LOT LICENSE"],
            }
        ),
        geometry=False,
        fetched_at=WHEN,
    )


BITS = {reason.id: 1 << reason.bit for reason in vacancy.REASONS}


def bits(*ids: str) -> int:
    return sum(BITS[i] for i in ids)


@pytest.fixture
def run_ctx(context_factory):
    ctx = context_factory()
    install_run_snapshots(ctx, city_land_date=datetime(2026, 9, 1))
    return ctx


def rows_by_opa(path: Path) -> dict[str, dict]:
    return {row["opa"]: row for row in pq.read_table(path).to_pylist()}


@needs_spatial
def test_a_run_labels_each_parcel_and_writes_its_shape(run_ctx) -> None:
    result = vacancy.run(run_ctx, AS_OF)
    assert result.path == vacancy.output_path(run_ctx)
    rows = rows_by_opa(result.path)
    label = {opa: (row["kind"], row["confidence"]) for opa, row in rows.items()}
    assert label == {
        "400000001": ("lot", "high"),
        "400000002": ("building", "high"),
        "400000003": ("lot", "medium"),
        "400000004": ("lot_conflict", "low"),
        "400000005": ("excluded", None),
        "400000006": ("lot", "low"),
        "400000007": ("lot", "medium"),
        "400000008": ("lot", "low"),
        "400000009": ("lot", "low"),
        "400000010": ("lot", "low"),
    }
    assert rows["400000001"]["rs"] == bits("city_land", "assessor_vacant_land", "no_building")
    assert rows["400000002"]["rs"] == bits("city_building", "sealed")
    assert (rows["400000002"]["sy"], rows["400000002"]["n"]) == (2025, 1)
    assert (
        rows["400000003"]["rs"]
        == bits("no_building", "demolished", "vacant_lot_record")
        - (
            BITS["no_building"]  # the assessor still lists a house, so no footprint does not count
        )
    )
    assert rows["400000003"]["dy"] == 2024
    assert rows["400000004"]["rs"] == bits("city_land", "assessor_vacant_land", "building_stands")
    assert rows["400000005"]["excluded_use"] == "park"
    assert (rows["400000007"]["lc"], rows["400000007"]["n"]) == (1, 3)

    # Shapes: the Water Department parcel, else the City's polygon, else the assessor's point,
    # except for a unit inside a larger parcel.
    shape = {opa: row["geometry"] for opa, row in rows.items()}
    source = {opa: row["shape"] for opa, row in rows.items()}
    assert shapely.from_wkb(shape["400000001"]).area > 0
    assert source["400000001"] == "parcel"
    assert shapely.from_wkb(shape["400000008"]).equals_exact(rect(500, 0, 10, 20), 1e-9)
    assert source["400000008"] == "city"
    assert shapely.from_wkb(shape["400000006"]).equals(shapely.Point(-75.15, 39.98))
    assert source["400000006"] == "point"
    assert shape["400000009"] is None and source["400000009"] is None  # a unit
    assert shape["400000010"] is None and source["400000010"] is None  # no point either
    assert (result.no_shape, result.points) == (2, 1)
    assert (
        "1 vacant parcels have no parcel shape, so the map shows each as a point at the "
        "assessor's location"
    ) in result.notes
    assert (
        "1 vacant parcels are units inside a larger parcel (condominium units, or lots a new "
        "development has not split off yet), so they are not on the map"
    ) in result.notes
    assert "1 vacant parcels have no parcel shape and no point, so they are not on the map" in (
        result.notes
    )

    assert result.counts == {
        "lot": {"high": 1, "medium": 2, "low": 5},
        "building": {"high": 1, "medium": 0, "low": 0},
        "excluded": 1,
    }
    summary = json.loads(result.path.with_suffix(".json").read_text())
    assert summary["as_of"] == "2026-10-04"
    assert summary["counts"] == result.counts
    assert summary["city_lists"] == {
        "land": {"date": "2026-09-01", "used": True},
        "building": {"date": "2026-09-01", "used": True},
    }
    assert "li_permits" in summary["missing_sources"]
    assert summary["without_city"]["lot"]["high"] == 0  # the City's vote is needed for high


@needs_spatial
def test_the_city_list_is_dropped_a_year_after_its_date(context_factory, tmp_path) -> None:
    ctx = context_factory()
    install_run_snapshots(ctx, city_land_date=datetime(2025, 9, 1))
    result = vacancy.run(ctx, AS_OF, out=tmp_path / "vacancy.parquet")
    assert result.path == tmp_path / "vacancy.parquet"
    assert not vacancy.output_path(ctx).exists()
    rows = rows_by_opa(result.path)
    assert (rows["400000001"]["kind"], rows["400000001"]["confidence"]) == ("lot", "medium")
    assert rows["400000001"]["rs"] & BITS["city_land"] == 0
    assert rows["400000002"]["confidence"] == "high"  # the building list is still current
    assert result.city_lists["land"] == {"date": "2025-09-01", "used": False}
    assert (
        "The City's vacant land list of 2025-09-01 is more than a year old, so it is no longer used"
        in result.notes
    )


@needs_spatial
def test_the_map_shows_the_models_parcels_with_their_reasons(run_ctx, tmp_path) -> None:
    vacancy.run(run_ctx, AS_OF)
    published = publish(run_ctx, tmp_path / "data")
    features = json.loads((tmp_path / "data" / "tiles" / "lots.parcels.geojson").read_text())
    properties = {f["properties"]["id"]: f["properties"] for f in features["features"]}
    geometry = {f["properties"]["id"]: f["geometry"]["type"] for f in features["features"]}
    # Not the park, not the unit inside a larger parcel, and not the parcel with no point; the
    # parcel with no shape is a point at the assessor's location, with the same properties.
    assert sorted(properties) == [
        "400000001",
        "400000002",
        "400000003",
        "400000004",
        "400000006",
        "400000007",
        "400000008",
    ]
    assert geometry["400000006"] == "Point" and geometry["400000001"] == "Polygon"
    assert set(properties["400000006"]) == set(properties["400000001"]) - {"dy", "sy", "ny"}
    assert properties["400000002"] == {
        "id": "400000002",
        "k": 2,
        "vc": 3,
        "ot": 0,
        "rt": 5,  # an owner name we could not type: ask the owner
        "lc": 0,
        "rs": bits("city_building", "sealed"),
        "n": 1,
        "sg": "seal_abandoned_building",
        "sy": 2025,
    }
    assert properties["400000003"]["dy"] == 2024
    assert properties["400000004"]["k"] == 1  # a lot, though a footprint stands
    assert properties["400000007"]["lc"] == 1
    # LandCare by its shape (no account on PHS's record): Community LandCare comes first.
    assert properties["400000007"]["rt"] == 1
    # The same suggestions as each parcel's dossier: lots are greened, buildings sealed.
    assert properties["400000004"]["sg"] == "clean_and_green"
    assert properties["400000007"]["sg"] == "clean_and_green"
    notes = published.manifest["notes"]
    assert (
        "Vacancy model as of 2026-10-04: lots 1 very likely vacant, 2 probably, 5 not sure; "
        "buildings 1 very likely vacant, 0 probably, 0 not sure; 1 parks, gardens, parking and "
        "similar left out"
    ) in notes
    assert not any("has not run" in note for note in notes)


def test_without_the_model_the_map_shows_the_city_lists_and_says_so(run_ctx, tmp_path) -> None:
    published = publish(run_ctx, tmp_path / "data")
    assert (
        "The vacancy model has not run, so the map shows the City's lists alone"
        in published.manifest["notes"]
    )


# The City list freshness check


def test_a_city_list_that_stops_advancing_while_demolitions_continue_is_stale(
    context_factory, tmp_path
) -> None:
    """Six months without a new date while ten or more demolitions are recorded: the download is
    rejected and the last good copy stays, flagged stale in health."""
    ctx = context_factory()
    old = datetime(2026, 3, 1)  # 217 days before the build
    demolitions = pa.table(
        {
            "opa_account_num": [f"5000000{n:02d}" for n in range(12)],
            "status": ["COMPLETED"] * 12,
            "typeofwork": ["FULL"] * 12,
            "city_demo": ["NO"] * 12,
            "start_date": [date(2026, 5, 1)] * 12,
            "completed_date": [date(2026, 5, 2)] * 11 + [date(2026, 1, 2)],
        }
    )
    install_snapshot(ctx, "li_demolitions", demolitions, geometry=False, fetched_at=WHEN)
    adapter = adapter_for(ctx.registry.sources["vacant_indicators_land"], ctx)
    assert adapter.demolitions_since(old.date()) == 11
    checks = adapter.extra_checks(tmp_path / "unused.parquet", old.date())
    assert [c.ok for c in checks] == [False]
    assert "11 demolitions have been recorded since" in checks[0].detail

    # Ten or more demolitions are needed, and six months.
    assert all(c.ok for c in adapter.extra_checks(tmp_path / "x.parquet", date(2026, 5, 1)))
    few = demolitions.slice(0, 9)
    install_snapshot(ctx, "li_demolitions", few, geometry=False, fetched_at="2026-10-04T15:00:00Z")
    assert adapter.demolitions_since(old.date()) == 9
    assert all(c.ok for c in adapter.extra_checks(tmp_path / "x.parquet", old.date()))
