"""The map layer and the table of projects neighbors finished (M5.3, issue #47).

Two ways to publish them:

* **The weekly publish** (`pk publish`, `pk all`): the layer `projects` (tiles/projects.pmtiles,
  layer `projects`) is built like any other layer from the `project_reports` snapshot, the curated
  file as the repository holds it now, the City's property list (`opa_properties`) and the city
  limits (`census_tracts_2020`); `build_projects_files` writes tables/projects.json beside it and
  leaves the project inputs (the property list cut to parcel numbers, addresses and points, and
  the city limits) in the cache, `<cache>/derived/project_inputs/`, for the workflow to hand on.
* **A quick publish** (`pk projects`, run by .github/workflows/projects.yml soon after a label
  changes): the reports are read from GitHub again and placed with those inputs, and only the
  layer file, the table and their lines in manifest.json are replaced in an existing data root,
  with everything else left exactly as the weekly publish wrote it (`refresh_projects`).

Both use placekeepers.projects.build_projects, so a report gets the same answer either way.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq
from shapely.geometry.base import BaseGeometry

from placekeepers.cache import atomic_write_json, sha256_file
from placekeepers.config import iso_z
from placekeepers.context import Context
from placekeepers.health import SourceStatus
from placekeepers.projects import (
    CORRECTIONS_SOURCE,
    CURATED_FILE,
    LAYER_FILE,
    LAYER_ID,
    NOTE_PREFIX,
    REPORTS_SOURCE,
    SOURCE_LAYER,
    TABLE_FILE,
    ParcelIndex,
    ProjectsBuild,
    build_projects,
    read_curated,
    write_geojson,
    write_inputs,
    write_table,
)
from placekeepers.publish.layers import BuildResult, LayerBuilder
from placekeepers.registry import GithubIssuesEndpoint, Registry
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

#: Where the weekly publish leaves the project inputs, under the cache root.
INPUTS_DIR = "derived/project_inputs"
#: The GeoJSON the layer is written as before tippecanoe (and kept when tiles are skipped).
LAYER_GEOJSON = "tiles/projects.projects.geojson"


def repo_of(registry: Registry) -> str | None:
    source = registry.sources.get(REPORTS_SOURCE)
    if source is not None and isinstance(source.endpoint, GithubIssuesEndpoint):
        return source.endpoint.repo
    return None


def _limits(ctx: Context) -> BaseGeometry | None:
    from placekeepers.adapters.base import FetchError
    from placekeepers.adapters.osm import city_limits

    try:
        return city_limits(ctx.cache)
    except FetchError:
        return None


def current_build(ctx: Context, paths: dict[str, Path], as_of: date) -> ProjectsBuild:
    """The projects from the current snapshots and the repository's curated file."""
    reports = pq.read_table(paths[REPORTS_SOURCE]).to_pylist() if REPORTS_SOURCE in paths else []
    curated = read_curated(ctx.settings.repo_root / CURATED_FILE)
    index = ParcelIndex.from_parquet(paths["opa_properties"]) if "opa_properties" in paths else None
    return build_projects(
        reports,
        curated,
        index,
        today=as_of,
        limits=_limits(ctx),
        repo=repo_of(ctx.registry),
    )


def build_projects_layer(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    try:
        build = current_build(ctx, paths, as_of)
    except Exception as exc:  # the projects never stop the rest of the map from publishing
        log.error("projects: the layer could not be built: %s", exc)
        return BuildResult(0, [f"{NOTE_PREFIX}the layer could not be built: {exc}"])
    # The notes come with the table (build_projects_files), once.
    return BuildResult(write_geojson(build, out), [])


PROJECT_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        LAYER_FILE,
        SOURCE_LAYER,
        (REPORTS_SOURCE, CORRECTIONS_SOURCE),
        build_projects_layer,
        extras=("opa_properties",),
    ),
)


@dataclass
class ProjectsResult:
    shown: int = 0
    held: int = 0
    notes: list[str] = field(default_factory=list)


def _paths(
    ctx: Context, statuses: dict[str, SourceStatus], ids: tuple[str, ...]
) -> dict[str, Path]:
    paths = {}
    for source_id in ids:
        status = statuses.get(source_id)
        if status is not None and status.snapshot is not None:
            paths[source_id] = SnapshotStore(ctx.cache, source_id).path_for(status.snapshot)
    return paths


def build_projects_files(
    ctx: Context, statuses: dict[str, SourceStatus], out_dir: Path, as_of: date
) -> ProjectsResult:
    """tables/projects.json and its notes, and the project inputs in the cache. The table is
    written only when the reports were read at least once: without them the lot page must not say
    that no project was reported."""
    result = ProjectsResult()
    if REPORTS_SOURCE not in ctx.registry.sources:
        return result
    paths = _paths(ctx, statuses, (REPORTS_SOURCE, CORRECTIONS_SOURCE, "opa_properties"))
    if "opa_properties" in paths:
        try:
            write_inputs(ctx.cache.root / INPUTS_DIR, paths["opa_properties"], _limits(ctx))
        except Exception as exc:  # a quick publish then waits for a good weekly build
            log.warning("projects: the project inputs could not be written: %s", exc)
    if REPORTS_SOURCE not in paths:
        result.notes.append(
            f"{NOTE_PREFIX}the reports on GitHub could not be read yet, so there is no table"
        )
        return result
    try:
        build = current_build(ctx, paths, as_of)
    except Exception as exc:  # the projects never stop the rest of the map from publishing
        log.error("projects: the table could not be built: %s", exc)
        result.notes.append(f"{NOTE_PREFIX}the table could not be built: {exc}")
        return result
    write_table(build, out_dir / TABLE_FILE, generated_at=ctx.now(), as_of=as_of)
    result.shown = len(build.projects)
    result.held = len(build.held)
    result.notes.extend(build.notes)
    return result


