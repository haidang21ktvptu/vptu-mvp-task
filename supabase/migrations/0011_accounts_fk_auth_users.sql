-- GĐ4 — Liên kết cứng accounts.id → auth.users.id (SPEC AUTH-4, quyết định GĐ3 2026-09-13).
-- Từ GĐ2, auth.users được tạo TRÙNG id với accounts nhưng chưa có ràng buộc; nay thêm FK để
-- không thể có dòng accounts "mồ côi" (không đăng nhập được) hoặc tạo nhầm id.
--
-- ON DELETE RESTRICT (không CASCADE): xoá một auth user trên Dashboard sẽ bị chặn khi còn
-- dòng accounts tương ứng — cán bộ chỉ được xoá có chủ đích: xoá accounts (service_role) trước,
-- rồi mới xoá auth user. Tránh mất hồ sơ cán bộ vì một thao tác nhầm trên Authentication.
--
-- Điều kiện áp: mọi accounts.id đã có auth.users.id (staging 6/6, production 48/48 — kiểm tra
-- 2026-09-13). Thứ tự tạo tài khoản mới từ đây: auth user (Dashboard/Admin API, tự chọn id)
-- → INSERT accounts cùng id. supabase/seed.sql đã theo thứ tự này.

ALTER TABLE "public"."accounts"
  ADD CONSTRAINT "accounts_id_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;
