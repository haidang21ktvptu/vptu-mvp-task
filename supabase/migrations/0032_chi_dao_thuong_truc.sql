-- 0032 — GĐ19 (CH-16): chỉ đạo Thường trực Tỉnh ủy, loại CHI_DAO_TT. Chỉ A0 gửi; người nhận tự tính (A0 không chọn) =
-- Chánh Văn phòng + PCVP phụ trách phòng Owner / phòng theo dõi (pcvp_phu_trach 0026) + lãnh đạo VP phụ trách đơn vị ngoài
-- (dm_don_vi.lanh_dao_phu_trach, như 0029); hạn phản hồi mặc định 2 ngày làm việc (bỏ T7/CN, kl_cau_hinh); CHO_PHAN_HOI tới
-- khi một người nhận phản hồi (chi_dao_phan_hoi) hoặc chuyển thành chỉ đạo con (DON_DOC/GIA_HAN/… có tra_loi_cho = luồng TT)
-- trên cùng nhiệm vụ; A0 đóng được luồng TT do mình mở (người nhận không đóng; Y_KIEN giữ như 0030). Tin hệ thống của luồng TT
-- chỉ tới người nhận và A0 mở luồng (không qua nguoi_lien_quan). Quá hạn phản hồi → canh_bao_quet gửi tin cho người nhận chưa
-- phản hồi (muc CHI_DAO_TT, nhắc lại theo canh_bao_nhac_lai_ngay), không leo thang thêm. Quyền ghi liệt kê tường minh theo vai.

