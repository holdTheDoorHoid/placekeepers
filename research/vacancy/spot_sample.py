"""Draw the stratified aerial spot check sample and fetch a 2023 orthophoto crop for each parcel.

Strata (lots and buildings separately; signal sets are defined in build_signals.py):
  lot city_only         on the City's 2026 land list, at most one independent lot signal agrees
  lot both              on the City's land list, two or more independent lot signals agree
  lot indep_only_2plus  on neither City list, two or more independent lot signals
  lot indep_only_1      on neither City list, exactly one independent lot signal
  building city_only    on the City's 2026 building list, no independent building signal
  building both         on the City's building list, at least one independent building signal
  building indep_only   on neither City list, at least one independent building signal

Crops come from the City's 2023 orthophoto tile service (CityImagery_2023), fetched one tile at a
time with a pause, mosaicked, cropped around the parcel, and outlined in yellow. They are saved to
out/crops/ (git ignored) under blind codes, so the labeler cannot see the stratum. The key is
out/spot_sample.csv; out/blind_list.txt lists the codes in labeling order.
"""

from __future__ import annotations

import io
import math
import random
import time

import csv

from PIL import Image, ImageDraw
from shapely import wkb as shapely_wkb
from shapely.ops import unary_union

from common import OUT, client, connect

TILE_URL = "https://tiles.arcgis.com/tiles/fLeGjb7u4uXqeF9q/arcgis/rest/services/CityImagery_2023/MapServer/tile/{z}/{y}/{x}"
SEED = 20261004
PER_STRATUM = {"lot": {"city_only": 13, "both": 13, "indep_only_2plus": 7, "indep_only_1": 7},
               "building": {"city_only": 13, "both": 13, "indep_only": 14}}
CROPS = OUT / "crops"
CROPS.mkdir(parents=True, exist_ok=True)
TILE_PAUSE = 0.25

LOT_SIGNALS = ["opa_vacant_land", "no_footprint", "demo_no_newcon", "lot_li_2y", "in_landcare"]
BLDG_SIGNALS = ["cs_recent_no_permit", "unsafe_no_permit", "idang_no_permit", "bldg_li_2y", "opa_ext_vacant"]


def stratum_sql() -> str:
    # "City only" for lots allows one agreeing record: only 35 City lots have none at all.
    return """
      CASE
        WHEN city_land AND n_lot_signals <= 1 THEN 'lot:city_only'
        WHEN city_land AND n_lot_signals >= 2 THEN 'lot:both'
        WHEN NOT city_land AND NOT city_bldg AND n_lot_signals >= 2 THEN 'lot:indep_only_2plus'
        WHEN NOT city_land AND NOT city_bldg AND n_lot_signals = 1 THEN 'lot:indep_only_1'
      END AS lot_stratum,
      CASE
        WHEN city_bldg AND n_bldg_signals = 0 THEN 'building:city_only'
        WHEN city_bldg AND n_bldg_signals >= 1 THEN 'building:both'
        WHEN NOT city_bldg AND NOT city_land AND n_bldg_signals >= 1 THEN 'building:indep_only'
      END AS bldg_stratum
    """


def lonlat_to_px(lon: float, lat: float, z: int) -> tuple[float, float]:
    n = 256 * 2**z
    x = (lon + 180.0) / 360.0 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def fetch_tile(z: int, x: int, y: int) -> Image.Image:
    time.sleep(TILE_PAUSE)
    r = client().get(TILE_URL.format(z=z, x=x, y=y))
    if r.status_code != 200:
        return Image.new("RGB", (256, 256), (40, 40, 40))
    return Image.open(io.BytesIO(r.content)).convert("RGB")


