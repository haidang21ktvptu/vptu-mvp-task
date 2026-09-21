# Đặc tả giao diện v8 — VPTU-TASK

Bộ mockup HTML tĩnh trong thư mục này là **đặc tả UI/UX đã chốt**. Claude Code triển khai theo đúng bố cục, màu, chữ ở đây; nội dung dữ liệu trong mockup chỉ là ví dụ.

## 1. Token
| Token | Giá trị | Dùng cho |
|---|---|---|
| --do | #B3121B | hành động chính, cảnh báo Đỏ, nút Giao/Đôn đốc |
| --do-dam | #7A0C12 | hover, lớp phủ chân trang |
| --navy | #1F3A5F | tiêu đề, thanh đầu trang, điều hướng, nút phụ |
| --vang | #E8B923 | huy hiệu thông báo, vệt điểm nhấn (dùng rất ít) |
| --nen | #F6F4EF | nền trang |
| --the | #FFFFFF | nền thẻ |
| --vien | #E3DED4 | viền thẻ, đường kẻ |
| --chu | #1B1B1B | chữ chính |
| --chu-phu | #5B6270 | chữ phụ (đủ tương phản 4.5:1 trên nền trắng) |
| Xanh OK | #1B7A43 · nền #E6F4EA | hoàn thành, đúng hạn |
| Vàng | #8A5A00 · nền #FFF3D6 | sắp đến hạn, chờ duyệt |
| Đỏ | #B3121B · nền #FBE9EA | quá hạn, khẩn |

Chữ: tiêu đề **Lora** 700 (Google Fonts, hỗ trợ tiếng Việt); nội dung **Be Vietnam Pro** (đã có trong dự án). Bo góc thẻ 12px, nút 8px, ô nhập 8–10px. Chiều cao nút hành động 32px, ô nhập 42–50px.

## 2. Khung chung (mọi màn hình sau đăng nhập)
- **Thanh đầu trang 72px**: nền navy, ảnh Bản Giốc mờ 22% + lớp phủ chuyển navy→đỏ, dải núi đá vôi mỏng bên phải, vệt vàng. Trái: biểu trưng Cao Bằng (nền trắng, bo 8px), dòng nhỏ "VĂN PHÒNG TỈNH ỦY CAO BẰNG", tên hệ thống **IN HOA** 15px giãn chữ .05em. Phải: ô tìm kiếm 280px, chuông có huy hiệu vàng, tên + vai người dùng, bánh răng.
- **Menu dọc trái 236px**, nền trắng, chia nhóm bằng nhãn nhỏ in hoa (Điều hành / Theo dõi / Trao đổi). Mục đang chọn: nền #FBE9EA, chữ đỏ đậm. Huy hiệu số tròn đỏ (hoặc navy). Thay thế hoàn toàn menu pill ngang của v7. Chân menu ghi phiên bản và giờ cập nhật.
- **Vùng nội dung**: padding 24/28px, tối đa 3 tầng theo thứ tự: (1) tiêu đề + ngày; (2) dải **Cần xử lý ngay** nền #FFF8E6 viền #F1D98A với các pill đếm; (3) thẻ số liệu / danh sách. Hai cột: chính co giãn + cột phụ 300–380px.
- Thẻ việc = một **hàng**: chấm trạng thái 8px · mã việc (navy, đậm) · nội dung + dòng phụ xám · nhãn · hạn (màu theo trạng thái) · nút hành động. Không xếp nhiều khối thẻ dài liên tiếp như v7.

## 3. Từng màn hình
1. `01-dang-nhap.html` — ảnh toàn nền, 2 lớp phủ, 3 lớp dải núi + vệt vàng; chỉ biểu trưng + danh xưng cơ quan + tên hệ thống in hoa trên ảnh; thẻ đăng nhập 440×600 nổi bên phải có bóng và lớp trắng mờ phía sau; chân trang hỗ trợ kỹ thuật. **Không** đặt số liệu hay nội dung nội bộ trên ảnh.
2. `02-a0…` — 5 ô số, thanh "Nghẽn ở khâu nào" + "Ai đang chậm" cột trái 300px, danh sách việc quá hạn, khối diễn biến mới nhất.
3. `03-a1…` — dải Cần xử lý ngay; khối việc Thường trực giao chờ nhận; 5 ô số; minh chứng chờ xác nhận (nút Hợp lệ navy / Không hợp lệ); cột phải 380px trả lời chỉ đạo Thường trực.
4. `04-a2…` — khối duyệt từ chối (viền vàng, ghi chú lý do kín); việc Đỏ + sắp đến hạn; cột phải tải việc từng cán bộ (thanh %) + việc của Trưởng phòng.
5. `05-a3…` — việc mới chờ nhận; thẻ việc quá hạn có ô nộp minh chứng tại chỗ (số hiệu, ngày, cấp nhận, nút đỏ); đang thực hiện; cột phải lịch tuần + hướng dẫn nhanh.
6. `06-tab-nhiem-vu.html` — pill lọc đếm + tìm + 2 select trên một hàng; danh sách trái; **ngăn chi tiết cố định 520px** bên phải: đầu (mã, nhãn, nội dung, văn bản), lưới 2 cột thông tin, hàng nút hành động, diễn biến có màu theo mức.
7. `07-tab-giao-viec.html` — biểu mẫu 3 khối đánh số (Văn bản / Nội dung & người / Sản phẩm & hạn), độ khẩn dạng pill, dòng "Còn thiếu: …" cạnh nút Giao việc mờ; cột phải 340px xem trước thẻ việc + ba bước sau khi giao.

## 4. Nguyên tắc giữ nguyên từ v7
Mọi hành vi nghiệp vụ, hàm nạp dữ liệu, dấu hiệu `#klBody[data-nap]`, id các vùng dùng trong e2e giữ nguyên; chỉ đổi lớp trình bày. Mobile: menu dọc thu thành ngăn kéo, thanh đầu trang 56px, các cột xếp dọc.
