"""Tests for .github/scripts/refresh.py. They run in CI with the pipeline's environment, which
also lets them check that a restored cache reads back through the pipeline's own code."""

from __future__ import annotations

import io
import json
import os
import re
import tarfile
from datetime import date
from pathlib import Path

import pytest

import refresh

REPO = Path(__file__).resolve().parents[3]


# A cache shaped like the pipeline's ------------------------------------------------------------


def write_snapshot(folder: Path, snapshot_id: str, status: str = "good") -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{snapshot_id}.parquet").write_bytes(b"PAR1" + snapshot_id.encode())
    meta = {
        "source": folder.name,
        "snapshot_id": snapshot_id,
        "file": f"{snapshot_id}.parquet",
        "format": "parquet",
        "fetched_at": f"{snapshot_id[:4]}-{snapshot_id[4:6]}-{snapshot_id[6:8]}T14:20:43Z",
        "rows": 17973,
        "sha256": "0" * 64,
        "bytes": 10,
        "newest_record": "2026-10-01",
        "status": status,
    }
    (folder / f"{snapshot_id}.json").write_text(json.dumps(meta), encoding="utf-8")


def make_cache(root: Path) -> Path:
    snapshots = root / "snapshots"
    good = snapshots / "shootings"
    write_snapshot(good, "20260927T142248Z")
    write_snapshot(good, "20261004T142248Z")
    write_snapshot(good, "20261011T142248Z", status="rejected")
    os.symlink("20261004T142248Z.parquet", good / "current.parquet")
    (good / "state.json").write_text(
        json.dumps(
            {
                "source": "shootings",
                "last_attempt": "2026-10-11T14:22:48Z",
                "last_result": "rejected",
                "message": "Rows fell from 17,973 to 0",
                "current": "20261004T142248Z",
                "consecutive_failures": 1,
                "pending_fetch": None,
            }
        ),
        encoding="utf-8",
    )
    (good / ".lock").write_text("", encoding="utf-8")

    never_good = snapshots / "high_injury_network"
    never_good.mkdir(parents=True)
    (never_good / "state.json").write_text(
        json.dumps(
            {
                "source": "high_injury_network",
                "last_result": "fetch_failed",
                "consecutive_failures": 2,
            }
        ),
        encoding="utf-8",
    )
    (snapshots / "empty_source").mkdir()
    return root


# Packing and restoring ------------------------------------------------------------------------


def test_pack_keeps_only_the_state_and_the_last_good_snapshot(tmp_path: Path) -> None:
    cache = make_cache(tmp_path / "cache")
    tars = refresh.pack(cache, tmp_path / "out")
    assert [t.name for t in tars] == ["snapshot-high_injury_network.tar", "snapshot-shootings.tar"]
    with tarfile.open(tmp_path / "out" / "snapshot-shootings.tar") as tar:
        names = sorted(tar.getnames())
        link = tar.getmember("shootings/current.parquet")
    assert names == [
        "shootings/20261004T142248Z.json",
        "shootings/20261004T142248Z.parquet",
        "shootings/current.parquet",
        "shootings/state.json",
    ]
    assert link.issym() and link.linkname == "20261004T142248Z.parquet"
    with tarfile.open(tmp_path / "out" / "snapshot-high_injury_network.tar") as tar:
        assert tar.getnames() == ["high_injury_network/state.json"]


def test_pack_of_an_empty_cache_writes_nothing(tmp_path: Path) -> None:
    assert refresh.pack(tmp_path / "nothing", tmp_path / "out") == []


def test_restore_rebuilds_a_cache_the_pipeline_can_read(tmp_path: Path) -> None:
    refresh.pack(make_cache(tmp_path / "cache"), tmp_path / "assets")
    fresh = tmp_path / "fresh"
    assert refresh.restore(fresh, tmp_path / "assets") == ["high_injury_network", "shootings"]
    link = fresh / "snapshots" / "shootings" / "current.parquet"
    assert link.is_symlink() and os.readlink(link) == "20261004T142248Z.parquet"
    assert link.read_bytes() == b"PAR120261004T142248Z"

    pipeline = pytest.importorskip("placekeepers.snapshots")
    cache_module = pytest.importorskip("placekeepers.cache")
    cache = cache_module.Cache(fresh)
    store = pipeline.SnapshotStore(cache, "shootings")
    assert store.current().snapshot_id == "20261004T142248Z"
    assert store.state().consecutive_failures == 1
    failing = pipeline.SnapshotStore(cache, "high_injury_network")
    assert failing.current() is None
    assert failing.state().consecutive_failures == 2


