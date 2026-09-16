-- GĐ16 (PR 16A) — Minh chứng có cấu trúc (SPEC MC-2…MC-6, DL-4; CH-6 = B: không Storage, cột tệp để sẵn NULL).
-- 1. Bảng minh_chung: một nhiệm vụ nhiều minh chứng; không xoá, bác bằng hop_le = false; chỉ đọc qua RLS theo phạm vi
--    nhiệm vụ, ghi chỉ qua hàm. Vị từ "hợp lệ" DUY NHẤT: minh_chung_la_hop_le(m) = loai ∈ (so_hieu, chu_cu) và
--    hop_le IS DISTINCT FROM false — dùng chung cho dong_nhiem_vu, trigger 0021 và cột so_minh_chung_hop_le của v_nhiem_vu.
-- 2. 76 minh chứng chữ cũ → dòng loai = chu_cu (giữ nguyên văn, tách số hiệu/ngày khi nhận dạng được, hop_le NULL — không
--    coi là vi phạm). Chỉ INSERT vào bảng mới nên không chạm trigger của nhiem_vu.
-- 3. thieu_minh_chung: bỏ biểu thức generated (chỉ nhìn cột chữ) → cột thường, trigger kl_nhiem_vu_truoc_ghi tính lại mỗi
--    lần ghi theo cả cột chữ và bảng minh_chung; giá trị hiện có giữ nguyên (78 việc cũ giữ cờ).
-- 4. Trigger 0021: việc theo_1400 chỉ nhận minh chứng trong bảng; việc cũ nhận chữ HOẶC bảng.
-- 5. Hàm nop_minh_chung(p) / xac_nhan_minh_chung(p_id, p_hop_le, p_ly_do) / dong_nhiem_vu(p_id, p_ngay_hoan_thanh);
--    mỗi hành động ghi lich_su + tin hệ thống cho nguoi_lien_quan (0026). v_nhiem_vu thêm so_minh_chung_hop_le, minh_chung_moi_nhat.
-- Quay lui = migration mới: DROP các hàm/cột view, khôi phục thân trigger 0023, DROP TABLE minh_chung.

-- 1. Bảng
CREATE TABLE "public"."minh_chung" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nhiem_vu_id" uuid NOT NULL REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE,
  "loai" text NOT NULL CHECK ("loai" IN ('so_hieu', 'chu_cu', 'tep')),
  "so_hieu" text,
  "ngay_van_ban" date,
  "cap_nhan" text REFERENCES "public"."dm_cap"("ma"),
  "noi_dung_chu" text,                         -- nguyên văn minh chứng chữ cũ (chu_cu)
  "tep_path" text, "tep_ten" text,             -- để sẵn, NULL cho tới khi có Storage (CH-6)
  "nop_boi" uuid REFERENCES "public"."accounts"("id"),
  "nop_luc" timestamptz NOT NULL DEFAULT now(),
  "hop_le" boolean,                            -- NULL chưa xác nhận | true hợp lệ | false bị bác (kèm lý do)
  "xac_nhan_boi" uuid REFERENCES "public"."accounts"("id"),
  "xac_nhan_luc" timestamptz,
  "ly_do_khong_hop_le" text,
  CONSTRAINT "minh_chung_so_hieu_du_ba_truong" CHECK ("loai" <> 'so_hieu' OR ("so_hieu" IS NOT NULL AND "ngay_van_ban" IS NOT NULL AND "cap_nhan" IS NOT NULL)),
  CONSTRAINT "minh_chung_chu_cu_co_noi_dung" CHECK ("loai" <> 'chu_cu' OR "noi_dung_chu" IS NOT NULL),
  CONSTRAINT "minh_chung_bac_co_ly_do" CHECK (("hop_le" IS NOT DISTINCT FROM false) = ("ly_do_khong_hop_le" IS NOT NULL))
);
CREATE INDEX "minh_chung_nhiem_vu_idx" ON "public"."minh_chung" ("nhiem_vu_id", "nop_luc" DESC);
ALTER TABLE "public"."minh_chung" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."minh_chung" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."minh_chung" TO "authenticated";
CREATE POLICY "minh_chung_select" ON "public"."minh_chung" FOR SELECT TO "authenticated"
  USING ("public"."kl_thay_nhiem_vu"("nhiem_vu_id"));

CREATE FUNCTION "public"."minh_chung_la_hop_le"("m" "public"."minh_chung") RETURNS boolean
LANGUAGE "sql" IMMUTABLE AS $$ SELECT "m"."loai" IN ('so_hieu', 'chu_cu') AND "m"."hop_le" IS DISTINCT FROM false; $$;

