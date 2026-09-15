# scripts/

Script vận hành chạy tay bằng Node ≥ 20.11 (`cd scripts && npm install` một lần).

## `create-auth-users.mjs` — chuyển tài khoản sang Supabase Auth (GĐ2)

Tạo `auth.users` cho mọi dòng `public.accounts`, **giữ nguyên id** (`auth.users.id = accounts.id`) và **giữ nguyên mật khẩu hiện có**: mật khẩu trong `accounts.password` được băm bcrypt tại máy chạy script rồi gửi lên dạng `password_hash` (không gửi plaintext qua API). Email quy ước `<username>@vptu.caobang.local`, `must_change_password = false`. Chạy lại an toàn (bỏ qua tài khoản đã có).

```
node create-auth-users.mjs --project-ref <ref> [--dry-run]
node create-auth-users.mjs --local --default-password 123456   # tài khoản giả (không còn cột password)
node create-auth-users.mjs --project-ref <ref> --rollback
```

- `service_role` key lấy tự động qua Supabase CLI đã `supabase login` (hoặc `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong môi trường). Không có file `.env` nào chứa key; không in mật khẩu/key ra console.
- `--rollback` xoá `auth.users` của mọi `accounts.id` (dùng khi quay lui, xem `docs/KE-HOACH-PHAT-HANH-GD2.md`).
- Script chỉ dùng cho lần chuyển đổi (cần cột `accounts.password`, cột này bị xoá ở migration 0006). Từ migration 0011 `accounts.id` là FK tới `auth.users.id` (ON DELETE RESTRICT) nên **tạo tài khoản mới phải theo thứ tự**: tạo auth user trước (Dashboard → Authentication hoặc Admin API, email `<username>@vptu.caobang.local`) → `INSERT accounts` cùng id. Xoá cán bộ: xoá dòng `accounts` trước rồi mới xoá auth user. Tài khoản giả local/staging do `supabase/seed.sql` tạo sẵn cả auth user, không cần chạy script `--local` nữa.

## `create-system-account.mjs` — tài khoản hệ thống `smoke_test` (GĐ6)

Tạo auth user + dòng `accounts` (`is_system = true`, A3, phòng CDS_CY, `must_change_password = false`) cho smoke test sau phát hành production (`deploy-prod.yml`, secret `SMOKE_USERNAME`/`SMOKE_PASSWORD`). Cần migration 0012.

```
node create-system-account.mjs --project-ref <ref>                 # sinh mật khẩu ngẫu nhiên, in ra một lần
node create-system-account.mjs --project-ref <ref> --password <pw> # đặt/đặt lại mật khẩu cho sẵn
node create-system-account.mjs --project-ref <ref> --rollback      # xoá accounts rồi auth user
```

Chạy lại an toàn (đã có thì chỉ đặt lại mật khẩu). Staging không cần chạy: `seed.sql` đã tạo sẵn (mật khẩu `123456`). Không ghi mật khẩu vào file nào.

## `nhap-kl-btvtu.mjs` — nhập dữ liệu Theo dõi Kết luận BTVTU (GĐ8 PR 8B)

Đọc file Excel gốc (**ngoài repo**, `D:TU 2026Projectptu-backup
guon-kl-btvtukl-btvtu-goc.xlsx`) hoặc bộ dữ liệu vàng `tests/rls/du-lieu-vang/kl-btvtu.json` → kiểm tra → ghi `kl_hoi_nghi` / `kl_nhiem_vu` / `kl_lich_su` bằng service_role. Mô-đun ở `scripts/kl/` (kết nối, đọc nguồn, kiểm tra/ánh xạ, ghi). Cần `exceljs` (`npm install` trong `scripts/`).

```
node nhap-kl-btvtu.mjs --file "<đường dẫn .xlsx>" --local                                   # DRY-RUN (mặc định): không ghi gì
node nhap-kl-btvtu.mjs --file ../tests/rls/du-lieu-vang/kl-btvtu.json --local --ghi [--xoa-cu]   # bộ vàng vào local
node nhap-kl-btvtu.mjs --file ../tests/rls/du-lieu-vang/kl-btvtu.json --project-ref vojmrjezspdftovzinek --ghi   # staging
node nhap-kl-btvtu.mjs --file "<xlsx>" --project-ref frwyxcmbonjaimziiuqr --production --ghi --anh-xa-nguoi-sua "<json>"
```

- **Dry-run là mặc định**; chỉ `--ghi` mới ghi. Dry-run in: bảng ánh xạ chủ trì (họ tên Excel → `accounts.full_name` khớp chính xác; "VPTU" → tài khoản A2 phòng `TONG_HOP` chức vụ "Trưởng phòng", ghi_chu "chuyển từ VPTU"), bảng đối chiếu số thô, **vi phạm dữ liệu** (thiếu cột, mã trùng, ngoài danh mục, ngày ban hành tương lai, hạn trước ngày ban hành, nhật ký lệch mã…) và **vi phạm ánh xạ** (tên/email không khớp — script dừng, không đoán), nhóm tự xử lý (dòng đang mở "Có hạn cụ thể" trống hạn → `ly_do_chua_co_han`; nhật ký không có mã → suy từ số dòng theo công thức của sheet; nhật ký không rõ người sửa → `nguoi_sua` NULL). Trạng thái **không** tính ở script — đối chiếu bằng test `kl-moc-2026-09-14` sau khi ghi.
- Từ chối ghi khi đích đã có dòng `nguon = 'excel'`; `--xoa-cu` (xoá dữ liệu Excel cũ rồi nhập lại) chỉ cho local/staging, **bị từ chối trên production**. Production bắt buộc `--production` và, theo CLAUDE.md rule 12, chỉ chạy sau khi chủ dự án xác nhận trong phiên và đã `backup-db.sh`. Lỗi giữa chừng → tự xoá hội nghị/nhiệm vụ vừa tạo trong lần chạy.
- Nhật ký cũ (sheet `NhatKyChinhSua`) vào `kl_lich_su` `nguon = 'excel'`: cột đổi sang tên cột DB, giá trị danh mục → mã, serial Excel → ngày, người sửa qua `--anh-xa-nguoi-sua` (file JSON `{"email": "username"}` ngoài repo; email chưa có → dừng). Mốc giờ trong sheet ghi hậu tố "Z" nhưng là giờ Việt Nam (trùng cột "Ngày cập nhật gần nhất" từng giây, phân bố 9h–18h) → ghi `+07:00`.
- Sau khi ghi: đếm lại, `setval` sequence mã (`supabase db query --file`), biên bản `scripts/out/bien-ban-nhap-kl-<đích>-<ngày>.md` (gitignored; không họ tên, không số việc theo người) — chép phần cần vào `docs/bien-ban-nhap-kl-btvtu.md` sau khi nhập production.

## `anh-xa-linh-vuc.mjs` — ánh xạ `linh_vuc_chi_tiet` cũ về danh mục `dm_linh_vuc` (GĐ9 PR 9B)

Ba bước, người duyệt là người quản trị sheet (phòng Tổng hợp); script **không đoán** — chỉ đề xuất khi giá trị bằng tên lĩnh vực (bỏ dấu, hoa/thường) và lĩnh vực thuộc đúng ngành của dòng.

```bash
node anh-xa-linh-vuc.mjs --project-ref frwyxcmbonjaimziiuqr --production           # 1. dry-run CHỈ ĐỌC → CSV duyệt ngoài repo
#   → D:/TU 2026/Project/vptu-backup/nguon-kl-btvtu/anh-xa-linh-vuc.csv (đã có file thì ghi thêm hậu tố ngày, không ghi đè)
#   2. Người duyệt điền cột linh_vuc_chot (tên hoặc mã lĩnh vực); để trống = giữ NULL. Excel theo vùng dấu phẩy mở CSV ";" bị gộp cột
#      → dùng .xlsx: thêm --out "<file>.xlsx" ở bước 1 (cùng bố cục) hoặc người duyệt tự tạo file có sheet "Đối chiếu lĩnh vực",
#      tiêu đề dòng 5, dữ liệu từ dòng 6, cột A giá trị gốc · B tên ngành ("8. Kinh tế tổng hợp - …") · C số dòng · D đề xuất · E CHỐT · F ghi chú.
node anh-xa-linh-vuc.mjs --project-ref frwyxcmbonjaimziiuqr --production --ghi --file "<csv hoặc xlsx đã duyệt>"   # 3. sau backup-db.sh + xác nhận trong phiên
node anh-xa-linh-vuc.mjs --local [--out <csv>]                                       # thử trên local (bộ vàng không có linh_vuc_chi_tiet)
```

- `--ghi` in báo cáo trước (từng cặp → lĩnh vực, số dòng sẽ điền, dòng đã có lĩnh vực khác bị bỏ qua) và sau (đếm theo lĩnh vực, còn NULL, số dòng `kl_lich_su`); chốt sai ngành hoặc không có trong danh mục → dừng, không ghi gì. Chỉ điền dòng đang NULL.
- Ghi bằng một khối SQL (`scripts/kl/anh-xa-linh-vuc.mjs` → `sqlCapNhat`): tắt tạm trigger `b_kl_nhiem_vu_truoc_ghi` để **không đổi `cap_nhat_luc`** của 82 dòng (giữ đúng chỉ số "không cập nhật 30 ngày"); `kl_lich_su` vẫn ghi từng dòng `cot = linh_vuc_ma` với `nguoi_sua_ghi_chu` của script. Biên bản: `scripts/out/bien-ban-anh-xa-linh-vuc-<đích>-<ngày>.md` (gitignored) → chép (không họ tên) vào `docs/bien-ban-nhap-kl-btvtu.md`.
- `--ghi --file *.xlsx` (`scripts/kl/doc-xlsx-linh-vuc.mjs`, exceljs): nhận diện theo đuôi file; cột B tên ngành hiển thị → mã ngành theo số đầu chuỗi ("8." → ngành 8) hoặc theo tên; không nhận diện được → vi phạm, dừng; sheet "DanhMuc" bỏ qua; phần còn lại (chốt theo tên/mã, đúng ngành, chỉ dòng NULL, không đổi `cap_nhat_luc`, đếm lại) y như CSV.
- Đích chưa có migration 0018 (production trước `v2.2.0`): dry-run vẫn chạy được bằng danh mục đọc từ Supabase local; `--ghi` thì bắt buộc đích đã có.

## `an-danh-kl-btvtu.mjs` — bộ dữ liệu vàng ẩn danh cho tests/

```
node an-danh-kl-btvtu.mjs --file "<đường dẫn .xlsx gốc>" --out ../tests/rls/du-lieu-vang/kl-btvtu.json
```

Giữ mã, hội nghị, số KL, ngày ban hành, loại hạn, hạn, tiến độ, ngành, cơ quan trình, ngày cập nhật; chủ trì → `full_name` của `demo_cv1`/`demo_cv2`/`demo_truongphong`/`demo_qtht` (xoay vòng theo tên đã sắp xếp; "VPTU" giữ nguyên để script nhập tự gán như dữ liệu thật); nội dung "Nhiệm vụ NV-xxx (ẩn)"; bỏ minh chứng, văn bản triển khai, lĩnh vực chi tiết, nhật ký. `tong_hop` của bản ẩn danh phải bằng file thật, khác → không ghi. File JSON một dòng/một nhiệm vụ (quy ước 300 dòng). Chạy lại khi file gốc đổi (`nguon_sha256` trong JSON).

## `check-line-limit.mjs` — quy ước không file nào trên 300 dòng

Chạy trong CI (`node scripts/check-line-limit.mjs`), quét file git theo dõi; ngoại lệ: `*.md`, lockfile, `supabase/config.toml`, `index.html` gốc (bản cũ), `mockup/`.

## Bật/tắt bắt buộc đổi mật khẩu (SPEC AUTH-2)

Hàm `public.admin_set_must_change_password(p_usernames text[] DEFAULT NULL, p_value boolean DEFAULT true)` — chỉ `service_role` gọi được:

```
supabase db query --linked "SELECT public.admin_set_must_change_password();"                    -- tất cả
supabase db query --linked "SELECT public.admin_set_must_change_password(ARRAY['levanmieu']);"  -- từng người
```

## `backup-db.sh` / `restore-db.sh` — sao lưu và khôi phục (GĐ7)

Bash thuần, chạy trong Git Bash (Windows) và GitHub Actions; hàm chung ở `lib-sao-luu.sh`. Hướng dẫn từng bước cho chủ dự án: `docs/sao-luu-khoi-phuc.md`.

```
bash scripts/backup-db.sh --project-ref <ref> [--nhan <nhãn>] [--thu-muc <thư mục>]   # → <tên>-<ngày giờ>-<nhãn>.tar.gz.gpg
bash scripts/restore-db.sh <file.tar.gz.gpg> --project-ref <ref đích> [--ghi-de] [--yes]
bash scripts/backup-db.sh --local  /  bash scripts/restore-db.sh <file> --local --ghi-de --yes  # thử trên `supabase start`
```

- Bí mật chỉ qua biến môi trường hoặc hỏi ẩn (`BACKUP_PASSPHRASE`, `RESTORE_DB_URL`), không bao giờ qua tham số; mật khẩu DB không cần vì CLI dùng login role qua token (`supabase login` / `SUPABASE_ACCESS_TOKEN`).
- `restore-db.sh` **từ chối trong code** production `frwyxcmbonjaimziiuqr` và staging `vojmrjezspdftovzinek`; schema áp bằng `supabase db push` từ `supabase/migrations` (không dùng `schema.sql` vì thiếu trigger trên `auth.users` và lịch sử migration); dữ liệu nạp trong một transaction với `session_replication_role = replica` rồi kiểm chứng FK `accounts → auth.users` và số dòng. Cần `psql` (`scoop install postgresql`).

## `tai-backup.sh` / `tai-backup.cmd` — tải artifact backup về máy (GĐ7 PR B)

```
bash scripts/tai-backup.sh [--thu-muc <thư mục>] [--giu N] [--repo owner/repo]   # mặc định ../vptu-backup
scripts\tai-backup.cmd                                                            # bản cho Task Scheduler, log vào ../vptu-backup/tai-backup.log
```

Tải mọi artifact `prod-*` chưa hết hạn (deploy-prod + backup định kỳ) chưa có ở thư mục đích, bỏ qua bản đã có; cần `gh auth login`. **Không xoá gì theo mặc định** — `--giu N` chỉ xoá khi người dùng ghi rõ. Đăng ký chạy mỗi lần đăng nhập Windows: `docs/sao-luu-khoi-phuc.md` mục 3.
