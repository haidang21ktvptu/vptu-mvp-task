-- 0079 (Đợt B v3.18, yêu cầu 7/10/2026 mục 2 và 3) — phần 1/4 (0079 schema + hàm nhóm + phạm vi; 0080 giao_viec; 0081 duyệt theo nhóm; 0082 nhắc + view):
-- 1. Owner luôn là phòng / cán bộ Văn phòng: giao_viec từ chối Owner là đơn vị ngoài Văn phòng với MỌI vai (trước đây quản trị KL và lô nhập
--    Excel được). Danh mục dm_don_vi đơn vị ngoài giữ nguyên cho việc cũ (nhập từ kết luận) — chỉ không còn giao mới; việc giao cho đơn vị
--    ngoài ghi tên đơn vị thực hiện trong nội dung, Owner là phòng / cán bộ Văn phòng theo dõi (chú thích ở biểu mẫu từ v3.17).
-- 2. Thay mặt theo NHÓM: nhiem_vu.giao_thay_mat_nhom ('LANH_DAO_VP' = Chánh + các Phó Chánh VP; 'THUONG_TRUC' = tài khoản A0) bên cạnh
--    thay mặt từng người. Để 30+ hàm đang đọc giao_thay_mat_cho (người giao, tầng giao, nhắc, nghiệm thu, FK dọn dữ liệu…) không phải đổi,
--    cột giao_thay_mat_cho vẫn ghi MỘT người đại diện của nhóm (kl_dai_dien_nhom_thay_mat: Chánh VP; Thường trực = A0 đầu tiên, không có thì
--    Chánh VP); nhóm chỉ mở rộng: ai được duyệt từ chối / đề nghị sửa (bất kỳ thành viên — kl_duoc_duyet_thay), ai thấy đề nghị từ chối, ai
--    nhận tin (giao, đề nghị từ chối, nhắc quá hạn duyệt), ai là "tầng giao" (kl_la_tang_giao), nhãn "Thay mặt Lãnh đạo Văn phòng giao".
--    Thay mặt Thường trực = việc Thường trực giao: người nhận là lãnh đạo Văn phòng hoặc một phòng (theo dõi tự suy), uu_tien THUONG_TRUC,
--    Chánh VP được báo. kl_duoc_giao_cho_phong / kl_pham_vi_giao nhận người đại diện (A0 → mọi phòng); kl_pham_vi_giao thêm p_thay_mat_nhom.
-- 3. v_nhiem_vu, v_ngoai_le thêm cột cuối giao_thay_mat_nhom; kl_nhap_giao (lô Excel) chuyển thay_mat_nhom. Không đổi dữ liệu cũ.

ALTER TABLE "public"."nhiem_vu" ADD COLUMN IF NOT EXISTS "giao_thay_mat_nhom" text
  CONSTRAINT "nhiem_vu_giao_thay_mat_nhom_check" CHECK ("giao_thay_mat_nhom" IN ('LANH_DAO_VP', 'THUONG_TRUC'));
COMMENT ON COLUMN "public"."nhiem_vu"."giao_thay_mat_nhom" IS 'v3.18: giao thay mặt cả nhóm (LANH_DAO_VP / THUONG_TRUC); giao_thay_mat_cho khi đó = người đại diện nhóm';

