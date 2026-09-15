# TRẠNG THÁI DỰ ÁN — bản bàn giao (cập nhật: 2026-09-15, GĐ10 đang làm — 10A/10B merged, 10C/10D/10F đang mở tuần tự; kế tiếp phát hành v2.3.0)

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
| 9 | Phân công theo lĩnh vực (Phần 4 GĐ9, Phần 5.4) | **Xong** (2026-09-15): PR 9A #38, 9B #39, `v2.2.0` #40 (0018–0020), đọc `.xlsx` #41; ánh xạ lĩnh vực đợt 1 trên production: 9 cặp → 51 dòng, 133 dòng còn NULL (biên bản `docs/bien-ban-nhap-kl-btvtu.md` mục 7) |
| 10 | Màn hình chuyên viên + dashboard lãnh đạo KL, thời gian thực (kế hoạch chốt 15/9, CHANGELOG mục 19) | **Đang làm** (2026-09-15): 10A #43 (0021 minh chứng bắt buộc) merged; 10B #44 (màn hình danh sách KL, cập nhật nhanh, truy vết) merged; 10C #45 dashboard A1 (CI xanh, chờ merge); 10D realtime + dự phòng, 10F form nhập nhiệm vụ mới — nhánh sẵn, mở PR tuần tự sau 10C; rồi phát hành `v2.3.0` (0021 lên production, cần xác nhận trong phiên) |
| 11–13 | GĐ11 vòng chỉ đạo + đính chính UI + tắt Excel; GĐ12 quản trị nhân sự; GĐ13 xuất PDF, bảng chéo, "so với kỳ trước", `kl_bao_cao` | Chưa bắt đầu (thiết kế Phần 4) |

## 2. Kiến trúc (tóm tắt)
- Frontend Vite + JS thuần + Tailwind build, `frontend/src/{auth,lib,views/{a1,a2,a3,shared},features/{directives,messages,tasks},components,styles}`; anon key qua `VITE_SUPABASE_*`; `base` = `/vptu-mvp-task/` (staging: `/vptu-mvp-task/staging/`).
- Backend chỉ Supabase: Auth (email quy ước `<username>@vptu.caobang.local`), Postgres + RLS + hàm `security definer` (`assign_task`, `approve_task`, `submit_evidence`, `warn_task`, `mark_*_read`), Realtime `postgres_changes`. Schema = `supabase/migrations/0001–0020` (staging và production đều ở 0020 = `v2.2.0`, phát hành 2026-09-15; dữ liệu KL trên production: 185 nhiệm vụ, 51 dòng đã có `linh_vuc_ma`), không sửa tay Dashboard.
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
1. **GĐ10 — đang làm** (thứ tự PR đã chốt: 10A → 10B → 10C → 10D → 10F → phát hành `v2.3.0`): còn merge 10C #45, mở/merge 10D (nhánh `feature/gd10d-realtime-kl`) và 10F (`feature/gd10f-nhap-nhiem-vu`), rồi PR phát hành `feature/phat-hanh-v2.3.0` (CHANGELOG, TRANG-THAI, tài liệu thiết kế: quyết định 3 → "chặn từ GĐ10", ghi chú M2–M7 theo CHANGELOG mục 19; backup tay trước; tag trước merge; **0021 lên production cần xác nhận trong phiên**). Sau phát hành: kiểm tra bản live 3 vai + `quan_tri_kl` (tổng 185, tổng các nhóm = 185, Chưa phân loại 133, 78 chưa minh chứng, không dữ liệu đổi); bắt đầu chạy song song 2 kỳ với Google Sheet (tuần 38–39); trùng 2 kỳ + ≥ 9 chuyên viên tự cập nhật → GĐ11. Quyết định đã chốt của GĐ10: minh chứng dạng văn bản (chưa tải tệp); bỏ "so với kỳ trước"; hàng 4 = ngành → lĩnh vực; chủ trì không đổi loại thời hạn; ô chỉ đạo, đính chính UI, xuất HTML/`kl_bao_cao` → GĐ11/13; số liệu đếm phía client từ dòng RLS trả về; 133 dòng NULL giữ chỉ `quan_tri_kl`/script/đính chính điền.
2. **Ánh xạ lĩnh vực đợt 2+ (việc định kỳ cho tới khi hết)**: còn 14 cặp có gợi ý "chứa tên" + 61 cặp trống (133 dòng) trên production. Khi người quản trị sheet duyệt thêm trên file Excel (`vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.2026-09-15.xlsx`, cột E): backup → `node scripts/anh-xa-linh-vuc.mjs --project-ref frwyxcmbonjaimziiuqr --production --ghi --file "<xlsx>"` (xác nhận trong phiên) — script **bỏ qua dòng đã có lĩnh vực**, chỉ điền dòng NULL, không đổi `cap_nhat_luc`; bổ sung kết quả vào biên bản mục 7 qua PR. Muốn xuất lại bảng duyệt (chỉ đọc): thêm `--out "<file>.xlsx"` — dòng đã có ghi chú "đã có: <mã>". Việc mới nhập trên app (GĐ10 form) chọn lĩnh vực bắt buộc nên không phát sinh thêm.
3. **GĐ11** — vòng chỉ đạo và tắt Excel: PR 11A 4 hành động chỉ đạo (mục 3.3), ô "Chỉ đạo chưa phản hồi", thông báo qua `direct_messages`; PR 11B chốt bắt buộc (minh chứng khi Hoàn thành, "Có hạn cụ thể ⇒ hạn" chuyển sang chặn), Google Sheet chuyển chỉ đọc; bổ sung 6 tình huống vào `docs/xu-ly-su-co.md`. Xong khi một kỳ báo cáo hoàn toàn từ app và một chỉ đạo thật đi hết vòng.
4. **GĐ12** — quản trị nhân sự: luân chuyển, bổ nhiệm, rời cơ quan — đổi phòng/chức vụ/vai trò có hiệu lực theo ngày và có nhật ký (mẫu `phu_trach_phong`/`quyen_lich_su`); việc đang mở của người rời cơ quan → "Giao lại"; khoá tài khoản thay vì xoá. Phạm vi chốt khi mở giai đoạn.
5. **GĐ13** — xuất PDF hai bản trực tiếp từ app (có mã báo cáo), bảng chéo ngành × cơ quan trình, tuổi quá hạn theo bậc; sau 2 tháng vận hành rà lại ngưỡng 7 ngày, xem xét gộp ngành 1 và 12.
6. ~~Đổi ba mặc định `current_date` trong 0013 sang `kl_hom_nay()`~~ — **đã làm trong 0018 (PR 9A)**: `phu_trach(p_ngay)`, `admin_phan_cong_phong(p_tu_ngay)`, cột `phu_trach_phong.tu_ngay`; `rls-11` kiểm mặc định = `kl_hom_nay()`.
7. **Áp phạm vi PCVP theo `phu_trach_phong` cho phần giao việc nội bộ** (tasks/RLS GĐ3) — PR riêng sau GĐ8, vì GĐ8 chỉ áp cho module KL (quyết định 7 trong tài liệu thiết kế).
8. **GĐ7 xong (2026-09-14)** — PR A #29 (`backup-db.sh`, `restore-db.sh`, biên bản khôi phục thử trên local), PR B #30 (`backup-dinh-ky.yml` 3 ngày/lần, `tai-backup.sh` + Task Scheduler, UptimeRobot), PR C (`docs/xu-ly-su-co.md` 11 tình huống). **Còn việc ngoài code:** lên gói Supabase Pro → bật hook khoá tài khoản AUTH-3 (`supabase/config.toml` `[auth.hook.password_verification_attempt] enabled = true`, `config diff` → `config push`, cần xác nhận trong phiên) → diễn tập lại khôi phục trên project hosted tạm (`docs/sao-luu-khoi-phuc.md` mục 5) → biên bản mới.
9. Sau mỗi phát hành: kiểm tra bản live 3 vai trò, CHANGELOG 3–6 dòng (mục 5).

