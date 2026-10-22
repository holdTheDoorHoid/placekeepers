"""Who represents each lot (M5.1, issue #45): the City's wards and divisions, Pennsylvania's House
and Senate districts and its Congressional districts, the people who hold those seats with their
official offices, the City Council members, and the Registered Community Organizations' contacts
as the City publishes them.

Every adapter keeps only what the packets and lot pages show. For officeholders that is the
name, the seat, the official office address and phone, and the official website: never a personal
email address, a social media account, a photo, a birth date or a biography, even where the
source holds them. For the community organizations it is what the City publishes for reaching
the organization (its address, its meeting place, how it likes to be reached, and its primary
contact's name, phone and email); the contacts' own addresses and the alternate contacts are not
downloaded (field names checked against the live services on 2026-10-21).

The Census Bureau's district files (TIGER/Line) are named by year, and the Congressional file
also by the Congress it is drawn for. The registry names the file in use; each run asks whether a
newer year has been published and takes the newest, and for Congress the file for the Congress now
sitting (on 2026-10-21 the 2026 files hold only the 120th Congress's districts, which take their
seats on January 3, 2027, so the 119th's come from the 2025 files). Pennsylvania's maps have been
the same since 2022, so the choice matters only after a redistricting.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date
from pathlib import Path
from typing import Any, ClassVar

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError, quote_literal
from placekeepers.adapters.carto import CartoAdapter, Column
from placekeepers.adapters.url import UrlAdapter, http_date
from placekeepers.cache import RawFetch
from placekeepers.geo import GEOMETRY_COLUMN, write_geoparquet
from placekeepers.httpclient import HttpError

log = logging.getLogger(__name__)

#: A box around Philadelphia (west, south, east, north) a little larger than the city: districts
#: outside it are not kept.
PHILLY_BOX = (-75.30, 39.86, -74.95, 40.14)


# Wards and divisions ---------------------------------------------------------------------------


class PoliticalDivisions(ArcgisAdapter):
    """The City's political divisions (about 1,700): `division_num` is the ward and the division
    within it, four digits, such as "3412" for ward 34, division 12."""

    out_fields = ("objectid", "division_num", "short_div_num")
    required_columns = ("division_num", "geometry")


# District shapes from the Census Bureau --------------------------------------------------------


def congress_sitting(today: date) -> int:
    """The number of the Congress sitting on a day: the 119th from January 3, 2025 to January 2,
    2027. A new Congress begins at noon on January 3 of each odd year."""
    year = today.year
    if year % 2 == 0 or (today.month, today.day) >= (1, 3):
        start = year if year % 2 == 1 else year - 1
    else:
        start = year - 2
    return (start - 1789) // 2 + 1


#: A TIGER/Line link: .../TIGER<year>/<FOLDER>/tl_<year>_42_<layer>.zip
TIGER_LINK = re.compile(
    r"^(?P<root>https://www2\.census\.gov/geo/tiger/)TIGER(?P<year>\d{4})/(?P<folder>[A-Z]+)/"
    r"tl_(?P=year)_42_(?P<layer>[a-z]+)(?P<congress>\d*)\.zip$"
)


class TigerDistricts(UrlAdapter):
    """One of Pennsylvania's district files from the Census Bureau's TIGER/Line shapefiles, kept
    for the districts that reach Philadelphia: `district` (the number, without leading zeros),
    `name` (as the Bureau writes it, such as "State House District 195"), `geoid`, `year` (of
    the file) and, for Congress, `congress`."""

    #: the field holding the district number in the shapefile
    district_field: ClassVar[str] = ""
    required_columns = ("district", "name", "year", "geometry")

    def link(self) -> re.Match[str]:
        match = TIGER_LINK.match(self.endpoint.url)
        if match is None:
            raise FetchError(f"{self.endpoint.url} is not a Pennsylvania TIGER/Line link")
        return match

    def candidates(self, today: date) -> list[tuple[str, int, int | None]]:
        """The links to try, newest first: (link, year, congress)."""
        match = self.link()
        root, folder, layer = match["root"], match["folder"], match["layer"]
        oldest = int(match["year"])
        congress = congress_sitting(today) if match["congress"] else None
        found = []
        for year in range(max(today.year, oldest), oldest - 1, -1):
            suffix = str(congress) if congress else ""
            found.append(
                (f"{root}TIGER{year}/{folder}/tl_{year}_42_{layer}{suffix}.zip", year, congress)
            )
        if congress:
            # The registry's own file, whatever Congress it is for, as a last resort.
            found.append((self.endpoint.url, oldest, int(match["congress"])))
        return list(dict.fromkeys(found))

    def fetch(self, dest: Path) -> dict[str, Any]:
        tried = []
        for link, year, congress in self.candidates(self.ctx.today()):
            try:
                result = self.ctx.http.download(link, dest / "data.zip")
            except HttpError as exc:
                if "HTTP 404" not in str(exc):
                    raise
                tried.append(link)
                continue
            if tried:
                log.info("%s: no file at %s; using %s", self.id, ", ".join(tried), link)
            return {
                "file": "data.zip",
                "format": "zip",
                "url": link,
                "year": year,
                "congress": congress,
                "bytes": result.bytes,
                "sha256": result.sha256,
                "source_date": http_date(result.last_modified),
                "rows": None,
            }
        raise FetchError(f"None of these files exist: {', '.join(tried)}")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        import geopandas as gpd

        frame = gpd.read_file(self.data_file(raw))
        if self.district_field not in frame.columns:
            raise FetchError(f"The file has no {self.district_field} field")
        west, south, east, north = PHILLY_BOX
        near = frame.geometry.intersects(shapely.box(west, south, east, north))
        frame = frame[near]
        districts = [
            str(int(value)) if str(value).isdigit() else str(value)
            for value in frame[self.district_field]
        ]
        columns: dict[str, Any] = {
            "district": pa.array(districts, pa.string()),
            "name": pa.array([str(v) for v in frame["NAMELSAD"]], pa.string()),
            "geoid": pa.array([str(v) for v in frame["GEOID"]], pa.string()),
            "year": pa.array([int(raw.info["year"])] * len(frame), pa.int32()),
        }
        if raw.info.get("congress"):
            columns["congress"] = pa.array([int(raw.info["congress"])] * len(frame), pa.int32())
        columns[GEOMETRY_COLUMN] = pa.array(
            [shapely.to_wkb(g, flavor="iso") for g in frame.geometry], pa.binary()
        )
        types = sorted({g.geom_type for g in frame.geometry})
        write_geoparquet(pa.table(columns), out, types)


class PaHouseDistricts(TigerDistricts):
    district_field = "SLDLST"


class PaSenateDistricts(TigerDistricts):
    district_field = "SLDUST"


class UsHouseDistricts(TigerDistricts):
    """The district field is named for the Congress (`CD119FP`), so it is found by its pattern."""

    def normalize(self, raw: RawFetch, out: Path) -> None:
        self.district_field = f"CD{raw.info['congress']}FP"
        super().normalize(raw, out)


# Officeholders --------------------------------------------------------------------------------


#: The columns kept from Open States' people file: never email, social media, photos, birth
#: dates, gender or biographies.
OPEN_STATES_COLUMNS = (
    "id",
    "name",
    "given_name",
    "family_name",
    "current_chamber",
    "current_district",
    "capitol_address",
    "capitol_voice",
    "district_address",
    "district_voice",
    "links",
)


class PaLegislators(UrlAdapter):
    """Pennsylvania's General Assembly as Open States lists it today (CC0): one row per member,
    `current_chamber` `lower` (the House) or `upper` (the Senate), the district, the office
    addresses and phones, and the links (the General Assembly's own page among them)."""

    required_columns = ("name", "current_chamber", "current_district", "district_address")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        con = self.ctx.duckdb()
        try:
            found = {
                row[0]
                for row in con.execute(
                    f"DESCRIBE SELECT * FROM read_csv({quote_literal(str(path))}, header = true, "
                    "all_varchar = true)"
                ).fetchall()
            }
            missing = [name for name in OPEN_STATES_COLUMNS if name not in found]
            if missing:
                raise FetchError(f"The file no longer has the columns {', '.join(missing)}")
            select = ", ".join(f'"{name}"' for name in OPEN_STATES_COLUMNS)
            con.execute(
                f"COPY (SELECT {select} FROM read_csv({quote_literal(str(path))}, header = true, "
                f"all_varchar = true)) TO {quote_literal(str(out))} "
                "(FORMAT parquet, COMPRESSION zstd)"
            )
        finally:
            con.close()


def _json_rows(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise FetchError("The file is not a list")
    return data


def _write_rows(rows: list[dict[str, Any]], columns: tuple[str, ...], out: Path) -> None:
    table = pa.table(
        {name: pa.array([row.get(name) for row in rows], pa.string()) for name in columns}
    )
    pq.write_table(table, out, compression="zstd")


US_LEGISLATOR_COLUMNS = (
    "bioguide",
    "name",
    "chamber",
    "state",
    "district",
    "start",
    "end",
    "url",
    "phone",
    "address",
)


class UsLegislators(UrlAdapter):
    """Pennsylvania's members of Congress from the `unitedstates/congress-legislators` project
    (CC0): each one's current term (the House or the Senate, the district, the official website,
    and the Washington office's address and phone)."""

    required_columns = ("bioguide", "name", "chamber", "district", "url")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        rows = []
        for person in _json_rows(self.data_file(raw)):
            terms = person.get("terms") or []
            if not terms:
                continue
            term = terms[-1]
            if term.get("state") != "PA":
                continue
            name = person.get("name") or {}
            full = name.get("official_full") or " ".join(
                part for part in (name.get("first"), name.get("last")) if part
            )
            rows.append(
                {
                    "bioguide": (person.get("id") or {}).get("bioguide"),
                    "name": full,
                    "chamber": {"rep": "house", "sen": "senate"}.get(
                        term.get("type"), term.get("type")
                    ),
                    "state": term.get("state"),
                    "district": None if term.get("district") is None else str(term["district"]),
                    "start": term.get("start"),
                    "end": term.get("end"),
                    "url": term.get("url"),
                    "phone": term.get("phone"),
                    "address": term.get("address"),
                }
            )
        if not rows:
            raise FetchError("The file lists no members from Pennsylvania")
        _write_rows(rows, US_LEGISLATOR_COLUMNS, out)


US_OFFICE_COLUMNS = (
    "bioguide",
    "office",
    "address",
    "suite",
    "building",
    "city",
    "state",
    "zip",
    "phone",
)


class UsLegislatorOffices(UrlAdapter):
    """The district offices in Pennsylvania of each member of Congress, from the same project
    (CC0): the address, suite, building, city, ZIP code and phone. Hours, fax numbers and map
    points are not kept."""

    required_columns = ("bioguide", "address", "city", "phone")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        rows = []
        for person in _json_rows(self.data_file(raw)):
            bioguide = (person.get("id") or {}).get("bioguide")
            for office in person.get("offices") or []:
                if office.get("state") != "PA":
                    continue
                rows.append(
                    {
                        "bioguide": bioguide,
                        "office": office.get("id"),
                        "address": office.get("address"),
                        "suite": office.get("suite"),
                        "building": office.get("building"),
                        "city": office.get("city"),
                        "state": office.get("state"),
                        "zip": office.get("zip"),
                        "phone": office.get("phone"),
                    }
                )
        if not rows:
            raise FetchError("The file lists no offices in Pennsylvania")
        _write_rows(rows, US_OFFICE_COLUMNS, out)


class CityElectedOfficials(CartoAdapter):
    """The City's own list of elected officials, the one atlas.phila.gov shows, for the City
    Council members: each district member and the members at large, with the office in City Hall,
    a district office where the City lists one, and the website. Email addresses and fax numbers
    are not downloaded."""

    columns = (
        Column("office", "office"),
        Column("district", "district", "INTEGER"),
        Column("first_name", "first_name"),
        Column("middle_name", "middle_name"),
        Column("last_name", "last_name"),
        Column("suffix", "suffix"),
        Column("leadership_role", "leadership_role"),
        Column("website", "website"),
        Column("main_contact_address_1", "main_contact_address_1"),
        Column("main_contact_address_2", "main_contact_address_2"),
        Column("main_contact_city", "main_contact_city"),
        Column("main_contact_state", "main_contact_state"),
        Column("main_contact_zip", "main_contact_zip"),
        Column("main_contact_phone_1", "main_contact_phone_1"),
        Column("local_contact_1_address_1", "local_contact_1_address_1"),
        Column("local_contact_1_address_2", "local_contact_1_address_2"),
        Column("local_contact_1_city", "local_contact_1_city"),
        Column("local_contact_1_state", "local_contact_1_state"),
        Column("local_contact_1_zip", "local_contact_1_zip"),
        Column("local_contact_1_phone_1", "local_contact_1_phone_1"),
    )
    required_columns = ("office", "district", "last_name", "main_contact_phone_1")


# Community organizations ----------------------------------------------------------------------


class RcoContacts(ArcgisAdapter):
    """The Registered Community Organizations (Zoning_RCO) with what the City publishes for
    reaching each one: its address, its meeting place, how it prefers to be contacted, and its
    primary contact's name, phone and email. The primary contact's own address and the alternate
    contact are not downloaded. The map's boundaries layer reads `community_organizations`, which
    holds no contacts at all."""

    out_fields = (
        "objectid",
        "lni_id",
        "organization_name",
        "organization_address",
        "meeting_location_address",
        "preffered_contact_method",
        "primary_name",
        "primary_email",
        "primary_phone",
        "p_phone_ext",
        "websites",
        "expirationyear",
        "effective_date",
    )
    required_columns = ("lni_id", "organization_name", "geometry")
