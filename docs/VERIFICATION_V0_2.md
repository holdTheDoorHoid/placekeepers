# Verification before v0.2: transit comfort

Written 2026-10-05 by the verification agent, before the orchestrator tags v0.2. This is an
adversarial review of Phase 2 as merged on `main` at e085455: SEPTA stops, routes, service and
riders (M2.1, [TRANSIT_METHOD.md](TRANSIT_METHOD.md)), shelters and benches from OpenStreetMap
(M2.2), the transit comfort lens with its stop suggestions (M2.3) and the "Survey a route" sheets
(M2.4). The v0.1 review is [VERIFICATION.md](VERIFICATION.md).

**What was checked.** A local offline publish of e085455 from the shared snapshots (SEPTA's
schedules v202609270, SEPTA's Spring 2026 counts, OpenStreetMap of 2026-10-03), then two more with
the fixes below; the live site (build `2026-10-05T05-36-33Z-fac8cd4`, which has M2.1, M2.2 and M2.4
but not yet M2.3) for privacy and sizes; and SEPTA's, the City's and the researchers' own sources,
read directly: SEPTA's GTFS zip (one download, 22 MB), SEPTA's ridership layers on ArcGIS, the
City's street centerlines, the OTIS documents and contact pages, and the six papers EVIDENCE.md
cites for bus stop comfort. Every request carried the project User-Agent, one at a time and slowly.

## In short

What changes for the owner, most important first:

1. **One stop's "no shelter, no bench, not lit" was on the wrong side of the street, and an
   underground trolley platform was told to ask for a shelter.** At Frankford Avenue and Huntingdon
   Street an OpenStreetMap stop carrying the number of the southbound stop, 12 meters away across
   the street, gave its answers (and three requests: a shelter, a bench, a streetlight) to that
   stop. At 30th Street a street stop gave "no shelter, no bench" to the trolley platform
   underground, which then asked the City for a shelter and a bench and ranked 3rd of 7,927 stops
   under "Busiest stops first". **Fixed** (f8861d7): the pairing now believes a stop number only when
   no other SEPTA stop stands clearly closer, and pairs by place only with the nearest stop. Every
   one of the 660 pairs was then checked against the street centerlines: none is known to be on the
   wrong side, and one corner with two trolley stops is uncertain until someone surveys it (F9).
2. **The 15 trolley tunnel stations underground were scored like street stops**, with the
   suggestions to survey them with StreetComplete and to plant shade trees, while the survey sheets
   tell people to leave them out. **Fixed** (848997d): the lens leaves them out, like the subway and
   rail stations. They keep their service and riders.
3. **The survey page keeps its ticks in the browser, but not under the site's own name.** Ticks are
   saved as `pk-survey:...` instead of `placekeepers:v1:...`, on a web address the site shares with
   the owner's other sites. **Should fix in the interface** (a small change in
   `web/src/survey/sheet.ts`); a test for it is ready and marked to fix.
4. **Everything else held up.** All 130 values checked on 10 random stops match SEPTA's own
   schedules and counts. The 3 route sheets checked, and in fact all 237 directions, follow SEPTA's
   own stop order and direction names. No police suggestion anywhere. "Not yet surveyed" is never
   scored or shown as missing (checked on every stop). The six studies say what EVIDENCE.md says
   they say, and every contact and first step is real and current on the official pages. SEPTA's
   license is followed and OpenStreetMap is credited, with its license, everywhere its data shows.
   The new pages ask no other server for anything; the privacy test now covers them.

Commits on `agent/verify`: f8861d7, 848997d, 86b9263, 0ea91e8 and this report. Tests: 752 pipeline
tests pass (not live), the 42 workflow helper tests, 661 web unit tests, and the privacy and survey
end to end tests at phone and desktop sizes; ruff check and format pass and `pk registry check`
passes. Contract changes (CONTRACTS.md section 4 `o` and the lens properties, section 7): the
pairing rule is stricter, and the tunnel stations carry no lens properties.

## 1. Ten stops against SEPTA's own sources

