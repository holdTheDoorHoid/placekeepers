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
import { distanceWords } from '../../strings.ts';

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
const ROUTE: Nouns = { one: 'خط واحد', two: 'خطان', few: 'خطوط', many: 'خطًا', other: 'خط' };
const REQUEST: Nouns = { one: 'طلب واحد', two: 'طلبان', few: 'طلبات', many: 'طلبًا', other: 'طلب' };
const MILE: Nouns = { one: 'ميل واحد', two: 'ميلان', few: 'أميال', many: 'ميلًا', other: 'ميل' };
const LANE: Nouns = { one: 'مسار واحد', two: 'مساران', few: 'مسارات', many: 'مسارًا', other: 'مسار' };
const STREET: Nouns = { one: 'شارع واحد', two: 'شارعان', few: 'شوارع', many: 'شارعًا', other: 'شارع' };
const PROPERTY: Nouns = { one: 'عقار واحد', two: 'عقارين', few: 'عقارات', many: 'عقارًا', other: 'عقار' };
const DEED: Nouns = { one: 'صك واحد', two: 'صكين', few: 'صكوك', many: 'صكًّا', other: 'صك' };
const MOVE: Nouns = { one: 'عملية نقل واحدة', two: 'عمليتا نقل', few: 'عمليات نقل', many: 'عملية نقل', other: 'عملية نقل' };
const RECORD: Nouns = { one: 'سجل واحد', two: 'سجلان', few: 'سجلات', many: 'سجلًّا', other: 'سجل' };
const PICTURE_SERVICE: Nouns = { one: 'خدمة صور واحدة', two: 'خدمتا صور', few: 'خدمات صور', many: 'خدمة صور', other: 'خدمة صور' };
const OVERLAY: Nouns = { one: 'نطاق إضافي واحد', two: 'نطاقان إضافيان', few: 'نطاقات إضافية', many: 'نطاقًا إضافيًا', other: 'نطاق إضافي' };
const HEARING: Nouns = { one: 'جلسة استماع واحدة', two: 'جلستا استماع', few: 'جلسات استماع', many: 'جلسة استماع', other: 'جلسة استماع' };
const TAX_YEAR: Nouns = { one: 'سنة ضريبية واحدة', two: 'سنتين ضريبيتين', few: 'سنوات ضريبية', many: 'سنة ضريبية', other: 'سنة ضريبية' };
const TIME: Nouns = { one: 'مرة واحدة', two: 'مرتين', few: 'مرات', many: 'مرة', other: 'مرة' };
const VIOLATION: Nouns = { one: 'مخالفة مفتوحة واحدة', two: 'مخالفتين مفتوحتين', few: 'مخالفات مفتوحة', many: 'مخالفة مفتوحة', other: 'مخالفة مفتوحة' };
const OLDER_RECORD: Nouns = { one: 'سجل أقدم واحد', two: 'سجلان أقدم', few: 'سجلات أقدم', many: 'سجلًّا أقدم', other: 'سجل أقدم' };
const MORE_RECORD: Nouns = { one: 'سجل إضافي واحد', two: 'سجلين إضافيين', few: 'سجلات إضافية', many: 'سجلًّا إضافيًا', other: 'سجل إضافي' };
const MORE_SOURCE: Nouns = { one: 'مصدر إضافي واحد', two: 'مصدران إضافيان', few: 'مصادر إضافية', many: 'مصدرًا إضافيًا', other: 'مصدر إضافي' };
const GARDEN: Nouns = { one: 'حديقة مجتمعية واحدة', two: 'حديقتان مجتمعيتان', few: 'حدائق مجتمعية', many: 'حديقة مجتمعية', other: 'حديقة مجتمعية' };
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
    confidence: { 1: 'لسنا متأكدين كثيرًا من أنها فارغة', 2: 'من المرجح أنها فارغة', 3: 'من المرجح جدًا أنها فارغة' },
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
    hexIntro: (window) => `من تعرّضوا لإطلاق نار في كل شكل سداسي، ${window}`,
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
        : `يصعد هنا نحو ${plural(n, { one: 'شخص واحد', two: 'شخصين', few: '# أشخاص', many: '# شخصًا', other: '# شخص' })} في يوم أسبوع عادي (عدّ SEPTA، ${period}).`,
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

  survey: {
    pageTitle: 'امسح خطًا',
    intro:
      'اختر خط حافلة أو ترام من SEPTA واتجاهًا لتحصل على ورقة مسح: مواقفه في فيلادلفيا بالترتيب، وما تعرضه OpenStreetMap عند كل موقف الآن، وخانات لتعبئتها. اطبعها، أو علّم الخانات على هاتفك أثناء سيرك.',
    guideLink: 'كيف تمسح مواقف الحافلات',
    loading: 'جارٍ تحميل الخطوط…',
    loadFailed: 'تعذّر تحميل قائمة الخطوط. تحقق من اتصالك وحاول مرة أخرى.',
    notPublished: 'أوراق المسح لم تُنشر بعد. تظهر بعد التحديث الأسبوعي التالي.',
    sheetFailed: 'تعذّر تحميل ورقة هذا الخط. تحقق من اتصالك وحاول مرة أخرى.',
    retry: 'حاول مرة أخرى',
    routeLabel: 'الخط',
    routePlaceholder: 'اختر خطًا',
    buses: 'خطوط الحافلات',
    trolleys: 'خطوط الترام',
    directionLabel: 'الاتجاه',
    partsLabel: 'التقسيم بين',
    partsChoice: (n) =>
      plural(n, { one: 'شخص واحد أو زوج', two: 'شخصين أو زوجين', few: '# أشخاص أو أزواج', many: '# شخصًا أو زوجًا', other: '# شخص أو زوج' }),
    directionTo: (dir, to) => `${dir} إلى ${to}`,
    towards: (to) => `باتجاه ${to}`,
    directionNumber: (n) => `الاتجاه ${n}`,
    stopCount: (n) => count(n, STOP),
    title: (route, direction) => `الخط ${route}، ${direction}`,
    summary: (stops, miles) => `${count(stops, STOP)} في فيلادلفيا، والمسافة ${miles} من الأول إلى الأخير في خطوط مستقيمة.`,
    outside: (n) =>
      plural(n, {
        one: 'يقع موقف واحد إضافي خارج فيلادلفيا وليس في هذه الورقة.',
        two: 'يقع موقفان إضافيان خارج فيلادلفيا وليسا في هذه الورقة.',
        few: 'تقع # مواقف إضافية خارج فيلادلفيا وليست في هذه الورقة.',
        many: 'يقع # موقفًا إضافيًا خارج فيلادلفيا وليست في هذه الورقة.',
        other: 'يقع # موقف إضافي خارج فيلادلفيا وليست في هذه الورقة.',
      }),
    answersMissing:
      'تعذّر تحميل ما تقوله OpenStreetMap عند هذه المواقف الآن، لذلك تظهر المواقف التي تعرفها على أنها لم تُمسح بعد.',
    statusTitle: 'ما تعرضه OpenStreetMap الآن',
    status: {
      shelter: 'مظلة',
      bench: 'مقعد فقط',
      neither: 'لا هذا ولا ذاك',
      unsurveyed: 'لم يُمسح بعد',
      missing: 'لم يوجد في OpenStreetMap',
    },
    statusLong: {
      shelter: 'فيه مظلة أو سقف',
      bench: 'فيه مقعد ولا مظلة مسجّلة على الخريطة',
      neither: 'لا مظلة فيه ولا مقعد',
      unsurveyed: 'في OpenStreetMap لكنه لم يُمسح بعد',
      missing: 'لم يوجد في OpenStreetMap',
    },
    estimateTitle: 'كم يستغرق',
    estimate: (time) => `تقديرنا: ${time} لشخص واحد أو زوج.`,
    estimateBasis:
      'هذا تقدير منا وليس قياسًا: مشي بسرعة نحو 3 أميال في الساعة من موقف إلى موقف، ودقيقة تقريبًا عند كل موقف. والوصول إلى أول موقف والعودة إلى البيت وقت إضافي.',
    trolleyTunnel:
      'تسير خطوط الترام من T1 إلى T5 تحت الأرض عند طرفها في Center City، في نفق فيه محطات من شارع 13 إلى شارع 37. اترك تلك المحطات: هذا المسح لمواقف الشارع.',
    asOf: (osm, schedules) =>
      [osm ? `ما تعرضه OpenStreetMap هو حتى ${osm}.` : null, schedules ? `المواقف من جداول SEPTA (${schedules}).` : null]
        .filter(Boolean)
        .join(' '),
    print: 'اطبع الورقة',
    printAll: 'اطبع كل الأجزاء',
    printPart: (n) => `اطبع الجزء ${n} فقط`,
    part: (n, of) => `الجزء ${n} من ${of}`,
    partStops: (first, last) => (first === last ? `الموقف ${first}` : `المواقف من ${first} إلى ${last}`),
    partEstimate: (time, miles) => `تقديرنا: ${time} (${miles} من المشي).`,
    sheetFor: (route, direction) => `ورقة المسح: الخط ${route}، ${direction}`,
    howToFill:
      'ضع علامة في خانة "نعم" أو "لا" لكل شيء تجده في الموقف. "مضاء" تعني أن ضوءًا يسطع على الموقف ليلًا: مصباح في المظلة أو مصباح شارع بجانبها مباشرة. "يحتاج إلى إصلاح" تعني مظلة أو مقعدًا أو لافتة أو سلة مهملات مكسورة. إن لم تستطع أن تحدد، فاترك الخانة فارغة: من فضلك لا تخمّن أبدًا.',
    nameLine: 'الاسم:',
    dateLine: 'التاريخ:',
    columns: {
      number: '#',
      stop: 'الموقف',
      now: 'OpenStreetMap الآن',
      sh: 'مظلة',
      bn: 'مقعد',
      bi: 'سلة مهملات',
      lt: 'مضاء',
      rp: 'يحتاج إلى إصلاح',
      nt: 'ملاحظات',
    },
    yes: 'نعم',
    no: 'لا',
    yesShort: 'نعم',
    noShort: 'لا',
    stopNumber: (sid) => `موقف SEPTA رقم ${sid}`,
    answerLabel: (n, name, question, answer) => `الموقف ${n}، ${name}: ${question}، ${answer}`,
    repairLabel: (n, name) => `الموقف ${n}، ${name}: يحتاج إلى إصلاح`,
    notesLabel: (n, name) => `الموقف ${n}، ${name}: ملاحظات`,
    openOsm: 'اعرض على OpenStreetMap',
    editOsm: 'تحرير',
    answered: (n, of) => `ما ملأته على هذا الجهاز: ${formatNumber(n)} من ${count(of, STOP)}.`,
    kept: 'ما تعلّم عليه وتكتبه هنا يبقى في هذا المتصفح وعلى هذا الجهاز فقط. لا يُرسل شيء إلى أي مكان.',
    notKept: 'لا يحتفظ هذا المتصفح بما تعلّم عليه، لذلك سيضيع إن غادرت الصفحة. اطبع الورقة أو دوّنها.',
    clear: 'امسح ما ملأته',
    clearConfirm: 'هل تريد مسح كل خانة وملاحظة ملأتها لهذا الاتجاه؟',
    safetyTitle: 'قبل أن تذهب: حافظ على سلامتك',
    safety: [
      'ابقَ على الرصيف. لا تقف أبدًا في الشارع ولا تخطُ إلى مسار الحافلات لتنظر إلى موقف.',
      'اذهب في ضوء النهار، واذهب مع صديق.',
      'توقف عن المشي قبل أن تنظر إلى هذه الورقة أو إلى هاتفك، وارفع نظرك قبل أن تعبر.',
      'ابتعد قليلًا ليتمكن الركاب من الانتظار والصعود. لا تصوّر الناس.',
    ],
    answersTitle: 'كيف تصل إجاباتك إلى OpenStreetMap',
    withApp: 'مع تطبيق StreetComplete: أجب عن أسئلته بشأن كل موقف وأنت واقف فيه. تذهب إجاباتك مباشرة إلى OpenStreetMap.',
    withoutApp: 'بدون تطبيق على الهاتف، وعلى حاسوب حين تعود إلى البيت، استخدم محرر OpenStreetMap نفسه:',
    editorSteps: [
      'سجّل الدخول على openstreetmap.org. الحساب مجاني.',
      'افتح هذه الصفحة من جديد واستخدم رابط "تحرير" بجانب كل موقف. يُفتح المحرر والموقف محدد.',
      'في اللوحة على اليسار، انقر خانة Shelter. تحت "Add field:" أضف Bench وWaste Bin (سلة المهملات) وLit، وانقر خاناتها أيضًا. تتغير كل خانة مع كل نقرة: Yes ثم No ثم Unknown من جديد.',
      'انقر Save، واكتب ملاحظة قصيرة عما فعلت، مثل "Surveyed bus stop shelters and benches"، ثم انقر Upload.',
    ],
    notFound:
      'حيث تقول الورقة "لم يوجد في OpenStreetMap"، انظر جيدًا حول الموقف في المحرر أولًا: فقد يكون مرسومًا على بعد خطوات قليلة. فإن كان مفقودًا فعلًا، انقر Point، وضع النقطة على الرصيف بجانب لافتة الموقف، واختر Bus Stop.',
    repairNote:
      'لا تسجّل OpenStreetMap الأضرار، لذلك تبقى "يحتاج إلى إصلاح" وملاحظاتك مع مجموعتك. وهي تفيدك حين تتحدث مع SEPTA أو المدينة عن موقف.',
    updates: 'يقرأ Placekeepers بيانات OpenStreetMap كل يوم اثنين، فتصل إجاباتك إلى خريطتنا وإلى هذه الأوراق خلال نحو أسبوع.',
    printedFrom: 'طُبعت من Placekeepers، خريطة مجانية لجيران فيلادلفيا. المواقف من SEPTA؛ بيانات الخريطة © OpenStreetMap contributors.',
    routeTitle: (route) => `الخط ${route}`,
    routesHere: (n) => `${count(n, ROUTE)} هنا`,
    surveyThisRoute: 'امسح مواقف هذا الخط بحثًا عن المظلات والمقاعد',
  },

  amenities: {
    legend: {
      benches: 'مقعد',
      picnic_tables: 'طاولة نزهة',
      drinking_water: 'ماء للشرب',
      toilets: 'مرحاض عام',
      bookcases: 'مكتبة صغيرة مجانية (Little Free Library)',
    },
    mappedNote: 'لا يظهر هنا إلا ما أضافه الناس إلى OpenStreetMap، لذلك ينقص الكثير.',
    addMissing: 'كيف تضيف ما هو ناقص',
    titles: {
      benches: 'مقعد',
      picnic_tables: 'طاولة نزهة',
      drinking_water: 'ماء للشرب',
      toilets: 'مرحاض عام',
      bookcases: 'مكتبة صغيرة مجانية',
    },
    facts: {
      br: ['له مسند ظهر', 'بلا مسند ظهر'],
      cv: ['تحت سقف', 'ليس تحت سقف'],
      bt: ['يمكن ملء زجاجة هنا', 'لا يصلح لملء زجاجة'],
      sn: ['في جزء من السنة فقط', 'طوال السنة'],
      in: ['في الداخل', 'في الخارج'],
      fee: ['توجد رسوم', 'مجاني'],
      ct: ['فيه طاولة لتغيير الحفاضات', 'بلا طاولة لتغيير الحفاضات'],
    },
    access: { 1: 'مفتوح للجميع', 2: 'للزبائن فقط' },
    wheelchair: {
      1: 'يمكن الوصول إليه بكرسي متحرك',
      0: 'لا يمكن الوصول إليه بكرسي متحرك',
      2: 'وصول محدود بكرسي متحرك',
    },
    hours: (text) => `ساعات العمل كما هي مسجّلة على الخريطة: ${text}`,
    nothingMore: 'لا تقول OpenStreetMap المزيد عنه حتى الآن.',
    unknownNote: 'كل ما لم يُذكر غير معروف بعد. وهذا لا يعني أن الجواب لا.',
    openOsm: 'اعرضه على OpenStreetMap',
    fix: 'ناقص أو خاطئ؟ كيف تصححه',
    source: 'كما هو مسجّل في OpenStreetMap، © OpenStreetMap contributors، ويُحدَّث كل أسبوع.',
  },

  places: {
    legend: {
      park_water: 'نافورة شرب في حديقة',
      libraries: 'فرع من Free Library',
      recreation_centers: 'مركز ترفيهي',
      playgrounds: 'ملعب أطفال',
    },
    poolLegend: { 1: 'مسبح', 2: 'منطقة ألعاب مائية', 3: 'رشاش مياه' },
    notInService: 'خارج الخدمة هذا العام',
    poolsShown: {
      in_service: 'لا يُعرض إلا ما هو في الخدمة هذا العام.',
      all: 'الدوائر المجوّفة خارج الخدمة هذا العام.',
    },
    recreationKinds: {
      1: 'مركز ترفيهي',
      2: 'مركز لكبار السن',
      3: 'مركز للتثقيف البيئي',
    },
    poolKinds: { 1: 'مسبح', 2: 'منطقة ألعاب مائية', 3: 'رشاش مياه' },
    waterKinds: { 1: 'نافورة شرب', 2: 'محطة لملء الزجاجات' },
    status: { 1: 'في الخدمة هذا العام', 0: 'خارج الخدمة هذا العام' },
    statusUnknown: 'لا تذكر إدارة الحدائق والترفيه ما إذا كان في الخدمة هذا العام.',
    indoor: { 1: 'في الداخل', 0: 'في الخارج' },
    waterIndoor: 'داخل مبنى: مفتوح حين يكون المبنى مفتوحًا.',
    accessible: { 1: 'مُدرج على أنه ميسَّر لذوي الإعاقة', 0: 'غير مُدرج على أنه ميسَّر' },
    opened: (date) => `افتُتح للموسم في ${date}.`,
    gym: 'فيه صالة رياضية.',
    noBuilding: 'موقع برنامج بلا مبنى خاص به.',
    inPark: (park) => `في ${park}.`,
    phone: (number) => `الهاتف: ${number}`,
    libraryPage: 'ساعات العمل والفعاليات على موقع Free Library',
    seasonNote: 'تفتح المسابح في الصيف فقط. اسأل إدارة الحدائق والترفيه عن ساعات هذا الأسبوع.',
    source: {
      libraries: 'من قائمة المدينة لمواقع Free Library of Philadelphia.',
      parks: 'من إدارة الحدائق والترفيه في فيلادلفيا، كما تنشرها المدينة.',
    },
    cooling: {
      legendOpen: 'موقع للتدفئة أو للتبريد مُدرج على أنه مفتوح',
      legendClosed: 'مُدرج على أنه مغلق، أو بلا حالة',
      kindShown: {
        any: 'مواقع للطقس الحار وللطقس البارد.',
        cooling: 'مواقع التبريد فقط، للطقس الحار.',
        warming: 'مواقع التدفئة فقط، للطقس البارد.',
      },
      asListed: (copied, changed) =>
        `${copied ? `كما أدرجتها المدينة في ${copied}` : 'كما أدرجتها المدينة حين نسخت هذه الخريطة القائمة آخر مرة'}${changed ? ` (آخر تغيير للقائمة كان في ${changed})` : ''}. ليست مباشرة: تفتح المواقع وتغلق بحسب الطقس، فاتصل بالموقع أو برقم 311 قبل أن تذهب.`,
      oneMarker: 'المكتبة أو المركز الترفيهي الذي هو أيضًا موقع للتدفئة أو للتبريد يظهر مرة واحدة، على أنه موقع.',
      kinds: {
        1: 'فرع Free Library',
        2: 'موقع تابع لإدارة الحدائق والترفيه',
        3: 'شريك مجتمعي',
        4: 'مركز مجتمعي تابع لهيئة الإسكان في فيلادلفيا',
      },
      title: 'موقع للتدفئة أو التبريد',
      status: { 1: 'مُدرج على أنه مفتوح', 0: 'مُدرج على أنه مغلق' },
      statusUnknown: 'لا حالة مُدرجة',
      both: 'مُدرج كموقع للتدفئة وللتبريد',
      cooling: 'مُدرج كموقع للتبريد',
      warming: 'مُدرج كموقع للتدفئة',
      neither: 'غير مُدرج كموقع للتدفئة أو للتبريد',
      hours: (hours) => `الساعات كما هي مُدرجة: ${hours}`,
      services: (services) => `ما يقدمه، كما هو مُدرج: ${services}`,
      capacity: (n) => `السعة: ${count(n, PERSON)}، كما هي مُدرجة`,
      water: 'فيه محطة مياه',
      restroom: 'فيه دورة مياه عامة',
      also: {
        lib: (name) => `يظهر أيضًا على الخريطة كفرع من Free Library: ${name}.`,
        rec: (name) => `يظهر أيضًا على الخريطة كموقع تابع لإدارة الحدائق والترفيه: ${name}.`,
      },
      alsoSite: 'تُدرجه المدينة أيضًا كموقع للتدفئة أو للتبريد.',
    },
    playgrounds: {
      kind: 'ملعب أطفال',
      ages: { 1: 'للأعمار من 2 إلى 5', 2: 'للأعمار من 5 إلى 12', 3: 'للأعمار من 2 إلى 12' },
      installed: (year) => `رُكّب عام ${year}`,
    },
  },

  conditions: {
    legend: {
      dumping: 'إلقاء نفايات بصورة غير قانونية',
      dark_lights: 'ضوء شارع أو زقاق مطفأ',
      graffiti: 'كتابات على الجدران (غرافيتي)',
    },
    legendOpen: (what) => `${what}: طلب ما زال مفتوحًا`,
    legendClosed: (what) => `${what}: كل الطلبات مغلقة`,
    legendSize: 'الدائرة الأكبر تعني طلبات أكثر في ذلك المقطع.',
    legendWindow: 'طلبات إلى Philly311 خلال آخر 90 يومًا، تُعدّ بحسب المقطع، وليس بحسب العنوان.',
    openOnly: 'لا تُعرض إلا المقاطع التي فيها طلب ما زال مفتوحًا.',
    titles: {
      dumping: 'بُلّغ عن إلقاء نفايات بصورة غير قانونية',
      dark_lights: 'بُلّغ عن أضواء مطفأة',
      graffiti: 'بُلّغ عن كتابات على الجدران',
    },
    summary: (n, open) =>
      `${count(n, REQUEST)} إلى Philly311 خلال آخر 90 يومًا، ${open === 0 ? 'لا يوجد منها مفتوح' : `${formatNumber(open)} منها ما زال مفتوحًا`}.`,
    newest: (date) => `أحدثها قُدِّم في ${date}.`,
    alley: (n, total) =>
      n === total ? (n === 1 ? 'كان عن ضوء زقاق.' : 'كلها كانت عن أضواء أزقة.') : `${formatNumber(n)} منها عن ضوء زقاق.`,
    block: (street) => `على هذا المقطع من ${street}.`,
    byBlock: 'تُعدّ بحسب المقطع، وليس بحسب العنوان، ولا يُعرض شيء عمّن قدّم البلاغ.',
    meaning: 'يدل الطلب على أن أحدًا لاحظ وطلب مساعدة المدينة. وبعض المقاطع تطلب أكثر من غيرها.',
    report: 'بلّغ Philly311',
    source: 'من سجلات 311 لدى المدينة (Philly311)، وتُحدَّث كل أسبوع.',
  },

  walk: {
    walkTitle: {
      index: 'مدى صلاحية كل منطقة للمشي (مؤشر EPA لصلاحية المشي)',
      corners: 'زوايا الشوارع: مدى ترابط الشوارع (EPA)',
      transit: 'مدى قرب أقرب موقف نقل عام (EPA)',
      mix: 'مدى تنوع المنازل والوظائف والمتاجر (EPA)',
    },
    walkCompared: {
      city: 'مقارنة داخل فيلادلفيا: يضم كل لون نحو خُمس مجموعات كتل المدينة.',
      nation: 'مقارنة بالبلد كله، إذ ترتّب EPA كل مجموعة كتل في الولايات المتحدة.',
    },
    walkFifths: {
      index: ['الخُمس الأقل صلاحية للمشي', 'أقل صلاحية', 'الخُمس الأوسط', 'أكثر صلاحية', 'الخُمس الأكثر صلاحية للمشي'],
      corners: ['أقل الزوايا', 'أقل', 'الخُمس الأوسط', 'أكثر', 'أكثر الزوايا'],
      transit: ['الأبعد عن النقل العام', 'أبعد', 'الخُمس الأوسط', 'أقرب', 'الأقرب إلى النقل العام'],
      mix: ['الأقل تنوعًا', 'أقل تنوعًا', 'الخُمس الأوسط', 'أكثر تنوعًا', 'الأكثر تنوعًا'],
    },
    walkNationFifths: ['الخُمس الأدنى في البلد', 'دون المتوسط', 'الخُمس الأوسط', 'فوق المتوسط', 'الخُمس الأعلى في البلد'],
    walkClasses: [
      'الأقل صلاحية للمشي: مؤشر من 1 إلى 5.75',
      'دون المتوسط: من 5.76 إلى 10.5',
      'فوق المتوسط: من 10.51 إلى 15.25',
      'الأكثر صلاحية للمشي: من 15.26 إلى 20',
    ],
    walkNationNote:
      'مقارنةً بالبلد كله، تقع فيلادلفيا كلها تقريبًا فوق المتوسط أو بين الأكثر صلاحية للمشي، لذلك تُظهر المقارنة داخل المدينة فروقها بصورة أفضل.',
    walkParts:
      'يتراوح المؤشر من 1 إلى 20. تشكّل زوايا الشوارع والنقل العام ثلث المؤشر لكل منهما، ويشكّل كل من مقياسي تنوع المنازل والوظائف والمتاجر سدسه.',
    walkSource: 'من قاعدة بيانات الموقع الذكي (Smart Location Database) لدى وكالة حماية البيئة الأمريكية (EPA) لعام 2021، المبنية على بيانات من نحو 2017 إلى 2019.',

    reachTitle: {
      people: 'السكان الذين يعيشون على بعد مشي 5 دقائق (تعداد 2020)',
      places: 'أنواع الأماكن اليومية على بعد مشي 10 دقائق',
      corners: 'زوايا الشوارع على بعد مشي 5 دقائق',
    },
    reachBins: {
      people: ['أقل من 1,000 شخص', '1,000 إلى 2,499', '2,500 إلى 3,999', '4,000 إلى 5,999', '6,000 أو أكثر'],
      places: ['نوعان أو أقل من الأنواع السبعة', '3 أو 4 أنواع', '5 أنواع', '6 أنواع', 'كل الأنواع السبعة'],
      corners: ['أقل من 10 زوايا', '10 إلى 24', '25 إلى 49', '50 إلى 74', '75 أو أكثر'],
    },
    reachKinds:
      'الأنواع السبعة: مكتبة، ومركز ترفيهي، ومسبح أو منطقة ألعاب مائية عاملة، ونافورة شرب في حديقة، ومدرسة، ومتجر بقالة أو سوق يقبل SNAP (مساعدات الغذاء)، وموقف حافلة أو ترام أو قطار.',
    reachCorners:
      'الزاوية هي المكان الذي يلتقي فيه ثلاثة شوارع أو أكثر يمكن للناس المشي عليها. الزوايا الأكثر تعني مقاطع أقصر وطرقًا أكثر للوصول إلى مكان ما سيرًا على الأقدام.',
    reachMeasured:
      'تُحسب من منتصف كل شكل سداسي في خط مستقيم: 400 متر لمشي 5 دقائق، و800 لمشي 10 دقائق. وهذا يصل أبعد قليلًا من المشي على الشوارع، ويعبر خطوط السكك الحديدية والطرق السريعة والأنهار.',
    reachSource: {
      people: 'السكان من تعداد 2020، يُعدّون بحسب الكتلة.',
      places: 'الأماكن من المدينة وإدارة الحدائق والترفيه ووزارة الزراعة الأمريكية (USDA) وSEPTA. الأماكن الواقعة خلف حدود المدينة مباشرة لا تُحسب.',
      corners: 'الزوايا من محاور شوارع المدينة.',
    },

    stressLevels: {
      1: 'المستوى 1: هادئ بما يكفي لمعظم الناس من كل الأعمار',
      2: 'المستوى 2: مناسب لمعظم البالغين',
      3: 'المستوى 3: للراكبين الواثقين فقط',
      4: 'المستوى 4: لأجرأ الراكبين فقط',
    },
    stressShown: {
      stressful: 'لا تُعرض إلا الشوارع المجهدة، المستويان 3 و4.',
      calm: 'لا تُعرض إلا الشوارع الهادئة، المستويان 1 و2.',
    },
    stressZoom: 'عند التصغير، تعرض الخريطة الشوارع المجهدة والشوارع التي فيها مسار دراجات أو ممر. قرّب الخريطة لترى كل شارع.',
    stressSource:
      'من شبكة مستوى ضغط حركة المرور (Level of Traffic Stress) التي أعدّتها لجنة التخطيط الإقليمي لوادي ديلاوير (DVRPC): تُقيَّم بحسب المسارات وسرعة المرور ونوع مسار الدراجات، وليس بقيادة الدراجة في كل شارع.',
    stressTitle: (level) => `المستوى ${level} من 4`,
    stressMeaning: {
      1: 'هادئ بما يكفي لمعظم الناس من كل الأعمار، والأطفال أيضًا.',
      2: 'مناسب لمعظم البالغين: قدر قليل من ضغط حركة المرور.',
      3: 'لا يشعر بالراحة هنا إلا الراكبون الواثقون.',
      4: 'حركة مرور مزدحمة وسريعة: لأجرأ الراكبين فقط.',
    },
    stressOtherWay: (level) => `السير في الاتجاه الآخر أهدأ: المستوى ${level}.`,
    facilities: {
      0: 'لا مسار دراجات',
      1: 'مسار دراجات مُشار إليه بلافتات',
      2: 'علامات مسار مشترك (sharrows)',
      3: 'مسار دراجات',
      4: 'مسار دراجات بحاجز فاصل',
      5: 'مسار دراجات محمي',
      6: 'ممر أو طريق بعيد عن حركة المرور',
    },
    stressSpeed: (mph) => `تسير حركة المرور بسرعة نحو ${count(mph, MILE)} في الساعة، بحسب حد السرعة أو تقدير DVRPC.`,
    stressLanes: (n) => `${count(n, LANE)} في المجموع.`,
    streetsHere: (n) => `${count(n, STREET)} هنا`,
    stressDetailsSource: 'من شبكة مستوى ضغط حركة المرور لدى DVRPC، وتُقيَّم بحسب المسارات والسرعات ومسارات الدراجات.',
  },

  landBank: {
    pageTitle: 'Land Bank بالأرقام',
    back: 'العودة إلى الخريطة',
    intro:
      'كم عقارًا نقلت Philadelphia Land Bank وجهات الأراضي الأخرى في المدينة ملكيته، سنة بعد سنة، من سجلات صكوك المدينة نفسها. أعداد ومجاميع فقط: بلا أسماء وبلا عناوين.',
    loading: 'جارٍ تحميل الأرقام',
    loadFailed: 'تعذّر تحميل الأرقام. تحقق من اتصالك وحاول مرة أخرى.',
    retry: 'حاول مرة أخرى',
    missing: 'لم تُنشر الأرقام بعد. تظهر بعد التحديث الأسبوعي التالي للبيانات.',
    noStatus: 'بلا حالة',
    agencyLabel: 'الجهة',
    agencyHelp: 'كل قسم أدناه يتبع هذا الاختيار، ما عدا أعداد المدينة نفسها بحسب البرنامج والعدّ الأسبوعي للقطع المُدرجة.',
    agencies: {
      all: 'الجهات الأربع كلها',
      PLB: 'Philadelphia Land Bank',
      PRA: 'هيئة إعادة التطوير',
      PHDC: 'PHDC',
      PUB: 'مدينة فيلادلفيا',
    },
    agencyLong: {
      all: 'جهات الأراضي الأربع معًا',
      PLB: 'Philadelphia Land Bank',
      PRA: 'هيئة إعادة التطوير في فيلادلفيا (Philadelphia Redevelopment Authority)',
      PHDC: 'Philadelphia Housing Development Corporation (PHDC)',
      PUB: 'مدينة فيلادلفيا',
    },
    headline: (agency, n, deeds, from, to) =>
      `في سجلات صكوك المدينة من ${from} إلى ${to}، نقلت ${agency} ملكية ${count(n, PROPERTY)} بموجب ${count(deeds, DEED)}.`,
    movedAll: (n) =>
      `غير محسوبة: ${count(n, MOVE)} لعقار من جهة إلى أخرى، مثل نقله من المدينة إلى Land Bank.`,
    moved: (received, handed) =>
      `واستلمت أيضًا ${count(received, PROPERTY)} من الجهات الأخرى، وسلّمت إليها ${formatNumber(handed)}. لا تُحسب عمليات النقل هذه على أنها نقل ملكية.`,
    whatCounts:
      'نقل الملكية هنا هو صك من جهة أراضٍ إلى طرف من خارج الجهات الأربع: شخص أو شركة أو منظمة غير ربحية أو جهة عامة أخرى مثل Philadelphia Housing Authority. يُحسب كل عقار مرة واحدة. وتُستبعد التصحيحات وإلغاء القيود القديمة وعمليات النقل بين الجهات والاتفاقيات المسجّلة كصكوك.',
    partial: (year, date) => `يمتد عام ${year} حتى ${date} فقط: سجلات صكوك المدينة متأخرة نحو ثمانية أسابيع.`,
    noNames: 'نقرأ أسماء المشترين فقط لنميّز الشخص من الشركة ولنفحص المنزل المجاور. ولا نحتفظ بأي منها.',
    showNumbers: 'اعرض الأرقام',
    tableLabel: (what) => `الأرقام: ${what}`,
    downloadCsv: 'تنزيل CSV',
    year: 'السنة',
    total: 'المجموع',
    properties: 'العقارات',
    chartLabel: (what, from, to, max) => `${what}، من ${from} إلى ${to}. أعلى سنة فيها ${max}. الأرقام نفسها في الجدول أسفل الرسم.`,
    perYear: {
      title: 'عمليات نقل الملكية في كل سنة',
      caption: 'العقارات التي نُقلت ملكيتها في كل سنة. قد ينقل صك واحد ملكية عقارات كثيرة.',
      deeds: 'الصكوك',
    },
    buyers: {
      title: 'من هم المشترون',
      caption:
        'نوع كل مشترٍ، كما يُقرأ من الاسم المسجّل في الصك. لا تُعدّ المنظمة غير ربحية كذلك إلا حين يقول اسمها ذلك؛ وكثير من المنظمات غير الربحية أسماؤها كأسماء الشركات فتُعدّ شركات.',
      groups: {
        individual: 'أشخاص',
        company: 'شركات',
        nonprofit: 'منظمات غير ربحية',
        public: 'جهات عامة أخرى',
        unknown: 'غير واضح',
      },
      share: (label, pct) => `${label}: ${pct}%`,
      shares: 'حصة كل العقارات التي نُقلت ملكيتها في هذه السنوات',
    },
    programs: {
      title: 'بحسب البرنامج',
      caption:
        'لا تقول الصكوك عبر أي برنامج تمت عملية نقل الملكية. ويمكن استنتاج واحد منها: القطعة الواحدة التي تنتقل ملكيتها إلى شخص يملك منزلًا يلاصقها هي على الأرجح فناء جانبي أو خلفي. يعدّ هذا الرسم تلك القطع، وهو استنتاج منا. أما الباقي فلا نعرفه من السجلات، وهذا لا يعني أنها لم تكن أفنية جانبية.',
      series: 'أفنية جانبية أو خلفية، استنتاجنا',
      checked:
        'كيف تحققنا (9 أكتوبر 2026): بحثنا يدويًا عن 10 من هذه القطع، سُحبت عشوائيًا من 2019 إلى 2026. في القطع العشر كلها المشتري هو المالك المسجّل للمنزل المجاور للقطعة أو الذي خلفها، ويستلم بريده هناك. أما ما إذا كانت كل واحدة منها قد جاءت عبر برنامج الفناء الجانبي فما زال استنتاجنا.',
      compare: (cityTotal, ours, oursPlb, from, to) =>
        `للسنوات المالية من ${from} إلى ${to} عدّت لوحة المدينة نفسها ${formatNumber(cityTotal)} فناءً جانبيًا. ومن الصكوك نستنتج ${formatNumber(ours)} من الجهات الأربع كلها، منها ${formatNumber(oursPlb)} من Land Bank.`,
      cityTitle: 'عدّ المدينة نفسها بحسب البرنامج',
      cityCaption: (edited) =>
        `من لوحة إدارة الأراضي لدى المدينة، بحسب السنة المالية (من يوليو إلى يونيو). آخر تحديث لها ${edited}، لذلك السنة الأخيرة غير مكتملة، وهي تعدّ المنازل التي بُنيت وليس العقارات، في الإسكان.`,
      fy: 'السنة المالية',
      sideYards: 'أفنية جانبية',
      gardens: 'حدائق أو مساحات مفتوحة',
      business: 'توسعة أعمال',
      homesBelow30: 'منازل، أقل من 30% من دخل المنطقة',
      homes60to80: 'منازل، من 60% إلى 80%',
      homes80to120: 'منازل، من 80% إلى 120%',
      homesMarket: 'منازل، بسعر السوق',
      oursPlb: 'استنتاجنا للأفنية الجانبية، Land Bank',
      oursAll: 'استنتاجنا للأفنية الجانبية، الجهات الأربع كلها',
      fyLabel: (fy) => `${fy - 1} إلى ${fy}`,
    },
    prices: {
      title: 'الأسعار المسجّلة في الصكوك',
      caption: (max) =>
        `السعر هو ما يسجّله الصك لكل عقار (حصته حين يشمل صك واحد عدة عقارات). وليس دائمًا مبلغًا مدفوعًا: بعض البرامج تبيع بسعر رمزي وتحمي استخدام القطعة برهن عقاري مدته 30 سنة، وصكوك الأفنية الجانبية كثيرًا ما تسجّل القيمة المقدّرة للقطعة. السعر الوسيط هو الذي نصف الأسعار دونه ونصفها فوقه. "رمزي" يعني ${max} أو أقل.`,
      priced: 'له سعر',
      median: 'السعر الوسيط',
      nominal: 'سعر رمزي',
      none: 'لا سعر مسجّل',
      summary: (median, pct) => `السعر الوسيط في هذه السنوات: ${median}. ${pct}% نُقلت ملكيتها بسعر رمزي.`,
    },
    districts: {
      title: 'بحسب دائرة المجلس',
      caption:
        'أين العقارات، بحسب حدود دوائر المجلس اليوم. تتغير حدود الدوائر بعد كل تعداد، لذلك توضع السنوات السابقة أيضًا بحسب حدود اليوم.',
      district: 'الدائرة',
      districtName: (n) => `الدائرة ${n}`,
      noLocation: 'لا موقع في السجلات',
      allYears: 'كل السنوات',
      chartLabel: 'العقارات التي نُقلت ملكيتها في كل دائرة من دوائر المجلس. الأرقام نفسها في الجدول أدناه.',
    },
    listed: {
      title: 'قطع الأراضي المُدرجة كمتاحة، أسبوعًا بعد أسبوع',
      caption: (from) =>
        `قائمة المدينة للممتلكات العامة، وهي القائمة نفسها التي تعرضها خريطة ممتلكات Land Bank، تُعدّ في كل أسبوع حُدِّثت فيه نسختنا منها. يبدأ العدّ في ${from}؛ ولا توجد أعداد أسبوعية أسبق.`,
      date: 'تاريخ القائمة',
      records: 'مُدرجة كمتاحة',
      parcels: 'القطع',
      sideYard: 'مفتوحة لجار كفناء جانبي',
      oneWeek: 'يظهر الرسم حين يتوفر أسبوعان للمقارنة.',
      byStatus: (date) => `كل قطعة في القائمة بحسب حالتها، ${date}`,
      status: 'الحالة',
      count: 'السجلات',
      chartLabel: (from, to) => `قطع الأراضي المُدرجة كمتاحة كل أسبوع، من ${from} إلى ${to}. الأرقام نفسها في الجدول أدناه.`,
      mapLink: 'خريطة Land Bank للعقارات المُدرجة',
    },
    limits: {
      title: 'ما لا تستطيع هذه الأرقام أن تُظهره',
      items: [
        'كم انتظر المتقدمون، وكم تقدّم، وكم رُفض طلبه. السجلات العامة تحتوي على الصكوك، وليس على الطلبات.',
        'البرنامج الذي وقف وراء معظم عمليات نقل الملكية. الصكوك لا تقول ذلك؛ والأفنية الجانبية والخلفية استنتاج منا، وأعداد المدينة نفسها بحسب البرنامج تتوقف في أبريل 2023.',
        'ما بُني أو زُرع بعد ذلك، أو ما إذا كانت قيود القطعة قد احتُرمت.',
        'ما دفعه المشتري في النهاية. الصك يسجّل سعرًا، وبعض البرامج تقرن سعرًا رمزيًا برهن عقاري مدته 30 سنة.',
        'الأراضي التي تؤجرها الجهات أو ترخّص بها، مثل اتفاقيات الحدائق. لا صك يسجّل ذلك.',
        'الصكوك قبل 2014، والصكوك الصادرة في آخر ثمانية أسابيع أو نحوها، التي لم تنشرها المدينة بعد.',
      ],
    },
    sources: {
      title: 'المصادر والتواريخ',
      deeds: (fetched, last) =>
        `الصكوك: مدينة فيلادلفيا، قسم السجلات، عمليات نقل العقارات، قُرئت في ${fetched}؛ وأحدث صك مؤرخ في ${last}.`,
      programs: (edited) =>
        `الأعداد بحسب البرنامج: مدينة فيلادلفيا، إدارة التخطيط والتنمية، لوحة إدارة الأراضي، آخر تحديث ${edited}.`,
      listed:
        'القطع المُدرجة: مدينة فيلادلفيا، إدارة التخطيط والتنمية (إدارة الأراضي)، كما تعرضها خريطة ممتلكات Philadelphia Land Bank.',
      districts: 'دوائر المجلس: مدينة فيلادلفيا، حدود اليوم.',
      neighbours: 'لاستنتاج الفناء الجانبي: قائمة المدينة بالمالكين (مكتب تقييم الممتلكات) وأشكال القطع (إدارة المياه).',
      board: 'جداول أعمال مجلس إدارة Land Bank، التي تسرد كل عملية تصرف بحسب البرنامج',
      council: 'تشريعات مجلس المدينة، حيث يوافق المجلس على كل عملية تصرف في Land Bank',
      method: 'كيف نعدّ، بالتفصيل',
      deedsLink: 'عمليات نقل العقارات لدى المدينة',
      programsLink: 'جدول لوحة إدارة الأراضي لدى المدينة',
    },
    csv: {
      years: (agency) => `عمليات نقل الملكية بحسب السنة والجهة (الجهات الأربع كلها وكل جهة على حدة؛ وقد عرضت هذه الصفحة ${agency}).`,
      districts: 'عمليات نقل الملكية بحسب دائرة المجلس (حدود اليوم) والسنة، للجهات الأربع كلها ولكل جهة على حدة.',
      programs: 'أعداد المدينة نفسها بحسب البرنامج والسنة المالية، بجانب استنتاجنا للأفنية الجانبية.',
      listed: 'القطع في قائمة المدينة للممتلكات العامة المُدرجة كمتاحة، كل أسبوع منذ بداية العدّ.',
      counts: 'أعداد فقط: بلا أسماء وبلا عناوين وبلا أرقام قطع.',
      dates: (fetched, last) => `قُرئت الصكوك في ${fetched}؛ وأحدث صك مؤرخ في ${last}.`,
      file: (part, day) => `placekeepers-land-bank-${part}-${day}.csv`,
    },
  },

  basemap: {
    missing: 'الخريطة الأساسية غير متاحة، لذلك الشوارع وأسماء الأماكن مخفية. ما زالت طبقات البيانات تعمل.',
    unavailable: 'الخريطة الأساسية غير متاحة هنا، لذلك تعرض الخريطة خلفية بسيطة.',
    legend: 'الشوارع والمباني والحدائق والمياه وأسماء الأماكن، بالألوان.',
    legendMuted: 'الشوارع والمباني والحدائق والمياه وأسماء الأماكن، بالرمادي، لتبرز البيانات.',
  },

  credits: {
    basemap:
      '<a href="https://protomaps.com" target="_blank" rel="noopener noreferrer">Protomaps</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
    data: (statusUrl) => `البيانات: مدينة فيلادلفيا و<a href="${statusUrl}">جهات أخرى</a>`,
  },

  status: {
    pageTitle: 'حالة البيانات',
    intro: 'يحدّث Placekeepers بياناته كل أسبوع. إذا تعطل مصدر، تحتفظ الخريطة بآخر نسخة جيدة وتقول ذلك هنا.',
    back: 'العودة إلى الخريطة',
    loading: 'جارٍ تحميل حالة البيانات',
    loadFailed: 'تعذّر علينا تحميل ملف حالة البيانات. قد تظل الخريطة تعمل ببيانات أقدم.',
    retry: 'حاول مرة أخرى',
    builtOn: (date) => `آخر تحديث: ${date}`,
    buildId: (id) => `الإصدار ${id}`,
    summaryAllOk: 'كل المصادر محدّثة.',
    summary: (stale, failing, missing) => {
      const parts: string[] = [];
      if (stale)
        parts.push(plural(stale, { one: 'مصدر واحد قديم', two: 'مصدران قديمان', few: '# مصادر قديمة', many: '# مصدرًا قديمًا', other: '# مصدر قديم' }));
      if (failing)
        parts.push(
          plural(failing, { one: 'مصدر واحد لا يعمل', two: 'مصدران لا يعملان', few: '# مصادر لا تعمل', many: '# مصدرًا لا تعمل', other: '# مصدر لا تعمل' }),
        );
      if (missing)
        parts.push(
          plural(missing, {
            one: 'مصدر واحد لم يُجلب بعد',
            two: 'مصدران لم يُجلبا بعد',
            few: '# مصادر لم تُجلب بعد',
            many: '# مصدرًا لم تُجلب بعد',
            other: '# مصدر لم تُجلب بعد',
          }),
        );
      return `${parts.join('، ')}.`;
    },
    statusLabel: {
      ok: 'محدّث',
      stale: 'قديم',
      failing: 'لا يعمل',
      missing: 'لم يُجلب بعد',
      unknown: 'غير معروف',
    },
    staleSince: (date) => `نستخدم آخر نسخة جيدة، من ${date}.`,
    staleNoDate: 'نستخدم آخر نسخة جيدة.',
    failingText: 'لا توجد نسخة صالحة للاستخدام الآن، لذلك قد تغيب الطبقات التي تحتاج إليها.',
    missingText: 'لم يُجلب هذا المصدر بعد.',
    unknownText: 'يُبلّغ ملف الحالة عن شيء لا نعرفه.',
    lastSuccess: (date) => `آخر تنزيل ناجح: ${date}`,
    neverSucceeded: 'لا تنزيل ناجح بعد',
    lastAttempt: (date) => `آخر محاولة: ${date}`,
    rows: (n) => count(n, RECORD),
    newest: (date) => `أحدث سجل: ${date}`,
    message: (text) => `ملاحظة من التحديث: ${text}`,
    publisher: 'الناشر',
    homepage: 'من أين يأتي',
    license: 'الترخيص',
    cadence: {
      daily: 'يحدّثه الناشر يوميًا',
      weekly: 'يحدّثه الناشر أسبوعيًا',
      monthly: 'يحدّثه الناشر شهريًا',
      yearly: 'يحدّثه الناشر سنويًا',
      irregular: 'يحدّثه الناشر بين حين وآخر',
      frozen: 'لم يعد الناشر يحدّثه',
    },
    problems: 'مشكلات في ملف الحالة',
    notesTitle: 'ملاحظات من آخر تحديث',
    notesInEnglish: 'هذه الملاحظات مكتوبة بالإنجليزية، للأشخاص الذين يشغّلون الخريطة.',
    basemapLabel: { ok: 'محدّث', failing: 'غير متاح' },
    basemapMade: (date) =>
      `يُنشئ التحديث الأسبوعي نسخة جديدة من الخريطة الأساسية مرة في الشهر تقريبًا. أُنشئت هذه النسخة من OpenStreetMap في ${date}.`,
    basemapNoDate: 'يُنشئ التحديث الأسبوعي نسخة جديدة من الخريطة الأساسية مرة في الشهر تقريبًا.',
    basemapMissing: 'الخريطة الأساسية غير متاحة في هذه النسخة من الموقع، لذلك تعرض الخريطة خلفية بسيطة. ما زالت طبقات البيانات تعمل.',
  },

  search: {
    label: 'ابحث عن عنوان أو تقاطع أو رقم قطعة',
    placeholder: 'عنوان أو تقاطع أو رقم قطعة',
    button: 'بحث',
    searching: 'جارٍ البحث',
    tooShort: 'اكتب عنوانًا، مثل 1234 Market St، أو شارعين يتقاطعان، مثل Broad and Girard.',
    notFound: 'تعذّر على المدينة العثور على ذلك المكان. جرّب رقم منزل واسم شارع، أو شارعين يتقاطعان، أو رقم قطعة من تسعة أرقام.',
    failed: (reason) => `خدمة العناوين لدى المدينة ${reason}. حاول مرة أخرى بعد قليل.`,
    liveOff:
      'يسأل البحث عن العناوين خدمة العناوين لدى المدينة، وبيانات المدينة الحية متوقفة في الإعدادات. ما زال بإمكانك البحث برقم قطعة من تسعة أرقام.',
    resultsTitle: 'اختر مكانًا',
    resultsCount: (n) =>
      plural(n, {
        one: 'مكان واحد مطابق',
        two: 'مكانان مطابقان',
        few: '# أماكن مطابقة',
        many: '# مكانًا مطابقًا',
        other: '# مكان مطابق',
      }),
    intersection: 'تقاطع',
    showing: (label) => `نعرض ${label} على الخريطة.`,
    noParcel: (label) => `نعرض ${label} على الخريطة. لا يوجد لدى المدينة سجل قطعة لهذا العنوان بالتحديد.`,
    privacy: 'تذهب عمليات البحث من متصفحك مباشرة إلى مدينة فيلادلفيا.',
  },

  pick: {
    looking: 'جارٍ البحث عن هذه القطعة لدى المدينة',
    nothing: 'لا توجد قطعة لدى المدينة في هذا الموضع. اضغط على قطعة أرض أو مبنى.',
    liveOff: 'لفتح قطعة ليست في قائمتنا، شغّل "جلب بيانات المدينة الحية" في الإعدادات.',
    failed: (reason) => `خريطة القطع لدى المدينة ${reason}. حاول مرة أخرى بعد قليل.`,
  },

  historic: {
    liveOff:
      'تأتي هذه الصور مباشرة من خوادم المدينة، لذلك لا يمكن تشغيلها إلا ما دام "جلب بيانات المدينة الحية" مشغّلًا (في الإعدادات، تحت "الخصوصية والبيانات الحية").',
    refused: 'تأتي الصور الجوية القديمة وأطلس 1860 من خوادم المدينة. شغّل بيانات المدينة الحية في الإعدادات لتراها.',
    serverError: 'لم يرسل خادم الصور لدى المدينة كل أجزاء هذه الصورة. حاول مرة أخرى لاحقًا.',
    photoYear: (year) => `الصورة الجوية لعام ${year}، التُقطت من طائرة.`,
    gaps1975: 'صور 1975 فيها فجوات في أقصى جنوب المدينة، حول المطار وساحة البحرية (Navy Yard).',
    termsNotStated: 'لا يذكر ناشرها شروط استخدام لهذه الصور؛ وهي تُعرض كما تستضيفها المدينة، مع نسبتها إلى مصدرها، وتُزال إذا طلب الناشر ذلك.',
    blackAndWhite: (year) => `صور ${year} بالأبيض والأسود.`,
    under: 'تقع الصورة تحت كل طبقة أخرى. خفّض قوتها لترى شوارع اليوم من خلالها.',
    atlasCoverage: 'يغطي الأطلس Center City وNorthern Liberties فقط.',
    atlasCredit: 'الأطلس مضبوط على خريطة اليوم بواسطة Greater Philadelphia GeoHistory Network، وتستضيفه مدينة فيلادلفيا بإذن منها.',
    sliderRange: (first, last) => `من ${first} إلى ${last}`,
    lotTitle: 'صور جوية قديمة',
    lotButton: 'شاهد هذه القطعة في صور جوية قديمة',
    lotHelp: (year) =>
      `يفتح الخريطة عند هذه القطعة مع الصورة الجوية لعام ${year}، وهي الأقدم في هذه الخريطة. مرّر بين السنوات التالية لها تحت "الماضي والحاضر" في الطبقات.`,
    lotLiveOff: 'تأتي الصور مباشرة من خوادم المدينة، لذلك تحتاج إلى بيانات المدينة الحية، وهي متوقفة.',
    shown: (year) => `الصور الجوية لعام ${year} قيد العرض. مرّر بين السنوات تحت "الماضي والحاضر" في الطبقات.`,
    statusOk: 'أجابت كل خدمات الصور في آخر فحص أسبوعي. تُحمَّل الصور مباشرة من خوادم المدينة حين يشغّل أحدهم طبقتها.',
    statusStale: (date) =>
      `في آخر فحص أسبوعي لم تُجب كل خدمات الصور، لذلك قد لا تظهر بعض الصور. آخر مرة أجابت فيها كلها كانت في ${date}.`,
    statusFailing: 'لم تُجب خدمات الصور في الفحص الأسبوعي، لذلك قد لا تظهر الصور.',
    services: (n) => `${count(n, PICTURE_SERVICE)} جرى فحصها`,
    lastCheck: (date) => `آخر فحص أجابت فيه كل الخدمات: ${date}`,
  },

  redlining: {
    detailsTitle: 'خريطة "الخط الأحمر" (redlining) لعام 1937',
    grades: {
      A: 'A، صُنّفت "الأفضل" في 1937',
      B: 'B، صُنّفت "ما زالت مرغوبة"',
      C: 'C، صُنّفت "في تراجع مؤكد"',
      D: 'D، صُنّفت "خطرة" وأُحيطت بخط أحمر: وهذا هو الخط الأحمر (redlining)',
    },
    ungraded: 'غير مصنّفة (أراضٍ صناعية وتجارية)',
    area: (label, grade) => `المنطقة ${label}، درجتها ${grade} في 1937`,
    areaUngraded: (label) => `${label}: منطقة تركتها خريطة 1937 بلا تصنيف`,
    context:
      'في عام 1937 صنّفت جهة اتحادية، هي Home Owners\' Loan Corporation، أحياء المدينة من A إلى D بحسب ما رأته من أمان الإقراض العقاري فيها. اعتمدت التصنيفات على من يسكن كل منطقة: فالمناطق التي تسكنها عائلات سوداء وعائلات مهاجرة كثيرة صُنّفت عادة D وأُحيطت بخط أحمر. وصعُب الحصول على القروض هناك لعقود، وتُسمى هذه الممارسة "الخط الأحمر" (redlining).',
    notToday: 'التصنيفات سجلّ لكيفية حكم جهة اتحادية على الأماكن في 1937. ولا تقول شيئًا عن الناس الذين يسكنون هناك اليوم.',
    legendTap: 'اضغط على منطقة لتعرف تصنيفها وتجد رابطًا لوصفها في 1937.',
    description: (label) => `اقرأ وصف المنطقة ${label} لعام 1937 على Mapping Inequality`,
    descriptionNote: 'أوصاف 1937 غير منسوخة هنا: فهي تبقى على Mapping Inequality، مع التاريخ المحيط بها.',
    credit:
      'المناطق والتصنيفات من Mapping Inequality: Redlining in New Deal America، من إعداد Robert K. Nelson وLaDale Winling وآخرين، Digital Scholarship Lab بجامعة ريتشموند. يعرض Placekeepers المناطق والتصنيفات فقط.',
    homepageLabel: 'Mapping Inequality: Philadelphia',
    nonCommercial: 'للاستخدام غير التجاري فقط. مرخّصة بموجب Creative Commons Attribution NonCommercial 2.5، بمعزل عن بقية بيانات الخريطة.',
    licenseLabel: 'CC BY-NC 2.5',
    statusNote: 'للاستخدام غير التجاري فقط: هذا المصدر مرخّص للاستخدام غير التجاري، لذلك ينشره الموقع في ملف خاص به ولا ينشره أبدًا في تنزيل.',
  },

  options: {
    title: 'الخصوصية والبيانات الحية',
    privacyLink: 'كيف يتعامل Placekeepers مع خصوصيتك',
    turnOn: 'تشغيل بيانات المدينة الحية',
    resetNote: 'اختيارك بشأن بيانات المدينة الحية يبقى كما هو.',
  },

  failure: {
    timeout: 'لم تردّ في الوقت المناسب',
    network: 'تعذّر الوصول إليها',
    http: 'ردّت بخطأ',
    bad_data: 'أرسلت إجابة لم نستطع قراءتها',
    not_found: 'ليس لديها سجل عنه',
    aborted: 'لم نسألها',
    empty: 'لم نسألها',
  },

  rulesMap: {
    legend: {
      district: 'حي تاريخي',
      property: 'في السجل التاريخي',
      overlay: 'نطاق تقسيم مناطق إضافي',
      supplemental: 'قاعدة خاصة أخرى في قانون تقسيم المناطق',
      hearingZoning: 'جلسة استماع بشأن تقسيم المناطق',
      hearingOther: 'جلسة استماع أمام مجلس آخر',
      brownfield: 'موقع براونفيلد لدى EPA',
    },
    notes: {
      historic: 'قد تحتاج التغييرات هنا إلى مراجعة لجنة الآثار التاريخية (Historical Commission)؛ اسألها أولًا.',
      overlays: 'تتداخل هذه النطاقات الإضافية، ويغطي بعضها معظم المدينة. اضغط على موضع لترى كل نطاق عنده.',
      hearings: 'اضغط على جلسة استماع لترى كيف تشارك ولتفتح صفحة القطعة.',
      brownfields: 'ليست خريطة لكل الأراضي الملوّثة. افحص التربة قبل زراعة الغذاء في موقع منها أو بالقرب منه.',
    },
    districtTitle: (name) => name,
    designated: (date) => `جرى تصنيفه في ${date}.`,
    noDate: 'لا تذكر طبقة المدينة يوم التصنيف.',
    propertyTitle: 'في سجل فيلادلفيا للأماكن التاريخية',
    listedOn: (date) => `أُدرج وحده في ${date}.`,
    listedAlone: 'أُدرج وحده.',
    inDistrict: (district, date) => `جزء من ${district}${date ? `، صُنّف في ${date}` : ''}.`,
    overlaysHere: (n) => `${count(n, OVERLAY)} هنا`,
    hearingTitle: (board) => `جلسة استماع: ${board}`,
    hearingWhen: (date, time) => `${date}${time ? `، الساعة ${time}` : ''}`,
    hearingsHere: (n) => `${count(n, HEARING)} هنا`,
    about: (address) => `عن ${address}.`,
    rco: (name) => `المنظمة المجتمعية المسجّلة التي أُبلغت: ${name}.`,
    openLot: 'افتح صفحة هذه القطعة',
    namesNote: 'من قدّم الطعن يظهر في صفحة القطعة فقط.',
    brownfieldTitle: 'موقع براونفيلد لدى EPA',
  },

  dossier: {
    pageTitle: 'صفحة القطعة',
    loading: 'جارٍ تحميل صفحة القطعة',
    parcel: (opa) => `حساب OPA ${opa}`,
    printButton: 'اطبع صفحة هذه القطعة',
    showOnMap: 'إظهار على الخريطة',
    close: 'إغلاق صفحة القطعة',
    clear: 'إلغاء التحديد',
    retry: 'جرّب المدينة مرة أخرى',
    notFound: 'تعذّر علينا العثور على هذه القطعة في سجلات المدينة أو في لقطتنا الأسبوعية.',
    noData: 'هذه القطعة ليست في لقطتنا الأسبوعية، وبيانات المدينة الحية متوقفة، لذلك لا يوجد ما نعرضه حتى الآن.',
    sections: {
      summary: 'ملخص',
      actions: 'ما يمكنك فعله',
      rules: 'قواعد هذه القطعة',
      owner: 'من يملكها',
      history: 'التاريخ',
      nearby: 'بالقرب',
      sources: 'المصادر وحداثة البيانات',
    },
    contents: 'في هذه الصفحة',

    provenance: {
      live: (time) => `مباشرة من المدينة في ${time}.`,
      snapshot: (date) => `من اللقطة الأسبوعية بتاريخ ${date}.`,
      snapshotNoDate: 'من اللقطة الأسبوعية.',
      map: 'من بيانات الخريطة الأسبوعية.',
      checking: 'جارٍ التحقق لدى المدينة من وجود سجلات أحدث.',
      asking: 'جارٍ سؤال المدينة.',
      failedSnapshot: (reason, date) => `خوادم المدينة ${reason}، لذلك هذه هي اللقطة الأسبوعية بتاريخ ${date}.`,
      failedNothing: (reason) => `خوادم المدينة ${reason}، لذلك لا يمكن عرض هذا الجزء الآن.`,
      offSnapshot: (date) => `بيانات المدينة الحية متوقفة، لذلك هذه هي اللقطة الأسبوعية بتاريخ ${date}.`,
      offNothing: 'بيانات المدينة الحية متوقفة، ولا تغطي لقطتنا الأسبوعية هذا الجزء.',
      none: 'لا سجلات لعرضها.',
    },
    banner: {
      live: 'مباشرة من مدينة فيلادلفيا.',
      loading: 'جارٍ التحقق لدى المدينة من أحدث السجلات.',
      off: (date) => `بيانات المدينة الحية متوقفة. تعرض هذه الصفحة اللقطة الأسبوعية بتاريخ ${date}.`,
      offNoDate: 'بيانات المدينة الحية متوقفة. تعرض هذه الصفحة اللقطة الأسبوعية.',
      partial: 'لم تنجح بعض عمليات البحث لدى المدينة. تعرض تلك الأجزاء اللقطة الأسبوعية، أو لا شيء، وتقول ذلك.',
      failed: 'لم تردّ خوادم المدينة. تعرض هذه الصفحة ما في لقطتنا الأسبوعية.',
    },

    summary: {
      kind: { lot: 'قطعة أرض فارغة', building: 'مبنى فارغ' },
      notListed: 'ليست في قائمتنا لقطع الأراضي والمباني الفارغة',
      notListedHelp: 'إذا كنت تعتقد أن هذه القطعة فارغة، فأبلغ عن تصحيح أدناه.',
      noDetails: 'لم تُنشر تفاصيل بعد',
      noPublishedDetails: 'لم ننشر تفاصيل لهذه القطعة، لذلك تعرض هذه الصفحة ما تقوله خوادم المدينة الآن.',
      confidence: {
        high: 'من المرجح جدًا أنها فارغة',
        medium: 'من المرجح أنها فارغة',
        low: 'لسنا متأكدين كثيرًا من أنها فارغة',
      },
      confidenceTitle: 'مدى تأكدنا',
      signals: (n) =>
        plural(n, {
          one: 'سجل واحد مستقل لدى المدينة يتفق على أنها فارغة.',
          two: 'سجلان مستقلان لدى المدينة يتفقان على أنها فارغة.',
          few: '# سجلات مستقلة لدى المدينة تتفق على أنها فارغة.',
          many: '# سجلًّا مستقلًّا لدى المدينة تتفق على أنها فارغة.',
          other: '# سجل مستقل لدى المدينة تتفق على أنها فارغة.',
        }),
      cityCalls: (category) => `تصنّفها سجلات عقارات المدينة على أنها: ${category}.`,
      lotSize: (frontage, depth) =>
        `يسجّل مُقدِّر العقارات لدى المدينة أنها بعرض نحو ${count(Math.round(frontage), FOOT)} على الشارع وبعمق نحو ${count(Math.round(depth), FOOT)}.`,
      landcare: 'تعتني بها PHS LandCare بالفعل.',
      landcareSince: (year) => `تعتني بها PHS LandCare بالفعل منذ ${year}.`,
      garden: 'يزرع الناس هنا بالفعل. اسألهم قبل أن تخطط لأي شيء.',
      lensLine: (lens) => `الأولوية بحسب عدسة ${lens}، وهي العدسة التي تلوّن الخريطة قطع الأراضي بها.`,
      flood: {
        1: 'جزء من هذه القطعة يقع في سهل الفيضان الذي تحدده FEMA باحتمال سنوي 1 في المئة، حيث يبلغ احتمال حدوث فيضان 1 من 100 على الأقل كل عام. وهذا سبب للعناية، وليس جزءًا من أي درجة: يجب أن تتحمل النباتات هنا الأرض المبتلة، وأي بناء يجب أن يتبع قواعد المدينة لسهول الفيضان، والتخضير الذي يمتص ماء المطر مفيد.',
        2: 'جزء من هذه القطعة يقع في منطقة الفيضان التي تحددها FEMA باحتمال سنوي 0.2 في المئة، حيث يبلغ احتمال حدوث فيضان 1 من 500 كل عام. وهذا سبب للعناية، وليس جزءًا من أي درجة: ينبغي أن تتحمل النباتات هنا الأرض المبتلة، والتخضير الذي يمتص ماء المطر مفيد.',
      },
      floodTitle: 'خطر الفيضان',
      linksTitle: 'اطّلع عليها في مواقع أخرى',
      propertyPage: 'صفحة العقار لدى المدينة',
      atlas: 'Atlas، خريطة المدينة لهذا العنوان',
      googleMaps: 'Google Maps',
      streetView: 'Google Street View',
      linksNote: 'تفتح هذه الروابط مواقع أخرى. يرتبط Placekeepers بصور الشوارع لكنه لا ينسخها أبدًا.',
    },

    actions: {
      intro: 'ابدأ بالمسار القانوني. يذكر كل مسار من يستطيع القيام به ومن يستطيع المساعدة.',
      route: 'المسار القانوني',
      steps: 'الخطوات',
      who: 'من يستطيع القيام به',
      cost: 'التكلفة',
      timeline: 'كم يستغرق',
      lastChecked: (date) => `آخر تحقق ${date}.`,
      toConfirm: 'ما زال يحتاج إلى تأكيد من المنظمة المذكورة هنا.',
      partners: 'من يستطيع المساعدة',
      otherRoutes: 'مسارات قانونية أخرى لهذه القطعة',
      none: 'لا اقتراح لهذا المكان بعد.',
      notListed:
        'هذه القطعة ليست في قائمتنا لقطع الأراضي والمباني الفارغة المحتملة، لذلك لا يوجد لدينا اقتراح لها. تشرح صفحة "كيف تفعل ذلك" المسارات القانونية لأي قطعة.',
      howTo: 'كيف تفعل ذلك',
      conservatorshipWarning:
        'قد تنتزع الحراسة القضائية العقار من مالكه. وجد باحثون أنها تُستخدم بصورة غير متناسبة في الأحياء التي تواجه تغيّرًا سكانيًا بفعل ارتفاع الأسعار (gentrification). تحدّث إلى Garden Justice Legal Initiative قبل أن تفكر في اللجوء إليها.',
      notLegalAdvice: 'Placekeepers ليس مشورة قانونية. تحقق من المنظمات المذكورة هنا قبل أن تتصرف.',
    },

    listing: {
      title: 'مُدرجة كمتاحة لدى جهات الأراضي التابعة للمدينة',
      text: (date) => `في ${date}، أظهرت قائمة المدينة للأراضي العامة هذا العقار على أنه متاح.`,
      textNoDate: 'تُظهر قائمة المدينة للأراضي العامة هذا العقار على أنه متاح.',
      variants: {
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': 'يُعرض لاتفاقية حديقة.',
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': 'لا يجوز بناء أي شيء عليه.',
        'OWNED - AVAILABLE (NOT FOR SY)': 'لا يُعرض كفناء جانبي.',
      },
      sideYardLead: 'إذا كنت تملك المنزل المجاور، فابدأ ببرنامج الفناء الجانبي:',
      decline:
        'إدراجها في القائمة لا يعني أن Land Bank سيقول نعم. فهو يبتّ في كل طلب على حدة، ويستطيع أن يرفض أي بيع أو إيجار، حتى لعقار يُدرجه على أنه متاح.',
      changes: 'تتغير القائمة كثيرًا. تحقق من خريطة Land Bank قبل أن تتصرف.',
      map: 'خريطة Land Bank للعقارات المتاحة',
      credit: 'القائمة: مدينة فيلادلفيا، إدارة التخطيط والتنمية (إدارة الأراضي)، كما تعرضها خريطة Philadelphia Land Bank.',
    },

    ownerType: {
      noName: 'لا تذكر سجلات المدينة اسم مالك.',
      unclear: 'لم نستطع أن نعرف من الاسم أي نوع من الملاك هذا.',
      individual: 'يبدو اسم المالك اسم شخص.',
      publicName: (label) => `تسمّي سجلات المدينة ${label} مالكًا.`,
      markerReason: (marker) => `يتضمن اسم المالك "${marker}".`,
      agencyConflict: (contact) => `تسمّي سجلات عقارات المدينة مالكًا مختلفًا، لذلك اسأل ${contact} أيهما الحالي.`,
      agencyContacts: { PUB: 'Land Bank', PLB: 'Land Bank', PRA: 'PHDC', PHDC: 'PHDC' },
      publicBodies: {
        land_bank: 'Philadelphia Land Bank',
        redevelopment_authority: 'هيئة إعادة التطوير في فيلادلفيا',
        pha: 'Philadelphia Housing Authority',
        housing_authority: 'هيئة إسكان',
        phdc: 'Philadelphia Housing Development Corporation (PHDC)',
        pha_or_phdc: 'Philadelphia Housing Authority أو PHDC (الاسم مبتور)',
        city: 'مدينة فيلادلفيا',
        school_district: 'منطقة فيلادلفيا التعليمية (School District of Philadelphia)',
        community_college: 'Community College of Philadelphia',
        septa: 'SEPTA',
        commonwealth: 'كومنولث بنسلفانيا',
        phfa: 'وكالة تمويل الإسكان في بنسلفانيا (Pennsylvania Housing Finance Agency)',
        united_states: 'حكومة الولايات المتحدة',
        hud: 'وزارة الإسكان والتنمية الحضرية الأمريكية (HUD)',
        veterans_affairs: 'وزارة شؤون المحاربين القدامى الأمريكية',
        paid: 'Philadelphia Authority for Industrial Development',
        port_authority: 'Philadelphia Regional Port Authority',
        district_attorney: 'مكتب محامي المقاطعة في فيلادلفيا',
        public_authority: 'هيئة عامة',
        pgw: 'Philadelphia Gas Works',
      },
      markers: {
        TR: 'TR، اختصار "trustee" أي الأمين',
        TRS: 'TRS، اختصار "trustees" أي الأمناء',
        TRST: 'TRST، اختصار "trust" أي الصندوق الائتماني',
        'T U W': 'T/U/W، صندوق ائتماني أُنشئ بوصية',
        FBO: 'FBO، أي لمصلحة',
        CO: 'CO، اختصار "company" أي شركة',
        LP: 'LP، شراكة محدودة',
        LLP: 'LLP، شراكة محدودة المسؤولية',
        LTD: 'LTD، اختصار "limited" أي محدودة',
        LL: 'LL، صورة مختصرة من LLC',
        GP: 'GP، شريك متضامن',
        'N A': 'N A، بنك وطني',
        FB: 'FB، صورة مختصرة من FBO',
        CDC: 'CDC، مؤسسة تنمية مجتمعية',
      },
      labels: {
        individual: 'شخص',
        company: 'شركة',
        city: 'مدينة فيلادلفيا',
        land_bank: 'Philadelphia Land Bank',
        redevelopment_authority: 'هيئة إعادة التطوير في فيلادلفيا',
        housing_authority: 'هيئة إسكان',
        nonprofit: 'منظمة غير ربحية',
        other_public: 'جهة عامة أخرى',
        unknown: 'غير واضح من سجلات المدينة',
      },
    },

    owner: {
      names: 'المالك، كما تنشره المدينة',
      noNames: 'لا تذكر سجلات المدينة اسم مالك.',
      mailing: 'عنوان المراسلة، كما تنشره المدينة',
      noMailing: 'لا عنوان مراسلة مسجّل.',
      type: 'نوع المالك',
      flagsTitle: 'ما تشير إليه سجلات المدينة',
      noFlags: 'لا شيء في سجلات المدينة يستدعي ملاحظة عن هذا المالك.',
      heldBack:
        'لسنا متأكدين أن هذه القطعة فارغة، لذلك قد تكون بيت أحدهم. الملاحظات عن مالك قد يكون شخصًا (أين يتلقى بريده، وتركة محتملة، وديون الضرائب، والقطع الأخرى التي يملكها) تظهر فقط على القطع التي نقول إنها من المرجح جدًا أو من المرجح أنها فارغة.',
      ownerChanged:
        'تسمّي سجلات المدينة مالكًا مختلفًا عن الذي سمّته لقطتنا الأسبوعية، لذلك حُذفت الملاحظات التي كانت عن المالك السابق.',
      parts: { meaning: 'ماذا يعني هذا', careful: 'كن حذرًا', next: 'خطوة تالية حذرة' },
      flagTitles: {
        absentee: 'أين يتلقى المالك بريده',
        possible_estate: 'تركة محتملة',
        tax_debt_2025: 'دين ضرائب حتى يوليو 2025',
        sheriff_sales: 'عمليات بيع الشريف السابقة',
        years_since_sale: 'السنوات منذ آخر بيع',
        many_parcels: 'مالك لقطع فارغة كثيرة',
        fast_resales: 'إعادة بيع سريعة',
        open_violations: 'مخالفات L&I المفتوحة',
        unsafe: 'مبنى غير آمن',
        imminently_dangerous: 'مبنى يشكّل خطرًا وشيكًا',
      },
      otherFlag: 'ملاحظة من سجلات المدينة',
      taxTitle: 'الضرائب',
      taxNoDebt:
        'لم تعد المدينة تنشر رصيد الضرائب لكل عقار كبيانات مفتوحة. لقطة يوليو 2025 التي لدينا لا تُظهر ضرائب غير مدفوعة هنا.',
      taxUnknown: 'لم تعد المدينة تنشر رصيد الضرائب لكل عقار كبيانات مفتوحة.',
      taxHeld:
        'لم تعد المدينة تنشر رصيد الضرائب لكل عقار كبيانات مفتوحة. تُعرض لقطتنا لشهر يوليو 2025 لمالك قد يكون شخصًا فقط على القطع التي نقول إنها من المرجح جدًا أو من المرجح أنها فارغة.',
      taxCenter: 'تحقق من رصيد اليوم في مركز ضرائب فيلادلفيا',
      deedFraudTitle: 'احمِ هذا العقار من سرقة صك الملكية',
      deedFraud:
        'تحدث سرقة صكوك الملكية حين يقدّم شخص صكًّا مزوّرًا ليستولي على عقار، وغالبًا ما يكون عقارًا مات مالكه أو يعيش في مكان آخر. يمكن للملاك وعائلاتهم الاشتراك في تنبيهات Fraud Guard المجانية التي تقدمها المدينة، وهي ترسل بريدًا إلكترونيًا عند تسجيل أي مستند يذكر أسماءهم. ومنذ نوفمبر 2025 تحجب المدينة أيضًا تلقائيًا الصكوك التي كان بائعها قد توفي بالفعل حين يُفترض أنه وقّعها.',
      fraudGuard: 'اشترك في تنبيهات Fraud Guard المجانية التي تقدمها المدينة',
      deedCheck: 'فحص المدينة الآلي الذي يوقف الاحتيال على الصكوك',
      helpTitle: 'مساعدة للملاك والعائلات',
      seeList: 'اطّلع على قطع هذا المالك في قائمتنا',
      cityListTitle: 'قائمة المدينة للممتلكات العامة',
      cityList: 'القطعة في قائمة المدينة للممتلكات العامة.',
      cityListNames: (agency) => `تسمّي قائمة المدينة للممتلكات العامة ${agency} مالكًا.`,
      cityListStatus: (status) => `حالتها هناك: ${status}.`,
      cityStatuses: {
        'OWNED - AVAILABLE': ['مُدرجة كمتاحة', 'يعرضها Land Bank على خريطته للعقارات التي يمكن للناس التقدم بطلب للحصول عليها.'],
        'OWNED - AVAILABLE (GARDEN AGREEMENT)': ['مُدرجة كمتاحة لاتفاقية حديقة', 'تُعرض للزراعة بموجب اتفاقية مع Land Bank.'],
        'OWNED - AVAILABLE (NO CONSTRUCTION PERMITTED)': ['مُدرجة كمتاحة، دون السماح بالبناء', 'تُعرض، لكن لا يجوز بناء أي شيء عليها.'],
        'OWNED - AVAILABLE (NOT FOR SY)': ['مُدرجة كمتاحة، لكن ليس كفناء جانبي', 'تُعرض، لكن ليس للجار المجاور كفناء جانبي.'],
        'OWNED - ON HOLD FOR AHD': ['محجوزة للإسكان الميسّر', 'مخصصة لمنازل ميسّرة، لذلك لا تُعرض على الجيران الآن.'],
        'OWNED - NOT AVAILABLE': ['غير متاحة', 'لا تعرضها جهات الأراضي في المدينة الآن.'],
        'OWNED - PROCESSING APPLICANT, NOT AVAILABLE': ['قدّم أحدهم طلبًا', 'يجري النظر في طلب عليها، لذلك لا تُعرض على أحد غيره الآن.'],
        'OWNED - MANAGED AND NOT AVAILABLE': ['تُدار وغير متاحة', 'تعتني بها جهة ولا تعرضها.'],
        'OWNED - ON HOLD': ['معلّقة', 'لا تُعرض الآن.'],
        'OWNED - SALE PENDING': ['بيع قيد التنفيذ', 'بيع جارٍ، لذلك لا تُعرض على أحد غيره.'],
        'UNKNOWN - RESEARCH PENDING': ['غير معروفة بعد', 'ما زالت جهات الأراضي في المدينة تبحث فيها.'],
        'OWNED - RFP RELEASED': ['معروضة للتطوير', 'طلبت جهات الأراضي في المدينة مقترحات لتطويرها.'],
        'OWNED - ON HOLD FOR HOME SD': ['محجوزة لبرنامج إسكان', 'محجوزة لبرنامج تسميه القائمة HOME SD، لذلك لا تُعرض على الجيران الآن.'],
        'OWNED - HELD FOR CITY COUNCIL MEMBER': ['محجوزة لعضو المجلس عن الدائرة', 'محجوزة لعضو مجلس المدينة عن الدائرة، لذلك لا تُعرض الآن. يستطيع مكتب العضو أن يقول لماذا.'],
        'OWNED - TO BE FEATURED SOON': ['ستُعرض قريبًا', 'تخطط جهات الأراضي في المدينة لعرضها قريبًا.'],
        'OWNED - NOT AVAILABLE (GSI PROJECT)': ['مخصصة لأعمال مياه الأمطار الخضراء', 'محجوزة لمزروعات تبنيها إدارة المياه لامتصاص المطر.'],
        'OWNED - COMPETITIVE BID POSTED': ['معروضة بمناقصة تنافسية', 'طلبت جهات الأراضي في المدينة عروضًا عليها.'],
      },
      sideYard: 'تحدد المدينة أنها مؤهلة لبرنامج الفناء الجانبي، لمالك المنزل المجاور.',
      agencies: {
        PUB: 'مدينة فيلادلفيا',
        PLB: 'Philadelphia Land Bank',
        PRA: 'هيئة إعادة التطوير في فيلادلفيا',
        PHDC: 'Philadelphia Housing Development Corporation (PHDC)',
      },
      tangledTitle: 'Tangled Title Fund، التي تديرها Philadelphia VIP',
      sheriffGuide: 'Grounded in Philly: عمليات بيع الشريف',
      gjli: 'Garden Justice Legal Initiative، للحصول على مساعدة قانونية مجانية',
    },

    flags: {
      absentee: {
        outOfState: (where) => `المالك يتلقى بريده في مكان آخر: ${where} (خارج الولاية).`,
        outsidePennsylvania: 'المالك يتلقى بريده في مكان آخر: خارج بنسلفانيا.',
        outsideCity: (city) => `المالك يتلقى بريده في مكان آخر: ${city}، بنسلفانيا (خارج فيلادلفيا).`,
        outsideCityUnknown: 'المالك يتلقى بريده في مكان آخر: خارج فيلادلفيا.',
        poBox: 'المالك يتلقى بريده في مكان آخر: صندوق بريد في فيلادلفيا.',
        elsewhere: 'المالك يتلقى بريده في مكان آخر: عنوان آخر في فيلادلفيا.',
        careful:
          'هذا هو العنوان الذي ترسل إليه المدينة فواتير الضرائب. وقد يكون قديمًا، أو يعود إلى قريب أو محامٍ أو مدير، وقد لا يعرف مالك يعيش في مكان آخر كيف يبدو العقار اليوم.',
        next: 'اكتب إلى المالك على هذا العنوان واسأله قبل أن تفعل أي شيء في العقار، واطلب من Garden Justice Legal Initiative أن تراجع أي اتفاق قبل أن توقّعه.',
      },
      possible_estate: {
        text: 'قد يكون المالك المسجّل قد توفي.',
        careful: 'قد يظل لأفراد من العائلة حق في هذا العقار وقد لا يعرفون ذلك.',
        next: 'إن كنت تعرف العائلة، فيمكن أن يساعدها Tangled Title Fund (مساعدة قانونية تصل إلى 6,500 دولار) وPhiladelphia VIP على الاحتفاظ به. ويمكن للعائلات أيضًا أن تشترك في تنبيهات Fraud Guard المجانية التي تقدمها المدينة.',
      },
      tax_debt_2025: {
        text: (amount, years) =>
          `حتى يوليو 2025، أظهرت سجلات المدينة ${amount} من ضرائب العقارات غير المدفوعة${years ? ` عن ${count(years, TAX_YEAR)}` : ''}.`,
        careful:
          'هذا آخر سجل عام، من 9 يوليو 2025، وليس رصيد اليوم: فقد يكون المالك دفع منذ ذلك الحين، أو يدين بأكثر. وقد تؤدي نحو ثلاث سنوات أو أكثر من الضرائب غير المدفوعة إلى بيع الشريف، حيث يمكن بيع قطعة يعتني بها الجيران لمشترٍ من الخارج.',
        next: 'تحقق من رصيد اليوم في مركز ضرائب فيلادلفيا قبل أن تعتمد على هذا. وإن كان شارعك يعتني بهذه القطعة، فإن دليل Grounded in Philly عن عمليات بيع الشريف يشرح الخطر وما يمكنك فعله.',
      },
      sheriff_sales: {
        one: (sale) => `بيعت في بيع الشريف في ${sale}.`,
        many: (n, sales) => `بيعت ${count(n, TIME)} في بيع الشريف: ${sales}.`,
        sale: (date, price) => (price ? `${date}، بسعر ${price}` : date),
        andLast: (others, last) => `${others}؛ و${last}`,
        careful:
          'في بيع الشريف يمحو العرض الفائز الديون القديمة على العقار، لذلك قد تنتقل قطعة اعتنى بها الجيران إلى مشترٍ من الخارج. ولا يعني وجود بيع سابق أن العقار معروض للبيع الآن.',
        next: 'إن كان شارعك يعتني بهذه القطعة، فاقرأ دليل Grounded in Philly عن عمليات بيع الشريف واطلب من Garden Justice Legal Initiative مساعدة قانونية مجانية.',
      },
      years_since_sale: {
        lastSold: (year) => `بيعت آخر مرة في ${year}.`,
        notSoldSince: (year) => `لم تُبع في السوق المفتوحة منذ ${year} على الأقل.`,
        careful:
          'تُستبعد هنا عمليات البيع بسعر رمزي وعمليات بيع الشريف؛ والتاريخ الكامل أدناه. وكثير من المنازل ينتقل داخل العائلات دون بيع جديد، لذلك فمرور وقت طويل على آخر بيع لا يعني أن المالك تخلى عن العقار.',
        next: 'إن ورثت عائلة العقار دون صك جديد، فيمكن أن يساعدها Tangled Title Fund وPhiladelphia VIP على تسوية سند الملكية والاحتفاظ بالعقار.',
      },
      many_parcels: {
        text: (n) =>
          `يملك هذا المالك ${plural(n, { one: 'قطعة فارغة واحدة', two: 'قطعتين فارغتين', few: '# قطع فارغة', many: '# قطعة فارغة', other: '# قطعة فارغة' })} في المدينة.`,
        careful:
          'نطابق المالكين باسمهم الدقيق في سجلات المدينة، لذلك قد يظهر مالك واحد بعدة تهجئات، وقد يتشارك مالكان في الاسم نفسه. وامتلاك أرض فارغة ليس مخالفة بحد ذاته.',
        next: 'استخدم القائمة لترى القطع الأخرى لهذا المالك، ثم اطلب الإذن بالطريقة القانونية: اكتب إلى المالك، واطلب من Garden Justice Legal Initiative مراجعة أي اتفاق.',
      },
      fast_resales: {
        since: (n, year) => `بيعت ${count(n, TIME)} منذ ${year}.`,
        inYear: (n, year) => `بيعت ${count(n, TIME)} في ${year}.`,
        between: (n, first, last) => `بيعت ${count(n, TIME)} من ${first} إلى ${last}.`,
        careful:
          'قد تعني إعادة البيع السريعة أن العقار يُتداول من أجل الربح، وأحيانًا بصك مزوّر. وقد تكون أيضًا عادية، كأن تبيع عائلة منزلًا موروثًا ويعيد المشتري بيعه بعد الإصلاحات.',
        next: 'انظر من باع ومن اشترى في التاريخ أدناه. ويمكن للملاك والعائلات الاشتراك في تنبيهات Fraud Guard المجانية التي تقدمها المدينة ليعرفوا متى يذكر مستند أسماءهم.',
      },
      open_violations: {
        one: (when, what) => `تذكر L&I مخالفة مفتوحة واحدة${what ? `، بسبب ${what}` : ''}${when ? `، منذ ${when}` : ''}.`,
        many: (n) => `تذكر L&I ${count(n, VIOLATION)}.`,
        mostRecent: (when, what) => (what ? `أحدثها، من ${when}، بسبب ${what}.` : `أحدثها من ${when}.`),
        careful: 'المخالفة إشعار إلى المالك، وقد لا تتوفر لديه الوسائل لإصلاحها، وقد تكون الحالة تغيّرت منذ التفتيش.',
        next: 'بلّغ Philly311 عن المشكلات المادية، مثل إلقاء النفايات أو مبنى مفتوح. وإن كنت تعرف المالك فأخبره: فقد لا يكون رأى الإشعار.',
      },
      unsafe: {
        text: (since) => (since ? `تُدرج L&I هذا المبنى على أنه غير آمن، منذ ${since}.` : 'تُدرج L&I هذا المبنى على أنه غير آمن.'),
        careful: 'ابتعد وأبعد الأطفال: وجدت L&I أن البنية غير آمنة. لا تدخلها ولا تحاول تأمينها بنفسك.',
        next: 'إن كان مفتوحًا للدخول، فبلّغ Philly311 لتتمكن المدينة من إغلاقه بإحكام.',
      },
      imminently_dangerous: {
        text: (since) =>
          since ? `تُدرج L&I هذا المبنى على أنه يشكّل خطرًا وشيكًا، منذ ${since}.` : 'تُدرج L&I هذا المبنى على أنه يشكّل خطرًا وشيكًا.',
        careful: 'وجدت L&I أن البنية قد تنهار في أي وقت. ابتعد عنها، وأبعد الآخرين.',
        next: 'بلّغ Philly311 عن أي تغيّر، مثل سقوط طوب أو باب مفتوح.',
      },
    },

    history: {
      transfersTitle: 'عمليات البيع والنقل',
      transfersCaption: 'كل عملية بيع ونقل مسجّلة لهذا العقار، الأحدث أولًا',
      date: 'التاريخ',
      document: 'المستند',
      documentAndPrice: 'المستند والسعر',
      fromAndTo: 'من وإلى',
      price: 'السعر',
      from: 'من',
      to: 'إلى',
      noDate: 'لا تاريخ',
      noPrice: 'لا سعر مسجّل',
      share: (n) => `حصة هذا العقار من صك واحد يشمل ${count(n, PROPERTY)}`,
      more: (n) =>
        plural(n, { one: 'وطرف آخر', two: 'وطرفين آخرين', few: 'و# من الأطراف الأخرى', many: 'و# من الأطراف الأخرى', other: 'و# من الأطراف الأخرى' }),
      noTransfers: 'لا صكوك مسجّلة.',
      notInCopy: (parts) =>
        `لا تتضمن نسختنا الأسبوعية ${parts.length > 1 ? `${parts.slice(0, -1).join('، ')} و${parts[parts.length - 1]}` : parts[0]} لهذه القطعة، لذلك لا تستطيع هذه الصفحة أن تقول ما إذا كان هناك أي منها.`,
      partialParts: { transfers: 'سجلات الصكوك', assessments: 'التقييمات', li: 'سجلات مخالفات L&I' },
      notInCopyOff: 'تستطيع بيانات المدينة الحية أن تعرضها.',
      notInCopyFailed: 'لم تردّ المدينة. حاول مرة أخرى لتراها.',
      recordsNote: 'سجلات صكوك المدينة كاملة منذ عام 2000. وقد تنقص عمليات البيع الأقدم.',
      datesNote:
        'كل تاريخ هو تاريخ الصك، وكل سعر مقرّب إلى الدولار، كما تعرضها صفحة العقار لدى المدينة؛ وتسجّل المدينة الصك بعد أيام أو أسابيع. وحين يشمل صك واحد عدة عقارات، يكون السعر حصة هذا العقار.',
      documents: {
        DEED: 'صك',
        'DEED SHERIFF': 'صك الشريف',
        "SHERIFF'S DEED": 'صك الشريف',
        'DEED MISCELLANEOUS': 'صك متنوع',
        'MISCELLANEOUS DEED': 'صك متنوع',
        'DEED MISCELLANEOUS TAXABLE': 'صك متنوع، خاضع للضريبة',
        'MISCELLANEOUS DEED TAXABLE': 'صك متنوع، خاضع للضريبة',
        'DEED LAND BANK': 'صك Land Bank',
        'DEED OF CONDEMNATION': 'صك نزع الملكية',
        'DEED - DECEASED': 'صك من تركة',
        'DEED - ADVERSE POSSESSION': 'صك بالتقادم (الحيازة العدائية)',
        'DEED RTT - OTHER': 'صك آخر',
        'CERTIFICATE OF STOCK TRANSFER': 'شهادة نقل أسهم',
      },
      assessmentsTitle: 'تقييمات المدينة',
      assessmentsCaption: 'تقييم المدينة للقيمة السوقية، بحسب السنة',
      year: 'السنة',
      marketValue: 'القيمة السوقية المقدّرة',
      noValue: 'غير مسجّلة',
      noAssessments: 'لا تقييمات مسجّلة.',
      assessmentNote: 'التقييم هو تقدير المدينة للقيمة السوقية لأغراض ضرائب العقارات. وليس سعر بيع.',
      chartLabel: (first, last, low, high) => `رسم تقييم المدينة من ${first} إلى ${last}، بين ${low} و${high}. الأرقام نفسها في الجدول أدناه.`,
      open: 'مفتوحة',
      liSummaryOpen: (n) => count(n, VIOLATION),
      liSummaryLast: (date) => `أحدث مخالفة: ${date}.`,
      liUnsafe: 'تُدرج L&I هذا المبنى على أنه غير آمن.',
      liUnsafeSince: (date) => `تُدرج L&I هذا المبنى على أنه غير آمن، منذ ${date}.`,
      liDangerous: 'تُدرج L&I هذا المبنى على أنه يشكّل خطرًا وشيكًا.',
      liDangerousSince: (date) => `تُدرج L&I هذا المبنى على أنه يشكّل خطرًا وشيكًا، منذ ${date}.`,
      liSince2016: (n) =>
        plural(n, {
          one: 'مخالفة واحدة مسجّلة منذ 2016.',
          two: 'مخالفتان مسجّلتان منذ 2016.',
          few: '# مخالفات مسجّلة منذ 2016.',
          many: '# مخالفة مسجّلة منذ 2016.',
          other: '# مخالفة مسجّلة منذ 2016.',
        }),
      liSealed: (date) => `آخر مرة نظّفتها المدينة وأغلقتها بإحكام في ${date}.`,
      liDemolished: (date) => `اكتمل آخر هدم في ${date}.`,
      liNeither: 'غير مُدرج على أنه غير آمن أو يشكّل خطرًا وشيكًا.',
      liNowTitle: 'L&I اليوم',
      earlyDeed: 'قبل عام 2000: من سجلات تقول المدينة إنها قد تكون ناقصة.',
      timeline: {
        storyTitle: 'قصة هذه القطعة',
        storySource: (source) => `من ${source}.`,
        noStory: 'السجلات التي لدينا لا تروي قصة عن هذه القطعة بعد.',
        title: 'الجدول الزمني',
        caption: 'كل ما هو مسجّل لهذا العقار، الأحدث أولًا، بحسب السنة',
        intro: 'عمليات البيع وسجلات L&I والطعون وسجلات الفراغ في قائمة واحدة، الأحدث أولًا. أوقف نوعًا لتخفيه.',
        appeal: (board, kind) => (kind ? `${board}: ${kind}` : board),
        appealHearing: (date) => `جلسة استماع ${date}`,
        show: 'إظهار في الجدول الزمني',
        loading: 'جارٍ تحميل الجدول الزمني من النسخة الأسبوعية.',
        failed: 'تعذّر تحميل الجدول الزمني من النسخة الأسبوعية.',
        unpublished: 'ليس في هذه النسخة من الخريطة ملفات جدول زمني بعد.',
        liMissing: 'لا تتضمن نسختنا الأسبوعية سجلات L&I لهذه القطعة، لذلك لا يستطيع الجدول الزمني أن يقول ما إذا كان هناك أي منها.',
        liMissingOff: 'تستطيع بيانات المدينة الحية أن تعرضها.',
        none: 'لا سجلات في الجدول الزمني.',
        allHidden: 'كل أنواع السجلات متوقفة.',
        moreYears: (n) =>
          `عرض ${plural(n, { one: 'سنة سابقة واحدة', two: 'سنتين سابقتين', few: '# سنوات سابقة', many: '# سنة سابقة', other: '# سنة سابقة' })}`,
        fewerYears: 'عرض السنوات الأخيرة فقط',
        noDate: 'لا تاريخ',
        future: 'أرّخت المدينة هذا في المستقبل؛ وقد يكون سجلها خاطئًا.',
        printTitle: 'الجدول الزمني، أحدث 10 سجلات',
        recordColumn: 'السجل',
        whatColumn: 'ما حدث',
        printWaiting: 'تحتوي صفحة القطعة على الإنترنت على الجدول الزمني الكامل؛ ولم يُحمَّل حين طُبعت هذه الصفحة.',
        printMore: (n) => `${count(n, OLDER_RECORD)} في صفحة القطعة على الإنترنت.`,
        noPrice: 'لا سعر مسجّل',
        to: (names) => `إلى ${names}`,
        times: (n) => `(${count(n, TIME)})`,
        permit: 'تصريح',
        permitFor: (type, work) => `${type} لأجل ${work}`,
        violation: 'مخالفة',
        demolition: 'هدم',
        byCity: 'بواسطة المدينة',
        privatePermit: 'بموجب تصريح خاص',
        demolitionWork: {
          city: 'هدم تجريه المدينة',
          complete: 'هدم كامل',
          small: 'هدم مبنى من 3 طوابق أو أقل',
          large: 'هدم مبنى يزيد على 3 طوابق أو على 40 قدمًا',
          tank: 'إزالة خزان',
        },
        cleanSeal: 'نظّفته المدينة وأغلقته بإحكام',
        cleanSealClip: 'نظّفه وأغلقه بإحكام برنامج المدينة لتحسين الحياة المجتمعية (Community Life Improvement Program)',
        kinds: {
          deed: 'صك',
          violation: 'مخالفة',
          permit: 'تصريح',
          demolition: 'هدم',
          unsafe: 'إشعار مبنى غير آمن',
          imminently_dangerous: 'إشعار مبنى يشكّل خطرًا وشيكًا',
          clean_seal: 'تنظيف وإغلاق',
          appeal: 'طعن',
          vacancy: 'سجل فراغ',
        },
        toggles: {
          deed: 'عمليات البيع والنقل',
          violation: 'المخالفات',
          permit: 'التصاريح',
          demolition: 'عمليات الهدم',
          clean_seal: 'التنظيف والإغلاق',
          notice: 'إشعارات المباني غير الآمنة والتي تشكّل خطرًا وشيكًا',
          appeal: 'الطعون',
          vacancy: 'سجلات الفراغ والرعاية',
        },
        lists: {
          city_land: 'في قائمة المدينة للأراضي الفارغة',
          city_building: 'في قائمة المدينة للمباني الفارغة',
          june_2024_land: 'في قائمة L&I للأراضي الفارغة لشهر يونيو 2024، كما احتفظت بها Clean & Green Philly',
          june_2024_building: 'في قائمة Clean & Green Philly نفسها للمباني الفارغة لشهر يونيو 2024',
        },
        landcare: (program) =>
          program === 'community_landcare' ? 'بدأ الجيران يعتنون بهذه القطعة مع PHS Community LandCare' : 'بدأت PHS LandCare تعتني بهذه القطعة',
        story: {
          cityDemolished: (year) => `كان هنا مبنى حتى ${year}، حين هدمته المدينة.`,
          privateDemolished: (year) => `كان هنا مبنى حتى ${year}، حين هُدم بموجب تصريح خاص.`,
          newConstruction: (year) => `أصدرت L&I تصريح بناء جديد هنا في ${year}.`,
          dangerous: (date) => `تُدرج L&I المبنى على أنه يشكّل خطرًا وشيكًا منذ ${date}.`,
          unsafe: (date) => `تُدرج L&I المبنى على أنه غير آمن منذ ${date}.`,
          sealed: (year, n) =>
            n > 1
              ? `أرسلت المدينة آخر مرة طواقم التنظيف والإغلاق إلى هنا في ${year}؛ وقد فعلت ذلك ${count(n, TIME)}.`
              : `أرسلت المدينة طواقم التنظيف والإغلاق إلى هنا في ${year}.`,
          sheriff: (year) => `بيعت في بيع الشريف في ${year}.`,
          cityList: (land, date, june) =>
            `قائمة المدينة ${land ? 'للأراضي الفارغة' : 'للمباني الفارغة'} بتاريخ ${date} تتضمنها${june ? '، كما تضمنتها قائمة يونيو 2024' : ''}.`,
          juneList: (land) =>
            land ? 'تضمنتها قائمة L&I للأراضي الفارغة لشهر يونيو 2024.' : 'تضمنتها قائمة Clean & Green Philly للمباني الفارغة لشهر يونيو 2024.',
          landcare: (year, program) =>
            program === 'community_landcare' ? `يعتني بها الجيران مع PHS Community LandCare منذ ${year}.` : `تعتني بها PHS LandCare منذ ${year}.`,
          sources: {
            demolitions: 'سجلات الهدم لدى L&I',
            permits: 'سجلات التصاريح لدى L&I',
            notices: 'سجلات L&I للمباني غير الآمنة والتي تشكّل خطرًا وشيكًا',
            cleanSeal: 'سجلات L&I للتنظيف والإغلاق',
            deeds: 'سجلات صكوك المدينة',
            lists: (june) =>
              june ? 'قائمة المدينة للعقارات الفارغة، وقائمة L&I لشهر يونيو 2024 التي احتفظت بها Clean & Green Philly' : 'قائمة المدينة للعقارات الفارغة',
            june: (land) => (land ? 'قائمة L&I لشهر يونيو 2024، التي احتفظت بها Clean & Green Philly' : 'قائمة Clean & Green Philly لشهر يونيو 2024'),
            landcare: 'قائمة PHS LandCare بالقطع التي تعتني بها',
          },
        },
      },
    },

    nearby: {
      intro: 'ما حول هذه القطعة، لكي تذهب العناية حيث تنفع أكثر.',
      careNote: 'تُظهر هذه الأعداد أين تشتد الحاجة إلى العناية. ولا تقول شيئًا عن الناس الذين يسكنون هنا.',
      areaSnapshot: 'في المنطقة حول هذه القطعة، بعرض شارعين تقريبًا',
      within500: 'ضمن 500 قدم من هذه القطعة',
      s12: (n) =>
        `${plural(n, {
          one: 'تعرّض شخص واحد لإطلاق نار',
          two: 'تعرّض شخصان لإطلاق نار',
          few: 'تعرّض # أشخاص لإطلاق نار',
          many: 'تعرّض # شخصًا لإطلاق نار',
          other: 'تعرّض # شخص لإطلاق نار',
        })} في آخر 12 شهرًا`,
      s36: (n) =>
        `${plural(n, {
          one: 'تعرّض شخص واحد لإطلاق نار',
          two: 'تعرّض شخصان لإطلاق نار',
          few: 'تعرّض # أشخاص لإطلاق نار',
          many: 'تعرّض # شخصًا لإطلاق نار',
          other: 'تعرّض # شخص لإطلاق نار',
        })} في آخر 3 سنوات`,
      killed: (n) =>
        `${plural(n, {
          one: 'قُتل شخص واحد',
          two: 'قُتل شخصان',
          few: 'قُتل # أشخاص',
          many: 'قُتل # شخصًا',
          other: 'قُتل # شخص',
        })} في حوادث مرورية منذ 2019`,
      landcare: (n) =>
        plural(n, {
          one: 'قطعة أرض واحدة تعتني بها PHS LandCare',
          two: 'قطعتا أرض تعتني بهما PHS LandCare',
          few: '# قطع أرض تعتني بها PHS LandCare',
          many: '# قطعة أرض تعتني بها PHS LandCare',
          other: '# قطعة أرض تعتني بها PHS LandCare',
        }),
      gardens: (n) => count(n, GARDEN),
      hearings: (n) =>
        plural(n, {
          one: 'جلسة استماع واحدة قادمة بشأن عقارات أخرى',
          two: 'جلستا استماع قادمتان بشأن عقارات أخرى',
          few: '# جلسات استماع قادمة بشأن عقارات أخرى',
          many: '# جلسة استماع قادمة بشأن عقارات أخرى',
          other: '# جلسة استماع قادمة بشأن عقارات أخرى',
        }),
      playgroundHeading: 'أقرب ملعب أطفال',
      playground: (name, meters) =>
        `${name}، على بعد نحو ${distanceWords(meters)} في خط مستقيم${meters <= 400 ? '، ضمن مشي 5 دقائق' : meters <= 800 ? '، ضمن مشي 10 دقائق' : ''}.`,
      none: 'لا أعداد قريبة لهذا المكان بعد.',
      showLayer: (label) => `إظهار ${label} على الخريطة`,
    },

    sources: {
      intro: 'من أين يأتي كل جزء من هذه الصفحة، ومدى حداثته.',
      live: (time) => `مباشرة من المدينة في ${time}`,
      snapshot: (date) => `لقطة أسبوعية بتاريخ ${date}`,
      snapshotNoDate: 'لقطة أسبوعية',
      newest: (date) => `أحدث سجل ${date}`,
      taxSnapshot: 'آخر لقطة من Clean & Green Philly، 9 يوليو 2025',
      by: (publisher) => `من ${publisher}`,
      correction: 'أبلغ عن تصحيح',
      correctionHelp: 'يفتح نموذجًا على GitHub معبّأً ببيانات هذه القطعة. ويتطلب إرساله حساب GitHub مجانيًا.',
      ownerNote:
        'إذا كنت تملك هذا العقار وكان سجل للمدينة عنه خاطئًا، فيستطيع مكتب المدينة الذي يحتفظ بالسجل أن يصححه من المصدر: مكتب تقييم الممتلكات لأسماء المالكين وعناوين المراسلة والتقييمات، وقسم السجلات للصكوك، وإدارة التراخيص والتفتيش (L&I) للمخالفات والتصاريح.',
    },

    ownerList: {
      title: 'قطع هذا المالك في قائمتنا',
      intro: (names) => `القطع في قائمتنا التي سُجّل مالكها باسم ${names}.`,
      others: 'قطع أخرى في قائمتنا سُجّل مالكها بالأسماء نفسها كهذا المالك.',
      loading: 'جارٍ تحميل القائمة',
      missing: 'هذه القائمة غير متاحة الآن.',
      open: (address) => `افتح صفحة القطعة: ${address}`,
      kind: (kind, confidence) => (confidence ? `${kind}، ${confidence}` : kind),
    },

    print: {
      printed: (date) => `طُبعت من Placekeepers في ${date}.`,
      recent: 'التاريخ الحديث',
      moreOnline: (n) => `${count(n, MORE_RECORD)} في صفحة القطعة على الإنترنت.`,
      lastAssessment: (year, value) => `تقييم المدينة لعام ${year}: ${value}.`,
      moreSources: (n) => `${count(n, MORE_SOURCE)} في صفحة القطعة على الإنترنت.`,
      taxCenter: (url) => `رصيد اليوم: مركز ضرائب فيلادلفيا، ${url}`,
      rules: 'قواعد هذه القطعة',
    },

    rules: {
      intro:
        'ما تقوله سجلات المدينة والسجلات الفيدرالية عما ينطبق على هذه القطعة: التصنيف التاريخي، وتقسيم المناطق ونطاقاته الإضافية، وسجلات البراونفيلد، والطعون أمام مجالس المدينة. لا شيء من هذا يقول ما إذا كان يجوز بناء شيء هنا. اسأل المكتب المذكور قبل أن تخطط لأي شيء.',
      notOnList:
        'تُحسب القواعد كل أسبوع للقطع الموجودة في قائمتنا، وهذه القطعة ليست فيها. تعرض Atlas، خريطة المدينة، تقسيم المناطق ونطاقاته الإضافية، ويمكن للجنة الآثار التاريخية أن تقول ما إذا كانت تاريخية.',
      hearingTitle: 'جلسة استماع قادمة',
      hearingSet: (board, date, time) => `حُدّدت في ${date}${time ? `، الساعة ${time}` : ''} جلسة استماع ${board} تخص هذه القطعة.`,
      hearingBoard: {
        zoning: 'بشأن تقسيم المناطق',
        li_review: 'أمام مجلس مراجعة L&I',
        building: 'أمام مجلس معايير البناء',
        other: 'أمام أحد مجالس المدينة',
      },
      seeAppeal: 'اطّلع على الطعن',
      historicTitle: 'التصنيف التاريخي',
      inDistrict: (district, date) => `هذه القطعة في ${district}${date ? `، صُنّف في ${date}` : ''}.`,
      districtName: (name) => (/district/i.test(name) ? name : `الحي التاريخي ${name}`),
      listed: (date) => `هذا العقار مُدرج وحده في سجل فيلادلفيا للأماكن التاريخية (Philadelphia Register of Historic Places)، منذ ${date}.`,
      listedNoDate: 'هذا العقار مُدرج وحده في سجل فيلادلفيا للأماكن التاريخية (Philadelphia Register of Historic Places).',
      listedInDistrict: (district) => `هذا العقار في سجل فيلادلفيا للأماكن التاريخية ضمن ${district}.`,
      askFirst:
        'قد تحتاج التغييرات هنا إلى مراجعة لجنة الآثار التاريخية؛ اسألها أولًا. وإن أردت رسم جدارية أو إقامة حديقة، فاسأل اللجنة قبل أن تبدأ.',
      contact: 'لجنة فيلادلفيا للآثار التاريخية (Philadelphia Historical Commission): 215 686 7660، preservation@phila.gov.',
      confirm: 'تطلب المدينة من الجميع تأكيد الوضع التاريخي للعقار مع اللجنة.',
      commissionSite: 'موقع لجنة الآثار التاريخية',
      projectReview: 'كيف تراجع اللجنة الأعمال على العقارات التاريخية',
      findHistoric: 'ابحث عن عقار أو حي تاريخي',
      notHistoric: 'لا تُدرج سجلات لجنة الآثار التاريخية هذه القطعة على أنها تاريخية. اسأل اللجنة للتأكد.',
      zoningTitle: 'تقسيم المناطق',
      base: (code, group) => `تقسيم المناطق الأساسي: ${code}${group ? `، ${group}` : ''}.`,
      zoningGroups: {
        'RESIDENTIAL/MULTI-FAMILY/RESIDENTIAL MIXED-USE': 'منطقة سكنية',
        'COMMERCIAL/COMMERCIAL MIXED-USE': 'منطقة تجارية ومختلطة الاستخدام',
        'INDUSTRIAL/INDUSTRIAL MIXED-USE': 'منطقة صناعية',
        'SPECIAL PURPOSE': 'منطقة ذات غرض خاص، مثل الحدائق أو المؤسسات أو المطار',
      },
      basePending: 'سيغيّره مشروع قانون معروض على مجلس المدينة.',
      readBill: 'اقرأ مشروع القانون',
      overlaysIntro: (n) =>
        plural(n, {
          one: 'نطاق إضافي واحد يضيف قواعده الخاصة هنا:',
          two: 'نطاقان إضافيان يضيفان قواعدهما الخاصة هنا:',
          few: '# نطاقات إضافية تضيف قواعدها الخاصة هنا:',
          many: '# نطاقًا إضافيًا تضيف قواعدها الخاصة هنا:',
          other: '# نطاق إضافي تضيف قواعدها الخاصة هنا:',
        }),
      noOverlays: 'لا يغطي هذه القطعة أي نطاق تقسيم مناطق إضافي.',
      overlayKinds: { 1: 'نطاق إضافي', 2: 'قاعدة خاصة', 3: 'حد على التبليط' },
      readRule: (section) => (section ? `اقرأ القاعدة: المادة ${section} من قانون تقسيم المناطق` : 'اقرأ القاعدة في قانون تقسيم المناطق'),
      sunset: (date) => `من المقرر أن ينتهي في ${date}.`,
      pending: (bill) => `سيغيّره مشروع قانون معروض على مجلس المدينة${bill ? ` (مشروع القانون ${bill})` : ''}.`,
      zoningNote:
        'قد يغيّر تقسيم المناطق ونطاقاته الإضافية ما هو مسموح في القطعة. وقد تتأخر خرائط المدينة عن مشاريع القوانين الجديدة، لذلك تحقق من مكتب تقسيم المناطق في المدينة قبل أن تخطط.',
      zoningHelp: 'مساعدة المدينة في تقسيم المناطق والتخطيط',
      atlasZoning: 'هذا العنوان على Atlas، خريطة المدينة',
      overlayMeaning: {
        '/CTR': 'قواعد إضافية في Center City: الاستخدامات واللافتات وارتفاعات المباني ومواقف السيارات وواجهة الشارع.',
        '/NCO': 'قواعد تُبقي المباني الجديدة والإضافات منسجمة مع هذا الحي.',
        '/NCA': 'قواعد للمتاجر والاستخدامات على طول هذا الشارع التجاري.',
        '/TOC': 'قواعد قرب محطة قطار تفضّل المنازل والمتاجر القريبة من النقل العام.',
        '/NIS': 'قواعد بشأن مكان افتتاح موقع حقن خاضع للإشراف. وتغطي معظم المدينة.',
        '/MIN': 'قواعد بشأن المنازل الميسّرة في المساكن الجديدة.',
        '/AHP': 'قواعد تشجع الحفاظ على المنازل الميسّرة.',
        '/AHC': 'حدود للارتفاع قرب المطار.',
        '/HHC': 'حدود للارتفاع قرب مهبط طائرات مروحية.',
        '/ENV': 'قواعد تحمي المعالم الطبيعية مثل الأشجار والمنحدرات الشديدة والجداول.',
        '/WWO': 'قواعد تحمي Wissahickon Creek وجداولها.',
        '/DRC': 'قواعد للأرض على طول نهر ديلاوير.',
        '/CDO': 'قواعد لواجهة نهر ديلاوير الوسطى.',
        '/FNE': 'قواعد إضافية للشمال الشرقي الأقصى.',
        '/NE': 'قواعد إضافية للشمال الشرقي.',
        '/UED': 'قواعد بشأن الشاشات واللافتات المضيئة الكبيرة.',
        council: 'قواعد إضافية وضعها مجلس المدينة لجزء من دائرة واحدة من دوائر المجلس.',
        flood: 'قواعد حماية من الفيضان: حدود على البناء وردم الأرض حيث تصل الفيضانات.',
        steep: 'حدود على البناء والتسوية على المنحدرات الشديدة.',
        coverage: 'تحدّ من نسبة القطعة التي يمكن أن تغطيها المباني والتبليط، لحماية Wissahickon Creek.',
        animal: 'منطقة يسمح فيها قانون تقسيم المناطق للناس بتربية بعض حيوانات المزرعة، بحسب قواعده.',
        signs: 'قواعد بشأن اللافتات ولوحات الإعلانات.',
        childCare: 'قواعد بشأن رعاية الأطفال الأسرية في المنازل.',
        parking: 'قواعد بشأن مقدار مواقف السيارات التي تحتاجها المباني الجديدة.',
        loading: 'قواعد بشأن مناطق التحميل للمباني.',
        dispensary: 'قواعد بشأن مدى قرب صيدلية القنب الطبي من أماكن أخرى.',
        institutional: 'قواعد للمؤسسات على طول Germantown Avenue.',
        pump: 'قواعد قرب محطة ضخ مياه.',
        floorArea: 'قواعد بشأن مساحة الأرضية التي يجوز أن تكون للمباني.',
        waterfront: 'ارتدادات البناء على طول الواجهة المائية.',
        overlay: 'يضيف نطاق إضافي قواعده الخاصة فوق تقسيم المناطق الأساسي هنا.',
        supplemental: 'قاعدة خاصة يضيفها قانون تقسيم المناطق لهذه المنطقة.',
      },
      brownfieldTitle: 'سجلات البراونفيلد',
      brownfield: 'سُجّل تقييم أو أعمال تنظيف فيدرالية لموقع براونفيلد (أرض يُحتمل تلوثها) في هذا العنوان أو بالقرب منه. افحص التربة قبل زراعة الغذاء.',
      brownfieldSite: (name, feet) => `${name}، على بعد نحو ${count(feet, FOOT)} من هذه القطعة`,
      onLot: 'على هذه القطعة',
      brownfieldMore: (n) => `و${count(n, MORE_RECORD)} ضمن نحو 330 قدمًا`,
      brownfieldNote: 'تُظهر سجلات EPA أين مولت منحة براونفيلد فيدرالية أعمالًا. ولا تقول ما في الأرض اليوم.',
      soilTest: 'فحص التربة لدى Penn State Extension',
      gardenGuide: 'دليل EPA للزراعة في تربة المدن',
      epaRecord: 'هذا السجل لدى EPA',
      appealsTitle: 'الطعون وجلسات الاستماع',
      appealsIntro: 'الطعون أمام مجالس المدينة بشأن هذا العقار، الأحدث أولًا، كما تنشرها المدينة.',
      noAppeals: 'لا طعون أمام مجالس المدينة مسجّلة لهذا العقار.',
      appealsMissing: 'بُنيت نسختنا الأسبوعية دون سجلات الطعون لدى المدينة، لذلك لا تستطيع هذه الصفحة أن تقول ما إذا كان هناك أي منها.',
      appealsMissingOff: 'تستطيع بيانات المدينة الحية أن تعرضها.',
      boards: {
        zoning: 'مجلس تعديلات تقسيم المناطق (Zoning Board of Adjustment)',
        li_review: 'مجلس مراجعة L&I (L&I Review Board)',
        building: 'مجلس معايير البناء (Board of Building Standards)',
        other: 'مجلس آخر تابع للمدينة',
      },
      comingUp: 'قادمة',
      filed: (date) => `قُدّم ${date}`,
      hearingOn: (date, time, upcoming) => `${upcoming ? 'جلسة الاستماع مقررة في' : 'جلسة الاستماع في'} ${date}${time ? `، الساعة ${time}` : ''}`,
      decidedOn: (date) => `صدر القرار ${date}`,
      status: (status) => `الحالة: ${status}`,
      decision: (decision) => `القرار: ${decision}`,
      rco: (name) => `أبلغت المدينة هذه المنظمة المجتمعية المسجّلة: ${name}.`,
      filedBy: 'قدّمه',
      ownerNamed: 'المالك المذكور',
      namesNote: 'الأسماء كما تنشرها المدينة. وتظهر في صفحة هذه القطعة فقط، ولا تظهر أبدًا على الخريطة أو في التنزيلات.',
      grounds: 'اقرأ الطعن وأسبابه لدى المدينة (سجل عقار L&I)',
      takePart: {
        zoning: 'كيف تشارك في جلسة استماع بشأن تقسيم المناطق',
        li_review: 'مجلس مراجعة L&I',
        building: 'مجلس معايير البناء',
        other: 'تقويم الطعون لدى المدينة',
      },
      calendar: 'تقويم جلسات الاستماع لدى المدينة',
      decisions: {
        'GRANTED/PROV': 'مقبول بشروط',
        'DENIED/PROV': 'مرفوض بشروط',
        'DISMI/ENFORC': 'مردود',
        'ADMIN/REVIEW': 'أُحيل إلى مراجعة إدارية',
        'HELD/INFO': 'مؤجّل لطلب مزيد من المعلومات',
        NEWHEARNOT: 'لم تُمنح جلسة استماع جديدة',
        BOARDAKNOWL: 'أقرّ به المجلس',
        'LATE-APPRVD': 'وُوفق على الطعن المتأخر',
        'CITY AFFIRMED': 'قرار المدينة قائم',
        AFFIRMED: 'قرار المدينة قائم',
      },
      missing: {
        historic: 'بُنيت نسختنا الأسبوعية دون السجل التاريخي، لذلك لا تستطيع هذه الصفحة أن تقول ما إذا كانت هذه القطعة تاريخية. اسأل لجنة الآثار التاريخية.',
        overlays: 'بُنيت نسختنا الأسبوعية دون نطاقات تقسيم المناطق الإضافية، لذلك لا تستطيع هذه الصفحة سردها. تعرضها Atlas، خريطة المدينة.',
        brownfields: 'بُنيت نسختنا الأسبوعية دون سجلات البراونفيلد لدى EPA، لذلك لا تستطيع هذه الصفحة أن تقول ما إذا كان هناك أي منها قريب.',
      },
      none: 'لا شيء من هذه السجلات يذكر هذه القطعة.',
    },
  },
};

export default ar;
