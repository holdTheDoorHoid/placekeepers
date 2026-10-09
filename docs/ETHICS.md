# Safeguards and data ethics

Placekeepers publishes facts that can help neighbors and can also hurt them. The owner's rule is
"warn, don't block, and design misuse out": show what was decided, and make the protective use the
easy, obvious one. Builders must follow this page; changes need the owner's agreement.

## Who might misuse the map, and how

| Risk | Example | Main safeguard |
|---|---|---|
| Deed theft | Someone hunts for neglected homes whose owner of record has died | Protective framing of owner flags, Fraud Guard and Tangled Title links on every flagged dossier |
| Speculation | An investor uses the map as a shopping list of cheap, neglected lots | No acquisition price estimates, no "easiest to take" sort, no investor language, terms of use. Lots listed as available show no price and no buy button (below). Displacement watch areas do show the middle sale price in dollars (owner, 2026-10-08): these are the City's public records, residents understand dollars better than percentages, and investors have better sources |
| Conservatorship for profit | A petitioner uses Act 135 to take a family's house for a fee | Abuse warning on every conservatorship mention; legal aid first |
| Stigma | A shooting layer read as "dangerous neighborhood" | Hexagon counts by default, care framing, no rankings of neighborhoods |
| Over policing | Map used to direct enforcement at people | No police suggestions, ever; 311 suggestions cover physical conditions only |
| Displacement | Greening raises values and rents | Displacement watch overlay and "pair with protections" cards |
| Harm to grieving families | A name shown where a family did not want it | Names only from public memorial lists, quiet design, removal on request |

## Owner information

**Decision (owner, 2026-10-04): show everything we can compute.** That includes owner names and
mailing address as the City publishes them, owner type, and derived flags.

**Limits (orchestrator, 2026-10-04, after the verification review in docs/VERIFICATION.md; the owner
can undo them).** Some of what we can compute would help someone take a family's home, so:

- Conservatorship is never offered on a parcel with a homestead exemption, at any confidence: that
  is the City's own record that someone lives there, or did.
- For an owner who is a person, whose type we could not tell, or who may be an estate, the flags
  about the owner (absentee owner, possible estate, tax debt as of July 2025, owner holds many
  vacant parcels) appear only on parcels the map calls vacant with high or medium confidence, in
  the published files and on the lot page with live City data alike. A parcel we are not sure
  about may be someone's home. Possible estate never appears on a parcel with a homestead
  exemption. Facts about the parcel (deeds, sheriff sales, violations) and the owner's name and
  mailing address as the City publishes them are always shown. Organizations keep every flag.
- The citywide list of owners holding many vacant parcels names organizations only (companies and
  nonprofits). For a person who holds five or more, the flag stays on those parcels' own lot
  pages, with the list of that person's other parcels shown there, never in one citywide file.
- Seller and buyer names on deeds are shown: they are owners of record over time, as the City
  shows them. We publish no personal details beyond the names of owners past and present and the
  current mailing address.

Flags in the first release:

| Flag | Source | Shown as |
|---|---|---|
| Owner type (individual, company, City agency, Land Bank, nonprofit, housing authority) | OPA owner names, City owned layer | A plain label |
| Absentee owner | Mailing address differs from the parcel, outside Philadelphia, or out of state | "The owner gets mail somewhere else" with the place |
| Possible estate | Owner name contains estate wording, or similar patterns | See wording below |
| Tax debt as of July 2025 | Clean & Green Philly's final snapshot (the City no longer publishes parcel tax data) | Always with its date and a link to the City's Tax Center for today's balance |
| Past sheriff sales | Real estate transfers (sheriff deed document types) | Date and price of each |
| Years since last sale | Real estate transfers | "Last sold in 1987" |
| Owner holds many vacant parcels | Count of vacant candidates under the same owner name | "This owner holds 41 vacant parcels in the city" with a link to the list |
| Fast resales | Two or more deeds within 24 months | "Sold 3 times since 2024" |
| Open violations, unsafe or imminently dangerous | L&I | Count and most recent |