## 7. Lệnh để tiếp tục
```
cd tests/e2e && npm test      # 43 test e2e trên staging (8 lượt đăng nhập); cd tests/rls && npm test (113 test local / 111 + 2 skip staging, 7 lượt); cd frontend && npm test (11 unit); RLS_LOCAL=1 / E2E_LOCAL=1 để chạy trên Supabase local; npm run lint ở gốc
```
Phát hành production (chi tiết + cảnh báo: `docs/kien-truc.md` mục 7) — tag TRƯỚC khi merge, trên đầu nhánh của PR đã CI xanh:
```
git checkout feature/ten-nhanh && git pull && gh pr checks     # đúng nhánh phát hành, 4 check xanh
git tag v2.x.y && git push origin v2.x.y                        # → deploy-prod: kiem-tra → Review deployments → smoke → tag production
# duyệt trên GitHub, đợi 4 job xanh, rồi merge PR bằng merge commit; không push thêm commit lên nhánh sau khi tag
```
Phiên kế tiếp: tiếp GĐ10 theo mục 6.1 (merge 10C → mở 10D → 10F → phát hành `v2.3.0`). Dữ liệu local: `supabase db reset` rồi `node scripts/nhap-kl-btvtu.mjs --file tests/rls/du-lieu-vang/kl-btvtu.json --local --ghi`; test: `cd tests/rls && RLS_LOCAL=1 npm test` (113), `cd frontend && npm test` (11), `cd tests/e2e && E2E_LOCAL=1 npx playwright test kl-*.spec.js`. Lưu ý: tên lớp CSS trong `@layer components` phải xuất hiện nguyên văn trong mã (Tailwind cắt lớp không thấy); mọi test/ảnh chỉ dùng dữ liệu giả. Song song: mục 6.2 khi có file duyệt lĩnh vực mới.

