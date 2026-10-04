"""Context for the violence reduction lens: census tract boundaries and tree canopy.

Census tracts (2020) let each parcel find its tract's poverty rate from the American Community
Survey (`acs_poverty`, which has no shapes). The City's copy is used because it is adjusted to the
City's standard boundary, which the parcels follow.

The tree canopy comes from the City's 2018 Urban Tree Canopy assessment (University of Vermont
Spatial Analysis Laboratory for Parks and Recreation): every patch of canopy as a polygon marked
"No Change", "Gain" or "Loss" between 2008 and 2018, 665,748 polygons. The lens needs only how much
canopy there is around each place, so the snapshot keeps square meters of canopy per H3 resolution
9 cell (about two blocks across), with every polygon split exactly along the cell edges; the
polygons themselves are not kept. Pages are requested with shapes simplified to about 30
centimeters (`maxAllowableOffset`) and six decimal places, which cuts the download from about
2 GB to about 570 MB and changes the canopy area by less than 0.1 percent (measured on 2026-10-04).
The assessment is from 2018 and the City has published no newer one, so the source is frozen:
downloaded once and kept.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import ClassVar

import h3
import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely import STRtree
from shapely.geometry import Polygon, shape

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.cache import RawFetch
from placekeepers.derive.street_safety import PHILLY_LAT, PHILLY_LNG, to_meters

log = logging.getLogger(__name__)

H3_RESOLUTION = 9

#: The canopy classes of the assessment, and which year each counts as canopy in.
CANOPY_CLASSES = ("No Change", "Gain", "Loss")


class CensusTracts2020(ArcgisAdapter):
    """The 408 census tracts of 2020 (`geoid` matches the Census Bureau's, such as 42101000101)."""

    required_columns = ("geoid", "geometry")


def cell_polygon(cell: str) -> Polygon:
    """An H3 cell as a longitude and latitude polygon."""
    return Polygon([(lng, lat) for lat, lng in h3.cell_to_boundary(cell)])


def philadelphia_cells(resolution: int = H3_RESOLUTION) -> list[str]:
    """Every H3 cell with its center in a generous box around Philadelphia, sorted."""
    (south, north), (west, east) = PHILLY_LAT, PHILLY_LNG
    box = h3.LatLngPoly([(south, west), (south, east), (north, east), (north, west)])
    return sorted(h3.polygon_to_cells(box, resolution))


class CellAreas:
    """Square meters of each canopy class per H3 cell, added up page by page.

    Each polygon is cut along the cell edges and every piece counts in its own cell, so a park
    forest that spans many cells is shared out exactly."""

    def __init__(self, cells: list[str]):
        self.cells = cells
        polygons = np.array([cell_polygon(c) for c in cells], dtype=object)
        self.polygons_m = to_meters(polygons)
        self.tree = STRtree(self.polygons_m)
        self.areas = np.zeros((len(cells), len(CANOPY_CLASSES)))

    def add(self, geometries: list, classes: list[int]) -> float:
        """Add polygons (longitude and latitude) of the given class indexes. Returns the area
        that fell outside every cell (none, unless the data strays far outside the city)."""
        if not geometries:
            return 0.0
        shapes_m = to_meters(np.array(geometries, dtype=object))
        invalid = ~shapely.is_valid(shapes_m)
        if invalid.any():
            shapes_m[invalid] = shapely.make_valid(shapes_m[invalid])
        pieces, cells = self.tree.query(shapes_m, predicate="intersects")
        areas = shapely.area(shapely.intersection(shapes_m[pieces], self.polygons_m[cells]))
        kinds = np.asarray(classes)[pieces]
        np.add.at(self.areas, (cells, kinds), areas)
        return float(shapely.area(shapes_m).sum() - areas.sum())

    def table(self) -> pa.Table:
        keep = self.areas.sum(axis=1) > 0
        no_change, gain, loss = (self.areas[keep, i] for i in range(len(CANOPY_CLASSES)))
        cells = [c for c, k in zip(self.cells, keep, strict=True) if k]
        return pa.table(
            {
                "h3": pa.array(cells, pa.string()),
                "no_change_m2": pa.array(np.round(no_change, 1)),
                "gain_m2": pa.array(np.round(gain, 1)),
                "loss_m2": pa.array(np.round(loss, 1)),
                "canopy_2008_m2": pa.array(np.round(no_change + loss, 1)),
                "canopy_2018_m2": pa.array(np.round(no_change + gain, 1)),
                "cell_m2": pa.array(np.round(shapely.area(self.polygons_m[keep]), 1)),
            }
        )


class TreeCanopy2018(ArcgisAdapter):
    """Tree canopy per H3 resolution 9 cell, in 2008 and 2018 (see the module docstring)."""

    out_fields = ("OBJECTID", "CLASS_NAME")
    query_params: ClassVar[dict[str, str]] = {
        "geometryPrecision": "6",
        "maxAllowableOffset": "0.000003",
    }
    required_columns = ("h3", "canopy_2008_m2", "canopy_2018_m2", "cell_m2")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        areas = CellAreas(philadelphia_cells())
        unknown: dict[str, int] = {}
        outside = 0.0
        polygons = 0
        for page in sorted(raw.dir.glob("page-*.geojson")):
            data = json.loads(page.read_text(encoding="utf-8"))
            geometries, classes = [], []
            for feature in data.get("features") or []:
                geometry = feature.get("geometry")
                name = (feature.get("properties") or {}).get("CLASS_NAME")
                if name not in CANOPY_CLASSES:
                    unknown[str(name)] = unknown.get(str(name), 0) + 1
                    continue
                if not geometry:
                    continue
                geometries.append(shape(geometry))
                classes.append(CANOPY_CLASSES.index(name))
            outside += areas.add(geometries, classes)
            polygons += len(geometries)
        if unknown:
            raise FetchError(f"Unknown canopy classes: {unknown}")
        if polygons == 0:
            raise FetchError("The download has no canopy polygons")
        if outside > 1.0:
            note = f"{outside:,.0f} square meters of canopy fall outside the H3 grid"
            log.warning("%s: %s", self.id, note)
            self.notes.append(note)
        table = areas.table()
        log.info(
            "%s: %s polygons in %s cells, %s square meters of canopy in 2018",
            self.id,
            f"{polygons:,}",
            f"{table.num_rows:,}",
            f"{sum(table.column('canopy_2018_m2').to_pylist()):,.0f}",
        )
        pq.write_table(table, out, compression="zstd")
