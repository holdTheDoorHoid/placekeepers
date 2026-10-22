"""`tables/didit.json` (docs/CONTRACTS.md section 12): the numbers of the page "Did it work?" (M5.4,
issue #48).

The study itself runs only when someone runs `pk didit` (yearly or on demand), which writes
`data/didit/results.json` in the repository, where every change is reviewed before it is merged.
The weekly publish copies that file as it is, and adds one thing the study cannot know: how many
projects neighbors finished the map shows this week, and how many were finished long enough ago
to be compared (`projects_now`), read from the `tables/projects.json` this same publish wrote.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from placekeepers.cache import atomic_write_json
from placekeepers.context import Context
from placekeepers.didit.method import POST
from placekeepers.didit.study import RESULTS_FILE, half_end
from placekeepers.projects import TABLE_FILE as PROJECTS_TABLE

log = logging.getLogger(__name__)

DIDIT_TABLE = "tables/didit.json"
NOTE_PREFIX = "Did it work?: "


@dataclass
class DiditResult:
    written: bool = False
    notes: list[str] = field(default_factory=list)


def ready_before(results: dict[str, Any]) -> str:
    """The last month a project can have been finished and still be compared: two full years of
    data must follow the half year it was finished in."""
    through = date.fromisoformat(results["data_through"])
    last_half = (through.year - 2015) * 2 + (through.month > 6)
    end = half_end(last_half - POST)
    return f"{end.year:04d}-{end.month:02d}"


def projects_now(results: dict[str, Any], table: Path, as_of: date) -> dict[str, Any] | None:
    """How many projects the map shows, and how many could be compared, from tables/projects.json;
    None when the table was not written this week (the reports were never read)."""
    if not table.is_file():
        return None
    rows = json.loads(table.read_text(encoding="utf-8")).get("projects", [])
    limit = ready_before(results)
    ready = sum(1 for r in rows if r.get("finished") and r["finished"] <= limit)
    return {"as_of": as_of.isoformat(), "shown": len(rows), "ready": ready, "ready_before": limit}


def build_didit(ctx: Context, out_dir: Path, as_of: date) -> DiditResult:
    result = DiditResult()
    source = ctx.settings.repo_root / RESULTS_FILE
    if not source.is_file():
        result.notes.append(f"{NOTE_PREFIX}no results yet; run pk didit to make them")
        return result
    try:
        results = json.loads(source.read_text(encoding="utf-8"))
        if results.get("schema") != 1 or not isinstance(results.get("kinds"), list):
            raise ValueError("it is not schema 1")
    except (ValueError, KeyError) as exc:
        log.error("didit: %s could not be read: %s", source, exc)
        result.notes.append(f"{NOTE_PREFIX}the results could not be read ({exc}), so not published")
        return result
    results["projects_now"] = projects_now(results, out_dir / PROJECTS_TABLE, as_of)
    atomic_write_json(out_dir / DIDIT_TABLE, results)
    result.written = True
    log.info("publish: wrote %s (the study of %s)", DIDIT_TABLE, results.get("generated"))
    return result
