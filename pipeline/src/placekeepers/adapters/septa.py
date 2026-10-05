"""SEPTA's schedules (GTFS) and its stop ridership counts (the "stop summaries").

**Schedules** (`septa_gtfs`). https://www3.septa.org/developer/gtfs_public.zip is one zip holding
two GTFS feeds: `google_bus.zip` (bus, trolley, trackless trolley, and SEPTA Metro's subway and El)
and `google_rail.zip` (Regional Rail). SEPTA keeps that link pointing at its newest release (also
published at github.com/septadev/GTFS); its Last-Modified date becomes `source_date`. Checked on
2026-10-04: release v202609270 of 2026-09-25, 22 MB, 13,495 bus and Metro boarding places and 156
Regional Rail stations, good from 2026-09-27 (bus) to 2027-02-20 (Regional Rail to 2026-10-17).

The timetables are far too big to keep (2.1 million stop times), so the snapshot keeps what the map
needs, worked out by placekeepers.derive.transit (method in docs/TRANSIT_METHOD.md):

* one row per boarding place (`kind` "stop"): its Placekeepers `key`, SEPTA `stop_id`, name,
  point, modes (bits: 1 bus, 2 trolley, 4 subway or El, 8 Regional Rail), the routes that stop
  there, and for a typical weekday (`_wk`), Saturday (`_sa`) and Sunday (`_su`): departures
  (`trips`), the first and last departure (`first`, `last`, minutes after midnight of the service
  day, so 1530 is 1:30 at night), departures in the busiest hour (`busiest`), from 7 to 9 in the
  morning (`peak`), from 10 to 2 (`midday`), from 8 at night (`evening`) and from 1 to 4 at
  night (`night`); and the stop's history: `former_ids` (earlier SEPTA ids, newest first) and
  `history` (each with its name, the day it was replaced and how far it stood), `key_since`;
* one row per stop id that disappeared in the last year without a successor (`kind` "retired",
  with `retired_on`), so a returning id keeps its key and a late successor can still be linked;
* one row per route (`kind` "route"): `route_id`, `route_name`, `route_long_name`, modes,
  trips per day, and departures in the peak and midday windows where the route runs most often,
  with the lines its trips follow.

Every row also carries the dates used for the typical days (`weekday_date`, `saturday_date`,
`sunday_date`), the feed's `feed_version`, and `source_date`.

Keys carry over from the previous good snapshot (placekeepers.derive.transit.assign_keys), so the
history grows week by week. Without an earlier snapshot every stop starts again from its SEPTA id.

**Ridership** (`septa_ridership_bus`, `septa_ridership_trolley`). SEPTA publishes average daily
boardings ("ons") and alightings ("offs") per route, direction and stop for each schedule period
as separate layers in its ArcGIS folder, named like `Spring_2026_Stop_Summary_Bus` or
`Fall_2025_Stop_Summary_(Bus)`. Each run lists that folder and takes the newest spring or fall
layer for the mode (summer counts are lower and miss school trips: 369,013 weekday boardings in
Summer 2026 against 414,543 in Spring 2026), never older than the layer the registry names, which
is used when the folder cannot be read. `Stop_Code` is the SEPTA stop id at the time of the count.
`source_date` is the day SEPTA last edited the layer's data; `layer` names the layer used.
"""

from __future__ import annotations

import logging
import re
import shutil
import tempfile
import zipfile
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, ClassVar
from urllib.parse import quote

import pyarrow as pa
import pyarrow.parquet as pq
import shapely
from shapely.geometry import Point

from placekeepers.adapters.arcgis import ArcgisAdapter, check_arcgis
from placekeepers.adapters.base import FetchError
from placekeepers.adapters.url import UrlAdapter
from placekeepers.cache import RawFetch
from placekeepers.config import local_date, parse_iso_z
from placekeepers.derive.transit import (
    DAYS,
    MEASURES,
    FeedSummary,
    GtfsError,
    KeyedStop,
    assign_keys,
    summarize_feed,
)
from placekeepers.geo import write_geoparquet
from placekeepers.httpclient import AccessRefused
from placekeepers.snapshots import SnapshotStore

