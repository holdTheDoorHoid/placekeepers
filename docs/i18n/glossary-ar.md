# Arabic glossary (ar)

Key terms for the Arabic translation of Placekeepers, so the interface catalog
(`web/src/i18n/locales/ar.ts`), the registry text (`registry/i18n/ar.yaml`) and the content pages
(`content/ar/`) all use the same word for the same thing. Plain Modern Standard Arabic, polite and
simple, readable by speakers of any dialect.

## Style decisions

- **Address.** The reader is addressed in the masculine singular imperative (اختر، افتح، اضغط),
  the usual convention for interface text, meant for everyone. No gendered second person verbs
  are used in sentences that describe what "you" did, so the text reads the same for anyone.
- **Numbers and punctuation.** Western digits, as the site formats them. Arabic punctuation
  (، ؛ ؟). No dashes as punctuation and no tatweel (the stretching letter) before a Latin name:
  a prefix such as بـ or لـ is never attached to a name in Latin letters, the sentence is
  rephrased instead. Quotation marks are straight double quotes, as in the English.
- **Counted nouns** follow Arabic number rules through `plural()`: a number word for one and two
  (مكان واحد، مكانان), a plural for 3 to 10 (3 أماكن), a singular accusative for 11 to 99
  (11 مكانًا) and a singular for 100 and more (100 مكان). The counted nouns live in constants at
  the top of `ar.ts`.
- **Proper names stay in Latin letters:** Placekeepers, Philly311, LandCare, PHS LandCare,
  Community LandCare, SEPTA, Fraud Guard, Tangled Title Fund, Philadelphia VIP, Garden Justice
  Legal Initiative, Neighborhood Gardens Trust, Land Bank, Philadelphia Land Bank, PHDC, OTIS,
  PECO, PennDOT, FEMA, EPA, StreetComplete, OpenStreetMap, GitHub, Mural Arts, TreePhilly,
  Bicycle Coalition, Families for Safe Streets, Feet First Philly, Grounded in Philly, Clean &
  Green Philly, Code for Philly. A program or board whose English name a visitor will meet on
  City pages keeps it in parentheses after the Arabic, for example "اتفاقية الحديقة الحضرية
  (Urban Garden Agreement)" and "مجلس تعديلات تقسيم المناطق (Zoning Board of Adjustment)".
- **"Land Bank"** stays Latin everywhere. phila.gov's Arabic page for it (machine translated)
  writes "بنك فيلادلفيا لاند", a transliteration that is not adopted: a visitor looks for the
  English name on signs and on City sites.
- **App labels** that StreetComplete and the OpenStreetMap editor show (Things, Create new note,
  Yes, No, Uh…, Shelter, Save, Upload) stay in English where a page tells the reader which button
  to press, with a note that the app may show them in Arabic on an Arabic phone.

## Names the City publishes in Arabic (phila.gov/ar, checked 2026-10-21)

| English | Arabic used | Where seen |
|---|---|---|
| Department of Licenses and Inspections (L&I) | إدارة التراخيص والتفتيش (L&I) | phila.gov/ar L&I page. In short interface text, "L&I" alone. |
| Office of Property Assessment (OPA) | مكتب تقييم الممتلكات | phila.gov/ar OPA page |
| Department of Records | قسم السجلات | phila.gov/ar Department of Records page (title and heading) |
| Homestead Exemption | إعفاء Homestead | the City keeps "Homestead" in Latin letters on its Arabic pages |
| Register of Wills | سجل الوصايا | phila.gov/ar |
| Sheriff | الشريف | phila.gov/ar |
| zoning permits | تصاريح تقسيم المناطق | phila.gov/ar L&I page |
| assessed value | القيمة المقدّرة | phila.gov/ar OPA page |
| Philadelphia Tax Center | مركز ضرائب فيلادلفيا | phila.gov/ar |
| real estate tax | ضريبة العقارات | phila.gov/ar |
| City Council | مجلس المدينة | phila.gov/ar |
| Department of Sanitation | قسم الصرف الصحي | phila.gov/ar page heading (the browser title says إدارة الصرف الصحي). Kept as the City writes it, with the English name beside it where a neighbor reads it, because الصرف الصحي can also mean sewage, and this department collects trash. A native speaker may prefer النظافة. |
| Philadelphia More Beautiful Committee | لجنة فيلادلفيا المزيد من الجمال | phila.gov/ar |
| block captain | the City writes كابتن بلوك or قائد للبلوك; this translation keeps قائد مقطع (Block Captain) |

