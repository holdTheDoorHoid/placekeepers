"""The street safety lens: crash coding, street segments, and the lens factors.

Crash coding (docs/CONTRACTS.md, `crashes`):

* `sev`, the worst injury in the crash: 3 someone was killed, 2 a suspected serious injury
  (PennDOT called it a "major injury" before 2016), 1 any other injury, 0 no injury or unknown.
* `m`, who was involved, as bit flags: 1 someone walking, 2 someone cycling, 4 someone on a
  motorcycle, 8 someone on a scooter. PennDOT's public crash data has no scooter field, so only
  the Police Department's fatal crash records (memorials) ever set 8.

Street segments come from the City's street centerlines. A crash belongs to the block it happened
on: a crash at a corner (within CORNER_METERS of an intersection) counts for every block that
meets there, and any other crash counts for the nearest block within NEAREST_METERS.

Lens factors (docs/CONTRACTS.md, lenses), each an integer from 0 to 100:

* `f_hin`     100 when the block is on the High Injury Network, else 0
* `f_ksi_vru` the share of blocks citywide with fewer people killed or seriously injured while
              walking or cycling in the five most recent years of PennDOT records
* `f_fatal2`  100 when someone was killed on the block in the last two years (Police records)
* `f_school`  100 when a school is within 400 meters, else 0

A yes or no factor is 100 or 0. A count factor is the share of blocks with a lower count, so a
block with none gets 0 and the block with the most gets 100. A factor whose data is missing is left
out of the block's properties, so the map leaves it out of the average instead of counting it as 0.
"""

from __future__ import annotations

import bisect
import calendar
import math
import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date

import numpy as np
import pyarrow as pa
import shapely
from pyproj import Transformer
from shapely import STRtree

# Severity codes (CONTRACTS.md, crashes.sev)
SEV_NONE, SEV_INJURY, SEV_SERIOUS, SEV_FATAL = 0, 1, 2, 3

# Mode bits (CONTRACTS.md, crashes.m and memorials.m)
MODE_WALK, MODE_BIKE, MODE_MOTORCYCLE, MODE_SCOOTER = 1, 2, 4, 8
#: People walking, cycling or riding a scooter: the memorials shown by default.
VULNERABLE_MODES = MODE_WALK | MODE_BIKE | MODE_SCOOTER

#: Street classes that carry traffic (the City's centerline CLASS codes): expressways, major and
#: minor arterials, collectors, local streets, and low and high speed ramps. Driveways, walkways,
#: paths that cannot be driven and the City boundary are left out.
TRAVEL_CLASSES = frozenset({1, 2, 3, 4, 5, 9, 10})

#: PennDOT places 99.8 percent of crashes within 30 meters of a street; the Police place their
#: points less precisely (96 percent within 60 meters), so they may reach a little further.
NEAREST_METERS = 30.0
POLICE_NEAREST_METERS = 60.0
CORNER_METERS = 10.0
SCHOOL_METERS = 400.0
#: A block is on the High Injury Network when at least half of the points spread along it lie
#: within this distance of the network's lines.
HIN_BUFFER_METERS = 12.0
HIN_SHARE = 0.5
HIN_SAMPLES = 10
KSI_YEARS = 5
FATAL_MONTHS = 24

# Philadelphia in meters: UTM zone 18 north.
METRIC_CRS = "EPSG:32618"
_TO_METERS = Transformer.from_crs("EPSG:4326", METRIC_CRS, always_xy=True)

# A generous box around Philadelphia. Points outside it are data errors.
PHILLY_LAT = (39.80, 40.20)
PHILLY_LNG = (-75.35, -74.90)


def in_philadelphia(lat: float | None, lng: float | None) -> bool:
    return (
        lat is not None
        and lng is not None
        and PHILLY_LAT[0] <= lat <= PHILLY_LAT[1]
        and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]
    )


def _n(value: int | None) -> int:
    return value if isinstance(value, int) and value > 0 else 0


# ---------------------------------------------------------------------------------------------
# Crash coding


