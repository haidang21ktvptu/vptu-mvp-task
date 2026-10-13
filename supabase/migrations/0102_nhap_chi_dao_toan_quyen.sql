-- 0102 (v3.22, tiếp 0100): hai hàm còn đọc vai người gọi trực tiếp từ accounts — chỉ đổi dòng đọc hồ sơ: v_me := kl_toi_hieu_dung().
-- 1. kl_nhap_da_xong (bản 0097): dòng "đã xong ngoài hệ thống" của lô do tài khoản toàn quyền nhập đi đường lãnh đạo (phạm vi: mọi phòng — 0100).
-- 2. chi_dao_gui (bản 0092): tài khoản toàn quyền đôn đốc, gia hạn, giao lại, ý kiến trên mọi việc như Chánh Văn phòng.
-- Vai khác: không đổi hành vi.

-- ---- 1 ----
CREATE OR REPLACE FUNCTION "public"."kl_nhap_da_xong"("d" jsonb, "p_vb" uuid, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_id uuid; v_ma text; v_chu text; v_me "public"."accounts"; v_tm "public"."accounts"; v_owner "public"."accounts";
        v_td "public"."accounts"; v_dv "public"."dm_don_vi"; v_phong text; v_ng text := nullif("d" ->> 'nganh_ma', ''); v_lv text := nullif("d" ->> 'linh_vuc_ma', '');
        v_nhom text;
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_vb";
  v_me := "public"."kl_toi_hieu_dung"();   -- 0100: tài khoản toàn quyền như Chánh Văn phòng
  IF nullif("d" ->> 'nguoi_theo_doi', '') IS NULL THEN RAISE EXCEPTION 'Thiếu người theo dõi.' USING ERRCODE = '22023'; END IF;
  IF v_me."role_group" = 'A3' THEN   -- thay mặt chỉ của chuyên viên (như kl_nhap_giao 0093); lãnh đạo nhập: bỏ cột Lãnh đạo giao
    v_nhom := nullif("d" ->> 'thay_mat_nhom', '');
    IF nullif("d" ->> 'thay_mat_cho', '') IS NOT NULL THEN
      SELECT * INTO v_tm FROM "public"."accounts" WHERE "id" = ("d" ->> 'thay_mat_cho')::uuid;
      IF v_tm."id" IS NULL OR v_tm."is_system" OR v_tm."role_group" NOT IN ('A1', 'A2') THEN
        RAISE EXCEPTION 'Lãnh đạo giao phải là lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = "d" ->> 'owner_don_vi_ma';
  IF nullif("d" ->> 'owner_tai_khoan', '') IS NOT NULL THEN SELECT * INTO v_owner FROM "public"."accounts" WHERE "id" = ("d" ->> 'owner_tai_khoan')::uuid; END IF;
  v_phong := coalesce(v_owner."department", v_dv."phong");
  SELECT * INTO v_td FROM "public"."accounts" WHERE "id" = ("d" ->> 'nguoi_theo_doi')::uuid;
  IF v_td."id" IS NULL OR v_td."is_system" THEN RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023'; END IF;
  IF v_me."role_group" = 'A3' AND v_nhom IS NULL AND v_tm."id" IS NULL THEN   -- giao thẳng (GV-14)
    IF v_owner."id" IS NULL OR v_owner."role_group" <> 'A3' OR v_owner."is_system" THEN
      RAISE EXCEPTION 'Không ghi Lãnh đạo giao thì chủ trì phải là một chuyên viên (chuyên viên giao thẳng).' USING ERRCODE = '22023';
    END IF;
    v_td := v_me;
  ELSIF v_nhom IS NULL THEN   -- lãnh đạo nhập (phạm vi của mình) / chuyên viên ghi một lãnh đạo (phạm vi của lãnh đạo đó)
    IF NOT (coalesce(v_owner."id" = v_me."id", false) OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_phong, v_ng, v_lv, v_tm."id")) THEN
      RAISE EXCEPTION 'Chủ trì ngoài phạm vi giao của %.', CASE WHEN v_tm."id" IS NULL THEN 'đồng chí' ELSE 'lãnh đạo giao' END USING ERRCODE = '22023';
    END IF;
    IF NOT (coalesce(v_td."id" = v_me."id" OR v_td."id" = v_tm."id", false) OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_td."department", v_ng, v_lv, v_tm."id")) THEN
      RAISE EXCEPTION 'Người theo dõi ngoài phạm vi giao của %.', CASE WHEN v_tm."id" IS NULL THEN 'đồng chí' ELSE 'lãnh đạo giao' END USING ERRCODE = '22023';
    END IF;
  END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "noi_dung", "owner_don_vi_ma", "owner_tai_khoan", "nguoi_theo_doi", "giao_thay_mat_cho", "loai_thoi_han_ma",
    "han_xu_ly", "san_pham_loai", "cap_nhan_san_pham", "do_khan", "nguon_nhiem_vu_ma", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai",
    "don_vi_phoi_hop", "ghi_chu", "theo_1400", "tien_do_ma", "chat_luong", "nguon", "tao_boi", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh")
  VALUES ("p_vb", btrim("d" ->> 'noi_dung'), nullif("d" ->> 'owner_don_vi_ma', ''), nullif("d" ->> 'owner_tai_khoan', '')::uuid, v_td."id",
    v_tm."id", coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE'), nullif("d" ->> 'han_xu_ly', '')::date,
    nullif("d" ->> 'san_pham_loai', ''), nullif("d" ->> 'cap_nhan_san_pham', ''), coalesce(nullif("d" ->> 'do_khan', ''), 'THUONG'),
    nullif("d" ->> 'nguon_nhiem_vu_ma', ''), nullif("d" ->> 'nganh_ma', ''), nullif("d" ->> 'linh_vuc_ma', ''), nullif(btrim("d" ->> 'linh_vuc_chi_tiet'), ''),
    nullif(btrim("d" ->> 'van_ban_trien_khai'), ''), left(nullif(btrim("d" ->> 'don_vi_phoi_hop'), ''), 300), nullif(btrim("d" ->> 'ghi_chu'), ''), false,
    'HOAN_THANH', nullif("d" ->> 'chat_luong', ''), 'excel', "auth"."uid"(), coalesce(v_vb."ngay_nhan", v_vb."ngay_ban_hanh"), v_vb."ngay_nhan" IS NULL)
  RETURNING "id", "ma" INTO v_id, v_ma;
  v_chu := nullif(concat_ws(' · ', 'Số ' || nullif(btrim("d" ->> 'kq_so_hieu'), ''), 'ngày ' || to_char(nullif("d" ->> 'kq_ngay', '')::date, 'DD/MM/YYYY'),
    nullif(btrim("d" ->> 'kq_trich_yeu'), ''), nullif(btrim("d" ->> 'kq_mo_ta'), '')), '');
  IF v_chu IS NOT NULL THEN   -- kết quả trong tệp → minh chứng chữ (như dữ liệu chuyển đổi 15/9), tính lại cờ thiếu minh chứng của việc đã đóng
    INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "noi_dung_chu", "nop_boi") VALUES (v_id, 'chu_cu', left(v_chu, 2000), "auth"."uid"());
    PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
    UPDATE "public"."nhiem_vu" SET "thieu_minh_chung" = "thieu_minh_chung" WHERE "id" = v_id;
    PERFORM set_config('kl.minh_chung_tinh_lai', '', true);
  END IF;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v_id, "auth"."uid"(), 'nhap_excel', format('Nhập từ Excel (đã xong ngoài hệ thống) · lô %s, dòng %s (tệp %s)', "p_lo"."ma", "d" ->> 'so_dong', "p_lo"."ten_tep"), 'excel');
  RETURN jsonb_build_object('id', v_id, 'ma', v_ma);
