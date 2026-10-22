"""Who represents each lot (M5.1, issue #45): which ward and division, City Council district,
state House and Senate districts, Congressional district and Registered Community Organizations
each parcel's point lies in, and the people who hold those seats with their official offices.

The districts come from shapes: the City's divisions (`political_divisions`), its Council
districts (`council_districts`, the layer the map already draws), the Census Bureau's TIGER/Line
districts (`pa_house_districts`, `pa_senate_districts`, `us_house_districts`) and the community
organizations (`rco_contacts`). A parcel lies in a district when the district's shape covers its
point (OPA's point, the one the lot page uses); where shapes overlap at an edge, the lowest number
wins, so every build agrees. A parcel can lie in several community organizations: all of them are
listed, by the City's id.

The seats: City Council from the City's own list of elected officials (`city_elected_officials`,
the list atlas.phila.gov shows), the General Assembly from Open States (`pa_legislators`) and
Congress from the congress-legislators project (`us_legislators`, `us_legislator_offices`). Every
run builds the list again from the newest copies, so a seat that changes hands shows the new
person after the next weekly refresh. A district with no member listed says so; it is never
filled from an older copy.

Only official contact details are kept: the office address and phone and the official website
(docs/DESIGN.md, "Organizing tools").
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq
import shapely

#: The district kinds a parcel is placed in, with the source of each and the column naming it.
DISTRICT_SOURCES: dict[str, tuple[str, str]] = {
    "division": ("political_divisions", "division_num"),
    "council": ("council_districts", "district"),
    "house": ("pa_house_districts", "district"),
    "senate": ("pa_senate_districts", "district"),
    "congress": ("us_house_districts", "district"),
}
RCO_SOURCE = "rco_contacts"
#: The order of the keys in a parcel's `represent`.
KEYS = ("ward", "division", "council", "house", "senate", "congress", "rcos")


@dataclass
class Shapes:
    """The shapes of one kind of district, ready for point lookups."""

    ids: list[str]
    geometries: np.ndarray


def _clean_id(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if re.fullmatch(r"\d+(\.0+)?", text):
        return str(int(float(text)))
    return text


def read_shapes(path: Path, column: str) -> Shapes | None:
    """The shapes in a snapshot, with the id from `column`; None when it has none."""
    table = pq.read_table(path, columns=[column, "geometry"])
    ids, geometries = [], []
    for value, wkb in zip(table[column].to_pylist(), table["geometry"].to_pylist(), strict=True):
        key = _clean_id(value)
        if key is None or wkb is None:
            continue
        geometry = shapely.from_wkb(wkb)
        if geometry.is_empty:
            continue
        if not geometry.is_valid:
            geometry = shapely.make_valid(geometry)
        ids.append(key)
        geometries.append(geometry)
    if not ids:
        return None
    array = np.array(geometries, dtype=object)
    return Shapes(ids, array)


def _sort_key(value: str) -> tuple[int, str]:
    return (int(value), value) if value.isdigit() else (1 << 30, value)


def locate(points: dict[str, tuple[float, float]], shapes: Shapes) -> dict[str, list[str]]:
    """Every shape covering each point (inside it or on its edge), lowest id first. Points no
    shape covers are left out. Each shape is prepared once and tested against the points inside
    its bounding box, so half a million points take seconds."""
    accounts = list(points)
    if not accounts:
        return {}
    xy = np.array([points[a] for a in accounts], dtype=float)
    order = np.argsort(xy[:, 0], kind="stable")
    xs_sorted = xy[order, 0]
    hits: dict[str, set[str]] = {}
    for key, geometry in zip(shapes.ids, shapes.geometries, strict=True):
        west, south, east, north = shapely.bounds(geometry)
        lo = np.searchsorted(xs_sorted, west, side="left")
        hi = np.searchsorted(xs_sorted, east, side="right")
        candidates = order[lo:hi]
        if candidates.size == 0:
            continue
        ys = xy[candidates, 1]
        candidates = candidates[(ys >= south) & (ys <= north)]
        if candidates.size == 0:
            continue
        shapely.prepare(geometry)
        inside = shapely.intersects_xy(geometry, xy[candidates, 0], xy[candidates, 1])
        for index in candidates[inside]:
            hits.setdefault(accounts[index], set()).add(key)
    return {account: sorted(ids, key=_sort_key) for account, ids in hits.items()}


def division_code(value: str) -> str | None:
    """The City's division number as four digits, ward then division: the City writes "719" for
    ward 7, division 19, and "3412" for ward 34, division 12."""
    return value.zfill(4) if re.fullmatch(r"\d{3,4}", value) and int(value[-2:]) > 0 else None


def ward_of(division: str) -> str | None:
    """The ward of a four digit division number ("3412" is ward 34, "0719" ward 7)."""
    return str(int(division[:2])) if re.fullmatch(r"\d{4}", division) else None


#: A district counts as one of Philadelphia's when this much of it (in square meters) lies inside
#: the City's own boundary. Where a district file and the City's boundary disagree by a few
#: meters, a neighboring county's district can reach a parcel's point at the city's edge (seven
#: parcels of 583,680 on 2026-10-21, in seven such districts, each with under 0.1 square
#: kilometers inside the city; the smallest real district has 4.2).
MIN_AREA_IN_CITY_M2 = 500_000.0


def city_districts(shapes: Shapes, city: Any) -> Shapes:
    """Only the districts with at least MIN_AREA_IN_CITY_M2 inside the city (`city`, the union of
    the City's Council districts, longitude and latitude)."""
    from placekeepers.derive.street_safety import to_meters

    inside = to_meters(shapely.intersection(shapes.geometries, city))
    keep = shapely.area(inside) >= MIN_AREA_IN_CITY_M2
    return Shapes(
        [key for key, k in zip(shapes.ids, keep, strict=True) if k], shapes.geometries[keep]
    )


#: How far from a district of the city a point at the city's edge may lie and still take it.
NEAREST_MAX_M = 250.0


def nearest(points: dict[str, tuple[float, float]], shapes: Shapes) -> dict[str, str]:
    """The nearest shape to each point within NEAREST_MAX_M (for the few points at the city's edge
    no district of the city covers); a point farther away from all of them gets none."""
    from placekeepers.derive.street_safety import to_meters

    accounts = list(points)
    if not accounts or not shapes.ids:
        return {}
    xy = np.array([points[a] for a in accounts], dtype=float)
    where = to_meters(shapely.points(xy[:, 0], xy[:, 1]))
    meters = to_meters(shapes.geometries)
    out = {}
    for account, point in zip(accounts, where, strict=True):
        distances = shapely.distance(meters, point)
        best = int(np.argmin(distances))
        if distances[best] <= NEAREST_MAX_M:
            out[account] = shapes.ids[best]
    return out


def parcel_represent(
    points: dict[str, tuple[float, float]],
    shapes: dict[str, Shapes],
    rcos: Shapes | None,
) -> dict[str, dict[str, Any]]:
    """Each parcel's `represent` (docs/CONTRACTS.md section 6): its ward and division, Council,
    state House, state Senate and Congressional districts, and the community organizations whose
    area covers it. Keys whose shapes are missing or do not cover the point are left out.

    With the City's Council districts at hand, the state and Congressional districts are first
    limited to those of the city (city_districts), and a point at the city's edge that none of them
    covers takes the nearest one."""
    out: dict[str, dict[str, Any]] = {}
    city = shapely.union_all(shapes["council"].geometries) if "council" in shapes else None
    for kind, layer in shapes.items():
        if city is not None and kind in ("house", "senate", "congress"):
            layer = city_districts(layer, city)
        found = {account: ids[0] for account, ids in locate(points, layer).items()}
        if city is not None and kind in ("house", "senate", "congress"):
            left = {a: xy for a, xy in points.items() if a not in found}
            found |= nearest(left, layer)
        for account, key in found.items():
            entry = out.setdefault(account, {})
            if kind == "division":
                code = division_code(key)
                if code is None:
                    continue
                entry["division"] = code
                entry["ward"] = ward_of(code)
            else:
                entry[kind] = key
    if rcos is not None:
        for account, ids in locate(points, rcos).items():
            out.setdefault(account, {})["rcos"] = [int(i) if i.isdigit() else i for i in ids]
    return {
        account: {key: entry[key] for key in KEYS if key in entry} for account, entry in out.items()
    }


# Officeholders --------------------------------------------------------------------------------


def _text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def phone_text(value: Any) -> str | None:
    """A ten digit phone number written 215-686-3458; anything else as written, or None for an
    empty or zero placeholder."""
    text = _text(value)
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if not digits or set(digits) == {"0"}:
        return None
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return text


def website(value: Any) -> str | None:
    """An https link: the City writes some without a scheme ("phlcouncil.com/MarkSquilla")."""
    text = _text(value)
    if not text:
        return None
    if text.startswith("http://"):
        text = "https://" + text[len("http://") :]
    elif not text.startswith("https://"):
        text = "https://" + text
    return text


def _join(*parts: Any) -> str | None:
    kept = [p for p in (_text(part) for part in parts) if p]
    return ", ".join(kept) or None


def _place(city: Any, state: Any, zip_code: Any) -> str | None:
    """ "Philadelphia, PA 19107": the city, then the state and ZIP code."""
    tail = " ".join(p for p in (_text(state), _text(zip_code)) if p)
    return _join(city, tail)


def _office(address: str | None, phone: str | None) -> dict[str, str] | None:
    office = {key: value for key, value in (("address", address), ("phone", phone)) if value}
    return office or None


def council_seats(
    rows: Iterable[dict[str, Any]], checked: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """City Council from the City's list of elected officials: the district members by district,
    and the members at large, each with the office in City Hall (and a district office where the
    City lists one) and the website."""
    districts: dict[str, Any] = {}
    at_large: list[dict[str, Any]] = []
    for row in rows:
        office = _text(row.get("office"))
        if office not in ("city_council", "city_council_at_large"):
            continue
        name = " ".join(
            p
            for p in (
                _text(row.get("first_name")),
                _text(row.get("last_name")),
                _text(row.get("suffix")),
            )
            if p
        )
        if not name:
            continue
        offices = []
        city_hall = _office(
            _join(
                row.get("main_contact_address_1"),
                row.get("main_contact_address_2"),
                _place(
                    row.get("main_contact_city"),
                    row.get("main_contact_state"),
                    row.get("main_contact_zip"),
                ),
            ),
            phone_text(row.get("main_contact_phone_1")),
        )
        if city_hall:
            offices.append(city_hall)
        local_address = _join(
            row.get("local_contact_1_address_1"), row.get("local_contact_1_address_2")
        )
        if local_address:
            local = _office(
                _join(
                    local_address,
                    _place(
                        row.get("local_contact_1_city"),
                        row.get("local_contact_1_state"),
                        row.get("local_contact_1_zip"),
                    ),
                ),
                phone_text(row.get("local_contact_1_phone_1")),
            )
            if local:
                offices.append(local)
        seat: dict[str, Any] = {"name": name}
        role = _text(row.get("leadership_role"))
        if role:
            seat["role"] = role
        seat |= {
            "offices": offices,
            "website": website(row.get("website")),
            "source": "city_elected_officials",
            "checked": checked,
        }
        if office == "city_council":
            district = _clean_id(row.get("district"))
            if district:
                districts[district] = seat
        else:
            at_large.append(seat)
    at_large.sort(key=lambda seat: seat["name"].split()[-1] + " " + seat["name"])
    return dict(sorted(districts.items(), key=lambda item: _sort_key(item[0]))), at_large


#: The General Assembly's own pages, best first.
_ASSEMBLY_LINKS = (
    re.compile(r"^https://www\.palegis\.us/(house|senate)/members/bio/"),
    re.compile(
        r"^https://www\.legis\.state\.pa\.us/cfdocs/legis/home/member_information/(house|senate)_bio",
        re.I,
    ),
    re.compile(r"^https://www\.(pahouse\.com|pasenate\.com|pasen\w*\.com)/"),
)


def assembly_website(links: Any) -> str | None:
    """The member's page on the General Assembly's site, else the first official link."""
    found = [link.strip() for link in str(links or "").split(";") if link.strip()]
    for pattern in _ASSEMBLY_LINKS:
        for link in found:
            if pattern.match(link):
                return website(link)
    return website(found[0]) if found else None


def assembly_seats(rows: Iterable[dict[str, Any]], checked: str) -> dict[str, dict[str, Any]]:
    """The state House (`house`) and Senate (`senate`) seats by district, from Open States, each
    with the district office and the Capitol office as listed, and the member's page on the
    General Assembly's site."""
    seats: dict[str, dict[str, Any]] = {"house": {}, "senate": {}}
    for row in rows:
        chamber = {"lower": "house", "upper": "senate"}.get(_text(row.get("current_chamber")) or "")
        district = _clean_id(row.get("current_district"))
        name = _text(row.get("name"))
        if not chamber or not district or not name:
            continue
        offices = [
            office
            for office in (
                _office(_text(row.get("district_address")), phone_text(row.get("district_voice"))),
                _office(_text(row.get("capitol_address")), phone_text(row.get("capitol_voice"))),
            )
            if office
        ]
        seats[chamber][district] = {
            "name": name,
            "offices": offices,
            "website": assembly_website(row.get("links")),
            "source": "pa_legislators",
            "checked": checked,
        }
    return {
        chamber: dict(sorted(found.items(), key=lambda item: _sort_key(item[0])))
        for chamber, found in seats.items()
    }


def congress_seats(
    members: Iterable[dict[str, Any]], offices: Iterable[dict[str, Any]], checked: str
) -> dict[str, dict[str, Any]]:
    """Pennsylvania's members of the U.S. House by district, each with their district offices in
    Philadelphia (or, with none in the city, every one in Pennsylvania), the Washington office and
    the official website."""
    by_member: dict[str, list[dict[str, Any]]] = {}
    for office in offices:
        bioguide = _text(office.get("bioguide"))
        if bioguide:
            by_member.setdefault(bioguide, []).append(office)
    seats: dict[str, dict[str, Any]] = {}
    for member in members:
        if _text(member.get("chamber")) != "house" or _text(member.get("state")) != "PA":
            continue
        district = _clean_id(member.get("district"))
        name = _text(member.get("name"))
        if not district or not name:
            continue
        local = by_member.get(_text(member.get("bioguide")) or "", [])
        in_city = [o for o in local if (_text(o.get("city")) or "").lower() == "philadelphia"]
        listed = []
        for office in in_city or local:
            address = _join(
                office.get("address"),
                office.get("suite"),
                _place(office.get("city"), office.get("state"), office.get("zip")),
            )
            found = _office(address, phone_text(office.get("phone")))
            if found:
                listed.append(found)
        washington = _office(_text(member.get("address")), phone_text(member.get("phone")))
        if washington:
            listed.append(washington)
        seats[district] = {
            "name": name,
            "offices": listed,
            "website": website(member.get("url")),
            "source": "us_legislators",
            "checked": checked,
        }
    return dict(sorted(seats.items(), key=lambda item: _sort_key(item[0])))


def rco_contacts(rows: Iterable[dict[str, Any]], checked: str) -> dict[str, dict[str, Any]]:
    """Each community organization by the City's id, with what the City publishes for reaching it:
    its address, its meeting place, how it prefers to be contacted, its primary contact's name,
    phone and email, and its website. When the City lists an organization twice, the record that
    registered last is kept."""
    found: dict[str, tuple[Any, dict[str, Any]]] = {}
    for row in rows:
        key = _clean_id(row.get("lni_id"))
        name = _text(row.get("organization_name"))
        if not key or not name:
            continue
        contact: dict[str, str] = {}
        person = _text(row.get("primary_name"))
        phone = phone_text(row.get("primary_phone"))
        extension = _clean_id(row.get("p_phone_ext"))
        email = _text(row.get("primary_email"))
        if person:
            contact["name"] = person
        if phone:
            contact["phone"] = (
                f"{phone} extension {extension}" if extension and extension != "0" else phone
            )
        if email and "@" in email:
            contact["email"] = email
        entry: dict[str, Any] = {"name": name}
        for field, value in (
            ("address", _text(row.get("organization_address"))),
            ("meeting", _text(row.get("meeting_location_address"))),
            ("preferred", _text(row.get("preffered_contact_method"))),
        ):
            if value:
                entry[field] = value
        if contact:
            entry["contact"] = contact
        site = _text(row.get("websites"))
        if site:
            entry["website"] = website(site.split()[0].rstrip(",;"))
        entry |= {"source": RCO_SOURCE, "checked": checked}
        registered = row.get("effective_date")
        if key not in found or (
            registered is not None and (found[key][0] is None or registered > found[key][0])
        ):
            found[key] = (registered, entry)
    return {
        key: entry for key, (_, entry) in sorted(found.items(), key=lambda item: _sort_key(item[0]))
    }


def vacant_seats(
    used: dict[str, set[str]], seats: dict[str, dict[str, Any]]
) -> dict[str, list[str]]:
    """The districts some parcel lies in that have no member listed, by kind, for the lot pages to
    say so (never filled from an older copy)."""
    out = {}
    for kind, districts in used.items():
        missing = sorted((d for d in districts if d not in seats.get(kind, {})), key=_sort_key)
        if missing:
            out[kind] = missing
    return out
