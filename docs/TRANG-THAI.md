# TRẠNG THÁI DỰ ÁN — bản bàn giao (cập nhật: 2026-09-14)

Đọc trước: `CLAUDE.md` (quy tắc), `docs/SPEC.md` (nghiệp vụ), `docs/DESIGN.md` (giao diện), `docs/kien-truc.md` (pipeline, secret, quay lui), `docs/PROMPTS.md` (prompt theo giai đoạn). Lịch sử: `CHANGELOG.md` mục 7–13.

## 1. Hiện trạng 7 giai đoạn
| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 0 | Khung thư mục, migration 0001 baseline, CI lint | Xong |
| 1 | Chặn rò rỉ: RLS tạm, `accounts_public`, bỏ đọc/ghi thẳng `password` | Xong |
| 2 | Supabase Auth (giữ mật khẩu cũ, bcrypt tại máy), 0004–0006, `config.toml` | Xong |
| 3 | RLS đầy đủ theo vai trò (0007–0010), hàm nghiệp vụ, `tests/rls` 48 test | Xong |
| 4 | Vite + module hoá (`frontend/`), 0011 FK `accounts.id → auth.users.id`, `tests/e2e` | Xong |
| 5 | Giao diện mới theo DESIGN.md, phông tự host, responsive, in, Lighthouse A11y 100 | Xong |
| 6 | CI/CD: test trên staging trong CI, deploy-staging, deploy-prod có duyệt (tag trước merge), 0012 `is_system` + `smoke_test` | Xong — `v2.0.0-rc2` phát hành 2026-09-14, tag `production` = `2e90a89` |
| 7 | Vận hành: backup/restore script, uptime monitor, `docs/xu-ly-su-co.md`, lên Pro + bật hook khoá tài khoản | **PR A xong** (`backup-db.sh`, `restore-db.sh`, `docs/sao-luu-khoi-phuc.md`); còn biên bản khôi phục thử, PR B, PR C |

## 2. Kiến trúc (tóm tắt)
- Frontend Vite + JS thuần + Tailwind build, `frontend/src/{auth,lib,views/{a1,a2,a3,shared},features/{directives,messages,tasks},components,styles}`; anon key qua `VITE_SUPABASE_*`; `base` = `/vptu-mvp-task/` (staging: `/vptu-mvp-task/staging/`).
- Backend chỉ Supabase: Auth (email quy ước `<username>@vptu.caobang.local`), Postgres + RLS + hàm `security definer` (`assign_task`, `approve_task`, `submit_evidence`, `warn_task`, `mark_*_read`), Realtime `postgres_changes`. Schema = `supabase/migrations/0001–0012`, không sửa tay Dashboard.
- Project: **production** `frwyxcmbonjaimziiuqr` (48 cán bộ thật + `smoke_test`), **staging** `vojmrjezspdftovzinek` (7 tài khoản giả từ `seed.sql`, mật khẩu `123456`). CLI local luôn link staging; production dùng `--project-ref`.
- Hosting: một site GitHub Pages chứa 2 bản — `/` production (build từ tag `production`; chưa có tag thì từ `main`), `/staging/` (build từ `main`). `phien-ban.json` ở mỗi bản ghi ref/commit.
- Pipeline: `ci.yml` (PR: gitleaks, migration+lint+RLS local, build+lint+300 dòng, RLS+e2e trên staging — 13 lượt đăng nhập/lần) → `deploy-staging.yml` (push main: db push staging → build 2 bản → Pages) → `deploy-prod.yml` (tag `v*` trên đầu nhánh phát hành: `kiem-tra` → duyệt → backup gpg → db push production → build → Pages → smoke `smoke_test` → gắn tag `production`). GitHub Pages chỉ nhận mỗi commit một lần (`pages_build_version` = sha OIDC) — vì thế tag phải gắn trước khi merge.

