"""Publish: turn the current snapshots into the files the map reads (docs/CONTRACTS.md section 2).

Everything is built in a hidden staging folder beside the data root and moved into place at the
end, so the map never reads a half built set. A stale source still publishes its last good copy:
the map never goes dark, and manifest.json says how old each source is.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import time
import uuid
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path, PurePosixPath
from typing import Any

from placekeepers.cache import atomic_write_json
from placekeepers.context import Context
from placekeepers.publish.dossiers import DossierResult, build_dossiers
from placekeepers.publish.layers import builder_for
from placekeepers.publish.manifest import MANIFEST, build_manifest, git_short_hash
from placekeepers.publish.route_sheets import RouteSheetsResult, build_route_sheets
from placekeepers.publish.stop_table import StopTableResult, build_stop_table
from placekeepers.publish.tiles import (
    TILES_SKIPPED_NOTE,
    TileError,
    find_tippecanoe,
    pmtiles_layer_names,
    run_tippecanoe,
)
from placekeepers.runner import all_statuses
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

#: The base map's folder under the data root. The site makes it (web/scripts/make-basemap.sh) and
#: the weekly refresh adds it beside these files, so publish leaves its registry layer alone
#: (docs/CONTRACTS.md section 2).
BASEMAP_DIR = "basemap/"


class PublishError(RuntimeError):
    pass


@dataclass
class PublishResult:
    out_dir: Path
    manifest: dict[str, Any]
    features: dict[str, int] = field(default_factory=dict)
    tiles_built: list[str] = field(default_factory=list)
    seconds: float = 0.0
    #: the lot dossier shards and the owners table (publish/dossiers.py)
    dossiers: DossierResult | None = None
    #: the route survey sheets (publish/route_sheets.py)
    route_sheets: RouteSheetsResult | None = None
    #: what OpenStreetMap says at each stop, keyed by its id, for the browser to join to SEPTA's
    #: stops (publish/stop_table.py, decision D1)
    stop_table: StopTableResult | None = None


def geojson_name(file: str, source_layer: str) -> str:
    """Where a layer's GeoJSON goes: beside its tile file, e.g. tiles/lots.parcels.geojson."""
    path = PurePosixPath(file)
    return str(path.with_name(f"{path.stem}.{source_layer}.geojson"))


def _check_out_dir(out_dir: Path) -> None:
    if out_dir.exists() and not out_dir.is_dir():
        raise PublishError(f"{out_dir} exists and is not a folder")
    if out_dir.is_dir() and any(out_dir.iterdir()) and not (out_dir / MANIFEST).is_file():
        raise PublishError(
            f"Refusing to replace {out_dir}: it is not empty and has no {MANIFEST} from an earlier "
            "publish. Choose an empty folder or a previous data root."
        )


def _swap_into_place(staging: Path, out_dir: Path) -> None:
    old = None
    if out_dir.exists():
        old = out_dir.with_name(f".{out_dir.name}.old-{uuid.uuid4().hex[:8]}")
        os.replace(out_dir, old)
    os.replace(staging, out_dir)
    if old is not None:
        shutil.rmtree(old, ignore_errors=True)


def vacancy_notes(ctx: Context) -> list[str]:
    """The vacancy model's counts and remarks, from its summary beside derived/vacancy.parquet."""
    path = ctx.cache.root / "derived" / "vacancy.json"
    if not path.is_file():
        return []
    summary = json.loads(path.read_text(encoding="utf-8"))
    lots, buildings = summary["counts"]["lot"], summary["counts"]["building"]
    line = (
        f"Vacancy model as of {summary['as_of']}: lots {lots['high']:,} very likely vacant, "
        f"{lots['medium']:,} probably, {lots['low']:,} not sure; buildings {buildings['high']:,} "
        f"very likely vacant, {buildings['medium']:,} probably, {buildings['low']:,} not sure; "
        f"{summary['counts']['excluded']:,} parks, gardens, parking and similar left out"
    )
    return [line, *summary.get("notes", [])]


