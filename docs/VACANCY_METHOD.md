# How Placekeepers decides which parcels are vacant

Milestone M0.5 (issue #4), the vacancy method study. Study date 2026-10-04; all City data downloaded
that day. Code, tables and labels are in [`research/vacancy/`](../research/vacancy/). This page is the
source for the public "How we find vacant land" page and for the vacancy model (milestone M1.2).

## In plain words

### What you will see on the map

Every parcel we think is vacant shows as a **lot** (no building on it) or a **building** (standing but
empty), with a confidence of **high**, **medium** or **low**, and the reasons in plain words, such as
"City lists it as likely vacant land; the assessor classifies it as vacant land; no building footprint
on the parcel". High and medium show by default; low sits behind a filter. Parks, gardens, parking,
rail, utilities and cemeteries never show as vacant. Today's numbers:

| | High | Medium | Low | Not shown (park, garden, parking and similar) |
|---|---|---|---|---|
| Lots | 24,166 | 6,147 | 10,465 | 1,727 |
| Buildings | 6,553 | 2,876 | 8,503 | |

**After the study (2026-10-04, decision D1 in [VERIFICATION.md](VERIFICATION.md)).** The map added
one reason against vacancy: the owner has an owner occupied homestead exemption, the City's own
record that someone lives there, or did. It lowers a building one level and is shown on a lot
without changing the level. On the study's date, with the pipeline's data, that gives:

| | High | Medium | Low | Not shown |
|---|---|---|---|---|
| Lots | 24,162 | 6,160 | 10,454 | 1,727 |
| Buildings | 5,045 | 3,819 | 9,054 | |

(1,552 high buildings became medium and 579 medium buildings became low. The other small
differences from the table above are the pipeline's own downloads of the same day.) Without the
City's indicator, 2,387 buildings stay high.

### What we found

1. **The City's September 2026 lists are a real recalculation, and they are mostly right about lots.**
   When the City's land list and at least two of our own records agree, every lot we checked in the
   City's aerial photos was empty: 24 of 26 clearly empty, 2 unclear, none built on.
2. **For lots, the City's list mostly repeats the assessor.** 98% of the City's 28,531 lots carry the
   assessor's "vacant land" category and 89% have no building footprint. What the City adds is a filter:
   lots the assessor calls vacant land that the City leaves off are often parking, new houses or yards.
3. **The City's list alone is not enough.** Lots that only the City vouches for (at most one of our
   records agrees) were empty in 5 of 13 checks; the rest were houses, parking or a playground.
4. **Our own records find about 4,200 more lots the City leaves out.** After we fixed the rules that
   the first check exposed, a fresh check found 11 to 13 of 15 of these empty, though several are kept
   side yards rather than neglected lots.
5. **The City's list lags behind demolitions.** A lot created by demolition reaches the list only after
   the assessor recodes it: 59% of lots demolished in early 2024 are on the 2026 list, but under a third
   of those demolished since mid 2025. Demolition records catch these lots first.
6. **The building list mixes in lots.** 1,176 of the City's 9,487 "vacant buildings" (12%) have no
   building footprint; all 7 we checked were empty lots. We show them as lots.
7. **Buildings cannot be checked from the air.** For buildings we can only measure how well records
   agree. The strongest records agree well (92% of buildings on the City's open unsafe list are on its
   vacant building list), but 27% of the City's standing vacant buildings have no other record calling
   them vacant. A street level check of 41 parcels is ready for a person to do.
8. **The change since 2024 makes sense for lots that left the list, less so for new ones.** Lots that
   dropped off since June 2024 show signs of reuse (a permit, a sale, a new building, or a new assessor
   code) 60% of the time, against 17% for lots that stayed. The 8,883 "new" lots are mostly old vacant
   lots newly counted: only 6% follow a recent demolition, and 73% are high confidence under our rules.

### What we recommend

- **Lots, high:** on the City's land list and at least two of our independent lot records agree (no
  footprint, assessor's vacant land category, a demolition with nothing built since, a vacant lot
  violation or complaint, LandCare), and nothing contradicts.
- **Lots, medium:** the same agreement but the Planning land use map shows a use, or a construction
  permit was issued in the last 18 months; or not on the City's list but two independent records agree,
  one of them physical (no footprint, or a demolition).
- **Lots, low:** one record only, the City's list with at most one record agreeing, a building
  footprint where a record says lot, or a new construction permit from October 2021 to March 2025
  (a house probably stands now).
