#!/usr/bin/env python3
"""Helpers for the weekly refresh workflow (.github/workflows/refresh.yml).

Standard library only, so any job can run it with a plain Python 3.12. Commands:

    refresh.py pack --cache DIR --out DIR
        One tar per source holding what the next run needs: the source's state (which carries
        the count of failed attempts in a row) and its last good snapshot. These become the
        assets of the rolling `data-snapshots` release.

    refresh.py restore --cache DIR --from DIR
        Unpacks those tars into a fresh cache, so a source that fails this week falls back to
        last week's good copy instead of to nothing.

    refresh.py pick-basemap --assets FILE [--today YYYY-MM-DD] [--max-age-days 30]
        Given the release's asset names (one per line), prints the base map asset that is still
        fresh enough to reuse, or nothing when a new extract is due.

    refresh.py issues --current FILE [--previous FILE] --registry DIR [--run-url URL] [--dry-run]
        Opens, updates and closes one GitHub issue per data source, labeled data-source, using
        the gh command line tool (GH_TOKEN and GH_REPO come from the workflow). A source gets an
        issue when it is stale or failing in this run and was also stale or failing in the
        previous run, so a single bad week does not raise an alarm. The issue closes itself when
        the source is ok again.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tarfile
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

SNAPSHOTS = "snapshots"
STATE_FILE = "state.json"
CURRENT_LINK = "current.parquet"
ASSET_PREFIX = "snapshot-"
BASEMAP_ASSET = re.compile(r"^basemap-(\d{8})\.tar$")
LABEL = "data-source"
MARKER = "placekeepers-data-source"
LOCAL_TZ = ZoneInfo("America/New_York")
FAILED = ("stale", "failing")


# Snapshots ----------------------------------------------------------------------------------


def snapshot_files(source_dir: Path) -> list[Path]:
    """The files of one source worth keeping: its state, and its last good snapshot (the file
    current.parquet points at, that snapshot's JSON sidecar, and the link itself)."""
    files: list[Path] = []
    state = source_dir / STATE_FILE
    if state.is_file():
        files.append(state)
    link = source_dir / CURRENT_LINK
    if link.is_symlink():
        target = source_dir / link.readlink()
        sidecar = target.with_suffix(".json")
        if target.is_file() and target.parent == source_dir and sidecar.is_file():
            files.extend([target, sidecar, link])
    return files


def pack(cache: Path, out: Path) -> list[Path]:
    """Write snapshot-<source>.tar for every source folder in the cache. Returns the tars."""
    out.mkdir(parents=True, exist_ok=True)
    written = []
    root = cache / SNAPSHOTS
    for source_dir in sorted(p for p in root.iterdir() if p.is_dir()) if root.is_dir() else []:
        files = snapshot_files(source_dir)
        if not files:
            continue
        tar_path = out / f"{ASSET_PREFIX}{source_dir.name}.tar"
        with tarfile.open(tar_path, "w") as tar:
            for path in files:
                tar.add(path, arcname=f"{source_dir.name}/{path.name}", recursive=False)
        written.append(tar_path)
    return written


def restore(cache: Path, from_dir: Path) -> list[str]:
    """Unpack every snapshot-<source>.tar into the cache. Returns the source ids restored."""
    root = cache / SNAPSHOTS
    root.mkdir(parents=True, exist_ok=True)
    restored = []
    for tar_path in sorted(from_dir.glob(f"{ASSET_PREFIX}*.tar")):
        source_id = tar_path.name[len(ASSET_PREFIX) : -len(".tar")]
        if not re.fullmatch(r"[a-z][a-z0-9_]*", source_id):
            raise ValueError(f"{tar_path.name} does not name a source")
        with tarfile.open(tar_path) as tar:
            for member in tar.getmembers():
                parts = member.name.split("/")
                if len(parts) != 2 or parts[0] != source_id or parts[1] in ("", ".", ".."):
                    raise ValueError(f"{tar_path.name} holds an unexpected entry: {member.name}")
                if member.issym() and "/" in member.linkname:
                    raise ValueError(f"{tar_path.name} links outside its folder: {member.name}")
            # The "data" filter also refuses absolute paths, devices and links leaving the folder.
            tar.extractall(root, filter="data")
        restored.append(source_id)
    return restored


# Base map -----------------------------------------------------------------------------------


def pick_basemap(names: Iterable[str], today: date, max_age_days: int = 30) -> str | None:
    """The newest base map asset (basemap-YYYYMMDD.tar, named after the Protomaps build date)
    if it is at most max_age_days old; otherwise None, meaning a new extract is due. Builds are
    dated in UTC, so a build may look one day ahead of `today`."""
    found = []
    for name in names:
        match = BASEMAP_ASSET.match(name.strip())
        if not match:
            continue
        try:
            built = datetime.strptime(match.group(1), "%Y%m%d").date()
        except ValueError:
            continue
        found.append((built, name.strip()))
    if not found:
        return None
    built, name = max(found)
    return name if -1 <= (today - built).days <= max_age_days else None


# Plain words --------------------------------------------------------------------------------


def day_in_words(value: date) -> str:
    return f"{value:%B} {value.day}, {value.year}"


def when(value: str | None) -> str | None:
    """A date (2026-09-27) or a UTC time (2026-10-04T14:20:43Z) as Philadelphia sees the day."""
    if not value:
        return None
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            return day_in_words(date.fromisoformat(value))
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=UTC)
        return day_in_words(moment.astimezone(LOCAL_TZ).date())
    except ValueError:
        return None


