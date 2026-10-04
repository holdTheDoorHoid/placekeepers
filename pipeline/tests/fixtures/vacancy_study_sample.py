"""Make vacancy_study_sample.parquet: a small, fixed sample of the vacancy study's signal table
with the study's own labels, for the parity test in tests/test_vacancy.py.

The study's tables (research/vacancy/out/, made by research/vacancy/build_signals.py and rules.py)
are not committed, so this script only runs where they exist:

    pipeline/.venv/bin/python pipeline/tests/fixtures/vacancy_study_sample.py STUDY_OUT_DIR

The sample keeps only the rule inputs, the labels and the reasons: no owner names and no addresses.
It takes up to 60 parcels of every kind and confidence, and up to 25 more for each rarer case
(construction permits, land use, side yards, recent permits, unsafe and imminently dangerous
buildings, exclusions), chosen by a hash of the account so the sample never changes.
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb

FLAGS = [
    "has_footprint",
    "opa_vacant_land",
    "no_footprint",
    "demo_no_newcon",
    "lot_li_2y",
    "in_landcare",
    "cs_recent_no_permit",
    "unsafe_no_permit",
    "idang_no_permit",
    "bldg_li_2y",
    "opa_ext_vacant",
    "city_land",
    "city_bldg",
    "lu_developed",
    "newcon_probably_built",
    "newcon_planned",
    "recent_permit",
    "side_yard_likely",
]
RARE = [
    "newcon_probably_built",
    "newcon_planned",
    "lu_developed AND city_land",
    "side_yard_likely",
    "recent_permit AND c.kind = 'building'",
    "idang_no_permit",
    "unsafe_no_permit",
    "c.kind = 'excluded'",
    "c.kind = 'lot_conflict'",
    "has_footprint IS NULL",
]


def main(study_out: Path) -> None:
    out = Path(__file__).with_name("vacancy_study_sample.parquet")
    con = duckdb.connect()
    columns = ", ".join(f"s.{flag}" for flag in FLAGS)
    con.execute(f"""
        CREATE TABLE joined AS
        SELECT s.opa, {columns}, s.excluded_use, s.n_lot_signals, s.n_bldg_signals,
               c.kind AS study_kind, c.confidence AS study_confidence, c.reasons AS study_reasons
        FROM read_parquet('{study_out / "signals.parquet"}') s
        JOIN read_parquet('{study_out / "candidates.parquet"}') c USING (opa)
    """)
    picks = [
        """
        SELECT opa FROM (
          SELECT opa, row_number() OVER (PARTITION BY study_kind, study_confidence
                                         ORDER BY hash(opa)) AS r FROM joined) WHERE r <= 60
    """
    ]
    for condition in RARE:
        condition = condition.replace("c.kind", "study_kind")
        picks.append(f"SELECT opa FROM joined WHERE {condition} ORDER BY hash(opa) LIMIT 25")
    union = " UNION ".join(f"({pick})" for pick in picks)
    con.execute(f"""
        COPY (SELECT * FROM joined WHERE opa IN ({union}) ORDER BY opa)
        TO '{out}' (FORMAT parquet, COMPRESSION zstd)
    """)
    n = con.execute(f"SELECT count(*) FROM '{out}'").fetchone()[0]
    print(f"wrote {n} parcels to {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
