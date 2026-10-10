"""The rules and records of each lot (M4.6, issue #42): five map layers in tiles/rules.pmtiles and
what the lot dossiers need (docs/CONTRACTS.md sections 4 and 6).

Map layers (each with its own switch, in the registry group `rules`):

* `historic_districts`: the Historical Commission's local historic districts: `id` (a short id
  of the name), `nm` (the name as the Commission writes it) and `dd` (the designation day, when
  the layer holds a real one);
* `historic_sites`: the properties on the Philadelphia Register of Historic Places, one parcel
  shape each: `ad` (the address as the Commission writes it), `d` (the day it was listed on its
  own, when it was), `dn` and `dd` (the district it belongs to and that district's day);
* `overlays`: the Planning Commission's zoning overlays: `id` (the overlay's key in
  `dossiers/common.json`), `nm`, `sy` (its symbol, such as /CTR), `t` (1 overlay district, 2
  supplemental control, 3 Wissahickon Watershed impervious coverage limit), `cs` and `cl` (the
  Zoning Code section and its link), `su` (a sunset day), `pb` and `pu` (a bill pending in City
  Council and its link);
* `hearings`: every hearing still to come before the Zoning Board of Adjustment, the L&I Review
  Board, the Board of Building Standards or another board, on the parcel's point: `id` (the OPA
  account, to open the lot page), `d` and `tm` (the day and time in
  Philadelphia), `b` (1 zoning, 2 L&I Review Board, 3 building standards, 0 other), `ty` (the
  kind of appeal in the City's words), `ad` (the address) and `rco` (the registered community
  organization the City told). **Never who filed the appeal or the owner's name**: those appear
  only on the lot's own page (docs/ETHICS.md, "Appeals and hearings"). Never the appeal's number
  either, which for a zoning appeal is the zoning permit's number;
* `brownfields`: the EPA's brownfield properties: `id` (the EPA's registry id), `nm` and `ad`
  (the site's name and address as the EPA writes them).

For the dossiers: each lot's `rules` (placekeepers.derive.lot_rules), its `appeals`
(placekeepers.derive.appeals), how many hearings are to come within 500 feet, and the overlays
by key for `dossiers/common.json`.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.derive import appeals as ap
from placekeepers.derive import lot_rules as lr
from placekeepers.derive.timeline import clean_text
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

RULES_FILE = "tiles/rules.pmtiles"
#: The sources each part of the rules needs.
HISTORIC_SOURCES = ("historic_districts", "historic_sites")
OVERLAY_SOURCES = ("zoning_overlays", "zoning_base_districts")
BROWNFIELD_SOURCE = "epa_brownfields"
APPEALS_SOURCE = "appeals"
RULE_SOURCES = (*HISTORIC_SOURCES, *OVERLAY_SOURCES, BROWNFIELD_SOURCE)
#: 500 feet in meters: the hearings counted near a lot, as its other nearby counts.
NEARBY_M = 152.4

# Readers -------------------------------------------------------------------------------------


def _shapes(path: Path, columns: list[str]) -> tuple[list[dict[str, Any]], list[Any]]:
    """A snapshot's rows and its shapes, each made valid once."""
    table = pq.read_table(path, columns=[*columns, "geometry"])
    rows = table.drop(["geometry"]).to_pylist()
    shapes = shapely.from_wkb(np.asarray(table.column("geometry").to_pylist(), dtype=object))
    return rows, [lr.valid(shape) for shape in shapes]


def district_rows(path: Path, today: date) -> list[tuple[dict[str, Any], Any]]:
    rows, shapes = _shapes(path, ["name", "designated", "designated1"])
    out = []
    for row, shape in zip(rows, shapes, strict=True):
        name = clean_text(row["name"])
        if name is None or shape is None or shapely.is_empty(shape):
            continue
        record = {"name": name}
        day = lr.district_day(row["designated1"], row["designated"], today)
        if day:
            record["date"] = day
        out.append((record, shape))
    return out


