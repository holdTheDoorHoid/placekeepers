"""docs/ETHICS.md against every file publish writes (milestone M1.10, the verification review).

One build holds every kind of record the published files draw on: the lot dossier fixtures of
test_dossiers.py (owners, deeds, taxes, L&I cases with realistic case numbers), the street fixtures
of streets_fixtures.py (crashes, Police fatal crash records, schools) and invented names in the
curated memorial file, one of them removed on request. Then every file under the data root is
read: the manifest, every map layer, every dossier shard, dossiers/common.json and
tables/owners.json. The tests below check, in every one of them:

* nothing about a person beyond what the contract names: each layer carries only its contract
  properties, and no key anywhere names race, sex, age, a case, complaint or control number, a
  driver, an arrest or a narrative;
* no L&I case, violation, complaint or work order number, and no Police control number;
* none of the things we do not build (a price estimate, ease of acquisition, a buy button, letters
  to owners), no suggestion that involves the police, never "owner deceased" or "no heirs", and
  never "dangerous", "high crime" or "hot spot" about a place;
* the possible estate flag reads the ETHICS.md text word for word, with the deed fraud notice;
* conservatorship only for a private parcel called vacant with high or medium confidence, and
  never on a parcel with a homestead exemption;
* names only from memorials.yaml, and everything in suppressed.yaml gone from every file.

Rules that need a person to judge (care framing, quiet design, what the interface shows) are
listed in docs/VERIFICATION.md.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pyarrow as pa
import pytest
import yaml

from placekeepers.curated import REMOVAL_EMAIL_FILE
from placekeepers.publish import publish

from . import streets_fixtures as fx
from .conftest import REPO_ROOT, install_snapshot
from .test_dossiers import HOMESTEAD, NOW, dates, install_everything

LATER = "2026-10-04T14:30:00Z"
ETHICS = (REPO_ROOT / "docs" / "ETHICS.md").read_text(encoding="utf-8")


def quoted(lead: str) -> str:
    """The text ETHICS.md quotes after `lead`, on one line."""
    start = ETHICS.index(lead) + len(lead)
    first = ETHICS.index('*"', start) + 2
    return " ".join(ETHICS[first : ETHICS.index('"*', first)].split())


ESTATE_TEXT = quoted('"Possible estate" reads:')

#: Each layer's properties (docs/CONTRACTS.md section 4).
CONTRACT_PROPERTIES = {
    "parcels": {"id", "k", "vc", "ot", "lc", "rt", "rs", "n", "dy", "sy", "ny", "sg"}
    | {"f_vacant", "f_shoot", "f_poverty", "f_canopy"},
    "h3": {"h", "s12", "s36"},
    "hin": {"id", "name", "len"},
    "crashes": {"id", "y", "ya", "sev", "m"},
    "memorials": {"id", "d", "m", "nm", "src", "pl", "sg"},
    "segments": {"id", "name", "cls", "hin", "ksi", "k2", "sch"}
    | {"f_hin", "f_ksi_vru", "f_fatal2", "f_school"},
    "landcare": {"id", "p", "y"},
    "gardens": {"nm", "src", "w"},
    "council_districts": {"d", "nm"},
    "rcos": {"id", "nm", "t", "w"},
    "neighborhoods": {"id", "nm"},
}

#: Keys that would mean a published file says something about a person it must not.
FORBIDDEN_KEY = re.compile(
    r"race|\bsex\b|gender|^age$|birth|\bdc_|case|complaint|ticket|control|incident|driver"
    r"|arrest|charge|narrative|victim|objectid|violationnumber|workorder|permitnumber"
    r"|acqui|estimat|eas(y|e|iest)|offer|\bbid\b|deal|profit|letter|outreach|buy|purchase",
    re.IGNORECASE,
)
#: Text that must never appear in a published value.
FORBIDDEN_TEXT = re.compile(
    r"easiest|easy to (take|get|buy)|owner deceased|no heirs|bargain|investment opportunit"
    r"|below market|price estimate|estimated (price|value)|acquisition|\bbuy\b"
    r"|\bpolice\b(?! department|\))|enforcement|arrest|high crime|hot ?spot"
    r"|(?<!imminently[ _])dangerous|placeholder",
    re.IGNORECASE,
)
#: L&I case, violation, complaint, work order and permit numbers; Police control numbers.
IDENTIFIER = re.compile(
    r"\b(CF|VI|CM|WO|EP|BP|ZP|DP|MP|PP)-\d{4}-\d{4,7}\b|\bDC[ _#-]?\d{6,}|\b20\d{2}-?\d{2}-?\d{6}\b"
)

# The curated names: one kept, one removed on request (both invented).
KEPT = {
    "id": "m2026_0001",
    "name": "Alex Example",
    "date": "2026-08-20",
    "mode": "walking",
    "lat": fx.lnglat(60, 99)[1],
    "lng": fx.lnglat(60, 99)[0],
    "source": "https://example.org/memorials/alex-example",
}
REMOVED = {
    "id": "m2023_0001",
    "name": "Robin Placeholder",
    "date": "2023-05-05",
    "mode": "cycling",
    "lat": fx.lnglat(240, 60)[1],
    "lng": fx.lnglat(240, 60)[0],
    "source": "https://example.org/memorials/robin-placeholder",
}
#: L&I numbers in the realistic forms the City uses, which must never be published.
CASE_NUMBERS = ("CF-2025-012345", "VI-2025-054321", "CF-2024-000777", "VI-2024-000888")


def write_repo_files(repo: Path, suppressed: list) -> None:
    folder = repo / "data" / "curated"
    (folder / "memorials.yaml").write_text(yaml.safe_dump([KEPT, REMOVED]), encoding="utf-8")
    (folder / "suppressed.yaml").write_text(yaml.safe_dump(suppressed), encoding="utf-8")
    email = repo / REMOVAL_EMAIL_FILE
    email.parent.mkdir(parents=True, exist_ok=True)
    email.write_text(
        "export const REMOVAL_EMAIL: string | null = 'removals@example.org';\n", encoding="utf-8"
    )


def install_streets(ctx) -> None:
    def install(source: str, table: pa.Table, types: list[str] | None) -> None:
        install_snapshot(
            ctx,
            source,
            table,
            geometry=types is not None,
            fetched_at=LATER,
            geometry_types=types,
        )

    install("street_centerlines", fx.centerlines(), ["LineString"])
    install("high_injury_network", fx.high_injury_network(), ["MultiLineString"])
    install("crashes_2020_2024", fx.newest_slice(), ["Point"])
    install("crashes_2016_2020", fx.older_slice(), ["Point"])
    install("crashes_2007_2017", fx.oldest_slice(), ["Point"])
    install("fatal_crashes", fx.fatal_table(), None)
    install("schools", fx.schools(), ["Point"])


def install_case_numbers(ctx) -> None:
    """L&I records as the City writes them, with case and violation numbers in their real
    forms, replacing the short placeholders of the dossier fixtures."""
    install_snapshot(
        ctx,
        "li_violations",
        pa.table(
            {
                "opa_account_num": ["371000001", "371000001", "374000001"],
                "casenumber": [CASE_NUMBERS[0], CASE_NUMBERS[0], CASE_NUMBERS[2]],
                "violationnumber": [CASE_NUMBERS[1], "VI-2023-000111", CASE_NUMBERS[3]],
                "violationstatus": ["OPEN", "COMPLIED", "COMPLIED"],
                "violationdate": dates(["2025-08-01", "2023-05-05", "2021-02-02"]),
                "violationcodetitle": ["EXTERIOR AREA WEEDS", "RUBBISH & GARBAGE", "VACANT"],
            }
        ),
        geometry=False,
        fetched_at=LATER,
    )
    install_snapshot(
        ctx,
        "li_unsafe",
        pa.table(
            {
                "opa_account_num": ["374000001"],
                "casenumber": ["CF-2024-000999"],
                "violationnumber": ["VI-2024-001000"],
                "violationdate": dates(["2024-03-03"]),
                "violationresolutiondate": dates([None]),
            }
        ),
        geometry=False,
        fetched_at=LATER,
    )


def published_files(out: Path) -> dict[str, Any]:
    """Every file under the data root, parsed."""
    files = {}
    for path in sorted(out.rglob("*")):
        if path.is_file():
            files[str(path.relative_to(out))] = json.loads(path.read_text(encoding="utf-8"))
    return files


def walk(value: Any, path: str = ""):
    """Every key and every text value, as ("key" or "value", where, what)."""
    if isinstance(value, dict):
        for key, item in value.items():
            yield "key", f"{path}.{key}", key
            yield from walk(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk(item, f"{path}[{index}]")
    elif isinstance(value, str):
        yield "value", path, value


@pytest.fixture
def built(context_factory, repo_copy, tmp_path) -> tuple[Path, Path, str]:
    """The full build, with one Police marker removed on request; returns the data root, the
    repository copy and the removed marker's id."""
    write_repo_files(repo_copy, [REMOVED["id"]])
    ctx = context_factory(repo_root=repo_copy, now=NOW)
    install_everything(ctx)
    install_case_numbers(ctx)
    install_streets(ctx)
    first = tmp_path / "first"
    publish(ctx, first)
    memorials = published_files(first)["tiles/streets.memorials.geojson"]["features"]
    marker = next(f["properties"]["id"] for f in memorials if f["properties"]["d"] == "2026-01-15")
    write_repo_files(repo_copy, [REMOVED["id"], marker])
    out = tmp_path / "data"
    publish(ctx, out)
    return out, repo_copy, marker


