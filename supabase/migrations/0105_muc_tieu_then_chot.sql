-- 0105 (v3.24, chủ dự án duyệt 16/10/2026 — Tổng quan cho lãnh đạo theo nhiệm vụ chính trị, câu 2–4 của đề xuất): khối lĩnh vực, mục tiêu then chốt.
-- 1. dm_khoi_linh_vuc: 5 khối như bố cục báo cáo; dm_nganh.khoi_ma gom 12 ngành — Xây dựng Đảng và hệ thống chính trị: 2, 4, 7, 11; Kinh tế: 5, 6, 8,
--    9; Văn hóa – xã hội, khoa học công nghệ, chuyển đổi số: 10; Quốc phòng – an ninh, nội chính, tư pháp: 3; Tham mưu tổng hợp, công tác Văn phòng: 1, 12.
-- 2. dm_muc_tieu: danh mục mục tiêu then chốt TẠM (chủ dự án gửi văn bản gốc sau — đối chiếu bằng migration mới): 3 nội dung đột phá, 3 chương
--    trình trọng tâm (Nghị quyết Đại hội XX Đảng bộ tỉnh, nhiệm kỳ 2025–2030), 10 nghị quyết Trung ương, 9 chỉ tiêu chủ yếu. Không ghi số hiệu văn
--    bản cụ thể hóa của Tỉnh ủy (chưa đối chiếu) — Tổng quan ghép từ văn bản của các việc đã gắn.
-- 3. Gắn mục tiêu: nhiem_vu_muc_tieu (riêng từng việc) và van_ban_muc_tieu (mặc định của văn bản: việc CHƯA gắn riêng tính theo văn bản). Đọc theo
--    RLS như lich_su / van_ban_giao_viec; không ai ghi thẳng bảng — chỉ qua hàm:
--    - gan_muc_tieu(p_id, p_ma[]): tầng giao (kl_la_tang_giao: người giao, người nhập, nhóm thay mặt, lãnh đạo cấp cao hơn người giao, toàn quyền)
--      hoặc lãnh đạo Văn phòng / Trưởng phòng trong phạm vi; cả việc đã hoàn thành (chỉ là phân loại); mảng rỗng = bỏ gắn riêng (về mặc định
--      của văn bản); tối đa 10 mục tiêu; lịch sử 'gan_muc_tieu' (diễn biến).
--    - gan_muc_tieu_van_ban(p_van_ban, p_ma[]): người nhập văn bản (còn thấy văn bản), Chánh VP / toàn quyền, hoặc lãnh đạo A1 / A2 thấy MỌI việc
--      của văn bản; lịch sử ở từng việc chưa gắn riêng (mục tiêu của việc đó đổi theo). Thường trực không gắn (không thao tác hệ thống).
-- 4. kl_danh_muc thêm 'khoi', 'mucTieu' và nganh.khoi_ma (frontend nhớ danh mục 30 phút — đổi khoá nhớ để nạp bản mới).
-- Nhập Excel và kết quả chỉ tiêu (bước C): 0106.

-- ---- 1 ----
CREATE TABLE "public"."dm_khoi_linh_vuc" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_khoi_linh_vuc" ("ma", "ten", "thu_tu") VALUES
  ('XAY_DUNG_DANG', 'Xây dựng Đảng và hệ thống chính trị', 1),
  ('KINH_TE', 'Kinh tế', 2),
  ('VAN_HOA_XA_HOI', 'Văn hóa – xã hội, khoa học công nghệ, chuyển đổi số', 3),
  ('QUOC_PHONG_AN_NINH', 'Quốc phòng – an ninh, nội chính, tư pháp', 4),
  ('THAM_MUU_VAN_PHONG', 'Tham mưu tổng hợp, công tác Văn phòng', 5);
