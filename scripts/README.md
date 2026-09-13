# scripts/

Script vận hành chạy tay bằng Node ≥ 20.11 (`cd scripts && npm install` một lần).

## `create-auth-users.mjs` — tạo tài khoản Supabase Auth (GĐ2)

Tạo `auth.users` cho mọi dòng `public.accounts`, **giữ nguyên id** (`auth.users.id = accounts.id`), email quy ước `<username>@vptu.caobang.local`, mật khẩu tạm ngẫu nhiên 12 ký tự, `must_change_password = true`. Chạy lại an toàn (bỏ qua tài khoản đã có).

```
node create-auth-users.mjs --project-ref <ref> [--dry-run] [--out <file.xlsx>]
node create-auth-users.mjs --local
node create-auth-users.mjs --project-ref <ref> --rollback
```

- `service_role` key lấy tự động qua Supabase CLI đã `supabase login` (hoặc `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong môi trường). Không có file `.env` nào chứa key.
- Mật khẩu tạm chỉ ghi vào `scripts/out/mat-khau-tam-<env>-<thời điểm>.xlsx` (đã gitignore), không in ra console. Bàn giao file này qua kênh nội bộ rồi xoá.
- `--rollback` xoá `auth.users` của mọi `accounts.id` (dùng khi quay lui trong 24h, xem `docs/KE-HOACH-PHAT-HANH-GD2.md`).

## Sẽ thêm ở Giai đoạn 7

`backup-db.sh`, `restore-db.sh` — sau khi chốt cách backup phù hợp gói Supabase (SPEC mục 10, Q3).
