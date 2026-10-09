"""Fetch and validate sources, keeping the last good snapshot whenever anything goes wrong.

`fetch_source` only downloads. `validate_source` normalizes the newest download into a snapshot,
checks it against the source's health rules, and either makes it current or rejects it. A failed
download, an unreadable download and a rejected snapshot all leave the last good snapshot in place;
the source then reports `stale`, or `failing` when there was never a good one.
"""

from __future__ import annotations

import logging
import os
import shutil
import time
from dataclasses import dataclass
from datetime import date, timedelta

from placekeepers.adapters import ADAPTERS, adapter_for
from placekeepers.cache import RawFetch, RawStore, atomic_output, new_fetch_id, sha256_file
from placekeepers.config import iso_z, local_date, parse_iso_z
from placekeepers.context import Context
from placekeepers.geo import is_geoparquet
from placekeepers.health import SourceStatus, failed_summary, source_status
from placekeepers.registry import Registry, Source
from placekeepers.snapshots import SnapshotMeta, SnapshotStore

log = logging.getLogger(__name__)


class UsageError(RuntimeError):
    pass


@dataclass
class StepResult:
    source: str
    step: str
    outcome: str
    detail: str
    seconds: float


def plain_error(exc: BaseException) -> str:
    text = " ".join(str(exc).split()) or type(exc).__name__
    return text if len(text) <= 300 else text[:297] + "..."


def select_sources(registry: Registry, ids: list[str] | None) -> list[Source]:
    if not ids:
        return list(registry.sources.values())
    unknown = [source_id for source_id in ids if source_id not in registry.sources]
    if unknown:
        raise UsageError(
            f"Unknown source id(s): {', '.join(unknown)}. Known: {', '.join(registry.sources)}"
        )
    return [registry.sources[source_id] for source_id in dict.fromkeys(ids)]


# How long a good snapshot is kept before fetching again, by the source's registry cadence. A frozen
# source is fetched once; a yearly one at most monthly. Everything else is fetched on every run,
# unless its adapter sets a minimum wait (`min_refetch`, such as the OpenStreetMap extract's). A
# snapshot made with another recipe (Adapter.recipe, such as the extract's tag list), or with none
# recorded, is fetched again at once whatever the wait, so a registry change reaches the next run.
# A picture service (`arcgis_tiles`, M4.3) is checked on every run whatever its cadence: the 1860
# atlas never changes, but the server it comes from could stop answering any week.
REFETCH_AFTER = {"frozen": None, "yearly": timedelta(days=30)}


def free_disk_gb(ctx: Context) -> float:
    target = ctx.cache.root if ctx.cache.root.exists() else ctx.cache.root.parent
    return shutil.disk_usage(target).free / 1e9


def min_free_gb() -> float:
    """The disk space every download leaves free (CLAUDE.md: keep at least 10 GB free)."""
    return float(os.environ.get("PK_MIN_FREE_GB", "10"))


def refetch_due(ctx: Context, source: Source) -> str | None:
    """None when the source should be fetched now, or the reason it does not need to be."""
    adapter = ADAPTERS.get(source.id)
    floor = adapter.min_refetch if adapter else None
    if source.endpoint.kind == "arcgis_tiles":
        return None
    if source.cadence not in REFETCH_AFTER and floor is None:
        return None
    current = SnapshotStore(ctx.cache, source.id).current()
    if current is None:
        return None
    recipe = adapter(source, ctx).recipe() if adapter else None
    if recipe is not None and current.recipe != recipe:
        log.info(
            "%s: the current copy was made with %s, not what the registry asks for now, so it is "
            "downloaded again",
            source.id,
            "other settings" if current.recipe else "no record of its settings",
        )
        return None
    since = local_date(parse_iso_z(current.fetched_at)).isoformat()
    age = ctx.now() - parse_iso_z(current.fetched_at)
    if source.cadence in REFETCH_AFTER:
        wait = REFETCH_AFTER[source.cadence]
        if wait is None:
            return f"Frozen source, kept from {since}"
        if age < wait:
            return f"Changes yearly; the copy from {since} is recent enough"
    if floor is not None and age < floor:
        reason = adapter.min_refetch_reason if adapter else ""
        return f"The copy from {since} is less than {floor.days} days old, and {reason}"
    return None


