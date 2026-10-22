# Russian back translation check (ru)

Part B of issue #49: a second agent read the Russian safety and legal wording, wrote its own English
back translation of each item before looking at the English source, and compared. Checked on
2026-10-21 on the branch `agent/tr-ru`, after merging main into it that day.

Classes: **same meaning**, **softened**, **strengthened**, **changed**, **wrong fact** (a number, phone,
address, date, dollar amount or office name). Every change of meaning and every wrong fact was fixed in
place. Items that are the same meaning are not listed in the table.

## What was checked

| Group | Items checked | Not the same meaning |
|---|---|---|
| The six word for word passages from ETHICS.md (possible estate, conservatorship warning, deed fraud notice, both displacement cautions, brownfield soil note), in every place they appear: 8 catalog keys, 1 registry warning, 4 quotes on Use this responsibly, 1 on How to do it, the soil note on the brownfield layer and the rules map, and the cautions in 4 download lines | 6 passages in 20 places | 0 (all identical in every place, and the same meaning as ETHICS.md) |
| Legal routes in `registry/i18n/ru.yaml` (`routes:`): label, who, cost, timeline, warning, steps and link labels. Every number, phone, email, address, date and dollar amount was also compared by script | 24 routes, 201 items (97 fields, 68 steps, 36 link labels) | 2 |
| Owner flags, `dossier.flags.*` (what it means, be careful, a careful next step) | 43 keys | 0 |
| Owner section, `dossier.owner.*` and `dossier.ownerList.*`, including the deed fraud notice, held back notes and the owner type wording | 87 keys, plus 41 owner type and confidence keys | 1 |
| `dossier.actions.*` (including the conservatorship warning and the not legal advice line), the listing box, the banners and the first step to permission | 15 + 17 + 17 keys | 0 |
| Unsafe and imminently dangerous building wording, L&I history, the timeline, the City's deed and permit text | 53 keys | 0 |
| Memorial wording (family's blessing, names, removal, memorial layer, ghost bike) | 55 keys | 0 |
| Survey safety tips and survey sheet text (4 tips, the tunnel stations, how to fill in, privacy of the sheet), and the Stay safe lists on the StreetComplete page | 34 keys, plus the 6 safety bullets and 6 group steps on the StreetComplete page | 0 |
| Not legal advice, early preview, terms and download notes | 10 keys, plus the same lines on Terms, How to do it and About | 0 |
| Displacement watch (cautions, signs, protections, context numbers, exports) | 73 keys | 0 |
| Rules for a lot (zoning, historic, hearings, appeals, brownfield, flood) | 158 keys | 1 |
| Land Bank in numbers (prices, limits, programs, listed lots) | 61 keys | 2 |
| Privacy and storage lines, evidence badges, redlining, 311, crossing guards, parking, language note | 84 keys | 0 |
| Registry suggestions | 19 suggestions, 57 fields | 0 |
| Registry layers: the 14 with safety or caution wording read in full; the other layers and all groups, sources and lens factors were compared by script for numbers | 51 layers, 25 lens factors | 1 |
| Content pages: Use this responsibly, Terms, Privacy read line by line against the English; About, How to do it, Why this works, How we find vacant land, Survey bus stops and Contact read for the same, with every number compared by script | 9 pages, 221 paragraph and list blocks, 42 table rows | 4 |

In all, about 750 catalog keys, 24 routes and 9 pages. All numbers, phones, emails, addresses, dates and
dollar amounts in the routes, the registry and the pages matched the English after fixes.

## Fixed

| Key or place | Russian text as it stood | Back translation | English | Class | What changed |
|---|---|---|---|---|---|
| `routes.tangled_title_help.who` | «до 80% медианы по району» | up to 80% of the median for the district or neighborhood | up to 80% of the area median | changed (an eligibility line set against a neighborhood instead of the wider area) | «до 80% медианного дохода по региону (area median income)» |
| How to do it, the Tangled Title Fund bullet | «80% типичного дохода по району» | 80% of the typical income for the district | 80% of the area's typical income | changed (same reason) | «по региону» |
| `landBank.programs.homesBelow30` | «ниже 30% дохода района» | below 30% of the district's income | below 30% of area income | changed (same reason) | «ниже 30% дохода региона» |
| Displacement watch, first sign: Use this responsibly, and `layers.displacement_watch.description` | «дома продаются намного дороже, чем пять лет назад, и быстрее, чем по городу в целом» | homes sell for much more than five years ago, and sell faster than across the city | homes selling for much more than five years before, faster than across the city (prices rising faster) | changed (read as homes selling more quickly, a different fact) | «..., а цены растут быстрее, чем по городу в целом» |
| `dossier.owner.flagsTitle` | «Что говорят городские записи» | What City records say | What City records suggest | strengthened (owner flags are careful inferences, not statements) | «На что указывают городские записи» |
| Use this responsibly, owner flags paragraph | «если наши записи говорят, что владелец ... мог умереть» | if our records say that the owner may have died | if our records suggest the owner of record may have died | strengthened | «если наши записи указывают на то, что владелец ... мог умереть» |
| `dossier.rules.decisions.NEWHEARNOT` | «Новое слушание не назначено» | No new hearing has been scheduled | New hearing not granted | changed (the board refused; it is not merely unscheduled) | «В новом слушании отказано» |
| About, opening paragraph | «улицы, где людям причинили тяжёлый вред или где они погибли» | streets where people were caused serious harm, or died | streets where people have been badly hurt or killed | changed (implies someone did the harm) | «улицы, где люди получили тяжёлые травмы или погибли» |
| `routes.land_bank_side_yard.cost` and `landBank.prices.caption` | «на его оценочную стоимость», «записана оценочная стоимость участка» | a mortgage for its assessed value (the City's tax assessment) | a 30 year mortgage at its appraised value; deeds record the lot's appraised value | changed (an appraisal is not the tax assessment, and the glossary keeps «оценочная стоимость» for the assessment) | «на сумму его стоимости по оценке (appraised value)», «стоимость участка по оценке (appraised value)» |

## Kept, with a note (not the same meaning in a small way, left as the translator wrote it)

| Key or place | Russian text | Back translation | English | Class | Why kept |
|---|---|---|---|---|---|
| Use this responsibly (shootings section), `layers.shootings_hex`, the shootings lens factor, the source name, `legend.hexIntro`, `dossier.nearby.s12` and `s36` | «сколько людей пострадало от стрельбы», «пострадавшие от стрельбы» | how many people were harmed or affected by shootings | how many people were shot; shooting victims | softened a little | «пострадавшие» is the usual Russian word for victims, and the English source name is "Shooting victims". A native speaker should confirm that it reads as including people who were killed. |
| `dossier.flags.imminently_dangerous.careful` | «может обрушиться в любой момент» | may collapse at any moment | could fail at any time | strengthened a little ("fail" made specific) | Same direction and a clearer warning: stay away. |
| Use this responsibly and About, the policing sections: «Никакого полицейского контроля», «просить об усилении контроля» | | No police control; asking for stronger control | No policing; asking for more enforcement | same meaning with a vague word | «контроль» is the common Russian word for enforcement here, and both pages still say the site never suggests police. A native speaker may prefer a plainer phrase. |
| Contact, the correction form: «Форма на английском языке, но писать можно по-русски» | | The form is in English, but you may write in Russian | (no such sentence) | added text | Not a safety wording. It promises something the English page does not, and the Spanish page has the same sentence, so the orchestrator should decide for all languages. |
| `dossier.listing.title` | «Городские земельные ведомства внесли в список доступных» | The City's land agencies put it on the list of available ones | Listed as available by the City's land agencies | same meaning, but the heading is an elliptical sentence | Reads acceptably as a heading; a native speaker may prefer «Городские земельные ведомства указали его как доступный». |

## For a native speaker

- «пострадавшие от стрельбы» (see above): does it include people killed?
- «Никакого полицейского контроля» as a section title.
- «по региону» for "area" in the Tangled Title and Land Bank income lines: is «регион» the word a Russian speaker in Philadelphia would read as the metro area?
- «В новом слушании отказано» for a board decision "New hearing not granted".
- «Консерваторство (conservatorship)» and «попечитель (conservator)»: the glossary choice is kept, and the Latin word beside it makes the route recognizable. A lawyer who works in Russian may know a better common word.
- «рекультивация» in the brownfield note, for "cleanup": it never says the site is clean or safe, and the next sentence says to test the soil, but a native speaker should confirm it does not sound like a guarantee.

## Not covered here

Text added to English after the translator finished (the "Tell us about a project you finished" sections on
How to do it and Contact, the `projects.*` interface keys, the `projects` layer and a few new sources) is not
in `ru` yet. The brief for the later catch up pass should include them. They carry no word for word passage,
but the project form text mentions photos of children and permission, so it should be back translated when
it is done.
