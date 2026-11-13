-- 0137 (v3.35 — CAU-HOI nhóm U): cập nhật tiến độ nhiệm vụ quý — một lần cập nhật gồm báo cáo tuần (kết quả trong kỳ, kết quả thực hiện lũy kế, vướng
-- mắc, đề xuất, nguồn thông tin), thay đổi trạng thái / kết quả của từng kết quả, sản phẩm (văn bản đã ban hành: số, ngày; hoạt động đã tổ chức: ngày;
-- chỉ tiêu: số liệu) — ghi chung một giao dịch, gắn tuần báo cáo chứa "ngày báo cáo" (tuần đã chốt → tuần mở kế tiếp). Ý kiến chỉ đạo / trao đổi, tệp.
-- Chủ trì theo dõi là người cập nhật chính; lãnh đạo xem (chủ dự án 13/11/2026). Tin báo: người khác cập nhật thay → chủ trì theo dõi; vướng mắc / đề xuất
-- mới → đầu mối tổng hợp và Chánh Văn phòng; chỉ đạo → người theo dõi; trả lời → người gửi chỉ đạo.

CREATE FUNCTION "public"."nvq_ten_trang_thai_sp"("p" text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE "p" WHEN 'CHUA' THEN 'Chưa triển khai' WHEN 'DANG' THEN 'Đang thực hiện' WHEN 'DA_TRINH' THEN 'Đã trình' WHEN 'HOAN_THANH' THEN 'Hoàn thành'
    WHEN 'KHONG_PHAT_SINH' THEN 'Không phát sinh' WHEN 'KHONG_THUC_HIEN' THEN 'Không thực hiện' ELSE "p" END;
$$;

CREATE FUNCTION "public"."nvq_cap_nhat_gui"("p" jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nvq_nhiem_vu"; k "public"."nvq_ky"; w "public"."nvq_tuan"; s "public"."nvq_san_pham"; e jsonb; v_cn uuid; v_me uuid := "auth"."uid"();
        v_hom date := "public"."kl_hom_nay"(); v_ngay date := coalesce(nullif("p" ->> 'ngay_bao_cao', '')::date, "public"."kl_hom_nay"());
        v_nd text := nullif(btrim(coalesce("p" ->> 'noi_dung', '')), ''); v_kq text := nullif(btrim(coalesce("p" ->> 'ket_qua_thuc_hien', '')), '');
        v_vm text := nullif(btrim(coalesce("p" ->> 'vuong_mac', '')), ''); v_dx text := nullif(btrim(coalesce("p" ->> 'de_xuat', '')), '');
        v_ktd boolean := coalesce(("p" ->> 'khong_thay_doi')::boolean, false); v_doi jsonb := '[]'; v_tt text; v_ngay_xong date; v_gt numeric; v_ns date;
        v_vm_moi boolean := false; v_tin text;
BEGIN
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid FOR UPDATE;
  IF n."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  IF NOT "public"."nvq_duoc_cap_nhat"(n) THEN
    RAISE EXCEPTION 'Chỉ chủ trì theo dõi, người được phân công, Trưởng phòng của các đồng chí đó, lãnh đạo Văn phòng hoặc đầu mối tổng hợp mới cập nhật nhiệm vụ này (quý chưa chốt, nhiệm vụ còn trong danh mục).'
      USING ERRCODE = '42501';
  END IF;
  k := "public"."nvq_ky_mo"(n."ky_id");
  IF v_ngay > v_hom OR v_ngay < k."tu_ngay" - 31 THEN RAISE EXCEPTION 'Ngày báo cáo không sau hôm nay và không quá xa trước quý.' USING ERRCODE = '22023'; END IF;
  IF char_length(v_nd) > 6000 OR char_length(v_kq) > 6000 OR char_length(v_vm) > 2000 OR char_length(v_dx) > 2000 OR char_length("p" ->> 'nguon_thong_tin') > 300 THEN
    RAISE EXCEPTION 'Nội dung cập nhật quá dài.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO w FROM "public"."nvq_tuan" WHERE "id" = "public"."nvq_tuan_cua"(k."id", v_ngay);
  IF w."trang_thai" = 'DA_CHOT' THEN
    SELECT * INTO w FROM "public"."nvq_tuan" WHERE "ky_id" = k."id" AND "so" > w."so" AND "trang_thai" = 'MO' ORDER BY "so" LIMIT 1;
    IF w."id" IS NULL THEN RAISE EXCEPTION 'Các tuần báo cáo của quý đã chốt hết.' USING ERRCODE = '22023'; END IF;
  END IF;
  INSERT INTO "public"."nvq_cap_nhat" ("nhiem_vu_id", "tuan_id", "ngay_bao_cao", "noi_dung", "vuong_mac", "de_xuat", "nguon_thong_tin", "khong_thay_doi", "tao_boi")
  VALUES (n."id", w."id", v_ngay, v_nd, v_vm, v_dx, nullif(btrim(coalesce("p" ->> 'nguon_thong_tin', '')), ''), v_ktd, v_me) RETURNING "id" INTO v_cn;

  -- Kết quả / sản phẩm: trạng thái và kết quả (văn bản, hoạt động).
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce("p" -> 'san_pham', '[]')) LOOP
    SELECT * INTO s FROM "public"."nvq_san_pham" WHERE "id" = nullif(e ->> 'id', '')::uuid AND "nhiem_vu_id" = n."id" FOR UPDATE;
    IF s."id" IS NULL THEN RAISE EXCEPTION 'Kết quả, sản phẩm không thuộc nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
    v_tt := coalesce(nullif(e ->> 'trang_thai', ''), s."trang_thai");
    IF v_tt NOT IN ('CHUA', 'DANG', 'DA_TRINH', 'HOAN_THANH', 'KHONG_PHAT_SINH', 'KHONG_THUC_HIEN') THEN RAISE EXCEPTION 'Trạng thái kết quả không hợp lệ.' USING ERRCODE = '22023'; END IF;
    v_ngay_xong := CASE WHEN v_tt = 'HOAN_THANH' THEN coalesce(nullif(e ->> 'ngay_hoan_thanh', '')::date, nullif(e ->> 'kq_ngay', '')::date, s."ngay_hoan_thanh", v_ngay) END;
    IF v_ngay_xong > v_hom THEN RAISE EXCEPTION 'Ngày hoàn thành không sau hôm nay.' USING ERRCODE = '22023'; END IF;
    IF v_tt = 'HOAN_THANH' AND s."loai" = 'VAN_BAN' AND coalesce(nullif(btrim(coalesce(e ->> 'kq_so_ky_hieu', '')), ''), s."kq_so_ky_hieu", nullif(btrim(coalesce(e ->> 'kq_mo_ta', '')), ''), s."kq_mo_ta") IS NULL THEN
      RAISE EXCEPTION 'Văn bản đã ban hành: ghi số, ký hiệu (hoặc mô tả kết quả) của văn bản.' USING ERRCODE = '22023';
    END IF;
    IF v_tt = 'KHONG_THUC_HIEN' AND NOT "public"."nvq_la_quan_ly"() THEN
      RAISE EXCEPTION 'Chỉ đầu mối tổng hợp đánh dấu kết quả "Không thực hiện" (điều chỉnh danh mục).' USING ERRCODE = '42501';
    END IF;
    UPDATE "public"."nvq_san_pham" SET "trang_thai" = v_tt, "ngay_hoan_thanh" = v_ngay_xong,
      "kq_so_ky_hieu" = CASE WHEN e ? 'kq_so_ky_hieu' THEN nullif(btrim(coalesce(e ->> 'kq_so_ky_hieu', '')), '') ELSE "kq_so_ky_hieu" END,
      "kq_ngay" = CASE WHEN e ? 'kq_ngay' THEN nullif(e ->> 'kq_ngay', '')::date ELSE "kq_ngay" END,
      "kq_co_quan" = CASE WHEN e ? 'kq_co_quan' THEN nullif(btrim(coalesce(e ->> 'kq_co_quan', '')), '') ELSE "kq_co_quan" END,
      "kq_trich_yeu" = CASE WHEN e ? 'kq_trich_yeu' THEN nullif(btrim(coalesce(e ->> 'kq_trich_yeu', '')), '') ELSE "kq_trich_yeu" END,
      "kq_mo_ta" = CASE WHEN e ? 'kq_mo_ta' THEN nullif(btrim(coalesce(e ->> 'kq_mo_ta', '')), '') ELSE "kq_mo_ta" END,
      "sua_boi" = v_me, "sua_luc" = now()
    WHERE "id" = s."id";
    IF v_tt IS DISTINCT FROM s."trang_thai" OR e ? 'kq_so_ky_hieu' OR e ? 'kq_mo_ta' THEN
      v_doi := v_doi || jsonb_build_object('san_pham_id', s."id", 'mo_ta', left(s."mo_ta", 200), 'cu', s."trang_thai", 'moi', v_tt,
        'kq', nullif(concat_ws(', ', nullif(btrim(coalesce(e ->> 'kq_so_ky_hieu', '')), ''), to_char(nullif(e ->> 'kq_ngay', '')::date, 'DD/MM/YYYY'),
                                nullif(btrim(coalesce(e ->> 'kq_mo_ta', '')), '')), ''));
    END IF;
  END LOOP;

  -- Số liệu chỉ tiêu (lũy kế theo ngày số liệu); giá trị thực hiện của chỉ tiêu = số có ngày số liệu mới nhất.
  FOR e IN SELECT * FROM jsonb_array_elements(coalesce("p" -> 'so_lieu', '[]')) LOOP
    SELECT * INTO s FROM "public"."nvq_san_pham" WHERE "id" = nullif(e ->> 'san_pham_id', '')::uuid AND "nhiem_vu_id" = n."id" FOR UPDATE;
    IF s."id" IS NULL OR s."loai" <> 'CHI_TIEU' THEN RAISE EXCEPTION 'Số liệu chỉ ghi cho kết quả loại chỉ tiêu của nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
    v_gt := nullif(e ->> 'gia_tri', '')::numeric; v_ns := coalesce(nullif(e ->> 'ngay_so_lieu', '')::date, v_ngay);
    IF v_gt IS NULL OR v_ns > v_hom THEN RAISE EXCEPTION 'Số liệu: ghi giá trị và ngày số liệu (không sau hôm nay).' USING ERRCODE = '22023'; END IF;
    INSERT INTO "public"."nvq_so_lieu" ("san_pham_id", "gia_tri", "ngay_so_lieu", "uoc_tinh", "nguon", "nhap_boi", "cap_nhat_id")
    VALUES (s."id", v_gt, v_ns, coalesce((e ->> 'uoc_tinh')::boolean, false), nullif(btrim(coalesce(e ->> 'nguon', '')), ''), v_me, v_cn);
    UPDATE "public"."nvq_san_pham" x SET ("thuc_hien", "thuc_hien_ngay", "thuc_hien_nguon") = (
      SELECT l."gia_tri", l."ngay_so_lieu", l."nguon" FROM "public"."nvq_so_lieu" l WHERE l."san_pham_id" = s."id" ORDER BY l."ngay_so_lieu" DESC, l."nhap_luc" DESC LIMIT 1),
      "trang_thai" = CASE WHEN x."trang_thai" = 'CHUA' THEN 'DANG' ELSE x."trang_thai" END, "sua_boi" = v_me, "sua_luc" = now()
    WHERE x."id" = s."id";
    v_doi := v_doi || jsonb_build_object('san_pham_id', s."id", 'mo_ta', left(s."mo_ta", 200), 'so_lieu', v_gt, 'don_vi_tinh', s."don_vi_tinh",
                                         'ngay_so_lieu', v_ns, 'uoc_tinh', coalesce((e ->> 'uoc_tinh')::boolean, false));
  END LOOP;

  IF v_nd IS NULL AND v_kq IS NULL AND v_vm IS NULL AND v_dx IS NULL AND NOT v_ktd AND jsonb_array_length(v_doi) = 0 AND NOT ("p" ? 'vuong_mac' OR "p" ? 'de_xuat') THEN
    RAISE EXCEPTION 'Ghi nội dung cập nhật, hoặc chọn "Không có thay đổi trong tuần".' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."nvq_cap_nhat" SET "thay_doi" = v_doi WHERE "id" = v_cn;
  v_vm_moi := ("p" ? 'vuong_mac' AND v_vm IS DISTINCT FROM n."vuong_mac" AND v_vm IS NOT NULL) OR ("p" ? 'de_xuat' AND v_dx IS DISTINCT FROM n."de_xuat" AND v_dx IS NOT NULL);
  UPDATE "public"."nvq_nhiem_vu" SET
    "ket_qua_thuc_hien" = coalesce(v_kq, "ket_qua_thuc_hien"), "ket_qua_luc" = CASE WHEN v_kq IS NOT NULL THEN now() ELSE "ket_qua_luc" END,
    "ket_qua_boi" = CASE WHEN v_kq IS NOT NULL THEN v_me ELSE "ket_qua_boi" END,
    "vuong_mac" = CASE WHEN "p" ? 'vuong_mac' THEN v_vm ELSE "vuong_mac" END, "de_xuat" = CASE WHEN "p" ? 'de_xuat' THEN v_dx ELSE "de_xuat" END,
    "sua_luc" = now()
  WHERE "id" = n."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'cap_nhat', format('Cập nhật tiến độ tuần %s%s', w."so",
    CASE WHEN v_ktd THEN ' — không có thay đổi' WHEN jsonb_array_length(v_doi) > 0 THEN format(' — %s thay đổi kết quả, số liệu', jsonb_array_length(v_doi)) ELSE '' END),
    jsonb_build_object('cap_nhat_id', v_cn, 'thay_doi', v_doi));

  v_tin := format('Nhiệm vụ quý · %s%s.(%s)', "public"."nvq_la_ma"(n."truc_so"), CASE n."nhom" WHEN 'TRONG_CT' THEN '.1' ELSE '.2' END, n."stt");
  IF n."chu_tri_theo_doi" IS DISTINCT FROM v_me THEN
    PERFORM "public"."nvq_gui_tin"(n."id", ARRAY[n."chu_tri_theo_doi"], v_tin || ': có cập nhật tiến độ mới do đồng chí khác ghi.');
  END IF;
  IF v_vm_moi THEN
    PERFORM "public"."nvq_gui_tin"(n."id", ARRAY(SELECT "tai_khoan" FROM "public"."nvq_phan_quyen")
      || ARRAY(SELECT "id" FROM "public"."accounts" WHERE "is_chief" AND "role_group" = 'A1' AND NOT "is_system"),
      v_tin || ': có vướng mắc / đề xuất mới — ' || left(coalesce(v_vm, v_dx), 200));
  END IF;
  RETURN jsonb_build_object('id', v_cn, 'tuan', w."so", 'thay_doi', jsonb_array_length(v_doi));
