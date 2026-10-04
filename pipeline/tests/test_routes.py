"""Legal routes per owner type and context, and the routes this milestone added to the registry."""

from __future__ import annotations

from datetime import date

import pytest

from placekeepers.derive import owners as ow
from placekeepers.derive.flags import FLAG_NOTES, HELP_ROUTES, NOTICES
from placekeepers.derive.routes import SUGGESTIONS_BY_KIND, routes_for, suggestions_for
from placekeepers.registry import load_registry

from .conftest import REPO_ROOT

REGISTRY = load_registry(REPO_ROOT / "registry", repo_root=REPO_ROOT)


def routes(names: list[str], agency: str | None = None, **context) -> list[str]:
    return routes_for(ow.owner_type(names, agency), has_names=bool(names), **context)


def test_land_bank_and_city_lots_get_the_garden_agreement() -> None:
    assert routes(["PHILADELPHIA LAND BANK"], "PLB") == ["land_bank_garden_agreement"]
    assert routes(["CITY OF PHILA"], "PUB") == ["land_bank_garden_agreement"]
    assert routes(["CITY OF PHILA"]) == ["land_bank_garden_agreement"]


def test_the_side_yard_route_only_where_the_city_marks_the_lot_eligible() -> None:
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", side_yard_eligible=True) == [
        "land_bank_garden_agreement",
        "land_bank_side_yard",
    ]
    # The Redevelopment Authority's eligible lots still say "ask PHDC".
    assert routes(["REDEVELOPMENT AUTHORITY"], "PRA", side_yard_eligible=True) == ["contact_phdc"]


def test_redevelopment_authority_and_phdc_lots_say_contact_phdc() -> None:
    assert routes(["REDEVELOPMENT AUTHORITY", "OF PHILADELPHIA"], "PRA") == ["contact_phdc"]
    assert routes(["REDEVELOPMENT AUTHORITY", "OF PHILADELPHIA"]) == ["contact_phdc"]
    assert routes(["PHILADELPHIA HOUSING", "DEVELOPMENT CORPORATION"], "PHDC") == ["contact_phdc"]
    assert routes(["PHILA HOUSING DEV CORP"]) == ["contact_phdc"]


def test_other_public_owners_are_asked_directly() -> None:
    assert routes(["PHILADELPHIA HOUSING AUTH"], vacant=True) == ["ask_the_owner"]
    assert routes(["SCHOOL DISTRICT OF PHILA"], vacant=True) == ["ask_the_owner"]


@pytest.mark.parametrize(
    "names", [["MORALES ROSA"], ["KENSINGTON LOTS LLC"], ["GRACE BAPTIST CHURCH"], ["HACE"]]
)
def test_private_vacant_lots(names: list[str]) -> None:
    assert routes(names, vacant=True) == ["ask_the_owner", "conservatorship"]
    assert routes(names, vacant=True, gardened=True) == [
        "ask_the_owner",
        "garden_adverse_possession",
        "conservatorship",
    ]


def test_no_conservatorship_where_we_do_not_call_the_parcel_vacant() -> None:
    assert routes(["MORALES ROSA"]) == ["ask_the_owner"]
    assert routes(["MORALES ROSA"], gardened=True) == ["ask_the_owner", "garden_adverse_possession"]


def test_landcare_lots_get_community_landcare_first() -> None:
    assert routes(["MORALES ROSA"], vacant=True, in_landcare=True) == [
        "community_landcare",
        "ask_the_owner",
        "conservatorship",
    ]
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", in_landcare=True) == [
        "community_landcare",
        "land_bank_garden_agreement",
    ]


def test_no_owner_route_without_an_owner() -> None:
    assert routes([], vacant=True) == []
    assert routes([], vacant=True, in_landcare=True) == ["community_landcare"]


def test_suggestions_follow_the_vacancy_call() -> None:
    known = set(REGISTRY.suggestions)
    assert suggestions_for("lot", known) == ["clean_and_green"]
    assert suggestions_for("building", known) == ["seal_abandoned_building"]
    assert suggestions_for(None, known) == []
    assert suggestions_for("lot", set()) == []
    assert {s for found in SUGGESTIONS_BY_KIND.values() for s in found} <= known


def every_route_used() -> set[str]:
    found = set(HELP_ROUTES)
    for notes in (*FLAG_NOTES.values(), *NOTICES.values()):
        found |= set(notes.get("routes", []))
    contexts = [
        dict(vacant=v, gardened=g, in_landcare=lc, side_yard_eligible=sy)
        for v in (0, 1)
        for g in (0, 1)
        for lc in (0, 1)
        for sy in (0, 1)
    ]
    owners = [
        (["MORALES ROSA"], None),
        (["PHILADELPHIA LAND BANK"], "PLB"),
        (["REDEVELOPMENT AUTHORITY"], "PRA"),
        (["SEPTA"], None),
    ]
    for names, agency in owners:
        for context in contexts:
            found |= set(routes(names, agency, **{k: bool(v) for k, v in context.items()}))
    return found


def test_every_route_named_exists_with_a_last_checked_date() -> None:
    for route_id in every_route_used():
        assert route_id in REGISTRY.routes, route_id
        assert REGISTRY.routes[route_id].last_checked <= date(2026, 10, 4)


@pytest.mark.parametrize(
    ("route_id", "status"),
    [
        ("land_bank_side_yard", "verified"),
        ("contact_phdc", "confirm"),
        ("garden_adverse_possession", "confirm"),
        ("conservatorship", "verified"),
        ("tangled_title_help", "verified"),
        ("fraud_guard", "verified"),
    ],
)
def test_the_new_routes_follow_routes_md(route_id: str, status: str) -> None:
    route = REGISTRY.routes[route_id]
    assert route.status == status
    assert route.last_checked == date(2026, 10, 4)
    assert route.links, f"{route_id} has no link"
