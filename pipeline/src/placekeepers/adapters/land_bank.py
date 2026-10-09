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

import logging
from datetime import date
from pathlib import Path
from typing import Any, ClassVar

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.carto import CartoAdapter, Column
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
        geometries = table.column(GEOMETRY_COLUMN).to_pylist()
        counts = table.column("property_count").to_pylist()
        days = table.column("display_date").to_pylist()
        ids = table.column("document_id").to_pylist()

        conveyed = [i for i, deed in enumerate(deeds) if deed.kind == "conveyance"]
        rows = [
            land_bank.ConveyanceRow(
                key=_property_key(accounts[i], geometries[i], ids[i], i),
                day=days[i] or date.min,
                document_id=int(ids[i] or 0),
                buyers=deeds[i].buyers,
            )
            for i in conveyed
        ]
        follow = dict(zip(conveyed, land_bank.follow_ups(rows), strict=True))
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
