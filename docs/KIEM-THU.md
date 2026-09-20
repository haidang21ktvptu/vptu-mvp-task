# Kiểm thử — công tắc môi trường

Job CI `Kiểm thử RLS + e2e trên staging` (`.github/workflows/ci.yml`) đọc biến kho `vars.KIEM_THU_MOI_TRUONG`:

| Giá trị | Project | Việc job làm |
|---|---|---|
| (trống) hoặc `staging` | `vojmrjezspdftovzinek` | e2e như trước (migration và RLS trên staging do `deploy-staging.yml` lo khi push `main`). |
| `production` | `frwyxcmbonjaimziiuqr` | `supabase db push` migration của nhánh → `scripts/seed-demo.mjs` (tài khoản demo, idempotent) → **chỉ e2e** (không test RLS token thật). |

Summary của job ghi dòng đầu "Môi trường kiểm thử: … (project …)"; với production ghi thêm "production: chỉ e2e". `deploy-staging.yml` và `deploy-prod.yml` không đổi.

**Nguyên tắc: không chạy bộ RLS token thật trên production.** Bộ `tests/rls` giả định seed của staging (id tài khoản cố định, phân công PCVP demo, tổng số dòng như `supabase/seed.sql`, không ai giữ `quan_tri_kl`) nên trên dữ liệu thật đỏ hàng loạt (rls-9/10/11, kl-0025/0026/0028, kl-pham-vi-tong-hop) dù mã đúng. RLS của chính PR đã chạy đủ trên Supabase cục bộ ở job "Áp migration + lint schema"; production chỉ dùng để chạy e2e trên schema và dữ liệu thật. Không viết lại bộ test cho production.

## Secret / biến trên GitHub

- Biến kho `KIEM_THU_MOI_TRUONG` (Settings → Variables → Repository): tạo khi cần `production`; xoá hoặc đặt `staging` để quay về.
- Secret kho đã có và được dùng lại: `VITE_SUPABASE_ANON_KEY` (anon production), `SUPABASE_SERVICE_ROLE_KEY` (service_role production), `SUPABASE_ACCESS_TOKEN`.
- Secret kho cần có thêm ở cấp **kho** (job PR không dùng environment `production`): `PROD_DB_PASSWORD` (hiện chỉ có trong environment `production` của `deploy-prod.yml`).

## Khi nào đổi sang production

Chỉ khi cần kiểm thử trên dữ liệu thật trước go-live (ví dụ bộ mốc `kl-moc-2026-09-14` với 185 nhiệm vụ), trong khung giờ cán bộ không dùng hệ thống, và chủ dự án bật trong phiên đó. Bật biến = xác nhận áp migration của nhánh lên production (quy tắc 12 CLAUDE.md). Tắt ngay sau khi xong.

## Điều gì được ghi lên project khi test

