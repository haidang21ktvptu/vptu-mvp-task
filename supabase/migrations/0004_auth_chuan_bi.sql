-- GĐ2 — Bước 1/2: chuẩn bị cho Supabase Auth (SPEC AUTH-1…5, §5)
-- Migration này CHỈ THÊM (cột, view, trigger, hook), không xoá gì — app cũ
-- (verify_login + cột password) vẫn chạy bình thường sau khi áp, để có cửa sổ
-- quay lui 24h. Bước 2 (xoá cột password, verify_login) ở migration 0005.
--
-- Liên kết tài khoản: auth.users.id được tạo TRÙNG accounts.id (script
-- scripts/create-auth-users.mjs truyền id khi gọi Admin API), nên không đổi
-- id, không sửa FK nào.

-- 1. Cờ bắt buộc đổi mật khẩu lần đầu (AUTH-2). Cột mới trên accounts phải
--    GRANT tường minh theo quy ước SPEC §5 (không GRANT theo bảng).
ALTER TABLE "public"."accounts"
  ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT true;

GRANT SELECT ("must_change_password") ON "public"."accounts" TO "anon", "authenticated";

-- 2. accounts_public thêm cột ở cuối (CREATE OR REPLACE chỉ cho phép thêm cuối).
--    verify_login (RETURNS SETOF accounts_public) tạo lại y hệt để chắc chắn
--    kiểu trả về khớp view mới; app cũ vẫn gọi được cho tới migration 0005.
DROP FUNCTION "public"."verify_login"("text", "text");

CREATE OR REPLACE VIEW "public"."accounts_public"
WITH ("security_invoker" = true) AS
SELECT
  "id",
  "username",
  "full_name",
  "role_group",
  "position_title",
  "assigned_domain",
  "created_at",
  "manager_id",
  "department",
  "must_change_password"
FROM "public"."accounts";

CREATE FUNCTION "public"."verify_login"("p_username" "text", "p_password" "text")
RETURNS SETOF "public"."accounts_public"
LANGUAGE "sql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
  SELECT * FROM "public"."accounts_public"
  WHERE "id" = (
    SELECT "id" FROM "public"."accounts"
    WHERE "username" = "p_username" AND "password" = "p_password"
  );
$$;

REVOKE ALL ON FUNCTION "public"."verify_login"("text", "text") FROM "public";
GRANT EXECUTE ON FUNCTION "public"."verify_login"("text", "text") TO "anon", "authenticated";

-- 3. Tự xoá cờ khi người dùng đổi mật khẩu thật sự: trigger trên auth.users
--    khi encrypted_password đổi. Làm ở tầng DB để client không thể "bỏ qua"
--    bước đổi mật khẩu bằng cách gọi thẳng API (CLAUDE.md mục 2).
CREATE FUNCTION "public"."handle_password_changed"()
RETURNS trigger
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
BEGIN
  UPDATE "public"."accounts"
  SET "must_change_password" = false
  WHERE "id" = NEW."id";
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."handle_password_changed"() FROM "public", "anon", "authenticated";

CREATE TRIGGER "on_auth_user_password_changed"
  AFTER UPDATE OF "encrypted_password" ON "auth"."users"
  FOR EACH ROW
  WHEN (OLD."encrypted_password" IS DISTINCT FROM NEW."encrypted_password")
  EXECUTE FUNCTION "public"."handle_password_changed"();

-- 4. Khoá tài khoản 15 phút sau 5 lần sai (AUTH-3) bằng Auth Hook
--    password_verification_attempt (bật trong supabase/config.toml).
--    Bảng đếm chỉ supabase_auth_admin được đụng; anon/authenticated bị REVOKE
--    tường minh vì baseline có ALTER DEFAULT PRIVILEGES GRANT ALL.
CREATE TABLE "public"."auth_failed_attempts" (
  "user_id" uuid PRIMARY KEY,
  "failed_count" integer NOT NULL DEFAULT 0,
  "locked_until" timestamp with time zone,
  "last_failed_at" timestamp with time zone
);

ALTER TABLE "public"."auth_failed_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."auth_failed_attempts" FROM "public", "anon", "authenticated";
GRANT ALL ON TABLE "public"."auth_failed_attempts" TO "supabase_auth_admin";
GRANT USAGE ON SCHEMA "public" TO "supabase_auth_admin";

CREATE FUNCTION "public"."hook_password_verification_attempt"("event" jsonb)
RETURNS jsonb
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_user_id uuid := ("event"->>'user_id')::uuid;
  v_valid boolean := coalesce(("event"->>'valid')::boolean, false);
  v_locked_until timestamp with time zone;
  v_count integer;
BEGIN
  SELECT "locked_until", "failed_count" INTO v_locked_until, v_count
  FROM "public"."auth_failed_attempts" WHERE "user_id" = v_user_id;

  -- Đang trong thời gian khoá: từ chối kể cả khi mật khẩu đúng.
  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN jsonb_build_object(
      'decision', 'reject',
      'message', 'Tài khoản tạm khoá 15 phút do nhập sai mật khẩu 5 lần. Đồng chí vui lòng thử lại sau.',
      'should_logout_user', false
    );
  END IF;

  IF v_valid THEN
    DELETE FROM "public"."auth_failed_attempts" WHERE "user_id" = v_user_id;
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Sai mật khẩu: tăng đếm (đếm lại từ 1 nếu khoá cũ đã hết hạn).
  INSERT INTO "public"."auth_failed_attempts" ("user_id", "failed_count", "last_failed_at", "locked_until")
  VALUES (v_user_id, 1, now(), NULL)
  ON CONFLICT ("user_id") DO UPDATE SET
    "failed_count" = CASE
      WHEN "auth_failed_attempts"."locked_until" IS NOT NULL THEN 1
      ELSE "auth_failed_attempts"."failed_count" + 1 END,
    "last_failed_at" = now(),
    "locked_until" = NULL
  RETURNING "failed_count" INTO v_count;

  IF v_count >= 5 THEN
    UPDATE "public"."auth_failed_attempts"
    SET "locked_until" = now() + interval '15 minutes'
    WHERE "user_id" = v_user_id;
  END IF;

  -- GoTrue tự từ chối vì mật khẩu sai; hook chỉ ghi nhận.
  RETURN jsonb_build_object('decision', 'continue');
END;
$$;

REVOKE EXECUTE ON FUNCTION "public"."hook_password_verification_attempt"(jsonb) FROM "public", "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."hook_password_verification_attempt"(jsonb) TO "supabase_auth_admin";
