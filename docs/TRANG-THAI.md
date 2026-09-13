# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ2 (Supabase Auth) — PR-A hoàn thành, đã QA trên staging, chưa phát hành production.** GĐ1 đã xong trên cả staging và production.

## Nhánh & PR đang mở
- PR-A `feature/gd2-supabase-auth` — migration 0004, script tạo auth user, config Auth, `index.html` đăng nhập mới, kế hoạch phát hành. Chờ duyệt; **merge = ngày chuyển đổi production** (xem `docs/KE-HOACH-PHAT-HANH-GD2.md`, làm đủ bước 1–6 trước khi merge).

## Đã xong
- GĐ1: migration 0001–0003 trên staging + production; `accounts.password` bị chặn; 5 tài khoản giả trong `seed.sql` trên staging.
- GĐ2 trên staging: 0004 + config Auth + 5 auth user (id trùng `accounts.id`); 3 vai trò đăng nhập mật khẩu tạm → bị bắt đổi → vào đúng view; signup bị chặn; mật khẩu ≥ 8 chữ+số; trigger tự xoá cờ; không còn `verify_login`/`sessionStorage` ở client.

## Đang dở
- PR-B (sau khi production ổn định 24h): migration 0005 xoá `password` + `verify_login`, sửa `seed.sql`.
- RLS theo vai trò thật (RLS-2…8) — GĐ3; FK `accounts.id → auth.users.id` và xoá `assigned_domain` gộp vào GĐ3.

## Chờ quyết định (tổng hợp sau GĐ2)
1. **Khoá tài khoản 5 lần/15 phút (AUTH-3)**: hook đã viết + test local, nhưng gói Free trả 402 khi bật. Chọn: lên gói Pro (bật `enabled = true` rồi `config push`) hay chấp nhận chỉ giới hạn IP (30 lần/5 phút) cho tới GĐ7?
2. **Ngày phát hành production**: chạy `docs/KE-HOACH-PHAT-HANH-GD2.md` khi nào, ai nhận file Excel mật khẩu tạm để phát cho 49 cán bộ?
3. Q2 (SPEC §10): ai duyệt PR lên production (tên GitHub)? Q3: gói Supabase (Free/Pro) — liên quan trực tiếp câu 1 và backup GĐ7.
4. Ghim phiên bản supabase-js CDN (`@2` đang trôi) ở GĐ4 hay ngay bây giờ?

## Lưu ý quy trình
`main` có ruleset (bắt buộc PR, CI xanh, chặn force-push); không có ngoại lệ docs-only. Production migration hiện chạy tay theo kế hoạch phát hành (CI/CD production là GĐ6).

## 3 lệnh để tiếp tục
```
Đọc docs/KE-HOACH-PHAT-HANH-GD2.md, chạy bước 1–6 rồi merge PR-A (ngày chuyển đổi).
```
```
Sau 24h ổn định: tạo nhánh feature/gd2-don-dep, migration 0005 + sửa seed.sql (PR-B).
```
```
cd scripts && node create-auth-users.mjs --project-ref frwyxcmbonjaimziiuqr --dry-run
```
