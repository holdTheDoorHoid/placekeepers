"""Build the per parcel signal table for the vacancy study.

Reads the raw research cache plus out/parcel_spatial.parquet (from spatial.py) and writes
out/signals.parquet: one row per OPA account (9 digits) that has at least one vacancy signal.

Signal definitions live here, in one place, so the pipeline can copy them (milestone M1.2).
"""

from __future__ import annotations

from common import CACHE, LIST_2024_DATE, OUT, TODAY, TWO_YEARS_AGO, connect, opa9, raw

# A parcel "has a building" when a footprint lies mostly (half or more of its area) inside the parcel,
# or a footprint the City links to this parcel overlaps it by at least FP_LINKED_MIN_M2. Calibrated in
# calibrate.py against near certain lots and near certain houses (see VACANCY_METHOD.md): raw overlap
# picks up slivers of neighbors' footprints, which this rule ignores.
FP_LINKED_MIN_M2 = 10.0

CS_RECENT_SINCE = "2021-10-04"  # five years before the study date
DEMO_TRUST_SINCE = "2023-01-01"  # demolitions since then count even if OPA still describes a building
NEWCON_PLANNED_SINCE = "2025-04-04"  # eighteen months before the study date

# The independent signals counted for each kind. The City's own lists are not in these sets.
LOT_SIGNALS = ["opa_vacant_land", "no_footprint", "demo_no_newcon", "lot_li_2y", "in_landcare"]
BLDG_SIGNALS = ["cs_recent_no_permit", "unsafe_no_permit", "idang_no_permit", "bldg_li_2y", "opa_ext_vacant"]


def valid_opa(col: str) -> str:
    return f"{col} IS NOT NULL AND length(regexp_replace({col}, '[^0-9]', '', 'g')) BETWEEN 8 AND 9"


def d(col: str) -> str:
    """Date from a Carto timestamp string such as '2024-06-24 04:00:00+00'."""
    return f"TRY_CAST(left({col}, 10) AS DATE)"


