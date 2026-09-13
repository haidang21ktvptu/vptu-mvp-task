# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ3 (RLS đầy đủ) — code xong, staging QA đạt, production đã áp 0007–0010; chờ merge PR #11 và kiểm tra bản live.** GĐ1, GĐ2 đã xong.

## Nhánh & PR đang mở
- PR #11 `feature/gd3-rls`: migration 0007–0010, 6 hàm RLS-8, index.html gọi RPC, tests/rls (48 test). Production đã áp migration (có xác nhận trong phiên), chờ chủ dự án merge → kiểm tra 3 vai trò trên live → ghi CHANGELOG.

## Đã xong
- Quyết định: giữ nguyên mật khẩu hiện có (nạp Auth dạng bcrypt), cờ `must_change_password = false`; quản trị bật sau bằng `admin_set_must_change_password()` (SPEC AUTH-2). Q1 xoá dữ liệu nhiệm vụ khi lên v2; Q2 `haidang21ktvptu`; Q3 Free → Pro ở GĐ7.
- Staging + production: 0004–0006, config Auth, auth user trùng id (5 giả / 48 thật), cột `password` và `verify_login` đã xoá; bật cờ → modal bắt buộc đổi hoạt động; trigger tự tắt cờ.

## Đang dở
- GĐ3: sau khi PR #11 merge → kiểm tra live 3 vai trò, ghi CHANGELOG.
- GĐ4 (tách frontend Vite): kèm FK  ON DELETE RESTRICT + seed tạo auth user; ghim phiên bản supabase-js; bỏ .
- GĐ6: đưa  vào CI với secret staging.

## Theo dõi tuần đầu sau phát hành
- Giới hạn IP 30 lượt/5 phút (gói Free) — cơ quan chung IP, có thể chặn oan giờ cao điểm (giao diện báo "chờ 5 phút"). Xem Supabase Dashboard → Auth → Logs `over_request_rate_limit`; nếu xảy ra: nâng `sign_in_sign_ups` hoặc lên Pro sớm.
- Hook khoá theo tài khoản (AUTH-3) đã có trong DB, bật ở GĐ7 khi lên Pro.

## Chờ quyết định
- Không còn câu hỏi mở của GĐ3.

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production migration/config chạy tay theo kế hoạch phát hành, luôn backup và trình `config diff` trước (CI/CD production là GĐ6).

## 3 lệnh để tiếp tục
```
Sau khi PR #11 merge: kiểm tra 3 vai trò trên https://haidang21ktvptu.github.io/vptu-mvp-task/ rồi ghi CHANGELOG.
```
```
cd tests/rls && npm test    # 48 test RLS trên staging
```
```
Đọc CLAUDE.md, docs/TRANG-THAI.md, docs/PROMPTS.md "Giai đoạn 4" rồi làm GĐ4 bằng Plan mode.
```