def test_restore_without_assets_is_a_fresh_start(tmp_path: Path) -> None:
    (tmp_path / "assets").mkdir()
    assert refresh.restore(tmp_path / "cache", tmp_path / "assets") == []
    assert (
        refresh.main(["restore", "--cache", str(tmp_path / "c"), "--from", str(tmp_path / "none")])
        == 0
    )


def evil_tar(path: Path, name: str, *, linkname: str | None = None) -> None:
    with tarfile.open(path, "w") as tar:
        info = tarfile.TarInfo(name)
        if linkname is not None:
            info.type = tarfile.SYMTYPE
            info.linkname = linkname
            tar.addfile(info)
        else:
            data = b"x"
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


@pytest.mark.parametrize(
    ("name", "linkname"),
    [
        ("shootings/../../escape.txt", None),
        ("/etc/escape.txt", None),
        ("opa_properties/state.json", None),
        ("shootings/deeper/state.json", None),
        ("shootings/current.parquet", "/etc/passwd"),
        ("shootings/current.parquet", "../../outside.parquet"),
    ],
)
def test_restore_refuses_anything_outside_the_source_folder(tmp_path: Path, name, linkname) -> None:
    assets = tmp_path / "assets"
    assets.mkdir()
    evil_tar(assets / "snapshot-shootings.tar", name, linkname=linkname)
    with pytest.raises((ValueError, tarfile.TarError)):
        refresh.restore(tmp_path / "cache", assets)
    assert not (tmp_path / "escape.txt").exists()


def test_restore_refuses_asset_names_that_are_not_source_ids(tmp_path: Path) -> None:
    assets = tmp_path / "assets"
    assets.mkdir()
    evil_tar(assets / "snapshot-Bad-Name.tar", "Bad-Name/state.json")
    with pytest.raises(ValueError):
        refresh.restore(tmp_path / "cache", assets)


# Base map -------------------------------------------------------------------------------------


def test_pick_basemap_reuses_a_recent_extract_and_asks_for_a_new_one_after_a_month() -> None:
    today = date(2026, 10, 20)
    assert refresh.pick_basemap([], today) is None
    assert refresh.pick_basemap(["basemap-20261004.tar"], today) == "basemap-20261004.tar"
    assert refresh.pick_basemap(["basemap-20260920.tar"], today) == "basemap-20260920.tar"
    assert refresh.pick_basemap(["basemap-20260919.tar"], today) is None
    assert (
        refresh.pick_basemap(
            ["basemap-20260801.tar", "basemap-20261004.tar", "manifest.json"], today
        )
        == "basemap-20261004.tar"
    )
    assert refresh.pick_basemap(["basemap-20261021.tar"], today) == "basemap-20261021.tar"
    assert refresh.pick_basemap(["basemap-20261130.tar"], today) is None
    assert refresh.pick_basemap(["basemap-20261399.tar", "basemap.tar"], today) is None


def test_pick_basemap_command_prints_the_choice(tmp_path: Path, capsys) -> None:
    names = tmp_path / "assets.txt"
    names.write_text("snapshot-shootings.tar\nbasemap-20261004.tar\n", encoding="utf-8")
    refresh.main(["pick-basemap", "--assets", str(names), "--today", "2026-10-12"])
    assert capsys.readouterr().out.strip() == "basemap-20261004.tar"
    refresh.main(["pick-basemap", "--assets", str(names), "--today", "2026-12-12"])
    assert capsys.readouterr().out.strip() == ""


# Plain words ----------------------------------------------------------------------------------