END;
$$;

-- Sửa nội dung chữ của một lần cập nhật (người ghi, tuần chưa chốt; người quản lý danh mục sửa được mọi lần) — không đổi kết quả / số liệu đã ghi.
CREATE FUNCTION "public"."nvq_cap_nhat_sua"("p_id" uuid, "p" jsonb, "p_ly_do" text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c "public"."nvq_cap_nhat"; n "public"."nvq_nhiem_vu"; v_ql boolean := "public"."nvq_la_quan_ly"();
BEGIN
  SELECT * INTO c FROM "public"."nvq_cap_nhat" WHERE "id" = "p_id" FOR UPDATE;
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = c."nhiem_vu_id";
  IF c."id" IS NULL OR NOT (v_ql OR (c."tao_boi" = "auth"."uid"() AND "public"."nvq_duoc_cap_nhat"(n))) THEN
    RAISE EXCEPTION 'Chỉ người ghi lần cập nhật này hoặc đầu mối tổng hợp mới sửa được.' USING ERRCODE = '42501';
  END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  IF NOT v_ql AND EXISTS (SELECT 1 FROM "public"."nvq_tuan" WHERE "id" = c."tuan_id" AND "trang_thai" = 'DA_CHOT') THEN
    RAISE EXCEPTION 'Tuần báo cáo đã chốt: đề nghị đầu mối tổng hợp sửa.' USING ERRCODE = '22023';
  END IF;
  UPDATE "public"."nvq_cap_nhat" SET
    "noi_dung" = CASE WHEN "p" ? 'noi_dung' THEN nullif(btrim(coalesce("p" ->> 'noi_dung', '')), '') ELSE "noi_dung" END,
    "vuong_mac" = CASE WHEN "p" ? 'vuong_mac' THEN nullif(btrim(coalesce("p" ->> 'vuong_mac', '')), '') ELSE "vuong_mac" END,
    "de_xuat" = CASE WHEN "p" ? 'de_xuat' THEN nullif(btrim(coalesce("p" ->> 'de_xuat', '')), '') ELSE "de_xuat" END,
    "nguon_thong_tin" = CASE WHEN "p" ? 'nguon_thong_tin' THEN nullif(btrim(coalesce("p" ->> 'nguon_thong_tin', '')), '') ELSE "nguon_thong_tin" END,
    "sua_luc" = now()
  WHERE "id" = c."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'sua_cap_nhat', concat_ws(' — lý do: ', format('Sửa nội dung cập nhật ngày %s', to_char(c."ngay_bao_cao", 'DD/MM/YYYY')),
    "public"."nvq_ly_do"("p_ly_do", c."tao_boi" IS DISTINCT FROM "auth"."uid"())));
