"""Projects neighbors finished (M5.3, issue #47): reading the approved reports, checking them,
merging the curated hand entries and corrections, and publishing the layer and the table, weekly
and in a quick publish. Only approved, valid reports appear, and no GitHub user name, title, photo
link or answer about permission reaches a published file beyond the link to each report.

The reports are fixture issues (pipeline/tests/fixtures/projects_issues.json, written by
projects_cases.py); nothing here uses the network.
"""

from __future__ import annotations

import json
import re
import shutil
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx
import pyarrow as pa
import pytest
import shapely
import yaml
from shapely.geometry import Point, box

from placekeepers.adapters.projects import ProjectReports, github_token
from placekeepers.cli import main
from placekeepers.projects import (
    FORM_FIELDS,
    FORM_KINDS,
    MONTHS,
    NOTE_PREFIX,
    CuratedProjects,
    ParcelIndex,
    ReportsError,
    build_projects,
    clean_text,
    fetch_reports,
    normalize_address,
    outside_city,
    parcel_in,
    parse_form,
    read_curated,
    read_inputs,
    reduce_issue,
    write_inputs,
)
from placekeepers.publish import publish
from placekeepers.publish.projects import refresh_projects, summary_markdown
from placekeepers.registry import RegistryError, load_registry
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import FIXTURES, REPO_ROOT, install_snapshot

NOW = datetime(2026, 10, 21, 15, 0, tzinfo=UTC)
TODAY = date(2026, 10, 21)
REPO = "holdTheDoorHoid/placekeepers"
LABEL = "project-approved"
#: GitHub user names in the fixture: none may reach a published file (the repository owner's
#: appears only inside the links to the reports, which are allowed).
REPORTERS = ("neighbor-ana", "neighbor-ben")
#: The city limits of the tests: a box around the sample parcels.
LIMITS = box(-75.30, 39.86, -74.95, 40.14)

CURATED = """
- issue: 107
  suppressed: true
  comment: the owner of the lot asked
- issue: 119
  parcel: "371000002"
- id: h2025_0001
  kind: art
  lat: 39.9952
  lng: -75.1390
  address: Wall at Lawrence and Cambria
  finished: 2025-08
  group: Sample Arts Collective
  what_it_took: Two weekends and donated paint.
  source: https://example.org/mural-news
- id: h2025_0002
  kind: cleanup
  lat: 39.70
  lng: -75.10
  finished: 2025-07
- id: h2024_0003
  kind: garden
  parcel: "371000001"
  finished: 2024-05
  suppressed: true
- issue: abc
"""


def pages() -> list[dict[str, Any]]:
    return json.loads((FIXTURES / "projects_issues.json").read_text(encoding="utf-8"))


def nodes() -> list[dict[str, Any]]:
    return [node for page in pages() for node in page["data"]["repository"]["issues"]["nodes"]]


def records() -> list[dict[str, Any]]:
    return [reduce_issue(node, LABEL) for node in nodes()]


def opa_table() -> pa.Table:
    return pa.table(
        {
            "parcel_number": ["371000001", "371000002", "881000100", "881000200", "123000000"],
            "location": [
                "2931 N LAWRENCE ST",
                "2933 N LAWRENCE ST",
                "1234-36 N 5TH ST",
                "1240 N 5TH ST",
                "1 FAR AWAY RD",
            ],
            "owner_1": ["MORALES ROSA", "CITY OF PHILA", "SAMPLE LLC", "SAMPLE LLC", "X"],
            "lat": [39.99512, 39.99518, 39.97101, 39.97120, 39.70],
            "lng": [-75.13851, -75.13846, -75.14382, -75.14380, -75.10],
        }
    )


def index() -> ParcelIndex:
    return ParcelIndex(opa_table())


def curated(tmp_path: Path, text: str = CURATED) -> CuratedProjects:
    path = tmp_path / "interventions.yaml"
    path.write_text(text, encoding="utf-8")
    return read_curated(path)


