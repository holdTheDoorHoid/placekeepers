"""Small stand ins for the walkability sources (M3.3): a redistricting file with a few blocks."""

from __future__ import annotations

import io
import zipfile

from placekeepers.adapters.walk import GEO_HEADER_FIELDS

#: Three blocks of Philadelphia and one of another county, with the 2020 count of the city split
#: between the three, so the population check passes.
BLOCKS = (
    # (state, county, tract, block, population, housing units, land, water, lat, lng)
    ("42", "101", "000100", "1000", 900_000, 400_000, 9_700, 0, "+39.9518920", "-075.1550530"),
    ("42", "101", "000100", "1001", 703_797, 300_000, 12_400, 300, "+39.9526000", "-075.1635000"),
    ("42", "101", "980300", "1000", 0, 0, 2_500_000, 0, "+39.8800000", "-075.2400000"),
    ("42", "091", "200100", "1000", 120, 50, 5_000, 0, "+40.1000000", "-75.3000000"),
)


def geo_line(**fields: str) -> str:
    """One line of the geographic header, every field empty but those given."""
    values = {name: "" for name in GEO_HEADER_FIELDS}
    values.update(fields)
    return "|".join(values[name] for name in GEO_HEADER_FIELDS)


def geo_header(blocks=BLOCKS) -> str:
    """A geographic header with a state line, a county line and a line per block (summary
    level 750), as the Census Bureau writes them."""
    lines = [
        geo_line(FILEID="PLST", STUSAB="PA", SUMLEV="040", STATE="42", POP100="13002700"),
        geo_line(FILEID="PLST", STUSAB="PA", SUMLEV="050", STATE="42", COUNTY="101",
                 POP100="1603797", NAME="Philadelphia County"),
    ]  # fmt: skip
    for state, county, tract, block, people, homes, land, water, lat, lng in blocks:
        lines.append(
            geo_line(
                FILEID="PLST",
                STUSAB="PA",
                SUMLEV="750",
                GEOCOMP="00",
                GEOID=f"7500000US{state}{county}{tract}{block}",
                GEOCODE=f"{state}{county}{tract}{block}",
                STATE=state,
                COUNTY=county,
                TRACT=tract,
                BLKGRP=block[0],
                BLOCK=block,
                AREALAND=str(land),
                AREAWATR=str(water),
                NAME=f"Block {block}, Ciudad Montréal",  # a Latin 1 character, as in real names
                POP100=str(people),
                HU100=str(homes),
                INTPTLAT=lat,
                INTPTLON=lng,
            )
        )
    return "\r\n".join(lines) + "\r\n"


def redistricting_zip(blocks=BLOCKS, header: str | None = None) -> bytes:
    """A redistricting zip for Pennsylvania: the geographic header and an empty data segment."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("pageo2020.pl", (header or geo_header(blocks)).encode("latin-1"))
        archive.writestr("pa000012020.pl", "")
    return buffer.getvalue()
