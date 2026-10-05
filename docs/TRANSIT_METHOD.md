# How we measure service and riders at SEPTA stops

Written 2026-10-04 for milestone M2.1 (SEPTA data). This page explains, in plain words, what the
map says about each SEPTA stop and how the pipeline works it out. The code is in
`pipeline/src/placekeepers/derive/transit.py` (the rules), `pipeline/src/placekeepers/adapters/septa.py`
(the downloads) and `pipeline/src/placekeepers/publish/transit.py` (the map layers). The file
formats are in [CONTRACTS.md](CONTRACTS.md) section 4, `stops` and `routes`.

## What the owner will see

A new group in the layer list, **Buses and trains**, with two layers, both off until someone turns
them on (the transit comfort lens of milestone M2.3 gives them a job on the map):

- **Bus and trolley stops**: a dot for every place in Philadelphia where people board a SEPTA bus
  or trolley, colored by how often a bus comes at midday on weekdays, or by how many people get on
  each weekday. Tapping a dot says, in sentences: the routes, how long the wait is in the morning
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

## For the transit comfort lens (M2.3)

- Join stops by their key (`id`) for anything Placekeepers keeps about a stop, and by SEPTA's
  number (`sid`, then the numbers in `fid`) for anything from outside.
- OpenStreetMap bus stops often carry SEPTA's number in `ref` or `gtfs:stop_id`. Match those against
  `sid` first, then `fid`; fall back to the nearest stop within about 30 meters with a similar name.
  The pipeline keeps everything for this in `snapshots/septa_gtfs/current.parquet` (rows of `kind`
  "stop", with `key`, `stop_id`, `former_ids`, `lat`, `lng`, `stop_name`).
- Boardings (`b`) are the natural measure of how many people wait at a stop; they are absent, not
  zero, where SEPTA has no count.

## Limits

- Timetables are plans. Real service can be less frequent, especially when operators are short.
- Waits count every route at a stop together. For a rider who needs one route, the wait can be
  longer.
- Counts lag the schedules by one or two seasons, so they can describe a stop before a nearby stop
  closed and its riders moved here.
- Stops just outside the city are left out, even when Philadelphians use them.
