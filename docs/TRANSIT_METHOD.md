# How we measure service and riders at SEPTA stops

Written 2026-10-04 for milestone M2.1 (SEPTA data), with the transit comfort lens added on
2026-10-05 by milestone M2.3 (below). This page explains, in plain words, what the map says about
each SEPTA stop and how the pipeline works it out. The code is in
`pipeline/src/placekeepers/derive/transit.py` (the rules), `pipeline/src/placekeepers/adapters/septa.py`
(the downloads), `pipeline/src/placekeepers/derive/transit_comfort.py` (the lens and the
suggestions) and `pipeline/src/placekeepers/publish/transit.py` (the map layers). The file
formats are in [CONTRACTS.md](CONTRACTS.md) section 4, `stops` and `routes`.

## What the owner will see

A new group in the layer list, **Buses and trains**, with two layers, both off until someone turns
them on (in the field view the **Bus stops** chip turns the stops on, and so does using the transit
comfort lens, below):

- **Bus and trolley stops**: a dot for every place in Philadelphia where people board a SEPTA bus
  or trolley, colored by the transit comfort lens (below), by how often a bus comes at midday on
  weekdays, or by how many people get on each weekday. Tapping a dot says, in sentences: the
  stop's priority under the lens and what riders find there, then the routes, how long the wait is in the morning
  rush and at midday on weekdays, Saturdays and Sundays, how many buses leave the stop in a day,
  when service starts and ends (or that it runs all night), how many leave after 8 at night, and
  how many people get on there on an average weekday by SEPTA's own count. A setting adds the
  subway, El and Regional Rail stations; another shows only stops with frequent service (every 15
  minutes or better at midday) or only stops with long waits (less often than every 30 minutes).
- **Bus, trolley and train routes**: the streets and tracks each route follows, as quiet context.
  A setting keeps only the frequent routes.

On 2026-10-04 the map shows 8,081 stops and stations in Philadelphia (7,927 of them bus and trolley
stops) and 141 routes. 4,294 stops have a bus or train at least every 15 minutes at midday on
weekdays; 911 wait longer than 30 minutes or have no midday service; 2,632 have service through the
night.

## Where the data comes from

- **Schedules**: SEPTA's GTFS feed, https://www3.septa.org/developer/gtfs_public.zip (also published
  as releases at github.com/septadev/GTFS). One zip holds two feeds: buses, trolleys, trackless
  trolleys and SEPTA Metro (the subway and the El), and Regional Rail. On 2026-10-04 it was release
  v202609270 of 2026-09-25, 22 MB, good from 2026-09-27 to 2027-02-20 for buses and Metro and to
  2026-10-17 for Regional Rail. SEPTA publishes a new release every one to four weeks.
- **Riders**: SEPTA's "stop summaries" on its open data portal: average boardings and alightings
  per route, direction and stop for each schedule period (spring, summer and fall), one layer per
  period and mode in SEPTA's ArcGIS folder. On 2026-10-04 the map uses Spring 2026 for buses
  (`Spring_2026_Stop_Summary_Bus`, 18,201 rows) and trolleys (`Spring_2026_Stop_Summary_Trolley`,
  719 rows), which SEPTA published on 2026-08-20.
- **License**: SEPTA's license agreement lets anyone use, reproduce and redistribute this data,
  free, as is, and asks that SEPTA's trademarks are not used for profit. Downloading the data means
  accepting it. No login is needed. See [DATA_SOURCES.md](DATA_SOURCES.md).

## A typical day

Schedules change from day to day: holidays, special events, a ball game. For each kind of day (a
weekday, a Saturday, a Sunday) the pipeline looks at every date of that kind in the four weeks from
the download, within the dates the feed says it is good for, and takes the first date with the most
common set of running services. A holiday or a one off event runs a different set, so it is never
the most common one. On 2026-10-04 the typical weekday was Wednesday 2026-10-07, the Saturday
2026-10-10 and the Sunday 2026-10-04 (Monday 2026-10-05 for Regional Rail, whose weekdays are all
alike). If a feed's dates have run out, its last four weeks are used and the build notes say so.

