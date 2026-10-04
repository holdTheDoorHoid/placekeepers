# Data sources

Status as of 2026-10-04, from the research reports in [research/](research/) plus spot checks by the
planner. Every source used by the pipeline must also have an entry in `registry/sources.yaml`; this
page is the human readable catalog.

**License shorthand.** "City terms" means the City of Philadelphia open data terms: free to use,
provided as is, the City keeps its database rights, and users hold the City harmless. It is not a
formal open license, so we attribute the City everywhere and never imply endorsement.

**Endpoints.** "Carto" means the City's SQL API at `https://phl.carto.com/api/v2/sql`. "City ArcGIS"
means `https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/<name>/FeatureServer/0`.
Both allow browser requests without a key.

## First release: lots and streets

### Property, ownership and history

| Source | Endpoint | What we use | Cadence | Status |
|---|---|---|---|---|
| OPA properties | Carto `opa_properties_public` (583,783 rows) | Owner names, mailing address, latest sale, market value, category and building codes, zoning, exemptions | Nightly | Live |
| OPA assessment history | Carto `assessments` (7.48 million rows) | Value by year for every parcel | Nightly | Live; never used by the original |
| Real estate transfers | Carto `rtt_summary` (5.16 million rows, 1974-01-02 to 2026-08-11) | Every recorded deed, sheriff deed and mortgage, with date, grantors, grantees and consideration, joined by `opa_account_num` | About 8 week lag | Live; this is the "what it sold for, going back in time" source |
| Water Department parcels | Carto `pwd_parcels` (547,410) | Parcel shapes | Not stated | Live |
| City owned property | City ArcGIS `LAMAAssets` (7,740: Land Bank 2,528, Redevelopment Authority 1,670, PHDC 95, other agencies) | Public owner agency, side yard eligibility | Not stated | Live. The OpenDataPhilly page of the same name is a frozen 2015 archive; use the live service |
| Tax balances | Carto `real_estate_tax_delinquencies` | Formerly per parcel tax debt and sheriff sale risk | n/a | **Restricted** since the original shut down (permission denied). Public data is aggregated by ZIP, district and tract only. Dossiers link to the City's Tax Center (tax-services.phila.gov) for the live balance |
| Tax debt snapshot, July 2025 | Clean & Green Philly final output, `data/backup_data/all_properties_2025_07_09.parquet` (97.7 MB, Git LFS, via media.githubusercontent.com) | A dated "tax debt as of July 2025" flag | Frozen | Downloadable; label every use with its date |
| Sheriff sales | No dataset. `rtt_summary` document types "DEED SHERIFF" (69,682) and "SHERIFF'S DEED" (19,370) give history | Past sheriff sales | n/a | History only; phillysheriff.com is browse only and is not scraped |
| Address search | `https://api.phila.gov/ais/v1/search/<address>` | Search box, address to OPA account | Live | Live, no key |
| Zoning base districts | OpenDataPhilly, yearly vintages 2020 to 2025 plus current | Zoning context for suggestions | Yearly | Live |
| Land use | City ArcGIS `Land_Use` (559,077; 2023 with 2025 updates), read as ArcGIS Hub's bulk GeoJSON; 2012 to 2018 also published | Context, vacancy signal | Yearly | Live (pipeline source `land_use`) |

### Vacancy signals

