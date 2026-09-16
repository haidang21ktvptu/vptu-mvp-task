-- GĐ14 (PR 14AB, 2/3) — Đổi tên thực thể theo SPEC v3 mục 5.1 (LO-TRINH 14B) bằng RENAME: dữ liệu, lịch sử, policy,
-- FK, CHECK, index, publication realtime đều theo OID nên giữ nguyên. Chỉ HÀM có thân là chữ (plpgsql/sql) phải viết lại
-- với tên mới — làm ở đây, thân giữ nguyên từng quy tắc của 0015/0021/0022. Bí danh cho frontend cũ (view kl_*,
-- kl_trang_thai) và hàm trang_thai mới ở 0024. Tiền tố kl_ của tên hàm/trigger bỏ dần ở các PR sau.

-- 1. Bảng, cột, sequence, trigger.
ALTER TABLE "public"."kl_nhiem_vu" RENAME TO "nhiem_vu";
ALTER TABLE "public"."kl_hoi_nghi" RENAME TO "van_ban_giao_viec";
ALTER TABLE "public"."kl_lich_su" RENAME TO "lich_su";
ALTER TABLE "public"."kl_chi_dao" RENAME TO "chi_dao";
ALTER TABLE "public"."kl_dinh_chinh" RENAME TO "dinh_chinh";
ALTER TABLE "public"."dm_co_quan_trinh" RENAME TO "dm_don_vi";
ALTER TABLE "public"."nhiem_vu" RENAME COLUMN "chu_tri_id" TO "nguoi_theo_doi";          -- CH-2: người theo dõi, không phải Owner
ALTER TABLE "public"."nhiem_vu" RENAME COLUMN "co_quan_trinh_ma" TO "owner_don_vi_ma";   -- NT-1, CH-1: Owner = cơ quan/đơn vị trình
ALTER TABLE "public"."nhiem_vu" RENAME COLUMN "hoi_nghi_id" TO "van_ban_id";             -- QT-1, CH-14
ALTER TABLE "public"."nhiem_vu" RENAME COLUMN "ghi_hoan_thanh_luc" TO "dong_luc";        -- QT-4: lúc ĐÓNG nhiệm vụ
ALTER SEQUENCE "public"."kl_nhiem_vu_ma_seq" RENAME TO "nhiem_vu_ma_seq";
ALTER TRIGGER "a_kl_nhiem_vu_guard_a3" ON "public"."nhiem_vu" RENAME TO "a_nhiem_vu_guard_a3";
ALTER TRIGGER "b_kl_nhiem_vu_truoc_ghi" ON "public"."nhiem_vu" RENAME TO "b_nhiem_vu_truoc_ghi";
ALTER TRIGGER "bb_kl_nhiem_vu_quy_tac_1400" ON "public"."nhiem_vu" RENAME TO "bb_nhiem_vu_quy_tac_1400";
ALTER TRIGGER "c_kl_nhiem_vu_lich_su" ON "public"."nhiem_vu" RENAME TO "c_nhiem_vu_lich_su";

-- 2. Giá trị "tên cột" lưu dạng chữ trong lịch sử và đính chính đổi theo (chỉ đổi định danh, không đổi nội dung);
--    whitelist cột được đính chính đổi theo. View bí danh kl_lich_su/kl_dinh_chinh (0024) dịch ngược cho frontend cũ.
UPDATE "public"."lich_su" SET "cot" = CASE "cot" WHEN 'chu_tri_id' THEN 'nguoi_theo_doi' WHEN 'co_quan_trinh_ma' THEN 'owner_don_vi_ma'
  WHEN 'hoi_nghi_id' THEN 'van_ban_id' END WHERE "cot" IN ('chu_tri_id', 'co_quan_trinh_ma', 'hoi_nghi_id');
UPDATE "public"."dinh_chinh" SET "cot" = 'owner_don_vi_ma' WHERE "cot" = 'co_quan_trinh_ma';
ALTER TABLE "public"."dinh_chinh" DROP CONSTRAINT "kl_dinh_chinh_cot_check";
ALTER TABLE "public"."dinh_chinh" ADD CONSTRAINT "dinh_chinh_cot_check"
  CHECK ("cot" IN ('han_xu_ly', 'loai_thoi_han_ma', 'tien_do_ma', 'ngay_hoan_thanh', 'minh_chung', 'nganh_ma',
                   'owner_don_vi_ma', 'ly_do_chua_co_han', 'linh_vuc_ma'));

