"""Download the two outcome histories the weekly pipeline does not keep, year by year.

    ../../pipeline/.venv/bin/python fetch.py [dumping] [complaints]

* `dumping`: Philly311 illegal dumping requests (service code SR-ST02) from 2016 on. The
  pipeline's own copy (`philly311_conditions`) keeps only the last 120 days. The City's table has
  no dumping requests dated 2015 at all (checked 2026-10-21), so the history starts in 2016.
* `complaints`: L&I complaints from 2015 on. The pipeline's copy (`li_complaints`) starts in 2023.

Only the day, the kind, the parcel account (complaints) and the point are kept: no case numbers,
no addresses, no descriptions. One request per calendar year, one at a time, with the project's
User-Agent. Each becomes a parquet file in ~/.cache/placekeepers/research/didit/.
"""

from __future__ import annotations

import io
import sys

import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.parquet as pq
from common import CARTO, RAW, get

LAST_YEAR = 2026

QUERIES = {
    "dumping": (
        2016,
        (
            "SELECT requested_datetime::date AS day, ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng "
            "FROM public_cases_fc WHERE service_code = 'SR-ST02' AND the_geom IS NOT NULL "
            "AND requested_datetime >= '{y}-01-01' AND requested_datetime < '{y1}-01-01'"
        ),
    ),
    "complaints": (
        2015,
        (
            "SELECT complaintdate::date AS day, complaintcodename AS kind, opa_account_num AS opa, "
            "ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng FROM complaints "
            "WHERE the_geom IS NOT NULL "
            "AND complaintdate >= '{y}-01-01' AND complaintdate < '{y1}-01-01'"
        ),
    ),
}


def fetch(name: str) -> None:
    first, sql = QUERIES[name]
    tables = []
    for year in range(first, LAST_YEAR + 1):
        q = sql.format(y=year, y1=year + 1)
        r = get(CARTO, params={"q": q, "format": "csv"})
        table = pacsv.read_csv(
            io.BytesIO(r.content),
            convert_options=pacsv.ConvertOptions(
                column_types={"opa": pa.string(), "kind": pa.string()}
            ),
        )
        print(f"  {name} {year}: {table.num_rows:,} rows")
        tables.append(table)
    out = pa.concat_tables(tables, promote_options="default")
    pq.write_table(out, RAW / f"{name}.parquet")
    print(f"{name}: {out.num_rows:,} rows to {RAW / (name + '.parquet')}")


if __name__ == "__main__":
    for name in sys.argv[1:] or list(QUERIES):
        fetch(name)