def records(n: int) -> str:
    return f"{n:,} record" + ("" if n == 1 else "s")


@dataclass(frozen=True)
class SourceInfo:
    id: str
    name: str
    publisher: str
    homepage: str


def load_sources(registry_dir: Path) -> dict[str, SourceInfo]:
    import yaml  # the workflow installs PyYAML for this command only

    entries = yaml.safe_load((registry_dir / "sources.yaml").read_text(encoding="utf-8")) or []
    return {
        entry["id"]: SourceInfo(entry["id"], entry["name"], entry["publisher"], entry["homepage"])
        for entry in entries
    }


def marker(source_id: str) -> str:
    return f"<!-- {MARKER}: {source_id} -->"


def source_of(issue_body: str) -> str | None:
    match = re.search(rf"<!-- {MARKER}: ([a-z][a-z0-9_]*) -->", issue_body or "")
    return match.group(1) if match else None


def issue_title(info: SourceInfo) -> str:
    return f"Data source needs attention: {info.name}"


def meanwhile(entry: dict[str, Any]) -> str:
    if entry.get("status") == "stale":
        since = when(entry.get("stale_since")) or when(entry.get("last_success"))
        copy = f"the last good copy, from {since}" if since else "the last good copy"
        return (
            f"The map keeps showing {copy}, and the Data status page says it is out of date. "
            "Nothing is lost."
        )
    return (
        "There is no usable copy of this source, so map layers that need it may be missing or "
        "incomplete. The Data status page says so."
    )