END;
$$;

-- Xoá một số liệu nhập nhầm (người nhập hoặc đầu mối) — tính lại giá trị thực hiện.
CREATE FUNCTION "public"."nvq_so_lieu_xoa"("p_id" uuid, "p_ly_do" text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l "public"."nvq_so_lieu"; s "public"."nvq_san_pham"; n "public"."nvq_nhiem_vu"; v_ly text := "public"."nvq_ly_do"("p_ly_do");
BEGIN
  SELECT * INTO l FROM "public"."nvq_so_lieu" WHERE "id" = "p_id";
  SELECT * INTO s FROM "public"."nvq_san_pham" WHERE "id" = l."san_pham_id" FOR UPDATE;
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = s."nhiem_vu_id";
  IF l."id" IS NULL OR NOT ("public"."nvq_la_quan_ly"() OR (l."nhap_boi" = "auth"."uid"() AND "public"."nvq_duoc_cap_nhat"(n))) THEN
    RAISE EXCEPTION 'Chỉ người nhập số liệu hoặc đầu mối tổng hợp mới xoá được.' USING ERRCODE = '42501';
  END IF;
  PERFORM "public"."nvq_ky_mo"(n."ky_id");
  DELETE FROM "public"."nvq_so_lieu" WHERE "id" = l."id";
  UPDATE "public"."nvq_san_pham" x SET ("thuc_hien", "thuc_hien_ngay", "thuc_hien_nguon") = (
    SELECT q."gia_tri", q."ngay_so_lieu", q."nguon" FROM (SELECT 1) d LEFT JOIN LATERAL (SELECT * FROM "public"."nvq_so_lieu" y WHERE y."san_pham_id" = s."id"
      ORDER BY y."ngay_so_lieu" DESC, y."nhap_luc" DESC LIMIT 1) q ON true), "sua_luc" = now()
  WHERE x."id" = s."id";
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'xoa_so_lieu', format('Xoá số liệu %s ngày %s của "%s" — lý do: %s', l."gia_tri",
    to_char(l."ngay_so_lieu", 'DD/MM/YYYY'), left(s."mo_ta", 120), v_ly));
