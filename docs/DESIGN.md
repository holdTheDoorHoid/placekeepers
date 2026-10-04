# Placekeepers design

Founding design, written 2026-10-04 after the owner interview and five research reports. This
document is authoritative. The decisions in section 2 belong to the owner and are not reopened
without the owner. Everything else may be refined by whoever builds it, with the change recorded
here.

Companion documents:
[EVIDENCE.md](EVIDENCE.md) (what the research supports),
[ETHICS.md](ETHICS.md) (safeguards),
[DATA_SOURCES.md](DATA_SOURCES.md) (every source, its status and license),
[ROUTES.md](ROUTES.md) (legal routes and the intervention playbook),
[ROADMAP.md](ROADMAP.md) (phases and milestones),
[research/](research/) (the raw research reports).

## 1. What Placekeepers is

Placekeepers is a free public map that helps Philadelphia neighbors and organizers find places that
need care (vacant lots, abandoned buildings, dangerous streets, bus stops with nowhere to sit) and
the lawful way to improve them.

It revives and extends **Clean & Green Philly** (Code for Philly, 2023 to 2025, MIT license), which
ranked vacant lots for greening because research showed greening reduces gun violence. That project
shut down in July 2025 after the City stopped publishing accurate vacancy data in June 2024, and its
volunteers could not keep up. Its code, final data, and lessons are the starting point; its single
point of failure is the thing this design is built to avoid.

The name comes from *placekeeping*: improving a place for the people who already live there,
without pushing them out.

Placekeepers is **not** a crime map for choosing where to live, not a real estate deal finder, not a
policing tool, and not legal advice. The site says so on its About page and in its terms.

## 2. Founding decisions (owner interview, 2026-10-04)

| Topic | Decision |
|---|---|
| Name | **Placekeepers.** No Philadelphia organization uses it; the Philadelphia Assembly calls its members "culture bearers & placekeepers", a likely ally. |
| Audience | **Both** hands on neighbors (phones, the field view) and organizers (desktop, the analysis view), from the first release. |
| Permission | **Legal route first** on every suggestion. Unsanctioned methods are described honestly with their legal and safety risks, never hidden and never encouraged. |
| Owner data | **Everything we can compute**: owner, mailing address, sale history, taxes owed, violations, and derived flags such as absentee owner, years of tax debt, and possible estate. The safeguards in section 9 frame these flags toward protecting families and lawful routes; they do not remove them. |
| Victims | **Names where already public**: names appear only from public memorial lists, each with its source, in a dignified design, with a removal path for families. |
| Scoring | **Separate lenses** that anyone can blend with sliders. The violence lens uses only factors with evidence. |
| Upkeep | **Automated and low maintenance**: weekly refresh on GitHub with per source health checks. A broken source keeps its last good copy and shows "stale since". The owner plus Claude agents maintain it. |
| Stack | **Python** data pipeline and **TypeScript** map. Chosen over Rust because the geospatial tools are far stronger in Python and the original's MIT code can be reused. Do not relitigate. |
| Hosting | **Free to start**: GitHub Pages; Cloudflare R2 (free tier) when map files outgrow Pages, which needs the owner's own Cloudflare account. |
| First release | **Vacant lot finder with the lot dossier**, and **street safety with memorials**. |
| Later releases | Transit comfort; heat and shade; placemaking (art, walkability, density); history and displacement watch; organizing tools. |
| Contributions | Physical things go into **OpenStreetMap**, which we read weekly. Corrections go through a prefilled **GitHub issue**. Takedown requests go to a dedicated **email address**. No live moderation. |
| Toggles | **Everything is a setting**: every layer, lens factor, suggestion type and display behaviour can be switched or tuned. |
| This session | Write the plan, create the public repo, start building. |

Defaults chosen by the planner, which the owner may change: GPL-3.0 for code (the owner's usual
choice; the reused Clean & Green Philly files keep their MIT notice); ODbL for published data, which
is required wherever OpenStreetMap data is mixed in; CC BY-SA 4.0 for written guides; Sonnet agents
for research and docs, Opus agents for engineering.

