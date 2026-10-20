-- 0118 (v3.27.0 — chủ dự án 20/10/2026): bổ sung dữ liệu chuyển đổi cho các việc đã có trên hệ thống (giai đoạn chuyển đổi; cơ quan trình theo 0117).
-- bo_sung_chuyen_doi(p, p_ly_do, p_ap): CHỈ tài khoản toàn quyền (qt_vptu) — bổ sung dữ liệu chuyển đổi cho việc đã có trên hệ thống, từ hai tệp chủ
--    dự án gửi (20/10/2026: "chỉ duy nhất tệp excel do tôi gửi … giai đoạn chuyển đổi"). p_ap = false: xem trước — chạy thật trong một khối con rồi hoàn
--    tác (bản xem trước báo đúng giá trị sẽ ghi, kể cả hạn do trigger tính và lỗi của trigger); true: ghi. Lý do bắt buộc.
--    p = { viec: [{ ma, co_quan_trinh?, linh_vuc_chi_tiet?, han_xu_ly?, van_ban_trien_khai?, ghi_chu?, ket_qua?, owner_tai_khoan?, nguoi_theo_doi?,
--          ghi_de?: ['owner_tai_khoan' | 'nguoi_theo_doi'] }] (≤ 300), van_ban: [{ so_ket_luan, ngay_ban_hanh, so_hoi_nghi?, loai }] (≤ 20) }.
--    Quy tắc: chỉ điền ô đang trống (ô đã có giá trị giữ nguyên, báo "giữ"); kết quả → minh chứng chữ (chu_cu, như kl_nhap_da_xong) chỉ cho việc đã hoàn
--    thành chưa có minh chứng còn hiệu lực; chủ trì / người theo dõi chỉ đổi khi dòng ghi rõ ghi_de (đơn vị chịu trách nhiệm theo phòng của cán bộ, lãnh
--    đạo Văn phòng → Văn phòng Tỉnh ủy); loại văn bản đổi được cho văn bản ghi trong van_ban (làm trước các việc; sang Kết luận BTV / Thông báo Thường
--    trực thì mọi việc của văn bản phải đủ quy tắc của loại đó — việc theo 1400 có ngành + lĩnh vực, không việc nào ngành "Không thuộc"; trigger 0116
--    chỉ chạy khi sửa việc nên kiểm ở đây). p_ap NULL = xem trước. Không đổi tiến độ, ngày hoàn thành,
--    người / giờ cập nhật cuối (cờ kl.minh_chung_tinh_lai — lô chuyển đổi không làm lệch số liệu "cập nhật trong kỳ"); không gửi tin cho cán bộ. Diễn biến
--    từng việc: trigger lịch sử ghi từng ô cũ → mới, thêm một dòng "Bổ sung dữ liệu chuyển đổi" kèm lý do; nhật ký hệ thống một dòng cho cả lượt.
--    Chủ trì là đơn vị (cột "Chủ trì theo dõi" ghi "VPTU"): owner_tai_khoan để trống + owner_don_vi_ma (Văn phòng Tỉnh ủy / một phòng) trong ghi_de.
--    Kiểm thử: tests/rls/kl-0117-chuyen-doi.test.mjs.