END;
$$;

-- ---- 2 ----
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
  -- 0092: + người tạo việc giao thẳng (không thay mặt ai — "việc mình giao"), còn thấy việc: đôn đốc, gia hạn, giao lại, ý kiến.
  ELSIF v_nv."id" IS NULL OR NOT ("public"."kl_duoc_chi_dao"(v_nv."id")
        OR coalesce(v_nv."tao_boi" = "auth"."uid"() AND v_nv."giao_thay_mat_cho" IS NULL AND v_nv."giao_thay_mat_nhom" IS NULL AND "public"."kl_thay_nhiem_vu"(v_nv."id"), false)) THEN   -- tao_boi NULL ⇒ false (không để NULL lọt qua IF)
    RAISE EXCEPTION 'Chỉ lãnh đạo trong phạm vi hoặc người giao việc mới ra chỉ đạo, đôn đốc trên nhiệm vụ này.' USING ERRCODE = '42501'; END IF;
  IF v_loai NOT IN ('DON_DOC', 'GIA_HAN', 'GIAO_LAI', 'YEU_CAU_MINH_CHUNG', 'KIEM_TRA_SO_LIEU', 'Y_KIEN', 'CHI_DAO_TT') THEN RAISE EXCEPTION 'Loại chỉ đạo không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_noi_dung = '' THEN RAISE EXCEPTION 'Chỉ đạo phải có nội dung (lý do).' USING ERRCODE = '22023'; END IF;
  v_me := "public"."kl_toi_hieu_dung"();   -- 0100: tài khoản toàn quyền như Chánh Văn phòng
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
      RAISE EXCEPTION 'Chỉ gia hạn việc do chính mình giao, không phải việc từ kết luận/thông báo của cấp ủy (Chánh / Phó Chánh Văn phòng gia hạn được).' USING ERRCODE = '42501';
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
    IF v_me."role_group" = 'A3' AND NOT v_qtkl THEN   -- 0092: chuyên viên giao lại việc mình giao — chủ trì mới là chuyên viên (như giao thẳng 0085)
      IF v_moi."role_group" <> 'A3' THEN RAISE EXCEPTION 'Chuyên viên giao lại cho một chuyên viên khác (hoặc chính mình).' USING ERRCODE = '42501'; END IF;
    ELSIF NOT (v_qtkl OR "public"."kl_duoc_giao_cho_phong"(v_me."id", v_moi."department", v_nv."nganh_ma", v_nv."linh_vuc_ma")) THEN
      RAISE EXCEPTION 'Chủ trì mới phải thuộc phòng trong phạm vi của đồng chí.' USING ERRCODE = '42501';
    END IF;
    -- Đơn vị Owner theo phòng của chủ trì mới (trigger 0023 kiểm khớp phòng); lãnh đạo Văn phòng (không phòng) → Văn phòng Tỉnh ủy.
    SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "trong_van_phong" AND "phong" IS NOT DISTINCT FROM v_moi."department" LIMIT 1;
    IF v_dv."ma" IS NULL AND v_moi."role_group" = 'A1' THEN SELECT * INTO v_dv FROM "public"."dm_don_vi" WHERE "ma" = 'VAN_PHONG_TINH_UY'; END IF;
    IF v_dv."ma" IS NULL THEN RAISE EXCEPTION 'Không xác định được đơn vị (dm_don_vi) cho phòng % của chủ trì mới.', coalesce(v_moi."department", '(trống)') USING ERRCODE = '22023'; END IF;
    IF nullif("p" ->> 'nguoi_theo_doi_moi', '') IS NOT NULL THEN
      SELECT * INTO v_theo_doi_moi FROM "public"."accounts" WHERE "id" = ("p" ->> 'nguoi_theo_doi_moi')::uuid;
      IF v_theo_doi_moi."id" IS NULL OR v_theo_doi_moi."is_system" OR v_theo_doi_moi."role_group" = 'A0' THEN RAISE EXCEPTION 'Người theo dõi mới không hợp lệ.' USING ERRCODE = '22023'; END IF;
      IF v_me."role_group" = 'A3' AND NOT v_qtkl AND v_theo_doi_moi."id" <> v_me."id" THEN   -- 0092: chuyên viên giao việc là người theo dõi
        RAISE EXCEPTION 'Chuyên viên giao lại thì người theo dõi là chính mình.' USING ERRCODE = '42501';
      END IF;
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
