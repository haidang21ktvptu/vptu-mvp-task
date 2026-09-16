-- GĐ15 (PR 15A) — Điều hành ngoại lệ (phụ lục 1400 bước 5; SPEC v3 CĐ-1, CĐ-3, DB-1, DL-5; LO-TRINH GĐ17 + 18B, đảo lên).
-- Lãnh đạo ra quyết định TRỰC TIẾP trên điểm nghẽn: luồng chỉ đạo → phản hồi → đóng, mỗi hành động ghi lich_su và tạo tin hệ
-- thống cho người liên quan; view v_ngoai_le chỉ việc Đỏ/Đỏ đặc biệt với 4 trường bắt buộc (CN-5.2). Mã 1400/CH-n trong ngoặc.

-- 1. chi_dao: thêm loại Y_KIEN (bình luận, không cần phản hồi) và PHAN_HOI (từ Owner/người theo dõi lên, tra_loi_cho = chỉ đạo gốc);
--    ghi chỉ qua hàm (policy INSERT trực tiếp bỏ — mọi thay đổi có vết). Bảng chi_dao_da_doc: đã đọc theo người.
ALTER TABLE "public"."chi_dao" DROP CONSTRAINT "kl_chi_dao_loai_check";
ALTER TABLE "public"."chi_dao"
  ADD CONSTRAINT "chi_dao_loai_check" CHECK ("loai" IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN', 'PHAN_HOI')),
  ADD COLUMN "tra_loi_cho" uuid REFERENCES "public"."chi_dao"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "chi_dao_phan_hoi_co_goc" CHECK (("loai" = 'PHAN_HOI') = ("tra_loi_cho" IS NOT NULL));
CREATE INDEX "chi_dao_tra_loi_cho_idx" ON "public"."chi_dao" ("tra_loi_cho") WHERE "tra_loi_cho" IS NOT NULL;
DROP POLICY "kl_chi_dao_insert_lanh_dao" ON "public"."chi_dao";
REVOKE INSERT ON TABLE "public"."chi_dao", "public"."kl_chi_dao" FROM "authenticated";

CREATE TABLE "public"."chi_dao_da_doc" (
  "chi_dao_id" uuid NOT NULL REFERENCES "public"."chi_dao"("id") ON DELETE CASCADE,
  "nguoi" uuid NOT NULL REFERENCES "public"."accounts"("id"),
  "luc" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("chi_dao_id", "nguoi")
);
ALTER TABLE "public"."chi_dao_da_doc" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."chi_dao_da_doc" FROM "anon", "authenticated";
GRANT SELECT ON TABLE "public"."chi_dao_da_doc" TO "authenticated";
CREATE POLICY "chi_dao_da_doc_select_minh" ON "public"."chi_dao_da_doc" FOR SELECT TO "authenticated" USING ("nguoi" = (SELECT "auth"."uid"()));

-- 2. direct_messages (CĐ-3): loai 'nguoi' | 'he_thong', nhiem_vu_id. Tin hệ thống chỉ hàm tạo (policy INSERT chỉ cho 'nguoi');
--    "đã đọc" theo is_read/read_at hiện có: chat 1-1 chỉ đánh dấu tin 'nguoi'; tin hệ thống đánh dấu theo nhiệm vụ.
ALTER TABLE "public"."direct_messages"
  ADD COLUMN "loai" text NOT NULL DEFAULT 'nguoi' CHECK ("loai" IN ('nguoi', 'he_thong')),
  ADD COLUMN "nhiem_vu_id" uuid REFERENCES "public"."nhiem_vu"("id") ON DELETE CASCADE;
CREATE INDEX "direct_messages_he_thong_idx" ON "public"."direct_messages" ("receiver_id", "is_read") WHERE "loai" = 'he_thong';
DROP POLICY "messages_insert" ON "public"."direct_messages";
CREATE POLICY "messages_insert" ON "public"."direct_messages" FOR INSERT TO "authenticated"
  WITH CHECK ("sender_id" = (SELECT "auth"."uid"()) AND "loai" = 'nguoi');
CREATE OR REPLACE FUNCTION "public"."mark_messages_read"("p_peer_id" uuid) RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  UPDATE "public"."direct_messages" SET "is_read" = true, "read_at" = now()
  WHERE "sender_id" = "p_peer_id" AND "receiver_id" = "auth"."uid"() AND "is_read" = false AND "loai" = 'nguoi';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
-- Đánh dấu đã đọc tin hệ thống của tôi về một nhiệm vụ (NULL = tất cả).
CREATE FUNCTION "public"."tin_he_thong_da_doc"("p_nhiem_vu" uuid DEFAULT NULL) RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF "auth"."uid"() IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập.' USING ERRCODE = '42501'; END IF;
  UPDATE "public"."direct_messages" SET "is_read" = true, "read_at" = now()
  WHERE "receiver_id" = "auth"."uid"() AND "loai" = 'he_thong' AND "is_read" = false AND ("p_nhiem_vu" IS NULL OR "nhiem_vu_id" = "p_nhiem_vu");
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
-- Đánh dấu đã đọc mọi chỉ đạo/phản hồi của một nhiệm vụ trong phạm vi (gọi khi mở luồng).
CREATE FUNCTION "public"."chi_dao_danh_dau_doc"("p_nhiem_vu" uuid) RETURNS integer
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_n integer;
BEGIN
  IF NOT "public"."kl_thay_nhiem_vu"("p_nhiem_vu") THEN RAISE EXCEPTION 'Nhiệm vụ ngoài phạm vi của đồng chí.' USING ERRCODE = '42501'; END IF;
  INSERT INTO "public"."chi_dao_da_doc" ("chi_dao_id", "nguoi")
  SELECT c."id", "auth"."uid"() FROM "public"."chi_dao" c WHERE c."nhiem_vu_id" = "p_nhiem_vu" ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- 3. Người liên quan của một nhiệm vụ (mỗi người MỘT lần, trừ người gọi): Owner tài khoản, người theo dõi, trưởng phòng của
--    hai người đó (và của phòng Owner khi Owner là phòng), PCVP phụ trách phòng/lĩnh vực (kiêm nhiệm có thì chỉ người đó — cùng
--    quy tắc kl_pham_vi_pcvp 0025), Chánh VP, mọi người đã ra chỉ đạo/phản hồi trong luồng. Tài khoản hệ thống không nhận.
CREATE FUNCTION "public"."pcvp_phu_trach"("p_phong" text, "p_nganh_ma" text, "p_linh_vuc_ma" text) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce(kn."id", a."id")
  FROM (SELECT "public"."nguoi_kiem_nhiem"("p_phong", "p_nganh_ma", "p_linh_vuc_ma", "public"."kl_hom_nay"()) AS "id") kn
  LEFT JOIN "public"."accounts" a ON kn."id" IS NULL AND a."role_group" = 'A1' AND NOT a."is_chief" AND "public"."phu_trach"(a."id", "p_phong", "public"."kl_hom_nay"())
  WHERE "p_phong" IS NOT NULL AND coalesce(kn."id", a."id") IS NOT NULL;   -- kiêm nhiệm có → chỉ người đó (kể cả khi chưa ai phụ trách cả phòng)
$$;
CREATE FUNCTION "public"."nguoi_lien_quan"("p_nhiem_vu" uuid) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH nv AS (SELECT n.*, "public"."kl_phong_owner"(n."owner_tai_khoan", n."owner_don_vi_ma") AS phong_owner,
                     (SELECT "department" FROM "public"."accounts" WHERE "id" = n."nguoi_theo_doi") AS phong_theo_doi
              FROM "public"."nhiem_vu" n WHERE n."id" = "p_nhiem_vu"
                AND ("auth"."uid"() IS NULL OR "public"."kl_thay_nhiem_vu"("p_nhiem_vu"))),
  phong AS (SELECT phong_owner AS p FROM nv UNION SELECT phong_theo_doi FROM nv),
  ds AS (
    SELECT "owner_tai_khoan" FROM nv UNION SELECT "nguoi_theo_doi" FROM nv
    UNION SELECT a."id" FROM "public"."accounts" a, phong WHERE a."role_group" = 'A2' AND a."department" = phong.p
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, nv."nganh_ma", nv."linh_vuc_ma") FROM phong, nv
    UNION SELECT a."id" FROM "public"."accounts" a, nv WHERE a."is_chief" AND a."role_group" = 'A1'
    UNION SELECT c."nguoi_gui" FROM "public"."chi_dao" c JOIN nv ON c."nhiem_vu_id" = nv."id")
  SELECT DISTINCT ds."owner_tai_khoan" FROM ds JOIN "public"."accounts" a ON a."id" = ds."owner_tai_khoan"
  WHERE NOT a."is_system" AND ds."owner_tai_khoan" IS DISTINCT FROM "auth"."uid"();
