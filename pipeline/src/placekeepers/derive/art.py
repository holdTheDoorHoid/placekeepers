"""Public art from three sources, one point per work (milestone M3.2).

The rules behind the `art` layer (docs/CONTRACTS.md section 4), applied to the snapshots of the
City's Percent for Art list (`percent_for_art`), OpenStreetMap's artworks (`tourism=artwork` in
`osm_philadelphia`) and Wikidata's (`wikidata_art`).

**Which works.** The City's works whose status is Active (the Inaccessible ones and those In
Progress are left out and counted); OpenStreetMap's artworks inside the city limits, except one
whose `end_date` has passed; Wikidata's items inside the city limits that are not gone (P576, or
a state of use such as destroyed).

**The same work in two or three sources** becomes one point. Two records from different sources
are the same work when:

* OpenStreetMap's `wikidata` tag names the Wikidata item, within 500 meters; or
* their names agree and they stand at the same place: within 30 meters of each other (for a City
  work, of the parcel it stands on), with at least half the words of the shorter name in the other;
  or
* their names agree closely and they stand near each other: within 150 meters, at least 80
  percent of the words, and two words or more unless the names are the same (Wikidata places some
  statues a street away); or
* one of them has no name, they stand at the same place, and their artists agree; or
* one of them has neither a name nor an artist, the other is a named work of the same kind (a
  mural, a sculpture or a mosaic) within 10 meters, and neither has another candidate from the
  other's source that close (a sculpture garden of unnamed statues stays as it is).

Words are compared without capitals, accents and punctuation, leaving out words such as "the",
"statue", "sculpture", "mural" and "memorial", which sources add or drop ("Statue of Benjamin
Franklin" and "Benjamin Franklin" agree), and two long words count as the same when they differ by a
letter or two ("Oldenberg" and "Oldenburg"). Two works whose sources both name an artist, and no
artist in common, are never the same work. The best pairs join first, and a work holds at most one
record from each source, so the closer of two similar statues takes the match.

**One point, every source.** A merged work stands where OpenStreetMap puts it, else where Wikidata
does, else on its City parcel. Its title comes from the City, then OpenStreetMap, then Wikidata (the
City's "Title Unknown" last); its artist from Wikidata, then OpenStreetMap, then the City; its year
from the City, then Wikidata, then OpenStreetMap; its kind from OpenStreetMap's `artwork_type`, then
Wikidata's class, then the City's medium and title. It links to every source it came from.

**Memorial artworks** (docs/ETHICS.md: names of people killed come only from the hand curated
memorials file, and shooting victims are never named). A work is a memorial when any of its
sources says so: OpenStreetMap tags it `artwork_type=memorial`, `historic=memorial` or any
`memorial` key; Wikidata says what it commemorates (P547) or classes it as a memorial, a war
memorial, a commemorative plaque or a ghost bike; or any name, description or inscription says
"memorial", "in memory", "in memoriam", "rest in peace", "RIP", "commemorates", "died" or "ghost
bike", or a name holds two years like a lifespan ("1990 to 2015"). A memorial is published with
no title, artist, year, medium, place in words, subject, inscription or any link whose address
could hold a name: only that it is a memorial artwork, its kind for the map's filters, and its
links by number (the City's record, the OpenStreetMap element, the Wikidata item). The rule is
cautious on purpose: it also hides the names of famous monuments that OpenStreetMap tags as
memorials, which their sources still show one tap away.
"""

from __future__ import annotations

import json
import logging
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import numpy as np
import pyarrow.parquet as pq
import shapely
from shapely.geometry.base import BaseGeometry

from placekeepers.derive.street_safety import to_meters

log = logging.getLogger(__name__)

# The sources, as the registry names them, and their bits in `src`.
CITY = "percent_for_art"
OSM = "osm_philadelphia"
WIKIDATA = "wikidata_art"
SOURCE_BITS = {CITY: 1, OSM: 2, WIKIDATA: 4}
SOURCES = (CITY, OSM, WIKIDATA)

# Kinds, `k` in the tiles: what the layer's settings show and hide. Codes never change meaning.
OTHER, MURAL, SCULPTURE, MOSAIC = 0, 1, 2, 3

# Kinds of work in words, `ty` in the tiles. Codes never change meaning once published.
TY_OTHER = 0
TY_MURAL = 1
TY_PAINTING = 2
TY_STREET_ART = 3
TY_MOSAIC = 4
TY_SCULPTURE = 5
TY_STATUE = 6
TY_BUST = 7
TY_RELIEF = 8
TY_INSTALLATION = 9
TY_FOUNTAIN = 10
TY_MONUMENT = 11
TY_MEMORIAL = 12
TY_STAINED_GLASS = 13
TY_PLAQUE = 14

