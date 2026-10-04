"""Agreement between independent signals and the City's 2026 vacancy indicator, and churn since 2024.

Reads out/signals.parquet (build_signals.py) and the raw lists. Writes small CSV tables to results/
and prints them as Markdown for docs/VACANCY_METHOD.md.
"""

from __future__ import annotations

import csv

from common import CACHE, LIST_2024_DATE, OUT, RESULTS, connect, opa9, raw

CS5 = "cs_recent_no_permit"

LOT_ROWS = [
    ("OPA code says vacant land", "opa_vacant_land", True),
    ("No building footprint (parks, gardens, parking, rail, utilities left out)", "no_footprint", True),
    ("Demolished, no new construction permit since", "demo_no_newcon", True),
    ("Vacant lot license violation or vacant lot complaint, last two years", "lot_li_2y", True),
    ("PHS LandCare lot", "in_landcare", True),
    ("Planning land use map (2023) says vacant", "lu_vacant", False),
    ("Vacant structure or land violation (PM15-301), last two years", "vacant_structure_or_land_2y", False),
    ("Weeds, rubbish, sanitation or dumping violation, or high weeds complaint, last two years", "condition_li_2y", False),
    ("Demolished, new construction permit since", "demo_then_newcon", False),
    ("Garden (PHS, NGT, registered or Parks and Recreation)", "excluded_use = 'garden'", False),
    ("Park (Parks and Recreation property)", "excluded_use = 'park'", False),
    ("Parking lot", "excluded_use = 'parking'", False),
]

BLDG_ROWS = [
    ("Clean and seal in the last five years, no permit since", CS5, True),
    ("On the City's open unsafe list, no permit since", "unsafe_no_permit", True),
    ("On the City's open imminently dangerous list, no permit since", "idang_no_permit", True),
    ("Vacant building violation or vacant property complaint, last two years", "bldg_li_2y", True),
    ("OPA exterior condition: vacant, sealed, or open to the weather", "opa_ext_vacant", True),
    ("Clean and seal before October 2021, no permit since", "cs_no_permit AND cs_last < DATE '2021-10-04'", False),
    ("Clean and seal, then a permit", "cs_then_permit", False),
    ("Vacant structure or land violation (PM15-301), last two years", "vacant_structure_or_land_2y", False),
    ("Unsafe, imminently dangerous or unfit violation, last two years", "danger_violation_2y", False),
    ("Weeds, rubbish, sanitation or dumping violation, or high weeds complaint, last two years", "condition_li_2y", False),
]


def pct(a: float, b: float) -> str:
    return "" if not b else f"{100 * a / b:.0f}%"


