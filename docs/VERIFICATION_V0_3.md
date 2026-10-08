# Verification before v0.3: walking, placemaking, displacement and more

Written 2026-10-08 by the verification agent, before the orchestrator tags v0.3. This is an
adversarial review of everything merged on `main` since the v0.2 tag (c504f1a), as of 6753223:

* the lot page's score breakdown and flood note however a lot page was opened (#31), and a base
  map that draws no labels of artworks, memorials, monuments or graves;
* street blocks and crashes listed beside the map (#26, item 1);
* walkability, people and places within walking distance, and traffic stress for people on bikes
  (M3.3: `walk.pmtiles`, `cycling.pmtiles`);
* lots listed as available by the City's land agencies, the Land Bank's list (#36);
* the displacement watch (M4.1: `displacement.pmtiles`, the full protections card inside watch
  areas);
* the placemaking lens and its suggestions (M3.4);
* the heat map of parking problems reported with Philly Bike Action's Laser Vision app (#37:
  `parking.pmtiles`), merged into `main` during this review and reviewed with the rest.

The v0.2 review is [VERIFICATION_V0_2.md](VERIFICATION_V0_2.md).

**What was checked.** A local offline publish of 2987f0e and then of 6753223 from the shared
snapshots into this worktree's own folder (main's code was first run again on the walking,
placemaking and displacement steps in a private copy of the cache, and it reproduced the shared
derived files exactly); the production build of the site on that data, served on its own port and
looked at in the built-in browser at phone (375 wide) and desktop (1280 wide) sizes; four lots in
four neighborhoods followed end to end; the displacement watch's sale, company and assessment
measures recomputed independently for all 408 tracts; the docs, the in app pages and the registry
read against the code; the live site (build `2026-10-08T15-00-06Z-c572bbd`, which has the
displacement watch but not yet placemaking or the parking layer) for sizes.

## In short

What changes for the owner, most important first:

1. **The protections show exactly where the rules put them.** Inside a displacement watch area,
   every greening card, every card for a place to sit, a garden or art, and the box of a lot the
   City lists as available show the caution, the area's signs and the five ways to protect
   neighbors; outside every watch area they show the one line caution; the three Philly311 report
   cards show none. Checked on the map's nearby list, the lot page, its print and the CSV
   download, on real lots. One gap, **fixed** (e7f197d): every caution links to the "Use this
   responsibly" page, which quoted only the greening sentence; it now quotes the placemaking one
   too, and a test keeps the two in step.
2. **No police or enforcement wording anywhere.** The parking layer speaks only of physical fixes
   (curb extensions, bollards, daylighted corners, protected bike lanes, loading zones) and names
   the City's transportation office, never tickets, the Parking Authority or drivers. One older
   sentence on the How page said daylighting "is about enforcing a rule that already exists"; it
   now asks for a physical change that keeps the corner clear (e7f197d). A new test reads every
   interface string, layer, lens, suggestion and route for enforcement words (618d85f).
3. **The numbers agree.** The watch's middle sale prices, company buyers and assessed values,
   recomputed with our own queries for all 408 tracts, match the pipeline's. On four lots the
   factors, the score on the lot page, the score on the card and in the CSV, the main reason and the
   suggestions agree, and the people within a 5 minute walk and the distance to a park, measured
   again independently, match to the person and the meter.
4. **Nothing new talks to another server.** The new layers come in the site's own files, and the
   browser never asks bikeaction.org for anything. The privacy test did not cover the new layers;
   it now does (618d85f).
5. **Weight is fine.** The whole site is 213 MB of GitHub Pages' 1 GB, and the largest file is the
   streets tiles at 11.6 MB of the 100 MB limit. The placemaking factors grew the lots tiles from
   8.9 to 9.6 MB, as DESIGN.md says.
6. **The docs agree with the code after a round of fixes** (e7f197d, b6f4d9d, fa399ff): stale
   "will" and "until merged" sentences, a roadmap line describing walking measures that were not
   built that way, counts, and the release labels. The release docs themselves (README,
   CHANGELOG, the "Version 0.1" banner) still describe earlier versions; they are for the release
   step (section 7).