def ordered(sources: list[Source]) -> list[Source]:
    """Sources in an order where each comes after the sources its download needs."""
    by_id = {source.id: source for source in sources}
    done: dict[str, Source] = {}

    def visit(source: Source, path: tuple[str, ...]) -> None:
        if source.id in done:
            return
        if source.id in path:
            raise UsageError(f"Sources depend on each other in a circle: {' > '.join(path)}")
        adapter = ADAPTERS.get(source.id)
        for needed in adapter.depends_on if adapter else ():
            if needed in by_id:
                visit(by_id[needed], (*path, source.id))
        done[source.id] = source

    for source in sources:
        visit(source, ())
    return list(done.values())


def _unique_fetch_id(ctx: Context, source_id: str) -> str:
    base = new_fetch_id(ctx.now())
    store = SnapshotStore(ctx.cache, source_id)
    raws = RawStore(ctx.cache, source_id)
    candidate, n = base, 1
    while store.get(candidate) is not None or raws.get(candidate) is not None:
        n += 1
        candidate = f"{base}-{n:02d}"
    return candidate


def fetch_source(ctx: Context, source: Source, *, force: bool = False) -> StepResult:
    started = time.monotonic()

    def result(outcome: str, detail: str) -> StepResult:
        return StepResult(source.id, "fetch", outcome, detail, time.monotonic() - started)

    adapter = adapter_for(source, ctx)
    if adapter is None:
        return result("no_adapter", "No adapter yet")
    if ctx.settings.offline:
        return result("skipped", "Offline run: using the cache")
    if not force:
        reason = refetch_due(ctx, source)
        if reason:
            return result("skipped", reason)
    free = free_disk_gb(ctx)
    if free < min_free_gb():
        message = (
            f"Download skipped: only {free:.1f} GB of disk is free and Placekeepers keeps at least "
            f"{min_free_gb():g} GB free"
        )
        log.error("%s: %s", source.id, message)
        return result("failed", message)

    raws = RawStore(ctx.cache, source.id)
    store = SnapshotStore(ctx.cache, source.id)
    with ctx.cache.lock(source.id):
        state = store.state()
        moment = ctx.now()
        fetch_id = _unique_fetch_id(ctx, source.id)
        partial = raws.begin(fetch_id)
        state.last_attempt = iso_z(moment)
        log.info("%s: downloading", source.id)
        try:
            info = adapter.fetch(partial)
        except Exception as exc:  # every failure leaves the last good snapshot in place
            raws.abort(partial)
            message = f"Download failed: {plain_error(exc)}"
            state.fail("fetch_failed", message)
            store.save_state(state)
            log.error("%s: %s", source.id, message)
            log.debug("%s: details", source.id, exc_info=True)
            return result("failed", message)
        files = sorted(path.name for path in partial.iterdir())
        raw = RawFetch(
            source=source.id, fetch_id=fetch_id, fetched_at=iso_z(moment), files=files, info=info
        )
        raws.commit(partial, raw)
        raws.prune(keep=fetch_id)
        state.pending_fetch = fetch_id
        store.save_state(state)
    rows = info.get("rows")
    return result("downloaded", f"{rows:,} rows" if isinstance(rows, int) else "downloaded")


def _pending(raws: RawStore, store: SnapshotStore) -> RawFetch | None:
    state = store.state()
    if state.pending_fetch:
        raw = raws.get(state.pending_fetch)
        if raw is not None:
            return raw
    raw = raws.latest()
    if raw is not None and store.get(raw.fetch_id) is None:
        return raw
    return None


