# Placekeepers design

Founding design, written 2026-10-04 after the owner interview and five research reports. This
document is authoritative. The decisions in section 2 belong to the owner and are not reopened
without the owner. Everything else may be refined by whoever builds it, with the change recorded
here.

Companion documents:
[EVIDENCE.md](EVIDENCE.md) (what the research supports),
[TRANSIT_METHOD.md](TRANSIT_METHOD.md) (how service and riders at SEPTA stops are measured),
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

As built (M2.3, 2026-10-05): a fourth chip, **Bus stops**, turns on SEPTA's bus and trolley stops,
colored by the transit comfort lens. While they are on, "What you can do nearby" lists the stops
that have a suggestion beside the lots, all nearest first, so a neighbor at a bus stop sees what
they can do there. A stop's card says what the stop is and how far, its priority with the main
reason and its badge, the first suggestion with its cost, and the first step; tapping it opens the
stop's details, and "Show on map" marks it without covering the map. On phones the chips row
scrolls sideways, so the fourth chip costs no room.

**Analysis view (desktop first).** For organizers, researchers, journalists and council staff.
- Left panel: lens sliders with presets, filters (owner type, vacancy confidence, access route,
  council district, registered community organization, neighborhood, zoning), and every layer.
- Right panel: the selected place's dossier, or a summary of the area on screen.
- Bottom drawer: a ranked table of everything matching the filters, with CSV and GeoJSON export and a
  printable report.

**Both:** share link, print, data freshness badge, settings drawer, "how to use this responsibly".

As built (M1.7, 2026-10-04):

- **What you can do nearby** (field view) lists the places with a suggestion that is turned on,
  nearest first: nearest to the middle of the map, or to the person once they tap "Near me". Each
  card says what the place is, its address from the lot page, how far away it is, how sure we are,
  its priority under the lens blend with the main reason and its evidence badge, the suggestion with
  its cost, and the first legal step. Tapping a card opens the lot page; "Show on map" and "Save to
  my list" sit beside it. Changed from the first plan, which listed the top places under the lens:
  standing on the block, the nearest place is the useful one, and the analysis view ranks by lens.
- **Near me** keeps the location on the phone: it is never saved or sent, and from the moment it is
  used the address bar and copied links leave out where the map is, because that would show where
  the person stands. "Stop using my location" ends it, and the map position returns to links once
  the person moves the map themselves.
