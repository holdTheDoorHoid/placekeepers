"""Lot dossier shards end to end: invented snapshots of every source a dossier reads, then
`publish`, then the shards, the owners table, the manifest and the lots layer's owner type.

Also the guard for docs/ETHICS.md "Things we do not build": no field anywhere in a shard or the
owners table may hold an acquisition price estimate, a score or order of how easy a parcel would
be to take, an outreach letter, or personal details the City data has and we never publish.

The made up parcels, all near Fairhill (every name and record is invented):

    371000001  MORALES ROSA, a vacant lot on the City's land list; mail in Cherry Hill, NJ; taxes
               owed in July 2025; a sheriff sale; an open violation; last sold in 1987
    372000001 to 372000005  KENSINGTON LOTS LLC, five vacant lots: an owner with many
    373000001  the Land Bank, on the land list, eligible as a side yard
    373000002  the Redevelopment Authority, not on a vacancy list
    374000001  BOWMAN LEROY and BOWMAN EVELYN ESTATE OF, a vacant building, unsafe
    374000002  WALLACE GLORIA, cleaned and sealed in 2019, not on a vacancy list
    375000001  CEDAR HOLDINGS LLC, a lot with a community garden on it, in Community LandCare
    376000001  an account only an old L&I record knows (no dossier)
    885000001  OWENS TERRENCE, a vacant lot with a different account prefix; he has a homestead
               exemption (the City's record that someone lives there), so no conservatorship
    372000006  KENSINGTON LOTS LLC again, a lot only the vacancy model finds (the model test)
"""

from __future__ import annotations

import json
import re
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Point, box

from placekeepers.derive import wording
from placekeepers.derive.flags import FLAG_NOTES, HELP_ROUTES, NOTICES, full_flag
from placekeepers.publish import publish
from placekeepers.registry import load_registry

from .conftest import REPO_ROOT, install_snapshot

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)
FETCHED = "2026-10-04T14:00:00Z"
LNG0, LAT0 = -75.140, 39.995

# account: (x, y) cell on a small grid, about 30 meters apart
PLACES = {
    "371000001": (0, 0),
    "372000001": (1, 0),
    "372000002": (2, 0),
    "372000003": (3, 0),
    "372000004": (4, 0),
    "372000005": (5, 0),
    "373000001": (0, 1),
    "373000002": (1, 1),
    "374000001": (2, 1),
    "374000002": (3, 1),
    "375000001": (4, 1),
    "885000001": (5, 1),
    "372000006": (6, 0),
}


def where(account: str) -> tuple[float, float]:
    x, y = PLACES[account]
    return LNG0 + x * 0.0004, LAT0 + y * 0.0003


def parcel_box(account: str):
    lng, lat = where(account)
    return box(lng - 0.00012, lat - 0.00009, lng + 0.00012, lat + 0.00009)


def wkb(geometry) -> bytes:
    return shapely.to_wkb(geometry, flavor="iso")


def d(text: str | None) -> date | None:
    return date.fromisoformat(text) if text else None


OPA_ROWS = [
    # account, location, owner_1, owner_2, street, city_state, zip, sale_date, sale_price, category
    (
        "371000001",
        "2931 N LAWRENCE ST",
        "MORALES ROSA",
        None,
        "41 ORCHARD RD",
        "CHERRY HILL NJ",
        "08002",
        "1987-06-12",
        15000,
        "6",
    ),
    *[
        (
            f"37200000{i}",
            f"{2900 + i * 2} N 5TH ST",
            "KENSINGTON LOTS LLC",
            None,
            "1500 WALNUT ST STE 900",
            "PHILADELPHIA PA",
            "19102",
            "2025-01-15",
            61000,
            "6" if i < 6 else "1",  # the sixth only the vacancy model finds
        )
        for i in range(1, 7)
    ],
    (
        "373000001",
        "2950 N 6TH ST",
        "PHILADELPHIA LAND BANK",
        None,
        "1234 MARKET ST 17TH FL",
        "PHILADELPHIA PA",
        "19107",
        "2018-12-28",
        13100,
        "6",
    ),
    (
        "373000002",
        "2952 N 6TH ST",
        "REDEVELOPMENT AUTHORITY",
        "OF PHILADELPHIA",
        "1234 MARKET ST",
        "PHILADELPHIA PA",
        "19107",
        None,
        None,
        "1",
    ),
    (
        "374000001",
        "529 W CAMBRIA ST",
        "BOWMAN LEROY",
        "BOWMAN EVELYN ESTATE OF",
        "531 W CAMBRIA ST",
        "PHILADELPHIA PA",
        "19133",
        "2018-08-17",
        18950,
        "1",
    ),
    (
        "374000002",
        "2960 N 7TH ST",
        "WALLACE GLORIA",
        None,
        "2960 N 7TH ST",
        "PHILADELPHIA PA",
        "19133",
        "1999-04-01",
        1,
        "1",
    ),
    (
        "375000001",
        "2970 N 8TH ST",
        "CEDAR HOLDINGS LLC",
        None,
        "2970 N 8TH ST",
        "PHILADELPHIA PA",
        "19133",
        "2012-03-01",
        9000,
        "6",
    ),
    (
        "885000001",
        "3001 N 9TH ST",
        "OWENS TERRENCE",
        None,
        "3001 N 9TH ST",
        "PHILADELPHIA PA",
        "19133",
        None,
        None,
        "6",
    ),
]


