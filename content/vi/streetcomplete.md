# Khảo sát trạm xe buýt bằng StreetComplete

Chờ xe buýt dễ chịu hơn khi có mái che trên đầu và chỗ để ngồi. Placekeepers muốn cho thấy trạm xe
buýt và xe điện nào ở Philadelphia có mái che hoặc ghế ngồi, để hàng xóm và người tổ chức thấy nơi
hành khách vẫn phải chờ mà không có. Thành phố công bố một danh sách các mái che mà Thành phố điều
hành cùng đối tác quảng cáo của mình, khoảng 490 mái, và bản đồ hiện nó. Danh sách đó không nói gì
về ghế ngồi hay đèn chiếu sáng, bỏ sót các mái che không phải của Thành phố, và thay đổi lần gần
nhất vào tháng 1 năm 2025. Vì vậy bản đồ cũng dùng OpenStreetMap, bản đồ thế giới miễn phí mà ai
cũng có thể cải thiện, vốn vẫn biết rất ít về các trạm của thành phố. Bạn có thể giúp lấp khoảng
trống đó bằng một ứng dụng điện thoại miễn phí tên là StreetComplete, mỗi lần vài phút. Nơi danh
sách của Thành phố và OpenStreetMap không thống nhất về một mái che, trang của trạm cho biết như
vậy, và một cuộc khảo sát sẽ giải quyết.

