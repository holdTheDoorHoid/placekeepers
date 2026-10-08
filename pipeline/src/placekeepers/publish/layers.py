"""Build each map layer as GeoJSON from the current snapshots, with the short property names of
docs/CONTRACTS.md section 4.

* `hin` (streets): `id`, `name`, `len` (feet).
* `h3` (context): `h` (cell id), `s12` and `s36`, shooting victims in the 12 and 36 months up to the
  build date, per H3 cell at resolution 9 (about two blocks across). Only cells with at least one
  victim in the 36 month window are written. Counts only: no dates, no points, nothing about any
  person.
* `parcels` (lots): every parcel the vacancy model (placekeepers.derive.vacancy) shows: `id` (OPA
  account), `k` (1 vacant lot, 2 vacant building), `vc` (confidence: 3 high, 2 medium, 1 low),
  `ot` (owner type, from the City owned property layer and OPA's owner names: see
  placekeepers.derive.owners), `rt` (the first lawful step to get permission, a category: the
  first route of the parcel's dossier, see placekeepers.derive.routes), `lc` (1 when PHS LandCare
  maintains the parcel), `rs` (reason
  bits), `n` (independent signals that agree), and `dy`, `sy`, `ny` (the year of a demolition, a
  City seal or a new construction permit, only when a reason uses it). When the model has not run,
  the City's lists alone are shown at medium confidence instead.
* `landcare` (care): `id` (OPA account, or empty), `p` (program: 1 LandCare, 2 Community LandCare,
  3 Land Bank lot, 4 PHDC lot, 0 other), `y` (year the lot joined, 0 when unknown).
* `gardens` (care): `nm` (name), `src` (1 PHS, 2 Neighborhood Gardens Trust, 3 both, 4 registered
  with Parks and Recreation), `w` (website, when there is one).
* `council_districts`, `rcos` and `neighborhoods` (boundaries): `nm` (a name to label it with),
  plus `d` (district number), `id` and `t` (the City's id and type for community organizations,
  `w` their website) and `id` (the neighborhood's code name).
"""

from __future__ import annotations

import logging
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import h3
import pyarrow.parquet as pq
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

from placekeepers.context import Context
from placekeepers.dates import months_before
from placekeepers.derive.displacement import SOURCES as DISPLACEMENT_SOURCES
from placekeepers.derive.heat import SOURCES as HEAT_SOURCES
from placekeepers.derive.heat import load_heat, with_heat
from placekeepers.derive.lenses import SOURCES as LENS_SOURCES
from placekeepers.derive.lenses import load_factors
from placekeepers.derive.vacancy import SOURCES as VACANCY_SOURCES
from placekeepers.derive.walk import SOURCES as WALK_SOURCES
from placekeepers.derive.walk import load_walk
from placekeepers.geo import GeoJSONWriter, geometry_json

log = logging.getLogger(__name__)

#: The displacement watch's sources (M4.1), credited wherever its signs are carried (`dw`).
WATCH_SOURCES = tuple(s for s in DISPLACEMENT_SOURCES if s != "census_tracts_2020")

H3_RESOLUTION = 9

# Generous box around Philadelphia. Points outside it are data errors (for example 0, 0).
PHILLY_LAT = (39.80, 40.20)
PHILLY_LNG = (-75.35, -74.90)


@dataclass
class BuildResult:
    features: int
    notes: list[str]


@dataclass(frozen=True)
class LayerBuilder:
    file: str
    source_layer: str
    #: at least one of these must have a usable snapshot
    sources: tuple[str, ...]
    build: Callable[[Context, dict[str, Path], Path, date], BuildResult]
    #: used when available, never required
    extras: tuple[str, ...] = ()
    #: read only to link this layer's features to records published in another file, by id:
    #: none of their data is stored here, so the file's credit line leaves them out (decision D1
    #: of docs/VERIFICATION_V0_2.md: SEPTA's stops link to OpenStreetMap's by id, `o`)
    links: tuple[str, ...] = ()


# High Injury Network
def build_hin(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["high_injury_network"], columns=["objectid", "stname", "length_ft", "geometry"]
    )
    rows = sorted(table.to_pylist(), key=lambda row: row["objectid"])
    with GeoJSONWriter(out) as writer:
        for row in rows:
            length = row["length_ft"]
            properties = {
                "id": int(row["objectid"]),
                "name": row["stname"],
                "len": None if length is None else round(length),
            }
            writer.write(properties, geometry_json(row["geometry"]))
    return BuildResult(writer.count, [])


