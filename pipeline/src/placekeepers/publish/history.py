"""History shards (`dossiers/history/<prefix>.json`, docs/CONTRACTS.md section 6): what the lot
timeline needs beyond the dossier shard, fetched only when a lot page's History part opens, so
opening a lot stays fast on a phone (issue #38).

For every parcel with a dossier, its file holds:

* `li`: its L&I records by kind (violations, permits, demolitions, unsafe and imminently
  dangerous notices, clean and seal), grouped and ordered as placekeepers.derive.timeline does it
  and as the web app does it with live data, from `li_history`, which is downloaded for the
  candidate parcels only. A dossier parcel outside them says so in `partial` (["li"]);
* `lists`: the vacancy lists it is on, each with its day: the City's vacant land and vacant
  buildings lists, and Clean & Green Philly's copies of June 2024.

Every dossier prefix gets a file, even when none of its parcels has a record, so the lot page can
tell "no records" from "not published". Deeds stay in the dossier shard (`transfers`) and the
LandCare year in its `landcare`: the page puts them in the timeline itself.

Nothing that could identify a case or a person is read: no case, permit or violation numbers, no
inspectors, applicants or contractors (adapters/li.py, HISTORY_PARTS).
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pyarrow.parquet as pq

from placekeepers.derive.timeline import LISTS, li_groups, list_records
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

SCHEMA = 1
HISTORY_DIR = "dossiers/history"
#: the source of the L&I timeline records
LI_SOURCE = "li_history"
#: rows read from DuckDB at a time
BATCH = 50_000


@dataclass
class HistoryResult:
    files: int = 0
    bytes: int = 0
    largest: int = 0
    #: parcels with at least one record, events written, and parcels whose L&I records were not
    #: downloaded (outside the candidates)
    parcels: int = 0
    events: int = 0
    partial: int = 0
    #: whether this build holds the L&I records at all
    li: bool = False

    def manifest_block(self) -> dict[str, Any] | None:
        """`dossiers.history` in the manifest (docs/CONTRACTS.md section 3), or None when no
        history shards were written."""
        if not self.files:
            return None
        return {"files": self.files, "bytes": self.bytes, "parts": ["li"] if self.li else []}


def account_sql(column: str) -> str:
    """SQL for a column's OPA account as 9 digits (the first run of 8 or 9 digits, padded)."""
    digits = f"regexp_extract(CAST({column} AS VARCHAR), '[0-9]{{8,9}}')"
    return f"CASE WHEN {digits} <> '' THEN lpad({digits}, 9, '0') END"


def read_lists(con: Any, paths: dict[str, Path]) -> dict[str, list[list[str]]]:
    """Each dossier parcel's vacancy list records (the accounts are in the table `acc`)."""
    found: dict[str, list[tuple[str, Any]]] = defaultdict(list)
    for list_id, source_id in LISTS.items():
        path = paths.get(source_id)
        if path is None:
            continue
        column = "list_date" if source_id.startswith("cagp_") else "date_update"
        names = set(pq.read_schema(path).names)
        if "opa_id" not in names or column not in names:
            log.warning("history: %s has no %s column, so its list is left out", source_id, column)
            continue
        account = account_sql("opa_id")
        rows = con.execute(
            f"""SELECT {account} AS a, max(CAST({column} AS DATE))
                FROM read_parquet({quote_literal(str(path))})
                WHERE {account} IN (SELECT a FROM acc) GROUP BY 1"""
        ).fetchall()
        for a, day in rows:
            found[a].append((list_id, day))
    return {a: list_records(items) for a, items in found.items()}


def stream_li(con: Any, path: Path):
    """The L&I records of the dossier parcels, one parcel at a time: (account, rows)."""
    account = account_sql("opa_account_num")
    cursor = con.execute(
        f"""SELECT {account} AS a, kind, date, title, status, detail
            FROM read_parquet({quote_literal(str(path))})
            WHERE {account} IN (SELECT a FROM acc)
            ORDER BY a"""
    )
    current: str | None = None
    rows: list[tuple] = []
    while True:
        batch = cursor.fetchmany(BATCH)
        if not batch:
            break
        for a, *record in batch:
            if a != current:
                if current is not None:
                    yield current, rows
                current, rows = a, []
            rows.append(tuple(record))
    if current is not None:
        yield current, rows


def build_history(
    con: Any,
    paths: dict[str, Path],
    accounts: list[str],
    downloaded_for: set[str],
    out_root: Path,
    generated_at: str,
    shard_digits: int,
) -> HistoryResult:
    """Write a history shard for every prefix of the dossier parcels (`accounts`, also in the
    table `acc` of `con`). `downloaded_for` are the candidate parcels, whose L&I records
    `li_history` holds."""
    result = HistoryResult(li=LI_SOURCE in paths)
    lists = read_lists(con, paths)
    by_prefix: dict[str, dict[str, Any]] = {a[:shard_digits]: {} for a in accounts}
    if result.li:
        for a, rows in stream_li(con, paths[LI_SOURCE]):
            if a not in downloaded_for:
                continue
            groups = li_groups(rows)
            if groups:
                by_prefix.setdefault(a[:shard_digits], {})[a] = {"li": groups}
                result.events += sum(len(events) for events in groups.values())
    for a, records in lists.items():
        entry = by_prefix.setdefault(a[:shard_digits], {}).setdefault(a, {})
        entry["lists"] = records
        result.events += len(records)
    for a in accounts:
        if result.li and a in downloaded_for:
            continue
        # Its L&I records were not downloaded: the page must never say it has none.
        by_prefix[a[:shard_digits]].setdefault(a, {})["partial"] = ["li"]
        result.partial += 1

    folder = out_root / HISTORY_DIR
    folder.mkdir(parents=True, exist_ok=True)
    for prefix in sorted(by_prefix):
        parcels = by_prefix[prefix]
        body = {
            "schema": SCHEMA,
            "generated_at": generated_at,
            "parts": ["li"] if result.li else [],
            "parcels": {a: ordered(parcels[a]) for a in sorted(parcels)},
        }
        target = folder / f"{prefix}.json"
        target.write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")), "utf-8")
        size = target.stat().st_size
        result.files += 1
        result.bytes += size
        result.largest = max(result.largest, size)
        result.parcels += sum(1 for entry in parcels.values() if "li" in entry or "lists" in entry)
    log.info(
        "history: %s parcels with %s timeline records in %s files (%.1f MB)",
        f"{result.parcels:,}",
        f"{result.events:,}",
        result.files,
        result.bytes / 1e6,
    )
    return result


def ordered(entry: dict[str, Any]) -> dict[str, Any]:
    """A parcel's history entry with its keys in the contract's order."""
    return {key: entry[key] for key in ("li", "lists", "partial") if key in entry}