def test_dates_read_as_philadelphia_sees_them() -> None:
    assert refresh.when("2026-09-27") == "September 27, 2026"
    assert refresh.when("2026-10-04T14:20:43Z") == "October 4, 2026"
    # Two in the morning UTC is still the evening before in Philadelphia.
    assert refresh.when("2026-10-05T02:00:00Z") == "October 4, 2026"
    assert refresh.when(None) is None
    assert refresh.when("soon") is None


SOURCES = {
    "shootings": refresh.SourceInfo(
        "shootings",
        "Shooting victims",
        "Philadelphia Police Department",
        "https://opendataphilly.org/datasets/shooting-victims/",
    ),
    "high_injury_network": refresh.SourceInfo(
        "high_injury_network",
        "Vision Zero High Injury Network 2025",
        "City of Philadelphia, Office of Transportation and Infrastructure Systems",
        "https://opendataphilly.org/datasets/vision-zero-high-injury-network/",
    ),
}

STALE = {
    "status": "stale",
    "last_attempt": "2026-10-12T10:04:00Z",
    "last_success": "2026-09-27T14:22:48Z",
    "stale_since": "2026-09-27",
    "rows": 17973,
    "newest_record": "2026-09-25",
    "message": "Rows fell from 17,973 to 0 (100% fewer), more than the 5% allowed",
}
FAILING = {
    "status": "failing",
    "last_attempt": "2026-10-12T10:04:00Z",
    "last_success": None,
    "stale_since": None,
    "rows": None,
    "newest_record": None,
    "message": "Download failed: the server answered 503",
}
OK = {
    "status": "ok",
    "last_attempt": "2026-10-12T10:04:00Z",
    "last_success": "2026-10-12T10:04:00Z",
    "stale_since": None,
    "rows": 162,
    "newest_record": None,
    "message": None,
}


def manifest(**statuses: dict) -> dict:
    return {"schema": 1, "build_id": "b", "sources": statuses}


def no_dash_punctuation(text: str) -> bool:
    return not re.search(r"[‒–—―]|\s-\s|\s--\s", text)


def test_issue_text_is_plain_and_complete_for_a_stale_source() -> None:
    body = refresh.issue_body(SOURCES["shootings"], STALE, "https://github.com/x/y/actions/runs/1")
    assert body.startswith("**Shooting victims**, published by Philadelphia Police Department,")
    assert (
        "**Meanwhile:** The map keeps showing the last good copy, from September 27, 2026" in body
    )
    assert "Rows fell from 17,973 to 0" in body
    assert "* Status: out of date since September 27, 2026" in body
    assert "* Copy in use: 17,973 records" in body
    assert (
        "* Where the data comes from: https://opendataphilly.org/datasets/shooting-victims/" in body
    )
    assert "https://github.com/x/y/actions/runs/1" in body
    assert refresh.source_of(body) == "shootings"
    assert no_dash_punctuation(body)
    assert (
        refresh.issue_title(SOURCES["shootings"]) == "Data source needs attention: Shooting victims"
    )


def test_issue_text_for_a_source_with_no_usable_copy() -> None:
    body = refresh.issue_body(SOURCES["high_injury_network"], FAILING, None)
    assert "There is no usable copy of this source" in body
    assert "* Status: not working" in body
    assert "* Last good download: none yet" in body
    assert "log of this refresh" not in body
    assert no_dash_punctuation(body)
    comment = refresh.update_comment(SOURCES["high_injury_network"], FAILING, date(2026, 10, 19))
    assert comment.startswith("Still not working in the refresh of October 19, 2026.")
    assert no_dash_punctuation(comment)
    closing = refresh.close_comment(SOURCES["shootings"], date(2026, 10, 26))
    assert closing.startswith("Shooting victims refreshed correctly on October 26, 2026")
    assert no_dash_punctuation(closing)


# Deciding what to do --------------------------------------------------------------------------

TODAY = date(2026, 10, 12)


def plan(previous, current, open_issues=()):
    return refresh.plan_issues(previous, current, SOURCES, list(open_issues), TODAY)


def an_issue(number: int, source_id: str) -> dict:
    return {"number": number, "title": "x", "body": f"text\n{refresh.marker(source_id)}\n"}


