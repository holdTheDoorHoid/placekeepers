# Changelog

Numbers below are from the live manifest and the project's docs, each said "as of" its own date,
and change a little every week as the data refreshes.

## v0.3 (2026-10-08)

Phase 3 of the roadmap, heat and shade and placemaking, is finished. A new placemaking lens ranks
vacant lots for where a garden, a place to sit or a mural would be used most. It is built on new
measures of walking, people and traffic stress for people on bikes, and sits beside the public art
and the heat and shade work from earlier. Also here, ahead of schedule from Phase 4, is a
displacement watch that pairs greening and placemaking suggestions with ways to protect neighbors
where prices are rising. Two additions that were not on the roadmap came along: lots the City's
land agencies list as available, and a heat map of parking problems reported with Philly Bike
Action's Laser Vision app.

### Placemaking

- A placemaking lens for vacant lots and buildings: where a lot would most likely become a public
  place people use every day, such as a garden, a pocket park, a place to sit in the shade or a
  spot for art. Six factors, each with a "why" breakdown: people within a 5 minute walk,
  everyday places within a 10 minute walk, walkability, far from a park, no public art nearby, and
  on or near a commercial corridor. Presets: "Balanced", "Most neighbors", "Where people already
  walk" and "Far from a park". Choose it under "Color lots by".
- It is about use and welcome, never about crime. No study we found links art or walkability to
  less violence, so the lens and its suggestions make no such claim, and the seating, garden and
  mural suggestions carry a "Not about violence" badge.
- Six suggestions for lots, each with the first lawful step. As of October 8, 2026: make a place
  to sit in the shade (18,765 lots), start a community garden (20,653), ask about a mural or other
  art (15,666), and, where a block the lot faces has a request still open, report illegal dumping
  (650 lots), a dark street light (1,082) or graffiti (69) to Philly311. Reports are about
  physical conditions only, never for the police.
- The mural suggestion links to Mural Arts Philadelphia's own wall request page and copies
  nothing from its site. A new route points to Feet First Philly's public space mini grants,
  $500 to $2,500.
- Every placemaking card carries a displacement caution; see "Displacement watch" below.
- Honest about its limits: because it values people and everyday places within a walk, the lens
  ranks the dense rowhouse neighborhoods around Center City highest, and some of those are among
  the city's costliest. That is one reason for the caution on every card, and for the "Far from a
  park" preset, which turns to places that lack open space. The public art factor knows only part
  of the city's art, since Mural Arts' murals are in no list the map may use, so it has the lowest
  default weight.

### Walking, cycling and people

- A new "Walking, cycling and people" group of three layers, off by default.
- **How walkable each area is (EPA):** the U.S. EPA's National Walkability Index for each of the
  city's 1,336 census block groups, compared within Philadelphia or with the whole country.
- **People and places within walking distance:** 3,335 hexagons about two blocks across, shaded by
  the people within a 5 minute walk, the kinds of everyday places within a 10 minute walk, or the
  street corners within a 5 minute walk. Seven kinds of everyday places count: a Free Library
  branch, a recreation center, a pool or sprayground, a drinking fountain in a park, a school, a
  grocery store that takes SNAP, and a SEPTA stop with service.
- **Traffic stress for people on bikes (DVRPC):** every street segment the Delaware Valley
  Regional Planning Commission rates, 39,258 as of October 8, 2026, from level 1, calm enough for
  most people of all ages (15,800), through level 2 (15,779) and level 3 (6,041), to level 4, only
  for the most fearless riders (1,638). Calm streets are blue and stressful ones orange and
  brown, never an alarm red.
- Every distance is a straight line from the middle of a lot, at about 80 meters a minute, so a 5
  minute walk is 400 meters. That reaches a little farther than a walk along streets and crosses
  rails and rivers people on foot cannot; each legend says so.
- Left out on purpose: DVRPC's sidewalk gap scores, whose terms are unclear; Walk Score, whose
  terms forbid storing its scores; and routes along real streets.

### Public art, and heat and shade, finished

- A public art layer: 651 works as of October 8, 2026, from the City's Percent for Art list (224
  records), OpenStreetMap (410) and Wikidata (69). A work listed in more than one source shows once
  (50 do), with a link to each. It is off by default, with a switch for each kind: murals,
  sculptures and statues, mosaics, and other kinds.
- The public art layer reached the map in the last hours of v0.2's work, so v0.2's notes did not
  describe it. It is described here for the first time.
- Murals and plaques that remember a person show only as "Memorial artwork" (45), with no title or
  name, in the files and on the map. Names of people killed still come only from the hand curated
  memorials list.
- Mural Arts Philadelphia keeps the largest list of murals, and its terms do not allow copying it,
  so the layer links to its list instead of copying it. If a work is missing, adding it to
  OpenStreetMap puts it on the map within about a week.