CREATE FUNCTION "public"."kl_ten_loai_van_ban"("p_loai" text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p_loai" WHEN 'KL_BTV' THEN 'Kết luận Hội nghị Ban Thường vụ' WHEN 'TB_THUONG_TRUC' THEN 'Thông báo của Thường trực Tỉnh ủy'
    WHEN 'NQ_TW' THEN 'Nghị quyết Trung ương' WHEN 'KL_BCH' THEN 'Kết luận Ban Chấp hành Đảng bộ tỉnh' WHEN 'NQ_BCH' THEN 'Nghị quyết Ban Chấp hành Đảng bộ tỉnh'
    WHEN 'CONG_VAN' THEN 'Công văn' WHEN 'KHAC' THEN 'Văn bản khác' ELSE "p_loai" END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_ten_loai_van_ban"(text) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."kl_ten_loai_van_ban"(text) TO "authenticated";

-- Phần làm (gọi từ bo_sung_chuyen_doi — không cấp cho người dùng): đổi loại văn bản, rồi từng việc trong khối riêng (lỗi một dòng không dừng cả lượt).
CREATE FUNCTION "public"."kl_bo_sung_chuyen_doi_lam"("p" jsonb, "p_ly" text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  x jsonb; v "public"."nhiem_vu"; w "public"."nhiem_vu"; b "public"."van_ban_giao_viec"; v_tk "public"."accounts"; v_me uuid := "auth"."uid"();
  v_ds_viec jsonb := '[]'::jsonb; v_ds_vb jsonb := '[]'::jsonb; v_loi text; v_ma text; v_doi jsonb; v_giu text[]; v_bo text[]; v_ghi_de text[];
  v_s text; v_dv text; v_kq text; v_mc boolean; v_loai text; v_so int; v_n int; k text; v_so_doi int := 0; v_so_loi int := 0; v_han date;
BEGIN
  -- (a) Loại văn bản — trước các việc
  FOR x IN SELECT e FROM jsonb_array_elements(coalesce("p" -> 'van_ban', '[]'::jsonb)) e LOOP
    b := NULL; v_loi := NULL; v_so := 0; v_loai := upper(btrim(coalesce(CASE WHEN jsonb_typeof(x) = 'object' THEN x ->> 'loai' END, '')));
    BEGIN
      IF v_loai NOT IN ('KL_BTV', 'TB_THUONG_TRUC', 'NQ_TW', 'NQ_BCH', 'KL_BCH', 'CONG_VAN', 'KHAC') THEN
        RAISE EXCEPTION 'Loại văn bản "%" không hợp lệ.', x ->> 'loai' USING ERRCODE = '22023';
      END IF;
      SELECT count(*) INTO v_so FROM "public"."van_ban_giao_viec" g WHERE g."so_ket_luan" = btrim(x ->> 'so_ket_luan')
        AND g."ngay_ban_hanh" = (x ->> 'ngay_ban_hanh')::date AND (nullif(x ->> 'so_hoi_nghi', '') IS NULL OR g."so_hoi_nghi" = (x ->> 'so_hoi_nghi')::integer);
      IF v_so <> 1 THEN
        RAISE EXCEPTION '%', CASE WHEN v_so = 0 THEN format('Không có văn bản %s ngày %s trên hệ thống.', x ->> 'so_ket_luan', x ->> 'ngay_ban_hanh')
          ELSE format('Có %s văn bản %s ngày %s — ghi thêm số hội nghị.', v_so, x ->> 'so_ket_luan', x ->> 'ngay_ban_hanh') END USING ERRCODE = '22023';
      END IF;
      SELECT * INTO b FROM "public"."van_ban_giao_viec" g WHERE g."so_ket_luan" = btrim(x ->> 'so_ket_luan')
        AND g."ngay_ban_hanh" = (x ->> 'ngay_ban_hanh')::date AND (nullif(x ->> 'so_hoi_nghi', '') IS NULL OR g."so_hoi_nghi" = (x ->> 'so_hoi_nghi')::integer) FOR UPDATE;
      SELECT count(*) INTO v_so FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = b."id";
      IF b."loai" <> v_loai AND v_loai IN ('KL_BTV', 'TB_THUONG_TRUC') THEN   -- quy tắc việc của kết luận / thông báo (giao_viec, kl_thay_doi_giao, trigger 0116)
        SELECT count(*) INTO v_n FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = b."id"
          AND (n."nganh_ma" = 'KHONG_THUOC' OR (n."theo_1400" AND (n."nganh_ma" IS NULL OR n."linh_vuc_ma" IS NULL)));
        IF v_n > 0 THEN
          RAISE EXCEPTION 'Văn bản có % việc chưa có ngành, lĩnh vực cụ thể — kết luận / thông báo phải có; bổ sung trước khi đổi loại.', v_n USING ERRCODE = '22023';
        END IF;
      END IF;
      IF b."loai" <> v_loai THEN
        UPDATE "public"."van_ban_giao_viec" SET "loai" = v_loai WHERE "id" = b."id";   -- CHECK của bảng: Kết luận BTV phải có số hội nghị
        INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_cu", "gia_tri_moi", "nguon")
        SELECT n."id", v_me, 'bo_sung_chuyen_doi', 'Loại văn bản: ' || "public"."kl_ten_loai_van_ban"(b."loai"),
               format('Loại văn bản: %s — bổ sung dữ liệu chuyển đổi, lý do: %s', "public"."kl_ten_loai_van_ban"(v_loai), "p_ly"), 'excel'
        FROM "public"."nhiem_vu" n WHERE n."van_ban_id" = b."id";
      END IF;
    EXCEPTION WHEN OTHERS THEN v_loi := SQLERRM;
    END;
    v_ds_vb := v_ds_vb || jsonb_build_array(jsonb_build_object('so_ket_luan', x ->> 'so_ket_luan', 'ngay_ban_hanh', x ->> 'ngay_ban_hanh',
      'ket_qua', CASE WHEN v_loi IS NOT NULL THEN 'LOI' WHEN b."loai" <> v_loai THEN 'DOI' ELSE 'GIU' END, 'loi', v_loi,
      'cu', b."loai", 'moi', CASE WHEN v_loi IS NULL THEN v_loai END, 'so_viec', CASE WHEN v_loi IS NULL THEN v_so END));
  END LOOP;
  -- (b) Từng việc
  FOR x IN SELECT e FROM jsonb_array_elements(coalesce("p" -> 'viec', '[]'::jsonb)) e LOOP
    v := NULL; w := NULL; v_loi := NULL; v_doi := '{}'::jsonb; v_giu := '{}'; v_bo := '{}'; v_mc := false; v_kq := NULL;
    v_ma := upper(btrim(coalesce(CASE WHEN jsonb_typeof(x) = 'object' THEN x ->> 'ma' END, '')));
    BEGIN
      IF v_ma = '' THEN RAISE EXCEPTION 'Dòng không có mã nhiệm vụ.' USING ERRCODE = '22023'; END IF;
      SELECT * INTO v FROM "public"."nhiem_vu" n WHERE upper(n."ma") = v_ma FOR UPDATE;
      IF v."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ % trên hệ thống.', v_ma USING ERRCODE = '22023'; END IF;
      v_ghi_de := ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(x -> 'ghi_de') = 'array' THEN x -> 'ghi_de' ELSE '[]'::jsonb END));
      -- Cơ quan trình (danh mục)
      v_s := nullif(btrim(coalesce(x ->> 'co_quan_trinh', '')), '');
      IF v_s IS NOT NULL THEN
        IF NOT "public"."kl_co_quan_trinh_hop_le"(v_s) THEN
          RAISE EXCEPTION 'Cơ quan trình "%" không có trong danh mục (đơn vị ngoài Văn phòng hoặc Văn phòng Tỉnh ủy).', v_s USING ERRCODE = '22023';
        END IF;
        IF v."co_quan_trinh" IS NULL THEN v_doi := v_doi || jsonb_build_object('co_quan_trinh', v_s);
        ELSIF v."co_quan_trinh" <> v_s THEN v_giu := v_giu || 'co_quan_trinh'::text; END IF;
      END IF;
      -- Ô chữ
      FOREACH k IN ARRAY ARRAY['linh_vuc_chi_tiet', 'van_ban_trien_khai', 'ghi_chu'] LOOP
        v_s := left(nullif(btrim(coalesce(x ->> k, '')), ''), 1000);
        CONTINUE WHEN v_s IS NULL;
        IF nullif(btrim(coalesce(to_jsonb(v) ->> k, '')), '') IS NULL THEN v_doi := v_doi || jsonb_build_object(k, v_s);
        ELSIF btrim(to_jsonb(v) ->> k) <> v_s THEN v_giu := v_giu || k; END IF;
      END LOOP;
      -- Hạn: chỉ khi trống ("Ký ban hành": trigger tính lại theo ngày ban hành — bản xem trước hiện đúng ngày sẽ ghi)
      v_s := nullif(btrim(coalesce(x ->> 'han_xu_ly', '')), '');
      IF v_s IS NOT NULL THEN
        v_han := NULL;
        IF v_s ~ '^\d{4}-\d{2}-\d{2}$' THEN BEGIN v_han := v_s::date; EXCEPTION WHEN OTHERS THEN v_han := NULL; END; END IF;
        IF v_han IS NULL THEN RAISE EXCEPTION 'Hạn "%" không phải ngày hợp lệ (năm-tháng-ngày).', v_s USING ERRCODE = '22023'; END IF;
        IF v."han_xu_ly" IS NULL THEN v_doi := v_doi || jsonb_build_object('han_xu_ly', v_han);
        ELSIF v."han_xu_ly" <> v_han THEN v_giu := v_giu || 'han_xu_ly'::text; END IF;
      END IF;
      -- Chủ trì, người theo dõi: chỉ khi ghi_de. Chủ trì là đơn vị (Văn phòng Tỉnh ủy / một phòng — cột "Chủ trì theo dõi" ghi "VPTU"): owner_tai_khoan
      -- để trống + owner_don_vi_ma.
      IF 'owner_tai_khoan' = ANY (v_ghi_de) AND nullif(x ->> 'owner_tai_khoan', '') IS NULL THEN
        v_dv := nullif(btrim(coalesce(x ->> 'owner_don_vi_ma', '')), '');
        IF v_dv IS NULL OR NOT EXISTS (SELECT 1 FROM "public"."dm_don_vi" d WHERE d."ma" = v_dv AND d."trong_van_phong") THEN
          RAISE EXCEPTION 'Chủ trì không là cán bộ thì phải là Văn phòng Tỉnh ủy hoặc một phòng của Văn phòng.' USING ERRCODE = '22023';
        END IF;
        IF v."owner_tai_khoan" IS NOT NULL OR v_dv IS DISTINCT FROM v."owner_don_vi_ma" THEN
          v_doi := v_doi || jsonb_build_object('owner_tai_khoan', NULL, 'owner_don_vi_ma', v_dv);
        END IF;
      ELSIF 'owner_tai_khoan' = ANY (v_ghi_de) THEN
        SELECT * INTO v_tk FROM "public"."accounts" a WHERE a."id" = nullif(x ->> 'owner_tai_khoan', '')::uuid;
        IF v_tk."id" IS NULL OR v_tk."is_system" OR v_tk."role_group" NOT IN ('A1', 'A2', 'A3') THEN
          RAISE EXCEPTION 'Người chủ trì phải là một cán bộ Văn phòng.' USING ERRCODE = '22023';
        END IF;
        v_dv := coalesce((SELECT d."ma" FROM "public"."dm_don_vi" d WHERE d."trong_van_phong" AND d."phong" = v_tk."department" ORDER BY d."thu_tu" LIMIT 1),
                         CASE WHEN v_tk."role_group" = 'A1' THEN 'VAN_PHONG_TINH_UY' END);
        IF v_dv IS NULL THEN RAISE EXCEPTION 'Chưa có đơn vị của phòng % trong danh mục.', v_tk."department" USING ERRCODE = '22023'; END IF;
        IF v_tk."id" IS DISTINCT FROM v."owner_tai_khoan" OR v_dv IS DISTINCT FROM v."owner_don_vi_ma" THEN
          v_doi := v_doi || jsonb_build_object('owner_tai_khoan', v_tk."id", 'owner_don_vi_ma', v_dv);
        END IF;
      END IF;
      IF 'nguoi_theo_doi' = ANY (v_ghi_de) THEN
        SELECT * INTO v_tk FROM "public"."accounts" a WHERE a."id" = nullif(x ->> 'nguoi_theo_doi', '')::uuid;
        IF v_tk."id" IS NULL OR v_tk."is_system" OR v_tk."role_group" NOT IN ('A1', 'A2', 'A3') THEN
          RAISE EXCEPTION 'Người theo dõi phải là một cán bộ Văn phòng.' USING ERRCODE = '22023';
        END IF;
        IF v_tk."id" IS DISTINCT FROM v."nguoi_theo_doi" THEN v_doi := v_doi || jsonb_build_object('nguoi_theo_doi', v_tk."id"); END IF;
      END IF;
      -- Kết quả → minh chứng chữ: việc đã hoàn thành, chưa có minh chứng còn hiệu lực
      v_kq := left(nullif(btrim(coalesce(x ->> 'ket_qua', '')), ''), 2000);
      IF v_kq IS NOT NULL THEN
        IF v."tien_do_ma" <> 'HOAN_THANH' THEN v_bo := v_bo || 'ket_qua'::text;   -- việc đang làm: kết quả do chủ trì nộp minh chứng
        ELSIF EXISTS (SELECT 1 FROM "public"."minh_chung" m WHERE m."nhiem_vu_id" = v."id" AND m."hop_le" IS DISTINCT FROM false) THEN v_giu := v_giu || 'ket_qua'::text;
        ELSE v_mc := true; END IF;
      END IF;
      -- Ghi: tiến độ, ngày hoàn thành, người / giờ cập nhật cuối giữ nguyên; không gửi tin
      IF v_doi <> '{}'::jsonb OR v_mc THEN
        PERFORM set_config('kl.ghi_qua_ham', '1', true); PERFORM set_config('kl.minh_chung_tinh_lai', '1', true);
        UPDATE "public"."nhiem_vu" n SET
          "co_quan_trinh" = CASE WHEN v_doi ? 'co_quan_trinh' THEN v_doi ->> 'co_quan_trinh' ELSE n."co_quan_trinh" END,
          "linh_vuc_chi_tiet" = CASE WHEN v_doi ? 'linh_vuc_chi_tiet' THEN v_doi ->> 'linh_vuc_chi_tiet' ELSE n."linh_vuc_chi_tiet" END,
          "van_ban_trien_khai" = CASE WHEN v_doi ? 'van_ban_trien_khai' THEN v_doi ->> 'van_ban_trien_khai' ELSE n."van_ban_trien_khai" END,
          "ghi_chu" = CASE WHEN v_doi ? 'ghi_chu' THEN v_doi ->> 'ghi_chu' ELSE n."ghi_chu" END,
          "han_xu_ly" = CASE WHEN v_doi ? 'han_xu_ly' THEN (v_doi ->> 'han_xu_ly')::date ELSE n."han_xu_ly" END,
          "owner_tai_khoan" = CASE WHEN v_doi ? 'owner_tai_khoan' THEN (v_doi ->> 'owner_tai_khoan')::uuid ELSE n."owner_tai_khoan" END,
          "owner_don_vi_ma" = CASE WHEN v_doi ? 'owner_don_vi_ma' THEN v_doi ->> 'owner_don_vi_ma' ELSE n."owner_don_vi_ma" END,
          "nguoi_theo_doi" = CASE WHEN v_doi ? 'nguoi_theo_doi' THEN (v_doi ->> 'nguoi_theo_doi')::uuid ELSE n."nguoi_theo_doi" END
        WHERE n."id" = v."id";
        IF v_mc THEN
          INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "noi_dung_chu", "nop_boi") VALUES (v."id", 'chu_cu', v_kq, v_me);
          UPDATE "public"."nhiem_vu" SET "thieu_minh_chung" = "thieu_minh_chung" WHERE "id" = v."id";   -- tính lại cờ thiếu minh chứng (như kl_nhap_da_xong)
        END IF;
        PERFORM set_config('kl.minh_chung_tinh_lai', '', true); PERFORM set_config('kl.ghi_qua_ham', '', true);
        SELECT * INTO w FROM "public"."nhiem_vu" WHERE "id" = v."id";
        INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
        VALUES (v."id", v_me, 'bo_sung_chuyen_doi', format('Bổ sung %s — lý do: %s', concat_ws(', ',
          (SELECT string_agg(CASE c WHEN 'co_quan_trinh' THEN 'cơ quan trình' WHEN 'linh_vuc_chi_tiet' THEN 'lĩnh vực chi tiết' WHEN 'van_ban_trien_khai' THEN 'văn bản triển khai'
             WHEN 'ghi_chu' THEN 'ghi chú' WHEN 'han_xu_ly' THEN 'hạn xử lý' WHEN 'owner_tai_khoan' THEN 'người chủ trì' WHEN 'nguoi_theo_doi' THEN 'người theo dõi' END, ', ')
           FROM jsonb_object_keys(v_doi) c WHERE c <> 'owner_don_vi_ma'),
          CASE WHEN v_mc THEN 'kết quả (minh chứng chữ)' END), "p_ly"), 'excel');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_loi := SQLERRM; PERFORM set_config('kl.minh_chung_tinh_lai', '', true); PERFORM set_config('kl.ghi_qua_ham', '', true);
    END;
    IF v_loi IS NOT NULL THEN v_so_loi := v_so_loi + 1; ELSIF v_doi <> '{}'::jsonb OR v_mc THEN v_so_doi := v_so_doi + 1; END IF;
    v_ds_viec := v_ds_viec || jsonb_build_array(jsonb_build_object('ma', coalesce(v."ma", nullif(v_ma, '')),
      'ket_qua', CASE WHEN v_loi IS NOT NULL THEN 'LOI' WHEN v_doi <> '{}'::jsonb OR v_mc THEN 'DOI' ELSE 'GIU' END, 'loi', v_loi,
      'da_xong', CASE WHEN v."id" IS NOT NULL THEN v."tien_do_ma" = 'HOAN_THANH' END,
      'cu', CASE WHEN v_loi IS NULL THEN (SELECT coalesce(jsonb_object_agg(c, to_jsonb(v) -> c), '{}'::jsonb) FROM jsonb_object_keys(v_doi) c) END,
      'moi', CASE WHEN v_loi IS NULL THEN (SELECT coalesce(jsonb_object_agg(c, to_jsonb(w) -> c), '{}'::jsonb) FROM jsonb_object_keys(v_doi) c)
                  || CASE WHEN v_mc THEN jsonb_build_object('ket_qua', v_kq) ELSE '{}'::jsonb END END,
      'giu', to_jsonb(v_giu), 'bo_qua', to_jsonb(v_bo)));
  END LOOP;
  RETURN jsonb_build_object('so_viec', jsonb_array_length(coalesce("p" -> 'viec', '[]'::jsonb)), 'so_doi', v_so_doi, 'so_loi', v_so_loi,
    'van_ban', v_ds_vb, 'viec', v_ds_viec);