## What counts

- **A departure** is a bus or train that stops at the stop and lets people board there: the last
  stop of a trip is not a departure (it ends there), and neither is a stop where SEPTA's schedule
  says no one may board (`pickup_type` 1).
- **Departures** on the typical weekday, Saturday and Sunday, counting every route that stops there.
- **The busiest hour**: the most departures in one clock hour on the weekday.
- **The wait in the morning rush and at midday**: the time between departures, on average, from 7 to
  9 in the morning and from 10 to 2, counting every route that stops there. Two departures from 7 to
  9 means a bus about every 60 minutes. Where only one to three come in the window, the stop's page
  says "only 2 buses from 10 to 2" instead of an average that would mislead.
- **First and last departure** on weekdays. SEPTA's service day runs past midnight, so a bus at
  "25:30" in the schedule leaves at 1:30 at night, and the page says "after midnight".
- **Service through the night**: a departure in every hour from 1 to 4 in the morning. The page
  then says service runs all night instead of giving first and last times. One late bus at 1:28
  is just the last departure.
- **After 8 at night**: departures from 8 at night until service ends.
- **Frequent service** means a bus or train at least every 15 minutes at midday on weekdays, the
  New Bus Network's own measure; **long waits** means less often than every 30 minutes, or none.
  A route's frequency is taken where it runs most often: its busiest stop in its busiest direction.

Waits are averages from the timetable. Buses bunch, and the real wait at a busy stop can be longer;
the page says so.

Each place people board is its own stop, as in SEPTA's schedules: the two sides of a street, and the
two platforms of a subway station, are separate stops, each with its own SEPTA stop number.

"In Philadelphia" means inside the City Council districts, widened by 100 meters so stops on the
boundary streets (City Avenue, Cheltenham Avenue) stay on the map.

## Stops that change numbers: the New Bus Network

SEPTA's New Bus Network began its first phase on 2026-08-23, and three more phases run to August
2027. Routes change, stops close and new ones open, and SEPTA can give a stop a new number. So that
counts and, later, neighbors' survey notes keep following the place and not the number:

- Every stop gets a **Placekeepers key** when the pipeline first sees it: `sp` and its SEPTA stop
  number (`sr` for Regional Rail stations), such as `sp21261`. The key never changes.
- Each week the new schedules are compared with last week's. When a stop number disappears and a new
  one appears **within 30 meters with a similar name** (the same cross streets, in any order, with
  "Av" and "Ave" and the side of the street evened out), the new number takes over the old key, and
  the old number goes into the stop's history (`fid` on the map). Closest pairs are matched first,
  and each stop is matched at most once.
- A number that disappears with no successor is remembered for a year, so it gets its key back if it
  returns, and a successor that opens a little later can still be matched.
- The history lives in the weekly snapshot, which the refresh keeps from week to week. If that
  copy is ever lost, keys start again from today's numbers.

How well does this fit what SEPTA actually does? Comparing the last schedules before phase 1
(v202608091) with today's: 358 stop numbers disappeared and 185 new ones appeared. Only 4 of the
new ones stand within 30 meters of a vanished stop with the same name (and are linked); the rest
are stops SEPTA closed for good (its own list of phase 1 closures has 486 stops across the region)
and stops it opened in new places. So the rule links what was renumbered in place and nothing else.

## Riders

SEPTA's counts are averages over a whole schedule period, published months later, so they always
lag the schedules and use the stop numbers of their time. The map uses the newest spring or fall
count. Summer counts are left out: they are lower (369,013 weekday boardings across the region in
Summer 2026 against 414,543 in Spring 2026) and miss school trips. Each run checks SEPTA's folder
and moves to a newer spring or fall count by itself when SEPTA publishes one.

