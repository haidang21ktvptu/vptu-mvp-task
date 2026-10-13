-- 0100 (v3.22, chủ dự án quyết 13/10/2026): tài khoản TOÀN QUYỀN — theo dõi và giao việc ở mức cao nhất của Văn phòng (như Chánh Văn phòng) để
-- nhập, giao việc và quản trị toàn bộ ứng dụng. Chỉ bật cho qt_vptu (mục 6); KHÔNG cấp được qua giao diện, admin_dat_co hay Edge Function
-- (chỉ bằng migration). Toàn quyền = Chánh VP ở mọi kiểm tra quyền của NGƯỜI GỌI; vai thật (role_group, is_chief) giữ nguyên nên mọi câu hỏi
-- "ai là Chánh VP / Trưởng phòng / người nhận" (đọc accounts.is_chief trực tiếp) không đổi — tài khoản này không nhận chỉ đạo Thường trực, không
-- vào nhóm Lãnh đạo Văn phòng, không là người được nhắc duyệt. Thường trực (A0) không bao giờ là toàn quyền. Không đổi dữ liệu nghiệp vụ cũ.
-- 1. accounts.toan_quyen (mặc định false) + accounts_public; me_toan_quyen().
-- 2. me_role() = 'A1', me_is_chief() = true cho tài khoản toàn quyền ⇒ kl_pham_vi, kl_xem_tat_ca, kl_duoc_chi_dao, kl_lanh_dao_pham_vi… như Chánh VP.
-- 3. kl_duoc_giao_cho_phong: mọi phòng (kl_pham_vi_giao, giao lại); kl_nhiem_vu_thay_duoc, kl_tu_choi_thay_duoc (RLS tu_choi), kl_so_chua_xu_ly
--    (số "Cần xử lý"): "me" như Chánh VP — khớp kl_tham_chieu_pham_vi. Policy accounts_update_a1 theo vai THẬT (me_vai_that): tài khoản toàn quyền
--    sửa hồ sơ cán bộ qua Quản trị (admin_sua_tai_khoan, có nhật ký), không ghi thẳng bảng accounts.
-- 4. kl_la_tang_giao: sửa thông tin giao của mọi việc. kl_cap_bac: việc tài khoản toàn quyền giao có người giao cấp 2 (như Phó Chánh VP) ⇒ Chánh VP
--    thật và Thường trực sửa được thông tin giao; Phó Chánh VP, Trưởng phòng (thường là người chủ trì) thì không — dùng Gia hạn / Đề nghị sửa.
-- 5. kl_toi_hieu_dung(): hồ sơ người gọi sau khi áp toàn quyền — giao_viec (0101), kl_nhap_da_xong, chi_dao_gui (0102) đọc thay cho accounts.
-- 6. Bật cho qt_vptu (nếu có; không phải Thường trực / tài khoản hệ thống); ghi quyen_lich_su + nhật ký hệ thống.

-- ---- 1 ----
ALTER TABLE "public"."accounts" ADD COLUMN "toan_quyen" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN "public"."accounts"."toan_quyen" IS
  'v3.22 (0100): tài khoản toàn quyền — như Chánh Văn phòng ở mọi kiểm tra quyền của người gọi; chỉ đặt bằng migration (qt_vptu).';
GRANT SELECT ("toan_quyen") ON "public"."accounts" TO "authenticated";   -- accounts_public là security_invoker: cột mới phải có grant cột (0041)

CREATE OR REPLACE VIEW "public"."accounts_public" WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title", "created_at", "manager_id", "department", "must_change_password",
       "is_chief", "is_system",
       ("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"())) AS "quan_tri_kl",
       "quan_tri_he_thong", "dien_thoai", "anh_url", "tuy_chon", "quan_tri_kl_het_han", "bi_khoa", "thu_ky_thuong_truc", "toan_quyen"
FROM "public"."accounts";

