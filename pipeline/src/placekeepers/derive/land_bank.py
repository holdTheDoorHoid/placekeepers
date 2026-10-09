"""The Land Bank in numbers (M4.4, issue #40): what the Philadelphia Land Bank and the City's other
land agencies conveyed, year by year, from the City's deed records, and the weekly count of lots
they list as available.

**The agencies.** The four bodies of the City's list of public property (`city_owned_property`),
by its codes: the Philadelphia Land Bank (PLB), the Philadelphia Redevelopment Authority (PRA), the
Philadelphia Housing Development Corporation (PHDC) and the City itself (PUB, including its
Department of Public Property). Recognized by name in the deed's sellers (`grantors`).

**What counts as a conveyance.** A plain deed (`CONVEYANCE_TYPES`; never a sheriff deed, a deed of
condemnation or an adverse possession deed) whose sellers are all land agencies and whose buyers
include someone else. Left out, and counted apart:

* `between`: every buyer is a land agency too, such as the City handing a lot to the Land Bank. That
  moves land inside the public system; nobody outside it received anything.
* `agreement`: the same parties stand on both sides (an easement, a restriction or a correction
  recorded as a deed: the City's records list every party as both seller and buyer), or one agency
  appears on both sides.
* `other`: another party sells alongside an agency (a company, a person, the City as a trustee, a
  City department such as Water or Streets granting an easement), or the document is not a plain
  deed.

**Counting properties.** The City's records hold one row per property per document, so a deed for 22
lots is 22 rows. Each property counts once per buyer: a later deed from a land agency to someone who
already received the property (a correction, a release of the agency's restrictions or of its right
to take the lot back) is a `follow_up` and is not counted again. So is a deed from an agency for a
property whose deed just before it, in the property's own history, went to a private owner: the
land was no longer the agency's to convey (`owned_privately_before`). This is decided in the
adapter (placekeepers.adapters.land_bank), the only place the names are read.

**Buyers** are typed by the owner rule of the lot pages (placekeepers.derive.owners): a person, a
company, a nonprofit, another public body (such as the Philadelphia Housing Authority) or unknown.
Names are read only to make the type and to compare them, and are never kept.

**Program.** The deed records do not say which program a conveyance came through. One can be
inferred: a single lot conveyed to a person who owns a parcel touching it, by the City's owner list
on the day of the download, is probably a side or rear yard (`side_yard`, always labeled as our
inference). Everything else is `other`, which means "not known from the deed", not "not a side
yard". The City's own counts by program for fiscal years 2017 to 2023 come from its Land Management
dashboard (`land_conveyed_by_fy`), a separate table that stopped being updated in April 2023.

**Listed lots, week by week.** Every good snapshot of the City's list of public property adds one
line to `history.json` in that source's snapshot folder: the day it was fetched and how many records
had each status. The weekly refresh keeps the file with the snapshot (.github/scripts/refresh.py),
so the series grows from the first snapshot it saw, in October 2026.
"""

from __future__ import annotations

import json
import logging
import re
import statistics
from collections import Counter, defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from placekeepers.cache import atomic_write_json
from placekeepers.config import local_date, parse_iso_z
from placekeepers.derive.city_list import listed_available, side_yard_allowed
from placekeepers.derive.owners import PUBLIC_TYPES, match_form, type_from_name
from placekeepers.derive.transfers import split_names
from placekeepers.snapshots import HISTORY_FILE

log = logging.getLogger(__name__)

