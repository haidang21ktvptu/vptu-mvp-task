-- GĐ3 (2/3) — Policy RLS theo vai trò (SPEC RLS-2…7). Ma trận ở docs/SPEC.md §3.2.
-- Thay toàn bộ policy "_tam_thoi_" của GĐ1; bỏ hẳn vai trò anon khỏi dữ liệu
-- (app đã dùng Supabase Auth, trước đăng nhập không cần đọc gì).

-- 0. Dọn policy tạm và quyền anon.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public' AND policyname LIKE '%_tam_thoi_%' LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

REVOKE ALL ON TABLE "public"."accounts", "public"."tasks", "public"."task_directives",
  "public"."task_evidences", "public"."direct_messages",
  "public"."accounts_public", "public"."view_exception_dashboard" FROM "anon";
-- Không để anon tự nhận quyền trên bảng/hàm tạo sau này (baseline 0001 từng cấp).
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

-- 1. accounts (RLS-2): ai đã đăng nhập cũng đọc được; chỉ A1 sửa (một số cột).
CREATE POLICY "accounts_select" ON "public"."accounts"
  FOR SELECT TO "authenticated" USING ("auth"."uid"() IS NOT NULL);

GRANT UPDATE ("full_name", "position_title", "department", "manager_id")
  ON "public"."accounts" TO "authenticated";
CREATE POLICY "accounts_update_a1" ON "public"."accounts"
  FOR UPDATE TO "authenticated"
  USING ("public"."me_role"() = 'A1') WITH CHECK ("public"."me_role"() = 'A1');

-- 2. tasks (RLS-3, RLS-4).
CREATE POLICY "tasks_select" ON "public"."tasks"
  FOR SELECT TO "authenticated"
  USING ("public"."task_in_scope"("assigned_to", "leader_in_charge", "created_by"));

CREATE POLICY "tasks_insert_a1_a2" ON "public"."tasks"
  FOR INSERT TO "authenticated"
  WITH CHECK ("created_by" = "auth"."uid"() AND "public"."can_assign_to"("assigned_to"));

-- A1/A2: sửa trong phạm vi đọc; sau khi sửa, người được giao phải trong phạm vi ghi.
CREATE POLICY "tasks_update_a1_a2" ON "public"."tasks"
  FOR UPDATE TO "authenticated"
  USING ("public"."me_role"() IN ('A1', 'A2')
         AND "public"."task_in_scope"("assigned_to", "leader_in_charge", "created_by"))
  WITH CHECK ("public"."can_assign_to"("assigned_to"));

-- A3: chỉ task của mình; cột và chuyển trạng thái do trigger tasks_guard_a3 chặn.
CREATE POLICY "tasks_update_a3" ON "public"."tasks"
  FOR UPDATE TO "authenticated"
  USING ("public"."me_role"() = 'A3' AND "assigned_to" = "auth"."uid"())
  WITH CHECK ("assigned_to" = "auth"."uid"());

-- 3. task_directives (RLS-5): đọc/thêm nếu là bên liên quan; "đã đọc" qua hàm mark_directives_read().
CREATE POLICY "directives_select" ON "public"."task_directives"
  FOR SELECT TO "authenticated" USING ("public"."is_task_party"("task_id"));

CREATE POLICY "directives_insert" ON "public"."task_directives"
  FOR INSERT TO "authenticated"
  WITH CHECK ("sender_id" = "auth"."uid"() AND "public"."is_task_party"("task_id"));

-- 4. task_evidences (RLS-7): đọc trong phạm vi task; A3 thêm cho task của mình
--    (qua submit_evidence() hoặc trực tiếp); duyệt chỉ qua approve_task().
CREATE POLICY "evidences_select" ON "public"."task_evidences"
  FOR SELECT TO "authenticated" USING ("public"."can_see_task"("task_id"));

CREATE POLICY "evidences_insert_a3" ON "public"."task_evidences"
  FOR INSERT TO "authenticated"
  WITH CHECK ("public"."me_role"() = 'A3' AND "uploaded_by" = "auth"."uid"()
    AND EXISTS (SELECT 1 FROM "public"."tasks" "t"
                WHERE "t"."id" = "task_id" AND "t"."assigned_to" = "auth"."uid"()));

-- 5. direct_messages (RLS-6): chỉ người gửi/người nhận; "đã đọc" qua mark_messages_read().
CREATE POLICY "messages_select" ON "public"."direct_messages"
  FOR SELECT TO "authenticated"
  USING ("sender_id" = "auth"."uid"() OR "receiver_id" = "auth"."uid"());

CREATE POLICY "messages_insert" ON "public"."direct_messages"
  FOR INSERT TO "authenticated" WITH CHECK ("sender_id" = "auth"."uid"());

-- 6. Bảng đếm khoá đăng nhập: chỉ supabase_auth_admin (đã REVOKE ở 0004), giữ nguyên.

-- 7. Siết quyền bảng cho authenticated: những thao tác chỉ đi qua hàm RLS-8 thì
--    thu hồi hẳn (không chỉ "không có policy"), để lỗi rõ ràng và không thể mở
--    nhầm bằng một policy sau này. tasks giữ UPDATE (policy + trigger kiểm soát).
REVOKE UPDATE, DELETE ON TABLE "public"."task_directives", "public"."task_evidences",
  "public"."direct_messages" FROM "authenticated";
REVOKE DELETE ON TABLE "public"."tasks" FROM "authenticated";
