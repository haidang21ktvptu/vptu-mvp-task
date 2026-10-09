-- 0096 (Đợt F v3.21, quyết định chủ dự án 9/10/2026 — mọi chuyên viên ngang nhau): bỏ quyền "quản trị nhiệm vụ" (quan_tri_kl); ba việc trước
-- đây của người giữ quyền thành QUYỀN CHUNG của mọi tài khoản trừ Thường trực, có lưu vết; giữ quyền thư ký Thường trực và quản trị hệ thống.
-- 1. kl_nguoi_nhap: nhập Excel — mọi tài khoản đang hoạt động trừ Thường trực / tài khoản hệ thống. Lô và dòng chờ chỉ người nhập (hoặc quản trị
--    hệ thống) đọc / xử lý (kl_lo_cua_toi ở 0095); hồ sơ ghép cột, từ điển dùng chung như cũ.
-- 2. Danh mục lĩnh vực (admin_them_linh_vuc / admin_sua_linh_vuc qua kl_kiem_tra_quan_tri_kl): như mục 1; nhật ký danh mục (dm_lich_su) như mục 1.
-- 3. kl_duoc_giao_cho_phong: mọi chuyên viên nhập thay mặt lãnh đạo (giao_viec 0095).
-- 4. Người nhập xem lại việc mình nhập: kl_nhiem_vu_thay_duoc, kl_tham_chieu_pham_vi, kl_thay_nhiem_vu thêm tao_boi = tôi (chỉ mục mới); quyền ghi
--    theo tầng giao như cũ (người nhập là người giao việc).
-- 5. Đề nghị từ chối / sửa về người nhập việc (kl_nguoi_tao_xu_ly: mọi người nhập đang hoạt động); dự phòng cuối kl_cap_duyet_sua = Chánh VP.
-- 6. Thu cờ quan_tri_kl của mọi tài khoản (ghi quyen_lich_su + nhật ký); admin_dat_co không cấp lại; a2_uy_quyen (ủy quyền giao việc) ngừng.
--    Cột quan_tri_kl giữ (lịch sử, kiểm thử) — me_quan_tri_kl() trả false với mọi tài khoản thật.

-- ---- 1. Nhập Excel ----
CREATE OR REPLACE FUNCTION "public"."kl_nguoi_nhap"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."role_group" <> 'A0' AND NOT coalesce(a."bi_khoa", false)
    AND NOT a."is_system");
$$;
CREATE OR REPLACE FUNCTION "public"."kl_nhap_kiem_quyen"() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT "public"."kl_nguoi_nhap"() THEN
    RAISE EXCEPTION 'Tài khoản này không nhập liệu được (Thường trực, tài khoản hệ thống hoặc đã khoá).' USING ERRCODE = '42501';
  END IF;
END;
$$;
DROP POLICY "lo_nhap_select" ON "public"."lo_nhap";
CREATE POLICY "lo_nhap_select" ON "public"."lo_nhap" FOR SELECT TO "authenticated"   -- lô của tôi / quản trị hệ thống; người thấy việc của lô đọc mã lô (Dữ liệu gốc)
  USING ("tao_boi" = (SELECT "auth"."uid"()) OR (SELECT "public"."me_quan_tri_he_thong"())
         OR EXISTS (SELECT 1 FROM "public"."dong_nhap" d WHERE d."lo_id" = "lo_nhap"."id" AND d."nhiem_vu_id" IS NOT NULL));
DROP POLICY "dong_nhap_select" ON "public"."dong_nhap";
CREATE POLICY "dong_nhap_select" ON "public"."dong_nhap" FOR SELECT TO "authenticated"
  USING ("public"."kl_lo_cua_toi"("lo_id") OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(false)));
