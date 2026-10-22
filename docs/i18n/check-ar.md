# Arabic back translation check

Checked on 2026-10-21, on branch `agent/tr-ar` after merging `main` (the merge was clean).
Part B of issue #49: does the Arabic safety and legal wording mean exactly what the English means?

Method. For each item the Arabic was read first and put back into English in the checker's own
words, and only then compared with the English source. Each item was sorted as same meaning,
softened, strengthened, changed, or a wrong fact (a number, phone number, address, date, dollar
amount or office name). Every number, phone number, email address, street address, date and
dollar amount in the routes and the content pages was also compared with a script, and every one
matched, apart from the numbers in the new English sections listed under "Arabic that is behind the English". The word for word passages were compared as whole
units, and the copies on the content pages were compared with the catalog text by script.

## What was checked

| Group | Items checked | Same meaning | Not the same, fixed |
|---|---|---|---|
| 1. The six ETHICS word for word passages, every place they appear | 6 passages in 17 places | 17 | 0 |
| 2. Legal routes in `registry/i18n/ar.yaml` | 24 routes, 201 text items | 201 | 0 |
| 3. Safety and caution wording | see the breakdown below | all but 5 | 5 |

Group 1, by passage: possible estate (3 sentences in `ar.ts`, and the quote in Use this
responsibly), conservatorship warning (`ar.ts`, `ar.yaml`, How to do it, Use this responsibly),
deed fraud notice (`ar.ts`, and the deed theft paragraph in Use this responsibly, which is a
paraphrase in English too), displacement caution for greening (`ar.ts`, Use this responsibly),
displacement caution for gardens, seating and art (`ar.ts`, Use this responsibly), brownfield soil
note (`dossier.rules.brownfield`, `rulesMap.notes.brownfields`, and the brownfield layer
description). The quotes on the content pages are identical to the catalog text, and the route
warning in `ar.yaml` is identical to `dossier.actions.conservatorshipWarning`. The export lines
and the print layouts build their sentence from the same keys, so they cannot differ.

Group 2: the 24 routes hold 24 titles, 24 who lines, 24 cost lines, 24 timeline lines, 1 warning,
68 steps and 36 link labels. Each route has as many steps as the English and the same link
addresses.

Group 3, in `web/src/i18n/locales/ar.ts` (counted as the text strings under each key):

| Place | Strings |
|---|---|
| `dossier.flags` (ten owner flags, with their careful and next lines) | 43 |
| `dossier.actions` (the route card, the not legal advice line, the conservatorship warning) | 15 |
| `dossier.owner` (flag titles, held back note, deed fraud, help, tax lines, City list statuses) | 80 |
| `dossier.listing`, `dossier.summary`, `reasons` (including unsafe and imminently dangerous) | 59 |
| `dossier.history` lines about unsafe, imminently dangerous, sealed and demolished buildings | 13 |
| `dossier.rules` (historic, zoning, brownfield, appeals, hearings) | 121 |
| `displacement` | 73 |
| `streets` (memorials, "only with the family's blessing", removal) and `content` removal text | 58 |
| `survey` safety tips, how to fill in, editor steps and notes | 13 |
| `permission`, `parking`, `evidence`, `landBank` (the rules about price and ease) | 168 |
| not legal advice lines (`app.notAffiliated`, `actions.notLegalAdvice`, `export.ownerLine`) | 3 |

Group 3, in `registry/i18n/ar.yaml`: 19 suggestions, 8 partner lines, and the 27 layer descriptions
that carry a caution (shootings, memorials, 311 reports, displacement watch, brownfields, historic
districts, hearings, redlining and others).

Group 3, in `content/ar/`: Terms (13 blocks), Privacy (15), Use this responsibly (40), How to do it
(36), About (22), Contact (14), Why this works (23), How we find vacant land (16) and Survey bus
stops (42, including the six safety rules).

## What was not the same meaning, and what changed

