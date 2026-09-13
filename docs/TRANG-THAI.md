# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ2 (Supabase Auth) hoàn thành** trên cả staging và production (0001–0006 đã áp, bản live đăng nhập 3 vai trò bằng mật khẩu hiện có). Sẵn sàng GĐ3 (RLS đầy đủ) — chủ dự án yêu cầu làm GĐ3 bằng Plan mode.

## Nhánh & PR đang mở
Không có (PR #7, #8, #9 đều đã merge).

## Đã xong
- Quyết định: giữ nguyên mật khẩu hiện có (nạp Auth dạng bcrypt), cờ `must_change_password = false`; quản trị bật sau bằng `admin_set_must_change_password()` (SPEC AUTH-2). Q1 xoá dữ liệu nhiệm vụ khi lên v2; Q2 `haidang21ktvptu`; Q3 Free → Pro ở GĐ7.
- Staging + production: 0004–0006, config Auth, auth user trùng id (5 giả / 48 thật), cột `password` và `verify_login` đã xoá; bật cờ → modal bắt buộc đổi hoạt động; trigger tự tắt cờ.

## Đang dở
- Không còn việc dở của GĐ2. Backup pg_dump 2026-09-13 (còn cột `password`) tại thư mục `vptu-backup` cạnh repo, ngoài git — giữ ≥ 7 ngày.
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
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/PROMPTS.md "Giai đoạn 3" rồi làm GĐ3 bằng Plan mode.
```
```
supabase db query --linked "SELECT public.admin_set_must_change_password();"   # khi muốn bắt buộc đổi mật khẩu
```
```
supabase migration list --project-ref frwyxcmbonjaimziiuqr
```