7. **Five decisions** for the orchestrator or the owner, below: writing the v0.3 protections into
   ETHICS.md, a garden suggestion where almost no one lives, dollar prices on watch areas, the
   parking layer's reporter safeguard, and how often the full watch card repeats.

Commits on `agent/verify3`: e7f197d, b6f4d9d, 618d85f, cad564d, fa399ff and this report. Tests:
994 pipeline tests pass (not live), 831 web unit tests pass, svelte-check has no errors or
warnings, ruff check and format pass, `pk registry check` passes, the site builds, and the full end
to end suite passes at phone and desktop sizes (section 8). No contract changed.

## 1. Four lots, end to end

Chosen from the real build: one inside a watch area, one listed as available and eligible for a side
yard (outside the watch), one far from a park, and a listed lot inside a watch area. Scores are
under the placemaking lens with the Balanced weights (3, 2, 2, 2, 1, 1); the factors are people
within a 5 minute walk, everyday places within a 10 minute walk, walkability, far from a park, no
public art nearby, and a commercial corridor.

| Lot | Why chosen | Factors | Lot page score | Card | Main reason | Caution shown |
|---|---|---|---|---|---|---|
| 6015 Spruce St (031117700), Cobbs Creek | Watch area (assessed values, company buyers) | 86, 44, 47, 60, 60, 100 | 65.5 (by hand 720 / 11 = 65.45) | 66 | People within a 5 minute walk | Full card on its 5 greening and placemaking cards, none on "Report the dark street light" |
| 6000 N 20th St (172384200), Ogontz | Listed as available, side yard eligible, outside the watch | 61, 95, 15, 80, 65, 0 | 57.1 (628 / 11 = 57.09) | 57 | Everyday places within a 10 minute walk | One line, in the listing box and on each card |
| 1005 Unruh Ave (874165320), Oxford Circle | Far from a park (670 m, `f_park` 100) | 54, 3, 44, 100, 70, 0 | 47.8 (526 / 11 = 47.82) | 48 | Far from a park | One line placemaking caution |
| 1420 N Ithan St (043059950), Carroll Park | Listed, side yard eligible, inside a watch area (sale prices, company buyers) | 89, 95, 64, 65, 40, 0 | 68.6 by hand (755 / 11) | 69 | People within a 5 minute walk | Full card on the nearby card |

* **The lot page and its print.** 6015 Spruce St lists six suggestions in order (a place to sit in
  the shade, a community garden, art, clean and green, green the lot to cool the block, report the
  dark street light): the first five each carry their caution with the area's signs ("the City's
  assessed values rising faster than across the city; and companies buying many of the homes
  sold") and the five protections, each "checked October 8, 2026"; the report carries none. The
  print lists the first three with the placemaking caution and ends with a "Displacement watch"
  section giving each protection's address. 6000 N 20th St opens with the box "Listed as available
  by the City's land agencies": "On October 4, 2026, the City's list of public land showed this
  property as available", the one line caution, the side yard route first, the Land Bank's note
  that it may say no (in our words), the Land Bank's map and the credit; "Who owns it" says "listed
  as available ... eligible for the side yard program". No price, no buy button.
