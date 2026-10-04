"""Spatial facts per Water Department parcel: building footprints, land use, parks, gardens, LandCare.

Writes out/parcel_spatial.parquet, one row per PWD parcel, keyed by parcelid with its OPA account.
Areas are in square meters (UTM zone 18N).
"""

from __future__ import annotations

import time

from common import OUT, connect, opa9, raw

UTM = "'EPSG:4326', 'EPSG:26918', always_xy := true"


def main() -> None:
    con = connect(memory="2GB", threads=4)
    t0 = time.time()

    def step(msg: str) -> None:
        print(f"[{time.time() - t0:6.0f}s] {msg}", flush=True)

    con.execute(f"""
        CREATE TABLE parcels AS
        SELECT CAST(parcelid AS BIGINT) AS parcelid,
               CASE WHEN brt_id IS NULL OR trim(brt_id) = '' THEN NULL ELSE {opa9('brt_id')} END AS opa,
               TRY_CAST(num_brt AS INT) AS num_brt,
               ST_Transform(geometry, {UTM}) AS g
        FROM read_parquet('{raw('pwd_parcels')}')
        WHERE geometry IS NOT NULL
    """)
    con.execute("ALTER TABLE parcels ADD COLUMN area_m2 DOUBLE; UPDATE parcels SET area_m2 = ST_Area(g);")
    con.execute("ALTER TABLE parcels ADD COLUMN pt GEOMETRY; UPDATE parcels SET pt = ST_PointOnSurface(g);")
    step(f"parcels: {con.execute('SELECT count(*) FROM parcels').fetchone()[0]}")

    con.execute(f"""
        CREATE TABLE fp AS
        SELECT CAST(objectid AS BIGINT) AS fid,
               TRY_CAST(parcel_id_num AS BIGINT) AS link_parcelid,
               TRY_CAST(approx_hgt AS DOUBLE) AS hgt,
               ST_Transform(geom, {UTM}) AS g
        FROM read_parquet('{raw('footprints')}')
        WHERE geom IS NOT NULL
    """)
    con.execute("ALTER TABLE fp ADD COLUMN area_m2 DOUBLE; UPDATE fp SET area_m2 = ST_Area(g);")
    step(f"footprints: {con.execute('SELECT count(*) FROM fp').fetchone()[0]}")

    # Every parcel and footprint pair that touches, with the area they share.
    con.execute("""
        CREATE TABLE pairs AS
        SELECT p.parcelid, f.fid, f.area_m2 AS fp_area,
               ST_Area(ST_Intersection(p.g, f.g)) AS overlap
        FROM parcels p JOIN fp f ON ST_Intersects(p.g, f.g)
    """)
    step(f"pairs: {con.execute('SELECT count(*) FROM pairs').fetchone()[0]}")

    con.execute("""
        CREATE TABLE fp_by_parcel AS
        SELECT parcelid,
               count(*) FILTER (WHERE overlap >= 1) AS fp_touching,
               sum(overlap) AS fp_overlap_m2,
               max(overlap) AS fp_max_piece_m2,
               count(*) FILTER (WHERE overlap >= 0.5 * fp_area) AS fp_mostly_inside
        FROM pairs GROUP BY parcelid
    """)
    con.execute("""
        CREATE TABLE fp_link AS
        SELECT link_parcelid AS parcelid, count(*) AS fp_linked, sum(area_m2) AS fp_linked_m2
        FROM fp WHERE link_parcelid IS NOT NULL GROUP BY 1
    """)
    con.execute("DROP TABLE pairs; DROP TABLE fp;")
    step("footprint summaries done")

    # Land use (Planning). One polygon per parcel in most places; take the polygon under the parcel's
    # interior point.
    con.execute(f"""
        CREATE TABLE lu AS
        SELECT TRY_CAST(c_dig1 AS INT) AS c1, TRY_CAST(c_dig2 AS INT) AS c2, TRY_CAST(c_dig3 AS INT) AS c3,
               TRY_CAST(year AS INT) AS lu_year, vacbldg, ST_Transform(geom, {UTM}) AS g
        FROM read_parquet('{raw('land_use')}')
        -- About 19 street right of way polygons have 70,000 or more vertices and span the city. Testing
        -- every parcel against them takes hours, and parcels do not sit in streets, so leave them out.
        WHERE geom IS NOT NULL AND ST_NPoints(geom) <= 5000
    """)
    con.execute("""
        CREATE TABLE lu_by_parcel AS
        SELECT p.parcelid, any_value(l.c1) AS lu_c1, any_value(l.c2) AS lu_c2, any_value(l.c3) AS lu_c3,
               any_value(l.lu_year) AS lu_year, any_value(l.vacbldg) AS lu_vacbldg
        FROM parcels p JOIN lu l ON ST_Within(p.pt, l.g) GROUP BY p.parcelid
    """)
    con.execute("DROP TABLE lu;")
    step("land use done")

    # Parks: the parcel's interior point lies in a Parks and Recreation property.
    con.execute(f"""
        CREATE TABLE ppr AS SELECT any_value(official_name) AS name, ST_Transform(geom, {UTM}) AS g
        FROM read_parquet('{raw('ppr_properties')}') WHERE geom IS NOT NULL GROUP BY geom
    """)
    con.execute("""
        CREATE TABLE ppr_by_parcel AS
        SELECT p.parcelid, any_value(r.name) AS ppr_name
        FROM parcels p JOIN ppr r ON ST_Within(p.pt, r.g) GROUP BY p.parcelid
    """)

    # Gardens: any garden point within 5 meters of the parcel.
    con.execute(f"""
        CREATE TABLE gardens AS
        SELECT 'PHS or NGT' AS src, Site_Name AS name, ST_Transform(geom, {UTM}) AS g FROM read_parquet('{raw('gardens_phs_ngt')}')
        UNION ALL
        SELECT 'Registered (PPR)', garden_name, ST_Transform(geom, {UTM}) FROM read_parquet('{raw('gardens_registered')}')
        UNION ALL
        SELECT 'PPR urban agriculture', project_name, ST_Transform(geom, {UTM}) FROM read_parquet('{raw('gardens_ppr_urban_ag')}')
    """)
    con.execute("""
        CREATE TABLE garden_by_parcel AS
        SELECT p.parcelid, string_agg(DISTINCT gd.src, '; ') AS garden_src, any_value(gd.name) AS garden_name
        FROM parcels p JOIN gardens gd ON ST_DWithin(p.g, gd.g, 5) GROUP BY p.parcelid
    """)

    # LandCare: the parcel's interior point lies in a LandCare site polygon.
    con.execute(f"""
        CREATE TABLE lc AS
        SELECT program, year, season, stabilized, {opa9('brt_id')} AS lc_opa, ST_Transform(geom, {UTM}) AS g
        FROM read_parquet('{raw('phs_landcare')}') WHERE geom IS NOT NULL
    """)
    con.execute("""
        CREATE TABLE lc_by_parcel AS
        SELECT p.parcelid, string_agg(DISTINCT l.program, '; ') AS lc_program, max(l.year) AS lc_year
        FROM parcels p JOIN lc l ON ST_Within(p.pt, l.g) GROUP BY p.parcelid
    """)

    # City vacant lot cleanup activity in 2026, published only as hexagons (area context, not parcel).
    con.execute(f"""
        CREATE TABLE hex AS SELECT CAST(unique_count AS INT) AS n, ST_Transform(geom, {UTM}) AS g
        FROM read_parquet('{raw('clip_hex_2026')}')
    """)
    con.execute("""
        CREATE TABLE hex_by_parcel AS
        SELECT p.parcelid, max(h.n) AS clip_hex_2026 FROM parcels p JOIN hex h ON ST_Within(p.pt, h.g)
        GROUP BY p.parcelid
    """)
    step("parks, gardens, LandCare, cleanup hexagons done")

    con.execute(f"""
        COPY (
            SELECT p.parcelid, p.opa, p.num_brt, p.area_m2,
                   ST_X(ST_Transform(p.pt, 'EPSG:26918', 'EPSG:4326', always_xy := true)) AS lon,
                   ST_Y(ST_Transform(p.pt, 'EPSG:26918', 'EPSG:4326', always_xy := true)) AS lat,
                   coalesce(f.fp_touching, 0) AS fp_touching, coalesce(f.fp_overlap_m2, 0) AS fp_overlap_m2,
                   coalesce(f.fp_max_piece_m2, 0) AS fp_max_piece_m2, coalesce(f.fp_mostly_inside, 0) AS fp_mostly_inside,
                   coalesce(k.fp_linked, 0) AS fp_linked, coalesce(k.fp_linked_m2, 0) AS fp_linked_m2,
                   u.lu_c1, u.lu_c2, u.lu_c3, u.lu_year, u.lu_vacbldg,
                   r.ppr_name, gd.garden_src, gd.garden_name, l.lc_program, l.lc_year, h.clip_hex_2026,
                   ST_AsWKB(ST_Transform(p.g, 'EPSG:26918', 'EPSG:4326', always_xy := true)) AS wkb
            FROM parcels p
            LEFT JOIN fp_by_parcel f USING (parcelid)
            LEFT JOIN fp_link k USING (parcelid)
            LEFT JOIN lu_by_parcel u USING (parcelid)
            LEFT JOIN ppr_by_parcel r USING (parcelid)
            LEFT JOIN garden_by_parcel gd USING (parcelid)
            LEFT JOIN lc_by_parcel l USING (parcelid)
            LEFT JOIN hex_by_parcel h USING (parcelid)
        ) TO '{OUT / 'parcel_spatial.parquet'}' (FORMAT parquet)
    """)
    step("wrote out/parcel_spatial.parquet")


if __name__ == "__main__":
    main()