$$;

-- 4. Tên loại, thông báo + lịch sử cho một hành động trong luồng (nội bộ, không cấp cho authenticated).
CREATE FUNCTION "public"."chi_dao_ten_loai"("p_loai" text) RETURNS text
LANGUAGE "sql" IMMUTABLE AS $$
  SELECT CASE "p_loai" WHEN 'DON_DOC' THEN 'Đôn đốc' WHEN 'GIA_HAN' THEN 'Gia hạn' WHEN 'GIAO_LAI' THEN 'Giao lại' WHEN 'YEU_CAU_MINH_CHUNG' THEN 'Yêu cầu minh chứng'
    WHEN 'KIEM_TRA_SO_LIEU' THEN 'Kiểm tra số liệu' WHEN 'Y_KIEN' THEN 'Ý kiến' WHEN 'PHAN_HOI' THEN 'Phản hồi' WHEN 'DONG' THEN 'Đóng chỉ đạo' ELSE "p_loai" END;
$$;
-- Tin hệ thống = tên loại · mã nhiệm vụ: trích 120 ký tự; người nhận = nguoi_lien_quan (trừ người gửi) + p_them (người theo dõi cũ khi giao lại).
CREATE FUNCTION "public"."chi_dao_ghi_vet"("p_nhiem_vu" uuid, "p_loai" text, "p_noi_dung" text, "p_them" uuid DEFAULT NULL) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ma text; v_tin text;
BEGIN
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  v_tin := format('%s · %s: %s', "public"."chi_dao_ten_loai"("p_loai"), v_ma, left(btrim("p_noi_dung"), 120));
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_nhiem_vu", "auth"."uid"(), 'chi_dao', v_tin, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT "auth"."uid"(), u, v_tin, false, 'he_thong', "p_nhiem_vu"
  FROM (SELECT "public"."nguoi_lien_quan"("p_nhiem_vu") AS u UNION SELECT "p_them" WHERE "p_them" IS NOT NULL AND "p_them" <> "auth"."uid"()) t;