# ---------------------------------------------------------------------------------------------
# A quick publish into an existing data root


class QuickPublishError(RuntimeError):
    pass


#: Notes of the weekly publish about this layer, replaced by a quick publish.
LAYER_NOTES = tuple(
    f"{LAYER_ID} {words}"
    for words in ("has nothing to show yet", "has no usable data yet", "is not built yet")
)


def _file_entry(path: Path) -> dict[str, Any]:
    return {"bytes": path.stat().st_size, "sha256": sha256_file(path)}


def refresh_projects(
    data_root: Path,
    reports: list[dict[str, Any]],
    *,
    registry: Registry,
    repo_root: Path,
    index: ParcelIndex | None,
    limits: BaseGeometry | None,
    now: datetime,
    today: date,
    attribution: str,
) -> ProjectsBuild:
    """Replace the projects layer, tables/projects.json and their lines in manifest.json inside a
    data root the weekly publish wrote, leaving every other file as it is. The source's status in
    the manifest says the reports were read now. Raises QuickPublishError when the data root has
    no manifest."""
    import json

    from placekeepers.publish import geojson_name
    from placekeepers.publish.tiles import (
        TileError,
        find_tippecanoe,
        pmtiles_layer_names,
        run_tippecanoe,
    )

    manifest_path = data_root / "manifest.json"
    if not manifest_path.is_file():
        raise QuickPublishError(f"{data_root} has no manifest.json from a weekly publish")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if index is None:
        raise QuickPublishError(
            "The project inputs from the weekly publish are missing, so no report can be placed"
        )

    curated = read_curated(repo_root / CURATED_FILE)
    build = build_projects(
        reports, curated, index, today=today, limits=limits, repo=repo_of(registry)
    )

    geojson = data_root / geojson_name(LAYER_FILE, SOURCE_LAYER)
    tiles = data_root / LAYER_FILE
    geojson.unlink(missing_ok=True)
    tiles.unlink(missing_ok=True)
    layer_notes: list[str] = []
    if build.projects:
        write_geojson(build, geojson)
        exe = find_tippecanoe()
        if exe is not None:
            try:
                run_tippecanoe(exe, tiles, LAYER_FILE, [(SOURCE_LAYER, geojson)], attribution)
                if SOURCE_LAYER not in pmtiles_layer_names(tiles):
                    raise TileError(f"{LAYER_FILE} is missing its layer")
                geojson.unlink()
            except TileError as exc:
                tiles.unlink(missing_ok=True)
                layer_notes.append(f"tiles failed for {LAYER_FILE}, GeoJSON kept: {exc}")
    else:
        layer_notes.append(f"{LAYER_ID} has nothing to show yet")
    write_table(build, data_root / TABLE_FILE, generated_at=now, as_of=today)

    files = manifest.setdefault("files", {})
    for name in (LAYER_FILE, geojson_name(LAYER_FILE, SOURCE_LAYER), TABLE_FILE):
        path = data_root / name
        if path.is_file():
            files[name] = _file_entry(path)
        else:
            files.pop(name, None)
    manifest["files"] = dict(sorted(files.items()))

    moment = iso_z(now)
    status = manifest.setdefault("sources", {}).get(REPORTS_SOURCE) or {}
    status.update(
        {
            "status": "ok",
            "last_attempt": moment,
            "last_success": moment,
            "stale_since": None,
            "rows": len(reports),
            "message": None,
        }
    )
    status.setdefault("newest_record", None)
    manifest["sources"][REPORTS_SOURCE] = status

    kept = [
        note
        for note in manifest.get("notes", [])
        if not note.startswith(NOTE_PREFIX)
        and note not in LAYER_NOTES
        and not note.startswith(f"tiles failed for {LAYER_FILE}")
    ]
    manifest["notes"] = [*kept, *layer_notes, *build.notes]
    atomic_write_json(manifest_path, manifest)
    return build


def summary_markdown(build: ProjectsBuild) -> str:
    """What became of every approved report, for the owner: the workflow run's summary page."""
    lines = [
        "## Projects neighbors finished",
        "",
        f"{len(build.projects)} on the map.",
        "",
    ]
    if build.outcomes:
        lines += ["| Report | On the map? |", "|---|---|"]
        for outcome in build.outcomes:
            answer = "Yes" if outcome.shown else f"No: {outcome.reason}"
            lines.append(f"| {outcome.ref} | {answer} |")
    else:
        lines.append("No report carries the approval label yet.")
    return "\n".join(lines) + "\n"