def crop_for(geom, path) -> dict:
    minx, miny, maxx, maxy = geom.bounds
    lat0 = (miny + maxy) / 2
    m_per_deg_lat = 111_320.0
    m_per_deg_lon = 111_320.0 * math.cos(math.radians(lat0))
    w_m = (maxx - minx) * m_per_deg_lon
    h_m = (maxy - miny) * m_per_deg_lat
    half = max(30.0, 0.5 * max(w_m, h_m) + 15.0)  # meters around the parcel center
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    bx0, bx1 = cx - half / m_per_deg_lon, cx + half / m_per_deg_lon
    by0, by1 = cy - half / m_per_deg_lat, cy + half / m_per_deg_lat
    extent = 2 * half
    z = 20 if extent <= 90 else 19 if extent <= 180 else 18 if extent <= 360 else 17
    px0, py0 = lonlat_to_px(bx0, by1, z)
    px1, py1 = lonlat_to_px(bx1, by0, z)
    tx0, ty0, tx1, ty1 = int(px0 // 256), int(py0 // 256), int(px1 // 256), int(py1 // 256)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mosaic.paste(fetch_tile(z, tx, ty), ((tx - tx0) * 256, (ty - ty0) * 256))
    ox, oy = tx0 * 256, ty0 * 256
    img = mosaic.crop((int(px0 - ox), int(py0 - oy), int(px1 - ox), int(py1 - oy)))
    draw = ImageDraw.Draw(img)
    polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    for poly in polys:
        pts = [lonlat_to_px(x, y, z) for x, y in poly.exterior.coords]
        pts = [(x - px0, y - py0) for x, y in pts]
        draw.line(pts, fill=(255, 220, 0), width=3)
    if max(img.size) > 640:
        s = 640 / max(img.size)
        img = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    img.save(path, quality=88)
    return {"zoom": z, "tiles": (tx1 - tx0 + 1) * (ty1 - ty0 + 1), "extent_m": round(extent)}


ROUND2 = {
    # validation of the refined rules (rules.py), drawn after round 1 was labeled
    "lot_high": ("kind = 'lot' AND confidence = 'high'", 5),
    "lot_medium_not_on_city_list": ("kind = 'lot' AND confidence = 'medium' AND NOT city_land", 15),
    "city_lot_with_recent_newcon": ("city_land AND recent_newcon", 8),
    "city_building_without_footprint": ("city_bldg AND has_footprint = false", 7),
}


def draw(con, round_no: int) -> list[tuple[str, str, str]]:
    rows = []
    if round_no == 1:
        rng = random.Random(SEED)
        con.execute(f"CREATE TABLE s AS SELECT *, {stratum_sql()} FROM read_parquet('{OUT / 'signals.parquet'}')")
        for kind, col in (("lot", "lot_stratum"), ("building", "bldg_stratum")):
            for stratum, n in PER_STRATUM[kind].items():
                ids = [r[0] for r in con.execute(
                    f"SELECT opa FROM s WHERE {col} = '{kind}:{stratum}' AND area_m2 IS NOT NULL ORDER BY opa").fetchall()]
                pick = rng.sample(ids, min(n, len(ids)))
                print(f"{kind}:{stratum}: {len(ids)} parcels, sampled {len(pick)}")
                rows += [(kind, stratum, o) for o in pick]
    else:
        rng = random.Random(SEED + 2)
        con.execute(f"""CREATE TABLE s AS SELECT s.*, c.kind AS rule_kind, c.confidence
                        FROM read_parquet('{OUT / 'signals.parquet'}') s
                        LEFT JOIN read_parquet('{OUT / 'candidates.parquet'}') c USING (opa)""")
        done = {r["opa"] for r in csv.DictReader(open(OUT / "spot_sample.csv"))}
        for stratum, (where, n) in ROUND2.items():
            where = where.replace("kind =", "rule_kind =")
            ids = [r[0] for r in con.execute(
                f"SELECT opa FROM s WHERE {where} AND area_m2 IS NOT NULL ORDER BY opa").fetchall() if r[0] not in done]
            pick = rng.sample(ids, min(n, len(ids)))
            print(f"{stratum}: {len(ids)} parcels, sampled {len(pick)}")
            kind = "building" if stratum.startswith("city_building") else "lot"
            rows += [(kind, stratum, o) for o in pick]
    return rows


def main(round_no: int = 1) -> None:
    con = connect(memory="1500MB", threads=2)
    rows = draw(con, round_no)
    rng_codes = random.Random(SEED + round_no)
    con.execute("CREATE TABLE pick (kind VARCHAR, stratum VARCHAR, opa VARCHAR)")
    con.executemany("INSERT INTO pick VALUES (?, ?, ?)", rows)
    sig_cols = ["city_land", "land_rank", "city_bldg", "build_rank", "n_lot_signals", "n_bldg_signals",
                "has_footprint"] + LOT_SIGNALS + BLDG_SIGNALS
    detail = con.execute(f"""
        SELECT p.kind, p.stratum, p.opa, s.address, s.bdesc, s.lat, s.lon, s.area_m2,
               {', '.join('s.' + c for c in sig_cols)}, s.excluded_use, s.lu_c2,
               s.demo_last, s.newcon_last, s.cs_last, s.activity_last
        FROM pick p JOIN s USING (opa) ORDER BY p.kind, p.stratum, p.opa
    """).fetchall()
    names = [d[0] for d in con.description]
    geoms = {}
    for opa, blob in con.execute(f"""
        SELECT opa, wkb FROM read_parquet('{OUT / 'parcel_spatial.parquet'}') WHERE opa IN (SELECT opa FROM pick)
    """).fetchall():
        geoms.setdefault(opa, []).append(shapely_wkb.loads(bytes(blob)))
    prefix = "c" if round_no == 1 else "v"
    codes = [f"{prefix}{i:02d}" for i in range(1, len(detail) + 1)]
    rng_codes.shuffle(codes)
    # Fetch in code order, not stratum order, so the order of the crops reveals nothing.
    order = sorted(range(len(detail)), key=lambda i: codes[i])
    key_path = OUT / ("spot_sample.csv" if round_no == 1 else "spot_sample_round2.csv")
    with open(key_path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(names + ["crop", "zoom", "extent_m"])
        for i in order:
            code, row = codes[i], detail[i]
            rec = dict(zip(names, row))
            geom = unary_union(geoms[rec["opa"]])
            path = CROPS / f"{code}.jpg"
            info = crop_for(geom, path)
            w.writerow(list(row) + [path.name, info["zoom"], info["extent_m"]])
            print(f"{code} z{info['zoom']} {info['tiles']} tiles", flush=True)


if __name__ == "__main__":
    import sys
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 1)