#: The land agencies, by the City owned layer's codes, in the order the page lists them.
AGENCIES = ("PLB", "PRA", "PHDC", "PUB")
AGENCY_PATTERNS: dict[str, re.Pattern[str]] = {
    "PLB": re.compile(r"\bLAND BANK\b"),
    # Also the misspellings and cut names the records carry ("PHILADELPHIA REDEVELOPMENT AUTHORIT").
    "PRA": re.compile(r"\bREDEV\w* AUTH|\bPHILA(DELPHIA)? REDEVELOP"),
    "PHDC": re.compile(r"\bPHDC\b|\bPHILA(DELPHIA)? HOUSING DEV"),
    "PUB": re.compile(
        r"\bCITY OF PHI?LA|\bPHILA(DELPHIA)? CITY OF\b|\bDEP(AR)?T(MENT)? OF PUBLIC PROP"
        r"|\bPUBLIC PROPERTY\b"
    ),
}
PUBLIC_PROPERTY = re.compile(r"\bPUBLIC PROP")
#: Names that look like an agency but are not one selling its land: the City as a trustee (of the
#: Girard Estate, say), City departments granting easements, and the courts.
NOT_AN_AGENCY = re.compile(
    r"\bTR\b|\bTRS\b|\bTRUSTEES?\b|\bCITY TRUSTS\b|\bWATER\b|\bSTREETS?\b|\bCOURT\b"
    r"|\bDEP(AR)?T(MENT)?\b"
)
#: Plain deeds. Sheriff deeds, deeds of condemnation, adverse possession deeds and deeds about a
#: person who died are other kinds of transfer and are never counted as conveyances.
CONVEYANCE_TYPES = frozenset(
    {
        "DEED",
        "DEED LAND BANK",
        "MISCELLANEOUS DEED",
        "DEED MISCELLANEOUS",
        "MISCELLANEOUS DEED TAXABLE",
        "DEED MISCELLANEOUS TAXABLE",
        "DEED RTT - OTHER",
    }
)
KINDS = ("conveyance", "between", "agreement", "other")
#: Buyer groups on the page, from the owner types of the lot pages.
BUYER_GROUPS = ("individual", "company", "nonprofit", "public", "unknown")
PROGRAMS = ("side_yard", "other")
#: A price of $100 or less is a token price, as on the lot pages (placekeepers.derive.transfers).
NOMINAL_MAX = 100
FIRST_YEAR = 2014
SCHEMA = 1


def agency_of(name: str | None) -> str | None:
    """The land agency a seller or buyer name stands for (`AGENCIES`), or None."""
    text = match_form(name)
    if not text:
        return None
    if NOT_AN_AGENCY.search(text) and not PUBLIC_PROPERTY.search(text):
        return None
    for code in AGENCIES:
        if AGENCY_PATTERNS[code].search(text):
            return code
    return None


def buyer_group(owner_type: str) -> str:
    """The page's buyer group for an owner type: public bodies are put together."""
    if owner_type in PUBLIC_TYPES:
        return "public"
    return owner_type if owner_type in BUYER_GROUPS else "unknown"


@dataclass(frozen=True)
class Deed:
    """What a deed from a land agency was. `buyers` holds names in memory only, to compare them;
    they are never written anywhere."""

    kind: str
    agency: str | None = None
    to_agency: str | None = None
    buyer_type: str | None = None
    buyers: tuple[str, ...] = field(default=(), repr=False)


def classify(document_type: str | None, grantors: str | None, grantees: str | None) -> Deed:
    """Whether a deed is a conveyance by a land agency, a move between agencies, an agreement or
    something else (see the module docstring), with the agency and the buyers' type."""
    if " ".join((document_type or "").split()).upper() not in CONVEYANCE_TYPES:
        return Deed("other")
    sellers = split_names(grantors)
    buyers = split_names(grantees)
    seller_agencies = [agency_of(name) for name in sellers]
    if not sellers or not buyers or not any(seller_agencies):
        return Deed("other")
    if {match_form(name) for name in sellers} == {match_form(name) for name in buyers}:
        return Deed("agreement")
    if any(code is None for code in seller_agencies):
        return Deed("other")
    buyer_agencies = [agency_of(name) for name in buyers]
    if set(seller_agencies) & {code for code in buyer_agencies if code}:
        return Deed("agreement")
    agency = next(code for code in AGENCIES if code in seller_agencies)
    if all(buyer_agencies):
        to = next(code for code in AGENCIES if code in buyer_agencies)
        return Deed("between", agency, to)
    outside = tuple(name for name, code in zip(buyers, buyer_agencies, strict=True) if not code)
    return Deed("conveyance", agency, None, type_from_name(list(outside)).type, outside)


# Next door ------------------------------------------------------------------------------------


def _words(name: str | None) -> list[str]:
    return [w for w in match_form(name).split() if w not in {"&", "AND"}]


def person_keys(names: Iterable[str | None]) -> set[tuple[str, str]]:
    """(last name, first name) of each name written the City's way, "CORTEZ PABLO A"."""
    keys = set()
    for name in names:
        words = _words(name)
        if len(words) >= 2:
            keys.add((words[0], words[1]))
    return keys


