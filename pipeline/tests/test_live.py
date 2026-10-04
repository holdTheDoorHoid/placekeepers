"""Smoke tests against the real City services. Skipped unless asked for: pytest -m live

They send a handful of tiny requests: counts, the HIN layer (162 lines), and one small page.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from placekeepers.adapters.high_injury_network import HighInjuryNetwork
from placekeepers.adapters.opa_properties import OpaProperties
from placekeepers.adapters.shootings import Shootings
from placekeepers.adapters.vacant_indicators import VacantIndicatorsLand
from placekeepers.config import Settings
from placekeepers.context import Context
from placekeepers.registry import load_registry
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import REPO_ROOT

pytestmark = pytest.mark.live


@pytest.fixture
def live(tmp_path: Path) -> Context:
    settings = Settings(repo_root=REPO_ROOT, cache_root=tmp_path / "cache")
    ctx = Context(settings, load_registry(settings.registry_dir, repo_root=REPO_ROOT))
    yield ctx
    ctx.close()


def test_carto_tables_answer_with_the_columns_we_select(live: Context) -> None:
    for adapter_class, source_id, at_least in (
        (Shootings, "shootings", 15_000),
        (OpaProperties, "opa_properties", 550_000),
    ):
        adapter = adapter_class(live.registry.sources[source_id], live)
        assert adapter.count() >= at_least
        # One row with every selected column proves each field name still exists.
        query = adapter.page_query(None).replace("LIMIT 100000", "LIMIT 1")
        data = live.http.get_json(adapter.api_url, {"q": query})
        assert list(data["rows"][0]) == [c.name for c in adapter.columns] + ["_key"]


def test_arcgis_layers_still_have_the_fields_we_need(live: Context) -> None:
    adapter = VacantIndicatorsLand(live.registry.sources["vacant_indicators_land"], live)
    layer = live.http.get_json(adapter.layer_url, {"f": "json"})
    names = {field["name"].lower() for field in layer["fields"]}
    assert {"opa_id", "land_rank", "date_update", "bldg_desc"} <= names
    assert adapter.count() >= 20_000


def test_the_high_injury_network_end_to_end(live: Context) -> None:
    source = live.registry.sources["high_injury_network"]
    assert fetch_source(live, source).outcome == "downloaded"
    assert validate_source(live, source).outcome == "ok"
    current = SnapshotStore(live.cache, source.id).current()
    assert current.rows >= 100
    assert set(HighInjuryNetwork.required_columns) <= set(current.columns)


def test_an_account_chunk_comes_back_by_post(live: Context) -> None:
    from placekeepers.adapters.property_records import RealEstateTransfers

    adapter = RealEstateTransfers(live.registry.sources["real_estate_transfers"], live)
    query = adapter.chunk_query(["371188801", "562313830"])
    rows = live.http.get_json(adapter.api_url, data={"q": query})["rows"]
    assert {row["opa_account_num"] for row in rows} <= {"371188801", "562313830"}
    if rows:
        assert list(rows[0]) == [c.name for c in adapter.columns]


def test_the_partner_garden_layer_answers(live: Context) -> None:
    from placekeepers.adapters.places import GardensPhsNgt

    adapter = GardensPhsNgt(live.registry.sources["gardens_phs_ngt"], live)
    assert adapter.layer_url.startswith("https://services2.arcgis.com/qjOOiLCYeUtwT7x7/")
    assert adapter.count() >= 150


# The vacancy model on the real cache, against the study

STUDY_COUNTS = {  # docs/VACANCY_METHOD.md, run on 2026-10-04
    "lot": {"high": 24_166, "medium": 6_147, "low": 10_465},
    "building": {"high": 6_553, "medium": 2_876, "low": 8_503},
}
TOLERANCE = 0.15  # the data moves every week; a bigger change means something broke


def test_the_vacancy_model_lands_near_the_studys_counts(tmp_path: Path) -> None:
    """Runs the model on the snapshots in $PK_CACHE (download them first with pk all) and prints
    how far each count is from the study's. Writes only to a temporary folder."""
    from placekeepers.derive import vacancy

    settings = Settings.from_env(repo_root=REPO_ROOT)
    ctx = Context(settings, load_registry(settings.registry_dir, repo_root=REPO_ROOT))
    try:
        missing = [s for s in vacancy.SOURCES if SnapshotStore(ctx.cache, s).current() is None]
        if "opa_properties" in missing:
            pytest.skip("no snapshots in the cache yet: run pk all first")
        result = vacancy.run(ctx, out=tmp_path / "vacancy.parquet")
    finally:
        ctx.close()

    print(f"\nVacancy model as of {result.as_of} against the study (2026-10-04):")
    far = []
    for kind, levels in STUDY_COUNTS.items():
        for level, study in levels.items():
            ours = result.counts[kind][level]
            change = (ours - study) / study
            print(f"  {kind:8} {level:6} ours {ours:7,}  study {study:7,}  ({change:+.1%})")
            if abs(change) > TOLERANCE:
                far.append(f"{kind} {level}: {ours:,} against {study:,} ({change:+.1%})")
    print(f"  left out as parks, gardens, parking and similar: {result.counts['excluded']:,}")
    for note in result.notes:
        print(f"  note: {note}")
    assert not missing, f"the model ran without {', '.join(missing)}"
    assert not far, "counts moved more than 15% from the study: " + "; ".join(far)