def opa_table(homestead: dict[str, int] | None = None) -> pa.Table:
    """OPA's records of the made up parcels; `homestead` replaces the homestead exemptions."""
    exemptions = HOMESTEAD if homestead is None else homestead
    rows = [dict(zip(OPA_KEYS, row, strict=True)) for row in OPA_ROWS]
    out: dict[str, list[Any]] = {name: [] for name in OPA_COLUMNS}
    for row in rows:
        lng, lat = where(row["parcel_number"])
        out["parcel_number"].append(row["parcel_number"])
        out["location"].append(row["location"])
        out["owner_1"].append(row["owner_1"])
        out["owner_2"].append(row["owner_2"])
        out["mailing_care_of"].append(None)
        out["mailing_address_1"].append(None)
        out["mailing_address_2"].append(None)
        out["mailing_street"].append(row["mailing_street"])
        out["mailing_city_state"].append(row["mailing_city_state"])
        out["mailing_zip"].append(row["mailing_zip"])
        out["sale_date"].append(d(row["sale_date"]))
        out["sale_price"].append(row["sale_price"])
        out["lat"].append(lat)
        out["lng"].append(lng)
        out["category_code"].append(row["category_code"])
        out["exterior_condition"].append(None)
        out["homestead_exemption"].append(exemptions.get(row["parcel_number"], 0))
    return pa.table(
        {
            **{
                k: out[k]
                for k in OPA_COLUMNS
                if k not in {"sale_date", "sale_price", "homestead_exemption"}
            },
            "sale_date": pa.array(out["sale_date"], pa.date32()),
            "sale_price": pa.array(out["sale_price"], pa.int64()),
            "homestead_exemption": pa.array(out["homestead_exemption"], pa.int64()),
        }
    )


#: owner occupied homestead exemptions, in dollars, by account (every other account has none)
HOMESTEAD = {"885000001": 100000}

OPA_KEYS = (
    "parcel_number",
    "location",
    "owner_1",
    "owner_2",
    "mailing_street",
    "mailing_city_state",
    "mailing_zip",
    "sale_date",
    "sale_price",
    "category_code",
)
OPA_COLUMNS = (
    "parcel_number",
    "location",
    "owner_1",
    "owner_2",
    "mailing_care_of",
    "mailing_address_1",
    "mailing_address_2",
    "mailing_street",
    "mailing_city_state",
    "mailing_zip",
    "sale_date",
    "sale_price",
    "lat",
    "lng",
    "category_code",
    "exterior_condition",
    "homestead_exemption",
)


def dates(values: list[str | None]) -> pa.Array:
    return pa.array([d(v) for v in values], pa.date32())


