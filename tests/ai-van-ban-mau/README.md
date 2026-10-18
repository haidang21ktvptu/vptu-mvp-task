# Văn bản mẫu HƯ CẤU để kiểm thử "Đọc văn bản gốc (PDF)" bằng trợ lý AI

Năm văn bản dựng theo thể thức văn bản của Đảng (số hiệu, địa danh – ngày, tên loại, số trang ở đầu trang từ trang 2), mọi trang ghi "VĂN BẢN HƯ CẤU –
CHỈ DÙNG KIỂM THỬ". Repo public không chứa tệp PDF (CI chặn `.pdf`) — ở đây là **chữ của tệp đúng như trình duyệt đọc** (pdf.js của
`frontend/vendor/pdfjs` + `ghepDong` của `lib/kl/doc-pdf.js`: dòng cách nhau một xuống dòng, các trang cách nhau một dòng trống). Đây cũng là đầu vào
Edge Function `tro-ly-ai` nhận (`chu`), nên dùng được cho:
- unit test hồi quy `frontend/tests/van-ban-mau.test.mjs` (kết quả AI giả định chép đúng / chép sai → đối chiếu phải ra đúng như bảng dưới);
- chạy thử trợ lý AI thật trên **staging** (gửi chữ tới `tro-ly-ai` bằng phiên đăng nhập staging, như nút "Đọc văn bản gốc") sau mỗi lần đổi đề bài,
  mô hình hoặc quy tắc đối chiếu; so mô hình (Opus / Sonnet / Haiku) theo số giá trị đối chiếu được và số nhiệm vụ tách đúng. Mỗi lượt tính phí API
  (~0,1–0,4 USD với Opus 5.5). Staging chỉ dữ liệu giả (quy tắc 11) — không dùng văn bản thật.

Kết quả đúng (giá trị nguyên văn phải "Đã đối chiếu nguyên văn"; hạn mơ hồ chỉ là gợi ý "Dùng ngày …"):

| Văn bản | Thông tin văn bản | Nhiệm vụ đúng | Điểm khó |
|---|---|---|---|
| `1-ket-luan-998-KL-TU` | KL_BTV · 998-KL/TU · 16/10/2026 · hội nghị 12 | 3 — hạn 15/12/2026, 31/03/2027 (quý I năm 2027), 31/12/2026 | trích yếu xuống dòng |
| `2-thong-bao-999-TB-TU` | TB_THUONG_TRUC · 999-TB/TU · 15/10/2026 | 6 (2.1–2.6) — 30/11/2026, 15/12/2026, không hạn ("hằng tháng"), 31/12/2026, 31/03/2027, 25/12/2026 | "THÔNG BÁO KẾT LUẬN … của Thường trực"; 2.6 vắt sang trang 2; phần đánh giá không phải nhiệm vụ |
| `3-cong-van-9001-CV-VPTU` | CONG_VAN · 9001-CV/VPTU · 20/10/2026 — không phải 990-KL/TU, 05/10/2026, hội nghị 11 (của văn bản được nhắc tới) | 5 — mục 1 giao ba cơ quan ngang nhau → ba nhiệm vụ cùng nội dung, hạn "trước tháng 12/2026" chỉ gợi ý; mục 2 phối hợp Sở Xây dựng; Kho bạc Nhà nước khu vực, "95,5%", hạn 30/06/2027 (6 tháng đầu năm 2027); mục 3 hạn 20/01/2027 | câu kết "đề nghị … quan tâm, phối hợp thực hiện" không phải nhiệm vụ |
| `4-ket-luan-991-KL-TU` | KL_BTV · 991-KL/TU · 21/10/2026 · hội nghị 13 | 2.1 a) 30/06/2027 (quý II/2027), b) 31/03/2027, c) không hạn — mỗi ý kèm câu dẫn "Giao Ban cán sự đảng … lãnh đạo, chỉ đạo:"; 2.2 một nhiệm vụ gồm các ý "trong đó tập trung:", hạn 30/11/2026 (vắt trang); 2.3 không hạn ("định kỳ 6 tháng"); mục 3 "Các cơ quan, đơn vị … trước ngày 15/11/2026" — tách hoặc hiện ở "Có thể còn sót" | đoạn đánh giá có "đã chủ trì tham mưu"; ý a) rất dài |
| `5-thong-bao-9002-TB-TU-bang` | TB_THUONG_TRUC · 9002-TB/TU · 22/10/2026 | 4 — ba dòng của bảng (chủ trì / phối hợp / thời gian ở cột: 31/12/2026, 31/03/2027, 30/11/2026) và câu cuối giao Văn phòng Tỉnh ủy 25/12/2026 | nhiệm vụ trong bảng |

Không bấm Giao việc khi chỉ kiểm tra đọc văn bản (bấm Giao thì tạo việc trên staging — dữ liệu giả, dọn bằng công cụ Dọn dữ liệu).
