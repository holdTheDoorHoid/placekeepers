# Verification before v0.1: the interface (M1.10, second half)

Written 2026-10-04 by the interface verification agent, for issue #13. The first half (data and
ethics) is [VERIFICATION.md](VERIFICATION.md). This half is an adversarial review of what people
see and use: accessibility, the keyboard, screen readers, phones, privacy in the browser and the
size and speed of the first load, plus the interface checks 2 to 15 and decisions D7 and D12 that
the first half handed over. Everything found was fixed on branch `agent/uicheck` unless this page
says otherwise.

## In short

What the owner will see change, most important first:

1. **Everything can be reached without the map.** The keyboard used to reach the map before the
   search box and the chips, and memorials could only be opened by tapping their marker. Now the
   controls and lists come first, and the memorials on the map are also listed ("Memorials nearby"
   in the field view, a Memorials tab in the analysis view), each opening the same details as its
   marker, never with a name in the list.
2. **Phones keep room for the map.** On a small phone (320 by 568) the top bar took three rows, the
   preview note three lines, and after "Near me" the search box shrank to a sliver with only a strip
   of map left. A phone turned sideways got the analysis view with a map about 150 pixels tall. Both
   are fixed: two rows at the top, a note that can be hidden, "Stop" beside the location note, the
   field view on phones either way up, and the list beside the map when sideways.
3. **The map is ready about 3 seconds sooner on a slow phone.** On an emulated mid range phone on
   Fast 3G, street zoom went from 11.2 to 8.2 seconds and the whole city from 16.7 to 13.6. The
   first load before map tiles is about 0.5 MB, far under the 2 MB budget, and did not change.
4. **No text promises a removal email that does not exist yet (D7)**, and **every greening
   suggestion carries the displacement caution (D12)**, word for word from ETHICS.md.
5. **Privacy holds, and is now tested on every change.** With "Fetch live City data" off, the site
   asks no server but its own; with it on, only the City's two. "Near me" never leaves the page.
6. Every screen passes automated accessibility checks (axe, WCAG 2.2 A and AA, and axe's best
   practices) at phone and desktop sizes, and those checks run in CI from now on.

Left for later, with reasons, at the end of the findings table: a keyboard way to street blocks and
crashes, lighter lot tiles for the whole city view, and a Safari check on a real iPhone.

## How it was checked

* **Automated accessibility checks**: axe 4.13 (`@axe-core/playwright`, a new development
  dependency) with WCAG 2.0, 2.1 and 2.2 at levels A and AA and axe's best practices, inside the end
  to end tests, at phone (375 by 812) and desktop (1280 by 800) sizes: the field view, its nearby
  list, a lot page, More layers, My lists, Settings, the menu, a memorial; the analysis view, its
  left panel, the ranked list, the plot, saved lists, the memorials tab, memorial details and a lot
  page; and every content page and the Data status page (at 320 pixels wide on the phone run).
  `web/e2e/accessibility.spec.ts`.
* **Keyboard**: scripted walks with Tab, Enter and Escape through both views, recording what has
  focus at each step, then end to end tests for the paths that matter.
* **Screen readers**: roles, names, headings, lists and live regions read from the page's
  accessibility tree by axe and by the tests. No screen reader was run by hand here; the owner's
  checklist below has a short VoiceOver step.
* **Layout**: both views and the content pages at 320 by 568, at 640 by 400 (a 1280 by 800 window
  at 200 percent zoom) and at 812 by 375 (a phone turned sideways), checking that the page never
  scrolls sideways, with screenshots.
* **Color**: contrast ratios computed for every control border, focus ring and map mark against what
  it sits on.
* **Size and speed**: the production build served the way GitHub Pages serves it (gzip for
  everything but images and byte ranges), with the real data read from the live site, in Chromium
  emulating a mid range phone: 375 by 812 at two pixels per point, the processor four times slower,
  and Chrome's "Fast 3G" (1.44 Mbps down, 563 ms round trips) or "Fast 4G" (8.1 Mbps, 165 ms) network,
  with an empty cache. "Usable" is the app's own mark: the map has drawn once with its data and the
  loading note is gone. Before and after runs alternated, three of each, and the middle value is
  given. The live site was measured the same way for sizes.
* **Privacy**: every request the browser makes during a visit that touches every part that could
  ask a server for something, recorded at phone and desktop sizes. `web/e2e/privacy.spec.ts`.
