-- 0074: Nhập Excel toàn trình — hàm nhập theo lô (bảng 0072, giao_viec 0073). Client đọc tệp, ghép cột, chuẩn hoá, đánh giá mức 1/2/3 và cho xem
-- trước; KHÔNG ghi gì cho tới khi người nhập xác nhận. DB là chốt: mọi kiểm tra của giao_viec / trigger vẫn chạy cho từng dòng.
--   nhap_excel_lo_tao(p) → {id, ma}: mở lô (tệp, mẫu, chế độ cho việc đã hoàn thành, số dòng).
--   nhap_excel_dong(p_lo, p_dong) → [{so_dong, ket_qua, nhiem_vu_id, ma, ghi_chu}]: một phần ≤ 100 dòng, client gửi tuần tự (mỗi phần một giao dịch,
--     tránh statement timeout). Dòng đã có trong lô (gửi lại phần cũ) trả kết quả đã lưu. Mỗi dòng một khối con: lỗi → dòng mới vào vùng chờ
--     hoàn thiện kèm lý do, dòng cập nhật → bỏ qua kèm lý do; dòng khác không ảnh hưởng. Đường đi: mã có trên hệ thống → CAP_NHAT; thiếu trường
--     mức 1 (client gửi "thieu") → CHO_HOAN_THIEN; tiến độ Hoàn thành + DA_XONG_NGOAI → DA_XONG (nguon = excel, đóng ngay, KHÔNG ngày hoàn thành ⇒
--     không tính tỷ lệ đúng hạn, kết quả ghi minh chứng chữ); Hoàn thành + CHO_NGHIEM_THU + đủ 4 yếu tố → CHO_NGHIEM_THU (giao như thường +
--     minh chứng chờ lãnh đạo nghiệm thu); còn lại → GIAO (giao_viec với cờ kl.nhap_excel: việc sống, người nhận xác nhận đã nhận, cảnh báo).
--   nhap_excel_lo_xong(p_lo) → số dòng theo kết quả: chốt lô, MỘT tin tổng hợp cho mỗi người chủ trì / theo dõi / được thay mặt.
--   hoan_tac_lo(p_lo) → {hoan_tac, giu_lai}: trong 24 giờ, người tạo lô hoặc quản trị hệ thống. Việc lô tạo mà CHƯA ai thao tác sau khi nhập
--     (lịch sử của người dùng, chỉ đạo, minh chứng, đề nghị từ chối / sửa, việc con) → xoá; việc lô cập nhật → trả giá trị cũ; vùng chờ của lô →
--     DA_HOAN_TAC; văn bản lô tạo không còn việc → xoá. Việc đã có thao tác giữ lại, báo mã.

CREATE FUNCTION "public"."kl_nhap_du_kq"("d" jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim("d" ->> 'kq_so_hieu'), '') IS NOT NULL AND nullif("d" ->> 'kq_ngay', '') IS NOT NULL
     AND nullif(btrim("d" ->> 'kq_trich_yeu'), '') IS NOT NULL AND nullif(btrim("d" ->> 'kq_mo_ta'), '') IS NOT NULL;
$$;

