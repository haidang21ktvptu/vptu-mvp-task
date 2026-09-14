-- Dữ liệu giả để QA cục bộ và trên staging — KHÔNG BAO GIỜ chứa dữ liệu thật.
-- Chạy tự động bởi `supabase db reset` / `supabase start` (local) và nạp thủ công vào staging.
-- 7 tài khoản, đủ 3 vai trò và 2 khối/2 phòng để test ranh giới (GĐ3):
--   demo_cvp         A1  Chánh Văn phòng (is_chief)     thấy toàn cơ quan
--   demo_pcvp        A1  Phó CVP phụ trách khối Tổng hợp  (demo_truongphong, demo_cv1)
--   demo_pcvp2       A1  Phó CVP phụ trách khối Quản trị  (demo_cv2)
--   demo_truongphong A2  Trưởng phòng TONG_HOP
--   demo_cv1         A3  Chuyên viên TONG_HOP
--   demo_cv2         A3  Chuyên viên QUAN_TRI (khác phòng, khác khối)
--   smoke_test       A3  Tài khoản hệ thống (is_system, phòng CDS_CY) — smoke test sau phát hành; ẩn khỏi danh bạ
-- Mật khẩu chung: 123456 (chỉ tài khoản giả). Từ migration 0011, accounts.id là FK tới
-- auth.users.id nên phải tạo auth user TRƯỚC, cùng id, rồi mới INSERT accounts.
-- ON CONFLICT DO NOTHING/UPDATE để chạy lại vẫn đồng bộ được manager_id/is_chief.

-- 1. auth.users + auth.identities (băm bcrypt bằng pgcrypto, cost 10 như GoTrue).
--    Các cột token đặt '' (không NULL) để GoTrue đọc được dòng.
WITH demo(id, username) AS (
  VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 'demo_cvp'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'demo_pcvp'),
    ('00000000-0000-4000-8000-000000000006'::uuid, 'demo_pcvp2'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'demo_truongphong'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'demo_cv1'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'demo_cv2'),
    ('00000000-0000-4000-8000-000000000007'::uuid, 'smoke_test')
)
INSERT INTO "auth"."users"
  ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at",
   "raw_app_meta_data", "raw_user_meta_data", "created_at", "updated_at",
   "confirmation_token", "recovery_token", "email_change", "email_change_token_new",
   "email_change_token_current", "phone_change", "phone_change_token", "reauthentication_token",
   "is_sso_user", "is_anonymous")
SELECT
  '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  username || '@vptu.caobang.local', extensions.crypt('123456', extensions.gen_salt('bf', 10)), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('username', username), now(), now(),
  '', '', '', '', '', '', '', '', false, false
FROM demo
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "auth"."identities"
  ("id", "user_id", "provider_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at")
SELECT
  gen_random_uuid(), u."id", u."id"::text,
  jsonb_build_object('sub', u."id"::text, 'email', u."email", 'email_verified', true),
  'email', now(), now(), now()
FROM "auth"."users" u
WHERE u."email" LIKE 'demo\_%@vptu.caobang.local' OR u."email" = 'smoke_test@vptu.caobang.local'
ON CONFLICT ("provider_id", "provider") DO NOTHING;

-- 2. Hồ sơ cán bộ (cùng id với auth.users ở trên). must_change_password = false để
--    đăng nhập thẳng vào app (test e2e/RLS).
INSERT INTO "public"."accounts"
  ("id", "username", "full_name", "role_group", "position_title", "manager_id", "department", "is_chief", "must_change_password", "is_system")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'Chánh Văn phòng', NULL, 'LANH_DAO_VAN_PHONG', true, false, false),
  ('00000000-0000-4000-8000-000000000002', 'demo_pcvp', 'Demo Phó Chánh Văn phòng', 'A1', 'Phó Chánh Văn phòng (Phụ trách Tổng hợp)', NULL, 'LANH_DAO_VAN_PHONG', false, false, false),
  ('00000000-0000-4000-8000-000000000006', 'demo_pcvp2', 'Demo Phó Chánh Văn phòng Hai', 'A1', 'Phó Chánh Văn phòng (Phụ trách Quản trị)', NULL, 'LANH_DAO_VAN_PHONG', false, false, false),
  ('00000000-0000-4000-8000-000000000003', 'demo_truongphong', 'Demo Trưởng phòng', 'A2', 'Trưởng phòng', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false, false, false),
  ('00000000-0000-4000-8000-000000000004', 'demo_cv1', 'Demo Chuyên viên Một', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false, false, false),
  ('00000000-0000-4000-8000-000000000005', 'demo_cv2', 'Demo Chuyên viên Hai', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000006', 'QUAN_TRI', false, false, false),
  ('00000000-0000-4000-8000-000000000007', 'smoke_test', 'Tài khoản kiểm thử hệ thống', 'A3', 'Kiểm thử hệ thống', NULL, 'CDS_CY', false, false, true)
ON CONFLICT ("id") DO UPDATE SET
  "manager_id" = EXCLUDED."manager_id",
  "department" = EXCLUDED."department",
  "is_chief" = EXCLUDED."is_chief",
  "is_system" = EXCLUDED."is_system";