def owner_keys(owner_1: str | None, owner_2: str | None) -> set[tuple[str, str]]:
    """The people an OPA owner record names. OPA writes a couple as "TILLER JAMES R" and "GLADYS":
    a second name of one word shares the first one's last name."""
    keys = person_keys([owner_1, owner_2])
    first, second = _words(owner_1), _words(owner_2)
    if len(second) == 1 and first:
        keys.add((first[0], second[0]))
    return keys


def owns_next_door(
    buyers: Iterable[str], neighbours: Iterable[tuple[str | None, str | None]]
) -> bool:
    """True when a buyer owns one of the neighbouring parcels: the same last and first name as an
    owner, or exactly the same name (for organizations)."""
    buyers = list(buyers)
    keys = person_keys(buyers)
    whole = {match_form(name) for name in buyers if match_form(name)}
    for owner_1, owner_2 in neighbours:
        if keys & owner_keys(owner_1, owner_2):
            return True
        if whole & {match_form(name) for name in (owner_1, owner_2) if name}:
            return True
    return False


# Follow ups -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class ConveyanceRow:
    """What the follow up rule needs of one conveyance row."""

    key: str
    day: date
    document_id: int
    buyers: tuple[str, ...]


#: A later deed from a land agency for the same property within this many days is a follow up
#: whatever names it carries (a corrected spelling, "LLC" written out), not a new conveyance.
FOLLOW_UP_DAYS = 365


def follow_ups(rows: Sequence[ConveyanceRow]) -> list[bool]:
    """For each row, True when it follows an earlier conveyance of the same property (`key`): to a
    buyer with a name in common (the same name, or the same last and first name), at any time, or
    to anyone within `FOLLOW_UP_DAYS`. Such a deed is a correction, or a release of the agency's
    restrictions or of its right to take the lot back, not a new conveyance. Rows come back in the
    order given."""
    order = sorted(range(len(rows)), key=lambda i: (rows[i].key, rows[i].day, rows[i].document_id))
    result = [False] * len(rows)
    names: dict[str, set[str]] = defaultdict(set)
    people: dict[str, set[tuple[str, str]]] = defaultdict(set)
    first: dict[str, date] = {}
    for i in order:
        row = rows[i]
        mine = {match_form(name) for name in row.buyers if match_form(name)}
        keys = person_keys(row.buyers)
        if row.key in first and (
            mine & names[row.key]
            or keys & people[row.key]
            or (row.day - first[row.key]).days <= FOLLOW_UP_DAYS
        ):
            result[i] = True
        else:
            first[row.key] = row.day
        names[row.key] |= mine
        people[row.key] |= keys
    return result


@dataclass(frozen=True)
class EarlierDeed:
    """One deed in a property's own history (any seller), as the release rule reads it."""

    day: date
    document_id: int
    #: a land agency is among the buyers
    to_agency: bool


def earlier_deed(
    document_type: str | None,
    seller_names: str | None,
    buyer_names: str | None,
    day: date | None,
    document_id: int | None,
) -> EarlierDeed | None:
    """A deed of the property's history, or None for one that says nothing about who owned it
    after: an agreement (the same parties on both sides) or a deed without a date or buyers. A
    deed of condemnation lists the agency that takes the property among its sellers (checked
    2026-10-09: the Redevelopment Authority's are written that way), so there either side
    counts."""
    sellers = split_names(seller_names)
    buyers = split_names(buyer_names)
    if day is None or not buyers:
        return None
    if {match_form(n) for n in sellers} == {match_form(n) for n in buyers}:
        return None
    to_agency = any(agency_of(n) for n in buyers)
    if "CONDEMNATION" in (document_type or "").upper():
        to_agency = to_agency or any(agency_of(n) for n in sellers)
    return EarlierDeed(day, int(document_id or 0), to_agency)


def owned_privately_before(
    history: Sequence[EarlierDeed], day: date, document_id: int
) -> bool | None:
    """True when the deed just before this one (by date, then document number) went to someone
    other than a land agency: the property was already in private hands, so a deed from an agency
    now is a correction or a release of its restrictions, not a conveyance. False when it went to
    an agency, None when the records hold no earlier deed (counted as a conveyance)."""
    before = [
        deed
        for deed in history
        if (deed.day, deed.document_id) < (day, document_id) and deed.document_id != document_id
    ]
    if not before:
        return None
    latest = max(before, key=lambda deed: (deed.day, deed.document_id))
    return not latest.to_agency


# Listed lots, week by week ---------------------------------------------------------------------