CREATE FUNCTION "public"."minh_chung_co_hop_le"("p_nhiem_vu" uuid) RETURNS boolean
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = "p_nhiem_vu" AND "public"."minh_chung_la_hop_le"(m));
$$;

-- 2. Tách số hiệu (12/CV-VPTU, 123-KL/TU, 45/BC-VPTU…) và ngày dd/mm/yyyy hoặc dd-mm-yyyy từ chữ cũ; ngày sai → NULL.
CREATE FUNCTION "public"."minh_chung_tach"("p_chu" text, OUT "so_hieu" text, OUT "ngay_van_ban" date)
LANGUAGE "plpgsql" IMMUTABLE AS $$
DECLARE m text[];
BEGIN
  "so_hieu" := substring("p_chu" FROM '(\d+[A-Za-z]?[-/][A-ZĐ][A-ZĐ0-9]*(?:[-/][A-ZĐ][A-ZĐ0-9]*)*)');
  m := regexp_match("p_chu", '(\d{1,2})[/-](\d{1,2})[/-](\d{4})');
  IF m IS NOT NULL THEN
    BEGIN "ngay_van_ban" := make_date(m[3]::integer, m[2]::integer, m[1]::integer);
    EXCEPTION WHEN OTHERS THEN "ngay_van_ban" := NULL; END;
  END IF;
END;
$$;

INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "noi_dung_chu", "nop_boi", "nop_luc")
SELECT n."id", 'chu_cu', t."so_hieu", t."ngay_van_ban", n."minh_chung", coalesce(n."cap_nhat_boi", n."tao_boi"),
       coalesce(n."dong_luc", n."cap_nhat_luc", n."created_at", now())
FROM "public"."nhiem_vu" n CROSS JOIN LATERAL "public"."minh_chung_tach"(n."minh_chung") t
WHERE nullif(btrim(coalesce(n."minh_chung", '')), '') IS NOT NULL;

-- 3. thieu_minh_chung thành cột thường (giữ giá trị), trigger tính lại.
ALTER TABLE "public"."nhiem_vu" ALTER COLUMN "thieu_minh_chung" DROP EXPRESSION;
ALTER TABLE "public"."nhiem_vu" ALTER COLUMN "thieu_minh_chung" SET DEFAULT false, ALTER COLUMN "thieu_minh_chung" SET NOT NULL;

-- 4. Trigger 0021/0023: giữ mọi kiểm tra cũ; đủ minh chứng = theo_1400 ? bảng : (chữ HOẶC bảng).
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ngay_bh date; v_ky integer; v_du boolean;
        v_da_hoan_thanh boolean := TG_OP = 'UPDATE' AND OLD."tien_do_ma" = 'HOAN_THANH';
        v_nhap_excel boolean := TG_OP = 'INSERT' AND NEW."nguon" = 'excel';
        v_co_chu boolean := nullif(btrim(coalesce(NEW."minh_chung", '')), '') IS NOT NULL;
        -- ghi_vet chỉ tính lại cờ (bác minh chứng sau khi đóng); coalesce vì GUC chưa từng set trả NULL, không phải '' (NULL làm IF bên dưới im lặng).
        v_tinh_lai boolean := coalesce(current_setting('kl.minh_chung_tinh_lai', true), '') = '1';
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
  v_du := CASE WHEN NEW."theo_1400" THEN "public"."minh_chung_co_hop_le"(NEW."id")
               ELSE v_co_chu OR "public"."minh_chung_co_hop_le"(NEW."id") END;
  IF NEW."tien_do_ma" <> 'HOAN_THANH' THEN
    NEW."ngay_hoan_thanh" := NULL;
    NEW."dong_luc" := NULL;
  ELSE
    IF NOT v_du AND NOT (v_da_hoan_thanh AND (OLD."thieu_minh_chung" OR v_tinh_lai)) AND NOT v_nhap_excel THEN
      RAISE EXCEPTION 'Chuyển sang Hoàn thành phải có minh chứng (%).',
        CASE WHEN NEW."theo_1400" THEN 'số hiệu, ngày văn bản và cấp nhận — nộp ở mục Minh chứng' ELSE 'số hiệu văn bản hoặc đường dẫn' END
        USING ERRCODE = '22023';
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
  NEW."thieu_minh_chung" := NEW."tien_do_ma" = 'HOAN_THANH' AND NOT v_du;
  IF (TG_OP = 'UPDATE' OR NEW."nguon" = 'app') AND NOT v_tinh_lai THEN   -- tính lại cờ không ghi đè người/giờ cập nhật cuối
    NEW."cap_nhat_luc" := now();
    NEW."cap_nhat_boi" := "auth"."uid"();
  END IF;
  IF TG_OP = 'INSERT' AND NEW."tao_boi" IS NULL THEN NEW."tao_boi" := "auth"."uid"(); END IF;
  RETURN NEW;
