# Verification before v0.1: data and ethics (M1.10, first half)

Written 2026-10-04 by the verification agent, for issue #13. This is the first half of milestone
M1.10: an adversarial review of the published data and of the rules in [ETHICS.md](ETHICS.md). The
second half (accessibility, keyboard, app size, end to end tests on phone and desktop) follows once
the interface work (M1.7) is merged; what to check then is listed at the end.

**What was checked.** Two builds of the published files:

* **Live**: the site as deployed on 2026-10-05 at 00:08 UTC (build `2026-10-05T00-08-31Z-0658182`,
  from `main` at 0658182), every file downloaded: the manifest, all 5 tile files, all 929 dossier
  shards, `dossiers/common.json` and `tables/owners.json`.
* **Local**: an offline publish of the same commit from the shared cache, and a second one with the
  fixes below. The two local builds and the live build agree on every count that does not depend on
  the day's downloads (77,863 dossiers, 58,325 parcels on the map, 928 memorial markers).

City records were read sequentially and slowly from the City's Carto SQL API and its ArcGIS
services, with the project User-Agent, about 40 requests in all.

## In short

What the owner will see change, most important first:

1. **No name of a person killed can reach the map until the removal email exists.** Today the map
   shows no names, and the memorial file has never held one, but nothing stopped a name added to
   `memorials.yaml` from going live at the next weekly refresh (the refresh runs even when the
   tests fail). Publishing now holds every name back while the removal address is unset.
   **Fixed** (b91f898).
2. **About 2,200 parcels the City's records call someone's home are offered conservatorship.**
   2,186 parcels whose lot page lists the conservatorship route carry an owner occupied homestead
   exemption in the City's records, meaning someone has told the City they live there (or did, and
   has since died). 1,552 of the 6,597 buildings the map calls "very likely vacant" have one. This
   is exactly the misuse ETHICS.md warns about. **Owner decision needed** (D1).
3. **The public data-snapshots release republishes more than the map does**: parcel level tax debt
   for all 581,450 parcels in the city (data the City itself has since restricted), every owner's
   name and mailing address with the homestead flag, L&I case numbers and 311 ticket numbers, and
   Police vehicle descriptions such as "Auto (Stolen)" and "Auto (Police)". **Decision needed** (D2).
4. **5,328 parcels on the map (9%) have lot pages that wrongly say "No deeds on record."** Their deed
   history, assessments and full L&I records are never downloaded, because they reach the map
   through a vacancy complaint, which is not one of the signals that decide what to download. With
   live City data on (the default) the page is corrected when it opens. **Should fix** (D9).
5. **Public bodies typed as people**: PennDOT, the District Attorney's Office, the Industrial
   Development Authority and others got the flags meant for a person, the deed fraud notice, a
   place in the owners table, and on 45 parcels the conservatorship route. **Fixed** (c6663a8).
6. Everything else held up: the City's records match our lot pages field by field (394 of 400
   fields on 20 parcels; the 6 that differ are item 4), the violence lens and street safety numbers
   recompute exactly from the City's data, the newest Police record is on the map, and no published
   file holds anything ETHICS.md rules out. A new test now checks every published file on every
   change.

Commits on `agent/verify`: b91f898, 125282e, c6663a8, 353e9b7, 1c4ddb8. Tests: 583 pass (not
live), ruff check and format pass, `pk registry check` passes. One contract change: names wait for
the removal address (CONTRACTS.md section 5).

## Names of people killed: can any reach the map today?

Checked as the coordinator asked (owner decision, 2026-10-04: names stay off the map until the
removal email exists). **No name can appear in any published file today**, and the one way one could
have is now closed.

| Way a name could reach a published file | What was found | Result |
|---|---|---|
| An entry in `data/curated/memorials.yaml` | The file is `[]` and has been since the founding commit (`git log -p`); nothing else writes names | Was open: any entry would have been published at the next weekly refresh. **Closed** (b91f898): publishing reads `REMOVAL_EMAIL` from `web/src/content/removal-email.ts`, its one place, and while it is null, missing or unreadable, no `nm`, no `src` and no marker from a curated entry is published; the build notes say how many names wait. A test pins today's repository to "no address" |
| The live memorial tiles | 928 markers with only `id`, `d`, `m`, `pl`, `sg`; no `nm` or `src` attribute in the features or in the tile metadata samples | None |
| The Police place text (`pl`) | All 928 values read as streets and blocks; house numbers became blocks | None |
| The memorial names snapshot on the public release | Held each entry's memorial page link, which names the person (the test fixture's own link ends in the name), and kept entries listed as removed | **Closed** (125282e): links and removed entries are left out |
| Test fixtures with invented names | `web/fixtures/` is not copied into the site (Vite copies only `web/public/`) | None |
| Live City lookups from the browser | The lot page only counts fatal crashes near a parcel | None |
| The "show names" path in the browser | `describeMemorial` returns no name when `nm` is absent; the popup shows the date, the mode and the place | Nothing renders. The legend still says "A fuller ring means a public memorial list shares the person's name": see interface checks |
| Git history, once names are added (M1.9) | `memorials.yaml` is in a public repository, so a removed name would stay in its history | Not today; **decision needed** before M1.9 (D8) |

