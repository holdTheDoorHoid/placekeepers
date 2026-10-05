"""Public art (M3.2): the Percent for Art and Wikidata adapters, the memorial rule, the matcher
that merges a work found in two or three sources, and the art layer.

No network: the services are fakes, snapshots are tiny Parquet files, and places are a few
meters apart near City Hall. Every name in the memorial fixtures is invented.
"""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs

import httpx
import pyarrow as pa
import pytest
import shapely
from shapely.geometry import box

from placekeepers.adapters import ADAPTERS
from placekeepers.adapters.art import (
    HUMAN,
    PercentForArt,
    WikidataArt,
    art_query,
    check_sparql,
    inception_year,
    wikidata_items,
    wkt_point,
)
from placekeepers.derive import art
from placekeepers.derive.art import (
    CITY,
    KIND_OF_TYPE,
    MOSAIC,
    MURAL,
    OSM,
    OTHER,
    SCULPTURE,
    TY_INSTALLATION,
    TY_MOSAIC,
    TY_MURAL,
    TY_PAINTING,
    TY_RELIEF,
    TY_SCULPTURE,
    TY_STAINED_GLASS,
    TY_STATUE,
    WIKIDATA,
    WIKIDATA_CLASSES,
    ArtRecord,
    city_artist,
    city_records,
    match_records,
    osm_is_memorial,
    osm_records,
    says_memorial,
    wikidata_records,
)
from placekeepers.geo import write_geoparquet
from placekeepers.httpclient import RetryableError
from placekeepers.publish import publish
from placekeepers.publish.art import build_art
from placekeepers.runner import fetch_source, validate_source
from placekeepers.snapshots import SnapshotStore

from .conftest import install_snapshot
from .test_osm import install_city

AS_OF = date(2026, 10, 5)
#: A point near City Hall, inside the test city of tests/test_osm.py.
BASE_LAT, BASE_LNG = 39.955, -75.162


def at(east: float, north: float) -> tuple[float, float]:
    """(longitude, latitude) of a point some meters east and north of the base point."""
    lat = BASE_LAT + north / 111_320
    lng = BASE_LNG + east / (111_320 * math.cos(math.radians(BASE_LAT)))
    return lng, lat


def parcel(east: float, north: float, size: float = 20.0):
    """A square parcel, in longitude and latitude, with its corner at the point given."""
    west, south = at(east, north)
    east_lng, north_lat = at(east + size, north + size)
    return box(west, south, east_lng, north_lat)


def record(source: str, key: str, east: float, north: float, title=None, **kw) -> ArtRecord:
    lng, lat = at(east, north)
    kw.setdefault("ty", TY_SCULPTURE)
    names = kw.pop("names", (title,) if title else ())
    return ArtRecord(source=source, key=key, lng=lng, lat=lat, title=title, names=names, **kw)


def city(key: str, east: float, north: float, title=None, **kw) -> ArtRecord:
    shape = parcel(east, north, kw.pop("size", 20.0))
    point = shape.point_on_surface()
    names = kw.pop("names", (title,) if title else ())
    kw.setdefault("ty", TY_SCULPTURE)
    return ArtRecord(
        source=CITY,
        key=key,
        lng=point.x,
        lat=point.y,
        shape=shape,
        title=title,
        names=names,
        city_id=int(key[2:]),
        **kw,
    )


def keys(works) -> list[list[str]]:
    return sorted(sorted(r.key for r in w.records) for w in works)


# ---------------------------------------------------------------------------------------------
# Matching one work across sources


def test_openstreetmaps_wikidata_tag_finds_the_item_even_a_block_away() -> None:
    osm = record(OSM, "n1", 0, 0, "Rocky Statue", wikidata_ref="Q20379990")
    near = record(WIKIDATA, "Q20379990", 90, 0, "Rocky Statue")
    assert keys(match_records([osm, near])) == [["Q20379990", "n1"]]
    far = record(WIKIDATA, "Q20379990", 600, 0, "Rocky")
    assert keys(match_records([osm, far])) == [["Q20379990"], ["n1"]]


def test_a_work_on_a_city_parcel_matches_by_name_and_place() -> None:
    works = match_records(
        [
            city("pa62", 0, 0, "Mary Dyer", artist="Sylvia Shaw Judson"),
            record(OSM, "n5", 15, 12, "Mary Dyer Statue", artist="Sylvia Shaw Judson"),
        ]
    )
    assert len(works) == 1
    work = works[0]
    assert work.id == "pa62"
    assert work.title == "Mary Dyer"
    # The point is where OpenStreetMap puts it, not the middle of the City's parcel.
    assert work.point == at(15, 12)


