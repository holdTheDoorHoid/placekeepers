# Haitian Creole (ht): back translation check

Part B of issue #49. Checked on 2026-10-21 by an AI checker, against `main` as merged into
`agent/tr-ht` that day. This is not a native speaker's review: `reviewed` stays off for `ht`.

**Method.** For each item I read the Creole first, wrote my own English back translation, then read
the English source and classified the difference as same meaning, softened, strengthened, changed,
or a wrong fact (number, phone, address, date, dollar amount, office name). Exception: I had already
read the six word for word passages in `docs/ETHICS.md` before the Creole, so for those the back
translation was a word by word comparison, not a blind one. As a second, mechanical check, every
number in the nine content pages, the interface catalog and the registry file was compared with the
English for the same key. They all match (the only difference is `2026-10-09` written as
"9 oktòb 2026").

## What was checked

| Group | What | How many |
|---|---|---|
| 1. Word for word passages | The six ETHICS passages (possible estate, conservatorship warning, deed fraud notice, both displacement cautions, brownfield soil note) | 6 passages in 14 places: the catalog keys, `routes.conservatorship.warning`, and every copy in `content/ht/responsibly.md` and `content/ht/how.md`. All 14 are the same meaning, and every repeat is letter for letter identical to the catalog text |
| 2. Legal routes | Every route in the `routes:` section of `registry/i18n/ht.yaml`: label, who, steps, cost, timeline, warning, link labels | 24 routes, 201 text items. Every phone number, email address, street address, dollar amount, percentage, date and deadline matches the English |
| 2b. Suggestions that carry cost or caution | The registry suggestion cards for lots, buildings, memorials, corners and stops | 17 suggestions, 51 items |
| 3. Safety and caution wording, interface | Owner flags (`dossier.flags.*`, careful and next lines), `dossier.actions.*`, unsafe and imminently dangerous wording, memorial wording, survey safety tips, "not legal advice" lines, displacement watch text, land agency listing text, rules and brownfield text, privacy and removal text, crash and High Injury Network wording | 435 catalog keys |
| 3b. Safety and caution wording, registry | Layer descriptions (shootings, street safety, crashes, memorials, brownfields, displacement watch, hearings, redlining, dumping), lens descriptions, the live City data option | 9 layers, 5 lenses, 1 option |
| 3c. Content pages | Terms, Privacy, Use this responsibly, How to do it, Contact, About, Why this works, How we find vacant land, Survey bus stops | 9 pages, about 220 paragraph level blocks, read paragraph by paragraph |

Result: 7 problems, in 16 places, were wrong or changed the meaning, and were fixed in place.
Another 6 items were left as they are and are flagged for a native speaker. Everything else was the
same meaning.

