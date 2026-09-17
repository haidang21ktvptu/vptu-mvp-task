-- 0041 — GĐ23: hồ sơ cá nhân, tuỳ chọn thông báo, ủy quyền giao việc có hạn (A2), ngưỡng cảnh báo (CVP), phân công phụ trách mở cho CVP,
-- nhật ký hệ thống (Edge Function quan-tri-tai-khoan ghi; dòng hanh_dong = 'backup' là mốc backup gần nhất). Phần còn lại (mốc backup, bản tin 7h30,
-- kl_so_chua_xu_ly thêm thong_bao, dọn dữ liệu) ở 0042 để mỗi file dưới 300 dòng.
-- Cờ đổi mật khẩu lần đầu dùng lại accounts.must_change_password (0004: trigger tự tắt khi đổi mật khẩu) + RPC xoa_co_doi_mat_khau() chính chủ.

-- 1. accounts: điện thoại, ảnh, tuỳ chọn (am_chuong, gom_tin, ban_gon), hạn ủy quyền quan_tri_kl, cờ khoá (Edge Function đặt khi ban/unban).
ALTER TABLE "public"."accounts"
  ADD COLUMN "dien_thoai" text,
  ADD COLUMN "anh_url" text,
  ADD COLUMN "tuy_chon" jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "quan_tri_kl_het_han" date,
  ADD COLUMN "bi_khoa" boolean NOT NULL DEFAULT false;
GRANT SELECT ("dien_thoai", "anh_url", "tuy_chon", "quan_tri_kl_het_han", "bi_khoa") ON "public"."accounts" TO "authenticated";

-- quan_tri_kl trong view = cờ còn hiệu lực (ủy quyền hết hạn → false); frontend chỉ đọc view.
CREATE OR REPLACE VIEW "public"."accounts_public" WITH ("security_invoker" = true) AS
SELECT "id", "username", "full_name", "role_group", "position_title", "created_at", "manager_id", "department", "must_change_password",
       "is_chief", "is_system",
       ("quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"())) AS "quan_tri_kl",
       "quan_tri_he_thong", "dien_thoai", "anh_url", "tuy_chon", "quan_tri_kl_het_han", "bi_khoa"
FROM "public"."accounts";

CREATE OR REPLACE FUNCTION "public"."me_quan_tri_kl"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "quan_tri_kl" AND ("quan_tri_kl_het_han" IS NULL OR "quan_tri_kl_het_han" >= "public"."kl_hom_nay"())
                   FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

-- 2. Nhật ký hệ thống: mọi thao tác quản trị (tài khoản, cấu hình, dọn dữ liệu, backup). nguoi NULL = job/CLI. Chỉ quan_tri_he_thong đọc.
CREATE TABLE "public"."nhat_ky_he_thong" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "nguoi" uuid REFERENCES "public"."accounts"("id") ON DELETE SET NULL,
  "hanh_dong" text NOT NULL,
  "doi_tuong" text,
  "chi_tiet" jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX "nhat_ky_he_thong_luc_idx" ON "public"."nhat_ky_he_thong" ("luc" DESC);
ALTER TABLE "public"."nhat_ky_he_thong" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."nhat_ky_he_thong" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."nhat_ky_he_thong" TO "authenticated";
CREATE POLICY "nhat_ky_he_thong_select_qtht" ON "public"."nhat_ky_he_thong" FOR SELECT TO "authenticated" USING ((SELECT "public"."me_quan_tri_he_thong"()));

