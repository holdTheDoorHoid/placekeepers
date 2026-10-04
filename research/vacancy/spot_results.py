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


def load(round_no: int) -> list[dict]:
    key_name = "spot_sample.csv" if round_no == 1 else "spot_sample_round2.csv"
    lab_name = "blind_labels.csv" if round_no == 1 else "blind_labels_round2.csv"
    key = {r["crop"].removesuffix(".jpg"): r for r in csv.DictReader(open(OUT / key_name))}
    labels = {r["crop"]: r for r in csv.DictReader(open(OUT / lab_name))}
    assert set(key) == set(labels), f"round {round_no}: every crop needs exactly one label"
    out = []
    for code in sorted(key, key=lambda c: (key[c]["kind"], key[c]["stratum"], key[c]["opa"])):
        k, lab = key[code], labels[code]
        out.append({
            "round": round_no,
            "opa_account": k["opa"],
            "kind": k["kind"],
            "stratum": k["stratum"],
            "label": lab["label"],
            "note": lab["note"],
            "address": k["address"],
            "crop_code": code,
            "city_land": k["city_land"],
            "city_bldg": k["city_bldg"],
            "footprint_present": k["has_footprint"],
        })
    return out


def wilson(k: int, n: int, z: float = 1.96) -> str:
    if n == 0:
        return ""
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / d
    return f"{100 * max(0, c - h):.0f} to {100 * min(1, c + h):.0f}%"


def main() -> None:
    out = load(1) + load(2)
    with open(HERE / "spot_checks.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(out[0]))
        w.writeheader()
        w.writerows(out)

    by = defaultdict(Counter)
    for r in out:
        by[(r["round"], r["kind"], r["stratum"])][r["label"]] += 1
    rows = []
    for (rnd, kind, stratum), c in sorted(by.items()):
        n = sum(c.values())
        target = "empty or green lot" if kind == "lot" or stratum == "city_building_without_footprint" else "building present"
        k = c[target]
        k_hi = k + c["unclear"]
        rows.append([rnd, kind, stratum, n] + [c[lab] for lab in LABELS]
                    + [target, f"{k} to {k_hi} of {n}", wilson(k, n), wilson(k_hi, n)])
    with open(RESULTS / "spot_check_summary.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["round", "kind", "stratum", "parcels"] + LABELS
                   + ["expected look", "matches (unclear counted against, then for)", "95% interval, unclear against", "95% interval, unclear for"])
        w.writerows(rows)
    print("| Round | Kind | Stratum | Parcels | " + " | ".join(LABELS) + " | Expected | Matches | 95% interval (low) | 95% interval (high) |")
    print("|---|---|---|---|" + "---|" * (len(LABELS) + 4))
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")


if __name__ == "__main__":
    main()
