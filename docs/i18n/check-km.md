# Khmer (km): back translation check

Part B of issue #49. Checked on 2026-10-21 by an AI checker, against `main` as merged into
`agent/tr-km` that day. This is not a native speaker's review: `reviewed` stays off for `km`.

**Method.** For each item I read the Khmer first, wrote my own English back translation, then read
the English source and classified the difference as same meaning, softened, strengthened, changed,
or a wrong fact (number, phone, address, date, dollar amount, office name). Exception: I had read
`docs/ETHICS.md` and `web/src/i18n/ethics.ts` before I read the Khmer, so for the six word for word
passages the back translation was a word by word comparison, not a blind one. For the interface
keys outside the safety and legal groups I read the Khmer and the English together, key by key.
As a second, mechanical check, every number, web address and email address in the catalog (1,928
keys), in the registry routes and suggestions (222 text items) and in the nine content pages was
compared with the English for the same key or page. They all match, apart from the two English
sections that have no Khmer yet (listed at the end). The only differences are
format ones: "nine digit parcel number" is written "9 ខ្ទង់" in the Khmer (three keys), and four
keys where the English code tests for the number 1 and Khmer, which has no singular form, does not.

I read Khmer as a reader, not as a native speaker, so the table at the end lists what a native
speaker should confirm.

## What was checked

| Group | What | How many |
|---|---|---|
| 1. Word for word passages | The six ETHICS passages (possible estate, conservatorship warning, deed fraud notice, both displacement cautions, brownfield soil note) | 6 passages in 14 places: 8 catalog keys, `routes.conservatorship.warning`, and every copy in `content/km/responsibly.md` (four) and `content/km/how.md` (one). All 14 are the same meaning, and every repeat is letter for letter identical to the catalog text. The brownfield note's sibling sentences (`rulesMap.notes.brownfields`, the brownfields layer description, the brownfield legend gloss) were read too and never say "clean" or "safe" |
| 2. Legal routes | Every route in the `routes:` section of `registry/i18n/km.yaml`: label, who, steps, cost, timeline, warning, link labels | 24 routes, 201 text items (24 labels, 24 who, 24 cost, 24 timeline, 1 warning, 68 steps, 36 link labels). Every phone number, email address, street address, dollar amount, percentage, date and deadline matches the English |
| 2b. Suggestions | The registry suggestion cards for lots, buildings, memorials, corners and stops | 19 suggestions, 57 items |
| 3a. Owner flags and lot page actions | `dossier.flags.*` (all ten flags with their careful and next lines), `dossier.actions.*`, `dossier.listing.*`, `dossier.owner.*`, `dossier.ownerType.*`, `dossier.ownerList.*` | 209 catalog keys, Khmer read first |
| 3b. Rest of the lot page | Rules, brownfield and appeals text, history and timeline (including unsafe and imminently dangerous wording), nearby, sources, print, summary, banner, provenance | 350 catalog keys (the ten page chrome keys such as the title and the retry button were read beside the English, the other 340 Khmer first) |
| 3c. Displacement, streets, memorials, survey | `displacement.*`, `streets.*` (memorial wording), `streetsStops.*`, `survey.*` (the four safety tips) | 285 catalog keys, Khmer read first |
| 3d. Other caution wording | Every other catalog key whose English mentions danger, safety, police, price, death, deeds, soil, warnings, "never", family, permission, privacy, children or names | 185 keys, Khmer read first for 79 of them |
| 3e. Everything else in the catalog | Menus, lenses, layers, filters, settings, transit, heat, art, walk, Land Bank numbers, data status, search, redlining and the like | 899 keys, read key by key against the English |
| 3f. Registry text | Layer descriptions and settings, lenses with their factors and presets, groups, options, partners, sources | 50 layers (descriptions read in full, 48 settings), 5 lenses with 25 factors, 16 groups, 1 option, 8 partners, 89 sources (names and publishers) |
| 3g. Content pages | Terms, Privacy, Use this responsibly, How to do it, Contact, About, Why this works, How we find vacant land, Survey bus stops | 9 pages, 326 paragraph, bullet and table row lines |

Result: 7 problems, in 21 places, were wrong or changed the meaning, and were fixed in place.
Another 11 items were left as they are and are flagged for a native speaker. Everything else was the
same meaning.

