-- GĐ2 — Bước 2/2: dọn dẹp sau khi toàn bộ tài khoản đã nạp vào Supabase Auth
-- (SPEC AUTH-4). Chỉ áp sau khi bản live đã kiểm tra đăng nhập 3 vai trò.
-- Từ đây quay lui phải khôi phục accounts từ backup (điểm không quay lui nhanh).

-- Hàm đăng nhập cũ (so khớp plaintext) không còn ai gọi.
DROP FUNCTION "public"."verify_login"("text", "text");

-- Cột mật khẩu plaintext: xoá hẳn. Quyền cột đã cấp (GRANT SELECT theo cột)
-- tự mất theo; accounts_public không tham chiếu cột này.
ALTER TABLE "public"."accounts" DROP COLUMN "password";