**Wording rules.**
- Every flag has three parts: what it means, why to be careful, and a protective next step.
- "Possible estate" reads: *"The owner of record may have died. Family members may still have a right
  to this property and may not know it. If you know the family, the Tangled Title Fund (up to $6,500
  in legal help) and Philadelphia VIP can help them keep it. Families can also sign up for the City's
  free Fraud Guard alerts."* It never reads "owner deceased" or "no heirs".
- Every dossier whose owner may be a person (a person, an owner whose type we could not tell, or a
  possible estate) shows a short deed fraud notice, even where the flags about the owner are held
  back: how deed theft works in Philadelphia, the City's Fraud Guard sign up, and the City's
  November 2025 automated check that blocks deeds signed by people already dead. It protects the
  family who may live there and says nothing about the owner (orchestrator, 2026-10-04).
- The conservatorship route always carries this note: *"Conservatorship can take a property away from
  its owner. Researchers found it is used disproportionately in neighborhoods facing gentrification.
  Talk to the Garden Justice Legal Initiative before you consider it."*

**Things we do not build.** An estimated acquisition price. A sort or filter named for ease of
acquisition. "Buy" buttons, except links to Land Bank programs meant for neighbors. Any outreach tool
that sends letters to owners automatically.

- Lots the City's land agencies list as available (issue #36; owner, 2026-10-08): no price and no
  buy button; the side yard route first where the lot may go to the owner of the house next door;
  no link but the Land Bank's own map and its programs for neighbors; and the Land Bank's note, in
  our words, that it may turn down any sale or lease, even of a property it lists. The filter is
  named for the City's status, never for how easy a lot would be to get.

