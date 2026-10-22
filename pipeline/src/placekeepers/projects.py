"""Projects neighbors finished (M5.3, issue #47): the reports the owner approved, checked and merged
with the hand entries and corrections in data/curated/interventions.yaml.

Where a report comes from. Neighbors fill in the GitHub issue form "Tell us about a project you
finished" (.github/ISSUE_TEMPLATE/project.yml). The owner reads it and approves it with one click,
the `project-approved` label (owner, 2026-10-21). Only issues carrying that label are read, with
GitHub's GraphQL API and the workflow's built in read only token (`fetch_reports`). Each issue is
reduced at once to its form answers (`reduce_issue`): no GitHub user name, no title, no photo and
no answer about permission is ever kept, not even in the download cache.

Which reports appear (`build_projects`). A report appears only when all of these hold:

* it carries the label now, and it was not closed as not planned (or as a duplicate);
* nobody but the person who approved it has changed it since it was approved (anyone else's edit
  takes it off the map until the owner approves it again, by removing the label and adding it);
* its answers can be read as the form's answers, and the box agreeing to show it is ticked;
* what was done is one of the form's answers, and the month and year are real and not in the
  future (Philadelphia time);
* it names a parcel the City's property list knows (the lot link or the 9 digit number), or an
  address found there, and the place lies inside Philadelphia;
* data/curated/interventions.yaml does not suppress it. A curated suppression always wins.

A report that fails stays off the map, and the build notes say why by its issue number, so the
owner can ask the reporter. Free text the map shows (the group name and the "what it took" note)
is cleaned first (`clean_text`): links, photos, email addresses, phone numbers and @ mentions are
left out, and the note says so.

What is published (docs/CONTRACTS.md): the map layer `projects` (tiles/projects.pmtiles) and the
table `tables/projects.json`, the approved projects with their dates, which the lot page reads and
which M5.4 ("Did it work?", issue #48) reads as its list of projects neighbors finished.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.parquet as pq
import shapely
import yaml
from shapely.geometry import Point
from shapely.geometry.base import BaseGeometry

from placekeepers.cache import atomic_write_json
from placekeepers.config import LOCAL_TZ, iso_z

log = logging.getLogger(__name__)

#: Every build note about the projects starts with this, so a quick publish can replace them.
NOTE_PREFIX = "Projects neighbors finished: "
#: The curated file, relative to the repository root.
CURATED_FILE = "data/curated/interventions.yaml"
#: The published table, relative to the data root.
TABLE_FILE = "tables/projects.json"
#: The layer (registry/layers.yaml) and its tile file and layer name.
LAYER_ID = "projects"
LAYER_FILE = "tiles/projects.pmtiles"
SOURCE_LAYER = "projects"
#: The registry sources.
REPORTS_SOURCE = "project_reports"
CORRECTIONS_SOURCE = "project_corrections"

GITHUB_GRAPHQL = "https://api.github.com/graphql"

# ---------------------------------------------------------------------------------------------
# The form (.github/ISSUE_TEMPLATE/project.yml). A test checks these against the form itself.

#: The form's labels, as GitHub writes them as headings in the issue, and our name for each.
FORM_FIELDS: dict[str, str] = {
    "What was done": "kind",
    "Where": "where",
    "Month it was finished": "month",
    "Year it was finished": "year",
    "Was permission given?": "permission",
    "Group name to show (optional)": "group",
    "What it took (optional)": "note",
    "Showing it on the map": "consent",
}
#: The form's answers to "What was done", and the kind each one is.
FORM_KINDS: dict[str, str] = {
    "Cleanup": "cleanup",
    "Garden": "garden",
    "Place to sit": "seating",
    "Mural or art": "art",
    "Trees": "trees",
    "A shelter or bench the City installed": "city_install",
    "A 311 fix": "fix_311",
    "Other": "other",
}
#: Each kind's number in the map's tiles (`k`, docs/CONTRACTS.md section 4).
KIND_CODES: dict[str, int] = {
    "other": 0,
    "cleanup": 1,
    "garden": 2,
    "seating": 3,
    "art": 4,
    "trees": 5,
    "city_install": 6,
    "fix_311": 7,
}
MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
#: A finished year before this is taken for a typing mistake.
EARLIEST_YEAR = 1950
#: GitHub writes this for an optional field left empty.
NO_RESPONSE = "_No response_"
#: Closing reasons that take a report off the map (the owner's "not planned", and duplicates).
CLOSED_OFF = {"NOT_PLANNED", "DUPLICATE"}

#: How long the map's free text may be.
GROUP_MAX = 80
NOTE_MAX = 600

# ---------------------------------------------------------------------------------------------
# Reading an issue


def parse_form(body: str | None) -> dict[str, str] | None:
    """The form's answers in an issue body, by our names, or None when the body is not the
    project form. GitHub writes each answer under a `### <label>` heading. The first heading of a
    label counts: a heading typed inside a later answer cannot change an earlier one."""
    if not body:
        return None
    sections: list[tuple[str, list[str]]] = []
    for line in body.replace("\r\n", "\n").split("\n"):
        heading = re.match(r"^###\s+(.+?)\s*$", line)
        if heading:
            sections.append((heading.group(1), []))
        elif sections:
            sections[-1][1].append(line)
    answers: dict[str, str] = {}
    for label, lines in sections:
        key = FORM_FIELDS.get(label)
        if key is None or key in answers:
            continue
        value = "\n".join(lines).strip()
        answers[key] = "" if value == NO_RESPONSE else value
    if "kind" not in answers or "where" not in answers:
        return None
    return answers


def consent_given(answer: str | None) -> bool:
    """The box agreeing to show the report is ticked: `- [X] I agree ...`."""
    return bool(answer) and re.search(r"(?m)^\s*[-*]\s*\[[xX]\]\s*I agree\b", answer) is not None


def _approval(node: dict[str, Any], label: str) -> tuple[str | None, str | None]:
    """When the label was last added (with no removal after it), and who added it."""
    events = [
        item
        for item in ((node.get("timelineItems") or {}).get("nodes") or [])
        if item and ((item.get("label") or {}).get("name") == label)
    ]
    events.sort(key=lambda item: item.get("createdAt") or "")
    approved_at: str | None = None
    approver: str | None = None
    for item in events:
        if item.get("__typename") == "LabeledEvent":
            approved_at = item.get("createdAt")
            approver = (item.get("actor") or {}).get("login")
        elif item.get("__typename") == "UnlabeledEvent":
            approved_at, approver = None, None
    return approved_at, approver


def reduce_issue(node: dict[str, Any], label: str) -> dict[str, Any]:
    """One issue from GitHub's GraphQL API, reduced to what the pipeline keeps: its number, link,
    state, when it was approved, whether someone else changed it after that, and the form's
    answers that the map may show. User names are read only to tell whether the last edit came
    from the person who approved it, and never kept; the title, the answer about permission and
    anything else in the body are dropped here."""
    labels = {item.get("name") for item in ((node.get("labels") or {}).get("nodes") or []) if item}
    approved_at, approver = _approval(node, label)
    edited_at = node.get("lastEditedAt")
    editor = (node.get("editor") or {}).get("login")
    edited_after = bool(
        edited_at and approved_at and edited_at > approved_at and (not editor or editor != approver)
    )
    answers = parse_form(node.get("body"))
    record: dict[str, Any] = {
        "issue": int(node["number"]),
        "url": node.get("url"),
        "state": node.get("state"),
        "state_reason": node.get("stateReason"),
        "created_at": node.get("createdAt"),
        "approved": label in labels,
        "approved_at": approved_at,
        "edited_after_approval": edited_after,
        "form": answers is not None,
    }
    for key in ("kind", "where", "month", "year"):
        record[key] = (answers or {}).get(key) or None
    if record["where"]:
        # The place is read from the answer later; nothing in it is published.
        for pattern in (_EMAIL, _MENTION, _PHONE):
            record["where"] = pattern.sub(" ", record["where"]).strip() or None
    # The texts the map may show are cleaned at once, so not even the download cache keeps a
    # photo link, an email address, a phone number or an @ mention from them.
    group, left_group = clean_text((answers or {}).get("group"), GROUP_MAX)
    note, left_note = clean_text((answers or {}).get("note"), NOTE_MAX)
    record["group"], record["note"] = group, note
    record["left_out"] = ",".join(sorted(left_group | left_note)) or None
    record["consent"] = consent_given((answers or {}).get("consent"))
    return record


#: The GraphQL query: every issue with the label, open or closed, 50 at a time.
ISSUES_QUERY = """
query($owner: String!, $name: String!, $labels: [String!], $cursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 50, after: $cursor, labels: $labels, states: [OPEN, CLOSED],
           orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number url state stateReason createdAt lastEditedAt body
        editor { login }
        labels(first: 30) { nodes { name } }
        timelineItems(last: 50, itemTypes: [LABELED_EVENT, UNLABELED_EVENT]) {
          nodes {
            __typename
            ... on LabeledEvent { createdAt label { name } actor { login } }
            ... on UnlabeledEvent { createdAt label { name } actor { login } }
          }
        }
      }
    }
  }
}
"""

#: GitHub lets a query walk at most this many pages here (5,000 reports); more is an error.
MAX_PAGES = 100


class ReportsError(RuntimeError):
    """The reports could not be read from GitHub."""


def fetch_reports(
    post: Callable[[dict[str, Any]], Any], repo: str, label: str
) -> list[dict[str, Any]]:
    """Every issue of `repo` with `label`, reduced by `reduce_issue`, oldest first. `post` sends
    one GraphQL request (a JSON body) and returns the decoded reply."""
    owner, name = repo.split("/", 1)
    records: list[dict[str, Any]] = []
    cursor: str | None = None
    for _ in range(MAX_PAGES):
        reply = post(
            {
                "query": ISSUES_QUERY,
                "variables": {"owner": owner, "name": name, "labels": [label], "cursor": cursor},
            }
        )
        if not isinstance(reply, dict):
            raise ReportsError("GitHub did not answer with JSON")
        if reply.get("errors"):
            message = "; ".join(str(e.get("message", e)) for e in reply["errors"])[:300]
            raise ReportsError(f"GitHub answered with an error: {message}")
        repository = (reply.get("data") or {}).get("repository")
        if repository is None:
            raise ReportsError(f"GitHub does not know the repository {repo}")
        issues = repository["issues"]
        records.extend(reduce_issue(node, label) for node in issues["nodes"] if node)
        if not issues["pageInfo"]["hasNextPage"]:
            return records
        cursor = issues["pageInfo"]["endCursor"]
    raise ReportsError(f"More than {MAX_PAGES * 50} reports: not read")


# ---------------------------------------------------------------------------------------------
# Cleaning the free text the map shows

_MD_IMAGE = re.compile(r"!\[[^\]\n]*\]\([^)\n]*\)")
_HTML_IMAGE = re.compile(r"(?is)<\s*(img|picture|video|source)\b[^>]*>")
_HTML_TAG = re.compile(r"(?s)<[^<>]{0,500}>")
_MD_LINK = re.compile(r"\[([^\]\n]*)\]\([^)\n]*\)")
_URL = re.compile(r"(?i)\b(?:https?://|www\.)\S+|\b[a-z0-9.-]+\.(?:com|org|net|io|gov|edu)/\S*")
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_MENTION = re.compile(r"(?<![A-Za-z0-9_.@])@[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})")
_PHONE = re.compile(r"(?<![\d$])(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
_MARKUP = re.compile(r"[`*]+|^\s*(?:#+|>)\s*", re.MULTILINE)

#: What `clean_text` left out, in plain words.
REMOVED_WORDS = {
    "photo": "a photo",
    "link": "a link",
    "email": "an email address",
    "mention": "a GitHub user name",
    "phone": "a phone number",
}


def clean_text(value: str | None, limit: int) -> tuple[str | None, set[str]]:
    """Text the map may show: photos, links, email addresses, @ mentions (GitHub user names) and
    phone numbers left out, markup removed, white space made single spaces, and cut at a word
    before `limit` characters. Returns the text (None when nothing is left) and what was left
    out."""
    removed: set[str] = set()
    if not value:
        return None, removed
    text = value

    def drop(pattern: re.Pattern[str], what: str, keep: str = " ") -> None:
        nonlocal text
        text, count = pattern.subn(keep, text)
        if count:
            removed.add(what)

    drop(_MD_IMAGE, "photo")
    drop(_HTML_IMAGE, "photo")
    text = _HTML_TAG.sub(" ", text)
    text, links = _MD_LINK.subn(r"\1", text)
    if links:
        removed.add("link")
    drop(_EMAIL, "email")
    drop(_URL, "link")
    drop(_MENTION, "mention")
    drop(_PHONE, "phone")
    text = _MARKUP.sub(" ", text)
    text = " ".join(text.split())
    text = re.sub(r"\s+([.,;:!?])", r"\1", text).strip(" ,;:")
    if not text:
        return None, removed
    if len(text) > limit:
        cut = text[: limit - 1]
        if " " in cut:
            cut = cut[: cut.rfind(" ")]
        text = cut.rstrip(" ,;:") + "…"
    return text, removed


def removed_words(removed: Iterable[str]) -> str:
    words = [REMOVED_WORDS[key] for key in REMOVED_WORDS if key in set(removed)]
    if len(words) <= 1:
        return "".join(words)
    return ", ".join(words[:-1]) + " and " + words[-1]


# ---------------------------------------------------------------------------------------------
# Hand entries and corrections (data/curated/interventions.yaml)

ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,40}$")
PARCEL_PATTERN = re.compile(r"^\d{9}$")
FINISHED_PATTERN = re.compile(r"^(\d{4})-(\d{2})$")
CURATED_KEYS = {
    "issue",
    "id",
    "suppressed",
    "kind",
    "parcel",
    "address",
    "lat",
    "lng",
    "finished",
    "group",
    "what_it_took",
    "source",
    "comment",
}


class CuratedProjectsError(ValueError):
    """The curated file cannot be read at all."""


@dataclass(frozen=True)
class CuratedProject:
    """One entry of data/curated/interventions.yaml: a correction to an issue's report, or a hand
    entry with its own id."""

    issue: int | None = None
    id: str | None = None
    suppressed: bool = False
    kind: str | None = None
    parcel: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    finished: str | None = None
    group: str | None = None
    what_it_took: str | None = None
    source: str | None = None


@dataclass
class CuratedProjects:
    corrections: dict[int, CuratedProject] = field(default_factory=dict)
    entries: list[CuratedProject] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


def _finished_text(value: Any) -> str | None:
    """A curated `finished`: 2025-06 (text) or a date, as YYYY-MM."""
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return f"{value.year:04d}-{value.month:02d}"
    if isinstance(value, str) and FINISHED_PATTERN.match(value.strip()):
        return value.strip()
    return None


def _curated_entry(raw: Any, where: str) -> tuple[CuratedProject | None, str | None]:
    if not isinstance(raw, dict):
        return None, f"{where} is not a set of keys and values"
    unknown = sorted(set(raw) - CURATED_KEYS)
    if unknown:
        return None, f"{where} has unknown keys: {', '.join(map(str, unknown))}"
    issue = raw.get("issue")
    entry_id = raw.get("id")
    if (issue is None) == (entry_id is None):
        return None, f"{where} needs exactly one of issue (a correction) or id (a hand entry)"
    if issue is not None and (isinstance(issue, bool) or not isinstance(issue, int) or issue < 1):
        return None, f"{where}: issue must be an issue number"
    if entry_id is not None and not (isinstance(entry_id, str) and ID_PATTERN.match(entry_id)):
        return None, f"{where}: id must be lowercase letters, digits and underscores"
    label = f"issue #{issue}" if issue is not None else f"entry {entry_id}"
    suppressed = raw.get("suppressed", False)
    if not isinstance(suppressed, bool):
        return None, f"{label}: suppressed must be true or false"
    kind = raw.get("kind")
    if kind is not None and kind not in KIND_CODES:
        return None, f"{label}: kind must be one of {', '.join(KIND_CODES)}"
    parcel = raw.get("parcel")
    if parcel is not None:
        parcel = str(parcel).strip()
        if not PARCEL_PATTERN.match(parcel):
            return None, f"{label}: parcel must be 9 digits, in quotes"
    lat, lng = raw.get("lat"), raw.get("lng")
    if (lat is None) != (lng is None):
        return None, f"{label}: lat and lng go together"
    if lat is not None and not all(
        isinstance(v, int | float) and not isinstance(v, bool) for v in (lat, lng)
    ):
        return None, f"{label}: lat and lng must be numbers"
    finished = None
    if raw.get("finished") is not None:
        finished = _finished_text(raw["finished"])
        if finished is None:
            return None, f"{label}: finished must be a year and month, such as 2025-06"
    text = {}
    for key in ("address", "group", "what_it_took", "source"):
        value = raw.get(key)
        if value is not None and not isinstance(value, str):
            return None, f"{label}: {key} must be text"
        text[key] = value.strip() if isinstance(value, str) and value.strip() else None
    if text["source"] is not None and not re.match(r"^https://\S+$", text["source"]):
        return None, f"{label}: source must be an https link"
    entry = CuratedProject(
        issue=issue,
        id=entry_id,
        suppressed=suppressed,
        kind=kind,
        parcel=parcel,
        address=text["address"],
        lat=float(lat) if lat is not None else None,
        lng=float(lng) if lng is not None else None,
        finished=finished,
        group=text["group"],
        what_it_took=text["what_it_took"],
        source=text["source"],
    )
    if entry_id is not None and not suppressed:
        if kind is None or finished is None:
            return None, f"{label}: a hand entry needs kind and finished"
        if parcel is None and entry.address is None and lat is None:
            return None, f"{label}: a hand entry needs parcel, address, or lat and lng"
    return entry, None


def read_curated(path: Path) -> CuratedProjects:
    """data/curated/interventions.yaml, entry by entry. A broken entry is skipped and reported
    by its issue number or id; a suppression is kept even when the rest of its entry is broken,
    so a report the owner took down never comes back by mistake."""
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return CuratedProjects()
    except (OSError, yaml.YAMLError) as exc:
        raise CuratedProjectsError(f"{CURATED_FILE} cannot be read: {exc}") from exc
    if raw is None:
        raw = []
    if not isinstance(raw, list):
        raise CuratedProjectsError(f"{CURATED_FILE} must be a list")
    out = CuratedProjects()
    seen_ids: set[str] = set()
    for index, item in enumerate(raw, start=1):
        where = f"entry {index}"
        entry, problem = _curated_entry(item, where)
        if entry is None:
            # Keep a suppression whatever else is wrong with the entry.
            if isinstance(item, dict) and item.get("suppressed") is True:
                issue = item.get("issue")
                if isinstance(issue, int) and not isinstance(issue, bool):
                    out.corrections[issue] = CuratedProject(issue=issue, suppressed=True)
            out.problems.append(f"{CURATED_FILE}: {problem}")
            continue
        if entry.issue is not None:
            if entry.issue in out.corrections:
                out.problems.append(
                    f"{CURATED_FILE}: issue #{entry.issue} is listed twice; only the first counts"
                )
                if entry.suppressed:
                    out.corrections[entry.issue] = CuratedProject(
                        issue=entry.issue, suppressed=True
                    )
                continue
            out.corrections[entry.issue] = entry
        else:
            assert entry.id is not None
            if entry.id in seen_ids:
                out.problems.append(f"{CURATED_FILE}: entry {entry.id} is listed twice")
                continue
            seen_ids.add(entry.id)
            out.entries.append(entry)
    return out


# ---------------------------------------------------------------------------------------------
# Finding the place: the City's property list (OPA) and the city limits

_DIRECTIONS = {"NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W"}
_SUFFIXES = {
    "STREET": "ST",
    "STR": "ST",
    "AVENUE": "AVE",
    "AV": "AVE",
    "ROAD": "RD",
    "LANE": "LN",
    "DRIVE": "DR",
    "PLACE": "PL",
    "BOULEVARD": "BLVD",
    "SQUARE": "SQ",
    "TERRACE": "TER",
    "COURT": "CT",
    "CIRCLE": "CIR",
    "PARKWAY": "PKWY",
    "PLAZA": "PLZ",
    "ALLEY": "ALY",
    "HEIGHTS": "HTS",
}
#: Places outside the city as people write them after a comma in an address ("Camden, NJ").
#: Street names are not checked: Philadelphia has a Chester Avenue and a Cheltenham Avenue.
_OUTSIDE_PLACES = re.compile(
    r",\s*(?:NJ|N\.J\.|NEW JERSEY|DE|DELAWARE|NY|NEW YORK|MD|MARYLAND|CAMDEN|CHERRY HILL|"
    r"CHESTER|UPPER DARBY|DARBY|CHELTENHAM|ABINGTON|BENSALEM|NORRISTOWN|BALA CYNWYD|"
    r"LOWER MERION|YEADON|LANSDOWNE|JENKINTOWN|WILMINGTON|PITTSBURGH)\b|\bNEW JERSEY\b"
)
_ORDINALS = {
    "FIRST": "1ST",
    "SECOND": "2ND",
    "THIRD": "3RD",
    "FOURTH": "4TH",
    "FIFTH": "5TH",
    "SIXTH": "6TH",
    "SEVENTH": "7TH",
    "EIGHTH": "8TH",
    "NINTH": "9TH",
    "TENTH": "10TH",
    "ELEVENTH": "11TH",
    "TWELFTH": "12TH",
    "THIRTEENTH": "13TH",
}
_ZIP = re.compile(r"(?<!\d)(\d{5})(?:-\d{4})?(?!\d)")
_PARCEL_IN_LINK = re.compile(r"[#&?]p=(\d{9})(?!\d)")
_NINE_DIGITS = re.compile(r"(?<!\d)(\d{9})(?!\d)")
_HOUSE = re.compile(r"^(\d+)(?:-(\d+))?([A-Z]?)\s+(.+)$")


def parcel_in(where: str | None) -> str | None:
    """The 9 digit parcel number in an answer: the lot link's `p=`, else any 9 digit number."""
    if not where:
        return None
    found = _PARCEL_IN_LINK.search(where) or _NINE_DIGITS.search(where)
    return found.group(1) if found else None