Ten stops drawn at random (seed 20261005) from the bus and trolley stops on the map, with a trolley
stop, a stop with service through the night, a stop with long waits and a stop without a count
among them. For each, our tile properties were compared with what SEPTA's GTFS feed gives for the
same typical days (Wednesday 2026-10-07, Saturday 2026-10-10, Sunday 2026-10-11), worked out from
SEPTA's files by our own reading of the GTFS rules (a trip's last stop and stops where no one may
board are not departures), and with SEPTA's Spring 2026 ridership layers, summed over routes and
directions.

| Stop | Name | Routes | Departures weekday, Saturday, Sunday | First to last on weekdays | Midday wait | Night hours | Weekday boardings | Result |
|---|---|---|---|---|---|---|---|---|
| 20802 | Chester Av & 42nd St | T3 | 133, 77, 58 | runs all night | 10 min | 3 | 69 | all match |
| 30187 | City Av & Bala Av | 1, 44, 52, 65 | 213, 186, 150 | runs all night | 6 min | 3 | 87 | all match |
| 22616 | Byberry Rd & Proctor Rd | 495, 84 | 20, 14, 0 | 6:37 am to 8:02 pm | 60 min | 0 | 0 | all match |
| 32700 | Ontario St & Thompson St | 53 | 45, 35, 30 | 5:34 am to 2:12 am | 30 min | 2 | no count | all match |
| 16597 | Old York Rd & Church Ln | 55 | 60, 49, 37 | 4:27 am to 2:39 am | 20 min | 2 | 6 | all match |
| 15892 | Tabor Av & Adams Av | 26, 433 | 50, 18, 19 | 6:05 am to 12:33 am | 27 min | 0 | 36 | all match |
| 22945 | Haldeman Av & Sanford St | 477, 67 | 23, 13, 13 | 6:33 am to 11:06 pm | 60 min | 0 | 0 | all match |
| 22622 | Philmont Av & Cardella St | 84 | 19, 14, 0 | 7:08 am to 8:05 pm | 60 min | 0 | 0 | all match |
| 12058 | Pulaski Av & 17th St | 2, 53 | 106, 74, 69 | 4:52 am to 1:43 am | 12 min | 1 | 45 | all match |
| 15862 | Magee Av & Summerdale Av | 26, 433 | 48, 18, 19 | 5:56 am to 12:26 am | 27 min | 0 | 21 | all match |

All 130 values match (13 per stop: departures on each kind of day, first and last, the morning and
the three midday waits, departures after 8 at night, night hours, routes, and boardings). A count of
0 means SEPTA counted no one there; Ontario St & Thompson St has no row in SEPTA's layer, and the map
shows no count rather than a guess. SEPTA's own schedule pages are built in the browser by a script,
so they could not be read without one, and SEPTA's public schedule service did not accept today's
stop numbers; the GTFS feed and the ridership layers are SEPTA's published records for both.

## 2. OpenStreetMap stops paired with SEPTA's, including Frankford Avenue