- Waiting on permission from their owners: philart.net, the Association for Public Art's map,
  Philadelphia's Magic Gardens' mosaic map, and Parks and Recreation's list of art in its parks.
- The heat and shade lens, the trees, heat and floodplain layers, and the amenities and 311
  layers from v0.2 carry over and now do more work: the City's libraries, recreation
  centers, pools and park drinking fountains count as everyday places in the placemaking lens, and
  open 311 requests trigger its reports.

### Displacement watch

- A new layer, "Displacement watch: signs that prices are rising," in a new "Prices and
  protections" group. It is on by default in the analysis view and off in the field view, where
  the cards already carry the caution.
- It looks at the city's 408 census tracts for five signs in public records: home sale prices
  rising faster than across the city, companies buying many of the homes sold, the City's assessed
  values rising faster than across the city, at least three in five homes rented, and the City's
  Market Value Analysis (the 2026 edition) finding prices climbing out of reach of longtime
  residents. A tract is in the watch when at least two signs hold and at least one is about prices.
- As of October 8, 2026, 96 of 408 tracts, holding 157,139 of the city's 679,428 occupied homes,
  are in the watch. Because vacant lots gather in the same neighborhoods, 26,227 of the 40,776
  vacant lots on the map lie in one.
- It is a caution, never a ranking. It changes no score and no order, every area is drawn the same
  way, and it says "signs that prices are rising here," never that a neighborhood is changing.
- Inside a watch area, every greening suggestion, every placemaking suggestion, the shade trees
  suggested at bus stops and the box of a listed lot add the area's signs and links to the
  Neighborhood Gardens Trust, community land trusts, the City's Homestead Exemption and Longtime
  Owner Occupants Program, and help with a tangled title, each with the day its page was last
  checked. Outside every area the card keeps a one line caution. Lot pages, their print layout and
  the downloads follow the same rule.
- Tapping an area says what it cannot tell: signs in public records are not a forecast, and they
  cannot show who has moved away or why, or what rents are. Buyers' names are read only to tell a
  company from a person and are never kept.

### Lots listed as available

- A new setting on the vacant lots layer, also a filter in the analysis view: "Listed as available
  by the City's land agencies." It uses the same City list as the Philadelphia Land Bank's "View
  Properties Map." As of October 8, 2026, the list holds 1,640 parcels.
- On a lot page, the City's status for the lot in plain words ("held for affordable housing,"
  "someone has applied"), and for a listed lot a box with the date of the list, the side yard
  program first where the lot is eligible, the Land Bank's note that it can turn down any sale or
  lease, and a link to its map.
- No prices, no sort or score by how easy a lot would be to get, and no buy buttons, only links
  to the Land Bank's own map and programs for neighbors (docs/ETHICS.md).
- The list carries no dates of its own, so the site dates it by the day we fetched it.

### Parking problems reported (Laser Vision)

- A new layer in the streets group, off by default: where people using Philly Bike Action's Laser
  Vision app reported vehicles blocking sidewalks, crosswalks, corners, curb ramps and bike lanes
  over the last 12 months, shown with Philly Bike Action's permission. Zoomed out it is a heat
  map; close in it becomes areas about a block across. A setting picks one kind of problem or all.
- Counts only, never a single report. An area shows only with at least 5 reports. As of October
  8, 2026: 26,060 reports from October 8, 2025 to October 7, 2026, 23,254 of them (89 percent)
  in the 1,112 areas that are shown.
- It says plainly that the counts come from people using one app, not every problem. Tapping an
  area gives its counts by kind and frames them as evidence for physical fixes to the street:
  curb extensions, bollards, daylighted corners, protected bike lanes and loading zones, with the
  City's transportation office as the place to ask.
- No vehicle, plate, photo, time of day or reporter is stored or shown. It is not a lens factor.
- The data pipeline asks Philly Bike Action's public map data for the counts at most once a week,
  a few requests spaced seconds apart, with the project's User-Agent. Your browser never contacts
  Philly Bike Action; the counts come in the project's own map files, with a credit and a link to
  its map.

### Map, lists and lot pages

- Street blocks and crashes can be reached without the map: "Street blocks nearby" in the field
  view's sheet, a Street blocks tab in the analysis drawer, and the crashes in view listed beside
  them, each opening the same details as tapping the map. This closes the first item of issue
  #26 for keyboard and screen reader users.