## 3. Principles

1. **Care, not danger.** The map shows where care helps most. Violence appears as context for where
   investment pays off, aggregated by default, never as a ranking of dangerous people or places.
2. **Honest evidence.** Every score and suggestion carries an evidence badge from EVIDENCE.md. Factors
   without violence evidence never enter the violence lens.
3. **Legal route first.** Every suggestion leads with the lawful path, its cost, its timeline, and who
   can help.
4. **Everything is a setting.** One registry defines every layer, factor, suggestion and display
   option, and the settings panel is generated from it. Nothing reaches the map without a toggle.
5. **Never go dark.** A failing source keeps its last good copy, clearly labeled. No single source can
   take down the vacancy signal.
6. **Placekeeping.** Watch for displacement, say so on the map, and pair improvements with protections.
7. **Dignity.** People killed on our streets are named only from public memorial lists, never from
   scraping, and one email removes a name.
8. **Warn, don't block; design misuse out.** Risky facts appear with context that points toward
   protective, lawful uses.
9. **Plain words first.** Every screen leads with a sentence a neighbor understands. Detail is one tap
   away. All interface text lives in one strings file so translation (Spanish first) is possible.
10. **Low upkeep.** Static site, scheduled pipeline, no servers, no accounts, no paid services, no
    tracking.

## 4. Who uses it: two views on one map

Both views share one map, one set of settings, and one address bar state, so a link copied from either
view opens the same thing. The site picks the view by screen size; a switch is always visible.