def test_different_names_at_the_same_place_stay_two_works() -> None:
    works = match_records(
        [
            city("pa261", 0, 0, "Alexander Mackie (bust)"),
            record(OSM, "n6", 5, 5, "Calder Statues"),
        ]
    )
    assert len(works) == 2


def test_names_that_agree_closely_match_a_block_apart_but_two_artists_never_do() -> None:
    whitman = [
        record(OSM, "n2990140634", 0, 0, "Walt Whitman", artist="Jo Davidson"),
        record(WIKIDATA, "Q48742750", 0, 118, "Walt Whitman", artist="Jo Davidson"),
    ]
    assert len(match_records(whitman)) == 1
    franklins = [
        record(OSM, "n7", 0, 0, "Benjamin Franklin (on a bench)", artist="George Lundeen"),
        record(WIKIDATA, "Q4888606", 20, 0, "Statue of Benjamin Franklin", artist="John J. Boyle"),
    ]
    assert len(match_records(franklins)) == 2


def test_a_one_word_name_a_block_away_must_be_the_same_word() -> None:
    same = [record(OSM, "n1", 0, 0, "Iroquois"), record(WIKIDATA, "Q6073420", 100, 0, "Iroquois")]
    assert len(match_records(same)) == 1
    longer = [record(OSM, "n1", 0, 0, "Deer"), record(WIKIDATA, "Q9", 100, 0, "Deer Park Gate")]
    assert len(match_records(longer)) == 2
    # At the same place, half the words of the shorter name are enough.
    close = [record(OSM, "n1", 0, 0, "Deer"), record(WIKIDATA, "Q9", 10, 0, "Deer Park Gate")]
    assert len(match_records(close)) == 1


def test_a_work_holds_one_record_from_each_source_and_the_closer_one_wins() -> None:
    works = match_records(
        [
            record(OSM, "n666546019", 0, 3, "Rocky Statue", wikidata_ref="Q20379990"),
            record(OSM, "n13689628369", 0, 90, "Rocky Statue", wikidata_ref="Q20379990"),
            record(WIKIDATA, "Q20379990", 0, 0, "Rocky Statue"),
        ]
    )
    assert keys(works) == [["Q20379990", "n666546019"], ["n13689628369"]]


def test_the_same_work_in_all_three_sources_becomes_one_point_with_every_link() -> None:
    works = match_records(
        [
            city(
                "pa224",
                0,
                0,
                "Clothespin",
                artist="Oldenberg, Claes Thure",
                year=1976,
                doc="https://dpd-art-is-essential-docs.s3.amazonaws.com/224.pdf",
                medium="Metal, weathering steel",
            ),
            record(
                OSM,
                "n666320453",
                8,
                8,
                "Clothespin",
                artist="Claes Oldenburg",
                wikidata_ref="Q5135560",
                website="https://www.associationforpublicart.org/artwork/clothespin/",
            ),
            record(
                WIKIDATA,
                "Q5135560",
                9,
                10,
                "Clothespin",
                artist="Claes Oldenburg",
                year=1976,
                wikipedia="https://en.wikipedia.org/wiki/Clothespin_(Oldenburg)",
            ),
        ]
    )
    assert len(works) == 1
    props = works[0].properties()
    assert props == {
        "id": "pa224",
        "k": SCULPTURE,
        "src": 7,
        "ty": TY_SCULPTURE,
        "nm": "Clothespin",
        "ar": "Claes Oldenburg",
        "y": 1976,
        "md": "Metal, weathering steel",
        "pa": 224,
        "doc": "https://dpd-art-is-essential-docs.s3.amazonaws.com/224.pdf",
        "osm": "n666320453",
        "wd": "Q5135560",
        "wp": "https://en.wikipedia.org/wiki/Clothespin_(Oldenburg)",
        "w": "https://www.associationforpublicart.org/artwork/clothespin/",
    }


def test_an_untitled_work_joins_a_named_one_by_its_artist_at_the_same_place() -> None:
    works = match_records(
        [
            city("pa1", 0, 0, "The Journeyer", artist="Lindsay Daen"),
            record(OSM, "n9", 25, 25, None, artist="Lindsay Daen"),
        ]
    )
    assert len(works) == 1
    assert works[0].title == "The Journeyer"


