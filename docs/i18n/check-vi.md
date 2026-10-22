# Vietnamese back translation check (vi)

Checked on 2026-10-21 for issue #49, part B, on branch `agent/tr-vi` after merging `main`. The
check covers `web/src/i18n/locales/vi.ts`, `registry/i18n/vi.yaml` and `content/vi/*.md`.

## How it was done

For each item, the Vietnamese was read first and put back into English without looking at the
English source. Only then was the English opened and the two compared. Each item was classed as
same meaning, softened, strengthened, changed, or a wrong fact (a number, phone, address, date,
dollar amount or office name).

Numbers, phone numbers, email addresses, web addresses and dates were also compared by script
against the English for every key, every registry text and every page. Every difference was a
month written as a word in English and as a number in Vietnamese ("tháng 9"), and each of those
was read and found right. The scripts are not kept in the repository.

## What was checked

| Group | What | Items |
|---|---|---|
| 1. ETHICS word for word passages | The six passages, in every place they appear | 6 passages, 15 places |
| 2. Legal routes | Every route in `routes:` of `registry/i18n/vi.yaml`: labels, who, cost, timeline, warning, steps and link labels | 24 routes, 201 texts |
| 3. Safety and caution wording | Catalog keys (owner flags with their careful and next lines, actions, unsafe and imminently dangerous warnings, memorials, survey safety tips, not legal advice lines, deed history, rules, appeals, Land Bank numbers and more) | 1,402 keys |
| | Registry text outside the routes: suggestions, lenses, layers, groups, partners and the live data option | 19 suggestions (57 texts), 5 lenses (74 texts), 41 layers (82 texts), 16 groups, 8 partners, 1 option |
| | Content pages: Terms, Privacy, Use this responsibly, How to do it, Survey bus stops, About, Contact, Why this works, How we find vacant land | 9 pages, 327 paragraphs, list items and table rows |

The places of group 1: possible estate (the three catalog lines, and the Use this responsibly
quote); conservatorship warning (the catalog key, `routes.conservatorship.warning`, the How to do
it page, the Use this responsibly quote); deed fraud notice (the catalog key, the Use this
responsibly paragraph); greening caution (the catalog key, the Use this responsibly quote); gardens,
seating and art caution (the catalog key, the Use this responsibly quote); brownfield soil note (the
catalog key, the map note `rulesMap.notes.brownfields`, the brownfield layer text).

The 526 catalog keys not read word by word are map labels with no safety wording (transit, art,
amenities, heat, walk reach bins, status, lists and similar). Their numbers were compared by script.

## Result

