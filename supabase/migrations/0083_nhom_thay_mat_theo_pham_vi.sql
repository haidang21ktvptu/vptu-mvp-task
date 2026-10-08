-- 0083 (Đợt B v3.18, sau rà soát mã 8/10/2026) — nhóm thay mặt theo PHẠM VI việc, thay mặt Thường trực ở nghiệm thu:
-- 1. Thành viên nhóm "Lãnh đạo Văn phòng" của MỘT việc = Chánh VP + các Phó Chánh VP THẤY việc đó theo quy tắc phạm vi A1 (phòng của người theo dõi
--    / phòng Owner, kiêm nhiệm theo lĩnh vực — kl_pham_vi_pcvp_cua, cùng nhánh A1 của kl_nhiem_vu_thay_duoc). Trước (0079): mọi A1, nên PCVP khối
--    khác được duyệt / nhận tin / đếm đề nghị về việc mình không đọc được (quy tắc 7 CLAUDE.md: PCVP chỉ khối mình). Nhóm Thường trực: mọi A0 (A0 thấy
--    tất cả). kl_nhom_thay_mat_thanh_vien / kl_trong_nhom_thay_mat thêm tham số p_nhiem_vu (bỏ bản cũ để không trùng tên); kl_duoc_duyet_thay,
--    kl_nguoi_duyet_tu_choi, kl_la_tang_giao truyền việc. giao_viec (tin giao cả nhóm) đổi ở 0084.
-- 2. Thay mặt Thường trực = việc Thường trực giao cả ở nghiệm thu (Q8): kl_viec_a0_giao_cvp nhận giao_thay_mat_nhom = 'THUONG_TRUC' → Chánh VP
--    chủ trì thì thư ký Thường trực (không có thì quản trị KL) nghiệm thu; nhánh thư ký của kl_nhiem_vu_thay_duoc gọi cùng hàm.
-- 3. kl_tham_chieu_pham_vi (chuẩn đối chiếu, kl-pq-tuong-duong-pham-vi): tu_choi thêm vế kl_duoc_duyet_thay như policy (0081).

DROP FUNCTION IF EXISTS "public"."kl_trong_nhom_thay_mat"(uuid, text);
DROP FUNCTION IF EXISTS "public"."kl_nhom_thay_mat_thanh_vien"(text);
-- Thành viên nhóm, đang hoạt động, xếp theo username; có p_nhiem_vu → chỉ người trong phạm vi việc (Chánh VP luôn; PCVP theo kl_pham_vi_pcvp_cua ở phòng
-- người theo dõi hoặc phòng Owner); không có p_nhiem_vu (biểu mẫu, kiểm tra chung) → cả nhóm.
CREATE FUNCTION "public"."kl_nhom_thay_mat_thanh_vien"("p_nhom" text, "p_nhiem_vu" uuid DEFAULT NULL) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH nv AS (
    SELECT n."id", n."nganh_ma", n."linh_vuc_ma", td."department" AS phong_theo_doi, coalesce(oa."department", dv."phong") AS phong_owner
    FROM "public"."nhiem_vu" n
    LEFT JOIN "public"."accounts" td ON td."id" = n."nguoi_theo_doi"
    LEFT JOIN "public"."accounts" oa ON oa."id" = n."owner_tai_khoan"
    LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = n."owner_don_vi_ma"
    WHERE n."id" = "p_nhiem_vu"
  )
  SELECT coalesce(array_agg(a."id" ORDER BY a."username"), '{}'::uuid[]) FROM "public"."accounts" a LEFT JOIN nv ON true
  WHERE NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)
    AND CASE "p_nhom"
          WHEN 'LANH_DAO_VP' THEN a."role_group" = 'A1' AND (a."is_chief" OR nv."id" IS NULL
            OR "public"."kl_pham_vi_pcvp_cua"(a."id", nv.phong_theo_doi, nv."nganh_ma", nv."linh_vuc_ma")
            OR "public"."kl_pham_vi_pcvp_cua"(a."id", nv.phong_owner, nv."nganh_ma", nv."linh_vuc_ma"))
          WHEN 'THUONG_TRUC' THEN a."role_group" = 'A0'
          ELSE false END;
