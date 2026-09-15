# TRẠNG THÁI DỰ ÁN — bản bàn giao (cập nhật: 2026-09-15, GĐ8 xong; GĐ9 PR 9A CI xanh chờ merge; đánh số GĐ9–13 mới)

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
| 6 | CI/CD: test trên staging trong CI, deploy-staging, deploy-prod có duyệt (tag trước merge), 0012 `is_system` + `smoke_test` | Xong — `v2.0.0-rc2` (2026-09-14), `v2.1.0` (2026-09-15, tag `production` = `5368445`) |
| 7 | Vận hành: backup/restore script, uptime monitor, `docs/xu-ly-su-co.md`, lên Pro + bật hook khoá tài khoản | **Xong** (2026-09-14): PR A #29, PR B #30, PR C; NF-6 đạt (biên bản khôi phục thử). Còn việc ngoài code: lên gói Pro + bật AUTH-3 |
| 8 | Theo dõi KL BTVTU — mô hình dữ liệu và nhập liệu (`docs/thiet-ke-theo-doi-kl-btvtu.md` Phần 4) | **Xong** (2026-09-15): PR 8A-1 #33, 8A-2 #34, 8B #35, phát hành `v2.1.0` #36 (0013–0017); dữ liệu thật đã nhập production (185 nhiệm vụ, 32 hội nghị, 194 nhật ký — `docs/bien-ban-nhap-kl-btvtu.md`), bộ số 14/9 khớp 146/16/8/6/6/3/0; đã cấp `quan_tri_kl` 2 người, phân công PCVP ↔ phòng 5 dòng |
| 9 | Phân công theo lĩnh vực (Phần 4 GĐ9, Phần 5.4) | **Đang làm**: **PR 9A** #38 (0018–0019, màn hình Quản trị kiêm nhiệm lĩnh vực + danh mục, `rls-11`) — CI xanh 2026-09-15, chờ chủ dự án merge. Còn: PR 9B (script ánh xạ + nhật ký danh mục + `linh_vuc_ma` đính chính) → phát hành `v2.2.0` = đóng GĐ9 |
| 10–13 | Đánh số lại 15/9/2026: GĐ10 dashboard đọc + chạy song song (10A màn hình A3/A2, 10B dashboard A1); GĐ11 vòng chỉ đạo + tắt Excel; GĐ12 quản trị nhân sự (luân chuyển, bổ nhiệm, rời cơ quan); GĐ13 xuất PDF | Chưa bắt đầu (thiết kế Phần 4) |

## 2. Kiến trúc (tóm tắt)
- Frontend Vite + JS thuần + Tailwind build, `frontend/src/{auth,lib,views/{a1,a2,a3,shared},features/{directives,messages,tasks},components,styles}`; anon key qua `VITE_SUPABASE_*`; `base` = `/vptu-mvp-task/` (staging: `/vptu-mvp-task/staging/`).
- Backend chỉ Supabase: Auth (email quy ước `<username>@vptu.caobang.local`), Postgres + RLS + hàm `security definer` (`assign_task`, `approve_task`, `submit_evidence`, `warn_task`, `mark_*_read`), Realtime `postgres_changes`. Schema = `supabase/migrations/0001–0019` (0018–0019 chờ merge PR 9A; production và staging ở 0017 = `v2.1.0`), không sửa tay Dashboard.
- Project: **production** `frwyxcmbonjaimziiuqr` (48 cán bộ thật + `smoke_test`; module KL: 185 nhiệm vụ thật `nguon = excel`, 2 tài khoản `quan_tri_kl`, 5 dòng `phu_trach_phong`), **staging** `vojmrjezspdftovzinek` (8 tài khoản giả từ `seed.sql`, mật khẩu `123456`; `demo_qtht` giữ `quan_tri_he_thong`; module KL: bộ dữ liệu vàng ẩn danh 185 dòng từ `tests/rls/du-lieu-vang/kl-btvtu.json`). CLI local luôn link staging; production dùng `--project-ref`.
- Hosting: một site GitHub Pages chứa 2 bản — `/` production (build từ tag `production`; chưa có tag thì từ `main`), `/staging/` (build từ `main`). `phien-ban.json` ở mỗi bản ghi ref/commit.
- Pipeline: `ci.yml` (PR: gitleaks, migration+lint+RLS local, build+lint+300 dòng, RLS+e2e trên staging — 13 lượt đăng nhập/lần) → `deploy-staging.yml` (push main: db push staging → build 2 bản → Pages) → `deploy-prod.yml` (tag `v*` trên đầu nhánh phát hành: `kiem-tra` → duyệt → backup gpg → db push production → build → Pages → smoke `smoke_test` → gắn tag `production`). GitHub Pages chỉ nhận mỗi commit một lần (`pages_build_version` = sha OIDC) — vì thế tag phải gắn trước khi merge.