CREATE FUNCTION "public"."me_toan_quyen"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "toan_quyen" AND "role_group" <> 'A0' FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;
REVOKE ALL ON FUNCTION "public"."me_toan_quyen"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."me_toan_quyen"() TO "authenticated";

-- ---- 2 ---- (bản 0007; thêm nhánh toàn quyền)
CREATE OR REPLACE FUNCTION "public"."me_role"() RETURNS "text"
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT CASE WHEN "toan_quyen" AND "role_group" <> 'A0' THEN 'A1' ELSE "role_group" END FROM "public"."accounts" WHERE "id" = "auth"."uid"();
$$;
CREATE OR REPLACE FUNCTION "public"."me_is_chief"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT ("is_chief" AND "role_group" = 'A1') OR ("toan_quyen" AND "role_group" <> 'A0')
                   FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

-- ---- 3 ---- (bản 0096 nguyên văn + nhánh toàn quyền)
CREATE OR REPLACE FUNCTION "public"."kl_duoc_giao_cho_phong"("p_nguoi" uuid, "p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text, "p_thay_mat" uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN "p_thay_mat" IS NOT NULL THEN a."role_group" = 'A3' AND CASE   -- 0096: mọi chuyên viên nhập thay mặt (trước đây chỉ quan_tri_kl)
          WHEN tm."id" IS NULL OR tm."is_system" THEN false
          WHEN tm."role_group" = 'A2' THEN tm."department" = "p_phong"
          WHEN tm."role_group" = 'A1' AND tm."is_chief" THEN true
          WHEN tm."role_group" = 'A1' THEN "p_phong" IS NULL OR "public"."kl_pham_vi_pcvp_cua"(tm."id", "p_phong", "p_nganh_ma", "p_linh_vuc_ma")
          WHEN tm."role_group" = 'A0' THEN "p_phong" IS NOT NULL   -- 0079: thay mặt Thường trực → mọi phòng của Văn phòng
          ELSE false END
      WHEN a."toan_quyen" AND a."role_group" <> 'A0' THEN true   -- 0100: tài khoản toàn quyền — mọi phòng, như Chánh VP
      WHEN q."qtkl" AND a."role_group" IN ('A1', 'A2') THEN true
      WHEN a."role_group" = 'A1' AND a."is_chief" THEN true
      WHEN a."role_group" = 'A1' THEN "p_phong" IS NOT NULL AND "public"."kl_pham_vi_pcvp_cua"(a."id", "p_phong", "p_nganh_ma", "p_linh_vuc_ma")
      WHEN a."role_group" = 'A2' THEN a."department" = "p_phong"
      ELSE false END
    FROM "public"."accounts" a LEFT JOIN "public"."accounts" tm ON tm."id" = "p_thay_mat"
    CROSS JOIN LATERAL (SELECT a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()) AS "qtkl") q   -- = me_quan_tri_kl()
    WHERE a."id" = "p_nguoi" AND NOT a."is_system"), false);