KIND_OF_TYPE = {
    TY_OTHER: OTHER,
    TY_MURAL: MURAL,
    TY_PAINTING: MURAL,
    TY_STREET_ART: MURAL,
    TY_MOSAIC: MOSAIC,
    TY_SCULPTURE: SCULPTURE,
    TY_STATUE: SCULPTURE,
    TY_BUST: SCULPTURE,
    TY_RELIEF: SCULPTURE,
    TY_INSTALLATION: OTHER,
    TY_FOUNTAIN: OTHER,
    TY_MONUMENT: OTHER,
    TY_MEMORIAL: OTHER,
    TY_STAINED_GLASS: OTHER,
    TY_PLAQUE: OTHER,
}

#: Wikidata classes (P31) the weekly query asks for, each with its kind. When an item has several,
#: the first listed here decides (a mosaic that is also an assemblage is a mosaic).
WIKIDATA_CLASSES: dict[str, int] = {
    "Q219423": TY_MURAL,  # mural
    "Q99516640": TY_MURAL,  # wall painting
    "Q17516": TY_STREET_ART,  # street art
    "Q17514": TY_STREET_ART,  # graffiti
    "Q133067": TY_MOSAIC,  # mosaic
    "Q245117": TY_RELIEF,  # relief sculpture
    "Q241045": TY_BUST,  # bust
    "Q17489160": TY_BUST,  # bust (a second item of the same name)
    "Q659396": TY_STATUE,  # equestrian statue
    "Q1779653": TY_STATUE,  # colossal statue
    "Q179700": TY_STATUE,  # statue
    "Q860861": TY_SCULPTURE,  # sculpture
    "Q9325291": TY_SCULPTURE,  # outdoor sculpture
    "Q3476533": TY_SCULPTURE,  # monumental sculpture
    "Q107338575": TY_SCULPTURE,  # sculptural set
    "Q20437094": TY_INSTALLATION,  # installation artwork
    "Q326478": TY_INSTALLATION,  # land art
    "Q262343": TY_INSTALLATION,  # assemblage
    "Q721747": TY_PLAQUE,  # commemorative plaque
    "Q170980": TY_MONUMENT,  # obelisk
    "Q143912": TY_MONUMENT,  # triumphal arch
    "Q4989906": TY_MONUMENT,  # monument
    "Q5003624": TY_MEMORIAL,  # memorial
    "Q575759": TY_MEMORIAL,  # war memorial
    "Q937114": TY_MEMORIAL,  # ghost bike
    "Q557141": TY_OTHER,  # public art
    "Q838948": TY_OTHER,  # work of art
}
#: Wikidata classes that make a work a memorial.
WIKIDATA_MEMORIAL_CLASSES = frozenset({"Q5003624", "Q575759", "Q721747", "Q937114"})

#: OpenStreetMap's artwork_type values (https://wiki.openstreetmap.org/wiki/Key:artwork_type).
OSM_TYPES: dict[str, int] = {
    "mural": TY_MURAL,
    "painting": TY_PAINTING,
    "street_art": TY_STREET_ART,
    "graffiti": TY_STREET_ART,
    "mosaic": TY_MOSAIC,
    "sculpture": TY_SCULPTURE,
    "stone": TY_SCULPTURE,
    "totem": TY_SCULPTURE,
    "statue": TY_STATUE,
    "bust": TY_BUST,
    "relief": TY_RELIEF,
    "installation": TY_INSTALLATION,
    "land_art": TY_INSTALLATION,
    "fountain": TY_FOUNTAIN,
    "memorial": TY_MEMORIAL,
    "stained_glass": TY_STAINED_GLASS,
    "plaque": TY_PLAQUE,
    "architecture": TY_OTHER,
    "sundial": TY_OTHER,
}

#: Words in a title that say what kind of work it is, tried in this order.
TITLE_TYPES: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"\bmosaic|\btiled?\s+murals?\b", re.I), TY_MOSAIC),
    (re.compile(r"\bstained\s+glass\b", re.I), TY_STAINED_GLASS),
    (re.compile(r"\bmurals?\b", re.I), TY_MURAL),
    (re.compile(r"\bbusts?\b", re.I), TY_BUST),
    (re.compile(r"\b(bas-?)?reliefs?\b", re.I), TY_RELIEF),
    (re.compile(r"\bstatues?\b", re.I), TY_STATUE),
    (re.compile(r"\bsculpt", re.I), TY_SCULPTURE),
    (re.compile(r"\bfountains?\b", re.I), TY_FOUNTAIN),
    (re.compile(r"\bplaques?\b", re.I), TY_PLAQUE),
    (re.compile(r"\bmonuments?\b", re.I), TY_MONUMENT),
)

