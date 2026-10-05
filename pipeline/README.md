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

The vacancy model needs DuckDB's spatial extension. `pk derive` installs it the first time; to
install it ahead (CI does), run
`pipeline/.venv/bin/python -c "import duckdb; duckdb.connect().install_extension('spatial')"`.

## Commands

| Command | What it does |
|---|---|
| `pk registry check` | Checks every file in `registry/`: unknown keys, missing descriptions, licenses and attributions, and every cross reference |
| `pk fetch [ids...]` | Downloads sources into the shared cache |
| `pk validate [ids...]` | Turns new downloads into snapshots, or rejects them and keeps the last good one |
| `pk derive [--as-of DATE]` | Runs the vacancy model on the current snapshots (see below) |
| `pk publish [--out DIR]` | Writes `manifest.json` and the map layers (default `build/data`) |
| `pk health [ids...]` | Shows each source's status (`--json` for machines, `--strict` to fail when any source is not ok) |
| `pk all` | Fetch and validate each source in turn, run the vacancy model, publish, then show health |

Options: `--sources a,b` limits a command to some sources, `--offline` uses only the cache,
`--force` downloads frozen and recently fetched yearly sources again, `--cache DIR` uses another
cache, `--as-of YYYY-MM-DD` sets the build date for time windows, and `-v` shows more detail.

`pk all` finishes each source (download, then check) before starting the next, in an order where
a source comes after the ones its download needs: transfers, assessments and violations wait for
the sources that define the vacancy candidate parcels. A source whose registry cadence is `frozen`
is downloaded once; a `yearly` one at most every 30 days. No download starts while less than 10 GB
of disk is free (`PK_MIN_FREE_GB`).

## Sources

Forty sources, each with an entry in `registry/sources.yaml`. Field lists and the reasons for
them are in each adapter's docstring.

| Source | Where | What we keep |
|---|---|---|
| `opa_properties` | Carto `opa_properties_public` | A chosen set of 35 columns: account number, address, owners, mailing address, last sale, value, category and building codes, zoning, exemptions, size, year built, condition notes, livable area, tract, ZIP, point |
| `pwd_parcels` | Carto `pwd_parcels` | Parcel polygons with the OPA account number (`brt_id`), address and building code |
| `vacant_indicators_land`, `vacant_indicators_bldg` | City ArcGIS | Every field, with the parcel polygon |
| `shootings` | Carto `shootings` | Only the date, whether it was fatal, and the City's block level point. Case numbers and each victim's race, sex and age are never downloaded |
| `high_injury_network` | City ArcGIS `high_injury_network_2025` | Street name, length and line |
| `real_estate_transfers` | Carto `rtt_summary`, candidate parcels | Document type and id, recording and document dates, grantors, grantees, cash and total consideration, property count |
| `assessment_history` | Carto `assessments`, candidate parcels | Value, taxable and exempt amounts for every year |
| `li_violations` | Carto `violations`: candidate parcels since 2016, and vacancy violations (code 9-3904 or a title naming vacancy) citywide for the last 26 months | Every code and status, with case, dates and point |
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
| `memorial_names` | `data/curated/memorials.yaml` (in the repository) | Checks every entry; the snapshot keeps ids, dates, modes and places, never names or memorial page links, and leaves out removed entries |
| `census_tracts_2020` | City ArcGIS `Census_Tracts_2020` (frozen) | Every field (tract id `geoid`, land and water area), with the shape |
| `tree_canopy_2018` | City ArcGIS `TreeCanopyChange_2008_2018` (frozen; about 570 MB of pages, once) | Not the 665,748 canopy polygons: square meters of canopy in 2008 and 2018 per H3 resolution 9 cell, each polygon split exactly along the cell edges |
| `septa_gtfs` | SEPTA's GTFS zip (22 MB, two feeds: bus and Metro, Regional Rail) | Not the timetables: one row per stop with its key, history and service on a typical weekday, Saturday and Sunday, one row per route with its lines, and stop ids that disappeared in the last year (see "Transit" below) |
| `septa_ridership_bus`, `septa_ridership_trolley` | SEPTA's ArcGIS stop summaries, the newest spring or fall count for each mode | Average boardings and alightings per route, direction and stop number, with the count's period and the layer used |

**Candidate parcels.** Transfers, assessments and violations are too large to download for the
whole city every week, so they come down for every parcel with any sign of vacancy (see
`candidates.py`): either City vacancy list, City owned, in LandCare, OPA vacant land or a vacant or
sealed exterior note, cleaned and sealed or demolished since 2016, on the unsafe or imminently
dangerous lists, or the subject of a vacancy complaint (VL, VA, VO or BDNO) since 2023 (84,247
parcels on 2026-10-04; the complaints added 9,392). The accounts go to Carto in chunks of 5,000, by
POST, joined as a VALUES list, and each chunk is checked against a count.

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