END;
$$;
REVOKE ALL ON FUNCTION "public"."kl_bo_sung_chuyen_doi_lam"(jsonb, text) FROM public, "anon", "authenticated";

CREATE FUNCTION "public"."bo_sung_chuyen_doi"("p" jsonb, "p_ly_do" text, "p_ap" boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ly text := btrim(coalesce("p_ly_do", '')); v_kq jsonb; v_n_viec int; v_n_vb int; v_ap boolean := coalesce("p_ap", false);   -- NULL = xem trước
BEGIN
  IF "auth"."uid"() IS NULL OR NOT "public"."me_toan_quyen"() THEN
    RAISE EXCEPTION 'Chỉ tài khoản toàn quyền bổ sung dữ liệu chuyển đổi được.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof("p") IS DISTINCT FROM 'object' OR jsonb_typeof(coalesce("p" -> 'viec', '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce("p" -> 'van_ban', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Dữ liệu bổ sung phải có dạng { viec: [...], van_ban: [...] }.' USING ERRCODE = '22023';
  END IF;
  v_n_viec := jsonb_array_length(coalesce("p" -> 'viec', '[]'::jsonb)); v_n_vb := jsonb_array_length(coalesce("p" -> 'van_ban', '[]'::jsonb));
  IF v_n_viec + v_n_vb = 0 THEN RAISE EXCEPTION 'Chưa có dòng nào để bổ sung.' USING ERRCODE = '22023'; END IF;
  IF v_n_viec > 300 THEN RAISE EXCEPTION 'Mỗi lượt bổ sung tối đa 300 việc.' USING ERRCODE = '22023'; END IF;
  IF v_n_vb > 20 THEN RAISE EXCEPTION 'Mỗi lượt đổi loại tối đa 20 văn bản.' USING ERRCODE = '22023'; END IF;
  IF v_ly = '' OR char_length(v_ly) > 500 THEN RAISE EXCEPTION 'Lý do bổ sung bắt buộc, tối đa 500 ký tự.' USING ERRCODE = '22023'; END IF;
  BEGIN
    v_kq := "public"."kl_bo_sung_chuyen_doi_lam"("p", v_ly);
    IF NOT v_ap THEN RAISE EXCEPTION USING ERRCODE = 'KL117', MESSAGE = v_kq::text; END IF;   -- xem trước: hoàn tác mọi thứ khối con vừa ghi
  EXCEPTION WHEN SQLSTATE 'KL117' THEN v_kq := SQLERRM::jsonb;
  END;
  IF v_ap THEN
    PERFORM "public"."nhat_ky_ghi"('bo_sung_chuyen_doi', 'nhiem_vu', jsonb_build_object('ly_do', v_ly, 'so_viec', v_kq -> 'so_viec', 'so_doi', v_kq -> 'so_doi',
      'so_loi', v_kq -> 'so_loi', 'van_ban', v_kq -> 'van_ban'));
  END IF;
  RETURN v_kq || jsonb_build_object('da_ghi', v_ap);
END;
$$;
REVOKE ALL ON FUNCTION "public"."bo_sung_chuyen_doi"(jsonb, text, boolean) FROM public, "anon";
GRANT EXECUTE ON FUNCTION "public"."bo_sung_chuyen_doi"(jsonb, text, boolean) TO "authenticated";