$$;
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_thay_duoc"("p_ca_thu_ky" boolean DEFAULT true) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 300 AS $$
  WITH me AS (
    SELECT a."id", CASE WHEN a."toan_quyen" AND a."role_group" <> 'A0' THEN 'A1' ELSE a."role_group" END AS "role_group", a."department",   -- 0100
           coalesce((a."is_chief" AND a."role_group" = 'A1') OR (a."toan_quyen" AND a."role_group" <> 'A0'), false) AS chief,   -- 0100: toàn quyền = Chánh VP
           coalesce(a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false) AS qtkl,
           coalesce(a."thu_ky_thuong_truc", false) AS thu_ky
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  ), ca_phong AS (   -- phu_trach(tôi, phòng, hôm nay) cho A1 không phải Chánh VP: phân công cả phòng (nganh_ma NULL) đang hiệu lực
    SELECT p."phong" FROM "public"."phu_trach_phong" p
    WHERE p."lanh_dao_id" = "auth"."uid"() AND p."nganh_ma" IS NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), kn AS (         -- nguoi_kiem_nhiem(phòng, ngành, lĩnh vực, hôm nay) của MỌI người
    SELECT p."phong", p."nganh_ma", p."linh_vuc_ma", p."lanh_dao_id" FROM "public"."phu_trach_phong" p
    WHERE p."nganh_ma" IS NOT NULL AND p."linh_vuc_ma" IS NOT NULL AND p."lanh_dao_id" IS NOT NULL
      AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"())
  ), nv AS (
    SELECT n."id", n."nguoi_theo_doi", n."owner_tai_khoan", n."nganh_ma", n."linh_vuc_ma",
           td."department" AS phong_theo_doi, coalesce(oa."department", dv."phong") AS phong_owner   -- kl_phong_owner
    FROM "public"."nhiem_vu" n
    LEFT JOIN "public"."accounts" td ON td."id" = n."nguoi_theo_doi"
    LEFT JOIN "public"."accounts" oa ON oa."id" = n."owner_tai_khoan"
    LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = n."owner_don_vi_ma"
  )
  -- Ba nhánh UNION ALL (IN không cần khử trùng). Nhánh 1: người theo dõi / Owner — tra index, đủ cho A3 thường (đa số tài khoản; kiểm RLS
  -- của Realtime mỗi thay đổi chạy cho từng người). Nhánh 2, 3 có điều kiện chỉ đọc "me" ⇒ initplan, bị bỏ qua cả nhánh khi vai không cần.
  -- 0086: A3 chỉ vào nhánh 2 khi kl_cau_hinh.pham_vi_chuyen_vien = 2 (chuyên viên xem cả phòng, chỉ xem).
  SELECT n."id" FROM "public"."nhiem_vu" n
  WHERE n."nguoi_theo_doi" = "auth"."uid"() OR n."owner_tai_khoan" = "auth"."uid"() OR n."tao_boi" = "auth"."uid"()   -- 0096: người nhập xem lại việc mình nhập
  UNION ALL
  SELECT nv."id"
  FROM nv
  CROSS JOIN me
  LEFT JOIN kn k1 ON k1."phong" = nv.phong_theo_doi AND k1."nganh_ma" = nv."nganh_ma" AND k1."linh_vuc_ma" = nv."linh_vuc_ma"
  LEFT JOIN kn k2 ON k2."phong" = nv.phong_owner AND k2."nganh_ma" = nv."nganh_ma" AND k2."linh_vuc_ma" = nv."linh_vuc_ma"
  WHERE (SELECT m.qtkl OR m."role_group" IN ('A0', 'A1', 'A2') OR (m."role_group" = 'A3' AND "public"."kl_chuyen_vien_xem_phong"()) FROM me m)   -- 0086
    AND (me.qtkl
      OR CASE me."role_group"
           WHEN 'A0' THEN true
           WHEN 'A1' THEN me.chief
             OR (nv.phong_theo_doi IS NOT NULL AND CASE WHEN k1."lanh_dao_id" IS NOT NULL THEN k1."lanh_dao_id" = "auth"."uid"()
                                                       ELSE nv.phong_theo_doi IN (SELECT c."phong" FROM ca_phong c) END)
             OR (nv.phong_owner IS NOT NULL AND CASE WHEN k2."lanh_dao_id" IS NOT NULL THEN k2."lanh_dao_id" = "auth"."uid"()
                                                    ELSE nv.phong_owner IN (SELECT c."phong" FROM ca_phong c) END)
           WHEN 'A2' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"
           WHEN 'A3' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"   -- 0086: cấu hình 2 — chuyên viên xem cả phòng (quy tắc Trưởng phòng)
           ELSE false END)
  UNION ALL
  SELECT c."nhiem_vu_id" FROM "public"."chi_dao" c   -- thư ký Thường trực (0047): việc có ≥ 1 CHI_DAO_TT
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND c."loai" = 'CHI_DAO_TT'
  UNION ALL
  SELECT n."id" FROM "public"."nhiem_vu" n   -- 0057 (Q8): thư ký thấy việc Thường trực giao cho Chánh VP (A0, hoặc thay mặt Thường trực — 0083) để nghiệm thu thay mặt
  JOIN "public"."accounts" o ON o."id" = n."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief"
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND "public"."kl_viec_a0_giao_cvp"(n);
$$;

