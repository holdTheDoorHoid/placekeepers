"""Snapshots for the rules and records of each lot (M4.6), placed among the lot dossier fixtures of
test_dossiers.py (its grid of parcels about 30 meters apart). Every name is invented."""

from __future__ import annotations

from datetime import UTC, datetime

import pyarrow as pa
import shapely
from shapely.geometry import Point, box

from placekeepers.adapters.rules import APPEAL_COLUMNS

from .conftest import install_snapshot
from .test_dossiers import LAT0, LNG0, parcel_box, where

FETCHED = "2026-10-04T14:00:00Z"

#: Who filed an appeal: it must appear on that lot's own page and nowhere else.
APPELLANT = "QUINN APPELLANT"
#: A name on an old appeal of another lot (the organization that owns it).
OTHER_APPELLANT = "KENSINGTON LOTS LLC"
#: An upcoming hearing about a parcel without a dossier, next door to 372000002.
NEIGHBOR = "888000001"

DISTRICT = "Fixture Hill Historic District"
NCO = "/NCO Neighborhood Conservation Overlay District - Fixture Area"
WISSAHICKON = "Wissahickon Watershed Impervious Coverage Restriction 35%"
SLIVER = "/CTR Center City Overlay District - Sliver Area"
PENDING = "/VDO - Example Subarea"


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


def stamp(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=UTC)


def sliver(account: str, share: float):
    """A strip along a parcel's west edge covering `share` of it, away from its center."""
    shape = parcel_box(account)
    west, south, east, north = shape.bounds
    return box(west - 0.0001, south - 0.0001, west + (east - west) * share, north + 0.0001)


def districts() -> pa.Table:
    lng, lat = where("371000001")
    shapes = [
        box(lng - 0.0002, lat - 0.00015, lng + 0.0006, lat + 0.00015),  # 371000001, 372000001
        parcel_box("373000001").buffer(0.00005),
    ]
    return pa.table(
        {
            "name": [DISTRICT, "Example Row Historic District"],
            "designated": pa.array(
                [datetime(2003, 12, 21, 5), datetime(3000, 1, 1, 5)], pa.timestamp("ms")
            ),
            "designated1": ["12/21/2003", "1/1/3000"],
            "geometry": [wkb(shape) for shape in shapes],
        }
    )


def sites() -> pa.Table:
    return pa.table(
        {
            "loc": ["2931 N LAWRENCE ST", "2904 N 5TH ST"],
            "idesigdate1": ["6/24/1958", None],
            "idesigdate2": [None, None],
            "district": [DISTRICT, DISTRICT],
            "ddesigdate": pa.array([datetime(2003, 12, 21, 5)] * 2, pa.timestamp("ms")),
            "districtdesdate": ["12/21/2003", "12/21/2003"],
            "geometry": [wkb(parcel_box("371000001")), wkb(parcel_box("372000001"))],
        }
    )


def overlays() -> pa.Table:
    lng, lat = where("371000001")
    rows = [
        # name, symbol, type, section, link, sunset, pending, bill, url, shape
        (
            NCO,
            "/NCO",
            "Overlay District",
            "14-504(5)",
            "https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-290619",
            None,
            "No",
            "N/A",
            "N/A",
            box(lng - 0.0002, lat - 0.00015, lng + 0.00135, lat + 0.00015),
        ),
        (
            WISSAHICKON,
            "[N/A]",
            "Wissahickon Watershed Impervious Coverage Restriction",
            "14-510(6)",
            "https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-291226",
            None,
            "No",
            "N/A",
            "N/A",
            sliver("372000003", 0.2),
        ),
        (
            SLIVER,
            "/CTR",
            "Overlay District",
            "14-502-1",
            "https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-289861",
            datetime(2029, 1, 1, 5),
            "No",
            "N/A",
            "N/A",
            sliver("372000004", 0.05),
        ),
        (
            PENDING,
            "/VDO",
            "Overlay District",
            "14-529",
            "https://codelibrary.amlegal.com/codes/philadelphia/latest/philadelphia_pa/0-0-0-291843",
            datetime(2029, 1, 1, 5),
            "Yes",
            "260462",
            "https://phila.legistar.com/LegislationDetail.aspx?ID=1",
            parcel_box("374000001").buffer(0.00005),
        ),
    ]
    names = (
        "overlay_name",
        "overlay_symbol",
        "type",
        "code_section",
        "code_section_link",
        "sunset_date",
        "pending",
        "pendingbill",
        "pendingbillurl",
    )
    columns = {name: [row[i] for row in rows] for i, name in enumerate(names)}
    columns["sunset_date"] = pa.array(columns["sunset_date"], pa.timestamp("ms"))
    columns["geometry"] = [wkb(row[-1]) for row in rows]
    return pa.table(columns)