log = logging.getLogger(__name__)

#: The GTFS files the summary reads; nothing else is unpacked.
GTFS_FILES = (
    "feed_info.txt",
    "calendar.txt",
    "calendar_dates.txt",
    "routes.txt",
    "trips.txt",
    "stops.txt",
    "stop_times.txt",
    "shapes.txt",
)

HISTORY_TYPE = pa.list_(
    pa.struct(
        [
            ("stop_id", pa.string()),
            ("stop_name", pa.string()),
            ("until", pa.date32()),
            ("meters", pa.float64()),
        ]
    )
)


def feed_name(member: str) -> str:
    """Which feed an inner zip holds: Regional Rail when its name says rail."""
    return "rail" if "rail" in Path(member).name.lower() else "bus_metro"


def _extract(archive: zipfile.ZipFile, dest: Path) -> list[str]:
    """Unpack the GTFS files we read (and nothing else, wherever they sit in the zip)."""
    dest.mkdir(parents=True, exist_ok=True)
    found = []
    for info in archive.infolist():
        name = Path(info.filename).name
        if name in GTFS_FILES and not info.is_dir():
            with archive.open(info) as src, (dest / name).open("wb") as out:
                shutil.copyfileobj(src, out, 1 << 20)
            found.append(name)
    return found


def unpack_feeds(path: Path, dest: Path) -> list[tuple[str, Path]]:
    """The GTFS feeds in SEPTA's zip: each inner zip is one feed. A zip with GTFS files at its
    top level is read as one feed of buses and Metro."""
    feeds: list[tuple[str, Path]] = []
    try:
        outer = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise FetchError(f"The download is not a zip file: {exc}") from exc
    with outer:
        inner = [i for i in outer.infolist() if i.filename.lower().endswith(".zip")]
        for info in sorted(inner, key=lambda i: i.filename):
            name = feed_name(info.filename)
            if any(existing == name for existing, _ in feeds):
                raise FetchError(f"The zip holds two {name} feeds")
            folder = dest / name
            with outer.open(info) as handle, zipfile.ZipFile(handle) as archive:
                if "stops.txt" in _extract(archive, folder):
                    feeds.append((name, folder))
        if not feeds and "stops.txt" in _extract(outer, dest / "bus_metro"):
            feeds.append(("bus_metro", dest / "bus_metro"))
    if not feeds:
        raise FetchError("The zip holds no GTFS feed (no stops.txt)")
    return feeds


def _previous_stops(rows: list[dict[str, Any]]) -> list[KeyedStop]:
    stops = []
    for row in rows:
        if row.get("kind") not in ("stop", "retired") or not row.get("key"):
            continue
        history = [dict(entry) for entry in (row.get("history") or [])]
        stops.append(
            KeyedStop(
                key=row["key"],
                stop_id=row["stop_id"],
                name=row.get("stop_name") or "",
                lat=row["lat"],
                lng=row["lng"],
                feed=row.get("feed") or "bus_metro",
                since=row.get("key_since") or date.min,
                history=history,
                retired_on=row.get("retired_on"),
            )
        )
    return stops


#: Columns of the snapshot, in order, with their types.
def snapshot_schema() -> pa.Schema:
    fields = [
        ("kind", pa.string()),
        ("feed", pa.string()),
        ("key", pa.string()),
        ("stop_id", pa.string()),
        ("stop_name", pa.string()),
        ("route_id", pa.string()),
        ("route_name", pa.string()),
        ("route_long_name", pa.string()),
        ("lat", pa.float64()),
        ("lng", pa.float64()),
        ("wheelchair", pa.int8()),
        ("parent_station", pa.string()),
        ("modes", pa.int32()),
        ("routes", pa.string()),
        ("route_sort", pa.int32()),
    ]
    for measure in MEASURES:
        for _, suffix in DAYS:
            fields.append((f"{measure}_{suffix}", pa.int32()))
    fields += [
        ("former_ids", pa.list_(pa.string())),
        ("history", HISTORY_TYPE),
        ("key_since", pa.date32()),
        ("retired_on", pa.date32()),
        ("weekday_date", pa.date32()),
        ("saturday_date", pa.date32()),
        ("sunday_date", pa.date32()),
        ("feed_version", pa.string()),
        ("source_date", pa.date32()),
        ("geometry", pa.binary()),
    ]
    return pa.schema(fields)


