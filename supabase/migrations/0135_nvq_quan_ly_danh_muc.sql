-- 0135 (v3.35 — CAU-HOI nhóm U): hàm ghi phần quản lý danh mục của phân hệ Nhiệm vụ quý BTV — kỳ (quý) và tuần báo cáo, văn bản căn cứ, nhiệm vụ,
-- kết quả / sản phẩm, phân công chủ trì theo dõi, điều chỉnh (rút / khôi phục theo văn bản), đầu mối tổng hợp, danh mục lãnh đạo / đơn vị.
-- Mọi hàm: kiểm quyền (0134) trước, lý do bắt buộc khi sửa / rút / phân công lại, ghi nvq_lich_su. Lỗi quyền 42501, dữ liệu sai 22023.

CREATE FUNCTION "public"."nvq_la_ma"("p_so" integer) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'])["p_so"];
$$;
-- Tên trường để ghi lịch sử (đúng tên cột bảng Phụ lục).
CREATE FUNCTION "public"."nvq_ten_truong"("p_k" text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_k" WHEN 'noi_dung' THEN 'Nhiệm vụ được giao' WHEN 'lanh_dao_text' THEN 'Lãnh đạo phụ trách' WHEN 'lanh_dao_ma' THEN 'Lãnh đạo phụ trách (danh mục)'
    WHEN 'don_vi_text' THEN 'Đơn vị tham mưu, chủ trì' WHEN 'don_vi' THEN 'Đơn vị tham mưu, chủ trì (danh mục)' WHEN 'ket_qua_can_dat' THEN 'Kết quả/sản phẩm cần đạt được'
    WHEN 'tien_do_text' THEN 'Tiến độ thực hiện/hoàn thành' WHEN 'tinh_chat' THEN 'Tính chất' WHEN 'truc_so' THEN 'Trục kết quả trọng tâm' WHEN 'nhom' THEN 'Nhóm'
    WHEN 'stt' THEN 'Stt' WHEN 'mo_ta' THEN 'Kết quả, sản phẩm' WHEN 'loai' THEN 'Loại kết quả' WHEN 'han' THEN 'Mốc hoàn thành' WHEN 'han_text' THEN 'Tiến độ ghi'
    WHEN 'muc_tieu' THEN 'Mục tiêu' WHEN 'don_vi_tinh' THEN 'Đơn vị tính' WHEN 'chi_tieu_co_ban' THEN 'Chỉ tiêu cơ bản' WHEN 'chieu' THEN 'Chiều đánh giá'
    WHEN 'thu_tu' THEN 'Thứ tự' ELSE "p_k" END;
$$;
CREATE FUNCTION "public"."nvq_ly_do"("p_ly_do" text, "p_bat_buoc" boolean DEFAULT true) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text := btrim(coalesce("p_ly_do", ''));
BEGIN
  IF ("p_bat_buoc" AND v = '') OR char_length(v) > 500 THEN RAISE EXCEPTION 'Lý do bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  RETURN nullif(v, '');
END;
$$;
CREATE FUNCTION "public"."nvq_can_quan_ly"() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT "public"."nvq_la_quan_ly"() THEN
    RAISE EXCEPTION 'Chỉ đầu mối tổng hợp, Chánh Văn phòng hoặc tài khoản toàn quyền mới quản lý danh mục nhiệm vụ quý.' USING ERRCODE = '42501';
  END IF;
END;
$$;
CREATE FUNCTION "public"."nvq_ky_mo"("p_ky" uuid) RETURNS "public"."nvq_ky" LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k "public"."nvq_ky";
BEGIN
  SELECT * INTO k FROM "public"."nvq_ky" WHERE "id" = "p_ky";
  IF k."id" IS NULL THEN RAISE EXCEPTION 'Không có quý này.' USING ERRCODE = '22023'; END IF;
  IF k."trang_thai" = 'DA_CHOT' THEN RAISE EXCEPTION 'Quý đã chốt: mở lại quý trước khi thay đổi.' USING ERRCODE = '22023'; END IF;
  RETURN k;
END;
$$;
-- Kiểm danh sách lãnh đạo / đơn vị theo danh mục.
CREATE FUNCTION "public"."nvq_kiem_danh_muc"("p_lanh_dao" text[], "p_don_vi" jsonb) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(coalesce("p_lanh_dao", '{}')) m WHERE NOT EXISTS (SELECT 1 FROM "public"."nvq_lanh_dao" l WHERE l."ma" = m)) THEN
    RAISE EXCEPTION 'Lãnh đạo phụ trách không có trong danh mục.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce("p_don_vi", '[]')) <> 'array' OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce("p_don_vi", '[]')) e
      WHERE NOT EXISTS (SELECT 1 FROM "public"."nvq_don_vi" d WHERE d."ma" = e ->> 'ma')
         OR coalesce(e ->> 'vai_tro', 'CHU_TRI') NOT IN ('CHU_TRI', 'PHOI_HOP', 'THAM_DINH', 'THAM_TRA')) THEN
    RAISE EXCEPTION 'Đơn vị tham mưu, chủ trì không có trong danh mục hoặc vai trò không hợp lệ.' USING ERRCODE = '22023';
  END IF;
