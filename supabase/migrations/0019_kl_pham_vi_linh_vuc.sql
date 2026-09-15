-- GĐ9 (PR 9A, 2/2) — Phạm vi đọc module KL theo lĩnh vực (thiết kế Phần 5.4, quyết định 7 bổ sung 15/9/2026).
-- Quy tắc cho Phó Chánh Văn phòng (A1 không phải Chánh VP), với phòng = accounts.department của chủ trì:
--   - phụ trách cả phòng: thấy việc của phòng đó, TRỪ việc có (ngành, lĩnh vực) đang được một A1 KHÁC kiêm nhiệm;
--   - kiêm nhiệm: thấy việc của phòng đó có đúng (ngành, lĩnh vực) được giao;
--   - việc có linh_vuc_ma NULL: thuộc PCVP phụ trách phòng, không ai kiêm nhiệm được.
-- Không đổi: Chánh VP tất cả; quan_tri_kl tất cả; A2 toàn bộ phòng mình (kể cả lĩnh vực đã bị PCVP khác kiêm nhiệm —
-- chủ dự án xác nhận 15/9); A3 việc mình chủ trì. Bảng tasks (giao việc nội bộ) không có ngành → không áp dụng.

-- kl_pham_vi đổi chữ ký (thêm ngành, lĩnh vực): bỏ hai policy gọi trực tiếp rồi tạo lại. kl_thay_nhiem_vu giữ chữ ký
-- (ba policy lịch sử/chỉ đạo/đính chính phụ thuộc) nên chỉ thay thân hàm.
DROP POLICY "kl_nhiem_vu_select" ON "public"."kl_nhiem_vu";
DROP POLICY "kl_hoi_nghi_select" ON "public"."kl_hoi_nghi";
DROP FUNCTION "public"."kl_pham_vi"(uuid);

CREATE FUNCTION "public"."kl_pham_vi"("p_chu_tri" uuid, "p_nganh_ma" text, "p_linh_vuc_ma" text) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND "p_chu_tri" IS NOT NULL AND (
    "public"."me_quan_tri_kl"()
    OR "p_chu_tri" = "auth"."uid"()
    OR CASE "public"."me_role"()
         WHEN 'A1' THEN "public"."me_is_chief"() OR coalesce((
           -- kn = người đang kiêm nhiệm (phòng, ngành, lĩnh vực) hôm nay: là tôi → thấy; là người khác → không;
           -- không ai (hoặc việc không có lĩnh vực) → theo phụ trách cả phòng.
           SELECT CASE WHEN kn."id" IS NOT NULL THEN kn."id" = "auth"."uid"()
                       ELSE "public"."phu_trach"("auth"."uid"(), a."department", "public"."kl_hom_nay"()) END
           FROM "public"."accounts" a
           CROSS JOIN LATERAL (SELECT "public"."nguoi_kiem_nhiem"(a."department", "p_nganh_ma", "p_linh_vuc_ma", "public"."kl_hom_nay"()) AS "id") kn
           WHERE a."id" = "p_chu_tri"), false)
         WHEN 'A2' THEN "public"."in_my_dept"("p_chu_tri")
         ELSE false END
  );
$$;

CREATE OR REPLACE FUNCTION "public"."kl_thay_nhiem_vu"("p_id" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."kl_nhiem_vu" n
                 WHERE n."id" = "p_id" AND "public"."kl_pham_vi"(n."chu_tri_id", n."nganh_ma", n."linh_vuc_ma"));
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['kl_pham_vi(uuid,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

CREATE POLICY "kl_nhiem_vu_select" ON "public"."kl_nhiem_vu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_pham_vi"("chu_tri_id", "nganh_ma", "linh_vuc_ma")));
CREATE POLICY "kl_hoi_nghi_select" ON "public"."kl_hoi_nghi" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())
         OR EXISTS (SELECT 1 FROM "public"."kl_nhiem_vu" n WHERE n."hoi_nghi_id" = "kl_hoi_nghi"."id"
                    AND "public"."kl_pham_vi"(n."chu_tri_id", n."nganh_ma", n."linh_vuc_ma")));

-- View dashboard: nối hai cột lĩnh vực ở CUỐI (CREATE OR REPLACE VIEW chỉ cho thêm cột cuối), phần còn lại y hệt 0016.
CREATE OR REPLACE VIEW "public"."v_kl_dashboard"
WITH ("security_invoker" = true) AS
SELECT nv."id", nv."ma", nv."hoi_nghi_id", hn."so_hoi_nghi", hn."so_ket_luan", hn."ngay_ban_hanh",
       nv."chu_tri_id", ct."full_name" AS "chu_tri_ten", ct."department" AS "chu_tri_phong",
       nv."nganh_ma", dn."ten" AS "nganh_ten", nv."co_quan_trinh_ma", dc."ten" AS "co_quan_trinh_ten",
       nv."linh_vuc_chi_tiet", nv."noi_dung", nv."loai_thoi_han_ma", dl."ten" AS "loai_thoi_han_ten",
       nv."han_xu_ly", nv."ly_do_chua_co_han", nv."tien_do_ma", nv."ngay_hoan_thanh", nv."minh_chung",
       nv."van_ban_trien_khai", nv."so_lan_gia_han", nv."nguon", nv."ghi_chu", nv."thieu_minh_chung",
       nv."ghi_hoan_thanh_luc", nv."cap_nhat_luc", nv."cap_nhat_boi", nv."created_at",
       (tt).trang_thai, (tt).so_ngay_qua, (tt).ket_qua, (tt).so_ngay_tre, (tt).do_tre_nhap_lieu,
       (tt).dang_dinh_chinh, (tt).nhom_dem,
       ("public"."kl_hom_nay"() - hn."ngay_ban_hanh")::integer AS "tuoi_ngay",
       (SELECT count(*) FROM "public"."kl_chi_dao" c WHERE c."nhiem_vu_id" = nv."id" AND c."trang_thai" = 'CHO_PHAN_HOI')::integer
         AS "so_chi_dao_cho_phan_hoi",
       nv."linh_vuc_ma", lv."ten" AS "linh_vuc_ten"
FROM "public"."kl_nhiem_vu" nv
CROSS JOIN LATERAL (SELECT "public"."kl_trang_thai"(nv, "public"."kl_hom_nay"()) AS tt) t
JOIN "public"."kl_hoi_nghi" hn ON hn."id" = nv."hoi_nghi_id"
LEFT JOIN "public"."accounts_public" ct ON ct."id" = nv."chu_tri_id"
LEFT JOIN "public"."dm_nganh" dn ON dn."ma" = nv."nganh_ma"
LEFT JOIN "public"."dm_co_quan_trinh" dc ON dc."ma" = nv."co_quan_trinh_ma"
LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl."ma" = nv."loai_thoi_han_ma"
LEFT JOIN "public"."dm_linh_vuc" lv ON lv."ma" = nv."linh_vuc_ma";
