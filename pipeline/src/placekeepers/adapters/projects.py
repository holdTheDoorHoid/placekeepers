"""Projects neighbors finished (M5.3, issue #47): the approved reports on GitHub and the curated
hand entries and corrections. The checks and the map layer are in placekeepers.projects.

`project_reports` (endpoint kind `github_issues`) reads every issue of the repository that carries
the approval label, with GitHub's GraphQL API and the token in GITHUB_TOKEN (or GH_TOKEN): in the
weekly refresh, the workflow's own read only token (`issues: read`). Each issue is reduced to its
form answers before anything is written, so not even the download cache holds a GitHub user name,
an issue title, a photo or the answer about permission (placekeepers.projects.reduce_issue).

`project_corrections` (endpoint kind `curated`) checks data/curated/interventions.yaml entry by
entry, so the Data status page shows the file like any other source. The map is always built from
the repository's current file at publish time, so a suppression takes effect at the next publish.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.base import Adapter, FetchError
from placekeepers.adapters.curated import CuratedAdapter
from placekeepers.cache import RawFetch
from placekeepers.projects import (
    GITHUB_GRAPHQL,
    CuratedProjectsError,
    ReportsError,
    fetch_reports,
    read_curated,
)
from placekeepers.registry import GithubIssuesEndpoint

#: Where the token comes from, in order.
TOKEN_VARIABLES = ("GITHUB_TOKEN", "GH_TOKEN")

#: The snapshot's columns and their types.
REPORT_SCHEMA = pa.schema(
    [
        ("issue", pa.int64()),
        ("url", pa.string()),
        ("state", pa.string()),
        ("state_reason", pa.string()),
        ("created_at", pa.string()),
        ("approved", pa.bool_()),
        ("approved_at", pa.string()),
        ("edited_after_approval", pa.bool_()),
        ("form", pa.bool_()),
        ("kind", pa.string()),
        ("where", pa.string()),
        ("month", pa.string()),
        ("year", pa.string()),
        ("group", pa.string()),
        ("note", pa.string()),
        ("left_out", pa.string()),
        ("consent", pa.bool_()),
    ]
)


def github_token() -> str | None:
    for name in TOKEN_VARIABLES:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def reports_table(records: list[dict[str, Any]]) -> pa.Table:
    return pa.Table.from_pylist(
        [{name: record.get(name) for name in REPORT_SCHEMA.names} for record in records],
        schema=REPORT_SCHEMA,
    )


class ProjectReports(Adapter):
    """Issues with the approval label, reduced to their form answers."""

    kind = "github_issues"
    required_columns = ("issue", "approved", "consent")

    @property
    def endpoint(self) -> GithubIssuesEndpoint:
        assert isinstance(self.source.endpoint, GithubIssuesEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        token = github_token()
        if token is None:
            raise FetchError(
                "No GitHub token: set GITHUB_TOKEN (the weekly refresh passes the workflow's own "
                "read only token)"
            )
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}

        def post(payload: dict[str, Any]) -> Any:
            return self.ctx.http.post_json(GITHUB_GRAPHQL, payload, headers=headers)

        try:
            records = fetch_reports(post, self.endpoint.repo, self.endpoint.label)
        except ReportsError as exc:
            raise FetchError(str(exc)) from exc
        (dest / "issues.json").write_text(
            json.dumps(records, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        return {"file": "issues.json", "rows": len(records)}

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        records = json.loads((raw.dir / raw.info["file"]).read_text(encoding="utf-8"))
        if not isinstance(records, list):
            raise FetchError("The saved reports are not a list")
        pq.write_table(reports_table(records), out, compression="zstd")


class ProjectCorrections(CuratedAdapter):
    """data/curated/interventions.yaml, checked entry by entry."""

    required_columns = ("issue", "id", "suppressed")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        try:
            curated = read_curated(raw.dir / raw.info["file"])
        except CuratedProjectsError as exc:
            raise FetchError(str(exc)) from exc
        self.notes.extend(curated.problems)
        entries = [*curated.corrections.values(), *curated.entries]
        table = pa.table(
            {
                "issue": pa.array([e.issue for e in entries], pa.int64()),
                "id": pa.array([e.id for e in entries], pa.string()),
                "suppressed": pa.array([e.suppressed for e in entries], pa.bool_()),
                "kind": pa.array([e.kind for e in entries], pa.string()),
                "parcel": pa.array([e.parcel for e in entries], pa.string()),
                "finished": pa.array([e.finished for e in entries], pa.string()),
            }
        )
        pq.write_table(table, out, compression="zstd")