- A lot page opened from a link or a search shows the same score breakdown and flood note as one
  tapped on the map (issue #31).
- The base map draws no labels of artworks, memorials, monuments or graves, so a name it holds for
  a memorial cannot show where the map itself shows none.
- On a phone, the keyboard can scroll a details panel that has nothing to tab to.

### New data, and what was checked

- New sources: the EPA's walkability index, 2020 census blocks for population, DVRPC's traffic
  stress network, the USDA's list of stores that take SNAP (kinds and points only, never names), the
  City's commercial corridors, citywide home sales without names or addresses, the City's assessed
  values, Census Bureau renter counts, the City's Market Value Analysis, Wikidata and the City's
  Percent for Art list, and Philly Bike Action's Laser Vision counts.
- Checked on October 8, 2026 and not used: Transit Forward Philadelphia's stop audits wait on
  permission, and we wait for a trimmed copy and a license. PhillyTreeMap is not used: it has been
  dormant since about 2013, its map shows no trees, it has no data license, and its trees began as
  City inventories we already hold. The Land Bank's map is used with credit, through the City's own
  layer. The full findings are in docs/DATA_SOURCES.md, "Sources checked 2026-10-08."

### Safeguards and privacy

- The privacy test now covers the Laser Vision layer: the site asks no server of Philly Bike Action
  for anything.
- Names of buyers are never kept in the displacement watch; only a company or person type is.
- No police suggestions, ever. Reports to Philly311 are for physical conditions only.

### Site pages

- How to do it adds the Land Bank's map of available properties, a graffiti report to Philly311,
  and Feet First Philly's mini grants. Use this responsibly describes the displacement watch and
  its five signs. Why this works adds the placemaking lens and what the research does and does not
  support.

## v0.2 (2026-10-05)

A first look at transit comfort: the SEPTA bus and trolley stops and routes from v0.1 now carry a
lens that scores where a shelter, a bench or shade would help riders most, with suggestions and
printable survey tools. Also carries an early look at two later releases, heat and shade and
amenities around the city.

### Transit comfort

- A transit comfort lens for SEPTA's bus and trolley stops: riders, a missing shelter or bench,
  little shade, crossing the High Injury Network, and long waits, with a "why" breakdown, a
  "Busiest stops first" and a "Heat and shade" preset. 7,912 stops scored as of October 5, 2026.
- Five suggestions, each with the first lawful step: survey a stop with StreetComplete, ask the
  City for a shelter or a bench (no public request form exists, so the card gives OTIS's own
  address), report a dark streetlight to Philly311, or ask a building owner to request a free
  street tree. As of October 5, 2026: 7,649 stops suggest a survey, 229 a shelter request, 210 a
  bench request, 17 a streetlight report, and 1,987 shade trees.
- A new "Bus stops" chip in the field view, and stops listed beside lots in "What you can do
  nearby".
- The "Survey a route" kit: a printable sheet for every SEPTA bus and trolley route and
  direction, 123 routes and 237 directions, in SEPTA's own stop order.
- 660 of the 7,912 scored stops are matched to one of the 829 stops OpenStreetMap knows in the
  city (181 by stop number, 479 by place); 278 have their shelter or bench surveyed, and the
  other 7,634 say "not yet surveyed" rather than guessing.
- The 15 trolley tunnel stations underground are shown as stations: left out of the lens and its
  suggestions, since no one can survey an underground platform.
- OpenStreetMap's shelter and bench answers are joined to SEPTA's stops in your browser, not
  stored together in our published files, so SEPTA's license and OpenStreetMap's license each
  stay with their own data.

### Heat and shade, an early look

- A heat and shade lens for lots and buildings: neighborhood heat vulnerability, tree canopy,
  City street trees nearby, and how many people it would reach, with "Balanced", "People most at
  risk" and "Fewest trees" presets.
- 151,726 City trees shown on the map, and the FEMA floodplain, as of October 5, 2026.
- The transit comfort lens's "Heat and shade" preset also weighs shade at bus stops.

### Amenities and conditions, an early look

- What OpenStreetMap knows so far about benches, picnic tables, drinking water, public toilets
  and little free library boxes around the city.
- Free Library branches, recreation and older adult centers, pools, spraygrounds and sprinklers,
  from the City's own lists.
- 311 reports of illegal dumping, street and alley lights out, and graffiti, grouped by block
  over the last 90 days.
- No lens or suggestions of their own yet; that is further Phase 3 work.

### Map and views

- The whole city view loads a lighter copy of the lots on phones.
- The analysis view says plainly when its list, plot and downloads show only a sample of the
  places in view rather than every one; zoom in to see and count every place.

### Safeguards and privacy

- The privacy test now covers the bus stop pages, the "Survey bus stops" guide and the "Survey a
  route" pages: with live City data off, they ask no other server for anything.
- The "not affiliated" line now names SEPTA as well as the City of Philadelphia.

## v0.1 (2026-10-05)

The first public release: a vacant lot finder with a full page for every lot, and street safety
with memorials.

### Map and views

- Two views sharing one map: a field view for phones, with "What you can do nearby," and an
  analysis view for desktops, with lens sliders, filters, a ranked list, and downloads.
- A violence reduction lens (untreated vacant lots and buildings, nearby shootings, the
  neighborhood's poverty rate, tree canopy) and a street safety lens (the High Injury Network,
  people killed or badly hurt walking or cycling, recent deaths), each with a "why" breakdown and
  an evidence badge.
- Filters for how sure we are, lot or building, owner type, whether a lot is already cared for
  under PHS LandCare, and the first step to get permission.
- A ranked list, a plot of need against the first step to get permission, CSV and GeoJSON
  downloads, and saved lists that stay in your own browser, with export and import.
- A base map you can switch between labeled streets and a plain background, with one short
  credits line for Protomaps, OpenStreetMap and the City.
- Vacant lots and buildings shown with how sure we are: high, medium or low confidence (as of
  October 4, 2026: 24,162 high confidence lots, 6,160 medium, 10,454 low; 5,045 high confidence
  buildings, 3,819 medium, 9,053 low). Parks, gardens, parking and similar never show as vacant
  (1,727 left out).
- Phone fixes: a shorter top bar, a preview note you can hide, bigger buttons and sliders for
  touch, and a usable layout when the phone is turned sideways.

### Lot pages

- Every parcel with a sign of vacancy gets a full page (about 82,000 as of October 4, 2026): a
  summary with our confidence and the reasons behind it, suggestions with the first lawful step,
  who owns it, full sale history, and what is nearby.
- Owner flags such as absentee owner, possible estate, tax debt as of July 2025, and owner holds
  many vacant parcels, each written with what it means, why to be careful, and a protective next
  step, following the wording in docs/ETHICS.md.
- A deed fraud notice and links to the Tangled Title Fund and Fraud Guard wherever the owner may
  be a person.
- Live lookups to the City's own records when you open a page, with the weekly snapshot as a
  fallback, and a clear note when a part of the page is not in this week's copy.
- A print layout, and search by address or nine digit parcel number.

### Street safety and memorials

- The High Injury Network (162 segments) as a map layer, and years of crash records (84,942
  PennDOT crashes from 2015 to 2024, as of October 4, 2026), filterable by year, severity and
  mode.
- The street safety lens, scoring every one of the city's 40,453 street blocks.
- A quiet marker for every person the Police record as killed in a crash (928 markers as of
  October 4, 2026, 428 of them walking, cycling or riding a scooter, shown by default), each also
  listed by date and place so it can be read without touching the map. Names are not shown yet;
  see the release notes for why.
- Anyone can ask for a memorial to come down through a public GitHub issue, no name or reason
  needed, until a private email address exists.

### Buses and trains, an early look

- SEPTA's bus, trolley and train stops and routes: how often service comes and how many people
  get on each weekday, from SEPTA's own counts. Subway, El and Regional Rail stations can be
  added in Settings.
- Shelters and benches at stops, from what OpenStreetMap knows so far, with the "Survey bus
  stops" guide showing neighbors how to add the stops it is still missing using the free
  StreetComplete app.
- Both layers are under "Buses and trains" in the layer list, off by default. The transit comfort
  lens and its suggestions, which give these layers a job on the map, are not part of v0.1; they
  come in version 0.2.

### Data and upkeep

- A weekly automatic refresh (and an on demand one) that downloads every source again, checks it,
  and keeps the last good copy of anything that fails, clearly labeled with its age.
- The Data status page, showing where every source stands.
- Weekly snapshots are encrypted before they are saved on the project's public release, so
  personal details in the raw City data, such as tax debt or case numbers, are never published in
  the open.
- An issue opens automatically, labeled `data-source`, when a source stays broken for two weeks in
  a row, and closes itself once the source works again.

### Safeguards and privacy

- No analytics, no cookies, no accounts, no tracking.
- Every screen passes automated accessibility checks (contrast, keyboard, screen reader labels
  and roles), now run on every change.
- A privacy test checks that the site asks only its own server for anything, and, with "Fetch
  live City data" on, only the two City services it names.
- Conservatorship is never suggested for a parcel with a homestead exemption, the City's own
  record that someone lives there, or did.
- For an owner who is a person, flags about the owner appear only on parcels we are fairly sure
  are vacant; the facts about the parcel itself (deeds, sheriff sales, violations) are always
  shown, for every owner.
- The citywide list of owners holding many vacant parcels names organizations only; a person's
  other parcels are shown only on that person's own lot pages.
- No police suggestions, ever. The only suggestion to the City is Philly311, for physical
  conditions.

### Site pages

- About, Why this works, How to do it, Use this responsibly, How we find vacant land, Survey bus
  stops, Data status, Terms, Privacy, and Contact, all in plain language with no jargon.