## 1. ETHICS.md, rule by rule

"Test" names the guard in `pipeline/tests` that keeps the rule true on every change; "by hand"
means it was checked for this report only.

| Rule | How it was checked | Result | Guard |
|---|---|---|---|
| Owner names and mailing address as the City publishes them | 20 parcels against `opa_properties_public` | All 20 match | `test_dossiers.py` (fixtures); by hand against the City |
| Each flag "shown as" in the ETHICS.md table | Every one of the 178,482 flag sentences on the live site against its form ("The owner gets mail somewhere else" with the place, "Last sold in 1987", "This owner holds 41 vacant parcels in the city", "Sold 3 times since 2024") | All match | `test_wording.py`, `test_flags.py` |
| Every flag has three parts | `dossiers/common.json`: every flag id has its careful note and next step | Yes | `test_flags.py` |
| "Possible estate" word for word | The 62 live flags, joined with their notes in `common.json`; `content/responsibly.md`; the web app's strings | Word for word everywhere. DESIGN.md section 9 paraphrases it (internal, but a builder could copy it): see findings | `test_ethics_outputs.py`, `test_wording.py` |
| Never "owner deceased" or "no heirs" | Every value in every published file | Never | `test_ethics_outputs.py` |
| Deed fraud notice with any individual owner flag | Every live dossier whose owner is a person or a possible estate and has a flag | 0 missing | `test_ethics_outputs.py`, `test_flags.py` |
| Fraud Guard and Tangled Title links on every flagged dossier | Every live dossier of a private owner with a flag | 0 missing. Public owners with a flag get none, as DESIGN 5.6 chose (deed theft is about people) | `test_dossiers.py` |
| Conservatorship note word for word, on every mention | `registry/routes.yaml`, the web app's strings, `content/how.md`, `content/responsibly.md` | Word for word | `test_wording.py`; web tests |
| Conservatorship only where DESIGN allows (private, vacant with high or medium confidence) | All 31,715 live conservatorship routes | All within the rule. But 2,186 are on parcels with a homestead exemption (D1), and 45 were on public land typed as people (fixed) | `test_ethics_outputs.py` |
| No price estimate, no ease of acquisition sort or filter, no buy button, no automatic letters | Every key and value of every published file; registry; site text | None in the data. `content/how.md` describes buying as one route ("Buy it. An ordinary purchase") with no price; acceptable. The interface sorts and filters of M1.7 still need checking | `test_ethics_outputs.py`; interface: by hand later |
| Bulk export with a first line pointing to the terms | Not built yet (M1.7) | Interface check | Later |
| Names only from `memorials.yaml`, never scraped | See the section above | Yes, and now held back until the removal email exists | `test_streets_publish.py`, `test_ethics_outputs.py` |
| No driver details, case numbers or arrest information | Memorial and crash layers on the live site; the fatal crash adapter's columns | None in the map files. The release snapshot keeps the Police vehicle descriptions (D2) | `test_streets_publish.py`, `test_ethics_outputs.py` |
| Quiet marker | `web/src/map/styles/palette.ts`: white fill, muted purple ring, no red | Quiet | By hand |
| Memorial suggestions say "only with the family's blessing" | All 928 markers list the memorial suggestion first; the web app adds the line | Yes in the data; the line itself is an interface check | `test_memorials.py`; interface later |
| "Show names" setting, on by default | `registry/layers.yaml` | Present, default on | Web tests |
| Removal: a removed id never returns | A fixture build with one curated name and one Police marker removed, then every published file searched | Gone from every file, manifest included | `test_ethics_outputs.py` (new), `test_streets_publish.py` |
| No names for shooting victims | Shootings adapter keeps date, fatal, point only | None | `test_carto.py` |
| Shootings as hexagon counts for 12 and 36 months | 5 random hexagons and the 2 busiest recounted from the City's `shootings` table | All 7 match exactly (section 4.2) | `test_h3.py`; by hand against the City |
| Point layer off by default | No point layer is built in v0.1 | Stricter than the rule. The release snapshot holds the points (D2) | By hand |
| Never race, age or sex per point | Never downloaded; no such key anywhere | None | `test_carto.py`, `test_ethics_outputs.py` |
| Never "dangerous", "high crime", "hot spot" | Every published value; registry, content pages, strings | Only "imminently dangerous", L&I's own term for a building | `test_ethics_outputs.py` (data); by hand (text) |
| Never rank neighborhoods by violence | No boundary layer carries counts; the lens ranks parcels for care | Yes in the data; area summaries in M1.7 to check | By hand |
| Never suggest police; 311 for physical conditions only | Suggestions, routes, site text | None. `content/how.md` names "the police district" as a step of the City's block party permit: a process fact, not enforcement (finding F18) | `test_wording.py`, `test_ethics_outputs.py`; by hand |
| Nothing about people experiencing homelessness | Site text, registry, data | None | By hand |
| Displacement caution on greening cards in displacement watch areas | The watch overlay is a later release | Nothing to attach the caution to in v0.1 (D12). Built by M4.1 (2026-10-08): the full card in watch areas, the one line caution elsewhere | `web/tests/displacement.test.ts`, `e2e/displacement.spec.ts`, `pipeline/tests/test_displacement.py` |
| No analytics, cookies, accounts or tracking | The live site's scripts | None (section 6) | By hand |
| "Fetch live City data" on by default and disclosed | `registry/options.yaml`, About and Privacy pages | Disclosed on both pages | By hand; interface later |
| Every derived fact shows source, date, confidence; vacancy lists its reasons | Reasons travel as `rs` bits in tiles and dossiers; 20 parcels' reasons checked against City records | Reasons agree with the City's records (section 4.1) | `test_vacancy.py`; interface later |
| "Report a correction" opens a prefilled GitHub issue | `content/contact.md` links the correction form | Yes | Interface later |
| Terms of use | `content/terms.md` | Covers the ETHICS.md summary | By hand |