-- 1. Bảng chi_dao: loại mới, người nhận, chỉ đạo con. Ràng buộc "gốc" cũ (loai = PHAN_HOI ⇔ có tra_loi_cho) nới thành:
--    PHAN_HOI luôn có tra_loi_cho; CHI_DAO_TT không có; loại điều hành có tra_loi_cho chỉ khi hàm gắn vào luồng TT.
ALTER TABLE "public"."chi_dao"
  DROP CONSTRAINT "chi_dao_loai_check",
  ADD CONSTRAINT "chi_dao_loai_check" CHECK ("loai" IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN', 'PHAN_HOI', 'CHI_DAO_TT')),
  ADD COLUMN "nguoi_nhan" uuid[] NOT NULL DEFAULT '{}',
  DROP CONSTRAINT "chi_dao_phan_hoi_co_goc",
  ADD CONSTRAINT "chi_dao_phan_hoi_co_goc" CHECK (("loai" <> 'PHAN_HOI' OR "tra_loi_cho" IS NOT NULL) AND ("loai" <> 'CHI_DAO_TT' OR "tra_loi_cho" IS NULL)),
  ADD CONSTRAINT "chi_dao_tt_co_nguoi_nhan" CHECK (("loai" = 'CHI_DAO_TT') = (cardinality("nguoi_nhan") > 0));
CREATE INDEX "chi_dao_tt_cho_idx" ON "public"."chi_dao" ("han_phan_hoi") WHERE "loai" = 'CHI_DAO_TT' AND "trang_thai" = 'CHO_PHAN_HOI';

INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('chi_dao_tt_han_phan_hoi_ngay', '2', 'Chỉ đạo Thường trực: hạn phản hồi mặc định, tính bằng ngày làm việc (bỏ Thứ Bảy, Chủ nhật)')
ON CONFLICT ("khoa") DO NOTHING;

-- 2. Ngày làm việc thứ N sau p_tu (bỏ T7/CN; chưa tính ngày lễ). p_so ≤ 0 → chính p_tu.
CREATE FUNCTION "public"."ngay_lam_viec_sau"("p_tu" date, "p_so" integer) RETURNS date
LANGUAGE "plpgsql" IMMUTABLE AS $$
DECLARE v date := "p_tu"; v_con integer := coalesce("p_so", 0);
BEGIN
  WHILE v_con > 0 LOOP
    v := v + 1;
    IF extract(isodow FROM v) < 6 THEN v_con := v_con - 1; END IF;
  END LOOP;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION "public"."ngay_lam_viec_sau"(date, integer) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."ngay_lam_viec_sau"(date, integer) TO "authenticated";

-- 3. Người nhận chỉ đạo Thường trực (nội bộ): Chánh VP + PCVP phụ trách phòng Owner/phòng theo dõi (kiêm nhiệm lĩnh vực ưu
--    tiên, như 0026) + lãnh đạo VP phụ trách đơn vị ngoài; bỏ tài khoản hệ thống, không trùng.
CREATE FUNCTION "public"."chi_dao_tt_nguoi_nhan"("p_nv" "public"."nhiem_vu") RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH phong AS (
    SELECT "public"."kl_phong_owner"(("p_nv")."owner_tai_khoan", ("p_nv")."owner_don_vi_ma") AS p
    UNION SELECT "department" FROM "public"."accounts" WHERE "id" = ("p_nv")."nguoi_theo_doi"),
  ds AS (
    SELECT a."id" FROM "public"."accounts" a WHERE a."is_chief" AND a."role_group" = 'A1'
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") FROM phong
    UNION SELECT dv."lanh_dao_phu_trach" FROM "public"."dm_don_vi" dv WHERE dv."ma" = ("p_nv")."owner_don_vi_ma" AND NOT dv."trong_van_phong")
  SELECT DISTINCT ds."id" FROM ds JOIN "public"."accounts" a ON a."id" = ds."id" WHERE NOT a."is_system";
$$;
REVOKE ALL ON FUNCTION "public"."chi_dao_tt_nguoi_nhan"("public"."nhiem_vu") FROM public, "anon", "authenticated";

-- Vết + tin hệ thống của luồng TT tới đúng danh sách người (trừ người thao tác) — không qua nguoi_lien_quan.
CREATE FUNCTION "public"."chi_dao_tt_ghi_vet"("p_nhiem_vu" uuid, "p_tin" text, "p_nguoi" uuid[]) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
BEGIN
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_nhiem_vu", "auth"."uid"(), 'chi_dao', "p_tin", 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT "auth"."uid"(), u, "p_tin", false, 'he_thong', "p_nhiem_vu"
  FROM unnest("p_nguoi") u WHERE u IS NOT NULL AND u <> "auth"."uid"();
END;
$$;
REVOKE ALL ON FUNCTION "public"."chi_dao_tt_ghi_vet"(uuid, text, uuid[]) FROM public, "anon", "authenticated";

CREATE OR REPLACE FUNCTION "public"."chi_dao_ten_loai"("p_loai" text) RETURNS text
LANGUAGE "sql" IMMUTABLE AS $$
  SELECT CASE "p_loai" WHEN 'DON_DOC' THEN 'Đôn đốc' WHEN 'GIA_HAN' THEN 'Gia hạn' WHEN 'GIAO_LAI' THEN 'Giao lại' WHEN 'YEU_CAU_MINH_CHUNG' THEN 'Yêu cầu minh chứng'
    WHEN 'KIEM_TRA_SO_LIEU' THEN 'Kiểm tra số liệu' WHEN 'Y_KIEN' THEN 'Ý kiến' WHEN 'PHAN_HOI' THEN 'Phản hồi' WHEN 'DONG' THEN 'Đóng chỉ đạo'
    WHEN 'CHI_DAO_TT' THEN 'Chỉ đạo Thường trực' ELSE "p_loai" END;
$$;

-- 4. chi_dao_gui (0030): A0 gửi Y_KIEN hoặc CHI_DAO_TT (người nhận tự tính, hạn mặc định 2 ngày làm việc, A0 sửa được nhưng
--    không lùi về quá khứ); A1/A2 không gửi CHI_DAO_TT; A1 là người nhận chuyển luồng TT thành chỉ đạo con qua p.tra_loi_cho
--    (luồng TT → DA_PHAN_HOI, A0 nhận tin). Thân GIA_HAN/GIAO_LAI giữ nguyên 0026/0030.
CREATE OR REPLACE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_tt "public"."chi_dao"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_han_ph date; v_id uuid; v_cu uuid; v_nhan uuid[] := ARRAY[]::uuid[];
        v_tin text;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = ("p" ->> 'nhiem_vu_id')::uuid;
  IF "public"."me_la_a0"() THEN
    IF v_loai NOT IN ('Y_KIEN', 'CHI_DAO_TT') THEN
      RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ ghi ý kiến hoặc gửi chỉ đạo Thường trực trên nhiệm vụ.' USING ERRCODE = '42501';
    END IF;
    IF v_nv."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN
      RAISE EXCEPTION 'Không tìm thấy nhiệm vụ.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_loai = 'CHI_DAO_TT' THEN
    RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới gửi chỉ đạo Thường trực.' USING ERRCODE = '42501';
  ELSIF v_nv."id" IS NULL OR NOT "public"."kl_duoc_chi_dao"(v_nv."id") THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc trưởng phòng trong phạm vi mới ra chỉ đạo trên nhiệm vụ này.' USING ERRCODE = '42501';
  END IF;
  IF v_loai NOT IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN', 'CHI_DAO_TT') THEN
    RAISE EXCEPTION 'Loại chỉ đạo không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Chỉ đạo phải có nội dung (lý do).' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  -- Chỉ đạo con: gắn vào luồng TT trên cùng nhiệm vụ, chỉ người nhận của luồng đó.
  IF nullif("p" ->> 'tra_loi_cho', '') IS NOT NULL THEN
    SELECT * INTO v_tt FROM "public"."chi_dao" WHERE "id" = ("p" ->> 'tra_loi_cho')::uuid;
    IF v_tt."id" IS NULL OR v_tt."loai" <> 'CHI_DAO_TT' OR v_tt."nhiem_vu_id" <> v_nv."id" OR v_loai IN ('Y_KIEN', 'CHI_DAO_TT') THEN
      RAISE EXCEPTION 'Chỉ đạo con phải là chỉ đạo điều hành gắn với một chỉ đạo Thường trực trên cùng nhiệm vụ.' USING ERRCODE = '22023';
    END IF;
    IF NOT (v_me."id" = ANY (v_tt."nguoi_nhan")) THEN
      RAISE EXCEPTION 'Chỉ người nhận chỉ đạo Thường trực mới chuyển thành chỉ đạo điều hành.' USING ERRCODE = '42501';
    END IF;
    IF v_tt."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo Thường trực đã đóng.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF v_loai = 'CHI_DAO_TT' THEN
    SELECT coalesce(array_agg(u), '{}') INTO v_nhan FROM "public"."chi_dao_tt_nguoi_nhan"(v_nv) u;
    IF cardinality(v_nhan) = 0 THEN
      RAISE EXCEPTION 'Chưa xác định được người nhận (Chánh Văn phòng, PCVP phụ trách) cho nhiệm vụ này.' USING ERRCODE = '22023';
    END IF;
    v_han_ph := coalesce(nullif("p" ->> 'han_phan_hoi', '')::date, "public"."ngay_lam_viec_sau"("public"."kl_hom_nay"(),
      greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'chi_dao_tt_han_phan_hoi_ngay'), 2), 0)));
    IF v_han_ph < "public"."kl_hom_nay"() THEN RAISE EXCEPTION 'Hạn phản hồi không được trước hôm nay.' USING ERRCODE = '22023'; END IF;
  ELSE
    v_han_ph := nullif("p" ->> 'han_phan_hoi', '')::date;
  END IF;
  IF v_loai IN ('GIA_HAN', 'GIAO_LAI') AND v_nv."tien_do_ma" = 'HOAN_THANH' THEN
    RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không gia hạn hay giao lại.' USING ERRCODE = '22023';
  END IF;
  IF v_loai = 'GIA_HAN' THEN
    IF v_me."role_group" <> 'A1' AND NOT v_me."quan_tri_kl" AND (v_nv."tao_boi" IS DISTINCT FROM v_me."id"
       OR (SELECT "loai" FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id") IN ('KL_BTV', 'TB_THUONG_TRUC')) THEN
      RAISE EXCEPTION 'Trưởng phòng chỉ gia hạn việc do chính mình giao, không phải việc từ kết luận/thông báo của cấp ủy.' USING ERRCODE = '42501';
    END IF;
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
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "han_phan_hoi", "han_moi", "chu_tri_moi", "trang_thai", "tra_loi_cho", "nguoi_nhan")
  VALUES (v_nv."id", v_me."id", v_loai, v_noi_dung, v_han_ph, v_han_moi, v_moi."id",
          CASE WHEN v_loai = 'Y_KIEN' THEN 'DA_PHAN_HOI' ELSE 'CHO_PHAN_HOI' END, v_tt."id", v_nhan)
  RETURNING "id" INTO v_id;
  PERFORM set_config('kl.chi_dao', '1', true);
  IF v_loai = 'GIA_HAN' THEN
    UPDATE "public"."nhiem_vu" SET "han_xu_ly" = v_han_moi, "so_lan_gia_han" = "so_lan_gia_han" + 1,
      "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END WHERE "id" = v_nv."id";
  ELSIF v_loai = 'GIAO_LAI' THEN
    UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_moi."id" WHERE "id" = v_nv."id";
  END IF;
  PERFORM set_config('kl.chi_dao', '', true);
  IF v_loai = 'CHI_DAO_TT' THEN
    PERFORM "public"."chi_dao_tt_ghi_vet"(v_nv."id", format('Chỉ đạo Thường trực · %s: %s (hạn phản hồi %s)', v_nv."ma", left(v_noi_dung, 120), to_char(v_han_ph, 'DD/MM/YYYY')), v_nhan);
  ELSE
    PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), v_noi_dung) ELSE v_noi_dung END, v_cu);
    IF v_tt."id" IS NOT NULL THEN
      v_tin := format('Chuyển thành %s: %s', "public"."chi_dao_ten_loai"(v_loai), v_noi_dung);
      UPDATE "public"."chi_dao" SET "phan_hoi" = v_tin, "phan_hoi_boi" = v_me."id", "phan_hoi_luc" = now(),
        "trang_thai" = CASE WHEN "trang_thai" = 'CHO_PHAN_HOI' THEN 'DA_PHAN_HOI' ELSE "trang_thai" END WHERE "id" = v_tt."id";
      PERFORM "public"."chi_dao_tt_ghi_vet"(v_nv."id", format('Phản hồi chỉ đạo Thường trực · %s: %s', v_nv."ma", left(v_tin, 120)),
        ARRAY[v_tt."nguoi_gui"] || v_tt."nguoi_nhan");
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- 5. chi_dao_phan_hoi (0030): gốc của một dòng = chính nó nếu không phải PHAN_HOI (chỉ đạo con vẫn là luồng riêng); luồng
--    CHI_DAO_TT chỉ người nhận phản hồi (A2/A3/A1 ngoài danh sách 42501); tin tới A0 mở luồng + người nhận khác.
CREATE OR REPLACE FUNCTION "public"."chi_dao_phan_hoi"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_goc "public"."chi_dao"; v_nv "public"."nhiem_vu"; v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_id uuid;
BEGIN
  IF "public"."me_la_a0"() THEN
    RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ ghi ý kiến, không phản hồi chỉ đạo.' USING ERRCODE = '42501';
  END IF;
  SELECT g.* INTO v_goc FROM "public"."chi_dao" c
  JOIN "public"."chi_dao" g ON g."id" = CASE WHEN c."loai" = 'PHAN_HOI' THEN c."tra_loi_cho" ELSE c."id" END
  WHERE c."id" = ("p" ->> 'chi_dao_id')::uuid;
  IF v_goc."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_goc."nhiem_vu_id") THEN
    RAISE EXCEPTION 'Không tìm thấy chỉ đạo trong phạm vi của đồng chí.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = v_goc."nhiem_vu_id";
  IF v_goc."loai" = 'CHI_DAO_TT' THEN
    IF NOT ("auth"."uid"() = ANY (v_goc."nguoi_nhan")) THEN
      RAISE EXCEPTION 'Chỉ người nhận chỉ đạo Thường trực (Chánh Văn phòng, PCVP phụ trách) mới phản hồi.' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT (coalesce("auth"."uid"() = v_nv."owner_tai_khoan", false) OR "auth"."uid"() = v_nv."nguoi_theo_doi"
          OR EXISTS (SELECT 1 FROM "public"."chi_dao" c WHERE c."nguoi_gui" = "auth"."uid"() AND (c."id" = v_goc."id" OR c."tra_loi_cho" = v_goc."id"))) THEN
    RAISE EXCEPTION 'Chỉ Owner, người theo dõi hoặc người đã tham gia luồng mới phản hồi chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v_goc."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo đã đóng, không phản hồi thêm.' USING ERRCODE = '22023'; END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Phản hồi phải có nội dung.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "tra_loi_cho", "trang_thai")
  VALUES (v_goc."nhiem_vu_id", "auth"."uid"(), 'PHAN_HOI', v_noi_dung, v_goc."id", 'DA_DONG') RETURNING "id" INTO v_id;
  UPDATE "public"."chi_dao" SET "phan_hoi" = v_noi_dung, "phan_hoi_boi" = "auth"."uid"(), "phan_hoi_luc" = now(),
    "trang_thai" = CASE WHEN "nguoi_gui" <> "auth"."uid"() THEN 'DA_PHAN_HOI' ELSE "trang_thai" END WHERE "id" = v_goc."id";
  IF v_goc."loai" = 'CHI_DAO_TT' THEN
    PERFORM "public"."chi_dao_tt_ghi_vet"(v_goc."nhiem_vu_id", format('Phản hồi chỉ đạo Thường trực · %s: %s', v_nv."ma", left(v_noi_dung, 120)),
      ARRAY[v_goc."nguoi_gui"] || v_goc."nguoi_nhan");
  ELSE
    PERFORM "public"."chi_dao_ghi_vet"(v_goc."nhiem_vu_id", 'PHAN_HOI', v_noi_dung, v_goc."nguoi_gui");
  END IF;
  RETURN v_id;