#: The City's medium, in its own words, tried in this order after the title.
MEDIUM_TYPES: tuple[tuple[re.Pattern[str], int], ...] = (
    (re.compile(r"mosaic|^\W*tiles?\b|\btiled?\b", re.I), TY_MOSAIC),
    (re.compile(r"\bstained\b", re.I), TY_STAINED_GLASS),
    (re.compile(r"\bmurals?\b", re.I), TY_MURAL),
    (re.compile(r"on canvas|^\W*(oil|acrylic)\b|\boil painting", re.I), TY_PAINTING),
    (re.compile(r"^\W*paint\b", re.I), TY_MURAL),
    (re.compile(r"\b(bas-?)?relief\b", re.I), TY_RELIEF),
    (
        re.compile(
            r"bronze|steel|metal|\biron\b|stone|marble|granite|limestone|alumin|copper|concrete|"
            r"cement|\bwood|sculpt|\bcast\b|brick|fiberglass|resin|ceramic|terra cotta|nickel|"
            r"\blead\b",
            re.I,
        ),
        TY_SCULPTURE,
    ),
)

# ---------------------------------------------------------------------------------------------
# Memorials (docs/ETHICS.md)

#: Words that say a work remembers someone, anywhere in a name, description or inscription.
MEMORIAL_WORDS = re.compile(
    r"\bmemorials?\b|\bmemory\s+of\b|\bin\s+(loving\s+)?memory\b|\bin\s+memoriam\b"
    r"|\brest(ing)?\s+in\s+peace\b|\bcommemorat|\bghost\s+bike\b|\bdied\b|\bpassed\s+away\b",
    re.IGNORECASE,
)
#: RIP in capitals as a word, or with dots in any case ("rip" in small letters is a word).
RIP = re.compile(r"\bRIP\b|\b[Rr]\.\s?[Ii]\.\s?[Pp]\b")
#: Two years like a lifespan ("1990 - 2015", "1990 to 2015"), looked for in names only: in an
#: inscription the same shape is often the years a work was made.
LIFESPAN = re.compile(r"\b(1[6-9]|20)\d\d\s*(?:-|–|—|to)\s*(1[6-9]|20)\d\d\b", re.I)

#: OpenStreetMap keys holding a name, and those holding other words about a work.
OSM_NAME_KEYS = ("name", "alt_name", "official_name", "old_name", "loc_name", "short_name")
OSM_TEXT_KEYS = (*OSM_NAME_KEYS, "description", "inscription", "subject", "artwork_subject", "note")


def says_memorial(text: str | None, *, is_name: bool = False) -> bool:
    """Whether words say the work remembers someone (module docstring)."""
    if not text:
        return False
    if MEMORIAL_WORDS.search(text) or RIP.search(text):
        return True
    return is_name and LIFESPAN.search(text) is not None


def _osm_text_values(tags: Mapping[str, str]) -> Iterable[tuple[str, bool]]:
    """Each value of the tags that hold words, and whether it is a name. Language variants
    (name:es) count; links (inscription:url) do not."""
    for key, value in tags.items():
        base, _, suffix = key.partition(":")
        if base in OSM_TEXT_KEYS and suffix not in ("url", "wikidata", "wikipedia"):
            yield value, base in OSM_NAME_KEYS


def osm_is_memorial(tags: Mapping[str, str]) -> bool:
    if "memorial" in _split(tags.get("artwork_type")):
        return True
    if any(key == "memorial" or key.startswith("memorial:") for key in tags):
        return True
    if "memorial" in _split(tags.get("historic")):
        return True
    return any(says_memorial(value, is_name=name) for value, name in _osm_text_values(tags))


# ---------------------------------------------------------------------------------------------
# Words


_SPACED_DASH = re.compile(r"\s+[-\u2013\u2014]+\s+")
_LONE_DASH = re.compile(r"[\u2013\u2014]+")
_YEAR_IN_TEXT = re.compile(r"\b(1[6-9]\d\d|20\d\d)\b")


def clean_text(value: object) -> str | None:
    """Text as a source writes it, tidied for the map: one space between words, doubled quotes
    made single, and a dash used as punctuation turned into a comma (house style, as
    publish.layers.plain_name does for other names). None for empty text."""
    if not isinstance(value, str):
        return None
    text = " ".join(value.replace('""', '"').split())
    text = _LONE_DASH.sub(", ", _SPACED_DASH.sub(", ", text))
    text = re.sub(r"\s+,", ",", text).strip(" ,")
    return text or None


#: Titles and artists that hold no name ("TBD", "Artist Unknown").
_PLACEHOLDER = re.compile(
    r"^(tbd|n/?a|none|unknown|untitled unknown|title unknown|artist unknown|unknown artist|"
    r"material unknown|medium unknown|<null>)\.?$",
    re.IGNORECASE,
)