- **Buildings, high:** on the City's building list and at least one independent building record (sealed
  by the City in the last five years, open unsafe or imminently dangerous case, a vacant property
  violation or complaint, or the assessor's vacant or sealed exterior note); or two independent records
  including a seal, unsafe or imminently dangerous case. **Medium:** the City's list alone, or one seal,
  unsafe or imminently dangerous case. **Low:** a complaint, violation or assessor note alone. Any permit
  in the last two years lowers a building one level.
- **Use the City's lists as one strong vote, never alone.** This changes DESIGN section 6, which gave
  the City indicator high confidence once spot checks passed (see "Proposed changes" below).

### If the City's indicator breaks again

Keep the last good copy for twelve months, labeled "City list as of 2026-09-27", with the same rules.
After that, or sooner if its health checks fail, switch to rules without it. Then every high lot
becomes medium (24,158 lots), 4,891 of today's 6,147 medium lots stay medium, and about 29,000 lots
stay on the map at medium. For buildings, 2,936 of 6,553 high buildings keep high, and 1,917 medium
buildings that only the City vouched for drop off. The map never goes dark, but it says less with
certainty. Lots on the City list turned over by about 10% a year between 2024 and 2026, which is why
a copy older than a year should lose a confidence level.

### How sure we are

- **High lots:** confident. 24 to 26 of 26 checked were empty lots (95% interval roughly 76% to 100%).
- **Medium lots:** fairly confident. 18 to 20 of 23 checked were empty; expect some kept yards.
- **Low lots:** a coin flip, which is why they are hidden by default.
- **Buildings:** only as sure as the records. No physical check yet. The street level list will measure it.
- The checks are small (115 parcels), labeled by one rater (an AI model looking at photo crops), and use
  spring 2023 photos, three years older than the lists.

## The City's indicator, in its own words

The City's metadata catalog (read through its public Knack API, record `58078697d414285d25b14e3c`)
describes the layers as the output of a model built by the Office of Innovation and Technology with
L&I, OPA, the Land Bank and the Water Department. Each parcel gets positive indicators (for example an
L&I violation) and negative ones (for example an OPA occupied code), weighted by age, summed to a score
out of six. The rank is the score divided by six; only parcels at 0.5 or above are published. The
catalog says "monthly"; in fact every record carries the same date, 2026-09-27, so the whole list was
rebuilt in one run rather than kept current month by month.

Two consequences. First, agreement between the City's list and OPA codes or L&I violations is partly
built in, because those are the City's inputs. Second, the City's model draws on Water Department
records (probably water accounts) that are not public, so the City may know things our records do not.

| City land rank | Parcels | 0 of our lot records agree | 1 | 2 | 3 or more | Footprint present | In LandCare |
|---|---|---|---|---|---|---|---|
| 0.5 | 16,227 | 0% | 7% | 61% | 31% | 10% | 13% |
| 0.67 | 3,585 | 1% | 4% | 46% | 49% | 8% | 28% |
| 0.83 | 395 | 1% | 4% | 34% | 61% | 17% | 31% |
| 1.0 | 8,324 | 0% | 1% | 4% | 94% | 8% | 97% |

The top rank is almost entirely PHS LandCare lots, so LandCare membership is probably one of the
City's inputs too.

| City building rank | Parcels | No footprint (a lot now) | Standing, 0 of our building records agree | 1 | 2 or more |
|---|---|---|---|---|---|
| 0.5 | 6,018 | 15% | 37% | 41% | 22% |
| 0.67 | 3,164 | 8% | 10% | 48% | 42% |
| 0.83 | 149 | 5% | 18% | 40% | 42% |
| 1.0 | 156 | 2% | 8% | 51% | 41% |

## Data used

All requests were sequential with a one second pause and the project User-Agent. Raw files are in
`~/.cache/placekeepers/research/` (397 MB in total).

