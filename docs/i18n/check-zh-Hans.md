# Back translation check, Chinese (simplified), zh-Hans

Part B of issue #49. Checked on 2026-10-21 by a checker who did not write the translation, on
branch `agent/tr-zh-Hans` after merging main.

Method: for each item, the English back translation was written from the Chinese before reading the
English source, then the two were compared and classed as same meaning, softened, strengthened,
changed, or a wrong fact. The checker is an AI, not a native speaker, so the list at the end is
for a native speaker to look at.

A script also compared every number, date, phone number, email address and web address between the
English and the Chinese in the interface catalog (1,592 strings and 377 template calls, run with
sample values), in the registry text and in the nine pages. Every difference it found was only the
way a date or a unit is written (for example "July 2025" and "2025 年 7 月", or "1 in 500" and
"五百分之一"). No number, phone number, address, date, dollar amount or office name is wrong.

## What was checked

An item is one catalog key or template, one registry field or list entry, or one paragraph, list
item or table row on a page.

**Group 1, the six word for word passages: 6 passages, 18 places.**

| Passage | Places checked |
|---|---|
| Possible estate | 3 catalog keys, the quote on Use this responsibly |
| Conservatorship warning | catalog key, registry `routes.conservatorship.warning`, the quote on Use this responsibly, the italic sentence on How to do it |
| Deed fraud notice | catalog key, the paragraph on Use this responsibly, the three Fraud Guard bullets on How to do it |
| Displacement caution (greening) | catalog key, the quote on Use this responsibly |
| Displacement caution (gardens, seating and art) | catalog key, the quote on Use this responsibly |
| Brownfield soil note | `dossier.rules.brownfield`, the map note `rulesMap.notes.brownfields`, the layer description in the registry |

**Group 2, legal routes in the registry: 24 routes, 201 text items** (97 fields: label, who,
warning, cost, timeline; 68 steps; 36 link labels). Also the 19 suggestions that point to those
routes, 57 strings, since they carry the memorial, report and asphalt art wording.

**Group 3, safety and caution wording.**

| Area | Items checked |
|---|---|
| Owner flags other than possible estate (`dossier.flags.*`, with careful and next lines) | 40 |
| `dossier.actions.*` | 15 |
| Owner notices, owner types and the City's available list (`dossier.owner.*`, `dossier.ownerType.*`, `dossier.listing.*`) | 144 |
| Unsafe and imminently dangerous building wording outside the flags (reasons, history, timeline, plus 2 registry source names) | 29 |
| Displacement text (`displacement.*`, plus the layer and group text) | 75 |
| Rules, flood, historic, zoning and brownfield cautions (`dossier.rules.*`, `rulesMap.*`, `dossier.summary.*`) | 174 |
| Memorial and street wording (`streets.*`, `legend.*`, `art.*`: 138, plus the memorial layer, route and suggestion in the registry: 3) | 141 |
| Survey safety tips and sheet text (`survey.*`) | 92 |
| "Not legal advice", early preview, export and cooling center notes (`app.*`, `export.*`, `places.cooling.*`) | 65 |
| Registry layers, lenses, groups, partners, options and sources | 330 text fields, all read |
| Use this responsibly (49 paragraphs and list items), Terms (15), Privacy (15) | 79 |
| The other six pages: How to do it (84), Survey bus stops (70), Why this works (34), How we find vacant land (24), About (22), Contact (14) | 248 |

## Result

Same meaning: every item in the three groups except the ones in the table below. All six word for
word passages are the ETHICS.md text in meaning. The possible estate passage never says the owner
died ("may have died", "may still have a right", "may not know it"), the soil note never says
clean or safe, and the conservatorship warning, the deed fraud notice and both displacement
cautions carry every part of the English. No owner flag says or implies the owner certainly died or
has no heirs. Nothing suggests police or enforcement, and nothing hints at a price or at how easy a
lot is to take beyond what the English itself says.

Items that were not plain "same meaning":