def is_placeholder(text: str | None) -> bool:
    """No real name: empty, a placeholder word, or a note in capitals asking a question (the
    City's "GALLERY, MULTIPLE ARTISTS, INPUT INDIVIDUALLY?")."""
    if text is None or not text.strip():
        return True
    return bool(_PLACEHOLDER.match(text.strip())) or ("?" in text and text.isupper())


def _split(value: str | None) -> list[str]:
    return [part.strip().lower() for part in (value or "").split(";") if part.strip()]


def year_of(value: object, as_of: date) -> int | None:
    """The first year in a date or text, from 1600 to next year."""
    if isinstance(value, int):
        year = value
    else:
        found = _YEAR_IN_TEXT.search(str(value or ""))
        if not found:
            return None
        year = int(found.group(1))
    return year if 1600 <= year <= as_of.year + 1 else None


def type_from_words(*texts: str | None, table: Sequence[tuple[re.Pattern[str], int]]) -> int:
    for pattern, kind in table:
        if any(text and pattern.search(text) for text in texts):
            return kind
    return TY_OTHER


#: "Last, First": letters, with spaces, apostrophes, periods and hyphens inside each part.
_LAST_FIRST = re.compile(r"([^\W\d_](?:[^\W\d_]|['.\- ])*?)\s*,\s*([^\W\d_](?:[^\W\d_]|['.\- ])*)")


def city_artist(value: object) -> str | None:
    """The City's artist, "Kimmelman, Harold", as "Harold Kimmelman". Several artists, a
    company or anything else is kept as the City writes it."""
    text = clean_text(value)
    if text is None or is_placeholder(text):
        return None
    if re.search(r"\b(and|with)\b|&", text, re.IGNORECASE):
        return text
    found = _LAST_FIRST.fullmatch(text)
    return f"{found.group(2)} {found.group(1)}" if found else text


def https_url(value: object) -> str | None:
    text = str(value or "").strip()
    if not re.match(r"^https?://[^\s/]+\.[^\s/]+\S*$", text) or len(text) > 300:
        return None
    return text


#: Websites a work already links to in another way.
_LINKED_HOSTS = ("wikipedia.org", "wikidata.org", "openstreetmap.org")


def website_of(urls: Iterable[object]) -> str | None:
    """The first web page about the work that is not Wikipedia, Wikidata or OpenStreetMap."""
    for value in urls:
        url = https_url(value)
        host = urlparse(url).netloc.lower() if url else ""
        if url and not any(host == h or host.endswith("." + h) for h in _LINKED_HOSTS):
            return url
    return None


def wikipedia_url(tag: str | None) -> str | None:
    """An English Wikipedia link from OpenStreetMap's wikipedia tag ("en:Aero Memorial")."""
    if not tag or not tag.startswith("en:"):
        return None
    title = tag[3:].strip().replace(" ", "_")
    return f"https://en.wikipedia.org/wiki/{quote(title, safe='_(),')}" if title else None


# ---------------------------------------------------------------------------------------------
# Names, for matching


#: Words left out when comparing names: they say what a work is, not which one it is.
STOP_WORDS = frozenset(
    {
        "the",
        "a",
        "an",
        "of",
        "and",
        "to",
        "in",
        "on",
        "at",
        "for",
        "by",
        "with",
        "statue",
        "statues",
        "sculpture",
        "sculptures",
        "mural",
        "murals",
        "bust",
        "monument",
        "memorial",
        "equestrian",
        "fountain",
        "relief",
        "reliefs",
        "title",
        "unknown",
        "untitled",
        "general",
        "major",
        "gen",
        "dr",
        "reverend",
        "rev",
        "saint",
        "st",
        "mr",
        "mrs",
        "no",
        "number",
    }
)


def words(text: str | None) -> list[str]:
    if not text:
        return []
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    plain = re.sub(r"[^a-z0-9]+", " ", plain.replace("&", " and "))
    return [w for w in plain.split() if w not in STOP_WORDS]


def _same_word(a: str, b: str) -> bool:
    if a == b:
        return True
    return min(len(a), len(b)) >= 5 and SequenceMatcher(None, a, b).ratio() >= 0.85


def word_overlap(a: Sequence[str], b: Sequence[str]) -> float:
    """The share of the shorter list's words found in the other list, from 0 to 1."""
    if not a or not b:
        return 0.0
    short, long = (a, b) if len(a) <= len(b) else (b, a)
    found = sum(1 for w in short if any(_same_word(w, other) for other in long))
    return found / len(short)


# ---------------------------------------------------------------------------------------------
# Records