-- (bản 0081 nguyên văn, "me" như Chánh VP)
CREATE OR REPLACE FUNCTION "public"."kl_tu_choi_thay_duoc"() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 20 AS $$
  WITH me AS (
    SELECT CASE WHEN a."toan_quyen" AND a."role_group" <> 'A0' THEN 'A1' ELSE a."role_group" END AS "role_group", a."department",   -- 0100
           coalesce((a."is_chief" AND a."role_group" = 'A1') OR (a."toan_quyen" AND a."role_group" <> 'A0'), false) AS chief
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  )
  SELECT t."id" FROM "public"."tu_choi" t
  LEFT JOIN "public"."accounts" dn ON dn."id" = t."nguoi_de_nghi"
  LEFT JOIN me ON true
  WHERE "auth"."uid"() IS NOT NULL AND (
       t."nguoi_de_nghi" = "auth"."uid"() OR t."cap_duyet" = "auth"."uid"()
    OR "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")   -- 0079: thành viên nhóm được thay mặt
    OR CASE me."role_group"
         WHEN 'A0' THEN true
         WHEN 'A1' THEN me.chief OR EXISTS (
           SELECT 1 FROM "public"."phu_trach_phong" p
           WHERE p."lanh_dao_id" = "auth"."uid"() AND p."phong" = dn."department" AND p."nganh_ma" IS NULL
             AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
         WHEN 'A2' THEN dn."department" = me."department"
         ELSE false END);
