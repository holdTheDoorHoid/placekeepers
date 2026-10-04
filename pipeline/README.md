# Placekeepers pipeline

The pipeline downloads public City data, checks it, keeps the last good copy of every source, and
writes the files the map reads. If a source breaks, the map keeps showing the last good copy and
says how old it is.

## Setup

```
python3.12 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -e "pipeline[dev]"
```

Map tiles need [tippecanoe](https://github.com/felt/tippecanoe) 2.17 or newer (`sudo apt install
tippecanoe`). Without it, publish writes GeoJSON instead and says so in `manifest.json`.

## Commands

| Command | What it does |
|---|---|
| `pk registry check` | Checks every file in `registry/`: unknown keys, missing descriptions, licenses and attributions, and every cross reference |
| `pk fetch [ids...]` | Downloads sources into the shared cache |
| `pk validate [ids...]` | Turns new downloads into snapshots, or rejects them and keeps the last good one |
| `pk publish [--out DIR]` | Writes `manifest.json` and the map layers (default `build/data`) |
| `pk health [ids...]` | Shows each source's status (`--json` for machines, `--strict` to fail when any source is not ok) |
| `pk all` | Fetch, validate, publish, then show health |

Options: `--sources a,b` limits a command to some sources, `--offline` uses only the cache,
`--cache DIR` uses another cache, `--as-of YYYY-MM-DD` sets the build date for time windows, and
`-v` shows more detail.

## Sources in this milestone

| Source | Where | What we keep |
|---|---|---|
| `opa_properties` | Carto `opa_properties_public` | A chosen set of 29 columns: account number, address, owners, mailing address, last sale, value, category and building codes, zoning, exemptions, size, year built, tract, ZIP, point (listed in `adapters/opa_properties.py`) |
| `pwd_parcels` | Carto `pwd_parcels` | Parcel polygons with the OPA account number (`brt_id`), address and building code |
| `vacant_indicators_land` | City ArcGIS `Vacant_Indicators_Land` | Every field, with the parcel polygon |
| `vacant_indicators_bldg` | City ArcGIS `Vacant_Indicators_Bldg` | Every field, with the parcel polygon |
| `shootings` | Carto `shootings` | Only the date, whether it was fatal, and the City's block level point. Case numbers and each victim's race, sex and age are never downloaded |
| `high_injury_network` | City ArcGIS `high_injury_network_2025` | Street name, length and line |

Every request carries the User-Agent `Placekeepers/0.1 (+https://github.com/holdTheDoorHoid/placekeepers)`,
waits at least a second between requests to the same server, and retries busy or failed replies
with growing waits. A refusal (HTTP 401 or 403, or a request for a login) is never retried or worked
around. Large Carto tables come down in chunks of 100,000 rows ordered by `cartodb_id`; ArcGIS
layers in pages of up to 2,000 features ordered by object id.

## Health checks

Each source's rules live in `registry/sources.yaml`. A new download must have the columns its
adapter needs, at least `min_rows` rows, no more than `max_drop_pct` percent fewer rows than the last
good snapshot, and a newest record (in `newest_field`) no older than `max_age_days`. Dates after
tomorrow are ignored when finding the newest record, so a typo in the future cannot hide a source
that stopped updating.

If a download fails or breaks a rule, the last good snapshot stays in use and the source is
`stale` (or `failing` when there has never been a good one). `pk health --json` also reports
`consecutive_failures`, for the weekly workflow to open an issue after two failures in a row.

## The shared cache

Downloads and snapshots live in `$PK_CACHE` (default `~/.cache/placekeepers`), shared by every
worktree. Every file appears atomically, so other programs can read the cache while the pipeline
writes it.

```
raw/<source>/<fetch id>/              a download waiting to be checked (deleted once checked)
snapshots/<source>/<id>.parquet       snapshots, newest three good ones kept, plus one rejected
snapshots/<source>/<id>.json          what we know about each snapshot (rows, sha256, newest
                                      record, status good or rejected, every check, notes)
snapshots/<source>/current.parquet    always the last good snapshot
snapshots/<source>/state.json         the result of the latest attempt
research/                             reserved for the vacancy study; the pipeline never writes here
```

To read a source from another program, open `snapshots/<source>/current.parquet` (GeoParquet with
a `geometry` column in longitude and latitude where the source has shapes), for example with
DuckDB: `SELECT * FROM '~/.cache/placekeepers/snapshots/opa_properties/current.parquet'`.

## Published files

`pk publish` follows `docs/CONTRACTS.md`: `manifest.json`, `tiles/lots.pmtiles` (layer `parcels`),
`tiles/streets.pmtiles` (layer `hin`) and `tiles/context.pmtiles` (layer `h3`). It builds in a
hidden folder and swaps it into place at the end, and it refuses to replace a folder that is not an
earlier data root.

## Tests

```
pipeline/.venv/bin/pytest pipeline          # unit tests, no network
pipeline/.venv/bin/pytest pipeline -m live  # a few tiny requests to the real City services
pipeline/.venv/bin/ruff check pipeline
```

## Settings

| Variable | Meaning |
|---|---|
| `PK_CACHE` | The shared cache (default `~/.cache/placekeepers`) |
| `PK_REPO` | The repository root, if `pk` runs from outside it |
| `PK_KEEP_SNAPSHOTS` | Good snapshots kept per source (default 3) |
| `PK_DUCKDB_MEMORY`, `PK_DUCKDB_THREADS` | DuckDB limits (default 1GB and 4) |
| `PK_TIPPECANOE` | A specific tippecanoe binary; empty means build no tiles |