| Source | Endpoint | What we took | Rows |
|---|---|---|---|
| Vacant Property Indicators, land and buildings | City ArcGIS `Vacant_Indicators_Land`, `Vacant_Indicators_Bldg` | Everything, with shapes | 28,771 and 9,519 |
| June 2024 lists kept by Clean & Green Philly | Shared cache `land_2024.parquet`, `buildings_2024.parquet` | Everything | 25,663 and 9,955 |
| OPA properties | Carto `opa_properties_public` | Category and building codes, livable area, year built, exterior condition, owner, sale | 583,783 |
| Water Department parcels | Carto `pwd_parcels` | Shapes and OPA account (`brt_id`) | 547,410 |
| Building footprints | City ArcGIS `LI_BUILDING_FOOTPRINTS` (Hub export, item `ab9e89e1273f445bb265846c90b38a96`, cached 2026-09-28) | Shapes and linked parcel | 546,046 |
| Land use (Planning, 2023 with 2025 updates) | City ArcGIS `Land_Use` (Hub item `e433504739bd41049de5d8f4a22d34ba`) | Codes and shapes | 559,077 |
| L&I violations | Carto `violations`, since 2022, vacancy and condition codes only | Code, date, status | 213,597 |
| L&I complaints | Carto `complaints`, since 2022, codes VL, VA, VO, BDNO, PMHW, PME, DEMO, CGI | Code, date | 158,938 |
| L&I permits | Carto `permits`, issued since 2016 | Type, kind of work, date | 552,127 |
| Clean and seal | Carto `clean_seal` (the OpenDataPhilly dataset; `li_clean_seal` is an older copy) | Work order type, status, date | 107,228 |
| Demolitions | Carto `demolitions` (`li_demolitions` is an older copy) | Type, City or private, status, dates | 14,325 |
| Unsafe and imminently dangerous | Carto `unsafe`, `imm_dang` (both are the current open lists) | Everything | 3,048 and 123 |
| Deeds | Carto `rtt_summary`, deeds recorded since 2024 | Type, date, amount | 136,277 |
| PHS LandCare | City ArcGIS `phs_landcare` | Program, year, shapes | 12,459 |
| Gardens | PHS and NGT `PHS_NGT_Supported_Current_view`; City ArcGIS `Registered_Community_Gardens`, `PPR_Urban_Agriculture_Projects` | Points | 216, 23, 10 |
| Parks | City ArcGIS `PPR_Properties` | Shapes | 507 |
| City vacant lot cleanups, 2026 | City ArcGIS `clip_vacant_lot_abatements` | Counts per hexagon only | 670 |
| 2023 orthophotos | `tiles.arcgis.com/.../CityImagery_2023/MapServer/tile/{z}/{y}/{x}` (from OpenDataPhilly "Aerial Photography") | About 1,400 tiles at zoom 20 and 21 | |

**City vacant lot cleanups are not available per parcel.** OpenDataPhilly's "Vacant Lot Cleanups"
has parcel level records only for 2012 and 2013 (Carto `vacant_lot_cleanups`, 7,156 rows); the 2026
activity is published only as counts per hexagon. We kept the hexagon count as area context and did not
use cleanups as a parcel signal.

## Signals

Every signal is computed per OPA account (9 digits). Definitions live in
`research/vacancy/build_signals.py`. "Independent" means not the City's own list.

### Lot signals (independent)

| Signal | Definition |
|---|---|
| Assessor says vacant land | OPA category 6, 12 or 13, no livable area, and the building description is not parking or a park. The category, not the description: 7,026 parcels still have a "vacant land" description after their category changed, usually because a house was built (73 of them are on the City list) |
| No building footprint | No footprint lies mostly (half its area or more) inside the parcel, and no footprint the City links to the parcel overlaps it by 10 m² or more; parcel at least 20 m²; OPA does not describe a lived in building; not a park, garden, parking, rail, transportation, utility, cemetery, water or street parcel |
| Demolished, nothing built since | A completed demolition (tank removals excluded) with no new construction permit since and no year built after it. Demolitions before 2023 do not count where OPA describes a lived in building; recent ones do, because OPA is slow to recode (41% of 2024 City demolitions are still described as houses) |
| Vacant lot violation or complaint | A vacant lot license violation (9-3904) or a "vacant lot" complaint (VL) since 2024-10-04 |
| PHS LandCare | The parcel's interior point lies in a LandCare site, or the site lists its OPA account |

### Building signals (independent; a footprint must stand)