# ---------------------------------------------------------------------------------------------
# The form


def test_the_parser_knows_every_field_and_answer_of_the_issue_form():
    form = yaml.safe_load(
        (REPO_ROOT / ".github" / "ISSUE_TEMPLATE" / "project.yml").read_text(encoding="utf-8")
    )
    fields = [item for item in form["body"] if item["type"] != "markdown"]
    assert {item["attributes"]["label"] for item in fields} == set(FORM_FIELDS)
    by_id = {item["id"]: item for item in fields}
    assert {FORM_FIELDS[item["attributes"]["label"]] for item in fields} == set(by_id)
    assert by_id["kind"]["attributes"]["options"] == list(FORM_KINDS)
    assert by_id["month"]["attributes"]["options"] == list(MONTHS)
    consent = by_id["consent"]["attributes"]["options"]
    assert len(consent) == 1 and consent[0]["required"] is True
    assert consent[0]["label"].startswith("I agree")
    # Every field the map needs is required by the form, except the two optional texts.
    for key in ("kind", "where", "month", "year", "permission"):
        assert by_id[key]["validations"]["required"] is True


def test_the_first_heading_of_a_field_counts_and_empty_answers_are_empty():
    body = (
        "### What was done\n\nGarden\n\n### Where\n\n371000001\n\n"
        "### What it took (optional)\n\nWe did it.\n\n### Where\n\n999999999\n\n"
        "### Group name to show (optional)\n\n_No response_\n"
    )
    answers = parse_form(body)
    assert answers is not None
    assert answers["where"] == "371000001"
    assert answers["note"] == "We did it."
    assert answers["group"] == ""
    assert parse_form("Hello, please put us on the map") is None
    assert parse_form(None) is None


def test_an_issue_is_reduced_to_its_answers_with_no_user_name_title_or_permission():
    reduced = records()
    text = json.dumps(reduced)
    for name in (*REPORTERS, 'holdTheDoorHoid"', "Ana Lopez", "No, or not sure", "permission"):
        assert name not in text
    first = reduced[0]
    assert first["issue"] == 101
    assert first["approved"] is True
    assert first["approved_at"] == "2026-06-02T14:00:00Z"
    assert first["edited_after_approval"] is False
    assert first["consent"] is True
    assert first["kind"] == "Garden"
    by_issue = {r["issue"]: r for r in reduced}
    # The reporter changed 111 after it was approved; the person who approved 118 changed it.
    assert by_issue[111]["edited_after_approval"] is True
    assert by_issue[118]["edited_after_approval"] is False
    # The label was added and removed again on 115.
    assert by_issue[115]["approved"] is False
    assert by_issue[115]["approved_at"] is None
    assert by_issue[105]["consent"] is False
    assert by_issue[110]["form"] is False


def test_every_page_of_reports_is_read():
    sent: list[dict[str, Any]] = []
    replies = iter(pages())

    def post(payload: dict[str, Any]) -> Any:
        sent.append(payload)
        return next(replies)

    found = fetch_reports(post, REPO, LABEL)
    assert [r["issue"] for r in found] == list(range(101, 120))
    assert [p["variables"]["cursor"] for p in sent] == [None, "Y3Vyc29yOjEw"]
    assert all(p["variables"]["labels"] == [LABEL] for p in sent)
    assert sent[0]["variables"]["owner"] == "holdTheDoorHoid"


@pytest.mark.parametrize(
    "reply",
    [
        {"errors": [{"message": "Something went wrong"}]},
        {"data": {"repository": None}},
        ["not", "a", "dict"],
    ],
)
def test_an_error_from_github_is_an_error(reply):
    with pytest.raises(ReportsError):
        fetch_reports(lambda payload: reply, REPO, LABEL)


# ---------------------------------------------------------------------------------------------
# Cleaning and finding the place