- **Filters** (analysis view) are chips kept in the link: how sure we are and lot or building (the
  lots layer's own settings, so each has one control), owner type, already in LandCare, and the
  first step to get permission (5.4). Choosing chips shows only those; choosing none shows
  everything. Council district, community organization, neighborhood and zoning are still to come.
- **The drawer** under the map holds the ranked list (address, kind, how sure, score, main reason,
  first step to get permission and a save button; sorted by score, highest or lowest first; the
  first 50 rows shown and all of them downloadable), the plot of need against the first step (5.4),
  and saved lists.
- **Downloads**: the places in view, or a saved list, as CSV or GeoJSON, with what each lot page says
  about the owner (names and mailing address as the City publishes them, owner type and every owner
  flag; the GeoJSON keeps each flag's careful note and next step beside it) and a first line
  pointing to the terms of use (ETHICS.md, "Bulk export"). A download holds at most 500 places, the
  highest scores first, and says how many it left out.
- **Saved lists** stay in this browser, and the page says so beside them: name lists, add and remove
  places from cards, the ranked list or the lot page, and move a list to another device or person by
  downloading it and opening the file there (the page reads its own CSV and GeoJSON, or any text of
  nine digit parcel numbers).
- **A lot page never hides its parcel**: when a panel or the bottom sheet covers part of the map,
  the map flies with that part as padding, so the parcel lands where people can see it: after "Show
  on map", after choosing a place in a card, the list, the plot or a saved list, and when a link
  opens with a lot page. On a phone, where the lot page covers the whole map, "Show on map" closes it
  first.
- **Zoomed out, nothing counts a sample** (added 2026-10-05, issue #26): below zoom 13 the map
  draws only a sample of the vacant parcels, to stay light on phones (CONTRACTS.md section 4), so
  the analysis view's area counts, ranked list, plot and downloads are not shown there: each says
  plainly to zoom in, and the downloads are turned off with the reason. The field view's nearby list
  already starts at zoom 13, and never lists a parcel from the sample.
- A loading note covers the map until it has drawn once with its data. Measured on the production
  build in a headless browser drawing in software (slower than a phone's graphics chip), the map is
  ready about 1 to 2 seconds after the page opens with the sample data, and with the real data and
  the base map about 2 to 3 seconds at street zoom and 4.5 seconds for the whole city.
- The map's corner shows one short credits line that stays open: the base map's credit (Protomaps
  and OpenStreetMap, whose license asks for a visible credit) and "Data: City of Philadelphia and
  others", linking to the Data status page, which lists every source with its license, as each
  layer's "About this layer" does. Changed from the folded list of every source on the map, which
  covered a third of it when open.

As built (M1.10, interface review, 2026-10-04; details in
[VERIFICATION_INTERFACE.md](VERIFICATION_INTERFACE.md)):

- **Keyboards and screen readers.** Every panel passes automated accessibility checks (axe, WCAG
  2.2 AA) at phone and desktop sizes. The keyboard reaches the view's controls and lists before the
  map, in the order they appear. Escape closes what it opened and focus returns to where it was,
  including the panels that open over the map on phones.
- **Memorials without the map.** The memorials drawn on the map are also listed: "Memorials nearby"
  at the end of the field view's sheet (nearest first) and a Memorials tab in the analysis drawer
  (newest first). An entry says what the marker says before it is opened (how the person was
  traveling, the date and the place), never a name; opening it shows the same details as the marker.
- **Street blocks and crashes without the map** (issue #26). The street blocks drawn on the map are
  listed too: "Street blocks nearby" in the field view's sheet (nearest first) and a Street blocks
  tab in the analysis drawer (highest priority first), each with its street safety priority and
  main reason. With the crash layer on, the crashes drawn follow, each with its year, how badly
  people were hurt, who was involved and the nearest block. Opening an entry shows the same details
  as tapping the map.
- **Phones.** Phones get the field view held either way up; turned sideways, the open sheet runs down
  the left of the map. On the narrowest phones "Copy link" moves into the menu and Settings shows a
  gear (still named "Settings" for screen readers), so the top bar keeps to two rows even with a
  wide font or larger text. The note at the top (since v0.3, "Version 0.3: an early public
  version"; before that "Version 0.1: a first public version") can be hidden once read (this
  browser remembers, under `placekeepers:v1:note`). "Stop" sits beside the note that the location is in use, so the search box keeps its width. The chips row fades at its edge to show it scrolls. Buttons, chips and
  sliders are at least 40 pixels tall on touch screens.
- **Loading.** The data layers download beside the base map instead of after it has drawn, and the
  label font is asked for early. On an emulated mid range phone (four times slower than this
  laptop, on a Fast 3G connection) the map is usable after about 8 seconds at street zoom and 14
  for the whole city (11 and 17 before); on Fast 4G about 4 and 5 seconds. The first load before
  map tiles is about 0.5 MB at street zoom and 0.65 MB for the whole city, under the 2 MB budget.

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
| Amenity: bench, picnic table, drinking water, toilet, little free library | OpenStreetMap element id | v0.3 (M3.5) |
| Public place: library, recreation center, pool or sprayground, park drinking fountain | The City's object id, prefixed by its layer | v0.3 (M3.5) |
| Conditions reported to 311 on a block: dumping, lights out, graffiti | Street centerline segment (`seg_id`), the same block as the street safety layer | v0.3 (M3.5) |
| Bus shelter on the City's list | The advertising partner's site id (`pa-` and a number), linked to the SEPTA stop it serves | v0.4 (M4.5) |
| Street pole and the lamps the City lists on it | The Streets Department's pole number | v0.4 (M4.5) |
| Traffic calming device (speed cushion, hump or table) | The City's object id, and its street block (`seg_id`) | v0.4 (M4.5) |
| School crossing guard post | The City's object id | v0.4 (M4.5) |

As built (M2.1, 2026-10-04): a stop's identity is a Placekeepers key, `sp` and its SEPTA stop number
when first seen (`sr` for Regional Rail), which never changes. When SEPTA renumbers a stop in place
(a new number within 30 meters with a similar name, when the old one disappears or within a year
after), the stop keeps its key and the old number goes into its history, so SEPTA's ridership
counts, which use older numbers, and later neighbors' notes keep following the place. The map's
**Buses and trains** group holds every SEPTA stop and station in Philadelphia, with how often
service comes on a typical weekday, Saturday and Sunday and SEPTA's own weekday boardings (97.8% of
bus and trolley stops had a count on 2026-10-04), and the routes as context; both layers are off by
default. From M2.3 (2026-10-05) the stops carry the transit comfort lens (section 5.3) and show what
OpenStreetMap knows about their shelter, bench and light, matched to OpenStreetMap's stops the same
way the route survey sheets are (M2.4); the field view's Bus stops chip and using the lens turn them
on. OpenStreetMap's answers are published apart from SEPTA's records and joined in the visitor's
browser by the OpenStreetMap id (decision D1 of [VERIFICATION_V0_2.md](VERIFICATION_V0_2.md)): the
Open Database License would otherwise ask the combination to be shared under it, which SEPTA's
license does not let us grant. The method is in [TRANSIT_METHOD.md](TRANSIT_METHOD.md).

As built (M3.5, 2026-10-05): three new groups. **Benches, water, toilets and more** holds five
layers from OpenStreetMap, each labeled "as mapped in OpenStreetMap" (benches, picnic tables,
drinking water, public toilets, little free libraries), whose legends say many are missing and link
the survey guide, and the City's drinking fountains in parks. **Libraries, recreation centers and
pools** holds the City's Free Library branches, Parks and Recreation's recreation centers, and its
pools and spraygrounds (showing only those in service this year unless the setting asks for all).
**Conditions reported to 311** holds illegal dumping, street and alley lights out, and graffiti from
the last 90 days, each counted by street block and never shown at an address, filled while a
request is still open (a setting shows only those). Drinking water, the park fountains and toilets
are on by default in the field view, because a neighbor on foot needs them; everything else is off
in both views until someone turns it on. 311 requests describe physical conditions only, and the
details panel offers Philly311 as the next step, never the police.

As built (M3.2, 2026-10-05): a work of public art is known by the City's Percent for Art number
when the City lists it (`pa` and the number), else by its Wikidata item, else by its OpenStreetMap
element; the same work in two or three sources is one dot on the map (section 5.8).

As built (M4.7, issue #43, 2026-10-09): **Cooling and warming centers**, a layer in "Libraries,
recreation centers and pools", beside the pools, spraygrounds and park water, off by default in
both views. It draws the 86 places the City's Office of Emergency Management lists as warming or
cooling sites (87 records, one listed twice): libraries, Parks and Recreation sites, community
partners and Philadelphia Housing Authority community centers. A site listed as open is a filled
purple dot, one listed as closed or with no status a hollow ring; settings show sites for heat or
cold, for cooling only or for warming only, and all of them or only those listed as open.
Tapping one gives what the City lists: the address, open or closed, whether it is a warming site,
a cooling site or both, the hours, what it offers, room, access for people with disabilities, a
water station and a restroom, each "as listed", and the line "As the City listed them on <the day
the map copied the list> (the list was last changed on <the City's last edit>). Not live: sites
open and close with the weather, so call the site or 311 before you go." Never live hours.
**No credit line** (owner, 2026-10-09: "show without credit"): the legend and the tapped site
name no publisher, the map's tile file carries no attribution for it, and the layer's "About"
section lists the source without its credit line; nothing is asked of the Office of Emergency
Management. The registry still records the source, its address and that no license is stated
(the license `unstated_uncredited`, with `credit: false`), so the Data status page and the weekly
health check work.

**One place, one marker.** 55 of the sites are places the map already has: 27 Free Library
branches and 28 Parks and Recreation sites. A site is the same place when it is of the same kind
and stands within 5 meters of ours (the City copied the point), or within 150 meters with a word
of its name in common (so a hospitality hub 52 meters from a recreation center stays a place of
its own). While the sites are on, such a library or recreation center is left to the site's
marker, and tapping it shows the site and, under it, the library or center itself; with the sites
off, the library's own details say the City also lists it as a site.

**Playgrounds**, a layer in "Art and placemaking", off by default: Parks and Recreation's 462
playgrounds, each with the ages it is meant for (2 to 5, 5 to 12, or 2 to 12) and the year it was
installed when the City says. The lot page's Nearby names the nearest one (section 5.6).

As built (M4.3, 2026-10-09): two layers draw pictures rather than things, the City's aerial photos
by year and its copy of the 1860 atlas (section 5.11). A picture is known by its source and its
year (`aerial_photos` and `1996`), which is what a link keeps.

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

As built (M4.3, 2026-10-09): **pictures from another server** have their own registry form.
A source of kind `arcgis_tiles` lists picture services on an ArcGIS server, such as the City's
aerial photos of each year, with where their pictures are; a layer with `geometry: raster` draws
one such source, with a "Year" setting shown as a slider when there are several. The visitor's
browser loads the pictures from the City's server; nothing is copied, built or hosted here, and the
pipeline only checks each week that every service answers (section 8.4). Details in CONTRACTS.md
section 1.

The base map is a layer too (`basemap`, in the "Base map" group, added by M1.7): its switch turns
streets and place names off, leaving a plain background, and its look can be light or gray, so the
data stands out. Links made before it had a switch still show it. Its file is made by the site, not
the pipeline (CONTRACTS.md section 2), so the pipeline leaves it alone and the Data status page
judges it by the base map's own build date. The base map never draws works of art, memorials,
monuments, tombs, graves or wayside shrines, at any zoom (added 2026-10-05 after M3.2): their names
can name a person who died, and names of people who died come only from the hand curated memorials
file (ETHICS.md). The public art layer shows works of art without such names (section 5.8), and
everything else is drawn as Protomaps draws it.

### 5.3 Lenses

A lens is a set of factors. Each factor is converted to a 0 to 100 citywide percentile so factors
can be compared. A lens score is the weighted average of its factors; users move the sliders and the
map recolors instantly (the weights are applied inside the map style, so no recomputation is
needed). Every score has a "why" breakdown showing each factor's contribution.

| Lens | Applies to | Factors (evidence) | Release |
|---|---|---|---|
| Violence reduction | Vacant parcels | Untreated vacant lot or open abandoned building (Strong); shootings within about a quarter mile in the last 12 and 36 months (the outcome the trials measured; frames where care helps most); neighborhood poverty rate (the trial effect was concentrated below the poverty line); not already maintained by LandCare (Strong); tree canopy deficit (Mixed, low default weight) | First |
| Street safety | Street segments and crash sites | On the High Injury Network; people killed or seriously injured walking or cycling in 5 years; any fatal crash in 2 years; school within 400 m; later, busy bus stop nearby | First |
| Heat and shade | Vacant parcels | Neighborhood heat vulnerability, from the City's index (Context); few trees nearby, 2018 canopy within about a quarter mile (Mixed); few City trees on the block, within 100 meters (Mixed); people this would reach, residents per square kilometer of the tract (Context). FEMA's floodplain is shown beside the score, never in it | v0.3 (M3.1) |
| Transit comfort | SEPTA bus and trolley stops | People getting on each weekday (Context); no shelter (Weak); no bench (Weak); little shade nearby (Mixed); hot neighborhood in summer (Context); on the High Injury Network (Context); long waits at midday (Weak). A shelter or bench not yet surveyed counts halfway | v0.2 (M2.3) |
| Placemaking | Vacant parcels | People within a 5 minute walk (Context); everyday places within a 10 minute walk (Mixed); walkability (Mixed); far from a park (Context); no public art nearby, from the City's list and Wikidata (Context); on or near a commercial corridor (Mixed). The walking factors come from M3.3 (section 5.9) | v0.3 (M3.4) |

As built (M2.3, 2026-10-05): the transit comfort lens colors SEPTA's bus and trolley stops (the
stops layer's coloring setting offers the lens, waits or riders, and defaults to the lens), with
three presets: Balanced, Busiest stops first, and Heat and shade. Its one departure from the lens
rules: a shelter or bench no one has surveyed yet counts as 50, halfway, rather than being left out
(which let stops known only for heat and street rank first) or counted as missing (which scored a
stop as having nothing). The stop's page never calls a halfway answer the main reason and marks it
"not yet surveyed" in the "why" table, and every such stop gets the suggestion to survey it. Using
any lens (a slider or a preset) turns on the layer that draws its places, colored by that lens, and
a note says so; a lens whose places are not on the map says so above its sliders, with a button to
show them. The method is in [TRANSIT_METHOD.md](TRANSIT_METHOD.md) and the evidence in
[EVIDENCE.md](EVIDENCE.md), "Bus stop comfort".

As built (M4.5, issue #41, 2026-10-09): **a City shelter counts as a shelter.** The City publishes
its own list of the 487 bus shelters it runs with its advertising partner (DATA_SOURCES.md,
"Streets and stops"), and a SEPTA stop now carries how many of them stand there (`cs`). The lens
counts such a stop as sheltered whatever OpenStreetMap says. Where OpenStreetMap says the stop
has no shelter, the two disagree: neither wins silently. The stop's page says "The City's list
has a shelter here, but OpenStreetMap says there is none. One of them may be out of date: a
survey settles it. Until then the priority counts the City's shelter.", and the stop gets the
suggestion to survey it instead of asking the City for a shelter it already lists. Every stop's
page also says what the City's list says ("The City's list of bus shelters has a shelter here",
or that it has none), beside what OpenStreetMap says, which stays in its own records and is
joined in the browser (decision D1). On 2026-10-09, 462 of the City's shelters stand at 451 of
the 7,912 stops the lens scores; 393 of those stops change: 389 that no one had surveyed (their
shelter counted halfway) and 4 where OpenStreetMap says there is no shelter (Market St & 4th St,
Broad St & Spruce St, Olney Av & B St, Ridge Av & Hermitage St). Under the default weights each
drops about 11 points (10.7 to 21.4), and all 17 such stops among the 100 highest leave it (82 of
the 500 highest). The stops with a City shelter hold 19.7 percent of weekday boardings, against
the City's goal of 40 percent. The method is in TRANSIT_METHOD.md, "The City's shelters".

As built (M3.1, 2026-10-05): the **heat and shade lens** ranks the vacant parcels on the map for
where planting trees or greening a lot would cool people most. Each factor is ranked from 0 to 100
among the parcels on the map, as for the violence lens: the heat vulnerability of the parcel's census
tract from the City's Heat Vulnerability Index (the Department of Public Health and the Office of
Sustainability: how hot the tract gets on summer days, as satellites measure it, together with how
many of the people living there are more at risk in the heat, by twelve measures of age, health,
income, education, language and race); few trees nearby (the violence lens's 2018 canopy within
about a quarter mile, computed once and listed in both lenses); few City trees on the block (the
trees of Parks and Recreation's 2025 inventory within 100 meters of the lot, about the block scale
at which a study found trees cool the air most); and the people this would reach (residents per
square kilometer of land in the tract, from the Census survey table the pipeline already reads).
Presets: Balanced (the defaults 3, 3, 2 and 1), People most at risk, and Fewest trees. The lots
layer's **Color lots by** setting chooses the violence reduction lens (the default) or this one, and
moving either lens's sliders colors the lots by it, as M2.3 does for the stops. The legend, the
nearby cards, the ranked list, the plot, the lot page and downloads all follow the chosen lens, and
under the heat lens a lot's cards lead with its heat suggestions. Measured on 2026-10-05 under the
default weights, the lots of Fairhill average 75 and those of Upper Kensington 73 (in Fairhill the
heat vulnerability ranks about 86 of 100 and canopy covers about 6 percent of the land around a
lot), while those of Chestnut Hill average 12 and West Mount Airy 11 (canopy over 40 percent). A
lot at 3848 N 5th St in Hunting Park, with 2 City trees within 100 meters and 4 percent canopy,
scores 90.

**The floodplain is never a score.** Flooding is a different hazard from heat, and a lot in FEMA's
floodplain is neither a better nor a worse place to cool: it is a reason for care (plants must stand
wet ground, anything built follows the City's floodplain rules, water collects there) and a chance
for greening that soaks up rain. Raising scores there would steer greening toward flood zones for
the wrong reason, and lowering them would hide the lots where greening that holds water helps most.
So a parcel carries `fp` when at least a tenth of it lies in FEMA's 1 percent or 0.2 percent annual
chance areas (565 and 598 parcels on 2026-10-05), and its lot page shows a plain flood note beside
the score, in print too.

**Left out, and why.** Impervious surface and land cover: the City's 2018 land cover, from the
same survey as the canopy, is a 521 MB raster that needs a raster library the pipeline does not
have, and the Water Department's impervious surfaces date from 2015 (a 324 MB download); meanwhile
the heat exposure part of the City's index already measures how hot the ground gets, which paving
drives. People over 65 and under 5: two of the index's twelve sensitivity measures are already
about people 65 and older, so counting them again would double their weight, and the census table
the pipeline keeps holds no ages. The NOAA and CAPA Heat Watch street temperatures of Philadelphia
have no data file we could find.

**Heat, trees and flooding on the map.** Three layers in their own group, off by default in both
views, because their fills would compete with the lots' lens colors and the trees are many: heat
vulnerability by census tract (vulnerability, exposure or sensitivity, shaded by fifths of the
city's tracts, with the tracts the City rates very high outlined), the City's street and park trees
from zoom 14 (every tree, big shade trees, or small young ones that need watering, and a tapped
tree's kind and trunk size), and the floodplain (both areas, or the 1 percent annual chance
floodplain only).

**Suggestions.** Vacant lots get two greening suggestions, decided in the pipeline with the factors:
**plant shade trees on and along this lot** where the canopy around the lot is below the middle of
the map's places (20,222 lots on 2026-10-05), and **green this lot to cool the block** where its
tract's heat vulnerability is above the middle (21,091). Both lead with the lot's own permission
route, then the City's free street trees (the route shared with the shade trees at stops) and
TreePhilly's free giveaway trees, and both carry the displacement caution of ETHICS.md word for
word, like clean and green.

As built (M3.4, 2026-10-08): the **placemaking lens** ranks the vacant parcels on the map for where
a lot would most likely become a public place people use every day: a garden, a pocket park, a
place to sit in the shade, a spot for art. It is about use and welcome, never about crime
(EVIDENCE.md, "Placemaking"). Five of its six factors are ranked from 0 to 100 among the parcels
on the map; for the first three more ranks higher (section 5.9), for the parks and the art farther
ranks higher. The corridor factor is 100 or 0:

- **People within a 5 minute walk** (Context, default weight 3), **everyday places within a 10
  minute walk** (Mixed, 2) and **walkability**, the EPA's index (Mixed, 2): the walking measures of
  M3.3.
- **Far from a park** (Context, 2): the straight line distance from the parcel's point to the edge
  of the nearest park land of Parks and Recreation (parks, playgrounds, recreation centers,
  squares, greenways, nature areas and gardens: 479 of its 507 properties, leaving out its work
  yards, golf courses and planted traffic medians). Half the parcels on the map lie within 235
  meters of one, and 67 lie inside one.
- **No public art nearby** (Context, 1): the distance to the nearest of the 174 outdoor works on
  the City's Percent for Art list and the 69 in Wikidata (half the parcels lie within about a
  kilometer of one). OpenStreetMap's 410 artworks are not used: nothing worked out from them may be
  stored with the City's data in the lots (decision D1 of VERIFICATION_V0_2.md). Mural Arts'
  murals are in none of these lists, so the factor only knows part of the city's art, says so,
  and has the lowest default weight.
- **On or near a commercial corridor** (Mixed, 1): 100 when the parcel lies on one of the City's
  279 commercial corridors (shopping streets and centers the Planning Commission surveyed from
  2011 to 2017) or within 50 meters of one, else 0 (14,287 parcels, 9,652 of them lots).

The two distances are ranked, then rounded to the nearest 5: a straight line says nothing finer,
and it keeps the lots file smaller (the last paragraph of this note). Presets: Balanced (the
defaults 3, 2, 2, 2, 1, 1), Most neighbors, Where people already walk, and Far from a park. The
lots layer's **Color lots by** setting offers the lens beside the other two, and moving its sliders
or using a preset colors the lots by it.

**What it finds.** Measured on 2026-10-08 under the Balanced weights, the lots of Spruce Hill,
Bella Vista and Passyunk Square average 72 to 73, those of Fairhill 56 and Strawberry Mansion 44,
and those of Chestnut Hill 25 and Upper Roxborough 20. Because the lens values people and everyday
places within a walk, it ranks the dense rowhouse neighborhoods around Center City highest, and
they include some of the city's costliest. That is one reason every placemaking card carries the
displacement caution, and the reason for the Far from a park preset, which turns to places that
lack open space (Dunlap, Mayfair and West Oak Lane lead under it).

**Suggestions.** Vacant lots get up to six, decided in the pipeline with the factors. **Make a
place to sit in the shade** where more people live within a 5 minute walk than around half the
places on the map (18,765 lots on 2026-10-08); **start a community garden** where the lot is
farther from a park than half the places and at least 1,000 people live within a 5 minute walk
(19,762; the second rule, decided by the orchestrator on 2026-10-08, leaves out 891 lots where
almost no one lives, such as new developments by the river, the Navy Yard and industrial land near
the airport, since a garden needs neighbors to tend it and use it); **ask about a mural or other art** where no
work of the City's list or Wikidata stands within a 5 minute walk and many people live around
(15,666), linking only to Mural Arts' own request form, never copying its content; and **report
the illegal dumping, the dark street light or the graffiti to Philly311** where a street block the
lot faces (within 20 meters of it) has a request about it still open in the conditions layer's 90
days (650, 1,082 and 69 lots). Under this lens the first three lead a lot's card. They carry a
placemaking version of the displacement caution by the greening cards' rule (M4.1, below): inside
a displacement watch area the full card with the area's signs and the ways to protect neighbors,
elsewhere one line with the same link (decided by the orchestrator on 2026-10-08, because
"greening" does not describe a bench or a mural): "New gardens, seating and art can make a block
more sought after and raise nearby prices and rents. Pair them with protections for neighbors who
rent or who are behind on taxes." The greening suggestions keep the ETHICS.md wording. The reports
never lead, are about physical conditions only, and point to Philly311, never the police. A 311 count is
never a factor: it says that people asked, not how often a condition occurs.

**Left out, and why.** The area cells (the walking distance hexagons of section 5.9) are not
colored by this lens. Each lens colors one kind of place, so the cells would need a second lens
with its own sliders, and they carry only the walking measures, not the park, art or corridor
factors. OpenStreetMap's artworks are left out for the license reason above.

On 2026-10-08 the three new factors and the longer lists of suggestions made tiles/lots.pmtiles 8
percent larger (8.8 to 9.6 MB): the two distances about 5 percent once rounded (10 before), the
corridor 1 percent and the suggestions 2 percent.

**Proposed to the owner, not built (M4.7): "no playground within a short walk" as a factor.**
Measured on 2026-10-09 in a straight line from each parcel's point to Parks and Recreation's 462
playgrounds: 15,032 of the map's 40,416 vacant lots (37%) have none within 400 meters (a 5
minute walk as section 5.9 counts it), and 1,381 none within 800 meters; the middle lot is 331
meters from one. The factor would mostly repeat "far from a park", because playgrounds stand on
the park land that factor measures: 13,048 of those 15,032 lots are already farther from a park
than half the places. Ranked like the park distance and added at weight 1 to the Balanced
preset, 1,609 lots' scores would move 5 points or more and about 770 lots would enter the top
fifth (as many would leave it); at weight 2, 11,635 would move 5 points or more and about 1,380
would swap. 13,920 of the 15,032 lots have at least 1,000 people within a 5 minute walk. The
recommendation is not to add it as a factor, since it is close to "far from a park", and to let
the lot page's nearest playground and the playgrounds layer carry it; if the owner wants it,
weight 1 changes the order least. It is the owner's call.

**Displacement watch** is not a priority lens. It is a caution overlay, shown wherever a suggestion
could raise property values. It changes no score and no order, and it ranks no neighborhood.

As built (M4.1, 2026-10-08): **what the owner sees.** A layer, "Displacement watch: signs that
prices are rising", in a new group, **Prices and protections**. It is on by default in the analysis
view, where organizers plan, and off in the field view, where the cards already carry the caution
and a phone map has little room. Each watch area is drawn the same way, a pale slate gray fill with
a dashed edge under the lots, however many signs it has, so nothing reads as a ranking. Tapping an
area (or, close in, its edge, because from zoom 16 a tap inside asks the City which parcel is there)
shows "Signs that prices are rising here", the census tract and the neighborhood at its center, each
sign that holds with what was measured against the whole city, the other signs measured, the rule,
the ways to protect neighbors, and what the watch cannot tell. Wherever a greening suggestion (clean
and green, plant shade trees, green the lot to cool the block, shade trees at a bus stop) sits in a
watch area, its card adds, under the ETHICS.md sentence word for word, "This place is in a
displacement watch area, with signs that prices are rising here: ..." and links to the Neighborhood
Gardens Trust, community land trusts, the City's Homestead Exemption, its Longtime Owner Occupants
Program (LOOP) and help with a tangled title, each to its own official page with the day it was last
checked. Outside every watch area the card keeps the one line caution (decision D12, kept by the
orchestrator because it stays protective). The box of a lot the City's land agencies list as
available (issue #36) carries the same caution by the same rule. The lot page, its print (which
lists each protection with its address) and downloads (a `displacement_watch` column and a note)
follow the same rule, and a lot page opened from a link knows its area from its dossier. Shade trees
at bus stops carry the caution too, which before M4.1 they did not.

**Shown once per page** (decided by the owner on 2026-10-08, decision D5 of
VERIFICATION_V0_3.md, and written into ETHICS.md). Before, a lot page in a watch area repeated the
full card on every greening and placemaking suggestion, up to five times, long on a phone. Now a
lot page shows the full card once, at the top of "What you can do", under the heading
"Displacement watch", with each caution its cards carry, the area's signs and the ways to protect
neighbors; the listing box and every greening and placemaking card below keep their one line
caution, word for word, with a button, "See the signs here and the ways to protect neighbors", that
moves to it. Its print does the same: the section comes first, and each caution ends with "See
"Displacement watch" above." The field view's list of nearby places shows the full card once, above
its cards, when any of them lies in a watch area; since the cards there may lie in different areas,
each such card keeps its caution and its own area's signs, with a button to the ways to protect
neighbors. A card shown on its own, such as a tapped bus stop's details, keeps the whole card, and
downloads list the protections once in their notes. Outside every watch area nothing changes.

**The areas** are the City's 2020 census tracts (408). Tracts, not hexagons: the renter share is
published only by tract, a tract holds enough home sales for a middle price to mean something
(most have well over 100 in three years, where a two block hexagon has a handful), and tracts
follow the City's standard boundary that the parcels follow.

**The five signs**, each measured against the whole city, so the watch follows the city's own
market rather than a fixed price:

| Sign | What is measured | It holds when | Too few to tell |
|---|---|---|---|
| Home sale prices | The middle (median) price of the homes sold in the last three years up to the newest recorded sale, against the three years that ended five years before (on 2026-10-08: September 2023 to September 2026 against September 2018 to September 2021) | The tract's middle price rose at least 25 percentage points more than the city's (the city's rose 28%, from $180,000 to $230,000, so 53% or more) | Fewer than 50 sales in either period |
| Buyers that are companies | The share of those recent sales whose buyers' names are a company's, by the rule the lot pages use for owners | At least 15 points above the city's share (27%, so 42% or more) | Fewer than 50 recent sales |
| The City's assessed values | The middle change in the City's market value of the tract's homes, each home against itself, from the tax year five years before the newest to the newest (2022 to 2027), the span the City's LOOP looks at | At least 30 points above the city's middle change (69%, so 99% or more) | Fewer than 50 homes |
| Renters | The share of occupied homes that are rented (Census Bureau, 2020 to 2024) | 60% or more (the city: 48%) | Fewer than 100 occupied homes |
| The City's Market Value Analysis | Reinvestment Fund's 2026 analysis for the City, by block group | At least one of the tract's block groups is one where it finds rising pressure: home prices climbing out of reach of what longtime residents earn | Not in the analysis |

A sale counts when it is a deed for more than a token price that is not a sheriff, condemnation or
adverse possession deed (the lot pages' rule), not a Land Bank deed (a public sale at a set price),
for one property (a price shared over several is an allocation), of a home (a single family or two
to four family house as OPA lists it today), built in or before the year of the sale (an earlier
sale was of the land or the house before). The price is this property's share, as the lot pages show it.
For the assessed values a home counts when it stood at least two years before the earlier tax year
and was valued at $10,000 or more then, so a new house is never counted as a rise.

**The rule**: an area is in the watch when at least two signs hold and at least one of them is
about prices rising (sale prices, assessed values or the Market Value Analysis). Company buyers and
renters say who is exposed to rising prices, not that prices are rising, so together they are not
enough: without this, a few Center City tracts where most homes are rented and many condominiums
are bought by companies would be watch areas while their prices are flat.

**What it found on 2026-10-08.** 96 of 408 tracts, holding 157,139 of 679,428 occupied homes (23%),
are watch areas: most in North, West and Southwest Philadelphia and lower Germantown (all six tracts
of Hartranft, all five of Haddington and of Strawberry Mansion, five of seven in Cobbs Creek, four
of five in Kingsessing, three of six in Hunting Park), where homes that sold for $50,000 to $90,000
five years before now sell for $80,000 to $170,000, and companies often buy 40 to 60 percent of
them. Because vacant lots gather in the same neighborhoods, 26,227 of the 40,776 vacant lots on the
map (64%) and 389 of the 1,987 bus stops with a shade trees suggestion lie in one, so most greening
cards on the map now carry the full caution. The sanity check: Fishtown's four tracts show no sign
(prices rose 7% to 30%, slower than the city's 28% in three of them, and companies bought 14% to 18%
of the homes), and only one of Point Breeze's six tracts is a watch area (its south side, where
values rose 138% and companies bought 42%); prices there rose earlier and have since risen far more
slowly than the city's (from a 1% fall to a 6% rise in the other five tracts). Stable areas such as
Somerton, Fox Chase, Mayfair and Bustleton have at most one sign. Signs by count: sale prices 76
tracts, company buyers 66, assessed values 78, renters 110, the Market Value Analysis 41; 93 tracts
had too few home sales to judge prices.

**What it cannot tell**, said on every tapped area: these are signs in public records, not a
forecast. They cannot tell who has moved away or why, what rents are today (no public record of
rents covers the city; the Census survey's middle rent on the card since M4.7 averages five
years), or who lives in an area, and an area outside the watch can still feel rising prices. A middle price moves when the kind of homes sold changes (more renovated houses, more new
ones) as well as when the same homes cost more; the assessed values, which compare each home with
itself, are the check on that. Names of buyers are read only to tell a company from a person and
are never kept (docs/ETHICS.md).

**Left out, and why.** Census block groups: too few sales for a middle price in most of them. Rents:
no public, citywide record of today's rents (the Census survey's five year middle rent is shown
on the card as context since M4.7, below, never as a sign). The Market Value Analysis's own sale prices and investor counts: the
City's deed records give the same at the tract level, with our own published rule. The 2023 edition
of the analysis: the 2026 edition, which the City put on its open data hub on 2026-07-16 under the
same terms, is newer and sorts every block group by displacement pressure; the source reads both, so
going back is one registry line. Neighborhoods where prices rose earlier and have leveled off are
not watch areas by design: the watch is about pressure now, and their cards keep the one line
caution.

The method in code is `pipeline/src/placekeepers/derive/displacement.py`; the files are in
docs/CONTRACTS.md (sections 3, 4 and 6).

As built (M4.7, issue #43, 2026-10-09): **neighborhood context on the card.** Tapping a watch
area now also shows "Rents, incomes and empty homes here", from five tables of the Census
Bureau's survey (2020 to 2024, the same file family as the renters sign):

- **Renters paying half their income or more on rent** (with utilities), as a share of the renter
  households whose share could be computed, and how many households that is;
- **the middle rent** (rent plus the utilities the renter pays) and **the middle household
  income**;
- **empty homes**: how many of the area's homes, and the share, and in a fold, why they are
  empty as the Census sorts them (for rent; for sale; rented or sold, not yet moved into; seasonal
  or occasional use; held off the market for other reasons, such as repairs, a family's legal
  trouble or abandonment).

Each number carries its margin of error ("give or take 9 points", the Census Bureau's 90 percent
margin) and the city's own figure from the Census's row for the whole city (a city's median cannot
be added up from its tracts), and a note under them says these are survey estimates over five
years, rough in a small area. Shares follow the Census Bureau's formulas for a proportion and a
sum; a margin is rounded up at a half and never shown as 0. A share is shown only with at least
100 renter households (or homes) behind it, the watch's own floor; otherwise the card says there
are too few to tell, as it says when the Census computed no middle rent or income. Measured on
2026-10-09: the city's figures are 29.5% of renters paying half their income or more (give or
take 1 point), a middle rent of $1,397 and a middle income of $61,953, and 9.2% of homes empty;
of the 408 tracts, 377 have enough renters for the share, 383 a middle rent, 375 a middle income
and 386 enough homes for the empty share. The margins are wide: half the tracts' rent burden
shares are give or take 14 points or more.

These numbers are **context, never a sign**: they change no watch area, no score and no order,
and like every number on the map they are published only for watch areas (ETHICS.md); the other
tracts' numbers stay in the pipeline (`derived/tract_context.parquet`) for proposals like the one
below. The wording never frames a number as a reason to buy or invest: the rent burden line says
that rising rents fall hardest on the renters it counts. The method in code is
`pipeline/src/placekeepers/derive/tract_context.py`; the files are in docs/CONTRACTS.md (sections
3 and 4).

**Proposed to the owner, not built (M4.7): rent burden as a sign.** A sixth sign, "many renters
already pay half their income on rent", would hold where that share is at least 10 points above
the city's (29.5%, so 39.5% or more) with at least 100 renter households. Measured on 2026-10-09
it holds in 105 tracts, 46 of them already watch areas. Counted like the renters and company
buyers signs (who is exposed, so a watch area still needs a sign about prices), it would add 8
watch areas, holding 14,415 occupied homes and 1,054 of the map's 40,416 vacant lots (the watch
has 96 areas and 26,227 of those lots now). Counted as a sign about prices, it would add 21
areas (33,501 homes, 1,697 lots); at 15 points above the city, 6 or 15; at 5 points, 10 or 29.
The margins argue for care: requiring the whole margin above the line leaves 11 tracts and 1 new
area. The recommendation is the first form (10 points, a sign of exposure), and it is the owner's
call.

**Population density** never multiplies a violence score. It appears only as "people this would
reach".

### 5.4 Feasibility: the second axis

Need and feasibility are kept apart. Feasibility (who owns the parcel, which legal route applies, how
long that route takes) is a filter and a sort, and the analysis view can plot need against
feasibility. This answers the organizer's real question: where does care help most, *and* where can
we actually get permission.

As built (M1.7, 2026-10-04): feasibility is the first step to get permission (the tile property
`rt`): no clear route yet, Community LandCare, a garden agreement or license from the City or the
Land Bank, ask PHDC, ask the public agency, or ask the owner. It is a category, never a score, so it
is a filter and an axis of the plot, always in that fixed order, and never a sort (changed from "a
filter and a sort", per ETHICS.md, "Things we do not build"). The plot shows each place in view as a
dot: across, its priority under the lens blend; down, its first step. Choosing a dot opens the lot
page, and the ranked list holds the same places for keyboards and screen readers. Dots of places
that share a score spread apart within their row (a "beeswarm", added by M1.10), so each can be
chosen; a row grows to fit them, up to a limit.

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
| Vacant lot where little shade covers the area, or where heat hits people hardest (M3.1) | Plant shade trees on and along the lot; green the lot to cool the block | The lot's permission route, then the City's street tree request and TreePhilly's giveaway trees |
| Vacant lot with many neighbors, far from a park, or with no public art nearby (M3.4) | A place to sit in the shade; a community garden; ask about a mural or other art | The lot's permission route (for a mural, the wall's owner and Mural Arts' request form) |
| Vacant lot facing a block with an open 311 request about dumping, a dark light or graffiti (M3.4) | Report it to Philly311 | Philly311 |

Funding is shown beside suggestions where it fits: the City's community violence prevention grants
and Feet First Philly's public space mini grants (see ROUTES.md).

As built (M1.10, 2026-10-04, decision D12 of VERIFICATION.md): every greening suggestion carries
the ETHICS.md caution word for word, "Greening can raise nearby prices. Consider pairing it with
protections.", with a link to the ways to protect neighbors: on the nearby cards, the lot page and
its print, in settings, and as a note at the top of any download that holds one. From M4.1
(2026-10-08) the displacement watch decides how much the card says: inside a watch area it adds the
area's signs and links to each protection, shown once per page or list with each card pointing to
it; outside one it keeps this one line (section 5.3).

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
   over time; permits, violations, demolitions; later, what stood here in old maps. As built
   (M4.3, 2026-10-09): under the story of the lot (M4.2), "See this lot in old aerial photos"
   turns on the aerial photos at the oldest year (1959 from 2026-10-09) and shows the lot on the
   map (on a phone the lot page closes first, as for "Show on map"); with live City data off the
   button is off and says why (section 5.11).
5. **Nearby**: shooting counts, crashes, memorials, LandCare lots, gardens, schools. As built
   (M4.7, 2026-10-09): also the nearest playground, with its park's name and how far it is in a
   straight line from the lot's point, rounded to 10 meters, and whether that is within a 5 or a
   10 minute walk as section 5.9 counts them, with a button that turns on the playgrounds layer.
6. **Sources and freshness**, and "report a correction".

The dossier is built from the weekly snapshot and, when the setting "fetch live City data" is on
(default on), refreshed from the City's public APIs when opened. Any parcel can be opened by clicking
it, not only candidates.

As built (M1.6, 2026-10-04):

- **Opening a lot page.** Tapping a lot on the map, a search result, a card in "What you can do
  nearby", or a link with the parcel in it opens its page: a full screen sheet on phones, the right
  panel on larger screens. Close in (zoom 16 and up), tapping any other spot asks the City's parcel
  map which parcel is there, outlines it, and opens its page, built live. With live data off, only
  parcels on our list open, from the snapshot. However it was opened, a lot on the map shows the
  same score breakdown and flood note: from the map's data when the map has it, else from the
  lot's own dossier, which carries the same values (issue #31, 2026-10-05).
- **Where each part comes from.** A line at the top and a line under each part say whether it is
  live from the City (with the time), from the weekly snapshot (with its date), still loading, or
  why a lookup failed (no answer within 10 seconds, the City could not be reached, or it answered
  with an error), with a "Try the City again" button. A failed part shows the snapshot instead, or
  says plainly that it cannot be shown. Parcels with no published dossier say so and show what the
  City's servers say right now.
- **Who owns it** shows the names and mailing address as the City publishes them, the kind of owner
  and why, each flag in its three parts, the deed fraud notice wherever the owner may be a person
  (a person, an owner whose type we could not tell, or a possible estate), help for families (the
  Tangled Title Fund and Fraud Guard) beside any flag on a private owner, and taxes, always dated
  July 2025 with a link to the Tax Center. A many parcels flag opens the owner's list. When the
  City names a different owner than the snapshot, the flags about the earlier owner are left out.
- **History** shows every deed newest first (the date on the deed, the document in plain
  words, the price, from and to), the City's assessments as a small chart and the same numbers as a
  table, and the L&I timeline (violations, permits, demolitions, unsafe and imminently dangerous
  notices, clean and seal) when live, or the snapshot's L&I summary. Since M4.2 (below), one
  timeline of every record, with or without live data.
- **Nearby** shows the snapshot's counts (shootings in the lot's hexagon, LandCare lots and gardens
  within 500 feet), or for a parcel with no dossier, live counts within 500 feet, with buttons that
  turn on the matching layers.
- **Address search** (in the field view's search box and at the top of the analysis view's left
  panel) uses the City's address service for addresses and intersections; a nine digit parcel number
  opens that lot directly, even with live data off.
- **Print** gives one page per lot: the summary, what you can do, who owns it, recent history and
  sources, ending with "Not legal advice." Since M4.2, recent history is the story of the lot and
  the timeline's 10 newest records.
- Deeds show the date on the deed and the adjusted price rounded to the dollar (this property's
  share when one deed covered several), as the City's property page does, in the snapshot and live
  alike. The City's
  page lists only plain deeds; the lot page lists every deed, sheriff deeds and other kinds too.
- The browser builds exactly the pipeline's flag sentences: a shared set of cases with the
  pipeline's answers (`pipeline/tests/fixtures/wording_parity.json`) is checked by both test
  suites, so the two cannot drift apart.
- **Lots listed as available** (issue #36, 2026-10-08). The City's list of public property is the
  list the Philadelphia Land Bank's "View Properties Map" shows. Every lot page on that list gives
  the lot's status in plain words and what it means for neighbors ("held for affordable housing",
  "someone has applied"). A lot its land agencies list as available gets a box at the top of
  "What you can do": the date of the list (the day the pipeline fetched it, since its records
  carry no date), the side yard route first where the lot may go to the neighbor next door, the
  Land Bank's note that it may turn down any sale or lease (in our words, never copied from its
  site), a link to the Land Bank's map, and the credit to the City's Department of Planning and
  Development (Land Management). On the map, the vacant lots layer has a setting, also a filter
  in the analysis view, "Listed as available by the City's land agencies". No price and no buy
  button (ETHICS.md). Where the displacement watch marks the lot's area, the box carries the one
  line caution pointing to the full displacement card shown once above it, and elsewhere the one
  line caution with its link (M4.1, section 5.3). A card in the list of nearby places for such a
  lot says "Listed as available by the City's land agencies" and, where the lot may go to the
  neighbor next door (the map's `ly`), gives the side yard route as its first step, as the lot page
  does (after the v0.3 review, finding F7).

**The story of the lot, as built (M4.2, issue #38, 2026-10-09).** What the owner will see in
History, top to bottom:

- **The story of this lot**: one or two plain sentences built only from records, each followed by
  where it comes from ("From L&I's demolition records."). In order of preference: a completed
  demolition ("A building stood here until 2011, when the City demolished it.", or "when it was
  demolished under a private permit.") and a permit for new construction from that year on; an unsafe or
  imminently dangerous notice still open; the City's clean and seal work; a sheriff sale; the
  vacancy lists ("The City's list of vacant land of October 4, 2026 includes it, as a list of June
  2024 did."); PHS LandCare's care since its year. Never a guess: a record dated in the future, a
  demolition not marked completed, or a tank removal tells no story. A lot with none of these says
  the records do not tell a story yet.
- A spot under the story for one more control: M4.3 (issue #39) puts "See this lot in old aerial
  photos" there (`historyExtra` in `web/src/components/dossier/Dossier.svelte`).
- **Timeline**: every record newest first, grouped by year: deeds (the document in plain words, the
  price, to whom), violations (the date and the City's own title, never a case number; violations
  of one day together, repeats counted), permits (the permit type and the kind of work in plain
  words, with its status), demolitions (by the City or under a private permit), clean and seal,
  unsafe and imminently dangerous notices (open or resolved), and the dated vacancy records we hold:
  the City's vacant land and vacant buildings lists, L&I's June 2024 vacant land list and Clean &
  Green Philly's June 2024 buildings list (both as Clean & Green Philly kept them), and the year PHS
  LandCare began caring for the lot. Seven switches (sales and transfers, violations, permits,
  demolitions, clean and seal, notices, vacancy and care records) turn each kind off and on; the
  choice stays in this browser. The six most recent years show first, with a button for the rest.
  A record the City dated in the future says its date may be wrong.
- Then the deed table and the assessments as before. Deeds before 2000, in the table and the
  timeline, say they come from records the City says may be incomplete. The weekly copy holds every
  deed `rtt_summary` has for each candidate parcel, back to 1974 (checked for every candidate on
  2026-10-09), and every assessment year the City's `assessments` table holds (2015 to 2027, and a
  handful from 2013 and 2014).
- **The same timeline with live data on or off.** The weekly copy carries every L&I record of the
  candidate parcels, all years (violations and permits from 2007), read with the same query the
  page sends to the City live, with days as the City's sites show them; live data only adds newer
  records. A parcel whose L&I records the weekly copy does not hold says so and offers live data,
  never "no violations". The pipeline and the browser group records the same way, checked by both
  test suites on one shared set of cases (`pipeline/tests/fixtures/timeline_parity.json`).
- **Phones stay fast.** The timeline's records sit in their own files (`dossiers/history/`), one
  beside each dossier file, fetched only when History comes into view (or the page is printed).
  On 2026-10-09: 933 files, 57.5 MB on disk and 7.1 MB as served compressed; the largest, 115 kB
  compressed. The dossier files are unchanged.
- **Print** lists the story and the timeline's 10 newest records, leaving out the kinds switched
  off, and says how many more are online.
- The L&I Property History search (li.phila.gov, listed on OpenDataPhilly since 2023) was
  evaluated and not used: it is a search page over the same City tables we read (permits,
  violations, case investigations, appeals, business licenses), not a dataset, and it holds no
  deeds, demolitions, clean and seal, unsafe notices or vacancy records (docs/DATA_SOURCES.md).

**Owner information as built (M1.3, 2026-10-04).** What the owner will see, and the choices behind it:

- Every parcel with a sign of vacancy, and every parcel on the map, has a ready made dossier (about
  78,000). Owner type comes from the City's own list of public property first, then from the owner
  name (an LLC is a company, "Philadelphia Land Bank" is the Land Bank, a church is a nonprofit).
  The map's lots carry the same owner type, so the analysis view can filter by it.
- Flags appear exactly as ETHICS.md words them, each with what it means, why to be careful and a
  protective next step. Public owners get only the flags about the property (taxes, sheriff sales,
  resales, violations); the flags about a person (mail elsewhere, possible estate, years since a
  sale, many vacant parcels) are for private owners only.
- An owner who gets mail on the parcel's own block (the house next door, across the street) is not
  "absentee": many lots are side yards of the neighbor who owns them.
- "Years since the last sale" counts only sales on the open market: token transfers of $100 or less
  and sheriff sales are listed in the history but are not "sales". The City's deed records are
  complete only from 2000; before that the assessor's last sale is used.
- "Owner holds many vacant parcels" starts at five parcels the map calls vacant with high or medium
  confidence. Owners are matched by their exact names, so one owner under two spellings counts
  twice, but two different owners are never merged. The citywide list of such owners
  (`tables/owners.json`) holds organizations only; a person's other parcels are listed only on the
  lot pages of their own parcels (decided 2026-10-04 by the orchestrator, docs/VERIFICATION.md D3).
- Conservatorship appears only for a private parcel the map calls vacant with high or medium
  confidence, never for a parcel we are not sure about, which may be someone's home. Changed from
  the first plan, which listed it for every private lot. It never appears for a parcel with a
  homestead exemption, at any confidence: that is the City's own record that someone lives there,
  or did (decided 2026-10-04 by the orchestrator, docs/VERIFICATION.md D1).
- Every dossier of a private owner with a flag links to the Tangled Title Fund and Fraud Guard, and
  every dossier whose owner may be a person shows the deed fraud notice, even where the notes about
  the owner are held back (decided 2026-10-04 by the orchestrator).
- On a parcel the map does not call very likely or probably vacant, which may be someone's home,
  the notes about an owner who may be a person (where they get mail, a possible estate, tax debt,
  other parcels they own) are held back, and the page says why. A possible estate is never shown
  on a parcel with a homestead exemption. Organizations keep every note, and the facts about the
  parcel (deeds, sheriff sales, violations) are always shown (decided 2026-10-04 by the
  orchestrator, docs/VERIFICATION.md D5 and D6).
- A lot page whose dossier was built without deeds, assessments or violation records (a parcel
  outside the downloaded candidates) says those records are not in the weekly copy and offers live
  City data; it never says "No deeds on record." or shows zero violations for them (D9).

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

As built (M1.5, 2026-10-04):

- **Memorials** are one quiet marker per person the Police record as killed (their table has a row
  per person; 928 placed markers on 2026-10-04, 428 of them people walking, cycling or riding a
  scooter, shown by default; a setting adds everyone else). A name is never drawn on the map: it
  appears when someone opens a marker, and only while "show names" is on, which also hides the
  public memorial link. A curated name that matches no Police record (for example a death before
  2019) gets its own marker. "Request removal" goes to the dedicated removal address once the owner
  creates it. Until then (decision D7 of VERIFICATION.md, M1.10) no text promises an email: the link
  opens the Contact page, which says a private address is coming soon, that the map shows no names
  meanwhile, and that a request can be made in a GitHub issue ("Ask for a memorial to come down"),
  which anyone can read; the memorial details and the legend say the same.
- **Crashes** cover 2015 to 2024 (84,942 on 2026-10-04): each year from the newest City slice that
  covers it, every crash record once, filterable by years, by how badly people were hurt and by who
  was involved. The newest year of PennDOT records is 2024; deaths since then appear as memorials.
- **The street safety lens** scores every street block (40,453 City centerline segments). A crash
  within 10 meters of an intersection counts for every block that meets there, which takes the
  place of a separate intersection layer. "People killed or seriously injured walking or cycling"
  counts the five most recent PennDOT years; "someone killed here in the last 2 years" uses the
  Police records. The analysis view shows its sliders beside the violence lens; the field view's
  Streets chip still shows the High Injury Network, and the blocks layer is under "More layers".

As built (issue #37, 2026-10-08): **Parking problems reported (Laser Vision)**, a layer in the
streets group, off by default in both views and not part of any lens. It shows where people using
Philly Bike Action's Laser Vision app reported vehicles blocking sidewalks, crosswalks, corners,
curb ramps and bike lanes over the 12 months to the newest day with reports, used with Philly Bike
Action's permission (confirmed by the owner 2026-10-08). Zoomed out it is a heat map in quiet blues;
from zoom 13 it turns into the hexagons themselves, each about a block across (H3 resolution 10),
shaded in five fixed classes. A setting picks the kind: every kind, on a sidewalk, in a bike lane,
on a crosswalk, on a corner, or blocking a curb ramp. Tapping a hexagon gives its reports by kind
and the window, says the counts come from people using one app and are not every problem, frames
them as evidence for physical fixes (curb extensions, bollards, daylighted corners, protected bike
lanes, loading zones), gives the City's transportation office as the place to ask (route
`otis_contact`), and credits Philly Bike Action with a link to its map. Counts only, never a
single report: an area shows only with at least 5 reports, and a kind within it only with 5 of its
own. No word anywhere about tickets, the Parking Authority, reporting drivers or enforcement
(ETHICS.md, "Policing"). On 2026-10-08: 1,112 areas holding 23,254 of 26,060 reports. Details in
DATA_SOURCES.md ("Sources checked 2026-10-08") and CONTRACTS.md section 4.

As built (M4.5, issue #41, 2026-10-09): **streets and stops.** Three City layers join the
**Streets and memorials** group, and one the **Buses and trains** group, each off by default in
both views, so they never crowd the lots and the High Injury Network:

- **Street poles and the lamps the City lists**: every pole the Streets Department lists (203,096),
  close in only (zoom 15 and up), as a small dot colored by the lamp the City lists on it: an LED
  lamp, the older high pressure sodium lamp, a lamp of a kind it does not name, or a hollow ring
  where no lamp is listed (such as a signal pole or one of PECO's). A setting shows every pole,
  only poles with a lamp, or only lamps the City does not list as LED. A tapped pole gives its
  number, which Philly311 asks for when a light is out. The words are always "poles" and "lamps
  the City lists", never "brightness" or "lit": the list says what is installed, not what works
  tonight. Each street block says how many poles the City lists along it and how many of their
  lamps are LED, and each block of "Street and alley lights reported out" (311) says the same
  beside its requests, so a neighbor sees both what is installed and what people reported out.
- **Traffic calming the City lists**: every speed cushion, hump or table (1,780, from 2009 to
  September 2026), with the day it went in and its street. A street block with some says "Traffic
  calming here since 2023: the City lists 2 speed cushions, humps or tables on this block." A High
  Injury Network block where people were killed or seriously injured walking or cycling and none
  is recorded says "No traffic calming recorded here yet." (1,045 blocks on 2026-10-09). Where the
  street may qualify for the City's program (a collector or local street that is not a state road,
  the crash sites' rule; 125 of those blocks), the block offers the existing request, "Ask for
  traffic calming on this residential street", beside that line; on an arterial it says the
  City's speed cushions are for residential streets and to ask OTIS about other changes. A
  memorial with the traffic calming request says beside it what the City lists on its block (282
  of the 297 with the request have none recorded).
- **School crossing guard posts**: the 758 corners where the City posts a crossing guard, each
  with the nearest school on the City's list within 400 meters (727 have one). A safety service
  that helps children and everyone else cross near schools, never described as enforcement
  (ETHICS.md, "Policing").
- **Bus shelters the City lists** (in Buses and trains): a blue ring around the stop each shelter
  serves; section 5.3 says how the lens counts it.

The poles have a file of their own, `tiles/poles.pmtiles` (2.3 MB, zoom 15 only, like the City's
trees), so the rest of the map never loads them. The counts on every street block and the two new
point layers made `tiles/streets.pmtiles` 13 percent larger (11.6 to 13.1 MB on 2026-10-09), almost
all of it in the close in tiles that carry every block.

**Street lights as a lens factor: proposed, not built** (the owner decides). Measured on
2026-10-09:

- The City's list barely varies where it could matter. 95 percent of the 130,241 lamps it lists
  are LED, and only 3,186 of the 36,309 blocks with a lamp have any that is not. Lamps per 100
  meters of block have a median of 2.6 to 2.8 in every street class. Only 162 of the 7,912 stops
  the transit lens scores (2 percent, with 25,927 weekday boardings) and 474 of the 30,322 vacant
  lots of high or medium confidence (1.6 percent) have no lamp listed within 30 and 50 meters.
- Where lamps are missing from the list, the reason is often whose pole it is. 23,332 of PECO's
  poles list no lamp, and they gather in Council Districts 6, 9 and 10, where 55 to 60 percent of
  poles list a lamp against 66 to 70 percent in Districts 1, 2, 3 and 5. A factor would partly
  measure which poles the City tracks.
- The list says what is installed, not what works. OpenStreetMap says 17 stops are not lit, and
  the City lists 1 to 12 lamps within 30 meters of every one of them. The working signal is 311's
  lights out requests, which the map already uses for the "report a dark street light" cards.
- What a factor would do: in the transit comfort lens, "no lamp the City lists within 30 meters"
  (100 or 0, badge Weak, weight 1) would lift those 162 stops by about 3.5 points (median 46.6 to
  50.1), moving 5 of them into the 100 highest and 13 into the 500 highest. In the violence lens
  it would touch 1.6 percent of lots. Street lighting's evidence is Moderate for crime
  (EVIDENCE.md), but the transit lens makes no crime claim, and in the violence lens the factor
  would barely vary.

The recommendation is to leave street lights out of every lens for now and keep them as context
beside the 311 requests, as built. Revisit if the City publishes which lamps are out (or PECO's
lamps), or if the owner wants the transit factor above at a low weight.

### 5.8 Public art

As built (M3.2, 2026-10-05): a **Public art** layer in a new **Art and placemaking** group, one dot
for each work, colored by its kind (murals and wall paintings, sculptures and statues, mosaics, and
other kinds such as installations, fountains and monuments), with a switch for each kind and one for
works inside buildings. It is off by default in both views: several hundred dots would crowd the
lots and streets the first releases are about. The placemaking lens (M3.4, section 5.3) measures how
far each lot is from the City's and Wikidata's works.
Tapping a work shows its kind, title, artist, year, material and where it is, as its sources give
them, and links to each source: the City's record, OpenStreetMap, Wikidata, a Wikipedia article,
and any page OpenStreetMap or Wikidata names (often the Association for Public Art's page on the
work). Beside a mural it links to Mural Arts Philadelphia's own list of murals, and every work
links to OpenStreetMap's editor, where anyone can add or fix a work; changes reach the map within
about a week.

**Sources.** The City's Percent for Art list (224 works on view on 2026-10-05), OpenStreetMap's
artworks from the weekly extract (410) and Wikidata's (69). Mural Arts' catalog is never copied: its
terms forbid building a database from it. philart.net, the Association for Public Art's map,
Philadelphia's Magic Gardens' mosaic map and Parks and Recreation's list of art in its parks wait
for their owners' agreement (docs/DATA_SOURCES.md, "Public art").

**One work, one dot.** The same work often appears in two or three sources. The pipeline finds
them by OpenStreetMap's link to the Wikidata item, or by names and place (and artist), cautiously:
two works whose sources name different artists are never joined, and an unnamed work joins a named
one only when each is the other's single candidate a few steps away. On 2026-10-05, 703 records
are 651 works, 50 of them found in more than one source (48 in two, 2 in all three). Each source's
record stays apart in the published file, with only what that source says, and the browser joins a
work's records when someone opens it, so OpenStreetMap's data never shares a record with the City's
(decision D1 of VERIFICATION_V0_2.md, as for SEPTA's stops). The rules are in docs/CONTRACTS.md
section 4.

**Memorial artworks.** Some murals and plaques remember a person. Names of people killed come only
from the hand curated memorials list (ETHICS.md), so a work any source marks as a memorial is shown
only as "Memorial artwork", with its sources: no title, artist, year or inscription, in the
published files or on the map, and the base map draws no labels of art or memorials (section 5.2). The rule is cautious on purpose. On 2026-10-05 it covers 45 works,
all of them monuments to famous people, wars or events (statues OpenStreetMap tags as memorials,
such as Joan of Arc and the Washington Monument, and war memorials), whose names stay one tap away
at their sources. A hand curated list of memorial artworks whose names may be shown would let the
owner restore those names; it is not built.

The layer carries the "Not about violence" badge (EVIDENCE.md, "Murals and public art").

### 5.9 Walking, cycling and people

As built (M3.3, 2026-10-05). **What the owner sees:** a new group, **Walking, cycling and
people**, with three layers, off by default in both views (their fills would compete with the
lots' lens colors, and the placemaking lens, section 5.3, brings their measures to the lots):

- **How walkable each area is (EPA)**: the U.S. EPA's National Walkability Index for each of the
  city's 1,336 census block groups, a few blocks each, trimmed to the land so the rivers stay
  clear. The index scores from 1 to 20 how well an area supports walking: street corners and
  transit count for a third each, and two measures of how well homes, jobs and shops are mixed for
  a sixth each (the EPA's data of about 2017 to 2019, published in 2021). Two settings: shade by
  the index or one of its parts, and compare within Philadelphia (by fifths of the city's block
  groups, the default) or with the whole country (the EPA's own four classes). Compared with the
  country, nearly all of Philadelphia is above average (760 block groups) or among the most walkable
  (551), with 25 below average and none least walkable, so the comparison within the city shows its
  differences better; the legend says so.
- **People and places within walking distance**: hexagons about two blocks across (the area cells
  of section 5.1; 3,335 whose middle lies in the city and not on water), shaded by what lies within
  a short walk of each one's middle: the people who live within a 5 minute walk (the default), the
  kinds of everyday places within a 10 minute walk, or the street corners within a 5 minute walk,
  each in five fixed classes so a shade means the same number everywhere.
- **Traffic stress for people on bikes (DVRPC)**: every street the Delaware Valley Regional
  Planning Commission rates, colored by its level of traffic stress, from level 1, calm enough for
  most people of all ages, to level 4, only for the most fearless riders (two blues for calm
  streets, an orange and a deep brown for stressful ones, never an alarm red). A setting shows
  every street, only the stressful ones or only the calm ones. Tapping a street tells its level,
  what it means, a calmer other direction, the kind of bike lane, the speed of traffic and the
  lanes. Zoomed out the map shows only stressful streets and streets with a bike lane or a trail,
  to stay light; the legend says so. On 2026-10-05: 39,258 streets, 15,800 at level 1, 15,779 at
  level 2, 6,041 at level 3 and 1,638 at level 4.

**How the measures are made, in plain words.** Every distance is a straight line, as the crow
flies, from a parcel's point (or a hexagon's middle). At about 80 meters a minute, a 5 minute walk
is counted as 400 meters and a 10 minute walk as 800. A straight line reaches a little farther than
a walk along a grid of streets (where the walk is about a quarter longer), and it crosses rail
lines, expressways and rivers that people on foot cannot; the legend says so. Walking along the
streets was left out on purpose: the City's centerlines miss most paths through parks, and a route
for every parcel would cost far more than these counts, which take about 5 seconds for the 58,325
parcels on the map.

- **People within a 5 minute walk** add up the 2020 census population of every block whose
  internal point (a point inside the block) lies within 400 meters. Philadelphia's blocks are
  small, half of them under a hectare (about 100 by 100 meters), so counting each block at one point
  moves few people across the line. The census counts come from the Census Bureau's bulk
  redistricting file, which needs no key.
- **Everyday places within a 10 minute walk** count which of seven kinds lie within 800 meters: a
  Free Library location, a recreation center (Parks and Recreation's recreation, older adult and
  environmental education centers), a pool or sprayground not listed as out of service, a drinking
  fountain in a park, a school (public, charter or private), a grocery store or market that takes
  SNAP (the USDA's list: supermarkets, super stores, grocery stores, specialty food stores and
  farmers markets, not convenience stores), and a SEPTA bus, trolley, subway or train stop with
  service. Kinds come first; among places with as many kinds, more places rank higher, counting at
  most five of a kind, so a street with many bus stops does not outweigh a library. Places just
  across the city line are not counted, because most of these lists cover Philadelphia only. The
  drinking fountains are the City's; OpenStreetMap's 30 drinking water points are left out, so its
  share alike license stays off the lots and these layers (19 of them have one of the City's
  fountains within 800 meters anyway).
- **Street corners within a 5 minute walk** count the points within 400 meters where three or more
  segments of the City's street centerlines that people can walk along meet (arterials,
  collectors, local streets and walking connectors; not expressways, ramps or driveways). More
  corners mean shorter blocks and more ways to get somewhere on foot. Where a divided road is
  drawn as two lines, its crossings count twice.
- **Walkability** is the EPA's index of the block group the parcel lies in.

**Factor fields for the placemaking lens (M3.4).** Each parcel on the map carries `f_walk`,
`f_neighbors` and `f_dest`, each ranked from 0 to 100 among the parcels on the map like every lens
factor, but with more ranking higher (more people, more places, more walkable), because a place
many people walk to and past is where a placemaking project serves most people; a lens that wants
the gaps instead needs a field of its own. Street corners (`f_corners`) stay off the lots: the
EPA's index counts intersections already, and each factor adds about 3 to 4 percent to the lots
tiles (the three together about 10 percent, 8.0 to 8.8 MB, on 2026-10-05). The hexagons carry all
four, ranked among the cells, for any later lens on cells (M3.4 left the cells out, section
5.3). CONTRACTS.md section 4 has the
details, and `derived/walk_factors.parquet` holds the counts behind each parcel's ranks. The
placemaking lens (M3.4, section 5.3) is built on them. SEPTA's bus and trolley stops on
the street carry the same three factors, measured from each stop and ranked among the stops, for
any lens that wants the people and places a stop serves.

**Checked on 2026-10-05**, from a point at each place: by Rittenhouse Square about 11,700 people
live within a 5 minute walk, with 102 street corners and 5 of the 7 kinds of places (no
recreation center and no park drinking fountain within 800 meters), walkability 16.7; near East
Passyunk Avenue and Tasker Street about 6,300 people, 100 corners and all 7 kinds, walkability
18.0; near Kensington and Allegheny about 7,400 people, 94 corners and all 7 kinds, 16.2; in Somerton
in the far Northeast (near Bustleton Avenue and Byberry Road) about 1,800 people, 27 corners and 6 kinds
(no library), 15.7; in Chestnut Hill about 1,500 people, 24 corners and 6 kinds; on Ridge Avenue in
Roxborough about 2,200 people, 26 corners and only 3 kinds. Among the parcels on the map, half have
at least 3,769 people within a 5 minute walk (a quarter fewer than 2,913, a quarter more than
4,783), 64 street corners and 6 of the 7 kinds.

**Left out, and why.** DVRPC's sidewalk gap products (its sidewalk coverage ratio and sidewalk
priority score) are built on Overture Maps roads, which are under OpenStreetMap's Open Database
License, while DVRPC offers them under its own license without saying how that carries over, so
their terms are unclear (asking DVRPC is an owner action). DVRPC's sidewalk lines themselves have
clear terms but are an inventory from 2018 aerial photos that was never checked on the ground;
turning them into gaps by block is work for a later milestone. Walk Score's terms forbid storing
its scores. Details are in DATA_SOURCES.md, "Walkability and people".

### 5.10 The Land Bank in numbers

As built (M4.4, issue #40, 2026-10-09). A page of its own, `land-bank/`, reached from the site menu
of every page ("The Land Bank in numbers"), for the Philadelphia Land Steward Union's campaign and
anyone else who wants the facts. It serves by being accurate: neutral sentences, no slogans, and it
speaks for neither the Land Steward Union nor the Land Bank.

- **What it counts.** Properties the Philadelphia Land Bank, the Philadelphia Redevelopment
  Authority, PHDC and the City conveyed, from the City's deed records since 2014: a plain deed from
  the agencies to someone outside them, each property once. Moves between the agencies,
  corrections, releases of old restrictions and agreements recorded as deeds are left out and
  counted apart (DATA_SOURCES.md, "The Land Bank in numbers"). On 2026-10-09: 3,235 properties
  from January 2014 to August 2026, 1,032 of them by the Land Bank (from 2017).
- **What the page shows**, for all four agencies together or one at a time (a choice kept in the
  link, `?agency=PLB`): a sentence with the totals and the moves between agencies; conveyances per
  year, stacked by agency; who the buyers are (people, companies, nonprofits, other public bodies)
  per year and as shares; side or rear yards per year, labelled as our inference, with how it was
  checked and the City's own counts by program for fiscal years 2017 to 2023 beside it; the
  prices the deeds record (the middle price and the share at a token price) with why a recorded
  price is not always money paid; counts by today's council districts; the weekly count of lots
  listed as available, which starts on 2026-10-04 and says so; what the numbers cannot show; and
  every source with its date.
- **Charts** follow the lot page's assessment chart (thin columns, a rounded top, recessive grid,
  the highest value labelled, each value on hover), with a legend for two or more series, colors
  in a fixed order checked for color blindness, and the same numbers in a table under each chart.
- **Downloads.** Each section has a CSV download built in the browser from the published file. Its
  first line points to the terms of use, as every export does (ETHICS.md, "Bulk export").
- **Aggregates only.** No names, no addresses and no parcel numbers on the page, in its file or in
  its downloads. Organizations are never named, not even in totals. The buyers' names are read
  only in the pipeline, to tell a person from a company, to check the parcel next door and to
  recognize the same buyer twice, and are never kept.
- **The program is mostly unknown.** The deeds do not name it. The one inference, a single lot to
  a person who owns a home touching it, is always labelled as ours, with its checks. The City's
  Legistar API (Council's resolutions) refuses requests without a token, and the Land Bank's own
  board documents may not be republished without PHDC's permission; both would name the program
  for every conveyance (owner items, DATA_SOURCES.md).

### 5.11 Then and now: old aerial photos and the 1860 atlas

As built (M4.3, 2026-10-09). **What the owner sees:** a new group in the layer panel, **Then and
now**, with two layers, off by default in both views:

- **Aerial photos by year**: the City's own aerial photographs of the whole city, one for each year
  it has them: 1996, 2000, 2004, 2005, 2008 to 2012, 2014 to 2020, and 2022 to 2025, twenty in
  all. A slider moves through the years (2025 by default; 1996 and 2000 are black and white), and
  a second setting sets how strongly the photo shows, so today's streets and labels can show
  through. The photo lies under every other layer and under the base map's labels,
  so lots, streets and memorials stay on top. The legend says the year, that the photos were taken
  from a plane in spring, and credits the City.
- **1860 atlas (Hexamer and Locher)**: the atlas the City hosts, fitted to today's map by the
  Greater Philadelphia GeoHistory Network. It covers Center City and Northern Liberties only, which
  the legend says, and starts at 80 percent strength so today's streets show through; the map asks
  only for the area it covers.
- On the lot page, under History, **"See this lot in old aerial photos"** (section 5.6).

**Privacy.** These are the site's first pictures from another server. Nothing is asked of the
City's picture server until someone turns one of the layers on, in either view, on a lot page, or
from a link. They follow "Fetch live City data": with it off, their switches are off and say why
(with a button to turn live data on), the lot page's button is off, and a link that names them, or
settings saved earlier, cannot turn them on; the map then asks the picture server for nothing, and
the address bar drops them. The Privacy page says what the picture server sees (the internet
address and which part of the city is on screen; no cookies and no referrer). The privacy end to
end test checks a default load, the lot page button, the atlas, and a link with live data off.

**Never copied.** The pictures stay on the City's servers (its ArcGIS Online organization,
`tiles.arcgis.com`): the browser asks for the tiles of the chosen year, and Placekeepers builds,
stores and hosts none of them. The City's terms on every service are its standard ones (the City
keeps its rights, as is, hold harmless), which allow this (DATA_SOURCES.md, "History and
displacement").

**Health.** These layers are not built by the pipeline, so the weekly refresh checks instead that
each of the 24 services still answers with a picture (section 8.4); a broken service shows on the
Data status page, which says plainly that some pictures may not show, and opens the usual issue
after two weeks in a row.

**Added on 2026-10-09, as the owner decided.**

- **Older photos on the same slider**: 1959 and 1975 (photos the City hosts for the Delaware Valley
  Regional Planning Commission) and 1999 (for the U.S. Geological Survey), 23 years in all, from
  1959. Their services state no terms, so the registry records them as not stated; the legend
  credits each year to its own publisher and says so, and says where the 1975 photos have gaps (the
  far south, around the airport and the Navy Yard). They come from the same City server, behind the
  same "Fetch live City data" switch, and are checked each week like the City's own years. The lot
  page's button now opens at 1959, the oldest.
- **1937 redlining map (HOLC grades)**, a layer in Then and now, off by default in both views: the
  Home Owners' Loan Corporation's 1937 areas and grades of Philadelphia, as Mapping Inequality
  traced them, in the 1937 map's own colors, muted, with each area's label on it. The legend lists
  the four grades in plain words, a short neutral account of what redlining was and that the grades
  say nothing about the people who live there today, the credit with its link, and "Non commercial
  use only" with the license. Tapping an area gives its grade and a link to its 1937 description at
  Mapping Inequality; the descriptions are never copied onto the map. Its license (CC BY-NC 2.5)
  allows non commercial use only, so its data stays apart from everything under the site's own
  terms: a file of its own, named with its license in the manifest, never in a download or any
  other file, and the Data status page marks the source "Non commercial use only". The file is the
  site's own, so the visitor's browser asks no one else for it, and the layer needs no live data.

**Left out, and why.** The GeoHistory Network's other maps that the City hosts (the 1875, 1895 and
1910 atlases, the 1942 and 1962 land use maps, the 1928 aerial photos) and PhilaGeoHistory's own
layers: they wait for the Athenaeum of Philadelphia's permission. A swipe to compare two years side
by side: not built; the strength setting and the slider cover most of it. Details in
DATA_SOURCES.md.

## 6. Finding vacant land without depending on one source

The City's vacancy indicator stopped being accurate in June 2024, and that alone ended the original
project. On 2026-09-27 the City recalculated both indicator layers (28,771 lots and 9,519 buildings),
and rebuilt them again on 2026-10-04 (28,770 lots and 9,569 buildings, every record dated that day).
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
| Owner occupied homestead exemption (OPA) | Added after the study (decision D1, 2026-10-04, docs/VERIFICATION.md): the City's own record that someone lives there, or did. A reason against: lowers a building one level (high to medium, medium to low); on a lot it is shown without changing the level |

The kind comes from the footprint, not from which City list a parcel is on: no footprint, or a
demolition after the footprint was drawn, means lot. This moves 1,110 parcels from the City's building
list to lots. LandCare lots stay in the vacant set, marked "already maintained".

| Kind | High | Medium | Low |
|---|---|---|---|
| Lots, the study (2026-10-04) | 24,166 | 6,147 | 10,465 |
| Buildings, the study (2026-10-04) | 6,553 | 2,876 | 8,503 |
| Lots on the map (2026-10-04, with the homestead rule) | 24,162 | 6,160 | 10,454 |
| Buildings on the map (2026-10-04, with the homestead rule) | 5,045 | 3,819 | 9,054 |

The homestead rule moves 1,552 high buildings to medium and 579 medium buildings to low; it changes no
lot's level, and 610 lots carry it as a reason against. The map's counts change every week;
`manifest.json` carries the current ones.

Parks, gardens, parking, rail, utilities, cemeteries, water and streets never show as vacant (1,727
parcels). High and medium show by default; low sits behind the confidence filter. Where the City and
two of our records agree, 24 of 26 lots checked in the aerial photos were empty and 2 were unclear.

**Output per parcel:** kind (lot or building), confidence, the agreeing signals in plain words, and the
signal count, shown on the map and in the dossier. The pipeline runs these rules in `pk derive`
(`pipeline/src/placekeepers/derive/vacancy.py`, milestone M1.2); the reasons for and against travel
in the tile as bits of `rs` (CONTRACTS.md section 4), and the details panel turns them into sentences.

**If the City indicator breaks again:** keep its last copy for twelve months, labeled with its date,
then drop it. Without it, high lots become medium (about 29,000 lots stay on the map at medium) and
2,387 buildings stay high (2,936 under the study's rules, before the homestead rule). The health check also flags the City list as stale if its date stops
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
  The last good snapshot of every source is kept on a rolling GitHub release (see 8.4), so the map
  survives even if a source vanishes, which is exactly what the original project lacked.
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
  reloading data. As built (M1.7), the ranked list, the cards and the plot use the parcels drawn in
  view, from the tiles, with addresses and owner details from the dossier shards; no separate table
  is needed yet.
- Address search uses the City's address service from the browser. Live dossier refresh uses the
  City's Carto SQL API (both allow browser requests without a key). If they fail, the snapshot is used
  and the dossier says so.
- No analytics, no cookies, no accounts. Saved lists live in browser storage with export and import.
- Accessibility: WCAG AA contrast, colorblind safe palettes, keyboard navigation, and the ranked list
  as an accessible alternative to the map.

### 8.4 Automation and health

Built in M0.4 (2026-10-04). Changes from the original plan are marked.

- `ci.yml`: on every pull request and every push to `main`: pipeline lint, registry check and tests
  (with tippecanoe), the tests of the workflow helper `.github/scripts/refresh.py`, and the web app's
  tests, type check and build, all on small fixtures. Added by M1.7: end to end tests of both views at
  phone (375 by 812) and desktop sizes, with Playwright in Chromium, against the production build on
  the sample data (`web/e2e/`, `npm run e2e`).
- `refresh.yml`: every Monday at 10:00 UTC, and on demand from the Actions tab. Five jobs:
  - `pipeline` restores the last good snapshot of every source from the rolling `data-snapshots`
    release, runs `pk all` with tippecanoe, and packs the new good snapshots. Snapshots are never
    published in plain form (decision D2, VERIFICATION.md): they are encrypted with the
    `PK_SNAPSHOT_KEY` repository secret (GnuPG, symmetric AES256) before they leave the runner and
    decrypted on the next run; only those two steps see the key, and they run nothing but `gh` and
    the standard library helper. Without the secret, or when last week's copies do not decrypt, no
    snapshot is saved that week and the run carries on without them. It reuses the base map
    extract (a release asset named after its Protomaps build date) for up to 30 days, then makes a
    new one; if that fails, the saved one is used.
  - `save` puts the new snapshots, the new manifest and any new base map on the release, and removes
    what they replace for good (never emptying it).
  - `site` builds the web app and copies the published data and the base map into `dist/data/`,
    after checking the GitHub Pages limits (no file over 100 MB, site under 1 GB).
  - `deploy` publishes the site with GitHub Pages.
  - `issues` opens one issue per source labeled `data-source` when the source is stale or failing in
    this run and was also stale or failing in the previous run. The issue says, in plain words, which
    source, since when, the error, and what the map does meanwhile. Each week it stays broken the
    issue gets a comment; when the source is ok again the issue closes itself.
- To test the alarm, a manual run can make one source's download fail on purpose (the
  `break_source` input); the source keeps its last good copy, exactly as in a real outage.
- Pictures the browser loads from another server (M4.3, the City's aerial photos and 1860 atlas,
  endpoint kind `arcgis_tiles`) have no copy to keep. Instead, every run checks that each picture
  service still answers (its description and one tile, a second apart, about 45 seconds for 24
  services), whatever the source's cadence. A service that does not answer turns the source stale
  with its name in the message; the Data status page says some pictures may not show, and the
  issue opened after two runs says the same rather than "the map keeps the last good copy".
- Least privilege: the jobs that install or run packages (`pipeline`, `site`) only ever hold a read
  token. The jobs that can write (`save` for release assets, `issues` for issues) install nothing and
  run only `gh` and the repository's standard library helper, so a compromised package can never
  reach a token that writes. `deploy` alone can publish Pages.
- If the `pipeline` or `site` job fails, nothing is deployed and the site keeps its previous version.
  If only `save` fails, the site still updates and next week starts from the older saved copies.
  GitHub tells the account that last changed the workflow's schedule about failed scheduled runs (by
  email, depending on that account's notification settings).
- Changed from the plan: the rolling release keeps only the latest good copy of each source (about
  100 MB) and the base map, not every week's copy, so it stays small. Week by week history can be
  added later as dated releases if it proves useful.
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
- **Displacement watch** appears wherever greening could raise values: areas with signs that
  prices are rising, where greening cards add the ways to protect neighbors (section 5.3).
- **Terms of use** say the site is for community care and lawful use, not speculation.

## 10. Contributions and takedowns

- Benches, shelters, murals, trees and similar go into OpenStreetMap. The site links to a short guide
  and recommends the StreetComplete phone app, which asks simple questions such as "does this bus stop
  have a shelter?". OpenStreetMap currently knows about shelters at only about 300 Philadelphia bus
  stops, so this survey is a real gap neighbors can fill.

  As built (M2.2, 2026-10-04): the pipeline reads Geofabrik's Pennsylvania extract of OpenStreetMap
  every week (`osm_philadelphia`, docs/DATA_SOURCES.md) and the map has a **Shelters and benches at
  stops** layer (`stop_amenities`, in `tiles/amenities.pmtiles`, where later amenities such as water
  and toilets will go) in the **Buses and trains** group, beside SEPTA's stops and routes (M2.1): a
  stop with a shelter or roof, a bench but no shelter mapped, neither, or not yet surveyed, which is
  a hollow ring so that unknown never looks like missing. A shelter or bench drawn on its own counts
  for the nearest stop within 10 meters when the stop does not answer itself. On 2026-10-04
  OpenStreetMap had 829 of SEPTA's 7,927 bus and trolley stops in the city: 97 with a shelter or
  roof, 12 with a bench only, 236 with neither, 484 not yet surveyed. Its stops are OpenStreetMap's,
  named by their OpenStreetMap element; M2.3 joins them to SEPTA's stops by SEPTA's stop number,
  then by distance. The layer is off by default in both views, because a city full of rings for
  unsurveyed stops would crowd the lots and streets that v0.1 is about; from M2.3 SEPTA's own stops
  carry the same answers for the transit comfort lens. The guide is the **Survey bus stops** page, linked from the layer's "About this
  layer", from its "not yet surveyed" legend entry, from a tapped stop, and from the How to do it
  and Contact pages. StreetComplete only asks about stops already in OpenStreetMap, so the guide
  also shows how to add a missing stop with the app's Things overlay or a note. Answers reach the
  map within about a week.

  As built (M2.4, 2026-10-05): a **Survey a route** page (`survey/`) for neighborhood groups. Pick
  a SEPTA bus or trolley route, a direction and how many people or pairs share it, and get a survey
  sheet: the route's stops in Philadelphia in SEPTA's order, what OpenStreetMap shows at each one
  now (shelter, bench only, neither, not yet surveyed, or not found in OpenStreetMap), Yes and No
  boxes for a shelter, a bench, a waste basket and a light, a box for "needs repair", and a notes
  column. Split among volunteers, each part prints on its own pages with its own time estimate
  (ours, labeled as such: about 3 miles an hour from stop to stop and a minute at each stop),
  safety tips, and how to get the answers into OpenStreetMap with StreetComplete or, without a
  phone app, in OpenStreetMap's own editor. It prints in black and white on letter paper; on a
  phone each stop is a card, and what someone ticks stays in that browser only. Trolley sheets say
  to leave out the tunnel stations. The page is linked from the survey guide (which gained a
  section on surveying a route as a group), from the shelters and benches legend and a tapped
  stop, and from a route's details: tapping a bus, trolley or subway route line now opens it. On
  2026-10-05 there are sheets for 123 routes (117 bus, 6 trolley); OpenStreetMap matched about
  660 of SEPTA's stops on them, so most rows read "not found in OpenStreetMap" for now.
  As built (M4.5, 2026-10-09): the City's own list of bus shelters is public after all (the
  design once said no list existed), and the map reads it (section 5.3). OpenStreetMap and the
  survey remain the way to record benches, lights and shelters the City's list lacks or that have
  come and gone since its last change in January 2025; where the two disagree about a shelter,
  the stop's page says so and suggests a survey.
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
6. Public art (M3.2): ask philart.net, the Association for Public Art, Philadelphia's Magic Gardens
   and Parks and Recreation whether the map may include their art lists (docs/ROUTES.md section 6),
   and decide whether famous monuments that sources mark as memorials may show their names, from a
   hand curated list (section 5.8).
7. The Land Bank in numbers (section 5.10): optionally ask the Clerk of City Council for a Legistar
   API token (Council's resolutions name the program and the date of approval), ask PHDC for
   permission to use the Land Bank's board documents or for a list of dispositions by program, and
   ask the City whether its Land Management dashboard table, which states no license, may be
   reused. The page works without any of them and labels the program as our inference.