def list_counts(
    rows: Iterable[tuple[str | None, str | None, str | None, str | None]],
) -> dict[str, Any]:
    """Counts of the City's list of public property from rows of (account, agency, status, side
    yard eligible), one per record: records and parcels listed as available, those of them a
    neighbor may get as a side yard, the listed ones by agency, and every record by status."""
    listed = 0
    parcels: set[str] = set()
    side_yard = 0
    by_agency: Counter[str] = Counter()
    by_status: Counter[str] = Counter()
    records = 0
    for account, agency, status, eligible in rows:
        records += 1
        label = " ".join(str(status or "").split()) or "No status"
        by_status[label] += 1
        if listed_available(status):
            listed += 1
            if account:
                parcels.add(account)
            if side_yard_allowed(status, eligible):
                side_yard += 1
            by_agency[(agency or "").strip().upper() or "unknown"] += 1
    return {
        "records": records,
        "listed": listed,
        "parcels": len(parcels),
        "side_yard": side_yard,
        "by_agency": dict(sorted(by_agency.items())),
        "by_status": dict(sorted(by_status.items(), key=lambda item: (-item[1], item[0]))),
    }


def read_history(folder: Path) -> list[dict[str, Any]]:
    path = folder / HISTORY_FILE
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        log.warning("city_owned_property: %s is unreadable; starting it again", path)
        return []
    return [entry for entry in data.get("snapshots", []) if isinstance(entry, dict)]


def record_list_counts(folder: Path) -> list[dict[str, Any]]:
    """Add a line to the history for every good snapshot of the City's list in `folder` that it
    does not hold yet, and return the history, oldest first. The caller holds the source's lock.
    Idempotent: a snapshot already counted is never counted again."""
    import pyarrow.parquet as pq

    from placekeepers.snapshots import SnapshotMeta

    history = read_history(folder)
    known = {entry.get("snapshot") for entry in history}
    added = False
    for sidecar in sorted(folder.glob("*.json")):
        if sidecar.name == HISTORY_FILE or sidecar.name.startswith(".") or sidecar.stem in known:
            continue
        try:
            meta = SnapshotMeta.from_json(json.loads(sidecar.read_text(encoding="utf-8")))
        except (ValueError, TypeError):
            continue
        path = folder / meta.file
        if meta.status != "good" or not path.is_file():
            continue
        columns = ["opabrt", "agency", "status_1", "sideyardeligible"]
        try:
            table = pq.read_table(path, columns=columns)
        except (OSError, KeyError, ValueError) as exc:
            log.warning("city_owned_property: cannot count snapshot %s: %s", meta.snapshot_id, exc)
            continue
        rows = zip(*(table.column(name).to_pylist() for name in columns), strict=True)
        day = local_date(parse_iso_z(meta.fetched_at)).isoformat()
        history.append({"snapshot": meta.snapshot_id, "date": day, **list_counts(rows)})
        known.add(meta.snapshot_id)
        added = True
    history.sort(key=lambda entry: str(entry.get("snapshot")))
    if added:
        atomic_write_json(folder / HISTORY_FILE, {"schema": SCHEMA, "snapshots": history})
    return history


