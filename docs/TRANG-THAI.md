# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-14)

## Giai đoạn hiện tại
**GĐ5 (giao diện mới theo DESIGN.md) hoàn thành** — PR #18, #19, #20 merge; Deploy Pages thành công; bản live: trang đăng nhập mới, phông tự host và logo nạp đúng, không lỗi HTTP/console (kiểm tra chưa đăng nhập; 3 vai trò trên production do chủ dự án kiểm tra vì Claude không có mật khẩu thật). Sẵn sàng **GĐ6 (CI/CD, Plan mode)**.

## Nhánh & PR đang mở
- PR tài liệu `docs/gd5-hoan-thanh` (file này).

## Đã xong
- GĐ1–GĐ4 (CHANGELOG mục 8–11). GĐ5 (CHANGELOG mục 12): token, phông tự host, logo Cao Bằng, đăng nhập, khung, 3 view, modal, luồng ý kiến, nhắn tin, mobile, chân trang in; Lighthouse Accessibility 100; e2e 16/16.

## Đang dở
- GĐ6: `tests/rls` + `tests/e2e` vào CI với secret staging (quyết định 2026-09-13). GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Không còn câu hỏi mở của GĐ5. GĐ6 cần chủ dự án tạo secrets (liệt kê trong kế hoạch GĐ6).

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)**. GĐ5 không có migration. Ảnh màn hình: `docs/anh-man-hinh/gd5/`, mỗi giai đoạn chỉ giữ bộ mới nhất. Chụp ảnh/Lighthouse: script tạm ngoài repo (Playwright của `tests/e2e`, `lighthouse@12` + `sharp` cài trong thư mục tạm), không thêm phụ thuộc vào repo. e2e chỉ chạy được khi cổng 4173 rảnh (tắt `vite preview` trước).

## 3 lệnh để tiếp tục
```
cd tests/e2e && npm test          # 8 kịch bản × 2 kích thước trên staging (build + preview tự chạy); npm run lint ở gốc repo
```
```
cd tests/rls && npm test          # 48 test RLS trên staging
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/PROMPTS.md "Giai đoạn 6" rồi làm GĐ6 bằng Plan mode.
```