A stop takes the count recorded under its own SEPTA number; else the count under a number it had
before (its history); else the count of a stop number that no longer exists, within 30 meters with
a similar name (the same rule as above). Each count goes to one stop at most, summed over every
route and direction counted there. A stop with no matching count shows none: the map never
estimates one. On 2026-10-04, **7,755 of the 7,927 bus and trolley stops in Philadelphia (97.8%)
have a count**: 7,751 under their own number and 4 from a stop they replaced. The other 172 are
mostly stops that opened with the New Bus Network or the fall schedules; they get a count when
SEPTA publishes Fall 2026 (Fall 2025 came out in February 2026). SEPTA publishes no counts per
subway, El or Regional Rail platform, so stations have none.

## The transit comfort lens (M2.3)

Added 2026-10-05. The lens asks where a shelter, a bench or shade would help riders most, and the
stop's page says what neighbors can do about it. The evidence behind each factor is in
[EVIDENCE.md](EVIDENCE.md), "Bus stop comfort".

**What the owner will see.** The stops are colored by the lens unless someone chooses waits or
riders: light for lower priority, dark for higher, and hollow for stations, which the lens does not
score. Moving one of the lens's sliders or choosing a preset turns the stops on and colors them by
the lens, and a note says so. Tapping a stop shows its priority and the main reason, what riders
find there (shelter, bench and light, each yes, no or "not yet surveyed"), how much tree canopy is
around it and whether it is on the High Injury Network, what neighbors can do (each suggestion with
its evidence badge, cost and first step, and the route's steps, contacts and the date we last
checked them), the "why" table, and then its service and riders. In the field view, "What you can
do nearby" lists the stops with a suggestion beside the lots, nearest first.

**Finding each SEPTA stop in OpenStreetMap.** The shelter, bench and light answers come from
OpenStreetMap (milestone M2.2), whose stops are not SEPTA's. The pipeline pairs them with
`match_septa`, the same pairing the route survey sheets use (milestone M2.4), so a stop's sheet and
its page on the map describe the same OpenStreetMap stop. First by SEPTA's stop number (an
OpenStreetMap stop's `ref` or `gtfs:stop_id` naming the stop's number today or one it had before),
then by distance, both only within **15 meters**, closest pairs first, each stop once. The two points
of one stop matched by number stand a median 5 meters apart, while a stop's nearest other SEPTA stop,
usually across the street, is 15 meters or more away for three stops in four. A number naming a stop
farther away is ignored: on Frankford Avenue a run of about 30 OpenStreetMap stops mapped together
carries the numbers of the stops across the street while each point stands on another SEPTA stop,
so the point decides. (An early draft trusted a number up to 60 meters away; on Frankford
Avenue that would have put a run of answers on the wrong side of the street.)

Two more rules keep answers on the right side of the street (added by the v0.2 review,
[VERIFICATION_V0_2.md](VERIFICATION_V0_2.md)). A number is believed only when no other SEPTA stop
stands more than 3 meters closer to the OpenStreetMap stop: at Frankford Avenue and Huntingdon
Street a stop numbered for the southbound stop 12 meters away, across the street, stands 4 meters
from another stop, and its "no shelter, no bench, not lit" had gone to the southbound side. And
an OpenStreetMap stop pairs by place only with its nearest SEPTA stop: when that one is already
taken, it stays unpaired instead of moving to a farther stop. At 30th Street a street stop had
moved on to the trolley platform underground and asked the City for a shelter there.

**The trolley tunnel stations are left out.** Trolleys T1 to T5 stop underground from 13th Street
to 37th Street. A shelter, a bench, shade trees or a survey with StreetComplete make no sense on
those 15 platforms, and the route survey sheets already tell people to leave them out, so the lens
leaves them out like the subway, El and Regional Rail stations: they keep their service and riders
on the map but get no priority and no suggestion. The list is `TUNNEL_STATIONS` in
`derive/transit_comfort.py`, by SEPTA stop number (a renumbered stop keeps its old number in its
history, which counts too); the build notes say how many it found. (Added by the v0.2 review.)