[Mở bản đồ với các trạm chưa được khảo sát](../#l=stop_amenities&s=stop_amenities.show:unsurveyed)

[In phiếu khảo sát cho cả một tuyến xe buýt hoặc xe điện](../survey/)

Chúng tôi kiểm tra lần cuối các chi tiết về ứng dụng trên trang này với trang web của chính
StreetComplete, [trang hỏi đáp](https://wiki.openstreetmap.org/wiki/StreetComplete/FAQ) và
[danh sách câu hỏi](https://wiki.openstreetmap.org/wiki/StreetComplete/Quests) của nó vào ngày 4
tháng 10 năm 2026. StreetComplete do các tình nguyện viên làm ra và không thuộc Placekeepers, nên
các màn hình của nó có thể thay đổi.

## StreetComplete là gì

StreetComplete là một ứng dụng miễn phí để thêm dữ kiện vào OpenStreetMap trong lúc bạn đi bộ. Nó
tìm những chi tiết còn thiếu gần bạn và hiện từng cái trên bản đồ của nó như một dấu nhỏ, mà nó gọi
là một quest (nhiệm vụ). Bạn chạm vào một dấu, nhìn quanh, và trả lời một câu hỏi đơn giản, như
"Trạm này có mái che không?" Câu trả lời của bạn đi thẳng vào OpenStreetMap. Bạn không cần biết gì
về cách OpenStreetMap hoạt động.

## Cài đặt

- **Điện thoại Android.** Cài StreetComplete từ
  [Google Play](https://play.google.com/store/apps/details?id=de.westnordost.streetcomplete) hoặc
  [F-Droid](https://f-droid.org/packages/de.westnordost.streetcomplete/). Nó cần Android 7.1 trở
  lên.
- **iPhone.** Một bản thử nghiệm đầu tiên cho iPhone đã có qua TestFlight của Apple vào cuối tháng 9
  năm 2026. Liên kết nằm trên
  [trang dự án của StreetComplete](https://github.com/streetcomplete/StreetComplete). Nó còn mới,
  nên hãy chuẩn bị gặp một số trục trặc.
- **Một tài khoản OpenStreetMap.** Bạn có thể bắt đầu trả lời ngay. Để công bố các câu trả lời của
  bạn, hãy đăng nhập bằng một [tài khoản OpenStreetMap](https://www.openstreetmap.org/user/new)
  miễn phí. Cho đến khi làm vậy, ứng dụng giữ các câu trả lời của bạn trên điện thoại.

Ứng dụng cũng hoạt động khi không có mạng. Khi bạn có mạng, nó gửi từng câu trả lời ngay khi bạn
đưa ra, và khi không có mạng, nó giữ câu trả lời và gửi sau.

## Các câu hỏi về trạm xe buýt hoạt động như thế nào

1. Mở StreetComplete gần một trạm. Các dấu xuất hiện trên bản đồ của nó ở bất cứ nơi nào nó có câu
   hỏi.
2. Chạm vào một dấu ở một trạm xe buýt hoặc xe điện. Ứng dụng làm nổi bật trạm mà nó đang hỏi.
3. Nhìn quanh, rồi trả lời. Ở các trạm tại Hoa Kỳ, StreetComplete hỏi:
   - Trạm này có mái che không?
   - Trạm này có ghế ngồi không?
   - Trạm này có thùng rác không?
   - Trạm này có đèn chiếu sáng không?
   - Trạm này có lát gạch xúc giác không? (dải gồ ghề ở lề đường giúp người khiếm thị tìm thấy mép
     đường)
   - Số hoặc mã nào xác định trạm này? (số của trạm, nơi biển của trạm có ghi)
4. Phần lớn các câu hỏi có nút Có và nút Không. Nếu cả trạm nằm dưới một mái, như một phần mái nhà
   nhô ra sâu, hãy chạm vào "Uh…" (nút cho các câu trả lời khác) và chọn "Whole stop is covered"
   (cả trạm có mái che). Nếu bạn không chắc, hãy chạm vào "Uh…" và chọn "Can't say" (không thể
   nói), hoặc để lại một ghi chú cho những người vẽ bản đồ khác. Xin đừng đoán.
5. Nếu bạn chạm nhầm câu trả lời, nút hoàn tác ở góc dưới bên trái sẽ lấy nó lại.

StreetComplete hỏi lại về mái che và ghế ngồi sau khoảng bốn năm, để bản đồ luôn cập nhật. Trong
phần cài đặt của nó, bạn có thể bật hoặc tắt các loại câu hỏi, chẳng hạn chỉ hiện các câu hỏi về
trạm trong lúc bạn khảo sát. Một nhóm có thể dùng chế độ nhóm (team mode) của nó, chia các câu hỏi
cho tối đa 12 người cùng vẽ bản đồ một khu vực một lúc.

## Khi một trạm bị thiếu trên bản đồ

StreetComplete chỉ có thể hỏi về các trạm đã có trong OpenStreetMap. Vào ngày 4 tháng 10 năm 2026,
OpenStreetMap có khoảng 830 trong số khoảng 8.000 trạm xe buýt và xe điện mà SEPTA liệt kê ở
Philadelphia, nên nhiều trạm chưa có câu hỏi nào. Nếu bạn đang đứng ở một trạm và ứng dụng không
hiện gì ở đó, bạn có hai cách để giúp:

- Bật lớp phủ **Things** của StreetComplete. Nó hiện các trạm xe buýt, ghế ngồi, mái che, thùng rác
  và những thứ khác trên đường phố, và cho phép bạn thêm một thứ còn thiếu ngay nơi nó đứng. Hãy đặt
  một trạm xe buýt mới trên vỉa hè cạnh biển của trạm.
- Hoặc chạm vào **Create new note** (tạo ghi chú mới) và mô tả điều còn thiếu, để một người vẽ bản
  đồ khác có thể thêm nó.

Khi một trạm đã có trong OpenStreetMap, StreetComplete cũng có thể hỏi các câu hỏi của nó ở đó.

## Ghế ngồi, nước, nhà vệ sinh và thư viện nhỏ miễn phí

Bản đồ của chúng tôi cũng hiện ghế ngồi, bàn dã ngoại, nước uống, nhà vệ sinh công cộng và thư viện
nhỏ miễn phí, như mọi người đã thêm vào OpenStreetMap. Mỗi thứ là một lớp riêng trong mục **Ghế
ngồi, nước, nhà vệ sinh và hơn nữa**, và mỗi lớp còn xa mới đầy đủ: vào ngày 5 tháng 10 năm 2026,
OpenStreetMap có khoảng 2.070 ghế ngồi, 300 bàn dã ngoại, 150 thư viện nhỏ miễn phí, 73 nhà vệ sinh
công cộng và 30 điểm nước uống trong thành phố.

Bạn có thể thêm những gì còn thiếu bằng lớp phủ **Things** của StreetComplete: hãy bật nó, chạm vào
chỗ thứ đó đứng, và chọn nó là gì. Lớp phủ này bao gồm ghế ngồi, bàn dã ngoại, nước uống, nhà vệ
sinh và tủ sách công cộng, cùng nhiều thứ khác trên đường phố. Khi chúng đã được vẽ lên bản đồ,
StreetComplete cũng hỏi về một số thứ, chẳng hạn một chiếc ghế có tựa lưng không, và nhà vệ sinh
công cộng có thu phí hay có lối cho xe lăn không. Những gì bạn thêm đến bản đồ của chúng tôi trong
khoảng một tuần.

Lớp **Vòi uống nước trong công viên** đến từ danh sách riêng của Parks and Recreation, không phải từ
OpenStreetMap, nên các thay đổi ở đó đến từ Thành phố.

## Một cuộc khảo sát mất bao lâu

Đây là các ước tính của chúng tôi, từ lịch chạy của SEPTA, không phải từ ứng dụng. Các trạm của
SEPTA trong thành phố cách nhau khoảng 170 mét, một hoặc hai dãy phố, nên đi bộ từ một trạm đến
trạm kế tiếp mất khoảng hai phút. Trả lời các câu hỏi ở một trạm mất khoảng một phút. Như vậy là
khoảng ba phút một trạm:

- một đoạn 20 trạm mất khoảng một giờ;
- một chiều của một tuyến điển hình mất khoảng ba giờ, vì một tuyến có khoảng 55 trạm trong thành
  phố mỗi chiều;
- thêm một trạm còn thiếu mất thêm vài phút.

Phần lớn mọi người khảo sát một đoạn gần nhà hoặc dọc theo chuyến đi của chính họ, và quay lại vào
một ngày khác cho đoạn kế tiếp. Chiều ngược lại của một tuyến có các trạm riêng ở phía bên kia
đường.

[Trang khảo sát tuyến](../survey/) tính ra cùng một ước tính cho từng tuyến và từng chiều, và cho
từng phần khi một nhóm chia một tuyến.

## Hãy giữ an toàn

- Hãy đứng trên vỉa hè. Đừng bao giờ đứng giữa lòng đường hoặc bước vào làn xe buýt để xem một
  trạm.
- Hãy dừng chân trước khi nhìn điện thoại, và nhìn lên trước khi băng qua đường.
- Hãy tránh sang một bên để hành khách có thể chờ, lên và xuống xe. Đừng bao giờ chắn cửa xe buýt
  hay mái che.
- Hãy khảo sát ban ngày, cùng một người bạn nếu có thể.
- Đừng chụp ảnh người khác. Nếu bạn thêm một tấm ảnh vào một ghi chú, hãy chụp khi không có ai trong
  khung hình.
- Hãy ở trên các vỉa hè công cộng. Đừng vào đất tư nhân để xem một trạm.

## Khảo sát một tuyến cùng hàng xóm của bạn

Một nhóm khu phố có thể khảo sát cả một tuyến xe buýt hoặc xe điện trong một buổi chiều bằng cách
chia nhỏ nó ra:

1. **Chọn một tuyến.** Hãy chọn một tuyến mà hàng xóm của bạn đi, hoặc một tuyến có nhiều trạm chưa
   được khảo sát trên [bản đồ của chúng tôi](../#l=stop_amenities&s=stop_amenities.show:unsurveyed).
2. **In các phiếu.** Trên [trang khảo sát tuyến](../survey/), hãy chọn tuyến, một chiều, và có bao
   nhiêu người hoặc cặp sẽ chia sẻ nó. Trang này chia các trạm thành các phần nối tiếp nhau. Mỗi
   phần có phiếu riêng: các trạm theo thứ tự, những gì OpenStreetMap hiện đang cho thấy ở mỗi
   trạm, các ô cho mái che, ghế ngồi, thùng rác, đèn chiếu sáng và việc sửa chữa, một cột ghi chú,
   và ước tính của chúng tôi về thời gian của phần đó. Khoảng 20 trạm mất một giờ.
3. **Phát các phần.** Đưa mỗi cặp một phần. Chiều ngược lại của một tuyến có các trạm riêng ở phía
   bên kia đường, nên hãy đưa nó cho các cặp khác hoặc để dành cho một ngày khác.
4. **Đi cùng nhau, và giữ an toàn.** Hãy khảo sát ban ngày, theo cặp, và ở trên vỉa hè. Đừng bao giờ
   đứng giữa lòng đường để xem một trạm.
5. **Trả lời tại trạm, hoặc sau đó.** Các tình nguyện viên có StreetComplete trả lời các câu hỏi của
   nó ở từng trạm. Các tình nguyện viên không có nó điền vào phiếu, rồi nhập các câu trả lời ở nhà
   bằng trình chỉnh sửa riêng của OpenStreetMap, như phiếu giải thích, hoặc đưa phiếu cho một người
   trong nhóm sẽ làm việc đó. Nếu mọi người đều dùng StreetComplete, chế độ nhóm của nó có thể chia
   các câu hỏi cho tối đa 12 người.
6. **Giữ phần còn lại cho nhóm của bạn.** OpenStreetMap không ghi lại hư hỏng, nên các ô "cần sửa"
   và các ghi chú ở lại với nhóm của bạn, để dùng khi bạn trao đổi với SEPTA hoặc Thành phố về một
   trạm.

Mọi thứ nhóm của bạn nhập vào OpenStreetMap đến bản đồ của chúng tôi trong khoảng một tuần, vì
Placekeepers tải OpenStreetMap cho Philadelphia mỗi thứ Hai. Các phiếu khảo sát cập nhật cùng lúc,
nên một tuần sau chúng cho thấy trạm nào vẫn cần một chuyến đến.

## Các câu trả lời của bạn là công khai

Mỗi câu trả lời bạn công bố là một phần của OpenStreetMap, dưới tên người dùng OpenStreetMap của
bạn, kèm địa điểm và thời gian. Ai cũng có thể thấy nó, nên hãy chọn một tên người dùng mà bạn thấy
thoải mái chia sẻ. Những gì bạn thêm là miễn phí cho mọi người sử dụng theo giấy phép mở của
OpenStreetMap, kể cả SEPTA và Thành phố.

## Khi nào các câu trả lời của bạn xuất hiện trên Placekeepers

StreetComplete gửi các câu trả lời của bạn đến OpenStreetMap ngay lập tức. Placekeepers tải
OpenStreetMap cho Philadelphia mỗi thứ Hai, nên các câu trả lời của bạn đến bản đồ của chúng tôi
trong khoảng một tuần.

Trên bản đồ của chúng tôi, một trạm hiện ra thuộc một trong bốn loại:

- **Có mái che, hoặc cả trạm nằm dưới mái.**
- **Có ghế ngồi, nhưng chưa ghi nhận mái che trên bản đồ.**
- **Không có mái che và không có ghế ngồi.** Có người đã kiểm tra cả hai.
- **Chưa khảo sát.** OpenStreetMap chưa cho biết, hoặc chỉ cho biết một trong hai. Điều này không có
  nghĩa là trạm không có gì. Nó có nghĩa là chưa có ai ghi lại.

Một số người vẽ bản đồ vẽ riêng một mái che hoặc một ghế ngồi ngay cạnh trạm thay vì trả lời câu
hỏi của trạm. Bản đồ của chúng tôi tính một mái che hoặc ghế ngồi như vậy cho trạm gần nhất trong
vòng 10 mét (khoảng 33 feet), khi trạm đó không tự trả lời câu hỏi. Câu trả lời của chính trạm luôn
được ưu tiên trước.

## Điều gì xảy ra tiếp theo

Các câu trả lời của bạn nuôi góc nhìn **Thoải mái khi đi xe công cộng** của bản đồ, góc nhìn xếp hạng
các trạm xe buýt và xe điện theo nơi một mái che, một ghế ngồi hoặc bóng mát sẽ giúp hành khách
nhiều nhất. Một trạm mà cuộc khảo sát thấy không có gì để ngồi dưới hay ngồi lên thì được xếp cao
lên; một trạm chưa có ai khảo sát được tính nửa điểm cho đến khi có người làm. Một trạm mà danh sách
của Thành phố có mái che thì được tính là có mái che. Hãy bật các trạm xe buýt (thẻ **Trạm xe buýt**,
hoặc **Trạm xe buýt và xe điện** trong danh sách các lớp) và chạm vào một trạm để xem mức ưu tiên của
nó và những gì hàng xóm có thể làm ở đó.

Chương trình mái che trạm xe buýt của Thành phố do văn phòng giao thông của Thành phố (OTIS) điều
hành và do tiền quảng cáo trên các mái che chi trả, và Thành phố đặt mục tiêu lắp mái che ở 15 phần
trăm trạm xe buýt đông khách nhất. Chúng tôi không tìm thấy mẫu đơn công khai nào để xin một mái che
hay một ghế ngồi. **Chưa được xác nhận:** liệu OTIS có nhận yêu cầu qua email hay không; hãy viết
thư cho otis@phila.gov hoặc gọi 215-686-9003 kèm số của trạm và số người lên xe ở đó, và gửi bản
sao cho văn phòng khu vực Hội đồng Thành phố của bạn. Xem [Cách thực hiện](../how/) để biết thêm.
Một con số rõ ràng về các trạm nơi hành khách chờ mà không có cả hai là một điểm khởi đầu vững chắc
cho cuộc trao đổi đó.