| Key or place | The Arabic | Back translation | The English | Class and fix |
|---|---|---|---|---|
| `place.confidence.1` and `dossier.summary.confidence.low` | لسنا متأكدين تمامًا أنها فارغة | We are not completely sure it is vacant | We are not very sure it is vacant | Softened: "not completely sure" sounds nearly sure, and this label is what keeps a possible home out of the owner notes. Changed to لسنا متأكدين كثيرًا من أنها فارغة, the same wording `legend.sureLow` already used. |
| `survey.safety` (third tip) | وانظر أمامك قبل أن تعبر | and look ahead before you cross | and look up before you cross | Changed: the tip is about raising your eyes from the phone, and "look ahead" does not say that. Changed to وارفع نظرك قبل أن تعبر. |
| `content/ar/streetcomplete.md`, Stay safe, second bullet | the same phrase | the same | the same | The same fix as the line above, so the page and the sheet agree. |
| `content/ar/how.md`, Private lots, "Ask the owner" | There is a plan for a template letter, but it has not been written yet | the same | From a lot page the letter opens; a lawyer has not reviewed it yet, and it is not legal advice | Wrong fact and a dropped caution. The English changed after the translator worked (letters were built in M5.1), so the Arabic said the letter did not exist and lost the not legal advice line. Rewritten to match the English, with the link to the letters page. |

## Checked and left as it is

| Key or place | Note |
|---|---|
| `dossier.rules.brownfield` | The translator added the gloss "(أرض يُحتمل تلوثها)", land that may be contaminated, after "brownfield site". It keeps and strengthens the caution. The note says cleanup work, never clean or safe. Kept. |
| `dossier.actions.conservatorshipWarning`, `routes.conservatorship.warning` | تنتزع (seizes) is a little stronger than "can take away". It points the same way as the warning. Kept. |
| `displacement.placemakingCaution` | "the street" for "a block". Same meaning. Kept. |
| `dossier.actions.notListed` | "possible vacant lots and buildings" for "likely". A weaker claim, in the safe direction. Kept. |
| `dossier.flags.many_parcels.careful` | "is not a violation" for "is not wrongdoing". The Arabic word for violation is also the word for an L&I violation, which is true here too. Kept. |
| `suggestions.traffic_calming_petition` | "60 percent of the residents of the block"; the English says "of the block" and the route correctly says households. Kept. |
| `dossier.flags.possible_estate`, `ownerType` and `flagTitles` | The estate is "possible" and the owner "may have died" everywhere. No place says the owner died or has no heirs. Checked, and the Arabic has no such wording. |
| Words about police, enforcement, price, buying and ease | The only matches are the lines that say the site never does these, which match the English. "A nominal price" in the side yard route and "the price is small" in How to do it are in the English too. |

## Arabic that is behind the English (not a translation error)

Main moved on after the translator finished, so the English now has text the Arabic does not. It
shows in English under the usual marker until a translator does it. Nothing here is wrong, but two
of the missing pieces carry cautions, so a translator should do them soon.

- `content/ar/how.md` lacks the section "Organizing with your neighbors" (who represents you,
  packets, letters, the neighbor flyer, with "a lawyer has not reviewed these letters, they are not
  legal advice", and "never on utility poles, street lights, traffic signs or street trees, fines
  from $300 a sign") and the section "Tell us about a project you finished".
- `content/ar/contact.md` lacks "Tell us about a project you finished".
- `content/ar/posting.md` does not exist (the new page "where you may post a flyer").
- `ar.ts` lacks 296 keys: `letters` (92, including `letters.unreviewed`, the not legal advice
  line), `packet` (78), `flyer` (49), `represent` (43), `projects` (33), `sources` (22), the
  `posting` nav label and two layer strings. `ar.yaml` lacks the 24 registry texts for the new
  sources and the projects layer.

## For a native speaker to look at

- التهجير السكني for displacement. It can read as forced expulsion by an authority, which is
  stronger than prices pushing people out. A word such as the one the City or housing groups use in
  Arabic may be better.
- الحراسة القضائية for conservatorship under Act 135. It is the usual word for a court receiver, and
  a lawyer or native speaker should confirm that it fits a court appointed caretaker for a property.
- مباركة العائلة for the family's blessing. It is idiomatic for approval, but beside a memorial it
  might be read as a congratulation. The alternative "موافقة العائلة ومباركتها" says approval
  plainly.
- بيع الشريف for sheriff sale. A reader who does not know American sheriffs may not know it is a
  forced auction for unpaid debts. The text explains the effect, but a short gloss could help.
- The masculine imperative used for every instruction, as the glossary decided.
- The gloss "تغيّرًا سكانيًا بفعل ارتفاع الأسعار (gentrification)" in the conservatorship warning:
  correct in meaning, but long.
