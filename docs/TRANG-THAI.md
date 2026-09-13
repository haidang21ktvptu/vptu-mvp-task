# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-14)

## Giai đoạn hiện tại
**GĐ5 (giao diện mới theo DESIGN.md) — PR (a) #18 và (b) #19 đã merge; PR (c) đang mở chờ merge.** Sau khi (c) merge: kiểm tra bản live 3 vai trò rồi ghi "GĐ5 hoàn thành" và sang GĐ6.

## Nhánh & PR đang mở
- PR (c) `feature/gd5c-y-kien-nhan-tin-mobile` → main: luồng ý kiến chỉ đạo, danh bạ + khung chat + toast tin nhắn, responsive phần đó, chân trang in có thổ cẩm. e2e 16/16, CI xanh.

## Đã xong
- GĐ1–GĐ4 (CHANGELOG mục 8–11). GĐ5 PR (a) token/phông tự host/đăng nhập/khung/logo, PR (b) views/bảng/modal — Lighthouse Accessibility 100 cả 4 màn hình.

## Đang dở
- GĐ6: `tests/rls` + `tests/e2e` vào CI với secret staging (quyết định 2026-09-13). GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Merge PR (c). Không có câu hỏi mở khác của GĐ5.

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
