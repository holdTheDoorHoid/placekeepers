# Back translation check of the new safety wording, all nine languages

This checks the safety wording added in the catch up pass for the letters, the flyer, the
projects form, who represents you, and the City's "listed as available" label. Each language
had its older safety wording checked already (`docs/i18n/check-<code>.md`); this wording had
only been read by its translator.

## What was checked, in every language

Each language has 109 items, in `web/src/i18n/locales/<code>.ts`, `registry/i18n/<code>.yaml`
and `content/<code>/`:

| Group | Items |
|---|---|
| Letters: `letters.unreviewed`, `legalHelp`, `legalHelpShort`, the four `letters.gate.*` reasons, `notOffered`, the owner letter's name and help line, and the owner letter's four sentences (`letters.owner.intro`, `ask`, `terms`, `writing`), which must never mention buying, prices, taxes owed, death or estates, and must say the owner can say no and ask us to stop at any time | 14 |
| Flyer: `flyer.publicWarning`, `publicCaution`, `whereLead`, `whereNot` | 4 |
| Projects: `projects.tellUsNote`, `projects.privacy` | 2 |
| Who represents you: `represent.officialOnly` | 1 |
| Listed as available, interface text: the nearby card and filter chip, the legend line, the Land Bank in numbers page (12 keys, its source line, its download line, the agency help line), the lot page box (11 keys), the City list lines on the owner section (5 keys, 4 agency names, 17 City statuses) | 55 |
| Listed as available, registry text: the layer setting label and its two options, and the displacement watch description | 4 |
| Flyer, off limits and public warning on the Where to post a flyer page: the five places that are fine, the five that are off limits (sections 10-1202 and 10-1203, fines of $300 and up to $2,000, trees at least $300 a day, windshields under 10-711 and 10-723.2 at $100, mailboxes, SEPTA treated as off limits), and the "what you print is public" line | 11 |
| How to do it page: the listed as available paragraph, the "Ask the owner" letter line, the Letters line, the line on when the owner letter is offered, the flyer line, and the "Tell us about a project you finished" section (an opening and five bullets) | 11 |
| Contact page: its six sections, read for the form's language and for any promise of a reply in the language | 6 |
| Use this responsibly page: the line about the box of a lot listed as available | 1 |

Method: for each item I wrote my own English back translation from the translated text, then
compared it with the English source. A note on how blind that was: I had already read the English
interface text for the letters, flyer, projects and listed keys while finding the keys, so for
those items my back translation is as literal as I could make it (word by word, from the
translated text) rather than truly blind. For the content pages (posting, How to do it, Contact,
Use this responsibly) I back translated before opening the English. Each item was classed as same
meaning, softened, strengthened, changed, or a wrong fact (a number, code section or dollar
amount). Every change of meaning and every wrong fact was fixed in place.

Two automatic checks backed up the reading. First, a script listed every number, section code
and dollar amount in each interface item, registry item and content section, in both the English
and the translation, and I read every difference. The only differences were the date in the
displacement watch description (the English writes 2026-10-09, each translation writes it in words
in its own language). No number, code section or dollar amount was wrong. Second, the project's own
dash rule found no dash used as punctuation in this file, and `tests/strings.test.ts` and
`tests/i18n.test.ts` check every catalog, registry file and content page.

I also read four more lines beside these in all nine languages and found them the same meaning:
`flyer.byNeighbors` ("not by the City or the owner"), `flyer.kept`, `letters.kept` and
`letters.intro`. They are not counted in the totals below.

## Summary

| Language | Items checked | Same meaning | Fixed | What was fixed |
|---|---|---|---|---|
| Spanish (es) | 109 | 109 | 0 | |
| Chinese (zh-Hans) | 109 | 109 | 0 | |
| Vietnamese (vi) | 109 | 109 | 0 | |
| Russian (ru) | 109 | 109 | 0 | |
| Portuguese, Brazil (pt-BR) | 109 | 109 | 0 | |
| Haitian Creole (ht) | 109 | 109 | 0 | |
| Khmer (km) | 109 | 109 | 0 | three questions for a native speaker |
| French (fr) | 109 | 107 | 2 | "post whatever you want" on your own property; "people can ask for it" in a listed status |
| Arabic (ar) | 109 | 108 | 1 | "not very sure" where English says "not sure" in the reason the owner letter is held back |

Across all nine languages: 981 items, 3 changed and fixed, 0 wrong facts. Nothing in any language
mentions buying, prices, taxes owed, death or estates in the owner letter, every language says the
owner can say no and ask us to stop at any time, and no language promises a reply in its own
language on the Contact page.

