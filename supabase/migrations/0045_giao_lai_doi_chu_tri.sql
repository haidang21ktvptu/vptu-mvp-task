-- 0045 — Giao lại (GIAO_LAI) đổi CHỦ TRÌ (Owner tài khoản), không chỉ người theo dõi (lỗi phát hiện khi kiểm thử v3.6.2: người vừa từ chối vẫn là
-- chủ trì). Quyết định nghiệp vụ 20/9/2026:
--   • p.chu_tri_moi (bắt buộc) = chủ trì mới: cán bộ Văn phòng, không hệ thống/A0, khác chủ trì hiện tại, trong phạm vi người ra chỉ đạo (như cũ:
--     A2 cùng phòng, PCVP phụ trách phòng, Chánh VP / quan_tri_kl mọi cán bộ). owner_don_vi_ma = đơn vị theo phòng của chủ trì mới
--     (dm_don_vi.phong; lãnh đạo Văn phòng → VAN_PHONG_TINH_UY); cap_nhan_san_pham tính lại theo QUY TẮC CỦA giao_viec (0035): A3 → Trưởng phòng,
--     A2 → Phó Chánh VP, A1 → Thường trực (tách thành hàm kl_cap_nhan_mac_dinh dùng chung, giao_viec gọi lại — không chép logic).
--   • p.nguoi_theo_doi_moi (tuỳ chọn) = người theo dõi mới (giao diện gợi ý theo cấp quản lý của chủ trì mới, sửa được); không truyền → giữ.
--   • Chặn khi việc đã HOAN_THANH hoặc đã đóng (dong_luc). Minh chứng do chủ trì cũ nộp GIỮ NGUYÊN (không xoá — là dữ liệu của việc).
--   • Cờ bi_tu_choi tự xoá (trigger 0034 khi owner/người theo dõi đổi); chủ trì mới chưa có dòng xac_nhan_nhan_viec của mình → phải xác nhận nhận
--     việc lại từ đầu (quy tắc từng người, v3.6.1). Chủ trì/người theo dõi cũ và mới đều nhận tin hệ thống; lich_su thêm dòng cot = 'giao_lai'
--     "Chuyển chủ trì từ A sang B" (lý do từ chối KHÔNG ghi vào lịch sử việc; lý do giao lại ghi ở dòng chi_dao như cũ).
--   • Tương thích: các loại chỉ đạo khác không đổi; p.nguoi_theo_doi_moi không còn là khoá bắt buộc của GIAO_LAI.
-- Dọn dữ liệu thử (0043/0044) đã bắt tài khoản demo\_% và dm_don_vi E2E\_% nên demo_e2e_cv2 / đơn vị E2E_RT của seed nằm trong diện xoá — không cần sửa.

-- 1. Cấp nhận sản phẩm mặc định theo Owner — quy tắc duy nhất, giao_viec (0035) và chi_dao_gui GIAO_LAI cùng gọi.
CREATE FUNCTION "public"."kl_cap_nhan_mac_dinh"("p_owner" "public"."accounts", "p_dv" "public"."dm_don_vi") RETURNS text
LANGUAGE "sql" IMMUTABLE AS $$
  SELECT CASE
    WHEN ("p_owner")."role_group" = 'A3' THEN 'TRUONG_PHONG'
    WHEN ("p_owner")."role_group" = 'A2' OR (("p_owner")."id" IS NULL AND ("p_dv")."phong" IS NOT NULL) THEN 'PHO_CHANH_VAN_PHONG'
    ELSE 'THUONG_TRUC' END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_cap_nhan_mac_dinh"("public"."accounts", "public"."dm_don_vi") FROM "public", "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_cap_nhan_mac_dinh"("public"."accounts", "public"."dm_don_vi") TO "authenticated", "service_role";