- `scripts/seed-demo.mjs`: **thêm** auth user + dòng `accounts` còn thiếu cho 17 tài khoản `demo_*`, `demo_e2e_*` (có `demo_e2e_cv2` — chủ trì mới khi giao lại, 0045), `smoke_test` (cùng id với `supabase/seed.sql`, mật khẩu `123456`); tài khoản đã có, hoặc username đã tồn tại với id khác (tài khoản thật), thì bỏ qua. Phân công `phu_trach_phong` giả chỉ chèn khi phòng chưa có lãnh đạo thật phụ trách. Chạy tay: `KIEM_THU_MOI_TRUONG=production node scripts/seed-demo.mjs --project-ref frwyxcmbonjaimziiuqr` (CLI đã `supabase login`).
- Bộ dữ liệu mẫu `E2E-SEED` (`scripts/seed-demo-du-lieu.mjs`, chạy cuối `seed-demo.mjs`): văn bản `so_ket_luan = E2E-SEED` + 6 nhiệm vụ `noi_dung` bắt đầu `E2E-SEED` (đang thực hiện, quá hạn Đỏ, sắp đến hạn, hoàn thành có minh chứng, việc cũ `theo_1400=false`, việc mới chưa xác nhận) ở phòng `TONG_HOP` (hoặc phòng đầu tiên có PCVP phụ trách), owner/người giao là tài khoản `demo_*` tra theo username. Idempotent: chỉ chèn dòng thiếu, tính lại hạn theo hôm nay; thiếu tài khoản demo nào thì dừng và báo tên. Sau khi nạp, script đọc `v_nhiem_vu` bằng token `demo_cvp` và `demo_a0`, đỏ nếu không thấy đủ 6 dòng. Cần có vì `a0.spec`, `bo-cuc-mobile`, `kl-dashboard` giả định phạm vi A0/A1 có sẵn dòng. Trước đó script tạo đơn vị `E2E_RT` (phòng của `demo_e2e_tp/cv/cv2`, để việc có Owner tài khoản ở đó và giao lại đổi chủ trì) và **phòng thử** `E2E_PT` trong `dm_don_vi` (giữ phân công đang có của `demo_pcvp2`) và phân công `demo_pcvp2` phụ trách (`ly_do = seed kiểm thử`) — spec cần "PCVP phụ trách phòng X" (`chi-dao-tt`) đọc phòng lúc chạy qua `phongPhuTrach()`, không gõ cứng phòng thật.
- Test RLS/e2e tự tạo và tự dọn: văn bản `RLS-TEST`, hội nghị 991–999, nhiệm vụ `NV-T*`, nhiệm vụ có nội dung bắt đầu bằng `E2E-TEST`, đề nghị từ chối, minh chứng, chỉ đạo trên các việc đó.
- Trên production, các file RLS gọi `canh_bao_quet` **tự bỏ qua** (`kl-0029`, `kl-0030`, `kl-0032`, `kl-0034`, `kl-0035`): hàm quét gửi cảnh báo tới mọi việc thật và phần dọn của chúng xoá tin hệ thống sau mốc t0. Vài test phạm vi PCVP (`rls-9/10/11`, `kl-pham-vi-tong-hop`) có thể đỏ nếu phòng thật đã có lãnh đạo phụ trách (seed không chèn phân công giả) — đọc log để phân biệt với lỗi mã.
- Không có gì chạm 185 nhiệm vụ thật hay tài khoản thật.

## Dọn dữ liệu thử trước go-live

1. Tắt biến `KIEM_THU_MOI_TRUONG` (hoặc đặt `staging`).
2. Xoá dữ liệu thử còn sót (bình thường test đã tự dọn): nhiệm vụ `ma LIKE 'NV-T%'` hoặc `noi_dung LIKE 'E2E-TEST%'`, văn bản `so_ket_luan LIKE 'E2E-TEST%'` hoặc `= 'RLS-TEST'`, văn bản `so_hoi_nghi` 991–999, tài khoản `kl0034_a0b` — chạy tay qua Dashboard/CLI với câu lệnh in số dòng trước khi xoá.
3. Tài khoản demo: xoá `demo_*`, `demo_e2e_*` bằng `node scripts/create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --rollback` **chỉ với các id `00000000-0000-4000-8000-0000000000NN`** (kiểm tra danh sách trước), rồi xoá dòng `accounts` tương ứng; giữ `smoke_test` nếu đang dùng cho smoke test sau phát hành.
4. Xoá phân công `phu_trach_phong` có `ly_do = 'seed kiểm thử'`.
5. Xác nhận lại bằng `kl-moc-2026-09-14` (đếm 185 dòng `nguon = excel` không đổi).

## Edge Function `quan-tri-tai-khoan` (GĐ23)

Mã ở `supabase/functions/quan-tri-tai-khoan/index.ts` (Deno). Việc cần `service_role` (tạo tài khoản đăng nhập, đặt mật khẩu tạm, khoá/mở, cờ `quan_tri_he_thong`) chạy ở đây; key `SUPABASE_SERVICE_ROLE_KEY` do Supabase cấp sẵn trong secrets của function, **không** nằm ở frontend hay repo. Người gọi phải đăng nhập và có `accounts.quan_tri_he_thong` (function gọi RPC `me_quan_tri_he_thong` bằng JWT của họ). Mọi hành động ghi `nhat_ky_he_thong` (0041); mật khẩu tạm chỉ trả về một lần trong response.

- Deploy tự động: `deploy-staging.yml` (push `main`) và `deploy-prod.yml` (tag `v*`) chạy `supabase functions deploy quan-tri-tai-khoan --project-ref <ref> --use-api` ngay sau `db push`.
- Deploy tay (khi cần thử trên staging trước khi merge): `supabase functions deploy quan-tri-tai-khoan --project-ref vojmrjezspdftovzinek --use-api` (CLI đã `supabase login`). Không cần đặt secret gì thêm.
- Kiểm thử: màn hình Quản trị → Tài khoản (tài khoản `demo_qtht`): tạo tài khoản thử, đặt lại mật khẩu, khoá/mở; xem dòng tương ứng ở tab Nhật ký hệ thống. Cấp/thu `quan_tri_kl` vẫn qua hàm SQL `admin_dat_co` (e2e `quan-tri.spec.js` không phụ thuộc function).
- Lỗi thường gặp: HTTP 401/403 = phiên hết hạn hoặc không có cờ; 409 = trùng tên đăng nhập; xem log ở Dashboard → Edge Functions → Logs.