## Spanish (es)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept (the caution is the same):

| Place | Spanish | Back translation | English | Why kept |
|---|---|---|---|---|
| `letters.gate.public`, and the "City and Land Bank lots go through the Land Bank's programs" line on How to do it | no word for "instead" | "Ask through the Land Bank's programs for neighbors" | "Ask through the Land Bank's programs for neighbors instead" | The sentence before already says the lot is public land, so the redirect still reads as the other way to ask. |
| Where to post a flyer, the library bullet | "La Free Library considera perjudicial poner materiales sin aprobación previa" | The Free Library considers it harmful to put up materials without prior approval | The Free Library lists putting up materials without advance approval as disruptive | "Perjudicial" is a little stronger than "disruptive" and says nothing the library does not. Not a safety line. A native speaker could pick "que causa molestias". |

Listed as available: every place reads as the City's own label ("indicado como disponible", the
glossary term) and none reads as an invitation. The owner type line "properties people can apply
for" is English's own wording and the Spanish keeps it as it is ("que la gente puede solicitar").
Contact page: it says people can write in Spanish and that we read it with a translation tool;
it promises no reply in Spanish.

## Chinese, simplified characters (zh-Hans)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept:

| Place | Chinese | Back translation | English | Why kept |
|---|---|---|---|---|
| `projects.tellUsNote`, and the same line on How to do it | "绝不能有没有同意拍摄的任何人的脸" | never the face of anyone who did not agree to be photographed | never the face of anyone who did not agree | "Agree" is made specific to being photographed. That is the sensible reading in a photo rule, and it is not weaker. |
| `letters.gate.public` | "请改为通过土地银行为邻居开设的计划提出申请" | Please instead apply through the programs the Land Bank has opened for neighbors | Ask through the Land Bank's programs for neighbors instead | "Apply" for "ask" is a little more formal. The Land Bank's programs do take applications. |

Listed as available: every place reads "列为可用" in the City's own words, with the curly quotes
around "可用" in the setting name and the lot page title, as the glossary decided. None reads as an
invitation. Contact page: nothing promises a reply in Chinese (the page does not mention Chinese
at all, which is allowed).

## Vietnamese (vi)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept:

| Place | Vietnamese | Back translation | English | Why kept |
|---|---|---|---|---|
| `flyer.whereNot` | "mức phạt từ $300 mỗi biển hoặc tờ" | fines from $300 per sign or sheet | fines from $300 a sign | "Or sheet" only says the rule covers a paper flyer too. The amount is the same. |
| `letters.gate.public` | "Hãy xin qua các chương trình của Land Bank" | Ask through the Land Bank's programs (no "instead") | Ask through the Land Bank's programs for neighbors instead | The sentence before says the lot is public land, so it still reads as the other way to ask. |

Listed as available: every place says "ghi là có sẵn" or "liệt kê là có sẵn", which reads as the
City's label (noted as, listed as), not an invitation. For a native speaker to look at: "có sẵn"
can also mean "ready to hand" in everyday speech, so it is worth confirming that "được ghi là có
sẵn" does not read as "free to take". The words for "listed" and "noted as" are what keep it a
label. Contact page: says people can write in Vietnamese and that we read it with a translation
tool; promises no reply.

## Russian (ru)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept:

| Place | Russian | Back translation | English | Why kept |
|---|---|---|---|---|
| `flyer.whereNot`, and the flyer line on How to do it | "штраф от $300 за каждую листовку или табличку" | a fine from $300 for each flyer or sign | fines from $300 a sign | "Or flyer" says the rule covers the paper itself. The amount is the same. |
| `letters.gate.public` | "Вместо этого обращайтесь через программы Land Bank для соседей" | Instead, apply through the Land Bank's programs for neighbors | Ask through the Land Bank's programs for neighbors instead | Same meaning. "Обращайтесь" is "go to, apply to". |
| `projects.tellUsNote` | "никогда не прикладывайте фото с лицом ребёнка или любого человека, не давшего согласия" | never attach a photo with the face of a child or of anyone who has not agreed | Photos stay on GitHub: never with the face of a child or of anyone who did not agree | The Russian speaks to the reader ("do not attach"), which is what the rule asks of them. Same rule. |

Listed as available: every place says "внесли в список доступных" or "указывает как доступный"
(entered in the list of available ones, indicates as available), the City's own label, never an
offer. The same word "доступный" also means "affordable" in "доступное жилье" (the City status
"held for affordable housing"), which is correct there and does not confuse the two. Contact page:
says people can write in Russian and that we read it with a translation program; promises no
reply.

