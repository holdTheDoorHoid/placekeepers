#!/usr/bin/env python3
"""Helpers for the weekly refresh workflow (.github/workflows/refresh.yml).

Standard library only, so any job can run it with a plain Python 3.12. Commands:

    refresh.py pack --cache DIR --out DIR
        One tar per source holding what the next run needs: the source's state (which carries
        the count of failed attempts in a row) and its last good snapshot. These become the
        assets of the rolling `data-snapshots` release. A source whose files are exactly as they
        were restored (a frozen source, or a yearly one not due again) is not packed; its asset
        name goes in unchanged.txt instead, so the release keeps last week's copy.

    refresh.py restore --cache DIR --from DIR
        Unpacks those tars into a fresh cache, so a source that fails this week falls back to
        last week's good copy instead of to nothing, and notes a fingerprint of each source's
        files so pack can tell which ones did not change.

    refresh.py encrypt --dir DIR --status FILE
    refresh.py decrypt --dir DIR --status FILE
        No snapshot is published in plain form (decision D2, docs/VERIFICATION.md). encrypt
        turns each snapshot tar in DIR into snapshot-<source>.tar.gpg (GnuPG, symmetric AES256)
        with the key in the PK_SNAPSHOT_KEY environment variable, a repository secret; decrypt
        does the reverse after the download, and writes to FILE whether this week's snapshots may
        be saved. The key goes to gpg through a pipe, never on a command line, in a file or in a
        log. Without the key, or when a saved copy does not decrypt, no snapshot is saved that
        week and the run carries on without last week's copies; neither command ever fails the
        run.

    refresh.py pick-basemap --assets FILE [--today YYYY-MM-DD] [--max-age-days 30]
        Given the release's asset names (one per line), prints the base map asset that is still
        fresh enough to reuse, or nothing when a new extract is due.

    refresh.py release-plan --dir DIR --assets FILE
        Decides what the save job does with the data-snapshots release: prints "upload NAME" for
        each expected file in DIR, "keep NAME" for unchanged snapshots (listed in DIR's
        unchanged.txt) that stay as they are, "delete NAME" for assets it replaces for good
        (snapshots of sources that are gone, older base maps), "missing NAME" for an unchanged
        snapshot the release no longer has, and "skip NAME" for anything unexpected.

    refresh.py sources --registry DIR --out FILE
        Writes each source's name, publisher and homepage from registry/sources.yaml as JSON
        (needs PyYAML), so the issues job can run with the standard library alone.

    refresh.py issues --current FILE [--previous FILE] (--sources FILE | --registry DIR)
                      [--run-url URL] [--dry-run]
        Opens, updates and closes one GitHub issue per data source, labeled data-source, using
        the gh command line tool (GH_TOKEN and GH_REPO come from the workflow). A source gets an
        issue when it is stale or failing in this run and was also stale or failing in the
        previous run, so a single bad week does not raise an alarm. The issue closes itself when
        the source is ok again.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tarfile
import tempfile
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
SNAPSHOT_ASSET = re.compile(r"^snapshot-[a-z][a-z0-9_]*\.tar$")
ENCRYPTED_ASSET = re.compile(r"^snapshot-[a-z][a-z0-9_]*\.tar\.gpg$")
KEY_ENV = "PK_SNAPSHOT_KEY"
NO_KEY = "there is no PK_SNAPSHOT_KEY secret"
# Written by restore beside each source's files; the pipeline ignores names starting with a dot.
FINGERPRINT = ".restored-fingerprint"
UNCHANGED_LIST = "unchanged.txt"
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


def fingerprint(source_dir: Path) -> str:
    """A digest of the files pack would put in a source's tar: names, contents, link targets."""
    digest = hashlib.sha256()
    for path in sorted(snapshot_files(source_dir), key=lambda p: p.name):
        digest.update(path.name.encode() + b"\0")
        if path.is_symlink():
            digest.update(b"link " + str(path.readlink()).encode())
        else:
            digest.update(b"file " + hashlib.sha256(path.read_bytes()).hexdigest().encode())
        digest.update(b"\n")
    return digest.hexdigest()


def unchanged_since_restore(source_dir: Path) -> bool:
    stored = source_dir / FINGERPRINT
    if not stored.is_file():
        return False
    return stored.read_text(encoding="utf-8").strip() == fingerprint(source_dir)


