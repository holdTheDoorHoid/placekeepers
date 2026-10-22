# Back translation check, Spanish (es)

This is the Part B check from issue #49: the safety and legal wording of the Spanish text, read
back into English and compared with the English source. It covers `web/src/i18n/locales/es.ts`,
`registry/i18n/es.yaml` and `content/es/*.md`, as merged with main on 2026-10-21.

Method: for each item I wrote my own English back translation from the Spanish before looking at
the English source, then compared the two. Each item was classed as same meaning, softened,
strengthened, changed, or a wrong fact (number, phone, address, date, dollar amount, office name).
Every change of meaning and every wrong fact was fixed in place. A short gloss the translator
added to explain a foreign term was kept when it keeps the caution.

## What was checked

### Group 1: the six word for word passages from docs/ETHICS.md (22 places)

| Passage | Places checked |
|---|---|
| Possible estate | 3 keys (`text`, `careful`, `next`) and the quotation on the Use this responsibly page (4) |
| Conservatorship warning | `dossier.actions.conservatorshipWarning`, `routes.conservatorship.warning`, the quotation on Use this responsibly, the italic copy in How to do it (4) |
| Deed fraud notice | `dossier.owner.deedFraud` and its retelling on Use this responsibly (2) |
| Displacement caution (greening) | `displacement.caution`, the Use this responsibly quotation, and the two download lines that embed it (4) |
| Displacement caution (gardens, seating and art) | `displacement.placemakingCaution`, the Use this responsibly quotation, and the two download lines that embed it (4) |
| Brownfield soil note | `dossier.rules.brownfield`, `rulesMap.notes.brownfields`, the brownfield layer description, the Land rules group description (4) |

Result: 19 of 22 same meaning (4 of them carry the conservatorship gloss, kept). 3 were
softened by the brownfield gloss, which looked only backward in time; fixed in all 3 (the soil
note, the layer description and the group description, see the table below). The fifth
brownfield place, the rules map note, never had the gloss.

### Group 2: every legal route in `registry/i18n/es.yaml` (201 fields)

24 routes: 24 titles, 24 "who" lines, 24 costs, 24 timelines, 1 warning, 68 steps and 36 link
labels. All phone numbers, email addresses, dollar amounts, percentages, dates and office names
were compared one by one with `registry/routes.yaml`. Result: 200 of 201 same meaning, 1 changed
(the ghost bike route title, fixed).

### Group 3: safety and caution wording

| Where | Items |
|---|---|
| Interface text, `es.ts`: owner flags (`dossier.flags.*`, 43), owner section (`dossier.owner.*`, 80, including their careful and next lines), `dossier.actions.*` (15), listing notes (`dossier.listing.*`, 11), lot rules and appeals (`dossier.rules.*`, 121), history and timeline including the unsafe and imminently dangerous building lines (`dossier.history.*`, 137), vacancy reasons (`reasons.*`, 22), rules map notes (`rulesMap.*`, 27), displacement watch (`displacement.*`, 73) | 529 |
| Interface text, `es.ts`: memorial and removal wording and street safety (`streets.*`, 58), legends (`legend.*`, 36), survey sheet safety tips and instructions (`survey.*`, 92), downloads and "not legal advice" lines (`export.*`, 21; `app.*`, 15), removal email text (`content.*`, 3), saved lists (`lists.*`, 42) | 267 |
| Registry text: suggestions including the memorial or ghost bike one (57), lenses (74), groups (32), options (2), partners (16), layers (261), sources (182) | 624 |
| Content pages, read in full against the English: Terms, Privacy, Use this responsibly, How to do it, Survey bus stops (the safety tips), About, Why this works, How we find vacant land, Contact | 9 pages |

