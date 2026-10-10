"""The rules and records of each lot (M4.6, issue #42): historic districts, the properties on the
Philadelphia Register of Historic Places, zoning overlays, appeals to the City's boards, and the
EPA's brownfield properties. Field names verified against the live services on 2026-10-09.

* `historic_districts` and `historic_sites` come from the City's live ArcGIS layers. OpenDataPhilly
  also links Carto copies (`historicdistricts_local`, `historic_sites_philreg`) that are older and
  disagree with them, so those are never used. The Register's layer holds parcel shapes with an
  address, a designation date and the district, and no parcel number: it is joined to parcels by
  shape (placekeepers.derive.lot_rules).
* `zoning_overlays`: the Planning Commission's overlays, with the Zoning Code section and its
  link, a sunset date and any bill pending in City Council.
* `appeals`: every appeal in the City's `appeals` table, read with exactly the columns the lot
  page's live lookup asks for (web/src/dossier/carto.ts, APPEAL_COLUMNS; checked by both test
  suites against pipeline/tests/fixtures/timeline_parity.json), plus the point for the map's
  hearing layer. That includes who filed it and the owner the City names: the owner decided on
  2026-10-09 to show them, on the lot's own page only (docs/ETHICS.md, "Appeals and hearings").
  The free text grounds, the proviso and the related permit and case numbers are never
  downloaded; the lot page links to the City for the grounds.
* `epa_brownfields`: the EPA's ACRES brownfield properties in Philadelphia, from its facility
  registry map service, which sometimes answers "Service not found" with HTTP 404 and works a
  moment later: each run tries a few times before giving up.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, ClassVar

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.carto import CartoAdapter, Column
from placekeepers.httpclient import AccessRefused, HttpError

log = logging.getLogger(__name__)


class HistoricDistricts(ArcgisAdapter):
    """The Historical Commission's local historic districts: the name and the designation date
    (as a date, and as the text the Commission writes, which is right where the date holds a
    placeholder such as 3000-01-01)."""

    out_fields = ("objectid", "name", "designated", "designated1")
    required_columns = ("name", "designated", "designated1", "geometry")


class HistoricSites(ArcgisAdapter):
    """Properties on the Philadelphia Register of Historic Places, one parcel shape each: the
    address, the dates it was designated on its own, and the district it belongs to with that
    district's date."""

    out_fields = (
        "objectid",
        "loc",
        "idesigdate1",
        "idesigdate2",
        "district",
        "ddesigdate",
        "districtdesdate",
    )
    required_columns = ("loc", "idesigdate1", "district", "ddesigdate", "geometry")


class ZoningOverlays(ArcgisAdapter):
    """The Planning Commission's zoning overlays and supplemental controls."""

    out_fields = (
        "objectid",
        "overlay_name",
        "overlay_symbol",
        "type",
        "code_section",
        "code_section_link",
        "sunset_date",
        "pending",
        "pendingbill",
        "pendingbillurl",
    )
    required_columns = ("overlay_name", "overlay_symbol", "type", "code_section_link", "geometry")


#: The columns of an appeal, each as the City's own column: the live lookup asks for exactly these
#: (web/src/dossier/carto.ts, APPEAL_COLUMNS), so the weekly copy and a live lot page read an
#: appeal the same way. Times stay as the City writes them; placekeepers.derive.appeals turns
#: them into days and times in Philadelphia, as the browser does.
APPEAL_COLUMNS = (
    "appealnumber",
    "applicationtype",
    "appealtype",
    "appealstatus",
    "decision",
    "createddate",
    "scheduleddate",
    "decisiondate",
    "coordinatingrco",
    "primaryappellant",
    "opa_owner",
)


class Appeals(CartoAdapter):
    """Every appeal to the Zoning Board of Adjustment, the L&I Review Board, the Board of Building
    Standards and the City's other boards (about 45,000, 2007 on), with the parcel, the address
    and the point. `filed_day` (the filing day in Philadelphia) is kept for the health check."""

    columns = (
        Column("opa_account_num", "opa_account_num"),
        Column("address", "address"),
        *(Column(name, name) for name in APPEAL_COLUMNS),
        Column("filed_day", "createddate", "LOCAL_DATE"),
        Column("lat", "ST_Y(the_geom)", "DOUBLE"),
        Column("lng", "ST_X(the_geom)", "DOUBLE"),
    )
    required_columns = (
        "opa_account_num",
        "appealnumber",
        "applicationtype",
        "appealstatus",
        "createddate",
        "scheduleddate",
        "primaryappellant",
        "lat",
        "lng",
    )


class EpaBrownfields(ArcgisAdapter):
    """The EPA's brownfield properties (ACRES) in Philadelphia: the EPA's registry id, the site's
    name and address as the EPA writes them, how precise its point is, and the last day a grant
    reported on it. Retried when the EPA's server says it cannot find its own service."""

    query_where = "STATE_CODE='PA' AND COUNTY_NAME='PHILADELPHIA'"
    out_fields = (
        "OBJECTID",
        "REGISTRY_ID",
        "PRIMARY_NAME",
        "LOCATION_ADDRESS",
        "POSTAL_CODE",
        "ACCURACY_VALUE",
        "LAST_REPORTED_DATE",
        "INTEREST_TYPE",
    )
    required_columns = ("registry_id", "primary_name", "location_address", "geometry")
    #: tries before giving up, and the pause before each new try (seconds, growing)
    attempts: ClassVar[int] = 6
    pause: ClassVar[float] = 5.0

    def fetch(self, dest: Path) -> dict[str, Any]:
        for attempt in range(1, self.attempts + 1):
            try:
                return super().fetch(dest)
            except AccessRefused:
                raise
            except HttpError as exc:
                if "HTTP 404" not in str(exc) or attempt == self.attempts:
                    raise
                log.warning(
                    "%s: the EPA's server said it could not find its service (attempt %d of %d); "
                    "trying again",
                    self.id,
                    attempt,
                    self.attempts,
                )
                for page in dest.glob("page-*.geojson"):
                    page.unlink()
                time.sleep(self.pause * attempt)
        raise AssertionError("unreachable")  # pragma: no cover


__all__ = [
    "APPEAL_COLUMNS",
    "Appeals",
    "EpaBrownfields",
    "HistoricDistricts",
    "HistoricSites",
    "ZoningOverlays",
]
