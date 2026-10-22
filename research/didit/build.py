"""Build the places, the care records and the outcome counts for the "Did it work?" study.

    ../../pipeline/.venv/bin/python build.py

Reads the pipeline's snapshots in the shared cache and the two histories fetch.py downloaded.
Writes out/study.npz: one row per place (a square of the city 100 meters across), the half years in
which each kind of care happened there, and the outcome counts near it by half year. Prints what it
found about the dates of each kind of care.

Places are squares, not parcels, so that two lots greened the same season on one block count once,
and so that the same square can be a cared for place in one comparison and a comparison place in
another, measured the same way.
"""

from __future__ import annotations

import json

import h3
import numpy as np
from common import DERIVED, OUT, RAW, connect, snapshot
from method import count_near
from pyproj import Transformer

FIRST_YEAR = 2015  # the shootings start in January 2015
N_HALVES = 24  # 2015 first half to 2026 second half
LAST_COMPLETE = 22  # 2026 first half: the last half year every outcome covers in full
CELL = 100.0  # meters
RADII = (200.0, 400.0)  # the counting circle, and the ring around it for crime moving elsewhere
CLUSTER_RES = 7  # H3 resolution of the bootstrap areas, about 5 square kilometers each

TO_M = Transformer.from_crs("EPSG:4326", "EPSG:32618", always_xy=True)
TO_LL = Transformer.from_crs("EPSG:32618", "EPSG:4326", always_xy=True)

# L&I complaints about vacant lots and vacant buildings, under the names used before and after the
# City's new system of 2020 (an inspection program, "VACANT STRATEGY INSPECTIONS", is left out).
COMPLAINT_KINDS = "kind ILIKE '%VACANT%' AND kind <> 'VACANT STRATEGY INSPECTIONS'"


def halves(con, sql: str) -> np.ndarray:
    return np.asarray([r[0] for r in con.execute(sql).fetchall()])