## 3. Secret và environment (GitHub → Settings)
| Nơi | Tên | Ghi chú |
|---|---|---|
| Repository | `SUPABASE_ACCESS_TOKEN` | token cá nhân Supabase, **hết hạn sau 90 ngày** — xem mục 5 |
| Repository | `STAGING_DB_PASSWORD`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` | chỉ staging; service_role dùng dọn dữ liệu test |
| Repository | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | production, chỉ anon key |
| Repository | `SMOKE_USERNAME` (= `smoke_test`), `SMOKE_PASSWORD` | tài khoản hệ thống production, `is_system = true` |
| Environment `production` | `PROD_DB_PASSWORD`, `BACKUP_PASSPHRASE` | reviewer `haidang21ktvptu`, chỉ tag `v*`; passphrase giải mã backup — mất là mất backup |
| Environment `github-pages` | (không secret) | cho phép `main` + tag `v*`, không reviewer |
Ruleset `main`: PR bắt buộc, chặn force-push, 4 check bắt buộc: `Quét rò rỉ bí mật`, `Áp migration + lint schema`, `Build frontend + giới hạn 300 dòng`, `Kiểm thử RLS + e2e trên staging`.

## 4. Quyết định đã chốt (không mở lại)
- Vai trò tầng DB: CVP = A1 + `is_chief`; PCVP = A1 còn lại, khối tính 2 cấp qua `manager_id`; A2 theo `department`; A3 chỉ việc của mình; A2 đọc/ghi luồng ý kiến mọi task trong phòng (0010).
- Giữ mật khẩu cũ khi chuyển sang Auth; `must_change_password` bật tay bằng `admin_set_must_change_password()`. Hook khoá 15 phút (AUTH-3) tạm tắt vì gói Free — bật ở GĐ7 khi lên Pro.
- Staging chỉ dữ liệu giả từ `seed.sql` (rule 11). Mọi migration production cần xác nhận trong phiên (rule 12); từ GĐ6 = duyệt environment `production`. `supabase config push` vẫn làm tay sau khi trình `config diff` (kỳ vọng: `site_url` GitHub Pages, MFA/OTP tắt).
- Không merge thẳng `main`, kể cả docs; chỉ báo "mời merge" sau khi CI xanh trên commit cuối; chủ dự án tự merge.
- GĐ6: phương án A (`/staging/` cùng artifact Pages); tài khoản hệ thống `smoke_test` (A3, CDS_CY, ẩn khỏi mọi danh sách qua `loadAccountsCache`); `SMOKE_*` ở repository secret; RLS chạy thêm trên Supabase local trong CI; production = tag `v*`. **Tag `v*` gắn lên commit đầu nhánh phát hành khi PR đã CI xanh, TRƯỚC khi merge; merge bằng merge commit** (GitHub Pages chỉ nhận mỗi commit một lần — kết luận H1 sau sự cố rc1); quay lui = nhánh mới từ commit cũ + commit rỗng + tag mới (không tag lại commit cũ).
- Giữ toast thay `alert()`; không file nào trên 300 dòng; giao diện tiếng Việt có dấu; DESIGN.md là nguồn duy nhất về màu/phông/bố cục.

## 5. Việc định kỳ
- **`SUPABASE_ACCESS_TOKEN` hết hạn ~2026-12-13** (90 ngày kể từ 2026-09-14): tạo token mới ở supabase.com → Account → Access Tokens, cập nhật secret; dấu hiệu hết hạn là job `Áp migration lên staging` / `phat-hanh` lỗi xác thực.
- Backup: mỗi lần phát hành có artifact `prod-<ngày>-<tag>.tar.gz.gpg` (90 ngày); **bản local chính** = `bash scripts/backup-db.sh --project-ref frwyxcmbonjaimziiuqr --thu-muc "/d/TU 2026/Project/vptu-backup"` chạy trong Git Bash (Docker Desktop mở). Chu kỳ tự động **3 ngày/lần** (PR B) → chấp nhận mất tối đa 3 ngày dữ liệu. Khôi phục: `docs/sao-luu-khoi-phuc.md`.
- Sau mỗi lần phát hành: kiểm tra bản live bằng 3 vai trò (A1 `levanmieu`, A2 `macthuylinh`, A3 `buibahaidang`); ghi CHANGELOG 3–6 dòng.
- Test trên staging (CI hoặc tay) tối đa ~2 lần/5 phút (giới hạn 30 lượt đăng nhập/IP).
- `supabase/setup-cli@v1` có thể lỗi "rate limit exceeded" (tải CLI từ GitHub releases) khi chạy nhiều workflow trong ngày — chờ 30–60 phút rồi *Re-run failed jobs*; không phải lỗi cấu hình.

## 6. Việc còn lại
1. **GĐ7 — Vận hành** (Plan mode từng PR). Đã xong PR A: `scripts/backup-db.sh` + `restore-db.sh` + `docs/sao-luu-khoi-phuc.md` (đã thử local + staging → local, 48 test RLS pass). **Việc kế tiếp**: (a) chủ dự án chạy thử `restore-db.sh --local --ghi-de` lên Supabase local theo docs mục 4 (gói Free hết 2 project, không tạo được project trắng; thử lại hosted khi lên Pro — docs mục 5) → viết `docs/bien-ban-khoi-phuc-<ngày>.md` (điều kiện xong GĐ7, SPEC NF-6); (b) **PR B**: workflow backup định kỳ **3 ngày/lần** (artifact `prod-<ngày>-dinh-ky`, gọi `backup-db.sh`; cho `deploy-prod.yml` gọi luôn script), `scripts/tai-backup.sh` tải artifact về `vptu-backup` (**không tự xoá bản cũ trừ khi ghi rõ `--giu N`**) + hướng dẫn Task Scheduler, uptime monitor ngoài; (c) **PR C**: `docs/xu-ly-su-co.md` (10 tình huống × 5 dòng); (d) lên gói Pro + bật hook khoá tài khoản (AUTH-3, `config.toml` dòng ~300).
2. Sau mỗi phát hành: kiểm tra bản live 3 vai trò, CHANGELOG 3–6 dòng (mục 5).

## 7. Lệnh để tiếp tục
```
cd tests/e2e && npm test      # 13 test e2e trên staging (7 lượt đăng nhập); cd tests/rls && npm test (48 test, 6 lượt); npm run lint ở gốc
```
Phát hành production (chi tiết + cảnh báo: `docs/kien-truc.md` mục 7) — tag TRƯỚC khi merge, trên đầu nhánh của PR đã CI xanh:
```
git checkout feature/ten-nhanh && git pull && gh pr checks     # đúng nhánh phát hành, 4 check xanh
git tag v2.x.y && git push origin v2.x.y                        # → deploy-prod: kiem-tra → Review deployments → smoke → tag production
# duyệt trên GitHub, đợi 4 job xanh, rồi merge PR bằng merge commit; không push thêm commit lên nhánh sau khi tag
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/kien-truc.md, docs/sao-luu-khoi-phuc.md rồi làm GĐ7 PR B (workflow backup 3 ngày/lần + tai-backup.sh + uptime) bằng Plan mode.
```