def test_the_build_has_every_kind_of_file(built) -> None:
    out, _, _ = built
    names = set(published_files(out))
    assert {"manifest.json", "dossiers/common.json", "tables/owners.json"} <= names
    assert any(re.fullmatch(r"dossiers/\d{4}\.json", name) for name in names)
    layers = {name.split(".")[-2] for name in names if name.endswith(".geojson")}
    assert {"parcels", "h3", "hin", "crashes", "memorials", "segments", "landcare"} <= layers


def test_each_layer_carries_only_its_contract_properties(built) -> None:
    out, _, _ = built
    for name, body in published_files(out).items():
        if not name.endswith(".geojson"):
            continue
        layer = name.split(".")[-2]
        for feature in body["features"]:
            extra = set(feature["properties"]) - CONTRACT_PROPERTIES[layer]
            assert not extra, f"{name} has {sorted(extra)}"


def test_no_key_says_anything_ethics_rules_out(built) -> None:
    out, _, _ = built
    for name, body in published_files(out).items():
        if name == "manifest.json":
            # Its sources, layers and files maps are keyed by registry ids and paths.
            body = {k: v for k, v in body.items() if k not in {"sources", "layers", "files"}}
        for kind, where, what in walk(body):
            if kind == "key":
                assert not FORBIDDEN_KEY.search(what), f"{name}{where}"


