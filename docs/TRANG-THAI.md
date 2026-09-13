# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ4 (tách frontend Vite) — mã nguồn xong, 3 PR xếp chồng chờ merge theo thứ tự (a) → (b) → (c).** e2e 16/16 (7 kịch bản × 2 kích thước) trên staging. Migration 0011 **đã áp production** (2026-09-13). Chưa đổi nguồn GitHub Pages.

## Nhánh & PR đang mở
- PR (a) #13 `feature/gd4a-vite-khung` → main: khung Vite, auth, toast, migration 0011 (đã áp staging), seed tạo auth user, e2e kịch bản 1–3, CI job frontend, `deploy-pages.yml` (chưa deploy tới khi đổi nguồn Pages).
- PR (b) #14 `feature/gd4b-views` → `feature/gd4a-vite-khung`: views A1/A2/A3 + 3 modal, e2e kịch bản 4–6.
- PR (c) `feature/gd4c-directives-messages-realtime` → `feature/gd4b-views`: ý kiến chỉ đạo, nhắn tin, realtime, e2e kịch bản 7.
- Thứ tự merge: #13 → #14 (GitHub tự chuyển base sang main) → PR (c). Sau đó: thêm 2 secret, chuyển Pages sang GitHub Actions, kiểm tra live, rồi PR xoá `index.html` gốc.

## Đã xong
- GĐ1: RLS tạm + chặn `accounts.password`. GĐ2: Supabase Auth (0004–0006). GĐ3: RLS đầy đủ (0007–0010), 48 test RLS pass, production đã áp và kiểm tra live.

## Đang dở
- GĐ4 việc còn lại sau merge: xoá `index.html` gốc **chỉ sau khi** Pages đã chuyển nguồn sang GitHub Actions và bản live kiểm tra 3 vai trò xong (PR riêng, kèm bỏ ngoại lệ trong `scripts/check-line-limit.mjs`).
- GĐ6: đưa `tests/rls` + `tests/e2e` vào CI với secret staging. GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Chờ quyết định (chủ dự án)
- Thời điểm đổi nguồn Pages sang GitHub Actions; giữ toast thay `alert()`; đưa e2e vào CI ngay hay GĐ6.

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)** — 0011 đã áp production sau xác nhận. Backup mới nhất: `vptu-backup/prod-20260913-2206-gd4-*` (ngoài git).

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