def site_rows(path: Path, today: date) -> list[tuple[dict[str, Any], Any]]:
    rows, shapes = _shapes(
        path, ["loc", "idesigdate1", "district", "ddesigdate", "districtdesdate"]
    )
    out = []
    for row, shape in zip(rows, shapes, strict=True):
        if shape is None or shapely.is_empty(shape):
            continue
        record: dict[str, Any] = {}
        address = clean_text(row["loc"])
        if address:
            record["address"] = address
        day = lr.city_day(row["idesigdate1"], today)
        if day:
            record["date"] = day
        elif clean_text(row["idesigdate1"]):
            # Listed on its own, on a day the layer does not give plainly.
            record["individual"] = True
        district = clean_text(row["district"])
        if district:
            record["district"] = district
            district_day = lr.district_day(row["districtdesdate"], row["ddesigdate"], today)
            if district_day:
                record["district_date"] = district_day
        out.append((record, shape))
    return out


def overlay_rows(path: Path, today: date) -> list[tuple[dict[str, Any], Any]]:
    columns = [
        "overlay_name",
        "overlay_symbol",
        "type",
        "code_section",
        "code_section_link",
        "sunset_date",
        "pending",
        "pendingbill",
        "pendingbillurl",
    ]
    rows, shapes = _shapes(path, columns)
    out = []
    for row, shape in zip(rows, shapes, strict=True):
        record = lr.overlay_record(row, today)
        if record is None or shape is None or shapely.is_empty(shape):
            continue
        out.append((record, shape))
    return out


def zoning_rows(path: Path) -> list[tuple[dict[str, Any], Any]]:
    rows, shapes = _shapes(path, ["long_code", "zoninggroup", "pending", "pendingbillurl"])
    out = []
    for row, shape in zip(rows, shapes, strict=True):
        code = clean_text(row["long_code"])
        if code is None or shape is None or shapely.is_empty(shape):
            continue
        record = {"code": code}
        group = clean_text(row["zoninggroup"])
        if group:
            record["group"] = group
        if (clean_text(row["pending"]) or "").upper() == "YES":
            url = lr.not_applicable(row["pendingbillurl"])
            if url:
                record["pending_url"] = url
        out.append((record, shape))
    return out


def brownfield_rows(path: Path) -> list[tuple[dict[str, Any], Any]]:
    rows, shapes = _shapes(path, ["registry_id", "primary_name", "location_address"])
    out = []
    seen: set[str] = set()
    for row, shape in zip(rows, shapes, strict=True):
        registry_id = clean_text(row["registry_id"])
        if registry_id is None or shape is None or shapely.is_empty(shape):
            continue
        if registry_id in seen:
            continue
        seen.add(registry_id)
        record = {"id": registry_id}
        name = clean_text(row["primary_name"])
        if name:
            record["name"] = name
        address = clean_text(row["location_address"])
        if address:
            record["address"] = address
        out.append((record, shape))
    return out


@dataclass
class Rules:
    """What the dossiers draw on: the joined sets, the overlays by key, and which parts are in
    this build."""

    sets: lr.RuleSets = field(default_factory=lr.RuleSets)
    overlays: dict[str, dict[str, Any]] = field(default_factory=dict)
    #: the parts whose sources have a snapshot: historic, overlays, brownfields
    parts: set[str] = field(default_factory=set)


def load_rules(paths: dict[str, Path], today: date, *, brownfields_only: bool = False) -> Rules:
    rules = Rules()
    sets = rules.sets
    if BROWNFIELD_SOURCE in paths:
        rules.parts.add("brownfields")
        for record, point in brownfield_rows(paths[BROWNFIELD_SOURCE]):
            sets.brownfields.append(lr.to_meters(point))
            sets.brownfield_records.append(record)
    if brownfields_only:
        return rules
    if all(source in paths for source in HISTORIC_SOURCES):
        rules.parts.add("historic")
        for record, shape in district_rows(paths["historic_districts"], today):
            sets.districts.append(shape)
            sets.district_records.append(record)
        for record, shape in site_rows(paths["historic_sites"], today):
            sets.sites.append(shape)
            sets.site_records.append(record)
    if "zoning_overlays" in paths:
        rules.parts.add("overlays")
        for record, shape in overlay_rows(paths["zoning_overlays"], today):
            sets.overlays.append(shape)
            sets.overlay_ids.append(record["id"])
            rules.overlays.setdefault(record["id"], record)
    if "zoning_base_districts" in paths:
        for record, shape in zoning_rows(paths["zoning_base_districts"]):
            sets.zoning.append(shape)
            sets.zoning_records.append(record)
    return rules


