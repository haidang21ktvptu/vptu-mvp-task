-- GĐ1 — Sửa default chết của tasks.status cho khớp constraint thực tế
-- (SPEC mục 5, TASK-4). Default cũ 'IN_PROGRESS' không nằm trong
-- tasks_status_check nên chưa từng dùng được — nếu có INSERT nào quên set
-- status tường minh sẽ tạo ra giá trị rác không khớp switch-case nào của UI.
ALTER TABLE "public"."tasks" ALTER COLUMN "status" SET DEFAULT 'CHUA_GIAO';