## Portuguese, Brazil (pt-BR)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept:

| Place | Portuguese | Back translation | English | Why kept |
|---|---|---|---|---|
| Where to post a flyer, the library bullet | "A Free Library considera comportamento inadequado afixar materiais sem aprovação prévia" | The Free Library considers it inappropriate behavior to put up materials without prior approval | The Free Library lists putting up materials without advance approval as disruptive | "Inadequado" is a little milder than "disruptive", but it says the same thing about the same rule. Not a safety line. |
| `letters.gate.public` | "Peça pelos programas do Land Bank para vizinhos" | Ask through the Land Bank's programs for neighbors (no "instead") | Ask through the Land Bank's programs for neighbors instead | The sentence before says the lot is public land, so it still reads as the other way to ask. |
| `dossier.owner.cityStatuses` for "held for affordable housing" | "moradia acessível" | accessible (affordable) housing | affordable housing | Outside the safety wording, noted only because "acessível" can also mean "accessible to people with disabilities" in Brazil. A native speaker could look. |

Listed as available: every place says "consta como disponível na lista" (appears as available on
the list) or "lista como disponível", the City's own label, never an offer. Contact page: says
people can write in Portuguese and that we read it with a translation tool; promises no reply.

## Haitian Creole (ht)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing needed fixing.

Small differences, kept:

| Place | Haitian Creole | Back translation | English | Why kept |
|---|---|---|---|---|
| `letters.owner.terms` and `letters.owner.intro` | "Nou t ap fè sa", "teren dosye Vil la mete sou non ou" | We would do this; the lot the City's records put in your name | We would do this; the lot that the City's records list in your name | Same meaning. The conditional "t ap" is how Creole says "would". |
| `letters.gate.not_listed` | "si yon lèt bay pwopriyetè li bon isit la" | whether a letter to its owner is good here | whether a letter to its owner is right here | Same meaning. |

Listed as available: every place says "mete l sou lis kòm disponib" (put on the list as
available), which keeps it the City's label, and the line "kote moun ka aplike" (where people can
apply) is English's own wording. None reads as an invitation. For a native speaker to look at:
"disponib" is a borrowed word, so confirm it reads as "listed" and not "free for the taking" in
everyday Creole. Contact page: says people can write in Creole and that we read it with a
translation tool; promises no reply.

## Khmer (km)

Checked 109 items. Same meaning: 109. Changed: 0. Nothing was edited, so the zero width spaces
are untouched. Three places are worth a native speaker's eyes (listed in the second table).

Small differences, kept:

| Place | Khmer | Back translation | English | Why kept |
|---|---|---|---|---|
| Where to post a flyer, off limits, utility poles | "ការដំដែកគោល ឬដាក់អ្វីមួយលើបង្គោលអគ្គិសនី" | driving nails, or putting anything, on an electric pole | Nailing or tacking anything to a utility pole | "ដាក់" (put) is looser than "tack", so the Khmer covers a little more, never less. It keeps the rule on the cautious side. |
| `landBank.listed.sideYard` | "បើកចំហឱ្យអ្នកជិតខាងសុំជាទីធ្លាក្បែរផ្ទះ" | open for a neighbor to ask for as a side yard | Open to a neighbor as a side yard | "Ask for" is added, which matches that the side yard program takes applications. |

For a native speaker to look at:

| Place | Question |
|---|---|
| `projects.tellUsNote` and the photo bullet on How to do it | "...មិនបានយល់ព្រមដាច់ខាត ហើយមិនត្រូវមានស្លាកលេខរថយន្តដាច់ខាត": the word "ដាច់ខាត" (strictly, absolutely) ends each clause. In the second clause it can only mean "never". In the first it follows "did not agree", so a reader could take it as "who flatly did not agree" and so weaken the rule to people who refused. The parallel with the second clause most likely makes it "never" in both. I left it, because I cannot be sure of the best fix. A native speaker might put "ដាច់ខាត" in front of "មិនត្រូវ" in the first clause. |
| All listed as available places | "អាចរកបាន" literally reads "can be found, can be obtained". The glossary chose it with curly quotes and "ចុះបញ្ជីថា" (listed as) so it reads as the City's label. Please confirm it does not read as "easy to get". |
| `dossier.owner.cityStatuses` held for the Council member | "ក្រុមប្រឹក្សាស្រុក" is the district council of a Cambodian "srok". The City Council member is meant. A native speaker could suggest the usual word for a city council member. |