@pytest.mark.parametrize(
    ("value", "expected", "removed"),
    [
        ("Ten neighbors, two Saturdays.", "Ten neighbors, two Saturdays.", set()),
        ("Look ![us](https://github.com/user-attachments/assets/x) here", "Look here", {"photo"}),
        ('Look <img src="https://example.com/a.png"> here', "Look here", {"photo"}),
        ("See [our page](https://example.org/x).", "See our page.", {"link"}),
        ("Go to http://spam.example.com now", "Go to now", {"link"}),
        ("Write ana@example.com or call (215) 555-0123.", "Write or call.", {"email", "phone"}),
        ("Thanks @neighbor-ben!", "Thanks!", {"mention"}),
        ("**Bold** `code`", "Bold code", set()),
        ("_No", "_No", set()),
        ("   ", None, set()),
        ("https://example.com", None, {"link"}),
    ],
)
def test_text_the_map_shows_leaves_out_links_photos_and_contact_details(value, expected, removed):
    assert clean_text(value, 600) == (expected, removed)


def test_long_text_is_cut_at_a_word():
    text, _ = clean_text("word " * 50, 30)
    assert text is not None and len(text) <= 30 and text.endswith("…")
    assert not text[:-1].endswith(" ")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("2931 N Lawrence St", "2931 N LAWRENCE ST"),
        ("2931 North Lawrence Street, Philadelphia, PA 19133", "2931 N LAWRENCE ST"),
        ("1234 North Fifth Street", "1234 N 5TH ST"),
        ("2933 n. lawrence st. apt 2", "2933 N LAWRENCE ST"),
        ("100 Market St #4", "100 MARKET ST"),
        ("Corner of 5th and Nowhere", None),
        ("", None),
    ],
)
def test_addresses_are_written_as_the_city_writes_them(text, expected):
    assert normalize_address(text) == expected


def test_places_outside_the_city_are_told_apart_from_street_names():
    assert outside_city("100 Market St, Camden, NJ 08102")
    assert outside_city("12 Main St 19001")
    assert outside_city("5 Oak Lane, Cheltenham")
    assert not outside_city("5600 Chester Ave, Philadelphia, PA 19143")
    assert not outside_city("7000 Cheltenham Ave")
    assert not outside_city("1234 N 5th St 19122")


def test_a_parcel_is_found_by_its_link_number_or_address():
    assert (
        parcel_in("https://holdthedoorhoid.github.io/placekeepers/#v=f&p=371000001") == "371000001"
    )
    assert parcel_in("Lot 371000002 on the corner") == "371000002"
    assert parcel_in("call 2155550123") is None
    found = index()
    assert found.parcels(["371000001", "999999999"]).keys() == {"371000001"}
    assert found.address("2931 N Lawrence Street").parcel == "371000001"
    # 1236 is inside the range 1234-36.
    assert found.address("1236 N 5th St").parcel == "881000100"
    assert found.address("1238 N 5th St") is None
    assert found.address("1240 North 5th Street").parcel == "881000200"


# ---------------------------------------------------------------------------------------------
# The curated file


def test_curated_entries_are_checked_and_a_suppression_survives_a_broken_entry(tmp_path):
    found = curated(tmp_path)
    assert set(found.corrections) == {107, 119}
    assert found.corrections[107].suppressed
    assert found.corrections[119].parcel == "371000002"
    assert [e.id for e in found.entries] == ["h2025_0001", "h2025_0002", "h2024_0003"]
    assert any("issue must be an issue number" in p for p in found.problems)
    broken = curated(tmp_path, "- issue: 12\n  suppressed: true\n  kind: spaceship\n")
    assert broken.corrections[12].suppressed
    assert broken.problems
    assert read_curated(tmp_path / "missing.yaml").entries == []


def test_the_repository_curated_file_reads_cleanly():
    found = read_curated(REPO_ROOT / "data" / "curated" / "interventions.yaml")
    assert found.problems == []


# ---------------------------------------------------------------------------------------------
# Which reports appear


