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
const LIST: Nouns = { one: 'قائمة واحدة', two: 'قائمتان', few: 'قوائم', many: 'قائمة', other: 'قائمة' };
const RENTER_HOUSEHOLD: Nouns = { one: 'أسرة مستأجرة واحدة', two: 'أسرتان مستأجرتان', few: 'أسر مستأجرة', many: 'أسرة مستأجرة', other: 'أسرة مستأجرة' };
const POLE: Nouns = { one: 'عمود واحد', two: 'عمودان', few: 'أعمدة', many: 'عمودًا', other: 'عمود' };
const STOP: Nouns = { one: 'موقف واحد', two: 'موقفان', few: 'مواقف', many: 'موقفًا', other: 'موقف' };
const TREE: Nouns = { one: 'شجرة واحدة', two: 'شجرتان', few: 'أشجار', many: 'شجرة', other: 'شجرة' };
const WORK: Nouns = { one: 'عمل فني واحد', two: 'عملان فنيان', few: 'أعمال فنية', many: 'عملًا فنيًا', other: 'عمل فني' };
const REPORT: Nouns = { one: 'بلاغ واحد', two: 'بلاغان', few: 'بلاغات', many: 'بلاغًا', other: 'بلاغ' };
const DEPARTURE: Nouns = { one: 'رحلة واحدة', two: 'رحلتان', few: 'رحلات', many: 'رحلة', other: 'رحلة' };
const MINUTE: Nouns = { one: 'دقيقة واحدة', two: 'دقيقتين', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' };
const INCH: Nouns = { one: 'بوصة واحدة', two: 'بوصتان', few: 'بوصات', many: 'بوصة', other: 'بوصة' };
const DEVICE: Nouns = { one: 'وسيلة واحدة', two: 'وسيلتان', few: 'وسائل', many: 'وسيلة', other: 'وسيلة' };
const CALMING: Nouns = { one: 'مطبّ واحد لتخفيف السرعة', two: 'مطبّان لتخفيف السرعة', few: 'مطبّات لتخفيف السرعة', many: 'مطبًّا لتخفيف السرعة', other: 'مطبّ لتخفيف السرعة' };
const POST: Nouns = { one: 'نقطة عبور واحدة', two: 'نقطتا عبور', few: 'نقاط عبور', many: 'نقطة عبور', other: 'نقطة عبور' };
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

  analysis: {
    leftTitle: 'العدسة وعوامل التصفية والطبقات',
    rightTitle: 'التفاصيل',
    openLeft: 'العدسة والطبقات',
    openRight: 'التفاصيل',
    closePanel: 'إغلاق اللوحة',
    areaTitle: 'في هذا الجزء من الخريطة',
    areaLots: (n) => count(n, LOT),
    areaBuildings: (n) => count(n, BUILDING),
    areaHigh: (n) => `منها ${formatNumber(n)} من المرجح جدًا أنها فارغة`,
    areaLandcare: (n) => `منها ${formatNumber(n)} تعتني بها PHS LandCare بالفعل`,
    areaEmpty: 'لا توجد قطع أراضٍ أو مبانٍ فارغة تطابق إعداداتك هنا. جرّب التصغير أو غيّر عوامل التصفية.',
    areaHint: 'اختر قطعة على الخريطة أو في القائمة لترى لماذا حصلت على درجتها.',
    sampleArea:
      'عند التصغير إلى هذا الحد، تعرض الخريطة عيّنة فقط من قطع الأراضي والمباني الفارغة، لذلك لا تُحصى هنا. قرّب الخريطة لإحصاء كل مكان.',
    sampleList:
      'قرّب الخريطة لعرض كل الأماكن. عند التصغير إلى هذا الحد، تعرض الخريطة عيّنة فقط من قطع الأراضي والمباني الفارغة، لذلك ستُسقط أي قائمة أو مخطط هنا بعض الأماكن.',
    sampleTab: 'قرّب الخريطة',
    tableCaption: 'الأماكن الظاهرة على الخريطة، مرتّبة بحسب مزيج العدسات الحالي',
    rank: 'الترتيب',
    place: 'المكان',
    score: 'الدرجة',
    reason: 'السبب الرئيسي',
    save: 'حفظ',
    sortHighFirst: 'الأعلى درجة أولًا. اختر لجعل الأقل درجة أولًا.',
    sortLowFirst: 'الأقل درجة أولًا. اختر لجعل الأعلى درجة أولًا.',
    tableEmpty: 'لا شيء للترتيب في الجزء الظاهر.',
    noScores: 'لم تُنشر درجات الأولوية بعد، لذلك هذه القائمة مرتّبة بحسب رقم القطعة.',
    tableMore: (shown, total) =>
      `نعرض أول ${formatNumber(shown)} من أصل ${formatNumber(total)}. قرّب الخريطة أو ضيّق عوامل التصفية لترى الباقي، أو نزّلها كلها.`,
    drawerLabel: 'الأماكن الظاهرة على الخريطة',
    tabTable: 'القائمة المرتّبة',
    tabPlot: 'الحاجة وأول خطوة',
    tabLists: 'القوائم المحفوظة',
    tabMemorials: 'النُّصُب التذكارية',
    tabBlocks: 'مقاطع الشوارع',
  },

  plot: {
    title: 'الحاجة وأول خطوة للحصول على إذن',
    intro:
      'كل نقطة تمثل مكانًا ظاهرًا على الخريطة. على المحور الأفقي: أولويته بحسب مزيج عدساتك، من 0 إلى 100. وعلى المحور الرأسي: أول خطوة للحصول على إذن، وهي نوع من الخطوات وليست مقياسًا لاحتمال أن يقول أحد نعم. اختر نقطة لفتح صفحة قطعتها.',
    axisX: 'الأولوية بحسب مزيج عدساتك',
    empty: 'لا أماكن ظاهرة لرسمها.',
    noScore: (n) =>
      plural(n, {
        one: 'مكان واحد بلا درجة ولذلك لا يظهر.',
        two: 'مكانان بلا درجة ولذلك لا يظهران.',
        few: '# أماكن بلا درجة ولذلك لا تظهر.',
        many: '# مكانًا بلا درجة ولذلك لا تظهر.',
        other: '# مكان بلا درجة ولذلك لا تظهر.',
      }),
    noStep: (n) =>
      plural(n, {
        one: 'مكان واحد بلا أول خطوة منشورة بعد ولذلك لا يظهر.',
        two: 'مكانان بلا أول خطوة منشورة بعد ولذلك لا يظهران.',
        few: '# أماكن بلا أول خطوة منشورة بعد ولذلك لا تظهر.',
        many: '# مكانًا بلا أول خطوة منشورة بعد ولذلك لا تظهر.',
        other: '# مكان بلا أول خطوة منشورة بعد ولذلك لا تظهر.',
      }),
    dot: (place, score, step) => `${place}: الأولوية ${score}. ${step}.`,
    tableNote: 'تعرض القائمة المرتبة الأماكن نفسها، مع أول خطوة نفسها، للوحات المفاتيح وقارئات الشاشة.',
    capped: (shown, total) =>
      `نعرض ${formatNumber(shown)} مكانًا هي الأعلى درجة من أصل ${formatNumber(total)} ظاهرة. قرّب الخريطة لرؤيتها كلها.`,
    summary: (rows) => `الأماكن الظاهرة بحسب أول خطوة للحصول على إذن: ${rows}.`,
    rowSummary: (label, n) => `${label}، ${count(n, PLACE)}`,
  },

  export: {
    title: 'تنزيل هذه الأماكن',
    help: (limit) =>
      `ملف يضم ما يصل إلى ${count(limit, PLACE)} وما تقوله صفحة كل قطعة عن المالك، بما في ذلك إشارات المالك. يشير سطره الأول إلى شروط الاستخدام.`,
    csv: 'تنزيل CSV',
    geojson: 'تنزيل GeoJSON',
    inView: 'الأماكن الظاهرة',
    working: (done, total) => `جارٍ جمع تفاصيل المالكين: ${formatNumber(done)} من ${formatNumber(total)} ملفًا`,
    done: (n) => `تم تنزيل ${count(n, PLACE)}.`,
    leftOut: (n, limit) =>
      `${plural(n, {
        one: 'استُبعد مكان واحد إضافي',
        two: 'استُبعد مكانان إضافيان',
        few: 'استُبعدت # أماكن إضافية',
        many: 'استُبعد # مكانًا إضافيًا',
        other: 'استُبعد # مكان إضافي',
      })} لأن التنزيل لا يضم أكثر من ${formatNumber(limit)} مكان. قرّب الخريطة أو ضيّق عوامل التصفية لتنزيل الباقي.`,
    withoutDetails: (n) => `${count(n, PLACE)} بلا تفاصيل منشورة، لذلك أعمدة المالك فارغة.`,
    nothing: 'لا توجد أماكن للتنزيل.',
    sampleOff: 'تضم التنزيلات كل مكان ظاهر، وعند التصغير إلى هذا الحد لا تعرض الخريطة إلا عيّنة. قرّب الخريطة للتنزيل.',
    failed: 'تعذّر إنشاء التنزيل. حاول مرة أخرى بعد قليل.',
    yes: 'نعم',
    no: 'لا',
    termsLine: (url) => `تصدير من Placekeepers: لرعاية المجتمع والعمل القانوني فقط. اقرأ شروط الاستخدام أولًا: ${url}`,
    englishColumns: 'أسماء الأعمدة بالإنجليزية في كل اللغات حتى يمكن دمج الملفات وقراءتها من جديد.',
    madeLine: (n, title, day, dataDay) =>
      `${count(n, PLACE)} من ${title}. أُنشئ الملف في ${day}${dataDay ? ` من بيانات الأسبوع الصادرة في ${dataDay}` : ''}.`,
    ownerLine:
      'أسماء المالكين وعناوين مراسلتهم كما تنشرها المدينة. لكل إشارة مالك ملاحظة حذرة وخطوة تالية واقية: اقرأها في صفحة القطعة قبل أن تتصرف. ليس مشورة قانونية.',
    scoreLine: (lens, weights) => `تستخدم الدرجات عدسة ${lens} بهذه الأوزان: ${weights}.`,
    greeningLine: (caution) => `عن اقتراحات التخضير: ${caution}`,
    placemakingLine: (caution) => `عن الحدائق والمقاعد والفن: ${caution}`,
  },

  lists: {
    title: 'القوائم المحفوظة',
    privacy:
      'تبقى القوائم في هذا المتصفح وعلى هذا الجهاز. لا يُرسل شيء إلى أي مكان. لنقل قائمة إلى جهاز آخر أو مشاركتها، نزّلها كملف وافتح الملف هناك.',
    notKept:
      'لا يحتفظ هذا المتصفح بالقوائم الآن، ربما لأن النافذة خاصة أو لأن التخزين محظور. نزّل قائمتك قبل أن تغلق الصفحة.',
    empty: 'لا توجد قوائم بعد. احفظ مكانًا من بطاقته أو من القائمة المرتبة أو من صفحة قطعته، وستبدأ قائمة.',
    inUse: 'القائمة المستخدمة',
    defaultName: 'قائمتي',
    untitled: 'قائمة',
    newList: 'قائمة جديدة',
    newName: 'اسم القائمة الجديدة',
    create: 'إنشاء القائمة',
    rename: 'إعادة التسمية',
    renameLabel: 'اسم جديد لهذه القائمة',
    saveName: 'حفظ الاسم',
    cancel: 'إلغاء',
    delete: 'حذف هذه القائمة',
    made: (name) => `تم إنشاء القائمة "${name}". الأماكن التي تحفظها الآن تُضاف إليها.`,
    renamed: (name) => `أصبح اسم القائمة "${name}".`,
    deleted: (name) => `تم حذف "${name}" من هذا المتصفح.`,
    confirmDelete: (name, n) =>
      `هل تريد حذف "${name}" وما فيها من أماكن (${count(n, PLACE)}) من هذا المتصفح؟ لا يمكن استرجاعها إلا إذا نزّلتها.`,
    count: (n) => count(n, PLACE),
    noPlaces: 'هذه القائمة فارغة. احفظ أماكن من بطاقاتها أو من القائمة المرتبة أو من صفحات قطعها.',
    open: (place) => `افتح صفحة القطعة: ${place}`,
    remove: 'إزالة',
    removeLabel: (place) => `إزالة ${place} من القائمة`,
    save: 'حفظ في قائمتي',
    saveShort: 'حفظ',
    savedShort: 'تم الحفظ',
    saveShortLabel: (place, list) => `حفظ ${place} في ${list}`,
    saveTo: (name) => `حفظ في ${name}`,
    saved: (name) => `تم الحفظ في ${name}`,
    savedLabel: (name) => `تم الحفظ في ${name}. اختر لإزالته.`,
    added: (name) => `تم الحفظ في "${name}". تبقى القوائم في هذا المتصفح.`,
    removed: (name) => `تمت الإزالة من "${name}".`,
    full: (limit) => `هذه القائمة ممتلئة: تتسع القائمة لما يصل إلى ${count(limit, PLACE)}.`,
    tooMany: (limit) => `يحتفظ هذا المتصفح بما يصل إلى ${count(limit, LIST)}. احذف قائمة لتنشئ أخرى.`,
    download: 'تنزيل هذه القائمة',
    importTitle: 'فتح ملف قائمة',
    importHelp: 'ملف CSV أو GeoJSON نُزّل من Placekeepers، أو أي ملف نصي فيه أرقام قطع من تسعة أرقام.',
    imported: (name, n) => `تم فتح "${name}" وفيها ${count(n, PLACE)}.`,
    importFailed: 'لا يحتوي هذا الملف على أرقام قطع استطعنا قراءتها.',
    importTooBig: 'هذا الملف أكبر من أن يكون قائمة.',
    importLeftOut: (n, limit) =>
      `${plural(n, {
        one: 'استُبعد مكان واحد',
        two: 'استُبعد مكانان',
        few: 'استُبعدت # أماكن',
        many: 'استُبعد # مكانًا',
        other: 'استُبعد # مكان',
      })}: تتسع القائمة لما يصل إلى ${count(limit, PLACE)}.`,
  },

  displacement: {
    caution: 'قد يؤدي التخضير إلى رفع الأسعار القريبة. فكّر في أن تقرنه بإجراءات حماية.',
    placemakingCaution:
      'قد تجعل الحدائق الجديدة والمقاعد والفن الشارع أكثر إقبالًا عليه من الناس، فترفع الأسعار والإيجارات القريبة. اقرنها بإجراءات حماية للجيران الذين يستأجرون مساكنهم أو الذين تأخروا في دفع الضرائب.',
    protections: 'طرق لحماية الجيران',
    inWatch: (signs) => `هذا المكان في منطقة رصد التهجير السكني، وفيها مؤشرات على أن الأسعار ترتفع هنا: ${signs}.`,
    protectionsTitle: 'إجراءات الحماية التي تُقرن به',
    jumpToWatch: 'اطّلع على المؤشرات هنا وعلى طرق حماية الجيران',
    jumpToProtections: 'اطّلع على طرق حماية الجيران',
    listIntro:
      'بعض هذه الأماكن في مناطق رصد التهجير السكني، وفيها مؤشرات في السجلات العامة على أن الأسعار ترتفع هناك. تذكر بطاقة كل منها مؤشرات منطقتها.',
    printSeeAbove: 'انظر "رصد التهجير السكني" أعلاه.',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: 'ائتمانات الأراضي المجتمعية (Community Land Trusts)',
      homestead_exemption: 'إعفاء Homestead من المدينة',
      longtime_owner_occupants: 'برنامج LOOP للمدينة (Longtime Owner Occupants Program)',
      tangled_title_help: 'مساعدة في سند الملكية المتشابك',
    },
    checked: (date) => `جرى التحقق في ${date}`,
    signShort: {
      prices: 'أسعار المنازل ترتفع أسرع من المدينة ككل',
      assessments: 'القيم المقدّرة لدى المدينة ترتفع أسرع من المدينة ككل',
      mva: 'تحليل قيمة السوق (Market Value Analysis) لدى المدينة يجد أن أسعار المنازل ترتفع فوق قدرة السكان المقيمين منذ زمن طويل',
      companies: 'شركات تشتري كثيرًا من المنازل المباعة',
      renters: 'ثلاثة من كل خمسة منازل على الأقل مؤجَّرة',
      rent_burden: 'كثير من المستأجرين يدفعون نصف دخلهم أو أكثر على الإيجار',
    },
    heading: 'مؤشرات على أن الأسعار ترتفع هنا',
    areaTitle: (tract) => `منطقة التعداد ${tract}`,
    around: (place) => `حول ${place}`,
    signsHere: 'المؤشرات هنا',
    alsoMeasured: 'قِيس أيضًا، وليس مؤشرًا هنا',
    signTitle: {
      prices: 'أسعار بيع المنازل',
      assessments: 'القيم المقدّرة لدى المدينة',
      mva: 'تحليل قيمة السوق لدى المدينة',
      companies: 'المشترون من الشركات',
      renters: 'المستأجرون',
      rent_burden: 'مستأجرون يدفعون نصف دخلهم أو أكثر على الإيجار',
    },
    span: (a0, a1, b0, b1) => `مبيعات من ${a0} إلى ${a1} ومن ${b0} إلى ${b1}`,
    pricesText: (p0, p1, change, city, span) =>
      `انتقل السعر الوسيط للمنازل المباعة من ${p0} إلى ${p1}، أي ${changeWords(change)}${city === null ? '' : `، مقابل ${changeWords(city)} في المدينة ككل`}${span ? ` (${span})` : ''}.`,
    companiesText: (share, sales, city) =>
      `اشترت الشركات ${share}% من أصل ${count(sales, HOME)} بيعت خلال السنوات الثلاث الأخيرة${city === null ? '' : `، مقابل ${city}% في المدينة ككل`}.`,
    assessmentsText: (change, homes, city, years) =>
      `القيمة السوقية للمنزل الوسيط لدى المدينة: ${changeWords(change)}${years ? ` من ${years[0]} إلى ${years[1]}` : ''} (${count(homes, HOME)})${city === null ? '' : `، مقابل ${changeWords(city)} في المدينة ككل`}.`,
    rentersText: (share, city, years) =>
      `${share}% من المنازل التي يسكنها الناس هنا مؤجَّرة${city === null ? '' : `، مقابل ${city}% في المدينة ككل`}${years ? ` (مسح مكتب الإحصاء الأمريكي، من ${years[0]} إلى ${years[1]})` : ''}.`,
    mvaText: (rising, groups, edition) =>
      rising > 0
        ? `في ${rising} من أصل ${count(groups, GROUP)} هنا، يجد ${edition ?? 'تحليل قيمة السوق'} الذي أعدّه Reinvestment Fund للمدينة ضغطًا متصاعدًا: أسعار منازل ترتفع فوق ما يكسبه السكان المقيمون منذ زمن طويل.`
        : `لا يجد ${edition ?? 'تحليل قيمة السوق'} ضغطًا متصاعدًا في أي من ${count(groups, GROUP)} هنا.`,
    mvaNone: 'لا يغطي تحليل قيمة السوق هذه المنطقة.',
    tooFewSales: (earlier, recent, needed) =>
      `عدد مبيعات المنازل أقل من أن يكفي للحكم (${formatNumber(earlier)} و${formatNumber(recent)}؛ يلزم ${formatNumber(needed)} على الأقل في كل فترة).`,
    tooFewHomes: 'عدد المنازل التي لها قيم في العامين أقل من أن يكفي للحكم.',
    tooFewHouseholds: 'عدد الأسر في مسح مكتب الإحصاء أقل من أن يكفي للحكم.',
    rule: 'تدخل المنطقة في الرصد حين يتحقق مؤشران على الأقل من هذه المؤشرات، ويكون أحدهما على الأقل عن الأسعار: أسعار البيع أو القيم المقدّرة أو تحليل قيمة السوق.',
    meaning: 'قد يرفع التخضير وغيره من التحسينات الأسعار هنا أكثر. اقرنها بإجراءات حماية للجيران الذين يسكنون هنا الآن.',
    cannotTell:
      'هذه مؤشرات في السجلات العامة، وليست توقعًا. لا تستطيع أن تخبرنا من رحل ولماذا، ولا من يسكن هنا؛ وأرقام مسح مكتب الإحصاء متوسط خمس سنوات، فلا تخبرنا بالإيجارات اليوم. وقد تشعر منطقة خارج الرصد بارتفاع الأسعار أيضًا.',
    contextTitle: 'الإيجارات والدخل والمنازل الفارغة هنا',
    contextIntro: (years) =>
      `من مسح مكتب الإحصاء الأمريكي${years ? `، من ${years[0]} إلى ${years[1]}` : ''}. سياق للجيران، وليس مؤشرًا: هذه الأرقام لا تغيّر وضع أي منطقة.`,
    contextNoisy:
      'هذه تقديرات من مسح شمل بعض المنازل على مدى خمس سنوات، لذلك هي تقريبية في المنطقة الصغيرة: الرقم الحقيقي يقع على الأرجح ضمن الهامش المعروض (هامش الخطأ لدى مكتب الإحصاء، بمستوى ثقة 90 في المئة).',
    contextTitles: {
      rent: 'الإيجار الوسيط',
      income: 'دخل الأسرة الوسيط',
      vacant: 'المنازل الفارغة',
    },
    burdenText: (share, margin, households, city, years) =>
      `${share}% من أصل ${count(households, RENTER_HOUSEHOLD)} هنا يدفعون نصف دخلهم أو أكثر على الإيجار والمرافق${giveOrTake(margin, 'points')}${city === null ? '' : `، مقابل ${city}% في المدينة ككل`}${years ? ` (مسح مكتب الإحصاء الأمريكي، من ${years[0]} إلى ${years[1]})` : ''}. وارتفاع الإيجارات أشد وطأة عليهم.`,
    burdenTooFew: 'عدد الأسر المستأجرة في مسح مكتب الإحصاء أقل من أن يكفي للحكم.',
    rentText: (rent, margin, city) =>
      `${rent} في الشهر، مع المرافق التي يدفعها المستأجر${margin ? ` (بزيادة أو نقصان نحو ${margin})` : ''}${city ? `، مقابل ${city} في المدينة ككل` : ''}.`,
    rentNone: 'عدد إجابات مسح مكتب الإحصاء هنا أقل من أن يكفي لحساب إيجار وسيط.',
    incomeText: (income, margin, city) =>
      `${income} في السنة${margin ? ` (بزيادة أو نقصان نحو ${margin})` : ''}${city ? `، مقابل ${city} في المدينة ككل` : ''}.`,
    incomeNone: 'عدد إجابات مسح مكتب الإحصاء هنا أقل من أن يكفي لحساب دخل وسيط.',
    vacantText: (vacant, homes, share, margin, city) =>
      `${formatNumber(vacant)} من أصل ${count(homes, HOME)} هنا، أي ${share}%${giveOrTake(margin, 'points')}${city === null ? '' : `، مقابل ${city}% في المدينة ككل`}.`,
    vacantTooFew: 'عدد المنازل في مسح مكتب الإحصاء أقل من أن يكفي للحكم.',
    whyEmpty: 'لماذا هي فارغة',
    whyRows: {
      vr: 'للإيجار',
      vs: 'للبيع',
      vn: 'مؤجَّرة أو مباعة، ولم يُسكن فيها بعد',
      vz: 'للاستخدام الموسمي أو العارض',
      vo: 'محتجزة خارج السوق لأسباب أخرى، مثل الإصلاحات أو مشكلة قانونية لدى العائلة أو الهجر',
    },
    whyRow: (label, n, margin) => `${label}: ${formatNumber(n)}${giveOrTake(margin, 'homes')}`,
    legendArea: 'منطقة فيها مؤشرات على أن الأسعار ترتفع',
    legendTap: 'اضغط داخل منطقة، أو قرب حافتها، لترى مؤشراتها.',
    legendNote:
      'مؤشرات في السجلات العامة، وليست توقعًا. تضيف بطاقات التخضير والحدائق والمقاعد والفن في هذه المناطق طرقًا لحماية الجيران.',
    exportColumn: (signs) => `منطقة رصد التهجير السكني: ${signs}`,
    exportLine: (caution, links) => `عن التخضير في مناطق رصد التهجير السكني: ${caution} طرق لحماية الجيران: ${links}`,
    placemakingExportLine: (caution, links) =>
      `عن الحدائق والمقاعد والفن في مناطق رصد التهجير السكني: ${caution} طرق لحماية الجيران: ${links}`,
    watchTitle: 'رصد التهجير السكني',
  },

  evidence: {
    strong: { label: 'أدلة قوية', meaning: 'وجدت تجربة عشوائية، ويُفضَّل أن تكون في فيلادلفيا، هذا الأثر.' },
    moderate: {
      label: 'أدلة متوسطة',
      meaning: 'وجدت مقارنات دقيقة بين ما قبل وما بعد، مع مناطق للمقارنة، هذا الأثر.',
    },
    mixed: { label: 'أدلة متباينة', meaning: 'دراسات جيدة تختلف نتائجها، أو أن الأثر يعتمد على السياق.' },
    weak: { label: 'أدلة ضعيفة', meaning: 'مجرد استطلاعات للانطباعات أو ارتباطات، أو دراسة واحدة صغيرة.' },
    not_violence: {
      label: 'لا يتعلق بالعنف',
      meaning: 'مفيد لأسباب أخرى. لا يُدّعى شيء عن العنف.',
    },
    context: {
      label: 'سياق',
      meaning: 'معلومات خلفية تبيّن أين تكون العناية أنفع. وليست ادعاءً بما ينجح.',
    },
  },

  legend: {
    parcelsFill: 'لون التعبئة: الأولوية بحسب مزيج عدساتك',
    parcelsFillLens: (lens) => `لون التعبئة: الأولوية بحسب عدسة ${lens}`,
    parcelsSure: 'الإطار: مدى تأكدنا أنها فارغة',
    sureHigh: 'من المرجح جدًا أنها فارغة',
    sureMedium: 'من المرجح أنها فارغة',
    sureLow: 'لسنا متأكدين كثيرًا',
    parcelPoint: 'النقاط: عند التصغير، عيّنة من القطع الفارغة؛ وعند التقريب، قطعة بلا شكل مرسوم على الخريطة',
    parcelsListed:
      'تُعرض فقط القطع التي تُدرجها جهات الأراضي في المدينة كمتاحة. لا تُرسم قطعة لا تعدّها الخريطة فارغة؛ وتعرض خريطة Land Bank نفسها كل واحدة منها.',
    selected: 'المكان المحدد',
    landcare: 'قطعة تعتني بها PHS LandCare: يُعتنى بها بالفعل',
    garden: 'حديقة أو مزرعة مجتمعية',
    hin: 'شارع ضمن شبكة الشوارع الأكثر إصابات (High Injury Network)',
    hexIntro: (window) => `من أُصيبوا بالرصاص في كل شكل سداسي، ${window}`,
    hexNone: 'الأشكال السداسية التي لا إطلاق نار فيها تُترك فارغة.',
    countBin: (lo, hi) => (hi === null ? `${formatNumber(lo)} أو أكثر` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} إلى ${formatNumber(hi)}`),
    segmentsFill: 'لون الخط: درجة سلامة الشارع بحسب مزيج عدساتك',
    segmentsShown: (min) =>
      min <= 1 ? 'يُعرض كل مقطع درجته فوق الصفر.' : `تُعرض المقاطع التي تبلغ درجتها ${formatNumber(min)} أو أكثر من 100.`,
    segmentsZoom:
      'عند التصغير، لا تُرسم إلا المقاطع التي سُجّل فيها ضرر أو التي تقع ضمن شبكة الشوارع الأكثر إصابات. قرّب الخريطة لترى الباقي.',
    crashSeverity: {
      3: 'قُتل شخص',
      2: 'أُصيب شخص إصابة جسيمة',
      1: 'أُصيب شخص',
      0: 'لم يُبلَّغ عن إصابة أحد',
    },
    crashesZoom: 'قرّب الخريطة لترى الحوادث التي لم يُصَب فيها أحد إصابة جسيمة.',
    crashesSource: 'من سجلات حوادث PennDOT، التي تصل بعد نحو سنة من وقوع الحوادث.',
    memorial: 'شخص قُتل وهو يمشي أو يركب دراجة أو سكوترًا',
    memorialEveryone: 'شخص قُتل في حادث مروري',
    memorialNames: 'الحلقة الأكمل تعني أن قائمة تأبين عامة تذكر اسم الشخص. افتح العلامة لتقرأه.',
    memorialNamesWaiting: 'لا تُعرض أي أسماء بعد. ستظهر فقط حين تتوفر للعائلات طريقة خاصة لطلب إزالة اسم.',
    memorialNamesHidden: 'الأسماء مخفية.',
    stopShelter: 'مظلة، أو أن الموقف كله تحت سقف',
    stopBench: 'مقعد، لكن لا مظلة مسجّلة على الخريطة',
    stopNeither: 'لا مظلة ولا مقعد',
    stopUnknown: 'لم يُمسح بعد: لا تقول OpenStreetMap شيئًا عنه حتى الآن',
    stopSurvey: 'كيف تمسح موقفًا باستخدام StreetComplete',
    stopsCoverage: 'لا تظهر هنا إلا المواقف التي أضافها أحدهم إلى OpenStreetMap، لذلك لا تظهر مواقف كثيرة بعد.',
    stopSurveyRoute: 'اطبع ورقة مسح لخط كامل',
  },

  streets: {
    popupLabel: 'عن هذا المكان على الخريطة',
    detailsTitle: (style) =>
      ({
        memorials: 'نصب تذكاري',
        crashes: 'حادث',
        street_segments: 'مقطع شارع',
        transit_stops: 'موقف',
        transit_routes: 'خط',
        stop_amenities: 'مظلة ومقعد',
        city_trees: 'شجرة',
        amenity: 'كما هو مسجّل في OpenStreetMap',
        public_place: 'مكان',
        condition: 'بُلّغ عنه إلى 311',
        public_art: 'فن عام',
        traffic_stress: 'ضغط حركة المرور على الدراجات',
        parking_reports: 'مشكلات وقوف بُلّغ عنها',
        city_shelters: 'مظلة حافلات',
        street_poles: 'عمود شارع',
        traffic_calming: 'تهدئة حركة المرور',
        crossing_guards: 'حارس عبور مدرسي',
        redlining: 'خريطة "الخط الأحمر" (redlining) لعام 1937',
      } as Record<string, string>)[style] ?? 'تفاصيل',
    memorialTitle: 'في الذكرى',
    peopleHere: (n) =>
      `نتذكّر هنا ${plural(n, { one: 'شخصًا واحدًا', two: 'شخصين', few: '# أشخاص', many: '# شخصًا', other: '# شخص' })}`,
    killed: {
      walk: 'قُتل أثناء المشي',
      bike: 'قُتل أثناء ركوب دراجة',
      scooter: 'قُتل أثناء ركوب سكوتر',
      motorcycle: 'قُتل أثناء ركوب دراجة نارية',
      other: 'قُتل في حادث مروري',
    },
    killedOn: (what, date) => `${what} في ${date}.`,
    memorialSource: 'اقرأ التأبين العام',
    blessing: 'فقط بمباركة العائلة.',
    families: 'تدعم منظمة Families for Safe Streets العائلات بعد وقوع حادث.',
    canDo: 'ما يمكن للجيران فعله هنا',
    firstStep: 'أول خطوة',
    cost: (cost) => `التكلفة: ${cost}`,
    memorialsNearby: 'نُصُب تذكارية قريبة',
    memorialsInView: 'نُصُب تذكارية ظاهرة',
    memorialsIntro: 'يخلّد كل منها ذكرى شخص قُتل في حادث مروري. افتح أحدها لتقرأ المزيد.',
    memorialCount: (n) => count(n, MEMORIAL),
    memorialsMore: (n) =>
      plural(n, {
        one: 'يظهر نصب تذكاري واحد إضافي. قرّب الخريطة لإدراجه هنا.',
        two: 'يظهر نصبان تذكاريان إضافيان. قرّب الخريطة لإدراجهما هنا.',
        few: 'تظهر # نُصُب تذكارية إضافية. قرّب الخريطة لإدراجها هنا.',
        many: 'يظهر # نصبًا تذكاريًا إضافيًا. قرّب الخريطة لإدراجها هنا.',
        other: 'يظهر # نصب تذكاري إضافي. قرّب الخريطة لإدراجها هنا.',
      }),
    memorialsLayerOff: 'شغّل طبقة النُّصُب التذكارية لسرد النُّصُب الظاهرة.',
    memorialsNone: 'لا نُصُب تذكارية في هذا الجزء من الخريطة.',
    blocksNearby: 'مقاطع الشوارع القريبة',
    blocksInView: 'مقاطع الشوارع الظاهرة',
    blocksIntro: 'كل مقطع مرسوم على الخريطة، مع أولوية سلامة الشارع فيه وسببها الرئيسي. افتح أحدها لتقرأ لماذا.',
    blockCount: (n) => count(n, BLOCK),
    blockNoScore: 'لا درجة لسلامة الشارع.',
    blocksMore: (n) =>
      plural(n, {
        one: 'يظهر مقطع شارع واحد إضافي. قرّب الخريطة لإدراجه هنا.',
        two: 'يظهر مقطعا شارع إضافيان. قرّب الخريطة لإدراجهما هنا.',
        few: 'تظهر # مقاطع شوارع إضافية. قرّب الخريطة لإدراجها هنا.',
        many: 'يظهر # مقطع شارع إضافي. قرّب الخريطة لإدراجها هنا.',
        other: 'يظهر # مقطع شارع إضافي. قرّب الخريطة لإدراجها هنا.',
      }),
    blocksLayerOff: (layer) => `شغّل طبقة "${layer}" لسرد مقاطع الشوارع الظاهرة.`,
    blocksNone: 'لا تُرسم أي مقاطع شوارع في هذا الجزء من الخريطة.',
    crashesNearby: 'حوادث قريبة',
    crashesInView: 'حوادث ظاهرة',
    crashesIntro: 'من سجلات حوادث PennDOT، كما تختارها إعدادات طبقة الحوادث. افتح أحدها لتقرأ المزيد.',
    crashCount: (n) => count(n, CRASH),
    crashesMore: (n) =>
      plural(n, {
        one: 'يظهر حادث واحد إضافي. قرّب الخريطة لإدراجه هنا.',
        two: 'يظهر حادثان إضافيان. قرّب الخريطة لإدراجهما هنا.',
        few: 'تظهر # حوادث إضافية. قرّب الخريطة لإدراجها هنا.',
        many: 'يظهر # حادثًا إضافيًا. قرّب الخريطة لإدراجها هنا.',
        other: 'يظهر # حادث إضافي. قرّب الخريطة لإدراجها هنا.',
      }),
    crashNear: (street) => `بالقرب من ${street}`,
    crashesNone: 'لا تُرسم أي حوادث في هذا الجزء من الخريطة.',
    removal: 'طلب إزالة',
    removalNote: (hasEmail) =>
      hasEmail
        ? 'يستطيع أي شخص أن يطلب منا إزالة هذا النصب التذكاري، عبر بريد إلكتروني خاص. ونفعل ذلك دون أن نسأل عن السبب.'
        : 'يستطيع أي شخص أن يطلب منا إزالة هذا النصب التذكاري دون أن يذكر سببًا. سيتوفر قريبًا عنوان بريد إلكتروني خاص لذلك؛ وإلى أن يتوفر، تشرح صفحة "اتصل بنا" كيف تطلب ذلك في بلاغ على GitHub، يستطيع أي شخص قراءته.',
    crashTitle: (year) => `حادث في عام ${year}`,
    crashesHere: (n) => `${count(n, CRASH)} في هذا الموضع`,
    involved: 'من كان طرفًا في الحادث',
    involvedModes: {
      walk: 'شخص يمشي',
      bike: 'شخص يركب دراجة',
      motorcycle: 'شخص على دراجة نارية',
      scooter: 'شخص على سكوتر',
    },
    involvedOthers: 'أشخاص في سيارات أو مركبات أخرى',
    crashSource: 'من سجلات حوادث PennDOT.',
    segmentScore: (score, lens) => `${lens}: ${score} من 100 بحسب مزيج عدساتك`,
    segmentNoScore: 'لا درجة لسلامة الشارع لهذا المقطع.',
    onHin: 'ضمن شبكة الشوارع الأكثر إصابات',
    ksi: (n) =>
      `${plural(n, {
        one: 'شخص واحد قُتل أو أُصيب إصابة جسيمة',
        two: 'شخصان قُتلا أو أُصيبا إصابة جسيمة',
        few: '# أشخاص قُتلوا أو أُصيبوا إصابة جسيمة',
        many: '# شخصًا قُتلوا أو أُصيبوا إصابة جسيمة',
        other: '# شخص قُتلوا أو أُصيبوا إصابة جسيمة',
      })} أثناء المشي أو ركوب الدراجات في هذا المقطع أو عند زواياه، في آخر خمس سنوات من سجلات PennDOT`,
    noKsi: 'لم يُسجَّل مقتل أو إصابة جسيمة لأحد أثناء المشي أو ركوب الدراجات هنا في آخر خمس سنوات من سجلات PennDOT',
    killed2: (n) =>
      plural(n, {
        one: 'قُتل شخص واحد هنا في آخر سنتين',
        two: 'قُتل شخصان هنا في آخر سنتين',
        few: 'قُتل # أشخاص هنا في آخر سنتين',
        many: 'قُتل # شخصًا هنا في آخر سنتين',
        other: 'قُتل # شخص هنا في آخر سنتين',
      }),
    school: 'مدرسة على بعد 400 متر أو أقل',
  },

  streetsStops: {
    shelterLegend: 'مظلة في قائمة المدينة، على شكل حلقة حول موقفها',
    shelterLegendLens: 'الموقف الذي فيه مظلة من المدينة يُحتسب مظلَّلًا في عدسة راحة النقل العام.',
    shelterLegendDate: 'آخر مرة غيّرت فيها المدينة قائمتها كانت في يناير 2025، لذلك قد تغيب مظلة أُقيمت أو أُزيلت بعد ذلك.',
    shelterTitle: 'مظلة حافلات في قائمة المدينة',
    shelterAt: (stop) => `تخدم موقف SEPTA رقم ${stop}.`,
    shelterListed: (number) => `تُدرجها المدينة برقم الموقف ${number}.`,
    shelterByNumber: 'رُبطت بموقف SEPTA عن طريق رقم الموقف في قائمة المدينة.',
    shelterByPlace: 'رُبطت بأقرب موقف SEPTA، على بعد 15 مترًا أو أقل: لا تذكر قائمة المدينة رقم موقف يناسبها.',
    shelterNoStop: 'لم نجد موقف SEPTA تخدمه: فهي تبعد أكثر من 15 مترًا عن كل موقف، أو أن موقفها أُغلق.',
    shelterDigital: 'لوحتها الإعلانية شاشة رقمية.',
    shelterLens: 'الموقف الذي تخدمه يُحتسب مظلَّلًا في عدسة راحة النقل العام.',
    shelterPartner: 'تقيم المدينة هذه المظلات وتصونها مع شريكها الإعلاني، وتغطي الإعلانات تكلفتها.',
    shelterSource: 'من قائمة المدينة لمظلات الحافلات (مكتب النقل ونظم البنية التحتية).',
    sheltersHere: (n) => `${count(n, SHELTER)} في هذا الموضع`,

    poleLed: 'مصباح LED تُدرجه المدينة',
    poleOther: 'مصباح أقدم من نوع الصوديوم عالي الضغط',
    poleUnknown: 'مصباح من نوع لا تحدده المدينة',
    poleNone: 'عمود بلا مصباح مُدرج، مثل عمود إشارة أو عمود خدمات',
    polesNote: 'المصابيح التي تُدرجها المدينة، وليس ما إذا كان المصباح يعمل الليلة. بلّغ Philly311 عن أي ضوء مطفأ.',
    polesZoom: 'قرّب الخريطة إلى بضعة مقاطع شوارع لترى الأعمدة.',
    poleTitle: (number) => (number ? `عمود شارع رقم ${number}` : 'عمود شارع بلا رقم مُدرج'),
    poleKind: {
      0: 'لا تُدرج المدينة أي مصباح على هذا العمود.',
      1: 'تُدرج المدينة مصباح LED على هذا العمود.',
      2: 'تُدرج المدينة مصباحًا أقدم من نوع الصوديوم عالي الضغط على هذا العمود.',
      3: 'تُدرج المدينة مصباحًا على هذا العمود، لكنها لا تذكر نوعه.',
    },
    poleOwner: {
      1: 'تملك إدارة الشوارع في المدينة هذا العمود.',
      2: 'تملك PECO هذا العمود.',
      3: 'تملك PennDOT هذا العمود.',
      4: 'يملك هذا العمود جهة غير المدينة أو PECO أو PennDOT.',
    },
    poleReport: (number) => `إن كان ضوء هنا مطفأً، أخبر Philly311 برقم العمود، ${number}.`,
    poleReportNoNumber: 'إن كان ضوء هنا مطفأً، أخبر Philly311 بمكانه.',
    polesHere: (n) => `${count(n, POLE)} في هذا الموضع`,
    poleSource: 'من قائمة إدارة الشوارع لأعمدة الشوارع، وتُحدَّث كل أسبوع.',

    calmingLegend: 'وسادة سرعة أو مطبّ أو مصطبة',
    calmingLegendNote: 'يستطيع الجيران أن يطلبوا من المدينة تهدئة حركة المرور في شارع سكني.',
    zoomStreets: 'قرّب الخريطة إلى بضعة أحياء لتراها.',
    calmingTitle: 'تهدئة حركة المرور',
    calmingWhat: 'وسادة سرعة أو مطبّ أو مصطبة تُدرجها إدارة الشوارع، لإبطاء السائقين.',
    calmingOn: (street) => `على ${street}`,
    calmingSince: (date) => `رُكّبت في ${date}.`,
    calmingHere: (n) => `${count(n, DEVICE)} في هذا الموضع`,
    calmingSource: 'من قائمة إدارة الشوارع لوسائل تهدئة حركة المرور.',

    guardLegend: 'زاوية تضع فيها المدينة حارس عبور مدرسيًا',
    guardLegendNote: 'يساعد حرّاس العبور الأطفال وغيرهم على عبور الشارع قرب المدارس في بداية اليوم الدراسي ونهايته.',
    guardTitle: 'حارس عبور مدرسي',
    guardHere: 'تضع المدينة حارس عبور مدرسيًا عند هذه الزاوية.',
    guardSchool: (school) => `أقرب مدرسة في قائمة المدينة، على بعد 400 متر أو أقل: ${school}.`,
    guardWhat: 'يساعد حرّاس العبور الأطفال وغيرهم على عبور الشارع بأمان قرب المدارس في بداية اليوم الدراسي ونهايته.',
    guardsHere: (n) => `${count(n, POST)} في هذا الموضع`,
    guardSource: 'من قائمة المدينة لمواقع حرّاس العبور المدرسيين.',

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `تُدرج المدينة ${count(poles, POLE)} على امتداد هذا المقطع، دون أي مصباح مُدرج ${poles === 1 ? 'عليه' : 'عليها'}.`
        : `تُدرج المدينة ${count(poles, POLE)} على امتداد هذا المقطع، منها ${formatNumber(lamps)} بمصباح، ${led === lamps ? (lamps === 1 ? 'وهو من نوع LED' : 'وكلها من نوع LED') : `${formatNumber(led)} منها من نوع LED`}.`,
    blockNoPoles: 'لا تُدرج المدينة أي أعمدة شوارع على امتداد هذا المقطع.',
    blockCalming: (n, year) =>
      year
        ? `تهدئة لحركة المرور هنا منذ ${year}: تُدرج المدينة ${count(n, CALMING)} على هذا المقطع.`
        : `تُدرج المدينة ${count(n, CALMING)} على هذا المقطع.`,
    blockNoCalming: 'لم تُسجَّل هنا أي تهدئة لحركة المرور حتى الآن.',
    blockArterial:
      'وسائد السرعة التي تضعها المدينة مخصصة للشوارع السكنية. وفي شارع مثل هذا، اسأل مكتب النقل ونظم البنية التحتية في المدينة عن تغييرات أخرى.',
    memorialCalming: (n, year) =>
      year
        ? `تهدئة لحركة المرور على هذا المقطع منذ ${year}: تُدرج المدينة ${count(n, DEVICE)}.`
        : `تُدرج المدينة ${count(n, CALMING)} على هذا المقطع.`,
    memorialNoCalming: 'لم تُسجَّل أي تهدئة لحركة المرور على هذا المقطع حتى الآن.',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `تُدرج المدينة ${count(poles, POLE)} على امتداد هذا المقطع، دون أي مصباح مُدرج.`
        : `على امتداد هذا المقطع تُدرج المدينة ${count(lamps, POLE)} بمصباح، ${led === lamps ? (lamps === 1 ? 'وهو من نوع LED' : 'وكلها من نوع LED') : `${formatNumber(led)} منها من نوع LED`}. شغّل طبقة "أعمدة الشوارع والمصابيح التي تُدرجها المدينة" وقرّب الخريطة لتجد رقم كل عمود.`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? 'لا تُدرج المدينة أي عمود بمصباح على بعد 30 مترًا أو أقل من هذا الموقف.'
        : `تُدرج المدينة ${count(lamps, POLE)} بمصباح على بعد 30 مترًا أو أقل من هذا الموقف، ${led === lamps ? (lamps === 1 ? 'وهو من نوع LED' : 'وكلها من نوع LED') : `${formatNumber(led)} منها من نوع LED`}.`,
    cityShelter: (n) => `في قائمة المدينة لمظلات الحافلات ${count(n, SHELTER)} هنا.`,
    noCityShelter: 'لا مظلة هنا في قائمة المدينة لمظلات الحافلات، وهي القائمة التي تضم المظلات التي تديرها المدينة مع شريكها الإعلاني.',
    disagree:
      'في قائمة المدينة مظلة هنا، لكن OpenStreetMap تقول إنه لا توجد مظلة. قد تكون إحداهما قديمة: والمسح يحسم الأمر. وإلى أن يتم ذلك تحتسب الأولوية مظلة المدينة.',
    cityShelterLens: 'تحتسب الأولوية مظلة المدينة.',
    answerCityShelter: 'لم يُمسح بعد في OpenStreetMap، لكنه في قائمة المدينة',
  },

  parking: {
    kinds: {
      all: 'مركبات تسد الطريق',
      sidewalk: 'على رصيف',
      bike_lane: 'في مسار دراجات',
      crosswalk: 'على معبر مشاة',
      corner: 'على زاوية',
      ramp: 'تسد منحدر الرصيف',
    },
    window: (start, end) => `من ${start} إلى ${end}`,
    windowUnknown: 'على مدى 12 شهرًا',
    heatTitle: (window) => `عند التصغير: أين تتجمع البلاغات. ${window}.`,
    fewer: 'بلاغات أقل',
    more: 'بلاغات أكثر',
    binsTitle: 'عند التقريب: البلاغات في كل منطقة بحجم مقطع شارع تقريبًا',
    bins: (low, high) => (high === null ? `${formatNumber(low)} أو أكثر` : `${formatNumber(low)} إلى ${formatNumber(high)}`),
    threshold: (min) =>
      `المناطق التي فيها أقل من ${count(min, REPORT)} تُستبعد، حتى لا يظهر أي بلاغ منفرد. قرّب الخريطة واضغط على منطقة لترى أعدادها.`,
    oneApp: 'المواضع التي أبلغ فيها أشخاص يستخدمون تطبيقًا واحدًا، هو Laser Vision من Philly Bike Action، عن مركبات تسد الطريق. لا يُبلَّغ عن كل مشكلة.',
    title: 'هذه المنطقة، بحجم مقطع شارع تقريبًا',
    summary: (n, window) => `${count(n, REPORT)} عن مركبات تسد الطريق. ${window}.`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `أقل من ${min}`,
    byKind: 'بحسب النوع',
    meaning:
      'هذه بلاغات من أشخاص يستخدمون تطبيقًا واحدًا، لذلك تُظهر أين لاحظ هؤلاء الأشخاص مركبات تسد الطريق، وليست كل مشكلة. النوع الذي فيه أقل من 5 بلاغات هنا لا يُذكر برقم، حتى لا يظهر أي بلاغ منفرد.',
    fixes:
      'كثرة البلاغات في موضع واحد دليل على حلول مادية: توسيعات الأرصفة عند الزوايا، والأعمدة الواقية (bollards)، وإخلاء الزوايا من المركبات لتتحسن الرؤية، ومسارات الدراجات المحمية، ومناطق التحميل.',
    askCity: 'اسأل المدينة عن حل',
    source: 'من خريطة Laser Vision لدى Philly Bike Action',
    refreshed: 'يُعاد العدّ كل أسبوع، بإذن من Philly Bike Action.',
  },

  transit: {
    waitTitle: 'كم مرة تأتي حافلة أو قطار في منتصف النهار في أيام الأسبوع',
    waitBins: ['كل 10 دقائق أو أقل', 'كل 11 إلى 15 دقيقة', 'كل 16 إلى 30 دقيقة', 'كل 31 إلى 60 دقيقة', 'أقل من مرة في الساعة'],
    noMidday: 'لا خدمة من 10 صباحًا إلى 2 ظهرًا في أيام الأسبوع',
    boardingsTitle: 'من يصعدون هنا في يوم أسبوع عادي',
    boardingBins: ['1,000 أو أكثر', '200 إلى 999', '50 إلى 199', '10 إلى 49', 'أقل من 10'],
    noCount: 'لا يوجد عدّ من SEPTA لهذا الموقف',
    boardingsNote: 'من أعداد SEPTA نفسها، وهي متأخرة موسمًا أو موسمين عن الجداول.',
    station: 'محطة مترو الأنفاق أو El أو Regional Rail',
    zoomNote: 'قرّب الخريطة إلى بضعة أحياء لترى المواقف.',
    lensTitle: 'الأولوية بحسب عدسة راحة النقل العام',
    lensUnsurveyed: 'حيث لم يمسح أحد موقفًا بعد، تُحتسب مظلته ومقعده بالنصف.',
    lensCityShelter: 'الموقف الذي فيه مظلة في قائمة المدينة يُحتسب مظلَّلًا.',
    lensStations: 'تقيّم العدسة مواقف الحافلات والترام فقط، لذلك تظهر المحطات فارغة.',
    lensTunnel: 'مواقف الترام في النفق تحت Center City وUniversity City فارغة أيضًا: تستبعدها العدسة، كما تستبعد المحطات.',
    findTitle: 'ما يجده الركاب هنا',
    notInOsm: 'لم نجد موقفًا مطابقًا في OpenStreetMap بعد، لذلك لم يسجّل أحد ما إذا كان فيه مظلة أو مقعد.',
    matchedByNumber: 'رُبط بموقف OpenStreetMap الذي يحمل رقم الموقف نفسه، في المكان نفسه.',
    matchedByPlace: 'رُبط بموقف OpenStreetMap في المكان نفسه، على بعد 15 مترًا أو أقل.',
    halfway: 'الإجابات التي لم تُمسح بعد تُحتسب بالنصف (50 من 100) في الدرجة إلى أن يسجّلها أحد.',
    canopy: (percent) =>
      `تغطي مظلة الأشجار نحو ${formatNumber(percent)} في المئة من الأرض حول الموقف، في منطقة بعرض مقطعي شارع تقريبًا (مسح المدينة لمظلة الأشجار لعام 2018).`,
    onHin: 'الموقف على شبكة الشوارع الأكثر إصابات، وهي الشوارع التي تقع فيها معظم الوفيات والإصابات الجسيمة المرورية في فيلادلفيا.',
    noScore: 'تقيّم عدسة راحة النقل العام مواقف الحافلات والترام فقط.',
    tunnelStation: 'موقف الترام هذا تحت الأرض، في النفق، لذلك تستبعده عدسة راحة النقل العام، كما تستبعد محطات المترو والقطار.',
    answersLoading: 'جارٍ تحميل ما تقوله OpenStreetMap عن هذا الموقف.',
    answersUnavailable: 'تعذّر تحميل ما تقوله OpenStreetMap عن هذا الموقف الآن، لذلك تُحتسب مظلته ومقعده على أنهما لم يُمسحا بعد.',
    canDo: 'ما يمكن للجيران فعله هنا',
    routeDetails: 'الخطوات وجهات الاتصال والروابط',
    surveyGuide: 'كيف تمسح موقفًا باستخدام StreetComplete',
    osmSource: 'المظلة والمقعد والإضاءة من OpenStreetMap، © OpenStreetMap contributors، وتُحدَّث كل أسبوع.',
    routeBus: 'خط حافلة',
    routeTrolley: 'خط ترام',
    routeMetro: 'مترو الأنفاق أو El',
    routeRail: 'Regional Rail',
    allRoutes: 'حيث تشترك عدة خطوط في شارع واحد، تقع خطوطها فوق بعضها.',
    frequentRoutes: 'فقط الخطوط التي فيها حافلة أو قطار كل 15 دقيقة أو أقل في منتصف النهار في أيام الأسبوع.',
    detailsTitle: 'موقف',
    stationName: (name) => `محطة ${name}`,
    stopsHere: (n) => `${count(n, STOP)} في هذا الموضع`,
    kinds: {
      bus: 'موقف حافلة',
      trolley: 'موقف ترام',
      busTrolley: 'موقف حافلة وترام',
      metro: 'محطة مترو أنفاق أو El',
      rail: 'محطة Regional Rail',
    },
    vehicles: { bus: 'حافلة', trolley: 'ترام', busTrolley: 'حافلة أو ترام', train: 'قطار' },
    vehiclesMany: { bus: 'حافلات', trolley: 'ترام', busTrolley: 'حافلات أو ترام', train: 'قطارات' },
    routes: (list) => `الخطوط: ${list}.`,
    route: (name) => `الخط ${name}.`,
    howOften: 'كم مرة',
    every: (vehicle, minutes) =>
      minutes <= 1 ? `${vehicle} تقريبًا كل دقيقة` : `${vehicle} تقريبًا كل ${count(minutes, MINUTE)}`,
    only: (one, many, n) => {
      if (n === 1) return `${one} واحد${one === 'حافلة' ? 'ة' : ''} فقط`;
      const dual: Record<string, string> = {
        حافلات: 'حافلتان',
        ترام: 'ترامان',
        'حافلات أو ترام': 'حافلتان أو ترامان',
        قطارات: 'قطاران',
      };
      return n === 2 ? `${dual[many] ?? many} فقط` : `${formatNumber(n)} ${many} فقط`;
    },
    peak: (text) => `صباح أيام الأسبوع من 7 إلى 9: ${text}.`,
    midday: (day, text) => `${day} من 10 صباحًا إلى 2 ظهرًا: ${text}.`,
    noService: (day) => `${day} من 10 صباحًا إلى 2 ظهرًا: لا خدمة.`,
    days: { wk: 'أيام الأسبوع', sa: 'أيام السبت', su: 'أيام الأحد' },
    trips: (wk, sa, su) =>
      `في يوم أسبوع عادي: ${count(wk, DEPARTURE)}. أيام السبت: ${formatNumber(sa)}. أيام الأحد: ${formatNumber(su)}.`,
    busiest: (n) => `أكثر ساعة ازدحامًا في أيام الأسبوع: ${count(n, DEPARTURE)}.`,
    firstLast: (first, last) => `في أيام الأسبوع تنطلق أول رحلة في ${first} وآخر رحلة في ${last}.`,
    afterMidnight: (time) => `${time} بعد منتصف الليل`,
    allNight: 'تعمل الخدمة طوال الليل في أيام الأسبوع.',
    evening: (n) =>
      n === 0 ? 'لا رحلات بعد الساعة 8 مساءً في أيام الأسبوع.' : `بعد الساعة 8 مساءً في أيام الأسبوع: ${count(n, DEPARTURE)}.`,
    noWeekday: 'لا خدمة في أيام الأسبوع.',
    riders: 'الركاب',
    boardings: (n, period) =>
      n === 0
        ? `لا يكاد أحد يصعد هنا في يوم أسبوع عادي (عدّ SEPTA، ${period}).`
        : `يصعد هنا نحو ${count(n, PERSON)} في يوم أسبوع عادي (عدّ SEPTA، ${period}).`,
    countedAt: (id) => `عُدّ عند موقف SEPTA رقم ${id}، الذي حلّ هذا الموقف محله.`,
    noBoardings: 'ليس لدى SEPTA عدّ لهذا الموقف بعد. تحصل المواقف الجديدة والمعاد ترقيمها على عدّ حين تنشر SEPTA عدّها التالي.',
    noStationCounts: 'لا تنشر SEPTA أعدادًا لكل رصيف في مترو الأنفاق أو El.',
    noRailCounts: 'تعدّ SEPTA ركاب Regional Rail بحسب المحطة مرة في السنة؛ ولا تعرض هذه الخريطة تلك الأعداد بعد.',
    stopNumber: (id) => `رقم موقف SEPTA ${id}.`,
    formerNumbers: (ids) => `كان قبل ذلك موقف SEPTA رقم ${ids}.`,
    wheelchair: {
      1: 'تذكر SEPTA أن هذا الموقف يمكن الوصول إليه بكرسي متحرك.',
      2: 'تذكر SEPTA أن هذا الموقف لا يمكن الوصول إليه بكرسي متحرك.',
    },
    source: 'من جداول SEPTA لأسبوع عادي. أوقات الانتظار متوسطات: تتجمع الحافلات معًا وتتسع الفجوات.',
  },

  stopAmenities: {
    unnamed: 'موقف بلا اسم في OpenStreetMap',
    number: (ref) => `رقم الموقف ${ref}`,
    served: { 1: 'موقف حافلة', 2: 'موقف ترام', 3: 'موقف حافلة وترام' },
    comfort: {
      3: 'مظلة، أو أن الموقف كله تحت سقف',
      2: 'مقعد، لكن لا مظلة مسجّلة على الخريطة',
      1: 'لا مظلة ولا مقعد',
      0: 'لم يُمسح بعد',
    },
    factsTitle: 'ما تقوله OpenStreetMap',
    answers: {
      sh: 'مظلة',
      bn: 'مقعد',
      bi: 'سلة مهملات',
      lt: 'مضاء ليلًا',
      tp: 'رصف لمسي للمكفوفين',
      wc: 'إمكانية الوصول بكرسي متحرك',
      db: 'لوحة مواعيد الانطلاق',
      cv: 'الموقف كله تحت سقف',
    },
    yes: 'نعم',
    no: 'لا',
    limited: 'محدود',
    unknown: 'لم يُمسح بعد',
    nearby: 'مسجّل على الخريطة وحده بجانب الموقف',
    unknownNote: 'لم يُمسح بعد تعني أن أحدًا لم يسجّله حتى الآن. ولا تعني أن الموقف خالٍ من أي شيء.',
    survey: 'كيف تمسح هذا الموقف باستخدام StreetComplete',
    openOsm: 'اعرض هذا الموقف على OpenStreetMap',
    surveyRoute: 'امسح خطًا كاملًا بورقة قابلة للطباعة',
    source: 'من OpenStreetMap، © OpenStreetMap contributors، وتُحدَّث كل أسبوع.',
  },

  heat: {
    tractsTitle: {
      vulnerability: 'قابلية التأثر بالحرارة: الحرارة والأشخاص المعرّضون للخطر، بحسب منطقة التعداد',
      exposure: 'التعرّض للحرارة: مدى سخونة كل منطقة تعداد في الصيف',
      sensitivity: 'الحساسية للحرارة: كم من الناس في كل منطقة تعداد معرّضون للخطر في الحر',
    },
    fifths: {
      vulnerability: ['الخُمس الأقل تأثرًا من المناطق', 'أقل تأثرًا', 'الخُمس الأوسط', 'أكثر تأثرًا', 'الخُمس الأكثر تأثرًا'],
      exposure: ['الخُمس الأبرد من المناطق', 'أبرد', 'الخُمس الأوسط', 'أسخن', 'الخُمس الأسخن'],
      sensitivity: ['الخُمس الأقل أشخاصًا معرّضين للخطر', 'أقل', 'الخُمس الأوسط', 'أكثر', 'الخُمس الأكثر أشخاصًا معرّضين للخطر'],
    },
    priority: 'بإطار: مناطق تصنفها المدينة بدرجة عالية جدًا في قابلية التأثر بالحرارة',
    tractsNone: 'المناطق التي لا يذكرها المؤشر، مثل الحدائق الكبيرة والمطار، تُترك فارغة.',
    tractsSource: 'من مؤشر المدينة لقابلية التأثر بالحرارة (إدارة الصحة العامة ومكتب الاستدامة)، بيانات 2017 إلى 2019.',
    treeBig: 'شجرة تابعة للمدينة: كلما كبرت النقطة اتسع جذعها',
    treeSmall: 'شجرة صغيرة، غالبًا فتية تحتاج إلى سقي',
    treesZoom: 'قرّب الخريطة إلى بضعة مقاطع شوارع لترى الأشجار.',
    treesYards: 'الأشجار في الأفنية الخاصة ليست في قائمة المدينة، لذلك قد يكون المقطع أكثر ظلًّا مما يبدو هنا.',
    floodHigh: 'سهل الفيضان بنسبة احتمال سنوية 1 في المئة: احتمال حدوث فيضان لا يقل عن 1 من 100 كل عام',
    floodway: 'مجرى الفيضان: القناة التي تُترك مفتوحة ليمر الفيضان',
    floodModerate: 'منطقة احتمال سنوي 0.2 في المئة: احتمال 1 من 500 كل عام',
    floodCare:
      'سبب للعناية، وليس جزءًا من أي درجة: يجب أن تتحمل النباتات هناك الأرض المبتلة، وأي بناء يتبع قواعد المدينة لسهول الفيضان.',
    treeUnnamed: 'شجرة لا تذكر القائمة اسمها',
    treeTrunk: (inches) => `عرض جذعها نحو ${count(inches, INCH)} عند مستوى الصدر.`,
    treeNoTrunk: 'لا تذكر القائمة حجم جذعها.',
    treeYoung: 'الشجرة الفتية تحتاج إلى نحو 20 غالونًا من الماء في الأسبوع من مارس إلى ديسمبر، بحسب TreePhilly.',
    treesHere: (n) => `${count(n, TREE)} في هذا الموضع`,
    treeSource: 'من قائمة أشجار إدارة الحدائق والترفيه، وهي الأشجار التي تعتني بها المدينة في شوارعها وحدائقها.',
  },

  art: {
    legend: {
      mural: 'جداريات ورسوم على الجدران',
      sculpture: 'منحوتات وتماثيل',
      mosaic: 'فسيفساء',
      other: 'أنواع أخرى: أعمال تركيبية ونوافير ونُصُب وغيرها',
    },
    allOff: 'كل أنواع الفن متوقفة في إعدادات هذه الطبقة.',
    insideHidden: 'الأعمال داخل المباني مخفية.',
    memorialNote: 'الأعمال الفنية التي تُخلّد ذكرى شخص تُعرض بلا أسماء.',
    coverage:
      'من قائمة المدينة "Percent for Art" وOpenStreetMap وWikidata. كثير من الجداريات ليس فيها بعد؛ وتحتفظ Mural Arts Philadelphia بأكبر قائمة على موقعها.',
    kinds: {
      0: 'عمل فني عام',
      1: 'جدارية',
      2: 'لوحة',
      3: 'فن الشارع',
      4: 'فسيفساء',
      5: 'منحوتة',
      6: 'تمثال',
      7: 'تمثال نصفي',
      8: 'نقش بارز',
      9: 'عمل تركيبي',
      10: 'نافورة',
      11: 'نصب',
      12: 'عمل تذكاري',
      13: 'زجاج ملوّن',
      14: 'لوحة تذكارية',
    },
    untitled: 'لم يُسجَّل له عنوان.',
    by: (artist) => `من أعمال ${artist}.`,
    made: (year) => `صُنع عام ${year}.`,
    medium: (medium) => `مصنوع من: ${medium}.`,
    where: (place) => `المكان: ${place}.`,
    inside: 'داخل مبنى، لذلك لا يمكن رؤيته إلا حين يكون المبنى مفتوحًا.',
    memorialTitle: 'عمل فني تذكاري',
    memorialText: 'هذا العمل الفني يُخلّد ذكرى شخص. لا يعرض Placekeepers أي أسماء على الأعمال التذكارية؛ وتقول المصادر أدناه المزيد عنه.',
    worksHere: (n) => `${count(n, WORK)} في هذا الموضع`,
    sourcesTitle: 'المصادر',
    cityRecord: 'سجل المدينة لهذا العمل (PDF)',
    cityList: 'قائمة المدينة "Percent for Art"',
    openOsm: 'اعرضه على OpenStreetMap',
    openWikidata: 'اعرضه على Wikidata',
    openWikipedia: 'اقرأ عنه على Wikipedia',
    website: (site) => `المزيد عنه على ${site}`,
    siteNames: {
      'associationforpublicart.org': 'موقع Association for Public Art',
      'muralarts.org': 'موقع Mural Arts Philadelphia',
      'philart.net': 'philart.net',
    },
    muralArts: 'ابحث في قائمة Mural Arts Philadelphia نفسها للجداريات',
    fix: 'هل هناك شيء ناقص أو خاطئ؟ أضفه أو صححه على OpenStreetMap؛ وتصل التغييرات إلى هذه الخريطة خلال نحو أسبوع.',
    fixLink: 'حرّر على OpenStreetMap',
    credit: 'فن عام من مدينة فيلادلفيا وOpenStreetMap (© OpenStreetMap contributors) وWikidata.',
  },

  // @@NEXT@@
};

export default ar;
