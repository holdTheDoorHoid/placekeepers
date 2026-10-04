"""Closer zoom (level 21) crops for spot check parcels whose first crop was hard to read.

Usage: .venv/bin/python zoom_crops.py c11 c39 ...   Writes out/crops/zoom_<code>.jpg. Reads only the
crop code and account from the sample key, so the labeler still does not see the stratum.
"""

from __future__ import annotations

import csv
import sys

from shapely import wkb as shapely_wkb
from shapely.ops import unary_union

import spot_sample as ss
from common import OUT, connect


def main(codes: list[str]) -> None:
    key = {}
    for name in ("spot_sample.csv", "spot_sample_round2.csv"):
        if (OUT / name).exists():
            key.update({r["crop"].removesuffix(".jpg"): r["opa"] for r in csv.DictReader(open(OUT / name))})
    con = connect(memory="800MB")
    for code in codes:
        opa = key[code]
        blobs = con.execute(
            f"SELECT wkb FROM read_parquet('{OUT / 'parcel_spatial.parquet'}') WHERE opa = ?", [opa]).fetchall()
        geom = unary_union([shapely_wkb.loads(bytes(b[0])) for b in blobs])
        # neighboring parcel lines, drawn thin in cyan, to show how the parcel grid sits on the roofs
        minx, miny, maxx, maxy = geom.bounds
        pad = 0.0006
        neighbors = [shapely_wkb.loads(bytes(b[0])) for b in con.execute(
            f"""SELECT wkb FROM read_parquet('{OUT / 'parcel_spatial.parquet'}')
                WHERE lon BETWEEN ? AND ? AND lat BETWEEN ? AND ? AND coalesce(opa, '') <> ?""",
            [minx - pad, maxx + pad, miny - pad, maxy + pad, opa]).fetchall()]
        info = crop_tight(geom, OUT / "crops" / f"zoom_{code}.jpg", neighbors)
        print(code, info)


def crop_tight(geom, path, neighbors=()):
    # Same as spot_sample.crop_for, but a tighter frame at zoom 21.
    import math
    from PIL import Image, ImageDraw
    minx, miny, maxx, maxy = geom.bounds
    lat0 = (miny + maxy) / 2
    mlat, mlon = 111_320.0, 111_320.0 * math.cos(math.radians(lat0))
    half = max(15.0, 0.5 * max((maxx - minx) * mlon, (maxy - miny) * mlat) + 6.0)
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    bx0, bx1, by0, by1 = cx - half / mlon, cx + half / mlon, cy - half / mlat, cy + half / mlat
    z = 21
    px0, py0 = ss.lonlat_to_px(bx0, by1, z)
    px1, py1 = ss.lonlat_to_px(bx1, by0, z)
    tx0, ty0, tx1, ty1 = int(px0 // 256), int(py0 // 256), int(px1 // 256), int(py1 // 256)
    mosaic = Image.new("RGB", ((tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mosaic.paste(ss.fetch_tile(z, tx, ty), ((tx - tx0) * 256, (ty - ty0) * 256))
    img = mosaic.crop((int(px0 - tx0 * 256), int(py0 - ty0 * 256), int(px1 - tx0 * 256), int(py1 - ty0 * 256)))
    draw = ImageDraw.Draw(img)
    for n in neighbors:
        for poly in (list(n.geoms) if n.geom_type == "MultiPolygon" else [n]):
            pts = [ss.lonlat_to_px(x, y, z) for x, y in poly.exterior.coords]
            draw.line([(x - px0, y - py0) for x, y in pts], fill=(0, 230, 255), width=1)
    for poly in (list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]):
        pts = [ss.lonlat_to_px(x, y, z) for x, y in poly.exterior.coords]
        draw.line([(x - px0, y - py0) for x, y in pts], fill=(255, 220, 0), width=2)
    if max(img.size) > 700:
        s = 700 / max(img.size)
        img = img.resize((int(img.width * s), int(img.height * s)), Image.LANCZOS)
    img.save(path, quality=90)
    return {"tiles": (tx1 - tx0 + 1) * (ty1 - ty0 + 1), "extent_m": round(2 * half)}


if __name__ == "__main__":
    main(sys.argv[1:])
