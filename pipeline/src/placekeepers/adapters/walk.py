"""Walkability and people (milestone M3.3): four sources.

**The National Walkability Index** (`epa_walkability`). The U.S. Environmental Protection Agency's
Smart Location Database, version 3 (2021), as the EPA's Office of Community Revitalization serves
it from its own ArcGIS Online organization: one polygon per census block group (the 2019 block
groups, the same as the 2010 ones), with the National Walkability Index (`NatWalkInd`, 1 to 20)
and the four ranked measures it is built from (each 1 to 20 among all block groups in the
country): intersection density (`D3B_Ranked`, a third of the index), proximity to transit
(`D4A_Ranked`, a third), the mix of kinds of jobs (`D2B_Ranked`, a sixth) and the mix of jobs and
households (`D2A_Ranked`, a sixth). Only Philadelphia's block groups are downloaded (state 42,
county 101: 1,336 on 2026-10-05), in one page, not the EPA's 405 MB national file. The EPA's data
are a work of the U.S. government, in the public domain (data.gov lists them under CC0).

**People by census block** (`census_blocks_2020`). The 2020 census count of every block, from the
Census Bureau's redistricting file for Pennsylvania (P.L. 94-171, a 57 MB zip; no key needed,
unlike the Census API). Only its geographic header (`pageo2020.pl`) is read: pipe delimited, with
no header row, its 97 fields in the order of the Census Bureau's own import scripts
(GEO_HEADER_FIELDS). It holds every block's total population (`POP100`), housing units (`HU100`),
land and water area in square meters and an internal point (a point inside the block). The
snapshot keeps Philadelphia's blocks (summary level 750 in county 101: 17,554, with 1,603,797
people), as points at their internal point. The 2020 count never changes, so the source is
frozen.

**Traffic stress for cycling** (`dvrpc_lts`). The Delaware Valley Regional Planning Commission's
Level of Traffic Stress network (https://github.com/dvrpc/gis-lts-calc): every road segment of its
travel model network rated 1 (comfortable for most people of all ages) to 4 (only the strong and
fearless) from the lanes, the vehicle speed (posted speed limits, else the model's) and the kind of
bike facility. Each direction of a segment is its own row (the same link number `no`, the nodes
reversed). Only Philadelphia's rows are downloaded (`county_code` 42101: 60,867 on 2026-10-05).
DVRPC marks the dataset "Unrestricted: can be shared internally and externally without data sharing
agreement", under its data license: provided as is, and users credit DVRPC.

**Food stores that take SNAP** (`snap_retailers`). The U.S. Department of Agriculture's list of
every store authorized to take SNAP benefits, as it serves it for its retailer locator, updated
every two weeks. Only Philadelphia's stores are downloaded (1,460 on 2026-10-05), and only each
store's kind (`Store_Type`) and point are kept: no names or addresses. A grocery store or market
(supermarkets, super stores, grocery stores, specialty food stores and farmers markets, not
convenience stores) is one of the everyday places counted within a 10 minute walk
(placekeepers.derive.walk).
"""

from __future__ import annotations

import io
import logging
import zipfile
from pathlib import Path
from typing import ClassVar

import pyarrow as pa
import pyarrow.parquet as pq
import shapely

from placekeepers.adapters.arcgis import ArcgisAdapter
from placekeepers.adapters.base import FetchError
from placekeepers.adapters.environment import _edit_day, _with_columns
from placekeepers.adapters.url import UrlAdapter
from placekeepers.cache import RawFetch
from placekeepers.geo import write_geoparquet
from placekeepers.health import Check

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------------------------
# The National Walkability Index

#: The index's lowest and highest possible values (the EPA ranks each measure from 1 to 20).
INDEX_RANGE = (1.0, 20.0)


