# Verification before v0.4: history, then and now, the Land Bank and the rules of each lot

Written 2026-10-09 by the verification agent, before the orchestrator tags v0.4. This is an
adversarial review of everything merged on `main` since the v0.3 tag (cce3b7e), first as of
0dce2b3 and then, as they landed during the review, of af0071b and e4f87dd:

* the story of each lot, one timeline of its records (M4.2, #38: `dossiers/history/`);
* Then and now: the aerial photos of 1959 to 2025, the 1860 atlas and the 1937 redlining map
  (M4.3, #39);
* the page "The Land Bank in numbers" (M4.4, #40: `tables/land_bank.json`);
* the City's bus shelters in the transit lens, street poles and lamps, traffic calming and
  crossing guards (M4.5, #41);
* "Rules for this lot", appeals and hearings, and the "Land rules and hearings" layers (M4.6, #42);
* rents, incomes and empty homes on the watch card, cooling and warming centers, playgrounds
  (M4.7, #43, merged at af0071b);
* the sixth sign of the displacement watch, rent burden, and the v0.4 release documents
  (e4f87dd).

The v0.3 review is [VERIFICATION_V0_3.md](VERIFICATION_V0_3.md).

**What was checked.** Three local offline publishes from the shared snapshots into this
worktree's own folder (at 0dce2b3, af0071b and e4f87dd, the last with the derived files rebuilt
on e4f87dd), each from a private cache that links the shared snapshots, under the heavy lock; the
production build of the site on that data and the base map of 2026-10-09, served on port 5192 and
driven with headless Playwright at 375 and 1280 wide (screenshots in `web/test-results/v04/`,
not committed); four lots followed end to end with live City data off and on; the Land Bank
page recounted from the City's own deed records for 2019 and 2024; three tracts of the watch card
recomputed from the Census Bureau's own files; the rent burden sign and the watch recounted for
all 408 tracts; every published file searched for appellants' names; the docs, the content pages,
the registry and the release notes read against the code and the data, with help from a second
agent.

## In short

What changes for the owner, most important first:

1. **Names from appeals stay on the lot's own page.** Every one of the 6,869 distinctive names of
   people or firms who filed appeals on our lot pages was searched for in every other published
   file (the 933 history shards, the tables, the manifest) and in the decoded hearings tiles: none
   is there. The map's hearings carry the day, the board, the address and the community
   organization only; the printed lot page has the hearing and no name; downloads have no appeal
   field. Five lot pages show an email address the City typed into "who filed it"; the owner
   decided to show the field as the City publishes it (Q1).
2. **No picture is asked for until someone asks, and never with live data off.** A first visit
   asks no server but the site's own. With live data off, neither a link nor saved settings can
   turn the photos or the atlas on (checked at both sizes), and turning live data off while the
   photos show stops every request. The lot page button asks only for the 1959 service.
3. **A misleading sentence on up to 2,850 lot pages, fixed.** The story of a lot said "A
   building stood here until 2014, when the City demolished it." and then "The City cleaned and
   sealed the building here in 2019." (4465 Frankford Ave): the 2019 record is the City's crews
   cleaning the empty lot. On vacant land with no building in any record (5419 Lena St) it also
   spoke of "the building". The story now leaves the seal out after a demolition and says "The
   City sent its clean and seal crews here" (af9cdbb, 7855ad7, with tests).
4. **The numbers agree.** The Land Bank page's 2019 and 2024, recounted from the City's deed
   records with our own code, match to the property (163 and 352, prices, buyers and districts),
   except one 2019 deed from PHDC whose name the records misspell; the misspellings are now
   recognized (af9cdbb). The watch card's rent burden, rent, income and empty homes match the
   Census Bureau's files for three tracts and the city. The rent burden sign holds in 105 tracts
   and the watch has 104 areas, as published. 462 City shelters at 451 stops, 393 stops scored
   lower: as DESIGN says.
5. **Licenses hold.** The 1937 redlining data is in `tiles/redlining.pmtiles` alone, named with
   its license in the manifest, in no dossier, table or download. Every new source has a license
   and an attribution in the registry. The cooling and warming sites show no credit in the legend or the tile file, and
   stay on the Data status page.
6. **Weight is fine.** The site is 311 MB of GitHub Pages' 1 GB; the largest file is the base map
   (47 MB of the 100 MB limit), the largest data file the streets tiles (13.1 MB). A first visit
   loads 2.0 MB before tiles, 0.53 MB compressed.
7. **Accessible.** axe finds nothing on the lot page with its rules and timeline, the Then and now,
   redlining and cooling legends, the Land Bank page and the Data status page, at both sizes. The
   year slider has its label, says the year to screen readers and moves by keyboard; the timeline
   switches are checkboxes in a fieldset with a legend and work with the space bar.
8. **Docs agree with the code after a round of fixes**, listed in section 5, including two
   sentences of the release documents.

Commits on `agent/verify4`: 557fabc, af9cdbb, 9792ed4, b0002a9, 7855ad7, the report (1eb21c1)
and, after the owner's answers of 2026-10-10, the F2 fix with the decisions recorded (plus two
merges of main). Test results are in section 8. No contract changed.

## 1. Four lots, end to end

Each lot was opened from a link with live City data off and then on, at phone and desktop sizes.
The timeline and the appeals read the same with live data on and off on all four lots at both
sizes (the live version comes straight from the City's tables, the ones atlas.phila.gov shows).

| Lot | Why chosen | What the page says | Checked against |
|---|---|---|---|
| 5419 Lena St (122138300), Germantown | A hearing still to come, historic | At the top: "A zoning hearing about this lot is set for February 10, 2027, at 9:30 AM." with the Zoning Board's page; in the Germantown Urban Village historic district (designated February 9, 2024) and on the Register as part of it, the Commission first, its phone; RSA-5 with three overlays (/EDO, /NCA, /NIS), each with its Code section; the appeal with its RCO (Baynton Hill Neighbors), who filed and the owner named, and "Names ... appear on this lot's page only" | The City's appeals table live; the print has the hearing and no name; the "Appeals (1)" switch toggles with the space bar |
| 648 N Yewdall St (041125650), Haddington | Watch area, near a brownfield, garden suggested | The full watch card once, the one line caution on each card; on "Start a community garden" the owner's soil sentence word for word, with the soil test and the EPA's guide; "Brownfield records" names the EPA record about 300 feet away (91 m) and says the records do not say what is in the ground today | Distance from the dossier; the soil note is also on all 5 garden cards of the field view's nearby list at 904 Nectarine St |
| 4465 Frankford Ave (232487100), Frankford | City demolition and later records | "A building stood here until 2014, when the City demolished it." then, after the fix, "It was sold at a sheriff sale in 2016."; 13 violations on 8 days, the 2023 zoning permit, the 2014 demolition, the 2019 clean and seal, the two lists, the two sheriff deeds | Every L&I record the City's tables hold for the parcel, fetched live: the same days, titles and statuses |
| 2647 N 6th St (192283100), Fairhill | The issue's example for Then and now | "See this lot in old aerial photos" opens the map at the lot with the 1959 photos; the nearest playground (Fairhill Square, about 290 meters, within a 5 minute walk) | Requests: only `CityImagery_1959_DVRPC` tiles; the slider then moved by keyboard to 2025 and back to 1999 |

## 2. Recomputed independently

**The Land Bank in numbers.** All 21,424 deed rows the page's source reads, fetched again from the
City's `rtt_summary` with the names, classified by our own reading of DESIGN 5.10 (plain deeds,
sellers all agencies, a buyer outside them; agreements and moves apart; a deed for property
already in private hands, or a miscellaneous deed with no earlier record, not counted; each
property once per buyer, or once a year), with each property's own deed history fetched for the
release rule. Names were kept only in the reviewer's scratch folder.

| Year | Counted, page | Counted, ours | Middle price | Token price ($100 or less) | Districts |
|---|---|---|---|---|---|
| 2019, all agencies | 163 (PRA 130, PLB 23, PUB 8, PHDC 2) | 164 (PHDC 3) | $0 both | 113 of 139 priced; ours 114 of 140 | Same in all ten, 9 with none |
| 2024, all agencies | 352 (PLB 270, PRA 50, PUB 22, PHDC 10) | 352, the same | $100 both | 257 of 351 both | Same in all ten, 5 with none |

Over all years ours counts 3,247 against the page's 3,235: 3 are PHDC deeds whose name the
records misspell ("PHILADLEPHIA", "PHILADELPIA", "PHILADEPHIA"), which the pipeline missed, and 9
are our own mistakes (a bank named "LAKELAND BANK", a "1260 HOUSING DEVELOPMENT CORPORATION").
Across the whole table, broader name patterns turn 7 more rows into conveyances and 2 into moves
between agencies; they are fixed in af9cdbb and take effect with the next weekly download. Buyer
types were not typed again (our quick rule differs from the lot pages' owner rule by design); the
page's buyer counts match a DuckDB aggregation of the snapshot exactly.

**The watch card (M4.7).** From the Census Bureau's own table files, B25070, B25064, B19013 and
B25002, fetched again for tracts 177.02, 247 and 168 and the city:

| Tract | Rent burden (half their income or more) | Middle rent | Middle income | Empty homes |
|---|---|---|---|---|
| 177.02 | 45.2%, give or take 15.1 (390 of 862) | $1,171 ± 76 | $24,420 ± 19,458 | 351 of 1,841, 19.1% ± 7.3 |
| 247 | 41.7% ± 18.8 (350 of 839) | $1,072 ± 131 | $52,105 ± 27,272 | 177 of 1,997, 8.9% ± 5.2 |
| 168 | 26.5% ± 18.6 (145 of 547) | $973 ± 187 | $39,398 ± 9,832 | 265 of 1,704, 15.6% ± 7.8 |
| City | 29.5% ± 1.0 | $1,397 ± 14 | $61,953 ± 919 | 9.2% ± 0.4 |

Each equals `derived/tract_context.parquet` exactly, and tract 177.02's watch tile carries 45 ± 15,
$1,171, $24,420 and 19% ± 7, as the card rounds them. The Census API now asks for a key, so the
summary files were read instead, three tracts' lines only.

**The rent burden sign.** Recomputed from the `acs_rent_burden` snapshot: 105 tracts hold it (39.5%
or more with at least 100 renter households, the shares rounded to a tenth as the card shows
them), and with the other five signs as published, 104 tracts are watch areas, 8 of them new:
the same, tract by tract. One tract (220) holds the sign only because 39.46% rounds to 39.5%; it
has no other sign, so the watch does not change (finding F9).

## 3. Privacy, ethics and licenses

| Rule | How it was checked | Result |
|---|---|---|
| Names from appeals only on the lot's own page | 6,869 distinctive appellant names from the 82,248 dossiers, searched for in every other published file and the decoded `rules.pmtiles`; print and downloads in the browser | None outside the dossier shards; the five matches in `tables/owners.json` are organizations listed there as owners, from OPA, as before. Five appellant fields hold an email address (Q1) |
| No new third party request at default settings | Every request of a first visit, of the four lot pages, of the Land Bank page | Only the site itself; with live data on, a lot page also asks `phl.carto.com`, as before |
| The picture gate | Saved settings naming the photos and the atlas with live data off; live data turned off in Settings while the photos show; a link with live data off (the end to end test) | No request to `tiles.arcgis.com` in any of them, and the address bar drops the layers |
| Redlining kept apart | The manifest, every published file, the downloads' code, the built JavaScript | Only `tiles/redlining.pmtiles`, marked `cc_by_nc_2_5` in the manifest; the bundle holds the registry's source address only |
| Every new source has a license and an attribution | The registry, `pk registry check`, the Data status page | Yes (the cooling sites' attribution is kept for the Data status page only); the Data status page marks the redlining source "Non commercial use only" and lists the picture services' weekly check |
| Cooling sites without a credit line | The legend, the tile file's attribution, the Data status page | No publisher in the legend or in `places.pmtiles`' attribution; the source stays on the Data status page. The layer's closed "About this layer" fold names the Office of Emergency Management as the source's publisher, as DESIGN describes (Q3) |
| Brownfield wording | Every string, layer and content page | Never "clean" or "safe"; the owner's sentence word for word on the lot page and on every garden card near one, and since F2 in the downloads and the printed sheet |
| No enforcement wording | The new strings, layers and suggestions | None; crossing guards are a safety service |
| Build Philly Now | The registry, the code, the docs | Never a source; named only as the review that started M4.5 to M4.7 |

## 4. Accessibility and phones

* **axe** (WCAG 2.0 to 2.2, A and AA, and best practices) found nothing on: the lot page of 5419
  Lena St with its rules, appeals and timeline open; the layer panel with Then and now and the
  year slider; the redlining legend; the cooling and playgrounds layers; the Land Bank page; the
  Data status page; at 375 and 1280 wide.
* **Keyboard.** The year slider: label "Year", described as "From 1959 to 2025", screen readers
  hear the year (`aria-valuetext`), End goes to 2025, Home to 1959, the arrows step a year of the
  list. The timeline switches: each a checkbox inside its label ("Appeals (1)") in a fieldset with
  the legend "Show in the timeline"; space turns it off and on.
* **Phones.** The Land Bank page scrolls nothing sideways at 375 wide; the lot pages, the legends
  and the field view's cards read top to bottom.

## 5. Docs

Read against the code and the registry with a second agent, and checked here before each fix.
Fixed:

* DESIGN.md: Then and now has three layers and 23 years, the photos of 2000 and earlier are black
  and white, the legend credits each year's publisher; a raster layer can draw several sources; a
  picture is known by its layer and its year setting; "95 percent of the 130,241 lamps" counts
  poles; the lens table and the transit lens's own words say a City shelter counts as a shelter;
  the street light factor was left out when M4.5 merged; the clean and seal rule of the story; a
  new open owner item for the Athenaeum (557fabc, 9792ed4, the merge).
* CONTRACTS.md: `raster` among the geometries, the redlining map in `then_and_now` (557fabc).
* DATA_SOURCES.md: the 304 poles of other owners (557fabc).
* pipeline/README.md: the Phase 4 sources, tile files, history shards and the Land Bank table,
  and the picture services' weekly check (9792ed4).
* content: the Privacy page and the live data setting name the appeals a lot page asks for; "Use
  this responsibly" says where names from appeals appear; the Contact page says the City lists its
  shelters (9792ed4).
* registry/sources.yaml: a comment of Then and now sat inside the Land Bank dashboard's entry
  (557fabc).
* Release documents: README said the redlining map loads from the City's servers; the release
  notes said only 1996 and 2000 are black and white (b0002a9).
* The release notes' rules counts (77,290 with overlays, 3,744 near a brownfield, 7,427 with
  appeals) come from the live build of 2026-10-10 01:15 UTC; the shared snapshots give 77,263,
  3,739 and 7,422 (CONTRACTS.md quotes those). Both are right for their data. Every other number in
  the release notes and the changelog matches this review's publish of e4f87dd.

No dash is used as punctuation in any doc, content page, registry text or interface string
changed since v0.3, nor in the commit messages; the only hits are names of statuses and appeal
kinds that the City itself writes with a spaced hyphen, quoted as the City writes them.

## 6. Weight

| File | v0.3 | This build (e4f87dd) |
|---|---|---|
| tiles/streets.pmtiles | 11.6 MB | 13.1 MB |
| tiles/lots.pmtiles | 9.6 MB | 9.7 MB |
| tiles/rules.pmtiles | not yet | 6.1 MB |
| tiles/transit.pmtiles | 4.3 MB | 4.6 MB |
| tiles/poles.pmtiles | not yet | 2.3 MB |
| tiles/places.pmtiles | 0.2 MB | 0.4 MB |
| tiles/redlining.pmtiles | not yet | 0.1 MB |
| the other twelve tile files | 10.6 MB | 10.6 MB |
| dossiers (933 files) | 130.7 MB | 152.4 MB |
| dossiers/history (933 files) | not yet | 57.5 MB; the largest 852 kB, 107 kB compressed |
| The whole site with the base map | 213 MB | 311 MB |

First visit, before tiles: 2.0 MB (0.53 MB compressed), mostly the map code (1.06 MB).

## 7. For the release step

* README, CHANGELOG, the release notes and the banner ("Version 0.4") are written (e4f87dd).
* The Land Bank's misspelled names (af9cdbb) change its counts by about 10 properties at the next
  weekly download; the release notes' 3,235 and 1,032 are the counts of 2026-10-09.

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| F1 | Must fix before v0.4 | The story of a lot said the City sealed "the building" after the same page said it was demolished (2,854 lots have a seal after a demolition), or where no record shows a building | 4465 Frankford Ave, 5419 Lena St | **Fixed** af9cdbb, 7855ad7, with tests |
| F2 | Should fix | The CSV and GeoJSON downloads gave "Start a community garden" for a lot near a brownfield without the soil note, and the printed sheet left it to the rules part; ETHICS names the lot page and the nearby cards only | `web/src/places/export.ts`, `web/src/dossier/print.ts`; 828 dossiers have both | **Fixed** (orchestrator's request, 2026-10-10): a `soil_note` column beside `suggestion` in both downloads, and the note under the garden suggestion on the printed sheet, with tests |
| F3 | Should fix | The Land Bank count missed deeds whose agency name is misspelled (3 conveyances, 1 move by our count) | Section 2 | **Fixed** af9cdbb, from the next download |
| F4 | Should fix | Stale docs and pages, section 5 | | **Fixed** |
| F5 | Later | A timeline switch counts rows, not records: "Violations (8)" where the City lists 13 violations on 8 days, beside "7 violations recorded since 2016" | 4465 Frankford Ave | Say "(8 days)" or count records |
| F6 | Later | Twelve code comments credit the names limit to ETHICS.md, where only the owner's "show it all" lives; the limit is the orchestrator's, in DESIGN 5.6 | `adapters/rules.py`, `derive/appeals.py`, `publish/rules.py`, `web/src/dossier/rules.ts` and others | Point them to DESIGN 5.6 |
| F7 | Later | The old photos button said 1959 is "the oldest the City hosts"; it also hosts 1928 photos that wait for permission | strings.ts | **Fixed** af9cdbb ("the oldest on this map") |
| F8 | Later | The About page's privacy section does not mention the picture server; ROUTES.md and the How page have no entry for the Commission, hearings or a soil test | content/about.md, docs/ROUTES.md | Write them in the next interface round |
| F9 | Info | The rent burden sign compares shares rounded to a tenth: tract 220 holds it at 39.46% | Section 2 | None needed now; it changes no watch area |
| F10 | Info | A deed whose only agency seller is misspelled in a way the source's filter misses ("CITY OF PHIADELPHIA") is never downloaded; all 481 such rows today belong to one condemnation | registry `land_conveyances` | None |

## Questions for the owner, decided

The owner answered on 2026-10-10.

| # | Question | Decision | Where it now lives |
|---|---|---|---|
| Q1 | Five lot pages show an appeal whose "filed by" field, as the City typed it, holds an email address beside the names (twelve in the City's whole table). Keep, or remove emails and phone numbers? | Show the field as the City publishes it, email addresses and phone numbers included. No code change | ETHICS.md, "Appeals and hearings": "This includes any email address or phone number the City typed into that field (owner, 2026-10-10)." |
| Q2 | Three passages added to ETHICS.md on 2026-10-09 read as description or reasoning: the risk row "False comfort about soil", the clause explaining why the wording is never "clean" or "safe", and the Privacy line about live appeals | Keep the Privacy line, a privacy promise like the rest of that list. Move the risk row and the explanation to DESIGN.md 5.6, leaving the owner's decided wording in ETHICS.md | DESIGN.md 5.6, "Rules for this lot, as built"; ETHICS.md points to it |
| Q3 | The cooling sites' closed "About this layer" fold names the Office of Emergency Management as the source's publisher; the legend, a tapped site and the tile file name none | Keep the publisher named there, with no credit line anywhere else | DATA_SOURCES.md, the warming and cooling sites |

## 8. Tests run

| Suite | Result |
|---|---|
| Pipeline (`pytest`, not live), at e4f87dd plus these fixes | 1,190 passed, 7 live tests deselected (twice: before and after the F2 fix) |
| ruff check and format | pass |
| `pk registry check` | valid: 11 licenses, 16 groups, 89 sources, 50 layers, 5 lenses, 19 suggestions, 24 routes, 8 partners, 1 options |
| Web unit tests (vitest) | 994 passed; 998 after the F2 fix |
| svelte-check | 0 errors, 0 warnings |
| Site build (`vite build`) | built |
| End to end (Playwright, phone and desktop) | 143 passed, 7 skipped by design (a test meant for one screen size only), in 11.4 minutes, on port 4419; after the F2 fix, the lot page, analysis (downloads) and privacy specs again: 46 passed |

## How these checks were made

* Data: `pk publish --offline --as-of 2026-10-09` into `build/data`, from a private cache under the
  scratch folder that links the shared snapshots and keeps its own copy of `derived/` (the last
  copy taken after the orchestrator rebuilt it on e4f87dd). The site was built with that data and
  the base map of 2026-10-09 and served with `vite preview --port 5192`.
* Browser: Playwright's Chromium, headless, at 375 by 812 (as a phone) and 1280 by 800, with
  every request recorded; screenshots under `web/test-results/v04/`.
* Land Bank: the City's Carto SQL API, with the project's User-Agent, three requests for the
  deeds and seven for the properties' histories; our own Python, independent of the pipeline's.
* Census: the Census Bureau's table based summary files, streamed, keeping three tracts' lines.
* Names: every appellant name of two words or more and 10 letters or more, other than City bodies,
  searched for with a fixed string search; `tippecanoe-decode` for the hearings tiles.
