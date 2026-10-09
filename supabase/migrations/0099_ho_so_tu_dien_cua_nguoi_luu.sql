-- 0099 (v3.21, chủ dự án duyệt 9/10/2026 — "theo đề xuất"): từ 0096 mọi tài khoản (trừ Thường trực) nhập Excel ⇒ hồ sơ ghép cột và từ điển nhập
-- dùng chung không còn chỉ 2 người giữ. Ai cũng DÙNG được; chỉ người đã lưu (hoặc quản trị hệ thống) GHI ĐÈ / XOÁ cái mình lưu:
-- 1. ho_so_nhap_luu (bản 0072): trùng tên hồ sơ của người khác → báo đặt tên khác (không ghi đè cách ghép của người khác).
-- 2. ho_so_nhap_xoa (bản 0072): chỉ người lưu hoặc quản trị hệ thống.
-- 3. tu_dien_nhap_luu (bản 0072): mục mới ai cũng thêm; mục đã có của người khác mà khác mã → giữ nguyên (không đếm vào số mục đã lưu).

CREATE OR REPLACE FUNCTION "public"."ho_so_nhap_luu"("p_ten" text, "p_ten_sheet" text, "p_dong_tieu_de" integer, "p_anh_xa" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_ten text := btrim(coalesce("p_ten", ''));
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF v_ten = '' OR char_length(v_ten) > 100 THEN RAISE EXCEPTION 'Tên hồ sơ ghép cột từ 1 đến 100 ký tự.' USING ERRCODE = '22023'; END IF;
  IF "p_anh_xa" IS NULL OR jsonb_typeof("p_anh_xa") <> 'object' OR "p_anh_xa" = '{}'::jsonb THEN
    RAISE EXCEPTION 'Hồ sơ phải ghép ít nhất một cột.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each_text("p_anh_xa") e WHERE NOT (e.value = ANY ("public"."kl_truong_nhap"())) OR char_length(e.key) > 200) THEN
    RAISE EXCEPTION 'Hồ sơ có cột ghép vào trường không có trong chuẩn nhập.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."ho_so_nhap" h WHERE h."ten" = v_ten AND h."tao_boi" <> "auth"."uid"())
     AND NOT coalesce("public"."me_quan_tri_he_thong"(), false) THEN   -- 0099
    RAISE EXCEPTION 'Cách ghép "%" do cán bộ khác lưu — đặt tên khác để lưu cách ghép của đồng chí.', v_ten USING ERRCODE = '42501';
  END IF;
  INSERT INTO "public"."ho_so_nhap" ("ten", "ten_sheet", "dong_tieu_de", "anh_xa", "tao_boi")
  VALUES (v_ten, nullif(btrim(coalesce("p_ten_sheet", '')), ''), coalesce("p_dong_tieu_de", 1), "p_anh_xa", "auth"."uid"())
  ON CONFLICT ("ten") DO UPDATE SET "ten_sheet" = EXCLUDED."ten_sheet", "dong_tieu_de" = EXCLUDED."dong_tieu_de", "anh_xa" = EXCLUDED."anh_xa",
    "cap_nhat_luc" = now()   -- 0099: giữ người lưu đầu (quản trị hệ thống sửa hộ không thành chủ hồ sơ)
  RETURNING "id" INTO v_id;
  PERFORM "public"."nhat_ky_ghi"('ho_so_nhap_luu', v_ten, jsonb_build_object('so_cot', (SELECT count(*) FROM jsonb_object_keys("p_anh_xa"))));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."ho_so_nhap_xoa"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ten text;
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF EXISTS (SELECT 1 FROM "public"."ho_so_nhap" h WHERE h."id" = "p_id" AND h."tao_boi" <> "auth"."uid"())
     AND NOT coalesce("public"."me_quan_tri_he_thong"(), false) THEN   -- 0099
    RAISE EXCEPTION 'Chỉ cán bộ đã lưu cách ghép này (hoặc quản trị hệ thống) mới xoá được.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM "public"."ho_so_nhap" WHERE "id" = "p_id" RETURNING "ten" INTO v_ten;
  IF v_ten IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ ghép cột.' USING ERRCODE = '22023'; END IF;
  PERFORM "public"."nhat_ky_ghi"('ho_so_nhap_xoa', v_ten, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."tu_dien_nhap_luu"("p_muc" jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb; v_n integer := 0; v_goc text; v_dong integer; v_qtht boolean := coalesce("public"."me_quan_tri_he_thong"(), false);
BEGIN
  PERFORM "public"."kl_nhap_kiem_quyen"();
  IF "p_muc" IS NULL OR jsonb_typeof("p_muc") <> 'array' OR jsonb_array_length("p_muc") > 500 THEN
    RAISE EXCEPTION 'Danh sách từ điển không hợp lệ (tối đa 500 mục mỗi lần).' USING ERRCODE = '22023';
  END IF;
  FOR m IN SELECT * FROM jsonb_array_elements("p_muc") LOOP
    v_goc := lower(btrim(regexp_replace(coalesce(m ->> 'goc', ''), '\s+', ' ', 'g')));
    IF v_goc = '' OR char_length(v_goc) > 300 OR NOT coalesce("public"."kl_tu_dien_hop_le"(m ->> 'loai', m ->> 'ma'), false) THEN
      RAISE EXCEPTION 'Mục từ điển không hợp lệ: % "%" → %.', m ->> 'loai', left(v_goc, 60), m ->> 'ma' USING ERRCODE = '22023';
    END IF;
    INSERT INTO "public"."tu_dien_nhap" AS t ("loai", "goc", "ma", "tao_boi") VALUES (m ->> 'loai', v_goc, m ->> 'ma', "auth"."uid"())
    ON CONFLICT ("loai", "goc") DO UPDATE SET "ma" = EXCLUDED."ma", "tao_boi" = EXCLUDED."tao_boi", "tao_luc" = now()
      WHERE t."tao_boi" = "auth"."uid"() OR v_qtht;   -- 0099: mục của người khác giữ nguyên
    GET DIAGNOSTICS v_dong = ROW_COUNT;
    v_n := v_n + v_dong;
  END LOOP;
  IF v_n > 0 THEN PERFORM "public"."nhat_ky_ghi"('tu_dien_nhap_luu', NULL, jsonb_build_object('so_muc', v_n)); END IF;
  RETURN v_n;
END;
$$;