def cell_of(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return np.floor(x / CELL).astype(np.int64) * 1_000_000 + np.floor(y / CELL).astype(np.int64)


def project(lng, lat):
    x, y = TO_M.transform(np.asarray(lng, float), np.asarray(lat, float))
    return np.asarray(x), np.asarray(y)


def landcare(con) -> dict:
    """PHS LandCare: the year and season each lot joined, where the layer gives them."""
    rows = con.execute(
        f"""
        SELECT ST_X(ST_Centroid(geometry)) AS lng, ST_Y(ST_Centroid(geometry)) AS lat,
               try_cast(nullif(trim(year), '') AS INTEGER) AS year,
               lower(trim(replace(season, '''', ''))) AS season, program
        FROM '{snapshot("phs_landcare")}' WHERE geometry IS NOT NULL
        """
    ).fetchall()
    lng, lat, year, season, program = (np.asarray(v, dtype=object) for v in zip(*rows, strict=True))
    year = np.asarray([y if y is not None else -1 for y in year], dtype=int)
    half = np.full(len(rows), -9, dtype=int)
    spring = season == "spring"
    fall = season == "fall"
    dated = (year >= 1990) & (spring | fall)
    half[dated & spring] = (year[dated & spring] - FIRST_YEAR) * 2
    half[dated & fall] = (year[dated & fall] - FIRST_YEAR) * 2 + 1
    x, y = project(lng.astype(float), lat.astype(float))
    summary = {
        "rows": len(rows),
        "dated_year_and_season": int(dated.sum()),
        "year_only_or_other_season": int(((year >= 1990) & ~dated).sum()),
        "no_year": int((year < 1990).sum()),
        "by_program": {
            p: {"rows": int((program == p).sum()), "dated": int(((program == p) & dated).sum())}
            for p in sorted(set(program.tolist()))
        },
    }
    return {"x": x, "y": y, "half": half, "dated": dated, "summary": summary}


def clean_seal(con) -> dict:
    """The City's clean and seal work orders, completed, by the day the work was completed."""
    rows = con.execute(
        f"""
        SELECT lng, lat, coalesce(workordercompleteddate, casecompleteddate)::DATE AS day
        FROM '{snapshot("li_clean_and_seal")}'
        WHERE upper(workorderstatus) IN ('APPROVED', 'CLOSED', 'WORK COMPLETE')
          AND lat IS NOT NULL AND coalesce(workordercompleteddate, casecompleteddate) IS NOT NULL
        """
    ).fetchall()
    lng, lat, day = zip(*rows, strict=True)
    day = np.asarray(day, dtype="datetime64[D]")
    years = day.astype("datetime64[Y]").astype(int) + 1970
    months = day.astype("datetime64[M]").astype(int) % 12 + 1
    x, y = project(lng, lat)
    half = (years - FIRST_YEAR) * 2 + (months > 6)
    summary = {
        "rows": len(rows),
        "by_year": {int(yy): int((years == yy).sum()) for yy in range(2007, 2027)},
    }
    return {"x": x, "y": y, "half": half, "dated": np.ones(len(rows), bool), "summary": summary}


def demolitions(con) -> dict:
    """Demolitions the City carried out (city_demo YES), completed, by the day completed."""
    rows = con.execute(
        f"""
        SELECT lng, lat, completed_date::DATE AS day
        FROM '{snapshot("li_demolitions")}'
        WHERE city_demo = 'YES' AND upper(status) = 'COMPLETED' AND typeofwork <> 'TANKRI'
          AND lat IS NOT NULL AND completed_date IS NOT NULL
          AND completed_date::DATE <= DATE '2026-12-31'
        """
    ).fetchall()
    lng, lat, day = zip(*rows, strict=True)
    day = np.asarray(day, dtype="datetime64[D]")
    years = day.astype("datetime64[Y]").astype(int) + 1970
    months = day.astype("datetime64[M]").astype(int) % 12 + 1
    x, y = project(lng, lat)
    half = (years - FIRST_YEAR) * 2 + (months > 6)
    summary = {
        "rows": len(rows),
        "by_year": {int(yy): int((years == yy).sum()) for yy in range(2007, 2027)},
    }
    return {"x": x, "y": y, "half": half, "dated": np.ones(len(rows), bool), "summary": summary}


def vacant_pool(con, kinds: tuple[str, ...]) -> tuple[np.ndarray, np.ndarray]:
    """Vacant parcels today (high or medium confidence) of the given kinds, not in LandCare."""
    names = ", ".join(f"'{k}'" for k in kinds)
    rows = con.execute(
        f"""
        SELECT ST_X(ST_Centroid(geometry)), ST_Y(ST_Centroid(geometry))
        FROM '{DERIVED / "vacancy.parquet"}'
        WHERE kind IN ({names}) AND confidence IN ('high', 'medium') AND NOT coalesce(in_landcare, FALSE)
          AND geometry IS NOT NULL
        """
    ).fetchall()
    lng, lat = zip(*rows, strict=True)
    return project(lng, lat)


def events(con, sql: str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rows = con.execute(sql).fetchall()
    lng, lat, day = zip(*rows, strict=True)
    day = np.asarray(day, dtype="datetime64[D]")
    years = day.astype("datetime64[Y]").astype(int) + 1970
    months = day.astype("datetime64[M]").astype(int) % 12 + 1
    x, y = project(lng, lat)
    return x, y, (years - FIRST_YEAR) * 2 + (months > 6)


def main() -> None:
    con = connect()
    treatments = {
        "landcare": landcare(con),
        "clean_seal": clean_seal(con),
        "demolition": demolitions(con),
    }
    lot_x, lot_y = vacant_pool(con, ("lot",))
    bldg_x, bldg_y = vacant_pool(con, ("building",))
    pools = {
        "landcare": cell_of(lot_x, lot_y),
        "clean_seal": np.concatenate([cell_of(lot_x, lot_y), cell_of(bldg_x, bldg_y)]),
        "demolition": cell_of(bldg_x, bldg_y),
    }
    # The universe of places: every square with care of any kind or a vacant parcel today.
    all_cells = np.unique(
        np.concatenate(
            [cell_of(t["x"], t["y"]) for t in treatments.values()] + list(pools.values())
        )
    )
    index = {c: i for i, c in enumerate(all_cells.tolist())}
    n = len(all_cells)
    cx = (all_cells // 1_000_000 + 0.5) * CELL
    cy = (all_cells % 1_000_000 + 0.5) * CELL
    lng, lat = TO_LL.transform(cx, cy)
    print(f"{n:,} places (squares 100 m across)")

    # Tract poverty at each square's center.
    con.execute("CREATE TEMP TABLE pts (i INTEGER, lng DOUBLE, lat DOUBLE)")
    con.executemany(
        "INSERT INTO pts VALUES (?, ?, ?)",
        list(zip(range(n), np.asarray(lng).tolist(), np.asarray(lat).tolist(), strict=True)),
    )
    pov = dict(
        con.execute(
            f"""
            SELECT p.i, a.poverty_pct
            FROM pts p
            JOIN '{snapshot("census_tracts_2020")}' t ON ST_Contains(t.geometry, ST_Point(p.lng, p.lat))
            LEFT JOIN '{snapshot("acs_poverty")}' a ON a.geoid = t.geoid
            """
        ).fetchall()
    )
    poverty = np.asarray(
        [pov.get(i, np.nan) if pov.get(i) is not None else np.nan for i in range(n)], dtype=float
    )
    cluster_labels = [
        h3.latlng_to_cell(la, lo, CLUSTER_RES) for la, lo in zip(lat, lng, strict=True)
    ]
    _, cluster = np.unique(np.asarray(cluster_labels), return_inverse=True)
    in_city = np.isfinite(poverty) | np.asarray([i in pov for i in range(n)])

    arrays: dict[str, np.ndarray] = {
        "cell": all_cells,
        "x": cx,
        "y": cy,
        "lng": np.asarray(lng),
        "lat": np.asarray(lat),
        "poverty": poverty,
        "cluster": cluster.astype(np.int64),
        "in_city": in_city,
    }
    summary: dict = {"places": n}
    for name, t in treatments.items():
        cells = cell_of(t["x"], t["y"])
        rows = np.asarray([index[c] for c in cells.tolist()])
        care = np.zeros((n, N_HALVES), dtype=bool)
        ok = t["dated"] & (t["half"] >= 0) & (t["half"] < N_HALVES)
        care[rows[ok], t["half"][ok]] = True
        undated = np.zeros(n, dtype=bool)
        undated[rows[~t["dated"]]] = True
        pool = np.zeros(n, dtype=bool)
        pool[[index[c] for c in pools[name].tolist()]] = True
        relevant = care.any(axis=1) | undated | pool
        # Places with care before 2015 only (or never dated) are kept: they may be compared.
        before = t["dated"] & (t["half"] < 0)
        relevant[rows[before]] = True
        arrays[f"{name}_care"] = care
        arrays[f"{name}_undated"] = undated
        arrays[f"{name}_pool"] = pool
        arrays[f"{name}_relevant"] = relevant
        summary[name] = {
            **t["summary"],
            "places_with_care_2015_to_2026": int(care.any(axis=1).sum()),
            "places_with_undated_care": int(undated.sum()),
            "pool_places": int(pool.sum()),
            "new_care_by_half": {int(h): int(v) for h, v in enumerate(care.sum(axis=0))},
        }

    shootings = events(
        con,
        f"SELECT lng, lat, date_ FROM '{snapshot('shootings')}' "
        "WHERE lat IS NOT NULL AND date_ IS NOT NULL",
    )
    dumping = events(con, f"SELECT lng, lat, day FROM '{RAW / 'dumping.parquet'}' WHERE lat > 39")
    complaints = events(
        con,
        f"SELECT lng, lat, day FROM '{RAW / 'complaints.parquet'}' "
        f"WHERE lat > 39 AND {COMPLAINT_KINDS}",
    )
    for name, (ex, ey, eh) in {
        "shootings": shootings,
        "dumping": dumping,
        "complaints": complaints,
    }.items():
        counts = count_near(cx, cy, ex, ey, eh, N_HALVES, RADII)
        # Events inside the place's own square, to leave out where an outcome is about the parcel
        # itself (a complaint or a dumping report about the very lot that got care).
        own = np.zeros((n, N_HALVES), dtype=np.int32)
        ecell = cell_of(ex, ey)
        hit = np.isin(ecell, all_cells) & (eh >= 0) & (eh < N_HALVES)
        rows = np.searchsorted(all_cells, ecell[hit])
        np.add.at(own, (rows, eh[hit]), 1)
        arrays[f"{name}_near"] = counts[:, :, 0]
        arrays[f"{name}_ring"] = counts[:, :, 1]
        arrays[f"{name}_own"] = own
        summary[f"{name}_events"] = len(ex)
        print(f"{name}: {len(ex):,} events; near counts total {int(counts[:, :, 0].sum()):,}")
    np.savez_compressed(OUT / "study.npz", **arrays)
    (OUT / "study_summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if not isinstance(v, dict)}, indent=2))
    for name in treatments:
        s = dict(summary[name])
        by_half = s.pop("new_care_by_half")
        print(name, json.dumps(s, indent=1)[:1500])
        print("  new care by half:", by_half)


if __name__ == "__main__":
    main()