-- 3. Hàm trigger (thân 0015/0021/0022 với tên mới).
CREATE OR REPLACE FUNCTION "public"."kl_hoi_nghi_sau_doi_ngay"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  PERFORM set_config('kl.tai_uoc_tinh', '1', true);
  UPDATE "public"."nhiem_vu" SET "ngay_nhan_van_ban" = coalesce(NEW."ngay_nhan", NEW."ngay_ban_hanh"), "ngay_nhan_uoc_tinh" = NEW."ngay_nhan" IS NULL
  WHERE "van_ban_id" = NEW."id" AND "ngay_nhan_uoc_tinh";
  PERFORM set_config('kl.tai_uoc_tinh', '', true);
  UPDATE "public"."nhiem_vu" SET "han_xu_ly" = NULL WHERE "van_ban_id" = NEW."id" AND "loai_thoi_han_ma" = 'KY_BAN_HANH';
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung',
                              'van_ban_trien_khai', 'ghi_chu', 'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi chỉ được cập nhật tiến độ, hạn, lý do chưa có hạn, ngày hoàn thành, minh chứng, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ngay_bh date; v_ky integer;
        v_da_hoan_thanh boolean := TG_OP = 'UPDATE' AND OLD."tien_do_ma" = 'HOAN_THANH';
        v_nhap_excel boolean := TG_OP = 'INSERT' AND NEW."nguon" = 'excel';
