-- GĐ2 — Công tắc quản trị bắt buộc đổi mật khẩu (SPEC AUTH-2).
-- Chuyển đổi sang Supabase Auth GIỮ NGUYÊN mật khẩu hiện có và để cờ
-- must_change_password = false cho tất cả; chủ dự án bật cờ sau bằng hàm này
-- (hàng loạt: không truyền tham số; từng người: truyền mảng username).
-- Chỉ service_role (SQL Editor / `supabase db query --linked`) gọi được —
-- anon/authenticated bị REVOKE tường minh vì baseline có DEFAULT PRIVILEGES
-- GRANT ALL ON FUNCTIONS.
--
--   SELECT public.admin_set_must_change_password();                       -- tất cả = true
--   SELECT public.admin_set_must_change_password(ARRAY['levanmieu']);     -- 1 người = true
--   SELECT public.admin_set_must_change_password(NULL, false);            -- tắt cho tất cả

CREATE FUNCTION "public"."admin_set_must_change_password"(
  "p_usernames" "text"[] DEFAULT NULL,
  "p_value" boolean DEFAULT true
)
RETURNS integer
LANGUAGE "sql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
  WITH "updated" AS (
    UPDATE "public"."accounts"
    SET "must_change_password" = "p_value"
    WHERE "p_usernames" IS NULL OR "username" = ANY ("p_usernames")
    RETURNING 1
  )
  SELECT count(*)::integer FROM "updated";
$$;

REVOKE ALL ON FUNCTION "public"."admin_set_must_change_password"("text"[], boolean) FROM "public", "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."admin_set_must_change_password"("text"[], boolean) TO "service_role";
