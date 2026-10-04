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