* **A lot page opened from a link** (issue #31). 6000 N 20th St was opened with the map far away, so
  its map tile was never loaded: the breakdown, from the lot's own dossier, is the same as from the
  map.
* **The CSV download** of the 28 places around 6015 Spruce St has, for that lot, score 66, main
  reason "People within a 5 minute walk", suggestion "Make a place to sit in the shade", and the
  `displacement_watch` column "Displacement watch area: the City's assessed values rising faster
  than across the city; and companies buying many of the homes sold"; its notes carry the
  placemaking caution and the placemaking line for watch areas with the five protections' addresses.
  The card, the ranked list and the CSV show 66 where the lot page shows 65.5 on purpose: they round
  the tenth the lot page shows, so the two never disagree in the other direction
  (`wholeScore`, 58ae630).
* **The map's color** comes from the same score: the map expression and the breakdown are the same
  rule written twice, and `tests/lens.test.ts` checks that they agree.
* **Independent recounts.** People within a 5 minute walk, from the census blocks' internal points
  within 400 meters of each lot's point, our own code: 5,417, 4,183, 3,907 and 5,674, each equal to
  the pipeline's. The distance to the nearest park land, from Parks and Recreation's 479 park
  properties: 288, 376 and 670 meters, each equal to the pipeline's.
* **A tapped watch area.** Census tract 112 around Carroll Park (the fourth lot's) says the middle
  price went from $70,000 to $110,000, up 57%, against 28% across the city, and companies bought 53%
  of the 262 homes sold: our own recomputation gives 329 and 262 sales, $70,000 and $110,000, and
  53.4%.

## 2. The displacement watch, recomputed

With DuckDB from the snapshots, independent of the pipeline's code: each OPA parcel placed in its
2020 tract by its point; sales from the newest recorded day (2026-09-02) back three years and the
three years that ended five years before; deeds for more than $100, not sheriff, condemnation,
adverse possession or Land Bank deeds, for one property, of a single family or two to four family
home built in or before the year of the sale; the adjusted price.

| Measure | City, pipeline | City, ours | Tracts that agree |
|---|---|---|---|
| Home sales, earlier and recent | 67,828 and 48,265 | 67,828 and 48,265 | 408 of 408 |
| Middle price | $180,000 to $230,000 | $180,000 to $230,000 | 408 of 408 |
| Company buyers | 26.8% | 26.8% | 406 of 408; the other two differ by 0.1 point where the share ends in a 5 and the two programs round it differently (46.2 or 46.3, 1.2 or 1.3), which changes no sign |
| Assessed values, 2022 to 2027 | 496,003 homes, middle change 68.9% | the same | 408 of 408 |

The renter share and the Market Value Analysis are read directly from their sources and were not
recomputed. DESIGN.md said a sale counts when the house was "built before the year of the sale"
while the code counts one built in that year too; the words now say "in or before" (fa399ff).

## 3. Ethics and honesty

| Rule | How it was checked | Result |
|---|---|---|
| No police or enforcement wording | Every interface string, layer, lens, group, suggestion and route, the content pages, and the parking layer's legend and tapped area | None. The parking layer frames counts as evidence for physical fixes and names OTIS. The How page's "about enforcing a rule that already exists" (daylighting, older than v0.2) now asks for posts, planters or a curb extension, and ROUTES.md says the same (e7f197d). A unit test now guards all of it (618d85f) |
| Philly311 only for physical conditions | The three new report suggestions | Dumping, a dark street or alley light, graffiti; "A report is about the trash, never about who left it". They never lead a card and carry no displacement caution |
| No names of people who died outside the curated list | The base map style; the new tiles' properties (walk, cycling, displacement, parking, the lots' new fields) | The base map hides every point of interest of the kinds artwork, memorial, monument, tomb, grave yard and wayside shrine or cross (`HIDDEN_POI_KINDS`, with tests). No new tile holds a person's name; the watch names only the neighborhood at a tract's center |
| No prices, buy buttons or "easiest to buy" for listed lots | The listing box, the filter, the lot page, print and CSV, and the registry | No price, no buy button; the filter is named for the City's status ("Listed as available by the City's land agencies"); the only links are the Land Bank's own map and its programs for neighbors; the existing test for ease of acquisition words passes |
| The displacement caution exactly where the rules say | Section 1 on real lots, and the unit and end to end tests (`displacement`, `placemaking`, `listing`) | Full card in watch areas on greening, placemaking, bus stop shade tree cards and the listing box; one line elsewhere; none on the 311 reports; in print and CSV by the same rule |
| The watch ranks nothing | The map style and the details | One fill for every area whatever its signs; "Signs that prices are rising here"; no score or order changes |
| No personal data from any source | The snapshots of the new sources and the published tiles | `real_estate_sales` keeps only the buyers' type, never names, and never downloads sellers' names; the census counts are block totals; `pba_laser` keeps each report's H3 cell and kind, never its point, and its download is deleted once the snapshot is made (the raw folder is empty); no new tile property holds a name or address |
| Nothing from the Transit Forward sheet | `git grep` for docs.google.com and "spreadsheets" across the repository and its history, and the built site | None. DATA_SOURCES.md names the audits only as "ask permission first"; "spreadsheets" appears once, in a CSV test |
| Laser Vision used only as agreed | DATA_SOURCES.md, the adapter, the tiles | Counts per cell about a block across (H3 resolution 10), shown only from 5 reports in 12 months, a kind within a cell only from 5 of its own; the busiest cell (455 reports, 449 on a sidewalk) shows "fewer than 5" for the other kinds. Weekly, one request per kind, 5 seconds apart, with the project User-Agent. See decision D4 |

## 4. Accessibility and phones

* **Keyboard.** In the built-in browser, on the real build: each new layer (walkability, people
  and places within walking distance, traffic stress, the displacement watch) turns on with Space
  from its switch; Tab reaches its settings and the arrow keys change them; the placemaking lens's
  presets work with Enter. The end to end tests open the street blocks and crashes lists by
  keyboard, and run axe on them, the listing box, a watch area, the walking layers, the placemaking
  cards and the parking areas.
* **The link.** With the placemaking lens, the "Far from a park" preset, "Listed as available
  only", walkability shaded by street corners and compared with the country, walking distance by
  kinds of places and traffic stress showing stressful streets only, the address held every one of
  them, and opening that address in a fresh page gave the same address back and the same choices
  on screen, the preset marked as in use.
* **Phones (375 wide).** The top bar keeps to two rows; nothing scrolls sideways with every new
  layer on; the legends of walkability, walking distance, traffic stress, the displacement watch
  and the parking reports read clearly in the layers sheet; a tapped watch area fills the sheet and
  reads top to bottom.
* **axe** passes on every page the end to end suite opens, at both sizes (section 8).

## 5. Docs

Read against the code and the registry, with help from a second agent. Fixed:

* content/responsibly.md: the placemaking caution, word for word, and the listing box (e7f197d).
* content/how.md: the Neighborhood Gardens Trust's criteria, checked 2026-10-08, instead of "not
  yet confirmed"; the daylighting sentence (e7f197d).
* content/why.md: each placemaking factor with its own badge; "people within a 5 minute walk"
  carries Context, not Mixed (e7f197d).
* DESIGN.md: the listing box "is to carry the displacement caution ... until that release is
  merged" (it does); "M3.4 will bring their measures to the lots"; "a placemaking lens on cells"
  (M3.4 left the cells out); "each of its six factors is ranked" (the corridor factor is 100 or 0);
  "built before the year of the sale" (e7f197d, fa399ff).
* CONTRACTS.md: the `displacement` group and the `placemaking` option of "Color lots by" (e7f197d).
* ROADMAP.md: M3.3 described OpenStreetMap measures and DVRPC's pedestrian network that were not
  built; M4.1 marked as shipped early in v0.3; two owner actions added (asking DVRPC about its
  sidewalk data, and the Transit Forward permission request) (e7f197d).
* ROUTES.md: six placemaking suggestions, not four; the protections apply to placemaking cards and
  the listing box too (e7f197d).
* pipeline/README.md: what `pk derive` runs, the placemaking derived files, the displacement and
  parking tiles, and the Laser Vision source (e7f197d).
* Registry: the displacement sources and layer marked v0.3, not v0.4 (e7f197d, b6f4d9d); the watch's
  description and legend name every kind of card that adds protections; the Market Value
  Analysis sign reads like the others; the corridor factor explained in words (b6f4d9d).

No dash is used as punctuation in any doc, content page, registry file or interface string touched
since v0.2, nor in the 50 commit messages since v0.2.

## 6. Weight

| File | Live (c572bbd) | This build (6753223) |
|---|---|---|
| tiles/lots.pmtiles | 8.9 MB | 9.6 MB |
| tiles/streets.pmtiles | 11.6 MB | 11.6 MB |
| tiles/transit.pmtiles | 4.3 MB | 4.3 MB |
| tiles/cycling.pmtiles | 2.4 MB | 2.4 MB |
| tiles/walk.pmtiles | 1.7 MB | 1.7 MB |
| tiles/care.pmtiles | 1.4 MB | 1.4 MB |
| tiles/trees.pmtiles | 1.2 MB | 1.2 MB |
| tiles/environment.pmtiles | 1.2 MB | 1.2 MB |
| tiles/conditions.pmtiles | 0.8 MB | 0.8 MB |
| tiles/boundaries.pmtiles | 0.7 MB | 0.7 MB |
| tiles/amenities.pmtiles | 0.5 MB | 0.5 MB |
| tiles/places, art, context, displacement | 0.2, 0.2, 0.2, 0.1 MB | the same |
| tiles/parking.pmtiles | not yet | 0.15 MB |
| dossiers (933 files) | 127.8 MB | 130.7 MB |
| The whole site with the base map | | 213 MB |

The site build stops at any file over 95 MB and at a site over 950 MB (`refresh.yml`). The largest
file is a ninth of the first limit and the site under a quarter of the second. The local base map
is the one built on 2026-10-04 (48 MB).

## 7. For the release step

* The banner still says "Version 0.1: a first public version" (`strings.app.earlyPreview`); it said
  so through v0.2 as well.
* README.md still says "What you can do with v0.2" and calls public art, walkability and the
  displacement watch later releases; CHANGELOG.md has no v0.3 section yet.
* The public art layer (M3.2) shipped inside the v0.2 tag (c504f1a) but the v0.2 changelog never
  mentions it; the v0.3 notes can.
* The Market Value Analysis source's home page in the registry is OpenDataPhilly's page of the 2023
  edition, while the map uses the 2026 edition on the City's open data hub (finding F8).

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| F1 | Must fix before v0.3 | The page every caution links to quoted only the greening caution, not the placemaking one, and did not mention the listing box | content/responsibly.md | **Fixed** e7f197d, with a test (618d85f) |
| F2 | Should fix | "This is about enforcing a rule that already exists" on the How page, now beside a layer of parking reports | content/how.md, ROUTES.md | **Fixed** e7f197d; a test now reads every interface text for enforcement words (618d85f) |
| F3 | Should fix | The privacy test never turned on the new layers | web/e2e/privacy.spec.ts | **Fixed** 618d85f: walking, cycling, the watch and parking, the placemaking lens and a listed lot, at both sizes |
| F4 | Should fix | The watch's legend and description said only greening cards add protections; the Market Value Analysis sign read unlike the others | strings.ts, layers.yaml | **Fixed** b6f4d9d |
| F5 | Should fix | Stale or wrong docs: section 5 | DESIGN, CONTRACTS, ROADMAP, ROUTES, pipeline README, why.md, how.md | **Fixed** e7f197d, fa399ff |
| F6 | Later | A lot page in a watch area repeats the full card on every greening and placemaking suggestion (five times on 6015 Spruce St), long on a phone | Section 1 | Decision D5 |
| F7 | Later | A nearby card for a listed lot does not say it is listed, and its first step is the lot's usual route, not the side yard | 1420 N Ithan St | Interface: a short "Listed as available" line on the card |
| F8 | Later | The Market Value Analysis source links to the 2023 edition's page | registry/sources.yaml `market_value_analysis` | Link the 2026 item on the City's open data hub |
| F9 | Later | "Who owns it" says "The City's list of public property names ... as the owner" twice for a City owned lot (once as the owner type's reason, once in the list's own line); older than v0.3 | 6000 N 20th St | Interface: leave the reason out when the list's line follows |
| F10 | Info | A kind's count hidden as "fewer than 5" can sometimes be worked out from the total and the other kinds | `parking` tiles | None needed: Philly Bike Action's own map shows every report |
| F11 | Info | A lot already in PHS LandCare still lists "Steward a lot with PHS Community LandCare" first, and "Ask the owner" speaks of clean and green under a seating suggestion | 6015 Spruce St; older than v0.3 | Later: a route list that knows the lot is cared for |

## Decisions needed

**D1. Write the v0.3 protections into ETHICS.md.** ETHICS.md is the binding page, but three
safeguards built in v0.3 live only in DESIGN.md and the code, so a later change could drop them
without touching it: (a) the placemaking cards' own caution, and the full card on placemaking cards
and the listing box inside watch areas (decided by the orchestrator on 2026-10-08); (b) for lots
listed as available, no price, no buy button, the side yard route first, only the Land Bank's own
map, and its note that it may say no, which answers the "shopping list" risk in the Speculation row;
(c) for the parking reports, counts only, per cell about a block across, at least 5 reports in 12
months, framed as evidence for physical fixes, never a word about tickets, the Parking Authority or
drivers. ETHICS.md changes need the owner's agreement. Recommendation: add one bullet for each under
"Displacement", "Things we do not build" and "Policing", and rewrite the watch's first bullet so it
does not read as circular ("at least two signs, at least one of them from prices themselves: sale
prices, assessed values or the Market Value Analysis").

**D2. A community garden where almost no one lives.** "Start a community garden" is suggested
wherever a lot is farther from a park than half the places on the map, with no regard to neighbors:
281 of its 20,653 lots have fewer than 100 people within a 5 minute walk, 891 fewer than 1,000 (new
developments by the river, the Navy Yard, industrial land near the airport). The card says a garden
"gives neighbors green space". Options: (a) keep it; (b) suggest it only where at least 1,000 people
live within a 5 minute walk (a pipeline change, about 4% fewer gardens); (c) the same with the
seating rule's "more neighbors than at half the places". Recommendation: (b).

**D3. Dollar prices on watch areas.** A tapped watch area shows the middle sale price then and now
in dollars, only for areas where prices are rising, beside a lots layer that can show only lots the
City lists as available. Together that can read as a map of where prices are climbing. The prices are
the City's public records, investors have better sources, and residents understand dollars better
than percentages. Options: (a) keep, and say why in ETHICS.md's Speculation row; (b) show the
change in percent against the city's, without the dollar amounts. Recommendation: (a).

**D4. The parking layer's "at least 3 reporters".** The source check recommended showing a cell only
where its reports come from at least 3 people; Philly Bike Action's data does not say who made each
report, so only the 5 report threshold applies. The busiest cell holds 455 reports, 449 of them on
one sidewalk, very likely from very few people. Philly Bike Action's own public map shows every
report, so the heat map reveals nothing new about anyone. Options: (a) accept, as now; (b) ask
Philly Bike Action for a count of reporters per cell or per week and apply the safeguard; (c) raise
the threshold. Recommendation: (a) for v0.3, and (b) as an owner action.

**D5. How often the full watch card repeats.** ETHICS.md asks for the full card on every greening
card in a watch area, so a lot page can show the same signs and five links up to five times, and
the nearby list once per lot. Options: (a) keep; (b) on the lot page, show the full card once at the
top of "What you can do" and the one line on each card after it, keeping the full card on the nearby
list and in print. (b) needs the owner's agreement because it changes how ETHICS.md is read.
Recommendation: (a) for v0.3, (b) later.

## 8. Tests run

| Suite | Result |
|---|---|
| Pipeline (`pytest`, not live), at 6753223 plus these fixes | 994 passed, 7 live tests deselected |
| ruff check and format | pass |
| `pk registry check` | valid: 9 licenses, 14 groups, 63 sources, 36 layers, 5 lenses, 19 suggestions, 24 routes, 8 partners, 1 options |
| Web unit tests (vitest) | 831 passed |
| svelte-check | 0 errors, 0 warnings |
| Site build (`vite build`) | built |
| End to end (Playwright, phone and desktop, on port 4411) | 117 passed, 7 skipped by design (a test meant for one screen size only), in 10.7 minutes |

## How these checks were made

* Data: `pk publish --offline` into `build/data` from a private cache that links the shared
  snapshots and keeps its own `derived` folder, after running `derive_walk`,
  `derive_placemaking` (as of 2026-10-05) and `derive_displacement` (as of 2026-10-08) with main's
  code: every column of the three derived files equals the shared one. The site was built with
  that data and the base map of 2026-10-04 and served with `vite preview`.
* Lots: chosen from the derived files by their rules (in a watch area with an open 311 request;
  listed as available and side yard eligible outside the watch; `f_park` of 100 with neighbors;
  listed inside a watch area), then followed in the browser: the map, the nearby card, the lot page,
  its print view, and the CSV captured in the page before it was saved.
* Watch: DuckDB 1.x with its spatial extension, from `real_estate_sales`, `assessment_values`,
  `opa_properties` and `census_tracts_2020`, written without the pipeline's code
  (`indep_watch.py`, `indep_assess.py` in the reviewer's scratch folder).
* Walking: the census blocks' internal points and Parks and Recreation's properties, projected to
  UTM zone 18 north, with shapely.
* Docs: read against the code and registry by a second agent and checked here before each fix.

## Decisions taken (owner and orchestrator, 2026-10-08)

| # | Decided by | Decision | Where it now lives |
|---|---|---|---|
| D1 | Owner | Write the v0.3 safeguards into ETHICS.md, as recommended: the placemaking caution and the full card on placemaking cards and the listing box inside watch areas (under "Displacement"); for lots listed as available, no price, no buy button, the side yard route first, only the Land Bank's own map and its note that it may say no (under "Things we do not build"); for the parking reports, counts only, cells about a block across, at least 5 reports in 12 months, evidence for physical fixes and never a word about tickets, the Parking Authority or drivers (under "Policing"). The watch's first bullet now reads "at least two signs, at least one of them from prices themselves: sale prices, assessed values or the Market Value Analysis" | docs/ETHICS.md |
| D2 | Orchestrator | Option (b): suggest a community garden only where at least 1,000 people live within a 5 minute walk, besides being far from a park. On the 2026-10-05 data, 19,762 lots get it, 891 fewer than the 20,653 before | `suggestions_for` in pipeline/src/placekeepers/derive/placemaking.py; DESIGN.md section 5.3, CONTRACTS.md section 4, ROUTES.md, the suggestion's summary |
| D3 | Owner | Option (a): keep the dollar prices on watch areas. They are the City's public records, residents understand dollars better than percentages, and investors have better sources | ETHICS.md, the Speculation row |
| D4 | Orchestrator | Option (a) for v0.3: accept the 5 report threshold. Asking Philly Bike Action for a count of reporters per cell or per week is an owner action, filed by the orchestrator | ETHICS.md, "Policing" |
| D5 | Owner | Option (b), applied to every page and view: inside a watch area the full card is shown once per page or view (at the top of a lot page's "What you can do" and of its print, and above the list of nearby places), and every greening, placemaking and listed lot card there keeps the one line caution pointing to it; a card in the list of nearby places also names its own area's signs, and a card shown on its own keeps the whole card | ETHICS.md "Displacement"; DESIGN.md section 5.3; the "Use this responsibly" page |

Findings F7 (a nearby card for a listed lot now says so and starts with the side yard route where
the lot may go to the neighbor next door, using the lots tiles' new `ly`), F8 (the Market Value
Analysis source now links to the 2026 edition's page on the City's open data hub) and F9 ("Who owns
it" no longer repeats the City list's sentence) were fixed on `agent/polish3` with these decisions.