* **Phone use**: a scripted walk with screenshots on the real data, as a neighbor would use the
  site, at 375 by 812, 320 by 568 and sideways, then an end to end test of the same walk.
  `web/e2e/phone.spec.ts`.
* **Other browsers**: the live site's tile requests logged in Firefox 155 and Chromium 153 with
  Playwright. WebKit, Safari's engine, could not start on this laptop (see check 14). Playwright's
  Firefox and WebKit were downloaded for this check only and removed afterwards; the shared browser
  folder holds Chromium alone again.

## Results by area

### Accessibility (WCAG 2.2 AA where a map allows)

| What | Result |
|---|---|
| Automated checks (axe) | Before: 6 kinds of problem across the screens (findings A3 to A7). After: none on any screen at either size |
| Focus order (2.4.3) | Fixed: the view's controls and lists now come before the map (they came after it) |
| Keyboard reaches everything (2.1.1) | Fixed: memorials had no way in but the map; the plot's scrolling box could not take focus |
| Escape and focus return | Fixed: panels over the map on phones now close with Escape; focus no longer falls to the top of the page after "Show on map", making a list or deleting one |
| Focus visible (2.4.7) | Already true: a 3 pixel ring on every control, kept by every fix |
| Names, roles, headings (1.3.1, 4.1.2) | Fixed: headings skipped levels in the left panel, settings and saved lists; the nearby cards were not a list; a table header was empty; the preview note sat outside the page's landmarks |
| Status messages (4.1.3) | Fixed: several status lines were hidden while empty, which can stop screen readers announcing them; they now stay in place |
| Target size (2.5.8) | Fixed: lens sliders were 16 pixels tall and lot page link lists too tight; on touch screens buttons, chips and sliders are now at least 40 pixels |
| Use of color (1.4.1) | Fixed: the credits link on the map lost its underline to MapLibre's own style. The map's legends already carry meaning in words and line styles, not color alone (how sure we are: line width and dashes) |
| Contrast (1.4.3, 1.4.11) | Already true, with one fix (the credits line's background was half see through). Ratios below |
| Reflow (1.4.10) | Fixed: three content pages scrolled sideways at 320 pixels (wide tables and long links); tables now scroll in their own box. The map views never did |
| Motion (2.3.3) | Already true: map flights are marked not essential, so MapLibre jumps instead of flying for people who prefer reduced motion; now tested by recording every zoom level the map passes through (none in between with reduced motion), so the test does not depend on the machine's speed. The test build alone hands the tests the map for this |
| Language and titles (3.1.1, 2.4.2) | Already true: `lang="en"` on every page; each page has its own title, and an open lot page puts its address in the title |
| Map markers | The canvas has a name that points to the lists; places are in the nearby list and the ranked list, memorials now in their own lists |
| Plot | A text summary (counts per first step) and a pointer to the ranked list, which holds the same places |
| Themes | One light theme; there is no dark theme to check |

Contrast ratios (minimum 3 to 1 for control borders and marks, 4.5 to 1 for text):

| What | Ratio |
|---|---|
| Control borders on white / on the field view's bar | 3.32 / 3.07 |
| Buttons, accent on white (and white on accent) | 6.84 |
| Focus ring on white / on the bar | 8.40 / 7.76 |
| Quieter text on white / on the bar | 7.29 / 6.73 |
| Note, stale, failing and live notices (text on their backgrounds) | 9.79, 8.33, 9.43, 8.40 |
| Memorial ring / selected outline / High Injury Network / lot outline, on the map's plain background | 5.41 / 7.03 / 4.07 / 9.98 |

### Keyboard and screen readers, by control

| Control | Result |
|---|---|
| Header, view switch, menu, settings | Reachable, named, Escape closes the menu and settings and returns focus |
| Lens presets and sliders | Reachable; sliders say their value ("3 of 5", "Off") |
| Filters and chips | Native checkboxes and radios inside the chips, with visible focus |
| Address search | Named search box; results are a named list; messages in a live region |
| Drawer tabs | Buttons that say whether their part is open; on phones they scroll in one row |
| Ranked list rows, Save buttons | Buttons with the place's name; Save says which place and which list |
| Downloads | A named group with its help text; progress and result in a live region |
| Saved lists | New, rename, delete and open file by keyboard; focus moves into the name box and back; Escape cancels |
| Lot page and its section links | The six section links move focus to their heading; Print, Show on map, Save, Close |
| Memorials | New lists in both views, each entry a button; Escape returns to it |
| The map canvas | Reachable last, with MapLibre's own keyboard controls (arrows, plus and minus) |

### Size and speed

First load before map tiles, transferred (compressed), at street zoom on a phone:

| Part | Before | After | Live site (before) |
|---|---|---|---|
| Page | 0.7 kB | 0.7 kB | 0.9 kB |
| Scripts | 405.0 kB | 409.1 kB | 409.2 kB |
| Styles | 18.1 kB | 18.7 kB | 18.4 kB |
| Manifest | 6.1 kB | 6.1 kB | 5.6 kB |
| Base map icons | 30.0 kB | 30.0 kB | 30.0 kB |
| Base map fonts | 46.9 kB | 46.9 kB | 46.3 kB |
| **Total before tiles** | **507 kB** | **512 kB** | **510 kB** |
| Whole city (more fonts, 190 kB) | 650 kB | 654 kB | 651 kB |

Of the scripts, 284 kB is MapLibre, which loads after the page appears. After the map is usable,
the nearby cards fetch their addresses from the lot page files (about 110 kB at street zoom).

Tiles, for comparison (not in the budget): at street zoom 123 kB of base map and 90 kB of data; for
the whole city 139 kB of base map and 732 kB of data, of which 531 kB is the lots file (its index
and two tiles).

Time until the map is usable on the emulated mid range phone (middle of three runs):

| | Fast 3G, street | Fast 3G, whole city | Fast 4G, street | Fast 4G, whole city |
|---|---|---|---|---|
| Before | 11.2 s | 16.7 s | 4.8 s | 6.2 s |
| After | 8.2 s | 13.6 s | 3.9 s | 5.2 s |
| First text on screen, before and after alike | 2.4 s | 2.2 s | 1.0 s | 0.8 s |

These are pessimistic: the test browser draws the map in software, without a graphics chip, and
with the processor slowed four times. Unthrottled on this laptop the live site is usable after 2.4
seconds at street zoom and 2.9 for the whole city.

Why it got faster: the request log showed three waits in a row. The lots were only asked for after
MapLibre's "load", which waits for the base map to finish drawing (3 seconds on Fast 3G); the check
that the base map file exists waited for the map library to download; and the label font was asked
for only after the first base map tile arrived. All three now start together.

### Privacy

| What | Result |
|---|---|
| "Fetch live City data" off | A visit that opens a lot page, searches an address and a parcel number, taps the map close in, downloads and opens every drawer asks no server but the site. Tested |
| "Fetch live City data" on | The only other servers asked are `phl.carto.com` and `api.phila.gov`, the two the code names on purpose. Tested |
| Near me | The location is in no stored setting or list, no address bar or copied link, no cookie and no request. Tested |
| Storage | Only `localStorage` keys starting `placekeepers:v1:` (settings, options, lists, and now the hidden note); no cookies, no session storage |
| Links to other sites | Every link that opens a new tab has `noopener noreferrer`, and every page asks for no referrer. Tested |
| Production build with the base map | Its fonts and icons come from the site itself; no other origin on load |

### Phone use

The walk, at 375 by 812 on the real data: open the site, tap Near me, read the nearest card, open
its lot page, read who owns it and the first legal step, save it, open My lists and download it.
Every step works and reads well. What was confusing, cut off or too small, and fixed:

* 320 by 568: three rows of header and three lines of note left little map; after Near me the search
  box was about 55 pixels wide. Fixed (finding M1). After the merge, GitHub's test machine showed
  the top bar still taking three rows there: it has no Ubuntu or Noto font, so the page falls back
  to the wider DejaVu Sans, as many Android phones do. Settings now shows a gear on phones narrower
  than 400 pixels, and the test forces DejaVu Sans, at normal and at 130 percent text size, so the
  laptop sees what the test machine sees (M6).
* Sideways: the analysis view with a tiny map. Fixed (M2).
* "More layers" and "My lists" sat off the edge of the chips row with nothing to say so; a neighbor
  who saved a place could not see where lists are. Fixed with a fade at the edge (M3).
* The analysis drawer's tabs took three rows on a phone once the Memorials tab was added. Fixed (M4).
* The "Choose file" button for opening a list was small. Fixed (M5).

### Interface checks handed over by the first half

| # | Check | Result |
|---|---|---|
| 2 | Conservatorship warning wherever it can appear | Conservatorship is never a first step on a card, in the ranked list or a download (they show only the permission routes and 311); on the lot page and in print it always shows the ETHICS.md warning before its steps. Tested |
| 3 | No ease of acquisition | No filter, column, sort, preset or plot row is named or ordered by how easy a lot is to get; the first step is a category in a fixed order. Tested |
| 4 | Downloads | First line points to the terms of use; flags with their wording; only what the published files hold. Tested (existing tests, plus the greening note) |
| 5 | Possible estate | Reads as ETHICS.md, in order, on the lot page and in print. Tested |
| 6 | Memorial legend and names | Fixed: the legend no longer says names appear while none can. The memorial lists never show a name; downloads and print hold no memorials. Tested |
| 7 | Family's blessing | Beside the memorial suggestion in the memorial details and in settings, with the Families for Safe Streets link. Tested |
| 8 | No ranking of areas, care words only | The area summary counts lots in view; nothing ranks neighborhoods or hexagons; no interface or registry text calls a place dangerous. Tested |
| 9 | Near me and live data off | See Privacy. Tested |
| 10 | Saved lists in this browser | See Privacy. Tested |
| 11 | No "No deeds on record." for partial records | Done by the dossier agent (D9), merged; its tests cover it |
| 12 | Dashes in City names on map labels | Done by the pipeline agent (897977b), merged |
| 13 | Accessibility, end to end tests, budget | This page |
| 14 | Tiles in Safari and Firefox | Firefox 155: every range answered 206, not compressed, and the map draws. WebKit could not start on this laptop: it needs the system libraries `libgstreamer-plugins-bad1.0-0` and `libavif16`, which only an administrator can install. Note that GitHub Pages does compress a range when a request asks for compression (checked with curl); browsers that follow the Fetch standard ask for none on range requests, as Chromium and Firefox did. Safari needs a check on a real iPhone (owner checklist) |
| 15 | Lens breakdown adds up | Already exact (an existing test covers every sample parcel and weight mix). Fixed a small mismatch: a card could say 57 where the lot page's total shows 57.5; cards now say 58 |
| D7 | No promise of a removal email | Fixed: Contact page, "Use this responsibly", the memorial details, the legend and both issue forms; a new issue form "Ask for a memorial to come down" says plainly that it is public. Tested |
| D12 | Displacement caution on greening | Fixed: on the cards, the lot page and its print, in settings and in downloads. Tested |

## Findings

Severity: **must** fix before v0.1, **should** fix, or **later**.

| # | Severity | Finding | Evidence | Fix |
|---|---|---|---|---|
| A1 | Must | The keyboard reached the map before the search box, Near me and the chips | Tab walk: canvas, credits and zoom buttons came 7th to 11th, the search box 12th | f587897 |
| A2 | Must | Memorials could be opened only by tapping their marker | No list or other way in | 9de003a |
| A3 | Must | Lens sliders 16 pixels tall; lot page link lists too tight (WCAG 2.5.8) | axe target-size, 8 sliders and the tax links | f587897 |
| A4 | Must | Content pages scrolled sideways at 320 pixels (WCAG 1.4.10) | About 352, How to do it 537, Vacant land 443 pixels wide | f587897 |
| A5 | Should | The credits link relied on color alone (WCAG 1.4.1) | axe link-in-text-block, 1.53 to 1 against the text, no underline | f587897 |
| A6 | Should | The plot's scrolling box could not be reached by keyboard | axe scrollable-region-focusable | f587897 |
| A7 | Should | Headings skipped levels; a table header was empty; the preview note sat outside landmarks | axe heading-order, empty-table-header, region | f587897 |
| A8 | Should | Focus fell to the top of the page after Show on map, a new list or a deleted list; Escape did not close the panels over the map | Tab walk | f587897 |
| A9 | Should | Status lines hidden while empty may go unannounced; nearby cards were not a list | Code review | f587897 |
| M1 | Must | On a 320 pixel phone the map nearly disappeared; after Near me the search box was about 55 pixels | Screenshots | 2b28582 |
| M2 | Should | A phone turned sideways got the analysis view with a map about 150 pixels tall | Screenshot at 812 by 375 | 2b28582 |
| M3 | Should | The chips row hid More layers and My lists with no sign | Screenshot at 375 | 2b28582 |
| M4 | Should | The analysis drawer's tabs took three rows on a phone | e2e failure after the Memorials tab | 2b28582 |
| M5 | Should | The "Choose file" button was small | Screenshot | 2b28582 |
| M6 | Must | With a wide font (DejaVu Sans, on GitHub's test machine and many Android phones) the top bar took three rows at 320 pixels | CI run 37258923675 | Settings shows a gear on narrow phones; tested with DejaVu Sans at 100 and 130 percent text |
| P1 | Should | Lots waited for the base map to finish drawing; two other waits in a row | Request log on Fast 3G | 339c653 |
| E1 | Must (D7) | Texts promised removal by email before the address exists; the legend said names appear | Contact page, Use this responsibly, issue forms, legend | 93bbb3b |
| E2 | Must (D12) | No displacement caution on greening suggestions | ETHICS.md, Displacement | eb27c6a |
| S1 | Later (issue #23) | Plot dots overlapped where places share a score | Screenshot | 6a6c70d |
| S2 | Later (issue #23) | Base map icon "townhall" missing, console warning | Console near City Hall | 513c790 |
| S3 | Should | A card's whole score could differ by one from the lot page's total | Rounding rule | 58ae630 |
| L1 | Should | Street blocks and crashes open only from the map; the ranked list covers lots only | No list of blocks or crashes | Fixed later (issue #26, cfd9c6b): "Street blocks nearby" in the field view and a Street blocks tab in the analysis drawer, with the crashes in view beside them. Its test also found that a details panel with nothing to tab to could not be scrolled by keyboard on a phone (fd4264d) |
| L2 | Later | For the whole city, the lots file sends 531 kB (its index and two tiles), most of the 13.6 seconds on Fast 3G | Request log at zoom 11 | Not fixed (pipeline): thin the lots at low zooms in tippecanoe, for example keep only high and medium confidence below zoom 13, or merge neighboring parcels |
| L3 | Later | MapLibre (284 kB) starts downloading only after the page's own script runs | Request log | Not changed on purpose: the panels and text show first on slow connections, as M1.7 chose. Preloading it would make the map about a second sooner on Fast 3G and the first text later |
| L4 | Later | Safari not tested | WebKit cannot start here | Owner checklist step 6; or install the two libraries named in check 14 |
| L5 | Later | "Looking up this parcel" appears with its text at once, so some screen readers may not announce it | Code review | Small: keep its status line in place, as was done for the others |
| L6 | Info | On a 375 pixel phone the header's data date is cut with "..." while it says "Some data is not loading" | Screenshot | The full text is on the Data status page it links to |

Commits on `agent/uicheck`, in order: f587897, 9de003a, 93bbb3b, eb27c6a, ba653e7, 339c653, 2b28582,
513c790, 6a6c70d, 58ae630, df531b7 (and merges of `main`).

## Tests

* End to end (`npm run e2e`, the CI job `e2e`, unchanged): 56 tests at phone and desktop sizes, up
  from 24: `accessibility.spec.ts` (axe on every screen, keyboard paths, reflow, reduced motion),
  `privacy.spec.ts`, `phone.spec.ts` (phone sizes only, so 3 are skipped on desktop), and the M1.7
  specs. About 4 to 5 minutes on this laptop (1.3 before).
* Unit tests (`npm test`): new `interface_ethics.test.ts` (checks 2 to 8, D12), `beeswarm.test.ts`,
  `basemap.test.ts`, and additions to the content, streets, state and lens tests.
* No change to CI, the registry or any file format. CONTRACTS.md gained one note: greening
  suggestions show the displacement caution (web only, like the memorial blessing line).

## Five minutes on your own phone

1. Open the site. The map should appear within a few seconds, with two rows of buttons at the top
   and the yellow version 0.1 note. Tap **Hide** on the note, then reload: it stays hidden.
2. Tap **Near me** and allow your location. "What you can do nearby" opens, nearest first. The
   search box keeps its width, and **Stop** sits beside the note saying your location is in use.
3. Tap the first card's address. The lot page opens. Tap **Who owns it**, then **What you can do**,
   at the top. On a lot to clean and green, the yellow caution "Greening can raise nearby prices"
   sits under the suggestion.
4. Tap **Save to my list** and close the page. Swipe the row of chips left to find **My lists**, open
   it and tap **Download CSV**. The file's first line points to the terms of use.
5. Scroll to the end of the nearby list: **Memorials nearby** lists each memorial by date and place,
   with no names. Tap one to read its details.
6. Turn the phone sideways: the list runs down the left and the map stays in sight on the right.
7. If it is an iPhone: check that the green lots draw on the map. That is the Safari check this
   review could not run.
8. In **Settings**, turn off "Fetch live City data" and open a lot page: it says it shows the weekly
   copy. Turn it back on.
9. Optional, with VoiceOver on an iPhone or TalkBack on Android: swipe through the nearby list. Each
   card should read its address, then its buttons.