def test_only_approved_valid_reports_and_hand_entries_appear(tmp_path):
    build = build_projects(
        records(), curated(tmp_path), index(), today=TODAY, limits=LIMITS, repo=REPO
    )
    shown = [p.id for p in build.projects]
    assert sorted(shown) == ["h2025_0001", "r101", "r102", "r109", "r118", "r119"]
    # Newest first.
    assert shown[0] == "r118"
    reasons = {o.ref: o.reason for o in build.held}
    assert reasons["issue #103"] == "it does not carry the approval label"
    assert "in the future" in reasons["issue #104"]
    assert "not ticked" in reasons["issue #105"]
    assert reasons["issue #106"] == "the place is outside Philadelphia"
    assert "keeps it off the map" in reasons["issue #107"]
    assert reasons["issue #108"] == "it does not carry the approval label"
    assert "could not be read as the project form" in reasons["issue #110"]
    assert "changed it after it was approved" in reasons["issue #111"]
    assert reasons["issue #112"] == "it was closed as not planned"
    assert "parcel 999999999 is not in the City's property list" in reasons["issue #113"]
    assert "address could not be found" in reasons["issue #114"]
    assert reasons["issue #115"] == "it does not carry the approval label"
    assert "repeats issue #101" in reasons["issue #116"]
    assert "looks wrong" in reasons["issue #117"]
    assert reasons["entry h2025_0002"] == "the place is outside Philadelphia"
    assert "keeps it off the map" in reasons["entry h2024_0003"]

    by_id = {p.id: p for p in build.projects}
    garden = by_id["r101"]
    assert garden.parcel == "371000001" and garden.address == "2931 N LAWRENCE ST"
    assert garden.kind == "garden" and garden.finished == "2026-05"
    assert garden.approved == "2026-06-02"
    assert garden.group == "Lawrence Street Growers"
    assert (
        garden.note
        == "Twelve neighbors, four Saturdays, about $300 for soil. Thanks for the shovels!"
    )
    assert garden.link == f"https://github.com/{REPO}/issues/101"
    cleanup = by_id["r102"]
    assert (
        cleanup.parcel == "881000100" and cleanup.note == "Call me at or write to join next time."
    )
    assert by_id["r109"].group == "Block Club site"
    assert by_id["r119"].parcel == "371000002" and by_id["r119"].kind == "seating"
    hand = by_id["h2025_0001"]
    assert hand.parcel is None and hand.address == "Wall at Lawrence and Cambria"
    assert hand.link == "https://example.org/mural-news" and hand.issue is None

    notes = build.notes
    assert notes[0] == f"{NOTE_PREFIX}6 on the map, 9 kept off for a problem named below"
    assert any("issue #101: a photo and a GitHub user name left out" in n for n in notes)
    assert any("issue #102: an email address and a phone number left out" in n for n in notes)
    assert any("issue #114 is approved but stays off the map" in n for n in notes)
    # Reports the owner took down on purpose, or never approved, are not in the notes.
    assert not any("#107" in n or "#103" in n or "#112" in n for n in notes)
    assert all(n.startswith(NOTE_PREFIX) for n in notes)


def test_a_month_already_begun_counts_and_a_report_without_the_property_list_waits(tmp_path):
    reports = [r for r in records() if r["issue"] == 118]
    assert [
        p.id for p in build_projects(reports, CuratedProjects(), index(), today=TODAY).projects
    ] == ["r118"]
    before = build_projects(reports, CuratedProjects(), index(), today=date(2026, 9, 30))
    assert not before.projects and "in the future" in before.held[0].reason
    missing = build_projects(reports, CuratedProjects(), None, today=TODAY)
    assert not missing.projects and "property list was not in this build" in missing.held[0].reason


def test_a_link_to_another_repository_is_never_published(tmp_path):
    reports = [dict(r) for r in records() if r["issue"] == 118]
    reports[0]["url"] = "https://github.com/someone-else/placekeepers/issues/118"
    build = build_projects(reports, CuratedProjects(), index(), today=TODAY, repo=REPO)
    assert build.projects[0].link is None


# ---------------------------------------------------------------------------------------------
# Publishing


