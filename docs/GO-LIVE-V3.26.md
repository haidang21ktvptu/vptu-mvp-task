# Phát hành v3.26.0 — phân loại nhiệm vụ cho Tổng quan khối 2–3

Bản phát hành **v3.26.0** (nhánh `feature/v3.26-phan-loai`, migration **0116**, CHANGELOG 79, SPEC GV-2 / DB-9, CAU-HOI nhóm K): khối 2 "Thực hiện các mục
tiêu then chốt" và khối 3 "Thực hiện theo lĩnh vực trọng tâm" của Tổng quan tính đúng — mỗi nhiệm vụ có ngành – lĩnh vực và mục tiêu then chốt, hoặc ghi rõ
"Không thuộc"; việc giao mới không bỏ trống được; việc đã giao (kể cả đã hoàn thành) phân loại lại bằng tệp ở màn Rà soát.

Mỗi bước do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu, khoá service hay khoá AI,
không đọc / ghi dữ liệu production. Làm **lần lượt**, xong bước này mới sang bước sau.

## Thay đổi khi áp lên production
- **0116** thêm 5 dòng danh mục cố định "Không thuộc" (khối, ngành `KHONG_THUOC` + lĩnh vực `LV99_KHONG_THUOC`, nhóm và mục tiêu `KHONG_THUOC`) cùng
  trigger / CHECK khoá các dòng này; Kết luận BTV / Thông báo Thường trực không nhận ngành "Không thuộc"; mục tiêu "Không thuộc" không đi cùng mục khác;
  thay 3 hàm (`kl_tu_gan_muc_tieu_viec`, `kl_dong_nhap_gan_muc_tieu`, `ai_can_hoc` — chỉ thêm điều kiện "Không thuộc"); thêm `kl_ten_phan_loai`,
  `ra_soat_phan_loai`. **Không sửa dữ liệu nhiệm vụ, văn bản, phân công đang có** (các CHECK mới chỉ chạm dòng trỏ tới "Không thuộc" — chưa có dòng nào).
- Giao diện: biểu mẫu Giao việc bắt buộc phân loại ở mọi thẻ (trừ Thường trực giao); Tổng quan tách "Không thuộc" / "Chưa phân loại"; màn Rà soát đổi tên
  "Rà soát phân loại", thêm ô lọc và khối nhập tệp; bộ nhớ danh mục trên máy dùng khoá mới (tự tải lại danh mục lần đầu mở app).
- Edge Function `tro-ly-ai` triển khai lại cùng lượt (danh mục gửi AI bỏ mục "Không thuộc" — cách AI chọn, chi phí không đổi).

## Bước 1 — Kiểm bản cuối trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
Claude tự kiểm trong khung trình duyệt (chủ dự án chỉ đăng nhập tài khoản Claude nêu tên, không gõ mật khẩu hộ) và báo kết quả; chủ dự án xem lại bản cuối
rồi báo **đồng ý** mới sang Bước 2.
- `demo_truongphong` — Giao việc, văn bản mới loại Công văn: dòng nhắc phân loại; "Còn thiếu" ghi ngành (hoặc "Không thuộc"), lĩnh vực, mục tiêu then chốt;
  chọn ngành "Không thuộc ngành, lĩnh vực nào" → lĩnh vực tự chọn; tích "Không thuộc mục tiêu then chốt nào" ⇄ chọn một mục thật (bỏ lẫn nhau); đổi sang
  Kết luận BTV → ô ngành không còn "Không thuộc"; giao → ngăn chi tiết đúng ngành, mục tiêu.
- `demo_cvp` — Tổng quan: khối 2 dòng "gắn mục tiêu · không thuộc · chưa phân loại"; khối 3 hai dòng "Không thuộc lĩnh vực trọng tâm", "Chưa phân loại — cần
  rà soát" (bấm ra đúng danh sách), nút "Rà soát phân loại". Rà soát: ô lọc mới; Xuất tệp rà soát → sửa vài dòng → Chọn tệp → xem trước → Áp dụng (dữ liệu
  giả của staging); ngăn chi tiết việc vừa rà soát có dòng diễn biến kèm lý do, không có tin nhắn mới.
