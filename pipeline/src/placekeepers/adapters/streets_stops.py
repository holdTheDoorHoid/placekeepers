"""Streets and stops (M4.5, issue #41): four City layers about the street and the bus stop.

All four are point layers in the City's ArcGIS Online organization, under the City's open data
terms ("City of Philadelphia License" on OpenDataPhilly, registry license `city_terms`), fetched
with an explicit field list so only what the map uses is downloaded. Field names and counts were
checked against the live services on 2026-10-09:

* `bus_shelters`: "Bus Shelters" (`bus_transit_shelters`), the shelters the City installs and
  maintains with its advertising partner, Intersection Media: 487 points with the site's name
  (`site`), the partner's site id (`siteid`, such as "pa-002294"), SEPTA's stop number as the City
  lists it (`stopid`) and the kind of advertising panel (`productgroup`, Static or Digital). Last
  edited 2025-01-15. The `lat` and `long` columns repeat the point and are not kept.
* `street_poles`: "Street Poles" (`Street_Poles`), the poles the Streets Department's Street
  Lighting Division keeps track of: 203,096 points, about 102 pages of 2,000, with the pole number
  (`pole_num`, the number Philly311 asks for when a light is out), the kind of pole (`type`, the
  division's own codes), the number of lamps on it (`nlumin`), its owner (`owner`: Streets, PECO,
  PennDOT and others), the kind of lamp (`bulb_type`: LED, HPS or UNKNOWN), the day the light
  was last worked on (`light_date`) and whether the City's LED program reached it (`psip_status`).
  Edited daily. 78,345 poles have no lamp data (`bulb_type` UNKNOWN), most of them PECO's and the
  City's signal poles; the map says "lamps the City lists", never that a street is lit.
  `geometryPrecision` 6 keeps each point to about 10 centimeters and the download smaller.
* `traffic_calming`: "Traffic Calming Devices" (`traffic_calming_devices`), speed cushions,
  humps and tables in the street: 1,780 points with the project id (`id`, such as "SC-1040",
  shared by the devices of one project), the street block (`seg_id`, the City's centerline id)
  and the day it went in (`install_dt`). Edited as devices go in.
* `crossing_guards`: "School Crossing Guard Locations" (`School_Crossing_Guards`), the corners
  where the City posts a crossing guard near a school: 758 points with the intersection
  (`address`, such as "BYBERRY & PROCTOR") and the City's street node (`node_id`). Last edited
  2026-10-06. Crossing guards are a safety service for children walking to school, never
  enforcement (docs/ETHICS.md, "Policing").
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.health import Check

#: Most shelters name the SEPTA stop they serve (481 of 487 on 2026-10-09). Far fewer would mean
#: the City changed the column, and the stops could no longer be matched by number.
SHELTER_NUMBERED_SHARE = 0.8
#: Most poles carry the City's pole number (all on 2026-10-09) and many a lamp (125,000).
POLE_NUMBERED_SHARE = 0.9
POLE_LAMP_SHARE = 0.4
#: Most devices name their street block (1,704 of 1,780 on 2026-10-09).
CALMING_BLOCK_SHARE = 0.8


def _share(path: Path, column: str, predicate) -> tuple[int, int]:
    table = pq.read_table(path, columns=[column])
    values = table.column(column)
    return int(pc.sum(predicate(values)).as_py() or 0), table.num_rows


def _share_check(rule: str, have: int, rows: int, minimum: float, what: str) -> Check:
    share = have / rows if rows else 0.0
    ok = rows == 0 or share >= minimum
    detail = f"{have:,} of {rows:,} {what} ({share:.0%}; at least {minimum:.0%} expected)"
    return Check(rule, ok, detail)


class BusShelters(ArcgisAdapter):
    """The City's bus shelters, with SEPTA's stop number as the City lists it."""

    out_fields = ("objectid", "site", "siteid", "stopid", "productgroup")
    required_columns = ("objectid", "site", "siteid", "stopid", "productgroup", "geometry")

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        have, rows = _share(
            path,
            "stopid",
            lambda v: pc.fill_null(pc.match_substring_regex(v, r"^\s*\d+\s*$"), False),
        )
        return [
            _share_check(
                "stop_numbers", have, rows, SHELTER_NUMBERED_SHARE, "shelters name a stop number"
            )
        ]


class StreetPoles(ArcgisAdapter):
    """Every street pole the Street Lighting Division lists, with its lamps where it has them."""

    out_fields = (
        "objectid",
        "pole_num",
        "type",
        "nlumin",
        "owner",
        "bulb_type",
        "light_date",
        "psip_status",
    )
    required_columns = ("objectid", "pole_num", "nlumin", "owner", "bulb_type", "geometry")
    query_params = {"geometryPrecision": "6"}

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        numbered, rows = _share(path, "pole_num", lambda v: pc.is_valid(v))
        lamps, _ = _share(
            path,
            "bulb_type",
            lambda v: pc.fill_null(pc.is_in(pc.utf8_upper(v), pa.array(["LED", "HPS"])), False),
        )
        return [
            _share_check("pole_numbers", numbered, rows, POLE_NUMBERED_SHARE, "poles are numbered"),
            _share_check("lamps", lamps, rows, POLE_LAMP_SHARE, "poles list their kind of lamp"),
        ]


class TrafficCalming(ArcgisAdapter):
    """Speed cushions, humps and tables, with their street block and the day they went in."""

    out_fields = ("objectid", "id", "seg_id", "install_dt")
    required_columns = ("objectid", "id", "seg_id", "install_dt", "geometry")

    def extra_checks(self, path: Path, newest: date | None) -> list[Check]:
        have, rows = _share(path, "seg_id", lambda v: pc.is_valid(v))
        return [
            _share_check(
                "street_blocks", have, rows, CALMING_BLOCK_SHARE, "devices name their street block"
            )
        ]


class CrossingGuards(ArcgisAdapter):
    """The corners where the City posts a school crossing guard."""

    out_fields = ("objectid", "address", "node_id")
    required_columns = ("objectid", "address", "geometry")