END;
$$;

-- 6. chi_dao_dong (0030): A0 đóng được đúng luồng CHI_DAO_TT do mình mở (Y_KIEN vẫn không); luồng TT không ai khác đóng
--    (kể cả người nhận, quan_tri_kl); chỉ đạo con (có tra_loi_cho) do người gửi đóng như chỉ đạo thường.
CREATE OR REPLACE FUNCTION "public"."chi_dao_dong"("p_id" uuid) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v "public"."chi_dao"; v_ma text;
BEGIN
  SELECT * INTO v FROM "public"."chi_dao" WHERE "id" = "p_id" AND "loai" <> 'PHAN_HOI';
  IF "public"."me_la_a0"() THEN
    IF v."id" IS NULL OR v."loai" <> 'CHI_DAO_TT' OR v."nguoi_gui" <> "auth"."uid"() THEN
      RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ đóng chỉ đạo Thường trực do chính mình gửi.' USING ERRCODE = '42501';
    END IF;
  ELSIF v."id" IS NOT NULL AND v."loai" = 'CHI_DAO_TT' THEN
    RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đóng chỉ đạo Thường trực.' USING ERRCODE = '42501';
  ELSIF v."id" IS NULL OR NOT (v."nguoi_gui" = "auth"."uid"() OR "public"."me_quan_tri_kl"()) THEN
    RAISE EXCEPTION 'Chỉ người ra chỉ đạo mới đóng được chỉ đạo này.' USING ERRCODE = '42501';
  END IF;
  IF v."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo này đã đóng.' USING ERRCODE = '22023'; END IF;
  UPDATE "public"."chi_dao" SET "trang_thai" = 'DA_DONG' WHERE "id" = "p_id";
  IF v."loai" = 'CHI_DAO_TT' THEN
    SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = v."nhiem_vu_id";
    PERFORM "public"."chi_dao_tt_ghi_vet"(v."nhiem_vu_id", format('Đóng chỉ đạo Thường trực · %s: %s', v_ma, left(v."noi_dung", 120)), v."nguoi_nhan");
  ELSE
    PERFORM "public"."chi_dao_ghi_vet"(v."nhiem_vu_id", 'DONG', v."noi_dung");
  END IF;