END;
$$;

-- Guard cột của người theo dõi/Owner (0025) bỏ qua khi hàm chỉ đạo đang đổi hạn/loại hạn/người theo dõi (biến phiên kl.chi_dao).
CREATE OR REPLACE FUNCTION "public"."kl_nhiem_vu_guard_a3"() RETURNS trigger
LANGUAGE "plpgsql" SET "search_path" = "public" AS $$
DECLARE loai text[] := ARRAY['tien_do_ma', 'han_xu_ly', 'ly_do_chua_co_han', 'ngay_hoan_thanh', 'minh_chung', 'van_ban_trien_khai', 'ghi_chu',
                              'san_pham_loai', 'san_pham_mo_ta', 'cap_nhan_san_pham', 'cap_quyet_dinh', 'ngay_nhan_van_ban', 'ngay_nhan_uoc_tinh',
                              'cap_nhat_luc', 'cap_nhat_boi', 'dong_luc', 'thieu_minh_chung'];
BEGIN
  IF "auth"."uid"() IS NULL OR "public"."me_quan_tri_kl"() OR current_setting('kl.chi_dao', true) = '1' THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - loai) IS DISTINCT FROM (to_jsonb(OLD) - loai) THEN
    RAISE EXCEPTION 'Người theo dõi/Owner chỉ được cập nhật tiến độ, hạn, ngày hoàn thành, minh chứng, sản phẩm, cấp, ngày nhận, văn bản triển khai, ghi chú.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 5. chi_dao_gui(p) → id: A1/A2 trong phạm vi (kl_duoc_chi_dao 0016). p: nhiem_vu_id, loai, noi_dung, han_phan_hoi,