The City's two vacancy lists have one more rule: the City dates every record with the day it last
recalculated the list, and if that date is more than six months old while ten or more demolitions
have been recorded since, the list is no longer keeping up, so a new download is rejected and the
source shows as `stale`.

## The vacancy model

`pk derive` (and `pk all`, before publishing) runs the rules of the vacancy study
(`docs/VACANCY_METHOD.md`, adopted in `docs/DESIGN.md` section 6) on the current snapshots, in
`placekeepers/derive/vacancy.py`. For every parcel with any sign of vacancy it decides:

* the kind: a lot when no building footprint stands on it (or it was demolished with nothing built
  since), a building when one does;
* the confidence, high, medium or low, from how many independent records agree and whether any
  contradict them;
* the reasons for and against, which the map explains in plain sentences.

Parks, gardens, parking, rail, transportation, utilities, cemeteries, water and streets never show
as vacant. LandCare lots stay in, marked as maintained. The City's lists are a strong vote that is
never enough alone for high; each is used for twelve months after its own date, then dropped, and
the build notes say so. Time windows count back from the build date (`--as-of`).

The result goes to `$PK_CACHE/derived/vacancy.parquet` (one row per parcel, with its shape: the
Water Department parcel, else the City's polygon, else the assessor's point, as its `shape` column
says; a unit inside a larger parcel with no shape gets none and stays off the map) and a
summary beside it, `vacancy.json` (counts by kind and confidence, with and without the City's lists,
the lists' dates, and notes). `pk publish` builds the `parcels` layer from it; when the model has
not run, the layer shows the City's lists alone and the build notes say so. A full run takes about
a minute and stays under 2 GB of memory (`PK_DERIVE_MEMORY`).

## Lens factors

After the vacancy model, `pk derive` computes the violence reduction lens factors for every parcel
on the map, in `placekeepers/derive/lenses.py` (definitions in `docs/CONTRACTS.md` section 4 and
in each factor's `explain` in `registry/lenses.yaml`): untreated vacancy (LandCare lots and
buildings whose owner fixed the doors and windows count as treated), shootings in the last three
years within about a quarter mile, the census tract's poverty rate, and how little tree canopy
there is around the parcel. Each is a rank from 0 to 100 among the parcels on the map; a factor
without data is left out. The result goes to `$PK_CACHE/derived/lens_factors.parquet` (the
factors and the facts behind them: the hexagon, the shooting counts, the tract, its poverty rate
and the canopy share) with a summary of each factor's spread in `lens_factors.json`, and `pk
publish` adds the factors to the parcels. It takes under a minute.

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
derived/vacancy.parquet               the vacancy model's parcels (pk derive)
derived/vacancy.json                  its counts, the City lists' dates, and notes
derived/lens_factors.parquet          the lens factors per parcel and the facts behind them
derived/lens_factors.json             each factor's spread, and notes
research/                             reserved for the vacancy study; the pipeline never writes here
```

To read a source from another program, open `snapshots/<source>/current.parquet` (GeoParquet with
a `geometry` column in longitude and latitude where the source has shapes), for example with
DuckDB: `SELECT * FROM '~/.cache/placekeepers/snapshots/opa_properties/current.parquet'`.

## Published files

`pk publish` follows `docs/CONTRACTS.md`: `manifest.json`, `tiles/lots.pmtiles` (layer `parcels`),
`tiles/streets.pmtiles` (layers `hin`, `segments`, `crashes` and `memorials`),
`tiles/context.pmtiles` (layer `h3`), `tiles/care.pmtiles` (layers `landcare` and `gardens`),
`tiles/boundaries.pmtiles` (layers `council_districts`, `rcos` and `neighborhoods`) and
`tiles/transit.pmtiles` (layers `stops` and `routes`). It builds in a
hidden folder and swaps it into place at the end, and it refuses to replace a folder that is not an
earlier data root. A layer with nothing to show is left out with a note, so it never breaks the rest
of its tile file. It also writes the lot dossiers, `dossiers/<first four digits>.json` with
`dossiers/common.json`, and `tables/owners.json` (see "Lot dossiers and owner flags" below).

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
  read no memorials are published. No name or memorial page link is published until the removal
  email address exists (`REMOVAL_EMAIL` in `web/src/content/removal-email.ts`, owner decision
  2026-10-04). Both files are read from the repository at every publish, never from a cached copy,
  so a removal takes effect at once. Each crash site gets its suggestions: the
  memorial always, traffic calming on a collector or local street the State does not maintain, and
  the daylighting and asphalt art checks within 20 meters of an intersection.

The streets tiles keep every point at every zoom (tippecanoe would otherwise thin them), and carry
only deaths, serious injuries and blocks with recorded harm at low zooms.

### Transit

`adapters/septa.py` and `derive/transit.py` turn SEPTA's schedules into measures per stop when the
download is checked (about 10 seconds and under 1 GB of memory for the whole region), so the
snapshot is about 1 MB instead of 2.1 million stop times; `publish/transit.py` builds the map
layers. The method is in `docs/TRANSIT_METHOD.md`; in short:

* **Typical days**: for a weekday, a Saturday and a Sunday, the first date in the four weeks from
  the download with the most common set of running services, so holidays and events never count.
* **Measures per stop**: departures (never at a trip's last stop, nor where no one may board), the
  busiest hour, departures from 7 to 9 and from 10 to 2 (the map turns them into minutes between
  buses), first and last departure, after 8 at night, and how many hours from 1 to 4 in the
  morning have one (all three means service through the night).
* **Stable keys**: `sp` and the SEPTA stop number when first seen (`sr` for Regional Rail). A
  number that disappears passes its key to a new number within 30 meters with a similar name;
  the old number goes into the stop's history. The keys and history come from the previous good
  snapshot, so they carry on week to week; ids that vanish are remembered for a year.
* **Ridership**: each stop takes the count under its own number, then under a number in its
  history, then of a stop number no longer in the schedules within 30 meters with a similar name;
  a stop with no count gets none. The build notes give the share of bus and trolley stops with a
  count (97.8% on 2026-10-04).

The stops layer keeps places in Philadelphia (the Council districts widened by 100 meters) with
any departure on the typical days; the routes layer keeps routes that stop there.

### Lot dossiers and owner flags

`publish/dossiers.py` writes one dossier per candidate parcel and per parcel the vacancy model
shows (about 78,000; docs/CONTRACTS.md section 6), with the rules in `derive/`:

* **Owner type** (`derive/owners.py`): the City's list of public property first, then OPA's owner
  names by documented patterns (public bodies, company forms, nonprofit words, a person's name).
  The lots layer's `ot` comes from the same rules.
* **Flags** (`derive/flags.py`, with every sentence in `derive/wording.py`, word for word from
  docs/ETHICS.md where it gives wording): absentee owner (the mailing address is elsewhere; never
  for an owner on the parcel's own block), possible estate (estate words in a person's name, never
  in a company's), tax debt as of July 2025, past sheriff sales, years since the last sale on the
  open market (token deeds of $100 or less and sheriff deeds left out; the City's deed records are
  complete from 2000, the assessor's last sale fills in before), an owner holding five or more
  parcels called vacant with high or medium confidence, fast resales (two or more sales within 24
  months), open violations, unsafe and imminently dangerous buildings.
* **Transfers** (`derive/transfers.py`): every deed, newest first; mortgages are left out.
* **Routes** (`derive/routes.py`): by owner and context, the lawful route first. Conservatorship,
  with its abuse warning, only for a private parcel called vacant with high or medium confidence.

Each flag's careful note and next step are the same for every parcel, so they are written once,
in `dossiers/common.json`, not once per parcel. Files are named by the first four digits of the OPA
account, so opening one lot on a phone fetches a small file. Readers take only the columns a
snapshot has, so a source that drops a column cannot stop the publish.

## Tests

```
pipeline/.venv/bin/pytest pipeline          # unit tests, no network
pipeline/.venv/bin/pytest pipeline -m live  # a few tiny requests to the real City services, and
                                            # the vacancy model on the real cache against the study
pipeline/.venv/bin/ruff check pipeline
```

## Settings

| Variable | Meaning |
|---|---|
| `PK_CACHE` | The shared cache (default `~/.cache/placekeepers`) |
| `PK_REPO` | The repository root, if `pk` runs from outside it |
| `PK_KEEP_SNAPSHOTS` | Good snapshots kept per source (default 3) |
| `PK_DUCKDB_MEMORY`, `PK_DUCKDB_THREADS` | DuckDB limits (default 1GB and 4) |
| `PK_DERIVE_MEMORY` | DuckDB memory for the vacancy model (default 2GB) |
| `PK_TIPPECANOE` | A specific tippecanoe binary; empty means build no tiles |
| `PK_MIN_FREE_GB` | Disk space every download leaves free (default 10; the weekly refresh on GitHub, whose runners have about 14 GB, uses 3) |
