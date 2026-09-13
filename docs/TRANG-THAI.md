# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-14)

## Giai đoạn hiện tại
**GĐ6 (CI/CD) — PR `feature/gd6-ci-cd` đang mở, chờ chủ dự án tạo secret/environment và trả lời câu hỏi.** GĐ5 đã hoàn thành (PR #18, #19, #20 merge).

## Nhánh & PR đang mở
- `feature/gd6-ci-cd` → main: `ci.yml` thêm job "Kiểm thử RLS + e2e trên staging"; `deploy-staging.yml` (thay `deploy-pages.yml`); `deploy-prod.yml` (tag `v*`, environment production); composite action `build-pages-site`; e2e dùng lại phiên (13 test, 7 lượt đăng nhập); smoke test; `docs/kien-truc.md`.

## Đã xong
- GĐ1–GĐ5 (CHANGELOG mục 8–12). Bản live = build Vite từ `main` (GĐ5 PR c).

## Đang dở
- GĐ6: chờ chủ dự án (1) nhập secret + tạo environment `production` (reviewer haidang21ktvptu, tag `v*`) + thêm tag `v*` vào environment `github-pages` + thêm check vào ruleset — danh sách ở `docs/kien-truc.md` mục 5; (2) sau đó Re-run CI trên PR để job staging xanh; (3) merge → deploy-staging chạy lần đầu (production build từ `main` vì chưa có tag `production`); (4) tag `v2.0.0-rc1` để thử luồng duyệt.
- GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3), `scripts/backup-db.sh` + `restore-db.sh` (khôi phục từ artifact backup của deploy-prod), `docs/xu-ly-su-co.md`.

## Chờ quyết định (chủ dự án)
- Chọn tài khoản cho smoke test production (`SMOKE_USERNAME/PASSWORD`, đề xuất tài khoản A3 của chủ dự án).
- Đồng ý phương án staging frontend ở `/staging/` cùng artifact Pages (so sánh ở `docs/kien-truc.md` mục 4).
- `SMOKE_*` để ở repository secret (tránh duyệt 2 lần) hay environment production (duyệt thêm một lần trước smoke).

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
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/kien-truc.md rồi tiếp tục GĐ6: kiểm tra secret đã nhập, Re-run CI, merge, tag v2.0.0-rc1.
```
