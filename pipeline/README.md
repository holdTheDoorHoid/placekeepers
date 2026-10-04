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
| `pk all` | Fetch and validate each source in turn, publish, then show health |

Options: `--sources a,b` limits a command to some sources, `--offline` uses only the cache,
`--force` downloads frozen and recently fetched yearly sources again, `--cache DIR` uses another
cache, `--as-of YYYY-MM-DD` sets the build date for time windows, and `-v` shows more detail.

`pk all` finishes each source (download, then check) before starting the next, in an order where
a source comes after the ones its download needs: transfers, assessments and violations wait for
the sources that define the vacancy candidate parcels. A source whose registry cadence is `frozen`
is downloaded once; a `yearly` one at most every 30 days. No download starts while less than 10 GB
of disk is free (`PK_MIN_FREE_GB`).

## Sources

Thirty five sources, each with an entry in `registry/sources.yaml`. Field lists and the reasons
for them are in each adapter's docstring.

| Source | Where | What we keep |
|---|---|---|
| `opa_properties` | Carto `opa_properties_public` | A chosen set of 35 columns: account number, address, owners, mailing address, last sale, value, category and building codes, zoning, exemptions, size, year built, condition notes, livable area, tract, ZIP, point |
| `pwd_parcels` | Carto `pwd_parcels` | Parcel polygons with the OPA account number (`brt_id`), address and building code |
| `vacant_indicators_land`, `vacant_indicators_bldg` | City ArcGIS | Every field, with the parcel polygon |
| `shootings` | Carto `shootings` | Only the date, whether it was fatal, and the City's block level point. Case numbers and each victim's race, sex and age are never downloaded |
| `high_injury_network` | City ArcGIS `high_injury_network_2025` | Street name, length and line |
| `real_estate_transfers` | Carto `rtt_summary`, candidate parcels | Document type and id, recording and document dates, grantors, grantees, cash and total consideration, property count |
| `assessment_history` | Carto `assessments`, candidate parcels | Value, taxable and exempt amounts for every year |
| `li_violations` | Carto `violations`, candidate parcels, since 2016 | Every code and status, with case, dates and point |
| `li_complaints` | Carto `complaints`, citywide, since 2023 | Code, dates, status, account and point |
| `li_permits` | Carto `permits`, citywide, since 2016 | Number, account, type, work, issue and completion dates, status |
| `li_unsafe`, `li_imminently_dangerous`, `li_clean_and_seal`, `li_demolitions` | Carto `unsafe`, `imm_dang`, `clean_seal`, `demolitions` | The whole tables, without owner, applicant or contractor names |
| `building_footprints`, `land_use` | ArcGIS Hub bulk GeoJSON | Footprints with building and parcel ids; land use codes at three levels; the file's date |
| `city_owned_property` | City ArcGIS `LAMAAssets` | Agency, status, side yard eligibility, OPA account |
| `phs_landcare` | City ArcGIS `phs_landcare` | Program, year joined, OPA account |
| `gardens_phs_ngt` | PHS ArcGIS `PHS_NGT_Supported_Current_view` | Name, who supports it, website |
| `gardens_registered` | City ArcGIS `Registered_Community_Gardens` | Name, park, address, website, status (never contact emails) |
| `ppr_properties`, `zoning_base_districts`, `council_districts` | City ArcGIS | Every field, with the shape |
| `community_organizations` | City ArcGIS `Zoning_RCO` | Name, type, website, registration dates (never contact people) |
| `neighborhoods` | OpenDataPhilly GitHub (Abaca Labs, CC BY 4.0) | Names and boundaries |
| `acs_poverty` | Census Bureau bulk table B17001, 2020 to 2024 | People below the poverty line per tract, with margins of error |
| `cagp_tax_2025` | Clean & Green Philly's July 2025 snapshot (frozen) | OPA account and tax fields only, dated 2025-07-09 |
| `crashes_2020_2024`, `crashes_2016_2020`, `crashes_2007_2017` | City ArcGIS copies of PennDOT's crash records, in five year slices (only 2015 from the oldest) | Crash record number, year and month, worst injury, people killed, seriously injured and injured, and how many people walking, cycling or on motorcycles were involved, killed or seriously injured, with the point. The slices name their fields differently; each adapter writes the same columns |
| `fatal_crashes` | Carto `fatal_crashes` | One row per person killed: the date, the two units involved (free text), the street and cross street, the point. Case numbers, age, sex, narratives and arrest details are never downloaded |
| `schools` | City ArcGIS `Schools` | Name, address, grades, type, point |
| `street_centerlines` | City ArcGIS `Street_Centerline` | Segment id, street name, class, who maintains it, direction, length, end nodes, line |
| `memorial_names` | `data/curated/memorials.yaml` (in the repository) | Checks every entry; the snapshot keeps ids, dates, modes, places and source links, never names |

**Candidate parcels.** Transfers, assessments and violations are too large to download for the
whole city every week, so they come down for every parcel with any sign of vacancy (see
`candidates.py`): either City vacancy list, City owned, in LandCare, OPA vacant land or a vacant or
sealed exterior note, cleaned and sealed or demolished since 2016, or on the unsafe or imminently
dangerous lists. The accounts go to Carto in chunks of 5,000, by POST, joined as a VALUES list, and
each chunk is checked against a count.

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
`tiles/streets.pmtiles` (layers `hin`, `segments`, `crashes` and `memorials`),
`tiles/context.pmtiles` (layer `h3`), `tiles/care.pmtiles` (layers `landcare` and `gardens`) and
`tiles/boundaries.pmtiles` (layers `council_districts`, `rcos` and `neighborhoods`). It builds in a
hidden folder and swaps it into place at the end, and it refuses to replace a folder that is not an
earlier data root. A layer with nothing to show is left out with a note, so it never breaks the rest
of its tile file.

### Street safety and memorials

`publish/streets.py` builds the street layers from the snapshots, with the rules in
`derive/street_safety.py` and `derive/memorials.py`:

* **Crashes**: every PennDOT crash from 2015 on, once. Each year comes from the newest slice that
  covers it, because later slices revise earlier years. Severity and who was involved are coded as
  in the contract.
* **Blocks**: every street centerline segment that carries traffic gets the street safety lens
  factors. A crash within 10 meters of an intersection counts for every block meeting there; any
  other crash counts for the nearest block within 30 meters (60 for the Police points). On the High
  Injury Network means at least half of the block lies within 12 meters of the network's lines.
* **Memorials**: one marker per person in the Police records, with an id built from the date and
  place. Names come only from `data/curated/memorials.yaml` and are joined by marker id or by date
  and place; anything in `data/curated/suppressed.yaml` never appears, and if that file cannot be
  read no memorials are published. Both files are read from the repository at every publish, never
  from a cached copy, so a removal takes effect at once. Each crash site gets its suggestions: the
  memorial always, traffic calming on a collector or local street the State does not maintain, and
  the daylighting and asphalt art checks within 20 meters of an intersection.

The streets tiles keep every point at every zoom (tippecanoe would otherwise thin them), and carry
only deaths, serious injuries and blocks with recorded harm at low zooms.

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
| `PK_MIN_FREE_GB` | Disk space every download leaves free (default 10; the weekly refresh on GitHub, whose runners have about 14 GB, uses 3) |