END;
$$;

-- 7. Quá hạn phản hồi (0029): canh_bao thêm mức CHI_DAO_TT + cột chi_dao_id; canh_bao_quet quét luồng TT CHO_PHAN_HOI có
--    han_phan_hoi < ngày tính → tin hệ thống cho người nhận chưa phản hồi, nhắc lại sau canh_bao_nhac_lai_ngay; không leo thang.
ALTER TABLE "public"."canh_bao"
  DROP CONSTRAINT "canh_bao_muc_check",
  ADD CONSTRAINT "canh_bao_muc_check" CHECK ("muc" IN ('VANG', 'DO', 'DO_DAC_BIET', 'CHI_DAO_TT')),
  ADD COLUMN "chi_dao_id" uuid REFERENCES "public"."chi_dao"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "canh_bao_tt_co_chi_dao" CHECK (("muc" = 'CHI_DAO_TT') = ("chi_dao_id" IS NOT NULL));

CREATE OR REPLACE FUNCTION "public"."canh_bao_quet"("p_ngay" date DEFAULT "public"."kl_hom_nay"()) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE
  v_n integer := greatest(coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'canh_bao_nhac_lai_ngay'), 3), 1);
  r record; v_nguoi uuid[]; v_tin text; v_id bigint; v_ids bigint[] := ARRAY[]::bigint[];
  v_quet integer := 0; v_bo_qua integer := 0; v_so_tin integer := 0;
  v_gui jsonb := jsonb_build_object('VANG', 0, 'DO', 0, 'DO_DAC_BIET', 0, 'CHI_DAO_TT', 0);