| Source | Endpoint | Use | Cadence | Status |
|---|---|---|---|---|
| Vacant Property Indicators, land | City ArcGIS `Vacant_Indicators_Land` (28,771) | Strong signal, with `land_rank` | Irregular | **Recalculated 2026-09-27.** Compared with the June 2024 L&I list: 69% of today's lots were on it, 5,880 dropped off, 8,980 are new. Real churn, not just a new date |
| Vacant Property Indicators, buildings | City ArcGIS `Vacant_Indicators_Bldg` (9,519) | Strong signal, with `build_rank` | Irregular | Recalculated 2026-09-27; only 39% overlap with the original's self collected 2024 list |
| June 2024 vacancy lists | Clean & Green Philly `land_backup_2024_06_24.parquet` (25,663 rows, from L&I) and `buildings_backup_2024_06_24.parquet` (9,955, self collected) | Validation labels and history | Frozen | Downloaded and checked 2026-10-04 |
| L&I violations | Carto `violations` (2.02 million, 2007 onward) | Vacancy related violations per parcel | Daily | Live. Use `violations`, not the smaller `li_violations` |
| L&I complaints | Carto `complaints` (1,065,777; 2014 onward). `public_cases_fc` is the larger 311 request table | Complaint density, vacant lot complaints | Daily | Live |
| L&I permits | Carto `permits` (937,116, 2007 onward) | A permit after sealing or demolition suggests reuse | Daily | Live |
| Unsafe buildings | Carto `unsafe` (3,048) | Strong building signal | Daily | Live |
| Imminently dangerous buildings | Carto `imm_dang` (123) | Strong building signal | Daily | Live |
| Clean and seal | Carto `clean_seal` (107,228; 2006 onward) | Strong building signal | Daily | Live |
| Demolitions | Carto `demolitions` (14,325; 2007 onward) | Lot created by demolition | Daily | Live |
| L&I property history | OpenDataPhilly (since 2023) | Consolidated timeline per parcel | Daily | Live; not yet explored |
| Building footprints | City ArcGIS `LI_BUILDING_FOOTPRINTS` (546,049), read as ArcGIS Hub's bulk GeoJSON | "No building on this parcel" | Weekly | Live |
| Vacant lot cleanups | OpenDataPhilly "Vacant Lot Cleanups" (Community Life Improvement Program) | City cleaned this lot | Not stated | Live |
| Aerial photography | OpenDataPhilly, vintages 1996 to 2023 | Later: vegetation trend per lot | Every 1 to 3 years | Live |
| USPS vacancy via HUD | huduser.gov (login for registered agencies and nonprofits) | Tract level context | Quarterly | Not used: needs a registered partner |

### Care already happening

| Source | Endpoint | Use | Status |
|---|---|---|---|
| PHS LandCare | City ArcGIS `phs_landcare` (12,459) | Lots already cleaned and maintained | Live. The two older layer names in the original's docs are dead |
| PHS and NGT supported gardens | `services2.arcgis.com/qjOOiLCYeUtwT7x7/.../PHS_NGT_Supported_Current_view` (216) | Gardens, never targeted as vacant | Live. No license stated on PHS's item; credited, and worth confirming with PHS |
| Registered community gardens | City ArcGIS `Registered_Community_Gardens` (23, Parks and Recreation) | Gardens, cross checked with the above | Live. Contact emails are not downloaded |
| Parks and Recreation properties | City ArcGIS `PPR_Properties` (507) | Park land, never vacant | Live |
| Green stormwater infrastructure | City ArcGIS `GSI_Public_Projects_Point` and related layers | Context | Live |

### Safety context

| Source | Endpoint | Use | Cadence | Status |
|---|---|---|---|---|
| Shooting victims | Carto `shootings` (17,973; 2015-01-01 to 2026-10-01) | Hexagon counts; point layer off by default. Points are snapped to the block by the City | Near daily | Live |
| Crime incidents, Part I and II | Carto `incidents_part1_part2` (3.6 million) | Not used at first. The original used gun assault and gun robbery codes as a proxy; the shootings table is the better signal | Near daily | Live |
| Controller's gun violence dashboard | github.com/PhilaController/gun-violence-dashboard-data | Reference for method only | Daily | Live |

### Street safety