ALTER TABLE "public"."dm_nganh" ADD COLUMN "khoi_ma" text REFERENCES "public"."dm_khoi_linh_vuc"("ma");
UPDATE "public"."dm_nganh" n SET "khoi_ma" = m."khoi" FROM (VALUES
  ('THAM_MUU_TONG_HOP', 'THAM_MUU_VAN_PHONG'), ('TUYEN_GIAO', 'XAY_DUNG_DANG'), ('NOI_CHINH', 'QUOC_PHONG_AN_NINH'),
  ('TO_CHUC_XAY_DUNG_DANG', 'XAY_DUNG_DANG'), ('CONG_NGHIEP_NANG_LUONG', 'KINH_TE'), ('NONG_NGHIEP_MOI_TRUONG', 'KINH_TE'),
  ('MTTQ_DOAN_THE', 'XAY_DUNG_DANG'), ('KINH_TE_TONG_HOP', 'KINH_TE'), ('XAY_DUNG_GIAO_THONG', 'KINH_TE'),
  ('VAN_HOA_XA_HOI', 'VAN_HOA_XA_HOI'), ('HOI_DONG_NHAN_DAN', 'XAY_DUNG_DANG'), ('VAN_PHONG_TINH_UY', 'THAM_MUU_VAN_PHONG')
) AS m("nganh", "khoi") WHERE n."ma" = m."nganh";
ALTER TABLE "public"."dm_khoi_linh_vuc" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_khoi_linh_vuc" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_khoi_linh_vuc" TO "authenticated";
CREATE POLICY "dm_khoi_linh_vuc_select" ON "public"."dm_khoi_linh_vuc" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- ---- 2 ----
CREATE TABLE "public"."dm_muc_tieu" (
  "ma" text PRIMARY KEY CONSTRAINT "dm_muc_tieu_ma_check" CHECK ("ma" ~ '^[A-Z0-9_]{2,40}$'),
  "nhom" text NOT NULL CONSTRAINT "dm_muc_tieu_nhom_check" CHECK ("nhom" IN ('DOT_PHA', 'CHUONG_TRINH', 'NQ_TW', 'CHI_TIEU')),
  "ten" text NOT NULL CONSTRAINT "dm_muc_tieu_ten_check" CHECK (btrim("ten") <> '' AND char_length("ten") <= 300),
  "ten_ngan" text NOT NULL CONSTRAINT "dm_muc_tieu_ten_ngan_check" CHECK (btrim("ten_ngan") <> '' AND char_length("ten_ngan") <= 120),
  "mo_ta" text CONSTRAINT "dm_muc_tieu_mo_ta_check" CHECK (char_length("mo_ta") <= 300),          -- nghị quyết: nội dung; chỉ tiêu: lĩnh vực
  "can_cu" text CONSTRAINT "dm_muc_tieu_can_cu_check" CHECK (char_length("can_cu") <= 300),       -- căn cứ (chưa ghi số hiệu cho tới khi đối chiếu)
  "chi_tieu" text CONSTRAINT "dm_muc_tieu_chi_tieu_check" CHECK (char_length("chi_tieu") <= 200), -- chỉ tiêu chủ yếu: mục tiêu đến năm 2030
  "thu_tu" integer NOT NULL,
  "dang_dung" boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE "public"."dm_muc_tieu" IS '0105: mục tiêu then chốt — danh mục TẠM theo tin bài về Nghị quyết Đại hội XX Đảng bộ tỉnh; đối chiếu văn bản gốc bằng migration mới.';
INSERT INTO "public"."dm_muc_tieu" ("ma", "nhom", "ten", "ten_ngan", "mo_ta", "can_cu", "chi_tieu", "thu_tu") VALUES
  ('DP_CAN_BO', 'DOT_PHA', 'Nâng cao chất lượng đội ngũ cán bộ lãnh đạo, quản lý và nguồn nhân lực chất lượng cao', 'Đột phá cán bộ, nguồn nhân lực', NULL, 'Nghị quyết Đại hội XX Đảng bộ tỉnh — nội dung đột phá', NULL, 1),
  ('DP_HA_TANG', 'DOT_PHA', 'Phát triển kết cấu hạ tầng giao thông, đô thị và môi trường', 'Đột phá hạ tầng giao thông, đô thị, môi trường', NULL, 'Nghị quyết Đại hội XX Đảng bộ tỉnh — nội dung đột phá', NULL, 2),
  ('DP_KHCN_CDS', 'DOT_PHA', 'Thúc đẩy khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số', 'Đột phá khoa học, công nghệ, đổi mới sáng tạo, chuyển đổi số', NULL, 'Nghị quyết Đại hội XX Đảng bộ tỉnh — nội dung đột phá', NULL, 3),
  ('CTR_DU_LICH', 'CHUONG_TRINH', 'Phát triển du lịch bền vững, hạt nhân là Công viên địa chất toàn cầu UNESCO Non nước Cao Bằng và thác Bản Giốc', 'Du lịch bền vững', NULL, 'Chương trình trọng tâm của Tỉnh ủy, giai đoạn 2025–2030', NULL, 11),
  ('CTR_KINH_TE_RUNG', 'CHUONG_TRINH', 'Bảo vệ và khai thác hiệu quả kinh tế rừng', 'Kinh tế rừng', NULL, 'Chương trình trọng tâm của Tỉnh ủy, giai đoạn 2025–2030', NULL, 12),
  ('CTR_CUA_KHAU', 'CHUONG_TRINH', 'Phát triển kinh tế cửa khẩu', 'Kinh tế cửa khẩu', NULL, 'Chương trình trọng tâm của Tỉnh ủy, giai đoạn 2025–2030', NULL, 13),
  ('NQ_DH_XIV', 'NQ_TW', 'Nghị quyết Đại hội đại biểu toàn quốc lần thứ XIV của Đảng', 'Nghị quyết Đại hội XIV', 'Mục tiêu, nhiệm vụ trọng tâm, đột phá chiến lược 2026–2030', NULL, NULL, 21),
  ('NQ_57', 'NQ_TW', 'Nghị quyết số 57-NQ/TW', 'Nghị quyết 57-NQ/TW', 'Đột phá phát triển khoa học, công nghệ, đổi mới sáng tạo và chuyển đổi số quốc gia', NULL, NULL, 22),
  ('NQ_59', 'NQ_TW', 'Nghị quyết số 59-NQ/TW', 'Nghị quyết 59-NQ/TW', 'Hội nhập quốc tế trong tình hình mới', NULL, NULL, 23),
  ('NQ_66', 'NQ_TW', 'Nghị quyết số 66-NQ/TW', 'Nghị quyết 66-NQ/TW', 'Đổi mới công tác xây dựng và thi hành pháp luật', NULL, NULL, 24),
  ('NQ_68', 'NQ_TW', 'Nghị quyết số 68-NQ/TW', 'Nghị quyết 68-NQ/TW', 'Phát triển kinh tế tư nhân', NULL, NULL, 25),
  ('NQ_70', 'NQ_TW', 'Nghị quyết số 70-NQ/TW', 'Nghị quyết 70-NQ/TW', 'Bảo đảm an ninh năng lượng quốc gia', NULL, NULL, 26),
  ('NQ_71', 'NQ_TW', 'Nghị quyết số 71-NQ/TW', 'Nghị quyết 71-NQ/TW', 'Đột phá phát triển giáo dục và đào tạo', NULL, NULL, 27),
  ('NQ_72', 'NQ_TW', 'Nghị quyết số 72-NQ/TW', 'Nghị quyết 72-NQ/TW', 'Bảo vệ, chăm sóc và nâng cao sức khỏe Nhân dân', NULL, NULL, 28),
  ('NQ_79', 'NQ_TW', 'Nghị quyết số 79-NQ/TW', 'Nghị quyết 79-NQ/TW', 'Phát triển kinh tế nhà nước', NULL, NULL, 29),
  ('NQ_80', 'NQ_TW', 'Nghị quyết số 80-NQ/TW', 'Nghị quyết 80-NQ/TW', 'Phát triển văn hóa Việt Nam', NULL, NULL, 30),
  ('CHT_GRDP', 'CHI_TIEU', 'Tốc độ tăng trưởng tổng sản phẩm trên địa bàn (GRDP) bình quân', 'Tăng trưởng GRDP bình quân', 'Kinh tế', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', '≥ 10%/năm', 41),
  ('CHT_GRDP_DAU_NGUOI', 'CHI_TIEU', 'GRDP bình quân đầu người', 'GRDP bình quân đầu người', 'Kinh tế', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', '75–80 triệu đồng', 42),
  ('CHT_THU_NGAN_SACH', 'CHI_TIEU', 'Thu ngân sách nhà nước trên địa bàn', 'Thu ngân sách trên địa bàn', 'Kinh tế', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'tăng bình quân 12%/năm', 43),
  ('CHT_KINH_TE_SO', 'CHI_TIEU', 'Tỷ trọng kinh tế số trong GRDP', 'Kinh tế số', 'Kinh tế', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'tối thiểu 20% GRDP', 44),
  ('CHT_HO_NGHEO', 'CHI_TIEU', 'Giảm tỷ lệ hộ nghèo đa chiều', 'Giảm tỷ lệ hộ nghèo', 'Văn hóa – xã hội', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'trên 3%/năm', 45),
  ('CHT_NONG_THON_MOI', 'CHI_TIEU', 'Tỷ lệ xã đạt chuẩn nông thôn mới', 'Xã đạt chuẩn nông thôn mới', 'Văn hóa – xã hội', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'trên 35,84% số xã', 46),
  ('CHT_DICH_VU_CONG', 'CHI_TIEU', 'Tỷ lệ người dân, doanh nghiệp sử dụng dịch vụ công trực tuyến', 'Dịch vụ công trực tuyến', 'Cải cách hành chính', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'trên 90%', 47),
  ('CHT_TO_CHUC_DANG', 'CHI_TIEU', 'Tỷ lệ tổ chức đảng hoàn thành tốt nhiệm vụ trở lên', 'Tổ chức đảng hoàn thành tốt nhiệm vụ', 'Xây dựng Đảng', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', 'từ 80% trở lên mỗi năm', 48),
  ('CHT_KET_NAP_DANG', 'CHI_TIEU', 'Kết nạp đảng viên mới', 'Kết nạp đảng viên mới', 'Xây dựng Đảng', 'Nghị quyết Đại hội XX Đảng bộ tỉnh — chỉ tiêu chủ yếu', '1.500–1.600 đảng viên/năm', 49);
ALTER TABLE "public"."dm_muc_tieu" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_muc_tieu" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_muc_tieu" TO "authenticated";
CREATE POLICY "dm_muc_tieu_select" ON "public"."dm_muc_tieu" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- ---- 3 ----
CREATE TABLE "public"."nhiem_vu_muc_tieu" (
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "muc_tieu_ma" text NOT NULL REFERENCES "public"."dm_muc_tieu"("ma"),
  "gan_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "gan_luc" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("nhiem_vu_id", "muc_tieu_ma")
);
CREATE INDEX "nhiem_vu_muc_tieu_ma_idx" ON "public"."nhiem_vu_muc_tieu" ("muc_tieu_ma");
CREATE TABLE "public"."van_ban_muc_tieu" (
  "van_ban_id" uuid NOT NULL REFERENCES "public"."van_ban_giao_viec"("id") ON DELETE CASCADE,
  "muc_tieu_ma" text NOT NULL REFERENCES "public"."dm_muc_tieu"("ma"),
  "gan_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "gan_luc" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("van_ban_id", "muc_tieu_ma")
);
CREATE INDEX "van_ban_muc_tieu_ma_idx" ON "public"."van_ban_muc_tieu" ("muc_tieu_ma");
COMMENT ON TABLE "public"."nhiem_vu_muc_tieu" IS '0105: mục tiêu then chốt gắn riêng một việc (thay mặc định của văn bản); chỉ ghi qua gan_muc_tieu.';
COMMENT ON TABLE "public"."van_ban_muc_tieu" IS '0105: mục tiêu then chốt mặc định của văn bản — áp cho việc chưa gắn riêng; chỉ ghi qua gan_muc_tieu_van_ban.';
ALTER TABLE "public"."nhiem_vu_muc_tieu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."van_ban_muc_tieu" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."nhiem_vu_muc_tieu", "public"."van_ban_muc_tieu" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."nhiem_vu_muc_tieu", "public"."van_ban_muc_tieu" TO "authenticated";
CREATE POLICY "nhiem_vu_muc_tieu_select" ON "public"."nhiem_vu_muc_tieu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));   -- như lich_su (0049)
CREATE POLICY "van_ban_muc_tieu_select" ON "public"."van_ban_muc_tieu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"()) OR "van_ban_id" IN (SELECT "public"."kl_van_ban_thay_duoc"()));   -- như van_ban_giao_viec (0049)

-- Tên ngắn của các mã (lịch sử, thông báo) và chuẩn hoá mảng mã: bỏ trống / trùng, sắp xếp; tối đa 10; mã phải có trong danh mục và đang dùng (mã
-- ngừng dùng vẫn giữ được nếu việc / văn bản đang có).
CREATE FUNCTION "public"."kl_ten_muc_tieu"("p_ma" text[]) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT string_agg(d."ten_ngan", '; ' ORDER BY d."thu_tu") FROM "public"."dm_muc_tieu" d WHERE d."ma" = ANY ("p_ma");
$$;
CREATE FUNCTION "public"."kl_chuan_muc_tieu"("p_ma" text[], "p_cu" text[]) RETURNS text[]
LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT btrim(x) ORDER BY btrim(x)), '{}'::text[]) INTO v
  FROM unnest(coalesce("p_ma", '{}'::text[])) x WHERE nullif(btrim(x), '') IS NOT NULL;
  IF cardinality(v) > 10 THEN RAISE EXCEPTION 'Gắn tối đa 10 mục tiêu then chốt.' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(v) x WHERE NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" d
             WHERE d."ma" = x AND (d."dang_dung" OR x = ANY (coalesce("p_cu", '{}'::text[]))))) THEN
    RAISE EXCEPTION 'Mục tiêu then chốt không có trong danh mục.' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