END;
$$;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['nvq_ly_do(text, boolean)', 'nvq_can_quan_ly()', 'nvq_ky_mo(uuid)', 'nvq_kiem_danh_muc(text[], jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon, authenticated', f);
  END LOOP;
END $$;

-- ---- 1. Kỳ (quý): tạo (sinh tuần báo cáo) / sửa hạn báo cáo kết quả, ghi chú ----
CREATE FUNCTION "public"."nvq_ky_luu"("p" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := nullif("p" ->> 'id', '')::uuid; v_nam integer := nullif("p" ->> 'nam', '')::integer; v_quy integer := nullif("p" ->> 'quy', '')::integer;
        v_tu date; k "public"."nvq_ky";
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  IF v_id IS NULL THEN
    IF v_nam IS NULL OR v_quy IS NULL OR v_quy NOT BETWEEN 1 AND 4 OR v_nam NOT BETWEEN 2025 AND 2100 THEN
      RAISE EXCEPTION 'Chọn năm và quý.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM "public"."nvq_ky" WHERE "nam" = v_nam AND "quy" = v_quy) THEN
      RAISE EXCEPTION 'Đã có Quý % năm %.', "public"."nvq_la_ma"(v_quy), v_nam USING ERRCODE = '22023';
    END IF;
    v_tu := make_date(v_nam, 3 * v_quy - 2, 1);
    INSERT INTO "public"."nvq_ky" ("nam", "quy", "tu_ngay", "den_ngay", "han_bao_cao_ket_qua", "ghi_chu", "tao_boi")
    VALUES (v_nam, v_quy, v_tu, (v_tu + interval '3 months' - interval '1 day')::date, nullif("p" ->> 'han_bao_cao_ket_qua', '')::date,
            nullif(btrim(coalesce("p" ->> 'ghi_chu', '')), ''), "auth"."uid"())
    RETURNING "id" INTO v_id;
    PERFORM "public"."nvq_tao_tuan"(v_id);
    PERFORM "public"."nvq_ghi_lich_su"(NULL, v_id, 'tao_ky', format('Tạo Quý %s năm %s', "public"."nvq_la_ma"(v_quy), v_nam));
  ELSE
    k := "public"."nvq_ky_mo"(v_id);
    UPDATE "public"."nvq_ky" SET
      "han_bao_cao_ket_qua" = CASE WHEN "p" ? 'han_bao_cao_ket_qua' THEN nullif("p" ->> 'han_bao_cao_ket_qua', '')::date ELSE "han_bao_cao_ket_qua" END,
      "ghi_chu" = CASE WHEN "p" ? 'ghi_chu' THEN nullif(btrim(coalesce("p" ->> 'ghi_chu', '')), '') ELSE "ghi_chu" END
    WHERE "id" = v_id;
    PERFORM "public"."nvq_ghi_lich_su"(NULL, v_id, 'sua_ky', 'Sửa thông tin quý (hạn báo cáo kết quả, ghi chú)');
  END IF;
  RETURN v_id;
END;
$$;

-- ---- 2. Văn bản căn cứ (kế hoạch, văn bản điều chỉnh danh mục) ----
CREATE FUNCTION "public"."nvq_van_ban_luu"("p" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := nullif("p" ->> 'id', '')::uuid; v_ky uuid; v_so text := btrim(coalesce("p" ->> 'so_ky_hieu', ''));
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  v_ky := coalesce((SELECT "ky_id" FROM "public"."nvq_van_ban" WHERE "id" = v_id), nullif("p" ->> 'ky_id', '')::uuid);
  PERFORM "public"."nvq_ky_mo"(v_ky);
  IF v_so = '' THEN RAISE EXCEPTION 'Ghi số, ký hiệu văn bản.' USING ERRCODE = '22023'; END IF;
  IF coalesce("p" ->> 'loai', 'KE_HOACH') NOT IN ('KE_HOACH', 'DIEU_CHINH', 'KHAC') THEN RAISE EXCEPTION 'Loại văn bản không hợp lệ.' USING ERRCODE = '22023'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO "public"."nvq_van_ban" ("ky_id", "loai", "so_ky_hieu", "ngay", "trich_yeu", "tao_boi")
    VALUES (v_ky, coalesce("p" ->> 'loai', 'KE_HOACH'), v_so, nullif("p" ->> 'ngay', '')::date, nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), ''), "auth"."uid"())
    RETURNING "id" INTO v_id;
  ELSE
    UPDATE "public"."nvq_van_ban" SET "loai" = coalesce("p" ->> 'loai', "loai"), "so_ky_hieu" = v_so, "ngay" = nullif("p" ->> 'ngay', '')::date,
      "trich_yeu" = nullif(btrim(coalesce("p" ->> 'trich_yeu', '')), '') WHERE "id" = v_id;
  END IF;
  PERFORM "public"."nvq_ghi_lich_su"(NULL, v_ky, 'van_ban', format('Văn bản căn cứ: %s', v_so));
  RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."nvq_van_ban_xoa"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nvq_van_ban"; v_so integer;
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO v FROM "public"."nvq_van_ban" WHERE "id" = "p_id";
  IF v."id" IS NULL THEN RETURN; END IF;
  PERFORM "public"."nvq_ky_mo"(v."ky_id");
  SELECT count(*) INTO v_so FROM "public"."nvq_nhiem_vu" WHERE "dieu_chinh_van_ban" = v."id";
  IF v_so > 0 THEN RAISE EXCEPTION 'Văn bản đang là căn cứ điều chỉnh của % nhiệm vụ — không xoá được.', v_so USING ERRCODE = '22023'; END IF;
  DELETE FROM "public"."nvq_van_ban" WHERE "id" = v."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, v."ky_id", 'van_ban', format('Xoá văn bản căn cứ: %s', v."so_ky_hieu"));