def vacancy_counts(ctx: Context) -> dict[str, Any] | None:
    """The `vacancy` block of manifest.json (docs/CONTRACTS.md section 3): the vacancy model's
    counts by kind and confidence, from its summary, or None when the model has not run."""
    path = ctx.cache.root / "derived" / "vacancy.json"
    if not path.is_file():
        return None
    summary = json.loads(path.read_text(encoding="utf-8"))
    counts = summary["counts"]
    levels = ("high", "medium", "low")
    return {
        "as_of": summary["as_of"],
        "lots": {level: int(counts["lot"][level]) for level in levels},
        "buildings": {level: int(counts["building"][level]) for level in levels},
        "left_out": int(counts["excluded"]),
    }


def lens_notes(ctx: Context) -> list[str]:
    """What the lenses could not score, from the summaries beside derived/lens_factors (the
    violence lens), derived/heat_factors (the heat and shade lens, M3.1),
    derived/walk_factors (the walking measures, M3.3) and derived/placemaking_factors (the
    placemaking lens, M3.4)."""
    notes: list[str] = []
    model = (ctx.cache.root / "derived" / "vacancy.parquet").is_file()
    for name, missing in (
        (
            "lens_factors.json",
            "The lens factors have not been computed, so the lots have no scores yet",
        ),
        (
            "heat_factors.json",
            "The heat lens factors have not been computed, so the lots have no heat scores yet",
        ),
        (
            "walk_factors.json",
            "The walking measures have not been computed, so the lots have no walking factors yet",
        ),
        (
            "placemaking_factors.json",
            "The placemaking lens factors have not been computed, so the lots have no placemaking "
            "scores yet",
        ),
    ):
        path = ctx.cache.root / "derived" / name
        if not path.is_file():
            if model:
                notes.append(missing)
            continue
        summary = json.loads(path.read_text(encoding="utf-8"))
        notes.extend(summary.get("notes", []))
    return notes


def displacement_notes(ctx: Context) -> list[str]:
    """What the displacement watch found and could not measure (M4.1), from its summary beside
    derived/displacement.parquet."""
    from placekeepers.derive.displacement import load_summary, output_path

    summary = load_summary(output_path(ctx))
    return list(summary.get("notes", [])) if summary else []


def displacement_block(ctx: Context) -> dict[str, Any] | None:
    """The `displacement` block of manifest.json (M4.1, docs/CONTRACTS.md section 3)."""
    # Imported here: placekeepers.publish.displacement is loaded with the map layers.
    from placekeepers.publish.displacement import manifest_block

    return manifest_block(ctx)