| Signal | Definition |
|---|---|
| Sealed recently | A completed L&I clean and seal since 2021-10-04 with no permit since |
| Unsafe | On the City's current open unsafe list (`unsafe`), no permit since |
| Imminently dangerous | On the City's current open list (`imm_dang`), no permit since |
| Vacant property violation or complaint | Since 2024-10-04: vacant structure license (9-3905), vacant and open (PM15-901.1, PM15-108.2), doors and windows (PM15-304.19V), other titles naming vacancy; or complaints VA (vacant property), VO (vacant and open), BDNO (structurally deficient, not occupied) |
| Assessor's exterior note | OPA exterior condition 6 (vacant) or 7 (sealed or open to the weather) |

### Context and contradictions

| Item | Definition | Effect |
|---|---|---|
| Excluded use | Parks and Recreation property or OPA park code; garden point within 5 m; OPA parking or car lot codes; land use rail, other transportation, utility, cemetery, water, street or greened right of way | Never shown as vacant |
| Land use shows a use | Planning's 2023 land use is not "vacant" or "other or unknown" | Lowers a lot one level |
| New construction permit, October 2021 to March 2025 | Any new construction permit (building, trade or zoning) after the last demolition | Lot drops to low (a building probably stands now) |
| New construction permit since April 2025 | Same, more recent | Lot capped at medium; "construction may be starting" |
| Permit in the last two years | Any building, trade or zoning permit since 2024-10-04 | Lowers a building one level |
| Likely side yard | A private owner also owns the lived in building at the address two numbers up or down the street | Shown as a reason only |

The violation codes were found by listing every code title since 2016 (the Hansen era codes before 2020
differ: for example CP-312A high weeds and PM-302.2/4 vacant lot clean). The original project's keywords
(vacant, blight, dumping, weeds, rubbish, abandoned, unsafe) map onto these codes, but weeds, rubbish,
sanitation and dumping violations mostly hit lived in homes, so we keep them as context only.

### Choosing the footprint rule

Raw overlap between parcels and footprints picks up slivers of the neighbors' footprints. We compared
rules on 17,463 near certain lots (on the City's 2026 list, the June 2024 list, and OPA residential
vacant land) and 28,404 near certain houses (single family, sold since 2025, on no list):

| Rule | Near certain lots called built | Near certain houses called built |
|---|---|---|
| A piece of 15 m² or more and 10% cover | 15.9% | 98.5% |
| Footprints cover 20% of the parcel | 13.1% | 95.3% |
| A footprint lies mostly inside the parcel | 4.9% | 96.0% |
| The City links a footprint to the parcel | 4.6% | 97.2% |
| **Chosen: mostly inside, or linked and overlapping 10 m² or more** | **5.3%** | **97.6%** |

The 5% of lots that still show a footprint are mostly demolished houses the footprint layer has not
caught up with (of the 2,594 City lots with a footprint, 1,389 have a demolition record).

## Agreement with the City's indicator

### Lots

| Signal | Role | Parcels with it | On the City land list | Share on the list | On the City building list | Share of the City's 28,531 lots with it |
|---|---|---|---|---|---|---|
| Assessor says vacant land | counted | 39,414 | 28,085 | 71% | 1,162 | 98% |
| No building footprint | counted | 32,099 | 25,342 | 79% | 1,033 | 89% |
| Demolished, nothing built since | counted | 6,309 | 4,360 | 69% | 224 | 15% |
| Vacant lot violation or complaint, two years | counted | 9,036 | 5,412 | 60% | 757 | 19% |
| PHS LandCare lot | counted | 12,068 | 11,262 | 93% | 207 | 39% |
| Planning land use (2023) says vacant | context | 34,690 | 26,928 | 78% | 1,100 | 94% |
| Vacant structure or land violation (PM15-301), two years | context | 8,120 | 3,123 | 38% | 3,337 | 11% |
| Weeds, rubbish, sanitation or dumping violation, or high weeds complaint, two years | context | 37,858 | 3,886 | 10% | 3,852 | 14% |
| Demolished, then a new construction permit | context | 2,218 | 326 | 15% | 17 | 1% |
| Garden | excluded | 254 | 105 | 41% | 1 | 0% |
| Park | excluded | 800 | 132 | 16% | 8 | 0% |
| Parking lot | excluded | 532 | 41 | 8% | 28 | 0% |

Read the last column as "how much of the City's list this signal confirms" and the "share on the list"
column as "how often the City agrees when this signal fires". 132 park parcels and 105 garden parcels are
on the City's land list; we never show those as vacant.

### Buildings (parcels where a building stands)