@dataclass
class ArtRecord:
    """One work as one source has it."""

    source: str
    #: its id: "pa" and the City's number, "n" or "w" and the OpenStreetMap element, or a Q id
    key: str
    lng: float
    lat: float
    #: the City's parcel, in longitude and latitude (other sources have a point only)
    shape: BaseGeometry | None = None
    title: str | None = None
    #: the City's "Title Unknown (...)": a title only when no other source has one
    weak_title: bool = False
    #: every name to compare (the title and any other names), never published as such
    names: tuple[str, ...] = ()
    artist: str | None = None
    year: int | None = None
    ty: int = TY_OTHER
    memorial: bool = False
    medium: str | None = None
    location: str | None = None
    inside: bool = False
    website: str | None = None
    wikipedia: str | None = None
    #: the City's document about the work
    doc: str | None = None
    #: OpenStreetMap's wikidata tag, to find the same work in Wikidata (never published)
    wikidata_ref: str | None = None
    #: the City's record number
    city_id: int | None = None


_INSIDE = re.compile(r"\binterior|\binside\b|\blobby\b|\bindoors?\b", re.IGNORECASE)
_EXTERIOR = re.compile(r"\bexterior\b", re.IGNORECASE)
_TITLE_UNKNOWN = re.compile(r"^title\s+unknown\b\s*", re.IGNORECASE)


def city_records(rows: Iterable[Mapping[str, Any]], as_of: date) -> tuple[list[ArtRecord], Counter]:
    """The City's works with status Active, and how many of each other status were left out."""
    records: list[ArtRecord] = []
    left_out: Counter = Counter()
    for row in rows:
        status = clean_text(row.get("status")) or "No status"
        wkb = row.get("geometry")
        number = row.get("p4a_id")
        if status.lower() != "active":
            left_out[status] += 1
            continue
        if wkb is None or number is None:
            left_out["no place or number"] += 1
            continue
        shape = shapely.from_wkb(wkb)
        if shape.is_empty:
            left_out["no place or number"] += 1
            continue
        if not shape.is_valid:
            shape = shapely.make_valid(shape)
        point = shape.point_on_surface()
        raw_title = clean_text(row.get("title"))
        title, weak, names = raw_title, False, (raw_title,) if raw_title else ()
        if raw_title and _TITLE_UNKNOWN.match(raw_title):
            # "Title Unknown (three bas-reliefs)": the words in brackets still say which work.
            rest = _TITLE_UNKNOWN.sub("", raw_title).strip(" ,")
            title = f"Title unknown {rest}" if rest else None
            weak, names = True, (rest,) if rest else ()
        elif is_placeholder(raw_title):
            title, names = None, ()
        medium = clean_text(row.get("medium"))
        if is_placeholder(medium):
            medium = None
        where = " ".join(
            t
            for t in (clean_text(row.get("location_name")), clean_text(row.get("location_note")))
            if t
        )
        location = clean_text(row.get("location_name"))
        if location is not None and is_placeholder(location):
            location = None
        ty = type_from_words(raw_title, table=TITLE_TYPES)
        if ty == TY_OTHER:
            ty = type_from_words(medium, table=MEDIUM_TYPES)
        records.append(
            ArtRecord(
                source=CITY,
                key=f"pa{int(number)}",
                lng=point.x,
                lat=point.y,
                shape=shape,
                title=title,
                weak_title=weak,
                names=names,
                artist=city_artist(row.get("artist")),
                year=year_of(row.get("date_"), as_of),
                ty=ty,
                memorial=says_memorial(raw_title, is_name=True) or says_memorial(medium),
                medium=medium,
                location=location,
                inside=bool(_INSIDE.search(where)) and not _EXTERIOR.search(where),
                doc=https_url(row.get("image")),
                city_id=int(number),
            )
        )
    return records, left_out


