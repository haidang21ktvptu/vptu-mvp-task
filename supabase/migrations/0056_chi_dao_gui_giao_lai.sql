-- 0056: chi_dao_gui (bản 0045, nguyên văn) — ba chỗ đổi (PR-2b):
-- 1. Mục 3.1: quyền quan_tri_kl đọc me_quan_tri_kl() (xét quan_tri_kl_het_han, 0041) thay cờ thô ở GIA_HAN và GIAO_LAI. a2_uy_quyen (0041) giữ
--    nguyên: phép kiểm "đã có quyền thường trực" ở đó là trạng thái cấp quyền, không phải quyền thao tác.
-- 2. Mục 3.2: GIAO_LAI dùng kl_duoc_giao_cho_phong (MỘT nguồn chặn với giao_viec, 0052) cho chủ trì mới; PCVP thêm kiểm người theo dõi mới như
--    giao_viec. Chỉ hành vi của PCVP đổi (kiêm nhiệm ngành–lĩnh vực); Chánh VP, A2, quan_tri_kl còn hạn giữ như 0045 (test kl-pq-giao-lai-pham-vi).
-- 3. Thiết kế A3: GIA_HAN nhận khoá tuỳ chọn han_nop_minh_chung_moi — chỉ người giao (coalesce(giao_thay_mat_cho, tao_boi)); lý do việc gấp
--    (khi hạn nộp mới sát hạn hoàn thành mới) = nội dung chỉ đạo. Trigger bd_nhiem_vu_han_nop_mc (0054) kiểm lại khung ngày.