def test_an_unnamed_work_joins_the_only_named_work_of_its_kind_beside_it() -> None:
    plug = record(WIKIDATA, "Q25931613", 0, 0, "Giant Three-Way Plug", artist="Claes Oldenburg")
    beside = record(OSM, "n12849410259", 2, 0)
    assert len(match_records([plug, beside])) == 1
    # Two unnamed statues beside it: either could be the one, so neither joins.
    other = record(OSM, "n12849410258", 0, 4)
    assert len(match_records([plug, beside, other])) == 3
    # An unnamed mural beside a named sculpture is another work.
    mural = record(OSM, "n5", 2, 0, ty=TY_MURAL)
    assert len(match_records([plug, mural])) == 2
    # And a parcel holding two City works gives an unnamed point no single candidate.
    garden = [
        city("pa226", 0, 0, "Title unknown (fountain)", size=40),
        city("pa227", 0, 0, "Old Man, Young Man, The Future", size=40),
        record(OSM, "n5723276200", 20, 20),
    ]
    assert len(match_records(garden)) == 3


def test_words_are_compared_without_the_words_sources_add() -> None:
    assert (
        art.word_overlap(art.words("Statue of George Washington"), art.words("George Washington"))
        == 1
    )
    assert art.word_overlap(art.words("Oldenberg, Claes"), art.words("Claes Oldenburg")) == 1
    assert art.word_overlap(art.words("Aero Memorial"), art.words("Shakespeare Memorial")) == 0
    assert art.words("The Ox (or Winged Ox)") == ["ox", "or", "winged", "ox"]


# ---------------------------------------------------------------------------------------------
# Memorial artworks (docs/ETHICS.md)


def test_words_that_mark_a_memorial() -> None:
    marked = [
        "RIP Jordan Sample",
        "R.I.P. Lee",
        "r.i.p",
        "In loving memory of Lee Sample",
        "In memory of our neighbor",
        "Dedicated to the memory of a friend",
        "In Memoriam",
        "Rest in peace",
        "Robin Sample Memorial Mural",
        "Title unknown (commemorative plaque)",
        "Born 1856, died 1923",
        "Ghost bike",
    ]
    for text in marked:
        assert says_memorial(text), text
    for text in ("Rip Van Winkle", "rip current", "Subject/Object Memory", "Remembrance Garden"):
        assert not says_memorial(text), text
    # Two years like a lifespan count in a name, not in an inscription (LOVE, 1996 to 1999).
    assert says_memorial("Jordan Sample 1990 - 2015", is_name=True)
    assert says_memorial("Jordan Sample 1990 to 2015", is_name=True)
    assert not says_memorial("LOVE 1996-1999 ROBERT INDIANA")


def test_openstreetmap_tags_that_mark_a_memorial() -> None:
    assert osm_is_memorial({"artwork_type": "mural;memorial", "name": "Mural"})
    assert osm_is_memorial({"historic": "memorial", "name": "Goethe"})
    assert osm_is_memorial({"memorial": "ghost_bike"})
    assert osm_is_memorial({"memorial:type": "plaque"})
    assert osm_is_memorial({"name:es": "Descanse en paz", "inscription": "In memory of Pat"})
    assert osm_is_memorial({"name": "Jordan Sample 1990-2015"})
    assert not osm_is_memorial({"name": "Love", "inscription": "LOVE 1996-1999"})
    assert not osm_is_memorial({"artwork_type": "statue", "name": "Robin Roberts"})
    # Links hold no words about the work.
    assert not osm_is_memorial({"inscription:url": "https://example.org/in-memory-of"})


#: Every invented name in the memorial fixtures. None may appear in the published layer.
SECRET_NAMES = ("Sample", "Example", "Jordan", "Robin", "Quill")
#: The only properties a memorial artwork may carry.
MEMORIAL_KEYS = {"id", "k", "src", "mem", "pa", "doc", "osm", "wd"}


def osm_row(osm_id: int, east: float, north: float, tags: dict, *, in_city: bool = True) -> dict:
    lng, lat = at(east, north)
    return {
        "osm_type": "node",
        "osm_id": osm_id,
        "tags": json.dumps({"tourism": "artwork", **tags}),
        "lat": lat,
        "lng": lng,
        "in_city": in_city,
        "extract_date": date(2026, 10, 3),
        "geometry": shapely.to_wkb(shapely.Point(lng, lat)),
    }