**Field view (phones first).** For block captains, gardeners and neighbors standing on the block.
- A search box (address or intersection, using the City's address service) and a "Near me" button.
- The map with three primary chips: Lots, Streets, Memorials. "More layers" opens the full panel.
- A bottom sheet titled "What you can do nearby": the top places under the current lens blend. Each
  card says what the place is, one plain sentence on why it matters with its evidence badge, the
  best suggestion with cost, and the first legal step.
- Tapping a card opens the dossier (section 5.6).

**Analysis view (desktop first).** For organizers, researchers, journalists and council staff.
- Left panel: lens sliders with presets, filters (owner type, vacancy confidence, access route,
  council district, registered community organization, neighborhood, zoning), and every layer.
- Right panel: the selected place's dossier, or a summary of the area on screen.
- Bottom drawer: a ranked table of everything matching the filters, with CSV and GeoJSON export and a
  printable report.

**Both:** share link, print, data freshness badge, settings drawer, "how to use this responsibly".

## 5. What the map shows

### 5.1 Things on the map

| Thing | Identity | First release |
|---|---|---|
| Parcel (lot or building) | OPA account number; shape from the Water Department parcel layer | Yes |
| Street segment | City street centerline segment; High Injury Network membership | Yes |
| Crash | PennDOT crash record number (City hosted copy); Police fatal crash record | Yes |
| Memorial | Curated entry linked to a crash location and a public source | Yes |
| Area cell | H3 hexagon, resolution 9 (about two blocks across) | Yes |
| Bus stop | SEPTA stop id (expect churn during the New Bus Network rollout) | Later |
| Artwork | OpenStreetMap or Wikidata id, plus any licensed source | Later |

### 5.2 The registry: one source of truth for every toggle

`registry/` holds YAML files read by both the pipeline and the web app:

- `sources.yaml`: every data source with publisher, endpoint, license, attribution text, expected
  refresh cadence, and health rules.
- `layers.yaml`: every map layer with its label, plain description, group, style, legend, default
  visibility in each view, evidence badge, and its own settings (time window, aggregation, labels).
- `lenses.yaml`: every lens, its factors, default weights, and presets.
- `suggestions.yaml`: every suggestion type, its trigger rules, legal route, cost range, partners,
  and evidence badge.
- `routes.yaml`: legal routes (Land Bank garden license, side yard, conservatorship, and so on) with
  steps, costs, timelines, links, and the date each was last checked.

The settings panel, legends, layer list, and the "about this layer" popups are generated from the
registry. A pipeline check fails the build if a layer has no description, license, or source.

Settings persist in the address bar (shareable) and in browser storage under keys namespaced
`placekeepers:v1:` (the github.io origin is shared with the owner's other sites). "Reset to defaults"
is always available.

### 5.3 Lenses

A lens is a set of factors. Each factor is converted to a 0 to 100 citywide percentile so factors
can be compared. A lens score is the weighted average of its factors; users move the sliders and the
map recolors instantly (the weights are applied inside the map style, so no recomputation is
needed). Every score has a "why" breakdown showing each factor's contribution.

| Lens | Applies to | Factors (evidence) | Release |
|---|---|---|---|
| Violence reduction | Vacant parcels | Untreated vacant lot or open abandoned building (Strong); shootings within about a quarter mile in the last 12 and 36 months (the outcome the trials measured; frames where care helps most); neighborhood poverty rate (the trial effect was concentrated below the poverty line); not already maintained by LandCare (Strong); tree canopy deficit (Mixed, low default weight) | First |
| Street safety | Street segments and crash sites | On the High Injury Network; people killed or seriously injured walking or cycling in 5 years; any fatal crash in 2 years; school within 400 m; later, busy bus stop nearby | First |
| Heat and shade | Area cells, stops, lots | Heat vulnerability; canopy; impervious surface; people over 65 and under 5 | Later |
| Transit comfort | Bus stops | Daily boardings; no shelter; no bench; heat at the stop; crossing on the High Injury Network | Later |
| Placemaking | Lots and area cells | Walkability; people within a 5 minute walk; distance to a park; art nearby or absent; commercial corridor | Later |

**Displacement watch** is not a priority lens. It is a caution overlay on area cells (sale price
growth, share of recent buyers that are companies, renter share, and similar), shown wherever a
suggestion could raise property values. Its exact factors are set in the history and displacement
release.

**Population density** never multiplies a violence score. It appears only as "people this would
reach".

### 5.4 Feasibility: the second axis

Need and feasibility are kept apart. Feasibility (who owns the parcel, which legal route applies, how
long that route takes) is a filter and a sort, and the analysis view can plot need against
feasibility. This answers the organizer's real question: where does care help most, *and* where can
we actually get permission.

### 5.5 Suggestions

A suggestion is a registry rule: when a place meets its conditions, the place gets a card with what
to do, the legal route, cost, timeline, partners, and evidence badge. Each suggestion type is a
setting. First release suggestions:

| Place | Suggestion | First legal step |
|---|---|---|
| Vacant lot, any owner | Clean and green (PHS standard treatment) | Depends on owner: City and Land Bank lots through a garden agreement or license; private lots through the owner |
| Vacant lot, City or Land Bank | Community garden; side yard for the next door owner | Land Bank application (with Grounded in Philly's guide) |
| Vacant lot, private, neglected | Ask the owner (letter template); garden adverse possession if already gardened at least 5 of 10 years (2024 law, confirm with legal aid); conservatorship (with abuse warning) | Garden Justice Legal Initiative |
| Vacant lot already in LandCare | Join or start Community LandCare stewardship | PHS |
| Abandoned building open to entry | Report for clean and seal; Doors and Windows ordinance | 311 |
| Lot near a traffic death | Memorial garden, only with the family's blessing | Families for Safe Streets |
| Crash site where someone walking or cycling died | Memorial or ghost bike; traffic calming petition on a residential street; daylighting check | Bicycle Coalition; OTIS |
| High Injury Network segment | Vision Zero advocacy and public comment | Bicycle Coalition, Feet First Philly, 5th Square |
| Low canopy area | Free yard tree; street tree request | TreePhilly |

Funding is shown beside suggestions where it fits: the City's community violence prevention grants
and Feet First Philly's public space mini grants (see ROUTES.md).

### 5.6 The lot dossier

Sections, in order:
1. **Summary**: address, what we think it is (vacant lot or vacant building), confidence, and the
   reasons ("no building footprint; City records list it as vacant land; two vacant lot violations
   in 2025"). Links to street level imagery on the City's and Google's sites (we never copy imagery).
2. **What you can do**: suggestions, legal route first.
3. **Who owns it**: owner names and mailing address as the City publishes them, owner type, and the
   computed flags, each with "what this means" and "be careful" notes (section 9). Parcel level tax
   data is no longer public: the dossier shows the original project's July 2025 snapshot, always
   labeled with its date, and links to the City's Tax Center for today's balance.
4. **History**: every recorded sale and transfer with date, document type and price; assessments
   over time; permits, violations, demolitions; later, what stood here in old maps.
5. **Nearby**: shooting counts, crashes, memorials, LandCare lots, gardens, schools.
6. **Sources and freshness**, and "report a correction".

The dossier is built from the weekly snapshot and, when the setting "fetch live City data" is on
(default on), refreshed from the City's public APIs when opened. Any parcel can be opened by clicking
it, not only candidates.

### 5.7 Street safety and memorials

- High Injury Network (2025 version, 162 segments) as a line layer.
- Crashes from the City hosted PennDOT data (2020 to 2024 slice and older slices), filterable by year,
  severity, and mode; aggregated by segment and intersection.
- Fatal crashes from the Police dataset (nightly, 2019 onward) for the most recent deaths, shown as
  quiet memorial markers with date and mode. We do not show arrest details, case numbers, or driver
  information.
- Names come only from `data/curated/memorials.yaml`, a hand maintained file in which every entry
  cites a public memorial source (for example the Bicycle Coalition's TrafficVictimsPHL). Nothing
  scrapes names. A "show names" setting is on by default. Every memorial has "request removal".
- Asphalt art suggestions say "check with the City first" because of the 2025 federal stance.

## 6. Finding vacant land without depending on one source

The City's vacancy indicator stopped being accurate in June 2024, and that alone ended the original
project. On 2026-09-27 the City recalculated both indicator layers (28,771 lots and 9,519 buildings).
Compared with the June 2024 list L&I gave the original project, 69% of today's lots and 39% of
today's buildings were already listed, so this is a real recalculation, not old records with a new
date. Placekeepers uses the indicator, but never alone: losing any one signal lowers confidence on the
affected parcels instead of breaking the map.

The vacancy method study (milestone M0.5, [VACANCY_METHOD.md](VACANCY_METHOD.md)) tested every
signal against the City's lists, the churn since 2024, and 115 parcels in the City's 2023 aerial
photos. Its rules are adopted (2026-10-04):

| Signal | How it counts |
|---|---|
| City vacancy indicator | A strong vote: a lot is high only when two independent records agree with it; alone it gives low (City only lots were empty in 5 of 13 checks) |
| OPA category code says vacant land | One independent lot signal. Use the category code, not the description, which lags new construction by years |
| No building footprint | One independent lot signal, ignored where OPA describes a lived in house |
| Demolition with no new construction permit since | One independent lot signal; recent demolitions count even if OPA still says house. It is the only record that sees new lots promptly |
| Clean and seal in the last five years; unsafe; imminently dangerous | Building signals (a footprint must stand) |
| Vacancy specific violations and complaints | Signals. Weeds and rubbish violations are context only, because they mostly hit lived in homes |
| Planning land use (2023) shows a use | A contradiction: lowers a lot one level (catches yards and parking) |
| New construction permit | 2021 to early 2025 makes a lot low; since April 2025 caps it at medium |
| City vacant lot cleanups | Context only (hexagon counts); not published per parcel since 2013 |

The kind comes from the footprint, not from which City list a parcel is on: no footprint, or a
demolition after the footprint was drawn, means lot. This moves 1,110 parcels from the City's building
list to lots. LandCare lots stay in the vacant set, marked "already maintained".

| Kind | High | Medium | Low |
|---|---|---|---|
| Lots (2026-10-04) | 24,166 | 6,147 | 10,465 |
| Buildings (2026-10-04) | 6,553 | 2,876 | 8,503 |

Parks, gardens, parking, rail, utilities, cemeteries, water and streets never show as vacant (1,727
parcels). High and medium show by default; low sits behind the confidence filter. Where the City and
two of our records agree, 24 of 26 lots checked in the aerial photos were empty and 2 were unclear.

**Output per parcel:** kind (lot or building), confidence, the agreeing signals in plain words, and the
signal count, shown on the map and in the dossier.

**If the City indicator breaks again:** keep its last copy for twelve months, labeled with its date,
then drop it. Without it, high lots become medium (about 29,000 lots stay on the map at medium) and
2,936 buildings stay high. The health check also flags the City list as stale if its date stops
advancing for six months while demolitions keep being recorded.

**Still open:** buildings cannot be judged from the air. A person should check the 41 parcels in
`research/vacancy/human_check.csv` at street level; results go into `data/curated/spot_checks.yaml`.

## 7. Data sources

Every source has an adapter, a registry entry, a license note, an expected cadence, and health rules.
[DATA_SOURCES.md](DATA_SOURCES.md) lists them with their verified status. Rules:

- Prefer official bulk endpoints (City Carto SQL API, City ArcGIS services, OpenDataPhilly
  downloads). Small, polite requests; a descriptive User-Agent on every request.
- Bulk OpenStreetMap data comes from a weekly Geofabrik Pennsylvania extract filtered locally, not
  from the public Overpass server (it is overloaded and rejects default user agents).
- Never get around a login, paywall, bot check, or robots rule. Commercial crime sites
  (NeighborhoodScout, SafeMap, VeryApt) are not sources.
- Victim names only from the curated file (section 5.7).

## 8. Architecture

### 8.1 Overview

```
 City APIs, PennDOT, SEPTA, OSM extract, Census ...
          |  weekly GitHub Action (and manual runs)
          v
 pipeline: fetch -> validate -> snapshot -> derive -> publish
          |            |            |
          |      health report   last good snapshots (GitHub release assets)
          v
 published files: map tiles (PMTiles), ranked tables, dossier shards, manifest.json
          |
          v
 static web app on GitHub Pages (big tiles on Cloudflare R2 when needed)
          |  optional live lookups from the browser
          v
 City Carto SQL and address APIs (fresh dossier details)
```

### 8.2 Pipeline (Python 3.12)

- **Engine**: DuckDB with its spatial extension for joins and aggregation; GeoPandas and Shapely
  where convenient; pyarrow and GeoParquet for storage; h3 for hexagons; tippecanoe for tiles.
- **Adapters**: one module per source with `fetch`, `validate`, and `normalize`. Validation checks
  required columns, row count against the last good snapshot (a sudden drop fails), and the newest
  record date against the expected cadence.
- **Snapshots**: every validated source is saved as GeoParquet with metadata (fetched at, rows, hash,
  newest record). If validation fails, the last good snapshot is used and the source is marked stale.
  Weekly snapshots are attached to a GitHub release so history survives even if a source vanishes,
  which is exactly what the original project lacked.
- **Derive**: vacancy model, owner flags, legal routes, lens factors, suggestions, hexagon aggregates.
- **Publish**: PMTiles per layer group, ranked tables for the analysis view, dossier shards for
  candidate parcels, and `manifest.json` (build id, per source status, per layer file and size).
- **Cache**: raw downloads go to `$PK_CACHE` (default `~/.cache/placekeepers`), shared by every
  worktree so agents do not download the same city files twice.
- **CLI**: `pk fetch [source]`, `pk validate`, `pk derive`, `pk publish`, `pk health`, `pk all`.

### 8.3 Web app (TypeScript)

- Svelte 5 and Vite; MapLibre GL JS with the PMTiles protocol; a self hosted Protomaps basemap
  extract of the Philadelphia area (no API keys, no third party tile service).
- Lens weights are applied as MapLibre style expressions, so moving a slider recolors the map without
  reloading data. Ranked lists use a compact columnar table loaded once.
- Address search uses the City's address service from the browser. Live dossier refresh uses the
  City's Carto SQL API (both allow browser requests without a key). If they fail, the snapshot is used
  and the dossier says so.
- No analytics, no cookies, no accounts. Saved lists live in browser storage with export and import.
- Accessibility: WCAG AA contrast, colorblind safe palettes, keyboard navigation, and the ranked list
  as an accessible alternative to the map.

### 8.4 Automation and health

- `ci.yml`: on every pull request, pipeline tests on small fixtures, web tests, lint, and a build.
- `refresh.yml`: weekly (and on demand): fetch, validate, derive, publish, attach snapshots to the
  rolling release, deploy Pages. When a source fails two runs in a row the workflow opens or updates a
  GitHub issue labeled `data-source`, so the owner is notified instead of the site silently rotting.
- The public **Data status** page shows each source's last success, staleness, and row counts.

### 8.5 Hosting and cost

GitHub Pages serves the site and the smaller tile files (keep each file under 100 MB and the site
under 1 GB). Cloudflare R2's free tier (10 GB, no egress fees) takes the largest tiles when needed,
behind a configurable base URL. Data snapshots live on GitHub releases. Expected cost: $0 a month,
plus an optional custom domain (about $12 a year).

### 8.6 Repository layout

```
registry/        shared YAML registry (sources, layers, lenses, suggestions, routes)
pipeline/        Python package, tests, small fixtures
web/             Svelte app
content/         plain language pages in Markdown (about, evidence, how to, ethics)
data/curated/    hand maintained files (memorials, partner list, corrections)
docs/            design, roadmap, research
.github/         workflows and issue forms
```

## 9. Safeguards (summary; details in ETHICS.md)

- **Owner flags** are shown, as the owner decided, with protective framing: "possible estate" reads
  as "the owner of record may have died; heirs may not know they can keep this property; the Tangled
  Title Fund helps families clear title", with Fraud Guard sign up for families and a deed fraud
  warning. No "acquisition price" estimates and no "easiest to take" sort.
- **Conservatorship** suggestions carry the documented abuse warning and point to legal aid.
- **Shootings** are shown as hexagon counts by default; the point layer is a setting, off by
  default.
- **Names** only from curated public memorial lists; removal by email.
- **Displacement watch** appears wherever greening could raise values.
- **Terms of use** say the site is for community care and lawful use, not speculation.

## 10. Contributions and takedowns

- Benches, shelters, murals, trees and similar go into OpenStreetMap. The site links to a short guide
  and recommends the StreetComplete phone app, which asks simple questions such as "does this bus stop
  have a shelter?". OpenStreetMap currently knows about shelters at only about 300 Philadelphia bus
  stops, so this survey is a real gap neighbors can fill.
- Corrections use a GitHub issue form prefilled with the parcel or place id.
- Takedown requests go to a dedicated email address (the owner creates it; the owner's personal email
  is never published). Memorial removals are honored without questions.
- Interventions people completed can be logged through an issue form (organizing tools release), so
  outcomes can later be evaluated honestly.

## 11. Related projects and partners

- **Clean & Green Philly**: credited on the About page; reused code keeps its MIT notice. The owner
  may wish to tell its founders about the revival (draft in docs/outreach, never sent by agents).
- **Grounded in Philly** (Garden Justice Legal Initiative): we link to its legal guides and lawyer
  request form instead of duplicating them.
- **Park in a Truck** (separate private project of the owner): a "plan a park here" link from the
  dossier once that site is public.
- Likely partners: PHS, Neighborhood Gardens Trust, Bicycle Coalition and Families for Safe Streets,
  Feet First Philly, Mural Arts, Philadelphia Land Steward Union, Code for Philly, Philadelphia
  Assembly. Outreach drafts are written for the owner to send.

## 12. Open owner items (none block the build)

1. Create a dedicated takedown email address.
2. Create a Cloudflare account when tiles outgrow Pages.
3. Confirm the default licenses (GPL-3.0, ODbL, CC BY-SA 4.0).
4. Decide on outreach: Clean & Green Philly founders, Bicycle Coalition (memorial list), PHS, GJLI.
5. Optional custom domain (placekeepersphl.org appeared unregistered on 2026-10-04).