def install_everything(ctx) -> None:
    install = lambda source, table, geometry=False, types=None: install_snapshot(  # noqa: E731
        ctx, source, table, geometry=geometry, fetched_at=FETCHED, geometry_types=types
    )
    install("opa_properties", opa_table())
    land = ["371000001", "372000001", "372000002", "372000003", "372000004", "372000005"]
    land += ["373000001", "885000001", "375000001"]
    install(
        "vacant_indicators_land",
        pa.table(
            {
                "opa_id": land,
                "bldg_desc": ["VAC LAND RES < ACRE"] * len(land),
                "geometry": [wkb(parcel_box(a)) for a in land],
            }
        ),
        geometry=True,
    )
    install(
        "vacant_indicators_bldg",
        pa.table(
            {
                "opa_id": ["374000001"],
                "bldg_desc": ["ROW 2 STY MASONRY"],
                "geometry": [wkb(parcel_box("374000001"))],
            }
        ),
        geometry=True,
    )
    install(
        "city_owned_property",
        pa.table(
            {
                "opabrt": ["373000001", "373000002 ", None],
                "agency": ["PLB", "PRA", "PRA"],
                "status_1": ["Owned - Available", "Owned - On Hold", "Owned - On Hold"],
                "sideyardeligible": ["Yes", "Yes", "No"],
                "location": ["2950 N 6th St", "2952 N 6th St", "4755 - 57 N Franklin St"],
                "geometry": [wkb(parcel_box("373000001")), wkb(parcel_box("373000002")), None],
            }
        ),
        geometry=True,
    )
    install(
        "real_estate_transfers",
        pa.table(
            {
                "document_id": [1, 2, 3, 4, 5, 6, 7],
                "document_type": [
                    "SHERIFF'S DEED",
                    "MORTGAGE",
                    "DEED",
                    "DEED",
                    "DEED LAND BANK",
                    "DEED",
                    "MISCELLANEOUS DEED",
                ],
                "recording_date": dates(
                    [
                        "2016-08-09",
                        "2017-01-01",
                        "2024-02-01",
                        "2025-01-15",
                        "2018-12-28",
                        "2018-08-17",
                        "2002-02-02",
                    ]
                ),
                "opa_account_num": [
                    "371000001",
                    "371000001",
                    "372000001",
                    "372000001",
                    "373000001",
                    "374000001",
                    "374000001",
                ],
                "grantors": [
                    "MORALES ROSA",
                    "MORALES ROSA",
                    "DIAZ CARMEN",
                    "LEHIGH LOTS LLC",
                    "UNITED STATES OF AMERICA",
                    "FIRST STATE BANK",
                    "BOWMAN LEROY;BOWMAN EVELYN",
                ],
                "grantees": [
                    "MORALES ROSA",
                    "FIRST STATE BANK",
                    "LEHIGH LOTS LLC",
                    "KENSINGTON LOTS LLC",
                    "PHILADELPHIA LAND BANK",
                    "BOWMAN LEROY;BOWMAN EVELYN ESTATE OF",
                    "BOWMAN LEROY;BOWMAN EVELYN",
                ],
                "total_consideration": [12300.0, 50000.0, 20000.0, 61000.0, 13100.0, 18950.0, 1.0],
                "property_count": pa.array([1, 1, 1, 1, 1, 1, 1], pa.int32()),
            }
        ),
    )
    install(
        "assessment_history",
        pa.table(
            {
                "parcel_number": ["371000001", "371000001", "371000001"],
                "year": pa.array([2025, 2027, 2026], pa.int32()),
                "market_value": pa.array([11000, 13800, 13800], pa.int64()),
            }
        ),
    )
    install(
        "li_violations",
        pa.table(
            {
                "opa_account_num": ["371000001", "371000001", "374000001"],
                "violationnumber": ["V1", "V2", "V3"],
                "violationstatus": ["OPEN", "COMPLIED", "COMPLIED"],
                "violationdate": dates(["2025-08-01", "2023-05-05", "2021-02-02"]),
                "violationcodetitle": ["EXTERIOR AREA WEEDS", "RUBBISH & GARBAGE", "VACANT"],
                "casenumber": ["C1", "C2", "C3"],
            }
        ),
    )
    unsafe = {
        "opa_account_num": ["374000001", "376000001"],
        "casenumber": ["U1", "U2"],
        "violationdate": dates(["2024-03-03", "2019-01-01"]),
        "violationresolutiondate": dates([None, None]),
    }
    install("li_unsafe", pa.table(unsafe))
    install(
        "li_imminently_dangerous",
        pa.table(
            {
                "opa_account_num": ["374000001"],
                "casenumber": ["D1"],
                "violationdate": dates(["2026-09-30"]),
                "violationresolutiondate": dates([None]),
            }
        ),
    )
    install(
        "li_clean_and_seal",
        pa.table(
            {
                "opa_account_num": ["374000002"],
                "casecreateddate": dates(["2019-05-01"]),
                "workorderstatus": ["Approved"],
                "workordercompleteddate": dates(["2019-06-01"]),
            }
        ),
    )
    install(
        "li_demolitions",
        pa.table(
            {
                "opa_account_num": ["372000005"],
                "status": ["COMPLETED"],
                "start_date": dates(["2017-01-05"]),
                "completed_date": dates(["2017-02-01"]),
            }
        ),
    )
    install(
        "cagp_tax_2025",
        pa.table(
            {
                "opa_id": ["371000001", "373000001"],
                "total_due": [3512.4, 800.0],
                "num_years_owed": pa.array([6, 2], pa.int64()),
                "snapshot_date": dates(["2025-07-09", "2025-07-09"]),
            }
        ),
    )
    install(
        "phs_landcare",
        pa.table(
            {
                "brt_id": ["375000001", "373000001"],
                "program": ["CLC", "LandBank"],
                "year": ["2019", ""],
                "geometry": [wkb(parcel_box("375000001")), wkb(parcel_box("373000001"))],
            }
        ),
        geometry=True,
    )
    garden = Point(*where("375000001"))
    install(
        "gardens_phs_ngt",
        pa.table(
            {
                "site_name": ["Cedar Street Garden"],
                "supported": ["PHS"],
                "website": [None],
                "geometry": [wkb(garden)],
            }
        ),
        geometry=True,
        types=["Point"],
    )
    install(
        "pwd_parcels",
        pa.table(
            {
                "brt_id": list(PLACES),
                "geometry": [wkb(parcel_box(a)) for a in PLACES],
            }
        ),
        geometry=True,
    )
    lng, lat = where("371000001")
    install(
        "shootings",
        pa.table(
            {
                "date_": dates(["2026-09-01", "2024-01-01"]),
                "lat": [lat, lat],
                "lng": [lng, lng],
            }
        ),
    )


@pytest.fixture
def built(context_factory, tmp_path: Path) -> tuple[Any, Path]:
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    out = tmp_path / "data"
    result = publish(ctx, out)
    return result, out


def shard(out: Path, prefix: str) -> dict[str, Any]:
    return json.loads((out / "dossiers" / f"{prefix}.json").read_text(encoding="utf-8"))


def parcel(out: Path, account: str) -> dict[str, Any]:
    return shard(out, account[:4])["parcels"][account]


def common(out: Path) -> dict[str, Any]:
    return json.loads((out / "dossiers" / "common.json").read_text(encoding="utf-8"))


def test_one_shard_per_four_digit_prefix_summarized_in_the_manifest(built) -> None:
    result, out = built
    files = sorted(p.name for p in (out / "dossiers").iterdir())
    shards = ["3710.json", "3720.json", "3730.json", "3740.json", "3750.json", "8850.json"]
    assert files == [*shards, "common.json"]
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert manifest == result.manifest
    # The shards are summarized, not listed: the manifest every visitor fetches stays small.
    sizes = [(out / "dossiers" / name).stat().st_size for name in shards]
    assert manifest["dossiers"] == {
        "prefix_digits": 4,
        "prefixes": ["3710", "3720", "3730", "3740", "3750", "8850"],
        "files": 6,
        "bytes": sum(sizes),
    }
    assert not any(re.fullmatch(r"dossiers/\d+\.json", name) for name in manifest["files"])
    assert "dossiers/common.json" in manifest["files"]
    assert "tables/owners.json" in manifest["files"]
    # Everything on disk is either listed in `files` or a shard the block names.
    on_disk = sorted(p.relative_to(out).as_posix() for p in out.rglob("*") if p.is_file())
    named = [f"dossiers/{prefix}.json" for prefix in manifest["dossiers"]["prefixes"]]
    assert on_disk == sorted([*manifest["files"], *named, "manifest.json"])
    assert result.dossiers.parcels == 12
    assert result.dossiers.shards == 6
    assert result.dossiers.largest == max(sizes)
    assert result.dossiers.common_bytes == (out / "dossiers" / "common.json").stat().st_size
    # 376000001 is known only to an old L&I record: no dossier, so no 3760 shard.
    assert (
        "1 candidate accounts are no longer in OPA's records and get no lot dossier"
        in result.manifest["notes"]
    )