def osm_table(rows: list[dict]) -> pa.Table:
    return pa.table(
        {
            "osm_type": pa.array([r["osm_type"] for r in rows], pa.string()),
            "osm_id": pa.array([r["osm_id"] for r in rows], pa.int64()),
            "tags": pa.array([r["tags"] for r in rows], pa.string()),
            "lat": pa.array([r["lat"] for r in rows], pa.float64()),
            "lng": pa.array([r["lng"] for r in rows], pa.float64()),
            "in_city": pa.array([r["in_city"] for r in rows], pa.bool_()),
            "extract_date": pa.array([r["extract_date"] for r in rows], pa.date32()),
            "geometry": pa.array([r["geometry"] for r in rows], pa.binary()),
        }
    )


def city_row(number: int, east: float, north: float, **kw) -> dict:
    row = {
        "objectid": number,
        "p4a_id": number,
        "image": "No image available",
        "status": "Active",
        "artist": None,
        "title": None,
        "date_": None,
        "location_name": None,
        "address": None,
        "location_note": None,
        "medium": None,
        "geometry": shapely.to_wkb(parcel(east, north)),
        "source_date": date(2025, 8, 19),
    }
    row.update(kw)
    return row


def city_table(rows: list[dict]) -> pa.Table:
    columns = {name: [r[name] for r in rows] for name in rows[0]}
    types = {"objectid": pa.int64(), "p4a_id": pa.int64(), "geometry": pa.binary()}
    types["source_date"] = pa.date32()
    return pa.table(
        {name: pa.array(values, types.get(name, pa.string())) for name, values in columns.items()}
    )


def wikidata_row(qid: str, east: float, north: float, **kw) -> dict:
    lng, lat = at(east, north)
    row = {
        "qid": qid,
        "label": None,
        "classes": ["Q860861"],
        "lat": lat,
        "lng": lng,
        "inception": None,
        "creators": [],
        "commemorates": [],
        "commemorates_person": False,
        "enwiki": None,
        "urls": [],
        "removed": False,
        "in_city": True,
        "geometry": shapely.to_wkb(shapely.Point(lng, lat)),
    }
    row.update(kw)
    return row


def wikidata_table(rows: list[dict]) -> pa.Table:
    lists = {"classes", "creators", "commemorates", "urls"}
    types = {
        "lat": pa.float64(),
        "lng": pa.float64(),
        "inception": pa.int16(),
        "commemorates_person": pa.bool_(),
        "removed": pa.bool_(),
        "in_city": pa.bool_(),
        "geometry": pa.binary(),
    }
    return pa.table(
        {
            name: pa.array(
                [r[name] for r in rows],
                pa.list_(pa.string()) if name in lists else types.get(name, pa.string()),
            )
            for name in rows[0]
        }
    )


def memorial_snapshots(folder: Path) -> dict[str, Path]:
    """Snapshots of the three sources with memorial artworks in every form, and a few others."""
    folder.mkdir(parents=True, exist_ok=True)
    paths = {
        CITY: folder / "city.parquet",
        OSM: folder / "osm.parquet",
        WIKIDATA: folder / "wd.parquet",
    }
    write_geoparquet(
        city_table(
            [
                city_row(1, 0, 0, title="In Memory of Chris Example", artist="Quill, Avery"),
                city_row(2, 300, 0, title="Title Unknown (commemorative plaque)", date_="1983"),
                city_row(3, 600, 0, title="Driftwood", artist="Kimmelman, Harold", date_="1981"),
                city_row(4, 900, 0, title="Gone Work", status="Inaccessible"),
            ]
        ),
        paths[CITY],
        ["Polygon"],
    )
    write_geoparquet(
        osm_table(
            [
                osm_row(11, 0, 300, {"artwork_type": "mural", "name": "RIP Jordan Sample"}),
                osm_row(12, 0, 600, {"artwork_type": "memorial", "name": "Pat Sample"}),
                osm_row(
                    13,
                    0,
                    900,
                    {
                        "memorial": "plaque",
                        "inscription": "In loving memory of Lee Sample",
                        "website": "https://example.org/lee-sample",
                        "wikipedia": "en:Lee Sample",
                    },
                ),
                osm_row(
                    14, 0, 1200, {"artwork_type": "mural", "name": "Robin Sample Memorial Mural"}
                ),
                osm_row(
                    15,
                    0,
                    1500,
                    {
                        "artwork_type": "mural",
                        "description": "Rest in peace, Jordan",
                        "start_date": "2016",
                    },
                ),
                # The same statue as the Wikidata item below, which says whom it commemorates.
                osm_row(
                    16,
                    300,
                    300,
                    {"artwork_type": "statue", "name": "Sam Sample", "artist_name": "Quill"},
                ),
                # Not memorials: the years are when it was made, and it says nothing more.
                osm_row(
                    17,
                    600,
                    600,
                    {"artwork_type": "sculpture", "name": "LOVE", "inscription": "LOVE 1996-1999"},
                ),
                osm_row(18, 900, 900, {"artwork_type": "mosaic", "name": "Garden Wall"}),
                osm_row(19, 0, 0, {"artwork_type": "mural", "name": "Outside"}, in_city=False),
            ]
        ),
        paths[OSM],
        ["Point"],
    )
    write_geoparquet(
        wikidata_table(
            [
                wikidata_row(
                    "Q101",
                    303,
                    300,
                    label="Statue of Sam Sample",
                    classes=["Q179700"],
                    commemorates=["Q999"],
                    commemorates_person=True,
                    creators=["Avery Quill"],
                    inception=2019,
                    enwiki="https://en.wikipedia.org/wiki/Sam_Sample_statue",
                ),
                wikidata_row("Q102", 1200, 1200, label="Example Ghost Bike", classes=["Q937114"]),
                wikidata_row("Q103", 1500, 1500, label="Wave", classes=["Q860861"], removed=True),
            ]
        ),
        paths[WIKIDATA],
        ["Point"],
    )
    return paths