class SeptaGtfs(UrlAdapter):
    """SEPTA's schedules, kept as service measures per stop and per route (module docstring)."""

    required_columns = (
        "kind",
        "key",
        "stop_id",
        "stop_name",
        "modes",
        "routes",
        "trips_wk",
        "midday_wk",
        "former_ids",
        "source_date",
        "geometry",
    )

    def previous(self) -> list[KeyedStop]:
        """The stops (and retired ids) of the last good snapshot, to carry their keys over."""
        store = SnapshotStore(self.ctx.cache, self.id)
        current = store.current()
        if current is None:
            return []
        path = store.path_for(current)
        try:
            columns = set(pq.read_schema(path).names)
            wanted = ["kind", "feed", "key", "stop_id", "stop_name", "lat", "lng", "history"]
            wanted += [c for c in ("key_since", "retired_on") if c in columns]
            if not set(wanted) <= columns:
                self.notes.append("The last snapshot has no stop keys, so keys start again")
                return []
            rows = pq.read_table(path, columns=wanted).to_pylist()
        except (OSError, pa.ArrowInvalid) as exc:
            self.notes.append(f"The last snapshot could not be read ({exc}), so keys start again")
            return []
        return _previous_stops(rows)

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        fetched = local_date(parse_iso_z(raw.fetched_at))
        summaries: list[FeedSummary] = []
        with tempfile.TemporaryDirectory(prefix="septa-gtfs-", dir=self.ctx.cache.tmp_dir()) as tmp:
            feeds = unpack_feeds(path, Path(tmp))
            con = self.ctx.duckdb()
            try:
                for name, folder in feeds:
                    try:
                        summaries.append(summarize_feed(con, folder, feed=name, start=fetched))
                    except GtfsError as exc:
                        raise FetchError(f"The {name} feed cannot be read: {exc}") from exc
            finally:
                con.close()
        source_date = raw.info.get("source_date")
        if source_date:
            published = date.fromisoformat(source_date)
        else:
            starts = [s.dates.window[0] for s in summaries]
            published = min(starts)
            self.notes.append("The server did not say when the file changed; using its start date")
        rows = self.rows(summaries, fetched, published)
        table = pa.Table.from_pylist(rows, schema=snapshot_schema())
        kinds = sorted(
            {shapely.from_wkb(g).geom_type for g in table.column("geometry").to_pylist() if g}
        )
        write_geoparquet(table, out, kinds)

    def rows(
        self, summaries: list[FeedSummary], fetched: date, published: date
    ) -> list[dict[str, Any]]:
        previous = self.previous()
        rows: list[dict[str, Any]] = []
        missing = {stop.feed for stop in previous} - {summary.feed for summary in summaries}
        for feed in sorted(missing):
            # Its stops start again from their SEPTA numbers when the feed comes back.
            self.notes.append(f"The {feed} feed is missing from this download")
        for summary in summaries:
            common = {
                "feed": summary.feed,
                "weekday_date": summary.dates.dates.get("weekday"),
                "saturday_date": summary.dates.dates.get("saturday"),
                "sunday_date": summary.dates.dates.get("sunday"),
                "feed_version": summary.version,
                "source_date": published,
            }
            self.notes.extend(f"{summary.feed}: {note}" for note in summary.notes)
            keyed = assign_keys(
                previous, [stop.place() for stop in summary.stops], feed=summary.feed, today=fetched
            )
            for stop, identity in zip(summary.stops, keyed.current, strict=True):
                row = {
                    **common,
                    "kind": "stop",
                    "key": identity.key,
                    "stop_id": stop.stop_id,
                    "stop_name": stop.name,
                    "lat": stop.lat,
                    "lng": stop.lng,
                    "wheelchair": stop.wheelchair,
                    "parent_station": stop.parent_station,
                    "modes": stop.modes,
                    "routes": ",".join(stop.routes),
                    "former_ids": identity.former_ids,
                    "history": identity.history,
                    "key_since": identity.since,
                    "geometry": shapely.to_wkb(Point(stop.lng, stop.lat), flavor="iso"),
                }
                for _, suffix in DAYS:
                    for measure in MEASURES:
                        row[f"{measure}_{suffix}"] = stop.days.get(suffix, {}).get(measure)
                rows.append(row)
            for stop in keyed.retired:
                rows.append(
                    {
                        **common,
                        "kind": "retired",
                        "key": stop.key,
                        "stop_id": stop.stop_id,
                        "stop_name": stop.name,
                        "lat": stop.lat,
                        "lng": stop.lng,
                        "former_ids": stop.former_ids,
                        "history": stop.history,
                        "key_since": stop.since,
                        "retired_on": stop.retired_on,
                        "geometry": shapely.to_wkb(Point(stop.lng, stop.lat), flavor="iso"),
                    }
                )
            for route in summary.routes:
                row = {
                    **common,
                    "kind": "route",
                    "key": route.route_id,
                    "route_id": route.route_id,
                    "route_name": route.short_name,
                    "route_long_name": route.long_name,
                    "modes": route.modes,
                    "route_sort": route.sort if route.sort < 2**31 else None,
                    "geometry": (
                        shapely.to_wkb(route.geometry, flavor="iso") if route.geometry else None
                    ),
                }
                for _, suffix in DAYS:
                    for measure in ("trips", "peak", "midday"):
                        row[f"{measure}_{suffix}"] = route.days.get(suffix, {}).get(measure)
                rows.append(row)
            served = sum(1 for s in summary.stops if any(d.get("trips") for d in s.days.values()))
            dates = ", ".join(
                f"{kind} {day.isoformat()}" for kind, day in summary.dates.dates.items()
            )
            self.notes.append(
                f"{summary.feed} {summary.version or ''}: {len(summary.stops):,} stops "
                f"({served:,} with service on the typical days: {dates}), "
                f"{len(summary.routes)} routes, {len(keyed.links)} renumbered stops linked, "
                f"{len(keyed.retired)} retired stop numbers remembered"
            )
            for stop, old_id, link in keyed.links:
                log.info(
                    "%s: stop %s replaces %s (%s m, names %s alike): key %s",
                    self.id,
                    stop.stop_id,
                    old_id,
                    link.meters,
                    link.similarity,
                    stop.key,
                )
        return rows


