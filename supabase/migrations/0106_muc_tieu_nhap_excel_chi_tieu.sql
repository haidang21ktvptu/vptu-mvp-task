-- 0106 (v3.24, chủ dự án duyệt 16/10/2026 — đề xuất Tổng quan, câu 4–5): mục tiêu then chốt khi nhập Excel; kết quả chỉ tiêu chủ yếu (bước C).
-- 1. Nhập Excel: cột "Mục tiêu then chốt" của mẫu nhập (frontend gửi du_lieu.muc_tieu_ma — mảng mã đã khớp danh mục) gắn vào việc do lô TẠO: trigger
--    sau INSERT dong_nhap với kết quả GIAO / DA_XONG / CHO_NGHIEM_THU (người nhập là người tạo việc trong cùng giao dịch); mã không có / ngừng dùng bị
--    bỏ, tối đa 10; lịch sử 'gan_muc_tieu' nguồn excel. Lô chỉ CẬP NHẬT việc có sẵn (CAP_NHAT) không đổi mục tiêu (sửa ở ngăn chi tiết); dòng chờ
--    hoàn thiện mang mục tiêu sang biểu mẫu Giao việc (frontend). Hoàn tác lô xoá việc → mục tiêu xoá theo (ON DELETE CASCADE).
--    kl_truong_nhap (bản 0093) thêm 'muc_tieu' — hồ sơ ghép cột lưu được cột này.
-- 2. Bước C (production chưa có số liệu chỉ tiêu — dựng sẵn, giao diện chưa hiển thị cho tới khi có kết quả hoặc có việc gắn chỉ tiêu):
--    chi_tieu_ket_qua — kết quả theo kỳ (năm '2026', quý '2026-Q3', tháng '2026-09') của một chỉ tiêu chủ yếu (dm_muc_tieu nhóm CHI_TIEU), giá trị
--    dạng chữ như báo cáo ('8,2%', '72 triệu đồng'), đánh giá (vượt / đạt / chưa đạt), nguồn số liệu. Mọi tài khoản đăng nhập đọc; ghi qua
--    ghi_ket_qua_chi_tieu (một kỳ một dòng — ghi lại thì thay) / xoa_ket_qua_chi_tieu: quản trị hệ thống, Chánh VP, toàn quyền.

-- ---- 1 ----
CREATE FUNCTION "public"."kl_dong_nhap_gan_muc_tieu"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ma text[];
BEGIN
  IF NEW."nhiem_vu_id" IS NULL OR NEW."ket_qua" NOT IN ('GIAO', 'DA_XONG', 'CHO_NGHIEM_THU')
     OR jsonb_typeof(NEW."du_lieu" -> 'muc_tieu_ma') IS DISTINCT FROM 'array' THEN
    RETURN NULL;
  END IF;
  SELECT (array_agg(DISTINCT d."ma" ORDER BY d."ma"))[1:10] INTO v_ma
  FROM jsonb_array_elements_text(NEW."du_lieu" -> 'muc_tieu_ma') x(ma) JOIN "public"."dm_muc_tieu" d ON d."ma" = btrim(x.ma) AND d."dang_dung";
  IF v_ma IS NULL OR cardinality(v_ma) = 0 THEN RETURN NULL; END IF;
  INSERT INTO "public"."nhiem_vu_muc_tieu" ("nhiem_vu_id", "muc_tieu_ma", "gan_boi")
  SELECT NEW."nhiem_vu_id", u, "auth"."uid"() FROM unnest(v_ma) u ON CONFLICT DO NOTHING;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
  VALUES (NEW."nhiem_vu_id", "auth"."uid"(), 'gan_muc_tieu', NULL, 'Gắn mục tiêu then chốt (nhập Excel): ' || "public"."kl_ten_muc_tieu"(v_ma), 'excel');
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_dong_nhap_gan_muc_tieu"() FROM public, "anon", "authenticated";
CREATE TRIGGER "ai_dong_nhap_gan_muc_tieu" AFTER INSERT ON "public"."dong_nhap"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_dong_nhap_gan_muc_tieu"();

CREATE OR REPLACE FUNCTION "public"."kl_truong_nhap"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ma', 'loai_van_ban', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'noi_dung', 'don_vi', 'can_bo', 'theo_doi', 'lanh_dao_giao',
               'loai_thoi_han', 'han_xu_ly', 'san_pham', 'cap_nhan', 'do_khan', 'nguon', 'nganh', 'linh_vuc', 'tien_do', 'vuong_mac',
               'kq_so_hieu', 'kq_ngay', 'kq_trich_yeu', 'kq_mo_ta', 'chat_luong',
               'linh_vuc_chi_tiet', 'van_ban_trien_khai', 'han_nop', 'don_vi_phoi_hop', 'ghi_chu',
               'muc_quan_trong', 'co_quan_trinh', 'thuong_truc_chi_dao',   -- 0093
               'muc_tieu']::text[];   -- 0106
$$;
REVOKE ALL ON FUNCTION "public"."kl_truong_nhap"() FROM public, "anon", "authenticated";