def test_a_memorial_artwork_is_published_without_any_words_that_could_name_the_person(
    context_factory, tmp_path: Path
) -> None:
    ctx = context_factory()
    out = tmp_path / "art.geojson"
    result = build_art(ctx, memorial_snapshots(tmp_path / "snapshots"), out, AS_OF)
    features = json.loads(out.read_text())["features"]
    by_id = {f["properties"]["id"]: f["properties"] for f in features}
    memorials = [p for p in by_id.values() if p.get("mem") == 1]
    assert sorted(p["id"] for p in memorials) == [
        "Q101",
        "Q102",
        "n11",
        "n12",
        "n13",
        "n14",
        "n15",
        "pa1",
        "pa2",
    ]
    for props in memorials:
        assert set(props) <= MEMORIAL_KEYS, props
        text = json.dumps(props)
        for secret in SECRET_NAMES:
            assert secret not in text, (secret, props)
    # The statue OpenStreetMap names plainly is a memorial too: Wikidata says whom it commemorates.
    assert by_id["Q101"] == {
        "id": "Q101",
        "k": SCULPTURE,
        "src": 6,
        "mem": 1,
        "osm": "n16",
        "wd": "Q101",
    }
    # Everything else keeps its title and artist.
    assert by_id["pa3"]["nm"] == "Driftwood" and by_id["pa3"]["ar"] == "Harold Kimmelman"
    assert by_id["n17"]["nm"] == "LOVE" and "mem" not in by_id["n17"]
    assert by_id["n18"]["k"] == MOSAIC
    # Inaccessible works, works outside the city and works Wikidata says are gone are left out.
    assert {"pa4", "n19", "Q103"}.isdisjoint(by_id)
    assert result.notes[0] == (
        "Public art: 3 from the City's Percent for Art list, 8 from OpenStreetMap, 2 from "
        "Wikidata; 1 works are in more than one source (1 in two, 0 in all three), so the map "
        "shows 12 works, 9 of them memorial artworks shown without names"
    )
    assert "Percent for Art works left out: 1 Inaccessible" in result.notes
    assert any("1 Wikidata artworks left out" in note for note in result.notes)
    # The build notes count; they never name.
    for note in result.notes:
        assert not any(secret in note for secret in SECRET_NAMES)


def test_the_art_layer_is_published_with_the_other_layers(context_factory, tmp_path: Path) -> None:
    ctx = context_factory()
    paths = memorial_snapshots(tmp_path / "snapshots")
    for source_id, path in paths.items():
        table = pa.parquet.read_table(path)
        kinds = ["Polygon"] if source_id == CITY else ["Point"]
        install_snapshot(
            ctx,
            source_id,
            table,
            geometry=True,
            fetched_at="2026-10-05T07:00:00Z",
            geometry_types=kinds,
        )
    result = publish(ctx, tmp_path / "data")
    layer = tmp_path / "data" / "tiles" / "art.art.geojson"
    assert layer.is_file()
    assert result.features["tiles/art.pmtiles art"] == 12
    assert result.manifest["layers"]["public_art"]["file"] == "tiles/art.pmtiles"
    assert any(note.startswith("Public art: ") for note in result.manifest["notes"])


