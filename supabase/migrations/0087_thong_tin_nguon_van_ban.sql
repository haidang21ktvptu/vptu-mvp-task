-- 0087 (Đợt C2 v3.19 — quyết định 8/10/2026 sau đối chiếu bản MVP của Phòng Tổng hợp): thông tin nguồn của nhiệm vụ và văn bản.
-- 1. Loại văn bản thêm NQ_BCH (Nghị quyết Ban Chấp hành Đảng bộ tỉnh), KL_BCH (Kết luận Ban Chấp hành Đảng bộ tỉnh) — CHECK và từ điển nhập Excel.
-- 2. nhiem_vu: muc_quan_trong (A/B/C), co_quan_trinh (cơ quan, đơn vị ngoài Văn phòng trình nội dung dẫn tới nhiệm vụ — dm_don_vi), thuong_truc_chi_dao
--    (đồng chí Thường trực Tỉnh ủy chỉ đạo — tài khoản A0), stt_van_ban (số thứ tự nhiệm vụ trong văn bản, tự tăng khi tạo; việc cũ đánh số theo
--    thời điểm tạo). Ba ô nguồn đều không bắt buộc; trigger bf_ kiểm khi ghi (mọi đường: giao việc, sửa thông tin giao, nhập Excel). Mã theo nguồn
--    (vd KL-BTV·HN39·671·04) do giao diện dựng từ loại, số hội nghị, số hiệu văn bản và stt_van_ban — không lưu.
-- 3. Ba ô nguồn là ô tầng giao (kl_cot_tang_giao): cấp giao sửa ngay, cấp nhận việc "Đề nghị sửa" (0070–0071). Owner / người theo dõi không UPDATE
--    trực tiếp được (guard a_ chỉ cho các cột cập nhật tiến độ).
-- 4. v_nhiem_vu thêm cột cuối; nop_minh_chung báo riêng khi việc chưa có cấp nhận (rà soát C1); cấu hình so bằng số (rà soát C1: '02' = 2).