def issue_body(info: SourceInfo, entry: dict[str, Any], run_url: str | None) -> str:
    status_words = "out of date" if entry.get("status") == "stale" else "not working"
    lines = [
        f"**{info.name}**, published by {info.publisher}, did not refresh correctly in this "
        "week's data refresh or in the one before.",
        "",
        f"**Meanwhile:** {meanwhile(entry)}",
        "",
    ]
    if entry.get("message"):
        lines += [f"**What went wrong in the latest refresh:** {entry['message']}", ""]
    details = [f"Status: {status_words}"]
    if entry.get("status") == "stale" and when(entry.get("stale_since")):
        details[0] += f" since {when(entry.get('stale_since'))}"
    details.append(
        f"Last good download: {when(entry.get('last_success'))}"
        if when(entry.get("last_success"))
        else "Last good download: none yet"
    )
    if when(entry.get("last_attempt")):
        details.append(f"Latest attempt: {when(entry.get('last_attempt'))}")
    if isinstance(entry.get("rows"), int):
        details.append(f"Copy in use: {records(entry['rows'])}")
    if when(entry.get("newest_record")):
        details.append(f"Newest record in that copy: {when(entry.get('newest_record'))}")
    details.append(f"Where the data comes from: {info.homepage}")
    lines += ["**Details**", ""] + [f"* {line}" for line in details] + [""]
    lines += [
        "**What to check:** whether the publisher's page still works and still offers the same "
        "data. Sources sometimes move to a new address or rename their columns, and then the "
        "pipeline's adapter for this source needs an update.",
        "",
    ]
    if run_url:
        lines += [f"The log of this refresh: {run_url}", ""]
    lines += [
        "This issue is opened and updated by the weekly data refresh, and it closes itself once "
        "the source works again.",
        "",
        marker(info.id),
    ]
    return "\n".join(lines) + "\n"


def update_comment(info: SourceInfo, entry: dict[str, Any], today: date) -> str:
    status_words = "out of date" if entry.get("status") == "stale" else "not working"
    text = f"Still {status_words} in the refresh of {day_in_words(today)}."
    if entry.get("message"):
        text += f" {entry['message'].rstrip('.')}."
    return f"{text} {meanwhile(entry)}\n"


def close_comment(info: SourceInfo, today: date) -> str:
    return (
        f"{info.name} refreshed correctly on {day_in_words(today)}, and the map shows the new "
        "copy. Closing this issue.\n"
    )


# Deciding what to do ------------------------------------------------------------------------


@dataclass(frozen=True)
class Action:
    kind: str  # open, update or close
    source_id: str
    title: str = ""
    body: str = ""
    comment: str = ""
    number: int | None = None


def status_of(manifest: dict[str, Any] | None, source_id: str) -> str | None:
    if not manifest:
        return None
    entry = (manifest.get("sources") or {}).get(source_id)
    return entry.get("status") if isinstance(entry, dict) else None


def plan_issues(
    previous: dict[str, Any] | None,
    current: dict[str, Any],
    sources: dict[str, SourceInfo],
    open_issues: list[dict[str, Any]],
    today: date,
    run_url: str | None = None,
) -> list[Action]:
    by_source: dict[str, int] = {}
    for issue in open_issues:
        source_id = source_of(issue.get("body", ""))
        if source_id and source_id not in by_source:
            by_source[source_id] = int(issue["number"])

    actions = []
    for source_id, entry in sorted((current.get("sources") or {}).items()):
        if not isinstance(entry, dict):
            continue
        info = sources.get(source_id) or SourceInfo(source_id, source_id, "its publisher", "")
        now = entry.get("status")
        number = by_source.get(source_id)
        if now in FAILED:
            body = issue_body(info, entry, run_url)
            if number is not None:
                actions.append(
                    Action(
                        "update",
                        source_id,
                        issue_title(info),
                        body,
                        update_comment(info, entry, today),
                        number,
                    )
                )
            elif status_of(previous, source_id) in FAILED:
                actions.append(Action("open", source_id, issue_title(info), body))
        elif now == "ok" and number is not None:
            actions.append(
                Action("close", source_id, comment=close_comment(info, today), number=number)
            )
    return actions


# Talking to GitHub --------------------------------------------------------------------------

Runner = Callable[[list[str], str | None], str]


def run_gh(args: list[str], stdin: str | None = None) -> str:
    completed = subprocess.run(
        ["gh", *args], input=stdin, capture_output=True, text=True, check=True
    )
    return completed.stdout


def open_data_issues(gh: Runner) -> list[dict[str, Any]]:
    out = gh(
        [
            "issue",
            "list",
            "--label",
            LABEL,
            "--state",
            "open",
            "--limit",
            "200",
            "--json",
            "number,title,body",
        ],
        None,
    )
    return json.loads(out or "[]")


