# Roadmap

Written 2026-10-04. Each milestone is sized for one agent working in one session, has a GitHub issue
of the same name, and lists what "done" means. To continue the work later, tell the orchestrating
session which milestone to run next (for example "run M1.3"), or "run the next wave".

Model policy (owner's standing instruction): engineering agents run on Opus, research and docs agents
on Sonnet. No more than three agents build at once on this laptop.

## How work is done

- Each agent works in its own git worktree at `~/Desktop/placekeepers-wt/<name>` on branch
  `agent/<name>`, commits with the co-author trailer, and never pushes. The orchestrator reviews,
  runs the tests, merges to `main`, and pushes.
- The milestone's GitHub issue is the agent's brief, together with `CLAUDE.md` and the docs it names.
- Raw downloads go to the shared cache `~/.cache/placekeepers`. Check free disk space before large
  downloads and keep at least 10 GB free.
- A milestone is done when its acceptance list is met, tests pass in CI, and DESIGN.md is updated if
  the design changed.

## Phase 0: Foundations

| Id | Milestone | Agent | Depends on |
|---|---|---|---|
| M0.1 | Repository, docs, licenses, issue forms, labels, milestone issues | Planner | None |
| M0.2 | Pipeline skeleton and first adapters | Opus | M0.1 |
| M0.3 | Web shell | Opus | M0.1 |
| M0.4 | Automation: CI, weekly refresh, Pages deploy, failure issues | Opus | M0.2, M0.3 |
| M0.5 | Vacancy method study | Opus | M0.1 |

**M0.2 Pipeline skeleton.** Python package under `pipeline/` with the registry loader and schema
checks, a polite HTTP client (descriptive User-Agent, retries, rate limit), the shared cache, the
adapter base class (`fetch`, `validate`, `normalize`), GeoParquet snapshots with metadata, health
rules, `manifest.json`, and the `pk` command line. First adapters: OPA properties, Water Department
parcels, both vacancy indicator layers, shooting victims, High Injury Network 2025. Done when: a
local `pk all` runs end to end; tests cover a simulated row count collapse and a stale newest date,
both falling back to the last good snapshot and marking the source stale; the registry check fails a
layer without a description or license.

**M0.3 Web shell.** Svelte 5, Vite and TypeScript under `web/`; MapLibre with the PMTiles protocol;
a self hosted Protomaps basemap extract; a layer panel and settings drawer generated from the
registry; state in the address bar and in namespaced browser storage; field view and analysis view
layouts; a Data status page that reads `manifest.json`; all interface text in one strings file.
Done when: every registry layer has a working toggle; a copied link restores the same view; the phone
layout works at 375 pixels wide; vitest passes; it builds for GitHub Pages.

**M0.4 Automation.** `ci.yml` (pipeline tests on fixtures, web tests, lint, build), `refresh.yml`
(weekly and on demand: fetch, validate, derive, publish, attach snapshots to a rolling release,
deploy Pages), tippecanoe installed in CI, and an issue opened or updated when a source fails twice
in a row. Done when: a manual run publishes the live site with real layers, and a deliberately broken
source opens a `data-source` issue.

**M0.5 Vacancy method study.** In `research/vacancy/` (not in `pipeline/`): build a per parcel table
of every vacancy signal in DESIGN section 6, measure agreement with the City indicator, test whether
the churn since 2024 makes sense, and run an aerial spot check of a stratified sample against the
City's 2023 orthophotos. Done when: `docs/VACANCY_METHOD.md` gives agreement tables, the spot check
results, a recommended rule set with confidence levels, and a list of parcels for a human street level
check.

## Phase 1: First public release, v0.1 "Lots and streets"

| Id | Milestone | Agent | Depends on | Status |
|---|---|---|---|---|
| M1.1 | Property and context adapters | Opus | M0.2 | Done, 2026-10-04 |
| M1.2 | Vacancy model v1 in the pipeline | Opus | M0.5, M1.1 | Done, 2026-10-04 |
| M1.3 | Owner flags and legal routes | Opus | M1.1 | Done, 2026-10-04 |
| M1.4 | Violence reduction lens | Opus | M1.2 | Done, 2026-10-04 |
| M1.5 | Street safety lens and memorials | Opus | M0.2 | Done, 2026-10-04 |
| M1.6 | Lot dossier and live City lookups | Opus | M0.3, M1.3 | Done, 2026-10-04 |
| M1.7 | Field view and analysis view, complete | Opus | M1.4, M1.5, M1.6 | Done, 2026-10-04 |
| M1.8 | Site content | Sonnet | M0.3 | Done, 2026-10-04 |
| M1.9 | Memorial names, curated by hand | Sonnet, after the owner hears from the Bicycle Coalition and the removal email exists | M1.5 | Waiting on the owner |
| M1.10 | Verification | Opus | M1.7, M1.8 | Done, 2026-10-04 |
| M1.11 | Release v0.1 | Sonnet | M1.10 | Done, 2026-10-04 |

**M1.1 Property and context adapters.** Real estate transfers (for candidate parcels in bulk and any
parcel on demand), assessment history, violations, complaints (filtered), permits, unsafe, imminently
dangerous, clean and seal, demolitions, building footprints, City owned property, PHS LandCare, both
garden sources, Parks and Recreation properties, zoning, land use, community organizations, council
districts, neighborhoods, ACS poverty rate, and the original project's July 2025 snapshot (tax debt,
dated). Done when each has validation rules and fixture tests and appears on the Data status page.