- The Land Bank in numbers (issue #40, rules set in the milestone brief on 2026-10-09): aggregates only. No names
  of people on the page or in its downloads, and organizations only in totals, never a list of
  who got which lot (as built, no organization is named at all). Neutral facts: no slogans, and
  the page speaks for neither the Land Steward Union nor the Land Bank. It says what the numbers
  cannot show, and labels the program it infers as an inference.

**Bulk export.** The owner chose not to restrict exports. CSV and GeoJSON exports include the flags,
with a first line pointing to the terms of use.

## People killed in traffic crashes

**Decision (owner, 2026-10-04): show names where already public.**

- Names come only from `data/curated/memorials.yaml`, edited by hand. Every entry has the name as the
  public source gives it, the date, the mode (walking, cycling, scooter, driving), an approximate
  location, and the source link. Agents never scrape names.
- Before launch, the owner asks the Bicycle Coalition and Families for Safe Streets for their blessing
  and their preferences (draft in `docs/outreach/`).
- Presentation: a quiet marker (no red, no skulls, no crash imagery), the name, the date, "walking" or
  "cycling", and a link to the public memorial page. No driver details, no case numbers, no arrest
  information, even though the Police dataset has some of these.
- A crash's id on the map is PennDOT's crash record number, which PennDOT and the City publish; it is
  not a Police case number, and it stays so a crash can be found again to correct or remove it
  (decision D11, docs/VERIFICATION.md).
- Memorial suggestions ("memorial garden", "ghost bike") always say "only with the family's blessing"
  and link to Families for Safe Streets.
- A "show names" setting (on by default) hides every name at once.
- **Removal:** anyone can ask for a name to come down by email. We remove it without asking for proof,
  and add its id (not the name) to `data/curated/suppressed.yaml` so it never returns.
- No names for shooting victims. There is no public, family endorsed list, and the City's dataset has
  no names. Shootings appear only as places and counts.

## Shootings and crime

- Default view: counts per hexagon (about two blocks across) for the last 12 and 36 months.
- The point layer (the City's block level points) is a setting, off by default.
- We never display race, age or sex of victims per point, even though the City publishes them.
- Language: "where care is needed most", never "dangerous", "high crime", or "hot spot".
- We never rank neighborhoods by violence. Lists rank places for care under the lens a user chose.

## Policing

Placekeepers never suggests calling the police or increasing enforcement. Its 311 suggestions are for
physical conditions (illegal dumping, broken lights, open vacant buildings). It does not map or
suggest anything about people experiencing homelessness.

- Parking problems reported with Philly Bike Action's Laser Vision app (issue #37; owner,
  2026-10-08): counts only, per cell about a block across, shown only where a cell has at least 5
  reports in 12 months (and a kind of problem only from 5 reports of its own). They are framed as
  evidence for physical fixes to the street, such as curb extensions, bollards, daylighted corners,
  protected bike lanes and loading zones, and the map never says a word about tickets, the Parking
  Authority or drivers.

## Displacement

Wherever a greening suggestion sits in a displacement watch area, the card adds: *"Greening can raise
nearby prices. Consider pairing it with protections."* and links to the Neighborhood Gardens Trust,
community land trust guidance, the City's Homestead Exemption and Longtime Owner Occupants Program,
and tangled title help.

How the watch decides where the full card appears (M4.1, 2026-10-08; the method is in DESIGN.md
section 5.3):

- A displacement watch area is a census tract with at least two signs, at least one of them from
  prices themselves: sale prices, assessed values or the Market Value Analysis. The five signs are
  home sale prices rising much faster than across the city, the City's assessed values rising much
  faster than across the city, the City's Market Value Analysis finding prices climbing out of
  reach of longtime residents, many homes bought by companies, and at least three in five homes
  rented.
- Inside a watch area, the full card appears once per page or view (owner, 2026-10-08): the
  sentence above word for word, the area's signs, and a link to each protection's own page with the
  day it was last checked. A lot page and its print show it once, at the top of "What you can do",
  and the map's list of nearby places once, above its cards. There, every greening card, every
  placemaking card and the box of a lot listed as available carries the one line caution, word for
  word, pointing to that full card; in the list of nearby places, each card also names its own
  area's signs. A card shown on its own, such as a bus stop's details, carries the full card
  itself. Downloads mark each place in a watch area and list the protections once, in their notes.
- Cards for a place to sit in the shade, a community garden or art carry their own caution by the
  greening cards' rule (orchestrator, 2026-10-08, written here with the owner's agreement),
  because "greening" does not describe a bench or a mural: *"New gardens, seating and art can make
  a block more sought after and raise nearby prices and rents. Pair them with protections for
  neighbors who rent or who are behind on taxes."* Inside a watch area, they and the box of a lot
  the City's land agencies list as available point to the full card as the greening cards do;
  outside every watch area they keep the one line with the same link.
- Outside every watch area, every greening card keeps the one line caution, the same sentence with
  a link to the ways to protect neighbors (decision D12, kept by the orchestrator on 2026-10-08
  because it stays protective).
- The watch is a caution, never a priority: it changes no score and no order. The map draws every
  watch area the same way, ranks no area, and says "signs that prices are rising here", never that
  a neighborhood is gentrifying.
- Buyers' names are read only to tell a company from a person; no name is kept or published in the
  watch. Only watch areas carry numbers on the map.

## Privacy

- No analytics, no cookies, no accounts, no tracking pixels.
- Saved lists stay in the browser, with export and import.
- The setting "fetch live City data" (on by default) sends lookups from the visitor's browser to City
  servers; the About page says so, and the setting turns it off.

## Accuracy and corrections

- Every derived fact shows its source, date, and confidence. The vacancy call always lists its
  reasons.
- "Report a correction" opens a prefilled GitHub issue. Owners who want their information corrected
  are pointed to the City office that holds the record, because we republish City records.

## Terms of use (summary for the site)

Placekeepers is for community care and lawful action. It is not legal advice. Do not use it to
harass anyone, to target properties of people who have died, or to speculate. Information comes from
public records that may be wrong or out of date; check with the responsible City office before
acting. Contact us to correct or remove information.
