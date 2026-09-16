-- GĐ14 (PR 14AB, 1/3) — Thực thể thống nhất theo phụ lục Công văn 1400: PHẦN ADDITIVE (docs/SPEC.md v3 mục 5,
-- docs/LO-TRINH-V3.md 14A). Chỉ thêm danh mục, cột, quy tắc; không đổi tên, không xoá (đổi tên ở 0023).
-- Mỗi ràng buộc ghi mã thước đo (NT/CN/QT trong docs/MUC-TIEU-1400.md) hoặc câu hỏi đã chốt (CH-n trong
-- docs/CAU-HOI-NGHIEP-VU.md). Dữ liệu cũ (185 việc) chỉ được điền cột ngày nhận ước tính (CH-9), không suy đoán gì khác.

-- 1. Danh mục đơn vị (NT-1, CH-1): dm_co_quan_trinh thêm 3 cột; 5 dòng phòng của Văn phòng chèn ở PR 14C
--    (khi form đã đổi nhãn sang Owner — quyết định chủ dự án 16/9). Văn phòng Tỉnh ủy là dòng "trong Văn phòng" không có phòng.
ALTER TABLE "public"."dm_co_quan_trinh"
  ADD COLUMN "trong_van_phong" boolean NOT NULL DEFAULT false,
  ADD COLUMN "phong" text UNIQUE,
  ADD COLUMN "lanh_dao_phu_trach" uuid REFERENCES "public"."accounts"("id"),   -- CH-4b: lãnh đạo VP phụ trách đơn vị ngoài, nhập ở 16B
  ADD CONSTRAINT "dm_co_quan_trinh_phong_chi_trong_vp" CHECK ("phong" IS NULL OR "trong_van_phong");
UPDATE "public"."dm_co_quan_trinh" SET "trong_van_phong" = true WHERE "ma" = 'VAN_PHONG_TINH_UY';

-- 2. Danh mục sản phẩm đầu ra (NT-2, CH-5: 7 loại) và danh mục cấp (CN-3.2, CN-5.2(4), CH-7: 6 cấp).
CREATE TABLE "public"."dm_san_pham" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_san_pham" ("ma", "ten", "thu_tu") VALUES
  ('TO_TRINH', 'Tờ trình', 1), ('DU_THAO_VAN_BAN', 'Dự thảo văn bản', 2), ('BAO_CAO', 'Báo cáo', 3),
  ('KE_HOACH', 'Kế hoạch', 4), ('QUYET_DINH', 'Quyết định', 5), ('CONG_VAN', 'Công văn', 6), ('KHAC', 'Khác', 7);

CREATE TABLE "public"."dm_cap" ("ma" text PRIMARY KEY, "ten" text NOT NULL UNIQUE, "thu_tu" integer NOT NULL);
INSERT INTO "public"."dm_cap" ("ma", "ten", "thu_tu") VALUES
  ('THUONG_TRUC', 'Thường trực Tỉnh ủy', 1), ('BAN_THUONG_VU', 'Ban Thường vụ Tỉnh ủy', 2),
  ('CHANH_VAN_PHONG', 'Chánh Văn phòng', 3), ('PHO_CHANH_VAN_PHONG', 'Phó Chánh Văn phòng', 4),
  ('TRUONG_PHONG', 'Trưởng phòng', 5), ('DON_VI_TRINH', 'Đơn vị trình', 6);

ALTER TABLE "public"."dm_san_pham" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."dm_cap" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."dm_san_pham", "public"."dm_cap" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."dm_san_pham", "public"."dm_cap" TO "authenticated";
CREATE POLICY "dm_san_pham_select" ON "public"."dm_san_pham" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);
CREATE POLICY "dm_cap_select" ON "public"."dm_cap" FOR SELECT TO "authenticated" USING ((SELECT "auth"."uid"()) IS NOT NULL);

-- 3. Loại thời hạn cho việc tạo mới (NT-3, CH-8 = A): chỉ "Có hạn cụ thể" và "Ký ban hành"; hai loại không hạn chỉ cho dữ liệu cũ.
ALTER TABLE "public"."dm_loai_thoi_han" ADD COLUMN "cho_phep_tao_moi" boolean NOT NULL DEFAULT false;
UPDATE "public"."dm_loai_thoi_han" SET "cho_phep_tao_moi" = true WHERE "ma" IN ('CO_HAN_CU_THE', 'KY_BAN_HANH');

