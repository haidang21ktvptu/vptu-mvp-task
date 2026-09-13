# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ3 (RLS đầy đủ) — code xong, staging QA đạt, production đã áp 0007–0010; chờ merge PR #11 và kiểm tra bản live.** GĐ1, GĐ2 đã xong.

## Nhánh & PR đang mở
- PR #11 `feature/gd3-rls`: migration 0007–0010, 6 hàm RLS-8, `index.html` gọi RPC, `tests/rls` (48 test). Production đã áp migration (có xác nhận trong phiên) → chủ dự án merge → kiểm tra 3 vai trò trên live → ghi CHANGELOG.

## Đã xong
- GĐ1: RLS tạm + chặn `accounts.password`. GĐ2: Supabase Auth (0004–0006), giữ mật khẩu hiện có, công tắc `admin_set_must_change_password()`.
- GĐ3: policy theo vai trò (ma trận SPEC §3.2), `is_chief` (CVP), khối PCVP 2 cấp qua `manager_id`, RLS-5 mở cho A2 cả phòng (0010), 6 hàm `security definer`, 48 test token thật pass local + staging, QA giao diện A3/A2/PCVP/CVP đúng phạm vi.

## Đang dở
- GĐ3: sau khi PR #11 merge → kiểm tra live 3 vai trò, ghi CHANGELOG.
- GĐ4 (tách frontend Vite): kèm FK `accounts.id → auth.users.id` ON DELETE RESTRICT + seed tạo auth user; ghim phiên bản supabase-js; bỏ `alert()`.
- GĐ6: đưa `tests/rls` vào CI với secret staging. GĐ7: lên Pro, bật hook khoá tài khoản (AUTH-3).

## Theo dõi tuần đầu sau phát hành
- Giới hạn IP 30 lượt/5 phút (gói Free) — cơ quan chung IP; xem Supabase Dashboard → Auth → Logs `over_request_rate_limit`; nếu xảy ra: nâng `sign_in_sign_ups` hoặc lên Pro sớm.

## Chờ quyết định
- Không còn câu hỏi mở của GĐ3.

## Lưu ý quy trình
`main` có ruleset (PR bắt buộc, CI xanh, chặn force-push), không ngoại lệ. Production: luôn backup pg_dump, trình `config diff` trước khi push, và **mỗi lần áp migration production cần xác nhận của chủ dự án trong phiên (CLAUDE.md rule 12)**; CI/CD production là GĐ6. Backup mới nhất: `vptu-backup/prod-20260913-1936-gd3-*` (ngoài git).

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
