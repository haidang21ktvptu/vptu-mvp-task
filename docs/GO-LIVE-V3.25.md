# Phát hành v3.25.0 — gộp v3.24 + v3.25: Tổng quan cho lãnh đạo, thống kê sử dụng, mục tiêu then chốt tự nhận diện, trợ lý AI

Bản phát hành **v3.25.0** = v3.24.0 (PR #142, migration **0104–0106**) + v3.25.0 (PR #143, **0107–0113**; PR #144, #145 chỉnh trợ lý AI) + đợt sửa gộp sau kiểm tay 18/10/2026 (nhánh `fix/v3.25-dot-sua-gop`, **0114**, CHANGELOG 76) + sửa "mục tiêu đã bỏ bị tích lại" (nhánh `fix/v3.25-khong-tich-lai`, **0115**, CHANGELOG 77) + PR phát hành `release/v3.25.0`. Production đang chạy `v3.23.2` (0001–0103); staging đã áp tới 0114 (0115 sau khi PR sửa mục tiêu đã bỏ được merge); trợ lý AI trên staging chạy Claude `claude-opus-5-5` mức Cao.

Mỗi bước do **chủ dự án** làm (hoặc làm cùng Claude trong phiên). Claude không tự thao tác trên production, không dùng mật khẩu, khoá service hay khoá AI. Làm **lần lượt**, xong bước này mới sang bước sau.

## Thay đổi khi áp lên production
- **0104**: bảng `nhat_ky_dang_nhap` (chỉ quản trị hệ thống đọc; bắt đầu ghi từ lần đăng nhập đầu sau phát hành), hàm thống kê đăng nhập / nhập mới, chỉ mục `nhiem_vu(created_at)`.
- **0105–0106**: khối / ngành / nhóm mục tiêu, `dm_muc_tieu` (bản tạm theo tin bài — chờ văn bản gốc Nghị quyết Đại hội XX), gắn mục tiêu cho việc / văn bản, cột Mục tiêu then chốt của mẫu nhập Excel (29 cột), `chi_tieu_ket_qua`.
- **0107–0111, 0113**: danh mục mở rộng (thêm nhanh – sửa có kiểm soát – không xoá), bộ nhận diện, tự học, màn Rà soát mục tiêu then chốt; 0113 nạp bộ quy tắc ban đầu.
- **0112**: `cau_hinh_ai` mặc định Claude `claude-sonnet-5-5`, mức Vừa, đang bật, cho gửi nội dung, 300 lượt / ngày, 40 lượt / người; `nhat_ky_ai` (không lưu nội dung). Bước 3 đổi theo quyết định của chủ dự án.
- **0114**: người giao tự giao cho chính mình được ghi "đã nhận" ngay (chỉ đổi hàm trigger `nhiem_vu_tu_nhan_viec`; không sửa dữ liệu có sẵn).
- **0115**: mục tiêu người dùng đã bỏ ở một việc không tự tích lại ở việc đó; việc đã gắn riêng không tích sẵn theo mục tiêu của văn bản (chỉ thay hàm `goi_y_muc_tieu_viec`; không sửa dữ liệu có sẵn).
- Không migration nào sửa hay gắn mục tiêu cho việc / văn bản đang có. Việc cũ chưa gắn mục tiêu — gắn dần khi giao mới, nhập Excel, hoặc ở màn Rà soát mục tiêu then chốt.
- Edge Function `tro-ly-ai` triển khai cùng lượt. Chưa có secret `AI_KEY_ANTHROPIC` thì nút đọc văn bản chỉ đọc số hiệu / ngày / trích yếu ở trang đầu (không gửi đi đâu); workflow *Học quy tắc mục tiêu* (02:00) tự bỏ qua.

## Bước 1 — Kiểm bản cuối trên staging (`https://haidang21ktvptu.github.io/vptu-mvp-task/staging/`)
Claude tự kiểm trong khung trình duyệt (chủ dự án chỉ đăng nhập tài khoản Claude nêu tên, không gõ mật khẩu hộ) và báo kết quả; chủ dự án xem lại bản cuối rồi báo **đồng ý** mới sang Bước 2.

## Bước 2 — Phát hành (quy tắc 12 + `docs/kien-truc.md` mục 7)
1. Chủ dự án gửi trong phiên: **"Đồng ý áp migration 0104–0115 lên production"**.
2. PR `release/v3.25.0` xanh đủ check → gắn tag `v3.25.0` lên **đầu nhánh phát hành**.
3. GitHub → Actions → run "Deploy production" của tag → **Review deployments** → duyệt; theo dõi tới smoke xanh và tag `production`.
4. Kiểm `https://haidang21ktvptu.github.io/vptu-mvp-task/phien-ban.json` ghi `v3.25.0` → merge PR phát hành bằng **merge commit**.

## Bước 3 — Trợ lý AI trên production (kiểm soát chi phí)
1. Claude Console → tạo **workspace riêng cho production** (ví dụ "VPTU production") → đặt **hạn mức chi tiêu tháng** của workspace (đề xuất 50 USD — đủ khoảng 290 văn bản 1–2 trang, hoặc 120 văn bản 28 trang theo số đo staging).
2. Trong workspace đó → API keys → **Create key** → Copy. Không dùng chung khoá với staging.
3. Supabase Dashboard → project **production** `frwyxcmbonjaimziiuqr` → Edge Functions → Secrets → `AI_KEY_ANTHROPIC` → Save.
4. Bản live → Quản trị › Cấu hình AI (có lý do): mô hình `claude-opus-5-5`, mức suy nghĩ **Cao** (chủ dự án giữ Opus 5.5 — độ chính xác trước), **80 lượt / ngày, 10 lượt / người / ngày** → **Kiểm tra kết nối**.
5. Giao thật một văn bản bằng "Đọc văn bản gốc (PDF)"; theo dõi bảng Nhật ký dùng trợ lý AI (thời gian, token — từ đợt sửa gộp ghi cả lượt lỗi).

## Bước 4 — Sau phát hành
- Theo dõi *Học quy tắc mục tiêu* (02:00) và Nhật ký AI (lượt, token — chi phí API).
- Thử mô hình rẻ hơn (Sonnet 5.5 / Haiku 5.5) trên staging bằng 10–15 văn bản đã công khai, so số giá trị đối chiếu được và số nhiệm vụ tách đúng với Opus — chỉ đổi khi không kém chính xác (chủ dự án quyết).
- Còn chờ chủ dự án: văn bản gốc Nghị quyết Đại hội XX (sửa danh mục bằng migration mới), số liệu chỉ tiêu chủ yếu.
- Hướng dẫn sử dụng: bổ sung Tổng quan 9 khối, Thống kê sử dụng, mục tiêu then chốt, Đọc văn bản gốc (PDF) (nhãn "chưa trọn câu", "Có thể còn sót"), Cấu hình AI.