$$;
CREATE OR REPLACE FUNCTION "public"."kl_so_chua_xu_ly"() RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH me AS (SELECT "id", "role_group", CASE "role_group" WHEN 'A0' THEN ARRAY['THUONG_TRUC', 'BAN_THUONG_VU'] WHEN 'A1' THEN ARRAY['CHANH_VAN_PHONG', 'PHO_CHANH_VAN_PHONG']
                WHEN 'A2' THEN ARRAY['TRUONG_PHONG'] ELSE '{}'::text[] END AS cap,
                "role_group" <> 'A0' AND (coalesce("is_chief" AND "role_group" = 'A1', false) OR coalesce("thu_ky_thuong_truc", false)
                  OR coalesce("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"()), false)) AS nt_rong,
                CASE "role_group" WHEN 'A2' THEN ARRAY["department"]
                  WHEN 'A1' THEN ARRAY(SELECT p."phong" FROM "public"."phu_trach_phong" p WHERE p."lanh_dao_id" = "auth"."uid"()
                                       AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
                  ELSE '{}'::text[] END AS nt_phong
              FROM (SELECT x."id", x."department", x."thu_ky_thuong_truc", x."quan_tri_kl", x."quan_tri_kl_het_han",   -- 0100: toàn quyền = Chánh VP
                           CASE WHEN x."toan_quyen" AND x."role_group" <> 'A0' THEN 'A1' ELSE x."role_group" END AS "role_group",
                           x."is_chief" OR (x."toan_quyen" AND x."role_group" <> 'A0') AS "is_chief"
                    FROM "public"."accounts" x WHERE x."id" = "auth"."uid"()) a),
  mo AS (SELECT n.* FROM "public"."nhiem_vu" n WHERE n."tien_do_ma" <> 'HOAN_THANH' AND n."dong_luc" IS NULL),
  cua_toi AS (SELECT n.* FROM mo n, me WHERE (n."owner_tai_khoan" = me."id" OR n."nguoi_theo_doi" = me."id") AND NOT n."bi_tu_choi" AND n."theo_1400"
              AND NOT EXISTS (SELECT 1 FROM "public"."lich_su" l WHERE l."nhiem_vu_id" = n."id" AND l."cot" = 'xac_nhan_nhan_viec' AND l."nguoi_sua" = me."id")),
  quyet AS (SELECT n."id" FROM mo n, me CROSS JOIN LATERAL "public"."trang_thai_dong"(n::"public"."nhiem_vu", "public"."kl_hom_nay"()) t
            WHERE n."cap_quyet_dinh" = ANY (me.cap) AND NOT n."bi_tu_choi" AND t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') AND NOT t."dang_dinh_chinh"),
  ht_cd AS (SELECT c."id", c."nhiem_vu_id", n."ma", c."noi_dung" FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" n ON n."id" = c."nhiem_vu_id", me
            WHERE c."do_khan" = 'HOA_TOC' AND c."loai" NOT IN ('PHAN_HOI', 'Y_KIEN') AND c."trang_thai" <> 'DA_DONG' AND NOT (me."id" = ANY (c."da_nhan"))
              AND CASE WHEN c."loai" = 'CHI_DAO_TT' THEN me."id" = ANY (c."nguoi_nhan") ELSE me."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") END)
  SELECT jsonb_build_object(
    'nhan_tin', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read"),
    'thong_bao', (SELECT count(*) FROM "public"."direct_messages" d, me WHERE d."receiver_id" = me."id" AND NOT d."is_read" AND d."loai" = 'he_thong'),
    'can_quyet', (SELECT count(*) FROM quyet),
    'de_nghi_cho_duyet', (SELECT count(*) FROM "public"."tu_choi" t, me WHERE t."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")),   -- 0079
    'bi_tu_choi', (SELECT count(*) FROM mo n, me WHERE n."bi_tu_choi" AND (me."role_group" IN ('A0', 'A1', 'A2') OR n."tao_boi" = me."id" OR n."giao_thay_mat_cho" = me."id")),
    'tt_cho_nhan', (SELECT count(*) FROM cua_toi WHERE "uu_tien" = 'THUONG_TRUC'),
    'viec_moi', (SELECT count(*) FROM cua_toi),
    'hoa_toc_viec', (SELECT count(*) FROM cua_toi WHERE "do_khan" = 'HOA_TOC'),
    'hoa_toc_chi_dao', (SELECT count(*) FROM ht_cd),
    'can_nghiem_thu', (SELECT count(*) FROM mo n, me CROSS JOIN LATERAL (
        SELECT m."nop_boi", m."loai", m."hop_le" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = n."id" ORDER BY m."nop_luc" DESC LIMIT 1) mc
      WHERE mc."hop_le" IS NULL AND (mc."loai" IN ('so_hieu', 'tep') OR (mc."loai" = 'chu_cu' AND n."han_nop_minh_chung" IS NOT NULL))
        AND me."role_group" <> 'A0' AND (me.nt_rong OR coalesce(n."giao_thay_mat_cho", n."tao_boi") = me."id"
          OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" IN (n."owner_tai_khoan", n."nguoi_theo_doi") AND a."department" = ANY (me.nt_phong))
          OR EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = n."owner_don_vi_ma" AND d."phong" = ANY (me.nt_phong)))
        AND me."id" = ANY ("public"."nguoi_nghiem_thu_chinh"(n::"public"."nhiem_vu", mc."nop_boi"))),
    'co_vuong_mac', (SELECT count(*) FROM mo n, me WHERE me."role_group" IN ('A1', 'A2') AND n."vuong_mac" IS NOT NULL),
    'de_nghi_sua', (SELECT count(*) FROM "public"."de_nghi_sua" d, me WHERE d."trang_thai" = 'CHO_DUYET'
                    AND "public"."kl_duoc_duyet_thay"(d."nhiem_vu_id", d."cap_duyet")),   -- 0079
    'hoa_toc', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT 'viec' AS loai, "id", "id" AS nhiem_vu_id, "ma", "noi_dung" FROM cua_toi WHERE "do_khan" = 'HOA_TOC'
        UNION ALL SELECT 'chi_dao', "id", "nhiem_vu_id", "ma", "noi_dung" FROM ht_cd) x), '[]'::jsonb));
