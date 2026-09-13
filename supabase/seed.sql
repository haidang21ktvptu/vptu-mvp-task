-- Dữ liệu giả để QA cục bộ và trên staging — KHÔNG BAO GIỜ chứa dữ liệu thật.
-- Chạy tự động bởi `supabase db reset` (local) và nạp thủ công vào staging.
-- 5 tài khoản, đủ 3 vai trò + đủ để test ranh giới phòng ban:
--   demo_cvp        A1  Chánh Văn phòng            (thấy toàn cơ quan)
--   demo_pcvp       A1  Phó Chánh Văn phòng        (thấy khối mình phụ trách)
--   demo_truongphong A2 Trưởng phòng TONG_HOP      (thấy phòng mình)
--   demo_cv1        A3  Chuyên viên TONG_HOP       (cùng phòng demo_truongphong)
--   demo_cv2        A3  Chuyên viên QUAN_TRI       (khác phòng, để test cách ly)
-- Không còn cột password (migration 0006). Để đăng nhập local/staging, tạo auth.users
-- trùng id qua Supabase Dashboard/Admin API (xem scripts/README.md).

INSERT INTO "public"."accounts"
  ("id", "username", "full_name", "role_group", "position_title", "assigned_domain", "manager_id", "department")
VALUES
  ('00000000-0000-4000-8000-000000000001', 'demo_cvp', 'Demo Chánh Văn phòng', 'A1', 'Chánh Văn phòng', NULL, NULL, 'LANH_DAO_VAN_PHONG'),
  ('00000000-0000-4000-8000-000000000002', 'demo_pcvp', 'Demo Phó Chánh Văn phòng', 'A1', 'Phó Chánh Văn phòng (Phụ trách Tổng hợp)', NULL, NULL, 'LANH_DAO_VAN_PHONG'),
  ('00000000-0000-4000-8000-000000000003', 'demo_truongphong', 'Demo Trưởng phòng', 'A2', 'Trưởng phòng', NULL, '00000000-0000-4000-8000-000000000002', 'TONG_HOP'),
  ('00000000-0000-4000-8000-000000000004', 'demo_cv1', 'Demo Chuyên viên Một', 'A3', 'Chuyên viên', NULL, '00000000-0000-4000-8000-000000000002', 'TONG_HOP'),
  ('00000000-0000-4000-8000-000000000005', 'demo_cv2', 'Demo Chuyên viên Hai', 'A3', 'Chuyên viên', NULL, '00000000-0000-4000-8000-000000000002', 'QUAN_TRI')
ON CONFLICT ("id") DO NOTHING;
