# ruff: noqa: E501 (fixture rows are kept one record per line, as the sources write them)
"""Who represents each lot (M5.1, issue #45): the district and officeholder sources, each parcel's
`represent`, and tables/contacts.json. Small synthetic fixtures only; no network."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path

import geopandas as gpd
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely.geometry import box

from placekeepers.adapters import ADAPTERS
from placekeepers.adapters.represent import (
    OPEN_STATES_COLUMNS,
    PaHouseDistricts,
    PaLegislators,
    RcoContacts,
    UsHouseDistricts,
    UsLegislatorOffices,
    UsLegislators,
    congress_sitting,
)
from placekeepers.cache import RawFetch
from placekeepers.derive.represent import (
    Shapes,
    assembly_seats,
    assembly_website,
    congress_seats,
    council_seats,
    division_code,
    parcel_represent,
    phone_text,
    rco_contacts,
    vacant_seats,
    website,
)
from placekeepers.publish.contacts import CONTACTS_TABLE, build_contacts, represent_for
from placekeepers.runner import all_statuses, fetch_source, validate_source

from .conftest import install_snapshot

NOW = datetime(2026, 10, 21, 15, 0, 0, tzinfo=UTC)
AS_OF = date(2026, 10, 21)


def shapes(**squares: tuple[float, float, float, float]) -> Shapes:
    import numpy as np

    return Shapes(list(squares), np.array([box(*b) for b in squares.values()], dtype=object))


# The Congress sitting, and which district file is used ----------------------------------------


def test_the_congress_sitting_changes_on_january_3_of_odd_years() -> None:
    assert congress_sitting(date(2026, 10, 21)) == 119
    assert congress_sitting(date(2025, 1, 3)) == 119
    assert congress_sitting(date(2025, 1, 2)) == 118
    assert congress_sitting(date(2027, 1, 2)) == 119
    assert congress_sitting(date(2027, 1, 3)) == 120


def tiger_zip(field: str, districts: dict[str, tuple[float, float, float, float]]) -> bytes:
    frame = gpd.GeoDataFrame(
        {
            field: list(districts),
            "NAMELSAD": [f"District {d.lstrip('0')}" for d in districts],
            "GEOID": [f"42{d}" for d in districts],
        },
        geometry=[box(*b) for b in districts.values()],
        crs="EPSG:4269",
    )
    folder = Path(__import__("tempfile").mkdtemp())
    frame.to_file(folder / "tl.shp")
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for part in folder.iterdir():
            archive.write(part, part.name)
    return buffer.getvalue()


def test_the_congressional_file_is_the_sitting_congresss_from_the_newest_year(
    context_factory,
) -> None:
    asked: list[str] = []
    body = tiger_zip(
        "CD119FP",
        {
            "02": (-75.10, 39.95, -75.00, 40.10),
            "03": (-75.25, 39.90, -75.10, 40.10),
            "05": (-75.28, 39.87, -75.20, 39.92),
            "12": (-80.0, 40.3, -79.8, 40.5),
        },
    )

    def handler(request: httpx.Request) -> httpx.Response:
        asked.append(str(request.url))
        if "TIGER2025/CD/tl_2025_42_cd119.zip" in str(request.url):
            return httpx.Response(
                200, content=body, headers={"Last-Modified": "Mon, 22 Sep 2025 23:51:17 GMT"}
            )
        return httpx.Response(404, text="Not Found")

    ctx = context_factory(handler=handler, now=NOW)
    source = ctx.registry.sources["us_house_districts"]
    adapter = UsHouseDistricts(source, ctx)
    assert [link for link, _, _ in adapter.candidates(AS_OF)] == [
        "https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_42_cd119.zip",
        "https://www2.census.gov/geo/tiger/TIGER2025/CD/tl_2025_42_cd119.zip",
    ]
    fetch_source(ctx, source)
    assert asked[0].endswith("tl_2026_42_cd119.zip") and asked[-1].endswith("tl_2025_42_cd119.zip")
    validate_source(ctx, source)
    status = {s.id: s for s in all_statuses(ctx)}["us_house_districts"]
    assert status.status == "ok"
    table = pq.read_table(ctx.cache.root / "snapshots" / "us_house_districts" / "current.parquet")
    # The district in Pittsburgh is left out; numbers lose their leading zeros.
    assert table["district"].to_pylist() == ["2", "3", "5"]
    assert set(table["congress"].to_pylist()) == {119}
    assert set(table["year"].to_pylist()) == {2025}


def test_a_house_file_with_too_few_districts_fails_its_health_check(context_factory) -> None:
    body = tiger_zip("SLDLST", {"195": (-75.20, 39.97, -75.17, 39.99)})

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, content=body, headers={"Last-Modified": "Tue, 06 Oct 2026 23:34:53 GMT"}
        )

    ctx = context_factory(handler=handler, now=NOW)
    source = ctx.registry.sources["pa_house_districts"]
    fetch_source(ctx, source)
    validate_source(ctx, source)
    status = {s.id: s for s in all_statuses(ctx)}["pa_house_districts"]
    assert status.status != "ok"
    assert "rows" in (status.message or "")


def test_a_house_file_reads_the_district_numbers(context_factory, tmp_path: Path) -> None:
    ctx = context_factory(now=NOW)
    adapter = PaHouseDistricts(ctx.registry.sources["pa_house_districts"], ctx)
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    (raw_dir / "data.zip").write_bytes(
        tiger_zip(
            "SLDLST", {"010": (-75.22, 39.95, -75.20, 39.97), "195": (-75.20, 39.97, -75.17, 39.99)}
        )
    )
    raw = RawFetch(
        "pa_house_districts",
        "x",
        "2026-10-21T15:00:00Z",
        ["data.zip"],
        {"file": "data.zip", "year": 2026, "congress": None},
        raw_dir,
    )
    out = tmp_path / "out.parquet"
    adapter.normalize(raw, out)
    table = pq.read_table(out)
    assert table["district"].to_pylist() == ["10", "195"]
    assert table["name"].to_pylist() == ["District 10", "District 195"]
    assert "congress" not in table.column_names


# Officeholders' sources keep only official contact details ----------------------------------


OPEN_STATES_HEADER = [
    "id", "name", "current_party", "current_district", "current_chamber", "given_name", "family_name",
    "gender", "email", "biography", "birth_date", "death_date", "image", "links", "sources",
    "capitol_address", "capitol_voice", "capitol_fax", "district_address", "district_voice",
    "district_fax", "twitter", "youtube", "instagram", "facebook", "wikidata",
]  # fmt: skip


def open_states_csv(rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, OPEN_STATES_HEADER)
    writer.writeheader()
    for row in rows:
        writer.writerow({key: row.get(key, "") for key in OPEN_STATES_HEADER})
    return buffer.getvalue()


def legislator(name: str, chamber: str, district: str, **more: str) -> dict[str, str]:
    return {
        "id": f"ocd-person/{name.replace(' ', '-').lower()}",
        "name": name,
        "current_chamber": chamber,
        "current_district": district,
        "email": f"{name.split()[0].lower()}@example.org",
        "birth_date": "1970-01-01",
        "twitter": "@example",
        "image": "https://example.org/photo.jpg",
        "district_address": more.get("address", "1 Example St., Philadelphia, PA 19100"),
        "district_voice": more.get("phone", "(215) 555-0100"),
        "links": more.get(
            "links",
            "https://www.pahouse.com/Example/;https://www.palegis.us/house/members/bio/9999/rep-example",
        ),
    }


def test_open_states_keeps_no_email_photo_birth_date_or_social_media(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory(now=NOW)
    adapter = PaLegislators(ctx.registry.sources["pa_legislators"], ctx)
    raw_dir = tmp_path / "raw"
    raw_dir.mkdir()
    (raw_dir / "data.csv").write_text(open_states_csv([legislator("Rosa Example", "lower", "195")]))
    raw = RawFetch(
        "pa_legislators",
        "x",
        "2026-10-21T15:00:00Z",
        ["data.csv"],
        {"file": "data.csv", "format": "csv"},
        raw_dir,
    )
    out = tmp_path / "out.parquet"
    adapter.normalize(raw, out)
    table = pq.read_table(out)
    assert tuple(table.column_names) == OPEN_STATES_COLUMNS
    text = json.dumps(table.to_pylist())
    for left_out in ("@example.org", "1970-01-01", "photo.jpg", "@example"):
        assert left_out not in text


def congress_files(tmp_path: Path) -> tuple[Path, Path]:
    people = [
        {
            "id": {"bioguide": "E000296"},
            "name": {"first": "Dwight", "last": "Evans", "official_full": "Dwight Evans"},
            "bio": {"birthday": "1954-05-16"},
            "terms": [
                {"type": "rep", "state": "PA", "district": 2, "start": "2017-01-03", "end": "2019-01-03"},
                {"type": "rep", "state": "PA", "district": 3, "start": "2025-01-03", "end": "2027-01-03",
                 "url": "https://evans.house.gov", "phone": "202-225-4001",
                 "address": "1105 Longworth House Office Building Washington DC 20515-3803"},
            ],
        },
        {
            "id": {"bioguide": "S001205"},
            "name": {"official_full": "Mary Gay Scanlon"},
            "terms": [{"type": "rep", "state": "PA", "district": 5, "url": "https://scanlon.house.gov", "phone": "202-225-2011"}],
        },
        {
            "id": {"bioguide": "F000479"},
            "name": {"official_full": "John Fetterman"},
            "terms": [{"type": "sen", "state": "PA", "url": "https://www.fetterman.senate.gov"}],
        },
        {"id": {"bioguide": "X000001"}, "name": {"official_full": "Someone Else"}, "terms": [{"type": "rep", "state": "NJ", "district": 1}]},
    ]  # fmt: skip
    offices = [
        {"id": {"bioguide": "E000296"}, "offices": [
            {"id": "E000296-philadelphia", "address": "7174 Ogontz Ave.", "city": "Philadelphia", "state": "PA",
             "zip": "19138", "phone": "215-276-0340", "fax": "215-276-2939", "hours": "9 to 5", "latitude": 40.06},
        ]},
        {"id": {"bioguide": "S001205"}, "offices": [
            {"id": "S001205-chester", "address": "2501 Seaport Drive", "suite": "BH230", "city": "Chester",
             "state": "PA", "zip": "19013", "phone": "610-626-2020"},
        ]},
        {"id": {"bioguide": "X000001"}, "offices": [{"address": "1 Main St", "city": "Trenton", "state": "NJ", "phone": "1"}]},
    ]  # fmt: skip
    a, b = tmp_path / "people.json", tmp_path / "offices.json"
    a.write_text(json.dumps(people))
    b.write_text(json.dumps(offices))
    return a, b


def test_congress_keeps_pennsylvanias_members_and_offices_without_birthdays_or_fax(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory(now=NOW)
    people, offices = congress_files(tmp_path)
    out = tmp_path / "people.parquet"
    UsLegislators(ctx.registry.sources["us_legislators"], ctx).normalize(
        RawFetch("us_legislators", "x", "t", ["people.json"], {"file": "people.json"}, tmp_path),
        out,
    )
    rows = pq.read_table(out).to_pylist()
    assert [(r["name"], r["chamber"], r["district"]) for r in rows] == [
        ("Dwight Evans", "house", "3"),
        ("Mary Gay Scanlon", "house", "5"),
        ("John Fetterman", "senate", None),
    ]
    assert "1954" not in json.dumps(rows)
    out2 = tmp_path / "offices.parquet"
    UsLegislatorOffices(ctx.registry.sources["us_legislator_offices"], ctx).normalize(
        RawFetch(
            "us_legislator_offices", "x", "t", ["offices.json"], {"file": "offices.json"}, tmp_path
        ),
        out2,
    )
    office_rows = pq.read_table(out2).to_pylist()
    assert [r["city"] for r in office_rows] == ["Philadelphia", "Chester"]
    assert "276-2939" not in json.dumps(office_rows) and "9 to 5" not in json.dumps(office_rows)


def test_rco_contacts_never_download_the_contacts_own_address_or_the_alternate() -> None:
    fields = set(RcoContacts.out_fields or ())
    assert {"organization_name", "primary_name", "primary_phone", "primary_email"} <= fields
    assert not fields & {
        "primary_address",
        "alternate_name",
        "alternate_address",
        "alternate_email",
        "alternate_phone",
    }
    # The map's boundaries layer still reads its own source, which holds no contacts at all.
    community = ADAPTERS["community_organizations"].out_fields
    assert not set(community) & {"primary_name", "primary_phone", "primary_email"}


# Each parcel's represent ------------------------------------------------------------------------


def test_each_parcel_gets_its_ward_division_districts_and_organizations() -> None:
    points = {
        "100000001": (-75.195, 39.985),
        "100000002": (-75.185, 39.995),
        # Outside every shape: no keys at all.
        "100000003": (-76.5, 41.0),
    }
    found = parcel_represent(
        points,
        {
            "division": shapes(
                **{"719": (-75.20, 39.98, -75.19, 39.99), "3412": (-75.19, 39.99, -75.18, 40.00)}
            ),
            "council": shapes(**{"5": (-75.21, 39.97, -75.17, 40.01)}),
            "house": shapes(**{"195": (-75.21, 39.97, -75.17, 40.01)}),
        },
        shapes(**{"203": (-75.20, 39.98, -75.18, 40.00), "54": (-75.20, 39.98, -75.19, 39.99)}),
    )
    assert found == {
        "100000001": {
            "ward": "7",
            "division": "0719",
            "council": "5",
            "house": "195",
            "rcos": [54, 203],
        },
        "100000002": {
            "ward": "34",
            "division": "3412",
            "council": "5",
            "house": "195",
            "rcos": [203],
        },
    }


def test_a_neighboring_countys_district_never_reaches_a_parcel_at_the_citys_edge() -> None:
    # The City's boundary (its Council districts) ends at -75.10; district 18 lies beyond it and
    # its file reaches a few meters over the line, where one parcel's point is.
    city = {"1": (-75.20, 39.95, -75.10, 40.05)}
    edge_point = (-75.10002, 40.00)
    found = parcel_represent(
        {"200000001": edge_point, "200000002": (-75.15, 40.00)},
        {
            "council": shapes(**city),
            "house": shapes(
                **{
                    "170": (-75.20, 39.95, -75.10003, 40.05),
                    "18": (-75.10003, 39.95, -75.00, 40.05),
                }
            ),
        },
        None,
    )
    assert found["200000001"]["house"] == "170"
    assert found["200000002"]["house"] == "170"


def test_division_numbers_are_written_with_four_digits() -> None:
    assert division_code("719") == "0719"
    assert division_code("3412") == "3412"
    assert division_code("700") is None
    assert division_code("abc") is None


# The seats ------------------------------------------------------------------------------------


def test_phones_and_websites_are_written_the_same_way() -> None:
    assert phone_text("2156863458") == "215-686-3458"
    assert phone_text("(215) 555-0100") == "215-555-0100"
    assert phone_text("0") is None
    assert phone_text(None) is None
    assert website("phlcouncil.com/MarkSquilla") == "https://phlcouncil.com/MarkSquilla"
    assert website("http://example.org") == "https://example.org"
    assert (
        assembly_website(
            "https://www.pahouse.com/Carroll/;https://www.palegis.us/house/members/bio/2019/rep-carroll"
        )
        == "https://www.palegis.us/house/members/bio/2019/rep-carroll"
    )


def council_rows() -> list[dict]:
    return [
        {"office": "city_council", "district": 7, "first_name": "Quetcy", "last_name": "Lozada",
         "website": "phlcouncil.com/QuetcyLozada/", "main_contact_address_1": "1400 John F Kennedy Blvd",
         "main_contact_address_2": "City Hall Rm 484", "main_contact_city": "Philadelphia",
         "main_contact_state": "PA", "main_contact_zip": "19107", "main_contact_phone_1": "2156863448",
         "local_contact_1_phone_1": "2156863449"},
        {"office": "city_council", "district": 4, "first_name": "Curtis", "last_name": "Jones", "suffix": "Jr",
         "main_contact_address_1": "1400 John F Kennedy Blvd", "main_contact_address_2": "City Hall Rm 404",
         "main_contact_city": "Philadelphia", "main_contact_state": "PA", "main_contact_zip": "19107",
         "main_contact_phone_1": "2156863416", "local_contact_1_address_1": "5462 Ridge Ave",
         "local_contact_1_address_2": "Ste A", "local_contact_1_city": "Philadelphia", "local_contact_1_state": "PA",
         "local_contact_1_zip": "19128", "local_contact_1_phone_1": "2156852547"},
        {"office": "city_council_at_large", "district": 0, "first_name": "Rue", "last_name": "Landau",
         "main_contact_phone_1": "2156863420"},
        {"office": "mayor", "district": 0, "first_name": "Cherelle", "last_name": "Parker"},
    ]  # fmt: skip


def test_council_seats_list_city_hall_and_any_district_office() -> None:
    districts, at_large = council_seats(council_rows(), "2026-10-21")
    assert list(districts) == ["4", "7"]
    assert districts["7"] == {
        "name": "Quetcy Lozada",
        "offices": [
            {
                "address": "1400 John F Kennedy Blvd, City Hall Rm 484, Philadelphia, PA 19107",
                "phone": "215-686-3448",
            }
        ],
        "website": "https://phlcouncil.com/QuetcyLozada/",
        "source": "city_elected_officials",
        "checked": "2026-10-21",
    }
    assert districts["4"]["name"] == "Curtis Jones Jr"
    assert districts["4"]["offices"][1] == {
        "address": "5462 Ridge Ave, Ste A, Philadelphia, PA 19128",
        "phone": "215-685-2547",
    }
    assert [seat["name"] for seat in at_large] == ["Rue Landau"]


def test_congress_lists_philadelphia_offices_first_then_washington(tmp_path: Path) -> None:
    people = json.loads(congress_files(tmp_path)[0].read_text())
    members = [
        {"bioguide": "E000296", "name": "Dwight Evans", "chamber": "house", "state": "PA", "district": "3",
         "url": "https://evans.house.gov", "phone": "202-225-4001", "address": people[0]["terms"][1]["address"]},
        {"bioguide": "S001205", "name": "Mary Gay Scanlon", "chamber": "house", "state": "PA", "district": "5",
         "url": "https://scanlon.house.gov", "phone": "202-225-2011", "address": None},
        {"bioguide": "F000479", "name": "John Fetterman", "chamber": "senate", "state": "PA", "district": None},
    ]  # fmt: skip
    offices = [
        {"bioguide": "E000296", "address": "7174 Ogontz Ave.", "city": "Philadelphia", "state": "PA", "zip": "19138", "phone": "215-276-0340"},
        {"bioguide": "E000296", "address": "1 Elsewhere Rd", "city": "Cheltenham", "state": "PA", "zip": "19012", "phone": "215-000-0000"},
        {"bioguide": "S001205", "address": "2501 Seaport Drive", "suite": "BH230", "city": "Chester", "state": "PA", "zip": "19013", "phone": "610-626-2020"},
    ]  # fmt: skip
    seats = congress_seats(members, offices, "2026-10-21")
    assert list(seats) == ["3", "5"]
    assert [o["address"] for o in seats["3"]["offices"]] == [
        "7174 Ogontz Ave., Philadelphia, PA 19138",
        "1105 Longworth House Office Building Washington DC 20515-3803",
    ]
    # No office in the city: every one in Pennsylvania.
    assert seats["5"]["offices"] == [
        {"address": "2501 Seaport Drive, BH230, Chester, PA 19013", "phone": "610-626-2020"},
        {"phone": "202-225-2011"},
    ]


def test_community_organizations_keep_what_the_city_publishes_for_reaching_them() -> None:
    rows = [
        {"lni_id": 203, "organization_name": "Example Neighbors", "organization_address": "1 Example St",
         "meeting_location_address": "Example Library", "preffered_contact_method": "Email",
         "primary_name": "Rosa Example", "primary_phone": "2155550100", "p_phone_ext": 12,
         "primary_email": "hello@example.org", "websites": "example.org extra", "effective_date": 1},
        {"lni_id": 203, "organization_name": "Example Neighbors (old)", "effective_date": 0},
        {"lni_id": 54, "organization_name": "Plain Civic", "primary_email": "not an address"},
    ]  # fmt: skip
    found = rco_contacts(rows, "2026-10-21")
    assert list(found) == ["54", "203"]
    assert found["203"] == {
        "name": "Example Neighbors",
        "address": "1 Example St",
        "meeting": "Example Library",
        "preferred": "Email",
        "contact": {
            "name": "Rosa Example",
            "phone": "215-555-0100 extension 12",
            "email": "hello@example.org",
        },
        "website": "https://example.org",
        "source": "rco_contacts",
        "checked": "2026-10-21",
    }
    assert found["54"] == {"name": "Plain Civic", "source": "rco_contacts", "checked": "2026-10-21"}


def test_a_seat_with_no_member_listed_says_so() -> None:
    seats = assembly_seats([legislator("Rosa Example", "lower", "195")], "2026-10-21")
    assert vacant_seats({"house": {"195", "201"}}, seats) == {"house": ["201"]}


# The contacts table, built from snapshots ------------------------------------------------------


def install_represent_sources(ctx, legislators: list[dict[str, str]], fetched_at: str) -> None:
    def polygons(rows: dict[str, tuple], column: str) -> pa.Table:
        return pa.table(
            {
                column: list(rows),
                "geometry": [shapely.to_wkb(box(*b), flavor="iso") for b in rows.values()],
            }
        )

    area = (-75.20, 39.95, -75.10, 40.05)
    install_snapshot(
        ctx,
        "council_districts",
        polygons({"7": area}, "district"),
        geometry=True,
        fetched_at=fetched_at,
    )
    install_snapshot(
        ctx,
        "political_divisions",
        polygons({"3412": area}, "division_num"),
        geometry=True,
        fetched_at=fetched_at,
    )
    install_snapshot(
        ctx,
        "pa_house_districts",
        polygons({"195": area}, "district"),
        geometry=True,
        fetched_at=fetched_at,
    )
    install_snapshot(
        ctx,
        "pa_senate_districts",
        polygons({"3": area}, "district"),
        geometry=True,
        fetched_at=fetched_at,
    )
    install_snapshot(
        ctx,
        "us_house_districts",
        polygons({"3": area}, "district"),
        geometry=True,
        fetched_at=fetched_at,
    )
    rco = polygons({"203": area}, "lni_id").append_column(
        "organization_name", pa.array(["Example Neighbors"])
    )
    install_snapshot(ctx, "rco_contacts", rco, geometry=True, fetched_at=fetched_at)
    install_snapshot(
        ctx,
        "pa_legislators",
        pa.table({name: [row.get(name) for row in legislators] for name in OPEN_STATES_COLUMNS}),
        geometry=False,
        fetched_at=fetched_at,
    )
    rows = council_rows()
    columns = sorted({key for row in rows for key in row})
    install_snapshot(
        ctx,
        "city_elected_officials",
        pa.table(
            {
                key: [None if row.get(key) is None else str(row.get(key)) for row in rows]
                for key in columns
            }
        ),
        geometry=False,
        fetched_at=fetched_at,
    )


def test_a_seat_that_changes_hands_shows_the_new_person_after_the_next_refresh(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory(now=NOW)
    points = {"371000001": (-75.15, 40.00)}
    install_represent_sources(
        ctx, [legislator("Donna Example", "lower", "195")], "2026-10-14T10:00:00Z"
    )
    statuses = {s.id: s for s in all_statuses(ctx)}
    represent, missing = represent_for(ctx, statuses, points)
    assert represent == {
        "371000001": {
            "ward": "34",
            "division": "3412",
            "council": "7",
            "house": "195",
            "senate": "3",
            "congress": "3",
            "rcos": [203],
        }
    }
    assert missing == []
    out = tmp_path / "first"
    build_contacts(
        ctx,
        statuses,
        out,
        {"council": {"7"}, "house": {"195"}, "senate": {"3"}, "congress": set(), "rcos": {"203"}},
        AS_OF,
    )
    first = json.loads((out / CONTACTS_TABLE).read_text())
    assert first["house"]["195"]["name"] == "Donna Example"
    assert first["house"]["195"]["checked"] == "2026-10-14"
    # The member resigns and Open States lists the winner of the special election.
    install_represent_sources(
        ctx, [legislator("Keith Example", "lower", "195")], "2026-10-21T10:00:00Z"
    )
    statuses = {s.id: s for s in all_statuses(ctx)}
    out = tmp_path / "second"
    result = build_contacts(
        ctx,
        statuses,
        out,
        {"council": {"7"}, "house": {"195"}, "senate": {"3"}, "congress": set(), "rcos": {"203"}},
        AS_OF,
    )
    second = json.loads((out / CONTACTS_TABLE).read_text())
    assert second["house"]["195"]["name"] == "Keith Example"
    assert second["house"]["195"]["checked"] == "2026-10-21"
    # Senate district 3 has no member in the copy: it says so, never an older name.
    assert second["vacant"] == {"senate": ["3"]}
    assert result.vacant == {"senate": ["3"]}
    assert second["council"]["7"]["name"] == "Quetcy Lozada"
    assert second["rcos"] == {
        "203": {"name": "Example Neighbors", "source": "rco_contacts", "checked": "2026-10-21"}
    }


def test_the_contacts_table_holds_no_officeholder_email_or_personal_detail(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory(now=NOW)
    install_represent_sources(
        ctx, [legislator("Rosa Example", "lower", "195")], "2026-10-21T10:00:00Z"
    )
    statuses = {s.id: s for s in all_statuses(ctx)}
    build_contacts(ctx, statuses, tmp_path, None, AS_OF)
    text = (tmp_path / CONTACTS_TABLE).read_text()
    body = json.loads(text)
    for kind in ("council", "house", "senate"):
        for seat in body[kind].values():
            assert set(seat) <= {"name", "role", "offices", "website", "source", "checked"}
            for office in seat["offices"]:
                assert set(office) <= {"address", "phone"}
    assert "@" not in json.dumps({k: v for k, v in body.items() if k != "rcos"})


def test_the_new_sources_are_registered_with_licenses_and_health_rules(context_factory) -> None:
    ctx = context_factory(now=NOW)
    expected = {
        "political_divisions": "city_terms",
        "pa_house_districts": "public_domain",
        "pa_senate_districts": "public_domain",
        "us_house_districts": "public_domain",
        "pa_legislators": "public_domain",
        "us_legislators": "public_domain",
        "us_legislator_offices": "public_domain",
        "city_elected_officials": "city_terms",
        "rco_contacts": "city_terms",
    }
    for source_id, license_id in expected.items():
        source = ctx.registry.sources[source_id]
        assert source.license == license_id
        assert source.health.min_rows > 0
        assert source_id in ADAPTERS
    # A seat that changes hands must show the new person after the next weekly refresh.
    for source_id in (
        "pa_legislators",
        "us_legislators",
        "us_legislator_offices",
        "city_elected_officials",
        "rco_contacts",
    ):
        assert ctx.registry.sources[source_id].cadence == "weekly"