BEGIN
  IF "p_ngay" IS NULL THEN RAISE EXCEPTION 'Thiếu ngày tính' USING ERRCODE = '22023'; END IF;
  FOR r IN
    SELECT nv AS nv, nv."id", nv."ma", nv."han_xu_ly", (t.tt)."muc_canh_bao" AS muc, (t.tt)."so_ngay_qua" AS so_ngay_qua
    FROM "public"."nhiem_vu" nv
    CROSS JOIN LATERAL (SELECT "public"."trang_thai"(nv, "p_ngay") AS tt) t
    WHERE nv."dong_luc" IS NULL AND nv."tien_do_ma" <> 'HOAN_THANH'
      AND (t.tt)."muc_canh_bao" IN ('VANG', 'DO', 'DO_DAC_BIET')
    ORDER BY nv."ma"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."nhiem_vu_id" = r."id" AND c."muc" = r.muc AND c."ngay" > "p_ngay" - v_n) THEN
      v_bo_qua := v_bo_qua + 1; CONTINUE;
    END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM "public"."canh_bao_nguoi_nhan"(r.nv, r.muc) u;
    v_tin := format('%s · %s: %s', "public"."canh_bao_ten_muc"(r.muc), r."ma",
      CASE r.muc
        WHEN 'VANG' THEN format('còn %s ngày tới hạn %s, chưa có minh chứng', r."han_xu_ly" - "p_ngay", to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        WHEN 'DO' THEN format('quá hạn %s ngày (hạn %s)', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY'))
        ELSE format('quá hạn %s ngày (hạn %s), đã báo lãnh đạo Văn phòng', r.so_ngay_qua, to_char(r."han_xu_ly", 'DD/MM/YYYY')) END);
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "muc", "ngay", "nguoi_nhan") VALUES (r."id", r.muc, "p_ngay", v_nguoi)
    RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon")
    VALUES (r."id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT NULL, u, v_tin, false, 'he_thong', r."id" FROM unnest(v_nguoi) u;
    v_so_tin := v_so_tin + coalesce(array_length(v_nguoi, 1), 0);
    v_gui := jsonb_set(v_gui, ARRAY[r.muc], to_jsonb((v_gui ->> r.muc)::integer + 1));
  END LOOP;
  -- Chỉ đạo Thường trực quá hạn phản hồi (CH-16): người nhận chưa phản hồi, nhắc lại theo cùng chu kỳ N ngày.
  FOR r IN
    SELECT c."id", c."nhiem_vu_id", c."han_phan_hoi", c."noi_dung", c."nguoi_nhan", nv."ma"
    FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
    WHERE c."loai" = 'CHI_DAO_TT' AND c."trang_thai" = 'CHO_PHAN_HOI' AND c."han_phan_hoi" < "p_ngay"
    ORDER BY nv."ma", c."created_at"
  LOOP
    v_quet := v_quet + 1;
    IF EXISTS (SELECT 1 FROM "public"."canh_bao" c WHERE c."chi_dao_id" = r."id" AND c."muc" = 'CHI_DAO_TT' AND c."ngay" > "p_ngay" - v_n) THEN
      v_bo_qua := v_bo_qua + 1; CONTINUE;
    END IF;
    SELECT coalesce(array_agg(u), '{}') INTO v_nguoi FROM unnest(r."nguoi_nhan") u
    WHERE NOT EXISTS (SELECT 1 FROM "public"."chi_dao" p WHERE p."tra_loi_cho" = r."id" AND p."nguoi_gui" = u);
    IF cardinality(v_nguoi) = 0 THEN v_bo_qua := v_bo_qua + 1; CONTINUE; END IF;
    v_tin := format('Chỉ đạo Thường trực quá hạn phản hồi · %s: quá %s ngày (hạn %s) — %s', r."ma", "p_ngay" - r."han_phan_hoi",
      to_char(r."han_phan_hoi", 'DD/MM/YYYY'), left(btrim(r."noi_dung"), 80));
    INSERT INTO "public"."canh_bao" ("nhiem_vu_id", "chi_dao_id", "muc", "ngay", "nguoi_nhan") VALUES (r."nhiem_vu_id", r."id", 'CHI_DAO_TT', "p_ngay", v_nguoi)
    RETURNING "id" INTO v_id;
    v_ids := v_ids || v_id;
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "nguoi_sua_ghi_chu", "cot", "gia_tri_moi", "nguon")
    VALUES (r."nhiem_vu_id", NULL, 'Hệ thống — cảnh báo tự động', 'canh_bao', v_tin, 'app');
    INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
    SELECT NULL, u, v_tin, false, 'he_thong', r."nhiem_vu_id" FROM unnest(v_nguoi) u;
    v_so_tin := v_so_tin + cardinality(v_nguoi);
    v_gui := jsonb_set(v_gui, ARRAY['CHI_DAO_TT'], to_jsonb((v_gui ->> 'CHI_DAO_TT')::integer + 1));
  END LOOP;
  RETURN jsonb_build_object(
    'ngay', "p_ngay", 'quet', v_quet, 'gui', v_gui, 'bo_qua', v_bo_qua, 'tin', v_so_tin,
    'theo_nguoi_nhan', coalesce((
      SELECT jsonb_agg(jsonb_build_object('tai_khoan', s.username, 'so_tin', s.n) ORDER BY s.n DESC, s.username)
      FROM (SELECT a."username", count(*) AS n
            FROM "public"."canh_bao" c CROSS JOIN LATERAL unnest(c."nguoi_nhan") u JOIN "public"."accounts" a ON a."id" = u
            WHERE c."id" = ANY (v_ids) GROUP BY a."username") s), '[]'::jsonb));
END;
$$;

-- 8. v_chi_dao_tt (security_invoker → RLS chi_dao/nhiem_vu lọc phạm vi): Dashboard A1 (dòng mình là người nhận) và A0 (dòng
--    mình gửi); chờ phản hồi xếp trước, hạn gần trước.
CREATE VIEW "public"."v_chi_dao_tt" WITH ("security_invoker" = true) AS
SELECT c."id", c."nhiem_vu_id", nv."ma", nv."noi_dung" AS "nhiem_vu_noi_dung", nv."han_xu_ly", c."nguoi_gui", c."noi_dung", c."han_phan_hoi",
       c."trang_thai", c."nguoi_nhan", c."phan_hoi", c."phan_hoi_boi", c."phan_hoi_luc", c."created_at",
       (c."trang_thai" = 'CHO_PHAN_HOI' AND c."han_phan_hoi" < "public"."kl_hom_nay"()) AS "qua_han_phan_hoi",
       (SELECT array_agg(a."full_name" ORDER BY a."full_name") FROM "public"."accounts" a WHERE a."id" = ANY (c."nguoi_nhan")) AS "nguoi_nhan_ten"
FROM "public"."chi_dao" c JOIN "public"."nhiem_vu" nv ON nv."id" = c."nhiem_vu_id"
WHERE c."loai" = 'CHI_DAO_TT'
ORDER BY (c."trang_thai" = 'CHO_PHAN_HOI') DESC, c."han_phan_hoi", c."created_at" DESC;
REVOKE ALL ON TABLE "public"."v_chi_dao_tt" FROM "anon";
GRANT SELECT ON TABLE "public"."v_chi_dao_tt" TO "authenticated";