-- Văn bản của dòng: tìm theo khoá duy nhất (số hội nghị + số hiệu; không có số hội nghị: loại + số hiệu + ngày ban hành), không có thì tạo.
CREATE FUNCTION "public"."kl_nhap_van_ban"("d" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."van_ban_giao_viec"; v_loai text := coalesce(nullif("d" ->> 'loai_van_ban', ''), 'KHAC');
        v_so text := nullif(btrim(coalesce("d" ->> 'so_ket_luan', '')), ''); v_hn integer := nullif("d" ->> 'so_hoi_nghi', '')::integer;
        v_bh date := nullif("d" ->> 'ngay_ban_hanh', '')::date;
BEGIN
  IF v_so IS NULL OR v_bh IS NULL THEN RAISE EXCEPTION 'Thiếu số/ký hiệu hoặc ngày ban hành văn bản.' USING ERRCODE = '22023'; END IF;
  IF v_loai = 'KL_BTV' AND v_hn IS NULL THEN RAISE EXCEPTION 'Kết luận Ban Thường vụ phải có số hội nghị.' USING ERRCODE = '22023'; END IF;
  IF v_hn IS NOT NULL THEN
    SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "so_hoi_nghi" = v_hn AND btrim("so_ket_luan") = v_so;
  ELSE
    SELECT * INTO v FROM "public"."van_ban_giao_viec" WHERE "so_hoi_nghi" IS NULL AND "loai" = v_loai AND btrim("so_ket_luan") = v_so AND "ngay_ban_hanh" = v_bh;
  END IF;
  IF v."id" IS NOT NULL THEN
    IF v."loai" <> v_loai OR v."ngay_ban_hanh" <> v_bh THEN
      RAISE EXCEPTION 'Văn bản % đã có trên hệ thống với loại / ngày ban hành khác (ban hành %) — sửa tệp cho khớp.', v_so, to_char(v."ngay_ban_hanh", 'DD/MM/YYYY')
        USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('van_ban_id', v."id", 'van_ban_moi', false);
  END IF;
  INSERT INTO "public"."van_ban_giao_viec" ("loai", "so_hoi_nghi", "so_ket_luan", "ngay_ban_hanh", "tao_boi")
  VALUES (v_loai, v_hn, v_so, v_bh, "auth"."uid"()) RETURNING * INTO v;
  RETURN jsonb_build_object('van_ban_id', v."id", 'van_ban_moi', true);
END;
$$;

-- Minh chứng 4 yếu tố (+ cấp nhận của việc) nộp thay chủ trì cho việc đang chờ nghiệm thu; không gửi tin từng việc (tin tổng hợp ở lo_xong).
CREATE FUNCTION "public"."kl_nhap_minh_chung"("p_nv" "public"."nhiem_vu", "d" jsonb, "p_lo" "public"."lo_nhap") RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_loi text; v_ngay date := ("d" ->> 'kq_ngay')::date; v_so text := left(btrim("d" ->> 'kq_so_hieu'), 100);
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_nv"."van_ban_id";
  v_loi := "public"."minh_chung_kiem_ngay"(v_ngay, v_vb."ngay_ban_hanh", v_vb."ngay_nhan");
  IF v_loi IS NOT NULL THEN RAISE EXCEPTION 'Minh chứng: %', v_loi USING ERRCODE = '22023'; END IF;
  IF "p_nv"."cap_nhan_san_pham" IS NULL THEN RAISE EXCEPTION 'Minh chứng cần cấp nhận sản phẩm của việc.' USING ERRCODE = '22023'; END IF;
  INSERT INTO "public"."minh_chung" ("nhiem_vu_id", "loai", "so_hieu", "ngay_van_ban", "cap_nhan", "trich_yeu", "mo_ta_ket_qua", "nop_boi")
  VALUES ("p_nv"."id", 'so_hieu', v_so, v_ngay, "p_nv"."cap_nhan_san_pham", left(btrim("d" ->> 'kq_trich_yeu'), 300), left(btrim("d" ->> 'kq_mo_ta'), 600),
          coalesce("p_nv"."owner_tai_khoan", "p_nv"."nguoi_theo_doi"));
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES ("p_nv"."id", "auth"."uid"(), 'minh_chung_nop', format('Nộp minh chứng (nhập Excel lô %s) · %s: số %s · %s (ngày %s)', "p_lo"."ma", "p_nv"."ma", v_so,
          left(btrim("d" ->> 'kq_trich_yeu'), 120), to_char(v_ngay, 'DD/MM/YYYY')), 'app');
END;
$$;

-- GIAO / CHO_NGHIEM_THU: giao_viec như biểu mẫu (cờ kl.nhap_excel); hạn nộp minh chứng trống → ngày gợi ý của DB (kèm lý do khi sát / quá hạn).
CREATE FUNCTION "public"."kl_nhap_giao"("d" jsonb, "p_vb" uuid, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_k jsonb; v_han_nop date := nullif("d" ->> 'han_nop_minh_chung', '')::date; v_ly_do text; v_kq jsonb;
        v_nv "public"."nhiem_vu"; v_mc boolean; v_loai text := coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE');
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_vb";
  v_k := "public"."kl_khung_han_nop"(nullif("d" ->> 'han_xu_ly', '')::date, v_vb."ngay_ban_hanh", v_loai);
  IF v_han_nop IS NULL AND v_k IS NOT NULL THEN v_han_nop := (v_k ->> 'goi_y')::date; END IF;
  IF v_han_nop IS NOT NULL AND v_k IS NOT NULL AND (v_k ->> 'khong_ly_do_den' IS NULL OR v_han_nop > (v_k ->> 'khong_ly_do_den')::date) THEN
    v_ly_do := format('Nhập từ Excel (lô %s): hạn hoàn thành %s', "p_lo"."ma", CASE WHEN (v_k ->> 'qua_han')::boolean THEN 'đã qua' ELSE 'sát ngày nhập' END);
  END IF;
  PERFORM set_config('kl.nhap_excel', '1', true);
  v_kq := "public"."giao_viec"(jsonb_strip_nulls(jsonb_build_object(
    'van_ban_id', "p_vb", 'noi_dung', "d" ->> 'noi_dung', 'owner_don_vi_ma', "d" ->> 'owner_don_vi_ma', 'owner_tai_khoan', "d" ->> 'owner_tai_khoan',
    'nguoi_theo_doi', "d" ->> 'nguoi_theo_doi', 'thay_mat_cho', CASE WHEN "public"."me_role"() = 'A3' THEN "d" ->> 'thay_mat_cho' END,
    'loai_thoi_han_ma', v_loai, 'han_xu_ly', "d" ->> 'han_xu_ly', 'san_pham_loai', "d" ->> 'san_pham_loai', 'cap_nhan_san_pham', "d" ->> 'cap_nhan_san_pham',
    'do_khan', coalesce(nullif("d" ->> 'do_khan', ''), 'THUONG'), 'nguon_nhiem_vu_ma', "d" ->> 'nguon_nhiem_vu_ma', 'nganh_ma', "d" ->> 'nganh_ma',
    'linh_vuc_ma', "d" ->> 'linh_vuc_ma', 'linh_vuc_chi_tiet', "d" ->> 'linh_vuc_chi_tiet', 'van_ban_trien_khai', "d" ->> 'van_ban_trien_khai',
    'don_vi_phoi_hop', "d" ->> 'don_vi_phoi_hop', 'ghi_chu', "d" ->> 'ghi_chu', 'vuong_mac', "d" ->> 'vuong_mac',
    'ngay_nhan_van_ban', coalesce(v_vb."ngay_nhan", v_vb."ngay_ban_hanh"), 'han_nop_minh_chung', v_han_nop, 'ly_do_han_nop_sat', v_ly_do, 'theo_1400', true)));
  PERFORM set_config('kl.nhap_excel', '', true);
  IF v_vb."ngay_nhan" IS NULL THEN   -- tệp không có ngày nhận: lấy ngày ban hành, ghi là ƯỚC TÍNH (chủ trì sửa được ngày nhận thật — 0070 b)
    PERFORM set_config('kl.ghi_qua_ham', '1', true);
    UPDATE "public"."nhiem_vu" SET "ngay_nhan_uoc_tinh" = true WHERE "id" = (v_kq ->> 'id')::uuid;
    PERFORM set_config('kl.ghi_qua_ham', '', true);
  END IF;
  SELECT * INTO v_nv FROM "public"."nhiem_vu" WHERE "id" = (v_kq ->> 'id')::uuid;
  INSERT INTO "public"."lich_su" ("nhiem_vu_id", "nguoi_sua", "cot", "gia_tri_moi", "nguon")
  VALUES (v_nv."id", "auth"."uid"(), 'nhap_excel', format('Nhập từ Excel · lô %s, dòng %s (tệp %s)', "p_lo"."ma", "d" ->> 'so_dong', "p_lo"."ten_tep"), 'app');
  v_mc := "d" ->> 'tien_do_ma' = 'HOAN_THANH' AND "p_lo"."che_do_xong" = 'CHO_NGHIEM_THU' AND "public"."kl_nhap_du_kq"("d");
  IF v_mc THEN PERFORM "public"."kl_nhap_minh_chung"(v_nv, "d", "p_lo"); END IF;
  RETURN jsonb_build_object('id', v_nv."id", 'ma', v_nv."ma", 'minh_chung', v_mc);
END;
$$;

-- DA_XONG: việc đã xong ngoài hệ thống — nguon = excel, Hoàn thành, không ngày hoàn thành (kết quả "không đánh giá" — ngoài tỷ lệ đúng hạn).
CREATE FUNCTION "public"."kl_nhap_da_xong"("d" jsonb, "p_vb" uuid, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_vb "public"."van_ban_giao_viec"; v_id uuid; v_ma text; v_chu text;
BEGIN
  SELECT * INTO v_vb FROM "public"."van_ban_giao_viec" WHERE "id" = "p_vb";
  IF nullif("d" ->> 'nguoi_theo_doi', '') IS NULL THEN RAISE EXCEPTION 'Thiếu người theo dõi.' USING ERRCODE = '22023'; END IF;
  IF nullif("d" ->> 'thay_mat_cho', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."accounts" WHERE "id" = ("d" ->> 'thay_mat_cho')::uuid
       AND "role_group" IN ('A1', 'A2') AND NOT "is_system") THEN   -- như giao_viec: chỉ thay mặt lãnh đạo Văn phòng / Trưởng phòng
    RAISE EXCEPTION 'Lãnh đạo giao phải là lãnh đạo Văn phòng hoặc Trưởng phòng.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO "public"."nhiem_vu" ("van_ban_id", "noi_dung", "owner_don_vi_ma", "owner_tai_khoan", "nguoi_theo_doi", "giao_thay_mat_cho", "loai_thoi_han_ma",
    "han_xu_ly", "san_pham_loai", "cap_nhan_san_pham", "do_khan", "nguon_nhiem_vu_ma", "nganh_ma", "linh_vuc_ma", "linh_vuc_chi_tiet", "van_ban_trien_khai",
    "don_vi_phoi_hop", "ghi_chu", "theo_1400", "tien_do_ma", "chat_luong", "nguon", "tao_boi", "ngay_nhan_van_ban", "ngay_nhan_uoc_tinh")
  VALUES ("p_vb", btrim("d" ->> 'noi_dung'), nullif("d" ->> 'owner_don_vi_ma', ''), nullif("d" ->> 'owner_tai_khoan', '')::uuid, ("d" ->> 'nguoi_theo_doi')::uuid,
    nullif("d" ->> 'thay_mat_cho', '')::uuid, coalesce(nullif("d" ->> 'loai_thoi_han_ma', ''), 'CO_HAN_CU_THE'), nullif("d" ->> 'han_xu_ly', '')::date,
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

-- CAP_NHAT (mã có trên hệ thống — "Xuất ra Excel theo mẫu" rồi nhập lại): ô trống trong tệp KHÔNG xoá dữ liệu đang có. Áp: ô thông tin giao (như
-- sua_thong_tin_giao — người giao / quản trị nhiệm vụ), vướng mắc (việc đang mở), minh chứng chờ nghiệm thu (Hoàn thành + đủ 4 yếu tố, chế độ
-- CHO_NGHIEM_THU, việc đang mở chưa có minh chứng chờ / hợp lệ). Chỉ BÁO (không đổi): chủ trì, người theo dõi (Giao lại), hạn (Gia hạn).
CREATE FUNCTION "public"."kl_nhap_cap_nhat"("d" jsonb, "p_lo" "public"."lo_nhap") RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v "public"."nhiem_vu"; v_thay jsonb := '{}'::jsonb; v_moi jsonb; v_cu jsonb := '{}'::jsonb; v_bao text[] := '{}'; k text; val text;
        v_me uuid := "auth"."uid"(); v_vm text := left(nullif(btrim("d" ->> 'vuong_mac'), ''), 500);
BEGIN
  SELECT * INTO v FROM "public"."nhiem_vu" WHERE upper("ma") = upper(btrim("d" ->> 'ma')) FOR UPDATE;
  FOR k, val IN SELECT e.key, btrim(e.value) FROM jsonb_each_text(jsonb_strip_nulls(jsonb_build_object('noi_dung', "d" ->> 'noi_dung',
      'san_pham_loai', "d" ->> 'san_pham_loai', 'cap_nhan_san_pham', "d" ->> 'cap_nhan_san_pham', 'do_khan', "d" ->> 'do_khan', 'nganh_ma', "d" ->> 'nganh_ma',
      'linh_vuc_ma', "d" ->> 'linh_vuc_ma', 'linh_vuc_chi_tiet', "d" ->> 'linh_vuc_chi_tiet', 'nguon_nhiem_vu_ma', "d" ->> 'nguon_nhiem_vu_ma',
      'don_vi_phoi_hop', "d" ->> 'don_vi_phoi_hop'))) e LOOP
    IF val <> '' AND val IS DISTINCT FROM btrim(coalesce(to_jsonb(v) ->> k, '')) THEN v_thay := v_thay || jsonb_build_object(k, val); END IF;
  END LOOP;
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

REVOKE ALL ON FUNCTION "public"."kl_nhap_du_kq"(jsonb), "public"."kl_nhap_van_ban"(jsonb), "public"."kl_nhap_minh_chung"("public"."nhiem_vu", jsonb, "public"."lo_nhap"),
  "public"."kl_nhap_giao"(jsonb, uuid, "public"."lo_nhap"), "public"."kl_nhap_da_xong"(jsonb, uuid, "public"."lo_nhap"), "public"."kl_nhap_cap_nhat"(jsonb, "public"."lo_nhap")
  FROM public, "anon", "authenticated";