Not found on phila.gov in Arabic (the translator's own rendering, kept the same everywhere):
Parks and Recreation = إدارة الحدائق والترفيه; Streets Department = إدارة الشوارع; Water
Department = إدارة المياه; Department of Planning and Development = إدارة التخطيط والتنمية;
City Planning Commission = لجنة التخطيط العمراني; Office of Transportation and Infrastructure
Systems = مكتب النقل ونظم البنية التحتية (OTIS); Historical Commission = لجنة الآثار
التاريخية; Office of Emergency Management = مكتب إدارة الطوارئ; Division of Safe Neighborhoods
= إدارة الأحياء الآمنة; Redevelopment Authority = هيئة إعادة التطوير; Housing Authority = هيئة
الإسكان; Art Commission = لجنة الفنون.

The City's Arabic pages write "deed" as "سند". This translation writes **صك (الملكية)** for a
deed and keeps **سند ملكية** for a title (a tangled title is "سند ملكية متشابك"), so the two
words stay apart; both are plain Modern Standard Arabic.

## Key terms

| English | Arabic |
|---|---|
| vacant lot | قطعة أرض فارغة (قطع أرض فارغة) |
| vacant land | أرض فارغة |
| vacant building | مبنى فارغ |
| vacant parcel | قطعة فارغة |
| lot page | صفحة القطعة |
| ward, division | المنطقة الانتخابية، القسم (committee people: أعضاء لجنة الحزب) |
| packet | حزمة |
| flyer | ملصق (the sign for a lot's fence is also called لافتة) |
| letter (the printable letters) | خطاب (خطابات), never رسالة, so the interface and the pages agree |
| project neighbors finished | مشروع أنهاه الجيران (مشاريع أنهاها الجيران) |
| parcel | القطعة |
| place | مكان (أماكن) |
| neighbor, neighborhood | جار (جيران)، حي |
| block (a stretch of street) | مقطع شارع (مقاطع شوارع) |
| in view (on the map) | ظاهر على الخريطة |
| map, layer, legend | الخريطة، طبقة (طبقات)، مفتاح الخريطة |
| setting | إعداد (إعدادات) |
| filter | عامل تصفية (عوامل التصفية) |
| lens | عدسة (عدسات) |
| lens blend | مزيج العدسات |
| factor, weight, score | عامل (عوامل)، وزن، درجة |
| priority | أولوية |
| ranked list | قائمة مرتّبة |
| field view, analysis view | العرض الميداني، عرض التحليل |
| organizer | منظِّم (المنظِّمون) |
| first legal step | أول خطوة قانونية |
| legal route, lawful route | مسار قانوني (المسارات القانونية) |
| permission | إذن |
| suggestion | اقتراح (الاقتراحات) |
| evidence badge | شارة الأدلة: قوية، متوسطة، متباينة، ضعيفة، لا يتعلق بالعنف، سياق |
| displacement | التهجير السكني (people pushed out of their homes by rising prices) |
| displacement watch | رصد التهجير السكني |
| displacement watch area | منطقة رصد التهجير السكني |
| sign (of rising prices) | مؤشر |
| gentrification | تغيّر سكاني بفعل ارتفاع الأسعار (gentrification) |
| greening | التخضير |
| placemaking | تهيئة الأماكن |
| community garden | حديقة مجتمعية |
| memorial (for a person killed) | نصب تذكاري (نُصُب تذكارية) |
| public memorial list, public memorial | قائمة تأبين عامة، التأبين العام |
| crash | حادث |
| High Injury Network | شبكة الشوارع الأكثر إصابات |
| killed or seriously injured | قُتل أو أُصيب إصابة جسيمة |
| people shot | من تعرّضوا لإطلاق نار |
| bus stop | موقف حافلة (مواقف الحافلات) |
| transit | النقل العام |
| shelter (at a stop) | مظلة |
| route (bus) | خط |
| owner, owner of record | مالك، المالك المسجّل |
| owner flag | إشارة المالك |
| possible estate | تركة محتملة |
| deed | صك الملكية |
| deed theft, deed fraud | سرقة صكوك الملكية، الاحتيال على الصكوك |
| tangled title | سند ملكية متشابك |
| conservatorship | الحراسة القضائية |
| adverse possession | التملك بالتقادم |
| side yard | الفناء الجانبي |
| Registered Community Organization (RCO) | المنظمة المجتمعية المسجّلة |
| census tract | منطقة التعداد |
| block group | مجموعة كتل التعداد |
| Census Bureau | مكتب الإحصاء الأمريكي |
| assessor | مُقدِّر العقارات |
| violation | مخالفة |
| permit | تصريح |
| appeal | طعن |
| hearing | جلسة استماع |
| zoning, overlay | تقسيم المناطق، نطاق إضافي |
| brownfield | براونفيلد (أرض يُحتمل تلوثها) |
| sheriff sale | بيع الشريف |
| redlining | الخط الأحمر (redlining) |
| 311 report | بلاغ إلى 311 |
| GitHub issue | بلاغ على GitHub |
| care (as in "where care is needed") | عناية |

Lens names: violence reduction = خفض العنف; heat and shade = الحرارة والظل; placemaking =
تهيئة الأماكن; street safety = سلامة الشوارع; transit comfort = راحة النقل العام. A lens is
always named "عدسة" plus its name (عدسة خفض العنف).

Never softened: the brownfield note says "أعمال تنظيف" (cleanup work) and "أرض يُحتمل تلوثها"
(land that may be contaminated), never "نظيفة" or "آمنة"; the possible estate passage says "قد
يكون المالك المسجّل قد توفي" (may have died), never that the owner died.

## The "Did it work?" page (M5.4)

| English | Arabic | Notes |
|---|---|---|
| Did it work? | هل نجح هذا؟ | the menu item and the page title |
| care (done to a place: cleaned, greened, sealed, demolished) | عناية | "places that got care" is "الأماكن التي حظيت بالعناية"; "after care" is "بعد العناية بالأماكن" |
| comparison, comparison places | مقارنة (مقارنات)، أماكن المقارنة | counted with `COMPARISON` in `ar.ts` |
| verdict labels | "أقل بعد العناية بالأماكن"، "أكثر بعد العناية بالأماكن"، "لا يوجد تغيّر واضح"، "لم نستطع معرفة ذلك"، "أقل من أن يكفي للحكم" | "We could not tell" stays a plain admission, never "لا أثر" (no effect) |
| "This does not show that care caused them." | "هذا لا يُظهر أن العناية هي التي تسببت في ذلك." | kept on every "more afterwards" verdict |
| the real evidence | الأدلة الحقيقية | the randomized trials (التجارب العشوائية); a comparison of records "can mislead" is "قد تضلّل" |
| 90 percent interval | فاصل الثقة 90 في المئة | a change in words: "أكثر بنسبة 3.2%", "أقل بنسبة 6.2%", "دون تغيير"; a range is "من أقل بنسبة 6.2% إلى أكثر بنسبة 0.2%" |
| the count of shootings, dumping reports, complaints | عدد حالات إطلاق النار، عدد البلاغات عن إلقاء النفايات بصورة غير قانونية، عدد الشكاوى بشأن العقارات الفارغة | each noun phrase is definite so "عدد" can come before it |
| a half year | نصف سنة | "النصف الأول من 2017", "النصف الثاني من 2024" |
| area of the city (a cell of about 5 square kilometers) | منطقة (مناطق) | counted with `AREA`; the census tract stays "منطقة التعداد" |
| the check (placebo) | الفحص (الفحوص) | "نجح الفحص" and "فشل الفحص" |
| maintainer (of the project) | القائم على المشروع | |

## Back translation check (2026-10-21)

No glossary choice above was changed. Two phrases were fixed so the safety wording matches the
English, and the glossary keeps them for the next pass:

- "We are not very sure it is vacant" is لسنا متأكدين كثيرًا من أنها فارغة, never "تمامًا", which
  reads as nearly sure.
- "Look up before you cross" is ارفع نظرك قبل أن تعبر.

Terms a native speaker should look at (التهجير السكني, الحراسة القضائية, مباركة العائلة, بيع الشريف)
are listed in `docs/i18n/check-ar.md`.
