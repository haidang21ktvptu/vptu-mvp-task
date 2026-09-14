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

## `check-line-limit.mjs` — quy ước không file nào trên 300 dòng

Chạy trong CI (`node scripts/check-line-limit.mjs`), quét file git theo dõi; ngoại lệ: `*.md`, lockfile, `supabase/config.toml`, `index.html` gốc (bản cũ), `mockup/`.

## Bật/tắt bắt buộc đổi mật khẩu (SPEC AUTH-2)

Hàm `public.admin_set_must_change_password(p_usernames text[] DEFAULT NULL, p_value boolean DEFAULT true)` — chỉ `service_role` gọi được:

```
supabase db query --linked "SELECT public.admin_set_must_change_password();"                    -- tất cả
supabase db query --linked "SELECT public.admin_set_must_change_password(ARRAY['levanmieu']);"  -- từng người
```

## Sẽ thêm ở Giai đoạn 7

`backup-db.sh`, `restore-db.sh` — sau khi chốt cách backup phù hợp gói Supabase (SPEC mục 10, Q3).
