"""Parking problems reported with Philly Bike Action's Laser Vision app (issue #37).

People using the app report vehicles blocking a sidewalk, a crosswalk, a corner, a curb ramp or a
bike lane. Philly Bike Action publishes every report as one pin on its public map, through
`https://bikeaction.org/tools/laser/map_data/`: a JSON reply `{"pins": [[lat, lng, 1], ...],
"unique_users_count": N}` with no key and no login. Each pin is already shifted about 15 meters
by Philly Bike Action. Placekeepers shows them, with Philly Bike Action's permission (confirmed by
the owner 2026-10-08), only as counts per block sized cell (placekeepers.publish.laser).

**What is asked, and how politely.** Once a week:

1. the newest day with reports: one small request for yesterday's reports (`date=`), and the day
   before if yesterday had none, up to a week back (a day usually has 70 to 90 reports);
2. the 12 months up to that day, one request per kind of report (`violation=`), a few seconds
   apart. The heavy request for every report ever made is never sent.

The server keeps each answer for 30 seconds and a year of one kind takes a few seconds to build, so
the pause is on top of the client's own spacing. A refused request is never retried or worked
around (placekeepers.httpclient). robots.txt answered 404 (no rules) on 2026-10-08.

**The filters, as Philly Bike Action's code reads them**
(github.com/PhillyBikeAction/bikeaction.org, `lazer/views.py`, `map_data`, Apache 2.0, read
2026-10-08): `violation` keeps reports whose kind
starts with the value; `date_gte` and `date_lte` compare the moment of the report with midnight at
the start of the given day in Philadelphia, so `date_lte` must name the day after the last day
wanted; `date` keeps one day in Philadelphia.

**What is kept.** Only each pin's point and the kind of report asked for; nothing else exists in
the reply except the number of people who reported, which is kept for the build notes. The
download holds the points only until the snapshot is made (the runner then deletes it); the
snapshot keeps each report as its H3 cell at resolution 10 (about a block across: see
placekeepers.publish.laser), never as a point. Never a vehicle, a plate, a photo, a time of day or
who reported: the reply holds none of them.

Snapshot columns: `h` (the report's H3 cell, resolution 10), `kind` (one of KINDS), and the same
three days on every row: `window_start` and `window_end` (the first and last day counted) and
`newest_report` (the newest day with reports, equal to `window_end`; the source's health rules
read it).

Verified against the live service on 2026-10-08: 26,060 reports in the 12 months to 2026-10-07,
in 33 seconds (docs/DATA_SOURCES.md, "Sources checked 2026-10-08").
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import date, timedelta
from pathlib import Path
from typing import Any, ClassVar

import h3
import pyarrow as pa
import pyarrow.parquet as pq

from placekeepers.adapters.base import FetchError
from placekeepers.adapters.url import UrlAdapter
from placekeepers.cache import RawFetch
from placekeepers.dates import months_before
from placekeepers.derive.street_safety import PHILLY_LAT, PHILLY_LNG
from placekeepers.httpclient import RetryableError

log = logging.getLogger(__name__)

#: The kinds of report: our short id and the value of Philly Bike Action's `violation` filter.
KINDS: tuple[tuple[str, str], ...] = (
    ("sidewalk", "Sidewalk"),
    ("bike_lane", "Bike Lane"),
    ("crosswalk", "Crosswalk"),
    ("corner", "Corner Clearance"),
    ("ramp", "Handicap Ramp"),
)
#: Each kind in words, for the build notes.
WORDS: dict[str, str] = {
    "sidewalk": "on a sidewalk",
    "bike_lane": "in a bike lane",
    "crosswalk": "on a crosswalk",
    "corner": "on a corner",
    "ramp": "blocking a curb ramp",
}
#: The H3 resolution each report is kept at (about a block across; placekeepers.publish.laser).
H3_RESOLUTION = 10
WINDOW_MONTHS = 12
#: Seconds to wait between two requests, on top of the client's own spacing.
PAUSE_SECONDS = 5.0
#: How many days back to look for the newest day with reports.
NEWEST_LOOKBACK_DAYS = 7


def check_reply(payload: Any) -> None:
    """A reply must be an object with a list of pins; anything else (an error page sent with HTTP
    200, for example) is worth another try."""
    if not isinstance(payload, dict) or not isinstance(payload.get("pins"), list):
        raise RetryableError("Philly Bike Action's map sent a reply without a list of pins")


def points_of(payload: dict[str, Any]) -> tuple[list[list[float]], int]:
    """The [lat, lng] of every pin that has two numbers, and how many pins did not."""
    points: list[list[float]] = []
    bad = 0
    for pin in payload["pins"]:
        if (
            isinstance(pin, list)
            and len(pin) >= 2
            and all(isinstance(v, int | float) and not isinstance(v, bool) for v in pin[:2])
        ):
            points.append([float(pin[0]), float(pin[1])])
        else:
            bad += 1
    return points, bad


def in_box(lat: float, lng: float) -> bool:
    """Inside a generous box around Philadelphia (a point outside it is a data error)."""
    return PHILLY_LAT[0] <= lat <= PHILLY_LAT[1] and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]


def window(newest: date) -> tuple[date, date]:
    """The first and last day of the 12 months ending on `newest`."""
    return months_before(newest, WINDOW_MONTHS) + timedelta(days=1), newest


class PbaLaser(UrlAdapter):
    required_columns = ("h", "kind", "window_start", "window_end", "newest_report")
    # Once a week at most, even when the pipeline runs more often (by hand, or on a laptop).
    min_refetch: ClassVar[timedelta | None] = timedelta(days=6)
    min_refetch_reason: ClassVar[str] = (
        "Philly Bike Action's map is asked for its reports once a week at most"
    )

    def recipe(self) -> str:
        # A download made for another cell size or window is fetched again on the next run.
        return f"h3 resolution {H3_RESOLUTION}, {WINDOW_MONTHS} months"

    def _ask(self, params: dict[str, str]) -> dict[str, Any]:
        return self.ctx.http.get_json(self.endpoint.url, params, check=check_reply)

    def fetch(self, dest: Path) -> dict[str, Any]:
        http = self.ctx.http
        # 1. The newest day with reports, looking back from yesterday (today is not over yet).
        today = self.ctx.today()
        newest: date | None = None
        probes: list[dict[str, Any]] = []
        for back in range(1, NEWEST_LOOKBACK_DAYS + 1):
            if probes:
                http.sleep(PAUSE_SECONDS)
            day = today - timedelta(days=back)
            reply = self._ask({"date": day.isoformat()})
            probes.append({"date": day.isoformat(), "reports": len(reply["pins"])})
            if reply["pins"]:
                newest = day
                break
        if newest is None:
            raise FetchError(
                f"Philly Bike Action's map has no reports for any of the last "
                f"{NEWEST_LOOKBACK_DAYS} days, so the app may have paused"
            )
        first, last = window(newest)
        # 2. One request per kind for the 12 months. date_lte names the day after the last day
        # wanted, because the server compares it with midnight at the start of that day.
        files: dict[str, str] = {}
        reports: dict[str, int] = {}
        reporters: dict[str, int] = {}
        malformed = 0
        for kind, value in KINDS:
            http.sleep(PAUSE_SECONDS)
            params = {
                "violation": value,
                "date_gte": first.isoformat(),
                "date_lte": (last + timedelta(days=1)).isoformat(),
            }
            reply = self._ask(params)
            points, bad = points_of(reply)
            malformed += bad
            name = f"{kind}.json"
            # Only the points; the reply holds nothing else about a report.
            (dest / name).write_text(json.dumps({"points": points}), encoding="utf-8")
            files[kind] = name
            reports[kind] = len(points)
            count = reply.get("unique_users_count")
            if isinstance(count, int) and not isinstance(count, bool):
                reporters[kind] = count
            log.info("%s: %s, %s reports", self.id, value, f"{len(points):,}")
        return {
            "files": files,
            "window_start": first.isoformat(),
            "window_end": last.isoformat(),
            "newest_report": newest.isoformat(),
            "probes": probes,
            "reports": reports,
            "reporters": reporters,
            "malformed": malformed,
            "rows": sum(reports.values()),
        }

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        info = raw.info
        files = info.get("files") or {}
        missing = [kind for kind, _ in KINDS if kind not in files]
        if missing:
            raise FetchError(f"The download has no reports of {', '.join(missing)}")
        cells: list[str] = []
        kinds: list[str] = []
        outside = 0
        for kind, _ in KINDS:
            data = json.loads((raw.dir / files[kind]).read_text(encoding="utf-8"))
            for lat, lng in data["points"]:
                if not in_box(lat, lng):
                    outside += 1
                    continue
                cells.append(h3.latlng_to_cell(lat, lng, H3_RESOLUTION))
                kinds.append(kind)
        first = date.fromisoformat(info["window_start"])
        last = date.fromisoformat(info["window_end"])
        newest = date.fromisoformat(info["newest_report"])
        rows = len(cells)
        table = pa.table(
            {
                "h": pa.array(cells, pa.string()).dictionary_encode(),
                "kind": pa.array(kinds, pa.string()).dictionary_encode(),
                "window_start": pa.array([first] * rows, pa.date32()),
                "window_end": pa.array([last] * rows, pa.date32()),
                "newest_report": pa.array([newest] * rows, pa.date32()),
            }
        )
        pq.write_table(table, out, compression="zstd")
        kept = Counter(kinds)
        counts = ", ".join(f"{WORDS[kind]} {kept[kind]:,}" for kind, _ in KINDS)
        self.notes.append(
            f"{rows:,} reports from {first.isoformat()} to {last.isoformat()} ({counts})"
        )
        if outside:
            self.notes.append(f"{outside:,} reports outside the box around the city were left out")
        if info.get("malformed"):
            self.notes.append(f"{info['malformed']:,} pins without a usable point were left out")
