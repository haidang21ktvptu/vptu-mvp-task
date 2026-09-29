-- 0049: Policy SELECT dạng tập hợp (PR-2a, thiết kế B2) — mỗi dòng chỉ còn một phép tra băm vào tập id tính một lần mỗi truy vấn.
-- Không đổi tập dòng đọc (chứng minh: kl-pq-tuong-duong-pham-vi + ảnh chụp id/giá trị trên 1 400 việc). Không đổi quyền ghi.
-- 1. nhiem_vu, lich_su, chi_dao, minh_chung: kl_xem_tat_ca() OR id ∈ kl_nhiem_vu_thay_duoc(true)  (có nhánh thư ký như 0047).
--    canh_bao, dinh_chinh: … kl_nhiem_vu_thay_duoc(false)  (0047 không mở hai bảng này cho thư ký — giữ nguyên).
--    nhiem_vu_id NOT NULL ở cả 5 bảng con ⇒ nhánh kl_xem_tat_ca() tương đương kl_thay_nhiem_vu() (việc luôn tồn tại).
-- 2. van_ban_giao_viec: quan_tri_kl OR id ∈ kl_van_ban_thay_duoc() — A0/Chánh VP vẫn chỉ thấy văn bản có ≥ 1 việc (như EXISTS cũ).
-- 3. tu_choi: id ∈ kl_tu_choi_thay_duoc().
-- 4. nhiem_vu: gộp 2 policy UPDATE permissive (Owner/người theo dõi + quan_tri_kl) thành một; USING = WITH CHECK = OR của hai policy cũ.
-- 5. Bọc (SELECT …) cho accounts_select, accounts_update_a1, messages_select (3 policy storage ở 0052 cùng C2).

ALTER POLICY "nhiem_vu_select" ON "public"."nhiem_vu"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));
ALTER POLICY "kl_lich_su_select" ON "public"."lich_su"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));
ALTER POLICY "kl_chi_dao_select" ON "public"."chi_dao"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));
ALTER POLICY "minh_chung_select" ON "public"."minh_chung"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(true)));
ALTER POLICY "canh_bao_select" ON "public"."canh_bao"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(false)));
ALTER POLICY "kl_dinh_chinh_select" ON "public"."dinh_chinh"
  USING ((SELECT "public"."kl_xem_tat_ca"()) OR "nhiem_vu_id" IN (SELECT "public"."kl_nhiem_vu_thay_duoc"(false)));
ALTER POLICY "van_ban_giao_viec_select" ON "public"."van_ban_giao_viec"
  USING ((SELECT "public"."me_quan_tri_kl"()) OR "id" IN (SELECT "public"."kl_van_ban_thay_duoc"()));
ALTER POLICY "tu_choi_select" ON "public"."tu_choi"
  USING ("id" IN (SELECT "public"."kl_tu_choi_thay_duoc"()));

DROP POLICY "nhiem_vu_update_owner_hoac_theo_doi" ON "public"."nhiem_vu";
DROP POLICY "kl_nhiem_vu_update_qtkl" ON "public"."nhiem_vu";
CREATE POLICY "nhiem_vu_update" ON "public"."nhiem_vu" FOR UPDATE TO "authenticated"
  USING ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR (SELECT "public"."me_quan_tri_kl"()))
  WITH CHECK ("nguoi_theo_doi" = (SELECT "auth"."uid"()) OR "owner_tai_khoan" = (SELECT "auth"."uid"()) OR (SELECT "public"."me_quan_tri_kl"()));

ALTER POLICY "accounts_select" ON "public"."accounts" USING ((SELECT "auth"."uid"()) IS NOT NULL);
ALTER POLICY "accounts_update_a1" ON "public"."accounts"
  USING ((SELECT "public"."me_role"()) = 'A1') WITH CHECK ((SELECT "public"."me_role"()) = 'A1');
ALTER POLICY "messages_select" ON "public"."direct_messages"
  USING ("sender_id" = (SELECT "auth"."uid"()) OR "receiver_id" = (SELECT "auth"."uid"()));