def test_no_value_says_anything_ethics_rules_out(built) -> None:
    out, _, _ = built
    for name, body in published_files(out).items():
        for kind, where, what in walk(body):
            if kind == "value":
                assert not FORBIDDEN_TEXT.search(what), f"{name}{where}: {what!r}"
                assert not IDENTIFIER.search(what), f"{name}{where}: {what!r}"
    text = "".join(path.read_text(encoding="utf-8") for path in out.rglob("*") if path.is_file())
    for number in CASE_NUMBERS:
        assert number not in text


def test_the_possible_estate_flag_reads_ethics_word_for_word(built) -> None:
    out, _, _ = built
    files = published_files(out)
    notes = files["dossiers/common.json"]["flags"]["possible_estate"]
    found = 0
    for name, body in files.items():
        if not re.fullmatch(r"dossiers/\d{4}\.json", name):
            continue
        for record in body["parcels"].values():
            for flag in record["owner"]["flags"]:
                if flag["id"] == "possible_estate":
                    found += 1
                    whole = " ".join([flag["text"], notes["careful"], notes["next_step"]])
                    assert whole == ESTATE_TEXT
                    assert record["owner"]["notice"] == "deed_fraud"
    assert found == 1  # BOWMAN LEROY and BOWMAN EVELYN ESTATE OF


def test_conservatorship_only_for_private_parcels_called_vacant(built) -> None:
    out, _, _ = built
    seen = 0
    for name, body in published_files(out).items():
        if not re.fullmatch(r"dossiers/\d{4}\.json", name):
            continue
        for account, record in body["parcels"].items():
            if "conservatorship" in record["routes"]:
                seen += 1
                assert account not in HOMESTEAD, account
                assert record["owner"]["type"] in {"individual", "company", "nonprofit", "unknown"}
                assert record["owner"]["names"]
                assert (record["vacancy"] or {}).get("confidence") in {"high", "medium"}
    assert seen  # the fixture has private lots called vacant
    assert HOMESTEAD  # and a home among them that must not get it


def test_names_come_only_from_the_curated_file(built) -> None:
    out, _, _ = built
    names = [
        value
        for body in published_files(out).values()
        for kind, where, value in walk(body)
        if kind == "value" and where.endswith(".nm") and "memorials" in where
    ]
    memorial_names = [
        f["properties"].get("nm")
        for f in published_files(out)["tiles/streets.memorials.geojson"]["features"]
    ]
    assert [n for n in memorial_names if n] == [KEPT["name"]]
    assert set(names) <= {KEPT["name"]}


def test_everything_removed_on_request_is_gone_from_every_file(built) -> None:
    """ETHICS.md: a removed name never returns, and its id goes into suppressed.yaml. Here one
    curated name and one Police marker are removed; neither the name, its memorial page, its id
    nor the marker appears in any published file, the manifest included."""
    out, _, marker = built
    text = "".join(path.read_text(encoding="utf-8") for path in out.rglob("*") if path.is_file())
    for gone in (REMOVED["name"], REMOVED["source"], "robin-placeholder", REMOVED["id"]):
        assert gone not in text, gone
    # Ids are whole values (the second person killed in the same crash keeps "<id>_2").
    assert f'"{marker}"' not in text
    memorials = published_files(out)["tiles/streets.memorials.geojson"]["features"]
    # The removed marker's place on that day (two people were killed there; the other stays,
    # under its own id), and the cyclist whose name was removed stays on the map unnamed.
    assert [f["properties"]["d"] for f in memorials].count("2026-01-15") == 1
    cyclist = [f["properties"] for f in memorials if f["properties"]["d"] == "2023-05-05"]
    assert cyclist and "nm" not in cyclist[0] and "src" not in cyclist[0]