END;
$$;

-- 5. Hàm nội bộ: vết + tin; tính lại cờ thiếu minh chứng cho việc đã đóng (nhập bổ sung MC-5, bác minh chứng sau khi đóng).
CREATE FUNCTION "public"."minh_chung_ghi_vet"("p_nhiem_vu" uuid, "p_cot" text, "p_tin" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES ("p_nhiem_vu", "auth"."uid"(), "p_cot", "p_tin", 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT "auth"."uid"(), u, "p_tin", false, 'he_thong', "p_nhiem_vu" FROM "public"."nguoi_lien_quan"("p_nhiem_vu") u;
  PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
  UPDATE "public"."nhiem_vu" SET "thieu_minh_chung" = "thieu_minh_chung" WHERE "id" = "p_nhiem_vu" AND "tien_do_ma" = 'HOAN_THANH';
  PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
END;
$$;

-- Cận dưới ngày văn bản = ngày ban hành, không có thì ngày nhận; cả hai NULL chỉ kiểm cận trên ≤ hôm nay (giờ Việt Nam). Trả lỗi hoặc NULL.
CREATE FUNCTION "public"."minh_chung_kiem_ngay"("p_ngay" date, "p_ngay_ban_hanh" date, "p_ngay_nhan" date) RETURNS text
LANGUAGE "sql" STABLE AS $$
  SELECT CASE WHEN "p_ngay" > "public"."kl_hom_nay"() THEN 'Ngày văn bản không được sau hôm nay.'
              WHEN "p_ngay" < coalesce("p_ngay_ban_hanh", "p_ngay_nhan")
                THEN format('Ngày văn bản phải từ ngày ban hành/ngày nhận (%s) tới hôm nay.', to_char(coalesce("p_ngay_ban_hanh", "p_ngay_nhan"), 'DD/MM/YYYY')) END;
$$;

-- nop_minh_chung(p) → id: Owner tài khoản hoặc người theo dõi; p: nhiem_vu_id, so_hieu, ngay_van_ban, cap_nhan (ba trường bắt buộc).
CREATE FUNCTION "public"."nop_minh_chung"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_vb "public"."van_ban_giao_viec"; v_id uuid; v_loi text;
        v_so text := nullif(btrim(coalesce("p" ->> 'so_hieu', '')), ''); v_ngay date := nullif("p" ->> 'ngay_van_ban', '')::date;
        v_cap text := nullif(btrim(coalesce("p" ->> 'cap_nhan', '')), ''); v_cap_ten text;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner hoặc người theo dõi của nhiệm vụ mới nộp minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_so IS NULL OR v_ngay IS NULL OR v_cap IS NULL THEN
    RAISE EXCEPTION 'Minh chứng phải đủ ba trường: số hiệu, ngày văn bản và cấp nhận.' USING ERRCODE = '22023';
  END IF;
  SELECT "ten" INTO v_cap_ten FROM "public"."dm_cap" WHERE "ma" = v_cap;
  IF v_cap_ten IS NULL THEN RAISE EXCEPTION 'Cấp nhận không có trong danh mục.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION '%', v_loi USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "nop_boi")
  VALUES (v_nv."id", 'so_hieu', v_so, v_ngay, v_cap, "auth"."uid"()) RETURNING "id" INTO v_id;
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_nop',
    format('Nộp minh chứng · %s: số %s ngày %s, %s', v_nv."ma", v_so, to_char(v_ngay, 'DD/MM/YYYY'), v_cap_ten));
  RETURN v_id;
END;
$$;

-- xac_nhan_minh_chung: người theo dõi hoặc lãnh đạo (A1/A2) trong phạm vi kl_pham_vi, hoặc quan_tri_kl; không tự xác nhận của mình.
CREATE FUNCTION "public"."xac_nhan_minh_chung"("p_id" uuid, "p_hop_le" boolean, "p_ly_do" text DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_mc "public"."minh_chung"; v_nv "public"."nhiem_vu"; v_ly_do text := nullif(btrim(coalesce("p_ly_do", '')), '');
BEGIN
  SELECT * INTO v_mc FROM "public"."minh_chung" WHERE "id" = "p_id";
  IF v_mc."id" IS NOT NULL THEN SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_mc."nhiem_vu_id"; END IF;
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL
     OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR "public"."kl_duoc_chi_dao"(v_nv."id") OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ người theo dõi hoặc lãnh đạo trong phạm vi mới xác nhận minh chứng.' USING ERRCODE = '42501';
  END IF;
  IF v_mc."nop_boi" = "auth"."uid"() THEN
    RAISE EXCEPTION 'Không tự xác nhận minh chứng do chính mình nộp.' USING ERRCODE = '42501';
  END IF;
  IF "p_hop_le" IS NULL THEN RAISE EXCEPTION 'Phải chọn Hợp lệ hoặc Không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF NOT "p_hop_le" AND v_ly_do IS NULL THEN RAISE EXCEPTION 'Bác minh chứng phải ghi lý do.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."minh_chung" SET "hop_le" = "p_hop_le", "xac_nhan_boi" = "auth"."uid"(), "xac_nhan_luc" = now(),
    "ly_do_khong_hop_le" = CASE WHEN "p_hop_le" THEN NULL ELSE v_ly_do END WHERE "id" = "p_id";
  PERFORM "public"."minh_chung_ghi_vet"(v_nv."id", 'minh_chung_xac_nhan',
    format('%s · %s: %s%s', CASE WHEN "p_hop_le" THEN 'Minh chứng hợp lệ' ELSE 'Minh chứng không hợp lệ' END, v_nv."ma",
           coalesce(v_mc."so_hieu", left(v_mc."noi_dung_chu", 60)), CASE WHEN "p_hop_le" THEN '' ELSE ' — ' || v_ly_do END));
END;
$$;

-- dong_nhiem_vu: Owner tài khoản, người theo dõi, lãnh đạo trong phạm vi hoặc quan_tri_kl; cần ≥ 1 minh chứng hợp lệ;
-- ngày hoàn thành mặc định = ngày văn bản của minh chứng hợp lệ mới nhất; trigger kiểm khoảng ngày, đặt dong_luc; lead time từ trang_thai().
CREATE FUNCTION "public"."dong_nhiem_vu"("p_id" uuid, "p_ngay_hoan_thanh" date DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_ngay date;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = "p_id";
  IF v_nv."id" IS NULL OR "auth"."uid"() IS NULL OR (v_nv."nguoi_theo_doi" = "auth"."uid"() OR v_nv."owner_tai_khoan" = "auth"."uid"()
     OR "public"."kl_duoc_chi_dao"(v_nv."id") OR "public"."me_quan_tri_kl"()) IS NOT TRUE THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi hoặc lãnh đạo trong phạm vi mới đóng nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  IF v_nv."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."minh_chung_co_hop_le"("p_id") THEN
    RAISE EXCEPTION 'Đóng nhiệm vụ phải có ít nhất một minh chứng hợp lệ (số hiệu, ngày văn bản, cấp nhận).' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce("p_ngay_hoan_thanh", (SELECT m."ngay_van_ban" FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = "p_id"
                                         AND "public"."minh_chung_la_hop_le"(m) AND m."ngay_van_ban" IS NOT NULL ORDER BY m."nop_luc" DESC LIMIT 1)) INTO v_ngay;
  IF v_ngay IS NULL THEN RAISE EXCEPTION 'Minh chứng không có ngày văn bản — nhập ngày hoàn thành.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."nhiem_vu" SET "tien_do_ma" = 'HOAN_THANH', "ngay_hoan_thanh" = v_ngay WHERE "id" = "p_id";
  PERFORM "public"."minh_chung_ghi_vet"("p_id", 'dong_nhiem_vu', format('Đóng nhiệm vụ · %s: hoàn thành ngày %s', v_nv."ma", to_char(v_ngay, 'DD/MM/YYYY')));
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['minh_chung_la_hop_le(public.minh_chung)', 'minh_chung_co_hop_le(uuid)', 'minh_chung_tach(text)', 'minh_chung_kiem_ngay(date,date,date)',
                           'nop_minh_chung(jsonb)', 'xac_nhan_minh_chung(uuid,boolean,text)', 'dong_nhiem_vu(uuid,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION "public"."minh_chung_ghi_vet"(uuid, text, text) FROM public, anon, authenticated;
END $$;

-- 6. v_nhiem_vu: thêm hai cột cuối (CREATE OR REPLACE giữ cột cũ; v_ngoai_le 0026 không đổi).
CREATE OR REPLACE VIEW "public"."v_nhiem_vu" WITH ("security_invoker" = true) AS
SELECT nv."id", nv."ma", nv."van_ban_id", vb."loai" AS "van_ban_loai", vb."so_hoi_nghi", vb."so_ket_luan", vb."ngay_ban_hanh", vb."ngay_nhan" AS "van_ban_ngay_nhan",
       nv."nguoi_theo_doi", td."full_name" AS "nguoi_theo_doi_ten", td."department" AS "nguoi_theo_doi_phong",
       nv."owner_don_vi_ma", dv."ten" AS "owner_don_vi_ten", dv."trong_van_phong" AS "owner_trong_van_phong", dv."phong" AS "owner_phong",
       nv."owner_tai_khoan", ow."full_name" AS "owner_tai_khoan_ten",
       nv."san_pham_loai", sp."ten" AS "san_pham_ten", nv."san_pham_mo_ta",
       nv."cap_nhan_san_pham", cn."ten" AS "cap_nhan_san_pham_ten", nv."cap_quyet_dinh", cq."ten" AS "cap_quyet_dinh_ten",
       nv."ngay_nhan_van_ban", nv."ngay_nhan_uoc_tinh", nv."nhiem_vu_cha", nv."theo_1400",
       nv."nganh_ma", dn."ten" AS "nganh_ten", nv."linh_vuc_ma", lv."ten" AS "linh_vuc_ten", nv."linh_vuc_chi_tiet",
       nv."noi_dung", nv."loai_thoi_han_ma", dl."ten" AS "loai_thoi_han_ten",
       nv."han_xu_ly", nv."ly_do_chua_co_han", nv."tien_do_ma", nv."ngay_hoan_thanh", nv."minh_chung",
       nv."van_ban_trien_khai", nv."so_lan_gia_han", nv."nguon", nv."ghi_chu", nv."thieu_minh_chung",
       nv."dong_luc", nv."cap_nhat_luc", nv."cap_nhat_boi", nv."tao_boi", nv."created_at",
       (tt).trang_thai, (tt).so_ngay_qua, (tt).ket_qua, (tt).so_ngay_tre, (tt).do_tre_nhap_lieu,
       (tt).dang_dinh_chinh, (tt).nhom_dem, (tt).muc_canh_bao, (tt).lead_time_ngay,
       ("public"."kl_hom_nay"() - vb."ngay_ban_hanh")::integer AS "tuoi_ngay",
       (SELECT count(*) FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = nv."id" AND c."trang_thai" = 'CHO_PHAN_HOI')::integer AS "so_chi_dao_cho_phan_hoi",
       (SELECT count(*) FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = nv."id" AND "public"."minh_chung_la_hop_le"(m))::integer AS "so_minh_chung_hop_le",
       (SELECT to_jsonb(x) FROM (SELECT m."id", m."loai", m."so_hieu", m."ngay_van_ban", m."cap_nhan", mc."ten" AS "cap_nhan_ten", m."hop_le", m."nop_luc"
                                 FROM "public"."minh_chung" m LEFT JOIN "public"."dm_cap" mc ON mc."ma" = m."cap_nhan"
                                 WHERE m."nhiem_vu_id" = nv."id" ORDER BY m."nop_luc" DESC LIMIT 1) x) AS "minh_chung_moi_nhat"
FROM "public"."nhiem_vu" nv
CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "public"."kl_hom_nay"()) AS tt) t
JOIN "public"."van_ban_giao_viec" vb ON vb."id" = nv."van_ban_id"
LEFT JOIN "public"."accounts_public" td ON td."id" = nv."nguoi_theo_doi"
LEFT JOIN "public"."accounts_public" ow ON ow."id" = nv."owner_tai_khoan"
LEFT JOIN "public"."dm_don_vi" dv ON dv."ma" = nv."owner_don_vi_ma"
LEFT JOIN "public"."dm_san_pham" sp ON sp."ma" = nv."san_pham_loai"
LEFT JOIN "public"."dm_cap" cn ON cn."ma" = nv."cap_nhan_san_pham"
LEFT JOIN "public"."dm_cap" cq ON cq."ma" = nv."cap_quyet_dinh"
LEFT JOIN "public"."dm_nganh" dn ON dn."ma" = nv."nganh_ma"
LEFT JOIN "public"."dm_linh_vuc" lv ON lv."ma" = nv."linh_vuc_ma"
LEFT JOIN "public"."dm_loai_thoi_han" dl ON dl."ma" = nv."loai_thoi_han_ma";
