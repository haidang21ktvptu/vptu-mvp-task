-- 0111 (v3.25): tự học từ thao tác của người giao, tự kiểm quy tắc trên dữ liệu đã có, gắn hàng loạt ở màn rà soát.
-- 1. ghi_phan_hoi_goi_y(việc, ds): khi lưu (giao việc / ngăn chi tiết / rà soát) giao diện gửi kết quả từng gợi ý đã hiện: GIU (tích sẵn được giữ),
--    BO (tích sẵn bị bỏ), THEM (gợi ý được bấm thêm), BO_QUA (gợi ý không chọn). Một việc × một quy tắc một dòng (ghi lại thì thay, bộ đếm trừ kết quả
--    cũ). Quyền như gan_muc_tieu. Chỉ nhận quy tắc thật sự khớp việc (bộ nhận diện chạy lại trên dữ liệu đã lưu), mức khớp loại phản hồi (GIU / BO
--    cho quy tắc tích sẵn, THEM / BO_QUA cho quy tắc gợi ý), mỗi mục ≤ 20 quy tắc; phản hồi cũ hơn mốc dem_tu (bộ đếm đặt lại) tính như lần hiện mới.
--    Sau mỗi lần ghi, kl_tu_dieu_chinh_quy_tac (trừ quy tắc khoá, số hiệu, loại trừ): đủ goi_y_so_lan_xet lần hiện —
--    gợi ý được nhận ≥ goi_y_nang_phan_tram % → tự nâng thành tích sẵn; tích sẵn được giữ < goi_y_ha_phan_tram % → tự hạ thành gợi ý; gợi ý được nhận
--    < goi_y_tat_phan_tram % sau ít nhất 30 lần → tự tắt. Đổi mức thì đếm lại từ đầu (không lẫn thước đo hai mức); ghi dm_lich_su (người: tự động).
--    Ngưỡng ở kl_cau_hinh (Quản trị › Ngưỡng cảnh báo — qt_dat_cau_hinh).
-- 2. kl_kiem_thu_quy_tac(id): chạy quy tắc trên mọi việc gốc — tổng, số khớp, số khớp đã có mục tiêu (đã người xác nhận), số trong đó đúng mục tiêu
--    của quy tắc. Quy tắc DE_XUAT (AI soạn — 0112): khớp > 15% số việc (khi có ≥ 20 việc) → tắt "quá rộng"; có ≥ 3 việc đã xác nhận mà đúng < 50% →
--    tắt "trái với việc đã gắn"; còn lại bật ở mức gợi ý. kiem_thu_quy_tac: quản trị xem kết quả (không đổi gì).
-- 3. gan_muc_tieu_hang_loat([{ id, ma, nguon }]): gọi gan_muc_tieu từng việc (cùng quyền); mục MỚI không khai nguồn → RA_SOAT (mục của văn bản: nguồn
--    của văn bản — gan_muc_tieu chép), mục đã gắn từ trước không khai nguồn giữ nguồn cũ (không ghi đè EXCEL, AI… thành RA_SOAT); việc lỗi không chặn
--    việc khác.
-- 4. goi_y_muc_tieu_ds(mảng đầu vào như goi_y_muc_tieu, ≤ 500): kết quả cùng thứ tự — bản xem trước nhập Excel hiện "dự kiến" cho dòng không ghi
--    mục tiêu (trigger nhập Excel tự gắn theo cùng bộ nhận diện — 0110). SECURITY INVOKER: văn bản đọc theo RLS.

INSERT INTO "public"."kl_cau_hinh" ("khoa", "gia_tri", "mo_ta") VALUES
  ('goi_y_so_lan_xet', '20', 'Gợi ý mục tiêu then chốt: số lần hiện tối thiểu trước khi hệ thống tự nâng / hạ mức một quy tắc'),
  ('goi_y_nang_phan_tram', '90', 'Gợi ý mục tiêu then chốt: tỷ lệ được chấp nhận (%) để tự nâng quy tắc gợi ý thành tích sẵn'),
  ('goi_y_ha_phan_tram', '80', 'Gợi ý mục tiêu then chốt: tích sẵn được giữ dưới tỷ lệ này (%) thì tự hạ thành gợi ý'),
  ('goi_y_tat_phan_tram', '5', 'Gợi ý mục tiêu then chốt: gợi ý được chấp nhận dưới tỷ lệ này (%) sau 30 lần thì tự tắt')