# ---------------------------------------------------------------------------------------------
# Ridership

SEASONS = {"spring": 1, "summer": 2, "fall": 3}
#: SEPTA's layer names, such as Spring_2026_Stop_Summary_Bus or Fall_2022_Stop_Summary_(Bus)_v2.
_LAYER_NAME = re.compile(
    r"^(?P<season>spring|summer|fall)_(?P<year>\d{4})_stop_summary_\(?(?P<mode>[a-z0-9]+)\)?"
    r"(?:_v(?P<version>\d+))?$",
    re.IGNORECASE,
)


def layer_rank(name: str, mode: str) -> tuple[int, int, int] | None:
    """(year, season, version) of a spring or fall stop summary for `mode`, or None for any other
    layer (summer counts included: they are lower and miss school trips)."""
    found = _LAYER_NAME.match(name)
    if not found or found.group("mode").lower() != mode.lower():
        return None
    season = found.group("season").lower()
    if season == "summer":
        return None
    return int(found.group("year")), SEASONS[season], int(found.group("version") or 1)


def newest_layer(names: list[str], mode: str, floor: str) -> str:
    """The newest spring or fall stop summary for `mode` among `names`, never older than `floor`
    (the layer the registry names)."""
    best = floor
    best_rank = layer_rank(floor, mode) or (0, 0, 0)
    for name in names:
        rank = layer_rank(name, mode)
        if rank is not None and rank > best_rank:
            best, best_rank = name, rank
    return best


