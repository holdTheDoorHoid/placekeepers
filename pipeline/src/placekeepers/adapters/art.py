"""Public art sources (milestone M3.2): the City's Percent for Art list and Wikidata.

The third source, OpenStreetMap's artworks (`tourism=artwork`), comes from the weekly extract
(`osm_philadelphia`, adapters/osm.py), which keeps them because the registry lists the tag. The
three are matched and merged into one point per work in placekeepers.derive.art.

**Percent for Art** (`percent_for_art`). The City's list of public art made under its Percent for
Art program (OpenDataPhilly "Percent for Art Locations", from the Department of Planning and
Development): murals, sculptures, reliefs, gates, stained glass and more, on public buildings and
on land the City's redevelopment programs sold, many of them inside buildings. Each record is the
parcel the work stands on (a polygon), with its title, artist, year, medium, status (Active,
Inaccessible or In Progress) and where it is in words, and for some a link to a City document about
it. The same list is a Carto table (`percent_for_art_public`); the ArcGIS layer is read because it
says when the City last edited it (`source_date`). Its Street View links and neighborhood names are
not downloaded. Verified against the live service on 2026-10-05: 239 works (224 Active, 10
Inaccessible, 5 In Progress), last edited 2025-08-19. License: the City's open data terms.

**Wikidata** (`wikidata_art`). Artworks Wikidata places in and around Philadelphia: items with a
coordinate (P625) inside a box around the city whose class (P31) is one of a fixed list of kinds of
public art (WIKIDATA_CLASSES in derive/art.py: murals, sculptures, statues, mosaics, monuments,
memorials and similar). A transitive search of every subclass of "work of art" timed out on the
query service, and its results included television seasons and journals; the fixed list answers in
about a second. One query a week, sent with the project's User-Agent as Wikimedia asks. The snapshot
keeps, per item: its English label, classes, the coordinate, the year it was made (P571), its
creators (P170), what it commemorates (P547) and whether that is a person, its English Wikipedia
article, its described at (P973) and official website (P856) links, whether it is gone (P576, or a
state of use such as destroyed), and whether its point lies inside the city limits. Nothing else:
no inscriptions (P1684), no images. Wikidata is CC0, so no credit is required; the map credits it
anyway. Verified on 2026-10-05: 72 items in the box, 69 of them inside the city.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any, ClassVar

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import Adapter, FetchError
from placekeepers.adapters.environment import _edit_day, _with_columns
from placekeepers.adapters.osm import city_limits
from placekeepers.cache import RawFetch
from placekeepers.derive.art import WIKIDATA_CLASSES
from placekeepers.geo import write_geoparquet
from placekeepers.httpclient import RetryableError
from placekeepers.registry import SparqlEndpoint

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------------------------
# Percent for Art


class PercentForArt(ArcgisAdapter):
    """The City's Percent for Art list (module docstring)."""

    out_fields = (
        "objectid",
        "p4a_id",
        "image",
        "status",
        "artist",
        "title",
        "date_",
        "location_name",
        "address",
        "location_note",
        "medium",
    )
    required_columns = ("p4a_id", "status", "title", "artist", "source_date", "geometry")
    # About ten centimeters is plenty for the parcel a work stands on.
    query_params: ClassVar[dict[str, str]] = {"geometryPrecision": "6"}

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        rows = pq.read_metadata(out).num_rows
        day = _edit_day(raw)
        _with_columns(out, {"source_date": pa.array([day] * rows, pa.date32())})
        self.notes.append(f"{rows:,} works, last edited {day.isoformat()}")


# ---------------------------------------------------------------------------------------------
# Wikidata

#: A box around Philadelphia (west, south, east, north), a little wider than the city limits; items
#: are then tested against the limits themselves.
WIKIDATA_BOX = (-75.2803, 39.867, -74.9558, 40.138)
RESULTS_FILE = "results.json"
HUMAN = "Q5"
_ENTITY = re.compile(r"^https?://www\.wikidata\.org/entity/(Q\d+)$")
_POINT = re.compile(r"^Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$", re.IGNORECASE)
_YEAR = re.compile(r"^\+?(\d{3,4})-")
#: A state of use (P5816) meaning the work is no longer there.
_GONE_STATES = re.compile(r"destroyed|demolished|removed|lost|stolen|dismantled", re.IGNORECASE)


