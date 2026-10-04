"""When sources are fetched: frozen and yearly sources wait, a full disk stops downloads, and
sources come after the ones their downloads need."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest

from placekeepers import runner
from placekeepers.adapters.base import Adapter
from placekeepers.candidates import CANDIDATE_SOURCES
from placekeepers.runner import UsageError, fetch_source, ordered, validate_source

from .test_sources import ACS_ROWS, relaxed, tax_file

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=UTC)


def test_a_frozen_source_downloads_once_unless_forced(context_factory) -> None:
    ctx = context_factory(handler=lambda r: httpx.Response(200, content=tax_file()), now=NOW)
    source = relaxed(ctx.registry.sources["cagp_tax_2025"])
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    ctx.settings.fixed_now = NOW + timedelta(days=200)
    again = fetch_source(ctx, source)
    assert (again.outcome, again.detail) == ("skipped", "Frozen source, kept from 2026-10-04")
    assert fetch_source(ctx, source, force=True).outcome == "downloaded"


def test_a_yearly_source_waits_a_month(context_factory) -> None:
    ctx = context_factory(handler=lambda r: httpx.Response(200, text=ACS_ROWS), now=NOW)
    source = relaxed(ctx.registry.sources["acs_poverty"])
    fetch_source(ctx, source)
    validate_source(ctx, source)
    ctx.settings.fixed_now = NOW + timedelta(days=10)
    assert fetch_source(ctx, source).outcome == "skipped"
    ctx.settings.fixed_now = NOW + timedelta(days=31)
    assert fetch_source(ctx, source).outcome == "downloaded"


def test_downloads_stop_when_the_disk_is_nearly_full(context_factory, monkeypatch) -> None:
    monkeypatch.setattr(runner, "free_disk_gb", lambda ctx: 4.2)
    ctx = context_factory(handler=lambda r: httpx.Response(200, text=ACS_ROWS), now=NOW)
    result = fetch_source(ctx, ctx.registry.sources["acs_poverty"])
    assert result.outcome == "failed"
    assert result.detail.startswith("Download skipped: only 4.2 GB of disk is free")


def test_sources_come_after_the_ones_their_downloads_need(context_factory) -> None:
    ctx = context_factory(now=NOW)
    sources = list(reversed(ctx.registry.sources.values()))
    order = [source.id for source in ordered(sources)]
    for dependent in ("real_estate_transfers", "assessment_history", "li_violations"):
        assert all(order.index(needed) < order.index(dependent) for needed in CANDIDATE_SOURCES)
    assert sorted(order) == sorted(ctx.registry.sources)


def test_a_circle_of_needs_is_refused(context_factory, monkeypatch) -> None:
    class First(Adapter):
        depends_on = ("council_districts",)

    class Second(Adapter):
        depends_on = ("neighborhoods",)

    monkeypatch.setitem(runner.ADAPTERS, "neighborhoods", First)
    monkeypatch.setitem(runner.ADAPTERS, "council_districts", Second)
    ctx = context_factory(now=NOW)
    pair = [ctx.registry.sources["neighborhoods"], ctx.registry.sources["council_districts"]]
    with pytest.raises(UsageError, match="depend on each other in a circle"):
        ordered(pair)
