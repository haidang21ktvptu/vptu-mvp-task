-- 0047: Thư ký Thường trực — tài khoản (bất kỳ vai) được uỷ quyền ĐÓNG chỉ đạo Thường trực (CHI_DAO_TT) thay mặt; không có quyền ghi nào khác.
-- 1. accounts.thu_ky_thuong_truc (default false) + accounts_public; me_thu_ky_tt(); thu_ky_tt_thay(nhiem_vu) = thư ký và việc có ≥ 1 CHI_DAO_TT.
-- 2. admin_dat_co (0013): nhận thêm cờ 'thu_ky_thuong_truc' — chỉ quan_tri_he_thong (admin_kiem_tra_nguoi_goi), lý do bắt buộc, quyen_lich_su +
--    nhat_ky_he_thong (cap_co). 'quan_tri_kl' giữ nguyên.
-- 3. chi_dao.dong_boi / dong_luc; chi_dao_dong (0032): CHI_DAO_TT đóng bởi người gửi (A0) HOẶC thư ký; thư ký không đóng loại khác (kể cả luồng của
--    lãnh đạo Văn phòng / Trưởng phòng); vết "Đóng thay mặt Thường trực — <họ tên>" khi người đóng ≠ người gửi, báo cả người gửi.
-- 4. Phạm vi ĐỌC của thư ký: nhánh riêng thu_ky_tt_thay() ở đúng các policy SELECT nhiem_vu, van_ban_giao_viec (v_nhiem_vu JOIN), chi_dao, lich_su,
--    minh_chung — KHÔNG sửa kl_thay_nhiem_vu / kl_pham_vi (các hàm GHI dùng để kiểm phạm vi), nên thư ký không được thêm quyền ghi nào.
-- 5. v_chi_dao_tt: thêm dong_boi, dong_boi_ten, do_khan ở cuối (màn "Chỉ đạo Thường trực" của thư ký; A0 "Chỉ đạo đã gửi" ghi "thay mặt: <tên>").
-- 6. Sửa xac_nhan_nhan_viec (0025): NULL owner_tai_khoan làm điều kiện quyền thành NULL → ai cũng xác nhận được; dùng IS NOT TRUE.

ALTER TABLE "public"."accounts" ADD COLUMN "thu_ky_thuong_truc" boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN "public"."accounts"."thu_ky_thuong_truc" IS 'Thư ký Thường trực: được đóng chỉ đạo Thường trực thay mặt; chỉ quan_tri_he_thong cấp/thu qua admin_dat_co';
GRANT SELECT ("thu_ky_thuong_truc") ON "public"."accounts" TO "authenticated"; -- accounts_public là security_invoker: cột mới phải có grant cột (0041)

CREATE OR REPLACE VIEW "public"."accounts_public" WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title", "created_at", "manager_id", "department", "must_change_password",
       "is_chief", "is_system",
       ("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"())) AS "quan_tri_kl",
       "quan_tri_he_thong", "dien_thoai", "anh_url", "tuy_chon", "quan_tri_kl_het_han", "bi_khoa", "thu_ky_thuong_truc"
FROM "public"."accounts";

CREATE FUNCTION "public"."me_thu_ky_tt"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "thu_ky_thuong_truc" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;
-- Phạm vi đọc riêng của thư ký: chỉ nhiệm vụ đã có ít nhất một chỉ đạo Thường trực.
CREATE FUNCTION "public"."thu_ky_tt_thay"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "public"."me_thu_ky_tt"() AND EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nhiem_vu" AND c."loai" = 'CHI_DAO_TT');
$$;
REVOKE ALL ON FUNCTION "public"."me_thu_ky_tt"() FROM public, "anon"; GRANT EXECUTE ON FUNCTION "public"."me_thu_ky_tt"() TO "authenticated";
REVOKE ALL ON FUNCTION "public"."thu_ky_tt_thay"(uuid) FROM public, "anon"; GRANT EXECUTE ON FUNCTION "public"."thu_ky_tt_thay"(uuid) TO "authenticated";

