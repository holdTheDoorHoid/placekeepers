"""Which legal routes and suggestions apply to a parcel (registry/routes.yaml and
registry/suggestions.yaml; docs/ROUTES.md and DESIGN section 5.5).

Routes, by owner, the lawful route first:

* Land Bank and City lots: a garden agreement or license from the Land Bank; the side or rear
  yard route too, but only when the City owned property layer marks the lot eligible.
* Redevelopment Authority and PHDC lots: "contact PHDC about this parcel", until the route is
  researched (ROUTES.md).
* The housing authority and other public bodies: ask the owner (the body named in City records).
* Private lots (a person, a company, a nonprofit, or a name we could not type): ask the owner;
  where the lot is already a garden, garden adverse possession (2024 law, still to confirm with
  legal aid); and, only where we call the parcel vacant, conservatorship, which always carries
  the abuse warning in its registry entry. A parcel we do not call vacant may be someone's home.
* LandCare lots, whoever owns them: Community LandCare first, since PHS already cares for them.

Suggestions come from the vacancy call: a vacant lot gets "clean and green", a vacant building
"get this building sealed". Parcels we do not call vacant get none.
"""

from __future__ import annotations

from placekeepers.derive.owners import OwnerType

PRIVATE = frozenset({"individual", "company", "nonprofit"})


def routes_for(
    owner_type: OwnerType,
    *,
    has_names: bool,
    vacant: bool = False,
    side_yard_eligible: bool = False,
    in_landcare: bool = False,
    gardened: bool = False,
) -> list[str]:
    """Route ids for one parcel, in the order a person should try them."""
    routes: list[str] = []
    if in_landcare:
        routes.append("community_landcare")
    kind = owner_type.type
    if kind in {"land_bank", "city"}:
        routes.append("land_bank_garden_agreement")
        if side_yard_eligible:
            routes.append("land_bank_side_yard")
    elif kind == "redevelopment_authority" or owner_type.body in {"PHDC", "phdc"}:
        routes.append("contact_phdc")
    elif kind in {"housing_authority", "other_public"}:
        routes.append("ask_the_owner")
    elif kind in PRIVATE or (kind == "unknown" and has_names):
        routes.append("ask_the_owner")
        if gardened:
            routes.append("garden_adverse_possession")
        if vacant:
            routes.append("conservatorship")
    return routes


SUGGESTIONS_BY_KIND = {"lot": ["clean_and_green"], "building": ["seal_abandoned_building"]}


def suggestions_for(kind: str | None, known: set[str]) -> list[str]:
    """Suggestion ids for a parcel the vacancy call names a "lot" or a "building", limited to the
    suggestions the registry still has."""
    return [item for item in SUGGESTIONS_BY_KIND.get(kind or "", []) if item in known]
