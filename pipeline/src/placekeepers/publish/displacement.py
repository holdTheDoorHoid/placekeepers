"""The displacement watch on the map (M4.1; docs/CONTRACTS.md sections 3, 4 and 6).

* `watch` (tiles/displacement.pmtiles): one polygon per census tract in the watch, with its
  signs (`w`, bits of placekeepers.derive.displacement.SIGNS) and the measures behind them. Only
  watch areas are published: the map ranks no neighborhood, and areas outside the watch carry no
  numbers. A measure with too few sales, homes or households to mean something is left out.
* `dw` on the lots (`parcels`) and on SEPTA's bus and trolley stops (`stops`): the signs of the
  watch area a parcel or stop lies in, present only inside one, so a greening card knows to add
  the full caution with the ways to protect neighbors (docs/ETHICS.md, "Displacement").
* `displacement` in each lot dossier inside a watch area: the tract and its signs, the same as
  the lot's `dw`.
* `displacement` in manifest.json: the periods, the city's own measures and the thresholds, so
  the map can say what each sign compares.

From M4.7 (issue #43) each watch area also carries its neighborhood context from the Census
Bureau's survey (placekeepers.derive.tract_context): the share of renters paying half their
income or more on rent, the middle rent and household income, and how many homes are empty and
why, each with its margin of error. Context only: it changes no sign and no area, and, like every
number on the map, it is published only for watch areas.
"""

from __future__ import annotations

import logging
import math
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.derive import displacement as dw
from placekeepers.derive import tract_context as tc
from placekeepers.derive.lenses import load_tracts, tracts_of
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import WATCH_SOURCES, BuildResult, LayerBuilder

log = logging.getLogger(__name__)

WATCH_FILE = "tiles/displacement.pmtiles"


def _whole(value: float | None) -> int | None:
    return None if value is None else int(round(value))


def watch_properties(row: dict[str, Any]) -> dict[str, Any]:
    """A watch area's tile properties (docs/CONTRACTS.md section 4, `watch`)."""
    properties: dict[str, Any] = {"id": row["tract"], "w": int(row["signs"])}
    if row.get("place"):
        properties["nm"] = row["place"]
    n0, n1 = int(row["sales_earlier"] or 0), int(row["sales_recent"] or 0)
    properties["n0"], properties["n1"] = n0, n1
    if min(n0, n1) >= dw.MIN_SALES and row["price_change_pct"] is not None:
        properties["p0"] = _whole(row["median_earlier"])
        properties["p1"] = _whole(row["median_recent"])
        properties["pc"] = _whole(row["price_change_pct"])
    if n1 >= dw.MIN_SALES and row["company_pct"] is not None:
        properties["cb"] = _whole(row["company_pct"])
    homes = int(row["homes_assessed"] or 0)
    if homes >= dw.MIN_ASSESSED and row["assessment_change_pct"] is not None:
        properties["ah"] = homes
        properties["ac"] = _whole(row["assessment_change_pct"])
    if (row["occupied"] or 0) >= dw.MIN_OCCUPIED and row["renter_pct"] is not None:
        properties["oc"] = int(row["occupied"])
        properties["rp"] = _whole(row["renter_pct"])
    if row["mva_block_groups"]:
        properties["mb"] = int(row["mva_block_groups"])
        properties["mr"] = int(row["mva_rising"])
    # Rent burden (owner, 2026-10-09): the same `rh`, `rb` and `rbm` as the card's context.
    counted = int(row.get("renters_counted") or 0)
    if counted >= dw.MIN_RENTERS and row.get("rent_burden_pct") is not None:
        properties["rh"] = counted
        properties["rb"] = _whole(row["rent_burden_pct"])
        properties["rbm"] = _margin(row.get("rent_burden_moe"))
    return properties


def _margin(value: float | None) -> int | None:
    """A margin of error as a whole number, a half rounded up (a margin errs wide), never shown
    as 0 when there is one."""
    if value is None:
        return None
    return max(1, math.floor(value + 0.5))


def context_properties(row: dict[str, Any] | None) -> dict[str, Any]:
    """A watch area's neighborhood context (docs/CONTRACTS.md section 4, `watch`, M4.7): only
    numbers with enough households or homes behind them, each with its margin of error."""
    if not row:
        return {}
    out: dict[str, Any] = {}
    counted = row.get("renters_counted") or 0
    if counted >= tc.MIN_RENTERS and row.get("rent_burden_50_pct") is not None:
        out["rh"] = int(counted)
        out["rb"] = _whole(row["rent_burden_50_pct"])
        out["rbm"] = _margin(row.get("rent_burden_50_pct_moe"))
    if row.get("median_rent"):
        out["gr"] = int(row["median_rent"])
        out["grm"] = _margin(row.get("median_rent_moe"))
    if row.get("median_income"):
        out["hi"] = int(row["median_income"])
        out["him"] = _margin(row.get("median_income_moe"))
    homes = row.get("homes") or 0
    if homes >= tc.MIN_HOMES and row.get("vacant") is not None:
        out["hu"] = int(homes)
        out["vh"] = int(row["vacant"])
        out["vhm"] = _margin(row.get("vacant_moe"))
        out["vp"] = _whole(row.get("vacant_pct"))
        out["vpm"] = _margin(row.get("vacant_pct_moe"))
        for key, name in (
            ("vr", "for_rent"),
            ("vs", "for_sale"),
            ("vn", "not_yet_moved_in"),
            ("vz", "seasonal"),
            ("vo", "other_vacant"),
        ):
            if row.get(name) is not None:
                out[key] = int(row[name])
                out[f"{key}m"] = _margin(row.get(f"{name}_moe"))
    return {k: v for k, v in out.items() if v is not None}


