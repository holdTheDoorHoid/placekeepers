# French back translation check (fr)

Part B of issue #49. For each item, the checker wrote a back translation into English from the
French first, then compared it with the English source. Every item was sorted as same meaning,
softened, strengthened, changed, or a wrong fact (a number, phone, address, date, dollar amount or
office name). Fixes were made in place in `web/src/i18n/locales/fr.ts`, `registry/i18n/fr.yaml`
and `content/fr/`. The glossary (`docs/i18n/glossary-fr.md`) records the four terms that changed.

Checked against `main` at 27336fb (the French translation already merged there).

## What was checked

| Group | Items checked |
|---|---|
| 1. The six word for word passages of `docs/ETHICS.md` (possible estate, conservatorship warning, deed fraud notice, both displacement cautions, the brownfield soil note) | 6 passages, in 16 places: possible estate 2, conservatorship 4, deed fraud 3 (one word for word, two restated), greening caution 2, gardens, seating and art caution 2, brownfield note 3 |
| 2. Legal routes in `registry/i18n/fr.yaml` | 24 routes, 201 fields (labels, who, warning, cost, timeline, every step, every link label) |
| 3a. Safety and caution wording in `fr.ts` | 1,019 keys: owner flags 43, `dossier.actions` 15, owner block, deed fraud, City list of public land and owner types 166, lot rules, brownfield and hearings 148, history, unsafe and imminently dangerous notices, summary and sources 215, displacement watch 73, first step to get permission and vacancy reasons 39, memorials 33, survey safety tips 18, privacy, downloads and "not legal advice" lines 68, redlining, flood, heat, cooling sites, 311 requests, evidence badges and the Land Bank page 201 |
| 3b. Other registry text in `fr.yaml` | 20 suggestions (60 fields), 5 lenses with their 24 factors, 50 layer descriptions, 8 partner lines |
| 3c. Content pages in `content/fr/` | 9 pages, 327 blocks (paragraphs, list items, table rows, headings), of which the Terms, Privacy and Use this responsibly pages are 79 |

Wrong facts: none. A script compared every run of digits (numbers, phone numbers, dollar amounts,
dates, P.O. box numbers, ZIP codes) and every email address between English and French across the
catalog, the registry and the pages. The only differences are on purpose: 12 hour times written on
the 24 hour clock, the liter gloss on 20 gallons, and the text of the two pages that English has
added since (see "Not covered" below). Links to the site's own pages are relative in French, as
`docs/TRANSLATING.md` asks.

The six passages: all six are same meaning in all 16 places. The possible estate text says
"Il se peut que le propriétaire enregistré soit décédé" (it may be that the owner is deceased),
never that the owner died. The soil note never says "clean" or "safe". No French text suggests
police or enforcement, hints at a price, or says how easy a lot is to take, apart from the
sentences that say the map never does.

## Items that were not "same meaning"

| Key or place | French text (before) | Back translation | English | What was changed |
|---|---|---|---|---|
| `routes.ghost_bike_request.label` (strengthened) | « Demander à la Bicycle Coalition un ghost bike ou un mémorial » | Ask the Bicycle Coalition for a ghost bike or a memorial | Ask the Bicycle Coalition about a ghost bike or memorial | It read as a request for the memorial itself, before the family is involved. Now « Se renseigner auprès de la Bicycle Coalition au sujet d'un ghost bike ou d'un mémorial ». The steps still say a memorial goes up only with the family's blessing. |
| `routes.homestead_exemption` third step and `timeline` (changed, a date edge) | « avant le 1er décembre (avant le 1er octobre pour la voir sur la prochaine facture) » and « À déposer avant le 1er décembre de chaque année » | Apply before December 1 (before October 1 to see it on the next bill). Due before December 1 each year. | Apply by December 1 (by October 1 to see it on the next bill). Due December 1 each year. | « Avant le » can read as leaving out the day itself, so a filing on December 1 looked late. Now « au plus tard le 1er décembre » and « au plus tard le 1er octobre ». |
| `dossier.owner.cityStatuses`, the competitive bid status, second line (strengthened) | « Les agences foncières de la Ville ont demandé des offres pour l'acquérir. » | The City's land agencies asked for offers to acquire it. | The City's land agencies have asked for bids on it. | « Pour l'acquérir » added buying that English does not say. Now « pour ce terrain ». |
| `content/fr/about.md`, "Ce n'est pas un outil de police" (softened) | « ni de demander plus de contrôles » | never suggests calling the police or asking for more checks | never suggests calling the police or asking for more enforcement | « Contrôles » means checks, which narrows a sentence that promises the map never asks for enforcement. Now « ni de demander que la loi soit appliquée plus sévèrement ». |
| `content/fr/responsibly.md`, "Pas de police" (softened) | « ni de demander plus de contrôles » | same as above | same as above | Same fix. |
| `content/fr/how.md`, "Demander au propriétaire" (a wrong fact and a dropped protective line) | « Un modèle de lettre pour demander la permission est prévu mais **pas encore écrit**. » | A template letter asking for permission is planned but not written yet. | "Write a letter" opens a letter asking the owner for permission. **A lawyer has not reviewed it yet, and it is not legal advice.** | The English page changed on `main` (M5.1) after the translation was written. The letter now exists, and the French left out the not legal advice line. Now: « le lien pour écrire une lettre ouvre [une lettre pour demander la permission au propriétaire](../letters/) ... **Un avocat ne l'a pas encore relue, et ce n'est pas un avis juridique.** ». The link words do not quote the button, which is still English until the letters page is translated. |
| `routes.otis_contact`, first step (same meaning, grammar) | « Écrivez à le Bureau des systèmes de transport et d'infrastructure (OTIS) » | Write to the Office of Transportation and Infrastructure Systems (OTIS) | the same | « À le » is not French. Now « au Bureau ». |
| `routes.mural_arts_wall_request`, third step (same meaning, grammar) | « passe aussi par l'Commission des arts de la Ville » | also goes to the City's Art Commission | the same | Now « par la Commission des arts ». |