def crash_severity(
    max_severity_level: int | None,
    fatal_count: int | None = None,
    serious_injury_count: int | None = None,
    injury_count: int | None = None,
) -> int:
    """PennDOT's worst injury code and counts, as `sev` (3 fatal, 2 serious, 1 injury, 0 none).

    PennDOT codes MAX_SEVERITY_LEVEL as 0 no injury, 1 killed, 2 suspected serious (before 2016:
    major) injury, 3 suspected minor (moderate), 4 possible (minor), 8 injury of unknown severity,
    9 unknown. The counts back the code up when it is missing or disagrees.
    """
    level = max_severity_level
    if level == 1 or _n(fatal_count):
        return SEV_FATAL
    if level == 2 or _n(serious_injury_count):
        return SEV_SERIOUS
    if level in (3, 4, 8) or _n(injury_count):
        return SEV_INJURY
    return SEV_NONE


def crash_modes(
    ped_count: int | None, bicycle_count: int | None, motorcycle_count: int | None
) -> int:
    """Who was involved in a PennDOT crash, as `m` bit flags."""
    modes = 0
    if _n(ped_count):
        modes |= MODE_WALK
    if _n(bicycle_count):
        modes |= MODE_BIKE
    if _n(motorcycle_count):
        modes |= MODE_MOTORCYCLE
    return modes


# The Police write the two units involved as free text. Motorized two wheelers are checked first,
# so "Dirt-bike" or "Motor Scooter" never count as cycling or a scooter.
_MOTORCYCLE = re.compile(
    r"\bm\s*/\s*c\b|motor\s*-?\s*cycle|motorbike|motor\s*-?\s*bike|dirt\s*-?\s*bike|"
    r"mini\s*-?\s*bike|moped|motor\s*-?\s*scooter"
)
_WALK = re.compile(r"\bped(estrian)?s?\b")
_BIKE = re.compile(r"\b(e\s*-?\s*)?(bicycl\w*|bike|bikes)\b")
_SCOOTER = re.compile(r"\b(e\s*-?\s*)?scooters?\b")


def police_mode(text: str | None) -> int:
    """Mode bits for one unit as the Police wrote it, such as "Pedestrian", "Bicycle" (used until
    2022), "Bicyclist" (from 2023), "E-Scooter", "M/C" or "Auto"."""
    if not text:
        return 0
    lowered = " ".join(text.lower().split())
    modes = 0
    if _MOTORCYCLE.search(lowered):
        modes |= MODE_MOTORCYCLE
        lowered = _MOTORCYCLE.sub(" ", lowered)
    if _WALK.search(lowered):
        modes |= MODE_WALK
    if _BIKE.search(lowered):
        modes |= MODE_BIKE
    if _SCOOTER.search(lowered):
        modes |= MODE_SCOOTER
    return modes


def police_modes(veh1: str | None, veh2: str | None) -> int:
    """Mode bits for a Police fatal crash record, from both units involved."""
    return police_mode(veh1) | police_mode(veh2)


# ---------------------------------------------------------------------------------------------
# Percentiles


def percentile_rank(values: Sequence[float]) -> list[int]:
    """For each value, the share of all values that are strictly lower, as 0 to 100.

    The lowest values get 0; the highest get close to 100 (exactly 100 once rounded, unless many
    places tie for the top)."""
    if not values:
        return []
    ordered = sorted(values)
    total = len(ordered)
    return [int(math.floor(100 * bisect.bisect_left(ordered, v) / total + 0.5)) for v in values]


def yes_no(flag: bool) -> int:
    return 100 if flag else 0


def plural(n: int, one: str, many: str) -> str:
    """ "1 crash has" or "3 crashes have", for notes people read."""
    return f"{n:,} {one if n == 1 else many}"


# ---------------------------------------------------------------------------------------------
# Combining the crash slices


@dataclass(frozen=True)
class Crash:
    crn: int | None
    year: int
    sev: int
    modes: int
    #: people walking or cycling who were killed or seriously injured
    vru_ksi: int
    lat: float
    lng: float


@dataclass
class CombinedCrashes:
    crashes: list[Crash]
    #: year -> the slice it came from
    owners: dict[int, str]
    notes: list[str] = field(default_factory=list)

    @property
    def years(self) -> list[int]:
        return sorted(self.owners)

    @property
    def newest_year(self) -> int | None:
        return max(self.owners) if self.owners else None


def _column(table: pa.Table, name: str) -> list:
    return table.column(name).to_pylist() if name in table.column_names else [None] * len(table)


def _points(table: pa.Table) -> list[tuple[float | None, float | None]]:
    out: list[tuple[float | None, float | None]] = []
    for wkb in _column(table, "geometry"):
        if wkb is None:
            out.append((None, None))
            continue
        point = shapely.from_wkb(bytes(wkb))
        if point.is_empty or point.geom_type != "Point":
            out.append((None, None))
        else:
            out.append((point.y, point.x))
    return out


