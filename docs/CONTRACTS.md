# Contracts between the pipeline and the web app

The pipeline (Python, `pipeline/`) and the web app (TypeScript, `web/`) are built by different agents
at the same time. They meet only through the files described here. Change a contract only on
purpose: say so in your report and update this page in the same commit. The orchestrator reconciles.

## 1. The registry (`registry/*.yaml`)

Both sides read the YAML directly (the pipeline with PyYAML, the web build with a YAML import at build
time). Unknown keys are an error, so typos fail fast. Ids are lowercase with underscores and never
change once published, because saved links contain them.

### `registry/sources.yaml`

```yaml
- id: shootings                       # unique, stable
  name: Shooting victims
  publisher: Philadelphia Police Department
  homepage: https://opendataphilly.org/datasets/shooting-victims/
  endpoint:
    kind: carto                       # carto | arcgis | url | osm_extract | curated | sparql
    table: shootings                  # carto: table (and optional where)
    # arcgis: service: <name>, layer: 0 (and optional url, see below)
    # url: url: <https link>, format: csv | geojson | parquet | zip | json
    # osm_extract: url: <https link to an .osm.pbf file>, tags: [key=value or key, ...]
    # curated: path: data/curated/<file>.yaml
    # sparql: url: <https link to a SPARQL query service>
  license: city_terms                 # key into registry/licenses.yaml
  attribution: "Shooting data: Philadelphia Police Department via OpenDataPhilly"
  cadence: daily                      # daily | weekly | monthly | yearly | irregular | frozen
  health:
    min_rows: 15000                   # fail below this
    max_drop_pct: 5                   # fail if rows drop more than this versus last good
    newest_field: date_               # field holding the newest record date (optional)
    max_age_days: 14                  # stale if the newest record is older than this
  release: v0.1                       # first release that uses it
```

A Carto source's adapter may narrow the download further in code (added 2026-10-08 by M4.1):
`assessment_values` asks the table for its years first and downloads only the newest tax year
that holds most parcels and the year five before it, so it needs no yearly edit
(`pipeline/src/placekeepers/adapters/displacement.py`).

An `arcgis` endpoint names a service in the City's ArcGIS Online organization
(`https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services`). For a service in another
organization it adds `url`, the REST services root ending in `/rest/services` (added 2026-10-04 by
M1.1), for example `url: https://services2.arcgis.com/qjOOiLCYeUtwT7x7/arcgis/rest/services` for the
gardens PHS and the Neighborhood Gardens Trust support. A service kept in a folder of its server is
named with its folder, as ArcGIS lists it (added 2026-10-05 by M3.3): DVRPC's traffic stress
network is `service: transportation/lts_network` under `url:
https://arcgis.dvrpc.org/portal/rest/services`. Each part holds no `/ ? # &` and does not start with
a space. A `csv` file may use another delimiter (the Census Bureau's tables use `|`); the source's
adapter reads it.

Added 2026-10-04 by M2.1: a `zip` file needs a source specific adapter that knows what is inside
(`septa_gtfs` holds two GTFS feeds). SEPTA publishes its stop ridership counts as one ArcGIS layer
per schedule period, so for `septa_ridership_bus` and `septa_ridership_trolley` the `service` names
the oldest layer to accept: each run lists that folder (`url`) and takes the newest spring or fall
layer for the mode, and the snapshot says which in its `layer` column
(`pipeline/src/placekeepers/adapters/septa.py`).

An `osm_extract` endpoint (keys added 2026-10-04 by M2.2) names an OpenStreetMap extract the
pipeline downloads, `url` (an https link to an `.osm.pbf` file, such as Geofabrik's Pennsylvania
extract), and `tags`, the elements to keep: `key=value` (such as `highway=bus_stop`) or a key alone
for any value (such as `shelter`). Keys and values hold letters, digits and `_ : ; . -`, never
spaces, and a tag is listed once. The pipeline keeps the nodes and ways with any of the tags inside
the city limits and 200 meters around them (section 2), so a later layer adds its tags here
without new code; new tags arrive with the next weekly download. Each snapshot's sidecar keeps
`recipe`, a hash of the tag list it was made with (changed 2026-10-05: before then there was none),
and a snapshot whose hash differs from today's tag list, or that has none, is downloaded again on
the next run even when it is younger than the six days Geofabrik asks for. An `osm_extract` with neither key
is the base map, made by the site and never fetched (section 2); one key without the other is an
error.

A `url` endpoint with `format: json` (added 2026-10-08 by issue #37) names a JSON service at a
fixed link that the source's adapter asks with query parameters of its own, as a Carto adapter
holds its columns: `pba_laser` asks Philly Bike Action's Laser Vision map
(`https://bikeaction.org/tools/laser/map_data/`) for one day, then for 12 months of each kind of
report, a few seconds apart (`pipeline/src/placekeepers/adapters/pba_laser.py`).

A `sparql` endpoint (added 2026-10-05 by M3.2) names a SPARQL query service, `url` (an https
link), such as Wikidata's, `https://query.wikidata.org/sparql`. The query itself lives in the
source's adapter, as a Carto adapter's columns do (`wikidata_art`, in
`pipeline/src/placekeepers/adapters/art.py`): one small query a week, sent as a POST form with the
project's User-Agent, asking for JSON.

### `registry/licenses.yaml`

```yaml
- id: city_terms
  label: City of Philadelphia open data terms
  url: https://metadata.phila.gov/#help/help-faqs/what-are-the-terms-of-use/
  share_alike: false
```

### `registry/layers.yaml`

```yaml
- id: shootings_hex                   # unique, stable; used in links and settings
  label: Shootings, counted by area
  group: safety_context               # key into registry/groups.yaml
  description: >-
    Shooting victims in the chosen time window, counted per hexagon about two blocks across.
    Shown to point care where it helps most, not to label places as dangerous.
  sources: [shootings]
  file: tiles/context.pmtiles         # path under the published data root
  source_layer: h3
  geometry: polygon                   # point | line | polygon
  style: shootings_hex                # key into web/src/map/styles (web owns styling)
  evidence: context                   # strong | moderate | mixed | weak | not_violence | context
  default: {field: false, analysis: true}
  settings:
    - id: window
      label: Time window
      type: choice                    # toggle | choice | range
      options: [{value: m12, label: Last 12 months}, {value: m36, label: Last 3 years}]
      default: m12
  release: v0.1
```

Setting keys by type (added 2026-10-04 by M0.3). Every setting has `id`, `label`, `type` and
`default`; the other keys depend on the type, and keys that do not belong to the type are an error:

| `type` | Other keys | `default` |
|---|---|---|
| `choice` | `options`: a list of `value` (text) and `label` | one of the option values, as text |
| `toggle` | none | `true` or `false` |
| `range` | `min` and `max` (numbers), `step` (optional, default 1) | a number from `min` to `max` |

What a setting does to the map is decided by the layer's style in `web/src/map/styles`, which lists
the setting ids it puts into effect; a web test fails if a registry setting has no effect. Ids and
option values appear in shared links, so they never change once published.

`guide` (optional, added 2026-10-04 by M2.2) is the slug of a content page, `content/<slug>.md`,
that shows how anyone can help improve the layer's data. The web app links it from "About this
layer", and a style may link it from its legend (the shelters and benches layer's "not yet surveyed" entry does).
The pipeline's registry check fails when the page does not exist.

A choice setting with the option value `lens` (added 2026-10-05 by M2.3) colors the layer's places
by the lens that applies to them; the other options color them by something else. The stops layer's
`color` setting is the first (`lens`, `wait` or `boardings`, default `lens`). Using a lens in the web
app (moving one of its sliders or choosing a preset) turns on the layers that draw its places and
sets such a setting to `lens`.

When more than one lens ranks a layer's places, the setting's option values are those lenses' ids
instead (added 2026-10-05 by M3.1): the lots layer's `lens` setting ("Color lots by", `violence`,
`heat` or `placemaking` (added 2026-10-08 by M3.4), default `violence`) names the lens that colors the lots, and using a lens sets it to that
lens's id. Its options must name every lens that applies to `parcel` and nothing else (a web test
checks it).