## Glosses and wording kept as the translator wrote them

These are not the same word for word, but they keep or strengthen the caution, so they stay.

| Place | French | Why it stays |
|---|---|---|
| `content/fr/responsibly.md`, after the possible estate quote | « Elle ne dit jamais « décédé » comme un fait » (never says "deceased" as a fact) | English says it never says "deceased". The quoted passage itself says « décédé » inside a possibility, so the gloss is what makes the sentence true. It keeps the caution. |
| `survey.safety[1]` and the safety list in `streetcomplete.md` | « avec une autre personne » (with another person) | English says "with a friend". The protective step of not going alone is kept. |
| `redlining.grades.D` | « noté « dangereux » » for "graded hazardous" | The glossary allows « dangereux » only inside quotation marks as the 1937 agency's own word. |
| `dossier.history.documents` for a deed from an estate | « Acte d'une succession » | Says estate, never that the owner died. |
| `survey.editorSteps[2]` | adds « L'éditeur peut afficher ces mots en français. » | An added fact about the OpenStreetMap editor, harmless. A native speaker may want to confirm it. |
| `content/fr/contact.md`, first section | adds « Le formulaire est en anglais, mais vous pouvez écrire en français. » | An added promise that a person will read French. The owner should decide whether to keep it. |

## For a native speaker or a lawyer to look at

- **Possession prolongée (adverse possession)** is the glossary's term. French law's own words are
  closer to « prescription acquisitive » or « usucapion », and « possession prolongée » says nothing
  about possession against the owner's wishes. The English term in brackets keeps it findable, but a
  French speaking lawyer should say whether the French words alone mislead.
- **Mise sous administration judiciaire (conservatorship)** and **administrateur (conservator)**:
  the French court term may differ from the Pennsylvania meaning. The English in brackets is kept.
- **Tangled title** as « titre de propriété embrouillé » is understandable but not a legal term.
- `suggestions.report_dumping.summary` and `layers.dumping.description` say « Quelqu'un a interrogé
  Philly311 sur un dépôt sauvage » for "someone asked Philly311 about illegal dumping". It is the same
  as the English, but « interrogé » can read as "questioned". « A signalé à Philly311 » may read better.
- `content/fr/how.md` says « Le prix est petit » for "the price is small". Natural French would be
  « modique » or « faible ». Style only.
- « Propriétaire enregistré » for "owner of record", and « avertissement » for "warning": both are
  fine in plain French, but worth a read by someone who knows how Haitian and West African
  readers would take them.

## Not covered by this check (the English moved after the translation)

`main` has English text that the French translator never saw (lot packets, who represents you,
letters, the neighbor flyer and the projects layer: M5.1, M5.2 and after). It shows in English with
the usual note until it is translated. The next translator pass should include:

- 296 interface keys (`npm run i18n:status -- fr --english`), including `letters.unreviewed`
  ("A lawyer has not reviewed this letter yet. It is not legal advice."), `letters.legalHelp`, the
  letters' own text, and the flyer's guidance on what to leave off a printed sign.
- 24 registry texts (the new sources, `layers.projects`).
- `content/posting.md`, and the sections that English added to `content/how.md` ("Organizing with
  your neighbors", "Tell us about a project you finished") and `content/contact.md` ("Tell us about a
  project you finished", plus "the forms above" in the last section). The French pages do not
  mention them, so they say nothing wrong, but they are incomplete.
