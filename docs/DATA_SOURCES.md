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
| Vacant Property Indicators, land | City ArcGIS `Vacant_Indicators_Land` (28,771) | Strong signal, with `land_rank` | Irregular | **Recalculated 2026-09-27.** Compared with the June 2024 L&I list: 69% of today's lots were on it, 5,880 dropped off, 8,980 are new. Real churn, not just a new date. Rebuilt again on 2026-10-04 (28,770 lots, every record dated that day) |
| Vacant Property Indicators, buildings | City ArcGIS `Vacant_Indicators_Bldg` (9,519) | Strong signal, with `build_rank` | Irregular | Recalculated 2026-09-27; only 39% overlap with the original's self collected 2024 list. Rebuilt again on 2026-10-04 (9,569 buildings) |
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
| SEPTA GTFS, `https://www3.septa.org/developer/gtfs_public.zip` (22,054,912 bytes; release v202609270 of 2026-09-25, downloaded in 3 seconds on 2026-10-04) | One zip holding two feeds: `google_bus.zip` (bus, trolley, trackless trolley, SEPTA Metro subway and El; 13,495 boarding places, 163 routes with service, good 2026-09-27 to 2027-02-20) and `google_rail.zip` (Regional Rail; 156 stations, 13 lines, good to 2026-10-17). SEPTA keeps the link on its newest release, also published at github.com/septadev/GTFS with a changelog. The snapshot keeps service measures per stop and per route, not the timetables (docs/TRANSIT_METHOD.md), and (added by M2.4) each route's stops in order for each direction, from the bus feed's own `route_stops.txt` and `directions.txt`, which are not standard GTFS, for the route survey sheets (docs/CONTRACTS.md section 7). License: SEPTA's license agreement (below). Health: at least 9,000 rows, no more than 15% fewer than last week, and a release no older than 90 days (`source_date`, the file's Last-Modified) | Used (M2.1, M2.4): source `septa_gtfs` |
| SEPTA stop ridership, bus: SEPTA's ArcGIS layer `Spring_2026_Stop_Summary_Bus` (services2.arcgis.com/9U43PSoL47wawX5S, listed on SEPTA's portal data-septa.opendata.arcgis.com; OpenDataPhilly's "SEPTA Ridership Statistics" lists the same "stop summary files" up to Summer 2025) | Average weekday, Saturday and Sunday boardings and alightings per route, direction and SEPTA stop number for the Spring 2026 schedule period (2026-02-22 to 2026-06-13); 18,201 rows, 12,967 stop numbers, 414,543 weekday boardings across the region; SEPTA published it on 2026-08-20; downloads in 10 pages without a login (12 seconds). SEPTA adds a layer for each period (spring, summer, fall; Fall 2025 came out in February 2026), so each run takes the newest spring or fall one; summer counts are lower and miss school trips. Health: at least 15,000 rows, no more than 25% fewer, published within 400 days | Used (M2.1): source `septa_ridership_bus` |
| SEPTA stop ridership, trolley: `Spring_2026_Stop_Summary_Trolley` (same folder) | As for buses, for T1 to T5, G1, D1 and D2: 719 rows. Health: at least 500 rows | Used (M2.1): source `septa_ridership_trolley` |
| SEPTA Metro and Regional Rail ridership | No count per platform is published; `Regional_Rail_Station_Summary` (2025) has stations and the M1 (Norristown High Speed Line) has its own stop summaries, outside the city | Not used |
| SEPTA New Bus Network | Phase 1 began 2026-08-23; phases 2 to 4 run to August 2027, so stop numbers change. Between the last schedules before phase 1 (v202608091) and v202609270, 358 stop numbers disappeared and 185 appeared; 4 were renumbered in place. Placekeepers keeps a stable key per stop and links renumbered stops (docs/TRANSIT_METHOD.md). SEPTA's folder also holds `Stops_Eliminated_with_NBN_Phase_1_(Single_Points)` (486 stops) and `NBN_Stops_updated_data` (stop signage work), not used yet | Handled (M2.1) |
| Bus shelters | **No public inventory exists.** OpenStreetMap is the source (`osm_philadelphia`, below): on 2026-10-04 it had 829 bus and trolley stops in the city, about 1 in 10 of SEPTA's 7,927 bus and trolley stops in Philadelphia (docs/TRANSIT_METHOD.md). 97 show a shelter or roof, 12 a bench but no shelter, 236 neither, and 484 are not yet surveyed. On 2026-10-05, M2.3 matched 660 of SEPTA's stops to them within 15 meters (181 where the stop numbers agree, 479 by place), as the route survey sheets do. The City's shelter program is run by OTIS and paid for by the advertising on the shelters; its May 2024 request for information sets the goal of 40 percent of bus boardings at stops with a shelter and names the busiest 15 percent of stops as candidates (docs/ROUTES.md) | Used (M2.2): layer `stop_amenities` ("Shelters and benches at stops", in `tiles/amenities.pmtiles`); M2.3 carries the answers onto SEPTA's stops for the transit comfort lens. Gap: neighbor survey (StreetComplete, the "Survey bus stops" page) plus a Right to Know request to OTIS for the advertising contractor's shelter list |
| Heat vulnerability by census tract (City ArcGIS `heat_vulnerability_ct`, layer 0; OpenDataPhilly's "Heat Vulnerability by Census Tract") | By the Department of Public Health and the Office of Sustainability: heat exposure (from satellite surface temperatures, vegetation, built up land and how much sunlight surfaces reflect), heat sensitivity and heat vulnerability scores for each 2010 census tract, from data of 2017 to 2019 (the layer was last edited on 2025-04-03). 384 tracts, downloaded in 2.6 seconds without a login on 2026-10-04. License: the City's open data terms. Health: at least 350 rows, no more than 5 percent fewer | Used (M2.3): source `heat_vulnerability`, the heat exposure score at each stop for the transit comfort lens; and from M3.1 the heat vulnerability score of each lot's tract for the heat and shade lens, and the tract layer (Heat and shade, below) |
| Indego GBFS `https://gbfs.bcycle.com/bcycle_indego/gbfs.json`, trips, stations | Bike share context | Live |
| City bike network (City ArcGIS `Bike_Network`) | No stress rating field | Live |
| DVRPC Level of Traffic Stress | License: "Unrestricted"; updated 2026-09-03 | Live |

**SEPTA's license (checked 2026-10-04).** SEPTA's Open Data license agreement
(https://wwww.septa.org/license-agreement/, SEPTA's own spelling of its host) covers every dataset
on its open data portal, and the GTFS download page (https://www3.septa.org/developer/) shows the
same terms for the schedules (its version dated 2014-03-18). SEPTA grants a non exclusive, non
assignable, limited and revocable right to use, reproduce and redistribute the data, free of
charge, as is, with no warranty. Conditions: SEPTA's trademarks and copyrighted materials may not be
used for any commercial or profit making use and may not be altered (Placekeepers uses no SEPTA logo
or artwork); the licensee holds SEPTA harmless; disputes go to courts in Philadelphia County; the
newest version of the agreement always applies, and SEPTA may change or revoke it. Downloading the
data means accepting it; there is no login and no key. Nothing forbids publishing stop locations,
schedule measures or counts on a public, free map. SEPTA asks for no particular credit line, so the
map credits "SEPTA" for schedules and ridership and never suggests SEPTA endorses Placekeepers. The
license is `septa_license` in `registry/licenses.yaml`.

### OpenStreetMap, weekly extract (`osm_philadelphia`, used from M2.2)

| | |
|---|---|
| File | `https://download.geofabrik.de/north-america/us/pennsylvania-latest.osm.pbf`, Geofabrik's Pennsylvania extract. The link redirects to the dated file (`pennsylvania-261003.osm.pbf` on 2026-10-04), which the pipeline follows |
| Size and time | 348,105,893 bytes (348 MB) on 2026-10-04, data as of 2026-10-03 20:20 UTC. On this laptop the download took 31 seconds and the filtering 18 seconds (peak memory 1.4 GB); the extract is deleted once the snapshot is made, so the weekly refresh needs about 350 MB of disk for under a minute |
| What we keep | The nodes and ways carrying a tag the registry lists (`endpoint.tags`: `highway=bus_stop`, `public_transport=platform`, `amenity=shelter`, `amenity=bench`, since M3.5 `amenity=drinking_water`, `amenity=toilets`, `amenity=public_bookcase` and `leisure=picnic_table`, and since M3.2 `tourism=artwork`) inside the city limits (the 2020 census tracts joined) and 200 meters around them, each with all its tags, its shape and a point on it. 3,338 elements on 2026-10-04 (3,243 inside the city), a 197 kB snapshot; 3,909 with the M3.5 tags on 2026-10-05 (the extract's data of 2026-10-03; inside the city 2,069 benches, 306 picnic tables, 150 public bookcases, 74 toilets and 30 drinking water points); 4,316 with the M3.5 and M3.2 tags together, the same day (411 artworks inside the city). Relations are not read (three in all of Pennsylvania carried these tags). `railway=tram_stop` is not listed: in Philadelphia all 390 mark where a trolley halts on its tracks, while riders wait at the platform beside it |
| Cadence | Weekly, with the Monday refresh. Geofabrik remakes the extract every day; a good copy younger than six days is never downloaded again unless forced (`pk fetch --force`), as Geofabrik asks automated downloaders not to fetch the same file over and over. The exception is a change to the tag list: each snapshot keeps a hash of the tags it was made with, and a copy made with other tags (or before the hash was kept) is downloaded again on the next run, so new tags never wait six days |
| License | Open Database License (ODbL). Credit "© OpenStreetMap contributors" with a link to openstreetmap.org/copyright; anything published from it (the `stops` layer of `tiles/amenities.pmtiles`, from M2.3 the shelter, bench and light answers SEPTA's stops carry in `tiles/transit.pmtiles`, and from M3.2 the public art layer, `tiles/art.pmtiles`) is ODbL too |
| Health rules | At least 2,500 rows; no more than 10 percent fewer than the last good copy; the extract's data no older than 14 days (the replication timestamp in the file's header, else the server's Last-Modified date); at least 90 percent of the stops kept inside the city limits (98 percent on 2026-10-04). A download that is not an `.osm.pbf` file (an error page sent as a file) is retried, then fails, and the last good copy stays |

Stops on 2026-10-04 (data of 2026-10-03), inside the city: 829 (464 bus, 348 trolley, 17 both; 55
drawn as a line or an area, the rest as points). Their own answers: shelter yes 88, no 277, not
said 464; bench yes 68, no 250, not said 511. What the map shows: 97 a shelter or roof (88 by
their own answer, 7 from a shelter drawn on its own beside them, 2 under a roof), 12 a bench but no
shelter mapped, 236 neither, 484 not yet surveyed (451 say nothing about either, 32 say only
that they have no shelter, 1 only that it has no bench).

Why 10 meters for a shelter or bench drawn on its own: of the 73 stop shelters in the snapshot
(`shelter_type=public_transport` or no type), the 10 near a mapped stop all lay within 3.5 meters
of it, and the next closest was 42 meters from any stop. Of the other 63, 29 are tagged as public
transport shelters, and most of those likely stand at stops OpenStreetMap does not have yet; the 34
with no type may be shelters of any kind. Meanwhile 95 percent of stops have
no other stop within 15 meters (the median is 30 meters), so 10 meters credits a stop with its
own shelter and not with the one across the street. 2,128 benches are mapped in and around the
city; 7 stops that do not say whether they have a bench have one drawn within 10 meters.

### Heat and shade

Used from M3.1 (2026-10-05) by the heat and shade lens and the Heat, trees and flooding layers. Every
source here is the City's, under the City's open data terms (`city_terms`), downloaded without a
login or a key.

| Source | Endpoint, size and time | What we use | Health rules | Status |
|---|---|---|---|---|
| Heat vulnerability by census tract | City ArcGIS `heat_vulnerability_ct` (see Transit comfort above; source `heat_vulnerability`, shared with M2.3). 384 tracts of 2010 | `hvi_score` for each lot's tract (factor `f_heatvul`), and all three scores with the very high flag (`n_veryhigh`) for the tract layer. The City's own map layer of the index (`Heat_Vulnerability_Index_Map`, not downloaded) names the twelve sensitivity measures: the prevalence of hypertension, asthma, coronary heart disease, COPD, diabetes and obesity; people 65 and older; adults without a high school diploma; people with limited English; people identifying as non white; people 65 and older living alone; and people below the poverty level. It also shows that the very high flag marks the tracts the City rates very high in heat vulnerability, which that map calls its priority areas (59 there, 58 in the published layer). 8 tracts (large parks, the airport) have no score | As M2.3 set them: at least 350 rows, no more than 5 percent fewer | Used (M2.3, M3.1) |
| Street tree inventory | City ArcGIS `ppr_tree_inventory_2025` (source `street_trees`). The City publishes a layer per year (`PPR_Tree_Inventory_2021` to `ppr_tree_inventory_2025`); each run lists the City's services and takes the newest. 151,726 trees, all from the 2025 inventory, last edited 2025-11-20; 76 pages in 81 seconds on 2026-10-05; a 2.7 MB snapshot | Each tree's point, species (common name), trunk diameter at chest height in inches and inventory year; nothing else exists in the layer that we would leave out but its repeated coordinates. 44,306 of the trees (29 percent) stand on Parks and Recreation property, so it covers park trees as well as street trees; trees in private yards are not in it. About 250 trunk sizes under 1 inch or over 80 inches (data entry errors) and 50 missing ones are not shown, so 151,419 trees show a size | At least 120,000 rows, no more than 10 percent fewer, and the layer's last edit no older than 800 days | Used (M3.1): factor `f_strees` (trees within 100 meters of a lot) and the layer "Street and park trees" |
| FEMA floodplain 2023 | City ArcGIS `fema_floodplain_2023` (source `fema_floodplain`), FEMA's flood maps clipped to Philadelphia by the City. 1,041 areas, of which 883 are downloaded: 5 in zone A, 371 in AE and 16 on the AE floodway (the 1 percent annual chance floodplain, `sfha_tf` T) and 491 in zone X marked 0.2 percent annual chance. FEMA's area of minimal flood hazard (157) and open water (1) are not. Last edited 2025-04-15; 7 seconds on 2026-10-05; a 9.2 MB snapshot. The 2007 and 2015 versions the City also publishes are not used | Zone, subtype, the special flood hazard flag and the map's ids, with the shape. FEMA's own flood maps are public domain; the City's copy is under its terms | At least 700 rows, no more than 10 percent fewer | Used (M3.1): the floodplain note on a lot (`fp`, never a score) and the layer "Floodplain" |
| Tree canopy 2008 to 2018 | Source `tree_canopy_2018`, kept per H3 cell (Boundaries and context above) | Factor `f_canopy`, computed once for the violence lens and listed in the heat lens too | As set by M1.4 | Used (M1.4, M3.1) |
| People per square kilometer | Sources `acs_poverty` (B17001's population for poverty status per 2020 tract) and `census_tracts_2020` (`aland`, land area) | Factor `f_people`, the people a cooler lot would reach | As set by M1.1 and M1.4 | Used (M3.1) |
| Land cover 2018 | PASDA dataset 1587, `PhiladelphiaLandCoverRaster2018.zip` (521 MB, a raster of seven classes: tree canopy, grass and shrub, bare earth, water, buildings, roads, other paved), with a map service that shows only pictures | Would give paved and built shares per area | n/a | **Not used.** It needs a raster library the pipeline does not have, for one factor, and the heat exposure part of the City's index already measures how hot the ground gets, which paving drives |
| Impervious surfaces | PASDA dataset 1136, `PhiladelphiaImperviousSurfaces2015.zip` (324 MB), and the 2004 version on the City's file server (435 MB) | Would give paved shares per area | n/a | **Not used.** Old (2015 and 2004), large, and covered by the heat exposure score, as above |
| Heat exposure 2023 | City ArcGIS `HeatExposure_2023` (408 tracts of 2020, the score as text, "using HEI and SVI census tract information", edited 2023-03-15) | n/a | n/a | **Not used**: the published index above is the City's dataset of record |
| NOAA and CAPA Heat Watch | Philadelphia took part in a street temperature campaign | n/a | n/a | **Not used**: no data file found |

### Public art

Used from M3.2 (2026-10-05) by the Public art layer (`public_art`, `tiles/art.pmtiles`,
docs/CONTRACTS.md section 4). The three sources are merged into one point per work: 703 records on
2026-10-05 (224 from the City, 410 from OpenStreetMap, 69 from Wikidata) became 651 works, 50 of
them found in more than one source (48 in two, 2 in all three); 45 are memorial artworks, shown
without names. Each work links to every source it came from.

| Source | Endpoint, size and time | What we use | License and credit | Health rules | Status |
|---|---|---|---|---|---|
| Percent for Art | City ArcGIS `Percent_for_Art_Public`, the OpenDataPhilly dataset "Percent for Art Locations" from the Department of Planning and Development (the same 239 records as the Carto table `percent_for_art_public`; the ArcGIS layer is read because it says when it was last edited). 239 works on 2026-10-05: 224 Active, 10 Inaccessible, 5 In Progress; last edited 2025-08-19. One page in 2.3 seconds; an 83 kB snapshot | The Active works: title, artist, year, medium, where in words (and whether inside a building), the City's document about the work when it links one, and the parcel the work stands on (a polygon; the map puts the work on it). Street View links and neighborhood names are not downloaded | City terms; credited "Public art: City of Philadelphia, Percent for Art" | At least 200 rows, no more than 10 percent fewer; the last edit day is shown, with no age limit, since the City updates the list as needed | Used (M3.2): source `percent_for_art` |
| OpenStreetMap artworks | `tourism=artwork` in the weekly extract (`osm_philadelphia`, below): every element so tagged inside the city limits. 411 on 2026-10-05 (data of 2026-10-03): 176 statues, 122 sculptures, 53 murals, 9 busts, 9 installations, 4 reliefs, 4 paintings, 2 mosaics, 3 others and 29 of no stated kind; 276 with a name and 196 with an artist; 115 link a web page (97 of them the Association for Public Art's page on the work) and 34 a Wikidata item | Name and other names, `artwork_type`, `artist_name`, `start_date`, `material`, `website`, `wikipedia` and `wikidata` (to find the same work in Wikidata), and the memorial tags. One artwork whose `end_date` had passed is left out | ODbL, credited "© OpenStreetMap contributors"; the merged layer is ODbL too | Those of the extract | Used (M3.2) |
| Wikidata | Wikidata's query service, `https://query.wikidata.org/sparql`, one query a week with the project's User-Agent: items with a coordinate (P625) in a box around the city whose class (P31) is one of a fixed list of 27 kinds of public art (murals, sculptures, statues, busts, reliefs, mosaics, installations, monuments, memorials and similar; `WIKIDATA_CLASSES` in `pipeline/src/placekeepers/derive/art.py`). A search of every subclass of "work of art" timed out on the service, and its matches included television seasons and journals, so the list is fixed. 72 items on 2026-10-05, 69 inside the city limits; about 1 second for the query, 4.6 seconds for the download; an 11 kB snapshot | English label, classes, coordinate, the year it was made (P571), creators (P170), what it commemorates (P547) and whether that is a person, English Wikipedia article, described at (P973) and official website (P856), and whether it is gone (P576, or a state of use such as destroyed). No inscriptions and no images | CC0, which asks for no credit; credited "Public art: Wikidata (CC0)" anyway | At least 40 rows, no more than 25 percent fewer | Used (M3.2): source `wikidata_art` |

**Left out until their owners agree** (owner outreach, docs/ROUTES.md section 6): philart.net (1,268
works, an API offered as is and not for commercial use), the Association for Public Art's map (252
works, non commercial and educational use only) and Philadelphia's Magic Gardens' mosaic map (231
places, no terms stated). Parks and Recreation's layer of art and monuments in its parks
(`PPR_Art_Monuments_point`, 213 points) is in the City's map services but not listed as open data,
so it waits for Parks and Recreation too. The map still links to the Association for Public Art's
and philart.net's pages about a work where OpenStreetMap's `website` tag names them: that is
OpenStreetMap's data, and a link copies nothing.

**Mural Arts Philadelphia** keeps the largest list of the city's murals (2,012 pages), and its
terms forbid building a database from its content, so nothing is copied from its site. The layer's
description and every mural's details link to its own list (`https://muralarts.org/artworks/`,
checked 2026-10-05); a work links to its page on muralarts.org only when OpenStreetMap or Wikidata
names that page (none did on 2026-10-05). Its form for proposing a mural is linked from the How to
do it page.

**Memorial artworks.** Some murals and plaques remember a person. Names of people killed come only
from the hand curated memorials file (docs/ETHICS.md), so a work that any source marks as a
memorial is published with no title, artist, year or inscription, only as a memorial artwork with
its sources (the rule is in docs/CONTRACTS.md section 4). The 45 on 2026-10-05 are monuments such as
statues OpenStreetMap tags as memorials, war memorials and memorial plaques; none was a memorial
mural to a private person, but the rule stands ready for them.

### Placemaking: art, walkability, people

| Source | Count | License | Plan |
|---|---|---|---|
| Percent for Art (City ArcGIS `Percent_for_Art_Public`, the same list as Carto `percent_for_art_public`) | 239 | City terms | **Used (M3.2)**: source `percent_for_art`, see Public art above |
| philart.net API (`/api/art.json`) | 1,268 | As is, non commercial | **Not used** until its owner agrees (owner outreach); needs a browser style User-Agent |
| Association for Public Art map (JSON embedded in the page) | 252 | Non commercial and educational, with attribution | **Not used** until it agrees (owner outreach) |
| OpenStreetMap `tourism=artwork` | 411 inside the city | ODbL | **Used (M3.2)**, from the weekly extract; also the channel for new murals |
| Wikidata public art in Philadelphia | 69 inside the city | CC0 | **Used (M3.2)**: source `wikidata_art` |
| Philadelphia's Magic Gardens mosaic map (Google My Maps KML) | 231 (three current folders) | Unstated | **Not used** until it agrees (owner outreach) |
| Mural Arts Philadelphia artworks | 2,012 pages | Terms forbid building a database from their content | **Link out only**, never copied; ask about a data partnership |
| Public Art Archive | Not counted | Fair use, education and press only | Link out only; not used |
| Parks and Recreation art and monuments (City ArcGIS `PPR_Art_Monuments_point`) | 213 | Not listed on OpenDataPhilly, so no open data terms | **Not used**: ask Parks and Recreation (owner outreach) |
| EPA National Walkability Index (2021, block groups, 405 MB) | | Federal, public domain | Use |
| Walk Score | | Terms forbid storing scores | **Do not use** |
| DVRPC pedestrian portal (sidewalks, crosswalks, curb ramps) | | Not stated | Use with its "2018 imagery, not field checked" caveat shown |
| Census 2020 blocks | | Public domain | Use (API key needed) |
| TPL ParkServe 10 minute walk areas | | Terms unreachable (403) | Ask before use |
| Amenities from OpenStreetMap | benches about 2,822; drinking water 46; toilets 116; public bookcases 192; community fridges 0 (Overpass, a box around the city) | ODbL | Used (M3.5): layers `benches`, `picnic_tables`, `drinking_water`, `toilets` and `bookcases` in `tiles/amenities.pmtiles`, from the weekly extract (`osm_philadelphia`). Inside the city limits on 2026-10-05: 2,069 benches, 306 picnic tables, 30 drinking water points, 73 public toilets (one more closed to the public is left out) and 150 public bookcases. Fridges need a community list |
| 311 requests (Carto, since 2014-12-08) | Illegal dumping, street and alley light outages, graffiti, dangerous sidewalk, street trees | City terms | Use for conditions only, never for people. Used (M3.5): source `philly311_conditions`, below |
| Street poles, commercial corridors, schools | | City terms | Use |
| Free Library branches | 54 | City terms | Used (M3.5): the City publishes them as `library_locations` (below). The Free Library's own website refuses automated requests (403) and is never read |

### Public places and conditions reported to 311 (M3.5)

Checked against the live services on 2026-10-05. All are "City terms", credited to the City (and to
Parks and Recreation or Philly311), fetched with an explicit list of fields, and published by
`pk publish` into `tiles/places.pmtiles` and `tiles/conditions.pmtiles` (docs/CONTRACTS.md section 4).

| Source id | Endpoint | What we keep | Count and date | Health |
|---|---|---|---|---|
| `library_locations` | City ArcGIS `library_locations` ("Active Free Library of Philadelphia Locations"; not on OpenDataPhilly, listed in the City's metadata catalog, metadata.phila.gov) | `building`, `address`, `zip_code`, `phone_number`, `library_url` and the point | 54, last edited 2026-07-22 | At least 45 rows, no more than 15 percent fewer than the last good copy |
| `ppr_program_sites` | City ArcGIS `PPR_Program_Sites` (OpenDataPhilly "Parks & Recreation Program Sites") | `park_name`, `program_type`, `site_class`, `building`, `gym`; not the free text comments | 168 (157 recreation centers, 6 older adult centers, 3 environmental education centers, 2 pools), last edited 2026-06-05 | At least 140 rows, 15 percent |
| `ppr_swimming_pools` | City ArcGIS `PPR_Swimming_Pools` (OpenDataPhilly "PPR Swimming Pools") | `pool_name`, `park_name`, `address_911`, `zip_code`, `pool_type`, `pool_status`, `pool_open_date`, `ada_access`, `ada_lift`; not the police, council or staff districts | 72 (64 in service), last edited 2026-08-07 | At least 60 rows, 15 percent |
| `ppr_spraygrounds` | City ArcGIS `PPR_Spraygrounds` (OpenDataPhilly "PPR Spraygrounds") | `park_name`, `spray_type`, `spray_status` | 114 (67 spraygrounds, 47 sprinklers; 104 in service), last edited 2026-08-04 | At least 90 rows, 15 percent |
| `ppr_hydration_stations` | City ArcGIS `PPR_Hydration_Stations` (OpenDataPhilly "PPR Hydration Stations") | `amenity_name`, `park_name`, `station_type`, `location` | 147 (93 drinking fountains, 54 bottle filling stations), last edited 2026-09-29 | At least 120 rows, 15 percent |
| `philly311_conditions` | Carto `public_cases_fc` (OpenDataPhilly "311 Service and Information Requests", updated daily), only `service_code` SR-ST02 (Illegal Dumping), SR-ST04 (Street Light Outage), SR-ST06 (Alley Light Outage) and SR-CL01 (Graffiti Removal), made in the last 120 days | the code, `status` (Open or Closed), the days the request was made and closed (in Philadelphia) and the point. Never the request number, address, subject, notes, photo link or agency: they are not even downloaded | 6,496 requests on 2026-10-05 (4,877 dumping, 888 street lights, 345 alley lights, 386 graffiti; 6 without a point), the newest made 2026-10-02 | At least 2,000 rows; no more than 50 percent fewer than last week (these requests rise and fall with the seasons); the newest request no older than 10 days |

The map shows the 311 requests from the 90 days up to the newest one, counted on the nearest street
block within 50 meters, never at an address: on 2026-10-05 the median request lay 9 meters from its
block and 99 percent within 50 meters. Requests about people, such as "Homeless Encampment
Request", are never asked for (docs/ETHICS.md).

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
  weekly Geofabrik Pennsylvania extract filtered locally for anything bulk (`osm_philadelphia`).
- Geofabrik's `-latest` links answer with a redirect to the dated file (since September 2025);
  follow it. Geofabrik asks automated downloaders to send a descriptive User-Agent, to watch their
  scripts, and not to download the same file again and again; the pipeline downloads once a week
  and never again within six days unless forced, or unless the registry's tag list changed since
  the last copy.
- philart.net rejects bare HTTP clients; send a normal browser style User-Agent.
- The Census API needs a free key (an owner action) for block level data.
- The original project's PHS LandCare layer names in its docs are dead; its code already used
  `phs_landcare`.