| Source | Endpoint | Use | Cadence | Status |
|---|---|---|---|---|
| High Injury Network 2025 | City ArcGIS `high_injury_network_2025` (162 segments; fields objectid, stname, length_ft) | Street safety lens | Last edit 2025-12-10 | Live; 2020 and 2017 versions also published |
| Crashes (City copy of PennDOT data) | City ArcGIS `collision_crash_2020_2024` (36,303), `COLLISION_CRASH_2016_2020` (45,308) and `COLLISION_CRASH_2007_2017` (77,462, only 2015 is read) | Crash points by year, worst injury and who was involved; people killed or seriously injured walking or cycling per block. Each year comes from the newest slice that covers it (later slices revise earlier years); a crash record number counts once. PennDOT gives the month, never the day, and has no scooter field. Before 2016 PennDOT called a serious injury a "major injury". Slices `collision_crash_2018_2022` and `collision_crash_2019_2023` (layer 1) also exist and are not needed | Yearly slices; the 2020 to 2024 slice was edited 2025-09-30 | Used (M1.5): sources `crashes_2020_2024`, `crashes_2016_2020`, `crashes_2007_2017`. Add the 2021 to 2025 slice as a new source when the City publishes it |
| Fatal crashes (Police) | Carto `fatal_crashes` (935 rows, 2019-01-02 to 2026-08-22 on 2026-10-04) | One row per person killed (897 crashes; 34 killed more than one person). Memorials and "someone killed here in the last two years". `veh1` and `veh2` are free text ("Bicycle" before 2023, "Bicyclist" after; "E-Scooter", "Scooter", "M/C", "Pedestrian" and others). The table also holds case numbers, age, sex, narratives and arrest details, which are never downloaded. The City warns not to compare it with the PennDOT data | Nightly, but the newest record lags about six weeks | Used (M1.5): source `fatal_crashes` |
| PennDOT crash data portal | data-pennshare.opendata.arcgis.com (statewide tables 2006 to 2025) | Backup source | Yearly | Not yet checked in detail |
| NHTSA FARS | static.nhtsa.gov bulk CSV (about 34 MB a year; coordinates since 2000; public domain) | Backup for fatal crashes | Yearly | Live |
| TrafficVictimsPHL | bicyclecoalition.org/trafficvictimsphl | Names, curated by hand into `data/curated/memorials.yaml`, each with its source link | Irregular | Narrative pages only, no dataset; ask the Bicycle Coalition first |
| Ghost bikes | Bicycle Coalition map; OpenStreetMap `memorial=ghost_bike` (7) | Existing memorials | Irregular | Live. Requests and repairs go through the Bicycle Coalition's form (forms.gle/HBtY1hG4xcdVJKNb8), checked 2026-10-04 |
| Schools | City ArcGIS `Schools`, the OpenDataPhilly "Schools" (490: District, charter, archdiocesan and private) | Street safety factor: a school within 400 meters of a block | Not stated; edited 2026-08-26 | Used (M1.5): source `schools` |
| Street centerlines | City ArcGIS `Street_Centerline`, the OpenDataPhilly "Street Centerlines" (41,252 segments with `seg_id`, `stname`, `class`, `responsibl`) | The blocks the street safety lens scores; classes 1 to 5 and the ramps (9, 10) are kept, 40,453 segments | Updated by the Streets Department; edited 2026-09-21 | Used (M1.5): source `street_centerlines` |

### Boundaries and context