ON CONFLICT ("khoa") DO NOTHING;

CREATE FUNCTION "public"."kl_nguong_goi_y"("p_khoa" text, "p_mac_dinh" integer) RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN "gia_tri" ~ '^[0-9]{1,4}$' THEN "gia_tri"::integer END FROM "public"."kl_cau_hinh" WHERE "khoa" = "p_khoa"), "p_mac_dinh");
$$;

CREATE FUNCTION "public"."kl_tu_dieu_chinh_quy_tac"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE q "public"."quy_tac_muc_tieu"; n integer := "public"."kl_nguong_goi_y"('goi_y_so_lan_xet', 20); v_moi text; v_tt text; v_ly text;
BEGIN
  SELECT * INTO q FROM "public"."quy_tac_muc_tieu" WHERE "id" = "p_id" FOR UPDATE;
  IF q."id" IS NULL OR q."khoa" OR q."trang_thai" <> 'BAT' OR q."loai" IN ('SO_HIEU', 'LOAI_TRU') OR q."so_lan_hien" < n THEN RETURN; END IF;
  IF q."muc" = 'TU_TICH' AND q."so_lan_nhan" * 100 < "public"."kl_nguong_goi_y"('goi_y_ha_phan_tram', 80) * q."so_lan_hien" THEN
    v_moi := 'GOI_Y'; v_ly := format('Tự hạ thành gợi ý: tích sẵn được giữ %s/%s lần', q."so_lan_nhan", q."so_lan_hien");
  ELSIF q."muc" = 'GOI_Y' AND q."so_lan_hien" >= greatest(n, 30) AND q."so_lan_nhan" * 100 < "public"."kl_nguong_goi_y"('goi_y_tat_phan_tram', 5) * q."so_lan_hien" THEN
    v_tt := 'TAT'; v_ly := format('Tự tắt: gợi ý được chấp nhận %s/%s lần', q."so_lan_nhan", q."so_lan_hien");
  ELSIF q."muc" = 'GOI_Y' AND q."so_lan_nhan" * 100 >= "public"."kl_nguong_goi_y"('goi_y_nang_phan_tram', 90) * q."so_lan_hien" THEN
    v_moi := 'TU_TICH'; v_ly := format('Tự nâng thành tích sẵn: gợi ý được chấp nhận %s/%s lần', q."so_lan_nhan", q."so_lan_hien");
  ELSE RETURN;
  END IF;
  UPDATE "public"."quy_tac_muc_tieu" SET "muc" = coalesce(v_moi, "muc"), "trang_thai" = coalesce(v_tt, "trang_thai"),
    "so_lan_hien" = 0, "so_lan_nhan" = 0, "so_lan_bo" = 0, "dem_tu" = now(), "ghi_chu" = left(v_ly, 300), "cap_nhat_luc" = now() WHERE "id" = q."id";
  INSERT INTO "public"."dm_lich_su" ("nguoi", "nguoi_ghi_chu", "bang", "ma", "hanh_dong", "gia_tri_cu", "gia_tri_moi", "ly_do")
  VALUES (NULL, 'tự động', 'quy_tac_muc_tieu', q."id"::text, CASE WHEN v_tt IS NOT NULL THEN 'tat' ELSE 'doi_muc' END,
          jsonb_build_object('muc', q."muc", 'trang_thai', q."trang_thai"), jsonb_build_object('muc', coalesce(v_moi, q."muc"), 'trang_thai', coalesce(v_tt, q."trang_thai")), v_ly);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_nguong_goi_y"(text, integer), "public"."kl_tu_dieu_chinh_quy_tac"(uuid) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."ghi_phan_hoi_goi_y"("p_viec" uuid, "p_ds" jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; vb "public"."van_ban_giao_viec"; e jsonb; x text; q "public"."quy_tac_muc_tieu"; v_kq text; v_cu text; v_n integer := 0;
        v_hop uuid[]; v_da uuid[] := '{}';
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE "id" = "p_viec";
  IF v."id" IS NULL OR "auth"."uid"() IS NULL OR NOT (coalesce("public"."kl_la_tang_giao"(v), false)
       OR (coalesce("public"."me_role"() IN ('A1', 'A2'), false) AND coalesce("public"."kl_lanh_dao_pham_vi"(v."id"), false))) THEN
    RAISE EXCEPTION 'Chỉ người giao việc, người nhập việc hoặc lãnh đạo phụ trách mới ghi kết quả gợi ý.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof("p_ds") IS DISTINCT FROM 'array' OR jsonb_array_length("p_ds") > 60 THEN
    RAISE EXCEPTION 'Danh sách kết quả gợi ý không hợp lệ.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO vb FROM "public"."van_ban_giao_viec" WHERE "id" = v."van_ban_id";
  SELECT coalesce(array_agg(DISTINCT t.id::uuid), '{}') INTO v_hop   -- quy tắc khớp việc theo dữ liệu đã lưu
  FROM jsonb_array_elements("public"."goi_y_muc_tieu"(jsonb_build_object('van_ban_id', v."van_ban_id", 'so_hieu_van_ban', vb."so_ket_luan",
         'trich_yeu', vb."trich_yeu", 'noi_dung', v."noi_dung", 'san_pham_mo_ta', v."san_pham_mo_ta", 'nganh', v."nganh_ma", 'linh_vuc', v."linh_vuc_ma")) -> 'goi_y') g,
       jsonb_array_elements_text(g -> 'quy_tac') t(id);
  FOR e IN SELECT * FROM jsonb_array_elements("p_ds") LOOP
    v_kq := e ->> 'ket_qua';
    CONTINUE WHEN v_kq IS NULL OR v_kq NOT IN ('GIU', 'BO', 'THEM', 'BO_QUA') OR jsonb_typeof(e -> 'quy_tac') IS DISTINCT FROM 'array';
    FOR x IN SELECT t.x FROM jsonb_array_elements_text(e -> 'quy_tac') WITH ORDINALITY AS t(x, i) WHERE t.i <= 20 LOOP
      CONTINUE WHEN x !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR NOT (x::uuid = ANY (v_hop)) OR x::uuid = ANY (v_da);
      SELECT * INTO q FROM "public"."quy_tac_muc_tieu" WHERE "id" = x::uuid FOR UPDATE;
      CONTINUE WHEN q."id" IS NULL OR q."trang_thai" <> 'BAT' OR (q."muc" = 'TU_TICH') <> (v_kq IN ('GIU', 'BO'));   -- mức khớp loại phản hồi
      v_da := v_da || q."id";
      SELECT p."ket_qua" INTO v_cu FROM "public"."phan_hoi_goi_y" p WHERE p."nhiem_vu_id" = v."id" AND p."quy_tac_id" = q."id" AND p."luc" > q."dem_tu";
      CONTINUE WHEN v_cu IS NOT DISTINCT FROM v_kq;
      INSERT INTO "public"."phan_hoi_goi_y" ("nhiem_vu_id", "quy_tac_id", "ket_qua", "nguoi") VALUES (v."id", q."id", v_kq, "auth"."uid"())
      ON CONFLICT ("nhiem_vu_id", "quy_tac_id") DO UPDATE SET "ket_qua" = EXCLUDED."ket_qua", "nguoi" = EXCLUDED."nguoi", "luc" = now();
      UPDATE "public"."quy_tac_muc_tieu" SET
        "so_lan_hien" = "so_lan_hien" + CASE WHEN v_cu IS NULL THEN 1 ELSE 0 END,
        "so_lan_nhan" = greatest(0, "so_lan_nhan" + (CASE WHEN v_kq IN ('GIU', 'THEM') THEN 1 ELSE 0 END) - (CASE WHEN v_cu IN ('GIU', 'THEM') THEN 1 ELSE 0 END)),
        "so_lan_bo" = greatest(0, "so_lan_bo" + (CASE WHEN v_kq = 'BO' THEN 1 ELSE 0 END) - (CASE WHEN v_cu = 'BO' THEN 1 ELSE 0 END))
      WHERE "id" = q."id";
      PERFORM "public"."kl_tu_dieu_chinh_quy_tac"(q."id");
      v_n := v_n + 1;
    END LOOP;
  END LOOP;
  RETURN v_n;
