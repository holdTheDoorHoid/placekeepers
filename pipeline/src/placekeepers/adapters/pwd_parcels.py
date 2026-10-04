"""Water Department parcels (Carto table pwd_parcels): the shape of every parcel.

Each polygon carries `brt_id`, the OPA account number of the property on it, which is how parcels
join to OPA records. About 1,400 parcels have no account number; a few hold several accounts
(`num_brt`). Stored as GeoParquet with the polygon in longitude and latitude.

Verified against the live table on 2026-10-04 (547,410 rows, MultiPolygon geometry).
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAdapter, Column


class PwdParcels(CartoAdapter):
    columns = (
        Column("parcelid", "parcelid", "BIGINT"),
        Column("brt_id", "brt_id", "VARCHAR"),
        Column("pin", "pin", "BIGINT"),
        Column("address", "address", "VARCHAR"),
        Column("bldg_code", "bldg_code", "VARCHAR"),
        Column("bldg_desc", "bldg_desc", "VARCHAR"),
        Column("num_brt", "num_brt", "INTEGER"),
        Column("num_accounts", "num_accounts", "INTEGER"),
        Column("gross_area", "gross_area", "DOUBLE"),
        Column("geometry", "encode(ST_AsBinary(the_geom), 'hex')", "WKB"),
    )
    required_columns = ("parcelid", "brt_id", "address", "geometry")