-- 4. Tham số cảnh báo (CN-4, NT-5, CH-10: Vàng 3, Đỏ đặc biệt ≥ 3; CH-8: ngày rà soát tối đa 30). 4 khoá cũ giữ nguyên.
INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('nguong_vang_ngay', '3', 'Mức VÀNG: còn ≤ N ngày tới hạn mà chưa có minh chứng (CN-4.1)'),
  ('nguong_do_dac_biet_ngay', '3', 'Mức ĐỎ ĐẶC BIỆT: quá hạn ≥ N ngày (CN-4.3, chủ dự án chọn cận dưới 3)'),
  ('ngay_ra_soat_toi_da', '30', 'Việc chờ điều kiện tạo mới: ngày rà soát tối đa N ngày kể từ ngày giao (CH-8)')
ON CONFLICT ("khoa") DO NOTHING;

-- 5. Văn bản giao việc (QT-1, CN-1.1, CH-14): kl_hoi_nghi thêm loại văn bản, ngày nhận thật, cơ quan ban hành.
--    32 dòng cũ = KL_BTV. so_hoi_nghi/UNIQUE cũ giữ nguyên (nới cho loại khác ở giai đoạn dùng tới).
ALTER TABLE "public"."kl_hoi_nghi"
  ADD COLUMN "loai" text NOT NULL DEFAULT 'KL_BTV'
    CHECK ("loai" IN ('KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'CONG_VAN', 'KHAC')),
  ADD COLUMN "ngay_nhan" date,
  ADD COLUMN "co_quan_ban_hanh" text;

CREATE OR REPLACE FUNCTION "public"."kl_hoi_nghi_truoc_ghi"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
BEGIN
  IF NEW."ngay_ban_hanh" > "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Ngày ban hành % ở tương lai — kiểm tra lại năm.', to_char(NEW."ngay_ban_hanh", 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  -- CN-1.1 / CH-9: ngày nhận văn bản thật nằm trong [ngày ban hành, hôm nay giờ Việt Nam].
  IF NEW."ngay_nhan" IS NOT NULL AND (NEW."ngay_nhan" < NEW."ngay_ban_hanh" OR NEW."ngay_nhan" > "public"."kl_hom_nay"()) THEN
    RAISE EXCEPTION 'Ngày nhận văn bản phải từ ngày ban hành tới hôm nay.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- Đổi ngày ban hành/ngày nhận của văn bản → (1) ngày nhận ƯỚC TÍNH của các nhiệm vụ thuộc văn bản tính lại theo văn bản
-- (biến phiên kl.tai_uoc_tinh để trigger nhiệm vụ không coi là sửa tay), (2) hạn "Ký ban hành" tính lại như 0015.
CREATE OR REPLACE FUNCTION "public"."kl_hoi_nghi_sau_doi_ngay"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  PERFORM set_config('kl.tai_uoc_tinh', '1', true);
  UPDATE "public"."kl_nhiem_vu" SET "ngay_nhan_van_ban" = coalesce(NEW."ngay_nhan", NEW."ngay_ban_hanh"), "ngay_nhan_uoc_tinh" = NEW."ngay_nhan" IS NULL
  WHERE "hoi_nghi_id" = NEW."id" AND "ngay_nhan_uoc_tinh";
  PERFORM set_config('kl.tai_uoc_tinh', '', true);
  UPDATE "public"."kl_nhiem_vu" SET "han_xu_ly" = NULL WHERE "hoi_nghi_id" = NEW."id" AND "loai_thoi_han_ma" = 'KY_BAN_HANH';
  RETURN NULL;
END;
$$;
DROP TRIGGER "kl_hoi_nghi_sau_doi_ngay" ON "public"."kl_hoi_nghi";
CREATE TRIGGER "kl_hoi_nghi_sau_doi_ngay" AFTER UPDATE OF "ngay_ban_hanh", "ngay_nhan" ON "public"."kl_hoi_nghi"
  FOR EACH ROW WHEN (OLD."ngay_ban_hanh" IS DISTINCT FROM NEW."ngay_ban_hanh" OR OLD."ngay_nhan" IS DISTINCT FROM NEW."ngay_nhan")
  EXECUTE FUNCTION "public"."kl_hoi_nghi_sau_doi_ngay"();

-- 6. Nhiệm vụ: cột theo 1-1-1-1-3. Tất cả nullable/mặc định để script nhập, form hiện có và fixture ghi được như cũ.
ALTER TABLE "public"."kl_nhiem_vu"
  ADD COLUMN "owner_tai_khoan" uuid REFERENCES "public"."accounts"("id"),                 -- NT-1, CH-1: Owner là tài khoản
  ADD COLUMN "san_pham_loai" text REFERENCES "public"."dm_san_pham"("ma"),                 -- NT-2, CH-5
  ADD COLUMN "san_pham_mo_ta" text,
  ADD COLUMN "cap_nhan_san_pham" text REFERENCES "public"."dm_cap"("ma"),                  -- CN-3.2, CH-7
  ADD COLUMN "cap_quyet_dinh" text REFERENCES "public"."dm_cap"("ma"),                     -- CN-5.2(4), CH-7
  ADD COLUMN "nhiem_vu_cha" uuid REFERENCES "public"."kl_nhiem_vu"("id"),                 -- CĐ-1, CH-3: chuỗi giao tiếp
  ADD COLUMN "theo_1400" boolean NOT NULL DEFAULT false,                                   -- true cho việc tạo từ v3 (bật ràng buộc bắt buộc ở 14C)
  ADD COLUMN "ngay_nhan_van_ban" date,                                                     -- CN-1.1, CH-9: mốc bắt đầu đếm
  ADD COLUMN "ngay_nhan_uoc_tinh" boolean NOT NULL DEFAULT false,                          -- CH-9: true = tạm bằng ngày ban hành
  ADD CONSTRAINT "kl_nhiem_vu_cha_khac_minh" CHECK ("nhiem_vu_cha" IS NULL OR "nhiem_vu_cha" <> "id");
CREATE INDEX "kl_nhiem_vu_cha_idx" ON "public"."kl_nhiem_vu" ("nhiem_vu_cha") WHERE "nhiem_vu_cha" IS NOT NULL;
CREATE INDEX "kl_nhiem_vu_owner_tai_khoan_idx" ON "public"."kl_nhiem_vu" ("owner_tai_khoan") WHERE "owner_tai_khoan" IS NOT NULL;

-- Điền dữ liệu cũ (CH-9, QT-3): ngày nhận tạm = ngày ban hành, cờ ước tính. Ba trigger của bảng tắt tạm trong cùng
-- transaction để cap_nhat_luc/cap_nhat_boi KHÔNG đổi và kl_lich_su KHÔNG sinh dòng (đây là điền cột mới, không phải
-- ai sửa việc). Sau khi điền, cột bắt buộc.
ALTER TABLE "public"."kl_nhiem_vu" DISABLE TRIGGER "a_kl_nhiem_vu_guard_a3";
ALTER TABLE "public"."kl_nhiem_vu" DISABLE TRIGGER "b_kl_nhiem_vu_truoc_ghi";
ALTER TABLE "public"."kl_nhiem_vu" DISABLE TRIGGER "c_kl_nhiem_vu_lich_su";
UPDATE "public"."kl_nhiem_vu" n SET "ngay_nhan_van_ban" = h."ngay_ban_hanh", "ngay_nhan_uoc_tinh" = true
FROM "public"."kl_hoi_nghi" h WHERE h."id" = n."hoi_nghi_id" AND n."ngay_nhan_van_ban" IS NULL;
ALTER TABLE "public"."kl_nhiem_vu" ENABLE TRIGGER "a_kl_nhiem_vu_guard_a3";
ALTER TABLE "public"."kl_nhiem_vu" ENABLE TRIGGER "b_kl_nhiem_vu_truoc_ghi";
ALTER TABLE "public"."kl_nhiem_vu" ENABLE TRIGGER "c_kl_nhiem_vu_lich_su";
ALTER TABLE "public"."kl_nhiem_vu" ALTER COLUMN "ngay_nhan_van_ban" SET NOT NULL;

-- 7. Quy tắc mới của nhiệm vụ, tách thành trigger riêng (chạy sau b_, trước c_) để thân 0021 giữ nguyên:
--    (a) ngày nhận (CN-1.1, CH-9): thiếu → = ngày nhận của văn bản (cờ false) hoặc ngày ban hành (cờ true); có → ∈ [ngày BH, hôm nay];
--        sửa tay ngày nhận → cờ ước tính tắt.
--    (b) cha–con (CH-3): hạn con ≤ hạn cha; không vòng; rút hạn cha xuống dưới hạn con bị chặn.
--    (c) Owner tài khoản (NT-1, CH-1, SPEC mục 2): đơn vị là Văn phòng → tài khoản A1; đơn vị là phòng → accounts.department = phong;
--        đơn vị ngoài Văn phòng → không có tài khoản.
CREATE FUNCTION "public"."kl_nhiem_vu_quy_tac_1400"() RETURNS trigger
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_hn record; v_dv record; v_tk record; v_han_cha date;
BEGIN
  SELECT "ngay_ban_hanh", "ngay_nhan" INTO v_hn FROM "public"."kl_hoi_nghi" WHERE "id" = NEW."hoi_nghi_id";
  -- (a) ngày nhận văn bản
  IF NEW."ngay_nhan_van_ban" IS NULL THEN
    NEW."ngay_nhan_van_ban" := coalesce(v_hn."ngay_nhan", v_hn."ngay_ban_hanh");
    NEW."ngay_nhan_uoc_tinh" := v_hn."ngay_nhan" IS NULL;
  ELSIF TG_OP = 'UPDATE' AND NEW."ngay_nhan_van_ban" IS DISTINCT FROM OLD."ngay_nhan_van_ban"
        AND NEW."ngay_nhan_uoc_tinh" = OLD."ngay_nhan_uoc_tinh"
        AND current_setting('kl.tai_uoc_tinh', true) IS DISTINCT FROM '1' THEN
    NEW."ngay_nhan_uoc_tinh" := false;   -- sửa tay = ngày nhận thật (trừ khi trigger văn bản đang tính lại ước tính)
  END IF;
  IF NEW."ngay_nhan_van_ban" < v_hn."ngay_ban_hanh" OR NEW."ngay_nhan_van_ban" > "public"."kl_hom_nay"() THEN
    RAISE EXCEPTION 'Ngày nhận văn bản phải từ ngày ban hành (%) tới hôm nay.', to_char(v_hn."ngay_ban_hanh", 'DD/MM/YYYY') USING ERRCODE = '22023';
  END IF;
  -- (b) chuỗi cha–con
  IF NEW."nhiem_vu_cha" IS NOT NULL THEN
    IF EXISTS (WITH RECURSIVE t AS (SELECT "id", "nhiem_vu_cha", 1 AS d FROM "public"."kl_nhiem_vu" WHERE "id" = NEW."nhiem_vu_cha"
                                    UNION ALL SELECT n."id", n."nhiem_vu_cha", t.d + 1 FROM "public"."kl_nhiem_vu" n JOIN t ON n."id" = t."nhiem_vu_cha" WHERE t.d < 20)
               SELECT 1 FROM t WHERE t."id" = NEW."id" OR t."nhiem_vu_cha" = NEW."id") THEN
      RAISE EXCEPTION 'Nhiệm vụ cha tạo thành vòng tham chiếu.' USING ERRCODE = '22023';
    END IF;
    SELECT "han_xu_ly" INTO v_han_cha FROM "public"."kl_nhiem_vu" WHERE "id" = NEW."nhiem_vu_cha";
    IF NEW."han_xu_ly" IS NOT NULL AND v_han_cha IS NOT NULL AND NEW."han_xu_ly" > v_han_cha THEN
      RAISE EXCEPTION 'Hạn của nhiệm vụ con không được sau hạn của nhiệm vụ cha (%).', to_char(v_han_cha, 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."han_xu_ly" IS NOT NULL AND NEW."han_xu_ly" IS DISTINCT FROM OLD."han_xu_ly"
     AND EXISTS (SELECT 1 FROM "public"."kl_nhiem_vu" c WHERE c."nhiem_vu_cha" = NEW."id" AND c."han_xu_ly" > NEW."han_xu_ly") THEN
    RAISE EXCEPTION 'Không rút hạn nhiệm vụ cha xuống trước hạn của nhiệm vụ con.' USING ERRCODE = '22023';
  END IF;
  -- (c) Owner tài khoản khớp đơn vị
  IF NEW."owner_tai_khoan" IS NOT NULL THEN
    SELECT "ma", "trong_van_phong", "phong" INTO v_dv FROM "public"."dm_co_quan_trinh" WHERE "ma" = NEW."co_quan_trinh_ma";
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
REVOKE ALL ON FUNCTION "public"."kl_nhiem_vu_quy_tac_1400"() FROM public, anon, authenticated;
CREATE TRIGGER "bb_kl_nhiem_vu_quy_tac_1400" BEFORE INSERT OR UPDATE ON "public"."kl_nhiem_vu"
  FOR EACH ROW EXECUTE FUNCTION "public"."kl_nhiem_vu_quy_tac_1400"();