END;
$$;

CREATE FUNCTION "public"."kl_kiem_thu_quy_tac"("p_id" uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (SELECT * FROM "public"."quy_tac_muc_tieu" WHERE "id" = "p_id"),
  viec AS (
    SELECT n."id", n."linh_vuc_ma", n."nganh_ma", concat_ws(E'\n', vb."trich_yeu", n."noi_dung", n."san_pham_mo_ta") AS tho,
           ' ' || "public"."kl_chuan_chu"(concat_ws(' ', vb."trich_yeu", n."noi_dung", n."san_pham_mo_ta")) || ' ' AS t,
           coalesce(nullif(ARRAY(SELECT m."muc_tieu_ma" FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = n."id"), '{}'),
                    ARRAY(SELECT v."muc_tieu_ma" FROM "public"."van_ban_muc_tieu" v WHERE v."van_ban_id" = n."van_ban_id")) AS gan
    FROM "public"."nhiem_vu" n LEFT JOIN "public"."van_ban_giao_viec" vb ON vb."id" = n."van_ban_id" WHERE n."nhiem_vu_cha" IS NULL),
  khop AS (
    SELECT v.* FROM viec v, q WHERE CASE q."loai"
      WHEN 'TU_KHOA' THEN position(' ' || q."gia_tri_chuan" || ' ' IN v.t) > 0
      WHEN 'LOAI_TRU' THEN position(' ' || q."gia_tri_chuan" || ' ' IN v.t) > 0
      WHEN 'LINH_VUC' THEN v."linh_vuc_ma" = q."gia_tri"
      WHEN 'NGANH' THEN v."nganh_ma" = q."gia_tri"
      WHEN 'SO_HIEU' THEN EXISTS (SELECT 1 FROM regexp_matches(v.tho, '([0-9]{1,5})\s*[-–—]\s*(NQ|CTr|CTR|KL|CT)\s*/\s*(TW|TU)(?![A-Za-z])', 'g') m
                                  WHERE "public"."kl_khoa_so_hieu"(m[1] || '-' || m[2] || '/' || m[3]) = "public"."kl_khoa_so_hieu"(q."gia_tri"))
      ELSE false END)
  SELECT jsonb_build_object('tong', (SELECT count(*) FROM viec), 'khop', count(*), 'xac_nhan', count(*) FILTER (WHERE cardinality(k.gan) > 0),
                            'dung', count(*) FILTER (WHERE (SELECT q."muc_tieu_ma" FROM q) = ANY (k.gan)))
  FROM khop k;
$$;
REVOKE ALL ON FUNCTION "public"."kl_kiem_thu_quy_tac"(uuid) FROM public, "anon", "authenticated";

-- Áp kết quả tự kiểm cho quy tắc DE_XUAT (gọi từ hàm của trợ lý AI — 0112): trả { tong, khop, xac_nhan, dung, trang_thai, ly_do }.
CREATE FUNCTION "public"."kl_ap_kiem_thu_quy_tac"("p_id" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k jsonb := "public"."kl_kiem_thu_quy_tac"("p_id"); v_tong integer; v_khop integer; v_xn integer; v_dung integer; v_tt text := 'BAT'; v_ly text;
BEGIN
  v_tong := (k ->> 'tong')::integer; v_khop := (k ->> 'khop')::integer; v_xn := (k ->> 'xac_nhan')::integer; v_dung := (k ->> 'dung')::integer;
  IF v_tong >= 20 AND v_khop * 100 > v_tong * 15 THEN v_tt := 'TAT'; v_ly := format('Tự kiểm: quá rộng — khớp %s/%s việc', v_khop, v_tong);
  ELSIF v_xn >= 3 AND v_dung * 2 < v_xn THEN v_tt := 'TAT'; v_ly := format('Tự kiểm: trái với việc đã gắn — đúng %s/%s việc', v_dung, v_xn);
  ELSE v_ly := format('Tự kiểm: bật mức gợi ý — khớp %s/%s việc, đúng %s/%s việc đã gắn', v_khop, v_tong, v_dung, v_xn);
  END IF;
  UPDATE "public"."quy_tac_muc_tieu" SET "trang_thai" = v_tt, "muc" = 'GOI_Y', "ghi_chu" = left(v_ly, 300), "cap_nhat_luc" = now(),
    "so_lan_hien" = 0, "so_lan_nhan" = 0, "so_lan_bo" = 0, "dem_tu" = now() WHERE "id" = "p_id" AND "trang_thai" = 'DE_XUAT';
  RETURN k || jsonb_build_object('trang_thai', v_tt, 'ly_do', v_ly);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ap_kiem_thu_quy_tac"(uuid) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."kiem_thu_quy_tac"("p_id" uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF "public"."kl_quyen_muc_tieu"() IS DISTINCT FROM 'QUAN_TRI' THEN
    RAISE EXCEPTION 'Chỉ quản trị hệ thống mới thử quy tắc trên dữ liệu.' USING ERRCODE = '42501';
  END IF;
  RETURN "public"."kl_kiem_thu_quy_tac"("p_id");
END;
$$;

CREATE FUNCTION "public"."gan_muc_tieu_hang_loat"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE e jsonb; v_ok integer := 0; v_loi jsonb := '[]'; v_ma text[]; v_ng jsonb;
BEGIN
  IF jsonb_typeof("p") IS DISTINCT FROM 'array' OR jsonb_array_length("p") > 200 THEN
    RAISE EXCEPTION 'Mỗi lượt tối đa 200 việc.' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT * FROM jsonb_array_elements("p") LOOP
    BEGIN
      SELECT coalesce(array_agg(x), '{}') INTO v_ma FROM jsonb_array_elements_text(coalesce(e -> 'ma', '[]')) x;
      SELECT coalesce(jsonb_object_agg(x, coalesce(e -> 'nguon' -> x, jsonb_build_object('nguon', 'RA_SOAT')))
                FILTER (WHERE coalesce(e -> 'nguon', '{}') ? x OR (NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu_muc_tieu" m WHERE m."nhiem_vu_id" = (e ->> 'id')::uuid AND m."muc_tieu_ma" = x)
                  AND NOT EXISTS (SELECT 1 FROM "public"."nhiem_vu" n JOIN "public"."van_ban_muc_tieu" b ON b."van_ban_id" = n."van_ban_id"
                                  WHERE n."id" = (e ->> 'id')::uuid AND b."muc_tieu_ma" = x))), '{}')
        INTO v_ng FROM unnest(v_ma) x;
      PERFORM "public"."gan_muc_tieu"((e ->> 'id')::uuid, v_ma, v_ng);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_loi := v_loi || jsonb_build_array(jsonb_build_object('id', e ->> 'id', 'loi', SQLERRM, 'ma_loi', SQLSTATE));
    END;
  END LOOP;
  RETURN jsonb_build_object('ok', v_ok, 'loi', v_loi);
END;
$$;

CREATE FUNCTION "public"."goi_y_muc_tieu_ds"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE e jsonb; v jsonb := '[]';
BEGIN
  IF jsonb_typeof("p") IS DISTINCT FROM 'array' OR jsonb_array_length("p") > 500 THEN
    RAISE EXCEPTION 'Mỗi lượt tối đa 500 dòng.' USING ERRCODE = '22023';
  END IF;
  FOR e IN SELECT t.x FROM jsonb_array_elements("p") WITH ORDINALITY AS t(x, i) ORDER BY t.i LOOP
    v := v || jsonb_build_array("public"."goi_y_muc_tieu"(CASE WHEN jsonb_typeof(e) = 'object' THEN e ELSE '{}'::jsonb END));
  END LOOP;
  RETURN v;
END;
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ghi_phan_hoi_goi_y(uuid,jsonb)', 'kiem_thu_quy_tac(uuid)', 'gan_muc_tieu_hang_loat(jsonb)', 'goi_y_muc_tieu_ds(jsonb)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