On 2026-10-05: **660 of the 7,912 bus and trolley stops the lens scores** match one of the 829 stops OpenStreetMap
has in the city, 181 where the stop numbers agree and 479 by place; 55 OpenStreetMap stops carry the
number of a SEPTA stop they are not paired with. **278 stops have their shelter or bench surveyed**:
75 with a shelter or roof, 7 with a bench but no shelter mapped, 196 with neither. The other 7,634
are not yet surveyed (7,252 have no OpenStreetMap stop matched to them, and 382 have one that no one
has answered for yet). The route
sheets pair every stop the same way except one: a berth of the 69th Street Transportation Center,
just across the city line, whose OpenStreetMap stop the sheets give to a berth outside the city.

**OpenStreetMap's answers are joined in the visitor's browser, never stored with SEPTA's data**
(decision D1 of the v0.2 review, [VERIFICATION_V0_2.md](VERIFICATION_V0_2.md)). OpenStreetMap is
shared under the Open Database License, which asks that a database made by combining it with other
data be shared under the same license; SEPTA's license lets us redistribute its data but not
relicense it. So the published files keep the two apart: SEPTA's stops (`tiles/transit.pmtiles`)
and the route survey sheets (`tables/routes/`) carry SEPTA's and the City's data and only the id of
the OpenStreetMap stop at the same pole, and what OpenStreetMap says at each stop is published on
its own, in `tables/stop_amenities.json` (and the shelters and benches tiles), under the Open
Database License. The map and the survey page download that table and join the two by the id, in
the browser, with the same rules the pipeline uses, so what anyone sees is exactly what it was
before: the colors, the "why" table, the stop's card and page, the nearby list and the suggestions.
The pipeline still works out the whole picture for the counts in the build notes and below; a
shared set of test cases (`pipeline/tests/fixtures/stop_join_parity.json`) holds the browser to the
pipeline's answers. If the table cannot be loaded, a stop's page says so instead of showing its
answers, and every shelter and bench counts halfway on the map.

