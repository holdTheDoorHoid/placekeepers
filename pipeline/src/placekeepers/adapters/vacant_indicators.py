"""The City's Vacant Property Indicators, for land and for buildings (ArcGIS).

Each feature is a parcel polygon with its OPA account number (`opa_id`), the City's rank
(`land_rank` or `build_rank`, 0 to 1), the date the City recalculated it (`date_update`), and the
address, owner names, building description, council district, zoning and ZIP code.

The City recalculated both layers on 2026-09-27 (28,771 lots and 9,519 buildings). Verified against
the live services on 2026-10-04.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.health import Check
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal


class CityListFreshness(ArcgisAdapter):
    """The City recalculates each list in one run and dates every record with that day. If the
    date stops advancing for six months while demolitions keep being recorded, the list is no
    longer keeping up with the city, so it is marked stale (DESIGN section 6). The map keeps using
    its last good copy for twelve months after its date (placekeepers.derive.vacancy)."""

    stale_after_days = 183
    min_demolitions = 10
    depends_on = ("li_demolitions",)

    def demolitions_since(self, day: date) -> int | None:
        store = SnapshotStore(self.ctx.cache, "li_demolitions")
        meta = store.current()
        if meta is None:
            return None
        con = self.ctx.duckdb()
        try:
            return con.execute(
                f"SELECT count(*) FROM read_parquet({quote_literal(str(store.path_for(meta)))}) "
                "WHERE status = 'COMPLETED' AND coalesce(completed_date, start_date) > ?",
                [day],
            ).fetchone()[0]
        finally:
            con.close()

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        if newest is None:
            return []
        age = (self.ctx.today() - newest).days
        if age <= self.stale_after_days:
            return [Check("city_list_current", True, f"The list is dated {newest}")]
        since = self.demolitions_since(newest)
        if since is None or since < self.min_demolitions:
            return [Check("city_list_current", True, f"The list is dated {newest}")]
        return [
            Check(
                "city_list_current",
                False,
                f"The City's list is dated {newest}, {age} days ago, while {since:,} demolitions "
                "have been recorded since, so it is no longer keeping up",
            )
        ]


class VacantIndicatorsLand(CityListFreshness):
    required_columns = ("objectid", "opa_id", "land_rank", "date_update", "geometry")


class VacantIndicatorsBldg(CityListFreshness):
    required_columns = ("objectid", "opa_id", "build_rank", "date_update", "geometry")
