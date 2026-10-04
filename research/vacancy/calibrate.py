"""Choose the rule for "this parcel has a building footprint".

Two reference groups, built without using footprints:
  near certain lots    on the City's 2026 land list, on L&I's June 2024 land list, and OPA category
                       "vacant land" with a residential vacant land building code
  near certain houses  OPA single family, sold since 2025, on no vacancy list

For each candidate rule, report how often it says "building present" in each group. A good rule is
near 0 percent for lots and near 100 percent for houses. Writes results/footprint_calibration.csv.
"""

from __future__ import annotations

import csv

from common import CACHE, OUT, RESULTS, connect, opa9, raw

RULES = {
    "raw overlap: piece of 15 m2 or more and 10 percent cover": "fp_max_piece_m2 >= 15 AND (fp_overlap_m2 >= 0.1*area_m2 OR fp_mostly_inside > 0)",
    "raw overlap: footprints cover 20 percent of the parcel": "fp_overlap_m2 >= 0.2*area_m2",
    "a footprint lies mostly inside the parcel": "fp_mostly_inside > 0",
    "the City links a footprint to the parcel": "fp_linked > 0",
    "chosen: mostly inside, or linked and overlapping 10 m2 or more": "fp_mostly_inside > 0 OR (fp_linked > 0 AND fp_max_piece_m2 >= 10)",
}


def main() -> None:
    con = connect(memory="1500MB")
    con.execute(f"CREATE TABLE sp AS SELECT * EXCLUDE (wkb) FROM read_parquet('{OUT / 'parcel_spatial.parquet'}')")
    con.execute(f"""CREATE TABLE opa AS SELECT {opa9('parcel_number')} AS opa, category_code AS cat,
                    building_code_description AS bdesc, left(sale_date, 10) AS sale_date FROM read_parquet('{raw('opa')}')""")
    con.execute(f"CREATE TABLE cl AS SELECT {opa9('opa_id')} AS opa FROM read_parquet('{raw('vpi_land_2026')}') WHERE opa_id IS NOT NULL")
    con.execute(f"CREATE TABLE cb AS SELECT {opa9('opa_id')} AS opa FROM read_parquet('{raw('vpi_bldg_2026')}') WHERE opa_id IS NOT NULL")
    con.execute(f"CREATE TABLE l24 AS SELECT {opa9('opa_id')} AS opa FROM read_parquet('{CACHE / 'land_2024.parquet'}') WHERE opa_id IS NOT NULL")
    con.execute("""CREATE TABLE lots AS SELECT sp.* FROM sp JOIN opa USING (opa)
                   WHERE opa IN (SELECT opa FROM cl) AND opa IN (SELECT opa FROM l24)
                     AND cat = '6' AND bdesc ILIKE 'VAC%LAND%RES%'""")
    con.execute("""CREATE TABLE houses AS SELECT sp.* FROM sp JOIN opa USING (opa)
                   WHERE cat = '1' AND sale_date >= '2025-01-01' AND opa NOT IN (SELECT opa FROM cl)
                     AND opa NOT IN (SELECT opa FROM cb) AND opa NOT IN (SELECT opa FROM l24)""")
    n_lots = con.execute("SELECT count(*) FROM lots").fetchone()[0]
    n_houses = con.execute("SELECT count(*) FROM houses").fetchone()[0]
    rows = []
    for name, rule in RULES.items():
        a = con.execute(f"SELECT 100 * avg(({rule})::INT) FROM lots").fetchone()[0]
        b = con.execute(f"SELECT 100 * avg(({rule})::INT) FROM houses").fetchone()[0]
        rows.append((name, n_lots, round(a, 1), n_houses, round(b, 1)))
        print(f"{name:70s} lots {a:5.1f}%  houses {b:5.1f}%")
    with open(RESULTS / "footprint_calibration.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["rule", "near_certain_lots", "pct_lots_called_built", "near_certain_houses", "pct_houses_called_built"])
        w.writerows(rows)


if __name__ == "__main__":
    main()
