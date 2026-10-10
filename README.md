# Placekeepers

A free, public map that helps Philadelphia neighbors and organizers find vacant lots and
dangerous streets, and the lawful way to do something about them.

**Live site:** https://holdthedoorhoid.github.io/placekeepers/

## Who it is for

Placekeepers is built for two kinds of people, often on the same block: a **neighbor** standing on
the street with a phone, who wants to know what they can do about the empty lot on the corner, and
an **organizer** at a desk, who wants to compare many places at once and find where care would help
most. Both share the same map, settings and links, so a link one person copies opens the same thing
for the other.

Placekeepers revives [Clean & Green Philly](https://github.com/CodeForPhilly/clean-and-green-philly),
a Code for Philly project that closed in 2025 when the City's vacancy data stopped being reliable.
We combine many City records on purpose, so no single broken source can take the map down again.
Read [Why this works](https://holdthedoorhoid.github.io/placekeepers/why/) for the Philadelphia
research behind it.

## What you can do with v0.4

**On your phone, on the block.** Search an address or tap "Near me" to see "What you can do
nearby": the closest lots and streets that could use care, each with why it matters, how sure we
are, and the first lawful step.

**At a desk, across the city.** Blend the violence reduction and street safety lenses with
sliders, filter the map, sort a ranked list, see a plot of need against how hard a place is to get
permission for, download the results as CSV or GeoJSON, and save lists that stay in your own
browser.

**Every lot's own page.** Who owns it and their mailing address, as the City publishes them;
flags such as an absentee owner or a possible estate, each written with what it means, why to be
careful, and a protective next step; and the first lawful step to get permission. Under History,
"The story of this lot": a plain sentence or two built only from records, then one timeline of
every sale back to 1974, violations, permits, demolitions and the dated lists that called the lot
vacant. Under "Rules for this lot": whether it is in a historic district, its zoning and overlays,
federal brownfield records, and every appeal and hearing still to come.

**Street safety and memorials.** The High Injury Network, years of crash records, and a quiet
marker for each person the Police record as killed while walking, cycling or riding a scooter.

**Transit comfort.** Every SEPTA bus and trolley stop and route, scored for where a shelter, a
bench or shade would help riders most, with a suggestion and its first lawful step at each stop.
Switch it on with the "Bus stops" chip, or "Buses and trains" in Settings. The "Survey bus stops"
guide and the printable "Survey a route" kit show how to help map what OpenStreetMap does not
know yet.

**Heat and shade.** A lens for where planting trees or greening a lot would cool people most, with
its own suggestions, plus the City's trees, neighborhood heat vulnerability and the floodplain.

**Placemaking.** A lens for where a vacant lot would most likely become a place people use every
day: many neighbors and everyday places within a short walk, far from a park, no public art nearby.
Its suggestions are a place to sit in the shade, a community garden, a mural, and reports of
dumping, a dark street light or graffiti to Philly311. It is about use and welcome, never about
crime. Walkability, people and places within walking distance, and traffic stress for people on
bikes are layers of their own, and so is public art from the City, OpenStreetMap and Wikidata.

**Displacement watch.** Census tracts where public records show signs that prices are rising,
including home sale prices, companies buying homes and rent burden. It changes no score. Inside
one, greening and placemaking suggestions add ways to protect the neighbors who live there now, and
tapping the area shows rents, incomes and empty homes from the Census Bureau's survey, each with
its margin of error.

**Then and now.** The City's aerial photos from 1959 to 2025 on a year slider, the 1860 atlas, and
the 1937 redlining map. The photos and the atlas load from the City's servers only when you turn
them on; the redlining map comes from this site, in a file of its own under Mapping Inequality's
non commercial license. Each lot page has a button, "See this lot in old aerial photos."

**The Land Bank in numbers.** A page counting the properties the Land Bank, the Redevelopment
Authority, PHDC and the City have sold or transferred since 2014, by year, by agency and by kind of
buyer. Neutral, aggregates only, with a download for each section.

**Streets and stops.** The City's bus shelters, which the transit comfort lens now counts; the
street poles and lamps the City lists; its traffic calming; and school crossing guard posts.
Hearings still to come, historic districts, zoning overlays and brownfield sites are layers of
their own under "Land rules and hearings." Cooling and warming centers and playgrounds join the
places around you.

**Lots listed as available, and parking problems.** Show only the lots the City's land agencies
list as available, with the side yard program first where the lot is eligible and no prices. A
heat map of parking problems reported with Philly Bike Action's Laser Vision app, shown with its
permission, as evidence for fixing the street itself.

Also benches, water, toilets, libraries, recreation centers and pools, and 311 reports of dumping,
dark streetlights and graffiti, without a lens of their own. Every layer, score and suggestion can
be switched on or off in Settings.

## What it does not do yet

Names of people killed are not shown. We want the Bicycle Coalition and Families for Safe Streets
to weigh in first. Removal requests go through a public GitHub issue for now; a private email
address is planned.

Organizing tools, such as printable packets and a notice for neighbors, are planned for the next
release. Transit Forward Philadelphia's stop audits wait on permission, philart.net, the
Association for Public Art and Philadelphia's Magic Gardens wait on theirs, and the Athenaeum of
Philadelphia's old maps wait on its own. See the [roadmap](docs/ROADMAP.md).

## How the data stays fresh

Every Monday, GitHub downloads every source again, checks it, and keeps the last good copy of
anything that fails, clearly labeled with its age. The
[Data status page](https://holdthedoorhoid.github.io/placekeepers/status/) shows where every
source stands right now.

## Using it responsibly

Placekeepers publishes facts that can help a neighbor and, in the wrong hands, could hurt one. We
warn people rather than hide information, and design the site so the responsible choice is the
easy one. Read [Use this responsibly](https://holdthedoorhoid.github.io/placekeepers/responsibly/)
on the site, or the full rules in [docs/ETHICS.md](docs/ETHICS.md).

## Credit

Placekeepers continues the idea behind Clean & Green Philly, built by volunteers at Code for
Philly from 2023 to 2025, and credits it throughout. It reuses none of that project's code today,
but does use its final snapshot of parcel tax debt from July 2025 (MIT license), credited on the
Data status page. If any of its code is reused later, that code will keep the project's MIT
notice in the file header and be listed in a NOTICE file, as the project's own rules require. No
NOTICE file is needed until then.

Map data comes from the City of Philadelphia and other public sources. Transit schedules and
ridership come from SEPTA, under its open data license agreement. Shelters, benches and much of the
public art come from OpenStreetMap and its contributors, under the Open Database License, the same
source behind the base map. Walkability and brownfield records come from the EPA, traffic stress
from the Delaware Valley Regional Planning Commission, and parking problems from Philly Bike
Action's Laser Vision app, with its permission. Rents, incomes and empty homes come from the Census
Bureau. The aerial photos of 1959 and 1975 are the Delaware Valley Regional Planning Commission's
and those of 1999 the U.S. Geological Survey's, hosted by the City. The 1937 redlining map is
Mapping Inequality: Redlining in New Deal America, by Robert K. Nelson, LaDale Winling, et al.,
University of Richmond Digital Scholarship Lab, under a Creative Commons Attribution
NonCommercial 2.5 license. Non commercial use only. Every source, with its publisher and license, is listed on the
[Data status page](https://holdthedoorhoid.github.io/placekeepers/status/) and in
[docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

## How to help

- **Add missing map features**, such as benches or bus shelters, to OpenStreetMap. We read it
  every week.
- **Report a correction** through a short, prefilled
  [GitHub issue](https://github.com/holdTheDoorHoid/placekeepers/issues/new/choose).
- **Ask a question or raise a concern** on the
  [Contact page](https://holdthedoorhoid.github.io/placekeepers/contact/).

## License

- Code: the GNU General Public License, version 3 or later.
- Published data: the Open Database License where OpenStreetMap data is included, otherwise each
  source's own terms, such as the MIT licensed Clean & Green Philly tax snapshot (see
  [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)).
- Written guides, including this file: Creative Commons Attribution ShareAlike 4.0.

Read the full [LICENSE](LICENSE).

## Screenshots

The field view on a phone, near a block with vacant lots, with "What you can do nearby" open:

![The field view on a phone, showing a block with several vacant lots and the "What you can do nearby" list open underneath the map](docs/images/field-phone.png)

The analysis view on a desktop, with a lot page open:

![The analysis view on a desktop, with lens sliders on the left, the map in the middle, and an open lot page on the right](docs/images/analysis-desktop.png)

The transit comfort lens on a phone, with a stop's details open near Broad Street:

![The field view on a phone with the transit comfort lens on, showing colored bus stops near Broad Street and a stop's details open with its score and suggestion](docs/images/transit-phone.png)

A lot page under the placemaking lens on a phone, with the six factors behind its score and how much
evidence each one has:

![A lot page on a phone showing the placemaking lens's score of 56 for a vacant lot, with a table of six factors, the weight of each, and a badge saying whether each is context or mixed evidence](docs/images/placemaking-phone.png)

The "Then and now" layers on a desktop, with the City's 1959 aerial photo under today's vacant lots
in North Philadelphia:

![The analysis view on a desktop, with the Then and now group open on the left showing a year slider set to 1959, and the map showing a black and white aerial photo of 1959 with today's vacant lots drawn in green on top](docs/images/then-and-now-desktop.png)

## For developers

```
registry/        shared YAML registry: sources, layers, lenses, suggestions, routes
pipeline/        Python data pipeline, with tests and fixtures
web/             the Svelte map and site
content/         the site's plain language pages, in Markdown
data/curated/    hand maintained files, such as memorials
docs/            design, safeguards, roadmap, contracts and research
.github/         workflows and issue forms
```

**Run the pipeline** (Python 3.12):
```
python3.12 -m venv pipeline/.venv
pipeline/.venv/bin/pip install -e "pipeline[dev]"
pipeline/.venv/bin/pk registry check
```
`pk all` fetches every source, builds the map, and publishes it; see
[pipeline/README.md](pipeline/README.md) for every command. It needs
[tippecanoe](https://github.com/felt/tippecanoe) for map tiles; without it, the pipeline writes
GeoJSON instead and says so.

**Run the web app** (Node 24):
```
cd web
npm ci
npm run dev
```

**Tests:**
```
cd pipeline && .venv/bin/pytest
cd web && npm test && npm run check
```

File formats shared between the pipeline and the web app are documented in
[docs/CONTRACTS.md](docs/CONTRACTS.md). Read [docs/DESIGN.md](docs/DESIGN.md) before changing how
the map decides anything, and [docs/ETHICS.md](docs/ETHICS.md) before changing what it shows about
an owner, a victim or a shooting.

Placekeepers is not affiliated with the City of Philadelphia and is not legal advice.