def combine_slices(slices: Sequence[tuple[str, pa.Table]]) -> CombinedCrashes:
    """Every crash once. Each year comes from the newest slice that covers it (later slices revise
    earlier years), and a crash record number appearing in two slices is counted once."""
    years: dict[str, set[int]] = {}
    for slice_id, table in slices:
        years[slice_id] = {y for y in _column(table, "crash_year") if isinstance(y, int)}
    order = sorted(
        (slice_id for slice_id, _ in slices),
        key=lambda s: (max(years[s], default=0), min(years[s], default=0)),
        reverse=True,
    )
    owners: dict[int, str] = {}
    for slice_id in order:
        for year in sorted(years[slice_id]):
            owners.setdefault(year, slice_id)

    tables = dict(slices)
    seen: set[int] = set()
    crashes: list[Crash] = []
    unplaced = 0
    repeated = 0
    for slice_id in order:
        table = tables[slice_id]
        columns = {
            name: _column(table, name)
            for name in (
                "crn",
                "crash_year",
                "max_severity_level",
                "fatal_count",
                "serious_injury_count",
                "injury_count",
                "ped_count",
                "bicycle_count",
                "motorcycle_count",
                "ped_death_count",
                "ped_serious_injury_count",
                "bicycle_death_count",
                "bicycle_serious_injury_count",
            )
        }
        points = _points(table)
        for i, (lat, lng) in enumerate(points):
            year = columns["crash_year"][i]
            if not isinstance(year, int) or owners.get(year) != slice_id:
                continue
            crn = columns["crn"][i]
            if crn is not None:
                if crn in seen:
                    repeated += 1
                    continue
                seen.add(crn)
            if not in_philadelphia(lat, lng):
                unplaced += 1
                continue
            vru_ksi = sum(
                _n(columns[name][i])
                for name in (
                    "ped_death_count",
                    "ped_serious_injury_count",
                    "bicycle_death_count",
                    "bicycle_serious_injury_count",
                )
            )
            crashes.append(
                Crash(
                    crn=crn,
                    year=year,
                    sev=crash_severity(
                        columns["max_severity_level"][i],
                        columns["fatal_count"][i],
                        columns["serious_injury_count"][i],
                        columns["injury_count"][i],
                    ),
                    modes=crash_modes(
                        columns["ped_count"][i],
                        columns["bicycle_count"][i],
                        columns["motorcycle_count"][i],
                    ),
                    vru_ksi=vru_ksi,
                    lat=lat,
                    lng=lng,
                )
            )
    notes = []
    if unplaced:
        notes.append(f"{plural(unplaced, 'crash has', 'crashes have')} no usable location")
    if repeated:
        notes.append(
            f"{plural(repeated, 'crash record appears', 'crash records appear')} in two of the "
            "City's slices and is counted once"
        )
    return CombinedCrashes(crashes, owners, notes)


def ksi_window(newest_year: int | None, years: Iterable[int]) -> list[int]:
    """The five most recent crash years we have, newest last."""
    present = sorted(set(years))
    if newest_year is None:
        return []
    return [y for y in present if y > newest_year - KSI_YEARS]


# ---------------------------------------------------------------------------------------------
# The street network


def to_meters(geometries: np.ndarray) -> np.ndarray:
    """Longitude and latitude geometries, projected to meters."""

    def project(coords: np.ndarray) -> np.ndarray:
        x, y = _TO_METERS.transform(coords[:, 0], coords[:, 1])
        return np.column_stack([x, y])

    return shapely.transform(geometries, project)


def points_in_meters(lats: Sequence[float], lngs: Sequence[float]) -> np.ndarray:
    return to_meters(shapely.points(np.asarray(lngs, dtype=float), np.asarray(lats, dtype=float)))