CREATE OR REPLACE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_tt "public"."chi_dao"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_han_ph date; v_id uuid; v_cu uuid[] := ARRAY[]::uuid[]; v_nhan uuid[] := ARRAY[]::uuid[];
        v_tin text; v_do_khan text; v_them uuid[]; v_nhan_dk text; v_dv "public"."dm_don_vi"; v_theo_doi_moi "public"."accounts"; v_ten_cu text;
        v_qtkl boolean := "public"."me_quan_tri_kl"(); v_han_nop_moi date := nullif("p" ->> 'han_nop_minh_chung_moi', '')::date; v_k jsonb;
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
    IF v_me."role_group" <> 'A1' AND NOT v_qtkl AND (v_nv."tao_boi" IS DISTINCT FROM v_me."id"
       OR (SELECT "loai" FROM "public"."van_ban_giao_viec" WHERE "id" = v_nv."van_ban_id") IN ('KL_BTV', 'TB_THUONG_TRUC')) THEN
      RAISE EXCEPTION 'Trưởng phòng chỉ gia hạn việc do chính mình giao, không phải việc từ kết luận/thông báo của cấp ủy.' USING ERRCODE = '42501';
    END IF;
    v_han_moi := nullif("p" ->> 'han_moi', '')::date;
    IF v_nv."han_xu_ly" IS NULL THEN RAISE EXCEPTION 'Việc chưa có hạn thì điền hạn ở Cập nhật, không gia hạn.' USING ERRCODE = '22023'; END IF;
    IF v_han_moi IS NULL OR v_han_moi <= v_nv."han_xu_ly" THEN RAISE EXCEPTION 'Gia hạn phải có hạn mới sau hạn hiện tại (%).', to_char(v_nv."han_xu_ly", 'DD/MM/YYYY') USING ERRCODE = '22023'; END IF;
    IF v_han_nop_moi IS NOT NULL THEN   -- 0056: chỉ NGƯỜI GIAO đặt kèm hạn nộp mới; người khác gia hạn thì hạn nộp giữ nguyên
      IF v_me."id" IS DISTINCT FROM coalesce(v_nv."giao_thay_mat_cho", v_nv."tao_boi") THEN
        RAISE EXCEPTION 'Chỉ người giao việc mới đặt hạn nộp minh chứng mới khi gia hạn.' USING ERRCODE = '42501';
      END IF;
      v_k := "public"."kl_khung_han_nop"(v_han_moi);
    END IF;
  ELSIF v_loai = 'GIAO_LAI' THEN
    -- 0045: giao lại = đổi CHỦ TRÌ. Chặn việc đã hoàn thành/đã đóng (kiểm ở trên và dong_luc); minh chứng chủ trì cũ đã nộp giữ nguyên.
    IF v_nv."dong_luc" IS NOT NULL THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không giao lại.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_moi FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'chu_tri_moi', '')::uuid;
    IF v_moi."id" IS NULL OR v_moi."is_system" OR v_moi."role_group" = 'A0' THEN RAISE EXCEPTION 'Giao lại phải chọn chủ trì mới là cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
    IF v_moi."id" = v_nv."owner_tai_khoan" THEN RAISE EXCEPTION 'Chủ trì mới phải khác chủ trì hiện tại.' USING ERRCODE = '22023'; END IF;
    -- 0056: cùng nguồn chặn với giao_viec (kl_duoc_giao_cho_phong, 0052): Chánh VP mọi phòng, A2 phòng mình (như 0045); PCVP theo
    -- kl_pham_vi_pcvp_cua với ngành–lĩnh vực của việc (kiêm nhiệm ưu tiên — trước là mọi phòng phu_trach). quan_tri_kl xét hạn (me_quan_tri_kl).
    IF NOT (v_qtkl OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_moi."department", v_nv."nganh_ma", v_nv."linh_vuc_ma")) THEN
      RAISE EXCEPTION 'Chủ trì mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    -- Đơn vị Owner theo phòng của chủ trì mới (trigger 0023 kiểm khớp phòng); lãnh đạo Văn phòng (không phòng) → Văn phòng Tỉnh ủy.
    SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_moi."department" LIMIT 1;
    IF v_dv."ma" IS NULL AND v_moi."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
    IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (dm_don_vi) cho phòng % của chủ trì mới.', coalesce(v_moi."department", '(trống)') USING ERRCODE = '22023'; END IF;
    IF nullif("p" ->> 'nguoi_theo_doi_moi', '') IS NOT NULL THEN
      SELECT * INTO v_theo_doi_moi FROM "public"."accounts" WHERE "id" = ("p" ->> 'nguoi_theo_doi_moi')::uuid;
      IF v_theo_doi_moi."id" IS NULL OR v_theo_doi_moi."is_system" OR v_theo_doi_moi."role_group" = 'A0' THEN RAISE EXCEPTION 'Người theo dõi mới không hợp lệ.' USING ERRCODE = '22023'; END IF;
      -- 0056: PCVP (như giao_viec): người theo dõi mới là chính mình hoặc thuộc phòng trong phạm vi; A2 / Chánh VP / quan_tri_kl giữ như 0045.
      IF v_me."role_group" = 'A1' AND NOT v_me."is_chief" AND NOT v_qtkl AND v_theo_doi_moi."id" <> v_me."id"
         AND NOT "public"."kl_duoc_giao_cho_phong"(v_me."id", v_theo_doi_moi."department", v_nv."nganh_ma", v_nv."linh_vuc_ma") THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng đồng chí phụ trách.' USING ERRCODE = '42501';
      END IF;
    END IF;
    v_cu := ARRAY(SELECT DISTINCT u FROM unnest(ARRAY[v_nv."owner_tai_khoan", v_nv."nguoi_theo_doi"]) u WHERE u IS NOT NULL);
    SELECT "full_name" INTO v_ten_cu FROM "public"."accounts" WHERE "id" = v_nv."owner_tai_khoan";
  END IF;
  INSERT INTO "public"."chi_dao" ("nhiem_vu_id", "nguoi_gui", "loai", "noi_dung", "han_phan_hoi", "han_moi", "chu_tri_moi", "trang_thai", "tra_loi_cho", "nguoi_nhan", "do_khan")
  VALUES (v_nv."id", v_me."id", v_loai, v_noi_dung, v_han_ph, v_han_moi, v_moi."id",
          CASE WHEN v_loai = 'Y_KIEN' THEN 'DA_PHAN_HOI' ELSE 'CHO_PHAN_HOI' END, v_tt."id", v_nhan, v_do_khan)
  RETURNING "id" INTO v_id;
  PERFORM set_config('kl.chi_dao', '1', true);
  IF v_loai = 'GIA_HAN' THEN
    UPDATE "public"."nhiem_vu" SET "han_xu_ly" = v_han_moi, "so_lan_gia_han" = "so_lan_gia_han" + 1,
      "han_nop_minh_chung" = coalesce(v_han_nop_moi, "han_nop_minh_chung"),
      "ly_do_han_nop_sat" = CASE WHEN v_han_nop_moi IS NULL THEN "ly_do_han_nop_sat"
                                 WHEN v_k ->> 'khong_ly_do_den' IS NULL OR v_han_nop_moi > (v_k ->> 'khong_ly_do_den')::date THEN v_noi_dung END,
      "loai_thoi_han_ma" = CASE WHEN "loai_thoi_han_ma" = 'KY_BAN_HANH' THEN 'CO_HAN_CU_THE' ELSE "loai_thoi_han_ma" END WHERE "id" = v_nv."id";
  ELSIF v_loai = 'GIAO_LAI' THEN
    UPDATE "public"."nhiem_vu" SET "owner_tai_khoan" = v_moi."id", "owner_don_vi_ma" = v_dv."ma",
      "cap_nhan_san_pham" = "public"."kl_cap_nhan_mac_dinh"(v_moi, v_dv),
      "nguoi_theo_doi" = coalesce(v_theo_doi_moi."id", "nguoi_theo_doi") WHERE "id" = v_nv."id";
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
    PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, v_nhan_dk || CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s%s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), coalesce(', hạn nộp minh chứng ' || to_char(v_han_nop_moi, 'DD/MM/YYYY'), ''), v_noi_dung) ELSE v_noi_dung END,
      v_them || v_cu);
    IF v_loai = 'GIAO_LAI' THEN
      INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
      VALUES (v_nv."id", v_me."id", 'giao_lai', v_ten_cu, format('Chuyển chủ trì từ %s sang %s%s', coalesce(v_ten_cu, 'đơn vị ' || coalesce(v_nv."owner_don_vi_ma", '?')), v_moi."full_name",
        CASE WHEN v_theo_doi_moi."id" IS NOT NULL THEN ' · người theo dõi: ' || v_theo_doi_moi."full_name" ELSE '' END), 'app');
    END IF;
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