-- ---- 2 ----
CREATE TABLE "public"."chi_tieu_ket_qua" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "muc_tieu_ma" text NOT NULL REFERENCES "public"."dm_muc_tieu"("ma"),
  "ky" text NOT NULL CONSTRAINT "chi_tieu_ket_qua_ky_check" CHECK ("ky" ~ '^[0-9]{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$'),
  "gia_tri" text NOT NULL CONSTRAINT "chi_tieu_ket_qua_gia_tri_check" CHECK (btrim("gia_tri") <> '' AND char_length("gia_tri") <= 100),
  "danh_gia" text CONSTRAINT "chi_tieu_ket_qua_danh_gia_check" CHECK ("danh_gia" IN ('VUOT', 'DAT', 'CHUA_DAT')),
  "nguon" text CONSTRAINT "chi_tieu_ket_qua_nguon_check" CHECK (char_length("nguon") <= 300),
  "nhap_boi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "nhap_luc" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "chi_tieu_ket_qua_ky_key" UNIQUE ("muc_tieu_ma", "ky")
);
COMMENT ON TABLE "public"."chi_tieu_ket_qua" IS '0106 (bước C): kết quả theo kỳ của chỉ tiêu chủ yếu; ghi qua ghi_ket_qua_chi_tieu (quản trị hệ thống, Chánh VP).';
ALTER TABLE "public"."chi_tieu_ket_qua" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."chi_tieu_ket_qua" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."chi_tieu_ket_qua" TO "authenticated";
CREATE POLICY "chi_tieu_ket_qua_select" ON "public"."chi_tieu_ket_qua" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

CREATE FUNCTION "public"."kl_duoc_ghi_chi_tieu"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "auth"."uid"() IS NOT NULL AND (coalesce("public"."me_quan_tri_he_thong"(), false) OR coalesce("public"."me_is_chief"(), false))
    AND EXISTS (SELECT 1 FROM "public"."accounts" a WHERE a."id" = "auth"."uid"() AND NOT a."is_system" AND NOT coalesce(a."bi_khoa", false));
$$;
CREATE FUNCTION "public"."ghi_ket_qua_chi_tieu"("p_ma" text, "p_ky" text, "p_gia_tri" text, "p_danh_gia" text DEFAULT NULL, "p_nguon" text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_ky text := btrim(coalesce("p_ky", '')); v_gt text := btrim(coalesce("p_gia_tri", ''));
BEGIN
  IF NOT "public"."kl_duoc_ghi_chi_tieu"() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống hoặc Chánh Văn phòng mới nhập kết quả chỉ tiêu.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "public"."dm_muc_tieu" WHERE "ma" = "p_ma" AND "nhom" = 'CHI_TIEU') THEN
    RAISE EXCEPTION 'Không có chỉ tiêu này trong danh mục chỉ tiêu chủ yếu.' USING ERRCODE = '22023';
  END IF;
  IF v_ky !~ '^[0-9]{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$' THEN RAISE EXCEPTION 'Kỳ ghi dạng 2026, 2026-Q3 hoặc 2026-09.' USING ERRCODE = '22023'; END IF;
  IF v_gt = '' OR char_length(v_gt) > 100 THEN RAISE EXCEPTION 'Kết quả bắt buộc, tối đa 100 ký tự.' USING ERRCODE = '22023'; END IF;
  IF nullif("p_danh_gia", '') IS NOT NULL AND "p_danh_gia" NOT IN ('VUOT', 'DAT', 'CHUA_DAT') THEN
    RAISE EXCEPTION 'Đánh giá chỉ nhận vượt, đạt hoặc chưa đạt.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."chi_tieu_ket_qua" ("muc_tieu_ma", "ky", "gia_tri", "danh_gia", "nguon", "nhap_boi")
  VALUES ("p_ma", v_ky, v_gt, nullif("p_danh_gia", ''), left(nullif(btrim(coalesce("p_nguon", '')), ''), 300), "auth"."uid"())
  ON CONFLICT ("muc_tieu_ma", "ky") DO UPDATE SET "gia_tri" = EXCLUDED."gia_tri", "danh_gia" = EXCLUDED."danh_gia", "nguon" = EXCLUDED."nguon",
    "nhap_boi" = EXCLUDED."nhap_boi", "nhap_luc" = now()
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."xoa_ket_qua_chi_tieu"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT "public"."kl_duoc_ghi_chi_tieu"() THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống hoặc Chánh Văn phòng mới xoá kết quả chỉ tiêu.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM "public"."chi_tieu_ket_qua" WHERE "id" = "p_id";
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_duoc_ghi_chi_tieu"() FROM public, "anon", "authenticated";
REVOKE ALL ON FUNCTION "public"."ghi_ket_qua_chi_tieu"(text, text, text, text, text), "public"."xoa_ket_qua_chi_tieu"(uuid) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ghi_ket_qua_chi_tieu"(text, text, text, text, text), "public"."xoa_ket_qua_chi_tieu"(uuid) TO "authenticated";