Listed as available: every place says "ចុះបញ្ជីថា “អាចរកបាន”" (listed as "available") with the
word in curly quotes, as the glossary decided, and the old wording "អាចសុំបាន" (can be asked for)
is gone from every listed place. Contact page: says people can write in Khmer and that we read it
with a translation tool; promises no reply.

## French (fr)

Checked 109 items. Same meaning: 107. Changed: 2, both fixed. The narrow no break spaces before
colons, semicolons, question marks and the dollar sign were not touched.

| Key or place | French text | Back translation | English | What changed |
|---|---|---|---|---|
| `content/fr/posting.md`, Where to post a flyer, "Your own window, door or fence" | "Votre propre propriété, c'est à vous d'y afficher ce que vous voulez." | Your own property, it is for you to post there whatever you want. | Your own property is yours to post on. | Strengthened. "Whatever you want" is not in English and reads as no limit at all, on a page about what the law does limit (the next sentence is about the window sign limit). Now "Vous pouvez afficher sur votre propre propriété." |
| `dossier.owner.cityStatuses`, the plain "available" status, second text | "La Land Bank le montre sur sa carte des propriétés que les gens peuvent demander." | The Land Bank shows it on its map of properties that people can ask for. | The Land Bank shows it on its map of properties people can apply for. | Reads as an invitation. "Demander" is the casual "ask for", close to the "you can ask for it" wording the project rules out for the listed status (no wording about ease of acquisition). Every other language has the formal "apply" (a request that goes through a process). Now "pour lesquelles les gens peuvent déposer une demande". |

Small differences, kept:

| Place | French | Back translation | English | Why kept |
|---|---|---|---|---|
| Where to post a flyer, hand delivery bullet | "toute porte portant la mention «pas de publicité»" | any door marked "no advertising" | any door posted "no flyers" | It is the sign a French reader actually sees on a door, with the same meaning. |
| `letters.owner.ask` | "Des voisins de cette rue" | Some neighbors of this street | Neighbors on this block | "Rue" is a street, "block" is a few of them. It is only the opening of a letter the user can edit. |
| Where to post a flyer, the library bullet | "considère comme gênant" | considers bothersome | lists as disruptive | A little milder, same rule, not a safety line. |

Listed as available: every place says "indiqué comme disponible" (indicated as available) or
"répertorié", the City's own label, never an offer. For a native speaker to look at: the "zone de
vigilance" name for the displacement watch is older wording that I did not change, but "vigilance"
can sound like policing. Contact page: says people can write in French and that we read it with a
translation tool; promises no reply.

## Arabic (ar)

Checked 109 items. Same meaning: 108. Changed: 1, fixed.

| Key or place | Arabic text | Back translation | English | What changed |
|---|---|---|---|---|
| `letters.gate.not_sure` (why the owner letter is not offered where the map is unsure the lot is vacant) | "لسنا متأكدين كثيرًا من أن هذه القطعة فارغة" | We are not very sure that this lot is empty. | We are not sure this lot is vacant. | Softened. The translator reused the confidence label "not very sure" (`لسنا متأكدين كثيرًا`), which implies a fair chance it is vacant. This line says the map cannot tell, and the letter is held back because the lot may be someone's home. Now "لسنا متأكدين من أن هذه القطعة فارغة", the same wording the catalog already uses for the same English sentence in `dossier.owner.heldBack` and for "a lot we are not sure about" on How to do it. |

Small differences, kept:

| Place | Arabic | Back translation | English | Why kept |
|---|---|---|---|---|
| `letters.gate.public` | "مكتب مجلس المدينة" | the City Council office | your Council office | The letter and the page that follow are for the reader's own district office. The gate line only points to that letter. |
| `letters.owner.ask` | "الجيران في هذا المقطع" | the neighbors in this segment | the neighbors on this block | "Block" has no single everyday Arabic word. A native speaker may know a better one. |
| Where to post a flyer, the library bullet | "سلوكًا معطِّلًا" | disruptive behavior | disruptive | Same. |

Listed as available: every place says "مُدرجة كمتاحة" or "تُدرجها ... على أنها متاحة" (listed
as available), the City's own label, never an offer. "غير متاح" (not available) is also used for
the letter that the page does not offer ("الخطاب إلى المالك غير متاح هنا"), which is a different
meaning of the same word and reads correctly. For a native speaker to look at: the word "ملصق"
(poster, sticker) stands for "flyer" throughout, and "منشور" appears for "handbill". Contact page:
says people can write in Arabic and that we read it with a translation tool; promises no reply.