## 2. What we publish about owners who are people

The owner decided to show everything we can compute, and every item below is within ETHICS.md as
written. Where a rule looks too weak, it is listed under "Decisions needed"; no rule was changed.

| What | How much (live) | Within the rules? |
|---|---|---|
| Names and mailing address as the City publishes them | 41,668 dossiers of individual owners, 41,611 with a mailing address (87 with a "care of" line) | Yes. Note that 22,217 of them (53%) are parcels we do not call likely vacant (11,879 not vacant at all, 10,338 low confidence), so many are probably lived in homes, published as static files anyone can download in bulk (D5) |
| Mail elsewhere | 19,386 individual owners | Yes; never for an owner on the parcel's own block |
| Tax debt as of July 2025 | 11,110 individual owners | Yes, dated with a Tax Center link. The City restricted parcel level tax data after this snapshot was taken (D5) |
| Possible estate | 62 parcels (64 after the fix below); 18 of them on parcels not called vacant or low confidence | Yes; protective wording word for word. Flags on possibly lived in homes help deed thieves as much as families (D6) |
| Owners table (`tables/owners.json`) | 464 owners with 5 or more vacant parcels, each with every parcel; 94 are typed as people (92 after the fix below): about 76 people listed by name, the rest organizations whose names OPA cut short | Yes ("with a link to the list"), but it is one public, bulk downloadable, search indexable list of private people's holdings (D3) |
| Deed history: names of sellers and buyers | 422,523 names (up to 10 per side per deed) | DESIGN says "from and to"; CONTRACTS section 6 also says no "personal details beyond the owner names and mailing address". The two need reconciling (D4) |
| Help and the deed fraud notice | On every dossier where the rules require them | Yes |