CREATE FUNCTION "public"."gan_muc_tieu"("p_id" uuid, "p_ma" text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_me uuid := "auth"."uid"(); v_cu text[]; v_moi text[];
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR v_me IS NULL OR NOT (coalesce("public"."kl_la_tang_giao"(v), false)
       OR (coalesce("public"."me_role"() IN ('A1', 'A2'), false) AND coalesce("public"."kl_lanh_dao_pham_vi"(v."id"), false))) THEN
    RAISE EXCEPTION 'Chỉ người giao việc, người nhập việc hoặc lãnh đạo phụ trách mới gắn mục tiêu then chốt.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg("muc_tieu_ma" ORDER BY "muc_tieu_ma"), '{}'::text[]) INTO v_cu FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = v."id";
  v_moi := "public"."kl_chuan_muc_tieu"("p_ma", v_cu);
  IF v_moi = v_cu THEN RETURN; END IF;
  DELETE FROM "public"."nhiem_vu_muc_tieu" WHERE "nhiem_vu_id" = v."id" AND NOT ("muc_tieu_ma" = ANY (v_moi));
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi")
  SELECT v."id", x, v_me FROM unnest(v_moi) x ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me, 'gan_muc_tieu', "public"."kl_ten_muc_tieu"(v_cu),
          CASE WHEN cardinality(v_moi) = 0 THEN 'Bỏ gắn riêng mục tiêu then chốt — tính theo văn bản'
               ELSE 'Gắn mục tiêu then chốt: ' || "public"."kl_ten_muc_tieu"(v_moi) END, 'app');
