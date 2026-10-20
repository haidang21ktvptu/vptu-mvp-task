-- 0117 (v3.27.0 — chủ dự án 20/10/2026): chuẩn hoá nhập liệu theo bảng Phụ lục của Văn phòng (cột G "Cơ quan/đơn vị trình").
-- 1. Cơ quan/đơn vị trình nhận thêm "1. Văn phòng Tỉnh ủy" (VAN_PHONG_TINH_UY): danh mục cột G của bảng Phụ lục có mục này (nội dung do Văn phòng trình);
--    các phòng trong Văn phòng vẫn không là cơ quan trình. kl_co_quan_trinh_hop_le dùng chung cho trigger bf_nhiem_vu_nguon (kl_nhiem_vu_nguon_truoc_ghi,
--    bản 0087) và kl_thay_doi_giao (bản 0087) — hai hàm chép nguyên văn, chỉ đổi điều kiện cơ quan trình (câu báo lỗi giữ phần đầu).
-- 2. kl_nhap_da_xong (bản 0102): việc "đã xong ngoài hệ thống" ghi thêm cơ quan trình, mức quan trọng, Thường trực chỉ đạo (trước bỏ mất ba ô này).
-- 3. kl_nhap_cap_nhat (bản 0074): cập nhật theo mã nhận thêm ba ô nguồn (ô tầng giao từ 0087, kiểm bằng kl_thay_doi_giao) — "Xuất theo mẫu", sửa cột
--    G rồi nhập lại thì ghi được (việc đang mở; việc đã đóng chỉ báo như các ô tầng giao khác). Mẫu bảng Phụ lục không có cột Lĩnh vực: đổi ngành mà
--    lĩnh vực đang có không thuộc ngành mới → lĩnh vực gợi ý của dòng (linh_vuc_goi_y, quy tắc mặc định ở máy, phải cùng ngành) hoặc lĩnh vực duy nhất
--    của ngành; không có → giữ ngành, báo trong ghi chú, các ô khác vẫn ghi (trước: lỗi "Lĩnh vực không thuộc ngành", bỏ cả dòng).
-- 4. Bổ sung dữ liệu chuyển đổi (hàm bo_sung_chuyen_doi): migration 0118. Kiểm thử cả hai: tests/rls/kl-0117-chuyen-doi.test.mjs.
-- 5. kl_truong_nhap (bản 0106): thêm 'chu_tri' — cột "Chủ trì theo dõi" của bảng Phụ lục (cán bộ chủ trì + người theo dõi, hoặc "VPTU"); hồ sơ
--    ghép cột người dùng lưu có cột này (trước báo "trường không có trong chuẩn nhập").