-- ---- 1. Loại văn bản ----
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.van_ban_giao_viec'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) LIKE '%loai = ANY%' LOOP
    EXECUTE format('ALTER TABLE "public"."van_ban_giao_viec" DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE "public"."van_ban_giao_viec" ADD CONSTRAINT "van_ban_giao_viec_loai_check"
  CHECK ("loai" IN ('KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'NQ_BCH', 'KL_BCH', 'CONG_VAN', 'KHAC'));

-- Từ điển nhập Excel (0072) nhận hai loại mới.
CREATE OR REPLACE FUNCTION "public"."kl_tu_dien_hop_le"("p_loai" text, "p_ma" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE "p_loai"
    WHEN 'loai_van_ban' THEN "p_ma" IN ('KL_BTV', 'TB_THUONG_TRUC', 'KL_BCH', 'NQ_BCH', 'NQ_TW', 'CONG_VAN', 'KHAC')   -- 0087: + Ban Chấp hành
    WHEN 'don_vi' THEN EXISTS (SELECT 1 FROM "public"."dm_don_vi" WHERE "ma" = "p_ma")
    WHEN 'can_bo' THEN EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id"::text = "p_ma" AND NOT "is_system")
    WHEN 'loai_thoi_han' THEN EXISTS (SELECT 1 FROM "public"."dm_loai_thoi_han" WHERE "ma" = "p_ma")
    WHEN 'san_pham' THEN EXISTS (SELECT 1 FROM "public"."dm_san_pham" WHERE "ma" = "p_ma")
    WHEN 'cap' THEN EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = "p_ma")
    WHEN 'do_khan' THEN "p_ma" IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC')
    WHEN 'nguon' THEN EXISTS (SELECT 1 FROM "public"."dm_nguon_nhiem_vu" WHERE "ma" = "p_ma")
    WHEN 'nganh' THEN EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = "p_ma")
    WHEN 'linh_vuc' THEN EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = "p_ma")
    WHEN 'tien_do' THEN "p_ma" IN ('DANG_THUC_HIEN', 'HOAN_THANH')
    WHEN 'chat_luong' THEN "p_ma" IN ('KHONG_DAT', 'DAT', 'DAT_TOT', 'DAT_XUAT_SAC')
    ELSE false END;
$$;

-- ---- 2. Cột nguồn + số thứ tự trong văn bản ----
ALTER TABLE "public"."nhiem_vu"
  ADD COLUMN "muc_quan_trong" text CHECK ("muc_quan_trong" IN ('A', 'B', 'C')),
  ADD COLUMN "co_quan_trinh" text REFERENCES "public"."dm_don_vi"("ma"),
  ADD COLUMN "thuong_truc_chi_dao" uuid REFERENCES "public"."accounts"("id"),
  ADD COLUMN "stt_van_ban" integer CHECK ("stt_van_ban" > 0);
-- Việc đã có: đánh số theo thời điểm tạo trong từng văn bản. Tắt trigger người dùng (không ghi vết từng việc, không đổi cap_nhat_luc) như 0077.
ALTER TABLE "public"."nhiem_vu" DISABLE TRIGGER USER;
UPDATE "public"."nhiem_vu" nv SET "stt_van_ban" = s.stt
FROM (SELECT "id", row_number() OVER (PARTITION BY "van_ban_id" ORDER BY "created_at", "ma") AS stt FROM "public"."nhiem_vu") s WHERE s."id" = nv."id";
ALTER TABLE "public"."nhiem_vu" ENABLE TRIGGER USER;
CREATE UNIQUE INDEX "nhiem_vu_van_ban_stt_key" ON "public"."nhiem_vu" ("van_ban_id", "stt_van_ban");
CREATE INDEX "nhiem_vu_co_quan_trinh_idx" ON "public"."nhiem_vu" ("co_quan_trinh") WHERE "co_quan_trinh" IS NOT NULL;

-- STT tự tăng (khoá dòng văn bản để hai lượt giao song song không trùng số), không sửa qua API; kiểm Cơ quan trình / Thường trực chỉ đạo khi ghi mới
-- hoặc đổi. Xoá việc cuối của văn bản (hoàn tác lô) thì số đó có thể được cấp lại — việc đã xoá không còn nên mã không trùng việc đang có.
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_nguon_truoc_ghi"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."stt_van_ban" IS NULL THEN
    PERFORM 1 FROM "public"."van_ban_giao_viec" WHERE "id" = NEW."van_ban_id" FOR UPDATE;
    SELECT coalesce(max("stt_van_ban"), 0) + 1 INTO NEW."stt_van_ban" FROM "public"."nhiem_vu" WHERE "van_ban_id" = NEW."van_ban_id";
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."stt_van_ban" IS DISTINCT FROM OLD."stt_van_ban" AND "auth"."uid"() IS NOT NULL THEN   -- mã theo nguồn cố định (phiên người dùng)
    RAISE EXCEPTION 'Không sửa số thứ tự nhiệm vụ trong văn bản.' USING ERRCODE = '42501';
  END IF;
  IF NEW."co_quan_trinh" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."co_quan_trinh" IS DISTINCT FROM OLD."co_quan_trinh")
     AND NOT EXISTS (SELECT 1 FROM "public"."dm_don_vi" WHERE "ma" = NEW."co_quan_trinh" AND NOT "trong_van_phong") THEN
    RAISE EXCEPTION 'Cơ quan trình phải là cơ quan, đơn vị ngoài Văn phòng (danh mục đơn vị).' USING ERRCODE = '22023';
  END IF;
  IF NEW."thuong_truc_chi_dao" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."thuong_truc_chi_dao" IS DISTINCT FROM OLD."thuong_truc_chi_dao")
     AND NOT EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id" = NEW."thuong_truc_chi_dao" AND "role_group" = 'A0' AND NOT "is_system") THEN
    RAISE EXCEPTION 'Thường trực chỉ đạo phải là tài khoản một đồng chí Thường trực Tỉnh ủy.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_nguon_truoc_ghi"() FROM public, "anon", "authenticated";
CREATE TRIGGER "bf_nhiem_vu_nguon" BEFORE INSERT OR UPDATE ON "public"."nhiem_vu" FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_nguon_truoc_ghi"();

-- ---- 3. Ô tầng giao: thêm ba ô nguồn (0070 + 3 ô) ----
CREATE OR REPLACE FUNCTION "public"."kl_cot_tang_giao"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['noi_dung', 'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'do_khan', 'nganh_ma', 'linh_vuc_ma', 'linh_vuc_chi_tiet',
               'nguon_nhiem_vu_ma', 'don_vi_phoi_hop', 'muc_quan_trong', 'co_quan_trinh', 'thuong_truc_chi_dao']::text[];