Besides reading, two automatic checks compared every number in all 1,928 interface keys, all 811
registry fields and all 9 content pages with the English. They found no wrong number, phone,
date or dollar amount (the only differences are the new English sections listed under "Not
checked" below).

Searches of all three Spanish sources found no word about police or enforcement beyond what the
English has (the "no policing" sections, the Police Department as a data source, and the City's
own "police district" in the block party permit row), no word for how easy or cheap a lot is to
take, and no use of "clean" or "safe" for a brownfield.

Result for group 3: every item same meaning except one unclear phrase (the fast resales note,
fixed). The brownfield glosses in the layer and group descriptions were fixed with group 1. The
differences that were kept are listed in the second table.

## Items that were not "same meaning" and were fixed

| Key or place | Spanish text | Back translation | English | What changed |
|---|---|---|---|---|
| `dossier.rules.brownfield` (soil note) | "...de un "brownfield" (un terreno que pudo haber tenido contaminación) en esta dirección o cerca de ella. Haga analizar el suelo antes de cultivar alimentos." | A federal assessment or cleanup of a "brownfield" (land that may have been contaminated) was recorded at or near this address. Have the soil analyzed before growing food. | A federal brownfield assessment or cleanup was recorded at or near this address. Test the soil before growing food. | Softened. The gloss looks only backward ("may have been contaminated"), so a reader can take it to mean the problem is over. Now "(un terreno donde puede haber contaminación)", in the present tense. |
| `layers.brownfields.description` | "Un brownfield es un terreno que pudo haber tenido contaminación." | A brownfield is land that may have been contaminated. | (no definition in English; the layer text says it does not say whether a site is contaminated today) | Same fix: "Un brownfield es un terreno donde puede haber contaminación." |
| `groups.rules.description` | "...sitios brownfield federales (terrenos que pudieron haber tenido contaminación)." | ...federal brownfield sites (land that may have been contaminated). | ...and federal brownfield sites. | Same fix: "(terrenos donde puede haber contaminación)". |
| `routes.ghost_bike_request.label` | "Pedir a la Bicycle Coalition una bicicleta blanca (ghost bike) o un memorial" | Ask the Bicycle Coalition for a ghost bike or a memorial | Ask the Bicycle Coalition about a ghost bike or memorial | Strengthened. A request for a memorial, when English only asks about one, and the next lines say it goes only with the family's blessing. Now "Preguntar a la Bicycle Coalition por una bicicleta blanca (ghost bike) o un memorial". |
| `dossier.flags.fast_resales.careful` | "...la propiedad se está negociando para ganar dinero, y a veces una escritura falsificada." | ...the property is being negotiated to make money, and sometimes a forged deed. | ...the property is being traded for profit, and sometimes a forged deed. | Changed. "Negociar" reads as bargaining, which blurs the warning about flipping. Now "se está comprando y vendiendo para ganar dinero". |

The glossary row and note for brownfield in `docs/i18n/glossary-es.md` were updated to the new
gloss, with the reason.

## Items with a small difference, kept

These are not word for word, but they keep the caution, so they were left as the translator wrote
them. The last column says whether a native speaker should look.

| Key or place | Spanish | Back translation | English | Why kept | Native speaker? |
|---|---|---|---|---|---|
| Conservatorship warning (four places) | "La administración judicial (conservatorship) puede quitarle una propiedad a su dueño..." | Judicial administration (conservatorship) can take a property away from its owner... | Conservatorship can take a property away from its owner... | The gloss keeps the English word so a neighbor can search for it. The three sentences are in order. | Yes: is "administración judicial" what Pennsylvania Spanish court materials call Act 135 conservatorship? |
| `dossier.rules.brownfield` | "Haga analizar el suelo" | Have the soil analyzed | Test the soil | Same meaning, a little stronger (a lab analysis). | No |
| `dossier.owner.parts.next` | "Un siguiente paso con cuidado" | A next step, taken with care | A careful next step | Same meaning. | No |
| `dossier.owner.flagTitles.possible_estate` | "Posible sucesión" | Possible estate (or succession) | Possible estate | A short title; the text under it says the owner "puede haber fallecido". | Yes: does "sucesión" alone read as an estate? |
| `redlining.grades.D` | "calificada como "peligrosa"" | graded "dangerous" | graded "hazardous" | A quotation of the 1937 grade, shown with the redlining context and the line that the grades say nothing about people today. The glossary bans "peligroso" for places in our own voice, not in a quotation. | Yes: "peligrosa" or "de alto riesgo" for HOLC "hazardous"? |
| `dossier.flags.years_since_sale.careful` | "no significa que el dueño haya abandonado la propiedad" | does not mean the owner has abandoned the property | does not mean the owner has given the property up | "Abandonar" is a slightly stronger word, but the sentence is a denial. | Yes: "abandonado" or "renunciado a"? |
| `dossier.flags.many_parcels.careful` | "Tener terrenos vacíos no es una falta por sí solo." | Having vacant land is not a fault or offense by itself. | Holding vacant land is not wrongdoing by itself. | Same meaning. | Yes: does "falta" read as an offense and not as "lack"? |
| `dossier.flags.absentee.careful` | "un familiar, un abogado o un administrador" | a relative, a lawyer or an administrator | a relative, a lawyer or a manager | Same meaning (a property manager). | No |
| How to do it, heading and "Who can help" row for the Neighborhood Gardens Trust | "Cómo conservar un jardín para siempre"; "Conservar los jardines comunitarios para siempre" | How to keep a garden for good; Keeping community gardens for good | Keeping a garden safe for good; Keeping community gardens safe for good | "Safe" is dropped; the text under it still says the Trust protects gardens from being sold. | No |
| Contact page, "Reportar una corrección" | adds "El formulario está en inglés, pero puede escribir en español." | The form is in English, but you can write in Spanish. | (not in English) | A helpful addition that changes no caution. | No |

## Not checked, and why

Main now holds English that the Spanish files do not have yet. It is outside this check, but the
orchestrator should know:

- 33 interface keys under `projects.*` in `es.ts`.
- 6 registry texts: `layers.projects` (label, description) and the names and publishers of the
  sources `project_reports` and `project_corrections`.
- A new English section on the How to do it page, "Tell us about a project you finished", and the
  same on the Contact page. `npm run i18n:status -- es` does not list them, because the page as a
  whole is translated, so a translator has to look for them.

The text of `languages.ts` was not part of this check.
