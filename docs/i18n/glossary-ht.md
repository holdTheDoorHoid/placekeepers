# Haitian Creole glossary (ht)

The words chosen for the Haitian Creole translation of Placekeepers, so the interface
(`web/src/i18n/locales/ht.ts`), the registry text (`registry/i18n/ht.yaml`) and the content pages
(`content/ht/`) say the same thing the same way. Spelling follows the Akademi Kreyol Ayisyen. The
reader is addressed as "ou". No dashes as punctuation, as in every language.

## Voice and rules of form

- Plain words a neighbor knows, short sentences, a respectful "ou". Imperative for buttons and steps
  ("Chwazi", "Montre", "Verifye").
- Contractions are written with a space and no apostrophe, as the Akademi spelling does: "m ap",
  "l ap", "ou ka wè l".
- Numbers and dates: the site formats them in the US style (Intl has no Haitian Creole), and months
  come from `months` in `languages.ts`. Ranges are written "2019 a 2024".
- Haitian Creole has one plural form, so every `plural()` call uses only `other`.
- Names of offices: the Creole words first, with the English name in parentheses where a neighbor may
  need it to find the office. Proper names stay as they are.

## Where phila.gov publishes a Haitian Creole name

The City translates its site into Haitian Creole under `phila.gov/ht/` (partly by machine). Names used
from there, checked 2026-10-21:

| English | Haitian Creole | Source page |
|---|---|---|
| Homestead Exemption | Egzanpsyon Homestead | services page "Jwenn Egzanpsyon Homestead la" |
| Homestead Hotline | Liy Dirèk Homestead la | same page |
| Department of Revenue | Depatman Revni | same page |
| Philadelphia Tax Center | Sant Taks Filadèlfi (Philadelphia Tax Center) | same page |
| Longtime Owner Occupants Program (LOOP) | Pwogram Okipan yo Pwopriyetè Longtime (LOOP) | LOOP page |
| Office of Property Assessment | Biwo Pwopriyete Evalyasyon (OPA) | OPA department page |
| Department of Licenses and Inspections | Depatman Lisans ak Enspeksyon (L&I) | L&I department page |
| City Council | Konsèy Minisipal | Land Bank department page |
| Department of Records | Depatman Dosye | City Creole pages, as read in a search result |

Two City translations were not used because they are machine errors: the Land Bank page calls the
Philadelphia Land Bank "Philadelphia peyi Bank" ("peyi" means country), so the name stays
"Philadelphia Land Bank"; and the Homestead page writes "Depatman sou revni Ameriken" in a mailing
address, so the name stays "Depatman Revni". No Creole page was found for Fraud Guard, the Tangled
Title Fund, Philly311, SEPTA or the Land Bank's programs, so those stay as proper names.

## Key terms