CREATE OR REPLACE FUNCTION "public"."dong_nhap_bo"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF EXISTS (SELECT 1 FROM "public"."dong_nhap" d WHERE d."id" = "p_id" AND NOT "public"."kl_lo_cua_toi"(d."lo_id")) THEN   -- 0096: chỉ dòng của lô mình
    RAISE EXCEPTION 'Dòng chờ này thuộc lô nhập của người khác.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."dong_nhap" SET "ket_qua" = 'DA_BO', "xu_ly_boi" = "auth"."uid"(), "xu_ly_luc" = now()
  WHERE "id" = "p_id" AND "ket_qua" = 'CHO_HOAN_THIEN';
  IF NOT FOUND THEN RAISE EXCEPTION 'Dòng này không còn ở vùng chờ hoàn thiện.' USING ERRCODE = '22023'; END IF;
END;
$$;

-- ---- 2. Danh mục lĩnh vực ----
CREATE OR REPLACE FUNCTION "public"."kl_kiem_tra_quan_tri_kl"() RETURNS text
LANGUAGE "plpgsql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF "auth"."uid"() IS NULL AND session_user = 'postgres' THEN RETURN 'qua CLI'; END IF;
  IF "public"."kl_nguoi_nhap"() THEN RETURN NULL; END IF;   -- 0096: quyền chung (lưu vết ở dm_lich_su: người sửa, lý do)
  RAISE EXCEPTION 'Tài khoản này không sửa được danh mục (Thường trực, tài khoản hệ thống hoặc đã khoá).' USING ERRCODE = '42501';
END;
$$;
DROP POLICY "dm_lich_su_select_quan_tri" ON "public"."dm_lich_su";
CREATE POLICY "dm_lich_su_select_quan_tri" ON "public"."dm_lich_su" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_nguoi_nhap"()) OR (SELECT "public"."me_quan_tri_he_thong"()));

-- ---- 3. Thay mặt ----
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
      WHEN q."qtkl" AND a."role_group" IN ('A1', 'A2') THEN true
      WHEN a."role_group" = 'A1' AND a."is_chief" THEN true
      WHEN a."role_group" = 'A1' THEN "p_phong" IS NOT NULL AND "public"."kl_pham_vi_pcvp_cua"(a."id", "p_phong", "p_nganh_ma", "p_linh_vuc_ma")
      WHEN a."role_group" = 'A2' THEN a."department" = "p_phong"
      ELSE false END
    FROM "public"."accounts" a LEFT JOIN "public"."accounts" tm ON tm."id" = "p_thay_mat"
    CROSS JOIN LATERAL (SELECT a."quan_tri_kl" AND (a."quan_tri_kl_het_han" IS NULL OR a."quan_tri_kl_het_han" >= "public"."kl_hom_nay"()) AS "qtkl") q   -- = me_quan_tri_kl()
    WHERE a."id" = "p_nguoi" AND NOT a."is_system"), false);
