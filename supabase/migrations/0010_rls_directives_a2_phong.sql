-- GĐ3 — Mở rộng RLS-5 theo quyết định chủ dự án: Trưởng phòng (A2) đọc/ghi
-- luồng ý kiến của MỌI nhiệm vụ thuộc phòng mình (không chỉ task mình là
-- leader/creator). A3 giữ nguyên: chỉ task của mình. A1 giữ nguyên theo phạm vi.
-- Chỉ thay thân hàm is_task_party (policy directives_select/insert dùng hàm này).

CREATE OR REPLACE FUNCTION "public"."is_task_party"("p_task_id" "uuid") RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND EXISTS (
    SELECT 1 FROM "public"."tasks" "t" WHERE "t"."id" = "p_task_id" AND (
      ("public"."me_role"() IN ('A1', 'A2')
        AND "public"."task_in_scope"("t"."assigned_to", "t"."leader_in_charge", "t"."created_by"))
      OR "auth"."uid"() IN ("t"."assigned_to", "t"."leader_in_charge", "t"."created_by")
    )
  );
$$;