BEGIN
  SELECT "ngay_ban_hanh" INTO v_ngay_bh FROM "public"."van_ban_giao_viec" WHERE "id" = NEW."van_ban_id";
  IF NEW."loai_thoi_han_ma" = 'KY_BAN_HANH' THEN
    SELECT coalesce("gia_tri"::integer, 10) INTO v_ky FROM "public"."kl_cau_hinh" WHERE "khoa" = 'ky_ban_hanh_ngay';
    NEW."han_xu_ly" := v_ngay_bh + coalesce(v_ky, 10);
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" < v_ngay_bh THEN
    RAISE EXCEPTION 'Hạn xử lý không được trước ngày ban hành (%).', to_char(v_ngay_bh, 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF NEW."han_xu_ly" IS NOT NULL THEN NEW."ly_do_chua_co_han" := NULL; END IF;
  IF NEW."tien_do_ma" <> 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh" := NULL;
    NEW."dong_luc" := NULL;
  ELSE
    IF nullif(btrim(coalesce(NEW."minh_chung", '')), '') IS NULL
       AND NOT (v_da_hoan_thanh AND nullif(btrim(coalesce(OLD."minh_chung", '')), '') IS NULL)
       AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải có minh chứng (số hiệu văn bản hoặc đường dẫn).' USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NULL AND NOT (v_da_hoan_thanh AND OLD."ngay_hoan_thanh" IS NULL) AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải ghi ngày hoàn thành thật (theo văn bản minh chứng).' USING ERRCODE = '22023';
    END IF;
    IF NEW."ngay_hoan_thanh" IS NOT NULL AND (NEW."ngay_hoan_thanh" < v_ngay_bh OR NEW."ngay_hoan_thanh" > "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Ngày hoàn thành phải từ ngày ban hành tới hôm nay.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD."tien_do_ma" <> 'HOAN_THANH' THEN NEW."dong_luc" := now();
    ELSIF TG_OP = 'INSERT' AND NEW."nguon" = 'app' THEN NEW."dong_luc" := now();
    ELSIF TG_OP = 'UPDATE' THEN NEW."dong_luc" := OLD."dong_luc";
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' OR NEW."nguon" = 'app' THEN
    NEW."cap_nhat_luc" := now();
    NEW."cap_nhat_boi" := "auth"."uid"();
  END IF;
  IF TG_OP = 'INSERT' AND NEW."tao_boi" IS NULL THEN NEW."tao_boi" := "auth"."uid"(); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_quy_tac_1400"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_hn record; v_dv record; v_tk record; v_han_cha date;
BEGIN
  SELECT "ngay_ban_hanh", "ngay_nhan" INTO v_hn FROM "public"."van_ban_giao_viec" WHERE "id" = NEW."van_ban_id";
  IF NEW."ngay_nhan_van_ban" IS NULL THEN
    NEW."ngay_nhan_van_ban" := coalesce(v_hn."ngay_nhan", v_hn."ngay_ban_hanh");
    NEW."ngay_nhan_uoc_tinh" := v_hn."ngay_nhan" IS NULL;
  ELSIF TG_OP = 'UPDATE' AND NEW."ngay_nhan_van_ban" IS DISTINCT FROM OLD."ngay_nhan_van_ban"
        AND NEW."ngay_nhan_uoc_tinh" = OLD."ngay_nhan_uoc_tinh"
        AND current_setting('kl.tai_uoc_tinh', true) IS DISTINCT FROM '1' THEN
    NEW."ngay_nhan_uoc_tinh" := false;
  END IF;
  IF NEW."ngay_nhan_van_ban" < v_hn."ngay_ban_hanh" OR NEW."ngay_nhan_van_ban" > "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Ngày nhận văn bản phải từ ngày ban hành (%) tới hôm nay.', to_char(v_hn."ngay_ban_hanh", 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  IF NEW."nhiem_vu_cha" IS NOT NULL THEN
    IF EXISTS (WITH RECURSIVE t AS (SELECT "id", "nhiem_vu_cha", 1 AS d FROM "public"."nhiem_vu" WHERE "id" = NEW."nhiem_vu_cha"
                                    UNION ALL SELECT n."id", n."nhiem_vu_cha", t.d + 1 FROM "public"."nhiem_vu" n JOIN t ON n."id" = t."nhiem_vu_cha" WHERE t.d < 20)
               SELECT 1 FROM t WHERE t."id" = NEW."id" OR t."nhiem_vu_cha" = NEW."id") THEN
      RAISE EXCEPTION 'Nhiệm vụ cha tạo thành vòng tham chiếu.' USING ERRCODE = '22023';
    END IF;
    SELECT "han_xu_ly" INTO v_han_cha FROM "public"."nhiem_vu" WHERE "id" = NEW."nhiem_vu_cha";
    IF NEW."han_xu_ly" IS NOT NULL AND v_han_cha IS NOT NULL AND NEW."han_xu_ly" > v_han_cha THEN
      RAISE EXCEPTION 'Hạn của nhiệm vụ con không được sau hạn của nhiệm vụ cha (%).', to_char(v_han_cha, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly"
     AND EXISTS (SELECT 1 FROM "public"."nhiem_vu" c WHERE c."nhiem_vu_cha" = NEW."id" AND c."han_xu_ly" > NEW."han_xu_ly") THEN
    RAISE EXCEPTION 'Không rút hạn nhiệm vụ cha xuống trước hạn của nhiệm vụ con.' USING ERRCODE = '22023';
  END IF;
  IF NEW."owner_tai_khoan" IS NOT NULL THEN
    SELECT "ma", "trong_van_phong", "phong" INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = NEW."owner_don_vi_ma";
    SELECT "role_group", "department" INTO v_tk FROM "public"."accounts" WHERE "id" = NEW."owner_tai_khoan";
    IF v_dv."ma" IS NULL OR NOT v_dv."trong_van_phong" THEN
      RAISE EXCEPTION 'Owner là đơn vị ngoài Văn phòng thì không gắn tài khoản.' USING ERRCODE = '22023';
    ELSIF v_dv."phong" IS NULL AND v_tk."role_group" <> 'A1' THEN
      RAISE EXCEPTION 'Owner là Văn phòng Tỉnh ủy thì tài khoản phải là Lãnh đạo Văn phòng (A1).' USING ERRCODE = '22023';
    ELSIF v_dv."phong" IS NOT NULL AND v_tk."department" IS DISTINCT FROM v_dv."phong" THEN
      RAISE EXCEPTION 'Tài khoản Owner phải thuộc phòng % của đơn vị.', v_dv."phong" USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_lich_su"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_dc uuid := nullif(current_setting('kl.dinh_chinh_id', true), '')::uuid; r record;
        bo text[] := ARRAY['cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung', 'created_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (NEW."id", "auth"."uid"(), '*', NEW."ma", CASE WHEN NEW."nguon" = 'excel' THEN 'excel' ELSE 'app' END);
    RETURN NULL;
  END IF;
  FOR r IN SELECT n.key, o.value AS cu, n.value AS moi
           FROM jsonb_each_text(to_jsonb(NEW) - bo) n
           JOIN jsonb_each_text(to_jsonb(OLD) - bo) o ON o.key = n.key
           WHERE n.value IS DISTINCT FROM o.value LOOP
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon", "dinh_chinh_id")
    VALUES (NEW."id", "auth"."uid"(), r.key, r.cu, r.moi, CASE WHEN v_dc IS NULL THEN 'app' ELSE 'dinh_chinh' END, v_dc);
  END LOOP;
  RETURN NULL;
END;
$$;

-- 4. Hàm nghiệp vụ và phạm vi có thân chữ tham chiếu bảng/cột cũ.
CREATE OR REPLACE FUNCTION "public"."kl_thay_nhiem_vu"("p_id" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n
                 WHERE n."id" = "p_id" AND "public"."kl_pham_vi"(n."nguoi_theo_doi", n."nganh_ma", n."linh_vuc_ma"));
$$;

CREATE OR REPLACE FUNCTION "public"."kl_de_nghi_dinh_chinh"("p_nhiem_vu" uuid, "p_cot" text, "p_gia_tri_moi" text, "p_ly_do" text, "p_can_cu" text DEFAULT NULL)
RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_id uuid;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL
     OR NOT ("public"."me_quan_tri_kl"() OR v_nv."nguoi_theo_doi" = "auth"."uid"()) THEN
    RAISE EXCEPTION 'Chỉ người theo dõi hoặc người quản trị KL mới được đề nghị đính chính.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO "public"."dinh_chinh" ("nhiem_vu_id", "de_nghi_boi", "cot", "gia_tri_cu", "gia_tri_moi", "ly_do", "can_cu")
  VALUES ("p_nhiem_vu", "auth"."uid"(), "p_cot", to_jsonb(v_nv) ->> "p_cot", "p_gia_tri_moi", "p_ly_do", "p_can_cu")
  RETURNING "id" INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."kl_duyet_dinh_chinh"("p_id" uuid, "p_chap_nhan" boolean, "p_ly_do" text DEFAULT NULL)
RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."dinh_chinh";
BEGIN
  SELECT * INTO v FROM "public"."dinh_chinh" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL OR NOT "public"."me_quan_tri_kl"() OR v."de_nghi_boi" = "auth"."uid"() THEN
    RAISE EXCEPTION 'Chỉ người quản trị KL (không phải người đề nghị) mới được duyệt đính chính.' USING ERRCODE = '42501';
  END IF;
  IF v."trang_thai" <> 'CHO_DUYET' THEN
    RAISE EXCEPTION 'Đề nghị đính chính này đã được xử lý.' USING ERRCODE = '22023';
  END IF;
  IF "p_chap_nhan" THEN
    PERFORM set_config('kl.dinh_chinh_id', v."id"::text, true);
    EXECUTE format('UPDATE public.nhiem_vu SET %I = %L WHERE id = %L', v."cot", v."gia_tri_moi", v."nhiem_vu_id");
    PERFORM set_config('kl.dinh_chinh_id', '', true);
    UPDATE "public"."dinh_chinh" SET "trang_thai" = 'DA_DUYET', "duyet_boi" = "auth"."uid"(), "duyet_luc" = now() WHERE "id" = "p_id";
  ELSE
    IF nullif(btrim(coalesce("p_ly_do", '')), '') IS NULL THEN
      RAISE EXCEPTION 'Bác bỏ đính chính phải ghi lý do.' USING ERRCODE = '22023';
    END IF;
    UPDATE "public"."dinh_chinh" SET "trang_thai" = 'BAC_BO', "duyet_boi" = "auth"."uid"(), "duyet_luc" = now(),
      "ly_do_bac_bo" = btrim("p_ly_do") WHERE "id" = "p_id";
  END IF;
END;
$$;
-- kl_trang_thai (thân sql tham chiếu ghi_hoan_thanh_luc) và kl_tinh_trang_thai được thay ở 0024 cùng hàm trang_thai mới.