| English | Haitian Creole | Notes |
|---|---|---|
| map | kat | "fich" is used for a card in the interface, so "kat" is only the map |
| neighbor, neighbors | vwazen | |
| block (a city block) | blòk | |
| neighborhood | katye | |
| vacant lot | teren vid | "teren" for a lot or land |
| vacant building | bilding vid | |
| vacant parcel, parcel | pasèl vid, pasèl | |
| owner | pwopriyetè | "owner of record" is "pwopriyetè ki nan dosye a" |
| the City | Vil la | always "Vil la"; the City of Philadelphia is "Vil Filadèlfi" |
| land agencies (City) | ajans tè Vil la | |
| Land Bank | Land Bank | proper name kept; "Philadelphia Land Bank" |
| Redevelopment Authority | Otorite Redevlopman | with the English name in parentheses the first time in a string |
| housing authority | otorite lojman | |
| nonprofit | òganizasyon san bi likratif | |
| lens (the map's way of weighing places) | lantiy | "lantiy rediksyon vyolans", "lantiy chalè ak lonbraj", "lantiy kreyasyon kote", "lantiy sekirite ri", "lantiy konfò transpò" |
| layer | kouch | |
| setting | paramèt | |
| view (Field view, Analysis view) | afichaj | "Afichaj nan ri", "Afichaj analiz" |
| filter | filtè | |
| score | nòt | |
| priority | priyorite | |
| weight (of a factor) | pwa | |
| factor | faktè | |
| preset | chwa ki pare | |
| saved list | lis ki sere | |
| legal route | wout legal | "first legal step" is "premye etap legal" |
| side yard | lakou sou kote | "rear yard" is "lakou dèyè" |
| garden agreement | akò jaden | |
| displacement | deplasman | explained where it first appears: prices rise and longtime residents may be pushed out |
| displacement watch | veye deplasman | the area is "zòn pou veye deplasman"; the title is "Veye deplasman" |
| signs that prices are rising | siy ki montre pri yo ap monte | |
| greening | amenajman vèt | planting and tending a lot |
| placemaking | kreyasyon kote | |
| conservatorship | konsèvatè pa tribinal (conservatorship) | the process; "konsèvatè" alone is the person the court names; Act 135 stays "Act 135" |
| possible estate | posib sikseswon | the possible estate passage itself never says the owner died |
| tangled title | tit ki mele | the Tangled Title Fund keeps its English name |
| deed | akt | "deed theft" is "vòl akt", "deed fraud" is "fwod sou akt" |
| sheriff sale | vant pa sherif | |
| tax debt | dèt taks | |
| tax bill | bòdwo taks | |
| assessment, assessed value | evalyasyon, valè evalye | |
| Registered Community Organization | Òganizasyon Kominotè Anrejistre (RCO) | |
| zoning, overlay | zonaj, zonaj siperpoze (overlay) | |
| brownfield | brownfield (sit ki ka kontamine) | kept in English, explained once in the soil note |
| historic district | distri istorik | |
| hearing, appeal | odyans, apèl | |
| board (City board) | komisyon | "Zoning Board of Adjustment" is given as "Komisyon Ajisteman Zonaj (Zoning Board of Adjustment)" |
| memorial | memoryal | |
| traffic crash | aksidan sikilasyon | |
| traffic calming | ralanti trafik | speed cushion, hump, table is "kousen vitès, dòdàn, tab vitès" |
| crossing guard | gad travèse lekòl | |
| bus stop, shelter, bench | estasyon bis, abri, ban | a transit "route" is "liy"; a road lane is "bann" |
| ghost bike | "ghost bike" | kept in English in quotes, explained as a bicycle painted white |
| survey (a stop) | verifye | "survey sheet" is "fèy verifikasyon" |
| hexagon | egzagòn | |
| census tract | sektè resansman | |
| middle (median) price, rent, income | pri mitan, lwaye mitan, revni mitan | |
| renter | lokatè | |
| tree canopy | kouvèti pyebwa | |
| floodplain | plenn inondasyon | |
| warming or cooling site | sit pou chofe oswa pou rafrechi | |
| live City data | done an dirèk nan Vil la | the setting is "Rekipere done an dirèk nan Vil la" |
| Then and now | Avan ak kounye a | |
| Privacy and live data | Vi prive ak done an dirèk | |
| weekly copy (snapshot) | kopi chak semèn | |
| not yet surveyed | poko verifye | never worded as "missing" |
| not yet confirmed | poko konfime | |

## The word for word passages (docs/ETHICS.md)

Each is one fixed unit. The same Haitian Creole text is used wherever the English repeats it
(the lot page, the legal route, the Use this responsibly page, How to do it).

- **Possible estate** (`dossier.flags.possible_estate.text`, `.careful`, `.next`): "Li posib pwopriyetè
  ki nan dosye a te mouri. Manm fanmi yo ka toujou gen yon dwa sou pwopriyete sa a epi yo ka pa konnen
  sa. Si ou konnen fanmi an, Tangled Title Fund (jiska $6,500 an èd jiridik) ak Philadelphia VIP ka
  ede yo kenbe l. Fanmi yo ka enskri tou nan alèt Fraud Guard gratis Vil la."
- **Conservatorship warning** (`dossier.actions.conservatorshipWarning`, registry
  `routes.conservatorship.warning`): "Pwosedi konsèvatè pa tribinal (conservatorship) ka retire yon
  pwopriyete nan men pwopriyetè li. Chèchè yo jwenn yo itilize l anpil plis nan katye ki ap fè fas ak
  jantrifikasyon (lè pri yo monte nan yon katye) pase nan lòt kote. Pale ak Garden Justice Legal
  Initiative anvan ou konsidere l."
- **Deed fraud notice** (`dossier.owner.deedFraud`): "Vòl akt rive lè yon moun depoze yon fo akt pou
  pran yon pwopriyete, souvan yon pwopriyete ki gen yon pwopriyetè ki mouri oswa ki rete yon lòt kote.
  Pwopriyetè ak fanmi yo ka enskri nan alèt Fraud Guard gratis Vil la, ki voye yon imèl lè yo
  anrejistre yon dokiman ki gen non yo ladan l. Depi novanm 2025 Vil la bloke otomatikman tou akt kote
  vandè a te deja mouri lè yo sipoze te siyen yo."
- **Displacement caution, greening** (`displacement.caution`): "Amenajman vèt ka fè pri yo monte
  toupre. Panse pou ou mete pwoteksyon ansanm ak li."
- **Displacement caution, gardens, seating and art** (`displacement.placemakingCaution`): "Nouvo
  jaden, plas pou chita ak atizay ka fè plis moun vle vin sou yon blòk, epi fè pri ak lwaye toupre yo
  monte. Mete pwoteksyon ansanm ak yo pou vwazen ki lokatè oswa ki an reta nan peman taks yo."
- **Brownfield soil note** (`dossier.rules.brownfield`): "Yon evalyasyon oswa yon netwayaj brownfield
  federal (sit ki ka kontamine) te anrejistre nan oswa toupre adrès sa a. Teste tè a anvan ou plante
  manje." It never says "clean" or "safe" about the soil. The parenthesis explaining "brownfield" is
  added to the English, and carries no claim.

## Left in English on purpose

Proper names (Placekeepers, Philly311, LandCare, SEPTA, Fraud Guard, Tangled Title Fund, Clean & Green
Philly, OpenStreetMap, StreetComplete), the memorial removal email subject and body, web addresses,
the `credits.basemap` HTML, and the CSV file name template `landBank.csv.file`. In the step by step
instructions for OpenStreetMap's editor and for StreetComplete, the app's own button names are kept in
English with the Creole meaning beside them, since a phone or the editor may show them in English.