| Signal | Role | Parcels with it | On the City building list | Share on the list | On the City land list | Share of the City's 8,311 standing buildings with it |
|---|---|---|---|---|---|---|
| Sealed by the City in the last five years, no permit since | counted | 2,733 | 1,515 | 55% | 17 | 18% |
| Open unsafe case, no permit since | counted | 2,689 | 2,465 | 92% | 9 | 30% |
| Open imminently dangerous case, no permit since | counted | 83 | 74 | 89% | 1 | 1% |
| Vacant property violation or complaint, two years | counted | 9,725 | 4,092 | 42% | 80 | 49% |
| Assessor's exterior note: vacant, sealed, or open | counted | 5,572 | 1,287 | 23% | 61 | 15% |
| Sealed before October 2021, no permit since | context | 18,515 | 813 | 4% | 801 | 10% |
| Sealed, then a permit | context | 10,031 | 362 | 4% | 207 | 4% |
| Vacant structure or land violation (PM15-301), two years | context | 4,570 | 2,583 | 57% | 316 | 31% |
| Unsafe, imminently dangerous or unfit violation, two years | context | 3,403 | 1,707 | 50% | 69 | 21% |
| Weeds, rubbish, sanitation or dumping, two years | context | 32,837 | 3,416 | 10% | 422 | 41% |

Older clean and seal records are weak: most houses sealed before 2020 were later demolished or reused,
which is why only seals from the last five years count. The assessor's exterior note agrees with the City
only 23% of the time; it is probably years old on many parcels, so it counts but cannot carry a parcel.

### Where the City's lists and the footprints disagree

| Group | Parcels | Footprint present | No footprint | Footprint present, demolition on record |
|---|---|---|---|---|
| City land list | 28,531 | 2,594 (9%) | 25,937 (91%) | 1,389 |
| City building list | 9,487 | 8,311 (88%) | 1,176 (12%) | 91 |
| On both City lists | 960 | 68 (7%) | 892 (93%) | 40 |

### Is the list fresh? Lots created by demolition since 2024

| Demolished | Parcels (nothing built since) | On the City land list 2026 | On the City building list | Assessor says vacant land now | Footprint still in the layer |
|---|---|---|---|---|---|
| 2024, first half | 193 | 114 (59%) | 0 | 110 (57%) | 93 (48%) |
| 2024, second half | 237 | 122 (51%) | 0 | 123 (52%) | 100 (42%) |
| 2025, first half | 165 | 72 (44%) | 0 | 82 (50%) | 64 (39%) |
| 2025, second half | 179 | 58 (32%) | 0 | 66 (37%) | 77 (43%) |
| 2026, first half | 133 | 40 (30%) | 0 | 53 (40%) | 86 (65%) |
| 2026, second half | 101 | 29 (29%) | 2 | 29 (29%) | 83 (82%) |

The City correctly drops demolished buildings from its building list, but adds the new lot to its land
list at about the pace the assessor recodes it. The footprint layer lags too. Demolition records are
the only source that sees these lots promptly, which is why a recent demolition counts on its own.

## Churn since June 2024

Lists compared by OPA account. 1,074 accounts on the June 2024 land list and 217 on the 2026 land list no
longer exist in OPA (parcels merged or split, which usually means redevelopment); the table covers
accounts that still exist.

| Lots | Kept (on both lists) | New in 2026 | Dropped since 2024 |
|---|---|---|---|
| Parcels | 19,648 | 8,883 | 4,926 |
| Demolition recorded since June 2024 | 4 (0%) | 348 (4%) | 1 (0%) |
| Any demolition since 2007 | 3,450 (18%) | 1,487 (17%) | 2,032 (41%) |
| New construction permit since June 2024 | 708 (4%) | 224 (3%) | 686 (14%) |
| Any building, trade or zoning permit since June 2024 | 749 (4%) | 541 (6%) | 765 (16%) |
| Deed recorded since June 2024 | 1,681 (9%) | 804 (9%) | 1,013 (21%) |
| Footprint present now | 1,230 (6%) | 1,364 (15%) | 1,525 (31%) |
| Assessor says vacant land now | 19,559 (100%) | 8,526 (96%) | 3,316 (67%) |
| In LandCare | 9,981 (51%) | 1,281 (14%) | 413 (8%) |
| Garden or park now | 126 (1%) | 111 (1%) | 176 (4%) |
| On the 2024 building list | 268 (1%) | 412 (5%) | 43 (1%) |
| Any sign of reuse (permit, deed, footprint, new assessor code, garden or park) | 3,248 (17%) | 2,504 (28%) | 2,974 (60%) |