def lot_shapes(ctx: Context, paths: dict[str, Path], accounts: set[str]) -> dict[str, Any]:
    """Each lot's shape, as the lots layer draws it: the vacancy model's (its Water Department
    shape, the City's polygon or a point), else the Water Department's shape."""
    shapes: dict[str, Any] = {}
    model = ctx.cache.root / "derived" / "vacancy.parquet"
    if model.is_file():
        table = pq.read_table(model, columns=["opa", "geometry"])
        for account, wkb in zip(
            table.column("opa").to_pylist(), table.column("geometry").to_pylist(), strict=True
        ):
            if account in accounts and wkb is not None:
                shapes[account] = shapely.from_wkb(wkb)
    rest = accounts - set(shapes)
    if rest and "pwd_parcels" in paths:
        from placekeepers.publish.dossiers import read_parcel_shapes

        shapes.update(read_parcel_shapes(paths["pwd_parcels"], rest))
    return shapes


def brownfield_lots(paths: dict[str, Path], shapes: dict[str, Any]) -> set[str]:
    """The lots within 100 meters of a brownfield property, by the dossiers' own rule, for the
    lots layer's `bf` (docs/CONTRACTS.md section 4)."""
    rules = load_rules(paths, date.max, brownfields_only=True)
    if not rules.sets.brownfields:
        return set()
    found = lr.lot_rules(sorted(shapes), shapes, {}, rules.sets)
    return {account for account, entry in found.items() if entry.get("brownfields")}


# Appeals ------------------------------------------------------------------------------------


def read_appeals(con: Any, path: Path) -> dict[str, list[dict[str, Any]]]:
    """The appeals of the dossier parcels (the accounts are in the table `acc`), as each lot page
    lists them."""
    columns = ", ".join(ap_columns())
    rows = con.execute(
        f"""SELECT opa_account_num, {columns}
            FROM read_parquet({quote_literal(str(path))})
            WHERE opa_account_num IN (SELECT a FROM acc)
            ORDER BY opa_account_num"""
    ).fetchall()
    names = ap_columns()
    by_account: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for account, *values in rows:
        by_account[account].append(dict(zip(names, values, strict=True)))
    return {account: ap.appeal_records(found) for account, found in by_account.items()}


def ap_columns() -> list[str]:
    from placekeepers.adapters.rules import APPEAL_COLUMNS

    return list(APPEAL_COLUMNS)


def upcoming_hearings(
    path: Path, today: date, unplaced: list[dict[str, Any]] | None = None
) -> list[dict[str, Any]]:
    """Every hearing still to come, with its parcel, address and point: the map's hearings. Those
    the City gives no point in the city go into `unplaced`, when given (they are on their lot
    pages only)."""
    table = pq.read_table(path, columns=["opa_account_num", "address", *ap_columns(), "lat", "lng"])
    out = []
    for row in table.to_pylist():
        record = ap.appeal_record(row)
        if record is None or not ap.is_upcoming(record, today):
            continue
        lat, lng = row["lat"], row["lng"]
        if lat is None or lng is None or not (39.8 <= lat <= 40.2 and -75.35 <= lng <= -74.9):
            if unplaced is not None:
                unplaced.append(record)
            continue
        out.append(
            {
                "account": clean_text(row["opa_account_num"]),
                "address": clean_text(row["address"]),
                "record": record,
                "lng": lng,
                "lat": lat,
                # Only to give the map a fixed order; never written.
                "number": ap.appeal_number(row),
            }
        )
    out.sort(
        key=lambda h: (h["record"]["hearing"], h["record"].get("hearing_time") or "", h["number"])
    )
    return out