$$;
-- ---- 4. Người nhập xem lại việc mình nhập ----
CREATE INDEX IF NOT EXISTS "nhiem_vu_tao_boi_idx" ON "public"."nhiem_vu" ("tao_boi");
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_thay_duoc"("p_ca_thu_ky" boolean DEFAULT true) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 300 AS $$
  WITH me AS (
    SELECT a."id", a."role_group", a."department",
           coalesce(a."is_chief" AND a."role_group" = 'A1', false) AS chief,
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
CREATE OR REPLACE FUNCTION "public"."kl_tham_chieu_pham_vi"("p_nguoi" uuid) RETURNS TABLE ("bang" text, "ids" text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF "p_nguoi" IS NULL THEN RAISE EXCEPTION 'Thiếu tài khoản cần đối chiếu.' USING ERRCODE = '22023'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', "p_nguoi", 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', "p_nguoi"::text, true);
  IF "auth"."uid"() IS DISTINCT FROM "p_nguoi" THEN RAISE EXCEPTION 'Không đặt được người cần đối chiếu (auth.uid() khác p_nguoi).' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH nv AS (
    SELECT n.* FROM "public"."nhiem_vu" n
    WHERE "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")
       OR n."tao_boi" = "auth"."uid"()   -- 0096: như kl_nhiem_vu_thay_duoc — người nhập xem lại việc mình nhập
       OR ("public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n)))
  ), goc AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."kl_thay_nhiem_vu"(n."id")),
  tk AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."me_thu_ky_tt"() AND ("public"."thu_ky_tt_thay"(n."id") OR "public"."kl_viec_a0_giao_cvp"(n)))
  SELECT x.b, array_agg(x.i ORDER BY x.i) FROM (
  SELECT 'nhiem_vu', nv."id"::text FROM nv
  UNION ALL SELECT 'v_nhiem_vu', nv."id"::text FROM nv
  UNION ALL SELECT 'v_ngoai_le', nv."id"::text FROM nv CROSS JOIN LATERAL "public"."trang_thai"(nv, "public"."kl_hom_nay"()) t
    WHERE t."muc_canh_bao" IN ('DO', 'DO_DAC_BIET') OR (nv."bi_tu_choi" AND nv."tien_do_ma" <> 'HOAN_THANH')
  UNION ALL SELECT 'van_ban_giao_viec', v."id"::text FROM "public"."van_ban_giao_viec" v
    WHERE "public"."me_quan_tri_kl"() OR EXISTS (SELECT 1 FROM nv WHERE nv."van_ban_id" = v."id")
  UNION ALL SELECT 'lich_su', l."id"::text FROM "public"."lich_su" l WHERE l."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'chi_dao', c."id"::text FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'minh_chung', m."id"::text FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" IN (SELECT "id" FROM goc UNION SELECT "id" FROM tk)
  UNION ALL SELECT 'canh_bao', c."id"::text FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" IN (SELECT "id" FROM goc)
  UNION ALL SELECT 'dinh_chinh', d."id"::text FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" IN (SELECT "id" FROM goc)
  UNION ALL SELECT 'tu_choi', t."id"::text FROM "public"."tu_choi" t WHERE "public"."tu_choi_thay"(t."nguoi_de_nghi", t."cap_duyet")
    OR "public"."kl_duoc_duyet_thay"(t."nhiem_vu_id", t."cap_duyet")   -- 0083: thành viên nhóm được thay mặt trong phạm vi việc
  ) x(b, i) GROUP BY x.b;
END;
$$;
-- Quyền ghi theo việc (nộp thay, tầng giao, chỉ đạo của người giao…) xét "việc tôi thấy" qua kl_thay_nhiem_vu (bản 0025) — thêm người nhập.
CREATE OR REPLACE FUNCTION "public"."kl_thay_nhiem_vu"("p_id" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."id" = "p_id"
                 AND ("public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")
                      OR n."tao_boi" = "auth"."uid"()));   -- 0096: người nhập
$$;
-- ---- 5. Đề nghị về người nhập ----
CREATE OR REPLACE FUNCTION "public"."kl_nguoi_tao_xu_ly"("p_nv" "public"."nhiem_vu") RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a."id" FROM "public"."accounts" a   -- 0096: mọi người nhập đang hoạt động (người nhập luôn thấy việc mình nhập — mục 4)
  WHERE a."id" = ("p_nv")."tao_boi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system";
$$;
CREATE OR REPLACE FUNCTION "public"."kl_cap_duyet_sua"("p_nv" "public"."nhiem_vu", "p_nguoi" uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; i int := 0;
BEGIN
  -- 1. Người tạo việc còn quyền (người nhập / giao — mọi vai, kl_nguoi_tao_xu_ly), rồi người được thay mặt; đang hoạt động, khác người đề nghị.
  v := "public"."kl_nguoi_tao_xu_ly"("p_nv");
  IF v IS NOT NULL AND v <> "p_nguoi" THEN RETURN v; END IF;
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE a."id" = "p_nv"."giao_thay_mat_cho" AND a."id" <> "p_nguoi" AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system";
  IF v IS NOT NULL THEN RETURN v; END IF;
  -- 2. Lãnh đạo trực tiếp (0034); bị khoá thì lên một cấp (tối đa 3 cấp).
  v := "public"."lanh_dao_truc_tiep"("p_nguoi");
  WHILE v IS NOT NULL AND i < 3 AND (v = "p_nguoi" OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND (coalesce(a."bi_khoa", false) OR a."is_system"))) LOOP
    v := "public"."lanh_dao_truc_tiep"(v); i := i + 1;
  END LOOP;
  IF v IS NOT NULL AND v <> "p_nguoi" AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = v AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system") THEN RETURN v; END IF;
  -- 3. 0096: Chánh Văn phòng (trước đây: một quản trị nhiệm vụ — quyền đã bỏ).
  SELECT a."id" INTO v FROM "public"."accounts" a WHERE a."role_group" = 'A1' AND a."is_chief" AND a."id" <> "p_nguoi"
    AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system" ORDER BY a."username" LIMIT 1;
  RETURN v;
