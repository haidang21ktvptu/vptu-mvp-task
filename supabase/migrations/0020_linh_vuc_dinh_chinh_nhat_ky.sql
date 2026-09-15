-- GĐ9 (PR 9B) — ba việc đóng GĐ9 (docs/thiet-ke-theo-doi-kl-btvtu.md Phần 4 GĐ9, 5.4, 6.4):
-- 1) cho phép đính chính cột linh_vuc_ma; 2) nhật ký danh mục dm_lich_su; 3) thêm/sửa dm_linh_vuc chỉ qua hàm
-- có lý do + nhật ký (nguyên tắc "mọi thay đổi quản trị đều có vết"), thu quyền ghi thẳng bảng đã cấp ở 0018.
-- Ánh xạ dữ liệu cũ (linh_vuc_chi_tiet → linh_vuc_ma) do scripts/anh-xa-linh-vuc.mjs làm ở bước riêng, không ở đây.

-- 1. Đính chính linh_vuc_ma: kl_duyet_dinh_chinh (0015) UPDATE cột theo tên, FK ghép (0018) bảo đảm lĩnh vực thuộc
--    đúng ngành của dòng ngay lúc duyệt; giá trị mới NULL = bỏ lĩnh vực.
ALTER TABLE "public"."kl_dinh_chinh" DROP CONSTRAINT "kl_dinh_chinh_cot_check";
ALTER TABLE "public"."kl_dinh_chinh" ADD CONSTRAINT "kl_dinh_chinh_cot_check"
  CHECK ("cot" IN ('han_xu_ly', 'loai_thoi_han_ma', 'tien_do_ma', 'ngay_hoan_thanh', 'minh_chung', 'nganh_ma',
                   'co_quan_trinh_ma', 'ly_do_chua_co_han', 'linh_vuc_ma'));

-- 2. Nhật ký danh mục: không xoá, không sửa được (chỉ hàm ghi). Người có quan_tri_kl hoặc quan_tri_he_thong đọc.
CREATE TABLE "public"."dm_lich_su" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  "nguoi" uuid REFERENCES "public"."accounts"("id"),
  "nguoi_ghi_chu" text,
  "bang" text NOT NULL,
  "ma" text NOT NULL,
  "hanh_dong" text NOT NULL CHECK ("hanh_dong" IN ('them', 'sua')),
  "gia_tri_cu" jsonb,
  "gia_tri_moi" jsonb,
  "ly_do" text NOT NULL
);
CREATE INDEX "dm_lich_su_bang_ma_idx" ON "public"."dm_lich_su" ("bang", "ma", "luc" DESC);
ALTER TABLE "public"."dm_lich_su" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_lich_su" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_lich_su" TO "authenticated";
CREATE POLICY "dm_lich_su_select_quan_tri" ON "public"."dm_lich_su" FOR SELECT TO "authenticated"
  USING ((SELECT "public"."me_quan_tri_kl"()) OR (SELECT "public"."me_quan_tri_he_thong"()));

-- 3. Thu quyền ghi thẳng dm_linh_vuc (0018 cấp cho quan_tri_kl qua policy): từ nay chỉ qua hai hàm dưới.
DROP POLICY "dm_linh_vuc_insert_qtkl" ON "public"."dm_linh_vuc";
DROP POLICY "dm_linh_vuc_update_qtkl" ON "public"."dm_linh_vuc";
REVOKE INSERT, UPDATE ON TABLE "public"."dm_linh_vuc" FROM "authenticated";

-- Người gọi hàm danh mục: người có quan_tri_kl đã đăng nhập, hoặc đường dự phòng qua CLI (như admin_kiem_tra_nguoi_goi).
CREATE FUNCTION "public"."kl_kiem_tra_quan_tri_kl"() RETURNS text
LANGUAGE "plpgsql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF "auth"."uid"() IS NULL AND session_user = 'postgres' THEN RETURN 'qua CLI'; END IF;
  IF "public"."me_quan_tri_kl"() THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'Chỉ người có quyền quản trị KL BTVTU mới được sửa danh mục.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_kiem_tra_quan_tri_kl"() FROM "public", "anon", "authenticated";

-- Mã lĩnh vực sinh phía server: LV<số ngành 2 chữ số>_<tên bỏ dấu, viết hoa, gạch dưới>; trùng thì thêm _2, _3…
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";
CREATE FUNCTION "public"."kl_sinh_ma_linh_vuc"("p_nganh_ma" text, "p_ten" text) RETURNS text
LANGUAGE "plpgsql" STABLE SET "search_path" = "public" AS $$
DECLARE v_goc text; v_ma text; v_n integer := 1;
BEGIN
  SELECT 'LV' || lpad("thu_tu"::text, 2, '0') INTO v_goc FROM "public"."dm_nganh" WHERE "ma" = "p_nganh_ma";
  v_goc := v_goc || '_' || left(trim(both '_' from upper(regexp_replace("extensions"."unaccent"(btrim("p_ten")), '[^A-Za-z0-9]+', '_', 'g'))), 40);
  IF right(v_goc, 1) = '_' THEN v_goc := v_goc || 'MOI'; END IF;
  v_ma := v_goc;
  WHILE EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_ma) LOOP
    v_n := v_n + 1;
    v_ma := v_goc || '_' || v_n;
  END LOOP;
  RETURN v_ma;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_sinh_ma_linh_vuc"(text, text) FROM "public", "anon", "authenticated";

