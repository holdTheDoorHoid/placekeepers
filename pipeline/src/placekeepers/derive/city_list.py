"""The City's list of public property (LAMAAssets, source `city_owned_property`): the status its
land agencies give each parcel, which parcels they list as available, and which may go to the
owner of the house next door as a side yard (issue #36).

The Philadelphia Land Bank's "View Properties Map" is this same layer, showing the records whose
status begins "Owned - Available". There are four such statuses: plain, "(Garden Agreement)",
"(no construction permitted)" and "(not for SY)", the last meaning not as a side yard. The records
carry no date of their own, so the listing is as of the day the snapshot was fetched.

One parcel (one OPA account) can have several records, usually with the same status. When they
differ, the parcel takes an available status if any record has one (alphabetical among them),
else the first status in alphabetical order, as the dossiers did before; its side yard mark comes
from the records with that status.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

AVAILABLE_PREFIX = "OWNED - AVAILABLE"
NOT_FOR_SIDE_YARD = "NOT FOR SY"


def _normal(status: str | None) -> str:
    return " ".join(str(status or "").split()).upper()


def listed_available(status: str | None) -> bool:
    """True when the City's land agencies list the parcel as available (any of the four
    "Owned - Available" statuses)."""
    return _normal(status).startswith(AVAILABLE_PREFIX)


def side_yard_allowed(status: str | None, eligible: str | None) -> bool:
    """True when the City marks the parcel eligible for a side yard and its status does not say
    "not for SY"."""
    return _normal(eligible) == "YES" and NOT_FOR_SIDE_YARD not in _normal(status)


@dataclass(frozen=True)
class CityRecord:
    """One parcel on the City's list, its records put together."""

    agency: str | None
    status: str | None
    side_yard: bool
    available: bool
    location: str | None


def _status_key(status: str | None) -> tuple[bool, str]:
    return (not listed_available(status), status or "")


def by_account(
    rows: Iterable[tuple[str | None, str | None, str | None, str | None, str | None]],
) -> dict[str, CityRecord]:
    """Rows of (account, agency, status, side yard eligible, location), one per record, put
    together by account. Rows without an account are left out."""
    grouped: dict[str, list[tuple[str | None, str | None, str | None, str | None]]] = {}
    for account, agency, status, eligible, location in rows:
        if account:
            grouped.setdefault(account, []).append((agency, status, eligible, location))
    out: dict[str, CityRecord] = {}
    for account, records in grouped.items():
        statuses = [status for _, status, _, _ in records if status]
        status = min(statuses, key=_status_key) if statuses else None
        agencies = [agency for agency, _, _, _ in records if agency]
        locations = [location for _, _, _, location in records if location]
        out[account] = CityRecord(
            agency=min(agencies) if agencies else None,
            status=status,
            side_yard=any(
                side_yard_allowed(s, eligible) for _, s, eligible, _ in records if s == status
            ),
            available=listed_available(status),
            location=min(locations) if locations else None,
        )
    return out
