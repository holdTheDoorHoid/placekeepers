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
    kind: carto                       # carto | arcgis | url | osm_extract | curated
    table: shootings                  # carto: table (and optional where)
    # arcgis: service: <name>, layer: 0 (and optional url, see below)
    # url: url: <https link>, format: csv | geojson | parquet | zip
    # osm_extract: url: <https link to an .osm.pbf file>, tags: [key=value or key, ...]
    # curated: path: data/curated/<file>.yaml
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

An `arcgis` endpoint names a service in the City's ArcGIS Online organization
(`https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services`). For a service in another
organization it adds `url`, the REST services root ending in `/rest/services` (added 2026-10-04 by
M1.1), for example `url: https://services2.arcgis.com/qjOOiLCYeUtwT7x7/arcgis/rest/services` for the
gardens PHS and the Neighborhood Gardens Trust support. A `csv` file may use another delimiter (the
Census Bureau's tables use `|`); the source's adapter reads it.

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
without new code; new tags arrive with the next weekly download. An `osm_extract` with neither key
is the base map, made by the site and never fetched (section 2); one key without the other is an
error.

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
instead (added 2026-10-05 by M3.1): the lots layer's `lens` setting ("Color lots by", `violence` or
`heat`, default `violence`) names the lens that colors the lots, and using a lens sets it to that
lens's id. Its options must name every lens that applies to `parcel` and nothing else (a web test
checks it).