| Source | Use | License | Status |
|---|---|---|---|
| Council districts 2024 (City ArcGIS `Council_Districts_2024`) | Filters, contacts | City terms | Live |
| Registered Community Organizations (City ArcGIS `Zoning_RCO`, 240) | Filters, who to talk to | City terms | Live |
| Philadelphia neighborhoods (OpenDataPhilly GitHub, 159, by Abaca Labs) | Filters, names | CC BY 4.0 | Live |
| Census tracts 2020 (City ArcGIS `Census_Tracts_2020`, 408, adjusted to the City's standard boundary) | Each parcel's tract, for the poverty rate | City terms (from the Census Bureau, public domain) | Used (M1.4): source `census_tracts_2020` |
| ACS 5 year 2020 to 2024, table B17001 from the Census Bureau's table based summary file (`www2.census.gov`, 119 MB, no key) | Poverty rate (violence lens), renter share | CC0 | Live. The Census API now refuses requests without a key (checked 2026-10-04); a free key is an owner action if the API is wanted |
| Tree canopy change 2008 to 2018 (City ArcGIS `TreeCanopyChange_2008_2018`, 665,748 polygons marked gain, loss or no change; University of Vermont Spatial Analysis Laboratory for Parks and Recreation) | Canopy deficit (violence lens) | City terms | Used (M1.4): source `tree_canopy_2018`, kept as canopy per H3 cell. The newest canopy the City publishes. The City's `hex_tree_canopy` (2,833 hexagons, PhillyStat 360) has no description, and its hexagon areas are in square feet while its canopy totals are in an unstated unit, so it is not used |
| Tree Equity Score (American Forests) | Canopy gap per block group | Not stated | Stale since 2021 |
| Market Value Analysis 2023 (City ArcGIS `mva_2023`, Reinvestment Fund) | Displacement watch | City terms | Live |

### Basemap

A Protomaps basemap extract of the Philadelphia area (built from OpenStreetMap, ODbL), hosted with
the site. No keys, no third party tile service.

## Later releases

### Transit comfort

| Source | Notes | Status |
|---|---|---|
| SEPTA GTFS, `https://www3.septa.org/developer/gtfs_public.zip` (22 MB, 2026-09-25) | Stops and schedules. License must be accepted; redistribution allowed (non exclusive, revocable) | Live |
| SEPTA ridership statistics (OpenDataPhilly, "stop summary files") | Average daily boardings per stop | Exists; exact file to confirm |
| SEPTA New Bus Network | Phase 1 began 2026-08-23; phases 2 to 4 run to August 2027, so stop ids will churn | Plan for it |
| Bus shelters | **No public inventory exists.** OpenStreetMap on 2026-10-04: 83 stops tagged with a shelter, 224 tagged without, 199 tagged without a bench, 35 shelter outlines | Gap: neighbor survey (StreetComplete) plus a Right to Know request to OTIS for the advertising contractor's shelter list |
| Indego GBFS `https://gbfs.bcycle.com/bcycle_indego/gbfs.json`, trips, stations | Bike share context | Live |
| City bike network (City ArcGIS `Bike_Network`) | No stress rating field | Live |
| DVRPC Level of Traffic Stress | License: "Unrestricted"; updated 2026-09-03 | Live |

### Heat and shade

Heat vulnerability by tract (City ArcGIS `heat_vulnerability_ct`), street tree inventory 2021 to 2025
(`ppr_tree_inventory_2025`), canopy, FEMA floodplain 2023 (`fema_floodplain_2023`), impervious
surfaces (1996 and 2004, very stale; check the newer Pennsylvania high resolution land cover first),
and the NOAA and CAPA Heat Watch campaign (data link still to find).

### Placemaking: art, walkability, people

| Source | Count | License | Plan |
|---|---|---|---|
| Percent for Art (Carto `percent_for_art_public`) | 239 | City terms | Use |
| philart.net API (`/api/art.json`) | 1,268 | As is, non commercial | Use after emailing the site owner; needs a browser style User-Agent |
| Association for Public Art map (JSON embedded in the page) | 252 | Non commercial and educational, with attribution | Ask permission first |
| OpenStreetMap `tourism=artwork` | about 447 | ODbL | Use; also the channel for new murals |
| Wikidata public art in Philadelphia | 43 | CC0 | Use |
| Philadelphia's Magic Gardens mosaic map (Google My Maps KML) | 231 (three current folders) | Unstated | Ask permission first |
| Mural Arts Philadelphia artworks | 2,012 pages | Terms forbid building a database from their content | **Link out only**; ask about a data partnership |
| Public Art Archive | Not counted | Fair use, education and press only | Link out only |
| EPA National Walkability Index (2021, block groups, 405 MB) | | Federal, public domain | Use |
| Walk Score | | Terms forbid storing scores | **Do not use** |
| DVRPC pedestrian portal (sidewalks, crosswalks, curb ramps) | | Not stated | Use with its "2018 imagery, not field checked" caveat shown |
| Census 2020 blocks | | Public domain | Use (API key needed) |
| TPL ParkServe 10 minute walk areas | | Terms unreachable (403) | Ask before use |
| Amenities from OpenStreetMap | benches about 2,822; drinking water 46; toilets 116; public bookcases 192; community fridges 0 | ODbL | Use; fridges need a community list |
| 311 requests (Carto, since 2014-12-08) | Illegal dumping, street and alley light outages, graffiti, dangerous sidewalk, street trees | City terms | Use for conditions only, never for people |
| Street poles, commercial corridors, schools | | City terms | Use |
| Free Library branches | | Site blocked (403) | Use OpenStreetMap `amenity=library` |

### History and displacement

Real estate transfers (price trends, share of company buyers), assessment history, Market Value
Analysis, renter share, City orthophotos 1996 to 2023, the 1860 Hexamer and Locher atlas (hosted by
the City with the GeoHistory Network's permission), PhilaGeoHistory layers such as the 1942 land use
map (**permission required** from the Athenaeum of Philadelphia), and HOLC redlining from Mapping
Inequality (license text to confirm).

## Not sources

| Site | Why not |
|---|---|
| NeighborhoodScout, SafeMap, VeryApt | Commercial, opaque, no reuse rights. VeryApt's own method uses 2015 to 2018 data |
| ArcGIS web map 7dd95c7265bd40cba1fd36626f43c5dc | Esri demonstration data, explicitly not real |
| Walk Score | Terms forbid storing scores |
| Mural Arts and Public Art Archive content | Terms (link out instead) |
| Reddit, TPL website, Urban Displacement Project, Free Library website | Block automated access; never get around a block |

## Access notes for builders

- OpenStreetMap's public Overpass server rejects the default curl and Python user agents (HTTP 406)
  and is often overloaded (HTTP 504). Send a descriptive User-Agent for small queries, and use a
  weekly Geofabrik Pennsylvania extract filtered locally for anything bulk.
- philart.net rejects bare HTTP clients; send a normal browser style User-Agent.
- The Census API needs a free key (an owner action) for block level data.
- The original project's PHS LandCare layer names in its docs are dead; its code already used
  `phs_landcare`.
