# Glossary for the Chinese (simplified characters) translation, zh-Hans

Each key term is written one way in the interface catalog (`web/src/i18n/locales/zh-Hans.ts`), the
registry text (`registry/i18n/zh-Hans.yaml`) and the content pages (`content/zh-Hans/`). A reviewer
or a later translator should change a term here first, then everywhere it appears.

## How the text is written

- Standard written Chinese (Mandarin) in simplified characters. Plain and polite: 您 where the
  reader is addressed directly, short sentences, words a neighbor in Chinatown or the Northeast
  would use.
- Full width punctuation (，。：；？！（）“”) and no spaces between Chinese words. One space
  between Chinese characters and Latin letters or digits ("OpenStreetMap 上", "20 英尺", "每 15 分钟"),
  none next to punctuation.
- Dates and years follow one rule everywhere (decided in the second catch up pass, 2026-10-22).
  The browser writes a date with no spaces ("2026年10月5日"), so a date is Chinese text: it is written
  the same way when we type it ("2025年7月9日", "2023年到2025年", "3月到12月", "30年的抵押贷款"),
  and a template puts no space between a date placeholder and the Chinese around it
  (`在${date}核查` style: "于${date}指定", "${date}的每周快照"). Digits that are not a date or a
  year keep the digit spacing rule ("上午 10 点", "每 15 分钟", "约 1 小时 15 分钟"). A year placeholder
  written by a template carries 年 ("${year}年", "${a0}年到${a1}年"). Times of day from the formatter
  ("2:14 PM") are Latin text and keep their spaces.
- No dashes as punctuation (the tests enforce it). Ranges are written with 到 ("5月到10月").
- Numbers use Western digits, as the site formats them. Distances and amounts keep the units the
  City uses: 英尺, 英里, 加仑, 美元; metric where English says meters (米) or kilometers (公里).
- Proper names stay in English: Placekeepers, Philly311, PHS LandCare, Community LandCare, SEPTA,
  PennDOT, OTIS, PHDC, Fraud Guard, Tangled Title Fund, Philadelphia VIP, Garden Justice Legal
  Initiative, Neighborhood Gardens Trust, Free Library, Mural Arts, StreetComplete,
  OpenStreetMap, and the names of other nonprofits and programs. A Chinese gloss goes in
  parentheses where a page first needs it.
- The memorial removal email's subject and body are never translated (the tests require it).

## The City's own Chinese names (phila.gov/zh, looked up 2026-10-21)

Where the City publishes a Chinese name in simplified characters, we use it, even where a plainer
word exists, so a neighbor who then visits phila.gov finds the same words.

| English | Chinese | Where the City uses it |
|---|---|---|
| Homestead Exemption | 宅基地豁免 (we add "Homestead Exemption" in parentheses where it first appears) | phila.gov/zh page "获得宅基地豁免" |
| Longtime Owner Occupants Program (LOOP) | 长期业主居住者计划 (LOOP) | phila.gov/zh page "申请长期业主居住者计划 (LOOP)" |
| Department of Licenses and Inspections | 执照和检查部 (L&I) | phila.gov/zh department page |
| Department of Planning and Development | 规划与发展部 | phila.gov/zh department page |
| Department of Sanitation | 卫生部 (we add "Department of Sanitation" in parentheses, because 公共卫生部 is Public Health) | phila.gov/zh page of the Philadelphia More Beautiful Committee |
| Philadelphia More Beautiful Committee | 费城更美丽委员会 | same page |
| Block Captain | 街区队长 | same page |
| Office of Property Assessment | 财产评估办公室 (part of 税务局) | Homestead Exemption page |
| Department of Revenue | 税务局 | Homestead Exemption page |
| Registered Community Organization (RCO) | 注册社区组织 | phila.gov/zh RCO page |
| Zoning Board of Adjustment | 分区调整委员会 | phila.gov/zh RCO page |
| Philadelphia Land Bank | 费城土地银行 (short form: 土地银行) | Land Management dashboard page |
| Land Management dashboard | 土地管理仪表板 | the dashboard's page title |
| City Council | 市议会 | phila.gov/zh |
| Philadelphia (the city, the City government) | 费城, 费城市政府, 市政府 | phila.gov/zh |