def test_one_bad_week_raises_no_alarm() -> None:
    assert plan(manifest(shootings=OK), manifest(shootings=STALE)) == []
    assert plan(None, manifest(shootings=FAILING)) == []
    # Never fetched before (a new source) and failing now: wait one more week.
    assert plan(manifest(shootings={"status": "missing"}), manifest(shootings=FAILING)) == []


def test_two_bad_weeks_in_a_row_open_an_issue() -> None:
    actions = plan(manifest(shootings=STALE), manifest(shootings=STALE))
    assert [(a.kind, a.source_id) for a in actions] == [("open", "shootings")]
    assert actions[0].title == "Data source needs attention: Shooting victims"
    assert refresh.source_of(actions[0].body) == "shootings"
    actions = plan(manifest(high_injury_network=FAILING), manifest(high_injury_network=STALE))
    assert [(a.kind, a.source_id) for a in actions] == [("open", "high_injury_network")]


def test_an_open_issue_is_updated_while_the_source_stays_broken() -> None:
    actions = plan(manifest(shootings=STALE), manifest(shootings=STALE), [an_issue(7, "shootings")])
    assert [(a.kind, a.number) for a in actions] == [("update", 7)]
    assert actions[0].comment.startswith("Still out of date in the refresh of October 12, 2026.")
    # Even without a previous manifest, an issue that is already open gets this week's news.
    actions = plan(None, manifest(shootings=FAILING), [an_issue(7, "shootings")])
    assert [(a.kind, a.number) for a in actions] == [("update", 7)]


def test_the_issue_closes_when_the_source_works_again() -> None:
    actions = plan(manifest(shootings=STALE), manifest(shootings=OK), [an_issue(7, "shootings")])
    assert [(a.kind, a.number) for a in actions] == [("close", 7)]
    assert "refreshed correctly on October 12, 2026" in actions[0].comment


def test_sources_that_are_not_fetched_yet_never_raise_issues() -> None:
    assert plan(manifest(shootings=STALE), manifest(shootings={"status": "missing"})) == []
    assert (
        plan(
            manifest(shootings=STALE),
            manifest(shootings={"status": "missing"}),
            [an_issue(7, "shootings")],
        )
        == []
    )


def test_unrelated_issues_and_unknown_sources_are_handled() -> None:
    other = {"number": 3, "title": "Something else", "body": "no marker here"}
    actions = plan(manifest(mystery=STALE), manifest(mystery=STALE, shootings=OK), [other])
    assert [(a.kind, a.source_id) for a in actions] == [("open", "mystery")]
    assert actions[0].title == "Data source needs attention: mystery"


def test_execute_calls_gh_with_the_label_and_the_text() -> None:
    calls: list[tuple[list[str], str | None]] = []

    def fake_gh(args: list[str], stdin: str | None) -> str:
        calls.append((args, stdin))
        return ""

    refresh.execute(
        [
            refresh.Action("open", "shootings", "Title", "Body"),
            refresh.Action("update", "shootings", "Title", "New body", "Comment", 7),
            refresh.Action("close", "shootings", comment="Fixed", number=8),
        ],
        fake_gh,
    )
    assert calls == [
        (
            ["issue", "create", "--title", "Title", "--label", "data-source", "--body-file", "-"],
            "Body",
        ),
        (["issue", "edit", "7", "--title", "Title", "--body-file", "-"], "New body"),
        (["issue", "comment", "7", "--body-file", "-"], "Comment"),
        (["issue", "comment", "8", "--body-file", "-"], "Fixed"),
        (["issue", "close", "8", "--reason", "completed"], None),
    ]


def test_dry_run_with_the_real_registry_prints_the_issue(
    tmp_path: Path, capsys, monkeypatch
) -> None:
    pytest.importorskip("yaml")
    monkeypatch.setattr(refresh, "_gh_available", lambda: False)
    previous = tmp_path / "previous.json"
    current = tmp_path / "current.json"
    previous.write_text(json.dumps(manifest(shootings=STALE)), encoding="utf-8")
    current.write_text(json.dumps(manifest(shootings=STALE, opa_properties=OK)), encoding="utf-8")
    code = refresh.main(
        [
            "issues",
            "--current",
            str(current),
            "--previous",
            str(previous),
            "--registry",
            str(REPO / "registry"),
            "--today",
            "2026-10-12",
            "--dry-run",
        ]
    )
    out = capsys.readouterr().out
    assert code == 0
    assert out.startswith("open: shootings")
    assert "**Shooting victims**, published by Philadelphia Police Department" in out