$$;
CREATE OR REPLACE FUNCTION "public"."kl_ten_cot_giao"("p_cot" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_cot" WHEN 'noi_dung' THEN 'Nội dung' WHEN 'san_pham_loai' THEN 'Sản phẩm' WHEN 'san_pham_mo_ta' THEN 'Mô tả sản phẩm'
    WHEN 'cap_nhan_san_pham' THEN 'Cấp nhận sản phẩm' WHEN 'do_khan' THEN 'Độ khẩn' WHEN 'nganh_ma' THEN 'Ngành' WHEN 'linh_vuc_ma' THEN 'Lĩnh vực'
    WHEN 'linh_vuc_chi_tiet' THEN 'Lĩnh vực chi tiết' WHEN 'nguon_nhiem_vu_ma' THEN 'Nguồn nhiệm vụ' WHEN 'don_vi_phoi_hop' THEN 'Đơn vị phối hợp'
    WHEN 'cap_quyet_dinh' THEN 'Cấp cần quyết định' WHEN 'ngay_nhan_van_ban' THEN 'Ngày nhận văn bản'
    WHEN 'muc_quan_trong' THEN 'Mức quan trọng' WHEN 'co_quan_trinh' THEN 'Cơ quan trình' WHEN 'thuong_truc_chi_dao' THEN 'Thường trực chỉ đạo' ELSE "p_cot" END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_thay_doi_giao"("p_nv" "public"."nhiem_vu", "p" jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; val jsonb; v_moi jsonb := '{}'::jsonb; v_cu jsonb := to_jsonb("p_nv"); v_s text; v_loai_vb text; v_nganh text; v_lv text;
BEGIN
  IF "p" IS NULL OR jsonb_typeof("p") <> 'object' OR "p" = '{}'::jsonb THEN RAISE EXCEPTION 'Chưa chọn ô cần sửa.' USING ERRCODE = '22023'; END IF;
  FOR k, val IN SELECT e.key, e.value FROM jsonb_each("p") e LOOP
    IF NOT (k = ANY ("public"."kl_cot_tang_giao"())) THEN RAISE EXCEPTION 'Ô "%" không sửa được bằng cách này.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    v_s := CASE WHEN jsonb_typeof(val) = 'null' THEN NULL ELSE nullif(btrim(val #>> '{}'), '') END;
    IF k IN ('noi_dung', 'do_khan') AND v_s IS NULL THEN RAISE EXCEPTION '% không được để trống.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    IF k = 'noi_dung' AND char_length(v_s) > 2000 THEN RAISE EXCEPTION 'Nội dung tối đa 2000 ký tự.' USING ERRCODE = '22023'; END IF;
    IF k IN ('san_pham_mo_ta', 'linh_vuc_chi_tiet') AND char_length(v_s) > 1000 THEN RAISE EXCEPTION '% tối đa 1000 ký tự.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023'; END IF;
    IF k = 'don_vi_phoi_hop' AND char_length(v_s) > 300 THEN RAISE EXCEPTION 'Đơn vị phối hợp tối đa 300 ký tự.' USING ERRCODE = '22023'; END IF;
    IF k = 'do_khan' AND v_s NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
    IF v_s IS NOT NULL AND (
         (k = 'san_pham_loai' AND NOT EXISTS (SELECT 1 FROM "public"."dm_san_pham" WHERE "ma" = v_s))
      OR (k = 'cap_nhan_san_pham' AND NOT EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = v_s))
      OR (k = 'nganh_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_nganh" WHERE "ma" = v_s))
      OR (k = 'linh_vuc_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_s))
      OR (k = 'nguon_nhiem_vu_ma' AND NOT EXISTS (SELECT 1 FROM "public"."dm_nguon_nhiem_vu" WHERE "ma" = v_s AND ("dang_dung" OR "ma" = "p_nv"."nguon_nhiem_vu_ma")))) THEN
      RAISE EXCEPTION '% không có trong danh mục.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023';
    END IF;
    -- 0087: ba ô nguồn (Mức quan trọng A/B/C; Cơ quan trình = đơn vị ngoài Văn phòng; Thường trực chỉ đạo = tài khoản A0) — trigger bf_ kiểm lại.
    IF v_s IS NOT NULL AND ((k = 'muc_quan_trong' AND v_s NOT IN ('A', 'B', 'C'))
      OR (k = 'co_quan_trinh' AND NOT EXISTS (SELECT 1 FROM "public"."dm_don_vi" WHERE "ma" = v_s AND NOT "trong_van_phong"))
      OR (k = 'thuong_truc_chi_dao' AND NOT EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id"::text = v_s AND "role_group" = 'A0' AND NOT "is_system"))) THEN
      RAISE EXCEPTION '% không hợp lệ.', "public"."kl_ten_cot_giao"(k) USING ERRCODE = '22023';
    END IF;
    IF coalesce(to_jsonb(v_s), 'null'::jsonb) IS DISTINCT FROM coalesce(v_cu -> k, 'null'::jsonb) THEN v_moi := v_moi || jsonb_build_object(k, v_s); END IF;
  END LOOP;
  IF v_moi = '{}'::jsonb THEN RAISE EXCEPTION 'Không có gì thay đổi so với thông tin đang có.' USING ERRCODE = '22023'; END IF;
  -- Ràng buộc nghiệp vụ trên giá trị SAU khi đổi: sản phẩm của việc theo 1400; ngành + lĩnh vực của việc từ kết luận / thông báo; lĩnh vực thuộc ngành.
  v_nganh := CASE WHEN v_moi ? 'nganh_ma' THEN v_moi ->> 'nganh_ma' ELSE "p_nv"."nganh_ma" END;
  v_lv := CASE WHEN v_moi ? 'linh_vuc_ma' THEN v_moi ->> 'linh_vuc_ma' ELSE "p_nv"."linh_vuc_ma" END;
  IF "p_nv"."theo_1400" AND v_moi ? 'san_pham_loai' AND v_moi ->> 'san_pham_loai' IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ theo quy tắc 1400 phải có sản phẩm đầu ra.' USING ERRCODE = '22023';
  END IF;
  IF "p_nv"."theo_1400" AND v_moi ? 'cap_nhan_san_pham' AND v_moi ->> 'cap_nhan_san_pham' IS NULL THEN   -- minh chứng / nghiệm thu cần cấp nhận
    RAISE EXCEPTION 'Nhiệm vụ theo quy tắc 1400 phải có cấp nhận sản phẩm.' USING ERRCODE = '22023';
  END IF;
  SELECT "loai" INTO v_loai_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_nv"."van_ban_id";
  IF "p_nv"."theo_1400" AND v_loai_vb IN ('KL_BTV', 'TB_THUONG_TRUC') AND (v_nganh IS NULL OR v_lv IS NULL) THEN
    RAISE EXCEPTION 'Việc từ kết luận/thông báo phải có ngành và lĩnh vực.' USING ERRCODE = '22023';
  END IF;
  IF v_lv IS NOT NULL AND v_nganh IS NULL THEN RAISE EXCEPTION 'Chọn ngành trước khi chọn lĩnh vực.' USING ERRCODE = '22023'; END IF;   -- CHECK lĩnh vực cần ngành
  IF v_lv IS NOT NULL AND v_nganh IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" WHERE "ma" = v_lv AND "nganh_ma" = v_nganh) THEN
    RAISE EXCEPTION 'Lĩnh vực không thuộc ngành đã chọn.' USING ERRCODE = '22023';
  END IF;
  RETURN v_moi;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_ap_thong_tin_giao"("p_id" uuid, "p" jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; m "public"."nhiem_vu";
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  m := jsonb_populate_record(v, (SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) FROM jsonb_each("p") e WHERE e.key = ANY ("public"."kl_cot_tang_giao"())));
  PERFORM set_config('kl.ghi_qua_ham', '1', true);
  UPDATE "public"."nhiem_vu" SET "noi_dung" = m."noi_dung", "san_pham_loai" = m."san_pham_loai", "san_pham_mo_ta" = m."san_pham_mo_ta",
    "cap_nhan_san_pham" = m."cap_nhan_san_pham", "do_khan" = m."do_khan", "nganh_ma" = m."nganh_ma", "linh_vuc_ma" = m."linh_vuc_ma",
    "linh_vuc_chi_tiet" = m."linh_vuc_chi_tiet", "nguon_nhiem_vu_ma" = m."nguon_nhiem_vu_ma", "don_vi_phoi_hop" = m."don_vi_phoi_hop",
    "muc_quan_trong" = m."muc_quan_trong", "co_quan_trinh" = m."co_quan_trinh", "thuong_truc_chi_dao" = m."thuong_truc_chi_dao"   -- 0087
  WHERE "id" = "p_id";
  PERFORM set_config('kl.ghi_qua_ham', '', true);
END;
$$;

-- ---- 4. Minh chứng: báo riêng khi việc chưa có cấp nhận (0086 + 3 dòng); cấu hình so bằng số ----
CREATE OR REPLACE FUNCTION "public"."nop_minh_chung"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_id uuid; v_loi text;
        v_so text := nullif(btrim(coalesce("p" ->> 'so_hieu', '')), ''); v_ngay date := nullif("p" ->> 'ngay_van_ban', '')::date;
        v_cap text := nullif(btrim(coalesce("p" ->> 'cap_nhan', '')), ''); v_cap_ten text;
        v_trich_yeu text := nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), ''); v_mo_ta text := nullif(btrim(coalesce("p" ->> 'mo_ta_ket_qua', '')), '');
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  v_cap := coalesce(v_cap, v_nv."cap_nhan_san_pham");   -- 0086: minh chứng nhanh — cấp nhận để trống = cấp nhận sản phẩm ghi khi giao
  IF v_so IS NULL OR v_ngay IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải có số hiệu và ngày văn bản (cấp nhận lấy theo việc nếu để trống).' USING ERRCODE = '22023';
  END IF;
  IF v_cap IS NULL THEN   -- 0087: việc không ghi cấp nhận sản phẩm (dữ liệu cũ) — báo đúng ô còn thiếu
    RAISE EXCEPTION 'Việc chưa ghi cấp nhận sản phẩm — chọn cấp nhận cho minh chứng.' USING ERRCODE = '22023';
  END IF;
  -- 0086 (Đợt C1): trích yếu và mô tả kết quả không còn bắt buộc (quyết định 8/10/2026 — một form cập nhật, nhập tối thiểu số hiệu + ngày).
  IF char_length(v_mo_ta) > 600 THEN RAISE EXCEPTION 'Mô tả kết quả tối đa 600 ký tự.' USING ERRCODE = '22023'; END IF;
  SELECT "ten" INTO v_cap_ten FROM "public"."dm_cap" WHERE "ma" = v_cap;
  IF v_cap_ten IS NULL THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi")
  VALUES (v_nv."id", 'so_hieu', v_so, v_ngay, v_cap, v_trich_yeu, v_mo_ta, "auth"."uid"()) RETURNING "id" INTO v_id;
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_nop',
    format('Nộp minh chứng · %s: số %s%s (ngày %s, %s)', v_nv."ma", v_so, coalesce(' · ' || v_trich_yeu, ''), to_char(v_ngay, 'DD/MM/YYYY'), v_cap_ten));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_chuyen_vien_xem_phong"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN "gia_tri" ~ '^[0-9]{1,4}$' THEN "gia_tri"::integer END = 2 FROM "public"."kl_cau_hinh" WHERE "khoa" = 'pham_vi_chuyen_vien'), false);