-- Thêm lĩnh vực vào một ngành; thu_tu = cuối ngành; ghi nhật ký cùng transaction; trả về mã đã sinh.
CREATE FUNCTION "public"."admin_them_linh_vuc"("p_nganh_ma" text, "p_ten" text, "p_ly_do" text) RETURNS text
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_ten text := nullif(btrim(coalesce("p_ten", '')), ''); v_ma text; v_thu_tu integer; v_dong "public"."dm_linh_vuc";
BEGIN
  v_ghi_chu := "public"."kl_kiem_tra_quan_tri_kl"();
  IF NOT EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = "p_nganh_ma") THEN
    RAISE EXCEPTION 'Không có ngành "%".', "p_nganh_ma" USING ERRCODE = '22023';
  END IF;
  IF v_ten IS NULL THEN RAISE EXCEPTION 'Tên lĩnh vực không được trống.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do thêm lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "nganh_ma" = "p_nganh_ma" AND lower("ten") = lower(v_ten)) THEN
    RAISE EXCEPTION 'Ngành này đã có lĩnh vực "%".', v_ten USING ERRCODE = '23505';
  END IF;
  v_ma := "public"."kl_sinh_ma_linh_vuc"("p_nganh_ma", v_ten);
  SELECT coalesce(max("thu_tu"), 0) + 1 INTO v_thu_tu FROM "public"."dm_linh_vuc" WHERE "nganh_ma" = "p_nganh_ma";
  INSERT INTO "public"."dm_linh_vuc" ("ma", "nganh_ma", "ten", "thu_tu") VALUES (v_ma, "p_nganh_ma", v_ten, v_thu_tu) RETURNING * INTO v_dong;
  INSERT INTO "public"."dm_lich_su" ("nguoi", "nguoi_ghi_chu", "bang", "ma", "hanh_dong", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, 'dm_linh_vuc', v_ma, 'them', to_jsonb(v_dong), btrim("p_ly_do"));
  RETURN v_ma;
END;
$$;

-- Sửa tên / thứ tự (không đổi ngành, không đổi mã — đã có việc và phân công tham chiếu); nhật ký chỉ ghi cột đổi.
CREATE FUNCTION "public"."admin_sua_linh_vuc"("p_ma" text, "p_ten" text, "p_thu_tu" integer, "p_ly_do" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ghi_chu text; v_cu "public"."dm_linh_vuc"; v_ten text := nullif(btrim(coalesce("p_ten", '')), '');
        v_thu_tu integer := coalesce("p_thu_tu", -1); v_doi_cu jsonb := '{}'; v_doi_moi jsonb := '{}';
BEGIN
  v_ghi_chu := "public"."kl_kiem_tra_quan_tri_kl"();
  SELECT * INTO v_cu FROM "public"."dm_linh_vuc" WHERE "ma" = "p_ma" FOR UPDATE;
  IF v_cu."ma" IS NULL THEN RAISE EXCEPTION 'Không có lĩnh vực "%".', "p_ma" USING ERRCODE = '22023'; END IF;
  IF v_ten IS NULL THEN RAISE EXCEPTION 'Tên lĩnh vực không được trống.' USING ERRCODE = '22023'; END IF;
  IF v_thu_tu < 1 THEN RAISE EXCEPTION 'Thứ tự phải là số nguyên dương.' USING ERRCODE = '22023'; END IF;
  IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
    RAISE EXCEPTION 'Phải ghi lý do sửa lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF v_ten <> v_cu."ten" THEN v_doi_cu := v_doi_cu || jsonb_build_object('ten', v_cu."ten"); v_doi_moi := v_doi_moi || jsonb_build_object('ten', v_ten); END IF;
  IF v_thu_tu <> v_cu."thu_tu" THEN v_doi_cu := v_doi_cu || jsonb_build_object('thu_tu', v_cu."thu_tu"); v_doi_moi := v_doi_moi || jsonb_build_object('thu_tu', v_thu_tu); END IF;
  IF v_doi_moi = '{}' THEN RAISE EXCEPTION 'Không có gì thay đổi.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."dm_linh_vuc" SET "ten" = v_ten, "thu_tu" = v_thu_tu WHERE "ma" = "p_ma";
  INSERT INTO "public"."dm_lich_su" ("nguoi", "nguoi_ghi_chu", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES ("auth"."uid"(), v_ghi_chu, 'dm_linh_vuc', "p_ma", 'sua', v_doi_cu, v_doi_moi, btrim("p_ly_do"));
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['admin_them_linh_vuc(text,text,text)', 'admin_sua_linh_vuc(text,text,integer,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
