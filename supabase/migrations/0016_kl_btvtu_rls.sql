-- GĐ8 (PR 8A-2, 3/3) — RLS module KL BTVTU theo quyết định 7 (Phần 4): Chánh VP thấy tất cả; lãnh đạo phòng
-- nào thấy phòng đó; PCVP thấy các phòng được phân công (phu_trach_phong tại ngày hiện tại, 0013); A3 chỉ việc
-- mình chủ trì; hai người có quan_tri_kl thấy và sửa toàn bộ; người ngoài phạm vi không thấy gì. Kèm view
-- v_kl_dashboard (security_invoker, mọi số từ kl_trang_thai) và Realtime cho 3 bảng (quyết định 8).

-- Phạm vi ĐỌC một nhiệm vụ theo chủ trì của nó. Phòng của chủ trì = accounts.department.
CREATE FUNCTION "public"."kl_pham_vi"("p_chu_tri" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "auth"."uid"() IS NOT NULL AND "p_chu_tri" IS NOT NULL AND (
    "public"."me_quan_tri_kl"()
    OR "p_chu_tri" = "auth"."uid"()
    OR CASE "public"."me_role"()
         WHEN 'A1' THEN "public"."me_is_chief"()
                        OR "public"."phu_trach"("auth"."uid"(),
                             (SELECT "department" FROM "public"."accounts" WHERE "id" = "p_chu_tri"), "public"."kl_hom_nay"())
         WHEN 'A2' THEN "public"."in_my_dept"("p_chu_tri")
         ELSE false END
  );
$$;

CREATE FUNCTION "public"."kl_thay_nhiem_vu"("p_id" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."kl_nhiem_vu" n WHERE n."id" = "p_id" AND "public"."kl_pham_vi"(n."chu_tri_id"));
$$;

-- Lãnh đạo được ghi chỉ đạo: A1/A2 trong phạm vi (không gồm A3 chủ trì, không gồm quan_tri_kl nếu là A3).
CREATE FUNCTION "public"."kl_duoc_chi_dao"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "public"."me_role"() IN ('A1', 'A2') AND "public"."kl_thay_nhiem_vu"("p_nhiem_vu");
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['kl_pham_vi(uuid)', 'kl_thay_nhiem_vu(uuid)', 'kl_duoc_chi_dao(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Quyền bảng: bảng mới không cấp gì cho anon (0008 đã thu default privileges); authenticated chỉ những thao tác
-- có policy, các thao tác chỉ đi qua hàm/trigger thì REVOKE hẳn (lỗi rõ ràng, không mở nhầm bằng policy sau này).
ALTER TABLE "public"."dm_nganh" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dm_co_quan_trinh" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dm_loai_thoi_han" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dm_tien_do" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_cau_hinh" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_hoi_nghi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_nhiem_vu" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_lich_su" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_chi_dao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kl_dinh_chinh" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."dm_nganh", "public"."dm_co_quan_trinh", "public"."dm_loai_thoi_han", "public"."dm_tien_do",
  "public"."kl_cau_hinh", "public"."kl_hoi_nghi", "public"."kl_nhiem_vu", "public"."kl_lich_su",
  "public"."kl_chi_dao", "public"."kl_dinh_chinh" FROM "anon", "authenticated";
REVOKE ALL ON SEQUENCE "public"."kl_nhiem_vu_ma_seq" FROM "anon";

GRANT SELECT ON TABLE "public"."dm_nganh", "public"."dm_co_quan_trinh", "public"."dm_loai_thoi_han", "public"."dm_tien_do",
  "public"."kl_cau_hinh", "public"."kl_hoi_nghi", "public"."kl_nhiem_vu", "public"."kl_lich_su",
  "public"."kl_chi_dao", "public"."kl_dinh_chinh" TO "authenticated";
GRANT UPDATE ON TABLE "public"."kl_cau_hinh" TO "authenticated";
GRANT INSERT, UPDATE ON TABLE "public"."kl_hoi_nghi" TO "authenticated";
GRANT INSERT, UPDATE ON TABLE "public"."kl_nhiem_vu" TO "authenticated";
GRANT INSERT ON TABLE "public"."kl_chi_dao" TO "authenticated";

-- 1. Danh mục và cấu hình: ai đã đăng nhập cũng đọc; cấu hình chỉ quan_tri_kl sửa; danh mục chỉ đổi bằng migration.
CREATE POLICY "dm_nganh_select" ON "public"."dm_nganh" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "dm_co_quan_trinh_select" ON "public"."dm_co_quan_trinh" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "dm_loai_thoi_han_select" ON "public"."dm_loai_thoi_han" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "dm_tien_do_select" ON "public"."dm_tien_do" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "kl_cau_hinh_select" ON "public"."kl_cau_hinh" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "kl_cau_hinh_update_qtkl" ON "public"."kl_cau_hinh" FOR UPDATE TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())) WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));

