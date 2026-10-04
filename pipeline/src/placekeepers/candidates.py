"""The vacancy candidate parcels: every OPA account with any sign of vacancy.

Real estate transfers, assessment history and L&I violations are too large to download for the
whole city every week, so they are fetched for these parcels only. The set is deliberately broad,
so the vacancy model (milestone M1.2) can apply its rules without new downloads:

* on either City vacancy indicator list;
* owned by the City, the Land Bank, the Redevelopment Authority or PHDC;
* in PHS LandCare;
* classed by OPA as vacant land (category 6, 12 or 13), or noted by the assessor as having a
  vacant or sealed exterior (exterior condition 6 or 7);
* cleaned and sealed by the City, or demolished, since 2016;
* on the City's unsafe or imminently dangerous building lists.

Each part comes from that source's current good snapshot. A source with no snapshot yet is
skipped and named in `missing`.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from placekeepers.context import Context
from placekeepers.snapshots import SnapshotStore
from placekeepers.sql import quote_literal

log = logging.getLogger(__name__)

SINCE = "2016-01-01"

# For each source: the column holding the OPA account, the condition a row must meet (None for every
# row), and further conditions that also qualify a row when the snapshot has their column.
SIGNALS: dict[str, tuple[str, str | None, dict[str, str]]] = {
    "vacant_indicators_land": ("opa_id", None, {}),
    "vacant_indicators_bldg": ("opa_id", None, {}),
    "city_owned_property": ("opabrt", None, {}),
    "phs_landcare": ("brt_id", None, {}),
    "opa_properties": (
        "parcel_number",
        "category_code IN ('6', '12', '13')",
        {"exterior_condition": "exterior_condition IN ('6', '7')"},
    ),
    "li_clean_and_seal": ("opa_account_num", f"casecreateddate >= DATE '{SINCE}'", {}),
    "li_demolitions": (
        "opa_account_num",
        f"coalesce(start_date, completed_date) >= DATE '{SINCE}'",
        {},
    ),
    "li_unsafe": ("opa_account_num", None, {}),
    "li_imminently_dangerous": ("opa_account_num", None, {}),
}
CANDIDATE_SOURCES = tuple(SIGNALS)

# An OPA account: 9 digits. Some sources add spaces or a second account ("121099030/9130"), and a
# few drop the leading zero, so the first run of 8 or 9 digits is taken and padded to 9.
DIGITS = "regexp_extract(CAST(account AS VARCHAR), '[0-9]{8,9}')"
NORMALIZE = f"lpad({DIGITS}, 9, '0')"
VALID = f"{DIGITS} <> ''"


@dataclass
class Candidates:
    accounts: list[str]
    by_source: dict[str, int] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)


def current_snapshot(ctx: Context, source_id: str) -> Path | None:
    store = SnapshotStore(ctx.cache, source_id)
    meta = store.current()
    return store.path_for(meta) if meta else None


def candidate_accounts(ctx: Context) -> Candidates:
    con = ctx.duckdb()
    parts: list[str] = []
    result = Candidates(accounts=[])
    try:
        for source_id, (account_column, condition, optional) in SIGNALS.items():
            path = current_snapshot(ctx, source_id)
            if path is None:
                result.missing.append(source_id)
                continue
            snapshot = f"read_parquet({quote_literal(str(path))})"
            columns = {
                row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {snapshot}").fetchall()
            }
            conditions = [condition] if condition else []
            conditions += [extra for column, extra in optional.items() if column in columns]
            query = f"SELECT {account_column} AS account FROM {snapshot}"
            if conditions:
                query += " WHERE " + " OR ".join(f"({c})" for c in conditions)
            count = con.execute(
                f"SELECT count(DISTINCT {NORMALIZE}) FROM ({query}) WHERE {VALID}"
            ).fetchone()[0]
            result.by_source[source_id] = int(count)
            parts.append(f"SELECT {NORMALIZE} AS account FROM ({query}) WHERE {VALID}")
        if parts:
            union = " UNION ".join(parts)
            rows = con.execute(
                f"SELECT DISTINCT account FROM ({union}) ORDER BY account"
            ).fetchall()
            result.accounts = [row[0] for row in rows]
    finally:
        con.close()
    if result.missing:
        log.warning("candidates: no snapshot yet for %s", ", ".join(result.missing))
    log.info("candidates: %s parcels with a sign of vacancy", f"{len(result.accounts):,}")
    return result
