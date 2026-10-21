# Phát hành v3.28.0 — theo dõi giải ngân vốn đầu tư công trên Tổng quan

Bản phát hành **v3.28.0** (nhánh `feature/v3.28-giai-ngan`, migration **0119–0122**, CHANGELOG 82, SPEC DB-11, CAU-HOI nhóm M) làm việc chủ dự án yêu cầu
ngày 21/10/2026: trên Tổng quan, lãnh đạo nhìn bức tranh giải ngân vốn đầu tư công toàn tỉnh trước (số tổng, theo nguồn vốn, theo chủ đầu tư, % qua các
kỳ), rồi từng nhiệm vụ theo mục tiêu riêng, báo chậm so với tiến độ đều.

Mỗi bước do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu, khoá service hay khoá AI.
Làm **lần lượt**, xong bước này mới sang bước sau.

## Thay đổi khi áp lên production
- **0119** thêm 3 bảng `gn_ky`, `gn_ky_dong`, `gn_nhiem_vu` (RLS: chỉ đọc; ghi qua hàm), các hàm `gn_ghi_ky`, `gn_xoa_ky`, `gn_gan_nhiem_vu` và hàm phụ.
  **Không sửa dữ liệu đang có**, không đổi hàm cũ. Diễn biến mới mã `giai_ngan` (hiện tên "Giải ngân vốn").
- **0120** thay hai hàm của 0119 (`gn_gan_nhiem_vu`, `gn_ghi_ky`): việc đã gắn nguồn vốn / chủ đầu tư chỉ lãnh đạo trong phạm vi hoặc người giao đổi, bỏ
  (người tự gắn mà mục tiêu còn mặc định được tự sửa); chặn số NaN / quá lớn, tên trùng sau khi cắt khoảng trắng. Không đụng dữ liệu.
- **0121** thay lại hai hàm đó: người chủ trì (kể cả việc tự giao cho mình) không tự đặt / hạ mục tiêu, không bỏ việc cấp trên gắn; không đi vòng qua
  "Số liệu toàn tỉnh"; khoá theo việc / năm khi hai người ghi cùng lúc; số làm tròn 3 chữ số trước khi kiểm. Không đụng dữ liệu.
- **0122** thay lại ba hàm `gn_gan_nhiem_vu`, `gn_ghi_ky`, `gn_xoa_ky`: Trưởng phòng là chủ trì của việc giao cho phòng (chưa giao cán bộ); Chánh VP vẫn đặt
  mục tiêu cho việc mình chủ trì; mục tiêu không mang sang khi đổi giữa toàn tỉnh và nguồn vốn / chủ đầu tư; xoá kỳ khoá theo năm như ghi kỳ. Không đụng dữ liệu.
- Giao diện: khối "Giải ngân vốn đầu tư công năm 2026" trên Tổng quan (chưa có số liệu: chỉ lãnh đạo Văn phòng và người nhập kỳ thấy hướng dẫn), mục "Giải ngân
  vốn" và hộp "Theo dõi giải ngân" (bỏ theo dõi có bước xác nhận) ở ngăn chi tiết, hộp "Nhập kỳ số liệu"; số khối của Tổng quan đánh theo các khối đang hiện.

## Bước 1 — Kiểm bản cuối trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
Claude tự kiểm trong khung trình duyệt bằng dữ liệu giả (chủ dự án chỉ đăng nhập tài khoản Claude nêu tên, không gõ mật khẩu hộ) và báo kết quả; chủ dự án
xem lại rồi báo **đồng ý** mới sang Bước 2.
- `demo_cvp` — Tổng quan: khối Giải ngân vốn hiện hướng dẫn; mở một nhiệm vụ giả → "Theo dõi giải ngân" → "Số liệu toàn tỉnh"; "Nhập kỳ số liệu": dán bảng
  giả (nguồn vốn, chủ đầu tư) → xem trước → lưu; nhập bù một kỳ cũ; Tổng quan hiện vòng %, biểu đồ, hai bảng, mức; gắn một nhiệm vụ khác với một chủ đầu tư.