# Shooting victims per H3 cell
def aggregate_shootings(
    rows: Iterable[tuple[float | None, float | None, date | None]],
    as_of: date,
    resolution: int = H3_RESOLUTION,
) -> tuple[dict[str, list[int]], int]:
    """Count victims per H3 cell: [s12, s36]. A victim counts in a window when its date is after
    the window start and on or before `as_of`. Returns the counts and how many dated rows inside
    the 36 month window had no usable point."""
    start12 = months_before(as_of, 12)
    start36 = months_before(as_of, 36)
    counts: dict[str, list[int]] = {}
    unplaced = 0
    for lat, lng, day in rows:
        if day is None or not (start36 < day <= as_of):
            continue
        if (
            lat is None
            or lng is None
            or not (PHILLY_LAT[0] <= lat <= PHILLY_LAT[1])
            or not (PHILLY_LNG[0] <= lng <= PHILLY_LNG[1])
        ):
            unplaced += 1
            continue
        cell = h3.latlng_to_cell(lat, lng, resolution)
        entry = counts.setdefault(cell, [0, 0])
        entry[1] += 1
        if day > start12:
            entry[0] += 1
    return counts, unplaced


def cell_polygon(cell: str) -> Polygon:
    ring = [(lng, lat) for lat, lng in h3.cell_to_boundary(cell)]
    return orient(Polygon(ring), sign=1.0)


def build_h3(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["shootings"], columns=["lat", "lng", "date_"])
    rows = zip(
        table.column("lat").to_pylist(),
        table.column("lng").to_pylist(),
        table.column("date_").to_pylist(),
        strict=True,
    )
    counts, unplaced = aggregate_shootings(rows, as_of)
    notes = []
    if unplaced:
        notes.append(f"{unplaced} shooting victims in the last 36 months have no usable location")
        log.warning("h3: %s", notes[-1])
    with GeoJSONWriter(out) as writer:
        for cell in sorted(counts):
            s12, s36 = counts[cell]
            writer.write({"h": cell, "s12": s12, "s36": s36}, geometry_json(cell_polygon(cell)))
    return BuildResult(writer.count, notes)


# Vacant parcels
def opa_account(value: object) -> str | None:
    """The 9 digit OPA account number, or None when the value holds none. Spaces and a second
    account ("121099030/9130") are ignored; an 8 digit account gets its leading zero back."""
    if value is None:
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    found = re.search(r"\d+", text)
    if not found or not 8 <= len(found.group()) <= 9:
        return None
    return found.group().zfill(9)


PARCEL_SOURCES = (("vacant_indicators_land", 1), ("vacant_indicators_bldg", 2))


def parcel_kind(kinds: set[int], description: str | None) -> int:
    """1 for a vacant lot, 2 for a vacant building.

    About a thousand parcels are on both City lists with the same shape. Nearly all of them
    (947 of 966 on 2026-10-04) carry the City's own description "VAC LAND ...", so for a parcel
    on both lists that description decides: vacant land is a lot, anything else a building.
    """
    if len(kinds) == 1:
        return next(iter(kinds))
    if description and description.strip().upper().startswith("VAC LAND"):
        return 1
    return 2


