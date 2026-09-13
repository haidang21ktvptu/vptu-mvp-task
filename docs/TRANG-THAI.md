# TRẠNG THÁI DỰ ÁN (cập nhật: 2026-09-13)

## Giai đoạn hiện tại
**GĐ1 (Chặn rò rỉ khẩn cấp) đã hoàn thành** trên cả staging và production. Chưa bắt đầu GĐ2 (Supabase Auth).

## Nhánh & PR đang mở
Không có PR nào đang mở. PR #2–#5 đều đã merge vào `main` (xem lưu ý PR #2 bên dưới).

## Đã xong
- Migration 0001-0003 áp trên cả staging (`vojmrjezspdftovzinek`) và **production** (`frwyxcmbonjaimziiuqr`, vá khẩn cấp ngoài CI ngay sau khi PR #2 merge).
- RLS bật 5 bảng; `accounts.password` bị chặn ở tầng quyền cột (không chỉ ẩn bằng view); `accounts_public` + `verify_login()` thay thế truy vấn cũ, đã QA thật với 3 vai trò.
- Staging: 48 tài khoản thật đã xoá, thay bằng 5 tài khoản giả trong `supabase/seed.sql` (rule 11, CLAUDE.md).
- Rule 10 (CLAUDE.md): cập nhật file này cuối phiên/khi context gần đầy.

## Đang dở
- RLS theo vai trò thật (RLS-2…8) — GĐ3.
- `verify_login` chưa chống brute-force — chờ Supabase Auth (GĐ2).

## Chờ quyết định (SPEC mục 10)
- Q1: Dữ liệu nhiệm vụ thật trên production giữ hay xoá sạch khi lên GĐ2?
- Q2: Ai duyệt PR lên production (tên GitHub)?
- Q3: Gói Supabase đang dùng (Free/Pro) — quyết định cách backup GĐ7.

## Lưu ý quy trình (đã ghi chi tiết ở CHANGELOG mục 8)
PR #2 bị đóng (`closed`) trên GitHub chứ không phải `merged` — merge-commit bị đẩy thẳng lên `main` ngoài cổng PR. Sau đó có 2 lần commit thẳng lên `main` cho thay đổi docs-only (CLAUDE.md, file này) — nay coi là sai quy trình, không phải ngoại lệ hợp lệ. Đã bật ruleset GitHub trên `main` (bắt buộc PR, CI xanh, chặn force-push) để việc này không thể tái diễn nữa, kể cả cho thay đổi chỉ sửa tài liệu.

## 3 lệnh để tiếp tục
```
Đọc docs/SPEC.md mục 10, trả lời Q1-Q3 trước khi vào GĐ2.
```
```
Pull main mới nhất rồi làm Giai đoạn 2 theo docs/PROMPTS.md.
```
```
supabase db lint --project-ref frwyxcmbonjaimziiuqr
```
