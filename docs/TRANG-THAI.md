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
| 6 | CI/CD: test trên staging trong CI, deploy-staging, deploy-prod có duyệt, 0012 `is_system` + `smoke_test` | **PR #22 merged; còn phát hành thử `v2.0.0-rc1`** |
| 7 | Vận hành: backup/restore script, uptime monitor, `docs/xu-ly-su-co.md`, lên Pro + bật hook khoá tài khoản | Chưa làm |

## 2. Kiến trúc (tóm tắt)
- Frontend Vite + JS thuần + Tailwind build, `frontend/src/{auth,lib,views/{a1,a2,a3,shared},features/{directives,messages,tasks},components,styles}`; anon key qua `VITE_SUPABASE_*`; `base` = `/vptu-mvp-task/` (staging: `/vptu-mvp-task/staging/`).
- Backend chỉ Supabase: Auth (email quy ước `<username>@vptu.caobang.local`), Postgres + RLS + hàm `security definer` (`assign_task`, `approve_task`, `submit_evidence`, `warn_task`, `mark_*_read`), Realtime `postgres_changes`. Schema = `supabase/migrations/0001–0012`, không sửa tay Dashboard.
- Project: **production** `frwyxcmbonjaimziiuqr` (48 cán bộ thật + `smoke_test`), **staging** `vojmrjezspdftovzinek` (7 tài khoản giả từ `seed.sql`, mật khẩu `123456`). CLI local luôn link staging; production dùng `--project-ref`.
- Hosting: một site GitHub Pages chứa 2 bản — `/` production (build từ tag `production`; chưa có tag thì từ `main`), `/staging/` (build từ `main`). `phien-ban.json` ở mỗi bản ghi ref/commit.
- Pipeline: `ci.yml` (PR: gitleaks, migration+lint+RLS local, build+lint+300 dòng, RLS+e2e trên staging — 13 lượt đăng nhập/lần) → `deploy-staging.yml` (push main: db push staging → build 2 bản → Pages) → `deploy-prod.yml` (tag `v*`: duyệt → backup gpg → db push production → build → Pages → smoke `smoke_test` → gắn tag `production`).

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
- Backup: mỗi lần phát hành có artifact `prod-<ngày>-<tag>.tar.gz.gpg` (90 ngày); backup tay ngoài git ở `D:\TU 2026\Project\vptu-backup\`. GĐ7 sẽ thêm backup hằng đêm.
- Sau mỗi lần phát hành: kiểm tra bản live bằng 3 vai trò (A1 `levanmieu`, A2 `macthuylinh`, A3 `buibahaidang`); ghi CHANGELOG 3–6 dòng.
- Test trên staging (CI hoặc tay) tối đa ~2 lần/5 phút (giới hạn 30 lượt đăng nhập/IP).

## 6. Việc còn lại
1. **Phát hành thử `v2.0.0-rc2`** (kết thúc GĐ6; rc1 thất bại vì tag gắn lên commit đã lên main — Pages chỉ nhận mỗi commit một lần, xem `kien-truc.md` mục 3/7; tag rc1 giữ làm lịch sử). Nhánh phát hành = nhánh của PR khắc phục `fix/phat-hanh-tag-truoc-merge` (chưa merge): `git checkout fix/phat-hanh-tag-truoc-merge && git pull` → CI xanh → `git tag v2.0.0-rc2 && git push origin v2.0.0-rc2` → deploy-prod: `kiem-tra` → Review deployments → duyệt → Summary (backup, `db push` no-op vì 0012 đã áp, smoke) → `phien-ban.json` bản live ghi `v2.0.0-rc2`, tag `production` gắn → **merge PR bằng merge commit** → deploy-staging dựng production từ tag → kiểm tra 3 vai trò → ghi "GĐ6 hoàn thành" vào CHANGELOG mục 13. Không push thêm commit lên nhánh sau khi đã tag.
2. **GĐ7** theo `docs/PROMPTS.md`: `scripts/backup-db.sh` + `restore-db.sh` (khôi phục từ artifact gpg hoặc dump tay), workflow backup hằng đêm, `docs/xu-ly-su-co.md` (10 tình huống), hướng dẫn uptime monitor, lên Pro + bật hook AUTH-3. "Xong khi" chủ dự án tự restore lên project trắng thành công.
3. Tồn đọng nhỏ: bản live production hiện build từ `main` (chưa có tag `production`) — tự hết sau bước 1.

## 7. Lệnh để tiếp tục
```
cd tests/e2e && npm test      # 13 test e2e trên staging (7 lượt đăng nhập); cd tests/rls && npm test (48 test, 6 lượt); npm run lint ở gốc
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/kien-truc.md; làm mục 6.1 (phát hành v2.0.0-rc1) rồi GĐ7 theo docs/PROMPTS.md bằng Plan mode.
```
