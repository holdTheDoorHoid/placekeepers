"""Street trees and the floodplain, for the heat and shade lens (milestone M3.1).

**Street trees.** Philadelphia Parks and Recreation's tree inventory (OpenDataPhilly "Philadelphia
Tree Inventory"; the City's metadata calls it the street tree inventory): one point per tree the
City keeps, with its species ("ACER RUBRUM - RED MAPLE"), its trunk diameter at breast height in
inches, and the inventory year. The City publishes one ArcGIS layer per year
(`PPR_Tree_Inventory_2021` to `ppr_tree_inventory_2025`), so each run lists the City's services and
takes the newest year, never one older than the layer the registry names; the snapshot says which
in `layer` and `inventory_year`, and keeps the layer's last edit day as `source_date`. Only the
tree's place, species, trunk size and year are kept (the layer holds nothing personal; its
`loc_x` and `loc_y` repeat the point). Verified against the live service on 2026-10-05: 151,726
trees, all from 2025, last edited 2025-11-20.

**The floodplain.** FEMA's flood hazard areas as the City publishes them, clipped to Philadelphia
(`fema_floodplain_2023`, OpenDataPhilly "FEMA Flood Plain"). Only two kinds of area are downloaded:
FEMA's special flood hazard area, where a flood has a 1 percent chance or more in any year (zones
A and AE, with the AE floodway; `sfha_tf` is T), and the area with a 0.2 percent annual chance
(zone X marked "0.2 PCT ANNUAL CHANCE FLOOD HAZARD"). The rest of the city, which FEMA marks as an
area of minimal flood hazard, and open water are not downloaded. Verified on 2026-10-05: 1,041
areas in the layer, 883 of them in these two kinds (392 at 1 percent, 491 at 0.2 percent), last
edited 2025-04-15.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import quote

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.arcgis import ArcgisAdapter, check_arcgis
from placekeepers.adapters.base import FetchError
from placekeepers.cache import RawFetch
from placekeepers.config import local_date
from placekeepers.httpclient import AccessRefused

log = logging.getLogger(__name__)

#: The yearly tree inventory layers, in any capitalization (PPR_Tree_Inventory_2021).
_TREE_LAYER = re.compile(r"^ppr_tree_inventory_(?P<year>\d{4})$", re.IGNORECASE)


def tree_layer_year(name: str) -> int | None:
    """The inventory year of a tree inventory layer name, or None for any other layer."""
    found = _TREE_LAYER.match(name)
    return int(found.group("year")) if found else None


def newest_tree_layer(names: list[str], floor: str) -> str:
    """The newest yearly tree inventory among `names`, never older than `floor` (the layer the
    registry names)."""
    best, best_year = floor, tree_layer_year(floor) or 0
    for name in names:
        year = tree_layer_year(name)
        if year is not None and year > best_year:
            best, best_year = name, year
    return best


def _with_columns(out: Path, columns: dict[str, pa.Array]) -> None:
    """Add columns to a GeoParquet file, keeping its geo metadata."""
    table = pq.read_table(out)
    for name, values in columns.items():
        table = table.append_column(name, values)
    metadata = (pq.read_schema(out).metadata or {}).get(b"geo")
    write = table.replace_schema_metadata({b"geo": metadata} if metadata else None)
    pq.write_table(write, out, compression="zstd")


def _edit_day(raw: RawFetch):
    edited = raw.info.get("data_last_edit")
    if edited is None:
        raise FetchError("The layer does not say when its data was last edited")
    return local_date(datetime.fromtimestamp(edited / 1000, UTC))


class StreetTrees(ArcgisAdapter):
    """The newest yearly street tree inventory (module docstring)."""

    out_fields = ("objectid", "tree_name", "tree_dbh", "year")
    required_columns = (
        "objectid",
        "tree_name",
        "tree_dbh",
        "inventory_year",
        "layer",
        "source_date",
        "geometry",
    )

    def __init__(self, source, ctx):
        super().__init__(source, ctx)
        self.layer_name = self.endpoint.service

    @property
    def layer_url(self) -> str:
        root = self.endpoint.url or self.root
        return f"{root}/{quote(self.layer_name)}/FeatureServer/{self.endpoint.layer}"

    def choose_layer(self) -> str:
        """List the City's services and pick the newest yearly inventory. A refusal stops the
        download; any other trouble falls back to the registry's layer."""
        root = self.endpoint.url or self.root
        try:
            listing = self.ctx.http.get_json(root, {"f": "json"}, check=check_arcgis)
        except AccessRefused:
            raise
        except Exception as exc:  # the registry's layer still works
            self.notes.append(f"The City's list of layers could not be read ({exc})")
            return self.endpoint.service
        services = listing.get("services") if isinstance(listing, dict) else None
        names = [
            str(service.get("name") or "")
            for service in (services if isinstance(services, list) else [])
            if isinstance(service, dict)
        ]
        return newest_tree_layer(names, self.endpoint.service)

    def fetch(self, dest: Path) -> dict[str, Any]:
        self.layer_name = self.choose_layer()
        if self.layer_name != self.endpoint.service:
            log.info("%s: the City has a newer inventory: %s", self.id, self.layer_name)
        info = super().fetch(dest)
        info["layer"] = self.layer_name
        return info

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        layer = raw.info.get("layer") or self.endpoint.service
        year = tree_layer_year(layer)
        if year is None:
            raise FetchError(f"{layer} does not name an inventory year")
        rows = pq.read_metadata(out).num_rows
        day = _edit_day(raw)
        _with_columns(
            out,
            {
                "inventory_year": pa.array([year] * rows, pa.int16()),
                "layer": pa.array([layer] * rows, pa.string()),
                "source_date": pa.array([day] * rows, pa.date32()),
            },
        )
        self.notes.append(f"{layer}: {rows:,} trees, last edited {day.isoformat()}")


#: FEMA's special flood hazard area (1 percent annual chance or more) and the 0.2 percent annual
#: chance area. LIKE keeps a stray trailing space in the City's subtype from hiding a zone.
FLOODPLAIN_WHERE = "sfha_tf = 'T' OR zone_subty LIKE '0.2 PCT ANNUAL CHANCE%'"


class FemaFloodplain(ArcgisAdapter):
    """FEMA's 1 percent and 0.2 percent annual chance flood areas (module docstring)."""

    out_fields = ("objectid", "fld_zone", "zone_subty", "sfha_tf", "dfirm_id", "version_id")
    query_where: ClassVar[str] = FLOODPLAIN_WHERE
    # About ten centimeters is plenty for a flood zone, and keeps the download small.
    query_params: ClassVar[dict[str, str]] = {"geometryPrecision": "6"}
    required_columns = ("fld_zone", "zone_subty", "sfha_tf", "source_date", "geometry")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        rows = pq.read_metadata(out).num_rows
        day = _edit_day(raw)
        _with_columns(out, {"source_date": pa.array([day] * rows, pa.date32())})


__all__ = [
    "FLOODPLAIN_WHERE",
    "FemaFloodplain",
    "StreetTrees",
    "newest_tree_layer",
    "tree_layer_year",
]