**M1.2 Vacancy model v1.** Implements the rules chosen in M0.5, with kind, confidence, reasons and
signal count per parcel, and the numbers for the "How we find vacant land" page. Done when the
validation numbers are reproduced by a test and the candidate set is published as tiles.

**M1.3 Owner flags and legal routes.** Owner type, absentee owner, possible estate, tax debt as of
July 2025, past sheriff sales, years since last sale, owners with many vacant parcels, fast resales,
open violations; legal routes per parcel from `registry/routes.yaml`; wording exactly as in ETHICS.md.
Done when every flag has tests with real looking fixtures and every route has a "last checked" date.

**M1.4 Violence reduction lens.** Shooting counts per H3 cell (12 and 36 months), poverty rate,
untreated vacant lot or open building, LandCare status, canopy deficit; percentiles; weights applied
in the map style; the "why" breakdown; evidence badges. Done when moving a slider recolors the map
without reloading and the breakdown sums to the score.

**M1.5 Street safety lens and memorials.** The High Injury Network, City hosted PennDOT crashes (all
slices), Police fatal crashes (nightly), aggregation to street segments and intersections, schools,
the street safety lens, the memorial layer from `data/curated/memorials.yaml` (fatal crash markers
without names until M1.9), crash site suggestions, and the "show names" setting. Done when a fatal
crash from last week appears after a refresh and no driver or case details are published.

**M1.6 Lot dossier.** The six dossier sections from DESIGN 5.6, built from snapshot shards and
refreshed live from the City's Carto API when the setting is on, with a clear fallback message; the
full transfer history; a print layout; "report a correction". Done when any parcel in the city opens
a dossier and 20 parcels match property.phila.gov field by field.

**M1.7 Views complete.** Field view "What you can do nearby", analysis view filters, lens presets,
ranked table, CSV and GeoJSON export, need against feasibility plot, saved lists with export and
import. Done when both views pass end to end tests on phone and desktop sizes.

**M1.8 Site content.** About (with credit to Clean & Green Philly), Why this works (from EVIDENCE.md),
How to do it (from ROUTES.md), Use this responsibly (from ETHICS.md), How we find vacant land, Data
status, Terms, Privacy, Contact and removal requests. Plain language, no dashes as punctuation. Done
when every page is reachable from the menu and the strings file passes the style check.

**M1.10 Verification.** An adversarial review: data spot checks end to end, a misuse review against
ETHICS.md, an accessibility audit (contrast, keyboard, screen reader labels on lists), a performance
budget (first load under about 2 MB before map tiles), and Playwright tests in CI.

**M1.11 Release v0.1.** README with screenshots, changelog, tag, release notes, and outreach drafts
ready for the owner.

## Phase 2: v0.2 Transit comfort

- **M2.1 SEPTA data** (done, 2026-10-05): GTFS stops, routes and frequencies; stop level
  ridership; mapping stop ids across New Bus Network phases (Phase 1 began 2026-08-23; phases run
  to August 2027).
- **M2.2 Shelters and benches** (done, 2026-10-05): OpenStreetMap from a weekly Geofabrik
  extract; a StreetComplete survey guide for neighbors. The City's own shelter list turned out to
  be public on OpenDataPhilly all along; M4.5 reads it, so no Right to Know request is needed.
- **M2.3 Transit comfort lens and suggestions** (done, 2026-10-05): boardings, missing shelter or
  bench, heat and shade at the stop, crossing on the High Injury Network; suggestions for shelter
  requests, benches, shade trees, and lighting reports.
- **M2.4 Survey campaign kit** (done, 2026-10-05): a printable guide for mapping your route's
  stops in an afternoon.

