"""The registry check: the real registry passes, and typical mistakes fail with clear messages."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest
import yaml

from placekeepers.cli import main
from placekeepers.registry import RegistryError, load_registry

from .conftest import REPO_ROOT


def edit(repo: Path, name: str, change: Callable[[list[dict[str, Any]]], None]) -> None:
    path = repo / "registry" / f"{name}.yaml"
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    change(data)
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def problems(repo: Path) -> list[str]:
    with pytest.raises(RegistryError) as caught:
        load_registry(repo / "registry", repo_root=repo)
    return caught.value.problems


def by_id(entries: list[dict[str, Any]], entry_id: str) -> dict[str, Any]:
    return next(entry for entry in entries if entry["id"] == entry_id)


def test_the_real_registry_passes() -> None:
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    assert "shootings" in registry.sources
    assert registry.layers["shootings_hex"].settings[0].default == "m12"


def test_a_layer_without_a_description_fails(repo_copy: Path) -> None:
    edit(repo_copy, "layers", lambda layers: by_id(layers, "hin_2025").update(description="  "))
    assert problems(repo_copy) == [
        "registry/layers.yaml: entry 2 (hin_2025): description: must not be empty"
    ]


def test_a_layer_missing_the_description_key_fails(repo_copy: Path) -> None:
    edit(repo_copy, "layers", lambda layers: by_id(layers, "hin_2025").pop("description"))
    assert problems(repo_copy) == [
        "registry/layers.yaml: entry 2 (hin_2025): missing key 'description'"
    ]


def test_an_unknown_key_fails(repo_copy: Path) -> None:
    edit(repo_copy, "sources", lambda sources: by_id(sources, "shootings").update(licence="x"))
    assert problems(repo_copy) == [
        "registry/sources.yaml: entry 5 (shootings): unknown key 'licence'"
    ]


def test_an_unknown_nested_key_fails(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "sources",
        lambda sources: by_id(sources, "shootings")["health"].update(max_age=3),
    )
    assert problems(repo_copy) == [
        "registry/sources.yaml: entry 5 (shootings): health: unknown key 'max_age'"
    ]


def test_a_dangling_source_reference_fails(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "shootings_hex").update(sources=["shooting_victims"]),
    )
    assert problems(repo_copy) == [
        "registry/layers.yaml: shootings_hex: source 'shooting_victims' is not in "
        "registry/sources.yaml"
    ]


def test_a_layer_needs_at_least_one_source(repo_copy: Path) -> None:
    edit(repo_copy, "layers", lambda layers: by_id(layers, "hin_2025").update(sources=[]))
    assert len(problems(repo_copy)) == 1


def test_a_source_needs_a_known_license_and_an_attribution(repo_copy: Path) -> None:
    def change(sources: list[dict[str, Any]]) -> None:
        by_id(sources, "shootings").update(license="city_terms_v2")
        by_id(sources, "pwd_parcels").pop("attribution")

    edit(repo_copy, "sources", change)
    assert problems(repo_copy) == [
        "registry/sources.yaml: entry 2 (pwd_parcels): missing key 'attribution'",
        "registry/sources.yaml: shootings: license 'city_terms_v2' is not in "
        "registry/licenses.yaml",
    ]


def test_other_cross_references_are_checked(repo_copy: Path) -> None:
    edit(repo_copy, "layers", lambda layers: by_id(layers, "hin_2025").update(group="street"))

    def suggestions(entries: list[dict[str, Any]]) -> None:
        by_id(entries, "clean_and_green")["routes"].append("adverse_possession")
        by_id(entries, "clean_and_green")["partners"].append("mural_arts")

    edit(repo_copy, "suggestions", suggestions)

    edit(
        repo_copy,
        "lenses",
        lambda entries: by_id(entries, "violence")["presets"][0]["weights"].update(heat=2),
    )
    assert sorted(problems(repo_copy)) == [
        "registry/layers.yaml: hin_2025: group 'street' is not in registry/groups.yaml",
        "registry/lenses.yaml: violence: preset 'research' weights unknown factor 'heat'",
        "registry/suggestions.yaml: clean_and_green: partner 'mural_arts' is not in "
        "registry/partners.yaml",
        "registry/suggestions.yaml: clean_and_green: route 'adverse_possession' is not in "
        "registry/routes.yaml",
    ]


def test_lens_factor_fields_must_be_well_formed(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "lenses",
        lambda entries: by_id(entries, "violence")["factors"][1].update(field="shootings"),
    )
    [problem] = problems(repo_copy)
    assert problem.startswith(
        "registry/lenses.yaml: entry 1 (violence): factors.1.field: "
        "'shootings' does not match the expected form"
    )


def test_the_violence_lens_refuses_factors_without_violence_evidence(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "lenses",
        lambda entries: by_id(entries, "violence")["factors"][3].update(evidence="not_violence"),
    )
    assert problems(repo_copy) == [
        "registry/lenses.yaml: violence: factor 'canopy_gap' has no violence evidence and cannot "
        "be in the violence lens"
    ]


def test_a_choice_default_must_be_an_option(repo_copy: Path) -> None:
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "shootings_hex")["settings"][0].update(default="m24"),
    )
    [problem] = problems(repo_copy)
    assert "default 'm24' is not one of the options ['m12', 'm36']" in problem


def test_repeated_ids_and_repeated_yaml_keys_fail(repo_copy: Path) -> None:
    edit(repo_copy, "partners", lambda partners: partners.append(dict(partners[0])))
    path = repo_copy / "registry" / "groups.yaml"
    path.write_text(
        path.read_text().replace("  label: Boundaries\n", "  label: Boundaries\n  label: Edges\n"),
        encoding="utf-8",
    )
    found = problems(repo_copy)
    assert "registry/partners.yaml: entry 7 (phs): id 'phs' is used more than once" in found
    assert any(
        item.startswith("registry/groups.yaml: not valid YAML") and "appears twice" in item
        for item in found
    )


def test_an_unknown_registry_file_fails(repo_copy: Path) -> None:
    (repo_copy / "registry" / "layer.yaml").write_text("[]\n", encoding="utf-8")
    [problem] = problems(repo_copy)
    assert problem.startswith("registry/layer.yaml: unknown registry file")


def test_pk_registry_check_exits_non_zero_with_the_problems(
    repo_copy: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("PK_REPO", str(repo_copy))
    assert main(["registry", "check"]) == 0
    assert "The registry is valid" in capsys.readouterr().out

    edit(repo_copy, "layers", lambda layers: by_id(layers, "hin_2025").update(description=""))
    assert main(["registry", "check"]) == 1
    error = capsys.readouterr().err
    assert "The registry has 1 problem(s):" in error
    assert "hin_2025): description: must not be empty" in error


SETTING_CASES = [
    ({"type": "toggle", "default": True}, None),
    ({"type": "range", "min": 0, "max": 10, "default": 5, "step": 0.5}, None),
    ({"type": "choice", "default": "", "options": [{"value": "", "label": "None"}]}, None),
    (
        {"type": "toggle", "default": True, "options": [{"value": "x", "label": "X"}]},
        "a toggle setting cannot have options",
    ),
    ({"type": "toggle", "default": "yes"}, "a toggle default must be true or false"),
    ({"type": "range", "max": 10, "default": 1}, "a range setting needs min and max"),
    ({"type": "range", "min": 10, "max": 10, "default": 10}, "a range setting needs min below max"),
    ({"type": "range", "min": 0, "max": 10, "default": 11}, "default 11 is outside 0 to 10"),
    ({"type": "range", "min": 0, "max": 10, "default": 1, "step": 0}, "step must be above 0"),
    ({"type": "range", "min": 0, "max": 9, "default": 1, "options": []}, "List should have"),
    (
        {"type": "choice", "default": "x", "options": [{"value": "x", "label": "X"}], "min": 1},
        "a choice setting cannot have min",
    ),
    ({"type": "choice", "default": "x"}, "a choice setting needs options"),
]


@pytest.mark.parametrize(("setting", "problem"), SETTING_CASES)
def test_setting_keys_follow_their_type(
    repo_copy: Path, setting: dict, problem: str | None
) -> None:
    """The same rules as the web app's check (docs/CONTRACTS.md section 1)."""
    edit(
        repo_copy,
        "layers",
        lambda layers: by_id(layers, "hin_2025").update(
            settings=[{"id": "test", "label": "Test", **setting}]
        ),
    )
    if problem is None:
        load_registry(repo_copy / "registry", repo_root=repo_copy)
    else:
        [found] = problems(repo_copy)
        assert found.startswith("registry/layers.yaml: entry 2 (hin_2025): settings.0")
        assert problem in found


