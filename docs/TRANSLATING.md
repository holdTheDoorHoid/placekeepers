# Translating Placekeepers

Placekeepers speaks English and nine more languages, the owner's choice of 2026-10-21 (issue #49):
Spanish (`es`), Chinese in simplified characters (`zh-Hans`), Vietnamese (`vi`), Russian (`ru`),
Portuguese as spoken in Brazil (`pt-BR`), Haitian Creole (`ht`), Khmer (`km`), French (`fr`) and
Arabic (`ar`, written right to left). The list follows the City's own count of residents who speak
English less than very well; do not add or drop a language without the owner.

This guide is for translators, the agents who translate, and anyone who writes English for the
site. English is always the source: every other language is a translation of it, and anything not
translated yet shows the English, marked so screen readers read it in an English voice.

## Where every piece of text lives

Each language has its own files, so translators working on different languages never touch the
same file. The one shared file is `web/src/i18n/languages.ts`, where each language has one entry.

| What | English source | Translation, one per language |
|---|---|---|
| Interface text: buttons, headings, cards, the lot page, print layouts, the Data status page, error messages | `web/src/strings.ts` | `web/src/i18n/locales/<code>.ts` |
| Registry text: layer names and descriptions, groups, lenses and their factors, suggestions, legal routes and their steps, partners' one line descriptions, source names and publishers, the live data option | `registry/*.yaml` | `registry/i18n/<code>.yaml` |
| Content pages: About, Why this works, How to do it, Use this responsibly, How we find vacant land, Survey bus stops, Terms, Privacy, Contact | `content/<page>.md` | `content/<code>/<page>.md` |
| The language's own name and the question asked on a first visit | | `web/src/i18n/languages.ts` (its line only) |
| Sentences the weekly data refresh writes in English (owner flags, why we gave an owner type) | written again in the browser from codes, with templates in `web/src/strings.ts` | the same keys in `web/src/i18n/locales/<code>.ts` |

What stays in English, on purpose:

- **City records and other sources' own words**: owner names, addresses, violation titles, deed
  types, appeal details, zoning codes, SEPTA's stop and route names, art titles, tree names. They
  are shown as the source publishes them.
- **The weekly refresh's notes** on the Data status page, and a source's error message. They are
  written for the people who keep the map running; the page says so in the visitor's language.
- **Column names in downloads** (CSV and GeoJSON), so files from different languages can be
  combined and read back. A translated note at the top of the file says so (`export.englishColumns`).
- **The memorial removal email's subject and body** (`streets.removalSubject`, `streets.removalBody`),
  which the maintainers read, and web addresses. The tests fail if a catalog translates them.
- **Proper names**: Placekeepers, Philly311, LandCare, Fraud Guard, the Tangled Title Fund, and so
  on. Use the City's own translated name for an office or program where phila.gov publishes one.
- **Words drawn on the map itself** (district numbers, redlining grades, street names): the map's
  canvas cannot shape Arabic or Khmer, so they stay as the data has them. Every one of them also
  appears as text in a list or a details panel, which is translated.
- **A few words inside place names from the data**: "(far side)", "southeast corner", "600 block of"
  in stop, shelter and memorial place names. They come from the pipeline as part of the name; giving
  them codes is a possible later change.
- **The plain HTML of each page** before the script runs (its `<title>`, description and the
  "needs JavaScript" line). The script replaces the title in the page's language.

## How the site picks a language

1. A link's `?lang=` wins, so a link copied from a page in Spanish opens in Spanish. It holds for
   the rest of that visit in that tab, but never replaces the visitor's own choice for later.
2. Otherwise the language the visitor chose in this browser.
3. Otherwise English. On a first visit from a browser set to one of the nine languages, a line in
   that language asks whether to switch. Nothing changes until the visitor answers, and the answer
   is remembered.

Choosing a language reloads the page with `?lang=` in the address bar. The picker is in every page's
top bar and at the top of Settings.

A language appears in the picker and in the first visit question only once its `ready` flag in
`web/src/i18n/languages.ts` is on. Until then it can still be opened with `?lang=<code>` for
checking, and the dev server lists every language. The orchestrator turns `ready` on when a
translation is done. While `reviewed` is off, every page in the language carries the note
"Translated with the help of AI and not yet checked by a native speaker", with a link to the "Fix a
translation" form (`.github/ISSUE_TEMPLATE/fix-translation.yml`). The owner turns `reviewed` on
once a native speaker has checked the language.

## Translating step by step