## Phase 3: v0.3 Heat and shade, and placemaking

Done and released as v0.3 on 2026-10-08. M3.1 and M3.5 shipped early, in v0.2; M3.2 arrived at the
end of v0.2's work and is described in v0.3's notes.

- **M3.1 Heat and shade lens** (done, 2026-10-05, early, in v0.2): heat vulnerability, street
  trees, canopy, land cover, flood plain.
- **M3.2 Public art layer** (done, 2026-10-05): Percent for Art, OpenStreetMap, Wikidata;
  deduplication; links out to Mural Arts. philart.net, the Association for Public Art and Magic
  Gardens wait for their permission (owner outreach).
- **M3.3 Walkability and people** (done, 2026-10-08): EPA walkability index; people within a 5
  minute walk (2020 census blocks); everyday places within a 10 minute walk and street corners,
  from the City's, the USDA's and SEPTA's lists and the City's street centerlines (OpenStreetMap is
  left out, DESIGN section 5.9); DVRPC traffic stress. DVRPC's sidewalk data wait for clear terms.
- **M3.4 Placemaking lens and suggestions** (done, 2026-10-08): a lens on the lots from people and
  everyday places within walking distance, walkability, distance to a park, public art nearby and
  the City's commercial corridors; suggestions for a place to sit in the shade, a community garden
  and a mural, and reports to Philly311 where a block a lot faces has an open request. Not on the
  area cells (DESIGN section 5.3).
- **M3.5 Amenities and conditions** (done, 2026-10-05, early, in v0.2): benches, water, toilets,
  bookcases, libraries, recreation centers, and 311 condition layers (dumping, dark streetlights,
  graffiti).

Two additions that were not on the roadmap, both done on 2026-10-08 and in v0.3:

- **Land Bank listed lots** (issue #36): a setting and filter for the lots the City's land agencies
  list as available, from the City's own `city_owned_property` layer, with the side yard route
  first, no prices and no ranking by ease. The same issue recorded the four community and City
  sources checked that day (DATA_SOURCES.md, "Sources checked 2026-10-08"): Transit Forward
  Philadelphia's stop audits wait on permission, and PhillyTreeMap is not used.
- **Laser Vision parking heat map** (issue #37): a heat map of parking problems reported with
  Philly Bike Action's Laser Vision app, counts only in block sized cells, shown with its
  permission (confirmed by the owner 2026-10-08) as evidence for physical fixes to the street.

## Phase 4: v0.4 History and displacement

- **M4.1 Displacement watch** (done, 2026-10-08, early, in v0.3): sale price trends and company
  buyer share from transfers, the City's Market Value Analysis (the 2026 edition), renter share,
  assessment changes; the overlay and "pair with protections" cards.
- **M4.2 Full history in the dossier** (done, 2026-10-09, issue #38): every transfer since 1974, an
  assessment chart, and one timeline of deeds, violations, permits, demolitions and the dated
  vacancy lists, the same with live City data on or off (DESIGN.md section 5.6).
- **M4.3 Historic maps** (done, 2026-10-09, issue #39): aerial photos from 1959 to 2025 (the City's,
  and the 1959, 1975 and 1999 photos it hosts for DVRPC and the USGS) with a year slider, the 1860
  atlas the City hosts, and the 1937 redlining map under Mapping Inequality's non commercial
  license (DESIGN.md section 5.11). PhilaGeoHistory layers wait for the Athenaeum's permission.
- **M4.4 Land Bank statistics** (done, 2026-10-09, issue #40): the page "The Land Bank in numbers",
  conveyances by agency, year, buyer type and council district from the City's deed records, for
  the Land Steward Union's campaign and anyone else (DESIGN.md section 5.10). The program is our
  inference where the records do not name it.
- **M4.5 Streets and stops** (done, 2026-10-09, issue #41, added by the owner on 2026-10-09 after the Build Philly
  Now review): the City's own bus shelters, counted as shelters in the transit comfort lens, with
  the stop's page saying where the City and OpenStreetMap disagree; the City's street poles and
  the lamps it lists, by block and beside 311 reports of lights out; its traffic calming devices
  by block; and its school crossing guard posts. A street light lens factor is proposed with
  numbers, not built (DESIGN.md section 5.7).
- **M4.6 Lot rules and records** (done, 2026-10-09, issue #42, added by the owner on 2026-10-09): historic districts
  and the Philadelphia Register, zoning overlays, EPA brownfield records, and appeals and hearings
  on the lot page, in its timeline and on the map, with names from appeals on the lot's own page
  only (DESIGN.md section 5.6).
- **M4.7 Neighborhood context** (done, 2026-10-09, issue #43; added by the owner after the Build
  Philly Now review): rent burden, middle rent and income, and empty homes with their margins on
  the watch areas' cards; the City's warming and cooling sites (shown without a credit line, as
  the owner decided) beside the pools; playgrounds, and the nearest one on each lot page. Rent
  burden as a watch sign and "no playground within a short walk" as a placemaking factor are
  proposals with numbers for the owner (DESIGN.md section 5.3), not built.

## Phase 5: v0.5 Organizing tools

- **M5.1 Lists and packets**: printable packets with each lot's one page summary, the registered
  community organization and council office contacts, and letter templates reviewed by legal aid.
- **M5.2 Neighbor notice**: a printable flyer with a QR code so neighbors who care about the same lot
  can find each other (the 596 Acres idea), with guidance on where posting is allowed.
- **M5.3 Intervention log**: an issue form feeding `data/curated/interventions.yaml` and a map layer
  of completed projects.
- **M5.4 "Did it work?"**: honest before and after comparisons against matched untreated lots, with
  uncertainty and the warnings from EVIDENCE.md.
- **M5.5 Spanish translation**, then other languages.

## Ongoing

- Weekly automated refresh and health checks. Source failures arrive as GitHub issues.
- Every three months: recheck ROUTES.md entries older than six months (Sonnet).
- Every year: refresh EVIDENCE.md with new studies (Sonnet).
- Move large tiles to Cloudflare R2 when a file nears 100 MB or the site nears 1 GB.

## Owner actions

None of these block Phase 0.

1. Run `sudo apt install tippecanoe` on this laptop (map tile builder; needed locally from M0.2).
2. Create a dedicated email address for corrections and removal requests. Owner decision
   (2026-10-04): the prototype and v0.1 go ahead without it, and the Contact page says "coming soon"
   until it exists. Names of people killed (M1.9) stay off the map until it exists, because ETHICS.md
   promises families removal by email.
3. Send, edit or skip the outreach drafts in `docs/outreach/` (Clean & Green Philly founders, Bicycle
   Coalition and Families for Safe Streets, PHS, Garden Justice Legal Initiative, OTIS, Land Bank,
   art data holders).
4. Optional: a free Census API key, stored as a repository secret. Not needed for the poverty
   rate, which comes from the Census Bureau's bulk table files without a key.
5. Later: a Cloudflare account and R2 bucket when tiles outgrow GitHub Pages.
6. ~~Optional: a Right to Know request to OTIS for the bus shelter inventory.~~ Not needed (M4.5,
   2026-10-09): the City publishes its list of bus shelters on OpenDataPhilly, and the map reads
   it. Still worth asking OTIS, in the outreach draft, how often that list is updated: it was last
   changed in January 2025.
7. Optional: check a few dozen lots in person or on street imagery for the vacancy spot check.
8. Ask PHS about reuse terms for its map of gardens it and the Neighborhood Gardens Trust support
   (the `PHS_NGT_Supported_Current_view` layer states no license). The map shows these gardens with
   credit in the meantime, and removes them if PHS asks.
9. Optional: ask DVRPC (data@dvrpc.org) how the terms of its sidewalk gap products carry over from
   the Overture Maps roads they are built on (DESIGN.md section 5.9). Until then the walking layers
   leave them out.
10. Send, edit or skip the permission request to Transit Forward Philadelphia for its bus stop
   audits (DATA_SOURCES.md, "Sources checked 2026-10-08"). Nothing from the audits is used until
   there is a trimmed copy and a license.
11. Optional, for The Land Bank in numbers (DESIGN.md section 5.10 and section 12, item 7): ask the
   Clerk of City Council for a Legistar API token, ask PHDC for the Land Bank's dispositions by
   program, and ask the City whether its Land Management dashboard table may be reused.
12. Send, edit or skip the permission request to the Athenaeum of Philadelphia for the GeoHistory
   Network's other maps (DESIGN.md section 5.11).
13. Decide whether street lights become a transit comfort lens factor (DESIGN.md section 5.7); the
   recommendation is to keep them as context only.

## Waves

- **Wave 1 (2026-10-04)**: M0.2, M0.3, M0.5 in parallel.
- **Wave 2**: M0.4, M1.1, M1.5.
- **Wave 3**: M1.2, M1.3, M1.8.
- **Wave 4**: M1.4, M1.6, then M1.7.
- **Wave 5**: M1.9 (after the owner's outreach), M1.10, M1.11.