def test_shards_hold_parcels_and_common_holds_the_shared_flag_notes(built) -> None:
    _, out = built
    shared = common(out)
    assert list(shared) == ["schema", "generated_at", "flags", "notices"]
    assert shared["schema"] == 1
    assert shared["generated_at"] == "2026-10-04T15:00:00Z"
    assert shared["flags"] == FLAG_NOTES
    assert shared["notices"] == NOTICES
    body = shard(out, "3710")
    assert list(body) == ["schema", "generated_at", "parcels"]
    assert body["schema"] == 1
    assert body["generated_at"] == "2026-10-04T15:00:00Z"
    record = body["parcels"]["371000001"]
    assert list(record) == [
        "address",
        "vacancy",
        "owner",
        "transfers",
        "assessments",
        "li",
        "routes",
        "suggestions",
        "nearby",
    ]


def test_a_private_vacant_lot(built) -> None:
    _, out = built
    record = parcel(out, "371000001")
    assert record["address"] == "2931 N LAWRENCE ST"
    # No vacancy model has run here: like the map, the City's land list alone (reason bit 0).
    assert record["vacancy"] == {"kind": "lot", "confidence": "medium", "rs": 1, "n": 0}
    owner = record["owner"]
    assert owner["names"] == ["MORALES ROSA"]
    assert owner["mailing"] == "41 ORCHARD RD, CHERRY HILL NJ 08002"
    assert owner["type"] == "individual"
    assert [flag["id"] for flag in owner["flags"]] == [
        "absentee",
        "tax_debt_2025",
        "sheriff_sales",
        "years_since_sale",
        "open_violations",
    ]
    texts = {flag["id"]: flag["text"] for flag in owner["flags"]}
    assert texts == {
        "absentee": "The owner gets mail somewhere else: Cherry Hill, NJ (out of state).",
        "tax_debt_2025": (
            "As of July 2025, City records showed $3,512 in unpaid real estate taxes from 6 tax "
            "years."
        ),
        "sheriff_sales": "Sold at sheriff sale on August 9, 2016, for $12,300.",
        "years_since_sale": "Last sold in 1987.",
        "open_violations": (
            "L&I lists 1 open violation, for exterior area weeds, from August 1, 2025."
        ),
    }
    assert owner["notice"] == "deed_fraud"
    assert owner["help"] == ["tangled_title_help", "fraud_guard"]
    # Deeds only (the mortgage is left out), newest first.
    assert record["transfers"] == [
        {
            "date": "2016-08-09",
            "type": "SHERIFF'S DEED",
            "price": 12300,
            "from": ["MORALES ROSA"],
            "to": ["MORALES ROSA"],
        }
    ]
    assert record["assessments"] == [[2027, 13800], [2026, 13800], [2025, 11000]]
    assert record["li"] == {
        "open_violations": 1,
        "last_violation": "2025-08-01",
        "unsafe": False,
        "imminently_dangerous": False,
        "violations": 2,
    }
    assert record["routes"] == ["ask_the_owner", "conservatorship"]
    assert record["suggestions"] == ["clean_and_green"]
    assert record["nearby"]["s12"] == 1 and record["nearby"]["s36"] == 2


def test_an_owner_with_many_vacant_parcels_links_to_the_list(built) -> None:
    _, out = built
    record = parcel(out, "372000001")
    flags = {flag["id"]: flag for flag in record["owner"]["flags"]}
    assert flags["many_parcels"]["text"] == "This owner holds 5 vacant parcels in the city."
    list_id = flags["many_parcels"]["data"]["list"]
    table = json.loads((out / "tables" / "owners.json").read_text(encoding="utf-8"))
    assert table["min_parcels"] == 5
    assert table["owners"] == {
        list_id: {
            "names": ["KENSINGTON LOTS LLC"],
            "parcels": [
                {
                    "id": f"37200000{i}",
                    "address": f"{2900 + i * 2} N 5TH ST",
                    "kind": "lot",
                    "confidence": "medium",
                }
                for i in range(1, 6)
            ],
        }
    }
    assert flags["fast_resales"]["text"] == "Sold 2 times since 2024."
    assert "notice" not in record["owner"]  # a company: no deed fraud notice
    assert parcel(out, "372000005")["li"]["demolished"] == "2017-02-01"