`registry/groups.yaml` lists groups in display order: `lots`, `care`, `displacement` (added
2026-10-08 by M4.1 for the displacement watch, "Prices and protections"), `streets`, `transit` (added
2026-10-04 by M2.1 for SEPTA's layers; M2.2 adds the shelters and benches at stops to it), `heat`
(added 2026-10-05 by M3.1 for heat vulnerability, the City's trees and the floodplain), `amenities`,
`public_places` and `conditions` (added 2026-10-05 by M3.5), `placemaking` (added 2026-10-05 by
M3.2 for public art), `walking` (added 2026-10-05 by M3.3 for walkability, people and places within
walking distance, and traffic stress for people on bikes), `safety_context`, `boundaries`,
`basemap`, each with a label and a one line
description.

### `registry/lenses.yaml`

```yaml
- id: violence
  label: Violence reduction
  applies_to: parcel                  # parcel | segment | crash | stop | cell
  description: Where cleaning, greening or sealing would most likely reduce gun violence nearby.
  factors:
    - id: untreated_vacancy
      label: Untreated vacant lot or open abandoned building
      field: f_vacant                 # integer 0 to 100 in the tile properties
      evidence: strong
      default_weight: 3               # 0 to 5; 0 means off
      explain: Randomized trials in Philadelphia found greening lots and sealing houses reduced gun violence nearby.
  presets:
    - id: research
      label: Research based
      weights: {untreated_vacancy: 3}
  release: v0.1
```

The lens score is `sum(weight * field) / sum(weight)`, computed in the map style. Percentile fields
are integers from 0 to 100, where 100 means the most need citywide.

How factor fields are made (added 2026-10-04 by M1.5, for the street safety lens): a yes or no
factor is 100 for yes and 0 for no (such as `f_hin`, on the High Injury Network). A count factor is
the share of places citywide with a strictly lower count, rounded, so a place with none gets 0 and
the place with the most gets 100 (such as `f_ksi_vru`). A factor whose data is missing for a place is
left out of its properties, so the map leaves it out of that place's average.

Each lens colors its own kind of place: the first lens that applies to `parcel` colors the lots,
the first that applies to `segment` colors the street blocks, and the first that applies to `stop`
colors SEPTA's bus and trolley stops (`stops` in transit.pmtiles; added 2026-10-05 by M2.3). Two
lenses apply to `parcel` from M3.1 (violence reduction and heat and shade): the lots layer's `lens`
setting chooses which one colors the lots (section 1, layers), the first by default. A factor field
may appear in more than one lens: the heat and shade lens lists the violence lens's `f_canopy`,
computed once. From M3.4 (2026-10-08) a third lens applies to `parcel`, placemaking, and the setting
offers it too; it lists the walking factors of M3.3 (`f_walk`, `f_neighbors`, `f_dest`), which rank
more as higher, beside its own `f_park`, `f_art` and `f_corr` (section 4).

One exception to leaving missing data out (added 2026-10-05 by M2.3, the transit comfort lens): a
stop's shelter or bench that no one has surveyed yet is not missing but 50, halfway between having
one (0) and not (100), in `f_noshelter` and `f_nobench`. Leaving it out would let a stop known only
for its heat and its street top the ranking; counting it as missing would score the stop as if it
had nothing. The web app knows such a value from the stop's own answers (`sh` or `bn` absent, and
for the shelter `cv` not 1), never calls it the main reason, and marks it "not yet surveyed" in the
"why" breakdown.

A second difference for the same lens (changed 2026-10-05, decision D1 of VERIFICATION_V0_2.md):
those two factors, and everything else worked out only from what OpenStreetMap says at a stop, are
not in the tiles. The browser works them out from `tables/stop_amenities.json` (section 8), joined
to each stop by the OpenStreetMap id it links to (`o`), and the map style reads them from that join
rather than from the feature. Storing OpenStreetMap's answers in SEPTA's stop records would make a
derivative database the Open Database License asks to be shared under it, which SEPTA's license does
not let us grant. The pipeline keeps the reference join
(`placekeepers.derive.transit_comfort.join_published`); the cases in
`pipeline/tests/fixtures/stop_join_parity.json` hold both sides to the same answers.

### `registry/suggestions.yaml`

```yaml
- id: clean_and_green
  label: Clean and green this lot
  applies_to: parcel
  summary: Clear trash, grade, plant grass and a few trees, add a low fence, mow regularly.
  evidence: strong
  cost: "About $1,100 to $1,500 up front, $150 to $300 a year (to confirm with PHS)"
  routes: [land_bank_garden_agreement, ask_the_owner, community_landcare]
  partners: [phs]
  default_on: true
  release: v0.1
```

Which places get which suggestion is decided in the pipeline (rules live in Python next to the
derive step, keyed by suggestion id). The web app only shows, hides and explains them.

`applies_to: crash` (added 2026-10-04 by M1.5) marks suggestions for the place of a crash; they are
carried by `memorials` markers in `sg`. The memorial suggestion (`memorial_or_ghost_bike`) is always
shown with the line "Only with the family's blessing." and a link to Families for Safe Streets
(docs/ETHICS.md); the web app adds that line wherever the suggestion is listed.

`applies_to: stop` (added 2026-10-05 by M2.3) marks suggestions for SEPTA's bus and trolley stops.
None needs a landowner's permission, so the first step is always the first step of the suggestion's
first route. Of these, `sg` in transit.pmtiles carries only those SEPTA's and the City's data
decide (planting shade trees); the four that follow from what OpenStreetMap says at the stop
(survey it, ask for a shelter, ask for a bench, report a dark streetlight) are worked out in the
browser by the same rules (decision D1, section 1 lenses), and a stop lists them all in that order:
survey, shelter, bench, streetlight, shade trees.

Greening suggestions (listed in `web/src/config/suggestions.ts`: `clean_and_green`,
`plant_shade_trees`, `cool_green_lot` and `stop_shade_trees`; added 2026-10-04 by M1.10, decision
D12 of VERIFICATION.md) are shown with the caution of docs/ETHICS.md, "Greening can raise nearby
prices. Consider pairing it with protections."; the web app adds it wherever the suggestion is
listed and in downloads. From M4.1 (2026-10-08), a place inside a displacement watch area (its `dw`,
section 4, or its dossier's `displacement`, section 6) gets the full card instead: the sentence,
the area's signs and a link to each protection route (`neighborhood_gardens_trust`,
`community_land_trust`, `homestead_exemption`, `longtime_owner_occupants`, `tangled_title_help` in
`registry/routes.yaml`, the first link of each). No registry key changes.
From M3.4 (2026-10-08) the placemaking lens's `seating_and_shade`, `community_garden` and
`art_request` follow the same rule with their own one line caution ("New gardens, seating and art
can make a block more sought after and raise nearby prices and rents. Pair them with protections
for neighbors who rent or who are behind on taxes."; `PLACEMAKING_SUGGESTIONS` in the same file),
and the same full card inside a watch area. Its three reports to Philly311 (`report_dumping`,
`report_dark_light`, `report_graffiti`) carry no caution, and use only the route `report_to_311`.

### `registry/routes.yaml` and `registry/partners.yaml`

Routes carry `id`, `label`, `who`, `steps` (list), `cost`, `timeline`, `links` (label and url),
`last_checked` (date), and `status` (`verified` or `confirm`). Partners carry `id`, `name`, `url`,
and `one_line`. Content comes from ROUTES.md.

A route may also carry `warning` (added 2026-10-04 by M1.3): a caution the web app shows before the
steps wherever the route appears. The `conservatorship` route carries the abuse warning of
docs/ETHICS.md in it, word for word.

### `registry/options.yaml`

Added 2026-10-04 by M1.6. App wide options: choices about how the whole site behaves, not tied to
one map layer. Settings shows every one, under "Privacy and live data".

```yaml
- id: live_city_data
  label: Fetch live City data
  description: >-
    When you open a lot page or search for an address, your browser asks the City of
    Philadelphia's public servers for the newest records ...
  type: toggle
  default: true
  release: v0.1
```

An option has the keys of a layer setting (`id`, `label`, `type`, `default`, and `options`, or
`min`, `max` and `step`, by type, with the same rules) plus `description` (plain words, including
any privacy note) and `release`. Options are personal: the web app keeps them only in the browser
of the person who set them (under `placekeepers:v1:options`) and never puts them in a shared link,
so opening someone's link can never turn on something a person turned off. "Reset to defaults"
leaves them as they are. The pipeline checks the file like the others but does not use it.

`live_city_data` (default on) lets the browser ask the City's servers for live data: the live refresh
of a lot page (section 6), opening a parcel that has no dossier, and address search, which uses the
City's address service (`https://api.phila.gov/ais/v1/search/<text>`). With it off, the site asks
the City for nothing and lot pages show the weekly snapshot, labeled with its date.

## 2. Published data layout

The pipeline writes everything under one data root (`--out`, default `build/data`). The site serves it
at `/data/`. During web development, `web/public/data/` holds a copy (git ignored), and
`web/fixtures/data/` holds a tiny committed sample for tests.

```
data/
  manifest.json
  tiles/
    lots.pmtiles          layer "parcels"   (vacancy candidates)
    streets.pmtiles       layers "hin", "segments", "crashes", "memorials"
    context.pmtiles       layer "h3"        (area cells, resolution 9)
    care.pmtiles          layers "landcare", "gardens"
    boundaries.pmtiles    layers "council_districts", "rcos", "neighborhoods"
    transit.pmtiles       layers "stops", "routes"   (SEPTA, added 2026-10-04 by M2.1; the transit comfort lens on "stops", M2.3; never OpenStreetMap's answers)
    amenities.pmtiles     layers "stops" (shelters and benches at stops, M2.2), "benches",
                          "picnic_tables", "water", "toilets", "bookcases" (M3.5): from OpenStreetMap
    places.pmtiles        layers "park_water", "libraries", "recreation", "pools" (the City's; M3.5)
    conditions.pmtiles    layers "dumping", "lights", "graffiti" (311 requests by block; M3.5)
    environment.pmtiles   layers "heat_tracts", "floodplain"   (heat vulnerability and FEMA's floodplain; M3.1)
    trees.pmtiles         layer "trees"     (the City's street and park trees, zoom 14 only; M3.1)
    art.pmtiles           layer "art"       (public art from the City, OpenStreetMap and Wikidata; M3.2)
    walk.pmtiles          layers "block_groups", "cells"   (walkability by block group, and people
                          and places within walking distance by area cell; M3.3)
    cycling.pmtiles       layer "stress"    (DVRPC's traffic stress for people on bikes; M3.3)
    parking.pmtiles       layer "parking"   (parking problems reported with Laser Vision, counts per
                          block sized cell; issue #37)
    displacement.pmtiles  layer "watch"     (displacement watch areas, census tracts; M4.1)
  tables/
    parcels.json          compact columnar table for ranking and lists
    owners.json           organizations holding many vacant parcels, with their parcels (section 6)
    routes/               route survey sheets (section 7; added 2026-10-05 by M2.4)
      index.json          every SEPTA bus and trolley route with a sheet
      <route id>.json     one route's stops in order, each direction, with the id of the OpenStreetMap stop at each
    stop_amenities.json   what OpenStreetMap says at each stop it knows, by its id (section 8; Open Database License; decision D1)
    land_bank.json        The Land Bank in numbers: conveyances by year, agency, buyer type, program and district, the City's counts by program, and the weekly count of listed lots (section 9; aggregates only; added 2026-10-09 by M4.4)
  dossiers/
    <first four digits of the OPA account>.json
    common.json           the parts of every flag that are the same for all parcels (section 6)
    history/
      <first four digits of the OPA account>.json   the lot timeline's L&I records and vacancy
                          lists, one beside each dossier shard (section 6; added 2026-10-09 by M4.2)
  basemap/
    philly.pmtiles        Protomaps basemap extract
```

`basemap/` (the extract, its fonts and its icons) is not written by the pipeline: the web side makes it
with `web/scripts/make-basemap.sh`, and the weekly refresh adds it beside the pipeline's output when it
assembles the site. It is therefore not listed in the manifest's `files` (clarified 2026-10-04 by
M0.4).

The base map is also a registry layer (added 2026-10-04 by M1.7): `basemap`, in the `basemap` group,
with `file: basemap/philly.pmtiles`, so it has a switch and a setting (`look`: `light` or `muted`) like
every layer. `pk publish` leaves every layer whose file is under `basemap/` alone, and the manifest
lists the layer in `layers` but not its file in `files`. Its source, `basemap_openstreetmap` (endpoint
kind `osm_extract` with no keys; the extract the pipeline does download, `osm_philadelphia`, has
`url` and `tags`, section 1), is never fetched by the pipeline, so
the manifest gives it the status `missing`; the web app ignores that status, judges the base map by
`basemap/BUILD` (the Protomaps build date, written by make-basemap.sh), and leaves it out of the
header's freshness badge.

## 3. `manifest.json`

```json
{
  "schema": 1,
  "build_id": "2026-10-05T10-00-00Z-1a2b3c4",
  "generated_at": "2026-10-05T10:03:12Z",
  "sources": {
    "shootings": {
      "status": "ok",
      "last_attempt": "2026-10-05T10:00:05Z",
      "last_success": "2026-10-05T10:00:05Z",
      "stale_since": null,
      "rows": 17973,
      "newest_record": "2026-10-01",
      "message": null
    }
  },
  "layers": {
    "shootings_hex": {"file": "tiles/context.pmtiles", "source_layer": "h3", "sources": ["shootings"]}
  },
  "files": {
    "tiles/context.pmtiles": {"bytes": 1234567, "sha256": "..."}
  },
  "dossiers": {"prefix_digits": 4, "prefixes": ["0011", "0012", "8850"], "files": 929, "bytes": 108300000,
               "history": {"files": 929, "bytes": 57500000, "parts": ["li"]}},
  "vacancy": {
    "as_of": "2026-10-04",
    "lots": {"high": 24162, "medium": 6160, "low": 10454},
    "buildings": {"high": 5045, "medium": 3819, "low": 9054},
    "left_out": 1727
  },
  "notes": ["8 shooting victims in the last 36 months have no usable location"]
}
```

`status` is one of `ok`, `stale` (using the last good snapshot), `failing` (no usable snapshot), or
`missing` (never fetched). `stale_since` is the date of the last good snapshot when stale.
`sources` lists every source in the registry and `layers` every layer, whether or not it was built.
`files` lists every file under the data root except `manifest.json` itself, the dossier shards,
which `dossiers` summarizes, and the route survey sheets (`tables/routes/<route id>.json`), which
`tables/routes/index.json` lists (changed 2026-10-05 by M2.4: about 120 files the map never reads),
so a layer is available only when `files` lists its `file`. `tables/routes/index.json` itself is
listed.

`dossiers` (added 2026-10-04 by M1.3, as the orchestrator decided, so the manifest every visitor
fetches before the map draws stays small) summarizes the lot dossier shards (section 6) instead of
listing about 930 files: `prefix_digits` (4, the leading digits of the OPA account that name a
shard), `prefixes` (sorted, only the prefixes that have a file; the shard for prefix `3710` is
`dossiers/3710.json`), `files` (how many shards) and `bytes` (their total size). It is `null` when
no dossiers were written. `dossiers/common.json` and `tables/owners.json` are listed in `files` as
usual. On 2026-10-04 the manifest is about 28 kB (5 kB compressed).
`history` (added 2026-10-09 by M4.2, issue #38) summarizes the lot timeline's history shards
(section 6): `files`, `bytes`, and `parts`, what they hold for every dossier parcel outside its own
`partial` (`["li"]` when the L&I records are in this build, `[]` when `li_history` had no
snapshot). Every prefix in `prefixes` then has `dossiers/history/<prefix>.json`; like the dossier
shards, they are not listed in `files`. `history` is `null` (or absent, in older manifests) when no
history shards were written.

`vacancy` (added 2026-10-04, decision D10 in VERIFICATION.md) holds the vacancy model's counts for
this build, so a page can quote the current numbers: `as_of` (the build date the model's time
windows counted from), `lots` and `buildings` (parcels by confidence, `high`, `medium` and `low`;
lots include the ones where a footprint stands), and `left_out` (parks, gardens, parking and similar
that never show). Every parcel counted is in the `parcels` layer except units inside a larger parcel
and the few with no shape and no point (the notes say how many of each). It is `null` when the
model has not run (the map then shows the City's lists alone).

`displacement` (added 2026-10-08 by M4.1) holds what the map needs to explain the displacement
watch (section 4, `watch`), or `null` when the watch was not measured:

```json
"displacement": {
  "as_of": "2026-10-08",
  "periods": {"earlier_from": "2018-09-03", "earlier_to": "2021-09-02",
              "recent_from": "2023-09-03", "recent_to": "2026-09-02"},
  "assessment_years": [2022, 2027],
  "survey_years": [2020, 2024],
  "mva": "Market Value Analysis 2026",
  "city": {"p0": 180000, "p1": 230000, "pc": 28, "cb": 27, "ac": 69, "rp": 48},
  "thresholds": {"price_points": 25, "company_points": 15, "assessment_points": 30,
                 "renter_pct": 60, "min_sales": 50, "min_assessed": 50, "min_occupied": 100,
                 "min_signs": 2, "recent_years": 3, "gap_years": 5},
  "areas": {"tracts": 408, "watch": 96}
}
```

`periods` are the two windows of home sales (each day from the first to the last counted; the
recent one ends at the newest recorded sale); `assessment_years` the earlier and the newest tax
year compared; `survey_years` the Census survey's span; `mva` the edition of the Market Value
Analysis read (its registry name). `city` holds the whole city's measures with the short names of
the `watch` layer: the middle home sale price in the earlier and the recent period (`p0`, `p1`,
dollars) and its change (`pc`, percent), the share of recent buyers that are companies (`cb`), the
middle change in assessed value (`ac`) and the share of homes rented (`rp`), each a whole number or
`null`. `thresholds` are the rule's numbers (`pipeline/src/placekeepers/derive/displacement.py`):
a sign about sale prices holds `price_points` percentage points above the city's change, and so on.

`notes` (added 2026-10-04 by M0.2) is a list of plain sentences about the build, possibly empty:
data quality remarks, a layer with no usable data yet, or `tiles skipped: tippecanoe not installed`.
Readers must tolerate an empty list. When tiles are skipped (tippecanoe missing) or a tile build
fails, each layer is written as GeoJSON beside where its tile file would go, named
`<tile file stem>.<source layer>.geojson`, for example `tiles/lots.parcels.geojson`, with the same
feature properties as the tiles; those files are listed in `files` and the `.pmtiles` file is not.

## 4. Tile feature properties (first release)

Short property names keep tiles small. Integers are preferred to strings.

**`parcels` (lots.pmtiles)**

| Property | Type | Meaning |
|---|---|---|
| `id` | string | OPA account number, 9 digits |
| `k` | int | 1 vacant lot, 2 vacant building |
| `vc` | int | vacancy confidence: 1 low, 2 medium, 3 high |
| `ot` | int | owner type: 1 individual, 2 company, 3 City, 4 Land Bank, 5 Redevelopment Authority, 6 housing authority, 7 nonprofit, 8 other public, 0 unknown |
| `lc` | int | 1 if maintained by PHS LandCare |
| `rt` | int | the first lawful step to get permission, as a category (codes below) |
| `la` | int | 1 when the City's land agencies list the parcel as available (below); absent otherwise. Added 2026-10-08, issue #36 |
| `ly` | int | 1 when such a listed parcel may go to the owner of the house next door as a side yard (below); absent otherwise. Added 2026-10-08 |
| `rs` | int | the reasons, as bits (below); added 2026-10-04 by M1.2 |
| `n` | int | how many independent records agree that it is vacant, for its kind (lot or building) |
| `dy`, `sy`, `ny` | int | year of the demolition (bit 4), the City's clean and seal (bit 7), or the new construction permit (bits 12 and 13); present only with those bits |
| `f_*` | int | lens factor percentiles, 0 to 100 |
| `sg` | string | suggestion ids, comma separated |

The layer holds every parcel the vacancy model (DESIGN section 6) shows: lots and buildings at high,
medium and low confidence. A parcel is its Water Department parcel shape, else the City's polygon,
else (added 2026-10-04, issue #22) a Point at the assessor's location (`lat`, `lng` in OPA), with
the same properties; a unit inside a larger parcel (an OPA `unit`) with no shape is left out.
Styles must draw both polygons and points. The kind comes from the building footprint, so a parcel
on the City's building list with no building standing is a lot.

Zoomed out, the layer is light (added 2026-10-05, issue #26): from zoom 13 up it holds every parcel
exactly as above; below zoom 13 it holds one Point on each parcel's shape (a sample: tippecanoe
keeps about 40 percent at zoom 12, 16 at 11 and 6 at 10), with every property except `rs`, `n`,
`dy`, `sy` and `ny` (the lot page reads those from the dossier), plus `lo` = 1. So the lens colors
and every filter work at every zoom, but a count or list built from what the map draws below zoom
13 is a sample of the parcels in view. Bits of `rs` (test with `rs & (1 << bit)`); bits
never change meaning once published. The id names each reason in the pipeline
(`placekeepers.derive.vacancy.REASONS`), the web app (`web/src/places/reasons.ts`) and its sentences
(`strings.reasons`); tests on both sides check them against this table:

| Bit | Value | Id | Says | Agrees or against |
|---|---|---|---|---|
| 0 | 1 | `city_land` | The City lists it as likely vacant land (its list's date is `newest_record` of `vacant_indicators_land` in the manifest) | agrees |
| 1 | 2 | `city_building` | The City lists it as a likely vacant building (date from `vacant_indicators_bldg`) | agrees |
| 2 | 4 | `assessor_vacant_land` | The assessor classifies it as vacant land | agrees |
| 3 | 8 | `no_building` | No building stands on the parcel (no footprint) | agrees |
| 4 | 16 | `demolished` | Demolished in `dy`, nothing built since | agrees |
| 5 | 32 | `vacant_lot_record` | A vacant lot violation or complaint in the last two years | agrees |
| 6 | 64 | `landcare` | Cleaned and kept up by PHS LandCare | agrees |
| 7 | 128 | `sealed` | Sealed by the City in `sy`, no permit since | agrees |
| 8 | 256 | `unsafe` | On the City's unsafe building list, no permit since | agrees |
| 9 | 512 | `imminently_dangerous` | Declared imminently dangerous, no permit since | agrees |
| 10 | 1024 | `vacant_building_record` | A vacant property violation or complaint in the last two years | agrees |
| 11 | 2048 | `assessor_exterior` | The assessor noted a vacant or sealed exterior | agrees |
| 12 | 4096 | `built_since` | A new construction permit in `ny`: a building may stand now | against |
| 13 | 8192 | `construction_starting` | A new construction permit in `ny`: construction may be starting | against |
| 14 | 16384 | `side_yard` | The owner of the lived in building next door also owns it: likely a side yard | against |
| 15 | 32768 | `land_use_shows_use` | Planning's land use map shows a use other than vacant (lots only, from 2026-10-04 M1.4: the map shows a use for nearly every building) | against |
| 16 | 65536 | `recent_permit` | A permit for building work (alterations, trades, new construction) or zoning in the last two years | against |
| 17 | 131072 | `building_stands` | A building footprint stands although records say vacant land | against |
| 18 | 262144 | `homestead` | The owner has a homestead exemption: City records say someone lives here, or did (added 2026-10-04, decision D1). Lowers a building one level; on a lot it changes no level | against |

`ot` is filled from 2026-10-04 by M1.3 (`pipeline/src/placekeepers/derive/owners.py`): the City's
list of public property decides first (`PUB` 3, `PLB` 4, `PRA` 5, `PHDC` 8), then the owner names
as OPA publishes them, by documented patterns (public bodies, company forms, nonprofit words, a
person's name). The dossier's `owner.type` gives the same type by name (section 6).

`sg` is written for every parcel from 2026-10-04 (M1.7; the table listed it before the pipeline
wrote it): the parcel's suggestion ids as its dossier lists them (`derive.routes.suggestions_for`),
`clean_and_green` for a vacant lot (a LandCare lot too, whose first step is then Community LandCare)
and `seal_abandoned_building` for a vacant building, limited to the suggestions the registry has.

`la` (added 2026-10-08, issue #36): 1 on a parcel the City's list of public property
(`city_owned_property`, the same list the Philadelphia Land Bank's "View Properties Map" shows)
gives a status beginning `Owned - Available` on any of its records: plain, "(Garden Agreement)",
"(no construction permitted)" or "(not for SY)". The rule is `listed_available` in
`placekeepers.derive.city_list`, and the dossier's `owner.city_owned.available` (section 6) says
the same. It names the City's status, never how easy a lot would be to get. It is kept below zoom
13, so the lots layer's `listed` setting ("Listed as available by the City's land agencies",
`any` or `available`) works at every zoom; a listed parcel the vacancy model does not show is not
in the layer (101 of the 1,639 listed parcels with an account on 2026-10-04: 86 not in the model's
table and 15 it leaves out), and its lot page still says so. Built from the 2026-10-04 snapshots,
1,538 parcels in the layer carry it, adding about 22 kB (0.2 percent) to `tiles/lots.pmtiles`.

`ly` (added 2026-10-08, after the v0.3 review): 1 on a parcel with `la` that the City also marks
eligible for a side yard, exactly when its dossier's `owner.city_owned` has `available` and
`side_yard_eligible` both true (`side_yard_accounts` in `placekeepers.publish.dossiers`, by the
rule of `placekeepers.derive.city_list`). The nearby cards use it to make the side yard route
the first step of such a lot, as its lot page does; it never changes `rt`. Built from the
2026-10-04 snapshots, 1,222 of the 1,538 listed parcels in the layer carry it.

`rt`, the first lawful step to get permission for the parcel (added 2026-10-04): the first route
the parcel's dossier lists (`placekeepers.derive.routes.routes_for`, from the same owner type, owner
names and LandCare record), so a lot's map value and its dossier always agree. The side yard route
is passed over (changed 2026-10-08, issue #36): it leads the routes of a listed lot the City marks
eligible, but it is for the household next door only, so `rt` names the route after it. Codes never change
meaning. It names a kind of step, for filtering and for plotting need against it; it is never a
score or an order of how easy a parcel is to get (ETHICS.md, "Things we do not build").

| Code | First step |
|---|---|
| 0 | No clear route yet: an unknown owner with no name |
| 1 | PHS LandCare already cares for it: Community LandCare stewardship |
| 2 | The City or the Land Bank owns it: a garden agreement or license |
| 3 | The Redevelopment Authority or PHDC owns it: ask PHDC |
| 4 | The housing authority or another public body owns it: ask the owner (the agency) |
| 5 | A private owner (a person, a company, a nonprofit, or a name we could not type): ask the owner |

The violence reduction lens factors (added 2026-10-04 by M1.4, computed by `pk derive` in
`placekeepers.derive.lenses`), each an integer from 0 to 100 and ranked among the parcels in this
layer:

| Property | Meaning |
|---|---|
| `f_vacant` | 100 for an untreated vacant lot or open abandoned building, 0 for a treated one: a lot PHS LandCare keeps up (`lc`), or a building whose owner fixed its doors and windows after an L&I citation (PM15-304.19V closed as "complied, owner repair", with no citation for an open building or its doors and windows since) |
| `f_shoot` | people shot in the last 36 months in the parcel's H3 resolution 9 cell and the six around it (about a quarter mile), counted as for the `h3` layer; the share of parcels with a strictly lower count |
| `f_poverty` | the poverty rate of the parcel's 2020 census tract (ACS five year estimates); the share of parcels with a strictly lower rate. Absent when the parcel is outside every tract or its tract has no estimate |
| `f_canopy` | tree canopy (2018) over the land of the same seven cells, water and land outside the city left out; the share of parcels with strictly more canopy, so fewer trees rank higher. Absent when there is no land to measure |

The parcel's place is a point on its shape (`point_on_surface`). A parcel's factors are left out of
its properties when their data is missing, as for every factor.

The heat and shade lens factors and the floodplain note (added 2026-10-05 by M3.1, computed by `pk
derive` after the violence lens in `placekeepers.derive.heat`), each factor an integer from 0 to
100 ranked among the parcels in this layer. The lens also lists `f_canopy` above, computed once:

| Property | Meaning |
|---|---|
| `f_heatvul` | the heat vulnerability score (`hvi_score`) of the 2010 census tract of the City's Heat Vulnerability Index the parcel's point lies in (`heat_vulnerability`); the share of parcels in tracts with a strictly lower score. Absent outside the index's tracts and in the few tracts it does not report (large parks, the airport) |
| `f_strees` | the trees of Parks and Recreation's tree inventory (`street_trees`) within 100 meters of any part of the parcel (measured in UTM zone 18 north); the share of parcels with strictly more, so fewer trees rank higher |
| `f_people` | residents per square kilometer of land in the parcel's 2020 census tract: the American Community Survey's population for poverty status (`acs_poverty`, B17001) over the tract's land area (`aland` of `census_tracts_2020`); the share of parcels in tracts with strictly fewer. Absent outside every tract, or where the survey has no estimate or the tract no land |
| `fp` | the floodplain, beside the score and never in it: 1 when at least a tenth of the parcel lies in FEMA's 1 percent annual chance floodplain (zones A and AE, with the floodway), 2 when at least a tenth lies in that and the 0.2 percent annual chance area together (a parcel with no shape counts by its point); absent otherwise (`fema_floodplain`) |

From M3.1 `sg` may also hold the heat and shade suggestions, after the first ones, for vacant lots
only: `plant_shade_trees` where `f_canopy` is at least 50 (or, for a parcel with no canopy rank,
`f_strees`), and `cool_green_lot` where `f_heatvul` is at least 50. The lot's dossier lists the
same suggestions in the same order (`suggestions`, section 6). The rule is `suggestions_for` in
`derive/heat.py`.

The walking factors for the placemaking lens (added 2026-10-05 by M3.3, computed by `pk derive`
after the heat lens in `placekeepers.derive.walk`; the method in plain words is in DESIGN section
5.9). The placemaking lens (M3.4, below) lists them. Each is an integer from 0
to 100 ranked among the parcels in this layer as the share of parcels with a strictly lower value,
so **more ranks higher** (more people, more places, more walkable), unlike the need factors above.
A lens that wants the opposite (where everyday places are missing) needs a field of its own. Every
distance is a straight line from the parcel's point on its shape, measured in UTM zone 18 north:

| Property | Meaning |
|---|---|
| `f_walk` | the EPA's National Walkability Index (1 to 20) of the census block group the parcel's point lies in (`epa_walkability`); the share of parcels in block groups with a lower index. Absent outside every block group (2 parcels on 2026-10-05) |
| `f_neighbors` | people who live within a 5 minute walk: the 2020 census population of the blocks whose internal point lies within 400 meters (`census_blocks_2020`); the share of parcels with fewer |
| `f_dest` | everyday places within a 10 minute walk: how many of seven kinds lie within 800 meters (a Free Library location, a recreation center, a pool or sprayground not listed as out of service, a drinking fountain in a park, a school, a grocery store or market that takes SNAP, and a SEPTA stop with service; `PLACE_KINDS` in `derive/walk.py`), then, among parcels with as many kinds, how many places, counting at most five of a kind; the share of parcels with a lower value (`kinds * 100 + places`) |

The same step writes `$PK_CACHE/derived/walk_factors.parquet`, one row per parcel on the map,
for M3.4 and anyone checking a score: `opa`; the four factors (also `f_corners`, street corners
within a 5 minute walk, ranked the same way, which the lots do not carry because the EPA's index
counts intersections already and each factor adds about 3 to 4 percent to `tiles/lots.pmtiles`);
`people_5min`; `corners_5min`; `kinds_10min` (0 to 7); `kind_bits` (the kinds present, bits as
`dk` in `cells` below); `places_10min`; `block_group`; and `walk_index`. A factor whose source
has no snapshot is left out of every parcel.

The placemaking lens's own factors (added 2026-10-08 by M3.4, computed by `pk derive` after the
walking measures in `placekeepers.derive.placemaking`; the method in plain words is in DESIGN
section 5.3). Each is measured in a straight line from the parcel's point on its shape, in UTM zone
18 north. `f_park` and `f_art` are ranked among the parcels in this layer as the share of parcels
with a strictly smaller distance, so farther ranks higher, then rounded to the nearest 5 (halves
up), which keeps the tiles about 5 percent smaller:

| Property | Meaning |
|---|---|
| `f_park` | far from a park: the distance to the edge of the nearest park land of Parks and Recreation (`ppr_properties`, 0 inside one), leaving out its work yards (class `OPERATIONAL_INTERNAL` or use `OPERATIONS`), golf courses (use `GOLF`) and traffic islands or medians with no park use (class `TRAFFIC_ISLAND_MEDIAN` with use `OTHER` or none) |
| `f_art` | no public art nearby: the distance to the nearest work on the City's Percent for Art list (`percent_for_art`, the works the `art` layer shows, less those the City says are inside a building) or in Wikidata (`wikidata_art`, the works inside the city that are not gone), read as `placekeepers.derive.art` reads them. Never from OpenStreetMap (decision D1 of docs/VERIFICATION_V0_2.md). With one of the two lists missing, it is measured from the other and the build notes say so |
| `f_corr` | on or near a commercial corridor: 100 when the parcel's point lies on one of the City's commercial corridors (`commercial_corridors`) or within 50 meters of one, else 0 |

From M3.4 `sg` may also hold the placemaking suggestions, after the first ones and the heat
suggestions, for vacant lots only, in this order: `seating_and_shade` where `f_neighbors` is at
least 50; `community_garden` where `f_park` is at least 50 and at least 1,000 people live within
a 5 minute walk (`people_5min` in `walk_factors.parquet`, above; changed 2026-10-08, before it was
`f_park` alone); `art_request` where no work of the two
art lists stands within 400 meters and `f_neighbors` is at least 50; then `report_dumping`,
`report_dark_light` and `report_graffiti` where a street block within 20 meters of the lot's shape
(a block of the `segments` layer, the street safety network) has a request of that kind still open
in the 90 day window, counted exactly as the `dumping`, `lights` and `graffiti` layers count them
(`requests_by_block` in `publish/conditions.py`). The 311 counts are never a factor. The lot's
dossier lists the same suggestions in the same order. The rule is `suggestions_for` in
`derive/placemaking.py`.

The same step writes `$PK_CACHE/derived/placemaking_factors.parquet`, one row per parcel on the
map, for anyone checking a score: `opa`; the three factors; `sg` (the placemaking suggestions
alone); `park_m` and `art_m` (the distances in whole meters); `corridor` (the name of the nearest
corridor within 50 meters); `open_311` (the kinds with an open request on a block the lot faces,
as bits: 1 dumping, 2 a street or alley light, 4 graffiti); and `blocks_faced`. A factor whose
sources have no snapshot is left out of every parcel.
`dw` (added 2026-10-08 by M4.1): the signs of the displacement watch area the parcel lies in, as
the bits of `w` in the `watch` layer below; present only inside a watch area. The parcel's area is
its 2020 census tract as the violence lens finds it (`tract` in `derived/lens_factors.parquet`). A
greening suggestion on a parcel with `dw` gets the full card (section 1, suggestions).

**`h3` (context.pmtiles)**: `h` (cell id), `s12` and `s36` (shooting victim counts), `f_*` (factor
percentiles for cell level factors such as `f_poverty`).

Added 2026-10-05 by M3.1 (heat, trees and the floodplain; `pipeline/src/placekeepers/publish/environment.py`):

**`heat_tracts` (environment.pmtiles, polygons)**: one feature per 2010 census tract of the City's
Heat Vulnerability Index (`heat_vulnerability`). `id` (the tract's `geoid10`); `hv`, `he` and `hs`,
the tract's class from 1 to 5 for heat vulnerability, heat exposure and heat sensitivity: the
fifth of the scored tracts it falls in by the share of tracts with a strictly lower score (1 the
least, 5 the most), each absent where the index gives no score; and `vh`, 1 where the City rates
the tract very high in heat vulnerability (its `n_veryhigh`, which the City's own heat
vulnerability map calls its priority areas), absent otherwise.

**`floodplain` (environment.pmtiles, polygons)**: FEMA's flood areas as the City publishes them
(`fema_floodplain`). `z` 1 for the 1 percent annual chance floodplain (zones A and AE, `sfha_tf`
T) and 2 for the 0.2 percent annual chance area; `fw` 1 on the floodway (the AE subtype
FLOODWAY), absent otherwise. The rest of the city (FEMA's area of minimal flood hazard) and open
water are not published.

**`trees` (trees.pmtiles, points, zoom 14 only)**: every tree of Parks and Recreation's newest
yearly tree inventory (`street_trees`): the trees the City keeps on its streets and in its parks,
not trees in private yards. `sp`, the common name, title cased from the part of the inventory's
tree name that follows the genus and species, with the inventory's "OTHER" (species not recorded)
dropped, such as "Red Maple" or "Cherry"; absent for a tree the inventory does not name. `d`, the trunk diameter at
chest height in whole inches, from 1 to 80; absent when unknown or out of that range. Nothing else
about a tree is published.

Added 2026-10-05 by M3.2 (public art; the rules are in `pipeline/src/placekeepers/derive/art.py`,
the layer in `publish/art.py`).

**`art` (art.pmtiles, points)**: works of public art: the City's Percent for Art works whose status
is Active (`percent_for_art`; the Inaccessible ones and those In Progress are left out and counted
in the build notes), OpenStreetMap's `tourism=artwork` elements inside the city (`osm_philadelphia`;
not those whose `end_date` has passed), and Wikidata's artworks inside the city (`wikidata_art`:
items of a fixed list of art classes with a coordinate, not those Wikidata says are gone).

**One record per source.** The same work in two or three sources is one work (below), but its
records stay apart: one feature per source record, at that source's point, holding only what its
own source says. OpenStreetMap's data never shares a feature with the City's or Wikidata's, as for
SEPTA's stops (decision D1 of docs/VERIFICATION_V0_2.md): OpenStreetMap's records are under the
Open Database License and credited "© OpenStreetMap contributors", the City's keep the City's terms
and Wikidata's are CC0. The records of one work share its id, `g`. The map draws one record per
work, `pr` 1 (OpenStreetMap's when it has the work, mapped where the work stands, else Wikidata's,
else the City's), and when a work is opened the browser finds its other records by `g` and joins
them (`web/src/art/join.ts`), exactly as the pipeline's reference join does
(`placekeepers.derive.art.join_published`, checked by both test suites against
`pipeline/tests/fixtures/art_join_parity.json`). Every point is kept at every zoom from 10.

Codes for the whole work, the same on each of its records (our own, from all its sources):

| Property | Type | Meaning |
|---|---|---|
| `id` | string | the record: `pa` and the City's Percent for Art number, the Wikidata item (`Q` and its number), or the OpenStreetMap element (`n` or `w` and its id) |
| `g` | string | the work: the id of its City record when the City lists it, else of its Wikidata record, else of its OpenStreetMap record. It stays the same while its sources keep their ids; when the City or Wikidata later lists a work OpenStreetMap had alone, the work takes their id |
| `k` | int | its kind, for the layer's settings: 1 murals and wall paintings, 2 sculptures and statues, 3 mosaics, 0 anything else (installations, fountains, monuments, stained glass, plaques, and works of unknown kind); from the first of OpenStreetMap's `artwork_type`, Wikidata's class and the words of the City's title and medium that names a kind |
| `src` | int | its sources, as bits: 1 the City, 2 OpenStreetMap, 4 Wikidata |
| `s` | int | this record's own source, as one of those bits |
| `pr` | int | 1 on the record that draws the work's dot; absent on the others |
| `mem` | int | 1 for a memorial artwork (below), on every record of the work; absent otherwise |
| `in` | int | 1 when the City's words say the work is inside a building (and not outside too); absent otherwise |

What each record's own source says, each absent when the source does not say it, and every one of
them absent on a memorial:

| Property | Type | Meaning |
|---|---|---|
| `nm` | string | the title: the City's, OpenStreetMap's `name` or Wikidata's English label |
| `wt` | int | 1 on a City record whose title is the City's "Title unknown (...)", which the map uses only when no other source has a title |
| `ar` | string | the artist or artists: the City's (written first name first when it writes one person "Last, First"), OpenStreetMap's `artist_name`, or Wikidata's creators |
| `y` | int | the year the work was made: the City's, OpenStreetMap's `start_date` or Wikidata's inception (P571) |
| `ty` | int | the kind in words: 1 mural, 2 painting, 3 street art or graffiti, 4 mosaic, 5 sculpture, 6 statue, 7 bust, 8 relief, 9 installation, 10 fountain, 11 monument, 12 memorial, 13 stained glass, 14 plaque; from OpenStreetMap's `artwork_type`, Wikidata's class, or the words of the City's title and medium; absent when the source names no kind |
| `md` | string | what it is made of: the City's medium or OpenStreetMap's `material` |
| `lc` | string | where it is, in the City's words (`location_name`) |
| `pa`, `doc` | int, string | on a City record, even on a memorial: the City's Percent for Art number, and the City's document about the work (a PDF its list links) when there is one |
| `w` | string | a web page about the work that OpenStreetMap (`website`, `url`, `contact:website`) or Wikidata (described at, P973; official website, P856) names, other than Wikipedia, Wikidata and OpenStreetMap, such as the Association for Public Art's page on it |
| `wp` | string | an English Wikipedia article about the work: Wikidata's, or OpenStreetMap's `wikipedia` tag |

**What the map shows for a work** (the join): the City's title (unless it is "Title unknown"), else
OpenStreetMap's, else Wikidata's; the artist from Wikidata, then OpenStreetMap, then the City; the
year from the City, then Wikidata, then OpenStreetMap; the kind in words from OpenStreetMap, then
Wikidata, then the City; the material from the City, then OpenStreetMap; the City's place in words;
Wikidata's Wikipedia article, else OpenStreetMap's; OpenStreetMap's web page, else Wikidata's; and a
link to every record: the City's document or list, the OpenStreetMap element, the Wikidata item.

**The same work in two or three sources.** Two records from different sources are the same work
when OpenStreetMap's `wikidata` tag names the Wikidata item (within 500 meters); or their names agree
and they stand at the same place (within 30 meters of each other, or of the City's parcel, with at
least half the words of the shorter name in the other); or their names agree closely within 150
meters (at least 80 percent of the words, and two words or more unless the names are the same); or
one has no name, they stand at the same place and their artists agree; or one has neither a name nor
an artist and is the only candidate of its source within 10 meters of a named work of the same kind
(mural, sculpture or mosaic), which has no other unnamed candidate of that source that close. Words
are compared without capitals, accents, punctuation and words such as "statue", "the" or
"memorial", and two long words that differ by a letter or two count as the same. Two records whose
sources name artists with no name in common are never the same work. The best pairs join first,
and a work holds at most one record of each source.

**Memorial artworks** (docs/ETHICS.md: names of people killed come only from the hand curated
memorials file, and shooting victims are never named). A work is a memorial when any of its sources
says so: OpenStreetMap tags it `artwork_type=memorial`, `historic=memorial` or any `memorial` key;
Wikidata says what it commemorates (P547) or classes it as a memorial, a war memorial, a
commemorative plaque or a ghost bike; or a name, description or inscription says "memorial", "in
memory", "in memoriam", "rest in peace", "RIP", "commemorates", "died" or "ghost bike", or a name
holds two years like a lifespan. Every record of a memorial carries only `id`, `g`, `k`, `src`, `s`,
`pr`, `mem`, `in`, and on the City's record `pa` and `doc`: no title, artist, year, medium, place in
words, subject, inscription, or link whose address could hold a name. The web app shows it as
"Memorial artwork" with its sources, and never shows a memorial's other properties even if a file
carried them. The rule is cautious on purpose: it also hides the names of famous monuments that a
source marks as memorials.

The build notes carry one sentence with each source's count, the works found in two and in three
sources, the works on the map and the memorial artworks among them, and the works left out (never a
name).

Added 2026-10-08 by M4.1 (the displacement watch; the method is in docs/DESIGN.md section 5.3, the
code in `pipeline/src/placekeepers/derive/displacement.py` and `publish/displacement.py`):

**`watch` (displacement.pmtiles, polygons)**: one feature per 2020 census tract (the City's
`census_tracts_2020`) in the displacement watch, and none for any other tract: the map ranks no
area, and areas outside the watch carry no numbers. A measure with too few sales, homes or
households to mean something (the `min_*` thresholds of the manifest's `displacement`) is left out.

| Property | Type | Meaning |
|---|---|---|
| `id` | string | the tract's 11 digit census id (`geoid`, such as 42101016000 for tract 160) |
| `nm` | string | the neighborhood at the tract's center (a point inside it), from `neighborhoods`; absent when none |
| `w` | int | the signs that hold, as bits: 1 home sale prices, 2 buyers that are companies, 4 assessed values, 8 renters, 16 the Market Value Analysis. Bits never change meaning. Every feature has at least two, one of them 1, 4 or 16 |
| `n0`, `n1` | int | home sales counted in the earlier and the recent period |
| `p0`, `p1`, `pc` | int | the middle sale price in each period (dollars) and its change (percent); only with at least `min_sales` sales in each period |
| `cb` | int | the share of the recent sales whose buyers are a company (percent); only with at least `min_sales` recent sales |
| `ah`, `ac` | int | homes compared and the middle change in their assessed value (percent); only with at least `min_assessed` homes |
| `oc`, `rp` | int | occupied homes and the share rented (percent, Census Bureau); only with at least `min_occupied` |
| `mb`, `mr` | int | the tract's block groups in the Market Value Analysis and how many show rising pressure; absent when the analysis does not cover it |

`web/src/displacement/watch.ts` reads the same bits and rule as the pipeline:
`pipeline/tests/fixtures/watch_parity.json` holds every combination of signs and whether it is a
watch area, and both test suites check it.

**`hin` (streets.pmtiles)**: `id`, `name` (street name), `len` (feet).

**`crashes` (streets.pmtiles)**: `id` (crash record number), `y` (year), `sev` (3 fatal, 2 serious
injury, 1 other injury, 0 no injury), `m` (bit flags: 1 pedestrian, 2 bicycle, 4 motorcycle, 8
scooter). Added 2026-10-04 by M1.5: `ya` (years before the newest year of records, 0 for the newest,
so the map can show "the most recent five years" without knowing which year that is). PennDOT's
public data has no scooter field, so crashes never set 8. Every PennDOT crash from 2015 on appears
once; each year comes from the newest City slice that covers it.

**`memorials` (streets.pmtiles)**: `id`, `d` (date), `m` (mode), `nm` (name, only when curated from a
public memorial list and not suppressed), `src` (source url).

Clarified and extended 2026-10-04 by M1.5: one marker per person the Police record as killed (one
row of their fatal crash table), not per crash. `id` is built from the date and the place, such as
`fc20260822_3f9a` (with `_2` and so on for more people killed in the same crash); a marker that
exists only because a curated entry has no Police record uses the curated entry's id. `d` is
`YYYY-MM-DD`. `m` uses the same bit flags as `crashes` (0 for a person in a car or other vehicle);
the map shows markers with 1, 2 or 8 by default. `src` is present only with a curated entry. New:
`pl` (the place in words, such as "600 block of Packer Ave"; house numbers become blocks) and `sg`
(suggestion ids for the crash site, comma separated, the memorial suggestion first). Nothing else
about the person is ever published: no age, sex, case number, arrest or driver details.

**`segments` (streets.pmtiles, lines)**, added 2026-10-04 by M1.5: one feature per street block from
the City's street centerlines (classes that carry traffic). `id` (the City's `seg_id`), `name`
(street name as the City writes it, such as "N BROAD ST"), `cls` (the City's street class: 1
expressway, 2 major arterial, 3 minor arterial, 4 collector, 5 local, 9 and 10 ramps), the street
safety lens factors `f_hin`, `f_ksi_vru`, `f_fatal2` and `f_school`, and the facts behind them: `hin`
(1 on the High Injury Network), `ksi` (people killed or seriously injured while walking or cycling on
the block or at its corners in the five most recent years of PennDOT records), `k2` (people killed on
the block or at its corners in the two years before the build, from the Police records) and `sch` (1
when a school is within 400 meters). A crash within 10 meters of an intersection counts for every
block that meets there; any other crash counts for the nearest block within 30 meters (60 meters for
the Police records, whose points are less precise).

In the tiles (not the GeoJSON), low zooms carry only what matters most citywide: crashes with a death
or serious injury, blocks with `hin`, `ksi` or `k2`, and every memorial. Other crashes and blocks near
a school appear from zoom 12, and every block from zoom 14 (`publish/tiles.py`).

Added 2026-10-04 by M1.1 (and `lc` in `parcels` is now filled from PHS LandCare):

**`landcare` (care.pmtiles)**: `id` (OPA account, 9 digits, or empty when the site has none), `p`
(program: 1 LandCare, 2 Community LandCare, 3 Land Bank lot, 4 PHDC lot, 0 other), `y` (year the
lot joined, 0 when unknown).

**`gardens` (care.pmtiles, points)**: `nm` (name), `src` (1 supported by PHS, 2 by the Neighborhood
Gardens Trust, 3 by both, 4 registered with Parks and Recreation), `w` (website, only when known).

**`council_districts` (boundaries.pmtiles)**: `d` (district number, 1 to 10), `nm` ("District 5").

**`rcos` (boundaries.pmtiles)**: `id` (the City's L&I id for the organization), `nm` (organization
name), `t` (type as the City records it: Ward, SSD, NID, Other; only when known), `w` (website, only
when known). Areas overlap. Contact people's names, emails and phones are never published.

**`neighborhoods` (boundaries.pmtiles)**: `id` (code name, such as `BRIDESBURG`), `nm` (name, such as
`Bridesburg`).

Every boundary layer has `nm`, so one style (`boundary`) can draw and label all three.

Added 2026-10-04 by M2.1 (SEPTA data; the method in plain words is in
[TRANSIT_METHOD.md](TRANSIT_METHOD.md)):

**`stops` (transit.pmtiles, points)**: every place in Philadelphia where people board a SEPTA bus,
trolley, subway, El or Regional Rail train, with any departure on a typical weekday, Saturday or
Sunday (a trip's last stop and stops where no one may board are not departures). One point per
SEPTA stop: the two sides of a street, and the two platforms of a subway station, are separate.
"In Philadelphia" is inside the City Council districts widened by 100 meters. In the tiles, stops
start at zoom 12.

| Property | Type | Meaning |
|---|---|---|
| `id` | string | the Placekeepers stop key: `sp` and the SEPTA stop number when the stop was first seen (`sr` for Regional Rail), with `_2` and so on when that key is taken. It never changes and never moves to another stop. When SEPTA renumbers a stop in place (a new number within 30 meters with a similar name, when the old one disappears or within a year after), the stop keeps its key |
| `sid` | string | SEPTA's stop number today (GTFS `stop_id`, also its `stop_code`) |
| `fid` | string | earlier SEPTA numbers of this stop, newest first, comma separated; only when there are any |
| `nm` | string | the stop name as SEPTA writes it, with its side of the street in words ("Broad St & Erie Av (far side)") and any other dash used as punctuation as a comma |
| `md` | int | modes, as bits: 1 bus (and trackless trolley), 2 trolley, 4 subway or El, 8 Regional Rail |
| `r` | string | the routes that stop here on the typical days, SEPTA's short names in SEPTA's order, comma separated ("53,56", "B1,B2,B3") |
| `tw`, `ts`, `tu` | int | departures on the typical weekday, Saturday and Sunday |
| `bh` | int | departures in the busiest clock hour on the weekday |
| `hp` | int | the typical wait between departures from 7 to 9 in the morning on the weekday, in whole minutes (120 divided by the departures); absent when none |
| `hm`, `hs`, `hu` | int | the same from 10 to 2 on the weekday, Saturday and Sunday (240 divided by the departures); absent when none |
| `ft`, `lt` | int | the first and last departure on the weekday, in minutes after midnight of SEPTA's service day, which runs past midnight (1530 is 1:30 at night); only with weekday service |
| `ev` | int | weekday departures from 8 at night on; only with weekday service |
| `nt` | int | how many of the clock hours from 1 to 4 in the morning have a weekday departure (1 to 3; 3 is service through the night); only when above 0 |
| `wc` | int | SEPTA's wheelchair boarding: 1 reachable, 2 not; absent when SEPTA does not say |
| `b` | int | average weekday boardings from SEPTA's newest spring or fall stop count, summed over the routes and directions counted there (0 when SEPTA counted no one); absent when no count matches, never estimated |
| `bp` | string | the period of that count, such as "Spring 2026"; only with `b` |
| `bx` | string | the SEPTA number the count was recorded under, when it is not `sid` (a number this stop had before, or a stop it replaced within 30 meters with a similar name); only with `b` |

A count matches a stop by its own number, then by a number in its history, then by a stop number no
longer in the schedules within 30 meters with a similar name; each count goes to one stop at most.

Added 2026-10-05 by M2.3 (the transit comfort lens; the method in plain words is in
[TRANSIT_METHOD.md](TRANSIT_METHOD.md), the code in `pipeline/src/placekeepers/derive/transit_comfort.py`).
Bus and trolley stops (`md` bit 1 or 2) also carry these; stations of the subway, the El and
Regional Rail carry none of them, nor do the 15 trolley tunnel stations underground from 13th
Street to 37th Street (`TUNNEL_STATIONS` in `derive/transit_comfort.py`, added 2026-10-05 by the
v0.2 review).

Changed 2026-10-05 (decision D1 of VERIFICATION_V0_2.md): this file never holds what OpenStreetMap
says at a stop, nor anything worked out only from it. Storing OpenStreetMap's answers in SEPTA's
stop records would make a derivative database the Open Database License asks to be shared under
it, which SEPTA's license does not let us grant. A stop carries the id of the OpenStreetMap stop at
the same pole (`o`) as a link; what OpenStreetMap says there is in `tables/stop_amenities.json`
(section 8), and the browser joins the two. The properties that were removed (`om`, `a`, `sh`,
`bn`, `li`, `cv`, `f_noshelter`, `f_nobench`, and the suggestions they decide) are what the join
gives (`web/src/transit/answers.ts`, following `join_published` in `derive/transit_comfort.py`;
`pipeline/tests/fixtures/stop_join_parity.json` holds both to the same answers). The file reads
OpenStreetMap only to make the link, so its credit line names SEPTA and the City alone
(`LayerBuilder.links` in `publish/layers.py`); the stops layer still lists `osm_philadelphia` among
its sources, because the map shows the joined answers on it, credited "© OpenStreetMap
contributors".

| Property | Type | Meaning |
|---|---|---|
| `tc` | int | 1 for a stop the transit comfort lens scores (a bus or trolley stop on the street); absent for stations and the trolley tunnel stations. The browser gives such a stop the halfway answers (50) where nothing is known |
| `o` | string | the OpenStreetMap stop at the same pole, as its id in amenities.pmtiles and tables/stop_amenities.json (`n` or `w` and the element id); absent when none matched. The match is `match_septa` in `derive/bus_stops.py`, as for the route survey sheets (section 7): by stop number, then by distance, both only within 15 meters, closest pairs first, each stop once; a number counts only when no other SEPTA stop stands more than 3 meters closer, and by distance an OpenStreetMap stop pairs only with its nearest SEPTA stop (changed 2026-10-05 by the v0.2 review) |
| `f_riders` | int | lens factor: the share of bus and trolley stops with fewer weekday boardings (`b`); absent without a count |
| `f_shade` | int | the share of stops with more tree canopy (2018) on the land of their H3 cell (resolution 9, water left out); absent without canopy data |
| `f_heat` | int | the share of stops whose census tract has a lower heat exposure score (`heat_vulnerability`, `hei_score`); absent outside the tracts or without the data |
| `f_hin` | int | 100 when the stop stands within 30 meters of the High Injury Network, else 0 |
| `f_wait` | int | the share of stops with a shorter midday weekday wait (`hm`); absent without midday service |
| `cp` | int | percent of the land of the stop's H3 cell under tree canopy in 2018; absent without canopy data |
| `hin` | int | 1 when the stop is on the High Injury Network; absent otherwise |
| `sg` | string | the suggestions SEPTA's and the City's data decide, comma separated: `stop_shade_trees` (`f_shade` of 75 or more); absent when none |
| `f_walk`, `f_neighbors`, `f_dest` | int | the walking factors of the lots (added 2026-10-05 by M3.3; `parcels` above), measured from the stop and ranked among the stops `tc` marks, more ranking higher; no lens lists them yet (`factors_at` in `derive/walk.py`) |
| `dw` | int | the signs of the displacement watch area the stop stands in, as `dw` on the lots (added 2026-10-08 by M4.1); absent outside every watch area |

What the browser adds by the join (never published here): `a` (the linked stop's `c`: 3 a shelter
or roof, 2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed; absent when no
OpenStreetMap stop is linked, which is also not yet surveyed, never "missing"); `om` (1 when the
stop numbers agree: an `n` of the linked stop names `sid` or a number in `fid`; 2 when the two only
stand at the same place); `sh`, `bn`, `li` (lit; `lt` here is the last departure) and `cv`, 1 yes
and 0 no, absent when unknown; `f_noshelter` (100 when a survey found no shelter, 0 with a shelter
or the whole stop under a roof, 50 when not yet surveyed) and `f_nobench` (100, 0 or 50 the same
way); and the suggestions in this order: `stop_survey` (shelter or bench not known yet),
`stop_shelter_request` (a survey found no shelter, and the stop is not under a roof),
`stop_bench_request` (a survey found no bench), `stop_streetlight_report` (OpenStreetMap says the
stop is not lit), then those in `sg`.

Every rank is among the bus and trolley stops on the map, as in section 1 (lenses). The build notes
carry the match counts, the surveyed counts and the count of each suggestion as the browser will
show them.

**`routes` (transit.pmtiles, lines)**: every SEPTA route with a stop in Philadelphia on the typical
days, as the lines its trips follow, merged, simplified to about 5 meters and cut to a box around
the city. Routes whose trips have no shapes in the feed are left out.

| Property | Type | Meaning |
|---|---|---|
| `id` | string | SEPTA's route id (GTFS `route_id`) |
| `r` | string | SEPTA's short name, such as "47", "T1", "L1", "CHW" |
| `nm` | string | SEPTA's long name, dashes used as punctuation turned into commas |
| `md` | int | the mode, as for `stops` |
| `tw` | int | trips on the typical weekday |
| `hp`, `hm` | int | the typical wait from 7 to 9 and from 10 to 2 on the weekday, where the route runs most often (its busiest stop in its busiest direction); absent when none |

Added 2026-10-04 by M2.2, from the `osm_philadelphia` snapshot (OpenStreetMap, so the layers of
this file are under the Open Database License and credited "© OpenStreetMap contributors").
`amenities.pmtiles` holds amenities from OpenStreetMap; M2.2 adds the first layer, and later
milestones (M3.5: drinking water, toilets and more) add theirs to the same file:

**`stops` (amenities.pmtiles, points)**: the shelters and benches at stops: every bus and trolley
stop OpenStreetMap knows inside the city limits, one point each (a stop drawn as a line or an area
gets a point on it). A stop is an element tagged `highway=bus_stop` that is not a
`public_transport=stop_position`, or a `public_transport=platform` for buses, trolleybuses or
trolleys; station platforms of trains, subways and light rail, platforms underground or indoors,
and stops closed to the public are left out (`pipeline/src/placekeepers/derive/bus_stops.py`).

| Property | Type | Meaning |
|---|---|---|
| `id` | string | The element in OpenStreetMap: `n` and the node id, or `w` and the way id, such as `n7735158249` (www.openstreetmap.org/node/7735158249) |
| `c` | int | What the map shows: 3 a shelter, or the whole stop is under a roof (`sh` 1 or `cv` 1); 2 a bench but no shelter mapped (`bn` 1); 1 no shelter and no bench (`sh` 0 and `bn` 0); 0 not yet surveyed (anything else, including only one of the two answers). Unknown is never shown as missing |
| `md` | int | How it is served, as bits: 1 bus, 2 trolley |
| `sh`, `bn`, `bi`, `lt`, `tp`, `db`, `cv` | int | The stop's answers, 1 yes and 0 no, absent when OpenStreetMap does not say (or says something we do not recognize): shelter, bench, waste basket (`bin`), lit, tactile paving, departures board, and whether the whole stop is covered (`covered`) |
| `wc` | int | Wheelchair access: 1 yes, 0 no, 2 limited; absent when unknown |
| `nb` | int | Bits, present only when set: 1 the shelter, 2 the bench is mapped on its own beside the stop rather than answered on the stop |
| `nm`, `ref`, `gs` | string | The stop's `name`, `ref` (SEPTA's stop number, where mapped) and `gtfs:stop_id` tags, only when it has them, so the stops can be matched with SEPTA's (M2.3) |

Which values count as yes and as no is the `YES_NO` table in `derive/bus_stops.py` (for example
`lit=automatic` is yes, `departures_board=realtime` is yes, `shelter=separate` is yes). A shelter
(`amenity=shelter` with `shelter_type=public_transport` or no `shelter_type`) or a bench
(`amenity=bench`) mapped on its own counts for the nearest stop within 10 meters, measured in UTM
zone 18 north, and only when that stop has no answer of its own: a stop's own answer always wins.
A shelter tagged `bench=yes` gives its stop a bench too. The build notes carry one sentence with
the counts of each `c` inside the city.

These are OpenStreetMap's stops, not SEPTA's: SEPTA's own stops are `stops` in `transit.pmtiles`
(above). M2.3 joins the two by SEPTA's stop number first, an OpenStreetMap stop's `ref` (or `gs`)
against SEPTA's `sid`, then by distance for the stops that do not match by number. The route survey
sheets (section 7, M2.4) and SEPTA's stops on the map (`o` there, M2.3) both pair them with
`match_septa` in `pipeline/src/placekeepers/derive/bus_stops.py`, so a stop's sheet and its details
on the map always describe the same OpenStreetMap stop. Both carry only the id: what OpenStreetMap
says at each stop is published apart, in this layer and in `tables/stop_amenities.json` (section 8),
and joined in the browser (decision D1).

Added 2026-10-05 by M3.5, five more layers of `amenities.pmtiles`, one per OpenStreetMap tag, every
element inside the city limits with that tag that is not closed to the public (`access` no or
private) or disused, one point each (`pipeline/src/placekeepers/derive/amenities.py`). As for the
stops, an answer OpenStreetMap does not have is left out, never shown as no, and yes and no are
read as in `YES_NO` above. Every feature has `id` (the element, such as `n10554560825`) and `nm`
(its name, only when it has one; changed 2026-10-05 by M3.2: never on a memorial, such as a bench
that remembers someone, by the memorial rule of the `art` layer above); the other properties are
each 1 yes and 0 no unless the table says otherwise:

| Layer (tag) | Properties |
|---|---|
| `benches` (`amenity=bench`) | `br` a backrest, `cv` under a roof (`covered`) |
| `picnic_tables` (`leisure=picnic_table`) | `cv` under a roof |
| `water` (`amenity=drinking_water`) | `bt` a bottle can be filled (`bottle`), `sn` only part of the year (`seasonal`: 0 for no, 1 for yes or a season), `in` indoors (`indoor`, or `location` indoor or outdoor) |
| `toilets` (`amenity=toilets`) | `ac` who may use them (`access`: 1 yes, public, permissive or designated; 2 customers; absent otherwise), `fee`, `wc` wheelchair access (1 yes or designated, 0 no, 2 limited), `ct` a changing table, `in` indoors, `oh` the opening hours exactly as mapped (OpenStreetMap's notation, at most 120 characters) |
| `bookcases` (`amenity=public_bookcase`, little free libraries) | none beyond `id` and `nm` |

The build notes carry one sentence per layer with the count inside the city. On 2026-10-05 (data of
2026-10-03): 2,069 benches (1,062 with a backrest), 306 picnic tables, 30 drinking water points, 73
public toilets (one more closed to the public left out) and 150 public bookcases.

**`park_water`, `libraries`, `recreation` and `pools` (places.pmtiles, points)**, added 2026-10-05 by
M3.5: public places as the City lists them (`pipeline/src/placekeepers/publish/city_places.py`), in
their own file because the City's data is under its own terms while data built from OpenStreetMap
must stay under the Open Database License. Every feature has `id` (the City's object id after a
prefix naming its layer: `water`, `lib`, `rec`, `pool` or `spray`, so ids never collide) and `nm`.
Points outside a box around the city are left out and counted in the notes.

| Layer | Source | Properties |
|---|---|---|
| `park_water` | `ppr_hydration_stations` | `nm` where it is (the City's `amenity_name`), `pk` the park when it differs, `k` 1 drinking fountain, 2 bottle filling station, `in` 1 indoors, 0 outdoors |
| `libraries` | `library_locations` | `nm` the branch, `ad` street address, `zip` five digit ZIP code, `ph` phone, `url` the branch's page on freelibrary.org (only links to `https://libwww.freelibrary.org/` or `https://www.freelibrary.org/` are kept) |
| `recreation` | `ppr_program_sites` | `nm`, `k` 1 recreation center, 2 older adult center, 3 environmental education center (the program sites that are pools are left to `pools`), `bd` 1 a building, 0 a site without one, `gym` 1 has a gym, 0 none |
| `pools` | `ppr_swimming_pools`, `ppr_spraygrounds` | `k` 1 pool, 2 sprayground, 3 sprinkler, `st` 1 in service this year, 0 not (the City's `pool_status` or `spray_status`, ACTIVE or INACTIVE; absent when the City says UNKNOWN), and for pools `in` 1 indoor, 0 outdoor, `ada` 1 listed as accessible, 0 not, `ad` street address, `op` the day it opened this season, only when in service |

Each property is absent when the City leaves it empty.

**`dumping`, `lights` and `graffiti` (conditions.pmtiles, points)**, added 2026-10-05 by M3.5, from
`philly311_conditions` (311 requests about physical conditions only, never people;
`pipeline/src/placekeepers/publish/conditions.py`):

* `dumping`: the City's service code SR-ST02, Illegal Dumping;
* `lights`: SR-ST04, Street Light Outage, and SR-ST06, Alley Light Outage;
* `graffiti`: SR-CL01, Graffiti Removal.

They count requests **by block, never by address**: each request made in the 90 days up to the
newest request in the snapshot counts on the nearest street block within 50 meters of where it was
reported (the City's street centerlines, the blocks of the `segments` layer; a request farther from
any block, or without a point, is left out and counted in the notes). Each block with at least one
request is one point, at the middle of the block:

| Property | Type | Meaning |
|---|---|---|
| `id` | int | the block's `seg_id`, the same `id` as the block in `segments` (streets.pmtiles) |
| `name` | string | the street, as the City writes it ("N BROAD ST") |
| `n` | int | requests on the block in the window |
| `o` | int | how many of them were still open in the City's table when the snapshot was made |
| `d` | string | the day of the newest request on the block, YYYY-MM-DD in Philadelphia |
| `a` | int | `lights` only: how many of the `n` were about an alley light; absent when none |

The window's last day is the source's `newest_record` in the manifest (the City's table runs a day
or two behind). Nothing else from 311 is published or even downloaded: no request number, address,
subject, notes, photo or agency (`never_fetch` in `pipeline/src/placekeepers/adapters/philly311.py`).
On 2026-10-05 (window 2026-07-05 to 2026-10-02): 3,919 dumping requests on 2,675 blocks (190 still
open), 919 light requests on 700 blocks (432 still open) and 297 graffiti requests on 232 blocks (31
still open).

For M3.4 (placemaking suggestions, built 2026-10-08): a lot is joined to the blocks it faces (the
blocks within 20 meters of its shape), and an open request on one of them suggests reporting it to
Philly311 (`parcels` above). A count says that people asked the City for help there, not how often
the condition occurs: some blocks ask more often than others, so no count or a low one is not a
sign of a clean block, and no count is ever a factor. Suggestions built on them stay with physical
conditions and the City's own services (Philly311, the route `report_to_311` in
`registry/routes.yaml`), never the police (docs/ETHICS.md).

Added 2026-10-05 by M3.3 (walking, cycling and people; `pipeline/src/placekeepers/publish/walk.py`,
the method in DESIGN section 5.9). `walk.pmtiles` holds public domain data from the EPA and the
Census Bureau measured with the City's data; `cycling.pmtiles` holds DVRPC's ratings, credited to
DVRPC under its data license.

**`block_groups` (walk.pmtiles, polygons)**: the EPA's National Walkability Index for each of
Philadelphia's census block groups (`epa_walkability`, the 2019 block groups of the Smart Location
Database, version 3), trimmed to the city's land (the census tracts joined, less the land use map's
water), so the rivers stay clear; a block group lying wholly on water is left out.

| Property | Type | Meaning |
|---|---|---|
| `id` | string | the block group's 12 digit census id (`GEOID10`) |
| `w` | number | the walkability index, 1 to 20, to one decimal |
| `nw` | int | the EPA's own class of the index: 1 least walkable (up to 5.75), 2 below average (up to 10.5), 3 above average (up to 15.25), 4 most walkable |
| `rc`, `rt`, `rj`, `rh` | int | the four parts of the index as the EPA ranks them among every block group in the country, 1 to 20: intersection density (`D3B_Ranked`, a third of the index), how close the nearest transit stop is (`D4A_Ranked`, a third), the mix of kinds of jobs (`D2B_Ranked`, a sixth) and the mix of jobs and households (`D2A_Ranked`, a sixth) |
| `qw`, `qc`, `qt`, `qm` | int | the fifth of Philadelphia's block groups each falls in, 1 to 5 (5 the most walkable, the most corners, the closest transit, the most mixed): by the index, by the intersection density (`D3B`), by the distance to transit (`D4A`, nearer is higher; no stop within three quarters of a mile is lowest) and by the average of the two mix measures |

Each is absent when the EPA gives no value. The map compares within the city by `q*`, or with the
whole country by `nw` for the index and the national ranks in fifths for a part (ranks 1 to 4 are
the bottom fifth, 17 to 20 the top).

**`cells` (walk.pmtiles, polygons)**: one H3 resolution 9 hexagon (about two blocks across, the
area cells of DESIGN section 5.1) for every cell whose middle lies inside the city and not on the
land use map's water, measured from its middle exactly as the parcels are (derive/walk.py):

| Property | Type | Meaning |
|---|---|---|
| `h` | string | the H3 cell id |
| `p` | int | people who live within a 5 minute walk (400 meters) of the middle, from the 2020 census blocks |
| `d` | int | how many of the seven kinds of everyday places lie within a 10 minute walk (800 meters), 0 to 7 |
| `dk` | int | which kinds, as bits: 1 a library, 2 a recreation center, 4 a pool or sprayground, 8 a drinking fountain in a park, 16 a school, 32 a grocery store or market that takes SNAP, 64 a SEPTA stop |
| `k` | int | street corners within a 5 minute walk: points where three or more segments of the City's street centerlines that people can walk on meet (classes 2 to 5 and 15, not expressways, ramps or driveways) |
| `f_walk`, `f_neighbors`, `f_dest`, `f_corners` | int | the factors of the parcels, ranked among the cells instead, for any later lens on cells (M3.4 left the cells out) |

Each measure is absent when its source has no snapshot. On 2026-10-05: 3,335 cells; people
within a 5 minute walk from 0 to 13,680 (median 1,921).

**`stress` (cycling.pmtiles, lines)**: DVRPC's Level of Traffic Stress for each street segment of
its network in Philadelphia (`dvrpc_lts`), one line per link: DVRPC keeps each direction of a
street as its own row with the same link number, and where the two directions differ (82 links on
2026-10-05) the line shows the more stressful one. In the tiles, below zoom 12 only links at level 3
or 4, or with a bike lane, a buffered or protected lane or a trail (`bf` 3 or more), are kept;
every link from zoom 12 (`publish/tiles.py`).

| Property | Type | Meaning |
|---|---|---|
| `id` | int | DVRPC's link number (`no`) |
| `l` | int | the level of traffic stress, 1 to 4: 1 comfortable for most people of all ages, 2 for most adults, 3 only for confident riders, 4 only for the strong and fearless |
| `l2` | int | the other direction's level, only when it is calmer |
| `bf` | int | the best bike facility of the link: 1 a signed bike route, 2 shared lane markings (sharrows), 3 a bike lane, 4 a buffered bike lane, 5 a protected bike lane, 6 a trail or path off the road (`BIKE_FACILITIES` in `adapters/walk.py`); absent when none |
| `sp` | int | the traffic speed DVRPC used, in miles an hour (a posted limit or its model's estimate); absent when 0 |
| `ln` | int | the lanes in all, both directions together; absent when unknown |

Added 2026-10-08 by issue #37 (parking problems reported with Philly Bike Action's Laser Vision
app, used with Philly Bike Action's permission; `pipeline/src/placekeepers/publish/laser.py`):

**`parking` (parking.pmtiles)**: where people using Laser Vision reported vehicles blocking the
way, counted per H3 cell at resolution 10 (about 115 meters across, about a Philadelphia block)
over the 12 months up to the source's `newest_record` in the manifest (`pba_laser`); the window
starts the day after the same date 12 months earlier. **Counts only, never a single report**: a
cell is published only with at least 5 reports in the window, and a kind's count within it only
with at least 5 of its own. Each published cell is written twice in the layer, with the same
counts: as a **point** at the cell's center (the map draws a heat map from these, weighted by the
count) and as its **hexagon**, which alone carries `id`. In the tiles the points are kept below
zoom 14 and the hexagons from zoom 13 (`publish/tiles.py`); the GeoJSON keeps both at every zoom,
told apart by geometry type.

| Property | Type | Meaning |
|---|---|---|
| `id` | string | the H3 cell id; on the hexagons only |
| `n` | int | every report in the cell in the window, 5 or more |
| `sw` | int | vehicles on a sidewalk (Laser Vision's "Sidewalk") |
| `bl` | int | vehicles in a bike lane ("Bike Lane") |
| `cw` | int | vehicles on a crosswalk ("Crosswalk") |
| `co` | int | vehicles on a corner ("Corner Clearance") |
| `rp` | int | vehicles blocking a curb ramp ("Handicap Ramp") |

Each kind is absent when the cell has fewer than 5 reports of it (the map says "fewer than 5"),
so the kinds shown may add up to less than `n`. Nothing else from Laser Vision is published or
even stored: no vehicle, plate, photo, time of day or reporter, and never a point (the snapshot
keeps each report as its cell). On 2026-10-08: 1,112 cells (23,254 of the 26,060 reports in the 12
months to 2026-10-07); 1,497 cells with fewer than 5 reports, holding 2,806, left out. The tile
file is 152 kB, its largest tile 28 kB (zoom 13).

## 5. Hand curated memorial files (`data/curated/`)

Added 2026-10-04 by M1.5. People edit these by hand; the pipeline reads them at every publish
(`pipeline/src/placekeepers/curated.py`).

`memorials.yaml` is a list of names copied from public memorial lists (docs/ETHICS.md), never
scraped. Each entry:

```yaml
- id: m2024_0001                # ours, stable, never reused; lowercase, digits, underscores
  name: "..."                   # as the public source gives it
  date: 2024-05-17              # the day of the crash
  mode: walking                 # walking | cycling | scooter | motorcycle | driving | passenger
  crash: fc20240517_3f9a        # optional: the memorial marker id this name belongs to
  lat: 39.988                   # the approximate place; needed when there is no crash link
  lng: -75.154
  place: Broad St and Erie Ave  # optional, in words
  source: https://...           # the public memorial page (https only)
  note: ...                     # optional, for curators, never published
```

An entry joins a marker by `crash`, or else by its date (one day either way) and place (within 250
meters, nearest first, the same mode preferred). An entry that matches no marker becomes its own
marker at its place, so a person killed before 2019 can be remembered. An entry with a problem is
skipped and reported in the build notes by its id, never by name.

Names wait for the removal address (owner decision 2026-10-04, recorded in ROADMAP.md; added to
this contract 2026-10-04 by M1.10): ETHICS.md promises families that one email takes a name down,
so while `REMOVAL_EMAIL` in `web/src/content/removal-email.ts` is null (or missing, or cannot be
read), the pipeline publishes no `nm` and no `src` and makes no marker from a curated entry, and the
build notes say how many names wait. The memorial names snapshot (which goes on the public
data-snapshots release) never holds names or memorial page links, since a link names the person,
and leaves out entries listed in `suppressed.yaml`.

`suppressed.yaml` lists what never appears again, by id only: a curated entry's id (its name never
shows; the Police marker stays, unnamed) or a marker's id (the marker is not drawn). A marker may be
listed with its date, `lat` and `lng`, so it stays hidden even if the Police correct the record and
its id changes. If this file cannot be read, no memorials are published at all.

## 6. Dossier shards (`dossiers/<prefix>.json`), `dossiers/common.json` and the owners table

Rewritten 2026-10-04 by M1.3, which builds them (`pipeline/src/placekeepers/publish/dossiers.py`).
The lot dossier (milestone M1.6) reads them.

**Which parcels.** Every candidate parcel (`pipeline/src/placekeepers/candidates.py`: on either City
vacancy list, owned by the City, the Land Bank, the Redevelopment Authority or PHDC, in PHS
LandCare, vacant land or a vacant exterior to the assessor, cleaned and sealed or demolished since
2016, on the unsafe or imminently dangerous lists, or the subject of a vacancy complaint to L&I
since 2023), and every parcel the vacancy model shows,
that OPA or the City's list of public property still knows (outside the candidates, a dossier says
in `partial` which records it was not built from). Any other parcel is looked up live.

**Files** (changed 2026-10-04 by the orchestrator, so one lot opens fast on a phone): a parcel's
dossier is in `dossiers/<first four digits of its 9 digit OPA account>.json`, which holds only
parcels, and the records its timeline adds are in `dossiers/history/` under the same name (below,
"History shards"; added 2026-10-09 by M4.2). The parts of each flag that are the same for every parcel, and the notices, are in one
file, `dossiers/common.json`, which the browser fetches once. On 2026-10-04: 77,866 parcels in 929
files, 108.3 MB on disk and 14.5 MB as served compressed; the largest file (`8715.json`, 810
parcels) is 1.2 MB, 178 kB compressed; the median file holds 52 parcels (74 kB). `common.json` is
5.2 kB. The manifest's `dossiers` block (section 3) names the prefixes that have a file; a parcel
whose prefix is not there has no dossier and is looked up live.

A shard, `dossiers/3710.json`:

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "parcels": {
    "371000001": {
      "address": "2931 N LAWRENCE ST",
      "vacancy": {"kind": "lot", "confidence": "high", "rs": 13, "n": 2},
      "owner": {
        "names": ["MORALES ROSA"],
        "mailing": "41 ORCHARD RD, CHERRY HILL NJ 08002",
        "type": "individual",
        "type_reason": "The owner name looks like a person's name.",
        "flags": [
          {"id": "absentee", "text": "The owner gets mail somewhere else: Cherry Hill, NJ (out of state).",
           "data": {"scope": "out_of_state", "place": "Cherry Hill, NJ"}},
          {"id": "years_since_sale", "text": "Last sold in 1987.", "data": {"year": 1987, "date": "1987-06-12", "price": 15000, "source": "opa_properties"}}
        ],
        "notice": "deed_fraud",
        "help": ["tangled_title_help", "fraud_guard"]
      },
      "transfers": [{"date": "2016-08-09", "type": "SHERIFF'S DEED", "price": 12300, "from": ["..."], "to": ["..."]}],
      "assessments": [[2027, 13800], [2026, 13800]],
      "li": {"open_violations": 1, "last_violation": "2025-08-01", "unsafe": false, "imminently_dangerous": false, "violations": 2},
      "routes": ["ask_the_owner", "conservatorship"],
      "suggestions": ["clean_and_green"],
      "nearby": {"s12": 1, "s36": 2, "landcare_within_500ft": 4, "gardens_within_500ft": 0}
    }
  }
}
```

`dossiers/common.json`:

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "flags": {
    "absentee": {
      "careful": "This is the address where the City sends tax bills. ...",
      "next_step": "Write to the owner at this address to ask before ...",
      "routes": ["ask_the_owner"],
      "sources": ["opa_properties"]
    }
  },
  "notices": {
    "deed_fraud": {"text": "Deed theft happens when ...", "routes": ["fraud_guard"], "links": [{"label": "...", "url": "..."}]}
  }
}
```

**`flags` and `notices` (in `common.json`).** Every flag has three parts (docs/ETHICS.md): what it
means, why to be careful, and a protective next step. The careful note and the next step are the
same for every parcel with that flag, so `common.json` holds them once, by flag id, with the flag's
`routes` (registry route ids), `links` (label and url) and `sources` (registry source ids). A
parcel's flag holds its own `text` and `data`. Put together, `text`, `careful` and `next_step` give
the full flag; the possible estate flag then reads the ETHICS.md text word for word. `notices` holds
the deed fraud notice the same way.

**`vacancy`** (decided 2026-10-04 by the orchestrator): the vacancy model's call, read from the same
output the lots layer reads, so the dossier and the map always agree. It carries the tile's fields,
not sentences: `kind` (`lot` or `building`, from the tile's `k`), `confidence` (`high`, `medium` or
`low`), `rs` (the reason bits of section 4), `n` (independent records that agree), and `dy`, `sy`,
`ny` only when present. The web app turns `rs` into sentences (`web/src/places/reasons.ts`), so the
wording lives in one place. `vacancy` is `null` for a parcel the model leaves out (parks, gardens,
parking and similar) or does not call vacant. When the model has not run, the map shows the City's
lists alone and so do the dossiers: `confidence` `medium`, `rs` with bit 0 (land list) or bit 1
(building list) or both, and `n` 0.

**`owner`**: `names` as OPA publishes them (owner 1, then owner 2); `mailing`, the mailing address
lines as the City publishes them, joined with commas (or `null`); `type`, one of `individual`,
`company`, `city`, `land_bank`, `redevelopment_authority`, `housing_authority`, `nonprofit`,
`other_public`, `unknown` (the names of the `ot` codes, section 4); `type_reason`, a sentence saying
why; `city_owned` (only for parcels on the City's list of public property): `agency` (`PUB` the City,
`PLB` the Land Bank, `PRA` the Redevelopment Authority, `PHDC`), `status` as the City writes it,
`side_yard_eligible`, and `available: true` when the City's land agencies list the parcel as
available (absent otherwise; added 2026-10-08, issue #36, the same rule as the lots layer's `la`).
A parcel with several records takes an available status when any record has one, else the first
status in alphabetical order; `side_yard_eligible` is true when a record with that status is
marked eligible and the status does not say "not for SY" (`placekeepers.derive.city_list`). The
list's records carry no date: the lot page dates it by the manifest's `last_success` for
`city_owned_property`; `flags`; `notice` (`"deed_fraud"`, on every dossier whose owner may be a
person: typed `individual` or `unknown`, or a private owner whose names carry an estate, with or
without flags; changed 2026-10-04 by the orchestrator); and `help` (the Tangled Title Fund and Fraud
Guard route ids, on every dossier of a private owner with a flag).

Flags, in this order, with their `data`:

| `id` | Who gets it | `data` |
|---|---|---|
| `absentee` | private owners | `scope`: `elsewhere_in_city`, `po_box_in_city`, `outside_city` or `out_of_state`; `place` (such as "Cherry Hill, NJ") outside the city |
| `possible_estate` | private owners | none |
| `tax_debt_2025` | every owner | `as_of` ("2025-07-09"), `total_due` (dollars), `years` (tax years owed) |
| `sheriff_sales` | every owner | `sales`: `date` and `price` of each, oldest first |
| `years_since_sale` | private owners | `year`; with a known sale `date`, `price` and `source` (`opa_properties` when it comes from the assessor, before the deed records begin in 2000); with none, `sold: false` and `year` is the year since which there has been no sale on the open market |
| `many_parcels` | private owners with at least 5 parcels we call vacant with high or medium confidence | `count`; for an organization `list` (a key of `tables/owners.json`); for an owner who may be a person `parcels`, their other parcels (each `id`, `address`, `kind`, `confidence`, as in `tables/owners.json`), never a `list` |
| `fast_resales` | every owner | `count`, `dates` (two or more sales within 24 months of each other) |
| `open_violations` | every owner | `count`, `last` (date), `title` (the City's violation title) |
| `unsafe`, `imminently_dangerous` | every owner | `since` (date) |

Private owners are a person, a company, a nonprofit, or an owner name we could not type. How each
flag is computed is in `pipeline/src/placekeepers/derive/` (`owners.py`, `transfers.py`,
`flags.py`); every sentence is in `wording.py`.

**Held back on a parcel that may be someone's home** (added 2026-10-04, docs/VERIFICATION.md D5
and D6). For an owner who may be a person (`type` `individual` or `unknown`, or a private owner
whose names carry an estate), the flags about the owner (`absentee`, `possible_estate`,
`tax_debt_2025`, `many_parcels`) appear only when `vacancy.confidence` is `high` or `medium`.
`possible_estate` never appears on a parcel with a homestead exemption. The owner's names and
mailing address, and the flags about the parcel (`sheriff_sales`, `years_since_sale`,
`fast_resales`, `open_violations`, `unsafe`, `imminently_dangerous`), are unchanged; organizations
keep every flag. The rule is `owner_flag_allowed` in `derive/flags.py`.

**`transfers`**: every deed, newest first: every document type that names a deed, and certificates
of stock transfer. Mortgages and other filings are left out. Changed 2026-10-04 by M1.6b, as the
orchestrator decided, so the dossier matches the City's property page: `date` is the date on the
deed as that page shows it (the City's `display_date`, a day in Philadelphia; the City uses the
recording date when the deed has no date, or a date after it was recorded); `price` is the adjusted
total in dollars, to the cent when it has cents (this property's share when one deed covered several
properties; the total consideration when there is no adjusted total; `null` when the record has
neither). The lot page rounds prices to the dollar, half a dollar up, as the City's page does. `type` is the City's document type as
published; `from` and `to` up to 10 names each, with `from_more` and `to_more` counting the rest;
`properties` when one price covered several properties. Sales for a token price ($100 or less) and
sheriff deeds are listed here but are not "sales" for `years_since_sale`. The flags built from the
deeds (`sheriff_sales`, `years_since_sale`, `fast_resales`) use the same dates and prices. The City's
property page lists only plain deeds; the dossier also lists sheriff and other deeds.

**`assessments`** (changed 2026-10-04 by M1.3 from objects, to keep the files small): `[year,
market value]` pairs, newest year first.

**`li`**: `open_violations`, `last_violation` (the latest of any status), `unsafe`,
`imminently_dangerous`, `violations` (every violation since 2016), and when present `unsafe_since`,
`imminently_dangerous_since`, `sealed` (the last completed clean and seal) and `demolished` (the
last completed demolition). L&I case numbers are never published.

**`partial`** (added 2026-10-04, docs/VERIFICATION.md D9; only when not empty): the parts this
dossier was not built from, in this order: `transfers`, `assessments`, `li`. Deeds, assessments and
L&I violations are downloaded only for the candidate parcels, so a parcel the vacancy model shows
outside them (or any parcel, while one of those sources has no snapshot) has no such records in the
weekly copy. A part named here is `null` (`transfers`, `assessments`) or has `open_violations`,
`last_violation` and `violations` `null` (`li`; its unsafe, imminently dangerous, clean and seal and
demolition entries come from citywide lists and stay), and `years_since_sale` is left out unless
OPA's own last sale gives it. The lot page then says these records are not in the weekly copy and
offers live City data, never "No deeds on record." or zero violations. A parcel that is no longer a
candidate but has records in the snapshot is not partial.

**`routes`**: registry route ids in the order to try them (docs/ROUTES.md; rules in
`derive/routes.py`). A lot listed as available (`city_owned.available`) that may go to the neighbor
as a side yard (`side_yard_eligible`) lists `land_bank_side_yard` first, after Community LandCare
where PHS cares for it, whichever of the four agencies owns it (added 2026-10-08, issue #36). Conservatorship appears only for a private parcel we call vacant with high or
medium confidence: a parcel we are not sure about may be someone's home. It never appears for a
parcel with a homestead exemption (OPA's `homestead_exemption` above 0), at any confidence: the
City's own record that someone lives there, or did (added 2026-10-04, docs/VERIFICATION.md D1).
**`suggestions`**: registry suggestion ids (a vacant lot gets `clean_and_green`, a vacant building
`seal_abandoned_building`; from M3.1 a vacant lot may also get `plant_shade_trees` and
`cool_green_lot`, exactly as its `sg` in the lots layer, section 4).

**Also, when they apply**: `landcare` (`program`: `landcare`, `community_landcare`, `land_bank`,
`phdc` or `other`, and `year` joined when known) for a lot PHS LandCare maintains; `garden: true`
when a garden that PHS, the Neighborhood Gardens Trust or Parks and Recreation knows lies on the
parcel, or the Planning Commission maps community agriculture there.

**`lens`** (added 2026-10-05, issue #31; only for a parcel on the map): every lens factor (`f_*`)
and the floodplain mark (`fp`) its feature in the `parcels` layer carries (section 4), with the same
keys and values, copied from that layer as publish writes it, so a factor the layer gains is carried
too. A lot page opened from a link, a search or a saved list, before the map has the parcel's
tile, shows the score breakdown and the flood note from here; when it has the tile, the tile's
values win. On 2026-10-05: 58,325 parcels, 6.3 MB more on disk (5 percent) and 0.5 MB more as
served compressed (3 percent). From M3.3 it holds the walking factors `f_walk`, `f_neighbors` and
`f_dest` too, which the lots layer gained (2.4 MB more on disk, 0.3 MB compressed).

**`displacement`** (added 2026-10-08 by M4.1; only for a parcel on the map inside a displacement
watch area): `tract`, the 11 digit census tract, and `signs`, the area's signs, exactly the parcel's
`dw` in the lots layer (section 4), so a lot page opened from a link, a search or a saved list shows
the full greening card as one opened from the map does.

**`nearby`**: `s12` and `s36` (shooting victims in the parcel's hexagon in the last 12 and 36
months, as in the `h3` layer), `landcare_within_500ft` and `gardens_within_500ft`. Keys are left
out when the parcel has no point.

Never in a dossier (docs/ETHICS.md, checked by `tests/test_dossiers.py`): an acquisition price
estimate, any score or order of how easy a parcel would be to take, letters to owners, and personal
details beyond the names of owners past and present and the current mailing address. Seller and
buyer names on deeds (`from` and `to` in `transfers`) are published: they are owners of record over
time, as the City shows them (decided 2026-10-04, docs/VERIFICATION.md D4).

The live refresh in the browser may update `owner`, `transfers`, `assessments` and `li` from the
City's Carto API; anything it cannot refresh stays as in the shard, labeled with the shard's date.

How the web app does it (added 2026-10-04 by M1.6, `web/src/dossier/`). Each part is one request to
`https://phl.carto.com/api/v2/sql`, built only from the nine digit account (or, to find the parcel
under a tap, a point inside the city), never from typed text, with a 10 second limit:
`opa_properties_public` for the owner names, mailing address, the City's description and whether
the owner has a homestead exemption (with one, the page drops conservatorship from the shard's
routes);
`rtt_summary` for every deed with the same fields as `transfers` (the date on the deed and the
adjusted total, with the same fallbacks); `assessments`; and one query over `violations`, `permits`, `demolitions`, `unsafe`,
`imm_dang` and `clean_seal` for the L&I timeline, with the same expressions as the history shards'
`li` (above), grouped the same way. A part that answers replaces the shard's part
and is labeled live; one that fails or times out keeps the shard's, labeled with its date and the
reason. The flags that depend on a live part are worked out again in the browser with the
pipeline's rules (`absentee` and `possible_estate` from the owner, `sheriff_sales`,
`years_since_sale` and `fast_resales` from the deeds, `open_violations`, `unsafe` and
`imminently_dangerous` from L&I), giving exactly the pipeline's sentences:
`pipeline/tests/fixtures/wording_parity.json`, written by `pipeline/tests/wording_cases.py`, holds
cases with the pipeline's answers, and the pipeline's and the web app's tests both check it.
`tax_debt_2025` and `many_parcels` stay as in the shard. Every flag is then held back by the
pipeline's rule above (`ownerFlagAllowed` in `web/src/dossier/flags.ts`, checked against the same
parity cases), with the vacancy call from the shard (or the map, for a parcel without a dossier)
and the homestead exemption from the live record; the page then says why notes about the owner are
not shown, and never that there is no tax debt. When the
City names different owners than the shard, the flags about the earlier owner are left out. A
parcel with no dossier (its prefix is not in the manifest's `dossiers.prefixes`, or it is not in
its shard) gets a page built only from these lookups, plus counts within 500 feet of its point
(`shootings` in the last 12 and 36 months, and people killed in `fatal_crashes` since 2019). Text
from City records is shown as published, except that a dash used as punctuation becomes a comma.

### History shards (`dossiers/history/<prefix>.json`)

Added 2026-10-09 by M4.2 (issue #38; `pipeline/src/placekeepers/publish/history.py`). What the lot
timeline needs beyond the dossier shard, in one file beside each shard, with the same prefix, so a
lot page fetches it only when its History part opens (or is printed) and opening a lot stays fast
on a phone. Every dossier prefix has one, even when none of its parcels has a record. On
2026-10-09: 933 files, 57.5 MB on disk, 7.1 MB as served compressed; the largest (`8715.json`)
807 kB, 115 kB compressed; the median 34 kB.

```json
{
  "schema": 1,
  "generated_at": "2026-10-09T19:40:00Z",
  "parts": ["li"],
  "parcels": {
    "371000001": {
      "li": {
        "violation": [["2025-08-01", "EXTERIOR AREA WEEDS", "OPEN"],
                      ["2023-05-05", "RUBBISH & GARBAGE", "COMPLIED", null, 2]],
        "permit": [["2012-08-01", "NEWCON", "COMPLETED", "ZONING/USE PERMIT"]],
        "demolition": [["2011-06-14", "CASE", "COMPLETED", "YES"]]
      },
      "lists": [["2026-10-04", "city_land"], ["2024-06-24", "june_2024_land"]]
    },
    "372000006": {"partial": ["li"]}
  }
}
```

**`li`**: the parcel's L&I records by kind, in this order, each kind left out when it has none:
`violation`, `permit`, `demolition`, `unsafe`, `imminently_dangerous`, `clean_seal`. Each record
is `[day, title, status, detail, count]`: the day in Philadelphia (YYYY-MM-DD, or `null`), the
City's title (the violation's title, the permit's kind of work, the demolition's kind of work, the
notice's title, the work order's type), its status as the City writes it (for the notices, `OPEN`
or `RESOLVED` by whether L&I recorded a resolution), the detail (the permit type such as
`Residential Building Permit`; for a demolition `YES` when the City did it, `NO` under a private
permit; `null` for the others), and how many records read the same, only when above 1. Trailing
`null` values and a count of 1 are left off. Text is trimmed with runs of white space as one space,
and empty text is `null`; a record with neither a day nor a title is left out; each kind is newest
first, undated last, then by title, status and detail in code point order. The records come from
`li_history` (`adapters/li.py`, `HISTORY_PARTS`), which reads each table with exactly the
expressions the web app's live query uses (`web/src/dossier/carto.ts`, `LI_PARTS`); the pipeline
groups them with `derive/timeline.py` and the browser groups a live answer the same way
(`web/src/dossier/timeline.ts`, `groupLi`). Both test suites check
`pipeline/tests/fixtures/timeline_parity.json`, written by `pipeline/tests/timeline_cases.py`.
Never a case, permit or violation number, an inspector, an applicant, a contractor or a
complainant.

**`lists`**: `[day, list]` for each vacancy list the parcel is on, its latest day, newest first:
`city_land` and `city_building` (the City's vacant property indicators, dated by the records'
`date_update`), `june_2024_land` (L&I's vacant land list of 2024-06-24, as Clean & Green Philly
kept it, source `cagp_vacant_land_2024`) and `june_2024_building` (Clean & Green Philly's own
vacant buildings list of the same day, source `cagp_vacant_buildings_2024`).

**`partial`**: `["li"]` for a dossier parcel whose L&I records were not downloaded (outside the
candidate parcels, as in section 6's `partial`); the lot page then says the weekly copy does not
include them and offers live data, never "no violations". A parcel the file does not name has no
records: no L&I records when `parts` holds `"li"`, else none known.

Deeds stay in the dossier shard (`transfers`) and the LandCare year in its `landcare`; the lot
page puts them in the timeline itself. With live data on, the page uses the City's answer for the
L&I records (it asks for up to 1,000; when the City cuts an answer short, the copy's records from
its oldest day back complete it) and keeps the copy's `lists`.

### `tables/owners.json`

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "min_parcels": 5,
  "owners": {
    "03ccd2b2a56c": {
      "names": ["KENSINGTON LOTS LLC"],
      "parcels": [{"id": "372000001", "address": "2902 N 5TH ST", "kind": "lot", "confidence": "high"}]
    }
  }
}
```

Every organization (a company or a nonprofit) holding at least `min_parcels` parcels we call vacant
with high or medium confidence, keyed by the `list` id of its `many_parcels` flag, with each parcel's
OPA account, address and vacancy `kind` and `confidence`, so "this owner's list" shows without
opening any shard. An owner who may be a person (typed `individual` or `unknown`, or whose names
carry an estate) is never in this file, so no citywide file lists people's holdings: each of their
parcels' `many_parcels` flag carries their other parcels in `data.parcels`, and the lot page lists
them from there (changed 2026-10-04, docs/VERIFICATION.md D3). Owners
are matched conservatively: two parcels share an owner only when all their owner names match after
spelling is evened out (capitals, no punctuation, "L.L.C." as LLC, "&" as AND), so one owner under
two spellings counts twice and two owners are never merged. Public owners are left out: the City
lists its own holdings. On 2026-10-04: 366 organizations, 374 kB (57 kB compressed), one file; the
95 owners who may be people that hold five or more are listed on their own 819 parcels instead.

## 7. Route survey sheets (`tables/routes/`)

Added 2026-10-05 by M2.4 (the survey campaign kit). For every SEPTA bus and trolley route with a
stop in Philadelphia, each direction's stops in Philadelphia in SEPTA's own order, each with the id
of the OpenStreetMap stop at the same pole. The web page `survey/` joins what OpenStreetMap shows
there from `tables/stop_amenities.json` (section 8) by that id, and turns a route's file into a
printable survey sheet. Subway, El and Regional Rail lines have no sheet. Written by
`pipeline/src/placekeepers/publish/route_sheets.py` as compact JSON.

Changed 2026-10-05 (decision D1 of VERIFICATION_V0_2.md): the files hold SEPTA's stops and their
order and the OpenStreetMap ids, never what OpenStreetMap says at a stop (`c`, the answers, and the
index's counts by `c` were removed), so OpenStreetMap's answers are never stored in the same records
as SEPTA's data. Each file and the index carry a `credit` and a `license` line for SEPTA (finding
F7).

### Where the order comes from

SEPTA's bus and Metro schedules carry two files that are not standard GTFS: `route_stops.txt`
(`route_id`, `direction_id`, `stop_id`, `route_stop_sort_order`: every stop of a route in order, for
each direction) and `directions.txt` (`route_id`, `direction_id`, `direction` such as "Southbound",
`direction_destination` such as "Whitman Plaza"). The `septa_gtfs` snapshot keeps them on its route
rows as `stop_order` (added by M2.4): a list of directions, each with `direction_id`, `direction`,
`destination` and `stop_ids` in SEPTA's order (`pipeline/src/placekeepers/derive/route_stops.py`).
The order leaves out stops no trip of that route and direction serves in the feed (126 of SEPTA's
21,050 entries on 2026-10-05) and cannot place a stop SEPTA's list leaves out (33 that day); the
build notes count both. Without `route_stops.txt` no route has an order, and the build publishes no
sheets and says so.

### `tables/routes/<route id>.json`

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "as_of": {"schedules": "v202609270", "osm": "2026-10-03"},
  "credit": "Stops and their order: SEPTA. Each osm id links to tables/stop_amenities.json.",
  "license": "SEPTA open data license agreement (free to use, reproduce and redistribute; no commercial use of SEPTA's trademarks), https://wwww.septa.org/license-agreement/",
  "id": "47",
  "r": "47",
  "nm": "Whitman Plaza to 5th-Godfrey",
  "md": 1,
  "directions": [
    {
      "d": 1,
      "dir": "Northbound",
      "to": "5th-Godfrey",
      "m": 15514,
      "out": 0,
      "stops": [
        {"k": "sp24973", "sid": "24973", "nm": "Whitman Plaza, 2", "lat": 39.91373, "lng": -75.155728, "osm": "n8878395954"},
        {"k": "sp16496", "sid": "16496", "nm": "Oregon Av & 5th St", "lat": 39.915035, "lng": -75.156573}
      ]
    }
  ]
}
```

(Shortened: route 47 has two directions, of 102 and 99 stops.)

| Field | Meaning |
|---|---|
| `as_of` | `schedules`: SEPTA's `feed_version`; `osm`: the day of the OpenStreetMap extract the ids come from. Either is `null` when missing |
| `credit`, `license` | the credit line and SEPTA's license, with its address (from `registry/licenses.yaml`) |
| `id`, `r`, `nm`, `md` | SEPTA's route id, short name, long name (dashes used as punctuation turned into commas) and mode bits, as in the `routes` layer (section 4) |
| `d` | SEPTA's `direction_id` |
| `dir`, `to` | SEPTA's name for the direction and its destination; each only when SEPTA gives it |
| `m` | meters from the first stop to the last, in straight lines from stop to stop (UTM zone 18 north) |
| `out` | how many stops of this direction lie outside Philadelphia and are left off the sheet |
| `stops` | the stops in Philadelphia in SEPTA's order. A direction with none is left out, and a route with no direction has no file |
| `k`, `sid`, `nm`, `lat`, `lng` | the stop's Placekeepers key, SEPTA's stop number, its name with the side of the street in words (as in `stops`, section 4) and SEPTA's position |
| `osm` | the OpenStreetMap stop at the same pole, such as `n8878395954`, its key in `tables/stop_amenities.json` (section 8), where the page reads what it shows (`c`) and its answers for a shelter, a bench, a waste basket and a light; absent when no OpenStreetMap stop matches |

"In Philadelphia" is SEPTA's own rule for its stops layer: inside the City Council districts widened by
100 meters. Every stop of a route's order is kept, the ends of the line too, although a trip's last
stop is not a departure in the `stops` layer.

**Which OpenStreetMap stop is which SEPTA stop.** First by number: an OpenStreetMap stop whose `ref`
or `gtfs:stop_id` names a SEPTA stop (its `sid` or a number it had before), when the two stand within
15 meters and no other SEPTA stop stands more than 3 meters closer to the OpenStreetMap stop. Then by
distance alone, the closest pairs first, within 15 meters, each OpenStreetMap stop only with its
nearest SEPTA stop: when that one is taken it stays unpaired. Each stop pairs once. A number farther
away is not believed: on Frankford Avenue some stops carry the number of the stop across the street
while standing within a few meters of another SEPTA stop, and at Huntingdon Street that stop across
the street is only 12 meters away (the two rules after "and" were added 2026-10-05 by the v0.2
review, docs/VERIFICATION_V0_2.md). On 2026-10-05 this paired 654 of the 829 OpenStreetMap stops in
the city with a SEPTA stop; most of the rest stand 15 to 30 meters from the nearest one. Where an
OpenStreetMap stop's number agrees with the SEPTA stop it is paired with (180 pairs that day), that
stop is also its nearest SEPTA stop 179 times. A stop with no `osm` may still be in OpenStreetMap a few steps away, so the sheet says "not found
in OpenStreetMap", never "missing".

### `tables/routes/index.json`

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "as_of": {"schedules": "v202609270", "osm": "2026-10-03"},
  "credit": "Stops and their order: SEPTA. Each osm id links to tables/stop_amenities.json.",
  "license": "SEPTA open data license agreement (...), https://wwww.septa.org/license-agreement/",
  "routes": [
    {
      "id": "47", "r": "47", "nm": "Whitman Plaza to 5th-Godfrey", "md": 1,
      "file": "tables/routes/47.json",
      "dirs": [
        {"d": 0, "dir": "Southbound", "to": "Whitman Plaza", "n": 102},
        {"d": 1, "dir": "Northbound", "to": "5th-Godfrey", "n": 99}
      ]
    }
  ]
}
```

Every route with a file, in SEPTA's order of routes: its id, names and mode, its file, and each
direction with `n` stops on the sheet (the counts by what OpenStreetMap shows, `s`, were removed by
decision D1; the page counts them after the join). The route files are not in the manifest's
`files` (section 3); the index is. On
2026-10-05: 123 routes (117 bus, 6 trolley), 237 directions with a median of 55 stops, files of
0.4 to 28 kB (median 11 kB, about 2 kB compressed), 1.4 MB in all; the index is 31 kB (6 kB
compressed).

The page's time estimate is the site's own, not data: walking about 80 meters a minute (3 miles an
hour) along `m`, plus a minute at each stop, rounded to 5 minutes.

## 8. What OpenStreetMap says at each stop (`tables/stop_amenities.json`)

Added 2026-10-05 (decision D1 of VERIFICATION_V0_2.md). What OpenStreetMap says at every bus and
trolley stop it knows in and around the city (the stops of `osm_philadelphia`, the 200 meter band
around the city included, since a SEPTA stop on the city line can stand on one just outside it),
keyed by the stop's OpenStreetMap id. It is OpenStreetMap's data alone, under the Open Database
License, credited "© OpenStreetMap contributors", like `tiles/amenities.pmtiles`. SEPTA's stops on
the map (`o`, section 4) and on the route survey sheets (`osm`, section 7) link to it by that id, and
the web app joins the two in the visitor's browser (`web/src/transit/answers.ts`), so OpenStreetMap's
answers are never stored in the same published records as SEPTA's data. Written by
`pipeline/src/placekeepers/publish/stop_table.py` as compact JSON; listed in the manifest's `files`.

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "as_of": {"osm": "2026-10-03"},
  "credit": "© OpenStreetMap contributors",
  "license": "Open Database License 1.0, https://opendatacommons.org/licenses/odbl/1-0/",
  "stops": {
    "n8878395954": {"c": 3, "sh": 1, "n": ["24973"]},
    "n13315617154": {"c": 1, "sh": 0, "bn": 0, "lt": 1, "n": ["24150"]}
  }
}
```

| Field | Meaning |
|---|---|
| `as_of` | `osm`: the day of the OpenStreetMap extract; `null` when unknown |
| `credit`, `license` | OpenStreetMap's credit line and the Open Database License, with its address |
| `stops` | one entry per OpenStreetMap stop, keyed by its id as in amenities.pmtiles (`n` or `w` and the element id) |
| `c` | what the map shows, with the codes of the shelters and benches layer: 3 a shelter or roof, 2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed |
| `sh`, `bn`, `bi`, `lt`, `cv` | the stop's answers for a shelter, a bench, a waste basket, a light and a roof over the whole stop, 1 yes and 0 no, as in amenities.pmtiles; absent when unknown |
| `n` | the SEPTA stop numbers its `ref` and `gtfs:stop_id` name, in that order; absent when none. The browser compares them with a SEPTA stop's `sid` and `fid` to say whether the numbers agree |

Without the `osm_philadelphia` snapshot the file is not written, and the build notes say every stop
shows as not yet surveyed. When the browser cannot load it, a stop's page says so rather than showing
its answers, and the map counts every shelter and bench halfway.


## 9. The Land Bank in numbers (`tables/land_bank.json`)

Added 2026-10-09 by M4.4 (issue #40). The numbers of the page "The Land Bank in numbers"
(`web/land-bank/`): what the Philadelphia Land Bank and the City's other land agencies conveyed,
from the City's deed records (`land_conveyances`), the City's own counts by program
(`land_conveyed_by_fy`), and the weekly count of lots on the City's list of public property listed
as available (`city_owned_property`). **Aggregates only**: counts, shares and medians. The file holds
no name, no address and no parcel number (docs/ETHICS.md; `pipeline/tests/test_land_bank.py`
checks it). Written by `pipeline/src/placekeepers/publish/land_bank.py` as compact JSON (about 22
kB on 2026-10-09); listed in the manifest's `files`. The rules are in
`pipeline/src/placekeepers/derive/land_bank.py` and docs/DATA_SOURCES.md.

```json
{
  "schema": 1,
  "generated": "2026-10-09",
  "deeds": {"first": "2014-01-02", "last": "2026-08-10", "fetched": "2026-10-09",
            "years": [2014, 2015, 2026], "partial_year": 2026, "nominal_max": 100,
            "counted": 3235, "follow_ups": 3013, "moved": 5403, "agreements": 6914, "other": 2859},
  "agencies": {
    "all": {
      "years": [{"year": 2014, "n": 312, "deeds": 120, "moved_out": 318, "moved_in": 318,
                 "buyers": {"individual": 159, "company": 86, "nonprofit": 17, "public": 50, "unknown": 0},
                 "programs": {"side_yard": 49, "other": 263},
                 "price": {"median": 5734, "priced": 276, "nominal": 88, "none": 36}}],
      "total": {"n": 3235, "deeds": 1569, "moved_out": 5403, "moved_in": 5403, "buyers": {}, "programs": {}, "price": {}},
      "districts": [{"district": 1, "n": 424, "years": [30, 25]}, {"district": null, "n": 285, "years": [9, 7]}]
    },
    "PLB": {}, "PRA": {}, "PHDC": {}, "PUB": {}
  },
  "programs_fy": {"edited": "2023-04-11",
                  "rows": [{"fy": 2023, "side_yards": 12, "gardens": 0, "business": 4,
                            "homes_below_30": 51, "homes_60_80": 239, "homes_80_120": 33,
                            "homes_market": 73, "inferred_plb": 9, "inferred_all": 13}]},
  "listed": {"weeks": [{"date": "2026-10-04", "listed": 1687, "parcels": 1639, "side_yard": 1291,
                        "by_agency": {"PLB": 441, "PRA": 161, "PHDC": 9, "PUB": 1076},
                        "by_status": {"Owned - On Hold for AHD": 1934, "Owned - Available": 1654}}]}
}
```

| Field | Meaning |
|---|---|
| `deeds.first`, `deeds.last` | the oldest and newest deed date among the deeds read (days in Philadelphia) |
| `deeds.fetched` | the day the deed records were read |
| `deeds.years` | every calendar year from 2014 to the newest deed's year; every `years` list below has one entry per year, in this order |
| `deeds.partial_year` | the newest year when it is not complete (the records run about eight weeks behind), else `null` |
| `deeds.nominal_max` | a token price: this many dollars or less ($100, as on the lot pages) |
| `deeds.counted` | properties counted as conveyed (one row per property per deed) |
| `deeds.follow_ups` | conveyance rows not counted again: corrections and releases (the property was already in private hands, or already conveyed to the same buyer or within a year), and miscellaneous deeds for property the records never show an agency holding |
| `deeds.moved`, `deeds.agreements`, `deeds.other` | rows left out: moves between the four agencies, agreements recorded as deeds (the same parties on both sides, or an agency on both sides), and other documents |
| `agencies` | `all` (the four together) and each agency by the City owned layer's codes: `PLB` the Land Bank, `PRA` the Redevelopment Authority, `PHDC`, `PUB` the City |
| `n` | properties conveyed |
| `deeds` | distinct deeds among them |
| `moved_out`, `moved_in` | properties this agency handed to, or received from, another of the four (for `all`, every move, the same number in both) |
| `buyers` | properties by the buyers' type, by the owner rule of the lot pages: `individual` (people), `company`, `nonprofit` (named as one), `public` (another public body, such as the Philadelphia Housing Authority), `unknown` |
| `programs` | `side_yard`: one lot to a person who owns a parcel touching it (front, side or rear), by the City's owner list and parcel shapes on the day of the download, **our inference**; `other`: not known from the deed |
| `price` | the price the deed records for this property (the adjusted total, else the total): `median` (whole dollars, `null` when none), `priced` (properties with a price), `nominal` (priced at `nominal_max` or less), `none` (no price recorded) |
| `districts` | properties by today's council district (1 to 10, from the deed's point), then `null` for deeds with no location; `years` per year as in `deeds.years` |
| `programs_fy` | the City's Land Management dashboard: `edited` (its last edit), and per fiscal year (July to June, named for the year it ends) side yards, gardens or open space and business expansion in properties, homes built by income level, and our inferred side yards in the same fiscal year from the Land Bank (`inferred_plb`) and from all four (`inferred_all`); `null` when the source is missing |
| `listed.weeks` | one entry per day the City's list was fetched (the last snapshot of that day), oldest first: records listed as available (a status beginning "Owned - Available"), distinct parcels among them, those open to a neighbor as a side yard, the listed records by agency, and every record by status as the City writes it; `listed` is `null` before any snapshot was counted |

The weekly counts come from `history.json` in the `city_owned_property` snapshot folder of the
cache (`{"schema": 1, "snapshots": [{"snapshot", "date", "records", "listed", "parcels",
"side_yard", "by_agency", "by_status"}]}`), which gains a line when a new good snapshot of the list
becomes current (the adapter's `after_promote`), or at publish for a snapshot it lacks. The weekly
refresh packs the file with the snapshot (`.github/scripts/refresh.py`, `HISTORY_FILE`), so the
series survives from week to week; if the saved snapshots are ever lost, it starts again.

Without the `land_conveyances` snapshot the file is not written and the build notes say so; the page
then says the numbers are not published yet.
