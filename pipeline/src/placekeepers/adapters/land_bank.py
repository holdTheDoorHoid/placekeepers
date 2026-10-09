"""Sources of "The Land Bank in numbers" (M4.4, issue #40; the rules are in
placekeepers.derive.land_bank):

* `land_conveyances` (Carto `rtt_summary`): every deed since 2014 that names one of the City's land
  agencies among its sellers: the Land Bank, the Redevelopment Authority, PHDC or the City. About
  21,000 rows (one per property per document), one chunk, a few seconds. The adapter decides here,
  while the names are in hand, what each deed was (a conveyance, a move between agencies, an
  agreement or something else), the buyers' type, whether the property was already conveyed to the
  same buyer (a follow up, not counted again), and, for a single lot, whether a buyer owns a parcel
  touching it by the City's owner list (OPA) and parcel shapes (the Water Department's). **No names
  are kept**: the snapshot holds those answers and never the sellers' or buyers' names. The street
  address and the deed's remarks are never downloaded.
* `land_conveyed_by_fy` (City ArcGIS, a table of the Land Management dashboard): the City's own
  count of what its land agencies conveyed by program and fiscal year, 2017 to 2023. It has not been
  edited since April 2023, so it is read once (`cadence: frozen`).

Verified against the live sources on 2026-10-09: 21,422 rows from 2014-01-02 to 2026-08-10, of
which 6,247 are conveyances, 5,403 moves between agencies, 503 agreements and 9,269 other
documents; the dashboard table has 7 rows, fiscal years 2017 to 2023.
"""

from __future__ import annotations

import csv
import logging
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, ClassVar
from zoneinfo import ZoneInfo

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.adapters.carto import (
    CartoAdapter,
    Column,
    _check_carto_csv,
    _check_carto_json,
    scan_csv,
)
from placekeepers.adapters.osm import load_spatial
from placekeepers.cache import RawFetch
from placekeepers.derive import land_bank
from placekeepers.geo import GEOMETRY_COLUMN, write_geoparquet
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

#: How far around a lot a parcel counts as touching it: about two meters, in degrees, so a parcel
#: across a shared wall or fence line counts and one across the street does not.
TOUCH_DEGREES = 0.00002
#: The size of a lot found only by its point (no parcel shape): about three meters.
POINT_DEGREES = 0.00003
PHILADELPHIA = ZoneInfo("America/New_York")
#: The history download: each named property's own deeds, from any seller, in chunks of accounts.
HISTORY_COLUMNS = (
    "document_id",
    "document_type",
    "display_date",
    "opa_account_num",
    "grantors",
    "grantees",
)
ACCOUNTS_PER_CHUNK = 5000


def local_day(text: str | None) -> date | None:
    """A Carto date or timestamp as its day in Philadelphia, as the City's pages show it."""
    text = (text or "").strip()
    if not text:
        return None
    if len(text) == 10:
        return date.fromisoformat(text)
    moment = datetime.fromisoformat(text.replace(" ", "T"))
    return moment.astimezone(PHILADELPHIA).date()