None of the fixes was in the six word for word passages. No text says or implies the owner
certainly died or has no heirs (the Khmer "ម្ចាស់ក្នុងកំណត់ត្រាអាចបានទទួលមរណភាពហើយ" says the
owner of record may have died, and the Use this responsibly page says in Khmer that the map never
says "the owner died" or "no heirs"). No text says a brownfield site is clean or safe. No text
suggests police or enforcement beyond what the English says (the English How to do it page names
"the police district" for block party permits, and the Khmer matches it). No text hints at a
price or how easy a lot is to take (the Khmer "ងាយនឹងយកពីម្ចាស់របស់វា" in About and Use this
responsibly matches the English "how easy they would be to take from their owner", which says the
map offers no such sort). No protective step was dropped from the parts that are translated.

## Items changed in place

| Key or place | The Khmer before | My back translation | The English | What I changed |
|---|---|---|---|---|
| `dossier.flags.imminently_dangerous.text`, `dossier.owner.flagTitles.imminently_dangerous`, `dossier.history.liDangerous`, `liDangerousSince`, `liNeither`, `dossier.history.timeline.kinds.imminently_dangerous`, `.toggles.notice`, `.story.dangerous`, `.story.sources.notices`, `reasons.imminently_dangerous`, and `registry/i18n/km.yaml` `sources.li_imminently_dangerous.name` (11 places) | "អាចបង្កគ្រោះថ្នាក់ក្នុងពេលឆាប់ៗ" | "may cause danger in the near future" | "imminently dangerous" | Softened. L&I's finding became a possibility ("may"). Now "មានគ្រោះថ្នាក់ជិតកើតឡើង" ("has danger about to happen"). The sentence "could fail at any time" (`dossier.flags.imminently_dangerous.careful`) keeps its "អាច", as the English says "could" |
| `dossier.owner.flagsTitle` and the paragraph before the possible estate quote in `content/km/responsibly.md` | "អ្វីដែលកំណត់ត្រារបស់ទីក្រុងបង្ហាញ"; "បើកំណត់ត្រារបស់យើងខ្ញុំបង្ហាញថាម្ចាស់ក្នុងកំណត់ត្រាអាចបានទទួលមរណភាព" | "What the City's records show"; "if our records show that the owner of record may have died" | "What City records suggest"; "if our records suggest the owner of record may have died" | Strengthened. "បង្ហាញ" is "show", firmer than "suggest", in the heading over the possible estate flag. Now "សញ្ញាពីកំណត់ត្រារបស់ទីក្រុង" ("signs from the City's records") and "បង្ហាញសញ្ញាថា" ("show signs that") |
| `registry/i18n/km.yaml` `routes.land_bank_side_yard.cost` and the side yard bullet in `content/km/how.md` | "ដែលត្រូវបានលើកលែងបើច្បាប់ត្រូវបានរក្សា ហើយទីក្រុងអាចយកវាមកវិញបើមិនរក្សាទេ"; "ទីក្រុងអាចយកវាមកវិញបើច្បាប់មិនត្រូវបានរក្សា" | "forgiven if the law is kept, and the City can take it back if [you] do not keep [it]"; "if the law is not kept" | "forgiven if the rules are kept; the City can take it back if they are not" | Changed. "ច្បាប់" reads as the law, and the bare "មិនរក្សា" could mean "do not keep the lot". The terms of a 30 year mortgage are the program's own. Now "បើអនុវត្តតាមលក្ខខណ្ឌ" and "បើមិនអនុវត្តតាមលក្ខខណ្ឌ" ("if the conditions are followed, if they are not followed") |
| `registry/i18n/km.yaml` `routes.neighborhood_gardens_trust.steps[0]` and the Neighborhood Gardens Trust paragraph in `content/km/how.md` | "ទំនាក់ទំនងជាមួយក្រុមដូចជាសាជីវកម្មអភិវឌ្ឍន៍សហគមន៍ វត្ត ឬសាលារៀន" | "ties to groups such as a community development corporation, a Buddhist temple or a school" | "ties to groups such as a community development corporation, a church or a school" | Changed. The trust's own criterion named a church, not a temple. Now "ព្រះវិហារ (church)", with the English word in brackets as the glossary does for other foreign terms. Whether the trust also counts temples is the trust's answer to give |
| `historic.termsNotStated` in the catalog | "មានការផ្តល់ឥណទាន" | "has credit given (as a loan)" | "credited" | Wrong word. "ឥណទាន" is a financial loan. It is the sentence saying a photo is shown credited and comes down if the publisher asks. Now "មានដាក់ឈ្មោះប្រភព" ("has the source named") |
| `evidence.strong.meaning` and the Strong row of the table in `content/km/why.md` | "ការសាកល្បងដោយចៃដន្យ ជាពិសេសនៅ Philadelphia" | "a randomized trial, especially in Philadelphia" | "A randomized trial, ideally in Philadelphia" | Changed. "Especially" says the trials were mostly there; the badge only prefers it. Now "ហើយល្អបំផុតបើធ្វើនៅ Philadelphia" ("and best if done in Philadelphia") |
| `content/km/how.md`, the Philly Spring Cleanup row of the permits table | "ឆ្នាំងបោស ស្រោមដៃ និងថង់ឥតគិតថ្លៃ" | "a sweeping pot, gloves and bags, free" | "Free brooms, gloves, and bags" | Wrong word. "ឆ្នាំង" is a cooking pot. Now "អំបោស" (broom) |