END;
$$;

-- ---- Ý kiến chỉ đạo / trao đổi ----
CREATE FUNCTION "public"."nvq_y_kien_gui"("p" jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n "public"."nvq_nhiem_vu"; v_loai text := coalesce(nullif("p" ->> 'loai', ''), 'TRAO_DOI'); v_cha "public"."nvq_y_kien"; v_id uuid;
        v_nd text := btrim(coalesce("p" ->> 'noi_dung', '')); v_tin text;
BEGIN
  SELECT * INTO n FROM "public"."nvq_nhiem_vu" WHERE "id" = nullif("p" ->> 'nhiem_vu_id', '')::uuid;
  IF n."id" IS NULL THEN RAISE EXCEPTION 'Không có nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  IF v_loai NOT IN ('CHI_DAO', 'TRAO_DOI') OR char_length(v_nd) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Ghi nội dung ý kiến (tối đa 2.000 ký tự).' USING ERRCODE = '22023'; END IF;
  IF (v_loai = 'CHI_DAO' AND NOT "public"."nvq_duoc_chi_dao"()) OR (v_loai = 'TRAO_DOI' AND NOT ("public"."nvq_duoc_chi_dao"() OR "public"."nvq_duoc_cap_nhat"(n))) THEN
    RAISE EXCEPTION 'Ý kiến chỉ đạo: Thường trực, lãnh đạo Văn phòng, đầu mối tổng hợp; trao đổi: thêm người theo dõi nhiệm vụ.' USING ERRCODE = '42501';
  END IF;
  IF nullif("p" ->> 'tra_loi_cho', '') IS NOT NULL THEN
    SELECT * INTO v_cha FROM "public"."nvq_y_kien" WHERE "id" = ("p" ->> 'tra_loi_cho')::uuid AND "nhiem_vu_id" = n."id";
    IF v_cha."id" IS NULL THEN RAISE EXCEPTION 'Ý kiến được trả lời không thuộc nhiệm vụ này.' USING ERRCODE = '22023'; END IF;
  END IF;
  INSERT INTO "public"."nvq_y_kien" ("nhiem_vu_id", "loai", "noi_dung", "tra_loi_cho", "han_tra_loi", "nguoi_gui")
  VALUES (n."id", v_loai, v_nd, v_cha."id", CASE WHEN v_loai = 'CHI_DAO' THEN nullif("p" ->> 'han_tra_loi', '')::date END, "auth"."uid"())
  RETURNING "id" INTO v_id;
  v_tin := format('Nhiệm vụ quý · %s%s.(%s): ', "public"."nvq_la_ma"(n."truc_so"), CASE n."nhom" WHEN 'TRONG_CT' THEN '.1' ELSE '.2' END, n."stt");
  PERFORM "public"."nvq_gui_tin"(n."id", "public"."nvq_nguoi_theo_doi"(n."id") || ARRAY[v_cha."nguoi_gui"],
    v_tin || CASE WHEN v_loai = 'CHI_DAO' THEN 'ý kiến chỉ đạo — ' WHEN v_cha."id" IS NOT NULL THEN 'trả lời ý kiến — ' ELSE 'trao đổi — ' END || left(v_nd, 200));
  PERFORM "public"."nvq_ghi_lich_su"(n."id", n."ky_id", 'y_kien', CASE WHEN v_loai = 'CHI_DAO' THEN 'Ý kiến chỉ đạo' WHEN v_cha."id" IS NOT NULL THEN 'Trả lời ý kiến' ELSE 'Trao đổi' END);
  RETURN v_id;
END;
$$;
CREATE FUNCTION "public"."nvq_y_kien_xong"("p_id" uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y "public"."nvq_y_kien";
BEGIN
  SELECT * INTO y FROM "public"."nvq_y_kien" WHERE "id" = "p_id" FOR UPDATE;
  IF y."id" IS NULL OR NOT (y."nguoi_gui" = "auth"."uid"() OR "public"."nvq_la_quan_ly"()) THEN
    RAISE EXCEPTION 'Chỉ người gửi ý kiến hoặc đầu mối tổng hợp mới đánh dấu đã xử lý.' USING ERRCODE = '42501';
  END IF;
  UPDATE "public"."nvq_y_kien" SET "da_xong" = true, "xong_boi" = "auth"."uid"(), "xong_luc" = now() WHERE "id" = y."id";
END;
$$;