class SeptaStopRidership(ArcgisAdapter):
    """One mode's newest spring or fall stop summary (module docstring)."""

    #: the mode in SEPTA's layer names: Bus or Trolley
    mode: ClassVar[str] = "Bus"
    out_fields = (
        "FID",
        "Mode",
        "Route",
        "Direction",
        "Stop_Code",
        "Stop",
        "Lat",
        "Lon",
        "Sign_Up",
        "WK_Ons",
        "WK_Offs",
        "Sat_Ons",
        "Sat_Offs",
        "Sun_Ons",
        "Sun_Offs",
    )
    required_columns = (
        "route",
        "stop_code",
        "stop",
        "sign_up",
        "wk_ons",
        "sat_ons",
        "sun_ons",
        "layer",
        "source_date",
        "geometry",
    )

    def __init__(self, source, ctx):
        super().__init__(source, ctx)
        self.layer_name = self.endpoint.service

    @property
    def layer_url(self) -> str:
        root = self.endpoint.url or self.root
        return f"{root}/{quote(self.layer_name)}/FeatureServer/{self.endpoint.layer}"

    def choose_layer(self) -> str:
        """List SEPTA's folder and pick the newest spring or fall count for this mode. A refusal
        stops the download; any other trouble falls back to the registry's layer."""
        root = self.endpoint.url or self.root
        try:
            listing = self.ctx.http.get_json(root, {"f": "json"}, check=check_arcgis)
        except AccessRefused:
            raise
        except Exception as exc:  # the registry's layer still works
            self.notes.append(f"SEPTA's list of layers could not be read ({exc})")
            return self.endpoint.service
        names = [
            str(service.get("name") or "")
            for service in (listing.get("services") or [])
            if isinstance(service, dict)
        ]
        return newest_layer(names, self.mode, self.endpoint.service)

    def fetch(self, dest: Path) -> dict[str, Any]:
        self.layer_name = self.choose_layer()
        if self.layer_name != self.endpoint.service:
            log.info(
                "%s: SEPTA has a newer count than the registry names: %s", self.id, self.layer_name
            )
        info = super().fetch(dest)
        info["layer"] = self.layer_name
        return info

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        table = pq.read_table(out)
        edited = raw.info.get("data_last_edit")
        if edited is None:
            raise FetchError("The layer does not say when its data was last edited")
        day = local_date(datetime.fromtimestamp(edited / 1000, UTC))
        layer = raw.info.get("layer") or self.endpoint.service
        codes = [
            None if value is None else str(int(value))
            for value in table.column("stop_code").to_pylist()
        ]
        table = table.set_column(
            table.schema.get_field_index("stop_code"), "stop_code", pa.array(codes, pa.string())
        )
        table = table.append_column("layer", pa.array([layer] * table.num_rows, pa.string()))
        table = table.append_column("source_date", pa.array([day] * table.num_rows, pa.date32()))
        signups = sorted({s for s in table.column("sign_up").to_pylist() if s})
        self.notes.append(f"{layer}: {table.num_rows:,} rows, counted in {', '.join(signups)}")
        metadata = (pq.read_schema(out).metadata or {}).get(b"geo")
        write = table.replace_schema_metadata({b"geo": metadata} if metadata else None)
        pq.write_table(write, out, compression="zstd")


class SeptaRidershipBus(SeptaStopRidership):
    mode = "Bus"


class SeptaRidershipTrolley(SeptaStopRidership):
    mode = "Trolley"


__all__ = [
    "SeptaGtfs",
    "SeptaRidershipBus",
    "SeptaRidershipTrolley",
    "feed_name",
    "layer_rank",
    "newest_layer",
    "unpack_feeds",
]