def build_watch(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    derived = dw.output_path(ctx)
    if not derived.is_file():
        with GeoJSONWriter(out):
            pass
        return BuildResult(0, ["The displacement watch has not been measured (pk derive)"])
    rows = [r for r in pq.read_table(derived).to_pylist() if r["watch"]]
    table = pq.read_table(paths["census_tracts_2020"], columns=["geoid", "geometry"])
    shapes = dict(
        zip(table.column("geoid").to_pylist(), table.column("geometry").to_pylist(), strict=True)
    )
    context = tc.load_context(tc.output_path(ctx))
    notes = []
    if not context:
        notes.append("The watch areas have no neighborhood context yet (pk derive)")
    with GeoJSONWriter(out) as writer:
        for row in sorted(rows, key=lambda r: r["tract"]):
            shape = shapes.get(row["tract"])
            if shape is None:
                continue
            properties = watch_properties(row) | context_properties(context.get(row["tract"]))
            writer.write(properties, geometry_json(shape, 6))
    return BuildResult(writer.count, notes)


def parcel_watch(derived: Path) -> dict[str, tuple[str, int]]:
    """Each parcel on the map inside a watch area: its tract and the area's signs, from the
    derived folder (`derived/displacement.parquet`, `derived/lens_factors.parquet`). The parcel's
    tract is the one the violence lens found for it (placekeepers.derive.lenses)."""
    watch = dw.load_watch(derived / "displacement.parquet")
    path = derived / "lens_factors.parquet"
    if not watch or not path.is_file():
        return {}
    table = pq.read_table(path, columns=["opa", "tract"])
    return {
        opa: (tract, watch[tract])
        for opa, tract in zip(
            table.column("opa").to_pylist(), table.column("tract").to_pylist(), strict=True
        )
        if tract in watch
    }


def point_watch(
    ctx: Context, tracts_path: Path | None, lngs: list[float], lats: list[float]
) -> list[int | None]:
    """The watch signs at each point (a stop), or None outside every watch area."""
    watch = dw.load_watch(dw.output_path(ctx))
    if not watch or tracts_path is None or not lngs:
        return [None] * len(lngs)
    geoids, shapes = load_tracts(tracts_path)
    found = tracts_of(shapely.points(np.array(lngs), np.array(lats)), geoids, shapes)
    return [watch.get(t) if t else None for t in found]


def manifest_block(ctx: Context) -> dict[str, Any] | None:
    """The `displacement` block of manifest.json (docs/CONTRACTS.md section 3), or None when the
    watch has not been measured."""
    summary = dw.load_summary(dw.output_path(ctx))
    if summary is None or not dw.output_path(ctx).is_file():
        return None
    city = summary.get("city") or {}
    counts = summary.get("counts") or {}
    context = tc.load_summary(tc.output_path(ctx)) if tc.output_path(ctx).is_file() else None
    around = (context or {}).get("city") or {}
    return {
        "as_of": summary.get("as_of"),
        "periods": summary.get("periods"),
        "assessment_years": summary.get("assessment_years"),
        "survey_years": summary.get("survey_years"),
        "mva": summary.get("mva_edition"),
        "city": {
            "p0": _whole(city.get("median_earlier")),
            "p1": _whole(city.get("median_recent")),
            "pc": _whole(city.get("price_change_pct")),
            "cb": _whole(city.get("company_pct")),
            "ac": _whole(city.get("assessment_change_pct")),
            "rp": _whole(city.get("renter_pct")),
            # The city's neighborhood context (M4.7), from the Census's own row for the city;
            # its rent burden is also the rent burden sign's baseline (owner, 2026-10-09).
            "rb": _whole(
                city.get("rent_burden_pct")
                if city.get("rent_burden_pct") is not None
                else around.get("rent_burden_50_pct")
            ),
            "gr": around.get("median_rent"),
            "hi": around.get("median_income"),
            "vp": _whole(around.get("vacant_pct")),
        },
        "thresholds": summary.get("thresholds"),
        "areas": {"tracts": counts.get("tracts"), "watch": counts.get("watch")},
        "context": None
        if context is None
        else {
            "survey_years": context.get("survey_years"),
            "min_renters": tc.MIN_RENTERS,
            "min_homes": tc.MIN_HOMES,
        },
    }


DISPLACEMENT_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        WATCH_FILE,
        "watch",
        ("census_tracts_2020",),
        build_watch,
        # The watch's sources, and the Census tables of its neighborhood context (M4.7).
        extras=(*WATCH_SOURCES, *tc.SOURCES),
    ),
)
