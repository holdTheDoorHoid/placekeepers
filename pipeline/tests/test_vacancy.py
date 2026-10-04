"""The vacancy model's rules (placekeepers.derive.vacancy), one by one, and parity with the study.

Classification tests feed signal flags straight to the rule set. Signal tests build the per
account records from tiny source tables (no spatial extension needed: the spatial facts are given
directly) and check each flag. The parity test runs the rules on a fixed sample of the study's
own signal table and expects the study's labels and reasons exactly.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import duckdb
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from placekeepers.derive import vacancy
from placekeepers.derive.vacancy import REASONS, Windows

FIXTURE = Path(__file__).parent / "fixtures" / "vacancy_study_sample.parquet"
AS_OF = date(2026, 10, 4)
FLAGS = [
    "opa_vacant_land", "no_footprint", "demo_no_newcon", "lot_li_2y", "in_landcare",
    "cs_recent_no_permit", "unsafe_no_permit", "idang_no_permit", "bldg_li_2y", "opa_ext_vacant",
    "city_land", "city_bldg", "lu_developed", "newcon_probably_built", "newcon_planned",
    "recent_permit", "side_yard_likely",
]  # fmt: skip
BIT = {reason.id: 1 << reason.bit for reason in REASONS}


def classify(**flags: object) -> tuple[str | None, str | None, int]:
    """Kind, confidence and reason bits for one parcel with these flags (others false)."""
    row = {flag: False for flag in FLAGS} | {"has_footprint": None, "excluded_use": None}
    row |= flags
    row.setdefault("n_lot_signals", sum(bool(row[f]) for f in vacancy.LOT_SIGNALS))
    row.setdefault("n_bldg_signals", sum(bool(row[f]) for f in vacancy.BLDG_SIGNALS))
    con = duckdb.connect()
    con.register("one", pa.Table.from_pylist([row]))
    return con.execute(f"""
        SELECT kind, confidence, {vacancy.reasons_sql()}
        FROM (SELECT *, {vacancy.classify_sql()} FROM one)
    """).fetchone()


# Classification: lots


def test_a_city_lot_with_two_agreeing_records_is_high() -> None:
    kind, confidence, rs = classify(
        has_footprint=False, city_land=True, opa_vacant_land=True, no_footprint=True
    )
    assert (kind, confidence) == ("lot", "high")
    assert rs == BIT["city_land"] | BIT["assessor_vacant_land"] | BIT["no_building"]


def test_the_city_list_alone_is_never_enough_for_high() -> None:
    assert classify(has_footprint=False, city_land=True)[:2] == ("lot", "low")
    assert classify(has_footprint=False, city_land=True, no_footprint=True)[:2] == ("lot", "low")


def test_a_mapped_use_or_a_recent_permit_lowers_a_city_lot_to_medium() -> None:
    base = {
        "has_footprint": False,
        "city_land": True,
        "opa_vacant_land": True,
        "no_footprint": True,
    }
    kind, confidence, rs = classify(**base, lu_developed=True)
    assert (kind, confidence) == ("lot", "medium") and rs & BIT["land_use_shows_use"]
    kind, confidence, rs = classify(**base, newcon_planned=True)
    assert (kind, confidence) == ("lot", "medium") and rs & BIT["construction_starting"]


def test_an_older_construction_permit_makes_any_lot_low() -> None:
    kind, confidence, rs = classify(
        has_footprint=False, city_land=True, opa_vacant_land=True, no_footprint=True,
        newcon_probably_built=True,
    )  # fmt: skip
    assert (kind, confidence) == ("lot", "low") and rs & BIT["built_since"]


def test_without_the_city_two_records_including_a_physical_one_make_medium() -> None:
    physical = classify(has_footprint=False, opa_vacant_land=True, no_footprint=True)
    assert physical[:2] == ("lot", "medium")
    demolished = classify(has_footprint=True, demo_no_newcon=True, lot_li_2y=True)
    assert demolished[:2] == ("lot", "medium")
    paper_only = classify(has_footprint=None, opa_vacant_land=True, lot_li_2y=True)
    assert paper_only[:2] == ("lot", "low")
    mapped_use = classify(
        has_footprint=False, opa_vacant_land=True, no_footprint=True, lu_developed=True
    )
    assert mapped_use[:2] == ("lot", "low")


def test_the_kind_comes_from_the_footprint_not_the_city_list() -> None:
    # On the City's building list, but nothing stands: a lot.
    kind, _, _ = classify(has_footprint=False, city_bldg=True, no_footprint=True)
    assert kind == "lot"
    # A building stood, but it was demolished with nothing built since: a lot.
    assert classify(has_footprint=True, demo_no_newcon=True)[0] == "lot"
    # No parcel shape at all: the assessor's vacant land category decides.
    assert classify(has_footprint=None, opa_vacant_land=True)[0] == "lot"


def test_a_lot_where_a_footprint_stands_is_low_and_says_so() -> None:
    kind, confidence, rs = classify(has_footprint=True, city_land=True, opa_vacant_land=True)
    assert (kind, confidence) == ("lot_conflict", "low")
    assert rs & BIT["building_stands"]


def test_landcare_lots_stay_in_and_are_marked() -> None:
    kind, confidence, rs = classify(
        has_footprint=False, city_land=True, in_landcare=True, no_footprint=True
    )
    assert (kind, confidence) == ("lot", "high") and rs & BIT["landcare"]


# Classification: buildings


def test_a_city_building_with_one_record_is_high() -> None:
    kind, confidence, rs = classify(has_footprint=True, city_bldg=True, bldg_li_2y=True)
    assert (kind, confidence) == ("building", "high")
    assert rs == BIT["city_building"] | BIT["vacant_building_record"]


def test_two_records_including_a_seal_or_danger_case_are_high_without_the_city() -> None:
    for strong in ("cs_recent_no_permit", "unsafe_no_permit", "idang_no_permit"):
        assert classify(has_footprint=True, **{strong: True}, opa_ext_vacant=True)[:2] == (
            "building", "high"), strong  # fmt: skip
    assert classify(has_footprint=True, bldg_li_2y=True, opa_ext_vacant=True)[:2] == (
        "building", "low")  # fmt: skip


def test_the_city_list_alone_or_one_strong_case_gives_medium() -> None:
    assert classify(has_footprint=True, city_bldg=True)[:2] == ("building", "medium")
    assert classify(has_footprint=True, unsafe_no_permit=True)[:2] == ("building", "medium")


def test_one_weak_record_alone_gives_low() -> None:
    assert classify(has_footprint=True, opa_ext_vacant=True)[:2] == ("building", "low")
    assert classify(has_footprint=True, bldg_li_2y=True)[:2] == ("building", "low")


def test_a_permit_in_the_last_two_years_lowers_a_building_one_level() -> None:
    kind, confidence, rs = classify(
        has_footprint=True, city_bldg=True, bldg_li_2y=True, recent_permit=True
    )
    assert (kind, confidence) == ("building", "medium") and rs & BIT["recent_permit"]
    assert classify(has_footprint=True, city_bldg=True, recent_permit=True)[:2] == (
        "building", "low")  # fmt: skip


def test_nothing_at_all_is_not_a_candidate() -> None:
    assert classify(has_footprint=True)[:2] == (None, None)
    assert classify(has_footprint=False, side_yard_likely=True)[:2] == (None, None)


# Exclusions

EXCLUDED_USES = ["park", "garden", "parking", "rail", "transportation", "utility", "cemetery",
                 "water or street"]  # fmt: skip


@pytest.mark.parametrize("use", EXCLUDED_USES)
def test_excluded_uses_never_show(use: str) -> None:
    lot = classify(has_footprint=False, city_land=True, opa_vacant_land=True, excluded_use=use)
    building = classify(has_footprint=True, city_bldg=True, unsafe_no_permit=True, excluded_use=use)
    assert lot[:2] == ("excluded", None)
    assert building[:2] == ("excluded", None)


# Signals from records


def write(tmp: Path, name: str, columns: dict[str, list]) -> Path:
    path = tmp / f"{name}.parquet"
    pq.write_table(pa.table(columns), path)
    return path


ACCOUNTS = {
    # account: what it is
    "100000001": "vacant land, no footprint",
    "100000002": "vacant land described as parking",
    "100000003": "house demolished in 2024, OPA still says house",
    "100000004": "house demolished in 2019, OPA still says house",
    "100000005": "vacant land demolished in 2019",
    "100000006": "demolished 2024, new construction permit 2025",
    "100000007": "sealed 2024, still standing",
    "100000008": "sealed 2019",
    "100000009": "sealed 2024, permit 2025",
    "100000010": "unsafe since 2023",
    "100000011": "imminently dangerous, permit after",
    "100000012": "vacant lot violation 2025",
    "100000013": "vacant lot violation 2023 (too old)",
    "100000014": "vacant structure violation 2025",
    "100000015": "complaints VO and PMHW",
    "100000016": "new construction permit 2023",
    "100000017": "lot with a mapped use",
    "100000018": "tiny parcel",
    "100000019": "lot owned with the house next door",
    "100000020": "house next door",
    "100000021": "LandCare by account",
    "100000022": "seal cancelled",
}


@pytest.fixture
def signals(tmp_path: Path):
    """Signals for the ACCOUNTS above, computed by build_records and build_signals."""
    ids = list(ACCOUNTS)
    cat = {i: "1" for i in ids} | {
        "100000001": "6", "100000002": "6", "100000005": "6", "100000006": "6",
        "100000012": "6", "100000013": "6", "100000016": "6", "100000017": "6",
        "100000018": "6", "100000019": "6", "100000021": "6",
    }  # fmt: skip
    livable = {i: (0.0 if cat[i] == "6" else 1200.0) for i in ids}
    bdesc = {i: ("VAC LAND RES < ACRE" if cat[i] == "6" else "ROW 2 STY MASONRY") for i in ids}
    bdesc["100000002"] = "PARKING LOT"
    address = {i: f"{2000 + 10 * n} N SAMPLE ST" for n, i in enumerate(ids)}
    address["100000019"], address["100000020"] = "1234 W EXAMPLE ST", "1236 W EXAMPLE ST"
    owner = {i: f"OWNER {i}" for i in ids} | {"100000019": "SMITH JO", "100000020": "SMITH JO"}
    paths = {
        "opa_properties": write(
            tmp_path,
            "opa",
            {
                "parcel_number": ids,
                "location": [address[i] for i in ids],
                "unit": [None] * len(ids),
                "category_code": [cat[i] for i in ids],
                "building_code_description": [bdesc[i] for i in ids],
                "owner_1": [owner[i] for i in ids],
                "total_livable_area": [livable[i] for i in ids],
                "year_built": ["1920"] * len(ids),
                "exterior_condition": ["4"] * len(ids),
                "lat": [39.98] * len(ids),
                "lng": [-75.15] * len(ids),
            },
        ),
        "li_demolitions": write(
            tmp_path,
            "demo",
            {
                "opa_account_num": ["100000003", "100000004", "100000005", "100000006"],
                "status": ["COMPLETED"] * 4,
                "typeofwork": ["FULL"] * 4,
                "city_demo": ["YES", "NO", "NO", "NO"],
                "start_date": [
                    date(2024, 5, 1),
                    date(2019, 5, 1),
                    date(2019, 5, 1),
                    date(2024, 5, 1),
                ],
                "completed_date": [
                    date(2024, 6, 1),
                    date(2019, 6, 1),
                    date(2019, 6, 1),
                    date(2024, 6, 1),
                ],
            },
        ),  # fmt: skip
        "li_clean_and_seal": write(
            tmp_path,
            "cs",
            {
                "opa_account_num": ["100000007", "100000008", "100000009", "100000022"],
                "workorderstatus": ["CLOSED", "CLOSED", "CLOSED", "Cancelled"],
                "workordercompleteddate": [
                    date(2024, 3, 1),
                    date(2019, 3, 1),
                    date(2024, 3, 1),
                    date(2024, 3, 1),
                ],
            },
        ),  # fmt: skip
        "li_unsafe": write(
            tmp_path,
            "unsafe",
            {"opa_account_num": ["100000010"], "violationdate": [date(2023, 2, 1)]},
        ),
        "li_imminently_dangerous": write(
            tmp_path,
            "idang",
            {"opa_account_num": ["100000011"], "violationdate": [date(2023, 2, 1)]},
        ),
        "li_permits": write(
            tmp_path,
            "permits",
            {
                "opa_account_num": ["100000006", "100000009", "100000011", "100000016"],
                "permitissuedate": [
                    date(2025, 7, 1),
                    date(2025, 1, 1),
                    date(2024, 1, 1),
                    date(2023, 1, 1),
                ],
                "permittype": [
                    "Residential Building",
                    "Building",
                    "Building",
                    "Residential Building",
                ],
                "typeofwork": [
                    "New Construction",
                    "Alterations",
                    "Alterations",
                    "New Construction",
                ],
            },
        ),  # fmt: skip
        "li_violations": write(
            tmp_path,
            "violations",
            {
                "opa_account_num": ["100000012", "100000013", "100000014"],
                "violationdate": [date(2025, 5, 1), date(2023, 5, 1), date(2025, 5, 1)],
                "violationcode": ["9-3904", "9-3904", "9-3905"],
                "violationcodetitle": [
                    "VACANT LOT LICENSE",
                    "VACANT LOT LICENSE",
                    "VACANT STRUCTURE LICENSE",
                ],
            },
        ),  # fmt: skip
        "li_complaints": write(
            tmp_path,
            "complaints",
            {
                "opa_account_num": ["100000015", "100000015"],
                "complaintdate": [date(2025, 5, 1), date(2025, 6, 1)],
                "complaintcode": ["VO", "PMHW"],
            },
        ),
        "phs_landcare": write(
            tmp_path,
            "landcare",
            {
                "program": ["PLC"],
                "year": ["2016"],
                "brt_id": ["100000021"],
            },
        ),
    }
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    vacancy.create_views(con, paths)
    # Spatial facts, given directly: footprints, area and land use per account.
    sp = {i: (False, 100.0, None) for i in ids} | {
        "100000003": (True, 100.0, None), "100000004": (True, 100.0, None),
        "100000006": (True, 100.0, None), "100000007": (True, 100.0, None),
        "100000008": (True, 100.0, None), "100000009": (True, 100.0, None),
        "100000010": (True, 100.0, None), "100000011": (True, 100.0, None),
        "100000014": (True, 100.0, None), "100000015": (True, 100.0, None),
        "100000017": (False, 100.0, 11), "100000018": (False, 12.0, None),
        "100000020": (True, 100.0, None),
    }  # fmt: skip
    con.register("sp_rows", pa.Table.from_pylist([
        {"opa": i, "has_footprint": f, "area_m2": a, "lu_c2": lu, "lu_c3": None, "lu_c1": None,
         "lu_year": None, "lu_vacbldg": None, "ppr_name": None, "garden_src": None,
         "garden_name": None, "lc_program": None, "lc_year": None}
        for i, (f, a, lu) in sp.items()
    ]))  # fmt: skip
    con.execute("""
        CREATE TABLE sp AS
        SELECT opa, has_footprint::BOOLEAN AS has_footprint, area_m2::DOUBLE AS area_m2,
               lu_c1::INT AS lu_c1, lu_c2::INT AS lu_c2, lu_c3::INT AS lu_c3,
               lu_year::INT AS lu_year, lu_vacbldg::VARCHAR AS lu_vacbldg,
               ppr_name::VARCHAR AS ppr_name, garden_src::VARCHAR AS garden_src,
               garden_name::VARCHAR AS garden_name, lc_program::VARCHAR AS lc_program,
               lc_year::VARCHAR AS lc_year
        FROM sp_rows
    """)
    w = Windows(AS_OF)
    vacancy.build_records(con, w, vacancy.city_lists(con, AS_OF))
    vacancy.build_signals(con, w)
    rows = con.execute("SELECT * FROM signals").to_arrow_table().to_pylist()
    return {row["opa"]: row for row in rows}


def test_the_assessors_vacant_land_category_counts_but_not_parking(signals) -> None:
    assert signals["100000001"]["opa_vacant_land"] is True
    assert signals["100000002"]["opa_vacant_land"] is False
    assert signals["100000002"]["excluded_use"] == "parking"
    assert signals["100000010"]["opa_vacant_land"] is False


def test_no_footprint_counts_only_on_a_real_parcel_without_a_lived_in_house(signals) -> None:
    assert signals["100000001"]["no_footprint"] is True
    assert signals["100000018"]["no_footprint"] is False  # under 20 square meters
    assert signals["100000020"]["no_footprint"] is False  # a footprint stands


def test_recent_demolitions_count_even_where_opa_still_says_house(signals) -> None:
    assert signals["100000003"]["demo_no_newcon"] is True  # 2024
    assert signals["100000004"]["demo_no_newcon"] is False  # 2019, OPA says house
    assert signals["100000005"]["demo_no_newcon"] is True  # 2019, OPA says vacant land
    assert signals["100000006"]["demo_no_newcon"] is False  # built on since
    assert signals["100000006"]["newcon_planned"] is True


def test_construction_permit_windows(signals) -> None:
    assert signals["100000016"]["newcon_probably_built"] is True  # 2023
    assert signals["100000016"]["newcon_planned"] is False
    assert signals["100000006"]["newcon_probably_built"] is False  # 2025


def test_seals_count_when_recent_completed_standing_and_not_followed_by_a_permit(signals) -> None:
    assert signals["100000007"]["cs_recent_no_permit"] is True
    assert signals["100000008"]["cs_recent_no_permit"] is False  # 2019
    assert signals["100000009"]["cs_recent_no_permit"] is False  # permit since
    assert signals["100000022"]["cs_recent_no_permit"] is False  # cancelled


def test_unsafe_and_imminently_dangerous_count_until_a_permit(signals) -> None:
    assert signals["100000010"]["unsafe_no_permit"] is True
    assert signals["100000011"]["idang_no_permit"] is False


def test_violations_and_complaints_count_for_two_years_and_by_code(signals) -> None:
    assert signals["100000012"]["lot_li_2y"] is True
    assert signals["100000013"]["lot_li_2y"] is False  # 2023
    assert signals["100000014"]["bldg_li_2y"] is True  # title names vacancy
    assert signals["100000015"]["bldg_li_2y"] is True  # VO complaint; weeds alone would not count


def test_a_mapped_use_and_recent_permits_are_contradictions(signals) -> None:
    assert signals["100000017"]["lu_developed"] is True
    assert signals["100000001"]["lu_developed"] is False
    assert signals["100000009"]["recent_permit"] is True  # 2025
    assert signals["100000011"]["recent_permit"] is False  # 2024-01 is more than two years back
    assert signals["100000016"]["recent_permit"] is False


def test_landcare_by_account_and_side_yards(signals) -> None:
    assert signals["100000021"]["in_landcare"] is True
    assert signals["100000019"]["side_yard_likely"] is True
    assert signals["100000001"]["side_yard_likely"] is False


EXCLUSION_CASES = [
    ({"ppr_name": "A Park"}, None, "park"),
    ({}, "PARK", "park"),
    ({"lu_c2": 71, "lu_c3": 711}, None, "park"),
    ({"lu_c2": 71, "lu_c3": 712}, None, "garden"),
    ({"garden_src": "PHS or NGT"}, None, "garden"),
    ({}, "PARKING LOT", "parking"),
    ({"lu_c2": 51, "lu_c3": 514}, None, "parking"),
    ({}, "RAILROAD", "rail"),
    ({"lu_c2": 51, "lu_c3": 512}, None, "rail"),
    ({"lu_c2": 51, "lu_c3": 513}, None, "transportation"),
    ({}, "UTILITY", "utility"),
    ({"lu_c2": 31, "lu_c3": 314}, None, "utility"),
    ({}, "CEMETERY", "cemetery"),
    ({"lu_c2": 72}, None, "cemetery"),
    ({"lu_c2": 81}, None, "water or street"),
    ({"lu_c2": 52}, None, "water or street"),
    # Streets are land use 51 and 511; the study checks transportation first, so they are
    # excluded as transportation.
    ({"lu_c2": 51, "lu_c3": 511}, None, "transportation"),
]


@pytest.mark.parametrize(("spatial", "description", "expected"), EXCLUSION_CASES)
def test_every_exclusion_rule(spatial: dict, description: str | None, expected: str | None) -> None:
    """One account per case through the signal step: the spatial fact or the assessor's
    description that excludes it, and the use it is excluded as."""
    con = duckdb.connect()
    con.execute(
        "CREATE TABLE s AS SELECT '100000001' AS opa, '6' AS cat, ? AS bdesc, 0.0 AS livable_sqft, "
        "? AS ppr_name, ? AS garden_src, ?::INT AS lu_c2, ?::INT AS lu_c3, "
        "NULL::VARCHAR AS lc_program, NULL::VARCHAR AS lc_program_attr, NULL::VARCHAR AS ext_cond",
        [description or "VAC LAND RES < ACRE", spatial.get("ppr_name"), spatial.get("garden_src"),
         spatial.get("lu_c2"), spatial.get("lu_c3")],
    )  # fmt: skip
    # The signal step's exclusion part, as build_signals runs it.
    sql = vacancy_exclusion_sql()
    assert con.execute(sql).fetchone()[0] == expected


def vacancy_exclusion_sql() -> str:
    """The exclusion part of build_signals, run on the table `s`."""
    import inspect

    source = inspect.getsource(vacancy.build_signals)
    start = source.index(
        "(bdesc ILIKE '%PKG%' OR bdesc ILIKE '%PARKING%' OR bdesc ILIKE '%CAR LOT%'"
    )
    end = source.index("ext_cond IN ('6', '7') AS opa_ext_vacant")
    flags = source[start:end].strip().rstrip(",")
    return f"""
        WITH sig AS (SELECT *, {flags} FROM s)
        SELECT CASE
            WHEN is_park THEN 'park' WHEN is_garden THEN 'garden' WHEN is_parking THEN 'parking'
            WHEN is_rail THEN 'rail' WHEN is_transport THEN 'transportation'
            WHEN is_utility THEN 'utility' WHEN is_cemetery THEN 'cemetery'
            WHEN is_water_or_row THEN 'water or street' END
        FROM sig
    """


# The City's list: twelve months, then dropped


def test_the_city_list_is_used_for_twelve_months_after_its_date(tmp_path: Path) -> None:
    con = duckdb.connect()
    con.execute("SET TimeZone = 'UTC'")
    for view, rank in (("src_city_land", "land_rank"), ("src_city_bldg", "build_rank")):
        con.execute(f"CREATE VIEW {view} AS SELECT '100000001' AS opa_id, 1.0 AS {rank}, "
                    "TIMESTAMP '2026-09-27 00:00:00' AS date_update")  # fmt: skip
    fresh = vacancy.city_lists(con, date(2027, 9, 26))
    assert (fresh.use_land, fresh.use_building) == (True, True)
    old = vacancy.city_lists(con, date(2027, 9, 28))
    assert old.land_date == date(2026, 9, 27)
    assert (old.use_land, old.use_building) == (False, False)


# Parity with the study


STUDY_PHRASES = {
    "City lists it as likely vacant land": "city_land",
    "City lists it as a likely vacant building": "city_building",
    "the assessor classifies it as vacant land": "assessor_vacant_land",
    "no building footprint on the parcel": "no_building",
    "demolished in": "demolished",
    "vacant lot violation or complaint since": "vacant_lot_record",
    "cleaned and maintained by PHS LandCare": "landcare",
    "sealed by the City in": "sealed",
    "on the City's unsafe building list": "unsafe",
    "declared imminently dangerous": "imminently_dangerous",
    "vacant property violation or complaint since": "vacant_building_record",
    "the assessor noted a vacant or sealed exterior": "assessor_exterior",
    "a building may stand now": "built_since",
    "construction may be starting": "construction_starting",
    "likely a side yard": "side_yard",
    "the 2023 land use map shows a use other than vacant": "land_use_shows_use",
    "a building or trade permit since": "recent_permit",
}


def study_bits(reasons: str | None, kind: str) -> int:
    bits = 0
    for phrase in (reasons or "").split("; "):
        if not phrase:
            continue
        matches = [rid for text, rid in STUDY_PHRASES.items() if text in phrase]
        assert len(matches) == 1, phrase
        bits |= BIT[matches[0]]
    if kind == "lot_conflict":
        bits |= BIT["building_stands"]
    return bits


def test_the_rules_reproduce_the_studys_labels_and_reasons() -> None:
    con = duckdb.connect()
    con.execute(f"CREATE TABLE sample AS SELECT * FROM read_parquet('{FIXTURE}')")
    rows = con.execute(f"""
        SELECT opa, study_kind, study_confidence, study_reasons, kind, confidence,
               {vacancy.reasons_sql()} AS rs
        FROM (SELECT *, {vacancy.classify_sql()} FROM sample)
    """).fetchall()
    assert len(rows) > 500
    mismatched = [r for r in rows if (r[1], r[2]) != (r[4], r[5])]
    assert mismatched == []
    wrong_reasons = [r[0] for r in rows if study_bits(r[3], r[1]) != r[6]]
    assert wrong_reasons == []
    kinds = {(r[1], r[2]) for r in rows}
    assert len(kinds) == 8  # every kind and confidence the study has, and its exclusions