Every fix keeps the zero width spaces between words (I added them again with the ICU Khmer word
segmenter, and the result matches the translator's convention on every other line of the three
files, so the diff shows only the words that changed). The changes are also in
`docs/i18n/glossary-km.md`.

## Items left as they are, for a native speaker

These are the same meaning or close to it, and I could not tell that a change would be better. A
native speaker should look at them.

| Key or place | The Khmer | My back translation | The English | Note |
|---|---|---|---|---|
| `dossier.flags.possible_estate.careful` (word for word passage) and many other "may" lines (`absentee.careful`, `open_violations.careful`, `years_since_sale`) | "ប្រហែលជានៅតែមានសិទ្ធិ ... ប្រហែលជាមិនដឹង" | "perhaps still have a right ... perhaps do not know" | "may still have a right ... may not know" | "ប្រហែលជា" can read "perhaps" or "probably". If a reader hears "probably", the passage claims a little more than the English. "អាច" is the plain "may". It is also the word for "medium" confidence ("ប្រហែលជាទំនេរ" for "Probably vacant"), which is a little softer than the English |
| `dossier.owner.deedFraud` last sentence (word for word passage), `content/km/responsibly.md` and `content/km/how.md` | "នៅពេលដែលពួកគេសន្មតថាបានចុះហត្ថលេខា" | "when they are presumed to have signed" | "when they supposedly signed" | "សន្មត" is a legal "presume". The English "supposedly" carries doubt that the signature was real. Same idea, different shade |
| `streets.blessing`, `routes.ghost_bike_request` (who and step 1), `content/km/how.md` (norm and table), `content/km/responsibly.md` | "តែជាមួយការអនុញ្ញាតពីគ្រួសារប៉ុណ្ណោះ" | "only with the family's permission" | "Only with the family's blessing" | "Permission" is firmer than "blessing", so the caution is kept or stronger, but it may sound formal to a grieving family. Is there a warmer word? On the Use this responsibly page, "ការអនុញ្ញាតរបស់ពួកគេ" also says the Bicycle Coalition and Families for Safe Streets give "permission", where English says "blessing" |
| `streets.killed.*`, `streets.killed2`, `dossier.nearby.killed`, `legend.memorial`, memorial text in the registry and the routes | "ស្លាប់ពេលកំពុងដើរ" | "died while walking" | "Killed while walking" | Slightly softer: "ស្លាប់" is died. A word that names a killer would be wrong for a crash, so I left it. Is "ស្លាប់" what a bereaved family would want to read? |
| "listed as available" everywhere (`dossier.listing.*`, `dossier.owner.cityStatuses.*`, `filters.listed`, `place.listed`, `legend.parcelsListed`, `landBank.listed.*`, `layers.vacant_parcels` settings, `routes.contact_phdc`, `content/km/how.md`, `content/km/responsibly.md`) | "ត្រូវបានទីភ្នាក់ងារដីរបស់ទីក្រុងចុះបញ្ជីថាអាចសុំបាន" | "listed by the City's land agencies as can be asked for" | "Listed as available by the City's land agencies" | "អាចសុំបាន" is "can be requested". It follows the Land Bank's own line that these are properties people can apply for, and the Khmer also says the Land Bank may refuse. It could still be read as "you can just ask", which the ETHICS rule on ease would not want. A word closer to "available" may exist |
| `dossier.summary.flood.1` and `.2`, `heat.floodHigh`, `heat.floodModerate`, `layers.floodplain` | "ឱកាស 1 ភាគរយក្នុងមួយឆ្នាំ" | "a 1 percent opportunity each year" | "1 percent annual chance" | "ឱកាស" is usually "opportunity". The numbers make the meaning clear, but a native speaker may know a better word for the chance of a flood |
| `dossier.summary.confidence.low` | "យើងមិនប្រាកដទេថាវាទំនេរ" | "We are not sure it is vacant" | "We are not very sure it is vacant" | A little stronger doubt than the English. It errs toward caution about calling a lot vacant, so I left it |
| `redlining.grades.D` | "D វាយតម្លៃថា "គ្រោះថ្នាក់"" | "D graded 'danger'" | "D, graded 'hazardous'" | It quotes the 1937 grade label, so I left it, but it is the one place the catalog calls an area by a danger word. A softer word for "hazardous" may exist. The ETHICS rule is about the site's own wording, and this is a quotation |
| `content/km/contact.md`, first section | "ទម្រង់បែបបទនេះជាភាសាអង់គ្លេស ប៉ុន្តែអ្នកអាចសរសេរជាភាសាខ្មែរបាន" | "This form is in English, but you can write in Khmer" | (not in the English) | The translator added a promise the English does not make. The other languages added the same sentence, so this is a decision for the owner, not a Khmer error. The owner should confirm someone can read Khmer reports |
| `dossier.flags.imminently_dangerous.*` and the other ten places I changed (see the first row of the changes table) | "មានគ្រោះថ្នាក់ជិតកើតឡើង" | "has danger about to happen" | "imminently dangerous" | My wording, not a native speaker's. Another choice is "គ្រោះថ្នាក់ជិតមកដល់". Please confirm which one a resident would understand as the serious finding it is |
| `registry/i18n/km.yaml` `suggestions.clean_and_green.summary`, `routes.garden_adverse_possession.steps[0]` | "របងបង្គោលទាប និងរបៀង"; "របង និងជង្រុក" | "a low post and corridor fence"; "fences and granaries" | "a low post and rail fence"; "fences and sheds" | "របៀង" (corridor or railing) for "rail" and "ជង្រុក" (granary) for "shed" are close but not exact. Not a safety item |