def install_sources(ctx, reports: list[dict[str, Any]] | None = None) -> None:
    from placekeepers.adapters.projects import reports_table

    install_snapshot(
        ctx,
        "project_reports",
        reports_table(records() if reports is None else reports),
        geometry=False,
        fetched_at="2026-10-21T14:00:00Z",
    )
    install_snapshot(
        ctx, "opa_properties", opa_table(), geometry=False, fetched_at="2026-10-21T14:00:00Z"
    )
    # One lot on the City's vacant land list, so the rest of the weekly publish has a parcel.
    land = pa.table(
        {
            "opa_id": ["371000001"],
            "bldg_desc": ["VAC LAND RES < ACRE"],
            "geometry": [shapely.to_wkb(box(-75.1386, 39.9951, -75.1384, 39.9952), flavor="iso")],
        }
    )
    install_snapshot(
        ctx, "vacant_indicators_land", land, geometry=True, fetched_at="2026-10-21T14:00:00Z"
    )
    tracts = pa.table(
        {"geoid": ["42101000100"], "geometry": [shapely.to_wkb(LIMITS, flavor="iso")]}
    )
    install_snapshot(
        ctx, "census_tracts_2020", tracts, geometry=True, fetched_at="2026-10-21T14:00:00Z"
    )


@pytest.fixture
def project_ctx(context_factory, repo_copy):
    (repo_copy / "data" / "curated" / "interventions.yaml").write_text(CURATED, encoding="utf-8")
    ctx = context_factory(now=NOW, repo_root=repo_copy)
    install_sources(ctx)
    return ctx


def published_text(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): path.read_text(encoding="utf-8", errors="replace")
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


#: The only links a published file may hold about a project: the report itself, or a hand
#: entry's public source.
ALLOWED_LINK = re.compile(
    r"https://github\.com/holdTheDoorHoid/placekeepers/issues/\d+|https://example\.org/mural-news"
)


def assert_private(files: dict[str, str]) -> None:
    """No GitHub user name, title, photo link, contact detail or permission answer beyond the
    links to the reports, in any published file."""
    assert files
    for name, text in files.items():
        if not (name.startswith("tables/projects") or name.startswith("tiles/projects")):
            continue
        rest = ALLOWED_LINK.sub("", text)
        for word in (
            *REPORTERS,
            "holdTheDoorHoid",
            "user-attachments",
            "githubusercontent",
            "spam.example.com",
            "Ana Lopez",
            "555-0123",
            "ben.sample@example.com",
            "No, or not sure",
            "Yes, from the owner",
            "@",
            "http",
        ):
            assert word not in rest, f"{word!r} reached {name}"


def test_the_weekly_publish_writes_the_layer_and_the_table(project_ctx, tmp_path):
    out = tmp_path / "data"
    result = publish(project_ctx, out)
    table = json.loads((out / "tables/projects.json").read_text(encoding="utf-8"))
    assert table["schema"] == 1 and table["as_of"] == "2026-10-21"
    assert [p["id"] for p in table["projects"]] == [
        "r118",
        "r102",
        "r109",
        "r101",
        "h2025_0001",
        "r119",
    ]
    first = table["projects"][0]
    assert set(first) == {
        "id",
        "issue",
        "kind",
        "finished",
        "approved",
        "parcel",
        "address",
        "lng",
        "lat",
        "group",
        "note",
        "link",
    }
    layer = out / "tiles/projects.projects.geojson"
    features = json.loads(layer.read_text(encoding="utf-8"))["features"]
    props = {f["properties"]["id"]: f["properties"] for f in features}
    assert props["r101"] == {
        "id": "r101",
        "k": 2,
        "f": "2026-05",
        "p": "371000001",
        "a": "2931 N LAWRENCE ST",
        "g": "Lawrence Street Growers",
        "n": "Twelve neighbors, four Saturdays, about $300 for soil. Thanks for the shovels!",
        "l": f"https://github.com/{REPO}/issues/101",
    }
    manifest = result.manifest
    assert "tables/projects.json" in manifest["files"]
    assert "tiles/projects.projects.geojson" in manifest["files"]
    assert manifest["layers"]["projects"]["sources"] == ["project_reports", "project_corrections"]
    assert any(n.startswith(f"{NOTE_PREFIX}6 on the map") for n in manifest["notes"])
    # The project inputs for a quick publish: parcels and points only, nothing about owners.
    inputs = project_ctx.cache.root / "derived" / "project_inputs"
    parcels = pa.parquet.read_table(inputs / "parcel_index.parquet")
    assert parcels.column_names == ["parcel_number", "location", "lat", "lng"]
    assert (inputs / "city_limits.geojson").is_file()
    assert_private(published_text(out))


