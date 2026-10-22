# Back translation check: Brazilian Portuguese (pt-BR)

Checked 2026-10-21 on branch `agent/tr-pt-BR` (after merging `main`), against the English in
`web/src/strings.ts`, `registry/*.yaml`, `content/*.md` and `docs/ETHICS.md`. This is Part B of
issue #49.

## How it was done

For each item the pt-BR text was read first and put back into English from the Portuguese alone.
Only then was the English source opened and the two compared. Each item was classed as same
meaning, softened, strengthened, changed, or a wrong fact (number, phone, address, date, dollar
amount, office name).

Two scripted checks ran on top of the reading, over every key and page, not only the safety ones:
every number, web address, email address and phone number in the English was matched against the
Portuguese, and every legal route was matched step for step against its English (same number of
steps, same links, same numbers). No wrong fact turned up.

## What was checked

| Group | Items checked |
|---|---|
| 1. The six ETHICS word for word passages, in every place each one appears | 14 places (6 passages) |
| 2. Legal routes in `registry/i18n/pt-BR.yaml` (`routes:`) | 24 routes, 201 items (label, who, warning, cost, timeline, each step, each link label) |
| 3. Safety and caution wording | about 880 items (see below) |

Group 1 places: possible estate (3 catalog keys and the quote on Use this responsibly),
conservatorship warning (catalog, registry route, Use this responsibly, How to do it), deed fraud
notice (catalog), both displacement cautions (catalog and Use this responsibly, each), brownfield
soil note (catalog). Every copy of a passage is the identical text: the registry warning equals the
catalog warning, and the quotes on the pages equal the catalog.

Group 3 breakdown:

- Interface text, 566 keys: owner flags (`dossier.flags.*`, with their careful and next lines),
  `dossier.actions.*`, `dossier.owner.*`, `dossier.listing.*`, `dossier.rules.*`, `dossier.summary.*`,
  unsafe and imminently dangerous wording (flags, history, reasons, timeline), the history notes,
  all of `displacement.*`, `reasons.*`, `redlining.*`, memorial wording (`streets.*`, `legend.*`,
  `art.*`, removal text), survey safety tips and the survey notes, not legal advice and terms lines,
  Land Bank and deed price notes, privacy lines, flood, brownfield and "not live" cautions.
- Registry suggestions, 57 items (19 suggestions: label, summary, cost), plus the descriptions of
  the shootings, memorials, brownfield, redlining and displacement watch layers and the violence
  lens factors.
- Content pages, 251 blocks and list items: Terms (10), Privacy (9), Use this responsibly (38),
  How to do it (69), About (15), Why this works (27), Survey bus stops (58), How we find vacant
  land (17), Contact (8).

All 1,821 catalog keys and all of the registry file were also read once for anything odd.

## Result

Two changes of meaning were found and fixed. Everything else in the three groups has the same
meaning as the English. The table lists every item that was not plainly "same meaning", including
glosses the translator added, which were kept.