-- ---- 1. Cơ quan trình: đơn vị ngoài Văn phòng hoặc Văn phòng Tỉnh ủy ----
CREATE FUNCTION "public"."kl_co_quan_trinh_hop_le"("p_ma" text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = "p_ma" AND (NOT d."trong_van_phong" OR d."ma" = 'VAN_PHONG_TINH_UY'));
$$;
REVOKE ALL ON FUNCTION "public"."kl_co_quan_trinh_hop_le"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_co_quan_trinh_hop_le"(text) TO "authenticated";

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
     AND NOT "public"."kl_co_quan_trinh_hop_le"(NEW."co_quan_trinh") THEN   -- 0117: + Văn phòng Tỉnh ủy
    RAISE EXCEPTION 'Cơ quan trình phải là cơ quan, đơn vị ngoài Văn phòng hoặc Văn phòng Tỉnh ủy (danh mục đơn vị).' USING ERRCODE = '22023';
  END IF;
  IF NEW."thuong_truc_chi_dao" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."thuong_truc_chi_dao" IS DISTINCT FROM OLD."thuong_truc_chi_dao")
     AND NOT EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id" = NEW."thuong_truc_chi_dao" AND "role_group" = 'A0' AND NOT "is_system") THEN
    RAISE EXCEPTION 'Thường trực chỉ đạo phải là tài khoản một đồng chí Thường trực Tỉnh ủy.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- ---- (bản 0087 + điều kiện cơ quan trình 0117) ----
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
    -- 0087: ba ô nguồn (Mức quan trọng A/B/C; Cơ quan trình = đơn vị ngoài Văn phòng, 0117: hoặc Văn phòng Tỉnh ủy; Thường trực chỉ đạo = tài khoản A0)
    -- — trigger bf_ kiểm lại.
    IF v_s IS NOT NULL AND ((k = 'muc_quan_trong' AND v_s NOT IN ('A', 'B', 'C'))
      OR (k = 'co_quan_trinh' AND NOT "public"."kl_co_quan_trinh_hop_le"(v_s))   -- 0117: + Văn phòng Tỉnh ủy
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

-- ---- 2. kl_nhap_da_xong (bản 0102 + ba ô nguồn) ----
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
    "don_vi_phoi_hop", "ghi_chu", "theo_1400", "tien_do_ma", "chat_luong", "nguon", "tao_boi", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh",
    "muc_quan_trong", "co_quan_trinh", "thuong_truc_chi_dao")   -- 0117: ba ô nguồn (trước bỏ mất; trigger bf_nhiem_vu_nguon kiểm)
  VALUES ("p_vb", btrim("d" ->> 'noi_dung'), nullif("d" ->> 'owner_don_vi_ma', ''), nullif("d" ->> 'owner_tai_khoan', '')::uuid, v_td."id",
    v_tm."id", coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE'), nullif("d" ->> 'han_xu_ly', '')::date,
    nullif("d" ->> 'san_pham_loai', ''), nullif("d" ->> 'cap_nhan_san_pham', ''), coalesce(nullif("d" ->> 'do_khan', ''), 'THUONG'),
    nullif("d" ->> 'nguon_nhiem_vu_ma', ''), nullif("d" ->> 'nganh_ma', ''), nullif("d" ->> 'linh_vuc_ma', ''), nullif(btrim("d" ->> 'linh_vuc_chi_tiet'), ''),
    nullif(btrim("d" ->> 'van_ban_trien_khai'), ''), left(nullif(btrim("d" ->> 'don_vi_phoi_hop'), ''), 300), nullif(btrim("d" ->> 'ghi_chu'), ''), false,
    'HOAN_THANH', nullif("d" ->> 'chat_luong', ''), 'excel', "auth"."uid"(), coalesce(v_vb."ngay_nhan", v_vb."ngay_ban_hanh"), v_vb."ngay_nhan" IS NULL,
    upper(nullif(btrim("d" ->> 'muc_quan_trong'), '')), nullif(btrim("d" ->> 'co_quan_trinh'), ''), nullif("d" ->> 'thuong_truc_chi_dao', '')::uuid)
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

