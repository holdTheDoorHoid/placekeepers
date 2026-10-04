"""Shooting victims (Carto table shootings): one row per person shot.

We download only what the map needs: the date, whether the shooting was fatal, and the City's point
(already snapped to the block by the City). The City's table also holds police case numbers and each
victim's race, sex, age and wounds. Placekeepers never publishes those (docs/ETHICS.md), so it never
downloads them either: nothing can leak from a cache or a snapshot that never held them.

`fatal` is 1 or 0 (empty for about 170 older rows). Coordinates come from the geometry, falling back
to the City's point_x and point_y columns where the geometry is empty.

Verified against the live table on 2026-10-04 (17,973 rows, 2015-01-01 to 2026-10-01).
"""

from __future__ import annotations

from placekeepers.adapters.carto import CartoAdapter, Column


class Shootings(CartoAdapter):
    columns = (
        Column("objectid", "objectid", "BIGINT"),
        Column("date_", "date_", "DATE"),
        Column("fatal", "fatal", "SMALLINT"),
        Column("lat", "COALESCE(ST_Y(the_geom), point_y)", "DOUBLE"),
        Column("lng", "COALESCE(ST_X(the_geom), point_x)", "DOUBLE"),
    )
    required_columns = ("objectid", "date_", "lat", "lng")