def pack(cache: Path, out: Path) -> list[Path]:
    """Write snapshot-<source>.tar for every source folder in the cache whose files changed since
    they were restored. Unchanged sources are listed in out/unchanged.txt instead (the release
    keeps last week's copy of them). Returns the tars written."""
    out.mkdir(parents=True, exist_ok=True)
    written = []
    unchanged = []
    root = cache / SNAPSHOTS
    for source_dir in sorted(p for p in root.iterdir() if p.is_dir()) if root.is_dir() else []:
        files = snapshot_files(source_dir)
        if not files:
            continue
        tar_path = out / f"{ASSET_PREFIX}{source_dir.name}.tar"
        if unchanged_since_restore(source_dir):
            unchanged.append(tar_path.name)
            continue
        with tarfile.open(tar_path, "w") as tar:
            for path in files:
                tar.add(path, arcname=f"{source_dir.name}/{path.name}", recursive=False)
        written.append(tar_path)
    listing = out / UNCHANGED_LIST
    if unchanged:
        listing.write_text("".join(f"{name}\n" for name in unchanged), encoding="utf-8")
    else:
        listing.unlink(missing_ok=True)
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
        source_dir = root / source_id
        (source_dir / FINGERPRINT).write_text(fingerprint(source_dir) + "\n", encoding="utf-8")
        restored.append(source_id)
    return restored


# Encrypted snapshots (decision D2) ---------------------------------------------------------------


def snapshot_key(environ: dict[str, str] | None = None) -> str | None:
    """The snapshot key from the environment, or None when it is missing or blank."""
    key = (os.environ if environ is None else environ).get(KEY_ENV, "")
    return key if key.strip() else None


def run_gpg(args: list[str], key: str) -> bool:
    """Run gpg in batch mode with `key` as the passphrase. The passphrase travels through a pipe
    (--passphrase-fd), never on the command line or on disk, and gpg works in a throwaway home
    folder so nothing is cached or left behind. True when gpg succeeds."""
    with tempfile.TemporaryDirectory(prefix="pk-gnupg-") as home:
        os.chmod(home, 0o700)
        read_end, write_end = os.pipe()
        try:
            os.write(write_end, key.encode("utf-8"))
        finally:
            os.close(write_end)
        command = [
            "gpg",
            "--homedir",
            home,
            "--batch",
            "--yes",
            "--quiet",
            "--no-tty",
            "--pinentry-mode",
            "loopback",
            "--no-symkey-cache",
            "--passphrase-fd",
            str(read_end),
            *args,
        ]
        try:
            done = subprocess.run(command, pass_fds=(read_end,), capture_output=True, check=False)
        except OSError:
            return False
        finally:
            os.close(read_end)
            subprocess.run(
                ["gpgconf", "--homedir", home, "--kill", "gpg-agent"],
                capture_output=True,
                check=False,
            )
    return done.returncode == 0


def encrypt_snapshots(folder: Path, key: str | None, blocked: str | None = None) -> list[Path]:
    """Replace every snapshot-<source>.tar in `folder` with snapshot-<source>.tar.gpg, and rename
    the unchanged list's entries to match. When there is no key, when decrypt reported a reason
    not to save (`blocked`), or when any tar fails to encrypt, every snapshot tar and the
    unchanged list are removed instead: no snapshot is saved this week, and the release keeps
    the encrypted copies it has. Returns the encrypted files."""
    tars = sorted(folder.glob(f"{ASSET_PREFIX}*.tar"))
    listing = folder / UNCHANGED_LIST
    reason = blocked or (NO_KEY if key is None else None)
    done: list[Path] = []
    if reason is None:
        assert key is not None
        for tar_path in tars:
            target = tar_path.with_name(tar_path.name + ".gpg")
            symmetric = ["--symmetric", "--cipher-algo", "AES256", "--output", str(target)]
            if not run_gpg([*symmetric, str(tar_path)], key) or not target.is_file():
                reason = f"{tar_path.name} could not be encrypted"
                break
            done.append(target)
    if reason is not None:
        for path in [*tars, *done]:
            path.unlink(missing_ok=True)
        listing.unlink(missing_ok=True)
        print(f"::warning::No snapshots are saved this week: {reason}.")
        return []
    for tar_path in tars:
        tar_path.unlink()
    if listing.is_file():
        names = [
            f"{name}.gpg" if SNAPSHOT_ASSET.match(name) else name
            for name in listing.read_text(encoding="utf-8").split()
        ]
        listing.write_text("".join(f"{name}\n" for name in names), encoding="utf-8")
    return done