$$;
CREATE FUNCTION "public"."me_vai_that"() RETURNS "text"
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "role_group" FROM "public"."accounts" WHERE "id" = "auth"."uid"();   -- vai thật (me_role đã áp toàn quyền)
$$;
REVOKE ALL ON FUNCTION "public"."me_vai_that"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."me_vai_that"() TO "authenticated";
ALTER POLICY "accounts_update_a1" ON "public"."accounts"
  USING ((SELECT "public"."me_vai_that"()) = 'A1') WITH CHECK ((SELECT "public"."me_vai_that"()) = 'A1');

-- ---- 4 ---- (bản 0091 nguyên văn + nhánh toàn quyền)
CREATE OR REPLACE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR "public"."me_toan_quyen"()   -- 0100: tài khoản toàn quyền sửa thông tin giao của mọi việc
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system"
               AND (a."id" = "p_nv"."giao_thay_mat_cho" OR (a."id" = "p_nv"."tao_boi" AND "public"."kl_thay_nhiem_vu"("p_nv"."id"))))   -- người tạo còn thấy việc
    OR "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), "p_nv"."giao_thay_mat_nhom", "p_nv"."id")
    OR ("public"."kl_lanh_dao_pham_vi"("p_nv"."id")   -- lãnh đạo trong phạm vi, cấp cao hơn người giao (việc không rõ người giao: mọi lãnh đạo trong phạm vi)
        AND "public"."kl_cap_bac"("auth"."uid"()) > coalesce("public"."kl_cap_bac"(coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")), -1))), false);
$$;
CREATE OR REPLACE FUNCTION "public"."kl_cap_bac"("p_id" uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN a."role_group" = 'A0' THEN 4 WHEN a."toan_quyen" THEN 2   -- 0100: tài khoản toàn quyền là người giao cấp 2 (dưới Chánh VP thật)
              WHEN a."role_group" = 'A1' AND coalesce(a."is_chief", false) THEN 3 WHEN a."role_group" = 'A1' THEN 2
              WHEN a."role_group" = 'A2' THEN 1 ELSE 0 END FROM "public"."accounts" a WHERE a."id" = "p_id";
$$;

-- ---- 5 ----
CREATE FUNCTION "public"."kl_toi_hieu_dung"() RETURNS "public"."accounts"
LANGUAGE "plpgsql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."accounts";
BEGIN
  SELECT * INTO v FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF coalesce(v."toan_quyen", false) AND v."role_group" <> 'A0' THEN v."role_group" := 'A1'; v."is_chief" := true; END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_toi_hieu_dung"() FROM public, "anon", "authenticated";   -- chỉ dùng trong hàm SECURITY DEFINER

-- ---- 6 ----
INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
SELECT NULL, 'migration 0100', a."id", 'toan_quyen', true, 'v3.22: tài khoản toàn quyền để giao việc và quản trị toàn bộ ứng dụng (quyết định 13/10/2026)'
FROM "public"."accounts" a WHERE a."username" = 'qt_vptu' AND NOT a."is_system" AND a."role_group" <> 'A0' AND NOT a."toan_quyen";
INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet")
SELECT NULL, 'cap_co', a."username", jsonb_build_object('co', 'toan_quyen', 'bat', true, 'ly_do', 'v3.22: tài khoản toàn quyền', 'ghi_chu', 'migration 0100')
FROM "public"."accounts" a WHERE a."username" = 'qt_vptu' AND NOT a."is_system" AND a."role_group" <> 'A0' AND NOT a."toan_quyen";
UPDATE "public"."accounts" SET "toan_quyen" = true WHERE "username" = 'qt_vptu' AND NOT "is_system" AND "role_group" <> 'A0';
