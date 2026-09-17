-- 0036 — GĐ22 (2/3): chỉ đạo có độ khẩn (chi_dao_gui nhận p.do_khan, A0 mặc định Khẩn; hạn phản hồi mặc định theo cấp: Thường 2 ngày làm
-- việc, Khẩn 1, Thượng khẩn/Hỏa tốc trong ngày; tin thêm cấp trên trực tiếp của người nhận với Thượng khẩn/Hỏa tốc, thêm Chánh VP với Hỏa
-- tốc — áp cho cả chỉ đạo điều hành lẫn chỉ đạo Thường trực); Hỏa tốc bắt buộc người nhận bấm "Đã nhận" (xac_nhan_da_nhan_chi_dao, cột
-- da_nhan 0035); trang_thai: ngưỡng Vàng theo độ khẩn của việc; canh_bao_nguoi_nhan: Thượng khẩn/Hỏa tốc thêm cấp trên trực tiếp, Hỏa tốc
-- thêm Chánh VP ở mọi mức. Quét/nhắc, view, đếm ở 0037.

-- 1. chi_dao_ghi_vet (0026) nhận thêm MẢNG người nhận bổ sung; bản một người giữ làm wrapper (chi_dao_phan_hoi/chi_dao_dong vẫn gọi).
CREATE FUNCTION "public"."chi_dao_ghi_vet"("p_nhiem_vu" uuid, "p_loai" text, "p_noi_dung" text, "p_them" uuid[]) RETURNS void
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_ma text; v_tin text;
BEGIN
  SELECT "ma" INTO v_ma FROM "public"."nhiem_vu" WHERE "id" = "p_nhiem_vu";
  v_tin := format('%s · %s: %s', "public"."chi_dao_ten_loai"("p_loai"), v_ma, left(btrim("p_noi_dung"), 120));
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES ("p_nhiem_vu", "auth"."uid"(), 'chi_dao', v_tin, 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT "auth"."uid"(), t.u, v_tin, false, 'he_thong', "p_nhiem_vu"
  FROM (SELECT "public"."nguoi_lien_quan"("p_nhiem_vu") AS u UNION SELECT unnest(coalesce("p_them", '{}'))) t JOIN "public"."accounts" a ON a."id" = t.u
  WHERE t.u <> "auth"."uid"() AND NOT a."is_system" AND a."role_group" <> 'A0';   -- lọc A0 ở đây làm A0 mở luồng Y_KIEN mất tin phản hồi → sửa ở 0038
END;
$$;
CREATE OR REPLACE FUNCTION "public"."chi_dao_ghi_vet"("p_nhiem_vu" uuid, "p_loai" text, "p_noi_dung" text, "p_them" uuid DEFAULT NULL) RETURNS void
LANGUAGE "sql" SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT "public"."chi_dao_ghi_vet"("p_nhiem_vu", "p_loai", "p_noi_dung", CASE WHEN "p_them" IS NULL THEN '{}'::uuid[] ELSE ARRAY["p_them"] END);
$$;
-- Cấp trên trực tiếp của người nhận việc + Chánh VP tuỳ độ khẩn (người nhận bổ sung của tin).
CREATE FUNCTION "public"."nguoi_nhan_them_do_khan"("p_nv" "public"."nhiem_vu", "p_do_khan" text) RETURNS uuid[]
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  SELECT coalesce(array_agg(u), '{}') FROM (
    SELECT "public"."lanh_dao_truc_tiep"(("p_nv")."owner_tai_khoan") AS u WHERE "p_do_khan" IN ('THUONG_KHAN', 'HOA_TOC') AND ("p_nv")."owner_tai_khoan" IS NOT NULL
    UNION SELECT "public"."lanh_dao_truc_tiep"(("p_nv")."nguoi_theo_doi") WHERE "p_do_khan" IN ('THUONG_KHAN', 'HOA_TOC')
    UNION SELECT a."id" FROM "public"."accounts" a WHERE "p_do_khan" = 'HOA_TOC' AND a."is_chief" AND a."role_group" = 'A1' AND NOT a."is_system") t WHERE u IS NOT NULL;
$$;

-- 2. chi_dao_gui (0032) + do_khan, hạn phản hồi theo cấp, người nhận thêm; thân GIA_HAN/GIAO_LAI/chỉ đạo con giữ nguyên.
CREATE OR REPLACE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_tt "public"."chi_dao"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_han_ph date; v_id uuid; v_cu uuid; v_nhan uuid[] := ARRAY[]::uuid[];
        v_tin text; v_do_khan text; v_them uuid[]; v_nhan_dk text;
BEGIN
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = ("p" ->> 'nhiem_vu_id')::uuid;
  IF "public"."me_la_a0"() THEN
    IF v_loai NOT IN ('Y_KIEN', 'CHI_DAO_TT') THEN RAISE EXCEPTION 'Thường trực Tỉnh ủy chỉ ghi ý kiến hoặc gửi chỉ đạo Thường trực trên nhiệm vụ.' USING ERRCODE = '42501'; END IF;
    IF v_nv."id" IS NULL OR NOT "public"."kl_thay_nhiem_vu"(v_nv."id") THEN RAISE EXCEPTION 'Không tìm thấy nhiệm vụ.' USING ERRCODE = '42501'; END IF;
  ELSIF v_loai = 'CHI_DAO_TT' THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới gửi chỉ đạo Thường trực.' USING ERRCODE = '42501';
  ELSIF v_nv."id" IS NULL OR NOT "public"."kl_duoc_chi_dao"(v_nv."id") THEN RAISE EXCEPTION 'Chỉ lãnh đạo Văn phòng hoặc trưởng phòng trong phạm vi mới ra chỉ đạo trên nhiệm vụ này.' USING ERRCODE = '42501'; END IF;
  IF v_loai NOT IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN', 'CHI_DAO_TT') THEN RAISE EXCEPTION 'Loại chỉ đạo không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Chỉ đạo phải có nội dung (lý do).' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_me."role_group" = 'A0' THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  v_nhan_dk := CASE WHEN v_do_khan <> 'THUONG' THEN '[' || "public"."ten_do_khan"(v_do_khan) || '] ' ELSE '' END;
  IF nullif("p" ->> 'tra_loi_cho', '') IS NOT NULL THEN
    SELECT * INTO v_tt FROM "public"."chi_dao" WHERE "id" = ("p" ->> 'tra_loi_cho')::uuid;
    IF v_tt."id" IS NULL OR v_tt."loai" <> 'CHI_DAO_TT' OR v_tt."nhiem_vu_id" <> v_nv."id" OR v_loai IN ('Y_KIEN', 'CHI_DAO_TT') THEN RAISE EXCEPTION 'Chỉ đạo con phải là chỉ đạo điều hành gắn với một chỉ đạo Thường trực trên cùng nhiệm vụ.' USING ERRCODE = '22023'; END IF;
    IF NOT (v_me."id" = ANY (v_tt."nguoi_nhan")) THEN RAISE EXCEPTION 'Chỉ người nhận chỉ đạo Thường trực mới chuyển thành chỉ đạo điều hành.' USING ERRCODE = '42501'; END IF;
    IF v_tt."trang_thai" = 'DA_DONG' THEN RAISE EXCEPTION 'Chỉ đạo Thường trực đã đóng.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Hạn phản hồi: nhập tay, không thì theo cấp (Thường chỉ tự điền với chỉ đạo Thường trực; các cấp cao hơn tự điền cho mọi loại chờ phản hồi).
  v_han_ph := nullif("p" ->> 'han_phan_hoi', '')::date;
  IF v_han_ph IS NULL AND v_loai <> 'Y_KIEN' AND (v_loai = 'CHI_DAO_TT' OR v_do_khan <> 'THUONG') THEN
    v_han_ph := "public"."ngay_lam_viec_sau"("public"."kl_hom_nay"(), ("public"."kl_nguong_do_khan"(v_do_khan) ->> 'han_phan_hoi')::integer);
  END IF;
  IF v_loai = 'CHI_DAO_TT' THEN
    SELECT coalesce(array_agg(u), '{}') INTO v_nhan FROM "public"."chi_dao_tt_nguoi_nhan"(v_nv) u;
    IF cardinality(v_nhan) = 0 THEN RAISE EXCEPTION 'Chưa xác định được người nhận (Chánh Văn phòng, PCVP phụ trách) cho nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
    IF v_han_ph < "public"."kl_hom_nay"() THEN RAISE EXCEPTION 'Hạn phản hồi không được trước hôm nay.' USING ERRCODE = '22023'; END IF;
  END IF;
  IF v_loai IN ('GIA_HAN', 'GIAO_LAI') AND v_nv."tien_do_ma" = 'HOAN_THANH' THEN RAISE EXCEPTION 'Nhiệm vụ đã hoàn thành, không gia hạn hay giao lại.' USING ERRCODE = '22023'; END IF;
  IF v_loai = 'GIA_HAN' THEN
    IF v_me."role_group" <> 'A1' AND NOT v_me."quan_tri_kl" AND (v_nv."tao_boi" IS DISTINCT FROM v_me."id"
       OR (SELECT "loai" FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id") IN ('KL_BTV', 'TB_THUONG_TRUC')) THEN
      RAISE EXCEPTION 'Trưởng phòng chỉ gia hạn việc do chính mình giao, không phải việc từ kết luận/thông báo của cấp ủy.' USING ERRCODE = '42501';
    END IF;
    v_han_moi := nullif("p" ->> 'han_moi', '')::date;
    IF v_nv."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Việc chưa có hạn thì điền hạn ở Cập nhật, không gia hạn.' USING ERRCODE = '22023'; END IF;
    IF v_han_moi IS NULL OR v_han_moi <= v_nv."han_xu_ly" THEN RAISE EXCEPTION 'Gia hạn phải có hạn mới sau hạn hiện tại (%).', to_char(v_nv."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023'; END IF;
  ELSIF v_loai = 'GIAO_LAI' THEN
    SELECT * INTO v_moi FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'nguoi_theo_doi_moi', '')::uuid;
    IF v_moi."id" IS NULL OR v_moi."is_system" OR v_moi."id" = v_nv."nguoi_theo_doi" THEN RAISE EXCEPTION 'Giao lại phải chọn một người theo dõi mới khác người hiện tại.' USING ERRCODE = '22023'; END IF;
    IF NOT (v_me."quan_tri_kl" OR v_me."is_chief"
            OR (v_me."role_group" = 'A2' AND v_moi."department" = v_me."department")
            OR (v_me."role_group" = 'A1' AND "public"."phu_trach"(v_me."id", v_moi."department", "public"."kl_hom_nay"()))) THEN
      RAISE EXCEPTION 'Người theo dõi mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    v_cu := v_nv."nguoi_theo_doi";
  END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "han_phan_hoi", "han_moi", "chu_tri_moi", "trang_thai", "tra_loi_cho", "nguoi_nhan", "do_khan")
  VALUES (v_nv."id", v_me."id", v_loai, v_noi_dung, v_han_ph, v_han_moi, v_moi."id",
          CASE WHEN v_loai = 'Y_KIEN' THEN 'DA_PHAN_HOI' ELSE 'CHO_PHAN_HOI' END, v_tt."id", v_nhan, v_do_khan)
  RETURNING "id" INTO v_id;
  PERFORM set_config('kl.chi_dao', '1', true);
  IF v_loai = 'GIA_HAN' THEN
    UPDATE "public"."nhiem_vu" SET "han_xu_ly" = v_han_moi, "so_lan_gia_han" = "so_lan_gia_han" + 1,
      "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END WHERE "id" = v_nv."id";
  ELSIF v_loai = 'GIAO_LAI' THEN
    UPDATE "public"."nhiem_vu" SET "nguoi_theo_doi" = v_moi."id" WHERE "id" = v_nv."id";
  END IF;
  PERFORM set_config('kl.chi_dao', '', true);
  -- Người nhận thêm theo độ khẩn: cấp trên trực tiếp của Owner/người theo dõi (Thượng khẩn, Hỏa tốc) và của từng người nhận luồng TT; Chánh VP (Hỏa tốc).
  v_them := "public"."nguoi_nhan_them_do_khan"(v_nv, v_do_khan);
  IF v_loai = 'CHI_DAO_TT' AND v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN
    v_them := v_them || (SELECT coalesce(array_agg(x), '{}') FROM (SELECT "public"."lanh_dao_truc_tiep"(u) AS x FROM unnest(v_nhan) u) s WHERE x IS NOT NULL);
  END IF;
  IF v_loai = 'CHI_DAO_TT' THEN
    PERFORM "public"."chi_dao_tt_ghi_vet"(v_nv."id", format('Chỉ đạo Thường trực · %s: %s%s (hạn phản hồi %s)', v_nv."ma", v_nhan_dk, left(v_noi_dung, 120), to_char(v_han_ph, 'DD/MM/YYYY')), v_nhan || v_them);
  ELSE
    PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, v_nhan_dk || CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), v_noi_dung) ELSE v_noi_dung END,
      CASE WHEN v_cu IS NULL THEN v_them ELSE v_them || v_cu END);
    IF v_tt."id" IS NOT NULL THEN
      v_tin := format('Chuyển thành %s: %s', "public"."chi_dao_ten_loai"(v_loai), v_noi_dung);
      UPDATE "public"."chi_dao" SET "phan_hoi" = v_tin, "phan_hoi_boi" = v_me."id", "phan_hoi_luc" = now(),
        "trang_thai" = CASE WHEN "trang_thai" = 'CHO_PHAN_HOI' THEN 'DA_PHAN_HOI' ELSE "trang_thai" END WHERE "id" = v_tt."id";
      PERFORM "public"."chi_dao_tt_ghi_vet"(v_nv."id", format('Phản hồi chỉ đạo Thường trực · %s: %s', v_nv."ma", left(v_tin, 120)), ARRAY[v_tt."nguoi_gui"] || v_tt."nguoi_nhan");
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- 3. xac_nhan_da_nhan_chi_dao(p_id) → true nếu ghi mới: người nhận của chỉ đạo (luồng TT: nguoi_nhan; luồng thường: Owner tài khoản / người theo
--    dõi của việc) bấm "Đã nhận" — ghi lich_su và tin cho người gửi; bấm lại trả false. A0 không phải người nhận của bất kỳ chỉ đạo nào.
CREATE FUNCTION "public"."xac_nhan_da_nhan_chi_dao"("p_id" uuid) RETURNS boolean
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE c "public"."chi_dao"; v "public"."nhiem_vu"; v_me "public"."accounts";
BEGIN
  SELECT * INTO c FROM "public"."chi_dao" WHERE "id" = "p_id" AND "loai" <> 'PHAN_HOI';
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  IF c."id" IS NOT NULL THEN SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = c."nhiem_vu_id"; END IF;
  IF c."id" IS NULL OR v_me."id" IS NULL OR v_me."role_group" = 'A0'
     OR NOT (CASE WHEN c."loai" = 'CHI_DAO_TT' THEN v_me."id" = ANY (c."nguoi_nhan") ELSE v_me."id" = v."nguoi_theo_doi" OR v_me."id" = v."owner_tai_khoan" END) THEN
    RAISE EXCEPTION 'Chỉ người nhận chỉ đạo mới xác nhận đã nhận.' USING ERRCODE = '42501';
  END IF;
  IF v_me."id" = ANY (c."da_nhan") THEN RETURN false; END IF;
  UPDATE "public"."chi_dao" SET "da_nhan" = "da_nhan" || v_me."id" WHERE "id" = c."id";
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v."id", v_me."id", 'chi_dao', format('Đã nhận %s · %s: %s', lower("public"."chi_dao_ten_loai"(c."loai")), v."ma", left(c."noi_dung", 80)), 'app');
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT v_me."id", c."nguoi_gui", format('Đã nhận chỉ đạo · %s: %s đã nhận %s', v."ma", v_me."full_name", lower("public"."chi_dao_ten_loai"(c."loai"))), false, 'he_thong', v."id"
  WHERE c."nguoi_gui" IS NOT NULL AND c."nguoi_gui" <> v_me."id";
  RETURN true;