END;
$$;
-- ---- 6. Thu cờ quản trị nhiệm vụ ----
CREATE OR REPLACE FUNCTION "public"."admin_dat_co"("p_username" text, "p_co" text, "p_bat" boolean, "p_ly_do" text)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_id uuid;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi"();
  IF "p_co" NOT IN ('quan_tri_kl', 'thu_ky_thuong_truc') THEN
    RAISE EXCEPTION 'Cờ "%" không được cấp qua hàm này.', "p_co" USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do cấp/thu quyền.' USING ERRCODE = '22023';
  END IF;
  IF "p_co" = 'quan_tri_kl' AND "p_bat" THEN   -- 0096 (Đợt F v3.21): quyền quản trị nhiệm vụ đã bỏ — mọi chuyên viên nhập Excel, giao thay mặt, sửa danh mục
    RAISE EXCEPTION 'Quyền quản trị nhiệm vụ đã bỏ từ v3.21: mọi chuyên viên nhập Excel, nhập việc thay mặt lãnh đạo và sửa danh mục lĩnh vực được.' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_id FROM "public"."accounts" WHERE "username" = "p_username";
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Không có tài khoản "%".', "p_username" USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, v_id, "p_co", "p_bat", btrim("p_ly_do"));
  IF "p_co" = 'quan_tri_kl' THEN UPDATE "public"."accounts" SET "quan_tri_kl" = "p_bat" WHERE "id" = v_id;
  ELSE UPDATE "public"."accounts" SET "thu_ky_thuong_truc" = "p_bat" WHERE "id" = v_id;
  END IF;
  INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet")
  VALUES ("auth"."uid"(), 'cap_co', "p_username", jsonb_build_object('co', "p_co", 'bat', "p_bat", 'ly_do', btrim("p_ly_do"), 'ghi_chu', v_ghi_chu));
END;
$$;
CREATE OR REPLACE FUNCTION "public"."a2_uy_quyen"("p_nguoi" uuid, "p_den_ngay" date, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Ủy quyền giao việc đã bỏ từ v3.21: mọi chuyên viên tự giao việc, nhập Excel, nhập việc thay mặt lãnh đạo.' USING ERRCODE = '22023';
END;
$$;
INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
SELECT NULL, 'migration 0096', a."id", 'quan_tri_kl', false, 'v3.21: bỏ quyền quản trị nhiệm vụ — mọi chuyên viên ngang nhau (quyết định 9/10/2026)'
FROM "public"."accounts" a WHERE a."quan_tri_kl" OR a."quan_tri_kl_het_han" IS NOT NULL;
INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet")
SELECT NULL, 'cap_co', a."username", jsonb_build_object('co', 'quan_tri_kl', 'bat', false, 'ly_do', 'v3.21: bỏ quyền quản trị nhiệm vụ', 'ghi_chu', 'migration 0096')
FROM "public"."accounts" a WHERE a."quan_tri_kl" OR a."quan_tri_kl_het_han" IS NOT NULL;
UPDATE "public"."accounts" SET "quan_tri_kl" = false, "quan_tri_kl_het_han" = NULL WHERE "quan_tri_kl" OR "quan_tri_kl_het_han" IS NOT NULL;
