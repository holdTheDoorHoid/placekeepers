> **Planner notes (2026-10-04).** Raw research report. The Overpass access problem was the default User-Agent (see report 02 note). OpenStreetMap counts here use a bounding box and slightly overcount.

# Data sources for murals and public art, walkability, population, and environment layers

## Plain language summary

For public art, the strongest combination is three open, structured sources with real coordinates: philart.net's free JSON API (1,268 artworks, verified today), the Association for Public Art's embedded map data (252 artworks with precise coordinates, verified today), and the City's own Percent for Art dataset (239 artworks, a fully open government API). OpenStreetMap and Wikidata add smaller, openly licensed, community maintained counts on top. Mural Arts Philadelphia itself has by far the largest collection (2,012 artwork pages, counted from their sitemap today), but their terms of use explicitly forbid building a database from their content, so their site should be linked to, not scraped into our own map.

For walkability, do not build the map around Walk Score: their terms explicitly forbid storing or caching scores, which rules out a toggleable public layer. The better path is the EPA's free National Walkability Index (census block group level, a large download) combined with OpenStreetMap derived measures the project computes itself. For biking comfort, DVRPC's Level of Traffic Stress dataset is explicitly unrestricted and covers Philadelphia. For sidewalks, DVRPC's pedestrian data exists but is admitted by DVRPC itself to be based on 2018 imagery for Philadelphia and not field checked since.

For population and context, Philadelphia's open data is in good shape: neighborhood boundaries are Creative Commons licensed, Census ACS data is public domain, and the Reinvestment Fund's Market Value Analysis is available directly from the City for displacement and market context (better than the Urban Displacement Project, which does not appear to cover Philadelphia specifically).

For environment and amenities, most City layers (trees, parks, heat vulnerability, green stormwater infrastructure, flood zones, litter, 311, schools) are available through OpenDataPhilly with working download and API links, all confirmed today. The one clear weak spot is impervious surface data, which is dated to 1996 and 2004, and community fridges, which do not appear to be mapped in OpenStreetMap at all yet.

Everything below is marked VERIFIED (checked this session) or UNVERIFIED (not confirmed, or blocked), with a URL for every claim.

---

## A. Murals and public art

### Mural Arts Philadelphia (muralarts.org)

- **WordPress REST API check**: VERIFIED. `https://muralarts.org/wp-json/wp/v2/types` lists only standard WordPress content types (post, page, attachment, nav menu items, templates, plus an unrelated shop plugin). There is no "artworks" or "tours" custom post type exposed through the REST API. No map data endpoint was found in the artworks page source.
- **What it contains / record count**: VERIFIED. The `/artworks/` page is a searchable, filterable (by neighborhood, sort, map or tile view) directory. Its own sitemap files give an exact count: `https://muralarts.org/artworks-sitemap.xml` (1,000 URLs) plus `artworks-sitemap2.xml` (1,000) plus `artworks-sitemap3.xml` (12) equals **2,012 artwork pages**, fetched and counted today. This is the largest single collection found for Philadelphia murals and public art.
- **Location precision**: addresses and neighborhood tags per page; not confirmed whether machine readable coordinates are embedded (not needed, see license below).
- **Access method**: website browsing only (HTML pages), no API, JSON, or bulk download found.
- **Terms of use**: VERIFIED at `https://muralarts.org/terms-of-use/`. No open license. The terms explicitly state content may not be modified, copied, distributed, or used to "develop, or as a component of, any information, storage and retrieval system, database, information base, or similar resource," and limit use to personal, non-commercial participation in Mural Arts programs. **This means scraping their site into our own database is against their terms, regardless of technical feasibility.** Best use: link out to individual Mural Arts pages per artwork, do not import their text or images into our own database without asking them directly.
- **Freshness**: sitemap shows `lastmod` of today (2026-10-04), actively maintained.
- **Tours page** (`https://muralarts.org/tours/`): VERIFIED. Offers guided tours and a self-guided GPS option with a downloadable PDF of walking routes. No API, GPX, or KML export found.

### Public Art Archive, Mural Arts collection