def hearings_near(
    hearings: list[dict[str, Any]], points: dict[str, tuple[float, float]]
) -> dict[str, int]:
    """For each lot with a point, the hearings still to come within 500 feet of it, its own left
    out (they are on its page already). Lots with none are left out."""
    if not hearings:
        return {}
    cell = NEARBY_M
    grid: dict[tuple[int, int], list[tuple[float, float, str | None]]] = defaultdict(list)
    for h in hearings:
        x, y = h["lng"] * lr.M_PER_DEG_LNG, h["lat"] * lr.M_PER_DEG_LAT
        grid[(int(x // cell), int(y // cell))].append((x, y, h["account"]))
    out: dict[str, int] = {}
    for account, (lng, lat) in points.items():
        x, y = lng * lr.M_PER_DEG_LNG, lat * lr.M_PER_DEG_LAT
        cx, cy = int(x // cell), int(y // cell)
        count = 0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for hx, hy, owner in grid.get((cx + dx, cy + dy), ()):
                    if owner != account and (hx - x) ** 2 + (hy - y) ** 2 <= cell**2:
                        count += 1
        if count:
            out[account] = count
    return out


# Map layers ---------------------------------------------------------------------------------

_SLUG = re.compile(r"[^a-z0-9]+")


def slug(text: str) -> str:
    return _SLUG.sub("_", text.lower()).strip("_")


def build_historic_districts(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        for record, shape in district_rows(paths["historic_districts"], as_of):
            properties: dict[str, Any] = {"id": slug(record["name"]), "nm": record["name"]}
            if "date" in record:
                properties["dd"] = record["date"]
            writer.write(properties, geometry_json(shape))
    return BuildResult(writer.count, [])


def build_historic_sites(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        for record, shape in site_rows(paths["historic_sites"], as_of):
            properties: dict[str, Any] = {}
            for key, short in (
                ("address", "ad"),
                ("date", "d"),
                ("district", "dn"),
                ("district_date", "dd"),
            ):
                if key in record:
                    properties[short] = record[key]
            if record.get("individual"):
                properties["i"] = 1
            writer.write(properties, geometry_json(shape))
    return BuildResult(writer.count, [])


def build_overlays(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        for record, shape in overlay_rows(paths["zoning_overlays"], as_of):
            properties: dict[str, Any] = {
                "id": record["id"],
                "nm": record["name"],
                "t": record["type"],
            }
            for key, short in (
                ("symbol", "sy"),
                ("section", "cs"),
                ("link", "cl"),
                ("sunset", "su"),
                ("pending_bill", "pb"),
                ("pending_url", "pu"),
            ):
                if key in record:
                    properties[short] = record[key]
            writer.write(properties, geometry_json(shape))
    return BuildResult(writer.count, [])


def hearing_properties(hearing: dict[str, Any]) -> dict[str, Any]:
    """A hearing's map properties: never who filed the appeal or the owner's name."""
    record = hearing["record"]
    properties: dict[str, Any] = {}
    if hearing["account"]:
        properties["id"] = hearing["account"]
    properties["d"] = record["hearing"]
    if record.get("hearing_time"):
        properties["tm"] = record["hearing_time"]
    properties["b"] = ap.BOARD_CODES[record["board"]]
    kind = record.get("type") or record.get("application")
    if kind:
        properties["ty"] = kind
    if hearing["address"]:
        properties["ad"] = hearing["address"]
    if record.get("rco"):
        properties["rco"] = record["rco"]
    return properties


def build_hearings(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    unplaced: list[dict[str, Any]] = []
    hearings = upcoming_hearings(paths[APPEALS_SOURCE], as_of, unplaced)
    with GeoJSONWriter(out) as writer:
        for hearing in hearings:
            point = {
                "type": "Point",
                "coordinates": [round(hearing["lng"], 7), round(hearing["lat"], 7)],
            }
            writer.write(hearing_properties(hearing), point)
    boards = defaultdict(int)
    for hearing in hearings:
        boards[hearing["record"]["board"]] += 1
    note = (
        f"Hearings still to come on {as_of.isoformat()}: {len(hearings):,} "
        f"({boards['zoning']:,} before the Zoning Board of Adjustment, {boards['li_review']:,} the "
        f"L&I Review Board, {boards['building']:,} the Board of Building Standards, "
        f"{boards['other']:,} other boards); {len(unplaced):,} more have no point in the City's "
        "records and show on their lot pages only"
    )
    return BuildResult(writer.count, [note])


def build_brownfields(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        for record, point in brownfield_rows(paths[BROWNFIELD_SOURCE]):
            properties = {"id": record["id"]}
            if "name" in record:
                properties["nm"] = record["name"]
            if "address" in record:
                properties["ad"] = record["address"]
            writer.write(properties, geometry_json(point))
    return BuildResult(writer.count, [])


RULES_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        RULES_FILE, "historic_districts", ("historic_districts",), build_historic_districts
    ),
    LayerBuilder(RULES_FILE, "historic_sites", ("historic_sites",), build_historic_sites),
    LayerBuilder(RULES_FILE, "overlays", ("zoning_overlays",), build_overlays),
    LayerBuilder(RULES_FILE, "hearings", (APPEALS_SOURCE,), build_hearings),
    LayerBuilder(RULES_FILE, "brownfields", (BROWNFIELD_SOURCE,), build_brownfields),
)
