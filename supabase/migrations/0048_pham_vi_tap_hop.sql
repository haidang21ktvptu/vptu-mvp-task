-- 0048: Hàm TẬP HỢP phạm vi đọc (PR-2a, thiết kế B2) — phạm vi tính MỘT lần mỗi truy vấn thay cho kl_pham_vi theo từng dòng.
-- 1. kl_xem_tat_ca(): quan_tri_kl / A0 / Chánh VP — đứng đầu policy dạng (SELECT …) ⇒ initplan, một lần mỗi truy vấn.
-- 2. kl_nhiem_vu_thay_duoc(p_ca_thu_ky): tập id nhiem_vu TƯƠNG ĐƯƠNG TỪNG NHÁNH của kl_pham_vi (0030/0045) + nhánh thư ký (0047) khi
--    p_ca_thu_ky = true. canh_bao / dinh_chinh (chưa có nhánh thư ký ở 0047) gọi với false để không đổi phạm vi.
--    PCVP: kiêm nhiệm (phong, ngành, lĩnh vực) hiệu lực hôm nay ⇒ chỉ người kiêm nhiệm (kl_pham_vi_pcvp); không có ⇒ phân công cả phòng.
--    Kiêm nhiệm hiệu lực là duy nhất theo (phong, ngành, lĩnh vực) nhờ ràng buộc phu_trach_phong_kiem_nhiem_duy_nhat ⇒ LEFT JOIN không nhân dòng.
-- 3. kl_van_ban_thay_duoc(): văn bản có ≥ 1 việc thấy được (policy cũ: EXISTS lồng hai tầng). quan_tri_kl giữ nhánh riêng ở policy.
-- 4. kl_tu_choi_thay_duoc(): dạng tập hợp của tu_choi_thay (0042).
-- 5. kl_tham_chieu_pham_vi(): tập dòng theo QUY TẮC GỐC (kl_pham_vi, kl_thay_nhiem_vu, thu_ky_tt_thay, tu_choi_thay) cho 10 bảng/view,
--    để test kl-pq-tuong-duong-pham-vi đối chiếu với policy mới. Chỉ trả dòng trong phạm vi của chính người gọi ⇒ không lộ thêm dữ liệu.
--    Đề xuất bỏ ở một migration sau khi ổn định.
-- Giữ nguyên kl_pham_vi, kl_thay_nhiem_vu, thu_ky_tt_thay, tu_choi_thay: các hàm GHI (allowlist) dùng chúng và chúng là chuẩn đối chiếu.

CREATE OR REPLACE FUNCTION "public"."kl_xem_tat_ca"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce("public"."me_quan_tri_kl"() OR "public"."me_role"() = 'A0' OR "public"."me_is_chief"(), false);
$$;

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
  WHERE "p_ca_thu_ky" AND (SELECT m.thu_ky FROM me m) AND c."loai" = 'CHI_DAO_TT';
$$;

CREATE OR REPLACE FUNCTION "public"."kl_van_ban_thay_duoc"() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 100 AS $$
  SELECT DISTINCT n."van_ban_id" FROM "public"."nhiem_vu" n
  WHERE n."id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true));
$$;

CREATE OR REPLACE FUNCTION "public"."kl_tu_choi_thay_duoc"() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public ROWS 20 AS $$
  WITH me AS (
    SELECT a."role_group", a."department", coalesce(a."is_chief" AND a."role_group" = 'A1', false) AS chief
    FROM "public"."accounts" a WHERE a."id" = "auth"."uid"()
  )
  SELECT t."id" FROM "public"."tu_choi" t
  LEFT JOIN "public"."accounts" dn ON dn."id" = t."nguoi_de_nghi"
  LEFT JOIN me ON true
  WHERE "auth"."uid"() IS NOT NULL AND (
       t."nguoi_de_nghi" = "auth"."uid"() OR t."cap_duyet" = "auth"."uid"()
    OR CASE me."role_group"
         WHEN 'A0' THEN true
         WHEN 'A1' THEN me.chief OR EXISTS (
           SELECT 1 FROM "public"."phu_trach_phong" p
           WHERE p."lanh_dao_id" = "auth"."uid"() AND p."phong" = dn."department" AND p."nganh_ma" IS NULL
             AND p."tu_ngay" <= "public"."kl_hom_nay"() AND (p."den_ngay" IS NULL OR p."den_ngay" >= "public"."kl_hom_nay"()))
         WHEN 'A2' THEN dn."department" = me."department"
         ELSE false END);
$$;

-- Chuẩn đối chiếu: mỗi bảng/view một dòng (bảng, mảng id) theo QUY TẮC GỐC — một lần gọi cho cả 10, không phân trang (test CI gọn, §0.4 C).
CREATE OR REPLACE FUNCTION "public"."kl_tham_chieu_pham_vi"() RETURNS TABLE ("bang" text, "ids" text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH nv AS (
    SELECT n.* FROM "public"."nhiem_vu" n
    WHERE "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma")
       OR ("public"."me_thu_ky_tt"() AND "public"."thu_ky_tt_thay"(n."id"))
  ), goc AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."kl_thay_nhiem_vu"(n."id")),
  tk AS (SELECT n."id" FROM "public"."nhiem_vu" n WHERE "public"."me_thu_ky_tt"() AND "public"."thu_ky_tt_thay"(n."id"))
  SELECT b, array_agg(i ORDER BY i) FROM (
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
  ) x(b, i) GROUP BY b;
$$;

REVOKE ALL ON FUNCTION "public"."kl_xem_tat_ca"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_thay_duoc"(boolean) FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_van_ban_thay_duoc"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_tu_choi_thay_duoc"() FROM public, "anon";
REVOKE ALL ON FUNCTION "public"."kl_tham_chieu_pham_vi"() FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_xem_tat_ca"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_nhiem_vu_thay_duoc"(boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_van_ban_thay_duoc"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_tu_choi_thay_duoc"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."kl_tham_chieu_pham_vi"() TO "authenticated";