END;
$$;

-- 4. trang_thai (0024): ngưỡng VÀNG theo độ khẩn của việc (kl_nguong_do_khan); các nhánh khác giữ nguyên → bộ số mốc 14/9 (mọi việc Thường) không đổi.
CREATE OR REPLACE FUNCTION "public"."trang_thai"("nv" "public"."nhiem_vu", "ngay" date DEFAULT "public"."kl_hom_nay"())
RETURNS "public"."trang_thai_kq"
LANGUAGE "sql" STABLE SET "search_path" = "public" AS $$
  WITH ch AS (
    SELECT coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_sap_den_han_ngay'), 7) AS nguong,
           ("public"."kl_nguong_do_khan"("nv"."do_khan") ->> 'vang')::integer AS vang,
           coalesce((SELECT "gia_tri"::integer FROM "public"."kl_cau_hinh" WHERE "khoa" = 'nguong_do_dac_biet_ngay'), 3) AS ddb
  ), tt AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" = 'HOAN_THANH' THEN 'HOAN_THANH'
      WHEN "nv"."loai_thoi_han_ma" = 'THUONG_XUYEN' THEN 'THUONG_XUYEN'
      WHEN "nv"."han_xu_ly" IS NULL AND "nv"."loai_thoi_han_ma" = 'CHO_QUYET_DINH' THEN 'CHO_DIEU_KIEN'
      WHEN "nv"."han_xu_ly" IS NULL THEN 'CAN_DIEN_HAN'
      WHEN "nv"."han_xu_ly" < "ngay" THEN 'QUA_HAN'
      WHEN "nv"."han_xu_ly" <= "ngay" + greatest((SELECT nguong FROM ch), (SELECT vang FROM ch)) THEN 'SAP_DEN_HAN'
      ELSE 'DANG_THUC_HIEN' END AS trang_thai,
      EXISTS (SELECT 1 FROM "public"."dinh_chinh" d WHERE d."nhiem_vu_id" = "nv"."id" AND d."trang_thai" = 'CHO_DUYET') AS dang_dinh_chinh
  ), kq AS (
    SELECT CASE
      WHEN "nv"."tien_do_ma" <> 'HOAN_THANH' THEN NULL
      WHEN "nv"."ngay_hoan_thanh" IS NULL OR "nv"."han_xu_ly" IS NULL THEN 'KHONG_DANH_GIA'
      WHEN "nv"."ngay_hoan_thanh" <= "nv"."han_xu_ly" THEN 'DUNG_HAN'
      ELSE 'TRE' END AS ket_qua
  )
  SELECT ROW(
    tt.trang_thai,
    CASE WHEN tt.trang_thai = 'QUA_HAN' THEN ("ngay" - "nv"."han_xu_ly")::integer END,
    kq.ket_qua,
    CASE WHEN kq.ket_qua = 'TRE' THEN ("nv"."ngay_hoan_thanh" - "nv"."han_xu_ly")::integer END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND "nv"."dong_luc" IS NOT NULL
         THEN (("nv"."dong_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - "nv"."ngay_hoan_thanh")::integer END,
    tt.dang_dinh_chinh,
    CASE WHEN tt.trang_thai = 'QUA_HAN' AND tt.dang_dinh_chinh THEN 'DANG_DINH_CHINH' ELSE tt.trang_thai END,
    CASE tt.trang_thai
      WHEN 'QUA_HAN' THEN CASE WHEN ("ngay" - "nv"."han_xu_ly") >= (SELECT ddb FROM ch) THEN 'DO_DAC_BIET' ELSE 'DO' END
      WHEN 'SAP_DEN_HAN' THEN CASE WHEN ("nv"."han_xu_ly" - "ngay") <= (SELECT vang FROM ch)
                                    AND nullif(btrim(coalesce("nv"."minh_chung", '')), '') IS NULL THEN 'VANG' ELSE 'XANH' END
      WHEN 'DANG_THUC_HIEN' THEN 'XANH'
      ELSE 'KHONG_AP_DUNG' END,
    CASE WHEN "nv"."tien_do_ma" = 'HOAN_THANH' AND "nv"."ngay_hoan_thanh" IS NOT NULL AND NOT "nv"."ngay_nhan_uoc_tinh"
         THEN ("nv"."ngay_hoan_thanh" - "nv"."ngay_nhan_van_ban")::integer END
  )::"public"."trang_thai_kq"
  FROM tt, kq;
$$;

-- 5. canh_bao_nguoi_nhan (0029) + độ khẩn: Thượng khẩn/Hỏa tốc thêm cấp trên trực tiếp của Owner và người theo dõi ở mọi mức; Hỏa tốc thêm Chánh VP ở mọi mức.
CREATE OR REPLACE FUNCTION "public"."canh_bao_nguoi_nhan"("p_nv" "public"."nhiem_vu", "p_muc" text) RETURNS SETOF uuid
LANGUAGE "sql" STABLE SECURITY DEFINER SET "search_path" = "public" AS $$
  WITH phong AS (
    SELECT "public"."kl_phong_owner"(("p_nv")."owner_tai_khoan", ("p_nv")."owner_don_vi_ma") AS p
    UNION SELECT "department" FROM "public"."accounts" WHERE "id" = ("p_nv")."nguoi_theo_doi"),
  ds AS (
    SELECT ("p_nv")."owner_tai_khoan" AS id
    UNION SELECT ("p_nv")."nguoi_theo_doi"
    UNION SELECT a."id" FROM "public"."accounts" a, phong WHERE "p_muc" IN ('DO', 'DO_DAC_BIET') AND a."role_group" = 'A2' AND a."department" = phong.p
    UNION SELECT dv."lanh_dao_phu_trach" FROM "public"."dm_don_vi" dv WHERE "p_muc" IN ('DO', 'DO_DAC_BIET') AND dv."ma" = ("p_nv")."owner_don_vi_ma" AND NOT dv."trong_van_phong"
    UNION SELECT "public"."pcvp_phu_trach"(phong.p, ("p_nv")."nganh_ma", ("p_nv")."linh_vuc_ma") FROM phong WHERE "p_muc" = 'DO_DAC_BIET'
    UNION SELECT a."id" FROM "public"."accounts" a WHERE "p_muc" = 'DO_DAC_BIET' AND a."is_chief" AND a."role_group" = 'A1'
    UNION SELECT unnest("public"."nguoi_nhan_them_do_khan"("p_nv", ("p_nv")."do_khan")))
  SELECT DISTINCT ds."id" FROM ds JOIN "public"."accounts" a ON a."id" = ds."id" WHERE NOT a."is_system" AND a."role_group" <> 'A0';
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['chi_dao_ghi_vet(uuid,text,text,uuid[])', 'nguoi_nhan_them_do_khan(public.nhiem_vu,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION "public"."xac_nhan_da_nhan_chi_dao"(uuid) FROM public, anon;
  GRANT EXECUTE ON FUNCTION "public"."xac_nhan_da_nhan_chi_dao"(uuid) TO authenticated;
END $$;