CREATE OR REPLACE FUNCTION "public"."kl_ten_nhom_thay_mat"("p_nhom" text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_nhom" WHEN 'LANH_DAO_VP' THEN 'Lãnh đạo Văn phòng' WHEN 'THUONG_TRUC' THEN 'Thường trực Tỉnh ủy' END;
$$;
-- Thành viên nhóm (đang hoạt động, không hệ thống), xếp theo username.
CREATE OR REPLACE FUNCTION "public"."kl_nhom_thay_mat_thanh_vien"("p_nhom" text) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(array_agg(a."id" ORDER BY a."username"), '{}'::uuid[]) FROM "public"."accounts" a
  WHERE NOT a."is_system" AND NOT coalesce(a."bi_khoa", false)
    AND CASE "p_nhom" WHEN 'LANH_DAO_VP' THEN a."role_group" = 'A1' WHEN 'THUONG_TRUC' THEN a."role_group" = 'A0' ELSE false END;
$$;
CREATE OR REPLACE FUNCTION "public"."kl_trong_nhom_thay_mat"("p_nguoi" uuid, "p_nhom" text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "p_nguoi" IS NOT NULL AND "p_nhom" IS NOT NULL AND "p_nguoi" = ANY ("public"."kl_nhom_thay_mat_thanh_vien"("p_nhom"));
$$;
-- Người đại diện ghi vào giao_thay_mat_cho: Lãnh đạo VP → Chánh VP; Thường trực → tài khoản A0 đầu tiên, chưa có thì Chánh VP.
CREATE OR REPLACE FUNCTION "public"."kl_dai_dien_nhom_thay_mat"("p_nhom" text) RETURNS uuid LANGUAGE sql STABLE STRICT SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN "p_nhom" NOT IN ('LANH_DAO_VP', 'THUONG_TRUC') THEN NULL ELSE coalesce(
    CASE WHEN "p_nhom" = 'THUONG_TRUC' THEN (SELECT a."id" FROM "public"."accounts" a WHERE a."role_group" = 'A0' AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false) ORDER BY a."username" LIMIT 1) END,
    (SELECT a."id" FROM "public"."accounts" a WHERE a."role_group" = 'A1' AND a."is_chief" AND NOT a."is_system" ORDER BY a."username" LIMIT 1)) END;   -- STRICT: nhóm NULL → NULL (kl_pham_vi_giao không nhóm)
$$;
-- Người gọi được duyệt (từ chối / đề nghị sửa) khi là cấp duyệt ghi trên đề nghị, hoặc Thường trực duyệt thay Thường trực (0034), hoặc là thành
-- viên nhóm được thay mặt của việc mà cấp duyệt chính là người đại diện nhóm.
CREATE OR REPLACE FUNCTION "public"."kl_duoc_duyet_thay"("p_nhiem_vu" uuid, "p_cap_duyet" uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (
    "p_cap_duyet" = "auth"."uid"()
    OR ("public"."me_role"() = 'A0' AND (SELECT "role_group" FROM "public"."accounts" WHERE "id" = "p_cap_duyet") = 'A0')
    OR EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu" AND n."giao_thay_mat_nhom" IS NOT NULL AND n."giao_thay_mat_cho" = "p_cap_duyet"
               AND "public"."kl_trong_nhom_thay_mat"("auth"."uid"(), n."giao_thay_mat_nhom")));
$$;
-- Người nhận tin / nhắc về một đề nghị từ chối: cấp duyệt + cả nhóm (khi cấp duyệt là người đại diện nhóm của việc).
CREATE OR REPLACE FUNCTION "public"."kl_nguoi_duyet_tu_choi"("p_nhiem_vu" uuid, "p_cap_duyet" uuid) RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ARRAY["p_cap_duyet"] || coalesce((SELECT "public"."kl_nhom_thay_mat_thanh_vien"(n."giao_thay_mat_nhom") FROM "public"."nhiem_vu" n
    WHERE n."id" = "p_nhiem_vu" AND n."giao_thay_mat_nhom" IS NOT NULL AND n."giao_thay_mat_cho" = "p_cap_duyet"), '{}'::uuid[]);
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhom_thay_mat_thanh_vien"(text), "public"."kl_trong_nhom_thay_mat"(uuid, text), "public"."kl_dai_dien_nhom_thay_mat"(text),
  "public"."kl_duoc_duyet_thay"(uuid, uuid), "public"."kl_nguoi_duyet_tu_choi"(uuid, uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ten_nhom_thay_mat"(text), "public"."kl_nhom_thay_mat_thanh_vien"(text), "public"."kl_trong_nhom_thay_mat"(uuid, text) TO "authenticated";

-- ---- Phạm vi giao: người được thay mặt là A0 (đại diện nhóm Thường trực) → mọi phòng (như Thường trực giao: owner lãnh đạo VP hoặc phòng). ----

CREATE OR REPLACE FUNCTION "public"."kl_duoc_giao_cho_phong"("p_nguoi" uuid, "p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text, "p_thay_mat" uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT CASE
      WHEN "p_thay_mat" IS NOT NULL THEN a."role_group" = 'A3' AND q."qtkl" AND CASE
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


-- kl_pham_vi_giao: thêm p_thay_mat_nhom (biểu mẫu chọn nhóm) — DROP bản 1 tham số để PostgREST không gặp hai hàm trùng tên.
DROP FUNCTION IF EXISTS "public"."kl_pham_vi_giao"(uuid);
CREATE OR REPLACE FUNCTION "public"."kl_pham_vi_giao"("p_thay_mat" uuid DEFAULT NULL, "p_thay_mat_nhom" text DEFAULT NULL)
RETURNS TABLE ("phong" text, "nganh_ma" text, "linh_vuc_ma" text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH phong AS (SELECT DISTINCT d."phong" FROM "public"."dm_don_vi" d WHERE d."trong_van_phong" AND d."phong" IS NOT NULL UNION ALL SELECT NULL::text),
       lv AS (SELECT NULL::text AS "nganh_ma", NULL::text AS "ma" UNION ALL SELECT l."nganh_ma", l."ma" FROM "public"."dm_linh_vuc" l),
       tm AS (SELECT coalesce("public"."kl_dai_dien_nhom_thay_mat"("p_thay_mat_nhom"), "p_thay_mat") AS "id")
  SELECT p."phong", lv."nganh_ma", lv."ma" FROM phong p CROSS JOIN lv CROSS JOIN tm
  WHERE (p."phong" IS NOT NULL OR lv."ma" IS NULL) AND "auth"."uid"() IS NOT NULL
    AND "public"."kl_duoc_giao_cho_phong"("auth"."uid"(), p."phong", lv."nganh_ma", lv."ma", tm."id")
  ORDER BY 1 NULLS FIRST, 2 NULLS FIRST, 3 NULLS FIRST;
$$;
REVOKE ALL ON FUNCTION "public"."kl_pham_vi_giao"(uuid, text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_pham_vi_giao"(uuid, text) TO "authenticated";