None of the fixes was in the six word for word passages. No text says or implies the owner
certainly died or has no heirs, none says a brownfield site is clean or safe, none suggests police
or enforcement beyond what the English says (the English How to do it page itself names "the police
district" for block party permits, and the Creole matches it), and none hints at a price or how easy
a lot is to take (the Creole "ki jan li t ap fasil pou pran yo nan men pwopriyetè yo" in About and
Use this responsibly matches the English "how easy they would be to take from their owner", which
says the map does not offer such a sort).

## Items changed in place

| Key or place | The Creole before | My back translation | The English | What I changed |
|---|---|---|---|---|
| `dossier.flags.tax_debt_2025.text` | "Depi jiyè 2025, dosye Vil la te montre ..." | "Since July 2025, City records showed ..." | "As of July 2025, City records showed ..." | Changed. "Depi" means since, and it turns a dated snapshot into something that looks current. Now "Dapre dosye Vil la nan jiyè 2025, te gen ..." ("According to the City's July 2025 records, there was ...") |
| `dossier.owner.flagTitles.tax_debt_2025` | "Dèt taks depi jiyè 2025" | "Tax debt since July 2025" | "Tax debt as of July 2025" | Changed, same reason. Now "Dèt taks dapre dosye jiyè 2025" |
| `registry/i18n/ht.yaml`, `sources.cagp_tax_2025.name` | "Dèt taks depi jiyè 2025 (Clean & Green Philly)" | "Tax debt since July 2025 (Clean & Green Philly)" | "Tax debt as of July 2025 (Clean & Green Philly)" | Changed, same reason. Now "Dèt taks dapre dosye jiyè 2025 (Clean & Green Philly)" |
| `content/ht/about.md`, the Clean & Green Philly paragraph | "dènye kopi pwojè a sou dèt taks depi jiyè 2025" | "the project's latest copy on tax debt since July 2025" | "final snapshot of tax debt from July 2025" | Changed, same reason. Now "... dèt taks nan jiyè 2025" |
| `dossier.owner.taxNoDebt`, `taxUnknown`, `taxHeld` | "Vil la pa pibliye ankò balans taks chak pwopriyete ..." | "The City does not publish each property's tax balance yet" (or "any more"; the phrase can mean either) | "The City no longer publishes each property's tax balance as open data" | Wrong fact risk. "Pa ... ankò" can read as "not yet", which promises the data is coming. Now "Vil la sispann pibliye ..." ("The City stopped publishing ...") |
| `survey.safety[0]` and the first bullet of "Rete an sekirite" in `content/ht/streetcomplete.md` | "Pa janm kanpe nan ri a oswa antre nan liy bis pou gade yon estasyon." | "Never stand in the street or step into the bus line (route) to look at a stop." | "Never stand in the street or step into a bus lane to look at a stop." | Changed. "Liy" means a transit route here, so the warning about the lane meant nothing. Now "antre nan bann bis la" ("the bus lane"; the glossary already uses "bann" for a road lane) |
| `dossier.actions.notListed` | "lis teren ak bilding ki gen anpil chans pou yo vid" | "the list of lots and buildings that have a high chance of being vacant" | "our list of likely vacant lots and buildings" | Strengthened. "Gen anpil chans" is this catalog's label for "very likely vacant", but the list also holds "probably vacant" parcels, so the line overstated how sure the map is. Now "ki pwobableman vid" |
| `reasons.city_land`, `reasons.city_building` | "teren / bilding ki gen anpil chans pou l vid" | "land / a building that has a high chance of being vacant" | "likely vacant land / a likely vacant building" | Strengthened, same reason. Now "ki pwobableman vid" |
| `content/ht/vacant-land.md`, the example reasons sentence | "lis Vil la di sa a gen anpil chans pou l se tè vid" | "the City's list says this has a high chance of being vacant land" | "the City's list says this is likely vacant land" | Strengthened, same reason. Now "lis Vil la di sa a pwobableman se tè vid" |
| `dossier.actions.toConfirm` | "Toujou pou konfime ak òganizasyon ki nome isit la." | "Always to be confirmed with the organization named here" ("toujou" means both always and still) | "Still to be confirmed with the organization named here." | Changed, ambiguous. The English says the detail has not been confirmed yet. Now "Poko konfime ak òganizasyon ki nome isit la." (the glossary already has "poko konfime") |
| `routes.longtime_owner_occupants`, steps, second item | "nan 1.5 fwa sa ane anvan an oswa 1.75 fwa pi ba valè senk dènye ane yo" | "at 1.5 times last year's or 1.75 times lower value of the last five years" (garbled) | "at 1.5 times the year before or 1.75 times the lowest value of the last five years" | Changed, unclear. Now "1.75 fwa valè ki pi ba nan senk dènye ane yo" ("1.75 times the lowest value of the last five years") |
| `content/ht/how.md`, Community Garden License bullet | "Land Bank te sispann siyen nouvo lis kalite sa a an 2020" | "the Land Bank stopped signing new lists of this kind in 2020" | "the Land Bank stopped signing new leases of this kind in 2020" | Wrong word. "Lis" is a list, not a lease. Now "nouvo kontra lokasyon" ("new lease agreements"; "lokasyon" is already the catalog's word for lease in `dossier.listing.decline`) |

The seven problems: a dated snapshot written as "since" (four places), "not yet" for "no longer"
(three keys), the bus lane (two places), "likely vacant" written as "very likely" (four places),
"still to be confirmed" (one), the LOOP cap figure (one) and "lease" written as "list" (one).

## Items left as they are, for a native speaker

These are the same meaning or close to it, and I could not tell that a change would be better. A
native speaker should look at them.

| Key or place | The Creole | My back translation | The English | Note |
|---|---|---|---|---|
| `streets.killed.*`, `streets.memorialsIntro`, `dossier.nearby.killed`, `registry` memorial text, route steps for ghost bikes | "Mouri pandan l t ap mache", "ki mouri nan yon aksidan sikilasyon" | "Died while walking", "who died in a traffic crash" | "Killed while walking", "killed in a traffic crash" | Slightly softer: "mouri" is died, the English is killed. "Touye" would name a killer in Creole, so I left it. Is "mouri" what a bereaved family would want to read? |
| `content/ht/terms.md` and `content/ht/responsibly.md` | "pou anmède pèsonn" | "to bother anyone" | "to harass anyone" | "Anmède" covers annoy, bother and harass in Creole. If a stronger word exists for harassment that neighbors would understand, the Terms should use it |
| `content/ht/contact.md`, first section | "Fòm nan an angle, men ou ka ekri an kreyòl." | "The form is in English, but you can write in Creole." | (not in the English) | The translator added a promise the English does not make. The Spanish and Brazilian Portuguese pages added the same sentence, so this is a decision for the owner, not a Creole error. The owner should confirm someone can read Creole reports |
| `dossier.owner.deedFraud`, last sentence | "Vil la bloke otomatikman tou akt kote vandè a ..." | "The City also automatically blocks deeds where the seller ..." | "the City also automatically blocks deeds whose seller had already died ..." | "Tou" sits right before "akt" and could be read as "tout" (all deeds). Either reading is harmless, and this is a word for word passage, so I did not touch it |
| Registry route `public_space_mini_grant`, `content/ht/how.md` money section | "yo dwe fini nan oktòb" | "they must finish in October" | "are due in October" | "Fini" could be read as the project must be finished. The deadline reading is the likelier one, but a native speaker may prefer "dat limit la se nan oktòb" |
| `redlining.grades.D` | "klase "danjere"" | "graded "dangerous"" | "graded "hazardous"" | It quotes the 1937 grade label, so I left it, but it is the one place the catalog uses "danjere" for a neighborhood. A softer word for "hazardous" may exist |

## Not translated yet, from main (not the translator's gap)

The merge of `main` on 2026-10-21 brought in the "Projects neighbors finished" feature after the
translator had finished, so these still show in English, marked as English: 33 `projects.*` keys in
`web/src/i18n/locales/ht.ts` (including `projects.privacy` and `projects.tellUsNote`, which says
photos must never show a child's face or a license plate), the registry texts
`sources.project_reports`, `sources.project_corrections` and `layers.projects`, and the English sections "Tell us about a project you finished" in `content/contact.md` and
`content/how.md`, which `content/ht/contact.md` and `content/ht/how.md` do not have yet. The photo
safety lines in particular should be translated before `ht` goes live.
