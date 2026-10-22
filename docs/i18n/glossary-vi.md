# Vietnamese glossary (vi)

The key terms of the Vietnamese translation of Placekeepers, so the interface catalog
(`web/src/i18n/locales/vi.ts`), the registry text (`registry/i18n/vi.yaml`) and the content pages
(`content/vi/`) say each thing the same way. English is the source.

## Voice

- Address the reader as **bạn**, speak as **chúng tôi**. Plain, polite, short sentences.
- Standard Vietnamese with full diacritics. No dashes as punctuation (a comma, a colon, parentheses
  or a new sentence instead). Ranges are written "từ 2019 đến 2024".
- Numbers and dates follow `Intl` for `vi` in the interface (a dot for thousands, a comma for
  decimals, "5 tháng 10, 2026"). Text written by hand uses the same style ("1.000", "0,2").
- Dollar amounts keep the US form ($6,500, $1,399) because that is how City forms, bills and the
  English site show them; other counts use the Vietnamese dot ("40.000 lô đất").
- Feet, miles, inches and gallons stay as the City uses them (feet, dặm, inch, gallon); meters are
  "mét", kilometers "km".
- Vietnamese has no plural forms, so `plural()` takes only `other`.

## Terms

| English | Vietnamese | Note |
|---|---|---|
| Placekeepers | Placekeepers | proper name, never translated |
| neighbors | hàng xóm | warm, everyday word |
| block (the stretch where neighbors live) | dãy phố | |
| street block (one segment of a street, a unit of data) | đoạn phố | used for street safety scores and 311 counts |
| neighborhood | khu phố | |
| vacant lot | lô đất trống | |
| vacant building | tòa nhà bỏ trống | |
| vacant parcel | thửa đất bỏ trống | |
| parcel | thửa đất | |
| place (a lot, building or stop on the map) | địa điểm | |
| owner of record | chủ sở hữu ghi trong hồ sơ | |
| the City (government) | Thành phố | capital T |
| lens | góc nhìn | the way the map scores and colors places |
| lens weight | mức quan trọng | |
| factor | yếu tố | |
| priority score | điểm ưu tiên | |
| field view / analysis view | chế độ xem ngoài phố / chế độ xem phân tích | |
| layer | lớp | |
| filter / chip | bộ lọc / thẻ | |
| legal route, lawful route | hướng đi hợp pháp | |
| first legal step | bước hợp pháp đầu tiên | |
| displacement | phải dọn đi (vì giá cả tăng) | |
| displacement watch | theo dõi nguy cơ phải dọn đi | |
| greening | xanh hóa | |
| placemaking | tạo không gian cộng đồng | lens name |
| protections (for neighbors) | các biện pháp bảo vệ (hàng xóm) | |
| conservatorship | conservatorship (quyền quản lý tài sản thay chủ) | the English word stays, with the gloss on first use in a text; the label and the warning carry both |
| gentrification | gentrification (giá nhà đất tăng khiến người dân lâu năm khó ở lại) | |
| side yard | sân hông | |
| deed | chứng thư (deed) | matches the City's Vietnamese deed fraud page ("chứng thư", "gian lận chứng thư") |
| deed theft / deed fraud | đánh cắp chứng thư (deed theft) / gian lận chứng thư | |
| estate (of someone who died) | di sản thừa kế | "possible estate" = "có thể là di sản thừa kế" |
| tangled title | giấy tờ nhà đất bị rối (tangled title) | |
| sheriff sale | bán đấu giá do Sheriff tổ chức | |
| assessor | cơ quan định giá | the Office of Property Assessment (OPA) |
| assessment, assessed value | định giá, giá trị định giá | |
| homestead exemption | Miễn Thuế Nhà cửa vườn tược (Homestead Exemption) | the City's own Vietnamese name, from its printed Homestead Exemption application in Vietnamese (phila.gov/media/20220222114305/Homestead-Exemption-application-2023-Vietnamese.pdf); the English name stays beside it |
| Longtime Owner Occupants Program | Chương trình Longtime Owner Occupants (LOOP) | English name and acronym kept. phila.gov's Vietnamese page (machine translated) calls it "Chương trình Người cư dân Chủ lâu năm (LOOP)", which reads poorly, so we did not adopt it; a gloss "giảm thuế cho chủ nhà ở lâu năm" is added where room allows |
| Registered Community Organization (RCO) | Tổ chức Cộng đồng Đã đăng ký (RCO) | matches phila.gov's Vietnamese page ("Các tổ chức cộng đồng đã đăng ký (RCOs)") |
| zoning | quy hoạch phân vùng (zoning) | |
| overlay | lớp phủ quy hoạch (zoning overlay) | |
| brownfield | brownfield (đất từng dùng cho công nghiệp, có thể còn ô nhiễm) | the word stays, gloss on first use |
| High Injury Network | High Injury Network (mạng lưới đường có nhiều người bị thương nặng) | City program name kept |
| memorial (a person killed in a traffic crash) | nơi tưởng niệm | |
| killed | thiệt mạng | |
| crash | vụ tai nạn | |
| bus stop / trolley stop | trạm xe buýt / trạm xe điện | |
| shelter / bench | mái che / ghế ngồi | |
| street pole | cột trên đường phố | |
| traffic calming | biện pháp làm chậm xe | |
| school crossing guard | nhân viên hướng dẫn học sinh qua đường | |
| census tract / block group | khu điều tra dân số (census tract) / nhóm khối (block group) | |
| Census Bureau | Cục Điều tra Dân số Hoa Kỳ | |
| Market Value Analysis | Phân tích Giá trị Thị trường (Market Value Analysis) | |
| base map | bản đồ nền | |
| snapshot (weekly copy) | bản chụp hằng tuần | |
| live City data | dữ liệu trực tiếp của Thành phố | the setting is "Lấy dữ liệu trực tiếp của Thành phố" |
| privacy and live data | quyền riêng tư và dữ liệu trực tiếp | |
| Then and now (layer group) | Trước đây và bây giờ | |
| Land Bank | Land Bank | proper name |
| Department of Records | Sở Hồ sơ (Department of Records) | the name phila.gov's Vietnamese footer uses; the other City departments stay in English |
| notary | công chứng viên | as on the City's Vietnamese deed fraud page |
| real estate tax | thuế bất động sản | as on the City's Vietnamese Homestead Exemption form |
| primary residence | nơi cư trú chính, nhà ở chính | as on the same form |
| side yard program | chương trình sân hông | |
| warming / cooling site | điểm sưởi ấm / điểm tránh nóng | |