def outside_city(where: str | None) -> bool:
    """The answer names a place outside Philadelphia: a ZIP code that is not the city's (191..),
    or a nearby state or town."""
    if not where:
        return False
    text = where.upper()
    zips = _ZIP.findall(text)
    if any(not z.startswith("191") for z in zips):
        return True
    return _OUTSIDE_PLACES.search(text) is not None


def normalize_address(text: str | None) -> str | None:
    """An address as the City's property list writes it, such as "2931 N LAWRENCE ST", or None
    when it does not start with a house number."""
    if not text:
        return None
    line = next((part for part in text.splitlines() if part.strip()), "")
    t = line.upper()
    t = re.sub(r"(?i)\bhttps?://\S+", " ", t)
    t = re.sub(r"[.,;]", " ", t)
    t = re.sub(r"\s(?:APT|APARTMENT|UNIT|STE|SUITE|FL|FLOOR|#)\b.*$", "", t)
    t = re.sub(r"#.*$", "", t)
    t = re.sub(r"\b(?:PHILADELPHIA|PHILA|PHL)\b.*$", "", t)
    t = re.sub(r"\bPA\b.*$", "", t)
    t = _ZIP.sub(" ", t)
    words = t.split()
    if len(words) < 2 or not re.match(r"^\d+(?:-\d+)?[A-Z]?$", words[0]):
        return None
    if len(words) > 2 and words[1] in _DIRECTIONS:
        words[1] = _DIRECTIONS[words[1]]
    words = [_ORDINALS.get(word, word) for word in words]
    if len(words) > 2:
        words[-1] = _SUFFIXES.get(words[-1], words[-1])
    return " ".join(words)