def weekly_series(history: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """One point per day the list was fetched (the last snapshot of that day), oldest first, with
    the counts the page shows."""
    by_day: dict[str, Mapping[str, Any]] = {}
    for entry in sorted(history, key=lambda e: str(e.get("snapshot"))):
        by_day[str(entry["date"])] = entry
    return [
        {
            "date": day,
            "listed": int(entry.get("listed", 0)),
            "parcels": int(entry.get("parcels", 0)),
            "side_yard": int(entry.get("side_yard", 0)),
            "by_agency": dict(entry.get("by_agency", {})),
            "by_status": dict(entry.get("by_status", {})),
        }
        for day, entry in sorted(by_day.items())
    ]


# The numbers ----------------------------------------------------------------------------------


@dataclass(frozen=True)
class Conveyed:
    """One counted row of the deed records, as the statistics read it."""

    year: int
    agency: str
    buyer: str
    program: str
    price: float | None
    district: int | None
    document_id: int
    #: the City's fiscal year (July to June, named for the year it ends)
    fy: int = 0


def deed_price(adjusted: float | None, total: float | None) -> float | None:
    """This property's share of the deed's price, as the lot pages show it: the adjusted total, or
    the total when there is none."""
    if adjusted is not None:
        return float(adjusted)
    return float(total) if total is not None else None


def program_of(buyer_type: str | None, properties: int | None, next_door: bool | None) -> str:
    """`side_yard` when one lot went to a person who owns a parcel touching it (our inference),
    else `other`: not known from the deed."""
    if buyer_type == "individual" and (properties or 1) == 1 and next_door:
        return "side_yard"
    return "other"


def _block(rows: Sequence[Conveyed], moved_out: int, moved_in: int) -> dict[str, Any]:
    prices = [row.price for row in rows if row.price is not None]
    buyers = Counter(row.buyer for row in rows)
    programs = Counter(row.program for row in rows)
    return {
        "n": len(rows),
        "deeds": len({row.document_id for row in rows}),
        "moved_out": moved_out,
        "moved_in": moved_in,
        "buyers": {group: buyers.get(group, 0) for group in BUYER_GROUPS},
        "programs": {program: programs.get(program, 0) for program in PROGRAMS},
        "price": {
            "median": round(statistics.median(prices)) if prices else None,
            "priced": len(prices),
            "nominal": sum(1 for p in prices if p <= NOMINAL_MAX),
            "none": len(rows) - len(prices),
        },
    }


def agency_stats(
    rows: Sequence[Conveyed],
    moved_out: Mapping[int, int],
    moved_in: Mapping[int, int],
    years: Sequence[int],
    districts: Sequence[int],
) -> dict[str, Any]:
    """The page's numbers for one agency (or all four): each year, the whole span, and by council
    district. `moved_out` and `moved_in` count, by year, the properties the agency handed to
    another land agency and those it received from one."""
    by_year: dict[int, list[Conveyed]] = defaultdict(list)
    for row in rows:
        by_year[row.year].append(row)
    district_counts = Counter(row.district for row in rows)
    district_years: dict[int | None, Counter[int]] = defaultdict(Counter)
    for row in rows:
        district_years[row.district][row.year] += 1
    return {
        "years": [
            {
                "year": year,
                **_block(by_year.get(year, []), moved_out.get(year, 0), moved_in.get(year, 0)),
            }
            for year in years
        ],
        "total": _block(rows, sum(moved_out.values()), sum(moved_in.values())),
        "districts": [
            {
                "district": district,
                "n": district_counts.get(district, 0),
                "years": [district_years[district].get(year, 0) for year in years],
            }
            for district in districts
        ]
        + [
            {
                "district": None,
                "n": district_counts.get(None, 0),
                "years": [district_years[None].get(year, 0) for year in years],
            }
        ],
    }


def build_stats(
    rows: Sequence[Conveyed],
    moves: Sequence[tuple[int, str, str]],
    *,
    first_year: int = FIRST_YEAR,
    last_year: int,
    districts: Sequence[int] = tuple(range(1, 11)),
) -> dict[str, Any]:
    """The `agencies` block of tables/land_bank.json: for all four agencies together (`all`) and
    for each one. `rows` are the counted conveyances; `moves` (year, from, to) the properties moved
    from one land agency to another. For `all`, a move is counted once, in both columns."""
    years = list(range(first_year, last_year + 1))
    kept = [row for row in rows if first_year <= row.year <= last_year]
    span = [move for move in moves if first_year <= move[0] <= last_year]
    out: dict[str, Any] = {}
    for code in ("all", *AGENCIES):
        mine = [row for row in kept if code == "all" or row.agency == code]
        moved_out = Counter(year for year, src, _ in span if code in ("all", src))
        moved_in = Counter(year for year, _, dst in span if code in ("all", dst))
        out[code] = agency_stats(mine, moved_out, moved_in, years, districts)
    return out


def fy_program_rows(table_rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """The City's own counts by program and fiscal year (`land_conveyed_by_fy`), in our names.
    Housing is counted in homes (units), not properties, as the City counts it."""
    names = {
        "sideyards": "side_yards",
        "garden_or_open_space": "gardens",
        "business_expansion": "business",
        "housing_units_below_30_pct_ami": "homes_below_30",
        "housing_units_60_80_pct_ami": "homes_60_80",
        "housing_units_80_120_pct_ami": "homes_80_120",
        "housing_units_market_rate": "homes_market",
    }
    out = []
    for row in table_rows:
        fy = row.get("fiscal_year")
        if fy is None:
            continue
        entry: dict[str, Any] = {"fy": int(fy)}
        for source, name in names.items():
            value = row.get(source)
            entry[name] = None if value is None else int(round(float(value)))
        out.append(entry)
    return sorted(out, key=lambda e: e["fy"])