def write(name: str, header: list[str], rows: list[list]) -> None:
    with open(RESULTS / f"{name}.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"\n### {name}\n")
    print("| " + " | ".join(header) + " |")
    print("|" + "---|" * len(header))
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")


def main() -> None:
    con = connect(memory="1500MB")
    con.execute(f"CREATE TABLE s AS SELECT * FROM read_parquet('{OUT / 'signals.parquet'}')")
    one = lambda sql: con.execute(sql).fetchone()  # noqa: E731

    # ---------------------------------------------------------------- list identity checks
    opa_ids = f"(SELECT {opa9('parcel_number')} FROM read_parquet('{raw('opa')}'))"
    rows = []
    for label, src in [
        ("City land list, 2026", f"read_parquet('{raw('vpi_land_2026')}')"),
        ("City building list, 2026", f"read_parquet('{raw('vpi_bldg_2026')}')"),
        ("L&I land list, June 2024", f"read_parquet('{CACHE / 'land_2024.parquet'}')"),
        ("Self collected building list, June 2024", f"read_parquet('{CACHE / 'buildings_2024.parquet'}')"),
    ]:
        n, nulls, distinct = one(f"SELECT count(*), count(*) FILTER (WHERE opa_id IS NULL), count(DISTINCT opa_id) FROM {src}")
        gone = one(f"SELECT count(DISTINCT {opa9('opa_id')}) FROM {src} WHERE opa_id IS NOT NULL AND {opa9('opa_id')} NOT IN {opa_ids}")[0]
        rows.append([label, n, nulls, distinct, gone, distinct - gone])
    write("list_identity", ["List", "Rows", "No OPA account", "Distinct accounts", "Account no longer in OPA", "Usable accounts"], rows)

    # ---------------------------------------------------------------- agreement: lots
    n_land = one("SELECT count(*) FROM s WHERE city_land")[0]
    n_bldg = one("SELECT count(*) FROM s WHERE city_bldg")[0]
    rows = []
    for label, expr, core in LOT_ROWS:
        n, on_land, on_bldg, on_any = one(f"""
            SELECT count(*), count(*) FILTER (WHERE city_land), count(*) FILTER (WHERE city_bldg),
                   count(*) FILTER (WHERE city_land OR city_bldg)
            FROM s WHERE coalesce({expr}, false)""")
        rows.append([label, "core" if core else "context", n, on_land, pct(on_land, n), on_bldg, pct(on_land, n_land)])
    write("agreement_lots",
          ["Signal", "Role", "Parcels with signal", "On City land list", "Share on City land list",
           "On City building list", f"Share of the City's {n_land} lots with this signal"], rows)

    # ---------------------------------------------------------------- agreement: buildings
    n_bldg_fp = one("SELECT count(*) FROM s WHERE city_bldg AND has_footprint")[0]
    rows = []
    for label, expr, core in BLDG_ROWS:
        n, on_bldg, on_land = one(f"""
            SELECT count(*), count(*) FILTER (WHERE city_bldg), count(*) FILTER (WHERE city_land)
            FROM s WHERE coalesce({expr}, false) AND has_footprint""")
        rows.append([label, "core" if core else "context", n, on_bldg, pct(on_bldg, n), on_land, pct(on_bldg, n_bldg_fp)])
    write("agreement_buildings",
          ["Signal (parcels where a building stands)", "Role", "Parcels with signal", "On City building list",
           "Share on City building list", "On City land list",
           f"Share of the City's {n_bldg_fp} standing buildings with this signal"], rows)

    # ---------------------------------------------------------------- footprint conflicts
    rows = []
    for label, where in [
        ("City land list", "city_land"),
        ("City building list", "city_bldg"),
        ("On both City lists", "city_land AND city_bldg"),
    ]:
        n, fp, nofp, unknown, demo = one(f"""
            SELECT count(*), count(*) FILTER (WHERE has_footprint), count(*) FILTER (WHERE has_footprint = false),
                   count(*) FILTER (WHERE has_footprint IS NULL), count(*) FILTER (WHERE has_footprint AND demo_last IS NOT NULL)
            FROM s WHERE {where}""")
        rows.append([label, n, fp, pct(fp, n), nofp, pct(nofp, n), unknown, demo])
    write("footprint_conflicts",
          ["Group", "Parcels", "Footprint present", "Share", "No footprint", "Share", "No parcel shape",
           "Footprint present but a demolition is recorded"], rows)

    # ---------------------------------------------------------------- composition by rank
    rows = []
    for rank, n, k0, k1, k2, k3, fp in con.execute("""
        SELECT round(land_rank, 2), count(*),
               count(*) FILTER (WHERE n_lot_signals = 0), count(*) FILTER (WHERE n_lot_signals = 1),
               count(*) FILTER (WHERE n_lot_signals = 2), count(*) FILTER (WHERE n_lot_signals >= 3),
               count(*) FILTER (WHERE has_footprint)
        FROM s WHERE city_land GROUP BY 1 ORDER BY 1""").fetchall():
        lc = one(f"SELECT count(*) FROM s WHERE city_land AND round(land_rank, 2) = {rank} AND in_landcare")[0]
        rows.append([rank, n, pct(k0, n), pct(k1, n), pct(k2, n), pct(k3, n), pct(fp, n), pct(lc, n)])
    write("land_rank_composition",
          ["City land rank", "Parcels", "0 independent signals", "1", "2", "3 or more", "Footprint present",
           "In LandCare"], rows)
    rows = []
    for rank, n, fp, k0, k1, k2 in con.execute("""
        SELECT round(build_rank, 2), count(*), count(*) FILTER (WHERE has_footprint),
               count(*) FILTER (WHERE has_footprint AND n_bldg_signals = 0),
               count(*) FILTER (WHERE has_footprint AND n_bldg_signals = 1),
               count(*) FILTER (WHERE has_footprint AND n_bldg_signals >= 2)
        FROM s WHERE city_bldg GROUP BY 1 ORDER BY 1""").fetchall():
        rows.append([rank, n, pct(n - fp, n), pct(k0, fp), pct(k1, fp), pct(k2, fp)])
    write("build_rank_composition",
          ["City building rank", "Parcels", "No footprint (likely a lot now)",
           "Standing: 0 independent signals", "1", "2 or more"], rows)

    # ---------------------------------------------------------------- independent only candidates
    rows = []
    for label, where in [
        ("OPA vacant land and no footprint", "opa_vacant_land AND no_footprint"),
        ("No footprint only (OPA describes a building or other use)", "no_footprint AND NOT opa_vacant_land"),
        ("OPA vacant land, but a footprint is present", "opa_vacant_land AND has_footprint"),
        ("OPA vacant land, no parcel shape to check", "opa_vacant_land AND has_footprint IS NULL"),
        ("Lot violation or complaint only, footprint present", "lot_li_2y AND has_footprint AND NOT opa_vacant_land"),
        ("Demolished, no new construction permit, footprint present", "demo_no_newcon AND has_footprint AND NOT opa_vacant_land"),
    ]:
        n = one(f"SELECT count(*) FROM s WHERE NOT city_land AND NOT city_bldg AND {where}")[0]
        rows.append([label, n])
    n = one("SELECT count(*) FROM s WHERE NOT city_land AND NOT city_bldg AND n_bldg_signals >= 1 AND has_footprint")[0]
    rows.append(["Standing building with at least one independent building signal", n])
    write("not_on_city_lists", ["Independent evidence, parcel on neither City list", "Parcels"], rows)

    # ---------------------------------------------------------------- churn since June 2024
    since = f"DATE '{LIST_2024_DATE}'"
    measures = [
        ("Demolition recorded since June 2024", f"demo_last >= {since}"),
        ("Any demolition recorded since 2007", "demo_last IS NOT NULL"),
        ("New construction permit since June 2024", f"newcon_last >= {since}"),
        ("Any building, trade or zoning permit since June 2024", f"activity_last >= {since}"),
        ("Deed recorded since June 2024", "deeds_since_2024_06 > 0"),
        ("Sheriff deed since June 2024", "sheriff_deed_since_2024_06"),
        ("Land Bank deed since June 2024", "land_bank_deed_since_2024_06"),
        ("Permit or deed since June 2024", f"activity_last >= {since} OR deeds_since_2024_06 > 0"),
        ("Footprint present now", "has_footprint"),
        ("OPA says vacant land now", "opa_vacant_land"),
        ("In LandCare", "in_landcare"),
        ("Garden or park now", "excluded_use IN ('garden', 'park')"),
    ]
    for kind, now_col, then_col, other_now, other_then in [
        ("land", "city_land", "list2024_land", "city_bldg", "list2024_bldg"),
        ("buildings", "city_bldg", "list2024_bldg", "city_land", "list2024_land"),
    ]:
        groups = [
            ("Kept (on both lists)", f"{now_col} AND {then_col}"),
            ("New in 2026", f"{now_col} AND NOT {then_col}"),
            ("Dropped since 2024", f"{then_col} AND NOT {now_col}"),
        ]
        extra = [
            (f"On the other 2024 list", other_then),
            (f"On the other 2026 list", other_now),
        ]
        header = ["Measure"] + [g for g, _ in groups]
        sizes = [one(f"SELECT count(*) FROM s WHERE {w}")[0] for _, w in groups]
        rows = [["Parcels (account still in OPA)"] + sizes]
        for label, expr in measures + extra:
            vals = []
            for (_, w), n in zip(groups, sizes):
                k = one(f"SELECT count(*) FROM s WHERE ({w}) AND coalesce({expr}, false)")[0]
                vals.append(f"{k} ({pct(k, n)})")
            rows.append([label] + vals)
        write(f"churn_{kind}", header, rows)


if __name__ == "__main__":
    main()
