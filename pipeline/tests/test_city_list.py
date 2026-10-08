"""The City's list of public property: statuses, lots listed as available and side yards (issue
#36, derive/city_list.py)."""

from __future__ import annotations

import pytest

from placekeepers.derive.city_list import by_account, listed_available, side_yard_allowed

# The statuses on the City's list on 2026-10-08, with the four the Land Bank's map shows.
AVAILABLE = [
    "Owned - Available",
    "Owned - Available (Garden Agreement)",
    "Owned - Available (no construction permitted)",
    "Owned - Available (not for SY)",
]
NOT_AVAILABLE = [
    "Owned - On Hold for AHD",
    "Owned - Not Available",
    "Owned - Processing Applicant, Not Available",
    "Owned - Managed and Not Available",
    "Owned - On Hold",
    "Owned - Sale Pending",
    "Unknown - Research Pending",
    "Owned - RFP Released",
    "Owned - On Hold for HOME SD",
    "Owned - Held for City Council Member",
    "Owned - To Be Featured Soon",
    "Owned - Not Available (GSI Project)",
    "Owned - Competitive Bid Posted",
    "Available",
    "",
    None,
]


@pytest.mark.parametrize("status", AVAILABLE)
def test_the_four_available_statuses(status: str) -> None:
    assert listed_available(status)
    assert listed_available(status.upper())
    assert listed_available("  " + status.replace(" ", "  ") + " ")


@pytest.mark.parametrize("status", NOT_AVAILABLE)
def test_every_other_status_is_not_listed(status: str | None) -> None:
    assert not listed_available(status)


def test_side_yard_needs_the_citys_mark_and_no_not_for_sy() -> None:
    assert side_yard_allowed("Owned - Available", "Yes")
    assert side_yard_allowed("Owned - Available", " yes ")
    assert side_yard_allowed("Owned - On Hold", "Yes")
    assert not side_yard_allowed("Owned - Available", "No")
    assert not side_yard_allowed("Owned - Available", None)
    assert not side_yard_allowed("Owned - Available (not for SY)", "Yes")


def test_records_put_together_by_account() -> None:
    found = by_account(
        [
            ("100000001", "PLB", "Owned - Available", "Yes", "1 N 1st St"),
            # Two records: the available one wins, and its own side yard mark.
            ("100000002", "PUB", "Owned - On Hold for AHD", "Yes", "2 N 1st St"),
            ("100000002", "PUB", "Owned - Available", "No", "2 N 1st St"),
            # Two statuses, neither available: the first in alphabetical order, as before.
            ("100000003", "PLB", "Owned - Processing Applicant, Not Available", "Yes", None),
            ("100000003", "PLB", "Owned - Not Available", "Yes", None),
            ("100000004", "PRA", "Owned - Available (not for SY)", "Yes", None),
            (None, "PRA", "Owned - Available", "Yes", "No account"),
        ]
    )
    assert set(found) == {"100000001", "100000002", "100000003", "100000004"}
    one = found["100000001"]
    assert (one.agency, one.status, one.side_yard, one.available) == (
        "PLB",
        "Owned - Available",
        True,
        True,
    )
    assert one.location == "1 N 1st St"
    two = found["100000002"]
    assert (two.status, two.side_yard, two.available) == ("Owned - Available", False, True)
    three = found["100000003"]
    assert (three.status, three.side_yard, three.available) == (
        "Owned - Not Available",
        True,
        False,
    )
    four = found["100000004"]
    assert (four.side_yard, four.available) == (False, True)


def test_a_parcel_with_no_status() -> None:
    found = by_account([("100000005", None, None, None, None)])["100000005"]
    assert (found.agency, found.status, found.side_yard, found.available) == (
        None,
        None,
        False,
        False,
    )
