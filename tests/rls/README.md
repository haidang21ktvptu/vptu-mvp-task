# tests/rls — kiểm thử RLS bằng token thật (SPEC RLS-2…8)

Mỗi dòng RLS-2…7 có ít nhất một test "được phép" và một test "bị chặn"; RLS-8 test từng hàm `security definer`; `anon` bị chặn mọi nơi. Chạy trên **staging** với 6 tài khoản seed (`supabase/seed.sql`, mật khẩu `123456`), dữ liệu mẫu `RLS-TEST` do service_role tạo và tự dọn.

```
cd tests/rls && npm install
npm test                 # staging (RLS_PROJECT_REF mặc định vojmrjezspdftovzinek)
RLS_LOCAL=1 npm test     # Supabase local (sau `supabase db reset`; seed.sql đã tạo sẵn auth user)
```

- Key lấy theo thứ tự: biến môi trường `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (CI dùng secret **staging**) → `RLS_LOCAL=1` → Supabase CLI đã `supabase login`. Không có `.env` chứa service_role; từ chối chạy nếu URL là project production.
- Chạy chung tiến trình (`--test-isolation=none`) để 6 phiên đăng nhập dùng lại giữa các file (giới hạn 30 lượt/5 phút/IP).
- Chạy trong CI ở job `Kiểm thử RLS + e2e trên staging` (`ci.yml`, mọi PR), trước `tests/e2e` trong cùng job (6 + 7 = 13 lượt đăng nhập) — xem `docs/kien-truc.md`.
