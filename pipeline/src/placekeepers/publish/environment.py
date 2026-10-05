"""The heat, trees and flooding layers (docs/CONTRACTS.md section 4), added by M3.1.

* `heat_tracts` (tiles/environment.pmtiles): the City's Heat Vulnerability Index, one polygon per
  2010 census tract, with each of its three scores as a class from 1 to 5: the fifth of the
  tracts the tract falls in, 5 the most (`hv` heat vulnerability, `he` heat exposure, `hs` heat
  sensitivity; absent where the index reports none), and `vh` 1 where the City rates the tract's
  heat vulnerability very high (its priority areas).
* `floodplain` (tiles/environment.pmtiles): FEMA's flood areas as the City publishes them, `z` 1
  for the 1 percent annual chance floodplain (zones A and AE) and 2 for the 0.2 percent annual
  chance area, with `fw` 1 on the floodway, the channel that must stay open for floods to pass.
* `trees` (tiles/trees.pmtiles): every tree in Parks and Recreation's tree inventory, the trees
  the City keeps on its streets and in its parks: `sp` its common name ("Red Maple") and `d` its
  trunk diameter in inches at chest height, each only when known.

The trees are a file of their own because they are many small points shown only close in; the
two polygon layers stay light at every zoom.
"""

from __future__ import annotations

import logging
import re
import string
from datetime import date
from pathlib import Path

import pyarrow.parquet as pq

from placekeepers.context import Context
from placekeepers.derive.heat import FLOOD_0_2_PERCENT, FLOOD_1_PERCENT, flood_class
from placekeepers.derive.street_safety import percentile_rank
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder

log = logging.getLogger(__name__)

ENVIRONMENT_FILE = "tiles/environment.pmtiles"
TREES_FILE = "tiles/trees.pmtiles"

#: Trunk diameters (inches) outside this range are data entry errors and are not shown.
DIAMETER_RANGE = (1, 80)
#: How the inventory writes a tree it could not name.
UNNAMED = {"", "UNKNOWN", "UNKNOWN UNKNOWN"}
_SPECIES_SPLIT = re.compile(r"\s+[-–—]+\s+")


def fifths(values: list[float | None]) -> list[int | None]:
    """The class from 1 to 5 of each value among the values present: the fifth it falls in, by
    the share of values strictly lower (5 the highest). None stays None."""
    present = [v for v in values if v is not None]
    ranks = iter(percentile_rank(present))
    return [None if v is None else min(5, 1 + next(ranks) // 20) for v in values]


def common_name(tree_name: object) -> str | None:
    """The common name in the inventory's "GENUS SPECIES - COMMON NAME", in title case, with the
    inventory's "OTHER" (species not recorded) dropped: "PRUNUS SPECIES - OTHER CHERRY" is
    "Cherry". None for a tree the inventory could not name."""
    if not isinstance(tree_name, str):
        return None
    parts = _SPECIES_SPLIT.split(tree_name.strip(), maxsplit=1)
    name = parts[1].strip() if len(parts) == 2 else ""
    if name.upper() in UNNAMED:
        return None
    if name.upper().startswith("OTHER "):
        name = name[len("OTHER ") :]
    return string.capwords(name.lower()) or None


def diameter(value: object) -> int | None:
    """The trunk diameter in whole inches, or None when unknown or out of range."""
    if not isinstance(value, int | float):
        return None
    inches = round(float(value))
    low, high = DIAMETER_RANGE
    return inches if low <= inches <= high else None


def build_heat_tracts(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["heat_vulnerability"],
        columns=["geoid10", "hvi_score", "hei_score", "hsi_score", "n_veryhigh", "geometry"],
    )
    rows = [r for r in table.to_pylist() if r["geometry"] is not None]
    rows.sort(key=lambda r: str(r["geoid10"] or ""))
    classes = {
        key: fifths([r[score] for r in rows])
        for key, score in (("hv", "hvi_score"), ("he", "hei_score"), ("hs", "hsi_score"))
    }
    unscored = 0
    with GeoJSONWriter(out) as writer:
        for i, row in enumerate(rows):
            properties: dict[str, object] = {"id": str(row["geoid10"] or "")}
            for key, values in classes.items():
                if values[i] is not None:
                    properties[key] = values[i]
            if "hv" not in properties:
                unscored += 1
            if row["n_veryhigh"] == 1:
                properties["vh"] = 1
            writer.write(properties, geometry_json(row["geometry"], 6))
    notes = []
    if unscored:
        notes.append(
            f"{unscored} census tracts have no heat vulnerability score in the City's index"
        )
    return BuildResult(writer.count, notes)


def build_floodplain(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["fema_floodplain"], columns=["sfha_tf", "zone_subty", "objectid", "geometry"]
    )
    rows = sorted(table.to_pylist(), key=lambda r: r["objectid"] or 0)
    counts = {FLOOD_1_PERCENT: 0, FLOOD_0_2_PERCENT: 0}
    with GeoJSONWriter(out) as writer:
        for row in rows:
            zone = flood_class(row["sfha_tf"], row["zone_subty"])
            if zone is None or row["geometry"] is None:
                continue
            properties: dict[str, object] = {"z": zone}
            if str(row["zone_subty"] or "").strip().upper() == "FLOODWAY":
                properties["fw"] = 1
            counts[zone] += 1
            writer.write(properties, geometry_json(row["geometry"], 6))
    log.info(
        "floodplain: %s areas at 1 percent, %s at 0.2 percent",
        counts[FLOOD_1_PERCENT],
        counts[FLOOD_0_2_PERCENT],
    )
    return BuildResult(writer.count, [])


def build_trees(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["street_trees"], columns=["tree_name", "tree_dbh", "geometry"])
    unnamed = sized = 0
    with GeoJSONWriter(out) as writer:
        for name, dbh, wkb in zip(
            *(table.column(c).to_pylist() for c in ("tree_name", "tree_dbh", "geometry")),
            strict=True,
        ):
            if wkb is None:
                continue
            properties: dict[str, object] = {}
            species = common_name(name)
            if species:
                properties["sp"] = species
            else:
                unnamed += 1
            inches = diameter(dbh)
            if inches is not None:
                properties["d"] = inches
                sized += 1
            writer.write(properties, geometry_json(wkb, 6))
    notes = [
        f"{writer.count:,} City trees on the map: {writer.count - unnamed:,} with a species, "
        f"{sized:,} with a trunk size"
    ]
    return BuildResult(writer.count, notes)


ENVIRONMENT_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(ENVIRONMENT_FILE, "heat_tracts", ("heat_vulnerability",), build_heat_tracts),
    LayerBuilder(ENVIRONMENT_FILE, "floodplain", ("fema_floodplain",), build_floodplain),
    LayerBuilder(TREES_FILE, "trees", ("street_trees",), build_trees),
)