def test_land_bank_and_redevelopment_authority_lots(built) -> None:
    _, out = built
    land_bank = parcel(out, "373000001")
    assert land_bank["owner"]["type"] == "land_bank"
    assert land_bank["owner"]["city_owned"] == {
        "agency": "PLB",
        "status": "Owned - Available",
        "side_yard_eligible": True,
    }
    assert land_bank["routes"] == [
        "community_landcare",
        "land_bank_garden_agreement",
        "land_bank_side_yard",
    ]
    assert land_bank["landcare"] == {"program": "land_bank"}
    assert [flag["id"] for flag in land_bank["owner"]["flags"]] == ["tax_debt_2025"]
    assert "help" not in land_bank["owner"] and "notice" not in land_bank["owner"]
    pra = parcel(out, "373000002")
    assert pra["owner"]["type"] == "redevelopment_authority"
    assert pra["routes"] == ["contact_phdc"]
    assert pra["vacancy"] is None and pra["suggestions"] == []


def test_a_possible_estate_with_an_unsafe_building(built) -> None:
    _, out = built
    record = parcel(out, "374000001")
    flags = {flag["id"]: flag for flag in record["owner"]["flags"]}
    assert set(flags) == {"possible_estate", "years_since_sale", "unsafe", "imminently_dangerous"}
    estate = full_flag(flags["possible_estate"])
    assert estate["text"] == wording.ESTATE_TEXT
    assert estate["careful"] == wording.ESTATE_CAREFUL
    assert record["owner"]["notice"] == "deed_fraud"
    assert record["vacancy"]["kind"] == "building"
    assert record["suggestions"] == ["seal_abandoned_building"]
    assert record["li"]["unsafe_since"] == "2024-03-03"
    assert record["li"]["imminently_dangerous_since"] == "2026-09-30"
    # The neighbor's address on the same block is not "somewhere else".
    assert "absentee" not in flags
    # Both deeds, the token transfer included, newest first.
    assert [t["type"] for t in record["transfers"]] == ["DEED", "MISCELLANEOUS DEED"]


def test_no_conservatorship_where_we_do_not_call_the_parcel_vacant(built) -> None:
    _, out = built
    record = parcel(out, "374000002")
    assert record["vacancy"] is None
    assert record["routes"] == ["ask_the_owner"]
    assert record["li"]["sealed"] == "2019-06-01"
    sale = {flag["id"]: flag for flag in record["owner"]["flags"]}["years_since_sale"]
    assert sale["text"] == "Not sold on the open market since at least 1999."


def test_no_conservatorship_on_a_parcel_with_a_homestead_exemption(built) -> None:
    # docs/VERIFICATION.md D1: a homestead exemption is the City's own record that someone lives
    # there (or did), so conservatorship is never offered, whatever the vacancy call.
    _, out = built
    home = parcel(out, "885000001")
    assert home["owner"]["type"] == "individual"
    assert home["vacancy"]["confidence"] == "medium"
    assert home["routes"] == ["ask_the_owner"]
    assert parcel(out, "371000001")["routes"] == ["ask_the_owner", "conservatorship"]


def test_a_garden_lot_in_community_landcare(built) -> None:
    _, out = built
    record = parcel(out, "375000001")
    assert record["garden"] is True
    assert record["landcare"] == {"program": "community_landcare", "year": 2019}
    assert record["routes"] == [
        "community_landcare",
        "ask_the_owner",
        "garden_adverse_possession",
        "conservatorship",
    ]
    assert record["nearby"]["gardens_within_500ft"] == 1
    assert record["nearby"]["landcare_within_500ft"] == 2


def test_the_lots_layer_carries_the_owner_type(built) -> None:
    _, out = built
    layer = json.loads((out / "tiles" / "lots.parcels.geojson").read_text(encoding="utf-8"))
    ot = {f["properties"]["id"]: f["properties"]["ot"] for f in layer["features"]}
    assert ot["371000001"] == 1
    assert ot["372000001"] == 2
    assert ot["373000001"] == 4
    assert ot["374000001"] == 1


# The map's first step (`rt`) and the dossier's first route always agree.
FIRST_STEP = {
    "community_landcare": 1,
    "land_bank_garden_agreement": 2,
    "land_bank_side_yard": 2,
    "contact_phdc": 3,
}


def expected_rt(dossier: dict[str, Any]) -> int:
    """The rt code docs/CONTRACTS.md gives for the dossier's first route and owner type."""
    routes = dossier["routes"]
    if not routes:
        return 0
    if routes[0] in FIRST_STEP:
        return FIRST_STEP[routes[0]]
    return 4 if dossier["owner"]["type"] in {"housing_authority", "other_public"} else 5


def map_and_dossiers_agree(out: Path) -> dict[str, int]:
    """Every lot on the map that has a dossier: its rt, after checking it against the dossier."""
    layer = json.loads((out / "tiles" / "lots.parcels.geojson").read_text(encoding="utf-8"))
    found = {}
    for feature in layer["features"]:
        account = feature["properties"]["id"]
        path = out / "dossiers" / f"{account[:4]}.json"
        if not path.is_file():
            continue
        dossier = json.loads(path.read_text(encoding="utf-8"))["parcels"].get(account)
        if dossier is None:
            continue
        assert feature["properties"]["rt"] == expected_rt(dossier), (account, dossier["routes"])
        found[account] = feature["properties"]["rt"]
    return found


def test_the_lots_first_step_matches_the_dossiers_first_route(built) -> None:
    _, out = built
    rt = map_and_dossiers_agree(out)
    assert rt["371000001"] == 5  # a person: ask the owner
    assert rt["373000001"] == 1  # the Land Bank, but PHS LandCare already cares for it
    assert rt["375000001"] == 1
    assert rt["374000001"] == 5


