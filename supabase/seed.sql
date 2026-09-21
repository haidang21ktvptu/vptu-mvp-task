-- Dữ liệu giả để QA cục bộ và trên staging — KHÔNG BAO GIỜ chứa dữ liệu thật.
-- Chạy tự động bởi `supabase db reset` / `supabase start` (local) và nạp thủ công vào staging.
-- 8 tài khoản, đủ 3 vai trò và 2 khối/2 phòng để test ranh giới (GĐ3):
--   demo_cvp         A1  Chánh Văn phòng (is_chief)     thấy toàn cơ quan
--   demo_pcvp        A1  Phó CVP phụ trách khối Tổng hợp  (demo_truongphong, demo_cv1)
--   demo_pcvp2       A1  Phó CVP phụ trách khối Quản trị  (demo_cv2)
--   demo_truongphong A2  Trưởng phòng TONG_HOP
--   demo_cv1         A3  Chuyên viên TONG_HOP
--   demo_cv2         A3  Chuyên viên QUAN_TRI (khác phòng, khác khối)
--   smoke_test       A3  Tài khoản hệ thống (is_system, phòng CDS_CY) — smoke test sau phát hành; ẩn khỏi danh bạ
--   demo_qtht        A3  Chuyên viên CDS_CY giữ cờ quan_tri_he_thong (GĐ8) — cấp/thu quan_tri_kl, phân công phụ trách phòng
--   demo_a0          A0  Thường trực Tỉnh ủy (GĐ18, CH-11 = A): chỉ đọc + ghi ý kiến; không phòng
-- Tài khoản riêng cho từng spec e2e (GĐ18, Playwright 2 worker — spec không dùng chung tài khoản; test RLS vẫn dùng bộ trên):
--   demo_e2e_kl / demo_e2e_mc / demo_e2e_nv / demo_e2e_dh  A3 TONG_HOP — kl-chuyen-vien / kl-minh-chung / nhiem-vu / dieu-hanh
--   demo_e2e_owner   A3  TONG_HOP, chỉ làm Owner dữ liệu (kl-realtime, kl-them-nhiem-vu), không đăng nhập
--   demo_e2e_tk      A3  TONG_HOP — thư ký Thường trực (0047): spec thu-ky-tt cấp cờ lúc chạy rồi thu lại
--   demo_e2e_tp / demo_e2e_cv  A2 / A3 phòng giả E2E_RT — realtime (nhắn tin 1-1)
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
    ('00000000-0000-4000-8000-000000000007'::uuid, 'smoke_test'),
    ('00000000-0000-4000-8000-000000000008'::uuid, 'demo_qtht'),
    ('00000000-0000-4000-8000-000000000009'::uuid, 'demo_a0'),
    ('00000000-0000-4000-8000-000000000010'::uuid, 'demo_e2e_kl'),
    ('00000000-0000-4000-8000-000000000011'::uuid, 'demo_e2e_mc'),
    ('00000000-0000-4000-8000-000000000012'::uuid, 'demo_e2e_nv'),
    ('00000000-0000-4000-8000-000000000013'::uuid, 'demo_e2e_dh'),
    ('00000000-0000-4000-8000-000000000014'::uuid, 'demo_e2e_owner'),
    ('00000000-0000-4000-8000-000000000015'::uuid, 'demo_e2e_tp'),
    ('00000000-0000-4000-8000-000000000016'::uuid, 'demo_e2e_cv'),
    ('00000000-0000-4000-8000-000000000018'::uuid, 'demo_e2e_tk')
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
  ("id", "username", "full_name", "role_group", "position_title", "manager_id", "department", "is_chief", "must_change_password", "is_system", "quan_tri_he_thong")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'Chánh Văn phòng', NULL, 'LANH_DAO_VAN_PHONG', true, false, false, false),
  ('00000000-0000-4000-8000-000000000002', 'demo_pcvp', 'Demo Phó Chánh Văn phòng', 'A1', 'Phó Chánh Văn phòng (Phụ trách Tổng hợp)', NULL, 'LANH_DAO_VAN_PHONG', false, false, false, false),
  ('00000000-0000-4000-8000-000000000006', 'demo_pcvp2', 'Demo Phó Chánh Văn phòng Hai', 'A1', 'Phó Chánh Văn phòng (Phụ trách Quản trị)', NULL, 'LANH_DAO_VAN_PHONG', false, false, false, false),
  ('00000000-0000-4000-8000-000000000003', 'demo_truongphong', 'Demo Trưởng phòng', 'A2', 'Trưởng phòng', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000004', 'demo_cv1', 'Demo Chuyên viên Một', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000005', 'demo_cv2', 'Demo Chuyên viên Hai', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000006', 'QUAN_TRI', false, false, false, false),
  ('00000000-0000-4000-8000-000000000007', 'smoke_test', 'Tài khoản kiểm thử hệ thống', 'A3', 'Kiểm thử hệ thống', NULL, 'CDS_CY', false, false, true, false),
  ('00000000-0000-4000-8000-000000000008', 'demo_qtht', 'Demo Quản trị hệ thống', 'A3', 'Chuyên viên', NULL, 'CDS_CY', false, false, false, true),
  ('00000000-0000-4000-8000-000000000009', 'demo_a0', 'Demo Thường trực Tỉnh ủy', 'A0', 'Thường trực Tỉnh ủy', NULL, NULL, false, false, false, false),
  ('00000000-0000-4000-8000-000000000010', 'demo_e2e_kl', 'Demo E2E Chuyên viên KL', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000011', 'demo_e2e_mc', 'Demo E2E Chuyên viên MC', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000012', 'demo_e2e_nv', 'Demo E2E Chuyên viên NV', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000013', 'demo_e2e_dh', 'Demo E2E Chuyên viên DH', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000014', 'demo_e2e_owner', 'Demo E2E Chuyên viên Owner', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false),
  ('00000000-0000-4000-8000-000000000015', 'demo_e2e_tp', 'Demo E2E Trưởng phòng RT', 'A2', 'Trưởng phòng', NULL, 'E2E_RT', false, false, false, false),
  ('00000000-0000-4000-8000-000000000016', 'demo_e2e_cv', 'Demo E2E Chuyên viên RT', 'A3', 'Chuyên viên', NULL, 'E2E_RT', false, false, false, false),
  ('00000000-0000-4000-8000-000000000018', 'demo_e2e_tk', 'Demo E2E Thư ký TT', 'A3', 'Chuyên viên', NULL, 'TONG_HOP', false, false, false, false)
ON CONFLICT ("id") DO UPDATE SET
  "manager_id" = EXCLUDED."manager_id",
  "department" = EXCLUDED."department",
  "is_chief" = EXCLUDED."is_chief",
  "is_system" = EXCLUDED."is_system",
  "quan_tri_he_thong" = EXCLUDED."quan_tri_he_thong";

-- 3. Phân công PCVP phụ trách phòng (GĐ8, bảng phu_trach_phong) — chỉ dữ liệu giả cho test RLS:
--    demo_pcvp ↔ TONG_HOP, demo_pcvp2 ↔ QUAN_TRI, hiệu lực từ 01/01/2026. Migration 0013 tạo
--    bảng RỖNG; phân công thật trên production do chủ dự án nhập ở màn hình Quản trị.
INSERT INTO "public"."phu_trach_phong" ("lanh_dao_id", "phong", "tu_ngay", "ly_do")
SELECT v."id"::uuid, v."phong", DATE '2026-01-01', 'seed'
FROM (VALUES
  ('00000000-0000-4000-8000-000000000002', 'TONG_HOP'),
  ('00000000-0000-4000-8000-000000000006', 'QUAN_TRI')
) AS v("id", "phong")
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."phu_trach_phong" p
  WHERE p."lanh_dao_id" = v."id"::uuid AND p."phong" = v."phong" AND p."den_ngay" IS NULL
);
