# scripts/

Script vận hành chạy tay bằng Node ≥ 20.11 (`cd scripts && npm install` một lần).

## `create-auth-users.mjs` — chuyển tài khoản sang Supabase Auth (GĐ2)

Tạo `auth.users` cho mọi dòng `public.accounts`, **giữ nguyên id** (`auth.users.id = accounts.id`) và **giữ nguyên mật khẩu hiện có**: mật khẩu trong `accounts.password` được băm bcrypt tại máy chạy script rồi gửi lên dạng `password_hash` (không gửi plaintext qua API). Email quy ước `<username>@vptu.caobang.local`, `must_change_password = false`. Chạy lại an toàn (bỏ qua tài khoản đã có).

```
node create-auth-users.mjs --project-ref <ref> [--dry-run]
node create-auth-users.mjs --local
node create-auth-users.mjs --project-ref <ref> --rollback
```

- `service_role` key lấy tự động qua Supabase CLI đã `supabase login` (hoặc `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong môi trường). Không có file `.env` nào chứa key; không in mật khẩu/key ra console.
- `--rollback` xoá `auth.users` của mọi `accounts.id` (dùng khi quay lui, xem `docs/KE-HOACH-PHAT-HANH-GD2.md`).
- Script chỉ dùng cho lần chuyển đổi (cần cột `accounts.password`, cột này bị xoá ở migration 0006). Tài khoản mới sau này tạo qua Supabase Dashboard → Authentication (chọn id trùng `accounts.id`) hoặc Admin API.

## Bật/tắt bắt buộc đổi mật khẩu (SPEC AUTH-2)

Hàm `public.admin_set_must_change_password(p_usernames text[] DEFAULT NULL, p_value boolean DEFAULT true)` — chỉ `service_role` gọi được:

```
supabase db query --linked "SELECT public.admin_set_must_change_password();"                    -- tất cả
supabase db query --linked "SELECT public.admin_set_must_change_password(ARRAY['levanmieu']);"  -- từng người
```

## Sẽ thêm ở Giai đoạn 7

`backup-db.sh`, `restore-db.sh` — sau khi chốt cách backup phù hợp gói Supabase (SPEC mục 10, Q3).