def decrypt_snapshots(folder: Path, key: str | None) -> tuple[list[str], str | None]:
    """Turn every snapshot-<source>.tar.gpg in `folder` into snapshot-<source>.tar for restore.
    Returns the tars decrypted and, when something went wrong, the reason no snapshot may be
    saved this week: there is no key, or a copy does not decrypt (a wrong key would otherwise
    replace good copies with ones nobody can read). A copy that does not decrypt is removed, so
    its source starts without last week's copy. A plain tar from before encryption (the first
    run with it) is restored as it is."""
    encrypted = sorted(folder.glob(f"{ASSET_PREFIX}*.tar.gpg"))
    if key is None:
        for path in encrypted:
            path.unlink()
        print(f"::warning::{NO_KEY}, so this run starts without last week's copies of the data.")
        return [], NO_KEY
    reason = None
    decrypted = []
    for path in encrypted:
        target = path.with_name(path.name[: -len(".gpg")])
        partial = target.with_name(target.name + ".part")
        if run_gpg(["--decrypt", "--output", str(partial), str(path)], key) and partial.is_file():
            partial.replace(target)
            decrypted.append(target.name)
        else:
            partial.unlink(missing_ok=True)
            reason = f"{path.name} could not be decrypted with the PK_SNAPSHOT_KEY secret"
            print(f"::warning::{reason}, so that source starts without last week's copy.")
        path.unlink()
    return decrypted, reason


def write_status(path: Path, reason: str | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("ok\n" if reason is None else f"blocked: {reason}\n", encoding="utf-8")


def read_status(path: Path) -> str | None:
    """The reason not to save snapshots, from decrypt's status file; a missing or unreadable
    file is a reason too, since nobody checked the key."""
    try:
        text = path.read_text(encoding="utf-8").strip()
    except OSError:
        return "the restore step did not record whether the snapshot key works"
    if text == "ok":
        return None
    return text.removeprefix("blocked:").strip() or "the snapshot key could not be checked"


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


# The release ----------------------------------------------------------------------------------

# Snapshots go on the release encrypted only; the manifest and the base map are plain.
RELEASE_FILE = re.compile(
    r"^(snapshot-[a-z][a-z0-9_]*\.tar\.gpg|manifest\.json|basemap-\d{8}\.tar)$"
)


def plan_release(
    files: Iterable[str], existing: Iterable[str], unchanged: Iterable[str] = ()
) -> list[tuple[str, str]]:
    """What to upload, keep, delete and skip. Unchanged snapshots (listed by pack) keep their
    existing asset instead of being uploaded again. Snapshots of sources that are no longer
    produced are deleted only when this run produced or kept snapshots at all, and older base maps
    only when a new one is uploaded, so a broken run can never empty the release. A plain
    snapshot is never uploaded (it is skipped), and a plain snapshot already on the release, from
    before snapshots were encrypted, is always deleted."""
    files = [name for name in files if name != UNCHANGED_LIST]
    existing = set(existing)
    uploads = sorted(name for name in files if RELEASE_FILE.match(name))
    skipped = sorted(name for name in files if not RELEASE_FILE.match(name))
    listed = sorted({name for name in unchanged if ENCRYPTED_ASSET.match(name)} - set(uploads))
    kept = [name for name in listed if name in existing]
    missing = [name for name in listed if name not in existing]
    produced = {name for name in uploads if name.startswith("snapshot-")} | set(kept)
    new_basemaps = {name for name in uploads if name.startswith("basemap-")}

    def replaced(name: str) -> bool:
        if SNAPSHOT_ASSET.match(name):
            return True  # a plain copy: never kept on the release (decision D2)
        if name.startswith("snapshot-"):
            return bool(produced) and name not in produced
        if BASEMAP_ASSET.match(name):
            return bool(new_basemaps) and name not in new_basemaps
        return False

    deletes = [name for name in sorted(existing) if replaced(name)]
    return (
        [("upload", name) for name in uploads]
        + [("keep", name) for name in kept]
        + [("delete", name) for name in deletes]
        + [("missing", name) for name in missing]
        + [("skip", name) for name in skipped]
    )


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
    #: pictures each visitor's browser loads from the publisher's own server (an `arcgis_tiles`
    #: endpoint, M4.3): the site keeps no copy of them, so "the last good copy" does not apply
    external: bool = False


def load_sources(registry_dir: Path) -> dict[str, SourceInfo]:
    import yaml  # only the pipeline job, which has PyYAML, reads the registry itself

    entries = yaml.safe_load((registry_dir / "sources.yaml").read_text(encoding="utf-8")) or []
    return {
        entry["id"]: SourceInfo(
            entry["id"],
            entry["name"],
            entry["publisher"],
            entry["homepage"],
            (entry.get("endpoint") or {}).get("kind") == "arcgis_tiles",
        )
        for entry in entries
    }


def sources_to_json(sources: dict[str, SourceInfo]) -> str:
    data = {
        source_id: {
            "name": info.name,
            "publisher": info.publisher,
            "homepage": info.homepage,
            **({"external": True} if info.external else {}),
        }
        for source_id, info in sources.items()
    }
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def sources_from_json(path: Path) -> dict[str, SourceInfo]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        source_id: SourceInfo(
            source_id,
            str(entry.get("name") or source_id),
            str(entry.get("publisher") or "its publisher"),
            str(entry.get("homepage") or ""),
            entry.get("external") is True,
        )
        for source_id, entry in data.items()
        if isinstance(entry, dict)
    }