-- 2. admin_dat_co: thêm cờ thu_ky_thuong_truc (cùng cơ chế: người gọi = quan_tri_he_thong hoặc CLI, lý do bắt buộc, quyen_lich_su; thêm nhat_ky_he_thong).
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

-- 3. chi_dao_dong: người đóng + đóng thay mặt.
ALTER TABLE "public"."chi_dao" ADD COLUMN "dong_boi" uuid REFERENCES "public"."accounts"("id"), ADD COLUMN "dong_luc" timestamp with time zone;
CREATE OR REPLACE FUNCTION "public"."chi_dao_dong"("p_id" uuid) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."chi_dao"; v_ma text; v_ten text; v_thay_mat boolean := false;
BEGIN
  SELECT * INTO v FROM "public"."chi_dao" WHERE "id" = "p_id" AND "loai" <> 'PHAN_HOI';
  IF v."id" IS NOT NULL AND v."loai" = 'CHI_DAO_TT' THEN
    IF v."nguoi_gui" = "auth"."uid"() THEN NULL;                       -- Thường trực đóng luồng của mình
    ELSIF "public"."me_thu_ky_tt"() THEN v_thay_mat := true;           -- thư ký đóng thay mặt
    ELSE RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy (hoặc thư ký Thường trực thay mặt) mới đóng chỉ đạo Thường trực.' USING ERRCODE = '42501';
    END IF;
  ELSIF "public"."me_la_a0"() THEN
    RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ đóng chỉ đạo Thường trực do chính mình gửi.' USING ERRCODE = '42501';
  ELSIF v."id" IS NULL OR NOT (v."nguoi_gui" = "auth"."uid"() OR "public"."me_quan_tri_kl"()) THEN
    RAISE EXCEPTION 'Chỉ người ra chỉ đạo mới đóng được chỉ đạo này.' USING ERRCODE = '42501';   -- thư ký không đóng loại khác (kể cả của A1/A2)
  END IF;
  IF v."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo này đã đóng.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."chi_dao" SET "trang_thai" = 'DA_DONG', "dong_boi" = "auth"."uid"(), "dong_luc" = now() WHERE "id" = "p_id";
  IF v."loai" = 'CHI_DAO_TT' THEN
    SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = v."nhiem_vu_id";
    IF v_thay_mat THEN
      SELECT "full_name" INTO v_ten FROM "public"."accounts" WHERE "id" = "auth"."uid"();
      PERFORM "public"."chi_dao_tt_ghi_vet"(v."nhiem_vu_id", format('Đóng thay mặt Thường trực — %s · %s: %s', v_ten, v_ma, left(v."noi_dung", 120)),
                                              v."nguoi_nhan" || v."nguoi_gui");
    ELSE
      PERFORM "public"."chi_dao_tt_ghi_vet"(v."nhiem_vu_id", format('Đóng chỉ đạo Thường trực · %s: %s', v_ma, left(v."noi_dung", 120)), v."nguoi_nhan");
    END IF;
  ELSE
    PERFORM "public"."chi_dao_ghi_vet"(v."nhiem_vu_id", 'DONG', v."noi_dung");
  END IF;
END;
$$;

-- 4. Policy SELECT: thêm nhánh thư ký (chỉ đọc). Tên policy giữ như 0016/0025/0028 (đổi tên bảng không đổi tên policy). Nhánh viết
--    "(SELECT me_thu_ky_tt()) AND thu_ky_tt_thay(x)": InitPlan tính một lần/truy vấn → người không phải thư ký tắt nhánh ngay, không gọi hàm từng dòng.
DROP POLICY "nhiem_vu_select" ON "public"."nhiem_vu";
CREATE POLICY "nhiem_vu_select" ON "public"."nhiem_vu" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_pham_vi"("nguoi_theo_doi", "nganh_ma", "linh_vuc_ma", "owner_tai_khoan", "owner_don_vi_ma")) OR ((SELECT "public"."me_thu_ky_tt"()) AND "public"."thu_ky_tt_thay"("id")));
DROP POLICY "van_ban_giao_viec_select" ON "public"."van_ban_giao_viec";
CREATE POLICY "van_ban_giao_viec_select" ON "public"."van_ban_giao_viec" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"())
         OR EXISTS (SELECT 1 FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = "van_ban_giao_viec"."id"
                    AND ("public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma", n."owner_tai_khoan", n."owner_don_vi_ma") OR ((SELECT "public"."me_thu_ky_tt"()) AND "public"."thu_ky_tt_thay"(n."id")))));