## Cờ đổi mật khẩu lần đầu và dọn dữ liệu (GĐ23)

- Trước go-live: `node scripts/bat-co-doi-mat-khau.mjs --project-ref frwyxcmbonjaimziiuqr` in danh sách tài khoản thật (bỏ `demo_*`, `smoke_test`, `is_system`); chạy lại với `--thuc-hien` để bật cờ; script đếm lại số dòng sau khi ghi.
- Màn hình Dọn dữ liệu (`quan_tri_he_thong`): xem trước số dòng → gõ `XOÁ`. App chỉ cho xoá khi mốc backup (dòng `nhat_ky_he_thong` hành động `backup` mới nhất, do `backup-dinh-ky.yml` và bước backup của `deploy-prod.yml` ghi qua RPC `ghi_moc_backup` bằng `SUPABASE_SERVICE_ROLE_KEY`) trong 24 giờ. Bộ sẵn "dữ liệu thử" xoá NV-T*, E2E-TEST*, **E2E-SEED*** (0043), phòng thử `E2E_*` và phân công vào đó (0044), văn bản RLS-TEST / hội nghị 991–999, tài khoản `demo_*` và mọi thứ gắn với chúng (thay cho mục "Dọn dữ liệu thử trước go-live" ở trên; vẫn giữ `smoke_test`).

## Phân loại thay đổi trong CI/CD (từ 18/9/2026)

Một script dùng chung `.github/scripts/phan-loai.sh` (mẫu khai báo một chỗ) chạy ở job `phan-loai` của `ci.yml` (pull_request và push `main`) và `deploy-staging.yml` (push `main`). Kết luận `khong_anh_huong_app = true` chỉ khi đọc được **đủ** danh sách file (API `pulls/N/files` hoặc `compare/before...sha`, phân trang `per_page=100`, đối chiếu `changed_files`; compare chạm trần 300 file coi là không đủ), có ít nhất một file, và **mọi** file khớp `docs/**`, `*.md`, `.github/workflows/backup-dinh-ky.yml`, `.github/workflows/canh-bao.yml`. Không có ngoại lệ theo tên nhánh: PR release chỉ tài liệu cũng bỏ qua (job `kiem-tra` của `deploy-prod` đọc 4 check theo **tên** nên job rỗng cùng tên vẫn được chấp nhận — `v3.6.0`, `v3.6.1`).

| Loại thay đổi | PR (`ci.yml`) | Push `main` (`ci.yml` + `deploy-staging.yml`) |
|---|---|---|
| Chỉ `docs/**`, `*.md`, workflow backup-dinh-ky / canh-bao | gitleaks chạy; `Áp migration + lint schema`, `Build frontend + giới hạn 300 dòng`, `Kiểm thử RLS + e2e trên staging` = job rỗng cùng tên (xanh) | gitleaks chạy; hai job rỗng (không có e2e khi push main); **deploy-staging bỏ qua cả run** (không db push, không RLS, không dựng Pages) |
| Bất kỳ file khác (`frontend/**`, `supabase/**`, `tests/**`, `scripts/**`, `package*.json`, `ci.yml`, `deploy-*.yml`, chính script phân loại…) | chạy đủ 4 check | chạy đủ; deploy-staging: db push → RLS ‖ build → Pages |
| Không chắc (PR rỗng, API lỗi, lấy không đủ danh sách, push đầu tiên, `workflow_dispatch`) | chạy đủ | chạy đủ |

`ci.yml` có `concurrency` theo nhánh PR (`cancel-in-progress` cho pull_request: push mới huỷ lượt cũ đang chạy; push `main` mỗi sha một nhóm, không huỷ). `deploy-prod.yml` không đổi.

**Phát hành trước go-live — không cần backup tay**: `deploy-prod.yml` đã `pg_dump` (mã hoá, artifact 90 ngày) ngay trước `db push` production và ghi mốc backup; *Backup định kỳ production* vẫn giữ lịch 3 ngày/lần; bản local (`scripts/backup-db.sh`) chỉ chạy khi muốn có bản ngoài GitHub, không phải bước bắt buộc của quy trình tag.