def main() -> None:
    con = connect(memory="2500MB", threads=4)
    q = con.execute

    # --- OPA base attributes -------------------------------------------------------------------
    q(f"""
        CREATE TABLE opa AS
        SELECT {opa9('parcel_number')} AS opa, location AS address, unit,
               category_code AS cat, category_code_description AS cat_desc,
               building_code_description AS bdesc, zoning, owner_1, owner_2,
               TRY_CAST(lat AS DOUBLE) AS opa_lat, TRY_CAST(lng AS DOUBLE) AS opa_lon,
               exterior_condition AS ext_cond, interior_condition AS int_cond,
               TRY_CAST(total_livable_area AS DOUBLE) AS livable_sqft, TRY_CAST(year_built AS INT) AS year_built,
               {d('sale_date')} AS opa_sale_date, TRY_CAST(sale_price AS DOUBLE) AS opa_sale_price,
               TRY_CAST(market_value AS DOUBLE) AS market_value
        FROM read_parquet('{raw('opa')}') WHERE {valid_opa('parcel_number')}
    """)

    # --- the City's lists, 2026 and the June 2024 lists the original project kept --------------
    q(f"""CREATE TABLE city_land AS SELECT {opa9('opa_id')} AS opa, max(land_rank) AS land_rank
          FROM read_parquet('{raw('vpi_land_2026')}') WHERE {valid_opa('opa_id')} GROUP BY 1""")
    q(f"""CREATE TABLE city_bldg AS SELECT {opa9('opa_id')} AS opa, max(build_rank) AS build_rank
          FROM read_parquet('{raw('vpi_bldg_2026')}') WHERE {valid_opa('opa_id')} GROUP BY 1""")
    q(f"""CREATE TABLE l24_land AS SELECT DISTINCT {opa9('opa_id')} AS opa
          FROM read_parquet('{CACHE / 'land_2024.parquet'}') WHERE {valid_opa('CAST(opa_id AS VARCHAR)')}""")
    q(f"""CREATE TABLE l24_bldg AS SELECT DISTINCT {opa9('opa_id')} AS opa
          FROM read_parquet('{CACHE / 'buildings_2024.parquet'}') WHERE opa_id IS NOT NULL""")

    # --- spatial facts (footprints, land use, parks, gardens, LandCare) -------------------------
    # An OPA account can sit on more than one Water Department parcel; combine them.
    q(f"""
        CREATE TABLE sp AS
        SELECT opa, count(*) AS pwd_parcels, sum(area_m2) AS area_m2,
               any_value(lon) AS lon, any_value(lat) AS lat,
               sum(fp_overlap_m2) AS fp_overlap_m2, max(fp_max_piece_m2) AS fp_max_piece_m2,
               sum(fp_mostly_inside) AS fp_mostly_inside, sum(fp_linked) AS fp_linked,
               any_value(lu_c1) AS lu_c1, any_value(lu_c2) AS lu_c2, any_value(lu_c3) AS lu_c3,
               any_value(lu_year) AS lu_year, any_value(lu_vacbldg) AS lu_vacbldg,
               any_value(ppr_name) AS ppr_name, any_value(garden_src) AS garden_src,
               any_value(garden_name) AS garden_name, any_value(lc_program) AS lc_program,
               any_value(lc_year) AS lc_year, max(clip_hex_2026) AS clip_hex_2026
        FROM read_parquet('{OUT / 'parcel_spatial.parquet'}') WHERE opa IS NOT NULL GROUP BY opa
    """)
    q(f"""
        ALTER TABLE sp ADD COLUMN has_footprint BOOLEAN;
        UPDATE sp SET has_footprint = fp_mostly_inside > 0 OR (fp_linked > 0 AND fp_max_piece_m2 >= {FP_LINKED_MIN_M2});
    """)
    # LandCare also lists one OPA account per site; count those too.
    q(f"""CREATE TABLE lc_attr AS SELECT {opa9('brt_id')} AS opa, string_agg(DISTINCT program, '; ') AS lc_program_attr
          FROM read_parquet('{raw('phs_landcare')}') WHERE {valid_opa('brt_id')} GROUP BY 1""")

    # --- L&I clean and seal --------------------------------------------------------------------
    q(f"""
        CREATE TABLE cs AS
        SELECT {opa9('opa_account_num')} AS opa, max({d('workordercompleteddate')}) AS cs_last, count(*) AS cs_n
        FROM read_parquet('{raw('clean_seal')}')
        WHERE {valid_opa('opa_account_num')} AND workorderstatus IN ('Approved', 'CLOSED', 'Conditional Approval')
              AND workordercompleteddate IS NOT NULL
        GROUP BY 1
    """)

    # --- demolitions (completed, full building; tank removals excluded) -------------------------
    q(f"""
        CREATE TABLE demo AS
        SELECT {opa9('opa_account_num')} AS opa,
               max(coalesce({d('completed_date')}, {d('start_date')})) AS demo_last,
               bool_or(city_demo = 'YES') AS demo_city,
               string_agg(DISTINCT typeofwork, '; ') AS demo_types
        FROM read_parquet('{raw('demolitions')}')
        WHERE {valid_opa('opa_account_num')} AND status = 'COMPLETED' AND typeofwork <> 'TANKRI'
              AND coalesce({d('completed_date')}, {d('start_date')}) <= DATE '{TODAY}'
        GROUP BY 1
    """)

    # --- unsafe and imminently dangerous: the City's current open lists --------------------------
    q(f"""CREATE TABLE unsafe_now AS SELECT {opa9('opa_account_num')} AS opa, min({d('violationdate')}) AS unsafe_since
          FROM read_parquet('{raw('unsafe')}') WHERE {valid_opa('opa_account_num')} GROUP BY 1""")
    q(f"""CREATE TABLE idang_now AS SELECT {opa9('opa_account_num')} AS opa, min({d('violationdate')}) AS idang_since
          FROM read_parquet('{raw('imm_dang')}') WHERE {valid_opa('opa_account_num')} GROUP BY 1""")

    # --- permits since 2016, sorted into kinds ----------------------------------------------------
    q(f"""
        CREATE TABLE pm AS
        SELECT {opa9('opa_account_num')} AS opa, {d('permitissuedate')} AS issued, permittype, typeofwork,
          CASE
            WHEN typeofwork ILIKE '%interior%demo%' OR typeofwork = 'INTERI' THEN 'reuse'
            WHEN permittype IN ('Demolition', 'BP_DEMO') OR typeofwork ILIKE '%demolition%'
                 OR typeofwork ILIKE '%make safe%' OR typeofwork IN ('TANKRI', 'Tank Install/Removal', 'COMDEM')
                 THEN 'demo_or_make_safe'
            WHEN (permittype IN ('Residential Building', 'Building', 'Master Plan') AND typeofwork ILIKE 'New Construction%')
                 OR permittype = 'BP_NEWCNST' THEN 'newcon_building'
            WHEN typeofwork ILIKE 'New Construction%' OR typeofwork = 'Foundation' THEN 'newcon_trade'
            WHEN permittype ILIKE 'Zoning%' OR permittype LIKE 'ZP_%' THEN
                 CASE WHEN typeofwork ILIKE 'New construction%' OR typeofwork IN ('NEWCON', 'Combined Lot Line Relocation and New Development')
                      THEN 'newcon_zoning' ELSE 'zoning_other' END
            WHEN permittype IN ('Operations', 'OPS PERMIT', 'General', 'Site / Utility Permit') THEN 'other'
            ELSE 'reuse'
          END AS kind
        FROM read_parquet('{raw('permits')}')
        WHERE {valid_opa('opa_account_num')} AND permitissuedate IS NOT NULL
    """)
    q("""
        CREATE TABLE pm_by AS
        SELECT opa,
               max(issued) FILTER (WHERE kind IN ('newcon_building', 'newcon_trade', 'newcon_zoning')) AS newcon_last,
               max(issued) FILTER (WHERE kind = 'newcon_building') AS newcon_bldg_last,
               max(issued) FILTER (WHERE kind = 'reuse') AS reuse_last,
               max(issued) FILTER (WHERE kind IN ('reuse', 'newcon_building', 'newcon_trade', 'newcon_zoning', 'zoning_other')) AS activity_last
        FROM pm GROUP BY opa
    """)

    # --- violations and complaints in the last two years ------------------------------------------
    q(f"""
        CREATE TABLE v AS
        SELECT {opa9('opa_account_num')} AS opa, {d('violationdate')} AS vdate, violationcode AS code,
          CASE
            WHEN violationcode IN ('10-715') OR violationcode LIKE '10-710%' THEN 'dumping_litter'
            WHEN violationcode = '9-3904' THEN 'vac_lot_license'
            WHEN violationcode = 'PM15-301' THEN 'vac_struct_land'
            WHEN violationcodetitle ILIKE '%VACAN%' THEN 'vac_bldg'
            WHEN violationcode = 'PM15-302.4' THEN 'weeds'
            WHEN violationcode IN ('PM15-308.1', 'PM15-308.2', 'PM15-308.2.2') THEN 'rubbish'
            WHEN violationcode = 'PM15-302.1' THEN 'sanitation'
            WHEN violationcode = 'PM15-108.1' THEN 'unsafe'
            WHEN violationcode = 'PM15-110.1' THEN 'imm_dang'
            WHEN violationcode = 'PM15-109.1' THEN 'unfit'
            ELSE 'other'
          END AS vk
        FROM read_parquet('{raw('violations')}')
        WHERE {valid_opa('opa_account_num')} AND {d('violationdate')} BETWEEN DATE '{TWO_YEARS_AGO}' AND DATE '{TODAY}'
    """)
    q("""
        CREATE TABLE v_by AS
        SELECT opa,
               count(*) FILTER (WHERE vk = 'vac_lot_license') AS v_vac_lot,
               count(*) FILTER (WHERE vk = 'vac_struct_land') AS v_vac_struct_land,
               count(*) FILTER (WHERE vk = 'vac_bldg') AS v_vac_bldg,
               count(*) FILTER (WHERE vk = 'weeds') AS v_weeds,
               count(*) FILTER (WHERE vk = 'rubbish') AS v_rubbish,
               count(*) FILTER (WHERE vk = 'sanitation') AS v_sanitation,
               count(*) FILTER (WHERE vk = 'dumping_litter') AS v_dumping,
               count(*) FILTER (WHERE vk = 'unsafe') AS v_unsafe,
               count(*) FILTER (WHERE vk = 'imm_dang') AS v_imm_dang,
               count(*) FILTER (WHERE vk = 'unfit') AS v_unfit,
               max(vdate) FILTER (WHERE vk IN ('vac_struct_land', 'vac_bldg', 'unsafe', 'imm_dang', 'unfit')) AS v_bldg_last
        FROM v GROUP BY opa
    """)
    q(f"""
        CREATE TABLE c_by AS
        SELECT {opa9('opa_account_num')} AS opa,
               count(*) FILTER (WHERE complaintcode = 'VL') AS c_vac_lot,
               count(*) FILTER (WHERE complaintcode = 'VA') AS c_vac_prop,
               count(*) FILTER (WHERE complaintcode = 'VO') AS c_vac_open,
               count(*) FILTER (WHERE complaintcode = 'BDNO') AS c_unoccupied_deficient,
               count(*) FILTER (WHERE complaintcode = 'PMHW') AS c_weeds,
               count(*) FILTER (WHERE complaintcode = 'PME') AS c_exterior,
               count(*) FILTER (WHERE complaintcode = 'DEMO') AS c_demo
        FROM read_parquet('{raw('complaints')}')
        WHERE {valid_opa('opa_account_num')} AND {d('complaintdate')} BETWEEN DATE '{TWO_YEARS_AGO}' AND DATE '{TODAY}'
        GROUP BY 1
    """)

    # --- sales since the June 2024 lists ----------------------------------------------------------
    q(f"""
        CREATE TABLE deeds_by AS
        SELECT {opa9('opa_account_num')} AS opa, count(*) AS deeds_since_2024_06,
               max({d('recording_date')}) AS deed_last,
               bool_or(document_type IN ('SHERIFF''S DEED', 'DEED SHERIFF')) AS sheriff_deed_since_2024_06,
               bool_or(document_type = 'DEED LAND BANK') AS land_bank_deed_since_2024_06
        FROM read_parquet('{raw('deeds')}')
        WHERE {valid_opa('opa_account_num')} AND {d('recording_date')} >= DATE '{LIST_2024_DATE}'
        GROUP BY 1
    """)

    # --- likely side yards: a private owner who also owns the lived in building next door ----------
    # Philadelphia numbers each side of a street by twos, so the neighbors of 1234 are 1232 and 1236.
    # Ranges such as 1837-39 cover every number in between.
    q(f"""
        CREATE TABLE addr AS
        WITH parsed AS (
          SELECT opa, upper(trim(owner_1)) AS own, coalesce(livable_sqft, 0) > 0 AS lived_in,
                 regexp_extract(address, '^([0-9]+)(-[0-9]+)?[A-Z]? +(.+)$', 3) AS street,
                 TRY_CAST(regexp_extract(address, '^([0-9]+)', 1) AS INT) AS lo,
                 regexp_extract(address, '^[0-9]+-([0-9]+)', 1) AS hi_tail
          FROM opa WHERE address IS NOT NULL AND unit IS NULL
        )
        SELECT opa, own, lived_in, street, lo,
               CASE WHEN hi_tail = '' OR hi_tail IS NULL THEN lo
                    ELSE TRY_CAST(left(CAST(lo AS VARCHAR), length(CAST(lo AS VARCHAR)) - length(hi_tail)) || hi_tail AS INT)
               END AS hi
        FROM parsed WHERE street <> '' AND lo IS NOT NULL
    """)
    q("""
        CREATE TABLE addr_n AS
        SELECT opa, own, lived_in, street, unnest(generate_series(lo, greatest(lo, coalesce(hi, lo)), 2)) AS n
        FROM addr WHERE coalesce(hi, lo) - lo BETWEEN 0 AND 40
    """)
    q("""
        CREATE TABLE side_yard AS
        SELECT a.opa, true AS side_yard_likely
        FROM addr a JOIN addr_n b
          ON b.street = a.street AND (b.n = a.lo - 2 OR b.n = coalesce(a.hi, a.lo) + 2)
         AND b.opa <> a.opa AND b.own = a.own AND b.lived_in
        WHERE a.own IS NOT NULL
          AND NOT regexp_matches(a.own, 'CITY OF PHILA|LAND BANK|REDEVELOPMENT|HOUSING AUTH|PHILA HOUSING|PHDC|PHILADELPHIA HOUSING DEV|COMMONWEALTH|SCHOOL DIST')
        GROUP BY a.opa
    """)

    # --- assemble one row per OPA account ---------------------------------------------------------
    q("""
        CREATE TABLE s AS
        SELECT o.*, sp.* EXCLUDE (opa),
               cl.land_rank, cb.build_rank,
               cl.opa IS NOT NULL AS city_land, cb.opa IS NOT NULL AS city_bldg,
               ll.opa IS NOT NULL AS list2024_land, lb.opa IS NOT NULL AS list2024_bldg,
               la.lc_program_attr,
               cs.cs_last, cs.cs_n, demo.demo_last, demo.demo_city, demo.demo_types,
               un.unsafe_since, idg.idang_since,
               pm_by.* EXCLUDE (opa), v_by.* EXCLUDE (opa), c_by.* EXCLUDE (opa), deeds_by.* EXCLUDE (opa),
               coalesce(sy.side_yard_likely, false) AS side_yard_likely
        FROM opa o
        LEFT JOIN sp USING (opa)
        LEFT JOIN city_land cl USING (opa)
        LEFT JOIN city_bldg cb USING (opa)
        LEFT JOIN l24_land ll USING (opa)
        LEFT JOIN l24_bldg lb USING (opa)
        LEFT JOIN lc_attr la USING (opa)
        LEFT JOIN cs USING (opa)
        LEFT JOIN demo USING (opa)
        LEFT JOIN unsafe_now un USING (opa)
        LEFT JOIN idang_now idg USING (opa)
        LEFT JOIN pm_by USING (opa)
        LEFT JOIN v_by USING (opa)
        LEFT JOIN c_by USING (opa)
        LEFT JOIN deeds_by USING (opa)
        LEFT JOIN side_yard sy USING (opa)
    """)
    missing = q("""
        SELECT count(*) FROM (SELECT opa FROM city_land UNION SELECT opa FROM city_bldg
                              UNION SELECT opa FROM l24_land UNION SELECT opa FROM l24_bldg) x
        WHERE opa NOT IN (SELECT opa FROM opa)
    """).fetchone()[0]
    print(f"listed parcels whose OPA account is no longer in OPA: {missing}")

    # --- derived signal flags -----------------------------------------------------------------------
    q(f"""
        CREATE TABLE sig AS
        SELECT *,
          -- OPA says vacant land: the category code, not the building description, because the
          -- description lags new construction (spot check round 1). No livable area, and parking
          -- and park descriptions are not counted.
          cat IN ('6', '12', '13') AND coalesce(livable_sqft, 0) = 0
            AND NOT (bdesc ILIKE '%PKG%' OR bdesc ILIKE '%PARKING%' OR bdesc ILIKE '%PARK' OR bdesc ILIKE '%CAR LOT%') AS opa_vacant_land,
          bdesc ILIKE 'VAC%LAND%' AS opa_desc_vacant_land,
          -- OPA describes a building with living space (category other than vacant land)
          cat NOT IN ('6', '12', '13') AND coalesce(livable_sqft, 0) > 0 AS opa_says_building,
          -- Land use 2023 codes: c2 51 transportation (parking, rail, streets), 52 greened right of way,
          -- 71 park or open space (c3 712 community agriculture), 72 cemetery, 81 water, 91 vacant.
          (bdesc ILIKE '%PKG%' OR bdesc ILIKE '%PARKING%' OR bdesc ILIKE '%CAR LOT%' OR lu_c3 = 514) AS is_parking,
          (ppr_name IS NOT NULL OR bdesc ILIKE '%PARK' OR (lu_c2 = 71 AND coalesce(lu_c3, 0) <> 712)) AS is_park,
          (garden_src IS NOT NULL OR lu_c3 = 712) AS is_garden,
          (bdesc ILIKE '%RAILROAD%' OR bdesc ILIKE '%RAIL %' OR lu_c3 = 512) AS is_rail,
          (lu_c2 = 51 AND coalesce(lu_c3, 0) NOT IN (512, 514)) AS is_transport,
          (bdesc ILIKE '%UTIL%' OR lu_c3 = 314) AS is_utility,
          (bdesc ILIKE '%CEMETER%' OR lu_c2 = 72) AS is_cemetery,
          (lu_c2 IN (52, 81) OR lu_c3 = 511) AS is_water_or_row,
          -- OPA assessor saw a vacant (6) or sealed or open to the weather (7) exterior
          ext_cond IN ('6', '7') AS opa_ext_vacant,
          lu_c2 = 91 AS lu_vacant,
          coalesce(lc_program, lc_program_attr) AS landcare
        FROM s
    """)
    q("""
        ALTER TABLE sig ADD COLUMN excluded_use VARCHAR;
        UPDATE sig SET excluded_use = CASE
            WHEN is_park THEN 'park' WHEN is_garden THEN 'garden' WHEN is_parking THEN 'parking'
            WHEN is_rail THEN 'rail' WHEN is_transport THEN 'transportation' WHEN is_utility THEN 'utility'
            WHEN is_cemetery THEN 'cemetery' WHEN is_water_or_row THEN 'water or street' END;
    """)
    q(f"""
        CREATE TABLE out AS
        SELECT *,
          -- lot signals
          -- no footprint counts only where OPA does not describe a lived in building, because the
          -- footprint layer has gaps under some occupied houses (spot check round 1)
          (has_footprint = false AND excluded_use IS NULL AND area_m2 >= 20 AND NOT opa_says_building) AS no_footprint,
          -- a demolition counts only if nothing was built after it. OPA is slow to recode demolished
          -- houses (41 percent of 2024 City demolitions are still described as houses), so a recent
          -- demolition counts even when OPA still describes a building; an older one does not.
          (demo_last IS NOT NULL AND (newcon_last IS NULL OR newcon_last < demo_last)
             AND NOT coalesce(year_built >= year(demo_last), false)
             AND (demo_last >= DATE '{DEMO_TRUST_SINCE}' OR NOT opa_says_building)) AS demo_no_newcon,
          -- contradictions that lower confidence
          (newcon_last >= DATE '{CS_RECENT_SINCE}' AND (demo_last IS NULL OR newcon_last >= demo_last)) AS recent_newcon,
          -- a new construction permit from October 2021 to March 2025 probably has a building by now
          -- (spot check round 1); one from April 2025 on means construction is planned or starting
          (newcon_last >= DATE '{CS_RECENT_SINCE}' AND newcon_last < DATE '{NEWCON_PLANNED_SINCE}'
             AND (demo_last IS NULL OR newcon_last >= demo_last)) AS newcon_probably_built,
          (newcon_last >= DATE '{NEWCON_PLANNED_SINCE}' AND (demo_last IS NULL OR newcon_last >= demo_last)) AS newcon_planned,
          (lu_c2 IS NOT NULL AND lu_c2 NOT IN (91, 92)) AS lu_developed,
          (activity_last >= DATE '{TWO_YEARS_AGO}') AS recent_permit,
          (demo_last IS NOT NULL AND newcon_last >= demo_last) AS demo_then_newcon,
          (coalesce(v_vac_lot, 0) + coalesce(c_vac_lot, 0)) > 0 AS lot_li_2y,
          (coalesce(v_weeds, 0) + coalesce(v_rubbish, 0) + coalesce(v_sanitation, 0) + coalesce(v_dumping, 0)
             + coalesce(c_weeds, 0)) > 0 AS condition_li_2y,
          landcare IS NOT NULL AS in_landcare,
          -- building signals
          (cs_last IS NOT NULL AND (activity_last IS NULL OR activity_last <= cs_last)) AS cs_no_permit,
          (cs_last IS NOT NULL AND activity_last > cs_last) AS cs_then_permit,
          (unsafe_since IS NOT NULL AND (activity_last IS NULL OR activity_last <= unsafe_since)) AS unsafe_no_permit,
          (idang_since IS NOT NULL AND (activity_last IS NULL OR activity_last <= idang_since)) AS idang_no_permit,
          (coalesce(v_vac_bldg, 0) + coalesce(c_vac_prop, 0) + coalesce(c_vac_open, 0)
             + coalesce(c_unoccupied_deficient, 0)) > 0 AS bldg_li_2y,
          coalesce(v_vac_struct_land, 0) > 0 AS vacant_structure_or_land_2y,
          (coalesce(v_unsafe, 0) + coalesce(v_imm_dang, 0) + coalesce(v_unfit, 0)) > 0 AS danger_violation_2y
        FROM sig
    """)
    # Clean and seal counts as a building signal only when recent (five years), with no permit since,
    # and the building still stands; most older sealed houses were later demolished or reused.
    q(f"""
        ALTER TABLE out ADD COLUMN cs_recent_no_permit BOOLEAN;
        UPDATE out SET cs_recent_no_permit = coalesce(cs_no_permit AND cs_last >= DATE '{CS_RECENT_SINCE}'
                                                      AND has_footprint, false);
        ALTER TABLE out ADD COLUMN n_lot_signals INT;
        UPDATE out SET n_lot_signals = {' + '.join(f'coalesce({c}, false)::INT' for c in LOT_SIGNALS)};
        ALTER TABLE out ADD COLUMN n_bldg_signals INT;
        UPDATE out SET n_bldg_signals = {' + '.join(f'coalesce({c}, false)::INT' for c in BLDG_SIGNALS)};
    """)
    q(f"""
        COPY (
          SELECT * FROM out
          WHERE city_land OR city_bldg OR list2024_land OR list2024_bldg OR opa_vacant_land OR opa_ext_vacant
             OR opa_desc_vacant_land
             OR no_footprint OR demo_last IS NOT NULL OR lot_li_2y OR condition_li_2y OR in_landcare
             OR cs_last IS NOT NULL OR unsafe_since IS NOT NULL OR idang_since IS NOT NULL OR bldg_li_2y
             OR vacant_structure_or_land_2y OR danger_violation_2y OR lu_vacant
        ) TO '{OUT / 'signals.parquet'}' (FORMAT parquet)
    """)
    n = q(f"SELECT count(*) FROM read_parquet('{OUT / 'signals.parquet'}')").fetchone()[0]
    print(f"signal table: {n} parcels with at least one signal -> {OUT / 'signals.parquet'}")


if __name__ == "__main__":
    main()