def validate_source(ctx: Context, source: Source) -> StepResult:
    started = time.monotonic()

    def result(outcome: str, detail: str) -> StepResult:
        return StepResult(source.id, "validate", outcome, detail, time.monotonic() - started)

    adapter = adapter_for(source, ctx)
    if adapter is None:
        return result("no_adapter", "No adapter yet")

    raws = RawStore(ctx.cache, source.id)
    store = SnapshotStore(ctx.cache, source.id)
    with ctx.cache.lock(source.id):
        state = store.state()
        raw = _pending(raws, store)
        if raw is None:
            if state.pending_fetch:
                state.pending_fetch = None
                store.save_state(state)
            return result("nothing_new", "No new download to check")

        path = store.snapshot_path(raw.fetch_id)
        last_good = store.current()
        try:
            log.info("%s: normalizing download %s", source.id, raw.fetch_id)
            with atomic_output(path) as tmp:
                adapter.normalize(raw, tmp)
            validation = adapter.validate(path, last_good)
        except Exception as exc:  # an unreadable download is a failure, not a crash
            path.unlink(missing_ok=True)
            message = f"Could not read the download: {plain_error(exc)}"
            state.fail("error", message)
            state.pending_fetch = None
            store.save_state(state)
            raws.remove(raw.fetch_id)
            log.error("%s: %s", source.id, message)
            log.debug("%s: details", source.id, exc_info=True)
            return result("error", message)

        meta = SnapshotMeta(
            source=source.id,
            snapshot_id=raw.fetch_id,
            file=path.name,
            format="geoparquet" if is_geoparquet(path) else "parquet",
            fetched_at=raw.fetched_at,
            rows=validation.rows,
            sha256=sha256_file(path),
            bytes=path.stat().st_size,
            newest_record=validation.newest.isoformat() if validation.newest else None,
            status="good" if validation.ok else "rejected",
            checks=[check.to_json() for check in validation.checks],
            message=failed_summary(validation.checks),
            columns=validation.columns,
            notes=list(adapter.notes),
            raw_fetch_id=raw.fetch_id,
            recipe=adapter.recipe(),
        )
        store.record(meta)
        if validation.ok:
            store.promote(meta)
            state.current = meta.snapshot_id
            state.last_result = "ok"
            state.message = None
            state.consecutive_failures = 0
            newest = f", newest record {meta.newest_record}" if meta.newest_record else ""
            outcome, detail = "ok", f"{meta.rows:,} rows{newest}"
            log.info("%s: snapshot %s is good (%s)", source.id, meta.snapshot_id, detail)
        else:
            state.fail("rejected", meta.message or "The new download failed its checks")
            if last_good is not None:
                since = local_date(parse_iso_z(last_good.fetched_at)).isoformat()
                fallback = f"Keeping the copy from {since}"
            else:
                fallback = "There is no earlier good copy"
            outcome, detail = "rejected", f"{meta.message}. {fallback}"
            log.error("%s: new download rejected: %s", source.id, detail)
        state.pending_fetch = None
        store.save_state(state)
        store.prune(keep_good=ctx.settings.keep_snapshots)
        raws.remove(raw.fetch_id)
    return result(outcome, detail)


def all_statuses(ctx: Context, sources: list[Source] | None = None) -> list[SourceStatus]:
    chosen = sources if sources is not None else list(ctx.registry.sources.values())
    return [
        source_status(
            source.id, SnapshotStore(ctx.cache, source.id), has_adapter=source.id in ADAPTERS
        )
        for source in chosen
    ]


def derive_vacancy(ctx: Context, as_of: date | None = None) -> StepResult:
    """Run the vacancy model. A failure is reported, never raised, so publishing still happens
    (the map then shows the City's lists alone, and says so)."""
    from placekeepers.derive import vacancy

    started = time.monotonic()
    try:
        result = vacancy.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The vacancy model could not run: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("vacancy", "derive", "failed", message, time.monotonic() - started)
    lots, buildings = result.counts["lot"], result.counts["building"]
    detail = (
        f"lots {lots['high']:,} high, {lots['medium']:,} medium, {lots['low']:,} low; "
        f"buildings {buildings['high']:,} high, {buildings['medium']:,} medium, "
        f"{buildings['low']:,} low; {result.counts['excluded']:,} left out"
    )
    return StepResult("vacancy", "derive", "ok", detail, time.monotonic() - started)


