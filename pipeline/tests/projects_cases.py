"""The reports of projects neighbors finished that the tests use (M5.3, issue #47), as GitHub's
GraphQL API answers for them: two pages of issues carrying (or not) the approval label, with
everything a real reply holds that must never reach a published file (the reporter's user name,
the title, a photo, the answer about permission).

Run this file to write pipeline/tests/fixtures/projects_issues.json:

    pipeline/.venv/bin/python pipeline/tests/projects_cases.py

The cases, by issue number: 101 a garden on a lot link, with a photo and an @ mention in its note;
102 a cleanup at an address inside a range of house numbers, with a phone number and an email in
its note, closed as completed; 103 not approved; 104 finished in the future; 105 the box not
ticked; 106 outside the city; 107 suppressed in the curated file; 108 spam, not approved; 109
approved, with links in its group name and note; 110 not the form; 111 changed by the reporter
after approval; 112 closed as not planned; 113 a parcel the City does not know; 114 an address
that cannot be found; 115 the label added then removed; 116 the same garden as 101 again; 117 a
year that looks wrong; 118 changed after approval by the person who approved it; 119 placed by a
correction in the curated file.
"""

import json
from pathlib import Path

REPO = "holdTheDoorHoid/placekeepers"
OWNER = "holdTheDoorHoid"
CONSENT = (
    "I agree that this report may be shown on the Placekeepers map and in its data "
    "downloads under the site's data license, the Open Database License."
)


def body(kind, where, month, year, permission="Not needed", group=None, note=None, consent=True):
    def answer(v):
        return v if v else "_No response_"

    return (
        f"### What was done\n\n{kind}\n\n"
        f"### Where\n\n{answer(where)}\n\n"
        f"### Month it was finished\n\n{month}\n\n"
        f"### Year it was finished\n\n{year}\n\n"
        f"### Was permission given?\n\n{permission}\n\n"
        f"### Group name to show (optional)\n\n{answer(group)}\n\n"
        f"### What it took (optional)\n\n{answer(note)}\n\n"
        f"### Showing it on the map\n\n- [{'X' if consent else ' '}] {CONSENT}"
    )


def labeled(at, by=OWNER, label="project-approved"):
    return {
        "__typename": "LabeledEvent",
        "createdAt": at,
        "label": {"name": label},
        "actor": {"login": by},
    }


def unlabeled(at, by=OWNER, label="project-approved"):
    return {
        "__typename": "UnlabeledEvent",
        "createdAt": at,
        "label": {"name": label},
        "actor": {"login": by},
    }


def issue(
    number,
    title,
    text,
    *,
    author_edit=None,
    labels=("project-report", "project-approved"),
    events=None,
    state="OPEN",
    reason=None,
    created="2026-06-01T12:00:00Z",
):
    edited_at, editor = author_edit if author_edit else (None, None)
    return {
        "number": number,
        "url": f"https://github.com/{REPO}/issues/{number}",
        "title": title,
        "state": state,
        "stateReason": reason,
        "createdAt": created,
        "lastEditedAt": edited_at,
        "body": text,
        "author": {"login": "neighbor-ana"},
        "editor": {"login": editor} if editor else None,
        "labels": {"nodes": [{"name": n} for n in labels]},
        "timelineItems": {
            "nodes": events if events is not None else [labeled("2026-06-02T14:00:00Z")]
        },
    }