END;
$$;

-- Trả số việc của văn bản đổi mục tiêu theo (việc chưa gắn riêng).
CREATE FUNCTION "public"."gan_muc_tieu_van_ban"("p_van_ban" uuid, "p_ma" text[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."van_ban_giao_viec"; v_me uuid := "auth"."uid"(); v_vai text := coalesce("public"."me_role"(), 'A0'); v_cu text[]; v_moi text[]; v_n integer := 0;
        v_duoc boolean;
BEGIN
  SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "id" = "p_van_ban" FOR UPDATE;
  -- Mọi nhánh quy về true / false (coalesce): NULL trong IF bị coi là "không chặn".
  v_duoc := v."id" IS NOT NULL AND v_me IS NOT NULL AND v_vai <> 'A0'
    AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v_me AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false))
    AND (coalesce("public"."me_is_chief"(), false)
         OR (coalesce(v."tao_boi" = v_me, false) AND coalesce(v."id" IN (SELECT "public"."kl_van_ban_thay_duoc"()), false))
         OR (v_vai IN ('A1', 'A2') AND EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id")
             AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = v."id" AND NOT coalesce("public"."kl_thay_nhiem_vu"(n."id"), false))));
  IF NOT coalesce(v_duoc, false) THEN
    RAISE EXCEPTION 'Chỉ người nhập văn bản, Chánh Văn phòng hoặc lãnh đạo phụ trách mọi nhiệm vụ của văn bản mới gắn mục tiêu cho văn bản.' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(array_agg("muc_tieu_ma" ORDER BY "muc_tieu_ma"), '{}'::text[]) INTO v_cu FROM "public"."van_ban_muc_tieu" WHERE "van_ban_id" = v."id";
  v_moi := "public"."kl_chuan_muc_tieu"("p_ma", v_cu);
  IF v_moi = v_cu THEN RETURN 0; END IF;
  DELETE FROM "public"."van_ban_muc_tieu" WHERE "van_ban_id" = v."id" AND NOT ("muc_tieu_ma" = ANY (v_moi));
  INSERT INTO "public"."van_ban_muc_tieu" ("van_ban_id", "muc_tieu_ma", "gan_boi")
  SELECT v."id", x, v_me FROM unnest(v_moi) x ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  SELECT n."id", v_me, 'gan_muc_tieu', "public"."kl_ten_muc_tieu"(v_cu),
         format('Văn bản %s %s', coalesce(v."so_ket_luan", ''), CASE WHEN cardinality(v_moi) = 0 THEN 'bỏ mục tiêu then chốt'
           ELSE 'gắn mục tiêu then chốt: ' || "public"."kl_ten_muc_tieu"(v_moi) END), 'app'
  FROM "public"."nhiem_vu" n
  WHERE n."van_ban_id" = v."id" AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n."id");
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ten_muc_tieu"(text[]), "public"."kl_chuan_muc_tieu"(text[], text[]) FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."gan_muc_tieu"(uuid, text[]), "public"."gan_muc_tieu_van_ban"(uuid, text[]) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."gan_muc_tieu"(uuid, text[]), "public"."gan_muc_tieu_van_ban"(uuid, text[]) TO "authenticated";