def derive_lenses(ctx: Context, as_of: date | None = None) -> StepResult:
    """Compute the lens factors for the vacancy model's parcels. A failure is reported, never
    raised: the map then shows the parcels without scores."""
    from placekeepers.derive import lenses

    started = time.monotonic()
    try:
        result = lenses.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The lens factors could not be computed: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("lenses", "derive", "failed", message, time.monotonic() - started)
    missing = ", ".join(result.missing_sources)
    detail = f"{result.parcels:,} parcels" + (f"; without {missing}" if missing else "")
    return StepResult("lenses", "derive", "ok", detail, time.monotonic() - started)


def derive_heat(ctx: Context, as_of: date | None = None) -> StepResult:
    """Compute the heat and shade lens factors for the vacancy model's parcels (M3.1). A failure
    is reported, never raised: the map then shows the parcels without heat scores."""
    from placekeepers.derive import heat

    started = time.monotonic()
    try:
        result = heat.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The heat lens factors could not be computed: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("heat", "derive", "failed", message, time.monotonic() - started)
    missing = ", ".join(result.missing_sources)
    detail = f"{result.parcels:,} parcels" + (f"; without {missing}" if missing else "")
    return StepResult("heat", "derive", "ok", detail, time.monotonic() - started)


def derive_walk(ctx: Context, as_of: date | None = None) -> StepResult:
    """Measure what lies within a short walk of the vacancy model's parcels (M3.3): people,
    everyday places, street corners and walkability. A failure is reported, never raised: the
    map then shows the parcels without these factors."""
    from placekeepers.derive import walk

    started = time.monotonic()
    try:
        result = walk.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The walking measures could not be computed: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("walk", "derive", "failed", message, time.monotonic() - started)
    missing = ", ".join(result.missing_sources)
    detail = f"{result.parcels:,} parcels" + (f"; without {missing}" if missing else "")
    return StepResult("walk", "derive", "ok", detail, time.monotonic() - started)


def derive_placemaking(ctx: Context, as_of: date | None = None) -> StepResult:
    """Compute the placemaking lens factors and suggestions for the vacancy model's parcels
    (M3.4), after the walking measures. A failure is reported, never raised: the map then shows
    the parcels without placemaking scores."""
    from placekeepers.derive import placemaking

    started = time.monotonic()
    try:
        result = placemaking.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The placemaking lens factors could not be computed: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("placemaking", "derive", "failed", message, time.monotonic() - started)
    missing = ", ".join(result.missing_sources)
    detail = f"{result.parcels:,} parcels" + (f"; without {missing}" if missing else "")
    return StepResult("placemaking", "derive", "ok", detail, time.monotonic() - started)


def derive_displacement(ctx: Context, as_of: date | None = None) -> StepResult:
    """Measure the displacement watch's signs for every census tract (M4.1). It needs no vacancy
    model. A failure is reported, never raised: every greening card then keeps the one line
    caution, as before the watch existed."""
    from placekeepers.derive import displacement

    started = time.monotonic()
    try:
        result = displacement.run(ctx, as_of)
    except Exception as exc:  # the map must still publish
        message = f"The displacement watch could not be measured: {plain_error(exc)}"
        log.error("derive: %s", message)
        log.debug("derive: details", exc_info=True)
        return StepResult("displacement", "derive", "failed", message, time.monotonic() - started)
    missing = ", ".join(result.missing_sources)
    detail = f"{result.counts['watch']} of {result.counts['tracts']} tracts in the watch" + (
        f"; without {missing}" if missing else ""
    )
    return StepResult("displacement", "derive", "ok", detail, time.monotonic() - started)