def osm_records(rows: Iterable[Mapping[str, Any]], as_of: date) -> tuple[list[ArtRecord], int]:
    """OpenStreetMap's artworks inside the city, and how many were left out because their
    `end_date` has passed."""
    records: list[ArtRecord] = []
    ended = 0
    for row in rows:
        tags = row.get("tags")
        if isinstance(tags, str):
            tags = json.loads(tags or "{}")
        if not isinstance(tags, dict) or tags.get("tourism") != "artwork":
            continue
        if not row.get("in_city"):
            continue
        end = str(tags.get("end_date") or "").strip()
        if re.match(r"^\d{4}", end) and end[:10] < as_of.isoformat():
            ended += 1
            continue
        name = clean_text(tags.get("name"))
        types = [OSM_TYPES[t] for t in _split(tags.get("artwork_type")) if t in OSM_TYPES]
        if types:
            ty = types[0]
        elif tags.get("amenity") == "fountain":
            ty = TY_FOUNTAIN
        else:
            ty = type_from_words(name, table=TITLE_TYPES)
        other_names = [clean_text(tags.get(k)) for k in OSM_NAME_KEYS[1:]]
        artist = clean_text(tags.get("artist_name") or tags.get("artist:name"))
        if artist:
            artist = ", ".join(part.strip() for part in artist.split(";") if part.strip())
        material = clean_text((tags.get("material") or "").replace("_", " ").replace(";", ", "))
        prefix = "n" if row.get("osm_type") == "node" else "w"
        records.append(
            ArtRecord(
                source=OSM,
                key=f"{prefix}{int(row['osm_id'])}",
                lng=float(row["lng"]),
                lat=float(row["lat"]),
                title=name,
                names=tuple(n for n in (name, *other_names) if n),
                artist=artist or None,
                year=year_of(tags.get("start_date"), as_of),
                ty=ty,
                memorial=osm_is_memorial(tags),
                medium=material[:1].upper() + material[1:] if material else None,
                website=website_of(tags.get(k) for k in ("website", "url", "contact:website")),
                wikipedia=wikipedia_url(tags.get("wikipedia")),
                wikidata_ref=(tags.get("wikidata") or "").strip() or None,
            )
        )
    return records, ended


def wikidata_records(rows: Iterable[Mapping[str, Any]], as_of: date) -> tuple[list[ArtRecord], int]:
    """Wikidata's artworks inside the city, and how many were left out as gone."""
    records: list[ArtRecord] = []
    gone = 0
    for row in rows:
        if not row.get("in_city"):
            continue
        if row.get("removed"):
            gone += 1
            continue
        classes = list(row.get("classes") or [])
        ty = next((WIKIDATA_CLASSES[q] for q in WIKIDATA_CLASSES if q in classes), TY_OTHER)
        label = clean_text(row.get("label"))
        creators = [c for c in (clean_text(c) for c in row.get("creators") or []) if c]
        memorial = (
            bool(row.get("commemorates"))
            or bool(WIKIDATA_MEMORIAL_CLASSES & set(classes))
            or says_memorial(label, is_name=True)
        )
        records.append(
            ArtRecord(
                source=WIKIDATA,
                key=str(row["qid"]),
                lng=float(row["lng"]),
                lat=float(row["lat"]),
                title=label,
                names=(label,) if label else (),
                artist=", ".join(creators) or None,
                year=year_of(row.get("inception"), as_of),
                ty=ty,
                memorial=memorial,
                website=website_of(row.get("urls") or []),
                wikipedia=https_url(row.get("enwiki")),
            )
        )
    return records, gone


# ---------------------------------------------------------------------------------------------
# Matching

#: OpenStreetMap's wikidata tag is believed within this distance of the item.
EXACT_METERS = 500.0
#: The same place: points this close, or a point this close to the City's parcel.
SAME_PLACE_METERS = 30.0
#: Near enough for names that agree closely.
NEAR_METERS = 150.0
#: A work with no name and no artist is the same as a named one of the same kind only this close,
#: and only when neither has another candidate from the other's source this close.
UNNAMED_METERS = 10.0
#: Such a pair joins after every pair that agrees by name.
UNNAMED_SCORE = 0.05


def name_overlap(a: ArtRecord, b: ArtRecord) -> float:
    best = 0.0
    for x in a.names:
        for y in b.names:
            best = max(best, word_overlap(words(x), words(y)))
    return best


def _strong_names(a: ArtRecord, b: ArtRecord) -> bool:
    """Names that agree closely and say enough: two words or more, or the very same words."""
    for x in a.names:
        for y in b.names:
            wx, wy = words(x), words(y)
            if word_overlap(wx, wy) >= 0.8 and (min(len(wx), len(wy)) >= 2 or wx == wy):
                return True
    return False


def pair_score(a: ArtRecord, b: ArtRecord, meters: float) -> float | None:
    """How well two records from different sources agree, or None when they are not the same
    work (module docstring). Higher is better."""
    for x, y in ((a, b), (b, a)):
        if x.source == OSM and y.source == WIKIDATA and x.wikidata_ref == y.key:
            return 10.0 - meters / 1000 if meters <= EXACT_METERS else None
    artists = word_overlap(words(a.artist), words(b.artist))
    if a.artist and b.artist and artists == 0:
        return None
    names = name_overlap(a, b)
    same_place = meters <= SAME_PLACE_METERS
    by_name = same_place and names >= 0.5
    by_close_name = meters <= NEAR_METERS and names >= 0.8 and _strong_names(a, b)
    by_artist = same_place and (not a.names or not b.names) and artists >= 0.8
    if not (by_name or by_close_name or by_artist):
        return None
    return names + 0.5 * artists - meters / NEAR_METERS