-- ---- 4 ---- (bản 0067 + nganh.khoi_ma, khoi, mucTieu)
CREATE OR REPLACE FUNCTION "public"."kl_danh_muc"() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nganh', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "khoi_ma" FROM "public"."dm_nganh") x),
    'linhVuc', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "nganh_ma", "ten", "thu_tu" FROM "public"."dm_linh_vuc") x),
    'donVi', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "trong_van_phong", "phong" FROM "public"."dm_don_vi") x),
    'sanPham', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_san_pham") x),
    'cap', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_cap") x),
    'loaiThoiHan', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han") x),
    'tienDo', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_tien_do") x),
    'nguonNhiemVu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu", "dang_dung" FROM "public"."dm_nguon_nhiem_vu") x),
    'khoi', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "ten", "thu_tu" FROM "public"."dm_khoi_linh_vuc") x),
    'mucTieu', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."thu_tu"), '[]') FROM (SELECT "ma", "nhom", "ten", "ten_ngan", "mo_ta", "can_cu", "chi_tieu", "thu_tu", "dang_dung" FROM "public"."dm_muc_tieu") x),
    'cauHinh', (SELECT coalesce(jsonb_object_agg("khoa", "gia_tri"), '{}') FROM "public"."kl_cau_hinh"));
$$;
REVOKE ALL ON FUNCTION "public"."kl_danh_muc"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_danh_muc"() TO "authenticated";