$$;
CREATE OR REPLACE FUNCTION "public"."kl_tu_nhan_viec"() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN "gia_tri" ~ '^[0-9]{1,4}$' THEN "gia_tri"::integer END = 2 FROM "public"."kl_cau_hinh" WHERE "khoa" = 'xac_nhan_nhan_viec'), false);
$$;

-- ---- 5. v_nhiem_vu (0082 + cột 0087 cuối view) ----
CREATE OR REPLACE VIEW "public"."v_nhiem_vu" WITH (security_invoker = true) AS
 SELECT nv.id, nv.ma, nv.van_ban_id, vb.loai AS van_ban_loai, vb.so_hoi_nghi, vb.so_ket_luan, vb.ngay_ban_hanh, vb.ngay_nhan AS van_ban_ngay_nhan,
    nv.nguoi_theo_doi, td.full_name AS nguoi_theo_doi_ten, td.department AS nguoi_theo_doi_phong,
    nv.owner_don_vi_ma, dv.ten AS owner_don_vi_ten, dv.trong_van_phong AS owner_trong_van_phong, dv.phong AS owner_phong,
    nv.owner_tai_khoan, ow.full_name AS owner_tai_khoan_ten,
    nv.san_pham_loai, sp.ten AS san_pham_ten, nv.san_pham_mo_ta, nv.cap_nhan_san_pham, cn.ten AS cap_nhan_san_pham_ten,
    nv.cap_quyet_dinh, cq.ten AS cap_quyet_dinh_ten, nv.ngay_nhan_van_ban, nv.ngay_nhan_uoc_tinh, nv.nhiem_vu_cha, nv.theo_1400,
    nv.nganh_ma, dn.ten AS nganh_ten, nv.linh_vuc_ma, lv.ten AS linh_vuc_ten, nv.linh_vuc_chi_tiet, nv.noi_dung,
    nv.loai_thoi_han_ma, dl.ten AS loai_thoi_han_ten, nv.han_xu_ly, nv.ly_do_chua_co_han, nv.tien_do_ma, nv.ngay_hoan_thanh,
    nv.minh_chung, nv.van_ban_trien_khai, nv.so_lan_gia_han, nv.nguon, nv.ghi_chu, nv.thieu_minh_chung, nv.dong_luc,
    nv.cap_nhat_luc, nv.cap_nhat_boi, nv.tao_boi, nv.created_at,
    t.trang_thai, t.so_ngay_qua, t.ket_qua, t.so_ngay_tre, t.do_tre_nhap_lieu, t.dang_dinh_chinh, t.nhom_dem, t.muc_canh_bao, t.lead_time_ngay,
    "public"."kl_hom_nay"() - vb.ngay_ban_hanh AS tuoi_ngay,
    ((SELECT count(*) FROM "public"."chi_dao" c WHERE c.nhiem_vu_id = nv.id AND c.trang_thai = 'CHO_PHAN_HOI'))::integer AS so_chi_dao_cho_phan_hoi,
    mcv.so_hop_le AS so_minh_chung_hop_le,
    mcv.moi_nhat AS minh_chung_moi_nhat,
    nv.do_khan, nv.uu_tien, nv.giao_thay_mat_cho, tm.full_name AS giao_thay_mat_cho_ten,
    CASE nv.do_khan WHEN 'HOA_TOC' THEN 1 WHEN 'THUONG_KHAN' THEN 2 WHEN 'KHAN' THEN 3 ELSE 4 END AS thu_tu_do_khan,
    nv.bi_tu_choi,
    -- Cột mới PR-2a (cuối view)
    xn.nguoi IS NOT NULL AS da_xac_nhan_nhan,
    xn.nguoi AS nguoi_da_nhan,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'NGHIEM_THU' WHEN t.dang_dinh_chinh THEN 'DANG_TRA_SOAT' WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') THEN 'DO' ELSE 'TU_CHOI' END
    END AS nhom_ngoai_le,
    CASE WHEN t.muc_canh_bao IN ('DO', 'DO_DAC_BIET') OR (nv.bi_tu_choi AND nv.tien_do_ma <> 'HOAN_THANH') THEN
      CASE WHEN nv.bi_tu_choi THEN 'BI_TU_CHOI'
           WHEN nv.cap_quyet_dinh IS NOT NULL THEN 'CHO_QUYET'
           WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN 'CHO_NGHIEM_THU'
           WHEN mcv.co_chua_xac_nhan THEN 'CHO_MINH_CHUNG'
           WHEN nv.theo_1400 AND xn.nguoi IS NULL THEN 'CHUA_NHAN'
           ELSE 'CHUA_SAN_PHAM' END
    END AS khau,
    -- Cột mới PR-2b (cuối view)
    nv.han_nop_minh_chung, nv.ly_do_han_nop_sat, t.han_nop_hieu_luc, t.minh_chung_buoc, t.nop_dung_han, t.nghiem_thu_dung_han, t.so_lan_tra_lai,
    CASE WHEN t.minh_chung_buoc = 'CHO_NGHIEM_THU' THEN mcv.nop_boi_moi END AS nguoi_nop_cho,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntc.id
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(nv.owner_tai_khoan, nv.nguoi_theo_doi) END AS nguoi_chiu_cham,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntca.full_name
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(ow.full_name, td.full_name) END AS nguoi_chiu_cham_ten,
    CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ntca.department
         WHEN t.trang_thai IN ('QUA_HAN', 'CHAM_NOP_MINH_CHUNG') THEN coalesce(ow.department, dv.phong, td.department) END AS phong_chiu_cham,
    -- Cột mới PR-3 (cuối view)
    nv.chat_luong, nv.nguon_nhiem_vu_ma, ng.ten AS nguon_nhiem_vu_ten, nv.vuong_mac, nv.don_vi_phoi_hop, t.tien_do_hoan_thanh,
    -- Cột mới 0079 (cuối view)
    nv.giao_thay_mat_nhom,
    -- Cột mới 0087 (cuối view): thông tin nguồn, số thứ tự trong văn bản
    nv.stt_van_ban, nv.muc_quan_trong, nv.co_quan_trinh, cqt.ten AS co_quan_trinh_ten, nv.thuong_truc_chi_dao, ttcd.full_name AS thuong_truc_chi_dao_ten
   FROM "public"."nhiem_vu" nv
     CROSS JOIN LATERAL "public"."trang_thai_dong"(nv.*, "public"."kl_hom_nay"()) t
     JOIN "public"."van_ban_giao_viec" vb ON vb.id = nv.van_ban_id
     LEFT JOIN LATERAL (SELECT array_agg(DISTINCT l.nguoi_sua) AS nguoi FROM "public"."lich_su" l
                        WHERE l.nhiem_vu_id = nv.id AND l.cot = 'xac_nhan_nhan_viec') xn ON true
     -- MỘT lần quét minh_chung cho cả 4 cột (bản 0051 có 3 truy vấn con + 1 LATERAL): mỗi tham chiếu bảng dưới RLS dựng lại tập phạm vi
     -- (kl_nhiem_vu_thay_duoc) một lần — đo 30/9 với PCVP ≈ 4,5 ms mỗi lần. Giá trị so_minh_chung_hop_le, minh_chung_moi_nhat, khâu giữ y hệt 0051.
     LEFT JOIN LATERAL (
       SELECT count(*) FILTER (WHERE "public"."minh_chung_la_hop_le"(m.*))::integer AS so_hop_le,
              (array_agg(jsonb_build_object('id', m.id, 'loai', m.loai, 'so_hieu', m.so_hieu, 'ngay_van_ban', m.ngay_van_ban, 'cap_nhan', m.cap_nhan,
                 'cap_nhan_ten', mcap.ten, 'hop_le', m.hop_le, 'nop_luc', m.nop_luc) ORDER BY m.nop_luc DESC))[1] AS moi_nhat,
              (array_agg(m.nop_boi ORDER BY m.nop_luc DESC))[1] AS nop_boi_moi,
              coalesce(bool_or(m.hop_le IS NULL), false) AS co_chua_xac_nhan
       FROM "public"."minh_chung" m LEFT JOIN "public"."dm_cap" mcap ON mcap.ma = m.cap_nhan
       WHERE m.nhiem_vu_id = nv.id) mcv ON true
     -- CASE (đánh giá lười): WHERE trong LATERAL bị kéo lên thành điều kiện nối ⇒ hàm chạy cho MỌI dòng (đo 30/9: CVP 74 → 2 405 ms).
     LEFT JOIN LATERAL (SELECT CASE WHEN t.trang_thai = 'QUA_HAN_NGHIEM_THU' THEN ("public"."nguoi_nghiem_thu_chinh"(nv.*, mcv.nop_boi_moi))[1] END AS id) ntc ON true
     LEFT JOIN "public"."accounts_public" ntca ON ntca.id = ntc.id
     LEFT JOIN "public"."accounts_public" td ON td.id = nv.nguoi_theo_doi
     LEFT JOIN "public"."accounts_public" ow ON ow.id = nv.owner_tai_khoan
     LEFT JOIN "public"."accounts_public" tm ON tm.id = nv.giao_thay_mat_cho
     LEFT JOIN "public"."dm_don_vi" dv ON dv.ma = nv.owner_don_vi_ma
     LEFT JOIN "public"."dm_san_pham" sp ON sp.ma = nv.san_pham_loai
     LEFT JOIN "public"."dm_cap" cn ON cn.ma = nv.cap_nhan_san_pham
     LEFT JOIN "public"."dm_cap" cq ON cq.ma = nv.cap_quyet_dinh
     LEFT JOIN "public"."dm_nganh" dn ON dn.ma = nv.nganh_ma
     LEFT JOIN "public"."dm_linh_vuc" lv ON lv.ma = nv.linh_vuc_ma
     LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl.ma = nv.loai_thoi_han_ma
     LEFT JOIN "public"."dm_nguon_nhiem_vu" ng ON ng.ma = nv.nguon_nhiem_vu_ma
     LEFT JOIN "public"."dm_don_vi" cqt ON cqt.ma = nv.co_quan_trinh
     LEFT JOIN "public"."accounts_public" ttcd ON ttcd.id = nv.thuong_truc_chi_dao;