Group 1: all six passages mean exactly what the English means. The possible estate lines never say
the owner died, the conservatorship warning keeps its three sentences, the deed fraud notice keeps
the November 2025 check, both displacement cautions keep their advice to pair with protections, and
the soil note says "test the soil" with no word for clean or safe (its gloss of brownfield, "đất
từng dùng cho công nghiệp, có thể còn ô nhiễm", strengthens the caution).

Group 2: all 24 routes mean what the English means. Every dollar amount, percentage, phone number,
email address, office name, deadline and date matched, and the steps lists are as long as the English.

Group 3: four changes of meaning were found and fixed (the first four rows below). Five more items
were left as they are and are listed for a native speaker. Nothing in the three groups says or
implies the owner certainly died or has no heirs, calls a brownfield clean or safe, suggests police
or enforcement, hints at a price or how easy a lot is to take, or drops a protective step.

## Items that were not "same meaning"

| Key or place | Vi text | Back translation | English | What was done |
|---|---|---|---|---|
| `dossier.rules.basePending` (strengthened) | Một dự luật đang chờ ở Hội đồng Thành phố sẽ thay đổi nó. | A bill waiting in City Council will change it. | A bill pending in City Council would change it. | Fixed. A pending bill sounded certain to pass. Now "Một dự luật đang chờ ở Hội đồng Thành phố, nếu được thông qua, sẽ thay đổi nó." (if it passes, it will change it). |
| `dossier.rules.pending` (strengthened) | Một dự luật đang chờ ở Hội đồng Thành phố, Dự luật 123, sẽ thay đổi nó. | A bill waiting in City Council, Bill 123, will change it. | A bill pending in City Council, Bill 123, would change it. | Fixed the same way: "nếu được thông qua sẽ thay đổi nó". |
| `dossier.history.documents`, the City's deed type that ends in DECEASED (unclear term) | Chứng thư từ một di sản | Deed from a heritage (di sản alone can mean heritage or legacy) | Deed from an estate | Fixed to "Chứng thư từ một di sản thừa kế", the glossary's word for an estate. |
| `content.removalComingSoon` (softened) | ...nên bạn chỉ cần ghi số nhận dạng của nơi tưởng niệm hoặc nơi đó ở đâu... | ...so you only need to write the memorial's id or where it is... | ...so write only the memorial's id or where it is... | Fixed. The English is a privacy instruction, kept away from names in a public issue. Now "nên hãy chỉ ghi" (so please write only). |
| `streets.blessing`, route `ghost_bike_request` (who and first step), How to do it (two places), Use this responsibly | Chỉ khi gia đình đồng ý. | Only when the family agrees. | Only with the family's blessing. | Left. "Blessing" is warmer than "agree", but the protective step is intact: ask the family first. Native speaker to say if "đồng ý" is enough or "đồng ý và ủng hộ" reads better. |
| `dossier.flags.imminently_dangerous.careful` | L&I thấy công trình này có thể sụp đổ bất cứ lúc nào. | L&I found this structure could collapse at any moment. | L&I found the structure could fail at any time. | Left. "Collapse" is narrower than "fail" but keeps the caution, and the next line names falling bricks. |
| `content/vi/contact.md`, first section | Biểu mẫu bằng tiếng Anh, nhưng bạn có thể viết bằng tiếng Việt. | The form is in English, but you can write in Vietnamese. | (no such sentence) | Left, not a safety item. It is a sentence the English does not have and a promise the owner has not made. The owner should confirm or remove it. |
| `redlining.grades.D` (softened) | D, được xếp loại "nhiều rủi ro" ... | D, graded "many risks" ... | D, graded "hazardous" ... | Left, not a safety item. The English quotes the 1937 grade word. Native speaker to say if a closer word than "nhiều rủi ro" exists that does not read as describing a place today. |
| `dossier.rules.zoningGroups.SPECIAL PURPOSE` | ...như công viên, cơ sở tổ chức hoặc sân bay | ...such as parks, organization facilities or the airport | ...such as parks, institutions or the airport | Left, not a safety item. "Cơ sở tổ chức" is stiff for institutions such as hospitals and universities. Native speaker to polish. |

## For a native speaker to look at

1. "Blessing" as "đồng ý" (above), in the memorial wording.
2. "Nguy hiểm cận kề" for "imminently dangerous": it is a literal rendering of L&I's term, and no
   City Vietnamese wording was found to check it against.
3. The gloss "quyền quản lý tài sản thay chủ" for conservatorship: it says "right to manage property
   in the owner's place". The warning sentence beside it carries the severity ("can take a property
   away"), so it was kept, but a native speaker should confirm the gloss does not understate it.
4. "Miễn Thuế Nhà cửa vườn tược" for the Homestead Exemption. It comes from the City's own printed
   Vietnamese form, per the glossary, but reads old fashioned.
5. "Chứng thư" and "đánh cắp chứng thư" for deed and deed theft, which follow the City's deed fraud
   page.
6. The rows above that were left as they are.

## Outside this check

The check ran on `main` as it was when the branch was merged. Since then `main` has moved on, and the
merged English already has text that Vietnamese does not have, so it shows in English:

- 33 `projects.*` keys, the `projects` map layer, two data sources (`project_reports`,
  `project_corrections`), and a section "Tell us about a project you finished" in the English How to do
  it and Contact pages. Two of those keys carry protective wording (`projects.tellUsNote` asks for no
  photo of a child or a license plate, and `projects.privacy` says the map never shows who sent a
  report). A translator should take them next.
- `main` later gained lot packets, "who represents you", letters marked unreviewed and the neighbor
  flyer (M5.1 and M5.2). Their text is not covered here.
