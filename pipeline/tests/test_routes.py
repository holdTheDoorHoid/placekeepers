"""Legal routes per owner type and context, and the routes this milestone added to the registry."""

from __future__ import annotations

from datetime import date

import pytest

from placekeepers.derive import owners as ow
from placekeepers.derive.flags import FLAG_NOTES, HELP_ROUTES, NOTICES
from placekeepers.derive.routes import (
    SUGGESTIONS_BY_KIND,
    first_route_code,
    routes_for,
    suggestions_for,
)
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


def test_a_lot_listed_as_available_leads_with_the_side_yard_where_eligible() -> None:
    # Issue #36: the Land Bank offers these lots on its own map, whichever agency owns them.
    listed = {"listed_available": True, "side_yard_eligible": True}
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", **listed) == [
        "land_bank_side_yard",
        "land_bank_garden_agreement",
    ]
    assert routes(["CITY OF PHILA"], "PUB", **listed) == [
        "land_bank_side_yard",
        "land_bank_garden_agreement",
    ]
    assert routes(["REDEVELOPMENT AUTHORITY"], "PRA", **listed) == [
        "land_bank_side_yard",
        "contact_phdc",
    ]
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", in_landcare=True, **listed) == [
        "community_landcare",
        "land_bank_side_yard",
        "land_bank_garden_agreement",
    ]
    # Listed, but not eligible for a side yard: no side yard route.
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", listed_available=True) == [
        "land_bank_garden_agreement"
    ]
    assert routes(["REDEVELOPMENT AUTHORITY"], "PRA", listed_available=True) == ["contact_phdc"]
    # A private owner's lot is never on the City's list.
    assert routes(["MORALES ROSA"], vacant=True, **listed) == ["ask_the_owner", "conservatorship"]


def test_the_side_yard_never_becomes_the_maps_first_step() -> None:
    # It is for the household next door only, so `rt` names the route after it.
    found = ow.owner_type(["REDEVELOPMENT AUTHORITY"], "PRA")
    listed = routes_for(found, has_names=True, listed_available=True, side_yard_eligible=True)
    assert listed[0] == "land_bank_side_yard"
    assert first_route_code(listed, found.type) == 3
    assert first_route_code(["land_bank_side_yard", "land_bank_garden_agreement"], "city") == 2


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


@pytest.mark.parametrize(
    "names", [["MORALES ROSA"], ["KENSINGTON LOTS LLC"], ["GRACE BAPTIST CHURCH"], ["HACE"]]
)
def test_never_conservatorship_on_a_parcel_with_a_homestead_exemption(names: list[str]) -> None:
    # docs/VERIFICATION.md D1: the City's records say someone lives there, or did.
    assert routes(names, vacant=True, homestead=True) == ["ask_the_owner"]
    assert routes(names, vacant=True, gardened=True, homestead=True) == [
        "ask_the_owner",
        "garden_adverse_possession",
    ]
    assert routes(names, vacant=True, in_landcare=True, homestead=True) == [
        "community_landcare",
        "ask_the_owner",
    ]


def test_a_homestead_exemption_changes_no_other_route() -> None:
    assert routes(["PHILADELPHIA LAND BANK"], "PLB", side_yard_eligible=True, homestead=True) == [
        "land_bank_garden_agreement",
        "land_bank_side_yard",
    ]
    assert routes(["PHILADELPHIA HOUSING AUTH"], vacant=True, homestead=True) == ["ask_the_owner"]


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


def code(names: list[str], agency: str | None = None, **context) -> int:
    found = ow.owner_type(names, agency)
    listed = routes_for(found, has_names=bool(names), **context)
    return first_route_code(listed, found.type)


@pytest.mark.parametrize(
    ("names", "agency", "context", "expected"),
    [
        ([], None, {}, 0),  # an unknown owner with no name: no clear route yet
        ([], None, {"in_landcare": True}, 1),
        (["MORALES ROSA"], None, {"in_landcare": True, "vacant": True}, 1),
        (["PHILADELPHIA LAND BANK"], "PLB", {"in_landcare": True}, 1),
        (["PHILADELPHIA LAND BANK"], "PLB", {}, 2),
        (["CITY OF PHILA"], None, {"side_yard_eligible": True}, 2),
        (["REDEVELOPMENT AUTHORITY", "OF PHILADELPHIA"], "PRA", {}, 3),
        (["PHILA HOUSING DEV CORP"], None, {}, 3),
        (["PHILADELPHIA HOUSING AUTH"], None, {"vacant": True}, 4),
        (["SCHOOL DISTRICT OF PHILA"], None, {}, 4),
        (["MORALES ROSA"], None, {"vacant": True, "gardened": True}, 5),
        (["KENSINGTON LOTS LLC"], None, {}, 5),
        (["GRACE BAPTIST CHURCH"], None, {}, 5),
        (["HACE"], None, {}, 5),  # a name we could not type
    ],
)
def test_the_map_route_code_is_the_first_route_as_a_category(
    names, agency, context, expected
) -> None:
    assert code(names, agency, **context) == expected


def test_route_codes_follow_the_first_route_left_after_the_registry() -> None:
    # A route the registry no longer has is skipped, by the dossier and the map alike.
    assert first_route_code(["ask_the_owner", "conservatorship"], "individual") == 5
    assert first_route_code(["conservatorship"], "individual") == 5
    assert first_route_code(["ask_the_owner"], "housing_authority") == 4
    assert first_route_code(["land_bank_side_yard"], "land_bank") == 2
    assert first_route_code([], "land_bank") == 0


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
        dict(vacant=v, gardened=g, in_landcare=lc, side_yard_eligible=sy, listed_available=la)
        for v in (0, 1)
        for g in (0, 1)
        for lc in (0, 1)
        for sy in (0, 1)
        for la in (0, 1)
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
        # Checked on or after the routes were written (2026-10-04), never in the future.
        assert date(2026, 10, 4) <= REGISTRY.routes[route_id].last_checked <= date.today()


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
    # Rechecked since (tangled title help on 2026-10-08, for the displacement watch, M4.1).
    assert route.last_checked >= date(2026, 10, 4)
    assert route.links, f"{route_id} has no link"