| Key or place | pt-BR text | Back translation | English | Class | What I changed |
|---|---|---|---|---|---|
| `dossier.flags.unsafe.careful` (`web/src/i18n/locales/pt-BR.ts`) | "Fique longe e mantenha as crianças longe: o L&I considerou a estrutura insegura. Não entre nela nem tente fechá-la por conta própria." | "Stay away and keep children away: L&I found the structure unsafe. Do not enter it or try to close it yourself." | "Keep out and keep children away: L&I found the structure unsafe. Do not enter it or try to secure it yourself." | Changed (narrowed): "fechá-la" means shutting it, while "secure" means blocking, locking or boarding it up | Now "...nem tente vedar o acesso a ela por conta própria." (back translation: "nor try to block access to it yourself") |
| `content/pt-BR/why.md`, paragraph "As árvores também têm o selo Mista para o calor" | "Um estudo que mediu o ar de bicicleta em uma cidade inteira..." | "A study that measured the bicycle air across a whole city..." (unclear) | "A study that measured the air from a bicycle across a whole city..." | Changed (garbled): reads as "bicycle air", not as measuring while riding | Now "Um estudo que mediu o ar pedalando por uma cidade inteira..." |
| `dossier.rules.brownfield` | "Foi registrada uma avaliação ou limpeza federal de brownfield (terreno que pode ter contaminação) neste endereço ou perto dele. Teste o solo antes de plantar alimentos." | "A federal brownfield assessment or cleanup (land that may have contamination) was recorded at or near this address. Test the soil before growing food." | "A federal brownfield assessment or cleanup was recorded at or near this address. Test the soil before growing food." | Strengthened by a gloss the translator added; the sentence never says clean or safe | Kept. Nothing changed. |
| `dossier.actions.conservatorshipWarning`, `routes.conservatorship.warning`, Use this responsibly, How to do it | "A administração judicial (conservatorship) pode tirar um imóvel do seu proprietário. ... antes de considerá-la." | "Court administration (conservatorship) can take a property away from its owner. Researchers found it is used disproportionately in neighborhoods facing gentrification. Talk to the Garden Justice Legal Initiative before you consider it." | "Conservatorship can take a property away from its owner. Researchers found it is used disproportionately in neighborhoods facing gentrification. Talk to the Garden Justice Legal Initiative before you consider it." | Same meaning, with the English term kept in parentheses (glossary choice) | Kept. See the first question below. |
| `dossier.flags.unsafe.careful` | "Fique longe..." | "Stay away..." | "Keep out..." | Strengthened slightly (stay away from it, not only keep out) | Kept, it keeps the caution. |
| `dossier.flags.absentee.next` | "Escreva ao proprietário neste endereço para pedir permissão antes de fazer qualquer coisa no imóvel..." | "Write to the owner at this address to ask permission before doing anything on the property..." | "Write to the owner at this address to ask before you do anything on the property..." | Strengthened slightly ("ask permission" for "ask") | Kept, it keeps the protective step. |
| `content/pt-BR/contact.md`, "Informar uma correção" | Adds "O formulário está em inglês, mas você pode escrever em português." | "The form is in English, but you can write in Portuguese." | (no such sentence) | Added, true and helpful | Kept. |
| `content/pt-BR/how.md`, "Lotes da Prefeitura ou do Land Bank" | Adds "(A página da Prefeitura em português chama o Land Bank de 'Banco de terras da Filadélfia'.)" | The City's Portuguese page calls the Land Bank "Banco de terras da Filadélfia." | (no such sentence) | Added gloss, true (the glossary says it is given once in the long pages) | Kept. |
| `content/pt-BR/how.md` and `content/pt-BR/contact.md` | No section "Tell us about a project you finished" | not applicable | New section "Tell us about a project you finished" in both English pages | Missing: `main` added this English after the translation was written | Not translated here. The pages show the rest in Portuguese and this part is absent. A translator should add it. |
| `web/src/i18n/locales/pt-BR.ts`, the `projects.*` keys (33 of them) | No translation | not applicable | New `projects.*` strings, including `projects.privacy`, `projects.tellUsNote` | Missing: added to English by `main` after the translation | Not translated here. They show in English, marked for screen readers, until a translator adds them. The privacy and consent wording in them has not been back translated. |

## Things a native speaker should look at

1. "administração judicial" for conservatorship. In Brazil the phrase is mostly used for the
   administrator in a bankruptcy. The English word stays beside it in parentheses and the sentence
   says what it does (can take a property from its owner), so the warning still works, but a native
   reader may know a plainer phrase.
2. "leilão do xerife" is a literal rendering of sheriff sale. Every use explains it (sold to pay a
   debt, the winner gets the property free of old debts), but "leilão judicial (sheriff sale)" may
   read more naturally.
3. "usucapião" for adverse possession: the idea is close, but Brazilian usucapião has its own rules.
   The text always says a lawsuit and a lawyer are needed, so nothing promises an outcome.
4. "irregularidade" for "wrongdoing" in `dossier.flags.many_parcels.careful` ("Possuir terrenos
   vazios não é, por si só, uma irregularidade"). The direction is right, the strength of the
   word is a judgment call.
5. "ceder" for "fail" in `dossier.flags.imminently_dangerous.careful` ("pode ceder a qualquer
   momento"): taken to mean give way or collapse, which is the intended danger.
6. "ponto crítico" for "hot spot" on Use this responsibly. It could read as "a critical point".
   The sentence is about words the site never uses, so a stronger or weaker choice does not change
   the rule.
7. The new phrase "vedar o acesso a ela" in the unsafe building warning, and "mediu o ar pedalando"
   on Why this works, were written by the checker, not the translator.
8. "o vereador do distrito ... o gabinete dele" uses the masculine for any council member,
   as Portuguese often does.

## Glossary

No glossary choice caused a meaning error, so `docs/i18n/glossary-pt-BR.md` is unchanged.