--    han_moi (GIA_HAN, DL-5: bắt buộc, sau hạn cũ; đổi han_xu_ly + so_lan_gia_han + 1, hạn cũ vào lich_su qua trigger; việc "Ký ban
--    hành" chuyển sang "Có hạn cụ thể" vì hạn ký ban hành là hạn tự tính), nguoi_theo_doi_moi (GIAO_LAI: phải trong phạm vi
--    người ra chỉ đạo — A2 cùng phòng, PCVP phòng phụ trách, Chánh VP/quan_tri_kl mọi cán bộ; người theo dõi cũ cũng nhận tin).
CREATE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_id uuid; v_cu uuid;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = ("p" ->> 'nhiem_vu_id')::uuid;
  IF v_nv."id" IS NULL OR NOT "public"."kl_duoc_chi_dao"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc trưởng phòng trong phạm vi mới ra chỉ đạo trên nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  IF v_loai NOT IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN') THEN
    RAISE EXCEPTION 'Loại chỉ đạo không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Chỉ đạo phải có nội dung (lý do).' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF v_loai IN ('GIA_HAN', 'GIAO_LAI') AND v_nv."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không gia hạn hay giao lại.' USING ERRCODE = '22023';
  END IF;
  IF v_loai = 'GIA_HAN' THEN
    v_han_moi := nullif("p" ->> 'han_moi', '')::date;
    IF v_nv."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Việc chưa có hạn thì điền hạn ở Cập nhật, không gia hạn.' USING ERRCODE = '22023'; END IF;
    IF v_han_moi IS NULL OR v_han_moi <= v_nv."han_xu_ly" THEN
      RAISE EXCEPTION 'Gia hạn phải có hạn mới sau hạn hiện tại (%).', to_char(v_nv."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023';
    END IF;
  ELSIF v_loai = 'GIAO_LAI' THEN
    SELECT * INTO v_moi FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'nguoi_theo_doi_moi', '')::uuid;
    IF v_moi."id" IS NULL OR v_moi."is_system" OR v_moi."id" = v_nv."nguoi_theo_doi" THEN
      RAISE EXCEPTION 'Giao lại phải chọn một người theo dõi mới khác người hiện tại.' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_me."quan_tri_kl" OR v_me."is_chief"
            OR (v_me."role_group" = 'A2' AND v_moi."department" = v_me."department")
            OR (v_me."role_group" = 'A1' AND "public"."phu_trach"(v_me."id", v_moi."department", "public"."kl_hom_nay"()))) THEN
      RAISE EXCEPTION 'Người theo dõi mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    v_cu := v_nv."nguoi_theo_doi";
  END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "han_phan_hoi", "han_moi", "chu_tri_moi", "trang_thai")
  VALUES (v_nv."id", v_me."id", v_loai, v_noi_dung, nullif("p" ->> 'han_phan_hoi', '')::date, v_han_moi, v_moi."id",
          CASE WHEN v_loai = 'Y_KIEN' THEN 'DA_DONG' ELSE 'CHO_PHAN_HOI' END)
  RETURNING "id" INTO v_id;
  PERFORM set_config('kl.chi_dao', '1', true);
  IF v_loai = 'GIA_HAN' THEN
    UPDATE "public"."nhiem_vu" SET "han_xu_ly" = v_han_moi, "so_lan_gia_han" = "so_lan_gia_han" + 1,
      "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END WHERE "id" = v_nv."id";
  ELSIF v_loai = 'GIAO_LAI' THEN
    UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_moi."id" WHERE "id" = v_nv."id";
  END IF;
  PERFORM set_config('kl.chi_dao', '', true);
  PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), v_noi_dung) ELSE v_noi_dung END, v_cu);
  RETURN v_id;
