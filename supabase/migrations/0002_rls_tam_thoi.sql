-- GĐ1 — Chặn rò rỉ khẩn cấp (SPEC RLS-1, docs/PROMPTS.md Giai đoạn 1)
-- Bật RLS tạm thời trên 5 bảng và chặn hẳn việc đọc cột accounts.password
-- (không chỉ ẩn bằng view, mà thu hồi quyền đọc cột ở tầng Postgres — RLS chỉ
-- lọc theo dòng, không lọc theo cột, nên nếu chỉ có policy sẽ không chặn được
-- việc gọi thẳng accounts?select=password bằng anon key).

-- 1. View công khai: toàn bộ cột accounts trừ password.
CREATE VIEW "public"."accounts_public"
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
  "department"
FROM "public"."accounts";

GRANT SELECT ON "public"."accounts_public" TO "anon", "authenticated";

-- 2. Chặn đọc cột password ở tầng quyền: thu hồi SELECT trên accounts, cấp lại
--    theo cột (không có password). Các embed PostgREST hiện có từ tasks/
--    task_directives (assigned_to/leader_in_charge/sender_id -> accounts) chỉ
--    xin đúng các cột đã cấp quyền nên không cần sửa gì thêm ở frontend.
REVOKE SELECT ON "public"."accounts" FROM "anon", "authenticated";

GRANT SELECT (
  "id",
  "username",
  "full_name",
  "role_group",
  "position_title",
  "assigned_domain",
  "created_at",
  "manager_id",
  "department"
) ON "public"."accounts" TO "anon", "authenticated";

-- accounts hiện không có UI ghi nào ở frontend (không có màn quản trị tài
-- khoản), nên thu hồi hẳn quyền GHI mà baseline 0001 từng cấp (GRANT ALL) —
-- nếu không, cột password vẫn có thể bị ghi/đọc lại qua INSERT/UPDATE dù đã
-- khoá SELECT. GĐ2/3 khi cần tự đổi mật khẩu sẽ cấp lại có kiểm soát (qua 1
-- function riêng, không GRANT thẳng cột password cho anon/authenticated).
REVOKE INSERT, UPDATE, DELETE ON "public"."accounts" FROM "anon", "authenticated";

-- 3. Hàm đăng nhập an toàn: nơi duy nhất còn được so khớp username/password,
--    chạy với quyền chủ hàm (bỏ qua RLS/quyền cột), không bao giờ trả cột
--    password ra ngoài. Cách đăng nhập (so khớp username + password) không đổi.
--    PHẢI khai báo SETOF (không phải 1 dòng đơn): với hàm trả về đúng 1 dòng
--    composite, PostgREST vẫn trả HTTP 200 kèm 1 object toàn NULL khi không
--    khớp (đã kiểm chứng thực tế), khiến frontend hiểu nhầm thành đăng nhập
--    thành công — SETOF mới trả về mảng rỗng đúng nghĩa "không có tài khoản".
--    Lưu ý: đây vẫn là so khớp plaintext, CHƯA có giới hạn số lần gọi (khoá
--    15 phút sau 5 lần sai — AUTH-3 — chỉ có khi chuyển sang Supabase Auth ở
--    GĐ2, dùng rate-limit sẵn có của Auth). Chấp nhận được ở GĐ1 vì mục tiêu
--    là chặn rò rỉ đọc hàng loạt, chưa phải chặn brute-force.
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

-- 4. Bật RLS trên cả 5 bảng — sau bước này Table Editor không còn UNRESTRICTED.
ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_directives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."task_evidences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."direct_messages" ENABLE ROW LEVEL SECURITY;

-- 5. Policy tạm thời: giữ nguyên hành vi hiện tại của app (chưa dùng Supabase
--    Auth nên mọi request đi bằng anon key — không chỉ cấp cho "authenticated"
--    kẻo gãy luôn cả đăng nhập). Áp cho cả anon và authenticated để không phải
--    sửa lại khi GĐ2 chuyển sang Supabase Auth. Không cấp DELETE vì frontend
--    hiện tại không xoá dữ liệu ở bảng nào trong số này.
--
-- LƯU Ý QUAN TRỌNG cho GĐ3 (RLS đầy đủ theo vai trò): các policy "tam_thoi"
-- trên tasks/task_directives/task_evidences/direct_messages KHÔNG giới hạn gì
-- theo vai trò/phòng ban — ai cầm anon key (lấy được từ mã nguồn frontend)
-- vẫn đọc/ghi được toàn bộ 4 bảng này, gần như y hệt mức lộ trước migration
-- này (baseline 0001 vốn không bật RLS + GRANT ALL, chỉ khác là giờ không còn
-- xoá được). GĐ1 CHƯA thu hẹp phần này — chỉ có accounts.password mới thực sự
-- bị chặn. Khi làm GĐ3: (1) DROP toàn bộ policy có hậu tố "_tam_thoi_" bên
-- dưới, (2) sau khi GĐ2 chuyển hẳn sang Supabase Auth, cân nhắc REVOKE quyền
-- của "anon" trên các bảng này thay vì chỉ thêm policy mới cho "authenticated".
--
-- accounts chỉ có policy SELECT (không có INSERT/UPDATE) vì đã REVOKE hẳn
-- quyền ghi ở bước 2 phía trên — đây là chủ đích, không phải thiếu sót.
CREATE POLICY "accounts_tam_thoi_select" ON "public"."accounts"
  FOR SELECT TO "anon", "authenticated" USING (true);

CREATE POLICY "tasks_tam_thoi_select" ON "public"."tasks"
  FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "tasks_tam_thoi_insert" ON "public"."tasks"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);
CREATE POLICY "tasks_tam_thoi_update" ON "public"."tasks"
  FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "task_directives_tam_thoi_select" ON "public"."task_directives"
  FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "task_directives_tam_thoi_insert" ON "public"."task_directives"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);
CREATE POLICY "task_directives_tam_thoi_update" ON "public"."task_directives"
  FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "task_evidences_tam_thoi_select" ON "public"."task_evidences"
  FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "task_evidences_tam_thoi_insert" ON "public"."task_evidences"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);
CREATE POLICY "task_evidences_tam_thoi_update" ON "public"."task_evidences"
  FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);

CREATE POLICY "direct_messages_tam_thoi_select" ON "public"."direct_messages"
  FOR SELECT TO "anon", "authenticated" USING (true);
CREATE POLICY "direct_messages_tam_thoi_insert" ON "public"."direct_messages"
  FOR INSERT TO "anon", "authenticated" WITH CHECK (true);
CREATE POLICY "direct_messages_tam_thoi_update" ON "public"."direct_messages"
  FOR UPDATE TO "anon", "authenticated" USING (true) WITH CHECK (true);