def publish(ctx: Context, out_dir: Path, *, as_of: date | None = None) -> PublishResult:
    started = time.monotonic()
    registry = ctx.registry
    as_of = as_of or ctx.today()
    generated_at = ctx.now()
    statuses = {status.id: status for status in all_statuses(ctx)}
    out_dir = out_dir.expanduser().resolve()
    _check_out_dir(out_dir)
    out_dir.parent.mkdir(parents=True, exist_ok=True)
    staging = out_dir.with_name(f".{out_dir.name}.staging-{uuid.uuid4().hex[:8]}")
    staging.mkdir()
    result = PublishResult(out_dir=out_dir, manifest={})
    try:
        notes: list[str] = []
        layers_by_file: dict[str, list[tuple[str, Path]]] = {}
        attributions: dict[str, list[str]] = {}
        seen: set[tuple[str, str]] = set()
        for layer in registry.layers.values():
            if layer.file.startswith(BASEMAP_DIR):
                # The base map is made by the site (web/scripts/make-basemap.sh), never here.
                continue
            key = (layer.file, layer.source_layer)
            if key in seen:
                continue
            seen.add(key)
            builder = builder_for(*key)
            if builder is None:
                notes.append(f"{layer.id} is not built yet")
                log.warning("publish: no builder yet for layer %s", layer.id)
                continue
            paths = {}
            for source_id in (*builder.sources, *builder.extras, *builder.links):
                status = statuses.get(source_id)
                if status is not None and status.snapshot is not None:
                    paths[source_id] = SnapshotStore(ctx.cache, source_id).path_for(status.snapshot)
            if not any(source_id in paths for source_id in builder.sources):
                notes.append(f"{layer.id} has no usable data yet")
                log.warning(
                    "publish: %s has no usable snapshot in %s", layer.id, ", ".join(builder.sources)
                )
                continue
            target = staging / geojson_name(layer.file, layer.source_layer)
            built = builder.build(ctx, paths, target, as_of)
            notes.extend(built.notes)
            if built.features == 0:
                # An empty layer would make tippecanoe leave it out and fail the whole tile file.
                target.unlink(missing_ok=True)
                notes.append(f"{layer.id} has nothing to show yet")
                log.warning("publish: %s has no features", layer.id)
                continue
            result.features[f"{layer.file} {layer.source_layer}"] = built.features
            log.info(
                "publish: %s layer %s has %s features",
                layer.file,
                layer.source_layer,
                f"{built.features:,}",
            )
            layers_by_file.setdefault(layer.file, []).append((layer.source_layer, target))
            # Sources read only to link by id store nothing here, so they are not credited here.
            attributions.setdefault(layer.file, []).extend(
                registry.sources[source_id].attribution
                for source_id in paths
                if source_id not in builder.links
            )

        notes.extend(vacancy_notes(ctx))
        notes.extend(lens_notes(ctx))
        notes.extend(displacement_notes(ctx))
        result.dossiers = build_dossiers(ctx, statuses, staging, as_of)
        notes.extend(result.dossiers.notes)
        result.route_sheets = build_route_sheets(ctx, statuses, staging, as_of)
        notes.extend(result.route_sheets.notes)
        result.stop_table = build_stop_table(ctx, statuses, staging)
        notes.extend(result.stop_table.notes)

        exe = find_tippecanoe()
        if exe is None:
            notes.append(TILES_SKIPPED_NOTE)
            log.warning(
                "publish: tippecanoe is not installed, so no map tiles were built. The layers were "
                "written as GeoJSON beside where each tile file would go. Install it with "
                "'sudo apt install tippecanoe', or let the GitHub workflow build tiles."
            )
        else:
            for file, layers in layers_by_file.items():
                target = staging / file
                target.parent.mkdir(parents=True, exist_ok=True)
                attribution = "; ".join(dict.fromkeys(attributions[file]))
                try:
                    run_tippecanoe(exe, target, file, layers, attribution)
                    missing = {name for name, _ in layers} - set(pmtiles_layer_names(target))
                    if missing:
                        raise TileError(f"{file} is missing layers {sorted(missing)}")
                except TileError as exc:
                    target.unlink(missing_ok=True)
                    notes.append(f"tiles failed for {file}, GeoJSON kept: {exc}")
                    log.error("publish: %s", exc)
                    continue
                for _, path in layers:
                    path.unlink()
                result.tiles_built.append(file)
                log.info("publish: built %s (%.1f MB)", file, target.stat().st_size / 1e6)

        result.manifest = build_manifest(
            registry=registry,
            statuses=statuses,
            data_root=staging,
            generated_at=generated_at,
            commit=git_short_hash(ctx.settings.repo_root),
            notes=notes,
            dossiers=result.dossiers.manifest_block() if result.dossiers else None,
            vacancy=vacancy_counts(ctx),
            displacement=displacement_block(ctx),
        )
        atomic_write_json(staging / MANIFEST, result.manifest)
        _swap_into_place(staging, out_dir)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    result.seconds = time.monotonic() - started
    return result