def test_issues_command_refuses_an_unreadable_manifest(tmp_path: Path) -> None:
    bad = tmp_path / "manifest.json"
    bad.write_text("{not json", encoding="utf-8")
    assert (
        refresh.main(
            ["issues", "--current", str(bad), "--registry", str(REPO / "registry"), "--dry-run"]
        )
        == 1
    )


def test_source_names_travel_as_json_between_jobs(tmp_path: Path) -> None:
    pytest.importorskip("yaml")
    out = tmp_path / "sources.json"
    assert refresh.main(["sources", "--registry", str(REPO / "registry"), "--out", str(out)]) == 0
    from_json = refresh.sources_from_json(out)
    assert from_json == refresh.load_sources(REPO / "registry")
    assert from_json["shootings"].publisher == "Philadelphia Police Department"


def test_issues_with_sources_json_need_no_yaml(tmp_path: Path, capsys, monkeypatch) -> None:
    monkeypatch.setattr(refresh, "_gh_available", lambda: False)
    names = tmp_path / "sources.json"
    names.write_text(refresh.sources_to_json(SOURCES), encoding="utf-8")
    previous = tmp_path / "previous.json"
    current = tmp_path / "current.json"
    previous.write_text(json.dumps(manifest(high_injury_network=FAILING)), encoding="utf-8")
    current.write_text(json.dumps(manifest(high_injury_network=FAILING)), encoding="utf-8")
    args = ["issues", "--current", str(current), "--previous", str(previous)]
    assert refresh.main([*args, "--sources", str(names), "--dry-run"]) == 0
    out = capsys.readouterr().out
    assert out.startswith("open: high_injury_network")
    assert "**Vision Zero High Injury Network 2025**" in out
    with pytest.raises(SystemExit):
        refresh.main([*args, "--dry-run"])  # one of --sources or --registry is required


# The release ------------------------------------------------------------------------------------


def test_release_plan_replaces_snapshots_and_old_base_maps() -> None:
    files = [
        "snapshot-shootings.tar",
        "snapshot-opa_properties.tar",
        "manifest.json",
        "basemap-20261101.tar",
    ]
    existing = [
        "snapshot-shootings.tar",
        "snapshot-retired_source.tar",
        "manifest.json",
        "basemap-20261004.tar",
    ]
    assert refresh.plan_release(files, existing) == [
        ("upload", "basemap-20261101.tar"),
        ("upload", "manifest.json"),
        ("upload", "snapshot-opa_properties.tar"),
        ("upload", "snapshot-shootings.tar"),
        ("delete", "basemap-20261004.tar"),
        ("delete", "snapshot-retired_source.tar"),
    ]


def test_release_plan_never_empties_the_release() -> None:
    existing = ["snapshot-shootings.tar", "basemap-20261004.tar", "manifest.json"]
    # No snapshots and no base map this run: nothing is deleted.
    assert refresh.plan_release(["manifest.json"], existing) == [("upload", "manifest.json")]
    assert refresh.plan_release([], existing) == []


def test_release_plan_skips_anything_unexpected(tmp_path: Path, capsys) -> None:
    for name in ["snapshot-shootings.tar", "evil.sh", "snapshot-../x.tar", "manifest.json.bak"]:
        if "/" not in name:
            (tmp_path / name).write_text("x", encoding="utf-8")
    assets = tmp_path.parent / "assets.txt"
    assets.write_text("snapshot-shootings.tar\nsnapshot-old.tar\n", encoding="utf-8")
    assert refresh.main(["release-plan", "--dir", str(tmp_path), "--assets", str(assets)]) == 0
    assert capsys.readouterr().out.splitlines() == [
        "upload snapshot-shootings.tar",
        "delete snapshot-old.tar",
        "skip evil.sh",
        "skip manifest.json.bak",
    ]
