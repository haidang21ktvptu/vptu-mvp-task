# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ5 (giao diện mới theo DESIGN.md) đang làm, đã qua điểm dừng 1 (đăng nhập + khung: đạt) và đang ở điểm dừng 2 (3 view A1/A2/A3 chờ duyệt bằng mắt).** Còn PR (c): luồng ý kiến chỉ đạo, nhắn tin 1-1 (danh bạ, khung chat, toast tin nhắn), rà lại responsive mobile cho các phần đó; cập nhật `frontend/README.md`, dải thổ cẩm chỗ thứ 3 (chân trang in).

## Nhánh & PR đang mở
- PR #18 `feature/gd5a-tokens-dang-nhap-khung` → main: token, phông tự host, đăng nhập, khung, logo Cao Bằng. CI xanh, chủ dự án đã duyệt ảnh.
- PR #19 `feature/gd5b-views-bang-modal` → **base = nhánh PR #18** (xếp chồng): views, bảng, thanh số liệu, modal. CI xanh. Sau khi #18 merge: `gh pr edit 19 --base main` rồi merge `main` vào nhánh.

## Đã xong
- GĐ1–GĐ4 (xem CHANGELOG mục 8–11). GĐ5 PR (a), (b) như trên; Lighthouse Accessibility đăng nhập/A1/A2/A3 = 100; e2e 16/16.

## Đang dở
- GĐ5 PR (c) (chưa bắt đầu). GĐ6: `tests/rls` + `tests/e2e` vào CI với secret staging. GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Duyệt 6 ảnh điểm dừng 2 (trong PR #19) rồi nói "tiếp" để làm PR (c).

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)**. GĐ5 không có migration. Ảnh màn hình: `docs/anh-man-hinh/gd5/`, mỗi giai đoạn chỉ giữ bộ mới nhất. Chụp ảnh/Lighthouse: script tạm ngoài repo (Playwright của `tests/e2e`, `lighthouse@12` + `sharp` cài trong thư mục tạm), không thêm phụ thuộc vào repo.

## 3 lệnh để tiếp tục
```
cd tests/e2e && npm test          # 8 kịch bản × 2 kích thước trên staging (build + preview tự chạy); npm run lint ở gốc repo
```
```
cd tests/rls && npm test          # 48 test RLS trên staging
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/DESIGN.md; checkout feature/gd5b-views-bang-modal, tạo nhánh feature/gd5c-... và làm PR (c) GĐ5.
```
