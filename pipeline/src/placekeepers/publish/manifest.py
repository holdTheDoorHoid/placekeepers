"""manifest.json, as described in docs/CONTRACTS.md section 3."""

from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from placekeepers.cache import sha256_file
from placekeepers.config import iso_z
from placekeepers.health import SourceStatus
from placekeepers.registry import Registry

MANIFEST = "manifest.json"
SCHEMA = 1


def git_short_hash(repo_root: Path) -> str:
    env = os.environ.get("GITHUB_SHA")
    if env:
        return env[:7]
    try:
        completed = subprocess.run(
            ["git", "-C", str(repo_root), "rev-parse", "--short=7", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )
        return completed.stdout.strip() or "nogit"
    except (OSError, subprocess.SubprocessError):
        return "nogit"


def build_id(generated_at: datetime, commit: str) -> str:
    """Such as 2026-10-05T10-00-00Z-1a2b3c4: the build time, then the code version."""
    return f"{iso_z(generated_at).replace(':', '-')}-{commit}"


#: Dossier shards (dossiers/<digits>.json) are summarized in the manifest's `dossiers` block
#: rather than listed one by one, so the manifest every visitor fetches stays small.
DOSSIER_SHARD = re.compile(r"^dossiers/\d+\.json$")
#: the route survey sheets, which tables/routes/index.json lists (publish/route_sheets.py)
ROUTE_SHEET = re.compile(r"^tables/routes/(?!index\.json$)[^/]+\.json$")


def file_index(data_root: Path) -> dict[str, dict[str, Any]]:
    """Every file under the data root except manifest.json, the dossier shards and the route
    survey sheets."""
    files = {}
    for path in sorted(data_root.rglob("*")):
        name = path.relative_to(data_root).as_posix()
        skip = name == MANIFEST or DOSSIER_SHARD.match(name) or ROUTE_SHEET.match(name)
        if path.is_file() and not skip:
            files[name] = {"bytes": path.stat().st_size, "sha256": sha256_file(path)}
    return files


def build_manifest(
    *,
    registry: Registry,
    statuses: dict[str, SourceStatus],
    data_root: Path,
    generated_at: datetime,
    commit: str,
    notes: list[str],
    dossiers: dict[str, Any] | None = None,
    vacancy: dict[str, Any] | None = None,
    displacement: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "build_id": build_id(generated_at, commit),
        "generated_at": iso_z(generated_at),
        "sources": {source_id: statuses[source_id].to_manifest() for source_id in registry.sources},
        "layers": {
            layer.id: {
                "file": layer.file,
                "source_layer": layer.source_layer,
                "sources": list(layer.sources),
            }
            for layer in registry.layers.values()
        },
        "files": file_index(data_root),
        "dossiers": dossiers,
        "vacancy": vacancy,
        "displacement": displacement,
        "notes": notes,
    }