- `demo_cv1` (chủ trì việc toàn tỉnh giả) nhập kỳ được; `demo_cv2`, `demo_a0` không thấy nút nhập; `demo_truongphong` thấy số liệu, không chọn được việc toàn
  tỉnh.
- Điện thoại (≤ 600px), cửa sổ 1280px, bốn chế độ màu.
- Số liệu giả của bước này (kỳ có căn cứ ghi "dữ liệu thử") giữ trên staging cho chủ dự án xem; Claude xoá sau khi phát hành để kịch bản e2e giải ngân
  chạy lại được (kịch bản tự bỏ qua khi năm hiện tại trên staging đã có việc "Số liệu toàn tỉnh").

## Bước 2 — Phát hành (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên: **"Đồng ý áp migration 0119–0122 lên production"**.
2. PR `release/v3.28.0` xanh đủ check → gắn tag `v3.28.0` lên **đầu nhánh phát hành** (chủ dự án đẩy tag).
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt; theo dõi tới smoke xanh và tag `production`.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.28.0` → merge PR phát hành bằng **merge commit**.

## Bước 3 — Đưa vào dùng trên production
1. **Lãnh đạo Văn phòng chọn việc "Số liệu toàn tỉnh" năm 2026**: mở (hoặc giao mới) nhiệm vụ "Theo dõi, tổng hợp tiến độ giải ngân vốn đầu tư công năm
   2026" giao cán bộ theo dõi → ngăn chi tiết, mục "Giải ngân vốn" (hoặc bảng "Xem chi tiết") → **Theo dõi giải ngân** → "Số liệu toàn tỉnh" → Lưu.
2. **Cán bộ chủ trì việc đó nhập kỳ mới nhất** từ báo cáo chính thức của UBND tỉnh / Sở Tài chính: "Nhập kỳ số liệu" → ngày số liệu, văn bản căn cứ, ước tính
   hay thực hiện → chọn tệp Excel đính kèm báo cáo hoặc dán bảng theo nguồn vốn / theo chủ đầu tư → kiểm xem trước (cột, đơn vị, dòng được tích, cảnh báo) →
   Lưu. Nên nhập bù các kỳ đã có báo cáo (30/6, 31/7…) để có đường tiến độ.
3. **Gắn nhiệm vụ liên quan** (chủ trì, người theo dõi hoặc lãnh đạo phụ trách): mục "Giải ngân vốn" → "Theo dõi giải ngân" → chọn nguồn vốn / chủ đầu tư
   trong danh sách tên của kỳ số liệu; lãnh đạo đặt mục tiêu riêng nếu khác 100% trước 31/12.
4. Claude kiểm production (chỉ đọc, qua phiên của chủ dự án): số trên khối khớp báo cáo đã nhập (tổng, từng nguồn vốn, từng chủ đầu tư), mức đúng cách tính,
   diễn biến của việc toàn tỉnh có kỳ vừa nhập.

## Lưu ý vận hành
- Mỗi kỳ là **một báo cáo**: cùng ngày số liệu nhập lại = thay kỳ cũ; sửa kỳ ở ngăn chi tiết việc toàn tỉnh (Sửa / Xoá trong "Diễn biến qua các kỳ").
- Cảnh báo khi nhập không chặn ghi: lệch tổng giữa bảng và số tổng (báo cáo làm tròn, hoặc thiếu dòng), lũy kế thấp hơn kỳ trước, kế hoạch vốn đổi (bổ sung
  kế hoạch — tỷ lệ hai kỳ khác mẫu số). Kiểm lại với báo cáo trước khi lưu.
- Tên nguồn vốn / chủ đầu tư nên giữ như kỳ trước (xem trước báo "gần giống" và mặc định dùng tên kỳ trước) để nhiệm vụ đã gắn không mất số.
- Năm hiển thị là năm hiện tại; trong tháng 1 vẫn hiện năm trước (kế hoạch vốn năm được giải ngân tới 31/1 năm sau).