def test_without_reports_there_is_no_table_so_no_lot_says_none_were_reported(
    context_factory, tmp_path
):
    ctx = context_factory(now=NOW)
    install_sources(ctx)
    store = SnapshotStore(ctx.cache, "project_reports")
    shutil.rmtree(store.dir)
    out = tmp_path / "data"
    result = publish(ctx, out)
    assert not (out / "tables/projects.json").exists()
    assert any("could not be read yet" in n for n in result.manifest["notes"])


def weekly_root(tmp_path: Path, ctx) -> Path:
    out = tmp_path / "data"
    publish(ctx, out)
    return out


def test_a_quick_publish_replaces_only_the_projects(project_ctx, tmp_path):
    out = weekly_root(tmp_path, project_ctx)
    inputs = project_ctx.cache.root / "derived" / "project_inputs"
    before = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    other = {name: entry for name, entry in before["files"].items() if "projects" not in name}
    # The owner approves 114 after fixing it, and takes 101 down: only 102 and 118 stay, with the
    # hand entry and 119.
    reports = [r for r in records() if r["issue"] in (102, 118, 119)]
    index_, limits = read_inputs(inputs)
    later = datetime(2026, 10, 22, 9, 30, tzinfo=UTC)
    build = refresh_projects(
        out,
        reports,
        registry=project_ctx.registry,
        repo_root=project_ctx.settings.repo_root,
        index=index_,
        limits=limits,
        now=later,
        today=date(2026, 10, 22),
        attribution="test",
    )
    assert sorted(p.id for p in build.projects) == ["h2025_0001", "r102", "r118", "r119"]
    after = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert {n: e for n, e in after["files"].items() if "projects" not in n} == other
    assert after["build_id"] == before["build_id"]
    assert after["generated_at"] == before["generated_at"]
    status = after["sources"]["project_reports"]
    assert status["status"] == "ok" and status["last_success"] == "2026-10-22T09:30:00Z"
    assert status["rows"] == 3
    project_notes = [n for n in after["notes"] if n.startswith(NOTE_PREFIX)]
    assert project_notes[0] == f"{NOTE_PREFIX}4 on the map, 1 kept off for a problem named below"
    assert [n for n in after["notes"] if not n.startswith(NOTE_PREFIX)] == [
        n for n in before["notes"] if not n.startswith(NOTE_PREFIX)
    ]
    table = json.loads((out / "tables/projects.json").read_text(encoding="utf-8"))
    assert [p["id"] for p in table["projects"]] == ["r118", "r102", "h2025_0001", "r119"]
    for name in ("tables/projects.json", "tiles/projects.projects.geojson"):
        entry = after["files"][name]
        assert entry["bytes"] == (out / name).stat().st_size
    assert_private(published_text(out))
    assert "| issue #102 | Yes |" in summary_markdown(build)