EVERY_FIRST_STEP = {
    # account: (owner_1, City agency, on PHS's LandCare list, rt)
    "381000001": (None, None, False, 0),  # no owner name at all
    "381000002": ("KENSINGTON LOTS LLC", None, True, 1),
    "381000003": ("PHILADELPHIA LAND BANK", "PLB", False, 2),
    "381000004": ("REDEVELOPMENT AUTHORITY", "PRA", False, 3),
    "381000005": ("PHILADELPHIA HOUSING AUTH", None, False, 4),
    "381000006": ("MORALES ROSA", None, False, 5),
    "381000007": ("HACE", None, False, 5),  # a name we could not type
}


def test_every_first_step_on_the_map_matches_its_dossier(
    context_factory, tmp_path, monkeypatch
) -> None:
    ctx = context_factory(now=NOW)
    accounts = list(EVERY_FIRST_STEP)
    for i, account in enumerate(accounts):
        monkeypatch.setitem(PLACES, account, (i, 3))
    opa = {name: [None] * len(accounts) for name in OPA_COLUMNS}
    opa["parcel_number"] = accounts
    opa["location"] = [f"{2900 + 2 * i} N 5TH ST" for i in range(len(accounts))]
    opa["owner_1"] = [EVERY_FIRST_STEP[a][0] for a in accounts]
    opa["lat"] = [LAT0] * len(accounts)
    opa["lng"] = [LNG0] * len(accounts)
    opa["sale_date"] = pa.array([None] * len(accounts), pa.date32())
    opa["sale_price"] = pa.array([None] * len(accounts), pa.int64())
    install_snapshot(ctx, "opa_properties", pa.table(opa), geometry=False, fetched_at=FETCHED)
    owned = [a for a in accounts if EVERY_FIRST_STEP[a][1]]
    install_snapshot(
        ctx,
        "city_owned_property",
        pa.table(
            {
                "opabrt": owned,
                "agency": [EVERY_FIRST_STEP[a][1] for a in owned],
                "status_1": ["Available"] * len(owned),
                "sideyardeligible": ["No"] * len(owned),
                "location": [None] * len(owned),
                "geometry": [wkb(box(LNG0, LAT0, LNG0 + 0.0001, LAT0 + 0.0001))] * len(owned),
            }
        ),
        geometry=True,
        fetched_at=FETCHED,
    )
    cared = [a for a in accounts if EVERY_FIRST_STEP[a][2]]
    install_snapshot(
        ctx,
        "phs_landcare",
        pa.table(
            {
                "brt_id": cared,
                "program": ["PLC"] * len(cared),
                "year": ["2020"] * len(cared),
                "geometry": [wkb(box(LNG0, LAT0, LNG0 + 0.0001, LAT0 + 0.0001))] * len(cared),
            }
        ),
        geometry=True,
        fetched_at=FETCHED,
    )
    write_model(
        ctx,
        [(a, "lot", 1, "high", 3, 0, 8, 1, None, None, None) for a in accounts],
    )
    out = tmp_path / "data"
    publish(ctx, out)
    rt = map_and_dossiers_agree(out)
    assert rt == {a: EVERY_FIRST_STEP[a][3] for a in accounts}


def test_every_flag_id_used_has_shared_notes_and_every_route_exists(built) -> None:
    _, out = built
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    shared = common(out)
    for route in [r for notes in shared["flags"].values() for r in notes.get("routes", [])]:
        assert route in registry.routes
    for path in (out / "dossiers").glob("[0-9]*.json"):
        body = json.loads(path.read_text(encoding="utf-8"))
        for record in body["parcels"].values():
            for flag in record["owner"]["flags"]:
                assert flag["id"] in shared["flags"]
                assert set(flag) <= {"id", "text", "data"}
            for route in [*record["routes"], *record["owner"].get("help", [])]:
                assert route in registry.routes
            for suggestion in record["suggestions"]:
                assert suggestion in registry.suggestions


# Things we do not build (docs/ETHICS.md), and personal details we never publish.
FORBIDDEN_KEY = re.compile(
    r"acqui|estimat|eas(y|e|iest)|score|rank|offer|bid|deal|profit|letter|outreach|mail_merge"
    r"|send|buy|purchase|race|sex|gender|birth|phone|email|ssn|case_?number",
    re.IGNORECASE,
)
FORBIDDEN_TEXT = re.compile(
    r"easiest|easy to take|owner deceased|no heirs|bargain|investment|below market|\bpolice\b",
    re.IGNORECASE,
)


