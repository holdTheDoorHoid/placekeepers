"""Licenses and Inspections records (Carto): violations, complaints, permits, unsafe and imminently
dangerous buildings, clean and seal work orders, and demolitions.

The vacancy study (milestone M0.5) is still choosing which codes and signals count, so these keep
every code and status, with the dates and codes needed to filter later, rather than a pre filtered
list. Owner names (already in OPA) and contractor and applicant names are not kept. Date filters
are in each source's registry `where`. Field names verified against the live tables on 2026-10-04.

* violations: every violation since 2016 for the vacancy candidate parcels;
* complaints: every complaint since 2023, citywide, with its location;
* permits: every permit issued since 2016, citywide, lean columns;
* unsafe, imminently dangerous, clean and seal, demolitions: the whole tables (small).
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAccountsAdapter, CartoAdapter, Column


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