END;
$$;

-- 6. chi_dao_phan_hoi(p) → id: Owner tài khoản, người theo dõi hoặc người đã tham gia luồng; p: chi_dao_id (gốc hoặc một phản
--    hồi), noi_dung. Chỉ đạo gốc đã đóng thì không phản hồi thêm; người khác người ra chỉ đạo phản hồi → gốc = DA_PHAN_HOI.
CREATE FUNCTION "public"."chi_dao_phan_hoi"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_goc "public"."chi_dao"; v_nv "public"."nhiem_vu"; v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_id uuid;
BEGIN
  SELECT g.* INTO v_goc FROM "public"."chi_dao" c JOIN "public"."chi_dao" g ON g."id" = coalesce(c."tra_loi_cho", c."id")
  WHERE c."id" = ("p" ->> 'chi_dao_id')::uuid;
  IF v_goc."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_goc."nhiem_vu_id") THEN
    RAISE EXCEPTION 'Không tìm thấy chỉ đạo trong phạm vi của đồng chí.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_goc."nhiem_vu_id";
  -- coalesce: owner_tai_khoan NULL (Owner là đơn vị/phòng) không được làm điều kiện thành NULL → IF bỏ qua → lọt.
  IF NOT (coalesce("auth"."uid"() = v_nv."owner_tai_khoan", false) OR "auth"."uid"() = v_nv."nguoi_theo_doi"
          OR EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nguoi_gui" = "auth"."uid"() AND (c."id" = v_goc."id" OR c."tra_loi_cho" = v_goc."id"))) THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi hoặc người đã tham gia luồng mới phản hồi chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v_goc."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo đã đóng, không phản hồi thêm.' USING ERRCODE = '22023'; END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Phản hồi phải có nội dung.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "tra_loi_cho", "trang_thai")
  VALUES (v_goc."nhiem_vu_id", "auth"."uid"(), 'PHAN_HOI', v_noi_dung, v_goc."id", 'DA_DONG') RETURNING "id" INTO v_id;
  UPDATE "public"."chi_dao" SET "phan_hoi" = v_noi_dung, "phan_hoi_boi" = "auth"."uid"(), "phan_hoi_luc" = now(),
    "trang_thai" = CASE WHEN "nguoi_gui" <> "auth"."uid"() THEN 'DA_PHAN_HOI' ELSE "trang_thai" END WHERE "id" = v_goc."id";
  PERFORM "public"."chi_dao_ghi_vet"(v_goc."nhiem_vu_id", 'PHAN_HOI', v_noi_dung);
  RETURN v_id;
END;
$$;

-- 7. chi_dao_dong(p_id): người ra chỉ đạo (hoặc quan_tri_kl) đóng chỉ đạo gốc.
CREATE FUNCTION "public"."chi_dao_dong"("p_id" uuid) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."chi_dao";
BEGIN
  SELECT * INTO v FROM "public"."chi_dao" WHERE "id" = "p_id" AND "tra_loi_cho" IS NULL;
  IF v."id" IS NULL OR NOT (v."nguoi_gui" = "auth"."uid"() OR "public"."me_quan_tri_kl"()) THEN
    RAISE EXCEPTION 'Chỉ người ra chỉ đạo mới đóng được chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo này đã đóng.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."chi_dao" SET "trang_thai" = 'DA_DONG' WHERE "id" = "p_id";
  PERFORM "public"."chi_dao_ghi_vet"(v."nhiem_vu_id", 'DONG', v."noi_dung");
END;
$$;

-- 8. dat_cap_quyet_dinh(p_id, p_cap): A1/A2 trong phạm vi (hoặc quan_tri_kl) điền "cấp cần quyết định" ngay trên dashboard
--    (CN-5.2(4), CH-7) — policy UPDATE nhiem_vu chỉ cho Owner/người theo dõi nên đi qua hàm; lịch sử ghi bằng trigger.
CREATE FUNCTION "public"."dat_cap_quyet_dinh"("p_id" uuid, "p_cap" text) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  IF NOT ("public"."kl_duoc_chi_dao"("p_id") OR ("public"."me_quan_tri_kl"() AND "public"."kl_thay_nhiem_vu"("p_id"))) THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo trong phạm vi mới xác định cấp cần quyết định.' USING ERRCODE = '42501';
  END IF;
  IF "p_cap" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."dm_cap" WHERE "ma" = "p_cap") THEN
    RAISE EXCEPTION 'Cấp không có trong danh mục.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."nhiem_vu" SET "cap_quyet_dinh" = "p_cap" WHERE "id" = "p_id" AND "cap_quyet_dinh" IS DISTINCT FROM "p_cap";
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['chi_dao_ten_loai(text)', 'chi_dao_ghi_vet(uuid,text,text,uuid)', 'pcvp_phu_trach(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['tin_he_thong_da_doc(uuid)', 'chi_dao_danh_dau_doc(uuid)', 'nguoi_lien_quan(uuid)', 'chi_dao_gui(jsonb)',
                           'chi_dao_phan_hoi(jsonb)', 'chi_dao_dong(uuid)', 'dat_cap_quyet_dinh(uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- 9. v_ngoai_le (DB-1, CN-5.1/5.2; security_invoker → RLS nhiem_vu lọc): chỉ DO/DO_DAC_BIET; 4 trường bắt buộc (Owner, số ngày
--    trễ, sản phẩm còn thiếu hoặc "chưa định nghĩa", cấp cần quyết định hoặc "chưa xác định") + phụ; việc đang đính chính = nhóm
--    DANG_TRA_SOAT; sắp số ngày trễ giảm dần. Tổng dòng = ô Quá hạn + Đang đính chính của dashboard (bất biến DB-5).
CREATE VIEW "public"."v_ngoai_le" WITH ("security_invoker" = true) AS
SELECT v."id", v."ma", v."noi_dung", v."theo_1400", v."so_hoi_nghi", v."so_ket_luan", v."van_ban_loai",
       v."owner_don_vi_ma", v."owner_don_vi_ten", v."owner_trong_van_phong", v."owner_tai_khoan", v."owner_tai_khoan_ten",
       coalesce(v."owner_tai_khoan_ten", v."owner_don_vi_ten") AS "owner_ten",
       v."so_ngay_qua", v."han_xu_ly", v."so_lan_gia_han", v."muc_canh_bao",
       v."san_pham_loai", v."san_pham_mo_ta",
       coalesce(v."san_pham_ten" || coalesce(': ' || v."san_pham_mo_ta", ''), 'chưa định nghĩa') AS "san_pham_ten",
       v."cap_quyet_dinh", coalesce(v."cap_quyet_dinh_ten", 'chưa xác định') AS "cap_quyet_dinh_ten",
       v."nguoi_theo_doi", v."nguoi_theo_doi_ten", v."nguoi_theo_doi_phong",
       v."dang_dinh_chinh", CASE WHEN v."dang_dinh_chinh" THEN 'DANG_TRA_SOAT' ELSE 'DO' END AS "nhom",
       v."so_chi_dao_cho_phan_hoi", v."cap_nhat_luc", v."cap_nhat_boi"
FROM "public"."v_nhiem_vu" v
WHERE v."muc_canh_bao" IN ('DO', 'DO_DAC_BIET')
ORDER BY v."so_ngay_qua" DESC, v."ma";
REVOKE ALL ON TABLE "public"."v_ngoai_le" FROM "anon";
GRANT SELECT ON TABLE "public"."v_ngoai_le" TO "authenticated";
-- Realtime: chi_dao đã trong publication (0016); direct_messages (0001); chi_dao_da_doc là trạng thái riêng từng người, không cần.