-- ---- 3. kl_nhap_cap_nhat (bản 0074 + ba ô nguồn) ----
CREATE OR REPLACE FUNCTION "public"."kl_nhap_cap_nhat"("d" jsonb, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_thay jsonb := '{}'::jsonb; v_moi jsonb; v_cu jsonb := '{}'::jsonb; v_bao text[] := '{}'; k text; val text;
        v_me uuid := "auth"."uid"(); v_vm text := left(nullif(btrim("d" ->> 'vuong_mac'), ''), 500);
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE upper("ma") = upper(btrim("d" ->> 'ma')) FOR UPDATE;
  FOR k, val IN SELECT e.key, btrim(e.value) FROM jsonb_each_text(jsonb_strip_nulls(jsonb_build_object('noi_dung', "d" ->> 'noi_dung',
      'san_pham_loai', "d" ->> 'san_pham_loai', 'cap_nhan_san_pham', "d" ->> 'cap_nhan_san_pham', 'do_khan', "d" ->> 'do_khan', 'nganh_ma', "d" ->> 'nganh_ma',
      'linh_vuc_ma', "d" ->> 'linh_vuc_ma', 'linh_vuc_chi_tiet', "d" ->> 'linh_vuc_chi_tiet', 'nguon_nhiem_vu_ma', "d" ->> 'nguon_nhiem_vu_ma',
      'don_vi_phoi_hop', "d" ->> 'don_vi_phoi_hop',
      'muc_quan_trong', "d" ->> 'muc_quan_trong', 'co_quan_trinh', "d" ->> 'co_quan_trinh', 'thuong_truc_chi_dao', "d" ->> 'thuong_truc_chi_dao'))) e LOOP   -- 0117: ba ô nguồn (0087)
    IF val <> '' AND val IS DISTINCT FROM btrim(coalesce(to_jsonb(v) ->> k, '')) THEN v_thay := v_thay || jsonb_build_object(k, val); END IF;
  END LOOP;
  IF v_thay ? 'nganh_ma' AND NOT v_thay ? 'linh_vuc_ma' AND v."linh_vuc_ma" IS NOT NULL   -- 0117: đổi ngành, tệp không có cột Lĩnh vực
     AND NOT EXISTS (SELECT 1 FROM "public"."dm_linh_vuc" l WHERE l."ma" = v."linh_vuc_ma" AND l."nganh_ma" = v_thay ->> 'nganh_ma') THEN
    SELECT coalesce((SELECT l."ma" FROM "public"."dm_linh_vuc" l WHERE l."ma" = nullif(btrim("d" ->> 'linh_vuc_goi_y'), '') AND l."nganh_ma" = v_thay ->> 'nganh_ma'),
                    (SELECT min(l."ma") FROM "public"."dm_linh_vuc" l WHERE l."nganh_ma" = v_thay ->> 'nganh_ma' HAVING count(*) = 1)) INTO val;
    IF val IS NOT NULL THEN v_thay := v_thay || jsonb_build_object('linh_vuc_ma', val);
    ELSE v_thay := v_thay - 'nganh_ma'; v_bao := v_bao || 'ngành (lĩnh vực đang có không thuộc ngành mới — đổi ngành, lĩnh vực ở ngăn chi tiết)'::text;
    END IF;
  END IF;
  IF v_thay <> '{}'::jsonb THEN
    IF NOT "public"."kl_la_tang_giao"(v) THEN v_bao := v_bao || 'thông tin giao (chỉ người giao hoặc quản trị nhiệm vụ sửa)'::text;
    ELSIF v."tien_do_ma" = 'HOAN_THANH' AND NOT ("public"."me_quan_tri_kl"() AND "public"."me_role"() IS DISTINCT FROM 'A0') THEN
      v_bao := v_bao || 'thông tin giao của việc đã đóng'::text;
    ELSE
      v_moi := "public"."kl_thay_doi_giao"(v, v_thay);
      SELECT jsonb_object_agg(x, to_jsonb(v) -> x) INTO v_cu FROM jsonb_object_keys(v_moi) x;
      PERFORM "public"."kl_ap_thong_tin_giao"(v."id", v_moi);
      INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
      VALUES (v."id", v_me, 'sua_thong_tin_giao', format('sửa %s — lý do: nhập Excel lô %s, dòng %s', "public"."kl_ten_thay_doi"(v_moi), "p_lo"."ma", "d" ->> 'so_dong'), 'app');
      SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = v."id";   -- minh chứng bên dưới dùng cấp nhận vừa sửa
    END IF;
  END IF;
  IF v_vm IS NOT NULL AND v_vm IS DISTINCT FROM v."vuong_mac" THEN
    IF v."tien_do_ma" = 'HOAN_THANH' THEN v_bao := v_bao || 'vướng mắc của việc đã đóng'::text;
    ELSIF ("public"."kl_la_tang_giao"(v) OR v_me IN (v."owner_tai_khoan", v."nguoi_theo_doi")) IS NOT TRUE THEN v_bao := v_bao || 'vướng mắc (không có quyền)'::text;
    ELSE
      v_cu := v_cu || jsonb_build_object('vuong_mac', v."vuong_mac");
      PERFORM set_config('kl.ghi_qua_ham', '1', true);
      UPDATE "public"."nhiem_vu" SET "vuong_mac" = v_vm WHERE "id" = v."id";
      PERFORM set_config('kl.ghi_qua_ham', '', true);
    END IF;
  END IF;
  IF "d" ->> 'tien_do_ma' = 'HOAN_THANH' AND v."tien_do_ma" <> 'HOAN_THANH' THEN
    IF "p_lo"."che_do_xong" = 'CHO_NGHIEM_THU' AND "public"."kl_nhap_du_kq"("d") AND v."theo_1400" AND "public"."kl_la_tang_giao"(v)
       AND NOT EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS NOT FALSE) THEN
      PERFORM "public"."kl_nhap_minh_chung"(v, "d", "p_lo");
      v_cu := v_cu || '{"_minh_chung": true}'::jsonb;
    ELSE v_bao := v_bao || 'tiến độ Hoàn thành (chủ trì nộp minh chứng, lãnh đạo nghiệm thu)'::text;
    END IF;
  END IF;
  IF (nullif("d" ->> 'owner_tai_khoan', '') IS NOT NULL AND ("d" ->> 'owner_tai_khoan')::uuid IS DISTINCT FROM v."owner_tai_khoan")
     OR (nullif("d" ->> 'owner_don_vi_ma', '') IS NOT NULL AND "d" ->> 'owner_don_vi_ma' IS DISTINCT FROM v."owner_don_vi_ma") THEN
    v_bao := v_bao || 'chủ trì (dùng Giao lại)'::text;
  END IF;
  IF nullif("d" ->> 'nguoi_theo_doi', '') IS NOT NULL AND ("d" ->> 'nguoi_theo_doi')::uuid IS DISTINCT FROM v."nguoi_theo_doi" THEN
    v_bao := v_bao || 'người theo dõi (dùng Giao lại)'::text;
  END IF;
  IF nullif("d" ->> 'han_xu_ly', '') IS NOT NULL AND ("d" ->> 'han_xu_ly')::date IS DISTINCT FROM v."han_xu_ly" THEN v_bao := v_bao || 'hạn hoàn thành (dùng Gia hạn)'::text; END IF;
  IF v_cu <> '{}'::jsonb THEN
    INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
    VALUES (v."id", v_me, 'nhap_excel', format('Cập nhật từ Excel · lô %s, dòng %s (tệp %s)', "p_lo"."ma", "d" ->> 'so_dong', "p_lo"."ten_tep"), 'app');
  END IF;
  RETURN jsonb_build_object('id', v."id", 'ma', v."ma", 'doi', v_cu <> '{}'::jsonb, 'gia_tri_cu', CASE WHEN v_cu <> '{}'::jsonb THEN v_cu END,
    'ghi_chu', CASE WHEN cardinality(v_bao) > 0 THEN 'Không đổi qua nhập Excel: ' || array_to_string(v_bao, '; ') END);
END;
$$;

-- ---- 5. Mã trường nhập: thêm "Chủ trì theo dõi" (bản 0106 + 'chu_tri') ----
CREATE OR REPLACE FUNCTION "public"."kl_truong_nhap"() RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['ma', 'loai_van_ban', 'so_hoi_nghi', 'so_ket_luan', 'ngay_ban_hanh', 'noi_dung', 'don_vi', 'can_bo', 'theo_doi', 'lanh_dao_giao',
               'loai_thoi_han', 'han_xu_ly', 'san_pham', 'cap_nhan', 'do_khan', 'nguon', 'nganh', 'linh_vuc', 'tien_do', 'vuong_mac',
               'kq_so_hieu', 'kq_ngay', 'kq_trich_yeu', 'kq_mo_ta', 'chat_luong',
               'linh_vuc_chi_tiet', 'van_ban_trien_khai', 'han_nop', 'don_vi_phoi_hop', 'ghi_chu',
               'muc_quan_trong', 'co_quan_trinh', 'thuong_truc_chi_dao',   -- 0093
               'muc_tieu',   -- 0106
               'chu_tri']::text[];   -- 0117
$$;
REVOKE ALL ON FUNCTION "public"."kl_truong_nhap"() FROM public, "anon", "authenticated";
