# Did it work? How Placekeepers compares places that got care with places that did not

Milestone M5.4 (issue #48). Study run on 2026-10-21 with the City's records through June 30, 2026.
The code is in `pipeline/src/placekeepers/didit/` (`pk didit`) and the study's own scripts and
tables in [`research/didit/`](../research/didit/). The numbers the site shows are in
[`data/didit/results.json`](../data/didit/results.json), and
[`data/didit/totals.csv`](../data/didit/totals.csv) holds what a test needs to reproduce every one
of them. This page is the source for the site's "Did it work?" page.

## In plain words

### What the owner will see

- **A new page, "Did it work?"**, in the site menu (`/did-it-work/`). It opens with a short answer
  ("We made 9 comparisons. 4 found more, 3 found no clear change, and 2 could not be trusted..."),
  then the two randomized trials in Philadelphia as the real evidence, and the three ways a
  comparison of records can mislead. Then, for each kind of care (PHS LandCare greening, the City's
  clean and seal crews, City demolitions), one card per outcome (shootings, 311 dumping reports,
  complaints about vacant property): a verdict in bold, a plain sentence, the 90 percent interval
  in words ("6.2% fewer to 0.2% more"), how many places it rests on, and the checks. It reads on a
  phone and prints without its buttons.
- **Projects neighbors finished** get their own part of the page: how many the map shows, how many
  were finished long enough ago to compare, and that a comparison needs at least 100. Today there
  are none: no report has been approved yet.
- **On a lot page that had care**, under the summary: when the care happened ("Already maintained
  by PHS LandCare since 2016." or "The City cleaned and sealed it on February 14, 2024.") and the
  line "One lot cannot show whether care worked: shootings, dumping and complaints rise and fall on
  every block for many reasons.", with a link to the citywide page. "Projects here" carries the
  same link. The printed lot page carries the line too.
- **Nothing changes every week.** The study runs only when someone runs `pk didit` (about once a
  year), and its results are committed, so every change to what the site says is reviewed first.

### What we found

The City's records **cannot show that care lowered shootings, dumping or complaints nearby**, and
for some kinds of care they show slightly more afterwards. That does not mean care made things
worse: in observational records, care goes where trouble is growing, and no matching on records
can fully undo that. The two randomized trials in Philadelphia remain the real evidence that
greening lots and fixing abandoned houses reduce gun violence nearby (docs/EVIDENCE.md).

| Care | Outcome | Places (areas) | Change | 90% interval | What the page says |
|---|---|---|---|---|---|
| PHS LandCare greening | Shootings within 200 m | 623 (30) | +3.2% | -3.2% to +12.2% | We could not tell: the check failed |
| PHS LandCare greening | 311 dumping reports | 539 (26) | +2.7% | -1.1% to +6.8% | No clear change |
| PHS LandCare greening | Vacant property complaints | 574 (29) | -3.0% | -6.2% to +0.2% | No clear change |
| City clean and seal | Shootings within 200 m | 4,713 (78) | +7.3% | +3.0% to +10.8% | We could not tell: the check failed |
| City clean and seal | 311 dumping reports | 2,904 (78) | +3.3% | +0.5% to +5.8% | More after care |
| City clean and seal | Vacant property complaints | 4,369 (78) | +2.9% | +0.2% to +5.4% | More after care |
| City demolition | Shootings within 200 m | 1,684 (46) | +6.3% | +0.6% to +10.5% | More after care |
| City demolition | 311 dumping reports | 1,187 (45) | -2.0% | -5.5% to +1.7% | No clear change |
| City demolition | Vacant property complaints | 1,532 (46) | +6.2% | +3.2% to +8.5% | More after care |
| Projects neighbors finished | all three | 0 | | | Too few to tell |

"Change" is the count near the places that got care in the two years after, against what their
comparison places' change would have predicted. A plain sentence for each:

- **LandCare and shootings.** Before the lots were greened, shootings near them were already rising
  faster than near the comparison places (the placebo found +14.8%, 90% interval +7.2% to +23.8%),
  so the comparison cannot separate greening from what was already happening. A simple before and
  after would have said shootings fell 17.8% near greened lots; they fell about as much everywhere.
- **LandCare and dumping.** No clear change (+2.7%, -1.1% to +6.8%).
- **LandCare and complaints about vacant property.** No clear change (-3.0%, -6.2% to +0.2%),
  though the interval barely reaches zero, the ring 200 to 400 meters out shows fewer complaints
  (-4.5%, -7.0% to -1.1%), and the comparison with lots greened later shows fewer too (-7.6%,
  -10.5% to -4.1%). This is the closest the records come to a sign that greening helped, and by the
  rules fixed in advance it is not enough to say so.
- **Clean and seal and shootings.** The check failed (+8.7%, +1.5% to +15.2%): these places were
  already on a different path. Shootings jumped 11% in the half year right after the work, which
  suggests the City sealed buildings after trouble the records do not show.
- **Clean and seal and dumping or complaints.** About 3% more after the work. More reports can mean
  more neglect, or more neighbors reporting once the City has paid attention.
- **Demolitions and shootings.** 6.3% more (0.6% to 10.5%), with the check passed. The City
  demolishes a building once it has become unsafe, often on blocks declining in ways the records do
  not show, and the jump came in the first half year (+10.4%). Elsewhere, Cleveland also found
  slightly more crime where demolition was heaviest (docs/EVIDENCE.md). This does not show that
  demolition caused more shootings.
- **Demolitions and complaints.** 6.2% more (3.2% to 8.5%), and a little more in the ring too.
  Buildings next to a demolished one are often left damaged or empty.
- **Projects neighbors finished.** None to compare yet.

With nine comparisons at 90 percent, about one can look like a change by chance alone.

### What we can say, and what we cannot

- We **can** say that the City's records, compared carefully, give no sign that LandCare greening,
  clean and seal or demolitions reduced shootings, dumping or complaints within two blocks, in the
  years 2017 to 2024. Where the check passed, the intervals rule out drops larger than about 1 to
  6 percent. For shootings near LandCare lots, the outcome the greening trial measured, the
  comparison could not be trusted at all, so it says nothing either way about the trial's 7 to 9
  percent drop.
- We **cannot** say that care did not work. A trial picks places by lot, so the places that got
  care and the places that did not are alike in every way. Records cannot: the City and PHS choose
  places for reasons the records do not hold, and the checks show it.
- We **cannot** say anything about one lot. Shootings, dumping and complaints rise and fall on
  every block for many reasons.
- We **cannot** say whether a place "still looks vacant later" (below).

## The real evidence

From docs/EVIDENCE.md, whose warnings bind this study:

- **Greening vacant lots** (Branas and colleagues, *PNAS* 2018,
  [doi:10.1073/pnas.1718503115](https://doi.org/10.1073/pnas.1718503115)): 541 randomly chosen lots
  randomly assigned to greening, cleanup or nothing. In neighborhoods below the poverty line, gun
  violence fell 29.1% near greened lots. Shootings fell 6.8% near greened lots (95% interval 2.7%
  to 10.6%) and 9.2% near lots only cleaned and mowed (Moyer and colleagues, *AJPH* 2019,
  [doi:10.2105/AJPH.2018.304752](https://doi.org/10.2105/AJPH.2018.304752)), with no sign that
  they moved next door.
- **Fixing abandoned houses** (South and colleagues, *JAMA Internal Medicine* 2023,
  [doi:10.1001/jamainternmed.2022.5460](https://doi.org/10.1001/jamainternmed.2022.5460)): full
  remediation cut gun assaults 13.1%; cleanup alone did nothing measurable.

Observational comparisons like ours can mislead three ways, and the page says so: **selection**
(care goes where trouble is), **regression to the mean** (a bad stretch is often followed by a
better one anyway), and **crime moving elsewhere**. The study answers each as far as records can:
matching on the counts of the two years before (regression to the mean), the placebo check
(selection that shows in earlier years), and the ring 200 to 400 meters out (moving elsewhere).

## Which kinds of care have trustworthy dates

Checked in the pipeline's snapshots of 2026-10-04, as the issue asks.

**PHS LandCare** (`phs_landcare`, 12,459 lots). The layer has `year` and `season` fields, and no
day. The City's description on OpenDataPhilly says the layer lists the lots that have received the
"Clean and Green" stabilization and are under maintenance contract with PHS now, and that each
spring and fall more lots are stabilized and join the inventory. So year and season are the season
a lot was cleaned and greened. 8,568 lots (69%) have both a year and a spring or fall season; we
count spring in the first half of the year and fall in the second. 3,891 have no usable date (3,868
no year at all, 20 "WINTER" and 3 "Summer", which could fall in either half), and they are never
compared and never counted as cared for. Dates are good for PHS's own contracted program (`PLC`:
7,742 of 8,169 dated) and rare for Community LandCare (`CLC`: 722 of 3,274), the Land Bank's lots
(61 of 587) and PHDC's (43 of 429), so in practice the study is about PHS's cleaning and greening.
We found no other source of LandCare dates on the City's or PHS's open data. The layer
holds only the lots in the program today: lots greened and later built on are missing.

**The City's clean and seal crews** (`li_clean_and_seal`, 107,228 work orders). Each has the day
the work order (or else the case) was completed; 103,500 have a done status (Approved, CLOSED, WORK
COMPLETE). The records hold 5,700 to 10,600 a year from 2009 to 2019 (over 8,000 in most years),
then 2,123 in 2020 and under 1,300 a year since, a change in the City's system rather than in the work, as far as we can tell.
So most clean and seal comparisons are from 2017 to 2019. The records do not say whether an order
cleaned a lot or sealed a building; the study counts both.

**City demolitions** (`li_demolitions`). 7,925 demolitions the City carried out itself
(`city_demo` YES), completed, with the day completed, tank removals left out: about 250 to 620 a
year from 2008 to 2025.
Private demolitions are left out: they are development, not care.

**Projects neighbors finished** (`tables/projects.json`, M5.3): the month each was finished. None
has been approved yet. A project counts once two full years of records follow its half year.

## The outcomes

- **Shootings** (`shootings`): 17,943 victims with a location, January 1, 2015 to October 1, 2026,
  at the City's block level points. Counted within 200 meters of each place, about two blocks.
- **Illegal dumping reported to Philly311** (new source `philly311_dumping_history`): 243,619
  requests with a point. The City's table holds none dated 2015 and starts again on January 10,
  2016, so the first complete half year is the second half of 2016. The place's own square is left
  out: a report about the very lot that got care says little about the area around it, and is
  often what brought the care.
- **L&I complaints about vacant lots and buildings** (new source `li_complaints_history`): 146,457
  with a point from January 2, 2015, under the names used before the City's new system of 2020
  ("VACANT LOTS (CLIP)", "VACANT HOUSE", "VACANT COMMERCIAL") and after ("VACANT LOT", "VACANT
  PROPERTY COMPLAINT", "VACANT & OPEN TO TRESPASS"), about 12,000 to 13,000 a year either way. The inspection
  program "VACANT STRATEGY INSPECTIONS" (1,533) is left out, as are 219 without a point. The place's
  own square is left out, as for dumping.
- **Whether the place still looks vacant later: not measured.** The City's vacancy lists exist only
  for June 2024 and October 2026, and LandCare and clean and seal are meant to keep a place cared for
  while it stays empty, so "still vacant" cannot tell success from failure. Permits and sales could
  show reuse, but the deed and permit records the pipeline keeps are for parcels that are vacant
  today, which would leave out exactly the places that were reused.

## The comparison

The choices below were fixed and committed (commit aed4f1e) before any comparison was run on the
real outcomes. Constants are in `placekeepers/didit/method.py` and `study.py`.

**Places.** A place is a square of the city 100 meters across (UTM zone 18 north). A square counts
as cared for in a half year when a dated record of that care falls in it then and none in the two
years before. Squares make two lots greened the same season on one block count once, and let the
same square be cared for in one comparison and a comparison place in another, measured the same
way. Places outside the city's census tracts are left out.

**Windows.** The two years (four half years) before the half year of care against the two years
after; the half year of care itself is skipped, since the work happened some time in it. A place is
compared only when both windows lie wholly inside the complete half years of the outcome.

**Comparison places.** For each cared for place, up to five places that:

- did not get the same care at any time in the two years before, the half year of care, or the two
  years after, and have no undated record of it;
- either got the same care later (after the window) or are of the right kind today: a vacant lot
  for LandCare and projects, a vacant building for demolitions, either for clean and seal (high or
  medium confidence in the vacancy model, never a LandCare lot);
- lie within 3 kilometers but at least 400 meters away, so the two never share the same counting
  circle;
- had a similar count of the outcome in each of the two years before: the square roots of the two
  yearly counts each within 0.5 (0 matches only 0; 4 matches 2 to 6; 16 matches 12 to 20);
- lie in a census tract whose share of people below the poverty line (American Community Survey,
  2020 to 2024) is within 5 percentage points.

Among those, the closest by a score of the count differences, the poverty difference and a little
distance. A comparison place may serve several cared for places. A cared for place with none is
left out, and the results say how many (from 65 of 688 for LandCare and shootings to 593 of 4,962
for clean and seal and complaints). Matching on the counts of the two years before is what answers
regression to the mean: a place picked after a bad stretch is set against places with the same bad
stretch.

**The estimate (a difference in differences).** For each cared for place, the count expected after
is its own count before plus its comparison places' average change. The change is the count after
minus the expected count, summed over all cared for places, and given as a percent of the expected
total, and per place per year.

**The 90 percent interval.** The city is divided into H3 cells of resolution 7 (about 5 square
kilometers each); cared for places in the same cell share much of their surroundings. The interval
comes from 2,000 draws of whole cells with replacement, each cell taking its cared for places and
their comparison places, and is the middle 90 percent of the draws. The draws come from numpy's raw
PCG64 stream (seed 20261021), which numpy keeps the same across versions, so the published
intervals reproduce exactly.

**The checks.**

- **The placebo.** The same comparison, pretending care came four and a half years earlier, with
  windows that end right before the real comparison's two years before begin, and matched afresh
  on the two years before the pretend date. It should find no change. If it does, the places that
  got care were on a different path from places like them before any care, and the main comparison
  may carry that difference. It needs six and a half years of records before care, so it can only
  look at care from late 2021 on for shootings and complaints (records from 2015), and from 2023 on
  for dumping.
- **The ring.** The same matched places, counting 200 to 400 meters out. More there while fewer
  inside would mean trouble moved.
- **Later care only.** Comparison places drawn only from places that got the same care later, which
  were chosen by the same program for the same reasons.
- **The simple before and after.** The change at the cared for places alone, shown only to say why
  comparison places matter.

**The verdict rules** (decided with the method, before the real comparisons ran, and written into
`study.verdict` right after; they were not changed after seeing results):

1. **Too few to tell** when fewer than 100 cared for places could be compared, or they lie in
   fewer than 20 areas.
2. **We could not tell** when the placebo compared at least 100 places and its interval does not
   hold zero.
3. Otherwise **fewer** or **more** when the interval lies wholly below or above zero, and **no
   clear change** when it holds zero. If the placebo had fewer than 100 places, the page says the
   check could not be run.

The page writes every sentence from these codes and the numbers, in the visitor's language.

## Proving the method on synthetic cities

`placekeepers/didit/synthetic.py` builds a city of 3,600 places 250 meters apart, each with its own
rate of events that depends on its part of the city, a citywide rise and fall like the shootings of
2020 to 2022, and half year shocks that make spikes, which fade. Care changes the rate by a known
amount from the half year after it. How care is chosen is a setting:

- **random**: care given by lot, as in a trial;
- **targeted**: care goes where there were more events in the two years before and more poverty
  (what the matching sees), as programs choose;
- **after a spike**: targeted, and more likely right after a bad half year;
- **places on their own trend**: targeted, and each place drifts up or down on its own;
- **hidden differences**: care follows a lasting difference the matching cannot see.

`research/didit/synthetic.py 40` (40 cities for each line, 1,000 draws each):

| How care was chosen | True change | Average estimate | Intervals holding the truth | Simple before and after | Placebo check passed |
|---|---|---|---|---|---|
| random | +0% | -0.7% | 36 of 40 | +4.0% | 35 of 40 |
| random | -10% | -10.7% | 36 of 40 | -6.6% | 35 of 40 |
| random | -20% | -20.5% | 34 of 40 | -17.0% | 36 of 40 |
| random | +15% | +13.6% | 34 of 40 | +19.1% | 35 of 40 |
| targeted | +0% | -0.1% | 32 of 40 | +6.5% | 13 of 40 |
| targeted | -10% | -9.6% | 36 of 40 | -3.9% | 10 of 40 |
| targeted | -20% | -19.2% | 34 of 40 | -14.2% | 12 of 40 |
| targeted | +15% | +14.0% | 35 of 40 | +22.1% | 13 of 40 |
| after a spike | +0% | -1.5% | 32 of 40 | +3.7% | 11 of 40 |
| after a spike | -20% | -20.5% | 31 of 40 | -16.7% | 8 of 40 |
| places on their own trend | +0% | +1.3% | 32 of 40 | +9.0% | 10 of 40 |
| places on their own trend | -20% | -18.2% | 32 of 40 | -12.5% | 7 of 40 |
| hidden differences | +0% | +12.0% | 2 of 40 | +15.7% | 0 of 40 |
| hidden differences | -20% | -9.1% | 0 of 40 | -6.9% | 0 of 40 |

What this shows:

- **It recovers a known effect and finds none when there is none**, whether care is random or
  targeted on what it matches: the average estimate is within about one point of the truth, while
  the simple before and after misses by 3 to 7 points.
- **Its intervals are a little too narrow** where care is targeted: they held the truth in 80 to 90
  of 100 cities instead of 90. Read them as a little optimistic.
- **It can be fooled by what records cannot see**: under hidden differences it finds a 12% rise where
  there is none. The placebo caught that in every city.
- **The placebo is cautious**: it also fails in most cities where care is merely targeted on events,
  even when the main estimate is right. So a failed check means "we cannot tell", never "care did
  not work". Where care was random it passed about 9 times in 10, as it should.

The placebo first tried (pretending care came two and a half years earlier) failed in every city
where care was targeted, because its pretend "after" years were the very years care was chosen on;
it was moved back to end before them during the synthetic tests, before any real comparison. Matching
on the count in a wider area around each place was tried and dropped: it removed little bias and
lost many matches.

`pipeline/tests/test_didit.py` builds eight cities where care is random and eight where it is
targeted, for a true 20% drop and for no change, and four with hidden differences, on every test
run: the average estimate within 2 points of the truth (2.5 for a targeted drop), the intervals
holding the truth in at least six of eight, the simple before and after off by more than 4 points,
the placebo passing where care is random and failing under hidden differences.

## Results in full

All from `data/didit/results.json` (study of 2026-10-21, records through 2026-06-30). Before, after
and expected are events near the cared for places in the two years before and after care.

| Care | Outcome | Places (areas) | Years of care | Before | After | Expected | Change | 90% interval | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| LandCare | Shootings | 623 (30) | 2017 H1 to 2024 H1 | 4,123 | 3,389 | 3,284 | +3.2% | -3.2 to +12.2 | check failed |
| LandCare | 311 dumping | 539 (26) | 2018 H2 to 2024 H1 | 24,747 | 22,807 | 22,201 | +2.7% | -1.1 to +6.8 | no clear change |
| LandCare | Complaints | 574 (29) | 2017 H1 to 2024 H1 | 23,093 | 21,249 | 21,896 | -3.0% | -6.2 to +0.2 | no clear change |
| Clean and seal | Shootings | 4,713 (78) | 2017 H1 to 2024 H1 | 13,983 | 14,602 | 13,610 | +7.3% | +3.0 to +10.8 | check failed |
| Clean and seal | 311 dumping | 2,904 (78) | 2018 H2 to 2024 H1 | 90,908 | 94,641 | 91,651 | +3.3% | +0.5 to +5.8 | more |
| Clean and seal | Complaints | 4,369 (78) | 2017 H1 to 2024 H1 | 82,392 | 81,764 | 79,443 | +2.9% | +0.2 to +5.4 | more |
| Demolition | Shootings | 1,684 (46) | 2017 H1 to 2024 H1 | 10,015 | 9,984 | 9,388 | +6.3% | +0.6 to +10.5 | more |
| Demolition | 311 dumping | 1,187 (45) | 2018 H2 to 2024 H1 | 58,701 | 55,744 | 56,868 | -2.0% | -5.5 to +1.7 | no clear change |
| Demolition | Complaints | 1,532 (46) | 2017 H1 to 2024 H1 | 65,517 | 66,702 | 62,824 | +6.2% | +3.2 to +8.5 | more |

The checks, and the change per cared for place per year in events:

| Care | Outcome | Placebo (places) | Ring, 200 to 400 m | Later care only (places) | Simple before and after | Per place per year | Comparison places | Left out |
|---|---|---|---|---|---|---|---|---|
| LandCare | Shootings | +14.8% (+7.2 to +23.8; 638) | +4.8% (-1.7 to +9.9) | -1.5% (-9.6 to +7.6; 388) | -17.8% | +0.08 (-0.09 to +0.31) | 1,333 | 65 of 688 |
| LandCare | 311 dumping | +0.0% (-5.8 to +5.3; 394) | +1.1% (-4.8 to +7.6) | +2.4% (-2.7 to +6.8; 260) | -7.8% | +0.56 (-0.23 to +1.39) | 1,179 | 88 of 627 |
| LandCare | Complaints | +1.2% (-3.9 to +7.0; 586) | -4.5% (-7.0 to -1.1) | -7.6% (-10.5 to -4.1; 316) | -8.0% | -0.56 (-1.15 to +0.03) | 1,207 | 114 of 688 |
| Clean and seal | Shootings | +8.7% (+1.5 to +15.2; 824) | +0.4% (-1.3 to +2.7) | +4.1% (-0.2 to +7.7; 3,921) | +4.4% | +0.11 (+0.04 to +0.17) | 5,334 | 249 of 4,962 |
| Clean and seal | 311 dumping | -2.5% (-6.8 to +2.3; 627) | -0.1% (-2.6 to +2.7) | +0.6% (-3.6 to +4.8; 1,661) | +4.1% | +0.52 (+0.08 to +0.93) | 4,444 | 396 of 3,300 |
| Clean and seal | Complaints | -1.3% (-5.9 to +3.2; 755) | -1.3% (-2.9 to +0.2) | +1.3% (-1.6 to +4.1; 3,000) | -0.8% | +0.27 (+0.02 to +0.53) | 5,146 | 593 of 4,962 |
| Demolition | Shootings | +3.6% (-1.5 to +9.0; 705) | +1.6% (-1.7 to +4.6) | +3.1% (-3.7 to +9.2; 1,260) | -0.3% | +0.18 (+0.02 to +0.30) | 3,100 | 92 of 1,776 |
| Demolition | 311 dumping | +2.8% (-2.0 to +8.0; 474) | -0.1% (-4.3 to +3.9) | -2.8% (-7.8 to +2.7; 608) | -5.0% | -0.47 (-1.35 to +0.40) | 2,368 | 177 of 1,364 |
| Demolition | Complaints | +1.8% (-1.3 to +4.7; 627) | +1.4% (+0.2 to +2.5) | +4.5% (+1.3 to +7.4; 961) | +1.8% | +1.27 (+0.57 to +1.89) | 2,762 | 244 of 1,776 |

**Where the places come from.** LandCare's matched places are mostly from 2022 and 2023 (219 and
155 of 623 for shootings), when PHS greened the most dated lots; clean and seal's mostly from 2017
to 2019 (3,160 of 4,713); demolitions' spread evenly over 2017 to 2024. The placebo can only look
at care from late 2021 on, so for clean and seal it checks a different, smaller set of years than
the main comparison.

**Half year by half year** (`research/didit/results/event_study.csv`): the difference at each half
year, as a percent of the cared for places' average per half year before. The four halves before
are near zero because they were matched on; the four after show how a change unfolds.

| Care and outcome | -4 | -3 | -2 | -1 | +1 | +2 | +3 | +4 |
|---|---|---|---|---|---|---|---|---|
| LandCare, shootings | +5.3 | -4.4 | +0.8 | -1.7 | +4.5 | +5.1 | -1.3 | +1.8 |
| LandCare, dumping | +4.8 | -4.8 | -0.7 | +0.8 | +0.5 | -1.3 | +3.8 | +6.6 |
| LandCare, complaints | +1.9 | -1.7 | +0.1 | -0.4 | -3.8 | -1.6 | -2.6 | -3.2 |
| Clean and seal, shootings | -0.6 | +0.2 | -0.5 | +1.0 | +11.4 | +7.3 | +6.5 | +3.2 |
| Clean and seal, dumping | -1.4 | +1.4 | +0.8 | -0.8 | +0.9 | +5.0 | +3.3 | +4.0 |
| Clean and seal, complaints | +1.3 | -1.3 | -0.5 | +0.6 | +1.1 | +3.0 | +3.5 | +3.7 |
| Demolition, shootings | -2.0 | +2.1 | +0.3 | -0.3 | +10.4 | +1.2 | +6.8 | +5.3 |
| Demolition, dumping | -0.1 | -0.0 | -0.4 | +0.5 | -0.4 | -1.2 | -1.9 | -4.2 |
| Demolition, complaints | -0.8 | +1.3 | +1.2 | -1.6 | +4.9 | +6.2 | +6.6 | +6.1 |

The jump right after clean and seal and demolition, fading after, is what one expects when the work
follows a crisis the records do not show (a building opened up, a collapse, trouble at the
property), not what one expects of care that slowly changes a block.

## Limits

- **Selection.** The City and PHS choose places for reasons no record here holds. Matching on the
  counts before, the poverty rate and the neighborhood removes some of it; the checks show where it
  remains. Only a trial removes it all.
- **Spillover between places.** Comparison places lie at least 400 meters from their own cared for
  place, but often near other cared for places. If care helps its surroundings, that makes any
  effect look smaller.
- **Places, not lots.** A square 100 meters across can hold several lots, cared for at different
  times; the counting circle of 200 meters holds many more.
- **Dates.** LandCare gives a season, not a day; clean and seal and demolitions give the day the
  record was closed, which can trail the work.
- **The records change.** Clean and seal orders fall from about 8,000 a year to about 1,000 after
  2019; L&I renamed its kinds of complaint in 2020; 311 dumping requests fell in 2026 (about 1,100 a
  month against about 1,900 in 2025). Each comparison sets places against others in the same years,
  which takes care of a change that touches all places alike, not of one that touches some more.
- **The poverty rate is today's** (2020 to 2024), used for care as far back as 2017.
- **Lots that left LandCare** are not on its list, and lots without a season are left out.
- **Intervals a little narrow** where care is targeted (synthetic cities, above), and nine
  comparisons at 90 percent: one may cross zero by chance.
- **Citywide only.** The issue allows large areas too; with 26 to 78 areas behind each comparison,
  splitting the city would leave too few to tell.

## Running it again

About once a year, or when the owner asks:

```
pk fetch phs_landcare li_clean_and_seal li_demolitions shootings census_tracts_2020 acs_poverty \
  philly311_dumping_history li_complaints_history && pk validate
pk derive                       # the vacancy model, for the comparison places of the right kind
pk didit --projects build/data/tables/projects.json   # a data root a weekly publish wrote
cd web && node scripts/didit-fixtures.mjs             # the sample the page's tests read
```

`pk didit` writes `data/didit/results.json` and `data/didit/totals.csv`, checks that the totals
reproduce every number, and prints each verdict. Read the changes before committing them: a new
verdict means new words on the site. The weekly publish then copies the results to
`tables/didit.json` (docs/CONTRACTS.md section 12). `research/didit/analyze.py` prints the tables
above and writes the half year by half year table; `research/didit/synthetic.py 40` the synthetic
table (about 5 minutes).

## Changes during the study

- The placebo was moved during the synthetic tests (above), before the first real run.
- After the first real run, the first complete half year of each outcome was set from its records:
  311 dumping requests start on January 10, 2016, so that outcome starts in the second half of 2016
  rather than the first, as the first run had it. This changed the three dumping comparisons a
  little (LandCare +2.4% became +2.7%; clean and seal +2.7% became +3.3%; demolitions -2.4% became
  -2.0%) and no verdict.
- The verdict rules were written into the code after the first real run, as they had been decided
  before it.