def test_a_quick_publish_with_nothing_approved_takes_the_layer_down(project_ctx, tmp_path):
    out = weekly_root(tmp_path, project_ctx)
    (project_ctx.settings.repo_root / "data" / "curated" / "interventions.yaml").write_text(
        "[]\n", encoding="utf-8"
    )
    index_, limits = read_inputs(project_ctx.cache.root / "derived" / "project_inputs")
    build = refresh_projects(
        out,
        [],
        registry=project_ctx.registry,
        repo_root=project_ctx.settings.repo_root,
        index=index_,
        limits=limits,
        now=NOW,
        today=TODAY,
        attribution="test",
    )
    assert build.projects == []
    after = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    assert "tiles/projects.projects.geojson" not in after["files"]
    assert not (out / "tiles/projects.projects.geojson").exists()
    assert json.loads((out / "tables/projects.json").read_text())["projects"] == []
    assert "projects has nothing to show yet" in after["notes"]
    assert "No report carries the approval label yet." in summary_markdown(build)


def test_pk_projects_publishes_from_a_saved_reply(project_ctx, tmp_path, monkeypatch, capsys):
    out = weekly_root(tmp_path, project_ctx)
    saved = tmp_path / "reports.json"
    saved.write_text(json.dumps(records()), encoding="utf-8")
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("PK_REPO", str(project_ctx.settings.repo_root))
    code = main(
        [
            "projects",
            "--data",
            str(out),
            "--issues-file",
            str(saved),
            "--inputs",
            str(project_ctx.cache.root / "derived" / "project_inputs"),
            "--summary",
            str(summary),
            "--as-of",
            "2026-10-21",
            "--cache",
            str(project_ctx.cache.root),
        ]
    )
    assert code == 0
    text = summary.read_text(encoding="utf-8")
    assert "6 on the map." in text
    assert "| issue #114 | No: the address could not be found" in text
    assert "neighbor-ana" not in text and "neighbor-ana" not in capsys.readouterr().out


def test_pk_projects_refuses_a_folder_without_a_weekly_publish(tmp_path, monkeypatch):
    saved = tmp_path / "reports.json"
    saved.write_text("[]", encoding="utf-8")
    inputs = tmp_path / "inputs"
    opa = tmp_path / "opa.parquet"
    pa.parquet.write_table(opa_table(), opa)
    write_inputs(inputs, opa, LIMITS)
    code = main(
        [
            "projects",
            "--data",
            str(tmp_path / "empty"),
            "--issues-file",
            str(saved),
            "--inputs",
            str(inputs),
            "--cache",
            str(tmp_path / "cache"),
        ]
    )
    assert code == 1


# ---------------------------------------------------------------------------------------------
# The adapters and the registry


def graphql_server(calls: list[httpx.Request]):
    replies = iter(pages())

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.url == "https://api.github.com/graphql"
        return httpx.Response(200, json=next(replies))

    return handle


def test_the_reports_source_reads_github_with_the_token_and_keeps_no_user_name(
    context_factory, monkeypatch
):
    monkeypatch.setenv("GITHUB_TOKEN", "test-token")
    calls: list[httpx.Request] = []
    ctx = context_factory(now=NOW, handler=graphql_server(calls))
    source = ctx.registry.sources["project_reports"]
    fetched = fetch_source(ctx, source, force=True)
    assert fetched.outcome == "downloaded", fetched.detail
    assert calls[0].headers["Authorization"] == "Bearer test-token"
    assert calls[0].headers["User-Agent"].startswith("Placekeepers/")
    raw = next((ctx.cache.root / "raw" / "project_reports").rglob("issues.json"))
    assert not any(name in raw.read_text() for name in REPORTERS)
    checked = validate_source(ctx, source)
    assert checked.outcome == "ok", checked.detail
    table = pa.parquet.read_table(
        next((ctx.cache.root / "snapshots" / "project_reports").glob("2*.parquet"))
    )
    assert table.num_rows == 19
    assert "permission" not in table.column_names and "title" not in table.column_names


def test_without_a_token_the_reports_source_says_so(context_factory, monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)
    assert github_token() is None
    ctx = context_factory(now=NOW)
    result = fetch_source(ctx, ctx.registry.sources["project_reports"], force=True)
    assert result.outcome == "failed" and "GITHUB_TOKEN" in result.detail


