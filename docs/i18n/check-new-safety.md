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
| Listed as available, interface text: the nearby card and filter chip, the legend line, the Land Bank in numbers page (12 keys, its source line, its download line, the agency help line), the lot page box (11 keys), the City list lines on the owner section (5 keys, 4 agency names, 17 City statuses) | 51 |
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

Two automatic checks backed up the reading: the numbers, section codes and dollar amounts in every
item were compared with the English (a script listed every digit sequence in both and I read the
differences), and every translation was searched for dashes used as punctuation.

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

