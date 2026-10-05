# Changelog

Placekeepers does not have a numbered history yet. This file starts with the first public
release. Numbers below are from the live manifest and the project's docs, as of October 4, 2026,
and change a little every week as the data refreshes.

## v0.1 (date to be set)

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

- Every parcel with a sign of vacancy gets a full page (about 78,000 as of October 4, 2026): a
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