def test_the_corrections_source_checks_the_curated_file(context_factory, repo_copy):
    (repo_copy / "data" / "curated" / "interventions.yaml").write_text(CURATED, encoding="utf-8")
    ctx = context_factory(now=NOW, repo_root=repo_copy)
    source = ctx.registry.sources["project_corrections"]
    assert fetch_source(ctx, source, force=True).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"


def test_the_reports_adapter_reads_the_github_issues_kind(context_factory):
    ctx = context_factory(now=NOW)
    adapter = ProjectReports(ctx.registry.sources["project_reports"], ctx)
    assert adapter.endpoint.repo == REPO and adapter.endpoint.label == LABEL


def test_a_github_issues_endpoint_must_name_a_repository_and_a_label(repo_copy):
    path = repo_copy / "registry" / "sources.yaml"
    text = path.read_text(encoding="utf-8")
    path.write_text(
        text.replace("repo: holdTheDoorHoid/placekeepers, label", "repo: not a repo, label"),
        encoding="utf-8",
    )
    with pytest.raises(RegistryError):
        load_registry(repo_copy / "registry", repo_root=repo_copy)


def test_points_from_the_city_limits_file_round_trip(tmp_path):
    opa = tmp_path / "opa.parquet"
    pa.parquet.write_table(opa_table(), opa)
    write_inputs(tmp_path / "inputs", opa, LIMITS)
    index_, limits = read_inputs(tmp_path / "inputs")
    assert index_ is not None and limits is not None
    assert limits.covers(Point(-75.1385, 39.9951))
    assert not limits.covers(Point(-75.10, 39.70))


# ---------------------------------------------------------------------------------------------
# The workflows: read only tokens wherever packages run, and no secret


def workflow(name: str) -> dict[str, Any]:
    return yaml.safe_load((REPO_ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8"))


def test_the_quick_publish_runs_packages_only_with_read_tokens_and_uses_no_secret():
    text = (REPO_ROOT / ".github" / "workflows" / "projects.yml").read_text(encoding="utf-8")
    assert "secrets." not in text
    flow = workflow("projects.yml")
    assert flow["permissions"] == {}
    # PyYAML reads the key `on` as True.
    events = flow[True]
    assert set(events["issues"]["types"]) == {
        "labeled",
        "unlabeled",
        "edited",
        "closed",
        "reopened",
        "deleted",
    }
    assert "workflow_dispatch" in events
    assert flow["concurrency"] == {"group": "projects", "cancel-in-progress": False}
    jobs = flow["jobs"]
    assert jobs["build"]["permissions"] == {"contents": "read", "issues": "read", "actions": "read"}
    assert "project-approved" in jobs["build"]["if"]
    assert jobs["site"]["permissions"] == {"contents": "read"}
    assert jobs["deploy"]["permissions"] == {"pages": "write", "id-token": "write"}
    # Only deploy can write, and it runs nothing but the Pages action.
    assert [step.get("uses", "").split("@")[0] for step in jobs["deploy"]["steps"]] == [
        "actions/deploy-pages"
    ]
    # The site is built from the same commit as the weekly data it publishes.
    checkout = jobs["site"]["steps"][0]
    assert checkout["with"]["ref"] == "${{ needs.build.outputs.sha }}"


def test_the_weekly_refresh_reads_issues_with_a_read_only_token_and_keeps_the_inputs():
    jobs = workflow("refresh.yml")["jobs"]
    assert jobs["pipeline"]["permissions"] == {"contents": "read", "issues": "read"}
    steps = {step.get("name"): step for step in jobs["pipeline"]["steps"]}
    assert steps["Fetch, check and publish"]["env"]["GITHUB_TOKEN"] == "${{ github.token }}"
    assert steps["Hand over the site data"]["with"]["retention-days"] == 14
    inputs = steps["Hand over the project inputs"]["with"]
    assert inputs["name"] == "project-inputs"
    assert inputs["path"].endswith("/derived/project_inputs")
    assert inputs["retention-days"] == 14