DROP POLICY "kl_chi_dao_select" ON "public"."chi_dao";
CREATE POLICY "kl_chi_dao_select" ON "public"."chi_dao" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_thay_nhiem_vu"("nhiem_vu_id")) OR ((SELECT "public"."me_thu_ky_tt"()) AND "public"."thu_ky_tt_thay"("nhiem_vu_id")));
DROP POLICY "kl_lich_su_select" ON "public"."lich_su";
CREATE POLICY "kl_lich_su_select" ON "public"."lich_su" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."kl_thay_nhiem_vu"("nhiem_vu_id")) OR ((SELECT "public"."me_thu_ky_tt"()) AND "public"."thu_ky_tt_thay"("nhiem_vu_id")));
DROP POLICY "minh_chung_select" ON "public"."minh_chung";
CREATE POLICY "minh_chung_select" ON "public"."minh_chung" FOR SELECT TO "authenticated"
  USING ("public"."kl_thay_nhiem_vu"("nhiem_vu_id") OR ((SELECT "public"."me_thu_ky_tt"()) AND "public"."thu_ky_tt_thay"("nhiem_vu_id")));

-- 5. v_chi_dao_tt: thêm ba cột cuối.
CREATE OR REPLACE VIEW "public"."v_chi_dao_tt" WITH ("security_invoker" = true) AS
SELECT c."id", c."nhiem_vu_id", nv."ma", nv."noi_dung" AS "nhiem_vu_noi_dung", nv."han_xu_ly", c."nguoi_gui", c."noi_dung", c."han_phan_hoi",
       c."trang_thai", c."nguoi_nhan", c."phan_hoi", c."phan_hoi_boi", c."phan_hoi_luc", c."created_at",
       (c."trang_thai" = 'CHO_PHAN_HOI' AND c."han_phan_hoi" < "public"."kl_hom_nay"()) AS "qua_han_phan_hoi",
       (SELECT array_agg(a."full_name" ORDER BY a."full_name") FROM "public"."accounts" a WHERE a."id" = ANY (c."nguoi_nhan")) AS "nguoi_nhan_ten",
       c."dong_boi", (SELECT a."full_name" FROM "public"."accounts" a WHERE a."id" = c."dong_boi") AS "dong_boi_ten", c."do_khan"
FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
WHERE c."loai" = 'CHI_DAO_TT'
ORDER BY (c."trang_thai" = 'CHO_PHAN_HOI') DESC, c."han_phan_hoi", c."created_at" DESC;

-- 6. Lỗi phát hiện khi kiểm ma trận thư ký: xac_nhan_nhan_viec (0025) so sánh "owner_tai_khoan = uid" với owner_tai_khoan NULL (Owner là đơn vị)
--    → biểu thức NULL, NOT NULL không kích RAISE → BẤT KỲ tài khoản nào cũng xác nhận được. Sửa: dùng IS NOT TRUE như nop_minh_chung (0028).
CREATE OR REPLACE FUNCTION "public"."xac_nhan_nhan_viec"("p_id" uuid) RETURNS boolean
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR (v."nguoi_theo_doi" = "auth"."uid"() OR v."owner_tai_khoan" = "auth"."uid"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới xác nhận đã nhận việc.' USING ERRCODE = '42501';
  END IF;
  IF v."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã đóng, không còn xác nhận nhận việc.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."lich_su" WHERE "nhiem_vu_id" = "p_id" AND "cot" = 'xac_nhan_nhan_viec' AND "nguoi_sua" = "auth"."uid"()) THEN
    RETURN false;
  END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_id", "auth"."uid"(), 'xac_nhan_nhan_viec', to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI'), 'app');
  RETURN true;
END;
$$;