**Dropped lots make sense.** 60% show a sign of reuse, three and a half times the rate among lots
that stayed; counting the 1,074 retired accounts, about two thirds of the 6,000 drops are explained.
**New lots are mostly newly counted, not newly vacant.** Only 556 (6%) follow a demolition since June
2024 or moved over from the 2024 building list; 79% sit at the lowest published rank (0.5) and few are in
LandCare. They are still real lots: 6,475 of them (73%) are high confidence under our rules. The June
2024 list was L&I's own and evidently narrower than the 2026 model.

| Buildings | Kept | New in 2026 | Dropped since 2024 |
|---|---|---|---|
| Parcels | 3,671 | 5,816 | 6,117 |
| Demolition recorded since June 2024 | 2 (0%) | 0 (0%) | 486 (8%) |
| Any building, trade or zoning permit since June 2024 | 265 (7%) | 326 (6%) | 1,652 (27%) |
| Deed recorded since June 2024 | 757 (21%) | 1,131 (19%) | 1,746 (29%) |
| Permit or deed since June 2024 | 902 (25%) | 1,320 (23%) | 2,708 (44%) |
| Now on the 2026 land list | 48 (1%) | 912 (16%) | 632 (10%) |

The 2024 building list was collected by the original project and is known to miss about a thousand
buildings, so building churn says little about the City. Dropped buildings were demolished or worked on
more often than kept ones, which is the right direction.

## Aerial spot check

### Method

- Crops of the City's 2023 orthophotos (`CityImagery_2023`, flown leaf off in spring 2023), fetched
  as map tiles at zoom 20 (about 11 cm per pixel), one tile at a time with a pause, cut to the parcel
  plus a margin of at least 15 m, with the Water Department parcel outlined in yellow. Unclear crops got
  a closer zoom 21 crop, and for the hardest ones the neighboring parcel lines were drawn in cyan.
- **Blind labeling.** Crops were named with random codes; the sample key was joined only after all
  labels were written. In round 1 the crops were downloaded building strata first, which revealed lot
  versus building (not the stratum) for most crops; round 2 fixed that by downloading in code order.
- Labels: empty or green lot, building present, parking, garden or park, unclear. Where the parcel line
  covered an open strip and a neighbor's roof about half and half, the label is unclear.
- **Round 1** (80 parcels, seed 20261004) used the first signal definitions. **Round 2** (35 fresh
  parcels, seed 20261006) tested the refined rules after round 1 was labeled.
- All labels with one line notes: [`research/vacancy/spot_checks.csv`](../research/vacancy/spot_checks.csv).

### Round 1, by stratum

| Stratum | Parcels | Empty or green lot | Building | Parking | Garden or park | Unclear |
|---|---|---|---|---|---|---|
| Lot, City list and two or more of our records | 13 | 12 | 0 | 0 | 0 | 1 |
| Lot, City list with at most one of our records | 13 | 5 | 5 | 2 | 1 | 0 |
| Lot, our records only, two or more | 7 | 1 | 2 | 2 | 0 | 2 |
| Lot, our records only, one | 7 | 1 | 4 | 0 | 0 | 2 |
| Building, City list and one or more of our records | 13 | 0 | 13 | 0 | 0 | 0 |
| Building, City list only | 13 | 3 | 10 | 0 | 0 | 0 |
| Building, our records only | 14 | 0 | 13 | 0 | 0 | 1 |

Round 1's failures among lots on our records only were explainable and led to the refined rules:
two new houses whose assessor description still said vacant land after the category had changed, a new
row of houses built under 2021 and 2022 permits, two parking lots, two houses built after an old
demolition, one house and two twin strips where the footprint layer has a gap, and two odd parcels (a
storage container in a rear lot, and a parcel half under a roof with 2025 permits).

### Round 2, refined rules, fresh parcels

| Stratum | Parcels | Empty or green lot | Building | Parking | Unclear |
|---|---|---|---|---|---|
| Lot, high | 5 | 4 | 0 | 0 | 1 |
| Lot, medium, not on the City list | 15 | 11 | 1 | 1 | 2 |
| City lot with a new construction permit since October 2021 | 8 | 7 | 0 | 0 | 1 |
| City building list, no footprint | 7 | 7 | 0 | 0 | 0 |