-- 2. Hội nghị: thấy khi quan_tri_kl hoặc có nhiệm vụ trong phạm vi thuộc văn bản đó; tạo/sửa chỉ quan_tri_kl.
CREATE POLICY "kl_hoi_nghi_select" ON "public"."kl_hoi_nghi" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())
         OR EXISTS (SELECT 1 FROM "public"."kl_nhiem_vu" n WHERE n."hoi_nghi_id" = "kl_hoi_nghi"."id" AND "public"."kl_pham_vi"(n."chu_tri_id")));
CREATE POLICY "kl_hoi_nghi_insert_qtkl" ON "public"."kl_hoi_nghi" FOR INSERT TO "authenticated"
  WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));
CREATE POLICY "kl_hoi_nghi_update_qtkl" ON "public"."kl_hoi_nghi" FOR UPDATE TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())) WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));

-- 3. Nhiệm vụ: đọc theo phạm vi; thêm chỉ quan_tri_kl; sửa = quan_tri_kl mọi dòng, hoặc A3 dòng mình chủ trì
--    (cột do trigger a_kl_nhiem_vu_guard_a3 giới hạn với mọi người không có quan_tri_kl; chủ trì không đổi được —
--    "Giao lại" là hành động chỉ đạo, PR 10A).
CREATE POLICY "kl_nhiem_vu_select" ON "public"."kl_nhiem_vu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_pham_vi"("chu_tri_id")));
CREATE POLICY "kl_nhiem_vu_insert_qtkl" ON "public"."kl_nhiem_vu" FOR INSERT TO "authenticated"
  WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));
CREATE POLICY "kl_nhiem_vu_update_qtkl" ON "public"."kl_nhiem_vu" FOR UPDATE TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())) WITH CHECK ((SELECT "public"."me_quan_tri_kl"()));
CREATE POLICY "kl_nhiem_vu_update_chu_tri" ON "public"."kl_nhiem_vu" FOR UPDATE TO "authenticated"
  USING ("chu_tri_id" = (SELECT "auth"."uid"())) WITH CHECK ("chu_tri_id" = (SELECT "auth"."uid"()));

-- 4. Lịch sử, chỉ đạo, đính chính: đọc theo phạm vi nhiệm vụ. Lịch sử chỉ trigger ghi; chỉ đạo A1/A2 trong phạm vi
--    thêm (nguoi_gui = mình; phản hồi/đóng qua hàm ở PR 10A); đính chính chỉ qua hai hàm của 0015.
CREATE POLICY "kl_lich_su_select" ON "public"."kl_lich_su" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_thay_nhiem_vu"("nhiem_vu_id")));
CREATE POLICY "kl_chi_dao_select" ON "public"."kl_chi_dao" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_thay_nhiem_vu"("nhiem_vu_id")));
CREATE POLICY "kl_chi_dao_insert_lanh_dao" ON "public"."kl_chi_dao" FOR INSERT TO "authenticated"
  WITH CHECK ("nguoi_gui" = (SELECT "auth"."uid"()) AND (SELECT "public"."kl_duoc_chi_dao"("nhiem_vu_id")));
CREATE POLICY "kl_dinh_chinh_select" ON "public"."kl_dinh_chinh" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_thay_nhiem_vu"("nhiem_vu_id")));

-- 5. View dashboard: chạy với quyền người gọi (RLS của kl_nhiem_vu lọc dòng); MỌI số trạng thái từ kl_trang_thai(nv, kl_hom_nay()).
--    tuoi_ngay = tuổi việc từ ngày ban hành (cho "Cần điền hạn"); so_chi_dao_cho_phan_hoi cho ô "Chỉ đạo chưa phản hồi".
CREATE VIEW "public"."v_kl_dashboard"
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
         AS "so_chi_dao_cho_phan_hoi"
FROM "public"."kl_nhiem_vu" nv
CROSS JOIN LATERAL (SELECT "public"."kl_trang_thai"(nv, "public"."kl_hom_nay"()) AS tt) t
JOIN "public"."kl_hoi_nghi" hn ON hn."id" = nv."hoi_nghi_id"
LEFT JOIN "public"."accounts_public" ct ON ct."id" = nv."chu_tri_id"
LEFT JOIN "public"."dm_nganh" dn ON dn."ma" = nv."nganh_ma"
LEFT JOIN "public"."dm_co_quan_trinh" dc ON dc."ma" = nv."co_quan_trinh_ma"
LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl."ma" = nv."loai_thoi_han_ma";
REVOKE ALL ON TABLE "public"."v_kl_dashboard" FROM "anon";
GRANT SELECT ON TABLE "public"."v_kl_dashboard" TO "authenticated";

-- 6. Realtime (quyết định 8: dashboard thời gian thực, không có kỳ chốt). RLS vẫn lọc sự kiện theo người nhận.
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."kl_nhiem_vu";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."kl_chi_dao";
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."kl_dinh_chinh";