$$;
CREATE FUNCTION "public"."kl_trong_nhom_thay_mat"("p_nguoi" uuid, "p_nhom" text, "p_nhiem_vu" uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "p_nguoi" IS NOT NULL AND "p_nhom" IS NOT NULL AND "p_nguoi" = ANY ("public"."kl_nhom_thay_mat_thanh_vien"("p_nhom", "p_nhiem_vu"));
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhom_thay_mat_thanh_vien"(text, uuid), "public"."kl_trong_nhom_thay_mat"(uuid, text, uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_nhom_thay_mat_thanh_vien"(text, uuid), "public"."kl_trong_nhom_thay_mat"(uuid, text, uuid) TO "authenticated";

-- Người gọi được duyệt (từ chối / đề nghị sửa): cấp duyệt ghi trên đề nghị, Thường trực duyệt thay Thường trực (0034), hoặc thành viên nhóm được thay
-- mặt TRONG PHẠM VI việc mà cấp duyệt chính là người đại diện nhóm.
CREATE OR REPLACE FUNCTION "public"."kl_duoc_duyet_thay"("p_nhiem_vu" uuid, "p_cap_duyet" uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    "p_cap_duyet" = "auth"."uid"()
    OR ("public"."me_role"() = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = "p_cap_duyet") = 'A0')
    OR EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu" AND n."giao_thay_mat_nhom" IS NOT NULL AND n."giao_thay_mat_cho" = "p_cap_duyet"
               AND "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), n."giao_thay_mat_nhom", n."id")));
$$;
-- Người nhận tin / nhắc về một đề nghị từ chối: cấp duyệt + thành viên nhóm trong phạm vi việc (khi cấp duyệt là người đại diện nhóm).
CREATE OR REPLACE FUNCTION "public"."kl_nguoi_duyet_tu_choi"("p_nhiem_vu" uuid, "p_cap_duyet" uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ARRAY["p_cap_duyet"] || coalesce((SELECT "public"."kl_nhom_thay_mat_thanh_vien"(n."giao_thay_mat_nhom", n."id") FROM "public"."nhiem_vu" n
    WHERE n."id" = "p_nhiem_vu" AND n."giao_thay_mat_nhom" IS NOT NULL AND n."giao_thay_mat_cho" = "p_cap_duyet"), '{}'::uuid[]);
$$;
-- Tầng giao (0070): người được thay mặt / người tạo (vai lãnh đạo, đang hoạt động), quản trị KL còn hạn, thành viên nhóm trong phạm vi việc.
CREATE OR REPLACE FUNCTION "public"."kl_la_tang_giao"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0')
    OR EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND a."id" = coalesce("p_nv"."giao_thay_mat_cho", "p_nv"."tao_boi")
               AND a."role_group" IN ('A0', 'A1', 'A2') AND NOT coalesce(a."bi_khoa", false) AND NOT a."is_system")
    OR "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), "p_nv"."giao_thay_mat_nhom", "p_nv"."id"));
$$;

-- ---- Thay mặt Thường trực ở nghiệm thu (Q8) ----
CREATE OR REPLACE FUNCTION "public"."kl_viec_a0_giao_cvp"("p_nv" "public"."nhiem_vu") RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (("p_nv")."giao_thay_mat_nhom" = 'THUONG_TRUC' OR EXISTS (SELECT 1 FROM "public"."accounts" g WHERE g."id" = ("p_nv")."tao_boi" AND g."role_group" = 'A0'))
     AND EXISTS (SELECT 1 FROM "public"."accounts" o WHERE o."id" = ("p_nv")."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief");
$$;

-- kl_nhiem_vu_thay_duoc (0057) nguyên văn, nhánh 4 (thư ký) gọi kl_viec_a0_giao_cvp (nhận cả thay mặt Thường trực).
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
  SELECT n."id" FROM "public"."nhiem_vu" n
  WHERE n."nguoi_theo_doi" = "auth"."uid"() OR n."owner_tai_khoan" = "auth"."uid"()
  UNION ALL
  SELECT nv."id"
  FROM nv
  CROSS JOIN me
  LEFT JOIN kn k1 ON k1."phong" = nv.phong_theo_doi AND k1."nganh_ma" = nv."nganh_ma" AND k1."linh_vuc_ma" = nv."linh_vuc_ma"
  LEFT JOIN kn k2 ON k2."phong" = nv.phong_owner AND k2."nganh_ma" = nv."nganh_ma" AND k2."linh_vuc_ma" = nv."linh_vuc_ma"
  WHERE (SELECT m.qtkl OR m."role_group" IN ('A0', 'A1', 'A2') FROM me m)
    AND (me.qtkl
      OR CASE me."role_group"
           WHEN 'A0' THEN true
           WHEN 'A1' THEN me.chief
             OR (nv.phong_theo_doi IS NOT NULL AND CASE WHEN k1."lanh_dao_id" IS NOT NULL THEN k1."lanh_dao_id" = "auth"."uid"()
                                                       ELSE nv.phong_theo_doi IN (SELECT c."phong" FROM ca_phong c) END)
             OR (nv.phong_owner IS NOT NULL AND CASE WHEN k2."lanh_dao_id" IS NOT NULL THEN k2."lanh_dao_id" = "auth"."uid"()
                                                    ELSE nv.phong_owner IN (SELECT c."phong" FROM ca_phong c) END)
           WHEN 'A2' THEN nv.phong_theo_doi = me."department" OR nv.phong_owner = me."department"
           ELSE false END)
  UNION ALL
  SELECT c."nhiem_vu_id" FROM "public"."chi_dao" c   -- thư ký Thường trực (0047): việc có ≥ 1 CHI_DAO_TT
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND c."loai" = 'CHI_DAO_TT'
  UNION ALL
  SELECT n."id" FROM "public"."nhiem_vu" n   -- 0057 (Q8): thư ký thấy việc Thường trực giao cho Chánh VP (A0, hoặc thay mặt Thường trực — 0083) để nghiệm thu thay mặt
  JOIN "public"."accounts" o ON o."id" = n."owner_tai_khoan" AND o."role_group" = 'A1' AND o."is_chief"
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND "public"."kl_viec_a0_giao_cvp"(n);
$$;

-- Chuẩn đối chiếu (0057) nguyên văn + vế nhóm ở tu_choi.
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