# ---------------------------------------------------------------------------------------------
# Reading each source


def test_city_records_keep_active_works_and_read_the_citys_words() -> None:
    rows = [
        city_row(
            31,
            0,
            0,
            title="Driftwood",
            artist="Kimmelman, Harold",
            date_="1981",
            medium="Metal, bronze",
        ),
        city_row(9, 100, 0, title="Title Unknown (three bas-reliefs)", artist="Felch, Bernard"),
        city_row(
            26, 200, 0, title="Title Unknown", medium="Glass, stained", artist="Artist Unknown"
        ),
        city_row(
            42,
            300,
            0,
            title="Mural: Betsy Ross Making the Flag",
            artist="Greenberg, Joseph J., Jr.",
            location_name="Old City Apartments (interior)",
            image="https://dpd-art-is-essential-docs.s3.amazonaws.com/42.pdf",
        ),
        city_row(
            209,
            400,
            0,
            title="GALLERY - MULTIPLE ARTISTS - INPUT INDIVIDUALLY?",
            medium="Tile, ceramic",
        ),
        city_row(
            210,
            500,
            0,
            title="Water, Ice and Fire",
            location_name="Septa Building (interior & exterior)",
        ),
        city_row(193, 600, 0, title="TBD", status="In Progress"),
        city_row(3, 700, 0, title="Greek Dog", status="Inaccessible"),
    ]
    records, left_out = city_records(rows, AS_OF)
    by_key = {r.key: r for r in records}
    assert sorted(by_key) == ["pa209", "pa210", "pa26", "pa31", "pa42", "pa9"]
    assert left_out == {"In Progress": 1, "Inaccessible": 1}
    drift = by_key["pa31"]
    assert (drift.title, drift.artist, drift.year, drift.ty) == (
        "Driftwood",
        "Harold Kimmelman",
        1981,
        TY_SCULPTURE,
    )
    reliefs = by_key["pa9"]
    assert reliefs.title == "Title unknown (three bas-reliefs)" and reliefs.weak_title
    assert reliefs.names == ("(three bas-reliefs)",) and reliefs.ty == TY_RELIEF
    glass = by_key["pa26"]
    assert glass.title is None and glass.artist is None and glass.ty == TY_STAINED_GLASS
    betsy = by_key["pa42"]
    assert betsy.ty == TY_MURAL and betsy.inside and betsy.artist == "Greenberg, Joseph J., Jr."
    assert betsy.doc == "https://dpd-art-is-essential-docs.s3.amazonaws.com/42.pdf"
    assert betsy.location == "Old City Apartments (interior)"
    assert by_key["pa209"].title is None and by_key["pa209"].ty == TY_MOSAIC
    assert not by_key["pa210"].inside


def test_the_citys_artists_read_first_name_first_when_that_is_safe() -> None:
    assert city_artist("Kimmelman, Harold") == "Harold Kimmelman"
    assert city_artist("Fisher,  Rob") == "Rob Fisher"
    assert city_artist("De Rivera, Jose") == "Jose De Rivera"
    assert city_artist("Fitz-gerald, Clark B.") == "Clark B. Fitz-gerald"
    assert city_artist("Polak, Esther & Van Bekkum, Ivar") == "Polak, Esther & Van Bekkum, Ivar"
    assert (
        city_artist("Koblick, Freda and Tattersfield, Shirley")
        == "Koblick, Freda and Tattersfield, Shirley"
    )
    assert city_artist("Softlab, (Mike Szivos lead artist)") == "Softlab, (Mike Szivos lead artist)"
    assert city_artist("Willet Stained Glass Studios") == "Willet Stained Glass Studios"
    assert city_artist("Artist Unknown") is None
    assert city_artist("TBD") is None


