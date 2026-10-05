# Safeguards and data ethics

Placekeepers publishes facts that can help neighbors and can also hurt them. The owner's rule is
"warn, don't block, and design misuse out": show what was decided, and make the protective use the
easy, obvious one. Builders must follow this page; changes need the owner's agreement.

## Who might misuse the map, and how

| Risk | Example | Main safeguard |
|---|---|---|
| Deed theft | Someone hunts for neglected homes whose owner of record has died | Protective framing of owner flags, Fraud Guard and Tangled Title links on every flagged dossier |
| Speculation | An investor uses the map as a shopping list of cheap, neglected lots | No acquisition price estimates, no "easiest to take" sort, no investor language, terms of use |
| Conservatorship for profit | A petitioner uses Act 135 to take a family's house for a fee | Abuse warning on every conservatorship mention; legal aid first |
| Stigma | A shooting layer read as "dangerous neighborhood" | Hexagon counts by default, care framing, no rankings of neighborhoods |
| Over policing | Map used to direct enforcement at people | No police suggestions, ever; 311 suggestions cover physical conditions only |
| Displacement | Greening raises values and rents | Displacement watch overlay and "pair with protections" cards |
| Harm to grieving families | A name shown where a family did not want it | Names only from public memorial lists, quiet design, removal on request |

## Owner information

**Decision (owner, 2026-10-04): show everything we can compute.** That includes owner names and
mailing address as the City publishes them, owner type, and derived flags.

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
- Any dossier showing an individual owner flag also shows a short deed fraud notice: how deed theft
  works in Philadelphia, the City's Fraud Guard sign up, and the City's November 2025 automated check
  that blocks deeds signed by people already dead.
- The conservatorship route always carries this note: *"Conservatorship can take a property away from
  its owner. Researchers found it is used disproportionately in neighborhoods facing gentrification.
  Talk to the Garden Justice Legal Initiative before you consider it."*

**Things we do not build.** An estimated acquisition price. A sort or filter named for ease of
acquisition. "Buy" buttons, except links to Land Bank programs meant for neighbors. Any outreach tool
that sends letters to owners automatically.

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

## Displacement

Wherever a greening suggestion sits in a displacement watch area, the card adds: *"Greening can raise
nearby prices. Consider pairing it with protections."* and links to the Neighborhood Gardens Trust,
community land trust guidance, the City's Homestead Exemption and Longtime Owner Occupants Program,
and tangled title help.

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