Departments the City writes with 部 (执照和检查部, 规划与发展部) are written the same way for the
ones phila.gov/zh did not show us, so they match: 街道部 (Streets Department), 公园与休闲部 (Parks
and Recreation), 水务部 (Water Department), 公共卫生部 (Department of Public Health), 记录部
(Department of Records). These four are our rendering, not a name we found on the City's site.

## Key terms

| English | Chinese | Note |
|---|---|---|
| vacant lot | 空地 | |
| vacant building | 空置建筑 | |
| vacant parcel | 空置地块 | |
| parcel, lot (the piece of land) | 地块 | the chip "Lots" is 地块 |
| owner | 业主 | |
| owner of record | 登记业主 | |
| neighbor | 邻居 | |
| care (the project's framing) | 关怀 | "where care is needed most": 最需要关怀的地方 |
| lens | 视角 | the lenses are named 减少暴力, 高温和树荫, 场所营造, 街道安全, 公交舒适度 |
| lens blend | 视角组合 | |
| factor, weight, score, priority | 因素, 权重, 评分, 优先度 | |
| preset | 预设 | |
| layer | 图层 | |
| legal or lawful route | 合法途径 | |
| first lawful step | 第一个合法步骤 | |
| displacement (residents pushed out) | 居民迁离 | |
| displacement watch, displacement watch area | 迁离关注, 迁离关注区 | card title 迁离关注 |
| greening | 绿化 | "clean and green": 清理并绿化 |
| placemaking | 场所营造 | |
| gentrification | 绅士化 | used in the conservatorship warning |
| conservatorship, conservator | 财产托管, 托管人 | with "(conservatorship)" beside the first use in a passage |
| Act 135 | Act 135 | kept in English |
| side yard, rear yard | 侧院, 后院 | |
| adverse possession | 逆权占有 | |
| quiet title lawsuit | 确认产权的诉讼 (quiet title) | |
| tangled title | 产权纠葛 | |
| deed | 契据 | |
| deed theft, deed fraud | 契据盗窃, 契据欺诈 | |
| sheriff sale | 治安官拍卖 | |
| possible estate | 可能是遗产名下的房产 | never says the owner died |
| absentee owner flag | 业主的邮件寄往别处 | |
| affordable (housing, land) | 平价 | |
| brownfield | 棕地 | |
| floodplain | 洪泛区 | |
| zoning, overlay | 分区, 叠加区 | "Zoning Code": 《分区法规》 |
| Historical Commission | 历史委员会 | |
| appeal, hearing | 申诉, 听证会 | |
| memorial (a marker) | 纪念点 | "memorial garden": 纪念菜园 |
| ghost bike | 幽灵单车 | |
| People shot | 中枪 | never 受害者 as a ranking word |
| killed | 遇难 | for people |
| crash | 交通事故 | |
| High Injury Network | 高伤害路网 | |
| traffic calming | 交通减速措施 | speed cushion, hump, table: 减速垫、减速丘、减速台 |
| school crossing guard | 学校过街协管员 | |
| street block | 街道路段 | |
| census tract, block group | 人口普查区, 街区组 | |
| stop, shelter, bench | 车站 (公交站), 候车亭, 长椅 | |
| trolley | 有轨电车 | |
| subway or El | 地铁或 El 高架线 | |
| Regional Rail | Regional Rail（区域铁路） | |
| survey (a stop) | 调查 | "not yet surveyed": 尚未调查 |
| weekly snapshot | 每周快照 | |
| live City data | 市政府实时数据 | the setting "Fetch live City data": 获取市政府实时数据 |
| Then and now (layer group) | 过去与现在 | |
| redlining | 划红线 (redlining) | |
| evidence badges | 证据充分, 证据中等, 证据不一, 证据薄弱, 与暴力无关, 背景 | a badge is a 标签 |
| license | 授权条款 | a named license is "GPL-3.0 许可证" |
| report a correction | 报告更正 | |
| GitHub issue | GitHub 议题 | |
| flyer (for neighbors) | 传单 | the page label is "制作给邻居的传单" |
| packet (to print or share) | 资料包 | |
| letter (the four templates) | 信 | the letters print in Chinese, see the note below |
| ward, division | 选举区（ward）, 投票分区（division） | |
| committee people | 党派委员会成员（committee people） | |
| representatives, offices | 市议员, 州众议员, 州参议员, 国会议员 | |
| projects neighbors finished | 邻居们完成的项目 | the layer and its form |
| QR code | 二维码 | |
| Redevelopment Authority | 重建管理局 | our rendering, not the City's |
| Philadelphia Housing Development Corporation | 费城住房发展公司 (PHDC) | our rendering; PHDC alone on the City's site |
| Philadelphia Housing Authority | 费城住房管理局 | our rendering |

## Word for word passages (docs/ETHICS.md)

Each passage is one fixed block of text, the same in the catalog, the registry and the pages.

- Possible estate: 登记业主可能已经去世。家属可能仍然对这处房产享有权利，而且自己可能并不知道。如果您认识这家人，Tangled Title Fund（最高 6,500 美元的法律援助）和 Philadelphia VIP 可以帮助他们保住房产。家属也可以注册市政府免费的 Fraud Guard 提醒。
- Conservatorship warning: 财产托管（conservatorship）可能让业主失去自己的房产。研究人员发现，它在面临绅士化的社区中被不成比例地使用。在您考虑这条途径之前，请先与 Garden Justice Legal Initiative 谈一谈。
- Deed fraud notice: 契据盗窃是指有人提交一份伪造的契据来夺取房产，常常是业主已经去世或住在别处的房产。业主和家人可以注册市政府免费的 Fraud Guard 提醒：每当有文件登记了他们的姓名，就会收到一封电子邮件。自2025年11月起，市政府还会自动拦截卖方在据称签署契据时已经去世的契据。
- Displacement caution (greening): 绿化可能会抬高附近的价格。请考虑同时配套保护措施。
- Displacement caution (gardens, seating and art): 新的花园、座椅和艺术作品，可能让一个街区更受追捧，并抬高附近的价格和租金。请配套保护措施，保护租房或拖欠税款的邻居。
- Brownfield soil note: 这个地址或其附近，有联邦棕地评估或清理的记录。在种植食物之前，请先检测土壤。

## Changes made by the back translation check (2026-10-21)

The back translation check (docs/i18n/check-zh-Hans.md) changed these wordings. A reviewer who
changes them again should change every place the passage appears.

- The greening caution now reads "请考虑同时配套保护措施" for "Consider pairing it with protections".
  It was "建议同时配套一些保护措施": "建议" (recommend) is stronger than "consider", and "一些"
  (some) hedged the protections.
- The deed fraud notice and the matching bullet on the How to do it page now say the City blocks
  "卖方在据称签署契据时已经去世的契据" (deeds whose seller had already died). They said "这样的契据"
  (such deeds) before, which could be read as every forged deed, and so promise more protection than
  the City gives.
- "Quick resales" (fast_resales.careful) now says someone may be buying and selling the property
  "来牟利" (for profit). "倒卖牟利" carries a sense of illegal profiteering that the English does not.
- "Sponsor" (a nonprofit sponsor for a Community Garden License) stays "担保" for now; see the open
  question in the check report, since "担保" can read as a legal guarantor.

## Known weak spots

- 宅基地豁免 is the City's own wording, but 宅基地 usually means a rural house plot, so the
  English name stays beside it.
- The survey sheet's time and distance ("about 1 hour 15 minutes", "0.4 miles") come from code
  that writes English (`web/src/survey/sheet.ts`), so they appear in English inside a Chinese
  sentence.

## Added in the catch up pass (2026-10-22)

- The letters (`letters.*`) are translated into Chinese, so a letter filled in on a Chinese page
  prints in Chinese. An owner or a Council office may read only English, so the orchestrator may
  want an English print option later.
- The safety lines are kept firm: the letters' "A lawyer has not reviewed this letter yet. It is not
  legal advice" (律师还没有审阅过这封信。它不构成法律意见。), the flyer's "what you print is
  public" warning, the posting rules (never on poles, street lights, traffic signs, trees or SEPTA
  shelters) and the project photo rule (never a child's face, never anyone who did not agree, never a
  license plate).