def test_openstreetmap_records_read_kinds_artists_links_and_end_dates() -> None:
    rows = [
        osm_row(
            1,
            0,
            0,
            {
                "artwork_type": "statue",
                "name": "Joan of Arc",
                "artist_name": "Emmanuel Frémiet",
                "start_date": "1890-11-15",
                "material": "gilded_bronze",
                "wikipedia": "en:Joan of Arc (Frémiet)",
            },
        ),
        osm_row(
            2,
            0,
            10,
            {"artwork_type": "mural;mosaic", "name": "Jazz Mural", "artist_name": "A; B ;C"},
        ),
        osm_row(3, 0, 20, {"name": "Healing Wall Mural"}),
        osm_row(4, 0, 30, {"amenity": "fountain", "name": "Five Water Spouts"}),
        osm_row(5, 0, 40, {"artwork_type": "installation", "end_date": "2024-06-01"}),
        osm_row(
            6,
            0,
            50,
            {
                "artwork_type": "sculpture",
                "website": "https://www.associationforpublicart.org/artwork/x/",
                "url": "https://example.org/y",
            },
        ),
        osm_row(
            7, 0, 60, {"artwork_type": "sculpture", "website": "https://en.wikipedia.org/wiki/X"}
        ),
    ]
    records, ended = osm_records(rows, AS_OF)
    by_key = {r.key: r for r in records}
    assert ended == 1 and "n5" not in by_key
    joan = by_key["n1"]
    assert (joan.ty, joan.year, joan.artist, joan.medium) == (
        TY_STATUE,
        1890,
        "Emmanuel Frémiet",
        "Gilded bronze",
    )
    assert joan.wikipedia == "https://en.wikipedia.org/wiki/Joan_of_Arc_(Fr%C3%A9miet)"
    assert by_key["n2"].ty == TY_MURAL and by_key["n2"].artist == "A, B, C"
    assert by_key["n3"].ty == TY_MURAL
    assert KIND_OF_TYPE[by_key["n4"].ty] == OTHER
    assert by_key["n6"].website == "https://www.associationforpublicart.org/artwork/x/"
    assert by_key["n7"].website is None


def test_wikidata_records_take_the_first_listed_class_and_leave_out_what_is_gone() -> None:
    rows = [
        wikidata_row(
            "Q7182595", 0, 0, label="Philadelphia's Magic Gardens", classes=["Q133067", "Q262343"]
        ),
        wikidata_row(
            "Q12063987", 0, 10, label="Newkirk Viaduct Monument", classes=["Q4989906", "Q170980"]
        ),
        wikidata_row("Q1", 0, 20, label="Gone", removed=True),
        wikidata_row("Q2", 0, 30, label="Elsewhere", in_city=False),
        wikidata_row("Q3", 0, 40, label="Q3"),
    ]
    records, gone = wikidata_records(rows, AS_OF)
    by_key = {r.key: r for r in records}
    assert gone == 1 and sorted(by_key) == ["Q12063987", "Q3", "Q7182595"]
    assert by_key["Q7182595"].ty == TY_MOSAIC
    assert KIND_OF_TYPE[by_key["Q12063987"].ty] == OTHER


def test_every_kind_belongs_to_one_of_the_layers_settings() -> None:
    assert set(KIND_OF_TYPE.values()) == {OTHER, MURAL, SCULPTURE, MOSAIC}
    assert set(WIKIDATA_CLASSES.values()) <= set(KIND_OF_TYPE)
    assert set(art.OSM_TYPES.values()) <= set(KIND_OF_TYPE)
    assert KIND_OF_TYPE[TY_PAINTING] == MURAL and KIND_OF_TYPE[TY_INSTALLATION] == OTHER


# ---------------------------------------------------------------------------------------------
# The adapters


def test_the_wikidata_query_asks_for_every_art_class_inside_the_box() -> None:
    query = art_query()
    for qid in WIKIDATA_CLASSES:
        assert f"wd:{qid}" in query
    assert "Point(-75.2803 39.867)" in query and "Point(-74.9558 40.138)" in query
    # Inscriptions and images are never asked for.
    assert "P1684" not in query and "P18 " not in query
    assert wkt_point("Point(-75.17 39.95)") == (-75.17, 39.95)
    assert wkt_point("Point(200 39.95)") is None
    assert inception_year("1948-01-01T00:00:00Z") == 1948
    assert inception_year(None) is None
    with pytest.raises(RetryableError):
        check_sparql({"error": "timeout"})


def binding(qid: str, **values: str) -> dict:
    cells = {"item": {"type": "uri", "value": f"http://www.wikidata.org/entity/{qid}"}}
    for name, value in values.items():
        kind = "uri" if value.startswith("http") else "literal"
        cells[name] = {"type": kind, "value": value}
    return cells


def entity(qid: str) -> str:
    return f"http://www.wikidata.org/entity/{qid}"


