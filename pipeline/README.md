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
| `pk derive [--as-of DATE]` | Runs the vacancy model on the current snapshots, then the lens factors, the walking measures, the placemaking lens and the displacement watch (see below) |
| `pk publish [--out DIR]` | Writes `manifest.json` and the map layers (default `build/data`) |
| `pk health [ids...]` | Shows each source's status (`--json` for machines, `--strict` to fail when any source is not ok) |
| `pk all` | Fetch and validate each source in turn, run the vacancy model, publish, then show health |

Options: `--sources a,b` limits a command to some sources, `--offline` uses only the cache,
`--force` downloads frozen and recently fetched yearly sources again, `--cache DIR` uses another
cache, `--as-of YYYY-MM-DD` sets the build date for time windows, and `-v` shows more detail.

`pk all` finishes each source (download, then check) before starting the next, in an order where
a source comes after the ones its download needs: transfers, assessments and violations wait for
the sources that define the vacancy candidate parcels. A source whose registry cadence is `frozen`
is downloaded once (picture services, endpoint kind `arcgis_tiles`, download nothing: every run
only checks that each service still answers, whatever its cadence); a `yearly` one at most every
30 days; the OpenStreetMap extract at most every
six days, as Geofabrik asks (its adapter's `min_refetch`; `--force` overrides all three). A
snapshot made with other registry settings than today's (its sidecar's `recipe`, such as the
extract's tag list, missing in snapshots made before 2026-10-05) is downloaded again on the next
run whatever its age, so a tag added to the registry never waits six days. No download starts
while less than 10 GB of disk is free (`PK_MIN_FREE_GB`).

## Sources

Every source the pipeline collects has an entry in `registry/sources.yaml` (the base map's source
is listed too, but the site makes the base map, so the pipeline never fetches it). Field lists and
the reasons for them are in each adapter's docstring. The table names the main ones; M3.5 added
the City's public places and 311 conditions (`adapters/city_places.py`, `adapters/philly311.py`).

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
| `street_trees` | City ArcGIS `ppr_tree_inventory_2025`, or a newer yearly layer when the City publishes one (each run lists the City's services) | Every tree Parks and Recreation keeps on its streets and in its parks: species, trunk diameter in inches, the inventory year and the point, with the layer's name and last edit day. 151,726 trees on 2026-10-05, downloaded in 76 pages in 81 seconds |
| `fema_floodplain` | City ArcGIS `fema_floodplain_2023`, only FEMA's 1 percent annual chance floodplain and 0.2 percent annual chance area | Zone, subtype (the floodway), whether it is FEMA's special flood hazard area, the map's ids, the shape and the layer's last edit day. 883 areas on 2026-10-05, downloaded in 7 seconds |
| `septa_gtfs` | SEPTA's GTFS zip (22 MB, two feeds: bus and Metro, Regional Rail) | Not the timetables: one row per stop with its key, history and service on a typical weekday, Saturday and Sunday, one row per route with its lines, and stop ids that disappeared in the last year (see "Transit" below) |
| `septa_ridership_bus`, `septa_ridership_trolley` | SEPTA's ArcGIS stop summaries, the newest spring or fall count for each mode | Average boardings and alightings per route, direction and stop number, with the count's period and the layer used |
| `osm_philadelphia` | Geofabrik's Pennsylvania extract of OpenStreetMap (`.osm.pbf`, about 350 MB, weekly; read with DuckDB's `ST_ReadOSM`) | Not the extract: the nodes and ways with a tag the registry lists (`endpoint.tags`) inside the city limits (the 2020 census tracts joined) and 200 meters around them, with all their tags (JSON), shape, a point on each, whether that point is in the city, and the extract's date. 3,338 rows on 2026-10-04. Most of its stops must lie inside the city |
| `heat_vulnerability` | City ArcGIS `heat_vulnerability_ct` (by the Department of Public Health and the Office of Sustainability) | Every 2010 census tract with its heat exposure, heat sensitivity and heat vulnerability scores (data of 2017 to 2019), with the shape; 384 tracts |
| `percent_for_art` | City ArcGIS `Percent_for_Art_Public` (the OpenDataPhilly "Percent for Art Locations", the same list as Carto `percent_for_art_public`) | Every work with its number, status, title, artist, year, medium, where it is in words, the City's document about it, the parcel it stands on and the layer's last edit day; not its Street View links. 239 works on 2026-10-05, in 2.3 seconds |
| `wikidata_art` | Wikidata's query service, one small query a week (endpoint kind `sparql`) | Artworks of a fixed list of art classes with a coordinate in a box around the city: label, classes, point, year made, creators, what it commemorates and whether that is a person, English Wikipedia article, linked pages, whether it is gone, and whether it lies inside the city. 72 items on 2026-10-05, 69 inside the city, in under 5 seconds |
| `epa_walkability` | The EPA's ArcGIS Online feature service of the Smart Location Database (version 3, 2021), Philadelphia's block groups only | Each block group's National Walkability Index (1 to 20), its four ranked parts and their raw values, with the shape; 1,336 block groups in one page |
| `census_blocks_2020` | The Census Bureau's 2020 redistricting file for Pennsylvania (`pa2020.pl.zip`, 57 MB, no key; frozen) | Only its geographic header is read: Philadelphia's 17,554 blocks with their population, housing units, land and water area, and a point inside each |
| `dvrpc_lts` | DVRPC's ArcGIS service `transportation/lts_network`, Philadelphia's rows only | Each street link's level of traffic stress for cycling (1 to 4), bike facility, lanes and speed, with the line, one row per direction; 60,867 rows in 31 pages |
| `snap_retailers` | The USDA's ArcGIS layer of stores that take SNAP, Philadelphia's only | Each store's kind and point, never its name or address; 1,460 stores |
| `commercial_corridors` | City ArcGIS `Commercial_Corridors` (OpenDataPhilly "Commercial Corridors of Philadelphia"), in pages of 100 | Each corridor's name, survey year and kind, with its shape; not its store counts, vacancy rates or funding. 279 corridors on 2026-10-08, in 4.2 seconds |
| `real_estate_sales` | Carto `rtt_summary`, every deed with a price over $100 from the last nine years, citywide (M4.1) | Document id and type, the date on the deed, the OPA account, the total and adjusted price, the property count and the buyers' type (company, person, public body, nonprofit or unknown). Buyers' names are read only to make that type and are never kept; sellers' names and addresses are never downloaded |
| `assessment_values` | Carto `assessments`, citywide, the newest tax year with values for most parcels and the year five before it, found when the download starts (M4.1) | Parcel, year, market value |
| `acs_tenure` | Census Bureau bulk table B25003, 2020 to 2024 (M4.1) | Occupied, owner occupied and renter occupied homes per tract, with margins of error, and the renter share |
| `market_value_analysis` | City ArcGIS `mva_2026`, Reinvestment Fund's Market Value Analysis for the City (M4.1; the adapter reads the 2023 edition's fields too) | Block group, market type, displacement pressure as published and in one word, households, shape |
| `historic_districts`, `historic_sites` | City ArcGIS `HistoricDistricts_Local` and `Historic_sites_PhilReg` (M4.6; never OpenDataPhilly's older Carto copies) | Each district's name and designation date (also as the Commission's text); each property on the Register with its address, the dates it was listed, its district and the parcel shape |
| `zoning_overlays` | City ArcGIS `Zoning_Overlays` (M4.6) | Each overlay's name, symbol, type, Zoning Code section and link, sunset date, pending bill and shape |
| `appeals` | Carto `appeals`, the whole table (M4.6) | Each appeal's number (to list it once; never published), board, kind, status, decision, filing, hearing and decision times, the community organization notified, who filed it and the owner named, the OPA account, address and point. Never the grounds, the proviso or related permit and case numbers. Names reach only the lot's own dossier record (docs/ETHICS.md) |
| `epa_brownfields` | The EPA's facility registry map service `OEI/FRS_INTERESTS`, layer 0 (ACRES), Philadelphia only (M4.6; endpoint `server: MapServer`, asked again when the EPA's server says "Service not found") | Registry id, site name and address, post code, how precise the point is, the last report day, the point |
| `li_history` | Carto, six L&I tables (violations, permits, demolitions, unsafe, imminently dangerous, clean and seal), every record of the candidate parcels, all years (M4.2) | Each record's kind, day, the City's title, status and one plain detail; never a case, permit or violation number, an inspector, an applicant or a contractor |
| `cagp_vacant_land_2024`, `cagp_vacant_buildings_2024` | Clean & Green Philly's copies of the June 2024 vacancy lists (frozen, M4.2) | Parcel numbers and the list's date only |
| `land_conveyances` | Carto `rtt_summary`, deeds since 2014 naming a City land agency among the sellers, and each named property's own deeds (M4.4) | Each deed's kind of conveyance, agency, the buyers' type, whether a buyer owns the parcel next door, follow ups, price and point; the names are read to decide these and never kept |
| `land_conveyed_by_fy` | City ArcGIS `LMDashboard_PropertiesConveyedbyFY` (frozen, M4.4) | The City's own counts by program and fiscal year, 2017 to 2023 |
| `bus_shelters`, `street_poles`, `traffic_calming`, `crossing_guards` | City ArcGIS `bus_transit_shelters`, `Street_Poles`, `traffic_calming_devices`, `School_Crossing_Guards` (M4.5) | Each shelter's site id, SEPTA stop number and screen kind; each pole's number, owner and the lamp the City lists; each device's kind, street block and day installed; each guard post's point |
| `city_aerial_photos`, `dvrpc_aerial_photos`, `usgs_aerial_photos_1999`, `city_atlas_1860` | Picture services on the City's ArcGIS tile server (`arcgis_tiles`, M4.3) | Nothing: the visitor's browser loads the pictures; the pipeline only checks that each service answers |
| `mapping_inequality_1937` | Mapping Inequality's GeoJSON of the 1937 map of Philadelphia (frozen, M4.3) | Each area's label, grade and shape, under CC BY-NC 2.5, published in a file of its own; never the area descriptions |
| `acs_rent_burden`, `acs_rent`, `acs_income`, `acs_occupancy`, `acs_vacancy` | Census Bureau bulk tables B25070, B25064, B19013, B25002 and B25004, 2020 to 2024 (M4.7) | Counts and medians per tract and for the city, with margins of error |
| `warming_cooling_sites`, `ppr_playgrounds` | City ArcGIS `Warming_Cooling_Sites_PUBLICVIEW` and `PPR_Playgrounds` (M4.7) | Each site as listed (status, hours, services, access), credited nowhere on the map as the owner decided; each playground's park, ages and year installed |
| `pba_laser` | Philly Bike Action's Laser Vision map data (`bikeaction.org/tools/laser/map_data/`), once a week, one request per kind of report for the trailing 12 months, with Philly Bike Action's permission (issue #37) | Each report's H3 cell at resolution 10 and its kind, never its point, with the window's first and last day. 26,060 reports on 2026-10-08, in 33 seconds |

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

### The heat and shade lens

`pk derive` then computes the heat and shade lens factors for the same parcels, in
`placekeepers/derive/heat.py` (definitions in `docs/CONTRACTS.md` section 4, the method in
`docs/DESIGN.md` section 5.3): the heat vulnerability of the parcel's tract from the City's Heat
Vulnerability Index (`heat_vulnerability`), the City's trees within 100 meters of the parcel
(`street_trees`), and residents per square kilometer of land in its 2020 tract (`acs_poverty` over
`census_tracts_2020`). The lens also uses the violence lens's `f_canopy`, computed once. The
floodplain (`fema_floodplain`) is never a factor: a parcel gets `fp` when at least a tenth of it
lies in FEMA's flood areas, and the lot page says so beside the score. The step also decides each
vacant lot's heat suggestions (plant shade trees where the canopy is low, green the lot to cool the
block where heat hits hardest), which the lots layer and the lot dossiers both list. The result
goes to `$PK_CACHE/derived/heat_factors.parquet` (the factors, `fp`, the suggestions and the facts
behind them: the tract and its three heat scores, the tree count, the 2020 tract, the residents per
square kilometer and the share of the parcel in each flood area) with a summary in
`heat_factors.json`. It takes about 10 seconds for 58,325 parcels.

### The walking measures

`pk derive` then measures what lies within a short walk of the same parcels, in
`placekeepers/derive/walk.py` (definitions in `docs/CONTRACTS.md` section 4, the method in
`docs/DESIGN.md` section 5.9): the people within a 5 minute walk (the 2020 census blocks whose
point lies within 400 meters), the kinds of everyday places within a 10 minute walk (seven kinds
within 800 meters: libraries, recreation centers, pools and spraygrounds, park drinking fountains,
schools, grocery stores and markets that take SNAP, and SEPTA stops), the street corners within a
5 minute walk (from the City's centerlines) and the EPA's walkability index of the block group.
Distances are straight lines, never routes along the streets. The result goes to
`$PK_CACHE/derived/walk_factors.parquet` (the factors `f_walk`, `f_neighbors`, `f_dest` and
`f_corners`, and the counts behind them) with a summary in `walk_factors.json`; the lots carry the
first three for the placemaking lens (M3.4). It takes about 5 seconds and 450 MB for 58,325
parcels. Publish measures the walking distance hexagons the same way.

### The placemaking lens

`pk derive` then computes the placemaking lens's own factors and suggestions for the same parcels,
in `placekeepers/derive/placemaking.py` (definitions in `docs/CONTRACTS.md` section 4, the method
in `docs/DESIGN.md` section 5.3): the straight line distance to the nearest park land of Parks and
Recreation (`f_park`) and to the nearest outdoor work on the City's Percent for Art list or in
Wikidata (`f_art`; never OpenStreetMap's), each ranked so farther ranks higher and rounded to the
nearest 5, and whether the parcel is on or within 50 meters of a City commercial corridor
(`f_corr`). It then decides the lots' placemaking suggestions, with the walking measures'
`f_neighbors` and the open 311 requests on the street blocks each lot faces, counted as the
conditions layers count them. The result goes to `$PK_CACHE/derived/placemaking_factors.parquet`
with a summary in `placemaking_factors.json`. It takes about 13 seconds and 450 MB for 58,325
parcels.

## The displacement watch

`pk derive` (and `pk all`) then measures the displacement watch for every 2020 census tract, in
`placekeepers/derive/displacement.py` (M4.1; the method in plain words is in `docs/DESIGN.md`
section 5.3, the files in `docs/CONTRACTS.md` sections 3, 4 and 6). It needs no vacancy model, so
it runs even when the model fails. Five signs per tract, each against the whole city: home sale
prices (the middle price of home sales in the last three years against the three years ending five
years before, from `real_estate_sales` joined to OPA's category, year built and point), buyers that
are companies (the same sales), assessed values (each home's change between the two tax years of
`assessment_values`), renters (`acs_tenure`) and the Market Value Analysis's rising pressure
(`market_value_analysis`). A tract with two signs, one about prices, is a watch area. The result
goes to `$PK_CACHE/derived/displacement.parquet` (one row per tract with every measure, its signs
and whether it is in the watch) with a summary in `displacement.json` (the periods, the city's own
measures, the thresholds, the counts and notes). `pk publish` draws the watch areas
(`tiles/displacement.pmtiles`), adds `dw` to the lots and bus stops inside them and `displacement`
to their lot dossiers, and puts the summary in the manifest. It takes about 15 seconds.

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
derived/heat_factors.parquet          the heat and shade lens factors per parcel and the facts behind them
derived/heat_factors.json             each factor's spread, the floodplain and suggestion counts, and notes
derived/walk_factors.parquet          the walking factors per parcel and the counts behind them
derived/walk_factors.json             each factor's spread, the places of each kind, and notes
derived/placemaking_factors.parquet   the placemaking lens factors and suggestions per parcel and the facts behind them
derived/placemaking_factors.json      each factor's spread, its inputs, the suggestion counts, and notes
derived/displacement.parquet          the displacement watch's measures and signs per census tract
derived/displacement.json             its periods, the city's measures, thresholds, counts and notes
research/                             reserved for the vacancy study; the pipeline never writes here
```

To read a source from another program, open `snapshots/<source>/current.parquet` (GeoParquet with
a `geometry` column in longitude and latitude where the source has shapes), for example with
DuckDB: `SELECT * FROM '~/.cache/placekeepers/snapshots/opa_properties/current.parquet'`.

## Published files

`pk publish` follows `docs/CONTRACTS.md`: `manifest.json`, `tiles/lots.pmtiles` (layer `parcels`),
`tiles/streets.pmtiles` (layers `hin`, `segments`, `crashes`, `memorials`, `calming` and `guards`),
`tiles/context.pmtiles` (layer `h3`), `tiles/care.pmtiles` (layers `landcare` and `gardens`),
`tiles/boundaries.pmtiles` (layers `council_districts`, `rcos` and `neighborhoods`),
`tiles/transit.pmtiles` (layers `stops`, `routes` and `shelters`), `tiles/amenities.pmtiles` (layers `stops`,
`benches`, `picnic_tables`, `water`, `toilets` and `bookcases`), `tiles/environment.pmtiles` (layers
`heat_tracts` and `floodplain`), `tiles/trees.pmtiles` (layer `trees`, zoom 14 only),
`tiles/places.pmtiles` (layers `park_water`, `libraries`, `recreation`, `pools`, `cooling` and
`playgrounds`),
`tiles/conditions.pmtiles` (layers `dumping`, `lights` and `graffiti`), `tiles/art.pmtiles` (layer
`art`), `tiles/walk.pmtiles` (layers `block_groups` and `cells`), `tiles/cycling.pmtiles` (layer
`stress`), `tiles/displacement.pmtiles` (layer `watch`), `tiles/parking.pmtiles` (layer
`parking`), `tiles/poles.pmtiles` (layer `poles`, zoom 15 only), `tiles/rules.pmtiles` (layers
`historic_districts`, `historic_sites`, `overlays`, `hearings` and `brownfields`) and
`tiles/redlining.pmtiles` (layer `holc`, under its own non commercial license, named in the
manifest). It builds in a
hidden folder and swaps it into place at the end, and it refuses to replace a folder that is not an
earlier data root. A layer with nothing to show is left out with a note, so it never breaks the rest
of its tile file. It also writes the lot dossiers, `dossiers/<first four digits>.json` with
`dossiers/common.json`, the lot timeline's history shards, `dossiers/history/<first four
digits>.json` (M4.2), `tables/owners.json` (see "Lot dossiers and owner flags" below),
`tables/land_bank.json` for the page "The Land Bank in numbers" (M4.4), and the route survey sheets, `tables/routes/<route id>.json` with `tables/routes/index.json` (see "Route
survey sheets" below).

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

**The transit comfort lens** (M2.3, `derive/transit_comfort.py`) adds to every bus and trolley stop:

* **What riders find**: the OpenStreetMap stop that is the same stop (`match_septa` in
  `derive/bus_stops.py`, as for the route survey sheets: by number, then by distance, both within
  15 meters), with its shelter, bench and light answers. A stop OpenStreetMap does not have, or has
  without answers, is not yet surveyed, never "missing".
* **Factors** from 0 to 100 among the stops: riders (SEPTA's count), no shelter and no bench (100 no,
  0 yes, 50 not yet surveyed), little canopy in the stop's H3 cell (`tree_canopy_2018`, with
  `census_tracts_2020` and `land_use` for the land), the tract's heat exposure (`heat_vulnerability`),
  the High Injury Network within 30 meters, and the midday wait. Without a source, its factor is
  left out.
* **Suggestions** (`sg`): survey the stop, ask for a shelter, ask for a bench, report a dark
  streetlight, plant shade trees, each by a rule in the module. The build notes give the match
  counts, the surveyed counts and each suggestion's count.

### Shelters and benches at stops

`publish/amenities.py` builds the `stops` layer of `tiles/amenities.pmtiles` from the
`osm_philadelphia` snapshot, with the rules in `derive/bus_stops.py` (docs/CONTRACTS.md section 4).
These are OpenStreetMap's stops, a separate layer from SEPTA's, which M2.3 joins to them (above). The rules:

* **Stops**: `highway=bus_stop` (not a stop position in the road) and platforms for buses,
  trolleybuses and trolleys; station platforms of trains and subways, platforms underground or
  indoors, and private stops are left out. Only stops inside the city are published.
* **Answers**: shelter, bench, waste basket, lit, tactile paving, wheelchair, departures board and
  covered, each read as yes, no or unknown.
* **Shelters and benches drawn on their own** count for the nearest stop within 10 meters, only
  when that stop has no answer of its own.
* **What the map shows**: a shelter or roof, a bench but no shelter mapped, neither, or not yet
  surveyed. The build notes give the counts.

The layer is under the Open Database License, credited "© OpenStreetMap contributors". Later
milestones (M3.5) add more amenities from OpenStreetMap to the same file.

### Amenities, public places and 311 conditions (M3.5)

* **Amenities from OpenStreetMap** (`derive/amenities.py`, `publish/amenities.py`): benches, picnic
  tables, drinking water, public toilets and public bookcases, one layer each, from the same weekly
  extract as the stops (their tags joined the registry's list). Only elements inside the city and
  open to the public; each answer is yes, no or left out when OpenStreetMap does not say.
* **Public places from the City** (`adapters/city_places.py`, `publish/city_places.py`): Free
  Library locations, Parks and Recreation's program sites (recreation centers and more), pools,
  spraygrounds and drinking fountains, each a small ArcGIS layer fetched with an explicit field
  list, published into their own tile file because the City's terms differ from OpenStreetMap's.
* **Conditions reported to 311** (`adapters/philly311.py`, `publish/conditions.py`): dumping, light
  outage and graffiti requests from the last 120 days, of which the map counts the last 90 days on
  the nearest street block within 50 meters, one point per block, never at an address. Only the
  code, status, days and point are downloaded.

### Route survey sheets

`publish/route_sheets.py` writes one file per SEPTA bus and trolley route with a stop in
Philadelphia, and an index (docs/CONTRACTS.md section 7), for the web page `survey/`:

* **Order**: each direction's stops in SEPTA's own order, from the bus feed's `route_stops.txt` and
  `directions.txt` (not standard GTFS), which the `septa_gtfs` snapshot keeps as `stop_order` on
  its route rows (`derive/route_stops.py`). Stops outside the city are left off and counted.
* **What OpenStreetMap shows**: each SEPTA stop takes the answers and kind of the OpenStreetMap
  stop that is the same stop (`match_septa` in `derive/bus_stops.py`): by SEPTA's number in `ref`
  or `gtfs:stop_id` within 15 meters, then by distance within 15 meters, each stop once.
* The manifest lists the index but not each route's file. The whole step takes about a second.

### Public art

`publish/art.py` builds the `art` layer of `tiles/art.pmtiles` (docs/CONTRACTS.md section 4) from
three snapshots, with the rules in `derive/art.py`: the City's Percent for Art list
(`percent_for_art`, the works whose status is Active), OpenStreetMap's artworks (`tourism=artwork`
in `osm_philadelphia`, inside the city) and Wikidata's (`wikidata_art`, inside the city and not
gone). In short:

* **One work, one point.** Records of different sources are the same work by OpenStreetMap's
  `wikidata` tag, by names and place, by artist at the same place, or, for a work with no name and
  no artist, when it is the only candidate a few meters from a named work of the same kind. Two
  works whose sources name different artists are never joined, and a work holds one record of each
  source.
* **Records kept apart.** Each source's record is published on its own, with only what that source
  says, sharing the work's id (decision D1 of docs/VERIFICATION_V0_2.md, as for SEPTA's stops). The
  map draws one record per work (OpenStreetMap's place first) and the browser joins the others when
  the work is opened: the City's title, Wikidata's artist and every source's link.
  `derive.art.join_published` is the reference join, and `tests/art_join_cases.py` writes the cases
  both test suites check (`python pipeline/tests/art_join_cases.py` after changing it).
* **Memorial artworks** (docs/ETHICS.md): a work any source marks as a memorial (tags, Wikidata's
  "commemorates", or words such as "in memory of" and "RIP") is published with its kind and its
  links by number only, never a title, artist, year or inscription. `tests/test_art.py` guards it.
* The build notes give each source's count, the works found in two and three sources, the works on
  the map, the memorial artworks and the works left out (never a name). On 2026-10-05: 224 from the
  City, 410 from OpenStreetMap and 69 from Wikidata (703 records) are 651 works, 50 of them in more
  than one source; 45 memorial artworks. The whole step takes about a second.

OpenStreetMap's records are under the Open Database License and credited "© OpenStreetMap
contributors"; the City's and Wikidata's records keep their own terms and credits.

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
