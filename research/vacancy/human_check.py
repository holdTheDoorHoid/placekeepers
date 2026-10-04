"""Pick about 40 parcels for a person to check at street level, and write human_check.csv.

Aerial photos can tell a lot from a building but not an empty building from a lived in one, and
they are from 2023. These are the cases where a street level look settles the most. The list holds
only the address, the OPA account, why the parcel is uncertain and what to look for: no owner names.
"""

from __future__ import annotations

import csv
import random

from common import HERE, OUT, connect

SEED = 20261005

GROUPS = [
    # (group, number, SQL condition on candidates c joined to signals s, why uncertain, what to look for)
    ("building, high, on the City list", 6,
     "c.kind = 'building' AND c.confidence = 'high' AND c.city_bldg",
     "The City and at least one L&I record say vacant, but an aerial photo cannot see whether anyone lives there.",
     "Boarded or open doors and windows, no curtains, mail or flyers piling up, utility meters removed, a vacant property sign."),
    ("building, high, not on the City list", 4,
     "c.kind = 'building' AND c.confidence = 'high' AND NOT c.city_bldg",
     "Two or more L&I records say vacant (sealed, unsafe, or a vacant property case), but the City's list leaves it out.",
     "Same signs of vacancy; also whether repair work has started."),
    ("building, medium, only the City list", 6,
     "c.kind = 'building' AND c.confidence = 'medium' AND c.city_bldg AND c.n_bldg_signals = 0",
     "Only the City's list calls it vacant; no L&I record from the last few years agrees.",
     "Signs of vacancy, or signs of life (lights, plants, cars, a recent renovation)."),
    ("building, low, one complaint or note", 5,
     "c.kind = 'building' AND c.confidence = 'low' AND NOT c.city_bldg AND c.n_bldg_signals = 1 AND (s.bldg_li_2y OR s.opa_ext_vacant)",
     "A single vacant property complaint, violation or assessor note is the only sign; many such houses are lived in.",
     "Whether it looks lived in."),
    ("lot, medium, not on the City list", 6,
     "c.kind = 'lot' AND c.confidence = 'medium' AND NOT c.city_land",
     "No building and the assessor calls it vacant land, but the City's list leaves it out. Our aerial check found most of these empty, some kept as side yards or parking.",
     "Empty lot, a fenced and kept yard, parking, or a garden."),
    ("lot, conflict: City says lot, a footprint stands", 4,
     "c.kind = 'lot_conflict' AND c.city_land",
     "The City lists it as vacant land, but the building footprint layer shows a building and no demolition is recorded.",
     "Is there a building? If so, is it vacant?"),
    ("lot with a recent new construction permit", 3,
     "c.kind = 'lot' AND s.newcon_planned AND c.city_land",
     "A new construction permit was issued since April 2025; the lot may now be a construction site or a new house.",
     "Construction fencing, foundations, a new building, or still an empty lot."),
    ("lot, high, likely side yard", 3,
     "c.kind = 'lot' AND c.confidence = 'high' AND c.side_yard_likely",
     "Every record says vacant land, but the owner of the house next door owns it; it may be a kept side yard.",
     "A fence joining it to the house next door, a lawn or garden kept by the neighbor, or an open neglected lot."),
]

UNCLEAR_SPOT = [
    ("871569480", "Spot check: a roofless shell with rubble; vacant for sure, but is it a lot or a building to seal?",
     "Whether walls still stand and whether it is open to entry."),
    ("371212901", "Spot check: the parcel line falls half on an open strip and half on a neighbor's roof in the 2023 photo.",
     "Whether this address is an empty lot or a house."),
    ("362045405", "Spot check: a black strip in the 2023 photo could be a shaded empty lot or a black roof.",
     "Whether this address is an empty lot or a house."),
    ("364204300", "Spot check: the parcel line straddles an open strip and a roof, and a new construction permit followed.",
     "Empty lot, construction site, or new house."),
]


def maps_link(lat: float, lon: float) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lon:.6f}"


def street_view_link(lat: float, lon: float) -> str:
    return f"https://www.google.com/maps/@?api=1&map_action=pano&viewpoint={lat:.6f},{lon:.6f}"


def main() -> None:
    con = connect(memory="1000MB")
    con.execute(f"CREATE TABLE c AS SELECT * FROM read_parquet('{OUT / 'candidates.parquet'}')")
    con.execute(f"CREATE TABLE s AS SELECT * FROM read_parquet('{OUT / 'signals.parquet'}')")
    rng = random.Random(SEED)
    rows = []
    cols = "c.opa, c.address, c.kind, c.confidence, c.reasons, coalesce(c.lat, c.opa_lat), coalesce(c.lon, c.opa_lon)"
    taken: set[str] = set()
    for group, n, where, why, look in GROUPS:
        cands = con.execute(f"SELECT {cols} FROM c JOIN s USING (opa) WHERE {where} AND coalesce(c.lat, c.opa_lat) IS NOT NULL ORDER BY c.opa").fetchall()
        for r in rng.sample(cands, min(n, len(cands))):
            taken.add(r[0])
            rows.append((group, why, look) + tuple(r))
    for opa, why, look in UNCLEAR_SPOT:
        r = con.execute(f"SELECT {cols} FROM c JOIN s USING (opa) WHERE c.opa = ?", [opa]).fetchone()
        if r is None:
            r = con.execute("SELECT opa, address, NULL, NULL, '', coalesce(lat, opa_lat), coalesce(lon, opa_lon) FROM s WHERE opa = ?", [opa]).fetchone()
        rows.append(("aerial spot check was unclear", why, look) + tuple(r))
    with open(HERE / "human_check.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["address", "opa_account", "group", "our_call", "why_uncertain", "what_to_look_for",
                    "records_found", "google_maps", "street_view", "checked_on", "what_you_saw"])
        for group, why, look, opa, address, kind, conf, reasons, lat, lon in rows:
            call = f"{kind or 'unknown'}, {conf or 'not shown'}".replace("lot_conflict", "lot (conflict)")
            w.writerow([address, opa, group, call, why, look, reasons, maps_link(lat, lon),
                        street_view_link(lat, lon), "", ""])
    print(f"wrote {len(rows)} parcels to {HERE / 'human_check.csv'}")


if __name__ == "__main__":
    main()