END;
$$;

-- ---- 3. Nhiệm vụ: thêm / sửa thông tin giao (đầu mối) ----
CREATE FUNCTION "public"."nvq_nhiem_vu_luu"("p" jsonb, "p_ly_do" text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid := nullif("p" ->> 'id', '')::uuid; v "public"."nvq_nhiem_vu"; v_cu jsonb; v_moi jsonb; v_doi jsonb; v_ky uuid; v_ly text;
        v_truong text[] := ARRAY['truc_so', 'nhom', 'stt', 'noi_dung', 'lanh_dao_text', 'lanh_dao_ma', 'don_vi_text', 'don_vi', 'ket_qua_can_dat', 'tien_do_text', 'tinh_chat'];
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  PERFORM "public"."nvq_kiem_danh_muc"(CASE WHEN "p" ? 'lanh_dao_ma' THEN ARRAY(SELECT jsonb_array_elements_text("p" -> 'lanh_dao_ma')) END, "p" -> 'don_vi');
  IF v_id IS NULL THEN
    v_ky := nullif("p" ->> 'ky_id', '')::uuid;
    PERFORM "public"."nvq_ky_mo"(v_ky);
    v_ly := "public"."nvq_ly_do"("p_ly_do", false);
    INSERT INTO "public"."nvq_nhiem_vu" ("ky_id", "truc_so", "nhom", "stt", "noi_dung", "lanh_dao_text", "lanh_dao_ma", "don_vi_text", "don_vi",
                                         "ket_qua_can_dat", "tien_do_text", "tinh_chat", "tao_boi")
    VALUES (v_ky, ("p" ->> 'truc_so')::smallint, "p" ->> 'nhom',
            coalesce(nullif("p" ->> 'stt', '')::smallint, (SELECT coalesce(max("stt"), 0) + 1 FROM "public"."nvq_nhiem_vu"
              WHERE "ky_id" = v_ky AND "truc_so" = ("p" ->> 'truc_so')::smallint AND "nhom" = "p" ->> 'nhom')),
            btrim("p" ->> 'noi_dung'), nullif(btrim(coalesce("p" ->> 'lanh_dao_text', '')), ''),
            coalesce(ARRAY(SELECT jsonb_array_elements_text("p" -> 'lanh_dao_ma')), '{}'), nullif(btrim(coalesce("p" ->> 'don_vi_text', '')), ''),
            coalesce("p" -> 'don_vi', '[]'), nullif(btrim(coalesce("p" ->> 'ket_qua_can_dat', '')), ''), nullif(btrim(coalesce("p" ->> 'tien_do_text', '')), ''),
            coalesce(nullif("p" ->> 'tinh_chat', ''), 'CO_MOC'), "auth"."uid"())
    RETURNING * INTO v;
    PERFORM "public"."nvq_ghi_lich_su"(v."id", v_ky, 'them_nhiem_vu', concat_ws(' — lý do: ', 'Thêm nhiệm vụ vào danh mục', v_ly));
    RETURN v."id";
  END IF;
  SELECT * INTO v FROM "public"."nvq_nhiem_vu" WHERE "id" = v_id FOR UPDATE;
  IF v."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nvq_ky_mo"(v."ky_id");
  v_cu := to_jsonb(v);
  UPDATE "public"."nvq_nhiem_vu" SET
    "truc_so" = CASE WHEN "p" ? 'truc_so' THEN ("p" ->> 'truc_so')::smallint ELSE "truc_so" END,
    "nhom" = CASE WHEN "p" ? 'nhom' THEN "p" ->> 'nhom' ELSE "nhom" END,
    "stt" = CASE WHEN "p" ? 'stt' THEN ("p" ->> 'stt')::smallint ELSE "stt" END,
    "noi_dung" = CASE WHEN "p" ? 'noi_dung' THEN btrim("p" ->> 'noi_dung') ELSE "noi_dung" END,
    "lanh_dao_text" = CASE WHEN "p" ? 'lanh_dao_text' THEN nullif(btrim(coalesce("p" ->> 'lanh_dao_text', '')), '') ELSE "lanh_dao_text" END,
    "lanh_dao_ma" = CASE WHEN "p" ? 'lanh_dao_ma' THEN coalesce(ARRAY(SELECT jsonb_array_elements_text("p" -> 'lanh_dao_ma')), '{}') ELSE "lanh_dao_ma" END,
    "don_vi_text" = CASE WHEN "p" ? 'don_vi_text' THEN nullif(btrim(coalesce("p" ->> 'don_vi_text', '')), '') ELSE "don_vi_text" END,
    "don_vi" = CASE WHEN "p" ? 'don_vi' THEN coalesce("p" -> 'don_vi', '[]') ELSE "don_vi" END,
    "ket_qua_can_dat" = CASE WHEN "p" ? 'ket_qua_can_dat' THEN nullif(btrim(coalesce("p" ->> 'ket_qua_can_dat', '')), '') ELSE "ket_qua_can_dat" END,
    "tien_do_text" = CASE WHEN "p" ? 'tien_do_text' THEN nullif(btrim(coalesce("p" ->> 'tien_do_text', '')), '') ELSE "tien_do_text" END,
    "tinh_chat" = CASE WHEN "p" ? 'tinh_chat' THEN coalesce(nullif("p" ->> 'tinh_chat', ''), 'CO_MOC') ELSE "tinh_chat" END,
    "sua_luc" = now()
  WHERE "id" = v_id RETURNING * INTO v;
  v_moi := to_jsonb(v);
  SELECT jsonb_object_agg(k, jsonb_build_object('cu', v_cu -> k, 'moi', v_moi -> k)) INTO v_doi FROM unnest(v_truong) k WHERE (v_cu -> k) IS DISTINCT FROM (v_moi -> k);
  IF v_doi IS NULL THEN RETURN v_id; END IF;
  v_ly := "public"."nvq_ly_do"("p_ly_do");
  PERFORM "public"."nvq_ghi_lich_su"(v_id, v."ky_id", 'sua_nhiem_vu',
    format('Sửa %s — lý do: %s', (SELECT string_agg("public"."nvq_ten_truong"(k), ', ') FROM jsonb_object_keys(v_doi) k), v_ly), v_doi);
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Vị trí (trục, nhóm, Stt) này đã có nhiệm vụ khác trong quý — chọn Stt khác.' USING ERRCODE = '22023';
END;
$$;
CREATE FUNCTION "public"."nvq_nhiem_vu_xoa"("p_id" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nvq_nhiem_vu"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  PERFORM "public"."nvq_can_quan_ly"();
  SELECT * INTO v FROM "public"."nvq_nhiem_vu" WHERE "id" = "p_id" FOR UPDATE;
  IF v."id" IS NULL THEN RETURN; END IF;
  PERFORM "public"."nvq_ky_mo"(v."ky_id");
  IF EXISTS (SELECT 1 FROM "public"."nvq_cap_nhat" WHERE "nhiem_vu_id" = v."id") OR EXISTS (SELECT 1 FROM "public"."nvq_y_kien" WHERE "nhiem_vu_id" = v."id")
     OR EXISTS (SELECT 1 FROM "public"."nvq_tep" WHERE "nhiem_vu_id" = v."id") THEN
    RAISE EXCEPTION 'Nhiệm vụ đã có cập nhật, ý kiến hoặc tệp — dùng "Rút khỏi danh mục" thay cho xoá.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM "public"."nvq_nhiem_vu" WHERE "id" = v."id";
  PERFORM "public"."nvq_ghi_lich_su"(NULL, v."ky_id", 'xoa_nhiem_vu', format('Xoá nhiệm vụ %s (%s) — lý do: %s', v."ma", left(v."noi_dung", 120), v_ly));
END;
$$;