def walk(value: Any, path: str = "") -> list[tuple[str, str, Any]]:
    """Every key and every text value, as ("key" or "value", where, what)."""
    found: list[tuple[str, str, Any]] = []
    if isinstance(value, dict):
        for key, item in value.items():
            found.append(("key", f"{path}.{key}", key))
            found.extend(walk(item, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            found.extend(walk(item, f"{path}[{index}]"))
    elif isinstance(value, str):
        found.append(("value", path, value))
    return found


def check_no_forbidden(body: Any) -> None:
    for kind, where_, what in walk(body):
        if kind == "key":
            assert not FORBIDDEN_KEY.search(what), f"forbidden field {where_}"
            assert what != "age", f"forbidden field {where_}"
        else:
            assert not FORBIDDEN_TEXT.search(what), f"{where_}: {what!r}"


def test_nothing_ethics_rules_out_is_published(built) -> None:
    _, out = built
    for path in [*(out / "dossiers").iterdir(), out / "tables" / "owners.json"]:
        body = json.loads(path.read_text(encoding="utf-8"))
        check_no_forbidden(body)
        text = path.read_text(encoding="utf-8")
        for case_number in ("C1", "C2", "C3", "U1", "U2", "D1"):
            assert f'"{case_number}"' not in text, f"{path.name} has an L&I case number"


@pytest.mark.parametrize(
    "bad",
    [
        {"acquisition_price": 1000},
        {"price_estimate": 1},
        {"ease_of_acquisition": 3},
        {"easiest_rank": 1},
        {"score": 99},
        {"letter": "Dear owner"},
        {"owner": {"phone": "215"}},
        {"age": 54},
        {"note": "Easiest to take on the block"},
        {"note": "owner deceased"},
    ],
)
def test_the_guard_catches_forbidden_fields(bad: dict) -> None:
    with pytest.raises(AssertionError):
        check_no_forbidden({"parcels": {"371000001": bad}})


def test_without_opa_there_are_no_dossiers(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=NOW)
    install_snapshot(
        ctx,
        "vacant_indicators_land",
        pa.table(
            {
                "opa_id": ["371000001"],
                "bldg_desc": ["VAC LAND"],
                "geometry": [wkb(parcel_box("371000001"))],
            }
        ),
        geometry=True,
        fetched_at=FETCHED,
    )
    result = publish(ctx, tmp_path / "data")
    assert "lot dossiers have no usable data yet (no OPA properties)" in result.manifest["notes"]
    assert not any(name.startswith("dossiers/") for name in result.manifest["files"])
    assert result.manifest["dossiers"] is None
    assert not (tmp_path / "data" / "dossiers").exists()


def write_model(ctx, rows: list[tuple]) -> None:
    """A vacancy model output (derived/vacancy.parquet) with the columns the lots layer and the
    dossiers read: opa, kind, k, confidence, vc, lc, rs, n, dy, sy, ny and the parcel shape."""
    names = ["opa", "kind", "k", "confidence", "vc", "lc", "rs", "n", "dy", "sy", "ny"]
    columns: dict[str, list[Any]] = {name: [] for name in names}
    for row in rows:
        for name, value in zip(names, row, strict=True):
            columns[name].append(value)
    table = pa.table(
        {
            **{name: columns[name] for name in ("opa", "kind", "confidence")},
            **{
                name: pa.array(columns[name], pa.int32())
                for name in ("k", "vc", "lc", "rs", "n", "dy", "sy", "ny")
            },
            "geometry": [wkb(parcel_box(row[0])) for row in rows],
        }
    )
    path = ctx.cache.root / "derived" / "vacancy.parquet"
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path)


def test_the_dossier_and_the_map_follow_the_vacancy_model(context_factory, tmp_path) -> None:
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    write_model(
        ctx,
        [
            # opa, kind, k, confidence, vc, lc, rs, n, dy, sy, ny
            ("371000001", "lot", 1, "high", 3, 0, 1 | 4 | 8, 2, None, None, None),
            *[
                (f"37200000{i}", "lot", 1, "high", 3, 0, 1 | 8, 1, None, None, None)
                for i in range(1, 5)
            ],
            ("372000005", "lot", 1, "low", 1, 0, 16, 1, 2017, None, None),
            ("372000006", "lot", 1, "medium", 2, 0, 4 | 8, 2, None, None, None),
            ("373000001", "lot", 1, "high", 3, 1, 1 | 64, 2, None, None, None),
            ("374000002", "building", 2, "low", 1, 0, 128 | 2048, 1, None, 2019, None),
            ("885000001", "excluded", None, None, None, 0, 0, 0, None, None, None),
        ],
    )
    out = tmp_path / "data"
    publish(ctx, out)

    assert parcel(out, "371000001")["vacancy"] == {
        "kind": "lot",
        "confidence": "high",
        "rs": 13,
        "n": 2,
    }
    sealed = parcel(out, "374000002")
    assert sealed["vacancy"] == {
        "kind": "building",
        "confidence": "low",
        "rs": 2176,
        "n": 1,
        "sy": 2019,
    }
    assert sealed["suggestions"] == ["seal_abandoned_building"]
    # Low confidence: it may be someone's home, so no conservatorship.
    assert sealed["routes"] == ["ask_the_owner"]
    left_out = parcel(out, "885000001")
    assert left_out["vacancy"] is None and left_out["suggestions"] == []
    assert left_out["routes"] == ["ask_the_owner"]
    # The vacancy model's own parcels get dossiers too, even outside the candidates.
    assert parcel(out, "372000006")["vacancy"]["confidence"] == "medium"
    # Five parcels called vacant with high or medium confidence; the low one does not count.
    flags = {flag["id"]: flag for flag in parcel(out, "372000001")["owner"]["flags"]}
    assert flags["many_parcels"]["text"] == "This owner holds 5 vacant parcels in the city."
    table = json.loads((out / "tables" / "owners.json").read_text(encoding="utf-8"))
    listed = table["owners"][flags["many_parcels"]["data"]["list"]]["parcels"]
    assert [item["id"] for item in listed] == [
        "372000001",
        "372000002",
        "372000003",
        "372000004",
        "372000006",
    ]
    assert listed[0] == {
        "id": "372000001",
        "address": "2902 N 5TH ST",
        "kind": "lot",
        "confidence": "high",
    }
    assert listed[-1]["confidence"] == "medium"
    # The map's first step agrees with every dossier, and a lot the model marks as LandCare by its
    # shape (not on PHS's list of accounts) lists Community LandCare first in both.
    rt = map_and_dossiers_agree(out)
    assert rt["373000001"] == 1
    assert parcel(out, "373000001")["routes"][0] == "community_landcare"
    assert rt["371000001"] == 5
    # The map's lots carry the owner type from the model's path as well.
    layer = json.loads((out / "tiles" / "lots.parcels.geojson").read_text(encoding="utf-8"))
    ot = {f["properties"]["id"]: f["properties"]["ot"] for f in layer["features"]}
    assert ot == {
        "371000001": 1,
        "372000001": 2,
        "372000002": 2,
        "372000003": 2,
        "372000004": 2,
        "372000005": 2,
        "372000006": 2,
        "373000001": 4,
        "374000002": 1,
    }


def test_flags_about_an_owner_who_may_be_a_person_wait_for_a_vacancy_call(
    context_factory, tmp_path
) -> None:
    # docs/VERIFICATION.md D5 and D6: on a parcel we do not call vacant with high or medium
    # confidence, which may be someone's home, the flags about an owner who may be a person are
    # held back; possible estate never shows with a homestead exemption.
    ctx = context_factory(now=NOW)
    install_everything(ctx)
    install_snapshot(
        ctx,
        "opa_properties",
        opa_table({**HOMESTEAD, "374000001": 100000}),
        geometry=False,
        fetched_at="2026-10-04T14:30:00Z",
    )
    write_model(
        ctx,
        [
            # opa, kind, k, confidence, vc, lc, rs, n, dy, sy, ny
            ("371000001", "lot", 1, "low", 1, 0, 1, 1, None, None, None),
            *[(f"37200000{i}", "lot", 1, "low", 1, 0, 1, 1, None, None, None) for i in range(1, 6)],
            ("374000001", "building", 2, "high", 3, 0, 2, 2, None, None, None),
        ],
    )
    out = tmp_path / "data"
    publish(ctx, out)

    home = parcel(out, "371000001")
    owner = home["owner"]
    # Absentee and tax debt are held back; the facts about the parcel stay, and so do the
    # owner's name and mailing address as the City publishes them.
    assert [flag["id"] for flag in owner["flags"]] == [
        "sheriff_sales",
        "years_since_sale",
        "open_violations",
    ]
    assert owner["names"] == ["MORALES ROSA"]
    assert owner["mailing"] == "41 ORCHARD RD, CHERRY HILL NJ 08002"
    assert owner["notice"] == "deed_fraud" and owner["help"] == HELP_ROUTES
    assert home["routes"] == ["ask_the_owner"]
    # A company keeps every flag on a parcel we are not sure about.
    company = {flag["id"] for flag in parcel(out, "372000001")["owner"]["flags"]}
    assert "years_since_sale" in company
    # A possible estate on a parcel with a homestead exemption: no estate flag and no
    # conservatorship, even where we call the building very likely vacant.
    estate = parcel(out, "374000001")
    assert [flag["id"] for flag in estate["owner"]["flags"]] == [
        "years_since_sale",
        "unsafe",
        "imminently_dangerous",
    ]
    assert estate["owner"]["notice"] == "deed_fraud"
    assert estate["routes"] == ["ask_the_owner"]


def test_deeds_carry_the_date_and_price_the_city_page_shows(tmp_path: Path) -> None:
    """The date on the deed (else the document date, else the recording date) and the adjusted
    total (this property's share), else the total consideration, as the City's property page
    shows them; a snapshot made before those columns were fetched still reads."""
    import duckdb

    from placekeepers.publish.dossiers import read_transfers

    path = tmp_path / "transfers.parquet"
    pq.write_table(
        pa.table(
            {
                "opa_account_num": ["372000001", "372000001", "372000001"],
                "document_id": [1, 2, 3],
                "document_type": ["DEED", "DEED", "SHERIFF'S DEED"],
                "display_date": dates(["2023-12-28", None, None]),
                "document_date": dates(["2023-12-28", "2019-03-01", None]),
                "recording_date": dates(["2024-01-03", "2019-03-20", "2016-08-09"]),
                "grantors": ["A", "B", "C"],
                "grantees": ["D", "E", "F"],
                "adjusted_total_consideration": pa.array([17500.25, None, None], pa.float64()),
                "total_consideration": pa.array([70001.0, 40000.0, 12300.0], pa.float64()),
                "property_count": [4, 1, 1],
            }
        ),
        path,
    )
    older = tmp_path / "older.parquet"
    pq.write_table(
        pa.table(
            {
                "opa_account_num": ["372000001"],
                "document_id": [9],
                "document_type": ["DEED"],
                "recording_date": dates(["2010-05-05"]),
                "grantors": ["G"],
                "grantees": ["H"],
                "total_consideration": pa.array([5000.0], pa.float64()),
                "property_count": [1],
            }
        ),
        older,
    )
    con = duckdb.connect()
    con.execute("CREATE TABLE acc AS SELECT '372000001' AS a")
    [deeds] = read_transfers(con, path).values()
    assert [(t.date.isoformat(), t.price) for t in deeds] == [
        ("2023-12-28", 17500.25),
        ("2019-03-01", 40000.0),
        ("2016-08-09", 12300.0),
    ]
    assert deeds[0].to_json()["price"] == 17500.25
    [old] = read_transfers(con, older).values()
    assert [(t.date.isoformat(), t.price) for t in old] == [("2010-05-05", 5000.0)]
