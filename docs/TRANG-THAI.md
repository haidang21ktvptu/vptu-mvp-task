# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-14)

## Giai đoạn hiện tại
**GĐ6 (CI/CD) — PR #22 `feature/gd6-ci-cd` đang mở, CI xanh 4/4; chờ áp migration 0012 + tạo `smoke_test` lên production (xác nhận trong phiên) rồi merge.** GĐ5 đã hoàn thành (PR #18, #19, #20 merge).

## Nhánh & PR đang mở
- PR #22 `feature/gd6-ci-cd` → main: migration `0012_accounts_is_system` + `smoke_test` (đã áp staging); `ci.yml` thêm job "Kiểm thử RLS + e2e trên staging"; `deploy-staging.yml` (thay `deploy-pages.yml`); `deploy-prod.yml` (tag `v*`, environment production); composite action `build-pages-site`; e2e dùng lại phiên (13 test, 7 lượt đăng nhập); smoke test; `docs/kien-truc.md`.

## Đã xong
- GĐ1–GĐ5 (CHANGELOG mục 8–12). Bản live = build Vite từ `main` (GĐ5 PR c).

## Đang dở
- GĐ6 còn: (1) production — backup → áp 0012 → `scripts/create-system-account.mjs --project-ref frwyxcmbonjaimziiuqr` → đưa mật khẩu cho chủ dự án dán vào `SMOKE_PASSWORD` (cần xác nhận trong phiên); (2) chủ dự án hoàn tất secret còn lại + environment `production` (reviewer haidang21ktvptu, tag `v*`) + tag `v*` cho `github-pages` + check `Kiểm thử RLS + e2e trên staging` vào ruleset (`docs/kien-truc.md` mục 5); (3) merge #22 → deploy-staging chạy lần đầu (production build từ `main` vì chưa có tag `production`); (4) tag `v2.0.0-rc1` thử luồng duyệt → smoke.
- GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3), `scripts/backup-db.sh` + `restore-db.sh` (khôi phục từ artifact backup của deploy-prod), `docs/xu-ly-su-co.md`.

## Chờ quyết định (chủ dự án)
- Đã chốt 2026-09-14: phương án A (`/staging/`), tài khoản hệ thống `smoke_test` (is_system), `SMOKE_*` ở repository secret, RLS local trong CI. Còn chờ: câu xác nhận áp 0012 + tạo `smoke_test` lên production.

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)** — từ GĐ6 việc áp là bước duyệt environment `production` trên GitHub khi đẩy tag `v*`. Test e2e/RLS trên staging: 13 lượt đăng nhập/lần, không chạy lại liên tiếp trong 5 phút. e2e chỉ chạy được khi cổng 4173 rảnh. Ảnh màn hình: `docs/anh-man-hinh/gd5/`.

## 3 lệnh để tiếp tục
```
cd tests/e2e && npm test          # 13 test trên staging (build + preview tự chạy; 7 lượt đăng nhập); npm run lint ở gốc repo
```
```
cd tests/rls && npm test          # 48 test RLS trên staging (6 lượt đăng nhập)
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/kien-truc.md rồi tiếp tục GĐ6: production 0012 + smoke_test (xác nhận), merge #22, tag v2.0.0-rc1.
```