@dataclass
class StreetNetwork:
    """Street segments that carry traffic, with spatial indexes in meters."""

    ids: list[int]
    names: list[str]
    classes: list[int | None]
    responsible: list[str | None]
    #: the segment lines in longitude and latitude (for publishing)
    lines: np.ndarray
    #: the same lines in meters
    lines_m: np.ndarray
    tree: STRtree
    #: intersections: points in meters, and the segments that meet at each
    corners_m: np.ndarray
    corner_segments: list[list[int]]
    corner_tree: STRtree

    @classmethod
    def from_table(cls, table: pa.Table) -> StreetNetwork:
        ids: list[int] = []
        names: list[str] = []
        classes: list[int | None] = []
        responsible: list[str | None] = []
        lines: list = []
        seen: set[int] = set()
        for seg_id, name, klass, resp, wkb in zip(
            _column(table, "seg_id"),
            _column(table, "stname"),
            _column(table, "class"),
            _column(table, "responsibl"),
            _column(table, "geometry"),
            strict=True,
        ):
            if seg_id is None or wkb is None or seg_id in seen:
                continue
            if klass not in TRAVEL_CLASSES:
                continue
            line = shapely.from_wkb(bytes(wkb))
            if line.is_empty:
                continue
            seen.add(seg_id)
            ids.append(int(seg_id))
            names.append(" ".join((name or "").split()))
            classes.append(klass)
            responsible.append(resp.strip().upper() if isinstance(resp, str) else None)
            lines.append(line)
        lines_arr = np.array(lines, dtype=object)
        lines_m = to_meters(lines_arr) if len(lines_arr) else lines_arr
        corners_m, corner_segments = _corners(lines_m, names)
        return cls(
            ids=ids,
            names=names,
            classes=classes,
            responsible=responsible,
            lines=lines_arr,
            lines_m=lines_m,
            tree=STRtree(lines_m),
            corners_m=corners_m,
            corner_segments=corner_segments,
            corner_tree=STRtree(corners_m),
        )

    def __len__(self) -> int:
        return len(self.ids)

    def blocks_for(self, points_m: np.ndarray, nearest: float = NEAREST_METERS) -> list[list[int]]:
        """For each point, the segments it belongs to: every segment meeting at a corner within
        CORNER_METERS, otherwise the nearest segment within `nearest` meters, otherwise none."""
        result: list[list[int]] = [[] for _ in range(len(points_m))]
        if len(points_m) == 0 or len(self) == 0:
            return result
        if len(self.corners_m):
            hit, corner = self.corner_tree.query_nearest(
                points_m, max_distance=CORNER_METERS, all_matches=False
            )
            for point_index, corner_index in zip(hit.tolist(), corner.tolist(), strict=True):
                result[point_index] = list(self.corner_segments[corner_index])
        rest = np.array([i for i, segs in enumerate(result) if not segs], dtype=int)
        if len(rest):
            hit, segment = self.tree.query_nearest(
                points_m[rest], max_distance=nearest, all_matches=False
            )
            for local, segment_index in zip(hit.tolist(), segment.tolist(), strict=True):
                result[int(rest[local])] = [int(segment_index)]
        return result

    def nearest_segment(self, points_m: np.ndarray, max_distance: float) -> list[int | None]:
        """For each point, the single nearest segment within `max_distance`, or None."""
        result: list[int | None] = [None] * len(points_m)
        if len(points_m) == 0 or len(self) == 0:
            return result
        hit, segment = self.tree.query_nearest(
            points_m, max_distance=max_distance, all_matches=False
        )
        for point_index, segment_index in zip(hit.tolist(), segment.tolist(), strict=True):
            result[point_index] = int(segment_index)
        return result

    def near_corner(self, points_m: np.ndarray, max_distance: float) -> list[bool]:
        if len(points_m) == 0 or len(self.corners_m) == 0:
            return [False] * len(points_m)
        hit, _ = self.corner_tree.query_nearest(
            points_m, max_distance=max_distance, all_matches=False
        )
        flags = [False] * len(points_m)
        for index in hit.tolist():
            flags[index] = True
        return flags


def _corners(lines_m: np.ndarray, names: list[str]) -> tuple[np.ndarray, list[list[int]]]:
    """Intersections: segment ends shared by three or more segments, or by two segments of
    different streets. A street that simply continues, or bends, is not an intersection."""
    ends: dict[tuple[float, float], list[int]] = {}
    for index, line in enumerate(lines_m):
        if line.geom_type == "MultiLineString":
            parts = list(line.geoms)
            first, last = parts[0].coords[0], parts[-1].coords[-1]
        else:
            first, last = line.coords[0], line.coords[-1]
        for x, y, *_ in (first, last):
            key = (round(x, 1), round(y, 1))
            members = ends.setdefault(key, [])
            if index not in members:
                members.append(index)
    points = []
    members_list = []
    for (x, y), members in ends.items():
        streets = {names[i] for i in members}
        if len(members) >= 3 or (len(members) == 2 and len(streets) == 2):
            points.append(shapely.Point(x, y))
            members_list.append(sorted(members))
    return np.array(points, dtype=object), members_list