**The City's shelters** (added 2026-10-09 by M4.5, issue #41). The City publishes its own list of
the bus shelters it installs and maintains with its advertising partner (`bus_shelters`, 487 on
the City's list, last changed 2025-01-15; docs/DATA_SOURCES.md, "Streets and stops"), each with
SEPTA's stop number as the City recorded it. The pipeline matches each shelter to one of the stops
the lens scores (`match_shelters` in `pipeline/src/placekeepers/derive/streets_stops.py`):

- **by number**, when the number names the stop (today, or a number the stop had before) and the
  stop stands within **30 meters**, with no other stop more than 3 meters closer (the rule for
  OpenStreetMap's numbers above: at Girard Avenue and 11th Street a shelter numbered 1185, the stop
  around the corner on 11th Street, stands 2.6 meters from stop 21001 on Girard Avenue, and the
  point decides);
- otherwise **by place**, to the nearest stop within **15 meters**.

The reach by number is wider than OpenStreetMap's 15 meters because a shelter stands a few steps
from the stop's pole: where the numbers agree, a median 4 meters, nine in ten within 15. Several
shelters can serve one stop (Roosevelt Boulevard's stops have pairs, numbered "8-a" and "8-b"). The
number is read from the City's text: "419", "22513-a", "SEPTA357"; another agency's ("NJT4") or a
blank is matched by place only. On 2026-10-09: **462 of the 487 shelters stand at 451 stops**, 437
by number and 25 by place (why the other 25 match nothing is in DATA_SOURCES.md).

A stop carries `cs`, how many of the City's shelters stand there. It is the City's data, so unlike
OpenStreetMap's answers it is published on SEPTA's stop (decision D1 is about OpenStreetMap's
license; the City's and SEPTA's data already share these records). The lens counts a City shelter
as a shelter: `f_noshelter` is 0 wherever `cs` is above 0, whatever OpenStreetMap says.
OpenStreetMap agrees at 58 of the 451 stops, has no answer at 389, and says there is no shelter at
4 (Market St & 4th St, Broad St & Spruce St, Olney Av & B St, Ridge Av & Hermitage St). There the
two **disagree, and neither wins silently**: the stop's page says "The City's list has a shelter
here, but OpenStreetMap says there is none. One of them may be out of date: a survey settles it.
Until then the priority counts the City's shelter.", and the stop gets the survey suggestion
instead of the request for a shelter. Every stop's page also says what the City's list says, as
its own line beside OpenStreetMap's answers, which are labeled "What OpenStreetMap says"; where
OpenStreetMap has no answer about a shelter the City lists, the shelter reads "Not yet surveyed in
OpenStreetMap, but on the City's list". 17 stops have a shelter in OpenStreetMap that the
City's list does not: SEPTA's own shelters and others the City does not run; they count as before.

**How the lens shifted** (2026-10-09, default weights, the same data otherwise): 393 stops change,
389 whose shelter counted halfway (50 to 0) and the 4 where OpenStreetMap says none (100 to 0).
Each drops about 11 points (median 10.7, at most 21.4); their median rank falls from 1,453 to
3,524. All 17 of them among the 100 highest leave it, and 82 leave the 500 highest, making room for
stops without a shelter. Requests for a shelter fall from 229 to 225 stops and surveys rise from
7,649 to 7,652. The stops with a City shelter are busy (a median of 121 weekday boardings against
20 for all stops; 297 of them are among the busiest 15 percent) and hold 19.7 percent of weekday
boardings at the stops the lens scores, 20.5 percent with OpenStreetMap's shelters added, against
the City's goal of 40 percent.

Checked by hand on 2026-10-09 against the City's records and SEPTA's stops:

| Stop | The City's shelter | OpenStreetMap | Before, after (score, rank of 7,912) |
|---|---|---|---|
| Roosevelt Blvd & Woodward St (stop 10) | pa-001372, numbered 10, 1.4 meters away: by number | no stop mapped | 53.6, 3,277; 42.9, 5,260 |
| Broad St & Spruce St (stop 15188) | pa-001130, numbered 15188, 7.3 meters away: by number | no shelter, no bench (numbers agree): the two disagree | 76.1, 57; 54.6, 2,916; a survey instead of a shelter request |
| JFK Blvd & 15th St (stop 17842) | two, numbered 17842, 2.0 and 7.3 meters away: by number | a shelter and a bench | 50.6, unchanged (ranked 3,848 then 3,725 as others moved) |
| Girard Av & 39th St (stop 21025) | pa-002225, no number, 5.5 meters away: by place | no stop mapped | 53.4, 3,323; 42.7, 5,316 |
| Roosevelt Blvd & Cottman Av, far side (stop 8) | two, numbered 8-a and 8-b, 17.1 and 10.4 meters away: by number | no stop mapped | 53.9, 3,239; 43.2, 5,222 |

**The lamps the City lists by each stop** (also M4.5): `lp` counts the poles with a lamp the City
lists within 30 meters, `le` how many of them are LED. The stop's page says it beside
OpenStreetMap's answer about a light. It is context, not a factor; DESIGN.md section 5.7 gives the
numbers behind leaving street lights out of the lens for now.

**The factors.** Each runs from 0 to 100 among the bus and trolley stops on the map, as in every lens:
the share of stops ranking lower. The shelter and bench factors are worked out in the browser from
the joined answers; the others are in the published stops.

| Factor | Measure | Badge | Default weight | Stops with data |
|---|---|---|---|---|
| People getting on each weekday | SEPTA's count (`b`); the share of stops with fewer | Context | 3 | 7,740 |
| No shelter | 100 a survey found none, 0 a shelter, the whole stop under a roof or a shelter on the City's list (from M4.5), 50 not yet surveyed | Weak | 3 | all (7,608 halfway on 2026-10-05; 7,219 on 2026-10-09 with the City's shelters) |
| No bench | 100 a survey found none, 0 a bench, 50 not yet surveyed | Weak | 2 | all (7,646 halfway) |
| Little shade nearby | tree canopy of 2018 on the land of the stop's hexagon (H3 resolution 9, about two blocks across; water left out); the share of stops with more canopy | Mixed | 2 | 7,911 |
| Hot neighborhood in summer | the heat exposure score of the stop's census tract, from the City's heat vulnerability data; the share of stops in cooler tracts | Context | 1 | 7,545 |
| On the High Injury Network | 100 within 30 meters of the network, else 0 | Context | 2 | all (4,030 on it) |
| Long waits at midday | the weekday wait from 10 to 2 (`hm`); the share of stops with shorter waits | Weak | 1 | 7,697 |

Presets: **Balanced** (the default weights), **Busiest stops first** (riders 5, no shelter 3, no
bench 2, the rest off) and **Heat and shade** (riders 2, no shelter 2, little shade 4, hot
neighborhood 4, long waits 1, the rest off).

**Not yet surveyed counts halfway.** In every other lens, a factor with no data is left out of a
place's average. Here that would let a stop known only for its heat and its street top the ranking,
and counting an unknown shelter as missing would score the stop as if it had nothing. So a shelter
or bench no one has recorded yet is 50, halfway between having one and not, and the stop gets the
suggestion to survey it. The stop's page never names a halfway answer as the main reason, and its
"why" table marks it "not yet surveyed". On 2026-10-05, 39 of the 100 stops ranked highest under
the default weights were not yet surveyed, and 61 were surveyed with neither a shelter nor a bench.

**Suggestions,** in the order a stop lists them, with the count of stops on 2026-10-05 (7,887 of
the 7,912 the lens scores have at least one):

| Suggestion | When | Stops | First step |
|---|---|---|---|
| Survey this stop with StreetComplete | the shelter or the bench is not known yet, or the City lists a shelter OpenStreetMap says is not there (from M4.5) | 7,649 (7,652 on 2026-10-09) | install the free app and answer its questions at the stop |
| Ask the City for a shelter at this stop | a survey found no shelter, the stop is not under a roof, and the City's list has none there (from M4.5) | 229 (225 on 2026-10-09) | there is no public request form: write to OTIS (otis@phila.gov, 215-686-9003) with the stop's number and its riders, and copy the Council office and SEPTA |
| Ask the City for a bench at this stop | a survey found no bench | 210 | the same: no public form, write to OTIS |
| Report a dark streetlight at this stop | OpenStreetMap says the stop is not lit | 17 | report an outage to Philly311; a stop with no light at all is a question for OTIS |
| Plant shade trees by this stop | among the quarter of stops with the least canopy (`f_shade` 75 or more) | 1,987 | the owners of the buildings beside the stop ask for a free street tree |

The contacts, their sources and the dates we checked them are in [ROUTES.md](ROUTES.md). Never the
police: SEPTA's customer service page also offers a safety and incident report to the transit
police, and Placekeepers never points there.

**Joining other data to stops.** Join by the stop's key (`id`) for anything Placekeepers keeps about
a stop, and by SEPTA's number (`sid`, then the numbers in `fid`) for anything from outside.
Boardings (`b`) are absent, not zero, where SEPTA has no count. Data under a share alike license,
such as OpenStreetMap's, is linked by id and joined in the browser, never stored on SEPTA's records
(decision D1 above).

## Limits

- Timetables are plans. Real service can be less frequent, especially when operators are short.
- Waits count every route at a stop together. For a rider who needs one route, the wait can be
  longer.
- Counts lag the schedules by one or two seasons, so they can describe a stop before a nearby stop
  closed and its riders moved here.
- Stops just outside the city are left out, even when Philadelphians use them.
- OpenStreetMap knows about 1 stop in 12 so far, so most stops are ranked on riders, shade, heat,
  the High Injury Network and waits, with their shelter and bench counting halfway until someone
  surveys them. From M4.5 the City's list settles the shelter at 451 stops, but it says nothing
  about benches and was last changed in January 2025.
- The canopy is from 2018 and the heat scores from 2017 to 2019, by 2010 census tracts.
- The High Injury Network factor says the stop is on a street where people are hurt most; it knows
  nothing about the crosswalks at the stop.
- Where a shelter fits depends on the sidewalk's width, what is under it and the owner beside it,
  which the lens cannot see.