## 3. Secret và environment (GitHub → Settings)
| Nơi | Tên | Ghi chú |
|---|---|---|
| Repository | `SUPABASE_ACCESS_TOKEN` | token cá nhân Supabase, **hết hạn sau 90 ngày** — xem mục 5 |
| Repository | `STAGING_DB_PASSWORD`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` | chỉ staging; service_role dùng dọn dữ liệu test |
| Repository | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | production, chỉ anon key |
| Repository | `SMOKE_USERNAME` (= `smoke_test`), `SMOKE_PASSWORD` | tài khoản hệ thống production, `is_system = true` |
| Repository | `BACKUP_PASSPHRASE` | cùng giá trị với environment `production`; cho `backup-dinh-ky.yml` (workflow tự động không dùng environment có reviewer được) |
| Environment `production` | `PROD_DB_PASSWORD`, `BACKUP_PASSPHRASE` | reviewer `haidang21ktvptu`, chỉ tag `v*`; passphrase giải mã backup — mất là mất backup |
| Environment `github-pages` | (không secret) | cho phép `main` + tag `v*`, không reviewer |
Ruleset `main`: PR bắt buộc, chặn force-push, 4 check bắt buộc: `Quét rò rỉ bí mật`, `Áp migration + lint schema`, `Build frontend + giới hạn 300 dòng`, `Kiểm thử RLS + e2e trên staging`.

## 4. Quyết định đã chốt (không mở lại)
- Vai trò tầng DB: CVP = A1 + `is_chief`; PCVP = A1 còn lại, khối tính 2 cấp qua `manager_id`; A2 theo `department`; A3 chỉ việc của mình; A2 đọc/ghi luồng ý kiến mọi task trong phòng (0010).
- Giữ mật khẩu cũ khi chuyển sang Auth; `must_change_password` bật tay bằng `admin_set_must_change_password()`. Hook khoá 15 phút (AUTH-3) tạm tắt vì gói Free — bật ở GĐ7 khi lên Pro.
- Staging chỉ dữ liệu giả từ `seed.sql` (rule 11). Mọi migration production cần xác nhận trong phiên (rule 12); từ GĐ6 = duyệt environment `production`. `supabase config push` vẫn làm tay sau khi trình `config diff` (kỳ vọng: `site_url` GitHub Pages, MFA/OTP tắt).
- Không merge thẳng `main`, kể cả docs; chỉ báo "mời merge" sau khi CI xanh trên commit cuối; chủ dự án tự merge.
- GĐ6: phương án A (`/staging/` cùng artifact Pages); tài khoản hệ thống `smoke_test` (A3, CDS_CY, ẩn khỏi mọi danh sách qua `loadAccountsCache`); `SMOKE_*` ở repository secret; RLS chạy thêm trên Supabase local trong CI; production = tag `v*`. **Tag `v*` gắn lên commit đầu nhánh phát hành khi PR đã CI xanh, TRƯỚC khi merge; merge bằng merge commit** (GitHub Pages chỉ nhận mỗi commit một lần — kết luận H1 sau sự cố rc1); quay lui = nhánh mới từ commit cũ + commit rỗng + tag mới (không tag lại commit cũ).
- GĐ8 (15/9): phát hành schema (tag) và nhập dữ liệu thật là hai bước tách biệt — script nhập chạy tay từ máy chủ dự án, có backup, xác nhận trong phiên, không nằm trong pipeline; bộ vàng ẩn danh vào local/CI/staging bằng chính script nhập; danh mục đối chiếu nguyên văn, không bí danh.
- Giữ toast thay `alert()`; không file nào trên 300 dòng; giao diện tiếng Việt có dấu; DESIGN.md là nguồn duy nhất về màu/phông/bố cục.

## 5. Việc định kỳ
- **Đầu tháng 12/2026: tạo `SUPABASE_ACCESS_TOKEN` mới và cập nhật secret TRƯỚC khi hết hạn (~2026-12-13, 90 ngày kể từ 2026-09-14)** — làm theo `docs/xu-ly-su-co.md` #11; nếu đã hết hạn (mọi workflow lỗi xác thực) → #7.
- Khi có sự cố: mở `docs/xu-ly-su-co.md` (11 tình huống, lệnh copy-paste) trước khi làm gì khác.
- Backup: mỗi lần phát hành có artifact `prod-<ngày>-<tag>.tar.gz.gpg` (90 ngày); **bản local chính** = `bash scripts/backup-db.sh --project-ref frwyxcmbonjaimziiuqr --thu-muc "/d/TU 2026/Project/vptu-backup"` chạy trong Git Bash (Docker Desktop mở). Chu kỳ tự động **3 ngày/lần** (PR B) → chấp nhận mất tối đa 3 ngày dữ liệu. Khôi phục: `docs/sao-luu-khoi-phuc.md`.
- Sau mỗi lần phát hành: kiểm tra bản live bằng 3 vai trò (A1 `levanmieu`, A2 `macthuylinh`, A3 `buibahaidang`); ghi CHANGELOG 3–6 dòng.
- Test trên staging (CI hoặc tay) tối đa ~2 lần/5 phút (giới hạn 30 lượt đăng nhập/IP).
- **Backup định kỳ**: Actions → *Backup định kỳ production* phải có run mới mỗi ≤ 3 ngày; GitHub tự tắt schedule sau 60 ngày repo không có commit → bấm *Enable workflow*. Trên máy: `vptu-backup	ai-backup.log` có dòng mới mỗi lần đăng nhập Windows (Task Scheduler `VPTU tai backup`); UptimeRobot theo dõi `phien-ban.json` bản live (docs/sao-luu-khoi-phuc.md mục 3, 9). Đã đăng ký cả hai ngày 2026-09-14; hai secret `BACKUP_PASSPHRASE` (repository + environment) đã kiểm chứng trùng nhau (giải mã artifact CI bằng passphrase trong trình quản lý mật khẩu).
- `supabase/setup-cli@v1` có thể lỗi "rate limit exceeded" (tải CLI từ GitHub releases) khi chạy nhiều workflow trong ngày — chờ 30–60 phút rồi *Re-run failed jobs*; không phải lỗi cấu hình.
- Repo là public — không commit file `.xlsx`/`.pdf` chứa dữ liệu thật, không dán ảnh dashboard có tên thật vào PR/issue.

## 6. Việc còn lại
1. **GĐ9 — phân công theo lĩnh vực.** **PR 9A #38** (0018–0019, màn hình Quản trị: "Kiêm nhiệm lĩnh vực", "Danh mục lĩnh vực" cho `quan_tri_kl`; `rls-11` 8 case; thiết kế Phần 5.4 + quyết định 7 + `xu-ly-su-co.md` #12) — CI xanh trên `ed23fdf`, **chờ chủ dự án merge**. Trên staging `rls-11` và e2e quản trị tự bỏ qua tới khi merge; sau merge deploy-staging áp 0018–0019 → chạy lại `tests/rls` trên staging (kỳ vọng 93/93). **PR 9B** (chốt 15/9): (1) `scripts/anh-xa-linh-vuc.mjs` — đọc 82 giá trị `linh_vuc_chi_tiet` hiện có, đề xuất ánh xạ về `dm_linh_vuc`, xuất bảng để người quản trị sheet duyệt (file ngoài repo), rồi `--ghi` áp lên production, không ánh xạ được → NULL; (2) thêm `linh_vuc_ma` vào `kl_dinh_chinh.cot`; (3) thao tác thêm/sửa danh mục lĩnh vực chuyển sang hàm SQL có nhật ký + lý do (hiện ghi thẳng bảng qua RLS — chưa có vết; nguyên tắc "mọi thay đổi quản trị đều có vết"). **Đóng GĐ9 = phát hành `v2.2.0`** (0018–0019 + migration 9B; tag trước merge trên nhánh phát hành, xác nhận trong phiên; 4 dòng phân công PCVP ↔ phòng đang hiệu lực trên production giữ nguyên = "cả phòng", không ai quá 2 phòng — đã kiểm chỉ đọc 15/9).
2. **GĐ10 — dashboard đọc và chạy song song** (thiết kế Phần 3, 4): PR 10A màn hình A3/A2 (danh sách theo chủ trì, cập nhật nhanh, bộ lọc; form nhập mới chọn ngành → lĩnh vực bắt buộc; ngăn lỗi Phần 6.8), PR 10B dashboard A1 (bố cục 3.2, truy vết 6.3, chưa có nút chỉ đạo) + xuất HTML từ snapshot `kl_bao_cao` (bảng mới). Chạy song song 2 kỳ báo cáo với Google Sheet; trùng 2 kỳ + ≥ 9 chuyên viên tự cập nhật mới sang GĐ11.
3. **GĐ11** — vòng chỉ đạo và tắt Excel: PR 11A 4 hành động chỉ đạo (mục 3.3), ô "Chỉ đạo chưa phản hồi", thông báo qua `direct_messages`; PR 11B chốt bắt buộc (minh chứng khi Hoàn thành, "Có hạn cụ thể ⇒ hạn" chuyển sang chặn), Google Sheet chuyển chỉ đọc; bổ sung 6 tình huống vào `docs/xu-ly-su-co.md`. Xong khi một kỳ báo cáo hoàn toàn từ app và một chỉ đạo thật đi hết vòng.
4. **GĐ12** — quản trị nhân sự: luân chuyển, bổ nhiệm, rời cơ quan — đổi phòng/chức vụ/vai trò có hiệu lực theo ngày và có nhật ký (mẫu `phu_trach_phong`/`quyen_lich_su`); việc đang mở của người rời cơ quan → "Giao lại"; khoá tài khoản thay vì xoá. Phạm vi chốt khi mở giai đoạn.
5. **GĐ13** — xuất PDF hai bản trực tiếp từ app (có mã báo cáo), bảng chéo ngành × cơ quan trình, tuổi quá hạn theo bậc; sau 2 tháng vận hành rà lại ngưỡng 7 ngày, xem xét gộp ngành 1 và 12.
6. ~~Đổi ba mặc định `current_date` trong 0013 sang `kl_hom_nay()`~~ — **đã làm trong 0018 (PR 9A)**: `phu_trach(p_ngay)`, `admin_phan_cong_phong(p_tu_ngay)`, cột `phu_trach_phong.tu_ngay`; `rls-11` kiểm mặc định = `kl_hom_nay()`.
7. **Áp phạm vi PCVP theo `phu_trach_phong` cho phần giao việc nội bộ** (tasks/RLS GĐ3) — PR riêng sau GĐ8, vì GĐ8 chỉ áp cho module KL (quyết định 7 trong tài liệu thiết kế).
8. **GĐ7 xong (2026-09-14)** — PR A #29 (`backup-db.sh`, `restore-db.sh`, biên bản khôi phục thử trên local), PR B #30 (`backup-dinh-ky.yml` 3 ngày/lần, `tai-backup.sh` + Task Scheduler, UptimeRobot), PR C (`docs/xu-ly-su-co.md` 11 tình huống). **Còn việc ngoài code:** lên gói Supabase Pro → bật hook khoá tài khoản AUTH-3 (`supabase/config.toml` `[auth.hook.password_verification_attempt] enabled = true`, `config diff` → `config push`, cần xác nhận trong phiên) → diễn tập lại khôi phục trên project hosted tạm (`docs/sao-luu-khoi-phuc.md` mục 5) → biên bản mới.
9. Sau mỗi phát hành: kiểm tra bản live 3 vai trò, CHANGELOG 3–6 dòng (mục 5).

## 7. Lệnh để tiếp tục
```
cd tests/e2e && npm test      # 17 test e2e trên staging (8 lượt đăng nhập); cd tests/rls && npm test (93 test, 7 lượt); RLS_LOCAL=1 / E2E_LOCAL=1 để chạy trên Supabase local; npm run lint ở gốc
```
Phát hành production (chi tiết + cảnh báo: `docs/kien-truc.md` mục 7) — tag TRƯỚC khi merge, trên đầu nhánh của PR đã CI xanh:
```
git checkout feature/ten-nhanh && git pull && gh pr checks     # đúng nhánh phát hành, 4 check xanh
git tag v2.x.y && git push origin v2.x.y                        # → deploy-prod: kiem-tra → Review deployments → smoke → tag production
# duyệt trên GitHub, đợi 4 job xanh, rồi merge PR bằng merge commit; không push thêm commit lên nhánh sau khi tag
```
Phiên kế tiếp (sau khi chủ dự án merge PR 9A #38): kiểm deploy-staging áp 0018–0019 → `cd tests/rls && npm test` trên staging (kỳ vọng 93/93, `rls-11` chạy thật) → **PR 9B** (mục 6.1: script ánh xạ lĩnh vực, `linh_vuc_ma` đính chính, nhật ký danh mục) → phát hành `v2.2.0` (nhánh phát hành nhỏ, tag trước merge, xác nhận trong phiên) = đóng GĐ9 → GĐ10 PR 10A (đọc Phần 3.4, 6.3, 6.8, DESIGN.md; dữ liệu local: `supabase db reset` rồi `node scripts/nhap-kl-btvtu.mjs --file tests/rls/du-lieu-vang/kl-btvtu.json --local --ghi`). Plan mode, chờ duyệt.

