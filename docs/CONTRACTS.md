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
    # arcgis: service: <name>, layer: 0
    # url: url: <https link>, format: csv | geojson | parquet | zip
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

`registry/groups.yaml` lists groups in display order: `lots`, `care`, `streets`, `safety_context`,
`boundaries`, `basemap`, each with a label and a one line description.

### `registry/lenses.yaml`

```yaml
- id: violence
  label: Violence reduction
  applies_to: parcel                  # parcel | segment | stop | cell
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

### `registry/routes.yaml` and `registry/partners.yaml`

Routes carry `id`, `label`, `who`, `steps` (list), `cost`, `timeline`, `links` (label and url),
`last_checked` (date), and `status` (`verified` or `confirm`). Partners carry `id`, `name`, `url`,
and `one_line`. Content comes from ROUTES.md.

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
  tables/
    parcels.json          compact columnar table for ranking and lists
  dossiers/
    <first three digits of the OPA account>.json
  basemap/
    philly.pmtiles        Protomaps basemap extract
```

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
  "notes": ["8 shooting victims in the last 36 months have no usable location"]
}
```

`status` is one of `ok`, `stale` (using the last good snapshot), `failing` (no usable snapshot), or
`missing` (never fetched). `stale_since` is the date of the last good snapshot when stale.
`sources` lists every source in the registry and `layers` every layer, whether or not it was built.
`files` lists exactly the files present under the data root (except `manifest.json` itself), so a
layer is available only when `files` lists its `file`.

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
| `f_*` | int | lens factor percentiles, 0 to 100 |
| `sg` | string | suggestion ids, comma separated |

**`h3` (context.pmtiles)**: `h` (cell id), `s12` and `s36` (shooting victim counts), `f_*` (factor
percentiles for cell level factors such as `f_poverty`).

**`hin` (streets.pmtiles)**: `id`, `name` (street name), `len` (feet).

**`crashes` (streets.pmtiles)**: `id` (crash record number), `y` (year), `sev` (3 fatal, 2 serious
injury, 1 other injury, 0 no injury), `m` (bit flags: 1 pedestrian, 2 bicycle, 4 motorcycle, 8
scooter).

**`memorials` (streets.pmtiles)**: `id`, `d` (date), `m` (mode), `nm` (name, only when curated from a
public memorial list and not suppressed), `src` (source url).

## 5. Dossier shards (`dossiers/<prefix>.json`)

```json
{
  "schema": 1,
  "generated_at": "2026-10-05T10:03:12Z",
  "parcels": {
    "123456789": {
      "address": "1234 N EXAMPLE ST",
      "vacancy": {"kind": "lot", "confidence": "high", "reasons": ["City lists it as vacant land", "No building on the parcel"]},
      "owner": {"names": ["..."], "mailing": "...", "type": "individual", "flags": [{"id": "absentee", "text": "..."}]},
      "transfers": [{"date": "2004-05-17", "type": "DEED", "price": 1500, "from": ["..."], "to": ["..."]}],
      "assessments": [{"year": 2027, "market_value": 21000}],
      "li": {"open_violations": 2, "last_violation": "2025-08-01", "unsafe": false, "imminently_dangerous": false},
      "routes": ["land_bank_garden_agreement"],
      "suggestions": ["clean_and_green"],
      "nearby": {"s12": 3, "s36": 9, "landcare_within_500ft": 4}
    }
  }
}
```

The live refresh in the browser may update `owner`, `transfers`, `assessments` and `li` from the
City's Carto API; anything it cannot refresh stays as in the shard, labeled with the shard's date.