1. **See what is left.** In `web/`, run `npm run i18n:status` for a table of every language, and
   `npm run i18n:status -- es --english` (with your language's code) for every key, registry text
   and page still in English, with the English beside it.
2. **Interface text.** Open `web/src/i18n/locales/<code>.ts`. It mirrors `web/src/strings.ts` key
   for key: copy the part of the English object you are translating and replace the English words.
   `web/src/i18n/locales/es.ts` shows the form. Leave out any key you have not translated; it
   shows English until you do. TypeScript stops a misspelled key and a template with the wrong
   arguments.
3. **Templates.** Some keys are small functions, because they fill in a number, a date or a name:
   ```ts
   countLabel: (n) => plural(n, { one: '# lugar', other: '# lugares' }),
   ok: (date) => `Datos del ${date}`,
   ```
   Keep every value the English shows (the tests check), and put it where your language needs it.
   Import `plural`, `formatNumber`, `formatDecimal`, `formatMoney`, `formatDate`, `formatTime`,
   `formatClock`, `formatList` and `distanceWords` from `'../format.ts'`. Numbers, money, dates,
   times and lists already follow your language, in Philadelphia time.
   `plural` takes one form per plural category your language has, with `#` for the number:
   English, Spanish, French and Portuguese use `one` and `other`; Russian `one`, `few`, `many` and
   `other`; Arabic `zero`, `one`, `two`, `few`, `many` and `other`; Chinese, Vietnamese, Khmer and
   Haitian Creole only `other`.
   The `join` templates say how pieces of text are joined: `join.labelled` and `join.colon` hold
   the punctuation after a label ("Route: 47", "Protections:"), `join.and`, `join.long` and
   `join.names` join lists. Write them as your language punctuates, for example
   `` labelled: (label, value) => `${label}\u202F: ${value}` `` in French or
   `` labelled: (label, value) => `${label}：${value}` `` in Chinese. Until you do, the label keeps
   English's colon and lists are joined your language's own way by the browser, never with the
   English "and" (`formatList` gives the same result if you want it).
4. **Registry text.** Open `registry/i18n/<code>.yaml` (make it if it is missing, from
   `registry/i18n/es.yaml`). Under each registry file's name, give the item's `id` and the fields
   you translate. The fields a visitor reads, and so the only ones allowed, are:

   | File | Fields |
   |---|---|
   | `groups` | `label`, `description` |
   | `sources` | `name`, `publisher` |
   | `layers` | `label`, `description`; `settings` by id, each `label` and `options` by value, each option's `label` |
   | `lenses` | `label`, `description`; `factors` by id with `label` and `explain`; `presets` by id with `label` |
   | `suggestions` | `label`, `summary`, `cost` |
   | `routes` | `label`, `who`, `warning`, `cost`, `timeline`; `steps` as a list as long as English's; `links` keyed by the link's address, each with the link's words as `label` |
   | `partners` | `one_line` |
   | `options` | `label`, `description`; `options` by value, each option's `label` |

   Ids, addresses, licenses, attributions and partner names are never translated.
5. **Content pages.** Copy `content/<page>.md` to `content/<code>/<page>.md` and translate it.
   Keep the Markdown: headings, lists, tables and links (`[words](address)`), and keep links to
   the site's own pages relative (`../streetcomplete/`). Keep the token `{{REMOVAL_EMAIL}}` on the
   Contact page exactly as it is: the site fills it in from `content.removalEmail` and
   `content.removalComingSoon` in your catalog. A page you have not translated shows in English
   under a note in your language.
6. **The first visit question.** Check your language's `offer` words in
   `web/src/i18n/languages.ts` and fix them if they read badly. Change nothing else there.
7. **Check your work** (next section), and list in your report the word for word passages below,
   with your translation of each.

### Word for word passages

`docs/ETHICS.md` fixes these passages word for word. Each is one fixed sentence or a few
consecutive ones, never pieced together, so you can translate it whole. Translate them with
special care: a back translation checks every one, together with every legal route and safety
warning. `web/src/i18n/ethics.ts` lists them; `npm run i18n:status -- <code>` shows which are done.

| Passage | Keys in `strings.ts` | Registry |
|---|---|---|
| Possible estate | `dossier.flags.possible_estate.text`, `.careful`, `.next` | |
| Conservatorship warning | `dossier.actions.conservatorshipWarning` | `routes.conservatorship.warning` |
| Deed fraud notice | `dossier.owner.deedFraud` | |
| Displacement caution (greening) | `displacement.caution` | |
| Displacement caution (gardens, seating and art) | `displacement.placemakingCaution` | |
| Brownfield soil note | `dossier.rules.brownfield` | |

Never soften them: the possible estate passage never says the owner died, and the soil note never
says "clean" or "safe".

### House style in every language

- **No dashes as punctuation**, in any script: no em dash, en dash, horizontal bar, Chinese double
  dash or spaced hyphen. Russian, French and Vietnamese often use a dash where English would use a
  comma or a colon; rewrite those with a comma, a colon, parentheses or a new sentence. Write
  ranges as "2019 a 2024", in your language's words. The tests check every catalog, page and
  registry file.
- Plain words a neighbor understands, care framing, and the same caution English has: never
  "dangerous", "high crime" or "hot spot", never a word about tickets or police, never a word for
  how easy a lot would be to take.
- Use the City's own translated names for its offices and programs where phila.gov publishes them.
- **Khmer**: put a zero width space (U+200B) between words where a line may break, as Khmer web text
  usually does, so long sentences wrap between words.
- **Arabic**: write in Arabic punctuation (، ؛ ؟). Leave numbers as the site formats them (Western
  digits, to match addresses and parcel numbers). Do not add direction marks: the page handles it.
- **Chinese**: use full width punctuation (，。：；？) and no spaces between Chinese words.

## Checking a language

In `web/`:

- `npm run i18n:status` and `npm run i18n:status -- <code>`: what is left, and any problem (a key
  English lacks, a field the registry does not have, a list of steps of another length).
- `npm test`: among others, `tests/i18n.test.ts` (catalog shape, templates keeping their values,
  registry text, content pages, the word for word passages) and `tests/strings.test.ts` (dashes in
  every language). Missing translations never fail a test.
- `npm run check`: TypeScript and Svelte check every catalog against English.
- `npm run dev`, then open `http://localhost:5173/placekeepers/?lang=<code>` and read every screen:
  the field view on a phone size window, the analysis view, a lot page and its print preview,
  Settings, the menu, every content page, the Data status page, The Land Bank in numbers and a route
  survey sheet. For Arabic, check that everything reads right to left and the print does too.
- `npm run e2e`: `e2e/language.spec.ts` checks the picker, the note, links, Arabic and axe.

## How it works, for builders

- `web/src/i18n/boot.ts` runs first on every page (each page's `main.ts` awaits `startLanguage()`
  before it imports anything that reads text). It decides the language, downloads that language's
  catalog and registry text (each its own small file), writes them into the English `strings`
  object and the registry, leaf by leaf, and sets `lang` and `dir` on the page. A page added later
  must do the same, or it stays in English.
- `web/src/i18n/catalog.ts` does the writing. A key the catalog lacks keeps its English text,
  wrapped in two invisible Unicode isolates (FIRST STRONG ISOLATE and POP DIRECTIONAL ISOLATE).
  The `join` templates are the exception (`OWN_FALLBACKS`): until a catalog has them, the colon
  stays as English writes it and lists are joined by `Intl.ListFormat`, unmarked, since neither
  is English text.
  They keep an English sentence in order inside Arabic, and `web/src/i18n/marks.ts` finds them after
  the page draws and puts `lang="en"` (and `dir="ltr"` on an Arabic page) on the element that holds
  them. Text that leaves the page (a downloaded file, a link) goes through `plainText()`.
- The page reads right to left in Arabic through `dir="rtl"` and logical CSS properties (start and
  end, never left and right). The map and its controls, and the charts, keep their own directions.
- Fonts are the visitor's own system fonts, with lists for Chinese, Khmer and Arabic in
  `web/src/app.css`; never a font server, which would tell a third party about every visit.
- Content pages are rendered at build time, one module per language
  (`web/plugins/translations.ts`), so a page downloads only its own language.

### Writing English for the site

- Add interface text to `web/src/strings.ts` as always. It shows in English in every language until
  a translator gets to it; nothing else needs to change.
- Keep a sentence whole in one key, with its values passed in, rather than joining pieces in code:
  word order differs between languages.
- Never write punctuation or words between pieces in code: no `${label}: ${value}`, no `' and '`.
  Use `strings.join.labelled`, `strings.join.colon` and the list templates (`labelledParts` when
  the value is a link or the label is bold), and format numbers, times and dates through the
  helpers in `web/src/strings.ts` (`formatDecimal`, `formatClock`, `formatList`), never
  `toFixed` or a hand built "AM".
- Renaming or removing an English key leaves translations of the old key behind; the tests list them
  ("has no key English lacks"), and the fix is to rename or remove them in each catalog.
- New English sentences written by the pipeline into published files should carry codes and values
  the browser can turn into words, as the owner flags do (docs/CONTRACTS.md, "Text in other
  languages").
