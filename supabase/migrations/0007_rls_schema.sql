-- GĐ3 (1/3) — Nền cho RLS theo vai trò (SPEC §2, RLS-2…7): cột is_chief, bỏ
-- assigned_domain, hàm trợ giúp SECURITY DEFINER, trigger giới hạn A3, view
-- security_invoker. Policy ở 0008, hàm nghiệp vụ (RLS-8) ở 0009.

-- 1. Cột phân biệt Chánh Văn phòng (CVP) với Phó Chánh VP (PCVP): cả 5 A1 đều
--    manager_id NULL nên không suy ra được. Cấp quyền cột tường minh (SPEC §5).
ALTER TABLE "public"."accounts" ADD COLUMN "is_chief" boolean NOT NULL DEFAULT false;
GRANT SELECT ("is_chief") ON "public"."accounts" TO "authenticated";
UPDATE "public"."accounts" SET "is_chief" = true WHERE "username" = 'levanmieu';

-- 2. Bỏ cột mồ côi assigned_domain (SPEC §5). View liệt kê cột tường minh nên
--    phải tạo lại (không còn hàm nào phụ thuộc kiểu dòng của view).
DROP VIEW "public"."accounts_public";
ALTER TABLE "public"."accounts" DROP COLUMN "assigned_domain";

CREATE VIEW "public"."accounts_public"
WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title",
       "created_at", "manager_id", "department", "must_change_password", "is_chief"
FROM "public"."accounts";
GRANT SELECT ON "public"."accounts_public" TO "authenticated";

-- 3. Hàm trợ giúp: SECURITY DEFINER để đọc accounts/tasks trong policy mà không
--    đệ quy RLS; STABLE; search_path cố định; chỉ trả thông tin về chính người
--    gọi hoặc boolean; auth.uid() NULL -> luôn false/NULL.
CREATE FUNCTION "public"."me_role"() RETURNS "text"
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "role_group" FROM "public"."accounts" WHERE "id" = "auth"."uid"();
$$;

CREATE FUNCTION "public"."me_dept"() RETURNS "text"
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "department" FROM "public"."accounts" WHERE "id" = "auth"."uid"();
$$;

CREATE FUNCTION "public"."me_is_chief"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "is_chief" AND "role_group" = 'A1'
                   FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

-- Khối PCVP phụ trách: tài khoản có manager_id = PCVP, hoặc manager_id trỏ tới
-- một A2 mà A2 đó có manager_id = PCVP (2 cấp), hoặc chính PCVP.
CREATE FUNCTION "public"."in_my_block"("p_account" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND "p_account" IS NOT NULL AND (
    "p_account" = "auth"."uid"()
    OR EXISTS (
      SELECT 1 FROM "public"."accounts" "a"
      LEFT JOIN "public"."accounts" "m" ON "m"."id" = "a"."manager_id"
      WHERE "a"."id" = "p_account"
        AND ("a"."manager_id" = "auth"."uid"() OR "m"."manager_id" = "auth"."uid"())
    )
  );
$$;

CREATE FUNCTION "public"."in_my_dept"("p_account" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND "p_account" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "public"."accounts" "a"
    WHERE "a"."id" = "p_account" AND "a"."department" = "public"."me_dept"()
  );
$$;

-- Phạm vi ĐỌC một task theo 3 bên liên quan (RLS-3).
CREATE FUNCTION "public"."task_in_scope"("p_assigned" "uuid", "p_leader" "uuid", "p_creator" "uuid")
RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND CASE "public"."me_role"()
    WHEN 'A1' THEN "public"."me_is_chief"()
                   OR "public"."in_my_block"("p_assigned")
                   OR "public"."in_my_block"("p_leader")
                   OR "public"."in_my_block"("p_creator")
    WHEN 'A2' THEN "public"."in_my_dept"("p_assigned")
                   OR "p_leader" = "auth"."uid"()
                   OR "p_creator" = "auth"."uid"()
                   OR "p_assigned" = "auth"."uid"()
    WHEN 'A3' THEN "p_assigned" = "auth"."uid"()
    ELSE false END;
$$;

-- Phạm vi GHI: được giao/đổi người cho ai (RLS-4). NULL = chưa giao.
CREATE FUNCTION "public"."can_assign_to"("p_assigned" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND CASE "public"."me_role"()
    WHEN 'A1' THEN "public"."me_is_chief"() OR "p_assigned" IS NULL OR "public"."in_my_block"("p_assigned")
    WHEN 'A2' THEN "p_assigned" IS NULL OR "public"."in_my_dept"("p_assigned")
    ELSE false END;
$$;

CREATE FUNCTION "public"."can_see_task"("p_task_id" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."tasks" "t" WHERE "t"."id" = "p_task_id"
      AND "public"."task_in_scope"("t"."assigned_to", "t"."leader_in_charge", "t"."created_by")
  );
$$;

-- Bên liên quan của task (RLS-5): A1 trong phạm vi, hoặc là assigned/leader/creator.
CREATE FUNCTION "public"."is_task_party"("p_task_id" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND EXISTS (
    SELECT 1 FROM "public"."tasks" "t" WHERE "t"."id" = "p_task_id" AND (
      ("public"."me_role"() = 'A1'
        AND "public"."task_in_scope"("t"."assigned_to", "t"."leader_in_charge", "t"."created_by"))
      OR "auth"."uid"() IN ("t"."assigned_to", "t"."leader_in_charge", "t"."created_by")
    )
  );
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['me_role()', 'me_dept()', 'me_is_chief()', 'in_my_block(uuid)',
    'in_my_dept(uuid)', 'task_in_scope(uuid,uuid,uuid)', 'can_assign_to(uuid)',
    'can_see_task(uuid)', 'is_task_party(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 4. A3 chỉ được đổi status/reject_reason trên task của mình, theo chuyển trạng
--    thái hợp lệ (RLS-4). Trigger chạy với quyền người gọi; me_role() là definer.
CREATE FUNCTION "public"."tasks_guard_a3"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
BEGIN
  IF "public"."me_role"() <> 'A3' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - 'status' - 'reject_reason') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'reject_reason') THEN
    RAISE EXCEPTION 'Chuyên viên chỉ được cập nhật trạng thái và lý do từ chối.' USING ERRCODE = '42501';
  END IF;
  IF NOT ((OLD."status" = 'CHO_TIEP_NHAN' AND NEW."status" IN ('DANG_THUC_HIEN', 'TU_CHOI_TIEP_NHAN'))
       OR (OLD."status" = 'DANG_THUC_HIEN' AND NEW."status" = 'CHO_DUYET')
       OR OLD."status" = NEW."status") THEN
    RAISE EXCEPTION 'Chuyển trạng thái % -> % không hợp lệ với chuyên viên.', OLD."status", NEW."status"
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "tasks_guard_a3"
  BEFORE UPDATE ON "public"."tasks"
  FOR EACH ROW EXECUTE FUNCTION "public"."tasks_guard_a3"();

-- 5. View dashboard chạy với quyền người gọi -> RLS của tasks/accounts áp lên view
--    (CVP thấy tất cả, PCVP khối mình, A2 phòng mình, A3 việc mình).
ALTER VIEW "public"."view_exception_dashboard" SET ("security_invoker" = true);