Several medium lots were kept side yards (a lawn with a pool, a side garden); the "likely side yard"
reason now flags some of these. The construction permits in the third row were mostly issued in 2025
and 2026, after the photos, so the photos cannot say whether building has started.

### Every checked parcel under the final rules

| Our call | Parcels | Empty or green lot | Building | Parking | Garden or park | Unclear | Empty lots (95% interval) |
|---|---|---|---|---|---|---|---|
| Lot, high | 26 | 24 | 0 | 0 | 0 | 2 | 24 to 26 (76% to 100%) |
| Lot, medium | 23 | 18 | 1 | 2 | 0 | 2 | 18 to 20 (58% to 95%) |
| Lot, low | 10 | 4 | 1 | 1 | 0 | 4 | 4 to 8 (17% to 94%) |
| Lot, low (City says lot, a footprint stands) | 9 | 3 | 4 | 2 | 0 | 0 | 3 (12% to 65%) |
| Building, high | 13 | 0 | 13 | 0 | 0 | 0 | |
| Building, medium | 10 | 0 | 10 | 0 | 0 | 0 | |
| Building, low | 14 | 0 | 14 | 0 | 0 | 0 | |
| Not shown (excluded use) | 3 | 2 | 0 | 0 | 1 | 0 | |
| No longer a candidate | 7 | 0 | 5 | 0 | 0 | 2 | |

This table mixes the round 1 parcels that shaped the rules with the fresh round 2 parcels, so it is a
little flattering; the round 2 rows are the honest test. Every building call had a building standing in
2023, which is necessary but says nothing about whether anyone lives there.

## Recommended rule set

The rules are implemented in [`research/vacancy/rules.py`](../research/vacancy/rules.py) and map onto
the tile contract in CONTRACTS.md (`k` 1 lot, 2 building; `vc` 1 low, 2 medium, 3 high).

| Kind | Confidence | Rule | Parcels today | Without the City's indicator |
|---|---|---|---|---|
| Lot | High | City land list, and two or more independent lot signals, and the land use map shows no use, and no construction permit | 24,166 | 0 |
| Lot | Medium | As above but the land use map shows a use or a permit since April 2025 (1,927); or not on the City list with two or more independent lot signals including no footprint or a demolition, and the land use map shows no use (4,220) | 6,147 | 29,049 |
| Lot | Low | Any other lot evidence, including a footprint where a record says lot (3,783) | 10,465 | 11,715 |
| Building | High | Footprint, and either the City building list plus one independent building signal, or two independent building signals including a seal, unsafe or imminently dangerous case; no permit in two years | 6,553 | 2,936 |
| Building | Medium | Footprint, and the City list alone or one seal, unsafe or imminently dangerous case; or a high building with a recent permit | 2,876 | 2,006 |
| Building | Low | Footprint, and a complaint, violation or assessor note alone | 8,503 | 10,855 |
| Not shown | | Park, garden, parking, rail, transportation, utility, cemetery, water or street | 1,727 | 1,688 |

The kind comes from the footprint, not from which City list a parcel is on: no footprint (or a
demolition after the footprint was drawn) means lot. This moves 1,110 parcels from the City's building
list to lots. Parcels on the City's land list where a footprint stands and nothing explains it stay low.

**Without the City's indicator** (from `results/rule_transitions_without_city.csv`): 24,158 high lots
become medium and 8 become low; 4,891 medium lots stay medium and 1,256 become low; 2,936 high buildings
stay high, 1,400 become medium and 2,217 low; of the medium buildings, 606 stay, 353 become low and 1,917
leave the map. Recommendation: keep the last City list for twelve months, labeled with its date, then
switch. The pipeline's health check should also flag the list as stale if its date stops advancing for
six months while demolitions keep being recorded, since the freshness table shows the list lags
reality even when it is "current".

## Street level check

[`research/vacancy/human_check.csv`](../research/vacancy/human_check.csv) lists 41 parcels for a person
to check, with the address, OPA account, our call, why it is uncertain, what to look for, the records we
found, a Google Maps link and a Street View link built from the parcel's coordinates, and two empty
columns to fill in. It holds no owner names. The mix: 16 buildings at high and medium (the aerial photos
cannot judge them), 5 low buildings resting on one complaint or note, 6 medium lots the City leaves out,
4 City lots with a standing footprint, 3 lots with a recent construction permit, 3 high lots that look
like side yards, and 4 parcels the aerial check could not settle. Results should go into
`data/curated/spot_checks.yaml` (DESIGN section 6) once that file exists.

