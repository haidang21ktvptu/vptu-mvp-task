# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
GĐ1 (Chặn rò rỉ khẩn cấp) đã xong về kỹ thuật trên cả staging và production. Chưa bắt đầu GĐ2 (Supabase Auth).

## Nhánh & PR đang mở
- PR #3 `docs/gd1-qa-staging` — chỉ CHANGELOG.md, chờ duyệt.
- PR #4 `fix/xoa-goi-y-mat-khau-dang-nhap` — xoá tài khoản mẫu/gợi ý mật khẩu ở màn đăng nhập, chờ duyệt.
- Nhánh `chore/gd1-seed-va-doc` (PR này) — seed.sql, CLAUDE.md, file này.

## Đã xong
- Migration 0001-0003 áp trên cả staging (`vojmrjezspdftovzinek`) và **production** (`frwyxcmbonjaimziiuqr`, vá khẩn cấp sau khi PR #2 merge).
- RLS bật 5 bảng; `accounts.password` bị chặn ở tầng quyền cột; `accounts_public` + `verify_login()` thay thế truy vấn cũ.
- Staging: 48 tài khoản thật đã xoá, thay bằng 5 tài khoản giả trong `supabase/seed.sql`.

## Đang dở
- RLS theo vai trò thật (RLS-2…8) — GĐ3.
- `verify_login` chưa chống brute-force — chờ Supabase Auth (GĐ2).

## Chờ quyết định (SPEC mục 10)
- Q1: Dữ liệu nhiệm vụ thật trên production giữ hay xoá sạch khi lên GĐ2?
- Q2: Ai duyệt PR lên production (tên GitHub)?
- Q3: Gói Supabase đang dùng (Free/Pro) — quyết định cách backup GĐ7.

## 3 lệnh để tiếp tục
```
Đọc docs/SPEC.md mục 10, trả lời Q1-Q3 trước khi vào GĐ2.
```
```
Pull main mới nhất rồi làm Giai đoạn 2 theo docs/PROMPTS.md.
```
```
supabase migration list --project-ref frwyxcmbonjaimziiuqr
```