def art_query(box: tuple[float, float, float, float] = WIKIDATA_BOX) -> str:
    """The weekly query: every item in the box of one of the art classes, with what the map uses.
    Repeated values (two creators, two classes) come back as more rows; normalize joins them."""
    west, south, east, north = box
    classes = " ".join(f"wd:{qid}" for qid in WIKIDATA_CLASSES)
    return f"""SELECT ?item ?itemLabel ?class ?coord ?inception ?creator ?creatorLabel
       ?commemorates ?ctype ?article ?described ?website ?gone ?state ?stateLabel WHERE {{
  SERVICE wikibase:box {{
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:cornerSouthWest "Point({west} {south})"^^geo:wktLiteral .
    bd:serviceParam wikibase:cornerNorthEast "Point({east} {north})"^^geo:wktLiteral .
  }}
  VALUES ?class {{ {classes} }}
  ?item wdt:P31 ?class .
  OPTIONAL {{ ?item wdt:P571 ?inception }}
  OPTIONAL {{ ?item wdt:P170 ?creator }}
  OPTIONAL {{ ?item wdt:P547 ?commemorates . OPTIONAL {{ ?commemorates wdt:P31 ?ctype }} }}
  OPTIONAL {{ ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }}
  OPTIONAL {{ ?item wdt:P973 ?described }}
  OPTIONAL {{ ?item wdt:P856 ?website }}
  OPTIONAL {{ ?item wdt:P576 ?gone }}
  OPTIONAL {{ ?item wdt:P5816 ?state }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}"""


def check_sparql(data: Any) -> None:
    """A reply without results (an error page sent as JSON) is a failed attempt."""
    if not isinstance(data, dict) or not isinstance(data.get("results"), dict):
        raise RetryableError("The query service did not send query results")
    if not isinstance(data["results"].get("bindings"), list):
        raise RetryableError("The query service sent results without rows")


def entity_id(value: str | None) -> str | None:
    """Q1234 from a Wikidata entity link, or None for anything else."""
    found = _ENTITY.match(value or "")
    return found.group(1) if found else None


def wkt_point(text: str | None) -> tuple[float, float] | None:
    """(longitude, latitude) from a WKT point such as 'Point(-75.17 39.95)'."""
    found = _POINT.match((text or "").strip())
    if not found:
        return None
    lng, lat = float(found.group(1)), float(found.group(2))
    if not (-180 <= lng <= 180 and -90 <= lat <= 90):
        return None
    return lng, lat


def inception_year(text: str | None) -> int | None:
    found = _YEAR.match((text or "").strip())
    return int(found.group(1)) if found else None


def _value(binding: dict[str, Any], name: str) -> str | None:
    cell = binding.get(name)
    if not isinstance(cell, dict):
        return None
    value = cell.get("value")
    return value if isinstance(value, str) and value.strip() else None


def wikidata_items(data: dict[str, Any]) -> list[dict[str, Any]]:
    """One entry per item from the query's rows (which repeat an item for each extra value),
    sorted by item."""
    items: dict[str, dict[str, Any]] = {}
    for binding in data["results"]["bindings"]:
        qid = entity_id(_value(binding, "item"))
        if qid is None:
            continue
        item = items.setdefault(
            qid,
            {
                "qid": qid,
                "labels": set(),
                "classes": set(),
                "coords": set(),
                "years": set(),
                "creators": {},
                "commemorates": set(),
                "commemorated_types": {},
                "articles": set(),
                "urls": set(),
                "gone": False,
            },
        )
        label = _value(binding, "itemLabel")
        if label and label != qid:
            item["labels"].add(label.strip())
        if (cls := entity_id(_value(binding, "class"))) is not None:
            item["classes"].add(cls)
        if (point := wkt_point(_value(binding, "coord"))) is not None:
            item["coords"].add(point)
        if (year := inception_year(_value(binding, "inception"))) is not None:
            item["years"].add(year)
        creator = entity_id(_value(binding, "creator"))
        creator_label = _value(binding, "creatorLabel")
        if creator is not None and creator_label and creator_label != creator:
            item["creators"][creator] = creator_label.strip()
        if (target := entity_id(_value(binding, "commemorates"))) is not None:
            item["commemorates"].add(target)
            kind = entity_id(_value(binding, "ctype"))
            if kind is not None:
                item["commemorated_types"].setdefault(target, set()).add(kind)
        article = _value(binding, "article")
        if article and article.startswith("https://en.wikipedia.org/wiki/"):
            item["articles"].add(article)
        for name in ("described", "website"):
            url = _value(binding, name)
            if url and url.startswith(("https://", "http://")):
                item["urls"].add(url)
        state = _value(binding, "stateLabel")
        if _value(binding, "gone") or (state and _GONE_STATES.search(state)):
            item["gone"] = True
    return [items[qid] for qid in sorted(items, key=lambda q: int(q[1:]))]


