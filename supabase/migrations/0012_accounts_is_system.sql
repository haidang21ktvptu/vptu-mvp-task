-- GĐ6 — Tài khoản hệ thống (smoke test sau phát hành production, SPEC NF-2/GĐ6).
-- Cột accounts.is_system đánh dấu tài khoản không phải cán bộ thật (ví dụ `smoke_test`):
-- frontend ẩn khỏi danh bạ, cây phân cấp, KPI và mọi danh sách cán bộ (lọc ngay khi nạp
-- accounts_public). RLS KHÔNG đổi: tài khoản hệ thống vẫn là một A3 bình thường về quyền.
-- Cấp quyền cột tường minh theo quy ước SPEC §5 (accounts chỉ GRANT theo cột).
ALTER TABLE "public"."accounts" ADD COLUMN "is_system" boolean NOT NULL DEFAULT false;
GRANT SELECT ("is_system") ON "public"."accounts" TO "authenticated";

-- Thêm cột vào cuối view (CREATE OR REPLACE chỉ cho phép nối thêm cột ở cuối).
CREATE OR REPLACE VIEW "public"."accounts_public"
WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title",
       "created_at", "manager_id", "department", "must_change_password", "is_chief", "is_system"
FROM "public"."accounts";