- **URL used in task** (`https://publicartarchive.org/collections/Mural-Arts-Philadelphia`) now lives at `https://explore.publicartarchive.org/mural-arts-philadelphia/`. VERIFIED reachable, with search and filter by artist, collection, material, placement, type, year, city, and theme, plus a map view (`?mapShow=true` is supported).
- **Record count**: UNVERIFIED. No total count is shown on the page itself.
- **Access method**: web browsing only. No API or bulk export found.
- **Terms of use**: VERIFIED at `https://explore.publicartarchive.org/terms-of-use`. Permits fair use (17 U.S.C. 107), classroom or workshop use by educators at nonprofit or government schools, and press use for timely news stories, all requiring attribution and a citation back to the site URL. Commercial use or anything outside those categories requires written permission from Creative West (the archive's operator). No Creative Commons license, no API, no bulk download.

### Philadelphia's Magic Gardens mosaic mural map

- VERIFIED: it is a Google My Maps embed. The page's iframe points to `https://www.google.com/maps/d/embed?mid=1_yR1palb-OAC8JNb7B0vabKjJIEj6Gw`.
- **KML export works**: VERIFIED by downloading `https://www.google.com/maps/d/kml?mid=1_yR1palb-OAC8JNb7B0vabKjJIEj6Gw&forcekml=1` today (498,551 bytes, well under the size budget). It contains **231 placemarks** organized into five folders: "PMG Campus," "In Philly," "Mosaicked Alleys," "Outside Philly," and "Demolished." Only the first three folders represent current Philadelphia mosaic murals; the other two should be excluded or separately flagged when importing.
- **Location precision**: point coordinates per placemark (from Google My Maps).
- **Terms of use**: UNVERIFIED. No terms of use page was found on phillymagicgardens.org (`/terms-of-use/` returns 404, and no footer link to any terms page exists). Treat as all rights reserved pending direct contact with Philadelphia's Magic Gardens, though the fact that they publish a public, exportable Google My Maps strongly suggests they intend it for public wayfinding reuse.
- **Freshness**: not independently dated; Google My Maps shows last edit date in its own interface, not captured in the KML file itself.

### Reddit thread

- UNVERIFIED / inaccessible. `https://www.reddit.com/r/philadelphia/comments/1oll10f/...` could not be fetched: the fetch tool explicitly reported it is unable to access www.reddit.com. Noted and not pursued further, per the task's guidance on gated sources.

### Association for Public Art

- **What it contains**: VERIFIED. The Public Art Map page (`https://associationforpublicart.org/public-art-map/`, part of their "Museum Without Walls" program) embeds a complete, structured JSON dataset directly in the page's HTML, inside a `<script type="application/json" data-pam-data>` tag.
- **Record count**: VERIFIED by fetching and parsing the page today: **252 artworks**.
- **Fields**: id, title, artist, artist_sort, url, image, thumb, focal point, themes, categories, year, and precise `lat`/`lng` per artwork. This is one of the most structured and precise sources found.
- **Access method**: embedded JSON on a normal web page (technically extractable, but see terms below). A separate `/wp-json/vast/v1/search` endpoint exists but is a keyword search API, not a bulk data endpoint (it returns an empty result set with no query).
- **Terms of use**: VERIFIED at `https://associationforpublicart.org/copyright-policy-and-terms-of-use/`. Restricted to "limited non-commercial, not-for-profit, personal, and educational purposes" with attribution; commercial use is explicitly prohibited; no Creative Commons or open license is granted; other uses require written permission (contact apa@associationforpublicart.org). No explicit anti-scraping clause, but the broad copy and distribute prohibition would likely cover bulk reuse.

### City of Philadelphia public art collection (Percent for Art)

- **What it contains**: VERIFIED via OpenDataPhilly's catalog: "Percent for Art Locations," published by the City of Philadelphia (Department of Planning and Development), described as "Locations and basic information on public art that is part of the Percent for Art program. Updated as needed."
- **Record count**: VERIFIED by direct query today (`SELECT count(*) FROM percent_for_art_public` against the City's Carto SQL API): **239 records**.
- **Access method**: fully open government API. CSV: `https://phl.carto.com/api/v2/sql?filename=percent_for_art_public&format=csv&skipfields=cartodb_id,the_geom,the_geom_webmercator&q=SELECT%20%2A%20FROM%20percent_for_art_public`. Also available as SHP and GeoJSON through the same Carto SQL API, plus a browsable API explorer at `https://cityofphiladelphia.github.io/carto-api-explorer/#percent_for_art_public`. All confirmed reachable today.
- **License**: the City's standard terms apply (see "City of Philadelphia standard terms" note below): free to use, but not a formal open license.
- **Freshness**: "Updated as needed," no fixed cadence stated.

### Philadelphia Public Art at philart.net (found via the City's own open data catalog, highly relevant)

- **What it contains**: VERIFIED. A genuine, free, read only JSON API at `https://www.philart.net/api.html`, covering artwork title, artists, years, latitude and longitude, comments, inscriptions, related pieces, architectural classification, landmark associations, people references, external links, images, and content categories. Endpoints include `/api/art.json`, `/api/artists.json`, `/api/people.json`, `/api/landmarks.json`, `/api/tours.json`, `/api/exhibits.json`, per record detail at `/api/art/[id].json`, and a geolocation endpoint `/api/geo.json` that accepts latitude and longitude with a bounding box.
- **Record count**: VERIFIED by directly fetching `https://www.philart.net/api/art.json` today: **1,268 art entries**. (Direct fetching requires a normal browser style User-Agent header; the server returns a ModSecurity block to very bare HTTP clients, but this is not a Cloudflare or CAPTCHA style challenge, just a header requirement.)
- **Terms of use**: VERIFIED from `https://www.philart.net/api.html`: "This API is offered as-is... offers no guarantees of up-time, bug-free operation, or data accuracy... not intended... as the basis of any commercial application." The underlying data is described as copyrighted, but the JSON format itself can be used freely without claiming ownership of it. This reads as permissive for a non-commercial, civic project, though it would be worth emailing the site owner before large scale reuse given the data itself is called copyrighted.
- **Freshness**: not independently dated this session.

### PDFs: Mural Mile (Penn) and Philly Mural Hike (AMC-DV)

- **Mural Mile** (`https://nso.upenn.edu/wp-content/uploads/2024/08/Mural-Mile.pdf`, 4.25 MB): VERIFIED by downloading and reading in full today. A University of Pennsylvania New Student Orientation walking tour combining two Mural Arts "Mural Mile" routes near Center City and Penn, listing 16 murals with addresses, artists, and years. Every entry carries an explicit copyright line such as "©2010 City of Philadelphia Mural Arts Program," confirming the underlying murals (and this derivative tour sheet) are Mural Arts copyrighted content. Useful only as a human readable reference or for cross checking addresses, not as a redistributable dataset.
- **Philly Mural Hike** (`https://amcdv.org/wp-content/uploads/2021/02/philly-mural-hike-info-amc-dv-final.pdf`, 0.92 MB): VERIFIED by downloading and reading in full today. An alumni association walking guide listing 30 murals (numbered 1 through 30, including two sub stops 8A and 8B) with addresses and descriptive text, explicitly adapted from Mural Arts' own tour material. No explicit license or copyright statement appears in the document itself, but since its content is derived from Mural Arts' copyrighted collection, it should be treated the same cautious way.
- Neither PDF includes coordinates (only street addresses, which would need geocoding), and both are small, curated subsets compared to the full Mural Arts (2,012) or philart.net (1,268) catalogs.

### OpenStreetMap (Overpass API)

- **Access note**: VERIFIED that `overpass-api.de` returns HTTP 406 to this session's direct network requests regardless of headers tried (including descriptive User-Agent strings and explicit Accept headers; even the bare root path returned 406), consistent with a block on this sandbox's outbound network rather than anything query specific. Fetching through the web fetch tool (different network path) succeeded. All Overpass figures below are VERIFIED, obtained today through that path.
- **Philadelphia boundary**: VERIFIED. OpenStreetMap relation id 188022, `admin_level=8`, Wikidata id Q1345, with a `population` tag of 1,603,797 matching the 2020 Census figure.
- **Bounding box caveat**: queries against the full administrative boundary polygon (the `area()` statement) consistently timed out, likely from polygon complexity combined with public server load. All counts below instead use a bounding box (roughly 39.867 to 40.138 north, routes -75.2803 to -74.9558 east) that closely surrounds the city but is a rectangle, so it can include a small sliver of neighboring Delaware, Montgomery, and Bucks counties in Pennsylvania and Camden County in New Jersey along the city's edges. Treat all figures below as approximate, very slightly over counted estimates, not exact city boundary totals.
- **tourism=artwork, all types** (nodes, ways, and relations combined): VERIFIED, **447**.
- **tourism=artwork by artwork_type** (nodes only, so a subset of the 447 total above): mural **42**, sculpture **130**, statue **195**, mosaic **2**, graffiti **0**. These five named subtypes sum to 369 of the 447 total; the remaining 78 are either ways and relations (not counted in this node only breakdown) or nodes tagged with no artwork_type or a type outside this list (for example "installation").
- **historic=memorial** (nodes): VERIFIED, **219**.
- **memorial=ghost_bike** (nodes): VERIFIED, **7**.
- **License**: Open Database License (ODbL), requiring attribution and share alike for derived databases. Access is free through the Overpass API for ad hoc queries, or through periodic extract downloads (for example Geofabrik's Pennsylvania extract) for bulk use.

### Wikidata

- **Query**: VERIFIED via `https://query.wikidata.org/sparql` today. Counting items that are an instance of public art, mural, sculpture, statue, street art, or monument, located in Philadelphia (property P131 equals Q1345), and carrying a coordinate (property P625): **43 items**.
- **Caveat**: P131 only matches items whose direct parent is Philadelphia itself; an item tagged as located in a specific Philadelphia neighborhood rather than the city would be missed, so this likely undercounts relative to a looser geographic query.
- **License**: CC0 (public domain), Wikidata's standard data license.
- **Access**: free SPARQL endpoint, no key needed. Note that an unbounded query using a transitive subclass path timed out; the simpler query above (fixed list of classes) ran quickly.

### Recommendation for Section A: best combination and deduplication

Build the base public art layer from three openly structured, coordinate bearing sources: **philart.net** (1,268 records, broadest scope, free JSON API), the **Association for Public Art**'s public art map data (252 records, precise coordinates, strong curation of prominent works), and the City's own **Percent for Art Locations** (239 records, genuinely open government API, CSV, SHP, GeoJSON). Layer **OpenStreetMap**'s tourism=artwork points (447 in the test area, ODbL licensed, community correctable) on top as a supplementary, editable layer, and optionally cross check against **Wikidata**'s smaller but fully public domain set (43). Treat **Mural Arts Philadelphia**'s own site (2,012 pages, the largest and most authoritative source specifically for murals) as a link out target only, not a scrape source, given its terms of use explicitly forbid building a database from its content; the project should consider contacting Mural Arts directly about a data sharing arrangement given the shared civic mission. The two walking tour PDFs are useful only as small, human curated cross checks.

For deduplication: match primarily on rounded coordinates (four to five decimal places, roughly building level precision), with title and artist as a secondary signal where coordinates differ slightly between sources. Where a source only has a street address (the two PDFs), geocode first, then apply the same coordinate match. Keep a `source` field per record so the map can show, and link to, all sources that agree on a given artwork, including a courtesy link to the relevant Mural Arts page where one exists, which is ordinary web linking and not a reuse of their data.

---

## B. Walkability

### EPA National Walkability Index

- **Version and geography**: VERIFIED via `https://www.epa.gov/smartgrowth/smart-location-mapping` today. The current version was last updated in 2021, published at the census block group level.
- **Download**: VERIFIED reachable, `https://edg.epa.gov/EPADataCommons/public/OA/WalkabilityIndex.zip`, confirmed by a direct size check today at **425,281,342 bytes (about 405 MB)**. This file was not downloaded in this session because it is far larger than the 20 MB per file budget; the project should download it directly when ready and filter to Philadelphia block groups afterward, or use the ArcGIS web services mentioned on the same EPA page.
- **License**: UNVERIFIED exact statement. As a U.S. federal government product it is conventionally public domain, but no explicit license statement was found on the fetched page.

### Walk Score API

- **Terms, verified directly**: VERIFIED by fetching `https://www.walkscore.com/tile-terms-of-use.shtml` today (linked from the API page at `https://www.walkscore.com/professional/api.php`). The relevant clause reads: "You will not provide a means to execute any 'bulk download' operations; cache or otherwise store any Walk Score content including but not limited to Walk Score, Bike Score, and Transit Score ratings... without WS's prior written consent."
- **Practical effect**: scores cannot legally be stored in our own database and served from a public toggleable map layer without Walk Score's written permission. They would need to be called live from Walk Score's API on every view, which is still subject to their pricing and rate limits (pricing tiers were not visible in the page content fetched this session).
- **Recommendation**: do not build a storable public layer on Walk Score. Either skip it, or treat it as an optional live lookup widget pending direct permission from Walk Score.

### OpenStreetMap derived approaches

- This is a method, not a ready made dataset, so no record count or license claim is made here. Two standard building blocks: intersection density (counting OpenStreetMap street network nodes with three or more connecting ways, a core input to EPA's own index), and "destinations within a ten minute walk" (combining the OpenStreetMap street network with point of interest tags such as `shop=*`, `amenity=*`, and `leisure=*`, run through a routing or isochrone tool). The same Overpass query technique demonstrated in Section A can supply the raw data; the routing computation itself is the project's own work. Reference: `https://wiki.openstreetmap.org/wiki/Overpass_API` and `https://wiki.openstreetmap.org/wiki/Key:highway`.

### Sidewalk and curb ramp data for Philadelphia

- **OpenDataPhilly**: VERIFIED absent. A full keyword scan of the City's catalog (`https://opendataphilly.org/data.json`, 473 datasets, fetched today) found no dedicated Philadelphia sidewalk or curb ramp inventory, only tangential items such as Complete Streets and Sidewalk Cafe By Right Area.
- **DVRPC Greater Philadelphia Pedestrian Portal**: VERIFIED at `https://walk.dvrpc.org/about/`, fetched today. Inventories sidewalks (as line features), crosswalks (lines), and curb ramps (points, marking "where a ramp is present or should be"). Built from aerial imagery, with Philadelphia's portion built from **2018 imagery** (surrounding counties from 2015 to 2017). DVRPC's own page states plainly that there has been **no field verification**, and that the data "has become outdated since creation" as new infrastructure has been built since. This freshness caveat should be shown prominently in the project's user interface if this layer is used.
- **Access**: interactive map at `https://walk.dvrpc.org/`, plus DVRPC's GIS data portal for download. The exact file formats were not fully enumerated in what was fetched this session. A related catalog entry, "Pedestrian Network Sidewalk Gap Ratio," was found by search at `https://catalog.dvrpc.org/dataset/pedestrian-network-sidewalk-gap-ratio` but returned a 404 when fetched directly today; the project should browse `https://catalog.dvrpc.org/` directly (searching "sidewalk" or "pedestrian") to find the current working link, since that catalog platform is confirmed functional (see the Level of Traffic Stress entry below).
- **A frequently cited figure** (DVRPC estimates roughly 230 miles of Philadelphia streets have no sidewalks at all, because none were ever built) appeared in search results but was not independently re-confirmed against a primary DVRPC page this session; treat as UNVERIFIED pending a direct citation.
- **License**: not confirmed for this specific dataset this session.

### DVRPC bicycle Level of Traffic Stress

- **Dataset**: VERIFIED at `https://catalog.dvrpc.org/dataset/dvrpc-level-of-traffic-stress-lts-network`, fetched today.
- **License**: VERIFIED, quoted directly: "Unrestricted: can be shared internally and externally without data sharing agreement." Not a formal Creative Commons or ODbL license, but explicitly permissive in DVRPC's own words.
- **Formats**: VERIFIED. Shapefile, GeoJSON through an API, GeoParquet, vector tiles, and CSV through a data table interface.
- **Geography**: VERIFIED to cover the DVRPC nine county region, including Philadelphia.
- **Freshness**: VERIFIED. Catalog record created April 10, 2026, last modified September 3, 2026, with an "as needed" update frequency, so about one month old as of this research.
- **Why not the City's own Bike Network layer instead**: VERIFIED by directly inspecting its field schema today (`https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Bike_Network/FeatureServer/0`): its fields are purely physical (street name, type, segment id, one way, class, paving year, bikeway type, facility code, bike flow and side, and so on), with **no traffic stress or comfort rating field at all**. DVRPC's dedicated LTS dataset is the right source for a stress based score, not the City's bike lane inventory.

---

## C. Population and social context

### Census 2020 block population and the latest ACS 5 year release

- **API key requirement**: VERIFIED directly today. Calling the 2020 Decennial Census (P.L. 94-171 redistricting) block level API without a key, for example `https://api.census.gov/data/2020/dec/pl?get=NAME,P1_001N&for=block:*&in=state:42+county:101+tract:000100`, returns an explicit "Missing Key" error page rather than data. A similar unauthenticated request against the 2024 ACS 5 year endpoint returned an HTTP redirect rather than data. Budget for needing a free Census API key (instant signup at `https://api.census.gov/data/key_signup.html`) for reliable, scriptable access; account creation itself was not performed in this session since it falls outside pure data gathering.
- **Latest ACS 5 year release**: VERIFIED through OpenDataPhilly's own catalog entry "Census ACS 5-Year Estimates - Philadelphia" (`https://opendataphilly.org/data.json`, modified January 29, 2026), whose example API calls all target `/data/2024/acs/acs5`, meaning the **2020 to 2024 five year estimates** (vintage year 2024) are the current release referenced. Geography levels confirmed available: county, census tract, and block group.
- **License**: VERIFIED, CC0 (public domain), per the same catalog entry.
- **Access**: `https://api.census.gov/data/2024/acs/acs5`, documented at `https://www.census.gov/data/developers/data-sets/acs-5year.html`.

### CDC PLACES

- **Current release**: VERIFIED by search today: "PLACES: Local Data for Better Health, Census Tract Data, 2025 release," at `https://data.cdc.gov/500-Cities-Places/PLACES-Local-Data-for-Better-Health-Census-Tract-D/cwsq-ngmh`.
- **Geography**: VERIFIED at `https://www.cdc.gov/places/index.html`: county, place, census tract, and ZIP Code Tabulation Area levels.
- **API, directly tested**: VERIFIED. `https://data.cdc.gov/resource/cwsq-ngmh.json` is a Socrata JSON API that works **without any API key**. A direct query filtered to Philadelphia today returned live tract level records, for example tract 42101012203, measure "Short sleep duration among adults," with a point coordinate and confidence interval.
- **Underlying survey vintage**: VERIFIED from the returned records: the 2025 release's measures are modeled mostly from **2022** Behavioral Risk Factor Surveillance System (BRFSS) data (a small number of measures use 2021 BRFSS data instead).
- **License**: UNVERIFIED exact statement; general CDC open data conventions apply (U.S. federal data).

### CDC and ATSDR Social Vulnerability Index (SVI)

- **Latest year**: VERIFIED at `https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html`, fetched today: data years available are 2000, 2010, 2014, 2016, 2018, 2020, and **2022** (the current latest).
- **Geography**: VERIFIED, census tract level within county, plus county and state summaries.
- **Access**: through the "Data and Documentation Download" page above, CSV format confirmed mentioned.
- **License**: UNVERIFIED exact statement; ATSDR asks for citation and acknowledgment but no formal license was found on the page.

### DVRPC Indicators of Potential Disadvantage

- UNVERIFIED this session. Not independently fetched due to time budget; it is a known DVRPC regional equity product. The project should check `https://catalog.dvrpc.org/` directly (search "disadvantage" or "equity"), since that catalog platform was confirmed working for the Level of Traffic Stress dataset above.

### Displacement and gentrification typologies

- **Urban Displacement Project**: UNVERIFIED whether it covers Philadelphia specifically. Direct fetches of `https://www.urbandisplacement.org/maps/philadelphia/` returned HTTP 403 both through the web fetch tool and through a direct request with full browser headers (treated as gated, not bypassed, per the task's rules). A search today of the project's own site and GitHub (`https://github.com/urban-displacement/displacement-typologies`, `https://www.urbandisplacement.org/`) found named interactive maps for New York, Portland, Southern California, and the San Francisco Bay Area, and a claim of "15 plus" metro areas covered overall, but did not surface a specifically named Philadelphia map. The underlying methodology is open source, so it could in principle be run locally against Philadelphia tract data, but that would be a significant project undertaking, not a ready made dataset.
- **Reinvestment Fund Market Value Analysis (MVA), the better fit for Philadelphia**: VERIFIED directly available through OpenDataPhilly as "Market Value Assessment (MVA)," service name `mva_2023` (2023 vintage), with CSV, Shapefile, GeoJSON, and ArcGIS FeatureServer API access, all confirmed reachable today (for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/mva_2023/FeatureServer/0/query`). License: the City's standard terms (see note below). This is the recommended displacement and market context layer for this project.

### Philadelphia neighborhood boundaries

- VERIFIED via OpenDataPhilly's own GitHub hosted dataset "Philadelphia Neighborhoods," `https://github.com/opendataphilly/odp-data-storage/blob/master/philadelphia-neighborhoods/`, covering **150 plus neighborhoods**, last modified April 24, 2024.
- **License**: VERIFIED, **Creative Commons Attribution 4.0 (CC BY 4.0)**, fully open with attribution only, the best licensed boundary file found in this research.
- **Formats**: Shapefile, GeoJSON, GeoPackage, and GeoParquet, all confirmed present.

### Registered Community Organizations (RCO)

- VERIFIED via OpenDataPhilly: "Registered Community Organizations (RCO) Boundaries," City of Philadelphia (Department of Planning and Development), established under the 2011 zoning code, effective August 2012. CSV, Shapefile, GeoJSON, and ArcGIS FeatureServer API all confirmed reachable today, for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Zoning_RCO/FeatureServer/0/query`.
- **License**: the City's standard terms (see note below).

### Council districts

- VERIFIED via OpenDataPhilly: "City Council Districts," with four vintages available (2024, 2016, 2000, and 1990 redistricting cycles), each with CSV, Shapefile, GeoJSON, and API access confirmed. Use the 2024 vintage for current boundaries, for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/Council_Districts_2024/FeatureServer/0/query`.
- **License**: the City's standard terms (see note below).

### A note on "the City of Philadelphia's standard terms"

Many City datasets link their license to `https://metadata.phila.gov/#help/help-faqs/what-are-the-terms-of-use/`, which is a JavaScript rendered page this session could not load directly (it returned only an empty shell through both direct fetching and the web fetch tool). A search today surfaced a quoted excerpt of that page's actual text: City data is free to use, but "the City of Philadelphia reserves all rights in the database and any data contained therein," the end user receives no ownership or title, and the user must "hold the City of Philadelphia harmless from any claims, damages, or liabilities arising from use of the data." This is VERIFIED only as a search snippet quoting the page, not as a direct fetch of the primary page itself; treat it as free to use in practice, but not a formal open license like Creative Commons or ODbL, and not warrantied. The City's separate general website terms of use (`https://www.phila.gov/terms-of-use/`, fetched directly today) are considerably more restrictive and appear aimed at ordinary web content (text, images) rather than the open data catalog; they explicitly reference a separate "Open Data program" page as governing datasets, consistent with the snippet above.

---

## D. Environment and amenities

Note: the datasets in this section were primarily discovered and verified through a single, efficient method: fetching the City of Philadelphia's entire open data catalog at `https://opendataphilly.org/data.json` today (a DCAT formatted file covering all 473 current OpenDataPhilly datasets) and searching it directly, then spot checking individual dataset access URLs. Every dataset named below as "VERIFIED via catalog" was confirmed present in that file today, with its listed access URLs test fetched where noted.

### Tree canopy

- VERIFIED: "PPR Tree Canopy" on OpenDataPhilly. The current layer describes canopy **change between 2008 and 2018** (an Urban Tree Canopy assessment), the most recent canopy coverage assessment found. An older 2015 canopy outlines and points layer also exists but is superseded for current state purposes. Formats: Shapefile, CSV, GeoJSON, and both ArcGIS FeatureServer and Carto SQL API access, all confirmed reachable today, for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/TreeCanopyChange_2008_2018/FeatureServer/0/query`.
- **License**: the City's standard terms (see note above).

### Philadelphia Parks and Recreation street tree inventory

- VERIFIED: "Philadelphia Tree Inventory" on OpenDataPhilly, "a comprehensive inventory of all trees within the limits of the City of Philadelphia," originally a 2021 snapshot that the catalog states "will update yearly." VERIFIED fresh: separate dataset vintages exist for **2021 through 2025**, each with its own CSV, Shapefile, GeoJSON, and ArcGIS FeatureServer endpoint (for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/ppr_tree_inventory_2025/FeatureServer/0/query` for the newest).
- **License**: the City's standard terms.

### Heat Vulnerability Index

- VERIFIED: "Heat Vulnerability by Census Tract" on OpenDataPhilly, City of Philadelphia, described as incorporating "exposure and sensitivity indicators" by tract. CSV, Shapefile, GeoJSON, and API all confirmed reachable today, for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/heat_vulnerability_ct/FeatureServer/0/query`. The exact assessment year was not stated in the catalog description; UNVERIFIED precise vintage.
- **License**: the City's standard terms.

### Urban heat measurement (NOAA and CAPA Heat Watch)

- VERIFIED by search today, corroborated across `noaa.gov` press releases, `phillyvoice.com`, and `whyy.org`: Philadelphia took part in a NOAA funded, CAPA Strategies run "Heat Watch" citizen science urban heat mapping campaign, one of 14 participating cities and counties, with Philadelphia specifically pairing heat mapping with mobile air quality monitoring through a partnership involving Drexel University and the Academy of Natural Sciences.
- **Results cited**: hottest measured temperature 95 degrees Fahrenheit, with more than a 10 degree difference between the hottest and coolest measured areas of the city.
- **Gap**: UNVERIFIED exact campaign year and a direct data download link; this session's search covered multiple NOAA program years without landing on a single definitive Philadelphia results page or dataset. Recommend following up directly at NOAA's urban heat island program pages or `https://www.heat.gov` for the specific Philadelphia report and any underlying data file.

### Impervious surface

- VERIFIED, and flagged as a weak point: "Impervious Surfaces" on OpenDataPhilly is explicitly described as derived from "the aerial survey project of 1996 and updated using new aerial photography collected between 25 March 2004 and 23 April 2004." That makes it over twenty years old as of this research. Available as Shapefile through PASDA and an S3 hosted zip file, both confirmed present in the catalog.
- **Possible fresher alternative**: the same catalog scan surfaced "Delaware River Basin High-Resolution Land Cover" and "Pennsylvania Statewide High-Resolution Tree Canopy," both land cover classification products that typically include an impervious surface class and are often considerably newer. Their exact vintage was not fetched this session; UNVERIFIED currency, but worth checking before defaulting to the 1996 and 2004 layer.
- **License**: the City's standard terms for the City hosted copy.

### Philadelphia Water Department green stormwater infrastructure sites

- VERIFIED: two OpenDataPhilly datasets, "Green Stormwater Infrastructure Public Projects" (split into point and street line layers) and "Green Stormwater Infrastructure Private Projects" (split into regulated and retrofit layers), both from the Philadelphia Water Department. CSV, Shapefile, GeoJSON, and API access confirmed for all four sub layers, for example `https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/GSI_Public_Projects_Point/FeatureServer/0/query`.
- **License**: the City's standard terms.

### Flood hazard

- VERIFIED: "FEMA Flood Plain," City hosted and clipped to Philadelphia, current vintage `fema_floodplain_2023` (older 2007 vintages also retained for comparison), CSV, Shapefile, GeoJSON, and API all confirmed. A second dataset, "Flood Hazard Zone Lines," provides FEMA's own Digital Flood Insurance Rate Map data by county (Bucks, Chester, Montgomery, and Philadelphia) as Shapefiles hosted on PASDA. The City hosted 2023 vintage is the more current and conveniently packaged option.
- **License**: City standard terms for the City hosted layer; FEMA's own federal public domain status for the PASDA hosted DFIRM shapefiles.

### Trust for Public Land ParkServe

- **Philadelphia coverage confirmed**: VERIFIED by search today at `https://www.tpl.org/city/philadelphia-pennsylvania`: **96.8 percent of Philadelphia's population lives within a ten minute walk of a park with public access.**
- **Direct site access blocked**: both `https://www.tpl.org/parkserve` and `https://www.tpl.org/park-data-downloads` returned HTTP 403 when fetched directly today, with and without full browser style headers; treated as gated and not bypassed, per the task's rules.
- **Downloads, confirmed by search rather than direct fetch**: available at `https://www.tpl.org/park-data-downloads` in Shapefile and Esri File Geodatabase formats, including park polygons, ten minute walk service areas, priority areas, trails, and playgrounds, with a 2025 dated technical documentation file found at `https://parkserve.tpl.org/downloads/ParkServe_Documentation_2025.pdf`, suggesting a 2025 data vintage.
- **Independently confirmed working API**: VERIFIED today that a public ArcGIS layer for "ParkServe 10 minute walk Service Areas" is live, `https://services9.arcgis.com/FF3qnCUixr5w9JQi/arcgis/rest/services/ServiceAreas_Clip/FeatureServer/0`, with a confirmed schema (object id, name, park id, park name, shape area, shape length). It has no simple city or state field to filter by, so using it for Philadelphia specifically would require a spatial filter against the city boundary rather than a simple attribute query.
- **License**: UNVERIFIED exact terms, since the terms page itself could not be reached this session.

### Parks and Recreation properties and facilities

- All VERIFIED present on OpenDataPhilly with CSV, Shapefile, GeoJSON, and API access: "PPR Properties," "PPR Playgrounds," "PPR Swimming Pools," "PPR Spraygrounds," plus related layers for tennis courts, picnic sites, adult exercise equipment, hydration stations, building structures, boat launches, and "Registered Community Gardens" (Urban Agriculture Team). All City of Philadelphia, standard terms.

### Libraries

- **Gap identified**: VERIFIED absent from OpenDataPhilly. The only library related catalog entry is "Free Library of Philadelphia RSS Feeds" (events, blog, podcast, and book review feeds), not a branch location dataset.
- A direct check of `https://www.freelibrary.org/locations/` returned HTTP 403 today, gated and not bypassed. UNVERIFIED whether a structured open branch locations dataset exists elsewhere; the project may need to compile branch addresses manually, or query OpenStreetMap for `amenity=library` points (the same Overpass technique demonstrated above was not run for this specific tag this session, but would follow the identical pattern).

### Schools

- VERIFIED: "Schools" on OpenDataPhilly (points for public, charter, many private schools, school annexes, and athletic facilities), City of Philadelphia, CSV, Shapefile, GeoJSON, and API access confirmed. A large separate family of School District of Philadelphia datasets (catchment areas, enrollment and demographics, performance, and more) was also found in the catalog, each with its own recent 2025 to 2026 modification dates.

### Streets Department Litter Index

- VERIFIED: "Litter Index" on OpenDataPhilly, Streets Department, "updated annually," with separate block level, neighborhood level, and survey level layers, plus a public dashboard at `https://streetsmartphl.phila.gov/`. An archived 2007 to 2015 predecessor dataset also exists for historical trend comparison.

### 311 service requests

- **Coverage**: VERIFIED: "all service and information requests since December 8, 2014," updated daily.
- **Access**: Carto SQL API at `https://phl.carto.com`, with the catalog pre building convenient year by year CSV and Shapefile download links from 2014 through 2026 and an explicit note that the full dataset is very large, recommending the API for anyone comfortable with it.
- **Categories, directly confirmed by a live query today** (counts shown are 2026 year to date only, to illustrate category names, not full history): Information Request, Rubbish and Recyclable Material Collection, Maintenance Complaint, Abandoned Vehicle (10,212), Illegal Dumping (10,154), Street Defect, Street Trees (3,700), Street Light Outage (2,356), Dangerous Sidewalk (1,772), Graffiti Removal (1,630), Alley Light Outage (753), Dumpster Violation, Homeless Encampment Request, and more than a dozen other, lower volume categories. Note that "vacant lot clean up" is not itself a 311 category; the City tracks that separately through the "Vacant Lot Cleanups" dataset (Community Life Improvement Program), also confirmed present on OpenDataPhilly with CSV, Shapefile, GeoJSON, and API access.

### Street light locations

- VERIFIED: "Street Poles" on OpenDataPhilly (Streets Department, Street Lighting Division), CSV, Shapefile, GeoJSON, and API access confirmed. Philadelphia's dataset models individual poles rather than a separately named "street lights" layer.

### Commercial corridors

- VERIFIED: "Commercial Corridors of Philadelphia" on OpenDataPhilly (Planning Department), CSV, Shapefile, GeoJSON, and API access confirmed.

### OpenStreetMap amenity counts (Overpass, same bounding box and caveats as Section A)

- `amenity=bench` (nodes): VERIFIED, **2,822**.
- `amenity=drinking_water` (nodes): VERIFIED, **46**.
- `amenity=toilets` (nodes): VERIFIED, **116**.
- `amenity=public_bookcase` (nodes): VERIFIED, **192**.
- `amenity=community_fridge` (nodes): VERIFIED, **0**.
- `food_sharing=community_fridge` (nodes, an alternate tagging scheme also tested): VERIFIED, **0**.
- Community fridges appear to be essentially unmapped in OpenStreetMap for Philadelphia under either common tagging convention. The project will most likely need a grassroots source for this layer (for example a local mutual aid network's own published list, not identified or verified in this session) rather than relying on OpenStreetMap, at least until volunteers start tagging them.

---

## Master table of sources

| Section | Name | Publisher | URL | Access method | Format | Geography | Cadence | License | Status |
|---|---|---|---|---|---|---|---|---|---|
| A | Mural Arts Philadelphia artworks | Mural Arts Philadelphia | muralarts.org/artworks/ | website, sitemap | HTML | point (address) | continuous | all rights reserved, no database use allowed | VERIFIED |
| A | Public Art Archive, Mural Arts collection | Creative West | explore.publicartarchive.org/mural-arts-philadelphia | website | HTML | point | unknown | fair use, education, press only, no CC | VERIFIED (no count) |
| A | Magic Gardens mosaic mural map | Philadelphia's Magic Gardens | phillymagicgardens.org (Google My Maps) | KML download | KML | point | unknown | unstated, likely all rights reserved | VERIFIED |
| A | r/philadelphia mural map thread | Reddit user | reddit.com/r/philadelphia/comments/1oll10f | blocked | n/a | n/a | n/a | n/a | UNVERIFIED, blocked |
| A | Association for Public Art, Public Art Map | Association for Public Art | associationforpublicart.org/public-art-map | embedded JSON | JSON | point (lat/lng) | unknown | non-commercial, educational only | VERIFIED |
| A | Percent for Art Locations | City of Philadelphia | opendataphilly.org, phl.carto.com | API (Carto SQL) | CSV, SHP, GeoJSON | point | updated as needed | City standard terms | VERIFIED |
| A | Philadelphia Public Art (philart.net) | philart.net | philart.net/api.html | free JSON API | JSON | point (lat/lng) | unknown | as-is, non-commercial preferred | VERIFIED |
| A | Mural Mile (Penn NSO) PDF | University of Pennsylvania | nso.upenn.edu, Mural-Mile.pdf | PDF download | PDF | address | 2024 edition | derivative of Mural Arts copyright | VERIFIED |
| A | Philly Mural Hike (AMC-DV) PDF | AMC-DV alumni association | amcdv.org, philly-mural-hike-info | PDF download | PDF | address | 2021 edition | unstated, derivative content | VERIFIED |
| A | OpenStreetMap tourism=artwork etc. | OSM contributors | overpass-api.de | Overpass API | JSON | point | continuous, crowd sourced | ODbL | VERIFIED |
| A | Wikidata public art in Philadelphia | Wikidata contributors | query.wikidata.org/sparql | SPARQL API | JSON | point | continuous, crowd sourced | CC0 | VERIFIED |
| B | EPA National Walkability Index | US EPA | epa.gov/smartgrowth/smart-location-mapping | bulk download | ZIP (GIS) | census block group | 2021 version | public domain, unstated explicitly | VERIFIED |
| B | Walk Score API | Walk Score | walkscore.com/professional/api.php | paid API | JSON | address point | live | no caching or storage without consent | VERIFIED |
| B | OSM derived walkability (method) | OSM contributors | wiki.openstreetmap.org/wiki/Overpass_API | Overpass API + own computation | varies | street network, points | continuous | ODbL | VERIFIED (method only) |
| B | DVRPC pedestrian network (sidewalks, curb ramps) | DVRPC | walk.dvrpc.org | web map, GIS portal | GIS | line, point | 2018 imagery for Philadelphia, not field verified | unstated for this layer | VERIFIED |
| B | DVRPC Level of Traffic Stress Network | DVRPC | catalog.dvrpc.org/dataset/dvrpc-level-of-traffic-stress-lts-network | download, API | SHP, GeoJSON, GeoParquet, vector tiles, CSV | DVRPC region incl. Philadelphia | updated as needed, last modified Sept 2026 | "Unrestricted" | VERIFIED |
| B | City of Philadelphia Bike Network | City of Philadelphia | opendataphilly.org, services.arcgis.com | API | CSV, SHP, GeoJSON | line | unstated | City standard terms | VERIFIED (no LTS field) |
| C | Census 2020 Decennial (P.L. 94-171) block population | US Census Bureau | api.census.gov/data/2020/dec/pl | API, key required | JSON | block | decennial | public domain | VERIFIED |
| C | Census ACS 5-Year Estimates, Philadelphia | US Census Bureau | api.census.gov/data/2024/acs/acs5 | API | JSON | county, tract, block group | annual, current vintage 2020 to 2024 | CC0 | VERIFIED |
| C | CDC PLACES, Census Tract Data | CDC | data.cdc.gov/resource/cwsq-ngmh | Socrata API, no key | JSON | census tract | annual, 2025 release, 2022 survey vintage | unstated, federal data | VERIFIED |
| C | CDC/ATSDR Social Vulnerability Index | ATSDR | atsdr.cdc.gov, SVI download page | bulk download | CSV, GIS | census tract | latest year 2022 | unstated, federal data | VERIFIED |
| C | DVRPC Indicators of Potential Disadvantage | DVRPC | catalog.dvrpc.org | not located this session | unknown | tract | unknown | unknown | UNVERIFIED |
| C | Urban Displacement Project | UC Berkeley and partners | urbandisplacement.org | blocked (403) | unknown | tract | unknown | unknown, open source methodology | UNVERIFIED, Philadelphia coverage unconfirmed |
| C | Reinvestment Fund Market Value Analysis | Reinvestment Fund, via City of Philadelphia | opendataphilly.org, services.arcgis.com/.../mva_2023 | API | CSV, SHP, GeoJSON | parcel/block cluster | 2023 vintage | City standard terms | VERIFIED |
| C | Philadelphia Neighborhoods | OpenDataPhilly | github.com/opendataphilly/odp-data-storage | GitHub download | SHP, GeoJSON, GeoPackage, GeoParquet | neighborhood (150+) | last modified April 2024 | CC BY 4.0 | VERIFIED |
| C | Registered Community Organizations boundaries | City of Philadelphia | opendataphilly.org, services.arcgis.com/.../Zoning_RCO | API | CSV, SHP, GeoJSON | RCO polygon | unstated | City standard terms | VERIFIED |
| C | City Council Districts | City of Philadelphia | opendataphilly.org, services.arcgis.com/.../Council_Districts_2024 | API | CSV, SHP, GeoJSON | district (2024 vintage) | redistricting cycle | City standard terms | VERIFIED |
| D | PPR Tree Canopy (change) | City of Philadelphia | opendataphilly.org, services.arcgis.com/.../TreeCanopyChange_2008_2018 | API | SHP, CSV, GeoJSON | citywide | 2008 to 2018 assessment | City standard terms | VERIFIED |
| D | Philadelphia Tree Inventory (street trees) | City of Philadelphia, PPR | opendataphilly.org, services.arcgis.com/.../ppr_tree_inventory_2025 | API | CSV, SHP, GeoJSON | point, citywide | yearly, 2021 through 2025 confirmed | City standard terms | VERIFIED |
| D | Heat Vulnerability by Census Tract | City of Philadelphia | opendataphilly.org, services.arcgis.com/.../heat_vulnerability_ct | API | CSV, SHP, GeoJSON | census tract | unstated vintage | City standard terms | VERIFIED |
| D | NOAA/CAPA Heat Watch Philadelphia campaign | NOAA, CAPA Strategies, Drexel/ANS | noaa.gov press releases, phillyvoice.com, whyy.org | news coverage, report | report, unknown data link | point measurements, citywide | one time campaign, year unconfirmed | unknown | VERIFIED existence, UNVERIFIED data link |
| D | Impervious Surfaces | City of Philadelphia | opendataphilly.org, pasda.psu.edu | download | SHP | citywide | 1996, updated with 2004 imagery | City standard terms | VERIFIED, very stale |
| D | PA Statewide High-Resolution Tree Canopy / Delaware River Basin Land Cover | PASDA / regional partners | opendataphilly.org | download | unknown | regional | unconfirmed, possibly newer | opendataphilly.org "other" | UNVERIFIED currency |
| D | GSI Public and Private Projects | Philadelphia Water Department | opendataphilly.org, services.arcgis.com/.../GSI_Public_Projects_Point | API | CSV, SHP, GeoJSON | point, line | unstated | City standard terms | VERIFIED |
| D | FEMA Flood Plain (City hosted) | City of Philadelphia / FEMA | opendataphilly.org, services.arcgis.com/.../fema_floodplain_2023 | API | CSV, SHP, GeoJSON | citywide | 2023 vintage | City standard terms | VERIFIED |
| D | Flood Hazard Zone Lines (DFIRM) | FEMA, via PASDA | pasda.psu.edu | download | SHP | by county | unstated | opendataphilly.org "other" | VERIFIED |
| D | TPL ParkServe | Trust for Public Land | tpl.org/park-data-downloads | blocked direct (403), confirmed by search | SHP, File Geodatabase | nationwide, incl. Philadelphia | 2025 documentation found | unverified | VERIFIED via search, UNVERIFIED license |
| D | PPR Properties, Playgrounds, Pools, Spraygrounds, etc. | City of Philadelphia, PPR | opendataphilly.org | API | CSV, SHP, GeoJSON | point, polygon | unstated | City standard terms | VERIFIED |
| D | Free Library branch locations | Free Library of Philadelphia | freelibrary.org/locations | blocked (403) | unknown | unknown | unknown | unknown | UNVERIFIED, gap |
| D | Schools | City of Philadelphia | opendataphilly.org, services.arcgis.com/.../Schools | API | CSV, SHP, GeoJSON | point, citywide | unstated | City standard terms | VERIFIED |
| D | Litter Index | City of Philadelphia, Streets Dept | opendataphilly.org, streetsmartphl.phila.gov | API, dashboard | CSV, SHP, GeoJSON | block, neighborhood | annual | City standard terms | VERIFIED |
| D | 311 Service and Information Requests | City of Philadelphia | opendataphilly.org, phl.carto.com | API (Carto SQL) | CSV, SHP | point, citywide | daily, since Dec 2014 | City standard terms | VERIFIED |
| D | Street Poles | City of Philadelphia, Streets Dept | opendataphilly.org, services.arcgis.com/.../Street_Poles | API | CSV, SHP, GeoJSON | point, citywide | unstated | City standard terms | VERIFIED |
| D | Commercial Corridors of Philadelphia | City of Philadelphia, Planning | opendataphilly.org, services.arcgis.com/.../Commercial_Corridors | API | CSV, SHP, GeoJSON | polygon | unstated | City standard terms | VERIFIED |
| D | OSM amenity=bench, drinking_water, toilets, public_bookcase, community_fridge | OSM contributors | overpass-api.de | Overpass API | JSON | point | continuous, crowd sourced | ODbL | VERIFIED (fridge count is zero) |

---

## Methodology notes

- All Overpass API figures in this report use a bounding box (south 39.867, west -75.2803, north 40.138, east -74.9558) rather than the exact city polygon, because queries against the full administrative boundary polygon timed out repeatedly. This bounding box is a close but imperfect stand in for the city limits; treat every OSM count above as an approximate, slightly over counted estimate.
- The City of Philadelphia's full open data catalog was fetched once as a single DCAT file (`https://opendataphilly.org/data.json`, 473 datasets) and searched locally by keyword, which is how most of Section D and several Section C datasets were found efficiently and precisely in one step, with individual access URLs then spot checked.
- Sources that actively blocked this session (HTTP 403 or an explicit refusal) were not bypassed, per the task's rules: Reddit, Trust for Public Land's main site, the Urban Displacement Project's map page, and the Free Library's locations page. Each is noted above as a gap rather than guessed at.
