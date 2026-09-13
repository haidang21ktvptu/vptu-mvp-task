# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ2 (Supabase Auth) — PR-A xong và QA đạt trên staging; đang phát hành production** theo `docs/KE-HOACH-PHAT-HANH-GD2.md`. GĐ1 đã xong.

## Nhánh & PR đang mở
- PR #7 `feature/gd2-supabase-auth` (PR-A): migration 0004–0005, script nạp Auth, config, `index.html`, kế hoạch phát hành. Bước 1–6 kế hoạch do Claude Code chạy; **bước 7 (merge) chủ dự án bấm** sau khi bước 1–6 báo xong.
- Sắp mở: PR-B `feature/gd2-don-dep` — migration 0006 xoá `accounts.password` + `verify_login`, sửa `seed.sql` (ngay sau khi bản live kiểm tra xong).

## Đã xong
- Quyết định: giữ nguyên mật khẩu hiện có (nạp Auth dạng bcrypt), cờ `must_change_password = false`; quản trị bật sau bằng `admin_set_must_change_password()` (SPEC AUTH-2). Q1 xoá dữ liệu nhiệm vụ khi lên v2; Q2 `haidang21ktvptu`; Q3 Free → Pro ở GĐ7.
- Staging: 0004–0005 + config + 5 auth user; 3 vai trò đăng nhập như cũ; bật cờ → modal bắt buộc đổi hoạt động; trigger tự tắt cờ.

## Đang dở
- Production: bước 1–6 kế hoạch phát hành (backup, migration, config, nạp 49 tài khoản), rồi merge, kiểm tra live 3 vai trò, PR-B.
- GĐ3: RLS theo vai trò thật (RLS-2…8), FK `accounts.id → auth.users.id`, xoá `assigned_domain`, `DROP` các policy `_tam_thoi_`.

## Theo dõi tuần đầu sau phát hành
- Giới hạn IP 30 lượt/5 phút (gói Free) — cơ quan chung IP, có thể chặn oan giờ cao điểm (giao diện báo "chờ 5 phút"). Xem Supabase Dashboard → Auth → Logs `over_request_rate_limit`; nếu xảy ra: nâng `sign_in_sign_ups` hoặc lên Pro sớm.
- Hook khoá theo tài khoản (AUTH-3) đã có trong DB, bật ở GĐ7 khi lên Pro.

## Chờ quyết định
- Ghim phiên bản supabase-js CDN (`@2` đang trôi) — làm ở GĐ4 khi tách frontend?

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production migration/config chạy tay theo kế hoạch phát hành, luôn backup và trình `config diff` trước (CI/CD production là GĐ6).

## 3 lệnh để tiếp tục
```
Đọc docs/KE-HOACH-PHAT-HANH-GD2.md; kiểm tra bước nào đã xong trong CHANGELOG mục 9 rồi làm tiếp.
```
```
Sau khi live OK: nhánh feature/gd2-don-dep, migration 0006 + seed.sql (PR-B).
```
```
supabase migration list --project-ref frwyxcmbonjaimziiuqr
```