@dataclass(frozen=True)
class Place:
    parcel: str
    address: str | None
    lng: float
    lat: float


#: The columns of the City's property list the projects need; the project inputs keep only these.
INDEX_COLUMNS = ("parcel_number", "location", "lat", "lng")


def read_index_table(path: Path) -> pa.Table:
    """The property list's parcel numbers, addresses and points; a column the file lacks is
    empty, so a short copy finds nothing instead of failing."""
    names = set(pq.read_schema(path).names)
    table = pq.read_table(path, columns=[name for name in INDEX_COLUMNS if name in names])
    types = {"parcel_number": pa.string(), "location": pa.string()}
    for name in INDEX_COLUMNS:
        if name not in names:
            table = table.append_column(
                name, pa.nulls(table.num_rows, types.get(name, pa.float64()))
            )
    return table.select(list(INDEX_COLUMNS))


class ParcelIndex:
    """The City's property list (OPA), for finding a report's parcel by its number or address."""

    def __init__(self, table: pa.Table):
        self.table = table.select(list(INDEX_COLUMNS))

    @classmethod
    def from_parquet(cls, path: Path) -> ParcelIndex:
        return cls(read_index_table(path))

    def _places(self, mask: pa.ChunkedArray | pa.Array) -> list[Place]:
        rows = self.table.filter(mask).to_pylist()
        rows.sort(key=lambda row: row["parcel_number"])
        return [
            Place(row["parcel_number"], row["location"], float(row["lng"]), float(row["lat"]))
            for row in rows
            if row["lat"] is not None and row["lng"] is not None
        ]

    def parcels(self, numbers: Iterable[str]) -> dict[str, Place]:
        wanted = sorted(set(numbers))
        if not wanted:
            return {}
        mask = pc.is_in(self.table["parcel_number"], value_set=pa.array(wanted, pa.string()))
        return {place.parcel: place for place in self._places(mask)}

    def address(self, text: str | None) -> Place | None:
        """The parcel at an address: an exact match first, then a parcel whose address is a
        range that holds the number ("1234-36 N 5TH ST" holds 1236)."""
        key = normalize_address(text)
        if key is None:
            return None
        exact = self._places(pc.equal(self.table["location"], key))
        if exact:
            return exact[0]
        house = _HOUSE.match(key)
        if house is None or house.group(2):
            return None
        number, street = int(house.group(1)), house.group(4)
        for place in self._places(pc.ends_with(self.table["location"], " " + street)):
            ranged = _HOUSE.match(place.address or "")
            if not ranged or not ranged.group(2) or ranged.group(4) != street:
                continue
            low_text, high_tail = ranged.group(1), ranged.group(2)
            high_text = low_text[: max(0, len(low_text) - len(high_tail))] + high_tail
            if int(low_text) <= number <= int(high_text):
                return place
        return None


