"""The recommended vacancy rule set: kind, confidence and plain reasons for every parcel.

Reads out/signals.parquet. Writes out/candidates.parquet and results/rule_counts.csv, including the
counts if the City's indicator disappeared (scenario "no_city") and if Placekeepers kept the last
City list it saw (scenario "last_copy").

Rule summary (see docs/VACANCY_METHOD.md for the evidence behind each line):

Lots (no building on the parcel)
  high    on the City land list, two or more independent lot signals, nothing contradicting
  medium  on the City land list with two or more signals but the 2023 land use map shows a use;
          or not on the City list but two or more independent signals including a physical one
          (no footprint or a demolition), nothing contradicting
  low     everything else with some lot evidence: the City list with at most one agreeing signal,
          a single independent signal, or a new construction permit in the last five years
  never   parks, gardens, parking, rail, transportation, utilities, cemeteries, water and streets

Buildings (a footprint stands on the parcel)
  high    on the City building list and at least one independent building signal; or two or more
          independent building signals including clean and seal, unsafe, or imminently dangerous
  medium  on the City building list alone; or exactly one of clean and seal (five years), unsafe,
          or imminently dangerous
  low     a vacant property violation or complaint alone, or the assessor's exterior note alone
  A permit in the last two years lowers a building one level.
"""

from __future__ import annotations

import csv

from common import OUT, RESULTS, connect

STRONG_BLDG = "(coalesce(cs_recent_no_permit, false) OR coalesce(unsafe_no_permit, false) OR coalesce(idang_no_permit, false))"
PHYSICAL_LOT = "(coalesce(no_footprint, false) OR coalesce(demo_no_newcon, false))"


def classify_sql(city_land: str = "city_land", city_bldg: str = "city_bldg") -> str:
    """SQL select list that assigns kind and confidence. City columns can be swapped for scenarios."""
    lot_kind = f"""(has_footprint = false
                    OR (has_footprint AND coalesce(demo_no_newcon, false))
                    OR (has_footprint IS NULL AND coalesce(opa_vacant_land, false)))"""
    lot_any = f"({city_land} OR n_lot_signals >= 1)"
    bldg_any = f"({city_bldg} OR n_bldg_signals >= 1)"
    return f"""
      CASE
        WHEN excluded_use IS NOT NULL AND ({lot_any} OR {bldg_any}) THEN 'excluded'
        WHEN {lot_kind} AND {lot_any} THEN 'lot'
        WHEN has_footprint AND {bldg_any} THEN 'building'
        WHEN has_footprint AND {lot_any} THEN 'lot_conflict'
        WHEN has_footprint IS NULL AND {bldg_any} THEN 'building'
        WHEN {lot_any} THEN 'lot'
      END AS kind,
      CASE
        WHEN excluded_use IS NOT NULL THEN NULL
        -- lots
        WHEN {lot_kind} AND {lot_any} THEN CASE
          WHEN coalesce(recent_newcon, false) THEN 'low'
          WHEN {city_land} AND n_lot_signals >= 2 AND NOT coalesce(lu_developed, false) THEN 'high'
          WHEN {city_land} AND n_lot_signals >= 2 THEN 'medium'
          WHEN NOT {city_land} AND n_lot_signals >= 2 AND {PHYSICAL_LOT} AND NOT coalesce(lu_developed, false) THEN 'medium'
          ELSE 'low' END
        -- buildings
        WHEN has_footprint IS NOT false AND {bldg_any} THEN
          CASE WHEN coalesce(recent_permit, false) THEN
            CASE WHEN ({city_bldg} AND n_bldg_signals >= 1) OR (n_bldg_signals >= 2 AND {STRONG_BLDG}) THEN 'medium'
                 ELSE 'low' END
          ELSE
            CASE WHEN ({city_bldg} AND n_bldg_signals >= 1) OR (n_bldg_signals >= 2 AND {STRONG_BLDG}) THEN 'high'
                 WHEN {city_bldg} OR {STRONG_BLDG} THEN 'medium'
                 ELSE 'low' END
          END
        -- the City or a record says lot, but a building footprint stands and no demolition is recorded
        WHEN {lot_any} THEN 'low'
      END AS confidence
    """


