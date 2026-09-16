-- 0031 — GĐ18 (PR 18A): bỏ luồng "tasks" v2 và các bí danh kl_* của frontend cũ (LO-TRINH GĐ18, sau một phát hành giữ: v3.0.0
-- → v3.2.0 không còn đường gọi nào tới các đối tượng này — grep frontend/scripts/tests trước khi viết).
--
-- DESTRUCTIVE, KHÔNG QUAY LUI BẰNG MIGRATION — khôi phục từ backup (pg_dump trước `db push` trong deploy-prod.yml, hoặc bản
-- backup tay theo docs/sao-luu-khoi-phuc.md). Chủ dự án xác nhận 16/9/2026: dữ liệu bảng tasks v2 trên production không cần giữ.
-- accounts.manager_id giữ làm thông tin (không còn là nguồn phân quyền, RA-SOAT 1.1).

-- 1. Bảng luồng cũ trước (policy tasks_*/directives_*/evidences_* và trigger tasks_guard_a3 rơi theo bảng; FK task_directives/
--    task_evidences → tasks ON DELETE CASCADE), rồi view và hàm (0001, 0007, 0009) — hàm phải drop SAU policy phụ thuộc nó.
DROP VIEW IF EXISTS "public"."view_exception_dashboard";
DROP TABLE IF EXISTS "public"."task_directives";
DROP TABLE IF EXISTS "public"."task_evidences";
DROP TABLE IF EXISTS "public"."tasks";
DROP FUNCTION IF EXISTS "public"."tasks_guard_a3"();
DROP FUNCTION IF EXISTS "public"."assign_task"(jsonb);
DROP FUNCTION IF EXISTS "public"."approve_task"(uuid);
DROP FUNCTION IF EXISTS "public"."submit_evidence"(uuid, text, text);
DROP FUNCTION IF EXISTS "public"."warn_task"(uuid);
DROP FUNCTION IF EXISTS "public"."mark_directives_read"(uuid);
DROP FUNCTION IF EXISTS "public"."is_task_party"(uuid);
DROP FUNCTION IF EXISTS "public"."can_see_task"(uuid);
DROP FUNCTION IF EXISTS "public"."can_assign_to"(uuid);
DROP FUNCTION IF EXISTS "public"."task_in_scope"(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS "public"."in_my_block"(uuid);

-- 2. Bí danh 0024 cho frontend cũ (view tên cột cũ) và wrapper trạng thái 7 trường (0015/0024): không còn ai gọi — frontend đọc
--    v_nhiem_vu + trang_thai(); scripts/tests dùng tinh_trang_thai().
DROP VIEW IF EXISTS "public"."kl_nhiem_vu";
DROP VIEW IF EXISTS "public"."kl_hoi_nghi";
DROP VIEW IF EXISTS "public"."kl_lich_su";
DROP VIEW IF EXISTS "public"."kl_chi_dao";
DROP VIEW IF EXISTS "public"."kl_dinh_chinh";
DROP VIEW IF EXISTS "public"."dm_co_quan_trinh";
DROP VIEW IF EXISTS "public"."v_kl_dashboard";   -- dashboard 0016/0019 trên kl_trang_thai; frontend đọc v_nhiem_vu từ 0024
DROP FUNCTION IF EXISTS "public"."kl_tinh_trang_thai"(uuid, date);
DROP FUNCTION IF EXISTS "public"."kl_trang_thai"("public"."nhiem_vu", date);
DROP TYPE IF EXISTS "public"."kl_trang_thai_kq";
