// Chinese, simplified characters (zh-Hans): the interface text of web/src/strings.ts, key for key.
//
// Translated for issue #49, part B. Terms are fixed in docs/i18n/glossary-zh-Hans.md; write them the
// same way here, in the registry text and on the content pages. Full width punctuation, no dashes,
// and one space between Chinese characters and Latin letters or digits. How to check the result is in
// docs/TRANSLATING.md.

import type { Catalog } from '../catalog.ts';
import { formatDecimal, formatNumber, plural } from '../format.ts';

// A change in percent in words (strings.ts changeWords): "上涨 61%", "下降 3%", "没有变化".
function changeWords(n: number): string {
  if (n > 0) return `上涨 ${formatNumber(n)}%`;
  if (n < 0) return `下降 ${formatNumber(-n)}%`;
  return '没有变化';
}

// A survey's margin of error (strings.ts giveOrTake): "（上下浮动 6 个百分点）", or nothing.
function giveOrTake(margin: number | null, unit: 'points' | 'homes'): string {
  if (margin === null) return '';
  return unit === 'points' ? `（上下浮动 ${formatNumber(margin)} 个百分点）` : `（上下浮动 ${formatNumber(margin)}）`;
}

const zhHans: Catalog = {
  app: {
    name: 'Placekeepers',
    tagline: '一份免费地图，给关心自家街区的费城邻居。',
    mapLabel: '费城地图。本页的地点列表和纪念点列表用文字显示同样的内容。',
    loadingMap: '正在加载地图',
    mapFailed: '地图无法在此浏览器中启动。请换一个浏览器，或更新这个浏览器。',
    sampleData: '这是测试用的示例数据，不是真实的地点。',
    earlyPreview: '0.4 版：早期公开版本。采取行动之前，请先向市政府核实资料。',
    followAlong: '关注项目进展',
    skipToList: '跳到地点列表',
    hideNote: '隐藏',
    hideNoteLabel: '隐藏此提示',
    close: '关闭',
    notAffiliated: '与费城市政府和 SEPTA 没有隶属关系。不构成法律意见。',
    licenses: '代码：GPL-3.0。数据：每个数据来源各有自己的授权条款。文字：Creative Commons BY-SA 4.0。',
  },

  content: {
    tableLabel: '表格，可左右滚动',
    removalEmail: (email) =>
      `请写信给我们：[${email}](mailto:${email})。我们不为此使用公开表格，因为撤下纪念的请求属于个人私事，应当保密。`,
    removalComingSoon: (issueUrl) =>
      `处理这类请求的专用私人邮箱很快就会设立。在设立之前，地图不会显示任何姓名，您也可以在 [GitHub 议题](${issueUrl}) 中提出请求。任何人都能看到 GitHub 上的议题，所以请只写纪念点的编号或所在位置：您不需要提供姓名、理由，也不必说明自己是谁。`,
  },

  language: {
    button: '语言',
    buttonLabel: (name) => `语言：${name}。选择其他语言`,
    title: '语言',
    intro: '请选择本网站使用的语言。页面会用该语言重新打开，本浏览器会记住您的选择。',
    inUse: '正在使用',
    notReady: '翻译进行中',
    listLabel: '语言',
    aiNote: '本页由 AI 协助翻译，尚未经母语人士核对。',
    fixLink: '纠正翻译',
    pageInEnglish: '此页面尚未翻译，所以显示英文。',
    offerLabel: '语言选择提示',
  },

  units: {
    meters: (n) => `${formatNumber(n)} 米`,
    kilometers: (km) => `${formatDecimal(km, 1)} 公里`,
  },

  header: {
    settings: '设置',
    share: '复制链接',
    shareDone: '链接已复制。任何人打开它，都会看到同一张地图。',
    shareDoneNoMap: '链接已复制。链接不包含地图的位置，因为地图正显示您所在的位置。',
    shareFailed: '无法复制链接。请改从浏览器中复制网址。',
    dataStatus: '数据状态',
  },

  nav: {
    menu: '菜单',
    menuTitle: '网站菜单',
    menuLabel: '网站页面',
    map: '地图',
    landBank: 'Land Bank 数字一览',
    pages: [
      { slug: 'about', label: '关于' },
      { slug: 'why', label: '为什么行得通' },
      { slug: 'how', label: '怎么做' },
      { slug: 'responsibly', label: '请负责任地使用' },
      { slug: 'vacant-land', label: '我们如何找出空地' },
      { slug: 'streetcomplete', label: '调查公交站' },
      { slug: 'terms', label: '使用条款' },
      { slug: 'privacy', label: '隐私' },
      { slug: 'contact', label: '联系我们' },
    ],
  },

  views: {
    groupLabel: '选择视图',
    field: '街头',
    analysis: '分析',
    fieldLong: '街头视图',
    analysisLong: '分析视图',
    fieldHint: '适合站在街区上使用：附近的地点和第一个合法步骤。',
    analysisHint: '适合组织者使用：视角、筛选、详细资料和排序列表。',
    auto: '根据我的屏幕大小选择视图',
    autoHint: '手机使用街头视图，较大的屏幕使用分析视图。',
  },

  freshness: {
    checking: '正在检查数据',
    ok: (date) => `数据更新于 ${date}`,
    stale: '部分数据已过期',
    failing: '部分数据无法加载',
    unknown: '数据状态不明',
  },

  field: {
    nearMe: '我附近',
    nearMeBusy: '正在定位',
    nearMeDenied: '此网站的定位功能已关闭。您仍可手动移动地图。',
    nearMeUnavailable: '您的设备无法确定您的位置。您仍可手动移动地图。',
    nearMeUnsupported: '此浏览器无法分享您的位置。您仍可手动移动地图。',
    nearMeOutside: '您似乎不在费城。本地图只涵盖费城。',
    nearMePrivacy: '您的位置只保留在您的设备上。Placekeepers 绝不会把它发送到任何地方，也绝不会把它放进链接。',
    youAreHere: '您在这里',
    stopLocation: '停止使用我的位置',
    locationInUse: '正在使用您的位置。位置只留在这台设备上，不会出现在您复制的链接里。',
    stop: '停止',
    myLists: '我的清单',
    listsTitle: '已保存的清单',
    chipsLabel: '主要图层',
    moreLayers: '更多图层',
    layersTitle: '图层',
  },

  chips: {
    lots: '地块',
    streets: '街道',
    memorials: '纪念点',
    stops: '公交站',
    comingSoon: '即将推出',
  },

  sheet: {
    title: '您在附近能做什么',
    show: '显示附近的地点',
    hide: '隐藏附近的地点',
    countLabel: (n) => plural(n, { other: '# 个地点' }),
    zoomIn: '请把地图移动或放大到某个街区，查看附近的地点。',
    finding: '正在查找附近的地点。',
    noLotsLayer: '请打开“地块”或“公交站”图层，查看附近的地点。',
    nothingHere: '地图这一带没有符合您设置的空地或空置建筑。',
    nothingHereStops: '地图这一带没有符合您设置的空地、空置建筑或公交站。',
    noStopsHere: '地图这一带没有符合您设置的公交车站或有轨电车站。',
    showOnMap: '在地图上显示',
    openLotPage: '打开地块页面',
    nearestToYou: '离您最近的排在最前。',
    nearestToCenter: '离地图中心最近的排在最前。请移动地图，或点“我附近”。',
    noneWithSuggestion: '这里没有任何地点带有已开启的建议。请在“设置”中开启建议，或移动地图。',
    showMore: '显示更多地点',
    distance: (meters, fromYou) => {
      const feet = meters * 3.28084;
      const far = feet < 1000 ? `${formatNumber(Math.max(10, Math.round(feet / 10) * 10))} 英尺` : `${formatDecimal(feet / 5280, 1)} 英里`;
      return `距${fromYou ? '您' : '地图中心'}约 ${far}`;
    },
  },

  place: {
    kindLot: '空地',
    kindBuilding: '空置建筑',
    kindUnknown: '空置地块',
    parcel: (id) => `地块 ${id}`,
    priority: (score, lens) => `优先度 ${score} 分（满分 100，视角：${lens}）`,
    mainReason: (label) => `主要原因：${label}。`,
    bestSuggestion: '您可以做什么',
    firstStep: '第一个合法步骤',
    cost: (cost) => `费用：${cost}`,
    confidence: { 1: '我们不太确定它是空置的', 2: '大概是空置的', 3: '很有可能是空置的' },
    confidenceTitle: '我们有多确定',
    ownerTitle: '业主类型',
    landcare: '已由 PHS LandCare 维护',
    listed: '被市政府的土地机构列为“可用”',
    suggestionsTitle: '建议',
    clearSelection: '取消选择',
    selectedTitle: '已选的地点',
  },

  ownerTypes: {
    0: '未知',
    1: '个人',
    2: '公司',
    3: '费城市政府',
    4: '费城 Land Bank',
    5: '重建管理局',
    6: '住房管理局',
    7: '非营利组织',
    8: '其他公共机构',
  },

  why: {
    title: '为什么是这个评分',
    caption: '每个因素从 0 到 100 的数值、它的权重，以及它给评分增加的分数',
    intro: '评分是这些因素的加权平均。每个因素的范围是 0 到 100，100 表示需求最大。',
    factor: '因素',
    value: '满分 100',
    weight: '权重',
    adds: '加分',
    noData: '无数据',
    off: '关',
    total: '评分',
    missingNote: '此地点没有数据的因素，不计入它的平均分。',
  },

  reasons: {
    title: '我们为什么认为它是空置的',
    againstTitle: '让我们有所犹豫的地方',
    notPublished: '此地点的原因尚未公布。',
    city_land: (date) => (date ? `市政府把它列为可能的空地（名单日期：${date}）` : '市政府把它列为可能的空地'),
    city_building: (date) => (date ? `市政府把它列为可能的空置建筑（名单日期：${date}）` : '市政府把它列为可能的空置建筑'),
    assessor_vacant_land: '房产评估办公室把它归类为空地',
    no_building: '地块上没有建筑',
    demolished: (year) => (year ? `${year} 年已拆除，此后没有新建任何建筑` : '已拆除，此后没有新建任何建筑'),
    vacant_lot_record: 'L&I 在过去两年内记录过一起空地违规或投诉',
    landcare: '它属于 PHS LandCare，该组织负责照看空地',
    sealed: (year) => (year ? `${year} 年被市政府封闭，此后没有申请过许可` : '被市政府封闭，此后没有申请过许可'),
    unsafe: 'L&I 把它列为不安全的建筑，此后没有申请过许可',
    imminently_dangerous: 'L&I 认定它有迫在眉睫的危险，此后没有申请过许可',
    vacant_building_record: 'L&I 在过去两年内记录过一起空置房产违规或投诉',
    assessor_exterior: '房产评估办公室记录它的外观为空置或已封闭',
    built_since: (year) =>
      year ? `${year} 年已发出新建施工许可，所以现在那里可能已有建筑` : '已发出新建施工许可，所以现在那里可能已有建筑',
    construction_starting: (year) =>
      year ? `${year} 年已发出新建施工许可，所以可能正在动工` : '已发出新建施工许可，所以可能正在动工',
    side_yard: '隔壁自住房屋的业主也拥有这块地，所以它可能是侧院',
    land_use_shows_use: '市政府的土地用途地图显示它正在使用中',
    recent_permit: '过去两年内发出过建筑工程或分区方面的许可',
    building_stands: '虽然记录写的是空地，但上面有建筑的轮廓',
    homestead: '业主有自住房屋免税（Homestead Exemption）：市政府记录显示有人住在这里，或曾经住过',
  },

  lens: {
    title: '视角',
    presets: '预设',
    presetActive: '使用中',
    weightLabel: (factor) => `${factor}的权重`,
    weightValue: (w) => (w === 0 ? '关' : `${w}（满分 5）`),
    resetWeights: '重设权重',
    allOff: '所有因素都已关闭。请打开一个，地块才会着色。',
    allOffFor: (appliesTo) =>
      appliesTo === 'segment'
        ? '所有因素都已关闭。请打开一个，街道才会着色。'
        : appliesTo === 'stop'
          ? '所有因素都已关闭。请打开一个，公交车站和有轨电车站才会着色。'
          : '所有因素都已关闭。请打开一个，地块才会着色。',
    explainToggle: '为什么有这个因素',
    shown: (layer, lens) => `现在显示“${layer}”，按“${lens}”视角着色。`,
    notShown: (layer) => `地图目前没有在“${layer}”上显示这个视角。`,
    showOnMap: '在地图上显示',
    legendLow: '优先度较低',
    legendHigh: '优先度较高',
    legendNoData: '无评分',
  },

  filters: {
    title: '筛选',
    intro: '选择选项，可以缩小地图、排序列表和图表中的地块范围。没有选择任何选项的组，会显示全部。',
    ownerType: '业主类型',
    landcare: '已在 LandCare 计划中',
    inLandcare: '由 PHS LandCare 维护',
    notInLandcare: '不在 LandCare 计划中',
    confidence: '我们有多确定',
    kind: '空地或建筑',
    listed: '市政府土地机构名单上的地块',
    clear: '清除筛选',
    showAll: '显示全部',
    noneSelected: (group) => `“${group}”下没有选择任何选项，所以不显示任何地块。`,
    narrowedNote: (n) => `分析视图中的 ${formatNumber(n)} 项筛选正在缩小这些地点的范围。`,
  },

  permission: {
    title: '获得许可的第一步',
    short: {
      0: '还没有明确途径',
      1: '社区 LandCare',
      2: '菜园协议或许可',
      3: '询问 PHDC',
      4: '询问公共机构',
      5: '询问业主',
    },
    long: {
      0: '还没有明确途径：市政府记录没有给出业主姓名',
      1: 'PHS LandCare 已在照看它：Community LandCare 管理计划',
      2: '市政府或 Land Bank 拥有它：菜园协议或许可',
      3: '重建管理局或 PHDC 拥有它：请询问 PHDC',
      4: '住房管理局或其他公共机构拥有它：请询问该机构',
      5: '私人业主：请询问业主',
    },
    notPublished: '尚未公布',
    filterHelp: '先问谁，依据是市政府记录中的业主。这只是一种步骤，并不衡量任何人答应的可能性。',
    noRoute: '还没有明确途径：市政府记录没有给出业主姓名。地块页面会显示我们所知道的情况。',
    seeLotPage: '地块页面列出了此地点的合法途径。',
  },

  layers: {
    title: '图层',
    show: (label) => `显示${label}`,
    details: '关于此图层',
    settings: '图层设置',
    sources: '数据来源',
    legend: '图例',
    license: '授权条款',
    noData: '尚未发布数据',
    dataError: '无法加载此图层。',
    resetAll: '恢复默认设置',
    resetDone: '设置已恢复为默认值。',
    guide: '您可以怎样帮助改进此图层',
  },

  settings: {
    title: '设置',
    intro: '地图上的一切都是设置。您的选择会保存在此浏览器和链接中，但隐私方面的选择只保存在此浏览器中。',
    viewTitle: '视图',
    layersTitle: '图层及其设置',
    lensTitle: '视角权重',
    suggestionsTitle: '要显示的建议',
    suggestionShow: (label) => `显示“${label}”`,
    resetTitle: '重新开始',
    resetHelp: '把每个图层、设置和权重都恢复为此视图的默认值，并清除保存在此浏览器中的副本。',
    reset: '恢复默认设置',
    storageNote: '只保存在此浏览器中。Placekeepers 没有账户、Cookie 或跟踪。',
  },

  analysis: {
    leftTitle: '视角、筛选和图层',
    rightTitle: '详细资料',
    openLeft: '视角和图层',
    openRight: '详细资料',
    closePanel: '关闭面板',
    areaTitle: '地图的这一带',
    areaLots: (n) => plural(n, { other: '# 块空地' }),
    areaBuildings: (n) => plural(n, { other: '# 栋空置建筑' }),
    areaHigh: (n) => `其中 ${formatNumber(n)} 处很有可能是空置的`,
    areaLandcare: (n) => `${formatNumber(n)} 处已由 PHS LandCare 维护`,
    areaEmpty: '这一带没有符合您设置的空地或空置建筑。请试着缩小地图，或更改筛选。',
    areaHint: '请在地图或列表中选一个地块，看看它的评分为什么是这样。',
    sampleArea:
      '地图缩小到这个程度时，只显示空地和空置建筑的一部分样本，所以这里不做统计。请放大地图，才能统计每一个地点。',
    sampleList:
      '请放大地图，才能列出每一个地点。地图缩小到这个程度时，只显示空地和空置建筑的一部分样本，所以这里的列表或图表会漏掉一些地点。',
    sampleTab: '请放大',
    tableCaption: '视野内的地点，按当前的视角组合排序',
    rank: '名次',
    place: '地点',
    score: '评分',
    reason: '主要原因',
    save: '保存',
    sortHighFirst: '评分最高的排在最前。点击可改为最低的排在最前。',
    sortLowFirst: '评分最低的排在最前。点击可改为最高的排在最前。',
    tableEmpty: '视野内没有可排序的地点。',
    noScores: '优先度评分尚未公布，所以这份列表按地块编号排序。',
    tableMore: (shown, total) =>
      `显示前 ${formatNumber(shown)} 个，共 ${formatNumber(total)} 个。请放大地图或缩小筛选范围来查看其余的，也可以全部下载。`,
    drawerLabel: '视野内的地点',
    tabTable: '排序列表',
    tabPlot: '需求与第一步',
    tabLists: '已保存的清单',
    tabMemorials: '纪念点',
    tabBlocks: '街道路段',
  },

  plot: {
    title: '需求与获得许可的第一步',
    intro:
      '每个点代表视野内的一个地点。横轴：它在您的视角组合下的优先度，从 0 到 100。纵轴：获得许可的第一步，这是一种步骤类别，并不衡量任何人答应的可能性。选择一个点，可打开它的地块页面。',
    axisX: '您的视角组合下的优先度',
    empty: '视野内没有可绘制的地点。',
    noScore: (n) => `${plural(n, { other: '# 个地点' })}没有评分，所以没有显示。`,
    noStep: (n) => `${plural(n, { other: '# 个地点' })}还没有公布第一步，所以没有显示。`,
    dot: (place, score, step) => `${place}：优先度 ${score}。${step}。`,
    tableNote: '排序列表显示同样的地点和同样的第一步，供键盘和屏幕阅读器使用。',
    capped: (shown, total) => `视野内共 ${formatNumber(total)} 个地点，这里显示评分最高的 ${formatNumber(shown)} 个。请放大地图查看全部。`,
    summary: (rows) => `视野内的地点，按获得许可的第一步分类：${rows}。`,
    rowSummary: (label, n) => `${label}，${plural(n, { other: '# 个地点' })}`,
  },

  export: {
    title: '下载这些地点',
    help: (limit) =>
      `一个文件，最多包含 ${formatNumber(limit)} 个地点，以及每个地块页面上关于业主的内容，包括业主标记。文件的第一行指向使用条款。`,
    csv: '下载 CSV',
    geojson: '下载 GeoJSON',
    inView: '视野内的地点',
    working: (done, total) => `正在收集业主详细资料：${formatNumber(done)} / ${formatNumber(total)} 个文件`,
    done: (n) => `已下载 ${plural(n, { other: '# 个地点' })}。`,
    leftOut: (n, limit) =>
      `有 ${plural(n, { other: '# 个地点' })}没有包含在内，因为一次下载最多包含 ${formatNumber(limit)} 个。请放大地图或缩小筛选范围，下载其余的。`,
    withoutDetails: (n) => `有 ${plural(n, { other: '# 个地点' })}没有已公布的详细资料，所以它们的业主栏是空的。`,
    nothing: '没有可下载的地点。',
    sampleOff: '下载内容包含视野内的每一个地点，而地图缩小到这个程度时只显示样本。请放大地图再下载。',
    failed: '无法生成下载文件。请稍后再试。',
    yes: '是',
    no: '否',
    termsLine: (url) => `Placekeepers 导出文件：仅限用于社区关怀和合法行动。请先阅读使用条款：${url}`,
    englishColumns: '各种语言的下载文件中，列名一律使用英文，这样不同语言的文件可以合并，也可以重新读取。',
    madeLine: (n, title, day, dataDay) =>
      `来自“${title}”的 ${plural(n, { other: '# 个地点' })}。生成于 ${day}${dataDay ? `，使用 ${dataDay} 的每周数据` : ''}。`,
    ownerLine:
      '业主姓名和邮寄地址与市政府公布的一致。每一项业主标记都附有谨慎提示和保护性的下一步：请在行动之前先读地块页面上的说明。不构成法律意见。',
    scoreLine: (lens, weights) => `评分使用“${lens}”视角，权重为：${weights}。`,
    greeningLine: (caution) => `关于绿化建议：${caution}`,
    placemakingLine: (caution) => `关于花园、座椅和艺术作品：${caution}`,
  },

  lists: {
    title: '已保存的清单',
    privacy:
      '清单只保存在此浏览器、这台设备上，不会发送到任何地方。如需把清单转到另一台设备，或与别人分享，请把它下载成文件，再在那里打开这个文件。',
    notKept: '此浏览器目前没有保存清单，可能是因为用了无痕窗口，或存储被阻止了。关闭页面之前，请先下载您的清单。',
    empty: '还没有清单。从地点卡片、排序列表或地块页面保存一个地点，就会开始一份清单。',
    inUse: '使用中的清单',
    defaultName: '我的清单',
    untitled: '清单',
    newList: '新建清单',
    newName: '新清单的名称',
    create: '建立清单',
    rename: '重命名',
    renameLabel: '这份清单的新名称',
    saveName: '保存名称',
    cancel: '取消',
    delete: '删除这份清单',
    made: (name) => `已建立清单“${name}”。您现在保存的地点会放进这份清单。`,
    renamed: (name) => `这份清单现在叫“${name}”。`,
    deleted: (name) => `已从此浏览器删除“${name}”。`,
    confirmDelete: (name, n) =>
      `要从此浏览器删除“${name}”和其中的 ${plural(n, { other: '# 个地点' })}吗？除非您已下载，否则无法找回。`,
    count: (n) => plural(n, { other: '# 个地点' }),
    noPlaces: '这份清单是空的。请从地点卡片、排序列表或地块页面保存地点。',
    open: (place) => `打开 ${place} 的地块页面`,
    remove: '移除',
    removeLabel: (place) => `把 ${place} 从清单中移除`,
    save: '保存到我的清单',
    saveShort: '保存',
    savedShort: '已保存',
    saveShortLabel: (place, list) => `把 ${place} 保存到 ${list}`,
    saveTo: (name) => `保存到 ${name}`,
    saved: (name) => `已保存到 ${name}`,
    savedLabel: (name) => `已保存到 ${name}。选择它可以移除。`,
    added: (name) => `已保存到“${name}”。清单保留在此浏览器中。`,
    removed: (name) => `已从“${name}”中移除。`,
    full: (limit) => `这份清单已满：一份清单最多可放 ${formatNumber(limit)} 个地点。`,
    tooMany: (limit) => `此浏览器最多保存 ${formatNumber(limit)} 份清单。请先删除一份，再建新的。`,
    download: '下载这份清单',
    importTitle: '打开清单文件',
    importHelp: '从 Placekeepers 下载的 CSV 或 GeoJSON 文件，或者任何由九位数地块编号组成的文本文件。',
    imported: (name, n) => `已打开“${name}”，共 ${plural(n, { other: '# 个地点' })}。`,
    importFailed: '这个文件里没有我们能读取的地块编号。',
    importTooBig: '这个文件太大，不能作为清单。',
    importLeftOut: (n, limit) => `有 ${plural(n, { other: '# 个地点' })}没有包含在内：一份清单最多可放 ${formatNumber(limit)} 个地点。`,
  },

  displacement: {
    caution: '绿化可能会抬高附近的价格。建议同时配套一些保护措施。',
    placemakingCaution:
      '新的花园、座椅和艺术作品，可能让一个街区更受追捧，并抬高附近的价格和租金。请配套保护措施，保护租房或拖欠税款的邻居。',
    protections: '保护邻居的办法',
    inWatch: (signs) => `这个地点位于迁离关注区，有迹象显示这里的价格在上涨：${signs}。`,
    protectionsTitle: '可以配套的保护措施',
    jumpToWatch: '查看这里的迹象和保护邻居的办法',
    jumpToProtections: '查看保护邻居的办法',
    listIntro:
      '这些地点中有一些位于迁离关注区，公开记录里有迹象显示那里的价格在上涨。这些地点的卡片会列出各自所在地区的迹象。',
    printSeeAbove: '请见上方的“迁离关注”。',
    protectionLabels: {
      neighborhood_gardens_trust: 'Neighborhood Gardens Trust',
      community_land_trust: '社区土地信托',
      homestead_exemption: '市政府的自住房屋免税（Homestead Exemption）',
      longtime_owner_occupants: '市政府的长期自住业主计划（LOOP）',
      tangled_title_help: '处理产权纠葛的协助',
    },
    checked: (date) => `${date} 核查`,
    signShort: {
      prices: '房价涨得比全市快',
      assessments: '市政府的评估价值涨得比全市快',
      mva: '市政府的市场价值分析显示，房价攀升，长期居民越来越买不起',
      companies: '公司买下了所售房屋中的很大一部分',
      renters: '至少五分之三的住房是出租的',
      rent_burden: '许多租户的房租占了收入的一半或以上',
    },
    heading: '这里价格上涨的迹象',
    areaTitle: (tract) => `人口普查区 ${tract}`,
    around: (place) => `${place} 周边`,
    signsHere: '这里的迹象',
    alsoMeasured: '也做了测量，但不是这里的迹象',
    signTitle: {
      prices: '房屋成交价',
      assessments: '市政府的评估价值',
      mva: '市政府的市场价值分析',
      companies: '公司买家',
      renters: '租户',
      rent_burden: '房租占收入一半或以上的租户',
    },
    span: (a0, a1, b0, b1) => `${a0} 到 ${a1} 与 ${b0} 到 ${b1} 的成交`,
    pricesText: (p0, p1, change, city, span) =>
      `售出房屋的价格中位数从 ${p0} 变为 ${p1}，${changeWords(change)}${city === null ? '' : `，全市则是${changeWords(city)}`}${span ? `（${span}）` : ''}。`,
    companiesText: (share, sales, city) =>
      `最近三年售出的 ${formatNumber(sales)} 套房屋中，公司买下了 ${share}%${city === null ? '' : `，全市是 ${city}%`}。`,
    assessmentsText: (change, homes, city, years) =>
      `市政府对中位房屋的市场价值评估${years ? `在 ${years[0]} 年到 ${years[1]} 年之间` : ''}${changeWords(change)}（共 ${formatNumber(homes)} 套房屋）${city === null ? '' : `，全市则是${changeWords(city)}`}。`,
    rentersText: (share, city, years) =>
      `这里居民住的房屋中，有 ${share}% 是出租的${city === null ? '' : `，全市是 ${city}%`}${years ? `（人口普查局调查，${years[0]} 年到 ${years[1]} 年）` : ''}。`,
    mvaText: (rising, groups, edition) =>
      rising > 0
        ? `这里的 ${formatNumber(groups)} 个街区组中，有 ${rising} 个出现了上涨的压力。Reinvestment Fund 为市政府做的${edition ?? '市场价值分析'}发现：房价攀升，已超出长期居民的收入所能负担的范围。`
        : `这里的 ${formatNumber(groups)} 个街区组中，${edition ?? '市场价值分析'}没有发现任何一个出现上涨的压力。`,
    mvaNone: '市场价值分析没有涵盖这个地区。',
    tooFewSales: (earlier, recent, needed) =>
      `房屋成交太少，无法判断（${formatNumber(earlier)} 和 ${formatNumber(recent)}；每个时期至少需要 ${formatNumber(needed)} 宗）。`,
    tooFewHomes: '两个年份都有估值的房屋太少，无法判断。',
    tooFewHouseholds: '人口普查调查中的住户太少，无法判断。',
    rule: '至少有两项迹象成立，而且其中至少一项与价格有关（成交价、评估价值或市场价值分析），这个地区才会被列入关注区。',
    meaning: '在这里绿化和做其他改善，可能让价格进一步上涨。请配套保护措施，保护现在住在这里的邻居。',
    cannotTell:
      '这些是公开记录里的迹象，不是预测。它们说不出有谁搬走了、为什么搬走，也说不出现在住在这里的是谁；人口普查调查的数字是五年的平均值，所以也说不出现在的租金是多少。关注区之外的地区，同样可能感受到价格上涨。',
    contextTitle: '这里的租金、收入和空置住房',
    contextIntro: (years) =>
      `来自人口普查局的调查${years ? `（${years[0]} 年到 ${years[1]} 年）` : ''}。这是给邻居参考的背景资料，不是迹象：这些数字不会改变任何地区的划定。`,
    contextNoisy:
      '这些是根据五年间对部分住户的调查得出的估计，所以在小地区里只是大致的数字：真实的数字很可能落在所显示的误差范围内（人口普查局的误差范围，置信水平 90%）。',
    contextTitles: {
      rent: '租金中位数',
      income: '家庭收入中位数',
      vacant: '空置住房',
    },
    burdenText: (share, margin, households, city, years) =>
      `这里的 ${formatNumber(households)} 户租户家庭中，有 ${share}%${giveOrTake(margin, 'points')} 把一半或以上的收入花在房租和水电杂费上${city === null ? '' : `，全市是 ${city}%`}${years ? `（人口普查局调查，${years[0]} 年到 ${years[1]} 年）` : ''}。房租上涨对他们打击最大。`,
    burdenTooFew: '人口普查调查中的租户家庭太少，无法判断。',
    rentText: (rent, margin, city) =>
      `每月 ${rent}，含租户自付的水电杂费${margin ? `（上下浮动 ${margin}）` : ''}${city ? `，全市是 ${city}` : ''}。`,
    rentNone: '人口普查调查在这里的回答太少，无法得出租金中位数。',
    incomeText: (income, margin, city) => `每年 ${income}${margin ? `（上下浮动 ${margin}）` : ''}${city ? `，全市是 ${city}` : ''}。`,
    incomeNone: '人口普查调查在这里的回答太少，无法得出收入中位数。',
    vacantText: (vacant, homes, share, margin, city) =>
      `这里的 ${formatNumber(homes)} 套住房中有 ${formatNumber(vacant)} 套空置，占 ${share}%${giveOrTake(margin, 'points')}${city === null ? '' : `，全市是 ${city}%`}。`,
    vacantTooFew: '人口普查调查中的住房太少，无法判断。',
    whyEmpty: '为什么空着',
    whyRows: {
      vr: '出租中',
      vs: '出售中',
      vn: '已租出或已售出，尚未入住',
      vz: '季节性或偶尔使用',
      vo: '因其他原因闲置，例如维修、家庭的法律纠纷或被遗弃',
    },
    whyRow: (label, n, margin) => `${label}：${formatNumber(n)}${giveOrTake(margin, 'homes')}`,
    legendArea: '有价格上涨迹象的地区',
    legendTap: '请点按地区内部，或靠近边缘处，查看它的迹象。',
    legendNote: '这是公开记录里的迹象，不是预测。这些地区的绿化、花园、座椅和艺术作品卡片，会加上保护邻居的办法。',
    exportColumn: (signs) => `迁离关注区：${signs}`,
    exportLine: (caution, links) => `关于迁离关注区内的绿化：${caution}保护邻居的办法：${links}`,
    placemakingExportLine: (caution, links) => `关于迁离关注区内的花园、座椅和艺术作品：${caution}保护邻居的办法：${links}`,
    watchTitle: '迁离关注',
  },

  evidence: {
    strong: { label: '证据充分', meaning: '一项随机试验（最好是在费城做的）发现了这种效果。' },
    moderate: {
      label: '证据中等',
      meaning: '有对照地区的细致前后对比，发现了这种效果。',
    },
    mixed: { label: '证据不一', meaning: '好的研究结论不一致，或者效果取决于具体情况。' },
    weak: { label: '证据薄弱', meaning: '只有认知调查或相关性分析，或者只有一项小型研究。' },
    not_violence: {
      label: '与暴力无关',
      meaning: '因其他原因而有价值。我们不对暴力作任何论断。',
    },
    context: {
      label: '背景',
      meaning: '这是说明哪里的关怀最能起作用的背景资料，并不是在说什么办法有效。',
    },
  },

  legend: {
    parcelsFill: '填充颜色：您的视角组合下的优先度',
    parcelsFillLens: (lens) => `填充颜色：“${lens}”视角下的优先度`,
    parcelsSure: '轮廓：我们有多确定它是空置的',
    sureHigh: '很有可能是空置的',
    sureMedium: '大概是空置的',
    sureLow: '不太确定',
    parcelPoint: '圆点：地图缩小时是空置地块的样本；放大后是没有地图形状的地块',
    parcelsListed:
      '只显示被市政府的土地机构列为“可用”的地块。地图没有认定为空置的地块不会画出来；Land Bank 自己的地图会显示每一块。',
    selected: '已选的地点',
    landcare: '由 PHS LandCare 维护的地块：已有人照看',
    garden: '社区菜园或农场',
    hin: '位于“高伤害路网”（High Injury Network）上的街道',
    hexIntro: (window) => `每个六边形内中枪的人数，${window}`,
    hexNone: '没有枪击事件的六边形保持空白。',
    countBin: (lo, hi) => (hi === null ? `${formatNumber(lo)} 或更多` : lo === hi ? formatNumber(lo) : `${formatNumber(lo)} 到 ${formatNumber(hi)}`),
    segmentsFill: '线条颜色：您的视角组合下的街道安全评分',
    segmentsShown: (min) => (min <= 1 ? '评分高于零的每个路段都会显示。' : `评分达到 ${formatNumber(min)} 分（满分 100）或以上的路段会显示。`),
    segmentsZoom: '地图缩小时，只画出有伤害记录或位于高伤害路网上的路段。请放大查看其余路段。',
    crashSeverity: {
      3: '有人死亡',
      2: '有人重伤',
      1: '有人受伤',
      0: '没有人受伤的报告',
    },
    crashesZoom: '请放大地图，查看没有人受重伤的交通事故。',
    crashesSource: '来自 PennDOT 的交通事故记录，通常在事故发生约一年后才会提供。',
    memorial: '在步行、骑自行车或骑滑板车时遇难的人',
    memorialEveryone: '在交通事故中遇难的人',
    memorialNames: '圆环较完整，表示有公开的纪念名单提供了这位遇难者的姓名。点开标记即可阅读。',
    memorialNamesWaiting: '目前不显示任何姓名。只有在家属有了私下请求撤下姓名的途径之后，姓名才会出现。',
    memorialNamesHidden: '姓名已隐藏。',
    stopShelter: '有候车亭，或整个车站在屋顶下',
    stopBench: '有长椅，但地图上没有候车亭',
    stopNeither: '没有候车亭，也没有长椅',
    stopUnknown: '尚未调查：OpenStreetMap 目前没有这方面的信息',
    stopSurvey: '如何用 StreetComplete 调查一个车站',
    stopsCoverage: '这里只显示有人添加到 OpenStreetMap 的车站，所以还有许多车站尚未显示。',
    stopSurveyRoute: '打印整条线路的调查表',
  },

  streets: {
    popupLabel: '关于地图上的这个地点',
    detailsTitle: (style) =>
      style === 'memorials'
        ? '纪念点'
        : style === 'crashes'
          ? '交通事故'
          : style === 'street_segments'
            ? '街道路段'
            : style === 'transit_stops'
              ? '车站'
              : style === 'transit_routes'
                ? '线路'
                : style === 'stop_amenities'
                  ? '候车亭和长椅'
                  : style === 'city_trees'
                    ? '树木'
                    : style === 'amenity'
                      ? '在 OpenStreetMap 中的标注'
                      : style === 'public_place'
                        ? '地点'
                        : style === 'condition'
                          ? '向 311 报告的问题'
                          : style === 'public_art'
                            ? '公共艺术'
                            : style === 'traffic_stress'
                              ? '自行车的交通压力'
                              : style === 'parking_reports'
                                ? '已报告的停车问题'
                                : style === 'city_shelters'
                                  ? '公交候车亭'
                                  : style === 'street_poles'
                                    ? '街道灯杆'
                                    : style === 'traffic_calming'
                                      ? '交通减速措施'
                                      : style === 'crossing_guards'
                                        ? '学校过街协管员'
                                        : style === 'redlining'
                                          ? '1937 年红线地图'
                                          : '详细资料',
    memorialTitle: '纪念',
    peopleHere: (n) => `这里纪念着 ${formatNumber(n)} 位遇难者`,
    killed: {
      walk: '步行时遇难',
      bike: '骑自行车时遇难',
      scooter: '骑滑板车时遇难',
      motorcycle: '骑摩托车时遇难',
      other: '在交通事故中遇难',
    },
    killedOn: (what, date) => `${date}，${what}。`,
    memorialSource: '阅读公开的纪念页面',
    blessing: '只有得到家属同意才能做。',
    families: 'Families for Safe Streets 在事故发生后支持受影响的家庭。',
    canDo: '邻居在这里能做什么',
    firstStep: '第一步',
    cost: (cost) => `费用：${cost}`,
    memorialsNearby: '附近的纪念点',
    memorialsInView: '视野内的纪念点',
    memorialsIntro: '每一个纪念点，都纪念着一位在交通事故中遇难的人。点开一个可以了解更多。',
    memorialCount: (n) => plural(n, { other: '# 个纪念点' }),
    memorialsMore: (n) => `视野内还有 ${plural(n, { other: '# 个纪念点' })}。请放大地图，才能在这里列出。`,
    memorialsLayerOff: '请打开“纪念点”图层，才能列出视野内的纪念点。',
    memorialsNone: '地图这一带没有纪念点。',
    blocksNearby: '附近的街道路段',
    blocksInView: '视野内的街道路段',
    blocksIntro: '地图上画出的每个路段，附有它的街道安全优先度和主要原因。点开一个可以了解原因。',
    blockCount: (n) => plural(n, { other: '# 个路段' }),
    blockNoScore: '没有街道安全评分。',
    blocksMore: (n) => `视野内还有 ${plural(n, { other: '# 个路段' })}。请放大地图，才能在这里列出。`,
    blocksLayerOff: (layer) => `请打开“${layer}”图层，才能列出视野内的街道路段。`,
    blocksNone: '地图这一带没有画出街道路段。',
    crashesNearby: '附近的交通事故',
    crashesInView: '视野内的交通事故',
    crashesIntro: '来自 PennDOT 的交通事故记录，按事故图层的设置选取。点开一个可以了解更多。',
    crashCount: (n) => plural(n, { other: '# 起交通事故' }),
    crashesMore: (n) => `视野内还有 ${plural(n, { other: '# 起交通事故' })}。请放大地图，才能在这里列出。`,
    crashNear: (street) => `${street} 附近`,
    crashesNone: '地图这一带没有画出交通事故。',
    removal: '请求撤下',
    removalNote: (hasEmail) =>
      hasEmail
        ? '任何人都可以通过私人电子邮件，请求我们撤下这个纪念点。我们照办，不问原因。'
        : '任何人都可以请求我们撤下这个纪念点，无需说明理由。处理这类请求的专用私人邮箱很快就会设立；在那之前，“联系我们”页面说明了如何通过 GitHub 议题提出请求（任何人都能看到议题）。',
    crashTitle: (year) => `${year} 年的交通事故`,
    crashesHere: (n) => `此处有 ${plural(n, { other: '# 起交通事故' })}`,
    involved: '涉及的人',
    involvedModes: {
      walk: '步行的人',
      bike: '骑自行车的人',
      motorcycle: '骑摩托车的人',
      scooter: '骑滑板车的人',
    },
    involvedOthers: '汽车或其他车辆里的人',
    crashSource: '来自 PennDOT 的交通事故记录。',
    segmentScore: (score, lens) => `${lens}：在您的视角组合下为 ${score} 分（满分 100）`,
    segmentNoScore: '这个路段没有街道安全评分。',
    onHin: '位于高伤害路网上',
    ksi: (n) => `在 PennDOT 最近五年的记录中，有 ${formatNumber(n)} 人在这个路段或其路口步行或骑车时遇难或受重伤`,
    noKsi: '在 PennDOT 最近五年的记录中，没有人在这里步行或骑车时遇难或受重伤',
    killed2: (n) => `最近两年有 ${formatNumber(n)} 人在这里遇难`,
    school: '400 米内有学校',
  },

  streetsStops: {
    shelterLegend: '市政府名单上的候车亭，以所在车站周围的圆环表示',
    shelterLegendLens: '有市政府候车亭的车站，在公交舒适度视角中算作有遮蔽。',
    shelterLegendDate: '市政府最近一次更改名单是在 2025 年 1 月，所以之后新建或拆除的候车亭，名单上可能没有反映。',
    shelterTitle: '市政府名单上的公交候车亭',
    shelterAt: (stop) => `它服务于 SEPTA 站点 ${stop}。`,
    shelterListed: (number) => `市政府名单上记录的站点编号是 ${number}。`,
    shelterByNumber: '根据市政府名单上的站点编号，与 SEPTA 站点配对。',
    shelterByPlace: '与最近的 SEPTA 站点配对（距离 15 米以内）：市政府名单上没有对得上的站点编号。',
    shelterNoStop: '我们没有找到它服务的 SEPTA 站点：它距离每个站点都超过 15 米，或者它的站点已经关闭。',
    shelterDigital: '它的广告牌是数字屏幕。',
    shelterLens: '它所服务的车站，在公交舒适度视角中算作有遮蔽。',
    shelterPartner: '这些候车亭由市政府与其广告合作伙伴安装和维护，费用由广告支付。',
    shelterSource: '来自市政府的公交候车亭名单（交通与基础设施系统办公室）。',
    sheltersHere: (n) => `此处有 ${plural(n, { other: '# 个候车亭' })}`,

    poleLed: '市政府名单上的 LED 灯',
    poleOther: '较旧的高压钠灯',
    poleUnknown: '市政府没有注明类型的灯',
    poleNone: '名单上没有灯的灯杆，例如信号灯杆或电线杆',
    polesNote: '这是市政府名单上的灯，并不说明今晚哪盏灯是亮的。灯不亮时，请向 Philly311 报告。',
    polesZoom: '请放大到几个街区的范围，才能看到灯杆。',
    poleTitle: (number) => (number ? `街道灯杆 ${number}` : '没有编号的街道灯杆'),
    poleKind: {
      0: '市政府名单上，这根灯杆上没有灯。',
      1: '市政府名单上，这根灯杆上有一盏 LED 灯。',
      2: '市政府名单上，这根灯杆上有一盏较旧的高压钠灯。',
      3: '市政府名单上，这根灯杆上有一盏灯，但没有注明类型。',
    },
    poleOwner: {
      1: '灯杆归市政府街道局所有。',
      2: '灯杆归 PECO 所有。',
      3: '灯杆归 PennDOT 所有。',
      4: '灯杆归市政府、PECO 和 PennDOT 之外的其他方所有。',
    },
    poleReport: (number) => `如果这里的灯不亮，请告诉 Philly311 灯杆编号：${number}。`,
    poleReportNoNumber: '如果这里的灯不亮，请告诉 Philly311 灯在什么位置。',
    polesHere: (n) => `此处有 ${plural(n, { other: '# 根灯杆' })}`,
    poleSource: '来自街道局的街道灯杆名单，每周更新。',

    calmingLegend: '减速垫、减速丘或减速台',
    calmingLegendNote: '邻居可以请求市政府在住宅街道上设置交通减速措施。',
    zoomStreets: '请放大到几个社区的范围，才能看到它们。',
    calmingTitle: '交通减速措施',
    calmingWhat: '街道局名单上的减速垫、减速丘或减速台，用来让驾驶人减速。',
    calmingOn: (street) => `位于 ${street}`,
    calmingSince: (date) => `设置于 ${date}。`,
    calmingHere: (n) => `此处有 ${plural(n, { other: '# 处设施' })}`,
    calmingSource: '来自街道局的交通减速设施名单。',

    guardLegend: '市政府设有学校过街协管员的路口',
    guardLegendNote: '过街协管员在上学和放学时，帮助学校附近的孩子和所有人过马路。',
    guardTitle: '学校过街协管员',
    guardHere: '市政府在这个路口设有学校过街协管员岗位。',
    guardSchool: (school) => `市政府名单上 400 米内最近的学校：${school}。`,
    guardWhat: '过街协管员在上学和放学时，帮助学校附近的孩子和所有人安全过马路。',
    guardsHere: (n) => `此处有 ${plural(n, { other: '# 个岗位' })}`,
    guardSource: '来自市政府的学校过街协管员位置名单。',

    blockPoles: (poles, lamps, led) =>
      lamps === 0
        ? `市政府名单上，这个路段沿线有 ${plural(poles, { other: '# 根灯杆' })}，没有一根注明有灯。`
        : `市政府名单上，这个路段沿线有 ${plural(poles, { other: '# 根灯杆' })}，其中 ${formatNumber(lamps)} 根有灯，${led === lamps ? (lamps === 1 ? '这盏是 LED 灯' : '全部是 LED 灯') : `其中 ${formatNumber(led)} 盏是 LED 灯`}。`,
    blockNoPoles: '市政府名单上，这个路段沿线没有街道灯杆。',
    blockCalming: (n, year) =>
      year
        ? `这里自 ${year} 年起有交通减速措施：市政府名单上，这个路段有 ${plural(n, { other: '# 处减速垫、减速丘或减速台' })}。`
        : `市政府名单上，这个路段有 ${plural(n, { other: '# 处减速垫、减速丘或减速台' })}。`,
    blockNoCalming: '这里还没有交通减速措施的记录。',
    blockArterial: '市政府的减速垫只用于住宅街道。像这样的街道，请向市政府的交通与基础设施系统办公室询问其他改善办法。',
    memorialCalming: (n, year) =>
      year
        ? `这个路段自 ${year} 年起有交通减速措施：市政府名单上有 ${plural(n, { other: '# 处设施' })}。`
        : `市政府名单上，这个路段有 ${plural(n, { other: '# 处交通减速设施' })}。`,
    memorialNoCalming: '这个路段还没有交通减速措施的记录。',
    lightsPoles: (poles, lamps, led) =>
      lamps === 0
        ? `市政府名单上，这个路段沿线有 ${plural(poles, { other: '# 根灯杆' })}，没有一根注明有灯。`
        : `市政府名单上，这个路段沿线有 ${plural(lamps, { other: '# 根带灯的灯杆' })}，${led === lamps ? (lamps === 1 ? '是 LED 灯' : '全部是 LED 灯') : `其中 ${formatNumber(led)} 盏是 LED 灯`}。请打开“街道灯杆和市政府名单上的灯”图层并放大地图，查看每根灯杆的编号。`,
    stopLamps: (lamps, led) =>
      lamps === 0
        ? '市政府名单上，这个车站 30 米内没有带灯的灯杆。'
        : `市政府名单上，这个车站 30 米内有 ${plural(lamps, { other: '# 根带灯的灯杆' })}，${led === lamps ? (lamps === 1 ? '是 LED 灯' : '全部是 LED 灯') : `其中 ${formatNumber(led)} 盏是 LED 灯`}。`,
    cityShelter: (n) => (n === 1 ? '市政府的公交候车亭名单上，这里有一个候车亭。' : `市政府的公交候车亭名单上，这里有 ${formatNumber(n)} 个候车亭。`),
    noCityShelter: '市政府的公交候车亭名单上，这里没有候车亭。这份名单只包含市政府与其广告合作伙伴共同经营的候车亭。',
    disagree:
      '市政府名单上这里有候车亭，但 OpenStreetMap 说没有。其中一个可能已经过时：实地调查可以确定。在那之前，优先度按市政府的候车亭计算。',
    cityShelterLens: '优先度按市政府的候车亭计算。',
    answerCityShelter: '在 OpenStreetMap 中尚未调查，但市政府名单上有',
  },

  parking: {
    kinds: {
      all: '车辆挡路',
      sidewalk: '停在人行道上',
      bike_lane: '停在自行车道上',
      crosswalk: '停在人行横道上',
      corner: '停在路口转角',
      ramp: '挡住路缘坡道',
    },
    window: (start, end) => `从 ${start} 到 ${end}`,
    windowUnknown: '过去 12 个月',
    heatTitle: (window) => `地图缩小时：报告集中的地方。${window}。`,
    fewer: '报告较少',
    more: '报告较多',
    binsTitle: '放大后：每个约一个街区大小的区域内的报告数',
    bins: (low, high) => (high === null ? `${formatNumber(low)} 或更多` : `${formatNumber(low)} 到 ${formatNumber(high)}`),
    threshold: (min) => `报告少于 ${min} 份的区域不显示，这样就不会露出任何一份单独的报告。请放大并点按某个区域，查看它的数字。`,
    oneApp: '这是使用同一个应用（Philly Bike Action 的 Laser Vision）的人报告车辆挡路的地方。并非每个问题都有人报告。',
    title: '这个区域，约一个街区大小',
    summary: (n, window) => `${plural(n, { other: '# 份车辆挡路的报告' })}。${window}。`,
    count: (n) => formatNumber(n),
    fewerThan: (min) => `少于 ${min}`,
    byKind: '按类型',
    meaning:
      '这些是使用同一个应用的人提交的报告，所以只显示这些人注意到车辆挡路的地方，并不是所有的问题。这里某一类型的报告少于 5 份时，不给出数字，这样就不会露出任何一份单独的报告。',
    fixes: '同一个地方有很多报告，就是需要做实体改善的证据：缘石外扩、护柱、路口留出视野、受保护的自行车道和装卸区。',
    askCity: '就改善办法询问市政府',
    source: '来自 Philly Bike Action 的 Laser Vision 地图',
    refreshed: '每周重新统计一次，已获得 Philly Bike Action 的许可。',
  },

  transit: {
    waitTitle: '工作日中午，公交车或火车多久来一班',
    waitBins: ['每 10 分钟或更频繁', '每 11 到 15 分钟', '每 16 到 30 分钟', '每 31 到 60 分钟', '不到每小时一班'],
    noMidday: '工作日上午 10 点到下午 2 点没有服务',
    boardingsTitle: '平均每个工作日在这里上车的人数',
    boardingBins: ['1,000 或更多', '200 到 999', '50 到 199', '10 到 49', '少于 10'],
    noCount: '这个车站没有 SEPTA 的统计',
    boardingsNote: '来自 SEPTA 自己的统计，比时刻表晚一两个季度。',
    station: '地铁、El 高架线或 Regional Rail（区域铁路）车站',
    zoomNote: '请放大到几个社区的范围，才能看到车站。',
    lensTitle: '公交舒适度视角下的优先度',
    lensUnsurveyed: '还没有人调查过的车站，它的候车亭和长椅各算一半。',
    lensCityShelter: '市政府名单上有候车亭的车站，算作有遮蔽。',
    lensStations: '这个视角只给公交车站和有轨电车站评分，所以地铁和铁路车站画成空心。',
    lensTunnel: '中心城和大学城地下隧道里的有轨电车站也画成空心：这个视角不计入它们，和对待地铁和铁路车站一样。',
    findTitle: '乘客在这里会看到什么',
    notInOsm: '我们在 OpenStreetMap 里还没有找到对应的车站，所以还没有人记录它有没有候车亭或长椅。',
    matchedByNumber: '与 OpenStreetMap 中站点编号相同、位置相同的车站配对。',
    matchedByPlace: '与 OpenStreetMap 中位置相同（15 米以内）的车站配对。',
    halfway: '“尚未调查”的项目，在评分中各算一半（满分 100 中的 50 分），直到有人记录下来。',
    canopy: (percent) => `车站周围约两个街区范围内的土地，约有 ${formatNumber(percent)}% 被树冠覆盖（市政府 2018 年的树冠调查）。`,
    onHin: '这个车站位于高伤害路网上，也就是费城大多数交通死亡和重伤事故发生的街道。',
    noScore: '公交舒适度视角只给公交车站和有轨电车站评分。',
    tunnelStation: '这个有轨电车站在地下隧道里，所以公交舒适度视角不计入它，和对待地铁和铁路车站一样。',
    answersLoading: '正在加载 OpenStreetMap 关于这个车站的信息。',
    answersUnavailable: '目前无法加载 OpenStreetMap 关于这个车站的信息，所以它的候车亭和长椅按“尚未调查”计算。',
    canDo: '邻居在这里能做什么',
    routeDetails: '步骤、联系方式和链接',
    surveyGuide: '如何用 StreetComplete 调查一个车站',
    osmSource: '候车亭、长椅和照明来自 OpenStreetMap，© OpenStreetMap contributors，每周更新。',
    routeBus: '公交线路',
    routeTrolley: '有轨电车线路',
    routeMetro: '地铁或 El 高架线',
    routeRail: 'Regional Rail（区域铁路）',
    allRoutes: '几条线路共用一条街时，它们的线条会重叠在一起。',
    frequentRoutes: '只显示工作日中午每 15 分钟或更频繁就有一班公交车或火车的线路。',
    detailsTitle: '车站',
    stationName: (name) => `${name} 站`,
    stopsHere: (n) => `此处有 ${plural(n, { other: '# 个车站' })}`,
    kinds: {
      bus: '公交站',
      trolley: '有轨电车站',
      busTrolley: '公交和有轨电车站',
      metro: '地铁或 El 高架线车站',
      rail: 'Regional Rail（区域铁路）车站',
    },
    vehicles: { bus: '公交车', trolley: '有轨电车', busTrolley: '公交车或有轨电车', train: '火车' },
    vehiclesMany: { bus: '公交车', trolley: '有轨电车', busTrolley: '公交车或有轨电车', train: '火车' },
    routes: (list) => `线路：${list}。`,
    route: (name) => `线路 ${name}。`,
    howOften: '多久一班',
    every: (vehicle, minutes) => (minutes <= 1 ? `约每分钟一班${vehicle}` : `约每 ${formatNumber(minutes)} 分钟一班${vehicle}`),
    only: (one, many, n) => `只有 ${formatNumber(n)} 班${n === 1 ? one : many}`,
    peak: (text) => `工作日早上 7 点到 9 点：${text}。`,
    midday: (day, text) => `${day}，上午 10 点到下午 2 点：${text}。`,
    noService: (day) => `${day}，上午 10 点到下午 2 点：没有服务。`,
    days: { wk: '工作日', sa: '星期六', su: '星期日' },
    trips: (wk, sa, su) => `典型的工作日有 ${plural(wk, { other: '# 班发车' })}，星期六 ${formatNumber(sa)} 班，星期日 ${formatNumber(su)} 班。`,
    busiest: (n) => `工作日最忙的一个小时：${plural(n, { other: '# 班发车' })}。`,
    firstLast: (first, last) => `工作日首班车 ${first} 发车，末班车 ${last} 发车。`,
    afterMidnight: (time) => `午夜过后 ${time}`,
    allNight: '工作日通宵运行。',
    evening: (n) => (n === 0 ? '工作日晚上 8 点以后没有发车。' : `工作日晚上 8 点以后：${plural(n, { other: '# 班发车' })}。`),
    noWeekday: '工作日没有服务。',
    riders: '乘客',
    boardings: (n, period) =>
      n === 0
        ? `平均每个工作日，这里几乎没有人上车（SEPTA 的统计，${period}）。`
        : `平均每个工作日，约有 ${plural(n, { other: '# 人' })}在这里上车（SEPTA 的统计，${period}）。`,
    countedAt: (id) => `在 SEPTA 站点 ${id} 统计，本站取代了那个站点。`,
    noBoardings: 'SEPTA 还没有这个车站的统计。新设和重新编号的车站，要等 SEPTA 公布下一次统计时才会有。',
    noStationCounts: 'SEPTA 不公布每个地铁或 El 高架线站台的统计。',
    noRailCounts: 'SEPTA 每年按车站统计 Regional Rail 的乘客；本地图暂时还不显示这些统计。',
    stopNumber: (id) => `SEPTA 站点编号 ${id}。`,
    formerNumbers: (ids) => `在此之前，它是 SEPTA 站点 ${ids}。`,
    wheelchair: {
      1: 'SEPTA 列出这个车站轮椅可以到达。',
      2: 'SEPTA 列出这个车站轮椅无法到达。',
    },
    source: '来自 SEPTA 典型一周的时刻表。等候时间是平均值：公交车会扎堆，间隔会变长。',
  },

  stopAmenities: {
    unnamed: '在 OpenStreetMap 中没有名称的车站',
    number: (ref) => `站点编号 ${ref}`,
    served: { 1: '公交站', 2: '有轨电车站', 3: '公交和有轨电车站' },
    comfort: {
      3: '有候车亭，或整个车站在屋顶下',
      2: '有长椅，但地图上没有候车亭',
      1: '没有候车亭，也没有长椅',
      0: '尚未调查',
    },
    factsTitle: 'OpenStreetMap 上的信息',
    answers: {
      sh: '候车亭',
      bn: '长椅',
      bi: '垃圾桶',
      lt: '夜间有照明',
      tp: '为视障者设置的盲道',
      wc: '轮椅通行',
      db: '发车信息牌',
      cv: '整个车站在屋顶下',
    },
    yes: '是',
    no: '否',
    limited: '有限',
    unknown: '尚未调查',
    nearby: '单独标注在车站旁边',
    unknownNote: '“尚未调查”是指还没有人记录，并不表示这个车站什么都没有。',
    survey: '如何用 StreetComplete 调查这个车站',
    openOsm: '在 OpenStreetMap 上查看这个车站',
    surveyRoute: '用可打印的调查表调查整条线路',
    source: '来自 OpenStreetMap，© OpenStreetMap contributors，每周更新。',
  },

  heat: {
    tractsTitle: {
      vulnerability: '高温脆弱度：高温的程度和面临风险的人群，按人口普查区统计',
      exposure: '高温暴露度：每个人口普查区夏天有多热',
      sensitivity: '高温敏感度：每个人口普查区里有多少人在高温中面临风险',
    },
    fifths: {
      vulnerability: ['脆弱度最低的五分之一', '较不脆弱', '中间的五分之一', '较脆弱', '脆弱度最高的五分之一'],
      exposure: ['最凉的五分之一', '较凉', '中间的五分之一', '较热', '最热的五分之一'],
      sensitivity: ['面临风险的人最少的五分之一', '较少', '中间的五分之一', '较多', '面临风险的人最多的五分之一'],
    },
    priority: '加粗轮廓：市政府评定高温脆弱度非常高的人口普查区',
    tractsNone: '指数没有报告的人口普查区，例如大型公园和机场，保持空白。',
    tractsSource: '来自市政府的高温脆弱性指数（公共卫生局和可持续发展办公室），2017 年到 2019 年的数据。',
    treeBig: '市政府的一棵树：圆点越大，树干越粗',
    treeSmall: '一棵小树，常常是需要浇水的幼树',
    treesZoom: '请放大到几个街区的范围，才能看到树。',
    treesYards: '私人院子里的树不在市政府的树木清单里，所以一个街区的树荫可能比这里显示的更多。',
    floodHigh: '年概率 1% 的洪泛区：每年至少有百分之一的可能发生洪水',
    floodway: '行洪道：保持畅通、让洪水通过的河道',
    floodModerate: '年概率 0.2% 的区域：每年有五百分之一的可能',
    floodCare: '这是需要谨慎的理由，从不计入评分：那里种的植物必须耐得住潮湿的土地，任何建造都要遵守市政府的洪泛区规定。',
    treeUnnamed: '清单里没有注明树种的树',
    treeTrunk: (inches) => `离地面约胸高处，树干直径约 ${formatNumber(inches)} 英寸。`,
    treeNoTrunk: '清单里没有给出树干的粗细。',
    treeYoung: 'TreePhilly 表示，幼树从 3 月到 12 月，每周大约需要 20 加仑水。',
    treesHere: (n) => `此处有 ${plural(n, { other: '# 棵树' })}`,
    treeSource: '来自公园与休闲局的树木清单，也就是市政府在街道和公园里养护的树。',
  },

  art: {
    legend: {
      mural: '壁画和墙面绘画',
      sculpture: '雕塑和雕像',
      mosaic: '马赛克镶嵌画',
      other: '其他类型：装置艺术、喷泉、纪念碑等',
    },
    allOff: '这个图层的设置里，每一种艺术类型都已关闭。',
    insideHidden: '建筑物内的作品已隐藏。',
    memorialNote: '纪念某个人的艺术作品，显示时不带姓名。',
    coverage:
      '来自市政府的“艺术百分比”（Percent for Art）名单、OpenStreetMap 和 Wikidata。许多壁画还没有收进去；Mural Arts Philadelphia 在自己的网站上保存着最大的名单。',
    kinds: {
      0: '一件公共艺术作品',
      1: '一幅壁画',
      2: '一幅绘画',
      3: '街头艺术',
      4: '一幅马赛克镶嵌画',
      5: '一件雕塑',
      6: '一尊雕像',
      7: '一尊半身像',
      8: '一件浮雕',
      9: '一件装置艺术',
      10: '一座喷泉',
      11: '一座纪念碑',
      12: '一件纪念性作品',
      13: '彩色玻璃',
      14: '一块牌匾',
    },
    untitled: '没有记录标题。',
    by: (artist) => `作者：${artist}。`,
    made: (year) => `${year} 年制作。`,
    medium: (medium) => `材质：${medium}。`,
    where: (place) => `位置：${place}。`,
    inside: '在建筑物内，所以只有建筑物开放时才能看到。',
    memorialTitle: '纪念性艺术作品',
    memorialText: '这件作品纪念某个人。Placekeepers 不在纪念作品上显示姓名；下面的来源有更多介绍。',
    worksHere: (n) => `此处有 ${plural(n, { other: '# 件艺术作品' })}`,
    sourcesTitle: '来源',
    cityRecord: '市政府对这件作品的记录（PDF）',
    cityList: '市政府的“艺术百分比”名单',
    openOsm: '在 OpenStreetMap 上查看',
    openWikidata: '在 Wikidata 上查看',
    openWikipedia: '在维基百科上阅读介绍',
    website: (site) => `更多介绍，请见 ${site}`,
    siteNames: {
      'associationforpublicart.org': 'Association for Public Art 的网站',
      'muralarts.org': 'Mural Arts Philadelphia 的网站',
      'philart.net': 'philart.net',
    },
    muralArts: '搜索 Mural Arts Philadelphia 自己的壁画名单',
    fix: '缺了什么或有错误？请在 OpenStreetMap 上补充或更正；更改大约一周内会出现在这张地图上。',
    fixLink: '在 OpenStreetMap 上编辑',
    credit: '公共艺术数据来自费城市政府、OpenStreetMap（© OpenStreetMap contributors）和 Wikidata。',
  },

  survey: {
    pageTitle: '调查一条线路',
    intro:
      '选一条 SEPTA 公交或有轨电车线路和一个方向，就能得到一份调查表：它在费城境内的车站（按顺序）、OpenStreetMap 目前在每个车站显示的内容，以及要填写的格子。可以打印出来，也可以在路上用手机勾选。',
    guideLink: '如何调查公交站',
    loading: '正在加载线路……',
    loadFailed: '无法加载线路列表。请检查网络连接后再试。',
    notPublished: '调查表尚未发布。下一次每周更新之后就会出现。',
    sheetFailed: '无法加载这条线路的调查表。请检查网络连接后再试。',
    retry: '再试一次',
    routeLabel: '线路',
    routePlaceholder: '选择一条线路',
    buses: '公交线路',
    trolleys: '有轨电车线路',
    directionLabel: '方向',
    partsLabel: '分给',
    partsChoice: (n) => (n === 1 ? '一个人或一组搭档' : `${formatNumber(n)} 个人或搭档组`),
    directionTo: (dir, to) => `${dir}，开往 ${to}`,
    towards: (to) => `开往 ${to}`,
    directionNumber: (n) => `方向 ${n}`,
    stopCount: (n) => plural(n, { other: '# 个车站' }),
    title: (route, direction) => `线路 ${route}，${direction}`,
    summary: (stops, miles) => `费城境内共 ${plural(stops, { other: '# 个车站' })}，从第一个到最后一个，直线距离合计 ${miles}。`,
    outside: (n) => `另有 ${plural(n, { other: '# 个车站' })}在费城以外，不在这份调查表上。`,
    answersMissing: '目前无法加载 OpenStreetMap 在这些车站的信息，所以它已知的车站都显示为尚未调查。',
    statusTitle: 'OpenStreetMap 目前显示的内容',
    status: {
      shelter: '有候车亭',
      bench: '只有长椅',
      neither: '都没有',
      unsurveyed: '尚未调查',
      missing: '在 OpenStreetMap 中找不到',
    },
    statusLong: {
      shelter: '有候车亭或屋顶',
      bench: '有长椅，地图上没有候车亭',
      neither: '两者都没有',
      unsurveyed: '在 OpenStreetMap 里有，但尚未调查',
      missing: '在 OpenStreetMap 中找不到',
    },
    estimateTitle: '需要多长时间',
    estimate: (time) => `我们的估计：一个人或一对搭档需要 ${time}。`,
    estimateBasis:
      '这是我们自己的估计，不是实测：从一个车站走到下一个车站，按每小时约 3 英里计算，每个车站再停留约一分钟。前往第一个车站和回家的时间另算。',
    trolleyTunnel:
      'T1 到 T5 有轨电车线路在中心城一端走地下隧道，从 13 街到 37 街设有车站。请不要调查这些车站：这项调查针对的是街面上的车站。',
    asOf: (osm, schedules) =>
      [osm ? `OpenStreetMap 显示的内容截至 ${osm}。` : null, schedules ? `车站来自 SEPTA 的时刻表（${schedules}）。` : null]
        .filter(Boolean)
        .join(''),
    print: '打印调查表',
    printAll: '打印每一部分',
    printPart: (n) => `只打印第 ${n} 部分`,
    part: (n, of) => `第 ${n} 部分，共 ${of} 部分`,
    partStops: (first, last) => (first === last ? `第 ${first} 站` : `第 ${first} 站到第 ${last} 站`),
    partEstimate: (time, miles) => `我们的估计：${time}（步行 ${miles}）。`,
    sheetFor: (route, direction) => `调查表：线路 ${route}，${direction}`,
    howToFill:
      '对您在车站发现的每一项，勾选“是”或“否”。“有灯”是指夜间有光照在车站上：候车亭里有灯，或旁边紧挨着有路灯。“需要修理”是指候车亭、长椅、站牌或垃圾桶损坏。如果无法判断，请把格子留空：千万不要猜。',
    nameLine: '姓名：',
    dateLine: '日期：',
    columns: {
      number: '#',
      stop: '车站',
      now: 'OpenStreetMap 现状',
      sh: '候车亭',
      bn: '长椅',
      bi: '垃圾桶',
      lt: '有灯',
      rp: '需要修理',
      nt: '备注',
    },
    yes: '是',
    no: '否',
    yesShort: '是',
    noShort: '否',
    stopNumber: (sid) => `SEPTA 站点 ${sid}`,
    answerLabel: (n, name, question, answer) => `第 ${n} 站，${name}：${question}，${answer}`,
    repairLabel: (n, name) => `第 ${n} 站，${name}：需要修理`,
    notesLabel: (n, name) => `第 ${n} 站，${name}：备注`,
    openOsm: '在 OpenStreetMap 上查看',
    editOsm: '编辑',
    answered: (n, of) => `在这台设备上，您已填写了 ${formatNumber(n)} 个，共 ${plural(of, { other: '# 个车站' })}。`,
    kept: '您在这里勾选和输入的内容，只保存在这台设备的这个浏览器里。不会发送到任何地方。',
    notKept: '此浏览器没有保存您勾选的内容，所以离开页面后就会丢失。请打印调查表，或把内容写下来。',
    clear: '清除我填写的内容',
    clearConfirm: '要清除您为这个方向填写的每个格子和备注吗？',
    safetyTitle: '出发之前：注意安全',
    safety: [
      '请待在人行道上。绝不要站在马路上，也不要为了看站点而走进公交专用道。',
      '请在白天去，并和朋友结伴同行。',
      '看这份调查表或手机之前，请先停下脚步；过马路之前，请先抬头看路。',
      '请让开一点，方便乘客候车和上车。不要拍摄人。',
    ],
    answersTitle: '把您的答案放进 OpenStreetMap',
    withApp: '使用 StreetComplete 应用：站在每个车站时，回答它关于这个车站的问题。您的答案会直接进入 OpenStreetMap。',
    withoutApp: '没有手机应用时，回家后在电脑上使用 OpenStreetMap 自己的编辑器：',
    editorSteps: [
      '登录 openstreetmap.org。账户是免费的。',
      '再次打开本页，使用每个车站旁边的“编辑”链接。编辑器会打开，并选中该车站。',
      '在左侧面板里，点击“Shelter”（候车亭）框。在“Add field:”（添加字段）下，添加 Bench（长椅）、Waste Bin（垃圾桶）和 Lit（有灯），并同样点击它们的框。每点一次，框就会变一次：是，然后否，再回到未知。',
      '点击 Save（保存），写一句简短的说明，例如“Surveyed bus stop shelters and benches”（调查了公交站的候车亭和长椅），然后点击 Upload（上传）。',
    ],
    notFound:
      '调查表上写着“在 OpenStreetMap 中找不到”的地方，请先在编辑器里仔细看看车站周围：它可能画在几步之外。如果确实没有，请点击“Point”（点），把点放在人行道上、紧靠车站站牌的位置，并选择 Bus Stop（公交站）。',
    repairNote:
      'OpenStreetMap 不记录损坏情况，所以“需要修理”和您的备注只留在您的小组里。当您就某个车站与 SEPTA 或市政府沟通时，它们会派上用场。',
    updates: 'Placekeepers 每周一读取一次 OpenStreetMap，所以您的答案大约一周内就会出现在我们的地图和这些调查表上。',
    printedFrom: '由 Placekeepers 打印，这是给费城邻居的免费地图。车站来自 SEPTA；地图数据 © OpenStreetMap contributors。',
    routeTitle: (route) => `线路 ${route}`,
    routesHere: (n) => `这里有 ${plural(n, { other: '# 条线路' })}`,
    surveyThisRoute: '调查这条线路各车站的候车亭和长椅',
  },

  amenities: {
    legend: {
      benches: '长椅',
      picnic_tables: '野餐桌',
      drinking_water: '饮用水',
      toilets: '公共厕所',
      bookcases: '社区小型图书亭（Little Free Library）',
    },
    mappedNote: '这里只显示有人添加到 OpenStreetMap 的内容，所以缺少的还有很多。',
    addMissing: '如何补充缺少的内容',
    titles: {
      benches: '长椅',
      picnic_tables: '野餐桌',
      drinking_water: '饮用水',
      toilets: '公共厕所',
      bookcases: '社区小型图书亭',
    },
    facts: {
      br: ['有靠背', '没有靠背'],
      cv: ['在屋顶下', '不在屋顶下'],
      bt: ['可以在这里灌水瓶', '不能灌水瓶'],
      sn: ['只在一年中的部分时间提供', '全年提供'],
      in: ['室内', '室外'],
      fee: ['需要付费', '免费'],
      ct: ['有换尿布台', '没有换尿布台'],
    },
    access: { 1: '向所有人开放', 2: '仅供顾客使用' },
    wheelchair: {
      1: '轮椅可以到达',
      0: '轮椅无法到达',
      2: '轮椅通行受限',
    },
    hours: (text) => `地图上标注的开放时间：${text}`,
    nothingMore: 'OpenStreetMap 目前没有更多关于它的信息。',
    unknownNote: '没有列出的内容，是指目前还不清楚，并不表示答案是“没有”。',
    openOsm: '在 OpenStreetMap 上查看',
    fix: '缺了或有错误？如何更正',
    source: '来自 OpenStreetMap 上的标注，© OpenStreetMap contributors，每周更新。',
  },

  places: {
    legend: {
      park_water: '公园里的饮水器',
      libraries: '一家 Free Library 分馆',
      recreation_centers: '一个休闲中心',
      playgrounds: '一个儿童游乐场',
    },
    poolLegend: { 1: '一个游泳池', 2: '一个喷水游乐区', 3: '一个洒水器' },
    notInService: '今年不开放',
    poolsShown: { in_service: '只显示今年开放的。', all: '空心圆圈表示今年不开放。' },
    recreationKinds: {
      1: '休闲中心',
      2: '长者中心',
      3: '环境教育中心',
    },
    poolKinds: { 1: '游泳池', 2: '喷水游乐区', 3: '洒水器' },
    waterKinds: { 1: '饮水器', 2: '水瓶灌水站' },
    status: { 1: '今年开放', 0: '今年不开放' },
    statusUnknown: '公园与休闲局没有说明它今年是否开放。',
    indoor: { 1: '室内', 0: '室外' },
    waterIndoor: '在建筑物内：建筑物开放时才能用。',
    accessible: { 1: '列为残障人士可使用', 0: '没有列为无障碍' },
    opened: (date) => `本季于 ${date} 开放。`,
    gym: '设有健身房。',
    noBuilding: '这是一个没有自己建筑的活动地点。',
    inPark: (park) => `位于 ${park}。`,
    phone: (number) => `电话：${number}`,
    libraryPage: '在 Free Library 网站上查看开放时间和活动',
    seasonNote: '游泳池只在夏天开放。本周的开放时间，请向公园与休闲局查询。',
    source: {
      libraries: '来自市政府的费城 Free Library 各分馆名单。',
      parks: '来自费城公园与休闲局，与市政府公布的一致。',
    },
    cooling: {
      legendOpen: '列为开放的取暖或纳凉场所',
      legendClosed: '列为关闭，或没有状态',
      kindShown: {
        any: '天热和天冷时的场所。',
        cooling: '只显示纳凉场所，供天热时使用。',
        warming: '只显示取暖场所，供天冷时使用。',
      },
      asListed: (copied, changed) =>
        `${copied ? `这是市政府在 ${copied} 的名单内容` : '这是本地图上次复制名单时，市政府名单上的内容'}${changed ? `（名单最近一次更改在 ${changed}）` : ''}。这不是实时信息：场所会随天气开放或关闭，所以出发前请先打电话问问该场所或拨打 311。`,
      oneMarker: '同时也是取暖或纳凉场所的图书馆或休闲中心，只显示一次，按场所显示。',
      kinds: {
        1: 'Free Library 分馆',
        2: '公园与休闲局的场所',
        3: '社区合作伙伴',
        4: '费城住房管理局的社区中心',
      },
      title: '取暖或纳凉场所',
      status: { 1: '列为开放', 0: '列为关闭' },
      statusUnknown: '没有列出状态',
      both: '列为取暖和纳凉场所',
      cooling: '列为纳凉场所',
      warming: '列为取暖场所',
      neither: '没有列为取暖或纳凉场所',
      hours: (hours) => `名单上的开放时间：${hours}`,
      services: (services) => `名单上列出的服务：${services}`,
      capacity: (n) => `名单上写着可容纳 ${formatNumber(n)} 人`,
      water: '设有饮水站',
      restroom: '设有公共洗手间',
      also: {
        lib: (name) => `同时也以 Free Library 分馆的身份出现在地图上：${name}。`,
        rec: (name) => `同时也以公园与休闲局场所的身份出现在地图上：${name}。`,
      },
      alsoSite: '市政府也把它列为取暖或纳凉场所。',
    },
    playgrounds: {
      kind: '儿童游乐场',
      ages: { 1: '适合 2 到 5 岁', 2: '适合 5 到 12 岁', 3: '适合 2 到 12 岁' },
      installed: (year) => `${year} 年设置`,
    },
  },
};

export default zhHans;