@dataclass
class ArtWork:
    """One work on the map: the records of one to three sources that describe it."""

    records: list[ArtRecord] = field(default_factory=list)

    def of(self, source: str) -> ArtRecord | None:
        return next((r for r in self.records if r.source == source), None)

    def first(self, attr: str, order: Sequence[str]) -> Any:
        for source in order:
            record = self.of(source)
            value = getattr(record, attr) if record else None
            if value not in (None, "", False):
                return value
        return None

    @property
    def id(self) -> str:
        """Stable as long as its sources keep their ids: the City's number first, then the
        Wikidata item, then the OpenStreetMap element."""
        return self.first("key", (CITY, WIKIDATA, OSM))

    @property
    def point(self) -> tuple[float, float]:
        record = self.of(OSM) or self.of(WIKIDATA) or self.of(CITY)
        assert record is not None
        return record.lng, record.lat

    @property
    def memorial(self) -> bool:
        return any(r.memorial for r in self.records)

    @property
    def title(self) -> str | None:
        city = self.of(CITY)
        if city and city.title and not city.weak_title:
            return city.title
        return self.first("title", (OSM, WIKIDATA, CITY))

    @property
    def ty(self) -> int:
        for source in (OSM, WIKIDATA, CITY):
            record = self.of(source)
            if record and record.ty != TY_OTHER:
                return record.ty
        return TY_OTHER

    @property
    def src(self) -> int:
        bits = 0
        for record in self.records:
            bits |= SOURCE_BITS[record.source]
        return bits

    def properties(self) -> dict[str, Any]:
        """The tile properties (docs/CONTRACTS.md section 4). A memorial carries no words that
        could name the person it remembers, only its links by number."""
        city, osm, wikidata = self.of(CITY), self.of(OSM), self.of(WIKIDATA)
        ty = self.ty
        props: dict[str, Any] = {"id": self.id, "k": KIND_OF_TYPE[ty], "src": self.src}
        if self.memorial:
            props["mem"] = 1
        else:
            props["ty"] = ty
            for key, value in (
                ("nm", self.title),
                ("ar", self.first("artist", (WIKIDATA, OSM, CITY))),
                ("y", self.first("year", (CITY, WIKIDATA, OSM))),
                ("md", self.first("medium", (CITY, OSM))),
                ("lc", city.location if city else None),
            ):
                if value is not None:
                    props[key] = value
            if city and city.inside:
                props["in"] = 1
        if city:
            props["pa"] = city.city_id
            if city.doc:
                props["doc"] = city.doc
        if osm:
            props["osm"] = osm.key
        if wikidata:
            props["wd"] = wikidata.key
        if not self.memorial:
            wikipedia = self.first("wikipedia", (WIKIDATA, OSM))
            website = self.first("website", (OSM, WIKIDATA))
            if wikipedia:
                props["wp"] = wikipedia
            if website:
                props["w"] = website
        return props


def _anonymous(record: ArtRecord) -> bool:
    return not record.names and not record.artist


def unnamed_pairs(
    records: Sequence[ArtRecord], close: Sequence[Mapping[str, list[int]]]
) -> list[tuple[int, int]]:
    """A work with no name and no artist and a named work of the same kind (a mural, a sculpture,
    a mosaic) from another source, within UNNAMED_METERS of each other, when each is the other's
    only candidate: the only record of that source this close to the unnamed one, and the only
    unnamed one this close to the named one. Anything less certain stays two points."""
    found: list[tuple[int, int]] = []
    for i, record in enumerate(records):
        if not _anonymous(record) or KIND_OF_TYPE[record.ty] == OTHER:
            continue
        for others in close[i].values():
            if len(others) != 1:
                continue
            j = others[0]
            other = records[j]
            if not other.names or KIND_OF_TYPE[other.ty] != KIND_OF_TYPE[record.ty]:
                continue
            rivals = [k for k in close[j].get(record.source, []) if _anonymous(records[k])]
            if rivals == [i]:
                found.append((i, j) if i < j else (j, i))
    return found


