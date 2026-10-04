"""The owner flag wording against docs/ETHICS.md, read from the file itself, so a change on either
side fails here: the possible estate text and the conservatorship warning word for word, the
"shown as" forms of the flags table, and the house rules (no dashes as punctuation, never "owner
deceased" or "no heirs", nothing about police, no investor language)."""

from __future__ import annotations

import re
from datetime import date
from typing import Any

import pytest

from placekeepers.derive import wording
from placekeepers.derive.flags import FLAG_NOTES, NOTICES, full_flag, make_flag
from placekeepers.registry import load_registry

from .conftest import REPO_ROOT

ETHICS = (REPO_ROOT / "docs" / "ETHICS.md").read_text(encoding="utf-8")
NEW_ROUTES = (
    "land_bank_side_yard",
    "contact_phdc",
    "garden_adverse_possession",
    "conservatorship",
    "tangled_title_help",
    "fraud_guard",
)


def quoted(after: str) -> str:
    """The italic quotation that follows `after` in ETHICS.md, on one line."""
    found = re.search(re.escape(after) + r'\s*\*"(.+?)"\*', ETHICS, re.DOTALL)
    assert found, f"ETHICS.md no longer has {after!r}"
    return " ".join(found.group(1).split())


def test_possible_estate_is_word_for_word() -> None:
    expected = quoted('"Possible estate" reads:')
    flag = full_flag(make_flag("possible_estate", wording.ESTATE_TEXT))
    assert " ".join([flag["text"], flag["careful"], flag["next_step"]]) == expected


def test_the_conservatorship_route_carries_the_warning_word_for_word() -> None:
    expected = quoted("The conservatorship route always carries this note:")
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    assert " ".join(registry.routes["conservatorship"].warning.split()) == expected
    # Only the conservatorship route needs one; none other has a warning yet.
    assert [r.id for r in registry.routes.values() if r.warning] == ["conservatorship"]


@pytest.mark.parametrize(
    ("shown_as", "ours"),
    [
        (
            "The owner gets mail somewhere else",
            wording.absentee_text("outside_city", "MEDIA", "PA"),
        ),
        ("Last sold in 1987", wording.last_sale_text(1987)),
        ("This owner holds 41 vacant parcels in the city", wording.many_parcels_text(41)),
        (
            "Sold 3 times since 2024",
            wording.resale_text(3, date(2024, 1, 5), date(2026, 2, 1), True),
        ),
    ],
)
def test_the_shown_as_forms_of_the_flags_table(shown_as: str, ours: str) -> None:
    assert f'"{shown_as}"' in ETHICS, f"ETHICS.md no longer shows {shown_as!r}"
    assert ours.startswith(shown_as)


def test_tax_debt_is_dated_and_points_to_the_tax_center() -> None:
    assert "Tax debt as of July 2025" in ETHICS
    assert "As of July 2025" in wording.tax_text(100, 1)
    notes = FLAG_NOTES["tax_debt_2025"]
    assert wording.TAX_CENTER in notes["links"]
    assert "Tax Center" in notes["next_step"]


def every_text() -> list[tuple[str, str]]:
    """Every sentence of ours that people read: flag notes and texts, the notice, the owner type
    reasons, and the routes this milestone added."""
    texts: list[tuple[str, str]] = []
    for name in dir(wording):
        value = getattr(wording, name)
        if isinstance(value, str) and name.isupper():
            texts.append((name, value))
        if isinstance(value, dict) and name.isupper():
            texts.extend((f"{name}.{k}", v) for k, v in value.items() if isinstance(v, str))
    for flag_id, notes in FLAG_NOTES.items():
        texts += [
            (f"{flag_id}.careful", notes["careful"]),
            (f"{flag_id}.next_step", notes["next_step"]),
        ]
        texts += [(f"{flag_id}.link", link["label"]) for link in notes.get("links", [])]
    texts += [("deed_fraud", NOTICES["deed_fraud"]["text"])]
    samples = {
        "absentee": [
            wording.absentee_text(s, "KING OF PRUSSIA", "PA")
            for s in ("out_of_state", "outside_city", "po_box_in_city", "elsewhere_in_city")
        ],
        "tax": [wording.tax_text(35197.7, 42), wording.tax_text(10, 1)],
        "sheriff": [
            wording.sheriff_text([(date(2019, 5, 14), 12300.0)]),
            wording.sheriff_text([(date(2008, 3, 4), 1500.0), (date(2019, 5, 14), None)]),
        ],
        "sale": [wording.last_sale_text(1987), wording.no_sale_text(2000)],
        "resale": [wording.resale_text(2, date(2005, 1, 1), date(2006, 1, 1), False)],
        "li": [
            wording.violations_text(1, date(2025, 8, 1), "RUBBISH"),
            wording.violations_text(4, date(2025, 8, 1), None),
            wording.unsafe_text(date(2024, 1, 2)),
            wording.dangerous_text(None),
        ],
        "reasons": [wording.agency_reason(a, c) for a in wording.AGENCY_NAMES for c in (0, 1)]
        + [wording.marker_reason(m) for m in wording.MARKER_NOTES],
    }
    texts += [(k, text) for k, values in samples.items() for text in values]
    registry = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)
    for route_id in NEW_ROUTES:
        route: Any = registry.routes[route_id]
        texts += [(f"{route_id}.label", route.label), (f"{route_id}.who", route.who)]
        texts += [(f"{route_id}.cost", route.cost), (f"{route_id}.timeline", route.timeline)]
        texts += [(f"{route_id}.step", step) for step in route.steps]
        texts += [(f"{route_id}.link", link.label) for link in route.links]
        if route.warning:
            texts.append((f"{route_id}.warning", route.warning))
    return texts


SPACED_HYPHEN = re.compile(r"\S[ \t]+-[ \t]+\S")
NEVER = re.compile(
    r"owner deceased|no heirs|\bdeceased\b|\bpolice\b|\benforcement\b|\beasiest\b|easy to take"
    r"|\bbargain|\bdeal\b|\binvestors?\b|\binvestment\b|\bflip|\bROI\b|below market|\bbuy\b",
    re.IGNORECASE,
)


def test_no_dashes_as_punctuation() -> None:
    for where, text in every_text():
        assert not re.search("[–—]", text), f"{where}: an em or en dash in {text!r}"
        assert not SPACED_HYPHEN.search(text), f"{where}: a spaced hyphen in {text!r}"


def test_never_what_ethics_rules_out() -> None:
    for where, text in every_text():
        found = NEVER.search(text)
        assert not found, f"{where}: {found.group()!r} in {text!r}"
