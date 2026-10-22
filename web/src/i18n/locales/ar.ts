// Arabic, written right to left (ar): the interface text of web/src/strings.ts, key for key.
//
// Plain Modern Standard Arabic, polite and simple, readable by speakers of any dialect. Western
// digits as the English uses them, Arabic punctuation, no dashes as punctuation, and proper names
// as they are (Placekeepers, Philly311, LandCare, SEPTA, Land Bank). The page handles direction:
// no direction marks here. Key terms are fixed in docs/i18n/glossary-ar.md; keep to them.
//
// How to translate, and how to check the result, is in docs/TRANSLATING.md.

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';

/**
 * The forms of a counted noun: one (with its own "one"), two (the dual), 3 to 10 (plural), 11 to 99
 * (singular, accusative) and 100 and more (singular). `count` writes the number before them.
 */
interface Nouns {
  one: string;
  two: string;
  few: string;
  many: string;
  other: string;
}

function count(n: number, w: Nouns): string {
  return plural(n, { zero: `# ${w.few}`, one: w.one, two: w.two, few: `# ${w.few}`, many: `# ${w.many}`, other: `# ${w.other}` });
}

const PLACE: Nouns = { one: 'مكان واحد', two: 'مكانان', few: 'أماكن', many: 'مكانًا', other: 'مكان' };
const LOT: Nouns = { one: 'قطعة أرض فارغة واحدة', two: 'قطعتا أرض فارغتان', few: 'قطع أرض فارغة', many: 'قطعة أرض فارغة', other: 'قطعة أرض فارغة' };
const BUILDING: Nouns = { one: 'مبنى فارغ واحد', two: 'مبنيان فارغان', few: 'مبانٍ فارغة', many: 'مبنًى فارغًا', other: 'مبنى فارغ' };
const FOOT: Nouns = { one: 'قدم واحدة', two: 'قدمان', few: 'أقدام', many: 'قدمًا', other: 'قدم' };
const HOME: Nouns = { one: 'منزل واحد', two: 'منزلان', few: 'منازل', many: 'منزلًا', other: 'منزل' };
const PERSON: Nouns = { one: 'شخص واحد', two: 'شخصان', few: 'أشخاص', many: 'شخصًا', other: 'شخص' };
const MEMORIAL: Nouns = { one: 'نصب تذكاري واحد', two: 'نصبان تذكاريان', few: 'نُصُب تذكارية', many: 'نصبًا تذكاريًا', other: 'نصب تذكاري' };
const BLOCK: Nouns = { one: 'مقطع شارع واحد', two: 'مقطعا شارع', few: 'مقاطع شوارع', many: 'مقطع شارع', other: 'مقطع شارع' };
const CRASH: Nouns = { one: 'حادث واحد', two: 'حادثان', few: 'حوادث', many: 'حادثًا', other: 'حادث' };
const SHELTER: Nouns = { one: 'مظلة واحدة', two: 'مظلتان', few: 'مظلات', many: 'مظلة', other: 'مظلة' };
const POINT: Nouns = { one: 'نقطة واحدة', two: 'نقطتان', few: 'نقاط', many: 'نقطة', other: 'نقطة' };
const GROUP: Nouns = { one: 'مجموعة كتل واحدة', two: 'مجموعتا كتل', few: 'مجموعات كتل', many: 'مجموعة كتل', other: 'مجموعة كتل' };

/** A change in percent in words: "up 61%", "down 3%", "unchanged" (strings.ts, changeWords). */
function changeWords(n: number): string {
  if (n > 0) return `ارتفاع بنسبة ${formatNumber(n)}%`;
  if (n < 0) return `انخفاض بنسبة ${formatNumber(-n)}%`;
  return 'دون تغيير';
}

/** " (give or take 6 points)", or nothing when there is no margin (strings.ts, giveOrTake). */
function giveOrTake(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return ` (بزيادة أو نقصان نحو ${unit === 'points' ? count(margin, POINT) : formatNumber(margin)})`;
}

