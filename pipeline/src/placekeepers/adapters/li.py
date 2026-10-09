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
* unsafe, imminently dangerous, clean and seal, demolitions: the whole tables (small);
* li_history (issue #38): what the lot timeline shows from all six tables, for the candidate
  parcels, all years, with days in Philadelphia (LiHistory below).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, ClassVar

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

log = logging.getLogger(__name__)


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


@dataclass(frozen=True)
class HistoryPart:
    """One L&I table of the lot timeline: what kind of record it holds and the SQL for its date,
    title, status and detail. The web app's live lookup asks the City for exactly these
    expressions (web/src/dossier/carto.ts, liSql; checked by both test suites against
    pipeline/tests/fixtures/timeline_parity.json), so the weekly copy and a live lot page read the
    same records the same way."""

    kind: str
    table: str
    date: str
    title: str
    status: str
    detail: str


#: An unsafe or imminently dangerous notice is open until L&I records it resolved.
NOTICE_STATUS = "CASE WHEN violationresolutiondate IS NULL THEN 'OPEN' ELSE 'RESOLVED' END"

#: The six L&I tables of the lot timeline, in the order the timeline lists kinds. Only dates, the
#: City's titles and statuses, the permit type and whether the City did a demolition are read:
#: never a case, permit or violation number, an inspector, an applicant or a contractor.
HISTORY_PARTS = (
    HistoryPart(
        "violation", "violations", "violationdate", "violationcodetitle", "violationstatus", "NULL"
    ),
    HistoryPart(
        "permit", "permits", "permitissuedate", "typeofwork", "status", "permitdescription"
    ),
    HistoryPart(
        "demolition",
        "demolitions",
        "COALESCE(completed_date, start_date)",
        "typeofwork",
        "status",
        "city_demo",
    ),
    HistoryPart("unsafe", "unsafe", "violationdate", "violationcodetitle", NOTICE_STATUS, "NULL"),
    HistoryPart(
        "imminently_dangerous",
        "imm_dang",
        "violationdate",
        "violationcodetitle",
        NOTICE_STATUS,
        "NULL",
    ),
    HistoryPart(
        "clean_seal",
        "clean_seal",
        "COALESCE(workordercompleteddate, casecreateddate)",
        "workordertype",
        "workorderstatus",
        "NULL",
    ),
)


class LiHistory(CartoAccountsAdapter):
    """Every L&I record of the lot timeline for the candidate parcels, from all six tables and all
    years (violations and permits from 2007, clean and seal from 2006): one row per record with
    its kind, its day in Philadelphia, the City's title, its status and, for permits and
    demolitions, one more plain detail. The registry names the largest table, `violations`; the
    other five come in the same chunks of accounts, each chunk of each table checked against a
    count of the same join.

    The other L&I sources keep their own columns for the vacancy model and the flags; this one
    holds only what a lot page shows, with days as the City's sites show them, so the weekly copy
    and a live lot page give the same timeline (issue #38)."""

    account_column = "opa_account_num"
    columns = (
        Column("opa_account_num", "opa_account_num"),
        Column("kind", "kind"),
        Column("date", "date", "LOCAL_DATE"),
        Column("title", "title"),
        Column("status", "status"),
        Column("detail", "detail"),
    )
    required_columns = ("opa_account_num", "kind", "date", "title", "status")
    parts: ClassVar[tuple[HistoryPart, ...]] = HISTORY_PARTS

    def part_join(self, part: HistoryPart, accounts: list[str]) -> str:
        for account in accounts:
            if not (len(account) == 9 and account.isdigit()):
                raise FetchError(f"{account!r} is not a 9 digit OPA account")
        values = ", ".join(f"('{account}')" for account in accounts)
        return (
            f"FROM {part.table} JOIN (VALUES {values}) AS chosen(chosen_account) "
            f"ON {part.table}.{self.account_column} = chosen.chosen_account"
        )

    def part_query(self, part: HistoryPart, accounts: list[str]) -> str:
        select = (
            f"{part.table}.{self.account_column} AS opa_account_num, '{part.kind}' AS kind, "
            f"{part.date} AS date, {part.title} AS title, {part.status} AS status, "
            f"{part.detail} AS detail"
        )
        return f"SELECT {select} {self.part_join(part, accounts)}"

    def part_count_query(self, part: HistoryPart, accounts: list[str]) -> str:
        return f"SELECT count(*) AS n {self.part_join(part, accounts)}"

    def fetch(self, dest: Path) -> dict[str, Any]:
        chosen = self.accounts()
        if not chosen:
            raise FetchError(
                "There are no candidate parcels yet; fetch the vacancy indicators and OPA first"
            )
        size = self.accounts_per_chunk
        chunks = [chosen[start : start + size] for start in range(0, len(chosen), size)]
        by_kind: dict[str, int] = {}
        total = 0
        for number, accounts in enumerate(chunks, 1):
            for part in self.parts:
                path = dest / f"chunk-{number:05d}-{part.kind}.csv"
                self.ctx.http.download(
                    self.api_url,
                    path,
                    data={"q": self.part_query(part, accounts), "format": "csv"},
                    check_file=_check_carto_csv,
                )
                rows, _ = scan_csv(path, None)
                reply = self.ctx.http.get_json(
                    self.api_url,
                    data={"q": self.part_count_query(part, accounts)},
                    check=_check_carto_json,
                )
                expected = int(reply["rows"][0]["n"])
                if rows != expected:
                    raise FetchError(
                        f"Chunk {number} of {part.table} has {rows:,} rows but the table reports "
                        f"{expected:,}; trying again next run"
                    )
                by_kind[part.kind] = by_kind.get(part.kind, 0) + rows
                total += rows
            log.info(
                "%s: chunk %d of %d, %s rows so far", self.id, number, len(chunks), f"{total:,}"
            )
        return {
            "rows": total,
            "chunks": len(chunks),
            "tables": [part.table for part in self.parts],
            "by_kind": by_kind,
            "accounts": len(chosen),
            "candidates": getattr(self, "candidate_info", {}),
        }