`registry/groups.yaml` lists groups in display order: `lots`, `care`, `streets`, `transit` (added
2026-10-04 by M2.1 for SEPTA's layers; M2.2 adds the shelters and benches at stops to it), `heat`
(added 2026-10-05 by M3.1 for heat vulnerability, the City's trees and the floodplain), `amenities`,
`public_places` and `conditions` (added 2026-10-05 by M3.5),
`safety_context`, `boundaries`, `basemap`, each with a label and a one line
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
computed once.

One exception to leaving missing data out (added 2026-10-05 by M2.3, the transit comfort lens): a
stop's shelter or bench that no one has surveyed yet is not missing but 50, halfway between having
one (0) and not (100), in `f_noshelter` and `f_nobench`. Leaving it out would let a stop known only
for its heat and its street top the ranking; counting it as missing would score the stop as if it
had nothing. The web app knows such a value from the stop's own answers (`sh` or `bn` absent, and
for the shelter `cv` not 1), never calls it the main reason, and marks it "not yet surveyed" in the
"why" breakdown.

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

`applies_to: stop` (added 2026-10-05 by M2.3) marks suggestions for SEPTA's bus and trolley stops;
they are carried by `stops` in transit.pmtiles in `sg`, in the order the stop lists them. None needs
a landowner's permission, so the first step is always the first step of the suggestion's first
route.

Greening suggestions (`clean_and_green` in this release, listed in
`web/src/config/suggestions.ts`; added 2026-10-04 by M1.10, decision D12 of VERIFICATION.md) are
shown with the caution of docs/ETHICS.md, "Greening can raise nearby prices. Consider pairing it
with protections.", until the displacement watch overlay exists; the web app adds it wherever the
suggestion is listed and in downloads. No registry key changes.

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
    transit.pmtiles       layers "stops", "routes"   (SEPTA, added 2026-10-04 by M2.1; the transit comfort lens on "stops", M2.3)
    amenities.pmtiles     layers "stops" (shelters and benches at stops, M2.2), "benches",
                          "picnic_tables", "water", "toilets", "bookcases" (M3.5): from OpenStreetMap
    places.pmtiles        layers "park_water", "libraries", "recreation", "pools" (the City's; M3.5)
    conditions.pmtiles    layers "dumping", "lights", "graffiti" (311 requests by block; M3.5)
    environment.pmtiles   layers "heat_tracts", "floodplain"   (heat vulnerability and FEMA's floodplain; M3.1)
    trees.pmtiles         layer "trees"     (the City's street and park trees, zoom 14 only; M3.1)
  tables/
    parcels.json          compact columnar table for ranking and lists
    owners.json           organizations holding many vacant parcels, with their parcels (section 6)
    routes/               route survey sheets (section 7; added 2026-10-05 by M2.4)
      index.json          every SEPTA bus and trolley route with a sheet
      <route id>.json     one route's stops in order, each direction, with what OpenStreetMap shows
  dossiers/
    <first four digits of the OPA account>.json
    common.json           the parts of every flag that are the same for all parcels (section 6)
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
  "dossiers": {"prefix_digits": 4, "prefixes": ["0011", "0012", "8850"], "files": 929, "bytes": 108300000},
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

`vacancy` (added 2026-10-04, decision D10 in VERIFICATION.md) holds the vacancy model's counts for
this build, so a page can quote the current numbers: `as_of` (the build date the model's time
windows counted from), `lots` and `buildings` (parcels by confidence, `high`, `medium` and `low`;
lots include the ones where a footprint stands), and `left_out` (parks, gardens, parking and similar
that never show). Every parcel counted is in the `parcels` layer except units inside a larger parcel
and the few with no shape and no point (the notes say how many of each). It is `null` when the
model has not run (the map then shows the City's lists alone).

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

`rt`, the first lawful step to get permission for the parcel (added 2026-10-04): the first route
the parcel's dossier lists (`placekeepers.derive.routes.routes_for`, from the same owner type, owner
names and LandCare record), so a lot's map value and its dossier always agree. Codes never change
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
Regional Rail carry none of them. `o`, `a`, `sh`, `bn`, `li` and `cv` come from OpenStreetMap, so
the layer lists `osm_philadelphia` among its sources and is credited "© OpenStreetMap contributors",
and those properties are under the Open Database License, as amenities.pmtiles is.

| Property | Type | Meaning |
|---|---|---|
| `o` | string | the OpenStreetMap stop matched to this one, as `id` in amenities.pmtiles (`n` or `w` and the element id); absent when none matched. The match is `match_septa` in `derive/bus_stops.py`, as for the route survey sheets (section 7): by stop number, then by distance, both only within 15 meters, closest pairs first, each stop once |
| `om` | int | 1 when the stop numbers agree (the OpenStreetMap stop's `ref` or `gtfs:stop_id` names `sid` or a number in `fid`), 2 when the two only stand at the same place |
| `a` | int | what riders find, the matched stop's `c` in amenities.pmtiles: 3 a shelter or roof, 2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed; absent when no OpenStreetMap stop matched (also not yet surveyed, never "missing") |
| `sh`, `bn`, `li`, `cv` | int | the matched stop's shelter, bench, lit and covered answers, 1 yes and 0 no; absent when unknown. Lit is `li` here because `lt` is the last departure |
| `f_riders` | int | lens factor: the share of bus and trolley stops with fewer weekday boardings (`b`); absent without a count |
| `f_noshelter` | int | 100 when a survey found no shelter, 0 with a shelter or the whole stop under a roof, 50 when not yet surveyed (section 1, lenses) |
| `f_nobench` | int | 100 when a survey found no bench, 0 with one, 50 when not yet surveyed |
| `f_shade` | int | the share of stops with more tree canopy (2018) on the land of their H3 cell (resolution 9, water left out); absent without canopy data |
| `f_heat` | int | the share of stops whose census tract has a lower heat exposure score (`heat_vulnerability`, `hei_score`); absent outside the tracts or without the data |
| `f_hin` | int | 100 when the stop stands within 30 meters of the High Injury Network, else 0 |
| `f_wait` | int | the share of stops with a shorter midday weekday wait (`hm`); absent without midday service |
| `cp` | int | percent of the land of the stop's H3 cell under tree canopy in 2018; absent without canopy data |
| `hin` | int | 1 when the stop is on the High Injury Network; absent otherwise |
| `sg` | string | suggestion ids, comma separated, in this order: `stop_survey` (shelter or bench not known yet), `stop_shelter_request` (a survey found no shelter, and the stop is not under a roof), `stop_bench_request` (a survey found no bench), `stop_streetlight_report` (OpenStreetMap says the stop is not lit), `stop_shade_trees` (`f_shade` of 75 or more); absent when none |

Every rank is among the bus and trolley stops on the map, as in section 1 (lenses). The build notes
carry the match counts, the surveyed counts and the count of each suggestion.

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
sheets (section 7, M2.4) and SEPTA's stops on the map (`o` and `om` there, M2.3) both join them
with `match_septa` in `pipeline/src/placekeepers/derive/bus_stops.py`, so a stop's sheet and its
details on the map always describe the same OpenStreetMap stop.

Added 2026-10-05 by M3.5, five more layers of `amenities.pmtiles`, one per OpenStreetMap tag, every
element inside the city limits with that tag that is not closed to the public (`access` no or
private) or disused, one point each (`pipeline/src/placekeepers/derive/amenities.py`). As for the
stops, an answer OpenStreetMap does not have is left out, never shown as no, and yes and no are
read as in `YES_NO` above. Every feature has `id` (the element, such as `n10554560825`) and `nm`
(its name, only when it has one); the other properties are each 1 yes and 0 no unless the table
says otherwise:

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

For M3.4 (placemaking suggestions): join these to street blocks by `id`, and to a lot through the
blocks it faces. A count says that people asked the City for help there, not how often the
condition occurs: some blocks ask more often than others, so no count or a low one is not a sign
of a clean block. Suggestions built on them must stay with physical conditions and the City's
own services (Philly311, the route `report_to_311` in `registry/routes.yaml`), never the police
(docs/ETHICS.md).

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
parcels. The parts of each flag that are the same for every parcel, and the notices, are in one
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
`PLB` the Land Bank, `PRA` the Redevelopment Authority, `PHDC`), `status` as the City writes it, and
`side_yard_eligible`; `flags`; `notice` (`"deed_fraud"`, on every dossier whose owner may be a
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
`derive/routes.py`). Conservatorship appears only for a private parcel we call vacant with high or
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
`imm_dang` and `clean_seal` for the L&I timeline. A part that answers replaces the shard's part
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
stop in Philadelphia, each direction's stops in Philadelphia in SEPTA's own order, each with what
OpenStreetMap shows there. The web page `survey/` turns a route's file into a printable survey
sheet. Subway, El and Regional Rail lines have no sheet. Written by
`pipeline/src/placekeepers/publish/route_sheets.py` as compact JSON.

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
        {"k": "sp24973", "sid": "24973", "nm": "Whitman Plaza, 2", "lat": 39.91373, "lng": -75.155728, "c": 3, "osm": "n8878395954", "sh": 1},
        {"k": "sp16496", "sid": "16496", "nm": "Oregon Av & 5th St", "lat": 39.915035, "lng": -75.156573}
      ]
    }
  ]
}
```

(Shortened: route 47 has two directions, of 102 and 99 stops.)

| Field | Meaning |
|---|---|
| `as_of` | `schedules`: SEPTA's `feed_version`; `osm`: the day of the OpenStreetMap extract. Either is `null` when missing |
| `id`, `r`, `nm`, `md` | SEPTA's route id, short name, long name (dashes used as punctuation turned into commas) and mode bits, as in the `routes` layer (section 4) |
| `d` | SEPTA's `direction_id` |
| `dir`, `to` | SEPTA's name for the direction and its destination; each only when SEPTA gives it |
| `m` | meters from the first stop to the last, in straight lines from stop to stop (UTM zone 18 north) |
| `out` | how many stops of this direction lie outside Philadelphia and are left off the sheet |
| `stops` | the stops in Philadelphia in SEPTA's order. A direction with none is left out, and a route with no direction has no file |
| `k`, `sid`, `nm`, `lat`, `lng` | the stop's Placekeepers key, SEPTA's stop number, its name with the side of the street in words (as in `stops`, section 4) and SEPTA's position |
| `c` | what OpenStreetMap shows, with the codes of the shelters and benches layer (`stops` in amenities.pmtiles, section 4): 3 a shelter or roof, 2 a bench but no shelter mapped, 1 neither, 0 not yet surveyed. Absent when no OpenStreetMap stop matches |
| `osm` | the matching OpenStreetMap element, such as `n8878395954`; only with `c` |
| `sh`, `bn`, `bi`, `lt` | that stop's answers for a shelter, a bench, a waste basket and a light, 1 yes and 0 no, as in amenities.pmtiles; absent when unknown |

"In Philadelphia" is SEPTA's own rule for its stops layer: inside the City Council districts widened by
100 meters. Every stop of a route's order is kept, the ends of the line too, although a trip's last
stop is not a departure in the `stops` layer.

**Which OpenStreetMap stop is which SEPTA stop.** First by number: an OpenStreetMap stop whose `ref`
or `gtfs:stop_id` names a SEPTA stop (its `sid` or a number it had before), when the two stand within
15 meters. Then by distance alone, the closest pairs first, within 15 meters. Each stop pairs once.
A number farther away is not believed: on Frankford Avenue some stops carry the number of the stop
across the street while standing within a few meters of another SEPTA stop. On 2026-10-05 this
paired 659 of the 829 OpenStreetMap stops in the city with a SEPTA stop; most of the rest stand 15
to 30 meters from the nearest one. Where an OpenStreetMap stop carries a SEPTA
number and stands within 15 meters of that stop, distance alone finds the same stop 178 times in
182. A stop with no `c` may still be in OpenStreetMap a few steps away, so the sheet says "not found
in OpenStreetMap", never "missing".

### `tables/routes/index.json`

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "as_of": {"schedules": "v202609270", "osm": "2026-10-03"},
  "routes": [
    {
      "id": "47", "r": "47", "nm": "Whitman Plaza to 5th-Godfrey", "md": 1,
      "file": "tables/routes/47.json",
      "dirs": [
        {"d": 0, "dir": "Southbound", "to": "Whitman Plaza", "n": 102},
        {"d": 1, "dir": "Northbound", "to": "5th-Godfrey", "n": 99}
      ],
      "s": {"0": 10, "1": 3, "3": 2, "none": 186}
    }
  ]
}
```

Every route with a file, in SEPTA's order of routes: its id, names and mode, its file, each direction
with `n` stops on the sheet, and `s`, the stops of all its directions by `c` (`none` for stops with
no match). The route files are not in the manifest's `files` (section 3); the index is. On
2026-10-05: 123 routes (117 bus, 6 trolley), 237 directions with a median of 55 stops, files of
0.4 to 28 kB (median 11 kB, about 4 kB compressed), 1.4 MB in all; the index is 31 kB (6 kB
compressed).

The page's time estimate is the site's own, not data: walking about 80 meters a minute (3 miles an
hour) along `m`, plus a minute at each stop, rounded to 5 minutes.