const ar: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: 'خريطة مجانية لجيران فيلادلفيا الذين يعتنون بشوارع حيّهم.',
    mapLabel: 'خريطة فيلادلفيا. قوائم الأماكن والنُّصُب التذكارية في هذه الصفحة تعرض الأشياء نفسها في صورة نص.',
    loadingMap: 'جارٍ تحميل الخريطة',
    mapFailed: 'تعذّر تشغيل الخريطة في هذا المتصفح. جرّب متصفحًا آخر، أو حدّث هذا المتصفح.',
    sampleData: 'بيانات تجريبية للاختبار. هذه ليست أماكن حقيقية.',
    earlyPreview: 'الإصدار 0.4: نسخة عامة أولى. تأكد من المعلومات لدى المدينة قبل أن تتخذ أي إجراء.',
    followAlong: 'تابع المشروع',
    skipToList: 'انتقل إلى قائمة الأماكن',
    hideNote: 'إخفاء',
    hideNoteLabel: 'إخفاء هذه الملاحظة',
    close: 'إغلاق',
    notAffiliated: 'غير تابع لمدينة فيلادلفيا ولا لهيئة SEPTA. ليس مشورة قانونية.',
    licenses: 'الشيفرة البرمجية: GPL-3.0. البيانات: لكل مصدر ترخيصه الخاص. النصوص: Creative Commons BY-SA 4.0.',
  },

  content: {
    tableLabel: 'جدول، يمكن تمريره جانبيًا',
    removalEmail: (email) =>
      `راسلنا على [${email}](mailto:${email}). لا نستخدم نموذجًا عامًا لهذا الغرض، لأن طلب الإزالة أمر شخصي وخاص.`,
    removalComingSoon: (issueUrl) =>
      `سيتوفر قريبًا عنوان بريد إلكتروني خاص بهذه الطلبات. وإلى أن يتوفر، لا تعرض الخريطة أي أسماء على الإطلاق، ويمكنك أن تطلب ذلك في [بلاغ على GitHub](${issueUrl}). يستطيع أي شخص قراءة أي بلاغ على GitHub، لذا اكتب فقط رقم النصب التذكاري أو مكانه: لا يلزمك أن تذكر اسمًا أو سببًا أو من أنت.`,
  },

  language: {
    button: 'اللغة',
    buttonLabel: (name) => `اللغة: ${name}. اختر لغة أخرى`,
    title: 'اللغة',
    intro: 'اختر لغة هذا الموقع. تُفتح الصفحة من جديد بهذه اللغة، ويتذكّر هذا المتصفح اختيارك.',
    inUse: 'قيد الاستخدام',
    notReady: 'الترجمة قيد الإعداد',
    listLabel: 'اللغات',
    aiNote: 'تمت الترجمة بمساعدة الذكاء الاصطناعي، ولم يراجعها بعد متحدث أصلي للعربية.',
    fixLink: 'صحّح ترجمة',
    pageInEnglish: 'لم تُترجم هذه الصفحة بعد، لذلك تظهر بالإنجليزية.',
    offerLabel: 'عرض اللغة',
  },

  units: {
    meters: (n) => count(n, { one: 'متر واحد', two: 'مترين', few: 'أمتار', many: 'مترًا', other: 'متر' }),
    kilometers: (km) => `${formatDecimal(km, 1)} كيلومتر`,
  },

  header: {
    settings: 'الإعدادات',
    share: 'نسخ الرابط',
    shareDone: 'تم نسخ الرابط. كل من يفتحه سيرى هذه الخريطة نفسها.',
    shareDoneNoMap: 'تم نسخ الرابط. لا يتضمن موضع الخريطة، لأن الخريطة تعرض الآن مكانك أنت.',
    shareFailed: 'تعذّر نسخ الرابط. انسخ العنوان من متصفحك بدلًا من ذلك.',
    dataStatus: 'حالة البيانات',
  },

  nav: {
    menu: 'القائمة',
    menuTitle: 'قائمة الموقع',
    menuLabel: 'صفحات الموقع',
    map: 'الخريطة',
    landBank: 'Land Bank بالأرقام',
    pages: [
      { slug: 'about', label: 'عن المشروع' },
      { slug: 'why', label: 'لماذا ينجح هذا' },
      { slug: 'how', label: 'كيف تفعل ذلك' },
      { slug: 'responsibly', label: 'استخدمه بمسؤولية' },
      { slug: 'vacant-land', label: 'كيف نجد الأراضي الفارغة' },
      { slug: 'streetcomplete', label: 'مسح مواقف الحافلات' },
      { slug: 'terms', label: 'الشروط' },
      { slug: 'privacy', label: 'الخصوصية' },
      { slug: 'contact', label: 'اتصل بنا' },
    ],
  },

  views: {
    groupLabel: 'اختر طريقة العرض',
    field: 'ميداني',
    analysis: 'تحليلي',
    fieldLong: 'العرض الميداني',
    analysisLong: 'عرض التحليل',
    fieldHint: 'لوقت وقوفك في الشارع: الأماكن القريبة وأول خطوة قانونية.',
    analysisHint: 'للمنظِّمين: العدسات وعوامل التصفية والتفاصيل وقائمة مرتّبة.',
    auto: 'اختر العرض المناسب لحجم شاشتي',
    autoHint: 'تعرض الهواتف العرض الميداني، وتعرض الشاشات الأكبر عرض التحليل.',
  },

  freshness: {
    checking: 'جارٍ فحص البيانات',
    ok: (date) => `بيانات بتاريخ ${date}`,
    stale: 'بعض البيانات قديمة',
    failing: 'بعض البيانات لا تُحمَّل',
    unknown: 'حالة البيانات غير معروفة',
  },

  field: {
    nearMe: 'بالقرب مني',
    nearMeBusy: 'جارٍ تحديد موقعك',
    nearMeDenied: 'خدمة الموقع متوقفة لهذا الموقع. ما زال بإمكانك تحريك الخريطة بيدك.',
    nearMeUnavailable: 'لم يتمكن جهازك من تحديد موقعك. ما زال بإمكانك تحريك الخريطة بيدك.',
    nearMeUnsupported: 'لا يستطيع هذا المتصفح مشاركة موقعك. ما زال بإمكانك تحريك الخريطة بيدك.',
    nearMeOutside: 'يبدو أنك خارج فيلادلفيا. تغطي هذه الخريطة فيلادلفيا فقط.',
    nearMePrivacy: 'يبقى موقعك على جهازك. لا يرسله Placekeepers إلى أي مكان ولا يضعه في أي رابط.',
    youAreHere: 'أنت هنا',
    stopLocation: 'التوقف عن استخدام موقعي',
    locationInUse: 'نستخدم موقعك الآن. يبقى على هذا الجهاز، ولا يدخل في أي رابط تنسخه.',
    stop: 'إيقاف',
    myLists: 'قوائمي',
    listsTitle: 'القوائم المحفوظة',
    chipsLabel: 'الطبقات الرئيسية',
    moreLayers: 'طبقات أخرى',
    layersTitle: 'الطبقات',
  },

  chips: {
    lots: 'قطع الأراضي',
    streets: 'الشوارع',
    memorials: 'النُّصُب التذكارية',
    stops: 'مواقف الحافلات',
    comingSoon: 'قريبًا',
  },

  sheet: {
    title: 'ما يمكنك فعله بالقرب منك',
    show: 'إظهار الأماكن القريبة',
    hide: 'إخفاء الأماكن القريبة',
    countLabel: (n) => count(n, PLACE),
    zoomIn: 'حرّك الخريطة أو قرّبها إلى حيّ ما لتظهر الأماكن القريبة.',
    finding: 'جارٍ البحث عن الأماكن القريبة.',
    noLotsLayer: 'شغّل طبقة "قطع الأراضي" أو "مواقف الحافلات" لتظهر الأماكن القريبة.',
    nothingHere: 'لا توجد قطع أراضٍ أو مبانٍ فارغة تطابق إعداداتك في هذا الجزء من الخريطة.',
    nothingHereStops: 'لا توجد قطع أراضٍ أو مبانٍ فارغة أو مواقف حافلات تطابق إعداداتك في هذا الجزء من الخريطة.',
    noStopsHere: 'لا توجد مواقف حافلات أو ترام تطابق إعداداتك في هذا الجزء من الخريطة.',
    showOnMap: 'إظهار على الخريطة',
    openLotPage: 'فتح صفحة القطعة',
    nearestToYou: 'الأقرب إليك أولًا.',
    nearestToCenter: 'الأقرب إلى منتصف الخريطة أولًا. حرّك الخريطة، أو اضغط على "بالقرب مني".',
    noneWithSuggestion: 'لا يوجد هنا مكان له اقتراح مفعّل. فعّل الاقتراحات من الإعدادات، أو حرّك الخريطة.',
    showMore: 'إظهار المزيد من الأماكن',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? count(Math.max(10, Math.round(feet / 10) * 10), FOOT) : `${formatDecimal(feet / 5280, 1)} ميل`;
      return `على بُعد نحو ${far} ${fromYou ? 'منك' : 'من منتصف الخريطة'}`;
    },
  },

  place: {
    kindLot: 'قطعة أرض فارغة',
    kindBuilding: 'مبنى فارغ',
    kindUnknown: 'قطعة فارغة',
    parcel: (id) => `القطعة ${id}`,
    priority: (score, lens) => `الأولوية ${score} من 100 بحسب عدسة ${lens}`,
    mainReason: (label) => `السبب الرئيسي: ${label}.`,
    bestSuggestion: 'ما يمكنك فعله',
    firstStep: 'أول خطوة قانونية',
    cost: (cost) => `التكلفة: ${cost}`,
    confidence: { 1: 'لسنا متأكدين تمامًا أنها فارغة', 2: 'من المرجح أنها فارغة', 3: 'من المرجح جدًا أنها فارغة' },
    confidenceTitle: 'مدى تأكدنا',
    ownerTitle: 'نوع المالك',
    landcare: 'تعتني بها PHS LandCare بالفعل',
    listed: 'مُدرجة كمتاحة لدى جهات الأراضي التابعة للمدينة',
    suggestionsTitle: 'الاقتراحات',
    clearSelection: 'إلغاء التحديد',
    selectedTitle: 'المكان المحدد',
  },

  ownerTypes: {
    0: 'غير معروف',
    1: 'فرد',
    2: 'شركة',
    3: 'مدينة فيلادلفيا',
    4: 'Philadelphia Land Bank',
    5: 'هيئة إعادة التطوير',
    6: 'هيئة الإسكان',
    7: 'منظمة غير ربحية',
    8: 'جهة عامة أخرى',
  },

  why: {
    title: 'لماذا هذه الدرجة',
    caption: 'قيمة كل عامل من 0 إلى 100، ووزنه، والنقاط التي يضيفها إلى الدرجة',
    intro: 'الدرجة متوسط مرجّح لهذه العوامل. يتراوح كل عامل من 0 إلى 100، حيث يعني 100 أكبر حاجة.',
    factor: 'العامل',
    value: 'من 100',
    weight: 'الوزن',
    adds: 'يضيف',
    noData: 'لا بيانات',
    off: 'متوقف',
    total: 'الدرجة',
    missingNote: 'العوامل التي لا بيانات لها لهذا المكان تُستبعد من متوسطه.',
  },

  reasons: {
    title: 'لماذا نعتقد أنها فارغة',
    againstTitle: 'ما يدعونا إلى التروّي',
    notPublished: 'لم تُنشر أسباب هذا المكان بعد.',
    city_land: (date) =>
      date ? `تُدرجها المدينة على أنها أرض فارغة على الأرجح (القائمة بتاريخ ${date})` : 'تُدرجها المدينة على أنها أرض فارغة على الأرجح',
    city_building: (date) =>
      date
        ? `تُدرجها المدينة على أنها مبنى فارغ على الأرجح (القائمة بتاريخ ${date})`
        : 'تُدرجها المدينة على أنها مبنى فارغ على الأرجح',
    assessor_vacant_land: 'يصنّفها مُقدِّر العقارات على أنها أرض فارغة',
    no_building: 'لا يوجد مبنى قائم على القطعة',
    demolished: (year) => (year ? `هُدم المبنى عام ${year}، ولم يُبنَ شيء بعده` : 'هُدم المبنى، ولم يُبنَ شيء بعده'),
    vacant_lot_record: 'سجّلت L&I مخالفة أو شكوى بشأن قطعة أرض فارغة خلال آخر سنتين',
    landcare: 'هي ضمن PHS LandCare، التي تعتني بقطع الأراضي الفارغة',
    sealed: (year) =>
      year ? `أغلقتها المدينة بإحكام عام ${year}، دون تصريح بعد ذلك` : 'أغلقتها المدينة بإحكام، دون تصريح بعد ذلك',
    unsafe: 'تدرجها L&I على أنها غير آمنة، دون تصريح بعد ذلك',
    imminently_dangerous: 'أعلنت L&I أنها تشكّل خطرًا وشيكًا، دون تصريح بعد ذلك',
    vacant_building_record: 'سجّلت L&I مخالفة أو شكوى بشأن عقار فارغ خلال آخر سنتين',
    assessor_exterior: 'سجّل مُقدِّر العقارات أن مظهرها الخارجي فارغ أو مُغلق',
    built_since: (year) =>
      year
        ? `صدر تصريح بناء جديد عام ${year}، فقد يكون هناك مبنى قائم الآن`
        : 'صدر تصريح بناء جديد، فقد يكون هناك مبنى قائم الآن',
    construction_starting: (year) =>
      year
        ? `صدر تصريح بناء جديد عام ${year}، فقد يكون البناء على وشك البدء`
        : 'صدر تصريح بناء جديد، فقد يكون البناء على وشك البدء',
    side_yard: 'يملكها أيضًا مالك المنزل المأهول المجاور، فقد تكون فناءً جانبيًا',
    land_use_shows_use: 'تُظهرها خريطة استخدام الأراضي لدى المدينة قيد الاستخدام',
    recent_permit: 'صدر تصريح لأعمال بناء أو لتقسيم المناطق خلال آخر سنتين',
    building_stands: 'يوجد عليها مخطط مبنى قائم، مع أن السجلات تقول إنها أرض فارغة',
    homestead: 'للمالك إعفاء Homestead: تقول سجلات المدينة إن شخصًا يسكن هنا، أو كان يسكن',
  },

  lens: {
    title: 'العدسة',
    presets: 'إعدادات جاهزة',
    presetActive: 'قيد الاستخدام',
    weightLabel: (factor) => `وزن ${factor}`,
    weightValue: (w) => (w === 0 ? 'متوقف' : `${w} من 5`),
    resetWeights: 'إعادة ضبط الأوزان',
    allOff: 'جميع العوامل متوقفة. شغّل أحدها لتلوين قطع الأراضي.',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? 'جميع العوامل متوقفة. شغّل أحدها لتلوين الشوارع.'
        : appliesTo === 'stop'
          ? 'جميع العوامل متوقفة. شغّل أحدها لتلوين مواقف الحافلات والترام.'
          : 'جميع العوامل متوقفة. شغّل أحدها لتلوين قطع الأراضي.',
    explainToggle: 'لماذا هذا العامل',
    shown: (layer, lens) => `تُعرض الآن طبقة "${layer}" ملوّنة بحسب عدسة ${lens}.`,
    notShown: (layer) => `لا تعرض الخريطة هذه العدسة على طبقة "${layer}" حاليًا.`,
    showOnMap: 'اعرضها على الخريطة',
    legendLow: 'أولوية أقل',
    legendHigh: 'أولوية أعلى',
    legendNoData: 'بلا درجة',
  },

  filters: {
    title: 'عوامل التصفية',
    intro:
      'اختر الخيارات لتضييق قطع الأراضي المعروضة على الخريطة وفي القائمة المرتبة وفي المخطط. المجموعة التي لا تختار فيها شيئًا تعرض كل شيء.',
    ownerType: 'نوع المالك',
    landcare: 'ضمن LandCare بالفعل',
    inLandcare: 'تعتني بها PHS LandCare',
    notInLandcare: 'ليست ضمن LandCare',
    confidence: 'مدى تأكدنا',
    kind: 'قطعة أرض أم مبنى',
    listed: 'مُدرجة لدى جهات الأراضي في المدينة',
    clear: 'مسح عوامل التصفية',
    showAll: 'إظهار الكل',
    noneSelected: (group) => `لم تختر شيئًا ضمن "${group}"، لذلك لا تُعرض أي قطعة أرض.`,
    narrowedNote: (n) =>
      plural(n, {
        zero: '# عوامل تصفية من عرض التحليل تضيّق هذه الأماكن.',
        one: 'عامل تصفية واحد من عرض التحليل يضيّق هذه الأماكن.',
        two: 'عاملا تصفية من عرض التحليل يضيّقان هذه الأماكن.',
        few: '# عوامل تصفية من عرض التحليل تضيّق هذه الأماكن.',
        many: '# عاملَ تصفية من عرض التحليل تضيّق هذه الأماكن.',
        other: '# عامل تصفية من عرض التحليل تضيّق هذه الأماكن.',
      }),
  },

  permission: {
    title: 'أول خطوة للحصول على إذن',
    short: {
      0: 'لا مسار واضح بعد',
      1: 'Community LandCare',
      2: 'اتفاقية حديقة أو ترخيص',
      3: 'اسأل PHDC',
      4: 'اسأل الجهة العامة',
      5: 'اسأل المالك',
    },
    long: {
      0: 'لا مسار واضح بعد: لا تذكر سجلات المدينة اسم مالك',
      1: 'تعتني بها PHS LandCare بالفعل: رعاية Community LandCare',
      2: 'تملكها المدينة أو Land Bank: اتفاقية حديقة أو ترخيص',
      3: 'تملكها هيئة إعادة التطوير أو PHDC: اسأل PHDC',
      4: 'تملكها هيئة الإسكان أو جهة عامة أخرى: اسأل الجهة',
      5: 'مالك خاص: اسأل المالك',
    },
    notPublished: 'لم تُنشر بعد',
    filterHelp: 'من تسأله أولًا، بحسب المالك الذي تذكره سجلات المدينة. هذا نوع من الخطوات، وليس مقياسًا لاحتمال أن يقول أحد نعم.',
    noRoute: 'لا مسار واضح بعد: لا تذكر سجلات المدينة اسم مالك. تعرض صفحة القطعة ما نعرفه.',
    seeLotPage: 'تسرد صفحة القطعة المسارات القانونية لهذا المكان.',
  },

  layers: {
    title: 'الطبقات',
    show: (label) => `إظهار ${label}`,
    details: 'عن هذه الطبقة',
    settings: 'إعدادات الطبقة',
    sources: 'المصادر',
    legend: 'مفتاح الخريطة',
    license: 'الترخيص',
    noData: 'لم تُنشر بيانات بعد',
    dataError: 'تعذّر تحميل هذه الطبقة.',
    resetAll: 'العودة إلى الإعدادات الافتراضية',
    resetDone: 'عادت الإعدادات إلى قيمها الافتراضية.',
    guide: 'كيف تساعد في تحسين هذه الطبقة',
  },

  settings: {
    title: 'الإعدادات',
    intro:
      'كل ما على الخريطة هو إعداد. تُحفظ اختياراتك في هذا المتصفح وفي الرابط، ما عدا اختيارات الخصوصية فتبقى في هذا المتصفح فقط.',
    viewTitle: 'العرض',
    layersTitle: 'الطبقات وإعداداتها',
    lensTitle: 'أوزان العدسات',
    suggestionsTitle: 'الاقتراحات المعروضة',
    suggestionShow: (label) => `إظهار "${label}"`,
    resetTitle: 'ابدأ من جديد',
    resetHelp: 'يعيد كل طبقة وإعداد ووزن إلى الإعدادات الافتراضية لهذا العرض، وينسى النسخة المحفوظة في هذا المتصفح.',
    reset: 'العودة إلى الإعدادات الافتراضية',
    storageNote: 'يُحفظ في هذا المتصفح فقط. ليس لدى Placekeepers حسابات ولا ملفات تعريف ارتباط (كوكيز) ولا تتبع.',
  },

  // @@NEXT@@
};

export default ar;