def test_app_options_are_checked_like_settings(repo_copy: Path) -> None:
    """registry/options.yaml: app wide options with a description (docs/CONTRACTS.md section 1)."""
    registry = load_registry(repo_copy / "registry", repo_root=repo_copy)
    assert registry.options["live_city_data"].default is True

    edit(repo_copy, "options", lambda options: options[0].update(default="on", colour="red"))
    found = problems(repo_copy)
    assert "registry/options.yaml: entry 1 (live_city_data): unknown key 'colour'" in found

    edit(repo_copy, "options", lambda options: options[0].pop("colour"))
    [found] = problems(repo_copy)
    assert "a toggle default must be true or false" in found


def test_an_openstreetmap_extract_needs_both_a_url_and_tags(repo_copy: Path) -> None:
    def drop_tags(sources: list[dict[str, Any]]) -> None:
        by_id(sources, "osm_philadelphia")["endpoint"].pop("tags")

    edit(repo_copy, "sources", drop_tags)
    [problem] = problems(repo_copy)
    assert "osm_philadelphia" in problem
    assert "an extract with a url needs tags" in problem


def test_tags_without_a_url_and_odd_tags_fail(repo_copy: Path) -> None:
    def change(sources: list[dict[str, Any]]) -> None:
        by_id(sources, "basemap_openstreetmap")["endpoint"]["tags"] = ["amenity=bench"]
        endpoint = by_id(sources, "osm_philadelphia")["endpoint"]
        endpoint["tags"] = ["highway=bus_stop", "amenity = bench", "highway=bus_stop"]

    edit(repo_copy, "sources", change)
    found = problems(repo_copy)
    assert any("basemap_openstreetmap" in p and "tags need a url" in p for p in found)
    assert any("osm_philadelphia" in p and "'amenity = bench'" in p for p in found)


def test_the_base_map_extract_needs_no_keys() -> None:
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    base = registry.sources["basemap_openstreetmap"].endpoint
    assert (base.url, base.tags) == (None, [])
    osm = registry.sources["osm_philadelphia"].endpoint
    assert osm.url.endswith("pennsylvania-latest.osm.pbf")
    assert "highway=bus_stop" in osm.tags


def test_a_layer_guide_must_be_a_content_page(repo_copy: Path) -> None:
    edit(
        repo_copy, "layers", lambda layers: by_id(layers, "stop_amenities").update(guide="no-such")
    )
    assert problems(repo_copy) == [
        "registry/layers.yaml: stop_amenities: guide page content/no-such.md does not exist"
    ]
    edit(repo_copy, "layers", lambda layers: by_id(layers, "stop_amenities").update(guide="../x"))
    assert any("'../x' does not match" in p for p in problems(repo_copy))
