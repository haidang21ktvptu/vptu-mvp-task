# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ4 (tách frontend Vite) đang làm, auto mode, 3 PR.** PR (a) khung Vite + auth + main.js: xong, chờ CI/merge. PR (b) views A1/A2/A3 và PR (c) directives + messages + realtime: làm tiếp trên nhánh nối tiếp.

## Nhánh & PR đang mở
- PR (a) `feature/gd4a-vite-khung`: frontend/ khung Vite, auth, toast, migration 0011 (đã áp staging), seed tạo auth user, e2e kịch bản 1–3 (6/6 pass), CI job frontend, `deploy-pages.yml` (chưa deploy tới khi đổi nguồn Pages).

## Đã xong
- GĐ1: RLS tạm + chặn `accounts.password`. GĐ2: Supabase Auth (0004–0006). GĐ3: RLS đầy đủ (0007–0010), 48 test RLS pass, production đã áp và kiểm tra live.

## Đang dở
- GĐ4 PR (b): views/a1 (dashboard ngoại lệ, cây phân cấp), views/a2 (giao việc, theo dõi/duyệt, KPI), views/a3 (danh sách, modal tiếp nhận, nộp minh chứng), modal phân công lại; e2e kịch bản 4–6.
- GĐ4 PR (c): features/directives, features/messages, features/realtime; xoá `index.html` gốc **chỉ sau khi** Pages đã chuyển nguồn sang GitHub Actions và bản live kiểm tra xong (PR riêng).
- GĐ6: đưa `tests/rls` + `tests/e2e` vào CI với secret staging. GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Xem danh sách câu hỏi ở cuối báo cáo phiên GĐ4 (thời điểm đổi nguồn Pages, áp 0011 lên production, thay `alert()` bằng toast).

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)** — migration 0011 **chưa** áp production. Backup mới nhất: `vptu-backup/prod-20260913-1936-gd3-*` (ngoài git).

## 3 lệnh để tiếp tục
```
cd tests/e2e && npm test          # 6 kịch bản × 2 kích thước trên staging (build + preview tự chạy)
```
```
cd tests/rls && npm test          # 48 test RLS trên staging
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md rồi tiếp tục GĐ4 PR (b)/(c) từ nhánh PR (a).
```