#: A reply as the query service sends it: one row per combination of values.
REPLY = {
    "head": {"vars": ["item"]},
    "results": {
        "bindings": [
            binding(
                "Q5135560",
                itemLabel="Clothespin",
                **{"class": entity("Q860861")},
                coord="Point(-75.165 39.953)",
                inception="1976-01-01T00:00:00Z",
                creator=entity("Q46"),
                creatorLabel="Claes Oldenburg",
                article="https://en.wikipedia.org/wiki/Clothespin_(Oldenburg)",
            ),
            binding(
                "Q5135560",
                itemLabel="Clothespin",
                **{"class": entity("Q860861")},
                coord="Point(-75.165 39.953)",
                inception="1976-01-01T00:00:00Z",
                creator=entity("Q47"),
                creatorLabel="Q47",
            ),
            binding(
                "Q129570976",
                itemLabel="Washington Monument",
                **{"class": entity("Q860861")},
                coord="Point(-75.163 39.961)",
                commemorates=entity("Q23"),
                ctype=entity(HUMAN),
                website="https://example.org/washington",
            ),
            binding(
                "Q20509089",
                itemLabel="Q20509089",
                **{"class": entity("Q4989906")},
                coord="Point(-75.155 39.952)",
            ),
            binding(
                "Q1",
                itemLabel="Gone",
                **{"class": entity("Q179700")},
                coord="Point(-75.165 39.955)",
                gone="2020-06-03T00:00:00Z",
            ),
            binding(
                "Q2",
                itemLabel="Across the river",
                **{"class": entity("Q179700")},
                coord="Point(-75.10 39.90)",
            ),
        ]
    },
}


def test_wikidata_rows_are_joined_per_item() -> None:
    found = wikidata_items(REPLY)
    # One entry per item, in the order of their numbers.
    assert [item["qid"] for item in found] == ["Q1", "Q2", "Q5135560", "Q20509089", "Q129570976"]
    items = {item["qid"]: item for item in found}
    clothespin = items["Q5135560"]
    # A creator Wikidata has no English label for is left out, not shown as its id.
    assert clothespin["creators"] == {"Q46": "Claes Oldenburg"}
    assert clothespin["years"] == {1976}
    assert items["Q20509089"]["labels"] == set()
    assert items["Q129570976"]["commemorated_types"] == {"Q23": {HUMAN}}
    assert items["Q1"]["gone"] and not items["Q5135560"]["gone"]


def test_the_wikidata_adapter_asks_once_politely_and_keeps_the_city(context_factory) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json=REPLY)

    ctx = context_factory(handler=handler)
    install_city(ctx)
    source = ctx.registry.sources["wikidata_art"]
    source = source.model_copy(update={"health": source.health.model_copy(update={"min_rows": 1})})
    assert fetch_source(ctx, source).outcome == "downloaded"
    assert validate_source(ctx, source).outcome == "ok"
    assert len(seen) == 1
    request = seen[0]
    assert request.method == "POST" and request.url.host == "query.wikidata.org"
    assert request.url.params["format"] == "json"
    assert request.headers["user-agent"].startswith("Placekeepers/")
    assert parse_qs(request.content.decode())["query"][0] == art_query()
    store = SnapshotStore(ctx.cache, "wikidata_art")
    table = pa.parquet.read_table(store.path_for(store.current())).to_pylist()
    rows = {row["qid"]: row for row in table}
    assert set(rows) == {"Q1", "Q2", "Q5135560", "Q20509089", "Q129570976"}
    assert (
        rows["Q5135560"]["creators"] == ["Claes Oldenburg"]
        and rows["Q5135560"]["inception"] == 1976
    )
    assert rows["Q129570976"]["commemorates_person"] and rows["Q129570976"]["urls"] == [
        "https://example.org/washington"
    ]
    assert rows["Q20509089"]["label"] is None
    assert rows["Q1"]["removed"]
    assert rows["Q2"]["in_city"] is False and rows["Q5135560"]["in_city"] is True
    assert set(WikidataArt.required_columns) <= set(store.current().columns)


def test_the_city_list_keeps_what_the_map_shows_and_not_its_street_view_links() -> None:
    assert ADAPTERS["percent_for_art"] is PercentForArt
    assert "google_streetview_link" not in PercentForArt.out_fields
    assert "neighborhood" not in PercentForArt.out_fields
    assert {"p4a_id", "status", "title", "artist", "date_", "medium", "image"} <= set(
        PercentForArt.out_fields
    )
