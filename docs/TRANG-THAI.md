# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ4 (tách frontend Vite) đang làm, auto mode, 3 PR xếp chồng.** PR (a) #13 khung Vite + auth: CI xanh, chờ merge. PR (b) views A1/A2/A3: xong, e2e 12/12. PR (c) directives + messages + realtime: đang làm.

## Nhánh & PR đang mở
- PR (a) #13 `feature/gd4a-vite-khung` → main: khung Vite, auth, toast, migration 0011 (đã áp staging), seed tạo auth user, e2e kịch bản 1–3, CI job frontend, `deploy-pages.yml` (chưa deploy tới khi đổi nguồn Pages).
- PR (b) `feature/gd4b-views` → `feature/gd4a-vite-khung`: views A1/A2/A3 + 3 modal, e2e kịch bản 4–6. Merge (a) trước rồi GitHub tự chuyển base của (b) sang main.

## Đã xong
- GĐ1: RLS tạm + chặn `accounts.password`. GĐ2: Supabase Auth (0004–0006). GĐ3: RLS đầy đủ (0007–0010), 48 test RLS pass, production đã áp và kiểm tra live.

## Đang dở
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