def match_records(records: Sequence[ArtRecord]) -> list[ArtWork]:
    """Group the records into works (module docstring), sorted by id."""
    if not records:
        return []
    # Each record's place in meters: the City's parcel, or the point the source gives.
    places = to_meters(
        np.array(
            [r.shape if r.shape is not None else shapely.Point(r.lng, r.lat) for r in records],
            dtype=object,
        )
    )
    tree = shapely.STRtree(places)
    pairs: list[tuple[float, str, str, int, int]] = []
    seen: set[tuple[int, int]] = set()
    reach = max(EXACT_METERS, NEAR_METERS)
    #: for each record, the records of each other source within UNNAMED_METERS
    close: list[dict[str, list[int]]] = [{} for _ in records]
    for i in range(len(records)):
        for j in tree.query(places[i], predicate="dwithin", distance=reach).tolist():
            a, b = (i, j) if i < j else (j, i)
            if a == b or (a, b) in seen or records[a].source == records[b].source:
                continue
            seen.add((a, b))
            # A City work is as near as its parcel; two points, as near as each other.
            meters = float(shapely.distance(places[a], places[b]))
            if meters <= UNNAMED_METERS:
                close[a].setdefault(records[b].source, []).append(b)
                close[b].setdefault(records[a].source, []).append(a)
            score = pair_score(records[a], records[b], meters)
            if score is not None:
                pairs.append((-score, records[a].key, records[b].key, a, b))
    for a, b in unnamed_pairs(records, close):
        pairs.append((-UNNAMED_SCORE, records[a].key, records[b].key, a, b))
    pairs.sort()
    parent = list(range(len(records)))
    sources: dict[int, set[str]] = {i: {r.source} for i, r in enumerate(records)}

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for _, _, _, a, b in pairs:
        ra, rb = root(a), root(b)
        if ra == rb or sources[ra] & sources[rb]:
            continue
        parent[rb] = ra
        sources[ra] |= sources.pop(rb)
    groups: dict[int, list[ArtRecord]] = {}
    for i, record in enumerate(records):
        groups.setdefault(root(i), []).append(record)
    works = [
        ArtWork(sorted(group, key=lambda r: SOURCES.index(r.source))) for group in groups.values()
    ]
    return sorted(works, key=lambda w: w.id)


# ---------------------------------------------------------------------------------------------
# Reading the snapshots

CITY_COLUMNS = [
    "p4a_id",
    "image",
    "status",
    "artist",
    "title",
    "date_",
    "location_name",
    "location_note",
    "medium",
    "geometry",
]
OSM_COLUMNS = ["osm_type", "osm_id", "tags", "lat", "lng", "in_city"]
WIKIDATA_COLUMNS = [
    "qid",
    "label",
    "classes",
    "lat",
    "lng",
    "inception",
    "creators",
    "commemorates",
    "enwiki",
    "urls",
    "removed",
    "in_city",
]


def _read(path: Path, columns: list[str]) -> list[dict[str, Any]]:
    present = set(pq.read_schema(path).names)
    return pq.read_table(path, columns=[c for c in columns if c in present]).to_pylist()


@dataclass
class ArtResult:
    works: list[ArtWork]
    counts: dict[str, int]
    notes: list[str]


def load_and_match(paths: Mapping[str, Path], as_of: date) -> ArtResult:
    """Read whichever of the three sources has a snapshot, and merge their works."""
    records: list[ArtRecord] = []
    counts: dict[str, int] = {}
    notes: list[str] = []
    if CITY in paths:
        found, left_out = city_records(_read(paths[CITY], CITY_COLUMNS), as_of)
        records += found
        counts[CITY] = len(found)
        if left_out:
            parts = ", ".join(f"{n:,} {status}" for status, n in sorted(left_out.items()))
            notes.append(f"Percent for Art works left out: {parts}")
    if OSM in paths:
        found, ended = osm_records(_read(paths[OSM], OSM_COLUMNS), as_of)
        records += found
        counts[OSM] = len(found)
        if ended:
            notes.append(f"{ended:,} OpenStreetMap artworks left out because they have ended")
        if not found:
            notes.append(
                "The OpenStreetMap snapshot has no artworks yet; they arrive with the next weekly "
                "download of the extract"
            )
    if WIKIDATA in paths:
        found, gone = wikidata_records(_read(paths[WIKIDATA], WIKIDATA_COLUMNS), as_of)
        records += found
        counts[WIKIDATA] = len(found)
        if gone:
            notes.append(f"{gone:,} Wikidata artworks left out because Wikidata says they are gone")
    works = match_records(records)
    notes.insert(0, summary_note(works, counts))
    return ArtResult(works, counts, notes)


def summary_note(works: Sequence[ArtWork], counts: Mapping[str, int]) -> str:
    """One sentence with the counts of each source, of the works merged and of memorials. Never a
    name."""
    by_sources = Counter(len(w.records) for w in works)
    memorials = sum(1 for w in works if w.memorial)
    merged = sum(n for size, n in by_sources.items() if size > 1)
    parts = [
        f"{counts.get(CITY, 0):,} from the City's Percent for Art list",
        f"{counts.get(OSM, 0):,} from OpenStreetMap",
        f"{counts.get(WIKIDATA, 0):,} from Wikidata",
    ]
    return (
        f"Public art: {', '.join(parts)}; {merged:,} works are in more than one source "
        f"({by_sources.get(2, 0):,} in two, {by_sources.get(3, 0):,} in all three), so the map "
        f"shows {len(works):,} works, {memorials:,} of them memorial artworks shown without names"
    )