class EpaWalkability(ArcgisAdapter):
    """Philadelphia's block groups of the EPA's Smart Location Database (module docstring)."""

    out_fields = (
        "OBJECTID",
        "GEOID10",
        "TotPop",
        "Ac_Land",
        "D3B",
        "D4A",
        "D2B_E8MIXA",
        "D2A_EPHHM",
        "D2A_Ranked",
        "D2B_Ranked",
        "D3B_Ranked",
        "D4A_Ranked",
        "NatWalkInd",
    )
    query_where: ClassVar[str] = "STATEFP = '42' AND COUNTYFP = '101'"
    # About ten centimeters is plenty for a block group, and keeps the download small.
    query_params: ClassVar[dict[str, str]] = {"geometryPrecision": "6"}
    required_columns = (
        "geoid10",
        "natwalkind",
        "d2a_ranked",
        "d2b_ranked",
        "d3b_ranked",
        "d4a_ranked",
        "source_date",
        "geometry",
    )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        rows = pq.read_metadata(out).num_rows
        day = _edit_day(raw)
        _with_columns(out, {"source_date": pa.array([day] * rows, pa.date32())})

    def extra_checks(self, path: Path, newest) -> list[Check]:
        """Every index lies between 1 and 20; a value outside means the layer changed meaning."""
        values = pq.read_table(path, columns=["natwalkind"]).column("natwalkind").to_pylist()
        low, high = INDEX_RANGE
        odd = [v for v in values if v is not None and not low <= v <= high]
        missing = sum(1 for v in values if v is None)
        detail = (
            f"{len(values) - missing - len(odd):,} of {len(values):,} block groups have an index "
            f"from 1 to 20 ({len(odd):,} outside it, {missing:,} without one)"
        )
        return [Check("index_range", not odd and missing < max(1, len(values) // 20), detail)]


# ---------------------------------------------------------------------------------------------
# People by census block, from the 2020 redistricting file

#: The fields of the 2020 redistricting file's geographic header, in order, as the Census
#: Bureau's import scripts name them (2020PL_R_import_scripts.zip, pl_geohd_2020_dar.r).
GEO_HEADER_FIELDS = (
    "FILEID", "STUSAB", "SUMLEV", "GEOVAR", "GEOCOMP", "CHARITER", "CIFSN", "LOGRECNO", "GEOID",
    "GEOCODE", "REGION", "DIVISION", "STATE", "STATENS", "COUNTY", "COUNTYCC", "COUNTYNS",
    "COUSUB", "COUSUBCC", "COUSUBNS", "SUBMCD", "SUBMCDCC", "SUBMCDNS", "ESTATE", "ESTATECC",
    "ESTATENS", "CONCIT", "CONCITCC", "CONCITNS", "PLACE", "PLACECC", "PLACENS", "TRACT",
    "BLKGRP", "BLOCK", "AIANHH", "AIHHTLI", "AIANHHFP", "AIANHHCC", "AIANHHNS", "AITS", "AITSFP",
    "AITSCC", "AITSNS", "TTRACT", "TBLKGRP", "ANRC", "ANRCCC", "ANRCNS", "CBSA", "MEMI", "CSA",
    "METDIV", "NECTA", "NMEMI", "CNECTA", "NECTADIV", "CBSAPCI", "NECTAPCI", "UA", "UATYPE", "UR",
    "CD116", "CD118", "CD119", "CD120", "CD121", "SLDU18", "SLDU22", "SLDU24", "SLDU26", "SLDU28",
    "SLDL18", "SLDL22", "SLDL24", "SLDL26", "SLDL28", "VTD", "VTDI", "ZCTA", "SDELM", "SDSEC",
    "SDUNI", "PUMA", "AREALAND", "AREAWATR", "BASENAME", "NAME", "FUNCSTAT", "GCUNI", "POP100",
    "HU100", "INTPTLAT", "INTPTLON", "LSADC", "PARTFLAG", "UGA",
)  # fmt: skip
_AT = {name: i for i, name in enumerate(GEO_HEADER_FIELDS)}
#: The summary level of a census block in the 2020 redistricting file.
BLOCK_LEVEL = "750"
#: Philadelphia: the state and county FIPS codes.
STATE, COUNTY = "42", "101"
#: The 2020 census count of Philadelphia, to check the download adds up (1,603,797 people).
POPULATION_RANGE = (1_400_000, 1_800_000)


def geo_header_name(names: list[str]) -> str:
    """The geographic header inside a redistricting zip: `<state>geo2020.pl`."""
    found = [n for n in names if n.lower().endswith("geo2020.pl")]
    if len(found) != 1:
        raise FetchError(f"The zip should hold one geographic header (*geo2020.pl), not {found}")
    return found[0]


def _int(text: str) -> int | None:
    text = text.strip()
    return int(text) if text.lstrip("+-").isdigit() else None


def _float(text: str) -> float | None:
    try:
        return float(text.strip())
    except ValueError:
        return None


def read_blocks(lines, state: str = STATE, county: str = COUNTY) -> list[dict]:
    """The blocks of one county from the geographic header's lines (module docstring)."""
    blocks = []
    for number, line in enumerate(lines, start=1):
        fields = line.rstrip("\r\n").split("|")
        if len(fields) != len(GEO_HEADER_FIELDS):
            raise FetchError(
                f"Line {number} of the geographic header has {len(fields)} fields, not "
                f"{len(GEO_HEADER_FIELDS)}: the file's layout has changed"
            )
        if fields[_AT["SUMLEV"]] != BLOCK_LEVEL:
            continue
        if fields[_AT["STATE"]] != state or fields[_AT["COUNTY"]] != county:
            continue
        tract, block = fields[_AT["TRACT"]], fields[_AT["BLOCK"]]
        geoid = f"{state}{county}{tract}{block}"
        lat, lng = _float(fields[_AT["INTPTLAT"]]), _float(fields[_AT["INTPTLON"]])
        population = _int(fields[_AT["POP100"]])
        if lat is None or lng is None or population is None or len(geoid) != 15:
            raise FetchError(f"Block {geoid or number} has no usable count or internal point")
        blocks.append(
            {
                "geoid": geoid,
                "tract": tract,
                "block_group": geoid[:12],
                "population": population,
                "housing_units": _int(fields[_AT["HU100"]]),
                "land_m2": _int(fields[_AT["AREALAND"]]),
                "water_m2": _int(fields[_AT["AREAWATR"]]),
                "lat": lat,
                "lng": lng,
            }
        )
    return blocks


class CensusBlocks2020(UrlAdapter):
    """Philadelphia's census blocks with their 2020 population (module docstring)."""

    required_columns = (
        "geoid",
        "tract",
        "block_group",
        "population",
        "housing_units",
        "land_m2",
        "lat",
        "lng",
        "geometry",
    )

    def normalize(self, raw: RawFetch, out: Path) -> None:
        path = self.data_file(raw)
        try:
            with zipfile.ZipFile(path) as archive:
                name = geo_header_name(archive.namelist())
                with archive.open(name) as handle:
                    # The Census Bureau writes these files in Latin 1 (place names with accents).
                    lines = io.TextIOWrapper(handle, encoding="latin-1", newline="")
                    blocks = read_blocks(lines)
        except zipfile.BadZipFile as exc:
            raise FetchError(f"The download is not a zip file: {exc}") from exc
        if not blocks:
            raise FetchError("The geographic header holds no Philadelphia blocks")
        blocks.sort(key=lambda b: b["geoid"])
        points = shapely.points([b["lng"] for b in blocks], [b["lat"] for b in blocks])
        table = pa.table(
            {
                "geoid": pa.array([b["geoid"] for b in blocks], pa.string()),
                "tract": pa.array([b["tract"] for b in blocks], pa.string()),
                "block_group": pa.array([b["block_group"] for b in blocks], pa.string()),
                "population": pa.array([b["population"] for b in blocks], pa.int32()),
                "housing_units": pa.array([b["housing_units"] for b in blocks], pa.int32()),
                "land_m2": pa.array([b["land_m2"] for b in blocks], pa.int64()),
                "water_m2": pa.array([b["water_m2"] for b in blocks], pa.int64()),
                "lat": pa.array([b["lat"] for b in blocks], pa.float64()),
                "lng": pa.array([b["lng"] for b in blocks], pa.float64()),
                "geometry": pa.array(list(shapely.to_wkb(points, flavor="iso")), pa.binary()),
            }
        )
        people = sum(b["population"] for b in blocks)
        self.notes.append(
            f"{len(blocks):,} census blocks in Philadelphia, {people:,} people in 2020"
        )
        log.info("%s: %s", self.id, self.notes[-1])
        write_geoparquet(table, out, ["Point"])

    def extra_checks(self, path: Path, newest) -> list[Check]:
        people = sum(
            v or 0 for v in pq.read_table(path, columns=["population"]).column(0).to_pylist()
        )
        low, high = POPULATION_RANGE
        detail = (
            f"The blocks hold {people:,} people (the 2020 census counted 1,603,797; between "
            f"{low:,} and {high:,} expected)"
        )
        return [Check("population_total", low <= people <= high, detail)]


# ---------------------------------------------------------------------------------------------
# Traffic stress for cycling

#: DVRPC's bike facility names as codes (`bf` on the map, docs/CONTRACTS.md section 4).
BIKE_FACILITIES = {
    "No Facility": 0,
    "Signed Bike Route": 1,
    "Sharrows": 2,
    "Bike Lane": 3,
    "Buffered Bike Lane": 4,
    "Protected Bike Lane": 5,
    "Multi-use Trail / Off-Road": 6,
}


class DvrpcLts(ArcgisAdapter):
    """Philadelphia's streets in DVRPC's Level of Traffic Stress network (module docstring)."""

    out_fields = (
        "objectid",
        "no",
        "fromnodeno",
        "tonodeno",
        "typeno",
        "bike_facility",
        "totnumlanes",
        "vehiclespeed",
        "lts",
        "county_code",
    )
    query_where: ClassVar[str] = "county_code = 42101"
    query_params: ClassVar[dict[str, str]] = {"geometryPrecision": "6"}
    required_columns = ("no", "lts", "bike_facility", "vehiclespeed", "totnumlanes", "geometry")

    def extra_checks(self, path: Path, newest) -> list[Check]:
        """Nearly every street has a level from 1 to 4."""
        levels = pq.read_table(path, columns=["lts"]).column("lts").to_pylist()
        rated = sum(1 for v in levels if v is not None and 1 <= v <= 4)
        detail = f"{rated:,} of {len(levels):,} street segments have a level from 1 to 4"
        return [Check("levels", rated >= 0.95 * len(levels), detail)]


# ---------------------------------------------------------------------------------------------
# Food stores that take SNAP


class SnapRetailers(ArcgisAdapter):
    """Philadelphia's stores that take SNAP: their kind and point only (module docstring)."""

    out_fields = ("ObjectId", "Store_Type")
    query_where: ClassVar[str] = "State = 'PA' AND County = 'PHILADELPHIA'"
    required_columns = ("store_type", "source_date", "geometry")

    def normalize(self, raw: RawFetch, out: Path) -> None:
        super().normalize(raw, out)
        rows = pq.read_metadata(out).num_rows
        day = _edit_day(raw)
        _with_columns(out, {"source_date": pa.array([day] * rows, pa.date32())})


__all__ = [
    "BIKE_FACILITIES",
    "GEO_HEADER_FIELDS",
    "CensusBlocks2020",
    "DvrpcLts",
    "EpaWalkability",
    "SnapRetailers",
    "geo_header_name",
    "read_blocks",
]
