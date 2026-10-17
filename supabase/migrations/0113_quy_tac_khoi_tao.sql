-- 0113 (v3.25): bộ quy tắc nhận diện khởi tạo cho 25 mục tiêu của danh mục tạm (0105) — bản do trợ lý soạn để chủ dự án duyệt trên staging
-- (chủ dự án đồng ý 17/10/2026, câu 4). Mức tích sẵn chỉ cho căn cứ rõ: số hiệu nghị quyết, lĩnh vực trùng nội dung mục tiêu (Chuyển đổi số, KHCN, Năng
-- lượng, Khu kinh tế, Dự án giao thông trọng điểm), cụm từ riêng (Công viên địa chất, thác Bản Giốc, kinh tế cửa khẩu, kinh tế rừng, Đại hội XIV…);
-- còn lại gợi ý. Sau đó hệ thống tự nâng / hạ theo thao tác của người giao (0111), trợ lý AI soạn thêm (0112), quản trị sửa ở Quản trị › Danh mục
-- mục tiêu. Từ khoá so khớp không dấu, theo nguyên cụm từ (kl_chuan_chu).

INSERT INTO "public"."quy_tac_muc_tieu" ("muc_tieu_ma", "loai", "gia_tri", "muc", "nguon")
SELECT x.ma, x.loai, x.gia_tri, x.muc, 'KHOI_TAO' FROM (VALUES
  -- Số hiệu nghị quyết Trung ương (tích sẵn)
  ('NQ_57', 'SO_HIEU', '57-NQ/TW', 'TU_TICH'), ('NQ_59', 'SO_HIEU', '59-NQ/TW', 'TU_TICH'), ('NQ_66', 'SO_HIEU', '66-NQ/TW', 'TU_TICH'),
  ('NQ_68', 'SO_HIEU', '68-NQ/TW', 'TU_TICH'), ('NQ_70', 'SO_HIEU', '70-NQ/TW', 'TU_TICH'), ('NQ_71', 'SO_HIEU', '71-NQ/TW', 'TU_TICH'),
  ('NQ_72', 'SO_HIEU', '72-NQ/TW', 'TU_TICH'), ('NQ_79', 'SO_HIEU', '79-NQ/TW', 'TU_TICH'), ('NQ_80', 'SO_HIEU', '80-NQ/TW', 'TU_TICH'),
  -- Đột phá cán bộ, nguồn nhân lực
  ('DP_CAN_BO', 'TU_KHOA', 'nguồn nhân lực chất lượng cao', 'GOI_Y'), ('DP_CAN_BO', 'TU_KHOA', 'đội ngũ cán bộ lãnh đạo, quản lý', 'GOI_Y'),
  ('DP_CAN_BO', 'TU_KHOA', 'chất lượng đội ngũ cán bộ', 'GOI_Y'), ('DP_CAN_BO', 'TU_KHOA', 'quy hoạch cán bộ', 'GOI_Y'),
  ('DP_CAN_BO', 'TU_KHOA', 'đào tạo, bồi dưỡng cán bộ', 'GOI_Y'), ('DP_CAN_BO', 'TU_KHOA', 'luân chuyển cán bộ', 'GOI_Y'),
  ('DP_CAN_BO', 'TU_KHOA', 'thu hút nhân tài', 'GOI_Y'), ('DP_CAN_BO', 'TU_KHOA', 'công tác cán bộ', 'GOI_Y'),
  -- Đột phá hạ tầng giao thông, đô thị, môi trường
  ('DP_HA_TANG', 'LINH_VUC', 'LV09_DU_AN_GIAO_THONG_TRONG_DIEM', 'TU_TICH'), ('DP_HA_TANG', 'LINH_VUC', 'LV09_GIAO_THONG', 'GOI_Y'),
  ('DP_HA_TANG', 'TU_KHOA', 'đường cao tốc', 'TU_TICH'), ('DP_HA_TANG', 'TU_KHOA', 'cao tốc Đồng Đăng – Trà Lĩnh', 'TU_TICH'),
  ('DP_HA_TANG', 'TU_KHOA', 'kết cấu hạ tầng', 'GOI_Y'), ('DP_HA_TANG', 'TU_KHOA', 'hạ tầng giao thông', 'GOI_Y'),
  ('DP_HA_TANG', 'TU_KHOA', 'hạ tầng đô thị', 'GOI_Y'), ('DP_HA_TANG', 'TU_KHOA', 'chỉnh trang đô thị', 'GOI_Y'),
  ('DP_HA_TANG', 'TU_KHOA', 'phát triển đô thị', 'GOI_Y'), ('DP_HA_TANG', 'TU_KHOA', 'giải phóng mặt bằng', 'GOI_Y'),
  -- Đột phá khoa học, công nghệ, đổi mới sáng tạo, chuyển đổi số
  ('DP_KHCN_CDS', 'LINH_VUC', 'LV10_CHUYEN_DOI_SO', 'TU_TICH'), ('DP_KHCN_CDS', 'LINH_VUC', 'LV10_KHCN', 'TU_TICH'),
  ('DP_KHCN_CDS', 'TU_KHOA', 'chuyển đổi số', 'TU_TICH'), ('DP_KHCN_CDS', 'TU_KHOA', 'đổi mới sáng tạo', 'GOI_Y'),
  ('DP_KHCN_CDS', 'TU_KHOA', 'khoa học, công nghệ', 'GOI_Y'), ('DP_KHCN_CDS', 'TU_KHOA', 'khoa học và công nghệ', 'GOI_Y'),
  ('DP_KHCN_CDS', 'TU_KHOA', 'chính quyền số', 'GOI_Y'), ('DP_KHCN_CDS', 'TU_KHOA', 'xã hội số', 'GOI_Y'),
  ('DP_KHCN_CDS', 'TU_KHOA', 'nền tảng số', 'GOI_Y'), ('DP_KHCN_CDS', 'TU_KHOA', 'dữ liệu số', 'GOI_Y'), ('DP_KHCN_CDS', 'TU_KHOA', 'trí tuệ nhân tạo', 'GOI_Y'),
  -- Chương trình du lịch bền vững
  ('CTR_DU_LICH', 'TU_KHOA', 'Công viên địa chất', 'TU_TICH'), ('CTR_DU_LICH', 'TU_KHOA', 'thác Bản Giốc', 'TU_TICH'),
  ('CTR_DU_LICH', 'TU_KHOA', 'Non nước Cao Bằng', 'TU_TICH'), ('CTR_DU_LICH', 'TU_KHOA', 'du lịch', 'GOI_Y'),
  ('CTR_DU_LICH', 'TU_KHOA', 'khách du lịch', 'GOI_Y'), ('CTR_DU_LICH', 'TU_KHOA', 'sản phẩm du lịch', 'GOI_Y'),
  -- Chương trình kinh tế rừng
  ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'kinh tế rừng', 'TU_TICH'), ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'trồng rừng', 'GOI_Y'),
  ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'bảo vệ rừng', 'GOI_Y'), ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'phát triển rừng', 'GOI_Y'),
  ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'lâm nghiệp', 'GOI_Y'), ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'dược liệu dưới tán rừng', 'GOI_Y'),
  ('CTR_KINH_TE_RUNG', 'TU_KHOA', 'tín chỉ carbon', 'GOI_Y'),
  -- Chương trình kinh tế cửa khẩu
  ('CTR_CUA_KHAU', 'LINH_VUC', 'LV05_KHU_KINH_TE', 'TU_TICH'), ('CTR_CUA_KHAU', 'TU_KHOA', 'kinh tế cửa khẩu', 'TU_TICH'),
  ('CTR_CUA_KHAU', 'TU_KHOA', 'khu kinh tế cửa khẩu', 'TU_TICH'), ('CTR_CUA_KHAU', 'TU_KHOA', 'cửa khẩu', 'GOI_Y'),
  ('CTR_CUA_KHAU', 'TU_KHOA', 'xuất nhập khẩu', 'GOI_Y'), ('CTR_CUA_KHAU', 'TU_KHOA', 'logistics', 'GOI_Y'), ('CTR_CUA_KHAU', 'TU_KHOA', 'biên mậu', 'GOI_Y'),
  -- Nghị quyết Đại hội XIV
  ('NQ_DH_XIV', 'TU_KHOA', 'Đại hội XIV', 'TU_TICH'), ('NQ_DH_XIV', 'TU_KHOA', 'Đại hội đại biểu toàn quốc lần thứ XIV', 'TU_TICH'),
  -- Nghị quyết Trung ương theo nội dung (gợi ý)
  ('NQ_57', 'LINH_VUC', 'LV10_CHUYEN_DOI_SO', 'GOI_Y'), ('NQ_57', 'LINH_VUC', 'LV10_KHCN', 'GOI_Y'), ('NQ_57', 'TU_KHOA', 'chuyển đổi số quốc gia', 'GOI_Y'),
  ('NQ_59', 'TU_KHOA', 'hội nhập quốc tế', 'GOI_Y'), ('NQ_59', 'LINH_VUC', 'LV05_DOI_NGOAI_DANG', 'GOI_Y'),
  ('NQ_66', 'TU_KHOA', 'xây dựng và thi hành pháp luật', 'TU_TICH'), ('NQ_66', 'TU_KHOA', 'thi hành pháp luật', 'GOI_Y'),
  ('NQ_66', 'TU_KHOA', 'văn bản quy phạm pháp luật', 'GOI_Y'), ('NQ_66', 'LINH_VUC', 'LV03_TU_PHAP', 'GOI_Y'),
  ('NQ_68', 'TU_KHOA', 'kinh tế tư nhân', 'TU_TICH'), ('NQ_68', 'TU_KHOA', 'doanh nghiệp tư nhân', 'GOI_Y'), ('NQ_68', 'TU_KHOA', 'hộ kinh doanh', 'GOI_Y'),
  ('NQ_68', 'TU_KHOA', 'doanh nghiệp nhỏ và vừa', 'GOI_Y'), ('NQ_68', 'TU_KHOA', 'môi trường đầu tư kinh doanh', 'GOI_Y'),
  ('NQ_70', 'LINH_VUC', 'LV05_NANG_LUONG', 'TU_TICH'), ('NQ_70', 'TU_KHOA', 'an ninh năng lượng', 'TU_TICH'),
  ('NQ_70', 'TU_KHOA', 'năng lượng tái tạo', 'GOI_Y'), ('NQ_70', 'TU_KHOA', 'thủy điện', 'GOI_Y'), ('NQ_70', 'TU_KHOA', 'điện gió', 'GOI_Y'),
  ('NQ_70', 'TU_KHOA', 'điện mặt trời', 'GOI_Y'), ('NQ_70', 'TU_KHOA', 'lưới điện', 'GOI_Y'),
  ('NQ_71', 'TU_KHOA', 'giáo dục và đào tạo', 'GOI_Y'), ('NQ_71', 'TU_KHOA', 'giáo dục, đào tạo', 'GOI_Y'), ('NQ_71', 'TU_KHOA', 'đổi mới giáo dục', 'GOI_Y'),
  ('NQ_71', 'TU_KHOA', 'trường học', 'GOI_Y'), ('NQ_71', 'TU_KHOA', 'giáo viên', 'GOI_Y'), ('NQ_71', 'TU_KHOA', 'học sinh', 'GOI_Y'),
  ('NQ_71', 'LOAI_TRU', 'bồi dưỡng cán bộ', 'GOI_Y'), ('NQ_71', 'LOAI_TRU', 'đào tạo cán bộ', 'GOI_Y'),
  ('NQ_72', 'TU_KHOA', 'chăm sóc sức khỏe', 'GOI_Y'), ('NQ_72', 'TU_KHOA', 'y tế', 'GOI_Y'), ('NQ_72', 'TU_KHOA', 'khám chữa bệnh', 'GOI_Y'),
  ('NQ_72', 'TU_KHOA', 'bệnh viện', 'GOI_Y'), ('NQ_72', 'TU_KHOA', 'bảo hiểm y tế', 'GOI_Y'),
  ('NQ_79', 'TU_KHOA', 'kinh tế nhà nước', 'TU_TICH'), ('NQ_79', 'TU_KHOA', 'doanh nghiệp nhà nước', 'GOI_Y'), ('NQ_79', 'TU_KHOA', 'vốn nhà nước', 'GOI_Y'),
  ('NQ_80', 'TU_KHOA', 'phát triển văn hóa', 'GOI_Y'), ('NQ_80', 'TU_KHOA', 'di sản văn hóa', 'GOI_Y'), ('NQ_80', 'TU_KHOA', 'bản sắc văn hóa', 'GOI_Y'),
  ('NQ_80', 'TU_KHOA', 'thiết chế văn hóa', 'GOI_Y'), ('NQ_80', 'LINH_VUC', 'LV10_VAN_HOA', 'GOI_Y'),
  -- Chỉ tiêu chủ yếu (gợi ý)
  ('CHT_GRDP', 'TU_KHOA', 'GRDP', 'GOI_Y'), ('CHT_GRDP', 'TU_KHOA', 'tăng trưởng kinh tế', 'GOI_Y'), ('CHT_GRDP', 'TU_KHOA', 'tốc độ tăng trưởng', 'GOI_Y'),
  ('CHT_GRDP_DAU_NGUOI', 'TU_KHOA', 'GRDP bình quân đầu người', 'GOI_Y'), ('CHT_GRDP_DAU_NGUOI', 'TU_KHOA', 'thu nhập bình quân đầu người', 'GOI_Y'),
  ('CHT_THU_NGAN_SACH', 'TU_KHOA', 'thu ngân sách', 'GOI_Y'), ('CHT_THU_NGAN_SACH', 'TU_KHOA', 'chống thất thu', 'GOI_Y'),
  ('CHT_THU_NGAN_SACH', 'LINH_VUC', 'LV08_NGAN_SACH', 'GOI_Y'),
  ('CHT_KINH_TE_SO', 'TU_KHOA', 'kinh tế số', 'GOI_Y'), ('CHT_KINH_TE_SO', 'TU_KHOA', 'thương mại điện tử', 'GOI_Y'),
  ('CHT_HO_NGHEO', 'TU_KHOA', 'giảm nghèo', 'GOI_Y'), ('CHT_HO_NGHEO', 'TU_KHOA', 'hộ nghèo', 'GOI_Y'), ('CHT_HO_NGHEO', 'TU_KHOA', 'nghèo đa chiều', 'GOI_Y'),
  ('CHT_NONG_THON_MOI', 'TU_KHOA', 'nông thôn mới', 'GOI_Y'),
  ('CHT_DICH_VU_CONG', 'TU_KHOA', 'dịch vụ công trực tuyến', 'GOI_Y'), ('CHT_DICH_VU_CONG', 'TU_KHOA', 'thủ tục hành chính', 'GOI_Y'),
  ('CHT_DICH_VU_CONG', 'TU_KHOA', 'cải cách hành chính', 'GOI_Y'),
  ('CHT_TO_CHUC_DANG', 'TU_KHOA', 'tổ chức cơ sở đảng', 'GOI_Y'), ('CHT_TO_CHUC_DANG', 'TU_KHOA', 'đánh giá, xếp loại tổ chức đảng', 'GOI_Y'),
  ('CHT_KET_NAP_DANG', 'TU_KHOA', 'kết nạp đảng viên', 'GOI_Y'), ('CHT_KET_NAP_DANG', 'TU_KHOA', 'phát triển đảng viên', 'GOI_Y')
) AS x(ma, loai, gia_tri, muc)
WHERE EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d WHERE d."ma" = x.ma)
  AND (x.loai <> 'LINH_VUC' OR EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" l WHERE l."ma" = x.gia_tri))
ON CONFLICT ("muc_tieu_ma", "loai", "gia_tri_chuan") DO NOTHING;