REASONS_SQL = """
  concat_ws('; ',
    CASE WHEN city_land THEN 'City lists it as likely vacant land' END,
    CASE WHEN city_bldg THEN 'City lists it as a likely vacant building' END,
    CASE WHEN opa_vacant_land THEN 'the assessor classifies it as vacant land' END,
    CASE WHEN no_footprint THEN 'no building footprint on the parcel' END,
    CASE WHEN demo_no_newcon THEN 'demolished in ' || year(demo_last) || ', no building permit since' END,
    CASE WHEN lot_li_2y THEN 'vacant lot violation or complaint since October 2024' END,
    CASE WHEN in_landcare THEN 'cleaned and maintained by PHS LandCare' END,
    CASE WHEN cs_recent_no_permit THEN 'sealed by the City in ' || year(cs_last) || ', no permit since' END,
    CASE WHEN unsafe_no_permit THEN 'on the City''s unsafe building list' END,
    CASE WHEN idang_no_permit THEN 'declared imminently dangerous' END,
    CASE WHEN bldg_li_2y THEN 'vacant property violation or complaint since October 2024' END,
    CASE WHEN opa_ext_vacant THEN 'the assessor noted a vacant or sealed exterior' END,
    CASE WHEN recent_newcon THEN 'new construction permit since October 2021' END,
    CASE WHEN lu_developed THEN 'the 2023 land use map shows a use other than vacant' END,
    CASE WHEN recent_permit THEN 'a building or trade permit since October 2024' END
  ) AS reasons
"""


def main() -> None:
    con = connect(memory="1500MB")
    con.execute(f"CREATE TABLE s AS SELECT * FROM read_parquet('{OUT / 'signals.parquet'}')")
    con.execute(f"""
        CREATE TABLE c AS
        SELECT opa, address, lat, lon, opa_lat, opa_lon, city_land, city_bldg, land_rank, build_rank,
               n_lot_signals, n_bldg_signals, excluded_use, has_footprint,
               {classify_sql()},
               {REASONS_SQL}
        FROM s
    """)
    con.execute(f"COPY (SELECT * FROM c WHERE kind IS NOT NULL) TO '{OUT / 'candidates.parquet'}' (FORMAT parquet)")

    scenarios = {
        "today": ("city_land", "city_bldg"),
        "no_city": ("false", "false"),
    }
    rows = []
    for name, (cl, cb) in scenarios.items():
        con.execute(f"CREATE OR REPLACE TABLE x AS SELECT opa, {classify_sql(cl, cb)} FROM s")
        for kind, conf, n in con.execute(
            "SELECT kind, coalesce(confidence, '(not shown)'), count(*) FROM x WHERE kind IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2"
        ).fetchall():
            rows.append([name, kind, conf, n])
    # Transitions: what happens to today's high and medium parcels if the City indicator disappears.
    con.execute(f"CREATE OR REPLACE TABLE t AS SELECT opa, {classify_sql()} FROM s")
    con.execute(f"CREATE OR REPLACE TABLE u AS SELECT opa, {classify_sql('false', 'false')} FROM s")
    trans = con.execute("""
        SELECT t.kind, t.confidence AS today, coalesce(u.confidence, '(dropped)') AS without_city, count(*)
        FROM t JOIN u USING (opa) WHERE t.kind IN ('lot', 'building') AND t.confidence IS NOT NULL
        GROUP BY ALL ORDER BY 1, 2, 3
    """).fetchall()
    with open(RESULTS / "rule_counts.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["scenario", "kind", "confidence", "parcels"])
        w.writerows(rows)
    with open(RESULTS / "rule_transitions_without_city.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "confidence_today", "confidence_without_city", "parcels"])
        w.writerows(trans)
    for r in rows:
        print(r)
    print()
    for r in trans:
        print(r)


if __name__ == "__main__":
    main()