## Proper names kept in English

Placekeepers, Philly311 and 311, LandCare and PHS Community LandCare, SEPTA, PennDOT, PECO, EPA,
FEMA, OpenStreetMap, StreetComplete, Wikidata, Fraud Guard, the Tangled Title Fund, Philadelphia VIP,
the Garden Justice Legal Initiative, Neighborhood Gardens Trust, TreePhilly, Mural Arts Philadelphia,
Philly Bike Action, Families for Safe Streets, Philadelphia Land Bank, Redevelopment Authority, PHDC,
Philadelphia Housing Authority, L&I (Licenses and Inspections), Tax Center, Atlas, DVRPC, and the
names of City offices and boards (Office of Property Assessment, Department of Records, Zoning Board
of Adjustment, Historical Commission and so on). phila.gov publishes no Vietnamese names for them,
so they stay in English and a Vietnamese gloss is added only where a neighbor would need it.

## City sources looked up (phila.gov, October 2026)

Six lookups, all of phila.gov's own Vietnamese pages: the Vietnamese Homestead Exemption
application (PDF), the Vietnamese pages for deed fraud protection, the Longtime Owner Occupants
Program and Registered Community Organizations, and a search for the Fraud Guard page. Several of
phila.gov's Vietnamese web pages are machine translated and disagree with each other (the
Department of Records is "Sở Hồ sơ", "Bộ Hồ sơ" and "Cục Hồ sơ quy định" on one page), so only
terms from the human made printed form, and terms that two pages agree on, were adopted.

## Scope notes

- "Philadelphia" is written as is.
- Where the survey sheet shows a computed time or distance ("about 45 minutes", "0.4 miles") the
  words come from English code in `web/src/survey/sheet.ts` and are not translated (see the report).

## Back translation check (2026-10-21)

The back translation check (`docs/i18n/check-vi.md`) kept every glossary choice. It changed the
wording of four texts. Two of the changes set a rule worth keeping:

- estate stays "di sản thừa kế" everywhere, including the City's deed type for a deed from an estate
  ("Chứng thư từ một di sản thừa kế"), because "di sản" alone can read as heritage;
- a bill pending in City Council "would change" the zoning: write "nếu được thông qua, sẽ thay đổi"
  (if it passes, it will change), never a plain "sẽ thay đổi".