## Proposed changes to DESIGN section 6

For the orchestrator and owner; this study does not edit DESIGN.md.

| Signal | DESIGN today | Proposed | Why |
|---|---|---|---|
| City vacancy indicator | Medium until spot checks pass, then high | A strong vote that makes a lot high only with two independent records; alone it is low | City only lots were empty in 5 of 13 checks; for lots it mostly repeats the assessor |
| OPA says vacant land | High | Counts once; use the category code, not the description | The description lags new construction by years |
| No building footprint | High | Counts once; ignore it where OPA describes a lived in house | The footprint layer has gaps under some houses and lags demolitions and new building |
| Clean and seal, unsafe, imminently dangerous with no permit since | High | Seal only if in the last five years; unsafe and imminently dangerous as is | Old seals mostly became demolitions or rehabs |
| Demolition with no new construction permit | Medium to high | Counts once, and recent demolitions count even if OPA still says house | It is the only record that sees new lots promptly |
| Violations or complaints, two years | Medium | Only vacancy specific codes count; weeds and rubbish are context | Weeds and rubbish violations mostly hit lived in homes |
| City vacant lot cleanup, two years | Medium | Drop as a parcel signal; hexagon counts as context | Not published per parcel since 2013 |
| (new) Planning land use 2023 | | A contradiction: a mapped use lowers a lot one level | Catches yards and parking the other records miss |
| (new) New construction permit | Exclusion | A permit from 2021 to early 2025 makes a lot low; since April 2025 caps it at medium | Older permits usually mean a house stands now |

## Limitations

- **Small samples and one rater.** 115 parcels in total, labeled by an AI model looking at photo crops.
  Intervals are wide; a second rater would help.
- **Old photos.** The orthophotos are from spring 2023. Anything built or demolished since then is
  invisible, and the photos cannot show whether a building is lived in.
- **Parcel lines do not always sit on the photo.** In some blocks the Water Department parcel lines are
  shifted or rotated by 2 to 3 m against the photo (about 10 degrees in one block), which makes a
  rowhouse width parcel ambiguous. We called those unclear.
- **Circularity.** The City's model uses OPA codes and L&I records, so their agreement with the City is
  partly by construction. The aerial check is the only fully independent test, and it covers lots only.
- **Footprint layer lag.** It still shows half of the buildings demolished in 2024. The calibration
  groups were chosen from OPA codes, so the footprint rule is tuned to agree with OPA where both apply.
- **Records we could not use.** Water Department account data (one of the City's inputs) is not public.
  City vacant lot cleanups are not published per parcel since 2013. The L&I Property History dataset was
  not explored. 1,765 OPA vacant land accounts have no Water Department parcel shape, so their footprint
  cannot be checked.
- **Address based side yard flag.** It only sees neighbors with the exact same owner name two numbers
  away, so it misses corner lots and slightly different names.

## Reproducing this study

From `research/vacancy/` with its own virtual environment (`python3.12 -m venv .venv`, then
`.venv/bin/pip install duckdb pyarrow shapely httpx pillow pyproj pandas`):

```
.venv/bin/python fetch.py            # about 10 minutes, 397 MB in ~/.cache/placekeepers/research
.venv/bin/python spatial.py          # about 40 seconds
.venv/bin/python calibrate.py
.venv/bin/python build_signals.py
.venv/bin/python rules.py
.venv/bin/python analyze.py          # writes results/*.csv
.venv/bin/python spot_sample.py 1    # round 1 crops into out/crops (labels were made by eye)
.venv/bin/python spot_sample.py 2    # round 2 crops
.venv/bin/python spot_results.py     # needs out/blind_labels*.csv; the labels are kept in spot_checks.csv
.venv/bin/python human_check.py
```

Results tables are in `research/vacancy/results/`. Sources found during the study that are not yet in
`registry/sources.yaml`: Carto `clean_seal`, `demolitions` and `complaints`; City ArcGIS
`LI_BUILDING_FOOTPRINTS`, `Land_Use`, `Registered_Community_Gardens`, `PPR_Urban_Agriculture_Projects`
and `clip_vacant_lot_abatements`; and the `CityImagery_2023` tile service.
