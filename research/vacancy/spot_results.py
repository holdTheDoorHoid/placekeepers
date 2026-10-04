"""Join the blind aerial labels to the sample key and summarize by stratum.

Inputs: out/spot_sample.csv (key, from spot_sample.py) and out/blind_labels.csv (labels made by eye
on the blind crops). Outputs: spot_checks.csv (committed: parcel, stratum, label, note) and
results/spot_check_summary.csv.
"""

from __future__ import annotations

import csv
from collections import Counter, defaultdict

from common import HERE, OUT, RESULTS

LABELS = ["empty or green lot", "building present", "parking", "garden or park", "unclear"]


def main() -> None:
    key = {r["crop"].removesuffix(".jpg"): r for r in csv.DictReader(open(OUT / "spot_sample.csv"))}
    labels = {r["crop"]: r for r in csv.DictReader(open(OUT / "blind_labels.csv"))}
    assert set(key) == set(labels), "every crop needs exactly one label"
    out = []
    for code in sorted(key, key=lambda c: (key[c]["kind"], key[c]["stratum"], key[c]["opa"])):
        k, lab = key[code], labels[code]
        out.append({
            "opa_account": k["opa"],
            "kind": k["kind"],
            "stratum": k["stratum"],
            "label": lab["label"],
            "note": lab["note"],
            "address": k["address"],
            "crop_code": code,
            "city_land": k["city_land"],
            "city_bldg": k["city_bldg"],
            "independent_lot_signals": k["n_lot_signals"],
            "independent_building_signals": k["n_bldg_signals"],
            "footprint_present": k["has_footprint"],
        })
    with open(HERE / "spot_checks.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)

    by = defaultdict(Counter)
    for r in out:
        by[(r["kind"], r["stratum"])][r["label"]] += 1
    rows = []
    for (kind, stratum), c in sorted(by.items()):
        n = sum(c.values())
        rows.append([kind, stratum, n] + [c[lab] for lab in LABELS])
    with open(RESULTS / "spot_check_summary.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["kind", "stratum", "parcels"] + LABELS)
        w.writerows(rows)
    print("| Kind | Stratum | Parcels | " + " | ".join(LABELS) + " |")
    print("|---|---|---|" + "---|" * len(LABELS))
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")


if __name__ == "__main__":
    main()