- `demo_a0` — Giao việc như cũ (không bắt buộc phân loại); Kết luận BTV vẫn đòi ngành, lĩnh vực.
- Điện thoại (≤ 600px), cửa sổ 1024px, bốn chế độ màu (Thanh lịch / Trang nghiêm × sáng / tối).

## Bước 2 — Phát hành (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên: **"Đồng ý áp migration 0116 lên production"**.
2. PR `release/v3.26.0` xanh đủ check → gắn tag `v3.26.0` lên **đầu nhánh phát hành** (chủ dự án đẩy tag).
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt; theo dõi tới smoke xanh và tag `production`.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.26.0` → merge PR phát hành bằng **merge commit**.

## Bước 3 — Báo cán bộ (ngay sau phát hành)
Gửi nhóm cán bộ (chủ dự án sửa lời tuỳ ý):
> Từ hôm nay, khi giao việc, mỗi nhiệm vụ phải chọn **Ngành – lĩnh vực** và **Mục tiêu then chốt** (ô có dấu *) — đây là căn cứ số liệu Tổng quan. Nhiệm vụ
> không thuộc ngành, lĩnh vực trọng tâm nào thì chọn "Không thuộc ngành, lĩnh vực nào"; không phục vụ mục tiêu then chốt nào thì tích "Không thuộc mục tiêu
> then chốt nào". Kết luận Ban Thường vụ, Thông báo Thường trực chọn ngành, lĩnh vực cụ thể. Có văn bản gốc (PDF) thì bấm "Đọc văn bản gốc", rồi "Điền" để
> hệ thống đề xuất sẵn — đồng chí kiểm tra trước khi bấm Giao việc.

## Bước 4 — Phân loại lại việc đã có trên production (chủ dự án thao tác, Claude hỗ trợ)
1. Mở tệp `ra-soat-phan-loai-210-viec-20261019.xlsx` Claude gửi ngày 19/10 (không lưu vào repo): xem sheet "Cần xem lại" (16 dòng) — đồng ý thì giữ, không đồng
   ý thì sửa ô Ngành / Lĩnh vực / Mục tiêu then chốt ở sheet "Rà soát phân loại" (chọn trong danh sách; ô để trống = giữ nguyên).
2. Đăng nhập tài khoản **toàn quyền** (`qt_vptu` — phân loại được mọi việc; tài khoản khác chỉ phân loại việc mình giao / nhập / phụ trách, việc khác báo lỗi
   "không trong phạm vi") → Nhiệm vụ → **Rà soát phân loại** → mở "Rà soát phân loại bằng tệp Excel" → **Chọn tệp đã rà soát…**.
3. Xem trước (chưa ghi gì): số việc sẽ đổi / không đổi / lỗi, cảnh báo đổi lãnh đạo kiêm nhiệm phụ trách. Có lỗi hoặc cảnh báo lạ thì chụp phần tóm tắt gửi
   Claude trước khi áp dụng.
4. Ghi lý do (có sẵn mặc định) → **Áp dụng** (hoặc "Áp dụng, bỏ qua … việc có cảnh báo"). Hệ thống báo số việc đã cập nhật; không gửi tin cho cán bộ.
5. Việc giao sau lúc xuất tệp (19/10) mà còn trống: ở màn Rà soát chọn ô "Chưa phân loại mục tiêu" hoặc "Chưa có ngành, lĩnh vực" → **Xuất tệp rà soát** →
   gửi Claude → Claude phân loại, gửi lại → nhập như bước 2–4.
6. Kiểm: Nhiệm vụ → ô Tổng, không lọc → **Xuất theo mẫu nhập** → gửi Claude đối chiếu 100% với tệp đã duyệt; Tổng quan khối 2–3 không còn "Chưa phân loại".
   Xong thì Claude xoá các tệp dữ liệu thật khỏi phiên làm việc.

## Sau phát hành
- Theo dõi khối 2–3 vài ngày đầu: việc mới có "Chưa phân loại" thì xem nguồn (nhập Excel không ghi cột, Thường trực giao) — phân loại ở màn Rà soát.
- Trợ lý AI trên production: các bước ở `docs/GO-LIVE-V3.25.md` Bước 3 (secret `AI_KEY_ANTHROPIC`, Cấu hình AI) nếu chưa làm.
- Hướng dẫn sử dụng: bổ sung ô bắt buộc phân loại ở Giao việc và Rà soát phân loại bằng tệp.