LINK = "https://holdthedoorhoid.github.io/placekeepers/#v=f&m=17/39.99/-75.13&p=371000001"
issues = [
    issue(
        101,
        "Project: garden by Ana Lopez",
        body(
            "Garden",
            LINK,
            "May",
            "2026",
            permission="No, or not sure",
            group="Lawrence Street Growers",
            note=(
                "Twelve neighbors, four Saturdays, about $300 for soil.\n\n"
                "![our garden](https://github.com/user-attachments/assets/0f1e2d3c-photo)\n\n"
                "Thanks @neighbor-ben for the shovels!"
            ),
        ),
        author_edit=("2026-06-01T13:00:00Z", "neighbor-ana"),
    ),
    issue(
        102,
        "Project: cleanup",
        body(
            "Cleanup",
            "1234 North 5th Street, Philadelphia, PA 19122",
            "September",
            "2026",
            permission="Yes, from the owner",
            note="Call me at 215-555-0123 or write ben.sample@example.com to join next time.",
        ),
        state="CLOSED",
        reason="COMPLETED",
    ),
    issue(
        103,
        "Project: not approved yet",
        body("Trees", "2933 N Lawrence St", "June", "2026"),
        labels=("project-report",),
        events=[],
    ),
    issue(104, "Project: future", body("Garden", "371000002", "December", "2026")),
    issue(105, "Project: no consent", body("Cleanup", "371000002", "March", "2026", consent=False)),
    issue(
        106,
        "Project: Camden",
        body("Mural or art", "100 Market St, Camden, NJ 08102", "April", "2026"),
    ),
    issue(107, "Project: suppressed", body("Place to sit", "371000001", "July", "2026")),
    issue(
        108,
        "BUY CHEAP PILLS",
        body(
            "Other",
            "http://spam.example.com/pills",
            "January",
            "2026",
            group="BEST DEALS http://spam.example.com",
            note="Visit www.spam.example.com now",
        ),
        labels=("project-report",),
        events=[],
    ),
    issue(
        109,
        "Project: approved with links",
        body(
            "A 311 fix",
            "2931 N Lawrence St",
            "August",
            "2026",
            group="Block Club <a href='http://spam.example.com'>site</a>",
            note=(
                "We reported the dark light on [Philly311](https://www.phila.gov/311) and it "
                "was fixed in a week. See https://example.com/more"
            ),
        ),
    ),
    issue(
        110,
        "Free text, not the form",
        "Hello, we planted flowers somewhere nice. Please put us on the map! http://spam.example.com",
    ),
    issue(
        111,
        "Project: changed after approval",
        body("Garden", "371000002", "May", "2026", group="Edited by the reporter"),
        author_edit=("2026-06-05T09:00:00Z", "neighbor-ana"),
    ),
    issue(
        112,
        "Project: not planned",
        body("Garden", "371000002", "May", "2026"),
        state="CLOSED",
        reason="NOT_PLANNED",
    ),
    issue(
        113,
        "Project: unknown parcel",
        body("Trees", "https://holdthedoorhoid.github.io/placekeepers/#p=999999999", "May", "2026"),
    ),
    issue(
        114, "Project: unknown address", body("Cleanup", "Corner of 5th and Nowhere", "May", "2026")
    ),
    issue(
        115,
        "Project: label removed",
        body("Garden", "371000002", "May", "2026"),
        labels=("project-report",),
        events=[labeled("2026-06-02T14:00:00Z"), unlabeled("2026-06-03T14:00:00Z")],
    ),
    issue(
        116,
        "Project: the same garden again",
        body("Garden", "Lot 371000001", "May", "2026", group="lawrence street growers"),
    ),
    issue(117, "Project: old year", body("Trees", "371000002", "May", "1850")),
    issue(
        118,
        "Project: trees, edited by the owner",
        body("Trees", "371000002", "October", "2026", group="Cambria Tree Tenders"),
        author_edit=("2026-10-03T09:00:00Z", OWNER),
        events=[
            labeled("2026-10-01T10:00:00Z", label="project-report"),
            labeled("2026-10-02T10:00:00Z"),
        ],
    ),
    issue(
        119,
        "Project: bench behind the house",
        body("Place to sit", "the lot behind my house", "April", "2025"),
    ),
]
pages = [
    {
        "data": {
            "repository": {
                "issues": {
                    "pageInfo": {"hasNextPage": True, "endCursor": "Y3Vyc29yOjEw"},
                    "nodes": issues[:10],
                }
            }
        }
    },
    {
        "data": {
            "repository": {
                "issues": {
                    "pageInfo": {"hasNextPage": False, "endCursor": "Y3Vyc29yOjE5"},
                    "nodes": issues[10:],
                }
            }
        }
    },
]

if __name__ == "__main__":
    target = Path(__file__).parent / "fixtures" / "projects_issues.json"
    target.write_text(json.dumps(pages, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