# A generous box around Philadelphia, as for every other point layer, used when the city limits
# are not at hand.
PHILLY_LAT = (39.80, 40.20)
PHILLY_LNG = (-75.35, -74.90)


def inside(limits: BaseGeometry | None, lng: float, lat: float) -> bool:
    if limits is not None:
        return bool(limits.covers(Point(lng, lat)))
    return PHILLY_LAT[0] <= lat <= PHILLY_LAT[1] and PHILLY_LNG[0] <= lng <= PHILLY_LNG[1]


# ---------------------------------------------------------------------------------------------
# Building the list


@dataclass
class Project:
    """One project the map shows."""

    id: str
    kind: str
    finished: str
    lng: float
    lat: float
    issue: int | None = None
    approved: str | None = None
    parcel: str | None = None
    address: str | None = None
    group: str | None = None
    note: str | None = None
    link: str | None = None

    def table_row(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "issue": self.issue,
            "kind": self.kind,
            "finished": self.finished,
            "approved": self.approved,
            "parcel": self.parcel,
            "address": self.address,
            "lng": self.lng,
            "lat": self.lat,
            "group": self.group,
            "note": self.note,
            "link": self.link,
        }

    def properties(self) -> dict[str, Any]:
        """The short properties of the map's `projects` layer (docs/CONTRACTS.md section 4)."""
        props: dict[str, Any] = {"id": self.id, "k": KIND_CODES[self.kind], "f": self.finished}
        for key, value in (
            ("p", self.parcel),
            ("a", self.address),
            ("g", self.group),
            ("n", self.note),
            ("l", self.link),
        ):
            if value:
                props[key] = value
        return props


