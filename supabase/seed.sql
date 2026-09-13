-- Dữ liệu giả để QA cục bộ và trên staging — KHÔNG BAO GIỜ chứa dữ liệu thật.
-- Chạy tự động bởi `supabase db reset` (local) và nạp thủ công vào staging.
-- 6 tài khoản, đủ 3 vai trò và 2 khối/2 phòng để test ranh giới (GĐ3):
--   demo_cvp         A1  Chánh Văn phòng (is_chief)     thấy toàn cơ quan
--   demo_pcvp        A1  Phó CVP phụ trách khối Tổng hợp  (demo_truongphong, demo_cv1)
--   demo_pcvp2       A1  Phó CVP phụ trách khối Quản trị  (demo_cv2)
--   demo_truongphong A2  Trưởng phòng TONG_HOP
--   demo_cv1         A3  Chuyên viên TONG_HOP
--   demo_cv2         A3  Chuyên viên QUAN_TRI (khác phòng, khác khối)
-- Không còn cột password (migration 0006). Để đăng nhập local/staging:
--   cd scripts && node create-auth-users.mjs --local --default-password 123456
-- ON CONFLICT DO UPDATE để chạy lại vẫn đồng bộ được manager_id/is_chief.

INSERT INTO "public"."accounts"
  ("id", "username", "full_name", "role_group", "position_title", "manager_id", "department", "is_chief")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'Chánh Văn phòng', NULL, 'LANH_DAO_VAN_PHONG', true),
  ('00000000-0000-4000-8000-000000000002', 'demo_pcvp', 'Demo Phó Chánh Văn phòng', 'A1', 'Phó Chánh Văn phòng (Phụ trách Tổng hợp)', NULL, 'LANH_DAO_VAN_PHONG', false),
  ('00000000-0000-4000-8000-000000000006', 'demo_pcvp2', 'Demo Phó Chánh Văn phòng Hai', 'A1', 'Phó Chánh Văn phòng (Phụ trách Quản trị)', NULL, 'LANH_DAO_VAN_PHONG', false),
  ('00000000-0000-4000-8000-000000000003', 'demo_truongphong', 'Demo Trưởng phòng', 'A2', 'Trưởng phòng', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false),
  ('00000000-0000-4000-8000-000000000004', 'demo_cv1', 'Demo Chuyên viên Một', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000002', 'TONG_HOP', false),
  ('00000000-0000-4000-8000-000000000005', 'demo_cv2', 'Demo Chuyên viên Hai', 'A3', 'Chuyên viên', '00000000-0000-4000-8000-000000000006', 'QUAN_TRI', false)
ON CONFLICT ("id") DO UPDATE SET
  "manager_id" = EXCLUDED."manager_id",
  "department" = EXCLUDED."department",
  "is_chief" = EXCLUDED."is_chief";