class WikidataArt(Adapter):
    """Artworks in Philadelphia from Wikidata's query service (module docstring)."""

    kind = "sparql"
    required_columns = ("qid", "label", "classes", "lat", "lng", "in_city", "geometry")
    depends_on = ("census_tracts_2020",)

    @property
    def endpoint(self) -> SparqlEndpoint:
        assert isinstance(self.source.endpoint, SparqlEndpoint)
        return self.source.endpoint

    def fetch(self, dest: Path) -> dict[str, Any]:
        # Sent as a POST form, the way the query service takes long queries, asking for JSON.
        data = self.ctx.http.get_json(
            self.endpoint.url, {"format": "json"}, data={"query": art_query()}, check=check_sparql
        )
        (dest / RESULTS_FILE).write_text(json.dumps(data), encoding="utf-8")
        items = {entity_id(_value(b, "item")) for b in data["results"]["bindings"]} - {None}
        log.info("%s: %s items in the box around the city", self.id, f"{len(items):,}")
        return {
            "file": RESULTS_FILE,
            "rows": len(items),
            "bindings": len(data["results"]["bindings"]),
        }

    def normalize(self, raw: RawFetch, out: Path) -> None:
        assert raw.dir is not None
        data = json.loads((raw.dir / raw.info["file"]).read_text(encoding="utf-8"))
        check_sparql(data)
        items = wikidata_items(data)
        if not items:
            raise FetchError("The query found no artworks around the city")
        city = city_limits(self.ctx.cache)
        shapely.prepare(city)
        rows: list[dict[str, Any]] = []
        for item in items:
            if not item["coords"]:
                continue
            # An item with two coordinates takes the first inside the city, else the first.
            coords = sorted(item["coords"])
            inside = [c for c in coords if city.contains(shapely.Point(*c))]
            lng, lat = (inside or coords)[0]
            commemorates = sorted(item["commemorates"], key=lambda q: int(q[1:]))
            rows.append(
                {
                    "qid": item["qid"],
                    "label": sorted(item["labels"])[0] if item["labels"] else None,
                    "classes": sorted(item["classes"], key=lambda q: int(q[1:])),
                    "lat": round(lat, 7),
                    "lng": round(lng, 7),
                    "inception": min(item["years"]) if item["years"] else None,
                    "creators": [item["creators"][q] for q in sorted(item["creators"])],
                    "commemorates": commemorates,
                    "commemorates_person": any(
                        HUMAN in item["commemorated_types"].get(q, set()) for q in commemorates
                    ),
                    "enwiki": sorted(item["articles"])[0] if item["articles"] else None,
                    "urls": sorted(item["urls"]),
                    "removed": item["gone"],
                    "in_city": bool(inside),
                    "geometry": shapely.to_wkb(shapely.Point(lng, lat)),
                }
            )
        table = pa.table(
            {
                "qid": pa.array([r["qid"] for r in rows], pa.string()),
                "label": pa.array([r["label"] for r in rows], pa.string()),
                "classes": pa.array([r["classes"] for r in rows], pa.list_(pa.string())),
                "lat": pa.array([r["lat"] for r in rows], pa.float64()),
                "lng": pa.array([r["lng"] for r in rows], pa.float64()),
                "inception": pa.array([r["inception"] for r in rows], pa.int16()),
                "creators": pa.array([r["creators"] for r in rows], pa.list_(pa.string())),
                "commemorates": pa.array([r["commemorates"] for r in rows], pa.list_(pa.string())),
                "commemorates_person": pa.array(
                    [r["commemorates_person"] for r in rows], pa.bool_()
                ),
                "enwiki": pa.array([r["enwiki"] for r in rows], pa.string()),
                "urls": pa.array([r["urls"] for r in rows], pa.list_(pa.string())),
                "removed": pa.array([r["removed"] for r in rows], pa.bool_()),
                "in_city": pa.array([r["in_city"] for r in rows], pa.bool_()),
                "geometry": pa.array([r["geometry"] for r in rows], pa.binary()),
            }
        )
        inside = sum(r["in_city"] for r in rows)
        self.notes.append(
            f"{len(rows):,} artworks in the box around the city, {inside:,} inside the city limits"
        )
        write_geoparquet(table, out, ["Point"])
