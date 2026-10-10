"""The street safety layers of tiles/streets.pmtiles (docs/CONTRACTS.md section 4).

* `segments`: every street block that carries traffic, with the street safety lens factors
  (`f_hin`, `f_ksi_vru`, `f_fatal2`, `f_school`) and the counts behind them.
* `crashes`: every PennDOT crash from 2015 on, once each, with its year, severity and who was
  involved.
* `memorials`: one quiet marker per person the Police record as killed, with a name only from
  data/curated/memorials.yaml, only once the removal email address exists
  (placekeepers.curated.removal_address), and never anything listed in
  data/curated/suppressed.yaml.

The curated files are read from the repository at publish time, never from a cached copy, so a
removal takes effect at the very next publish, even an offline one.
"""

from __future__ import annotations

import functools
import logging
from datetime import date
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.context import Context
from placekeepers.curated import (
    CuratedError,
    CuratedMemorials,
    read_memorials,
    read_suppressed,
    removal_address,
)
from placekeepers.derive.memorials import (
    STREET_METERS as CALMING_STREET_METERS,
)
from placekeepers.derive.memorials import (
    SUGGESTION_ORDER,
    TRAFFIC_CALMING,
    build_memorials,
    count_by_year_and_mode,
    fatal_records,
)
from placekeepers.derive.street_safety import (
    POLICE_NEAREST_METERS,
    VULNERABLE_MODES,
    SegmentFactors,
    StreetNetwork,
    combine_slices,
    count_on_blocks,
    describe_years,
    fatal_window_start,
    hin_membership,
    ksi_window,
    plural,
    points_in_meters,
    schools_near,
    to_meters,
)
from placekeepers.geo import GeoJSONWriter, geometry_json
from placekeepers.publish.layers import BuildResult, LayerBuilder

log = logging.getLogger(__name__)

STREETS_FILE = "tiles/streets.pmtiles"
#: Newest slice first. A later slice owns the years it covers.
CRASH_SOURCES = ("crashes_2020_2024", "crashes_2016_2020", "crashes_2007_2017")
FATAL_COLUMNS = ["objectid", "date_", "veh1", "veh2", "primary_st", "secondary_", "lat", "lng"]


@functools.lru_cache(maxsize=2)
def _network(path: str, mtime: float) -> StreetNetwork:
    return StreetNetwork.from_table(pq.read_table(path))


def street_network(path: Path) -> StreetNetwork:
    """The street network from a centerline snapshot, built once per publish."""
    return _network(str(path), path.stat().st_mtime)


def _crash_slices(paths: dict[str, Path]) -> list[tuple[str, pa.Table]]:
    return [(source, pq.read_table(paths[source])) for source in CRASH_SOURCES if source in paths]


def _point(lat: float, lng: float) -> dict:
    return {"type": "Point", "coordinates": [round(lng, 6), round(lat, 6)]}


def _fatal_table(path: Path) -> pa.Table:
    return pq.read_table(path, columns=FATAL_COLUMNS)


def _records_from(table: pa.Table):
    column = table.column
    return fatal_records(
        column("date_").to_pylist(),
        column("veh1").to_pylist(),
        column("veh2").to_pylist(),
        column("primary_st").to_pylist(),
        column("secondary_").to_pylist(),
        column("lat").to_pylist(),
        column("lng").to_pylist(),
        column("objectid").to_pylist(),
    )


