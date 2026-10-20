# Phát hành v3.27.0 — nhập Excel theo bảng Phụ lục, Giao việc theo cột Excel, Tổng quan theo chủ trì; đưa hai tệp chuyển đổi lên production

Bản phát hành **v3.27.0** (nhánh `feature/v3.27-chuan-hoa-nhap`, migration **0117–0118**, CHANGELOG 81, SPEC GV-25 / DB-10 / QT-11 / "Nhập Excel qua giao
diện", CAU-HOI nhóm L) làm 7 việc chủ dự án yêu cầu ngày 20/10/2026: danh sách "Chờ hoàn thiện" không báo sai "thiếu đơn vị chủ trì"; dòng tóm tắt khi giao
không gây hiểu nhầm; tạm ẩn mục tiêu then chốt; mẫu nhập chuẩn = bảng Phụ lục (đủ cột B–M thì nhập ngay); bảng đề xuất của trợ lý AI sửa được; Giao việc
theo cột Excel; Tổng quan hiển thị tối đa theo dữ liệu đang có. Sau đó đưa hai tệp chuyển đổi chủ dự án gửi lên production (Bước 4).

Mỗi bước do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu, khoá service hay khoá AI.
Làm **lần lượt**, xong bước này mới sang bước sau.

## Thay đổi khi áp lên production
- **0117** thay 5 hàm (chép nguyên văn bản cũ, chỉ đổi phần ghi rõ ở đầu tệp): trigger `kl_nhiem_vu_nguon_truoc_ghi` và `kl_thay_doi_giao` nhận cơ quan trình
  "1. Văn phòng Tỉnh ủy" (qua hàm mới `kl_co_quan_trinh_hop_le`); `kl_nhap_da_xong`, `kl_nhap_cap_nhat` ghi thêm cơ quan trình, mức quan trọng, Thường trực chỉ
  đạo (`kl_nhap_cap_nhat` thêm: đổi ngành qua tệp lấy lĩnh vực gợi ý cùng ngành); `kl_truong_nhap` thêm mã trường `chu_tri`. **Không sửa dữ liệu đang có.**
- **0118** thêm `kl_ten_loai_van_ban`, `kl_bo_sung_chuyen_doi_lam`, `bo_sung_chuyen_doi` (chỉ tài khoản toàn quyền gọi được). **Không sửa dữ liệu đang có.**
- Giao diện: mẫu nhập chuẩn mới, "Chờ hoàn thiện" tính lại ô thiếu, Giao việc theo cột Excel, bảng đề xuất AI sửa được, Tổng quan khối 2 "Theo chủ trì theo
  dõi", mục tiêu then chốt ẩn ở mọi màn người dùng (dữ liệu, danh mục quản trị giữ nguyên), khung "Bổ sung dữ liệu chuyển đổi" (chỉ toàn quyền thấy).
- Edge Function `tro-ly-ai` triển khai lại cùng lượt: không gửi danh mục mục tiêu cho AI (lời nhắc ngắn hơn), thêm ô cơ quan trình.

## Bước 1 — Kiểm bản cuối trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
Claude tự kiểm trong khung trình duyệt (chủ dự án chỉ đăng nhập tài khoản Claude nêu tên, không gõ mật khẩu hộ) và báo kết quả; chủ dự án xem lại bản cuối
rồi báo **đồng ý** mới sang Bước 2.
- `demo_truongphong` — Giao việc: thẻ nhiệm vụ theo cột Excel (Chủ trì theo dõi, Ngành/lĩnh vực, Cơ quan/đơn vị trình, Lĩnh vực chi tiết, Loại thời hạn,
  Hạn xử lý, Sản phẩm đầu ra), mục "Thêm"; không còn ô mục tiêu; còn thiếu → chỉ "Còn thiếu: …", đủ → "Sẵn sàng giao — …" (không trích nội dung). Đọc văn bản
  gốc (PDF thử, nội dung giả): sửa nội dung, chọn chịu trách nhiệm / sản phẩm / hạn / cơ quan trình ngay ở bảng, "× Bỏ" một dòng, điền nhanh, "Điền … vào
  các thẻ" → giao.
- `demo_cvp` — Nhập từ Excel: "Tải mẫu nhập chuẩn" (cột A–O, sheet Danh mục, Hướng dẫn); nhập tệp giả theo mẫu → xem trước ghi rõ ô tự điền; "Chờ hoàn
  thiện" chỉ báo ô thật sự thiếu. Tổng quan: khối 2 "Theo chủ trì theo dõi" (bấm tên ra đúng số việc), dải đầu tỷ lệ hoàn thành, khối 4 theo cơ quan, đơn vị
  trình; lọc Thông báo Thường trực ở thanh lọc.
- Điện thoại (≤ 600px), cửa sổ 1024px, bốn chế độ màu.
- Khung "Bổ sung dữ liệu chuyển đổi" chỉ hiện với tài khoản toàn quyền (staging không có tài khoản toàn quyền thường trực) — đã kiểm bằng RLS `kl-0117`
  (CI) và dựng thử giao diện; trên production kiểm ở Bước 4.

## Bước 2 — Phát hành (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên: **"Đồng ý áp migration 0117–0118 lên production"**.
2. PR `release/v3.27.0` xanh đủ check → gắn tag `v3.27.0` lên **đầu nhánh phát hành** (chủ dự án đẩy tag).
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt; theo dõi tới smoke xanh và tag `production`.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.27.0` → merge PR phát hành bằng **merge commit**.

## Bước 3 — Báo cán bộ (ngay sau phát hành)
> Từ hôm nay: (1) Nhập từ Excel dùng **đúng bảng Phụ lục đang theo dõi** (tải "Mẫu nhập chuẩn" ở Giao việc → Nhập từ Excel) — điền đủ các cột B đến M là
> nhập được ngay. (2) Khi giao việc, ô **Chủ trì theo dõi, Sản phẩm đầu ra, Hạn xử lý** là bắt buộc; mục tiêu then chốt tạm chưa phải điền. (3) Có văn bản
> gốc (PDF) thì bấm "Đọc văn bản gốc": sửa ngay trong bảng đề xuất, chọn người chịu trách nhiệm, hạn, bỏ nhiệm vụ không giao, rồi bấm "Điền … vào các thẻ" —
> đồng chí kiểm tra trước khi bấm Giao việc.

## Bước 4 — Đưa hai tệp chuyển đổi lên production (chủ dự án duyệt, làm trên tài khoản toàn quyền `qt_vptu`)
Tệp dữ liệu thật chỉ ở phiên làm việc của Claude, **không vào repo**; xong thì xoá.
1. Claude gửi chủ dự án **hai tệp xem trước** (ô tự điền tô màu, kết quả tự điền mở đầu "[Tự điền]"): (a) bổ sung cho các việc của tệp TUCB đã có trên hệ thống
   — cơ quan trình, lĩnh vực chi tiết, hạn còn trống, kết quả (việc đã hoàn thành chưa có minh chứng), văn bản triển khai; 06-TB/TU đổi sang Thông báo của Thường
   trực, 3 việc đã có đổi chủ trì theo tệp Thường trực (một việc ghi "VPTU" → Văn phòng Tỉnh ủy, người theo dõi Chánh Văn phòng); (b) tệp Thường trực đã điền đủ (bỏ 3 dòng trùng 06-TB/TU). Chủ dự án xem, sửa nếu cần, báo **đồng ý**.
2. Bổ sung (a): đăng nhập `qt_vptu` → Giao việc → Nhập từ Excel → cuối trang **Bổ sung dữ liệu chuyển đổi** → chọn tệp `.json` Claude gửi → **Xem trước** (chưa
   ghi gì: số việc bổ sung / giữ nguyên / lỗi, từng ô cũ → mới) → có lỗi thì chụp gửi Claude → **Ghi vào hệ thống**.
3. Nhập (b): Nhập từ Excel → chọn tệp Thường trực → "Văn bản trong tệp là" = Thông báo của Thường trực (hệ thống đoán sẵn) → việc đã hoàn thành chọn **"Đã
   xong ngoài hệ thống"** → xem trước (số dòng Giao ngay / Đã xong / Chờ hoàn thiện) → **Nhập**.
4. Kiểm (Claude đọc cùng chủ dự án, không ghi): Tổng quan lọc Thông báo Thường trực, kỳ Nhiệm kỳ — khối 2 khớp bảng "Tổng hợp KL TTTU" của tệp (tổng, hoàn
   thành, đang thực hiện theo từng chủ trì; quá hạn tính theo hạn thật nên có thể khác); Kết luận BTV đúng số việc; không còn việc thiếu hạn, cơ quan trình,
   lĩnh vực chi tiết; 9 dòng chờ của lô LO-0003 còn nguyên. Xong thì Claude xoá các tệp dữ liệu thật khỏi phiên làm việc.

## Sau phát hành
- Theo dõi "Chờ hoàn thiện" vài ngày đầu: dòng nào còn thiếu thì Hoàn thiện (biểu mẫu điền sẵn) hoặc sửa tệp nhập lại.
- Bật lại mục tiêu then chốt khi đủ dữ liệu: đổi cờ `HIEN_MUC_TIEU` (frontend `lib/kl/muc-tieu.js`, Edge Function `tro-ly-ai/csdl.js`) qua một PR — dữ liệu đã
  gắn vẫn còn.
- Hướng dẫn sử dụng: cập nhật mẫu nhập chuẩn, bảng đề xuất của trợ lý AI, khối 2 Tổng quan.