| Key or place | zh-Hans text | Back translation | English | Class | What was done |
|---|---|---|---|---|---|
| `displacement.caution`, and its quote on Use this responsibly | 绿化可能会抬高附近的价格。建议同时配套一些保护措施。 | Greening may raise nearby prices. It is recommended to pair it with some protective measures. | Greening can raise nearby prices. Consider pairing it with protections. | Slightly changed: "recommend" is firmer than "consider", and "some" hedges "protections" | Now 请考虑同时配套保护措施。 in the catalog and the page quote |
| `dossier.owner.deedFraud`, last sentence | 自 2025 年 11 月起，市政府还会自动拦截这样的契据：卖方在据称签署契据时已经去世。 | Since November 2025 the City also automatically blocks such deeds: the seller had already died when allegedly signing. | Since November 2025 the City also automatically blocks deeds whose seller had already died when they supposedly signed. | Strengthened: "such deeds" comes right after "forged deed", so it reads as every forged deed, which promises protection the City does not give and weakens the push to sign up for Fraud Guard | Now 自动拦截卖方在据称签署契据时已经去世的契据 |
| How to do it, third Fraud Guard bullet | 自 2025 年 11 月 10 日起，市政府会自动拦截任何这样的契据：卖方在据称签署契据的那天已经去世。 | Since November 10, 2025 the City automatically blocks any such deed: the seller had already died on the day of the alleged signing. | the City automatically blocks any deed where the seller was already dead on the date they supposedly signed it | Strengthened, same reason | Now 自动拦截任何卖方在据称签署契据的那天已经去世的契据 |
| `dossier.flags.fast_resales.careful` | 快速转手可能意味着这处房产正被人倒卖牟利，有时还可能涉及伪造的契据。 | Quick turnover may mean the property is being flipped for profit by speculators, and sometimes forged deeds are involved. | Quick resales can mean the property is being traded for profit, and sometimes a forged deed. | Strengthened in tone: 倒卖 means reselling for profit in a speculative or even illegal way, and the English is neutral (the next sentence says it can be ordinary) | Now 有人正在买卖这处房产来牟利 |
| Registry lens `transit_comfort`, factor `no_shelter`, `explain` | 所以一个车站绝不会因为可能有的候车亭而被评为没有 | so a stop will never be rated as having none because of a shelter it might have | so a stop is never scored as missing a shelter it may have | Changed: "because of" reads as the reverse logic | Now 所以绝不会把一个车站评为缺少候车亭，而它其实可能有 |
| Contact page, "Everything else" | 如果有什么不适合上面两份表格 | If something does not fit the two forms above | If anything does not fit the forms above | Wrong fact: Contact now has three forms (the finished projects form came in with M5.3 after this translation was written) | Now 上面的表格, true for two or three forms |
| Registry `land_bank_garden_agreement` (`who` and `cost`), and How to do it, Community Garden License | 有非营利组织担保的团体 ; 需要保险和一位担保人 | groups guaranteed by a nonprofit ; insurance and a guarantor | groups with a nonprofit sponsor ; insurance and a sponsor | Changed slightly: 担保 means to guarantee, a legal liability, where "sponsor" means a supporting organization | Not changed, see the questions below |
| `streets.blessing`, `ghost_bike_request` (who and steps), How to do it (two places), Use this responsibly | 只有得到家属同意才能做。 | Only do it with the family's consent. | Only with the family's blessing. | Slightly firmer (consent, not blessing), and protective | Left as it is |
| `dossier.flags.imminently_dangerous.careful` | L&I 发现这个结构随时可能倒塌。 | L&I found the structure could collapse at any time. | L&I found the structure could fail at any time. | Slightly narrower and stronger (collapse, not fail), and protective | Left as it is |

Also kept: the owner flag texts "unsafe" and "imminently dangerous" keep "do not enter, keep
children away, do not secure it yourself" in full, and both next steps still send the reader to
Philly311, not to the building. The survey safety tips (stay on the sidewalk, never stand in the
street or step into a bus lane, daylight, a friend, stop walking to look at the phone, step aside
for riders, do not photograph people) are all there, on the survey page and on the Survey bus stops
page.

## Files changed

- `web/src/i18n/locales/zh-Hans.ts`: `displacement.caution`, `dossier.owner.deedFraud`,
  `dossier.flags.fast_resales.careful`.
- `registry/i18n/zh-Hans.yaml`: the `no_shelter` explanation.
- `content/zh-Hans/responsibly.md` (the greening caution quote), `how.md` (the Fraud Guard bullet),
  `contact.md` (the form count).
- `docs/i18n/glossary-zh-Hans.md`: the two changed passages, and a short list of what changed.

## Questions for a native speaker

1. **Sponsor, 担保.** Is there a better word for a nonprofit "sponsor" of a Community Garden
   License than 担保 (guarantee)? 支持单位 (supporting organization) or 赞助 may be closer, but
   赞助 suggests money.
2. **棕地 (brownfield).** The term is correct, but would a neighbor with no schooling in planning
   know it? The soil note is fixed word for word, so a gloss such as 棕地（曾受污染或可能受污染的土地）
   would need the owner's agreement.
3. **Blessing, 同意.** Is "consent" the right weight for "the family's blessing", or is there a
   warmer word that does not sound like a legal permission?
4. **Use this responsibly, first paragraph.** "可以帮助一位邻居，落入不当之手，也可能伤害一位邻居"
   keeps the meaning, but the commas read awkwardly. "一旦落入不当之手" may flow better.
5. **Sheriff sale, 清偿.** "得标的出价会清偿房产上的旧债务" says the winning bid pays off the old
   debts. The English says the winning bid clears the old debts on the property. The How to do it page
   says the buyer gets the property "不再带有那些旧债务" (free of those old debts), which is right.
   Check that the two read together.
6. **1937 grade D, 危险.** The grade is quoted as the agency wrote it ("hazardous"), as in the
   English, but it is the one place 危险 describes a neighborhood. Check that the quotation marks
   make that clear.

## Not in scope, but the owner should know

The English added the finished projects feature (M5.3) before this translation was merged, and
that text is still in English in zh-Hans: 33 interface keys (`projects.*`), 6 registry texts
(`layers.projects` and two sources), and the "Tell us about a project you finished" sections of the
Contact and How to do it pages. The How to do it section carries a protective rule for photos
(never the face of a child or of anyone who did not agree, never a license plate). The interface keys
and registry texts show in English until they are translated; the two page sections are simply
missing from the Chinese pages.