# Crashes
def build_crashes(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    combined = combine_slices(_crash_slices(paths))
    newest = combined.newest_year
    notes = list(combined.notes)
    crashes = sorted(combined.crashes, key=lambda c: (c.year, c.crn or 0))
    with GeoJSONWriter(out) as writer:
        for crash in crashes:
            properties = {
                "id": crash.crn,
                "y": crash.year,
                "ya": newest - crash.year if newest is not None else 0,
                "sev": crash.sev,
                "m": crash.modes,
            }
            if crash.crn is None:
                del properties["id"]
            writer.write(properties, _point(crash.lat, crash.lng))
    if crashes:
        sources = ", ".join(
            f"{describe_years([y for y, s in combined.owners.items() if s == source])} from "
            f"{source}"
            for source in dict.fromkeys(combined.owners.values())
        )
        notes.append(
            f"crashes: {writer.count:,} PennDOT crashes from {describe_years(combined.years)} "
            f"({sources})"
        )
    return BuildResult(writer.count, notes)


# Street segments and the street safety lens
def build_segments(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    notes: list[str] = []
    if "street_centerlines" not in paths:
        with GeoJSONWriter(out):
            pass
        return BuildResult(0, ["segments: the street centerlines are missing"])
    network = street_network(paths["street_centerlines"])

    hin = None
    if "high_injury_network" in paths:
        table = pq.read_table(paths["high_injury_network"], columns=["geometry"])
        lines = [
            shapely.from_wkb(bytes(wkb)) for wkb in table.column("geometry").to_pylist() if wkb
        ]
        hin = hin_membership(network, lines)
    else:
        notes.append("segments: the High Injury Network is missing; blocks are scored without it")

    ksi = None
    slices = _crash_slices(paths)
    if slices:
        combined = combine_slices(slices)
        window = ksi_window(combined.newest_year, combined.years)
        hurt = [c for c in combined.crashes if c.year in window and c.vru_ksi > 0]
        points = points_in_meters([c.lat for c in hurt], [c.lng for c in hurt])
        ksi, unmatched = count_on_blocks(network, points, [c.vru_ksi for c in hurt])
        people = sum(c.vru_ksi for c in hurt)
        notes.append(
            f"segments: {people:,} people killed or seriously injured walking or cycling in "
            f"{describe_years(window)} (PennDOT)"
            + (
                f"; {plural(unmatched, 'crash is', 'crashes are')} off the mapped streets"
                if unmatched
                else ""
            )
        )
    else:
        notes.append("segments: no PennDOT crash data, so blocks are scored without it")

    killed2 = None
    if "fatal_crashes" in paths:
        records, _ = _records_from(_fatal_table(paths["fatal_crashes"]))
        start = fatal_window_start(as_of)
        recent = [r for r in records if start < r.date <= as_of]
        points = points_in_meters([r.lat for r in recent], [r.lng for r in recent])
        killed2, unmatched = count_on_blocks(
            network, points, [1] * len(recent), POLICE_NEAREST_METERS
        )
        notes.append(
            f"segments: {len(recent)} people killed in traffic crashes after {start.isoformat()} "
            "(Police)"
            + (f"; {plural(unmatched, 'is', 'are')} off the mapped streets" if unmatched else "")
        )
    else:
        notes.append("segments: the Police fatal crash records are missing")

    school = None
    if "schools" in paths:
        table = pq.read_table(paths["schools"], columns=["geometry"])
        found = [shapely.from_wkb(bytes(w)) for w in table.column("geometry").to_pylist() if w]
        found = [g for g in found if not g.is_empty]
        school = schools_near(network, to_meters(np.array(found, dtype=object)))
    else:
        notes.append("segments: the school list is missing; blocks are scored without it")

    # Streets and stops (M4.5): the poles the City lists along each block, its traffic calming,
    # and the request for traffic calming on a High Injury Network block where people were hurt
    # and none is recorded, where the street may qualify.
    from placekeepers.publish.streets_stops import (
        TRAFFIC_CALMING,
        block_calming,
        block_poles,
        calming_properties,
        may_ask_for_calming,
        pole_properties,
    )

    poles = block_poles(paths)
    calming = block_calming(paths)
    allowed = TRAFFIC_CALMING in ctx.registry.suggestions
    asked = waiting = 0
    factors = SegmentFactors(hin=hin, ksi=ksi, killed2=killed2, school=school)
    with GeoJSONWriter(out) as writer:
        for index in range(len(network)):
            props = factors.properties(network, index)
            props.update(pole_properties(poles, index))
            hurt = bool(hin and hin[index] and ksi and ksi[index] > 0)
            props.update(calming_properties(calming, index, hurt))
            if props.get("tc") == 0:
                waiting += 1
                if allowed and may_ask_for_calming(network, index):
                    props["sg"] = TRAFFIC_CALMING
                    asked += 1
            writer.write(props, geometry_json(network.lines[index]))
    notes.append(f"segments: {writer.count:,} street blocks scored for the street safety lens")
    if poles is not None:
        with_poles = sum(1 for n in poles.poles if n)
        lamps = sum(poles.lamps)
        notes.append(
            f"segments: {with_poles:,} blocks have poles the City lists; {lamps:,} poles with a "
            f"lamp, {sum(poles.led):,} of them LED"
        )
    else:
        notes.append("segments: the street poles are missing, so blocks have no pole counts")
    if calming is not None:
        calmed = sum(1 for n in calming.devices if n)
        notes.append(
            f"segments: {calmed:,} blocks have traffic calming the City lists; "
            f"{waiting:,} High Injury Network blocks where people were hurt have none recorded, "
            f"{asked:,} of them residential streets that may qualify for the City's program"
        )
    else:
        notes.append("segments: the traffic calming devices are missing")
    return BuildResult(writer.count, notes)


# Memorials
def build_memorial_layer(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    repo = ctx.settings.repo_root
    try:
        suppressions, problems = read_suppressed(repo)
    except CuratedError as exc:
        # Without a readable removal list we cannot honor removals, so nothing is published.
        with GeoJSONWriter(out):
            pass
        return BuildResult(0, [f"memorials are not published: {exc}"])
    notes = list(problems)
    try:
        curated = read_memorials(repo)
    except CuratedError as exc:
        curated = CuratedMemorials([], [f"no names are shown: {exc}"])
    if curated.entries and removal_address(repo) is None:
        # ETHICS.md promises families that one email takes a name down; until that address
        # exists, no name or memorial page link is published (owner decision, 2026-10-04).
        removed = {item.id for item in suppressions}
        waiting = sum(1 for entry in curated.entries if entry.id not in removed)
        curated = CuratedMemorials(
            [],
            [
                *curated.problems,
                f"memorials: {plural(waiting, 'name waits', 'names wait')} for the removal email "
                "address, so no names are shown yet",
            ],
        )

    records = []
    if "fatal_crashes" in paths:
        records, found = _records_from(_fatal_table(paths["fatal_crashes"]))
        notes.extend(found)
    network = street_network(paths["street_centerlines"]) if "street_centerlines" in paths else None
    allowed = [s for s in SUGGESTION_ORDER if s in ctx.registry.suggestions]
    memorials, found = build_memorials(
        records, curated, suppressions, network=network, suggestion_ids=allowed
    )
    notes.extend(found)
    # Beside the traffic calming request (M4.5): what the City lists on the crash site's block.
    from placekeepers.publish.streets_stops import block_calming

    calming = block_calming(paths)
    if calming is not None and network is not None:
        asking = [m for m in memorials if TRAFFIC_CALMING in m.suggestions]
        points = points_in_meters([m.lat for m in asking], [m.lng for m in asking])
        for memorial, block in zip(
            asking, network.nearest_segment(points, CALMING_STREET_METERS), strict=True
        ):
            devices = calming.devices[block] if block is not None else 0
            memorial.calming = devices
            if devices and calming.first[block] is not None:
                memorial.calming_since = calming.first[block].year
    with GeoJSONWriter(out) as writer:
        for memorial in memorials:
            writer.write(memorial.properties(), _point(memorial.lat, memorial.lng))
    vulnerable = sum(1 for m in memorials if m.modes & VULNERABLE_MODES)
    notes.append(
        f"memorials: {writer.count} people killed in traffic crashes, {vulnerable} of them "
        "walking, cycling or riding a scooter"
    )
    for year, row in count_by_year_and_mode(memorials).items():
        log.info(
            "memorials %s: %s killed, %s walking, %s cycling, %s scooter, %s motorcycle",
            year,
            row["all"],
            row["walking"],
            row["cycling"],
            row["scooter"],
            row["motorcycle"],
        )
    return BuildResult(writer.count, notes)


STREET_BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        STREETS_FILE,
        "segments",
        (
            "street_centerlines",
            "high_injury_network",
            *CRASH_SOURCES,
            "fatal_crashes",
            "schools",
        ),
        build_segments,
        # The poles and the traffic calming the City lists along each block (M4.5).
        extras=("street_poles", "traffic_calming"),
    ),
    LayerBuilder(STREETS_FILE, "crashes", CRASH_SOURCES, build_crashes),
    LayerBuilder(
        STREETS_FILE,
        "memorials",
        ("fatal_crashes", "street_centerlines"),
        build_memorial_layer,
        # What the City lists on the block, beside the traffic calming request (M4.5).
        extras=("traffic_calming",),
    ),
)
