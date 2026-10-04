"""Licenses and Inspections records (Carto): violations, complaints, permits, unsafe and imminently
dangerous buildings, clean and seal work orders, and demolitions.

The vacancy study (milestone M0.5) is still choosing which codes and signals count, so these keep
every code and status, with the dates and codes needed to filter later, rather than a pre filtered
list. Owner names (already in OPA) and contractor and applicant names are not kept. Date filters
are in each source's registry `where`. Field names verified against the live tables on 2026-10-04.

* violations: every violation since 2016 for the vacancy candidate parcels, plus the two vacancy
  codes the vacancy model counts (a vacant lot license violation, and titles naming vacancy) for
  every parcel in the city over the last 26 months, since such a violation can be the only sign;
* complaints: every complaint since 2023, citywide, with its location;
* permits: every permit issued since 2016, citywide, lean columns;
* unsafe, imminently dangerous, clean and seal, demolitions: the whole tables (small).
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from placekeepers.adapters.base import FetchError
from placekeepers.adapters.carto import (
    KEY_ALIAS,
    CartoAccountsAdapter,
    CartoAdapter,
    Column,
    _check_carto_csv,
    _check_carto_json,
    scan_csv,
)
from placekeepers.cache import RawFetch
from placekeepers.dates import months_before


def _text(*names: str) -> tuple[Column, ...]:
    return tuple(Column(name, name) for name in names)


def _dates(*names: str) -> tuple[Column, ...]:
    return tuple(Column(name, name, "DATE") for name in names)


POINT = (
    Column("lat", "ST_Y(the_geom)", "DOUBLE"),
    Column("lng", "ST_X(the_geom)", "DOUBLE"),
)

CASE_VIOLATION = (
    *_text("opa_account_num", "address", "casenumber"),
    *_dates("casecreateddate", "casecompleteddate"),
    *_text("violationnumber"),
    *_dates("violationdate"),
    *_text("violationcode", "violationcodetitle"),
    *_dates("violationresolutiondate"),
    *_text("violationresolutioncode"),
)


class LiViolations(CartoAccountsAdapter):
    account_column = "opa_account_num"
    columns = (
        *_text("opa_account_num", "address", "parcel_id_num", "casenumber", "casetype"),
        *_text("casestatus", "caseresponsibility", "caseprioritydesc"),
        *_dates("casecreateddate", "casecompleteddate"),
        *_text("violationnumber"),
        *_dates("violationdate"),
        *_text("violationcode", "violationcodetitle", "violationstatus"),
        *_dates("violationresolutiondate"),
        *_text("violationresolutioncode"),
        *POINT,
    )
    required_columns = (
        "opa_account_num",
        "casenumber",
        "violationdate",
        "violationcode",
        "violationcodetitle",
        "violationstatus",
    )
    #: Violations the vacancy model counts, fetched for the whole city as well.
    citywide_where = "(violationcode = '9-3904' OR violationcodetitle ILIKE '%VACAN%')"
    citywide_months = 26
    dedupe = True

    def citywide_filter(self, since: date, after: int | None = None) -> str:
        conditions = [self.citywide_where, f"violationdate >= '{since.isoformat()}'"]
        if after is not None:
            conditions.append(f"{self.key} > {int(after)}")
        return " WHERE " + " AND ".join(conditions)

    def citywide_query(self, since: date, after: int | None) -> str:
        select = ", ".join(f"{column.sql} AS {column.name}" for column in self.columns)
        return (
            f"SELECT {select}, {self.key} AS {KEY_ALIAS} FROM {self.endpoint.table}"
            f"{self.citywide_filter(since, after)} ORDER BY {self.key} LIMIT {self.chunk_rows}"
        )

    def fetch(self, dest: Path) -> dict[str, Any]:
        info = super().fetch(dest)
        since = months_before(self.ctx.today(), self.citywide_months)
        reply = self.ctx.http.get_json(
            self.api_url,
            {"q": f"SELECT count(*) AS n FROM {self.endpoint.table}{self.citywide_filter(since)}"},
            check=_check_carto_json,
        )
        expected = int(reply["rows"][0]["n"])
        total, page, after = 0, 0, None
        while True:
            page += 1
            path = dest / f"citywide-{page:05d}.csv"
            self.ctx.http.download(
                self.api_url,
                path,
                {"q": self.citywide_query(since, after), "format": "csv"},
                check_file=_check_carto_csv,
            )
            rows, last = scan_csv(path, KEY_ALIAS)
            if rows == 0:
                path.unlink()
                break
            total += rows
            if rows < self.chunk_rows or last is None:
                break
            after = last
        if total != expected:
            raise FetchError(
                f"Downloaded {total:,} citywide vacancy violations but the table reports "
                f"{expected:,}; trying again next run"
            )
        info.update(citywide_rows=total, citywide_since=since.isoformat())
        return info

    def csv_groups(self, raw: RawFetch) -> list[tuple[list[Path], list[str]]]:
        assert raw.dir is not None
        groups = super().csv_groups(raw)
        citywide = sorted(raw.dir.glob("citywide-*.csv"))
        if citywide:
            groups.append((citywide, [*self.csv_names(), KEY_ALIAS]))
        return groups


class LiComplaints(CartoAdapter):
    columns = (
        *_text("complaintnumber", "opa_account_num", "address", "parcel_id_num"),
        *_text("complaintcode", "complaintcodename"),
        *_dates("complaintdate"),
        *_text("complaintstatus", "casenumber", "casestatus", "ticket_num_311"),
        *_dates("initialinvestigation_date", "complaintresolution_date"),
        *POINT,
    )
    required_columns = ("complaintnumber", "complaintcode", "complaintdate", "lat", "lng")


class LiPermits(CartoAdapter):
    columns = (
        *_text("permitnumber", "opa_account_num", "address"),
        *_text("permittype", "permitdescription", "typeofwork"),
        *_dates("permitissuedate", "permitcompleteddate"),
        *_text("status"),
    )
    required_columns = (
        "permitnumber",
        "opa_account_num",
        "permittype",
        "typeofwork",
        "permitissuedate",
        "status",
    )


class LiUnsafe(CartoAdapter):
    columns = (*CASE_VIOLATION, *POINT)
    required_columns = ("opa_account_num", "casenumber", "violationdate", "violationcode")


class LiImminentlyDangerous(CartoAdapter):
    columns = (*CASE_VIOLATION, *POINT)
    required_columns = ("opa_account_num", "casenumber", "violationdate", "violationcode")


class LiCleanAndSeal(CartoAdapter):
    columns = (
        *_text("opa_account_num", "address", "casenumber", "caseresponsibility"),
        *_dates("casecreateddate", "casecompleteddate"),
        *_text("workordertype", "workordernumber", "workorderstatus"),
        *_dates("workordercompleteddate"),
        *POINT,
    )
    required_columns = (
        "opa_account_num",
        "casecreateddate",
        "workordertype",
        "workorderstatus",
        "workordercompleteddate",
    )


class LiDemolitions(CartoAdapter):
    columns = (
        *_text("opa_account_num", "address", "caseorpermitnumber", "record_type"),
        *_text("typeofwork", "typeofworkdescription", "city_demo", "status", "applicanttype"),
        *_dates("start_date", "completed_date"),
        *POINT,
    )
    required_columns = ("opa_account_num", "typeofwork", "city_demo", "status", "start_date")