**Owner type errors found.** 167 parcels citywide (108 with a dossier) are owned by public bodies
whose names OPA writes many ways or cuts at 25 characters ("PHILA AUTH IND DEV", "PHILADELPHIA
AUTHORITY FO", "PENNDOT", "OFFICE OF THE DISTRICT AT", "PHILADELPHIA REGIONAL POR", "REDEVEL AUTH
OF PHILA", "PENNSYLVANIA HOUSING FINANCE AGENCY"). Typed as people or as unknown, they got the flags
about a person, the deed fraud notice, a place in the owners table, and on 45 parcels the
conservatorship route, which is for private property. **Fixed** (c6663a8): every type change was read
by hand; similar private names stay private. Separately, about 720 parcels typed as people belong to
organizations whose names OPA cut short ("NORRIS SQUARE NEIGHBORHOO", "PROJECT H O M E", "IGLESIA DE
DIOS PENTECOST"); they get "looks like a person's name" and the deed fraud notice (finding F10, later).

**Possible estate missed.** A person's estate written OPA's way ("ESPADA MILAGROS ESTATE OF") was read
as running on into a second owner name that is a bank or a trust, so no flag was shown. 4 parcels
citywide. **Fixed** (353e9b7).

## 3. The public data copies (`data-snapshots` release)

The weekly refresh keeps the last good snapshot of every source as a public release asset (37
snapshot files of 361 MB, plus the manifest and the 50 MB base map). Each holds exactly what the
adapters keep in the shared cache. Checked against what ETHICS.md lets us publish:

| Snapshot | What it holds that the map does not publish | Concern |
|---|---|---|
| `cagp_tax_2025` | Tax due, years owed, payment agreement and sheriff sale flags for all 581,450 parcels (46,634 owing) | The City restricted parcel level tax data after this snapshot; the map shows it only on candidate parcels, dated. A citywide table of who owes taxes, including people on payment plans, is far beyond that |
| `opa_properties` | Every owner's name and mailing address for all 583,783 parcels, with the homestead exemption (who lives in their own home) | The City publishes this itself, but the map needs it for about 78,000 parcels |
| `li_violations`, `li_complaints`, `li_unsafe`, `li_imminently_dangerous`, `li_clean_and_seal`, `li_demolitions`, `li_permits` | L&I case, violation, complaint, work order and permit numbers; 311 ticket numbers on 158,309 complaints | CONTRACTS.md: "L&I case numbers are never published" (said of dossiers) |
| `fatal_crashes` | The Police vehicle descriptions word for word ("Auto (Stolen)", "Auto (Police)", "PFD Medic 8", "SEPTA Bus"), exact house numbers on 207 records, exact points | ETHICS.md: no driver details. The map publishes only the mode and the block |
| `shootings` | Every victim since 2015 as a block point with the date and whether fatal | ETHICS.md keeps points behind a setting that is off by default; the release is a point file anyone can download |
| `real_estate_transfers`, `vacant_indicators_*` | Seller, buyer and owner names | Public City records; same question as D4 |
| `memorial_names` | Memorial page links (they name the person) and removed entries | **Fixed** (125282e) |

No snapshot holds race, age or sex, Police case or control numbers, narratives, or arrest details:
those are never downloaded. What to do about the rest is decision D2.

## 4. Data spot checks against the City's own records

### 4.1 Twenty parcels, field by field

A seeded random draw (seed 20261004) from the live files, one parcel per stratum: lots and buildings
at high, medium and low confidence; every first step `rt` 1 to 5; owners who are people, companies,
the City, the Land Bank, the Redevelopment Authority, the housing authority, a nonprofit, another
public body and an unknown name; four parcels drawn as points (issue #22); and one with a sheriff
sale. Each was compared with `opa_properties_public`, `rtt_summary`, `assessments`, `violations`,
`unsafe`, `imm_dang`, `demolitions`, `clean_seal`, `permits` and `complaints` on Carto, and with the
City's vacancy lists, LAMAAssets and PHS LandCare on ArcGIS: address, owner names, mailing address,
owner type (dossier and `ot`), LandCare (`lc`), the mail elsewhere flag, the reasons the City's
records can confirm (`rs` bits 0, 1, 2 and 11, and by reading bits 4, 5, 7, 8, 10, 12, 13 and 16
with `dy`, `sy`, `ny`), open and total violations, last violation, unsafe, imminently dangerous,
last seal, last demolition, every assessment, and every deed (date, type, price).

| Parcel | Stratum | Result |
|---|---|---|
| 192111000 | lot, high, person | match |
| 071080100 | lot, high, company | match |
| 281410800 | lot, medium, person | match |
| 243185410 | lot, medium, Land Bank (deed for 1,047 parcels) | match |
| 291048012 | lot, low, company | **5 differ**: no deeds, assessments or violations in our dossier; the City has 3 deeds, 5 assessments and 2 open violations (D9) |
| 885000600 | lot, low, person | match |
| 232297900 | building, high, person, unsafe | match |
| 882920841 | building, high, company | match |
| 513179300 | building, medium, person | match |
| 371205001 | building, low, housing authority | **1 differs**: no assessments in our dossier (D9) |
| 882017990 | building, low, nonprofit | match |
| 191312701 | building, low, unknown owner | match |
| 401285700 | lot, high, LandCare | match |
| 161187601 | lot, medium, LandCare, City | match |
| 371453201 | lot, high, City | match |
| 453362901 | lot, Redevelopment Authority, point | match |
| 875101130 | lot, other public body, point | match |
| 291134500 | lot, housing authority, point | match |
| 773000007 | building, nonprofit, point | match |
| 102405100 | building, medium, sheriff sale | match |

394 of 400 fields match. The 6 that differ are our bug (D9), not timing and not the City. Deeds:
31 of our deed rows matched the City's display date as a day in Philadelphia and the adjusted total
rounded to the dollar, including the hard cases: deeds recorded in the evening (UTC already the next
day), one deed covering three properties ($12,411,724 total, $4,137,241 as this parcel's share), and
prices with cents ($0.50 rounds to $1).

### 4.2 The violence reduction lens

* **Scores and the "why" breakdown, 10 parcels** (8 drawn at random, 2 missing the poverty factor),
  for the default weights and both presets: the score is the weighted average of the factors present,
  each factor's contribution is weight times value over the weights present, and the contributions
  add up to the score exactly. Rounded to tenths the way the lot page does it (largest remainder),
  the shown contributions add up to the shown score in all 30 cases.
* **The factors themselves**, for all 58,325 parcels on the map: `f_shoot` recomputed from the
  published hexagons (the seven cells around each parcel's point) and ranked: 0 differ. `f_vacant`:
  every 0 is a LandCare lot (11,853) or a building whose owner fixed its doors and windows (449).
  `f_poverty` and `f_canopy` re-ranked from their facts: 0 differ.
* **Shooting counts per hexagon**, recounted from the City's `shootings` table for the build date:

| Hexagon | Ours (12 and 36 months) | City |
|---|---|---|
| 892a134854bffff | 0, 1 | 0, 1 |
| 892a1341377ffff | 0, 3 | 0, 3 |
| 892a134f28bffff | 1, 1 | 1, 1 |
| 892a1348c8fffff | 0, 1 | 0, 1 |
| 892a13499afffff | 1, 2 | 1, 2 |
| 892a134ab4fffff (busiest) | 7, 24 | 7, 24 |
| 892a1341adbffff (second) | 1, 20 | 1, 20 |

### 4.3 Street safety, 5 blocks

Three blocks drawn at random among those with recorded harm, one on the High Injury Network and one
from all blocks. For each, the City's own services were read around the block (street centerlines,
the 2025 High Injury Network, the 2020 to 2024 PennDOT crash slice, the Police fatal crashes) and the
rules recomputed independently (crashes within 10 meters of a corner count for every block meeting
there, otherwise the nearest block within 30 meters, 60 for Police points; on the network when half
of ten points along the block are within 12 meters).

| Block | Ours: on network, killed or seriously injured walking or cycling, killed since 2024-10-04 | City |
|---|---|---|
| 421495 N 18th St | 0, 1, 0 | 0, 1, 0 |
| 321361 Jackson St | 0, 0, 1 | 0, 0, 1 |
| 540562 E Willard St | 0, 1, 0 | 0, 1, 0 |
| 640854 W Hunting Park Ave | 1, 2, 0 | 1, 2, 0 |
| 540564 Emerald St | 0, 0, 0 | 0, 0, 0 |

### 4.4 Memorials

The newest Police fatal crash records (2026-08-22 on Belfield Ave, 2026-08-16, 2026-08-04, 2026-07-27)
are each on the live map under the expected marker id with the right date, mode and block. The Police
table lags about six weeks. The memorial layer carries no name, driver detail or case number.

### 4.5 Numbers quoted in words

| Number | Where it is quoted | Quoted | Pipeline, 2026-10-04 |
|---|---|---|---|
| Lots high, medium, low | `content/vacant-land.md`, DESIGN 6, VACANCY_METHOD | 24,166; 6,147; 10,465 | 24,162; 6,160; 10,454 |
| Buildings high, medium, low | same | 6,553; 2,876; 8,503 | 6,597; 2,846; 8,475 |
| Never shown (parks and similar) | same | 1,727 | 1,727 |
| Medium lots the City's list leaves out | vacant-land page, VACANCY_METHOD | about 4,200 (4,220) | 4,228 |
| City building list parcels shown as lots | DESIGN 6 | 1,110 | 1,140 |
| Without the City's list: lots at medium; buildings staying high | vacant-land page, DESIGN 6 | about 29,000; 2,936 | 29,049; 2,936 |
| City vacancy lists | DESIGN 6, DATA_SOURCES | 28,771 lots and 9,519 buildings, dated 2026-09-27 | 28,770 and 9,569, every record now dated 2026-10-04: the City rebuilt the lists again |
| Memorials, crashes, street blocks | DESIGN 5.7 | 928 (428); 84,942; 40,453 | same |
| Dossiers; owners table | DESIGN 5.6, CONTRACTS 6 | about 78,000 (77,866); 464 | 77,863; 464 |
| Publicly owned share of vacant lots | `content/how.md` | about 26% of roughly 40,000 | 26% of the 30,322 high or medium lots; 23% of all 40,416 |

The vacant-land page says "As of October 4, 2026" over the study's numbers, which are not the
map's numbers on that day, and the map's change every week. Proposed: label the table "When we
studied this (October 4, 2026)", and show the current counts from the manifest, which needs the
counts as fields in `manifest.json` rather than only in a note (a contract addition). DESIGN 6 and
DATA_SOURCES should say the City rebuilt its lists again on 2026-10-04.

## 5. Size budget (data side)

Measured on the live site with compression, as a browser receives it.

| File | On disk | Transferred |
|---|---|---|
| `manifest.json` | 27.5 kB | 5.1 kB |
| `dossiers/common.json` | 5.2 kB | 2.0 kB |
| Largest shard, `dossiers/8715.json` | 1.20 MB | 186 kB |
| Median shard (`dossiers/6121.json`) | 73 kB | 12 kB |
| All 929 shards | 108.4 MB | 15.1 MB |
| `tables/owners.json` | 449 kB | 71 kB |
| `tiles/lots.pmtiles` | 8.88 MB | read in ranges |
| `tiles/streets.pmtiles` | 11.63 MB | read in ranges |
| `tiles/care.pmtiles` | 1.41 MB | read in ranges |
| `tiles/boundaries.pmtiles` | 0.68 MB | read in ranges |
| `tiles/context.pmtiles` | 0.16 MB | read in ranges |
| GeoJSON fallbacks | none (tiles were built) | |

Preliminary, before M1.7: the app's scripts and styles transfer 406 kB in all (the page, main
script and styles about 105 kB; the map library with its styles, 294 kB, and the base map script,
8 kB, load after the page appears), far under the 2 MB budget before map tiles.

GitHub Pages compresses `.pmtiles` files when asked, and then serves byte ranges of the compressed
file, which a tile reader cannot use. Browsers ask for no compression whenever they request a range
(the Fetch standard), and the live server then returns the right bytes (checked), so the map is
fine; other programs that ask for compression (for example `curl --compressed`) get unusable
ranges.

## 6. Privacy check of the live site (interface findings, not fixed here)

* Every request the page makes on load is to the same origin: the page, its scripts and styles,
  `data/`, and the base map with its fonts and sprites under `data/basemap/`. No third party fonts,
  scripts, analytics or map services. The bundle contains the address of a hosted OpenFreeMap style
  as a build time fallback (`VITE_BASEMAP=openfreemap`); the live build does not use it.
* With "fetch live City data" on (the default), opening a lot page or searching sends requests from
  the visitor's browser to `phl.carto.com` and `api.phila.gov`, as the About and Privacy pages say.
* Kept in the browser: settings and options in `localStorage` under `placekeepers:v1:`. No cookies,
  no session storage, no IndexedDB, no beacons, no service worker.
* "Near me" uses the browser's location on request; whether the position ever leaves the browser
  is an interface check.
* The page sets `referrer` to `no-referrer`; flag links open with `noopener noreferrer`. External
  links go to City pages, Google Maps (street level imagery, a link only), partners and sources.

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| F1 | Must fix before v0.1 | A name added to `memorials.yaml` would be published at the next refresh, before the removal email exists | `publish/streets.py` read the file with no other condition; `refresh.yml` runs on its own schedule | **Fixed** b91f898, with tests |
| F2 | Should fix | The memorial names snapshot (public release) kept memorial page links, which name the person, and removed entries | `adapters/curated.py`; the test fixture link ends in the invented name | **Fixed** 125282e, with tests |
| F3 | Must decide before v0.1 | Conservatorship offered on 2,186 parcels with a homestead exemption | Live dossiers joined with OPA `homestead_exemption` | Decision D1 |
| F4 | Should fix | 1,552 "very likely vacant" buildings (and 579 medium) carry a homestead exemption; the vacancy model does not read it | Same | Decision D1 (a new "against" reason, a contract addition) |
| F5 | Must decide before v0.1 | The public release holds citywide tax debt, all owners, case and ticket numbers, Police vehicle descriptions, shooting points | Section 3 | Decision D2 |
| F6 | Should fix | 5,328 map parcels have dossiers with no deeds, no assessments and incomplete L&I, shown as "No deeds on record." | `candidates.py` omits vacancy complaints; 2 of the 20 spot check parcels | Decision D9 (proposal there) |
| F7 | Should fix | Public bodies typed as people: person flags, deed fraud notice, owners table, 45 conservatorship routes | 167 parcels citywide, 108 dossiers | **Fixed** c6663a8, with tests |
| F8 | Should fix | Possible estate missed when a bank or trust is the second owner | 4 parcels citywide | **Fixed** 353e9b7, with tests |
| F9 | Should fix | The web app keeps its own copy of the owner type and estate rules for parcels it looks up live; F7 and F8 are not in it | `web/src/dossier/owners.ts` | Interface: port both, and add the new names to `pipeline/tests/wording_cases.py` so the parity fixture covers them |
| F10 | Later | About 720 parcels of organizations whose names OPA cut short are typed as people | Owner names of exactly 25 characters ("NORRIS SQUARE NEIGHBORHOO") | Match word prefixes for names cut at 25 characters |
| F11 | Later | The build note says 2 parcels have no poverty rate; 237 have none (tracts without an estimate) | `lens_factors.json`, tiles | Count both in the note |
| F12 | Later | Counts quoted in docs drift weekly; the vacant-land page labels the study's numbers "As of" a date | Section 4.5 | Proposal in 4.5 |
| F13 | Later | DESIGN.md section 9 paraphrases the possible estate text | DESIGN.md line 477 | Quote ETHICS.md or point to it |
| F14 | Later | City names with a spaced hyphen reach map labels (the neighborhood Fishtown and Lower Kensington is written with one) | Neighborhood and garden layers | Turn the dash into a comma when building the layer, as the lot page does |
| F15 | Later | A Police place reads "Kensington Ave and 2500 Block ( Sergeant St )" | Memorial `pl` | Tidy parentheses in `place_text` |
| F16 | Info | The City rebuilt its vacancy lists on 2026-10-04 (28,770 and 9,569) | Snapshot `date_update` | Update DESIGN 6 and DATA_SOURCES |
| F17 | Later | "About 26% of roughly 40,000 vacant lots are publicly owned" mixes two bases | `content/how.md` line 20 | "About a quarter of the roughly 30,000 lots we are fairly sure about" |
| F18 | Later | The block party row names "the police district" as a permit step | `content/how.md` line 104 | A City process fact, not enforcement; the owner may want it worded around the Streets Department permit |
| F19 | Later | The public crashes layer uses PennDOT's crash record number as its id | `crashes` layer `id` | Not a Police case number and PennDOT publishes it; D11 |
| F20 | Info | Tile ranges break for programs that ask for compression | Section 5 | None needed for browsers |

## Decisions needed

**D1. Conservatorship and homestead exemptions (must decide before v0.1).** 2,186 parcels whose lot
page offers conservatorship carry a homestead exemption: the City's records say the owner lives
there, or did (exemptions often outlive an owner, which is the tangled title case ETHICS.md protects).
DESIGN 5.6 limits conservatorship to parcels called vacant with high or medium confidence because "a
parcel we are not sure about may be someone's home"; a homestead exemption is the City's own record
that it is. Proposal: leave conservatorship off any parcel with a homestead exemption (about 10 lines
in `derive/routes.py` and `publish/dossiers.py`; the web app takes routes from the dossier), and add
a reason against vacancy, "The owner has a homestead exemption: City records say someone lives here",
that lowers a building one level (a new `rs` bit, a contract addition; 1,552 high buildings would
become medium).

**D2. What the public data-snapshots release may hold (must decide before v0.1).** See section 3.
Options: (a) trim each snapshot to what publishing needs: tax debt for candidate parcels only; no
case, complaint, work order or 311 ticket numbers; Police vehicle descriptions reduced to the mode;
house numbers to blocks; owners for candidate parcels only. (b) Keep snapshots off public releases:
GitHub Actions cache (kept 7 days without use, so the weekly run must not slip), a private repository,
or tar files encrypted with a repository secret. The release is public today.

**D3. The owners table.** About 76 private people are listed by name with every vacant parcel they
own, in one public file. ETHICS.md allows the list; the owner may prefer companies only in the
citywide file, with a person's list reachable only from their own parcels' pages.

**D4. Seller and buyer names in the deed history.** DESIGN shows "from and to"; CONTRACTS section 6
also promises no personal details beyond the owner names and mailing address. Decide which wins, and
say so in both.

**D5. Static owner details on parcels we do not call vacant.** 22,217 individual owners' dossiers
(names, mailing address, mail elsewhere, July 2025 tax debt on 11,110) concern parcels not called
likely vacant, so many are lived in homes, and the files can be downloaded in bulk. The live lookup
already serves any parcel on demand. Option: keep the flags about a person, and tax debt, in the
static files only for parcels called vacant with high or medium confidence. The City restricted
parcel level tax data after the July 2025 snapshot; the owner may want to know that before v0.1.

**D6. Possible estate on possibly lived in homes.** 18 of the 62 flags are on parcels not called
vacant or at low confidence. The flag is worded to protect families, but it is also what a deed thief
looks for. Option: limit it the way conservatorship is limited.

**D7. Removal of an unnamed marker while there is no removal email.** The memorials layer says
"anyone can ask for a name or a marker to be removed", and "Request removal" goes to the Contact page,
which says the address is coming soon. Until it exists, a family has no private way to ask for a
marker to come down. Decide an interim path or the wording.

**D8. Names in a public repository (before M1.9).** Once names are added to `memorials.yaml`, a
removed name stays in the public git history. Options: keep the curated names outside the public
repository (a private file or a secret the refresh reads), or say on the Contact page what removal
covers.

**D9. Dossiers outside the downloaded parcels (should fix before v0.1).** 5,328 parcels on the map
(3,661 low buildings, 1,452 low lots in conflict, 215 other) have no deeds, assessments or full L&I
history in their dossiers, and the lot page says "No deeds on record." when the live lookup is off
or fails. Options: (a) add the vacancy complaints (VL, VA, VO, BDNO) to the candidate signals in
`candidates.py`: covers 4,930 of them, but adds 9,392 parcels to the weekly downloads and to the
dossiers; (b) mark the parts a dossier was not built from (for example `"partial": ["transfers",
"assessments", "li"]`, a contract addition) so the page says "not in the weekly copy; open with live
data" instead of claiming there are none; (c) both.

**D10. Counts in the manifest.** To keep the vacant-land page honest week to week, add the vacancy
counts to `manifest.json` as fields (a contract addition) and have the page read them.

**D11. Crash ids.** The crashes layer's `id` is PennDOT's crash record number. It is public and not
a Police case number, but it identifies a crash report. Keep, or replace with an id of our own.

**D12. Displacement caution in v0.1.** Without the watch overlay (a later release), no greening card
says "Greening can raise nearby prices. Consider pairing it with protections." Option: show it on
every greening card until the overlay exists.

## Decisions taken (orchestrator, 2026-10-04)

The owner asked to get the prototype running and leaves design calls that keep the map from being
misused to the orchestrator. Each decision can be undone if the owner disagrees.

- **D1.** Conservatorship is never offered on a parcel with a homestead exemption, at any
  confidence. The vacancy model gains a reason against, "The owner has a homestead exemption: City
  records say someone lives here, or did", which lowers a building one level (high to medium, medium
  to low). On a lot it is shown as a reason against without changing the level.
- **D2.** No snapshot is published in plain form. The refresh encrypts each snapshot with a
  repository secret before it goes on the `data-snapshots` release, and decrypts it on the next run.
  Without the secret, snapshots are not uploaded at all and the run carries on without a last good
  copy. The first run with the new code removes the plain copies on the release.
- **D3.** The citywide owners table lists organizations only (companies, nonprofits, public bodies).
  For a person who holds 5 or more vacant parcels, the flag stays on those parcels' own lot pages,
  with the list of that person's parcels shown there, never in one citywide file.
- **D4.** Seller and buyer names on deeds stay: they are owners of record over time, as the City
  shows them. CONTRACTS section 6 says no personal details beyond the names of owners past and present
  and the current mailing address.
- **D5 and D6.** For an owner who is a person (or of unknown type), the flags about the owner
  (absentee owner, possible estate, tax debt as of July 2025, owner holds many vacant parcels) appear
  only on parcels called vacant with high or medium confidence, in the static files and on the lot
  page with live data alike. Possible estate never appears on a parcel with a homestead exemption.
  Facts about the parcel (deeds, sheriff sales, violations) and the owner's name and mailing address
  as the City publishes them are unchanged. Organizations keep every flag.
- **D7.** Until the removal email exists, no text promises one. The Contact page and the memorial
  layer say a private address is coming soon, and that meanwhile a request can be made in a GitHub
  issue, which anyone can read.
- **D8.** Names of people killed are never committed to this public repository. M1.9 keeps the
  curated names somewhere private that the refresh reads (for example an encrypted file), so a
  removed name leaves no public history.
- **D9.** Both options: vacancy complaints become download signals, and a dossier lists the parts it
  was not built from (`partial`), so the lot page says those records are not in the weekly copy and
  offers live data instead of claiming there are none.
- **D10.** The vacancy counts go into the manifest. The vacant-land page reads them later (#23);
  until then its numbers say "as of" their date.
- **D11.** Keep PennDOT's crash record number as the crash id: PennDOT and the City publish it, it is
  not a Police case number, and removal needs a stable id. ETHICS.md says so.
- **D12.** Every greening suggestion carries the ETHICS.md caution, "Greening can raise nearby
  prices. Consider pairing it with protections.", until the displacement watch overlay exists.
  Note (2026-10-08, M4.1): the watch now exists (DESIGN.md section 5.3). Inside a displacement watch
  area a greening card shows the full card of ETHICS.md, "Displacement": the sentence, the area's
  signs and links to the Neighborhood Gardens Trust, community land trusts, the Homestead
  Exemption, LOOP and tangled title help. Outside every watch area the card keeps this one line
  caution, as the orchestrator decided, because it stays protective.

## Interface checks for the second half (after M1.7 merges)

1. Port F7 and F8 to `web/src/dossier/owners.ts` (public body patterns; an estate name ending "ESTATE
   OF" stands on its own), then add the new names to `pipeline/tests/wording_cases.py` and regenerate
   `wording_parity.json`, so both test suites cover them.
2. Every place conservatorship can appear in the new views (cards in "What you can do nearby", the
   ranked table, exports, print) carries the ETHICS.md warning word for word, before the steps.
3. No sort, filter, preset or column is named or behaves as ease of acquisition; `rt` is shown only
   as a kind of first step. The need against feasibility plot does not invite "easiest" readings.
4. CSV and GeoJSON exports start with a line pointing to the terms of use, include the flags with
   their wording, and include nothing the published files do not.
5. The possible estate flag reads as the ETHICS.md text in order on the lot page and in print (it is
   shown in three labeled parts).
6. The memorial legend no longer says names appear while none can ("A fuller ring means a public
   memorial list shares the person's name"); "show names" also hides names in lists, exports and print.
7. "Only with the family's blessing" and the Families for Safe Streets link appear wherever the
   memorial suggestion does.
8. No area summary or list ranks neighborhoods, districts or hexagons by shootings; care wording only.
9. "Near me" keeps the position in the browser; with "fetch live City data" off, no request leaves for
   City servers (address search included).
10. Saved lists stay in `localStorage` under `placekeepers:v1:`, with export and import; no cookies.
11. The lot page does not claim "No deeds on record." or zero violations for parcels whose dossier was
    not built from those records (D9).
12. City names on map labels have their dashes turned into commas, as on the lot page (F14).
13. Accessibility (contrast, keyboard, screen reader labels on lists), Playwright end to end tests on
    phone and desktop sizes, and the first load budget with the final scripts (406 kB today).
14. Tile reading in Safari and Firefox, with a network log: range requests answered with 206 and no
    compression.
15. The violence lens breakdown on the lot page still adds up to the shown score (checked here with
    the current rounding rule on 10 parcels and 3 presets).

## How these checks were made

* The guard test `pipeline/tests/test_ethics_outputs.py` runs on every change (fixtures only). It was
  shown to fail when a case number is planted in a dossier or removal is switched off.
* The scans of the live and local files, the 20 parcel comparison, the lens and hexagon recounts and
  the street block check were one off scripts reading the published files with GDAL (its PMTiles
  driver reads every feature at the top zoom) and the City's APIs; the method is described in each
  section above so it can be repeated.