def zoning() -> pa.Table:
    return pa.table(
        {
            "long_code": ["RSA-5"],
            "zoninggroup": ["Residential/Multi-Family/Residential Mixed-Use"],
            "pending": ["No"],
            "pendingbillurl": [None],
            "geometry": [wkb(box(LNG0 - 0.01, LAT0 - 0.01, LNG0 + 0.01, LAT0 + 0.01))],
        }
    )


def brownfields() -> pa.Table:
    lng, lat = where("372000005")
    near = Point(lng + 0.00032, lat)  # about 17 meters east of its shape's edge
    far = Point(LNG0 + 0.03, LAT0)  # about 2.5 kilometers away
    lng4, lat4 = where("375000001")
    cluster = [Point(lng4, lat4 + 0.0003 + i * 0.00001) for i in range(5)]
    points = [near, far, *cluster]
    return pa.table(
        {
            "registry_id": [f"1100000000{i:02d}" for i in range(len(points))],
            "primary_name": ["FORMER EXAMPLE WORKS", "FAR AWAY SITE"]
            + [f"CLUSTER SITE {i}" for i in range(5)],
            "location_address": ["2914 N 5TH ST", "1 FAR RD"]
            + [f"{10 + i} CLUSTER ST" for i in range(5)],
            "geometry": [wkb(point) for point in points],
        }
    )


def appeal_row(account: str | None, point: tuple[float, float], **fields) -> dict:
    row = {"opa_account_num": account, "address": fields.pop("address", None)}
    row.update({name: None for name in APPEAL_COLUMNS})
    row.update(fields)
    row["filed_day"] = (row.get("createddate") or "")[:10] or None
    row["lng"], row["lat"] = point
    return row


def appeals() -> pa.Table:
    lng2, lat2 = where("372000002")
    rows = [
        appeal_row(
            "371000001",
            where("371000001"),
            address="2931 N LAWRENCE ST",
            appealnumber="ZP-2026-000001",
            applicationtype="Zoning Board of Adjustment",
            appealtype="ZBA Permit Denial - Variance",
            appealstatus="Scheduled",
            createddate="2026-08-03 15:10:00+00",
            scheduleddate="2026-11-04 14:00:00+00",
            coordinatingrco="Fixture Neighbors Association",
            primaryappellant=f"{APPELLANT}; MORALES ROSA",
            opa_owner="MORALES ROSA",
        ),
        appeal_row(
            "372000001",
            where("372000001"),
            address="2902 N 5TH ST",
            appealnumber="40125",
            applicationtype="RB_LIRB",
            appealstatus="CLOSED",
            decision="AFFIRMED",
            createddate="2012-07-09 15:12:00+00",
            scheduleddate="2012-08-21 04:00:00+00",
            primaryappellant=OTHER_APPELLANT,
            opa_owner=OTHER_APPELLANT,
        ),
        appeal_row(
            NEIGHBOR,
            (lng2, lat2 + 0.0002),
            address="2905 N 5TH ST",
            appealnumber="ZP-2026-000002",
            applicationtype="Zoning Board of Adjustment",
            appealtype="ZBA Permit Denial - Special Exception",
            appealstatus="Prepare Meeting",
            createddate="2026-09-01 15:10:00+00",
            scheduleddate="2026-12-02 19:00:00+00",
            primaryappellant="SAGE NEIGHBOR",
            opa_owner="SAGE NEIGHBOR",
        ),
    ]
    names = list(rows[0])
    columns = {name: [row[name] for row in rows] for name in names}
    columns["filed_day"] = pa.array(
        [datetime.fromisoformat(d).date() if d else None for d in columns["filed_day"]], pa.date32()
    )
    return pa.table(columns)


def install_rules(ctx, *, fetched_at: str = FETCHED, skip: tuple[str, ...] = ()) -> None:
    """Every source of the rules and records, unless named in `skip`."""
    snapshots = {
        "historic_districts": (districts, ["Polygon"]),
        "historic_sites": (sites, ["Polygon"]),
        "zoning_overlays": (overlays, ["Polygon"]),
        "zoning_base_districts": (zoning, ["Polygon"]),
        "epa_brownfields": (brownfields, ["Point"]),
        "appeals": (appeals, None),
    }
    for source_id, (make, types) in snapshots.items():
        if source_id in skip:
            continue
        install_snapshot(
            ctx,
            source_id,
            make(),
            geometry=types is not None,
            fetched_at=fetched_at,
            geometry_types=types,
        )