def execute(actions: list[Action], gh: Runner) -> None:
    for action in actions:
        if action.kind == "open":
            gh(
                ["issue", "create", "--title", action.title, "--label", LABEL, "--body-file", "-"],
                action.body,
            )
        elif action.kind == "update":
            number = str(action.number)
            gh(["issue", "edit", number, "--title", action.title, "--body-file", "-"], action.body)
            gh(["issue", "comment", number, "--body-file", "-"], action.comment)
        elif action.kind == "close":
            number = str(action.number)
            gh(["issue", "comment", number, "--body-file", "-"], action.comment)
            gh(["issue", "close", number, "--reason", "completed"], None)


def load_json(path: Path | None) -> dict[str, Any] | None:
    if path is None or not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


# Command line -------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="refresh.py", description=__doc__.split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)

    p = commands.add_parser("pack", help="pack each source's state and last good snapshot")
    p.add_argument("--cache", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)

    r = commands.add_parser("restore", help="unpack snapshot tars into a cache")
    r.add_argument("--cache", type=Path, required=True)
    r.add_argument("--from", dest="from_dir", type=Path, required=True)

    b = commands.add_parser("pick-basemap", help="print the base map asset to reuse, if any")
    b.add_argument("--assets", type=Path, required=True, help="file with one asset name per line")
    b.add_argument("--today", type=date.fromisoformat, default=None)
    b.add_argument("--max-age-days", type=int, default=30)

    i = commands.add_parser("issues", help="open, update and close data-source issues")
    i.add_argument("--current", type=Path, required=True)
    i.add_argument("--previous", type=Path, default=None)
    i.add_argument("--registry", type=Path, required=True)
    i.add_argument("--run-url", default=None)
    i.add_argument("--today", type=date.fromisoformat, default=None)
    i.add_argument("--dry-run", action="store_true", help="print what would happen, change nothing")

    args = parser.parse_args(argv)
    today = getattr(args, "today", None) or datetime.now(LOCAL_TZ).date()

    if args.command == "pack":
        for tar_path in pack(args.cache, args.out):
            print(f"packed {tar_path.name} ({tar_path.stat().st_size / 1e6:.1f} MB)")
        return 0
    if args.command == "restore":
        if not args.from_dir.is_dir():
            print("No earlier snapshots to restore.")
            return 0
        restored = restore(args.cache, args.from_dir)
        print(f"Restored {len(restored)} source(s): {', '.join(restored) or 'none'}")
        return 0
    if args.command == "pick-basemap":
        names = (
            args.assets.read_text(encoding="utf-8").splitlines() if args.assets.is_file() else []
        )
        # Protomaps names its builds by UTC date.
        utc_today = args.today or datetime.now(UTC).date()
        choice = pick_basemap(names, utc_today, args.max_age_days)
        if choice:
            print(choice)
        return 0

    current = load_json(args.current)
    if current is None:
        print(f"refresh.py: {args.current} is not a readable manifest", file=sys.stderr)
        return 1
    previous = load_json(args.previous)
    sources = load_sources(args.registry)
    gh: Runner = run_gh
    open_issues = [] if args.dry_run and not _gh_available() else open_data_issues(gh)
    actions = plan_issues(previous, current, sources, open_issues, today, args.run_url)
    if not actions:
        print("No data-source issue to open, update or close.")
    for action in actions:
        target = f" #{action.number}" if action.number else ""
        print(f"{action.kind}{target}: {action.source_id}")
        if args.dry_run:
            print((action.body or action.comment).rstrip() + "\n")
    if not args.dry_run:
        execute(actions, gh)
    return 0


def _gh_available() -> bool:
    try:
        subprocess.run(["gh", "auth", "status"], capture_output=True, check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


if __name__ == "__main__":
    sys.exit(main())