@dataclass
class Outcome:
    """What became of one approved report or hand entry: shown, or held and why."""

    ref: str
    shown: bool
    reason: str | None = None
    #: a held report the owner should look at (not one the owner took down on purpose)
    needs_owner: bool = False


@dataclass
class ProjectsBuild:
    projects: list[Project] = field(default_factory=list)
    outcomes: list[Outcome] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    @property
    def held(self) -> list[Outcome]:
        return [o for o in self.outcomes if not o.shown]


def month_words(finished: str) -> str:
    year, month = finished.split("-")
    return f"{MONTHS[int(month) - 1]} {year}"


def _month_of(answer: str | None) -> int | None:
    if not answer:
        return None
    text = answer.strip()
    if text.isdigit() and 1 <= int(text) <= 12:
        return int(text)
    for number, name in enumerate(MONTHS, start=1):
        if text.lower() == name.lower():
            return number
    return None


def _year_of(answer: str | None) -> int | None:
    if not answer:
        return None
    found = re.fullmatch(r"\s*(\d{4})\s*", answer)
    return int(found.group(1)) if found else None


def _approved_day(approved_at: str | None) -> str | None:
    if not approved_at:
        return None
    try:
        moment = datetime.fromisoformat(approved_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    return moment.astimezone(LOCAL_TZ).date().isoformat()


def _issue_link(url: Any, repo: str | None, issue: int) -> str | None:
    """The report's own page on GitHub: the address GitHub gave, when it is this repository's."""
    if not isinstance(url, str):
        return None
    if repo and url == f"https://github.com/{repo}/issues/{issue}":
        return url
    if repo is None and re.fullmatch(r"https://github\.com/[\w.-]+/[\w.-]+/issues/\d+", url):
        return url
    return None


class _Checker:
    """Checks reports and hand entries one by one, and gathers the outcome of each."""

    def __init__(
        self,
        index: ParcelIndex | None,
        limits: BaseGeometry | None,
        today: date,
        repo: str | None,
    ):
        self.index = index
        self.limits = limits
        self.today = today
        self.repo = repo
        self.build = ProjectsBuild()

    def hold(self, ref: str, reason: str, needs_owner: bool = True) -> None:
        self.build.outcomes.append(Outcome(ref, False, reason, needs_owner))

    def finished(self, year: int | None, month: int | None) -> tuple[str | None, str | None]:
        if year is None or month is None:
            return None, "the month or year it was finished could not be read"
        if year < EARLIEST_YEAR:
            return None, f"the year it was finished, {year}, looks wrong"
        text = f"{year:04d}-{month:02d}"
        if (year, month) > (self.today.year, self.today.month):
            return None, f"the month it was finished, {month_words(text)}, is in the future"
        return text, None

    def locate(
        self,
        parcel: str | None,
        address: str | None,
        point: tuple[float, float] | None,
        where: str | None,
        places: dict[str, Place],
    ) -> tuple[Place | tuple[float, float, str | None] | None, str | None]:
        """The place of a project, or why it could not be placed."""
        if point is not None:
            lng, lat = point
            if not inside(self.limits, lng, lat):
                return None, "the place is outside Philadelphia"
            return (lng, lat, address), None
        if parcel is None and address is None and not where:
            return None, "where it is was left empty"
        if self.index is None:
            return None, (
                "the City's property list was not in this build, so the place could not be checked"
            )
        if parcel is not None:
            found = places.get(parcel)
            if found is None:
                return None, f"parcel {parcel} is not in the City's property list"
        else:
            if outside_city(address or where):
                return None, "the place is outside Philadelphia"
            found = self.index.address(address or where)
            if found is None:
                return None, (
                    "the address could not be found in the City's property list; ask the reporter "
                    f"for the lot's link, or add the parcel in {CURATED_FILE}"
                )
        if not inside(self.limits, found.lng, found.lat):
            return None, "the place is outside Philadelphia"
        return found, None


def build_projects(
    reports: list[dict[str, Any]],
    curated: CuratedProjects,
    index: ParcelIndex | None,
    *,
    today: date,
    limits: BaseGeometry | None = None,
    repo: str | None = None,
) -> ProjectsBuild:
    """The projects the map shows, from the approved reports (records of `reduce_issue`) and the
    curated hand entries and corrections, each checked as the module docstring says."""
    checker = _Checker(index, limits, today, repo)
    build = checker.build
    build.notes.extend(NOTE_PREFIX + problem for problem in curated.problems)

    # Every parcel number to look up, at once.
    numbers: set[str] = set()
    for record in reports:
        correction = curated.corrections.get(int(record["issue"]))
        if correction and correction.parcel:
            numbers.add(correction.parcel)
        elif not (correction and (correction.address or correction.lat is not None)):
            found = parcel_in(record.get("where"))
            if found:
                numbers.add(found)
    numbers.update(entry.parcel for entry in curated.entries if entry.parcel)
    places = index.parcels(numbers) if index is not None else {}

    seen: dict[tuple[Any, ...], str] = {}
    for record in sorted(reports, key=lambda r: int(r["issue"])):
        issue = int(record["issue"])
        ref = f"issue #{issue}"
        correction = curated.corrections.get(issue) or CuratedProject(issue=issue)
        if correction.suppressed:
            checker.hold(ref, f"{CURATED_FILE} keeps it off the map", needs_owner=False)
            continue
        if not record.get("approved"):
            checker.hold(ref, "it does not carry the approval label", needs_owner=False)
            continue
        if record.get("state") == "CLOSED" and record.get("state_reason") in CLOSED_OFF:
            checker.hold(ref, "it was closed as not planned", needs_owner=False)
            continue
        if record.get("edited_after_approval"):
            checker.hold(
                ref,
                "someone changed it after it was approved; remove the label and add it again to "
                "approve the new text",
            )
            continue
        if not record.get("form"):
            checker.hold(ref, "its answers could not be read as the project form's answers")
            continue
        if not record.get("consent"):
            checker.hold(ref, "the box agreeing to show it on the map is not ticked")
            continue
        kind = correction.kind or FORM_KINDS.get((record.get("kind") or "").strip())
        if kind is None:
            checker.hold(ref, "what was done is not one of the form's answers")
            continue
        if correction.finished:
            year, month = (int(part) for part in correction.finished.split("-"))
        else:
            year, month = _year_of(record.get("year")), _month_of(record.get("month"))
        finished, problem = checker.finished(year, month)
        if finished is None:
            checker.hold(ref, problem or "")
            continue
        point = (
            (correction.lng, correction.lat)
            if correction.lat is not None and correction.lng is not None
            else None
        )
        parcel = correction.parcel
        address = correction.address
        if parcel is None and address is None and point is None:
            parcel = parcel_in(record.get("where"))
        place, problem = checker.locate(parcel, address, point, record.get("where"), places)
        if place is None:
            checker.hold(ref, problem or "")
            continue
        group, removed_group = clean_text(correction.group or record.get("group"), GROUP_MAX)
        note, removed_note = clean_text(correction.what_it_took or record.get("note"), NOTE_MAX)
        removed = (
            removed_group
            | removed_note
            | set(filter(None, (record.get("left_out") or "").split(",")))
        )
        if removed:
            build.notes.append(
                f"{NOTE_PREFIX}{ref}: {removed_words(removed)} left out of what the map shows"
            )
        project = _project(
            f"r{issue}",
            kind,
            finished,
            place,
            issue=issue,
            approved=_approved_day(record.get("approved_at")),
            group=group,
            note=note,
            link=_issue_link(record.get("url"), repo, issue),
        )
        key = (
            project.parcel or (round(project.lng, 5), round(project.lat, 5)),
            kind,
            finished,
            (group or "").lower(),
        )
        if key in seen:
            checker.hold(
                ref,
                f"it repeats {seen[key]} (the same place, kind, month and group), so it is shown "
                "once",
                needs_owner=False,
            )
            continue
        seen[key] = ref
        build.projects.append(project)
        build.outcomes.append(Outcome(ref, True))

    for entry in curated.entries:
        assert entry.id is not None
        ref = f"entry {entry.id}"
        if entry.suppressed:
            checker.hold(ref, f"{CURATED_FILE} keeps it off the map", needs_owner=False)
            continue
        assert entry.kind is not None and entry.finished is not None
        year, month = (int(part) for part in entry.finished.split("-"))
        finished, problem = checker.finished(year, month)
        if finished is None:
            checker.hold(ref, problem or "")
            continue
        point = (entry.lng, entry.lat) if entry.lat is not None and entry.lng is not None else None
        place, problem = checker.locate(entry.parcel, entry.address, point, None, places)
        if place is None:
            checker.hold(ref, problem or "")
            continue
        group, _ = clean_text(entry.group, GROUP_MAX)
        note, _ = clean_text(entry.what_it_took, NOTE_MAX)
        build.projects.append(
            _project(
                entry.id, entry.kind, finished, place, group=group, note=note, link=entry.source
            )
        )
        build.outcomes.append(Outcome(ref, True))

    build.projects.sort(key=lambda p: (p.finished, p.id), reverse=True)
    for outcome in build.held:
        if outcome.needs_owner:
            build.notes.append(
                f"{NOTE_PREFIX}{outcome.ref} is approved but stays off the map: {outcome.reason}"
            )
    shown = len(build.projects)
    problems = sum(o.needs_owner for o in build.held)
    build.notes.insert(
        0,
        f"{NOTE_PREFIX}{shown} on the map"
        + (f", {problems} kept off for a problem named below" if problems else ""),
    )
    return build


def _project(
    project_id: str,
    kind: str,
    finished: str,
    place: Place | tuple[float, float, str | None],
    **extra: Any,
) -> Project:
    if isinstance(place, Place):
        return Project(
            project_id,
            kind,
            finished,
            round(place.lng, 6),
            round(place.lat, 6),
            parcel=place.parcel,
            address=place.address,
            **extra,
        )
    lng, lat, address = place
    return Project(
        project_id, kind, finished, round(lng, 6), round(lat, 6), address=address, **extra
    )


# ---------------------------------------------------------------------------------------------
# Writing


def write_table(build: ProjectsBuild, path: Path, *, generated_at: datetime, as_of: date) -> None:
    """tables/projects.json (docs/CONTRACTS.md section 2): every project the map shows, newest
    first, with the month it was finished and the day it was approved."""
    path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write_json(
        path,
        {
            "schema": 1,
            "generated_at": iso_z(generated_at),
            "as_of": as_of.isoformat(),
            "projects": [project.table_row() for project in build.projects],
        },
    )


def write_geojson(build: ProjectsBuild, path: Path) -> int:
    """The `projects` layer as GeoJSON, one feature per line (as GeoJSONWriter writes)."""
    from placekeepers.geo import GeoJSONWriter

    path.parent.mkdir(parents=True, exist_ok=True)
    with GeoJSONWriter(path) as writer:
        for project in build.projects:
            writer.write(
                project.properties(),
                {"type": "Point", "coordinates": [project.lng, project.lat]},
            )
    return writer.count


def read_reports(path: Path) -> list[dict[str, Any]]:
    """Reports saved by `fetch_reports` (a JSON list), for a run without the network."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ReportsError(f"{path} does not hold a list of reports")
    return data


# The project inputs: what a quick publish needs from the weekly build to place reports, without
# the weekly build's snapshots (.github/workflows/projects.yml).
INPUT_PARCELS = "parcel_index.parquet"
INPUT_LIMITS = "city_limits.geojson"


def write_inputs(folder: Path, opa_path: Path, limits: BaseGeometry | None) -> None:
    """The City's property list cut to parcel numbers, addresses and points, and the city limits.
    Nothing about owners is copied."""
    folder.mkdir(parents=True, exist_ok=True)
    table = read_index_table(opa_path)
    tmp = folder / f".{INPUT_PARCELS}.part"
    pq.write_table(table, tmp, compression="zstd")
    tmp.replace(folder / INPUT_PARCELS)
    target = folder / INPUT_LIMITS
    if limits is None:
        target.unlink(missing_ok=True)
    else:
        target.write_text(shapely.to_geojson(limits), encoding="utf-8")


def read_inputs(folder: Path) -> tuple[ParcelIndex | None, BaseGeometry | None]:
    parcels = folder / INPUT_PARCELS
    limits_path = folder / INPUT_LIMITS
    index = ParcelIndex.from_parquet(parcels) if parcels.is_file() else None
    limits = (
        shapely.from_geojson(limits_path.read_text(encoding="utf-8"))
        if limits_path.is_file()
        else None
    )
    return index, limits