**How.** For every pair the map makes (`o` on a SEPTA stop), the SEPTA point (from SEPTA's feed) and
the OpenStreetMap point were measured against the City's street centerline nearest the SEPTA stop:
on the same side, or not. Then every pair was checked for a SEPTA stop standing closer to the
OpenStreetMap point than the one it was paired with.

**What was wrong (now fixed, f8861d7).**

* **Frankford Avenue at Huntingdon Street**, stop 24149 (southbound, routes 5 and 76): paired by
  number with OpenStreetMap node 13315617155, whose `ref` is 24149 but which stands 12.3 meters
  away on the other side of the street, 4.4 meters from stop 16350 and 11.2 meters from the
  northbound stop 23943. The southbound stop got "no shelter, no bench, not lit" and the requests
  for a shelter, a bench and a streetlight. This is the Frankford Avenue pattern TRANSIT_METHOD.md
  describes (numbers naming the stop across the street), on a block narrow enough that the stop
  across the street is within 15 meters. Now a number counts only when no other SEPTA stop stands
  more than 3 meters closer; the point decides, as it already did beyond 15 meters.
* **Drexel Station at 30th Street**, stop 20643 (trolley platform underground, 537 riders a
  weekday): a street stop (node 9272920064, with a stray `ref` naming a stop in Chester County)
  whose nearest SEPTA stop, Market St & 30th St, was already paired, moved on to the next stop
  within 15 meters, the platform underground. Now an OpenStreetMap stop pairs by place only with its
  nearest SEPTA stop, and otherwise stays unpaired.

On today's data the change touches 5 of 663 pairs on the map (the two above, two pairs that carried
no answers, and stop 16350 at Huntingdon Street, which now gets the corner's answers) and 6 of 670 on
the route sheets (the same, plus one pair outside the city with no answers).

**Ten pairs in detail, after the fix** (four on Frankford Avenue, one at the Frankford
Transportation Center, five elsewhere; drawn with seed 20261005):

| SEPTA stop | OpenStreetMap stop | Its `ref` | Apart | Paired by | Side of the street | Answers |
|---|---|---|---|---|---|---|
| 23942 Frankford Av & Sergeant St | node 13315617154 | 24150 (another stop) | 10.1 m | place | same | no shelter, no bench, lit |
| 23952 Frankford Av & Tioga St | node 13315617165 | 24140 (another stop) | 3.9 m | place | same | no shelter, no bench |
| 23944 Frankford Av & Somerset St | node 13315617157 | 24148 (another stop) | 3.3 m | place | same | no shelter, no bench |
| 23992 Frankford Av & Richmond St | node 7732516989 | none | 0.7 m | place | same | none yet |
| 21966 Frankford Transit Center, Rt 67 | node 5924978565 | none | 4.9 m | place | same | none yet |
| 16021 Ridge Av & Monastery Av | node 12271888114 | 16021 | 5.2 m | number | same | no shelter, no bench |
| 30915 Main St & Kalos St | node 13477815980 | 30915 | 4.1 m | number | SEPTA's point is in the street; same pole by number | no shelter, no bench |
| 20942 Elmwood Av & 63rd St | node 7735022701 | none | 4.1 m | place | same | none yet |
| 15189 Broad St & Pine St | node 3529171314 | none | 4.5 m | place | same | shelter |
| 17633 American St & Cumberland St | node 9907364077 | none | 11.6 m | place | same | none yet |

**Every pair, after the fix.** 660 pairs: 619 on the same side, 26 with a point on the centerline,
12 with no street within 40 meters (transportation centers), and 3 flagged, read one by one:
Washington Sq & Locust St (the only SEPTA stop there, numbers agree; OpenStreetMap's point is drawn
in the street), 62nd St & Elmwood Av (around the corner rather than across; the OpenStreetMap stop is
probably the Elmwood Avenue trolley stop 13 meters away, and it has no answers yet), and Frankford Av
& Girard Av far side (two trolley stops at a skewed corner, 13 and 20 meters from the point; the
answer is "no shelter"; a survey would settle it). On Frankford Avenue: 53 pairs, 48 with answers,
none on the wrong side. 57 OpenStreetMap stops carry the number of a SEPTA stop more than 15 meters
away (33 of them on Frankford Avenue): 35 are now paired on the right side by place and 22 are left
unpaired.

## 3. Three route survey sheets against SEPTA

Three routes drawn with seed 20261005: the T3 trolley, the 129 (which leaves the city) and the 45.
For each direction: the direction name and destination against SEPTA's `directions.txt`, the stop
order against SEPTA's `route_stops.txt`, which stops are left off as outside Philadelphia, and the
order against the longest trip SEPTA runs that weekday.

| Route, direction | Our name and destination | SEPTA's | Stops on the sheet | Left off, outside the city | Order |
|---|---|---|---|---|---|
| T3 Eastbound | Eastbound to 13th-Market | same | 42 | 12 | SEPTA's list; same as the trips |
| T3 Westbound | Westbound to Yeadon-Darby Transit Center | same | 43 | 13 | SEPTA's list; same as the trips |
| 129 Southbound | Southbound to Frankford-Knights | same | 8 | 97 | SEPTA's list; same as the trips |
| 129 Northbound | Northbound to Oxford Valley Mall | same | 5 | 95 | SEPTA's list; same as the trips |
| 45 Southbound | Southbound to Broad-Oregon and Navy Yard | same | 52 | 0 | SEPTA's list; one swap against the Navy Yard trips |
| 45 Northbound | Northbound to 12th-Vine | same | 48 | 0 | SEPTA's list; same as the trips |

Then all 237 directions of all 123 sheets: every name and destination matches SEPTA's, and every
sheet is in SEPTA's order. Against every trip pattern SEPTA runs, two directions show a single
swap of neighboring stops (route 45 southbound puts Broad St & Geary St before Packer Av & Broad St,
where the Navy Yard trips stop the other way round; route 2 southbound has one similar swap). The
sheets follow SEPTA's list, as CONTRACTS.md says; a surveyor walking the route will see two stops
in the other order there.

## 4. Ethics and honesty

| Rule | How it was checked | Result |
|---|---|---|
| No police suggestion anywhere | Registry suggestions and routes, the survey guide and pages, the interface strings, the stop and route layers, every route sheet | None. SEPTA's customer service page offers a safety report to the transit police; we link only its comment form and phone line. The survey tips are about traffic and courtesy ("Do not photograph people") |
| "Not yet surveyed" never scored or shown as missing | Every one of the 7,927 bus and trolley stops: `f_noshelter` and `f_nobench` are 50 exactly when unknown, 0 or 100 only on an answer; every suggestion follows its rule; the map draws unknown as a hollow gray ring; the stop page never names a halfway answer as the main reason; the sheets say "Not yet surveyed" or "Not found in OpenStreetMap", never "missing" | Holds everywhere |
| Badges match EVIDENCE.md | Each factor and suggestion in the registry against "Bus stop comfort" | All match: riders, heat and the High Injury Network Context; no shelter, no bench and long waits Weak; shade Mixed; a streetlight report Moderate; a survey Context |
| The studies say what we claim | The six papers' records and abstracts (Crossref, OpenAlex, Semantic Scholar) | All six exist as cited and support the claims: riders' reported waits 1.21 times the filmed waits and "at least 1.3 times" for most waits at stops with no amenities, benches and shelters shorten them, amenities urged on low frequency routes (Fan, Guthrie and Levinson 2016); 36 stops and stations, mature trees shorten and traffic and pollution lengthen waits over 5 minutes (Lagune-Reutler and others 2016); Phoenix, summer 2018, shade lowers the felt temperature by 19 °C, almost half of riders hot, the vegetated awning not significant in the afternoon (Dzyuban and others 2022); Austin, 2,271 stops, shelters no help on hot days, canopy a 1.6 instead of 1.7 percent drop (Lanza and Durand 2021); bus stop use tied to pedestrian collisions on state roads, with traffic volume and lanes (Hess, Moudon and Matlick 2004); midblock fatal crashes 4.7 to 5.2 times the odds of being bus stop related (Rewalt, Brakewood and Cherry 2025, closed access, read from its abstract) |
| The City's shelter goal | OTIS's request for information of May 2024 (PDF on phila.gov) | Says it: 40 percent of boardings at stops with a shelter, from the Connect plan, and the busiest 15 percent of stops as candidates, paid for by advertising |
| Every contact and first step is real and current | The official pages, read on 2026-10-05 | OTIS: otis@phila.gov and 215-686-9003 (both in OTIS's Art Commission papers of December 2025: eight new shelters at existing stops, no City funds). SEPTA: its comment form answers at the address we link, and 215-580-7800 is its customer service line. Street trees: free for property owners, planting mid April to mid June and mid October to mid November, StreetTree.Info@phila.gov and 215-685-4363 (phila.gov); the City waters and mulches the first year and an arborist inspects and picks the tree (TreePhilly). Philly311: its page lists street light outages, online, by app or by calling 311. StreetComplete: the iPhone test version is announced on its project page. The Council office had no way to find it; **fixed** (0ea91e8) with City Council's members page, where each member gives the district office |
| "Last checked" dates | registry/routes.yaml and ROUTES.md | Every new route is dated 2026-10-05; Philly311 and the general OTIS route 2026-10-04, still current |

## 5. Licenses

* **SEPTA.** Its license agreement (read at the address in the registry, SEPTA's own four w
  spelling) lets anyone use, reproduce and redistribute its open data, as is; it forbids using its
  trademarks and copyrighted materials for profit or altering them, and asks for no credit line.
  The site uses no SEPTA logo, artwork or line colors (routes are drawn in our own four colors), and
  credits SEPTA for schedules and ridership in the tile credits and on the stop pages.
* **OpenStreetMap.** `osm_philadelphia` is under the Open Database License in the registry. The
  shelters and benches tiles credit "© OpenStreetMap contributors (Open Database License)"; the
  transit tiles carry the same line for the answers they hold; the stop page says "From
  OpenStreetMap, © OpenStreetMap contributors"; a printed survey sheet ends "map data ©
  OpenStreetMap contributors"; the terms say OpenStreetMap data follows the ODbL. The route sheet
  files themselves carry no credit or license line (finding F7), and a layer that mixes SEPTA's
  records with OpenStreetMap's answers raises a share alike question (decision D1).

## 6. Privacy

* The privacy end to end test did **not** include the survey page. It now does (86b9263): with live
  City data off, it opens a bus stop's details from the Bus stops chip, the Survey bus stops guide,
  and a route sheet with a box ticked, and checks that no other server is asked for anything and
  that the ticks stay in the browser, out of cookies and requests. Passes at phone and desktop
  sizes. The live pages' code agrees: the survey page fetches only the site's own route files, and
  OpenStreetMap appears only as links.
* The ticks stay in this browser, but under `pk-survey:<route>:<direction>` instead of the site's own
  `placekeepers:v1:` prefix (DESIGN.md section 5.2), on an address shared with the owner's other
  sites. A second test, marked to fix, fails today with `pk-survey:60:0` and passes once the key
  moves (finding F3).

## 7. Numbers quoted in the docs

TRANSIT_METHOD.md, CONTRACTS.md, DATA_SOURCES.md and DESIGN.md were recounted from the local build.
Every figure matched e085455 (8,081 stops and stations, 7,927 bus and trolley stops, 141 routes,
4,294 frequent, 911 long waits, 2,632 all night, 7,755 counts, 663 pairs, 279 surveyed, the factor
coverage, the suggestion counts, 38 and 62 of the top 100, the route sheets' 123 routes, 237
directions, 21,050 list entries and the feed dates) except one: a median route sheet is about 2 kB
compressed, not 4 (CONTRACTS.md section 7, corrected). The fixes change the transit comfort counts,
and the docs now give the new ones: 7,912 stops scored, 660 pairs (181 by number, 479 by place), 278
surveyed, 7,634 not yet, suggestions 7,649, 229, 210, 17 and 1,987, and 39 and 61 of the top 100. The
live manifest (fac8cd4) predates M2.3, so its notes have no transit comfort lines yet; its route
sheet line will read 1,114 matches instead of 1,122 after the next refresh.

## Findings

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| F1 | Must fix before v0.2 | A stop number naming the stop across a narrow street was believed: answers and three requests on the wrong side at Frankford Avenue and Huntingdon Street | Node 13315617155, stops 24149 and 16350; section 2 | **Fixed** f8861d7, with tests |
| F2 | Must fix before v0.2 | A street stop fell to the next SEPTA stop, an underground trolley platform, which then asked for a shelter and ranked 3rd under "Busiest stops first" | Node 9272920064, stop 20643 | **Fixed** f8861d7, with tests |
| F3 | Should fix | Survey ticks saved under `pk-survey:` instead of `placekeepers:v1:` | `web/src/survey/sheet.ts` `answersKey`; the marked test in `web/e2e/privacy.spec.ts` | Interface: move the key, keeping ticks saved under the old one; then turn the test on |
| F4 | Should fix | The 15 trolley tunnel stations were scored and given street suggestions | Stops 283, 20659, 31140 and 12 more; the survey page says to leave them out | **Fixed** 848997d, with tests |
| F5 | Should fix | A tunnel station's page still shows "What riders find here" with every answer not yet surveyed, and "The transit comfort lens scores bus and trolley stops only" | `web/src/components/transit/TransitStopDetails.svelte` decides "station" by mode | Interface: treat a bus or trolley stop without `f_noshelter` (every scored stop has it) as a station there, and say the tunnel stations are left out |
| F6 | Should fix | The steps said to copy the Council district office with no way to find it | registry/routes.yaml | **Fixed** 0ea91e8 |
| F7 | Later | The route sheet files carry no credit or license line, though they hold OpenStreetMap's answers | `tables/routes/*.json` | Add a credit and license line to `index.json` and each sheet (a contract addition) |
| F8 | Later | Two adjacent stops in SEPTA's own list are in the other order from some trips (routes 45 and 2 southbound) | Section 3 | None needed; SEPTA's order, as the contract says |
| F9 | Later | Two pairs remain uncertain: Frankford Av & Girard Av (no shelter), and an Elmwood Avenue trolley stop linked to the 62nd Street bus stop around the corner (no answers) | Section 2 | A survey at those corners |
| F10 | Later | "Not affiliated with the City of Philadelphia" does not mention SEPTA, whose stops and routes the map now names | `strings.app.notAffiliated` | Interface: "Not affiliated with the City of Philadelphia or SEPTA" |
| F11 | Info | The Regional Rail schedules SEPTA published run only to 2026-10-17 | SEPTA's `google_rail.zip` | None; the method uses a feed's last four weeks and says so if SEPTA is late |
| F12 | Info | The pairing's 15 meter reach can still cross a narrow street when no closer stop exists | Section 2 | Later: compare sides of the street with the centerlines in the pipeline itself |

## Decisions needed

**D1. OpenStreetMap answers inside SEPTA's stops layer.** The transit tiles and the route sheets put
OpenStreetMap's shelter, bench and light answers on SEPTA's own stop records. Under the
OpenStreetMap Foundation's guidance on collective databases, joining the two for the same features
probably makes a derivative database, which the Open Database License asks to be offered under the
same license; SEPTA's license lets us redistribute its data but not relicense it. Options: (a) keep
the answers only in the shelters and benches file and join them in the browser by the
OpenStreetMap id (`o`), so the transit file holds SEPTA's data and a link; (b) ask SEPTA whether its
data may be shared under the ODbL inside Placekeepers' files; (c) accept the current files, which
credit both and say OpenStreetMap data follows the ODbL. (a) is the clean one and is a contract
change.

**D2. The tunnel station list.** SEPTA's feed does not mark the trolley tunnel platforms as
underground, so the lens leaves them out by a hand kept list of 15 stop numbers. A renumbered stop is
still caught through its history, and the build notes count the list, but a new tunnel stop would
need the list updated. Keep the list, or ask SEPTA to mark the platforms in its feed (its `levels`
file already does this for a few stations).

## Interface checks for whoever builds next

1. F3: move the survey ticks to `placekeepers:v1:survey:<route>:<direction>`, reading the old
   `pk-survey:` key once, and turn on the marked test in `web/e2e/privacy.spec.ts`.
2. F5: a bus or trolley stop with no lens properties is a tunnel station; show it like a station.
3. F10: name SEPTA in the "not affiliated" line.
4. Keep the new privacy test passing when the survey or stop pages gain anything that loads from
   elsewhere.

## How these checks were made

* GTFS: SEPTA's `gtfs_public.zip` as published on 2026-09-25, read with our own queries of its
  calendar, trips and stop times, independent of the pipeline's code. Ridership: SEPTA's
  `Spring_2026_Stop_Summary_Bus` and `_Trolley` layers, by stop number.
* Street sides: the City's street centerlines from the shared snapshot, projected to meters (UTM
  zone 18 north), with signed distances from the nearest centerline.
* Sheets: SEPTA's `directions.txt` and `route_stops.txt`, and every trip pattern in `stop_times.txt`.
* Studies: their records in Crossref and their abstracts in OpenAlex and Semantic Scholar. City
  papers and contact pages: read once each from phila.gov, septa.org, treephilly.org,
  phlcouncil.com and StreetComplete's project page.
* The new pipeline tests (`test_route_sheets.py`, `test_transit_comfort.py`) fail without the
  fixes; the privacy test was run against a local build at phone and desktop sizes.