## Not translated yet, from main (not the translator's gap)

The merge of `main` brought in features after the translator finished, so these still show in
English, marked as English (`npm run i18n:status -- km`): 296 interface keys, among them
`represent.*` (who represents you), `packet.*`, `flyer.*`, `letters.*` (the letters carry "A lawyer
has not reviewed these letters yet. They are not legal advice.") and `projects.*` (including
`projects.privacy` and `projects.tellUsNote`, which says photos must never show a child's face or a
license plate); the label of the `posting` page in `nav.pages`; 24 registry texts (sources
`project_reports`, `project_corrections`, the political divisions and elected officials sources,
`rco_contacts`, and `layers.projects`); and `content/km/posting.md` (where to post a flyer, with
the City's fines). Two sections of English pages have no Khmer yet: "Organizing with your
neighbors" and "Tell us about a project you finished" in `content/how.md`, and "Tell us about a
project you finished" in `content/contact.md`.

Two translated sentences now lag the English and should be redone in the same pass:

- `content/km/how.md`, "Ask the owner": the Khmer says a template letter "is planned but not yet
  written". The English now says the letter exists, a lawyer has not reviewed it, and it is not
  legal advice.
- `content/km/contact.md`, "Everything else": the Khmer says "the two forms above". The English now
  says "the forms above", because a third form (projects) was added.

Neither says anything harmful. Neither is a back translation problem.
