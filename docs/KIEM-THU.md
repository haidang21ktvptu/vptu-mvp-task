# Kiểm thử — công tắc môi trường

Job CI `Kiểm thử RLS + e2e trên staging` (`.github/workflows/ci.yml`) đọc biến kho `vars.KIEM_THU_MOI_TRUONG`:

| Giá trị | Project | Việc job làm |
|---|---|---|
| (trống) hoặc `staging` | `vojmrjezspdftovzinek` | e2e như trước (migration và RLS trên staging do `deploy-staging.yml` lo khi push `main`). |
| `production` | `frwyxcmbonjaimziiuqr` | `supabase db push` migration của nhánh → `scripts/seed-demo.mjs` (tài khoản demo, idempotent) → test RLS → e2e. |

Summary của job ghi dòng đầu "Môi trường kiểm thử: … (project …)". `deploy-staging.yml` và `deploy-prod.yml` không đổi.

## Secret / biến trên GitHub

- Biến kho `KIEM_THU_MOI_TRUONG` (Settings → Variables → Repository): tạo khi cần `production`; xoá hoặc đặt `staging` để quay về.
- Secret kho đã có và được dùng lại: `VITE_SUPABASE_ANON_KEY` (anon production), `SUPABASE_SERVICE_ROLE_KEY` (service_role production), `SUPABASE_ACCESS_TOKEN`.
- Secret kho cần có thêm ở cấp **kho** (job PR không dùng environment `production`): `PROD_DB_PASSWORD` (hiện chỉ có trong environment `production` của `deploy-prod.yml`).

## Khi nào đổi sang production

Chỉ khi cần kiểm thử trên dữ liệu thật trước go-live (ví dụ bộ mốc `kl-moc-2026-09-14` với 185 nhiệm vụ), trong khung giờ cán bộ không dùng hệ thống, và chủ dự án bật trong phiên đó. Bật biến = xác nhận áp migration của nhánh lên production (quy tắc 12 CLAUDE.md). Tắt ngay sau khi xong.

## Điều gì được ghi lên project khi test

- `scripts/seed-demo.mjs`: chỉ **thêm** auth user + dòng `accounts` còn thiếu cho 16 tài khoản `demo_*`, `demo_e2e_*`, `smoke_test` (cùng id với `supabase/seed.sql`, mật khẩu `123456`); tài khoản đã có, hoặc username đã tồn tại với id khác (tài khoản thật), thì bỏ qua. Phân công `phu_trach_phong` giả chỉ chèn khi phòng chưa có lãnh đạo thật phụ trách. Chạy tay: `KIEM_THU_MOI_TRUONG=production node scripts/seed-demo.mjs --project-ref frwyxcmbonjaimziiuqr` (CLI đã `supabase login`).
- Test RLS/e2e tự tạo và tự dọn: văn bản `RLS-TEST`, hội nghị 991–999, nhiệm vụ `NV-T*`, nhiệm vụ có nội dung bắt đầu bằng `E2E-TEST`, đề nghị từ chối, minh chứng, chỉ đạo trên các việc đó.
- Trên production, các file RLS gọi `canh_bao_quet` **tự bỏ qua** (`kl-0029`, `kl-0030`, `kl-0032`, `kl-0034`, `kl-0035`): hàm quét gửi cảnh báo tới mọi việc thật và phần dọn của chúng xoá tin hệ thống sau mốc t0. Vài test phạm vi PCVP (`rls-9/10/11`, `kl-pham-vi-tong-hop`) có thể đỏ nếu phòng thật đã có lãnh đạo phụ trách (seed không chèn phân công giả) — đọc log để phân biệt với lỗi mã.
- Không có gì chạm 185 nhiệm vụ thật hay tài khoản thật.

## Dọn dữ liệu thử trước go-live

1. Tắt biến `KIEM_THU_MOI_TRUONG` (hoặc đặt `staging`).
2. Xoá dữ liệu thử còn sót (bình thường test đã tự dọn): nhiệm vụ `ma LIKE 'NV-T%'` hoặc `noi_dung LIKE 'E2E-TEST%'`, văn bản `so_ket_luan LIKE 'E2E-TEST%'` hoặc `= 'RLS-TEST'`, văn bản `so_hoi_nghi` 991–999, tài khoản `kl0034_a0b` — chạy tay qua Dashboard/CLI với câu lệnh in số dòng trước khi xoá.
3. Tài khoản demo: xoá `demo_*`, `demo_e2e_*` bằng `node scripts/create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --rollback` **chỉ với các id `00000000-0000-4000-8000-0000000000NN`** (kiểm tra danh sách trước), rồi xoá dòng `accounts` tương ứng; giữ `smoke_test` nếu đang dùng cho smoke test sau phát hành.
4. Xoá phân công `phu_trach_phong` có `ly_do = 'seed kiểm thử'`.
5. Xác nhận lại bằng `kl-moc-2026-09-14` (đếm 185 dòng `nguon = excel` không đổi).