# ---------------------------------------------------------------------------------------------
# Lens factors per segment


def hin_membership(network: StreetNetwork, hin_lines: Sequence) -> list[bool]:
    """Whether each segment lies mostly along the High Injury Network: at least HIN_SHARE of
    HIN_SAMPLES points spread along the segment are within HIN_BUFFER_METERS of the network's
    lines. Cross streets touch the network only at their ends, so they are left out."""
    flags = [False] * len(network)
    lines = [line for line in hin_lines if line is not None and not line.is_empty]
    if not lines or len(network) == 0:
        return flags
    hin_tree = STRtree(to_meters(np.array(lines, dtype=object)))
    fractions = (np.arange(HIN_SAMPLES) + 0.5) / HIN_SAMPLES
    samples = shapely.line_interpolate_point(
        np.repeat(network.lines_m, HIN_SAMPLES), np.tile(fractions, len(network)), normalized=True
    )
    near, _ = hin_tree.query(samples, predicate="dwithin", distance=HIN_BUFFER_METERS)
    counts = np.bincount(np.unique(near) // HIN_SAMPLES, minlength=len(network))
    return [bool(c >= HIN_SHARE * HIN_SAMPLES) for c in counts.tolist()]


def schools_near(network: StreetNetwork, school_points_m: np.ndarray) -> list[bool]:
    """Whether a school lies within SCHOOL_METERS of each segment."""
    flags = [False] * len(network)
    if len(school_points_m) == 0 or len(network) == 0:
        return flags
    _, segments = network.tree.query(school_points_m, predicate="dwithin", distance=SCHOOL_METERS)
    for index in set(segments.tolist()):
        flags[index] = True
    return flags


def count_on_blocks(
    network: StreetNetwork,
    points_m: np.ndarray,
    weights: Sequence[int],
    nearest: float = NEAREST_METERS,
) -> tuple[list[int], int]:
    """Sum `weights` (for example people hurt) onto the blocks each point belongs to. Returns the
    totals per segment and how many points matched no block."""
    totals = [0] * len(network)
    unmatched = 0
    for blocks, weight in zip(network.blocks_for(points_m, nearest), weights, strict=True):
        if not blocks:
            unmatched += 1
            continue
        for index in blocks:
            totals[index] += weight
    return totals, unmatched


@dataclass
class SegmentFactors:
    """Everything the `segments` layer publishes for each segment, in network order."""

    hin: list[bool] | None
    ksi: list[int] | None
    killed2: list[int] | None
    school: list[bool] | None
    notes: list[str] = field(default_factory=list)

    def properties(self, network: StreetNetwork, index: int) -> dict:
        props: dict = {"id": network.ids[index], "name": network.names[index]}
        klass = network.classes[index]
        if klass is not None:
            props["cls"] = klass
        if self.hin is not None:
            props["hin"] = int(self.hin[index])
            props["f_hin"] = yes_no(self.hin[index])
        if self.ksi is not None:
            props["ksi"] = self.ksi[index]
            props["f_ksi_vru"] = self._ksi_rank[index]
        if self.killed2 is not None:
            props["k2"] = self.killed2[index]
            props["f_fatal2"] = yes_no(self.killed2[index] > 0)
        if self.school is not None:
            props["sch"] = int(self.school[index])
            props["f_school"] = yes_no(self.school[index])
        return props

    def __post_init__(self) -> None:
        self._ksi_rank = percentile_rank(self.ksi) if self.ksi is not None else []


def fatal_window_start(as_of: date) -> date:
    """The start of the two year window for "someone was killed here", counted back from the
    build date (exclusive)."""
    index = as_of.year * 12 + (as_of.month - 1) - FATAL_MONTHS
    year, month = divmod(index, 12)
    month += 1
    return date(year, month, min(as_of.day, calendar.monthrange(year, month)[1]))


def describe_years(years: Sequence[int]) -> str:
    if not years:
        return "no years"
    if len(years) == 1:
        return str(years[0])
    return f"{min(years)} to {max(years)}"