def build_parcels(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    """The vacancy model's parcels, or the City's lists alone when the model has not run."""
    model = ctx.cache.root / "derived" / "vacancy.parquet"
    if model.is_file():
        return build_parcels_from_model(
            model, out, paths, set(ctx.registry.routes), set(ctx.registry.suggestions)
        )
    result = build_parcels_from_city_lists(ctx, paths, out, as_of)
    result.notes.append("The vacancy model has not run, so the map shows the City's lists alone")
    return result


PARCEL_LAYER_SOURCES = ("opa_properties", "vacant_indicators_land", "vacant_indicators_bldg")

SHOWN_KINDS = ("lot", "lot_conflict", "building")


def suggestion_ids(k: int, known: set[str] | None) -> str:
    """`sg`: the parcel's suggestion ids, comma separated, as its dossier lists them (a vacant lot
    gets clean and green, a vacant building gets sealed; derive.routes.suggestions_for)."""
    from placekeepers.derive.routes import SUGGESTIONS_BY_KIND, suggestions_for

    kind = "lot" if k == 1 else "building"
    allowed = known if known is not None else set(SUGGESTIONS_BY_KIND[kind])
    return ",".join(suggestions_for(kind, allowed))


def build_parcels_from_model(
    model: Path,
    out: Path,
    paths: dict[str, Path] | None = None,
    known_routes: set[str] | None = None,
    known_suggestions: set[str] | None = None,
) -> BuildResult:
    columns = ["opa", "kind", "k", "vc", "lc", "rs", "n", "dy", "sy", "ny", "geometry"]
    table = pq.read_table(model, columns=columns)
    # Owner type (M1.3): from the City owned property layer and OPA's owner names.
    from placekeepers.publish.dossiers import (
        listed_available_accounts,
        owner_type_codes,
        route_codes,
    )

    accounts = set(table.column("opa").to_pylist())
    owner_types = owner_type_codes(paths or {}, accounts)
    # Listed as available by the City's land agencies (issue #36): `la` 1, absent otherwise.
    listed = listed_available_accounts(paths or {}, accounts)
    # The first route, as the dossier lists it (rt, a category).
    calls = {
        a: {"rs": r or 0}
        for a, r in zip(
            table.column("opa").to_pylist(), table.column("rs").to_pylist(), strict=True
        )
    }
    routes = route_codes(paths or {}, accounts, known_routes, calls)
    # The violence lens factors (M1.4) and the heat and shade lens factors (M3.1), from pk derive.
    factors = load_factors(model.with_name("lens_factors.parquet"))
    heat = load_heat(model.with_name("heat_factors.parquet"))
    # The walking measures for the placemaking lens (M3.3), from pk derive.
    walking = load_walk(model.with_name("walk_factors.parquet"))
    # The displacement watch (M4.1): the signs of the watch area a parcel lies in, as `dw`.
    from placekeepers.publish.displacement import parcel_watch

    watch = parcel_watch(model.parent)
    rows = zip(*(table.column(name).to_pylist() for name in columns), strict=True)
    with GeoJSONWriter(out) as writer:
        for opa, kind, k, vc, lc, rs, n, dy, sy, ny, wkb in rows:
            if kind not in SHOWN_KINDS or wkb is None or vc is None:
                continue
            ot = owner_types.get(opa, 0)
            rt = routes.get(opa, 0)
            properties = {"id": opa, "k": k, "vc": vc, "ot": ot, "rt": rt, "lc": lc, "rs": rs}
            properties["n"] = n
            if opa in listed:
                properties["la"] = 1
            properties["sg"] = suggestion_ids(k, known_suggestions)
            for key, year in (("dy", dy), ("sy", sy), ("ny", ny)):
                if year is not None:
                    properties[key] = int(year)
            properties.update(factors.get(opa, {}))
            hot = heat.get(opa)
            if hot is not None:
                properties.update(hot.properties)
                first = [s for s in properties["sg"].split(",") if s]
                properties["sg"] = ",".join(with_heat(first, hot.suggestions, known_suggestions))
            properties.update(walking.get(opa, {}))
            if opa in watch:
                properties["dw"] = watch[opa][1]
            writer.write(properties, geometry_json(wkb))
    return BuildResult(writer.count, [])


def build_parcels_from_city_lists(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    kinds: dict[str, set[int]] = {}
    shapes: dict[str, bytes] = {}
    descriptions: dict[str, str | None] = {}
    no_account = 0
    for source_id, kind in PARCEL_SOURCES:
        if source_id not in paths:
            continue
        table = pq.read_table(paths[source_id], columns=["opa_id", "bldg_desc", "geometry"])
        for opa_id, description, wkb in zip(
            table.column("opa_id").to_pylist(),
            table.column("bldg_desc").to_pylist(),
            table.column("geometry").to_pylist(),
            strict=True,
        ):
            if wkb is None:
                continue
            account = opa_account(opa_id)
            if account is None:
                no_account += 1
                continue
            kinds.setdefault(account, set()).add(kind)
            shapes.setdefault(account, wkb)
            if description:
                descriptions.setdefault(account, description)
    landcare = landcare_accounts(paths.get("phs_landcare"))
    # Owner type (M1.3): from the City owned property layer and OPA's owner names.
    from placekeepers.publish.dossiers import (
        listed_available_accounts,
        owner_type_codes,
        route_codes,
    )

    owner_types = owner_type_codes(paths, set(kinds))
    listed = listed_available_accounts(paths, set(kinds))
    routes = route_codes(paths, set(kinds), set(ctx.registry.routes))
    notes = []
    if no_account:
        notes.append(
            f"{no_account} vacancy indicator features have no OPA account number and are not shown"
        )
    both = [account for account, found in kinds.items() if len(found) > 1]
    if both:
        as_lots = sum(
            1 for account in both if parcel_kind(kinds[account], descriptions.get(account)) == 1
        )
        notes.append(
            f"{len(both)} parcels are on both City vacancy lists: {as_lots} shown as lots because "
            f"the City describes them as vacant land, {len(both) - as_lots} as buildings"
        )
    for note in notes:
        log.warning("parcels: %s", note)
    with GeoJSONWriter(out) as writer:
        for account in sorted(kinds):
            kind = parcel_kind(kinds[account], descriptions.get(account))
            lc = 1 if account in landcare else 0
            ot = owner_types.get(account, 0)
            rt = routes.get(account, 0)
            properties = {"id": account, "k": kind, "vc": 2, "ot": ot, "rt": rt, "lc": lc}
            if account in listed:
                properties["la"] = 1
            properties["sg"] = suggestion_ids(kind, set(ctx.registry.suggestions))
            writer.write(properties, geometry_json(shapes[account]))
    return BuildResult(writer.count, notes)


def landcare_accounts(path: Path | None) -> set[str]:
    if path is None:
        return set()
    table = pq.read_table(path, columns=["brt_id"])
    return {
        account for value in table.column("brt_id").to_pylist() if (account := opa_account(value))
    }


# Care already happening: PHS LandCare and gardens
LANDCARE_PROGRAMS = {"PLC": 1, "CLC": 2, "LANDBANK": 3, "PHDC": 4}


def _year(value: object, as_of: date) -> int:
    text = str(value or "").strip()
    return int(text) if text.isdigit() and 1950 <= int(text) <= as_of.year + 1 else 0


def build_landcare(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(paths["phs_landcare"], columns=["brt_id", "program", "year", "geometry"])
    with GeoJSONWriter(out) as writer:
        for brt_id, program, year, wkb in zip(
            *(table.column(name).to_pylist() for name in table.column_names), strict=True
        ):
            properties = {
                "id": opa_account(brt_id) or "",
                "p": LANDCARE_PROGRAMS.get(str(program or "").strip().upper(), 0),
                "y": _year(year, as_of),
            }
            writer.write(properties, geometry_json(wkb))
    return BuildResult(writer.count, [])


GARDEN_SUPPORT = {"PHS": 1, "NGT": 2, "PHS AND NGT": 3}

# No dashes as punctuation in what people read (finding F14): a City name such as "Fishtown -
# Lower Kensington" becomes "Fishtown, Lower Kensington", as the lot page shows City records
# (web/src/dossier/plain.ts). Hyphens inside words ("Smith-Jones", "1304-08") stay.
_SPACED_DASH = re.compile(r"\s+[-\u2013\u2014]+\s+")
_LONE_DASH = re.compile(r"[\u2013\u2014]+")


def plain_name(text: object) -> object:
    """A name for a map label, with a dash used as punctuation turned into a comma."""
    if not isinstance(text, str):
        return text
    cleaned = _LONE_DASH.sub(", ", _SPACED_DASH.sub(", ", text))
    return re.sub(r"\s+,", ",", cleaned)


def _with_website(properties: dict, website: object) -> dict:
    text = str(website or "").strip()
    if text:
        properties["w"] = text
    return properties


def build_gardens(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    with GeoJSONWriter(out) as writer:
        if "gardens_phs_ngt" in paths:
            table = pq.read_table(
                paths["gardens_phs_ngt"], columns=["site_name", "supported", "website", "geometry"]
            )
            for name, supported, website, wkb in zip(
                *(table.column(c).to_pylist() for c in table.column_names), strict=True
            ):
                src = GARDEN_SUPPORT.get(str(supported or "").strip().upper(), 1)
                properties = {"nm": plain_name(name), "src": src}
                writer.write(_with_website(properties, website), geometry_json(wkb))
        if "gardens_registered" in paths:
            table = pq.read_table(
                paths["gardens_registered"], columns=["garden_name", "contact_website", "geometry"]
            )
            for name, website, wkb in zip(
                *(table.column(c).to_pylist() for c in table.column_names), strict=True
            ):
                properties = {"nm": plain_name(name), "src": 4}
                writer.write(_with_website(properties, website), geometry_json(wkb))
    return BuildResult(writer.count, [])


# Boundaries
def build_council_districts(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    table = pq.read_table(paths["council_districts"], columns=["district", "geometry"])
    with GeoJSONWriter(out) as writer:
        for district, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            number = int(str(district).strip())
            writer.write({"d": number, "nm": f"District {number}"}, geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


def build_rcos(ctx: Context, paths: dict[str, Path], out: Path, as_of: date) -> BuildResult:
    table = pq.read_table(
        paths["community_organizations"],
        columns=["lni_id", "organization_name", "org_type", "websites", "geometry"],
    )
    with GeoJSONWriter(out) as writer:
        for lni_id, name, kind, website, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            properties = {"id": int(lni_id) if lni_id is not None else 0, "nm": plain_name(name)}
            if kind:
                properties["t"] = kind
            writer.write(_with_website(properties, website), geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


def build_neighborhoods(
    ctx: Context, paths: dict[str, Path], out: Path, as_of: date
) -> BuildResult:
    table = pq.read_table(paths["neighborhoods"], columns=["name", "listname", "geometry"])
    with GeoJSONWriter(out) as writer:
        for name, listname, wkb in zip(
            *(table.column(c).to_pylist() for c in table.column_names), strict=True
        ):
            writer.write({"id": name, "nm": plain_name(listname or name)}, geometry_json(wkb, 6))
    return BuildResult(writer.count, [])


BUILDERS: tuple[LayerBuilder, ...] = (
    LayerBuilder(
        "tiles/lots.pmtiles",
        "parcels",
        PARCEL_LAYER_SOURCES,
        build_parcels,
        # Every input of the vacancy model and the lens factors, so the tile file credits each
        # one, and the City owned property layer for the owner type and the lots its land
        # agencies list as available (`la`, issue #36).
        extras=(
            *(
                s
                for s in dict.fromkeys(
                    (*VACANCY_SOURCES, *LENS_SOURCES, *HEAT_SOURCES, *WALK_SOURCES)
                )
                if s not in PARCEL_LAYER_SOURCES
            ),
            "city_owned_property",
            # The displacement watch's sources (M4.1), for `dw`.
            *WATCH_SOURCES,
        ),
    ),
    LayerBuilder("tiles/streets.pmtiles", "hin", ("high_injury_network",), build_hin),
    LayerBuilder("tiles/context.pmtiles", "h3", ("shootings",), build_h3),
    LayerBuilder("tiles/care.pmtiles", "landcare", ("phs_landcare",), build_landcare),
    LayerBuilder(
        "tiles/care.pmtiles", "gardens", ("gardens_phs_ngt", "gardens_registered"), build_gardens
    ),
    LayerBuilder(
        "tiles/boundaries.pmtiles",
        "council_districts",
        ("council_districts",),
        build_council_districts,
    ),
    LayerBuilder("tiles/boundaries.pmtiles", "rcos", ("community_organizations",), build_rcos),
    LayerBuilder(
        "tiles/boundaries.pmtiles", "neighborhoods", ("neighborhoods",), build_neighborhoods
    ),
)


def builder_for(file: str, source_layer: str) -> LayerBuilder | None:
    for builder in BUILDERS:
        if builder.file == file and builder.source_layer == source_layer:
            return builder
    return None


# The street safety layers (segments, crashes, memorials) live in their own module (M1.5), SEPTA's
# stops and routes in another (M2.1), and the amenities from OpenStreetMap (shelters and benches
# at stops) in a third (M2.2). Heat, trees and the floodplain have theirs too (M3.1).
from placekeepers.publish.amenities import AMENITY_BUILDERS  # noqa: E402
from placekeepers.publish.city_places import PLACE_BUILDERS  # noqa: E402
from placekeepers.publish.conditions import CONDITION_BUILDERS  # noqa: E402
from placekeepers.publish.environment import ENVIRONMENT_BUILDERS  # noqa: E402
from placekeepers.publish.streets import STREET_BUILDERS  # noqa: E402
from placekeepers.publish.transit import TRANSIT_BUILDERS  # noqa: E402
from placekeepers.publish.walk import WALK_BUILDERS  # noqa: E402

BUILDERS = (
    *BUILDERS,
    *STREET_BUILDERS,
    *TRANSIT_BUILDERS,
    *AMENITY_BUILDERS,
    *ENVIRONMENT_BUILDERS,
    # Public places from the City and conditions reported to 311 (M3.5).
    *PLACE_BUILDERS,
    *CONDITION_BUILDERS,
    # Walking, cycling and people (M3.3).
    *WALK_BUILDERS,
)

# Public art (M3.2), from the City, OpenStreetMap and Wikidata.
from placekeepers.publish.art import ART_BUILDERS  # noqa: E402

BUILDERS = (*BUILDERS, *ART_BUILDERS)

# The displacement watch (M4.1): areas with signs that prices are rising.
from placekeepers.publish.displacement import DISPLACEMENT_BUILDERS  # noqa: E402

BUILDERS = (*BUILDERS, *DISPLACEMENT_BUILDERS)