def marker(source_id: str) -> str:
    return f"<!-- {MARKER}: {source_id} -->"


def source_of(issue_body: str) -> str | None:
    match = re.search(rf"<!-- {MARKER}: ([a-z][a-z0-9_]*) -->", issue_body or "")
    return match.group(1) if match else None


def issue_title(info: SourceInfo) -> str:
    return f"Data source needs attention: {info.name}"


def meanwhile(entry: dict[str, Any], external: bool = False) -> str:
    if external:
        return (
            "These pictures load straight from the publisher's server in each visitor's browser, "
            "and the site keeps no copy of them, so where the server stopped answering they may "
            "not show on the map. The Data status page says so."
        )
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
        f"**Meanwhile:** {meanwhile(entry, info.external)}",
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
    return f"{text} {meanwhile(entry, info.external)}\n"


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

    en = commands.add_parser("encrypt", help="encrypt the packed snapshots with PK_SNAPSHOT_KEY")
    en.add_argument("--dir", type=Path, required=True)
    en.add_argument("--status", type=Path, required=True, help="the status file decrypt wrote")

    de = commands.add_parser("decrypt", help="decrypt downloaded snapshots with PK_SNAPSHOT_KEY")
    de.add_argument("--dir", type=Path, required=True)
    de.add_argument("--status", type=Path, required=True, help="where to say if saving may go on")

    b = commands.add_parser("pick-basemap", help="print the base map asset to reuse, if any")
    b.add_argument("--assets", type=Path, required=True, help="file with one asset name per line")
    b.add_argument("--today", type=date.fromisoformat, default=None)
    b.add_argument("--max-age-days", type=int, default=30)

    rp = commands.add_parser("release-plan", help="what to upload to and delete from the release")
    rp.add_argument("--dir", type=Path, required=True)
    rp.add_argument("--assets", type=Path, required=True, help="file with one asset name per line")

    so = commands.add_parser("sources", help="write source names from the registry as JSON")
    so.add_argument("--registry", type=Path, required=True)
    so.add_argument("--out", type=Path, required=True)

    i = commands.add_parser("issues", help="open, update and close data-source issues")
    i.add_argument("--current", type=Path, required=True)
    i.add_argument("--previous", type=Path, default=None)
    names = i.add_mutually_exclusive_group(required=True)
    names.add_argument("--sources", type=Path, help="JSON written by the sources command")
    names.add_argument("--registry", type=Path, help="the registry folder (needs PyYAML)")
    i.add_argument("--run-url", default=None)
    i.add_argument("--today", type=date.fromisoformat, default=None)
    i.add_argument("--dry-run", action="store_true", help="print what would happen, change nothing")

    args = parser.parse_args(argv)
    today = getattr(args, "today", None) or datetime.now(LOCAL_TZ).date()

    if args.command == "pack":
        written = pack(args.cache, args.out)
        for tar_path in written:
            print(f"packed {tar_path.name} ({tar_path.stat().st_size / 1e6:.1f} MB)")
        listing = args.out / UNCHANGED_LIST
        for name in listing.read_text(encoding="utf-8").split() if listing.is_file() else []:
            print(f"unchanged {name} (the release keeps last week's copy)")
        total = sum(path.stat().st_size for path in written)
        print(f"{len(written)} snapshot(s) to upload, {total / 1e6:.1f} MB in all")
        return 0
    if args.command == "encrypt":
        written = encrypt_snapshots(args.dir, snapshot_key(), read_status(args.status))
        if written:
            total = sum(path.stat().st_size for path in written)
            print(f"Encrypted {len(written)} snapshot(s), {total / 1e6:.1f} MB in all")
        return 0
    if args.command == "decrypt":
        if not args.dir.is_dir():
            args.dir.mkdir(parents=True)
        decrypted, reason = decrypt_snapshots(args.dir, snapshot_key())
        write_status(args.status, reason)
        print(f"Decrypted {len(decrypted)} snapshot(s)")
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

    if args.command == "release-plan":
        files = [path.name for path in args.dir.iterdir() if path.is_file()]
        existing = args.assets.read_text(encoding="utf-8").split() if args.assets.is_file() else []
        listing = args.dir / UNCHANGED_LIST
        unchanged = listing.read_text(encoding="utf-8").split() if listing.is_file() else []
        for action, name in plan_release(files, existing, unchanged):
            print(f"{action} {name}")
        return 0
    if args.command == "sources":
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(sources_to_json(load_sources(args.registry)), encoding="utf-8")
        return 0

    current = load_json(args.current)
    if current is None:
        print(f"refresh.py: {args.current} is not a readable manifest", file=sys.stderr)
        return 1
    previous = load_json(args.previous)
    sources = sources_from_json(args.sources) if args.sources else load_sources(args.registry)
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