CREATE FUNCTION "public"."nhat_ky_ghi"("p_hanh_dong" text, "p_doi_tuong" text, "p_chi_tiet" jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE "sql" SECURITY DEFINER SET "search_path" = "public" AS $$
  INSERT INTO "public"."nhat_ky_he_thong" ("nguoi", "hanh_dong", "doi_tuong", "chi_tiet") VALUES ("auth"."uid"(), "p_hanh_dong", "p_doi_tuong", coalesce("p_chi_tiet", '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION "public"."nhat_ky_ghi"(text, text, jsonb) FROM "public", "anon", "authenticated";

-- 3. Chính chủ: xoá cờ đổi mật khẩu (sau supabase.auth.updateUser), sửa điện thoại/ảnh, tuỳ chọn thông báo.
CREATE FUNCTION "public"."xoa_co_doi_mat_khau"() RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  UPDATE "public"."accounts" SET "must_change_password" = false WHERE "id" = "auth"."uid"();
END;
$$;

CREATE FUNCTION "public"."cap_nhat_ho_so"("p_dien_thoai" text, "p_anh_url" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_dt text := nullif(btrim(coalesce("p_dien_thoai", '')), '');
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  IF v_dt IS NOT NULL AND v_dt !~ '^[0-9][0-9 .()+-]{7,19}$' THEN
    RAISE EXCEPTION 'Số điện thoại không hợp lệ (8–20 ký tự số).' USING ERRCODE = '22023';
  END IF;
  IF "p_anh_url" IS NOT NULL AND ("p_anh_url" !~ '^https://' OR length("p_anh_url") > 500) THEN
    RAISE EXCEPTION 'Đường dẫn ảnh không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."accounts" SET "dien_thoai" = v_dt, "anh_url" = "p_anh_url" WHERE "id" = "auth"."uid"();
END;
$$;

-- Chỉ nhận khoá boolean đã biết; khoá khác bị bỏ qua.
CREATE FUNCTION "public"."dat_tuy_chon"("p_tuy_chon" jsonb) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_moi jsonb;
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO v_moi FROM jsonb_each(coalesce("p_tuy_chon", '{}'::jsonb)) AS e(k, v)
  WHERE k IN ('am_chuong', 'gom_tin', 'ban_gon') AND jsonb_typeof(v) = 'boolean';
  UPDATE "public"."accounts" SET "tuy_chon" = "tuy_chon" || v_moi WHERE "id" = "auth"."uid"() RETURNING "tuy_chon" INTO v_moi;
  RETURN v_moi;
END;
$$;

-- 4. Ảnh hồ sơ: bucket công khai đọc, mỗi người chỉ ghi trong thư mục <uid>/.
INSERT INTO "storage"."buckets" ("id", "name", "public", "file_size_limit", "allowed_mime_types")
VALUES ('anh-ho-so', 'anh-ho-so', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']) ON CONFLICT ("id") DO NOTHING;
CREATE POLICY "anh_ho_so_ghi" ON "storage"."objects" FOR INSERT TO "authenticated"
  WITH CHECK ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = ("auth"."uid"())::text);
CREATE POLICY "anh_ho_so_sua" ON "storage"."objects" FOR UPDATE TO "authenticated"
  USING ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = ("auth"."uid"())::text);
CREATE POLICY "anh_ho_so_xoa" ON "storage"."objects" FOR DELETE TO "authenticated"
  USING ("bucket_id" = 'anh-ho-so' AND ("storage"."foldername"("name"))[1] = ("auth"."uid"())::text);

-- 5. Ngưỡng cảnh báo (kl_cau_hinh): chỉ Chánh Văn phòng hoặc quan_tri_he_thong sửa, qua hàm, có lý do, ghi nhật ký; bỏ quyền UPDATE thẳng bảng.
-- Bỏ policy UPDATE (UPDATE thẳng qua REST trả 0 dòng); GRANT giữ nguyên để không đổi cách các test RLS cũ kiểm "không sửa được".
DROP POLICY IF EXISTS "kl_cau_hinh_update_qtkl" ON "public"."kl_cau_hinh";

CREATE FUNCTION "public"."la_chanh_van_phong"() RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce((SELECT "role_group" = 'A1' AND "is_chief" FROM "public"."accounts" WHERE "id" = "auth"."uid"()), false);
$$;

CREATE FUNCTION "public"."qt_dat_cau_hinh"("p_khoa" text, "p_gia_tri" text, "p_ly_do" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_cu text;
BEGIN
  IF NOT ("public"."me_quan_tri_he_thong"() OR "public"."la_chanh_van_phong"()) THEN
    RAISE EXCEPTION 'Chỉ Chánh Văn phòng hoặc quản trị hệ thống mới được sửa ngưỡng.' USING ERRCODE = '42501';
  END IF;
  IF "p_gia_tri" !~ '^[0-9]{1,4}$' OR "p_gia_tri"::integer < 1 THEN RAISE EXCEPTION 'Giá trị phải là số nguyên từ 1 đến 9999.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do thay đổi.' USING ERRCODE = '22023'; END IF;
  SELECT "gia_tri" INTO v_cu FROM "public"."kl_cau_hinh" WHERE "khoa" = "p_khoa";
  IF v_cu IS NULL THEN RAISE EXCEPTION 'Không có khoá cấu hình "%".', "p_khoa" USING ERRCODE = '22023'; END IF;
  UPDATE "public"."kl_cau_hinh" SET "gia_tri" = "p_gia_tri" WHERE "khoa" = "p_khoa";
  PERFORM "public"."nhat_ky_ghi"('cau_hinh', "p_khoa", jsonb_build_object('cu', v_cu, 'moi', "p_gia_tri", 'ly_do', btrim("p_ly_do")));
END;
$$;

-- 6. Phân công phụ trách: thêm Chánh Văn phòng được phân công (trước chỉ quan_tri_he_thong / CLI). Thân hàm nguyên văn 0018 (7 tham số, kiêm nhiệm
--    lĩnh vực), chỉ đổi phép kiểm người gọi. Không tạo thêm chữ ký khác (0018 đã DROP bản 5 tham số của 0013).
CREATE FUNCTION "public"."admin_kiem_tra_nguoi_goi_phan_cong"() RETURNS text
LANGUAGE "plpgsql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF "auth"."uid"() IS NULL AND session_user = 'postgres' THEN RETURN 'qua CLI'; END IF;
  IF "public"."me_quan_tri_he_thong"() THEN RETURN NULL; END IF;
  IF "public"."la_chanh_van_phong"() THEN RETURN 'Chánh Văn phòng'; END IF;
  RAISE EXCEPTION 'Chỉ Chánh Văn phòng hoặc quản trị hệ thống mới được phân công.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION "public"."admin_kiem_tra_nguoi_goi_phan_cong"() FROM "public", "anon", "authenticated";

CREATE OR REPLACE FUNCTION "public"."admin_phan_cong_phong"(
  "p_username" text, "p_phong" text, "p_bat" boolean, "p_ly_do" text,
  "p_tu_ngay" date DEFAULT "public"."kl_hom_nay"(), "p_nganh_ma" text DEFAULT NULL, "p_linh_vuc_ma" text DEFAULT NULL)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_id uuid; v_n integer; v_ten text;
        v_phong text := nullif(btrim(coalesce("p_phong", '')), '');
        v_nganh text := nullif(btrim(coalesce("p_nganh_ma", '')), '');
        v_lv text := nullif(btrim(coalesce("p_linh_vuc_ma", '')), '');
        v_co text;
BEGIN
  v_ghi_chu := "public"."admin_kiem_tra_nguoi_goi_phan_cong"();
  IF v_phong IS NULL OR "p_tu_ngay" IS NULL THEN
    RAISE EXCEPTION 'Thiếu phòng hoặc ngày hiệu lực.' USING ERRCODE = '22023';
  END IF;
  IF (v_nganh IS NULL) <> (v_lv IS NULL) THEN
    RAISE EXCEPTION 'Kiêm nhiệm phải có đủ cả ngành và lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF v_lv IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_lv AND "nganh_ma" = v_nganh) THEN
    RAISE EXCEPTION 'Lĩnh vực "%" không thuộc ngành "%".', v_lv, v_nganh USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do phân công.' USING ERRCODE = '22023';
  END IF;
  SELECT "id" INTO v_id FROM "public"."accounts"
  WHERE "username" = "p_username" AND "role_group" = 'A1' AND NOT "is_chief";
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Chỉ phân công cho Phó Chánh Văn phòng ("%" không phải).', "p_username" USING ERRCODE = '22023';
  END IF;
  v_co := CASE WHEN v_lv IS NULL THEN 'phu_trach:' || v_phong ELSE 'kiem_nhiem:' || v_phong || ':' || v_nganh || ':' || v_lv END;
  IF "p_bat" THEN
    IF v_lv IS NULL THEN
      SELECT count(*) INTO v_n FROM "public"."phu_trach_phong"
      WHERE "lanh_dao_id" = v_id AND "nganh_ma" IS NULL AND ("den_ngay" IS NULL OR "den_ngay" >= "p_tu_ngay");
      IF v_n >= 2 THEN
        RAISE EXCEPTION 'Mỗi Phó Chánh Văn phòng phụ trách tối đa 2 phòng (đã có %). Kết thúc một phân công trước.', v_n USING ERRCODE = '22023';
      END IF;
    ELSE
      SELECT "a"."full_name" INTO v_ten FROM "public"."phu_trach_phong" "p" JOIN "public"."accounts" "a" ON "a"."id" = "p"."lanh_dao_id"
      WHERE "p"."phong" = v_phong AND "p"."nganh_ma" = v_nganh AND "p"."linh_vuc_ma" = v_lv AND "p"."lanh_dao_id" <> v_id
        AND daterange("p"."tu_ngay", "p"."den_ngay", '[]') && daterange("p_tu_ngay", NULL, '[]') LIMIT 1;
      IF v_ten IS NOT NULL THEN
        RAISE EXCEPTION 'Lĩnh vực này đang do % kiêm nhiệm trong cùng thời kỳ.', v_ten USING ERRCODE = '22023';
      END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM "public"."phu_trach_phong" "p" WHERE "p"."lanh_dao_id" = v_id AND "p"."phong" = v_phong
                 AND "p"."nganh_ma" IS NOT DISTINCT FROM v_nganh AND "p"."linh_vuc_ma" IS NOT DISTINCT FROM v_lv
                 AND daterange("p"."tu_ngay", "p"."den_ngay", '[]') && daterange("p_tu_ngay", NULL, '[]')) THEN
      RAISE EXCEPTION 'Đã có phân công trùng kỳ cho lãnh đạo này.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO "public"."phu_trach_phong" ("lanh_dao_id", "phong", "nganh_ma", "linh_vuc_ma", "tu_ngay", "ly_do", "phan_cong_boi")
    VALUES (v_id, v_phong, v_nganh, v_lv, "p_tu_ngay", btrim("p_ly_do"), "auth"."uid"());
  ELSE
    UPDATE "public"."phu_trach_phong" SET "den_ngay" = "p_tu_ngay" - 1
    WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "nganh_ma" IS NOT DISTINCT FROM v_nganh
      AND "linh_vuc_ma" IS NOT DISTINCT FROM v_lv AND "den_ngay" IS NULL AND "tu_ngay" < "p_tu_ngay";
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      -- Bật và tắt cùng ngày, hoặc kết thúc một phân công ghi trước cho tương lai: chưa từng có hiệu lực nên xoá.
      DELETE FROM "public"."phu_trach_phong"
      WHERE "lanh_dao_id" = v_id AND "phong" = v_phong AND "nganh_ma" IS NOT DISTINCT FROM v_nganh
        AND "linh_vuc_ma" IS NOT DISTINCT FROM v_lv AND "den_ngay" IS NULL AND "tu_ngay" >= "p_tu_ngay";
      GET DIAGNOSTICS v_n = ROW_COUNT;
    END IF;
    IF v_n = 0 THEN
      RAISE EXCEPTION 'Không có phân công đang hiệu lực để kết thúc.' USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, v_id, v_co, "p_bat",
          btrim("p_ly_do") || ' (hiệu lực ' || to_char("p_tu_ngay", 'DD/MM/YYYY') || ')');
END;
$$;

-- 7. Ủy quyền giao việc (A2): cấp quan_tri_kl có hạn (≤ 90 ngày) cho MỘT chuyên viên phòng mình; thu lại được. Ghi quyen_lich_su.
--    Hạn kiểm ở me_quan_tri_kl()/view; các trigger đọc thẳng cột quan_tri_kl được dọn bởi uy_quyen_thu_het_han() (job 7h30 và mỗi lần cấp).
CREATE FUNCTION "public"."uy_quyen_thu_het_han"() RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  WITH t AS (UPDATE "public"."accounts" SET "quan_tri_kl" = false, "quan_tri_kl_het_han" = NULL
             WHERE "quan_tri_kl_het_han" IS NOT NULL AND "quan_tri_kl_het_han" < "public"."kl_hom_nay"() RETURNING "id", "quan_tri_kl_het_han")
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  SELECT NULL, 'hết hạn ủy quyền', "id", 'quan_tri_kl', false, 'Ủy quyền giao việc hết hạn ' || to_char("quan_tri_kl_het_han", 'DD/MM/YYYY') FROM t;
  GET DIAGNOSTICS v_n = ROW_COUNT; RETURN v_n;
END;
$$;

CREATE FUNCTION "public"."a2_uy_quyen"("p_nguoi" uuid, "p_den_ngay" date, "p_ly_do" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_me "public"."accounts"%ROWTYPE; v_nguoi "public"."accounts"%ROWTYPE;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_me."id" IS NULL OR v_me."role_group" <> 'A2' THEN RAISE EXCEPTION 'Chỉ Trưởng phòng mới được ủy quyền giao việc.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_nguoi FROM "public"."accounts" WHERE "id" = "p_nguoi";
  IF v_nguoi."id" IS NULL OR v_nguoi."role_group" <> 'A3' OR v_nguoi."is_system" OR v_nguoi."department" IS DISTINCT FROM v_me."department" THEN
    RAISE EXCEPTION 'Chỉ ủy quyền cho chuyên viên trong phòng mình.' USING ERRCODE = '22023';
  END IF;
  IF v_nguoi."quan_tri_kl" AND v_nguoi."quan_tri_kl_het_han" IS NULL THEN RAISE EXCEPTION 'Người này đã có quyền quản trị KL thường trực.' USING ERRCODE = '22023'; END IF;
  IF "p_den_ngay" IS NULL OR "p_den_ngay" < "public"."kl_hom_nay"() OR "p_den_ngay" > "public"."kl_hom_nay"() + 90 THEN
    RAISE EXCEPTION 'Hạn ủy quyền phải từ hôm nay đến tối đa 90 ngày.' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN RAISE EXCEPTION 'Phải ghi lý do ủy quyền.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."uy_quyen_thu_het_han"();
  IF EXISTS (SELECT 1 FROM "public"."accounts" WHERE "department" = v_me."department" AND "quan_tri_kl_het_han" IS NOT NULL AND "id" <> "p_nguoi") THEN
    RAISE EXCEPTION 'Mỗi phòng chỉ ủy quyền cho một chuyên viên tại một thời điểm.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."accounts" SET "quan_tri_kl" = true, "quan_tri_kl_het_han" = "p_den_ngay" WHERE "id" = "p_nguoi";
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES (v_me."id", 'Trưởng phòng ủy quyền', "p_nguoi", 'quan_tri_kl', true, btrim("p_ly_do") || ' (đến ' || to_char("p_den_ngay", 'DD/MM/YYYY') || ')');
END;
$$;

CREATE FUNCTION "public"."a2_thu_uy_quyen"("p_nguoi" uuid, "p_ly_do" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_me "public"."accounts"%ROWTYPE; v_n integer;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_me."id" IS NULL OR v_me."role_group" <> 'A2' THEN RAISE EXCEPTION 'Chỉ Trưởng phòng mới được thu ủy quyền.' USING ERRCODE = '42501'; END IF;
  UPDATE "public"."accounts" SET "quan_tri_kl" = false, "quan_tri_kl_het_han" = NULL
  WHERE "id" = "p_nguoi" AND "department" = v_me."department" AND "quan_tri_kl_het_han" IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'Người này không có ủy quyền đang hiệu lực trong phòng.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."quyen_lich_su" ("cap_boi", "cap_boi_ghi_chu", "tai_khoan", "co", "bat", "ly_do")
  VALUES (v_me."id", 'Trưởng phòng thu ủy quyền', "p_nguoi", 'quan_tri_kl', false, coalesce(nullif(btrim("p_ly_do"), ''), 'Thu ủy quyền giao việc'));
END;
$$;

-- 8. Quyền gọi: chính chủ/vai → authenticated; job → service_role (uy_quyen_thu_het_han). Mốc backup, bản tin 7h30, kl_so_chua_xu_ly: 0042.
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['xoa_co_doi_mat_khau()', 'cap_nhat_ho_so(text,text)', 'dat_tuy_chon(jsonb)', 'la_chanh_van_phong()',
    'qt_dat_cau_hinh(text,text,text)', 'a2_uy_quyen(uuid,date,text)', 'a2_thu_uy_quyen(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.uy_quyen_thu_het_han() FROM public, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.uy_quyen_thu_het_han() TO service_role;
END $$;