-- 2. chi_dao_gui: thân 0036, chỉ đổi nhánh GIAO_LAI (chặn việc đóng/hoàn thành, chủ trì mới, đơn vị + cấp nhận, người theo dõi tuỳ chọn, vết).
CREATE OR REPLACE FUNCTION "public"."chi_dao_gui"("p" jsonb) RETURNS uuid
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_nv "public"."nhiem_vu"; v_me "public"."accounts"; v_moi "public"."accounts"; v_tt "public"."chi_dao"; v_loai text := "p" ->> 'loai';
        v_noi_dung text := btrim(coalesce("p" ->> 'noi_dung', '')); v_han_moi date; v_han_ph date; v_id uuid; v_cu uuid[] := ARRAY[]::uuid[]; v_nhan uuid[] := ARRAY[]::uuid[];
        v_tin text; v_do_khan text; v_them uuid[]; v_nhan_dk text; v_dv "public"."dm_don_vi"; v_theo_doi_moi "public"."accounts"; v_ten_cu text;
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
    -- 0045: giao lại = đổi CHỦ TRÌ. Chặn việc đã hoàn thành/đã đóng (kiểm ở trên và dong_luc); minh chứng chủ trì cũ đã nộp giữ nguyên.
    IF v_nv."dong_luc" IS NOT NULL THEN RAISE EXCEPTION 'Nhiệm vụ đã đóng, không giao lại.' USING ERRCODE = '22023'; END IF;
    SELECT * INTO v_moi FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'chu_tri_moi', '')::uuid;
    IF v_moi."id" IS NULL OR v_moi."is_system" OR v_moi."role_group" = 'A0' THEN RAISE EXCEPTION 'Giao lại phải chọn chủ trì mới là cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
    IF v_moi."id" = v_nv."owner_tai_khoan" THEN RAISE EXCEPTION 'Chủ trì mới phải khác chủ trì hiện tại.' USING ERRCODE = '22023'; END IF;
    IF NOT (v_me."quan_tri_kl" OR v_me."is_chief"
            OR (v_me."role_group" = 'A2' AND v_moi."department" = v_me."department")
            OR (v_me."role_group" = 'A1' AND "public"."phu_trach"(v_me."id", v_moi."department", "public"."kl_hom_nay"()))) THEN
      RAISE EXCEPTION 'Chủ trì mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    -- Đơn vị Owner theo phòng của chủ trì mới (trigger 0023 kiểm khớp phòng); lãnh đạo Văn phòng (không phòng) → Văn phòng Tỉnh ủy.
    SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_moi."department" LIMIT 1;
    IF v_dv."ma" IS NULL AND v_moi."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
    IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (dm_don_vi) cho phòng % của chủ trì mới.', coalesce(v_moi."department", '(trống)') USING ERRCODE = '22023'; END IF;
    IF nullif("p" ->> 'nguoi_theo_doi_moi', '') IS NOT NULL THEN
      SELECT * INTO v_theo_doi_moi FROM "public"."accounts" WHERE "id" = ("p" ->> 'nguoi_theo_doi_moi')::uuid;
      IF v_theo_doi_moi."id" IS NULL OR v_theo_doi_moi."is_system" OR v_theo_doi_moi."role_group" = 'A0' THEN RAISE EXCEPTION 'Người theo dõi mới không hợp lệ.' USING ERRCODE = '22023'; END IF;
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
    PERFORM "public"."chi_dao_ghi_vet"(v_nv."id", v_loai, v_nhan_dk || CASE WHEN v_loai = 'GIA_HAN' THEN format('hạn mới %s — %s', to_char(v_han_moi, 'DD/MM/YYYY'), v_noi_dung) ELSE v_noi_dung END,
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

-- 3. giao_viec: thân 0035, chỉ thay biểu thức cấp nhận mặc định bằng kl_cap_nhan_mac_dinh (không đổi hành vi).
CREATE OR REPLACE FUNCTION "public"."giao_viec"("p" jsonb) RETURNS jsonb
LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" = "public" AS $$
DECLARE v_me "public"."accounts"; v_vb "public"."van_ban_giao_viec"; v_dv "public"."dm_don_vi"; v_owner "public"."accounts"; v_tm "public"."accounts";
        v_theo_doi "public"."accounts"; v_1400 boolean := coalesce(("p" ->> 'theo_1400')::boolean, true); v_a0 boolean; v_do_khan text;
        v_phong_owner text; v_loai_han text := coalesce("p" ->> 'loai_thoi_han_ma', 'CO_HAN_CU_THE'); v_cap text; v_id uuid; v_ma text;
        v_nhan uuid; v_nguoi uuid[] := ARRAY[]::uuid[]; v_tin text; v_han date := nullif("p" ->> 'han_xu_ly', '')::date;
BEGIN
  SELECT * INTO v_me FROM "public"."accounts" WHERE "id" = "auth"."uid"();
  v_a0 := v_me."role_group" = 'A0';
  IF v_me."id" IS NULL OR (v_me."role_group" NOT IN ('A0', 'A1', 'A2') AND NOT v_me."quan_tri_kl") THEN
    RAISE EXCEPTION 'Chỉ Thường trực, lãnh đạo Văn phòng, trưởng phòng hoặc người quản trị KL mới được giao việc.' USING ERRCODE = '42501';
  END IF;
  v_do_khan := coalesce(nullif("p" ->> 'do_khan', ''), CASE WHEN v_a0 THEN 'KHAN' ELSE 'THUONG' END);
  IF v_do_khan NOT IN ('THUONG', 'KHAN', 'THUONG_KHAN', 'HOA_TOC') THEN RAISE EXCEPTION 'Độ khẩn không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF ("p" ? 'uu_tien') AND NOT v_a0 THEN RAISE EXCEPTION 'Chỉ Thường trực Tỉnh ủy mới đặt ưu tiên Thường trực.' USING ERRCODE = '42501'; END IF;
  IF nullif("p" ->> 'van_ban_id', '') IS NOT NULL THEN
    SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = ("p" ->> 'van_ban_id')::uuid;
    IF v_vb."id" IS NULL THEN RAISE EXCEPTION 'Không tìm thấy văn bản giao việc.' USING ERRCODE = '22023'; END IF;
  ELSIF "p" ? 'van_ban' THEN
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES (coalesce("p" #>> '{van_ban,loai}', 'KHAC'), ("p" #>> '{van_ban,so_hoi_nghi}')::integer, btrim("p" #>> '{van_ban,so_ket_luan}'),
            ("p" #>> '{van_ban,ngay_ban_hanh}')::date, ("p" #>> '{van_ban,ngay_nhan}')::date, nullif(btrim("p" #>> '{van_ban,co_quan_ban_hanh}'), ''), v_me."id")
    RETURNING * INTO v_vb;
  ELSIF v_a0 THEN   -- Thường trực giao trực tiếp, không kèm văn bản: một văn bản loại KHAC ghi mốc giao.
    INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_ket_luan", "ngay_ban_hanh", "ngay_nhan", "co_quan_ban_hanh", "tao_boi")
    VALUES ('KHAC', 'Thường trực giao ' || to_char(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS.MS'), "public"."kl_hom_nay"(), "public"."kl_hom_nay"(), 'Thường trực Tỉnh ủy', v_me."id")
    RETURNING * INTO v_vb;
  ELSE
    RAISE EXCEPTION 'Nhiệm vụ phải gắn với một văn bản giao việc.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "p" ->> 'owner_don_vi_ma';
  IF v_1400 AND v_dv."ma" IS NULL THEN
    RAISE EXCEPTION 'Nhiệm vụ phải có một Owner chịu trách nhiệm (đơn vị, phòng hoặc cán bộ) — nguyên tắc 1 Owner.' USING ERRCODE = '22023';
  END IF;
  IF nullif("p" ->> 'owner_tai_khoan', '') IS NOT NULL THEN
    SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("p" ->> 'owner_tai_khoan')::uuid;
    IF v_owner."id" IS NULL OR v_owner."is_system" THEN RAISE EXCEPTION 'Tài khoản Owner không hợp lệ.' USING ERRCODE = '22023'; END IF;
  END IF;
  v_phong_owner := coalesce(v_owner."department", v_dv."phong");
  IF v_a0 THEN   -- Người nhận việc Thường trực giao: lãnh đạo Văn phòng (theo dõi = chính họ) hoặc Trưởng phòng của phòng được giao.
    IF v_owner."id" IS NOT NULL AND v_owner."role_group" = 'A1' THEN v_theo_doi := v_owner;
    ELSIF v_owner."id" IS NULL AND v_dv."trong_van_phong" AND v_dv."phong" IS NOT NULL THEN
      SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "role_group" = 'A2' AND "department" = v_dv."phong" AND NOT "is_system" ORDER BY "username" LIMIT 1;
      IF v_theo_doi."id" IS NULL THEN RAISE EXCEPTION 'Phòng % chưa có Trưởng phòng để nhận việc Thường trực giao.', v_dv."ten" USING ERRCODE = '22023'; END IF;
    ELSE RAISE EXCEPTION 'Thường trực Tỉnh ủy giao việc cho lãnh đạo Văn phòng hoặc một phòng của Văn phòng.' USING ERRCODE = '42501'; END IF;
  ELSE
    SELECT * INTO v_theo_doi FROM "public"."accounts" WHERE "id" = coalesce(nullif("p" ->> 'nguoi_theo_doi', '')::uuid, v_me."id");
    IF v_theo_doi."id" IS NULL OR v_theo_doi."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  END IF;
  -- Giao thay mặt: người giao không phải lãnh đạo (A3 giữ quan_tri_kl) phải ghi lãnh đạo A1/A2 được thay mặt, trong phạm vi Owner.
  IF v_me."role_group" = 'A3' THEN
    SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = nullif("p" ->> 'thay_mat_cho', '')::uuid;
    IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
      RAISE EXCEPTION 'Người quản trị KL giao việc phải thay mặt một lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A2' AND v_phong_owner IS DISTINCT FROM v_tm."department" THEN
      RAISE EXCEPTION 'Trưởng phòng được thay mặt chỉ giao cho Owner thuộc phòng mình.' USING ERRCODE = '22023';
    ELSIF v_tm."role_group" = 'A1' AND NOT v_tm."is_chief" AND v_phong_owner IS NOT NULL AND NOT "public"."phu_trach"(v_tm."id", v_phong_owner, "public"."kl_hom_nay"()) THEN
      RAISE EXCEPTION 'Phó Chánh Văn phòng được thay mặt phải phụ trách phòng của Owner.' USING ERRCODE = '22023';
    END IF;
  ELSIF nullif("p" ->> 'thay_mat_cho', '') IS NOT NULL THEN
    RAISE EXCEPTION 'Lãnh đạo giao việc trực tiếp, không ghi thay mặt.' USING ERRCODE = '22023';
  END IF;
  IF NOT v_me."quan_tri_kl" AND NOT v_a0 THEN   -- GV-3 (0025)
    IF v_dv."ma" IS NOT NULL AND NOT v_dv."trong_van_phong" THEN
      RAISE EXCEPTION 'Việc có Owner là đơn vị ngoài Văn phòng chỉ người quản trị KL nhập theo kết luận.' USING ERRCODE = '42501';
    ELSIF v_me."role_group" = 'A2' THEN
      IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR v_owner."department" IS DISTINCT FROM v_me."department" THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ giao việc cho chuyên viên phòng mình.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND v_theo_doi."department" IS DISTINCT FROM v_me."department" THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng của đồng chí.' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_me."is_chief" THEN
      IF v_phong_owner IS NULL OR NOT "public"."phu_trach"(v_me."id", v_phong_owner, "public"."kl_hom_nay"()) THEN
        RAISE EXCEPTION 'Phó Chánh Văn phòng chỉ giao việc cho phòng, cán bộ được phân công phụ trách.' USING ERRCODE = '42501';
      END IF;
      IF v_theo_doi."id" <> v_me."id" AND NOT "public"."phu_trach"(v_me."id", v_theo_doi."department", "public"."kl_hom_nay"()) THEN
        RAISE EXCEPTION 'Người theo dõi phải thuộc phòng đồng chí phụ trách.' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  IF v_1400 THEN   -- 1-1-1 (0025)
    IF nullif("p" ->> 'san_pham_loai', '') IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải định nghĩa sản phẩm đầu ra (tờ trình, báo cáo, dự thảo…) — nguyên tắc 1 Product.' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((SELECT "cho_phep_tao_moi" FROM "public"."dm_loai_thoi_han" WHERE "ma" = v_loai_han), false) THEN
      RAISE EXCEPTION 'Việc mới phải có thời hạn: chọn "Có hạn cụ thể" hoặc "Ký ban hành".' USING ERRCODE = '22023';
    END IF;
    IF v_loai_han = 'CO_HAN_CU_THE' AND v_han IS NULL THEN
      RAISE EXCEPTION 'Nhiệm vụ phải có hạn hoàn thành cụ thể — nguyên tắc 1 Deadline.' USING ERRCODE = '22023';
    END IF;
    IF v_vb."loai" IN ('KL_BTV', 'TB_THUONG_TRUC') AND (nullif("p" ->> 'nganh_ma', '') IS NULL OR nullif("p" ->> 'linh_vuc_ma', '') IS NULL) THEN
      RAISE EXCEPTION 'Việc từ kết luận/thông báo phải chọn ngành và lĩnh vực (để phân công lãnh đạo phụ trách).' USING ERRCODE = '22023';
    END IF;
    v_cap := coalesce(nullif("p" ->> 'cap_nhan_san_pham', ''), "public"."kl_cap_nhan_mac_dinh"(v_owner, v_dv)); -- 0045: một quy tắc dùng chung với giao lại
  END IF;
  IF v_a0 THEN PERFORM set_config('kl.thuong_truc', '1', true); END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "nguoi_theo_doi", "owner_don_vi_ma", "owner_tai_khoan", "san_pham_loai", "san_pham_mo_ta",
    "cap_nhan_san_pham", "cap_quyet_dinh", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh", "noi_dung", "loai_thoi_han_ma", "han_xu_ly",
    "ly_do_chua_co_han", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai", "ghi_chu", "nhiem_vu_cha", "theo_1400", "tao_boi",
    "do_khan", "giao_thay_mat_cho", "uu_tien")
  VALUES (v_vb."id", v_theo_doi."id", v_dv."ma", v_owner."id", nullif("p" ->> 'san_pham_loai', ''), nullif(btrim("p" ->> 'san_pham_mo_ta'), ''),
    v_cap, nullif("p" ->> 'cap_quyet_dinh', ''),
    CASE WHEN v_1400 THEN coalesce(nullif("p" ->> 'ngay_nhan_van_ban', '')::date, v_vb."ngay_nhan", "public"."kl_hom_nay"()) ELSE nullif("p" ->> 'ngay_nhan_van_ban', '')::date END,
    false, btrim("p" ->> 'noi_dung'), v_loai_han, v_han, nullif(btrim("p" ->> 'ly_do_chua_co_han'), ''),
    nullif("p" ->> 'nganh_ma', ''), nullif("p" ->> 'linh_vuc_ma', ''), nullif(btrim("p" ->> 'linh_vuc_chi_tiet'), ''), nullif(btrim("p" ->> 'van_ban_trien_khai'), ''),
    nullif(btrim("p" ->> 'ghi_chu'), ''), nullif("p" ->> 'nhiem_vu_cha', '')::uuid, v_1400, v_me."id", v_do_khan, v_tm."id", CASE WHEN v_a0 THEN 'THUONG_TRUC' END)
  RETURNING "id", "ma", "han_xu_ly" INTO v_id, v_ma, v_han;
  PERFORM set_config('kl.thuong_truc', '', true);
  -- Vết và tin hệ thống.
  v_nhan := coalesce(v_owner."id", v_theo_doi."id");
  IF v_tm."id" IS NOT NULL THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_thay_mat', format('%s giao thay mặt %s', v_me."full_name", v_tm."full_name"), 'app');
    v_nguoi := v_nguoi || v_tm."id";
  END IF;
  IF v_a0 THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon") VALUES (v_id, v_me."id", 'giao_viec', format('Thường trực Tỉnh ủy giao, độ khẩn %s, người nhận %s', "public"."ten_do_khan"(v_do_khan), v_theo_doi."full_name"), 'app');
  END IF;
  IF v_a0 OR v_tm."id" IS NOT NULL OR v_do_khan <> 'THUONG' THEN v_nguoi := v_nguoi || v_nhan || v_theo_doi."id"; END IF;
  IF v_do_khan IN ('THUONG_KHAN', 'HOA_TOC') THEN v_nguoi := v_nguoi || "public"."lanh_dao_truc_tiep"(v_nhan); END IF;
  IF v_a0 OR v_do_khan = 'HOA_TOC' THEN v_nguoi := v_nguoi || (SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system" ORDER BY "username" LIMIT 1); END IF;
  v_tin := format('%s · %s: %s (hạn %s)', CASE WHEN v_a0 THEN 'Thường trực giao việc' WHEN v_tm."id" IS NOT NULL THEN 'Giao việc thay mặt ' || v_tm."full_name" ELSE 'Giao việc' END
    || CASE WHEN v_do_khan <> 'THUONG' THEN ' · ' || "public"."ten_do_khan"(v_do_khan) ELSE '' END, v_ma, left(btrim("p" ->> 'noi_dung'), 120), coalesce(to_char(v_han, 'DD/MM/YYYY'), 'ký ban hành'));
  INSERT INTO "public"."direct_messages" ("sender_id", "receiver_id", "content", "is_read", "loai", "nhiem_vu_id")
  SELECT DISTINCT v_me."id", u, v_tin, false, 'he_thong', v_id FROM unnest(v_nguoi) u JOIN "public"."accounts" a ON a."id" = u
  WHERE u <> v_me."id" AND NOT a."is_system" AND a."role_group" <> 'A0';
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma, 'van_ban_id', v_vb."id");
END;
$$;
