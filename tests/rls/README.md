# tests/rls — kiểm thử RLS bằng token thật (SPEC RLS-2…8)

Mỗi dòng RLS-2…7 có ít nhất một test "được phép" và một test "bị chặn"; RLS-8 test từng hàm `security definer`; `anon` bị chặn mọi nơi. GĐ8: `rls-9-quan-tri` (cờ đặc quyền, phụ trách phòng), `rls-10-kl` (phạm vi module KL theo quyết định 7, gồm PCVP đổi phòng giữa chừng), `kl-trang-thai` (8 case biên của hàm trạng thái + ràng buộc/trigger, ngày cố định), `kl-moc-2026-09-14` (mốc 185 dòng, tự bỏ qua khi chưa nhập dữ liệu thật). Dữ liệu KL mẫu: `fixtures-kl.mjs` (hội nghị 999). Chạy trên **staging** với 7 tài khoản seed (`supabase/seed.sql`, mật khẩu `123456`), dữ liệu mẫu `RLS-TEST` do service_role tạo và tự dọn.

```
cd tests/rls && npm install
npm test                 # staging (RLS_PROJECT_REF mặc định vojmrjezspdftovzinek)
RLS_LOCAL=1 npm test     # Supabase local (sau `supabase db reset`; seed.sql đã tạo sẵn auth user)
```

- Key lấy theo thứ tự: biến môi trường `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (CI dùng secret **staging**) → `RLS_LOCAL=1` → Supabase CLI đã `supabase login`. Không có `.env` chứa service_role; từ chối chạy nếu URL là project production.
- Chạy chung tiến trình (`--test-isolation=none`) để 7 phiên đăng nhập dùng lại giữa các file (giới hạn 30 lượt/5 phút/IP).
- Chạy trong CI ở job `Kiểm thử RLS + e2e trên staging` (`ci.yml`, mọi PR), trước `tests/e2e` trong cùng job (7 + 8 = 15 lượt đăng nhập) — xem `docs/kien-truc.md`.