class LandConveyances(CartoAdapter):
    """Deeds from the City's land agencies since 2014, classified, with the names dropped."""

    columns = (
        Column("document_id", "document_id", "BIGINT"),
        Column("document_type", "document_type"),
        Column("display_date", "display_date", "LOCAL_DATE"),
        Column("opa_account_num", "opa_account_num"),
        Column("grantors", "grantors"),
        Column("grantees", "grantees"),
        Column("total_consideration", "total_consideration", "DOUBLE"),
        Column("adjusted_total_consideration", "adjusted_total_consideration", "DOUBLE"),
        Column("property_count", "property_count", "INTEGER"),
        Column(GEOMETRY_COLUMN, "encode(ST_AsBinary(the_geom), 'hex')", "WKB"),
    )
    #: Read to classify the deed, then dropped: the snapshot never holds them (tests check it).
    dropped: ClassVar[tuple[str, ...]] = ("grantors", "grantees")
    #: Never downloaded at all.
    never_fetch: ClassVar[tuple[str, ...]] = ("street_address", "legal_remarks")
    #: The owner list and parcel shapes the next door check reads, when they are there.
    depends_on = ("opa_properties", "pwd_parcels")
    required_columns = (
        "document_id",
        "document_type",
        "display_date",
        "kind",
        "agency",
        "buyer_type",
        "next_door",
        "follow_up",
        "property_count",
        "adjusted_total_consideration",
    )

    def fetch(self, dest: Path) -> dict[str, Any]:
        """The deeds from the agencies, then every deed of the properties they name, from any
        seller, so the release rule can see who owned each property before."""
        info = super().fetch(dest)
        accounts: set[str] = set()
        for path in sorted(dest.glob("chunk-*.csv")):
            with path.open(newline="", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    account = (row.get("opa_account_num") or "").strip()
                    if len(account) == 9 and account.isdigit():
                        accounts.add(account)
        chosen = sorted(accounts)
        size = ACCOUNTS_PER_CHUNK
        total = 0
        for number, start in enumerate(range(0, len(chosen), size), 1):
            part = chosen[start : start + size]
            path = dest / f"history-{number:05d}.csv"
            self.ctx.http.download(
                self.api_url,
                path,
                data={"q": self.history_query(part), "format": "csv"},
                check_file=_check_carto_csv,
            )
            rows, _ = scan_csv(path, None)
            reply = self.ctx.http.get_json(
                self.api_url,
                data={"q": self.history_query(part, count=True)},
                check=_check_carto_json,
            )
            expected = int(reply["rows"][0]["n"])
            if rows != expected:
                raise FetchError(
                    f"History chunk {number} has {rows:,} rows but the table reports "
                    f"{expected:,}; trying again next run"
                )
            total += rows
        log.info("%s: %s earlier deeds of %s properties", self.id, f"{total:,}", f"{len(chosen):,}")
        info["history_rows"] = total
        info["history_accounts"] = len(chosen)
        return info

    def history_query(self, accounts: list[str], *, count: bool = False) -> str:
        for account in accounts:
            if not (len(account) == 9 and account.isdigit()):
                raise FetchError(f"{account!r} is not a 9 digit OPA account")
        values = ", ".join(f"('{account}')" for account in accounts)
        table = self.endpoint.table
        what = (
            "count(*) AS n" if count else ", ".join(f"{table}.{c} AS {c}" for c in HISTORY_COLUMNS)
        )
        return (
            f"SELECT {what} FROM {table} JOIN (VALUES {values}) AS chosen(chosen_account) "
            f"ON {table}.opa_account_num = chosen.chosen_account "
            f"WHERE {table}.document_type ILIKE '%DEED%'"
        )

    def histories(self, raw: RawFetch) -> dict[str, list[land_bank.EarlierDeed]]:
        """Each property's own deeds, read from the history download (names only in memory)."""
        assert raw.dir is not None
        found: dict[str, list[land_bank.EarlierDeed]] = defaultdict(list)
        for path in sorted(raw.dir.glob("history-*.csv")):
            with path.open(newline="", encoding="utf-8") as handle:
                for row in csv.DictReader(handle):
                    deed = land_bank.earlier_deed(
                        row.get("document_type"),
                        row.get("grantors"),
                        row.get("grantees"),
                        local_day(row.get("display_date")),
                        int(float(row["document_id"])) if row.get("document_id") else None,
                    )
                    if deed is not None:
                        found[(row.get("opa_account_num") or "").strip()].append(deed)
        return found

    def normalize(self, raw: RawFetch, out: Path) -> None:
        named = out.with_name(f"{out.name}.names")
        try:
            super().normalize(raw, named)
            table = pq.read_table(named)
        finally:
            named.unlink(missing_ok=True)
        deeds = [
            land_bank.classify(kind, sellers, buyers)
            for kind, sellers, buyers in zip(
                table.column("document_type").to_pylist(),
                table.column("grantors").to_pylist(),
                table.column("grantees").to_pylist(),
                strict=True,
            )
        ]
        accounts = table.column("opa_account_num").to_pylist()
        kinds_of = table.column("document_type").to_pylist()
        geometries = table.column(GEOMETRY_COLUMN).to_pylist()
        counts = table.column("property_count").to_pylist()
        days = table.column("display_date").to_pylist()
        ids = table.column("document_id").to_pylist()

        conveyed = [i for i, deed in enumerate(deeds) if deed.kind == "conveyance"]
        # First, what each property's own history says: a deed for property already in private
        # hands is a release or a correction, and a miscellaneous deed with no record of the
        # agency holding the property lists lots it did not hold yet (a batch agreement recorded
        # before the deeds). Neither is a conveyance.
        history = self.histories(raw)
        follow: dict[int, bool] = {}
        for i in conveyed:
            account = (accounts[i] or "").strip()
            if not account or days[i] is None:
                follow[i] = False
                continue
            before = land_bank.owned_privately_before(
                history.get(account, []), days[i], int(ids[i] or 0)
            )
            follow[i] = bool(before) or (before is None and land_bank.is_miscellaneous(kinds_of[i]))
        released = sum(follow.values())
        # Then the same property conveyed again to the same buyer, or within a year.
        kept = [i for i in conveyed if not follow[i]]
        rows = [
            land_bank.ConveyanceRow(
                key=_property_key(accounts[i], geometries[i], ids[i], i),
                day=days[i] or date.min,
                document_id=int(ids[i] or 0),
                buyers=deeds[i].buyers,
            )
            for i in kept
        ]
        for i, again in zip(kept, land_bank.follow_ups(rows), strict=True):
            follow[i] = again
        singles = [i for i in conveyed if (counts[i] or 1) == 1]
        next_door = self.next_door(
            {i: (accounts[i], geometries[i]) for i in singles},
            {i: deeds[i].buyers for i in singles},
        )

        table = table.drop_columns(list(self.dropped))
        table = table.append_column("kind", pa.array([d.kind for d in deeds], pa.string()))
        table = table.append_column("agency", pa.array([d.agency for d in deeds], pa.string()))
        table = table.append_column(
            "to_agency", pa.array([d.to_agency for d in deeds], pa.string())
        )
        table = table.append_column(
            "buyer_type", pa.array([d.buyer_type for d in deeds], pa.string())
        )
        table = table.append_column(
            "next_door", pa.array([next_door.get(i) for i in range(len(deeds))], pa.bool_())
        )
        table = table.append_column(
            "follow_up", pa.array([follow.get(i) for i in range(len(deeds))], pa.bool_())
        )
        kinds = sorted(
            {
                g.geom_type
                for g in shapely.from_wkb([w for w in geometries if w is not None])
                if g is not None and not g.is_empty
            }
        )
        write_geoparquet(table, out, kinds)
        found = {kind: sum(1 for d in deeds if d.kind == kind) for kind in land_bank.KINDS}
        log.info(
            "%s: %s deeds for property already in private hands or not yet the agency's",
            self.id,
            f"{released:,}",
        )
        log.info(
            "%s: %s; %s follow ups; %s of %s single lots go to an owner next door",
            self.id,
            ", ".join(f"{kind} {n:,}" for kind, n in found.items()),
            f"{sum(follow.values()):,}",
            f"{sum(1 for v in next_door.values() if v):,}",
            f"{len(singles):,}",
        )

    def next_door(
        self,
        lots: dict[int, tuple[str | None, bytes | None]],
        buyers: dict[int, tuple[str, ...]],
    ) -> dict[int, bool]:
        """For each lot (row number: account, point), whether a buyer owns a parcel touching it.
        Lots that cannot be placed, or every lot when the owner list or the parcel shapes are
        missing, are left out (not checked)."""
        if not lots:
            return {}
        paths = {}
        for source in self.depends_on:
            meta = SnapshotStore(self.ctx.cache, source).current()
            if meta is None:
                note = f"The next door check was skipped: {source} has no good snapshot"
                log.warning("%s: %s", self.id, note)
                self.notes.append(note)
                return {}
            paths[source] = SnapshotStore(self.ctx.cache, source).path_for(meta)
        targets = pa.table(
            {
                "i": pa.array(list(lots), pa.int64()),
                "opa": pa.array([lots[i][0] for i in lots], pa.string()),
                "wkb": pa.array([lots[i][1] for i in lots], pa.binary()),
            }
        )
        con = self.ctx.duckdb()
        try:
            load_spatial(con)
            con.register("targets", targets)
            parcels = quote_literal(str(paths["pwd_parcels"]))
            owners = quote_literal(str(paths["opa_properties"]))
            con.execute(
                f"""CREATE TABLE parcels AS
                SELECT brt_id, geometry AS g, ST_XMin(geometry) AS x0, ST_XMax(geometry) AS x1,
                       ST_YMin(geometry) AS y0, ST_YMax(geometry) AS y1
                FROM read_parquet({parcels}) WHERE geometry IS NOT NULL"""
            )
            con.execute(
                f"""CREATE TABLE lots AS
                SELECT i, opa, ST_Buffer(
                    COALESCE(g, ST_Buffer(ST_GeomFromWKB(wkb), {POINT_DEGREES})), {TOUCH_DEGREES}
                ) AS g
                FROM targets t
                LEFT JOIN (SELECT brt_id, any_value(g) AS g FROM parcels GROUP BY 1) p
                  ON p.brt_id = t.opa
                WHERE p.g IS NOT NULL OR t.wkb IS NOT NULL"""
            )
            con.execute(
                """CREATE TABLE lots_box AS SELECT *, ST_XMin(g) AS x0, ST_XMax(g) AS x1,
                   ST_YMin(g) AS y0, ST_YMax(g) AS y1 FROM lots"""
            )
            # The boxes first (a fast range join), then the shapes themselves.
            pairs = con.execute(
                f"""WITH near AS (
                    SELECT DISTINCT l.i, p.brt_id
                    FROM lots_box l JOIN parcels p
                      ON p.x0 <= l.x1 AND p.x1 >= l.x0 AND p.y0 <= l.y1 AND p.y1 >= l.y0
                    WHERE ST_Intersects(l.g, p.g) AND p.brt_id IS DISTINCT FROM l.opa)
                SELECT near.i, o.owner_1, o.owner_2
                FROM near JOIN read_parquet({owners}) o ON o.parcel_number = near.brt_id"""
            ).fetchall()
            placed = {row[0] for row in con.execute("SELECT i FROM lots").fetchall()}
        finally:
            con.close()
        neighbours: dict[int, list[tuple[str | None, str | None]]] = {i: [] for i in placed}
        for i, owner_1, owner_2 in pairs:
            neighbours[i].append((owner_1, owner_2))
        return {i: land_bank.owns_next_door(buyers[i], found) for i, found in neighbours.items()}


def _property_key(account: str | None, geometry: bytes | None, document: Any, row: int) -> str:
    """The property a row is about: its OPA account, else its point to about a meter, else the row
    itself (never matched to another)."""
    if account and account.strip():
        return f"opa:{account.strip()}"
    if geometry is not None:
        point = shapely.from_wkb(geometry)
        if point is not None and not point.is_empty and point.geom_type == "Point":
            return f"pt:{point.x:.5f},{point.y:.5f}"
    return f"row:{document}:{row}"


class LandConveyedByFy(ArcgisAdapter):
    """The City's Land Management dashboard table: properties conveyed by fiscal year and program,
    and homes by income level, 2017 to 2023."""

    required_columns = ("fiscal_year", "sideyards", "garden_or_open_space", "business_expansion")
